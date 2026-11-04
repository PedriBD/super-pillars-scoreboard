import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { fetchMainSessionId, fetchMatches, fetchPlayers, saveMatch } from "../lib/data.js";
import Avatar from "../components/Avatar.jsx";
import Leaderboard from "../components/Leaderboard.jsx";
import MatchForm from "../components/MatchForm.jsx";
import MatchHistory from "../components/MatchHistory.jsx";

// Forsiden: ét fælles scoreboard med alle spillere og alle kampe.
export default function Scoreboard() {
  const [sessionId, setSessionId] = useState(null);
  const [players, setPlayers] = useState(null);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sid, p, m] = await Promise.all([fetchMainSessionId(), fetchPlayers(), fetchMatches()]);
      setSessionId(sid);
      setPlayers(p);
      setMatches(m);
      setError(null);
    } catch (err) {
      console.warn("Kunne ikke hente scoreboardet:", err);
      setError("Kunne ikke hente scoreboardet. Prøv igen om lidt.");
    }
  }, []);

  useEffect(() => {
    load();
    // Opdater live, når andre registrerer kampe eller tilføjer spillere
    const channel = supabase
      .channel("scoreboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_results" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  if (players === null) return <p className="panel-hint loading">{error || "Indlæser…"}</p>;

  async function handleSaveMatch(winnerId, results) {
    await saveMatch(sessionId, winnerId, results);
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

  return (
    <>
      {error && <p className="gate-error">{error}</p>}

      <section className="panel">
        <p className="panel-title">All-time stilling</p>
        <p className="panel-hint">{matches.length} kampe i alt. Klik en spiller for detaljer.</p>
        <Leaderboard players={players} matches={matches} />
      </section>

      <section className="panel">
        <p className="panel-title">Registrér afsluttet kamp</p>
        <p className="panel-hint">Afkryds hvem der var med, og indtast slutresultatet for hele kampen.</p>
        <MatchForm players={players} onSave={handleSaveMatch} />
      </section>

      <section className="panel">
        <p className="panel-title">Spillere</p>
        <p className="panel-hint">Er der en ny med, så tilføj dem her.</p>
        <AddPlayer players={players} matches={matches} onChange={load} />
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
    </>
  );
}

// Tilføj en ny gæst. Gæster uden kampe kan fjernes igen.
function AddPlayer({ players, matches, onChange }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const matchCount = (pid) => matches.filter((m) => m.results[pid]).length;

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`${trimmed} er allerede med.`);
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("players").insert({ name: trimmed });
    setBusy(false);
    if (error) {
      console.warn("Kunne ikke tilføje spiller:", error);
      setError("Kunne ikke tilføje spilleren. Prøv igen.");
      return;
    }
    setName("");
    onChange();
  }

  async function handleRemove(player) {
    if (!confirm(`Fjern ${player.name}?`)) return;
    const { error } = await supabase.from("players").delete().eq("id", player.id);
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Navn på ny spiller"
          maxLength={40}
          autoComplete="off"
        />
        <button type="submit" className="btn-ghost" disabled={busy || !name.trim()}>Tilføj</button>
      </form>
      {error && <p className="gate-error">{error}</p>}
      <div className="player-chip-list">
        {players.map((p) => {
          const count = matchCount(p.id);
          return (
            <span key={p.id} className="player-chip">
              <Avatar player={p} size={24} />
              {p.name}
              <span className="n">{count}</span>
              {count === 0 && !p.user_id && (
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
