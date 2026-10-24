# TEK-BIURO BUDOWY – Rewizja 15 (wersja testowa 0.15.0, 24.10.2026)

Podstawa: przegląd podobnych aplikacji na świecie (Procore, Autodesk Build, Dalux, Sablono, Capmo, Raken, Hustro) – wnioski 1, 3 i 4.
Baza kodu: wersja 0.14.0 z GitHuba (`js-3web/TEK-BIURO_BUDOWY`, stan z 21.10.2026).

## 1. Nowy moduł „Kontrakt” – rejestry
Zakładka **Kontrakt** (rola KP/KB/IB; projektant i podwykonawca jej nie widzą). Trzy rejestry:

- **Pisma i zawiadomienia** – przychodzące (PP-001…) i wychodzące (PW-001…): rodzaj, strona, data pisma, **data i sposób doręczenia**, potwierdzenie doręczenia, termin odpowiedzi, skan (zdjęcie).
  - Pismo „zawiadomienie o roszczeniu” albo „roszczenie szczegółowe” **powiązane ze zdarzeniem** z „Terminów umownych” samo wpisuje tam datę i numer wysłania. Pole jest wypełniane tylko wtedy, gdy jest puste.
  - Gdy termin odpowiedzi wypada w sobotę, niedzielę lub święto, aplikacja to sygnalizuje (art. 115 KC – sprawdź w umowie).
- **Wnioski materiałowe** (WM-001…):
  - lista dokumentów wyrobu: DWU, KDWU, KOT/ETA, karta techniczna, ocena higieniczna, klasyfikacja ogniowa;
  - termin decyzji w dniach roboczych albo kalendarzowych;
  - **„złożyć najpóźniej”** – liczone wstecz od startu pozycji harmonogramu: czas dostawy + czas na decyzję + bufor;
  - decyzja: zatwierdzony / z uwagami / odrzucony; po odrzuceniu – „Złóż ponownie” (kolejna rewizja, historia zostaje).
- **Zapytania do projektanta** (ZP-001…):
  - rysunek, osie, pytanie, propozycja wykonawcy, wpływ na czas i koszt, pozycja harmonogramu;
  - termin odpowiedzi;
  - przy braku odpowiedzi i wpływie na termin – przycisk **„Zdarzenie w Terminach”**. Tworzy zdarzenie (subklauzule 1.9 i 8.5 do sprawdzenia w umowie) i uruchamia licznik 28 dni.
- Wspólne dla wszystkich rejestrów:
  - pozycje na Pulpicie („Wymaga uwagi”);
  - Excel, rejestr PDF, karty do druku (wniosek materiałowy, zapytanie);
  - „Pismo przewodnie” do wniosku i do zapytania;
  - historia zmian;
  - 3 nowe prompty AI (do edycji w module Asystent AI).
- „Terminy rejestrów” – domyślne terminy z umowy dla danej budowy: wniosek 7 dni roboczych, zapytanie 7 dni roboczych, odpowiedź na pismo 7 dni, bufor 7 dni. **Wartości do przepisania z Twojej umowy.**

## 3. Dziennik montażu → zakładka „Na rzucie”
- Ustawiasz siatkę osi: rzut, osie (np. `1-13`, `A-G`), opcjonalnie rozstawy w metrach. Potem klikasz **dwa węzły narożne**.
- Program rysuje na rzucie to, co jest w dzienniku – na podstawie pola „Osie” we wpisach (`1–8 / A`, `11–16 / B, 1–6 / C`, `A–C / 5`):
  - **kwadrat** = element w węźle (słup);
  - **linia** = element liniowy (belka, ściana, płatew);
  - **pole** = płyty.
- Kolory:
  - niebieski przerywany = wpis roboczy;
  - pomarańczowy = zatwierdzony;
  - zielony = zatwierdzony + pomiar geodezyjny;
  - czerwony = odchyłki przekroczone.
- **Rzut niczego nie zapisuje** – jedynym źródłem danych zostaje dziennik.
- Kliknięcie w węzeł pokazuje listę wpisów z tego węzła.
- **„Zaznacz → nowy wpis”** – zaznaczasz prostokątem węzły, a program tworzy szkic wpisu z gotowym opisem osi (np. `9–13 / C`). Blokady liczby sztuk działają jak dotąd.
- Lista „Do sprawdzenia”:
  - osie, których program nie rozpoznał (np. oś 16 przy siatce 1–13);
  - liczba sztuk niezgodna z liczbą węzłów.
- Wydruk „Postęp montażu” – rzut z kolorami, legendą i zestawieniem.
- Ograniczenie: siatka prostokątna, ustawiona równolegle do krawędzi rzutu (bez obróconych układów osi).

