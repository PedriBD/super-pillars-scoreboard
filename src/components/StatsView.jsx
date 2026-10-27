import { Link } from "react-router-dom";
import { computeRecords, computeStandings, computeStatBoards, formatDateTime } from "../lib/stats.js";
import Avatar from "./Avatar.jsx";

// Podie, rekorder og ranglister for en given samling spillere og kampe.
export default function StatsView({ players, matches }) {
  return (
    <>
      <section className="panel">
        <p className="panel-title">Podiet</p>
        <p className="panel-hint">Flest kampe vundet.</p>
        <Podium players={players} matches={matches} />
      </section>

      <section className="panel">
        <p className="panel-title">Rekorder</p>
        <p className="panel-hint">De bedste præstationer nogensinde.</p>
        <Records players={players} matches={matches} />
      </section>

      <div className="stat-board-grid">
        {computeStatBoards(players, matches).map((board) => (
          <StatBoard key={board.key} board={board} />
        ))}
      </div>
    </>
  );
}

function Podium({ players, matches }) {
  const top = computeStandings(players, matches).filter((s) => s.matchesWon > 0).slice(0, 3);
  if (top.length === 0) return <span className="stat-board-empty">Ingen kampe vundet endnu.</span>;
  // Vis i rækkefølgen 2 – 1 – 3, som et rigtigt podie
  const places = [
    { s: top[1], place: 2, cls: "epic" },
    { s: top[0], place: 1, cls: "legendary" },
    { s: top[2], place: 3, cls: "rare" },
  ];
  return (
    <div className="podium">
      {places.map(({ s, place, cls }) =>
        s ? (
          <Link key={place} to={"/spiller/" + s.id} className={"podium-spot " + cls}>
            {place === 1 && <span className="podium-crown">👑</span>}
            <Avatar player={s.player} size={place === 1 ? 64 : 52} />
            <p className="podium-name">{s.name}</p>
            <p className="podium-value">{s.matchesWon} {s.matchesWon === 1 ? "sejr" : "sejre"}</p>
            <div className="podium-block">{place}</div>
          </Link>
        ) : (
          <div key={place} className="podium-spot is-empty"></div>
        )
      )}
    </div>
  );
}

function Records({ players, matches }) {
  const records = computeRecords(players, matches);
  const cards = [
    { icon: "⚔️", label: "Flest eliminations i én kamp", data: records.bestElim, cls: "elim" },
    { icon: "💥", label: "Mest damage i én kamp", data: records.bestDmg, cls: "dmg" },
    { icon: "🎯", label: "Flest runde-sejre i én kamp", data: records.bestWins, cls: "gold" },
    { icon: "🔥", label: "Længste sejrsstime", data: records.bestStreak, cls: "streak", suffix: " i træk" },
  ];
  return (
    <div className="record-grid">
      {cards.map((r) => (
        <div key={r.label} className={"record-card " + r.cls + (r.data ? "" : " is-empty")}>
          <span className="record-icon">{r.icon}</span>
          <p className="record-label">{r.label}</p>
          {r.data ? (
            <>
              <p className="record-value">
                {r.data.value.toLocaleString("da-DK")}
                {r.suffix && <small>{r.suffix}</small>}
              </p>
              <p className="record-holder">{r.data.player.name}</p>
              <p className="record-meta">{formatDateTime(r.data.date)}</p>
            </>
          ) : (
            <p className="stat-board-empty">Ingen data endnu.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function formatValue(board, value) {
  if (board.round) return Math.round(value).toLocaleString("da-DK");
  if (board.round1) return (Math.round(value * 10) / 10).toLocaleString("da-DK");
  return value.toLocaleString("da-DK");
}

function StatBoard({ board }) {
  const max = board.rows.length ? board.rows[0][board.key] : 0;
  const cls = board.cls ? " " + board.cls : "";
  return (
    <div className="stat-board">
      <p className="stat-board-title">
        <span className="stat-board-icon">{board.icon}</span>
        {board.title}
      </p>
      <p className="stat-board-unit">{board.unit}</p>
      <div className="stat-board-list">
        {board.rows.length === 0 && <span className="stat-board-empty">Ingen data endnu.</span>}
        {board.rows.map((p, i) => (
          <div key={p.id} className={"stat-board-row" + (i === 0 ? " is-top" : "")}>
            <span className="sbr-rank">{i === 0 ? "👑" : i + 1}</span>
            <span className="sbr-name">{p.name}</span>
            <span className={"sbr-value" + cls}>
              {formatValue(board, p[board.key])}
              {board.suffix || ""}
            </span>
            <span className={"sbr-bar" + cls}>
              <span style={{ width: (max > 0 ? Math.max(4, Math.round((p[board.key] / max) * 100)) : 0) + "%" }}></span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
