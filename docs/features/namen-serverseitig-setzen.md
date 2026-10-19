# Namen serverseitig setzen

**Status:** Umgesetzt und live (19.10.2026). Migration 202610191500 angewendet.

Manuelle Tests: ERLEDIGT am 19.10.2026 (App-Test live und Fälschungstest in der Datenbank bestanden)

## Was es tut
Name und Verein bei neuen Beiträgen, Kommentaren, Nachrichten und Testspiel-Anfragen werden nicht mehr dem Browser geglaubt, sondern von der Datenbank aus dem Konto des Einfügenden gesetzt.

## Wer es nutzt
Alle eingeloggten Trainer (indirekt, ohne neue Bedienung). Betreiber (Jakob) als Nutznießer der Konsistenz.

## Problem
Anzeigename und Verein werden beim Anlegen von Beiträgen, Kommentaren, Nachrichten und Testspiel-Anfragen vom Browser mitgeschickt. Die Datenbank prüft nur `user_id` (bzw. `sender_id`), nicht den Namen. Wer die Supabase-API direkt anspricht, kann damit einzelne Einträge unter beliebigem Namen oder Verein anlegen, ohne sein Profil zu ändern.

Betroffene Spalten (in der Datenbank verifiziert):
- `community_posts`: `author_name`, `club_name`
- `post_comments`: `author_name`, `club_name`
- `messages`: `sender_name`, `sender_club`
- `friendly_requests`: `club_name` (außerdem `club_team`, `lat`, `lng`, siehe offene Fragen)

## Ist-Stand im Code – Stand vor Umsetzung (Zeilennummern haben sich verschoben)
Alle vier Tabellen haben genau eine Insert-Stelle. Alle lesen aus `currentUser.user_metadata` (`const meta = currentUser.user_metadata||{}`).

| Tabelle | Funktion (Zeile) | Mitgeschickte Namensfelder | Metadaten-Schlüssel | Fallback |
|---|---|---|---|---|
| `community_posts` | `submitPost` (6365) | `author_name`, `club_name` | `meta.name`, `meta.club.name` | `'Trainer'` / `''` |
| `post_comments` | `submitComment` (6471) | `author_name`, `club_name` | `meta.name`, `meta.club.name` | `'Trainer'` / `''` |
| `messages` | `sendMessage` (6521) | `sender_name`, `sender_club` | `meta.name`, `meta.club.name` | `'Trainer'` / `''` |
| `friendly_requests` | `submitFriendlyRequest` (6222) | `club_name`, `club_team`, `lat`, `lng` | `meta.club.name`, `meta.club.team`, `meta.club.lat`, `meta.club.lng` | kein Fallback: ohne `club.name` bricht die App vorher mit „Bitte zuerst deinen Verein im Profil eintragen.“ ab; `club_team` -> `''`, `lat`/`lng` -> `null` |

Struktur von `user_metadata` (gesetzt bei `signUp` Zeile 2662 und `saveProfilData` Zeile 2586, jeweils `{name, role, club}`):
- `name`: Text, getrimmt, kann leer sein.
- `club`: Objekt oder `null`. Typ `official`: `{type, name, team, address, lat, lng}` (`lat`/`lng` kommen aus Input-Feldern, also als **Text**, oder `null`). Typ `hobby`: `{type, name}` ohne `team`/`lat`/`lng`. Kein Verein: `club = null`.
- Es gibt **keinen** Schlüssel `full_name` im eigenen Profil; `enterApp` (Zeile 2708) nutzt `meta.name || meta.full_name || E-Mail-Präfix || 'Gast'` nur für die Kopfzeilen-Anzeige.

