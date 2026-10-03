/* =========================================================
   BIURO BUDOWY — Moduły własne (kreator bez programowania)
   Np. „Rejestr dostaw”, „Teczka podwykonawcy”, „Usterki gwarancyjne”, „Lessons learned”.
   Definicja: nazwa + lista pól + kto widzi/edytuje. Dane: tabela „custom”.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const TYPES = [['text', 'Tekst krótki'], ['textarea', 'Tekst długi'], ['date', 'Data'], ['number', 'Liczba'], ['select', 'Lista wyboru'], ['resp', 'Firma / odpowiedzialny'], ['check', 'Tak / nie'], ['photos', 'Zdjęcia']];
  const cfgOf = (id) => (M.S.settings.customModules || []).find(c => c.id === id);
  const val = (f, r) => { const x = (r.values || {})[f.key]; if (f.type === 'date') return M.fmt(x); if (f.type === 'resp') return M.S.respName(x); if (f.type === 'check') return x ? 'tak' : ''; if (f.type === 'photos') return (x || []).length ? (x || []).length + ' zdj.' : ''; return x ?? ''; };

  M.modules.wlasne = {
    title: 'Moduł własny', hidden: true,
    today() {
      const out = []; const t = M.todayISO();
      (M.S.settings.customModules || []).filter(c => c.enabled !== false && M.P.canView(c.id)).forEach(c => {
        const df = (c.fields || []).find(f => f.type === 'date' && f.deadline); if (!df) return;
        M.S.all('custom').filter(r => r.moduleId === c.id && !r.done).forEach(r => { const d = (r.values || {})[df.key]; const n = d ? M.diffDays(t, d) : null; if (n != null && n <= 3) out.push({ lvl: n < 0 ? 'red' : 'yel', icon: c.icon || 'grid', t: `${c.name}: ${val(c.fields[0], r)}`, d: `${df.label}: ${M.fmt(d)}`, go: 'wlasny/' + c.id }); });
      });
      return out;
    },
    render(v, rest) {
      const c = cfgOf(rest[0]); if (!c) { v.innerHTML = M.UI.empty('Nie znaleziono modułu.'); return; }
      if (!M.S.project) { v.innerHTML = M.UI.noProject(); return; }
      const edit = M.P.canEdit(c.id); const list = M.S.all('custom').filter(r => r.moduleId === c.id).sort((a, b) => (b.created || 0) - (a.created || 0));
      const cols = (c.fields || []).filter(f => f.type !== 'textarea' && f.type !== 'photos').slice(0, 6);
      v.innerHTML = M.UI.head(e(c.name), e(c.desc || 'Moduł własny'), `<button class="btn" id="xls">${M.icon.xlsx}Excel</button><button class="btn" id="pr">${M.icon.print}Druk</button>${edit ? `<button class="btn primary" id="add">${M.icon.plus}Dodaj</button>` : ''}`) + M.UI.readonlyBanner(c.id) +
        `<div class="card">${list.length ? `<div class="table-wrap"><table class="list"><thead><tr>${cols.map(f => `<th>${e(f.label)}</th>`).join('')}<th>Zakończone</th></tr></thead><tbody>${list.map(r => `<tr class="click" data-id="${r.id}" style="${r.done ? 'opacity:.55' : ''}">${cols.map(f => `<td>${e(val(f, r))}</td>`).join('')}<td>${r.done ? '✓' : ''}</td></tr>`).join('')}</tbody></table></div>` : M.UI.empty('Brak wpisów.', c.icon || 'grid')}</div>`;
      v.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => this.form(c, M.S.get('custom', tr.dataset.id)));
      const a = v.querySelector('#add'); if (a) a.onclick = () => this.form(c, { moduleId: c.id, values: {} });
      v.querySelector('#xls').onclick = async () => { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(c.name.slice(0, 30)); ws.addRow([...c.fields.map(f => f.label), 'Zakończone']).font = { bold: true }; list.forEach(r => ws.addRow([...c.fields.map(f => val(f, r)), r.done ? 'tak' : ''])); M.download(new Blob([await wb.xlsx.writeBuffer()]), M.safeName(c.name) + '.xlsx'); };
      v.querySelector('#pr').onclick = () => M.PR.print(c.name, `${M.PR.header(c.name, '')}<table><thead><tr>${c.fields.filter(f => f.type !== 'photos').map(f => `<th>${e(f.label)}</th>`).join('')}</tr></thead><tbody>${list.map(r => `<tr>${c.fields.filter(f => f.type !== 'photos').map(f => `<td class="pre">${e(val(f, r))}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    },
    form(c, r) {
      const edit = M.P.canEdit(c.id); const isNew = !r.id; r.values = r.values || {};
      const field = (f) => { const x = r.values[f.key] ?? ''; const dis = edit ? '' : 'disabled';
        if (f.type === 'textarea') return `<label class="f">${e(f.label)}<textarea data-v="${f.key}" rows="4" ${dis}>${e(x)}</textarea></label>`;
        if (f.type === 'select') return `<label class="f">${e(f.label)}<select data-v="${f.key}" ${dis}>${M.UI.opts(f.options || [], x, '—')}</select></label>`;
        if (f.type === 'resp') return `<label class="f">${e(f.label)}<select data-v="${f.key}" ${dis}>${M.UI.respOpts(x, '—')}</select></label>`;
        if (f.type === 'check') return `<label class="check"><input type="checkbox" data-v="${f.key}" ${x ? 'checked' : ''} ${dis}>${e(f.label)}</label>`;
        if (f.type === 'photos') return `<div><div class="small" style="font-weight:700">${e(f.label)}</div><div data-ph="${f.key}"></div></div>`;
        return `<label class="f">${e(f.label)}<input type="${f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}" data-v="${f.key}" value="${e(x)}" ${dis}></label>`; };
      const d = M.UI.drawer({ title: isNew ? 'Nowy wpis – ' + e(c.name) : e(c.name), body: c.fields.map(field).join('') + `<label class="check"><input type="checkbox" id="done" ${r.done ? 'checked' : ''} ${edit ? '' : 'disabled'}>Zakończone / zamknięte</label>`,
        footer: edit ? `${!isNew ? `<button class="btn danger" id="del">${M.icon.trash}</button>` : ''}<span class="grow"></span><button class="btn primary" id="ok">Zapisz</button>` : '' });
      c.fields.filter(f => f.type === 'photos').forEach(f => { r.values[f.key] = r.values[f.key] || []; M.UI.photos(d.querySelector(`[data-ph="${f.key}"]`), r.values[f.key], { editable: edit }); });
      if (!edit) return;
      d.querySelector('#ok').onclick = () => { d.querySelectorAll('[data-v]').forEach(el => r.values[el.dataset.v] = el.type === 'checkbox' ? el.checked : el.value); r.done = d.querySelector('#done').checked; M.S.upsert('custom', r); d.close(); M.render(); };
      const del = d.querySelector('#del'); if (del) del.onclick = async () => { if (await M.UI.confirm('Usunąć wpis?', 'Usuń', true)) { M.S.remove('custom', r.id); d.close(); M.render(); } };
    },

    /** kreator / edycja definicji modułu */
    builder(cfg, onDone) {
      const isNew = !cfg; cfg = cfg ? M.clone(cfg) : { id: 'm' + M.uid(), name: '', desc: '', icon: 'grid', enabled: true, fields: [{ key: 'f1', label: 'Nazwa', type: 'text' }, { key: 'f2', label: 'Odpowiedzialny', type: 'resp' }, { key: 'f3', label: 'Termin', type: 'date', deadline: true }, { key: 'f4', label: 'Opis', type: 'textarea' }], view: [...M.P.ALL], edit: [...M.P.STAFF] };
      const ICONS = ['grid', 'report', 'cube', 'flag', 'cal', 'users', 'shield', 'doc', 'layers', 'camera', 'clock', 'leaf'];
      const m = M.UI.modal({ title: isNew ? 'Nowy moduł' : 'Edycja modułu', wide: true, body: `
        <div class="grid2"><label class="f req"><span>Nazwa modułu</span><input type="text" id="n" value="${e(cfg.name)}" placeholder="np. Rejestr dostaw"></label><label class="f">Krótki opis (na kafelku)<input type="text" id="d" value="${e(cfg.desc)}"></label></div>
        <div><div class="small" style="font-weight:700">Ikona</div><div class="chips" id="ic">${ICONS.map(i => `<button class="chip ${cfg.icon === i ? 'on' : ''}" data-i="${i}" title="${i}">${M.icon[i].replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')}</button>`).join('')}</div></div>
        <div class="fieldset"><legend>Pola (pierwsze pole = nazwa wpisu)</legend><div id="fl"></div><button class="btn sm" id="addF" style="margin-top:6px">${M.icon.plus}Pole</button></div>
        <div class="grid2"><div><div class="small" style="font-weight:700">Kto widzi</div><div class="chips" id="rv">${Object.keys(M.P.ROLES).map(r => `<button class="chip ${cfg.view.includes(r) ? 'on' : ''}" data-r="${r}">${r}</button>`).join('')}</div></div>
        <div><div class="small" style="font-weight:700">Kto edytuje</div><div class="chips" id="re">${Object.keys(M.P.ROLES).map(r => `<button class="chip ${cfg.edit.includes(r) ? 'on' : ''}" data-r="${r}">${r}</button>`).join('')}</div></div></div>`,
        footer: `${!isNew ? `<button class="btn danger" id="del">${M.icon.trash}Usuń moduł</button>` : ''}<span class="grow"></span><button class="btn primary" id="ok">${M.icon.check}Zapisz moduł</button>` });
      const drawF = () => { const box = m.querySelector('#fl'); box.innerHTML = cfg.fields.map((f, i) => `<div class="row" data-i="${i}" style="margin-bottom:6px"><input type="text" data-k="label" value="${e(f.label)}" style="flex:2" placeholder="Nazwa pola"><select data-k="type" style="flex:1">${M.UI.opts(TYPES, f.type)}</select>${f.type === 'select' ? `<input type="text" data-k="options" value="${e((f.options || []).join('; '))}" placeholder="opcje; rozdzielone; średnikiem" style="flex:2">` : ''}${f.type === 'date' ? `<label class="check small"><input type="checkbox" data-k="deadline" ${f.deadline ? 'checked' : ''}>pilnuj terminu</label>` : ''}<button class="btn icon ghost sm" data-up>↑</button><button class="btn icon ghost sm" data-del>${M.icon.x}</button></div>`).join('');
        box.querySelectorAll('[data-i]').forEach(row => { const f = cfg.fields[+row.dataset.i];
          row.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { if (el.dataset.k === 'options') f.options = el.value.split(';').map(s => s.trim()).filter(Boolean); else if (el.type === 'checkbox') f[el.dataset.k] = el.checked; else f[el.dataset.k] = el.value; if (el.dataset.k === 'type') drawF(); });
          row.querySelector('[data-del]').onclick = () => { cfg.fields.splice(+row.dataset.i, 1); drawF(); };
          row.querySelector('[data-up]').onclick = () => { const i = +row.dataset.i; if (i > 0) { [cfg.fields[i - 1], cfg.fields[i]] = [cfg.fields[i], cfg.fields[i - 1]]; drawF(); } }; }); };
      drawF();
      m.querySelector('#addF').onclick = () => { cfg.fields.push({ key: 'f' + M.uid().slice(-5), label: '', type: 'text' }); drawF(); };
      m.querySelectorAll('#ic .chip').forEach(b => b.onclick = () => { cfg.icon = b.dataset.i; m.querySelectorAll('#ic .chip').forEach(x => x.classList.toggle('on', x === b)); });
      const roles = (sel, key) => m.querySelectorAll(sel + ' .chip').forEach(b => b.onclick = () => { const r = b.dataset.r; cfg[key] = cfg[key].includes(r) ? cfg[key].filter(x => x !== r) : [...cfg[key], r]; b.classList.toggle('on'); });
      roles('#rv', 'view'); roles('#re', 'edit');
      m.querySelector('#ok').onclick = () => {
        cfg.name = m.querySelector('#n').value.trim(); cfg.desc = m.querySelector('#d').value.trim();
        cfg.fields = cfg.fields.filter(f => f.label.trim());
        if (!cfg.name || !cfg.fields.length) return M.toast('Podaj nazwę i co najmniej jedno pole', 'warn');
        const list = (M.S.settings.customModules || []).filter(c => c.id !== cfg.id); list.push(cfg); M.S.set('customModules', list); m.close(); M.toast('Moduł zapisany – jest na pulpicie'); onDone && onDone();
      };
      const del = m.querySelector('#del'); if (del) del.onclick = async () => { const n = M.S.all('custom', true).filter(r => r.moduleId === cfg.id).length; if (await M.UI.confirm(`Usunąć moduł „${e(cfg.name)}”${n ? ` i ${n} wpisów` : ''}?`, 'Usuń', true)) { M.S.db.custom = M.S.db.custom.filter(r => r.moduleId !== cfg.id); M.S.set('customModules', (M.S.settings.customModules || []).filter(c => c.id !== cfg.id)); m.close(); onDone && onDone(); } };
    },
  };
  M.CUSTOM_PRESETS = [
    { name: 'Rejestr dostaw', desc: 'Awizacje, okna rozładunku, dokumenty WZ', icon: 'cube', fields: [{ key: 'f1', label: 'Dostawa (materiał)', type: 'text' }, { key: 'f2', label: 'Dostawca / firma', type: 'resp' }, { key: 'f3', label: 'Data dostawy', type: 'date', deadline: true }, { key: 'f4', label: 'Godzina / okno', type: 'text' }, { key: 'f5', label: 'Strefa rozładunku', type: 'select', options: ['Brama 1', 'Brama 2', 'Plac A', 'Plac B'] }, { key: 'f6', label: 'Dźwig / sprzęt potrzebny', type: 'check' }, { key: 'f7', label: 'Uwagi, nr WZ', type: 'textarea' }, { key: 'f8', label: 'Zdjęcia dostawy', type: 'photos' }] },
    { name: 'Teczka podwykonawcy', desc: 'Dokumenty firm i daty ważności (OC, BHP, uprawnienia)', icon: 'shield', fields: [{ key: 'f1', label: 'Dokument', type: 'text' }, { key: 'f2', label: 'Firma', type: 'resp' }, { key: 'f3', label: 'Ważny do', type: 'date', deadline: true }, { key: 'f4', label: 'Rodzaj', type: 'select', options: ['Umowa', 'Polisa OC', 'Szkolenia BHP', 'Badania lekarskie', 'Uprawnienia', 'Oświadczenie o zapłacie dalszym podwykonawcom', 'Inne'] }, { key: 'f5', label: 'Uwagi', type: 'textarea' }] },
    { name: 'Lessons learned', desc: 'Problemy i rozwiązania do kolejnych budów', icon: 'doc', fields: [{ key: 'f1', label: 'Temat', type: 'text' }, { key: 'f2', label: 'Branża', type: 'select', options: ['Konstrukcja', 'Posadzka', 'Obudowa', 'Instalacje', 'Doki / bramy', 'Ppoż.', 'Drogi', 'Formalności'] }, { key: 'f3', label: 'Problem', type: 'textarea' }, { key: 'f4', label: 'Rozwiązanie / zalecenie', type: 'textarea' }] },
  ];
})(window.M);
