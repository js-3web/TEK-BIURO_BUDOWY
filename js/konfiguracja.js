/* =========================================================
   TEK-BIURO BUDOWY — konfiguracja chmury (Supabase)
   ---------------------------------------------------------
   Wpisz tu dwie wartości z panelu Supabase (Settings → API Keys / Data API):
     url – adres projektu, np. https://abcdefghijklmnop.supabase.co
     key – klucz PUBLICZNY: „publishable” (sb_publishable_…) albo starszy „anon”
   Ten klucz jest przeznaczony do publikacji – danych pilnuje logowanie i reguły na serwerze.
   NIGDY nie wpisuj tu klucza „secret” ani „service_role”.
   Puste wartości = aplikacja działa bez synchronizacji (jak wersja 0.11).
   ========================================================= */
window.M = window.M || {};
window.M.CLOUD_CFG = {
  url: 'https://bodlrgzthonniwlfcxrk.supabase.co',
  key: 'sb_publishable_o63LtRrh3cpPcmbt2WcYUA_gZ6wSCD6',
};