Weitere Befunde:
- **Kein Insert nutzt die zurückgegebene Zeile.** Keiner der vier Inserts hängt `.select()` an und rendert nichts lokal. Nach Erfolg laden `loadPosts`, `loadComments`, `loadFriendlyRequests` per `select('*')` neu. Nachrichten werden nach dem Senden gar nicht neu geladen (nur Toast). Der serverseitig gesetzte Name erscheint daher ohne App-Änderung korrekt.
- **Name wird in der UI nur aus der Datenbank gelesen**, nie aus dem Profil: Anzeige `author_name`/`club_name` (Zeilen 6391, 6420, 6457), `sender_name`/`sender_club` (6565, 6597), `club_name`/`club_team` (6322).
- **Name wird auch zurückverwendet:** `replyToMessage` (6613) und `toggleComments` nutzen gespeicherte Namen als Anzeigetext (Empfängerlabel). Bei `contactFriendly` (6535) kommt der Empfängername aus `friendly_requests.club_name`. Nur Anzeige, wird nicht erneut gespeichert.
- Auffälligkeit außerhalb des Umfangs: `loadSent` (6584) zeigt unter „An:“ den `sender_name`, also den **eigenen** Namen statt des Empfängers. Das ist ein bestehender Fehler, kein Teil dieses Features (siehe Abgrenzung).
- Auffälligkeit außerhalb des Umfangs: `loadPosts` ist doppelt definiert (6379 und 6400, die spätere gilt). Nicht Teil dieses Features.

## Wichtige Einschränkung (bitte vor der Umsetzung lesen)
Die Profildaten liegen in `user_metadata`, und Nutzer können diese Daten mit ihrem eigenen Konto selbst ändern (`sb.auth.updateUser`, Zeile 2586). Ein Trigger, der den Namen aus `user_metadata` übernimmt, verhindert deshalb nur die Fälschung **einzelner Einträge**, nicht dass sich jemand im Profil einen beliebigen Namen gibt. Eine echte Absicherung gegen Namensvortäuschung bräuchte eindeutige Anzeigenamen oder eine Prüfung (Variante B). Der Nutzen von Variante A liegt vor allem in Konsistenz: Name und Verein in einem Eintrag stimmen mit dem Profil überein.

## Varianten
- **Variante A (Vorschlag für den ersten Lauf):** Datenbank-Trigger, der vor dem Einfügen Name und Verein aus dem Konto des Einfügenden setzt und mitgeschickte Werte überschreibt. Keine neue Tabelle, kleine Änderung in `index.html`.
- **Variante B (Folgeschritt):** Eigene Tabelle `profiles` mit eindeutigem Anzeigenamen, Einträge verweisen darauf. Echter Schutz, aber größerer Umbau (Datenübernahme, Profil-UI, Fehlermeldung bei vergebenem Namen).

## User Stories (Variante A)
1. Als Trainer möchte ich, dass bei meinen Beiträgen, Kommentaren, Nachrichten und Testspiel-Anfragen immer der Name und Verein aus meinem Profil steht, damit Einträge verlässlich zuordenbar sind.
2. Als Betreiber möchte ich, dass die Datenbank mitgeschickte Namensangaben nicht übernimmt, damit einzelne Einträge nicht unter fremdem Namen angelegt werden können.

