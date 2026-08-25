import { supabase } from "./supabase-config.js";

const DEFAULT_STATE = { players: [], matches: [] };
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I

let state = { ...DEFAULT_STATE };
let currentRoom = null;
let channel = null;
let historyOpen = false;

/* ---------------- Room helpers ---------------- */
function getRoomFromUrl() {
  const params = new URLSearchParams(location.search);
  const r = params.get("room");
  return r ? r.toUpperCase() : null;
}

function setRoomInUrl(code) {
  const url = new URL(location.href);
  url.searchParams.set("room", code);
  history.replaceState(null, "", url.toString());
}

function clearRoomInUrl() {
  const url = new URL(location.href);
  url.searchParams.delete("room");
  history.replaceState(null, "", url.toString());
}

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("da-DK", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

/* ---------------- Element refs ---------------- */
const passwordGate = document.getElementById("passwordGate");
const passwordForm = document.getElementById("passwordForm");
const passwordInput = document.getElementById("passwordInput");
const passwordError = document.getElementById("passwordError");
const appRootEl = document.getElementById("appRoot");

const sessionListPanel = document.getElementById("sessionListPanel");
const sessionList = document.getElementById("sessionList");
const createSessionForm = document.getElementById("createSessionForm");
const newSessionName = document.getElementById("newSessionName");
const backToListBtn = document.getElementById("backToListBtn");
const mastheadSub = document.getElementById("mastheadSub");

const gamePanels = document.getElementById("gamePanels");
const statusPill = document.getElementById("statusPill");
const statusText = document.getElementById("statusText");

const addPlayerForm = document.getElementById("addPlayerForm");
const newPlayerName = document.getElementById("newPlayerName");
const playerChipList = document.getElementById("playerChipList");

const leaderboard = document.getElementById("leaderboard");

const matchForm = document.getElementById("matchForm");
const matchFormBody = document.getElementById("matchFormBody");

const historyToggle = document.getElementById("historyToggle");
const historyWrap = document.getElementById("historyWrap");
const undoMatchBtn = document.getElementById("undoMatchBtn");

const resetBtn = document.getElementById("resetBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");

const playerModalOverlay = document.getElementById("playerModalOverlay");
const playerModal = document.getElementById("playerModal");
const playerModalContent = document.getElementById("playerModalContent");
const playerModalClose = document.getElementById("playerModalClose");

/* ---------------- All-time standings ---------------- */
function computeStandings() {
  const byId = {};
  state.players.forEach((p) => {
    byId[p.id] = {
      id: p.id, name: p.name,
      matchesPlayed: 0, matchesWon: 0,
      totalRoundWins: 0, totalElim: 0, totalDmg: 0,
    };
  });
  state.matches.forEach((m) => {
    state.players.forEach((p) => {
      const r = m.results[p.id];
      if (!r) return;
      const row = byId[p.id];
      row.matchesPlayed += 1;
      row.totalRoundWins += Number(r.roundWins) || 0;
      row.totalElim += Number(r.elim) || 0;
      row.totalDmg += Number(r.dmg) || 0;
    });
    if (m.winnerId && byId[m.winnerId]) byId[m.winnerId].matchesWon += 1;
  });
  const list = state.players.map((p) => byId[p.id]);
  list.sort((a, b) => {
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    if (b.totalRoundWins !== a.totalRoundWins) return b.totalRoundWins - a.totalRoundWins;
    if (b.totalElim !== a.totalElim) return b.totalElim - a.totalElim;
    return a.name.localeCompare(b.name);
  });
  return list;
}

/* ---------------- Sync ---------------- */
async function persist() {
  renderAll();
  if (!currentRoom) return;
  const { error } = await supabase
    .from("games")
    .upsert({ room_code: currentRoom, state, updated_at: new Date().toISOString() });
  if (error) console.warn("Synkronisering fejlede:", error);
}

function subscribeRoom(code) {
  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel("games-" + code)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games", filter: `room_code=eq.${code}` },
      (payload) => {
        if (payload.new && payload.new.state) {
          state = normalizeState(payload.new.state);
          renderAll();
        }
      }
    )
    .subscribe();
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATE };
  return {
    players: Array.isArray(raw.players) ? raw.players : [],
    matches: Array.isArray(raw.matches) ? raw.matches : [],
  };
}

