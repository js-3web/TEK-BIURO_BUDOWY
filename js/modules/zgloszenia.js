/* =========================================================
   BIURO BUDOWY — Uwagi do aplikacji (wersja testowa)
   Tester zapisuje, co nie działa albo przeszkadza, i wysyła listę autorowi
   (mail albo „kopiuj”). Autor poprawia i publikuje nową wersję pod tym samym adresem.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const KIND = [['blad', 'Błąd – coś nie działa'], ['uciazliwe', 'Uciążliwe – działa, ale przeszkadza'], ['pomysl', 'Pomysł / brakuje mi'], ['pytanie', 'Nie wiem, jak to zrobić']];
  const ST = { nowe: ['Nowe', 'open'], wyslane: ['Wysłane', 'check'], poprawione: ['Poprawione', 'done'] };
  const list = () => M.S.all('feedback', true).slice().sort((a, b) => (b.created || 0) - (a.created || 0));
  const line = (f) => `[${M.fmtTs(f.created)}] ${(KIND.find(k => k[0] === f.kind) || [])[1] || ''}\nGdzie: ${f.where || '—'} · wersja ${f.build || ''} · ${f.device || ''}\n${f.text}`;
  const pack = (items) => `TEK-BIURO BUDOWY – uwagi z testu (${M.fmt(M.todayISO())}), zgłasza: ${(M.S.me() || {}).name || ''}\n\n` + items.map((f, i) => `${i + 1}. ${line(f)}`).join('\n\n');
  const add = () => {
    const where = (location.hash.replace(/^#\/?/, '') || 'pulpit'); const title = document.title.replace(' · TEK-BIURO BUDOWY', '');
    const m = M.UI.modal({ title: 'Zgłoś uwagę do aplikacji', body: `<div class="col"><label class="f">Rodzaj<select id="k">${M.UI.opts(KIND, 'blad')}</select></label><div class="row"><b class="small grow">Opis – co robiłeś, co się stało, co powinno się stać</b><button class="btn sm" id="dict">${M.icon.mic}Dyktuj</button></div><textarea id="t" rows="6"></textarea><div class="xs muted">Zapisze się też miejsce w aplikacji: <b>${e(title)}</b> i numer wersji.</div></div>`, footer: `<button class="btn primary" id="ok">${M.icon.check}Zapisz uwagę</button>` });
    M.UI.dictate(m.querySelector('#dict'), m.querySelector('#t')); m.querySelector('#t').focus();
    m.querySelector('#ok').onclick = () => { const t = m.querySelector('#t').value.trim(); if (!t) return M.toast('Opisz uwagę', 'warn'); M.S.upsert('feedback', { kind: m.querySelector('#k').value, text: t, where: `${title} (${where})`, build: M.APP_BUILD, device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'telefon' : 'komputer', status: 'nowe', projectId: '' }); m.close(); M.toast('Zapisano uwagę – wyślij ją z modułu „Uwagi do aplikacji”'); if ((location.hash || '').includes('zgloszenia')) M.refresh(); else M.FEEDBACK.badge(); };
  };
  M.FEEDBACK = { add, badge() { const b = document.getElementById('pilotBadge'); if (!b) return; if (!M.LIC.get()) { b.innerHTML = ''; return; } const n = list().filter(f => f.status === 'nowe').length; b.innerHTML = `<button class="btn sm soft" id="fbBtn" title="Zgłoś uwagę do aplikacji">${M.icon.flag}<span class="hide-m">Zgłoś uwagę</span>${n ? ` <span class="badge or">${n}</span>` : ''}</button>`; b.querySelector('#fbBtn').onclick = add; } };

  M.modules.zgloszenia = {
    title: 'Uwagi do aplikacji', icon: 'flag', order: 98,
    desc: 'Wersja testowa: zapisz, co nie działa lub przeszkadza, i wyślij autorowi. Poprawki pojawią się po odświeżeniu aplikacji.',
    render(v) {
      const L = list(); const fresh = L.filter(f => f.status === 'nowe'); const mail = M.S.settings.feedbackEmail || '';
      v.innerHTML = M.UI.head('Uwagi <span class="acc">do aplikacji</span>', `Wersja testowa · ${e(M.APP_VERSION)}`, `<button class="btn primary" id="add">${M.icon.plus}Nowa uwaga</button><button class="btn" id="send" ${fresh.length ? '' : 'disabled'}>${M.icon.mail}Wyślij nowe (${fresh.length})</button><button class="btn" id="copy" ${L.length ? '' : 'disabled'}>${M.icon.copy}Kopiuj wszystkie</button>`) +
        `<div class="banner info" style="margin-bottom:12px">${M.icon.flag}<span><b>Jak to działa:</b> zapisujesz uwagę od razu, gdy coś zauważysz (przycisk „Zgłoś uwagę” jest też w pasku u góry). Raz dziennie albo po kilku uwagach klikasz „Wyślij nowe”. Autor publikuje poprawkę pod tym samym adresem – zobaczysz ją po ponownym otwarciu aplikacji albo po kliknięciu „Nowa wersja – odśwież”.</span></div>
        <div class="card card-pad row" style="margin-bottom:12px"><label class="f grow">Adres e-mail autora (dokąd wysyłać uwagi)<input type="email" id="fm" value="${e(mail)}" placeholder="adres podany przez autora aplikacji"></label></div>
        <div class="card">${L.length ? `<table class="list"><thead><tr><th>Data</th><th>Uwaga</th><th class="hide-m">Gdzie</th><th>Status</th><th></th></tr></thead><tbody>${L.map(f => `<tr data-id="${f.id}"><td class="num nowrap">${e(M.fmtTs(f.created))}<div class="xs muted">${e(f.build || '')} · ${e(f.device || '')}</div></td><td><span class="badge ${f.kind === 'blad' ? 'danger' : f.kind === 'pomysl' ? 'info' : 'warn'}">${e(((KIND.find(k => k[0] === f.kind) || [])[1] || '').split(' – ')[0])}</span><div style="white-space:pre-wrap;margin-top:3px">${e(f.text)}</div></td><td class="hide-m small">${e(f.where || '')}</td><td><select data-st>${M.UI.opts(Object.entries(ST).map(([k, s]) => [k, s[0]]), f.status)}</select></td><td><button class="btn icon ghost sm" data-del title="Usuń">${M.icon.trash}</button></td></tr>`).join('')}</tbody></table>` : M.UI.empty('Brak uwag. Każda uwaga pomaga – także drobna.', 'flag')}</div>`;
      v.querySelector('#add').onclick = add;
      v.querySelector('#fm').onchange = (ev) => M.S.set('feedbackEmail', ev.target.value.trim());
      v.querySelector('#copy').onclick = () => M.copy(pack(L), 'Skopiowano wszystkie uwagi');
      v.querySelector('#send').onclick = () => { const to = M.S.settings.feedbackEmail || ''; if (!to) M.toast('Brak adresu autora – wiadomość otworzy się bez adresata', 'warn'); const body = pack(fresh); if (body.length > 1800) { M.copy(body, 'Lista jest długa – skopiowano ją. Wklej treść do maila (Ctrl+V).'); M.ML.mailto({ to, subject: `TEK-BIURO BUDOWY – uwagi z testu (${fresh.length})`, body: '(wklej tutaj skopiowaną listę uwag – Ctrl+V)' }); } else M.ML.mailto({ to, subject: `TEK-BIURO BUDOWY – uwagi z testu (${fresh.length})`, body }); fresh.forEach(f => { f.status = 'wyslane'; M.S.upsert('feedback', f, true); }); M.S.touch('feedback'); M.refresh(); M.FEEDBACK.badge(); };
      v.querySelectorAll('tr[data-id]').forEach(tr => { const f = M.S.get('feedback', tr.dataset.id); tr.querySelector('[data-st]').onchange = (ev) => { f.status = ev.target.value; M.S.upsert('feedback', f); M.FEEDBACK.badge(); M.refresh(); }; tr.querySelector('[data-del]').onclick = async () => { if (await M.UI.confirm('Usunąć uwagę?', 'Usuń', true)) { M.S.remove('feedback', f.id); M.FEEDBACK.badge(); M.refresh(); } }; });
    },
  };
})(window.M);
