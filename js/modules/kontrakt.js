/* =========================================================
   BIURO BUDOWY — Kontrakt: rejestry pism, wniosków materiałowych i zapytań do projektanta
   (Rewizja 15; wzorce: Procore Correspondence / Submittals / RFI – przeniesione na praktykę PL)
   ---------------------------------------------------------
   • Pisma i zawiadomienia – przychodzące i wychodzące, numeracja PP-/PW-, terminy odpowiedzi,
     powiązanie ze zdarzeniem w „Terminach umownych” (data wysłania zawiadomienia / roszczenia
     szczegółowego wpisuje się tam sama). Terminów FIDIC NIE liczy się tutaj – robi to moduł Terminy.
   • Wnioski materiałowe (WM-) – dokumenty wyrobu, termin zatwierdzenia (dni robocze lub
     kalendarzowe wg umowy), „złóż najpóźniej” liczone wstecz od startu pozycji harmonogramu.
   • Zapytania do projektanta (ZP-) – termin odpowiedzi, wpływ na czas/koszt; brak odpowiedzi
     w terminie przy wpływie na czas → jednym przyciskiem zdarzenie w „Terminach umownych”.
   Rejestr to narzędzie pomocnicze kierownika – nie zastępuje kancelarii firmy ani dziennika budowy.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const TAB = {
    pisma: { t: 'letters', label: 'Pisma i zawiadomienia', icon: 'mail', nr: 'PW/PP' },
    wnioski: { t: 'submittals', label: 'Wnioski materiałowe', icon: 'cube', nr: 'WM' },
    zapytania: { t: 'rfis', label: 'Zapytania do projektanta', icon: 'doc', nr: 'ZP' },
  };
  const DEF = { wmDays: 7, wmMode: 'robocze', zpDays: 7, zpMode: 'robocze', replyDays: 7, replyMode: 'kalendarzowe', buffer: 7 };
  const cfg = () => Object.assign({}, DEF, (M.S.project && M.S.project.kontrakt) || {});
  const saveCfg = (c) => { const p = M.S.project; p.kontrakt = c; M.S.upsert('projects', p); };
  const MODES = [['robocze', 'dni roboczych'], ['kalendarzowe', 'dni kalendarzowych']];
  const BRANZE = ['konstrukcja', 'architektura', 'instalacje sanitarne', 'instalacje elektryczne', 'ppoż', 'drogi i sieci zewnętrzne', 'technologia / regały', 'inne'];
  const L_TYPES = ['zawiadomienie o roszczeniu', 'roszczenie szczegółowe', 'polecenie / instrukcja', 'wniosek', 'zapytanie', 'odpowiedź', 'protokół konieczności', 'pismo ogólne'];
  const VIA = ['e-mail', 'osobiście za potwierdzeniem', 'poczta – list polecony', 'kurier', 'platforma / CDE', 'inne'];
  const WM_ST = { szkic: ['Szkic', 'rej'], zlozony: ['Złożony – czeka', 'check'], zatwierdzony: ['Zatwierdzony', 'done'], uwagi: ['Zatw. z uwagami', 'done'], odrzucony: ['Odrzucony', 'open'] };
  const ZP_ST = { szkic: ['Szkic', 'rej'], wyslane: ['Wysłane – czeka', 'check'], odpowiedziane: ['Odpowiedziane', 'done'], zamkniete: ['Zamknięte', 'done'] };
  /** dokumenty wyrobu budowlanego (ustawa o wyrobach budowlanych; rozporządzenie UE 305/2011 – CPR). KOT zastąpiła aprobaty techniczne (od 2017). */
  const DOCS = [['dwu', 'Deklaracja właściwości użytkowych (DWU / DoP)'], ['kdwu', 'Krajowa deklaracja właściwości użytkowych (KDWU)'], ['kot', 'Krajowa / Europejska ocena techniczna (KOT / ETA)'], ['kt', 'Karta techniczna / katalogowa'], ['hig', 'Atest / ocena higieniczna'], ['cert', 'Certyfikat / raport z badań'], ['ppoz', 'Klasyfikacja ogniowa / świadectwo ppoż.'], ['probka', 'Próbka / wzornik']];

  const today = () => M.todayISO();
  const tasks = () => M.S.all('tasks').filter(t => !t.summary).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const taskOpts = (sel) => M.UI.opts(tasks().map(t => [t.id, `${t.code ? t.code + ' · ' : ''}${t.name} (${M.fmt(t.start)})`]), sel, '— bez powiązania —');
  const dueTxt = (d) => { if (!d) return '—'; const n = M.daysLeft(d); return `${M.fmt(d)} <span class="xs muted">${n < 0 ? `po terminie ${-n} dni` : n === 0 ? 'dziś' : `za ${n} dni`}</span>`; };
  const lightOf = (d, done) => done ? 'g' : !d ? 'n' : M.daysLeft(d) < 0 ? 'r' : M.daysLeft(d) <= 3 ? 'r' : M.daysLeft(d) <= 7 ? 'y' : 'g';
  const nextNr = (t, prefix) => { const n = M.S.all(t).filter(r => String(r.nr || '').startsWith(prefix + '-')).map(r => parseInt(String(r.nr).slice(prefix.length + 1), 10)).filter(x => !isNaN(x)); return `${prefix}-${M.pad((n.length ? Math.max(...n) : 0) + 1, 3)}`; };
  const hist = (rec, txt) => (rec.history = rec.history || []).push({ ts: Date.now(), by: M.S.settings.currentUser, txt });
  const partyList = () => { const p = M.S.project || {}; return [...new Set([p.investor, 'Inżynier Kontraktu', 'Inspektor nadzoru inwestorskiego', ...M.S.companies().map(c => c.name)].filter(Boolean))]; };

  // ---------------- logika: pisma ----------------
  const L = {
    waiting: (l) => !!l.needsReply && !l.replyDate,
    st: (l) => L.waiting(l) ? (l.replyDue && l.replyDue < today() ? ['Po terminie odpowiedzi', 'open'] : [l.dir === 'przych' ? 'Wymaga odpowiedzi' : 'Czekamy na odpowiedź', 'check']) : l.needsReply ? ['Odpowiedziano', 'done'] : ['Zarejestrowane', 'rej'],
  };
  // ---------------- logika: wnioski materiałowe ----------------
  const W = {
    due: (w) => w.submitted ? M.CAL.due(w.submitted, w.dueDays === '' || w.dueDays == null ? cfg().wmDays : w.dueDays, w.dueMode || cfg().wmMode) : '',
    needDate: (w) => { if (w.needDate) return w.needDate; const t = w.taskId && M.S.get('tasks', w.taskId); return t && t.start ? t.start : ''; },
    /** najpóźniejsza data złożenia: potrzeba − dostawa − zatwierdzenie − bufor */
    latest: (w) => {
      const need = W.needDate(w); if (!need) return '';
      const c = cfg(); const days = w.dueDays === '' || w.dueDays == null ? c.wmDays : Number(w.dueDays); const mode = w.dueMode || c.wmMode;
      let d = M.addDays(need, -Math.round((Number(w.leadWeeks) || 0) * 7) - (Number(c.buffer) || 0));
      d = mode === 'robocze' ? M.CAL.subWorkdays(d, days) : M.addDays(d, -days);
      return d;
    },
    active: (w) => w.status === 'szkic' || w.status === 'zlozony',
  };
  // ---------------- logika: zapytania ----------------
  const Z = {
    due: (z) => z.sent ? M.CAL.due(z.sent, z.dueDays === '' || z.dueDays == null ? cfg().zpDays : z.dueDays, z.dueMode || cfg().zpMode) : '',
    late: (z) => z.status === 'wyslane' && Z.due(z) && Z.due(z) < today(),
  };

  M.KONTRAKT = { cfg, L, W, Z, nextNr };

  M.modules.kontrakt = {
    title: 'Kontrakt', icon: 'flag', order: 7.5,
    desc: 'Rejestry: pisma i zawiadomienia, wnioski materiałowe, zapytania do projektanta – z terminami i powiązaniami.',
    today() {
      const out = []; const t = today();
      M.S.all('letters').filter(L.waiting).forEach(l => { if (!l.replyDue) return; const n = M.daysLeft(l.replyDue); if (n > 3) return; out.push({ lvl: n <= 0 || l.dir === 'przych' ? 'red' : 'yel', icon: 'mail', kind: n <= 7 ? 'termin' : '', t: `${l.nr}: ${l.dir === 'przych' ? 'odpowiedź do' : 'czekamy na odpowiedź do'} ${M.fmt(l.replyDue)}${n < 0 ? ` (po terminie ${-n} dni)` : ''}`, d: `${l.party || ''} · ${l.subject || ''}`, go: 'kontrakt/pisma/' + l.id, sort: n - 50 }); });
      M.S.all('submittals').forEach(w => {
        if (w.status === 'zlozony') { const d = W.due(w); if (d && M.daysLeft(d) <= 2) out.push({ lvl: M.daysLeft(d) < 0 ? 'red' : 'yel', icon: 'cube', t: `${w.nr}: termin zatwierdzenia ${M.fmt(d)}${M.daysLeft(d) < 0 ? ' minął' : ''}`, d: `${w.subject || ''} · ${w.toWhom || ''}`, go: 'kontrakt/wnioski/' + w.id, sort: M.daysLeft(d) }); }
        if (w.status === 'szkic') { const d = W.latest(w); if (d && M.daysLeft(d) <= 7) out.push({ lvl: M.daysLeft(d) < 0 ? 'red' : 'yel', icon: 'cube', kind: 'termin', t: `${w.nr}: złóż wniosek najpóźniej ${M.fmt(d)}`, d: `${w.subject || ''} · potrzebne na budowie ${M.fmt(W.needDate(w))}`, go: 'kontrakt/wnioski/' + w.id, sort: M.daysLeft(d) }); }
      });
      M.S.all('rfis').filter(z => z.status === 'wyslane').forEach(z => { const d = Z.due(z); if (!d || M.daysLeft(d) > 2) return; const late = d < t; out.push({ lvl: late ? 'red' : 'yel', icon: 'doc', t: `${z.nr}: ${late ? 'brak odpowiedzi projektanta od ' + M.fmt(d) : 'termin odpowiedzi ' + M.fmt(d)}`, d: `${z.subject || (z.question || '').slice(0, 80)}${late && z.impactTime && !z.eventId ? ' · wpływa na termin – rozważ zdarzenie (bieg 28 dni)' : ''}`, go: 'kontrakt/zapytania/' + z.id, sort: M.daysLeft(d) - 20 }); });
      return out;
    },
    deadlines() {
      const out = [];
      M.S.all('letters').filter(L.waiting).forEach(l => { if (l.replyDue) out.push({ uid: `tekbb-let-${l.id}`, date: l.replyDue, title: `${l.nr}: ${l.dir === 'przych' ? 'odpowiedź na pismo' : 'oczekiwana odpowiedź'} – ${l.subject || ''}`, desc: `${l.party || ''} · ${l.type || ''} · ${l.theirRef || ''}` }); });
      M.S.all('submittals').forEach(w => { if (w.status === 'zlozony' && W.due(w)) out.push({ uid: `tekbb-wm-${w.id}-d`, date: W.due(w), title: `${w.nr}: termin zatwierdzenia wniosku – ${w.subject || ''}`, desc: `${w.toWhom || ''} · złożono ${M.fmt(w.submitted)}` }); if (w.status === 'szkic' && W.latest(w)) out.push({ uid: `tekbb-wm-${w.id}-l`, date: W.latest(w), title: `${w.nr}: złożyć wniosek materiałowy najpóźniej – ${w.subject || ''}`, desc: `Potrzebne na budowie ${M.fmt(W.needDate(w))}; czas dostawy ${w.leadWeeks || 0} tyg.` }); });
      M.S.all('rfis').forEach(z => { if (z.status === 'wyslane' && Z.due(z)) out.push({ uid: `tekbb-zp-${z.id}`, date: Z.due(z), title: `${z.nr}: termin odpowiedzi projektanta – ${z.subject || ''}`, desc: (z.question || '').slice(0, 300) }); });
      return out;
    },

    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      const tab = TAB[rest[0]] ? rest[0] : 'pisma'; const edit = M.P.canEdit('kontrakt');
      const lw = M.S.all('letters').filter(L.waiting); const wa = M.S.all('submittals').filter(W.active); const zw = M.S.all('rfis').filter(z => z.status === 'wyslane');
      const late = lw.filter(l => l.replyDue && l.replyDue < today()).length + wa.filter(w => w.status === 'zlozony' && W.due(w) && W.due(w) < today()).length + zw.filter(Z.late).length;
      v.innerHTML = M.UI.head('Kontrakt <span class="acc">– rejestry</span>', 'Pisma, wnioski materiałowe i zapytania w jednym miejscu: numer, termin, powiązania, dowód doręczenia.',
        `<button class="btn" id="ics">${M.icon.cal}Do kalendarza</button><button class="btn" id="cfg">${M.icon.gear}Terminy rejestrów</button><button class="btn" id="xls">${M.icon.xlsx}Excel</button><button class="btn" id="pdf">${M.icon.print}Rejestr PDF</button>${edit ? `<button class="btn primary" id="new">${M.icon.plus}Nowy</button>` : ''}`) +
        M.UI.readonlyBanner('kontrakt') +
        `<div class="kpis"><div class="kpi"><b>${lw.length}</b><span>pism czeka na odpowiedź</span></div><div class="kpi"><b>${wa.length}</b><span>wniosków materiałowych w toku</span></div><div class="kpi"><b>${zw.length}</b><span>zapytań bez odpowiedzi</span></div><div class="kpi"><b class="${late ? 'or' : ''}">${late}</b><span>po terminie</span></div></div>
        <div class="tabs">${Object.entries(TAB).map(([k, x]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${x.label} (${M.S.all(x.t).length})</button>`).join('')}</div>
        <div class="card"><div class="toolbar"><div class="search"><span>${M.icon.search}</span><input type="search" id="q" placeholder="Szukaj: nr, temat, strona…"></div><label class="check"><input type="checkbox" id="act" checked>tylko w toku</label></div><div class="table-wrap" id="tbl"></div></div>`;
      v.querySelectorAll('.tabs button').forEach(b => b.onclick = () => M.go('kontrakt/' + b.dataset.t));
      const draw = () => this['list_' + tab](v.querySelector('#tbl'), M.norm(v.querySelector('#q').value), v.querySelector('#act').checked);
      v.querySelector('#q').oninput = M.debounce(draw, 250); v.querySelector('#act').onchange = draw; draw();
      v.querySelector('#ics').onclick = () => M.ICS.dialog(['kontrakt', 'terminy']);
      v.querySelector('#cfg').onclick = () => this.cfgDialog();
      v.querySelector('#xls').onclick = () => this.excel(tab);
      v.querySelector('#pdf').onclick = () => M.UI.docPreview(TAB[tab].label, this.htmlRegister(tab));
      const nb = v.querySelector('#new'); if (nb) nb.onclick = () => this['form_' + tab]({});
      if (rest[1]) { const r = M.S.get(TAB[tab].t, rest[1]); try { history.replaceState(null, '', '#/kontrakt/' + tab); } catch (err) { /* */ } if (r) setTimeout(() => this['form_' + tab](r), 30); }
    },
    /** po zapisie: odśwież listę (bez ponownego otwierania rekordu z adresu #/kontrakt/<rejestr>/<id>) */
    refreshList() { const p = (location.hash || '').replace(/^#\/?/, '').split('/'); if (p[0] !== 'kontrakt') return; if (p[2]) M.go('kontrakt/' + (TAB[p[1]] ? p[1] : 'pisma')); else M.render(); },

    // ---------------- listy ----------------
    list_pisma(box, q, act) {
      const list = M.S.all('letters').filter(l => (!act || L.waiting(l) || (l.created || 0) > Date.now() - 30 * 864e5) && (!q || M.norm(`${l.nr} ${l.subject} ${l.party} ${l.theirRef} ${l.type}`).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.nr || '').localeCompare(a.nr || ''));
      box.innerHTML = list.length ? `<table class="list"><thead><tr><th></th><th>Nr</th><th>Data</th><th>Temat</th><th class="hide-m">Strona</th><th class="hide-m">Rodzaj</th><th>Odpowiedź do</th><th>Status</th></tr></thead><tbody>${list.map(l => { const s = L.st(l); return `<tr class="click" data-id="${l.id}"><td><span class="light ${L.waiting(l) ? lightOf(l.replyDue) : 'g'}"></span></td><td class="num">${e(l.nr)}<div class="xs muted">${l.dir === 'przych' ? '↘ przychodzące' : '↗ wychodzące'}</div></td><td class="nowrap">${M.fmt(l.date)}</td><td><b>${e(l.subject || '')}</b>${l.theirRef ? `<div class="xs muted">${e(l.theirRef)}</div>` : ''}</td><td class="hide-m small">${e(l.party || '')}</td><td class="hide-m small">${e(l.type || '')}${l.eventId ? ` <span class="badge info">zdarzenie</span>` : ''}</td><td class="nowrap small">${L.waiting(l) ? dueTxt(l.replyDue) : l.replyDate ? '✓ ' + M.fmt(l.replyDate) : '—'}</td><td><span class="st ${s[1]}">${e(s[0])}</span></td></tr>`; }).join('')}</tbody></table>` : M.UI.empty(act ? 'Brak pism w toku i z ostatnich 30 dni. Odznacz „tylko w toku”, aby zobaczyć wszystkie.' : 'Brak pism. Rejestruj każde pismo kontraktowe od razu – z datą doręczenia i sposobem doręczenia.', 'mail');
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => this.form_pisma(M.S.get('letters', tr.dataset.id)));
    },
    list_wnioski(box, q, act) {
      const list = M.S.all('submittals').filter(w => (!act || W.active(w) || w.status === 'odrzucony') && (!q || M.norm(`${w.nr} ${w.subject} ${w.producer} ${w.product} ${w.branza}`).includes(q))).sort((a, b) => (a.nr || '').localeCompare(b.nr || ''));
      box.innerHTML = list.length ? `<table class="list"><thead><tr><th></th><th>Nr</th><th>Wyrób / zakres</th><th class="hide-m">Branża</th><th class="hide-m">Złożono</th><th>Termin</th><th>Status</th></tr></thead><tbody>${list.map(w => { const d = w.status === 'zlozony' ? W.due(w) : w.status === 'szkic' ? W.latest(w) : ''; return `<tr class="click" data-id="${w.id}"><td><span class="light ${W.active(w) ? lightOf(d) : w.status === 'odrzucony' ? 'r' : 'g'}"></span></td><td class="num">${e(w.nr)}${w.rev ? `<div class="xs muted">rew. ${w.rev}</div>` : ''}</td><td><b>${e(w.subject || '')}</b><div class="xs muted">${e([w.producer, w.product].filter(Boolean).join(' · '))}</div></td><td class="hide-m small">${e(w.branza || '')}</td><td class="hide-m nowrap small">${M.fmt(w.submitted) || '—'}</td><td class="nowrap small">${d ? (w.status === 'szkic' ? 'złożyć do ' : 'decyzja do ') + dueTxt(d) : w.decisionDate ? 'decyzja ' + M.fmt(w.decisionDate) : '—'}</td><td>${M.UI.st(WM_ST, w.status)}</td></tr>`; }).join('')}</tbody></table>` : M.UI.empty('Brak wniosków materiałowych w filtrze.', 'cube');
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => this.form_wnioski(M.S.get('submittals', tr.dataset.id)));
    },
    list_zapytania(box, q, act) {
      const list = M.S.all('rfis').filter(z => (!act || z.status === 'szkic' || z.status === 'wyslane') && (!q || M.norm(`${z.nr} ${z.subject} ${z.question} ${z.drawing} ${z.location}`).includes(q))).sort((a, b) => (a.nr || '').localeCompare(b.nr || ''));
      box.innerHTML = list.length ? `<table class="list"><thead><tr><th></th><th>Nr</th><th>Temat</th><th class="hide-m">Rysunek / lokalizacja</th><th class="hide-m">Do</th><th>Odpowiedź do</th><th>Wpływ</th><th>Status</th></tr></thead><tbody>${list.map(z => { const d = Z.due(z); return `<tr class="click" data-id="${z.id}"><td><span class="light ${z.status === 'wyslane' ? lightOf(d) : z.status === 'szkic' ? 'n' : 'g'}"></span></td><td class="num">${e(z.nr)}</td><td><b>${e(z.subject || '')}</b><div class="xs muted clip" style="max-width:320px">${e((z.question || '').slice(0, 120))}</div></td><td class="hide-m small">${e([z.drawing, z.location].filter(Boolean).join(' · '))}</td><td class="hide-m small">${e(M.S.respName(z.toId))}</td><td class="nowrap small">${z.status === 'wyslane' ? dueTxt(d) : z.answerDate ? '✓ ' + M.fmt(z.answerDate) : '—'}</td><td class="small">${[z.impactTime ? 'czas' : '', z.impactCost ? 'koszt' : ''].filter(Boolean).join(', ') || '—'}${z.eventId ? ' <span class="badge info">zdarzenie</span>' : ''}</td><td>${Z.late(z) ? '<span class="st open">Po terminie</span>' : M.UI.st(ZP_ST, z.status)}</td></tr>`; }).join('')}</tbody></table>` : M.UI.empty('Brak zapytań w filtrze.', 'doc');
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => this.form_zapytania(M.S.get('rfis', tr.dataset.id)));
    },

    // ---------------- wspólne elementy formularzy ----------------
    histBlock(rec) { return rec.id ? `<details><summary class="small" style="cursor:pointer;font-weight:700">Historia zmian (${(rec.history || []).length})</summary><ul class="hist" style="margin-top:8px">${(rec.history || []).slice().reverse().map(h => `<li><span class="w">${M.fmtTs(h.ts)} · ${e((M.S.person(h.by) || {}).name || '—')}</span><div>${e(h.txt)}</div></li>`).join('') || '<li><span class="w">brak</span></li>'}</ul></details>` : ''; },
    linkBlock(rec) {
      const L2 = []; const p = (t, id, route, lab) => { const r = id && M.S.get(t, id); if (r) L2.push(`<a href="#/${route}/${r.id}">${e(lab(r))}</a>`); };
      p('events', rec.eventId, 'terminy', r => 'Zdarzenie: ' + r.title); p('letters', rec.letterId, 'kontrakt/pisma', r => 'Pismo ' + r.nr); p('rfis', rec.rfiId, 'kontrakt/zapytania', r => 'Zapytanie ' + r.nr); p('submittals', rec.wmId, 'kontrakt/wnioski', r => 'Wniosek ' + r.nr);
      M.S.all('letters').filter(l => l.id !== rec.id && (l.rfiId === rec.id || l.wmId === rec.id)).forEach(l => L2.push(`<a href="#/kontrakt/pisma/${l.id}">Pismo ${e(l.nr)}</a>`));
      return L2.length ? `<div class="small">${M.icon.link.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} Powiązania: ${L2.join(' · ')}</div>` : '';
    },
    footer(rec, edit, extra = '') { return edit ? `${rec.id ? `<button class="btn danger" id="del">${M.icon.trash}</button>` : ''}${extra}<span class="grow"></span><button class="btn primary" id="ok">${M.icon.check}Zapisz</button>` : '<button class="btn" data-close>Zamknij</button>'; },
    wire(d, rec, t, edit, onSave) {
      const cl = d.querySelector('[data-close]'); if (cl) cl.onclick = () => d.close();
      if (!edit) { M.UI.lockForm(d, true); return; }
      const del = d.querySelector('#del'); if (del) del.onclick = async () => { if (await M.UI.confirm(`Usunąć ${e(rec.nr)} z rejestru? Usunięcie nie cofa wysłanego pisma.`, 'Usuń', true)) { M.S.remove(t, rec.id); d.close(); this.refreshList(); } };
      d.querySelector('#ok').onclick = () => { const r = onSave(); if (r) { d.close(); this.refreshList(); } };
    },

    // ---------------- formularz: pismo ----------------
    form_pisma(l, preset) {
      const isNew = !l.id; const edit = M.P.canEdit('kontrakt'); const c = cfg();
      const rec = M.clone(Object.assign({ dir: 'wych', type: 'pismo ogólne', date: today(), delivered: today(), via: 'e-mail', needsReply: false, photos: [] }, l, preset || {})); rec.photos = rec.photos || [];
      const evs = M.S.all('events');
      const d = M.UI.drawer({ title: isNew ? 'Nowe pismo' : `Pismo ${e(rec.nr)} <span class="st ${L.st(rec)[1]}">${e(L.st(rec)[0])}</span>`, body: `
        <div class="seg" id="dir"><button data-d="wych" class="${rec.dir === 'wych' ? 'on' : ''}">↗ Wychodzące</button><button data-d="przych" class="${rec.dir === 'przych' ? 'on' : ''}">↘ Przychodzące</button></div>
        <div class="grid2"><label class="f">Rodzaj<select data-f="type">${M.UI.opts(L_TYPES, rec.type)}</select></label><label class="f">Subklauzula / paragraf umowy<input type="text" data-f="clause" value="${e(rec.clause || '')}" placeholder="np. 20.2, § 12 ust. 3"></label></div>
        <label class="f req"><span>Temat</span><input type="text" data-f="subject" value="${e(rec.subject || '')}"></label>
        <label class="f"><span id="partyL">${rec.dir === 'przych' ? 'Nadawca' : 'Adresat'}</span><input type="text" data-f="party" list="kParty" value="${e(rec.party || '')}"><datalist id="kParty">${partyList().map(x => `<option value="${e(x)}">`).join('')}</datalist></label>
        <div class="grid3"><label class="f">Data pisma<input type="date" data-f="date" value="${e(rec.date || '')}"></label><label class="f req"><span id="delL">${rec.dir === 'przych' ? 'Data doręczenia' : 'Data wysłania / doręczenia'}</span><input type="date" data-f="delivered" value="${e(rec.delivered || '')}"></label><label class="f">Sposób doręczenia<select data-f="via">${M.UI.opts(VIA, rec.via)}</select></label></div>
        <div class="grid2"><label class="f">Znak / nr pisma ${rec.dir === 'przych' ? 'nadawcy' : '(nasz)'}<input type="text" data-f="theirRef" value="${e(rec.theirRef || '')}"></label><label class="f">Potwierdzenie doręczenia<input type="text" data-f="proof" value="${e(rec.proof || '')}" placeholder="nr nadania, odpowiedź e-mail, podpis"></label></div>
        <label class="f">Streszczenie / treść<textarea data-f="summary" rows="4">${e(rec.summary || '')}</textarea></label>
        <div class="fieldset"><legend>Odpowiedź</legend>
          <label class="check"><input type="checkbox" data-f="needsReply" id="nr" ${rec.needsReply ? 'checked' : ''}><span id="nrL">${rec.dir === 'przych' ? 'Wymaga odpowiedzi od nas' : 'Oczekujemy odpowiedzi'}</span></label>
          <div class="grid3"><label class="f">Odpowiedź do<input type="date" data-f="replyDue" id="rd" value="${e(rec.replyDue || '')}"></label><label class="f">Odpowiedziano dnia<input type="date" data-f="replyDate" value="${e(rec.replyDate || '')}"></label><label class="f">Nr pisma z odpowiedzią<input type="text" data-f="replyRef" value="${e(rec.replyRef || '')}"></label></div>
          ${edit ? `<div class="chips"><button class="chip" id="rdAuto">+${c.replyDays} ${c.replyMode === 'robocze' ? 'dni rob.' : 'dni'} od doręczenia</button></div>` : ''}<div class="xs muted" id="rdNote"></div></div>
        <div class="fieldset"><legend>Powiązania</legend>
          <label class="f">Zdarzenie w „Terminach umownych”<select data-f="eventId">${M.UI.opts(evs.map(x => [x.id, `${x.title} (wiedza od ${M.fmt(x.awareDate)})`]), rec.eventId, '— brak —')}</select></label>
          <div class="grid2"><label class="f">Zapytanie do projektanta<select data-f="rfiId">${M.UI.opts(M.S.all('rfis').map(x => [x.id, `${x.nr} ${x.subject || ''}`]), rec.rfiId, '— brak —')}</select></label><label class="f">Wniosek materiałowy<select data-f="wmId">${M.UI.opts(M.S.all('submittals').map(x => [x.id, `${x.nr} ${x.subject || ''}`]), rec.wmId, '— brak —')}</select></label></div>
          <div class="xs muted">Zawiadomienie o roszczeniu / roszczenie szczegółowe wysłane z powiązanym zdarzeniem: data i numer wpiszą się w „Terminach umownych”, a licznik 28/84 dni pokaże, że termin dotrzymano.</div>
          ${this.linkBlock(rec)}</div>
        <div class="fieldset"><legend>Skan pisma / dowód doręczenia (zdjęcie)</legend><div id="ph"></div></div>
        ${rec.draft ? `<div class="fieldset"><legend>Projekt treści (AI)</legend><div class="airesult" style="max-height:220px;overflow:auto">${M.md(rec.draft)}</div></div>` : ''}
        ${this.histBlock(rec)}`,
        footer: this.footer(rec, edit, edit ? `<button class="btn soft" id="ai">${M.icon.spark}AI: projekt pisma</button>${rec.draft ? `<button class="btn" id="pr">${M.icon.print}Druk projektu</button>` : ''}` : '') });
      M.UI.photos(d.querySelector('#ph'), rec.photos, { editable: edit });
      const body = d.querySelector('.body');
      const note = () => { const v2 = body.querySelector('#rd').value; body.querySelector('#rdNote').textContent = v2 ? (M.CAL.note(v2) ? `Uwaga: ${M.fmt(v2)} to ${M.CAL.note(v2)} – sprawdź w umowie, czy termin przesuwa się na następny dzień roboczy (zasada z art. 115 KC).` : '') : ''; };
      body.querySelector('#rd').addEventListener('input', note); note();
      body.querySelectorAll('#dir button').forEach(b => b.onclick = () => { if (!edit) return; rec.dir = b.dataset.d; body.querySelectorAll('#dir button').forEach(x => x.classList.toggle('on', x === b)); body.querySelector('#partyL').textContent = rec.dir === 'przych' ? 'Nadawca' : 'Adresat'; body.querySelector('#delL').textContent = rec.dir === 'przych' ? 'Data doręczenia' : 'Data wysłania / doręczenia'; body.querySelector('#nrL').textContent = rec.dir === 'przych' ? 'Wymaga odpowiedzi od nas' : 'Oczekujemy odpowiedzi'; });
      const ra = body.querySelector('#rdAuto'); if (ra) ra.onclick = () => { const dl = body.querySelector('[data-f=delivered]').value; if (!dl) return M.toast('Podaj datę doręczenia', 'warn'); body.querySelector('#rd').value = M.CAL.due(dl, c.replyDays, c.replyMode); body.querySelector('#nr').checked = true; note(); };
      const pr = d.querySelector('#pr'); if (pr) pr.onclick = () => M.PR.print('Projekt pisma', `${M.PR.header('Projekt pisma', rec.nr ? ' – ' + rec.nr : '')}${M.md(rec.draft)}<p class="small muted">Projekt do weryfikacji przez kierownika kontraktu / prawnika przed wysłaniem.</p>`);
      const ai = d.querySelector('#ai'); if (ai) ai.onclick = () => {
        const f = { ...rec, ...M.UI.read(body) }; const p = M.S.project; const ev = f.eventId && M.S.get('events', f.eventId);
        M.AI.open({ key: 'kontrakt_pismo', title: 'Asystent AI – projekt pisma',
          prompt: M.AI.fill('kontrakt_pismo', { PROJEKT: `${p.name}; Inwestor: ${p.investor || ''}`, UMOWA: ((M.FIDIC || {})[p.contract] || {}).label || p.contract, KIERUNEK: f.dir === 'przych' ? 'odpowiedź na pismo przychodzące' : 'pismo wychodzące', RODZAJ: f.type, ADRESAT: f.party, TEMAT: f.subject, KLAUZULA: f.clause, ZDARZENIE: ev ? `${ev.title}; data zdarzenia ${M.fmt(ev.eventDate)}; wiedza od ${M.fmt(ev.awareDate)}; ${ev.notes || ''}` : '—', TRESC: f.summary }),
          parse: (t) => t.trim() || null, preview: (t) => M.md(t), applyLabel: 'Zapisz projekt',
          apply: (t) => { Object.assign(rec, M.UI.read(body), { draft: t.trim() }); if (!rec.id) { rec.nr = nextNr('letters', rec.dir === 'przych' ? 'PP' : 'PW'); hist(rec, 'Utworzono'); } M.S.upsert('letters', rec); d.close(); this.form_pisma(M.S.get('letters', rec.id)); } });
      };
      this.wire(d, rec, 'letters', edit, () => {
        const f = M.UI.read(body); const old = isNew ? {} : M.S.get('letters', rec.id) || {};
        const next = { ...rec, ...f }; if (!next.subject.trim()) return M.toast('Podaj temat pisma', 'warn'); if (!next.delivered) return M.toast('Podaj datę doręczenia / wysłania – od niej liczą się terminy', 'warn');
        if (next.needsReply && !next.replyDue) return M.toast('Podaj termin odpowiedzi (albo odznacz „wymaga odpowiedzi”)', 'warn');
        if (isNew) { next.nr = nextNr('letters', next.dir === 'przych' ? 'PP' : 'PW'); next.history = []; hist(next, 'Utworzono'); }
        else { next.history = (old.history || []).slice(); if (old.replyDate !== next.replyDate && next.replyDate) hist(next, 'Odpowiedź z dnia ' + M.fmt(next.replyDate)); if (old.replyDue !== next.replyDue) hist(next, `Termin odpowiedzi: ${M.fmt(old.replyDue) || '—'} → ${M.fmt(next.replyDue) || '—'}`); }
        const saved = M.S.upsert('letters', next);
        // powiązanie ze zdarzeniem – uzupełnia daty wysłania w „Terminach umownych” (nie nadpisuje)
        const ev = saved.eventId && M.S.get('events', saved.eventId);
        if (ev && saved.dir === 'wych') {
          const ref = saved.theirRef || saved.nr; let upd = '';
          if (saved.type === 'zawiadomienie o roszczeniu' && !ev.noticeDate) { ev.noticeDate = saved.delivered; ev.noticeRef = ref; upd = 'zawiadomienie'; }
          if (saved.type === 'roszczenie szczegółowe' && !ev.detailDate) { ev.detailDate = saved.delivered; ev.detailRef = ref; upd = 'roszczenie szczegółowe'; }
          if (upd) { M.S.upsert('events', ev); M.toast(`W „Terminach umownych” odnotowano: ${upd} ${M.fmt(saved.delivered)} (${ref})`); }
        }
        if (saved.rfiId) { const z = M.S.get('rfis', saved.rfiId); if (z && !z.letterId) { z.letterId = saved.id; M.S.upsert('rfis', z); } }
        if (saved.wmId) { const w = M.S.get('submittals', saved.wmId); if (w && !w.letterId) { w.letterId = saved.id; M.S.upsert('submittals', w); } }
        M.toast(isNew ? `Zarejestrowano ${saved.nr}` : 'Zapisano'); return true;
      });
    },

    // ---------------- formularz: wniosek materiałowy ----------------
    form_wnioski(w) {
      const isNew = !w.id; const edit = M.P.canEdit('kontrakt'); const c = cfg();
      const rec = M.clone(Object.assign({ status: 'szkic', rev: 0, docs: {}, dueDays: '', dueMode: '', leadWeeks: '', photos: [], toWhom: 'Inspektor nadzoru' }, w)); rec.docs = rec.docs || {}; rec.photos = rec.photos || [];
      const d = M.UI.drawer({ title: isNew ? 'Nowy wniosek materiałowy' : `Wniosek ${e(rec.nr)}${rec.rev ? ' rew. ' + rec.rev : ''} ${M.UI.st(WM_ST, rec.status)}`, body: `
        <div class="grid2"><label class="f">Branża<select data-f="branza">${M.UI.opts(BRANZE, rec.branza, '—')}</select></label><label class="f">Składany do<select data-f="toWhom">${M.UI.opts(['Inspektor nadzoru', 'Projektant', 'Inwestor / Inżynier Kontraktu'], rec.toWhom)}</select></label></div>
        <label class="f req"><span>Wyrób / zakres zastosowania</span><input type="text" data-f="subject" value="${e(rec.subject || '')}" placeholder="np. płyta warstwowa ścienna PIR 120 mm"></label>
        <div class="grid2"><label class="f">Producent<input type="text" data-f="producer" value="${e(rec.producer || '')}"></label><label class="f">Wyrób (nazwa handlowa)<input type="text" data-f="product" value="${e(rec.product || '')}"></label></div>
        <label class="f">Dostawca / wykonawca<select data-f="companyId">${M.UI.respOpts(rec.companyId, '— firma —')}</select></label>
        <div class="fieldset"><legend>Dokumenty w załączeniu</legend><div class="grid2">${DOCS.map(([k, l]) => `<label class="check"><input type="checkbox" data-doc="${k}" ${rec.docs[k] ? 'checked' : ''}>${e(l)}</label>`).join('')}</div>
          <label class="f">Inne dokumenty<input type="text" data-f="docsOther" value="${e(rec.docsOther || '')}"></label>
          <div class="xs muted">Wyrób wbudowany w obiekt musi być wprowadzony do obrotu zgodnie z przepisami (art. 10 Prawa budowlanego; ustawa o wyrobach budowlanych). Wymagane dokumenty określa też STWiOR i umowa.</div></div>
        <div class="fieldset"><legend>Terminy</legend>
          <div class="grid3"><label class="f">Data złożenia<input type="date" data-f="submitted" value="${e(rec.submitted || '')}"></label><label class="f">Czas na decyzję<input type="number" min="0" data-f="dueDays" value="${e(rec.dueDays ?? '')}" placeholder="${c.wmDays}"></label><label class="f">Liczone w<select data-f="dueMode">${M.UI.opts(MODES, rec.dueMode || c.wmMode)}</select></label></div>
          <div class="grid3"><label class="f">Czas dostawy [tyg.]<input type="number" min="0" step="0.5" data-f="leadWeeks" value="${e(rec.leadWeeks ?? '')}"></label><label class="f">Pozycja harmonogramu<select data-f="taskId">${taskOpts(rec.taskId)}</select></label><label class="f">albo: potrzebne na budowie<input type="date" data-f="needDate" value="${e(rec.needDate || '')}"></label></div>
          <div class="small" id="calc"></div></div>
        <div class="fieldset"><legend>Decyzja</legend>
          <div class="seg" id="st">${Object.entries(WM_ST).map(([k, [lab]]) => `<button data-s="${k}" class="${rec.status === k ? 'on' : ''}">${lab}</button>`).join('')}</div>
          <div class="grid2"><label class="f">Data decyzji<input type="date" data-f="decisionDate" value="${e(rec.decisionDate || '')}"></label><label class="f">Kto zatwierdził<input type="text" data-f="decisionBy" value="${e(rec.decisionBy || '')}"></label></div>
          <label class="f">Uwagi do decyzji<textarea data-f="decisionNote" rows="2">${e(rec.decisionNote || '')}</textarea></label>
          ${(rec.revs || []).length ? `<div class="small"><b>Poprzednie rewizje:</b>${rec.revs.map(r => `<div class="xs muted">rew. ${r.rev}: złożono ${M.fmt(r.submitted)}, ${e((WM_ST[r.status] || [''])[0])} ${M.fmt(r.decisionDate)}${r.decisionNote ? ' – ' + e(r.decisionNote) : ''}</div>`).join('')}</div>` : ''}</div>
        ${rec.aiCheck ? `<div class="fieldset"><legend>Kontrola kompletności (AI)</legend><div class="airesult" style="max-height:200px;overflow:auto">${M.md(rec.aiCheck)}</div></div>` : ''}
        <div class="fieldset"><legend>Skany dokumentów / karta wniosku (zdjęcia)</legend><div id="ph"></div></div>
        ${this.linkBlock(rec)}${this.histBlock(rec)}`,
        footer: this.footer(rec, edit, `${edit ? `<button class="btn soft" id="ai">${M.icon.spark}AI: sprawdź z STWiOR</button>` : ''}${rec.status === 'odrzucony' && edit ? `<button class="btn" id="resub">${M.icon.upload}Złóż ponownie</button>` : ''}${!isNew ? `<button class="btn" id="card">${M.icon.print}Karta</button>` : ''}${!isNew && edit ? `<button class="btn" id="let">${M.icon.mail}Pismo przewodnie</button>` : ''}`) });
      const body = d.querySelector('.body');
      M.UI.photos(d.querySelector('#ph'), rec.photos, { editable: edit });
      const readAll = () => { const f = M.UI.read(body); f.docs = {}; body.querySelectorAll('[data-doc]').forEach(cb => { if (cb.checked) f.docs[cb.dataset.doc] = true; }); return f; };
      const recalc = () => { const x = { ...rec, ...readAll() }; const due = W.due(x), need = W.needDate(x), lat = W.latest(x); body.querySelector('#calc').innerHTML = [due ? `Decyzja najpóźniej: <b>${M.fmt(due)}</b>${M.CAL.note(due) ? ` (${e(M.CAL.note(due))})` : ''}` : '', need ? `Potrzebne na budowie: <b>${M.fmt(need)}</b>` : '', lat ? `<span style="color:${lat < today() && x.status === 'szkic' ? 'var(--danger)' : 'inherit'}">Złożyć najpóźniej: <b>${M.fmt(lat)}</b></span> <span class="xs muted">(dostawa ${x.leadWeeks || 0} tyg. + decyzja ${x.dueDays === '' || x.dueDays == null ? c.wmDays : x.dueDays} ${(x.dueMode || c.wmMode) === 'robocze' ? 'dni rob.' : 'dni'} + bufor ${c.buffer} dni)</span>` : '<span class="xs muted">Podaj czas dostawy i pozycję harmonogramu (albo datę potrzeby), a program policzy „złożyć najpóźniej”.</span>'].filter(Boolean).join('<br>'); };
      body.querySelectorAll('input,select').forEach(el => el.addEventListener('input', recalc)); recalc();
      body.querySelectorAll('#st button').forEach(b => b.onclick = () => { if (!edit) return; rec.status = b.dataset.s; body.querySelectorAll('#st button').forEach(x => x.classList.toggle('on', x === b)); if (['zatwierdzony', 'uwagi', 'odrzucony'].includes(rec.status) && !body.querySelector('[data-f=decisionDate]').value) body.querySelector('[data-f=decisionDate]').value = today(); if (rec.status === 'zlozony' && !body.querySelector('[data-f=submitted]').value) body.querySelector('[data-f=submitted]').value = today(); recalc(); });
      const on = (id, fn) => { const b = d.querySelector(id); if (b) b.onclick = fn; };
      on('#card', () => M.UI.docPreview(`Wniosek materiałowy ${rec.nr}`, this.htmlWM({ ...rec, ...readAll() })));
      on('#let', () => { d.close(); this.form_pisma({}, { dir: 'wych', type: 'wniosek', subject: `Wniosek materiałowy ${rec.nr}${rec.rev ? ' rew. ' + rec.rev : ''}: ${rec.subject || ''}`, party: rec.toWhom, wmId: rec.id, needsReply: true, replyDue: W.due(rec) || '' }); });
      on('#resub', () => { const cur = M.S.get('submittals', rec.id); (cur.revs = cur.revs || []).push({ rev: cur.rev || 0, submitted: cur.submitted, status: cur.status, decisionDate: cur.decisionDate, decisionNote: cur.decisionNote }); cur.rev = (cur.rev || 0) + 1; cur.status = 'zlozony'; cur.submitted = today(); cur.decisionDate = ''; cur.decisionNote = ''; cur.decisionBy = ''; hist(cur, `Złożono ponownie (rew. ${cur.rev})`); M.S.upsert('submittals', cur); d.close(); this.form_wnioski(cur); this.refreshList(); });
      on('#ai', () => {
        const f = { ...rec, ...readAll() };
        M.AI.open({ key: 'kontrakt_wm', title: 'Asystent AI – kompletność wniosku materiałowego', photos: rec.photos, photoPrefix: rec.nr || 'WM',
          prompt: M.AI.fill('kontrakt_wm', { PROJEKT: M.S.project.name, WYROB: `${f.subject}; producent: ${f.producer || '—'}; wyrób: ${f.product || '—'}`, BRANZA: f.branza, DOKUMENTY: DOCS.filter(([k]) => f.docs[k]).map(x => x[1]).concat(f.docsOther ? [f.docsOther] : []).join('; ') || 'brak', ZDJECIA: M.AI.photoList(rec.photos) }),
          attach: 'fragment STWiOR / opisu technicznego (wklej go w prompt w miejscu wskazanym)',
          parse: (t) => t.trim() || null, preview: (t) => M.md(t), applyLabel: 'Zapisz wynik kontroli',
          apply: (t) => { Object.assign(rec, readAll(), { aiCheck: t.trim() }); if (!rec.id) { rec.nr = nextNr('submittals', 'WM'); hist(rec, 'Utworzono'); } M.S.upsert('submittals', rec); d.close(); this.form_wnioski(M.S.get('submittals', rec.id)); } });
      });
      this.wire(d, rec, 'submittals', edit, () => {
        const f = readAll(); const old = isNew ? {} : M.S.get('submittals', rec.id) || {}; const next = { ...rec, ...f };
        if (!next.subject.trim()) return M.toast('Podaj wyrób / zakres', 'warn');
        if (next.status !== 'szkic' && !next.submitted) return M.toast('Podaj datę złożenia wniosku', 'warn');
        if (['zatwierdzony', 'uwagi', 'odrzucony'].includes(next.status) && !next.decisionDate) return M.toast('Podaj datę decyzji', 'warn');
        if (isNew) { next.nr = nextNr('submittals', 'WM'); next.history = []; hist(next, 'Utworzono'); } else { next.history = (old.history || []).slice(); if (old.status !== next.status) hist(next, `Status: ${(WM_ST[old.status] || [''])[0]} → ${WM_ST[next.status][0]}`); }
        const saved = M.S.upsert('submittals', next); M.toast(isNew ? `Zarejestrowano ${saved.nr}` : 'Zapisano'); return true;
      });
    },

    // ---------------- formularz: zapytanie do projektanta ----------------
    form_zapytania(z) {
      const isNew = !z.id; const edit = M.P.canEdit('kontrakt'); const c = cfg();
      const rec = M.clone(Object.assign({ status: 'szkic', dueDays: '', dueMode: '', photos: [], via: 'przez Inspektora nadzoru' }, z)); rec.photos = rec.photos || [];
      const d = M.UI.drawer({ title: isNew ? 'Nowe zapytanie do projektanta' : `Zapytanie ${e(rec.nr)} ${Z.late(rec) ? '<span class="st open">Po terminie</span>' : M.UI.st(ZP_ST, rec.status)}`, body: `
        <div class="grid2"><label class="f">Branża<select data-f="branza">${M.UI.opts(BRANZE, rec.branza, '—')}</select></label><label class="f">Do (projektant)<select data-f="toId">${M.UI.respOpts(rec.toId, '— wybierz —')}</select></label></div>
        <label class="f req"><span>Temat</span><input type="text" data-f="subject" value="${e(rec.subject || '')}"></label>
        <div class="grid2"><label class="f">Rysunek / rewizja<input type="text" data-f="drawing" value="${e(rec.drawing || '')}" placeholder="np. K-201 rew. C"></label><label class="f">Lokalizacja (osie / strefa)<input type="text" data-f="location" value="${e(rec.location || '')}"></label></div>
        <label class="f req"><span>Pytanie / opis kolizji</span><textarea data-f="question" id="qq" rows="4">${e(rec.question || '')}</textarea></label>
        ${edit ? `<div class="row"><button class="btn sm" id="dict">${M.icon.mic}Dyktuj</button><button class="btn sm soft" id="aiQ">${M.icon.spark}AI: zredaguj pytanie</button></div>` : ''}
        <label class="f">Proponowane rozwiązanie wykonawcy<textarea data-f="proposal" rows="2">${e(rec.proposal || '')}</textarea></label>
        <div class="fieldset"><legend>Wpływ</legend>
          <div class="row"><label class="check"><input type="checkbox" data-f="impactTime" ${rec.impactTime ? 'checked' : ''}>wpływa na termin</label><label class="check"><input type="checkbox" data-f="impactCost" ${rec.impactCost ? 'checked' : ''}>wpływa na koszt</label></div>
          <label class="f">Pozycja harmonogramu wstrzymana do odpowiedzi<select data-f="taskId">${taskOpts(rec.taskId)}</select></label></div>
        <div class="fieldset"><legend>Wysłanie i odpowiedź</legend>
          <div class="grid3"><label class="f">Wysłano<input type="date" data-f="sent" value="${e(rec.sent || '')}"></label><label class="f">Czas na odpowiedź<input type="number" min="0" data-f="dueDays" value="${e(rec.dueDays ?? '')}" placeholder="${c.zpDays}"></label><label class="f">Liczone w<select data-f="dueMode">${M.UI.opts(MODES, rec.dueMode || c.zpMode)}</select></label></div>
          <label class="f">Droga<input type="text" data-f="via" value="${e(rec.via || '')}" placeholder="przez Inspektora nadzoru / e-mail do projektanta / wpis do dziennika"></label>
          <div class="small" id="calc"></div>
          <div class="seg" id="st">${Object.entries(ZP_ST).map(([k, [lab]]) => `<button data-s="${k}" class="${rec.status === k ? 'on' : ''}">${lab}</button>`).join('')}</div>
          <div class="grid2"><label class="f">Data odpowiedzi<input type="date" data-f="answerDate" value="${e(rec.answerDate || '')}"></label><label class="f">Odpowiedź – nr pisma / rysunku<input type="text" data-f="answerRef" value="${e(rec.answerRef || '')}"></label></div>
          <label class="f">Treść odpowiedzi<textarea data-f="answer" rows="3">${e(rec.answer || '')}</textarea></label></div>
        <div class="fieldset"><legend>Zdjęcia / szkice</legend><div id="ph"></div></div>
        ${this.linkBlock(rec)}${this.histBlock(rec)}`,
        footer: this.footer(rec, edit, `${!isNew && edit ? `<button class="btn" id="let">${M.icon.mail}Pismo</button>` : ''}${!isNew && edit && M.P.canEdit('terminy') && !rec.eventId ? `<button class="btn" id="ev">${M.icon.clock}Zdarzenie w Terminach</button>` : ''}${!isNew ? `<button class="btn" id="card">${M.icon.print}Karta</button>` : ''}`) });
      const body = d.querySelector('.body');
      M.UI.photos(d.querySelector('#ph'), rec.photos, { editable: edit });
      const recalc = () => { const x = { ...rec, ...M.UI.read(body) }; const due = Z.due(x); body.querySelector('#calc').innerHTML = due ? `Odpowiedź najpóźniej: <b>${M.fmt(due)}</b>${M.CAL.note(due) ? ` (${e(M.CAL.note(due))})` : ''}${x.status === 'wyslane' && due < today() ? ` · <b style="color:var(--danger)">brak odpowiedzi od ${M.daysLeft(due) * -1} dni</b>${x.impactTime ? ' – brak dokumentacji wpływający na termin to typowa podstawa zawiadomienia (FIDIC 1.9 / 8.5 – sprawdź umowę). Bieg 28 dni liczy się od dnia, w którym dowiedziałeś się o opóźnieniu.' : ''}` : ''}` : '<span class="xs muted">Termin odpowiedzi policzy się po wpisaniu daty wysłania.</span>'; };
      body.querySelectorAll('input,select').forEach(el => el.addEventListener('input', recalc)); recalc();
      body.querySelectorAll('#st button').forEach(b => b.onclick = () => { if (!edit) return; rec.status = b.dataset.s; body.querySelectorAll('#st button').forEach(x => x.classList.toggle('on', x === b)); if (rec.status === 'wyslane' && !body.querySelector('[data-f=sent]').value) body.querySelector('[data-f=sent]').value = today(); if (rec.status === 'odpowiedziane' && !body.querySelector('[data-f=answerDate]').value) body.querySelector('[data-f=answerDate]').value = today(); recalc(); });
      const dict = body.querySelector('#dict'); if (dict) M.UI.dictate(dict, body.querySelector('#qq'));
      const on = (id, fn) => { const b = d.querySelector(id); if (b) b.onclick = fn; };
      on('#aiQ', () => { const f = M.UI.read(body); M.AI.open({ key: 'kontrakt_zp', title: 'Asystent AI – zapytanie do projektanta', photos: rec.photos, photoPrefix: rec.nr || 'ZP',
        prompt: M.AI.fill('kontrakt_zp', { PROJEKT: M.S.project.name, BRANZA: f.branza, RYSUNEK: f.drawing, LOKALIZACJA: f.location, PYTANIE: f.question, PROPOZYCJA: f.proposal, ZDJECIA: M.AI.photoList(rec.photos) }),
        parse: (t) => { const s = M.AI.sections(t); return s.PYTANIE ? s : null; }, preview: (s) => `${M.md(s.PYTANIE)}${s.TEMAT ? `<hr><b>Temat:</b> ${e(s.TEMAT)}` : ''}`, applyLabel: 'Wstaw', apply: (s) => { body.querySelector('#qq').value = s.PYTANIE.trim(); if (s.TEMAT && !body.querySelector('[data-f=subject]').value) body.querySelector('[data-f=subject]').value = s.TEMAT.trim(); } }); });
      on('#card', () => M.UI.docPreview(`Zapytanie ${rec.nr}`, this.htmlZP({ ...rec, ...M.UI.read(body) })));
      on('#let', () => { d.close(); this.form_pisma({}, { dir: 'wych', type: 'zapytanie', subject: `Zapytanie do projektanta ${rec.nr}: ${rec.subject || ''}`, party: rec.via && /inspektor/i.test(rec.via) ? 'Inspektor nadzoru inwestorskiego' : M.S.respName(rec.toId), rfiId: rec.id, summary: rec.question, needsReply: true, replyDue: Z.due(rec) || '' }); });
      on('#ev', async () => {
        const cur = { ...M.S.get('rfis', rec.id), ...M.UI.read(body) }; const due = Z.due(cur);
        if (!await M.UI.confirm(`Utworzyć w „Terminach umownych” zdarzenie dla ${e(cur.nr)}?<div class="small muted" style="margin-top:6px">Data powzięcia wiedzy = ${due && due < today() ? 'dzień po terminie odpowiedzi (' + M.fmt(M.addDays(due, 1)) + ')' : 'dziś'} – popraw ją, jeśli wiedziałeś wcześniej. Od niej biegnie 28 dni na zawiadomienie.</div>`, 'Utwórz zdarzenie')) return;
        const aware = due && due < today() ? M.addDays(due, 1) : today();
        const ev = M.S.upsert('events', { title: `Brak dokumentacji / odpowiedzi projektanta – ${cur.nr}: ${cur.subject || ''}`.slice(0, 140), eventDate: due || today(), awareDate: aware, clause: '1.9, 8.5 (sprawdź umowę)', kind: cur.impactCost ? 'czas i koszt' : 'czas', notes: `Zapytanie ${cur.nr} wysłane ${M.fmt(cur.sent)} (${cur.via || ''}); termin odpowiedzi ${M.fmt(due)}.\nPytanie: ${cur.question || ''}${cur.taskId ? `\nWstrzymana pozycja harmonogramu: ${(M.S.get('tasks', cur.taskId) || {}).name || ''}` : ''}`, status: 'otwarte', rfiId: cur.id });
        const r2 = M.S.get('rfis', rec.id); r2.eventId = ev.id; hist(r2, 'Utworzono zdarzenie w Terminach umownych'); M.S.upsert('rfis', r2); d.close(); M.go('terminy/' + ev.id);
      });
      this.wire(d, rec, 'rfis', edit, () => {
        const f = M.UI.read(body); const old = isNew ? {} : M.S.get('rfis', rec.id) || {}; const next = { ...rec, ...f };
        if (!next.subject.trim() || !next.question.trim()) return M.toast('Uzupełnij temat i pytanie', 'warn');
        if (next.status !== 'szkic' && !next.sent) return M.toast('Podaj datę wysłania', 'warn');
        if (['odpowiedziane', 'zamkniete'].includes(next.status) && !next.answerDate && next.status === 'odpowiedziane') return M.toast('Podaj datę odpowiedzi', 'warn');
        if (isNew) { next.nr = nextNr('rfis', 'ZP'); next.history = []; hist(next, 'Utworzono'); } else { next.history = (old.history || []).slice(); if (old.status !== next.status) hist(next, `Status: ${(ZP_ST[old.status] || [''])[0]} → ${ZP_ST[next.status][0]}`); }
        const saved = M.S.upsert('rfis', next); M.toast(isNew ? `Zarejestrowano ${saved.nr}` : 'Zapisano'); return true;
      });
    },

    // ---------------- ustawienia terminów rejestrów (dla budowy) ----------------
    cfgDialog() {
      const c = cfg(); const ed = M.P.canEdit('ustawienia') || M.P.canEdit('kontrakt');
      const row = (k, km, l) => `<div class="grid3" style="align-items:end"><div class="small"><b>${l}</b></div><label class="f">Dni<input type="number" min="0" data-f="${k}" value="${e(c[k])}"></label><label class="f">Liczone w<select data-f="${km}">${M.UI.opts(MODES, c[km])}</select></label></div>`;
      const m = M.UI.modal({ title: 'Terminy rejestrów – ta budowa', body: `<div class="col" id="cf"><div class="small muted">Wartości domyślne dla nowych pozycji. Przepisz je z umowy (np. „Inspektor zatwierdzi wniosek materiałowy w terminie 7 dni roboczych”). W pojedynczym wniosku / zapytaniu możesz je zmienić.</div>
        ${row('wmDays', 'wmMode', 'Decyzja w sprawie wniosku materiałowego')}${row('zpDays', 'zpMode', 'Odpowiedź projektanta na zapytanie')}${row('replyDays', 'replyMode', 'Odpowiedź na pismo (podpowiedź)')}
        <label class="f" style="max-width:260px">Bufor przed dostawą materiału [dni kalendarzowych]<input type="number" min="0" data-f="buffer" value="${e(c.buffer)}"></label>
        <div class="banner info">${M.icon.cal}<span class="small">Dni robocze = poniedziałek–piątek bez świąt ustawowych (w tym Wigilia od 2025 r.). Terminów kontraktowych FIDIC (28/84/14/42 dni) to nie zmienia – są kalendarzowe.</span></div></div>`,
        footer: ed ? `<button class="btn primary" id="ok">Zapisz</button>` : '' });
      if (!ed) return M.UI.lockForm(m, true);
      m.querySelector('#ok').onclick = () => { const f = M.UI.read(m.querySelector('#cf')); Object.keys(DEF).forEach(k => { if (typeof DEF[k] === 'number') f[k] = f[k] === '' ? DEF[k] : Number(f[k]); }); saveCfg(Object.assign(cfg(), f)); m.close(); M.toast('Zapisano terminy rejestrów'); M.render(); };
    },

    // ---------------- wydruki i Excel ----------------
    htmlWM(w) {
      const p = M.S.project; const row = (l, v2) => `<tr><td>${l}</td><td>${v2 || '&nbsp;'}</td></tr>`;
      return `${M.PR.header('Wniosek materiałowy', ` ${w.nr || ''}${w.rev ? ' rew. ' + w.rev : ''}`)}
        <table class="kv">${row('Budowa', e(p.name))}${row('Składany do', e(w.toWhom))}${row('Branża', e(w.branza))}${row('Wyrób / zakres zastosowania', `<b>${e(w.subject)}</b>`)}${row('Producent / wyrób', e([w.producer, w.product].filter(Boolean).join(' · ')))}${row('Dostawca / wykonawca', e(w.companyId ? M.S.respName(w.companyId) : ''))}${row('Data złożenia', M.fmt(w.submitted))}${row('Termin decyzji', M.fmt(W.due(w)))}</table>
        <h2>Załączone dokumenty</h2><table><tbody>${DOCS.map(([k, l]) => `<tr><td style="width:10mm;text-align:center">${w.docs && w.docs[k] ? '☒' : '☐'}</td><td>${e(l)}</td></tr>`).join('')}${w.docsOther ? `<tr><td style="text-align:center">☒</td><td>${e(w.docsOther)}</td></tr>` : ''}</tbody></table>
        <h2>Decyzja</h2><table><tbody><tr><td style="width:10mm;text-align:center">${w.status === 'zatwierdzony' ? '☒' : '☐'}</td><td>zatwierdzam</td></tr><tr><td style="text-align:center">${w.status === 'uwagi' ? '☒' : '☐'}</td><td>zatwierdzam z uwagami</td></tr><tr><td style="text-align:center">${w.status === 'odrzucony' ? '☒' : '☐'}</td><td>odrzucam</td></tr></tbody></table>
        <div class="box" style="min-height:22mm"><span class="small muted">Uwagi:</span> ${e(w.decisionNote || '')}</div>
        ${M.PR.sign(['Wnioskujący (wykonawca)', 'Kierownik budowy', w.toWhom || 'Inspektor nadzoru'])}`;
    },
    htmlZP(z) {
      const p = M.S.project; const row = (l, v2) => `<tr><td>${l}</td><td>${v2 || '&nbsp;'}</td></tr>`;
      return `${M.PR.header('Zapytanie do projektanta', ' ' + (z.nr || ''))}
        <table class="kv">${row('Budowa', e(p.name))}${row('Do', e(M.S.respName(z.toId)))}${row('Droga', e(z.via))}${row('Branża', e(z.branza))}${row('Rysunek / rewizja', e(z.drawing))}${row('Lokalizacja', e(z.location))}${row('Data wysłania', M.fmt(z.sent))}${row('Prosimy o odpowiedź do', `<b>${M.fmt(Z.due(z))}</b>`)}${row('Wpływ', e([z.impactTime ? 'na termin realizacji' : '', z.impactCost ? 'na koszt' : ''].filter(Boolean).join(', ') || 'nie określono'))}</table>
        <h2>${e(z.subject || 'Pytanie')}</h2><div class="pre">${e(z.question || '')}</div>
        ${z.proposal ? `<h3>Proponowane rozwiązanie wykonawcy</h3><div class="pre">${e(z.proposal)}</div>` : ''}
        <h2>Odpowiedź projektanta</h2><div class="box" style="min-height:40mm"><div class="pre">${e(z.answer || '')}</div></div>
        ${M.PR.sign(['Kierownik budowy', 'Inspektor nadzoru', 'Projektant – data i podpis'])}`;
    },
    cols(tab) {
      if (tab === 'pisma') return [['Nr', 10, l => l.nr], ['Kierunek', 12, l => l.dir === 'przych' ? 'przychodzące' : 'wychodzące'], ['Rodzaj', 22, l => l.type], ['Data pisma', 12, l => M.fmt(l.date)], ['Doręczenie', 12, l => M.fmt(l.delivered)], ['Sposób', 16, l => l.via], ['Strona', 26, l => l.party], ['Znak', 16, l => l.theirRef], ['Temat', 44, l => l.subject], ['Klauzula', 10, l => l.clause], ['Odpowiedź do', 13, l => L.waiting(l) ? M.fmt(l.replyDue) : ''], ['Odpowiedziano', 13, l => M.fmt(l.replyDate)], ['Status', 20, l => L.st(l)[0]]];
      if (tab === 'wnioski') return [['Nr', 10, w => w.nr], ['Rew.', 6, w => w.rev || 0], ['Branża', 16, w => w.branza], ['Wyrób / zakres', 40, w => w.subject], ['Producent', 20, w => w.producer], ['Wyrób', 20, w => w.product], ['Do', 18, w => w.toWhom], ['Złożono', 12, w => M.fmt(w.submitted)], ['Termin decyzji', 13, w => M.fmt(W.due(w))], ['Złożyć najpóźniej', 14, w => w.status === 'szkic' ? M.fmt(W.latest(w)) : ''], ['Decyzja', 12, w => M.fmt(w.decisionDate)], ['Status', 18, w => WM_ST[w.status][0]], ['Uwagi', 30, w => w.decisionNote]];
      return [['Nr', 10, z => z.nr], ['Branża', 16, z => z.branza], ['Temat', 34, z => z.subject], ['Rysunek', 14, z => z.drawing], ['Lokalizacja', 16, z => z.location], ['Do', 22, z => M.S.respName(z.toId)], ['Wysłano', 12, z => M.fmt(z.sent)], ['Odpowiedź do', 13, z => M.fmt(Z.due(z))], ['Odpowiedź', 12, z => M.fmt(z.answerDate)], ['Wpływ na czas', 10, z => z.impactTime ? 'tak' : ''], ['Wpływ na koszt', 10, z => z.impactCost ? 'tak' : ''], ['Status', 16, z => Z.late(z) ? 'Po terminie' : ZP_ST[z.status][0]], ['Pytanie', 50, z => z.question]];
    },
    sortedAll(tab) { return M.S.all(TAB[tab].t).slice().sort((a, b) => (a.nr || '').localeCompare(b.nr || '')); },
    async excel(tab) {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(TAB[tab].label.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] }); const C = this.cols(tab);
      ws.columns = C.map(([h, w]) => ({ header: h, width: w })); this.sortedAll(tab).forEach(r => ws.addRow(C.map(c => c[2](r) ?? '')));
      const hr = ws.getRow(1); hr.font = { bold: true, color: { argb: 'FFFFFFFF' } }; hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C5356' } }; ws.autoFilter = { from: 'A1', to: { row: 1, column: C.length } };
      M.download(new Blob([await wb.xlsx.writeBuffer()]), `${M.safeName(TAB[tab].label)}_${M.safeName(M.S.project.short || M.S.project.name)}_${today()}.xlsx`);
    },
    htmlRegister(tab) { const C = this.cols(tab).filter(c => !['Pytanie', 'Uwagi', 'Sposób', 'Znak'].includes(c[0])); return `${M.PR.header(TAB[tab].label, ' – rejestr')}<table><thead><tr>${C.map(c => `<th>${e(c[0])}</th>`).join('')}</tr></thead><tbody>${this.sortedAll(tab).map(r => `<tr>${C.map(c => `<td>${e(c[2](r) ?? '')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${C.length}">Brak pozycji.</td></tr>`}</tbody></table><p class="small muted">Stan na ${M.fmt(today())}. Rejestr pomocniczy kierownika budowy.</p>`; },
  };

  // ---------------- prompty (edytowalne w module Asystent AI) ----------------
  M.AI.DEFAULTS.kontrakt_pismo = { name: 'Kontrakt – projekt pisma', text: `Jesteś kierownikiem kontraktu po stronie Wykonawcy (generalny wykonawca hal przemysłowych/logistycznych).
Przygotuj projekt pisma. Krótko, jednoznacznie, z powołaniem podstawy umownej; bez emocji i ocen.
{{RULES}}
- To projekt do weryfikacji przez kierownika kontraktu / prawnika – nie porada prawna. Warunki szczególne umowy mogą zmieniać terminy i procedury – zaznacz to.
- Nie przyznawaj odpowiedzialności Wykonawcy ani nie zrzekaj się roszczeń.

Budowa / kontrakt: {{PROJEKT}}
Warunki umowy: {{UMOWA}}
Charakter: {{KIERUNEK}}; rodzaj: {{RODZAJ}}
Adresat: {{ADRESAT}}
Temat: {{TEMAT}}
Subklauzula / paragraf: {{KLAUZULA}}
Powiązane zdarzenie: {{ZDARZENIE}}
Fakty / treść pisma, na które odpowiadamy:
"""
{{TRESC}}
"""
Zwróć gotowy projekt pisma (nagłówek, treść, miejsce na podpis), bez komentarzy.` };
  M.AI.DEFAULTS.kontrakt_wm = { name: 'Kontrakt – kompletność wniosku materiałowego', text: `Jesteś inspektorem nadzoru i sprawdzasz wniosek materiałowy wykonawcy, zanim zostanie złożony.
Porównaj wyrób i dołączone dokumenty z wymaganiami STWiOR / opisu technicznego (fragment wklejam poniżej) i wskaż braki.
{{RULES}}
- Wymagania bierz WYŁĄCZNIE z wklejonego fragmentu. Jeśli czegoś w nim nie ma – napisz, że trzeba to sprawdzić w dokumentacji.
- Dokumenty wyrobu: DWU/KDWU, KOT/ETA, oceny higieniczne, klasyfikacje ogniowe – wskaż, które są potrzebne i dlaczego (na podstawie fragmentu).

Budowa: {{PROJEKT}}
Branża: {{BRANZA}}
Wyrób: {{WYROB}}
Dokumenty w załączeniu: {{DOKUMENTY}}
{{ZDJECIA}}
Fragment STWiOR / opisu technicznego (WKLEJ TUTAJ):
"""

"""
Zwróć listę punktowaną: (1) zgodne parametry, (2) braki dokumentów, (3) parametry do potwierdzenia, (4) ryzyko odrzucenia (wysokie/średnie/niskie) z uzasadnieniem.` };
  M.AI.DEFAULTS.kontrakt_zp = { name: 'Kontrakt – zapytanie do projektanta', text: `Jesteś inżynierem budowy. Zredaguj zapytanie do projektanta tak, żeby dało się na nie odpowiedzieć jednoznacznie: co jest niejasne lub kolizyjne, gdzie (rysunek, rewizja, osie), jakie są warianty, czego oczekujemy (decyzja / rysunek / potwierdzenie) i do kiedy.
{{RULES}}
- Jedno zapytanie = jedna sprawa. Jeśli w notatce jest kilka spraw – wskaż to w części TEMAT.
- Nie oceniaj projektanta.

Budowa: {{PROJEKT}}
Branża: {{BRANZA}}
Rysunek / rewizja: {{RYSUNEK}}
Lokalizacja: {{LOKALIZACJA}}
Notatka (pytanie): {{PYTANIE}}
Propozycja wykonawcy: {{PROPOZYCJA}}
{{ZDJECIA}}
Zwróć:
=== TEMAT ===
(krótki temat, do 10 słów)
=== PYTANIE ===
(treść zapytania)` };
})(window.M);
