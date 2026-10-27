import { formatDateTime } from "../lib/stats.js";

// Liste over kampe, nyeste først.
export default function MatchHistory({ players, matches }) {
  if (!matches.length) return <p className="setup-empty">Ingen kampe registreret endnu.</p>;
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));

  return (
    <div className="match-list">
      {matches
        .slice()
        .reverse()
        .map((m) => (
          <div key={m.id} className="match-card">
            <div className="match-card-head">
              <span>{formatDateTime(m.playedAt)}</span>
              {m.winnerId && byId[m.winnerId] ? <b>{byId[m.winnerId].name} vandt</b> : <span>Uafgjort</span>}
            </div>
            <div className="match-players">
              {Object.entries(m.results)
                .filter(([pid]) => byId[pid])
                .sort((a, b) => b[1].roundWins - a[1].roundWins)
                .map(([pid, r]) => (
                  <div key={pid} className={"match-player-row" + (pid === m.winnerId ? " is-winner" : "")}>
                    <span className="mp-name">
                      {byId[pid].name}
                      {pid === m.winnerId && " 🏆"}
                    </span>
                    <span>
                      {r.roundWins} sejre · {r.elim} elim · {r.dmg} dmg
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
    </div>
  );
}
