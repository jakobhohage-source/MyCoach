-- STATUS: ANGEWENDET am 19.10.2026
-- MyCoach: Name und Verein serverseitig setzen (Variante A, Trigger)
-- Spezifikation: docs/features/namen-serverseitig-setzen.md
--
-- Was diese Migration tut
-- 1. BEFORE INSERT auf community_posts, post_comments, messages, friendly_requests:
--    Name/Verein werden aus dem AKTUELLEN Stand von auth.users.raw_user_meta_data
--    des angemeldeten Nutzers (auth.uid()) gesetzt, nicht aus dem JWT und nicht aus
--    den vom Client gesendeten Werten oder IDs.
--      community_posts   : author_name, club_name
--      post_comments     : author_name, club_name
--      messages          : sender_name, sender_club
--      friendly_requests : club_name  (club_team, lat, lng bleiben vom Client, Entscheidung 2)
--    Fallbacks: Name fehlt/leer/nur Leerzeichen -> 'Trainer'; Verein fehlt/leer -> ''.
--    friendly_requests ohne Vereinsnamen im Konto -> Insert wird abgelehnt (Entscheidung 3).
-- 2. BEFORE UPDATE auf denselben vier Tabellen: Namensfelder werden auf den alten
--    Wert (OLD) festgehalten.
-- Nur wenn auth.uid() nicht null ist. SQL-Editor / Service-Role (ohne Nutzerkontext)
-- bleiben unberührt. Kein Backfill, bestehende Zeilen werden nicht verändert.
--
-- Begründung für den UPDATE-Schutz (Ergebnis der Prüfung ohne DB-Zugriff):
-- - community_posts, post_comments, friendly_requests: Laut rls-haertung.md gibt es nur
--   Policies für Lesen, Anlegen und Löschen, keine UPDATE-Policy; index.html nutzt kein
--   update() auf diese Tabellen. Bei aktivem RLS ohne UPDATE-Policy ist ein Update
--   derzeit wirkungslos (0 Zeilen). ABER: Supabase vergibt standardmäßig das Tabellen-
--   recht UPDATE an anon/authenticated. Sobald künftig irgendeine UPDATE-Policy
--   ergänzt wird (z. B. "Beitrag bearbeiten"), wären die Namensfelder sofort fälschbar.
--   Da die Policy-Liste nicht als Migration im Repo liegt, ist der Stand nicht
--   vollständig belegbar -> Schutz wird als Verteidigung in der Tiefe ergänzt.
-- - messages: Laut 202610191300 hat authenticated UPDATE nur auf Spalte "read", die
--   Namensfelder sind damit schon geschützt. Der Trigger kommt trotzdem dazu, damit der
--   Schutz auch dann hält, wenn das Spaltenrecht später wieder geöffnet wird. Er greift
--   beim Markieren als gelesen (update({read:true})) nicht störend ein.
--
-- Sicherheit der Funktionen
-- - SECURITY DEFINER (nötig, um auth.users zu lesen), search_path = '' und alle Objekte
--   voll qualifiziert -> keine Schema-Unterschiebung möglich.
-- - Liest ausschließlich die Zeile von auth.uid() und schreibt nur in NEW. Es werden
--   keine fremden Profildaten gelesen oder zurückgegeben; die Werte landen nur in der
--   Zeile, die der Nutzer ohnehin selbst anlegt.
-- - Rückgabetyp "trigger": weder per SQL noch per PostgREST (/rpc) direkt aufrufbar.
--   EXECUTE wird zusätzlich von public, anon, authenticated entzogen (Supabase vergibt es
--   sonst per Default-Privileges). Das Feuern des Triggers prüft kein EXECUTE-Recht des
--   einfügenden Nutzers, die Inserts der App funktionieren also weiter.

-- ═══════════ 1. Trigger-Funktion: Namen beim Anlegen setzen ═══════════
create or replace function public.set_author_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_meta      jsonb;
  v_name      text;
  v_club_name text;
