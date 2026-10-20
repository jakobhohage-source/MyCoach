# Zeichenboard Z1: Gespeicherte Taktik nach Reload öffnen

Status: Umgesetzt auf Branch feature/zeichenboard-z1

Manuelle Tests: ERLEDIGT am 20.10.2026
Branch: `feature/zeichenboard-z1`
Quelle: Backlog-Punkt Z1 der Zeichenboard-Analyse, Frage F1 (Annahme unwidersprochen: Öffnen landet direkt im Board mit der Taktik).

## Problem

Wer die App neu lädt und im Dashboard eine gespeicherte Taktik anklickt, sieht eine leere Seite. Ursache in `index.html`: `showView('board')` blendet bei `boardInited === false` die Feldauswahl ein und `boardOuter` aus. `openSavedEx` versteckt danach die Feldauswahl, blendet aber `boardOuter` nicht ein (das macht sonst nur `startBoard`). Der typische Fall "am Platz die App öffnen und die Übung laden" endet damit im Nichts. Im selben Besuch klappt es nur, weil das Board schon einmal geöffnet war.

## Was es tut

Das Öffnen einer gespeicherten Taktik zeigt nach einem Reload sofort das Board mit allen gespeicherten Spielern und Linien. Keine leere Seite mehr.

## Wer es nutzt

Trainer, die eine gespeicherte Übung aus der Liste `#savedExercisesList` (Dashboard) öffnen, besonders direkt nach dem Start der App, auf Desktop, Tablet und Handy.

## Funktionsweise

- `openSavedEx(id)` stellt sicher, dass `boardOuter` sichtbar ist (`display:flex`, wie in `startBoard`) und die Feldauswahl versteckt ist, bevor oder während `initBoard(ft)` läuft. Das gilt für beide Zweige (Board noch nicht initialisiert, Board schon initialisiert).
- Feldtyp kommt aus `boardData.fieldType` (Fallback `full`), wird in `selectedFieldType` gesetzt und `initBoard`/`resizeBoard` erhält ihn.
- Das Canvas muss nach dem Einblenden eine Größe größer 0 haben. Das bestehende `resizeBoard()` nach 80 ms bleibt, die Größenmessung darf aber nicht auf ein noch verstecktes Element treffen.
- Rest der Wiederherstellung (Pfade, Entities, Bewegungen) bleibt unverändert.
- Kleinste Änderung: nur die Sichtbarkeit in `openSavedEx` korrigieren. Kein Umbau von `showView`, `startBoard` oder `initBoard`.

Umsetzung:

- `openSavedEx` setzt direkt nach dem Verstecken der Feldauswahl `#boardOuter` auf `display:flex`, vor `initBoard(ft)` bzw. `resizeBoard()`. So misst die Initialisierung ein sichtbares Element, das Canvas hat Größe > 0.
- Eine Zeile in `index.html`, keine Änderung an `showView`, `startBoard`, `initBoard`. Im Zweig "Board schon initialisiert" ist die Zeile wirkungslos (bereits sichtbar), es wird nichts doppelt initialisiert.
- Tests: `test.fail()` entfernt, Umweg im Grundablauf-Test entfernt. Tablet- und Handy-Varianten automatisiert, Taktik dort per DB-Insert angelegt (Aufbau per UI auf dem Handy scheitert an Z8).

## Akzeptanzkriterien

1. Nach einem Reload öffnet ein Klick auf eine gespeicherte Taktik im Dashboard das Board mit allen gespeicherten Spielern und Linien. Gilt im Desktop-Viewport sowie bei 820x1180 und 390x844.
2. Es ist zu keinem Zeitpunkt eine leere Seite sichtbar: `#boardOuter` ist sichtbar, die Feldauswahl nicht (Öffnen landet direkt im Board, Annahme F1).
3. Der Feldtyp der Taktik ist nach dem Öffnen gesetzt (`selectedFieldType` entspricht `boardData.fieldType`), `#drawCanvas` hat Breite und Höhe größer 0.
4. Öffnen im selben Besuch (Board vorher schon einmal geöffnet) funktioniert unverändert, auch mit anderem Feldtyp als beim vorherigen Öffnen.
5. In `tests/e2e/zeichenboard.spec.js` wird der Test "Taktik direkt nach Reload öffnen" ohne `test.fail()` normal grün (Titel ohne "(bekannter Fehler)", Kommentar zum bekannten Fehler entfällt).
6. Der Umweg im Grundablauf-Test (Board über Feldauswahl öffnen, Dashboard, dann Taktik) entfällt: nach `reloadAndLogin` wird die Taktik direkt geöffnet. Der Test bleibt grün.
7. Keine Konsolenfehler und keine unerwarteten Dialoge (`expectNoProblems`). `node scripts/check-js.mjs` läuft fehlerfrei.

