/* =========================================================
   TEK-BIURO BUDOWY — raport z budowy w SZABLONIE PowerPoint danej budowy
   ---------------------------------------------------------
   Plik .pptx/.potx to paczka ZIP z plikami XML (slajdy, obrazy, relacje).
   Aplikacja: otwiera paczkę (JSZip), znajduje pola i kształty, wpisuje treść raportu,
   dokłada zdjęcia (w razie potrzeby powiela slajd ze zdjęciami) i zapisuje nowy .pptx.
   Dwa sposoby wskazania, gdzie co wstawić:
   1) POLA w szablonie: {{DATA}}, {{RAPORT}}, {{ZDJECIA}} … – bez AI, zawsze tak samo,
   2) MAPA pól ustalona RAZ dla budowy (Asystent AI proponuje, Ty poprawiasz) –
      dla szablonów firmowych bez pól {{…}}.
   ========================================================= */
(function (M) {
  'use strict';
  const NS = { p: 'http://schemas.openxmlformats.org/presentationml/2006/main', a: 'http://schemas.openxmlformats.org/drawingml/2006/main', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', rel: 'http://schemas.openxmlformats.org/package/2006/relationships', ct: 'http://schemas.openxmlformats.org/package/2006/content-types' };
  const XMLH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const parse = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const ser = (d) => XMLH + new XMLSerializer().serializeToString(d).replace(/^<\?xml[^>]*\?>\s*/, '');
  const q = (el, ns, tag) => Array.from(el.getElementsByTagNameNS(NS[ns], tag));
  const q1 = (el, ns, tag) => el.getElementsByTagNameNS(NS[ns], tag)[0] || null;
  const kids = (el, ns, tag) => Array.from(el.children).filter(c => c.namespaceURI === NS[ns] && c.localName === tag);
  const xe = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dirOf = (path) => path.replace(/[^/]*$/, '');
  const relsOf = (path) => dirOf(path) + '_rels/' + path.split('/').pop() + '.rels';
  const resolve = (base, target) => { if (target.startsWith('/')) return target.slice(1); const parts = (dirOf(base) + target).split('/'); const out = []; parts.forEach(p => { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }); return out.join('/'); };

  const PPT = M.PPT = {};
  PPT.FIELDS = [['BUDOWA', 'Nazwa budowy'], ['ADRES', 'Adres'], ['INWESTOR', 'Inwestor'], ['DATA', 'Data raportu'], ['DZIEN', 'Dzień tygodnia'], ['POGODA', 'Pogoda'], ['GODZINY', 'Godziny pracy'], ['OBSADA', 'Obsada (firmy – osoby)'], ['RAPORT', 'Cała treść raportu'], ['NOTATKI', 'Notatki kierownika'], ['EDB', 'Projekt wpisu do EDB'], ['AUTOR', 'Sporządził'], ['ZDJECIA', 'Miejsce na zdjęcia']];
  PPT.load = () => M.loadScript('js/lib/jszip.min.js');

  /** kolejność slajdów wg presentation.xml */
  async function slideList(zip) {
    const pres = parse(await zip.file('ppt/presentation.xml').async('string'));
    const rels = parse(await zip.file('ppt/_rels/presentation.xml.rels').async('string'));
    const map = {}; q(rels, 'rel', 'Relationship').forEach(r => map[r.getAttribute('Id')] = r.getAttribute('Target'));
    return q(pres, 'p', 'sldId').map((s, i) => ({ n: i + 1, sldId: s.getAttribute('id'), rid: s.getAttributeNS(NS.r, 'id'), file: resolve('ppt/presentation.xml', map[s.getAttributeNS(NS.r, 'id')]) }));
  }
  const shapeText = (sp) => { const tb = q1(sp, 'p', 'txBody'); if (!tb) return null; return kids(tb, 'a', 'p').map(p => q(p, 'a', 't').map(t => t.textContent).join('')).join('\n'); };
  const shapeInfo = (sp) => { const c = q1(sp, 'p', 'cNvPr'); const ph = q1(sp, 'p', 'ph'); return { id: c ? c.getAttribute('id') : '', name: c ? c.getAttribute('name') : '', ph: ph ? (ph.getAttribute('type') || 'body') + (ph.getAttribute('idx') ? '#' + ph.getAttribute('idx') : '') : '' }; };

  /** analiza szablonu: slajdy, kształty z tekstem, znalezione pola {{…}} */
  PPT.analyze = async (blob) => {
    await PPT.load(); const zip = await JSZip.loadAsync(blob);
    if (!zip.file('ppt/presentation.xml')) throw new Error('To nie jest plik PowerPoint (.pptx/.potx)');
    const slides = await slideList(zip); const fields = new Set(); let photoSlide = null;
    for (const s of slides) {
      const d = parse(await zip.file(s.file).async('string'));
      s.shapes = q(d, 'p', 'sp').map(sp => ({ ...shapeInfo(sp), text: (shapeText(sp) || '') })).filter(x => x.id && (x.text !== null));
      const all = q(d, 'a', 't').map(t => t.textContent).join(' ');
      // pola mogą być pocięte na kilka fragmentów tekstu – szukamy po złączeniu akapitów
      q(d, 'a', 'p').forEach(p => { const t = q(p, 'a', 't').map(x => x.textContent).join(''); (t.match(/\{\{\s*[A-Z_0-9ĄĆĘŁŃÓŚŹŻ]+\s*\}\}/g) || []).forEach(m => fields.add(m.replace(/[{}\s]/g, ''))); });
      if (/\{\{\s*ZDJECIA\s*\}\}/.test(q(d, 'a', 'p').map(p => q(p, 'a', 't').map(x => x.textContent).join('')).join('\n'))) photoSlide = s.n;
      s.preview = all.slice(0, 160);
    }
    return { slides: slides.map(s => ({ n: s.n, file: s.file, shapes: s.shapes.map(x => ({ ...x, text: x.text.slice(0, 300) })), preview: s.preview })), fields: [...fields], photoSlide };
  };

  // ---------------- wstawianie tekstu ----------------
  const cleanLine = (l, bullets) => { let t = l.replace(/\*\*(.+?)\*\*/g, '$1'); let bold = false; const h = t.match(/^\s*#{1,4}\s+(.*)/); if (h) { t = h[1]; bold = true; } const li = t.match(/^\s*[-*•]\s+(.*)/); if (li) t = (bullets ? '' : '– ') + li[1]; return { t: t.trimEnd(), bold }; };
  /** czy akapit leży w polu układu z listą punktowaną (treść) – wtedy nie dublujemy myślnika */
  const inBodyPh = (el) => { let n = el; while (n && !(n.localName === 'sp' && n.namespaceURI === NS.p)) n = n.parentNode; const ph = n && q1(n, 'p', 'ph'); if (!ph) return false; const t = ph.getAttribute('type') || 'body'; return t === 'body' || t === 'obj'; };
  function setParaText(doc, p, text, bold) {
    let runs = kids(p, 'a', 'r'); const first = runs[0];
    Array.from(p.children).forEach(c => { if ((c.localName === 'r' && c !== first) || c.localName === 'fld' || c.localName === 'br') p.removeChild(c); });
    let r = first;
    if (!r) { r = doc.createElementNS(NS.a, 'a:r'); const rp = doc.createElementNS(NS.a, 'a:rPr'); rp.setAttribute('lang', 'pl-PL'); r.appendChild(rp); r.appendChild(doc.createElementNS(NS.a, 'a:t')); const end = kids(p, 'a', 'endParaRPr')[0]; p.insertBefore(r, end || null); }
    let t = q1(r, 'a', 't'); if (!t) { t = doc.createElementNS(NS.a, 'a:t'); r.appendChild(t); }
    t.textContent = text;
    const rp = q1(r, 'a', 'rPr'); if (bold && rp) rp.setAttribute('b', '1');
  }
  /** wiele linii → kolejne akapity (klony akapitu wzorcowego) */
  function writeLines(doc, p, value) {
    const bl = inBodyPh(p); const lines = String(value ?? '').split(/\r?\n/).map(l => cleanLine(l, bl)).filter((l, i, a) => l.t.trim() || (i > 0 && i < a.length - 1 && a[i - 1].t.trim()));
    if (!lines.length) lines.push({ t: '', bold: false });
    const proto = p.cloneNode(true); setParaText(doc, p, lines[0].t, lines[0].bold);
    let after = p;
    lines.slice(1).forEach(l => { const np = proto.cloneNode(true); setParaText(doc, np, l.t, l.bold); after.parentNode.insertBefore(np, after.nextSibling); after = np; });
  }
  /** zamiana {{POL}} w całym slajdzie */
  function fillFields(doc, vars) {
    q(doc, 'a', 'p').forEach(p => {
      const full = q(p, 'a', 't').map(t => t.textContent).join(''); if (!full.includes('{{')) return;
      const only = full.trim().match(/^\{\{\s*([A-Z_0-9]+)\s*\}\}$/);
      if (only && vars[only[1]] != null && String(vars[only[1]]).includes('\n')) return writeLines(doc, p, vars[only[1]]);
      const txt = full.replace(/\{\{\s*([A-Z_0-9]+)\s*\}\}/g, (m, k) => k === 'ZDJECIA' ? m : vars[k] != null ? String(vars[k]).replace(/\s*\n+\s*/g, '; ') : m);
      setParaText(doc, p, txt);
    });
  }
  /** cały tekst kształtu zastąpiony wartością (tryb mapy) */
  function fillShape(doc, sp, value) {
    const tb = q1(sp, 'p', 'txBody'); if (!tb) return;
    const ps = kids(tb, 'a', 'p'); const keep = ps.find(p => kids(p, 'a', 'r').length) || ps[0];
    ps.forEach(p => { if (p !== keep) tb.removeChild(p); });
    let p = keep; if (!p) { p = doc.createElementNS(NS.a, 'a:p'); tb.appendChild(p); }
    writeLines(doc, p, value);
    const bp = q1(tb, 'a', 'bodyPr'); if (bp && !q1(bp, 'a', 'spAutoFit') && !q1(bp, 'a', 'normAutofit') && !q1(bp, 'a', 'noAutofit')) bp.appendChild(doc.createElementNS(NS.a, 'a:normAutofit'));
  }
  const findSp = (doc, id) => q(doc, 'p', 'sp').find(sp => { const c = q1(sp, 'p', 'cNvPr'); return c && c.getAttribute('id') === String(id); });
  const findMarker = (doc) => q(doc, 'p', 'sp').find(sp => /\{\{\s*ZDJECIA\s*\}\}/.test(shapeText(sp) || ''));

  /** położenie kształtu (EMU); dla pól układu – z układu/wzorca slajdu */
  async function boxOf(zip, slideFile, sp, sld) {
    const x = q1(sp, 'a', 'xfrm');
    if (x && q1(x, 'a', 'off') && q1(x, 'a', 'ext')) { const o = q1(x, 'a', 'off'), e = q1(x, 'a', 'ext'); return { x: +o.getAttribute('x'), y: +o.getAttribute('y'), w: +e.getAttribute('cx'), h: +e.getAttribute('cy') }; }
    const ph = q1(sp, 'p', 'ph');
    if (ph) {
      const typ = ph.getAttribute('type') || 'body', idx = ph.getAttribute('idx');
      let file = slideFile;
      for (let level = 0; level < 2; level++) {
        const relF = zip.file(relsOf(file)); if (!relF) break;
        const rel = q(parse(await relF.async('string')), 'rel', 'Relationship').find(r => /slideLayout|slideMaster/.test(r.getAttribute('Type')));
        if (!rel) break; file = resolve(file, rel.getAttribute('Target')); const f = zip.file(file); if (!f) break;
        const d = parse(await f.async('string'));
        const cand = q(d, 'p', 'sp').find(s => { const p2 = q1(s, 'p', 'ph'); return p2 && ((idx && p2.getAttribute('idx') === idx) || ((p2.getAttribute('type') || 'body') === typ)); });
        const cx = cand && q1(cand, 'a', 'xfrm'); if (cx && q1(cx, 'a', 'off')) { const o = q1(cx, 'a', 'off'), e = q1(cx, 'a', 'ext'); return { x: +o.getAttribute('x'), y: +o.getAttribute('y'), w: +e.getAttribute('cx'), h: +e.getAttribute('cy') }; }
      }
    }
    return { x: Math.round(sld.cx * 0.05), y: Math.round(sld.cy * 0.2), w: Math.round(sld.cx * 0.9), h: Math.round(sld.cy * 0.72) };
  }

  /**
   * Generowanie raportu.
   * opts: { vars:{POLE:wartość}, map:[{slajd, id, pole}], photos:[{blob,w,h,cap}], perSlide, captions }
   */
  PPT.build = async (tplBlob, opts) => {
    await PPT.load(); const zip = await JSZip.loadAsync(tplBlob);
    const vars = opts.vars || {}; const map = opts.map || [];
    // .potx (szablon) → .pptx (prezentacja)
    let ct = await zip.file('[Content_Types].xml').async('string');
    ct = ct.replace('presentationml.template.main+xml', 'presentationml.presentation.main+xml');
    const pres = parse(await zip.file('ppt/presentation.xml').async('string'));
    const sz = q1(pres, 'p', 'sldSz'); const sld = { cx: +(sz ? sz.getAttribute('cx') : 12192000), cy: +(sz ? sz.getAttribute('cy') : 6858000) };
    const presRels = parse(await zip.file('ppt/_rels/presentation.xml.rels').async('string'));
    const slides = await slideList(zip);

    // gdzie zdjęcia: mapa (pole ZDJECIA) albo znacznik {{ZDJECIA}}
    const mPh = map.find(m => m.pole === 'ZDJECIA');
    let photoSlide = mPh ? slides[mPh.slajd - 1] : null;
    const docs = {};
    for (const s of slides) docs[s.file] = parse(await zip.file(s.file).async('string'));
    if (!photoSlide) photoSlide = slides.find(s => findMarker(docs[s.file])) || null;
    const photoXml = photoSlide ? await zip.file(photoSlide.file).async('string') : null;
    const photoRels = photoSlide && zip.file(relsOf(photoSlide.file)) ? await zip.file(relsOf(photoSlide.file)).async('string') : null;

    // 1) teksty na wszystkich slajdach
    for (const s of slides) {
      const d = docs[s.file];
      map.filter(m => m.slajd === s.n && m.pole && m.pole !== 'ZDJECIA' && m.pole !== '-').forEach(m => { const sp = findSp(d, m.id); if (sp) fillShape(d, sp, vars[m.pole] ?? ''); });
      fillFields(d, vars);
    }
    // 2) zdjęcia – grupy po perSlide, pierwsza na slajdzie-wzorze, kolejne na kopiach
    const photos = opts.photos || []; const per = Math.max(1, Number(opts.perSlide) || 2);
    let mediaN = 0; let newSlides = [];
    if (photoSlide) {
      const groups = []; for (let i = 0; i < photos.length; i += per) groups.push(photos.slice(i, i + per)); if (!groups.length) groups.push([]);
      const sldIds = q(pres, 'p', 'sldId'); let maxId = Math.max(255, ...sldIds.map(x => +x.getAttribute('id')));
      const existingSlides = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f)).map(f => +f.match(/(\d+)\.xml$/)[1]);
      let nextSlideNo = Math.max(...existingSlides) + 1;
      let anchor = sldIds.find(x => x.getAttribute('id') === photoSlide.sldId);
      for (let g = 0; g < groups.length; g++) {
        let file = photoSlide.file, doc = docs[photoSlide.file], relsXml = photoRels;
        if (g > 0) { // kopia slajdu ze zdjęciami
          file = `ppt/slides/slide${nextSlideNo++}.xml`; doc = parse(photoXml); fillFields(doc, vars);
          map.filter(m => m.slajd === photoSlide.n && m.pole && !['ZDJECIA', '-'].includes(m.pole)).forEach(m => { const sp = findSp(doc, m.id); if (sp) fillShape(doc, sp, vars[m.pole] ?? ''); });
          relsXml = photoRels ? photoRels.replace(/<Relationship [^>]*notesSlide[^>]*\/>/g, '') : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"></Relationships>`;
          const rid = 'rIdTek' + (g + 1) + M.uid().slice(-4);
          const rel = presRels.createElementNS(NS.rel, 'Relationship'); rel.setAttribute('Id', rid); rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'); rel.setAttribute('Target', 'slides/' + file.split('/').pop()); presRels.documentElement.appendChild(rel);
          const sid = pres.createElementNS(NS.p, 'p:sldId'); sid.setAttribute('id', String(++maxId)); sid.setAttributeNS(NS.r, 'r:id', rid); anchor.parentNode.insertBefore(sid, anchor.nextSibling); anchor = sid;
          ct = ct.replace('</Types>', `<Override PartName="/${file}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
          newSlides.push(file);
        }
        // obszar na zdjęcia
        const marker = (mPh ? findSp(doc, mPh.id) : null) || findMarker(doc);
        const box = marker ? await boxOf(zip, photoSlide.file, marker, sld) : { x: Math.round(sld.cx * 0.05), y: Math.round(sld.cy * 0.2), w: Math.round(sld.cx * 0.9), h: Math.round(sld.cy * 0.72) };
        if (marker) marker.parentNode.removeChild(marker);
        const rels = parse(relsXml); const tree = q1(doc, 'p', 'spTree');
        let maxShape = Math.max(1, ...q(doc, 'p', 'cNvPr').map(c => +c.getAttribute('id') || 0));
        const grp = groups[g]; const cols = grp.length <= 1 ? 1 : grp.length <= 4 ? 2 : 3; const rows = Math.max(1, Math.ceil(grp.length / cols));
        const gap = Math.round(Math.min(box.w, box.h) * 0.03); const capH = opts.captions ? Math.round(box.h / rows * 0.12) : 0;
        const cw = (box.w - gap * (cols - 1)) / cols, ch = (box.h - gap * (rows - 1)) / rows;
        if (!grp.length) { const t = parse(`<p:sp xmlns:p="${NS.p}" xmlns:a="${NS.a}"><p:nvSpPr><p:cNvPr id="${++maxShape}" name="Brak zdjęć"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${box.x}" y="${box.y}"/><a:ext cx="${box.w}" cy="${Math.round(box.h / 6)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pl-PL" sz="1400" i="1"/><a:t>Brak zdjęć w raporcie.</a:t></a:r></a:p></p:txBody></p:sp>`); tree.appendChild(doc.importNode(t.documentElement, true)); }
        for (let i = 0; i < grp.length; i++) {
          const ph = grp[i]; const c = i % cols, r = Math.floor(i / cols);
          const cx0 = box.x + c * (cw + gap), cy0 = box.y + r * (ch + gap); const aw = cw, ah = ch - capH;
          const k = Math.min(aw / (ph.w || 4), ah / (ph.h || 3)); const w = Math.round((ph.w || 4) * k), h = Math.round((ph.h || 3) * k);
          const x = Math.round(cx0 + (aw - w) / 2), y = Math.round(cy0 + (ah - h) / 2);
          const media = `ppt/media/tekbb_${Date.now().toString(36)}_${++mediaN}.jpg`; zip.file(media, ph.blob);
          const rid = 'rIdImg' + mediaN + M.uid().slice(-3);
          const rel = rels.createElementNS(NS.rel, 'Relationship'); rel.setAttribute('Id', rid); rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'); rel.setAttribute('Target', '../media/' + media.split('/').pop()); rels.documentElement.appendChild(rel);
          const pic = parse(`<p:pic xmlns:p="${NS.p}" xmlns:a="${NS.a}" xmlns:r="${NS.r}"><p:nvPicPr><p:cNvPr id="${++maxShape}" name="Zdjęcie ${i + 1}" descr="${xe(ph.cap)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
          tree.appendChild(doc.importNode(pic.documentElement, true));
          if (opts.captions && ph.cap) {
            const cap = parse(`<p:sp xmlns:p="${NS.p}" xmlns:a="${NS.a}"><p:nvSpPr><p:cNvPr id="${++maxShape}" name="Podpis ${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(cx0)}" y="${Math.round(cy0 + ch - capH)}"/><a:ext cx="${Math.round(cw)}" cy="${capH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="pl-PL" sz="1100"/><a:t>${xe(ph.cap)}</a:t></a:r></a:p></p:txBody></p:sp>`);
            tree.appendChild(doc.importNode(cap.documentElement, true));
          }
        }
        zip.file(file, ser(doc)); zip.file(relsOf(file), ser(rels));
        if (g === 0) delete docs[photoSlide.file];
      }
    }
    for (const [f, d] of Object.entries(docs)) zip.file(f, ser(d));
    if (!/Extension="jpg"/i.test(ct)) ct = ct.replace(/<Types([^>]*)>/, '<Types$1><Default Extension="jpg" ContentType="image/jpeg"/>');
    zip.file('[Content_Types].xml', ct); zip.file('ppt/presentation.xml', ser(pres)); zip.file('ppt/_rels/presentation.xml.rels', ser(presRels));
    const app = zip.file('docProps/app.xml'); if (app) { let a = await app.async('string'); a = a.replace(/<Slides>\d+<\/Slides>/, `<Slides>${slides.length + newSlides.length}</Slides>`); zip.file('docProps/app.xml', a); }
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE' });
  };

  /** przykładowy szablon z polami {{…}} (plik js/lib/pptx_sample.js) */
  PPT.sample = () => M.dataURLToBlob('data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,' + (M.PPT_SAMPLE || ''));
})(window.M);