/* ---------------- Session list ---------------- */
async function loadSessionList() {
  sessionList.innerHTML = '<span class="setup-empty">Henter opgør…</span>';

  const { data, error } = await supabase
    .from("games")
    .select("room_code, name, state, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("Kunne ikke hente opgør:", error);
    sessionList.innerHTML = '<span class="setup-empty">Kunne ikke hente opgør. Tjek Supabase-opsætningen (se README).</span>';
    return;
  }

  if (!data || !data.length) {
    sessionList.innerHTML = '<span class="setup-empty">Ingen opgør endnu — opret det første herunder.</span>';
    return;
  }

  sessionList.innerHTML = data
    .map((row) => {
      const s = normalizeState(row.state);
      const label = row.name && row.name.trim() ? row.name : "Unavngivet opgør";
      return (
        '<div class="session-card" data-room="' + row.room_code + '" role="button" tabindex="0">' +
        '<div><p class="session-card-name">' + escapeHtml(label) + "</p>" +
        '<p class="session-card-meta">' + s.players.length + " spillere &middot; " + s.matches.length + " kampe &middot; " + formatDateTime(row.updated_at) + "</p></div>" +
        '<svg class="session-card-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>' +
        "</div>"
      );
    })
    .join("");
}

sessionList.addEventListener("click", (e) => {
  const card = e.target.closest("[data-room]");
  if (card) joinRoom(card.getAttribute("data-room"));
});
sessionList.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest("[data-room]");
  if (!card) return;
  e.preventDefault();
  joinRoom(card.getAttribute("data-room"));
});

createSessionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = newSessionName.value.trim();
  if (!name) return;
  newSessionName.value = "";
  const code = generateRoomCode();
  const { error } = await supabase
    .from("games")
    .upsert({ room_code: code, name, state: { ...DEFAULT_STATE }, updated_at: new Date().toISOString() });
  if (error) {
    console.warn("Kunne ikke oprette opgør:", error);
    alert("Kunne ikke oprette opgøret. Tjek Supabase-opsætningen (se README).");
    return;
  }
  joinRoom(code);
});

/* ---------------- Join / leave a session ---------------- */
async function joinRoom(code) {
  currentRoom = code;
  setRoomInUrl(code);
  sessionListPanel.hidden = true;
  backToListBtn.hidden = false;

  const { data, error } = await supabase
    .from("games")
    .select("state, name")
    .eq("room_code", code)
    .maybeSingle();

  if (error || !data) {
    console.warn("Kunne ikke hente opgør:", error);
    alert("Kunne ikke finde det opgør. Det kan være slettet.");
    backToSessions();
    return;
  }

  state = normalizeState(data.state);
  mastheadSub.textContent = data.name && data.name.trim() ? data.name : "Unavngivet opgør";

  subscribeRoom(code);
  gamePanels.hidden = false;
  renderAll();
}

function backToSessions() {
  closePlayerDetail();
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  currentRoom = null;
  state = { ...DEFAULT_STATE };
  clearRoomInUrl();
  mastheadSub.textContent = "Scoreboard";
  backToListBtn.hidden = true;
  gamePanels.hidden = true;
  statusPill.hidden = true;
  sessionListPanel.hidden = false;
  loadSessionList();
}

backToListBtn.addEventListener("click", backToSessions);
leaveRoomBtn.addEventListener("click", backToSessions);

/* ---------------- Players ---------------- */
function renderPlayers() {
  if (state.players.length === 0) {
    playerChipList.innerHTML = '<span class="setup-empty">Ingen spillere endnu.</span>';
  } else {
    playerChipList.innerHTML = state.players
      .map(
        (p, i) =>
          '<span class="player-chip"><span class="n">' + (i + 1) + "</span>" +
          escapeHtml(p.name) +
          '<button type="button" class="btn-icon" data-remove="' + p.id + '" aria-label="Fjern ' + escapeHtml(p.name) + '">&times;</button></span>'
      )
      .join("");
  }
}

addPlayerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = newPlayerName.value.trim();
  if (!name) return;
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    newPlayerName.value = "";
    return;
  }
  state.players.push({ id: uid(), name });
  newPlayerName.value = "";
  persist();
  newPlayerName.focus();
});

playerChipList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  const id = btn.getAttribute("data-remove");
  state.players = state.players.filter((p) => p.id !== id);
  persist();
});

