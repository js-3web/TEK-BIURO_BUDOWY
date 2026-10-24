/* =========================================================
   BIURO BUDOWY — kalendarz dni roboczych (PL) i eksport terminów do pliku .ics
   ---------------------------------------------------------
   1) M.CAL – święta ustawowe w Polsce (ustawa z 18.01.1951 o dniach wolnych od pracy,
      z Wigilią 24.12 dodaną od 2025 r. – Dz.U. 2024 poz. 1965). Dzień roboczy = pon–pt
      i nie święto. Soboty nie są świętem ustawowym, ale w terminach liczonych „w dniach
      roboczych” zwykle się ich nie liczy – sprawdź definicję w umowie.
      UWAGA: terminy FIDIC (28/84/14/42 dni) liczy się w dniach KALENDARZOWYCH –
      tego kalendarza nie używa się w module „Terminy umowne”.
   2) M.ICS – plik kalendarza (RFC 5545). Działa bez serwera: pobierasz plik i otwierasz
      go w Outlooku / Google Calendar / telefonie. Każde wydarzenie ma stały UID, więc
      ponowny import w Outlooku aktualizuje wpis zamiast go dublować (Google Calendar
      przy imporcie pliku potrafi utworzyć kopie – usuń stare przed ponownym importem).
   Moduły zgłaszają terminy funkcją deadlines() → [{ uid, date, title, desc, src }].
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;

  // ---------------- święta ----------------
  /** Wielkanoc (algorytm Meeusa/Jonesa/Butchera, kalendarz gregoriański) */
  const easter = (y) => {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), f = b % 4, g = Math.floor((b + 8) / 25), h = Math.floor((b - g + 1) / 3);
    const k = (19 * a + b - d - h + 15) % 30, i = Math.floor(c / 4), l = c % 4, m = (32 + 2 * f + 2 * i - k - l) % 7, n = Math.floor((a + 11 * k + 22 * m) / 451);
    const month = Math.floor((k + m - 7 * n + 114) / 31), day = ((k + m - 7 * n + 114) % 31) + 1;
    return `${y}-${M.pad(month)}-${M.pad(day)}`;
  };
  const cache = {};
  /** święta danego roku: { 'RRRR-MM-DD': 'nazwa' } */
  const holidays = (y) => {
    if (cache[y]) return cache[y];
    const E = easter(y); const o = {};
    const fix = [['01-01', 'Nowy Rok'], ['01-06', 'Trzech Króli'], ['05-01', 'Święto Pracy'], ['05-03', 'Święto Konstytucji 3 Maja'], ['08-15', 'Wniebowzięcie NMP'], ['11-01', 'Wszystkich Świętych'], ['11-11', 'Narodowe Święto Niepodległości'], ['12-25', 'Boże Narodzenie (1. dzień)'], ['12-26', 'Boże Narodzenie (2. dzień)']];
    fix.forEach(([md, n]) => o[`${y}-${md}`] = n);
    if (y >= 2025) o[`${y}-12-24`] = 'Wigilia Bożego Narodzenia';
    o[E] = 'Wielkanoc'; o[M.addDays(E, 1)] = 'Poniedziałek Wielkanocny'; o[M.addDays(E, 49)] = 'Zielone Świątki'; o[M.addDays(E, 60)] = 'Boże Ciało';
    return (cache[y] = o);
  };
  const CAL = M.CAL = {
    easter, holidays,
    holiday: (iso) => iso ? holidays(+iso.slice(0, 4))[iso.slice(0, 10)] || '' : '',
    isWorkday: (iso) => { const d = M.toDate(iso); if (!d) return false; const w = d.getDay(); return w !== 0 && w !== 6 && !CAL.holiday(iso); },
    /** n dni roboczych po dacie (data startowa się nie liczy; n=0 → najbliższy dzień roboczy od daty włącznie) */
    addWorkdays: (iso, n) => { if (!iso) return ''; let d = iso; if (!(n > 0)) { while (!CAL.isWorkday(d)) d = M.addDays(d, 1); return d; } let k = 0; while (k < n) { d = M.addDays(d, 1); if (CAL.isWorkday(d)) k++; } return d; },
    /** n dni roboczych PRZED datą */
    subWorkdays: (iso, n) => { if (!iso) return ''; let d = iso, k = 0; while (k < n) { d = M.addDays(d, -1); if (CAL.isWorkday(d)) k++; } return d; },
    /** dni robocze w przedziale (obie daty włącznie) */
    workdaysBetween: (a, b) => { if (!a || !b || b < a) return 0; let n = 0; for (let d = a; d <= b; d = M.addDays(d, 1)) if (CAL.isWorkday(d)) n++; return n; },
    /** termin: n dni kalendarzowych albo roboczych od daty */
    due: (iso, n, mode) => { if (!iso || n === '' || n == null || isNaN(n)) return ''; return mode === 'robocze' ? CAL.addWorkdays(iso, Number(n)) : M.addDays(iso, Number(n)); },
    /** termin kalendarzowy przypadający na dzień wolny – informacyjnie (KC art. 115: upływa następnego dnia roboczego; sprawdź umowę) */
    note: (iso) => { if (!iso) return ''; const h = CAL.holiday(iso); const w = M.toDate(iso).getDay(); return h ? `święto: ${h}` : w === 0 ? 'niedziela' : w === 6 ? 'sobota' : ''; },
  };

  // ---------------- plik .ics ----------------
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const enc = new TextEncoder();
  /** zawijanie linii do 75 bajtów (RFC 5545 3.1), bez dzielenia znaków UTF-8 */
  const fold = (line) => { const out = []; let cur = '', bytes = 0, limit = 75; for (const ch of line) { const b = enc.encode(ch).length; if (bytes + b > limit) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; limit = 75; } else { cur += ch; bytes += b; } } out.push(cur); return out.join('\r\n'); };
  const ymd = (iso) => iso.replace(/-/g, '').slice(0, 8);
  const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const ICS = M.ICS = {
    /** items: [{uid, date, title, desc}] → tekst pliku .ics (wydarzenia całodniowe, przypomnienie 2 dni wcześniej o 9:00) */
    build(items, calName) {
      const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TEKTORIA//TEK-BIURO BUDOWY//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(calName || 'TEK-BIURO BUDOWY')];
      const ts = stamp();
      items.filter(i => i && i.date && /^\d{4}-\d\d-\d\d/.test(i.date)).forEach(i => {
        L.push('BEGIN:VEVENT', 'UID:' + esc(i.uid) + '@tektoria', 'DTSTAMP:' + ts, 'DTSTART;VALUE=DATE:' + ymd(i.date), 'DTEND;VALUE=DATE:' + ymd(M.addDays(i.date, 1)), 'SUMMARY:' + esc(i.title), 'DESCRIPTION:' + esc(i.desc || ''), 'TRANSP:TRANSPARENT', 'CATEGORIES:' + esc(i.src || 'Budowa'));
        if (i.alarm !== false) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(i.title), 'TRIGGER;RELATED=START:-PT39H', 'END:VALARM'); // 00:00 dnia terminu − 39 h = 9:00 dwa dni wcześniej
        L.push('END:VEVENT');
      });
      L.push('END:VCALENDAR');
      return L.map(fold).join('\r\n') + '\r\n';
    },
    /** terminy ze wszystkich modułów, które je zgłaszają: { src: { label, items } } */
    collect() {
      const out = {};
      Object.entries(M.modules).forEach(([id, m]) => { if (!m.deadlines || !M.enabled(id) || !M.P.canView(id)) return; try { const list = m.deadlines() || []; if (list.length) out[id] = { label: m.title, items: list }; } catch (err) { console.error('deadlines', id, err); } });
      return out;
    },
    /** okno: wybór źródeł → pobranie pliku */
    dialog(only) {
      if (!M.S.project) return M.toast('Najpierw wybierz budowę', 'warn');
      const all = ICS.collect(); const keys = Object.keys(all).filter(k => !only || only.includes(k));
      const t = M.todayISO();
      const m = M.UI.modal({ title: 'Eksport terminów do kalendarza (.ics)', body: `
        <div class="small muted">Plik otworzysz w Outlooku, Google Calendar albo na telefonie. Każdy termin to wydarzenie całodniowe z przypomnieniem <b>2 dni wcześniej o 9:00</b>. Ponowny import w Outlooku aktualizuje te same terminy (stały identyfikator). Plik nie aktualizuje się sam – po zmianach wyeksportuj go jeszcze raz.</div>
        ${keys.length ? `<div class="col" style="margin-top:8px">${keys.map(k => { const fut = all[k].items.filter(i => i.date >= t).length; return `<label class="check"><input type="checkbox" data-k="${k}" ${fut ? 'checked' : ''}>${e(all[k].label)} <span class="muted small">(${fut} ${M.plural(fut, 'termin', 'terminy', 'terminów')} od dziś${all[k].items.length > fut ? `, ${all[k].items.length - fut} minionych` : ''})</span></label>`; }).join('')}</div>
        <label class="check" style="margin-top:6px"><input type="checkbox" id="past">Dołącz terminy, które już minęły</label>` : M.UI.empty('Brak terminów do eksportu.', 'cal')}`,
        footer: keys.length ? `<button class="btn primary" id="go">${M.icon.download}Pobierz plik .ics</button>` : '' });
      const go = m.querySelector('#go'); if (!go) return;
      go.onclick = () => {
        const past = m.querySelector('#past').checked; let items = [];
        m.querySelectorAll('[data-k]').forEach(cb => { if (cb.checked) items = items.concat(all[cb.dataset.k].items.map(i => ({ ...i, src: i.src || all[cb.dataset.k].label }))); });
        if (!past) items = items.filter(i => i.date >= t);
        if (!items.length) return M.toast('Nie wybrano żadnych terminów', 'warn');
        const p = M.S.project;
        M.download(new Blob([ICS.build(items, 'Budowa: ' + (p.short || p.name))], { type: 'text/calendar;charset=utf-8' }), `Terminy_${M.safeName(p.short || p.name)}_${t}.ics`);
        m.close(); M.toast(`Wyeksportowano ${items.length} ${M.plural(items.length, 'termin', 'terminy', 'terminów')}`);
      };
    },
  };
})(window.M);