## Edge Cases

- `boardData` null oder fehlend: bestehendes Verhalten bleibt, `showView('board')` zeigt die Feldauswahl. Das ist kein leerer Bildschirm und bleibt so. `boardData` als `{}`: Board mit Feldtyp `full`, ohne Inhalte.
- `boardData` ohne `fieldType`: Fallback `full`.
- `boardData` ohne `paths`, `entities` oder `movements`: leere Teile, Board trotzdem sichtbar.
- Anderer Feldtyp als zuletzt: Feld wird neu gezeichnet, Statuszeile und Spielfeldgröße stimmen zum neuen Typ.
- Board bereits initialisiert: Sichtbarkeit setzen darf nichts doppelt initialisieren (kein zusätzlicher `initBoard`-Aufruf, keine zusätzlichen Listener durch diese Änderung).
- Mobile (390x844, Touch): Board wird sichtbar, Canvas größer 0. Dass das Feld dort sehr klein ist, gehört zu Z8 und ist hier nicht Teil der Prüfung (siehe Abgrenzung).
- Nutzer nicht eingeloggt: Liste enthält nur lokale Taktiken der Sitzung, Verhalten unverändert.

## Abgrenzung

Bewusst nicht enthalten:
- Phasen, Spielernamen, Labels wiederherstellen (Z5), Phasen-Reset beim Öffnen.
- Fehlerbehandlung beim Laden, Speichern, Löschen (Z2).
- Koordinaten in Feld-Prozent statt Pixeln (Z7), Mobile-Layout und Touch-Ziele (Z8, Z14).
- Doppelte Listener in `initBoard` (Z26), Refactoring des Entity-DOM (Z22).
- Markierung der gewählten Feldkarte in der Feldauswahl.
- Keine Änderung an `showView`-Verhalten für das normale Öffnen des Boards über die Navigation.

## Datenbankbezug

Keiner. Es wird nur gelesen, was bereits in `tactics` (`field_type`, `board_data`) liegt und von `loadSavedExercises` in `savedExercises` geladen wird. Keine Migration.

## Testvorschlag

Playwright in `tests/e2e/zeichenboard.spec.js`, bestehende Helfer (`makeMarker`, `watchPage`, `openTestEnv`, `login`, `cleanupByMarker`):
1. `test.fail()` aus "Taktik direkt nach Reload öffnen" entfernen, Titel und Kommentar anpassen.
2. Umweg im Grundablauf-Test entfernen (Zeilen "Umweg wegen bekanntem Fehler" bis zum Klick auf die Taktik ersetzen durch direkten Klick nach `reloadAndLogin`).
3. Dasselbe Szenario zusätzlich mit `page.setViewportSize` 820x1180 und 390x844: `#boardOuter` sichtbar, 4 `.field-entity`, Zustand wie gespeichert, `#drawCanvas` Breite und Höhe größer 0.
4. Prüfen, dass die Feldauswahl (`#fieldPicker`) nach dem Öffnen nicht sichtbar ist.
5. Optional: im selben Besuch zweimal öffnen (Regression Kriterium 4).
6. Danach `node scripts/check-js.mjs` und die gesamte Zeichenboard-Spezifikation.

## Verbundene Features

- Dashboard/Startseite: Liste `#savedExercisesList` und `openSavedEx`.
- Zeichenboard: `startBoard`, `initBoard`, `resizeBoard`, `showView('board')`, `boardInited`.
- Tabelle `tactics` (nur lesend).
- Sicherheitsnetz `tests/e2e/zeichenboard.spec.js`.
- Folgepunkte im Backlog: Z2, Z5, Z7, Z8 (bauen auf einem funktionierenden Öffnen auf).

## Testbericht

Stand: Tester-Durchlauf, uncommitteter Diff auf `feature/zeichenboard-z1`.

Ausgeführt: `node scripts/check-js.mjs` (OK) und `npx playwright test` gegen mycoach-dev (TESTUMGEBUNG): 8 von 8 bestanden.

### Ergebnis je Test (im Browser ausgeführt)

