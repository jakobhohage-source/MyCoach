# Testumgebung

**Status:** Umgesetzt auf Branch feature/testumgebung.

Manuelle Tests: ERLEDIGT am 19.10.2026

## Was es tut
Läuft die App lokal (`localhost` oder `127.0.0.1`), verbindet sie sich mit dem Supabase-Testprojekt `mycoach-dev` statt mit dem Live-Projekt und zeigt oben einen roten Hinweis „TESTUMGEBUNG“.

## Wer es nutzt
Jakob und die Agenten der Factory beim lokalen Testen, damit keine Testdaten in der Live-Datenbank landen.

## Funktionsweise
- `index.html`, Abschnitt „SUPABASE CONFIG“: `IS_TEST_ENV` prüft `location.hostname`. Davon hängen `SUPABASE_URL` und `SUPABASE_KEY` ab.
- Bei `IS_TEST_ENV` wird ein `div#testEnvBadge` an `body` gehängt. Das Styling steht am Ende des Haupt-Stylesheets: fest oben mittig, `var(--red)`, `pointer-events: none`.
- Alle anderen Hostnamen, auch GitHub Pages, nutzen unverändert die Live-Konfiguration.

## Datenbankbezug
Keine Schemaänderung. Live: `qnjebmbvkzssxaunzllm`, Test: `mycoach-dev` (`hqwmihjaoaptosjgnijy`). Beide Keys sind öffentliche Client-Keys, die Sicherheit hängt an RLS. `mycoach-dev` braucht dasselbe Schema, dieselben Policies und dieselben Migrationen wie das Live-Projekt. Migrationen werden dort zuerst angewendet (CLAUDE.md, Regel 6).

## Verbundene Features
Alle Features mit Datenbankzugriff (Community, Nachrichten, Testspielbörse, Planer, Zeichenboard); `/ship` und der Migrations-Workflow.
