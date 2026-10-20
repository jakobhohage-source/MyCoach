# Zeichenboard Z6: Objekte per Tap-to-place platzieren

**Status:** Umgesetzt auf Branch feature/zeichenboard-z6.

Manuelle Tests: ERLEDIGT am 20.10.2026

## Problem
Jeder Klick auf „Angreifer“, „Hütchen“ usw. setzt das Objekt an eine Zufallsposition (`placeEntity`, `Math.random`). Der Trainer muss jedes Objekt nachziehen. Das ist die größte Zeitbremse beim Aufbauen einer Übung, am Laptop wie am Tablet.

## Was es tut
Der Trainer wählt ein Objekt-Werkzeug und tippt/klickt aufs Feld. Das Objekt entsteht genau dort. Das Werkzeug bleibt aktiv, bis der Trainer es beendet. 10 Spieler = 1 Werkzeugwahl + 10 Taps, kein Nachziehen.

## Wer es nutzt
Trainer beim Aufbau einer Übung im Zeichenboard, mit Maus (Laptop) und Touch (Tablet/Handy).

## Funktionsweise
- Betroffene Buttons: `#btn-add-att`, `#btn-add-def`, `#btn-add-gk`, `#btn-add-cone`, `#btn-add-ball`, Stange, Pylone (die beiden letzten bekommen IDs `#btn-add-pole`, `#btn-add-pylon`). Statt `placeEntity` direkt aufzurufen, setzen sie einen Platzier-Modus (neuer Zustand, z. B. `placeType`).
- Im Platzier-Modus nimmt `bDown` (Pointer-Handler auf `#drawCanvas`) den Tap an, rechnet die Position relativ zum Feld-Rechteck (`#playerLayer`, dort gelten die Feld-Prozent) um und ruft `placeEntity` mit dieser Position auf. Es wird dabei nicht gezeichnet.
- Beenden: Esc, erneuter Klick auf den aktiven Button, oder Wechsel auf ein anderes Werkzeug (Pfeil/Linie/Radierer/Entfernung/Beschriftung, Laufweg/Ballweg/Auswählen, anderes Objekt-Werkzeug). Beim Öffnen eines Boards ist kein Platzier-Modus aktiv.
- Sichtbar: aktiver Button mit der bestehenden `on`-Darstellung, Modus-Pill und Hinweiszeile (`#modePill`, `#bsHint`) zeigen „Platzieren: <Objekt> (Esc beendet)“, Cursor Fadenkreuz.
- Bestehende Objekte haben eigene `pointerdown`-Handler (`makeDraggableEntity`, `stopPropagation`) und liegen über dem Canvas. Verschieben bleibt dadurch auch im Platzier-Modus möglich, ein Tap auf ein Objekt setzt kein neues.

## Funktionsweise (Umsetzung)
- Zustand `placeType` (+ `placeGroupOpts` für Gruppen) in `index.html`, Funktionen `startPlacing`, `stopPlacing`, `togglePlacing`, `placeAtPointer` direkt vor `placeEntity`. Buttons rufen `togglePlacing(type)`, Stange/Pylone haben jetzt IDs, alle Objekt-Buttons `aria-pressed`.
- `bDown` prüft zuerst `placeType` und ruft `placeAtPointer(e)`: Position aus `#playerLayer`-Rechteck, auf 1–99 % geklemmt, danach `addPlayer`/`placeEntity`/`placeGroup` mit neuem optionalem Parameter `pos`. Ohne `pos` (Vorlagen via `placeEntityAt`) bleibt das alte Verhalten.
- `setMovementMode` ruft zuerst `stopPlacing()`; damit beenden `setTool`, Laufweg, Ballweg, Auswählen und Board leeren den Modus. Esc: globaler `keydown`-Listener, ignoriert Eingabefelder.
- `showView` beendet einen aktiven Platzier-Modus (`if(placeType)setMovementMode(null)`) am Anfang. Das deckt Ansichtswechsel, Board verlassen/betreten und `openSavedEx` ab (kein Geister-Platzieren); funktioniert auch bei nie initialisiertem Board.
- Gruppe: „OK“ im Dialog startet den Modus, ein Tap setzt die Gruppe und beendet ihn.
- Tests: `tests/e2e/zeichenboard-z6.spec.js` (Maus 1280×800, Touch 820×1180), Sicherheitsnetz `zeichenboard.spec.js` auf Tap-to-place umgestellt.

