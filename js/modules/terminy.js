/* =========================================================
   BIURO BUDOWY — Strażnik terminów kontraktowych (FIDIC / umowa)
   Z researchu (priorytet A): żadne z badanych narzędzi nie pilnuje terminów zawiadomień.
   FIDIC 2017 (Red Book): zawiadomienie 28 dni od powzięcia wiedzy (20.2.1), roszczenie
   szczegółowe 84 dni (20.2.4), Inżynier 14 dni na zakwestionowanie terminowości (20.2.2),
   porozumienie 42 dni i ew. ustalenie w kolejnych 42 dniach (3.7.3). FIDIC 1999: 28 dni zawiadomienie, 42 dni roszczenie
   szczegółowe, 42 dni odpowiedź Inżyniera (20.1). Warunki szczególne często to zmieniają –
   terminy są edytowalne dla każdej budowy. To narzędzie pomocnicze, nie porada prawna.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const PRESET = { FIDIC2017: { label: 'FIDIC 2017 (Red/Yellow)', notice: 28, detailed: 84, engineer: 14, determination: 42 }, FIDIC1999: { label: 'FIDIC 1999 (Red/Yellow)', notice: 28, detailed: 42, engineer: 0, determination: 42 }, KC: { label: 'Umowa własna / KC', notice: 14, detailed: 30, engineer: 0, determination: 30 } };
  M.FIDIC = PRESET;
  const dl = () => { const p = M.S.project; return { ...(PRESET[p.contract] || PRESET.FIDIC2017), ...(p.dl || {}) }; };
  /** terminy dla zdarzenia */
  const calc = (ev) => {
    const d = dl(); const out = [];
    if (ev.kind === 'zmiana polecona') return [{ k: 'info', label: 'Zmiana polecona (np. 13.3.1) – bez procedury 20.2; pilnuj terminów z trybu zmian', due: '', done: true }];
    const base = ev.awareDate || ev.eventDate;
    out.push({ k: 'notice', label: 'Zawiadomienie o roszczeniu', due: M.addDays(base, d.notice), done: !!ev.noticeDate, doneTxt: ev.noticeDate ? `wysłano ${M.fmt(ev.noticeDate)}${ev.noticeRef ? ' (' + ev.noticeRef + ')' : ''}` : '' });
    out.push({ k: 'detailed', label: 'Roszczenie szczegółowe (fully detailed claim)', due: M.addDays(base, d.detailed), done: !!ev.detailDate, doneTxt: ev.detailDate ? `wysłano ${M.fmt(ev.detailDate)}${ev.detailRef ? ' (' + ev.detailRef + ')' : ''}` : '' });
    if (d.engineer && ev.noticeDate) out.push({ k: 'engineer', label: 'Inżynier może zakwestionować terminowość zawiadomienia do', due: M.addDays(ev.noticeDate, d.engineer), done: M.daysLeft(M.addDays(ev.noticeDate, d.engineer)) < 0, info: true, doneTxt: 'termin minął' });
    const p = M.S.project; const detLabel = p.contract === 'FIDIC2017' ? 'Inżynier: porozumienie do (3.7.3; brak porozumienia → ustalenie w kolejnych 42 dniach – sprawdź umowę)' : p.contract === 'FIDIC1999' ? 'Odpowiedź Inżyniera do (20.1)' : 'Odpowiedź Zamawiającego do (wg umowy)';
    if (d.determination && ev.detailDate) out.push({ k: 'det', label: detLabel, due: M.addDays(ev.detailDate, d.determination), done: !!ev.determinationDate, info: true, doneTxt: ev.determinationDate ? `otrzymano ${M.fmt(ev.determinationDate)}` : '' });
    return out;
  };
  const light = (x) => { if (x.done) return 'g'; if (!x.due) return 'n'; const n = M.daysLeft(x.due); return n < 0 ? 'r' : n <= 7 ? 'r' : n <= 14 ? 'y' : 'g'; };
  const next = (ev) => calc(ev).find(x => !x.done && !x.info && x.due);

  M.modules.terminy = {
    title: 'Strażnik terminów', icon: 'clock', order: 8,
    desc: 'Zdarzenia i roszczenia: liczniki 28/84/14 dni (FIDIC) lub z umowy, projekty zawiadomień PL/EN z AI.',
    today() {
      return M.S.all('events').filter(ev => ev.status !== 'zamknięte').map(ev => ({ ev, n: next(ev) })).filter(x => x.n && M.daysLeft(x.n.due) <= 14).map(({ ev, n }) => { const d = M.daysLeft(n.due); return { lvl: d <= 7 ? 'red' : 'yel', icon: 'clock', kind: d <= 7 ? 'termin' : '', t: `${n.label}: ${d < 0 ? 'PO TERMINIE ' + (-d) + ' dni' : d === 0 ? 'DZIŚ' : 'za ' + d + ' dni'} (${M.fmt(n.due)})`, d: ev.title, go: 'terminy/' + ev.id, sort: d - 100 }; });
    },
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      const p = M.S.project; const d = dl(); const edit = M.P.canEdit('terminy');
      const list = M.S.all('events').sort((a, b) => { const na = next(a), nb = next(b); return (na ? na.due : '9') .localeCompare(nb ? nb.due : '9'); });
      v.innerHTML = M.UI.head('Strażnik <span class="acc">terminów</span>', `${e((PRESET[p.contract] || {}).label || p.contract)} · zawiadomienie ${d.notice} dni · roszczenie szczegółowe ${d.detailed} dni${d.engineer ? ` · Inżynier ${d.engineer} dni` : ''} <a href="#/ustawienia/budowa">zmień</a>`, `<button class="btn" id="xls">${M.icon.xlsx}Rejestr Excel</button>${edit ? `<button class="btn primary" id="new">${M.icon.plus}Zdarzenie</button>` : ''}`) + M.UI.readonlyBanner('terminy') +
        `<div class="banner warn" style="margin-bottom:12px">${M.icon.shield}<span class="small">Bieg terminu liczy się od dnia, w którym Wykonawca <b>dowiedział się lub powinien był się dowiedzieć</b> o zdarzeniu – wpisuj tę datę ostrożnie (najwcześniejszą możliwą). Sprawdź warunki szczególne umowy. Narzędzie pomocnicze, nie porada prawna.</span></div>
        <div class="card">${list.length ? `<table class="list"><thead><tr><th></th><th>Zdarzenie</th><th>Wiedza od</th><th>Najbliższy termin</th><th class="hide-m">Zawiadomienie</th><th class="hide-m">Roszcz. szczeg.</th><th>Status</th></tr></thead><tbody>${list.map(ev => { const c = calc(ev); const n = next(ev); const L = n ? light(n) : 'g'; return `<tr class="click" data-id="${ev.id}"><td><span class="light ${L}"></span></td><td><b>${e(ev.title)}</b><div class="xs muted">${e(ev.clause || '')} · ${e(ev.kind || '')}</div></td><td class="nowrap">${M.fmt(ev.awareDate || ev.eventDate)}</td><td class="nowrap">${n ? `<b style="color:${L === 'r' ? 'var(--danger)' : 'inherit'}">${M.fmt(n.due)}</b><div class="xs muted">${e(n.label)} · ${M.daysLeft(n.due) < 0 ? 'po terminie' : M.daysLeft(n.due) + ' dni'}</div>` : '<span class="muted">—</span>'}</td><td class="hide-m small">${c[0] && c[0].done ? '✓ ' + e(c[0].doneTxt || '') : c[0] && c[0].due ? 'do ' + M.fmt(c[0].due) : ''}</td><td class="hide-m small">${c[1] && c[1].done ? '✓ ' + e(c[1].doneTxt || '') : c[1] && c[1].due ? 'do ' + M.fmt(c[1].due) : ''}</td><td><span class="st ${ev.status === 'zamknięte' ? 'done' : 'open'}">${e(ev.status || 'otwarte')}</span></td></tr>`; }).join('')}</tbody></table>` : M.UI.empty('Brak zdarzeń. Każde zdarzenie mogące dać prawo do przedłużenia czasu lub dodatkowej zapłaty wpisz od razu – licznik zacznie działać.', 'clock')}</div>`;
      v.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => this.edit(M.S.get('events', tr.dataset.id)));
      const nb = v.querySelector('#new'); if (nb) nb.onclick = () => this.edit({ title: '', eventDate: M.todayISO(), awareDate: M.todayISO(), clause: '20.2', kind: 'czas i koszt', status: 'otwarte' });
      v.querySelector('#xls').onclick = () => this.excel();
      if (rest[0]) { const ev = M.S.get('events', rest[0]); if (ev) this.edit(ev); }
    },
    edit(ev) {
      const edit = M.P.canEdit('terminy'); const isNew = !ev.id;
      const d = M.UI.drawer({ title: isNew ? 'Nowe zdarzenie' : e(ev.title), body: `
        <label class="f req"><span>Zdarzenie (krótko)</span><input type="text" data-f="title" value="${e(ev.title)}"></label>
        <div class="grid2"><label class="f">Data zdarzenia<input type="date" data-f="eventDate" value="${e(ev.eventDate || '')}"></label><label class="f req"><span>Wykonawca dowiedział się / powinien był</span><input type="date" data-f="awareDate" value="${e(ev.awareDate || '')}"></label></div>
        <div class="grid2"><label class="f">Subklauzula(e)<input type="text" data-f="clause" value="${e(ev.clause || '')}" placeholder="np. 8.5, 4.12, 20.2"></label><label class="f">Rodzaj<select data-f="kind">${M.UI.opts(['czas', 'koszt', 'czas i koszt', 'zmiana polecona'], ev.kind)}</select></label></div>
        <label class="f">Opis i fakty (bieżąca dokumentacja: zdjęcia, EDB, pisma)<textarea data-f="notes" rows="4">${e(ev.notes || '')}</textarea></label>
        <div class="fieldset"><legend>Wysłane dokumenty</legend>
          <div class="grid2"><label class="f">Zawiadomienie – data<input type="date" data-f="noticeDate" value="${e(ev.noticeDate || '')}"></label><label class="f">Nr pisma<input type="text" data-f="noticeRef" value="${e(ev.noticeRef || '')}"></label></div>
          <div class="grid2"><label class="f">Roszczenie szczegółowe – data<input type="date" data-f="detailDate" value="${e(ev.detailDate || '')}"></label><label class="f">Nr pisma<input type="text" data-f="detailRef" value="${e(ev.detailRef || '')}"></label></div>
          <div class="grid2"><label class="f">Ustalenie / odpowiedź Inżyniera<input type="date" data-f="determinationDate" value="${e(ev.determinationDate || '')}"></label><label class="f">Status<select data-f="status">${M.UI.opts(['otwarte', 'zamknięte'], ev.status)}</select></label></div></div>
        ${!isNew ? `<div class="fieldset"><legend>Terminy</legend>${calc(ev).map(x => `<div class="row small" style="margin:3px 0"><span class="light ${light(x)}"></span><span class="grow">${e(x.label)}</span><b>${M.fmt(x.due)}</b><span class="muted">${x.done ? e(x.doneTxt || '✓') : x.due ? (M.daysLeft(x.due) < 0 ? 'po terminie' : M.daysLeft(x.due) + ' dni') : ''}</span></div>`).join('')}</div>` : ''}
        ${ev.draftPL ? `<div class="fieldset"><legend>Projekt zawiadomienia</legend><div class="airesult" style="max-height:200px;overflow:auto">${M.md(ev.draftPL)}</div></div>` : ''}`,
        footer: edit ? `${!isNew ? `<button class="btn danger" id="del">${M.icon.trash}</button><button class="btn soft" id="ai">${M.icon.spark}AI: zawiadomienie PL/EN</button>${ev.draftPL ? `<button class="btn" id="pr">${M.icon.print}Druk</button>` : ''}` : ''}<span class="grow"></span><button class="btn primary" id="ok">Zapisz</button>` : '' });
      if (!edit) return M.UI.lockForm(d, true);
      d.querySelector('#ok').onclick = () => { const f = M.UI.read(d); if (!f.title.trim() || !f.awareDate) return M.toast('Uzupełnij zdarzenie i datę powzięcia wiedzy', 'warn'); if (f.awareDate < f.eventDate) return M.toast('Data wiedzy wcześniejsza niż zdarzenie?', 'warn'); M.S.upsert('events', { ...ev, ...f }); d.close(); M.go('terminy'); M.render(); };
      const del = d.querySelector('#del'); if (del) del.onclick = async () => { if (await M.UI.confirm('Usunąć zdarzenie?', 'Usuń', true)) { M.S.remove('events', ev.id); d.close(); M.render(); } };
      const pr = d.querySelector('#pr'); if (pr) pr.onclick = () => M.PR.print('Projekt zawiadomienia', `${M.PR.header('Projekt zawiadomienia o roszczeniu', '')}${M.md(ev.draftPL)}<h2>English</h2>${M.md(ev.draftEN || '')}<p class="small muted">Projekt do weryfikacji przez kierownika kontraktu / prawnika.</p>`);
      const ai = d.querySelector('#ai'); if (ai) ai.onclick = () => {
        const f = { ...ev, ...M.UI.read(d) }; const p = M.S.project;
        M.AI.open({ key: 'fidic', title: 'Asystent AI – zawiadomienie o roszczeniu',
          prompt: M.AI.fill('fidic', { PROJEKT: `${p.name}; Inwestor: ${p.investor || ''}`, UMOWA: (PRESET[p.contract] || {}).label || p.contract, TYTUL: f.title, DATA_ZD: M.fmt(f.eventDate), DATA_WIEDZY: M.fmt(f.awareDate), KLAUZULA: f.clause, RODZAJ: f.kind, OPIS: f.notes }),
          parse: (t) => { const s = M.AI.sections(t); return s.PL ? s : null; }, preview: (s) => `${M.md(s.PL)}<hr>${M.md(s.EN || '')}`, applyLabel: 'Zapisz projekt',
          apply: (s) => { Object.assign(ev, f, { draftPL: s.PL, draftEN: s.EN || '' }); M.S.upsert('events', ev); d.close(); this.edit(ev); } });
      };
    },
    async excel() {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Rejestr zdarzeń');
      ws.columns = [['Zdarzenie', 50], ['Subklauzula', 12], ['Rodzaj', 14], ['Data zdarzenia', 14], ['Wiedza od', 14], ['Termin zawiadomienia', 16], ['Zawiadomienie wysłane', 16], ['Nr pisma', 14], ['Termin roszcz. szczeg.', 16], ['Roszcz. szczeg. wysłane', 16], ['Nr pisma', 14], ['Status', 12]].map(([h, w]) => ({ header: h, width: w }));
      M.S.all('events').forEach(ev => { const c = calc(ev); const g = (k) => (c.find(x => x.k === k) || {}).due; ws.addRow([ev.title, ev.clause, ev.kind, M.toDate(ev.eventDate), M.toDate(ev.awareDate), g('notice') ? M.toDate(g('notice')) : '', ev.noticeDate ? M.toDate(ev.noticeDate) : '', ev.noticeRef, g('detailed') ? M.toDate(g('detailed')) : '', ev.detailDate ? M.toDate(ev.detailDate) : '', ev.detailRef, ev.status]); });
      ws.getRow(1).font = { bold: true }; [4, 5, 6, 7, 9, 10].forEach(i => ws.getColumn(i).numFmt = 'dd.mm.yyyy');
      M.download(new Blob([await wb.xlsx.writeBuffer()]), `Rejestr_zdarzen_${M.safeName(M.S.project.short)}_${M.todayISO()}.xlsx`);
    },
  };
})(window.M);
