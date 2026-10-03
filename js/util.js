/* =========================================================
   BIURO BUDOWY — narzędzia wspólne (daty, ikony, komunikaty, pliki)
   ========================================================= */
window.M = window.M || {};
window.M.modules = window.M.modules || {};
(function (M) {
  'use strict';
  M.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  M.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  M.pad = (n, l = 2) => String(n).padStart(l, '0');
  M.norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9%]+/g, ' ').trim();
  M.plural = (n, a, b, c) => { n = Math.abs(n); if (n === 1) return a; const d = n % 10, h = n % 100; return d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; };
  M.debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  M.clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------------- Daty (zawsze ISO RRRR-MM-DD w bazie) ----------------
  M.iso = (d) => `${d.getFullYear()}-${M.pad(d.getMonth() + 1)}-${M.pad(d.getDate())}`;
  M.todayISO = () => M.iso(new Date());
  M.nowTxt = () => { const d = new Date(); return `${M.fmt(M.iso(d))} ${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  M.toDate = (s) => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return y ? new Date(y, (m || 1) - 1, d || 1) : null; };
  M.fmt = (s) => { if (!s) return ''; const d = M.toDate(s); return d ? `${M.pad(d.getDate())}.${M.pad(d.getMonth() + 1)}.${d.getFullYear()}` : ''; };
  M.fmtTs = (ts) => { if (!ts) return ''; const d = new Date(ts); return `${M.pad(d.getDate())}.${M.pad(d.getMonth() + 1)}.${d.getFullYear()} ${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  M.addDays = (s, n) => { const d = M.toDate(s); if (!d) return ''; d.setDate(d.getDate() + Number(n || 0)); return M.iso(d); };
  M.diffDays = (a, b) => { const x = M.toDate(a), y = M.toDate(b); if (!x || !y) return null; return Math.round((y - x) / 86400000); };
  M.daysLeft = (s) => M.diffDays(M.todayISO(), s);
  M.weekday = (s) => { const d = M.toDate(s); return d ? d.toLocaleDateString('pl-PL', { weekday: 'long' }) : ''; };
  /** dowolna data (Excel/Date/tekst DD.MM.RRRR/ISO) → ISO */
  M.parseDate = (v) => {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return M.iso(new Date(v.getTime() + v.getTimezoneOffset() * 60000 + 12 * 3600000));
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return M.iso(new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 12 * 3600000)); }
    // eksport MS Project do Excela: „pon 01.09.26”, „1 września 2026 08:00”, „Mon 9/1/26”
    let s = String(v).trim().replace(/^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż.]+,?\s+(?=\d)/, '');
    const MIES = ['stycz', 'lut', 'mar', 'kwie', 'maj', 'czerw', 'lip', 'sierp', 'wrze', 'pazdz', 'listop', 'grud'];
    const mw = M.norm(s).match(/^(\d{1,2}) ([a-z]+) (\d{4})/); if (mw) { const k = MIES.findIndex(x => mw[2].startsWith(x) || (x === 'maj' && mw[2].startsWith('maj'))); if (k >= 0) return `${mw[3]}-${M.pad(k + 1)}-${M.pad(mw[1])}`; }
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (us) { const y = us[3].length === 2 ? '20' + us[3] : us[3]; return `${y}-${M.pad(us[1])}-${M.pad(us[2])}`; } // ukośniki = format USA M/D/R
    let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/); if (m) return `${m[1]}-${M.pad(m[2])}-${M.pad(m[3])}`;
    m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${M.pad(m[2])}-${M.pad(m[1])}`; }
    return '';
  };
  M.cellVal = (v) => { if (v && typeof v === 'object') { if (v instanceof Date) return v; if (v.richText) return v.richText.map(t => t.text).join(''); if (v.text != null) return v.text; if (v.result != null) return v.result; } return v ?? ''; };

  // ---------------- Ikony (SVG, obrys) ----------------
  const I = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
  M.icon = {
    home: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
    plan: I('<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'),
    pin: I('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    list: I('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
    users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>'),
    report: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
    layers: I('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
    gantt: I('<path d="M3 4v16h18"/><rect x="6" y="6" width="8" height="3" rx="1"/><rect x="9" y="11" width="9" height="3" rx="1"/><rect x="7" y="16" width="5" height="3" rx="1"/>'),
    leaf: I('<path d="M5 20c0-9 6-15 15-16-1 9-7 15-15 16z"/><path d="M5 20l7-7"/>'),
    clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    spark: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    camera: I('<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>'),
    mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    print: I('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>'),
    xlsx: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 12l5 6M14 12l-5 6"/>'),
    upload: I('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
    download: I('<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
    copy: I('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
    paste: I('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>'),
    check: I('<path d="M4 12l5 5L20 6"/>'),
    x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
    trash: I('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
    edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
    search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    filter: I('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
    zoomin: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>'),
    zoomout: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>'),
    fit: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    mic: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    stop: I('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
    alert: I('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'),
    shield: I('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
    lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    eye: I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    cal: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    flag: I('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    cube: I('<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>'),
    link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    arrowR: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    weather: I('<path d="M7 18a4 4 0 1 1 .8-7.9A5.5 5.5 0 0 1 18.5 11 3.5 3.5 0 0 1 18 18z"/>'),
    grid: I('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    back: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    doc: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
  };
  M.ico = (name, size = 18) => (M.icon[name] || M.icon.doc).replace('<svg', `<svg style="width:${size}px;height:${size}px;flex:none"`);

  // ---------------- Komunikaty ----------------
  M.toast = (msg, kind = '') => {
    const box = document.getElementById('toasts'); if (!box) return;
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3200);
  };
  M.copy = async (text, msg = 'Skopiowano do schowka') => {
    try { await navigator.clipboard.writeText(text); M.toast(msg); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); M.toast(msg); } catch (e2) { M.toast('Nie udało się skopiować – zaznacz tekst ręcznie', 'err'); } ta.remove(); }
  };
  M.download = (blob, name) => {
    if (typeof blob === 'string') blob = new Blob([blob], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  M.pickFile = (accept = '', multiple = false, capture = false) => new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple; if (capture) i.setAttribute('capture', 'environment');
    i.onchange = () => res(multiple ? Array.from(i.files) : i.files[0]); i.click();
  });
  M.safeName = (s) => String(s || 'plik').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 80);

  // ---------------- Obrazy ----------------
  /** zmniejsza zdjęcie (dłuższy bok max px) → JPEG Blob. Oszczędza miejsce – telefon robi 4–8 MB. */
  M.compressImage = (file, max = 1600, q = 0.82) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      c.toBlob(b => { URL.revokeObjectURL(url); b ? res({ blob: b, w, h }) : rej(new Error('Nie udało się przetworzyć zdjęcia')); }, 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Nieobsługiwany format obrazu')); };
    img.src = url;
  });
  M.blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  M.dataURLToBlob = (du) => { const [h, b] = du.split(','); const mime = (h.match(/:(.*?);/) || [])[1] || 'application/octet-stream'; const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); };
  M.loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  /** ładowanie skryptu na żądanie (np. pdf.js tylko przy wgrywaniu PDF) */
  const loaded = {};
  M.loadScript = (src) => loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Nie wczytano ' + src)); document.head.appendChild(s); }));

  /** wyciąga JSON z odpowiedzi AI (blok ```json … ``` albo pierwszy obiekt/tablica) */
  M.extractJSON = (txt) => {
    const s = String(txt || '');
    const blocks = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m => m[1]);
    const cands = blocks.length ? blocks : [s.slice(Math.min(...['{', '['].map(c => { const i = s.indexOf(c); return i < 0 ? 1e9 : i; })))];
    for (const c of cands) {
      try { return JSON.parse(c.trim()); } catch (e) { /* próbuj dalej */ }
      const t = c.trim(); const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
      if (end > 0) { try { return JSON.parse(t.slice(0, end + 1)); } catch (e) { /* */ } }
    }
    return null;
  };
  /** prosty „markdown” odpowiedzi AI → bezpieczny HTML (nagłówki, listy, pogrubienia) */
  M.md = (txt) => {
    const lines = M.esc(txt || '').split('\n'); let out = '', inList = false;
    for (let l of lines) {
      l = l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      const h = l.match(/^#{1,4}\s+(.*)/); const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
      if (li) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${li[1]}</li>`; continue; }
      if (inList) { out += '</ul>'; inList = false; }
      if (h) out += `<h3>${h[1]}</h3>`; else if (l.trim()) out += `<p>${l}</p>`;
    }
    if (inList) out += '</ul>';
    return out;
  };
})(window.M);
