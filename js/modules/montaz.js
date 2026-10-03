/* =========================================================
   BIURO BUDOWY — Dziennik montażu (prefabrykaty, konstrukcje stalowe)
   ---------------------------------------------------------
   Zasada: JEDNO ŹRÓDŁO DANYCH.
   • „elements” – rejestr elementów (import z Excela wytwórcy; ceny NIE są wczytywane)
   • „assembly” – wpisy dzienne: grupy elementów w osiach, warunki, kontrola
   Postęp i treść wpisu liczy program (nie AI) – dlatego liczby zawsze się zgadzają.
   Po zatwierdzeniu wpisu nie da się go edytować: tylko korekta albo anulowanie
   z uzasadnieniem (tak jak w systemie EDB).
   Stan prawny (sprawdzony 2.10.2026): dziennik montażu nie jest wymieniony w art. 3
   pkt 13 Prawa budowlanego – to dokument wykonawcy, wymagany umową lub specyfikacją.
   Urzędowym dokumentem pozostaje dziennik budowy (papier albo system EDB).
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const ST = { szkic: ['Szkic', 'rej'], zgloszony: ['Do zatwierdzenia', 'check'], zatwierdzony: ['Zatwierdzony', 'done'], skorygowany: ['Skorygowany', 'rej'], anulowany: ['Anulowany', 'open'] };
  const KIND = { pref: ['Prefabrykaty żelbetowe', 'elementów prefabrykowanych'], stal: ['Konstrukcja stalowa', 'elementów konstrukcji stalowej'], inne: ['Inna konstrukcja montowana', 'elementów'] };
  const GEO = [['wykonano', 'wykonano'], ['do wykonania', 'do wykonania'], ['nd', 'nie dotyczy']];
  const ODCH = [['w tolerancji', 'w tolerancji'], ['przekroczone', 'przekroczone'], ['nie mierzono', 'nie mierzono']];
  const RHO = 2.5; // t/m3 – żelbet, do SZACOWANIA masy elementu z objętości
  const nf = (n, d = 2) => (n === '' || n == null || isNaN(n)) ? '' : Number(n).toLocaleString('pl-PL', { maximumFractionDigits: d });
  const pct = (a, b) => b ? Math.min(100, Math.round(a / b * 100)) : 0;

  // ---------------- dane ----------------
  const cfg = () => { const p = M.S.project; return Object.assign({ mode: 'gw', kind: 'pref', companyId: '', maker: '', nr: '', started: '', manager: '', managerLic: '', kb: '', inspector: '', basis: '' }, (p && p.montaz) || {}); };
  const saveCfg = (c) => { const p = M.S.project; p.montaz = c; M.S.upsert('projects', p); };
  const els = () => M.S.all('elements').slice().sort((a, b) => (a.ord || 0) - (b.ord || 0));
  const entries = () => M.S.all('assembly').slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.created || 0) - (b.created || 0) || (a.nr || '').localeCompare(b.nr || ''));
  const elOf = (id) => M.S.get('elements', id);
  /** ile sztuk zamontowano wg ZATWIERDZONYCH wpisów (bez wpisu excludeId) */
  const sumMap = (statuses, excludeIds = []) => { const m = new Map(); entries().forEach(a => { if (!statuses.includes(a.status) || excludeIds.includes(a.id)) return; (a.items || []).forEach(i => m.set(i.elementId, (m.get(i.elementId) || 0) + (Number(i.n) || 0))); }); return m; };
  const doneMap = (excludeIds) => sumMap(['zatwierdzony'], excludeIds);
  const draftMap = () => sumMap(['szkic', 'zgloszony']);
  const totals = () => { const d = doneMap(); const all = els(); const q = all.reduce((s, x) => s + (Number(x.qty) || 0), 0); const dn = all.reduce((s, x) => s + Math.min(Number(x.qty) || 0, d.get(x.id) || 0), 0); return { q, dn, types: all.length }; };

  // ---------------- uprawnienia ----------------
  const isAssembler = () => { const c = cfg(); return c.mode === 'podw' && M.P.role() === 'PODW' && c.companyId && M.P.myCompany() === c.companyId; };
  const canSee = () => M.P.role() !== 'PODW' || isAssembler();
  const canApprove = () => M.P.canEdit('montaz');
  const canWrite = () => canApprove() || isAssembler();
  const editable = (a) => (a.status === 'szkic' && canWrite()) || (a.status === 'zgloszony' && canApprove());

  // ---------------- teksty ----------------
  const itemName = (i) => i.name || (elOf(i.elementId) || {}).name || '(usunięty element)';
  const itemDraw = (i) => i.drawing != null ? i.drawing : (elOf(i.elementId) || {}).drawing || '';
  const itemGroup = (i) => i.group != null ? i.group : (elOf(i.elementId) || {}).group || '';
  const itemsCount = (a) => (a.items || []).reduce((s, i) => s + (Number(i.n) || 0), 0);
  const itemsShort = (a) => { const g = new Map(); (a.items || []).forEach(i => { const k = itemGroup(i) || 'elementy'; g.set(k, (g.get(k) || 0) + (Number(i.n) || 0)); }); return [...g].map(([k, n]) => `${k} – ${n} szt.`).join(', '); };
  const axesShort = (a) => [...new Set((a.items || []).map(i => (i.axes || '').trim()).filter(Boolean))].join('; ');
  const wxTxt = (a) => [M.weatherTxt ? M.weatherTxt(a.weather) : '', a.weatherNote || ''].filter(Boolean).join('. ');
  const who = (id) => { const p = M.S.person(id); return p ? `${p.name} (${(M.P.ROLES[p.role] || {}).label || p.role})` : ''; };
  /** stan zaawansowania grup, których dotyczy wpis – po uwzględnieniu tego wpisu */
  const stateAfter = (a) => {
    if (a.stateAfter) return a.stateAfter;
    const ex = [a.id]; if (a.correctionOf) ex.push(a.correctionOf);
    const d = doneMap(ex); (a.items || []).forEach(i => d.set(i.elementId, (d.get(i.elementId) || 0) + (Number(i.n) || 0)));
    const groups = [...new Set((a.items || []).map(i => (elOf(i.elementId) || {}).group).filter(g => g != null))];
    return groups.map(g => { const list = els().filter(x => x.group === g); return { group: g || 'elementy', done: list.reduce((s, x) => s + (d.get(x.id) || 0), 0), qty: list.reduce((s, x) => s + (Number(x.qty) || 0), 0) }; });
  };
  /** treść wpisu składana z danych – do wklejenia do dziennika budowy / EDB */
  const genText = (a) => {
    const c = cfg(); const L = [];
    if (a.correctionOf) { const o = M.S.get('assembly', a.correctionOf); L.push(`Korekta wpisu ${o ? o.nr : ''} z dnia ${o ? M.fmt(o.date) : ''}. Uzasadnienie: ${a.reason || '—'}.`); }
    const n = itemsCount(a);
    if (n) L.push(`W dniu ${M.fmt(a.date)} zamontowano ${n} szt. ${KIND[c.kind][1]}: ` + a.items.map(i => `${itemName(i)}${itemDraw(i) ? ` (rys. ${itemDraw(i)})` : ''} – ${i.n} szt., osie ${i.axes || '—'}${i.note ? ` (${i.note})` : ''}`).join('; ') + '.');
    else L.push(`W dniu ${M.fmt(a.date)} nie montowano elementów.`);
    const res = [M.S.respName(c.companyId) !== 'nieprzypisane' ? `wykonawca montażu: ${M.S.respName(c.companyId)}` : '', a.crew ? `brygada ${a.crew} os.` : '', a.crane ? `sprzęt: ${a.crane}` : '', a.hours ? `godziny pracy: ${a.hours}` : ''].filter(Boolean);
    if (res.length) L.push(res.join(', ').replace(/^./, s => s.toUpperCase()) + '.');
    if (wxTxt(a)) L.push(`Pogoda: ${wxTxt(a)}.`);
    if (a.geo) L.push(`Pomiar geodezyjny: ${(GEO.find(g => g[0] === a.geo) || [])[1]}${a.geoRef ? `, ${a.geoRef}` : ''}.`);
    if (a.dev) L.push(`Odchyłki montażowe: ${a.dev}${a.devNote ? ` – ${a.devNote}` : ''}.`);
    if (a.joints) L.push(`Połączenia: ${a.joints}.`);
    if (a.docs) L.push(`Dostawy i dokumenty: ${a.docs}.`);
    if (a.damage) L.push(`Uszkodzenia / naprawy: ${a.damage}.`);
    const sa = stateAfter(a); if (sa.length) L.push('Stan zaawansowania po wpisie: ' + sa.map(s => `${s.group} ${s.done}/${s.qty} szt`).join('; ') + '.');
    if (a.remarks) L.push(`Uwagi: ${a.remarks}`);
    return L.join('\n');
  };
  const askText = (title, label, okLabel = 'Zapisz') => new Promise(res => {
    const m = M.UI.modal({ title, body: `<label class="f req"><span>${e(label)}</span><textarea id="t" rows="4"></textarea></label>`, footer: `<button class="btn ghost" data-n>Anuluj</button><button class="btn primary" data-y>${e(okLabel)}</button>`, onClose: () => res(null) });
    m.querySelector('[data-n]').onclick = () => m.close();
    m.querySelector('[data-y]').onclick = () => { const t = m.querySelector('#t').value.trim(); if (!t) return M.toast('Uzasadnienie jest wymagane', 'warn'); res(t); m.parentElement.remove(); };
    m.querySelector('#t').focus();
  });

  // ---------------- kontrola przed zatwierdzeniem (program, nie AI) ----------------
  const validate = (a) => {
    const err = [], warn = [];
    if (!a.date) err.push('Brak daty wpisu.');
    if (a.date > M.todayISO()) err.push('Data wpisu jest z przyszłości.');
    if (!(a.items || []).length && !(a.remarks || '').trim()) err.push('Wpis jest pusty: dodaj elementy albo opisz w uwagach, dlaczego nie było montażu.');
    const ex = [a.id]; if (a.correctionOf) ex.push(a.correctionOf);
    const d = doneMap(ex); const inEntry = new Map();
    (a.items || []).forEach((i, k) => {
      const el = elOf(i.elementId);
      if (!el) return err.push(`Pozycja ${k + 1}: element nie istnieje w rejestrze.`);
      if (!Number.isInteger(Number(i.n)) || Number(i.n) < 1) err.push(`${el.name}: liczba sztuk musi być liczbą całkowitą większą od zera.`);
      if (!(i.axes || '').trim()) err.push(`${el.name}: podaj osie, w których zamontowano elementy.`);
      inEntry.set(el.id, (inEntry.get(el.id) || 0) + (Number(i.n) || 0));
    });
    inEntry.forEach((n, id) => { const el = elOf(id); const left = (Number(el.qty) || 0) - (d.get(id) || 0); if (n > left) err.push(`${el.name}: wpis obejmuje ${n} szt., a do zamontowania zostało ${left} z ${el.qty}.`); });
    const later = entries().filter(x => x.status === 'zatwierdzony' && !ex.includes(x.id) && x.date > a.date);
    if (later.length) warn.push(`Istnieją zatwierdzone wpisy z późniejszą datą (${later.map(x => x.nr).join(', ')}). Wpis zostanie dodany wstecz.`);
    if (itemsCount(a) && !a.crew) warn.push('Nie podano liczebności brygady.');
    if (itemsCount(a) && !a.geo) warn.push('Nie zaznaczono, czy wykonano pomiar geodezyjny.');
    return { err, warn };
  };

  // =========================================================
  //  MODUŁ
  // =========================================================
  M.modules.montaz = {
    title: 'Dziennik montażu', icon: 'cube', order: 5.5,
    desc: 'Rejestr elementów z Excela wytwórcy, wpisy grupami w osiach, postęp liczony automatycznie, czytelny wydruk.',
    today() { return canApprove() ? M.S.all('assembly').filter(a => a.status === 'zgloszony').map(a => ({ lvl: 'yel', icon: 'cube', t: `${a.nr}: wpis do dziennika montażu czeka na zatwierdzenie`, d: `${M.fmt(a.date)} · ${itemsShort(a)}`, go: 'montaz/wpis/' + a.id })) : []; },
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      if (!canSee()) { v.innerHTML = `<div class="card card-pad">${M.UI.empty('Dziennik montażu widzi tylko firma wskazana jako wykonawca montażu.', 'lock')}</div>`; return; }
      if (rest[0] === 'wpis' && rest[1]) { const a = M.S.get('assembly', rest[1]); if (a) return this.detail(v, a); }
      const tab = ['wpisy', 'elementy', 'dane'].includes(rest[0]) ? rest[0] : 'wpisy';
      const t = totals(); const c = cfg(); const list = entries();
      const appr = list.filter(a => a.status === 'zatwierdzony'); const last = appr[appr.length - 1];
      v.innerHTML = M.UI.head('Dziennik <span class="acc">montażu</span>', `${e(KIND[c.kind][0])} · prowadzi: ${c.mode === 'podw' ? 'wykonawca montażu, zatwierdza kierownik budowy' : 'generalny wykonawca'}`,
        `${canWrite() ? `<button class="btn primary" id="new">${M.icon.plus}Nowy wpis</button><button class="btn soft" id="aiPlan">${M.icon.spark}AI: ułóż dziennik</button>` : ''}<button class="btn" id="pdf">${M.icon.print}Dziennik PDF</button><button class="btn" id="xls">${M.icon.xlsx}Excel</button>`) +
        (canWrite() ? '' : `<div class="banner info" style="margin-bottom:12px">${M.icon.eye}<span>Tryb podglądu – jako <b>${e(M.P.ROLES[M.P.role()].label)}</b> możesz przeglądać, bez edycji.</span></div>`) +
        `<div class="kpis"><div class="kpi"><b>${t.q}</b><span>elementów do montażu (${t.types} ${M.plural(t.types, 'typ', 'typy', 'typów')})</span></div><div class="kpi"><b class="or">${t.dn}</b><span>zamontowano · ${pct(t.dn, t.q)}%</span></div><div class="kpi"><b>${t.q - t.dn}</b><span>pozostało</span></div><div class="kpi"><b>${appr.length}</b><span>wpisów zatwierdzonych${last ? ' · ostatni ' + M.fmt(last.date) : ''}</span></div></div>
        <div class="tabs">${[['wpisy', `Wpisy (${list.length})`], ['elementy', `Elementy i postęp (${t.types})`], ['dane', 'Dane dziennika']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="box"></div>`;
      v.querySelectorAll('.tabs button').forEach(b => b.onclick = () => M.go('montaz/' + b.dataset.t));
      const nb = v.querySelector('#new'); if (nb) nb.onclick = () => this.newDialog();
      const ap = v.querySelector('#aiPlan'); if (ap) ap.onclick = () => this.aiPlan();
      v.querySelector('#pdf').onclick = async () => M.UI.docPreview('Dziennik montażu', await this.htmlBook());
      v.querySelector('#xls').onclick = () => this.excel();
      this['tab_' + tab](v.querySelector('#box'));
    },

    // ---------------- zakładka: wpisy ----------------
    tab_wpisy(box) {
      const desc = M.S.settings.dmOrder === 'desc'; const chrono = entries(); const lp = new Map(chrono.map((a, i) => [a.id, i + 1])); const list = desc ? chrono.slice().reverse() : chrono;
      if (!els().length) { box.innerHTML = `<div class="card card-pad">${M.UI.empty('Zacznij od rejestru elementów: zakładka <b>Elementy i postęp</b> → <b>Import z Excela</b>.', 'cube')}</div>`; return; }
      box.innerHTML = `<div class="card"><div class="toolbar"><span class="small muted grow">Wpisy układają się same według daty montażu – także dodane wstecz.</span><div class="seg" id="ord"><button data-o="asc" class="${desc ? '' : 'on'}">od najstarszych</button><button data-o="desc" class="${desc ? 'on' : ''}">od najnowszych</button></div></div>${list.length ? `<div class="table-wrap"><table class="list"><thead><tr><th>Lp.</th><th>Data</th><th>Zamontowano</th><th>Szt.</th><th class="hide-m">Osie</th><th class="hide-m">Sporządził</th><th>Status</th></tr></thead><tbody>${list.map(a => `<tr class="click" data-id="${a.id}"><td class="num">${lp.get(a.id)}<div class="xs muted">${e(a.nr)}</div></td><td class="nowrap">${M.fmt(a.date)} <span class="muted small hide-m">${e(M.weekday(a.date))}</span></td><td>${e(itemsShort(a) || 'bez montażu')}${a.correctionOf ? ` <span class="badge warn">korekta ${e((M.S.get('assembly', a.correctionOf) || {}).nr || '')}</span>` : ''}${a.ai && a.status === 'szkic' ? ' <span class="badge info">projekt AI – do sprawdzenia</span>' : ''}</td><td class="num">${itemsCount(a) || '—'}</td><td class="hide-m small">${e(axesShort(a))}</td><td class="hide-m small">${e((M.S.person(a.createdBy) || {}).name || '')}</td><td>${M.UI.st(ST, a.status)}</td></tr>`).join('')}</tbody></table></div>` : M.UI.empty('Brak wpisów. Kliknij „Nowy wpis” albo „AI: ułóż dziennik”.', 'cube')}</div>`;
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => M.go('montaz/wpis/' + tr.dataset.id));
      box.querySelectorAll('#ord button').forEach(b => b.onclick = () => { M.S.set('dmOrder', b.dataset.o); M.refresh(); });
    },
    /** nowy wpis: najpierw data (można wstecz), opcjonalnie typowy zapis */
    newDialog() {
      if (!els().length) return M.toast('Najpierw zaimportuj listę elementów', 'warn');
      const W = M.WZ.DM; const m = M.UI.modal({ title: 'Nowy wpis w dzienniku montażu', wide: true, body: `<div class="col"><div class="row" style="align-items:flex-end"><label class="f" style="width:190px">Data montażu<input type="date" id="nd" value="${M.todayISO()}" max="${M.todayISO()}"></label><span class="grow"></span><button class="btn primary" id="plain">${M.icon.plus}Wpis montażu elementów</button></div>
        <div class="small muted">Albo zacznij od typowego zapisu – treść trafi do pól „Uwagi” i „Połączenia”, elementy dodasz we wpisie.</div>
        <div class="table-wrap" style="max-height:50vh"><table class="list"><tbody>${(() => { let last = ''; return W.map((w, i) => `${w.c !== last ? ((last = w.c), `<tr class="dm-g"><td><b>${e(w.c)}</b></td></tr>`) : ''}<tr class="click" data-w="${i}"><td><b>${e(w.n)}</b><div class="xs muted">${e((w.r || w.j || '').slice(0, 140))}</div></td></tr>`).join(''); })()}</tbody></table></div></div>` });
      const date = () => m.querySelector('#nd').value || M.todayISO();
      m.querySelector('#plain').onclick = () => { const d = date(); m.close(); this.newEntry({ date: d }); };
      m.querySelectorAll('[data-w]').forEach(tr => tr.onclick = () => { const w = W[+tr.dataset.w]; const d = date(); const f = (t) => (t || '').split('[data]').join(M.fmt(d)); m.close(); this.newEntry({ date: d, remarks: f(w.r), joints: f(w.j), docs: f(w.d), subject: w.n }); });
    },
    newEntry(from) {
      if (!els().length) return M.toast('Najpierw zaimportuj listę elementów', 'warn');
      const prev = entries().filter(a => a.status !== 'anulowany').pop();
      const a = M.S.upsert('assembly', Object.assign({ nr: M.S.nextNr('assembly', 'DM'), date: M.todayISO(), status: 'szkic', items: [], crew: prev ? prev.crew : '', crane: prev ? prev.crane : '', hours: prev ? prev.hours : '', weather: null, weatherNote: '', geo: '', geoRef: '', dev: '', devNote: '', joints: '', docs: '', damage: '', remarks: '', photos: [] }, from || {}));
      M.go('montaz/wpis/' + a.id);
    },

    // ---------------- zakładka: elementy ----------------
    tab_elementy(box) {
      const edit = canApprove(); const all = els(); const d = doneMap(); const dr = draftMap();
      if (!all.length) {
        box.innerHTML = `<div class="card card-pad col"><div class="drop" id="imp0">${M.ico('upload', 34)}<div><b>Wczytaj zestawienie elementów z Excela</b></div><div class="small muted">Plik od wytwórcy: kolumny z nazwą elementu i ilością. Ceny i wartości nie są wczytywane.</div></div>${edit ? `<div class="row"><button class="btn" id="add">${M.icon.plus}Dodaj element ręcznie</button><span class="small muted">Przykładowy plik: folder <span class="mono">przyklady</span> → Zestawienie_elementow_przyklad.xlsx</span></div>` : ''}</div>`;
        const i0 = box.querySelector('#imp0'); if (edit) i0.onclick = () => this.importDialog(); else i0.style.display = 'none';
        const ad = box.querySelector('#add'); if (ad) ad.onclick = () => this.editElement({});
        return;
      }
      const groups = [...new Set(all.map(x => x.group || ''))];
      box.innerHTML = `<div class="card"><div class="toolbar"><div class="search">${M.icon.search}<input type="search" id="q" placeholder="Szukaj: nazwa, nr rysunku…"></div><label class="check"><input type="checkbox" id="left">tylko niezakończone</label><span class="grow"></span>${edit ? `<button class="btn sm" id="imp">${M.icon.upload}Import z Excela</button><button class="btn sm" id="add">${M.icon.plus}Element</button>` : ''}</div>
        <div class="table-wrap"><table class="list dm-el"><thead><tr><th>Lp.</th><th>Element</th><th class="hide-m">Nr rys. / poziom</th><th class="hide-m" style="text-align:right">Obj. [m³]</th><th style="text-align:right">Ilość</th><th style="text-align:right">Zamont.</th><th style="text-align:right">Zostało</th><th style="width:150px">Postęp</th></tr></thead><tbody id="tb"></tbody></table></div></div>
        <div class="small muted" style="margin-top:8px">„Zamontowano” liczy się tylko z wpisów zatwierdzonych. Liczba w nawiasie to sztuki we wpisach roboczych.</div>`;
      const draw = () => {
        const q = M.norm(box.querySelector('#q').value); const onlyLeft = box.querySelector('#left').checked;
        box.querySelector('#tb').innerHTML = groups.map(g => {
          const inG = all.filter(x => (x.group || '') === g); const gq = inG.reduce((s, x) => s + (Number(x.qty) || 0), 0); const gd = inG.reduce((s, x) => s + (d.get(x.id) || 0), 0);
          const rows = inG.filter(x => (!q || M.norm(`${x.name} ${x.drawing} ${x.lp}`).includes(q)) && (!onlyLeft || (d.get(x.id) || 0) < x.qty));
          if (!rows.length) return '';
          return `<tr class="dm-g"><td colspan="2"><b>${e(g || 'Elementy')}</b></td><td class="hide-m"></td><td class="hide-m"></td><td style="text-align:right"><b>${gq}</b></td><td style="text-align:right"><b>${gd}</b></td><td style="text-align:right"><b>${gq - gd}</b></td><td><div class="meter"><i style="width:${pct(gd, gq)}%"></i></div></td></tr>` +
            rows.map(x => { const dn = d.get(x.id) || 0, w = dr.get(x.id) || 0; return `<tr class="${edit ? 'click' : ''}" data-id="${x.id}"><td class="num">${e(x.lp || '')}</td><td>${e(x.name)}${x.vol && x.unit === 'm3' ? `<div class="xs muted">masa szac. ${nf(x.vol * RHO, 1)} t</div>` : x.mass ? `<div class="xs muted">masa ${nf(x.mass, 2)} t</div>` : ''}</td><td class="hide-m small">${e(x.drawing || '')}</td><td class="hide-m" style="text-align:right">${nf(x.vol, 3)}</td><td style="text-align:right">${x.qty}</td><td style="text-align:right">${dn}${w ? ` <span class="muted small">(+${w})</span>` : ''}</td><td style="text-align:right">${x.qty - dn}</td><td><div class="meter"><i style="width:${pct(dn, x.qty)}%${dn >= x.qty ? ';background:var(--st-done)' : ''}"></i></div></td></tr>`; }).join('');
        }).join('') || `<tr><td colspan="8">${M.UI.empty('Nic nie pasuje do filtra.', 'search')}</td></tr>`;
        if (edit) box.querySelectorAll('#tb tr.click').forEach(tr => tr.onclick = () => this.editElement(M.S.get('elements', tr.dataset.id)));
      };
      box.querySelector('#q').oninput = draw; box.querySelector('#left').onchange = draw; draw();
      const im = box.querySelector('#imp'); if (im) im.onclick = () => this.importDialog();
      const ad = box.querySelector('#add'); if (ad) ad.onclick = () => this.editElement({});
    },
    editElement(x) {
      const isNew = !x.id; const used = !isNew && entries().some(a => (a.items || []).some(i => i.elementId === x.id));
      const groups = [...new Set(els().map(g => g.group).filter(Boolean))];
      const m = M.UI.modal({ title: isNew ? 'Nowy element' : 'Element', body: `<div class="col" id="ef"><label class="f req"><span>Nazwa / symbol</span><input type="text" data-f="name" value="${e(x.name || '')}"></label><div class="grid2"><label class="f">Grupa<input type="text" data-f="group" list="dmg" value="${e(x.group || '')}"><datalist id="dmg">${groups.map(g => `<option value="${e(g)}">`).join('')}</datalist></label><label class="f">Nr rysunku / poziom<input type="text" data-f="drawing" value="${e(x.drawing || '')}"></label></div><div class="grid3"><label class="f req"><span>Ilość [szt.]</span><input type="number" min="1" step="1" data-f="qty" value="${e(x.qty ?? '')}"></label><label class="f">Objętość 1 szt. [m³]<input type="number" step="0.001" data-f="vol" value="${e(x.vol ?? '')}"></label><label class="f">Masa 1 szt. [t]<input type="number" step="0.01" data-f="mass" value="${e(x.mass ?? '')}"></label></div>${used ? '<div class="banner info">' + M.icon.lock + '<span>Element występuje we wpisach – nie można go usunąć ani zmniejszyć ilości poniżej liczby zamontowanych.</span></div>' : ''}</div>`,
        footer: `${!isNew && !used ? `<button class="btn danger" id="del">${M.icon.trash}Usuń</button>` : ''}<span class="grow"></span><button class="btn primary" id="ok">Zapisz</button>` });
      m.querySelector('#ok').onclick = () => {
        const f = M.UI.read(m.querySelector('#ef')); if (!f.name.trim()) return M.toast('Podaj nazwę', 'warn'); if (!(f.qty >= 1)) return M.toast('Podaj ilość', 'warn');
        const dn = x.id ? (sumMap(['zatwierdzony', 'szkic', 'zgloszony']).get(x.id) || 0) : 0; if (f.qty < dn) return M.toast(`We wpisach jest już ${dn} szt. tego elementu`, 'warn');
        M.S.upsert('elements', Object.assign(x, f, { unit: f.vol ? 'm3' : (x.unit || 'szt.'), ord: x.ord != null ? x.ord : (Math.max(0, ...els().map(q => q.ord || 0)) + 1) })); m.close(); M.refresh();
      };
      const dl = m.querySelector('#del'); if (dl) dl.onclick = async () => { if (await M.UI.confirm('Usunąć element z rejestru?', 'Usuń', true)) { M.S.remove('elements', x.id); m.close(); M.refresh(); } };
    },

    // ---------------- import z Excela wytwórcy ----------------
    /** arkusz → wiersze (wartości; formuły: zapisany wynik albo prosta arytmetyka typu =29+10) */
    async readSheet(file) {
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
      const val = (v) => {
        if (v && typeof v === 'object' && !(v instanceof Date) && v.formula != null) { if (v.result != null && typeof v.result !== 'object') return v.result; const f = String(v.formula).replace(/,/g, '.'); if (/^[\d\s.+\-*/()]+$/.test(f)) { try { return Function('"use strict";return (' + f + ')')(); } catch (err) { return ''; } } return ''; }
        return M.cellVal(v);
      };
      return wb.worksheets.map(ws => { const rows = []; ws.eachRow({ includeEmpty: false }, r => { const a = []; r.eachCell({ includeEmpty: true }, (c, i) => a[i - 1] = val(c.value)); for (let i = 0; i < a.length; i++) if (a[i] === undefined || a[i] === null) a[i] = ''; rows.push(a); }); return { name: ws.name, rows }; }).filter(s => s.rows.length);
    },
    /** rozpoznanie kolumn po nagłówkach. Kolumny cen i wartości są celowo pomijane. */
    guessCols(rows) {
      const FIELDS = { lp: h => /^(lp|l p|poz|pozycja|nr)$/.test(h), drawing: h => /rysun|nr rys|poziom|kondygn/.test(h), name: h => /nazwa|opis|element|symbol|oznaczenie/.test(h) && !/cena|wartosc/.test(h), unit: h => /^(jedn|j m|jm)/.test(h), vol: h => /obj/.test(h) && !/razem|lacz|ogol|sum/.test(h), mass: h => /(masa|ciezar|waga)/.test(h) && !/stal|razem|lacz|ogol|sum/.test(h), qty: h => /ilosc|^szt|liczba/.test(h) };
      let best = { row: -1, map: {}, score: 0 };
      rows.slice(0, 20).forEach((r, ri) => { const map = {}; r.forEach((c, ci) => { const h = M.norm(c); if (!h) return; for (const [k, fn] of Object.entries(FIELDS)) if (map[k] == null && fn(h)) { map[k] = ci; break; } }); const score = (map.name != null ? 2 : 0) + (map.qty != null ? 2 : 0) + Object.keys(map).length; if (map.name != null && map.qty != null && score > best.score) best = { row: ri, map, score }; });
      return best;
    },
    parseRows(rows, hdr, map) {
      const num = (v) => { if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
      const out = []; let group = '', skipped = 0;
      rows.slice(hdr + 1).forEach(r => {
        const name = String(r[map.name] ?? '').replace(/\s+/g, ' ').trim(); if (!name) return;
        if (/^(razem|lacznie|suma|ogolem|podsumowanie)/.test(M.norm(name))) return;
        const qty = map.qty != null ? num(r[map.qty]) : null;
        if (qty == null || qty <= 0) { const lp = String(r[map.lp] ?? '').trim(); if (!lp || /^\d+\.?$/.test(lp) || map.lp == null) group = name; return; } // wiersz-nagłówek grupy
        if (!Number.isInteger(qty)) { skipped++; return; }
        const vol = map.vol != null ? num(r[map.vol]) : null; const mass = map.mass != null ? num(r[map.mass]) : null;
        out.push({ lp: String(r[map.lp] ?? '').trim(), group, name, drawing: map.drawing != null ? String(r[map.drawing] ?? '').trim() : '', unit: map.unit != null ? String(r[map.unit] ?? '').trim() : (vol ? 'm3' : 'szt.'), vol: vol != null ? Math.round(vol * 1000) / 1000 : '', mass: mass != null ? mass : '', qty });
      });
      return { out, skipped };
    },
    async importDialog() {
      const f = await M.pickFile('.xlsx'); if (!f) return;
      let sheets; try { sheets = await this.readSheet(f); } catch (err) { return M.toast('Nie udało się odczytać pliku: ' + err.message, 'err'); }
      if (!sheets.length) return M.toast('Plik jest pusty', 'err');
      let si = 0; const LAB = { lp: 'Lp.', name: 'Nazwa elementu *', drawing: 'Nr rysunku / poziom', qty: 'Ilość [szt.] *', vol: 'Objętość 1 szt.', mass: 'Masa 1 szt. [t]', unit: 'Jednostka' };
      const m = M.UI.modal({ title: 'Import zestawienia elementów', wide: true, body: '<div id="ib"></div>', footer: `<span class="small muted grow">Wczytywane są tylko: nazwa, numer rysunku, ilość, objętość, masa. <b>Ceny i wartości są pomijane.</b></span><button class="btn primary" id="ok">Importuj</button>` });
      let g, parsed;
      const draw = (keepMap) => {
        const rows = sheets[si].rows; if (!keepMap) g = this.guessCols(rows);
        if (g.row < 0) g = { row: 0, map: {} };
        const hdr = rows[g.row] || []; const colOpts = (sel) => `<option value="">— brak —</option>` + hdr.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${String.fromCharCode(65 + (i % 26))}: ${e(String(h).replace(/\s+/g, ' ').slice(0, 30) || '(pusty)')}</option>`).join('');
        parsed = (g.map.name != null && g.map.qty != null) ? this.parseRows(rows, g.row, g.map) : { out: [], skipped: 0 };
        const gr = [...new Set(parsed.out.map(x => x.group))]; const tot = parsed.out.reduce((s, x) => s + x.qty, 0); const vol = parsed.out.reduce((s, x) => s + (x.vol || 0) * x.qty, 0);
        m.querySelector('#ib').innerHTML = `<div class="col">
          <div class="row">${sheets.length > 1 ? `<label class="f">Arkusz<select id="sh">${sheets.map((s, i) => `<option value="${i}" ${i === si ? 'selected' : ''}>${e(s.name)}</option>`).join('')}</select></label>` : `<span class="small muted">Arkusz: <b>${e(sheets[si].name)}</b></span>`}<span class="small muted">Wiersz nagłówków: ${g.row + 1}</span></div>
          <fieldset class="fieldset"><legend>Kolumny – sprawdź rozpoznanie</legend><div class="grid4">${Object.entries(LAB).map(([k, l]) => `<label class="f">${l}<select data-c="${k}">${colOpts(g.map[k])}</select></label>`).join('')}</div></fieldset>
          ${parsed.out.length ? `<div class="banner ok">${M.icon.check}<span>Rozpoznano <b>${parsed.out.length}</b> ${M.plural(parsed.out.length, 'typ elementu', 'typy elementów', 'typów elementów')} w <b>${gr.length}</b> ${M.plural(gr.length, 'grupie', 'grupach', 'grupach')}, razem <b>${tot} szt.</b>${vol ? `, ok. ${nf(vol, 1)} m³` : ''}.${parsed.skipped ? ` Pominięto ${parsed.skipped} wierszy z ilością niecałkowitą.` : ''}</span></div>
          <div class="table-wrap" style="max-height:38vh"><table class="list"><thead><tr><th>Lp.</th><th>Grupa</th><th>Element</th><th>Nr rys. / poziom</th><th style="text-align:right">Obj.</th><th style="text-align:right">Ilość</th></tr></thead><tbody>${parsed.out.map(x => `<tr><td class="num">${e(x.lp)}</td><td class="small">${e(x.group)}</td><td>${e(x.name)}</td><td class="small">${e(x.drawing)}</td><td style="text-align:right">${nf(x.vol, 3)}</td><td style="text-align:right">${x.qty}</td></tr>`).join('')}</tbody></table></div>` : `<div class="banner warn">${M.icon.alert}<span>Nie rozpoznano elementów. Wskaż co najmniej kolumnę z nazwą i z ilością.</span></div>`}
          ${els().length ? `<div class="banner info">${M.icon.alert}<span>W rejestrze są już elementy. Import <b>zaktualizuje</b> pozycje o tej samej nazwie i numerze rysunku, a nowe <b>dopisze</b>. Niczego nie usuwa.</span></div>` : ''}</div>`;
        const sh = m.querySelector('#sh'); if (sh) sh.onchange = () => { si = +sh.value; draw(); };
        m.querySelectorAll('[data-c]').forEach(s => s.onchange = () => { g.map[s.dataset.c] = s.value === '' ? undefined : +s.value; if (g.map[s.dataset.c] === undefined) delete g.map[s.dataset.c]; draw(true); });
        m.querySelector('#ok').disabled = !parsed.out.length;
      };
      draw();
      m.querySelector('#ok').onclick = () => {
        const key = (x) => M.norm(`${x.name}|${x.drawing}|${x.group}`); const have = new Map(els().map(x => [key(x), x]));
        let ord = Math.max(0, ...els().map(x => x.ord || 0)), add = 0, upd = 0; const used = sumMap(['zatwierdzony', 'szkic', 'zgloszony']); const blocked = [];
        parsed.out.forEach(x => { const old = have.get(key(x)); if (old) { if (x.qty < (used.get(old.id) || 0)) { blocked.push(old.name); return; } Object.assign(old, x); M.S.upsert('elements', old, true); upd++; } else { M.S.upsert('elements', Object.assign(x, { ord: ++ord }), true); add++; } });
        M.S.touch('elements'); m.close(); M.toast(`Import: dodano ${add}, zaktualizowano ${upd}${blocked.length ? `, pominięto ${blocked.length} (ilość mniejsza niż już zamontowana)` : ''}`); M.go('montaz/elementy');
      };
    },

    // ---------------- zakładka: dane dziennika ----------------
    tab_dane(box) {
      const edit = canApprove(); const c = cfg(); const p = M.S.project;
      box.innerHTML = `<div class="grid2" style="align-items:start"><div class="card card-pad col" id="df">
          <h2>Strona tytułowa</h2>
          <div class="grid2"><label class="f">Numer dziennika montażu<input type="text" data-f="nr" value="${e(c.nr)}" placeholder="np. DM/1/2026"></label><label class="f">Data rozpoczęcia montażu<input type="date" data-f="started" value="${e(c.started)}"></label></div>
          <label class="f">Rodzaj konstrukcji<select data-f="kind">${M.UI.opts(Object.entries(KIND).map(([k, v]) => [k, v[0]]), c.kind)}</select></label>
          <div class="grid2"><label class="f">Wykonawca montażu<select data-f="companyId">${M.UI.respOpts(c.companyId, '— wybierz firmę —')}</select></label><label class="f">Wytwórca elementów<input type="text" data-f="maker" value="${e(c.maker)}"></label></div>
          <datalist id="dmTeam">${(M.TEAM ? M.TEAM.all() : []).filter(t => t.name).map(t => `<option value="${e(t.name)}">${e(t.func)}</option>`).join('')}</datalist>
          <div class="grid2"><label class="f">Kierownik montażu / robót<input type="text" data-f="manager" list="dmTeam" value="${e(c.manager)}"></label><label class="f">Nr uprawnień<input type="text" data-f="managerLic" value="${e(c.managerLic)}"></label></div>
          <div class="grid2"><label class="f">Kierownik budowy<input type="text" data-f="kb" list="dmTeam" value="${e(c.kb || ((M.TEAM ? M.TEAM.by(M.WZ.FUN[0])[0] : null) || {}).name || '')}"></label><label class="f">Inspektor nadzoru inwestorskiego<input type="text" data-f="inspector" list="dmTeam" value="${e(c.inspector || ((M.TEAM ? M.TEAM.by(M.WZ.FUN[2])[0] : null) || {}).name || '')}"></label></div>
          <div class="small muted">Osoby podpowiadają się z listy <a href="#/dziennik/uczestnicy">Uczestnicy</a> w dzienniku budowy.</div>
          <label class="f">Podstawa montażu (projekt, rysunki montażowe, projekt technologii montażu)<textarea data-f="basis" rows="2">${e(c.basis)}</textarea></label>
          <div class="small muted">Numer dziennika budowy: <b>${e(p.edb || 'nie podano')}</b> – zmienisz w Ustawieniach → Budowa.</div>
        </div>
        <div class="col"><div class="card card-pad col"><h2>Kto prowadzi dziennik na tej budowie</h2>
            <div class="seg" id="mode"><button data-m="gw" class="${c.mode === 'gw' ? 'on' : ''}" ${edit ? '' : 'disabled'}>Generalny wykonawca</button><button data-m="podw" class="${c.mode === 'podw' ? 'on' : ''}" ${edit ? '' : 'disabled'}>Wykonawca montażu</button></div>
            <div class="small muted">${c.mode === 'podw' ? 'Osoby z firmy wskazanej jako wykonawca montażu tworzą wpisy i zgłaszają je do zatwierdzenia. Zatwierdza KP, KB lub IB.' : 'Wpisy tworzy i zatwierdza zespół generalnego wykonawcy (KP, KB, IB). Podwykonawcy nie widzą dziennika.'}</div></div>
          <div class="banner info">${M.icon.shield}<span>Dziennik montażu to dokument wykonawcy – wymagany umową lub specyfikacją, nie ustawą (art. 3 pkt 13 Prawa budowlanego go nie wymienia; stan na 2.10.2026). Urzędowym dokumentem pozostaje <b>dziennik budowy</b>: papierowy albo w systemie EDB. Treść wpisu skopiujesz stąd jednym przyciskiem.</span></div>
          <div class="banner warn">${M.icon.alert}<span>Masa elementu jest <b>szacowana</b> z objętości (${nf(RHO, 1)} t/m³). Do doboru żurawia i zawiesi używaj mas z dokumentacji wytwórcy.</span></div></div></div>`;
      const frm = box.querySelector('#df');
      if (edit) { const save = M.debounce(() => saveCfg(Object.assign(cfg(), M.UI.read(frm))), 400); frm.querySelectorAll('[data-f]').forEach(el => el.addEventListener('input', save)); const mg = frm.querySelector('[data-f=manager]'); mg.addEventListener('change', () => { const t = (M.TEAM ? M.TEAM.all() : []).find(x => x.name === mg.value); if (t && t.lic) { frm.querySelector('[data-f=managerLic]').value = t.lic; save(); } }); box.querySelectorAll('#mode button').forEach(b => b.onclick = () => { saveCfg(Object.assign(cfg(), M.UI.read(frm), { mode: b.dataset.m })); M.refresh(); }); }
      else M.UI.lockForm(frm, true);
    },

    // ---------------- wpis ----------------
    detail(v, a) {
      const ed = editable(a); a.items = a.items || []; a.photos = a.photos || [];
      const orig = a.correctionOf ? M.S.get('assembly', a.correctionOf) : null; const corr = a.correctedBy ? M.S.get('assembly', a.correctedBy) : null;
      v.innerHTML = `<div class="page-head"><div><h1>Wpis <span class="acc">${e(a.nr)}</span> ${M.UI.st(ST, a.status)}</h1><div class="sub">Dziennik montażu · ${e(M.fmt(a.date))} ${e(M.weekday(a.date))}${a.createdBy ? ' · sporządził: ' + e(who(a.createdBy)) : ''}</div></div>
        <div class="actions"><button class="btn ghost" id="back">${M.icon.back}Lista</button><button class="btn" id="copy">${M.icon.copy}Kopiuj treść</button><button class="btn" id="pdf">${M.icon.print}Wpis PDF</button>
          ${a.status === 'szkic' && isAssembler() ? `<button class="btn primary" id="send">${M.icon.arrowR}Zgłoś do zatwierdzenia</button>` : ''}
          ${['szkic', 'zgloszony'].includes(a.status) && canApprove() ? `<button class="btn primary" id="appr">${M.icon.check}Zatwierdź wpis</button>` : ''}
          ${a.status === 'zgloszony' && canApprove() ? `<button class="btn" id="unsend">Cofnij do szkicu</button>` : ''}
          ${a.status === 'zatwierdzony' && canApprove() ? `<button class="btn" id="corr">${M.icon.edit}Korekta</button><button class="btn danger" id="cancel">${M.icon.x}Anuluj wpis</button>` : ''}
          ${a.status === 'szkic' && canWrite() ? `<button class="btn danger icon" id="del" title="Usuń szkic">${M.icon.trash}</button>` : ''}</div></div>
        ${orig ? `<div class="banner warn" style="margin-bottom:12px">${M.icon.edit}<span>Korekta wpisu <a href="#/montaz/wpis/${orig.id}"><b>${e(orig.nr)}</b></a>. Uzasadnienie: ${e(a.reason || '')}. Po zatwierdzeniu wpis ${e(orig.nr)} zostanie oznaczony jako skorygowany.</span></div>` : ''}
        ${corr ? `<div class="banner info" style="margin-bottom:12px">${M.icon.edit}<span>Wpis skorygowany wpisem <a href="#/montaz/wpis/${corr.id}"><b>${e(corr.nr)}</b></a>.</span></div>` : ''}
        ${a.status === 'anulowany' ? `<div class="banner or" style="margin-bottom:12px">${M.icon.x}<span>Wpis anulowany ${e(M.fmtTs(a.cancelledAt))} przez ${e(who(a.cancelledBy))}. Uzasadnienie: ${e(a.cancelReason || '')}</span></div>` : ''}
        ${a.status === 'zatwierdzony' && M.DZ && M.enabled('dziennik') ? (() => { const d = M.DZ.coverOf(a.id); return d ? `<div class="banner info" style="margin-bottom:12px">${M.icon.link}<span>Ujęty w dzienniku budowy: <a href="#/dziennik/wpis/${d.id}"><b>${e(d.nr)}</b></a> z dnia ${M.fmt(d.date)}.</span></div>` : `<div class="banner warn" style="margin-bottom:12px">${M.icon.alert}<span class="grow">Ten wpis nie jest jeszcze ujęty w dzienniku budowy.</span>${M.P.canEdit('dziennik') ? '<button class="btn sm primary" id="toDB">Przygotuj wpis do dziennika budowy</button>' : ''}</div>`; })() : ''}
        ${a.status === 'zatwierdzony' ? `<div class="banner ok" style="margin-bottom:12px">${M.icon.lock}<span>Zatwierdzony ${e(M.fmtTs(a.approvedAt))} przez ${e(who(a.approvedBy))}. Edycja zablokowana – zmiana tylko przez korektę z uzasadnieniem.</span></div>` : ''}
        <div class="grid2" style="align-items:start" id="frm">
          <div class="col">
            <div class="card"><div class="card-head"><h2>Zamontowane elementy</h2><span class="badge or" id="cnt"></span>${ed ? `<button class="btn soft sm" id="ai">${M.icon.spark}AI: z notatki</button><button class="btn primary sm" id="addEl">${M.icon.plus}Dodaj elementy</button>` : ''}</div><div id="items"></div></div>
            <div class="card card-pad col"><h2>Zdjęcia</h2><div id="ph"></div></div>
          </div>
          <div class="col">
            <div class="card card-pad col"><h2>Dzień i zasoby</h2>
              <div class="grid3"><label class="f">Data montażu<input type="date" data-f="date" value="${e(a.date)}" max="${M.todayISO()}"></label><label class="f">Brygada [os.]<input type="number" min="0" data-f="crew" value="${e(a.crew ?? '')}"></label><label class="f">Godziny pracy<input type="text" data-f="hours" value="${e(a.hours || '')}" placeholder="7:00–16:00"></label></div>
              <label class="f">Żuraw / sprzęt<input type="text" data-f="crane" value="${e(a.crane || '')}" placeholder="np. żuraw samojezdny 100 t, podnośnik nożycowy"></label>
              <div class="row"><b class="small grow">Pogoda: <span id="wxt" style="font-weight:500">${e(M.weatherTxt ? M.weatherTxt(a.weather) : '') || '—'}</span></b>${ed ? `<button class="btn sm" id="wx">${M.icon.weather}Pobierz pogodę</button>` : ''}</div>
              <label class="f">Pogoda – uwagi własne (np. przerwa z powodu wiatru)<input type="text" data-f="weatherNote" value="${e(a.weatherNote || '')}"></label>
            </div>
            <div class="card card-pad col"><h2>Kontrola</h2>
              <div class="grid2"><label class="f">Pomiar geodezyjny<select data-f="geo">${M.UI.opts(GEO, a.geo, '—')}</select></label><label class="f">Nr szkicu / operatu<input type="text" data-f="geoRef" value="${e(a.geoRef || '')}"></label></div>
              <div class="grid2"><label class="f">Odchyłki montażowe<select data-f="dev">${M.UI.opts(ODCH, a.dev, '—')}</select></label><label class="f">Opis odchyłek<input type="text" data-f="devNote" value="${e(a.devNote || '')}"></label></div>
              <label class="f">Połączenia (podlewki, skręcanie, spawanie, zalanie styków)<input type="text" data-f="joints" value="${e(a.joints || '')}"></label>
              <label class="f">Dostawy i dokumenty (nr WZ, deklaracje, atesty)<input type="text" data-f="docs" value="${e(a.docs || '')}"></label>
              <label class="f">Uszkodzenia / naprawy elementów<input type="text" data-f="damage" value="${e(a.damage || '')}"></label>
              <div class="row"><b class="small grow">Uwagi</b>${ed ? `<button class="btn sm" id="wzm">${M.icon.doc}Typowy zapis</button><button class="btn sm" id="dict">${M.icon.mic}Dyktuj</button>` : ''}</div><textarea data-f="remarks" id="rem" rows="3">${e(a.remarks || '')}</textarea>
            </div>
            <div class="card card-pad col"><div class="row"><h2 class="grow">Treść wpisu</h2><span class="badge">składa program z danych</span></div><div class="dm-text" id="txt"></div><div class="small muted">Ten tekst wkleisz do dziennika budowy lub EDB. Żeby go zmienić, popraw dane powyżej.</div></div>
          </div>
        </div>`;
      const frm = v.querySelector('#frm');
      const text = () => a.status === 'zatwierdzony' || a.status === 'skorygowany' || a.status === 'anulowany' ? (a.text || genText(a)) : genText(a);
      const redrawText = () => { v.querySelector('#txt').textContent = text(); v.querySelector('#cnt').textContent = itemsCount(a) + ' szt.'; };
      const save = M.debounce(() => { Object.assign(a, M.UI.read(frm)); M.S.upsert('assembly', a); redrawText(); }, 350);
      const saveNow = () => { if (ed) Object.assign(a, M.UI.read(frm)); M.S.upsert('assembly', a); };
      const drawItems = () => {
        const ex = [a.id]; if (a.correctionOf) ex.push(a.correctionOf); const d = doneMap(ex);
        v.querySelector('#items').innerHTML = a.items.length ? `<div class="table-wrap"><table class="list dm-items"><thead><tr><th>Element</th><th style="width:84px">Szt.</th><th style="width:30%">Osie</th><th class="hide-m">Uwaga</th>${ed ? '<th></th>' : ''}</tr></thead><tbody>${a.items.map((i, k) => { const el = elOf(i.elementId); const left = el ? el.qty - (d.get(el.id) || 0) : 0; const over = el && ed && (a.items.filter(x => x.elementId === i.elementId).reduce((s, x) => s + (Number(x.n) || 0), 0) > left);
          return `<tr data-k="${k}"><td><b>${e(itemName(i))}</b><div class="xs muted">${e([itemGroup(i), itemDraw(i) ? 'rys. ' + itemDraw(i) : ''].filter(Boolean).join(' · '))}${el && ed ? ` · do zamontowania: <b class="dm-left ${over ? 'dm-over' : ''}">${left}</b> z ${el.qty}` : ''}</div></td><td><input type="number" min="1" step="1" data-i="n" value="${e(i.n)}" ${ed ? '' : 'disabled'} class="${over ? 'dm-bad' : ''}"></td><td><input type="text" data-i="axes" value="${e(i.axes || '')}" placeholder="np. 1–6 / A" ${ed ? '' : 'disabled'}></td><td class="hide-m"><input type="text" data-i="note" value="${e(i.note || '')}" ${ed ? '' : 'disabled'}></td>${ed ? `<td><button class="btn icon ghost sm" data-del title="Usuń">${M.icon.x}</button></td>` : ''}</tr>`; }).join('')}</tbody></table></div>` : M.UI.empty(ed ? 'Dodaj elementy zamontowane tego dnia. Jeśli montażu nie było, opisz powód w uwagach.' : 'Bez montażu elementów.', 'cube');
        v.querySelectorAll('#items tr[data-k]').forEach(tr => { const i = a.items[+tr.dataset.k];
          tr.querySelectorAll('[data-i]').forEach(el => { el.oninput = () => { i[el.dataset.i] = el.dataset.i === 'n' ? (el.value === '' ? '' : Number(el.value)) : el.value; save(); }; if (el.dataset.i === 'n') el.addEventListener('input', hints); });
          const x = tr.querySelector('[data-del]'); if (x) x.onclick = () => { a.items.splice(+tr.dataset.k, 1); saveNow(); drawItems(); redrawText(); }; });
      };
      /** podświetla przekroczenie liczby sztuk bez przerysowywania tabeli (nie gubi kursora) */
      function hints() {
        const ex = [a.id]; if (a.correctionOf) ex.push(a.correctionOf); const d = doneMap(ex);
        v.querySelectorAll('#items tr[data-k]').forEach(tr => { const i = a.items[+tr.dataset.k]; const el = elOf(i.elementId); if (!el) return; const left = el.qty - (d.get(el.id) || 0); const over = a.items.filter(x => x.elementId === i.elementId).reduce((s, x) => s + (Number(x.n) || 0), 0) > left; tr.querySelector('[data-i=n]').classList.toggle('dm-bad', over); const b = tr.querySelector('.dm-left'); if (b) b.classList.toggle('dm-over', over); });
      }
      drawItems(); redrawText();
      if (ed) frm.querySelectorAll('[data-f]').forEach(el => el.addEventListener('input', save)); else M.UI.lockForm(frm, true);
      M.UI.photos(v.querySelector('#ph'), a.photos, { editable: ed, onChange: () => M.S.upsert('assembly', a) });
      const on = (id, fn) => { const b = v.querySelector(id); if (b) b.onclick = fn; };
      on('#back', () => M.go('montaz'));
      on('#wzm', () => M.UI.menu(v.querySelector('#wzm'), M.WZ.DM.map(w => ({ label: w.n, icon: 'doc', run: () => { const f = (t) => (t || '').split('[data]').join(M.fmt(a.date)); const r = v.querySelector('#rem'); if (w.r) r.value = (r.value ? r.value + '\n' : '') + f(w.r); const j = v.querySelector('[data-f=joints]'); if (w.j && !j.value) j.value = f(w.j); const dc = v.querySelector('[data-f=docs]'); if (w.d && !dc.value) dc.value = f(w.d); r.dispatchEvent(new Event('input')); } }))));
      on('#toDB', () => { M.go('dziennik'); setTimeout(() => M.modules.dziennik.fromAssembly(), 60); });
      on('#ai', () => { saveNow(); this.aiFill(a, () => this.detail(v, a)); });
      on('#copy', () => M.copy(`${a.nr} – ${text()}`, 'Skopiowano treść wpisu'));
      on('#pdf', async () => M.UI.docPreview(`Dziennik montażu – wpis ${a.nr}`, M.PR.header('Dziennik montażu', `${cfg().nr ? 'nr ' + cfg().nr + ' · ' : ''}pojedynczy wpis`) + CSS_TAG + await this.htmlEntry(a)));
      on('#addEl', () => this.pickElements(a, () => { saveNow(); drawItems(); redrawText(); }));
      const dict = v.querySelector('#dict'); if (dict) M.UI.dictate(dict, v.querySelector('#rem'));
      on('#wx', async () => { try { const p = M.S.project; saveNow(); a.weather = await M.fetchWeather(a.date, p.lat, p.lon); M.S.upsert('assembly', a); v.querySelector('#wxt').textContent = M.weatherTxt(a.weather); redrawText(); M.toast('Pobrano pogodę'); } catch (err) { M.toast(err.message, 'err'); } });
      on('#del', async () => { if (await M.UI.confirm('Usunąć szkic wpisu?', 'Usuń', true)) { M.S.remove('assembly', a.id); M.go('montaz'); } });
      on('#send', () => { saveNow(); const r = validate(a); if (r.err.length) return this.showCheck(r); a.status = 'zgloszony'; a.sentAt = Date.now(); M.S.upsert('assembly', a); M.toast('Zgłoszono do zatwierdzenia'); this.detail(v, a); });
      on('#unsend', () => { a.status = 'szkic'; M.S.upsert('assembly', a); this.detail(v, a); });
      on('#appr', async () => {
        saveNow(); const r = validate(a); if (r.err.length) return this.showCheck(r);
        if (!await M.UI.confirm(`${r.warn.length ? `<div class="banner warn" style="margin-bottom:10px">${M.icon.alert}<span>${r.warn.map(e).join('<br>')}</span></div>` : ''}Zatwierdzić wpis <b>${e(a.nr)}</b>? Po zatwierdzeniu nie będzie można go edytować – tylko skorygować albo anulować z uzasadnieniem.`, 'Zatwierdź')) return;
        a.items.forEach(i => { const el = elOf(i.elementId); i.name = el.name; i.drawing = el.drawing || ''; i.group = el.group || ''; }); // zamrożenie nazw
        a.stateAfter = null; a.stateAfter = stateAfter(a); a.status = 'zatwierdzony'; a.approvedBy = M.S.settings.currentUser; a.approvedAt = Date.now(); a.text = genText(a);
        M.S.upsert('assembly', a);
        if (a.correctionOf) { const o = M.S.get('assembly', a.correctionOf); if (o) { o.status = 'skorygowany'; o.correctedBy = a.id; M.S.upsert('assembly', o); } }
        M.toast('Wpis zatwierdzony'); this.detail(v, a);
      });
      on('#corr', async () => {
        if (entries().some(x => x.correctionOf === a.id && ['szkic', 'zgloszony'].includes(x.status))) return M.toast('Korekta tego wpisu jest już w przygotowaniu', 'warn');
        const reason = await askText(`Korekta wpisu ${a.nr}`, 'Uzasadnienie korekty', 'Utwórz korektę'); if (!reason) return;
        const c = M.clone(a); ['id', 'nr', 'created', 'createdBy', 'updated', 'approvedBy', 'approvedAt', 'text', 'stateAfter', 'correctedBy'].forEach(k => delete c[k]);
        c.items.forEach(i => { delete i.name; delete i.drawing; delete i.group; }); c.photos = [];
        this.newEntry(Object.assign(c, { nr: M.S.nextNr('assembly', 'DM'), status: 'szkic', correctionOf: a.id, reason }));
      });
      on('#cancel', async () => { const reason = await askText(`Anulowanie wpisu ${a.nr}`, 'Uzasadnienie anulowania', 'Anuluj wpis'); if (!reason) return; a.status = 'anulowany'; a.cancelReason = reason; a.cancelledBy = M.S.settings.currentUser; a.cancelledAt = Date.now(); M.S.upsert('assembly', a); M.toast('Wpis anulowany'); this.detail(v, a); });
    },
    showCheck(r) { M.UI.modal({ title: 'Wpis wymaga poprawy', body: `<div class="banner or">${M.icon.alert}<span>Program sprawdził zgodność wpisu z rejestrem elementów:</span></div><ul>${r.err.map(x => `<li>${e(x)}</li>`).join('')}</ul>` }); },
    /** AI: z notatki, dyktowania lub zdjęcia dokumentu WZ → pozycje wpisu. AI tylko PROPONUJE:
        nazwy są dopasowywane do rejestru, a liczby sprawdza program przy zatwierdzaniu. */
    aiFill(a, done) {
      const ex = [a.id]; if (a.correctionOf) ex.push(a.correctionOf); const d = doneMap(ex); const all = els();
      const find = (name) => { const n = M.norm(name); return all.find(x => M.norm(x.name) === n) || all.find(x => n && (M.norm(x.name).endsWith(' ' + n) || M.norm(x.name).includes(n))) || null; };
      M.AI.open({ key: 'montaz', title: 'Asystent AI – wpis do dziennika montażu', photos: a.photos, photoPrefix: a.nr,
        prompt: M.AI.fill('montaz', { PROJEKT: M.S.project.name, DATA: M.fmt(a.date), RODZAJ: KIND[cfg().kind][0], ELEMENTY: all.map(x => `- ${x.name}${x.drawing ? ' | rys. ' + x.drawing : ''} | ${x.group || ''} | zostało ${x.qty - (d.get(x.id) || 0)} z ${x.qty}`).join('\n'), NOTATKI: a.remarks, ZDJECIA: M.AI.photoList(a.photos) }),
        parse: (t) => { const j = M.extractJSON(t); return j && Array.isArray(j.elementy) ? j : null; },
        preview: (j) => `<table class="list"><thead><tr><th>Element</th><th>Szt.</th><th>Osie</th><th></th></tr></thead><tbody>${j.elementy.map(i => { const el = find(i.nazwa); const left = el ? el.qty - (d.get(el.id) || 0) : 0; return `<tr><td>${e(el ? el.name : i.nazwa)}</td><td>${e(i.szt)}</td><td>${e(i.osie || '')}</td><td>${!el ? '<span class="st open">brak w rejestrze – pominę</span>' : Number(i.szt) > left ? `<span class="st check">zostało tylko ${left}</span>` : '<span class="st done">ok</span>'}</td></tr>`; }).join('')}</tbody></table><div class="small muted" style="margin-top:6px">Pozycje zostaną dopisane do wpisu. Sprawdź liczby i osie – program zablokuje zatwierdzenie, jeśli nie zgadzają się z rejestrem.</div>`,
        applyLabel: 'Dopisz do wpisu',
        apply: (j) => { let n = 0; j.elementy.forEach(i => { const el = find(i.nazwa); if (!el || !(Number(i.szt) > 0)) return; a.items.push({ elementId: el.id, n: Math.round(Number(i.szt)), axes: String(i.osie || ''), note: String(i.uwaga || '') }); n++; });
          const set = (k, v) => { if (v != null && v !== '' && !a[k]) a[k] = v; }; set('crew', Number(j.brygada) || ''); set('crane', j.sprzet); set('hours', j.godziny); set('joints', j.polaczenia); set('docs', j.dokumenty); set('damage', j.uszkodzenia); if (j.uwagi) a.remarks = j.uwagi;
          M.S.upsert('assembly', a); M.toast(`Dopisano ${n} ${M.plural(n, 'pozycję', 'pozycje', 'pozycji')}`); done(); } });
    },
    /** AI układa PROJEKT całego dziennika (szkice wpisów dzień po dniu). Liczby sprawdza program;
        daty i treść weryfikuje kierownik – AI nie wie, co faktycznie zamontowano. */
    aiPlan() {
      const all = els(); if (!all.length) return M.toast('Najpierw zaimportuj listę elementów', 'warn');
      const used = sumMap(['zatwierdzony', 'szkic', 'zgloszony']); const left = (x) => x.qty - (used.get(x.id) || 0); const todo = all.filter(x => left(x) > 0);
      if (!todo.length) return M.toast('Wszystkie elementy są już ujęte we wpisach');
      const prev = entries().filter(a => a.status !== 'anulowany').pop(); const c = cfg(); const p = M.S.project;
      const tasks = M.S.all('tasks').filter(t => /monta|prefab|konstrukc|stal/i.test(t.name || ''));
      const m = M.UI.modal({ title: 'AI: ułóż dziennik montażu', wide: true, body: `<div class="col" id="pf">
          <div class="banner warn">${M.icon.alert}<span>AI ułoży <b>projekt</b> dziennika: szkice wpisów dzień po dniu z elementów, których jeszcze nie ma we wpisach (${todo.reduce((s, x) => s + left(x), 0)} szt.). AI nie wie, co faktycznie zamontowano. Każdy szkic sprawdź z rzeczywistym przebiegiem (WZ, pomiary, zdjęcia), popraw datę i dopiero zatwierdź.</span></div>
          <div class="grid4"><label class="f">Montaż od<input type="date" data-f="from" value="${e(c.started || p.start || M.todayISO())}"></label><label class="f">Montaż do<input type="date" data-f="to" value="${M.todayISO()}"></label><label class="f">Dni pracy<select data-f="days">${M.UI.opts([['pn–pt', 'poniedziałek–piątek'], ['pn–sob', 'poniedziałek–sobota'], ['codziennie', 'codziennie']], 'pn–pt')}</select></label><label class="f">Brygada [os.]<input type="number" data-f="crew" value="${e(prev ? prev.crew : '')}"></label></div>
          <label class="f">Żuraw / sprzęt<input type="text" data-f="crane" value="${e(prev ? prev.crane || '' : '')}"></label>
          <label class="f">Kolejność i przebieg montażu – opisz własnymi słowami<textarea data-f="notes" rows="5" placeholder="np. Słupy od osi 1 do 16, rzędami A, B, C – po ok. 8 dziennie. Belki podwalinowe po słupach, od osi A. 26.09 przerwa – wiatr. Dostawy: 23.09 słupy S-01, 24.09 S-02…"></textarea></label>
          ${tasks.length ? `<label class="check"><input type="checkbox" data-f="useTasks" checked>Dołącz terminy z harmonogramu (${tasks.length} ${M.plural(tasks.length, 'zadanie', 'zadania', 'zadań')} montażowych)</label>` : ''}</div>`, footer: `<span class="small muted grow">Dalej: kopiujesz prompt do AI i wklejasz wynik.</span><button class="btn primary" id="go">${M.icon.spark}Dalej</button>` });
      m.querySelector('#go').onclick = () => {
        const f = M.UI.read(m.querySelector('#pf')); if (!f.from || !f.to || f.from > f.to) return M.toast('Podaj poprawny okres montażu', 'warn'); m.close();
        const find = (name) => { const n = M.norm(name); return all.find(x => M.norm(x.name) === n) || all.find(x => n && M.norm(x.name).endsWith(' ' + n)) || null; };
        const plan = (j) => { const cnt = new Map(); return (j.wpisy || []).map(w => { const date = M.parseDate(w.data); const items = (w.elementy || []).map(i => { const el = find(i.nazwa); const n = Math.round(Number(i.szt) || 0); let ok = !!el && n > 0, why = !el ? 'brak w rejestrze' : n <= 0 ? 'brak liczby sztuk' : ''; if (ok) { const sofar = cnt.get(el.id) || 0; if (sofar + n > left(el)) { ok = false; why = `za dużo: zostało ${left(el) - sofar}`; } else cnt.set(el.id, sofar + n); } return { el, n, axes: String(i.osie || ''), ok, why, raw: i.nazwa }; }); return { date, okDate: !!date && date <= M.todayISO(), items, remarks: String(w.uwagi || '') }; }).filter(w => w.items.length || w.remarks).sort((a, b) => (a.date || '').localeCompare(b.date || '')); };
        M.AI.open({ key: 'montaz_plan', title: 'Asystent AI – projekt dziennika montażu',
          prompt: M.AI.fill('montaz_plan', { PROJEKT: p.name, RODZAJ: KIND[c.kind][0], OD: M.fmt(f.from), DO: M.fmt(f.to), DNI: f.days, BRYGADA: f.crew, SPRZET: f.crane, ELEMENTY: todo.map(x => `- ${x.name}${x.drawing ? ' | ' + x.drawing : ''} | ${x.group || ''} | do rozpisania: ${left(x)} szt.`).join('\n'), HARMONOGRAM: f.useTasks ? tasks.map(t => `- ${t.name}: ${M.fmt(t.start)}–${M.fmt(t.end)}`).join('\n') : '', NOTATKI: f.notes }),
          parse: (t) => { const j = M.extractJSON(t); return j && Array.isArray(j.wpisy) && j.wpisy.length ? j : null; },
          preview: (j) => { const pl = plan(j); const okN = pl.reduce((s, w) => s + w.items.filter(i => i.ok).reduce((q, i) => q + i.n, 0), 0); const bad = pl.reduce((s, w) => s + w.items.filter(i => !i.ok).length, 0); const tot = todo.reduce((s, x) => s + left(x), 0);
            return `<div class="banner ${bad || okN < tot ? 'warn' : 'ok'}">${M.icon.check}<span><b>${pl.length}</b> ${M.plural(pl.length, 'wpis', 'wpisy', 'wpisów')}, rozpisano <b>${okN}</b> z ${tot} szt.${bad ? ` Pominę ${bad} ${M.plural(bad, 'pozycję', 'pozycje', 'pozycji')} z błędem.` : ''}${okN < tot ? ' Reszta zostaje do wpisania ręcznie.' : ''}</span></div><div class="table-wrap" style="max-height:40vh"><table class="list"><tbody>${pl.map(w => `<tr class="dm-g"><td colspan="3"><b>${w.date ? M.fmt(w.date) + ' ' + e(M.weekday(w.date)) : 'brak daty'}</b>${w.okDate ? '' : ' <span class="st open">data do poprawy</span>'}${w.remarks ? `<div class="xs muted" style="font-weight:500">${e(w.remarks)}</div>` : ''}</td></tr>` + w.items.map(i => `<tr><td>${e(i.el ? i.el.name : i.raw)}</td><td class="num">${i.n} szt.</td><td class="small">${e(i.axes)}${i.ok ? '' : ` <span class="st open">${e(i.why)}</span>`}</td></tr>`).join('')).join('')}</tbody></table></div>`; },
          applyLabel: 'Utwórz szkice wpisów',
          apply: (j) => { const pl = plan(j); let n = 0; pl.forEach(w => { const items = w.items.filter(i => i.ok).map(i => ({ elementId: i.el.id, n: i.n, axes: i.axes, note: '' })); if (!items.length && !w.remarks) return; M.S.upsert('assembly', { nr: M.S.nextNr('assembly', 'DM'), date: w.okDate ? w.date : M.todayISO(), status: 'szkic', ai: true, items, crew: f.crew || '', crane: f.crane || '', hours: prev ? prev.hours || '' : '', weather: null, weatherNote: '', geo: '', geoRef: '', dev: '', devNote: '', joints: '', docs: '', damage: '', remarks: w.remarks, photos: [] }, true); n++; });
            M.S.touch('assembly'); M.toast(`Utworzono ${n} ${M.plural(n, 'szkic', 'szkice', 'szkiców')} – sprawdź każdy i zatwierdź`); M.go('montaz/wpisy'); M.refresh(); } });
      };
    },
    /** okno wyboru elementów: szukanie + grupy; kliknięcie dodaje pozycję do wpisu */
    pickElements(a, done) {
      const ex = [a.id]; if (a.correctionOf) ex.push(a.correctionOf); const d = doneMap(ex); const all = els(); const groups = [...new Set(all.map(x => x.group || ''))]; let g = '';
      const m = M.UI.modal({ title: 'Dodaj elementy do wpisu', wide: true, onClose: done, body: `<div class="col"><div class="row"><div class="search grow">${M.icon.search}<input type="search" id="q" placeholder="Szukaj: nazwa, nr rysunku…"></div></div><div class="chips" id="gr"></div><div class="table-wrap" style="max-height:48vh"><table class="list"><tbody id="tb"></tbody></table></div></div>`, footer: `<span class="small muted grow" id="info"></span><button class="btn primary" id="ok">Gotowe</button>` });
      const draw = () => {
        const q = M.norm(m.querySelector('#q').value);
        m.querySelector('#gr').innerHTML = [['', 'Wszystkie'], ...groups.map(x => [x, x || 'Elementy'])].map(([k, l]) => `<button class="chip ${g === k ? 'on' : ''}" data-g="${e(k)}">${e(l)}</button>`).join('');
        m.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { g = b.dataset.g; draw(); });
        const rows = all.filter(x => (!g || (x.group || '') === g) && (!q || M.norm(`${x.name} ${x.drawing}`).includes(q)));
        m.querySelector('#tb').innerHTML = rows.map(x => { const inE = a.items.filter(i => i.elementId === x.id).reduce((s, i) => s + (Number(i.n) || 0), 0); const left = x.qty - (d.get(x.id) || 0) - inE;
          return `<tr><td><b>${e(x.name)}</b><div class="xs muted">${e([x.group, x.drawing ? 'rys. ' + x.drawing : ''].filter(Boolean).join(' · '))}</div></td><td class="small nowrap" style="text-align:right">${left > 0 ? `zostało <b>${left}</b> z ${x.qty}` : '<span class="st done">komplet</span>'}${inE ? `<div class="xs" style="color:var(--or-700)">w tym wpisie: ${inE}</div>` : ''}</td><td style="width:1%"><button class="btn sm ${left > 0 ? 'soft' : ''}" data-add="${x.id}" ${left > 0 ? '' : 'disabled'}>${M.icon.plus}Dodaj</button></td></tr>`; }).join('') || `<tr><td>${M.UI.empty('Brak elementów.', 'search')}</td></tr>`;
        m.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const last = a.items[a.items.length - 1]; a.items.push({ elementId: b.dataset.add, n: 1, axes: last ? last.axes : '', note: '' }); draw(); });
        m.querySelector('#info').textContent = `We wpisie: ${a.items.length} ${M.plural(a.items.length, 'pozycja', 'pozycje', 'pozycji')}, ${itemsCount(a)} szt. Liczbę sztuk i osie wpiszesz w tabeli wpisu.`;
      };
      m.querySelector('#q').oninput = draw; m.querySelector('#ok').onclick = () => m.close(); draw();
    },

    // ---------------- wydruki ----------------
    async htmlEntry(a) {
      const c = cfg(); const sa = stateAfter(a); const dead = a.status === 'anulowany' || a.status === 'skorygowany';
      const orig = a.correctionOf ? M.S.get('assembly', a.correctionOf) : null;
      const cell = (l, t) => `<div><span>${l}</span>${e(t) || '<i>—</i>'}</div>`;
      return `<section class="dm-e ${dead ? 'dead' : ''}">
        <div class="dm-eh"><div class="nr">${e(a.nr)}</div><div class="dt"><b>${M.fmt(a.date)}</b> ${e(M.weekday(a.date))}</div><div class="tot">${itemsCount(a) ? itemsCount(a) + ' szt.' : 'bez montażu'}</div><div class="stt">${e(ST[a.status][0])}</div></div>
        ${orig ? `<div class="dm-note">Korekta wpisu ${e(orig.nr)} z dnia ${M.fmt(orig.date)}. Uzasadnienie: ${e(a.reason || '')}</div>` : ''}
        ${a.status === 'anulowany' ? `<div class="dm-note">Wpis anulowany ${e(M.fmtTs(a.cancelledAt))}. Uzasadnienie: ${e(a.cancelReason || '')}</div>` : ''}
        ${a.status === 'skorygowany' ? `<div class="dm-note">Wpis skorygowany wpisem ${e((M.S.get('assembly', a.correctedBy) || {}).nr || '')}.</div>` : ''}
        <div class="dm-meta">${cell('Pogoda', wxTxt(a))}${cell('Brygada', a.crew ? a.crew + ' os.' : '')}${cell('Żuraw / sprzęt', a.crane)}${cell('Godziny pracy', a.hours)}</div>
        ${(a.items || []).length ? `<table class="dm-t"><thead><tr><th style="width:8mm">Lp.</th><th>Element</th><th style="width:32mm">Nr rys. / poziom</th><th style="width:13mm" class="r">Szt.</th><th style="width:38mm">Osie</th><th>Uwagi</th></tr></thead><tbody>${a.items.map((i, k) => `<tr><td class="c">${k + 1}</td><td><b>${e(itemName(i))}</b><div class="g">${e(itemGroup(i))}</div></td><td>${e(itemDraw(i))}</td><td class="r"><b>${e(i.n)}</b></td><td>${e(i.axes || '')}</td><td>${e(i.note || '')}</td></tr>`).join('')}</tbody></table>` : ''}
        <div class="dm-ctl">${cell('Pomiar geodezyjny', [(GEO.find(g => g[0] === a.geo) || [])[1], a.geoRef].filter(Boolean).join(', '))}${cell('Odchyłki montażowe', [a.dev, a.devNote].filter(Boolean).join(' – '))}${cell('Połączenia', a.joints)}${cell('Dostawy i dokumenty', a.docs)}${a.damage ? cell('Uszkodzenia / naprawy', a.damage) : ''}</div>
        ${a.remarks ? `<div class="dm-rem"><span>Uwagi</span><div class="pre">${e(a.remarks)}</div></div>` : ''}
        ${sa.length ? `<div class="dm-st"><span>Stan po wpisie</span>${sa.map(s => `<div class="b"><em>${e(s.group)}</em><i><u style="width:${pct(s.done, s.qty)}%"></u></i><b>${s.done} / ${s.qty} szt.</b></div>`).join('')}</div>` : ''}
        ${a.photos && a.photos.length ? await M.PR.pics(a.photos) : ''}
        <div class="dm-sg"><div><span>Sporządził</span>${e(who(a.createdBy)) || '&nbsp;'}<small>${e(M.fmtTs(a.created))}</small></div><div><span>Zatwierdził</span>${e(who(a.approvedBy)) || '&nbsp;'}<small>${e(M.fmtTs(a.approvedAt)) || '&nbsp;'}</small></div><div><span>Inspektor nadzoru – zapoznałem się</span>&nbsp;<small>data i podpis</small></div></div>
      </section>`;
    },
    htmlProgress() {
      const all = els(); const d = doneMap(); const groups = [...new Set(all.map(x => x.group || ''))];
      return `<table class="dm-t dm-p"><thead><tr><th style="width:11mm">Lp.</th><th>Element</th><th style="width:32mm">Nr rys. / poziom</th><th class="r" style="width:15mm">Ilość</th><th class="r" style="width:17mm">Zamont.</th><th class="r" style="width:16mm">Zostało</th><th style="width:30mm">Postęp</th></tr></thead><tbody>${groups.map(g => { const inG = all.filter(x => (x.group || '') === g); const gq = inG.reduce((s, x) => s + x.qty, 0), gd = inG.reduce((s, x) => s + (d.get(x.id) || 0), 0);
        return `<tr class="grp-r"><td colspan="3">${e(g || 'Elementy')}</td><td class="r">${gq}</td><td class="r">${gd}</td><td class="r">${gq - gd}</td><td><i class="bar"><u style="width:${pct(gd, gq)}%"></u></i> ${pct(gd, gq)}%</td></tr>` + inG.map(x => { const dn = d.get(x.id) || 0; return `<tr><td class="c">${e(x.lp || '')}</td><td>${e(x.name)}</td><td>${e(x.drawing || '')}</td><td class="r">${x.qty}</td><td class="r">${dn || ''}</td><td class="r">${x.qty - dn || ''}</td><td>${dn ? `<i class="bar"><u style="width:${pct(dn, x.qty)}%"></u></i>` : ''}${dn >= x.qty ? ' ✓' : ''}</td></tr>`; }).join(''); }).join('')}</tbody></table>`;
    },
    async htmlBook() {
      const c = cfg(); const p = M.S.project; const t = totals(); const list = entries().filter(a => a.status !== 'szkic' && a.status !== 'zgloszony'); const drafts = entries().length - list.length;
      const row = (l, v2) => `<tr><td>${l}</td><td>${e(v2) || '&nbsp;'}</td></tr>`;
      const first = list.find(a => a.status === 'zatwierdzony'); const last = list.filter(a => a.status === 'zatwierdzony').pop();
      const blocks = []; for (const a of list) blocks.push(await this.htmlEntry(a));
      return `${CSS_TAG}
        <div class="dm-cover"><img src="assets/logo-tek-full.svg" alt=""><div class="k">${e(KIND[c.kind][0])}</div><h1>DZIENNIK MONTAŻU</h1><div class="n">${c.nr ? 'nr ' + e(c.nr) : '&nbsp;'}</div>
          <table class="dm-kv">${row('Obiekt', p.name)}${row('Adres budowy', p.address)}${row('Inwestor', p.investor)}${row('Generalny wykonawca', (M.S.companies('gw')[0] || {}).name)}${row('Wykonawca montażu', c.companyId ? M.S.respName(c.companyId) : '')}${row('Wytwórca elementów', c.maker)}${row('Kierownik budowy', c.kb)}${row('Kierownik montażu / robót', [c.manager, c.managerLic ? 'upr. nr ' + c.managerLic : ''].filter(Boolean).join(', '))}${row('Inspektor nadzoru inwestorskiego', c.inspector)}${row('Podstawa montażu', c.basis)}${row('Dziennik budowy nr', p.edb)}${row('Rozpoczęcie montażu', M.fmt(c.started || (first && first.date)))}${row('Ostatni wpis', last ? `${last.nr} z dnia ${M.fmt(last.date)}` : '')}</table>
          <div class="dm-sum"><div><b>${t.q}</b><span>elementów do montażu</span></div><div><b>${t.dn}</b><span>zamontowano</span></div><div><b>${pct(t.dn, t.q)}%</b><span>zaawansowanie</span></div><div><b>${list.filter(a => a.status === 'zatwierdzony').length}</b><span>wpisów</span></div></div>
          <div class="dm-law">Dokument wykonawcy prowadzony jako uzupełnienie dziennika budowy. Wpisy dokonywane są w porządku chronologicznym; wpisu zatwierdzonego nie zmienia się – błąd prostuje się kolejnym wpisem (korektą) z uzasadnieniem. Stan na dzień ${M.fmt(M.todayISO())}.${drafts ? ` Wydruk nie obejmuje ${drafts} ${M.plural(drafts, 'wpisu roboczego', 'wpisów roboczych', 'wpisów roboczych')}.` : ''}</div></div>
        <div class="dm-page"><h2>Zestawienie elementów i postęp montażu</h2>${els().length ? this.htmlProgress() : '<p class="muted">Brak elementów w rejestrze.</p>'}</div>
        <div class="dm-page"><h2>Wpisy</h2>${blocks.join('') || '<p class="muted">Brak zatwierdzonych wpisów.</p>'}</div>`;
    },
    async excel() {
      const wb = new ExcelJS.Workbook(); const d = doneMap();
      const w1 = wb.addWorksheet('Elementy i postęp', { views: [{ state: 'frozen', ySplit: 1 }] });
      w1.columns = [['Lp.', 8], ['Grupa', 28], ['Element', 36], ['Nr rys. / poziom', 18], ['Obj. 1 szt. [m3]', 14], ['Ilość', 9], ['Zamontowano', 13], ['Zostało', 10], ['%', 7]].map(([header, width]) => ({ header, width }));
      els().forEach(x => { const dn = d.get(x.id) || 0; w1.addRow([x.lp, x.group, x.name, x.drawing, x.vol === '' ? null : x.vol, x.qty, dn, x.qty - dn, pct(dn, x.qty)]); });
      const w2 = wb.addWorksheet('Wpisy', { views: [{ state: 'frozen', ySplit: 1 }] });
      w2.columns = [['Nr wpisu', 10], ['Data', 12], ['Status', 14], ['Element', 36], ['Nr rys. / poziom', 18], ['Szt.', 7], ['Osie', 18], ['Uwaga', 28], ['Brygada', 9], ['Sprzęt', 26], ['Pogoda', 40], ['Pomiar geod.', 16], ['Odchyłki', 16]].map(([header, width]) => ({ header, width }));
      entries().forEach(a => { const base = [a.crew || '', a.crane || '', wxTxt(a), [a.geo, a.geoRef].filter(Boolean).join(', '), [a.dev, a.devNote].filter(Boolean).join(' – ')]; if (!(a.items || []).length) w2.addRow([a.nr, M.fmt(a.date), ST[a.status][0], '(bez montażu)', '', '', '', a.remarks || '', ...base]); (a.items || []).forEach(i => w2.addRow([a.nr, M.fmt(a.date), ST[a.status][0], itemName(i), itemDraw(i), Number(i.n) || 0, i.axes || '', i.note || '', ...base])); });
      [w1, w2].forEach(w => { w.getRow(1).font = { bold: true }; w.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECEEEF' } }; });
      M.download(new Blob([await wb.xlsx.writeBuffer()]), `Dziennik_montazu_${M.safeName(M.S.project.short || M.S.project.name)}.xlsx`);
    },
  };

  M.AI.DEFAULTS.montaz = { name: 'Dziennik montażu – wpis z notatki', text: `Jesteś inżynierem budowy. Z notatki kierownika montażu (i dołączonych zdjęć, np. dokumentów WZ) wyciągnij dane do wpisu w dzienniku montażu.
{{RULES}}
- Nazwy elementów podawaj DOKŁADNIE tak, jak na liście poniżej. Elementu spoza listy nie dopisuj – wymień go w polu "uwagi".
- Nie zgaduj liczby sztuk ani osi. Jeśli nie wynikają z notatki, pomiń pozycję i napisz o tym w "uwagi".

Budowa: {{PROJEKT}}
Data montażu: {{DATA}}
Rodzaj konstrukcji: {{RODZAJ}}
Lista elementów (nazwa | rysunek | grupa | ile zostało):
{{ELEMENTY}}

Notatka:
"""
{{NOTATKI}}
"""
{{ZDJECIA}}

Zwróć JEDEN blok \`\`\`json w formacie:
{"elementy":[{"nazwa":"...","szt":0,"osie":"np. 1–6 / A","uwaga":""}],"brygada":0,"sprzet":"","godziny":"","polaczenia":"","dokumenty":"","uszkodzenia":"","uwagi":""}` };

  M.AI.DEFAULTS.montaz_plan = { name: 'Dziennik montażu – projekt całego dziennika', text: `Jesteś kierownikiem montażu konstrukcji. Ułóż PROJEKT dziennika montażu: rozpisz elementy na kolejne dni robocze.
{{RULES}}
- Nazwy elementów podawaj DOKŁADNIE tak, jak na liście. Suma sztuk danego elementu we wszystkich wpisach nie może przekroczyć liczby „do rozpisania”.
- Trzymaj się okresu, dni pracy i kolejności z notatek. Realna wydajność: zależnie od elementu i brygady; jeśli notatki podają tempo, zastosuj je.
- Osie podawaj tylko wtedy, gdy wynikają z notatek lub z logicznej kolejności opisanej w notatkach. W przeciwnym razie zostaw "osie": "".
- Przerwy (pogoda, brak dostaw) wpisz jako osobny wpis bez elementów, z opisem w "uwagi".
- To projekt do sprawdzenia przez kierownika – niczego nie dopowiadaj ponad dane.

Budowa: {{PROJEKT}}
Rodzaj konstrukcji: {{RODZAJ}}
Okres montażu: {{OD}} – {{DO}}; dni pracy: {{DNI}}
Brygada: {{BRYGADA}} os.; sprzęt: {{SPRZET}}
Elementy (nazwa | rysunek | grupa | do rozpisania):
{{ELEMENTY}}
Terminy z harmonogramu:
{{HARMONOGRAM}}
Kolejność i przebieg wg kierownika:
"""
{{NOTATKI}}
"""

Zwróć JEDEN blok \`\`\`json w formacie:
{"wpisy":[{"data":"RRRR-MM-DD","elementy":[{"nazwa":"...","szt":0,"osie":""}],"uwagi":""}]}` };

  // ---------------- styl wydruku (wzór dziennika) ----------------
  const CSS_TAG = `<style>
    .dm-cover{page-break-after:always;height:262mm;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:6mm}
    .dm-cover img{height:16mm;margin-bottom:11mm}
    .dm-cover .k{font-size:10pt;letter-spacing:2.5pt;text-transform:uppercase;color:#626A6D;font-weight:700}
    .dm-cover h1{font-size:33pt;letter-spacing:3pt;margin:3mm 0 1mm;color:#23272A;font-weight:800}
    .dm-cover h1::after{content:"";display:block;width:34mm;height:1.6mm;background:#ED471D;margin:5mm auto 0;border-radius:1mm}
    .dm-cover .n{font-size:13pt;color:#4C5356;margin:4mm 0 8mm;font-weight:600}
    .dm-kv{width:158mm;margin:0 auto;text-align:left}
    .dm-kv td{border:0;border-bottom:0.5pt solid #C3C8CA;padding:1.8mm 2mm;font-size:10.5pt}
    .dm-kv td:first-child{width:62mm;color:#626A6D;font-size:8.5pt;text-transform:uppercase;letter-spacing:.4pt;font-weight:700;vertical-align:middle}
    .dm-kv td:last-child{font-weight:600}
    .dm-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;width:158mm;margin:7mm auto 0}
    .dm-sum div{border:0.6pt solid #C3C8CA;border-radius:2.5mm;padding:3mm 2mm}
    .dm-sum b{display:block;font-size:17pt;color:#ED471D;line-height:1.1}.dm-sum span{font-size:8pt;color:#626A6D;font-weight:700;text-transform:uppercase;letter-spacing:.3pt}
    .dm-law{width:158mm;margin:auto auto 0;padding-top:5mm;font-size:8.5pt;color:#626A6D;line-height:1.45}
    .dm-page{page-break-before:always}.dm-page h2{font-size:13pt;border:0;margin:0 0 4mm;padding:0 0 0 3mm;border-left:1.6mm solid #ED471D}
    .dm-t{margin:0}.dm-t th{background:#23272A;color:#fff;border-color:#23272A;font-size:7.6pt;letter-spacing:.3pt;padding:1.4mm 1.8mm}
    .dm-t td{border:0;border-bottom:0.5pt solid #D5D9DB;padding:1.5mm 1.8mm;font-size:9.5pt}
    .dm-t .r{text-align:right}.dm-t .c{text-align:center;color:#7B8386}.dm-t .g{font-size:7.6pt;color:#7B8386}
    .dm-p td{padding:1.05mm 1.8mm;font-size:8.8pt}.dm-p tr{page-break-inside:avoid}
    .dm-p .grp-r td{background:#F1F2F3;font-weight:800;border-bottom:0.8pt solid #9AA1A4;font-size:9.2pt}
    .bar{display:inline-block;vertical-align:middle;width:17mm;height:2.2mm;background:#E1E4E5;border-radius:1.1mm;overflow:hidden}.bar u{display:block;height:100%;background:#ED471D}
    .dm-e{border:0.7pt solid #9AA1A4;border-radius:2.5mm;margin:0 0 5mm;page-break-inside:avoid;overflow:hidden}
    .dm-eh{display:flex;align-items:center;gap:4mm;background:#F1F2F3;border-bottom:0.7pt solid #9AA1A4;padding:2mm 3mm}
    .dm-eh .nr{background:#ED471D;color:#fff;font-weight:800;font-size:11pt;padding:.8mm 3mm;border-radius:1.6mm}
    .dm-eh .dt{flex:1;font-size:10.5pt}.dm-eh .dt b{font-size:12pt}.dm-eh .tot{font-weight:800;font-size:10.5pt}
    .dm-eh .stt{font-size:7.6pt;text-transform:uppercase;letter-spacing:.4pt;font-weight:800;color:#22603F;border:0.6pt solid #2F855A;border-radius:3mm;padding:.3mm 2.2mm;background:#fff}
    .dm-e.dead{border-style:dashed}.dm-e.dead .nr{background:#7B8386}.dm-e.dead .stt{color:#7B8386;border-color:#7B8386}.dm-e.dead .dm-t td{color:#7B8386;text-decoration:line-through}
    .dm-note{background:#FFF7E0;border-bottom:0.5pt solid #E6CF8A;padding:1.4mm 3mm;font-size:8.8pt;font-weight:600}
    .dm-meta,.dm-ctl{display:grid;gap:0;border-bottom:0.5pt solid #D5D9DB}
    .dm-meta{grid-template-columns:2.2fr .8fr 2fr 1fr}.dm-ctl{grid-template-columns:1fr 1fr;border-top:0.5pt solid #D5D9DB;border-bottom:0}
    .dm-meta>div,.dm-ctl>div{padding:1.6mm 3mm;font-size:9.3pt;border-right:0.5pt solid #D5D9DB;border-bottom:0.5pt solid #D5D9DB}
    .dm-meta>div{border-bottom:0}.dm-meta>div:last-child,.dm-ctl>div:nth-child(2n){border-right:0}
    .dm-e span{display:block;font-size:6.9pt;text-transform:uppercase;letter-spacing:.5pt;color:#7B8386;font-weight:800;margin-bottom:.3mm}
    .dm-e i{color:#9AA1A4;font-style:normal}
    .dm-rem{padding:1.6mm 3mm;font-size:9.5pt;border-bottom:0.5pt solid #D5D9DB}
    .dm-st{padding:1.8mm 3mm 2mm;background:#FEF3EF}.dm-st .b{display:flex;align-items:center;gap:3mm;font-size:9pt;margin-top:.6mm}
    .dm-st em{font-style:normal;flex:0 0 62mm;font-weight:600}.dm-st .b>i{flex:1;height:2.2mm;background:#FBC6B2;border-radius:1.1mm;overflow:hidden}.dm-st u{display:block;height:100%;background:#ED471D}.dm-st .b>b{flex:0 0 28mm;text-align:right}
    .dm-e .pics{padding:2mm 3mm 0}
    .dm-sg{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:0.7pt solid #9AA1A4}
    .dm-sg div{padding:1.6mm 3mm 1.4mm;font-size:9pt;font-weight:600;min-height:15mm;border-right:0.5pt solid #D5D9DB}.dm-sg div:last-child{border-right:0}
    .dm-sg small{display:block;font-weight:400;color:#7B8386;font-size:7.6pt}
    @media screen{.dm-cover{height:auto;padding-bottom:10mm;border-bottom:1px dashed #bbb;margin-bottom:8mm}.dm-law{margin-top:8mm}.dm-page{margin-bottom:8mm}}
  </style>`;

  // ---------------- dane przykładowe (fikcyjne) ----------------
  M.DEMO = M.DEMO || {};
  M.DEMO.montaz = (p, comp, kb, d) => {
    const S = M.S; let ord = 0;
    const E = (lp, group, name, drawing, vol, qty) => { const x = { id: M.uid() + ord, projectId: p.id, ord: ++ord, lp, group, name, drawing, unit: 'm3', vol, mass: '', qty }; S.db.elements.push(x); return x; };
    const s1 = E('1.1', 'słupy hali', 'słup S-01', 'K-201-01', 3.26, 24), s2 = E('1.2', 'słupy hali', 'słup S-02', 'K-202-01', 3.05, 40), s3 = E('1.3', 'słupy hali', 'słup S-03 (narożny)', 'K-203-00', 3.38, 4);
    const b1 = E('2.1', 'belki podwalinowe', 'belka podwalinowa BP-01', 'K-501-00', 1.09, 27), b2 = E('2.2', 'belki podwalinowe', 'belka podwalinowa BP-02', 'K-502-02', 2.03, 39);
    E('3.1', 'strefa dokowa', 'ściana dokowa SC-01', 'K-601-01', 1.5, 38); E('3.2', 'strefa dokowa', 'dok BDK-01', 'K-604-01', 1.51, 38);
    E('4.1', 'płyty stropowe – część biurowa', 'płyta P301', 'parter', 0.81, 7); E('4.2', 'płyty stropowe – część biurowa', 'płyta P401', 'piętro', 0.81, 14);
    p.montaz = { mode: 'gw', kind: 'pref', companyId: comp.id, maker: 'Prefabrykacja DEMO Sp. z o.o.', nr: 'DM/DEMO/1', started: d(-9), manager: 'Tomasz Stalowy', managerLic: 'DEMO/0000/00', kb: 'Jarosław Sarafin', inspector: 'Inspektor DEMO', basis: 'Projekt wykonawczy konstrukcji – rysunki montażowe K-100…K-120 (dane fikcyjne)' };
    const A = (n, day, status, items, extra = {}) => { const a = Object.assign({ id: M.uid() + 'a' + n, projectId: p.id, nr: 'DM-' + M.pad(n, 3), date: d(day), status, items: items.map(([el, k, axes, note]) => ({ elementId: el.id, n: k, axes, note: note || '', name: el.name, drawing: el.drawing, group: el.group })), crew: 6, crane: 'żuraw samojezdny 100 t, podnośnik nożycowy', hours: '7:00–16:00', weather: { opis: 'częściowe zachmurzenie', tmin: 8, tmax: 15, opad: 0, wiatr: 18, porywy: 34 }, weatherNote: '', geo: 'wykonano', geoRef: 'szkic G-' + (10 + n), dev: 'w tolerancji', devNote: '', joints: 'słupy w stopach kielichowych, klinowanie, podlewka', docs: 'WZ ' + (100 + n) + '/DEMO, deklaracje właściwości użytkowych', damage: '', remarks: '', photos: [], created: Date.now() - (10 - n) * 86400000, createdBy: kb.id }, extra); S.db.assembly.push(a); return a; };
    const fin = (a) => { a.approvedBy = kb.id; a.approvedAt = a.created + 3600000; a.stateAfter = null; return a; };
    fin(A(1, -9, 'zatwierdzony', [[s1, 8, '1–8 / A'], [s3, 2, '1 / A, 1 / G']]));
    fin(A(2, -8, 'zatwierdzony', [[s1, 8, '9–16 / A'], [s2, 10, '1–10 / B']]));
    fin(A(3, -6, 'zatwierdzony', [[s2, 12, '11–16 / B, 1–6 / C']], { weather: { opis: 'przelotny deszcz', tmin: 6, tmax: 11, opad: 4.2, wiatr: 32, porywy: 58 }, weatherNote: 'przerwa 11:00–13:30 z powodu porywów wiatru', remarks: 'Montaż wstrzymany na 2,5 h – porywy wiatru powyżej wartości dopuszczalnej wg instrukcji żurawia.' }));
    fin(A(4, -5, 'zatwierdzony', [[b1, 12, '1–7 / A'], [b2, 9, '1–10 / G']], { joints: 'belki na podlewce, zalanie styków ze słupami', geo: 'do wykonania', geoRef: '' }));
    A(5, -1, 'szkic', [[s2, 6, '7–12 / C']], { geo: '', geoRef: '', dev: '' });
    // stan po wpisie liczony narastająco – w kolejności wpisów
    const done = new Map();
    S.db.assembly.filter(a => a.projectId === p.id && a.status === 'zatwierdzony').forEach(a => { a.items.forEach(i => done.set(i.elementId, (done.get(i.elementId) || 0) + i.n)); const gs = [...new Set(a.items.map(i => i.group))]; a.stateAfter = gs.map(g => { const l = S.db.elements.filter(x => x.projectId === p.id && x.group === g); return { group: g, done: l.reduce((s, x) => s + (done.get(x.id) || 0), 0), qty: l.reduce((s, x) => s + x.qty, 0) }; }); });
  };
  M.MONTAZ = { genText, validate, doneMap, totals, cfg, KIND, GEO, ST, itemName, itemDraw, itemGroup, itemsCount, stateAfter, wxTxt, CSS_TAG };
})(window.M);
