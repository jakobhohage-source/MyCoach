# Zeichenboard Z3: Easing für Läufe und Pässe

Status: umgesetzt, getestet, Sichtprüfung durch Jakob erledigt (Branch `feature/zeichenboard-z3`)

Manuelle Tests: ERLEDIGT am 20.10.2026
Quelle: Analyse Zeichenboard, Punkt Z3.

## Problem

Spieler und Ball bewegen sich mit konstanter Geschwindigkeit und starten und stoppen abrupt. Das lässt Spielzüge starr und statisch wirken. Trainer wollen Abläufe zeigen, die natürlich aussehen.

## Was es tut

Beim Abspielen beschleunigen Läufe am Anfang und bremsen am Ende. Pässe (Ball) laufen sanft aus. Dauer, Start- und Endpunkt jeder Bewegung bleiben unverändert, nur der zeitliche Verlauf entlang des Wegs ändert sich.

## Wer es nutzt

Trainer beim Abspielen einer Phase, der Gesamtsequenz und beim Video-Export im Zeichenboard.

## Funktionsweise

- Eine kleine Easing-Funktion bildet den Zeitanteil (0..1) auf den Weganteil (0..1) ab. Sie wird VOR `pointAlong` angewendet; `pointAlong` selbst bleibt unverändert (Z4 ändert es später).
- Läufe (`type==='run'`): Ease-in-out (z. B. Sinus oder Cubic), Anfang und Ende mit Geschwindigkeit nahe 0.
- Pässe (`type==='ballpath'`): eigene Kurve, die sanft ausläuft (Ease-out). Der Ball startet bewusst zügig (Schuss), er bremst nur am Ende.
- Ballannahme (`stopFrac`): Statt einer Umkehrfunktion wird die Kurve auf den gekürzten Weg gelegt (siehe Umsetzung). Der Abfangzeitpunkt bleibt dadurch wie im linearen Modell.

Ansatzpunkte in `index.html` (Stand dieses Branches):

| Zeile | Stelle | Änderung |
|---|---|---|
| ca. 5350 | neue Hilfsfunktionen vor/neben `pointAlong` | `easeInOutSine`, `easeOutQuad`, `moveEase` |
| 5503-5504 | `entityPosAt`: `p=(t-m.gStart)/m.dur` | Fortschritt durch Easing schicken, dann `Math.min(p,cap)` |
| 5523-5524 | `drawGlobalFrame`, Spur: `prog` | gleiches Easing, damit die Spur an der Figur endet |
| 5525 | `over` (Nachleuchten ab Abfangpunkt) | bleibt `m.dur*cap`, siehe Umsetzung |
| 5449 | `effEnd` | bleibt `m.dur*stopFrac`, siehe Umsetzung |
| 5477 | `tR=R.gStart+c.frac*R.dur` (Wann erreicht der Läufer den Abfangpunkt) | bleibt linear (`c.frac*R.dur`), siehe Umsetzung |
| 5594-5595 | `pbTick` (Einzelphase): `t` und `showPts` | Easing auf `t`; Figur und Spur nutzen denselben Wert. Position war `pts[showPts-1]` (stufig), jetzt `pointAlong` |

Nicht ändern: `exportVideo` (5943) und `seqTick` (5658) rufen `drawGlobalFrame` auf und erben das Easing automatisch. Nur `pbTick` hat eine eigene Kopie der Logik.

## Funktionsweise (Umsetzung)

Entscheidungen (Annahmen, Jakob kann nachsteuern):
- Läufe: easeInOutSine, `0.5-0.5*cos(pi*u)`.
- Ball/Pässe: easeOutQuad, `1-(1-u)^2`. Startgeschwindigkeit 2x Durchschnitt, Ende 0.
- Stärke an einer Stelle änderbar: die Funktionen `easeInOutSine`, `easeOutQuad` vor `pointAlong`; Auswahl je Typ in `moveEase`.
- Ballannahme (Annahme, Jakob kann nachsteuern): Ein Läufer mit Abfangpunkt `s=stopFrac<1` läuft Weg `s*easeInOutSine(u/s)`. Er erreicht den Abfangpunkt bei Zeitanteil `u=s` (wie vorher linear) und bremst dort sanft auf 0, statt bei Höchsttempo abrupt zu stoppen. Grund: Eine bloße Kappung (`min(p,s)`) der Sinuskurve würde bei `s` nahe 0,5 mit maximaler Geschwindigkeit anhalten.

