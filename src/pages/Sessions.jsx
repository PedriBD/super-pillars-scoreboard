import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase.js";
import { formatDateTime } from "../lib/stats.js";

export default function Sessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("sessions")
      .select("id, name, created_at, matches(played_at), session_players(count)")
      .then(({ data, error }) => {
        if (error) {
          console.warn("Kunne ikke hente opgør:", error);
          setError("Kunne ikke hente opgørene. Prøv igen om lidt.");
          return;
        }
        // Senest spillede opgør øverst
        const withLast = data.map((s) => ({
          ...s,
          lastActivity: s.matches.reduce((max, m) => (m.played_at > max ? m.played_at : max), s.created_at),
        }));
        withLast.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
        setSessions(withLast);
      });
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.from("sessions").insert({ name: trimmed }).select("id").single();
    setBusy(false);
    if (error) {
      console.warn("Kunne ikke oprette opgør:", error);
      setError("Kunne ikke oprette opgøret. Prøv igen.");
      return;
    }
    navigate("/opgor/" + data.id);
  }

  return (
    <section className="panel">
      <p className="panel-title">Opgør</p>
      <p className="panel-hint">Vælg et opgør, eller start et nyt.</p>
      {sessions === null && !error && <p className="panel-hint">Indlæser…</p>}
      {sessions?.length === 0 && <p className="setup-empty">Ingen opgør endnu. Opret det første herunder.</p>}
      <div className="session-list">
        {sessions?.map((s) => (
          <Link key={s.id} to={"/opgor/" + s.id} className="session-card">
            <div>
              <p className="session-card-name">{s.name}</p>
              <p className="session-card-meta">
                {s.session_players[0]?.count ?? 0} spillere · {s.matches.length} kampe · senest {formatDateTime(s.lastActivity)}
              </p>
            </div>
            <span className="session-card-chevron">›</span>
          </Link>
        ))}
      </div>
      <form className="join-row" style={{ marginTop: 14 }} onSubmit={handleCreate}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn på nyt opgør, fx Fredagsgutterne" maxLength={40} />
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>Opret nyt opgør</button>
      </form>
      {error && <p className="gate-error">{error}</p>}
    </section>
  );
}
