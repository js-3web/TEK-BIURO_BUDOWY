/* =========================================================
   BIURO BUDOWY — Asystent AI „bez API”
   ---------------------------------------------------------
   Działa jak w Mowotece: aplikacja składa gotowy prompt z danych budowy →
   kopiujesz go do swojego AI (np. Claude) → wklejasz odpowiedź z powrotem →
   aplikacja rozpoznaje wynik i zapisuje go w module (z podglądem).
   Zaleta: zero kosztów i kluczy API, pełna kontrola nad tym, co wychodzi.
   Wada: ręczne kopiowanie. Połączenie przez API – w wersji .exe/serwerowej.
   ========================================================= */
(function (M) {
  'use strict';
  const e = M.esc;
  const AI = M.AI = {};

  AI.RULES = `Zasady odpowiedzi:
- Pisz po polsku, rzeczowo, językiem technicznym kierownika budowy.
- Nie wymyślaj faktów, liczb, nazw ani dat, których nie ma w danych. Brak informacji oznacz jako [DO UZUPEŁNIENIA].
- Tam, gdzie powołujesz przepisy lub normy, podaj tylko te, których jesteś pewien, i oznacz „(do weryfikacji)”, jeśli nie masz pewności co do aktualnej wersji.`;

  /** domyślne prompty – można je nadpisać w module Asystent AI → Szablony promptów */
  AI.DEFAULTS = {
    uwaga: { name: 'Uwaga – precyzyjny opis', text: `Jesteś inżynierem budowy (generalny wykonawca, hala magazynowa/przemysłowa).
Na podstawie krótkiej notatki z obchodu przygotuj precyzyjny opis nieprawidłowości dla podwykonawcy: CO jest źle, GDZIE (lokalizacja), JAKIE jest wymaganie (projekt/sztuka budowlana), CO trzeba zrobić. Maks. 4 zdania.
{{RULES}}
Dane:
- Budowa: {{PROJEKT}}
- Rzut / lokalizacja: {{LOKALIZACJA}}
- Kategoria: {{KATEGORIA}}
- Odpowiedzialny: {{ODPOWIEDZIALNY}}
- Notatka: {{NOTATKA}}
{{ZDJECIA}}
Zwróć WYŁĄCZNIE gotowy opis (bez wstępu).` },
    narada: { name: 'Narada – protokół i ustalenia', text: `Jesteś sekretarzem narady koordynacyjnej na budowie (generalny wykonawca).
Z notatek / transkrypcji przygotuj protokół. Ustalenia muszą mieć odpowiedzialnego i termin (jeśli padły).
{{RULES}}
Dane narady:
- Budowa: {{PROJEKT}}
- Narada nr {{NR}} z dnia {{DATA}}, miejsce: {{MIEJSCE}}
- Uczestnicy: {{UCZESTNICY}}
- Porządek (draft): {{PORZADEK}}
- Sprawy otwarte z poprzednich narad:
{{OTWARTE}}
- Notatki / transkrypcja:
"""
{{NOTATKI}}
"""
Firmy, które mogą być odpowiedzialne: {{FIRMY}}

Zwróć JEDEN blok \`\`\`json w formacie:
{"podsumowanie":"2–5 zdań","ustalenia":[{"tresc":"...","odpowiedzialny":"nazwa firmy z listy lub rola","termin":"RRRR-MM-DD lub puste"}],"zamkniete":["treść lub numer sprawy otwartej, którą zamknięto"],"sprawy_rozne":"tekst"}` },
    raport: { name: 'Raport dzienny + wpis do EDB', text: `Jesteś kierownikiem budowy. Przygotuj raport dzienny z budowy według szablonu tej budowy, na podstawie notatek i dołączonych zdjęć.
{{RULES}}
- Opisz tylko to, co widać na zdjęciach lub wynika z notatek.
- Na końcu przygotuj osobno zwięzły, konkretny projekt wpisu do dziennika budowy (EDB): data, zakres wykonanych robót z lokalizacją (osie/strefy), warunki atmosferyczne, istotne zdarzenia. Bez ocen i przymiotników. Wpis dokona i podpisze uprawniona osoba w EDB.

Budowa: {{PROJEKT}}
Data: {{DATA}} ({{DZIEN}})
Pogoda: {{POGODA}}
Obsada / brygady: {{OBSADA}}
Notatki kierownika:
"""
{{NOTATKI}}
"""
{{ZDJECIA}}

SZABLON RAPORTU (zachowaj kolejność i nagłówki):
"""
{{SZABLON}}
"""

Zwróć dokładnie dwie części oddzielone znacznikami:
=== RAPORT ===
(treść raportu)
=== WPIS DO EDB ===
(projekt wpisu)` },
    zanikowe: { name: 'Protokół robót zanikowych', text: `Jesteś kierownikiem budowy. Przygotuj treść protokołu odbioru robót zanikających / ulegających zakryciu.
{{RULES}}
- Stwierdzenia formułuj sprawdzalnie (np. „średnica i rozstaw prętów zgodne z rys. …”), bez ogólników.
- Jeśli czegoś nie sprawdzono lub brakuje dokumentu – napisz to wprost i wpisz do uwag.

Budowa: {{PROJEKT}}
Protokół: {{NR}} z dnia {{DATA}}
Rodzaj robót (wzór): {{WZOR}}
Zakres / element: {{ZAKRES}}
Lokalizacja: {{LOKALIZACJA}}
Wykonawca robót: {{WYKONAWCA}}
Podstawa (projekt, rysunki, zmiany): {{PODSTAWA}}
Punkty kontroli ze wzoru:
{{KONTROLA}}
Dokumenty (status): {{DOKUMENTY}}
Notatki z odbioru:
"""
{{NOTATKI}}
"""
{{ZDJECIA}}

Zwróć JEDEN blok \`\`\`json:
{"zakres":"opis zakresu robót objętych odbiorem","stwierdzenia":"punktowo, co sprawdzono i z jakim wynikiem","wynik":"odebrano | odebrano z uwagami | nie odebrano","uwagi":"usterki do usunięcia z terminami lub puste"}` },
    harmonogram: { name: 'Harmonogram – ryzyka i działania z wyprzedzeniem', text: `Jesteś doświadczonym kierownikiem projektu u generalnego wykonawcy (hale, magazyny, umowy FIDIC).
Przeanalizuj harmonogram i wskaż: (1) ryzyka niedotrzymania terminów, szczególnie kamieni milowych umownych, (2) prace i decyzje, które trzeba uruchomić Z WYPRZEDZENIEM (zamówienia z długim czasem dostawy, odbiory, uzgodnienia, dokumentacja, sprzęt, warunki zimowe), (3) konkretne działania z datą „najpóźniej do”.
{{RULES}}
- Opieraj się na datach z tabeli. Dziś jest {{DZIS}}.
- Uwzględnij sezon (pogoda, betonowanie zimą, dni krótsze) i typowe czasy dostaw dla hal (konstrukcja stalowa, płyta warstwowa, bramy/doki, rozdzielnice) – ale czasy oznacz jako szacunkowe.

Budowa: {{PROJEKT}}
Termin umowny zakończenia: {{KONIEC}}
Wyniki automatycznych reguł aplikacji:
{{REGULY}}
Harmonogram (CSV; postęp w %):
\`\`\`csv
{{CSV}}
\`\`\`

Zwróć JEDEN blok \`\`\`json – tablicę:
[{"zadanie":"nazwa zadania z harmonogramu lub 'ogólne'","ryzyko":"...","wplyw":"wysoki|średni|niski","dzialanie":"konkretne działanie","termin":"RRRR-MM-DD – najpóźniej do","odpowiedzialny":"rola lub firma"}]` },
    breeam: { name: 'BREEAM – projekt dowodu', text: `Jesteś koordynatorem BREEAM po stronie generalnego wykonawcy. Przygotuj projekt dokumentu-dowodu dla kredytu BREEAM oraz listę kontrolną, czego jeszcze brakuje.
{{RULES}}
- Wymagania kredytu podaję poniżej – NIE dopisuj wymagań z pamięci; jeśli czegoś brakuje, wskaż, co trzeba sprawdzić w podręczniku BREEAM / u asesora.

Budowa: {{PROJEKT}}
Schemat: {{SCHEMAT}}
Kredyt: {{KOD}} – {{NAZWA}}
Etap: {{ETAP}}
Wymagania / notatki asesora:
"""
{{WYMAGANIA}}
"""
Dowód do przygotowania: {{DOWOD}}
Dostępne dane z budowy:
{{DANE}}

Zwróć:
=== DOKUMENT ===
(projekt dokumentu: pismo/oświadczenie/procedura/raport – z miejscami na podpis)
=== BRAKUJE ===
(lista punktów do uzupełnienia przed przekazaniem asesorowi)` },
    fidic: { name: 'Terminy – projekt zawiadomienia o roszczeniu', text: `Jesteś kierownikiem kontraktu po stronie Wykonawcy. Przygotuj projekt zawiadomienia (Notice of Claim) na podstawie zdarzenia.
{{RULES}}
- To projekt do weryfikacji przez kierownika kontraktu / prawnika – nie porada prawna.
- Powołaj subklauzule wskazane w danych; przy warunkach kontraktowych szczególnych zaznacz, że należy je sprawdzić.
- Zawiadomienie ma być krótkie i jednoznaczne: opis zdarzenia, data, w której Wykonawca dowiedział się o zdarzeniu, podstawa, zapowiedź roszczenia o przedłużenie czasu i/lub dodatkową płatność, informacja o prowadzeniu bieżącej dokumentacji.

Budowa / kontrakt: {{PROJEKT}}
Warunki: {{UMOWA}}
Zdarzenie: {{TYTUL}}
Data zdarzenia: {{DATA_ZD}}; data powzięcia wiedzy: {{DATA_WIEDZY}}
Subklauzula(e): {{KLAUZULA}}
Rodzaj roszczenia: {{RODZAJ}}
Opis i fakty:
"""
{{OPIS}}
"""
Zwróć:
=== PL ===
(zawiadomienie po polsku)
=== EN ===
(the same notice in English)` },
  };

  AI.template = (key) => { const o = (M.S.settings.prompts || {})[key]; return o && o.trim() ? o : AI.DEFAULTS[key].text; };
  /** wypełnia {{POLA}}; anonimizuje nazwiska osób (rola zamiast nazwiska), gdy włączone */
  AI.fill = (key, data) => {
    let t = AI.template(key).replace(/\{\{RULES\}\}/g, AI.RULES);
    t = t.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => { const v = data[k]; return v == null || v === '' ? '—' : String(v); });
    return M.S.settings.anonimizacja ? AI.anon(t) : t;
  };
  AI.anon = (t) => {
    let out = t;
    for (const p of M.S.db.people) { if (!p.name || p.name.length < 4) continue; const rx = new RegExp(p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); out = out.replace(rx, `[${(M.P.ROLES[p.role] || {}).label || 'osoba'}]`); }
    return out;
  };
  AI.photoList = (photos) => photos && photos.length ? `Dołączone zdjęcia (w tej kolejności):\n${photos.map((p, i) => `  ${i + 1}. ${p.cap || 'zdjęcie ' + (i + 1)}`).join('\n')}` : 'Zdjęcia: brak';

  /** pobiera zdjęcia do dołączenia w oknie AI (osobne pliki, nazwy z numerem) */
  AI.downloadPhotos = async (photos, prefix) => {
    let i = 0;
    for (const p of photos) { i++; const b = await M.S.getBlob(p.blobId); if (b) { M.download(b, `${M.safeName(prefix)}_${M.pad(i)}${p.cap ? '_' + M.safeName(p.cap).slice(0, 30) : ''}.jpg`); await new Promise(r => setTimeout(r, 250)); } }
  };

  /**
   * Okno asystenta: krok 1 kopiuj prompt, krok 2 otwórz AI (+ zdjęcia), krok 3 wklej wynik, krok 4 zastosuj.
   * opts: { key, title, prompt, photos, photoPrefix, attach (opis pliku do dołączenia), parse:(txt)=>obj|null, preview:(obj)=>html, apply:(obj,txt)=>void, applyLabel }
   */
  AI.open = (opts) => {
    const prompt = opts.prompt;
    const hasPh = opts.photos && opts.photos.length;
    const m = M.UI.modal({
      title: `${M.icon.spark.replace('<svg', '<svg style="width:20px;height:20px;vertical-align:-4px;color:var(--or-500)"')} ${e(opts.title)}`, wide: true,
      body: `<div class="grid2" style="align-items:start">
        <div class="col">
          <div class="steps">
            <div class="step"><span class="n">1</span><div>Skopiuj prompt (poniżej możesz go jeszcze poprawić).</div></div>
            <div class="step"><span class="n">2</span><div>Otwórz swoje AI, wklej prompt${hasPh ? ` i <b>dołącz ${opts.photos.length} ${M.plural(opts.photos.length, 'zdjęcie', 'zdjęcia', 'zdjęć')}</b> (przycisk „Pobierz zdjęcia”)` : ''}${opts.attach ? ` i <b>dołącz ${e(opts.attach)}</b>` : ''}.</div></div>
            <div class="step"><span class="n">3</span><div>Skopiuj całą odpowiedź AI i wklej ją w pole po prawej.</div></div>
            <div class="step"><span class="n">4</span><div>Sprawdź podgląd i kliknij „${e(opts.applyLabel || 'Zastosuj')}”.</div></div>
          </div>
          <textarea id="aiPrompt" class="mono" style="min-height:260px;font-size:12.3px">${e(prompt)}</textarea>
          <div class="row">
            <button class="btn primary" id="aiCopy">${M.icon.copy}Kopiuj prompt</button>
            <a class="btn soft" href="${e(M.S.settings.aiUrl || 'https://claude.ai/new')}" target="_blank" rel="noopener">${M.icon.link}Otwórz AI</a>
            ${hasPh ? `<button class="btn" id="aiPh">${M.icon.download}Pobierz zdjęcia</button>` : ''}
          </div>
          <div class="banner warn">${M.icon.shield}<span class="small">Prompt wychodzi poza aplikację. Nie wklejaj danych osobowych pracowników ani poufnych warunków umowy, jeśli firma nie dopuszcza takiego użycia AI. ${M.S.settings.anonimizacja ? 'Nazwiska osób z listy zespołu zamieniono na role.' : ''} W ustawieniach konta AI wyłącz użycie rozmów do trenowania modeli.</span></div>
        </div>
        <div class="col">
          <label class="f">Odpowiedź AI (wklej tutaj)<textarea id="aiOut" style="min-height:260px" placeholder="Wklej całą odpowiedź…"></textarea></label>
          <div class="row"><button class="btn" id="aiPaste">${M.icon.paste}Wklej ze schowka</button><button class="btn soft" id="aiParse">${M.icon.search}Sprawdź wynik</button></div>
          <div id="aiPrev"></div>
        </div></div>`,
      footer: `<span class="small muted grow">Wynik trafi do modułu dopiero po kliknięciu „${e(opts.applyLabel || 'Zastosuj')}”.</span><button class="btn primary" id="aiApply" disabled>${M.icon.check}${e(opts.applyLabel || 'Zastosuj')}</button>`,
    });
    const out = m.querySelector('#aiOut'), prev = m.querySelector('#aiPrev'), apply = m.querySelector('#aiApply');
    let parsed = null;
    m.querySelector('#aiCopy').onclick = () => { M.copy(m.querySelector('#aiPrompt').value, 'Prompt skopiowany – wklej go w oknie AI'); AI.log(opts.key, opts.title); };
    const ph = m.querySelector('#aiPh'); if (ph) ph.onclick = () => AI.downloadPhotos(opts.photos, opts.photoPrefix || 'zdjecie');
    m.querySelector('#aiPaste').onclick = async () => { try { out.value = await navigator.clipboard.readText(); check(); } catch (err) { M.toast('Przeglądarka nie pozwala czytać schowka – wklej Ctrl+V', 'warn'); out.focus(); } };
    const check = () => {
      const txt = out.value.trim(); if (!txt) { prev.innerHTML = ''; apply.disabled = true; return; }
      try { parsed = opts.parse ? opts.parse(txt) : txt; } catch (err) { parsed = null; }
      if (parsed == null) { prev.innerHTML = `<div class="banner warn">${M.icon.alert}<span>Nie rozpoznano oczekiwanego formatu. Poproś AI: „Zwróć wynik dokładnie w formacie z instrukcji”.</span></div>`; apply.disabled = true; return; }
      prev.innerHTML = `<div class="banner ok">${M.icon.check}<span>Wynik rozpoznany. Podgląd:</span></div><div class="airesult" style="max-height:32vh;overflow:auto">${opts.preview ? opts.preview(parsed) : M.md(String(parsed))}</div>`;
      apply.disabled = false;
    };
    m.querySelector('#aiParse').onclick = check; out.oninput = M.debounce(check, 500);
    apply.onclick = () => { if (parsed == null) return; opts.apply(parsed, out.value); m.close(); M.toast('Wynik AI zapisany ✓'); };
    return m;
  };

  /** dzieli tekst na sekcje po znacznikach === NAZWA === */
  AI.sections = (txt) => {
    const out = {}; const rx = /^\s*={2,}\s*([^=\n]+?)\s*={2,}\s*$/gm; let m, last = null, idx = 0;
    while ((m = rx.exec(txt))) { if (last) out[last] = txt.slice(idx, m.index).trim(); last = M.norm(m[1]).toUpperCase(); idx = rx.lastIndex; }
    if (last) out[last] = txt.slice(idx).trim();
    return out;
  };
  AI.log = (key, title) => { M.S.db.aiLog.push({ id: M.uid(), key, title, ts: Date.now(), projectId: M.S.pid }); if (M.S.db.aiLog.length > 300) M.S.db.aiLog.shift(); M.S.touch('aiLog'); };
})(window.M);
