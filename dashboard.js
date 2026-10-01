const $ = id => document.getElementById(id);
$("emb").innerHTML = EMBLEM; $("emb").querySelector("svg").classList.add("emblem");
const PRESETS = ["instagram.com", "tiktok.com", "youtube.com", "reddit.com", "x.com", "facebook.com", "discord.com", "twitch.tv"];
const TITLES = { focus: "FOCUS", sites: "SITES", games: "GAMES", stats: "STATS" };
const C = 2 * Math.PI * 96;
let st = null, inited = false;

/* ---------- tabs ---------- */
document.querySelectorAll(".tab").forEach(b => (b.onclick = () => showTab(b.dataset.tab)));
function showTab(t) {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.tab === t));
  document.querySelectorAll("main > section").forEach(s => s.classList.toggle("hidden", s.id !== "tab-" + t));
  $("pageTitle").innerHTML = TITLES[t] + "<small>COMMAND CENTER</small>";
  if (t !== "games") stopGame();
}

/* ---------- load / render ---------- */
async function load() { st = await getState(); render(); }
chrome.storage.onChanged.addListener(load);

function render() {
  if (!inited) {
    $("sFocus").value = st.settings.focus; $("sBrk").value = st.settings.brk;
    $("sLong").value = st.settings.long; $("sRounds").value = st.settings.rounds;
    $("sAuto").checked = st.settings.auto !== false;
    inited = true; runInfo();
  }
  renderSites(); renderStats(); renderScores(); renderTimer();
}

/* ---------- focus tab ---------- */
function runInfo() {
  const f = +$("sFocus").value || 0, b = +$("sBrk").value || 0, l = +$("sLong").value || 0, r = +$("sRounds").value || 0;
  const tot = r * f + Math.max(0, r - 1) * b + l, h = Math.floor(tot / 60), m = tot % 60;
  $("runInfo").textContent = `FULL RUN ≈ ${h ? h + "H " : ""}${m}M · ${r} ROUND${r > 1 ? "S" : ""}` + ($("sAuto").checked ? "" : " · MANUAL START");
}
["sFocus", "sBrk", "sLong", "sRounds", "sAuto"].forEach(id => {
  $(id).oninput = runInfo;
  $(id).onchange = () => {
    const v = (i, lo, hi) => Math.min(hi, Math.max(lo, parseInt($(i).value) || lo));
    chrome.storage.local.set({ settings: {
      focus: v("sFocus", 1, 180), brk: v("sBrk", 1, 60), long: v("sLong", 1, 90), rounds: v("sRounds", 1, 12), auto: $("sAuto").checked
    } });
  };
});
$("startPomo").onclick = startPomodoro;
$("skipBreak").onclick = skipBreak;
$("endPomo").onclick = endPomodoro;
attachHold($("quit"), () => holdMs(st), stopSession);
document.querySelectorAll("#lockRow button").forEach(b => (b.onclick = () => startLock(Number(b.dataset.min))));

function renderTimer() {
  if (!st) return;
  const f = isFocus(st), b = isBreak(st), live = sessionLive(st);
  const fg = $("ringFg");
  fg.style.strokeDasharray = C;

  if (live) {
    const total = st.session.minutes * 60000, left = st.session.end - Date.now();
    fg.style.strokeDashoffset = C * (1 - Math.min(1, left / total));
    const col = f ? "#ff1a3c" : "#00e5ff";
    fg.style.stroke = col; fg.style.color = col;
    $("bigtime").textContent = fmt(left);
    const p = st.session.pomo;
    const final = p && p.cycle >= p.total;
    $("biglabel").textContent = (f ? "LOCKED IN" : "BREAK TIME") + (p ? ` · ROUND ${p.cycle}/${p.total}${f && final ? " · FINAL" : ""}` : "");
  } else {
    fg.style.strokeDashoffset = 0; fg.style.stroke = "#2c2c3c"; fg.style.color = "#2c2c3c";
    $("bigtime").textContent = "--:--";
    $("biglabel").textContent = st.alwaysBlock ? "ALWAYS BLOCKING" : "STANDBY";
  }

  $("startPomo").style.display = live ? "none" : "";
  $("skipBreak").style.display = b ? "" : "none";
  $("endPomo").style.display = b ? "" : "none";
  $("quit").style.display = f ? "" : "none";
  if (f) $("quit").textContent = `Hold ${holdMs(st) / 1000}s to quit`;
  document.querySelectorAll("#lockRow button").forEach(x => (x.disabled = live));
  ["sFocus", "sBrk", "sLong", "sRounds", "sAuto"].forEach(id => ($(id).disabled = f));

  $("pill").className = "pill " + (f ? "focus" : b ? "brk" : "");
  $("pillTxt").textContent = f ? "LOCKED IN" : b ? "ON BREAK" : "STANDBY";

  $("gamesLocked").classList.toggle("hidden", !f);
  $("gamesBody").classList.toggle("hidden", f);
  if (f) stopGame();
}
setInterval(renderTimer, 250);

