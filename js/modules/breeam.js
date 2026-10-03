/* =========================================================
   BIURO BUDOWY — BREEAM: kredyty i punktacja, ewidencja dowodów, monitoring budowy,
   raporty i protokoły przekazania dowodów asesorowi, projekty dowodów z AI.
   UWAGA: liczby kredytów, wagi kategorii i progi ocen zależą od wersji schematu
   i typu budynku – wprowadzaj je z pre-assessmentu / od licencjonowanego asesora.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const st = { tab: 'kredyty', cat: '' };
  const CATS = [['Man', 'Zarządzanie'], ['Hea', 'Zdrowie i samopoczucie'], ['Ene', 'Energia'], ['Tra', 'Transport'], ['Wat', 'Woda'], ['Mat', 'Materiały'], ['Wst', 'Odpady'], ['LE', 'Użytkowanie terenu i ekologia'], ['Pol', 'Zanieczyszczenia'], ['Inn', 'Innowacje']];
  const catName = (k) => (CATS.find(c => c[0] === k || (k === 'Lue' && c[0] === 'LE')) || [k, k])[1];
  const CR_ST = [['planowany', 'Planowany', 'info'], ['w toku', 'W toku', 'check'], ['spełniony', 'Spełniony', 'done'], ['zagrożony', 'Zagrożony', 'open'], ['utracony', 'Utracony', 'rej']];
  const EV_ST = [['brak', 'Brak', 'open'], ['w przygotowaniu', 'W przygotowaniu', 'check'], ['złożony', 'Złożony asesorowi', 'info'], ['zaakceptowany', 'Zaakceptowany', 'done'], ['odrzucony', 'Do poprawy', 'open']];
  const PRESETS = { 'V6 (2018/International v6)': { Pass: 30, Good: 45, 'Very Good': 55, Excellent: 70, Outstanding: 85 }, 'V7 (od 07.2025)': { Pass: 25, Good: 40, 'Very Good': 55, Excellent: 70, Outstanding: 85 } };
  const stBadge = (list, k) => { const s = list.find(x => x[0] === k) || [k, k || '—', 'rej']; return `<span class="st ${s[2]}">${e(s[1])}</span>`; };

  const B = M.BREEAM = {};
  B.cfg = () => { const p = M.S.project; p.breeam = p.breeam || M.DEMO.newProject().breeam; return p.breeam; };
  /** wynik: per kategoria i łącznie (ważony, gdy wagi wpisane) */
  B.score = (field = 'achieved') => {
    const cr = M.S.all('breeam'); const cfg = B.cfg(); const w = cfg.weights || {};
    const cats = [...new Set(cr.map(c => c.cat))];
    const rows = cats.map(k => { const L = cr.filter(c => c.cat === k); const avail = L.reduce((a, c) => a + (Number(c.avail) || 0), 0); const val = L.reduce((a, c) => a + (Number(c[field]) || 0), 0); return { k, avail, val, pct: avail ? val / avail * 100 : 0, w: Number(w[k]) || 0 }; });
    const weighted = rows.length && rows.every(r => r.w > 0);
    const total = weighted ? rows.reduce((a, r) => a + r.pct * r.w / 100, 0) : (rows.reduce((a, r) => a + r.avail, 0) ? rows.reduce((a, r) => a + r.val, 0) / rows.reduce((a, r) => a + r.avail, 0) * 100 : 0);
    const thr = cfg.thr || PRESETS['V6 (2018/International v6)'];
    const rating = Object.entries(thr).sort((a, b) => b[1] - a[1]).find(([, v]) => total >= v);
    return { rows, total, weighted, rating: rating ? rating[0] : 'Unclassified', thr };
  };

  M.modules.breeam = {
    title: 'BREEAM', icon: 'leaf', order: 7,
    desc: 'Punktacja vs cel certyfikacji, ewidencja dowodów z terminami, monitoring budowy, protokoły dla asesora.',
    today() {
      const t = M.todayISO(); const out = [];
      M.S.all('evidence').filter(ev => M.P.seesRecord(ev) && !['zaakceptowany', 'złożony'].includes(ev.status) && ev.due && M.diffDays(t, ev.due) <= 7).forEach(ev => { const c = M.S.get('breeam', ev.creditId) || {}; const dl = M.diffDays(t, ev.due); out.push({ lvl: dl < 0 ? 'red' : 'yel', icon: 'leaf', kind: dl <= 7 ? 'termin' : '', t: `BREEAM ${c.code || ''}: ${ev.name.slice(0, 60)}`, d: `${dl < 0 ? 'po terminie ' + (-dl) + ' dni' : 'termin ' + M.fmt(ev.due)} · ${M.S.respName(ev.respId)}`, go: 'breeam/dowody', sort: dl }); });
      M.S.all('breeam').filter(c => c.status === 'zagrożony').forEach(c => M.P.isStaff() && out.push({ lvl: 'yel', icon: 'leaf', t: `Kredyt ${c.code} zagrożony`, d: `${c.name} – cel ${c.target} pkt, uzyskane ${c.achieved}`, go: 'breeam' }));
      return out;
    },
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      if (rest[0]) st.tab = rest[0];
      const edit = M.P.canEdit('breeam'); const cfg = B.cfg(); const now = B.score('achieved'), tgt = B.score('target');
      const ev = M.S.all('evidence'); const evOk = ev.filter(x => x.status === 'zaakceptowany').length;
      v.innerHTML = M.UI.head('BREEAM <span class="acc">na budowie</span>', `${e(cfg.scheme || '')} · cel: <b>${e(cfg.target || '—')}</b>`, `<button class="btn" id="rep">${M.icon.print}Raport BREEAM</button><button class="btn" id="hand">${M.icon.report}Protokół przekazania dowodów</button>`) + M.UI.readonlyBanner('breeam') +
        `<div class="kpis">
          <div class="kpi"><b class="or">${now.total.toFixed(1)}%</b><span>wynik uzyskany → ${e(now.rating)}${now.weighted ? '' : ' (bez wag!)'}</span></div>
          <div class="kpi"><b>${tgt.total.toFixed(1)}%</b><span>wynik docelowy → ${e(tgt.rating)}</span></div>
          <div class="kpi"><b>${evOk}/${ev.length}</b><span>dowody zaakceptowane</span></div>
          <div class="kpi"><b class="${ev.filter(x => x.due && x.due < M.todayISO() && !['zaakceptowany', 'złożony'].includes(x.status)).length ? 'or' : ''}">${ev.filter(x => x.due && x.due < M.todayISO() && !['zaakceptowany', 'złożony'].includes(x.status)).length}</b><span>dowody po terminie</span></div>
        </div>
        <div class="card card-pad" style="margin-bottom:14px"><div class="meter"><i class="t" style="width:${Math.min(100, tgt.total)}%"></i><i style="width:${Math.min(100, now.total)}%"></i>${Object.entries(now.thr).map(([k, val]) => `<span title="${k}" style="position:absolute;left:${val}%;top:-2px;bottom:-2px;width:2px;background:var(--gr-800)"></span>`).join('')}</div>
          <div style="position:relative;height:16px;font-size:11px;color:var(--ink-3)">${Object.entries(now.thr).map(([k, val]) => `<span style="position:absolute;left:${val}%;transform:translateX(-50%);white-space:nowrap">${e(k)} ${val}%</span>`).join('')}</div>
          ${!now.weighted ? `<div class="banner warn" style="margin-top:8px">${M.icon.alert}<span class="small">Wynik liczony bez wag kategorii (proporcja kredytów) – to tylko orientacja. Wpisz wagi z pre-assessmentu w zakładce „Schemat”, aby uzyskać wynik ważony jak w BREEAM.</span></div>` : ''}</div>
        <div class="tabs">${[['kredyty', 'Kredyty'], ['dowody', 'Dowody'], ['monitoring', 'Monitoring budowy'], ['schemat', 'Schemat i progi']].map(([k, l]) => `<button data-t="${k}" class="${st.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="body"></div>`;
      v.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; M.go('breeam/' + st.tab); });
      const body = v.querySelector('#body');
      ({ kredyty: () => this.credits(body, edit), dowody: () => this.evidence(body), monitoring: () => this.monitoring(body, edit), schemat: () => this.scheme(body, edit) }[st.tab] || (() => this.credits(body, edit)))();
      v.querySelector('#rep').onclick = () => M.PR.print('Raport BREEAM', this.reportHtml());
      v.querySelector('#hand').onclick = () => this.handover();
    },
    credits(box, edit) {
      const cr = M.S.all('breeam').sort((a, b) => a.code.localeCompare(b.code, 'pl', { numeric: true })); const sc = B.score('achieved');
      box.innerHTML = `<div class="grid2" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);align-items:start">
        <div class="card"><div class="card-head"><h2>Kredyty</h2>${edit ? `<button class="btn sm primary" id="add">${M.icon.plus}Kredyt</button>` : ''}</div>
        ${cr.length ? `<div class="table-wrap"><table class="list"><thead><tr><th>Kod</th><th>Kredyt</th><th>Dost.</th><th>Cel</th><th>Uzysk.</th><th class="hide-m">Etap</th><th class="hide-m">Odpowiedzialny</th><th>Dowody</th><th>Status</th></tr></thead><tbody>${cr.map(c => { const evs = M.S.all('evidence').filter(x => x.creditId === c.id); return `<tr class="click" data-id="${c.id}"><td class="num">${e(c.code)}</td><td>${e(c.name)}</td><td>${e(c.avail)}</td><td>${e(c.target)}</td><td><b>${e(c.achieved)}</b></td><td class="hide-m small">${e(c.stage || '')}</td><td class="hide-m small">${e(M.S.respName(c.respId))}</td><td class="small">${evs.filter(x => x.status === 'zaakceptowany').length}/${evs.length}</td><td>${stBadge(CR_ST, c.status)}</td></tr>`; }).join('')}</tbody></table></div>` : `<div class="card-pad">${M.UI.empty('Brak kredytów. Dodaj kredyty z pre-assessmentu (kod, nazwa, liczba dostępnych i docelowych punktów).', 'leaf')}</div>`}</div>
        <div class="card"><div class="card-head"><h2>Kategorie</h2></div><table class="list"><tbody>${sc.rows.map(r => `<tr><td><b>${e(r.k)}</b> <span class="small muted">${e(catName(r.k))}</span><div class="meter" style="margin-top:4px;height:8px"><i style="width:${r.pct}%"></i></div></td><td class="nowrap small">${r.val}/${r.avail}<br>${r.w ? `waga ${r.w}%` : '<span class="muted">bez wagi</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => this.editCredit(M.S.get('breeam', tr.dataset.id)));
      const a = box.querySelector('#add'); if (a) a.onclick = () => this.editCredit({ cat: 'Man', code: '', name: '', avail: 1, target: 1, achieved: 0, stage: 'Budowa', status: 'planowany' });
    },
    editCredit(c) {
      const edit = M.P.canEdit('breeam'); const isNew = !c.id;
      const d = M.UI.drawer({ title: isNew ? 'Nowy kredyt' : `${e(c.code)} – ${e(c.name)}`, body: `
        <div class="grid3"><label class="f">Kategoria<select data-f="cat">${M.UI.opts(CATS.map(([k, l]) => [k, k + ' – ' + l]), c.cat)}</select></label><label class="f req"><span>Kod</span><input type="text" data-f="code" value="${e(c.code)}" placeholder="np. Man 03"></label><label class="f">Etap<select data-f="stage">${M.UI.opts(['Projekt', 'Budowa', 'Odbiór', 'Po oddaniu'], c.stage)}</select></label></div>
        <label class="f req"><span>Nazwa kredytu</span><input type="text" data-f="name" value="${e(c.name)}"></label>
        <div class="grid3"><label class="f">Kredyty dostępne<input type="number" min="0" data-f="avail" value="${e(c.avail)}"></label><label class="f">Cel (targeted)<input type="number" min="0" data-f="target" value="${e(c.target)}"></label><label class="f">Uzyskane / pewne<input type="number" min="0" data-f="achieved" value="${e(c.achieved)}"></label></div>
        <div class="grid2"><label class="f">Odpowiedzialny<select data-f="respId">${M.UI.respOpts(c.respId, '—')}</select></label><label class="f">Status<select data-f="status">${M.UI.opts(CR_ST.map(s => [s[0], s[1]]), c.status)}</select></label></div>
        <label class="f">Wymagania / notatki asesora <span class="hint">(przepisz z raportu asesora – AI korzysta z tego pola)</span><textarea data-f="notes" rows="6">${e(c.notes || '')}</textarea></label>`,
        footer: edit ? `${!isNew ? `<button class="btn danger" id="del">${M.icon.trash}</button><button class="btn" id="ev">${M.icon.plus}Dowód</button>` : ''}<span class="grow"></span><button class="btn primary" id="ok">Zapisz</button>` : '' });
      if (!edit) return M.UI.lockForm(d, true);
      d.querySelector('#ok').onclick = () => { const f = M.UI.read(d); if (!f.code || !f.name) return M.toast('Uzupełnij kod i nazwę', 'warn'); M.S.upsert('breeam', { ...c, ...f }); d.close(); M.render(); };
      const del = d.querySelector('#del'); if (del) del.onclick = async () => { if (await M.UI.confirm('Usunąć kredyt i jego dowody?', 'Usuń', true)) { M.S.all('evidence').filter(x => x.creditId === c.id).forEach(x => M.S.remove('evidence', x.id)); M.S.remove('breeam', c.id); d.close(); M.render(); } };
      const evb = d.querySelector('#ev'); if (evb) evb.onclick = () => { d.close(); this.editEvidence({ creditId: c.id, name: '', due: M.addDays(M.todayISO(), 14), respId: c.respId, status: 'brak', files: [] }); };
    },
    evidence(box) {
      const list = M.S.all('evidence').filter(x => M.P.isStaff() || M.P.seesRecord(x)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
      const edit = M.P.canEdit('breeam'); const t = M.todayISO();
      box.innerHTML = `<div class="card"><div class="card-head"><h2>Rejestr dowodów</h2>${edit ? `<button class="btn sm primary" id="add">${M.icon.plus}Dowód</button>` : ''}</div>
        ${list.length ? `<div class="table-wrap"><table class="list"><thead><tr><th>Kredyt</th><th>Dowód</th><th>Termin</th><th class="hide-m">Odpowiedzialny</th><th>Pliki</th><th>Status</th></tr></thead><tbody>${list.map(x => { const c = M.S.get('breeam', x.creditId) || {}; const late = x.due && x.due < t && !['zaakceptowany', 'złożony'].includes(x.status); return `<tr class="click" data-id="${x.id}"><td class="num">${e(c.code || '?')}</td><td>${e(x.name)}</td><td class="nowrap">${late ? `<b style="color:var(--danger)">${M.fmt(x.due)}</b>` : M.fmt(x.due)}</td><td class="hide-m small">${e(M.S.respName(x.respId))}</td><td>${(x.files || []).length}</td><td>${stBadge(EV_ST, x.status)}</td></tr>`; }).join('')}</tbody></table></div>` : `<div class="card-pad">${M.UI.empty('Brak dowodów w rejestrze.', 'leaf')}</div>`}</div>`;
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => this.editEvidence(M.S.get('evidence', tr.dataset.id)));
      const a = box.querySelector('#add'); if (a) a.onclick = () => { const cr = M.S.all('breeam'); if (!cr.length) return M.toast('Najpierw dodaj kredyt', 'warn'); this.editEvidence({ creditId: cr[0].id, name: '', due: M.addDays(t, 14), respId: '', status: 'brak', files: [] }); };
    },
    editEvidence(x) {
      const can = M.P.canEdit('breeam') || M.P.canEditEvidence(x); const isNew = !x.id; x.files = x.files || [];
      const d = M.UI.drawer({ title: isNew ? 'Nowy dowód' : e(x.name), body: `
        <label class="f">Kredyt<select data-f="creditId">${M.UI.opts(M.S.all('breeam').map(c => [c.id, c.code + ' – ' + c.name]), x.creditId)}</select></label>
        <label class="f req"><span>Dowód (co ma zostać przekazane)</span><textarea data-f="name" rows="2">${e(x.name)}</textarea></label>
        <div class="grid3"><label class="f">Termin<input type="date" data-f="due" value="${e(x.due || '')}"></label><label class="f">Odpowiedzialny<select data-f="respId">${M.UI.respOpts(x.respId, '—')}</select></label><label class="f">Status<select data-f="status">${M.UI.opts(EV_ST.map(s => [s[0], s[1]]), x.status)}</select></label></div>
        <label class="f">Notatki / uwagi asesora<textarea data-f="notes" rows="3">${e(x.notes || '')}</textarea></label>
        <div class="fieldset"><legend>Pliki dowodu</legend><div id="files" class="col" style="gap:6px"></div>${can ? `<button class="btn sm" id="up" style="margin-top:8px">${M.icon.upload}Dodaj pliki (PDF, zdjęcia, Excel…)</button>` : ''}</div>
        ${x.draft ? `<div class="fieldset"><legend>Projekt dokumentu (AI)</legend><div class="airesult" style="max-height:220px;overflow:auto">${M.md(x.draft)}</div>${x.missing ? `<div class="small" style="margin-top:6px"><b>Brakuje:</b>${M.md(x.missing)}</div>` : ''}</div>` : ''}`,
        footer: can ? `${!isNew && M.P.canEdit('breeam') ? `<button class="btn danger" id="del">${M.icon.trash}</button>` : ''}<button class="btn soft" id="ai">${M.icon.spark}AI: projekt dowodu</button>${x.draft ? `<button class="btn" id="pd">${M.icon.print}Druk projektu</button>` : ''}<span class="grow"></span><button class="btn primary" id="ok">Zapisz</button>` : '' });
      const drawFiles = () => { d.querySelector('#files').innerHTML = x.files.map((f, i) => `<div class="row small"><a href="#" data-dl="${i}">${M.icon.doc.replace('<svg', '<svg style="width:14px;vertical-align:-2px"')} ${e(f.name)}</a>${can ? `<button class="btn icon ghost sm right" data-rm="${i}">${M.icon.x}</button>` : ''}</div>`).join('') || '<span class="small muted">brak plików</span>';
        d.querySelectorAll('[data-dl]').forEach(a => a.onclick = async (ev) => { ev.preventDefault(); const f = x.files[+a.dataset.dl]; M.download(await M.S.getBlob(f.blobId), f.name); });
        d.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { const [f] = x.files.splice(+b.dataset.rm, 1); await M.S.delBlob(f.blobId); drawFiles(); }); };
      drawFiles();
      if (!can) return M.UI.lockForm(d, true);
      if (!M.P.canEdit('breeam')) d.querySelectorAll('[data-f=creditId],[data-f=respId],[data-f=due]').forEach(el => el.disabled = true);
      d.querySelector('#up').onclick = async () => { const fs = await M.pickFile('', true); for (const f of fs || []) { if (f.size > 25e6) { M.toast(`${f.name}: plik > 25 MB – dołącz link w notatkach`, 'warn'); continue; } let blob = f; if (/^image\/(jpeg|png|webp)/.test(f.type) && f.size > 1.5e6) blob = (await M.compressImage(f, 2000)).blob; x.files.push({ blobId: await M.S.putBlob(blob, { name: f.name }), name: f.name }); } drawFiles(); };
      d.querySelector('#ok').onclick = () => { const f = M.UI.read(d); if (!f.name.trim()) return M.toast('Opisz dowód', 'warn'); M.S.upsert('evidence', { ...x, ...f }); d.close(); M.render(); };
      const del = d.querySelector('#del'); if (del) del.onclick = async () => { if (await M.UI.confirm('Usunąć dowód?', 'Usuń', true)) { M.S.remove('evidence', x.id); d.close(); M.render(); } };
      const pd = d.querySelector('#pd'); if (pd) pd.onclick = () => M.PR.print('Projekt dowodu BREEAM', `${M.PR.header('Projekt dokumentu – dowód BREEAM', ' ' + ((M.S.get('breeam', x.creditId) || {}).code || ''))}${M.md(x.draft)}`);
      d.querySelector('#ai').onclick = () => {
        const f = M.UI.read(d); const c = M.S.get('breeam', f.creditId) || {}; const mon = M.S.all('monitoring');
        const dane = [`Monitoring budowy (${mon.length} mies.): ${mon.map(m => `${m.month}: energia ${m.kwh} kWh, woda ${m.water} m3, paliwo ${m.fuel} l, odpady ${m.waste} t (odzysk ${m.diverted} t)`).join('; ') || 'brak'}`, `Budowa: ${M.S.project.address || ''}, termin zakończenia ${M.fmt(M.S.project.end)}`].join('\n');
        M.AI.open({ key: 'breeam', title: 'Asystent AI – projekt dowodu BREEAM',
          prompt: M.AI.fill('breeam', { PROJEKT: M.S.project.name, SCHEMAT: B.cfg().scheme, KOD: c.code, NAZWA: c.name, ETAP: c.stage, WYMAGANIA: (c.notes || '') + (f.notes ? '\n' + f.notes : ''), DOWOD: f.name, DANE: dane }),
          parse: (t) => { const s = M.AI.sections(t); return s.DOKUMENT ? s : null; },
          preview: (s) => `${M.md(s.DOKUMENT)}<hr><b>Brakuje:</b>${M.md(s.BRAKUJE || '—')}`, applyLabel: 'Zapisz projekt w dowodzie',
          apply: (s) => { Object.assign(x, f, { draft: s.DOKUMENT, missing: s.BRAKUJE || '' }); if (x.status === 'brak') x.status = 'w przygotowaniu'; M.S.upsert('evidence', x); d.close(); this.editEvidence(x); } });
      };
    },
    monitoring(box, edit) {
      const list = M.S.all('monitoring').sort((a, b) => (a.month || '').localeCompare(b.month || ''));
      const sum = (k) => list.reduce((a, m) => a + (Number(m[k]) || 0), 0);
      box.innerHTML = `<div class="card"><div class="card-head"><h2>Monitoring zaplecza i odpadów (miesięcznie)</h2><button class="btn sm" id="pdf">${M.icon.print}Raport (dowód)</button><button class="btn sm" id="xls">${M.icon.xlsx}Excel</button>${edit ? `<button class="btn sm primary" id="add">${M.icon.plus}Miesiąc</button>` : ''}</div>
        <div class="small muted" style="padding:8px 16px 0">Dane zwykle wymagane przy kredytach dot. odpowiedzialnej budowy i odpadów (np. Man 03, Wst 01 w V6) – zakres potwierdź z asesorem.</div>
        <div class="table-wrap"><table class="list"><thead><tr><th>Miesiąc</th><th>Energia kWh</th><th>Woda m³</th><th>Paliwo l</th><th>Odpady t</th><th>Odzysk t</th><th>% odzysku</th><th class="hide-m">Uwagi</th><th></th></tr></thead><tbody>
        ${list.map(m => `<tr data-id="${m.id}">${['month', 'kwh', 'water', 'fuel', 'waste', 'diverted'].map(k => `<td><input type="${k === 'month' ? 'month' : 'number'}" data-k="${k}" value="${e(m[k] ?? '')}" ${edit ? '' : 'disabled'} style="min-width:${k === 'month' ? 130 : 80}px"></td>`).join('')}<td><b>${Number(m.waste) ? Math.round(Number(m.diverted) / Number(m.waste) * 100) + '%' : '—'}</b></td><td class="hide-m"><input type="text" data-k="notes" value="${e(m.notes || '')}" ${edit ? '' : 'disabled'}></td><td>${edit ? `<button class="btn icon ghost sm" data-del>${M.icon.x}</button>` : ''}</td></tr>`).join('')}
        <tr style="font-weight:800;background:var(--gr-50)"><td>Razem</td><td>${sum('kwh')}</td><td>${sum('water')}</td><td>${sum('fuel')}</td><td>${sum('waste')}</td><td>${sum('diverted')}</td><td>${sum('waste') ? Math.round(sum('diverted') / sum('waste') * 100) + '%' : '—'}</td><td></td><td></td></tr></tbody></table></div></div>`;
      box.querySelectorAll('tr[data-id]').forEach(tr => { const m = M.S.get('monitoring', tr.dataset.id); tr.querySelectorAll('[data-k]').forEach(i => i.onchange = () => { m[i.dataset.k] = i.type === 'number' ? Number(i.value) : i.value; M.S.upsert('monitoring', m); this.monitoring(box, edit); }); const d = tr.querySelector('[data-del]'); if (d) d.onclick = () => { M.S.remove('monitoring', m.id); this.monitoring(box, edit); }; });
      const a = box.querySelector('#add'); if (a) a.onclick = () => { M.S.upsert('monitoring', { month: M.todayISO().slice(0, 7), kwh: '', water: '', fuel: '', waste: '', diverted: '', notes: '' }); this.monitoring(box, edit); };
      box.querySelector('#pdf').onclick = () => M.PR.print('Monitoring budowy BREEAM', `${M.PR.header('Monitoring zużycia mediów i odpadów na budowie', '')}<table><thead><tr><th>Miesiąc</th><th>Energia [kWh]</th><th>Woda [m³]</th><th>Paliwo [l]</th><th>Odpady [t]</th><th>Odzysk [t]</th><th>% odzysku</th><th>Uwagi</th></tr></thead><tbody>${list.map(m => `<tr><td>${e(m.month)}</td><td>${e(m.kwh)}</td><td>${e(m.water)}</td><td>${e(m.fuel)}</td><td>${e(m.waste)}</td><td>${e(m.diverted)}</td><td>${Number(m.waste) ? Math.round(m.diverted / m.waste * 100) + '%' : '—'}</td><td>${e(m.notes || '')}</td></tr>`).join('')}<tr><td><b>Razem</b></td><td><b>${sum('kwh')}</b></td><td><b>${sum('water')}</b></td><td><b>${sum('fuel')}</b></td><td><b>${sum('waste')}</b></td><td><b>${sum('diverted')}</b></td><td><b>${sum('waste') ? Math.round(sum('diverted') / sum('waste') * 100) + '%' : '—'}</b></td><td></td></tr></tbody></table><p class="small muted">Źródła danych: odczyty liczników zaplecza, faktury paliwa, karty przekazania odpadów (BDO). Dokumenty źródłowe w rejestrze dowodów.</p>${M.PR.sign(['Sporządził', '', 'Kierownik budowy'])}`);
      box.querySelector('#xls').onclick = async () => { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Monitoring'); ws.addRow(['Miesiąc', 'Energia kWh', 'Woda m3', 'Paliwo l', 'Odpady t', 'Odzysk t', 'Uwagi']).font = { bold: true }; list.forEach(m => ws.addRow([m.month, m.kwh, m.water, m.fuel, m.waste, m.diverted, m.notes])); M.download(new Blob([await wb.xlsx.writeBuffer()]), 'Monitoring_BREEAM.xlsx'); };
    },
    scheme(box, edit) {
      const cfg = B.cfg(); const cats = [...new Set(M.S.all('breeam').map(c => c.cat))];
      box.innerHTML = `<div class="grid2" style="align-items:start"><div class="card card-pad col">
          <label class="f">Schemat i wersja<input type="text" id="sch" value="${e(cfg.scheme || '')}"></label>
          <label class="f">Ocena docelowa<select id="tg">${M.UI.opts(['Pass', 'Good', 'Very Good', 'Excellent', 'Outstanding'], cfg.target)}</select></label>
          <div class="small" style="font-weight:700">Progi ocen [%]</div>
          <div class="grid3">${Object.entries(cfg.thr || {}).map(([k, val]) => `<label class="f">${e(k)}<input type="number" data-thr="${e(k)}" value="${e(val)}"></label>`).join('')}</div>
          <div class="row">${Object.keys(PRESETS).map(k => `<button class="btn sm" data-pre="${e(k)}">Progi ${e(k)}</button>`).join('')}</div>
          <div class="banner warn">${M.icon.alert}<span class="small">V7: progi Pass i Good obniżone o 5 pkt proc. (25/40), pozostałe bez zmian – wg opracowań branżowych z 2025 r. Zweryfikuj z asesorem, która wersja obowiązuje Twoją rejestrację, oraz minimalne wymagania dla oceny docelowej.</span></div>
        </div>
        <div class="card card-pad col"><h2>Wagi kategorii [%]</h2><div class="small muted">Z pre-assessmentu / narzędzia asesora (zależą od wersji i typu budynku). Wynik ważony liczy się, gdy każda kategoria z kredytami ma wagę.</div>
          <div class="grid2">${(cats.length ? cats : CATS.map(c => c[0])).map(k => `<label class="f">${e(k)} – ${e(catName(k))}<input type="number" step="0.1" data-w="${e(k)}" value="${e((cfg.weights || {})[k] ?? '')}"></label>`).join('')}</div></div></div>
        ${edit ? `<div style="margin-top:12px"><button class="btn primary" id="sv">${M.icon.check}Zapisz ustawienia BREEAM</button></div>` : ''}`;
      if (!edit) return M.UI.lockForm(box, true);
      box.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { const p = PRESETS[b.dataset.pre]; box.querySelectorAll('[data-thr]').forEach(i => i.value = p[i.dataset.thr] ?? i.value); if (/V7/.test(b.dataset.pre)) box.querySelector('#sch').value = box.querySelector('#sch').value.replace(/V6|v6/, 'V7'); });
      box.querySelector('#sv').onclick = () => { cfg.scheme = box.querySelector('#sch').value; cfg.target = box.querySelector('#tg').value; box.querySelectorAll('[data-thr]').forEach(i => cfg.thr[i.dataset.thr] = Number(i.value)); cfg.weights = cfg.weights || {}; box.querySelectorAll('[data-w]').forEach(i => { if (i.value === '') delete cfg.weights[i.dataset.w]; else cfg.weights[i.dataset.w] = Number(i.value); }); M.S.upsert('projects', M.S.project); M.toast('Zapisano'); M.render(); };
    },
    reportHtml() {
      const cfg = B.cfg(); const now = B.score('achieved'), tgt = B.score('target'); const cr = M.S.all('breeam').sort((a, b) => a.code.localeCompare(b.code, 'pl', { numeric: true }));
      return `${M.PR.header('Raport statusu BREEAM', '')}
        <table class="kv"><tr><td>Schemat</td><td>${e(cfg.scheme)}</td></tr><tr><td>Ocena docelowa</td><td>${e(cfg.target)}</td></tr><tr><td>Wynik uzyskany / docelowy</td><td><b>${now.total.toFixed(1)}% (${e(now.rating)})</b> / ${tgt.total.toFixed(1)}% (${e(tgt.rating)})${now.weighted ? '' : ' – wynik bez wag kategorii (orientacyjny)'}</td></tr></table>
        <h2>Kredyty</h2><table><thead><tr><th>Kod</th><th>Kredyt</th><th>Dost.</th><th>Cel</th><th>Uzysk.</th><th>Odpowiedzialny</th><th>Status</th></tr></thead><tbody>${cr.map(c => `<tr><td>${e(c.code)}</td><td>${e(c.name)}</td><td>${e(c.avail)}</td><td>${e(c.target)}</td><td>${e(c.achieved)}</td><td>${e(M.S.respName(c.respId))}</td><td>${e(c.status)}</td></tr>`).join('')}</tbody></table>
        <h2>Dowody</h2><table><thead><tr><th>Kredyt</th><th>Dowód</th><th>Termin</th><th>Odpowiedzialny</th><th>Status</th></tr></thead><tbody>${M.S.all('evidence').map(x => `<tr><td>${e((M.S.get('breeam', x.creditId) || {}).code || '')}</td><td>${e(x.name)}</td><td>${M.fmt(x.due)}</td><td>${e(M.S.respName(x.respId))}</td><td>${e(x.status)}</td></tr>`).join('')}</tbody></table>`;
    },
    handover() {
      const list = M.S.all('evidence').filter(x => ['złożony', 'zaakceptowany', 'w przygotowaniu'].includes(x.status));
      const m = M.UI.modal({ title: 'Protokół przekazania dowodów asesorowi', body: `<div class="small muted">Zaznacz dowody przekazywane w tej paczce. Po wydruku ich status zmieni się na „Złożony”.</div><div class="col" style="gap:4px">${list.map(x => `<label class="check"><input type="checkbox" value="${x.id}" ${x.status !== 'zaakceptowany' ? 'checked' : ''}>${e((M.S.get('breeam', x.creditId) || {}).code || '')} – ${e(x.name)} <span class="muted small">(${(x.files || []).length} plików)</span></label>`).join('') || '<span class="muted">Brak dowodów gotowych do przekazania.</span>'}</div><label class="f">Asesor / odbiorca<input type="text" id="as" placeholder="imię, nazwisko, firma"></label>`, footer: `<button class="btn primary" id="go">${M.icon.print}Drukuj protokół</button>` });
      m.querySelector('#go').onclick = () => {
        const ids = [...m.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value); if (!ids.length) return M.toast('Zaznacz dowody', 'warn');
        const L = ids.map(id => M.S.get('evidence', id)); L.forEach(x => { if (x.status !== 'zaakceptowany') { x.status = 'złożony'; M.S.upsert('evidence', x, true); } }); M.S.touch('evidence');
        M.PR.print('Protokół przekazania dowodów BREEAM', `${M.PR.header('Protokół przekazania dowodów BREEAM', '')}<table class="kv"><tr><td>Data przekazania</td><td>${M.fmt(M.todayISO())}</td></tr><tr><td>Schemat</td><td>${e(B.cfg().scheme)}</td></tr><tr><td>Odbiorca</td><td>${e(m.querySelector('#as').value)}</td></tr></table><table><thead><tr><th>Lp.</th><th>Kredyt</th><th>Dowód</th><th>Pliki</th></tr></thead><tbody>${L.map((x, i) => `<tr><td>${i + 1}</td><td>${e((M.S.get('breeam', x.creditId) || {}).code || '')}</td><td>${e(x.name)}</td><td class="small">${(x.files || []).map(f => e(f.name)).join('<br>')}</td></tr>`).join('')}</tbody></table>${M.PR.sign(['Przekazał (GW)', '', 'Odebrał (asesor)'])}`);
        m.close(); M.render();
      };
    },
  };
})(window.M);