Umsetzung in `index.html`:
- `moveEase(m,u)` (Hilfsfunktion neben `pointAlong`), enthält die Behandlung von `stopFrac`.
- `entityPosAt`: Zeitanteil wird geklammert (0..1), eased (`moveEase` hält selbst am Abfangpunkt).
- `buildGlobalTimeline`: `stopFrac` bleibt ein Wegteil, `effEnd` und `tR` bleiben unverändert (Abfangzeitpunkt `gStart+stopFrac*dur`). `total` und die Empfänger-Zuordnung (`RECV_TIME_TOL`) bleiben damit auch mit Ballannahme unverändert.
- `drawGlobalFrame`: Spur-`prog` eased, Nachleuchten (`over`) ab `m.dur*cap` wie bisher.
- `pbTick`: gleiches Easing; die Figur steht jetzt exakt auf `pointAlong` (nicht mehr stufig auf Stützpunkten), die Spur endet an dieser Position. Damit stimmen Einzelphase und Sequenz überein.
- `seqTick` und Video-Export erben das Easing über `drawGlobalFrame`.

Bekannt: Die Spur in `drawGlobalFrame` endet weiter am letzten ganzen Stützpunkt (stufig, `Math.floor(prog*pts.length)`), nicht exakt an der Figur. Das war vorher schon so und gehört zu Z4/Z21.

Tests: `tests/e2e/zeichenboard-z3.spec.js` (Kriterien 1 bis 7 und 9 über `buildGlobalTimeline`/`entityPosAt`, `pbTick` manuell getrieben) und `tests/e2e/zeichenboard-z3-ui.spec.js` (echte Bedienung, Export-Smoke, Bildfolge).

## Datenbankbezug

Keiner. Es wird nichts gespeichert, `board_data` bleibt unverändert, bestehende Taktiken bekommen das Easing automatisch. Verhaltensänderung für bestehende Taktiken: Bewegungen laufen anders (Anlaufen/Abbremsen). Mit Ballannahme erreicht der Empfänger den Abfangpunkt zur selben Zeit wie vorher, ist aber unterwegs langsamer am Anfang und schneller in der Mitte; Abstände Ball-Läufer zwischen Start und Treffpunkt ändern sich.

## Verbundene Features

- Z4 (Bogenlänge, gleichmäßige Wege): ergänzt Z3, bewusst getrennt.
- Z13 (Tempo in m/s), Z18 (Start-Versatz): nicht Teil von Z3.
- Z15 (lebendigere Animation): setzt auf Z3 auf.
- Z21 (gemeinsamer Player für `pbTick` und `seqTick`): macht die zweite Stelle in `pbTick` später überflüssig.
- Ballannahme/Abfangpunkt (`stopFrac`, `closestOnPolyline`).

## Akzeptanzkriterien

1. Ein Lauf hat in den ersten und letzten 10 % seiner Dauer eine deutlich kleinere Geschwindigkeit als in der Mitte (gemessen als Strecke pro Zeitschritt, Mitte mindestens doppelt so hoch wie an den Enden).
2. Nach 25 % der Dauer hat ein Lauf weniger als 25 % seines Wegs zurückgelegt; nach 75 % mehr als 75 %. Bei 50 % liegt er in der Wegmitte (Toleranz 2 %).
3. Ein Pass (Ball) hat am Ende eine Geschwindigkeit nahe 0 und ist über seinen Verlauf am Anfang am schnellsten. Seine Kurve unterscheidet sich messbar von der des Laufs (z. B. nach 25 % der Dauer mehr als 25 % des Wegs).
4. Die Gesamtdauer jeder Bewegung und der Sequenz (`total`) ist unverändert gegenüber vorher (Toleranz 0,05 s) für Taktiken ohne Ballannahme. Mit Ballannahme ist die Dauer so wie vorher berechnet (Abfangzeitpunkt linear).
5. Start- und Endposition bleiben exakt (Toleranz 1 px): bei t=0 am Wegstart, bei t=Dauer am Wegende; Phase 2 startet an der richtigen Stelle.
6. Ballannahme bleibt korrekt: Trifft ein Pass auf einen Läufer, ist der Abstand zwischen Ball und Läufer zum Zeitpunkt des Passendes höchstens so groß wie vor der Änderung (Toleranz 5 px). Der Läufer bleibt am Abfangpunkt stehen und läuft nicht darüber hinaus.
7. Einzelphase (`pbTick`), Gesamtsequenz (`seqTick`) und Video-Export zeigen zu gleichen Zeitpunkten dasselbe Easing (Positionen von Sequenz und Einzelphase bei einer Ein-Phasen-Taktik stimmen überein).
8. Die Spur (gestrichelte Linie) endet an der Figur, nicht davor oder dahinter.
9. Keine Konsolenfehler beim Anlegen, Abspielen, Pausieren, Stoppen und Exportieren.
10. `node scripts/check-js.mjs` ist grün, das Sicherheitsnetz (4 Spieler, 2 Pfeile) bleibt grün.

