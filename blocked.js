const $ = id => document.getElementById(id);
$("emb").innerHTML = EMBLEM; $("emb").querySelector("svg").classList.add("emblem");
const site = new URLSearchParams(location.search).get("site") || "";
$("site").textContent = site.toUpperCase();

const quotes = [
  "Future you is watching. Go study.",
  "Streaks can wait. Exams can't.",
  "It'll still be there after your round.",
  "One round. Just start.",
  "Build the thing. Learn the thing."
];
$("quote").textContent = quotes[Math.floor(Math.random() * quotes.length)];

(async () => {
  const s = await getState();
  s.stats.blocked = (s.stats.blocked || 0) + 1;
  await chrome.storage.local.set({ stats: s.stats });
})();

async function check() {
  const s = await getState();
  if (isFocus(s)) $("timer").textContent = "LOCKED IN · " + fmt(s.session.end - Date.now()) + " LEFT";
  else if (isBlocking(s)) $("timer").textContent = "ALWAYS-BLOCK ACTIVE";
  else if (site) location.replace("https://" + site); // unblocked -> send them back
}
check();
setInterval(check, 1000);
chrome.storage.onChanged.addListener(check);
