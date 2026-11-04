-- Fra 2026-11-04 er der kun ét fælles opgør. Alle kampe og spillere fra de
-- andre opgør flyttes over i det ældste ("Pillars"), og de andre slettes.
do $$
declare
  keep uuid;
begin
  select id into strict keep from sessions order by created_at limit 1;

  update matches set session_id = keep where session_id <> keep;
  insert into session_players (session_id, player_id)
    select keep, player_id from session_players where session_id <> keep
    on conflict do nothing;
  delete from sessions where id <> keep;
end;
$$;
