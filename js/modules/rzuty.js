/* =========================================================
   BIURO BUDOWY — TRZON: rzuty obiektu i znaczniki uwag
   ---------------------------------------------------------
   • wgrywanie rzutu: JPG/PNG albo PDF (strona PDF zamieniana raz na obraz)
   • przybliżanie: kółko myszy / dwa palce, przesuwanie: przeciągnięcie
   • „+ Uwaga” → stuknij miejsce na rzucie → formularz (5 pól + zdjęcia)
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const st = { planId: null, adding: false, moving: null, sel: null, flt: { status: 'aktywne', resp: '', cat: '' }, view: null };

  M.modules.rzuty = {
    title: 'Rzuty i uwagi', icon: 'plan', core: true, order: 1,
    desc: 'Rzuty obiektu ze znacznikami uwag. Zdjęcie z telefonu → znacznik → odpowiedzialny → mail.',
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      const plans = M.S.all('plans');
      if (rest[0] === 'dodaj') {
        if (!plans.length) { M.toast('Najpierw wgraj rzut', 'warn'); return this.list(v); }
        if (plans.length === 1 || st.planId && plans.some(p => p.id === st.planId)) { st.adding = true; return this.viewer(v, st.planId && plans.some(p => p.id === st.planId) ? st.planId : plans[0].id); }
        this.list(v); return this.choosePlan(plans, (id) => { st.adding = true; M.go('rzuty/' + id); });
      }
      if (rest[0] && M.S.get('plans', rest[0])) { if (rest[1]) st.sel = rest[1]; return this.viewer(v, rest[0]); }
      this.list(v);
    },

    // ---------------- lista rzutów ----------------
    async list(v) {
      const plans = M.S.all('plans'); const edit = M.P.canEdit('rzuty');
      const counts = (pid) => M.S.all('issues').filter(i => i.planId === pid && (i.status === 'otwarta' || i.status === 'weryfikacja') && M.P.seesRecord(i)).length;
      v.innerHTML = M.UI.head('Rzuty <span class="acc">i uwagi</span>', 'Wybierz rzut, aby zobaczyć znaczniki i dodawać uwagi.', edit ? `<button class="btn primary" id="up">${M.icon.upload}Wgraj rzut (PDF/JPG/PNG)</button>` : '') +
        (plans.length ? `<div class="plans-grid">${plans.map(p => `<button class="plan-card" data-id="${p.id}"><div class="pv" data-blob="${p.blobId}"></div><div class="tx"><b>${e(p.name)}</b><div class="row small muted" style="margin-top:4px"><span>${e(p.level || '')}</span>${p.rev ? `<span class="badge">${e(p.rev)}</span>` : ''}<span class="right badge ${counts(p.id) ? 'or' : ''}">${counts(p.id)} otw.</span></div></div></button>`).join('')}</div>`
          : `<div class="card card-pad">${M.UI.empty('Brak rzutów. Wgraj pierwszy rzut obiektu – PDF z projektu albo zdjęcie/skan.', 'plan')}</div>`);
      v.querySelectorAll('.plan-card').forEach(b => b.onclick = () => M.go('rzuty/' + b.dataset.id));
      v.querySelectorAll('.pv[data-blob]').forEach(async d => { d.style.backgroundImage = `url(${await M.S.blobURL(d.dataset.blob)})`; });
      const up = v.querySelector('#up'); if (up) up.onclick = () => this.upload();
    },
    choosePlan(plans, cb) {
      const m = M.UI.modal({ title: 'Na którym rzucie dodać uwagę?', body: `<div class="col">${plans.map(p => `<button class="btn big" data-id="${p.id}" style="justify-content:flex-start">${M.icon.plan}${e(p.name)} <span class="muted small">${e(p.level || '')}</span></button>`).join('')}</div>` });
      m.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { m.close(); cb(b.dataset.id); });
    },

    // ---------------- wgrywanie rzutu ----------------
    async upload(replace) {
      const f = await M.pickFile('.pdf,image/png,image/jpeg,image/webp'); if (!f) return;
      let img;
      try {
        if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) img = await this.pdfToImage(f);
        else if (f.size > 8e6) img = await M.compressImage(f, 4200, 0.9);
        else { const u = URL.createObjectURL(f); const im = await M.loadImage(u); URL.revokeObjectURL(u); img = { blob: f, w: im.naturalWidth, h: im.naturalHeight }; }
      } catch (err) { console.error(err); return M.toast('Nie udało się wczytać rzutu: ' + err.message, 'err'); }
      if (!img) return;
      const name = f.name.replace(/\.[^.]+$/, '');
      const m = M.UI.modal({ title: replace ? 'Nowa wersja rzutu' : 'Nowy rzut', body: `
        <label class="f req"><span>Nazwa rzutu</span><input type="text" id="pn" value="${e(replace ? replace.name : name)}"></label>
        <div class="grid2"><label class="f">Kondygnacja / poziom<input type="text" id="pl" value="${e(replace ? replace.level || '' : '')}" placeholder="np. Parter, Dach, +4,20"></label><label class="f">Rewizja rysunku<input type="text" id="pr" value="" placeholder="np. rew. C z 12.09"></label></div>
        <div class="small muted">Obraz: ${img.w} × ${img.h} px, ${(img.blob.size / 1e6).toFixed(1)} MB.${replace ? ' Znaczniki zostaną na swoich miejscach – sprawdź je, jeśli zmienił się kadr rysunku.' : ''}</div>`,
        footer: `<button class="btn primary" id="ok">${M.icon.check}Zapisz rzut</button>` });
      m.querySelector('#ok').onclick = async () => {
        const blobId = await M.S.putBlob(img.blob, { name: f.name, w: img.w, h: img.h });
        const rec = replace || { projectId: M.S.pid };
        if (replace && replace.blobId) { (rec.versions = rec.versions || []).push({ blobId: replace.blobId, rev: replace.rev, ts: Date.now() }); }
        Object.assign(rec, { name: m.querySelector('#pn').value.trim() || name, level: m.querySelector('#pl').value.trim(), rev: m.querySelector('#pr').value.trim() || rec.rev || '', blobId, w: img.w, h: img.h });
        M.S.upsert('plans', rec); m.close(); M.toast('Rzut zapisany'); M.go('rzuty/' + rec.id);
      };
    },
    /** PDF → obraz. pdf.js ładowany tylko teraz; działa bez internetu (plik lokalny). */
    async pdfToImage(file) {
      await M.loadScript('js/lib/pdf.worker.min.js'); // „fałszywy worker” – działa także z pliku (file://)
      await M.loadScript('js/lib/pdf.min.js');
      const lib = window.pdfjsLib; if (!lib) throw new Error('Brak biblioteki pdf.js');
      const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
      let pageNo = 1;
      if (pdf.numPages > 1) { const a = prompt(`PDF ma ${pdf.numPages} stron. Którą stronę wczytać jako rzut?`, '1'); if (a == null) return null; pageNo = Math.min(pdf.numPages, Math.max(1, parseInt(a, 10) || 1)); }
      const page = await pdf.getPage(pageNo); const vp1 = page.getViewport({ scale: 1 });
      const scale = Math.min(4, 4200 / Math.max(vp1.width, vp1.height)); const vp = page.getViewport({ scale });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      M.toast('Przetwarzam PDF…');
      await page.render({ canvasContext: g, viewport: vp }).promise;
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      return { blob, w: c.width, h: c.height };
    },

    // ---------------- przeglądarka rzutu ----------------
    async viewer(v, planId) {
      const plan = M.S.get('plans', planId); st.planId = planId; const editable = M.P.canEdit('uwagi');
      const url = await M.S.blobURL(plan.blobId);
      v.innerHTML = `
        <div class="page-head"><div><h1>${e(plan.name)}</h1><div class="sub">${e(plan.level || '')} ${plan.rev ? '· ' + e(plan.rev) : ''}</div></div>
          <div class="actions"><button class="btn ghost" id="back">${M.icon.back}Rzuty</button>${M.P.canEdit('rzuty') ? `<button class="btn" id="more">${M.icon.edit}Rzut…</button>` : ''}<button class="btn" id="rep">${M.icon.print}Raport z rzutu</button></div></div>
        <div class="plan-layout">
          <div class="plan-stage ${st.adding ? 'adding' : ''}" id="stage">
            <div class="plan-canvas" id="pc"><img id="pimg" src="${url}" width="${plan.w}" height="${plan.h}" alt=""></div>
            <div id="pins" style="position:absolute;inset:0;pointer-events:none"></div>
            <div class="plan-ctrl"><button class="btn icon" id="zin" title="Przybliż">${M.icon.zoomin}</button><button class="btn icon" id="zout" title="Oddal">${M.icon.zoomout}</button><button class="btn icon" id="zfit" title="Cały rzut">${M.icon.fit}</button></div>
            <div class="plan-hint ${st.adding || st.moving ? '' : 'hidden'}" id="hint">${st.moving ? 'Stuknij nowe miejsce znacznika' : 'Stuknij miejsce uwagi na rzucie'} · <a href="#" id="cancelAdd" style="color:#FFB39C">anuluj</a></div>
            ${editable ? `<div class="plan-fab"><button class="btn primary big" id="addBtn">${M.icon.plus}Uwaga</button></div>` : ''}
          </div>
          <div class="card">
            <div class="toolbar" style="flex-direction:column;align-items:stretch">
              <div class="seg" id="fSt">${[['aktywne', 'Aktywne'], ['otwarta', 'Otwarte'], ['weryfikacja', 'Do weryf.'], ['zamknieta', 'Zamknięte'], ['wszystkie', 'Wszystkie']].map(([k, l]) => `<button data-k="${k}" class="${st.flt.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
              <div class="row"><select id="fResp" style="flex:1">${M.UI.respOpts(st.flt.resp, 'Wszyscy odpowiedzialni')}</select><select id="fCat" style="width:130px">${M.UI.opts(M.UI.ISSUE_CAT, st.flt.cat, 'Kategorie')}</select></div>
            </div>
            <div class="plan-list" id="plist"></div>
          </div>
        </div>`;
      v.querySelector('#back').onclick = () => { st.adding = false; M.go('rzuty'); };
      v.querySelector('#rep').onclick = () => M.modules.uwagi.reportDialog({ planId });
      const more = v.querySelector('#more'); if (more) more.onclick = () => M.UI.menu(more, [
        { label: 'Wgraj nową wersję rzutu', icon: 'upload', run: () => this.upload(plan) },
        { label: 'Zmień nazwę / poziom', icon: 'edit', run: () => { const n = prompt('Nazwa rzutu:', plan.name); if (n) { plan.name = n; const l = prompt('Kondygnacja / poziom:', plan.level || ''); if (l != null) plan.level = l; M.S.upsert('plans', plan); M.render(); } } },
        { label: 'Usuń rzut', icon: 'trash', run: async () => { const n = M.S.all('issues').filter(i => i.planId === plan.id).length; if (n) return M.toast(`Na rzucie jest ${n} uwag – najpierw je przenieś lub usuń.`, 'warn'); if (await M.UI.confirm('Usunąć rzut?', 'Usuń', true)) { M.S.remove('plans', plan.id); M.go('rzuty'); } } },
      ]);
      const stage = v.querySelector('#stage'), pc = v.querySelector('#pc'), pinsBox = v.querySelector('#pins');
      const view = st.view && st.view.planId === planId ? st.view : { planId, s: 1, tx: 0, ty: 0, fitted: false };
      st.view = view;
      const apply = () => { pc.style.transform = `translate(${view.tx}px,${view.ty}px) scale(${view.s})`; placePins(); };
      const fit = () => { const r = stage.getBoundingClientRect(); view.s = Math.min(r.width / plan.w, r.height / plan.h) * 0.96; view.tx = (r.width - plan.w * view.s) / 2; view.ty = (r.height - plan.h * view.s) / 2; apply(); };
      const zoomAt = (k, cx, cy) => { const ns = Math.max(0.03, Math.min(6, view.s * k)); const kk = ns / view.s; view.tx = cx - (cx - view.tx) * kk; view.ty = cy - (cy - view.ty) * kk; view.s = ns; apply(); };
      const visible = () => M.S.all('issues').filter(i => i.planId === planId && M.P.seesRecord(i)).filter(i => {
        const f = st.flt; if (f.status === 'aktywne' && !(i.status === 'otwarta' || i.status === 'weryfikacja')) return false;
        if (!['aktywne', 'wszystkie'].includes(f.status) && i.status !== f.status) return false;
        if (f.resp && i.respId !== f.resp) return false; if (f.cat && i.cat !== f.cat) return false; return true;
      }).sort((a, b) => (b.nr || '').localeCompare(a.nr || ''));
      let list = visible();
      const placePins = () => {
        pinsBox.innerHTML = list.map(i => `<div class="pin ${(M.UI.ISSUE_ST[i.status] || [])[1] || ''} ${st.sel === i.id ? 'sel' : ''}" data-id="${i.id}" style="left:${view.tx + i.x * plan.w * view.s}px;top:${view.ty + i.y * plan.h * view.s}px" title="${e(i.nr + ' – ' + (i.desc || ''))}"><div class="head"><span>${e(String(i.nr || '').replace(/^\D+-0*/, ''))}</span></div></div>`).join('');
        pinsBox.querySelectorAll('.pin').forEach(p => { p.onpointerdown = (ev) => ev.stopPropagation(); p.onclick = (ev) => { ev.stopPropagation(); openIssue(p.dataset.id); }; });
      };
      const drawList = async () => {
        const box = v.querySelector('#plist');
        if (!list.length) { box.innerHTML = M.UI.empty(editable ? 'Brak uwag w filtrze. Kliknij „+ Uwaga” i wskaż miejsce.' : 'Brak uwag w filtrze.', 'pin'); return; }
        const thumbs = await Promise.all(list.map(i => i.photos && i.photos[0] ? M.S.blobURL(i.photos[0].blobId) : ''));
        box.innerHTML = list.map((i, k) => `<div class="it ${st.sel === i.id ? 'sel' : ''}" data-id="${i.id}">${thumbs[k] ? `<img class="thumb" src="${thumbs[k]}">` : `<div class="thumb" style="display:grid;place-items:center;color:var(--ink-3)">${M.ico('camera', 18)}</div>`}<div class="grow" style="min-width:0"><div class="row"><span class="nr">${e(i.nr)}</span>${M.UI.issueSt(i.status)}</div><div class="small clip" style="max-width:230px">${e(i.desc || '')}</div><div class="xs muted">${e(M.S.respName(i.respId))}${i.due ? ' · ' + (i.due < M.todayISO() && i.status !== 'zamknieta' ? '<b style="color:var(--danger)">' + M.fmt(i.due) + '</b>' : M.fmt(i.due)) : ''}</div></div></div>`).join('');
        box.querySelectorAll('.it').forEach(el => el.onclick = () => { const i = M.S.get('issues', el.dataset.id); st.sel = i.id; const r = stage.getBoundingClientRect(); view.tx = r.width / 2 - i.x * plan.w * view.s; view.ty = r.height / 2 - i.y * plan.h * view.s; if (view.s < 0.35) { zoomAt(0.5 / view.s, r.width / 2, r.height / 2); } apply(); drawList(); openIssue(i.id); });
      };
      const refresh = () => { list = visible(); placePins(); drawList(); };
      const openIssue = (id) => { st.sel = id; placePins(); M.modules.uwagi.form(M.S.get('issues', id), { onSaved: refresh, onMove: (iss) => { st.moving = iss; setMode(); } }); };
      const setMode = () => { stage.classList.toggle('adding', st.adding || !!st.moving); const h = v.querySelector('#hint'); h.classList.toggle('hidden', !(st.adding || st.moving)); h.firstChild.textContent = st.moving ? 'Stuknij nowe miejsce znacznika ' + st.moving.nr + ' · ' : 'Stuknij miejsce uwagi na rzucie · '; };

      // ----- obsługa myszy / dotyku -----
      const ptrs = new Map(); let start = null, moved = false, pinch = null;
      stage.addEventListener('pointerdown', (ev) => { stage.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); moved = false; start = { x: ev.clientX, y: ev.clientY, tx: view.tx, ty: view.ty };
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s }; } });
      stage.addEventListener('pointermove', (ev) => {
        if (!ptrs.has(ev.pointerId)) return; ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        const r = stage.getBoundingClientRect();
        if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt((pinch.s * d / pinch.d) / view.s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); moved = true; return; }
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y; if (Math.hypot(dx, dy) > 6) moved = true;
        if (moved) { stage.classList.add('dragging'); view.tx = start.tx + dx; view.ty = start.ty + dy; apply(); }
      });
      const up = (ev) => {
        const was = ptrs.size; ptrs.delete(ev.pointerId); stage.classList.remove('dragging'); if (ptrs.size < 2) pinch = null;
        if (was === 1 && !moved && ev.type === 'pointerup') tap(ev);
      };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      stage.addEventListener('wheel', (ev) => { ev.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
      const tap = (ev) => {
        if (!(st.adding || st.moving)) return;
        const r = stage.getBoundingClientRect(); const x = (ev.clientX - r.left - view.tx) / (plan.w * view.s), y = (ev.clientY - r.top - view.ty) / (plan.h * view.s);
        if (x < 0 || y < 0 || x > 1 || y > 1) return M.toast('Stuknij w obszarze rzutu', 'warn');
        if (st.moving) { const iss = st.moving; st.moving = null; setMode(); (iss.history = iss.history || []).push({ ts: Date.now(), by: M.S.settings.currentUser, txt: 'Przesunięto znacznik na rzucie' }); iss.x = x; iss.y = y; M.S.upsert('issues', iss); refresh(); return M.toast('Znacznik przesunięty'); }
        st.adding = false; setMode();
        M.modules.uwagi.form({ planId, x, y, status: 'otwarta', cat: 'Jakość', photos: [] }, { onSaved: (iss) => { st.sel = iss.id; if (st.flt.status !== 'wszystkie' && st.flt.status !== 'aktywne') st.flt.status = 'aktywne'; refresh(); } });
      };
      v.querySelector('#zin').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(1.4, r.width / 2, r.height / 2); };
      v.querySelector('#zout').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(1 / 1.4, r.width / 2, r.height / 2); };
      v.querySelector('#zfit').onclick = fit;
      const ab = v.querySelector('#addBtn'); if (ab) ab.onclick = (ev) => { ev.stopPropagation(); st.adding = !st.adding; st.moving = null; setMode(); };
      ab && ab.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      v.querySelector('.plan-ctrl').addEventListener('pointerdown', (ev) => ev.stopPropagation());
      v.querySelector('#hint').addEventListener('pointerdown', (ev) => ev.stopPropagation());
      v.querySelector('#cancelAdd').onclick = (ev) => { ev.preventDefault(); st.adding = false; st.moving = null; setMode(); };
      v.querySelectorAll('#fSt button').forEach(b => b.onclick = () => { st.flt.status = b.dataset.k; v.querySelectorAll('#fSt button').forEach(x => x.classList.toggle('on', x === b)); refresh(); });
      v.querySelector('#fResp').onchange = (ev) => { st.flt.resp = ev.target.value; refresh(); };
      v.querySelector('#fCat').onchange = (ev) => { st.flt.cat = ev.target.value; refresh(); };
      const img = v.querySelector('#pimg');
      const init = () => { if (!view.fitted) { fit(); view.fitted = true; } else apply(); drawList(); if (st.sel && list.some(i => i.id === st.sel) && v.dataset.opened !== st.sel) { /* zaznaczenie z linku */ } };
      if (img.complete) init(); else img.onload = init;
      window.addEventListener('resize', M.debounce(() => { if (document.body.contains(stage)) apply(); }, 200));
      // otwarcie uwagi z linku #/rzuty/<plan>/<uwaga>
      const want = st.sel && list.find(i => i.id === st.sel); if (want && location.hash.split('/')[3]) setTimeout(() => openIssue(want.id), 120);
    },
  };
})(window.M);
