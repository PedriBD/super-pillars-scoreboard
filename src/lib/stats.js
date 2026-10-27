// Statistik beregnet ud fra en liste af spillere og kampe (se fetchMatches).
// Bruges både i et enkelt opgør og på tværs af alle opgør.

export function computeStandings(players, matches) {
  const byId = {};
  players.forEach((p) => {
    byId[p.id] = {
      id: p.id, name: p.name, player: p,
      matchesPlayed: 0, matchesWon: 0,
      totalRoundWins: 0, totalElim: 0, totalDmg: 0,
    };
  });
  matches.forEach((m) => {
    Object.entries(m.results).forEach(([pid, r]) => {
      const row = byId[pid];
      if (!row) return;
      row.matchesPlayed += 1;
      row.totalRoundWins += r.roundWins;
      row.totalElim += r.elim;
      row.totalDmg += r.dmg;
    });
    if (m.winnerId && byId[m.winnerId]) byId[m.winnerId].matchesWon += 1;
  });
  return Object.values(byId).sort((a, b) => {
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    if (b.totalRoundWins !== a.totalRoundWins) return b.totalRoundWins - a.totalRoundWins;
    if (b.totalElim !== a.totalElim) return b.totalElim - a.totalElim;
    return a.name.localeCompare(b.name);
  });
}

export function computeStatBoards(players, matches) {
  const base = computeStandings(players, matches).map((s) => ({
    ...s,
    winRate: s.matchesPlayed ? (s.matchesWon / s.matchesPlayed) * 100 : 0,
    avgElim: s.matchesPlayed ? s.totalElim / s.matchesPlayed : 0,
    avgDmg: s.matchesPlayed ? s.totalDmg / s.matchesPlayed : 0,
  }));

  function topBy(key, opts = {}) {
    const minMatches = opts.minMatches || 0;
    return base
      .filter((p) => p.matchesPlayed >= minMatches)
      .slice()
      .sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name))
      .filter((p) => p[key] > 0 || opts.allowZero)
      .slice(0, 5);
  }

  return [
    { icon: "🏆", title: "Flest kampe vundet", unit: "kampe vundet", rows: topBy("matchesWon"), key: "matchesWon", cls: "gold" },
    { icon: "📈", title: "Højeste sejrsrate", unit: "% sejre (min. 2 kampe)", rows: topBy("winRate", { minMatches: 2 }), key: "winRate", cls: "gold", suffix: "%", round: true },
    { icon: "🎯", title: "Flest runde-sejre i alt", unit: "runde-sejre", rows: topBy("totalRoundWins"), key: "totalRoundWins", cls: "accent" },
    { icon: "⚔️", title: "Flest eliminations i alt", unit: "eliminations", rows: topBy("totalElim"), key: "totalElim", cls: "elim" },
    { icon: "💥", title: "Mest damage i alt", unit: "damage dealt", rows: topBy("totalDmg"), key: "totalDmg", cls: "dmg" },
    { icon: "🔪", title: "Bedste snit eliminations", unit: "elim / kamp i snit", rows: topBy("avgElim"), key: "avgElim", cls: "elim", round1: true },
    { icon: "🔥", title: "Bedste snit damage", unit: "damage / kamp i snit", rows: topBy("avgDmg"), key: "avgDmg", cls: "dmg", round: true },
    { icon: "🎮", title: "Flest kampe spillet", unit: "kampe spillet", rows: topBy("matchesPlayed", { allowZero: true }), key: "matchesPlayed", cls: "" },
  ];
}

export function computeRecords(players, matches) {
  const byId = {};
  players.forEach((p) => { byId[p.id] = p; });

  let bestElim = null, bestDmg = null, bestWins = null;
  matches.forEach((m) => {
    Object.entries(m.results).forEach(([pid, r]) => {
      if (!byId[pid]) return;
      if (!bestElim || r.elim > bestElim.value) bestElim = { value: r.elim, player: byId[pid], date: m.playedAt };
      if (!bestDmg || r.dmg > bestDmg.value) bestDmg = { value: r.dmg, player: byId[pid], date: m.playedAt };
      if (!bestWins || r.roundWins > bestWins.value) bestWins = { value: r.roundWins, player: byId[pid], date: m.playedAt };
    });
  });

  // Længste sejrsstime: flest kampe vundet i træk (kun kampe spilleren var med i)
  let bestStreak = null;
  const ordered = matches.slice().sort((a, b) => String(a.playedAt).localeCompare(String(b.playedAt)));
  players.forEach((p) => {
    let streak = 0;
    ordered.forEach((m) => {
      if (!m.results[p.id]) return;
      streak = m.winnerId === p.id ? streak + 1 : 0;
      if (streak > 0 && (!bestStreak || streak > bestStreak.value)) {
        bestStreak = { value: streak, player: p, date: m.playedAt };
      }
    });
  });

  return { bestElim, bestDmg, bestWins, bestStreak };
}

export function computePlayerDetail(playerId, matches) {
  const playerMatches = matches
    .filter((m) => m.results[playerId])
    .map((m) => ({ ...m, r: m.results[playerId] }));

  const matchesPlayed = playerMatches.length;
  const matchesWon = playerMatches.filter((m) => m.winnerId === playerId).length;
  const sum = (key) => playerMatches.reduce((total, m) => total + m.r[key], 0);
  const totalRoundWins = sum("roundWins");
  const totalElim = sum("elim");
  const totalDmg = sum("dmg");
  const avg = (total) => (matchesPlayed ? total / matchesPlayed : 0);

  return {
    matchesPlayed, matchesWon,
    winRate: matchesPlayed ? Math.round((matchesWon / matchesPlayed) * 100) : 0,
    totalRoundWins, totalElim, totalDmg,
    avgRoundWins: avg(totalRoundWins), avgElim: avg(totalElim), avgDmg: avg(totalDmg),
    bestElim: Math.max(0, ...playerMatches.map((m) => m.r.elim)),
    bestDmg: Math.max(0, ...playerMatches.map((m) => m.r.dmg)),
    recentMatches: playerMatches.slice().reverse().slice(0, 8),
  };
}

// Vinderen er den med flest runde-sejre. Ved lighed afgør eliminations, dernæst damage.
// Er der stadig lighed (eller har ingen vundet en runde), er kampen uafgjort (null).
export function decideWinner(results) {
  const entries = Object.entries(results).map(([pid, r]) => ({ pid, ...r }));
  entries.sort((a, b) => b.roundWins - a.roundWins || b.elim - a.elim || b.dmg - a.dmg);
  const [first, second] = entries;
  if (!first || first.roundWins === 0) return null;
  if (second && first.roundWins === second.roundWins && first.elim === second.elim && first.dmg === second.dmg) return null;
  return first.pid;
}

export function fmt0(n) {
  return Math.round(n).toLocaleString("da-DK");
}

export function fmt1(n) {
  return (Math.round(n * 10) / 10).toLocaleString("da-DK");
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString("da-DK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}
