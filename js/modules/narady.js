/* =========================================================
   BIURO BUDOWY — Narady budowlane
   Draft protokołu (porządek z szablonu budowy) → ustalenia z odpowiedzialnym i terminem →
   sprawy otwarte same przechodzą na kolejną naradę. AI: z notatek / dyktowania → protokół.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const IT_ST = { otwarte: ['Otwarte', 'open'], zamkniete: ['Zamknięte', 'done'] };
  M.matchCompany = (txt) => {
    const n = M.norm(txt); if (!n) return '';
    const cs = M.S.companies(); let best = cs.find(c => M.norm(c.name) === n) || cs.find(c => n.includes(M.norm(c.name)) || M.norm(c.name).includes(n));
    if (!best) best = cs.find(c => M.norm(c.name).split(' ').filter(w => w.length > 3).some(w => n.includes(w)));
    return best ? best.id : '';
  };
  /** wszystkie otwarte ustalenia z narad wcześniejszych niż data */
  const carried = (before, exceptId) => {
    const out = [];
    M.S.all('meetings').filter(m => m.id !== exceptId && (m.date || '') <= (before || '9999')).forEach(m => (m.items || []).forEach(it => { if (it.status === 'otwarte') out.push({ m, it }); }));
    return out.sort((a, b) => (a.m.date || '').localeCompare(b.m.date || ''));
  };

  M.modules.narady = {
    title: 'Narady budowlane', icon: 'users', order: 3,
    desc: 'Protokół z draftu, ustalenia z terminami, sprawy otwarte przechodzą dalej. AI z notatek lub nagrania.',
    today() {
      const t = M.todayISO(); const out = [];
      M.S.all('meetings').forEach(m => (m.items || []).forEach(it => { if (it.status === 'otwarte' && it.due && it.due < t && M.P.seesRecord(it)) out.push({ lvl: 'yel', icon: 'users', t: `Ustalenie z narady ${m.nr} po terminie`, d: `${M.S.respName(it.respId)} · ${it.text.slice(0, 90)}`, go: 'narady/' + m.id, sort: M.diffDays(t, it.due) }); }));
      return out;
    },
    render(v, rest) {
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      if (rest[0]) { const m = M.S.get('meetings', rest[0]); if (m) return this.detail(v, m); }
      const list = M.S.all('meetings').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const edit = M.P.canEdit('narady');
      v.innerHTML = M.UI.head('Narady <span class="acc">budowlane</span>', 'Każda narada: porządek z szablonu budowy, ustalenia z odpowiedzialnym i terminem.', edit ? `<button class="btn primary" id="new">${M.icon.plus}Nowa narada</button>` : '') + M.UI.readonlyBanner('narady') +
        `<div class="card">${list.length ? `<div class="table-wrap"><table class="list"><thead><tr><th>Nr</th><th>Data</th><th class="hide-m">Miejsce</th><th>Ustalenia</th><th>Otwarte</th><th>Status</th></tr></thead><tbody>${list.map(m => { const its = (m.items || []).filter(it => M.P.seesRecord(it) || M.P.isStaff()); return `<tr class="click" data-id="${m.id}"><td class="num">${e(m.nr)}</td><td>${M.fmt(m.date)} ${e(m.time || '')}</td><td class="hide-m small">${e(m.place || '')}</td><td>${its.length}</td><td>${its.filter(i => i.status === 'otwarte').length}</td><td>${m.status === 'zatwierdzony' ? '<span class="st done">Zatwierdzony</span>' : '<span class="st check">Szkic</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : M.UI.empty('Brak narad. Utwórz pierwszą – porządek obrad wypełni się z szablonu budowy.', 'users')}</div>`;
      v.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => M.go('narady/' + tr.dataset.id));
      const nb = v.querySelector('#new'); if (nb) nb.onclick = () => {
        const p = M.S.project; const prev = list[0];
        const m = M.S.upsert('meetings', { nr: M.S.nextNr('meetings', 'N', 2), date: M.todayISO(), time: '10:00', place: prev ? prev.place : 'Biuro budowy', participants: prev ? prev.participants : '', agenda: p.meetingAgenda || M.DEMO.MEETING_AGENDA, notes: '', summary: '', items: [], status: 'szkic' });
        M.go('narady/' + m.id);
      };
    },
    detail(v, mtg) {
      const edit = M.P.canEdit('narady');
      const car = carried(mtg.date, mtg.id).filter(x => M.P.isStaff() || M.P.seesRecord(x.it));
      const items = (mtg.items || []).filter(it => M.P.isStaff() || M.P.seesRecord(it));
      v.innerHTML = `<div class="page-head"><div><h1>Narada ${e(mtg.nr)} <span class="acc">${M.fmt(mtg.date)}</span></h1><div class="sub">${mtg.status === 'zatwierdzony' ? 'Protokół zatwierdzony' : 'Szkic protokołu – uzupełniaj w trakcie narady'}</div></div>
        <div class="actions"><button class="btn ghost" id="back">${M.icon.back}Lista</button>${edit ? `<button class="btn soft" id="ai">${M.icon.spark}AI: protokół z notatek</button>` : ''}<button class="btn" id="mail">${M.icon.mail}Wyślij</button><button class="btn primary" id="pdf">${M.icon.print}Protokół PDF</button></div></div>
        ${M.UI.readonlyBanner('narady')}
        <div class="grid2" style="align-items:start">
          <div class="col">
            <div class="card card-pad col" id="hdr">
              <div class="grid3"><label class="f">Data<input type="date" data-f="date" value="${e(mtg.date)}"></label><label class="f">Godzina<input type="time" data-f="time" value="${e(mtg.time || '')}"></label><label class="f">Status<select data-f="status">${M.UI.opts([['szkic', 'Szkic'], ['zatwierdzony', 'Zatwierdzony']], mtg.status)}</select></label></div>
              <label class="f">Miejsce<input type="text" data-f="place" value="${e(mtg.place || '')}"></label>
              <label class="f">Uczestnicy <span class="hint">(firma – osoba/rola; jedna linia lub średniki)</span><textarea data-f="participants" rows="3">${e(mtg.participants || '')}</textarea></label>
              <label class="f">Porządek narady (draft)<textarea data-f="agenda" rows="6">${e(mtg.agenda || '')}</textarea></label>
            </div>
            <div class="card card-pad col">
              <div class="row"><h2 class="grow">Notatki / transkrypcja</h2>${edit ? `<button class="btn sm" id="dict">${M.icon.mic}Dyktuj</button><button class="btn sm" id="rec">${M.icon.mic}Nagraj naradę</button>` : ''}</div>
              <textarea data-f="notes" id="notes" rows="8" placeholder="Zapisuj na bieżąco albo podyktuj po naradzie. Z tego AI zrobi protokół.">${e(mtg.notes || '')}</textarea>
              ${mtg.audio ? `<div class="row small"><span class="badge">${M.icon.mic.replace('<svg', '<svg style="width:12px"')} nagranie ${Math.round((mtg.audio.sec || 0) / 60)} min</span><button class="btn sm" id="audDl">${M.icon.download}Pobierz nagranie</button><span class="muted">→ transkrypcję wklej powyżej</span></div>` : ''}
              <label class="f">Podsumowanie<textarea data-f="summary" rows="3">${e(mtg.summary || '')}</textarea></label>
            </div>
          </div>
          <div class="col">
            <div class="card"><div class="card-head"><h2>Sprawy otwarte z poprzednich narad</h2><span class="badge ${car.length ? 'or' : ''}">${car.length}</span></div>
              ${car.length ? `<table class="list"><tbody>${car.map(({ m, it }) => `<tr><td class="num">${e(m.nr)}</td><td>${e(it.text)}<div class="xs muted">${e(M.S.respName(it.respId))}${it.due ? ' · termin ' + M.fmt(it.due) : ''}${it.due && it.due < M.todayISO() ? ' <b style="color:var(--danger)">po terminie</b>' : ''}</div></td><td style="text-align:right">${edit ? `<button class="btn sm" data-close="${m.id}|${it.id}">${M.icon.check}Zamknij</button>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div class="card-pad small muted">Brak spraw otwartych.</div>`}
            </div>
            <div class="card"><div class="card-head"><h2>Ustalenia tej narady</h2>${edit ? `<button class="btn sm primary" id="addIt">${M.icon.plus}Ustalenie</button>` : ''}</div>
              <div id="items"></div></div>
          </div>
        </div>`;
      const hdr = v.querySelector('.grid2');
      const save = M.debounce(() => { Object.assign(mtg, M.UI.read(hdr)); M.S.upsert('meetings', mtg); }, 500);
      if (edit) hdr.querySelectorAll('[data-f]').forEach(el => el.addEventListener('input', save)); else M.UI.lockForm(hdr, true);
      const drawItems = () => {
        const box = v.querySelector('#items'); const its = (mtg.items || []).filter(it => M.P.isStaff() || M.P.seesRecord(it));
        if (!its.length) { box.innerHTML = `<div class="card-pad small muted">Brak ustaleń. ${edit ? 'Dodaj ręcznie albo użyj AI.' : ''}</div>`; return; }
        box.innerHTML = `<table class="list"><tbody>${its.map((it, i) => `<tr data-i="${mtg.items.indexOf(it)}"><td class="num">${i + 1}.</td><td style="min-width:200px"><textarea data-k="text" rows="2" ${edit ? '' : 'disabled'}>${e(it.text)}</textarea><div class="row" style="margin-top:4px"><select data-k="respId" style="flex:1" ${edit ? '' : 'disabled'}>${M.UI.respOpts(it.respId, '— odpowiedzialny —')}</select><input type="date" data-k="due" value="${e(it.due || '')}" style="width:150px" ${edit ? '' : 'disabled'}><select data-k="status" style="width:120px" ${edit ? '' : 'disabled'}>${M.UI.opts(Object.entries(IT_ST).map(([k, [l]]) => [k, l]), it.status)}</select>${edit ? `<button class="btn icon ghost sm" data-del title="Usuń">${M.icon.trash}</button>` : ''}</div></td></tr>`).join('')}</tbody></table>`;
        if (!edit) return;
        box.querySelectorAll('tr[data-i]').forEach(tr => { const it = mtg.items[+tr.dataset.i];
          tr.querySelectorAll('[data-k]').forEach(el => el.addEventListener('change', () => { it[el.dataset.k] = el.value; M.S.upsert('meetings', mtg); }));
          tr.querySelector('[data-k=text]').addEventListener('input', M.debounce(ev => { it.text = ev.target.value; M.S.upsert('meetings', mtg); }, 400));
          tr.querySelector('[data-del]').onclick = () => { mtg.items.splice(+tr.dataset.i, 1); M.S.upsert('meetings', mtg); drawItems(); };
        });
      };
      drawItems();
      v.querySelector('#back').onclick = () => M.go('narady');
      const addIt = v.querySelector('#addIt'); if (addIt) addIt.onclick = () => { (mtg.items = mtg.items || []).push({ id: M.uid(), text: '', respId: '', due: M.addDays(M.todayISO(), 7), status: 'otwarte' }); M.S.upsert('meetings', mtg); drawItems(); v.querySelector('#items tr:last-child textarea').focus(); };
      v.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { const [mid, iid] = b.dataset.close.split('|'); const om = M.S.get('meetings', mid); const it = om.items.find(x => x.id === iid); it.status = 'zamkniete'; it.closedIn = mtg.nr; M.S.upsert('meetings', om); M.toast('Zamknięto sprawę'); this.detail(v, mtg); });
      const dict = v.querySelector('#dict'); if (dict) M.UI.dictate(dict, v.querySelector('#notes'));
      const rec = v.querySelector('#rec'); if (rec) M.UI.recorder(rec, async (blob, sec) => { mtg.audio = { blobId: await M.S.putBlob(blob, { name: 'narada.webm' }), sec }; M.S.upsert('meetings', mtg); M.toast('Nagranie zapisane'); this.detail(v, mtg); });
      const ad = v.querySelector('#audDl'); if (ad) ad.onclick = async () => M.download(await M.S.getBlob(mtg.audio.blobId), `Narada_${mtg.nr}_${mtg.date}.webm`);
      const ai = v.querySelector('#ai'); if (ai) ai.onclick = () => this.ai(v, mtg);
      v.querySelector('#pdf').onclick = () => M.PR.print(`Protokół z narady ${mtg.nr}`, this.html(mtg));
      v.querySelector('#mail').onclick = () => {
        const emails = [...new Set((mtg.items || []).map(it => (M.S.company(it.respId) || {}).email).filter(Boolean))];
        const body = `Dzień dobry,\n\nw załączeniu protokół z narady ${mtg.nr} z dnia ${M.fmt(mtg.date)} (budowa: ${M.S.project.name}).\n\nUstalenia:\n${(mtg.items || []).map((it, i) => `${i + 1}. ${it.text} – ${M.S.respName(it.respId)}${it.due ? ', termin ' + M.fmt(it.due) : ''}`).join('\n')}\n\nProszę o ewentualne uwagi do protokołu w ciągu 3 dni roboczych.\n\n${M.S.settings.mailSignature || ''}`;
        M.ML.mailto({ to: emails.join(','), subject: `[${M.S.project.short || M.S.project.name}] Protokół z narady ${mtg.nr} – ${M.fmt(mtg.date)}`, body });
        M.toast('Dołącz PDF protokołu (przycisk „Protokół PDF” → Zapisz jako PDF)');
      };
    },
    ai(v, mtg) {
      const car = carried(mtg.date, mtg.id);
      M.AI.open({ key: 'narada', title: 'Asystent AI – protokół z narady',
        prompt: M.AI.fill('narada', { PROJEKT: M.S.project.name, NR: mtg.nr, DATA: M.fmt(mtg.date), MIEJSCE: mtg.place, UCZESTNICY: mtg.participants, PORZADEK: mtg.agenda, OTWARTE: car.map(({ m, it }) => `  [${m.nr}] ${it.text} – ${M.S.respName(it.respId)}${it.due ? ', termin ' + M.fmt(it.due) : ''}`).join('\n') || '  brak', NOTATKI: mtg.notes, FIRMY: M.S.responsibles().map(c => c.name).join('; ') }),
        parse: (t) => { const j = M.extractJSON(t); return j && (j.ustalenia || j.podsumowanie) ? j : null; },
        preview: (j) => `<b>Podsumowanie:</b><p>${e(j.podsumowanie || '')}</p><b>Ustalenia (${(j.ustalenia || []).length}):</b><ul>${(j.ustalenia || []).map(u => `<li>${e(u.tresc)} – <i>${e(u.odpowiedzialny || '?')}</i>${M.matchCompany(u.odpowiedzialny) ? ' ✓' : ' <span style="color:#975A16">(nie dopasowano firmy)</span>'}${u.termin ? ', ' + e(u.termin) : ''}</li>`).join('')}</ul>${(j.zamkniete || []).length ? `<b>Do zamknięcia:</b><ul>${j.zamkniete.map(z => `<li>${e(z)}</li>`).join('')}</ul>` : ''}`,
        applyLabel: 'Dodaj do protokołu',
        apply: (j) => {
          if (j.podsumowanie) mtg.summary = j.podsumowanie + (j.sprawy_rozne ? '\n\nSprawy różne: ' + j.sprawy_rozne : '');
          (j.ustalenia || []).forEach(u => (mtg.items = mtg.items || []).push({ id: M.uid(), text: u.tresc || '', respId: M.matchCompany(u.odpowiedzialny), respTxt: u.odpowiedzialny || '', due: M.parseDate(u.termin), status: 'otwarte' }));
          (j.zamkniete || []).forEach(z => { const n = M.norm(z); const hit = car.find(({ it }) => n && (M.norm(it.text).includes(n) || n.includes(M.norm(it.text).slice(0, 40)))); if (hit) { hit.it.status = 'zamkniete'; hit.it.closedIn = mtg.nr; M.S.upsert('meetings', hit.m, true); } });
          M.S.upsert('meetings', mtg); this.detail(v, mtg);
        } });
    },
    html(mtg) {
      const car = carried(mtg.date, mtg.id);
      const closedHere = []; M.S.all('meetings').forEach(m => (m.items || []).forEach(it => { if (it.closedIn === mtg.nr) closedHere.push({ m, it }); }));
      return `${M.PR.header(`Protokół z narady koordynacyjnej nr ${mtg.nr}`, '')}
        <table class="kv"><tr><td>Data i godzina</td><td>${M.fmt(mtg.date)} ${e(mtg.time || '')}</td></tr><tr><td>Miejsce</td><td>${e(mtg.place || '')}</td></tr><tr><td>Uczestnicy</td><td class="pre">${e(mtg.participants || '')}</td></tr></table>
        <h2>Porządek narady</h2><div class="pre">${e(mtg.agenda || '')}</div>
        ${mtg.summary ? `<h2>Podsumowanie</h2><div class="pre">${e(mtg.summary)}</div>` : ''}
        <h2>Ustalenia</h2><table><thead><tr><th>Lp.</th><th>Ustalenie</th><th>Odpowiedzialny</th><th>Termin</th><th>Status</th></tr></thead><tbody>${(mtg.items || []).map((it, i) => `<tr><td>${i + 1}</td><td>${e(it.text)}</td><td>${e(it.respId ? M.S.respName(it.respId) : it.respTxt || '')}</td><td>${M.fmt(it.due)}</td><td>${e(IT_ST[it.status][0])}</td></tr>`).join('') || '<tr><td colspan="5">—</td></tr>'}</tbody></table>
        <h2>Sprawy otwarte z poprzednich narad</h2><table><thead><tr><th>Narada</th><th>Sprawa</th><th>Odpowiedzialny</th><th>Termin</th></tr></thead><tbody>${car.map(({ m, it }) => `<tr><td>${e(m.nr)}</td><td>${e(it.text)}</td><td>${e(M.S.respName(it.respId))}</td><td>${M.fmt(it.due)}</td></tr>`).join('') || '<tr><td colspan="4">brak</td></tr>'}</tbody></table>
        ${closedHere.length ? `<h2>Sprawy zamknięte na tej naradzie</h2><ul>${closedHere.map(({ m, it }) => `<li>[${e(m.nr)}] ${e(it.text)}</li>`).join('')}</ul>` : ''}
        <p class="small muted" style="margin-top:6mm">Uwagi do protokołu należy zgłosić w ciągu 3 dni roboczych od jego otrzymania; po tym terminie protokół uznaje się za przyjęty.</p>
        ${M.PR.sign(['Sporządził', 'Kierownik budowy', 'Przedstawiciel Inwestora'])}`;
    },
  };
})(window.M);
