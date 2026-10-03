/* =========================================================
   BIURO BUDOWY — Uwagi: formularz (5 pól + zdjęcia), lista, raporty wg odpowiedzialnego
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const st = { q: '', status: 'aktywne', resp: '', cat: '', plan: '', sel: new Set() };
  const ACTIVE = (i) => i.status === 'otwarta' || i.status === 'weryfikacja';
  const LABELS = { desc: 'Opis', cat: 'Kategoria', respId: 'Odpowiedzialny', due: 'Termin', status: 'Status' };

  M.modules.uwagi = {
    title: 'Rejestr uwag', icon: 'list', core: true, order: 2,
    desc: 'Wszystkie uwagi w tabeli, filtry, raporty PDF/Excel z podziałem na odpowiedzialnych, maile zbiorcze.',
    today() {
      const t = M.todayISO(); const out = []; const role = M.P.role();
      M.S.all('issues').filter(i => ACTIVE(i) && M.P.seesRecord(i)).forEach(i => {
        const dl = i.due ? M.diffDays(t, i.due) : null;
        if (i.status === 'weryfikacja' && M.P.isStaff()) out.push({ lvl: 'yel', icon: 'check', t: `${i.nr}: czeka na weryfikację`, d: `${M.S.respName(i.respId)} zgłasza wykonanie – sprawdź na budowie`, go: `rzuty/${i.planId}/${i.id}`, sort: 5 });
        else if (dl != null && dl < 0) out.push({ lvl: 'red', icon: 'pin', t: `${i.nr} po terminie (${-dl} dni)`, d: `${M.S.respName(i.respId)} · ${(i.desc || '').slice(0, 90)}`, go: `rzuty/${i.planId}/${i.id}`, sort: dl });
        else if (dl != null && dl <= 2) out.push({ lvl: 'yel', icon: 'pin', t: `${i.nr}: termin ${dl === 0 ? 'dziś' : 'za ' + dl + ' dni'}`, d: `${M.S.respName(i.respId)} · ${(i.desc || '').slice(0, 90)}`, go: `rzuty/${i.planId}/${i.id}`, sort: dl });
        else if (role === 'PROJ' && i.status === 'otwarta') out.push({ lvl: '', icon: 'pin', t: `${i.nr}: uwaga projektowa do odpowiedzi`, d: (i.desc || '').slice(0, 100), go: `rzuty/${i.planId}/${i.id}` });
      });
      return out;
    },

    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      if (rest[0] === 'po-terminie') { st.status = 'po_terminie'; }
      const edit = M.P.canEdit('uwagi');
      v.innerHTML = M.UI.head('Rejestr <span class="acc">uwag</span>', 'Filtruj, zaznacz i generuj raporty dla odpowiedzialnych.',
        `<button class="btn" id="xls">${M.icon.xlsx}Excel</button>${edit ? `<button class="btn" id="mails">${M.icon.mail}Maile do firm</button>` : ''}<button class="btn primary" id="rep">${M.icon.print}Raport uwag</button>`) +
        M.UI.readonlyBanner('uwagi') +
        `<div class="card"><div class="toolbar">
          <div class="search"><span>${M.icon.search}</span><input type="search" id="q" placeholder="Szukaj w opisie, nr…" value="${e(st.q)}"></div>
          <div class="seg" id="fSt">${[['aktywne', 'Aktywne'], ['po_terminie', 'Po terminie'], ['otwarta', 'Otwarte'], ['weryfikacja', 'Do weryf.'], ['zamknieta', 'Zamknięte'], ['wszystkie', 'Wszystkie']].map(([k, l]) => `<button data-k="${k}" class="${st.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <select id="fResp" style="width:auto;max-width:240px">${M.UI.respOpts(st.resp, 'Wszyscy odpowiedzialni')}</select>
          <select id="fCat" style="width:auto">${M.UI.opts(M.UI.ISSUE_CAT, st.cat, 'Kategorie')}</select>
          <select id="fPlan" style="width:auto;max-width:200px">${M.UI.opts(M.S.all('plans').map(p => [p.id, p.name]), st.plan, 'Wszystkie rzuty')}</select>
        </div><div class="table-wrap" id="tbl"></div></div>`;
      const draw = () => this.table(v.querySelector('#tbl'));
      v.querySelector('#q').oninput = M.debounce((ev) => { st.q = ev.target.value; draw(); }, 250);
      v.querySelectorAll('#fSt button').forEach(b => b.onclick = () => { st.status = b.dataset.k; v.querySelectorAll('#fSt button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
      v.querySelector('#fResp').onchange = (ev) => { st.resp = ev.target.value; draw(); };
      v.querySelector('#fCat').onchange = (ev) => { st.cat = ev.target.value; draw(); };
      v.querySelector('#fPlan').onchange = (ev) => { st.plan = ev.target.value; draw(); };
      v.querySelector('#rep').onclick = () => this.reportDialog({ ids: st.sel.size ? [...st.sel] : null, list: this.filtered() });
      v.querySelector('#xls').onclick = () => this.excel(st.sel.size ? this.filtered().filter(i => st.sel.has(i.id)) : this.filtered());
      const ml = v.querySelector('#mails'); if (ml) ml.onclick = () => this.mailsDialog();
      draw();
    },
    filtered() {
      const q = M.norm(st.q); const t = M.todayISO();
      return M.S.all('issues').filter(i => M.P.seesRecord(i)).filter(i => {
        if (st.status === 'aktywne' && !ACTIVE(i)) return false;
        if (st.status === 'po_terminie' && !(ACTIVE(i) && i.due && i.due < t)) return false;
        if (!['aktywne', 'po_terminie', 'wszystkie'].includes(st.status) && i.status !== st.status) return false;
        if (st.resp && i.respId !== st.resp) return false; if (st.cat && i.cat !== st.cat) return false; if (st.plan && i.planId !== st.plan) return false;
        if (q && !M.norm(`${i.nr} ${i.desc} ${M.S.respName(i.respId)}`).includes(q)) return false;
        return true;
      }).sort((a, b) => (b.nr || '').localeCompare(a.nr || ''));
    },
    async table(box) {
      const list = this.filtered(); const t = M.todayISO();
      if (!list.length) { box.innerHTML = M.UI.empty('Brak uwag w wybranym filtrze.', 'list'); return; }
      const thumbs = await Promise.all(list.map(i => i.photos && i.photos[0] ? M.S.blobURL(i.photos[0].blobId) : ''));
      box.innerHTML = `<table class="list"><thead><tr><th><input type="checkbox" id="all" title="Zaznacz wszystkie"></th><th>Nr</th><th class="hide-m"></th><th>Opis</th><th class="hide-m">Rzut</th><th class="hide-m">Kat.</th><th>Odpowiedzialny</th><th>Termin</th><th>Status</th></tr></thead><tbody>
        ${list.map((i, k) => { const pl = M.S.get('plans', i.planId); const late = ACTIVE(i) && i.due && i.due < t; return `<tr class="click" data-id="${i.id}"><td onclick="event.stopPropagation()"><input type="checkbox" data-cb="${i.id}" ${st.sel.has(i.id) ? 'checked' : ''}></td><td class="num">${e(i.nr)}</td><td class="hide-m">${thumbs[k] ? `<img src="${thumbs[k]}" style="width:40px;height:40px;object-fit:cover;border-radius:6px">` : ''}</td><td><div class="clip">${e(i.desc)}</div></td><td class="hide-m small">${e(pl ? pl.name : '')}</td><td class="hide-m small">${e(i.cat || '')}</td><td class="small">${e(M.S.respName(i.respId))}</td><td class="nowrap ${late ? '' : 'small'}">${late ? `<b style="color:var(--danger)">${M.fmt(i.due)}</b>` : M.fmt(i.due)}</td><td>${M.UI.issueSt(i.status)}</td></tr>`; }).join('')}
        </tbody></table><div class="small muted" style="padding:10px 12px">${list.length} ${M.plural(list.length, 'uwaga', 'uwagi', 'uwag')}${st.sel.size ? ` · zaznaczono ${st.sel.size} (raport/Excel tylko z zaznaczonych)` : ''}</div>`;
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => this.form(M.S.get('issues', tr.dataset.id), { onSaved: () => this.table(box) }));
      box.querySelectorAll('[data-cb]').forEach(cb => cb.onchange = () => { cb.checked ? st.sel.add(cb.dataset.cb) : st.sel.delete(cb.dataset.cb); this.table(box); });
      box.querySelector('#all').onchange = (ev) => { list.forEach(i => ev.target.checked ? st.sel.add(i.id) : st.sel.delete(i.id)); this.table(box); };
    },

    // ---------------- formularz uwagi ----------------
    form(issue, { onSaved, onMove } = {}) {
      const isNew = !issue.id; const t0 = Date.now(); const rec = M.clone(issue); rec.photos = rec.photos || [];
      const full = M.P.canEdit('uwagi'); const respond = !full && !isNew && M.P.canRespondIssue(issue); const ro = !full && !respond;
      const plan = M.S.get('plans', rec.planId);
      const quick = [[0, 'dziś'], [3, '+3 dni'], [7, '+7'], [14, '+14']];
      const d = M.UI.drawer({
        title: isNew ? 'Nowa uwaga' : `Uwaga ${e(rec.nr)} ${M.UI.issueSt(rec.status)}`,
        body: `
          ${ro ? `<div class="banner info">${M.icon.eye}<span>Podgląd – bez możliwości edycji.</span></div>` : ''}
          ${respond ? `<div class="banner info">${M.icon.edit}<span>Jako projektant możesz dopisać odpowiedź i zmienić status na „Do weryfikacji”.</span></div>` : ''}
          <div id="phBox"></div>
          <label class="f req"><span>Opis nieprawidłowości</span><textarea data-f="desc" id="fDesc" rows="4" placeholder="Co jest nie tak, gdzie, co zrobić…">${e(rec.desc || '')}</textarea></label>
          ${full ? `<div class="row"><button class="btn sm" id="dict">${M.icon.mic}Dyktuj</button><button class="btn sm soft" id="aiDesc">${M.icon.spark}AI: popraw opis</button></div>` : ''}
          <div class="grid2">
            <label class="f req"><span>Odpowiedzialny</span><select data-f="respId">${M.UI.respOpts(rec.respId)}</select></label>
            <label class="f"><span>Termin usunięcia</span><input type="date" data-f="due" id="fDue" value="${e(rec.due || '')}"></label>
          </div>
          ${full ? `<div class="chips" style="margin-top:-6px">${quick.map(([n, l]) => `<button class="chip" data-due="${n}">${l}</button>`).join('')}</div>` : ''}
          <div><div class="small" style="font-weight:700;color:var(--ink-2);margin-bottom:4px">Kategoria</div><div class="chips" id="cat">${M.UI.ISSUE_CAT.map(c => `<button class="chip ${rec.cat === c ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div></div>
          <div><div class="small" style="font-weight:700;color:var(--ink-2);margin-bottom:4px">Status</div><div class="seg" id="stat">${Object.entries(M.UI.ISSUE_ST).map(([k, [l]]) => `<button data-s="${k}" class="${rec.status === k ? 'on' : ''}" ${respond && !['otwarta', 'weryfikacja'].includes(k) ? 'disabled style="opacity:.4"' : ''}>${l}</button>`).join('')}</div></div>
          <div class="small muted">${plan ? `${M.icon.plan.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} ${e(plan.name)}` : 'Bez rzutu'}${!isNew && full && plan && onMove ? ` · <a href="#" id="mv">przesuń znacznik</a>` : ''}${!isNew ? ` · utworzył(a): ${e((M.S.person(rec.createdBy) || {}).name || '—')}, ${M.fmtTs(rec.created)}` : ''}</div>
          ${!isNew ? `<div class="fieldset"><legend>Odpowiedzi i komentarze</legend>
            <ul class="hist">${(rec.comments || []).map(c => `<li class="c"><span class="w">${e((M.S.person(c.by) || {}).name || '—')} · ${M.fmtTs(c.ts)}</span><div class="comment">${e(c.txt)}</div></li>`).join('') || '<li><span class="w">brak</span></li>'}</ul>
            ${full || respond ? `<div class="row" style="margin-top:6px"><input type="text" id="cm" placeholder="Dopisz komentarz / odpowiedź…" style="flex:1" data-keep="1"><button class="btn sm" id="cmAdd" data-keep="1">Dodaj</button></div>` : ''}</div>
            <details><summary class="small" style="cursor:pointer;font-weight:700">Historia zmian (${(rec.history || []).length})</summary><ul class="hist" style="margin-top:8px">${(rec.history || []).slice().reverse().map(h => `<li><span class="w">${M.fmtTs(h.ts)} · ${e((M.S.person(h.by) || {}).name || '—')}</span><div>${e(h.txt)}</div></li>`).join('')}</ul></details>` : ''}`,
        footer: ro ? `<button class="btn" data-close>Zamknij</button>` : `${!isNew && full ? `<button class="btn danger" id="del">${M.icon.trash}</button>` : ''}${!isNew && full && rec.respId ? `<button class="btn" id="mail">${M.icon.mail}Mail</button>` : ''}<span class="grow"></span><button class="btn primary" id="save">${M.icon.check}${isNew ? 'Zapisz uwagę' : 'Zapisz'}</button>`,
      });
      const body = d.querySelector('.body');
      M.UI.photos(d.querySelector('#phBox'), rec.photos, { editable: full });
      if (!full) { body.querySelectorAll('[data-f]').forEach(el => el.disabled = true); body.querySelectorAll('#cat .chip').forEach(b => b.disabled = true); }
      if (ro) body.querySelectorAll('#stat button').forEach(b => b.disabled = true);
      body.querySelectorAll('#cat .chip').forEach(b => b.onclick = () => { rec.cat = b.dataset.c; body.querySelectorAll('#cat .chip').forEach(x => x.classList.toggle('on', x === b)); });
      body.querySelectorAll('#stat button').forEach(b => b.onclick = () => { if (b.disabled) return; rec.status = b.dataset.s; body.querySelectorAll('#stat button').forEach(x => x.classList.toggle('on', x === b)); });
      body.querySelectorAll('[data-due]').forEach(b => b.onclick = () => { body.querySelector('#fDue').value = M.addDays(M.todayISO(), +b.dataset.due); });
      const dict = body.querySelector('#dict'); if (dict) M.UI.dictate(dict, body.querySelector('#fDesc'));
      const aiD = body.querySelector('#aiDesc'); if (aiD) aiD.onclick = () => {
        const f = M.UI.read(body);
        M.AI.open({ key: 'uwaga', title: 'Asystent AI – opis uwagi', photos: rec.photos, photoPrefix: rec.nr || 'uwaga',
          prompt: M.AI.fill('uwaga', { PROJEKT: M.S.project.name, LOKALIZACJA: plan ? plan.name + ` (x=${Math.round(rec.x * 100)}%, y=${Math.round(rec.y * 100)}% szerokości/wysokości rzutu)` : '—', KATEGORIA: rec.cat, ODPOWIEDZIALNY: M.S.respName(f.respId), NOTATKA: f.desc, ZDJECIA: M.AI.photoList(rec.photos) }),
          parse: (t) => t.trim() || null, preview: (t) => e(t), applyLabel: 'Wstaw opis', apply: (t) => { body.querySelector('#fDesc').value = t.trim(); } });
      };
      const mv = body.querySelector('#mv'); if (mv) mv.onclick = (ev) => { ev.preventDefault(); d.close(); onMove(M.S.get('issues', rec.id)); };
      const cmAdd = body.querySelector('#cmAdd'); if (cmAdd) cmAdd.onclick = () => {
        const txt = body.querySelector('#cm').value.trim(); if (!txt) return;
        const cur = M.S.get('issues', rec.id); (cur.comments = cur.comments || []).push({ ts: Date.now(), by: M.S.settings.currentUser, txt });
        (cur.history = cur.history || []).push({ ts: Date.now(), by: M.S.settings.currentUser, txt: 'Dodano komentarz' });
        M.S.upsert('issues', cur); d.close(); this.form(cur, { onSaved, onMove }); onSaved && onSaved(cur);
      };
      const cl = d.querySelector('[data-close]'); if (cl) cl.onclick = () => d.close();
      const del = d.querySelector('#del'); if (del) del.onclick = async () => { if (await M.UI.confirm(`Usunąć uwagę ${e(rec.nr)} wraz ze zdjęciami?`, 'Usuń', true)) { M.S.remove('issues', rec.id); d.close(); onSaved && onSaved(); } };
      const ml = d.querySelector('#mail'); if (ml) ml.onclick = () => M.ML.notify([M.S.get('issues', rec.id)], rec.respId);
      const sv = d.querySelector('#save'); if (sv) sv.onclick = () => {
        const f = M.UI.read(body); const old = isNew ? {} : M.S.get('issues', rec.id);
        const next = full ? { ...rec, ...f } : { ...old, status: rec.status };
        if (full && !next.desc.trim()) return M.toast('Wpisz opis uwagi', 'warn');
        if (full && !next.respId) return M.toast('Wybierz odpowiedzialnego', 'warn');
        next.history = (old.history || []).slice(); next.comments = old.comments || [];
        const who = M.S.settings.currentUser;
        if (isNew) { next.nr = M.S.nextNr('issues', 'U'); next.history.push({ ts: Date.now(), by: who, txt: 'Utworzono uwagę' }); }
        else Object.keys(LABELS).forEach(k => { if ((old[k] || '') !== (next[k] || '')) next.history.push({ ts: Date.now(), by: who, txt: `${LABELS[k]}: „${k === 'respId' ? M.S.respName(old[k]) : k === 'status' ? (M.UI.ISSUE_ST[old[k]] || [''])[0] : k === 'due' ? M.fmt(old[k]) : (old[k] || '').slice(0, 60)}” → „${k === 'respId' ? M.S.respName(next[k]) : k === 'status' ? (M.UI.ISSUE_ST[next[k]] || [''])[0] : k === 'due' ? M.fmt(next[k]) : (next[k] || '').slice(0, 60)}”` }); });
        if ((old.photos || []).length !== next.photos.length) next.history.push({ ts: Date.now(), by: who, txt: `Zdjęcia: ${(old.photos || []).length} → ${next.photos.length}` });
        const saved = M.S.upsert('issues', next); d.close(); M.toast(isNew ? `Zapisano uwagę ${saved.nr}` : 'Zapisano zmiany');
        onSaved && onSaved(saved);
        const respChanged = !isNew && old.respId !== saved.respId;
        if (full && saved.respId && (isNew || respChanged) && M.S.settings.mailAuto) setTimeout(() => M.ML.notify([saved], saved.respId, { auto: true }), 150);
      };
      if (isNew) setTimeout(() => body.querySelector('#fDesc').focus(), 250);
    },

    // ---------------- raport uwag ----------------
    reportDialog({ planId, list } = {}) {
      const all = (list || M.S.all('issues').filter(i => M.P.seesRecord(i) && (!planId || i.planId === planId)));
      const ids = st.sel.size && !planId ? all.filter(i => st.sel.has(i.id)) : all;
      const resps = [...new Set(ids.map(i => i.respId || ''))];
      const m = M.UI.modal({ title: 'Raport uwag', body: `
        <div class="small muted">W raporcie: ${ids.length} ${M.plural(ids.length, 'uwaga', 'uwagi', 'uwag')} (wg bieżącego filtra/zaznaczenia${planId ? ', z tego rzutu' : ''}).</div>
        <label class="f">Podział<select id="grp"><option value="resp">Osobna sekcja dla każdego odpowiedzialnego (nowa strona)</option><option value="none">Jedna lista</option></select></label>
        <label class="f">Tylko dla odpowiedzialnego<select id="one"><option value="">Wszyscy (${resps.length})</option>${resps.map(r => `<option value="${e(r)}">${e(M.S.respName(r))} (${ids.filter(i => (i.respId || '') === r).length})</option>`).join('')}</select></label>
        <label class="f">Statusy<select id="sts"><option value="aktywne">Tylko aktywne (otwarte + do weryfikacji)</option><option value="wszystkie">Wszystkie z listy</option></select></label>
        <div class="row"><label class="check"><input type="checkbox" id="ph" checked>Zdjęcia</label><label class="check"><input type="checkbox" id="loc" checked>Wycinek rzutu z lokalizacją</label></div>`,
        footer: `<button class="btn" id="prev">${M.icon.eye}Podgląd</button><button class="btn primary" id="go">${M.icon.print}Drukuj / PDF</button>` });
      const build = async () => {
        let L = ids.slice(); const one = m.querySelector('#one').value; if (one !== '') L = L.filter(i => (i.respId || '') === one);
        if (m.querySelector('#sts').value === 'aktywne') L = L.filter(ACTIVE);
        return this.reportHtml(L, { group: m.querySelector('#grp').value === 'resp', photos: m.querySelector('#ph').checked, loc: m.querySelector('#loc').checked });
      };
      m.querySelector('#prev').onclick = async () => { const h = await build(); M.UI.docPreview('Raport uwag', h); };
      m.querySelector('#go').onclick = async () => { const h = await build(); M.PR.print('Raport uwag', h); };
    },
    async reportHtml(list, { group = true, photos = true, loc = true } = {}) {
      const t = M.todayISO();
      const groups = group ? [...new Set(list.map(i => i.respId || ''))].map(r => ({ r, items: list.filter(i => (i.respId || '') === r) })) : [{ r: null, items: list }];
      let h = '';
      for (const g of groups) {
        const c = g.r ? M.S.company(g.r) : null;
        h += `<section class="grp">${M.PR.header('Raport uwag z budowy', g.r !== null ? ' – ' + M.S.respName(g.r) : '')}`;
        const late = g.items.filter(i => ACTIVE(i) && i.due && i.due < t).length;
        h += `<table class="kv"><tr><td>Odpowiedzialny</td><td>${e(g.r !== null ? M.S.respName(g.r) : 'wszyscy')}${c && c.email ? ' · ' + e(c.email) : ''}</td></tr><tr><td>Liczba uwag / po terminie</td><td>${g.items.length} / ${late}</td></tr></table>`;
        h += `<table><thead><tr><th>Nr</th><th>Opis</th><th>Rzut</th><th>Termin</th><th>Status</th></tr></thead><tbody>${g.items.map(i => `<tr><td><b>${e(i.nr)}</b></td><td>${e(i.desc)}</td><td>${e((M.S.get('plans', i.planId) || {}).name || '')}</td><td>${M.fmt(i.due)}</td><td><span class="st ${(M.UI.ISSUE_ST[i.status] || [])[1]}">${e((M.UI.ISSUE_ST[i.status] || ['—'])[0])}</span></td></tr>`).join('')}</tbody></table>`;
        if (photos || loc) {
          h += '<h2>Karty uwag</h2>';
          for (const i of g.items) {
            const crop = loc ? await M.PR.locationCrop(i) : '';
            h += `<div class="iss"><div><div class="hd"><span class="nr">${e(i.nr)}</span><span class="st ${(M.UI.ISSUE_ST[i.status] || [])[1]}">${e((M.UI.ISSUE_ST[i.status] || ['—'])[0])}</span><span class="small muted">${e(i.cat || '')} · termin: ${M.fmt(i.due) || '—'} · zgł. ${M.fmtTs(i.created)}</span></div><div>${e(i.desc)}</div>${(i.comments || []).length ? `<div class="small muted" style="margin-top:1.5mm">Ostatni komentarz: ${e(i.comments[i.comments.length - 1].txt)}</div>` : ''}${photos ? await M.PR.pics(i.photos || []) : ''}</div><div>${crop ? `<img class="loc" src="${crop}">` : ''}<div class="small muted">${e((M.S.get('plans', i.planId) || {}).name || '')}</div></div></div>`;
          }
        }
        h += '</section>';
      }
      return h || '<p>Brak uwag.</p>';
    },
    async excel(list) {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Uwagi', { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = [{ header: 'Nr', key: 'nr', width: 9 }, { header: 'Opis', key: 'desc', width: 60 }, { header: 'Kategoria', key: 'cat', width: 12 }, { header: 'Odpowiedzialny', key: 'resp', width: 28 }, { header: 'Termin', key: 'due', width: 12 }, { header: 'Status', key: 'st', width: 15 }, { header: 'Rzut', key: 'plan', width: 24 }, { header: 'Zgłoszono', key: 'cr', width: 17 }, { header: 'Zdjęć', key: 'ph', width: 7 }, { header: 'Ostatni komentarz', key: 'cm', width: 40 }];
      list.forEach(i => ws.addRow({ nr: i.nr, desc: i.desc, cat: i.cat, resp: M.S.respName(i.respId), due: i.due ? M.toDate(i.due) : '', st: (M.UI.ISSUE_ST[i.status] || [''])[0], plan: (M.S.get('plans', i.planId) || {}).name || '', cr: M.fmtTs(i.created), ph: (i.photos || []).length, cm: (i.comments || []).length ? i.comments[i.comments.length - 1].txt : '' }));
      const hr = ws.getRow(1); hr.font = { bold: true, color: { argb: 'FFFFFFFF' } }; hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C5356' } };
      ws.getColumn('due').numFmt = 'dd.mm.yyyy'; ws.getColumn('desc').alignment = { wrapText: true, vertical: 'top' }; ws.autoFilter = 'A1:J1';
      M.download(new Blob([await wb.xlsx.writeBuffer()]), `Uwagi_${M.safeName(M.S.project.short || M.S.project.name)}_${M.todayISO()}.xlsx`);
    },
    mailsDialog() {
      const open = M.S.all('issues').filter(ACTIVE); const by = {};
      open.forEach(i => { if (i.respId) (by[i.respId] = by[i.respId] || []).push(i); });
      const ids = Object.keys(by);
      const m = M.UI.modal({ title: 'Maile zbiorcze do odpowiedzialnych', body: ids.length ? `<div class="small muted">Każda firma dostaje listę swoich aktywnych uwag. Wygeneruj też raport PDF dla firmy i dołącz go do maila.</div><table class="list"><tbody>${ids.map(r => `<tr><td><b>${e(M.S.respName(r))}</b><div class="xs muted">${e((M.S.company(r) || {}).email || 'brak e-maila')}</div></td><td>${by[r].length} uwag</td><td style="text-align:right"><button class="btn sm" data-pdf="${r}">${M.icon.print}PDF</button> <button class="btn sm primary" data-m="${r}">${M.icon.mail}Mail</button></td></tr>`).join('')}</tbody></table>` : M.UI.empty('Brak aktywnych uwag z przypisanym odpowiedzialnym.') });
      m.querySelectorAll('[data-m]').forEach(b => b.onclick = () => M.ML.notify(by[b.dataset.m], b.dataset.m));
      m.querySelectorAll('[data-pdf]').forEach(b => b.onclick = async () => M.PR.print('Raport uwag – ' + M.S.respName(b.dataset.pdf), await this.reportHtml(by[b.dataset.pdf], { group: true })));
    },
  };
})(window.M);