## Akzeptanzkriterien
1. Werkzeug wählen (z. B. Angreifer), Klick/Tap auf einen Feldpunkt: Das Objekt liegt dort. Abweichung in `entities[i].x/y` höchstens 1 Prozentpunkt (Feld-Prozent, wie im `#playerLayer`).
2. Das Werkzeug bleibt aktiv: 3 Taps nacheinander ergeben 3 Objekte an 3 Positionen, ohne erneute Werkzeugwahl.
3. Das Platzieren endet bei Esc, bei erneutem Klick auf den aktiven Button und bei Wechsel auf ein anderes Werkzeug. Danach setzt ein Tap aufs Feld kein Objekt mehr.
4. Der aktive Zustand ist erkennbar: Button hat Klasse `on`, Pill/Hinweiszeile nennen das Objekt. Nach dem Beenden ist beides weg.
5. Mit Pfeil/Linie/gestrichelt: Zeichnen funktioniert unverändert (`paths.length` wächst); im Platzier-Modus entsteht beim Tap keine Linie.
6. Ein vorhandenes Objekt lässt sich im Platzier-Modus und danach per Ziehen verschieben. Dabei entsteht kein neues Objekt.
7. Laufweg/Ballweg: Wechsel in den Modus beendet das Platzieren, Wege lassen sich wie bisher ziehen.
8. Maus und Touch: Kriterien 1 bis 3 gelten mit Mausklick (1280×800) und mit Touch-Tap (Tablet 820×1180).
9. Gespeichert wird wie bisher in Feld-Prozent (`board_data`, Format unverändert). Speichern, Neuladen, Öffnen liefert dieselben Positionen (Toleranz 0,1).
10. Der Spielername aus `#playerNameInput` gilt für den nächsten platzierten Spieler und wird danach geleert (wie heute bei `addPlayer`).
11. Ein Klick auf einen Objekt-Button setzt nie mehr ein Objekt allein (keine Zufallsposition).
12. Sicherheitsnetz `tests/e2e/zeichenboard.spec.js` ist grün, nach der notwendigen Anpassung (siehe Testvorschlag). `node scripts/check-js.mjs` ist grün.

## Edge Cases
- Tap auf ein vorhandenes Objekt: kein neues Objekt (Objekt fängt den Tap ab). Wer nahe daneben tippt, setzt ein neues, auch wenn sich beide überlappen.
- Tap außerhalb des Canvas (Toolbar, Seitenränder): nichts passiert, Modus bleibt aktiv.
- Tap im Canvas-Rand außerhalb des Spielfelds (eingerückter Bereich): Position wird auf 1–99 % begrenzt, wie beim Verschieben.
- Esc während der Namenseingabe (`#playerNameInput`, Umbenennen): gehört dem Eingabefeld und beendet das Platzieren nicht.
- Torwart: wird wie die anderen Spieler an der getippten Stelle gesetzt (bisher fester Platz am Tor).
- Hütchen: die bisherige Ketten-Zufallslogik (`lastConeId`, Versatz 8 %) entfällt beim Platzieren, jedes Hütchen steht, wo getippt wurde.
- Gruppe…: nach „OK“ im Dialog wartet die Gruppe auf genau einen Tap (dann endet der Modus von selbst). Gruppen sind keine Dauerwerkzeuge.
- Vorlagen (`applyPreset`): setzen weiter feste Positionen, unverändert.
- Phasenwechsel: Platzier-Modus bleibt aktiv, Objekt wird in der gerade angezeigten Phase angelegt.
- Undo: Undo betrifft weiterhin nur Wege/Linien, nicht das Platzieren. Das ist der heutige Stand und wird hier nicht geändert (Z11).
- Mehrfachtap/Doppelklick: jeder Tap setzt ein Objekt. Doppelklick auf einen Spieler zum Umbenennen bleibt, weil der Spieler den Tap abfängt.

## Abgrenzung (bewusst nicht enthalten)
- Keine Hütchenreihe, kein Raster/Einrasten (Z12).
- Kein Undo/Redo fürs Platzieren (Z11), kein Auswählen/Löschen/Duplizieren (Z10).
- Keine 44-px-Touch-Ziele (Z14), kein neues Mobil-Layout (Z8); auf dem Handy gilt das heutige Layout.
- Kein Weg-Anfasser am Spieler (Z9), keine Lupe/kein Versatz fürs Zielen.
- Keine Geistervorschau am Cursor (aus UX-Vorschlag V2), keine neue Objektart, keine neue Bewegungs- oder Datenlogik.

## Datenbankbezug
Keiner. Es reicht die bestehende Tabelle `tactics` (`board_data`, Format unverändert). Keine Migration.

