/* =========================================================
   BIURO BUDOWY — Harmonogram: wykres Gantta, reguły ostrzegawcze, ryzyka z AI
   Reguły działają bez AI (od razu, offline). AI dostaje harmonogram + wyniki reguł
   i szuka ryzyk oraz prac, które trzeba uruchomić z wyprzedzeniem.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const st = { tab: 'gantt' };
  const WINTER = /beton|posadzk|tynk|elewac|dach|papa|membran|malow|asfalt|nawierzchn|izolac|wylewk/i;
  const RISK_ST = [['otwarte', 'Otwarte'], ['w realizacji', 'W realizacji'], ['zamknięte', 'Zamknięte']];

  const H = M.HARM = {};
  /** automatyczne reguły → lista ustaleń */
  H.rules = () => {
    const t = M.todayISO(); const tasks = M.S.all('tasks'); const out = [];
    const byCode = {}; tasks.forEach(x => { if (x.code) byCode[String(x.code).trim()] = x; });
    tasks.forEach(x => {
      const prog = Number(x.progress) || 0; if (!x.start || !x.end || x.summary) return;
      if (prog < 100 && x.end < t) out.push({ lvl: 'red', type: 'opóźnienie', task: x, txt: `Opóźnione o ${M.diffDays(x.end, t)} dni (postęp ${prog}%)`, date: x.end });
      else if (prog === 0 && x.start < t && !x.milestone) out.push({ lvl: M.diffDays(x.start, t) > 7 ? 'red' : 'yel', type: 'brak startu', task: x, txt: `Nie rozpoczęto – plan od ${M.fmt(x.start)}`, date: x.start });
      else if (x.start <= t && t <= x.end && !x.milestone) { const dur = Math.max(1, M.diffDays(x.start, x.end)); const exp = Math.round(Math.min(100, M.diffDays(x.start, t) / dur * 100)); if (exp - prog >= 20) out.push({ lvl: 'yel', type: 'postęp', task: x, txt: `Postęp ${prog}% przy planowanym ok. ${exp}%`, date: x.end }); }
      if (Number(x.lead) > 0 && !x.leadDone && prog === 0) { const by = M.addDays(x.start, -Number(x.lead)); const dl = M.diffDays(t, by); if (dl <= 14) out.push({ lvl: dl < 0 ? 'red' : 'yel', type: 'wyprzedzenie', task: x, txt: `${dl < 0 ? 'SPÓŹNIONE: ' : ''}zamów / przygotuj najpóźniej ${M.fmt(by)} (wyprzedzenie ${x.lead} dni przed startem ${M.fmt(x.start)})`, date: by }); }
      if (x.milestone && prog < 100) { const dl = M.diffDays(t, x.end); if (dl < 0) out.push({ lvl: 'red', type: 'kamień milowy', task: x, txt: `Kamień milowy${x.contract ? ' UMOWNY' : ''} przekroczony o ${-dl} dni`, date: x.end }); else if (dl <= 30) out.push({ lvl: x.contract ? 'yel' : '', type: 'kamień milowy', task: x, txt: `Kamień milowy${x.contract ? ' umowny' : ''} za ${dl} dni (${M.fmt(x.end)})`, date: x.end }); }
      if (x.pred && prog < 100) String(x.pred).split(/[;, ]+/).filter(Boolean).forEach(code => {
        const mm = code.match(/^(.*?)(ZR|ZZ|RR|RZ|FS|SS|FF|SF)?([+-]\d+(?:[.,]\d+)?)?d?$/i) || [code, code]; const p = byCode[mm[1]] || byCode[code]; if (!p || (Number(p.progress) || 0) >= 100 || M.diffDays(t, x.start) > 21) return;
        const typ = (mm[2] || 'ZR').toUpperCase(); const lag = Math.round(Number(String(mm[3] || '0').replace(',', '.')));
        if ((typ === 'ZR' || typ === 'FS') && M.addDays(p.end, lag) > x.start) out.push({ lvl: 'yel', type: 'powiązanie', task: x, txt: `Poprzednik „${p.name}” kończy się ${M.fmt(p.end)}, po planowanym starcie`, date: x.start });
        if ((typ === 'RR' || typ === 'SS') && M.addDays(p.start, lag) > x.start) out.push({ lvl: 'yel', type: 'powiązanie', task: x, txt: `Poprzednik „${p.name}” (RR${lag ? '+' + lag + 'd' : ''}) startuje za późno względem tego zadania`, date: x.start });
      });
      if (WINTER.test(x.name) && prog < 100) { const s = M.toDate(x.start), en = M.toDate(x.end); for (let y = s.getFullYear() - 1; y <= en.getFullYear(); y++) { const ws = new Date(y, 10, 15), we = new Date(y + 1, 2, 15); if (s <= we && en >= ws) { out.push({ lvl: '', type: 'zima', task: x, txt: 'Roboty wrażliwe na warunki zimowe (15.11–15.03) – zaplanuj technologię zimową / ogrzewanie', date: x.start }); break; } } }
    });
    return out.sort((a, b) => (a.lvl === 'red' ? 0 : a.lvl === 'yel' ? 1 : 2) - (b.lvl === 'red' ? 0 : b.lvl === 'yel' ? 1 : 2) || (a.date || '').localeCompare(b.date || ''));
  };

  // aliasy nagłówków z Excela / MS Project (PL i EN)
  const COLS = { code: ['kod', 'id', 'nr', 'lp', 'identyfikator'], level: ['poziom konspektu', 'outline level', 'poziom'], name: ['nazwa', 'zadanie', 'nazwa zadania', 'task name', 'name', 'opis'], start: ['start', 'poczatek', 'rozpoczecie', 'data rozpoczecia', 'od', 'termin rozpoczecia'], end: ['koniec', 'zakonczenie', 'finish', 'data zakonczenia', 'do', 'termin zakonczenia'], progress: ['postep', 'postep %', '% ukonczenia', 'ukonczenie', '% complete', 'procent ukonczenia', 'procent wykonania', '% wykonania', 'zaawansowanie'], resp: ['odpowiedzialny', 'wykonawca', 'firma', 'zasoby', 'resource names', 'nazwy zasobow', 'nazwa zasobu'], pred: ['poprzedniki', 'predecessors', 'powiazania'], milestone: ['kamien milowy', 'milestone', 'km'], contract: ['umowny', 'termin umowny'], lead: ['wyprzedzenie', 'wyprzedzenie dni', 'czas dostawy', 'czas dostawy dni', 'lead'], notes: ['uwagi', 'notes', 'komentarz'] };


  // ---------------- import: MS Project XML (Plik → Zapisz jako → XML) ----------------
  const LINK = { 0: 'ZZ', 1: 'ZR', 2: 'RZ', 3: 'RR' }; // 0 FF, 1 FS, 2 SF, 3 SS (schemat MSPDI)
  H.parseMsProjectXml = (text) => {
    const d = new DOMParser().parseFromString(text, 'application/xml');
    if (d.getElementsByTagName('parsererror').length) throw new Error('Plik XML jest uszkodzony');
    const root = d.documentElement; if (root.localName !== 'Project') throw new Error('To nie jest plik XML z MS Project (brak elementu <Project>)');
    const ch = (el, n) => { const x = Array.from(el.children).find(c => c.localName === n); return x ? x.textContent.trim() : ''; };
    const all = (el, n) => Array.from(el.getElementsByTagNameNS('*', n));
    const sect = (n) => all(root, n)[0];
    const res = {}; if (sect('Resources')) Array.from(sect('Resources').children).forEach(r => res[ch(r, 'UID')] = ch(r, 'Name'));
    const asg = {}; if (sect('Assignments')) Array.from(sect('Assignments').children).forEach(a => { const n = res[ch(a, 'ResourceUID')]; if (n) (asg[ch(a, 'TaskUID')] = asg[ch(a, 'TaskUID')] || []).push(n); });
    const tasks = sect('Tasks') ? Array.from(sect('Tasks').children).filter(t => t.localName === 'Task') : [];
    const idOf = {}; tasks.forEach(t => idOf[ch(t, 'UID')] = ch(t, 'ID'));
    const minsPerDay = (Number(ch(root, 'MinutesPerDay')) || 480);
    return tasks.filter(t => ch(t, 'UID') !== '0' && ch(t, 'IsNull') !== '1' && ch(t, 'Name')).map(t => {
      const uid = ch(t, 'UID'); const people = asg[uid] || [];
      const pred = Array.from(t.children).filter(c => c.localName === 'PredecessorLink').map(l => {
        const id = idOf[ch(l, 'PredecessorUID')]; if (!id) return ''; const typ = LINK[ch(l, 'Type') || '1'] || 'ZR';
        const lagDays = Math.round((Number(ch(l, 'LinkLag')) || 0) / 10 / minsPerDay * 10) / 10;
        return id + (typ !== 'ZR' || lagDays ? typ : '') + (lagDays ? (lagDays > 0 ? '+' : '') + lagDays + 'd' : '');
      }).filter(Boolean).join(';');
      const milestone = ch(t, 'Milestone') === '1'; const name = ch(t, 'Name');
      const deadline = ch(t, 'Deadline').slice(0, 10);
      return { code: ch(t, 'ID'), wbs: ch(t, 'WBS') || ch(t, 'OutlineNumber'), level: Number(ch(t, 'OutlineLevel')) || 1, summary: ch(t, 'Summary') === '1',
        name, start: ch(t, 'Start').slice(0, 10), end: ch(t, 'Finish').slice(0, 10), progress: Number(ch(t, 'PercentComplete')) || 0,
        respId: people.length ? M.matchCompany(people[0]) : '', respTxt: people.join(', '), pred, milestone, contract: milestone && /umown|kontrakt|contract/i.test(name),
        lead: 0, leadDone: false, notes: [ch(t, 'Notes'), deadline ? 'Termin ostateczny (MS Project): ' + M.fmt(deadline) : ''].filter(Boolean).join('\n'), source: 'MS Project XML' };
    }).filter(x => x.start && x.end);
  };
  // ---------------- import: Excel / CSV (także eksport z MS Project) ----------------
  H.parseTable = async (f) => {
    let rows;
    if (/\.csv$/i.test(f.name)) { const t = await f.text(); const d = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ','; rows = t.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(d).map(s => s.replace(/^"|"$/g, '').trim())); }
    else { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer()); const ws = wb.worksheets[0]; rows = []; ws.eachRow({ includeEmpty: false }, r => { const a = []; r.eachCell({ includeEmpty: true }, (c, i) => a[i - 1] = M.cellVal(c.value)); for (let i = 0; i < a.length; i++) if (a[i] === undefined) a[i] = ''; rows.push(a); }); }
    const hi = rows.findIndex(r => r.some(c => COLS.name.includes(M.norm(c)))); if (hi < 0) throw new Error('Nie znaleziono kolumny z nazwą zadania');
    const head = rows[hi].map(M.norm); const idx = {}; Object.entries(COLS).forEach(([k, al]) => { const i = head.findIndex(h => al.includes(h)); if (i >= 0) idx[k] = i; });
    if (idx.start == null || idx.end == null) throw new Error('Brak kolumn Start/Rozpoczęcie i Koniec/Zakończenie');
    const yes = (s) => /^(tak|t|yes|y|1|x|true)$/i.test(String(s ?? '').trim());
    // Excel zapisuje 45% jako 0,45; tekst „45%” lub „45” → 45
    const pct = (val) => { if (typeof val === 'number') return Math.round(val > 0 && val <= 1 ? val * 100 : val); const n = Number(String(val ?? '').replace('%', '').replace(',', '.').trim()); return isNaN(n) ? 0 : Math.round(n); };
    const out = rows.slice(hi + 1).map(r => { const lvl = idx.level != null ? Number(r[idx.level]) || 1 : 1; const resp = idx.resp != null ? String(r[idx.resp] ?? '') : '';
      return { code: idx.code != null ? String(r[idx.code] ?? '') : '', name: String(r[idx.name] ?? '').trim(), level: lvl, start: M.parseDate(r[idx.start]), end: M.parseDate(r[idx.end]), progress: idx.progress != null ? pct(r[idx.progress]) : 0, respId: resp ? M.matchCompany(resp.split(/[;,]/)[0]) : '', respTxt: resp, pred: idx.pred != null ? String(r[idx.pred] ?? '') : '', milestone: idx.milestone != null ? yes(r[idx.milestone]) : false, contract: idx.contract != null ? yes(r[idx.contract]) : false, lead: idx.lead != null ? Number(r[idx.lead]) || 0 : 0, notes: idx.notes != null ? String(r[idx.notes] ?? '') : '' }; }).filter(x => x.name && x.start && x.end);
    // zadanie sumaryczne = następne ma wyższy poziom konspektu
    out.forEach((x, i) => { if (out[i + 1] && out[i + 1].level > x.level) x.summary = true; if (x.start === x.end && !x.milestone && /kamie|milestone/i.test(x.name)) x.milestone = true; });
    return out;
  };

  M.modules.harmonogram = {
    title: 'Harmonogram', icon: 'gantt', order: 6,
    desc: 'Gantt, automatyczne ostrzeżenia (opóźnienia, zamówienia z wyprzedzeniem, kamienie milowe) i ryzyka z AI.',
    today() { return H.rules().filter(r => r.lvl && ['wyprzedzenie', 'kamień milowy', 'opóźnienie', 'brak startu'].includes(r.type)).slice(0, 12).map(r => ({ lvl: r.lvl, icon: r.type === 'wyprzedzenie' ? 'clock' : r.type === 'kamień milowy' ? 'flag' : 'gantt', kind: 'harm', t: `${r.task.name}`, d: r.txt, go: 'harmonogram/ryzyka', sort: M.daysLeft(r.date) || 0 })).concat(M.S.all('risks').filter(r => r.status !== 'zamknięte' && r.due && r.due <= M.addDays(M.todayISO(), 3)).map(r => ({ lvl: r.due < M.todayISO() ? 'red' : 'yel', icon: 'alert', kind: 'harm', t: `Działanie: ${r.action.slice(0, 70)}`, d: `ryzyko: ${r.text.slice(0, 80)} · do ${M.fmt(r.due)}`, go: 'harmonogram/ryzyka' }))); },
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      if (rest[0] === 'ryzyka') st.tab = 'ryzyka';
      const edit = M.P.canEdit('harmonogram'); const tasks = M.S.all('tasks');
      v.innerHTML = M.UI.head('Harmonogram <span class="acc">budowy</span>', `Termin umowny zakończenia: <b>${M.fmt(M.S.project.end)}</b> · ${tasks.length} zadań`,
        `${edit ? `<button class="btn" id="imp">${M.icon.upload}Import MS Project / Excel</button><button class="btn" id="add">${M.icon.plus}Zadanie</button>` : ''}<button class="btn" id="xls">${M.icon.xlsx}Excel</button>${edit ? `<button class="btn soft" id="ai">${M.icon.spark}AI: ryzyka i działania</button>` : ''}`) + M.UI.readonlyBanner('harmonogram') +
        `<div class="tabs">${[['gantt', 'Wykres Gantta'], ['tabela', 'Tabela'], ['ryzyka', 'Ostrzeżenia i ryzyka']].map(([k, l]) => `<button data-t="${k}" class="${st.tab === k ? 'on' : ''}">${l}${k === 'ryzyka' ? ` <span class="badge or">${H.rules().filter(r => r.lvl).length + M.S.all('risks').filter(r => r.status !== 'zamknięte').length}</span>` : ''}</button>`).join('')}</div><div id="body"></div>`;
      v.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; this.render(v, []); });
      const body = v.querySelector('#body');
      if (!tasks.length && st.tab !== 'ryzyka') body.innerHTML = `<div class="card card-pad">${M.UI.empty('Brak zadań. Zaimportuj harmonogram z MS Project (plik XML) lub Excela albo dodaj zadania ręcznie. <a href="#" id="tplx">Pobierz szablon Excela</a>', 'gantt')}</div>`;
      else if (st.tab === 'gantt') this.gantt(body); else if (st.tab === 'tabela') this.table(body); else this.risks(body);
      const tx = v.querySelector('#tplx'); if (tx) tx.onclick = (ev) => { ev.preventDefault(); this.templateXlsx(); };
      const imp = v.querySelector('#imp'); if (imp) imp.onclick = () => this.importDialog(v);
      const add = v.querySelector('#add'); if (add) add.onclick = () => this.edit({ start: M.todayISO(), end: M.addDays(M.todayISO(), 14), progress: 0 }, v);
      v.querySelector('#xls').onclick = () => this.excel();
      const ai = v.querySelector('#ai'); if (ai) ai.onclick = () => this.ai(v);
    },
    sorted() { const t = M.S.all('tasks').slice(); const tree = t.some(x => x.summary || (x.level || 1) > 1); return t.sort(tree ? (a, b) => String(a.code).localeCompare(String(b.code), 'pl', { numeric: true }) : (a, b) => (a.start || '').localeCompare(b.start || '') || String(a.code).localeCompare(String(b.code), 'pl', { numeric: true })); },
    gantt(box) {
      const tasks = this.sorted(); const t = M.todayISO(); const rules = H.rules();
      const min = tasks.reduce((a, x) => x.start < a ? x.start : a, tasks[0].start), max = tasks.reduce((a, x) => x.end > a ? x.end : a, tasks[0].end);
      const from = M.addDays(min < t ? min : t, -7), to = M.addDays(max > t ? max : t, 14); const days = M.diffDays(from, to);
      const px = Math.max(3, Math.min(14, 1100 / days)); const W = Math.round(days * px);
      const xOf = (d) => Math.round(M.diffDays(from, d) * px);
      const ticks = []; const d0 = M.toDate(from); d0.setDate(1); for (let d = new Date(d0); M.iso(d) <= to; d.setMonth(d.getMonth() + 1)) if (M.iso(d) >= from) ticks.push(M.iso(d));
      const cls = (x) => { const p = Number(x.progress) || 0; if (p >= 100) return 'done'; const r = rules.filter(r => r.task === x); if (r.some(r => r.lvl === 'red')) return 'late'; if (r.some(r => r.lvl === 'yel')) return 'risk'; return ''; };
      box.innerHTML = `<div class="gantt"><table><thead><tr><th style="position:sticky;left:0;z-index:3;background:#FAFAFA">Zadanie</th><th style="padding:0"><div class="gscale" style="width:${W}px">${ticks.map(d => `<span style="left:${xOf(d)}px">${M.toDate(d).toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })}</span>`).join('')}</div></th></tr></thead>
        <tbody>${tasks.map(x => `<tr data-id="${x.id}" style="cursor:pointer"><td class="nm" title="${e(x.name)}${x.respTxt ? ' · ' + e(x.respTxt) : ''}" style="padding-left:${8 + ((x.level || 1) - 1) * 14}px;${x.summary ? 'font-weight:800' : ''}"><span class="muted xs">${e(x.code || '')}</span> ${e(x.name)}</td><td class="bar"><div style="position:relative;width:${W}px;height:30px">${x.milestone ? `<div class="gms ${x.contract ? 'contract' : ''}" style="left:${xOf(x.end) - 7}px" title="${e(x.name)} – ${M.fmt(x.end)}"></div>` : x.summary ? `<div class="gsum" style="left:${xOf(x.start)}px;width:${Math.max(4, xOf(x.end) - xOf(x.start) + px)}px" title="${e(x.name)}: ${M.fmt(x.start)} – ${M.fmt(x.end)}, ${x.progress || 0}%"></div>` : `<div class="gbar ${cls(x)}" style="left:${xOf(x.start)}px;width:${Math.max(4, xOf(x.end) - xOf(x.start) + px)}px" title="${e(x.name)}: ${M.fmt(x.start)} – ${M.fmt(x.end)}, ${x.progress || 0}%"><i style="width:${Math.min(100, Number(x.progress) || 0)}%"></i></div>`}${Number(x.lead) > 0 && !x.leadDone && !(Number(x.progress) > 0) ? `<div style="position:absolute;top:13px;height:4px;border-top:2px dashed var(--or-500);left:${xOf(M.addDays(x.start, -x.lead))}px;width:${Math.round(x.lead * px)}px" title="wyprzedzenie ${x.lead} dni"></div>` : ''}</div></td></tr>`).join('')}</tbody></table>
        <div class="gtoday" style="left:0" id="gt"></div></div>
        <div class="row small muted" style="margin-top:8px;gap:14px"><span><span class="light" style="background:var(--gr-700)"></span> postęp</span><span><span class="light r"></span> opóźnione</span><span><span class="light y"></span> zagrożone</span><span><span class="light g"></span> zakończone</span><span>◆ kamień milowy (pomarańczowy = umowny)</span><span>- - - wyprzedzenie (zamówienie)</span><span style="color:var(--or-600)">| dziś</span></div>`;
      const nm = box.querySelector('td.nm'); const gt = box.querySelector('#gt');
      requestAnimationFrame(() => { const off = nm ? nm.offsetWidth : 200; gt.style.left = (off + xOf(t)) + 'px'; gt.style.height = box.querySelector('table').offsetHeight + 'px'; const g = box.querySelector('.gantt'); g.scrollLeft = Math.max(0, xOf(t) - 300); });
      box.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => this.edit(M.S.get('tasks', tr.dataset.id)));
    },
    table(box) {
      const edit = M.P.canEdit('harmonogram');
      box.innerHTML = `<div class="card table-wrap"><table class="list"><thead><tr><th>Kod</th><th>Zadanie</th><th>Start</th><th>Koniec</th><th>Postęp</th><th class="hide-m">Odpowiedzialny</th><th class="hide-m">Wyprzedzenie</th></tr></thead><tbody>${this.sorted().map(x => `<tr class="click" data-id="${x.id}"><td class="num">${e(x.code || '')}</td><td style="padding-left:${11 + ((x.level || 1) - 1) * 14}px;${x.summary ? 'font-weight:800' : ''}">${x.milestone ? '◆ ' : ''}${e(x.name)}${x.respTxt && !x.respId ? `<div class="xs muted">zasoby: ${e(x.respTxt)}</div>` : ''}</td><td class="nowrap">${M.fmt(x.start)}</td><td class="nowrap">${M.fmt(x.end)}</td><td onclick="event.stopPropagation()">${edit ? `<input type="number" min="0" max="100" step="5" value="${Number(x.progress) || 0}" data-p="${x.id}" style="width:74px">` : (x.progress || 0)}%</td><td class="hide-m small">${e(M.S.respName(x.respId))}</td><td class="hide-m small">${Number(x.lead) > 0 ? `${x.lead} dni ${x.leadDone ? '✓ zamówione' : ''}` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      box.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => this.edit(M.S.get('tasks', tr.dataset.id)));
      box.querySelectorAll('[data-p]').forEach(i => i.onchange = () => { const x = M.S.get('tasks', i.dataset.p); x.progress = Math.max(0, Math.min(100, Number(i.value) || 0)); M.S.upsert('tasks', x); M.toast('Postęp zapisany'); });
    },
    edit(x, v) {
      const edit = M.P.canEdit('harmonogram'); const isNew = !x.id;
      const d = M.UI.drawer({ title: isNew ? 'Nowe zadanie' : e(x.name), body: `
        <div class="grid2"><label class="f">Kod / WBS<input type="text" data-f="code" value="${e(x.code || '')}"></label><label class="f">Postęp %<input type="number" min="0" max="100" data-f="progress" value="${e(x.progress ?? 0)}"></label></div>
        <label class="f req"><span>Nazwa zadania</span><input type="text" data-f="name" value="${e(x.name || '')}"></label>
        <div class="grid2"><label class="f">Start<input type="date" data-f="start" value="${e(x.start || '')}"></label><label class="f">Koniec<input type="date" data-f="end" value="${e(x.end || '')}"></label></div>
        <label class="f">Odpowiedzialny<select data-f="respId">${M.UI.respOpts(x.respId, '—')}</select></label>
        <label class="f">Poprzedniki <span class="hint">(kody zadań, np. 3; 5)</span><input type="text" data-f="pred" value="${e(x.pred || '')}"></label>
        <div class="fieldset"><legend>Wyprzedzenie (zamówienia, uzgodnienia, dokumentacja)</legend><div class="grid2"><label class="f">Ile dni przed startem trzeba zacząć działać<input type="number" min="0" data-f="lead" value="${e(x.lead || 0)}"></label><label class="check" style="margin-top:20px"><input type="checkbox" data-f="leadDone" ${x.leadDone ? 'checked' : ''}>Zamówione / załatwione</label></div></div>
        <div class="row"><label class="check"><input type="checkbox" data-f="milestone" ${x.milestone ? 'checked' : ''}>Kamień milowy</label><label class="check"><input type="checkbox" data-f="contract" ${x.contract ? 'checked' : ''}>Termin umowny</label></div>
        <label class="f">Uwagi<textarea data-f="notes" rows="3">${e(x.notes || '')}</textarea></label>
        ${!isNew ? `<div class="fieldset"><legend>Ostrzeżenia</legend>${H.rules().filter(r => r.task.id === x.id).map(r => `<div class="small"><span class="light ${r.lvl === 'red' ? 'r' : r.lvl === 'yel' ? 'y' : 'n'}"></span> ${e(r.txt)}</div>`).join('') || '<span class="small muted">brak</span>'}</div>` : ''}`,
        footer: edit ? `${!isNew ? `<button class="btn danger" id="del">${M.icon.trash}</button>` : ''}<span class="grow"></span><button class="btn primary" id="ok">${M.icon.check}Zapisz</button>` : '' });
      if (!edit) return M.UI.lockForm(d, true);
      d.querySelector('#ok').onclick = () => { const f = M.UI.read(d); if (!f.name.trim()) return M.toast('Podaj nazwę', 'warn'); if (f.end < f.start) return M.toast('Koniec przed startem', 'warn'); M.S.upsert('tasks', { ...x, ...f }); d.close(); M.render(); };
      const del = d.querySelector('#del'); if (del) del.onclick = async () => { if (await M.UI.confirm('Usunąć zadanie?', 'Usuń', true)) { M.S.remove('tasks', x.id); d.close(); M.render(); } };
    },
    risks(box) {
      const rules = H.rules(); const risks = M.S.all('risks').sort((a, b) => (a.status === 'zamknięte') - (b.status === 'zamknięte') || (a.due || '').localeCompare(b.due || '')); const edit = M.P.canEdit('harmonogram');
      box.innerHTML = `<div class="grid2" style="align-items:start">
        <div class="card"><div class="card-head"><h2>Ostrzeżenia automatyczne</h2><span class="badge">${rules.length}</span></div><div class="small muted" style="padding:8px 16px 0">Liczone na bieżąco z dat, postępu, wyprzedzeń i kamieni milowych – bez AI.</div>
          ${rules.length ? `<table class="list"><tbody>${rules.map(r => `<tr><td style="width:16px"><span class="light ${r.lvl === 'red' ? 'r' : r.lvl === 'yel' ? 'y' : 'n'}"></span></td><td><b>${e(r.task.name)}</b><div class="small">${e(r.txt)}</div><div class="xs muted">${e(r.type)}</div></td>${edit && r.type === 'wyprzedzenie' ? `<td><button class="btn sm" data-done="${r.task.id}">${M.icon.check}Zamówione</button></td>` : '<td></td>'}</tr>`).join('')}</tbody></table>` : M.UI.empty('Brak ostrzeżeń.', 'check')}</div>
        <div class="card"><div class="card-head"><h2>Rejestr ryzyk i działań</h2>${edit ? `<button class="btn sm" id="addR">${M.icon.plus}Ryzyko</button>` : ''}</div>
          ${risks.length ? `<table class="list"><tbody>${risks.map(r => `<tr data-id="${r.id}" style="${r.status === 'zamknięte' ? 'opacity:.55' : ''}"><td><div class="row"><span class="badge ${r.impact === 'wysoki' ? 'danger' : r.impact === 'średni' ? 'warn' : ''}">${e(r.impact || '—')}</span><b class="small">${e(r.taskName || '')}</b><span class="xs muted right">${e(r.source || '')}</span></div><div class="small" style="margin:3px 0">${e(r.text)}</div><div class="small"><b>Działanie:</b> ${e(r.action)}</div><div class="row xs muted" style="margin-top:4px"><span>do ${M.fmt(r.due) || '—'}</span><span>· ${e(r.resp || '')}</span>${edit ? `<select data-s style="width:auto;margin-left:auto;padding:3px 6px;font-size:12px">${M.UI.opts(RISK_ST, r.status)}</select>` : `<span class="right">${e(r.status)}</span>`}</div></td></tr>`).join('')}</tbody></table>` : `<div class="card-pad">${M.UI.empty('Brak ryzyk w rejestrze. Użyj „AI: ryzyka i działania” lub dodaj ręcznie.', 'alert')}</div>`}</div></div>`;
      box.querySelectorAll('[data-done]').forEach(b => b.onclick = () => { const x = M.S.get('tasks', b.dataset.done); x.leadDone = true; M.S.upsert('tasks', x); M.render(); });
      box.querySelectorAll('tr[data-id] [data-s]').forEach(s => s.onchange = () => { const r = M.S.get('risks', s.closest('tr').dataset.id); r.status = s.value; M.S.upsert('risks', r); M.render(); });
      const ar = box.querySelector('#addR'); if (ar) ar.onclick = () => { const txt = prompt('Opis ryzyka:'); if (!txt) return; const act = prompt('Działanie zaradcze:') || ''; M.S.upsert('risks', { text: txt, action: act, impact: 'średni', due: M.addDays(M.todayISO(), 7), resp: '', status: 'otwarte', source: 'ręcznie' }); M.render(); };
    },
    ai(v) {
      const tasks = this.sorted(); if (!tasks.length) return M.toast('Najpierw dodaj harmonogram', 'warn');
      const csv = ['kod;zadanie;start;koniec;postep_%;odpowiedzialny;poprzedniki;kamien_milowy;umowny;wyprzedzenie_dni;zamowione;uwagi', ...tasks.map(x => [x.code, x.name, x.start, x.end, x.progress || 0, M.S.respName(x.respId), x.pred, x.milestone ? 'tak' : '', x.contract ? 'tak' : '', x.lead || '', x.leadDone ? 'tak' : '', x.notes].map(s => String(s ?? '').replace(/[;\n]/g, ',')).join(';'))].join('\n');
      M.AI.open({ key: 'harmonogram', title: 'Asystent AI – ryzyka harmonogramu',
        prompt: M.AI.fill('harmonogram', { PROJEKT: M.S.project.name, KONIEC: M.fmt(M.S.project.end), DZIS: M.fmt(M.todayISO()), REGULY: H.rules().map(r => `- [${r.type}] ${r.task.name}: ${r.txt}`).join('\n') || 'brak', CSV: csv }),
        parse: (t) => { const j = M.extractJSON(t); return Array.isArray(j) && j.length && j[0].ryzyko ? j : null; },
        preview: (j) => `<ul>${j.map(r => `<li><b>${e(r.zadanie)}</b> (${e(r.wplyw)}): ${e(r.ryzyko)}<br>→ ${e(r.dzialanie)} <i>do ${e(r.termin)}</i> – ${e(r.odpowiedzialny)}</li>`).join('')}</ul>`,
        applyLabel: 'Dodaj do rejestru ryzyk',
        apply: (j) => { j.forEach(r => M.S.upsert('risks', { taskName: r.zadanie, text: r.ryzyko, impact: r.wplyw, action: r.dzialanie, due: M.parseDate(r.termin), resp: r.odpowiedzialny, status: 'otwarte', source: 'AI ' + M.fmt(M.todayISO()) }, true)); M.S.touch('risks'); st.tab = 'ryzyka'; M.render(); } });
    },
    importDialog(v) {
      const m = M.UI.modal({ title: 'Import harmonogramu', body: `
        <div class="grid2" style="align-items:start">
          <div class="col small"><b>MS Project (zalecane)</b><div>W MS Project: <b>Plik → Zapisz jako</b> → typ pliku <b>XML (*.xml)</b>. Wczytaj ten plik – przenoszę zadania, hierarchię (zadania sumaryczne), kamienie milowe, % ukończenia, zasoby i powiązania (ZR/RR/ZZ/RZ z opóźnieniem).</div>
            <div class="muted">Plik <b>.mpp</b> to zamknięty format binarny Microsoftu – przeglądarka go nie odczyta. Wersja .exe też będzie wymagała XML (albo eksportu do Excela).</div></div>
          <div class="col small"><b>Excel / CSV</b><div>Arkusz z wierszem nagłówków, także eksport z MS Project do Excela (Plik → Eksportuj). Rozpoznaję m.in.: <i>Identyfikator, Nazwa, Rozpoczęcie, Zakończenie, % ukończenia, Nazwy zasobów, Poprzedniki, Poziom konspektu, Kamień milowy, Wyprzedzenie (dni)</i>.</div></div>
        </div>
        <div class="drop" id="drop">${M.ico('upload', 30)}<div><b>Wybierz plik</b> (.xml z MS Project, .xlsx, .csv)</div></div>
        <label class="check"><input type="checkbox" id="repl" checked>Zastąp obecny harmonogram tej budowy</label>
        <label class="check"><input type="checkbox" id="keep" checked>Zachowaj moje wpisy „wyprzedzenie” i „zamówione” dla zadań o tej samej nazwie</label><div id="res"></div>`, footer: `<button class="btn ghost" id="tpl">${M.icon.download}Szablon Excela</button>` });
      m.querySelector('#tpl').onclick = () => this.templateXlsx();
      m.querySelector('#drop').onclick = async () => {
        const f = await M.pickFile('.xml,.xlsx,.csv,.mpp'); if (!f) return;
        try {
          if (/\.mpp$/i.test(f.name)) throw new Error('Plik .mpp nie jest obsługiwany. W MS Project wybierz Plik → Zapisz jako → typ „XML (*.xml)” i wczytaj plik .xml.');
          const out = /\.xml$/i.test(f.name) ? H.parseMsProjectXml(await f.text()) : await H.parseTable(f);
          if (!out.length) throw new Error('Nie znaleziono zadań z poprawnymi datami');
          const old = M.S.all('tasks'); const byName = {}; old.forEach(x => byName[M.norm(x.name)] = x);
          if (m.querySelector('#keep').checked) out.forEach(x => { const o = byName[M.norm(x.name)]; if (o) { if (!x.lead && o.lead) x.lead = o.lead; if (o.leadDone) x.leadDone = true; if (o.contract) x.contract = true; if (!x.respId && o.respId) x.respId = o.respId; } });
          if (m.querySelector('#repl').checked) M.S.db.tasks = M.S.db.tasks.filter(x => x.projectId !== M.S.pid);
          out.forEach(x => M.S.upsert('tasks', x, true)); M.S.touch('tasks');
          const sm = out.filter(x => x.summary).length, ms = out.filter(x => x.milestone).length, nr = out.filter(x => x.respTxt && !x.respId).length;
          m.close(); M.toast(`Zaimportowano ${out.length} zadań (${sm} sumarycznych, ${ms} kamieni milowych)${nr ? ` · ${nr} zasobów bez dopasowanej firmy` : ''}`); M.render();
        } catch (err) { console.warn(err.message); m.querySelector('#res').innerHTML = `<div class="banner warn">${M.icon.alert}<span>${e(err.message)}</span></div>`; }
      };
    },
    async templateXlsx() {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Harmonogram');
      ws.columns = [['Kod', 8], ['Nazwa zadania', 44], ['Start', 12], ['Koniec', 12], ['Postęp %', 10], ['Odpowiedzialny', 26], ['Poprzedniki', 12], ['Kamień milowy', 14], ['Umowny', 10], ['Wyprzedzenie dni', 16], ['Uwagi', 30]].map(([h, w]) => ({ header: h, width: w }));
      ws.addRow(['1', 'Roboty ziemne', M.toDate(M.todayISO()), M.toDate(M.addDays(M.todayISO(), 20)), 0, 'Firma X', '', '', '', '', '']);
      ws.addRow(['M1', 'Zamknięcie bryły', M.toDate(M.addDays(M.todayISO(), 90)), M.toDate(M.addDays(M.todayISO(), 90)), 0, '', '1', 'tak', 'tak', '', '']);
      ws.getRow(1).font = { bold: true }; ws.getColumn(3).numFmt = 'dd.mm.yyyy'; ws.getColumn(4).numFmt = 'dd.mm.yyyy';
      M.download(new Blob([await wb.xlsx.writeBuffer()]), 'Szablon_harmonogramu.xlsx');
    },
    async excel() {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Harmonogram');
      ws.columns = [['Kod', 8], ['Nazwa zadania', 44], ['Start', 12], ['Koniec', 12], ['Postęp %', 10], ['Odpowiedzialny', 26], ['Poprzedniki', 12], ['Kamień milowy', 14], ['Umowny', 10], ['Wyprzedzenie dni', 16], ['Zamówione', 11], ['Uwagi', 30]].map(([h, w]) => ({ header: h, width: w }));
      this.sorted().forEach(x => ws.addRow([x.code, x.name, M.toDate(x.start), M.toDate(x.end), x.progress || 0, M.S.respName(x.respId), x.pred, x.milestone ? 'tak' : '', x.contract ? 'tak' : '', x.lead || '', x.leadDone ? 'tak' : '', x.notes]));
      ws.getRow(1).font = { bold: true }; ws.getColumn(3).numFmt = 'dd.mm.yyyy'; ws.getColumn(4).numFmt = 'dd.mm.yyyy';
      const w2 = wb.addWorksheet('Ryzyka'); w2.columns = [['Zadanie', 30], ['Ryzyko', 50], ['Wpływ', 10], ['Działanie', 50], ['Termin', 12], ['Odpowiedzialny', 20], ['Status', 14], ['Źródło', 14]].map(([h, w]) => ({ header: h, width: w }));
      M.S.all('risks').forEach(r => w2.addRow([r.taskName, r.text, r.impact, r.action, r.due ? M.toDate(r.due) : '', r.resp, r.status, r.source])); w2.getRow(1).font = { bold: true };
      M.download(new Blob([await wb.xlsx.writeBuffer()]), `Harmonogram_${M.safeName(M.S.project.short)}_${M.todayISO()}.xlsx`);
    },
  };
})(window.M);
