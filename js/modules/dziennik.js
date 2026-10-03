/* =========================================================
   BIURO BUDOWY — Dziennik budowy (moduł główny) + powiązanie z dziennikiem montażu
   ---------------------------------------------------------
   WAŻNE: urzędowy dziennik budowy prowadzi się wyłącznie na papierze albo w systemie EDB
   (art. 47c Prawa budowlanego). Ten moduł NIE jest urzędowym dziennikiem. Służy do:
   • przygotowania treści wpisu (ręcznie, z wzoru, z protokołu, z dziennika montażu, z AI),
   • odnotowania, że wpis został dokonany w urzędowym dzienniku (data, strona / nr, zdjęcie),
   • pilnowania zgodności z dziennikiem montażu – sprawdza program, nie AI.
   Wpisy inspektora, projektanta i geodety dokonują te osoby osobiście w urzędowym dzienniku;
   tutaj jest projekt treści (prośba o wpis) i kopia tego, co wpisano.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  M.icon.book = M.icon.doc.replace(/<path.*$/, '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6M9 11h4"/></svg>');
  const ST = { szkic: ['Szkic', 'rej'], gotowy: ['Do wpisania', 'check'], wpisany: ['Wpisany w dzienniku', 'done'], skorygowany: ['Skorygowany', 'rej'], anulowany: ['Anulowany', 'open'] };
  const KINDS = [['roboty', 'Przebieg robót'], ['montaz', 'Montaż – z dziennika montażu'], ['zanikowe', 'Roboty zanikające – zgłoszenie / odbiór'], ['inne', 'Inny wpis']];
  const FUN = M.WZ.FUN;
  const OWN = [FUN[0], FUN[1]];
  /** wzory: własne (zapisane przez użytkownika) + biblioteka */
  const wzory = () => [...M.S.all('templates').filter(t => t.kind === 'dziennik').map(t => ({ c: 'Własne wzory', n: t.name, f: t.func || FUN[0], t: t.text, k: t.dkind || 'roboty', id: t.id })), ...M.WZ.DB];
  // ---------------- uczestnicy procesu budowlanego (rejestr na budowę) ----------------
  const team = () => (M.S.project && M.S.project.team) || [];
  const teamBy = (func, date) => team().filter(t => t.func === func && (!t.to || !date || t.to >= date) && (!t.from || !date || t.from <= date));
  M.TEAM = { all: team, by: teamBy };
  /** podstawia pola znane programowi; reszta nawiasów zostaje do uzupełnienia */
  const fillTokens = (t, date) => { const p = M.S.project || {}; const nr = M.MONTAZ ? M.MONTAZ.cfg().nr : ''; const sub = (x, v) => { t = t.split(x).join(v || x); }; sub('[data]', M.fmt(date)); sub('[budowa]', p.name); sub('[adres]', p.address); sub('[inwestor]', p.investor); sub('[nr dziennika montażu]', nr); return t; };
  const MZ = () => M.MONTAZ;

  // ---------------- dane ----------------
  const dcfg = () => Object.assign({ form: 'papier', volume: '', remindDays: 2 }, (M.S.project && M.S.project.diary) || {});
  const all = () => M.S.all('diary').slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.created || 0) - (b.created || 0) || (a.nr || '').localeCompare(b.nr || ''));
  const live = (d) => d.status !== 'anulowany' && d.status !== 'skorygowany';
  const locked = (d) => d.status !== 'szkic';
  const canEdit = () => M.P.canEdit('dziennik');
  const asm = (id) => M.S.get('assembly', id);
  const who = (id) => { const p = M.S.person(id); return p ? `${p.name} (${(M.P.ROLES[p.role] || {}).label || p.role})` : ''; };
  /** id wpisu dziennika budowy, który obejmuje dany wpis montażu */
  const coverOf = (assemblyId) => all().find(d => live(d) && (d.assemblyIds || []).includes(assemblyId)) || null;
  const uncovered = () => M.S.all('assembly').filter(a => a.status === 'zatwierdzony' && !coverOf(a.id)).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.nr || '').localeCompare(b.nr || ''));
  /** sumy sztuk wg elementu z podanych wpisów montażu (tylko zatwierdzone) */
  const sums = (ids) => { const m = {}; (ids || []).map(asm).filter(a => a && a.status === 'zatwierdzony').forEach(a => (a.items || []).forEach(i => { m[i.elementId] = (m[i.elementId] || 0) + (Number(i.n) || 0); })); return m; };
  const sameSums = (a, b) => { const k = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]); for (const x of k) if ((a[x] || 0) !== (b[x] || 0)) return false; return true; };

  /** treść wpisu zbiorczego składana z wpisów dziennika montażu – program, nie AI */
  const genFromAssembly = (ids) => {
    const Z = MZ(); const c = Z.cfg(); const list = (ids || []).map(asm).filter(a => a && a.status === 'zatwierdzony').sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.nr.localeCompare(b.nr));
    if (!list.length) return '';
    const d1 = list[0].date, d2 = list[list.length - 1].date; const L = [];
    L.push(`Montaż ${Z.KIND[c.kind][1]} ${d1 === d2 ? 'w dniu ' + M.fmt(d1) : 'w okresie ' + M.fmt(d1) + '–' + M.fmt(d2)}, wg dziennika montażu${c.nr ? ' nr ' + c.nr : ''}, ${list.length === 1 ? 'wpis' : 'wpisy'} ${list.map(a => a.nr).join(', ')}.`);
    const g = new Map(); let tot = 0;
    list.forEach(a => (a.items || []).forEach(i => { const gn = Z.itemGroup(i) || 'elementy', en = Z.itemName(i); if (!g.has(gn)) g.set(gn, new Map()); const el = g.get(gn); if (!el.has(en)) el.set(en, { n: 0, axes: [] }); const o = el.get(en); o.n += Number(i.n) || 0; tot += Number(i.n) || 0; if (i.axes && !o.axes.includes(i.axes.trim())) o.axes.push(i.axes.trim()); }));
    if (tot) { L.push(`Zamontowano ${tot} szt.:`); g.forEach((el, gn) => { const gs = [...el.values()].reduce((s, o) => s + o.n, 0); L.push(`– ${gn}: ${gs} szt. – ` + [...el].map(([en, o]) => `${en}: ${o.n} szt. (osie ${o.axes.join('; ') || '—'})`).join('; ') + '.'); }); }
    else L.push('W tym okresie nie montowano elementów.');
    // stan zaawansowania = stan po ostatnim wpisie montażu dotyczącym danej grupy
    const state = new Map(); list.forEach(a => Z.stateAfter(a).forEach(s => state.set(s.group, s)));
    const fin = [...state.values()].filter(s => s.qty && s.done >= s.qty);
    if (fin.length) L.push('Zakończono montaż: ' + fin.map(s => `${s.group} (${s.done}/${s.qty} szt.)`).join('; ') + '.');
    if (state.size) L.push('Stan zaawansowania: ' + [...state.values()].map(s => `${s.group} ${s.done}/${s.qty} szt`).join('; ') + '.');
    const geoOk = list.filter(a => a.geo === 'wykonano'), geoTodo = list.filter(a => a.geo === 'do wykonania' || (!a.geo && Z.itemsCount(a)));
    if (geoOk.length || geoTodo.length) L.push('Pomiary geodezyjne: ' + [geoOk.length ? 'wykonano – ' + geoOk.map(a => `${a.geoRef || 'bez numeru szkicu'} (${a.nr})`).join(', ') : '', geoTodo.length ? 'do wykonania – ' + geoTodo.map(a => a.nr).join(', ') : ''].filter(Boolean).join('; ') + '.');
    const bad = list.filter(a => a.dev === 'przekroczone'), nom = list.filter(a => a.dev === 'nie mierzono');
    if (bad.length) L.push('Odchyłki montażowe przekroczone: ' + bad.map(a => `${a.nr}${a.devNote ? ' – ' + a.devNote : ''}`).join('; ') + '.');
    else if (list.some(a => a.dev === 'w tolerancji')) L.push(`Odchyłki montażowe: w tolerancji${nom.length ? ' (nie mierzono: ' + nom.map(a => a.nr).join(', ') + ')' : ''}.`);
    const dmg = list.filter(a => a.damage); if (dmg.length) L.push('Uszkodzenia / naprawy: ' + dmg.map(a => `${a.nr} – ${a.damage}`).join('; ') + '.');
    const rem = list.filter(a => a.remarks || a.weatherNote); if (rem.length) L.push('Uwagi z montażu: ' + rem.map(a => `${a.nr} – ${[a.weatherNote, a.remarks].filter(Boolean).join('; ')}`).join(' | '));
    return L.join('\n');
  };
  const fullText = (d) => {
    if (locked(d) && d.textFinal != null) return d.textFinal;
    return [d.kind === 'montaz' ? genFromAssembly(d.assemblyIds) : '', (d.text || '').trim()].filter(Boolean).join('\n');
  };

  // ---------------- kontrola zgodności (program) ----------------
  const check = () => {
    const out = [];
    if (MZ()) {
      const un = uncovered(); if (un.length) out.push({ lvl: 'yel', code: 'nieujete', t: `${un.length} ${M.plural(un.length, 'zatwierdzony wpis', 'zatwierdzone wpisy', 'zatwierdzonych wpisów')} dziennika montażu ${M.plural(un.length, 'nie jest ujęty', 'nie są ujęte', 'nie jest ujętych')} w dzienniku budowy`, d: un.map(a => `${a.nr} (${M.fmt(a.date)})`).join(', '), ids: un.map(a => a.id) });
      all().filter(d => live(d) && d.kind === 'montaz').forEach(d => {
        const dead = (d.assemblyIds || []).map(asm).filter(a => !a || a.status !== 'zatwierdzony');
        if (dead.length) out.push({ lvl: 'red', code: 'zmiana', id: d.id, t: `${d.nr}: wpis powołuje się na ${dead.map(a => a ? `${a.nr} (${a.status})` : 'usunięty wpis').join(', ')} dziennika montażu`, d: locked(d) ? 'Wpis montażu został skorygowany lub anulowany po przygotowaniu wpisu. Utwórz korektę wpisu w dzienniku budowy.' : 'Odśwież powiązania w szkicu.' });
        else if (locked(d) && d.cover && !sameSums(d.cover, sums(d.assemblyIds))) out.push({ lvl: 'red', code: 'sumy', id: d.id, t: `${d.nr}: liczby sztuk różnią się od dziennika montażu`, d: 'Utwórz korektę wpisu.' });
        const lastA = (d.assemblyIds || []).map(asm).filter(Boolean).map(a => a.date).sort().pop();
        if (lastA && d.date < lastA) out.push({ lvl: 'red', code: 'data', id: d.id, t: `${d.nr}: data wpisu (${M.fmt(d.date)}) jest wcześniejsza niż opisany montaż (${M.fmt(lastA)})`, d: 'Popraw datę wpisu.' });
      });
      const seen = new Map(); all().filter(live).forEach(d => (d.assemblyIds || []).forEach(id => { const o = seen.get(id); if (o) { if (d.correctionOf === o.id || o.correctionOf === d.id) return; const a = asm(id); out.push({ lvl: 'red', code: 'dubel', id: d.id, t: `${a ? a.nr : 'Wpis montażu'} jest ujęty dwa razy: ${o.nr} i ${d.nr}`, d: 'Anuluj albo skoryguj jeden z wpisów.' }); } else seen.set(id, d); }));
    }
    const rd = Number(dcfg().remindDays) || 0;
    all().filter(d => d.status === 'gotowy').forEach(d => { const age = M.diffDays(d.readyDate || d.date, M.todayISO()); if (age >= rd) out.push({ lvl: age > rd + 3 ? 'red' : 'yel', code: 'wpisz', id: d.id, t: `${d.nr}: treść gotowa, brak potwierdzenia wpisu w urzędowym dzienniku`, d: `${OWN.includes(d.func) ? 'Wpisz i odnotuj' : 'Czeka na wpis: ' + d.func} · od ${age} ${M.plural(age, 'dnia', 'dni', 'dni')}` }); });
    return out;
  };

  const askText = (title, label, okLabel = 'Zapisz') => new Promise(res => {
    const m = M.UI.modal({ title, body: `<label class="f req"><span>${e(label)}</span><textarea id="t" rows="4"></textarea></label>`, footer: `<button class="btn ghost" data-n>Anuluj</button><button class="btn primary" data-y>${e(okLabel)}</button>`, onClose: () => res(null) });
    m.querySelector('[data-n]').onclick = () => m.close();
    m.querySelector('[data-y]').onclick = () => { const t = m.querySelector('#t').value.trim(); if (!t) return M.toast('Uzasadnienie jest wymagane', 'warn'); res(t); m.parentElement.remove(); };
    m.querySelector('#t').focus();
  });

  // ---------------- AI ----------------
  M.AI.DEFAULTS.dziennik = { name: 'Dziennik budowy – redakcja wpisu', text: `Jesteś kierownikiem budowy (generalny wykonawca, hala magazynowa/przemysłowa). Zredaguj z notatek zwięzły wpis do dziennika budowy.
{{RULES}}
- Wpis rejestruje przebieg robót oraz zdarzenia i okoliczności mające znaczenie dla oceny technicznej prawidłowości ich wykonania. Same fakty: co, gdzie (osie, strefa, poziom), kiedy, na jakiej podstawie. Bez ocen i przymiotników.
- NIE zmieniaj żadnych liczb, dat, osi ani numerów rysunków podanych w danych. Fragmentu „Dane z dziennika montażu” nie przepisuj – zostanie dołączony przez program.

Budowa: {{PROJEKT}}
Data wpisu: {{DATA}}
Wpisujący: {{FUNKCJA}}
Temat: {{TEMAT}}
Dane z dziennika montażu (tylko do wiadomości):
"""
{{MONTAZ}}
"""
Notatki:
"""
{{NOTATKI}}
"""
Zwróć WYŁĄCZNIE gotową treść wpisu (bez wstępu, bez nagłówka).` };

  // =========================================================
  //  MODUŁ
  // =========================================================
  M.modules.dziennik = {
    title: 'Dziennik budowy', icon: 'book', order: 5.4,
    desc: 'Wpisy do urzędowego dziennika: wzory, wpisy inspektora, zbiorcze wpisy z dziennika montażu i kontrola zgodności obu dzienników.',
    today() { return canEdit() ? check().map(c => ({ lvl: c.lvl, icon: 'book', t: c.t, d: c.d, go: c.id ? 'dziennik/wpis/' + c.id : 'dziennik/zgodnosc' })) : []; },
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      if (rest[0] === 'wpis' && rest[1]) { const d = M.S.get('diary', rest[1]); if (d) return this.detail(v, d); }
      const tab = ['wpisy', 'zgodnosc', 'uczestnicy', 'ustawienia'].includes(rest[0]) ? rest[0] : 'wpisy';
      const list = all(); const ch = check(); const red = ch.filter(c => c.lvl === 'red').length; const p = M.S.project; const c = dcfg();
      v.innerHTML = M.UI.head('Dziennik <span class="acc">budowy</span>', `Urzędowy dziennik: ${c.form === 'edb' ? 'system EDB' : 'papierowy'}${p.edb ? ' · nr ' + e(p.edb) : ''}${c.volume ? ' · tom ' + e(c.volume) : ''}`,
        `${canEdit() ? `<button class="btn primary" id="new">${M.icon.plus}Nowy wpis</button>${MZ() ? `<button class="btn soft" id="fromM">${M.icon.cube}Wpis z dziennika montażu</button>` : ''}` : ''}<button class="btn" id="pdf">${M.icon.print}Rejestr PDF</button>`) + M.UI.readonlyBanner('dziennik') +
        `<div class="kpis"><div class="kpi"><b>${list.filter(live).length}</b><span>wpisów</span></div><div class="kpi"><b class="${list.some(d => d.status === 'gotowy') ? 'or' : ''}">${list.filter(d => d.status === 'gotowy').length}</b><span>do wpisania w urzędowym dzienniku</span></div><div class="kpi"><b>${list.filter(d => d.status === 'wpisany').length}</b><span>wpisanych i odnotowanych</span></div><div class="kpi"><b class="${ch.length ? 'or' : ''}">${ch.length ? ch.length : '100%'}</b><span>${ch.length ? `${M.plural(ch.length, 'sprawa', 'sprawy', 'spraw')} do wyjaśnienia${red ? ' · ' + red + ' pilne' : ''}` : 'zgodność z dziennikiem montażu'}</span></div></div>
        <div class="tabs">${[['wpisy', `Wpisy (${list.length})`], ['zgodnosc', `Zgodność (${ch.length})`], ['uczestnicy', `Uczestnicy (${team().length})`], ['ustawienia', 'Ustawienia i wzory']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="box"></div>`;
      v.querySelectorAll('.tabs button').forEach(b => b.onclick = () => M.go('dziennik/' + b.dataset.t));
      const nb = v.querySelector('#new'); if (nb) nb.onclick = () => this.newDialog();
      const fm = v.querySelector('#fromM'); if (fm) fm.onclick = () => this.fromAssembly();
      v.querySelector('#pdf').onclick = async () => M.UI.docPreview('Dziennik budowy – rejestr wpisów', await this.htmlBook());
      this['tab_' + tab](v.querySelector('#box'));
    },
    tab_wpisy(box) {
      const desc = M.S.settings.dzOrder === 'desc'; const chrono = all(); const lp = new Map(chrono.map((d, i) => [d.id, i + 1])); const list = desc ? chrono.slice().reverse() : chrono;
      box.innerHTML = `<div class="banner info" style="margin-bottom:12px">${M.icon.shield}<span>To rejestr roboczy. Wpis jest ważny dopiero w <b>urzędowym dzienniku budowy</b> (papier albo EDB) – dokonuje go osobiście uprawniona osoba. Tutaj przygotowujesz treść i odnotowujesz, że wpis tam jest.</span></div>
        <div class="card"><div class="toolbar"><span class="small muted grow">Wpisy układają się same według daty wpisu – także dodane wstecz.</span><div class="seg" id="ord"><button data-o="asc" class="${desc ? '' : 'on'}">od najstarszych</button><button data-o="desc" class="${desc ? 'on' : ''}">od najnowszych</button></div></div>${list.length ? `<div class="table-wrap"><table class="list"><thead><tr><th>Lp.</th><th>Data</th><th>Wpis</th><th class="hide-m">Wpisujący</th><th class="hide-m">Dziennik montażu</th><th class="hide-m">Urzędowy dziennik</th><th>Status</th></tr></thead><tbody>${list.map(d => `<tr class="click" data-id="${d.id}"><td class="num">${lp.get(d.id)}<div class="xs muted">${e(d.nr)}</div></td><td class="nowrap">${M.fmt(d.date)}<div class="xs muted hide-m">${e(M.weekday(d.date))}</div></td><td><b>${e(d.subject || (KINDS.find(k => k[0] === d.kind) || [])[1] || '')}</b><div class="xs muted">${e(fullText(d).replace(/\s+/g, ' ').slice(0, 130))}</div></td><td class="hide-m small">${e(d.func || '')}${d.person ? '<div class="xs muted">' + e(d.person) + '</div>' : ''}</td><td class="hide-m small">${e((d.assemblyIds || []).map(asm).filter(Boolean).map(a => a.nr).join(', '))}</td><td class="hide-m small">${d.offDate ? M.fmt(d.offDate) + (d.offRef ? ' · ' + e(d.offRef) : '') : '—'}</td><td>${M.UI.st(ST, d.status)}</td></tr>`).join('')}</tbody></table></div>` : M.UI.empty('Brak wpisów. Zacznij od „Nowy wpis” albo „Wpis z dziennika montażu”.', 'book')}</div>`;
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => M.go('dziennik/wpis/' + tr.dataset.id));
      box.querySelectorAll('#ord button').forEach(b => b.onclick = () => { M.S.set('dzOrder', b.dataset.o); M.refresh(); });
    },
    tab_zgodnosc(box) {
      const ch = check(); const Z = MZ();
      const pairs = all().filter(d => live(d) && d.kind === 'montaz');
      box.innerHTML = `${ch.length ? `<div class="card" style="margin-bottom:12px"><div class="card-head"><h2>Do wyjaśnienia</h2><span class="badge or">${ch.length}</span></div><div class="today"><ul>${ch.map((c, i) => `<li data-i="${i}"><span class="ico ${c.lvl === 'red' ? 'red' : 'yel'}">${M.icon.alert}</span><div class="grow"><div class="t">${e(c.t)}</div><div class="d">${e(c.d || '')}</div></div>${c.code === 'nieujete' && canEdit() ? `<button class="btn sm primary" data-mk>Przygotuj wpis</button>` : c.id ? `<button class="btn sm" data-open>Otwórz</button>` : ''}</li>`).join('')}</ul></div></div>` : `<div class="banner ok" style="margin-bottom:12px">${M.icon.check}<span><b>Dzienniki są zgodne.</b> Każdy zatwierdzony wpis dziennika montażu jest ujęty w dzienniku budowy, liczby sztuk się zgadzają i nic nie czeka na wpisanie.</span></div>`}
        <div class="card"><div class="card-head"><h2>Powiązanie dzienników</h2></div>${pairs.length ? `<div class="table-wrap"><table class="list"><thead><tr><th>Dziennik budowy</th><th>Data</th><th>Dziennik montażu</th><th style="text-align:right">Szt.</th><th>Kontrola</th></tr></thead><tbody>${pairs.map(d => { const now = sums(d.assemblyIds); const n = Object.values(now).reduce((s, x) => s + x, 0); const bad = ch.some(c => c.id === d.id && c.lvl === 'red' && c.code !== 'wpisz'); return `<tr class="click" data-id="${d.id}"><td class="num">${e(d.nr)}</td><td>${M.fmt(d.date)}</td><td class="small">${e((d.assemblyIds || []).map(asm).filter(Boolean).map(a => a.nr).join(', '))}</td><td style="text-align:right">${n}</td><td>${bad ? '<span class="st open">niezgodne</span>' : '<span class="st done">zgodne</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : M.UI.empty(Z ? 'Brak wpisów zbiorczych z dziennika montażu.' : 'Moduł dziennika montażu jest wyłączony.', 'link')}</div>
        <div class="small muted" style="margin-top:8px">Sprawdza program: czy każdy zatwierdzony wpis montażu jest ujęty dokładnie raz, czy liczby sztuk wg elementów są takie same, czy data wpisu nie wyprzedza montażu oraz czy wpis powołuje się na aktualne (nieskorygowane) wpisy montażu.</div>`;
      box.querySelectorAll('[data-mk]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); this.fromAssembly(); });
      box.querySelectorAll('.today li').forEach(li => li.onclick = () => { const c = ch[+li.dataset.i]; if (c.id) M.go('dziennik/wpis/' + c.id); });
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => M.go('dziennik/wpis/' + tr.dataset.id));
    },
    tab_uczestnicy(box) {
      const edit = canEdit(); const p = M.S.project; p.team = p.team || [];
      box.innerHTML = `<div class="banner info" style="margin-bottom:12px">${M.icon.users}<span>Wpisz raz osoby pełniące funkcje na tej budowie. Przy nowym wpisie wybierasz funkcję, a imię, nazwisko i numer uprawnień podstawiają się same – także w dzienniku montażu.</span></div>
        <div class="card"><div class="card-head"><h2>Uczestnicy procesu budowlanego</h2>${edit ? `<button class="btn sm primary" id="add">${M.icon.plus}Osoba</button>` : ''}</div>
        ${p.team.length ? `<div class="table-wrap"><table class="list"><thead><tr><th style="min-width:210px">Funkcja</th><th style="min-width:170px">Imię i nazwisko</th><th style="min-width:150px">Nr uprawnień</th><th class="hide-m" style="min-width:140px">Zakres / branża</th><th class="hide-m" style="min-width:150px">Firma</th><th class="hide-m" style="min-width:170px">E-mail</th><th class="hide-m">Od</th><th class="hide-m">Do</th><th></th></tr></thead><tbody>${p.team.map((t, i) => `<tr data-i="${i}"><td><select data-k="func">${M.UI.opts(FUN, t.func)}</select></td><td><input type="text" data-k="name" value="${e(t.name || '')}"></td><td><input type="text" data-k="lic" value="${e(t.lic || '')}" placeholder="np. LUB/0000/PWBKb/00"></td><td class="hide-m"><input type="text" data-k="scope" value="${e(t.scope || '')}" placeholder="konstrukcyjna, sanitarna…"></td><td class="hide-m"><input type="text" data-k="company" value="${e(t.company || '')}"></td><td class="hide-m"><input type="email" data-k="email" value="${e(t.email || '')}"></td><td class="hide-m"><input type="date" data-k="from" value="${e(t.from || '')}"></td><td class="hide-m"><input type="date" data-k="to" value="${e(t.to || '')}"></td><td>${edit ? `<button class="btn icon ghost sm" data-del title="Usuń">${M.icon.trash}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : M.UI.empty('Brak osób. Dodaj kierownika budowy, inspektorów nadzoru, projektanta i geodetę.', 'users')}</div>
        <div class="small muted" style="margin-top:8px">Pola „Od” i „Do” przydają się przy zmianie kierownika lub inspektora: we wpisie z daną datą podpowiada się osoba, która wtedy pełniła funkcję.</div>`;
      if (!edit) return M.UI.lockForm(box, true);
      const save = M.debounce(() => M.S.upsert('projects', p), 400);
      box.querySelectorAll('tr[data-i]').forEach(tr => { const t = p.team[+tr.dataset.i]; tr.querySelectorAll('[data-k]').forEach(el => el.addEventListener('input', () => { t[el.dataset.k] = el.value; save(); })); const x = tr.querySelector('[data-del]'); if (x) x.onclick = async () => { if (await M.UI.confirm(`Usunąć osobę „${e(t.name || t.func)}” z listy uczestników?`, 'Usuń', true)) { p.team.splice(+tr.dataset.i, 1); M.S.upsert('projects', p); M.refresh(); } }; });
      box.querySelector('#add').onclick = () => { p.team.push({ id: M.uid(), func: p.team.some(t => t.func === FUN[0]) ? FUN[2] : FUN[0], name: '', lic: '', scope: '', company: '', email: '', from: '', to: '' }); M.S.upsert('projects', p); M.refresh(); };
    },
    tab_ustawienia(box) {
      const c = dcfg(); const p = M.S.project; const edit = canEdit(); const W = wzory(); const cats = [...new Set(W.map(w => w.c))];
      box.innerHTML = `<div class="grid2" style="align-items:start"><div class="card card-pad col" id="sf"><h2>Urzędowy dziennik budowy</h2>
          <div class="seg" id="form"><button data-m="papier" class="${c.form === 'papier' ? 'on' : ''}" ${edit ? '' : 'disabled'}>Papierowy</button><button data-m="edb" class="${c.form === 'edb' ? 'on' : ''}" ${edit ? '' : 'disabled'}>System EDB</button></div>
          <div class="grid2"><label class="f">Numer dziennika budowy<input type="text" id="edb" value="${e(p.edb || '')}"></label><label class="f">Tom (papierowy)<input type="text" data-f="volume" value="${e(c.volume)}"></label></div>
          <label class="f">Przypomnij o niewpisanym wpisie po [dni]<input type="number" min="0" data-f="remindDays" value="${e(c.remindDays)}"></label>
          <div class="banner info">${M.icon.shield}<span class="small">Podstawa: art. 47a–47v Prawa budowlanego i rozporządzenie w sprawie dziennika budowy oraz systemu EDB (Dz.U. 2023 poz. 45). Za prowadzenie dziennika odpowiada kierownik budowy. Wpisu nie usuwa się – błąd prostuje się kolejnym wpisem z uzasadnieniem. Stan na 2.10.2026 – sprawdzaj aktualne brzmienie.</span></div>
          <div class="banner warn">${M.icon.alert}<span class="small">Wzory wpisów są propozycją autora aplikacji, nie wzorem urzędowym. Za treść wpisu odpowiada osoba, która go dokonuje.</span></div></div>
        <div class="card"><div class="card-head"><h2>Wzory wpisów</h2><span class="badge">${W.length}</span></div><div class="table-wrap" style="max-height:70vh"><table class="list"><tbody>${cats.map(cat => `<tr class="dm-g"><td colspan="2"><b>${e(cat)}</b></td></tr>` + W.filter(w => w.c === cat).map(w => `<tr><td><b>${e(w.n)}</b><div class="xs muted">${e(w.f)}</div><div class="small" style="margin-top:3px">${e(w.t)}</div></td><td style="width:1%">${w.id && edit ? `<button class="btn icon ghost sm" data-delw="${w.id}" title="Usuń własny wzór">${M.icon.trash}</button>` : ''}</td></tr>`).join('')).join('')}</tbody></table></div></div></div>`;
      if (!edit) return M.UI.lockForm(box, true);
      const save = M.debounce(() => { const pr = M.S.project; pr.diary = Object.assign(dcfg(), M.UI.read(box.querySelector('#sf'))); pr.edb = box.querySelector('#edb').value; M.S.upsert('projects', pr); }, 400);
      box.querySelectorAll('#sf input').forEach(el => el.addEventListener('input', save));
      box.querySelectorAll('#form button').forEach(b => b.onclick = () => { const pr = M.S.project; pr.diary = Object.assign(dcfg(), { form: b.dataset.m }); M.S.upsert('projects', pr); M.refresh(); });
      box.querySelectorAll('[data-delw]').forEach(b => b.onclick = async () => { if (await M.UI.confirm('Usunąć własny wzór?', 'Usuń', true)) { M.S.remove('templates', b.dataset.delw); M.refresh(); } });
    },

    // ---------------- tworzenie ----------------
    /** osoba pełniąca funkcję w dniu wpisu – z rejestru uczestników */
    personFor(func, date) { const t = teamBy(func, date)[0] || teamBy(func)[0]; return t ? { person: t.name || '', lic: t.lic || '' } : null; },
    create(o) {
      const me = M.S.me(); const date = o.date || M.todayISO(); const func = o.func || FUN[0];
      const who2 = o.person != null ? {} : (this.personFor(func, date) || { person: func === FUN[0] && me ? me.name : '', lic: '' });
      const d = M.S.upsert('diary', Object.assign({ nr: M.S.nextNr('diary', 'DB'), date, status: 'szkic', kind: 'roboty', subject: '', func, lic: '', text: '', assemblyIds: [], protocolId: '', offDate: '', offRef: '', photos: [] }, who2, o, { text: fillTokens(o.text || '', date) }));
      M.go('dziennik/wpis/' + d.id); return d;
    },
    newDialog() {
      const prot = M.S.all('protocols').filter(p => !all().some(d => live(d) && d.protocolId === p.id)); const W = wzory(); const cats = [...new Set(W.map(w => w.c))]; let cat = '';
      const m = M.UI.modal({ title: 'Nowy wpis', wide: true, body: `<div class="col">
          <div class="row" style="align-items:flex-end"><label class="f" style="width:190px">Data wpisu<input type="date" id="nd" value="${M.todayISO()}"></label><div class="search grow">${M.icon.search}<input type="search" id="q" placeholder="Szukaj wzoru: zbrojenie, przerwa, odbiór…"></div><button class="btn primary" data-empty>${M.icon.plus}Pusty wpis</button></div>
          <div class="small muted">Data podstawi się we wzorze. Wpis z datą wsteczną sam ustawi się we właściwym miejscu listy.</div>
          <div class="chips" id="cats"></div>
          <div class="table-wrap" style="max-height:46vh"><table class="list"><tbody id="wl"></tbody></table></div>
          <div class="row">${MZ() && M.enabled('montaz') ? `<button class="btn soft" data-m>${M.icon.cube}Zbiorczy wpis z dziennika montażu (${uncovered().length} do ujęcia)</button>` : ''}${prot.length ? `<button class="btn" data-prot>${M.icon.layers}Z protokołu robót zanikowych (${prot.length})</button>` : ''}</div></div>` });
      const date = () => m.querySelector('#nd').value || M.todayISO();
      const draw = () => {
        const q = M.norm(m.querySelector('#q').value);
        m.querySelector('#cats').innerHTML = [['', 'Wszystkie'], ...cats.map(c => [c, c])].map(([k, l]) => `<button class="chip ${cat === k ? 'on' : ''}" data-c="${e(k)}">${e(l)}</button>`).join('');
        m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
        const rows = W.map((w, i) => [w, i]).filter(([w]) => (!cat || w.c === cat) && (!q || M.norm(w.n + ' ' + w.t + ' ' + w.c).includes(q)));
        let last = '';
        m.querySelector('#wl').innerHTML = rows.map(([w, i]) => `${w.c !== last ? ((last = w.c), `<tr class="dm-g"><td><b>${e(w.c)}</b></td></tr>`) : ''}<tr class="click" data-w="${i}"><td><b>${e(w.n)}</b> <span class="xs muted">· ${e(w.f)}</span><div class="xs muted">${e(w.t.slice(0, 150))}${w.t.length > 150 ? '…' : ''}</div></td></tr>`).join('') || `<tr><td>${M.UI.empty('Brak wzoru o takiej nazwie. Użyj pustego wpisu.', 'search')}</td></tr>`;
        m.querySelectorAll('[data-w]').forEach(tr => tr.onclick = () => { const w = W[+tr.dataset.w]; const dt = date(); m.close(); this.create({ date: dt, kind: w.k, subject: w.n, func: w.f, text: w.t }); });
      };
      m.querySelector('#q').oninput = draw; draw();
      m.querySelector('[data-empty]').onclick = () => { const dt = date(); m.close(); this.create({ date: dt }); };
      const bm = m.querySelector('[data-m]'); if (bm) bm.onclick = () => { m.close(); this.fromAssembly(); };
      const bp = m.querySelector('[data-prot]'); if (bp) bp.onclick = () => { const m2 = M.UI.modal({ title: 'Wpis z protokołu robót zanikowych', body: `<div class="col">${prot.map(p => `<button class="btn" data-p="${p.id}" style="justify-content:flex-start;white-space:normal;text-align:left">${M.icon.layers}<span>${e(p.nr)} · ${e(p.title || '')}<span class="xs muted" style="display:block;font-weight:500">${M.fmt(p.date)} · ${e(p.result || p.status || '')}</span></span></button>`).join('')}</div>` });
        m2.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const p = M.S.get('protocols', b.dataset.p); m2.close(); m.close(); const done = !!p.result;
          this.create({ kind: 'zanikowe', protocolId: p.id, date: p.date || date(), subject: `${done ? 'Odbiór' : 'Zgłoszenie do odbioru'} – ${p.title || 'roboty zanikające'}`, func: done ? FUN[2] : FUN[0],
            text: done ? `Sprawdzono roboty zanikające / ulegające zakryciu: ${p.title || '[rodzaj robót]'}${p.scope ? ' – ' + p.scope : ''}, lokalizacja: ${p.location || '[osie / strefa]'}. Wynik: ${p.result}.${p.remarks ? ' Uwagi: ' + p.remarks : ''} Protokół nr ${p.nr} z dnia ${M.fmt(p.date)}.` : `Zgłaszam do sprawdzenia i odbioru roboty zanikające / ulegające zakryciu: ${p.title || '[rodzaj robót]'}${p.scope ? ' – ' + p.scope : ''}, lokalizacja: ${p.location || '[osie / strefa]'}. Proponowany termin odbioru: ${M.fmt(p.date)}. Protokół nr ${p.nr}.` }); }); };
    },
    /** wybór wpisów montażu do ujęcia w jednym wpisie dziennika budowy */
    fromAssembly(preset) {
      const un = uncovered(); if (!un.length) return M.toast('Wszystkie zatwierdzone wpisy montażu są już ujęte w dzienniku budowy');
      const Z = MZ(); const sel = new Set(preset || un.map(a => a.id));
      const m = M.UI.modal({ title: 'Wpis zbiorczy z dziennika montażu', wide: true, body: `<div class="grid2" style="align-items:start"><div class="col"><div class="small muted">Zaznacz wpisy montażu, które ma objąć jeden wpis w dzienniku budowy. Pokazane są tylko zatwierdzone i jeszcze nieujęte.</div><div class="table-wrap" style="max-height:46vh"><table class="list"><tbody>${un.map(a => `<tr><td style="width:1%"><input type="checkbox" data-id="${a.id}" ${sel.has(a.id) ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--or-500)"></td><td><b>${e(a.nr)}</b> · ${M.fmt(a.date)}<div class="xs muted">${e((a.items || []).map(i => `${Z.itemName(i)} ${i.n} szt.`).join(', ') || 'bez montażu')}</div></td></tr>`).join('')}</tbody></table></div></div><div class="col"><b class="small">Podgląd treści (składa program)</b><div class="dm-text" id="pv" style="max-height:46vh;overflow:auto"></div></div></div>`, footer: `<label class="f" style="flex-direction:row;align-items:center;gap:8px">Temat<input type="text" id="subj" style="width:300px"></label><span class="grow"></span><button class="btn primary" id="ok">Utwórz wpis</button>` });
      const ids = () => un.filter(a => sel.has(a.id)).map(a => a.id);
      const subj = () => { const t = genFromAssembly(ids()); const f = (t.match(/^Zakończono montaż: (.*)\.$/m) || [])[1]; return f ? 'Zakończenie montażu – ' + f.replace(/ \(\d+\/\d+ szt\.\)/g, '') : 'Montaż konstrukcji – postęp'; };
      const draw = () => { m.querySelector('#pv').textContent = genFromAssembly(ids()) || 'Zaznacz co najmniej jeden wpis.'; m.querySelector('#subj').value = subj(); m.querySelector('#ok').disabled = !ids().length; };
      m.querySelectorAll('[data-id]').forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.id) : sel.delete(c.dataset.id); draw(); }); draw();
      m.querySelector('#ok').onclick = () => { const l = ids(); const last = l.map(asm).map(a => a.date).sort().pop(); const s = m.querySelector('#subj').value; m.close(); this.create({ kind: 'montaz', assemblyIds: l, subject: s, date: last > M.todayISO() ? last : M.todayISO() }); };
    },

    // ---------------- wpis ----------------
    detail(v, d) {
      const ed = !locked(d) && canEdit(); const staff = canEdit(); d.photos = d.photos || []; d.assemblyIds = d.assemblyIds || [];
      const own = OWN.includes(d.func); const c = dcfg(); const Z = MZ();
      const orig = d.correctionOf ? M.S.get('diary', d.correctionOf) : null; const corr = d.correctedBy ? M.S.get('diary', d.correctedBy) : null;
      const prob = check().filter(x => x.id === d.id && x.code !== 'wpisz');
      const prot = d.protocolId ? M.S.get('protocols', d.protocolId) : null;
      v.innerHTML = `<div class="page-head"><div><h1>Wpis <span class="acc">${e(d.nr)}</span> ${M.UI.st(ST, d.status)}</h1><div class="sub">Dziennik budowy · ${e(M.fmt(d.date))} ${e(M.weekday(d.date))} · ${e(d.func || '')}${d.person ? ' – ' + e(d.person) : ''}</div></div>
        <div class="actions"><button class="btn ghost" id="back">${M.icon.back}Lista</button><button class="btn" id="copy">${M.icon.copy}Kopiuj treść</button><button class="btn" id="pdf">${M.icon.print}Wpis PDF</button>
          ${ed ? `<button class="btn soft" id="ai">${M.icon.spark}AI: zredaguj</button>` : ''}
          ${d.status === 'szkic' && staff ? `<button class="btn primary" id="ready">${M.icon.check}Treść gotowa</button><button class="btn danger icon" id="del" title="Usuń szkic">${M.icon.trash}</button>` : ''}
          ${d.status === 'gotowy' && staff ? `${own ? '' : `<button class="btn" id="mail">${M.icon.mail}Prośba o wpis</button>`}<button class="btn primary" id="done">${M.icon.check}Odnotuj wpis</button><button class="btn" id="undo">Cofnij do szkicu</button>` : ''}
          ${d.status === 'wpisany' && staff ? `<button class="btn" id="corr">${M.icon.edit}Korekta</button><button class="btn danger" id="cancel">${M.icon.x}Anuluj</button>` : ''}</div></div>
        ${prob.map(x => `<div class="banner or" style="margin-bottom:12px">${M.icon.alert}<span><b>Niezgodność z dziennikiem montażu.</b> ${e(x.t)}. ${e(x.d)}</span></div>`).join('')}
        ${orig ? `<div class="banner warn" style="margin-bottom:12px">${M.icon.edit}<span>Korekta wpisu <a href="#/dziennik/wpis/${orig.id}"><b>${e(orig.nr)}</b></a>. Uzasadnienie: ${e(d.reason || '')}</span></div>` : ''}
        ${corr ? `<div class="banner info" style="margin-bottom:12px">${M.icon.edit}<span>Wpis skorygowany wpisem <a href="#/dziennik/wpis/${corr.id}"><b>${e(corr.nr)}</b></a>.</span></div>` : ''}
        ${d.status === 'anulowany' ? `<div class="banner or" style="margin-bottom:12px">${M.icon.x}<span>Wpis anulowany ${e(M.fmtTs(d.cancelledAt))}. Uzasadnienie: ${e(d.cancelReason || '')}</span></div>` : ''}
        ${d.status === 'gotowy' ? `<div class="banner warn" style="margin-bottom:12px">${M.icon.clock}<span>${own ? `Treść gotowa. <b>Wpisz ją do urzędowego dziennika</b> (${c.form === 'edb' ? 'EDB – po zalogowaniu' : 'papier – z podpisem'}), a potem kliknij „Odnotuj wpis”.` : `Treść jest <b>propozycją</b> dla osoby: ${e(d.func)}. Wpisu dokonuje ona osobiście. Wyślij prośbę, a po wpisie odnotuj datę i ${c.form === 'edb' ? 'numer wpisu' : 'stronę'}.`}</span></div>` : ''}
        <div class="grid2" style="align-items:start" id="frm">
          <div class="col">
            <div class="card card-pad col">
              <div class="grid3"><label class="f">Data wpisu<input type="date" data-f="date" value="${e(d.date)}"></label><label class="f">Rodzaj<select data-f="kind" ${d.kind === 'montaz' ? 'disabled data-keep="1"' : ''}>${M.UI.opts(d.kind === 'montaz' ? KINDS : KINDS.filter(k => k[0] !== 'montaz'), d.kind)}</select></label><label class="f">Wpisujący (funkcja)<select data-f="func">${M.UI.opts(FUN, d.func)}</select></label></div>
              <div class="grid2"><label class="f">Temat (do listy)<input type="text" data-f="subject" value="${e(d.subject || '')}"></label><label class="f">Osoba z listy uczestników<select id="pick" data-keep="1" ${ed ? '' : 'disabled'}>${M.UI.opts(teamBy(d.func).map(t => [t.id, `${t.name}${t.scope ? ' – ' + t.scope : ''}`]), (teamBy(d.func).find(t => t.name === d.person) || {}).id, teamBy(d.func).length ? '— inna osoba —' : '— brak osób z tą funkcją —')}</select></label></div>
              <div class="grid2"><label class="f">Imię i nazwisko wpisującego<input type="text" data-f="person" value="${e(d.person || '')}"></label><label class="f">Nr uprawnień<input type="text" data-f="lic" value="${e(d.lic || '')}"></label></div>
              ${ed && !team().length ? `<div class="small muted">Dodaj osoby w zakładce <a href="#/dziennik/uczestnicy">Uczestnicy</a> – imię, nazwisko i uprawnienia będą się podstawiać same.</div>` : ''}
            </div>
            <div class="card card-pad col"><div class="row"><h2 class="grow">Treść wpisu</h2>${ed ? `<button class="btn sm" id="wz">${M.icon.doc}Wzór</button><button class="btn sm ghost" id="saveW" title="Zapisz tę treść jako własny wzór">${M.icon.download}Zapisz jako wzór</button><button class="btn sm" id="dict">${M.icon.mic}Dyktuj</button>` : ''}</div>
              ${d.kind === 'montaz' ? `<div class="row"><span class="badge">część składana przez program z dziennika montażu</span>${ed ? `<button class="btn sm ghost" id="relink">${M.icon.link}Zmień powiązane wpisy</button>` : ''}</div><div class="dm-text" id="gen"></div><label class="f">Uzupełnienie kierownika budowy (opcjonalnie)<textarea data-f="text" id="txt" rows="4">${e(d.text || '')}</textarea></label>` : `<textarea data-f="text" id="txt" rows="9">${e(locked(d) && d.textFinal != null ? d.textFinal : d.text || '')}</textarea>`}
              ${/\[[^\]]+\]/.test(fullText(d)) && !locked(d) ? `<div class="banner warn">${M.icon.alert}<span class="small">W treści są pola do uzupełnienia w nawiasach kwadratowych.</span></div>` : ''}
            </div>
          </div>
          <div class="col">
            <div class="card card-pad col"><h2>Urzędowy dziennik budowy</h2>
              <div class="grid2"><label class="f">Data dokonania wpisu<input type="date" data-o="offDate" value="${e(d.offDate || '')}" max="${M.todayISO()}"></label><label class="f">${c.form === 'edb' ? 'Numer wpisu w EDB' : 'Tom / strona'}<input type="text" data-o="offRef" value="${e(d.offRef || '')}" placeholder="${c.form === 'edb' ? 'np. wpis nr 27' : 'np. tom 1, str. 14'}"></label></div>
              <div><b class="small">Zdjęcie strony / zrzut z EDB</b><div id="ph"></div></div>
              ${d.status === 'wpisany' ? `<div class="small muted">Odnotował: ${e(who(d.offBy))} · ${e(M.fmtTs(d.offAt))}</div>` : ''}
            </div>
            <div class="card"><div class="card-head"><h2>Powiązania</h2></div><div class="card-pad col" style="gap:6px">
              ${d.assemblyIds.length ? `<b class="small">Dziennik montażu</b>${d.assemblyIds.map(asm).map(a => a ? `<a class="row" href="#/montaz/wpis/${a.id}" style="text-decoration:none;color:inherit"><span class="badge ${a.status === 'zatwierdzony' ? 'ok' : 'danger'}">${e(a.nr)}</span><span class="small grow">${M.fmt(a.date)} · ${e((a.items || []).map(i => `${Z ? Z.itemName(i) : ''} ${i.n} szt.`).join(', ') || 'bez montażu')}</span><span class="xs muted">${e(a.status)}</span></a>` : '<span class="small muted">usunięty wpis montażu</span>').join('')}` : ''}
              ${prot ? `<b class="small">Protokół robót zanikowych</b><a class="row" href="#/zanikowe/${prot.id}" style="text-decoration:none;color:inherit"><span class="badge info">${e(prot.nr)}</span><span class="small">${e(prot.title || '')}</span></a>` : ''}
              ${!d.assemblyIds.length && !prot ? '<span class="small muted">Brak powiązań z innymi dokumentami.</span>' : ''}</div></div>
          </div>
        </div>`;
      const frm = v.querySelector('#frm');
      const gen = v.querySelector('#gen'); if (gen) gen.textContent = locked(d) && d.textFinal != null ? d.textFinal : genFromAssembly(d.assemblyIds);
      if (locked(d) && d.kind === 'montaz' && d.textFinal != null) { const t = v.querySelector('#txt'); if (t) t.closest('label').remove(); }
      const save = M.debounce(() => { Object.assign(d, M.UI.read(frm)); M.S.upsert('diary', d); }, 350);
      const saveNow = () => { if (ed) Object.assign(d, M.UI.read(frm)); frm.querySelectorAll('[data-o]').forEach(el => { if (!el.disabled) d[el.dataset.o] = el.value; }); M.S.upsert('diary', d); };
      if (ed) frm.querySelectorAll('[data-f]').forEach(el => el.addEventListener('input', save)); else frm.querySelectorAll('[data-f]').forEach(el => el.disabled = true);
      // dane urzędowego dziennika można uzupełniać do chwili odnotowania wpisu
      const offEd = staff && ['szkic', 'gotowy'].includes(d.status);
      frm.querySelectorAll('[data-o]').forEach(el => { el.disabled = !offEd; el.addEventListener('input', M.debounce(() => { d[el.dataset.o] = el.value; M.S.upsert('diary', d); }, 350)); });
      M.UI.photos(v.querySelector('#ph'), d.photos, { editable: staff && live(d), onChange: () => M.S.upsert('diary', d) });
      const on = (id, fn) => { const b = v.querySelector(id); if (b) b.onclick = fn; };
      on('#back', () => M.go('dziennik'));
      on('#copy', () => { saveNow(); M.copy(fullText(d), 'Skopiowano treść wpisu'); });
      on('#pdf', async () => { saveNow(); M.UI.docPreview(`Dziennik budowy – wpis ${d.nr}`, M.PR.header('Dziennik budowy', 'rejestr roboczy – pojedynczy wpis') + CSS() + await this.htmlEntry(d)); });
      const dict = v.querySelector('#dict'); if (dict) M.UI.dictate(dict, v.querySelector('#txt'));
      // wybór osoby z rejestru → imię, nazwisko i uprawnienia
      const pick = v.querySelector('#pick'); if (pick && ed) pick.onchange = () => { const t = team().find(x => x.id === pick.value); if (!t) return; saveNow(); d.person = t.name || ''; d.lic = t.lic || ''; M.S.upsert('diary', d); this.detail(v, d); };
      const fs = v.querySelector('[data-f=func]'); if (fs && ed) fs.addEventListener('change', () => { saveNow(); const w = this.personFor(d.func, d.date); d.person = w ? w.person : ''; d.lic = w ? w.lic : ''; M.S.upsert('diary', d); this.detail(v, d); });
      on('#wz', () => { const W = wzory(); const m = M.UI.modal({ title: 'Wstaw wzór do treści', wide: true, body: `<div class="col"><div class="search">${M.icon.search}<input type="search" id="q" placeholder="Szukaj wzoru…"></div><div class="table-wrap" style="max-height:52vh"><table class="list"><tbody id="wl"></tbody></table></div></div>` });
        const draw = () => { const q = M.norm(m.querySelector('#q').value); let last = ''; m.querySelector('#wl').innerHTML = W.map((w, i) => [w, i]).filter(([w]) => !q || M.norm(w.n + ' ' + w.t + ' ' + w.c).includes(q)).map(([w, i]) => `${w.c !== last ? ((last = w.c), `<tr class="dm-g"><td><b>${e(w.c)}</b></td></tr>`) : ''}<tr class="click" data-w="${i}"><td><b>${e(w.n)}</b><div class="xs muted">${e(w.t.slice(0, 150))}</div></td></tr>`).join('');
          m.querySelectorAll('[data-w]').forEach(tr => tr.onclick = () => { const t = v.querySelector('#txt'); t.value = (t.value ? t.value + '\n' : '') + fillTokens(W[+tr.dataset.w].t, v.querySelector('[data-f=date]').value || d.date); t.dispatchEvent(new Event('input')); m.close(); }); };
        m.querySelector('#q').oninput = draw; draw(); });
      on('#saveW', () => { saveNow(); if (!(d.text || '').trim()) return M.toast('Najpierw wpisz treść', 'warn'); const m = M.UI.modal({ title: 'Zapisz jako własny wzór', body: `<label class="f">Nazwa wzoru<input type="text" id="n" value="${e(d.subject || '')}"></label><div class="small muted" style="margin-top:8px">Wzór będzie dostępny na wszystkich budowach. Datę w treści zamień na [data] – podstawi się sama.</div>`, footer: '<button class="btn primary" id="ok">Zapisz wzór</button>' });
        m.querySelector('#ok').onclick = () => { const n = m.querySelector('#n').value.trim(); if (!n) return M.toast('Podaj nazwę', 'warn'); M.S.upsert('templates', { kind: 'dziennik', name: n, func: d.func, dkind: d.kind === 'montaz' ? 'roboty' : d.kind, text: d.text }); m.close(); M.toast('Zapisano wzór'); }; });
      on('#relink', () => { const keep = d.assemblyIds.slice(); const pool = [...keep.map(asm).filter(a => a && a.status === 'zatwierdzony'), ...uncovered()]; const sel = new Set(keep.filter(id => pool.some(a => a.id === id)));
        const m = M.UI.modal({ title: 'Powiązane wpisy dziennika montażu', body: `<table class="list"><tbody>${pool.map(a => `<tr><td style="width:1%"><input type="checkbox" data-id="${a.id}" ${sel.has(a.id) ? 'checked' : ''} style="width:18px;height:18px"></td><td><b>${e(a.nr)}</b> · ${M.fmt(a.date)}<div class="xs muted">${e((a.items || []).map(i => `${Z.itemName(i)} ${i.n} szt.`).join(', '))}</div></td></tr>`).join('')}</tbody></table>`, footer: '<button class="btn primary" id="ok">Zapisz</button>' });
        m.querySelectorAll('[data-id]').forEach(cb => cb.onchange = () => cb.checked ? sel.add(cb.dataset.id) : sel.delete(cb.dataset.id));
        m.querySelector('#ok').onclick = () => { if (!sel.size) return M.toast('Zaznacz co najmniej jeden wpis', 'warn'); saveNow(); d.assemblyIds = pool.filter(a => sel.has(a.id)).map(a => a.id); M.S.upsert('diary', d); m.close(); this.detail(v, d); }; });
      on('#ai', () => { saveNow(); M.AI.open({ key: 'dziennik', title: 'Asystent AI – wpis do dziennika budowy', prompt: M.AI.fill('dziennik', { PROJEKT: M.S.project.name, DATA: M.fmt(d.date), FUNKCJA: d.func, TEMAT: d.subject, MONTAZ: d.kind === 'montaz' ? genFromAssembly(d.assemblyIds) : '', NOTATKI: d.text }),
        parse: (t) => { const s = String(t || '').trim(); return s.length > 10 ? { txt: s.replace(/^```\w*\n?|```$/g, '').trim() } : null; }, preview: (j) => `<div style="white-space:pre-wrap">${e(j.txt)}</div>${d.kind === 'montaz' ? '<div class="small muted" style="margin-top:8px">Trafi do pola „Uzupełnienie”. Część z dziennika montażu pozostaje bez zmian.</div>' : ''}`, applyLabel: 'Wstaw do wpisu', apply: (j) => { d.text = j.txt; M.S.upsert('diary', d); this.detail(v, d); } }); });
      on('#del', async () => { if (await M.UI.confirm('Usunąć szkic wpisu?', 'Usuń', true)) { M.S.remove('diary', d.id); M.go('dziennik'); } });
      on('#ready', () => {
        saveNow(); const err = []; const t = fullText(d);
        if (!d.date) err.push('Brak daty wpisu.'); if (!t.trim()) err.push('Wpis nie ma treści.');
        if (/\[[^\]]+\]/.test(t)) err.push('W treści zostały pola do uzupełnienia w nawiasach kwadratowych.');
        if (!(d.person || '').trim()) err.push('Podaj imię i nazwisko osoby wpisującej.');
        if (d.kind === 'montaz') { if (!d.assemblyIds.length) err.push('Wpis nie jest powiązany z żadnym wpisem dziennika montażu.'); d.assemblyIds.map(asm).forEach(a => { if (!a || a.status !== 'zatwierdzony') err.push(`Powiązany wpis montażu ${a ? a.nr : ''} nie jest zatwierdzony (${a ? a.status : 'usunięty'}).`); else if (a.date > d.date) err.push(`Data wpisu jest wcześniejsza niż montaż z ${a.nr} (${M.fmt(a.date)}).`); const o = coverOf(a.id); if (o && o.id !== d.id && o.id !== d.correctionOf) err.push(`${a.nr} jest już ujęty we wpisie ${o.nr}.`); }); }
        if (err.length) return M.UI.modal({ title: 'Wpis wymaga poprawy', body: `<ul>${err.map(x => `<li>${e(x)}</li>`).join('')}</ul>` });
        d.textFinal = t; d.cover = d.kind === 'montaz' ? sums(d.assemblyIds) : null; d.status = 'gotowy'; d.readyDate = M.todayISO(); d.readyBy = M.S.settings.currentUser; M.S.upsert('diary', d);
        if (d.correctionOf) { const o = M.S.get('diary', d.correctionOf); if (o) { o.status = 'skorygowany'; o.correctedBy = d.id; M.S.upsert('diary', o); } }
        M.toast('Treść zatwierdzona – teraz wpis do urzędowego dziennika'); this.detail(v, d);
      });
      on('#undo', () => { d.status = 'szkic'; d.textFinal = null; d.cover = null; if (d.correctionOf) { const o = M.S.get('diary', d.correctionOf); if (o && o.correctedBy === d.id) { o.status = 'wpisany'; o.correctedBy = ''; M.S.upsert('diary', o); } } M.S.upsert('diary', d); this.detail(v, d); });
      on('#mail', () => { const insp = team().find(t => t.name === d.person && t.email) || teamBy(d.func).find(t => t.email) || M.S.companies('inwestor')[0]; M.ML.mailto({ to: insp ? insp.email || '' : '', subject: `[${M.S.project.short || M.S.project.name}] Prośba o wpis do dziennika budowy – ${d.subject || d.nr}`, body: `Dzień dobry,\n\nproszę o dokonanie wpisu w dzienniku budowy${M.S.project.edb ? ' nr ' + M.S.project.edb : ''} (${c.form === 'edb' ? 'system EDB' : 'dziennik papierowy w biurze budowy'}).\n\nProponowana treść (${d.func}):\n\n${fullText(d)}\n\n${M.S.settings.mailSignature || ''}` }); });
      on('#done', () => { saveNow(); if (!d.offDate) return M.toast('Podaj datę dokonania wpisu w urzędowym dzienniku', 'warn'); if (!(d.offRef || '').trim()) return M.toast(c.form === 'edb' ? 'Podaj numer wpisu w EDB' : 'Podaj tom i stronę', 'warn'); if (d.offDate > M.todayISO()) return M.toast('Data z przyszłości', 'warn'); d.status = 'wpisany'; d.offBy = M.S.settings.currentUser; d.offAt = Date.now(); M.S.upsert('diary', d); M.toast('Odnotowano wpis'); this.detail(v, d); });
      on('#corr', async () => { if (all().some(x => x.correctionOf === d.id && x.status === 'szkic')) return M.toast('Korekta tego wpisu jest już w przygotowaniu', 'warn'); const reason = await askText(`Korekta wpisu ${d.nr}`, 'Uzasadnienie korekty', 'Utwórz korektę'); if (!reason) return;
        let ids = d.assemblyIds.slice(); if (d.kind === 'montaz') ids = [...new Set(ids.map(asm).map(a => { while (a && a.status === 'skorygowany' && a.correctedBy) a = asm(a.correctedBy); return a && a.status === 'zatwierdzony' ? a.id : null; }).filter(Boolean))];
        this.create({ kind: d.kind, subject: 'Korekta: ' + (d.subject || d.nr), func: d.func, person: d.person, lic: d.lic || '', assemblyIds: ids, protocolId: d.protocolId, correctionOf: d.id, reason, text: `Sprostowanie wpisu ${d.nr} z dnia ${M.fmt(d.date)}${d.offRef ? ' (' + d.offRef + ')' : ''}. Uzasadnienie: ${reason}.${d.kind === 'montaz' ? '' : '\nWłaściwa treść: ' + (d.textFinal || d.text || '')}` }); });
      on('#cancel', async () => { const reason = await askText(`Anulowanie wpisu ${d.nr}`, 'Uzasadnienie anulowania', 'Anuluj wpis'); if (!reason) return; d.status = 'anulowany'; d.cancelReason = reason; d.cancelledBy = M.S.settings.currentUser; d.cancelledAt = Date.now(); M.S.upsert('diary', d); this.detail(v, d); });
    },

    // ---------------- wydruki (ten sam układ wpisu co w dzienniku montażu) ----------------
    async htmlEntry(d) {
      const dead = !live(d); const c = dcfg(); const cell = (l, t) => `<div><span>${l}</span>${e(t) || '<i>—</i>'}</div>`;
      const orig = d.correctionOf ? M.S.get('diary', d.correctionOf) : null;
      return `<section class="dm-e ${dead ? 'dead' : ''}">
        <div class="dm-eh"><div class="nr">${e(d.nr)}</div><div class="dt"><b>${M.fmt(d.date)}</b> ${e(M.weekday(d.date))}</div><div class="tot">${e(d.subject || '')}</div><div class="stt" ${d.status === 'gotowy' || d.status === 'szkic' ? 'style="color:#7a5010;border-color:#B7791F"' : ''}>${e(ST[d.status][0])}</div></div>
        ${orig ? `<div class="dm-note">Korekta wpisu ${e(orig.nr)} z dnia ${M.fmt(orig.date)}. Uzasadnienie: ${e(d.reason || '')}</div>` : ''}
        ${d.status === 'anulowany' ? `<div class="dm-note">Wpis anulowany. Uzasadnienie: ${e(d.cancelReason || '')}</div>` : ''}
        ${d.status === 'skorygowany' ? `<div class="dm-note">Wpis skorygowany wpisem ${e((M.S.get('diary', d.correctedBy) || {}).nr || '')}.</div>` : ''}
        <div class="dm-meta" style="grid-template-columns:1.4fr 1.4fr 1fr 1fr">${cell('Wpisujący – funkcja', d.func)}${cell('Imię i nazwisko, nr uprawnień', [d.person, d.lic ? 'upr. nr ' + d.lic : ''].filter(Boolean).join(', '))}${cell('Wpis w urzędowym dzienniku', d.offDate ? M.fmt(d.offDate) : '')}${cell(c.form === 'edb' ? 'Nr wpisu w EDB' : 'Tom / strona', d.offRef)}</div>
        <div class="dm-rem" style="${dead ? 'color:#7B8386;text-decoration:line-through' : ''}"><span>Treść wpisu</span><div class="pre">${e(fullText(d))}</div></div>
        ${(d.assemblyIds || []).length || d.protocolId ? `<div class="dm-rem"><span>Powiązane dokumenty</span>${[(d.assemblyIds || []).length ? 'dziennik montażu: ' + d.assemblyIds.map(asm).filter(Boolean).map(a => a.nr).join(', ') : '', d.protocolId ? 'protokół robót zanikowych: ' + ((M.S.get('protocols', d.protocolId) || {}).nr || '') : ''].filter(Boolean).map(e).join(' · ')}</div>` : ''}
        ${d.photos && d.photos.length ? await M.PR.pics(d.photos) : ''}
        <div class="dm-sg" style="grid-template-columns:1fr 1fr"><div><span>Treść przygotował</span>${e(who(d.readyBy || d.createdBy)) || '&nbsp;'}<small>${e(d.readyDate ? M.fmt(d.readyDate) : '')}&nbsp;</small></div><div><span>Wpis w urzędowym dzienniku odnotował</span>${e(who(d.offBy)) || '&nbsp;'}<small>${e(M.fmtTs(d.offAt)) || 'data i podpis'}</small></div></div>
      </section>`;
    },
    async htmlBook() {
      const p = M.S.project; const c = dcfg(); const list = all().filter(d => d.status !== 'szkic'); const drafts = all().length - list.length; const ch = check().filter(x => x.code !== 'wpisz');
      const blocks = []; for (const d of list) blocks.push(await this.htmlEntry(d));
      return `${M.PR.header('Dziennik budowy', 'rejestr roboczy wpisów')}${CSS()}
        <div class="box small" style="margin-bottom:4mm"><b>Dokument roboczy – nie zastępuje dziennika budowy.</b> Urzędowy dziennik tej budowy: ${c.form === 'edb' ? 'system EDB' : 'papierowy'}${p.edb ? ', nr ' + e(p.edb) : ''}${c.volume ? ', tom ' + e(c.volume) : ''}. Dziennik budowy prowadzi się w postaci papierowej albo elektronicznej w systemie EDB; wpisów dokonują w nim osobiście uprawnione osoby. Rejestr zawiera przygotowaną treść wpisów i potwierdzenie ich dokonania.${drafts ? ` Wydruk nie obejmuje ${drafts} ${M.plural(drafts, 'szkicu', 'szkiców', 'szkiców')}.` : ''}</div>
        ${MZ() ? `<div class="box small" style="margin-bottom:4mm;${ch.length ? 'border-color:#ED471D;background:#FEF3EF' : 'border-color:#2F855A;background:#EEF8F2'}"><b>Zgodność z dziennikiem montażu (stan na ${M.fmt(M.todayISO())}): ${ch.length ? ch.length + ' ' + M.plural(ch.length, 'sprawa', 'sprawy', 'spraw') + ' do wyjaśnienia' : 'zgodne'}.</b>${ch.map(x => `<div>• ${e(x.t)}</div>`).join('')}</div>` : ''}
        ${blocks.join('') || '<p class="muted">Brak wpisów.</p>'}`;
    },
  };
  const CSS = () => (MZ() && MZ().CSS_TAG) || '';

  M.DZ = { coverOf, check, genFromAssembly, uncovered, sums };

  // ---------------- dane przykładowe (fikcyjne) ----------------
  M.DEMO = M.DEMO || {};
  M.DEMO.dziennik = (p, kb, d) => {
    const S = M.S; const A = S.db.assembly.filter(a => a.projectId === p.id && a.status === 'zatwierdzony');
    p.diary = { form: 'papier', volume: '1', remindDays: 2 };
    p.team = [{ id: 't1', func: FUN[0], name: kb.name, lic: 'DEMO/0001/PWBKb/00', scope: 'konstrukcyjno-budowlana', company: 'Generalny Wykonawca (DEMO)', email: '' }, { id: 't2', func: FUN[2], name: 'Inspektor DEMO', lic: 'DEMO/0002/PWBKb/00', scope: 'konstrukcyjno-budowlana', company: 'Inwestor Logistyka DEMO', email: 'inspektor@example.com' }, { id: 't3', func: FUN[4], name: 'Geodeta DEMO', lic: 'DEMO/0003', scope: '', company: '', email: '' }];
    const D = (n, o) => { const x = Object.assign({ id: M.uid() + 'd' + n, projectId: p.id, nr: 'DB-' + M.pad(n, 3), status: 'wpisany', kind: 'roboty', func: FUN[0], person: kb.name, text: '', assemblyIds: [], protocolId: '', photos: [], created: Date.now() - (12 - n) * 86400000, createdBy: kb.id, readyBy: kb.id, offBy: kb.id }, o); x.readyDate = x.readyDate || x.date; x.offAt = x.offDate ? M.toDate(x.offDate).getTime() + 15 * 3600000 : null; S.db.diary.push(x); return x; };
    const t1 = 'Rozpoczęto montaż konstrukcji prefabrykowanej hali. Podstawa: projekt wykonawczy konstrukcji, rysunki montażowe K-100…K-120. Stopy fundamentowe odebrane, pomiar geodezyjny kielichów – szkic G-09. Prowadzony jest dziennik montażu nr DM/DEMO/1.';
    D(1, { date: d(-9), subject: 'Rozpoczęcie montażu konstrukcji', text: t1, textFinal: t1, offDate: d(-9), offRef: 'tom 1, str. 12' });
    const ids = A.slice(0, 2).map(a => a.id);
    const x2 = D(2, { date: d(-8), kind: 'montaz', subject: 'Montaż konstrukcji – postęp', assemblyIds: ids, offDate: d(-8), offRef: 'tom 1, str. 13' }); x2.textFinal = genFromAssembly(ids); x2.cover = sums(ids);
    const t3 = 'Potwierdzam wykonanie montażu słupów S-01, S-02, S-03 w osiach 1–16 / A oraz 1–10 / B, na podstawie szkiców geodezyjnych G-11 i G-12. Uwagi: brak.';
    D(3, { date: d(-7), subject: 'Potwierdzenie montażu – wpis inspektora', func: FUN[2], person: 'Inspektor DEMO', text: t3, textFinal: t3, status: 'gotowy', readyDate: d(-7), offDate: '', offRef: '' });
  };
})(window.M);
