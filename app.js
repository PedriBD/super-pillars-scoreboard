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

const roomGate = document.getElementById("roomGate");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomForm = document.getElementById("joinRoomForm");
const joinRoomCode = document.getElementById("joinRoomCode");
const roomPill = document.getElementById("roomPill");
const roomPillText = document.getElementById("roomPillText");
const copyLinkBtn = document.getElementById("copyLinkBtn");

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
    state = normalizeState(data.state);
  } else {
    state = { ...DEFAULT_STATE };
    await supabase.from("games").upsert({ room_code: code, state, updated_at: new Date().toISOString() });
  }

  subscribeRoom(code);
  roomPill.hidden = false;
  roomPillText.textContent = "Spil " + code;
  gamePanels.hidden = false;
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
          return (
            '<div class="lb-row' + (isLeader ? " is-leader" : "") + '">' +
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

/* ---------------- Match entry form ---------------- */
function renderMatchForm() {
  matchFormBody.innerHTML = state.players
    .map(
      (p) =>
        '<tr data-player="' + p.id + '">' +
        '<td class="name">' + escapeHtml(p.name) + "</td>" +
        '<td class="num"><input type="number" min="0" step="1" class="f-wins" placeholder="0"></td>' +
        '<td class="num"><input type="number" min="0" step="1" class="f-elim" placeholder="0"></td>' +
        '<td class="num"><input type="number" min="0" step="1" class="f-dmg" placeholder="0"></td>' +
        "</tr>"
    )
    .join("");
}

matchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (state.players.length < 2) {
    alert("Tilføj mindst to spillere først.");
    return;
  }
  const rows = matchFormBody.querySelectorAll("tr");
  const results = {};
  let best = null;
  let anyInput = false;
  rows.forEach((row) => {
    const pid = row.getAttribute("data-player");
    const roundWins = Number(row.querySelector(".f-wins").value) || 0;
    const elim = Number(row.querySelector(".f-elim").value) || 0;
    const dmg = Number(row.querySelector(".f-dmg").value) || 0;
    if (roundWins || elim || dmg) anyInput = true;
    results[pid] = { roundWins, elim, dmg };
    const entry = { pid, roundWins, elim, dmg };
    if (!best) best = [entry];
    else if (roundWins > best[0].roundWins) best = [entry];
    else if (roundWins === best[0].roundWins) best.push(entry);
  });

  if (!anyInput) {
    alert("Indtast resultatet for kampen først.");
    return;
  }

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

/* ---------------- Reset ---------------- */
resetBtn.addEventListener("click", () => {
  if (!confirm("Nulstil hele opgøret (spillere og al kamp-historik)?")) return;
  state = { ...DEFAULT_STATE };
  persist();
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
    roomGate.hidden = false;
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
