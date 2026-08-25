import { supabase } from "./supabase-config.js";

const DEFAULT_STATE = { phase: "setup", players: [], target: 5, rounds: [], winnerId: null };
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

/* ---------------- Element refs ---------------- */
const roomGate = document.getElementById("roomGate");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomForm = document.getElementById("joinRoomForm");
const joinRoomCode = document.getElementById("joinRoomCode");
const roomPill = document.getElementById("roomPill");
const roomPillText = document.getElementById("roomPillText");
const copyLinkBtn = document.getElementById("copyLinkBtn");

const setupPanel = document.getElementById("setupPanel");
const addPlayerForm = document.getElementById("addPlayerForm");
const newPlayerName = document.getElementById("newPlayerName");
const playerChipList = document.getElementById("playerChipList");
const targetWins = document.getElementById("targetWins");
const startGameBtn = document.getElementById("startGameBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const leaveRoomBtn2 = document.getElementById("leaveRoomBtn2");

const gamePanels = document.getElementById("gamePanels");
const statusPill = document.getElementById("statusPill");
const statusText = document.getElementById("statusText");
const leaderboard = document.getElementById("leaderboard");
const lbHint = document.getElementById("lbHint");
const roundFormBody = document.getElementById("roundFormBody");
const roundForm = document.getElementById("roundForm");
const roundEntryTitle = document.getElementById("roundEntryTitle");
const roundEntryPanel = document.getElementById("roundEntryPanel");
const undoRoundBtn = document.getElementById("undoRoundBtn");
const historyToggle = document.getElementById("historyToggle");
const historyWrap = document.getElementById("historyWrap");
const winnerBanner = document.getElementById("winnerBanner");
const winnerName = document.getElementById("winnerName");
const newGameBtn = document.getElementById("newGameBtn");
const resetBtn = document.getElementById("resetBtn");

/* ---------------- Standings ---------------- */
function computeStandings() {
  const byId = {};
  state.players.forEach((p) => {
    byId[p.id] = { id: p.id, name: p.name, roundWins: 0, totalScore: 0, totalElim: 0, totalDmg: 0 };
  });
  state.rounds.forEach((r) => {
    state.players.forEach((p) => {
      const e = r.players[p.id];
      if (!e) return;
      byId[p.id].totalScore += Number(e.score) || 0;
      byId[p.id].totalElim += Number(e.elim) || 0;
      byId[p.id].totalDmg += Number(e.dmg) || 0;
    });
    if (r.winnerId && byId[r.winnerId]) byId[r.winnerId].roundWins += 1;
  });
  const list = state.players.map((p) => byId[p.id]);
  list.sort((a, b) => {
    if (b.roundWins !== a.roundWins) return b.roundWins - a.roundWins;
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
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
          state = payload.new.state;
          renderAll();
        }
      }
    )
    .subscribe();
}

async function joinRoom(code) {
  currentRoom = code;
  setRoomInUrl(code);
  roomGate.hidden = true;

  const { data, error } = await supabase
    .from("games")
    .select("state")
    .eq("room_code", code)
    .maybeSingle();

  if (error) {
    console.warn("Kunne ikke hente spil:", error);
    alert("Kunne ikke oprette forbindelse til spillet. Tjek Supabase-opsætningen (se README).");
    leaveRoom();
    return;
  }

  if (data && data.state) {
    state = data.state;
  } else {
    state = { ...DEFAULT_STATE };
    await supabase.from("games").upsert({ room_code: code, state, updated_at: new Date().toISOString() });
  }

  subscribeRoom(code);
  roomPill.hidden = false;
  roomPillText.textContent = "Spil " + code;
  renderAll();
}

function leaveRoom() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  currentRoom = null;
  state = { ...DEFAULT_STATE };
  clearRoomInUrl();
  roomPill.hidden = true;
  roomGate.hidden = false;
  setupPanel.hidden = true;
  gamePanels.hidden = true;
  statusPill.hidden = true;
}

createRoomBtn.addEventListener("click", () => {
  joinRoom(generateRoomCode());
});

joinRoomForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = joinRoomCode.value.trim().toUpperCase();
  if (!code) return;
  joinRoomCode.value = "";
  joinRoom(code);
});

copyLinkBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    const original = roomPillText.textContent;
    roomPillText.textContent = "Link kopieret!";
    setTimeout(() => { roomPillText.textContent = original; }, 1500);
  } catch (e) {
    alert("Kunne ikke kopiere linket. Spil-koden er: " + currentRoom);
  }
});

leaveRoomBtn.addEventListener("click", leaveRoom);
leaveRoomBtn2.addEventListener("click", leaveRoom);

/* ---------------- Setup phase rendering ---------------- */
function renderSetup() {
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
  startGameBtn.disabled = state.players.length < 2;
  targetWins.value = state.target;
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

targetWins.addEventListener("change", () => {
  const v = Math.max(1, Math.min(100, Number(targetWins.value) || 5));
  state.target = v;
  targetWins.value = v;
  persist();
});

startGameBtn.addEventListener("click", () => {
  if (state.players.length < 2) return;
  state.target = Math.max(1, Math.min(100, Number(targetWins.value) || 5));
  state.phase = "playing";
  persist();
});

/* ---------------- Leaderboard rendering ---------------- */
function renderLeaderboard() {
  const standings = computeStandings();
  lbHint.textContent = "Først til " + state.target + " runde-sejre vinder.";
  leaderboard.innerHTML = standings
    .map((s, i) => {
      const isWinner = state.winnerId === s.id;
      const isLeader = !isWinner && i === 0 && s.roundWins > 0;
      let pips = "";
      for (let k = 0; k < state.target; k++) {
        pips += '<span class="pip' + (k < s.roundWins ? " filled" : "") + '"></span>';
      }
      return (
        '<div class="lb-row' + (isWinner ? " is-winner" : isLeader ? " is-leader" : "") + '">' +
        '<div class="lb-rank">' + (i + 1) + "</div>" +
        '<div class="lb-main">' +
        '<div class="lb-name">' + escapeHtml(s.name) + (isWinner ? " 🏆" : "") + "</div>" +
        '<div class="lb-stats">' +
        "<span>Score <b>" + s.totalScore + "</b></span>" +
        '<span class="elim">Elim ' + s.totalElim + "</span>" +
        '<span class="dmg">Dmg ' + s.totalDmg + "</span>" +
        "</div>" +
        "</div>" +
        '<div class="lb-pips">' +
        '<div class="pip-row">' + pips + "</div>" +
        '<div class="lb-score">' + s.roundWins + "/" + state.target + "<small>sejre</small></div>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

/* ---------------- Round entry form ---------------- */
function renderRoundForm() {
  const nextRound = state.rounds.length + 1;
  roundEntryTitle.textContent = "Registrér runde " + nextRound;
  roundFormBody.innerHTML = state.players
    .map(
      (p) =>
        '<tr data-player="' + p.id + '">' +
        '<td class="name">' + escapeHtml(p.name) + "</td>" +
        '<td class="num"><input type="number" min="0" step="1" class="f-score" placeholder="0" required></td>' +
        '<td class="num"><input type="number" min="0" step="1" class="f-elim" placeholder="0"></td>' +
        '<td class="num"><input type="number" min="0" step="1" class="f-dmg" placeholder="0"></td>' +
        "</tr>"
    )
    .join("");
  undoRoundBtn.disabled = state.rounds.length === 0;
}

roundForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const rows = roundFormBody.querySelectorAll("tr");
  const roundPlayers = {};
  let best = null;
  rows.forEach((row) => {
    const pid = row.getAttribute("data-player");
    const score = Number(row.querySelector(".f-score").value) || 0;
    const elim = Number(row.querySelector(".f-elim").value) || 0;
    const dmg = Number(row.querySelector(".f-dmg").value) || 0;
    roundPlayers[pid] = { score, elim, dmg };
    const entry = { pid, score, elim, dmg };
    if (!best) best = [entry];
    else if (score > best[0].score) best = [entry];
    else if (score === best[0].score) best.push(entry);
  });

  let winnerId = null;
  if (best && best.length === 1) {
    winnerId = best[0].pid;
  } else if (best && best.length > 1) {
    const byElim = best.slice().sort((a, b) => b.elim - a.elim);
    if (byElim[0].elim > byElim[1].elim) {
      winnerId = byElim[0].pid;
    } else {
      const tiedElim = byElim.filter((e) => e.elim === byElim[0].elim);
      const byDmg = tiedElim.slice().sort((a, b) => b.dmg - a.dmg);
      if (byDmg.length === 1 || byDmg[0].dmg > byDmg[1].dmg) winnerId = byDmg[0].pid;
    }
  }

  state.rounds.push({ players: roundPlayers, winnerId });

  const standings = computeStandings();
  if (standings.length && standings[0].roundWins >= state.target) {
    state.phase = "finished";
    state.winnerId = standings[0].id;
  }

  persist();
});

undoRoundBtn.addEventListener("click", () => {
  if (!state.rounds.length) return;
  state.rounds.pop();
  if (state.phase === "finished") {
    state.phase = "playing";
    state.winnerId = null;
  }
  persist();
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
  if (!state.rounds.length) {
    historyWrap.innerHTML = '<p class="setup-empty">Ingen runder registreret endnu.</p>';
    return;
  }
  const byId = {};
  state.players.forEach((p) => { byId[p.id] = p.name; });
  const header =
    "<tr><th>Runde</th>" +
    state.players.map((p) => "<th>" + escapeHtml(p.name) + "</th>").join("") +
    "<th>Vinder</th></tr>";

  const rows = state.rounds
    .map((r, i) => {
      const cells = state.players
        .map((p) => {
          const e = r.players[p.id];
          return e ? '<td class="mono">' + e.score + "</td>" : '<td class="mono">–</td>';
        })
        .join("");
      const winnerNameStr = r.winnerId && byId[r.winnerId] ? byId[r.winnerId] : "Uafgjort";
      return '<tr><td class="rnum">#' + (i + 1) + "</td>" + cells + '<td class="win-cell">' + escapeHtml(winnerNameStr) + "</td></tr>";
    })
    .join("");

  historyWrap.innerHTML = '<table class="history-table"><thead>' + header + "</thead><tbody>" + rows + "</tbody></table>";
}

/* ---------------- Winner banner ---------------- */
function renderBanner() {
  if (state.phase === "finished" && state.winnerId) {
    const p = state.players.find((pl) => pl.id === state.winnerId);
    winnerName.textContent = (p ? p.name : "Spiller") + " vinder!";
    winnerBanner.hidden = false;
    roundEntryPanel.hidden = true;
  } else {
    winnerBanner.hidden = true;
    roundEntryPanel.hidden = false;
  }
}

newGameBtn.addEventListener("click", () => {
  state.phase = "playing";
  state.rounds = [];
  state.winnerId = null;
  persist();
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Nulstil hele opgøret og fjern alle spillere?")) return;
  state = { phase: "setup", players: [], target: 5, rounds: [], winnerId: null };
  persist();
});

/* ---------------- Top-level render ---------------- */
function renderAll() {
  if (!currentRoom) return;

  if (state.phase === "setup") {
    setupPanel.hidden = false;
    gamePanels.hidden = true;
    statusPill.hidden = true;
    renderSetup();
  } else {
    setupPanel.hidden = true;
    gamePanels.hidden = false;
    statusPill.hidden = false;
    const standings = computeStandings();
    const leaderText = standings.length ? standings[0].name + " fører" : "";
    statusText.innerHTML =
      "<b>Runde " + (state.rounds.length + (state.phase === "playing" ? 1 : 0)) + "</b> &nbsp;&middot;&nbsp; Mål: " +
      state.target + " sejre" +
      (leaderText && state.phase === "playing" ? " &nbsp;&middot;&nbsp; " + escapeHtml(leaderText) : "");
    renderLeaderboard();
    renderRoundForm();
    renderBanner();
    if (historyOpen) renderHistory();
  }
}

/* ---------------- Boot ---------------- */
const initialRoom = getRoomFromUrl();
if (initialRoom) {
  joinRoom(initialRoom);
} else {
  roomGate.hidden = false;
}
