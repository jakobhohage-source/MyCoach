---
description: Fehler in MyCoach beheben (Entwickler → Tester → Reviewer)
argument-hint: <Fehlerbeschreibung, idealerweise mit Schritten zur Reproduktion>
---

Behebe diesen Fehler mit der Factory: $ARGUMENTS

Ablauf:

1. Lege einen Branch `fix/<kurzer-name>` an.
2. Agent `developer`: Ursache im Code finden (nicht nur Symptom beheben), minimal korrigieren, `node scripts/check-js.mjs` ausführen. Fehlt die Information zur Reproduktion, frage Jakob.
3. Agent `tester`: Prüfen, dass der Fehler behoben ist und angrenzende Funktionen nicht betroffen sind.
4. Agent `reviewer`: Review des Diffs.
5. Committe auf dem Branch, nicht pushen.

Abschluss: Ursache in einem Satz, was geändert wurde, wie Jakob es prüfen kann.
