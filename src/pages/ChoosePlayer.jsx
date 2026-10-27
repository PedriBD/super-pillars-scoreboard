import { useEffect, useState } from "react";
import { useAuth } from "../auth.jsx";
import { supabase } from "../supabase.js";
import Avatar from "../components/Avatar.jsx";

// Efter første login: er du en af de spillere, der allerede findes, eller er du ny?
export default function ChoosePlayer() {
  const { user, refresh } = useAuth();
  const [guests, setGuests] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const googleName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  const [name, setName] = useState(googleName);

  useEffect(() => {
    supabase
      .from("players")
      .select("id, name, avatar_url, session_players(sessions(name))")
      .is("user_id", null)
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          console.warn("Kunne ikke hente spillere:", error);
          setError("Kunne ikke hente spillerne. Prøv igen om lidt.");
          setGuests([]);
        } else {
          setGuests(data);
        }
      });
  }, []);

  async function claim(guest) {
    if (!confirm(`Er du "${guest.name}"? Spilleren bliver koblet til din Google-konto.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("claim_player", { p_guest: guest.id });
    setBusy(false);
    if (error) {
      console.warn("Kunne ikke vælge spiller:", error);
      setError("Kunne ikke koble spilleren til dig. Prøv igen.");
    } else {
      refresh();
    }
  }

  async function createNew(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_my_player", {
      p_name: name.trim(),
      p_avatar_url: user?.user_metadata?.avatar_url || null,
    });
    setBusy(false);
    if (error) {
      console.warn("Kunne ikke oprette spiller:", error);
      setError("Kunne ikke oprette din spiller. Prøv igen.");
    } else {
      refresh();
    }
  }

  return (
    <>
      <section className="panel">
        <p className="panel-title">Hvem er du?</p>
        <p className="panel-hint">
          Har du spillet med før, så vælg dig selv på listen. Så følger dine gamle kampe og statistik med.
        </p>
        {guests === null && <p className="panel-hint">Indlæser…</p>}
        {guests?.length === 0 && <p className="setup-empty">Der er ingen ledige spillere.</p>}
        <div className="player-list">
          {guests?.map((g) => (
            <button key={g.id} type="button" className="player-row" onClick={() => claim(g)} disabled={busy}>
              <Avatar player={g} size={44} />
              <span className="player-row-main">
                <span className="player-row-name">{g.name}</span>
                <span className="player-row-meta">
                  {g.session_players.map((sp) => sp.sessions?.name).filter(Boolean).join(", ") || "Ingen opgør"}
                </span>
              </span>
              <span className="player-row-action">Det er mig</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="panel-title">Jeg er ny</p>
        <p className="panel-hint">Opret en ny spiller med dit navn og dit Google-profilbillede.</p>
        <form className="join-row" onSubmit={createNew}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Dit spillernavn" />
          <button type="submit" className="btn-primary" disabled={busy}>Opret mig</button>
        </form>
      </section>

      {error && <p className="gate-error">{error}</p>}
    </>
  );
}
