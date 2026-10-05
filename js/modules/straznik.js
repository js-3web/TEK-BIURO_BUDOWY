/* =========================================================
   BIURO BUDOWY — Strażnik Harmonogramu (Rewizja 13)
   ---------------------------------------------------------
   Co robi moduł:
     1) wczytujesz harmonogram (moduł Harmonogram) i tabelę zakresową (Excel),
     2) AI – przez „skopiuj prompt → wklej odpowiedź” – przypisuje zakres do pozycji
        harmonogramu i proponuje czynności: etapy robót, wybór wykonawców, zamówienia,
        projekty, decyzje innych stron, sprawy urzędowe,
     3) przeglądasz wynik, poprawiasz czasy, zatwierdzasz,
     4) aplikacja SAMA (bez AI, także bez internetu) wylicza terminy i pokazuje alarmy:
        w oknie po otwarciu aplikacji, na pulpicie i na liście w tym module.

   Podział pracy:
     • AI proponuje POWIĄZANIA i CZASY TRWANIA,
     • kod (js/straznik_silnik.js) liczy DATY i ALARMY,
     • człowiek zatwierdza, poprawia i zmienia statusy.

   Dane (tabele w store.js, synchronizują się same):
     scope   – wiersze tabeli zakresowej (klucz, opis, status, przypisane pozycje harmonogramu),
     guard   – czynności Strażnika (czas trwania, punkt odniesienia, status),
     imports – historia wczytanych plików.
   Ustawienia modułu (okno ostrzeżenia, reguły budowy) są zapisane w rekordzie budowy: project.guard.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc, SH = M.SH;
  const st = { tab: '', zak: { ark: '', stat: '', pew: '', bez: false, q: '' }, cz: { status: '', rodzaj: '', zad: '', q: '' } };
  const G = M.STRAZNIK = {};
  /** przejście do zakładki (adres #/straznik/<zakładka>) */
  const goTab = (t) => { st.tab = t; M.go('straznik/' + t); };
  /** uwaga silnika z datą w zapisie polskim */
  const uw = (t) => String(t || '').replace(/\d{4}-\d\d-\d\d/g, (d) => M.fmt(d));
  const DEF_RULES = `- wybór podwykonawcy: zakończony 3 tygodnie przed startem jego robót; postępowanie ofertowe trwa 4 tygodnie
- projekt wykonawczy lub warsztatowy: zatwierdzony najpóźniej 2 tygodnie przed zamówieniem materiału
- zgłoszenia i odbiory urzędowe: licz terminy ustawowe i podaj przepis
(popraw te wartości i dopisz własne, np. czasy dostaw z ofert)`;
  const PEW = { W: ['wysoka', 'g'], S: ['średnia', 'y'], N: ['niska', 'r'], '': ['—', 'n'] };
  const SRC_BADGE = { 'szacunek AI': 'warn', 'reguła budowy': 'info', 'przepis': 'info', 'harmonogram': '', 'ręcznie': 'ok', 'potwierdzone': 'ok' };
  const ST_CLS = { 'do zrobienia': 'open', 'w toku': 'check', 'załatwione': 'done' };
  const ZK_CLS = { 'w zakresie': 'done', 'poza zakresem': 'rej', 'odesłanie': 'info', 'pomniejszenie': 'check', 'zakres obcy': 'open' };

  // ---------------- ustawienia modułu (w rekordzie budowy) ----------------
  G.cfg = () => Object.assign({ window: 14, limit: 8, rules: DEF_RULES }, (M.S.project && M.S.project.guard) || {});
  G.saveCfg = (patch) => { const p = M.S.project; p.guard = Object.assign({}, p.guard || {}, patch); M.S.upsert('projects', p); };
  /** „dziś” – z możliwością ustawienia dnia próbnego (tylko na tym urządzeniu, do testów na starym harmonogramie) */
  G.dzis = () => { try { const d = sessionStorage.getItem('tekbb-straznik-dzis'); if (d && /^\d{4}-\d\d-\d\d$/.test(d)) return d; } catch (err) { /* */ } return M.todayISO(); };
  G.probny = () => G.dzis() !== M.todayISO();

  // ---------------- dane ----------------
  const tasks = () => M.modules.harmonogram.sorted();
  /** numer pozycji harmonogramu używany w rozmowie z AI: kod zadania, a gdy kody się powtarzają lub ich brak – kolejny numer */
  G.numery = () => { const t = tasks(); const kody = t.map(x => String(x.code || '').trim()); const okKody = kody.every(k => k && /^[\w.\-]+$/.test(k)) && new Set(kody).size === kody.length; const poId = {}, poNr = {}; t.forEach((x, i) => { const nr = okKody ? kody[i] : String(i + 1); poId[x.id] = nr; poNr[nr] = x; }); return { poId, poNr }; };
  const scope = (zUsunietymi) => M.S.all('scope').filter(r => zUsunietymi || !r.removed).sort((a, b) => (a.ord || 0) - (b.ord || 0) || (a.row || 0) - (b.row || 0));
  const stZak = (r) => r.statusM || r.status;
  const guards = () => M.S.all('guard');
  const taskTxt = (id) => { const t = M.S.get('tasks', id); return t ? t.name : '(usunięta pozycja)'; };
  const nextCid = (zajete) => { let n = 1; const used = new Set([...guards().map(g => g.cid), ...(zajete || [])]); while (used.has('C' + M.pad(n))) n++; return 'C' + M.pad(n); };

  /** wylicza daty wszystkich czynności bieżącej budowy (silnik) */
  G.calc = () => {
    const p = M.S.project; if (!p) return { items: [], bledy: [] };
    const ts = M.S.all('tasks'); const gs = guards();
    const start = p.start || ts.filter(t => !t.tbd && t.start).reduce((a, t) => !a || t.start < a ? t.start : a, '');
    const w = SH.przelicz(ts.map(t => ({ id: t.id, start: t.start, koniec: t.end, bezTerminu: !!t.tbd })), gs.map(g => ({ id: g.id, kotwica: g.anchor, przes_tyg: g.offW, trwanie_tyg: g.durW, dataReczna: g.manualEnd || '' })), { startProjektu: start });
    const bl = {}; w.bledy.forEach(b => bl[b.id] = b.blad);
    return { items: gs.map(g => Object.assign({ g, blad: bl[g.id] || '' }, w.daty[g.id] || { start: '', koniec: '', koniecWyliczony: '', reczna: false, uwaga: '' })), bledy: w.bledy };
  };
  /** alarmy na dziś: [{ g, poziom, tekst, start, koniec }] */
  G.alarms = () => { const c = G.calc(); const po = {}; c.items.forEach(i => po[i.g.id] = i); return SH.alarmy(c.items.filter(i => !i.blad).map(i => ({ id: i.g.id, status: i.g.status, start: i.start, koniec: i.koniec })), G.dzis(), G.cfg().window).map(a => Object.assign(a, { g: po[a.id].g })); };

  // ---------------- zmiana harmonogramu: co się przesunęło ----------------
  G.snapshot = () => { const o = {}; G.calc().items.forEach(i => o[i.g.id] = { k: i.koniecWyliczony, blad: i.blad }); return o; };
  /** po imporcie / edycji harmonogramu: oznacza czynności z datą ręczną, pod którymi zmienił się termin wyliczony */
  G.afterScheduleChange = (przed) => {
    const po = G.calc(); const r = { total: po.items.length, moved: 0, check: 0, lost: 0 };
    po.items.forEach(i => {
      const b = przed[i.g.id]; if (!b) return;
      if (i.blad && !b.blad) { r.lost++; return; }
      if (b.k && i.koniecWyliczony && b.k !== i.koniecWyliczony) { r.moved++; if (i.g.manualEnd) { i.g.flag = `Harmonogram się zmienił: termin wyliczony ${M.fmt(b.k)} → ${M.fmt(i.koniecWyliczony)}, a data jest wpisana ręcznie (${M.fmt(i.g.manualEnd)}).`; M.S.upsert('guard', i.g, true); r.check++; } }
    });
    if (r.check) M.S.touch('guard');
    return r;
  };

  // ---------------- „Do wyjaśnienia” – lista liczona na bieżąco ----------------
  G.issues = () => {
    const out = []; const ts = tasks(); const sc = scope(); const c = G.calc(); const nry = G.numery().poId;
    const lisc = sc.filter(r => !r.naglowek);
    c.items.filter(i => i.blad).forEach(i => out.push({ lvl: 'red', typ: 'Czynność bez terminu', t: `${i.g.cid} ${i.g.name}`, d: i.blad, guard: i.g.id }));
    c.items.filter(i => i.g.flag).forEach(i => out.push({ lvl: 'yel', typ: 'Do sprawdzenia', t: `${i.g.cid} ${i.g.name}`, d: i.g.flag, guard: i.g.id, clearFlag: true }));
    c.items.filter(i => !i.blad && i.uwaga && i.g.status !== 'załatwione').forEach(i => out.push({ lvl: 'yel', typ: 'Termin niewykonalny', t: `${i.g.cid} ${i.g.name}`, d: `${uw(i.uwaga)}. Wyliczony start: ${M.fmt(i.start)}.`, guard: i.g.id }));
    // niepewne dopasowania: gdy cała grupa ma tę samą uwagę, pokazuj tylko wiersz nadrzędny (z liczbą wierszy podrzędnych)
    const niep = sc.filter(r => !r.ack && (r.conf === 'N' || /^ROZBIEŻNOŚĆ/i.test(r.note || '')));
    const podrz = (p, r) => r !== p && r.sheet === p.sheet && r.sek === p.sek && r.lp.indexOf(p.lp + '.') === 0 && (r.note || '') === (p.note || '');
    niep.filter(r => !niep.some(p => podrz(p, r))).forEach(r => { const ile = niep.filter(x => podrz(r, x)).length; out.push({ lvl: /^ROZBIEŻNOŚĆ/i.test(r.note || '') ? 'red' : 'yel', typ: /^ROZBIEŻNOŚĆ/i.test(r.note || '') ? 'Rozbieżność zakresu' : 'Dopasowanie niepewne', t: `${r.key} ${r.text.slice(0, 110)}`, d: (r.note || 'AI oznaczyło to dopasowanie jako niepewne.') + (ile ? ` Dotyczy też ${ile} ${M.plural(ile, 'wiersza podrzędnego', 'wierszy podrzędnych', 'wierszy podrzędnych')}.` : ''), scope: r.id }); });
    const bezPoz = lisc.filter(r => ['w zakresie', 'pomniejszenie'].includes(stZak(r)) && r.sek !== 'O' && !(r.taskIds || []).length && !r.ack);
    if (bezPoz.length) out.push({ lvl: 'yel', typ: 'Zakres bez pozycji harmonogramu', t: `${bezPoz.length} ${M.plural(bezPoz.length, 'wiersz', 'wiersze', 'wierszy')} zakresu nie ma przypisanej pozycji`, d: bezPoz.slice(0, 4).map(r => r.key).join(', ') + (bezPoz.length > 4 ? '…' : ''), filtr: { bez: true } });
    const tbd = new Set(ts.filter(t => t.tbd).map(t => t.id));
    const bezTerm = lisc.filter(r => stZak(r) === 'w zakresie' && (r.taskIds || []).length && r.taskIds.every(id => tbd.has(id)));
    if (bezTerm.length) out.push({ lvl: '', typ: 'Zakres bez terminu', t: `${bezTerm.length} ${M.plural(bezTerm.length, 'wiersz', 'wiersze', 'wierszy')} zakresu należy do pozycji „termin do uzgodnienia”`, d: 'Strażnik nie pokaże dla nich alarmów, dopóki w harmonogramie nie pojawią się daty.' });
    if (sc.length) { const uzyte = new Set(); sc.forEach(r => (r.taskIds || []).forEach(id => uzyte.add(id))); ts.filter(t => !t.summary && !t.milestone && !t.tbd && !uzyte.has(t.id)).forEach(t => out.push({ lvl: '', typ: 'Pozycja harmonogramu bez zakresu', t: `${nry[t.id]}. ${t.name}`, d: 'Żaden wiersz tabeli zakresowej nie jest przypisany do tej pozycji.' })); }
    const zm = scope(true).filter(r => r.chg && !r.ack);
    if (zm.length) out.push({ lvl: 'yel', typ: 'Zmiany w tabeli zakresowej', t: `${zm.filter(r => r.chg === 'nowy').length} nowych, ${zm.filter(r => r.chg === 'zmieniony').length} zmienionych, ${zm.filter(r => r.chg === 'usunięty').length} usuniętych wierszy`, d: 'Nowe i zmienione wiersze wymagają dopasowania (Dane i AI → Dopasowanie, zakres: „tylko nowe i zmienione”).', filtr: { stat: 'zmiany' } });
    const sza = c.items.filter(i => i.g.src === 'szacunek AI' && i.g.status !== 'załatwione').length;
    if (sza) out.push({ lvl: '', typ: 'Czasy do potwierdzenia', t: `${sza} ${M.plural(sza, 'czynność ma', 'czynności mają', 'czynności ma')} czas oszacowany przez AI`, d: 'To szacunek z wiedzy ogólnej, nie dane z oferty. Potwierdź lub popraw czasy, zaczynając od zamówień z długą dostawą.', filtrCz: true });
    const waga = { red: 0, yel: 1, '': 2 };
    return out.map((x, i) => [x, i]).sort((a, b) => waga[a[0].lvl] - waga[b[0].lvl] || a[1] - b[1]).map(x => x[0]);
  };
  /** „Sprawdzone” dla wiersza zakresu – także dla wierszy podrzędnych z tą samą uwagą */
  G.ackScope = (id) => { const r = M.S.get('scope', id); if (!r) return; scope().filter(x => x === r || (x.sheet === r.sheet && x.sek === r.sek && x.lp.indexOf(r.lp + '.') === 0 && (x.note || '') === (r.note || ''))).forEach(x => { x.ack = true; M.S.upsert('scope', x, true); }); M.S.touch('scope'); };

  // =========================================================
  //  MODUŁ
  // =========================================================
  M.modules.straznik = {
    title: 'Strażnik Harmonogramu', icon: 'shield', order: 7,
    desc: 'Zakres + harmonogram → czynności i terminy z wyprzedzeniem. Alarmy przy otwarciu aplikacji.',
    today() {
      if (!M.S.project) return [];
      return G.alarms().slice(0, 10).map(a => ({ lvl: a.poziom === 'czerwony' ? 'red' : 'yel', icon: 'shield', kind: 'harm', t: `${a.tekst}: ${a.g.name}`, d: `Strażnik · ${a.g.kind} · ${M.fmt(a.start)}–${M.fmt(a.koniec)}${G.probny() ? ' · DZIEŃ PRÓBNY' : ''}`, go: 'straznik/alarmy', sort: a.doStartu }));
    },
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      const edit = M.P.canEdit('straznik');
      if (rest[0] && ['alarmy', 'czynnosci', 'zakres', 'wyjasnic', 'dane'].includes(rest[0])) st.tab = rest[0];
      if (!st.tab) st.tab = guards().length ? 'alarmy' : 'dane';
      const al = G.alarms(), iss = G.issues();
      v.innerHTML = M.UI.head('Strażnik <span class="acc">Harmonogramu</span>', `${tasks().length} pozycji harmonogramu · ${scope().length} wierszy zakresu · ${guards().length} czynności · ostrzeżenie ${G.cfg().window} dni wcześniej`,
        `<button class="btn" id="xls">${M.icon.xlsx}Excel</button>${edit ? `<button class="btn primary" id="addG">${M.icon.plus}Czynność</button>` : ''}`) + M.UI.readonlyBanner('straznik') +
        (G.probny() ? `<div class="banner or" style="margin-bottom:12px">${M.icon.clock}<span>Włączony <b>dzień próbny: ${M.fmt(G.dzis())}</b> – alarmy liczone są tak, jakby dziś była ta data. <a href="#" id="offDay">Wróć do dzisiejszej daty</a></span></div>` : '') +
        `<div class="tabs">${[['alarmy', 'Alarmy', al.length, al.some(a => a.poziom === 'czerwony')], ['czynnosci', 'Czynności', guards().length], ['zakres', 'Zakres', scope().length], ['wyjasnic', 'Do wyjaśnienia', iss.filter(i => i.lvl).length, true], ['dane', 'Dane i AI']].map(([k, l, n, or]) => `<button data-t="${k}" class="${st.tab === k ? 'on' : ''}">${l}${n ? ` <span class="badge ${or ? 'or' : ''}">${n}</span>` : ''}</button>`).join('')}</div><div id="body"></div>`;
      v.querySelectorAll('.tabs button').forEach(b => b.onclick = () => goTab(b.dataset.t));
      const od = v.querySelector('#offDay'); if (od) od.onclick = (ev) => { ev.preventDefault(); sessionStorage.removeItem('tekbb-straznik-dzis'); M.render(); };
      v.querySelector('#xls').onclick = () => G.excel();
      const ag = v.querySelector('#addG'); if (ag) ag.onclick = () => G.editGuard(null);
      const body = v.querySelector('#body');
      ({ alarmy: G.tabAlarmy, czynnosci: G.tabCzynnosci, zakres: G.tabZakres, wyjasnic: G.tabWyjasnic, dane: G.tabDane })[st.tab](body, v);
    },
  };

  // ---------------- zakładka: Alarmy ----------------
  const stBtns = (g) => M.P.isStaff() ? `<div class="row" style="gap:6px;flex-wrap:nowrap">${g.status !== 'w toku' ? `<button class="btn sm" data-st="w toku" data-id="${g.id}">W toku</button>` : ''}<button class="btn sm soft" data-st="załatwione" data-id="${g.id}">${M.icon.check}Załatwione</button></div>` : '';
  const bindSt = (root, after) => root.querySelectorAll('[data-st]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); G.setStatus(b.dataset.id, b.dataset.st); (after || M.render)(); });
  G.setStatus = (id, status) => { const g = M.S.get('guard', id); if (!g) return; g.status = status; g.statusBy = M.S.settings.currentUser; g.statusAt = Date.now(); if (status === 'załatwione') g.flag = ''; M.S.upsert('guard', g); };
  const alarmRows = (al) => `<table class="list"><tbody>${al.map(a => `<tr class="click" data-g="${a.g.id}"><td style="width:16px"><span class="light ${a.poziom === 'czerwony' ? 'r' : 'y'}"></span></td>
      <td><b>${e(a.tekst)}</b><div>${e(a.g.name)}</div><div class="xs muted">${e(a.g.cid)} · ${e(a.g.kind)} · ${M.fmt(a.start)}–${M.fmt(a.koniec)}${a.g.taskId ? ' · ' + e(taskTxt(a.g.taskId).slice(0, 70)) : ''}${a.g.respTxt ? ' · ' + e(a.g.respTxt) : ''}</div></td>
      <td class="hide-m">${a.g.src === 'szacunek AI' ? '<span class="badge warn">czas: szacunek AI</span>' : ''}${a.g.status === 'w toku' ? ' <span class="st check">W toku</span>' : ''}</td><td style="text-align:right">${stBtns(a.g)}</td></tr>`).join('')}</tbody></table>`;
  G.tabAlarmy = (body) => {
    const al = G.alarms(), gs = guards(), red = al.filter(a => a.poziom === 'czerwony').length, iss = G.issues().filter(i => i.lvl).length;
    if (!gs.length) { body.innerHTML = `<div class="card card-pad">${M.UI.empty('Nie ma jeszcze czynności. Przejdź do zakładki <b>Dane i AI</b>: wczytaj harmonogram i tabelę zakresową, a potem uruchom analizę AI.', 'shield')}</div>`; return; }
    body.innerHTML = `<div class="kpis"><div class="kpi"><b class="${red ? 'or' : ''}">${red}</b><span>po terminie / powinno trwać</span></div><div class="kpi"><b>${al.length - red}</b><span>do rozpoczęcia w ${G.cfg().window} dni</span></div><div class="kpi"><b class="${iss ? 'or' : ''}">${iss}</b><span>do wyjaśnienia</span></div><div class="kpi"><b>${gs.filter(g => g.status === 'załatwione').length} / ${gs.length}</b><span>załatwionych</span></div></div>
      <div class="card table-wrap">${al.length ? alarmRows(al) : `<div class="card-pad">${M.UI.empty(`Brak alarmów na ${M.fmt(G.dzis())}. Najbliższe terminy zobaczysz w zakładce Czynności.`, 'check')}</div>`}</div>`;
    body.querySelectorAll('tr[data-g]').forEach(tr => tr.onclick = () => G.editGuard(tr.dataset.g)); bindSt(body);
  };

  // ---------------- zakładka: Czynności ----------------
  G.tabCzynnosci = (body) => {
    const c = G.calc(); const al = {}; G.alarms().forEach(a => al[a.g.id] = a); const f = st.cz; const nry = G.numery().poId; const canSt = M.P.isStaff();
    const zadUzyte = [...new Set(c.items.map(i => i.g.taskId).filter(Boolean))];
    let items = c.items.filter(i => (!f.status || (f.status === 'otwarte' ? i.g.status !== 'załatwione' : i.g.status === f.status)) && (!f.rodzaj || i.g.kind === f.rodzaj) && (!f.zad || i.g.taskId === f.zad) && (!f.src || i.g.src === f.src) && (!f.q || M.norm(i.g.name + ' ' + (i.g.why || '') + ' ' + i.g.cid).includes(M.norm(f.q))));
    items.sort((a, b) => (a.start || '9').localeCompare(b.start || '9') || (a.koniec || '').localeCompare(b.koniec || ''));
    body.innerHTML = `<div class="card"><div class="toolbar">
        <div class="search"><span>${M.icon.search}</span><input type="search" id="q" placeholder="Szukaj…" value="${e(f.q)}"></div>
        <select id="fs" style="width:auto">${M.UI.opts([['otwarte', 'niezałatwione'], ...SH.STATUSY], f.status, 'każdy status')}</select>
        <select id="fr" style="width:auto">${M.UI.opts(SH.RODZAJE, f.rodzaj, 'każdy rodzaj')}</select>
        <select id="fz" style="width:auto;max-width:260px">${M.UI.opts(zadUzyte.map(id => [id, `${nry[id] || '?'}. ${taskTxt(id).slice(0, 44)}`]), f.zad, 'każda pozycja harmonogramu')}</select>
        <select id="fx" style="width:auto">${M.UI.opts(SH.ZRODLA, f.src, 'każde źródło czasu')}</select>
        <span class="small muted right">${items.length} z ${c.items.length}</span></div>
      <div class="table-wrap">${items.length ? `<table class="list"><thead><tr><th>Nr</th><th>Czynność</th><th class="hide-m">Rodzaj</th><th>Start</th><th>Koniec</th><th class="hide-m">Trwa</th><th class="hide-m">Źródło czasu</th><th>Status</th></tr></thead><tbody>${items.map(i => { const g = i.g, a = al[g.id]; return `<tr class="click" data-g="${g.id}" style="${g.status === 'załatwione' ? 'opacity:.55' : ''}"><td class="num">${e(g.cid)}</td>
          <td><b>${e(g.name)}</b>${a ? `<div class="small"><span class="light ${a.poziom === 'czerwony' ? 'r' : 'y'}"></span> ${e(a.tekst)}</div>` : ''}${i.blad ? `<div class="small" style="color:var(--danger)">${e(i.blad)}</div>` : ''}${g.flag ? `<div class="small"><span class="badge warn">do sprawdzenia</span></div>` : ''}<div class="xs muted">${g.taskId ? `poz. ${e(nry[g.taskId] || '?')}: ${e(taskTxt(g.taskId).slice(0, 60))}` : 'bez pozycji harmonogramu'}${g.respTxt ? ' · ' + e(g.respTxt) : ''}</div></td>
          <td class="hide-m small">${e(g.kind)}</td><td class="nowrap">${M.fmt(i.start) || '—'}</td><td class="nowrap">${M.fmt(i.koniec) || '—'}${i.reczna ? ' <span title="data wpisana ręcznie">✎</span>' : ''}</td><td class="hide-m small nowrap">${g.durW ? g.durW + ' tyg.' : 'termin'}</td>
          <td class="hide-m"><span class="badge ${SRC_BADGE[g.src] || ''}">${e(g.src || '—')}</span></td>
          <td onclick="event.stopPropagation()">${canSt ? `<select data-s="${g.id}" style="width:auto">${M.UI.opts(SH.STATUSY, g.status)}</select>` : `<span class="st ${ST_CLS[g.status]}">${e(g.status)}</span>`}</td></tr>`; }).join('')}</tbody></table>` : `<div class="card-pad">${M.UI.empty(c.items.length ? 'Żadna czynność nie pasuje do filtrów.' : 'Brak czynności. Zakładka Dane i AI → krok 4, albo dodaj czynność ręcznie.', 'list')}</div>`}</div></div>`;
    const re = () => G.tabCzynnosci(body);
    body.querySelector('#q').oninput = M.debounce((ev) => { f.q = ev.target.value; re(); const q = body.querySelector('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 350);
    body.querySelector('#fs').onchange = (ev) => { f.status = ev.target.value; re(); }; body.querySelector('#fr').onchange = (ev) => { f.rodzaj = ev.target.value; re(); };
    body.querySelector('#fz').onchange = (ev) => { f.zad = ev.target.value; re(); }; body.querySelector('#fx').onchange = (ev) => { f.src = ev.target.value; re(); };
    body.querySelectorAll('tr[data-g]').forEach(tr => tr.onclick = () => G.editGuard(tr.dataset.g));
    body.querySelectorAll('[data-s]').forEach(s => s.onchange = () => { G.setStatus(s.dataset.s, s.value); M.render(); });
  };

  /** szuflada: edycja czynności (id) albo nowa (null) */
  G.editGuard = (id) => {
    const edit = M.P.canEdit('straznik'), canSt = M.P.isStaff(); const isNew = !id; const ts = tasks(); const nry = G.numery().poId;
    const g = isNew ? { cid: nextCid(), name: '', kind: 'etap robót', taskId: '', anchor: { t: 'Z', ref: (ts.find(t => !t.summary && !t.tbd) || ts[0] || {}).id || '', e: 's' }, offW: 0, durW: 2, src: 'ręcznie', why: '', scope: [], status: 'do zrobienia', manualEnd: '', respTxt: '', origin: 'ręcznie' } : M.clone(M.S.get('guard', id));
    if (!g) return;
    const i = isNew ? null : G.calc().items.find(x => x.g.id === id); const inne = guards().filter(x => x.id !== g.id).sort((a, b) => a.cid.localeCompare(b.cid, 'pl', { numeric: true }));
    const sc = scope(true).filter(r => (g.scope || []).includes(r.id));
    const refOpts = `<optgroup label="Pozycje harmonogramu">${ts.map(t => `<option value="Z|${t.id}" ${g.anchor.t === 'Z' && g.anchor.ref === t.id ? 'selected' : ''}>${e(nry[t.id])}. ${e(t.name.slice(0, 70))}${t.tbd ? ' (bez terminu)' : ''}</option>`).join('')}</optgroup><optgroup label="Inne czynności">${inne.map(x => `<option value="C|${x.id}" ${g.anchor.t === 'C' && g.anchor.ref === x.id ? 'selected' : ''}>${e(x.cid)} ${e(x.name.slice(0, 70))}</option>`).join('')}</optgroup>`;
    const d = M.UI.drawer({ title: isNew ? 'Nowa czynność' : `${e(g.cid)} · ${e(g.name)}`, body: `
      ${g.flag ? `<div class="banner warn">${M.icon.alert}<span>${e(g.flag)} <a href="#" id="clr">Sprawdzone – usuń oznaczenie</a></span></div>` : ''}
      ${i && i.blad ? `<div class="banner or">${M.icon.alert}<span>${e(i.blad)}. Wskaż nowy punkt odniesienia albo wpisz datę ręcznie.</span></div>` : ''}
      ${i && !i.blad ? `<div class="banner info">${M.icon.cal}<span>Start najpóźniej <b>${M.fmt(i.start)}</b>, koniec najpóźniej <b>${M.fmt(i.koniec)}</b>${i.reczna ? ` (data ręczna; z wyliczenia wychodzi ${M.fmt(i.koniecWyliczony) || '—'})` : ''}.${i.uwaga ? ' ' + e(uw(i.uwaga)) + '.' : ''}</span></div>` : ''}
      <label class="f req"><span>Czynność</span><input type="text" data-f="name" value="${e(g.name)}"></label>
      <div class="grid2"><label class="f">Rodzaj<select data-f="kind">${M.UI.opts(SH.RODZAJE, g.kind)}</select></label><label class="f">Status<select data-f="status" data-keep="1" ${canSt ? '' : 'disabled'}>${M.UI.opts(SH.STATUSY, g.status)}</select></label></div>
      <label class="f">Pozycja harmonogramu, której dotyczy<select data-f="taskId">${M.UI.opts(ts.map(t => [t.id, `${nry[t.id]}. ${t.name.slice(0, 80)}`]), g.taskId, '— brak —')}</select></label>
      <div class="fieldset"><legend>Termin – liczony przez aplikację</legend>
        <label class="f">Punkt odniesienia<select id="aref">${refOpts}</select></label>
        <div class="grid3"><label class="f">Liczone od<select id="aedge">${M.UI.opts([['s', 'startu'], ['k', 'końca']], g.anchor.e)}</select></label>
          <label class="f">Przesunięcie [tyg.] <span class="hint">minus = wcześniej</span><input type="number" step="0.5" data-f="offW" value="${e(g.offW)}"></label>
          <label class="f">Czas trwania [tyg.]<input type="number" min="0" step="0.5" data-f="durW" value="${e(g.durW)}"></label></div>
        <div class="small muted">Koniec czynności = punkt odniesienia + przesunięcie. Start = koniec − czas trwania. Po zmianie harmonogramu termin przeliczy się sam.</div></div>
      <div class="fieldset"><legend>Data wpisana ręcznie (opcjonalnie)</legend><label class="f">Koniec czynności – na sztywno<input type="date" data-f="manualEnd" value="${e(g.manualEnd || '')}"></label>
        <div class="small muted">Data ręczna nie przesuwa się razem z harmonogramem. Po zmianie harmonogramu czynność dostanie oznaczenie „do sprawdzenia”.</div></div>
      <div class="grid2"><label class="f">Źródło czasu<select data-f="src">${M.UI.opts(SH.ZRODLA, g.src)}</select></label><label class="f">Odpowiedzialny<input type="text" data-f="respTxt" value="${e(g.respTxt || '')}" placeholder="osoba lub firma"></label></div>
      <label class="f">Uzasadnienie / uwagi<textarea data-f="why" rows="3">${e(g.why || '')}</textarea></label>
      ${sc.length ? `<div class="fieldset"><legend>Wiersze zakresu (${sc.length})</legend>${sc.map(r => `<div class="small"><b>${e(r.key)}</b> ${e(r.text.slice(0, 120))}${r.removed ? ' <span class="badge danger">usunięty z tabeli</span>' : ''}</div>`).join('')}</div>` : ''}
      ${!isNew ? `<div class="xs muted">Pochodzenie: ${e(g.origin || '—')}${g.statusAt ? ` · status zmieniony ${M.fmtTs(g.statusAt)} (${e(M.S.respName(g.statusBy))})` : ''}</div>` : ''}`,
      footer: edit ? `${!isNew ? `<button class="btn danger" id="del" title="Usuń czynność">${M.icon.trash}</button>` : ''}${!isNew && g.src === 'szacunek AI' ? `<button class="btn" id="conf">${M.icon.check}Potwierdzam czas</button>` : ''}<span class="grow"></span><button class="btn primary" id="ok">${M.icon.check}Zapisz</button>` : canSt && !isNew ? `<span class="grow"></span><button class="btn primary" id="okSt">${M.icon.check}Zapisz status</button>` : '' });
    if (!edit) { M.UI.lockForm(d, true); d.querySelectorAll('#aref,#aedge').forEach(x => x.disabled = true); }
    const zapisz = (patch) => {
      const f = M.UI.read(d); if (!String(f.name).trim()) return M.toast('Podaj nazwę czynności', 'warn');
      const [t, ref] = d.querySelector('#aref').value.split('|'); if (!ref) return M.toast('Wskaż punkt odniesienia', 'warn');
      const stary = isNew ? null : M.S.get('guard', id);
      const rec = Object.assign({}, g, f, { name: f.name.trim(), offW: Number(f.offW) || 0, durW: Math.max(0, Number(f.durW) || 0), anchor: { t, ref, e: d.querySelector('#aedge').value } }, patch || {});
      // zmiana czasu lub punktu odniesienia przez człowieka = źródło „ręcznie” (chyba że sam wybrał inne)
      if (stary && f.src === stary.src && (rec.offW !== stary.offW || rec.durW !== stary.durW || rec.anchor.ref !== stary.anchor.ref || rec.anchor.e !== stary.anchor.e) && ['szacunek AI', 'reguła budowy'].includes(stary.src)) rec.src = 'ręcznie';
      if (stary && rec.status !== stary.status) { rec.statusBy = M.S.settings.currentUser; rec.statusAt = Date.now(); }
      const prob = SH.przelicz(M.S.all('tasks').map(x => ({ id: x.id, start: x.start, koniec: x.end, bezTerminu: !!x.tbd })), guards().filter(x => x.id !== rec.id).concat([Object.assign({ id: rec.id || 'nowa' }, rec)]).map(x => ({ id: x.id, kotwica: x.anchor, przes_tyg: x.offW, trwanie_tyg: x.durW, dataReczna: x.manualEnd || '' })));
      const bl = prob.bledy.find(b => b.id === (rec.id || 'nowa')); if (bl && /Zapętlona/.test(bl.blad)) return M.toast('Zapętlona kolejność: ta czynność zależy sama od siebie. Wybierz inny punkt odniesienia.', 'err');
      M.S.upsert('guard', rec); d.close(); M.render();
    };
    if (edit) {
      d.querySelector('#ok').onclick = () => zapisz();
      const del = d.querySelector('#del'); if (del) del.onclick = async () => { const zal = guards().filter(x => x.anchor.t === 'C' && x.anchor.ref === g.id); if (await M.UI.confirm(`Usunąć czynność ${e(g.cid)}?${zal.length ? `<div class="small" style="margin-top:6px">Od niej liczone są terminy: ${zal.map(x => e(x.cid)).join(', ')} – trafią na listę „Do wyjaśnienia”.</div>` : ''}`, 'Usuń', true)) { M.S.remove('guard', g.id); d.close(); M.render(); } };
      const cf = d.querySelector('#conf'); if (cf) cf.onclick = () => { d.querySelector('[data-f="src"]').value = 'potwierdzone'; zapisz(); };
    } else { const os = d.querySelector('#okSt'); if (os) os.onclick = () => { G.setStatus(g.id, d.querySelector('[data-f="status"]').value); d.close(); M.render(); }; }
    const clr = d.querySelector('#clr'); if (clr) clr.onclick = (ev) => { ev.preventDefault(); const x = M.S.get('guard', g.id); x.flag = ''; M.S.upsert('guard', x); d.close(); M.render(); };
  };

  // ---------------- zakładka: Zakres ----------------
  G.tabZakres = (body) => {
    const all = scope(true), f = st.zak, nry = G.numery().poId, edit = M.P.canEdit('straznik');
    if (!all.length) { body.innerHTML = `<div class="card card-pad">${M.UI.empty('Nie wczytano tabeli zakresowej. Zakładka <b>Dane i AI</b> → krok 2.', 'doc')}</div>`; return; }
    const ark = [...new Set(all.map(r => r.sheet))];
    const rows = all.filter(r => (f.stat === 'zmiany' ? !!r.chg : !r.removed) && (!f.ark || r.sheet === f.ark) && (!f.stat || f.stat === 'zmiany' || (f.stat === 'opcja' ? r.sek === 'O' : stZak(r) === f.stat)) && (!f.pew || (r.conf || '') === f.pew) && (!f.bez || (!r.naglowek && !(r.taskIds || []).length && ['w zakresie', 'pomniejszenie'].includes(stZak(r)) && r.sek !== 'O')) && (!f.q || M.norm(r.key + ' ' + r.text + ' ' + (r.note || '')).includes(M.norm(f.q))));
    body.innerHTML = `<div class="card"><div class="toolbar">
        <div class="search"><span>${M.icon.search}</span><input type="search" id="q" placeholder="Szukaj w opisie, kluczu…" value="${e(f.q)}"></div>
        <select id="fa" style="width:auto">${M.UI.opts(ark, f.ark, 'wszystkie arkusze')}</select>
        <select id="fs" style="width:auto">${M.UI.opts([...SH.ST_ZAKRESU, ['opcja', 'opcje'], ['zmiany', 'zmiany po aktualizacji']], f.stat, 'każdy status')}</select>
        <select id="fp" style="width:auto">${M.UI.opts([['W', 'pewność wysoka'], ['S', 'pewność średnia'], ['N', 'pewność niska']], f.pew, 'każda pewność')}</select>
        <label class="check"><input type="checkbox" id="fb" ${f.bez ? 'checked' : ''}>bez pozycji</label>
        <span class="small muted right">${rows.length} z ${all.filter(r => !r.removed).length}</span></div>
      <div class="table-wrap">${rows.length ? `<table class="list"><thead><tr><th>Klucz</th><th>Opis</th><th class="hide-m">Ilość</th><th>Status</th><th>Poz. harm.</th><th class="hide-m">Pewność</th></tr></thead><tbody>${rows.slice(0, 600).map(r => `<tr class="${edit ? 'click' : ''}" data-r="${r.id}" style="${r.removed ? 'opacity:.5;text-decoration:line-through' : ''}"><td class="num">${e(r.key)}</td>
          <td style="padding-left:${11 + Math.min(4, r.lp.split('.').length - 1) * 12}px;${r.naglowek ? 'font-weight:800' : ''}">${e(r.text.slice(0, 260))}${r.text.length > 260 ? '…' : ''}${r.chg ? ` <span class="badge ${r.chg === 'usunięty' ? 'danger' : 'warn'}">${e(r.chg)}</span>` : ''}${r.sek === 'O' ? ' <span class="badge">opcja</span>' : ''}${r.note ? `<div class="xs muted">${e(r.note)}</div>` : ''}</td>
          <td class="hide-m small nowrap">${r.qty != null ? e(String(Math.round(r.qty * 100) / 100).replace('.', ',')) + ' ' + e(r.unit || '') : ''}</td>
          <td><span class="st ${ZK_CLS[stZak(r)] || 'rej'}">${e(stZak(r))}</span></td>
          <td class="small">${(r.taskIds || []).map(id => `<span class="badge" title="${e(taskTxt(id))}">${e(nry[id] || '?')}</span>`).join(' ') || (r.naglowek ? '' : '<span class="muted">—</span>')}</td>
          <td class="hide-m small nowrap"><span class="light ${PEW[r.conf || ''][1]}"></span> ${PEW[r.conf || ''][0]}${r.src === 'ręcznie' ? ' ✎' : ''}</td></tr>`).join('')}</tbody></table>${rows.length > 600 ? `<div class="card-pad small muted">Pokazano 600 z ${rows.length} wierszy – zawęź filtrem.</div>` : ''}` : `<div class="card-pad">${M.UI.empty('Żaden wiersz nie pasuje do filtrów.', 'filter')}</div>`}</div></div>`;
    const re = () => G.tabZakres(body);
    body.querySelector('#q').oninput = M.debounce((ev) => { f.q = ev.target.value; re(); const q = body.querySelector('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 350);
    body.querySelector('#fa').onchange = (ev) => { f.ark = ev.target.value; re(); }; body.querySelector('#fs').onchange = (ev) => { f.stat = ev.target.value; re(); };
    body.querySelector('#fp').onchange = (ev) => { f.pew = ev.target.value; re(); }; body.querySelector('#fb').onchange = (ev) => { f.bez = ev.target.checked; re(); };
    if (edit) body.querySelectorAll('tr[data-r]').forEach(tr => tr.onclick = () => G.editScope(tr.dataset.r));
  };
  /** szuflada: ręczne przypisanie wiersza zakresu do pozycji harmonogramu */
  G.editScope = (id) => {
    const r = M.S.get('scope', id); if (!r) return; const ts = tasks(), nry = G.numery().poId; const dzieci = r.naglowek ? scope().filter(x => x.sheet === r.sheet && x.sek === r.sek && x.id !== r.id && x.lp.indexOf(r.lp + '.') === 0) : [];
    const gs = guards().filter(g => (g.scope || []).includes(r.id));
    const d = M.UI.drawer({ title: e(r.key), body: `
      <div class="small muted">${e(r.sheet)} · wiersz ${e(r.row)}${r.qty != null ? ` · ${e(r.qty)} ${e(r.unit || '')}` : ''}</div><div style="margin:6px 0 12px">${e(r.text)}</div>
      ${r.chg ? `<div class="banner warn">${M.icon.alert}<span>Po ostatniej aktualizacji tabeli: <b>${e(r.chg)}</b>.</span></div>` : ''}
      <div class="grid2"><label class="f">Status w zakresie<select data-f="statusM">${M.UI.opts(SH.ST_ZAKRESU, r.statusM || '', `automatyczny: ${r.status}`)}</select></label>
        <label class="f">Pewność dopasowania<select data-f="conf">${M.UI.opts([['W', 'wysoka'], ['S', 'średnia'], ['N', 'niska']], r.conf || '', '—')}</select></label></div>
      <div class="fieldset"><legend>Pozycje harmonogramu</legend><div style="max-height:34vh;overflow:auto">${ts.map(t => `<label class="check" style="display:flex;padding-left:${(Math.max(1, t.level || 1) - 1) * 12}px"><input type="checkbox" data-t="${t.id}" ${(r.taskIds || []).includes(t.id) ? 'checked' : ''}><span class="small" style="${t.summary ? 'font-weight:800' : ''}">${e(nry[t.id])}. ${e(t.name)} <span class="muted">${t.tbd ? '(termin do uzgodnienia)' : M.fmt(t.start) + '–' + M.fmt(t.end)}</span></span></label>`).join('')}</div></div>
      <label class="f">Uwaga<textarea data-f="note" rows="3">${e(r.note || '')}</textarea></label>
      ${dzieci.length ? `<label class="check"><input type="checkbox" id="down" checked>Zastosuj także do ${dzieci.length} ${M.plural(dzieci.length, 'wiersza podrzędnego', 'wierszy podrzędnych', 'wierszy podrzędnych')}</label>` : ''}
      <label class="check"><input type="checkbox" data-f="ack" ${r.ack ? 'checked' : ''}>Sprawdzone – nie pokazuj na liście „Do wyjaśnienia”</label>
      ${gs.length ? `<div class="fieldset"><legend>Czynności dotyczące tego wiersza</legend>${gs.map(g => `<div class="small"><b>${e(g.cid)}</b> ${e(g.name)}</div>`).join('')}</div>` : ''}`,
      footer: `<span class="grow"></span><button class="btn primary" id="ok">${M.icon.check}Zapisz</button>` });
    d.querySelector('#ok').onclick = () => {
      const f = M.UI.read(d); const ids = [...d.querySelectorAll('[data-t]:checked')].map(x => x.dataset.t);
      const patch = { taskIds: ids, conf: f.conf, src: 'ręcznie' };
      Object.assign(r, patch, { statusM: f.statusM, note: f.note, ack: f.ack, chg: f.ack ? '' : r.chg }); M.S.upsert('scope', r, true);
      const down = d.querySelector('#down'); if (down && down.checked) dzieci.forEach(x => { Object.assign(x, patch); if (f.ack) { x.ack = true; x.chg = ''; } M.S.upsert('scope', x, true); });
      M.S.touch('scope'); d.close(); M.render();
    };
  };

  // ---------------- zakładka: Do wyjaśnienia ----------------
  G.tabWyjasnic = (body) => {
    const iss = G.issues(); const edit = M.P.canEdit('straznik');
    body.innerHTML = `<div class="card">${iss.length ? `<table class="list"><tbody>${iss.map((i, n) => `<tr class="${i.guard || i.scope || i.filtr || i.filtrCz ? 'click' : ''}" data-n="${n}"><td style="width:16px"><span class="light ${i.lvl === 'red' ? 'r' : i.lvl === 'yel' ? 'y' : 'n'}"></span></td><td><div class="xs muted" style="text-transform:uppercase;font-weight:800;letter-spacing:.4px">${e(i.typ)}</div><b>${e(i.t)}</b><div class="small">${e(i.d)}</div></td><td style="text-align:right;white-space:nowrap">${edit && i.scope ? `<button class="btn sm" data-ack="${i.scope}">${M.icon.check}Sprawdzone</button>` : ''}${edit && i.clearFlag ? `<button class="btn sm" data-clr="${i.guard}">${M.icon.check}Sprawdzone</button>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div class="card-pad">${M.UI.empty('Nic do wyjaśnienia.', 'check')}</div>`}</div>
      <div class="small muted" style="margin-top:8px">Lista liczy się sama: rozbieżności i niepewne dopasowania od AI, zakres bez pozycji harmonogramu, pozycje bez zakresu, czynności z utraconym punktem odniesienia i terminy wypadające przed startem budowy. Szare pozycje są informacyjne.</div>`;
    body.querySelectorAll('tr[data-n]').forEach(tr => tr.onclick = () => { const i = iss[+tr.dataset.n]; if (i.guard) return G.editGuard(i.guard); if (i.scope && edit) return G.editScope(i.scope); if (i.filtr) { st.zak = Object.assign({ ark: '', stat: '', pew: '', bez: false, q: '' }, i.filtr); return goTab('zakres'); } if (i.filtrCz) { st.cz = { status: 'otwarte', rodzaj: '', zad: '', q: '', src: 'szacunek AI' }; return goTab('czynnosci'); } });
    body.querySelectorAll('[data-ack]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); G.ackScope(b.dataset.ack); M.render(); });
    body.querySelectorAll('[data-clr]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); const g = M.S.get('guard', b.dataset.clr); g.flag = ''; M.S.upsert('guard', g); M.render(); });
  };

  // ---------------- zakładka: Dane i AI ----------------
  G.tabDane = (body, v) => {
    const edit = M.P.canEdit('straznik'); const ts = tasks(), sc = scope(), gs = guards(), cfg = G.cfg();
    const imp = (kind) => M.S.all('imports').filter(i => i.kind === kind).sort((a, b) => b.ts - a.ts)[0];
    const ih = imp('harmonogram'), iz = imp('zakres'); const lisc = sc.filter(r => !r.naglowek);
    const dop = lisc.filter(r => (r.taskIds || []).length).length; const zm = sc.filter(r => r.chg === 'nowy' || r.chg === 'zmieniony').length;
    const zTerm = ts.filter(t => !t.summary && !t.tbd), zCz = new Set(gs.map(g => g.taskId));
    const krok = (n, tyt, stan, opis, btn) => `<div class="step" style="align-items:flex-start"><span class="n" style="${stan ? 'background:var(--st-done);color:#fff' : ''}">${stan ? '✓' : n}</span><div class="grow"><b>${tyt}</b><div class="small">${opis}</div>${edit && btn ? `<div class="row" style="margin-top:6px">${btn}</div>` : ''}</div></div>`;
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <div class="card card-pad col"><h2>Od plików do alarmów</h2><div class="steps">
        ${krok(1, 'Harmonogram', ts.length, ts.length ? `${ts.length} pozycji, w tym ${zTerm.length} z terminem${ts.some(t => t.tbd) ? ` i ${ts.filter(t => t.tbd).length} „do uzgodnienia”` : ''}.${ih ? ` Ostatnie wczytanie: ${M.fmtTs(ih.ts)}${ih.file ? ' (' + e(ih.file) + ')' : ''}.` : ''}` : 'Wczytaj harmonogram z MS Project (XML), Excela albo – gdy masz tylko PDF – przez AI.', `<button class="btn" id="bH">${M.icon.upload}${ts.length ? 'Aktualizuj harmonogram' : 'Wczytaj harmonogram'}</button><button class="btn ghost" id="bHm">${M.icon.gantt}Otwórz moduł Harmonogram</button>`)}
        ${krok(2, 'Tabela zakresowa', sc.length, sc.length ? `${sc.length} wierszy: ${SH.ST_ZAKRESU.map(s => [s, sc.filter(r => stZak(r) === s).length]).filter(x => x[1]).map(x => `${x[0]} ${x[1]}`).join(', ')}.${iz ? ` Ostatnie wczytanie: ${M.fmtTs(iz.ts)}${iz.file ? ' (' + e(iz.file) + ')' : ''}.` : ''}` : 'Wczytaj plik Excela z tabelą zakresową. Wskażesz arkusze i kolumny: lp., opis, jednostka, ilość.', `<button class="btn" id="bZ" ${ts.length ? '' : 'disabled'}>${M.icon.upload}${sc.length ? 'Aktualizuj tabelę zakresową' : 'Wczytaj tabelę zakresową'}</button>`)}
        ${krok(3, 'Dopasowanie zakresu do harmonogramu (AI)', sc.length && dop > 0 && !zm, sc.length ? `Przypisanych: ${dop} z ${lisc.length} wierszy.${zm ? ` <b>${zm} nowych lub zmienionych wierszy czeka na dopasowanie.</b>` : ''}` : 'Dostępne po wczytaniu harmonogramu i tabeli zakresowej.', `<button class="btn soft" id="bA" ${sc.length && ts.length ? '' : 'disabled'}>${M.icon.spark}Przygotuj prompt: dopasowanie</button>`)}
        ${krok(4, 'Czynności i czasy (AI)', gs.length, gs.length ? `${gs.length} czynności; pozycje harmonogramu bez żadnej czynności: ${zTerm.filter(t => !zCz.has(t.id)).length} z ${zTerm.length}.` : 'AI rozpisze pozycje harmonogramu na etapy, wybory wykonawców, zamówienia, projekty i sprawy urzędowe. Poda czasy – daty policzy aplikacja.', `<button class="btn soft" id="bC" ${dop ? '' : 'disabled'}>${M.icon.spark}Przygotuj prompt: czynności</button>`)}
        ${krok(5, 'Przegląd', false, 'Zakładka <b>Do wyjaśnienia</b>: rozbieżności i niepewne dopasowania. Zakładka <b>Czynności</b>: popraw czasy, które znasz z ofert, i potwierdź szacunki AI.', '')}
      </div>
      <div class="banner info">${M.icon.shield}<span class="small">AI jest potrzebne tylko w krokach 3 i 4 oraz po zmianie plików. Alarmy liczy sama aplikacja przy każdym otwarciu – także bez internetu.</span></div></div>
      <div class="col">
        <div class="card card-pad col"><h2>Ustawienia Strażnika</h2>
          <div class="grid2"><label class="f">Ostrzegaj z wyprzedzeniem [dni]<input type="number" min="0" max="120" id="cW" value="${e(cfg.window)}" ${edit ? '' : 'disabled'}></label><label class="f">Maks. czynności na pozycję harmonogramu<input type="number" min="2" max="30" id="cL" value="${e(cfg.limit)}" ${edit ? '' : 'disabled'}></label></div>
          <label class="f">Reguły budowy <span class="hint">trafiają do promptu – AI stosuje Twoje wartości zamiast zgadywać</span><textarea id="cR" rows="7" ${edit ? '' : 'disabled'}>${e(cfg.rules)}</textarea></label>
          ${edit ? `<div><button class="btn primary" id="cS">${M.icon.check}Zapisz ustawienia</button></div>` : ''}</div>
        <div class="card card-pad col"><h2>Dzień próbny</h2><div class="small muted">Do sprawdzenia modułu na starym harmonogramie: alarmy policzą się tak, jakby dziś była wskazana data. Działa tylko na tym urządzeniu i do zamknięcia karty.</div>
          <div class="row"><input type="date" id="dP" value="${G.probny() ? e(G.dzis()) : ''}" style="width:auto"><button class="btn" id="dS">Ustaw</button>${G.probny() ? `<button class="btn ghost" id="dX">Wyłącz</button>` : ''}</div></div>
        ${M.S.all('imports').length ? `<div class="card card-pad col"><h2>Historia wczytań</h2>${M.S.all('imports').sort((a, b) => b.ts - a.ts).slice(0, 8).map(i => `<div class="small"><b>${M.fmtTs(i.ts)}</b> · ${e(i.kind)}${i.file ? ' · ' + e(i.file) : ''}${i.source ? ' · ' + e(i.source) : ''} · ${i.n} wierszy${i.added || i.moved || i.removed || i.changed ? ` (nowe ${i.added || 0}, ${i.kind === 'zakres' ? 'zmienione ' + (i.changed || 0) : 'przesunięte ' + (i.moved || 0)}, usunięte ${i.removed || 0})` : ''}</div>`).join('')}</div>` : ''}
      </div></div>`;
    const on = (id, fn) => { const b = body.querySelector(id); if (b) b.onclick = fn; };
    on('#bH', () => M.modules.harmonogram.importDialog(v)); on('#bHm', () => M.go('harmonogram')); on('#bZ', () => G.importScope()); on('#bA', () => G.aiDopasowanie()); on('#bC', () => G.aiCzynnosci());
    on('#cS', () => { G.saveCfg({ window: Math.max(0, Number(body.querySelector('#cW').value) || 0), limit: Math.max(2, Number(body.querySelector('#cL').value) || 8), rules: body.querySelector('#cR').value }); M.toast('Ustawienia Strażnika zapisane'); M.render(); });
    on('#dS', () => { const d = body.querySelector('#dP').value; if (!d) return M.toast('Wybierz datę', 'warn'); sessionStorage.setItem('tekbb-straznik-dzis', d); M.render(); }); on('#dX', () => { sessionStorage.removeItem('tekbb-straznik-dzis'); M.render(); });
  };

  // =========================================================
  //  IMPORT / AKTUALIZACJA TABELI ZAKRESOWEJ (Excel)
  // =========================================================
  const colL = (i) => { let s = ''; i++; while (i > 0) { s = String.fromCharCode(65 + (i - 1) % 26) + s; i = Math.floor((i - 1) / 26); } return s; };
  /** wczytuje arkusze i zgaduje wiersz nagłówka oraz kolumny lp. / opis / jednostka / ilość */
  G.readWorkbook = async (file) => {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
    return wb.worksheets.map(ws => {
      const rows = []; ws.eachRow({ includeEmpty: false }, (r, nr) => { const a = []; r.eachCell({ includeEmpty: true }, (c, i) => { let val = M.cellVal(c.value); if (val && typeof val === 'object' && !(val instanceof Date)) val = val.error ? '' : String(val); a[i - 1] = val; }); for (let i = 0; i < a.length; i++) if (a[i] === undefined || a[i] === null) a[i] = ''; rows.push({ nr, a }); });
      const hi = rows.slice(0, 25).findIndex(r => r.a.some(c => /^lp\.?$/.test(M.norm(c)) || M.norm(c) === 'l p'));
      const head = hi >= 0 ? rows[hi].a.map(M.norm) : []; const find = (al) => head.findIndex(h => al.some(x => h === x || h.indexOf(x + ' ') === 0));
      const lp = hi >= 0 ? head.findIndex(h => /^lp$|^l p$/.test(h)) : 0; let opis = find(['opis', 'zakres', 'nazwa', 'wyszczegolnienie', 'opis robot', 'zakres prac', 'zakres robot']); if (opis < 0) opis = lp + 1;
      return { nazwa: ws.name, rows, headRow: hi >= 0 ? rows[hi].nr : 0, lp, opis, jedn: find(['jedn', 'jm', 'j m', 'jednostka']), ilosc: find(['ilosc', 'obmiar', 'przedmiar']), width: Math.max(0, ...rows.slice(0, 60).map(r => r.a.length)), use: hi >= 0 };
    });
  };
  G.importScope = async () => {
    const file = await M.pickFile('.xlsx'); if (!file) return;
    let sheets; try { sheets = await G.readWorkbook(file); } catch (err) { return M.toast('Nie udało się odczytać pliku: ' + err.message, 'err'); }
    if (!sheets.length) return M.toast('Plik nie ma arkuszy', 'err');
    const has = scope(true).length > 0;
    const colSel = (s, k, i) => `<select data-k="${k}" data-i="${i}" style="width:auto">${k === 'jedn' || k === 'ilosc' ? '<option value="-1">— brak —</option>' : ''}${Array.from({ length: Math.max(s.width, 2) }, (_, c) => `<option value="${c}" ${s[k] === c ? 'selected' : ''}>${colL(c)}</option>`).join('')}</select>`;
    const m = M.UI.modal({ title: has ? 'Aktualizacja tabeli zakresowej' : 'Tabela zakresowa – wybór arkuszy i kolumn', wide: true, body: `
      <div class="small muted" style="margin-bottom:8px">Plik: <b>${e(file.name)}</b>. Zaznacz arkusze z zakresem i sprawdź, czy kolumny są wskazane poprawnie. Wiersz „OPCJE” rozpoczyna sekcję opcji; wiersze bez numeru lp. i wiersze „razem” są pomijane.</div>
      <div class="table-wrap"><table class="list"><thead><tr><th></th><th>Arkusz</th><th>Wiersz nagłówka</th><th>Lp.</th><th>Opis</th><th>Jedn.</th><th>Ilość</th><th>Wierszy</th></tr></thead><tbody>${sheets.map((s, i) => `<tr><td><input type="checkbox" data-u="${i}" ${s.use ? 'checked' : ''}></td><td><b>${e(s.nazwa)}</b></td><td><input type="number" min="0" data-h="${i}" value="${s.headRow}" style="width:74px"></td><td>${colSel(s, 'lp', i)}</td><td>${colSel(s, 'opis', i)}</td><td>${colSel(s, 'jedn', i)}</td><td>${colSel(s, 'ilosc', i)}</td><td class="num" data-n="${i}"></td></tr>`).join('')}</tbody></table></div>
      <div id="prev" style="margin-top:10px"></div>`, footer: `<span class="small muted grow">${has ? 'Dopasowania, czynności, statusy i ręczne poprawki dla wierszy bez zmian zostają.' : 'Wynik zobaczysz w zakładce Zakres.'}</span><button class="btn primary" id="ok">${M.icon.check}${has ? 'Porównaj z obecną tabelą' : 'Wczytaj zakres'}</button>` });
    const build = () => {
      m.querySelectorAll('[data-u]').forEach(c => sheets[+c.dataset.u].use = c.checked); m.querySelectorAll('[data-h]').forEach(c => sheets[+c.dataset.h].headRow = Number(c.value) || 0); m.querySelectorAll('[data-k]').forEach(c => sheets[+c.dataset.i][c.dataset.k] = Number(c.value));
      const ark = sheets.map((s, i) => ({ i, nazwa: s.nazwa, use: s.use, wiersze: s.rows.filter(r => r.nr > s.headRow).map(r => ({ w: r.nr, lp: typeof r.a[s.lp] === 'number' ? String(r.a[s.lp]) : r.a[s.lp], opis: r.a[s.opis] instanceof Date ? '' : r.a[s.opis], jedn: s.jedn >= 0 ? r.a[s.jedn] : '', ilosc: s.ilosc >= 0 ? r.a[s.ilosc] : '' })) }));
      const out = SH.zbudujZakres(ark.filter(a => a.use)); const ord = {}; ark.forEach(a => ord[a.nazwa] = a.i);
      out.forEach(r => r.ord = ord[r.arkusz]);
      sheets.forEach((s, i) => { m.querySelector(`[data-n="${i}"]`).textContent = s.use ? out.filter(r => r.arkusz === s.nazwa).length : '—'; });
      return out;
    };
    const prev = () => { const out = build(); const p = out.slice(0, 6); m.querySelector('#prev').innerHTML = out.length ? `<div class="small"><b>Razem ${out.length} wierszy.</b> Podgląd pierwszych:</div>${p.map(r => `<div class="xs"><b>${e(r.klucz)}</b> · ${e(r.opis.slice(0, 110))}${r.ilosc != null ? ` · ${e(r.ilosc)} ${e(r.jedn)}` : ''} · <span class="muted">${e(r.status)}</span></div>`).join('')}` : `<div class="banner warn">${M.icon.alert}<span>Nie znaleziono wierszy z numerem lp. i opisem. Sprawdź wskazane kolumny i wiersz nagłówka.</span></div>`; return out; };
    m.querySelectorAll('input,select').forEach(x => x.onchange = prev); prev();
    m.querySelector('#ok').onclick = () => { const out = build(); if (!out.length) return M.toast('Brak wierszy do wczytania', 'warn'); m.close(); if (!has) { const r = G.applyScope(out, file.name); M.toast(`Wczytano ${r.nowe} wierszy zakresu`); goTab('zakres'); } else G.scopeDiff(out, file.name); };
  };
  const toRec = (n) => ({ key: n.klucz, sheet: n.arkusz, code: n.kod, sek: n.sekcja, lp: n.lp, text: n.opis, unit: n.jedn, qty: n.ilosc, row: n.wiersz, ord: n.ord || 0, naglowek: n.naglowek, status: n.status });
  const asOld = (r) => ({ klucz: r.key, arkusz: r.sheet, opis: r.text, rec: r });
  /** okno różnic przed aktualizacją zakresu */
  G.scopeDiff = (out, fileName) => {
    const p = SH.porownajZakres(scope(true).map(asOld), out); const li = (a, f) => a.slice(0, 25).map(f).join('') + (a.length > 25 ? `<li class="muted">… i ${a.length - 25} kolejnych</li>` : '');
    const usun = p.usuniete.filter(s => !s.rec.removed);
    const m = M.UI.modal({ title: 'Zmiany w tabeli zakresowej', wide: true, body: `
      <div class="kpis"><div class="kpi"><b>${p.bezZmian.length + p.przeniesione.length}</b><span>bez zmian</span></div><div class="kpi"><b class="${p.zmienione.length ? 'or' : ''}">${p.zmienione.length}</b><span>zmienionych</span></div><div class="kpi"><b class="${p.nowe.length ? 'or' : ''}">${p.nowe.length}</b><span>nowych</span></div><div class="kpi"><b class="${usun.length ? 'or' : ''}">${usun.length}</b><span>usuniętych</span></div></div>
      ${p.zmienione.length ? `<div class="fieldset"><legend>Zmieniony opis (dopasowanie zostaje, do sprawdzenia)</legend><ul class="small" style="margin:0;padding-left:18px">${li(p.zmienione, x => `<li><b>${e(x[1].klucz)}</b>: <span class="muted">${e(x[0].opis.slice(0, 90))}</span> → ${e(x[1].opis.slice(0, 90))}</li>`)}</ul></div>` : ''}
      ${p.nowe.length ? `<div class="fieldset"><legend>Nowe wiersze (bez dopasowania)</legend><ul class="small" style="margin:0;padding-left:18px">${li(p.nowe, x => `<li><b>${e(x.klucz)}</b> ${e(x.opis.slice(0, 110))}</li>`)}</ul></div>` : ''}
      ${usun.length ? `<div class="fieldset"><legend>Usunięte (zostają w aplikacji jako przekreślone; czynności nie są kasowane)</legend><ul class="small" style="margin:0;padding-left:18px">${li(usun, x => `<li><b>${e(x.klucz)}</b> ${e(x.opis.slice(0, 110))}</li>`)}</ul></div>` : ''}
      ${p.przeniesione.length ? `<div class="small muted">${p.przeniesione.length} ${M.plural(p.przeniesione.length, 'wiersz zmienił', 'wiersze zmieniły', 'wierszy zmieniło')} numer lp. (ten sam opis) – dopasowanie przechodzi na nowy numer.</div>` : ''}
      ${!p.zmienione.length && !p.nowe.length && !usun.length ? `<div class="banner ok">${M.icon.check}<span>Plik nie różni się od tabeli w aplikacji.</span></div>` : ''}`,
      footer: `<button class="btn ghost" id="no">Anuluj</button><button class="btn primary" id="ok">${M.icon.check}Zastosuj zmiany</button>` });
    m.querySelector('#no').onclick = () => m.close();
    m.querySelector('#ok').onclick = () => { m.close(); const r = G.applyScope(out, fileName); M.toast(`Zakres zaktualizowany – nowe: ${r.nowe}, zmienione: ${r.zmienione}, usunięte: ${r.usuniete}`); goTab(r.nowe || r.zmienione || r.usuniete ? 'wyjasnic' : 'zakres'); };
  };
  /** zapis zakresu: pierwsze wczytanie albo aktualizacja z zachowaniem dopasowań, statusów i ręcznych poprawek */
  G.applyScope = (out, fileName) => {
    const stare = scope(true); const r = { nowe: 0, zmienione: 0, usuniete: 0 };
    const p = SH.porownajZakres(stare.map(asOld), out);
    const upd = (pair, chg) => { const rec = pair[0].rec; Object.assign(rec, toRec(pair[1]), { removed: false }); if (chg) { rec.chg = chg; rec.ack = false; } else if (rec.chg === 'usunięty') rec.chg = ''; M.S.upsert('scope', rec, true); };
    p.bezZmian.forEach(x => upd(x)); p.przeniesione.forEach(x => upd(x)); p.zmienione.forEach(x => { upd(x, 'zmieniony'); r.zmienione++; });
    p.nowe.forEach(n => { M.S.upsert('scope', Object.assign(toRec(n), { taskIds: [], conf: '', note: '', src: '', chg: stare.length ? 'nowy' : '', ack: false }), true); r.nowe++; });
    const znik = new Set(); p.usuniete.forEach(s => { if (s.rec.removed) return; s.rec.removed = true; s.rec.chg = 'usunięty'; s.rec.ack = false; M.S.upsert('scope', s.rec, true); znik.add(s.rec.id); r.usuniete++; });
    if (znik.size) guards().forEach(g => { if ((g.scope || []).some(id => znik.has(id)) && g.status !== 'załatwione') { g.flag = 'Z tabeli zakresowej usunięto wiersz, którego dotyczy ta czynność.'; M.S.upsert('guard', g, true); } });
    M.S.upsert('imports', { kind: 'zakres', file: fileName || '', ts: Date.now(), by: M.S.settings.currentUser, n: out.length, added: stare.length ? r.nowe : 0, changed: r.zmienione, removed: r.usuniete }, true);
    M.S.touch('scope'); return r;
  };

  // =========================================================
  //  AI – krok 3: dopasowanie zakresu do harmonogramu
  // =========================================================
  M.AI.DEFAULTS.straznik_dopasowanie = { name: 'Strażnik Harmonogramu – dopasowanie zakresu', text: `Jesteś doświadczonym kierownikiem kontraktu u generalnego wykonawcy (hale magazynowe i produkcyjne, budynki biurowe, infrastruktura).
Dostajesz HARMONOGRAM budowy i wiersze TABELI ZAKRESOWEJ. Przypisz zakres do pozycji harmonogramu.
{{RULES}}
Zasady dopasowania:
- Pisz REGUŁY DLA GRUP: reguła dla klucza nadrzędnego (np. "KOS:10") obejmuje wszystkie wiersze podrzędne (KOS:10.1, KOS:10.2…). Regułę dla wiersza podrzędnego dodaj TYLKO wtedy, gdy trafia on do innej pozycji niż jego grupa. Reguła z samym kodem arkusza i dwukropkiem (np. "LEC:") obejmuje cały arkusz.
- Jeden wiersz może należeć do kilku pozycji harmonogramu (podaj kilka numerów).
- Przypisuj do pozycji typu „zadanie”. Do pozycji „zbiorcze” tylko wtedy, gdy nie ma pasującego zadania. Zakres, dla którego harmonogram nie podaje dat, przypisz do pozycji „bez terminu”, jeśli taka istnieje.
- Pewność: W (wysoka), S (średnia), N (niska). Przy S i N napisz w „uwaga”, dlaczego.
- Jeśli wiersza nie da się przypisać, zwróć pustą listę "zadania": [] i wyjaśnij w „uwaga”. NIE ZGADUJ.
- Wiersze o statusie „poza zakresem”, „zakres obcy” i „odesłanie” też przypisz, jeśli wiadomo, której pozycji dotyczą – pokazują styki z innymi stronami.
- Zwróć szczególną uwagę na: (a) roboty, które technologicznie muszą wyprzedzić pozycję, do której formalnie należą (np. instalacje podposadzkowe przed posadzką, rozbiórki przed robotami ziemnymi); (b) rozbieżności między tabelą zakresową a harmonogramem – wtedy zacznij uwagę słowem „ROZBIEŻNOŚĆ:”; (c) elementy bez osobnej pozycji w harmonogramie, od których zależą inne roboty.
- Używaj WYŁĄCZNIE numerów pozycji i kluczy z list poniżej.

Budowa: {{PROJEKT}}

HARMONOGRAM (nr | typ | start | koniec | nazwa):
{{HARMONOGRAM}}

TABELA ZAKRESOWA (klucz | status | opis | ilość):
{{ZAKRES}}

Zwróć JEDEN blok \`\`\`json:
{"dopasowanie":[{"prefiks":"KOS:10","zadania":["19"],"pewnosc":"W","uwaga":""}]}` };
  const typZad = (t) => t.tbd ? 'bez terminu' : t.summary ? 'zbiorcze' : t.milestone ? 'kamień' : 'zadanie';
  const liniaHarm = (nry) => tasks().map(t => `${nry[t.id]} | ${typZad(t)} | ${t.tbd ? '—' : t.start} | ${t.tbd ? '—' : t.end} | ${'  '.repeat(Math.max(0, (t.level || 1) - 1))}${t.name}`).join('\n');
  const liniaZak = (r) => `${r.key} | ${r.naglowek ? 'GRUPA' : stZak(r)}${r.sek === 'O' ? ', opcja' : ''} | ${r.text.slice(0, 230)}${r.qty != null && r.unit ? ` | ${String(r.qty).replace('.', ',')} ${r.unit}` : ''}`;
  G.aiDopasowanie = () => {
    const sc = scope(); const ark = [...new Set(sc.map(r => r.sheet))]; const zm = sc.filter(r => r.chg === 'nowy' || r.chg === 'zmieniony' || (!r.naglowek && !(r.taskIds || []).length && !r.src));
    const pre = M.UI.modal({ title: 'Dopasowanie zakresu – co wysłać do AI', body: `
      <label class="f">Zakres promptu<select id="sub">${zm.length && zm.length < sc.length ? `<option value="zm">tylko nowe, zmienione i nieprzypisane (${zm.length} wierszy)</option>` : ''}<option value="">cała tabela (${sc.length} wierszy)</option>${ark.map(a => `<option value="a:${e(a)}">arkusz „${e(a)}” (${sc.filter(r => r.sheet === a).length})</option>`).join('')}</select></label>
      <div class="small muted">Przy dużej tabeli odpowiedź AI może się urwać. Wtedy wyślij arkusze osobno – każdy wynik dopisuje się do poprzednich. Wiersze przypisane ręcznie (✎) nie są nadpisywane.</div>`,
      footer: `<button class="btn primary" id="go">${M.icon.spark}Dalej</button>` });
    pre.querySelector('#go').onclick = () => {
      const sub = pre.querySelector('#sub').value; pre.close();
      let rows = sub === 'zm' ? zm : sub.indexOf('a:') === 0 ? sc.filter(r => r.sheet === sub.slice(2)) : sc;
      if (sub === 'zm') { const ids = new Set(rows.map(r => r.id)); sc.forEach(r => { if (r.naglowek && !ids.has(r.id) && rows.some(x => x.sheet === r.sheet && x.sek === r.sek && x.lp.indexOf(r.lp + '.') === 0)) ids.add(r.id); }); rows = sc.filter(r => ids.has(r.id)); }
      const { poId, poNr } = G.numery(); const klucze = rows.map(r => r.key);
      M.AI.open({ key: 'straznik_dopasowanie', title: 'Strażnik – dopasowanie zakresu do harmonogramu',
        prompt: M.AI.fill('straznik_dopasowanie', { PROJEKT: M.S.project.name, HARMONOGRAM: liniaHarm(poId), ZAKRES: rows.map(liniaZak).join('\n') }),
        parse: (t) => { const j = M.extractJSON(t); if (!j) return null; const w = SH.sprawdzDopasowanie(j, Object.keys(poNr), klucze); if (!w.reguly.length && !w.bledy.length) return null; w.wiersze = rows.map(r => ({ r, reg: SH.dopasuj(r.key, w.reguly) })); return w; },
        preview: (w) => { const traf = w.wiersze.filter(x => x.reg && x.reg.zadania.length), lisc = w.wiersze.filter(x => !x.r.naglowek); const pw = (k) => traf.filter(x => x.reg.pewnosc === k).length;
          return `${w.bledy.length ? `<div class="banner or">${M.icon.alert}<span><b>${w.bledy.length} ${M.plural(w.bledy.length, 'reguła odrzucona', 'reguły odrzucone', 'reguł odrzuconych')}</b>:<br>${w.bledy.slice(0, 8).map(e).join('<br>')}</span></div>` : ''}${w.ostrz.length ? `<div class="small muted">${w.ostrz.slice(0, 5).map(e).join('<br>')}</div>` : ''}
            <p><b>${w.reguly.length}</b> reguł → przypisanych <b>${traf.length}</b> z ${w.wiersze.length} wierszy (pewność wysoka ${pw('W')}, średnia ${pw('S')}, niska ${pw('N')}). Bez pozycji zostaje ${lisc.filter(x => !x.reg || !x.reg.zadania.length).length} wierszy.</p>
            <ul>${w.reguly.filter(r => r.uwaga).slice(0, 14).map(r => `<li><b>${e(r.prefiks)}</b> → ${e(r.zadania.join(', ') || 'brak')} (${PEW[r.pewnosc][0]}): ${e(r.uwaga)}</li>`).join('')}</ul>`; },
        applyLabel: 'Zapisz dopasowanie',
        apply: (w) => { let n = 0; w.wiersze.forEach(({ r, reg }) => { if (r.src === 'ręcznie' || !reg) return; r.taskIds = reg.zadania.map(z => poNr[z].id); r.conf = reg.pewnosc; r.note = reg.uwaga; r.src = 'AI'; r.ack = false; if (r.chg !== 'usunięty') r.chg = ''; M.S.upsert('scope', r, true); n++; }); M.S.touch('scope'); goTab('wyjasnic'); M.toast(`Dopasowanie zapisane dla ${n} wierszy`); } });
    };
  };

  // =========================================================
  //  AI – krok 4: czynności i czasy
  // =========================================================
  M.AI.DEFAULTS.straznik_czynnosci = { name: 'Strażnik Harmonogramu – czynności i czasy', text: `Jesteś doświadczonym kierownikiem kontraktu u generalnego wykonawcy (hale magazynowe i produkcyjne, budynki biurowe, infrastruktura).
Dostajesz pozycje HARMONOGRAMU z przypisanym ZAKRESEM robót. Dla każdej pozycji z listy „DO ROZPISANIA” ułóż czynności, które trzeba wykonać, żeby pozycja była możliwa do zrealizowania w terminie.
Zasady odpowiedzi:
- Pisz po polsku, rzeczowo, językiem technicznym kierownika budowy.
- Czasów trwania i dostaw, których nie ma w danych ani w regułach budowy, NIE pomijaj: oszacuj je z doświadczenia i oznacz źródło jako "szacunek AI". Kierownik je potem potwierdzi lub poprawi.
- Nie wymyślaj zakresu, nazw firm ani dat. Przepisy powołuj tylko te, których jesteś pewien.
Jak układać czynności:
- Ogólne ramy, nie szczegóły: najwyżej {{LIMIT}} czynności na jedną pozycję harmonogramu. Przy pozycji bardzo szerokiej (np. „wszystkie roboty wewnątrz hali”) możesz przekroczyć limit, ale grupuj zakres w pakiety.
- Rodzaje: "etap robót", "wybór wykonawcy", "zamówienie" (materiały i urządzenia z długą dostawą), "projekt" (projekty, zatwierdzenia materiałowe, dokumentacja), "decyzja / dane" (dane lub decyzje Inwestora, Najemcy, projektanta – także dla pozycji „zakres obcy”, od których zależą roboty wykonawcy), "urząd" (zgłoszenia, uzgodnienia, odbiory), "kamień własny".
- NIE PODAWAJ DAT. Podaj czas trwania w tygodniach i punkt odniesienia – daty policzy aplikacja.
- Punkt odniesienia ("kotwica"): "Z<nr>.s" = start pozycji harmonogramu, "Z<nr>.k" = jej koniec, "C<id>.s" / "C<id>.k" = start / koniec innej czynności z Twojej listy.
- Koniec czynności = punkt odniesienia + "przes_tyg" (liczba ujemna = wcześniej). Start czynności = koniec − "trwanie_tyg". Dla terminu jednodniowego wpisz "trwanie_tyg": 0.
- Buduj łańcuchy wstecz od terminu, np.: montaż kończy się z pozycją → dostawa kończy się na starcie montażu → wybór dostawcy kończy się na starcie dostawy.
- Źródło czasu ("zrodlo"): "reguła budowy" – gdy stosujesz regułę z listy poniżej; "przepis" – gdy termin wynika z przepisu (podaj go w uzasadnieniu, z dopiskiem „do weryfikacji”, jeśli nie masz pewności); w pozostałych przypadkach "szacunek AI".
- "uzasadnienie": jedno zdanie – skąd czas i dlaczego ten punkt odniesienia.
- "zakres": klucze wierszy zakresu, których czynność dotyczy. Tylko klucze z listy.
- Zwróć uwagę na kolizje, np. zamówienie wypadające przed końcem projektu albo roboty, które muszą wyprzedzić inną pozycję.

REGUŁY BUDOWY (mają pierwszeństwo przed Twoimi szacunkami):
{{REGULY_BUDOWY}}

Budowa: {{PROJEKT}}

HARMONOGRAM – wszystkie pozycje (nr | typ | start | koniec | nazwa):
{{HARMONOGRAM}}

DO ROZPISANIA – pozycje z przypisanym zakresem (klucz | status | opis | ilość):
{{ZAKRES}}

Zwróć JEDEN blok \`\`\`json:
{"czynnosci":[{"id":"C01","nazwa":"...","rodzaj":"wybór wykonawcy","zadanie":"12","kotwica":"Z12.s","przes_tyg":-3,"trwanie_tyg":4,"zrodlo":"reguła budowy","uzasadnienie":"...","zakres":["SYN:1.6"]}]}` };
  const nietknieta = (g) => g.origin === 'AI' && g.status === 'do zrobienia' && !g.manualEnd && !g.flag && !['ręcznie', 'potwierdzone'].includes(g.src);
  G.aiCzynnosci = () => {
    const ts = tasks().filter(t => !t.tbd); const sc = scope(); const { poId, poNr } = G.numery(); const gs = guards();
    const wiersze = (t) => sc.filter(r => (r.taskIds || []).includes(t.id) && stZak(r) !== 'odesłanie');
    const zZak = ts.filter(t => wiersze(t).length || t.milestone); const bezCz = zZak.filter(t => !gs.some(g => g.taskId === t.id) && !t.milestone);
    const pre = M.UI.modal({ title: 'Czynności i czasy – co wysłać do AI', wide: true, body: `
      <div class="row" style="margin-bottom:8px"><button class="btn sm" id="all">Zaznacz wszystkie</button><button class="btn sm" id="none">Odznacz</button>${bezCz.length && bezCz.length < zZak.length ? `<button class="btn sm soft" id="new">Tylko pozycje bez czynności (${bezCz.length})</button>` : ''}</div>
      <div style="max-height:40vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:8px">${zZak.map(t => `<label class="check" style="display:flex"><input type="checkbox" data-t="${t.id}" ${wiersze(t).length ? 'checked' : ''}><span class="small">${e(poId[t.id])}. ${e(t.name)} <span class="muted">· ${wiersze(t).length} wierszy zakresu · ${gs.filter(g => g.taskId === t.id).length} czynności</span></span></label>`).join('') || '<span class="small muted">Żadna pozycja z terminem nie ma przypisanego zakresu.</span>'}</div>
      <label class="check" style="margin-top:10px"><input type="checkbox" id="repl" checked>Zastąp dotychczasowe czynności z AI dla zaznaczonych pozycji – tylko te nietknięte (bez zmienionego statusu, czasu i daty)</label>
      <div class="small muted">Przy wielu pozycjach odpowiedź AI może się urwać. Wtedy wyślij pozycje w kilku turach – każda dopisuje czynności do poprzednich.</div>`,
      footer: `<button class="btn primary" id="go">${M.icon.spark}Dalej</button>` });
    const boxes = () => [...pre.querySelectorAll('[data-t]')];
    pre.querySelector('#all').onclick = () => boxes().forEach(b => b.checked = true); pre.querySelector('#none').onclick = () => boxes().forEach(b => b.checked = false);
    const nw = pre.querySelector('#new'); if (nw) nw.onclick = () => { const s = new Set(bezCz.map(t => t.id)); boxes().forEach(b => b.checked = s.has(b.dataset.t)); };
    pre.querySelector('#go').onclick = () => {
      const wyb = new Set(boxes().filter(b => b.checked).map(b => b.dataset.t)); const repl = pre.querySelector('#repl').checked; if (!wyb.size) return M.toast('Zaznacz co najmniej jedną pozycję', 'warn'); pre.close();
      const sel = zZak.filter(t => wyb.has(t.id)); const klucze = new Set(); const poKluczu = {};
      const blok = sel.map(t => { const w = wiersze(t); w.forEach(r => { klucze.add(r.key); poKluczu[r.key] = r; }); return `### ${poId[t.id]}. ${t.name} (${typZad(t)}, ${t.start} → ${t.end})\n${w.map(liniaZak).join('\n') || '(brak przypisanych wierszy zakresu)'}`; }).join('\n\n');
      M.AI.open({ key: 'straznik_czynnosci', title: 'Strażnik – czynności i czasy',
        prompt: M.AI.fill('straznik_czynnosci', { PROJEKT: M.S.project.name, LIMIT: G.cfg().limit, REGULY_BUDOWY: G.cfg().rules || 'brak', HARMONOGRAM: liniaHarm(poId), ZAKRES: blok }),
        parse: (t) => { const j = M.extractJSON(t); if (!j) return null; const w = SH.sprawdzCzynnosci(j, Object.keys(poNr), [...klucze]); if (!w.czynnosci.length && !w.bledy.length) return null;
          const daty = SH.przelicz(M.S.all('tasks').map(x => ({ id: poId[x.id], start: x.start, koniec: x.end, bezTerminu: !!x.tbd })), w.czynnosci.map(c => ({ id: c.id, kotwica: c.kotwica, przes_tyg: c.przes_tyg, trwanie_tyg: c.trwanie_tyg }))); w.daty = daty.daty; daty.bledy.forEach(b => w.bledy.push(`${b.id}: ${b.blad}`)); w.czynnosci = w.czynnosci.filter(c => w.daty[c.id]); return w; },
        preview: (w) => `${w.bledy.length ? `<div class="banner or">${M.icon.alert}<span><b>${w.bledy.length} ${M.plural(w.bledy.length, 'czynność odrzucona', 'czynności odrzucone', 'czynności odrzuconych')}</b>:<br>${w.bledy.slice(0, 8).map(e).join('<br>')}</span></div>` : ''}${w.ostrz.length ? `<div class="small muted">${w.ostrz.slice(0, 5).map(e).join('<br>')}</div>` : ''}
          <p><b>${w.czynnosci.length}</b> czynności. Daty wyliczone przez aplikację:</p><table class="list"><thead><tr><th>Nr</th><th>Czynność</th><th>Start</th><th>Koniec</th><th>Źródło</th></tr></thead><tbody>${w.czynnosci.slice().sort((a, b) => w.daty[a.id].start.localeCompare(w.daty[b.id].start)).map(c => `<tr><td class="num">${e(c.id)}</td><td><b>${e(c.nazwa)}</b><div class="xs muted">${e(c.rodzaj)} · ${e(c.uzasadnienie)}</div></td><td class="nowrap">${M.fmt(w.daty[c.id].start)}</td><td class="nowrap">${M.fmt(w.daty[c.id].koniec)}</td><td><span class="badge ${SRC_BADGE[c.zrodlo] || ''}">${e(c.zrodlo)}</span></td></tr>`).join('')}</tbody></table>`,
        applyLabel: 'Zapisz czynności',
        apply: (w) => { const n = G.applyGuards(w.czynnosci, { poNr, poKluczu, zastap: repl ? wyb : null }); st.cz = { status: '', rodzaj: '', zad: '', q: '' }; goTab('czynnosci'); M.toast(`Zapisano ${n.dodane} czynności${n.usuniete ? `, zastąpiono ${n.usuniete} wcześniejszych` : ''}`); } });
    };
  };
  /** zapis czynności z odpowiedzi AI; numery C.. nadawane od nowa, żeby nie kolidowały z istniejącymi */
  G.applyGuards = (lista, { poNr, poKluczu, zastap }) => {
    const r = { dodane: 0, usuniete: 0 };
    if (zastap) { // usuń nietknięte czynności AI dla wybranych pozycji – ale nie te, od których liczą się czynności zostające
      const kand = new Set(guards().filter(g => zastap.has(g.taskId) && nietknieta(g)).map(g => g.id)); let zm = true;
      while (zm) { zm = false; guards().forEach(g => { if (!kand.has(g.id) && g.anchor.t === 'C' && kand.has(g.anchor.ref)) { kand.delete(g.anchor.ref); zm = true; } }); }
      if (kand.size) { M.S.db.guard = M.S.db.guard.filter(g => !kand.has(g.id)); r.usuniete = kand.size; }
    }
    const mapa = {}, zajete = []; lista.forEach(c => { mapa[c.id] = { id: M.uid(), cid: nextCid(zajete) }; zajete.push(mapa[c.id].cid); });
    const poIdC = {}; lista.forEach(c => poIdC[c.id] = c);
    /** pozycja harmonogramu czynności: podana przez AI, a gdy jej brak – ta, do której prowadzi łańcuch punktów odniesienia */
    const pozycja = (c, n = 0) => c.zadanie && poNr[c.zadanie] ? poNr[c.zadanie].id : c.kotwica.t === 'Z' ? poNr[c.kotwica.ref].id : n > 50 || !poIdC[c.kotwica.ref] ? '' : pozycja(poIdC[c.kotwica.ref], n + 1);
    lista.forEach(c => { const m = mapa[c.id]; const k = c.kotwica;
      M.S.upsert('guard', { id: m.id, cid: m.cid, name: c.nazwa, kind: c.rodzaj, taskId: pozycja(c), anchor: k.t === 'Z' ? { t: 'Z', ref: poNr[k.ref].id, e: k.e } : { t: 'C', ref: mapa[k.ref].id, e: k.e }, offW: c.przes_tyg, durW: c.trwanie_tyg, src: c.zrodlo, why: c.uzasadnienie, scope: c.zakres.map(key => poKluczu[key] && poKluczu[key].id).filter(Boolean), status: 'do zrobienia', manualEnd: '', respTxt: '', origin: 'AI', aiAt: Date.now() }, true); r.dodane++; });
    M.S.touch('guard'); return r;
  };

  // =========================================================
  //  Excel i okno po otwarciu aplikacji
  // =========================================================
  G.excel = async () => {
    const wb = new ExcelJS.Workbook(); const c = G.calc(); const al = {}; G.alarms().forEach(a => al[a.g.id] = a.tekst); const nry = G.numery().poId; const klucz = {}; scope(true).forEach(r => klucz[r.id] = r.key);
    const w1 = wb.addWorksheet('Czynności'); w1.columns = [['Nr', 7], ['Czynność', 54], ['Rodzaj', 18], ['Poz. harm.', 10], ['Pozycja harmonogramu', 40], ['Start (najpóźniej)', 14], ['Koniec (najpóźniej)', 14], ['Trwanie [tyg.]', 10], ['Źródło czasu', 14], ['Status', 14], ['Alarm ' + G.dzis(), 28], ['Odpowiedzialny', 20], ['Uzasadnienie', 60], ['Wiersze zakresu', 34], ['Uwagi', 40]].map(([h, w]) => ({ header: h, width: w }));
    c.items.slice().sort((a, b) => (a.start || '9').localeCompare(b.start || '9')).forEach(i => { const g = i.g; w1.addRow([g.cid, g.name, g.kind, g.taskId ? nry[g.taskId] : '', g.taskId ? taskTxt(g.taskId) : '', i.start ? M.toDate(i.start) : '', i.koniec ? M.toDate(i.koniec) : '', g.durW, g.src, g.status, al[g.id] || '', g.respTxt || '', g.why || '', (g.scope || []).map(id => klucz[id]).filter(Boolean).join(', '), [i.blad, uw(i.uwaga), g.flag, i.reczna ? 'data ręczna' : ''].filter(Boolean).join('; ')]); });
    const w2 = wb.addWorksheet('Zakres'); w2.columns = [['Klucz', 14], ['Arkusz', 22], ['Wiersz', 7], ['Lp.', 9], ['Opis', 80], ['Jedn.', 7], ['Ilość', 10], ['Status', 15], ['Poz. harm.', 12], ['Pewność', 10], ['Uwaga', 60], ['Zmiana', 12]].map(([h, w]) => ({ header: h, width: w }));
    scope(true).forEach(r => w2.addRow([r.key, r.sheet, r.row, r.lp, r.text, r.unit, r.qty, stZak(r) + (r.sek === 'O' ? ' (opcja)' : ''), (r.taskIds || []).map(id => nry[id]).filter(Boolean).join(', '), PEW[r.conf || ''][0], r.note || '', r.removed ? 'usunięty' : r.chg || '']));
    const w3 = wb.addWorksheet('Do wyjaśnienia'); w3.columns = [['Rodzaj', 30], ['Czego dotyczy', 70], ['Opis', 100]].map(([h, w]) => ({ header: h, width: w })); G.issues().forEach(i => w3.addRow([i.typ, i.t, i.d]));
    [w1, w2, w3].forEach(w => { w.getRow(1).font = { bold: true }; w.views = [{ state: 'frozen', ySplit: 1 }]; }); w1.getColumn(6).numFmt = 'dd.mm.yyyy'; w1.getColumn(7).numFmt = 'dd.mm.yyyy';
    M.download(new Blob([await wb.xlsx.writeBuffer()]), `Straznik_Harmonogramu_${M.safeName(M.S.project.short || M.S.project.name)}_${M.todayISO()}.xlsx`);
  };
  /** okno z alarmami po otwarciu aplikacji (raz na otwarcie karty i budowę) */
  G.popup = (force) => {
    if (!M.S.project || !M.enabled('straznik') || !M.P.canView('straznik') || (M.LIC && !M.LIC.get())) return;
    const klucz = 'tekbb-straznik-popup-' + M.S.pid; try { if (!force && sessionStorage.getItem(klucz)) return; } catch (err) { /* */ }
    const al = G.alarms(); if (!al.length) return; try { sessionStorage.setItem(klucz, '1'); } catch (err) { /* */ }
    const red = al.filter(a => a.poziom === 'czerwony').length;
    const m = M.UI.modal({ title: `${M.icon.shield.replace('<svg', '<svg style="width:20px;height:20px;vertical-align:-4px;color:var(--or-500)"')} Strażnik Harmonogramu – ${al.length} ${M.plural(al.length, 'alarm', 'alarmy', 'alarmów')}`, wide: true,
      body: `<div class="small muted" style="margin-bottom:8px">${e(M.S.project.name)} · stan na ${M.fmt(G.dzis())}${G.probny() ? ' (dzień próbny)' : ''} · ${red} po terminie lub spóźnionych, ${al.length - red} do rozpoczęcia w ciągu ${G.cfg().window} dni</div><div id="pl" class="table-wrap" style="max-height:58vh;overflow:auto"></div>`,
      footer: `<span class="small muted grow">Zmiana statusu zapisuje się od razu.</span><button class="btn ghost" id="pc">Zamknij</button><button class="btn primary" id="pg">${M.icon.shield}Otwórz Strażnika</button>`,
      onClose: () => { if (!zamykamDoModulu) M.render(); } });
    let zamykamDoModulu = false;
    const draw = () => { const a = G.alarms(); const box = m.querySelector('#pl'); box.innerHTML = a.length ? alarmRows(a.slice(0, 30)) + (a.length > 30 ? `<div class="small muted" style="padding:8px">… i ${a.length - 30} kolejnych w module.</div>` : '') : M.UI.empty('Wszystko załatwione.', 'check'); bindSt(box, draw); box.querySelectorAll('tr[data-g]').forEach(tr => tr.onclick = () => { zamykamDoModulu = true; m.close(); goTab('alarmy'); setTimeout(() => G.editGuard(tr.dataset.g), 80); }); };
    draw(); m.querySelector('#pc').onclick = () => m.close(); m.querySelector('#pg').onclick = () => { zamykamDoModulu = true; m.close(); goTab('alarmy'); };
  };
})(window.M);
