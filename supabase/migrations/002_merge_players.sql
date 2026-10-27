-- Lægger spillere sammen, der er den samme person i forskellige opgør.

-- Flytter alle kampe og opgør fra p_remove over til p_keep og sletter p_remove.
-- Kun til brug fra SQL Editor (ikke fra appen).
create or replace function merge_players(p_keep uuid, p_remove uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_keep = p_remove then
    raise exception 'Kan ikke lægge en spiller sammen med sig selv';
  end if;
  if (select user_id from players where id = p_remove) is not null then
    raise exception 'Spilleren, der fjernes, må ikke have en bruger';
  end if;

  -- Var begge med i samme kamp, beholdes p_keep's række
  delete from match_results r
  where r.player_id = p_remove
    and exists (select 1 from match_results r2 where r2.match_id = r.match_id and r2.player_id = p_keep);
  update match_results set player_id = p_keep where player_id = p_remove;
  update matches set winner_id = p_keep where winner_id = p_remove;
  insert into session_players (session_id, player_id)
    select session_id, p_keep from session_players where player_id = p_remove
    on conflict do nothing;
  update legacy_player_map set player_id = p_keep where player_id = p_remove;
  update players set avatar_url = coalesce(avatar_url, (select avatar_url from players where id = p_remove))
    where id = p_keep;
  delete from players where id = p_remove;
end;
$$;

revoke all on function merge_players(uuid, uuid) from public, anon, authenticated;

-- Engangsoprydning (2026-10-27), aftalt med gruppen:
--   Jork + Jork Pedri          → "Jork Pedri" (beholder spilleren med bruger)
--   Tim "mmmmmhhhhh" Krogh + Mim → "Tim "mmmmmhhhhh" Krogh"
--   Jipsen + Jonas             → "Jipsen"
--   Chrisser                   → "Chrisser "Carrick" Kastberg"
-- "into strict" stopper det hele, hvis et navn ikke findes præcis én gang.
do $$
declare
  jork uuid; jork_pedri uuid;
  tim uuid; mim uuid;
  jipsen uuid; jonas uuid;
  chrisser uuid;
begin
  select id into strict jork from players where name = 'Jork';
  select id into strict jork_pedri from players where name = 'Jork Pedri';
  select id into strict tim from players where name = 'Tim "mmmmmhhhhh" Krogh';
  select id into strict mim from players where name = 'Mim';
  select id into strict jipsen from players where name = 'Jipsen';
  select id into strict jonas from players where name = 'Jonas';
  select id into strict chrisser from players where name = 'Chrisser';

  perform merge_players(jork, jork_pedri);
  update players set name = 'Jork Pedri' where id = jork;

  perform merge_players(tim, mim);
  perform merge_players(jipsen, jonas);

  update players set name = 'Chrisser "Carrick" Kastberg' where id = chrisser;
end;
$$;
