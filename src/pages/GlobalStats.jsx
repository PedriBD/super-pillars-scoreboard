import { useEffect, useState } from "react";
import { fetchMatches, fetchPlayers } from "../lib/data.js";
import StatsView from "../components/StatsView.jsx";
import Leaderboard from "../components/Leaderboard.jsx";

// Fælles statistik på tværs af alle opgør.
export default function GlobalStats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchPlayers(), fetchMatches()])
      .then(([players, matches]) => {
        // Kun spillere, der har spillet mindst én kamp
        const played = new Set(matches.flatMap((m) => Object.keys(m.results)));
        setData({ players: players.filter((p) => played.has(p.id)), matches });
      })
      .catch((err) => {
        console.warn("Kunne ikke hente statistik:", err);
        setError("Kunne ikke hente statistikken. Prøv igen om lidt.");
      });
  }, []);

  if (error) return <p className="gate-error">{error}</p>;
  if (!data) return <p className="panel-hint loading">Indlæser…</p>;

  const sessionCount = new Set(data.matches.map((m) => m.sessionId)).size;

  return (
    <>
      <section className="panel">
        <p className="panel-title">Fælles statistik</p>
        <p className="panel-hint">
          På tværs af alle opgør: {data.matches.length} kampe i {sessionCount} opgør.
        </p>
        <Leaderboard players={data.players} matches={data.matches} />
      </section>
      <StatsView players={data.players} matches={data.matches} />
    </>
  );
}