## Akzeptanzkriterien (Variante A)
1. Wird ein Eintrag mit beliebigem `author_name`/`club_name` (bzw. `sender_name`/`sender_club`, bzw. `club_name` bei Testspielen) angelegt, enthält die gespeicherte Zeile Name und Verein aus dem Konto des Einfügenden. Quelle ist `user_metadata.name` und `user_metadata.club.name`.
2. Ist `user_metadata.name` nicht vorhanden, `null`, leer oder nur Leerzeichen, wird `'Trainer'` gespeichert (wie bisher in der App an allen drei Stellen). Der Fallback aus `enterApp` (`full_name`, E-Mail-Präfix, `'Gast'`) wird bewusst **nicht** übernommen, damit sich nichts ändert.
3. Ist `user_metadata.club` nicht vorhanden/`null` oder `club.name` leer, wird bei `community_posts`, `post_comments` und `messages` ein leerer Text `''` gespeichert (nicht `NULL`), und die App zeigt wie bisher keinen „· Verein“-Zusatz.
4. `friendly_requests`: `club_name` kommt aus `user_metadata.club.name`. Hat das Konto keinen Vereinsnamen, wird der Insert abgelehnt oder die App-Prüfung („Bitte zuerst deinen Verein im Profil eintragen.“) bleibt als erste Hürde bestehen; es wird nie ein leerer oder fremder Vereinsname gespeichert. (Genaues Verhalten der DB: siehe offene Frage 4.)
5. Werden Name/Verein im Request weggelassen (`NULL`/fehlend), setzt der Trigger sie trotzdem; der Insert scheitert nicht an einer NOT-NULL-Regel für diese Spalten.
6. Gilt nur für Einfügen durch angemeldete Nutzer. Inserts ohne Nutzerkontext (SQL-Editor, Service-Role) werden nicht verändert.
7. Der Trigger liest den **aktuellen** Stand des Kontos. Ändert jemand seinen Namen im Profil und schreibt sofort danach einen Beitrag, steht der neue Name drin (nicht ein veralteter Wert aus einem noch gültigen Login-Token).
8. Bestehende Zeilen bleiben unverändert (nur neue Einträge sind betroffen). Kein Backfill.
9. Die App zeigt Beiträge, Kommentare, Nachrichten und Testspiele für Nutzer mit Profilnamen genauso an wie bisher (manuell prüfen: je ein Eintrag pro Tabelle mit Profilname und mit Konto ohne Namen/Verein).
10. Die App-Inserts senden die Namensfelder nicht mehr mit (`submitPost`, `submitComment`, `sendMessage`, `submitFriendlyRequest`), ohne dass sich das sichtbare Verhalten ändert. Die Vereinsprüfung in `submitFriendlyRequest` (Zeile 6221) bleibt als Nutzerhinweis erhalten. Hinweis: Wird dies erst nach dem Trigger ausgerollt, funktioniert die alte App unverändert weiter (Trigger zuerst, App-Änderung danach).
11. Kein neuer Lesezugriff entsteht: Die bestehenden Policies (inkl. `202610191300` und `202610191400`: Lesen nur `authenticated`, `messages`-Update nur auf `read`) bleiben unverändert, der Trigger gibt keine fremden Profildaten preis und erweitert keine Rechte.
12. Dokumentiert: Migration mit Rollback unter `supabase/migrations/` (Namensschema `JJJJMMTTHHMM_name.sql`), Hinweis auf die Einschränkung oben. Anwenden nur durch Jakob.

## Edge Cases
- Konto ohne Namen (z. B. altes Konto, Profil nie gespeichert): `'Trainer'` (Kriterium 2). In der Kopfzeile steht dann evtl. der E-Mail-Präfix, im Beitrag „Trainer“. Gleich wie heute.
- Name mit Leerzeichen/Sonderzeichen oder sehr lang: wird unverändert übernommen; keine neue Längenbegrenzung in diesem Feature. Die App maskiert per `escHtml`.
- Hobby-Verein (`club.type = 'hobby'`): hat nur `name`, kein `team`/`lat`/`lng`. Bei Testspielen bleiben `club_team` `''` und `lat`/`lng` `null` (wie heute), solange Frage 2 nicht anders entschieden wird.
- `club.lat`/`club.lng` liegen im Profil als Text. Falls sie später serverseitig gesetzt werden (Frage 2), ist die Umwandlung in Zahl zu beachten; leere Strings dürfen nicht zu einem Fehler beim Insert führen.
- Namensänderung im Profil kurz vor einem Eintrag (Kriterium 7); Token-Alter darf nicht maßgeblich sein.
- Mehrfach-Insert oder Batch: Trigger wirkt pro Zeile.
- Falsche oder fehlende `user_id`/`sender_id`: bleibt Sache der bestehenden RLS-Policy (Insert nur mit eigener ID). Der Trigger darf sich nicht auf die vom Client gesendete ID verlassen, sondern auf die angemeldete Nutzerkennung.
- Ausgeloggter Aufruf: Insert wird bereits von RLS abgelehnt; kein neues Verhalten.
- Antworten auf Nachrichten: Der Empfängername im Antwortdialog stammt aus dem gespeicherten `sender_name`. Der Trigger ändert hier nichts, aber alte Nachrichten tragen weiter den alten Namen.
- Fehlermeldungen: Die App zeigt `error.message` direkt an; der Trigger soll im Normalfall keine neuen Fehler erzeugen.

