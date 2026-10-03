/* =========================================================
   TEK-BIURO BUDOWY — Raport z budowy jako prezentacja w szablonie PowerPoint budowy
   Szablon (.pptx/.potx) wgrywasz raz dla każdej budowy. Aplikacja zapamiętuje, w które
   pola/kształty wpisać dane (mapa pól). Mapę ustalasz ręcznie albo proponuje ją AI.
   Potem każdy raport dzienny → jeden klik „Prezentacja PPTX”.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;

  M.AI.DEFAULTS.pptx = { name: 'Szablon PowerPoint – dopasowanie pól', text: `Jesteś asystentem kierownika budowy. Mam firmowy szablon prezentacji PowerPoint dla raportu dziennego z budowy.
Poniżej struktura szablonu: slajdy i kształty z tekstem (id kształtu, nazwa, typ pola układu, obecny tekst).
Przypisz do kształtów pola danych raportu tak, żeby powstała czytelna prezentacja zgodna z intencją szablonu.
Zasady:
- Tytuły slajdów i stałe napisy (logo, nazwa firmy, stopka) zostaw bez zmian – nie przypisuj im pól.
- Każde pole użyj najwyżej raz, chyba że szablon ewidentnie tego wymaga (np. nazwa budowy w stopce kilku slajdów).
- Jeden kształt = jedno pole. Duże pola tekstowe przeznacz na RAPORT albo pojedyncze SEKCJE.
- Dokładnie jeden kształt (największy pusty obszar na slajdzie „zdjęcia/dokumentacja fotograficzna”, a jeśli takiego slajdu nie ma – na ostatnim slajdzie z treścią) oznacz polem ZDJECIA. Ten slajd będzie powielany, jeśli zdjęć jest więcej.

DOSTĘPNE POLA:
{{POLA}}

STRUKTURA SZABLONU:
{{STRUKTURA}}

Zwróć JEDEN blok \`\`\`json – tablicę przypisań:
[{"slajd": 1, "id": "3", "pole": "DATA"}]` };

  /** pola sekcji wg tekstowego szablonu raportu budowy */
  const sectionFields = (p) => (p.reportTemplate || M.DEMO.REPORT_TEMPLATE).split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => ['SEKCJA_' + (i + 1), 'Sekcja: ' + l.replace(/^\d+[.)]\s*/, '').slice(0, 50)]);
  const allFields = (p) => [...M.PPT.FIELDS, ...sectionFields(p)];
  /** podział treści raportu (wynik AI) na sekcje 1..n wg nagłówków „1. …”, „## 2. …” */
  M.reportSections = (text, n) => {
    const lines = String(text || '').split('\n'); const pos = [];
    for (let i = 1; i <= n; i++) pos[i] = lines.findIndex(l => new RegExp('^\\s*(#{1,4}\\s*)?(\\*\\*)?\\s*' + i + '[.)]\\s').test(l));
    const out = {};
    for (let i = 1; i <= n; i++) { if (pos[i] < 0) { out[i] = ''; continue; } const nexts = pos.slice(i + 1).filter(x => x > pos[i]); const end = nexts.length ? Math.min(...nexts) : lines.length; out[i] = lines.slice(pos[i] + 1, end).join('\n').trim(); }
    return out;
  };

  const R = M.RPPT = {};
  R.cfg = () => M.S.project.pptTpl || null;

  /** okno: szablon PowerPoint tej budowy */
  R.editor = () => {
    const p = M.S.project; const ed = M.P.canEdit('ustawienia'); const c = R.cfg();
    const fields = allFields(p);
    const m = M.UI.modal({ title: 'Szablon PowerPoint – ' + e(p.short || p.name), wide: true, body: `
      <div class="banner info">${M.icon.report}<span class="small">Każda budowa może mieć własny szablon prezentacji (.pptx lub .potx). Są dwa sposoby: <b>(1)</b> wpisz w szablonie pola, np. <span class="mono">{{DATA}}</span>, <span class="mono">{{POGODA}}</span>, <span class="mono">{{RAPORT}}</span>, <span class="mono">{{SEKCJA_3}}</span>, <span class="mono">{{ZDJECIA}}</span> – działa bez AI; <b>(2)</b> wgraj szablon firmowy bez zmian, a AI (albo Ty) przypisze pola do kształtów – raz na budowę.</span></div>
      <div class="row">${c ? `<span class="badge ok">${M.icon.check.replace('<svg', '<svg style="width:12px"')} ${e(c.name)}</span><span class="small muted">${c.analysis.slides.length} slajdów · pola w szablonie: ${c.analysis.fields.length ? e(c.analysis.fields.join(', ')) : 'brak'} · przypisań: ${(c.map || []).filter(x => x.pole && x.pole !== '-').length}</span>` : '<span class="small muted">Brak szablonu – raport PPTX powstanie z szablonu przykładowego.</span>'}</div>
      ${ed ? `<div class="row"><button class="btn primary" id="up">${M.icon.upload}${c ? 'Wgraj nowy szablon' : 'Wgraj szablon (.pptx/.potx)'}</button><button class="btn" id="smp">${M.icon.download}Pobierz szablon przykładowy z polami</button>${c ? `<button class="btn" id="dl">${M.icon.download}Pobierz obecny</button><button class="btn danger" id="rm">${M.icon.trash}Usuń</button>` : ''}</div>` : ''}
      ${c ? `<div class="grid2" style="grid-template-columns:auto auto 1fr"><label class="f">Zdjęć na slajd<select id="per">${M.UI.opts([1, 2, 4, 6], c.perSlide || 2)}</select></label><label class="check" style="margin-top:18px"><input type="checkbox" id="cap" ${c.captions !== false ? 'checked' : ''}>Podpisy pod zdjęciami</label><span></span></div>
      <div class="card"><div class="card-head"><h2>Mapa pól (kształty bez pól {{…}})</h2>${ed ? `<button class="btn sm soft" id="ai">${M.icon.spark}AI: dopasuj pola</button><button class="btn sm ghost" id="clr">Wyczyść</button>` : ''}</div>
        <div class="table-wrap" style="max-height:44vh"><table class="list"><thead><tr><th>Slajd</th><th>Kształt</th><th>Obecny tekst</th><th>Wstaw pole</th></tr></thead><tbody>${c.analysis.slides.map(s => s.shapes.map((sh, i) => { const cur = (c.map || []).find(x => x.slajd === s.n && String(x.id) === String(sh.id)); return `<tr><td class="num">${i === 0 ? s.n : ''}</td><td class="small">${e(sh.name)}${sh.ph ? `<div class="xs muted">pole układu: ${e(sh.ph)}</div>` : ''}</td><td class="small"><div class="clip" style="max-width:320px" title="${e(sh.text)}">${e(sh.text) || '<i class="muted">(pusty)</i>'}</div></td><td><select data-s="${s.n}" data-id="${e(sh.id)}" ${ed ? '' : 'disabled'} style="min-width:220px">${M.UI.opts([['-', '— bez zmian —'], ...fields.map(([k, l]) => [k, l])], cur ? cur.pole : '-')}</select></td></tr>`; }).join('')).join('')}</tbody></table></div></div>` : ''}`,
      footer: c && ed ? `<span class="small muted grow">Zmiany zapisują się od razu.</span><button class="btn" id="test">${M.icon.eye}Próbna prezentacja (ostatni raport)</button>` : '' });
    const save = () => { M.S.upsert('projects', p); };
    const up = m.querySelector('#up'); if (up) up.onclick = async () => {
      const f = await M.pickFile('.pptx,.potx'); if (!f) return;
      try {
        const analysis = await M.PPT.analyze(f);
        if (c && c.blobId) await M.S.delBlob(c.blobId);
        p.pptTpl = { blobId: await M.S.putBlob(f, { name: f.name }), name: f.name, analysis, map: [], perSlide: 2, captions: true, uploaded: Date.now() };
        save(); m.close(); R.editor();
        M.toast(analysis.fields.length ? `Szablon wczytany – znaleziono pola: ${analysis.fields.join(', ')}` : 'Szablon wczytany – brak pól {{…}}: użyj „AI: dopasuj pola” albo przypisz ręcznie', analysis.fields.length ? '' : 'warn');
      } catch (err) { console.error(err); M.toast('Nie wczytano szablonu: ' + err.message, 'err'); }
    };
    const smp = m.querySelector('#smp'); if (smp) smp.onclick = () => M.download(M.PPT.sample(), 'Szablon_raportu_z_polami.pptx');
    const dl = m.querySelector('#dl'); if (dl) dl.onclick = async () => M.download(await M.S.getBlob(c.blobId), c.name);
    const rm = m.querySelector('#rm'); if (rm) rm.onclick = async () => { if (await M.UI.confirm('Usunąć szablon PowerPoint tej budowy?', 'Usuń', true)) { await M.S.delBlob(c.blobId); delete p.pptTpl; save(); m.close(); } };
    if (!c) return;
    const per = m.querySelector('#per'); per.onchange = () => { c.perSlide = +per.value; save(); };
    const cap = m.querySelector('#cap'); cap.onchange = () => { c.captions = cap.checked; save(); };
    m.querySelectorAll('select[data-s]').forEach(sel => sel.onchange = () => {
      c.map = (c.map || []).filter(x => !(x.slajd === +sel.dataset.s && String(x.id) === sel.dataset.id));
      if (sel.value !== '-') { if (sel.value === 'ZDJECIA') c.map = c.map.filter(x => x.pole !== 'ZDJECIA'); c.map.push({ slajd: +sel.dataset.s, id: sel.dataset.id, pole: sel.value }); }
      save(); if (sel.value === 'ZDJECIA') { m.close(); R.editor(); }
    });
    const clr = m.querySelector('#clr'); if (clr) clr.onclick = () => { c.map = []; save(); m.close(); R.editor(); };
    const ai = m.querySelector('#ai'); if (ai) ai.onclick = () => {
      const struct = c.analysis.slides.map(s => `Slajd ${s.n}:\n` + (s.shapes.map(sh => `  - id ${sh.id} | ${sh.name}${sh.ph ? ' | pole układu: ' + sh.ph : ''} | tekst: „${sh.text.replace(/\s+/g, ' ').slice(0, 140)}”`).join('\n') || '  (brak kształtów z tekstem)')).join('\n');
      M.AI.open({ key: 'pptx', title: 'Asystent AI – dopasowanie szablonu PowerPoint',
        prompt: M.AI.fill('pptx', { POLA: fields.map(([k, l]) => `${k} – ${l}`).join('\n'), STRUKTURA: struct }),
        parse: (t) => { const j = M.extractJSON(t); return Array.isArray(j) && j.length && j[0].pole ? j : null; },
        preview: (j) => `<table class="list"><tbody>${j.map(x => { const s = c.analysis.slides[x.slajd - 1]; const sh = s && s.shapes.find(y => String(y.id) === String(x.id)); return `<tr><td>slajd ${e(x.slajd)}</td><td>${e(sh ? sh.name : 'id ' + x.id)}${sh ? '' : ' <b style="color:var(--danger)">(brak kształtu)</b>'}</td><td><b>${e(x.pole)}</b>${fields.some(f => f[0] === x.pole) ? '' : ' <b style="color:var(--danger)">(nieznane pole)</b>'}</td></tr>`; }).join('')}</tbody></table>`,
        applyLabel: 'Zapisz mapę pól',
        apply: (j) => { c.map = j.filter(x => fields.some(f => f[0] === x.pole) && c.analysis.slides[x.slajd - 1] && c.analysis.slides[x.slajd - 1].shapes.some(y => String(y.id) === String(x.id))).map(x => ({ slajd: +x.slajd, id: String(x.id), pole: x.pole })); save(); setTimeout(R.editor, 50); m.close(); } });
    };
    const test = m.querySelector('#test'); if (test) test.onclick = () => { const r = M.S.all('reports').sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]; if (!r) return M.toast('Brak raportu do próby', 'warn'); R.generate(r); };
  };

  /** wartości pól dla raportu */
  R.vars = (r) => {
    const p = M.S.project; const secs = sectionFields(p); const txt = r.aiText || r.notes || '';
    const sec = M.reportSections(txt, secs.length); const me = M.S.me();
    const v = { BUDOWA: p.name, ADRES: p.address || '', INWESTOR: p.investor || '', DATA: M.fmt(r.date), DZIEN: M.weekday(r.date), POGODA: M.weatherTxt(r.weather) || '—', GODZINY: r.hours || '', OBSADA: (r.crew || []).map(c => `${M.S.respName(c.companyId)}: ${c.n || '?'} os.`).join('\n') || '—', RAPORT: txt, NOTATKI: r.notes || '', EDB: r.edbText || '', AUTOR: me ? me.name : '' };
    secs.forEach(([k], i) => v[k] = sec[i + 1] || '—');
    return v;
  };
  /** generowanie i pobranie .pptx */
  R.generate = async (r) => {
    try {
      M.toast('Tworzę prezentację…');
      const c = R.cfg(); const tpl = c ? await M.S.getBlob(c.blobId) : M.PPT.sample();
      const photos = [];
      for (const ph of (r.photos || [])) { const blob = await M.S.getBlob(ph.blobId); if (!blob) continue; let meta = await M.S.blobMeta(ph.blobId); if (!meta || !meta.w) { const im = await M.loadImage(await M.S.blobURL(ph.blobId)); meta = { w: im.naturalWidth, h: im.naturalHeight }; } photos.push({ blob, w: meta.w, h: meta.h, cap: ph.cap || '' }); }
      const out = await M.PPT.build(tpl, { vars: R.vars(r), map: c ? c.map || [] : [], photos, perSlide: c ? c.perSlide || 2 : 2, captions: c ? c.captions !== false : true });
      M.download(out, `Raport_${M.safeName(M.S.project.short || M.S.project.name)}_${r.date}.pptx`);
      if (!c) M.toast('Użyto szablonu przykładowego – własny wgrasz w „Szablon PowerPoint”', 'warn');
    } catch (err) { console.error(err); M.toast('Nie udało się utworzyć prezentacji: ' + err.message, 'err'); }
  };
})(window.M);