begin
  -- Ohne Nutzerkontext (SQL-Editor, Service-Role): nichts verändern.
  if v_uid is null then
    return new;
  end if;

  select u.raw_user_meta_data
    into v_meta
    from auth.users u
   where u.id = v_uid;

  -- ->> liefert NULL, wenn Schlüssel fehlt, Wert JSON-null ist oder club kein Objekt ist.
  v_name      := v_meta ->> 'name';
  v_club_name := v_meta -> 'club' ->> 'name';

  -- Leer oder nur Whitespace gilt als nicht vorhanden. Nicht-leere Werte unverändert übernehmen.
  if v_name is null or btrim(v_name, E' \t\r\n') = '' then
    v_name := 'Trainer';
  end if;
  if v_club_name is null or btrim(v_club_name, E' \t\r\n') = '' then
    v_club_name := '';
  end if;

  if tg_table_name in ('community_posts', 'post_comments') then
    new.author_name := v_name;
    new.club_name   := v_club_name;

  elsif tg_table_name = 'messages' then
    new.sender_name := v_name;
    new.sender_club := v_club_name;

  elsif tg_table_name = 'friendly_requests' then
    if v_club_name = '' then
      raise exception 'Bitte zuerst deinen Verein im Profil eintragen.'
        using errcode = 'check_violation';
    end if;
    new.club_name := v_club_name;
    -- club_team, lat, lng bleiben bewusst vom Client (Entscheidung 2).
  end if;

  return new;
end;
$$;

-- ═══════════ 2. Trigger-Funktion: Namen bei Updates festhalten ═══════════
create or replace function public.keep_author_fields_on_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_table_name in ('community_posts', 'post_comments') then
    new.author_name := old.author_name;
    new.club_name   := old.club_name;
  elsif tg_table_name = 'messages' then
    new.sender_name := old.sender_name;
    new.sender_club := old.sender_club;
  elsif tg_table_name = 'friendly_requests' then
    new.club_name := old.club_name;
  end if;

  return new;
end;
$$;

-- Direkten Aufruf durch Clients ausschließen.
revoke all on function public.set_author_from_profile()       from public, anon, authenticated;
revoke all on function public.keep_author_fields_on_update()  from public, anon, authenticated;

-- ═══════════ 3. Trigger (idempotent) ═══════════
drop trigger if exists set_author_from_profile on public.community_posts;
create trigger set_author_from_profile
  before insert on public.community_posts
  for each row execute function public.set_author_from_profile();

drop trigger if exists set_author_from_profile on public.post_comments;
create trigger set_author_from_profile
  before insert on public.post_comments
  for each row execute function public.set_author_from_profile();

drop trigger if exists set_author_from_profile on public.messages;
create trigger set_author_from_profile
  before insert on public.messages
  for each row execute function public.set_author_from_profile();

drop trigger if exists set_author_from_profile on public.friendly_requests;
create trigger set_author_from_profile
  before insert on public.friendly_requests
  for each row execute function public.set_author_from_profile();

drop trigger if exists keep_author_fields_on_update on public.community_posts;
create trigger keep_author_fields_on_update
  before update on public.community_posts
  for each row execute function public.keep_author_fields_on_update();

drop trigger if exists keep_author_fields_on_update on public.post_comments;
create trigger keep_author_fields_on_update
  before update on public.post_comments
  for each row execute function public.keep_author_fields_on_update();

drop trigger if exists keep_author_fields_on_update on public.messages;
create trigger keep_author_fields_on_update
  before update on public.messages
  for each row execute function public.keep_author_fields_on_update();

drop trigger if exists keep_author_fields_on_update on public.friendly_requests;
create trigger keep_author_fields_on_update
  before update on public.friendly_requests
  for each row execute function public.keep_author_fields_on_update();

-- ═══════════ Prüfabfragen nach dem Anwenden (nur lesend) ═══════════
-- select event_object_table, trigger_name, action_timing, event_manipulation
--   from information_schema.triggers
--  where trigger_name in ('set_author_from_profile','keep_author_fields_on_update')
--  order by 1, 2;
-- select proname, prosecdef, proconfig, proacl from pg_proc
--  where proname in ('set_author_from_profile','keep_author_fields_on_update');

-- ═══════════ ROLLBACK ═══════════
-- Entfernt nur die Trigger und Funktionen dieser Migration, keine Daten.
-- (App-Änderung vorher zurücknehmen, falls die App die Namensfelder nicht mehr mitsendet.)
-- drop trigger if exists set_author_from_profile      on public.community_posts;
-- drop trigger if exists set_author_from_profile      on public.post_comments;
-- drop trigger if exists set_author_from_profile      on public.messages;
-- drop trigger if exists set_author_from_profile      on public.friendly_requests;
-- drop trigger if exists keep_author_fields_on_update on public.community_posts;
-- drop trigger if exists keep_author_fields_on_update on public.post_comments;
-- drop trigger if exists keep_author_fields_on_update on public.messages;
-- drop trigger if exists keep_author_fields_on_update on public.friendly_requests;
-- drop function if exists public.set_author_from_profile();
-- drop function if exists public.keep_author_fields_on_update();
