/* BIURO BUDOWY — Pulpit „Moje dziś”: co wymaga uwagi + kafelki modułów
   Każdy moduł może dodać własne pozycje, definiując funkcję today() → [{lvl, icon, t, d, go, sort}] */
(function (M) {
  'use strict';
  const e = M.esc;
  M.modules.home = {
    title: 'Pulpit',
    render(v) {
      const S = M.S;
      if (!S.myProjects().length) return this.welcome(v);
      const p = S.project; const me = S.me(); const now = new Date();
      const greet = now.getHours() < 18 ? 'Dzień dobry' : 'Dobry wieczór';
      const dateTxt = now.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const iss = S.all('issues').filter(i => M.P.seesRecord(i));
      const open = iss.filter(i => i.status === 'otwarta' || i.status === 'weryfikacja');
      const late = open.filter(i => i.due && i.due < M.todayISO());
      // pozycje „na dziś” zbierane ze wszystkich modułów widocznych dla roli
      let items = [];
      Object.entries(M.modules).forEach(([id, m]) => { if (m.today && M.enabled(id) && M.P.canView(id)) { try { items = items.concat(m.today() || []); } catch (err) { console.error(id, err); } } });
      items.sort((a, b) => (a.lvl === b.lvl ? 0 : a.lvl === 'red' ? -1 : b.lvl === 'red' ? 1 : a.lvl === 'yel' ? -1 : 1) || (a.sort || 0) - (b.sort || 0));
      const deadlines = items.filter(i => i.kind === 'termin').length;
      const mods = M.visibleModules();
      const daysToEnd = M.daysLeft(p.end);
      v.innerHTML = `
        <section class="hero">
          <div><h1>${greet}${me ? ', ' + e(me.name.split(' ')[0]) : ''}!</h1>
            <p>${e(dateTxt)} · <b style="color:#fff">${e(p.name)}</b>${daysToEnd != null ? ` · do terminu umownego: <b style="color:#fff">${daysToEnd} dni</b>` : ''}</p></div>
          <div class="stats">
            <button class="stat" data-go="uwagi"><b>${open.length}</b><span>otwarte uwagi</span></button>
            <button class="stat" data-go="uwagi/po-terminie"><b class="${late.length ? 'alert' : ''}">${late.length}</b><span>po terminie</span></button>
            <button class="stat" data-go="${M.P.canView('terminy') ? 'terminy' : 'uwagi'}"><b class="${deadlines ? 'alert' : ''}">${deadlines}</b><span>terminy ≤ 7 dni</span></button>
            <button class="stat" data-go="harmonogram"><b>${items.filter(i => i.kind === 'harm').length}</b><span>działania z harmonogramu</span></button>
          </div>
        </section>
        ${S.settings.demo ? `<div class="banner or" style="margin-bottom:14px">${M.icon.alert}<span class="grow">Pracujesz na <b>danych przykładowych (fikcyjnych)</b>. Wyczyść je w Ustawieniach → Dane, zanim wprowadzisz własną budowę.</span></div>` : ''}
        <div class="home-grid">
          <div class="card today"><div class="card-head"><h2>Wymaga uwagi</h2><span class="badge ${items.filter(i => i.lvl === 'red').length ? 'or' : ''}">${items.length}</span>
            ${M.P.canEdit('uwagi') ? `<button class="btn primary sm" id="qAdd">${M.icon.pin}Nowa uwaga na rzucie</button>` : ''}</div>
            ${items.length ? `<ul>${items.slice(0, 40).map((it, i) => `<li data-i="${i}"><span class="ico ${it.lvl === 'red' ? 'red' : it.lvl === 'yel' ? 'yel' : ''}">${M.icon[it.icon] || M.icon.alert}</span><div class="grow"><div class="t">${e(it.t)}</div><div class="d">${e(it.d || '')}</div></div>${M.icon.arrowR.replace('<svg', '<svg style="width:16px;color:var(--ink-3);flex:none;margin-top:6px"')}</li>`).join('')}</ul>` : M.UI.empty('Nic pilnego. Dobra robota!', 'check')}
          </div>
          <div class="col">
            <div class="tiles">${mods.map(m => `<button class="tile ${m.core ? 'core' : m.custom ? 'g' : ''}" data-go="${m.route}"><div class="ic">${M.icon[m.icon] || M.icon.grid}</div><h3>${e(m.title)}</h3><p>${e(m.desc || '')}</p>${!M.P.canEdit(m.id) ? `<span class="lock badge">${M.icon.eye.replace('<svg', '<svg style="width:12px;height:12px"')} podgląd</span>` : ''}</button>`).join('')}</div>
          </div>
        </div>`;
      v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => M.go(b.dataset.go));
      v.querySelectorAll('.today li').forEach(li => li.onclick = () => { const it = items[+li.dataset.i]; if (it.go) M.go(it.go); if (it.run) it.run(); });
      const qa = v.querySelector('#qAdd'); if (qa) qa.onclick = () => M.go('rzuty/dodaj');
    },
    welcome(v) {
      const me = M.S.me();
      v.innerHTML = `<section class="hero"><div><h1>Dzień dobry${me ? ', ' + e(me.name.split(' ')[0]) : ''}!</h1><p>TEK-BIURO BUDOWY · wersja testowa. Rzuty i uwagi, dziennik budowy i montażu, protokoły, narady, raporty, harmonogram, BREEAM i terminy kontraktowe.</p></div></section>
        <div class="grid2" style="align-items:start">
          <div class="card card-pad col"><h2>1. Załóż budowę</h2><p class="muted" style="margin:0">Nazwa, adres, inwestor, terminy. Potem dodasz firmy (ręcznie lub z Excela), uczestników procesu budowlanego i rzuty.</p><div><button class="btn primary big" id="own">${M.icon.plus}Utwórz budowę</button></div></div>
          <div class="card card-pad col"><h2>2. Zadbaj o dane</h2>
            <div class="steps"><div class="step"><span class="n">1</span><div>${M.SYNC && M.SYNC.adapter.configured() ? `Włącz <b>synchronizację</b>: Ustawienia → Synchronizacja → zaloguj się. Komputer i telefon będą miały te same dane. <b>Jeśli budowa już jest w chmurze, najpierw się zaloguj – nie zakładaj jej drugi raz.</b>` : 'Dane zapisują się <b>na tym urządzeniu</b>. Synchronizację z telefonem włącza się w Ustawieniach → Synchronizacja.'}</div></div>
            <div class="step"><span class="n">2</span><div>Na komputerze: Ustawienia → Dane i kopie → <b>Wybierz folder danych</b>. Aplikacja będzie tam sama zapisywać bazę i kopię dzienną.</div></div>
            <div class="step"><span class="n">3</span><div>Uwagi do aplikacji zapisuj przyciskiem <b>Zgłoś uwagę</b> w pasku u góry.</div></div></div>
            <div class="row">${M.SYNC && M.SYNC.adapter.configured() ? `<button class="btn primary" id="chm">${M.icon.lock}Zaloguj do chmury</button>` : ''}<button class="btn" id="dane">${M.icon.folder}Dane i kopie</button></div></div>
        </div>`;
      v.querySelector('#own').onclick = () => M.go('ustawienia/budowa');
      v.querySelector('#dane').onclick = () => M.go('ustawienia/dane');
      const ch = v.querySelector('#chm'); if (ch) ch.onclick = () => M.go('ustawienia/chmura');
    },
  };
})(window.M);