| Test | Ergebnis |
|---|---|
| smoke: Beitrag, Kommentar, Taktik | bestanden |
| xss: Name und Verein nur als Text | bestanden |
| Zeichenboard: Übung aufbauen, speichern, neu laden, öffnen (ohne Umweg) | bestanden |
| Taktik direkt nach Reload öffnen (Desktop) | bestanden |
| Im selben Besuch erneut öffnen, anderer Feldtyp (synthetisch, nur im Speicher) | bestanden |
| Edge Cases: ohne boardData, ohne fieldType | bestanden |
| Tablet 820x1180, Touch: Taktik direkt nach Reload öffnen | bestanden |
| Handy 390x844, Touch: Taktik direkt nach Reload öffnen | bestanden |

Nicht abgedeckt: "Speichern per UI" auf dem Tablet (dort wird die Taktik wie auf dem Handy per DB-Insert angelegt, Speichern per UI nur auf Desktop).

Neue Assertions (`expectBoardOpen`): `#boardOuter` sichtbar, `#fieldPicker` nicht sichtbar, `#drawCanvas` width/height und Bounding Box größer 0, dazu `expectNoProblems`.

### Akzeptanzkriterien

1. Erfüllt, im Browser: Desktop, 820x1180 und 390x844. Auf dem Handy wird die Taktik per DB-Insert angelegt (Aufbau per Maus auf dem winzigen Feld nicht praktikabel, Z8), geöffnet per Klick in der Liste. Auf dem Handy wurde nur geprüft, dass 4 Entities und 2 Pfade im Zustand vorhanden sind, nicht die Pixelgenauigkeit der Linien.
2. Erfüllt, im Browser (`#boardOuter` sichtbar, `#fieldPicker` nicht sichtbar). "Zu keinem Zeitpunkt leer" wurde nicht über Zwischenzustände gemessen, nur nach dem Klick.
3. Erfüllt, im Browser: `selectedFieldType` = `half` bzw. `full` (Fallback), Canvas größer 0.
4. Erfüllt, im Browser: erneutes Öffnen und Wechsel half -> full (synthetischer Eintrag). Im Code geprüft: im Zweig `boardInited` ruft `openSavedEx` nur `resizeBoard()` auf, kein zweites `initBoard`.
5. Erfüllt: `test.fail()` und "(bekannter Fehler)" entfernt, Test grün.
6. Erfüllt: Umweg entfernt, Test grün.
7. Erfüllt: `expectNoProblems` in den neuen Tests ohne Befund, `check-js` OK.

### Edge Cases

- `boardData` null: Feldauswahl sichtbar, Board versteckt (im Browser).
- `boardData` ohne `fieldType`: Fallback `full` (im Browser).
- `boardData` ohne `paths`/`entities`/`movements`: im Code geprüft (Array.isArray-Guards), nicht im Browser.
- `boardData` = `{}` (leeres Objekt): ist truthy, daher öffnet das Board mit Feldtyp `full`, nicht die Feldauswahl. Weicht vom Wortlaut der Spec ab ("leer: Feldauswahl"), aber kein leerer Bildschirm. Nur im Code geprüft.
- Nicht eingeloggt: nicht geprüft, die Änderung betrifft diesen Pfad nicht.
- Supabase-Fehler beim Laden: gehört zu Z2.

### Mängel

- Blocker: keine.
- Wichtig: keine.
- Hinweis: Spec-Wortlaut zu `boardData` leer weicht vom Code ab (siehe oben). Die Tests für Kriterium 4 und Edge Cases nutzen synthetische Einträge im Seitenspeicher, keine zweite DB-Taktik.

### Manuelle Testschritte für Jakob

1. Neue Taktik im Zeichenboard bauen (Spieler, Pfeile) und auf Startseite speichern.
2. Seite hart neu laden (Cmd+Shift+R), einloggen, im Dashboard die Taktik anklicken: Board mit allen Spielern und Linien muss sofort sichtbar sein, keine Feldauswahl, keine leere Seite.
3. Dasselbe am echten Handy oder in den DevTools mit 390x844 und 820x1180 (Touch). Das Feld ist auf dem Handy klein (Z8), muss aber sichtbar sein.
4. Danach im selben Besuch zum Dashboard und eine Taktik mit anderem Feldtyp öffnen: Feld und Statuszeile passen zum Typ.
5. Linien auf dem Handy mit dem Original vergleichen (Pixelkoordinaten, Z7), Abweichung ist bekannt und nicht Teil von Z1.
