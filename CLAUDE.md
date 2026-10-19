# MyCoach – Projektkontext für die Agentic Factory

MyCoach ist eine Web-App für Fußballtrainer (Trainingsplaner, Zeichenboard, Testspielbörse, Spieltagsplaner, Community, Nachrichten, Übungsbibliothek).
Live: https://jakobhohage-source.github.io/MyCoach/ (GitHub Pages)
Product Owner: Jakob. Jede Entscheidung mit Produktwirkung geht über ihn.

## Tech-Stack und Struktur (Stand: Repo-Analyse)

- `index.html` – die komplette App in einer Datei (~6.650 Zeilen): CSS (Zeile ~11–1316), HTML-Views (ab ~1461), App-JS (ab ~2441 und ~4926).
- `zeichenboard-test.html` – gebündelte Testseite für das Zeichenboard, nicht Teil der Produktivlogik.
- Vanilla JavaScript, kein Build-Schritt, kein Framework. Supabase-JS per CDN (`window.sb` ist der Client).
- Backend: Supabase (Auth + Postgres). Hosting: GitHub Pages (Deploy = Push auf den Hauptbranch).
- Zwei Supabase-Projekte: Live (`qnjebmbvkzssxaunzllm`) und Test `mycoach-dev` (`hqwmihjaoaptosjgnijy`). `index.html` wählt per Hostname: auf `localhost`/`127.0.0.1` (z. B. `python3 -m http.server 8000`) läuft die App gegen `mycoach-dev` und zeigt oben den Hinweis „TESTUMGEBUNG“, sonst gegen Live. Lokale Tests laufen deshalb ab jetzt gegen `mycoach-dev`, nie gegen Live-Daten.
- Views sind `<div id="view-NAME" class="view">`; Navigation läuft über `showView(name)`. Aktuelle Views: home, bibliothek, planer, board, community, spieltag. Mobile-Bottom-Nav (`setMobileNav`) immer mitdenken.
- Eingeloggter Nutzer: globale Variable `currentUser`.

## Datenbank (Supabase)

Tabellen: `training_plans`, `tactics`, `community_posts`, `post_comments`, `friendly_requests`, `messages`.
Auth: E-Mail/Passwort, Profilfelder (Name, Rolle, Verein, PLZ) in `user_metadata`.
Der Supabase-Key im Client ist ein öffentlicher Key. Die Sicherheit hängt deshalb komplett an Row Level Security (RLS). RLS ist der wichtigste offene Punkt für die Produktionsreife.

## Design

- Quelle der Wahrheit sind die CSS-Variablen am Anfang von `index.html` (`--accent`, `--border`, `--radius`, …).
- Designabsicht: minimal, Schwarz/Weiß als Basis, Akzentfarbe sparsam, Cards mit 1px-Border statt Schatten, Lucide-Icons (Outline, stroke-width 1.75), Sektions-Labels in Großbuchstaben.
- Wenn Code und Styleguide (Skill `mycoach-architect`) sich widersprechen, nicht raten: als Frage an Jakob melden.

## Regeln für alle Agenten

1. Erst lesen, dann ändern. Bestehende Muster (Funktionsnamen, Fehlerbehandlung mit `{data,error}`, CSS-Klassen) übernehmen.
2. Kleine, abgeschlossene Änderungen. Kein Refactoring „nebenbei“.
3. Nur EIN Agent bearbeitet `index.html` zur selben Zeit. Parallelarbeit nur über getrennte Git-Worktrees und getrennte Dateien.
4. Vor jeder Übergabe: `node scripts/check-js.mjs` ausführen (Syntax-Check der Inline-Skripte). Ein Fehler stoppt die Übergabe.
5. Nie Secrets, Passwörter oder Service-Role-Keys in Code, Commits oder Chat schreiben.
6. Datenbankänderungen nur als SQL-Migrationsdatei unter `supabase/migrations/` vorschlagen. Anwenden darf nur Jakob (oder nach seiner ausdrücklichen Freigabe). Migrationen werden immer zuerst im Testprojekt `mycoach-dev` angewendet und geprüft, erst danach live.
7. Kein `git push` und kein Löschen von Daten ohne Freigabe von Jakob.
8. Neue Features dokumentieren unter `docs/features/<name>.md` mit dem Template: Was es tut / Wer es nutzt / Funktionsweise / Datenbankbezug / Verbundene Features.
9. Antworten und Doku auf Deutsch, Code-Bezeichner auf Englisch oder wie im Bestand.
10. Jede Migrationsdatei beginnt mit der Zeile `-- STATUS: ENTWURF` oder `-- STATUS: ANGEWENDET am <Datum>`. Der `db-architect` schreibt immer `ENTWURF`. Sagt Jakob „Migration angewendet“, setzt der Haupt-Agent den Status der betroffenen Datei(en) auf `ANGEWENDET am <Datum>` und committet das.
11. Sagt Jakob, die manuellen Tests eines Features sind erledigt, ergänzt der Haupt-Agent im Feature-Dokument die Zeile `Manuelle Tests: ERLEDIGT am <Datum>` und committet das. `/ship` prüft diese Zeile.
12. Shell- und git-Befehle ohne vorangestelltes `cd` ausführen. Die Sitzung läuft bereits im Projektordner.

## Workflow der Factory

`/feature <Beschreibung>` führt durch: Product Owner → UX-Designer → DB-Architekt (nur bei Datenbankbedarf) → Entwickler → Tester → Reviewer.
`/bugfix <Beschreibung>`: Entwickler → Tester → Reviewer.
`/review`: Reviewer prüft den aktuellen Diff.
`/ship`: prüft den fertigen Branch (sauberer Stand, Syntax-Check, grüner Lauf von `npx playwright test`, manuelle Tests, Migrationen angewendet), merged nach `main` und pusht erst nach Jakobs Ja.

## Browser-Tests (Playwright)

- Tests liegen in `tests/e2e/` (`*.spec.js`, Hilfsfunktionen in `helpers.js`). Ausführen mit `npx playwright test` im Projektordner. Ein lokaler Server auf Port 8000 wird bei Bedarf automatisch gestartet.
- Jeder Test ruft zuerst `openTestEnv` auf: Ist der Hinweis „TESTUMGEBUNG“ nicht sichtbar, bricht er ab. Browser-Tests laufen nie gegen die Live-Seite.
- Zugangsdaten des Testkontos stehen in `tests/e2e/.account.local` (`TEST_EMAIL`, `TEST_PASSWORD`). Die Datei ist in `.gitignore`, wird nie gelesen, ausgegeben oder committet.
- Testdaten tragen einen Marker (`E2E-…`) und werden im `afterEach` gelöscht. Das Testkonto hat im Profil den Namen „Test Trainer“ und den Verein „Testverein“.
- Der `tester` führt die Tests nach jeder Umsetzung aus und ergänzt Tests für neue, browsertestbare Akzeptanzkriterien.
Der Haupt-Agent koordiniert, delegiert über die Subagents in `.claude/agents/` und fasst am Ende kurz zusammen, was gebaut wurde und was Jakob entscheiden oder freigeben muss.
