/* =========================================================
   BIURO BUDOWY — wydruki i PDF (przez okno drukowania: „Zapisz jako PDF”)
   Każdy dokument ma ten sam nagłówek z logo i danymi budowy.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const PR = M.PR = {};
  PR.CSS = `
    @page{size:A4;margin:14mm 12mm 16mm}
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",Calibri,Arial,sans-serif;font-size:10.5pt;color:#1c1f21;margin:0;line-height:1.38}
    h1{font-size:16pt;margin:0 0 2mm;color:#23272A} h2{font-size:12.5pt;margin:5mm 0 2mm;color:#23272A;border-bottom:1.5px solid #ED471D;padding-bottom:1mm}
    h3{font-size:11pt;margin:4mm 0 1.5mm}
    .dh{display:flex;align-items:center;gap:5mm;border-bottom:2.5px solid #ED471D;padding-bottom:3mm;margin-bottom:4mm}
    .dh img{height:13mm}.dh .t{flex:1}.dh .t b{font-size:13pt;display:block}.dh .m{font-size:8.5pt;color:#555;text-align:right}
    table{width:100%;border-collapse:collapse;margin:2mm 0}
    th,td{border:0.6pt solid #9aa1a4;padding:1.5mm 2mm;vertical-align:top;text-align:left;font-size:9.5pt}
    th{background:#ECEEEF;font-size:8.5pt;text-transform:uppercase}
    .kv td:first-child{width:38%;background:#F6F7F7;font-weight:600}
    .iss{display:grid;grid-template-columns:1fr 62mm;gap:4mm;border:0.6pt solid #9aa1a4;border-radius:2mm;padding:3mm;margin:0 0 3mm;page-break-inside:avoid}
    .iss .hd{display:flex;gap:3mm;align-items:center;margin-bottom:1.5mm}.iss .nr{font-weight:800;font-size:11pt}
    .iss .loc{width:62mm;height:42mm;object-fit:cover;border:0.6pt solid #9aa1a4}
    .pics{display:flex;flex-wrap:wrap;gap:2mm;margin-top:2mm}.pics img{height:34mm;max-width:60mm;object-fit:cover;border:0.6pt solid #ccc}
    .pics.big img{height:60mm;max-width:85mm}
    .st{display:inline-block;padding:0.3mm 2mm;border-radius:3mm;font-size:8pt;font-weight:700;border:0.6pt solid #999}
    .st.open{background:#FDE3D9;border-color:#ED471D;color:#AE2F0E}.st.check{background:#FBF0D5;border-color:#B7791F;color:#7a5010}.st.done{background:#DDF2E5;border-color:#2F855A;color:#22603F}.st.rej{background:#ECEEEF}
    .sign{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;margin-top:14mm}.sign div{border-top:0.6pt solid #333;padding-top:1mm;font-size:8.5pt;text-align:center}
    .muted{color:#666}.small{font-size:8.5pt}.pre{white-space:pre-wrap}
    .box{border:0.6pt solid #9aa1a4;border-radius:2mm;padding:3mm;margin:2mm 0}
    .foot{display:none}
    ul{margin:1mm 0 1mm 5mm;padding:0} p{margin:1mm 0}
    .grp{page-break-before:always}.grp:first-of-type{page-break-before:auto}`;

  PR.header = (title, sub = '') => {
    const p = M.S.project || {};
    return `<div class="dh"><img src="assets/logo-tek-full.svg" alt=""><div class="t"><b>${e(title)}</b>${e(sub)}</div><div class="m">${e(p.name || '')}<br>${e(p.address || '')}<br>Wygenerowano: ${e(M.nowTxt())}</div></div>`;
  };
  /** pełny dokument HTML (podgląd na ekranie: screen=true dodaje marginesy „kartki”) */
  PR.doc = (title, bodyHtml, screen = false) => {
    const base = document.baseURI.replace(/[^/]*$/, '');
    // stopka w marginesie strony (z numerem strony). Wcześniej była „przyklejona” do okna i od 2. strony nachodziła na treść.
    const q = (t) => '"' + String(t || '').replace(/[\\"<>]/g, ' ').replace(/[\r\n]+/g, ' ') + '"';
    const foot = `@page{@bottom-left{content:${q('TEK-BIURO BUDOWY · ' + ((M.S.project || {}).name || ''))};font:7.5pt "Segoe UI",Calibri,Arial,sans-serif;color:#888}@bottom-right{content:${q(title + ' · str. ')} counter(page) " / " counter(pages);font:7.5pt "Segoe UI",Calibri,Arial,sans-serif;color:#888}}`;
    return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><base href="${e(base)}"><title>${e(title)}</title><style>${PR.CSS}${foot}${screen ? '@media screen{body{padding:14mm 12mm;max-width:210mm;margin:0 auto}.foot{display:none}.grp{border-bottom:1px dashed #bbb;padding-bottom:6mm;margin-bottom:6mm}}' : ''}</style></head><body>${bodyHtml}<div class="foot"><span>TEK-BIURO BUDOWY · ${e((M.S.project || {}).name || '')}</span><span>${e(title)}</span></div></body></html>`;
  };
  PR.print = (title, bodyHtml) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    f.srcdoc = PR.doc(title, bodyHtml);
    document.body.appendChild(f);
    f.onload = () => {
      const w = f.contentWindow; const imgs = Array.from(w.document.images);
      Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => { w.focus(); w.print(); setTimeout(() => f.remove(), 2000); });
    };
  };
  /** zdjęcia rekordu jako <img> (object URL – działają w podglądzie i wydruku) */
  PR.pics = async (photos = [], big = false) => {
    if (!photos.length) return '';
    const urls = await Promise.all(photos.map(p => M.S.blobURL(p.blobId)));
    return `<div class="pics ${big ? 'big' : ''}">${urls.map((u, i) => u ? `<figure style="margin:0"><img src="${u}">${photos[i].cap ? `<figcaption class="small muted">${e(photos[i].cap)}</figcaption>` : ''}</figure>` : '').join('')}</div>`;
  };
  PR.sign = (labels) => `<div class="sign">${labels.map(l => `<div>${e(l)}</div>`).join('')}</div>`;

  /** wycinek rzutu z zaznaczonym miejscem uwagi (do raportów) → dataURL */
  const cropCache = new Map();
  PR.locationCrop = async (issue, w = 620, h = 420) => {
    const plan = M.S.get('plans', issue.planId); if (!plan || issue.x == null) return '';
    const key = issue.id + ':' + issue.x + ':' + issue.y + ':' + issue.nr; if (cropCache.has(key)) return cropCache.get(key);
    const u = await M.S.blobURL(plan.blobId); if (!u) return '';
    const img = await M.loadImage(u);
    const W = img.naturalWidth, H = img.naturalHeight; const cx = issue.x * W, cy = issue.y * H;
    const span = Math.max(W, H) * 0.16;
    const sw = Math.min(W, span * (w / h)), sh = Math.min(H, span);
    const sx = Math.max(0, Math.min(W - sw, cx - sw / 2)), sy = Math.max(0, Math.min(H - sh, cy - sh / 2));
    const k = Math.min(w / sw, h / sh), dw = sw * k, dh = sh * k, ox = (w - dw) / 2, oy = (h - dh) / 2;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.drawImage(img, sx, sy, sw, sh, ox, oy, dw, dh);
    const px = ox + (cx - sx) * k, py = oy + (cy - sy) * k;
    g.strokeStyle = '#ED471D'; g.lineWidth = 5; g.beginPath(); g.arc(px, py, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ED471D'; g.beginPath(); g.arc(px, py, 7, 0, Math.PI * 2); g.fill();
    g.font = 'bold 22px Segoe UI, Arial'; const label = issue.nr || ''; const tw = g.measureText(label).width;
    g.fillStyle = '#23272A'; g.fillRect(px + 30, py - 38, tw + 14, 30); g.fillStyle = '#fff'; g.fillText(label, px + 37, py - 16);
    const du = c.toDataURL('image/jpeg', 0.85); cropCache.set(key, du); return du;
  };
})(window.M);
