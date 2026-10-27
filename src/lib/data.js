import { supabase } from "../supabase.js";

// Henter kampe (evt. kun fra ét opgør) og omformer dem til en simpel struktur:
// { id, sessionId, playedAt, winnerId, results: { [playerId]: { roundWins, elim, dmg } } }
export async function fetchMatches(sessionId) {
  let query = supabase
    .from("matches")
    .select("id, session_id, played_at, winner_id, match_results(player_id, round_wins, elim, dmg)")
    .order("played_at", { ascending: true });
  if (sessionId) query = query.eq("session_id", sessionId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    sessionId: m.session_id,
    playedAt: m.played_at,
    winnerId: m.winner_id,
    results: Object.fromEntries(
      m.match_results.map((r) => [r.player_id, { roundWins: r.round_wins, elim: r.elim, dmg: r.dmg }])
    ),
  }));
}

export async function fetchPlayers() {
  const { data, error } = await supabase.from("players").select("id, name, avatar_url, user_id").order("name");
  if (error) throw error;
  return data;
}

// Gemmer en kamp med resultater. Fejler resultaterne, slettes kampen igen,
// så der ikke ligger en halv kamp i databasen.
export async function saveMatch(sessionId, winnerId, results) {
  const { data: match, error } = await supabase
    .from("matches")
    .insert({ session_id: sessionId, winner_id: winnerId })
    .select("id")
    .single();
  if (error) throw error;
  const rows = Object.entries(results).map(([playerId, r]) => ({
    match_id: match.id,
    player_id: playerId,
    round_wins: r.roundWins,
    elim: r.elim,
    dmg: r.dmg,
  }));
  const { error: resultError } = await supabase.from("match_results").insert(rows);
  if (resultError) {
    await supabase.from("matches").delete().eq("id", match.id);
    throw resultError;
  }
}