/* ---------------- Leaderboard rendering ---------------- */
function renderLeaderboard() {
  const standings = computeStandings();
  leaderboard.innerHTML = standings.length
    ? standings
        .map((s, i) => {
          const isLeader = i === 0 && s.matchesWon > 0;
          const isSecond = i === 1 && s.matchesWon > 0;
          const isThird = i === 2 && s.matchesWon > 0;
          const rankClass = isLeader ? " is-leader" : isSecond ? " is-second" : isThird ? " is-third" : "";
          return (
            '<div class="lb-row' + rankClass + '" data-player="' + s.id + '" role="button" tabindex="0">' +
            '<div class="lb-rank">' + (i + 1) + "</div>" +
            '<div class="lb-main">' +
            '<div class="lb-name">' + escapeHtml(s.name) + (isLeader ? " 🏆" : "") + "</div>" +
            '<div class="lb-stats">' +
            "<span>Kampe <b>" + s.matchesPlayed + "</b></span>" +
            "<span>Runde-sejre " + s.totalRoundWins + "</span>" +
            '<span class="elim">Elim ' + s.totalElim + "</span>" +
            '<span class="dmg">Dmg ' + s.totalDmg + "</span>" +
            "</div>" +
            "</div>" +
            '<div class="lb-score">' + s.matchesWon + '<small>kampe vundet</small></div>' +
            "</div>"
          );
        })
        .join("")
    : '<span class="setup-empty">Tilføj spillere og registrér en kamp for at se stillingen.</span>';
}

leaderboard.addEventListener("click", (e) => {
  const row = e.target.closest("[data-player]");
  if (row) openPlayerDetail(row.getAttribute("data-player"));
});
leaderboard.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const row = e.target.closest("[data-player]");
  if (!row) return;
  e.preventDefault();
  openPlayerDetail(row.getAttribute("data-player"));
});

/* ---------------- Player detail modal ---------------- */
function computePlayerDetail(pid) {
  const player = state.players.find((p) => p.id === pid);
  if (!player) return null;

  const playerMatches = state.matches
    .filter((m) => m.results[pid])
    .map((m) => ({ ...m, r: m.results[pid] }));

  const matchesPlayed = playerMatches.length;
  const matchesWon = playerMatches.filter((m) => m.winnerId === pid).length;
  const totalRoundWins = playerMatches.reduce((sum, m) => sum + (Number(m.r.roundWins) || 0), 0);
  const totalElim = playerMatches.reduce((sum, m) => sum + (Number(m.r.elim) || 0), 0);
  const totalDmg = playerMatches.reduce((sum, m) => sum + (Number(m.r.dmg) || 0), 0);

  const avg = (total) => (matchesPlayed ? total / matchesPlayed : 0);

  const bestElimMatch = playerMatches.slice().sort((a, b) => b.r.elim - a.r.elim)[0] || null;
  const bestDmgMatch = playerMatches.slice().sort((a, b) => b.r.dmg - a.r.dmg)[0] || null;

  return {
    player, matchesPlayed, matchesWon,
    winRate: matchesPlayed ? Math.round((matchesWon / matchesPlayed) * 100) : 0,
    totalRoundWins, totalElim, totalDmg,
    avgRoundWins: avg(totalRoundWins), avgElim: avg(totalElim), avgDmg: avg(totalDmg),
    bestElimMatch, bestDmgMatch,
    recentMatches: playerMatches.slice().reverse().slice(0, 8),
  };
}

function fmt1(n) {
  return (Math.round(n * 10) / 10).toLocaleString("da-DK");
}
function fmt0(n) {
  return Math.round(n).toLocaleString("da-DK");
}

function openPlayerDetail(pid) {
  const d = computePlayerDetail(pid);
  if (!d) return;

  const byId = {};
  state.players.forEach((p) => { byId[p.id] = p.name; });

  const matchRows = d.recentMatches.length
    ? d.recentMatches
        .map((m) => {
          const won = m.winnerId === d.player.id;
          return (
            '<div class="match-player-row' + (won ? " is-winner" : "") + '">' +
            '<span class="mp-name">' + formatDateTime(m.playedAt) + (won ? " 🏆" : "") + "</span>" +
            "<span>" + m.r.roundWins + " sejre &middot; " + m.r.elim + " elim &middot; " + m.r.dmg + " dmg</span>" +
            "</div>"
          );
        })
        .join("")
    : '<span class="setup-empty">Ingen kampe endnu.</span>';

  playerModalContent.innerHTML =
    '<h2 class="pd-name" id="playerModalName">' + escapeHtml(d.player.name) + "</h2>" +
    '<p class="pd-sub">' + d.matchesPlayed + " kamp" + (d.matchesPlayed === 1 ? "" : "e") + " spillet &middot; " + d.matchesWon + " vundet &middot; " + d.winRate + "% sejrsrate</p>" +
    '<div class="pd-stat-grid">' +
    '<div class="pd-stat"><div class="pd-stat-label">Snit runde-sejre / kamp</div><div class="pd-stat-value gold">' + fmt1(d.avgRoundWins) + "</div></div>" +
    '<div class="pd-stat"><div class="pd-stat-label">Snit eliminations / kamp</div><div class="pd-stat-value elim">' + fmt1(d.avgElim) + "</div></div>" +
    '<div class="pd-stat"><div class="pd-stat-label">Snit damage / kamp</div><div class="pd-stat-value dmg">' + fmt0(d.avgDmg) + "</div></div>" +
    '<div class="pd-stat"><div class="pd-stat-label">Samlede runde-sejre</div><div class="pd-stat-value">' + d.totalRoundWins + "</div></div>" +
    (d.bestElimMatch
      ? '<div class="pd-stat"><div class="pd-stat-label">Flest elim i én kamp</div><div class="pd-stat-value elim">' + d.bestElimMatch.r.elim + "</div></div>"
      : "") +
    (d.bestDmgMatch
      ? '<div class="pd-stat"><div class="pd-stat-label">Mest damage i én kamp</div><div class="pd-stat-value dmg">' + d.bestDmgMatch.r.dmg + "</div></div>"
      : "") +
    "</div>" +
    '<p class="pd-section-title">Seneste kampe</p>' +
    '<div class="pd-matches">' + matchRows + "</div>";

  playerModalOverlay.hidden = false;
  playerModalClose.focus();
}