## Verbundene Features
- Zeichenboard-Toolbar, Modus-Pill/Hinweiszeile, Statuszeile (`updateBoardStatus`).
- Verschieben (`makeDraggableEntity`), Zeichenwerkzeuge (`setTool`, `bDown`), Bewegungsmodi (`setMovementMode`).
- Folgepunkte: Z12 (baut darauf auf), Z10, Z11, Z14, Z8.
- Speichern/Laden von Taktiken, Trainingsplaner (nutzt Übungen aus dem Board).

## Annahmen (ohne Rückfrage getroffen)
- Zweiter Klick auf den aktiven Button beendet den Modus (wie in der Analyse beschrieben). Folge: Das Sicherheitsnetz, das `#btn-add-att` zweimal klickt, muss angepasst werden.
- Platziert wird beim Aufsetzen (pointerdown), nicht beim Loslassen. Einfach und exakt an der Fingerposition.
- Aktiv-Darstellung übernimmt die bestehende grüne `on`-Optik. Die offene Styleguide-Frage a) (Grün vs. Schwarz) bleibt bei Jakob.
- Torwart und Gruppe werden mit einbezogen, damit nirgends mehr Zufallspositionen entstehen.

## Testvorschlag (Playwright)
- Desktop 1280×800: Zeichenboard öffnen, `#btn-add-att` klicken, an 3 definierten Punkten des `#playerLayer` (z. B. 20/30, 50/50, 80/70 %) klicken; `entities[i].x/y` gegen die Erwartung prüfen (Toleranz 1). Esc, erneuter Klick aufs Feld: `entities.length` bleibt 3. Zweites Mal Werkzeug wählen und per Klick auf denselben Button beenden.
- Kollision: Pfeil-Werkzeug wählen, ziehen: `paths.length` 1, `entities.length` unverändert. Im Platzier-Modus ein vorhandenes Objekt ziehen: Position ändert sich, `entities.length` unverändert.
- Touch: neuer Kontext mit `hasTouch: true`, Viewport 820×1180, dieselben 3 Punkte per `page.touchscreen.tap`.
- Speichern und Wiederöffnen: Positionen bleiben (wie im Sicherheitsnetz).
- Sicherheitsnetz anpassen: Schritt „4 Spieler setzen“ nutzt Werkzeug wählen + 4 Klicks auf feste Feldpunkte statt 4 Button-Klicks; der Verschiebe-Schritt bleibt. Der Rest ändert sich nicht.

## Offene Fragen an Jakob
Keine, die den Umfang stark ändern. Die Annahmen oben gelten, bis Jakob etwas anderes sagt.

## UX-Entwurf

Kein neuer View, kein Dialog, keine Änderung an Top-Nav oder Mobile-Bottom-Nav. Alles lebt in der bestehenden Zeichenboard-Toolbar (`.entity-btn`), Modus-Pill (`#modePill`) und Statuszeile (`#bsStats`, `#bsHint`).

### Aktiver Modus sichtbar
- Button: Klasse `on` (Bestand, `.entity-btn.on`, Zeile ~838, aktuell grün). Keine neue Farbe. Styleguide-Frage Grün vs. Schwarz bleibt offen bei Jakob; wird später nur dort in der CSS-Regel gelöst, Z6 braucht keine Änderung.
- Genau ein Objekt-Button hat `on`; beim Wechsel wird er vom vorigen entfernt. Zusätzlich `aria-pressed="true"` am aktiven, `"false"` an den übrigen Objekt-Buttons.
- Modus-Pill `#modePill`: Text „Platzieren: Angreifer“ (Objektname wie Button-Label), bestehende Pill-Klasse nutzen, keine neue Variante.
- Hinweiszeile `#bsHint` (grau, rechts in der Statuszeile):
  - Maus/Tastatur: „Spieler setzen – klicken zum Platzieren, Esc zum Beenden“ (Objektname anpassen: „Hütchen setzen“, „Ball setzen“ …).
  - Touch (`matchMedia('(pointer: coarse)')`): „Spieler setzen – tippen zum Platzieren, Button erneut tippen zum Beenden“. Kein Esc-Hinweis.
  - Gruppe: „Gruppe setzen – einmal aufs Feld tippen“.
  - Beim Beenden den vorherigen Standardtext von `#bsHint` wiederherstellen. `#bsStats` (Zähler) bleibt unverändert.
- Cursor: Desktop `crosshair` auf `#drawCanvas` im Platzier-Modus (ist im Bestand bereits der Zeichen-Cursor, daher im Platzier-Modus keine Änderung nötig; nach Beenden wieder wie vom aktuellen Werkzeug gesetzt).

