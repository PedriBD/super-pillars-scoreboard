import { computePlayerDetail, fmt0, fmt1, formatDateTime } from "../lib/stats.js";

// En spillers statistik på tværs af de kampe, der gives med.
export default function PlayerStats({ playerId, matches }) {
  const d = computePlayerDetail(playerId, matches);
  if (d.matchesPlayed === 0) {
    return (
      <section className="panel">
        <p className="panel-title">Statistik</p>
        <p className="setup-empty">Ingen kampe spillet endnu.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="panel-title">Statistik</p>
      <p className="panel-hint">
        {d.matchesPlayed} {d.matchesPlayed === 1 ? "kamp" : "kampe"} spillet · {d.matchesWon} vundet · {d.winRate}% sejrsrate
      </p>
      <div className="pd-stat-grid">
        <Stat label="Snit runde-sejre / kamp" value={fmt1(d.avgRoundWins)} cls="gold" />
        <Stat label="Snit eliminations / kamp" value={fmt1(d.avgElim)} cls="elim" />
        <Stat label="Snit damage / kamp" value={fmt0(d.avgDmg)} cls="dmg" />
        <Stat label="Samlede runde-sejre" value={d.totalRoundWins} />
        <Stat label="Flest elim i én kamp" value={d.bestElim} cls="elim" />
        <Stat label="Mest damage i én kamp" value={d.bestDmg.toLocaleString("da-DK")} cls="dmg" />
      </div>
      <p className="pd-section-title">Seneste kampe</p>
      <div className="pd-matches">
        {d.recentMatches.map((m) => {
          const won = m.winnerId === playerId;
          return (
            <div key={m.id} className={"match-player-row" + (won ? " is-winner" : "")}>
              <span className="mp-name">
                {formatDateTime(m.playedAt)}
                {won && " 🏆"}
              </span>
              <span>
                {m.r.roundWins} sejre · {m.r.elim} elim · {m.r.dmg} dmg
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ label, value, cls }) {
  return (
    <div className="pd-stat">
      <div className="pd-stat-label">{label}</div>
      <div className={"pd-stat-value" + (cls ? " " + cls : "")}>{value}</div>
    </div>
  );
}