function closePlayerDetail() {
  playerModalOverlay.hidden = true;
}

playerModalClose.addEventListener("click", closePlayerDetail);
playerModalOverlay.addEventListener("click", (e) => {
  if (e.target === playerModalOverlay) closePlayerDetail();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !playerModalOverlay.hidden) closePlayerDetail();
});

/* ---------------- Match entry form ---------------- */
function renderMatchForm() {
  matchFormBody.innerHTML = state.players
    .map(
      (p) =>
        '<tr data-player="' + p.id + '">' +
        '<td class="name"><label><input type="checkbox" class="f-active" checked> ' + escapeHtml(p.name) + "</label></td>" +
        '<td class="num"><input type="number" min="0" step="1" class="f-wins" placeholder="0"></td>' +
        '<td class="num"><input type="number" min="0" step="1" class="f-elim" placeholder="0"></td>' +
        '<td class="num"><input type="number" min="0" step="1" class="f-dmg" placeholder="0"></td>' +
        "</tr>"
    )
    .join("");
}

matchFormBody.addEventListener("change", (e) => {
  if (!e.target.classList.contains("f-active")) return;
  const row = e.target.closest("tr");
  const active = e.target.checked;
  row.classList.toggle("is-inactive", !active);
  row.querySelectorAll('input[type="number"]').forEach((input) => { input.disabled = !active; });
});

matchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const rows = Array.from(matchFormBody.querySelectorAll("tr")).filter(
    (row) => row.querySelector(".f-active").checked
  );

  if (rows.length < 2) {
    alert("Afkryds mindst to spillere der var med i kampen.");
    return;
  }

  const results = {};
  let best = null;
  rows.forEach((row) => {
    const pid = row.getAttribute("data-player");
    const roundWins = Number(row.querySelector(".f-wins").value) || 0;
    const elim = Number(row.querySelector(".f-elim").value) || 0;
    const dmg = Number(row.querySelector(".f-dmg").value) || 0;
    results[pid] = { roundWins, elim, dmg };
    const entry = { pid, roundWins, elim, dmg };
    if (!best) best = [entry];
    else if (roundWins > best[0].roundWins) best = [entry];
    else if (roundWins === best[0].roundWins) best.push(entry);
  });

  let winnerId = null;
  if (best && best.length === 1 && best[0].roundWins > 0) {
    winnerId = best[0].pid;
  } else if (best && best.length > 1 && best[0].roundWins > 0) {
    const byElim = best.slice().sort((a, b) => b.elim - a.elim);
    if (byElim[0].elim > byElim[1].elim) {
      winnerId = byElim[0].pid;
    } else {
      const tiedElim = byElim.filter((e) => e.elim === byElim[0].elim);
      const byDmg = tiedElim.slice().sort((a, b) => b.dmg - a.dmg);
      if (byDmg.length === 1 || byDmg[0].dmg > byDmg[1].dmg) winnerId = byDmg[0].pid;
    }
  }

  state.matches.push({ id: uid(), playedAt: new Date().toISOString(), results, winnerId });
  persist();
  matchForm.reset();
});

/* ---------------- History ---------------- */
historyToggle.addEventListener("click", () => {
  historyOpen = !historyOpen;
  historyToggle.setAttribute("aria-expanded", String(historyOpen));
  historyToggle.querySelector(".chev").classList.toggle("open", historyOpen);
  historyWrap.hidden = !historyOpen;
  if (historyOpen) renderHistory();
});

