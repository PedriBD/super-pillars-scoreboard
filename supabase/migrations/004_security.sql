-- Sikkerhedsoprydning (2026-11-04).

/* 1. Den gamle side: lås den gamle "games"-tabel og fjern det gamle password-tjek.
      Tabellen beholdes som backup, men kan nu kun ses fra SQL Editor. */
drop policy if exists "public read" on games;
drop policy if exists "public insert" on games;
drop policy if exists "public update" on games;
drop policy if exists "public delete" on games;
revoke all on games from anon, authenticated;
drop function if exists check_site_password(text);

/* 2. Ikke-indloggede (anon) skal slet ikke kunne røre tabellerne.
      Indloggede får kun de rettigheder, appen bruger; adgangsreglerne (RLS) bestemmer resten. */
revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
revoke all on legacy_player_map, site_gate from authenticated;
alter default privileges in schema public revoke all on tables from anon;
revoke execute on function is_member() from public, anon;

/* 3. Begræns forsøg på gruppekoden: maks. 5 forkerte forsøg pr. bruger pr. time. */
create table if not exists join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_time on join_attempts (user_id, attempted_at);
alter table join_attempts enable row level security; -- ingen policies: kun funktionen bruger den
revoke all on join_attempts from anon, authenticated;

create or replace function join_with_code(code text) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Ikke logget ind';
  end if;
  if (select count(*) from join_attempts
      where user_id = auth.uid() and attempted_at > now() - interval '1 hour') >= 5 then
    raise exception 'For mange forsøg';
  end if;
  if not exists (select 1 from site_gate where id = 1 and password_hash = crypt(code, password_hash)) then
    insert into join_attempts (user_id) values (auth.uid());
    return false;
  end if;
  insert into members (user_id) values (auth.uid()) on conflict do nothing;
  return true;
end;
$$;
revoke all on function join_with_code(text) from public, anon;
grant execute on function join_with_code(text) to authenticated;

/* 4. Profilbilleder må kun pege på jeres eget lager i Supabase (ikke på fremmede sider). */
alter table players drop constraint if exists players_avatar_url_check;
alter table players add constraint players_avatar_url_check check (
  avatar_url is null
  or avatar_url like 'https://ulunjtgszuuosyofkkfo.supabase.co/storage/v1/object/public/avatars/%'
);