## Abgrenzung (nicht enthalten)
- Keine eindeutigen Anzeigenamen, keine Profiltabelle (Variante B).
- Keine nachträgliche Änderung bestehender Einträge, wenn jemand seinen Namen im Profil ändert (jeder Eintrag behält den Namen vom Zeitpunkt des Anlegens). Kein Backfill bestehender Zeilen.
- Kein Login-Hinweis für ausgeloggte Besucher in der Community (eigenes kleines Feature, siehe `rls-haertung.md`).
- Keine Korrektur des Anzeigefehlers in `loadSent` („An:“ zeigt eigenen Namen) und keine Bereinigung der doppelten `loadPosts`-Definition. Beides separat melden/beauftragen.
- Keine Längen- oder Inhaltsprüfung von Namen, keine Namensfilter.
- Keine Absicherung des Felds `role` oder anderer Profildaten.

## Datenbedarf
Keine neue Tabelle. Je ein Trigger vor dem Einfügen auf `community_posts`, `post_comments`, `messages` und `friendly_requests`, der Werte aus dem Konto des Einfügenden liest (`user_metadata.name`, `user_metadata.club.name`, ggf. `club.team`/`lat`/`lng`). Entwurf der SQL-Migration übernimmt der `db-architect`. Zu klären für ihn: Lesen aus dem aktuellen Konto statt aus dem Login-Token (Kriterium 7), Verhalten bei NOT-NULL-Spalten, Spaltentypen von `lat`/`lng`.

## Datenbankbezug
Migration: `supabase/migrations/202610191500_namen_serverseitig.sql` (Entwurf, nicht angewendet; Rollback als Kommentar am Dateiende).
- Funktion `public.set_author_from_profile()` (SECURITY DEFINER, `search_path = ''`) als **BEFORE INSERT**-Trigger auf `community_posts`, `post_comments`, `messages`, `friendly_requests`. Liest `name` und `club.name` aus dem aktuellen `auth.users.raw_user_meta_data` von `auth.uid()` (nicht aus dem Token, nicht aus der gesendeten `user_id`) und überschreibt `author_name`/`club_name` bzw. `sender_name`/`sender_club` bzw. bei Testspielen nur `club_name`. Fallback `'Trainer'` / `''`. Testspiel-Anfrage ohne Vereinsnamen im Konto wird mit „Bitte zuerst deinen Verein im Profil eintragen.“ abgelehnt.
- Funktion `public.keep_author_fields_on_update()` als **BEFORE UPDATE**-Trigger auf denselben Tabellen: Namensfelder behalten den alten Wert. Heute gibt es laut Doku keine UPDATE-Policy auf `community_posts`, `post_comments`, `friendly_requests` und bei `messages` nur das Spaltenrecht auf `read`; der Schutz verhindert, dass eine spätere Update-Policy den Trigger umgehbar macht.
- Beide Funktionen greifen nur bei `auth.uid() is not null`; SQL-Editor und Service-Role bleiben unberührt. EXECUTE ist für `public`, `anon`, `authenticated` entzogen. Keine Policy- oder Rechteänderung, kein Backfill.

