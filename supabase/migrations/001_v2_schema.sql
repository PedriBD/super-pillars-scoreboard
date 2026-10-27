-- Super Pillars v2: brugere med Google-login, fælles spillerprofiler og
-- rigtige tabeller i stedet for én JSON-klump pr. opgør.
-- Den gamle tabel "games" røres ikke, så den gamle side kører videre.

/* ---------------- Tabeller ---------------- */

-- En spiller. user_id er sat, når spilleren er koblet til en Google-bruger;
-- ellers er det en "gæst", som en bruger senere kan gøre krav på.
create table players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Brugere, der har indtastet gruppekoden, og derfor må se og skrive data.
create table members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now()
);

-- Et opgør (fx "Fredagsgutterne").
create table sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  legacy_room_code text unique,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Hvilke spillere der er med i hvilke opgør.
create table session_players (
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (session_id, player_id)
);
create index on session_players (player_id);

-- En afsluttet kamp.
create table matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  played_at timestamptz not null default now(),
  winner_id uuid references players(id) on delete set null,
  legacy_id text unique,
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);
create index on matches (session_id);
create index on matches (winner_id);

-- Slutresultatet for én spiller i én kamp.
create table match_results (
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  round_wins int not null default 0 check (round_wins >= 0),
  elim int not null default 0 check (elim >= 0),
  dmg int not null default 0 check (dmg >= 0),
  primary key (match_id, player_id)
);
create index on match_results (player_id);

-- Kobling fra de gamle spiller-id'er ("ROOM:gammelt-id") til nye spillere,
-- så importen kan køres igen uden at lave dubletter.
create table legacy_player_map (
  legacy_key text primary key,
  player_id uuid not null references players(id) on delete cascade
);

/* ---------------- Hjælpefunktioner ---------------- */

create function is_member() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from members where user_id = auth.uid());
$$;

-- Bliv medlem ved at indtaste gruppekoden (samme kode som den gamle side).
create function join_with_code(code text) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Ikke logget ind';
  end if;
  if not exists (select 1 from site_gate where id = 1 and password_hash = crypt(code, password_hash)) then
    return false;
  end if;
  insert into members (user_id) values (auth.uid()) on conflict do nothing;
  return true;
end;
$$;

-- Opret din egen spiller (når du ikke er en af de eksisterende gæster).
create function create_my_player(p_name text, p_avatar_url text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  pid uuid;
begin
  if not is_member() then
    raise exception 'Ikke medlem';
  end if;
  select id into pid from players where user_id = auth.uid();
  if pid is not null then
    return pid;
  end if;
  insert into players (user_id, name, avatar_url)
  values (auth.uid(), left(coalesce(nullif(trim(p_name), ''), 'Ny spiller'), 40), p_avatar_url)
  returning id into pid;
  return pid;
end;
$$;

-- Gør krav på en gæst: "det her er mig".
-- Har du ikke en spiller endnu, bliver gæsten din. Har du allerede en,
-- bliver gæstens kampe og opgør flyttet over til din spiller, og gæsten slettes.
create function claim_player(p_guest uuid) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  mine uuid;
begin
  if not is_member() then
    raise exception 'Ikke medlem';
  end if;
  if not exists (select 1 from players where id = p_guest and user_id is null) then
    raise exception 'Spilleren findes ikke eller tilhører allerede en bruger';
  end if;

  select id into mine from players where user_id = auth.uid();
  if mine is null then
    update players set user_id = auth.uid() where id = p_guest;
    return p_guest;
  end if;

  -- Sammenlæg: var begge med i samme kamp, beholdes din egen række
  delete from match_results r
  where r.player_id = p_guest
    and exists (select 1 from match_results r2 where r2.match_id = r.match_id and r2.player_id = mine);
  update match_results set player_id = mine where player_id = p_guest;
  update matches set winner_id = mine where winner_id = p_guest;
  insert into session_players (session_id, player_id)
    select session_id, mine from session_players where player_id = p_guest
    on conflict do nothing;
  update legacy_player_map set player_id = mine where player_id = p_guest;
  update players set avatar_url = coalesce(avatar_url, (select avatar_url from players where id = p_guest))
    where id = mine;
  delete from players where id = p_guest;
  return mine;
end;
$$;

revoke all on function join_with_code(text), create_my_player(text, text), claim_player(uuid) from public, anon;
grant execute on function join_with_code(text), create_my_player(text, text), claim_player(uuid) to authenticated;
grant execute on function is_member() to authenticated;

/* ---------------- Adgangsregler (Row Level Security) ---------------- */

alter table players enable row level security;
alter table members enable row level security;
alter table sessions enable row level security;
alter table session_players enable row level security;
alter table matches enable row level security;
alter table match_results enable row level security;
alter table legacy_player_map enable row level security; -- ingen policies: kun til importen

-- Spillere: alle medlemmer kan se alle. Navn og billede kan ændres på
-- gæster og på din egen spiller, men ikke på andre brugeres spillere.
-- user_id kan kun sættes via funktionerne ovenfor.
create policy "medlemmer ser spillere" on players for select to authenticated using (is_member());
create policy "medlemmer opretter gæster" on players for insert to authenticated with check (is_member() and user_id is null);
create policy "ret gæster og dig selv" on players for update to authenticated
  using (is_member() and (user_id is null or user_id = auth.uid()))
  with check (is_member() and (user_id is null or user_id = auth.uid()));
create policy "slet gæster" on players for delete to authenticated using (is_member() and user_id is null);
revoke insert, update on players from authenticated;
grant insert (name, avatar_url) on players to authenticated;
grant update (name, avatar_url) on players to authenticated;

create policy "se eget medlemskab" on members for select to authenticated using (user_id = auth.uid());

create policy "medlemmer: opgør" on sessions for all to authenticated using (is_member()) with check (is_member());
create policy "medlemmer: deltagere" on session_players for all to authenticated using (is_member()) with check (is_member());
create policy "medlemmer: kampe" on matches for all to authenticated using (is_member()) with check (is_member());
create policy "medlemmer: resultater" on match_results for all to authenticated using (is_member()) with check (is_member());

/* ---------------- Profilbilleder ---------------- */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "medlemmer uploader profilbilleder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.is_member());
create policy "medlemmer ser profilbilleder" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_member());

