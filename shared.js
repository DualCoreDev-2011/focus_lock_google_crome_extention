// Shared by background, popup, dashboard, blocked page
const DEFAULTS = {
  sites: ["snapchat.com", "netflix.com"],
  alwaysBlock: false,
  // session: { type: "focus"|"break", end: ms, minutes, pomo: {cycle,total,focus,brk,long}|null }
  session: null,
  settings: { focus: 25, brk: 5, long: 15, rounds: 4, auto: true },
  stats: { days: {}, sessions: 0, minutes: 0, blocked: 0 },
  scores: { snake: 0, memory: 0, reaction: 0 }
};

const getState = () => chrome.storage.local.get(DEFAULTS);
const sessionLive = s => !!(s.session && s.session.end > Date.now());
const isFocus = s => sessionLive(s) && s.session.type === "focus";
const isBreak = s => sessionLive(s) && s.session.type === "break";
// Time-based on purpose: even if nothing ran while the laptop slept, this is always correct.
const isBlocking = s => isFocus(s) || (s.alwaysBlock && !isBreak(s));
const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA");

function fmt(ms) {
  ms = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(ms / 3600), m = Math.floor((ms % 3600) / 60), s = ms % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}

function cleanDomain(input) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "")
    .split("/")[0].split("?")[0];
}

function matchSite(url, sites) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    return sites.find(d => u.hostname === d || u.hostname.endsWith("." + d)) || null;
  } catch { return null; }
}

async function startLock(min) {
  const s = await getState();
  if (isFocus(s)) return;
  await chrome.storage.local.set({
    session: { type: "focus", end: Date.now() + min * 60000, minutes: min, pomo: null }
  });
}

async function startPomodoro() {
  const s = await getState();
  if (isFocus(s)) return;
  const c = s.settings;
  await chrome.storage.local.set({
    session: {
      type: "focus", end: Date.now() + c.focus * 60000, minutes: c.focus,
      pomo: { cycle: 1, total: c.rounds, focus: c.focus, brk: c.brk, long: c.long }
    }
  });
}

async function skipBreak() {
  const s = await getState();
  if (!isBreak(s)) return;
  await chrome.storage.local.set({ session: { ...s.session, end: Date.now() } });
}

async function endPomodoro() {
  const s = await getState();
  if (isFocus(s)) return; // can't bail out of a focus round
  await chrome.storage.local.set({ session: null });
}

// Quitting a focus round is allowed, but you have to HOLD the button (friction on purpose).
const holdMs = s => (s.session && s.session.pomo ? 3000 : 10000);

async function stopSession() {
  await chrome.storage.local.set({ session: null });
}

function attachHold(btn, getMs, done) {
  let t = null, raf = null, start = 0;
  const reset = () => { clearTimeout(t); cancelAnimationFrame(raf); btn.style.setProperty("--hold", "0%"); };
  btn.addEventListener("pointerdown", () => {
    start = performance.now();
    const ms = getMs();
    t = setTimeout(() => { reset(); done(); }, ms);
    const tick = () => { btn.style.setProperty("--hold", Math.min(100, ((performance.now() - start) / ms) * 100) + "%"); raf = requestAnimationFrame(tick); };
    tick();
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(e => btn.addEventListener(e, reset));
}

// ROG-inspired emblem (original artwork, not the official logo)
const EMBLEM = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="currentColor"><polygon points="2,56 24,30 60,16 98,14 64,32 34,46 20,62"/><polygon points="14,74 44,60 98,52 70,70 50,78 32,92"/><path fill-rule="evenodd" d="M58 38a8 8 0 1 0 0.01 0zM58 42.5a3.5 3.5 0 1 1-0.01 0z"/></g></svg>`;
