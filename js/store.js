/* =========================================================
   BIURO BUDOWY — magazyn danych
   ---------------------------------------------------------
   Jak w Mowotece:
   1) Dane w pamięci przeglądarki (IndexedDB) – zapis natychmiast po każdej zmianie.
      • magazyn „kv”    – cała baza jako jeden obiekt (rekordy, ustawienia)
      • magazyn „blobs” – zdjęcia i rzuty (pliki binarne), osobno, żeby baza była lekka
   2) Opcjonalnie folder danych na dysku (Edge/Chrome, File System Access API):
      • BiuroBudowy_baza.json        – pełna baza (do odtworzenia)
      • pliki/<id>.jpg|png           – zdjęcia i rzuty
      • Kopie/BiuroBudowy_RRRR-MM-DD.json – kopia dzienna (bez zdjęć)
   W wersji .exe (Electron) ten plik zostanie podmieniony na zapis bezpośrednio
   na dysk – reszta aplikacji używa tylko funkcji M.S.* (nic więcej nie trzeba zmieniać).
   ========================================================= */
(function (M) {
  'use strict';
  const DB_NAME = 'biuro-budowy', KV = 'kv', BL = 'blobs', SCHEMA = 1;
  const TABLES = ['projects', 'people', 'companies', 'plans', 'issues', 'meetings', 'reports', 'protocols', 'tasks', 'risks', 'breeam', 'evidence', 'monitoring', 'events', 'templates', 'custom', 'aiLog', 'pilotTimes', 'pilotNotes', 'elements', 'assembly', 'diary', 'feedback'];

  const DEFAULT_SETTINGS = {
    currentProject: '', currentUser: '',
    mailAuto: true,                 // po zapisaniu uwagi z przypisaną firmą – przygotuj maila
    mailSignature: 'Z poważaniem\nKierownik Budowy',
    aiUrl: 'https://claude.ai/new',
    anonimizacja: true,             // w promptach zamieniaj nazwiska osób na role
    modules: {},                    // id modułu → false (wyłączony)
    customModules: [],              // moduły własne z kreatora
    prompts: {},                    // własne wersje promptów (nadpisują domyślne)
    demo: false,
  };
  const emptyDB = () => { const d = { schema: SCHEMA, meta: { savedAt: 0, created: Date.now() }, settings: { ...DEFAULT_SETTINGS } }; TABLES.forEach(t => d[t] = []); return d; };

  // ---------------- IndexedDB ----------------
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(KV)) d.createObjectStore(KV); if (!d.objectStoreNames.contains(BL)) d.createObjectStore(BL); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const idb = {
    async get(store, k) { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(store).objectStore(store).get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); },
    async set(store, k, v) { const d = await open(); return new Promise((res, rej) => { const tx = d.transaction(store, 'readwrite'); tx.objectStore(store).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
    async del(store, k) { const d = await open(); return new Promise((res, rej) => { const tx = d.transaction(store, 'readwrite'); tx.objectStore(store).delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
    async keys(store) { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(store).objectStore(store).getAllKeys(); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); },
    async clear(store) { const d = await open(); return new Promise((res, rej) => { const tx = d.transaction(store, 'readwrite'); tx.objectStore(store).clear(); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  };

  const listeners = new Set();
  const urlCache = new Map();
  let saveTimer = null;

  const S = M.S = {
    db: emptyDB(), TABLES, DEFAULT_SETTINGS, idbOk: true,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(what) { listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } }); },

    async init() {
      try { const saved = await idb.get(KV, 'db'); if (saved && saved.schema) S.db = S.migrate(saved); }
      catch (e) { S.idbOk = false; console.warn('IndexedDB niedostępne', e); }
    },
    migrate(d) {
      const base = emptyDB(); const out = { ...base, ...d };
      TABLES.forEach(t => { if (!Array.isArray(out[t])) out[t] = []; });
      out.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
      out.meta = { ...base.meta, ...(d.meta || {}) };
      return out;
    },
    touch(what = 'data') {
      S.db.meta.savedAt = Date.now(); S.emit(what);
      clearTimeout(saveTimer); saveTimer = setTimeout(S.flush, 250);
    },
    async flush() {
      clearTimeout(saveTimer);
      try { await idb.set(KV, 'db', S.db); } catch (e) { console.error(e); M.toast('Błąd zapisu lokalnego: ' + e.message, 'err'); }
      M.FS.saveDb();
    },
    replaceAll(newDb) { S.db = S.migrate(newDb); S.touch('replace'); },

    // ---------------- ustawienia ----------------
    get settings() { return S.db.settings; },
    set(key, val) { S.db.settings[key] = val; if (['modules', 'customModules', 'prompts', 'feedbackEmail'].includes(key)) S.db.settings.sharedUpdated = Date.now(); S.touch('settings'); },

    // ---------------- projekt (budowa) bieżący ----------------
    /** budowy dostępne dla zalogowanej osoby: posiadacz licencji widzi wszystkie, pozostali – przypisane */
    myProjects() { const me = S.me(); return S.db.projects.filter(p => !me || me.licHash || !Array.isArray(me.projectIds) || me.projectIds.includes(p.id)); },
    get project() { const l = S.myProjects(); return l.find(p => p.id === S.db.settings.currentProject) || l[0] || null; },
    get pid() { const p = S.project; return p ? p.id : ''; },

    // ---------------- CRUD ----------------
    /** rekordy tabeli; domyślnie tylko z bieżącej budowy (tabele z polem projectId) */
    all(t, allProjects = false) { const a = S.db[t] || []; if (allProjects || t === 'projects' || t === 'people' || t === 'companies' || t === 'templates' || t === 'aiLog' || t === 'feedback') return a; return a.filter(r => r.projectId === S.pid); },
    get(t, id) { return (S.db[t] || []).find(r => r.id === id) || null; },
    upsert(t, rec, silent) {
      if (!rec.id) rec.id = M.uid();
      rec.updated = Date.now();
      if (rec.projectId === undefined && !['projects', 'people', 'companies', 'templates', 'aiLog', 'feedback'].includes(t)) rec.projectId = S.pid;
      const i = S.db[t].findIndex(r => r.id === rec.id);
      if (i >= 0) S.db[t][i] = rec; else { rec.created = rec.created || Date.now(); rec.createdBy = rec.createdBy || S.settings.currentUser; S.db[t].push(rec); }
      if (!silent) S.touch(t);
      return rec;
    },
    remove(t, id) {
      const rec = S.get(t, id);
      if (rec) S.blobIdsOf(rec).forEach(b => S.delBlob(b));
      S.db[t] = S.db[t].filter(r => r.id !== id); S.touch(t);
    },
    /** kolejny numer w obrębie budowy: U-001, N-01, PZ-001 … */
    nextNr(t, prefix, digits = 3) {
      const nums = S.all(t).map(r => parseInt(String(r.nr || '').replace(/\D+/g, ''), 10)).filter(n => !isNaN(n));
      return `${prefix}-${M.pad((nums.length ? Math.max(...nums) : 0) + 1, digits)}`;
    },

    // ---------------- słowniki ----------------
    companies(type) { return S.db.companies.filter(c => (!type || c.type === type) && (!c.projectIds || !c.projectIds.length || c.projectIds.includes(S.pid))).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pl')); },
    company(id) { return S.get('companies', id); },
    person(id) { return S.get('people', id); },
    me() { return S.person(S.settings.currentUser) || S.db.people[0] || null; },
    /** wszyscy możliwi „odpowiedzialni”: firmy (podwykonawcy, projektanci) */
    responsibles() { return S.companies().filter(c => c.type !== 'inwestor'); },
    respName(id) { const c = S.company(id); if (c) return c.name; const p = S.person(id); return p ? p.name : (id ? '—' : 'nieprzypisane'); },

    // ---------------- pliki (zdjęcia, rzuty) ----------------
    async putBlob(blob, meta = {}) {
      const id = 'b' + M.uid();
      await idb.set(BL, id, { blob, type: blob.type, name: meta.name || '', w: meta.w || 0, h: meta.h || 0, ts: Date.now() });
      M.FS.saveBlob(id, blob);
      return id;
    },
    async blobMeta(id) { const r = await idb.get(BL, id); return r ? { w: r.w || 0, h: r.h || 0, name: r.name || '' } : null; },
    /** plik: najpierw z tego urządzenia; jeśli go nie ma, a działa synchronizacja – z chmury */
    async getBlob(id) { const r = await idb.get(BL, id); if (r) return r.blob; return M.SYNC ? M.SYNC.fetchBlob(id) : null; },
    async localBlob(id) { const r = await idb.get(BL, id); return r ? r.blob : null; },
    async storeBlob(id, blob) { await idb.set(BL, id, { blob, type: blob.type, name: '', w: 0, h: 0, ts: Date.now() }); M.FS.saveBlob(id, blob); },
    kv: { get: (k) => idb.get(KV, k), set: (k, v) => idb.set(KV, k, v) },
    async blobURL(id) {
      if (!id) return '';
      if (urlCache.has(id)) return urlCache.get(id);
      const b = await S.getBlob(id); if (!b) return '';
      const u = URL.createObjectURL(b); urlCache.set(id, u); return u;
    },
    async delBlob(id) { try { await idb.del(BL, id); if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); } } catch (e) { console.warn(e); } },
    blobIdsOf(rec) {
      const out = []; const walk = (o) => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if ((k === 'blobId') && typeof v === 'string') out.push(v); else if (typeof v === 'object') walk(v); } };
      walk(rec); return out;
    },
    /** pełna kopia: baza + wszystkie pliki (base64) – do przeniesienia na inny komputer/telefon */
    async exportFull() {
      const keys = await idb.keys(BL); const blobs = {};
      for (const k of keys) { const r = await idb.get(BL, k); if (r && r.blob) blobs[k] = { d: await M.blobToDataURL(r.blob), name: r.name, w: r.w, h: r.h }; }
      return JSON.stringify({ app: 'BiuroBudowy', version: 1, exported: new Date().toISOString(), db: S.db, blobs });
    },
    async importFull(text) {
      const o = JSON.parse(text);
      if (!o || o.app !== 'BiuroBudowy' || !o.db) throw new Error('To nie jest kopia aplikacji Biuro Budowy');
      await idb.clear(BL); urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
      for (const [k, v] of Object.entries(o.blobs || {})) await idb.set(BL, k, { blob: M.dataURLToBlob(v.d), type: '', name: v.name || '', w: v.w || 0, h: v.h || 0, ts: Date.now() });
      S.replaceAll(o.db); await S.flush();
    },
    async wipe() { if (M.SYNC) await M.SYNC.reset(); await idb.clear(BL); urlCache.clear(); S.db = emptyDB(); await S.flush(); },
  };

  // =========================================================
  //  Folder danych (File System Access API – Edge / Chrome)
  // =========================================================
  const FS = M.FS = {
    status: 'off', handle: null, lastWrite: null,
    supported: () => 'showDirectoryPicker' in window,
    async init() {
      if (!FS.supported()) { FS.status = 'unsupported'; FS.ui(); return; }
      try {
        const h = await idb.get(KV, 'dirHandle'); if (!h) { FS.ui(); return; }
        FS.handle = h;
        const p = await h.queryPermission({ mode: 'readwrite' });
        FS.status = p === 'granted' ? 'ok' : 'prompt';
      } catch (e) { FS.status = 'off'; }
      FS.ui();
    },
    async connect() {
      try {
        const h = await window.showDirectoryPicker({ id: 'biuro-budowy', mode: 'readwrite' });
        FS.handle = h; await idb.set(KV, 'dirHandle', h); FS.status = 'ok'; FS.ui();
        await FS.saveDb(true); await FS.syncAllBlobs();
        M.toast('Folder danych połączony: ' + h.name);
      } catch (e) { if (e.name !== 'AbortError') M.toast('Nie połączono folderu: ' + e.message, 'err'); }
    },
    async resume() {
      if (!FS.handle) return FS.connect();
      const p = await FS.handle.requestPermission({ mode: 'readwrite' });
      FS.status = p === 'granted' ? 'ok' : 'prompt'; FS.ui(); if (FS.status === 'ok') { await FS.saveDb(true); M.toast('Autozapis wznowiony'); }
    },
    async disconnect() { FS.handle = null; FS.status = 'off'; await idb.del(KV, 'dirHandle'); FS.ui(); },
    async write(parts, data) {
      let dir = FS.handle; for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
      const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
      const w = await fh.createWritable(); await w.write(data); await w.close();
    },
    async read(parts) {
      let dir = FS.handle; for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
      const fh = await dir.getFileHandle(parts[parts.length - 1]); return fh.getFile();
    },
    saveDb: M.debounce(async function (force) {
      if (FS.status !== 'ok') return;
      try {
        const json = JSON.stringify(S.db);
        await FS.write(['BiuroBudowy_baza.json'], json);
        const day = M.todayISO();
        if (force || FS.lastBackup !== day) { await FS.write(['Kopie', `BiuroBudowy_${day}.json`], json); FS.lastBackup = day; }
        FS.lastWrite = new Date(); FS.ui();
      } catch (e) { console.error(e); FS.status = 'prompt'; FS.ui(); }
    }, 800),
    async saveBlob(id, blob) {
      if (FS.status !== 'ok') return;
      try { await FS.write(['pliki', id + (blob.type === 'image/png' ? '.png' : '.jpg')], blob); } catch (e) { console.warn(e); }
    },
    async syncAllBlobs() {
      const keys = await idb.keys(BL); let n = 0;
      for (const k of keys) { const r = await idb.get(BL, k); if (r && r.blob) { await FS.saveBlob(k, r.blob); n++; } }
      return n;
    },
    /** odtworzenie bazy z folderu (np. po wyczyszczeniu przeglądarki) */
    async restore() {
      if (FS.status !== 'ok') throw new Error('Folder nie jest połączony');
      const f = await FS.read(['BiuroBudowy_baza.json']); const db = JSON.parse(await f.text());
      let dir; try { dir = await FS.handle.getDirectoryHandle('pliki'); } catch (e) { dir = null; }
      if (dir) for await (const [name, h] of dir.entries()) { if (h.kind !== 'file') continue; const id = name.replace(/\.(jpg|png)$/i, ''); const file = await h.getFile(); await idb.set(BL, id, { blob: file, type: file.type, name, ts: Date.now() }); }
      S.replaceAll(db); await S.flush();
    },
    ui() {
      const b = document.getElementById('syncBtn'), t = document.getElementById('syncTxt'); if (!b) return;
      b.classList.remove('ok', 'warn');
      if (FS.status === 'ok') { b.classList.add('ok'); t.textContent = 'folder: ' + FS.handle.name + (FS.lastWrite ? ' · ' + M.pad(FS.lastWrite.getHours()) + ':' + M.pad(FS.lastWrite.getMinutes()) : ''); }
      else if (FS.status === 'prompt') { b.classList.add('warn'); t.textContent = 'autozapis wstrzymany – kliknij'; }
      else t.textContent = S.idbOk ? 'zapis w przeglądarce' : 'brak zapisu!';
    },
  };
})(window.M);
