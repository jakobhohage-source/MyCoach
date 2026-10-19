---
description: Fertigen Feature- oder Fix-Branch prüfen, nach main mergen und nach Rückfrage pushen
---

Bringe den aktuellen Branch nach `main`. Stoppt eine Prüfung, brich ab, nenne den Grund und mache nichts weiter.

1. **Branch:** Der aktuelle Branch muss `feature/*` oder `fix/*` sein. Auf `main` oder einem anderen Branch: stoppen.
2. **Arbeitsstand sauber:** `git status --porcelain` muss leer sein. Sonst die offenen Dateien auflisten und stoppen.
3. **Syntax-Check:** `node scripts/check-js.mjs`. Bei einem Fehler stoppen und die Ausgabe zeigen.
4. **Manuelle Tests:** Feature-Dokument des Branches finden: zuerst `docs/features/<branch-name-ohne-präfix>.md`, sonst die Datei unter `docs/features/`, die der Branch gegenüber `main` geändert hat (`git diff --name-only main...HEAD -- docs/features/`). Die Tests gelten als erledigt, wenn das Dokument eine Zeile `Manuelle Tests: ERLEDIGT am <Datum>` enthält.
   - Fehlt die Zeile oder gibt es kein Dokument (z. B. bei `fix/*`): stoppen und Jakob fragen, ob die Testschritte erledigt sind. Bei Ja die Zeile im Dokument ergänzen (falls es eins gibt), committen und weitermachen.
5. **Migrationen:** Für jede Datei in `supabase/migrations/` die erste Zeile lesen. Beginnt sie nicht mit `-- STATUS: ANGEWENDET`, stoppen und alle noch ausstehenden Migrationen mit Dateinamen auflisten.
6. **Merge:** `git switch main`, dann `git merge --no-ff <branch>`. Bei Konflikten abbrechen (`git merge --abort`), zurück auf den Branch wechseln und die Konflikte melden. Danach auf `main` erneut `node scripts/check-js.mjs`.
7. **Zusammenfassung:** Kurz zeigen, was nach `main` kommt (`git log --oneline origin/main..main`, `git diff --stat origin/main..main`). Dann genau eine Frage stellen: „Soll ich `main` jetzt pushen (geht sofort live)?“
8. **Push:** Nur bei Ja `git push origin main`. Danach Jakob erinnern:
   - die Live-Seite https://jakobhohage-source.github.io/MyCoach/ zu prüfen (ggf. Cmd+Shift+R),
   - den gemergten Branch zu löschen (`git branch -d <branch>`, ggf. auch auf origin).
   Bei Nein: nichts pushen, `main` bleibt lokal gemergt.
