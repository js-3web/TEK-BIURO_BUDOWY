/* =========================================================
   BIURO BUDOWY — biblioteka gotowych wzorów
   • M.WZ.DB   – wpisy do dziennika budowy
   • M.WZ.DM   – typowe zapisy w dzienniku montażu
   • M.WZ.ZAN  – dodatkowe wzory protokołów robót zanikających
   Pola w nawiasach kwadratowych uzupełnia kierownik. Wyjątki podstawiane przez program:
   [data] = data wpisu, [budowa], [adres], [inwestor], [nr dziennika montażu].
   Wzory są propozycją autora aplikacji, nie wzorem urzędowym – kierownik budowy
   odpowiada za treść wpisu i dostosowuje ją do budowy.
   ========================================================= */
(function (M) {
  'use strict';
  const KB = 'Kierownik budowy', KR = 'Kierownik robót', INI = 'Inspektor nadzoru inwestorskiego', PRJ = 'Projektant – nadzór autorski', GEO = 'Geodeta uprawniony', INW = 'Inwestor', ORG = 'Pracownik organu nadzoru budowlanego';
  M.WZ = { FUN: [KB, KR, INI, PRJ, GEO, INW, ORG] };
  const D = (c, n, f, t, k = 'roboty') => ({ c, n, f, t, k });

  M.WZ.DB = [
    // ---------- 1. Rozpoczęcie i organizacja budowy ----------
    D('Rozpoczęcie i organizacja', 'Przyjęcie obowiązków kierownika budowy', KB, 'Z dniem [data] przyjmuję obowiązki kierownika budowy: [budowa], [adres]. Oświadczenie o przyjęciu obowiązków oraz dokumenty potwierdzające uprawnienia i przynależność do izby załączono.', 'inne'),
    D('Rozpoczęcie i organizacja', 'Przyjęcie obowiązków inspektora nadzoru inwestorskiego', INI, 'Z dniem [data] przyjmuję obowiązki inspektora nadzoru inwestorskiego w zakresie [branża] na budowie: [budowa].', 'inne'),
    D('Rozpoczęcie i organizacja', 'Ustanowienie kierownika robót', KB, 'Z dniem [data] obowiązki kierownika robót [branża] pełni [imię i nazwisko], upr. nr [nr uprawnień].', 'inne'),
    D('Rozpoczęcie i organizacja', 'Protokolarne przejęcie terenu budowy', KB, 'W dniu [data] przejęto protokolarnie od Inwestora teren budowy wraz ze znajdującymi się na nim obiektami, urządzeniami i punktami osnowy geodezyjnej. Protokół przekazania z dnia [data].'),
    D('Rozpoczęcie i organizacja', 'Zagospodarowanie terenu budowy', KB, 'Wykonano zagospodarowanie terenu budowy: ogrodzenie, wjazd, zaplecze socjalno-biurowe, przyłącza tymczasowe [woda / energia]. Umieszczono tablicę informacyjną i ogłoszenie zawierające dane dotyczące bezpieczeństwa pracy i ochrony zdrowia.'),
    D('Rozpoczęcie i organizacja', 'Plan BIOZ', KB, 'Sporządzono plan bezpieczeństwa i ochrony zdrowia (plan BIOZ). Plan znajduje się w biurze budowy. Pracownicy wykonawców zostali z nim zapoznani.', 'inne'),
    D('Rozpoczęcie i organizacja', 'Rozpoczęcie robót budowlanych', KB, 'W dniu [data] rozpoczęto roboty budowlane: [zakres]. Podstawa: decyzja o pozwoleniu na budowę nr [nr] z dnia [data decyzji], projekt budowlany i projekt techniczny.'),
    D('Rozpoczęcie i organizacja', 'Przekazanie obowiązków kierownika budowy', KB, 'Z dniem [data] przekazuję obowiązki kierownika budowy Panu/Pani [imię i nazwisko], upr. nr [nr uprawnień]. Stan zaawansowania robót: [opis]. Stan zabezpieczenia terenu budowy: [opis]. Dokumentację budowy przekazano.', 'inne'),
    D('Rozpoczęcie i organizacja', 'Wprowadzenie podwykonawcy na budowę', KB, 'W dniu [data] wprowadzono na budowę wykonawcę robót: [firma], zakres: [zakres]. Przekazano front robót w osiach [osie]. Przeprowadzono szkolenie informacyjne BHP.'),

    // ---------- 2. Geodezja ----------
    D('Geodezja', 'Wytyczenie obiektu w terenie', GEO, 'W dniu [data] wytyczono w terenie obiekt: [obiekt / zakres]. Wyznaczono osie konstrukcyjne [osie] oraz repery robocze [opis, rzędne]. Szkic tyczenia nr [nr] przekazano kierownikowi budowy.'),
    D('Geodezja', 'Wytyczenie osi i poziomów – kolejny etap', GEO, 'W dniu [data] wytyczono [osie / poziomy / lokalizację elementów]: [zakres]. Szkic nr [nr].'),
    D('Geodezja', 'Pomiar kontrolny (kotwy, kielichy, słupy)', GEO, 'W dniu [data] wykonano pomiar kontrolny: [kotwy / kielichy stóp / słupy / belki] w osiach [osie]. Odchyłki: [w tolerancji / przekroczone – opis]. Szkic nr [nr].'),
    D('Geodezja', 'Inwentaryzacja powykonawcza sieci przed zasypaniem', GEO, 'W dniu [data] wykonano geodezyjną inwentaryzację powykonawczą: [sieć / przyłącze], odcinek [od–do], przed zasypaniem. Szkic nr [nr].'),
    D('Geodezja', 'Inwentaryzacja powykonawcza obiektu', GEO, 'W dniu [data] wykonano geodezyjną inwentaryzację powykonawczą obiektu: [zakres]. Obiekt usytuowano [zgodnie z projektem zagospodarowania / z odstępstwami – opis].'),

    // ---------- 3. Roboty ziemne i fundamenty ----------
    D('Roboty ziemne i fundamenty', 'Rozpoczęcie robót ziemnych', KB, 'W dniu [data] rozpoczęto roboty ziemne: [zdjęcie humusu / wykopy / wymiana gruntu] w osiach [osie].'),
    D('Roboty ziemne i fundamenty', 'Odbiór podłoża gruntowego', KB, 'W dniu [data] dokonano odbioru podłoża gruntowego w wykopie pod [element] w osiach [osie], z udziałem [geotechnik]. Stwierdzono: [grunty zgodne z dokumentacją geotechniczną / rozbieżności – opis]. Zalecenia: [brak / treść].', 'zanikowe'),
    D('Roboty ziemne i fundamenty', 'Wymiana lub wzmocnienie gruntu – zakończenie', KB, 'Zakończono [wymianę gruntu / wzmocnienie podłoża] w osiach [osie]. Materiał: [rodzaj], grubość warstw: [cm]. Badania zagęszczenia / nośności: [wyniki, nr protokołu].', 'zanikowe'),
    D('Roboty ziemne i fundamenty', 'Zgłoszenie zbrojenia fundamentów do odbioru', KB, 'Zgłaszam do sprawdzenia i odbioru zbrojenie [stóp / ław / płyty fundamentowej] w osiach [osie] wraz z kotwami i uziomem fundamentowym. Proszę o odbiór w dniu [data].', 'zanikowe'),
    D('Roboty ziemne i fundamenty', 'Odbiór zbrojenia – wpis inspektora', INI, 'W dniu [data] sprawdzono i odebrano zbrojenie [element] w osiach [osie]. Zbrojenie wykonano zgodnie z projektem. Uwagi: [brak / treść]. Zezwalam na betonowanie.', 'zanikowe'),
    D('Roboty ziemne i fundamenty', 'Betonowanie fundamentów', KB, 'W dniu [data] zabetonowano [element] w osiach [osie]. Beton klasy [klasa], ilość [m³], dostawca [wytwórnia]. Pobrano próbki: [liczba] szt. Temperatura powietrza [°C]. Pielęgnacja: [opis].'),
    D('Roboty ziemne i fundamenty', 'Izolacje fundamentów – zgłoszenie do odbioru', KB, 'Zgłaszam do odbioru izolację [przeciwwilgociową / przeciwwodną / termiczną] fundamentów w osiach [osie], przed zasypaniem. Materiał: [rodzaj].', 'zanikowe'),
    D('Roboty ziemne i fundamenty', 'Zasypki i zagęszczenie', KB, 'Wykonano zasypki [fundamentów / wykopów] w osiach [osie] warstwami gr. [cm] z zagęszczeniem. Badania zagęszczenia: [wyniki, nr protokołu].', 'zanikowe'),

    // ---------- 4. Konstrukcja ----------
    D('Konstrukcja', 'Rozpoczęcie montażu konstrukcji', KB, 'W dniu [data] rozpoczęto montaż konstrukcji [prefabrykowanej / stalowej]. Podstawa: projekt techniczny, rysunki montażowe [nr], projekt technologii montażu. Fundamenty odebrano, pomiar geodezyjny – szkic nr [nr]. Prowadzony jest dziennik montażu nr [nr dziennika montażu].'),
    D('Konstrukcja', 'Zakończenie montażu – etap', KB, 'W dniu [data] zakończono montaż: [słupów / belek / dźwigarów / płatwi / płyt] w osiach [osie]. Pomiar geodezyjny powykonawczy – szkic nr [nr]. Odchyłki [w tolerancji / opis]. Zgłaszam do odbioru.'),
    D('Konstrukcja', 'Potwierdzenie montażu – wpis inspektora', INI, 'Potwierdzam wykonanie montażu: [zakres, osie], na podstawie [pomiar geodezyjny nr / protokół nr]. Uwagi: [brak / treść].'),
    D('Konstrukcja', 'Zalanie stóp kielichowych / podlewki pod słupy', KB, 'W dniu [data] wykonano [zalanie kielichów stóp / podlewki pod słupami] w osiach [osie]. Materiał: [beton klasy / zaprawa bezskurczowa – nazwa]. Kliny montażowe [pozostawiono do / usunięto po] uzyskaniu wytrzymałości.', 'zanikowe'),
    D('Konstrukcja', 'Połączenia śrubowe – dokręcenie i kontrola', KB, 'Wykonano dokręcenie połączeń śrubowych konstrukcji stalowej w osiach [osie]. Śruby klasy [klasa], metoda dokręcania: [opis]. Kontrola: [wynik, protokół nr].'),
    D('Konstrukcja', 'Zgłoszenie zbrojenia ścian / słupów / stropu do odbioru', KB, 'Zgłaszam do sprawdzenia i odbioru zbrojenie [ścian / słupów / stropu / belek] na poziomie [poziom] w osiach [osie]. Proszę o odbiór w dniu [data].', 'zanikowe'),
    D('Konstrukcja', 'Betonowanie stropu / ścian / słupów', KB, 'W dniu [data] zabetonowano [element] na poziomie [poziom] w osiach [osie]. Beton klasy [klasa], ilość [m³]. Pobrano próbki: [liczba] szt. Temperatura powietrza [°C]. Pielęgnacja: [opis].'),
    D('Konstrukcja', 'Rozdeskowanie', KB, 'W dniu [data] rozdeskowano [element] w osiach [osie]. Wytrzymałość betonu na dzień rozdeskowania: [MPa / % wytrzymałości projektowej], podstawa: [wyniki badań]. Podpory [pozostawiono / usunięto].'),
    D('Konstrukcja', 'Wyniki badań betonu', KB, 'Otrzymano wyniki badań wytrzymałości betonu z dnia betonowania [data betonowania], element [element]: [wyniki]. Beton [spełnia / nie spełnia] wymagania klasy [klasa]. Sprawozdanie nr [nr].', 'inne'),

    // ---------- 5. Obudowa, dach, posadzka ----------
    D('Obudowa, dach, posadzka', 'Rozpoczęcie montażu obudowy ścian', KB, 'W dniu [data] rozpoczęto montaż obudowy ścian z [płyt warstwowych / kaset] w osiach [osie]. Konstrukcja wsporcza odebrana.'),
    D('Obudowa, dach, posadzka', 'Pokrycie dachu – zakończenie warstw', KB, 'Zakończono warstwy pokrycia dachu w osiach [osie]: [blacha trapezowa / paroizolacja / termoizolacja / membrana]. Zgłaszam do odbioru przed wykonaniem obróbek.', 'zanikowe'),
    D('Obudowa, dach, posadzka', 'Próba szczelności dachu', KB, 'W dniu [data] wykonano próbę szczelności pokrycia dachu w polu [osie]. Wynik: [szczelne / nieszczelności – opis]. Protokół nr [nr].'),
    D('Obudowa, dach, posadzka', 'Podbudowa pod posadzkę – zgłoszenie do odbioru', KB, 'Zgłaszam do odbioru podbudowę pod posadzkę przemysłową w polu [osie]. Badania nośności: [E2, E2/E1 lub Is – wyniki, nr protokołu]. Instalacje podposadzkowe odebrano.', 'zanikowe'),
    D('Obudowa, dach, posadzka', 'Wykonanie posadzki przemysłowej', KB, 'W dniu [data] wykonano posadzkę przemysłową w polu [osie], powierzchnia [m²]. Beton klasy [klasa], zbrojenie [rozproszone / siatki], grubość [cm]. Temperatura w hali [°C], obiekt zamknięty. Pobrano próbki: [liczba] szt.'),
    D('Obudowa, dach, posadzka', 'Nacięcie dylatacji posadzki', KB, 'W dniu [data] nacięto dylatacje posadzki w polu [osie], po [liczba] godzinach od betonowania. Pielęgnacja: [opis].'),
    D('Obudowa, dach, posadzka', 'Osadzenie bram i doków', KB, 'Zakończono montaż [bram / doków przeładunkowych / uszczelnień] nr [nr] w osiach [osie]. Zgłaszam do odbioru.'),

    // ---------- 6. Instalacje i sieci ----------
    D('Instalacje i sieci', 'Instalacje podposadzkowe – zgłoszenie przed zakryciem', KB, 'Zgłaszam do odbioru instalacje podposadzkowe [kanalizacja / przepusty / uziemienia] w polu [osie], przed zakryciem. Próba szczelności: [wynik].', 'zanikowe'),
    D('Instalacje i sieci', 'Próba szczelności kanalizacji', KB, 'W dniu [data] wykonano próbę szczelności kanalizacji [sanitarnej / deszczowej], odcinek [od–do]. Wynik: [pozytywny / negatywny – opis]. Protokół nr [nr].'),
    D('Instalacje i sieci', 'Próba ciśnieniowa instalacji', KB, 'W dniu [data] wykonano próbę ciśnieniową instalacji [tryskaczowej / hydrantowej / wodnej / grzewczej], zakres [zakres]. Ciśnienie próbne [bar], czas [min]. Wynik: [pozytywny / negatywny]. Protokół nr [nr].'),
    D('Instalacje i sieci', 'Uziom i instalacja odgromowa – pomiary', KB, 'Wykonano pomiary [rezystancji uziemienia / ciągłości przewodów] instalacji [uziemiającej / odgromowej]. Wyniki: [wartości]. Protokół nr [nr].'),
    D('Instalacje i sieci', 'Sieci zewnętrzne – zgłoszenie przed zasypaniem', KB, 'Zgłaszam do odbioru [sieć / przyłącze], odcinek [od–do], przed zasypaniem. Wykonano inwentaryzację geodezyjną – szkic nr [nr]. Próba szczelności: [wynik].', 'zanikowe'),
    D('Instalacje i sieci', 'Przejścia instalacyjne przez przegrody ogniowe', KB, 'Zgłaszam do odbioru zabezpieczenia przejść instalacyjnych przez przegrody oddzielenia przeciwpożarowego w osiach [osie]. System: [nazwa], klasa [EI]. Oznakowanie wykonano.', 'zanikowe'),

    // ---------- 7. Zdarzenia na budowie ----------
    D('Zdarzenia', 'Przerwa w robotach – warunki atmosferyczne', KB, 'W dniu [data] w godz. [od–do] wstrzymano roboty: [zakres] z powodu [wiatr powyżej … m/s / opady / temperatura]. Zabezpieczenie: [opis].'),
    D('Zdarzenia', 'Przerwa w robotach – przyczyna niezależna od wykonawcy', KB, 'Od dnia [data], godz. [godzina] wstrzymano roboty: [zakres]. Przyczyna: [brak frontu robót / brak dokumentacji / decyzja Inwestora / kolizja]. Powiadomiono: [kogo, kiedy].'),
    D('Zdarzenia', 'Wznowienie robót', KB, 'W dniu [data], godz. [godzina] wznowiono roboty: [zakres], po ustaniu przyczyny wstrzymania: [przyczyna]. Czas przerwy: [dni / godziny].'),
    D('Zdarzenia', 'Roboty w warunkach zimowych', KB, 'Roboty [betonowe / murowe / montażowe] prowadzone w obniżonej temperaturze ([°C]). Zastosowano: [domieszki / podgrzewanie / osłony / maty]. Kontrola temperatury betonu: [opis].'),
    D('Zdarzenia', 'Wypadek lub zdarzenie potencjalnie wypadkowe', KB, 'W dniu [data] o godz. [godzina] doszło do [wypadku / zdarzenia potencjalnie wypadkowego]: [opis, miejsce]. Poszkodowany: [pracownik firmy …]. Podjęte działania: [pierwsza pomoc, zabezpieczenie miejsca, powiadomienia].', 'inne'),
    D('Zdarzenia', 'Uszkodzenie lub awaria', KB, 'W dniu [data] stwierdzono [uszkodzenie / awarię]: [opis, lokalizacja]. Przyczyna: [opis / do ustalenia]. Zabezpieczenie: [opis]. Powiadomiono: [kogo].', 'inne'),
    D('Zdarzenia', 'Kontrola organu', ORG, 'W dniu [data] przeprowadzono czynności kontrolne na budowie: [zakres kontroli]. Ustalenia: [treść]. Protokół nr [nr].', 'inne'),
    D('Zdarzenia', 'Zalecenia inspektora nadzoru', INI, 'W dniu [data] stwierdzono: [opis]. Zalecam: [treść zalecenia] w terminie do [termin].', 'inne'),
    D('Zdarzenia', 'Wykonanie zaleceń', KB, 'Zalecenia z wpisu z dnia [data zalecenia] wykonano w dniu [data]: [opis wykonania]. Zgłaszam do sprawdzenia.', 'inne'),
    D('Zdarzenia', 'Nadzór autorski – ustalenia', PRJ, 'W ramach nadzoru autorskiego w dniu [data] stwierdzam: [ustalenia]. Zalecenia: [treść].', 'inne'),
    D('Zdarzenia', 'Rozwiązanie zamienne – wpis projektanta', PRJ, 'Wyrażam zgodę na rozwiązanie zamienne: [opis] w miejsce [rozwiązanie projektowe]. Zmiana jest [nieistotnym odstąpieniem od projektu]. Rysunek / szkic nr [nr].', 'inne'),
    D('Zdarzenia', 'Wstrzymanie robót z powodu zagrożenia', KB, 'W dniu [data] wstrzymałem roboty: [zakres] z powodu stwierdzenia możliwości powstania zagrożenia: [opis]. Powiadomiono Inwestora i [organ] w dniu [data].', 'inne'),

    // ---------- 8. Odbiory i zakończenie ----------
    D('Odbiory i zakończenie', 'Zgłoszenie do odbioru częściowego', KB, 'Zgłaszam do odbioru częściowego: [zakres robót, osie]. Dokumenty: [pomiary, protokoły, deklaracje].'),
    D('Odbiory i zakończenie', 'Odbiór częściowy – wpis inspektora', INI, 'W dniu [data] dokonano odbioru częściowego: [zakres robót, osie]. Roboty wykonano zgodnie z projektem. Uwagi: [brak / treść]. Protokół nr [nr].'),
    D('Odbiory i zakończenie', 'Próby i rozruchy', KB, 'W dniu [data] przeprowadzono [próby / rozruch]: [instalacja / urządzenie]. Wynik: [pozytywny / uwagi]. Protokół nr [nr].'),
    D('Odbiory i zakończenie', 'Zgłoszenie zakończenia robót', KB, 'W dniu [data] zakończono roboty budowlane objęte [pozwoleniem na budowę nr …]. Zgłaszam obiekt do odbioru. Dokumentację powykonawczą przygotowano. Teren budowy uporządkowano.'),
    D('Odbiory i zakończenie', 'Potwierdzenie gotowości do odbioru – wpis inspektora', INI, 'Potwierdzam zakończenie robót i gotowość obiektu do odbioru. Roboty wykonano zgodnie z projektem i warunkami pozwolenia na budowę. Uwagi: [brak / treść].'),
    D('Odbiory i zakończenie', 'Zamknięcie dziennika budowy', KB, 'W dniu [data], po zakończeniu robót budowlanych, zamykam dziennik budowy: [budowa].', 'inne'),
  ];

  // ---------- typowe zapisy w dzienniku montażu (r = uwagi, j = połączenia, d = dokumenty) ----------
  const m = (c, n, o) => Object.assign({ c, n }, o);
  M.WZ.DM = [
    m('Przed montażem', 'Odbiór fundamentów przed montażem', { r: 'Przed rozpoczęciem montażu sprawdzono [kielichy stóp / kotwy fundamentowe] w osiach [osie]: położenie w osiach, rzędne, czystość. Pomiar geodezyjny – szkic nr [nr]. Beton fundamentów uzyskał wymaganą wytrzymałość.' }),
    m('Przed montażem', 'Rozpoczęcie montażu', { r: 'Rozpoczęto montaż. Brygada zapoznana z projektem technologii montażu i planem BIOZ. Strefa montażu wygrodzona i oznakowana. Żuraw ustawiony na stanowisku [nr / lokalizacja], podłoże pod podpory sprawdzone.' }),
    m('Przed montażem', 'Dostawa elementów – kontrola przy rozładunku', { r: 'Dostawa elementów: [zakres]. Sprawdzono oznakowanie, wymiary i stan elementów przy rozładunku: [bez uwag / uszkodzenia – opis].', d: 'WZ nr [nr], deklaracje właściwości użytkowych' }),
    m('Przed montażem', 'Element niezgodny – odmowa przyjęcia', { r: 'Element [symbol] nie został przyjęty: [uszkodzenie / niezgodność wymiarów / brak dokumentów]. Powiadomiono wytwórcę w dniu [data]. Element oznakowano i odstawiono.' }),
    m('Montaż prefabrykatów', 'Słupy w stopach kielichowych', { j: 'słupy osadzone w kielichach, klinowanie klinami montażowymi, pionowanie w dwóch płaszczyznach', r: 'Słupy ustawiono na podkładkach centrujących, wypionowano i zaklinowano. Zalanie kielichów po pomiarze geodezyjnym.' }),
    m('Montaż prefabrykatów', 'Zalanie kielichów', { j: 'zalanie kielichów betonem klasy [klasa] / zaprawą [nazwa]', r: 'Zalano kielichy stóp w osiach [osie]. Kliny pozostawiono do uzyskania wytrzymałości.' }),
    m('Montaż prefabrykatów', 'Słupy na kotwach', { j: 'słupy na kotwach fundamentowych, nakrętki z podkładkami, regulacja nakrętkami poziomującymi, podlewka bezskurczowa [nazwa]', r: 'Słupy ustawiono na kotwach, wypionowano. Podlewki po pomiarze geodezyjnym.' }),
    m('Montaż prefabrykatów', 'Belki i dźwigary', { j: 'oparcie na podkładkach elastomerowych, trzpienie zalane zaprawą [nazwa]', r: 'Belki / dźwigary ułożono na podkładkach, sprawdzono długości oparcia. Stabilizacja montażowa do czasu wykonania stężeń.' }),
    m('Montaż prefabrykatów', 'Płyty stropowe', { j: 'płyty ułożone na podkładkach / zaprawie, zbrojenie i zalanie styków oraz wieńców betonem klasy [klasa]', r: 'Płyty ułożono zgodnie z rysunkiem montażowym. Sprawdzono długości oparcia i klawiszowanie.' }),
    m('Montaż prefabrykatów', 'Ściany prefabrykowane, doki', { j: 'łączniki systemowe / spawane do marek, uszczelnienie styków [materiał]', r: 'Elementy ustawiono i zamocowano do konstrukcji. Sprawdzono pion i licowanie.' }),
    m('Montaż konstrukcji stalowej', 'Połączenia śrubowe – dokręcenie wstępne', { j: 'śruby klasy [klasa], dokręcenie wstępne', r: 'Zmontowano elementy na śruby, dokręcenie wstępne. Dokręcenie końcowe po regulacji geometrii.' }),
    m('Montaż konstrukcji stalowej', 'Połączenia śrubowe – dokręcenie końcowe', { j: 'śruby klasy [klasa], dokręcenie końcowe metodą [momentu / kombinowaną], klucz nr [nr]', r: 'Wykonano dokręcenie końcowe połączeń w osiach [osie]. Połączenia oznakowano.' }),
    m('Montaż konstrukcji stalowej', 'Spawanie montażowe', { j: 'spoiny montażowe wg rysunku [nr], spawacz [uprawnienia], instrukcja WPS nr [nr]', r: 'Wykonano spoiny montażowe w osiach [osie]. Badania: [wizualne / NDT – zakres]. Uzupełniono zabezpieczenie antykorozyjne.' }),
    m('Montaż konstrukcji stalowej', 'Stężenia montażowe', { r: 'Założono stężenia montażowe w polu [osie]. Stężenia pozostają do czasu [wykonania stężeń stałych / zmontowania poszycia].' }),
    m('Kontrola i pomiary', 'Pomiar geodezyjny po montażu', { r: 'Wykonano pomiar geodezyjny zmontowanych elementów w osiach [osie]. Odchyłki [w tolerancji / przekroczone – opis]. Szkic nr [nr].' }),
    m('Kontrola i pomiary', 'Uszkodzenie elementu podczas montażu', { r: 'Podczas montażu uszkodzono element [symbol] w osi [oś]: [opis]. Zgłoszono projektantowi / wytwórcy w dniu [data]. Sposób naprawy: [opis / do ustalenia].' }),
    m('Przerwy i zakończenie', 'Przerwa – wiatr', { r: 'Montaż wstrzymano w godz. [od–do] – prędkość wiatru powyżej wartości dopuszczalnej wg instrukcji żurawia. Elementy zabezpieczono.' }),
    m('Przerwy i zakończenie', 'Przerwa – brak dostawy', { r: 'Brak montażu – nie dostarczono elementów: [zakres]. Wytwórca potwierdził dostawę na [data].' }),
    m('Przerwy i zakończenie', 'Przerwa – awaria sprzętu', { r: 'Montaż wstrzymano w godz. [od–do] – awaria [żuraw / podnośnik]. Sprzęt zastępczy: [opis].' }),
    m('Przerwy i zakończenie', 'Zmiana stanowiska żurawia', { r: 'Żuraw przestawiono na stanowisko [nr / lokalizacja]. Podłoże pod podpory sprawdzone.' }),
    m('Przerwy i zakończenie', 'Zakończenie montażu etapu', { r: 'Zakończono montaż [grupa elementów] w osiach [osie]. Pomiar geodezyjny powykonawczy – szkic nr [nr]. Zgłoszono do odbioru.' }),
  ];

  // ---------- dodatkowe wzory protokołów robót zanikających i ulegających zakryciu ----------
  const Z = (id, cat, name, checks, docs) => ({ id: 'z-' + id, cat, name, checks, docs });
  const DZ = ['Rysunki konstrukcyjne (nr, rewizja)', 'Deklaracje właściwości użytkowych / atesty stali'];
  M.WZ.ZAN = [
    // Roboty ziemne i podłoże
    Z('podloze', 'Roboty ziemne i podłoże', 'Podłoże gruntowe w wykopie fundamentowym', ['Rodzaj i stan gruntu zgodny z dokumentacją geotechniczną', 'Rzędna dna wykopu', 'Dno wykopu nienaruszone, bez nawodnienia i przemarznięcia', 'Odwodnienie wykopu', 'Zabezpieczenie skarp / ścian wykopu'], ['Dokumentacja geotechniczna', 'Protokół odbioru podłoża przez geotechnika', 'Szkic geodezyjny']),
    Z('wymiana', 'Roboty ziemne i podłoże', 'Wymiana gruntu / nasyp budowlany', ['Materiał nasypu zgodny z projektem', 'Grubość układanych warstw', 'Zagęszczenie każdej warstwy (Is / Id)', 'Zasięg wymiany w planie i rzędne', 'Wilgotność materiału przy zagęszczaniu'], ['Protokoły badań zagęszczenia', 'Deklaracja / badania kruszywa', 'Szkic geodezyjny']),
    Z('chudy', 'Roboty ziemne i podłoże', 'Podkład z chudego betonu / podsypka', ['Rzędna i grubość podkładu', 'Klasa betonu podkładowego', 'Równość powierzchni', 'Zasięg podkładu poza obrys fundamentu'], ['Dowody dostawy betonu', 'Szkic geodezyjny']),
    // Zbrojenie i betonowanie
    Z('zbroj-plyta-fund', 'Zbrojenie i betonowanie', 'Zbrojenie płyty fundamentowej', ['Średnice i gatunek stali zgodne z rysunkiem', 'Rozstaw prętów siatki dolnej i górnej', 'Otulina – dystanse dolne i boczne, kozły pod siatkę górną', 'Długości zakładów i zakotwień', 'Zbrojenie na przebicie / dozbrojenia pod słupami', 'Pręty startowe słupów i ścian – położenie', 'Przerwy robocze, taśmy uszczelniające', 'Przepusty i przejścia instalacyjne', 'Uziom fundamentowy'], [...DZ, 'Szkic geodezyjny deskowania']),
    Z('zbroj-sciany', 'Zbrojenie i betonowanie', 'Zbrojenie ścian żelbetowych', ['Średnice i gatunek stali zgodne z rysunkiem', 'Rozstaw prętów pionowych i poziomych', 'Otulina – dystanse, liczba na m²', 'Zakłady prętów pionowych i połączenie z prętami startowymi', 'Zbrojenie naroży i połączeń ścian', 'Dozbrojenie krawędzi otworów', 'Spinki / strzemiona łączące siatki', 'Marki, przepusty i otwory – położenie', 'Deskowanie: stabilność, szczelność, środek antyadhezyjny'], [...DZ]),
    Z('zbroj-slupy', 'Zbrojenie i betonowanie', 'Zbrojenie słupów żelbetowych', ['Średnice i liczba prętów głównych', 'Strzemiona – średnica, rozstaw, zagęszczenie w strefach przypodporowych', 'Zakłady i połączenie z prętami startowymi', 'Otulina – dystanse', 'Pręty wypuszczone do wyższej kondygnacji / belek', 'Marki stalowe i kotwy', 'Deskowanie: wymiary, pion, stabilność'], [...DZ]),
    Z('zbroj-strop', 'Zbrojenie i betonowanie', 'Zbrojenie stropu / płyty żelbetowej', ['Średnice i gatunek stali zgodne z rysunkiem', 'Zbrojenie dolne – rozstaw, kierunek', 'Zbrojenie górne nad podporami – zasięg, rozstaw', 'Otulina – dystanse dolne, kozły pod zbrojenie górne', 'Zakłady i zakotwienia na podporach', 'Zbrojenie na przebicie przy słupach', 'Dozbrojenie krawędzi otworów', 'Przepusty, otwory, instalacje w płycie', 'Wypuszczone pręty do schodów / balkonów', 'Stemplowanie i deskowanie: rozstaw podpór, rzędne, strzałka odwrotna'], [...DZ, 'Projekt deskowania / stemplowania']),
    Z('zbroj-belki', 'Zbrojenie i betonowanie', 'Zbrojenie belek, podciągów i wieńców', ['Średnice i liczba prętów głównych dołem i górą', 'Strzemiona – średnica, rozstaw, zagęszczenie przy podporach', 'Zakotwienie prętów na podporach', 'Pręty odgięte / dozbrojenie na ścinanie', 'Otulina – dystanse', 'Połączenie z zbrojeniem słupów i płyty', 'Ciągłość zbrojenia wieńców w narożach'], [...DZ]),
    Z('zbroj-schody', 'Zbrojenie i betonowanie', 'Zbrojenie schodów i spoczników', ['Zbrojenie główne biegu – średnica, rozstaw', 'Zakotwienie w spocznikach i stropach', 'Pręty rozdzielcze', 'Otulina – dystanse', 'Wymiary stopni w deskowaniu', 'Przekładki akustyczne / dylatacje (jeśli w projekcie)'], [...DZ]),
    Z('zbroj-posadzka', 'Zbrojenie i betonowanie', 'Posadzka – zbrojenie, dyble i dylatacje przed betonowaniem', ['Folia poślizgowa – zakłady, brak uszkodzeń', 'Zbrojenie: siatki / dozowanie włókien wg receptury', 'Dyble i profile dylatacyjne – położenie, wysokość', 'Dozbrojenie naroży, słupów i krawędzi', 'Dylatacje obwodowe przy ścianach i słupach', 'Rzędne prowadnic / poziom odniesienia', 'Obiekt zamknięty, temperatura i brak przeciągów'], ['Projekt posadzki', 'Receptura betonu', 'Protokół odbioru podbudowy']),
    Z('desk', 'Zbrojenie i betonowanie', 'Deskowanie i gotowość do betonowania', ['Wymiary i rzędne deskowania', 'Stabilność i usztywnienie', 'Szczelność styków', 'Czystość, środek antyadhezyjny', 'Zbrojenie odebrane', 'Sprzęt do zagęszczania i dojazd pompy', 'Zabezpieczenie na wypadek opadów / niskiej temperatury'], ['Protokół odbioru zbrojenia', 'Szkic geodezyjny', 'Receptura betonu']),
    Z('przerwy', 'Zbrojenie i betonowanie', 'Przerwy robocze i taśmy uszczelniające', ['Lokalizacja przerw zgodna z projektem', 'Przygotowanie powierzchni styku', 'Taśmy / blachy / węże iniekcyjne – ciągłość i zamocowanie', 'Zbrojenie przechodzące przez przerwę'], ['Rysunek przerw roboczych', 'Karta systemu uszczelnień']),
    // Konstrukcja montowana
    Z('kielichy', 'Konstrukcja montowana', 'Zalanie stóp kielichowych / podlewki pod słupy', ['Słupy wypionowane – pomiar geodezyjny', 'Kielichy oczyszczone, zwilżone', 'Materiał zalania zgodny z projektem', 'Kliny montażowe – stan i liczba', 'Podlewki: szalunek, grubość, wypełnienie'], ['Szkic geodezyjny', 'Karta techniczna zaprawy / receptura betonu', 'Dziennik montażu – wpisy']),
    Z('sruby', 'Konstrukcja montowana', 'Połączenia śrubowe konstrukcji stalowej', ['Klasa i średnica śrub, komplet podkładek', 'Przyleganie powierzchni styku', 'Dokręcenie wstępne', 'Dokręcenie końcowe – metoda i moment', 'Oznakowanie dokręconych połączeń', 'Długość wystającego gwintu'], ['Rysunki warsztatowe', 'Deklaracje / świadectwa śrub', 'Świadectwo wzorcowania klucza', 'Protokół dokręcania']),
    Z('spoiny', 'Konstrukcja montowana', 'Spoiny montażowe konstrukcji stalowej', ['Przygotowanie krawędzi i czystość', 'Uprawnienia spawaczy', 'Instrukcja WPS', 'Wymiary i ciągłość spoin', 'Badania wizualne i NDT wg projektu', 'Uzupełnienie zabezpieczenia antykorozyjnego'], ['Rysunki warsztatowe', 'WPS / WPQR', 'Uprawnienia spawaczy', 'Protokoły badań spoin']),
    Z('antykor', 'Konstrukcja montowana', 'Zabezpieczenie antykorozyjne i ogniochronne konstrukcji', ['Przygotowanie powierzchni', 'System powłok zgodny z projektem', 'Grubość powłok – pomiary', 'Zaprawki po montażu', 'Warunki aplikacji (temperatura, wilgotność)', 'Zgodność z klasą odporności ogniowej'], ['Karty techniczne', 'Protokół pomiaru grubości powłok', 'Klasyfikacja ogniowa / aprobata systemu']),
    Z('styki-pref', 'Konstrukcja montowana', 'Styki i wieńce płyt prefabrykowanych', ['Długość oparcia płyt', 'Zbrojenie styków i wieńców', 'Czystość i zwilżenie styków', 'Klasa betonu / zaprawy wypełniającej', 'Podpory montażowe wg projektu'], ['Rysunek montażowy stropu', 'Deklaracje płyt']),
    // Izolacje
    Z('izol-term-fund', 'Izolacje', 'Izolacja termiczna fundamentów i ścian przyziemia', ['Materiał i grubość', 'Mocowanie / klejenie', 'Szczelność styków, mijankowy układ płyt', 'Zabezpieczenie przed uszkodzeniem przy zasypce'], ['Karty techniczne', 'Deklaracje właściwości użytkowych']),
    Z('izol-posadzka', 'Izolacje', 'Izolacje pod posadzką (folia, termoizolacja)', ['Podłoże zagęszczone i wyrównane', 'Izolacja przeciwwilgociowa – zakłady, wywinięcia', 'Termoizolacja – materiał, grubość, klasa wytrzymałości', 'Szczelność styków', 'Folia poślizgowa'], ['Projekt posadzki', 'Karty techniczne']),
    // Dach i obudowa
    Z('dach-blacha', 'Dach i obudowa', 'Blacha trapezowa dachu – mocowanie', ['Profil i grubość blachy', 'Kierunek i zakłady arkuszy', 'Łączniki do konstrukcji – typ, rozstaw', 'Zszycie zakładów podłużnych', 'Praca tarczowa – łączniki wg projektu', 'Obróbka otworów (świetliki, klapy)'], ['Projekt dachu', 'Deklaracje blachy i łączników']),
    Z('dach-warstwy', 'Dach i obudowa', 'Warstwy pokrycia dachu (paroizolacja, termoizolacja, membrana)', ['Paroizolacja – zakłady sklejone, szczelność przejść', 'Termoizolacja – materiał, grubość, układ mijankowy', 'Mocowanie mechaniczne – typ i liczba łączników w strefach', 'Membrana – zgrzewy, kontrola szczelności zgrzewów', 'Spadki i odwodnienie', 'Wpusty, przelewy awaryjne', 'Obróbki attyk i przejść'], ['Projekt dachu / obliczenia mocowań', 'Karty techniczne', 'Protokół próby szczelności']),
    Z('podkonstr', 'Dach i obudowa', 'Podkonstrukcja i mocowanie płyt warstwowych', ['Rygle / podkonstrukcja – wymiary, rozstaw', 'Łączniki – typ, liczba na podporę', 'Uszczelki i taśmy na stykach', 'Mocowanie płyt przy otworach', 'Cokół – uszczelnienie i obróbka'], ['Projekt obudowy', 'Deklaracje płyt i łączników']),
    Z('stolarka', 'Dach i obudowa', 'Osadzenie stolarki, bram i doków przed obróbkami', ['Wymiary i położenie w otworze', 'Mocowanie – typ i rozstaw kotew', 'Uszczelnienie: warstwa wewnętrzna, środkowa, zewnętrzna', 'Pion i poziom, działanie skrzydeł / bram'], ['Deklaracje właściwości użytkowych', 'Instrukcja montażu producenta']),
    Z('mur', 'Dach i obudowa', 'Ściany murowane – zbrojenie, kotwienie, nadproża', ['Materiał i klasa elementów oraz zaprawy', 'Zbrojenie spoin wspornych', 'Kotwienie do konstrukcji', 'Nadproża – typ, długość oparcia', 'Dylatacje i połączenie ze stropem', 'Wieńce / trzpienie'], ['Deklaracje właściwości użytkowych', 'Rysunki ścian']),
    // Instalacje i sieci
    Z('inst-elektr-pod', 'Instalacje i sieci', 'Instalacje elektryczne i przepusty przed zakryciem', ['Trasy i średnice rur osłonowych / przepustów', 'Głębokość ułożenia, podsypka', 'Pilot / drożność przepustów', 'Folia ostrzegawcza', 'Uszczelnienie wejść do budynku'], ['Projekt instalacji', 'Szkic powykonawczy tras']),
    Z('inst-sciany', 'Instalacje i sieci', 'Instalacje w bruzdach, szachtach i przed zabudową', ['Trasy zgodne z projektem', 'Mocowanie i izolacja przewodów', 'Próba szczelności / ciśnieniowa wykonana', 'Kompensacja i spadki', 'Dostęp do zaworów i rewizji'], ['Protokół próby', 'Projekt instalacji']),
    Z('tryskacze', 'Instalacje i sieci', 'Instalacja tryskaczowa przed zabudową', ['Średnice i trasy rurociągów', 'Zawiesia – typ i rozstaw', 'Rozmieszczenie i typ tryskaczy', 'Próba ciśnieniowa', 'Odległości od przeszkód'], ['Projekt instalacji', 'Protokół próby ciśnieniowej', 'Świadectwa dopuszczenia']),
    Z('wentylacja', 'Instalacje i sieci', 'Kanały wentylacyjne przed zabudową', ['Wymiary i trasy kanałów', 'Podwieszenia', 'Szczelność połączeń', 'Izolacja termiczna / ogniochronna', 'Klapy ppoż. – osadzenie i dostęp'], ['Projekt instalacji', 'Protokół szczelności']),
    Z('siec-wyk', 'Instalacje i sieci', 'Sieci zewnętrzne w wykopie przed zasypaniem', ['Materiał i średnica rur', 'Podsypka i obsypka', 'Spadki i rzędne dna', 'Połączenia i studnie', 'Próba szczelności', 'Taśma ostrzegawcza / lokalizacyjna', 'Inwentaryzacja geodezyjna'], ['Projekt sieci', 'Protokół próby szczelności', 'Szkic geodezyjny']),
    Z('odgrom', 'Instalacje i sieci', 'Instalacja odgromowa – przewody odprowadzające w konstrukcji', ['Przekrój i materiał przewodów', 'Połączenia – typ, zabezpieczenie', 'Ciągłość połączeń z uziomem', 'Złącza kontrolne'], ['Projekt instalacji', 'Protokół pomiarów ciągłości']),
    // Drogi i place
    Z('koryto', 'Drogi i place', 'Koryto i podłoże pod nawierzchnie', ['Rzędne i spadki koryta', 'Nośność / zagęszczenie podłoża', 'Odwodnienie koryta', 'Geowłóknina / geosiatka wg projektu'], ['Protokoły badań nośności', 'Szkic geodezyjny']),
    Z('podbudowa-drog', 'Drogi i place', 'Podbudowa dróg i placów', ['Materiał podbudowy – uziarnienie', 'Grubość warstwy', 'Zagęszczenie / nośność (E2, E2/E1)', 'Rzędne i spadki', 'Równość'], ['Protokoły badań nośności', 'Deklaracje kruszywa', 'Szkic geodezyjny']),
    Z('zbiornik', 'Drogi i place', 'Zbiornik retencyjny / ppoż. przed zasypaniem', ['Podłoże i podsypka', 'Posadowienie i rzędne', 'Połączenia i przejścia szczelne', 'Próba szczelności', 'Zabezpieczenie przed wyporem'], ['Projekt', 'Protokół próby szczelności', 'Deklaracje']),
  ];
})(window.M);
