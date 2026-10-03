/* =========================================================
   BIURO BUDOWY — Asystent AI (centrum): szablony promptów, prompt „kontekst budowy”, historia
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  M.modules.asystent = {
    title: 'Asystent AI', icon: 'spark', order: 9,
    desc: 'Gotowe prompty z danych budowy → Twoje AI → wynik wklejasz z powrotem. Szablony promptów do edycji.',
    render(v) {
      const s = M.S.settings; const edit = M.P.canEdit('asystent');
      const log = M.S.db.aiLog.filter(l => l.projectId === M.S.pid).slice(-15).reverse();
      v.innerHTML = M.UI.head('Asystent <span class="acc">AI</span>', 'Bez klucza API i bez kosztów: aplikacja przygotowuje prompt, Ty wklejasz go do swojego AI i odsyłasz wynik.') + `
        <div class="grid2" style="align-items:start">
          <div class="col">
            <div class="card card-pad col"><h2>Jak to działa</h2>
              <div class="steps"><div class="step"><span class="n">1</span><div>W module (narada, raport, protokół, harmonogram, BREEAM, terminy, uwaga) kliknij przycisk <b>${M.icon.spark.replace('<svg', '<svg style="width:14px;vertical-align:-2px"')} AI</b>.</div></div>
              <div class="step"><span class="n">2</span><div>Aplikacja składa prompt z danych tej budowy i szablonu (poniżej możesz go dopasować).</div></div>
              <div class="step"><span class="n">3</span><div>Kopiujesz → wklejasz w AI (i dołączasz zdjęcia) → kopiujesz odpowiedź → wklejasz w aplikacji.</div></div>
              <div class="step"><span class="n">4</span><div>Aplikacja rozpoznaje wynik (sekcje lub JSON) i zapisuje go we właściwych polach – z podglądem.</div></div></div></div>
            <div class="card card-pad col"><h2>Zapytaj AI o tę budowę</h2><div class="small muted">Prompt z aktualnym stanem: uwagi, ostrzeżenia harmonogramu, terminy, ustalenia narad, BREEAM.</div>
              <textarea id="q" rows="3" placeholder="np. Przygotuj listę tematów na jutrzejszą naradę i 3 najważniejsze ryzyka na ten tydzień."></textarea>
              <div><button class="btn primary" id="ctx">${M.icon.spark}Przygotuj prompt</button></div></div>
            <div class="card card-pad col"><h2>Ustawienia</h2>
              <label class="f">Adres Twojego AI<input type="url" id="url" value="${e(s.aiUrl || '')}" ${edit ? '' : 'disabled'}></label>
              <label class="check"><input type="checkbox" id="anon" ${s.anonimizacja ? 'checked' : ''} ${edit ? '' : 'disabled'}>Zamieniaj nazwiska osób z zespołu na role w promptach</label>
              <div class="banner warn">${M.icon.shield}<span class="small">Przed użyciem AI z danymi firmy sprawdź zasady swojej firmy dot. narzędzi AI (poufność, RODO). Nie wysyłaj danych osobowych pracowników, wizerunku ludzi na zdjęciach ani cen z umów, jeśli nie ma na to zgody. Wyłącz w koncie AI trenowanie na Twoich rozmowach.</span></div></div>
            <div class="card"><div class="card-head"><h2>Ostatnio użyte</h2></div>${log.length ? `<table class="list"><tbody>${log.map(l => `<tr><td class="small">${M.fmtTs(l.ts)}</td><td>${e(l.title)}</td></tr>`).join('')}</tbody></table>` : '<div class="card-pad small muted">Brak.</div>'}</div>
          </div>
          <div class="card"><div class="card-head"><h2>Szablony promptów</h2></div>
            <div class="small muted" style="padding:8px 16px">Pola w {{NAWIASACH}} aplikacja wypełnia danymi. Nie zmieniaj formatu odpowiedzi (JSON / znaczniki ===), bo aplikacja go odczytuje.</div>
            <table class="list"><tbody>${Object.entries(M.AI.DEFAULTS).map(([k, d]) => `<tr><td><b>${e(d.name)}</b><div class="xs muted">${(s.prompts || {})[k] ? 'zmieniony' : 'domyślny'}</div></td><td style="text-align:right">${edit ? `<button class="btn sm" data-ed="${k}">${M.icon.edit}Edytuj</button>` : `<button class="btn sm" data-ed="${k}">${M.icon.eye}</button>`}</td></tr>`).join('')}</tbody></table></div>
        </div>`;
      if (edit) {
        v.querySelector('#url').onchange = (ev) => M.S.set('aiUrl', ev.target.value.trim());
        v.querySelector('#anon').onchange = (ev) => M.S.set('anonimizacja', ev.target.checked);
      }
      v.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => {
        const k = b.dataset.ed;
        const m = M.UI.modal({ title: 'Szablon: ' + e(M.AI.DEFAULTS[k].name), wide: true, body: `<textarea id="t" class="mono" style="min-height:52vh;font-size:12.3px" ${edit ? '' : 'readonly'}>${e(M.AI.template(k))}</textarea>`, footer: edit ? `<button class="btn ghost" id="def">Przywróć domyślny</button><span class="grow"></span><button class="btn primary" id="ok">Zapisz</button>` : '' });
        if (!edit) return;
        m.querySelector('#def').onclick = () => { const p = { ...(s.prompts || {}) }; delete p[k]; M.S.set('prompts', p); m.close(); this.render(v); };
        m.querySelector('#ok').onclick = () => { M.S.set('prompts', { ...(s.prompts || {}), [k]: m.querySelector('#t').value }); m.close(); this.render(v); M.toast('Szablon zapisany'); };
      });
      v.querySelector('#ctx').onclick = () => {
        if (!M.S.project) return M.toast('Brak budowy', 'warn');
        const q = v.querySelector('#q').value.trim() || 'Wskaż 5 najważniejszych spraw do załatwienia w tym tygodniu i zaproponuj kolejność działań.';
        const t = M.todayISO(); const p = M.S.project;
        const open = M.S.all('issues').filter(i => i.status === 'otwarta' || i.status === 'weryfikacja');
        const ctx = [`Budowa: ${p.name} (${p.address || ''}); termin umowny: ${M.fmt(p.end)}; dziś: ${M.fmt(t)}; warunki umowy: ${p.contract}`,
          `Otwarte uwagi (${open.length}): ` + open.slice(0, 40).map(i => `${i.nr} [${i.cat}] ${M.S.respName(i.respId)}, termin ${M.fmt(i.due)}: ${(i.desc || '').slice(0, 120)}`).join(' | '),
          'Ostrzeżenia harmonogramu: ' + M.HARM.rules().filter(r => r.lvl).slice(0, 25).map(r => `${r.task.name}: ${r.txt}`).join(' | '),
          'Otwarte ustalenia narad: ' + M.S.all('meetings').flatMap(m => (m.items || []).filter(it => it.status === 'otwarte').map(it => `[${m.nr}] ${it.text} – ${M.S.respName(it.respId)}, ${M.fmt(it.due)}`)).join(' | '),
          'Zdarzenia kontraktowe: ' + M.S.all('events').filter(x => x.status !== 'zamknięte').map(x => `${x.title} (wiedza od ${M.fmt(x.awareDate)}, zawiadomienie: ${x.noticeDate ? 'wysłane' : 'NIE'})`).join(' | '),
          'BREEAM – dowody niezłożone: ' + M.S.all('evidence').filter(x => !['złożony', 'zaakceptowany'].includes(x.status)).map(x => `${x.name} (do ${M.fmt(x.due)})`).join(' | ')].join('\n');
        let prompt = `Jesteś doświadczonym kierownikiem budowy/projektu u generalnego wykonawcy (hale, magazyny, FIDIC). Odpowiadasz na pytanie na podstawie stanu budowy poniżej.\n${M.AI.RULES}\n\nSTAN BUDOWY:\n${ctx}\n\nPYTANIE:\n${q}\n\nOdpowiedz zwięźle, punktami, z konkretnymi terminami i odpowiedzialnymi.`;
        if (s.anonimizacja) prompt = M.AI.anon(prompt);
        M.AI.open({ key: 'kontekst', title: 'Zapytaj AI o budowę', prompt, parse: (x) => x.trim() || null, preview: (x) => M.md(x), applyLabel: 'Zapisz jako notatkę',
          apply: (x) => { M.S.upsert('custom', { moduleId: '_notatki_ai', values: { pytanie: q, odpowiedz: x }, projectId: M.S.pid }); M.copy(x, 'Odpowiedź zapisana i skopiowana'); } });
      };
    },
  };
})(window.M);
