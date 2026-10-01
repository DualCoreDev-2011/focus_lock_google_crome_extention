const $ = id => document.getElementById(id);
$("emb").innerHTML = EMBLEM; $("emb").querySelector("svg").classList.add("emblem");
let st = null;

async function load() { st = await getState(); render(); }

function render() {
  if (!st) return;
  const f = isFocus(st), b = isBreak(st), live = sessionLive(st);
  $("toggle").checked = st.alwaysBlock; $("toggle").disabled = f;
  $("pomo").style.display = live ? "none" : "block";
  document.querySelectorAll(".lockbtn").forEach(x => (x.disabled = live));
  $("skip").style.display = b ? "block" : "none";
  $("endp").style.display = b ? "block" : "none";
  $("quit").style.display = f ? "block" : "none";
  if (f) $("quit").textContent = `Hold ${holdMs(st) / 1000}s to quit`;

  if (live) {
    const p = st.session.pomo;
    $("label").textContent = (f ? "LOCKED IN" : "BREAK") + (p ? ` · ROUND ${p.cycle}/${p.total}` : "");
    $("time").textContent = fmt(st.session.end - Date.now());
    $("time").className = f ? "f" : "b";
  } else {
    $("label").textContent = st.alwaysBlock ? "ALWAYS BLOCKING" : "STANDBY";
    $("time").textContent = "--:--"; $("time").className = "";
  }
}

$("toggle").onchange = e => { if (!isFocus(st)) chrome.storage.local.set({ alwaysBlock: e.target.checked }); };
$("pomo").onclick = startPomodoro;
$("skip").onclick = skipBreak;
$("endp").onclick = endPomodoro;
attachHold($("quit"), () => holdMs(st), stopSession);
$("dash").onclick = () => { chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") }); window.close(); };
document.querySelectorAll(".lockbtn").forEach(b => (b.onclick = () => startLock(Number(b.dataset.min))));

chrome.storage.onChanged.addListener(load);
setInterval(render, 500);
load();
