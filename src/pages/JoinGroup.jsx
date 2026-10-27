import { useState } from "react";
import { signOut, useAuth } from "../auth.jsx";
import { supabase } from "../supabase.js";

// Første gang en bruger logger ind, skal de indtaste gruppekoden.
// Så kan fremmede, der opretter en bruger, ikke se eller ændre jeres data.
export default function JoinGroup() {
  const { user, refresh } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("join_with_code", { code });
    setBusy(false);
    if (error) {
      console.warn("Gruppekode fejlede:", error);
      setError("Noget gik galt. Prøv igen om lidt.");
    } else if (data !== true) {
      setError("Forkert gruppekode.");
    } else {
      refresh();
    }
  }

  return (
    <section className="panel">
      <p className="panel-title">Gruppekode</p>
      <p className="panel-hint">
        Hej {user?.user_metadata?.full_name || user?.email}! Skriv gruppekoden for at blive en del af Super Pillars.
        Det skal kun gøres én gang.
      </p>
      <form className="join-row" onSubmit={handleSubmit}>
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Gruppekode" autoComplete="off" />
        <button type="submit" className="btn-primary" disabled={busy}>Fortsæt</button>
      </form>
      {error && <p className="gate-error">{error}</p>}
      <button type="button" className="btn-link-plain" onClick={signOut}>Log ud</button>
    </section>
  );
}
