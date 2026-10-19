-- STATUS: ANGEWENDET am 19.10.2026
-- MyCoach: Beiträge und Kommentare nur für eingeloggte Nutzer lesbar
-- ANGEWENDET am 19.10.2026 auf der Live-Datenbank (Supabase-Migration "community_lesen_nur_eingeloggt"),
-- danach verifiziert. Entscheidung von Jakob: Besucher ohne Login sehen keine Beiträge und Kommentare.
-- Zusammen mit 202610191300 sind damit alle Lese-Policies auf "authenticated" beschränkt.

alter policy "Alle lesen" on public.community_posts to authenticated;
alter policy "read"       on public.post_comments   to authenticated;

-- ═══════════ ROLLBACK ═══════════
-- alter policy "Alle lesen" on public.community_posts to public;
-- alter policy "read"       on public.post_comments   to public;
