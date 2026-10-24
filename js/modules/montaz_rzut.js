/* =========================================================
   BIURO BUDOWY — Dziennik montażu: postęp NA RZUCIE (Rewizja 15; wzorzec: Sablono „panel po panelu”)
   ---------------------------------------------------------
   Zasada: rzut niczego nie zapisuje sam – POKAZUJE dane z dziennika montażu (jedno źródło prawdy).
   1) Siatka osi: podajesz nazwy osi (np. 1-16 i A-G, opcjonalnie rozstawy w m) i wskazujesz na
      rzucie dwa węzły narożne. Program liczy położenie wszystkich węzłów (siatka prostokątna,
      niewykręcona względem kartki – rzut obrócony o kąt inny niż 0/90° nie jest obsługiwany).
   2) Pole „osie” w pozycjach wpisów („1–8 / A”, „11–16 / B, 1–6 / C”, „A–C / 5”) zamieniane jest
      na węzły / odcinki / pola i kolorowane wg statusu wpisu:
      szkic – niebieski przerywany · zatwierdzony – pomarańczowy · zatwierdzony z pomiarem
      geodezyjnym – zielony · odchyłki przekroczone – czerwony.
   3) Zaznaczenie prostokątem węzłów → nowy wpis z gotowym opisem osi (liczby sprawdza dziennik).
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const LINEAR = /belk|podwal|rygl|platw|płatw|dzwigar|dźwigar|wiazar|wiązar|scian|ścian|stezen|stężen|attyk|ryn/i;
  const COL = { base: '#8a94a6', draft: '#3b82f6', done: '#e07b3c', geo: '#2f8a69', bad: '#d93636', sel: '#22c3e6', grid: '#22c3e6' };
  const LEG = [['draft', 'we wpisie roboczym'], ['done', 'zamontowane (wpis zatwierdzony)'], ['geo', 'zamontowane + pomiar geodezyjny'], ['bad', 'odchyłki przekroczone']];
  const st = { mode: 'view', sel: new Set(), view: null, pid: '' };

  // ---------------- konfiguracja siatki (w rekordzie budowy) ----------------
  const cfg = () => Object.assign({ planId: '', nums: '', lets: '', sNum: '', sLet: '', a: null, b: null, along: 'x' }, (M.S.project && M.S.project.montazGrid) || {});
  const saveCfg = (c) => { const p = M.S.project; p.montazGrid = c; M.S.upsert('projects', p); };
  const canEdit = () => M.P.canEdit('montaz');

  /** „1-16”, „A-G”, „A,B,C,D,F” → lista nazw osi */
  const axisList = (s) => {
    const out = [];
    String(s || '').split(/[,;]+/).map(t => t.trim()).filter(Boolean).forEach(t => {
      const n = t.match(/^(\d+)\s*[-–—]\s*(\d+)$/); if (n) { const a = +n[1], b = +n[2], k = a <= b ? 1 : -1; for (let i = a; k > 0 ? i <= b : i >= b; i += k) out.push(String(i)); return; }
      const l = t.match(/^([A-Za-z])\s*[-–—]\s*([A-Za-z])$/); if (l) { const a = l[1].toUpperCase().charCodeAt(0), b = l[2].toUpperCase().charCodeAt(0), k = a <= b ? 1 : -1; for (let i = a; k > 0 ? i <= b : i >= b; i += k) out.push(String.fromCharCode(i)); return; }
      out.push(t.toUpperCase().replace(/\s+/g, ''));
    });
    return out;
  };
  /** udziały (0..1) kolejnych osi wzdłuż kierunku: z rozstawów albo równomiernie */
  const fractions = (n, spacing) => {
    const raw = String(spacing || '').trim(); const s = (/[;\s]/.test(raw) ? raw.split(/[;\s]+/) : raw.split(',')).map(x => parseFloat(String(x).replace(',', '.'))).filter(x => x > 0);
    if (n < 2) return [0];
    if (s.length === n - 1) { const tot = s.reduce((a, b) => a + b, 0); let c = 0; return [0, ...s.map(x => (c += x) / tot)]; }
    return Array.from({ length: n }, (_, i) => i / (n - 1));
  };
  /** model siatki: osie, węzły i położenie w ułamkach szerokości/wysokości rzutu */
  const grid = (c = cfg()) => {
    const N = axisList(c.nums), Lt = axisList(c.lets); if (N.length < 2 || Lt.length < 2 || !c.a || !c.b) return { N, Lt, ok: false };
    const fN = fractions(N.length, c.sNum), fL = fractions(Lt.length, c.sLet);
    const pos = (i, j) => c.along === 'y' ? { x: c.a.x + fL[j] * (c.b.x - c.a.x), y: c.a.y + fN[i] * (c.b.y - c.a.y) } : { x: c.a.x + fN[i] * (c.b.x - c.a.x), y: c.a.y + fL[j] * (c.b.y - c.a.y) };
    return { N, Lt, ok: true, pos, c };
  };
  // ---------------- osie z wpisu → węzły ----------------
  const tok = (t, list) => {
    const s = String(t || '').toUpperCase().replace(/\s+/g, '').replace(/[–—]/g, '-').replace(/^OSI?E?/, ''); if (!s) return null;
    if (s.includes('-')) { const [a, b] = s.split('-'); const ia = list.indexOf(a), ib = list.indexOf(b); if (ia < 0 || ib < 0) return null; const out = []; for (let i = Math.min(ia, ib); i <= Math.max(ia, ib); i++) out.push(i); return out; }
    const i = list.indexOf(s); return i < 0 ? null : [i];
  };
  /** „11–16 / B, 1–6 / C” → { parts: [{ I:[...], J:[...] }], bad: ['...'] } */
  const parseAxes = (txt, G) => {
    const parts = [], bad = [];
    String(txt || '').split(/[,;]+|\s+i\s+/).map(x => x.trim()).filter(Boolean).forEach(p => {
      const t = p.split('/'); if (t.length !== 2) { bad.push(p); return; }
      let I = tok(t[0], G.N), J = tok(t[1], G.Lt);
      if (!I || !J) { I = tok(t[1], G.N); J = tok(t[0], G.Lt); }
      if (!I || !J) { bad.push(p); return; }
      parts.push({ I, J });
    });
    return { parts, bad };
  };
  /** węzły → zwięzły opis osi „1–8 / A, 3–5 / B” */
  const axesText = (nodes, G) => {
    const by = new Map(); nodes.forEach(k => { const [i, j] = k.split(',').map(Number); if (!by.has(j)) by.set(j, []); by.get(j).push(i); });
    return [...by.keys()].sort((a, b) => a - b).map(j => { const is = by.get(j).sort((a, b) => a - b); const runs = []; let s0 = is[0], p = is[0]; for (let k = 1; k <= is.length; k++) { if (is[k] === p + 1) { p = is[k]; continue; } runs.push(s0 === p ? G.N[s0] : `${G.N[s0]}–${G.N[p]}`); s0 = p = is[k]; } return runs.map(r => `${r} / ${G.Lt[j]}`).join(', '); }).join(', ');
  };

  /** wszystkie „prymitywy” do narysowania + ostrzeżenia */
  const model = (G) => {
    const prims = [], warn = [];
    M.S.all('assembly').filter(a => !['anulowany', 'skorygowany'].includes(a.status)).forEach(a => (a.items || []).forEach(it => {
      const MZ = M.MONTAZ; const name = MZ.itemName(it), group = MZ.itemGroup(it);
      const r = parseAxes(it.axes, G); if (r.bad.length) warn.push(`${a.nr} · ${name}: nie rozpoznano osi „${r.bad.join(', ')}”`);
      if (!r.parts.length) return;
      const cls = a.status === 'zatwierdzony' ? (a.dev === 'przekroczone' ? 'bad' : a.geo === 'wykonano' ? 'geo' : 'done') : 'draft';
      const linear = LINEAR.test(`${group} ${name}`); let nodes = 0;
      r.parts.forEach(pt => { const kind = pt.I.length > 1 && pt.J.length > 1 ? 'area' : (pt.I.length > 1 || pt.J.length > 1) && linear ? 'line' : 'dots'; prims.push({ ...pt, kind, cls, a, name, group, n: it.n }); nodes += kind === 'dots' ? pt.I.length * pt.J.length : 0; });
      if (!linear && nodes && Number(it.n) !== nodes && r.parts.every(pt => !(pt.I.length > 1 && pt.J.length > 1))) warn.push(`${a.nr} · ${name}: ${it.n} szt., a osie „${it.axes}” dają ${nodes} ${M.plural(nodes, 'węzeł', 'węzły', 'węzłów')} – sprawdź`);
    }));
    const order = { draft: 0, done: 1, geo: 2, bad: 3 }; prims.sort((x, y) => order[x.cls] - order[y.cls]);
    return { prims, warn };
  };

  /** SVG w układzie pikseli rzutu (W×H) – ten sam na ekranie i na wydruku */
  const svg = (G, plan, mdl, sel) => {
    const W = plan.w, H = plan.h; const P = (i, j) => { const p = G.pos(i, j); return [p.x * W, p.y * H]; };
    const dx = Math.hypot(...(([x1, y1], [x2, y2]) => [x2 - x1, y2 - y1])(P(0, 0), P(1, 0))), dy = Math.hypot(...(([x1, y1], [x2, y2]) => [x2 - x1, y2 - y1])(P(0, 0), P(0, 1)));
    const r = Math.max(5, Math.min(40, Math.min(dx, dy) * 0.16)); const sw = Math.max(1.5, r * 0.28);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible">`;
    // siatka osi + opisy osi na zewnątrz siatki (kierunek od wnętrza siatki)
    const lab = (x1, y1, x2, y2, t) => { const L = Math.hypot(x1 - x2, y1 - y2) || 1; const k = r * 2.4; return `<text x="${x1 + (x1 - x2) / L * k}" y="${y1 + (y1 - y2) / L * k}" dy="${r * 0.5}" font-size="${r * 1.5}" font-weight="700" text-anchor="middle" fill="#0b6f86" stroke="#fff" stroke-width="${r * 0.35}" paint-order="stroke">${e(t)}</text>`; };
    G.N.forEach((n, i) => { const [x1, y1] = P(i, 0), [x2, y2] = P(i, G.Lt.length - 1); s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COL.grid}" stroke-opacity=".55" stroke-width="${sw * 0.5}" stroke-dasharray="${r} ${r * 0.6}"/>${lab(x1, y1, x2, y2, n)}`; });
    G.Lt.forEach((l, j) => { const [x1, y1] = P(0, j), [x2, y2] = P(G.N.length - 1, j); s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COL.grid}" stroke-opacity=".55" stroke-width="${sw * 0.5}" stroke-dasharray="${r} ${r * 0.6}"/>${lab(x1, y1, x2, y2, l)}`; });
    // węzły bazowe
    G.N.forEach((n, i) => G.Lt.forEach((l, j) => { const [x, y] = P(i, j); s += `<circle cx="${x}" cy="${y}" r="${r * 0.32}" fill="${COL.base}" fill-opacity=".7"/>`; }));
    // prymitywy
    mdl.prims.forEach((p, k) => {
      const c = COL[p.cls]; const dash = p.cls === 'draft' ? ` stroke-dasharray="${r * 0.5} ${r * 0.35}"` : '';
      s += `<g data-p="${k}" style="cursor:pointer">`;
      if (p.kind === 'area') { const pts = [P(p.I[0], p.J[0]), P(p.I[p.I.length - 1], p.J[0]), P(p.I[p.I.length - 1], p.J[p.J.length - 1]), P(p.I[0], p.J[p.J.length - 1])]; s += `<polygon points="${pts.map(q => q.join(',')).join(' ')}" fill="${c}" fill-opacity="${p.cls === 'draft' ? 0.15 : 0.32}" stroke="${c}" stroke-width="${sw}"${dash}/>`; }
      else if (p.kind === 'line') { const [x1, y1] = P(p.I[0], p.J[0]), [x2, y2] = P(p.I[p.I.length - 1], p.J[p.J.length - 1]); s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${r * 0.7}" stroke-linecap="round" stroke-opacity="${p.cls === 'draft' ? 0.55 : 0.9}"${dash}/>`; }
      else p.I.forEach(i => p.J.forEach(j => { const [x, y] = P(i, j); s += `<rect x="${x - r * 0.8}" y="${y - r * 0.8}" width="${r * 1.6}" height="${r * 1.6}" rx="${r * 0.25}" fill="${p.cls === 'draft' ? '#fff' : c}" stroke="${p.cls === 'draft' ? c : '#fff'}" stroke-width="${sw}"${dash}/>`; }));
      s += '</g>';
    });
    // zaznaczenie
    (sel || new Set()).forEach(k => { const [i, j] = k.split(',').map(Number); const [x, y] = P(i, j); s += `<circle cx="${x}" cy="${y}" r="${r * 1.3}" fill="none" stroke="${COL.sel}" stroke-width="${sw * 1.4}"/>`; });
    return s + '</svg>';
  };

  const M_RZ = M.MRZ = { axisList, fractions, parseAxes, axesText, grid, model, svg, cfg };

  /** zakładka „Na rzucie” w Dzienniku montażu */
  M_RZ.render = async (box) => {
    const plans = M.S.all('plans'); const c = cfg(); const ed = canEdit();
    if (st.pid !== M.S.pid) { st.pid = M.S.pid; st.view = null; st.sel = new Set(); st.mode = 'view'; }
    if (!plans.length) { box.innerHTML = `<div class="card card-pad">${M.UI.empty('Najpierw wgraj rzut obiektu w module <a href="#/rzuty">Rzuty i uwagi</a> (najlepiej rzut z siatką osi konstrukcyjnych).', 'plan')}</div>`; return; }
    const plan = M.S.get('plans', c.planId) || null; const G = grid(c);
    const url = plan ? await M.S.blobURL(plan.blobId) : '';
    const mdl = G.ok ? model(G) : { prims: [], warn: [] };
    const MZ = M.MONTAZ; const d = MZ.doneMap(); const all = M.S.all('elements'); const groups = [...new Set(all.map(x => x.group || ''))];
    box.innerHTML = `<div class="mrz">
      <div class="card mrz-main">${plan ? `<div class="plan-stage mrz-stage ${st.mode !== 'view' ? 'adding' : ''}" id="mst"><div class="plan-canvas" id="mcv"><img src="${url}" width="${plan.w}" height="${plan.h}" alt="" draggable="false"><div id="mov"></div></div>
          <div class="plan-ctrl"><button class="btn icon" id="zin" title="Przybliż">${M.icon.zoomin}</button><button class="btn icon" id="zout" title="Oddal">${M.icon.zoomout}</button><button class="btn icon" id="zfit" title="Cały rzut">${M.icon.fit}</button></div>
          <div class="plan-hint ${st.mode === 'view' ? 'hidden' : ''}" id="mh">${st.mode === 'cal1' ? `Stuknij węzeł ${e(G.N[0] || '?')} / ${e(G.Lt[0] || '?')}` : st.mode === 'cal2' ? `Stuknij węzeł ${e(G.N[G.N.length - 1] || '?')} / ${e(G.Lt[G.Lt.length - 1] || '?')}` : 'Przeciągnij prostokąt wokół węzłów (kolejne zaznaczenia się sumują)'} · <a href="#" id="mx" style="color:#FFB39C">zakończ</a></div></div>`
        : `<div class="card-pad">${M.UI.empty('Wybierz rzut i ustaw siatkę osi w panelu obok.', 'plan')}</div>`}</div>
      <div class="col mrz-side">
        <div class="card card-pad col"><h2>Siatka osi</h2>
          <label class="f">Rzut<select id="gPlan" ${ed ? '' : 'disabled'}>${M.UI.opts(plans.map(p => [p.id, `${p.name}${p.level ? ' · ' + p.level : ''}`]), c.planId, '— wybierz rzut —')}</select></label>
          <div class="grid2"><label class="f">Osie liczbowe<input type="text" id="gN" value="${e(c.nums)}" placeholder="1-16" ${ed ? '' : 'disabled'}></label><label class="f">Osie literowe<input type="text" id="gL" value="${e(c.lets)}" placeholder="A-G" ${ed ? '' : 'disabled'}></label></div>
          <details ${c.sNum || c.sLet ? 'open' : ''}><summary class="small" style="cursor:pointer;font-weight:700">Rozstawy osi (gdy nierówne)</summary>
            <div class="grid2" style="margin-top:6px"><label class="f">między liczbowymi [m]<input type="text" id="gSN" value="${e(c.sNum)}" placeholder="np. 12 12 12 … (${Math.max(0, G.N.length - 1)} wartości)" ${ed ? '' : 'disabled'}></label><label class="f">między literowymi [m]<input type="text" id="gSL" value="${e(c.sLet)}" placeholder="np. 22,5 22,5 … (${Math.max(0, G.Lt.length - 1)} wartości)" ${ed ? '' : 'disabled'}></label></div><div class="xs muted">Puste = rozstaw równy. Liczby rozdzielaj spacją lub średnikiem.</div></details>
          <label class="f">Kolejne osie liczbowe biegną na rzucie<select id="gA" ${ed ? '' : 'disabled'}>${M.UI.opts([['x', 'poziomo (w prawo / w lewo)'], ['y', 'pionowo (w górę / w dół)']], c.along)}</select></label>
          <div class="small">${G.N.length >= 2 && G.Lt.length >= 2 ? `${G.N.length} × ${G.Lt.length} osi = <b>${G.N.length * G.Lt.length}</b> węzłów.` : '<span class="muted">Podaj co najmniej 2 osie w każdym kierunku.</span>'} ${G.ok ? '<span class="badge ok">siatka ustawiona</span>' : c.a ? '<span class="badge warn">wskaż drugi węzeł</span>' : ''}</div>
          ${ed && plan ? `<div class="row"><button class="btn sm" id="cal">${M.icon.pin}Wskaż 2 węzły narożne</button>${G.ok ? `<button class="btn sm primary" id="sel">${M.icon.plus}Zaznacz → nowy wpis</button>` : ''}</div>` : ''}
          ${st.sel.size ? `<div class="banner info"><span class="grow small">Zaznaczono <b>${st.sel.size}</b> ${M.plural(st.sel.size, 'węzeł', 'węzły', 'węzłów')}: ${e(axesText([...st.sel], G))}</span></div><div class="row"><button class="btn sm primary" id="mkE">${M.icon.cube}Utwórz wpis</button><button class="btn sm ghost" id="clr">Wyczyść</button></div>` : ''}
          <div class="xs muted">Siatka prostokątna, ustawiona równolegle do krawędzi rzutu. Węzły liczone z dwóch narożników i rozstawów – sprawdź na rzucie, czy linie osi pokrywają się z rysunkiem.</div>
        </div>
        <div class="card card-pad col"><h2>Legenda</h2>${LEG.map(([k, l]) => `<div class="row small"><span class="mrz-sw" style="background:${k === 'draft' ? '#fff' : COL[k]};border-color:${COL[k]};${k === 'draft' ? 'border-style:dashed' : ''}"></span>${e(l)}</div>`).join('')}
          <div class="xs muted">Kwadrat = element w węźle (np. słup), linia = element liniowy w osi (belka, ściana), pole = element powierzchniowy (płyty). Kolor bierze się z dziennika montażu – rzut niczego nie zmienia.</div>
          ${plan && G.ok ? `<button class="btn sm" id="prt">${M.icon.print}Rzut montażu PDF</button>` : ''}</div>
        <div class="card card-pad col"><h2>Postęp</h2>${groups.map(g => { const inG = all.filter(x => (x.group || '') === g); const q = inG.reduce((s, x) => s + (Number(x.qty) || 0), 0), dn = inG.reduce((s, x) => s + Math.min(Number(x.qty) || 0, d.get(x.id) || 0), 0); return `<div class="small"><div class="row"><b class="grow">${e(g || 'Elementy')}</b><span>${dn} / ${q} szt. · ${q ? Math.round(dn / q * 100) : 0}%</span></div><div class="meter"><i style="width:${q ? Math.round(dn / q * 100) : 0}%"></i></div></div>`; }).join('') || '<span class="small muted">Brak elementów.</span>'}</div>
        ${mdl.warn.length ? `<div class="card card-pad col"><h2>Do sprawdzenia (${mdl.warn.length})</h2><ul class="small" style="margin:0;padding-left:18px">${mdl.warn.slice(0, 30).map(w => `<li>${e(w)}</li>`).join('')}</ul><div class="xs muted">Popraw osie we wpisie (np. „1–8 / A”), żeby element pojawił się na rzucie.</div></div>` : ''}
      </div></div>`;

    // ---------------- ustawienia siatki ----------------
    const upd = (patch) => { saveCfg(Object.assign(cfg(), patch)); M_RZ.render(box); };
    const bind = (id, k) => { const el = box.querySelector(id); if (el && ed) el.onchange = () => upd({ [k]: el.value }); };
    bind('#gN', 'nums'); bind('#gL', 'lets'); bind('#gSN', 'sNum'); bind('#gSL', 'sLet'); bind('#gA', 'along');
    const gp = box.querySelector('#gPlan'); if (gp && ed) gp.onchange = () => { st.view = null; upd({ planId: gp.value, a: null, b: null }); };
    const on = (id, fn) => { const b = box.querySelector(id); if (b) b.onclick = fn; };
    on('#cal', () => { if (axisList(cfg().nums).length < 2 || axisList(cfg().lets).length < 2) return M.toast('Najpierw wpisz osie liczbowe i literowe', 'warn'); st.mode = 'cal1'; M_RZ.render(box); });
    on('#sel', () => { st.mode = 'sel'; M_RZ.render(box); });
    on('#clr', () => { st.sel = new Set(); M_RZ.render(box); });
    on('#mkE', () => M_RZ.newFromSel(G));
    on('#prt', () => M_RZ.print(plan, url, G, mdl));
    if (!plan) return;

    // ---------------- podgląd: przesuwanie / przybliżanie ----------------
    const stage = box.querySelector('#mst'), cv = box.querySelector('#mcv'), ov = box.querySelector('#mov');
    const view = st.view && st.view.planId === plan.id ? st.view : { planId: plan.id, s: 1, tx: 0, ty: 0, fitted: false }; st.view = view;
    const apply = () => { cv.style.transform = `translate(${view.tx}px,${view.ty}px) scale(${view.s})`; };
    const fit = () => { const r = stage.getBoundingClientRect(); view.s = Math.min(r.width / plan.w, r.height / plan.h) * 0.96; view.tx = (r.width - plan.w * view.s) / 2; view.ty = (r.height - plan.h * view.s) / 2; apply(); };
    const zoomAt = (k, cx, cy) => { const ns = Math.max(0.03, Math.min(8, view.s * k)); const kk = ns / view.s; view.tx = cx - (cx - view.tx) * kk; view.ty = cy - (cy - view.ty) * kk; view.s = ns; apply(); };
    ov.innerHTML = G.ok ? svg(G, plan, mdl, st.sel) : (c.a ? `<svg viewBox="0 0 ${plan.w} ${plan.h}" width="${plan.w}" height="${plan.h}" style="position:absolute;left:0;top:0"><circle cx="${c.a.x * plan.w}" cy="${c.a.y * plan.h}" r="${Math.max(plan.w, plan.h) / 120}" fill="${COL.sel}"/></svg>` : '');
    const toPlan = (ev) => { const r = stage.getBoundingClientRect(); return { x: (ev.clientX - r.left - view.tx) / view.s, y: (ev.clientY - r.top - view.ty) / view.s }; };
    const ptrs = new Map(); let start = null, moved = false, pinch = null, rect = null;
    const rectEl = document.createElement('div'); rectEl.className = 'mrz-rect hidden'; stage.appendChild(rectEl);
    stage.addEventListener('pointerdown', (ev) => { stage.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); moved = false; start = { x: ev.clientX, y: ev.clientY, tx: view.tx, ty: view.ty }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s }; rect = null; } else if (st.mode === 'sel') rect = { p0: toPlan(ev), c0: { x: ev.clientX, y: ev.clientY } }; });
    stage.addEventListener('pointermove', (ev) => {
      if (!ptrs.has(ev.pointerId)) return; ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); const r = stage.getBoundingClientRect();
      if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; zoomAt((pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d) / view.s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); moved = true; return; }
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y; if (Math.hypot(dx, dy) > 6) moved = true;
      if (!moved) return;
      if (rect) { rectEl.classList.remove('hidden'); Object.assign(rectEl.style, { left: Math.min(rect.c0.x, ev.clientX) - r.left + 'px', top: Math.min(rect.c0.y, ev.clientY) - r.top + 'px', width: Math.abs(dx) + 'px', height: Math.abs(dy) + 'px' }); return; }
      stage.classList.add('dragging'); view.tx = start.tx + dx; view.ty = start.ty + dy; apply();
    });
    const up = (ev) => {
      const was = ptrs.size; ptrs.delete(ev.pointerId); stage.classList.remove('dragging'); if (ptrs.size < 2) pinch = null;
      if (rect && moved && ev.type === 'pointerup') { const p1 = toPlan(ev); const x0 = Math.min(rect.p0.x, p1.x) / plan.w, x1 = Math.max(rect.p0.x, p1.x) / plan.w, y0 = Math.min(rect.p0.y, p1.y) / plan.h, y1 = Math.max(rect.p0.y, p1.y) / plan.h; let n = 0; G.N.forEach((_, i) => G.Lt.forEach((__, j) => { const q = G.pos(i, j); if (q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1) { st.sel.add(i + ',' + j); n++; } })); rect = null; rectEl.classList.add('hidden'); if (!n) M.toast('W prostokącie nie ma węzłów siatki', 'warn'); M_RZ.render(box); return; }
      rect = null; rectEl.classList.add('hidden');
      if (was === 1 && !moved && ev.type === 'pointerup') tap(ev);
    };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (ev) => { ev.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
    const tap = (ev) => {
      const p = toPlan(ev); const fx = p.x / plan.w, fy = p.y / plan.h;
      if (st.mode === 'cal1' || st.mode === 'cal2') {
        if (fx < 0 || fy < 0 || fx > 1 || fy > 1) return M.toast('Stuknij w obszarze rzutu', 'warn');
        if (st.mode === 'cal1') { st.mode = 'cal2'; upd({ a: { x: fx, y: fy }, b: null }); } else { st.mode = 'view'; upd({ b: { x: fx, y: fy } }); M.toast('Siatka ustawiona – sprawdź, czy linie osi pokrywają się z rysunkiem'); }
        return;
      }
      if (!G.ok) return;
      // najbliższy węzeł
      let best = null, bd = Infinity; G.N.forEach((_, i) => G.Lt.forEach((__, j) => { const q = G.pos(i, j); const dd = Math.hypot((q.x - fx) * plan.w, (q.y - fy) * plan.h); if (dd < bd) { bd = dd; best = [i, j]; } }));
      const P0 = G.pos(0, 0), P1 = G.pos(Math.min(1, G.N.length - 1), Math.min(1, G.Lt.length - 1)); const tol = Math.min(Math.abs(P1.x - P0.x) * plan.w || 1e9, Math.abs(P1.y - P0.y) * plan.h || 1e9) * 0.45;
      if (!best || bd > tol) return;
      if (st.mode === 'sel') { const k = best.join(','); st.sel.has(k) ? st.sel.delete(k) : st.sel.add(k); return M_RZ.render(box); }
      M_RZ.nodeInfo(G, mdl, best[0], best[1]);
    };
    on('#zin', () => { const r = stage.getBoundingClientRect(); zoomAt(1.4, r.width / 2, r.height / 2); });
    on('#zout', () => { const r = stage.getBoundingClientRect(); zoomAt(1 / 1.4, r.width / 2, r.height / 2); });
    on('#zfit', fit);
    box.querySelector('.plan-ctrl').addEventListener('pointerdown', (ev) => ev.stopPropagation());
    const mh = box.querySelector('#mh'); if (mh) mh.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    on('#mx', (ev) => { ev.preventDefault(); st.mode = 'view'; M_RZ.render(box); });
    const img = cv.querySelector('img'); const init = () => { if (!view.fitted) { fit(); view.fitted = true; } else apply(); };
    if (img.complete) init(); else img.onload = init;
  };

  /** co jest w węźle (wszystkie wpisy, które go obejmują) */
  M_RZ.nodeInfo = (G, mdl, i, j) => {
    const hit = mdl.prims.filter(p => p.I.includes(i) && p.J.includes(j));
    const ST = M.MONTAZ.ST;
    M.UI.modal({ title: `Węzeł ${e(G.N[i])} / ${e(G.Lt[j])}`, body: hit.length ? `<table class="list"><thead><tr><th>Wpis</th><th>Data</th><th>Element</th><th>Osie</th><th>Status</th></tr></thead><tbody>${hit.map(p => `<tr class="click" data-id="${p.a.id}"><td class="num">${e(p.a.nr)}</td><td class="nowrap">${M.fmt(p.a.date)}</td><td>${e(p.name)}<div class="xs muted">${e(p.group)}</div></td><td class="small">${e(G.N[p.I[0]])}${p.I.length > 1 ? '–' + e(G.N[p.I[p.I.length - 1]]) : ''} / ${e(G.Lt[p.J[0]])}${p.J.length > 1 ? '–' + e(G.Lt[p.J[p.J.length - 1]]) : ''}</td><td>${M.UI.st(ST, p.a.status)}${p.a.geo === 'wykonano' ? ' <span class="badge ok">geodezja</span>' : ''}</td></tr>`).join('')}</tbody></table><div class="xs muted" style="margin-top:6px">Kliknij wiersz, aby otworzyć wpis.</div>` : M.UI.empty('W tym węźle nie ma jeszcze wpisów montażu.', 'cube') })
      .querySelectorAll('tr.click').forEach(tr => tr.onclick = () => { document.querySelectorAll('.modal-bg').forEach(x => x.remove()); M.go('montaz/wpis/' + tr.dataset.id); });
  };

  /** nowy wpis z zaznaczonych węzłów */
  M_RZ.newFromSel = (G) => {
    const MZ = M.MONTAZ; const d = MZ.doneMap(); const used = new Map(); M.S.all('assembly').filter(a => ['szkic', 'zgloszony'].includes(a.status)).forEach(a => (a.items || []).forEach(i => used.set(i.elementId, (used.get(i.elementId) || 0) + (Number(i.n) || 0))));
    const els = M.S.all('elements').slice().sort((a, b) => (a.ord || 0) - (b.ord || 0)).map(x => ({ x, left: (Number(x.qty) || 0) - (d.get(x.id) || 0) - (used.get(x.id) || 0) })).filter(o => o.left > 0);
    if (!els.length) return M.toast('Wszystkie elementy są już ujęte we wpisach', 'warn');
    const axes = axesText([...st.sel], G); const n = st.sel.size;
    const m = M.UI.modal({ title: 'Nowy wpis z zaznaczenia na rzucie', body: `<div class="col" id="nf">
      <div class="grid2"><label class="f">Data montażu<input type="date" data-f="date" value="${M.todayISO()}" max="${M.todayISO()}"></label><label class="f">Liczba sztuk<input type="number" min="1" step="1" data-f="n" value="${n}"></label></div>
      <label class="f req"><span>Element</span><select data-f="el">${els.map(o => `<option value="${o.x.id}">${e(o.x.name)}${o.x.group ? ' · ' + e(o.x.group) : ''} (zostało ${o.left})</option>`).join('')}</select></label>
      <label class="f">Osie<input type="text" data-f="axes" value="${e(axes)}"></label>
      <div class="xs muted">Program utworzy <b>szkic</b> wpisu. Liczby sztuk sprawdzi dziennik przy zatwierdzaniu (blokada przekroczenia).</div></div>`,
      footer: `<button class="btn primary" id="ok">${M.icon.check}Utwórz szkic wpisu</button>` });
    m.querySelector('#ok').onclick = () => {
      const f = M.UI.read(m.querySelector('#nf')); if (!(f.n >= 1)) return M.toast('Podaj liczbę sztuk', 'warn');
      const o = els.find(q => q.x.id === f.el); if (o && f.n > o.left) return M.toast(`Do rozpisania zostało tylko ${o.left} szt. tego elementu`, 'warn');
      m.close(); st.sel = new Set(); st.mode = 'view';
      M.modules.montaz.newEntry({ date: f.date || M.todayISO(), items: [{ elementId: f.el, n: Math.round(f.n), axes: f.axes, note: '' }] });
    };
  };

  /** wydruk: rzut + nakładka + legenda + postęp */
  M_RZ.print = (plan, url, G, mdl) => {
    const c = M.MONTAZ.cfg();
    const html = `${M.PR.header('Postęp montażu', ` – ${plan.name}`)}
      <div style="position:relative;width:100%;border:0.6pt solid #9aa1a4"><img src="${url}" style="width:100%;display:block"><div style="position:absolute;inset:0">${svg(G, plan, mdl, null).replace(/width="\d+(\.\d+)?" height="\d+(\.\d+)?" style="position:absolute;left:0;top:0;overflow:visible"/, 'width="100%" height="100%" preserveAspectRatio="none" style="position:absolute;left:0;top:0"')}</div></div>
      <div style="display:flex;gap:6mm;flex-wrap:wrap;margin:3mm 0" class="small">${LEG.map(([k, l]) => `<span><span style="display:inline-block;width:3.5mm;height:3.5mm;vertical-align:-0.6mm;border:0.8pt ${k === 'draft' ? 'dashed' : 'solid'} ${COL[k]};background:${k === 'draft' ? '#fff' : COL[k]}"></span> ${e(l)}</span>`).join('')}</div>
      <p class="small muted">${e(M.MONTAZ.KIND[c.kind][0])}. Stan wg dziennika montażu na ${M.fmt(M.todayISO())}. Położenie elementów wynika z osi podanych we wpisach (siatka osi ${e(G.N[0])}–${e(G.N[G.N.length - 1])} / ${e(G.Lt[0])}–${e(G.Lt[G.Lt.length - 1])}).</p>
      <h2>Zestawienie</h2>${M.MONTAZ.CSS_TAG}${M.modules.montaz.htmlProgress()}`;
    M.UI.docPreview('Postęp montażu na rzucie', html);
  };
})(window.M);
