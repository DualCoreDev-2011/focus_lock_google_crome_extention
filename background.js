importScripts("shared.js");

const blockedPage = d => chrome.runtime.getURL("blocked.html?site=" + encodeURIComponent(d));

function notify(title, message) {
  chrome.notifications.create({ type: "basic", iconUrl: "icon128.png", title, message });
}

// Moves finished sessions forward (focus -> break -> next focus). Safe to run any time,
// so it also catches up after hibernation / sleep.
async function doTick() {
  const s = await getState();
  const ses = s.session;
  if (!ses || ses.end > Date.now()) return;

  const stats = s.stats;
  let next = null;

  if (ses.type === "focus") {
    const k = dayKey(ses.end);
    stats.days[k] = (stats.days[k] || 0) + ses.minutes;
    stats.sessions += 1;
    stats.minutes += ses.minutes;
    const p = ses.pomo;
    if (p) {
      const last = p.cycle >= p.total;
      const mins = last ? p.long : p.brk;
      next = { type: "break", end: Date.now() + mins * 60000, minutes: mins, pomo: p };
      notify("Focus round done 🎉", last
        ? `All ${p.total} rounds finished! Enjoy a ${mins} min break. Games unlocked.`
        : `Round ${p.cycle}/${p.total} done. ${mins} min break, games unlocked.`);
    } else {
      notify("Session complete 🎉", `${ses.minutes} min locked in. Sites are unblocked again.`);
    }
  } else {
    const p = ses.pomo;
    if (p && p.cycle < p.total && s.settings.auto === false) {
      notify("Break over ⏱", "Start your next round when you're ready.");
    } else if (p && p.cycle < p.total) {
      const np = { ...p, cycle: p.cycle + 1 };
      next = { type: "focus", end: Date.now() + p.focus * 60000, minutes: p.focus, pomo: np };
      notify("Break over ⏱", `Round ${np.cycle}/${np.total} - locking back in.`);
    } else {
      notify("Pomodoro finished 🔥", "Nice work. Sites are unblocked.");
    }
  }
  await chrome.storage.local.set({ session: next, stats });
}

async function syncRules(s) {
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const rules = isBlocking(s)
    ? s.sites.map((d, i) => ({
        id: i + 1,
        priority: 1,
        action: { type: "redirect", redirect: { extensionPath: "/blocked.html?site=" + encodeURIComponent(d) } },
        condition: { requestDomains: [d], resourceTypes: ["main_frame"] }
      }))
    : [];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: old.map(r => r.id),
    addRules: rules
  });
}

async function sweepTabs(s) {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    const d = matchSite(t.url || "", s.sites);
    if (d) chrome.tabs.update(t.id, { url: blockedPage(d) }).catch(() => {});
  }
}

async function updateBadge(s) {
  if (sessionLive(s)) {
    const m = Math.ceil((s.session.end - Date.now()) / 60000);
    chrome.action.setBadgeText({ text: m + "m" });
    chrome.action.setBadgeBackgroundColor({ color: s.session.type === "focus" ? "#ff2bd6" : "#39ff14" });
  } else if (isBlocking(s)) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#00b8d4" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

async function refresh() {
  await doTick();
  const s = await getState();
  await syncRules(s);
  if (isBlocking(s)) await sweepTabs(s);
  if (sessionLive(s)) chrome.alarms.create("end", { when: s.session.end + 300 });
  await updateBadge(s);
}

let chain = Promise.resolve();
const run = () => (chain = chain.then(refresh).catch(e => console.error(e)));

function setupAlarms() { chrome.alarms.create("tick", { periodInMinutes: 1 }); }

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...DEFAULTS, ...cur });
  setupAlarms();
  run();
});
chrome.runtime.onStartup.addListener(() => { setupAlarms(); run(); });
chrome.storage.onChanged.addListener(run);
chrome.alarms.onAlarm.addListener(run);
chrome.idle.onStateChanged.addListener(state => { if (state === "active") run(); }); // wake from sleep/lock

// Catches single-page-app navigation (Snapchat Web etc.)
chrome.tabs.onUpdated.addListener(async (id, change, tab) => {
  if (!change.url && change.status !== "loading") return;
  const url = change.url || tab.url;
  if (!url) return;
  const s = await getState();
  if (!isBlocking(s)) return;
  const d = matchSite(url, s.sites);
  if (d) chrome.tabs.update(id, { url: blockedPage(d) }).catch(() => {});
});

run();
