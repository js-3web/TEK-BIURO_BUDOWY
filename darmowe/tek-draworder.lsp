;;; ================================================
;;; TEK-DRAWORDER.LSP  v1.0  (darmowy, TEKTORIA)
;;; Szybka zmiana kolejnosci wyswietlania obiektow
;;;   DB - przesun zaznaczone obiekty POD SPOD
;;;   DF - przesun zaznaczone obiekty NA WIERZCH
;;; Dziala na wczesniejszym zaznaczeniu lub poprosi o wybor.
;;; ================================================

(defun c:DB (/ ss)
  (if (setq ss (ssget "_I"))
    (command "_.DRAWORDER" ss "" "_Back")
    (progn
      (setq ss (ssget))
      (if ss
        (command "_.DRAWORDER" ss "" "_Back")
      )
    )
  )
  (princ)
)
(defun c:DF (/ ss)
  (if (setq ss (ssget "_I"))
    (command "_.DRAWORDER" ss "" "_Front")
    (progn
      (setq ss (ssget))
      (if ss
        (command "_.DRAWORDER" ss "" "_Front")
      )
    )
  )
  (princ)
)

(princ "\n=== TEKTORIA  TEK-DRAWORDER v1.0 zaladowany | komendy: DB (pod spod), DF (na wierzch) ===")
(princ)