/* ---------------- Realtime ---------------- */

alter publication supabase_realtime add table players, sessions, session_players, matches, match_results;

/* ---------------- Import af de gamle data ---------------- */

-- Kopierer opgør, spillere og kampe fra den gamle "games"-tabel.
-- Kan køres igen: allerede importerede spillere og kampe springes over.
create function import_legacy_games() returns text
language plpgsql security definer set search_path = public
as $$
declare
  g record;
  p jsonb;
  m jsonb;
  k text;
  r jsonb;
  sid uuid;
  pid uuid;
  mid uuid;
  nye_kampe int := 0;
begin
  for g in select * from games loop
    insert into sessions (name, legacy_room_code, created_at, created_by)
    values (left(coalesce(nullif(trim(g.name), ''), g.room_code), 40), g.room_code, g.updated_at, null)
    on conflict (legacy_room_code) do nothing;
    select id into sid from sessions where legacy_room_code = g.room_code;

    for p in select * from jsonb_array_elements(coalesce(g.state->'players', '[]')) loop
      k := g.room_code || ':' || (p->>'id');
      select player_id into pid from legacy_player_map where legacy_key = k;
      if pid is null then
        insert into players (name) values (left(coalesce(nullif(trim(p->>'name'), ''), 'Ukendt'), 40))
        returning id into pid;
        insert into legacy_player_map (legacy_key, player_id) values (k, pid);
      end if;
      insert into session_players (session_id, player_id) values (sid, pid) on conflict do nothing;
    end loop;

    for m in select * from jsonb_array_elements(coalesce(g.state->'matches', '[]')) loop
      if exists (select 1 from matches where legacy_id = g.room_code || ':' || (m->>'id')) then
        continue;
      end if;
      insert into matches (session_id, played_at, winner_id, legacy_id, created_by)
      values (
        sid,
        coalesce((m->>'playedAt')::timestamptz, now()),
        (select player_id from legacy_player_map where legacy_key = g.room_code || ':' || (m->>'winnerId')),
        g.room_code || ':' || (m->>'id'),
        null
      )
      returning id into mid;

      for k, r in select * from jsonb_each(coalesce(m->'results', '{}')) loop
        select player_id into pid from legacy_player_map where legacy_key = g.room_code || ':' || k;
        if pid is null then
          continue;
        end if;
        insert into match_results (match_id, player_id, round_wins, elim, dmg)
        values (
          mid, pid,
          coalesce(round((r->>'roundWins')::numeric), 0),
          coalesce(round((r->>'elim')::numeric), 0),
          coalesce(round((r->>'dmg')::numeric), 0)
        )
        on conflict do nothing;
      end loop;
      nye_kampe := nye_kampe + 1;
    end loop;
  end loop;
  return nye_kampe || ' nye kampe importeret';
end;
$$;

revoke all on function import_legacy_games() from public, anon, authenticated;
