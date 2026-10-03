/* =========================================================
   BIURO BUDOWY — Protokoły odbioru robót zanikających i ulegających zakryciu
   Podstawa: Prawo budowlane art. 22 pkt 7 (KB zgłasza inwestorowi do sprawdzenia/odbioru)
   i art. 25 pkt 3 (inspektor nadzoru sprawdza i odbiera) – sprawdź aktualny tekst jednolity.
   Gotowe wzory (drafty) + własne wzory + Asystent AI (notatki + zdjęcia → treść protokołu).
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const RES = [['odebrano', 'Odebrano'], ['odebrano z uwagami', 'Odebrano z uwagami'], ['nie odebrano', 'Nie odebrano']];
  M.ZAN_TPL = [
    { id: 'z-zbroj-fund', name: 'Zbrojenie stóp / ław fundamentowych', checks: ['Średnice i gatunek stali zgodne z rysunkiem', 'Rozstaw prętów i strzemion', 'Otulina – dystanse, podkładki', 'Długości zakładów i zakotwień', 'Kotwy / marki – położenie i rzędne wg geodety', 'Połączenie z uziomem fundamentowym', 'Czystość i stan deskowania / wykopu'], docs: ['Rysunki konstrukcyjne (nr, rewizja)', 'Deklaracje właściwości użytkowych / atesty stali', 'Szkic geodezyjny położenia kotew'] },
    { id: 'z-kotwy', name: 'Kotwy i marki stalowe przed betonowaniem', checks: ['Położenie w osiach (tolerancje wg projektu)', 'Rzędne i wysokość wystawania gwintu', 'Zabezpieczenie gwintów', 'Usztywnienie szablonem / montaż stabilny'], docs: ['Rysunek kotew', 'Pomiar geodezyjny'] },
    { id: 'z-posadzka', name: 'Podbudowa pod posadzkę przemysłową', checks: ['Materiał podbudowy zgodny z projektem', 'Grubość warstw i rzędne', 'Zagęszczenie / nośność (moduły E2, E2/E1 lub Is)', 'Folia poślizgowa / izolacja', 'Dylatacje obwodowe i przy słupach', 'Instalacje podposadzkowe odebrane'], docs: ['Protokół badań nośności/zagęszczenia', 'Projekt posadzki', 'Protokoły odbioru instalacji podposadzkowych'] },
    { id: 'z-izol', name: 'Izolacje przeciwwodne / przeciwwilgociowe fundamentów', checks: ['Przygotowanie podłoża', 'Ciągłość powłoki / zakłady', 'Obróbki przejść instalacyjnych', 'Ochrona izolacji przed zasypaniem'], docs: ['Karty techniczne / DWU materiałów'] },
    { id: 'z-zasypka', name: 'Zasypka wykopów i zagęszczenie', checks: ['Rodzaj gruntu zasypowego', 'Grubość warstw', 'Wskaźnik zagęszczenia / moduły wg projektu', 'Ochrona izolacji i instalacji'], docs: ['Protokół badań zagęszczenia'] },
    { id: 'z-kanal', name: 'Kanalizacja (podposadzkowa / zewnętrzna) przed zasypaniem', checks: ['Średnice i materiał rur', 'Spadki i rzędne', 'Podsypka i obsypka', 'Szczelność (próba)', 'Studzienki / czyszczaki'], docs: ['Protokół próby szczelności', 'Inwentaryzacja geodezyjna', 'DWU rur i kształtek'] },
    { id: 'z-uziom', name: 'Uziom fundamentowy / otokowy', checks: ['Ciągłość i przekroje bednarki / pręta', 'Połączenia (spawane / zaciskowe)', 'Wyprowadzenia do złącz', 'Pomiar rezystancji uziemienia'], docs: ['Protokół pomiarów'] },
    { id: 'z-ppoz', name: 'Przejścia instalacyjne przez elementy oddzielenia pożarowego', checks: ['Klasa odporności przejścia zgodna z projektem', 'System zabezpieczenia zgodny z aprobatą/oceną', 'Oznakowanie przejść', 'Dokumentacja fotograficzna przed zakryciem'], docs: ['Krajowa ocena techniczna / DWU systemu', 'Rysunki ppoż.'] },
  ];
  const CAT0 = { 'z-zbroj-fund': 'Zbrojenie i betonowanie', 'z-kotwy': 'Zbrojenie i betonowanie', 'z-posadzka': 'Roboty ziemne i podłoże' };
  /** wszystkie wzory: własne, podstawowe i biblioteka (js/wzory.js) – z kategorią */
  const tplAll = () => { const base = M.ZAN_TPL.map(t => ({ cat: CAT0[t.id] || (/izol/i.test(t.name) ? 'Izolacje' : /zasyp|podbud|grunt/i.test(t.name) ? 'Roboty ziemne i podłoże' : /kanal|uziom|ppoż|instal/i.test(t.name) ? 'Instalacje i sieci' : 'Inne'), ...t })); const ids = new Set(base.map(t => t.id)); return [...M.S.all('templates').filter(t => t.kind === 'zanikowe').map(t => ({ cat: 'Własne wzory', ...t })), ...base, ...((M.WZ && M.WZ.ZAN) || []).filter(t => !ids.has(t.id))]; };

  M.modules.zanikowe = {
    title: 'Protokoły robót zanikowych', icon: 'layers', order: 5,
    desc: 'Gotowe wzory protokołów odbioru robót zanikających i ulegających zakryciu. AI wypełnia z notatek i zdjęć.',
    today() { return M.S.all('protocols').filter(p => p.status === 'zgłoszony' && M.P.isStaff()).map(p => ({ lvl: 'yel', icon: 'layers', t: `${p.nr}: zgłoszony do odbioru – ${p.title}`, d: `${M.S.respName(p.companyId)} · ${M.fmt(p.date)}`, go: 'zanikowe/' + p.id })); },
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      if (rest[0]) { const p = M.S.get('protocols', rest[0]); if (p) return this.detail(v, p); }
      const edit = M.P.canEdit('zanikowe');
      const list = M.S.all('protocols').filter(p => M.P.seesRecord(p, 'companyId')).sort((a, b) => (b.nr || '').localeCompare(a.nr || ''));
      v.innerHTML = M.UI.head('Protokoły <span class="acc">robót zanikowych</span>', 'Zgłoszenie → odbiór z inspektorem nadzoru → protokół PDF ze zdjęciami.', `${edit ? `<button class="btn" id="tpl">${M.icon.edit}Wzory</button><button class="btn primary" id="new">${M.icon.plus}Nowy protokół</button>` : ''}`) + M.UI.readonlyBanner('zanikowe') +
        `<div class="card">${list.length ? `<table class="list"><thead><tr><th>Nr</th><th>Data</th><th>Roboty</th><th class="hide-m">Lokalizacja</th><th>Wykonawca</th><th>Wynik</th></tr></thead><tbody>${list.map(p => `<tr class="click" data-id="${p.id}"><td class="num">${e(p.nr)}</td><td>${M.fmt(p.date)}</td><td>${e(p.title)}</td><td class="hide-m small">${e(p.location || '')}</td><td class="small">${e(M.S.respName(p.companyId))}</td><td>${p.result ? `<span class="st ${p.result === 'odebrano' ? 'done' : p.result === 'nie odebrano' ? 'open' : 'check'}">${e(p.result)}</span>` : `<span class="st info">${e(p.status || 'szkic')}</span>`}</td></tr>`).join('')}</tbody></table>` : M.UI.empty('Brak protokołów. Utwórz pierwszy z gotowego wzoru.', 'layers')}</div>`;
      v.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => M.go('zanikowe/' + tr.dataset.id));
      const nb = v.querySelector('#new'); if (nb) nb.onclick = () => this.newDialog();
      const tb = v.querySelector('#tpl'); if (tb) tb.onclick = () => this.templates();
    },
    newDialog() {
      const T = tplAll(); const ORDER = ['Własne wzory', 'Roboty ziemne i podłoże', 'Zbrojenie i betonowanie', 'Konstrukcja montowana', 'Izolacje', 'Dach i obudowa', 'Instalacje i sieci', 'Drogi i place', 'Inne'];
      const cats = [...new Set(T.map(t => t.cat))].sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99); let cat = '';
      const m = M.UI.modal({ title: 'Nowy protokół – wybierz wzór', wide: true, body: `<div class="col"><div class="row" style="align-items:flex-end"><label class="f" style="width:190px">Data odbioru<input type="date" id="nd" value="${M.todayISO()}"></label><div class="search grow">${M.icon.search}<input type="search" id="q" placeholder="Szukaj: zbrojenie stropu, izolacja, podbudowa…"></div><button class="btn ghost" data-t="">${M.icon.plus}Pusty protokół</button></div><div class="chips" id="cats"></div><div class="table-wrap" style="max-height:50vh"><table class="list"><tbody id="tl"></tbody></table></div></div>` });
      const make = (id) => { const t = T.find(x => x.id === id) || { name: '', checks: [], docs: [] }; const date = m.querySelector('#nd').value || M.todayISO();
        const p = M.S.upsert('protocols', { nr: M.S.nextNr('protocols', 'PZ'), date, templateId: t.id || '', title: t.name, scope: '', location: '', planId: '', companyId: '', basis: '', checks: t.checks.map(c => ({ txt: c, res: '', note: '' })), docs: t.docs.map(d => ({ txt: d, ok: false })), findings: '', result: '', remarks: '', members: (() => { const by = (f) => (M.TEAM ? (M.TEAM.by(f, date)[0] || {}) : {}); const kb = by(M.WZ.FUN[0]), ini = by(M.WZ.FUN[2]); return `Kierownik budowy – ${kb.name || ''}${kb.lic ? ', upr. nr ' + kb.lic : ''}\nInspektor nadzoru inwestorskiego – ${ini.name || ''}${ini.lic ? ', upr. nr ' + ini.lic : ''}\nPrzedstawiciel wykonawcy robót – `; })(), notes: '', photos: [], status: 'szkic' });
        m.close(); M.go('zanikowe/' + p.id); };
      const draw = () => { const q = M.norm(m.querySelector('#q').value);
        m.querySelector('#cats').innerHTML = [['', `Wszystkie (${T.length})`], ...cats.map(c => [c, c])].map(([k, l]) => `<button class="chip ${cat === k ? 'on' : ''}" data-c="${e(k)}">${e(l)}</button>`).join('');
        m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
        m.querySelector('#tl').innerHTML = cats.filter(c => !cat || c === cat).map(c => { const rows = T.filter(t => t.cat === c && (!q || M.norm(t.name + ' ' + t.checks.join(' ')).includes(q))); return rows.length ? `<tr class="dm-g"><td><b>${e(c)}</b></td></tr>` + rows.map(t => `<tr class="click" data-t="${e(t.id)}"><td><b>${e(t.name)}</b> <span class="xs muted">· ${t.checks.length} pkt kontroli</span><div class="xs muted">${e(t.checks.slice(0, 3).join(' · '))}…</div></td></tr>`).join('') : ''; }).join('') || `<tr><td>${M.UI.empty('Brak wzoru. Użyj pustego protokołu albo dodaj własny wzór.', 'search')}</td></tr>`;
        m.querySelectorAll('tr[data-t]').forEach(tr => tr.onclick = () => make(tr.dataset.t)); };
      m.querySelector('#q').oninput = draw; m.querySelector('button[data-t]').onclick = () => make(''); draw();
    },
    detail(v, p) {
      const edit = M.P.canEdit('zanikowe'); p.checks = p.checks || []; p.docs = p.docs || []; p.photos = p.photos || [];
      v.innerHTML = `<div class="page-head"><div><h1>Protokół <span class="acc">${e(p.nr)}</span></h1><div class="sub">${e(p.title || '')}</div></div>
        <div class="actions"><button class="btn ghost" id="back">${M.icon.back}Lista</button>${edit ? `<button class="btn soft" id="ai">${M.icon.spark}AI: wypełnij z notatek</button><button class="btn" id="mail">${M.icon.mail}Zgłoś do odbioru</button>` : ''}<button class="btn primary" id="pdf">${M.icon.print}Protokół PDF</button></div></div>
        ${M.UI.readonlyBanner('zanikowe')}
        <div class="grid2" style="align-items:start" id="frm">
          <div class="col">
            <div class="card card-pad col">
              <div class="grid3"><label class="f">Data odbioru<input type="date" data-f="date" value="${e(p.date)}"></label><label class="f">Status<select data-f="status">${M.UI.opts([['szkic', 'Szkic'], ['zgłoszony', 'Zgłoszony do odbioru'], ['zakończony', 'Zakończony']], p.status)}</select></label><label class="f">Wynik<select data-f="result">${M.UI.opts(RES, p.result, '—')}</select></label></div>
              <label class="f">Rodzaj robót<input type="text" data-f="title" value="${e(p.title || '')}"></label>
              <label class="f">Zakres / element<textarea data-f="scope" rows="2">${e(p.scope || '')}</textarea></label>
              <div class="grid2"><label class="f">Lokalizacja (osie, strefa, poziom)<input type="text" data-f="location" value="${e(p.location || '')}"></label><label class="f">Wykonawca robót<select data-f="companyId">${M.UI.respOpts(p.companyId, '— wykonawca —')}</select></label></div>
              <label class="f">Podstawa (projekt, nr rysunków, zmiany)<input type="text" data-f="basis" value="${e(p.basis || '')}"></label>
              <label class="f">Komisja (osoby i funkcje)<textarea data-f="members" rows="3">${e(p.members || '')}</textarea></label>
            </div>
            <div class="card card-pad col"><h2>Zdjęcia przed zakryciem</h2><div id="ph"></div></div>
            <div class="card card-pad col"><div class="row"><h2 class="grow">Notatki z odbioru</h2>${edit ? `<button class="btn sm" id="dict">${M.icon.mic}Dyktuj</button>` : ''}</div><textarea data-f="notes" id="notes" rows="4">${e(p.notes || '')}</textarea></div>
          </div>
          <div class="col">
            <div class="card"><div class="card-head"><h2>Punkty kontroli</h2>${edit ? `<button class="btn sm" id="addCk">${M.icon.plus}</button>` : ''}</div><div id="cks"></div></div>
            <div class="card"><div class="card-head"><h2>Dokumenty</h2>${edit ? `<button class="btn sm" id="addDoc">${M.icon.plus}</button>` : ''}</div><div id="docs" class="card-pad col" style="gap:6px"></div></div>
            <div class="card card-pad col"><label class="f">Stwierdzenia komisji<textarea data-f="findings" rows="6">${e(p.findings || '')}</textarea></label><label class="f">Uwagi / usterki do usunięcia<textarea data-f="remarks" rows="3">${e(p.remarks || '')}</textarea></label></div>
          </div>
        </div>`;
      const frm = v.querySelector('#frm');
      const save = M.debounce(() => { Object.assign(p, M.UI.read(frm)); M.S.upsert('protocols', p); }, 450);
      if (edit) frm.querySelectorAll('[data-f]').forEach(el => el.addEventListener('input', save)); else M.UI.lockForm(frm, true);
      M.UI.photos(v.querySelector('#ph'), p.photos, { editable: edit, onChange: () => M.S.upsert('protocols', p) });
      const drawCk = () => {
        v.querySelector('#cks').innerHTML = `<table class="list"><tbody>${p.checks.map((c, i) => `<tr data-i="${i}"><td style="width:45%"><input type="text" data-k="txt" value="${e(c.txt)}" ${edit ? '' : 'disabled'}></td><td><div class="seg">${[['tak', 'zgodne'], ['nie', 'niezgodne'], ['nd', 'n/d']].map(([k, l]) => `<button data-r="${k}" class="${c.res === k ? 'on' : ''}" ${edit ? '' : 'disabled'}>${l}</button>`).join('')}</div><input type="text" data-k="note" value="${e(c.note || '')}" placeholder="uwaga" style="margin-top:4px" ${edit ? '' : 'disabled'}></td>${edit ? `<td><button class="btn icon ghost sm" data-del>${M.icon.x}</button></td>` : ''}</tr>`).join('')}</tbody></table>`;
        v.querySelectorAll('#cks tr').forEach(tr => { const c = p.checks[+tr.dataset.i];
          tr.querySelectorAll('[data-k]').forEach(el => el.oninput = () => { c[el.dataset.k] = el.value; save(); });
          tr.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { c.res = c.res === b.dataset.r ? '' : b.dataset.r; M.S.upsert('protocols', p); drawCk(); });
          const d = tr.querySelector('[data-del]'); if (d) d.onclick = () => { p.checks.splice(+tr.dataset.i, 1); M.S.upsert('protocols', p); drawCk(); }; });
      };
      const drawDocs = () => {
        v.querySelector('#docs').innerHTML = p.docs.map((d, i) => `<div class="row" data-i="${i}"><label class="check grow"><input type="checkbox" ${d.ok ? 'checked' : ''} ${edit ? '' : 'disabled'}><input type="text" value="${e(d.txt)}" ${edit ? '' : 'disabled'} style="flex:1"></label>${edit ? `<button class="btn icon ghost sm" data-del>${M.icon.x}</button>` : ''}</div>`).join('') || '<span class="small muted">Brak.</span>';
        v.querySelectorAll('#docs [data-i]').forEach(r => { const d = p.docs[+r.dataset.i]; r.querySelector('[type=checkbox]').onchange = (ev) => { d.ok = ev.target.checked; M.S.upsert('protocols', p); }; r.querySelector('[type=text]').oninput = (ev) => { d.txt = ev.target.value; save(); }; const x = r.querySelector('[data-del]'); if (x) x.onclick = () => { p.docs.splice(+r.dataset.i, 1); M.S.upsert('protocols', p); drawDocs(); }; });
      };
      drawCk(); drawDocs();
      v.querySelector('#back').onclick = () => M.go('zanikowe');
      const ac = v.querySelector('#addCk'); if (ac) ac.onclick = () => { p.checks.push({ txt: '', res: '', note: '' }); drawCk(); };
      const ad = v.querySelector('#addDoc'); if (ad) ad.onclick = () => { p.docs.push({ txt: '', ok: false }); drawDocs(); };
      const dict = v.querySelector('#dict'); if (dict) M.UI.dictate(dict, v.querySelector('#notes'));
      v.querySelector('#pdf').onclick = async () => M.PR.print(`Protokół ${p.nr}`, await this.html(p));
      const ml = v.querySelector('#mail'); if (ml) ml.onclick = () => {
        const inv = M.S.companies('inwestor')[0];
        M.ML.mailto({ to: inv ? inv.email || '' : '', subject: `[${M.S.project.short || M.S.project.name}] Zgłoszenie robót zanikających do odbioru – ${p.title}`, body: `Dzień dobry,\n\nzgodnie z art. 22 pkt 7 Prawa budowlanego zgłaszam do sprawdzenia i odbioru roboty zanikające / ulegające zakryciu:\n\nRodzaj robót: ${p.title}\nZakres: ${p.scope}\nLokalizacja: ${p.location}\nProponowany termin odbioru: ${M.fmt(p.date)}\n\nProszę o potwierdzenie terminu.\n\n${M.S.settings.mailSignature || ''}` });
        p.status = 'zgłoszony'; M.S.upsert('protocols', p); this.detail(v, p);
      };
      const ai = v.querySelector('#ai'); if (ai) ai.onclick = () => {
        save();
        M.AI.open({ key: 'zanikowe', title: 'Asystent AI – protokół robót zanikowych', photos: p.photos, photoPrefix: p.nr,
          prompt: M.AI.fill('zanikowe', { PROJEKT: M.S.project.name, NR: p.nr, DATA: M.fmt(p.date), WZOR: p.title, ZAKRES: p.scope, LOKALIZACJA: p.location, WYKONAWCA: M.S.respName(p.companyId), PODSTAWA: p.basis, KONTROLA: p.checks.map(c => `  - ${c.txt}: ${c.res === 'tak' ? 'zgodne' : c.res === 'nie' ? 'NIEZGODNE' : c.res === 'nd' ? 'n/d' : 'nie oceniono'}${c.note ? ' (' + c.note + ')' : ''}`).join('\n'), DOKUMENTY: p.docs.map(d => `${d.txt}: ${d.ok ? 'jest' : 'BRAK'}`).join('; '), NOTATKI: p.notes, ZDJECIA: M.AI.photoList(p.photos) }),
          parse: (t) => { const j = M.extractJSON(t); return j && (j.stwierdzenia || j.zakres) ? j : null; },
          preview: (j) => `<b>Zakres:</b><p>${e(j.zakres || '')}</p><b>Stwierdzenia:</b><div style="white-space:pre-wrap">${e(j.stwierdzenia || '')}</div><b>Wynik:</b> ${e(j.wynik || '')}<br><b>Uwagi:</b> ${e(j.uwagi || '')}`,
          applyLabel: 'Wstaw do protokołu',
          apply: (j) => { if (j.zakres && !p.scope) p.scope = j.zakres; else if (j.zakres) p.scope = j.zakres; p.findings = j.stwierdzenia || p.findings; const r = RES.find(([k]) => M.norm(j.wynik || '') === M.norm(k)); if (r) p.result = r[0]; if (j.uwagi) p.remarks = j.uwagi; M.S.upsert('protocols', p); this.detail(v, p); } });
      };
    },
    async html(p) {
      return `${M.PR.header(`Protokół odbioru robót zanikających i ulegających zakryciu nr ${p.nr}`, '')}
        <table class="kv"><tr><td>Data odbioru</td><td>${M.fmt(p.date)}</td></tr><tr><td>Rodzaj robót</td><td>${e(p.title)}</td></tr><tr><td>Zakres / element</td><td class="pre">${e(p.scope)}</td></tr><tr><td>Lokalizacja</td><td>${e(p.location)}</td></tr><tr><td>Wykonawca robót</td><td>${e(M.S.respName(p.companyId))}</td></tr><tr><td>Podstawa</td><td>${e(p.basis)}</td></tr><tr><td>Dziennik budowy</td><td>${e(M.S.project.edb || '')}</td></tr></table>
        <h2>Komisja</h2><div class="pre">${e(p.members)}</div>
        <h2>Sprawdzenie</h2><table><thead><tr><th>Punkt kontroli</th><th>Wynik</th><th>Uwagi</th></tr></thead><tbody>${p.checks.map(c => `<tr><td>${e(c.txt)}</td><td>${c.res === 'tak' ? 'zgodne' : c.res === 'nie' ? '<b>niezgodne</b>' : c.res === 'nd' ? 'n/d' : '—'}</td><td>${e(c.note || '')}</td></tr>`).join('')}</tbody></table>
        <h2>Dokumenty</h2><ul>${p.docs.map(d => `<li>${d.ok ? '☑' : '☐'} ${e(d.txt)}</li>`).join('')}</ul>
        <h2>Stwierdzenia komisji</h2><div class="pre">${e(p.findings || '')}</div>
        <div class="box"><b>Wynik odbioru: ${e((RES.find(r => r[0] === p.result) || ['', '—'])[1])}</b>${p.remarks ? `<div class="pre" style="margin-top:2mm">Uwagi: ${e(p.remarks)}</div>` : ''}</div>
        ${p.photos.length ? `<h2>Dokumentacja fotograficzna</h2>${await M.PR.pics(p.photos)}` : ''}
        ${M.PR.sign(['Kierownik budowy', 'Inspektor nadzoru inwestorskiego', 'Kierownik robót (wykonawca)'])}`;
    },
    templates() {
      const own = M.S.all('templates').filter(t => t.kind === 'zanikowe');
      const m = M.UI.modal({ title: 'Wzory protokołów', wide: true, body: `<div class="small muted">Wzory wbudowane (${M.ZAN_TPL.length}) można skopiować i zmienić. Własne wzory są wspólne dla wszystkich budów.</div>
        <table class="list"><tbody>${tplAll().map(t => `<tr><td><b>${e(t.name)}</b><div class="xs muted">${t.checks.length} pkt kontroli · ${t.docs.length} dok.${t.kind ? ' · własny' : ' · wbudowany'}</div></td><td style="text-align:right"><button class="btn sm" data-copy="${t.id}">Kopiuj jako własny</button>${t.kind ? ` <button class="btn sm" data-ed="${t.id}">${M.icon.edit}</button> <button class="btn sm danger" data-del="${t.id}">${M.icon.trash}</button>` : ''}</td></tr>`).join('')}</tbody></table>` });
      const editT = (t) => {
        const m2 = M.UI.modal({ title: 'Wzór protokołu', body: `<label class="f">Nazwa<input type="text" id="n" value="${e(t.name)}"></label><label class="f">Punkty kontroli (jeden w linii)<textarea id="c" rows="8">${e(t.checks.join('\n'))}</textarea></label><label class="f">Dokumenty (jeden w linii)<textarea id="d" rows="4">${e(t.docs.join('\n'))}</textarea></label>`, footer: `<button class="btn primary" id="ok">Zapisz wzór</button>` });
        m2.querySelector('#ok').onclick = () => { t.name = m2.querySelector('#n').value; t.checks = m2.querySelector('#c').value.split('\n').map(s => s.trim()).filter(Boolean); t.docs = m2.querySelector('#d').value.split('\n').map(s => s.trim()).filter(Boolean); t.kind = 'zanikowe'; M.S.upsert('templates', t); m2.close(); m.close(); this.templates(); };
      };
      m.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { const s = tplAll().find(t => t.id === b.dataset.copy); editT({ name: s.name + ' (kopia)', checks: [...s.checks], docs: [...s.docs], kind: 'zanikowe' }); });
      m.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editT(M.S.get('templates', b.dataset.ed)));
      m.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (await M.UI.confirm('Usunąć wzór?', 'Usuń', true)) { M.S.remove('templates', b.dataset.del); m.close(); this.templates(); } });
      if (!own.length) { /* brak własnych */ }
    },
  };
})(window.M);
