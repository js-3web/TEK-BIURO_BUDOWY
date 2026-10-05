/* =========================================================
   BIURO BUDOWY — role i uprawnienia (jedno miejsce do zmiany)
   ---------------------------------------------------------
   UWAGA: w prototypie HTML to tylko „podgląd ról” – każdy, kto ma plik,
   może przełączyć osobę w pasku górnym. Prawdziwa ochrona (logowanie,
   hasła, serwer) dopiero w wersji zespołowej. To świadome uproszczenie.
   ========================================================= */
(function (M) {
  'use strict';
  const ROLES = {
    KP: { label: 'Kierownik projektu', short: 'KP' },
    KB: { label: 'Kierownik budowy', short: 'KB' },
    IB: { label: 'Inżynier budowy', short: 'IB' },
    PROJ: { label: 'Projektant', short: 'PROJ' },
    PODW: { label: 'Podwykonawca', short: 'PODW' },
  };
  const STAFF = ['KP', 'KB', 'IB'];
  const ALL = ['KP', 'KB', 'IB', 'PROJ', 'PODW'];
  // moduł → kto widzi / kto edytuje
  const MATRIX = {
    home: { view: ALL, edit: STAFF },
    rzuty: { view: ALL, edit: STAFF },
    uwagi: { view: ALL, edit: STAFF },
    narady: { view: ALL, edit: STAFF },
    raporty: { view: STAFF, edit: STAFF },
    zanikowe: { view: [...STAFF, 'PROJ', 'PODW'], edit: STAFF },
    zgloszenia: { view: STAFF, edit: STAFF },
    dziennik: { view: [...STAFF, 'PROJ'], edit: STAFF },
    montaz: { view: ALL, edit: STAFF }, // podwykonawca: tylko firma wskazana jako wykonawca montażu (sprawdza moduł)
    harmonogram: { view: ALL, edit: STAFF },
    straznik: { view: STAFF, edit: ['KP', 'KB'] }, // status czynności zmienia każdy z zespołu GW (sprawdza moduł)
    breeam: { view: [...STAFF, 'PROJ', 'PODW'], edit: STAFF },
    terminy: { view: ['KP', 'KB', 'IB'], edit: ['KP', 'KB'] },
    asystent: { view: [...STAFF, 'PROJ'], edit: [...STAFF, 'PROJ'] },
    ustawienia: { view: STAFF, edit: ['KP', 'KB'] },
  };
  const P = M.P = {
    ROLES, STAFF, ALL, MATRIX,
    role() { const me = M.S.me(); return me ? me.role : 'KB'; },
    myCompany() { const me = M.S.me(); return me ? me.companyId : ''; },
    isStaff() { return STAFF.includes(P.role()); },
    matrix(mod) {
      if (MATRIX[mod]) return MATRIX[mod];
      const cm = (M.S.settings.customModules || []).find(c => c.id === mod);
      if (cm) return { view: cm.view || ALL, edit: cm.edit || STAFF };
      return { view: STAFF, edit: STAFF };
    },
    canView(mod) { return P.matrix(mod).view.includes(P.role()); },
    canEdit(mod) { return P.matrix(mod).edit.includes(P.role()); },
    /** czy dany rekord przypisany do firmy jest widoczny dla zalogowanego */
    seesRecord(rec, field = 'respId') {
      const r = P.role(); if (STAFF.includes(r)) return true;
      const c = P.myCompany(); if (!c) return false;
      return rec[field] === c || (Array.isArray(rec[field]) && rec[field].includes(c));
    },
    /** uwagi: projektant może zmieniać status i dopisywać odpowiedź w SWOICH uwagach */
    canRespondIssue(issue) { const r = P.role(); if (STAFF.includes(r)) return true; return r === 'PROJ' && issue.respId && issue.respId === P.myCompany(); },
    canEditEvidence(ev) { const r = P.role(); if (STAFF.includes(r)) return true; return r === 'PROJ' && ev.respId && ev.respId === P.myCompany(); },
  };
})(window.M);
