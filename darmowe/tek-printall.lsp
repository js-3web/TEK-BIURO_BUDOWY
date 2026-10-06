;;; ==================================================================
;;;  TEK-PRINTALL - wydruk arkuszy (Layout) do PDF (lub drukarka) w ZWCAD
;;;  ------------------------------------------------------------------
;;;  Wersja v0.6 - metoda COM (PlotToFile), cichy wydruk do pliku.
;;;  Kazdy arkusz drukowany z JEGO WLASNEGO page setupu (format, skala,
;;;  okno wydruku, styl CTB) - skrypt nie zmienia ustawien arkusza.
;;;  Auto-nadpisywanie istniejacych PDF (z ostrzezeniem, gdy plik otwarty).
;;;
;;;  UWAGA: Najpierw ustaw wydruki we wszystkich arkuszach(layout).
;;;
;;;  Komendy:
;;;    PDF1    - drukuje TYLKO biezacy (aktywny) arkusz do PDF
;;;    PDFALL  - drukuje WSZYSTKIE arkusze, kazdy do OSOBNEGO pliku PDF
;;;    PDFINFO - diagnostyka: lista arkuszy i ustawien wydruku
;;;    PDFVER  - pokazuje zaladowana wersje skryptu
;;;
;;;  Ustawienie folderu: zmienna *PJ-SUBDIR* ponizej.
;;;    "PDF" -> podfolder \PDF\ obok rysunku (domyslnie)
;;;    ""    -> ten sam folder co rysunek DWG
;;; ==================================================================

(vl-load-com)
(setq *PRINTJS-VER* "v0.6")
(setq *PJ-SUBDIR* "PDF")   ; podfolder na PDF-y; "" = folder rysunku

;; ---------------------- HELPERY -----------------------------------

;; encja obiektu Layout o zadanej nazwie (z ACAD_LAYOUT)
(defun pp:layout-ent (nm / lst prev r)
  (setq lst (dictsearch (namedobjdict) "ACAD_LAYOUT"))
  (foreach x lst
    (cond
      ((= (car x) 3) (setq prev (cdr x)))
      ((and (= (car x) 350) prev (= (strcase prev) (strcase nm)))
       (setq r (cdr x)))))
  r)

;; bezpieczny odczyt kodu DXF
(defun pp:dxf (code lst / v) (if (setq v (assoc code lst)) (cdr v) nil))

;; opis typu obszaru wydruku (kod DXF 74)
(defun pp:ptype (n)
  (cond ((= n 0) "Display")
        ((= n 1) "Extents")
        ((= n 2) "Limits/Layout")
        ((= n 3) "View")
        ((= n 4) "Window (okno)")
        ((= n 5) "Layout")
        (t (strcat "kod " (itoa (if n n -1))))))

