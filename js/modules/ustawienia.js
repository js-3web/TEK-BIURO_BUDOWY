/* =========================================================
   BIURO BUDOWY — Ustawienia: budowy, zespół i role, firmy (import z Excela),
   moduły (włącz/wyłącz, kreator), poczta, dane i kopie
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const TABS = [['budowa', 'Budowy'], ['zespol', 'Zespół i budowy'], ['chmura', 'Synchronizacja'], ['firmy', 'Firmy'], ['moduly', 'Moduły'], ['poczta', 'Poczta'], ['dane', 'Dane i kopie']];
  const CTYPES = [['podwykonawca', 'Podwykonawca'], ['projektant', 'Projektant'], ['dostawca', 'Dostawca'], ['inwestor', 'Inwestor / nadzór'], ['gw', 'Generalny wykonawca']];

  M.modules.ustawienia = {
    title: 'Ustawienia', icon: 'gear', order: 99,
    desc: 'Budowy, zespół i role, firmy (z Excela), moduły, poczta, kopie danych.',
    today() { if (!M.S.db.projects.length || M.FS.status === 'ok' || /Mobi|Android|iPhone/i.test(navigator.userAgent) && M.SYNC && M.SYNC.enabled()) return []; const last = M.S.settings.lastExport || 0; const days = last ? Math.floor((Date.now() - last) / 86400000) : null; return days === null || days >= 7 ? [{ lvl: days === null || days >= 14 ? 'red' : 'yel', icon: 'folder', t: days === null ? 'Nie masz jeszcze kopii danych' : `Ostatnia kopia danych: ${days} dni temu`, d: 'Dane są tylko na tym urządzeniu. Podłącz folder danych albo zapisz kopię do pliku.', go: 'ustawienia/dane', sort: 5 }] : []; },
    render(v, rest) {
      const tab = rest[0] || 'budowa';
      v.innerHTML = M.UI.head('Ustawienia', '') + M.UI.readonlyBanner('ustawienia') + `<div class="tabs">${TABS.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="body"></div>`;
      v.querySelectorAll('.tabs button').forEach(b => b.onclick = () => M.go('ustawienia/' + b.dataset.t));
      this[tab] ? this[tab](v.querySelector('#body'), M.P.canEdit('ustawienia') || !M.S.db.people.length) : this.budowa(v.querySelector('#body'), true);
    },

    // ---------------- budowy ----------------
    budowa(box, edit) {
      const ps = M.S.myProjects(); const p = M.S.project;
      box.innerHTML = `${!M.S.db.people.length ? `<div class="card card-pad col" style="margin-bottom:14px"><h2>Najpierw Ty</h2><div class="grid3"><label class="f">Imię i nazwisko<input type="text" id="meN"></label><label class="f">Rola<select id="meR">${M.UI.opts(Object.entries(M.P.ROLES).filter(([k]) => M.P.STAFF.includes(k)).map(([k, r]) => [k, r.label]), 'KB')}</select></label><label class="f">E-mail<input type="email" id="meE"></label></div></div>` : ''}
        <div class="grid2" style="grid-template-columns:280px minmax(0,1fr);align-items:start">
          <div class="card"><div class="card-head"><h2>Budowy</h2>${edit ? `<button class="btn sm primary" id="newP">${M.icon.plus}</button>` : ''}</div>${ps.map(x => `<div class="plan-list"><div class="it ${p && x.id === p.id ? 'sel' : ''}" data-id="${x.id}"><div><b>${e(x.short || x.name)}</b><div class="xs muted">${e(x.name)}</div></div></div></div>`).join('') || '<div class="card-pad small muted">Brak budów</div>'}</div>
          <div class="card card-pad col" id="pf">${p ? this.projectForm(p) : '<div class="muted">Dodaj budowę przyciskiem +.</div>'}</div></div>`;
      box.querySelectorAll('[data-id]').forEach(el => el.onclick = () => { M.S.set('currentProject', el.dataset.id); M.render(); });
      const addMe = () => { const n = box.querySelector('#meN'); if (n && n.value.trim()) { const me = M.S.upsert('people', { name: n.value.trim(), role: box.querySelector('#meR').value, email: box.querySelector('#meE').value, companyId: '' }); M.S.set('currentUser', me.id); } };
      const np = box.querySelector('#newP'); if (np) np.onclick = () => { addMe(); const x = M.DEMO.newProject(); M.S.db.projects.push(x); M.S.set('currentProject', x.id); M.S.touch('projects'); M.render(); };
      if (!p) return;
      if (!edit) return M.UI.lockForm(box.querySelector('#pf'), true);
      const pf = box.querySelector('#pf');
      pf.querySelector('#ct').onchange = (ev) => { const pr = M.FIDIC[ev.target.value]; pf.querySelectorAll('[data-dl]').forEach(i => i.value = pr[i.dataset.dl]); };
      pf.querySelector('#save').onclick = () => {
        addMe();
        Object.assign(p, M.UI.read(pf)); p.dl = {}; pf.querySelectorAll('[data-dl]').forEach(i => p.dl[i.dataset.dl] = Number(i.value) || 0);
        p.lat = p.lat === '' ? '' : Number(String(p.lat).replace(',', '.')); p.lon = p.lon === '' ? '' : Number(String(p.lon).replace(',', '.'));
        if (!p.name.trim()) return M.toast('Podaj nazwę budowy', 'warn');
        M.S.upsert('projects', p); M.toast('Zapisano budowę'); M.render();
      };
      pf.querySelector('#tplR').onclick = () => M.modules.raporty.templateEditor();
      pf.querySelector('#tplN').onclick = () => { const m = M.UI.modal({ title: 'Porządek narady (draft)', body: `<textarea id="t" rows="12">${e(p.meetingAgenda || M.DEMO.MEETING_AGENDA)}</textarea>`, footer: `<button class="btn primary" id="ok">Zapisz</button>` }); m.querySelector('#ok').onclick = () => { p.meetingAgenda = m.querySelector('#t').value; M.S.upsert('projects', p); m.close(); }; };
      const del = pf.querySelector('#delP'); if (del) del.onclick = async () => {
        if (!await M.UI.confirm(`Usunąć budowę „${e(p.name)}” ze WSZYSTKIMI danymi (uwagi, rzuty, zdjęcia, narady…)? Tej operacji nie można cofnąć – najpierw zrób kopię.`, 'Usuń budowę', true)) return;
        M.S.TABLES.forEach(t => { if (!['projects', 'people', 'companies', 'templates'].includes(t)) M.S.db[t].filter(r => r.projectId === p.id).forEach(r => M.S.blobIdsOf(r).forEach(b => M.S.delBlob(b))); if (!['projects', 'people', 'companies', 'templates', 'aiLog'].includes(t)) M.S.db[t] = M.S.db[t].filter(r => r.projectId !== p.id); });
        M.S.db.projects = M.S.db.projects.filter(x => x.id !== p.id); M.S.db.settings.currentProject = (M.S.db.projects[0] || {}).id || ''; M.S.touch('projects'); M.go('ustawienia/budowa'); M.render();
      };
    },
    projectForm(p) {
      const dl = { ...(M.FIDIC[p.contract] || M.FIDIC.FIDIC2017), ...(p.dl || {}) };
      return `<div class="grid2"><label class="f req"><span>Pełna nazwa budowy</span><input type="text" data-f="name" value="${e(p.name)}"></label><label class="f">Skrót (pasek, maile)<input type="text" data-f="short" value="${e(p.short || '')}"></label></div>
        <div class="grid2"><label class="f">Adres<input type="text" data-f="address" value="${e(p.address || '')}"></label><label class="f">Inwestor<input type="text" data-f="investor" value="${e(p.investor || '')}"></label></div>
        <div class="grid4"><label class="f">Start<input type="date" data-f="start" value="${e(p.start || '')}"></label><label class="f">Termin umowny<input type="date" data-f="end" value="${e(p.end || '')}"></label><label class="f">Szer. geogr.<input type="text" data-f="lat" value="${e(p.lat ?? '')}" placeholder="51.25"></label><label class="f">Dł. geogr.<input type="text" data-f="lon" value="${e(p.lon ?? '')}" placeholder="22.57"></label></div>
        <label class="f">Nr dziennika budowy (EDB)<input type="text" data-f="edb" value="${e(p.edb || '')}"></label>
        <div class="fieldset"><legend>Umowa i terminy (moduł Terminy umowne)</legend>
          <label class="f">Warunki umowy<select data-f="contract" id="ct">${M.UI.opts(Object.entries(M.FIDIC).map(([k, x]) => [k, x.label]), p.contract)}</select></label>
          <div class="grid4"><label class="f">Zawiadomienie [dni]<input type="number" data-dl="notice" value="${dl.notice}"></label><label class="f">Roszcz. szczeg. [dni]<input type="number" data-dl="detailed" value="${dl.detailed}"></label><label class="f">Inżynier – kwest. [dni]<input type="number" data-dl="engineer" value="${dl.engineer}"></label><label class="f">Odpowiedź/ustal. [dni]<input type="number" data-dl="determination" value="${dl.determination}"></label></div>
          <div class="xs muted">Wartości domyślne wg warunków ogólnych; zmień, jeśli warunki szczególne umowy stanowią inaczej.</div></div>
        <div class="row"><button class="btn" id="tplR">${M.icon.edit}Szablon raportu dziennego</button><button class="btn" id="tplN">${M.icon.edit}Porządek narady</button></div>
        <div class="row"><button class="btn danger" id="delP">${M.icon.trash}Usuń budowę</button><span class="grow"></span><button class="btn primary" id="save">${M.icon.check}Zapisz</button></div>`;
    },

    // ---------------- zespół ----------------
    zespol(box, edit) {
      const ps = M.S.db.people; const prj = M.S.db.projects;
      const prjTxt = (x) => x.licHash ? 'wszystkie (licencja)' : !Array.isArray(x.projectIds) ? 'wszystkie' : x.projectIds.length ? x.projectIds.map(id => (prj.find(p => p.id === id) || {}).short || (prj.find(p => p.id === id) || {}).name).filter(Boolean).join(', ') || 'brak' : 'brak';
      box.innerHTML = `<div class="banner info" style="margin-bottom:12px">${M.icon.users}<span class="small"><b>Wersja testowa:</b> pracują w niej osoby z kodem licencyjnym i mają pełny dostęp. Lista poniżej to zespół budowy – możesz już teraz dodać osoby i przypisać je do budów. Osobne logowanie każdej osoby z własnymi uprawnieniami (kierownik budowy, inżynier budowy, kierownik projektu, projektant) zacznie działać razem z serwerem i synchronizacją.</span></div>
        <div class="card"><div class="card-head"><h2>Zespół</h2>${edit ? `<button class="btn sm primary" id="add">${M.icon.plus}Osoba</button>` : ''}</div>
        <div class="table-wrap"><table class="list"><thead><tr><th>Imię i nazwisko</th><th>Rola</th><th>Firma</th><th>E-mail</th><th>Budowy</th><th></th></tr></thead><tbody>${ps.map(x => `<tr data-id="${x.id}"><td><input type="text" data-k="name" value="${e(x.name)}"></td><td><select data-k="role">${M.UI.opts(Object.entries(M.P.ROLES).map(([k, r]) => [k, r.label]), x.role)}</select></td><td><select data-k="companyId">${M.UI.opts(M.S.db.companies.map(c => [c.id, c.name]), x.companyId, '—')}</select></td><td><input type="email" data-k="email" value="${e(x.email || '')}"></td><td><button class="btn sm" data-prj ${x.licHash ? 'disabled' : ''}>${e(prjTxt(x))}</button></td><td>${x.licHash ? `<span class="badge ok" title="Osoba z kodem licencyjnym">licencja</span>` : `<button class="btn icon ghost sm" data-del>${M.icon.trash}</button>`}</td></tr>`).join('')}</tbody></table></div></div>`;
      if (!edit) return M.UI.lockForm(box, true);
      box.querySelectorAll('tr[data-id]').forEach(tr => { const x = M.S.person(tr.dataset.id);
        tr.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { x[el.dataset.k] = el.value; if (['PODW', 'PROJ'].includes(x.role) && !x.companyId) M.toast('Przypisz firmę – od niej zależy, co ta osoba zobaczy', 'warn'); M.S.upsert('people', x); });
        tr.querySelector('[data-prj]').onclick = () => { const cur = Array.isArray(x.projectIds) ? new Set(x.projectIds) : new Set(prj.map(p => p.id));
          const m = M.UI.modal({ title: `Budowy – ${e(x.name)}`, body: prj.length ? `<div class="col">${prj.map(p => `<label class="check"><input type="checkbox" data-p="${p.id}" ${cur.has(p.id) ? 'checked' : ''}>${e(p.name)}</label>`).join('')}</div>` : '<div class="muted">Brak budów.</div>', footer: '<button class="btn primary" id="ok">Zapisz</button>' });
          m.querySelector('#ok').onclick = () => { x.projectIds = [...m.querySelectorAll('[data-p]')].filter(c => c.checked).map(c => c.dataset.p); M.S.upsert('people', x); m.close(); M.render(); }; };
        const del = tr.querySelector('[data-del]'); if (del) del.onclick = async () => { if (x.id === M.S.settings.currentUser) return M.toast('Nie usuniesz osoby, jako która pracujesz', 'warn'); if (await M.UI.confirm('Usunąć osobę?', 'Usuń', true)) { M.S.remove('people', x.id); M.render(); } }; });
      box.querySelector('#add').onclick = () => { M.S.upsert('people', { name: 'Nowa osoba', role: 'IB', companyId: '', email: '', projectIds: M.S.pid ? [M.S.pid] : [] }); M.render(); };
    },

    // ---------------- firmy ----------------
    firmy(box, edit) {
      const cs = M.S.db.companies.slice().sort((a, b) => (a.type || '').localeCompare(b.type || '') || a.name.localeCompare(b.name, 'pl'));
      box.innerHTML = `<div class="card"><div class="card-head"><h2>Firmy (podwykonawcy, projektanci, dostawcy)</h2>${edit ? `<button class="btn sm" id="tpl">${M.icon.download}Szablon Excela</button><button class="btn sm" id="imp">${M.icon.upload}Import z Excela</button><button class="btn sm primary" id="add">${M.icon.plus}Firma</button>` : ''}</div>
        <div class="table-wrap"><table class="list"><thead><tr><th>Nazwa</th><th>Typ</th><th>Zakres / branża</th><th>Osoba kontaktowa</th><th>E-mail</th><th>Telefon</th><th>Budowy</th><th></th></tr></thead><tbody>${cs.map(c => `<tr data-id="${c.id}"><td><input type="text" data-k="name" value="${e(c.name)}" style="min-width:180px"></td><td><select data-k="type">${M.UI.opts(CTYPES, c.type)}</select></td><td><input type="text" data-k="scope" value="${e(c.scope || '')}"></td><td><input type="text" data-k="contact" value="${e(c.contact || '')}"></td><td><input type="email" data-k="email" value="${e(c.email || '')}" style="min-width:170px"></td><td><input type="tel" data-k="phone" value="${e(c.phone || '')}" style="width:120px"></td><td><select data-k="proj" title="Na której budowie firma jest widoczna">${M.UI.opts([['', 'wszystkie'], ...M.S.db.projects.map(p => [p.id, p.short || p.name])], (c.projectIds || [])[0] || '')}</select></td><td><button class="btn icon ghost sm" data-del>${M.icon.trash}</button></td></tr>`).join('')}</tbody></table></div></div>`;
      if (!edit) return M.UI.lockForm(box, true);
      box.querySelectorAll('tr[data-id]').forEach(tr => { const c = M.S.company(tr.dataset.id);
        tr.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { if (el.dataset.k === 'proj') c.projectIds = el.value ? [el.value] : []; else c[el.dataset.k] = el.value; M.S.upsert('companies', c); });
        tr.querySelector('[data-del]').onclick = async () => { const used = M.S.db.issues.filter(i => i.respId === c.id).length; if (await M.UI.confirm(`Usunąć firmę „${e(c.name)}”?${used ? ` Ma ${used} przypisanych uwag – pozostaną bez odpowiedzialnego.` : ''}`, 'Usuń', true)) { M.S.remove('companies', c.id); M.render(); } }; });
      box.querySelector('#add').onclick = () => { M.S.upsert('companies', { name: 'Nowa firma', type: 'podwykonawca', scope: '', email: '', projectIds: [M.S.pid].filter(Boolean) }); M.render(); };
      box.querySelector('#tpl').onclick = async () => { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Firmy'); ws.columns = ['Nazwa', 'Typ', 'Zakres', 'Osoba kontaktowa', 'E-mail', 'Telefon', 'NIP'].map(h => ({ header: h, width: 24 })); ws.addRow(['Przykład Sp. z o.o.', 'podwykonawca', 'konstrukcja stalowa', 'Jan Nowak', 'biuro@przyklad.pl', '500 000 000', '']); ws.getRow(1).font = { bold: true }; M.download(new Blob([await wb.xlsx.writeBuffer()]), 'Szablon_firmy.xlsx'); };
      box.querySelector('#imp').onclick = async () => {
        const f = await M.pickFile('.xlsx,.csv'); if (!f) return;
        try {
          let rows = [];
          if (/\.csv$/i.test(f.name)) { const t = await f.text(); const d = t.includes(';') ? ';' : ','; rows = t.split(/\r?\n/).filter(Boolean).map(l => l.split(d).map(s => s.replace(/^"|"$/g, '').trim())); }
          else { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer()); wb.worksheets[0].eachRow({ includeEmpty: false }, r => { const a = []; r.eachCell({ includeEmpty: true }, (c, i) => a[i - 1] = String(M.cellVal(c.value) ?? '').trim()); rows.push(a); }); }
          const h = (rows[0] || []).map(M.norm); const col = (...al) => h.findIndex(x => al.some(a => x.includes(a)));
          const ix = { name: col('nazwa', 'firma'), type: col('typ', 'rodzaj'), scope: col('zakres', 'branza'), contact: col('osoba', 'kontakt'), email: col('mail'), phone: col('tel'), nip: col('nip') };
          if (ix.name < 0) throw new Error('Brak kolumny „Nazwa”');
          let added = 0, upd = 0;
          rows.slice(1).forEach(r => { const name = (r[ix.name] || '').trim(); if (!name) return; const ex = M.S.db.companies.find(c => M.norm(c.name) === M.norm(name)); const typ = M.norm(r[ix.type] || ''); const rec = ex || { projectIds: [] };
            Object.assign(rec, { name, type: CTYPES.find(([k]) => typ.startsWith(k.slice(0, 5)))?.[0] || rec.type || 'podwykonawca' }); ['scope', 'contact', 'email', 'phone', 'nip'].forEach(k => { if (ix[k] >= 0 && r[ix[k]]) rec[k] = r[ix[k]]; }); M.S.upsert('companies', rec, true); ex ? upd++ : added++; });
          M.S.touch('companies'); M.toast(`Import: ${added} nowych, ${upd} zaktualizowanych`); M.render();
        } catch (err) { M.toast('Import nieudany: ' + err.message, 'err'); }
      };
    },

    // ---------------- moduły ----------------
    moduly(box, edit) {
      const built = Object.entries(M.modules).filter(([id, m]) => !['home', 'ustawienia', 'wlasne'].includes(id) && !m.hidden);
      const cm = M.S.settings.customModules || [];
      box.innerHTML = `<div class="grid2" style="align-items:start"><div class="card"><div class="card-head"><h2>Moduły wbudowane</h2></div><table class="list"><tbody>${built.map(([id, m]) => `<tr><td>${M.ico(m.icon, 18)}</td><td><b>${e(m.title)}</b><div class="xs muted">${e(m.desc || '')}</div></td><td><label class="check"><input type="checkbox" data-mod="${id}" ${M.enabled(id) ? 'checked' : ''} ${edit ? '' : 'disabled'}>włączony</label></td></tr>`).join('')}</tbody></table></div>
        <div class="col"><div class="card"><div class="card-head"><h2>Moduły własne</h2>${edit ? `<button class="btn sm primary" id="new">${M.icon.plus}Nowy moduł</button>` : ''}</div>
          ${cm.length ? `<table class="list"><tbody>${cm.map(c => `<tr><td>${M.ico(c.icon, 18)}</td><td><b>${e(c.name)}</b><div class="xs muted">${c.fields.length} pól · widzą: ${c.view.join(', ')}</div></td><td>${edit ? `<button class="btn sm" data-ed="${c.id}">${M.icon.edit}</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="card-pad small muted">Brak. Zbuduj moduł z pól (bez programowania) albo użyj gotowego wzoru.</div>'}</div>
          ${edit ? `<div class="card card-pad col"><h2>Gotowe wzory modułów</h2>${M.CUSTOM_PRESETS.map((p, i) => `<div class="row"><div class="grow"><b>${e(p.name)}</b><div class="xs muted">${e(p.desc)}</div></div><button class="btn sm" data-pre="${i}">${M.icon.plus}Dodaj</button></div>`).join('')}</div>` : ''}
          <div class="banner info">${M.icon.cube}<span class="small">Moduł „na zamówienie” z własną logiką (obliczenia, integracje) dopisuje programista: nowy plik w <span class="mono">js/modules/</span> + jedna linia w <span class="mono">index.html</span>. Sam pojawi się na pulpicie.</span></div></div></div>`;
      if (!edit) return;
      box.querySelectorAll('[data-mod]').forEach(c => c.onchange = () => { M.S.set('modules', { ...M.S.settings.modules, [c.dataset.mod]: c.checked ? undefined : false }); });
      box.querySelector('#new').onclick = () => M.modules.wlasne.builder(null, () => M.render());
      box.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => M.modules.wlasne.builder(cm.find(c => c.id === b.dataset.ed), () => M.render()));
      box.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { const p = M.clone(M.CUSTOM_PRESETS[+b.dataset.pre]); M.S.set('customModules', [...cm, { ...p, id: 'm' + M.uid(), enabled: true, view: [...M.P.ALL], edit: [...M.P.STAFF] }]); M.toast(`Dodano moduł „${p.name}”`); M.render(); });
    },

    // ---------------- poczta ----------------
    poczta(box, edit) {
      const s = M.S.settings;
      box.innerHTML = `<div class="card card-pad col" style="max-width:720px">
        <label class="check"><input type="checkbox" id="auto" ${s.mailAuto ? 'checked' : ''}>Po zapisaniu uwagi z przypisaną firmą od razu przygotuj powiadomienie</label>
        <label class="f">Podpis w mailach<textarea id="sig" rows="4">${e(s.mailSignature || '')}</textarea></label>
        <div class="banner info">${M.icon.mail}<span class="small">Prototyp HTML nie może sam wysyłać poczty (brak serwera). Przygotowuje wiadomość w Outlooku/Thunderbirdzie lub plik .eml ze zdjęciami. Automatyczną wysyłkę dodamy w wersji z serwerem (np. przez Microsoft 365 firmy – wymaga zgody działu IT).</span></div>
        ${edit ? `<div><button class="btn primary" id="sv">Zapisz</button></div>` : ''}</div>`;
      if (!edit) return M.UI.lockForm(box, true);
      box.querySelector('#sv').onclick = () => { M.S.set('mailAuto', box.querySelector('#auto').checked); M.S.set('mailSignature', box.querySelector('#sig').value); M.toast('Zapisano'); };
    },

    // ---------------- synchronizacja (Supabase) ----------------
    chmura(box, edit) {
      const Y = M.SYNC; const c = Y.cfg(); const st = Y.state; const on = !!st.email; const conf = Y.adapter.configured();
      box.innerHTML = `<div class="grid2" style="align-items:start"><div class="col">
          <div class="card card-pad col"><h2>Synchronizacja z chmurą</h2>
            ${!conf ? `<div class="banner warn">${M.icon.alert}<span>Synchronizacja nie jest skonfigurowana. Wpisz adres projektu i klucz publiczny Supabase – poniżej (tylko to urządzenie) albo w pliku <span class="mono">js/konfiguracja.js</span> (wszystkie urządzenia). Instrukcja: <b>SUPABASE_KROK_PO_KROKU.md</b>.</span></div>` : on ? `<div class="banner ${Y.error ? 'or' : 'ok'}">${Y.error ? M.icon.alert : M.icon.check}<span>${Y.error ? `<b>Błąd:</b> ${e(Y.error)}` : `Zalogowano jako <b>${e(st.email)}</b>. Ostatnia synchronizacja: <b>${st.lastOk ? e(M.fmtTs(st.lastOk)) : 'jeszcze nie było'}</b>. Do wysłania: <b>${Y.pending()}</b>.`}</span></div>` : `<div class="banner info">${M.icon.lock}<span>Zaloguj się kontem założonym w Supabase. Dane z tego urządzenia połączą się z danymi w chmurze – niczego nie kasuje.</span></div>`}
            ${conf && !on ? `<div class="grid2"><label class="f">E-mail<input type="email" id="le" autocomplete="username"></label><label class="f">Hasło<input type="password" id="lp" autocomplete="current-password"></label></div><div><button class="btn primary" id="login">${M.icon.check}Zaloguj i synchronizuj</button></div>` : ''}
            ${on ? `<div class="row"><button class="btn primary" id="now">${M.icon.download}Synchronizuj teraz</button><button class="btn" id="files">${M.icon.camera}Pobierz wszystkie zdjęcia i rzuty</button><button class="btn ghost" id="logout">Wyloguj</button></div><div class="small muted">„Pobierz wszystkie zdjęcia i rzuty” przyda się przed wyjściem w miejsce bez zasięgu. Normalnie pliki pobierają się wtedy, gdy są potrzebne.</div>` : ''}
            ${conf ? `<div class="divider"></div><div class="row"><button class="btn" id="test">${M.icon.shield}Test połączenia</button><span class="small muted">Sprawdza po kolei: logowanie, tabelę, zapis, magazyn plików.</span></div><div id="tres"></div>` : ''}
          </div>
          <div class="card card-pad col"><h2>Połączenie</h2><label class="f">Adres projektu (Project URL)<input type="text" id="cu" value="${e(c.url)}" placeholder="https://xxxxxxxx.supabase.co"></label><label class="f">Klucz publiczny (publishable / anon)<input type="text" id="ck" value="${e(c.key)}" placeholder="sb_publishable_… albo eyJ…"></label>
            <div class="row"><button class="btn" id="csave">Zapisz na tym urządzeniu</button><span class="small muted">${(M.CLOUD_CFG || {}).url ? 'Wartości z pliku konfiguracja.js. Zmiana tutaj dotyczy tylko tego urządzenia.' : 'Żeby nie wpisywać tego na każdym urządzeniu, uzupełnij plik js/konfiguracja.js i opublikuj go.'}</span></div></div>
        </div>
        <div class="col"><div class="card card-pad col"><h2>Jak to działa</h2><div class="steps">
            <div class="step"><span class="n">1</span><div>Każde urządzenie ma pełną kopię danych i działa <b>bez internetu</b>. Zmiany wysyłają się, gdy wróci sieć.</div></div>
            <div class="step"><span class="n">2</span><div>Synchronizacja rusza sama: po każdej zmianie, co ok. 45 sekund i po powrocie do aplikacji. Stan widać w pasku u góry.</div></div>
            <div class="step"><span class="n">3</span><div>Gdy ten sam rekord zmienią dwie osoby naraz, zostaje <b>późniejsza</b> zmiana. Dlatego jednego wpisu nie edytujcie równocześnie.</div></div>
            <div class="step"><span class="n">4</span><div>Folder danych i kopie do pliku działają dalej – darmowy plan Supabase nie robi kopii zapasowych.</div></div></div></div>
          <div class="card"><div class="card-head"><h2>Dziennik konfliktów</h2><span class="badge">${(st.conflicts || []).length}</span></div>${(st.conflicts || []).length ? `<table class="list"><tbody>${st.conflicts.map(x => `<tr><td class="num nowrap">${e(M.fmtTs(x.ts))}</td><td class="small"><b>${e(x.tbl)}</b> · ${e(x.what)}${x.by ? `<div class="xs muted">w chmurze zmienił: ${e(x.by)}</div>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="card-pad small muted">Brak konfliktów.</div>'}</div></div></div>`;
      const on2 = (id, fn) => { const b = box.querySelector(id); if (b) b.onclick = fn; };
      on2('#csave', () => { localStorage.setItem('tekbb-cloud', JSON.stringify({ url: box.querySelector('#cu').value.trim(), key: box.querySelector('#ck').value.trim() })); M.toast('Zapisano'); Y.ui(); M.render(); });
      on2('#login', async () => { const b = box.querySelector('#login'); b.disabled = true; try { const r = await Y.signIn(box.querySelector('#le').value, box.querySelector('#lp').value); if (r && r.error) M.toast(r.error, 'err'); else M.toast('Zalogowano – dane zsynchronizowane'); } catch (err) { M.toast(Y.explain(err), 'err'); } M.render(); });
      on2('#logout', async () => { if (await M.UI.confirm('Wylogować z chmury? Dane zostaną na tym urządzeniu, ale przestaną się synchronizować.', 'Wyloguj')) { await Y.signOut(); M.render(); } });
      on2('#now', async () => { const r = await Y.run(); M.toast(r.error ? r.error : r.skipped ? 'Synchronizacja już trwa albo brak internetu' : `Pobrano ${r.applied}, wysłano ${r.pushed + r.deleted}, pliki ${r.files}`, r.error ? 'err' : ''); M.render(); });
      on2('#files', async () => { M.toast('Pobieram pliki…'); const r = await Y.fetchAllBlobs(); M.toast(`Pliki na urządzeniu: ${r.all}, pobrano teraz: ${r.got}`); });
      on2('#test', async () => { const t = box.querySelector('#tres'); t.innerHTML = '<div class="small muted">Sprawdzam…</div>'; const r = await Y.selfTest(); t.innerHTML = `<table class="list"><tbody>${r.map(x => `<tr><td style="width:1%">${x.ok ? '<span class="st done">ok</span>' : '<span class="st open">błąd</span>'}</td><td><b>${e(x.name)}</b><div class="small ${x.ok ? 'muted' : ''}">${e(x.d)}</div></td></tr>`).join('')}</tbody></table>${r.every(x => x.ok) ? `<div class="banner ok">${M.icon.check}<span>Wszystko działa.</span></div>` : ''}`; });
    },

    // ---------------- dane ----------------
    dane(box, edit) {
      const n = (t) => M.S.db[t].length; const FS = M.FS;
      box.innerHTML = `<div class="grid2" style="align-items:start">
        <div class="card card-pad col"><h2>Gdzie są dane?</h2>
          <div class="small">Dane zapisują się <b>na tym urządzeniu</b> (w tej przeglądarce)${M.SYNC && M.SYNC.enabled() ? ' i <b>synchronizują się z chmurą</b>' : '. Synchronizację między urządzeniami włączysz w zakładce „Synchronizacja”'}. Darmowa chmura nie robi kopii zapasowych. Dlatego:</div>
          <div class="row"><span class="light ${FS.status === 'ok' ? 'g' : FS.status === 'prompt' ? 'y' : 'r'}"></span><b>Folder danych:</b> ${FS.status === 'ok' ? e(FS.handle.name) + ' – autozapis + kopia dzienna' : FS.status === 'prompt' ? 'wstrzymany (kliknij „Wznów”)' : FS.status === 'unsupported' ? 'niedostępny w tej przeglądarce (użyj Edge/Chrome)' : 'niepołączony'}</div>
          <div class="row">${FS.status === 'unsupported' ? '' : FS.status === 'ok' ? `<button class="btn" id="fsR">${M.icon.upload}Odtwórz z folderu</button><button class="btn ghost" id="fsD">Odłącz</button>` : `<button class="btn primary" id="fsC">${M.icon.folder}${FS.status === 'prompt' ? 'Wznów autozapis' : 'Wybierz folder danych'}</button>`}</div>
          <div class="divider"></div>
          <h3>Pełna kopia (baza + zdjęcia) do pliku</h3><div class="small muted">Do przeniesienia na inny komputer lub telefon albo jako archiwum.</div>
          <div class="row"><button class="btn" id="exp">${M.icon.download}Zapisz kopię (.json)</button>${edit ? `<button class="btn" id="imp">${M.icon.upload}Wczytaj kopię</button>` : ''}</div></div>
        <div class="card card-pad col"><h2>Zawartość</h2>
          <table class="list"><tbody>${[['projects', 'Budowy'], ['plans', 'Rzuty'], ['issues', 'Uwagi'], ['meetings', 'Narady'], ['reports', 'Raporty'], ['protocols', 'Protokoły'], ['tasks', 'Zadania harmonogramu'], ['breeam', 'Kredyty BREEAM'], ['evidence', 'Dowody BREEAM'], ['events', 'Zdarzenia kontraktowe'], ['companies', 'Firmy'], ['people', 'Osoby']].map(([t, l]) => `<tr><td>${l}</td><td style="text-align:right"><b>${n(t)}</b></td></tr>`).join('')}</tbody></table>
          ${edit ? `<div class="divider"></div><div class="row"><button class="btn danger" id="wipe">${M.icon.trash}Wyczyść wszystkie dane</button></div>` : ''}
          <div class="xs muted">Wersja: ${e(M.APP_VERSION)} · licencja: ${e((M.LIC.get() || {}).label || '')}</div></div></div>`;
      const c = box.querySelector('#fsC'); if (c) c.onclick = async () => { FS.status === 'prompt' ? await FS.resume() : await FS.connect(); M.render(); };
      const d = box.querySelector('#fsD'); if (d) d.onclick = async () => { await FS.disconnect(); M.render(); };
      const r = box.querySelector('#fsR'); if (r) r.onclick = async () => { if (await M.UI.confirm('Zastąpić dane w przeglądarce danymi z folderu?', 'Odtwórz', true)) { try { await FS.restore(); M.toast('Odtworzono z folderu'); } catch (err) { M.toast(err.message, 'err'); } } };
      box.querySelector('#exp').onclick = async () => { M.toast('Przygotowuję kopię…'); M.S.set('lastExport', Date.now()); M.download(new Blob([await M.S.exportFull()], { type: 'application/json' }), `BiuroBudowy_kopia_${M.todayISO()}.json`); };
      const im = box.querySelector('#imp'); if (im) im.onclick = async () => { const f = await M.pickFile('.json'); if (!f) return; if (!await M.UI.confirm('Wczytanie kopii ZASTĄPI wszystkie obecne dane. Kontynuować?', 'Wczytaj', true)) return; try { await M.S.importFull(await f.text()); M.toast('Wczytano kopię'); M.go(''); } catch (err) { M.toast(err.message, 'err'); } };
      const w = box.querySelector('#wipe'); if (w) w.onclick = async () => { if (await M.UI.confirm('Usunąć WSZYSTKIE dane z tej przeglądarki? Folder danych, pliki kopii i dane w chmurze zostają; to urządzenie zostanie wylogowane z chmury.', 'Usuń wszystko', true)) { await M.S.wipe(); M.LIC.ensureUser(); M.go(''); M.render(); } };
    },
  };
})(window.M);
