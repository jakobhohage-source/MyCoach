---
description: Einen Bereich der App analysieren, Backlog erstellen und bis zu drei Verbesserungen umsetzen
argument-hint: <Bereich der App, z. B. Zeichenboard>
---

Optimiere den Bereich „$ARGUMENTS“ von MyCoach. `<bereich>` ist der Bereichsname in Kleinbuchstaben ohne Leerzeichen und Umlaute (z. B. `zeichenboard`).

Regeln für den ganzen Ablauf:
- Kleine Änderungen. Nie zwei Backlog-Punkte im selben Branch. Nur ein Agent ändert `index.html` zur selben Zeit.
- Nichts mit Zugangsdaten: `tests/e2e/.account.local` wird nie gelesen oder ausgegeben.
- Browser-Tests laufen nur lokal gegen `mycoach-dev` und beginnen immer mit `openTestEnv` (Sicherheitsprüfung „TESTUMGEBUNG“).
- Kein Push, kein Merge nach `main`. Shell-Befehle ohne `cd`-Präfix.

## 1. Interview
Subagents können keine Rückfragen stellen. Deshalb stellt der Haupt-Agent die Fragen des `product-owner` per AskUserQuestion, höchstens 4 Fragen:
1. Wer nutzt den Bereich, wo und mit welchem Gerät?
2. Was ist eine typische Aufgabe darin?
3. Was stört am meisten?
4. Woran erkennt Jakob „besser“?

Gib die Antworten an den `product-owner`. Fehlt etwas, trifft er eine vernünftige Annahme und nennt sie ausdrücklich.

## 2. Analyse auf Branch `analyse/<bereich>` (von `main`)
- `analyse/` steht in `.gitignore`. Screenshots kommen nach `analyse/<bereich>/`.
- `tester`: spielt die typischen Abläufe per Playwright gegen localhost durch, auf Desktop (1280×800) und Handy (390×844). Screenshots legt er in `analyse/<bereich>/` ab und notiert Beobachtungen: Klickzahl, Wartezeiten, Fehler, Konsolenmeldungen.
- `ux-designer`: bewertet die Screenshots und den Code gegen Bedienbarkeitsregeln:
  - Klickzahl für typische Aufgaben
  - Treffsicherheit auf dem Handy (Zielgröße mindestens 44 px, Abstände)
  - Rückgängig und Wiederholen
  - Speichern und Wiederfinden
  - Fehlermeldungen
  - Wiederverwendung
- `developer`: listet technische Schwächen im Code des Bereichs (Fehlerbehandlung, Zustandsverwaltung, Performance, Doppelungen). Er ändert nichts.
- Der `product-owner` führt alles zu `docs/features/<bereich>-analyse.md` zusammen:
  - Befunde
  - ein Backlog, sortiert nach Wirkung (hoch/mittel/gering) und Aufwand (S/M/L)
  - zu jedem Punkt Akzeptanzkriterien und ein Testvorschlag (Playwright oder manuell)
- Committen auf `analyse/<bereich>` (ohne Screenshots).

## 3. Sicherheitsnetz
Der `tester` schreibt `tests/e2e/<bereich>.spec.js` für den Grundablauf des Bereichs und nutzt dabei die Helfer aus `tests/e2e/helpers.js`. Danach muss `npx playwright test` grün sein. Erst dann geht es weiter. Ist der Test nicht grün zu bekommen, wird gestoppt und Jakob gefragt. Committen auf `analyse/<bereich>`.

## 4. Freigabepunkt 1
Zeige Jakob das Backlog kurz: Nummer, Titel, Wirkung, Aufwand. Frage per AskUserQuestion (multiSelect), welche bis zu drei Punkte umgesetzt werden sollen. Ohne seine Auswahl wird nichts gebaut.

## 5. Umsetzung
Für jeden gewählten Punkt nacheinander:
1. Branch `feature/<bereich>-<punkt>` von `main` anlegen. Als ersten Commit den Sicherheitsnetz-Test übernehmen: `git checkout analyse/<bereich> -- tests/e2e/<bereich>.spec.js`.
2. Normaler `/feature`-Ablauf:
   - `product-owner`: Spezifikation unter `docs/features/<bereich>-<punkt>.md` aus dem Backlog-Punkt
   - `ux-designer`, falls der Punkt eine Oberfläche hat
   - `db-architect` nur bei Datenbankbedarf. Dann gibt es nur eine Migration mit `-- STATUS: ENTWURF`. Sie wird nur auf `mycoach-dev` angewendet und erst nach Jakobs Freigabe.
   - `developer`
   - `tester` mit `npx playwright test` und einem neuen Test für die Akzeptanzkriterien
   - `reviewer`
3. Bei Blocker- oder Wichtig-Befunden zurück an den `developer`, höchstens zwei Fix-Schleifen. Ist der Branch danach nicht grün: stoppen, den Stand in der Spezifikation dokumentieren, committen und mit dem nächsten Punkt weitermachen.
4. Kleine, sprechende Commits auf dem Branch.

## 6. Bericht
Pro Punkt kurz:
- was geändert wurde
- wie getestet wurde (automatisch und manuell offen)
- Risiken
- Branch-Name

Zum Schluss die Erinnerung: Jakob prüft jeden Branch manuell, sagt „Tests erledigt“ und bringt ihn dann mit `/ship` nach `main`.
