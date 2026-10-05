/* =========================================================
   BIURO BUDOWY — Strażnik Harmonogramu: SILNIK (czysta logika)
   ---------------------------------------------------------
   Ten plik NIE zna ekranu, bazy danych ani AI. Dostaje dane, zwraca wynik.
   Dzięki temu da się go sprawdzić osobno (testy: testy/straznik_silnik.test.js).

   Główna zasada modułu:
     AI podaje CZAS TRWANIA i PUNKT ODNIESIENIA, a DATY liczy ten plik.
       koniec czynności = data punktu odniesienia + przesunięcie (tygodnie)
       start czynności  = koniec − czas trwania (tygodnie)
     Punkt odniesienia (kotwica) to start albo koniec pozycji harmonogramu
     albo start / koniec innej czynności (łańcuch, np. zamówienie → dostawa → montaż).
     Gdy harmonogram się zmieni, wszystkie daty przeliczają się same – bez AI.
     Data wpisana ręcznie ma pierwszeństwo przed wyliczoną.
   ========================================================= */
(function (root) {
  'use strict';
  const DZIEN = 86400000;
  const naDate = (iso) => new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
  const naISO = (d) => d.toISOString().slice(0, 10);
  const plusDni = (iso, n) => naISO(new Date(naDate(iso).getTime() + n * DZIEN));
  /** b − a w dniach kalendarzowych */
  const roznica = (a, b) => Math.round((naDate(b) - naDate(a)) / DZIEN);
  /** dni robocze pon–pt między datami, włącznie z obiema (bez świąt – tak liczy MS Project bez kalendarza świąt) */
  const dniRobocze = (a, b) => { if (!a || !b || b < a) return 0; let n = 0; for (let d = naDate(a); naISO(d) <= b; d = new Date(d.getTime() + DZIEN)) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; } return n; };
  const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();

  const STATUSY = ['do zrobienia', 'w toku', 'załatwione'];
  const RODZAJE = ['etap robót', 'wybór wykonawcy', 'zamówienie', 'projekt', 'decyzja / dane', 'urząd', 'kamień własny'];
  const ZRODLA = ['szacunek AI', 'reguła budowy', 'przepis', 'harmonogram', 'ręcznie', 'potwierdzone'];
  const ST_ZAKRESU = ['w zakresie', 'poza zakresem', 'odesłanie', 'pomniejszenie', 'zakres obcy'];

  // =========================================================
  //  ZAKRES: klucze wierszy i status nadawany regułami (bez AI)
  // =========================================================
  /** krótki kod arkusza: „dostosowania PE” → PE, „synteza” → SYN; kody są unikalne */
  function kodyArkuszy(nazwy) {
    const out = {}, used = new Set();
    nazwy.forEach(n => {
      const slowa = norm(n).toUpperCase().split(' ').filter(Boolean);
      let k = (slowa.length > 1 ? slowa[slowa.length - 1] : slowa[0] || 'ARK').slice(0, 3);
      let c = k, i = 2; while (used.has(c)) c = k + (i++);
      used.add(c); out[n] = c;
    });
    return out;
  }
  /** status wiersza z treści i ilości: poza zakresem / odesłanie / pomniejszenie / zakres obcy / w zakresie */
  function statusWiersza(opis, ilosc, naglowek) {
    const t = String(opis || '').toLowerCase();
    if (/zakres najemcy|zakres inwestora|zakres zamawiającego|zakres zamawiajacego/.test(t)) return 'zakres obcy';
    if (/uwzględnion\S+ w |ujęto w|pokazan?o w|uwzględniony w/.test(t)) return 'odesłanie';
    if (/nie uwzględniono|poza zakresem|poza zkresem|wyłączono z zakresu| - brak$/.test(t)) return 'poza zakresem';
    if ((typeof ilosc === 'number' && ilosc < 0) || /^wyłączenie z zakresu|^wyłaczeniu z zakresu/.test(t)) return 'pomniejszenie';
    if (ilosc === 0 && !naglowek) return 'poza zakresem';
    return 'w zakresie';
  }
  /**
   * Zamienia wczytane arkusze na wiersze zakresu z kluczami.
   * arkusze = [{ nazwa, wiersze: [{ w (nr wiersza w Excelu), lp, opis, jedn, ilosc }] }]
   * Klucz = KOD_ARKUSZA:lp (w sekcji OPCJE: KOD:O:lp); powtórzone lp dostaje dopisek #2, #3…
   */
  function zbudujZakres(arkusze) {
    const kody = kodyArkuszy(arkusze.map(a => a.nazwa)); const out = [];
    arkusze.forEach(a => {
      const kod = kody[a.nazwa], widziane = {}; let opcje = false; const lok = [];
      a.wiersze.forEach(r => {
        const lp = String(r.lp == null ? '' : r.lp).trim(); const opis = String(r.opis == null ? '' : r.opis).replace(/\s+/g, ' ').trim();
        if (/^lp\.?$/i.test(lp) || /^razem\b/i.test(opis)) return;
        if (/^opcje$/i.test(opis) || /^opcje$/i.test(lp)) { opcje = true; return; }
        if (!lp || !opis) return;
        const baza = kod + ':' + (opcje ? 'O:' : '') + lp; widziane[baza] = (widziane[baza] || 0) + 1;
        const il = r.ilosc === '' || r.ilosc == null || isNaN(Number(r.ilosc)) ? null : Number(r.ilosc);
        lok.push({ klucz: widziane[baza] === 1 ? baza : baza + '#' + widziane[baza], arkusz: a.nazwa, kod, sekcja: opcje ? 'O' : 'G', lp, opis, jedn: String(r.jedn == null ? '' : r.jedn).trim(), ilosc: il, wiersz: r.w, powt: widziane[baza] > 1 });
      });
      lok.forEach((r, i) => { const n = lok[i + 1]; r.naglowek = !!(n && n.sekcja === r.sekcja && n.lp.indexOf(r.lp + '.') === 0); r.status = statusWiersza(r.opis, r.ilosc, r.naglowek); });
      out.push(...lok);
    });
    return out;
  }
  /**
   * Porównanie starej i nowej wersji zakresu (aktualizacja tabelki).
   * Zwraca pary i listy: bez zmian / przeniesione (ten sam tekst, inny klucz) / zmienione (ten sam klucz, inny tekst) / nowe / usunięte.
   */
  function porownajZakres(stare, nowe) {
    const wyn = { bezZmian: [], przeniesione: [], zmienione: [], nowe: [], usuniete: [] };
    const wolneStare = new Set(stare); const poKluczu = {}; stare.forEach(s => poKluczu[s.klucz] = s);
    const reszta = [];
    nowe.forEach(n => { const s = poKluczu[n.klucz]; if (s && wolneStare.has(s) && norm(s.opis) === norm(n.opis)) { wyn.bezZmian.push([s, n]); wolneStare.delete(s); } else reszta.push(n); });
    const reszta2 = [];
    reszta.forEach(n => { const kand = [...wolneStare].filter(s => s.arkusz === n.arkusz && norm(s.opis) === norm(n.opis)); if (kand.length === 1) { wyn.przeniesione.push([kand[0], n]); wolneStare.delete(kand[0]); } else reszta2.push(n); });
    reszta2.forEach(n => { const s = poKluczu[n.klucz]; if (s && wolneStare.has(s)) { wyn.zmienione.push([s, n]); wolneStare.delete(s); } else wyn.nowe.push(n); });
    wyn.usuniete = [...wolneStare];
    return wyn;
  }

  // =========================================================
  //  DOPASOWANIE zakresu do harmonogramu (odpowiedź AI)
  // =========================================================
  const pasuje = (klucz, p) => klucz === p || klucz.indexOf(p.slice(-1) === ':' ? p : p + '.') === 0 || (p.slice(-1) !== ':' && klucz.indexOf(p + '#') === 0);
  /** reguła dla wiersza: wygrywa najdłuższy pasujący prefiks klucza (reguła grupy obejmuje wiersze podrzędne) */
  function dopasuj(klucz, reguly) { let best = null; for (const r of reguly) if (pasuje(klucz, r.prefiks) && (!best || r.prefiks.length > best.prefiks.length)) best = r; return best; }
  /** sprawdza odpowiedź AI z dopasowaniem; nr zadań i klucze muszą istnieć */
  function sprawdzDopasowanie(json, numeryZadan, klucze) {
    const bledy = [], ostrz = [], reguly = []; const nry = new Set([...numeryZadan].map(String));
    const lista = Array.isArray(json) ? json : json && Array.isArray(json.dopasowanie) ? json.dopasowanie : null;
    if (!lista) return { reguly, bledy: ['Brak listy „dopasowanie” w odpowiedzi'], ostrz };
    lista.forEach((r, i) => {
      const p = String(r && r.prefiks != null ? r.prefiks : '').trim(); if (!p) { bledy.push(`Reguła ${i + 1}: brak pola „prefiks”`); return; }
      if (!klucze.some(k => pasuje(k, p))) { ostrz.push(`Reguła „${p}” nie pasuje do żadnego wiersza zakresu – pominięta`); return; }
      const zad = (Array.isArray(r.zadania) ? r.zadania : r.zadania == null ? [] : [r.zadania]).map(String);
      const zle = zad.filter(z => !nry.has(z)); if (zle.length) { bledy.push(`Reguła „${p}”: nie ma pozycji harmonogramu nr ${zle.join(', ')}`); return; }
      let pw = String(r.pewnosc || '').toUpperCase().slice(0, 1); if (pw === 'Ś') pw = 'S'; if (!['W', 'S', 'N'].includes(pw)) pw = zad.length ? 'S' : '';
      reguly.push({ prefiks: p, zadania: zad, pewnosc: pw, uwaga: String(r.uwaga || '').trim() });
    });
    return { reguly, bledy, ostrz };
  }

  // =========================================================
  //  CZYNNOŚCI (odpowiedź AI) i przeliczanie dat
  // =========================================================
  /** „Z12.s” / „C07.k” → { t:'Z'|'C', ref:'12'|'C07', e:'s'|'k' } */
  function czytajKotwice(txt) { const m = /^\s*([ZC])\s*([\w.\-]+?)\s*\.\s*([sk])\s*$/i.exec(String(txt || '')); if (!m) return null; const t = m[1].toUpperCase(); return { t, ref: t === 'C' ? 'C' + m[2].replace(/^C/i, '') : m[2], e: m[3].toLowerCase() }; }
  const liczba = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
  /** sprawdza odpowiedź AI z czynnościami: format, istnienie pozycji, kotwic i wierszy zakresu, zapętlenia */
  function sprawdzCzynnosci(json, numeryZadan, klucze) {
    const bledy = [], ostrz = [], out = []; const nry = new Set([...numeryZadan].map(String)); const kl = new Set(klucze);
    const lista = Array.isArray(json) ? json : json && Array.isArray(json.czynnosci) ? json.czynnosci : null;
    if (!lista) return { czynnosci: out, bledy: ['Brak listy „czynnosci” w odpowiedzi'], ostrz };
    const ids = new Set();
    lista.forEach((c, i) => {
      const id = 'C' + String(c && c.id != null ? c.id : i + 1).trim().replace(/^C/i, ''); const kto = `${id} „${String((c && c.nazwa) || '').slice(0, 40)}”`;
      if (!c || !String(c.nazwa || '').trim()) { bledy.push(`${id}: brak nazwy`); return; }
      if (ids.has(id)) { bledy.push(`${kto}: powtórzony identyfikator`); return; }
      const k = czytajKotwice(c.kotwica); if (!k) { bledy.push(`${kto}: nieczytelny punkt odniesienia „${c.kotwica}” (oczekiwane np. Z12.s albo C03.k)`); return; }
      if (k.t === 'Z' && !nry.has(k.ref)) { bledy.push(`${kto}: punkt odniesienia wskazuje nieistniejącą pozycję harmonogramu ${k.ref}`); return; }
      const trw = liczba(c.trwanie_tyg), prz = liczba(c.przes_tyg == null ? 0 : c.przes_tyg);
      if (trw == null || trw < 0 || prz == null) { bledy.push(`${kto}: czas trwania lub przesunięcie nie jest liczbą`); return; }
      if (trw > 104 || Math.abs(prz) > 104) ostrz.push(`${kto}: czas ponad 2 lata – sprawdź`);
      let zad = c.zadanie == null || c.zadanie === '' ? (k.t === 'Z' ? k.ref : '') : String(c.zadanie);
      if (zad && !nry.has(zad)) { ostrz.push(`${kto}: nie ma pozycji harmonogramu ${zad} – czynność zostanie bez pozycji`); zad = ''; }
      const zakres = (Array.isArray(c.zakres) ? c.zakres : []).map(String); const zleK = zakres.filter(x => !kl.has(x));
      if (zleK.length) ostrz.push(`${kto}: nieznane wiersze zakresu pominięto (${zleK.slice(0, 4).join(', ')}${zleK.length > 4 ? '…' : ''})`);
      let rodzaj = String(c.rodzaj || '').trim().toLowerCase(); if (!RODZAJE.includes(rodzaj)) rodzaj = RODZAJE.find(r => norm(r).split(' ')[0] === norm(rodzaj).split(' ')[0]) || 'etap robót';
      let zr = String(c.zrodlo || '').trim().toLowerCase(); zr = /regu/.test(zr) ? 'reguła budowy' : /przepis/.test(zr) ? 'przepis' : /harmonogram/.test(zr) ? 'harmonogram' : 'szacunek AI';
      ids.add(id);
      out.push({ id, nazwa: String(c.nazwa).trim(), rodzaj, zadanie: zad, kotwica: k, przes_tyg: prz, trwanie_tyg: trw, zrodlo: zr, uzasadnienie: String(c.uzasadnienie || '').trim(), zakres: zakres.filter(x => kl.has(x)) });
    });
    // kotwice do czynności muszą wskazywać czynności z tej odpowiedzi
    const dobre = out.filter(c => { if (c.kotwica.t === 'C' && !ids.has(c.kotwica.ref)) { bledy.push(`${c.id}: punkt odniesienia wskazuje nieistniejącą czynność ${c.kotwica.ref}`); return false; } return true; });
    // zapętlenie: próbne przeliczenie na datach umownych
    const fik = [...nry].map(n => ({ id: n, start: '2000-01-03', koniec: '2000-01-07' }));
    const pr = przelicz(fik, dobre.map(c => ({ id: c.id, kotwica: c.kotwica, przes_tyg: c.przes_tyg, trwanie_tyg: c.trwanie_tyg })));
    pr.bledy.forEach(b => bledy.push(`${b.id}: ${b.blad}`)); const zleId = new Set(pr.bledy.map(b => b.id));
    return { czynnosci: dobre.filter(c => !zleId.has(c.id)), bledy, ostrz };
  }

  /**
   * Wylicza daty czynności.
   * zadania   = [{ id, start, koniec, bezTerminu }]
   * czynnosci = [{ id, kotwica:{t:'Z'|'C', ref, e:'s'|'k'}, przes_tyg, trwanie_tyg, dataReczna }]
   * Zwraca { daty: { id: {start, koniec, koniecWyliczony, reczna, uwaga} }, bledy: [{id, blad}] }
   */
  function przelicz(zadania, czynnosci, opcje) {
    opcje = opcje || {};
    const Z = {}; zadania.forEach(z => Z[String(z.id)] = z);
    const C = {}; czynnosci.forEach(c => C[String(c.id)] = c);
    const daty = {}, bledy = [], zle = {}, wTrakcie = new Set();
    function dataKotwicy(k, sciezka) {
      if (!k) throw new Error('Brak punktu odniesienia');
      if (k.t === 'Z') {
        const z = Z[String(k.ref)]; if (!z) throw new Error('Pozycja harmonogramu, od której liczono termin, już nie istnieje');
        if (z.bezTerminu) throw new Error('Pozycja harmonogramu nie ma ustalonego terminu');
        const d = k.e === 's' ? z.start : z.koniec; if (!d) throw new Error('Pozycja harmonogramu nie ma daty'); return d;
      }
      const w = licz(String(k.ref), sciezka); return k.e === 's' ? w.start : w.koniec;
    }
    function licz(id, sciezka) {
      if (daty[id]) return daty[id];
      if (zle[id]) throw new Error(zle[id]);
      const c = C[id]; if (!c) throw new Error('Czynność, od której liczono termin, już nie istnieje');
      if (wTrakcie.has(id)) throw new Error('Zapętlona kolejność: ' + sciezka.concat(id).join(' → '));
      wTrakcie.add(id);
      try {
        let koniecWyliczony = '';
        try { koniecWyliczony = plusDni(dataKotwicy(c.kotwica, sciezka.concat(id)), Math.round((Number(c.przes_tyg) || 0) * 7)); }
        catch (e) { if (!c.dataReczna) throw e; }               // data ręczna ratuje czynność, gdy kotwica zniknęła
        const koniec = c.dataReczna || koniecWyliczony;
        const start = plusDni(koniec, -Math.round((Number(c.trwanie_tyg) || 0) * 7));
        const uw = opcje.startProjektu && start < opcje.startProjektu ? 'Start wypada przed rozpoczęciem budowy (' + opcje.startProjektu + ')' : '';
        return (daty[id] = { start, koniec, koniecWyliczony, reczna: !!c.dataReczna, uwaga: uw });
      } catch (e) { zle[id] = e.message; throw e; } finally { wTrakcie.delete(id); }
    }
    czynnosci.forEach(c => { try { licz(String(c.id), []); } catch (e) { bledy.push({ id: c.id, blad: e.message }); } });
    return { daty, bledy };
  }

  /**
   * Alarmy na wskazany dzień.
   * pozycje = [{ id, status, start, koniec }] (start/koniec z przelicz); okno = ile dni wcześniej ostrzegać.
   * Poziom „czerwony”: po terminie albo powinno już trwać. „żółty”: start (lub termin) w oknie ostrzeżenia.
   */
  function alarmy(pozycje, dzis, okno) {
    okno = okno == null ? 14 : Number(okno);
    const out = [];
    pozycje.forEach(c => {
      if (c.status === 'załatwione' || !c.start || !c.koniec) return;
      const doStartu = roznica(dzis, c.start), doKonca = roznica(dzis, c.koniec); let poziom = '', tekst = '';
      if (doKonca < 0) { poziom = 'czerwony'; tekst = 'PO TERMINIE o ' + (-doKonca) + ' dni'; }
      else if (c.status === 'w toku') { if (doKonca <= okno) { poziom = 'żółty'; tekst = doKonca === 0 ? 'Termin dziś' : 'Termin za ' + doKonca + ' dni'; } }
      else if (doStartu < 0) { poziom = 'czerwony'; tekst = 'Powinno być w toku od ' + (-doStartu) + ' dni'; }
      else if (doStartu <= okno) { poziom = 'żółty'; tekst = doStartu === 0 ? 'Zacznij dziś' : 'Zacznij za ' + doStartu + ' dni'; }
      if (poziom) out.push({ id: c.id, poziom, tekst, start: c.start, koniec: c.koniec, doStartu, doKonca });
    });
    return out.sort((a, b) => (a.poziom === b.poziom ? 0 : a.poziom === 'czerwony' ? -1 : 1) || a.start.localeCompare(b.start) || a.koniec.localeCompare(b.koniec));
  }

  const API = { plusDni, roznica, dniRobocze, norm, STATUSY, RODZAJE, ZRODLA, ST_ZAKRESU, kodyArkuszy, statusWiersza, zbudujZakres, porownajZakres, dopasuj, pasuje, sprawdzDopasowanie, czytajKotwice, sprawdzCzynnosci, przelicz, alarmy };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && root.M) root.M.SH = API;
})(typeof window !== 'undefined' ? window : globalThis);