/* ---------- sites tab ---------- */
function renderSites() {
  const f = isFocus(st);
  $("alwaysBlock").checked = st.alwaysBlock; $("alwaysBlock").disabled = f;
  $("addSite").disabled = f; $("siteInput").disabled = f;
  $("siteNote").textContent = f ? "// SITE LIST LOCKED UNTIL YOUR FOCUS ROUND ENDS" : "";

  const list = $("siteList"); list.innerHTML = "";
  st.sites.forEach(site => {
    const d = document.createElement("div"); d.className = "site"; d.textContent = site.toUpperCase();
    const x = document.createElement("button"); x.textContent = "×"; x.disabled = f;
    x.onclick = () => chrome.storage.local.set({ sites: st.sites.filter(s => s !== site) });
    d.appendChild(x); list.appendChild(d);
  });

  const pr = $("presets"); pr.innerHTML = "";
  PRESETS.forEach(p => {
    const c = document.createElement("button"); c.className = "chip"; c.textContent = "+ " + p.toUpperCase();
    c.disabled = f || st.sites.includes(p);
    c.onclick = () => chrome.storage.local.set({ sites: [...st.sites, p] });
    pr.appendChild(c);
  });
}
function addSite() {
  if (isFocus(st)) return;
  const d = cleanDomain($("siteInput").value);
  if (!d || !d.includes(".") || st.sites.includes(d)) return;
  $("siteInput").value = "";
  chrome.storage.local.set({ sites: [...st.sites, d] });
}
$("addSite").onclick = addSite;
$("siteInput").onkeydown = e => { if (e.key === "Enter") addSite(); };
$("alwaysBlock").onchange = e => { if (!isFocus(st)) chrome.storage.local.set({ alwaysBlock: e.target.checked }); };

/* ---------- stats tab ---------- */
function renderStats() {
  const days = st.stats.days, today = days[dayKey()] || 0;
  let streak = 0, t = Date.now();
  if (!days[dayKey(t)]) t -= 864e5;
  while (days[dayKey(t)] > 0) { streak++; t -= 864e5; }

  const cards = [
    [today + "m", "FOCUSED TODAY"], [(st.stats.minutes / 60).toFixed(1) + "h", "TOTAL FOCUS"],
    [st.stats.sessions, "ROUNDS DONE"], [streak, "DAY STREAK"], [st.stats.blocked, "BLOCKED"]
  ];
  $("statCards").innerHTML = cards.map(c => `<div class="stat"><b>${c[0]}</b><span>${c[1]}</span></div>`).join("");

  const vals = [], labels = [];
  for (let i = 6; i >= 0; i--) {
    const ts = Date.now() - i * 864e5;
    vals.push(days[dayKey(ts)] || 0);
    labels.push(new Date(ts).toLocaleDateString("en", { weekday: "short" }).toUpperCase());
  }
  const max = Math.max(...vals, 1);
  $("bars").innerHTML = vals.map((v, i) => `<div class="bar">${v}<i style="height:${(v / max) * 100}%"></i>${labels[i]}</div>`).join("");
}

/* ---------- games ---------- */
let gameTimer = null, keyHandler = null, reactTO = null;

function stopGame() {
  clearInterval(gameTimer); gameTimer = null;
  clearTimeout(reactTO);
  if (keyHandler) { removeEventListener("keydown", keyHandler); keyHandler = null; }
  $("breathCircle").style.transform = "scale(1)";
}
function saveScore(k, v, lowerBetter) {
  const sc = { ...st.scores };
  if (!sc[k] || (lowerBetter ? v < sc[k] : v > sc[k])) { sc[k] = v; chrome.storage.local.set({ scores: sc }); }
}
function renderScores() {
  $("snakeBest").textContent = st.scores.snake ? "BEST " + st.scores.snake : "";
  $("memBest").textContent = st.scores.memory ? "BEST " + st.scores.memory + " MOVES" : "";
  $("reactBest").textContent = st.scores.reaction ? "BEST " + st.scores.reaction + " MS" : "// TEST YOUR REFLEXES";
}

document.querySelectorAll(".gsel").forEach(b => (b.onclick = () => {
  if (isFocus(st)) return;
  stopGame();
  ["none", "snake", "memory", "reaction", "breathe"].forEach(g => $("g-" + g).classList.toggle("hidden", g !== b.dataset.g));
  ({ snake: drawSnakeIdle, memory: startMemory, reaction: startReaction, breathe: startBreathe })[b.dataset.g]();
}));