## Edge Cases

- Sehr kurze Bewegungen (Dauer am Minimum 0,2 s in der Sequenz bzw. 0,8 s im Planer): Easing darf nicht zu NaN, Sprung oder Rückwärtslauf führen.
- Bewegung mit genau 2 Punkten: Position bleibt auf der Strecke, Endpunkt exakt.
- Bewegung mit weniger als 2 Punkten wird wie bisher übersprungen.
- Mehrere gleichzeitige Bewegungen (Läufer und Ball, mehrere Läufer): jede wird einzeln eased, Reihenfolge und Startzeiten ändern sich nicht.
- Mehrere Bewegungen derselben Figur nacheinander: Übergang ohne Sprung, die später gestartete gewinnt wie bisher. Hinweis: Figur bremst am Ende der ersten Bewegung bewusst ab, das ist gewollt.
- Pause/Fortsetzen: Easing hängt nur an der Abspielzeit, nach Fortsetzen keine Sprünge.
- Abspielgeschwindigkeit (`pbSpeed`): Easing skaliert mit, Form unverändert.
- Scrubbing (`pbSeek`): Positionen hängen nur an der Zeit, Springen ergibt dieselbe Position wie durchlaufen. In `pbSeek` wird bei laufender Wiedergabe aktuell nichts neu gezeichnet; das bleibt unverändert.
- Bewegung am Abfangpunkt (`stopFrac` < 1): Läufer wird auf den Wegteil begrenzt, Easing darf ihn nicht verfrüht oder verspätet anhalten.
- Video-Export: läuft in Echtzeit mit 30 fps, Dauer des Videos bleibt gleich.

## Abgrenzung (bewusst nicht enthalten)

- Keine Interpolation nach Bogenlänge, keine zusätzlichen Stützstellen (Z4).
- Kein Lauftempo in m/s, keine Mindestdauer-Änderung (Z13).
- Kein Start-Versatz je Bewegung (Z18), keine Änderung am Sequenzieren (`computeSequencingFor`, Taktgeber).
- Keine Blickrichtung, kein Ballbogen, keine Ballrotation (Z15).
- Kein Zusammenführen von `pbTick` und `seqTick` (Z21).
- Keine Einstellung durch den Trainer (Easing an/aus); es gilt immer.
- Keine Änderung am Editor (Zeichnen, statische Darstellung).

## Testvorschlag (Playwright)

Fall A, Lauf: Taktik mit einem Lauf (einfache Gerade, z. B. 400 px) bauen. Per `page.evaluate` die Interpolation direkt abfragen, statt auf Frames zu warten: `buildGlobalTimeline()` und `entityPosAt(tl,id,t,pr,cp)` zu festen Zeitpunkten aufrufen (0, 10 %, 25 %, 50 %, 75 %, 90 %, 100 % der Dauer). Prüfen: Weganteil bei 25 % kleiner 25 %, bei 75 % größer 75 %, Mitte bei 50 %, Endpunkt gleich Wegende (1 px), Schrittweiten in der Mitte mindestens doppelt so groß wie an den Enden.

Fall B, Pass: Lauf plus Ballweg, dessen Ziel auf dem Laufweg liegt. Ball und Läufer zum Zeitpunkt `gStart+dur` des Balls lesen; Abstand höchstens 5 px mehr als vor der Änderung (Referenzwert einmalig auf dem Hauptbranch messen und im Test festhalten). `tl.total` mit Referenz vergleichen.

Fall C, Gleichheit der Engines: Eine Ein-Phasen-Taktik per `playFullSequence` und per `pbPlay` abspielen, mit `page.clock` (install, `runFor`/`fastForward`) auf 25/50/75 % stellen und Figurposition über die Canvas-Pixel oder einen Hook lesen; Abweichung innerhalb der dokumentierten Toleranz.