### Ablauf
1. Objekt-Button tippen/klicken: Modus startet, Button `on`, Pill und Hinweis wechseln. Es entsteht nichts.
2. Feld tippen/klicken: Objekt entsteht exakt an dieser Stelle (pointerdown). Werkzeug bleibt aktiv, nächster Tap setzt das nächste Objekt. `#bsStats` zählt hoch.
3. Tap auf ein vorhandenes Objekt: verschiebt/benennt wie bisher, setzt nichts Neues (Objekt fängt den Tap ab). Auch Ziehen funktioniert im Modus weiter.
4. Beenden: erneuter Tap auf den aktiven Button, Esc (nur Desktop, nicht im Namensfeld), Wechsel auf anderes Werkzeug/Objekt-Button/Laufweg/Ballweg. Danach: `on` und `aria-pressed` weg, Pill und Hinweis zurück auf Standard.
5. Name: Steht ein Name in `#playerNameInput`, trägt ihn der nächste gesetzte Spieler, das Feld wird geleert (Bestand).
- Leerzustand: leeres Feld, Modus aktiv zeigt den Hinweis; kein zusätzlicher Leertext nötig.
- Lade-/Fehlerzustand: entfällt, rein lokal, kein Netzwerk. Tap außerhalb des Feldes: nichts, kein Toast.

### Rückmeldung beim Setzen
Das Objekt erscheint sofort an der Stelle und `#bsStats` zählt hoch. Das genügt. Kein Puls, keine Animation, kein Toast (nicht trivial, kein Mehrwert).

### Barrierearmut
- `aria-pressed` an allen sieben Objekt-Buttons, synchron zu `on`.
- Esc beendet den Modus global, ausgenommen Fokus in Eingabefeldern (`#playerNameInput`, Umbenennen).
- Beim Beenden per Esc bleibt der Fokus, wo er war; er wird nicht verschoben. Sichtbarer Fokusring der Buttons bleibt unverändert.
- Modus-Wechsel für Screenreader: `#bsHint` bekommt `aria-live="polite"`, damit „Angreifer setzen …“ angesagt wird.
- Reine Tastaturplatzierung (Pfeiltasten) ist nicht Teil von Z6.

### Mobile / Touch
- Gleiche Toolbar und gleiches Layout wie heute, nur Hinweistext ohne Esc. Pointer-Events decken Maus und Touch ab. Auf `#drawCanvas` bleibt `touch-action: none`, damit der Tap nicht scrollt.
- Beenden ausschließlich per Button oder Werkzeugwechsel, daher steht dieser Weg im Touch-Hinweis.

### Ausdrücklich nicht Teil von Z6
- Keine Geistervorschau am Cursor/Finger.
- Kein Raster/Einrasten (Z12).
- Keine 44-px-Touch-Ziele und kein neues Mobil-Layout (Z14, Z8).
- Kein Puls/Animation, keine neue Farbe, kein neuer Button-Stil, kein Toast.
- Kein Undo, Löschen, Duplizieren (Z10, Z11).
- Kein Tastatur-Platzieren.

### Hinweis zur Spezifikation
Die Funktionsweise nennt „Platzieren: <Objekt> (Esc beendet)“ in Pill/Hinweis. Dieser Entwurf teilt es auf: Pill kurz („Platzieren: Angreifer“), Hinweis mit Bedienung und je nach Gerät mit oder ohne Esc. Bitte so übernehmen.

## Testbericht (Tester, Z6)

Stand nach Fix-Schleife (Geister-Platzieren behoben), Diff auf Branch feature/zeichenboard-z6. Alles unten "im Browser ausgeführt" (Playwright, lokal, TESTUMGEBUNG), sofern nicht "im Code geprüft" steht.

### Läufe
- `node scripts/check-js.mjs`: OK.
- `npx playwright test`: 26 von 26 bestanden (nur der Z1-Test ist mit `test.fail()` markiert und läuft als "erwartet fehlgeschlagen"). In `zeichenboard-z6.spec.js` gibt es kein `test.fail()` mehr. Ein früherer Lauf zeigte einmalig 1 Fehlschlag (`toHaveClass`, Touch-Kontext, nicht zuzuordnen); nicht reproduzierbar. Beobachten.
- Z6-Tests `--repeat-each=3`: 66 von 66 bestanden (nach den Hinweis-Fixes).