## Zusammenhang mit `rls-haertung.md` und den Migrationen
- Das Feature ist dort ausdrücklich als „Bewusst offen: Fälschbare Namen“ vorgemerkt und ist die Folgearbeit zur RLS-Härtung. Kein Widerspruch.
- `202610191300_messages_update_nur_read.sql`: `messages` darf nur noch auf der Spalte `read` aktualisiert werden. Das ist **vorteilhaft**: Ein Absender kann `sender_name`/`sender_club` nach dem Trigger nicht per Update nachträglich fälschen (und der Empfänger auch nicht). Für `community_posts`, `post_comments` und `friendly_requests` gibt es keine Update-Policy in den Migrationen und der Code nutzt kein `update` darauf; vor dem Rollout vom `db-architect` zu prüfen, ob Update-Rechte (Spaltenrechte) für diese Tabellen tatsächlich fehlen, sonst wäre der Trigger per nachträglichem Update umgehbar. Dies ist der wichtigste mögliche Konflikt.
- `202610191400_community_nur_eingeloggt.sql` und der Teil zu `friendly_requests` in `…1300`: reine Lese-Policies, kein Konflikt. Die Trigger ändern keine Policies.
- Der noch ausstehende manuelle Test aus `rls-haertung.md` (Nachrichten senden/lesen, Testspiele laden) sollte vor diesem Feature abgeschlossen sein, damit Fehler eindeutig zuordenbar bleiben.
- Neue Migration bekommt ein späteres Datum als `202610191400`.

## Verbundene Features
RLS-Härtung (`docs/features/rls-haertung.md`), Community Pinnwand und Kommentare, Testspielbörse (`friendly_requests`, Radius-/Altersfilter nutzen `lat`/`lng`/`age_group`), Direktnachrichten/Inbox, Profil und Registrierung (`user_metadata`: `name`, `role`, `club`). Möglicher Folgeschritt: Variante B (Profiltabelle), Login-Hinweis in der Community.

## Entscheidungen (19.10.2026)
Jakob hat alle Empfehlungen angenommen:
1. Variante A jetzt (BEFORE-INSERT-Trigger), Variante B (`profiles`-Tabelle) später.
2. `friendly_requests`: nur `club_name` wird serverseitig gesetzt; `club_team`, `lat`, `lng` bleiben vom Client.
3. `friendly_requests` ohne Vereinsnamen im Konto: Insert wird abgelehnt (Fehler mit verständlicher Meldung); die App-Prüfung bleibt als freundlicher Hinweis.
4. Bestehende Einträge behalten den alten Namen, kein Backfill.
5. Fallback bei fehlendem oder leerem Namen: `'Trainer'`; leerer Verein: `''`.

## Funktionsweise (Umsetzung in der App)
Die App sendet Name und Verein nicht mehr mit, der Trigger setzt sie serverseitig. Geändert in `index.html`:
- `submitPost`: kein `author_name`/`club_name` mehr im Insert.
- `submitComment`: kein `author_name`/`club_name` mehr im Insert.
- `sendMessage`: kein `sender_name`/`sender_club` mehr im Insert.
- `submitFriendlyRequest`: kein `club_name` mehr; `club_team`, `lat`, `lng` bleiben. Die Vereinsprüfung im Client bleibt als freundlicher Hinweis. Eine DB-Fehlermeldung (z. B. fehlender Verein) erscheint über das bestehende `fmError`-Feld als „Fehler: …“.
- Die danach unbenutzte lokale Variable `meta` wurde in `submitPost`, `submitComment` und `sendMessage` entfernt (in `submitFriendlyRequest` wird sie weiter für `club` genutzt).

## Testbericht (Tester, 19.10.2026)
Methode: nur Code- und Logik-Durchgang (SQL und JS gelesen). Nichts im Browser ausgeführt, Migration nicht angewendet, kein DB-Zugriff. `node scripts/check-js.mjs`: OK.

