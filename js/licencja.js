/* =========================================================
   BIURO BUDOWY — kod licencyjny (wersja testowa)
   ---------------------------------------------------------
   Kod wpisuje się raz na urządzeniu. W pliku są tylko skróty (SHA-256) kodów,
   nie same kody. UWAGA: to bramka porządkowa, nie zabezpieczenie danych –
   dane leżą w przeglądarce użytkownika, a kod aplikacji jest publiczny.
   Prawdziwe logowanie i uprawnienia przyjdą razem z serwerem (synchronizacją).
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc; const KEY = 'tekbb-licencja';
  const CODES = [
    { h: '38c2c91fd548d703102b4193dd8e0d7d1e044c07a6a4cf70e38c85233339f42b', label: 'Kierownik budowy – tester', owner: false },
    { h: '63b7f1b315a407d72c8fbc28a51c16816594dea7ae95fafe183d2a0e20085d5d', label: 'Autor aplikacji', owner: true },
  ];
  /** SHA-256 (czysty JavaScript – działa także przy otwarciu z pliku) */
  function sha256(str) {
    const K = [], H = []; const isP = (n) => { for (let f = 2; f * f <= n; f++) if (n % f === 0) return false; return true; };
    for (let n = 2, i = 0; i < 64; n++) if (isP(n)) { if (i < 8) H[i] = (Math.sqrt(n) * 4294967296) >>> 0; K[i++] = (Math.cbrt(n) * 4294967296) >>> 0; }
    const bytes = Array.from(new TextEncoder().encode(str)); const l = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (l >>> (i * 8)) & 255);
    const h = H.slice(); const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      const w = []; for (let i = 0; i < 16; i++) w[i] = ((bytes[o + 4 * i] << 24) | (bytes[o + 4 * i + 1] << 16) | (bytes[o + 4 * i + 2] << 8) | bytes[o + 4 * i + 3]) >>> 0;
      for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
      let [a, b, c, d, f, g, x, y] = h;
      for (let i = 0; i < 64; i++) { const S1 = r(f, 6) ^ r(f, 11) ^ r(f, 25), ch = (f & g) ^ (~f & x), t1 = (y + S1 + ch + K[i] + w[i]) >>> 0, S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0; y = x; x = g; g = f; f = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0; }
      [a, b, c, d, f, g, x, y].forEach((v, i) => h[i] = (h[i] + v) >>> 0);
    }
    return h.map(v => v.toString(16).padStart(8, '0')).join('');
  }
  const norm = (code) => { const s = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length === 17 ? `${s.slice(0, 5)}-${s.slice(5, 9)}-${s.slice(9, 13)}-${s.slice(13)}` : s; };
  const LIC = M.LIC = {
    sha256,
    get() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && CODES.some(c => c.h === o.h) ? o : null; } catch (err) { return null; } },
    check(code) { const h = sha256(norm(code)); return CODES.find(c => c.h === h) || null; },
    activate(code, name) { const c = LIC.check(code); if (!c) return null; const o = { h: c.h, label: c.label, owner: c.owner, name: name.trim(), at: Date.now() }; localStorage.setItem(KEY, JSON.stringify(o)); return o; },
    reset() { localStorage.removeItem(KEY); },
    /** osoba odpowiadająca licencji tego urządzenia – tworzona, jeśli jej nie ma (np. po wczytaniu cudzej kopii) */
    ensureUser() {
      const l = LIC.get(); if (!l) return; const S = M.S;
      let me = S.db.people.find(p => p.licHash === l.h);
      if (!me) { me = { id: 'lic' + l.h.slice(0, 12), name: l.name || l.label, role: 'KB', companyId: '', email: '', licHash: l.h, owner: !!l.owner, created: Date.now() }; S.db.people.push(me); }
      if (S.db.settings.currentUser !== me.id) { S.db.settings.currentUser = me.id; S.touch('people'); }
    },
    /** ekran aktywacji */
    screen() {
      document.body.classList.add('locked');
      const v = document.getElementById('view');
      v.innerHTML = `<div class="lic"><div class="card card-pad col"><img src="assets/logo-tek-full.svg" alt="" style="height:54px;align-self:flex-start"><h1 style="font-size:22px">Aktywacja – wersja testowa</h1>
        <p class="muted" style="margin:0">Wpisz kod licencyjny, który dostałeś od autora aplikacji. Robisz to raz na każdym urządzeniu (komputer, telefon).</p>
        <label class="f">Kod licencyjny<input type="text" id="lc" placeholder="TEKBB-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" style="font-family:ui-monospace,Consolas,monospace;letter-spacing:1px"></label>
        <label class="f">Imię i nazwisko<input type="text" id="ln" autocomplete="name"></label>
        <div id="lerr" class="banner or hidden">${M.icon.alert}<span></span></div>
        <div><button class="btn primary big" id="lok">${M.icon.check}Aktywuj</button></div>
        <div class="xs muted">${e(M.APP_VERSION)} · dane zapisują się tylko na tym urządzeniu.</div></div></div>`;
      const err = (t) => { const b = v.querySelector('#lerr'); b.classList.remove('hidden'); b.querySelector('span').textContent = t; };
      const go = () => { const code = v.querySelector('#lc').value, name = v.querySelector('#ln').value; if (!LIC.check(code)) return err('Nieprawidłowy kod. Sprawdź, czy wpisałeś wszystkie znaki (zero i litera O nie występują w kodzie).'); if (name.trim().length < 3) return err('Podaj imię i nazwisko.'); LIC.activate(code, name); document.body.classList.remove('locked'); LIC.ensureUser(); M.go(''); M.render(); if (M.onActivated) M.onActivated(); };
      v.querySelector('#lok').onclick = go; v.querySelectorAll('input').forEach(i => i.onkeydown = (ev) => { if (ev.key === 'Enter') go(); }); v.querySelector('#lc').focus();
    },
  };
})(window.M);
