-- STATUS: ANGEWENDET am 19.10.2026
-- MyCoach: RLS-Nachschärfung
-- ANGEWENDET am 19.10.2026 auf der Live-Datenbank (Supabase-Migration
-- "messages_update_nur_read_und_testspiele_nur_eingeloggt"), danach verifiziert.
--
-- 1. messages: Die Policy "update own" begrenzt nur Zeilen, nicht Spalten.
--    Update-Recht wird auf die Spalte "read" beschränkt (die App ändert nur diese).
-- 2. friendly_requests: Testspiele sind nur noch für eingeloggte Nutzer lesbar
--    (Entscheidung von Jakob). Beiträge und Kommentare bleiben bewusst unverändert öffentlich lesbar.

revoke update on public.messages from anon, authenticated;
grant update (read) on public.messages to authenticated;
alter policy "Alle lesen" on public.friendly_requests to authenticated;

-- ═══════════ ROLLBACK ═══════════
-- grant update on public.messages to anon, authenticated;
-- alter policy "Alle lesen" on public.friendly_requests to public;
--
-- Beiträge und Kommentare: siehe 202610191400_community_nur_eingeloggt.sql