## 4. Szybkie usprawnienia
- **Uwagi – dowód zamknięcia:** nowa sekcja „Zdjęcia po usunięciu”. Bez zdjęcia „po” uwagi nie da się zamknąć.
  - Wyjątek: uwaga projektowa – zamiast zdjęcia wystarczy odpowiedź w komentarzach.
  - Zapisuje się data i osoba zamykająca. W raporcie PDF są zdjęcia „po”, a w Excelu kolumny „Zamknięto” i „Zdjęć po”.
  - Uwagi zamknięte przed R15 zostają zamknięte. Migracja nie jest potrzebna.
- **Raport dzienny:**
  - **„Kopiuj wczoraj”** – kopiuje obsadę, sprzęt i godziny pracy; nie kopiuje pogody, zdjęć ani notatek;
  - nowa tabela **Sprzęt**;
  - nowa sekcja **Przeszkody i opóźnienia**: opis, przyczyna, strata w godzinach, firma, „możliwa podstawa roszczenia”, a przy niej przycisk „Zdarzenie”;
  - Pulpit przypomina o przeszkodach bez zdarzenia i pokazuje, ile dni zostało z 28;
  - przeszkody trafiają do PDF i do promptu AI.
- **Kalendarz świąt PL** (`js/kalendarz.js`):
  - Wielkanoc i święta ruchome liczone algorytmem, **Wigilia od 2025 r.** (Dz.U. 2024 poz. 1965);
  - dni robocze używane w wnioskach i zapytaniach (przy ustawieniu „dni robocze”);
  - przypomnienie „brak raportu za dziś” nie pojawia się w święta;
  - **terminy FIDIC nadal liczone są kalendarzowo** – celowo.
- **Eksport terminów do pliku .ics** – przycisk „Do kalendarza” na Pulpicie, w Kontrakcie i w Terminach umownych.
  - Źródła: Terminy umowne, Kontrakt, kamienie milowe z Harmonogramu, Strażnik Harmonogramu, terminy uwag.
  - Przypomnienie 2 dni wcześniej o 9:00.
  - Stały identyfikator wydarzenia: ponowny import w Outlooku aktualizuje terminy. W Google Calendar mogą powstać kopie – usuń stare przed ponownym importem.

## Pliki zmienione względem Rewizji 14
- **Nowe:** `js/kalendarz.js`, `js/modules/kontrakt.js`, `js/modules/montaz_rzut.js`.
- **Zmienione:** `index.html`, `css/style.css`, `js/ai.js`, `js/store.js` (tabele `letters`, `submittals`, `rfis`), `js/perm.js`, `js/wersja.js`, `version.json`, `sw.js` (cache `tekbb-v5`), `js/modules/uwagi.js`, `raporty.js`, `montaz.js`, `terminy.js`, `harmonogram.js`, `straznik.js`, `home.js`.
- Synchronizacja Supabase: nowe tabele synchronizują się same (ta sama tabela `bb_records`), bez zmian w SQL.

## Testy wykonane (przeglądarka Chromium, dane DEMO)
- Święta 2026–2027 zgodne z kalendarzem (Wielkanoc 5.04.2026 i 28.03.2027, Boże Ciało 4.06.2026). Dni robocze 21.12.2026–8.01.2027: 11.
- Pełny przebieg ZP: wysłane 5.10 → termin 14.10 (7 dni roboczych) → zdarzenie z datą wiedzy 15.10 → zawiadomienie PW-001 → data wysłania odnotowana w Terminach.
- Wniosek materiałowy z pozycją harmonogramu i czasem dostawy – „złożyć najpóźniej” policzone poprawnie.
- Zamknięcie uwagi bez zdjęcia „po” zablokowane; po dodaniu zdjęcia – zamknięta, z datą.
- Kalibracja siatki dwoma kliknięciami, zaznaczenie prostokątem → szkic wpisu „9–13 / C”, 5 szt.
- Plik .ics: 13 wydarzeń, poprawne zawijanie linii.
- Brak błędów w konsoli na wszystkich modułach.

## Do sprawdzenia przez Ciebie
1. **Kopia folderu danych** przed pierwszym uruchomieniem 0.15.0.
2. Przepisz z umowy terminy rejestrów: Kontrakt → „Terminy rejestrów”.
3. Na prawdziwym rzucie ustaw siatkę i sprawdź, czy narysowane linie osi pokrywają się z rysunkiem.
4. Zaimportuj plik .ics do Outlooka i do telefonu – sprawdź przypomnienia.
5. Publikacja: jak w `WDROZENIE_GITHUB.md` (zmienione i nowe pliki z listy powyżej).
