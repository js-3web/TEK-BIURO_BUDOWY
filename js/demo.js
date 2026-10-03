/* =========================================================
   BIURO BUDOWY — dane przykładowe (FIKCYJNE) + domyślne szablony
   Wszystkie nazwy firm, osób i budowy są zmyślone (oznaczone DEMO).
   ========================================================= */
(function (M) {
  'use strict';
  const DEMO = M.DEMO = {};

  DEMO.REPORT_TEMPLATE = `1. Dane ogólne (data, pogoda, godziny pracy)
2. Obsada budowy (firma – liczba osób)
3. Roboty wykonane w dniu (z lokalizacją: osie / strefy)
4. Dostawy materiałów i sprzętu
5. Odbiory, badania, pomiary
6. BHP i porządek na budowie
7. Problemy, zagrożenia, decyzje potrzebne od inwestora / projektanta
8. Plan na jutro`;
  DEMO.MEETING_AGENDA = `1. BHP – zdarzenia, obserwacje, zalecenia
2. Postęp robót względem harmonogramu
3. Dostawy i logistyka placu
4. Dokumentacja projektowa – pytania i uwagi do projektanta
5. Odbiory częściowe i zanikowe
6. Sprawy otwarte z poprzednich narad
7. Sprawy różne`;

  /** nowa budowa z domyślnymi ustawieniami */
  DEMO.newProject = (o = {}) => ({
    id: M.uid(), name: 'Nowa budowa', short: 'Budowa', address: '', investor: '', lat: '', lon: '',
    contract: 'FIDIC2017', dl: { notice: 28, detailed: 84, engineer: 14, determination: 42 },
    start: M.todayISO(), end: M.addDays(M.todayISO(), 300), edb: '',
    reportTemplate: DEMO.REPORT_TEMPLATE, meetingAgenda: DEMO.MEETING_AGENDA,
    breeam: { on: true, scheme: 'BREEAM International New Construction V6', target: 'Very Good', thr: { Pass: 30, Good: 45, 'Very Good': 55, Excellent: 70, Outstanding: 85 }, weights: {} },
    ...o,
  });

  /** rzut hali rysowany programowo (fikcyjny) → PNG */
  DEMO.drawPlan = (variant = 'parter') => new Promise(res => {
    const W = 2400, H = 1400, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const x0 = 180, y0 = 160, cols = 12, rows = 6, dx = 170, dy = 170, x1 = x0 + cols * dx, y1 = y0 + rows * dy;
    g.strokeStyle = '#9aa1a4'; g.lineWidth = 1.5; g.setLineDash([18, 8, 4, 8]); g.font = 'bold 30px Arial'; g.fillStyle = '#4C5356';
    for (let i = 0; i <= cols; i++) { const x = x0 + i * dx; g.beginPath(); g.moveTo(x, y0 - 70); g.lineTo(x, y1 + 70); g.stroke(); g.beginPath(); g.arc(x, y0 - 100, 28, 0, 7); g.setLineDash([]); g.stroke(); g.fillText(String(i + 1), x - (i >= 9 ? 17 : 9), y0 - 89); g.setLineDash([18, 8, 4, 8]); }
    const L = 'ABCDEFG';
    for (let j = 0; j <= rows; j++) { const y = y0 + j * dy; g.beginPath(); g.moveTo(x0 - 70, y); g.lineTo(x1 + 70, y); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(x0 - 100, y, 28, 0, 7); g.stroke(); g.fillText(L[j], x0 - 110, y + 11); g.setLineDash([18, 8, 4, 8]); }
    g.setLineDash([]);
    g.strokeStyle = '#23272A'; g.lineWidth = 9; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = '#23272A';
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) { if (variant === 'parter' || (i % 2 === 0)) g.fillRect(x0 + i * dx - 11, y0 + j * dy - 11, 22, 22); }
    if (variant === 'parter') {
      // doki przeładunkowe na osi G
      g.fillStyle = '#FDE3D9'; g.strokeStyle = '#AE2F0E'; g.lineWidth = 3;
      for (let i = 1; i < cols - 1; i++) { const x = x0 + i * dx + 45; g.fillRect(x, y1 - 6, 80, 60); g.strokeRect(x, y1 - 6, 80, 60); }
      g.fillStyle = '#AE2F0E'; g.font = '24px Arial'; g.fillText('DOKI PRZEŁADUNKOWE D1–D10', x0 + 3 * dx, y1 + 110);
      // część biurowo-socjalna
      g.fillStyle = '#ECEEEF'; g.fillRect(x1 - 2 * dx, y0, 2 * dx, 2 * dy); g.strokeStyle = '#23272A'; g.lineWidth = 5; g.strokeRect(x1 - 2 * dx, y0, 2 * dx, 2 * dy);
      g.fillStyle = '#23272A'; g.font = 'bold 28px Arial'; g.fillText('BIURA / SOCJAL', x1 - 2 * dx + 60, y0 + dy);
      // strefy pożarowe
      g.strokeStyle = '#C53030'; g.lineWidth = 4; g.setLineDash([30, 14]); g.beginPath(); g.moveTo(x0 + 6 * dx, y0); g.lineTo(x0 + 6 * dx, y1); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#C53030'; g.font = 'bold 26px Arial'; g.fillText('ŚCIANA OGNIOWA REI 120', x0 + 6 * dx + 12, y0 + 3 * dy);
      g.fillStyle = '#7B8386'; g.font = 'bold 44px Arial'; g.fillText('STREFA MAGAZYNOWA 1', x0 + 90, y0 + 3 * dy + 15); g.fillText('STREFA MAGAZYNOWA 2', x0 + 7 * dx, y0 + 4 * dy + 15);
    } else {
      g.fillStyle = '#7B8386'; g.font = 'bold 44px Arial'; g.fillText('DACH – PŁATWIE, ŚWIETLIKI, WYŁAZY', x0 + 3 * dx, y0 + 3 * dy + 15);
      g.strokeStyle = '#2B6CB0'; g.lineWidth = 3; for (let i = 1; i < cols; i += 2) { g.strokeRect(x0 + i * dx + 30, y0 + 2 * dy + 50, 110, 70); }
    }
    g.fillStyle = '#23272A'; g.font = 'bold 34px Arial'; g.fillText(variant === 'parter' ? 'RZUT PARTERU – HALA A (DEMO, dane fikcyjne)' : 'RZUT DACHU – HALA A (DEMO, dane fikcyjne)', x0, H - 60);
    g.font = '24px Arial'; g.fillText('siatka osi 17,0 × 17,0 m · skala umowna', x0, H - 25);
    c.toBlob(b => res({ blob: b, w: W, h: H }), 'image/png');
  });

  DEMO.load = async () => {
    const S = M.S; const t = M.todayISO(); const d = (n) => M.addDays(t, n);
    const p = DEMO.newProject({ name: 'Hala magazynowa A – Park Logistyczny Przykładowo (DEMO)', short: 'Hala A (DEMO)', address: 'ul. Fikcyjna 1, 20-000 Przykładowo', investor: 'Inwestor Logistyka DEMO Sp. z o.o.', lat: 51.25, lon: 22.57, start: d(-120), end: d(160), edb: 'EDB/DEMO/0001' });
    S.db.projects.push(p); S.db.settings.currentProject = p.id;
    const C = (name, type, scope, email) => { const c = { id: M.uid(), name, type, scope, email, contact: '', phone: '', projectIds: [] }; S.db.companies.push(c); return c; };
    const gw = C('Generalny Wykonawca (DEMO)', 'gw', 'GW', 'biuro.budowy@example.com');
    const stal = C('Stal-Montaż DEMO Sp. z o.o.', 'podwykonawca', 'konstrukcja stalowa', 'stal@example.com');
    const pos = C('Posadzki Przemysłowe DEMO', 'podwykonawca', 'posadzka', 'posadzki@example.com');
    const obud = C('Obudowy Hal DEMO', 'podwykonawca', 'płyta warstwowa, dach', 'obudowy@example.com');
    const elek = C('Elektro-Instal DEMO', 'podwykonawca', 'instalacje elektryczne', 'elektro@example.com');
    const san = C('Sanit-Pol DEMO', 'podwykonawca', 'instalacje sanitarne, tryskacze', 'sanit@example.com');
    const ziem = C('Roboty Ziemne DEMO', 'podwykonawca', 'roboty ziemne, drogi', 'ziemne@example.com');
    const proj = C('Pracownia Projektowa DEMO', 'projektant', 'projekt konstrukcji i architektury', 'projektant@example.com');
    C('Inwestor Logistyka DEMO Sp. z o.o.', 'inwestor', 'inwestor', 'inwestor@example.com');
    const P = (name, role, companyId, email) => { const o = { id: M.uid(), name, role, companyId, email, phone: '' }; S.db.people.push(o); return o; };
    P('Anna Przykładowa', 'KP', gw.id, 'kp@example.com');
    const kb = P('Jarosław Sarafin', 'KB', gw.id, 'kb@example.com');
    P('Piotr Inżynierski', 'IB', gw.id, 'ib@example.com');
    P('Tomasz Stalowy', 'PODW', stal.id, 'stal@example.com');
    P('Ewa Projektowa', 'PROJ', proj.id, 'projektant@example.com');
    S.db.settings.currentUser = kb.id;

    const pl1 = await DEMO.drawPlan('parter'); const pl2 = await DEMO.drawPlan('dach');
    const plan1 = { id: M.uid(), projectId: p.id, name: 'Rzut parteru – hala A', level: 'Parter', blobId: await S.putBlob(pl1.blob, { name: 'rzut_parter.png', w: pl1.w, h: pl1.h }), w: pl1.w, h: pl1.h, rev: 'rew. B', created: Date.now() };
    const plan2 = { id: M.uid(), projectId: p.id, name: 'Rzut dachu – hala A', level: 'Dach', blobId: await S.putBlob(pl2.blob, { name: 'rzut_dach.png', w: pl2.w, h: pl2.h }), w: pl2.w, h: pl2.h, rev: 'rew. A', created: Date.now() };
    S.db.plans.push(plan1, plan2);

    const iss = [
      [plan1, .21, .30, 'Jakość', stal.id, 'Brak kompletu podkładek pod nakrętkami śrub kotwiących słupa B-3. Uzupełnić podkładki, dokręcić i zgłosić do odbioru.', d(3), 'otwarta'],
      [plan1, .47, .55, 'BHP', obud.id, 'Otwór technologiczny w posadzce w osi D-6 niezabezpieczony – brak barierki i oznakowania. Zabezpieczyć natychmiast.', d(0), 'otwarta'],
      [plan1, .62, .72, 'Jakość', pos.id, 'Rysy skurczowe na posadzce w polu E/7-8, szerokość do ok. 0,3 mm. Przedstawić sposób naprawy zgodny z projektem posadzki.', d(10), 'weryfikacja'],
      [plan1, .80, .40, 'Projektowa', proj.id, 'Kolizja trasy korytek kablowych z płatwią w osi C/11. Proszę o rozwiązanie zamienne (rysunek).', d(5), 'otwarta'],
      [plan1, .35, .83, 'Porządek', ziem.id, 'Zalegające odpady przy dokach D3–D4 utrudniają dostawy. Uprzątnąć do końca dnia.', d(-2), 'otwarta'],
      [plan1, .55, .20, 'Jakość', san.id, 'Brak tulei ochronnej przejścia instalacji tryskaczowej przez ścianę ogniową REI 120 (oś 7/B).', d(7), 'otwarta'],
      [plan2, .30, .50, 'Jakość', obud.id, 'Nieszczelna obróbka świetlika nr 3 – zacieki po opadzie. Poprawić obróbkę i wykonać próbę wodną.', d(4), 'otwarta'],
      [plan1, .15, .60, 'Jakość', elek.id, 'Brak oznaczeń obwodów w rozdzielnicy RG-1. Opisać zgodnie z projektem.', d(-5), 'zamknieta'],
    ];
    let n = 0;
    for (const [pl, x, y, cat, resp, desc, due, status] of iss) {
      n++; S.db.issues.push({ id: M.uid(), projectId: p.id, planId: pl.id, x, y, nr: 'U-' + M.pad(n, 3), cat, respId: resp, desc, due, status, photos: [], comments: [], history: [{ ts: Date.now() - (10 - n) * 86400000, by: kb.id, txt: 'Utworzono uwagę' }], created: Date.now() - (10 - n) * 86400000, createdBy: kb.id });
    }
    const T = (code, name, s, e2, prog, resp, extra = {}) => S.db.tasks.push({ id: M.uid(), projectId: p.id, code, name, start: d(s), end: d(e2), progress: prog, respId: resp, pred: '', milestone: false, contract: false, lead: 0, leadDone: false, notes: '', ...extra });
    T('1', 'Roboty ziemne i stopy fundamentowe', -120, -80, 100, ziem.id);
    T('2', 'Montaż konstrukcji stalowej', -85, -30, 100, stal.id);
    T('3', 'Obudowa dachu (płyta warstwowa, membrana)', -40, 12, 70, obud.id);
    T('4', 'Obudowa ścian (płyta warstwowa)', -30, 25, 45, obud.id);
    T('5', 'Posadzka przemysłowa – strefa 1', -10, 15, 20, pos.id, { lead: 14, leadDone: true, notes: 'Zbrojenie rozproszone – zamówione' });
    T('6', 'Posadzka przemysłowa – strefa 2', 18, 45, 0, pos.id, { lead: 21, notes: 'Wymaga zamkniętej obudowy i temperatury > 5°C' });
    T('7', 'Instalacja tryskaczowa', -15, 60, 15, san.id, { lead: 42, leadDone: true });
    T('8', 'Bramy i doki przeładunkowe – dostawa', 20, 35, 0, obud.id, { lead: 70, notes: 'Czas dostawy doków – potwierdzić u dostawcy' });
    T('9', 'Rozdzielnica główna RG-1 – dostawa i montaż', 25, 50, 0, elek.id, { lead: 84 });
    T('10', 'Instalacje elektryczne hali', -5, 90, 10, elek.id);
    T('11', 'Część biurowo-socjalna – wykończenie', 40, 120, 0, gw.id);
    T('12', 'Drogi i place manewrowe', 60, 130, 0, ziem.id, { lead: 20 });
    T('M1', 'Zamknięcie bryły budynku (kamień milowy)', 30, 30, 0, gw.id, { milestone: true, contract: true });
    T('M2', 'Zakończenie robót – gotowość do odbioru', 150, 150, 0, gw.id, { milestone: true, contract: true });
    T('13', 'Odbiory, rozruchy, dokumentacja powykonawcza', 120, 155, 0, gw.id, { lead: 30 });

    const mtg = { id: M.uid(), projectId: p.id, nr: 'N-01', date: d(-7), time: '10:00', place: 'Kontener biurowy GW', participants: 'KP, KB, IB (GW); Stal-Montaż DEMO; Obudowy Hal DEMO; Posadzki Przemysłowe DEMO; Inspektor nadzoru (Inwestor)', agenda: DEMO.MEETING_AGENDA, notes: 'Omówiono postęp obudowy dachu i przygotowanie posadzki w strefie 1.', summary: 'Obudowa dachu opóźniona ok. 5 dni z powodu wiatru. Posadzka strefy 1 – start po zamknięciu dachu nad polami 1–4.', items: [], status: 'zatwierdzony' };
    mtg.items = [
      { id: M.uid(), text: 'Przekazać harmonogram montażu płyt ściennych z uwzględnieniem dni wietrznych.', respId: obud.id, due: d(-3), status: 'otwarte' },
      { id: M.uid(), text: 'Potwierdzić termin dostawy doków przeładunkowych na piśmie.', respId: obud.id, due: d(2), status: 'otwarte' },
      { id: M.uid(), text: 'Rozwiązanie kolizji korytek z płatwią w osi C/11.', respId: proj.id, due: d(5), status: 'otwarte' },
      { id: M.uid(), text: 'Uzupełnić podkładki śrub kotwiących.', respId: stal.id, due: d(-4), status: 'zamkniete' },
    ];
    S.db.meetings.push(mtg);

    S.db.events.push({ id: M.uid(), projectId: p.id, title: 'Wstrzymanie robót dachowych – brak dostępu do frontu (opóźnione przekazanie pola 5–8 przez Inwestora)', eventDate: d(-20), awareDate: d(-18), clause: '8.5 / 20.2', kind: 'czas', noticeDate: '', noticeRef: '', detailDate: '', detailRef: '', status: 'otwarte', notes: 'Dokumentacja: zdjęcia, wpisy w EDB, korespondencja mailowa.' });
    S.db.events.push({ id: M.uid(), projectId: p.id, title: 'Polecenie Inżyniera – dodatkowe przejścia ppoż. w ścianie ogniowej', eventDate: d(-40), awareDate: d(-40), clause: '13.3.1', kind: 'czas i koszt', noticeDate: d(-35), noticeRef: 'GW/INW/045', detailDate: '', detailRef: '', status: 'otwarte', notes: 'Zmiana polecona – procedura 13.3.1 (nie 20.2) – sprawdzić warunki szczególne.' });

    const B = (cat, code, name, avail, target, achieved, stage, respId, status) => ({ id: M.uid(), projectId: p.id, cat, code, name, avail, target, achieved, stage, respId, status, notes: '' });
    S.db.breeam.push(
      B('Man', 'Man 01', 'Project brief and design', 4, 3, 2, 'Projekt', proj.id, 'w toku'),
      B('Man', 'Man 03', 'Responsible construction practices', 6, 5, 1, 'Budowa', gw.id, 'w toku'),
      B('Man', 'Man 04', 'Commissioning and handover', 4, 4, 0, 'Budowa', gw.id, 'planowany'),
      B('Ene', 'Ene 01', 'Reduction of energy use and carbon emissions', 9, 5, 5, 'Projekt', proj.id, 'spełniony'),
      B('Ene', 'Ene 02', 'Energy monitoring', 2, 2, 0, 'Budowa', elek.id, 'w toku'),
      B('Wat', 'Wat 01', 'Water consumption', 5, 3, 3, 'Projekt', proj.id, 'spełniony'),
      B('Wat', 'Wat 02', 'Water monitoring', 1, 1, 0, 'Budowa', san.id, 'w toku'),
      B('Mat', 'Mat 03', 'Responsible sourcing of construction products', 4, 2, 0, 'Budowa', gw.id, 'zagrożony'),
      B('Wst', 'Wst 01', 'Construction waste management', 5, 4, 1, 'Budowa', gw.id, 'w toku'),
      B('Pol', 'Pol 03', 'Flood and surface water management', 5, 3, 3, 'Projekt', proj.id, 'spełniony'),
    );
    const man03 = S.db.breeam.find(b => b.code === 'Man 03'), wst = S.db.breeam.find(b => b.code === 'Wst 01'), mat = S.db.breeam.find(b => b.code === 'Mat 03');
    const E = (cr, name, due, respId, status) => S.db.evidence.push({ id: M.uid(), projectId: p.id, creditId: cr.id, name, due, respId, status, files: [], notes: '' });
    E(man03, 'Miesięczne odczyty zużycia energii i wody na zapleczu budowy', d(5), gw.id, 'w przygotowaniu');
    E(man03, 'Deklaracja legalnego pozyskania drewna na budowie (drewno tymczasowe)', d(-3), gw.id, 'brak');
    E(wst, 'Plan gospodarki odpadami budowlanymi (RWMP) – aktualizacja', d(12), gw.id, 'złożony');
    E(wst, 'Karty przekazania odpadów + zestawienie masy wg frakcji', d(8), ziem.id, 'w przygotowaniu');
    E(mat, 'Certyfikaty odpowiedzialnego pozyskania: stal, beton, płyty', d(20), stal.id, 'brak');
    const mo = (k) => { const x = M.toDate(t); x.setMonth(x.getMonth() - k); return `${x.getFullYear()}-${M.pad(x.getMonth() + 1)}`; };
    [[3, 4200, 38, 310, 42, 36], [2, 5100, 45, 420, 55, 49], [1, 6300, 52, 510, 61, 55]].forEach(([k, kwh, water, fuel, waste, div]) => S.db.monitoring.push({ id: M.uid(), projectId: p.id, month: mo(k), kwh, water, fuel, waste, diverted: div, transportKm: '', notes: '' }));

    if (DEMO.montaz) DEMO.montaz(p, stal, kb, d); // dziennik montażu – fikcyjne elementy i wpisy
    if (DEMO.dziennik) DEMO.dziennik(p, kb, d);   // dziennik budowy – fikcyjne wpisy powiązane z montażem
    S.db.settings.demo = true;
    S.touch('replace'); await S.flush();
  };
})(window.M);
