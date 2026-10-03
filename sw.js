/* TEK-BIURO BUDOWY — praca bez internetu + poprawki online.
   Zasada: NAJPIERW SIEĆ. Gdy jest internet, zawsze pobierana jest świeża wersja pliku
   (poprawka opublikowana na serwerze jest widoczna od razu po ponownym otwarciu).
   Gdy internetu nie ma – używana jest ostatnia zapisana kopia. */
const CACHE = 'tekbb-v2';
const ASSETS = ["./", "assets/icon-192.png", "assets/icon-256.png", "assets/icon-512-maskable.png", "assets/icon-512.png", "assets/logo-tek-512.png", "assets/logo-tek-full.svg", "assets/logo-tek.svg", "css/style.css", "index.html", "js/ai.js", "js/app.js", "js/demo.js", "js/konfiguracja.js", "js/lib/exceljs.min.js", "js/lib/jszip.min.js", "js/lib/pdf.min.js", "js/lib/pdf.worker.min.js", "js/lib/pptx_sample.js", "js/lib/supabase.js", "js/licencja.js", "js/mail.js", "js/modules/asystent.js", "js/modules/breeam.js", "js/modules/dziennik.js", "js/modules/harmonogram.js", "js/modules/home.js", "js/modules/montaz.js", "js/modules/narady.js", "js/modules/raport_pptx.js", "js/modules/raporty.js", "js/modules/rzuty.js", "js/modules/terminy.js", "js/modules/ustawienia.js", "js/modules/uwagi.js", "js/modules/wlasne.js", "js/modules/zanikowe.js", "js/modules/zgloszenia.js", "js/perm.js", "js/pptx.js", "js/print.js", "js/store.js", "js/sync.js", "js/ui.js", "js/util.js", "js/wersja.js", "js/wzory.js", "manifest.webmanifest"];
self.addEventListener('install', (ev) => { ev.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(u => fetch(u, { cache: 'no-cache' }).then(r => r.ok ? c.put(u, r) : null).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (ev) => { ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (ev) => {
  const req = ev.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;          // pogoda, AI itp. – bez pośrednictwa
  if (url.pathname.endsWith('version.json')) return;                            // numer wersji zawsze z sieci
  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(url.pathname + url.search, { cache: 'no-cache', credentials: 'same-origin' });
      if (res.ok) cache.put(url.pathname, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(url.pathname) || (req.mode === 'navigate' ? await cache.match(new URL('index.html', self.registration.scope).pathname) || await cache.match('index.html') : null);
      if (hit) return hit;
      throw err;
    }
  })());
});