function renderHistory() {
  if (!state.matches.length) {
    historyWrap.innerHTML = '<p class="setup-empty">Ingen kampe registreret endnu.</p>';
    return;
  }
  const byId = {};
  state.players.forEach((p) => { byId[p.id] = p.name; });

  const cards = state.matches
    .slice()
    .reverse()
    .map((m) => {
      const playerRows = Object.keys(m.results)
        .map((pid) => ({ pid, name: byId[pid] || "?", ...m.results[pid] }))
        .filter((r) => byId[r.pid])
        .sort((a, b) => b.roundWins - a.roundWins)
        .map(
          (r) =>
            '<div class="match-player-row' + (r.pid === m.winnerId ? " is-winner" : "") + '">' +
            '<span class="mp-name">' + escapeHtml(r.name) + (r.pid === m.winnerId ? " 🏆" : "") + "</span>" +
            "<span>" + r.roundWins + " sejre &middot; " + r.elim + " elim &middot; " + r.dmg + " dmg</span>" +
            "</div>"
        )
        .join("");
      return (
        '<div class="match-card">' +
        '<div class="match-card-head"><span>' + formatDateTime(m.playedAt) + "</span>" +
        (m.winnerId && byId[m.winnerId] ? "<b>" + escapeHtml(byId[m.winnerId]) + " vandt</b>" : "<span>Uafgjort</span>") +
        "</div>" +
        '<div class="match-players">' + playerRows + "</div>" +
        "</div>"
      );
    })
    .join("");

  historyWrap.innerHTML = '<div class="match-list">' + cards + "</div>";
}

undoMatchBtn.addEventListener("click", () => {
  if (!state.matches.length) return;
  if (!confirm("Fortryd den senest registrerede kamp?")) return;
  state.matches.pop();
  persist();
});

/* ---------------- Delete session ---------------- */
resetBtn.addEventListener("click", async () => {
  if (!confirm("Slet hele dette opgør permanent (spillere og al kamp-historik)?")) return;
  const code = currentRoom;
  const { error } = await supabase.from("games").delete().eq("room_code", code);
  if (error) {
    console.warn("Kunne ikke slette opgøret:", error);
    alert("Kunne ikke slette opgøret.");
    return;
  }
  backToSessions();
});

/* ---------------- Top-level render ---------------- */
function renderAll() {
  if (!currentRoom) return;

  renderPlayers();
  renderLeaderboard();
  renderMatchForm();
  if (historyOpen) renderHistory();
  undoMatchBtn.disabled = state.matches.length === 0;

  statusPill.hidden = false;
  const standings = computeStandings();
  const leaderText = standings.length && standings[0].matchesWon > 0 ? standings[0].name + " fører" : "";
  statusText.innerHTML =
    "<b>" + state.matches.length + "</b> kamp" + (state.matches.length === 1 ? "" : "e") + " registreret" +
    (leaderText ? " &nbsp;&middot;&nbsp; " + escapeHtml(leaderText) : "");
}

/* ---------------- Password gate ---------------- */
const PASSWORD_UNLOCK_KEY = "spg_unlocked_v1";

function unlockApp() {
  passwordGate.hidden = true;
  appRootEl.hidden = false;
  startApp();
}

function startApp() {
  const initialRoom = getRoomFromUrl();
  if (initialRoom) {
    joinRoom(initialRoom);
  } else {
    sessionListPanel.hidden = false;
    loadSessionList();
  }
}

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pwd = passwordInput.value;
  if (!pwd) return;
  passwordError.hidden = true;
  const submitBtn = passwordForm.querySelector("button");
  submitBtn.disabled = true;

  const { data, error } = await supabase.rpc("check_site_password", { pwd });

  submitBtn.disabled = false;

  if (error) {
    console.warn("Adgangstjek fejlede:", error);
    passwordError.textContent = "Noget gik galt — prøv igen om lidt.";
    passwordError.hidden = false;
    return;
  }

  if (data === true) {
    try { localStorage.setItem(PASSWORD_UNLOCK_KEY, "1"); } catch (e) {}
    passwordInput.value = "";
    unlockApp();
  } else {
    passwordError.textContent = "Forkert adgangskode.";
    passwordError.hidden = false;
    passwordInput.select();
  }
});

/* ---------------- Boot ---------------- */
let alreadyUnlocked = false;
try { alreadyUnlocked = localStorage.getItem(PASSWORD_UNLOCK_KEY) === "1"; } catch (e) {}

if (alreadyUnlocked) {
  unlockApp();
} else {
  passwordInput.focus();
}
