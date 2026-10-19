# RLS-Härtung für MyCoach

**Status:** Umgesetzt und verifiziert am 19.10.2026 (Live-Datenbank, Projekt `mycoach`).
Migration: `supabase/migrations/202610191300_messages_update_nur_read.sql`

## Ergebnis der Prüfung (direkt in der Datenbank ausgelesen)
- RLS ist auf allen sechs Tabellen aktiv, Policies decken alle Zugriffe der App ab.
- `training_plans`, `tactics`: nur eigene Zeilen. `community_posts`, `post_comments`, `friendly_requests`: Anlegen und Löschen nur Eigenes. `messages`: nur Sender und Empfänger.
- `post_comments.post_id` hat `ON DELETE CASCADE`. `training_plans` hat die eindeutige Kombination `(user_id, name)` für den Upsert.

## Umgesetzte Änderungen
1. **`messages`:** Update-Recht auf die Spalte `read` begrenzt. Ein Empfänger kann Betreff, Text und Absenderangaben nicht mehr ändern. Verifiziert: `authenticated` hat UPDATE nur auf `read`, `anon` gar nicht.
2. **`friendly_requests`:** Lese-Policy gilt nur noch für `authenticated`. Besucher ohne Login sehen keine Testspiele mehr. Verifiziert über `pg_policies`.

## Bewusst offen
- Beiträge und Kommentare sind inzwischen ebenfalls nur für Eingeloggte lesbar (Migration `202610191400_community_nur_eingeloggt.sql`, angewendet und verifiziert). Ausgeloggte Besucher sehen in der Community nur leere Zustände wie „Noch keine Beiträge. Sei der Erste!“, weil die App kein Login-Gate hat. Ein Login-Hinweis wäre ein kleines Folge-Feature.
- **Fälschbare Namen:** `author_name`, `club_name`, `sender_name` kommen aus dem Browser, die Policies prüfen nur `user_id`. Behebung wäre ein Trigger, der den Namen aus dem Konto setzt. Eigenes Feature, gute Aufgabe für `/feature`.
- **Auth-Einstellung:** „Leaked Password Protection“ ist im Supabase-Dashboard deaktiviert (einziger verbleibender Security-Hinweis, soweit ich weiß nicht in jedem Tarif verfügbar).

## Noch ausstehender manueller Test (mit zwei Testkonten)
- Eingeloggt: Testspiele werden in der App weiterhin geladen und angezeigt.
- Ausgeloggt: Die Testspielbörse zeigt keine Einträge. Prüfen, ob die App dann eine sinnvolle Meldung anzeigt statt eines Fehlers.
- Nachrichten senden, lesen und als gelesen markieren funktioniert weiterhin.

## Akzeptanzkriterien
1. Update auf `messages` nur für Spalte `read`. Erfüllt.
2. Testspiele nur für Eingeloggte lesbar. Erfüllt.
3. Kein Verhalten ändert sich für eingeloggte Nutzer. Noch durch manuellen Test zu bestätigen.
