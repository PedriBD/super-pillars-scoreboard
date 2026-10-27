import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useMatch, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase.js";
import { fetchMatches, fetchPlayers, saveMatch } from "../lib/data.js";
import Avatar from "../components/Avatar.jsx";
import Leaderboard from "../components/Leaderboard.jsx";
import MatchForm from "../components/MatchForm.jsx";
import MatchHistory from "../components/MatchHistory.jsx";
import StatsView from "../components/StatsView.jsx";

export default function Session() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showStats = useMatch("/opgor/:id/statistik");
  const [session, setSession] = useState(undefined);
  const [players, setPlayers] = useState([]); // spillere i dette opgør
  const [allPlayers, setAllPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: s, error: sErr }, { data: sp, error: spErr }, m, all] = await Promise.all([
        supabase.from("sessions").select("id, name").eq("id", id).maybeSingle(),
        supabase.from("session_players").select("players(id, name, avatar_url, user_id)").eq("session_id", id),
        fetchMatches(id),
        fetchPlayers(),
      ]);
      if (sErr || spErr) throw sErr || spErr;
      setSession(s);
      setPlayers(sp.map((row) => row.players).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)));
      setMatches(m);
      setAllPlayers(all);
      setError(null);
    } catch (err) {
      console.warn("Kunne ikke hente opgøret:", err);
      setError("Kunne ikke hente opgøret. Prøv igen om lidt.");
    }
  }, [id]);

  useEffect(() => {
    load();
    // Opdater live, når andre registrerer kampe eller tilføjer spillere
    const channel = supabase
      .channel("opgor-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `session_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_results" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  if (session === undefined) return <p className="panel-hint loading">{error || "Indlæser…"}</p>;
  if (session === null) {
    return (
      <section className="panel">
        <p className="panel-hint">Opgøret findes ikke længere.</p>
        <Link to="/">← Tilbage til opgør</Link>
      </section>
    );
  }

  async function handleSaveMatch(winnerId, results) {
    await saveMatch(id, winnerId, results);
    await load();
  }

  async function handleUndo() {
    const last = matches[matches.length - 1];
    if (!last || !confirm("Fortryd den senest registrerede kamp?")) return;
    const { error } = await supabase.from("matches").delete().eq("id", last.id);
    if (error) {
      console.warn("Kunne ikke fortryde:", error);
      alert("Kunne ikke fortryde kampen. Prøv igen.");
    }
    load();
  }

  async function handleDelete() {
    if (!confirm(`Slet opgøret "${session.name}" og al dets kamp-historik permanent? Spillerne bliver ikke slettet.`)) return;
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) {
      console.warn("Kunne ikke slette opgøret:", error);
      alert("Kunne ikke slette opgøret. Prøv igen.");
      return;
    }
    navigate("/");
  }

  return (
    <>
      <section className="panel session-head">
        <p className="session-title">{session.name}</p>
        <p className="panel-hint">
          {players.length} spillere · {matches.length} kampe
        </p>
        <div className="tabs">
          <NavLink to={"/opgor/" + id} end className="tab">Scoreboard</NavLink>
          <NavLink to={"/opgor/" + id + "/statistik"} className="tab">Statistik</NavLink>
        </div>
      </section>

      {error && <p className="gate-error">{error}</p>}

      {showStats ? (
        <StatsView players={players} matches={matches} />
      ) : (
        <>
          <section className="panel">
            <p className="panel-title">Spillere</p>
            <p className="panel-hint">Tilføj alle der er med, når som helst.</p>
            <SessionPlayers sessionId={id} players={players} allPlayers={allPlayers} matches={matches} onChange={load} />
          </section>

          <section className="panel">
            <p className="panel-title">All-time stilling</p>
            <p className="panel-hint">Samlet på tværs af alle kampe i dette opgør. Klik en spiller for detaljer.</p>
            <Leaderboard players={players} matches={matches} />
          </section>

          <section className="panel">
            <p className="panel-title">Registrér afsluttet kamp</p>
            <p className="panel-hint">Afkryds hvem der var med, og indtast slutresultatet for hele kampen.</p>
            <MatchForm players={players} onSave={handleSaveMatch} />
          </section>

          <section className="panel">
            <div className="history-head">
              <button className="history-toggle" type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>
                <svg className={"chev" + (historyOpen ? " open" : "")} width="10" height="10" viewBox="0 0 10 10">
                  <path d="M2 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                Kamp-historik
              </button>
              <button type="button" className="btn-ghost" onClick={handleUndo} disabled={!matches.length}>
                Fortryd sidste kamp
              </button>
            </div>
            {historyOpen && (
              <div className="history-scroll">
                <MatchHistory players={players} matches={matches} />
              </div>
            )}
          </section>

          <div className="form-actions">
            <button type="button" className="btn-danger" onClick={handleDelete}>Slet dette opgør</button>
            <Link to="/" className="btn-ghost btn-link">← Alle opgør</Link>
          </div>
        </>
      )}
    </>
  );
}

// Spillerne i opgøret: tilføj en eksisterende spiller eller opret en ny gæst.
function SessionPlayers({ sessionId, players, allPlayers, matches, onChange }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inSession = new Set(players.map((p) => p.id));
  const available = allPlayers.filter((p) => !inSession.has(p.id));
  const matchCount = (pid) => matches.filter((m) => m.results[pid]).length;

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      // Findes spilleren allerede (samme navn), genbruges den. Ellers oprettes en ny gæst.
      let player = allPlayers.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (player && inSession.has(player.id)) {
        setError(`${player.name} er allerede med.`);
        setBusy(false);
        return;
      }
      if (!player) {
        const { data, error } = await supabase.from("players").insert({ name: trimmed }).select("id").single();
        if (error) throw error;
        player = data;
      }
      const { error } = await supabase.from("session_players").insert({ session_id: sessionId, player_id: player.id });
      if (error) throw error;
      setName("");
      onChange();
    } catch (err) {
      console.warn("Kunne ikke tilføje spiller:", err);
      setError("Kunne ikke tilføje spilleren. Prøv igen.");
    }
    setBusy(false);
  }

  async function handleRemove(player) {
    if (!confirm(`Fjern ${player.name} fra opgøret?`)) return;
    const { error } = await supabase.from("session_players").delete().eq("session_id", sessionId).eq("player_id", player.id);
    if (error) {
      console.warn("Kunne ikke fjerne spiller:", error);
      setError("Kunne ikke fjerne spilleren. Prøv igen.");
    }
    onChange();
  }

  return (
    <>
      <form className="player-add-row" onSubmit={handleAdd}>
        <input
          type="text"
          list="kendte-spillere"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vælg eller skriv et spillernavn"
          maxLength={40}
          autoComplete="off"
        />
        <datalist id="kendte-spillere">
          {available.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
        <button type="submit" className="btn-ghost" disabled={busy || !name.trim()}>Tilføj</button>
      </form>
      {error && <p className="gate-error">{error}</p>}
      <div className="player-chip-list">
        {players.length === 0 && <span className="setup-empty">Ingen spillere endnu.</span>}
        {players.map((p) => {
          const count = matchCount(p.id);
          return (
            <span key={p.id} className="player-chip">
              <Avatar player={p} size={24} />
              {p.name}
              <span className="n">{count}</span>
              {count === 0 && (
                <button type="button" className="btn-icon" aria-label={"Fjern " + p.name} onClick={() => handleRemove(p)}>
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
    </>
  );
}
