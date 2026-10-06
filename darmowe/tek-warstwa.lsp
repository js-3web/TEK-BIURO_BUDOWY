;;; ============================================
;;; TEK-WARSTWA.LSP  v1.0  (darmowy, TEKTORIA)
;;; Ustaw warstwe aktywna z zaznaczonego elementu
;;; Autor: AutoLISP dla ZWCAD 2022
;;; Uzycie: wpisz SS i wskaz element
;;; KOMENDA -> SS
;;; ============================================

(defun c:SS ( / ent entData layerName)
  
  ;; Wyłącz echo poleceń
  (setvar "CMDECHO" 0)
  
  ;; Poproś użytkownika o wybranie elementu
  (princ "\nWybierz element, z którego chcesz przejąć warstwę: ")
  
  (setq ent (car (entsel)))
  
  (if ent
    (progn
      ;; Pobierz dane elementu
      (setq entData (entget ent))
      
      ;; Wyciągnij nazwę warstwy (kod DXF 8)
      (setq layerName (cdr (assoc 8 entData)))
      
      (if layerName
        (progn
          ;; Ustaw warstwę jako aktualną
          (setvar "CLAYER" layerName)
          (princ (strcat "\nWarstwa aktywna: " layerName))
        )
        (princ "\nBłąd: Nie można odczytać warstwy elementu.")
      )
    )
    (princ "\nNie wybrano żadnego elementu.")
  )
  
  ;; Zakończ cicho
  (princ)
)

;;; ============================================
;;; Informacja o załadowaniu
;;; ============================================
(princ "\n=== TEKTORIA  TEK-WARSTWA zaladowany | komenda: SS (przejmij warstwe z elementu) ===")
(princ)