Fall D, Video-Export: Nur Smoke-Test (kein Konsolenfehler, Download startet), da `drawGlobalFrame` geteilt wird.

Fall E, Stabilität: Console-Listener auf `pageerror` und `console.error` während A bis D; Grundablauf-Test (Sicherheitsnetz) vorher und nachher. Manuelle Sichtprüfung mit Jakob („wirkt flüssiger?").

## Offene Fragen an Jakob

- Soll der Ball am Anfang eines Passes schnell starten (Schuss, Ease-out) oder ebenfalls weich anlaufen (Ease-in-out)? Vorschlag: Ease-out.
- Wie stark darf das Easing wirken (sanft wie Sinus oder deutlich wie Cubic)? Vorschlag: sanft, per Sichtprüfung nachjustieren.

## Testbericht

Stand: Test durch den Tester-Agent, Branch `feature/zeichenboard-z3`, uncommitteter Diff. Alles als "Browser" Gekennzeichnete lief lokal gegen `mycoach-dev` (Sicherheitsprüfung TESTUMGEBUNG aktiv). Kein Anwendungscode geändert.

### Ausgeführt

- `node scripts/check-js.mjs`: OK.
- `npx playwright test` (15 Tests, davon 1 übersprungen = Bildfolge ohne `Z3_FRAMES_DIR`): 14 bestanden. Der bekannte Fehler Z1 (`zeichenboard.spec.js` "Taktik direkt nach Reload öffnen") schlägt wie erwartet fehl (mit `test.fail` markiert, daher Lauf grün). Smoke, XSS und Zeichenboard-Grundablauf (Sicherheitsnetz) grün.
- Z3-Tests `zeichenboard-z3.spec.js` mit `--repeat-each=5` (30 Läufe): 29 bestanden, 1 Fehlschlag im ersten Durchgang (Test "Lauf: sanftes Anlaufen", Wiederholung 3, Meldung nicht erfasst). In weiteren Serien nicht mehr reproduzierbar (15 + 30 + 48 Läufe, alle grün). Vermutlich Umgebung (Login/Netz zu Supabase), als Hinweis geführt.
- Neue Tests `tests/e2e/zeichenboard-z3-ui.spec.js` (echte Bedienung: Figuren setzen, Wege per Maus ziehen, Play/Pause/Rewind, Phase per "+"), 4 Tests, mit 3 Wiederholungen alle grün:
  - Lauf per UI: läuft durch, endet (Button springt zurück auf Play), Pause friert `pbTime` ein, Fortsetzen, Rewind, erneut abspielen, Gesamtsequenz starten, stoppen, erneut bis Ende.
  - 2 Läufer + Ball gleichzeitig, danach Phase 2 mit weiterem Lauf, Sequenz bis Ende.
  - Sehr kurze Bewegung (kleine Distanz, Mindestdauer, 51 Punkte durch UI): kein NaN, monoton, Endpunkt innerhalb 1 px.
  - Video-Export: startet, löst Download aus, keine Konsolenfehler.
  - Bildfolge (nur mit `Z3_FRAMES_DIR`, sonst übersprungen).

### Akzeptanzkriterien

| Nr | Ergebnis | Beleg |
|---|---|---|
| 1 | erfüllt (Browser) | z3-Test "Lauf": Schrittweite Mitte mehr als doppelt so groß wie Start und Ende |
| 2 | erfüllt (Browser) | 25 % unter 25 %, 50 % in der Mitte, 75 % über 75 % |
| 3 | erfüllt (Browser) | Pass nach 25 % über 30 % des Wegs (rechnerisch 43,75 %), Start schneller als Mitte, Ende unter 1/10 der Startgeschwindigkeit |
| 4 | erfüllt (Browser) | Dauer 4 s, `total` 5,1 s; Ballannahme-Fall `total` 3,6 s wie vorher berechnet |
| 5 | erfüllt (Browser) | Start 0, Ende exakt (1 px); Mehrpunkt- und 2-Punkt-Fall; Phase 2 per UI angelegt, im Code `addBoardPhase` übernimmt Endpositionen |
| 6 | erfüllt (Browser) | Läufer hält bei x=300, Abstand Ball/Läufer höchstens 15 px (10 px Versatz im Test plus 5 px Toleranz) |
| 7 | erfüllt (Browser) für Einzelphase gegen Sequenz bei 25/50/75 % (unter 1 px); Export im Code geprüft | `exportVideo` ruft `drawGlobalFrame` auf, also dasselbe Easing. Export-Inhalt nicht geprüft |
| 8 | nur näherungsweise erfüllt (im Code geprüft, nicht gemessen) | Sequenz/Export: Spur endet am letzten ganzen Stützpunkt (51 Punkte, Rückstand rund 2 bis 4 % des Wegs, wenige Pixel); am Start ragt wegen "mindestens 2 Punkte" ein kurzes Stück voraus. Einzelphase: Spur endet exakt an der Figur. Bekannte Lücke (Z4/Z21) |
| 9 | erfüllt (Browser) | alle Tests prüfen mit `expectNoProblems`, inkl. Pause, Stop, Rewind, Export |
| 10 | erfüllt | check-js grün, Sicherheitsnetz grün |

### Edge Cases

- Kurze Bewegung, 2 Punkte, gleichzeitige Bewegungen, Pause/Fortsetzen, mehrere Phasen: Browser, grün.
- Abspielgeschwindigkeit `pbSpeed` und `pbSeek`: nur im Code geprüft (Easing hängt allein an `pbTime`/`seqElapsed`).
- `moveEase` klammert auf 0..1 und schützt `stopFrac=0` (keine Division durch 0).
- Nicht eingeloggt/Supabase-Fehler: von Z3 nicht berührt (keine Datenzugriffe).
- Mobile-Ansicht: nicht getestet (Z3 ändert nur die Zeitkurve, keine Layout-Teile).

### Video-Export

Im Code: `exportVideo` nutzt `buildGlobalTimeline` und `drawGlobalFrame`, also dasselbe Easing. Im Browser: Export startet, endet, löst einen Download aus, keine Fehler. Videoinhalt (Bildqualität, Echtzeitlänge) nicht geprüft.

### Sichtprüfung (Material)

11 Frames (0,0 bis 4,0 s in 0,4-s-Schritten), Lauf (gelb) und Pass (grün), je 4 s, im Testlauf über `pbTick` auf feste Zeiten gestellt:
(Bilddateien lagen im Arbeitsverzeichnis des Testers und sind nicht Teil des Repos.)
Beobachtung (zwei Frames angesehen, übrige rechnerisch): Der Läufer ist bei 0,8 s erst rund 10 % des Wegs unterwegs (langsames Anlaufen), der Ball schon rund 36 % (zügiger Start). Bei 3,6 s sind beide fast am Ziel, der Ball bremst deutlich. Die Kurven sind sichtbar verschieden.

### Mängel

- Blocker: keine.
- Wichtig: keine.
- Hinweis 1: Spur in `drawGlobalFrame` endet stufig (Kriterium 8 nur näherungsweise), bekannt, Z4/Z21.
- Hinweis 2: Der Ball startet mit doppelter Durchschnittsgeschwindigkeit. Bei sehr kurzen Pässen (Mindestdauer 0,3 s) kann der Start abrupt wirken. Kurvenstärke ist eine Annahme, per Sichtprüfung entscheiden.
- Hinweis 3: Einmaliger, nicht reproduzierbarer Fehlschlag des Lauf-Tests im ersten Repeat-Durchgang.
- Hinweis 4: Die Z3-Tests in `zeichenboard-z3.spec.js` legen Bewegungen direkt über `movements` an; die Bedienung per Maus deckt `zeichenboard-z3-ui.spec.js` ab.

### Manuelle Testschritte für Jakob

1. Zeichenboard öffnen, Angreifer setzen, Laufweg ziehen, Play: Läufer soll langsam anlaufen und am Ende bremsen.
2. Ball setzen, Pass ziehen, Play: Ball soll zügig starten und sanft auslaufen. Wirkt der Start zu abrupt, Kurve anpassen (`easeOutQuad`).
3. Pass auf einen laufenden Spieler: Spieler und Ball treffen sich am Annahmepunkt, der Spieler bleibt dort stehen.
4. Zweite Phase anlegen, Gesamtsequenz abspielen (Button rechts neben Play): Übergang ohne Sprung.
5. Mit 0,5x, 1x, 2x abspielen, mittendrin pausieren und fortsetzen.
6. Video exportieren (Speichern-Dialog), Datei öffnen: Bewegung wie im Board, Länge passt? Nicht automatisch geprüft.
7. Handy oder schmales Fenster: Abspielen kurz ansehen.
