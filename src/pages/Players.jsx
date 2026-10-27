import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { supabase } from "../supabase.js";
import Avatar from "../components/Avatar.jsx";

export default function Players() {
  const { user } = useAuth();
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("players")
      .select("id, name, avatar_url, user_id, match_results(count)")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          console.warn("Kunne ikke hente spillere:", error);
          setError("Kunne ikke hente spillerne. Prøv igen om lidt.");
        } else {
          setPlayers(data);
        }
      });
  }, []);

  return (
    <>
      <section className="panel notice">
        <p className="panel-hint">
          Den nye version er under opbygning. Opgør og kampe registreres indtil videre på{" "}
          <a href="https://pedribd.github.io/super-pillars-scoreboard/">den gamle side</a>.
        </p>
      </section>

      <section className="panel">
        <p className="panel-title">Spillere</p>
        <p className="panel-hint">Alle spillere på tværs af opgør. Klik for at se profilen.</p>
        {error && <p className="gate-error">{error}</p>}
        {players === null && !error && <p className="panel-hint">Indlæser…</p>}
        <div className="player-list">
          {players?.map((p) => (
            <Link key={p.id} to={"/spiller/" + p.id} className="player-row">
              <Avatar player={p} size={44} />
              <span className="player-row-main">
                <span className="player-row-name">
                  {p.name}
                  {p.user_id === user.id && <span className="badge badge-me">Dig</span>}
                  {!p.user_id && <span className="badge">Gæst</span>}
                </span>
                <span className="player-row-meta">{p.match_results[0]?.count ?? 0} kampe</span>
              </span>
              <span className="session-card-chevron">›</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
