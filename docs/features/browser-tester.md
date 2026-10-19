# Browser-Tester

**Status:** Umgesetzt auf Branch feature/browser-tester.

## Was es tut
Automatische Browser-Tests mit Playwright (Chromium). Sie bedienen die App wie ein Trainer: einloggen, Beiträge, Kommentare, Testspiel-Anfragen und Taktiken anlegen und wieder löschen. Dabei prüfen sie, dass keine Dialoge aufgehen und keine Fehler in der Konsole stehen.

## Wer es nutzt
Der `tester`-Agent nach jeder Umsetzung und `/ship` vor jedem Merge. Jakob kann die Tests jederzeit selbst mit `npx playwright test` starten.

## Funktionsweise
- `package.json` enthält nur die Entwicklungsabhängigkeit `@playwright/test`. Die App selbst bleibt ohne Build-Schritt.
- `playwright.config.js` im Projektordner verweist auf `tests/e2e/playwright.config.js`. Diese Konfiguration:
  - lädt `TEST_EMAIL` und `TEST_PASSWORD` aus `tests/e2e/.account.local`, ohne sie auszugeben;
  - startet bei Bedarf `python3 -m http.server 8000` oder nutzt einen schon laufenden Server;
  - führt die Tests nacheinander aus (ein gemeinsames Testkonto), mit Screenshot bei Fehlern und ohne Trace, weil ein Trace das Passwort im Klartext speichern würde.
- `tests/e2e/helpers.js`:
  - `openTestEnv` bricht ab, wenn der Host nicht `localhost`/`127.0.0.1` ist oder der Hinweis „TESTUMGEBUNG“ fehlt.
  - `watchPage` sammelt Dialoge, Konsolen- und Seitenfehler. Nur die erwarteten Lösch-Bestätigungen werden akzeptiert.
  - `login`, `openCommunityTab`, `makeMarker` und `cleanupByMarker` (löscht alle Einträge des Testkontos mit dem Marker).
- `tests/e2e/smoke.spec.js`: Login. Danach wird ein Beitrag geschrieben, und der Autor muss „Test Trainer · Testverein“ zeigen. Dann wird kommentiert, Kommentar und Beitrag werden gelöscht, eine Taktik wird gespeichert und wieder gelöscht, auch in der Datenbank. Am Ende dürfen weder ein Dialog noch ein Konsolenfehler aufgetreten sein.
- `tests/e2e/xss.spec.js`: Regressionstest zu `fix/xss-inline-handler`.
  - Der Test setzt den Profilnamen `"><img src=x onerror=alert(1)>` und den Verein `x');alert(2);//`.
  - Dann legt er einen Beitrag an, klappt die Kommentare auf, kommentiert und legt eine Testspiel-Anfrage an.
  - Danach klickt er „Kontakt aufnehmen“. Der Text muss unverändert erscheinen, es darf kein Dialog aufgehen.
  - Zum Schluss werden die Testdaten gelöscht und das Profil zurückgesetzt, auch wenn der Test fehlschlägt.
  - Einschränkung: Es gibt nur ein Testkonto. Deshalb wird für „Kontakt aufnehmen“ die eigene Nutzer-ID im Browser kurz durch eine fremde ersetzt, damit die App den Button zeigt. Eine Nachricht wird nicht gesendet.

## Datenbankbezug
Keine Schemaänderung. Die Tests schreiben und löschen echte Zeilen in `community_posts`, `post_comments`, `friendly_requests` und `tactics` des Testprojekts `mycoach-dev`, nur für das Testkonto und nur mit Marker `E2E-…`. Der XSS-Test ändert vorübergehend `user_metadata` des Testkontos. Voraussetzung: `mycoach-dev` hat dasselbe Schema, dieselben Policies und die Migration `202610191500` (Namen serverseitig). Sonst schlägt die Prüfung auf „Test Trainer · Testverein“ fehl.

## Verbundene Features
Testumgebung (`docs/features/testumgebung.md`), Namen serverseitig setzen, XSS-Fix, `/ship`, `tester`-Agent.
