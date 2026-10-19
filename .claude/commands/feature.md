---
description: Neues MyCoach-Feature durch die komplette Factory führen (PO → UX → DB → Entwickler → Tester → Reviewer)
argument-hint: <Beschreibung des Features>
---

Setze dieses Feature mit der Agentic Factory um: $ARGUMENTS

Ablauf (du koordinierst, du schreibst den Code nicht selbst):

1. Lege einen Git-Branch `feature/<kurzer-name>` an.
2. Agent `product-owner`: Spezifikation erstellen. Gibt es offene Fragen, die den Umfang stark verändern, stoppe und frage Jakob, bevor du weitermachst.
3. Agent `ux-designer`: UX-Entwurf ergänzen (überspringen, wenn das Feature keine Oberfläche hat).
4. Agent `db-architect`: Migration und RLS-Policies entwerfen (überspringen, wenn keine Datenbankänderung nötig ist). Zeige Jakob die Migration und warte auf Freigabe, bevor der Entwickler damit arbeitet.
5. Agent `developer`: umsetzen.
6. Agent `tester`: prüfen. Bei Mängeln der Stufe Blocker oder Wichtig zurück an `developer`, danach erneut `tester` (maximal 2 Schleifen, danach an Jakob eskalieren).
7. Agent `reviewer`: Review. Blocker zurück an `developer`.
8. Committe die Arbeit auf dem Branch (kleine, sprechende Commits). Nicht pushen.

Abschluss: Kurze Zusammenfassung für Jakob mit (a) was gebaut wurde, (b) was er manuell prüfen soll, (c) was er freigeben oder entscheiden muss (Migration anwenden, Push/Merge).
