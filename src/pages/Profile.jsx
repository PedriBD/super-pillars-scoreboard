import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { supabase } from "../supabase.js";
import { resizeImage } from "../lib/image.js";
import Avatar from "../components/Avatar.jsx";
import PlayerStats from "../components/PlayerStats.jsx";
import { fetchMatches } from "../lib/data.js";

export default function Profile() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const fileInput = useRef(null);
  const [player, setPlayer] = useState(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [matches, setMatches] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("players")
      .select("*, session_players(sessions(name)), match_results(count)")
      .eq("id", id).maybeSingle();
    if (error) {
      console.warn("Kunne ikke hente spilleren:", error);
      setMessage({ error: true, text: "Kunne ikke hente spilleren. Prøv igen om lidt." });
      return;
    }
    setPlayer(data);
    setName(data?.name || "");
  }, [id]);

  useEffect(() => {
    setMessage(null);
    load();
    fetchMatches()
      .then(setMatches)
      .catch((err) => console.warn("Kunne ikke hente kampe:", err));
  }, [load]);

  if (player === undefined) return <p className="panel-hint">{message?.text || "Indlæser…"}</p>;
  if (player === null) {
    return (
      <section className="panel">
        <p className="panel-hint">Spilleren findes ikke længere.</p>
        <Link to="/spillere">← Tilbage til spillere</Link>
      </section>
    );
  }

  const isMe = player.user_id === user.id;
  const isGuest = !player.user_id;
  const canEdit = isMe || isGuest;

  // Gemmer ændringer og tjekker, at databasen faktisk opdaterede rækken
  async function save(changes, okText) {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.from("players").update(changes).eq("id", player.id).select();
    setBusy(false);
    if (error || !data?.length) {
      console.warn("Kunne ikke gemme:", error);
      setMessage({ error: true, text: "Kunne ikke gemme ændringen. Prøv igen." });
      return false;
    }
    setPlayer((prev) => ({ ...prev, ...data[0] }));
    setMessage({ text: okText });
    if (isMe) refresh();
    return true;
  }

  async function handleRename(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === player.name) return;
    await save({ name: trimmed }, "Navnet er gemt.");
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await resizeImage(file);
      const path = `${player.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await save({ avatar_url: data.publicUrl }, "Profilbilledet er opdateret.");
    } catch (err) {
      console.warn("Upload fejlede:", err);
      setBusy(false);
      setMessage({ error: true, text: "Kunne ikke uploade billedet. Prøv et andet billede." });
    }
  }

  return (
    <>
      <section className="panel profile-head">
        <Avatar player={player} size={112} />
        <div>
          <p className="pd-name">{player.name}</p>
          <p className="pd-sub">
            {isMe ? "Din profil" : isGuest ? "Gæst – ikke koblet til en bruger endnu" : "Spiller"}
          </p>
          <p className="pd-sub">
            {player.match_results?.[0]?.count ?? 0} kampe
            {" · "}
            {player.session_players?.map((sp) => sp.sessions?.name).filter(Boolean).join(", ") || "Ingen opgør"}
          </p>
        </div>
      </section>

      {canEdit && (
        <section className="panel">
          <p className="panel-title">Rediger</p>
          <form className="join-row" onSubmit={handleRename}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Navn" />
            <button type="submit" className="btn-primary" disabled={busy || !name.trim() || name.trim() === player.name}>
              Gem navn
            </button>
          </form>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => fileInput.current.click()} disabled={busy}>
              Skift profilbillede
            </button>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleFile} />
          </div>
          {message && <p className={message.error ? "gate-error" : "save-ok"}>{message.text}</p>}
        </section>
      )}

      {matches && <PlayerStats playerId={player.id} matches={matches} />}

      <div className="form-actions">
        <span></span>
        <Link to="/spillere" className="btn-ghost btn-link">← Alle spillere</Link>
      </div>
    </>
  );
}
