/* =========================================================
   BIURO BUDOWY — elementy interfejsu wielokrotnego użytku
   (szuflada, okno, zdjęcia, dyktowanie, nagrywanie, listy wyboru)
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const UI = M.UI = {};

  UI.ISSUE_ST = { otwarta: ['Otwarta', 'open'], weryfikacja: ['Do weryfikacji', 'check'], zamknieta: ['Zamknięta', 'done'], odrzucona: ['Odrzucona', 'rej'] };
  UI.ISSUE_CAT = ['Jakość', 'BHP', 'Projektowa', 'Porządek', 'Inna'];
  UI.st = (map, key) => { const s = map[key] || ['—', 'rej']; return `<span class="st ${s[1]}">${e(s[0])}</span>`; };
  UI.issueSt = (k) => UI.st(UI.ISSUE_ST, k);

  UI.head = (title, sub, actions = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="actions">${actions}</div></div>`;
  UI.readonlyBanner = (mod) => M.P.canEdit(mod) ? '' : `<div class="banner info" style="margin-bottom:12px">${M.icon.eye}<span>Tryb podglądu – jako <b>${e(M.P.ROLES[M.P.role()].label)}</b> możesz przeglądać, bez edycji.</span></div>`;
  UI.empty = (txt, icon = 'doc') => `<div class="empty">${M.icon[icon]}<div>${txt}</div></div>`;
  UI.noProject = () => `<div class="card card-pad">${UI.empty('Najpierw dodaj budowę w <a href="#/ustawienia">Ustawieniach</a>.', 'home')}</div>`;

  UI.opts = (list, sel, empty) => (empty != null ? `<option value="">${e(empty)}</option>` : '') + list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${e(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${e(l)}</option>`; }).join('');
  UI.respOpts = (sel, empty = '— wybierz odpowiedzialnego —') => {
    const groups = [['podwykonawca', 'Podwykonawcy'], ['projektant', 'Projektanci'], ['dostawca', 'Dostawcy'], ['gw', 'Generalny wykonawca']];
    return `<option value="">${e(empty)}</option>` + groups.map(([t, l]) => { const cs = M.S.companies(t); return cs.length ? `<optgroup label="${l}">${cs.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${e(c.name)}${c.scope ? ' – ' + e(c.scope) : ''}</option>`).join('')}</optgroup>` : ''; }).join('');
  };

  /** odczyt pól formularza: elementy z atrybutem data-f="nazwa" */
  UI.read = (root) => { const o = {}; root.querySelectorAll('[data-f]').forEach(el => { o[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; }); return o; };
  UI.lockForm = (root, locked) => { if (!locked) return; root.querySelectorAll('input,select,textarea').forEach(el => { if (!el.dataset.keep) el.disabled = true; }); };

  // ---------------- szuflada (szczegóły rekordu) ----------------
  UI.drawer = ({ title, body, footer = '', onClose }) => {
    UI.closeDrawer();
    const bg = document.createElement('div'); bg.className = 'drawer-bg';
    const d = document.createElement('aside'); d.className = 'drawer';
    d.innerHTML = `<header><h2>${title}</h2><button class="btn icon ghost" data-x title="Zamknij">${M.icon.x}</button></header><div class="body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}`;
    document.body.append(bg, d);
    const close = () => { bg.remove(); d.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
    const esc = (ev) => { if (ev.key === 'Escape' && !document.querySelector('.modal-bg,.lightbox')) close(); };
    bg.onclick = close; d.querySelector('[data-x]').onclick = close; document.addEventListener('keydown', esc);
    d.close = close; return d;
  };
  UI.closeDrawer = () => document.querySelectorAll('.drawer,.drawer-bg').forEach(x => x.remove());

  // ---------------- okno modalne ----------------
  UI.modal = ({ title, body, footer = '', wide = false, onClose }) => {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><header><h2>${title}</h2><button class="btn icon ghost" data-x>${M.icon.x}</button></header><div class="body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
    document.body.appendChild(bg);
    const close = () => { bg.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
    const esc = (ev) => { if (ev.key === 'Escape') close(); };
    bg.onclick = (ev) => { if (ev.target === bg) close(); };
    bg.querySelector('[data-x]').onclick = close; document.addEventListener('keydown', esc);
    const m = bg.querySelector('.modal'); m.close = close; return m;
  };
  UI.confirm = (msg, okLabel = 'Tak', danger = false) => new Promise(res => {
    const m = UI.modal({ title: 'Potwierdź', body: `<div>${msg}</div>`, footer: `<button class="btn ghost" data-n>Anuluj</button><button class="btn ${danger ? 'danger' : 'primary'}" data-y>${e(okLabel)}</button>`, onClose: () => res(false) });
    m.querySelector('[data-n]').onclick = () => m.close();
    m.querySelector('[data-y]').onclick = () => { res(true); m.parentElement.remove(); };
  });
  UI.menu = (anchor, items) => {
    document.querySelectorAll('.menu').forEach(x => x.remove());
    const m = document.createElement('div'); m.className = 'menu';
    m.innerHTML = items.map((it, i) => it === '-' ? '<div class="divider"></div>' : `<button data-i="${i}">${it.icon ? M.icon[it.icon] : ''}${e(it.label)}</button>`).join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 4) + 'px';
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, window.innerWidth - m.offsetWidth - 8)) + 'px';
    m.querySelectorAll('button').forEach(b => b.onclick = () => { m.remove(); items[+b.dataset.i].run(); });
    setTimeout(() => document.addEventListener('click', function h(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', h); } }), 0);
  };

  // ---------------- zdjęcia ----------------
  UI.lightbox = async (blobId) => {
    const u = await M.S.blobURL(blobId); if (!u) return;
    const lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = `<img src="${u}" alt="">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb);
  };
  /** galeria zdjęć z dodawaniem (aparat / plik), podpisami i usuwaniem; arr = [{blobId, cap}] */
  UI.photos = (box, arr, { editable = true, onChange, captions = true } = {}) => {
    const draw = async () => {
      const items = await Promise.all(arr.map(async (p) => ({ p, u: await M.S.blobURL(p.blobId) })));
      box.innerHTML = `<div class="photos">${items.map(({ p, u }, i) => `<div class="ph" data-i="${i}" title="${e(p.cap || '')}"><img src="${u}" alt="">${p.cap ? `<span class="cap">${e(p.cap)}</span>` : ''}${editable ? `<button class="x" data-del="${i}" title="Usuń">×</button>` : ''}</div>`).join('')}
        ${editable ? `<button class="ph add" data-cam>${M.icon.camera}Aparat</button><button class="ph add" data-file>${M.icon.upload}Z pliku</button>` : ''}${!editable && !arr.length ? '<span class="muted small">brak zdjęć</span>' : ''}</div>`;
      box.querySelectorAll('.ph[data-i]').forEach(el => el.onclick = (ev) => {
        if (ev.target.dataset.del != null) return;
        const p = arr[+el.dataset.i];
        if (editable && captions && ev.detail === 2) return; // podwójne kliknięcie obsłużone niżej
        UI.lightbox(p.blobId);
      });
      if (editable && captions) box.querySelectorAll('.ph[data-i]').forEach(el => el.ondblclick = () => { const p = arr[+el.dataset.i]; const c = prompt('Podpis zdjęcia:', p.cap || ''); if (c != null) { p.cap = c; draw(); onChange && onChange(arr); } });
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = async (ev) => { ev.stopPropagation(); const [p] = arr.splice(+b.dataset.del, 1); await M.S.delBlob(p.blobId); draw(); onChange && onChange(arr); });
      const add = async (capture) => {
        const files = await M.pickFile('image/*', true, capture); if (!files || !files.length) return;
        for (const f of files) { try { const { blob, w, h } = await M.compressImage(f); arr.push({ blobId: await M.S.putBlob(blob, { name: f.name, w, h }), cap: '', ts: Date.now() }); } catch (err) { M.toast(err.message, 'err'); } }
        draw(); onChange && onChange(arr);
      };
      const cam = box.querySelector('[data-cam]'); if (cam) cam.onclick = () => add(true);
      const fl = box.querySelector('[data-file]'); if (fl) fl.onclick = () => add(false);
    };
    draw(); return { redraw: draw };
  };

  // ---------------- dyktowanie (mowa → tekst) ----------------
  /** przycisk dyktowania do pola tekstowego. Web Speech API działa w Chrome/Edge (dźwięk
      przetwarzany na serwerach Google/Microsoft – nie dyktuj danych osobowych). */
  UI.dictate = (btn, target) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null, on = false;
    btn.onclick = () => {
      if (!SR) { M.toast('Ta przeglądarka nie ma dyktowania. W Windows użyj Win+H, na telefonie – mikrofonu na klawiaturze.', 'warn'); target.focus(); return; }
      if (on) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'pl-PL'; rec.continuous = true; rec.interimResults = false;
      rec.onresult = (ev) => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) { const t = ev.results[i][0].transcript.trim(); target.value += (target.value && !/\s$/.test(target.value) ? ' ' : '') + t; target.dispatchEvent(new Event('input')); } };
      rec.onend = () => { on = false; btn.classList.remove('primary'); btn.innerHTML = M.icon.mic + 'Dyktuj'; };
      rec.onerror = (ev) => M.toast('Dyktowanie: ' + ev.error + ' (sprawdź zgodę na mikrofon)', 'warn');
      rec.start(); on = true; btn.classList.add('primary'); btn.innerHTML = M.icon.stop + 'Zatrzymaj';
    };
  };

  // ---------------- nagrywanie dźwięku (narady) ----------------
  UI.recorder = (btn, onDone) => {
    let mr = null, chunks = [], t0 = 0, timer = null;
    btn.onclick = async () => {
      if (mr && mr.state === 'recording') { mr.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) return M.toast('Nagrywanie niedostępne w tej przeglądarce', 'err');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mr = new MediaRecorder(stream); chunks = []; t0 = Date.now();
        mr.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
        mr.onstop = () => { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); btn.classList.remove('primary'); btn.innerHTML = M.icon.mic + 'Nagraj naradę'; onDone(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), Math.round((Date.now() - t0) / 1000)); };
        mr.start(1000); btn.classList.add('primary');
        timer = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); btn.innerHTML = `${M.icon.stop}Zatrzymaj (${Math.floor(s / 60)}:${M.pad(s % 60)})`; }, 500);
      } catch (err) { M.toast('Brak dostępu do mikrofonu: ' + err.message, 'err'); }
    };
  };

  // ---------------- tabela prosta z sortowaniem po kliknięciu nagłówka ----------------
  UI.sortable = (table) => {
    table.querySelectorAll('th[data-k]').forEach(th => th.style.cursor = 'pointer');
  };

  /** widok podglądu dokumentu + drukuj / PDF */
  UI.docPreview = (title, html, extraFooter = '') => {
    const m = UI.modal({ title, wide: true, body: `<iframe class="doc" style="width:100%;height:66vh;padding:0;border:1px solid var(--line)" srcdoc="${e(M.PR.doc(title, html, true))}"></iframe>`, footer: `<span class="small muted grow">Drukuj → w oknie wydruku wybierz „Zapisz jako PDF”.</span>${extraFooter}<button class="btn primary" data-p>${M.icon.print}Drukuj / PDF</button>` });
    m.querySelector('[data-p]').onclick = () => M.PR.print(title, html);
    return m;
  };
})(window.M);
