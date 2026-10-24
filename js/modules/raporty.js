/* =========================================================
   BIURO BUDOWY — Raporty z budowy (dzienne) z Asystentem AI
   Zdjęcia + krótkie notatki (lub dyktowanie) → AI wypełnia szablon TEJ budowy
   → gotowy raport PDF + projekt wpisu do EDB (do wklejenia i podpisu w EDB).
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const WMO = { 0: 'bezchmurnie', 1: 'przeważnie pogodnie', 2: 'częściowe zachmurzenie', 3: 'pochmurno', 45: 'mgła', 48: 'mgła osadzająca szadź', 51: 'lekka mżawka', 53: 'mżawka', 55: 'gęsta mżawka', 56: 'marznąca mżawka', 57: 'marznąca mżawka', 61: 'słaby deszcz', 63: 'deszcz', 65: 'silny deszcz', 66: 'marznący deszcz', 67: 'marznący deszcz', 71: 'słaby śnieg', 73: 'śnieg', 75: 'silny śnieg', 77: 'ziarna śniegu', 80: 'przelotny deszcz', 81: 'przelotny deszcz', 82: 'ulewa', 85: 'przelotny śnieg', 86: 'intensywny śnieg', 95: 'burza', 96: 'burza z gradem', 99: 'burza z gradem' };
  const weatherTxt = (w) => w ? [w.opis, w.tmin !== '' && w.tmin != null ? `temp. ${w.tmin}…${w.tmax}°C` : '', w.opad !== '' && w.opad != null ? `opad ${w.opad} mm` : '', w.wiatr !== '' && w.wiatr != null ? `wiatr do ${w.wiatr} km/h${w.porywy ? ' (porywy ' + w.porywy + ')' : ''}` : ''].filter(Boolean).join(', ') : '';
  M.weatherTxt = weatherTxt;

  /** pogoda z Open-Meteo (bez klucza; wymaga internetu). Darmowy dostęp – do użytku niekomercyjnego, patrz open-meteo.com. */
  M.fetchWeather = async (date, lat, lon) => {
    if (!lat || !lon) throw new Error('Uzupełnij współrzędne budowy w Ustawieniach → Budowa');
    const q = `latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=Europe%2FWarsaw&start_date=${date}&end_date=${date}`;
    let r = await fetch('https://api.open-meteo.com/v1/forecast?' + q).catch(() => null);
    if (!r || !r.ok) r = await fetch('https://archive-api.open-meteo.com/v1/archive?' + q);
    if (!r.ok) throw new Error('Serwis pogody niedostępny (' + r.status + ')');
    const j = await r.json(); const d = j.daily; if (!d || !d.time || !d.time.length) throw new Error('Brak danych pogodowych dla tej daty');
    const r1 = (x) => x == null ? '' : Math.round(x * 10) / 10;
    return { opis: WMO[d.weather_code[0]] || '', tmin: r1(d.temperature_2m_min[0]), tmax: r1(d.temperature_2m_max[0]), opad: r1(d.precipitation_sum[0]), wiatr: r1(d.wind_speed_10m_max[0]), porywy: r1(d.wind_gusts_10m_max[0]), zrodlo: 'Open-Meteo (model/reanaliza, nie pomiar na budowie)' };
  };

  /** Rewizja 15: przeszkody / opóźnienia – przyczyny (dowód do roszczeń o czas) */
  const CAUSES = ['pogoda', 'brak dokumentacji / odpowiedzi projektanta', 'brak frontu robót', 'decyzja / polecenie inwestora', 'opóźniona dostawa', 'kolizja z innym wykonawcą', 'awaria sprzętu', 'inne'];
  const eqTxt = (r) => (r.equipment || []).filter(x => x.name).map(x => `${x.name}${x.n ? ' × ' + x.n : ''}`).join('; ');
  const obTxt = (r) => (r.obstacles || []).filter(o => o.desc).map(o => `${o.cause ? o.cause + ': ' : ''}${o.desc}${o.lost ? ` (strata ${o.lost} h)` : ''}${o.companyId ? ' – ' + M.S.respName(o.companyId) : ''}${o.claim ? ' [możliwa podstawa roszczenia]' : ''}`).join('\n');
  M.modules.raporty = {
    title: 'Raporty z budowy', icon: 'report', order: 4,
    desc: 'Wrzucasz zdjęcia i notatki – AI wypełnia szablon tej budowy. Raport PDF + projekt wpisu do EDB.',
    today() {
      const d = new Date().getDay(); const skip = d === 0 || d === 6 || !['KB', 'IB'].includes(M.P.role()) || !M.CAL.isWorkday(M.todayISO());
      const out = skip ? [] : M.S.all('reports').some(r => r.date === M.todayISO()) ? [] : [{ lvl: '', icon: 'report', t: 'Brak raportu dziennego za dziś', d: 'Dodaj zdjęcia i notatki – AI przygotuje raport i wpis do EDB', go: 'raporty/nowy', sort: 50 }];
      return out.concat(this.claimHints());
    },
    /** przeszkody oznaczone jako możliwa podstawa roszczenia, bez zdarzenia w „Terminach umownych” (ostatnie 28 dni) */
    claimHints() {
      if (!M.P.isStaff()) return [];
      const from = M.addDays(M.todayISO(), -28); const out = [];
      M.S.all('reports').filter(r => r.date >= from).forEach(r => (r.obstacles || []).forEach(o => { if (o.claim && !o.eventId && o.desc) { const left = 28 - M.diffDays(r.date, M.todayISO()); out.push({ lvl: left <= 7 ? 'red' : 'yel', icon: 'clock', t: `Przeszkoda z ${M.fmt(r.date)} – możliwa podstawa roszczenia, brak zdarzenia`, d: `${o.desc.slice(0, 90)} · bieg 28 dni od powzięcia wiedzy: zostało ok. ${left} dni`, go: 'raporty/' + r.id, sort: left - 60 }); } }));
      return out;
    },
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      const edit = M.P.canEdit('raporty');
      if (rest[0] === 'nowy' && edit) { const ex = M.S.all('reports').find(r => r.date === M.todayISO()); const r = ex || M.S.upsert('reports', this.blank(M.todayISO())); return M.go('raporty/' + r.id); }
      if (rest[0]) { const r = M.S.get('reports', rest[0]); if (r) return this.detail(v, r); }
      const list = M.S.all('reports').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      v.innerHTML = M.UI.head('Raporty <span class="acc">z budowy</span>', 'Jeden raport na dzień. Szablon raportu ustawiasz osobno dla każdej budowy.', `<button class="btn" id="tpl">${M.icon.edit}Szablon treści</button><button class="btn" id="tplP">${M.icon.report}Szablon PowerPoint</button>${edit ? `<button class="btn primary" id="new">${M.icon.plus}Raport za dziś</button>` : ''}`) +
        `<div class="card">${list.length ? `<table class="list"><thead><tr><th>Data</th><th>Pogoda</th><th class="hide-m">Obsada</th><th>Zdjęcia</th><th>Status</th></tr></thead><tbody>${list.map(r => `<tr class="click" data-id="${r.id}"><td class="num">${M.fmt(r.date)} <span class="muted small">${e(M.weekday(r.date))}</span></td><td class="small">${e(weatherTxt(r.weather)).slice(0, 70)}</td><td class="hide-m">${(r.crew || []).reduce((a, c) => a + (Number(c.n) || 0), 0)} os.</td><td>${(r.photos || []).length}</td><td>${r.aiText ? '<span class="st done">Gotowy</span>' : '<span class="st check">Szkic</span>'}</td></tr>`).join('')}</tbody></table>` : M.UI.empty('Brak raportów. Kliknij „Raport za dziś”.', 'report')}</div>`;
      v.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => M.go('raporty/' + tr.dataset.id));
      const nb = v.querySelector('#new'); if (nb) nb.onclick = () => M.go('raporty/nowy');
      v.querySelector('#tpl').onclick = () => this.templateEditor();
      v.querySelector('#tplP').onclick = () => M.RPPT.editor();
    },
    blank(date) { return { date, hours: '7:00–17:00', weather: { opis: '', tmin: '', tmax: '', opad: '', wiatr: '' }, crew: [], equipment: [], obstacles: [], notes: '', photos: [], aiText: '', edbText: '' }; },
    templateEditor() {
      const p = M.S.project; const ed = M.P.canEdit('ustawienia');
      const m = M.UI.modal({ title: 'Szablon raportu – ' + e(p.short || p.name), body: `<div class="small muted">Nagłówki i kolejność sekcji raportu dla tej budowy. AI wypełnia dokładnie ten układ. Możesz dopisać wymagania inwestora (np. „liczba osób wg firm”, „zdjęcia postępu z 4 narożników”).</div><textarea id="t" rows="14" ${ed ? '' : 'disabled'}>${e(p.reportTemplate || M.DEMO.REPORT_TEMPLATE)}</textarea>`, footer: ed ? `<button class="btn ghost" id="def">Przywróć domyślny</button><span class="grow"></span><button class="btn primary" id="ok">Zapisz szablon</button>` : '' });
      if (!ed) return;
      m.querySelector('#def').onclick = () => { m.querySelector('#t').value = M.DEMO.REPORT_TEMPLATE; };
      m.querySelector('#ok').onclick = () => { p.reportTemplate = m.querySelector('#t').value; M.S.upsert('projects', p); m.close(); M.toast('Szablon zapisany'); };
    },
    detail(v, r) {
      const edit = M.P.canEdit('raporty'); r.crew = r.crew || []; r.photos = r.photos || []; r.weather = r.weather || {}; r.equipment = r.equipment || []; r.obstacles = r.obstacles || [];
      v.innerHTML = `<div class="page-head"><div><h1>Raport z dnia <span class="acc">${M.fmt(r.date)}</span></h1><div class="sub">${e(M.weekday(r.date))} · ${e(M.S.project.name)}</div></div>
        <div class="actions"><button class="btn ghost" id="back">${M.icon.back}Lista</button>${edit ? `<button class="btn" id="cpy" title="Obsada, sprzęt i godziny pracy z poprzedniego raportu (bez pogody, zdjęć i notatek)">${M.icon.copy}Kopiuj wczoraj</button><button class="btn soft" id="ai">${M.icon.spark}AI: przygotuj raport</button>` : ''}<button class="btn" id="pptx">${M.icon.report}Prezentacja PPTX</button><button class="btn primary" id="pdf">${M.icon.print}Raport PDF</button></div></div>
        <div class="grid2" style="align-items:start" id="frm">
          <div class="col">
            <div class="card card-pad col"><h2>1. Zdjęcia z budowy</h2><div class="small muted">Dwuklik na zdjęciu = podpis (np. „oś 5–7, montaż płyt”). Podpisy pomagają AI.</div><div id="ph"></div></div>
            <div class="card card-pad col"><div class="row"><h2 class="grow">2. Notatki</h2>${edit ? `<button class="btn sm" id="dict">${M.icon.mic}Dyktuj</button>` : ''}</div>
              <textarea data-f="notes" id="notes" rows="7" placeholder="Hasłowo: co zrobiono, gdzie, dostawy, odbiory, problemy, plan na jutro…">${e(r.notes || '')}</textarea></div>
          </div>
          <div class="col">
            <div class="card card-pad col"><div class="row"><h2 class="grow">3. Warunki</h2>${edit ? `<button class="btn sm" id="wx">${M.icon.weather}Pobierz pogodę</button>` : ''}</div>
              <div class="grid2"><label class="f">Data<input type="date" data-f="date" value="${e(r.date)}"></label><label class="f">Godziny pracy<input type="text" data-f="hours" value="${e(r.hours || '')}"></label></div>
              <div class="grid4"><label class="f">Opis<input type="text" data-w="opis" value="${e(r.weather.opis || '')}"></label><label class="f">Tmin °C<input type="number" step="0.1" data-w="tmin" value="${e(r.weather.tmin ?? '')}"></label><label class="f">Tmax °C<input type="number" step="0.1" data-w="tmax" value="${e(r.weather.tmax ?? '')}"></label><label class="f">Opad mm<input type="number" step="0.1" data-w="opad" value="${e(r.weather.opad ?? '')}"></label></div>
              <label class="f">Wiatr max km/h<input type="number" data-w="wiatr" value="${e(r.weather.wiatr ?? '')}" style="max-width:160px"></label>
              ${r.weather.zrodlo ? `<div class="xs muted">Źródło: ${e(r.weather.zrodlo)}</div>` : ''}
            </div>
            <div class="card card-pad col"><div class="row"><h2 class="grow">4. Obsada (firma – osób)</h2>${edit ? `<button class="btn sm" id="crewAdd">${M.icon.plus}Firma</button><button class="btn sm ghost" id="crewCopy" title="Skopiuj obsadę z poprzedniego raportu">z wczoraj</button>` : ''}</div><div id="crew"></div></div>
            <div class="card card-pad col"><div class="row"><h2 class="grow">5. Sprzęt</h2>${edit ? `<button class="btn sm" id="eqAdd">${M.icon.plus}Sprzęt</button>` : ''}</div><div id="eq"></div></div>
          </div>
        </div>
        <div class="card card-pad col" style="margin-top:12px"><div class="row"><h2 class="grow">6. Przeszkody i opóźnienia</h2>${edit ? `<button class="btn sm" id="obAdd">${M.icon.plus}Przeszkoda</button>` : ''}</div>
          <div class="small muted">Zapisuj na bieżąco: co wstrzymało roboty, z jakiej przyczyny, ile godzin stracono i kogo dotyczyło. To dowód do roszczeń o przedłużenie czasu – zaznacz „możliwa podstawa roszczenia”, a pulpit przypomni o zawiadomieniu (bieg 28 dni).</div><div id="ob"></div></div>
        <div class="grid2" style="margin-top:12px;align-items:start">
          <div class="card card-pad col"><div class="row"><h2 class="grow">Raport (wynik AI – możesz poprawić)</h2></div><textarea data-f="aiText" rows="14" placeholder="Po użyciu AI tu pojawi się treść raportu…">${e(r.aiText || '')}</textarea></div>
          <div class="card card-pad col"><div class="row"><h2 class="grow">Projekt wpisu do EDB</h2><button class="btn sm" id="cpEdb">${M.icon.copy}Kopiuj</button><a class="btn sm ghost" href="https://edb.gunb.gov.pl/" target="_blank" rel="noopener">${M.icon.link}EDB</a></div>
            <textarea data-f="edbText" rows="10">${e(r.edbText || '')}</textarea>
            <div class="banner info">${M.icon.alert}<span class="small">To tylko projekt treści. Wpisu dokonuje i podpisuje uprawniona osoba w EDB (lub w dzienniku papierowym). Aplikacja nie jest dziennikiem budowy.</span></div></div>
        </div>`;
      const frm = v;
      const save = M.debounce(() => { Object.assign(r, M.UI.read(frm.querySelector('#frm')), { aiText: frm.querySelector('[data-f=aiText]').value, edbText: frm.querySelector('[data-f=edbText]').value }); frm.querySelectorAll('[data-w]').forEach(el => r.weather[el.dataset.w] = el.value); M.S.upsert('reports', r); }, 500);
      if (edit) frm.querySelectorAll('[data-f],[data-w]').forEach(el => el.addEventListener('input', save)); else M.UI.lockForm(frm, true);
      M.UI.photos(v.querySelector('#ph'), r.photos, { editable: edit, onChange: () => M.S.upsert('reports', r) });
      const drawCrew = () => {
        const box = v.querySelector('#crew');
        box.innerHTML = r.crew.length ? r.crew.map((c, i) => `<div class="row" data-i="${i}" style="margin-bottom:6px"><select data-k="companyId" style="flex:1" ${edit ? '' : 'disabled'}>${M.UI.respOpts(c.companyId, '— firma —')}</select><input type="number" data-k="n" value="${e(c.n ?? '')}" style="width:80px" min="0" ${edit ? '' : 'disabled'}><span class="small muted">os.</span>${edit ? `<button class="btn icon ghost sm" data-del>${M.icon.x}</button>` : ''}</div>`).join('') + `<div class="small muted">Razem: <b>${r.crew.reduce((a, c) => a + (Number(c.n) || 0), 0)}</b> osób</div>` : '<div class="small muted">Brak wpisów.</div>';
        box.querySelectorAll('[data-i]').forEach(row => { const c = r.crew[+row.dataset.i]; row.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { c[el.dataset.k] = el.value; M.S.upsert('reports', r); drawCrew(); }); const d = row.querySelector('[data-del]'); if (d) d.onclick = () => { r.crew.splice(+row.dataset.i, 1); M.S.upsert('reports', r); drawCrew(); }; });
      };
      drawCrew();
      const drawEq = () => {
        const box = v.querySelector('#eq');
        box.innerHTML = r.equipment.length ? r.equipment.map((x, i) => `<div class="row" data-i="${i}" style="margin-bottom:6px"><input type="text" data-k="name" value="${e(x.name || '')}" placeholder="np. żuraw samojezdny 60 t" style="flex:1" ${edit ? '' : 'disabled'}><input type="number" data-k="n" value="${e(x.n ?? '')}" style="width:70px" min="0" ${edit ? '' : 'disabled'}><span class="small muted">szt.</span>${edit ? `<button class="btn icon ghost sm" data-del>${M.icon.x}</button>` : ''}</div>`).join('') : '<div class="small muted">Brak wpisów.</div>';
        box.querySelectorAll('[data-i]').forEach(row => { const x = r.equipment[+row.dataset.i]; row.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { x[el.dataset.k] = el.value; M.S.upsert('reports', r); }); const d = row.querySelector('[data-del]'); if (d) d.onclick = () => { r.equipment.splice(+row.dataset.i, 1); M.S.upsert('reports', r); drawEq(); }; });
      };
      const drawOb = () => {
        const box = v.querySelector('#ob');
        box.innerHTML = r.obstacles.length ? `<div class="table-wrap"><table class="list"><thead><tr><th>Opis</th><th style="width:210px">Przyczyna</th><th style="width:80px">Strata [h]</th><th class="hide-m" style="width:200px">Dotyczy firmy</th><th style="width:150px">Roszczenie</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>${r.obstacles.map((o, i) => { const ev = o.eventId && M.S.get('events', o.eventId); return `<tr data-i="${i}"><td><input type="text" data-k="desc" value="${e(o.desc || '')}" placeholder="co wstrzymało roboty, gdzie" ${edit ? '' : 'disabled'}></td><td><select data-k="cause" ${edit ? '' : 'disabled'}>${M.UI.opts(CAUSES, o.cause, '—')}</select></td><td><input type="number" min="0" step="0.5" data-k="lost" value="${e(o.lost ?? '')}" ${edit ? '' : 'disabled'}></td><td class="hide-m"><select data-k="companyId" ${edit ? '' : 'disabled'}>${M.UI.respOpts(o.companyId, '—')}</select></td><td><label class="check small"><input type="checkbox" data-k="claim" ${o.claim ? 'checked' : ''} ${edit ? '' : 'disabled'}>możliwa podstawa</label>${ev ? `<div class="xs"><a href="#/terminy/${ev.id}">zdarzenie ✓</a></div>` : o.claim && edit && M.P.canEdit('terminy') ? `<button class="btn sm" data-ev>${M.icon.clock}Zdarzenie</button>` : ''}</td>${edit ? `<td><button class="btn icon ghost sm" data-del>${M.icon.x}</button></td>` : ''}</tr>`; }).join('')}</tbody></table></div>` : '<div class="small muted">Brak przeszkód w tym dniu.</div>';
        box.querySelectorAll('tr[data-i]').forEach(row => { const o = r.obstacles[+row.dataset.i];
          row.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { o[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; M.S.upsert('reports', r); if (el.type === 'checkbox') drawOb(); });
          const d = row.querySelector('[data-del]'); if (d) d.onclick = () => { r.obstacles.splice(+row.dataset.i, 1); M.S.upsert('reports', r); drawOb(); };
          const evb = row.querySelector('[data-ev]'); if (evb) evb.onclick = () => { if (!o.desc) return M.toast('Opisz przeszkodę', 'warn'); const ev = M.S.upsert('events', { title: `${o.cause ? o.cause[0].toUpperCase() + o.cause.slice(1) + ': ' : ''}${o.desc}`.slice(0, 140), eventDate: r.date, awareDate: r.date, clause: '', kind: 'czas', notes: `Z raportu dziennego ${M.fmt(r.date)}. Strata: ${o.lost || '?'} h.${o.companyId ? ' Dotyczy: ' + M.S.respName(o.companyId) + '.' : ''}\nPogoda: ${weatherTxt(r.weather)}`, status: 'otwarte', reportId: r.id }); o.eventId = ev.id; M.S.upsert('reports', r); M.toast('Utworzono zdarzenie – uzupełnij subklauzulę w „Terminach umownych”'); M.go('terminy/' + ev.id); };
        });
      };
      drawEq(); drawOb();
      const eqa = v.querySelector('#eqAdd'); if (eqa) eqa.onclick = () => { r.equipment.push({ name: '', n: 1 }); drawEq(); };
      const oba = v.querySelector('#obAdd'); if (oba) oba.onclick = () => { r.obstacles.push({ desc: '', cause: '', lost: '', companyId: '', claim: false }); drawOb(); };
      const cpy = v.querySelector('#cpy'); if (cpy) cpy.onclick = () => {
        const prev = M.S.all('reports').filter(x => x.date < r.date).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (!prev) return M.toast('Brak wcześniejszego raportu', 'warn');
        r.crew = M.clone(prev.crew || []); r.equipment = M.clone(prev.equipment || []); if (prev.hours) { r.hours = prev.hours; v.querySelector('[data-f=hours]').value = prev.hours; }
        M.S.upsert('reports', r); drawCrew(); drawEq(); M.toast(`Skopiowano obsadę, sprzęt i godziny z ${M.fmt(prev.date)} – pogodę pobierz na dziś`);
      };
      v.querySelector('#back').onclick = () => M.go('raporty');
      const ca = v.querySelector('#crewAdd'); if (ca) ca.onclick = () => { r.crew.push({ companyId: '', n: '' }); drawCrew(); };
      const cc = v.querySelector('#crewCopy'); if (cc) cc.onclick = () => { const prev = M.S.all('reports').filter(x => x.date < r.date && (x.crew || []).length).sort((a, b) => b.date.localeCompare(a.date))[0]; if (!prev) return M.toast('Brak wcześniejszego raportu z obsadą', 'warn'); r.crew = M.clone(prev.crew); M.S.upsert('reports', r); drawCrew(); };
      const dict = v.querySelector('#dict'); if (dict) M.UI.dictate(dict, v.querySelector('#notes'));
      const wx = v.querySelector('#wx'); if (wx) wx.onclick = async () => { try { const p = M.S.project; r.weather = await M.fetchWeather(v.querySelector('[data-f=date]').value || r.date, p.lat, p.lon); M.S.upsert('reports', r); this.detail(v, r); M.toast('Pobrano pogodę'); } catch (err) { M.toast(err.message, 'err'); } };
      v.querySelector('#cpEdb').onclick = () => M.copy(v.querySelector('[data-f=edbText]').value, 'Skopiowano – wklej w EDB i sprawdź przed podpisaniem');
      const ai = v.querySelector('#ai'); if (ai) ai.onclick = () => { save(); setTimeout(() => this.ai(v, r), 550); };
      v.querySelector('#pptx').onclick = () => { if (edit) save(); setTimeout(() => M.RPPT.generate(r), 550); };
      v.querySelector('#pdf').onclick = async () => M.PR.print(`Raport dzienny ${M.fmt(r.date)}`, await this.html(r));
    },
    ai(v, r) {
      const p = M.S.project;
      M.AI.open({ key: 'raport', title: 'Asystent AI – raport dzienny', photos: r.photos, photoPrefix: `raport_${r.date}`,
        prompt: M.AI.fill('raport', { PROJEKT: p.name, DATA: M.fmt(r.date), DZIEN: M.weekday(r.date), POGODA: weatherTxt(r.weather), OBSADA: r.crew.map(c => `${M.S.respName(c.companyId)}: ${c.n || '?'} os.`).join('; '), SPRZET: eqTxt(r), PRZESZKODY: obTxt(r), NOTATKI: r.notes, ZDJECIA: M.AI.photoList(r.photos), SZABLON: p.reportTemplate || M.DEMO.REPORT_TEMPLATE }),
        parse: (t) => { const s = M.AI.sections(t); return s.RAPORT ? s : null; },
        preview: (s) => `${M.md(s.RAPORT)}<hr><b>Wpis do EDB:</b><div class="pre" style="white-space:pre-wrap">${e(s['WPIS DO EDB'] || '—')}</div>`,
        applyLabel: 'Wstaw do raportu',
        apply: (s) => { r.aiText = s.RAPORT; r.edbText = s['WPIS DO EDB'] || r.edbText; M.S.upsert('reports', r); this.detail(v, r); } });
    },
    async html(r) {
      return `${M.PR.header('Raport dzienny z budowy', ' – ' + M.fmt(r.date))}
        <table class="kv"><tr><td>Data / dzień</td><td>${M.fmt(r.date)}, ${e(M.weekday(r.date))}</td></tr><tr><td>Godziny pracy</td><td>${e(r.hours || '')}</td></tr><tr><td>Warunki atmosferyczne</td><td>${e(weatherTxt(r.weather))}${r.weather && r.weather.zrodlo ? `<div class="small muted">${e(r.weather.zrodlo)}</div>` : ''}</td></tr><tr><td>Obsada</td><td>${(r.crew || []).map(c => `${e(M.S.respName(c.companyId))}: ${e(c.n)} os.`).join('<br>') || '—'}</td></tr>${eqTxt(r) ? `<tr><td>Sprzęt</td><td>${e(eqTxt(r))}</td></tr>` : ''}</table>
        ${(r.obstacles || []).some(o => o.desc) ? `<h2>Przeszkody i opóźnienia</h2><table><thead><tr><th>Opis</th><th>Przyczyna</th><th>Strata [h]</th><th>Dotyczy</th></tr></thead><tbody>${r.obstacles.filter(o => o.desc).map(o => `<tr><td>${e(o.desc)}</td><td>${e(o.cause || '')}</td><td>${e(o.lost || '')}</td><td>${e(o.companyId ? M.S.respName(o.companyId) : '')}</td></tr>`).join('')}</tbody></table>` : ''}
        ${r.aiText ? `<h2>Przebieg dnia</h2>${M.md(r.aiText)}` : `<h2>Notatki</h2><div class="pre">${e(r.notes || '')}</div>`}
        ${(r.photos || []).length ? `<h2>Dokumentacja fotograficzna</h2>${await M.PR.pics(r.photos, true)}` : ''}
        ${M.PR.sign(['Sporządził', '', 'Kierownik budowy'])}`;
    },
  };
})(window.M);
