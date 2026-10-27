import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import Avatar from "./Avatar.jsx";

// Vises på din egen profil: læg gæster sammen med dig, hvis du har spillet
// under et andet navn i et andet opgør.
export default function MergeGuests({ onMerged }) {
  const [guests, setGuests] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, avatar_url, session_players(sessions(name)), match_results(count)")
      .is("user_id", null)
      .order("name");
    if (error) {
      console.warn("Kunne ikke hente gæster:", error);
      setError("Kunne ikke hente spillerne. Prøv igen om lidt.");
      setGuests([]);
    } else {
      setGuests(data);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function merge(guest) {
    const ok = confirm(
      `Er "${guest.name}" også dig? Kampe og opgør fra "${guest.name}" bliver lagt sammen med din profil, og "${guest.name}" forsvinder. Det kan ikke fortrydes.`
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("claim_player", { p_guest: guest.id });
    setBusy(false);
    if (error) {
      console.warn("Sammenlægning fejlede:", error);
      setError("Kunne ikke lægge spillerne sammen. Prøv igen.");
      return;
    }
    load();
    onMerged?.();
  }

  if (guests?.length === 0 && !error) return null;

  return (
    <section className="panel">
      <p className="panel-title">Har du spillet under andre navne?</p>
      <p className="panel-hint">
        Hvis en af disse spillere også er dig, så læg dem sammen. Så samles alle dine kampe på tværs af opgør på din profil.
      </p>
      {guests === null && <p className="panel-hint">Indlæser…</p>}
      <div className="player-list">
        {guests?.map((g) => (
          <button key={g.id} type="button" className="player-row" onClick={() => merge(g)} disabled={busy}>
            <Avatar player={g} size={40} />
            <span className="player-row-main">
              <span className="player-row-name">{g.name}</span>
              <span className="player-row-meta">
                {g.session_players.map((sp) => sp.sessions?.name).filter(Boolean).join(", ") || "Ingen opgør"}
                {" · "}
                {g.match_results[0]?.count ?? 0} kampe
              </span>
            </span>
            <span className="player-row-action">Læg sammen</span>
          </button>
        ))}
      </div>
      {error && <p className="gate-error">{error}</p>}
    </section>
  );
}
