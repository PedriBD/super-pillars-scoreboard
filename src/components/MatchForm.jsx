import { useEffect, useState } from "react";
import { decideWinner } from "../lib/stats.js";

// Formular til at registrere en afsluttet kamp.
export default function MatchForm({ players, onSave }) {
  const [rows, setRows] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Ny tom række for hver spiller, når spillerne ændrer sig
  const playerKey = players.map((p) => p.id).join(",");
  useEffect(() => {
    setRows((prev) =>
      Object.fromEntries(players.map((p) => [p.id, prev[p.id] || { active: true, roundWins: "", elim: "", dmg: "" }]))
    );
  }, [playerKey]);

  function update(pid, field, value) {
    setRows((prev) => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const active = players.filter((p) => rows[p.id]?.active);
    if (active.length < 2) {
      setError("Afkryds mindst to spillere, der var med i kampen.");
      return;
    }
    const results = Object.fromEntries(
      active.map((p) => [
        p.id,
        {
          roundWins: Math.max(0, Math.round(Number(rows[p.id].roundWins) || 0)),
          elim: Math.max(0, Math.round(Number(rows[p.id].elim) || 0)),
          dmg: Math.max(0, Math.round(Number(rows[p.id].dmg) || 0)),
        },
      ])
    );
    setBusy(true);
    setError(null);
    try {
      await onSave(decideWinner(results), results);
      setRows(Object.fromEntries(players.map((p) => [p.id, { active: rows[p.id].active, roundWins: "", elim: "", dmg: "" }])));
    } catch (err) {
      console.warn("Kunne ikke gemme kampen:", err);
      setError("Kunne ikke gemme kampen. Prøv igen.");
    }
    setBusy(false);
  }

  if (players.length < 2) return <p className="setup-empty">Tilføj mindst to spillere for at registrere en kamp.</p>;

  return (
    <form onSubmit={handleSubmit}>
      <table className="round-table">
        <thead>
          <tr>
            <th>Spiller</th>
            <th className="num">Sejre</th>
            <th className="num">Elims</th>
            <th className="num">Damage</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const row = rows[p.id] || { active: true, roundWins: "", elim: "", dmg: "" };
            return (
              <tr key={p.id} className={row.active ? "" : "is-inactive"}>
                <td className="name">
                  <label>
                    <input type="checkbox" checked={row.active} onChange={(e) => update(p.id, "active", e.target.checked)} />
                    {p.name}
                  </label>
                </td>
                {["roundWins", "elim", "dmg"].map((field) => (
                  <td key={field} className="num">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={row[field]}
                      disabled={!row.active}
                      onChange={(e) => update(p.id, field, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="form-actions">
        <span className="gate-error">{error}</span>
        <button type="submit" className="btn-primary" disabled={busy}>Gem kamp</button>
      </div>
    </form>
  );
}