**Kriterien**
- 1 Quelle Konto: im SQL erfüllt (set_author_from_profile, Zeilen der Funktion), nur nach Anwendung in der DB prüfbar.
- 2 Fallback 'Trainer' (null/leer/Whitespace): im SQL erfüllt (btrim). Nur ASCII-Whitespace; geschütztes Leerzeichen (U+00A0) gilt als Name. Hinweis.
- 3 Verein '' statt NULL: im SQL erfüllt. `->` / `->>` liefert bei club = null/String/Array NULL, kein Fehler.
- 4 Testspiel ohne Verein: Client-Prüfung index.html:6221 bleibt; DB wirft check_violation, Anzeige über `fmError` ("Fehler: … (Code: 23514)", index.html:6232). Erfüllt, DB-Teil nur nach Anwendung prüfbar.
- 5 Weggelassene Felder: BEFORE-Trigger läuft vor NOT-NULL-Prüfung, erfüllt (nach Anwendung prüfbar).
- 6 Ohne Nutzerkontext unberührt: `auth.uid() is null -> return new`, erfüllt. Ein Insert ohne Namensfelder per SQL-Editor scheitert dann ggf. an NOT NULL (erwartet).
- 7 Aktueller Kontostand: liest auth.users direkt, erfüllt (nach Anwendung prüfbar).
- 8 Kein Backfill: erfüllt.
- 9 Anzeige unverändert: im Code geprüft (Anzeige liest nur DB-Spalten, kein Insert nutzt die Rückgabezeile); manuell nach Anwendung prüfen.
- 10 App sendet keine Namensfelder: erfüllt (Diff, 4 Stellen). Kein ReferenceError: `meta` wird nur noch in submitFriendlyRequest (6216/6217) genutzt und dort deklariert.
- 11 Keine neuen Rechte: erfüllt, keine Policy-Änderung; EXECUTE entzogen.
- 12 Doku/Rollback: erfüllt.

**Weitere Schreibstellen:** nur `messages.update({read:true})` (index.html:6562), sonst insert (je 1) und delete. Kein upsert. Update-Trigger setzt Namensfelder auf OLD, also wirkungslos beim Gelesen-Markieren.

**Mängel**
- Wichtig: Rollout-Reihenfolge. Die App-Änderung ist im Arbeitsverzeichnis, Migration nicht angewendet. Wird die App vor der Migration deployt (Push = Deploy), speichern Posts/Kommentare/Nachrichten/Testspiele ohne Namen oder scheitern an NOT NULL. Migration zuerst anwenden, dann pushen. Zeile 3 dieser Datei ("danach App-Anpassung") ist veraltet formuliert.
- Hinweis: Client-Prüfung (6221) nutzt Token-Metadaten (evtl. veraltet), DB den aktuellen Stand; Abweichung führt nur zu Hinweis bzw. DB-Fehlermeldung.
- Hinweis: Namen werden unverändert (nicht getrimmt) übernommen; Anzeige maskiert per escHtml.

**Gesamturteil:** bestanden (Code-Ebene), unter Vorbehalt der DB-Tests nach Anwendung. Keine Blocker.

**Manuelle Tests für Jakob (nach Anwendung, vor Push)**
1. Prüfabfragen am Dateiende der Migration: 8 Trigger sichtbar, prosecdef = true.
2. Je ein Beitrag, Kommentar, Nachricht, Testspiel mit Profilname und Verein (alte App) -> Name/Verein stimmen.
3. Konto ohne Namen/Verein: Beitrag zeigt "Trainer" ohne Zusatz; Testspiel zeigt Hinweis "Bitte zuerst deinen Verein…".
4. Name im Profil ändern, sofort Beitrag schreiben -> neuer Name.
5. Posteingang öffnen (Gelesen-Markierung) -> kein Fehler, Namen unverändert.
6. Fälschung in der Browser-Konsole der eingeloggten App: `await sb.from('community_posts').insert({user_id: currentUser.id, title:'t', body:'b', author_name:'FAKE', club_name:'FAKE FC'})`, danach Beitrag laden: Name ist der eigene. Analog `post_comments`, `messages` (sender_name/sender_club) und `friendly_requests` (club_name).
7. Update-Fälschung: `await sb.from('community_posts').update({author_name:'FAKE'}).eq('id', <eigene id>)` -> Name bleibt (bzw. 0 Zeilen).
8. Danach neue App pushen und Schritte 2 und 3 wiederholen.