### Akzeptanzkriterien
| Nr | Ergebnis | Beleg |
|---|---|---|
| 1 | erfüllt (Browser) | Test "3 Taps ...", Abweichung <= 1 Prozentpunkt; `placeAtPointer` rechnet aus `#playerLayer`-Rechteck |
| 2 | erfüllt (Browser) | gleicher Test, 3 Objekte, Button bleibt `on` |
| 3 | erfüllt (Browser) | Test "Beenden per Button, Werkzeugwechsel und Esc": Button, `#tool-line`, anderes Objekt, Laufweg, Esc; danach Tap setzt nichts |
| 4 | erfüllt (Browser) | `on`, `aria-pressed`, Pill "Platzieren: Angreifer", Hinweis; nach Beenden Pill "Zeichnen". Hinweistext-Wiederherstellung nur im Code geprüft (`setMovementMode`) |
| 5 | erfüllt (Browser) | Pfeil ziehen nach Beenden: `paths` = 1; beim Platzier-Tap `paths` = 0 |
| 6 | erfüllt (Browser) | Test "Verschieben im Platzier-Modus": Objekt wandert, Anzahl unverändert, Modus bleibt aktiv |
| 7 | erfüllt (Browser, Beenden) / Wege ziehen nur im Code geprüft | `#btn-run-mode` beendet Platzieren; `setMovementMode` ruft `stopPlacing` |
| 8 | erfüllt (Browser) | Maus 1280x800 und Touch 820x1180 (`touchscreen.tap`) |
| 9 | erfüllt (Browser) | Test "Positionen nach Speichern und Öffnen identisch": DB-Zeile und geöffnete Taktik, Toleranz 0,1 (5 Objekttypen) |
| 10 | nur im Code geprüft | `addPlayer(type,pos)` liest `#playerNameInput` und leert es; kein Test |
| 11 | erfüllt (Browser) | Button-Klick allein: 0 Objekte |
| 12 | erfüllt | Sicherheitsnetz grün (Z1-Folgefehler bleibt wie bekannt), check-js OK |

Zusätzlich im Browser bestätigt: Torwart, Hütchen (ohne Ketten-Zufall), Stange, Ball, Pylone setzen an der Tap-Position; Gruppe (Dialog, ein Tap, Modus endet danach, zweiter Tap setzt nichts); Vorlage "Passviereck" (`placeEntityAt`) unverändert, wiederholt gleiche Positionen.

### Mängel
- **Behoben: Geister-Platzieren nach Öffnen einer gespeicherten Taktik** (war Wichtig). Ursache: `showView` beendete den Platzier-Modus nicht. Fix: `showView` ruft am Anfang `if(placeType)setMovementMode(null)` auf (deckt `openSavedEx` sowie Board verlassen und wieder betreten ab). Tests: "Öffnen einer gespeicherten Taktik im Platzier-Modus: kein Geister-Platzieren" und "Board verlassen und wieder betreten" (Maus und Touch, regulär grün).
- **Umgesetzt (Hinweise aus dem Review):** Im Platzier-Zweig von `bDown` setzen nur primäre Eingaben (`e.button===0 && e.isPrimary`); Rechts-/Mittelklick und zweiter Finger setzen nichts (Test "Rechtsklick setzt kein Objekt"). `openGroupDialog` beendet einen aktiven anderen Platzier-Modus beim Öffnen.
- **Hinweis:** Auf 390x844 ist das Feld nur ca. 43x56 px groß (Z8 bekannt). Platzieren funktioniert dort trotzdem (Tap Feldmitte = 50/50, kein JS-Fehler), keine Regression durch Z6.
- **Hinweis:** `#btn-add-group` bekommt `on` erst nach "Platzieren" im Dialog (während des Dialogs nicht), `aria-pressed` ist beim Gruppenbutton nur im Platziermodus "true". Passt zur Spec.

### Manuelle Testschritte für Jakob
1. Zeichenboard öffnen, "Angreifer" wählen, 5 Mal aufs Feld klicken: Spieler stehen genau unter dem Cursor, Pill/Hinweis zeigen "Platzieren: Angreifer". Esc: Modus endet.
2. Name ins Namensfeld eintippen, ersten Spieler setzen: trägt den Namen, Feld leer. Esc im Namensfeld: Modus bleibt.
3. Auf echtem Tablet/Handy: Objekt wählen, tippen, Hinweis nennt keinen Esc. Prüfen, ob Tippen nicht scrollt und das Feld auf dem Handy brauchbar ist (Z8).
4. Gruppe: Dialog, "Platzieren", ein Tap; Hütchen mehrfach, Abstände ein-/ausblenden.
5. Gegenprobe: Objekt-Button aktivieren, über Dashboard eine gespeicherte Übung öffnen, aufs Feld klicken: es entsteht kein Objekt, der Button ist nicht mehr aktiv.
