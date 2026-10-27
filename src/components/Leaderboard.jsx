import { useNavigate } from "react-router-dom";
import { computeStandings } from "../lib/stats.js";
import Avatar from "./Avatar.jsx";

// All-time stilling med top 3 som rarity-kort.
export default function Leaderboard({ players, matches }) {
  const navigate = useNavigate();
  const standings = computeStandings(players, matches);
  if (standings.length === 0) return <span className="setup-empty">Ingen spillere endnu.</span>;

  return (
    <div className="leaderboard">
      {standings.map((s, i) => {
        const rankClass = s.matchesWon > 0 ? [" is-leader", " is-second", " is-third"][i] || "" : "";
        const open = () => navigate("/spiller/" + s.id);
        return (
          <div
            key={s.id}
            className={"lb-row" + rankClass}
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
          >
            <div className="lb-rank">{i + 1}</div>
            <div className="lb-main">
              <div className="lb-name">
                <Avatar player={s.player} size={28} />
                <span className="lb-name-text">{s.name}</span>
              </div>
              <div className="lb-stats">
                <span>{s.totalRoundWins} runde-sejre</span>
                <span className="elim">{s.totalElim} elims</span>
                <span className="dmg">{s.totalDmg.toLocaleString("da-DK")} dmg</span>
              </div>
            </div>
            <div className="lb-score">
              {s.matchesWon}
              <small>kampe vundet</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
