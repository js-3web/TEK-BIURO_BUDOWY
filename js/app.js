/* =========================================================
   BIURO BUDOWY — router, pasek górny i start aplikacji
   Moduły rejestrują się w M.modules = { id: { title, icon, desc, order, render(v, rest) } }.
   Nowy moduł: plik js/modules/xxx.js + linia <script> w index.html – pojawi się sam na pulpicie.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  M.modules = M.modules || {};
  M.go = (route) => { const h = '#/' + (route || ''); if (location.hash === h) render(); else location.hash = h; };
  M.enabled = (id) => M.S.settings.modules[id] !== false;
  let current = null;

  function parse() { const [name, ...rest] = (location.hash.replace(/^#\/?/, '') || '').split('/').map(decodeURIComponent); return { name: name || 'home', rest }; }
  function render() {
    if (M.LIC && !M.LIC.get()) { topbar(); document.getElementById('crumbs').innerHTML = ''; return M.LIC.screen(); }
    const { name, rest } = parse();
    let mod = M.modules[name] || M.modules.home; let modId = M.modules[name] ? name : 'home';
    if (name === 'wlasny') { mod = M.modules.wlasne; modId = rest[0]; }
    document.querySelectorAll('.drawer,.drawer-bg,.modal-bg,.menu,.lightbox').forEach(x => x.remove());
    const v = document.getElementById('view'); v.innerHTML = ''; window.scrollTo(0, 0);
    topbar();
    const title = name === 'wlasny' ? ((M.S.settings.customModules || []).find(c => c.id === rest[0]) || {}).name || 'Moduł własny' : mod.title;
    document.getElementById('crumbs').innerHTML = mod === M.modules.home ? '' : `<span>/</span><span class="cur">${e(title)}</span>`;
    document.title = (mod === M.modules.home ? 'Pulpit' : title) + ' · TEK-BIURO BUDOWY';
    bottomnav(name);
    if (!M.P.canView(modId)) { v.innerHTML = `<div class="card card-pad">${M.UI.empty(`Moduł „${e(title)}” nie jest dostępny dla roli <b>${e(M.P.ROLES[M.P.role()].label)}</b>.`, 'lock')}</div>`; current = null; return; }
    current = { mod, v, rest };
    try { mod.render(v, rest); } catch (err) { console.error(err); v.innerHTML = `<div class="banner warn">${M.icon.alert}<span>Błąd modułu: ${e(err.message)}</span></div>`; }
  }
  M.render = render;
  M.refresh = () => { if (current && current.mod.refresh) current.mod.refresh(current.v, current.rest); else render(); };

  function topbar() {
    const ps = M.S.myProjects(); const locked = M.LIC && !M.LIC.get();
    if (locked) { document.getElementById('projSel').innerHTML = ''; document.getElementById('userSel').innerHTML = ''; return; }
    document.getElementById('projSel').innerHTML = ps.length ? `<select id="pSel" title="Budowa">${ps.map(p => `<option value="${p.id}" ${p.id === M.S.pid ? 'selected' : ''}>${e(p.short || p.name)}</option>`).join('')}</select>` : '';
    const pSel = document.getElementById('pSel'); if (pSel) pSel.onchange = () => { M.S.set('currentProject', pSel.value); render(); };
    const me = M.S.me();
    document.getElementById('userSel').innerHTML = me ? `<span class="rolebadge" title="${e((M.P.ROLES[me.role] || {}).label || me.role)}">${e(me.role)}</span><span class="tb-name" title="Zalogowano kodem licencyjnym">${e(me.name)}</span>` : '';
  }
  function bottomnav(active) {
    const items = [['home', 'home', 'Pulpit'], ['rzuty', 'plan', 'Rzuty'], ['+', 'plus', 'Uwaga'], ['uwagi', 'list', 'Uwagi'], ['more', 'grid', 'Więcej']];
    const nav = document.getElementById('bottomnav');
    nav.innerHTML = items.map(([r, i, l]) => `<button data-r="${r}" class="${r === active ? 'on' : ''} ${r === '+' ? 'cta' : ''}">${M.icon[i]}<span>${l}</span></button>`).join('');
    nav.querySelectorAll('button').forEach(b => b.onclick = () => {
      const r = b.dataset.r;
      if (r === '+') { if (!M.P.canEdit('uwagi')) return M.toast('Twoja rola nie dodaje uwag', 'warn'); return M.go('rzuty/dodaj'); }
      if (r === 'more') return M.UI.menu(b, M.visibleModules().filter(m => !['home', 'rzuty', 'uwagi'].includes(m.id)).map(m => ({ label: m.title, icon: m.icon, run: () => M.go(m.route) })));
      M.go(r === 'home' ? '' : r);
    });
  }
  /** lista modułów widocznych dla roli (+ moduły własne) – do kafelków i menu */
  M.visibleModules = () => {
    const list = Object.entries(M.modules).filter(([id, m]) => id !== 'home' && id !== 'wlasne' && !m.hidden && M.enabled(id) && M.P.canView(id)).map(([id, m]) => ({ id, route: id, ...m }));
    (M.S.settings.customModules || []).forEach(c => { if (c.enabled !== false && M.P.canView(c.id)) list.push({ id: c.id, route: 'wlasny/' + c.id, title: c.name, icon: c.icon || 'grid', desc: c.desc || 'Moduł własny (kreator)', order: 90, custom: true }); });
    return list.sort((a, b) => (a.order || 50) - (b.order || 50));
  };

  M.onActivated = () => { topbar(); if (M.FEEDBACK) M.FEEDBACK.badge(); if (M.SYNC) M.SYNC.ui(); };
  /** poprawki online: aplikacja pod adresem URL sprawdza plik version.json i podpowiada odświeżenie */
  M.UPDATE = {
    async check() { if (!/^https?:/.test(location.protocol)) return; try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); if (j.build && j.build !== M.APP_BUILD) M.UPDATE.show(j.build); } catch (err) { /* brak sieci – nic nie rób */ } },
    show(build) { if (document.getElementById('updBar')) return; const b = document.createElement('button'); b.id = 'updBar'; b.className = 'updbar'; b.innerHTML = `${M.icon.download}Jest nowa wersja ${e(build)} – kliknij, aby odświeżyć`; b.onclick = async () => { await M.S.flush(); try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (err) { /* */ } location.reload(); }; document.body.appendChild(b); },
    start() { if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err)); M.UPDATE.check(); setInterval(M.UPDATE.check, 15 * 60 * 1000); document.addEventListener('visibilitychange', () => { if (!document.hidden) M.UPDATE.check(); }); },
  };
  window.addEventListener('hashchange', render);
  document.getElementById('brandBtn').onclick = () => M.go('');
  document.getElementById('cloudBtn').onclick = () => M.go('ustawienia/chmura');
  document.getElementById('syncBtn').onclick = () => { if (M.FS.status === 'prompt') return M.FS.resume(); M.go('ustawienia/dane'); };
  M.S.on((what) => { if (what === 'replace') { if (M.LIC) M.LIC.ensureUser(); render(); } if (what === 'settings' || what === 'people' || what === 'projects' || what === 'sync') topbar(); });
  window.addEventListener('beforeunload', () => { M.S.flush(); });

  (async function start() {
    await M.S.init();
    if (M.LIC && M.LIC.get()) M.LIC.ensureUser();
    render();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); // prośba, by przeglądarka nie kasowała danych przy braku miejsca
    M.UPDATE.start();
    await M.SYNC.init();
    if (M.FEEDBACK) M.FEEDBACK.badge();
    await M.FS.init();
  })();
})(window.M);