/* snake */
function drawSnakeIdle() {
  const x = $("snakeCv").getContext("2d");
  x.fillStyle = "#08080d"; x.fillRect(0, 0, 400, 400);
  x.fillStyle = "#00e5ff"; x.font = "700 20px Bahnschrift, Segoe UI"; x.textAlign = "center"; x.fillText("PRESS START", 200, 200);
}
$("snakeStart").onclick = () => {
  if (isFocus(st)) return;
  stopGame();
  const cv = $("snakeCv"), x = cv.getContext("2d"), N = 20, S = cv.width / N;
  let sn = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], d = { x: 1, y: 0 }, nd = d, score = 0;
  const spawn = () => {
    let p; do p = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
    while (sn.some(s => s.x === p.x && s.y === p.y)); return p;
  };
  let food = spawn();
  $("snakeScore").textContent = "SCORE 0";

  keyHandler = e => {
    const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[e.key];
    if (!m) return;
    e.preventDefault();
    if (m[0] !== -d.x || m[1] !== -d.y) nd = { x: m[0], y: m[1] };
  };
  addEventListener("keydown", keyHandler);

  gameTimer = setInterval(() => {
    d = nd;
    const h = { x: sn[0].x + d.x, y: sn[0].y + d.y };
    if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || sn.some(s => s.x === h.x && s.y === h.y)) {
      stopGame(); saveScore("snake", score);
      x.fillStyle = "#000a"; x.fillRect(0, 0, 400, 400);
      x.fillStyle = "#ff1a3c"; x.font = "800 28px Bahnschrift, Segoe UI"; x.textAlign = "center";
      x.fillText("GAME OVER · " + score, 200, 200);
      return;
    }
    sn.unshift(h);
    if (h.x === food.x && h.y === food.y) { score++; food = spawn(); $("snakeScore").textContent = "SCORE " + score; }
    else sn.pop();

    x.fillStyle = "#08080d"; x.fillRect(0, 0, 400, 400);
    x.shadowBlur = 12;
    x.shadowColor = "#ff1a3c"; x.fillStyle = "#ff1a3c"; x.fillRect(food.x * S + 3, food.y * S + 3, S - 6, S - 6);
    x.shadowColor = "#00e5ff"; x.fillStyle = "#00e5ff";
    sn.forEach(s => x.fillRect(s.x * S + 1, s.y * S + 1, S - 2, S - 2));
    x.shadowBlur = 0;
  }, 110);
};

/* memory */
function startMemory() {
  const em = ["🎮", "🚀", "🔥", "⚡", "🎧", "👾", "🧠", "💎"];
  const cards = [...em, ...em].sort(() => Math.random() - 0.5);
  const grid = $("memGrid"); grid.innerHTML = "";
  let first = null, lock = false, moves = 0, found = 0;
  $("memInfo").textContent = "MOVES 0";
  cards.forEach(e => {
    const b = document.createElement("button"); b.className = "mcard"; b.textContent = "?";
    b.onclick = () => {
      if (lock || b.classList.contains("up")) return;
      b.textContent = e; b.classList.add("up");
      if (!first) { first = b; return; }
      moves++; $("memInfo").textContent = "MOVES " + moves;
      if (first.textContent === e) {
        first = null; found++;
        if (found === 8) { $("memInfo").textContent = "CLEARED IN " + moves + " MOVES"; saveScore("memory", moves, true); }
      } else {
        lock = true; const a = first; first = null;
        setTimeout(() => { a.textContent = "?"; b.textContent = "?"; a.classList.remove("up"); b.classList.remove("up"); lock = false; }, 700);
      }
    };
    grid.appendChild(b);
  });
}
$("memStart").onclick = () => { if (!isFocus(st)) startMemory(); };

/* reaction */
function startReaction() {
  const box = $("reactBox"); let state = "idle", t0 = 0;
  box.className = "react wait0"; box.textContent = "CLICK TO START";
  box.onclick = () => {
    if (isFocus(st)) return;
    if (state === "idle" || state === "done" || state === "early") {
      state = "wait"; box.className = "react red"; box.textContent = "WAIT FOR CYAN...";
      reactTO = setTimeout(() => { state = "go"; t0 = performance.now(); box.className = "react green"; box.textContent = "CLICK!"; }, 1000 + Math.random() * 3000);
    } else if (state === "wait") {
      clearTimeout(reactTO); state = "early"; box.className = "react wait0"; box.textContent = "TOO EARLY · CLICK TO RETRY";
    } else if (state === "go") {
      const ms = Math.round(performance.now() - t0); state = "done";
      box.className = "react wait0"; box.textContent = ms + " MS · CLICK TO RETRY";
      saveScore("reaction", ms, true);
    }
  };
}

/* breathe (box breathing) */
function startBreathe() {
  const c = $("breathCircle"), t = $("breathText");
  const ph = [["INHALE", 1.6], ["HOLD", 1.6], ["EXHALE", 1], ["HOLD", 1]];
  let i = 0;
  const step = () => { const [n, sc] = ph[i % 4]; t.textContent = n; c.style.transform = `scale(${sc})`; i++; };
  step(); gameTimer = setInterval(step, 4000);
}

load();
