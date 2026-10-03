/* =========================================================
   BIURO BUDOWY — synchronizacja z chmurą (Supabase)
   ---------------------------------------------------------
   Jak to działa (w skrócie, jak obieg dokumentów na budowie):
   • Każde urządzenie ma własną, pełną kopię danych i działa bez internetu.
   • Co chwilę (i po każdej zmianie) aplikacja: 1) POBIERA z chmury rekordy zmienione
     przez innych, 2) WYSYŁA rekordy zmienione tutaj, 3) wysyła nowe zdjęcia i rzuty.
   • „Co się zmieniło” ustala przez porównanie odcisku (skrótu) każdego rekordu z odciskiem
     z ostatniej synchronizacji – dlatego nie gubi zmian, niezależnie od modułu.
   • Gdy ten sam rekord zmieniły dwie osoby, wygrywa późniejsza zmiana (zapis w dzienniku konfliktów).
   • Usunięcie to znacznik „usunięty” w chmurze – inne urządzenia też usuwają rekord.
   • Zdjęcia i rzuty pobierają się na drugim urządzeniu dopiero wtedy, gdy są potrzebne.
   Dostęp do danych pilnuje serwer (logowanie + reguły RLS), nie ten plik.
   ========================================================= */
(function (M) {
  'use strict';
  const S = M.S;
  const SKIP = ['aiLog', 'pilotTimes', 'pilotNotes'];                 // tabele tylko lokalne
  const SHARED = ['modules', 'customModules', 'prompts', 'feedbackEmail']; // ustawienia wspólne dla zespołu
  const BUCKET = 'bb-files';
  const tables = () => S.TABLES.filter(t => !SKIP.includes(t));
  const canon = (v) => v === null || typeof v !== 'object' ? JSON.stringify(v === undefined ? null : v) : Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  /** odcisk rekordu (cyrb53) – niezależny od kolejności pól */
  const hash = (obj) => { const str = canon(obj); let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ':' + str.length; };
  const key = (t, id) => t + '|' + id;
  const emptyState = () => ({ snap: {}, cursor: '', blobUp: {}, lastOk: 0, email: '', conflicts: [] });

  // ---------------- połączenie z Supabase (wymienne w testach) ----------------
  const cfg = () => { let o = {}; try { o = JSON.parse(localStorage.getItem('tekbb-cloud') || '{}'); } catch (e) { /* */ } const c = M.CLOUD_CFG || {}; return { url: (o.url || c.url || '').trim().replace(/\/+$/, ''), key: (o.key || c.key || '').trim() }; };
  let client = null, clientFor = '';
  const supa = () => { const c = cfg(); if (!c.url || !c.key) throw new Error('Brak adresu projektu lub klucza Supabase'); if (!window.supabase) throw new Error('Nie wczytano biblioteki Supabase'); if (!client || clientFor !== c.url + c.key) { client = window.supabase.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tekbb-auth' } }); clientFor = c.url + c.key; } return client; };
  const ok = (r) => { if (r.error) { const e = new Error(r.error.message || String(r.error)); e.code = r.error.code || r.error.status; throw e; } return r.data; };
  const SUPA = {
    configured: () => { const c = cfg(); return !!(c.url && c.key); },
    async user() { const d = ok(await supa().auth.getSession()); return d.session ? d.session.user.email : null; },
    async signIn(email, password) { ok(await supa().auth.signInWithPassword({ email, password })); },
    async signOut() { try { await supa().auth.signOut(); } catch (e) { /* offline – sesja i tak zostanie usunięta lokalnie */ } },
    async pull(since) { const out = []; for (let from = 0; ; from += 1000) { let q = supa().from('bb_records').select('tbl,id,data,deleted,updated_at,updated_by'); if (since) q = q.gt('updated_at', since); const rows = ok(await q.order('updated_at').order('tbl').order('id').range(from, from + 999)); out.push(...rows); if (rows.length < 1000) break; } return out; },
    async push(rows) { for (let i = 0; i < rows.length; i += 200) ok(await supa().from('bb_records').upsert(rows.slice(i, i + 200), { onConflict: 'tbl,id' })); },
    async upload(id, blob) { ok(await supa().storage.from(BUCKET).upload(id, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })); },
    async download(id) { return ok(await supa().storage.from(BUCKET).download(id)); },
    async getOne(tbl, id) { return ok(await supa().from('bb_records').select('tbl,id,data,deleted,updated_by').eq('tbl', tbl).eq('id', id).maybeSingle()); },
  };

  // ---------------- stan ----------------
  let st = emptyState(), loaded = false, busy = false, again = false, timer = null, lastErr = '', applying = false;
  const load = async () => { if (loaded) return; try { st = Object.assign(emptyState(), (await S.kv.get('syncState')) || {}); } catch (e) { /* */ } loaded = true; };
  const persist = () => S.kv.set('syncState', st).catch(() => {});

  const sharedRec = () => { const o = { id: 'shared', updated: S.settings.sharedUpdated || 0 }; SHARED.forEach(k => { if (S.settings[k] !== undefined) o[k] = S.settings[k]; }); return o; };
  /** wszystkie lokalne rekordy podlegające synchronizacji: klucz → {t, id, rec} */
  const collect = () => { const m = new Map(); tables().forEach(t => (S.db[t] || []).forEach(r => { if (r && r.id) m.set(key(t, r.id), { t, id: r.id, rec: r }); })); if (S.settings.sharedUpdated) m.set(key('_settings', 'shared'), { t: '_settings', id: 'shared', rec: sharedRec() }); return m; };
  const localGet = (t, id) => t === '_settings' ? (S.settings.sharedUpdated ? sharedRec() : null) : (S.db[t] || []).find(r => r.id === id) || null;
  const localSet = (t, id, data) => { if (t === '_settings') { SHARED.forEach(k => { if (data[k] !== undefined) S.db.settings[k] = data[k]; }); S.db.settings.sharedUpdated = data.updated || Date.now(); return; } const a = S.db[t]; const i = a.findIndex(r => r.id === id); if (i >= 0) a[i] = data; else a.push(data); };
  const localDel = (t, id) => { if (t === '_settings') return; S.db[t] = S.db[t].filter(r => r.id !== id); };
  const known = (t) => t === '_settings' || tables().includes(t);

  const SYNC = M.SYNC = {
    adapter: SUPA, cfg, hash,
    get state() { return st; }, get error() { return lastErr; }, get busy() { return busy; },
    enabled: () => SYNC.adapter.configured() && !!st.email,
    pending() { if (!loaded) return 0; const loc = collect(); let n = 0; loc.forEach((v, k) => { if (hash(v.rec) !== st.snap[k]) n++; }); Object.keys(st.snap).forEach(k => { if (!loc.has(k)) n++; }); return n; },

    async init() {
      await load();
      S.on((what) => { if (what === 'sync' || applying) return; if (what === 'replace') SYNC.onReplace(); SYNC.soon(); SYNC.ui(); });
      window.addEventListener('online', () => SYNC.soon(500)); window.addEventListener('offline', () => SYNC.ui());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) SYNC.soon(800); });
      setInterval(() => { if (!document.hidden) SYNC.run(); }, 45000);
      SYNC.ui(); if (SYNC.enabled()) SYNC.soon(1200);
    },
    soon(ms = 4000) { if (!SYNC.enabled()) return; clearTimeout(timer); timer = setTimeout(() => SYNC.run(), ms); },
    /** po wczytaniu kopii / odtworzeniu z folderu: scal od nowa z chmurą, niczego w chmurze nie kasuj */
    onReplace() { st.snap = {}; st.cursor = ''; persist(); },
    async signIn(email, password) { await load(); await SYNC.adapter.signIn(email.trim(), password); st.email = email.trim().toLowerCase(); st.snap = {}; st.cursor = ''; await persist(); lastErr = ''; SYNC.ui(); return SYNC.run(); },
    async signOut() { await SYNC.adapter.signOut(); st = emptyState(); await persist(); lastErr = ''; SYNC.ui(); },
    /** „Wyczyść wszystkie dane” dotyczy tylko tego urządzenia: najpierw odłącz chmurę, żeby nie rozesłać usunięć */
    async reset() { clearTimeout(timer); try { await SYNC.adapter.signOut(); } catch (e) { /* */ } st = emptyState(); await persist(); SYNC.ui(); },

    async run() {
      await load();
      if (!SYNC.enabled()) return { skipped: 'off' };
      if (busy) { again = true; return { skipped: 'busy' }; }
      if (navigator.onLine === false) { SYNC.ui(); return { skipped: 'offline' }; }
      busy = true; SYNC.ui(); const res = { pulled: 0, applied: 0, pushed: 0, deleted: 0, files: 0, conflicts: 0 };
      try {
        if (!(await SYNC.adapter.user())) { lastErr = 'Sesja wygasła – zaloguj się ponownie'; st.email = ''; await persist(); throw new Error(lastErr); }
        // ---- 1. pobierz zmiany innych (z zakładką 10 s na opóźnione zapisy) ----
        const since = st.cursor ? new Date(new Date(st.cursor).getTime() - 10000).toISOString() : '';
        const rows = await SYNC.adapter.pull(since); res.pulled = rows.length; let maxAt = st.cursor;
        applying = true;
        for (const r of rows) {
          if (!maxAt || r.updated_at > maxAt) maxAt = r.updated_at;
          if (!known(r.tbl)) continue;
          const k = key(r.tbl, r.id); const loc = localGet(r.tbl, r.id); const lh = loc ? hash(loc) : null; const sh = st.snap[k];
          if (r.deleted) {
            if (!loc) { delete st.snap[k]; continue; }
            if (sh !== undefined && lh === sh) { localDel(r.tbl, r.id); delete st.snap[k]; res.applied++; }            // u mnie bez zmian → usuń
            else { res.conflicts++; SYNC.conflict(r, 'usunięty w chmurze, zmieniony tutaj – zostawiono wersję z tego urządzenia'); delete st.snap[k]; }
            continue;
          }
          const rh = hash(r.data);
          if (!loc) { if (sh !== undefined && sh === rh) continue;                                                     // usunięty tutaj, w chmurze bez zmian → pójdzie znacznik usunięcia
            localSet(r.tbl, r.id, r.data); st.snap[k] = rh; res.applied++; continue; }
          if (lh === rh) { st.snap[k] = rh; continue; }                                                                 // to samo
          if (sh !== undefined && lh === sh) { localSet(r.tbl, r.id, r.data); st.snap[k] = rh; res.applied++; continue; } // u mnie bez zmian → weź z chmury
          if (sh !== undefined && sh === rh) continue;                                                                  // w chmurze bez zmian → moja zmiana pójdzie w górę
          // zmiana po obu stronach: wygrywa późniejsza
          res.conflicts++;
          if ((r.data.updated || 0) > (loc.updated || 0)) { localSet(r.tbl, r.id, r.data); st.snap[k] = rh; res.applied++; SYNC.conflict(r, 'zmieniony na dwóch urządzeniach – przyjęto nowszą wersję z chmury'); }
          else SYNC.conflict(r, 'zmieniony na dwóch urządzeniach – zostawiono nowszą wersję z tego urządzenia');
        }
        applying = false; st.cursor = maxAt || st.cursor;
        // ---- 2. wyślij moje zmiany i usunięcia ----
        const loc = collect(); const up = [];
        loc.forEach((v, k) => { const h = hash(v.rec); if (h !== st.snap[k]) up.push({ k, h, row: { tbl: v.t, id: v.id, data: v.rec, deleted: false } }); });
        Object.keys(st.snap).forEach(k => { if (!loc.has(k)) { const i = k.indexOf('|'); up.push({ k, h: null, row: { tbl: k.slice(0, i), id: k.slice(i + 1), data: {}, deleted: true } }); } });
        if (up.length) { await SYNC.adapter.push(up.map(u => u.row)); up.forEach(u => { if (u.h) { st.snap[u.k] = u.h; res.pushed++; } else { delete st.snap[u.k]; res.deleted++; } }); }
        // ---- 3. pliki: wyślij te, których chmura jeszcze nie ma (porcjami) ----
        const ids = new Set(); loc.forEach(v => S.blobIdsOf(v.rec).forEach(b => ids.add(b))); let n = 0;
        for (const id of ids) { if (st.blobUp[id]) continue; const b = await S.localBlob(id); if (!b) continue; await SYNC.adapter.upload(id, b); st.blobUp[id] = 1; res.files++; if (++n >= 25) { again = true; break; } }
        st.lastOk = Date.now(); lastErr = ''; await persist();
        if (res.applied) { S.touch('sync'); if (!document.querySelector('.modal-bg,.drawer') && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) M.refresh(); else M.toast(`Pobrano ${res.applied} ${M.plural(res.applied, 'zmianę', 'zmiany', 'zmian')} z chmury – zobaczysz je po przejściu do innego widoku`); if (M.FEEDBACK) M.FEEDBACK.badge(); }
      } catch (err) { applying = false; lastErr = SYNC.explain(err); console.warn('Synchronizacja:', err); await persist(); res.error = lastErr; }
      busy = false; SYNC.ui();
      if (again) { again = false; SYNC.soon(1500); }
      return res;
    },
    conflict(r, what) { st.conflicts.unshift({ ts: Date.now(), tbl: r.tbl, id: r.id, by: r.updated_by || '', what }); st.conflicts = st.conflicts.slice(0, 30); },
    /** komunikaty błędów po ludzku */
    explain(err) { const m = String((err && err.message) || err); if (/row-level security|permission denied|42501/i.test(m)) return 'Brak uprawnień w chmurze: adres e-mail tego konta nie jest na liście bb_members albo nie uruchomiono skryptu SQL.'; if (/Invalid login credentials/i.test(m)) return 'Nieprawidłowy e-mail lub hasło.'; if (/Email not confirmed/i.test(m)) return 'Konto nie jest potwierdzone – przy zakładaniu użytkownika zaznacz „Auto Confirm User”.'; if (/relation .* does not exist|Could not find the table|PGRST205/i.test(m)) return 'W chmurze nie ma tabeli bb_records – uruchom skrypt SQL z instrukcji.'; if (/Bucket not found/i.test(m)) return 'W chmurze nie ma magazynu plików „bb-files” – uruchom skrypt SQL z instrukcji.'; if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Brak połączenia z chmurą (internet albo błędny adres projektu).'; if (/Invalid API key|No API key/i.test(m)) return 'Błędny klucz Supabase (wklej klucz „publishable” albo „anon”).'; return m; },

    /** plik, którego nie ma na tym urządzeniu → pobierz z chmury i zapamiętaj */
    async fetchBlob(id) { await load(); if (!SYNC.enabled() || navigator.onLine === false) return null; try { const b = await SYNC.adapter.download(id); if (!b) return null; await S.storeBlob(id, b); st.blobUp[id] = 1; persist(); return b; } catch (e) { console.warn('Plik z chmury', id, e.message); return null; } },
    async fetchAllBlobs(onProgress) { const ids = new Set(); collect().forEach(v => S.blobIdsOf(v.rec).forEach(b => ids.add(b))); let done = 0, got = 0; for (const id of ids) { if (!(await S.localBlob(id))) { if (await SYNC.fetchBlob(id)) got++; } done++; if (onProgress) onProgress(done, ids.size); } return { all: ids.size, got }; },

    /** test połączenia krok po kroku – wynik pokazuje, co poprawić w Supabase */
    async selfTest() {
      const out = []; const step = async (name, fn) => { try { const d = await fn(); out.push({ name, ok: true, d: d || '' }); return true; } catch (e) { out.push({ name, ok: false, d: SYNC.explain(e) }); return false; } };
      const A = SYNC.adapter; const id = 'test-' + Date.now().toString(36);
      if (!await step('Adres projektu i klucz', async () => { if (!A.configured()) throw new Error('Uzupełnij plik js/konfiguracja.js albo pola poniżej'); return cfg().url; })) return out;
      let email = ''; if (!await step('Logowanie', async () => { email = await A.user(); if (!email) throw new Error('Nie jesteś zalogowany'); return email; })) return out;
      if (!await step('Odczyt tabeli bb_records', async () => { const r = await A.pull(new Date(Date.now() + 3600000).toISOString()); return `tabela istnieje (${r.length})`; })) return out;
      if (!await step('Zapis rekordu próbnego', async () => { await A.push([{ tbl: '_test', id, data: { ping: id, device: navigator.userAgent.slice(0, 60) }, deleted: false }]); })) return out;
      await step('Odczyt rekordu próbnego', async () => { const r = await A.getOne('_test', id); if (!r || !r.data || r.data.ping !== id) throw new Error('Rekord zapisany, ale niewidoczny – sprawdź, czy e-mail jest w bb_members'); return 'zapisał: ' + (r.updated_by || '?'); });
      await step('Sprzątanie rekordu próbnego', async () => { await A.push([{ tbl: '_test', id, data: {}, deleted: true }]); });
      if (await step('Wysłanie pliku próbnego', async () => { await A.upload('_' + id, new Blob(['test ' + id], { type: 'text/plain' })); }))
        await step('Pobranie pliku próbnego', async () => { const b = await A.download('_' + id); const t = await b.text(); if (!t.includes(id)) throw new Error('Plik ma inną treść'); return t.length + ' B'; });
      return out;
    },

    /** przycisk stanu w pasku górnym */
    ui() {
      const b = document.getElementById('cloudBtn'); if (!b) return;
      if (!SYNC.adapter.configured() || (M.LIC && !M.LIC.get())) { b.className = 'sync hidden'; return; }
      const t = b.querySelector('span:last-child'); b.className = 'sync'; const off = navigator.onLine === false;
      if (!st.email) { b.classList.add('warn'); t.textContent = 'chmura: zaloguj'; b.title = 'Synchronizacja wyłączona – kliknij, aby się zalogować'; }
      else if (busy) { b.classList.add('ok'); t.textContent = 'synchronizuję…'; }
      else if (off) { b.classList.add('warn'); const n = SYNC.pending(); t.textContent = `offline${n ? ' · ' + n + ' do wysłania' : ''}`; b.title = 'Brak internetu – zmiany wyślą się po powrocie sieci'; }
      else if (lastErr) { b.classList.add('err'); t.textContent = 'chmura: błąd'; b.title = lastErr; }
      else { b.classList.add('ok'); const d = st.lastOk ? new Date(st.lastOk) : null; t.textContent = d ? `chmura ${M.pad(d.getHours())}:${M.pad(d.getMinutes())}` : 'chmura'; b.title = 'Dane zsynchronizowane. Kliknij, aby zobaczyć szczegóły.'; }
    },
  };
})(window.M);