;; zamiana znakow niedozwolonych w nazwie pliku na "_"
(defun pj:safe (s / c out)
  (setq out "")
  (foreach c (vl-string->list s)
    (if (member c '(92 47 58 42 63 34 60 62 124))
      (setq out (strcat out "_"))
      (setq out (strcat out (chr c)))))
  out)

;; folder wyjsciowy na PDF (tworzy podfolder jesli trzeba) -> string z "\\"
(defun pj:outdir ( / base dir)
  (setq base (getvar "DWGPREFIX"))
  (if (and *PJ-SUBDIR* (/= *PJ-SUBDIR* ""))
    (progn
      (setq dir (strcat base *PJ-SUBDIR*))
      (vl-catch-all-apply '(lambda () (if (not (findfile dir)) (vl-mkdir dir))))
      (strcat dir "\\"))
    base))

;; otworz folder w Eksploratorze Windows
(defun pj:openfolder (folder)
  (vl-catch-all-apply
    '(lambda () (startapp "explorer.exe" (strcat "\"" folder "\"")))))

;; RDZEN: wydrukuj JEDEN arkusz po nazwie -> plik PDF
;;   sukces -> (T . sciezka) ; blad -> (nil . komunikat)
(defun pj:plot-layout (nm folder / doc layouts fn res)
  (setq doc (vla-get-ActiveDocument (vlax-get-acad-object)))
  (setq layouts (vla-get-Layouts doc))
  (setq res (vl-catch-all-apply
              '(lambda () (vla-put-ActiveLayout doc (vla-item layouts nm)))))
  (if (vl-catch-all-error-p res)
    (cons nil (strcat "arkusz: " (vl-catch-all-error-message res)))
    (progn
      (setq fn (strcat folder (pj:safe nm) ".pdf"))
      ;; auto-nadpis: skasuj istniejacy plik przed drukiem
      (if (findfile fn) (vl-file-delete fn))
      (if (findfile fn)
        ;; plik nadal istnieje = zablokowany (otwarty w podgladzie)
        (cons nil (strcat "nie moge nadpisac - PDF otwarty w podgladzie? " fn))
        (progn
          (setq res (vl-catch-all-apply
                      '(lambda () (vla-PlotToFile (vla-get-Plot doc) fn))))
          (if (vl-catch-all-error-p res)
            (cons nil (vl-catch-all-error-message res))
            (cons t fn)))))))

;; ---------------------- KOMENDY -----------------------------------

;; PDF1 - drukuje biezacy (aktywny) arkusz
(defun c:PDF1 ( / folder nm res)
  (setq folder (pj:outdir))
  (setq nm (getvar "CTAB"))
  (princ (strcat "\n=== print_js PDF1 " *PRINTJS-VER* " ==="))
  (if (= (strcase nm) "MODEL")
    (princ "\nJestes na MODEL - przelacz na arkusz (Layout) i uruchom ponownie.")
    (progn
      (princ (strcat "\nDrukuje arkusz: " nm " ..."))
      (setq res (pj:plot-layout nm folder))
      (if (car res)
        (progn
          (princ (strcat "\nOK -> " (cdr res)))
          (princ (strcat "\nFolder: " folder))
          (pj:openfolder folder))
        (progn
          (princ (strcat "\nBLAD: " (cdr res)))
          (princ "\nWklej ten komunikat w czacie.")))))
  (princ))

;; PDFALL - wszystkie arkusze, osobne pliki PDF
(defun c:PDFALL ( / lays folder oct n fails res)
  (setq lays (layoutlist))
  (setq folder (pj:outdir))
  (setq oct (getvar "CTAB"))
  (setq n 0 fails nil)
  (princ (strcat "\n=== print_js PDFALL " *PRINTJS-VER* " : "
                 (itoa (length lays)) " arkuszy ==="))
  (foreach nm lays
    (princ (strcat "\n  -> " nm " ... "))
    (setq res (pj:plot-layout nm folder))
    (if (car res)
      (progn (setq n (1+ n)) (princ "OK"))
      (progn (setq fails (cons nm fails)) (princ (strcat "BLAD: " (cdr res))))))
  (if oct (vl-catch-all-apply '(lambda () (setvar "CTAB" oct))))
  (princ (strcat "\n=== Gotowe: " (itoa n) " z " (itoa (length lays)) " arkuszy ==="))
  (if fails
    (progn
      (princ "\nNIEUDANE:")
      (foreach f fails (princ (strcat "\n   - " f)))))
  (princ (strcat "\nFolder PDF: " folder))
  (pj:openfolder folder)
  (princ))

;; PDFINFO - diagnostyka (tylko odczyt)
(defun c:PDFINFO ( / lays nm ent ed dev pap sty pt i)
  (setq lays (layoutlist))
  (princ (strcat "\n=== print_js PDFINFO " *PRINTJS-VER* " ==="))
  (princ (strcat "\nRysunek: " (getvar "DWGNAME")))
  (princ (strcat "\nSciezka: " (getvar "DWGPREFIX")))
  (princ (strcat "\nArkuszy: " (itoa (length lays))))
  (setq i 1)
  (foreach nm lays
    (setq ent (pp:layout-ent nm))
    (setq ed  (if ent (entget ent) nil))
    (setq dev (pp:dxf 2 ed))
    (setq pap (pp:dxf 4 ed))
    (setq sty (pp:dxf 7 ed))
    (setq pt  (pp:dxf 74 ed))
    (princ (strcat "\n[" (itoa i) "] " nm))
    (princ (strcat "\n     drukarka: " (if (and dev (/= dev "")) dev "<brak>")))
    (princ (strcat "\n     format  : " (if (and pap (/= pap "")) pap "<brak>")))
    (princ (strcat "\n     CTB     : " (if (and sty (/= sty "")) sty "<brak>")))
    (princ (strcat "\n     obszar  : " (pp:ptype pt)))
    (setq i (1+ i)))
  (princ (strcat "\nBACKGROUNDPLOT: " (itoa (getvar "BACKGROUNDPLOT"))))
  (princ "\n=== KONIEC ===")
  (princ))

;; PDFVER
(defun c:PDFVER ()
  (princ (strcat "\nprint_js wersja: " *PRINTJS-VER*))
  (princ))

(princ (strcat "\n>> Zaladowano print_js " *PRINTJS-VER*
               " | komendy: PDF1 PDFALL PDFINFO PDFVER"))
(princ)
