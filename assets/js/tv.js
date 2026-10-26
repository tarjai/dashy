// Dopamin — TV ekranı
import { renderMarkdown } from "./md.js";
import { BLOCK_THEMES } from "./themes.js";
import { DATA_KEY, DAY_HOURS, DEFAULT_DATA, fetchPublished, loadLocal, normalize } from "./store.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const PREVIEW = params.has("preview"); // kontrol panelindeki önizleme
const POLL_MS = Math.max(15, Number(params.get("poll")) || 45) * 1000;

const SHAPE = { hardal: "arch", mint: "arch", petrol: "arch", antrasit: "arch", portakal: "puff", pudra: "puff", altin: "puff" };
const FLUTED = new Set(["hardal", "mint", "petrol"]);
const BRIGHT = ["#ffffff", "#ffe14a", "#ff7a2e", "#7dffd8", "#ff4f7b", "#fff6c8"];

let data = normalize(DEFAULT_DATA);
let renderedKey = "";
let lastBlock = null;
const firedMarkers = new Set();

// ---------- zaman ----------
const pad = (n) => String(n).padStart(2, "0");

function dayWindow(now) {
  const S = data.settings.dayStart;
  const today = new Date(now);
  today.setHours(S, 0, 0, 0);
  let start = today.getTime();
  // gece yarısını aşan günler: dünkü pencere hâlâ sürüyor olabilir
  if (now < start && now < start - 24 * 3600e3 + DAY_HOURS * 3600e3) start -= 24 * 3600e3;
  return { start, end: start + DAY_HOURS * 3600e3 };
}

function fmtDur(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}<small>sa</small>${pad(m % 60)}<small>dk</small>` : `${m}<small>dk</small>`;
}

function hourLabel(h) {
  return pad(h % 24);
}

// ---------- yapı (veri değişince) ----------
function buildStatic() {
  const { settings } = data;
  const S = settings.dayStart;

  $("brandTitle").textContent = settings.title || "Dopamin";
  document.title = settings.title || "Dopamin";
  $("footer").textContent = settings.footer || "";
  document.body.classList.toggle("wiggle-off", !settings.wiggle);

  // bloklar
  const segs = $("segments");
  segs.innerHTML = "";
  const roman = ["I", "II", "III", "IV"];
  for (let b = 0; b < 4; b++) {
    const theme = BLOCK_THEMES[b];
    const el = document.createElement("div");
    el.className = `seg seg-${theme}${theme === "mint" || theme === "hardal" ? " fluted" : ""}`;
    el.innerHTML = `<span class="seg-kicker">${roman[b]} · ${hourLabel(S + b * 4)}–${hourLabel(S + b * 4 + 4)}</span><span class="seg-name"></span>`;
    el.querySelector(".seg-name").textContent = settings.blockNames[b];
    segs.appendChild(el);
  }

  // çentikler (15 dk) + saat etiketleri
  const ticks = $("ticks");
  const hours = $("hours");
  ticks.innerHTML = "";
  hours.innerHTML = "";
  const total = DAY_HOURS * 4;
  for (let i = 1; i < total; i++) {
    const t = document.createElement("i");
    const kind = i % 4 === 0 ? "hour" : i % 2 === 0 ? "half" : "q";
    const light = i > 32; // portakal + gece bloklarında açık renk
    t.className = `tick ${kind}${light ? " light" : ""}`;
    t.style.left = `${(i / total) * 100}%`;
    ticks.appendChild(t);
  }
  for (let h = 0; h <= DAY_HOURS; h++) {
    const l = document.createElement("span");
    l.className = "hour-label";
    l.dataset.h = h;
    l.style.left = `${(h / DAY_HOURS) * 100}%`;
    l.textContent = hourLabel(S + h);
    hours.appendChild(l);
  }

  // işaretler
  const mk = $("markers");
  mk.innerHTML = "";
  for (const m of data.markers) {
    const el = document.createElement("div");
    el.className = "marker";
    el.dataset.time = m.time;
    el.innerHTML = `<span class="marker-pill"><b></b><span></span></span>`;
    el.querySelector("b").textContent = m.time;
    el.querySelector(".marker-pill > span").textContent = m.label;
    mk.appendChild(el);
  }

  buildWindows();
  tick(true);
}

function buildWindows() {
  const n = data.settings.windowCount;
  const wrap = $("windows");
  wrap.style.setProperty("--n", n);
  wrap.innerHTML = "";
  data.windows.slice(0, n).forEach((w, i) => {
    const el = document.createElement("article");
    el.className = `win theme-${w.theme} shape-${SHAPE[w.theme] || "arch"}`;
    // her pencere farklı hız/fazda — hep birlikte sallanmasın
    el.style.setProperty("--wd", `${7 + ((i * 1.7) % 4)}s`);
    el.style.setProperty("--wdelay", `${-i * 2.3}s`);
    el.style.setProperty("--wa", `${0.35 + (i % 3) * 0.12}deg`);
    el.innerHTML = `
      <div class="win-frame${FLUTED.has(w.theme) ? " fluted" : ""}">
        <div class="win-inner">
          <h2 class="win-title"></h2>
          <i class="win-rule"></i>
          <div class="win-body md"></div>
        </div>
      </div>`;
    el.querySelector(".win-title").textContent = w.title;
    el.querySelector(".win-body").innerHTML = renderMarkdown(w.body);
    wrap.appendChild(el);
  });
  requestAnimationFrame(fitAll);
}

// metni pencereye sığdır (scroll yok): en büyük okunabilir puntoyu ikili arama ile bul
function fitAll() {
  const u = Math.min(innerWidth / 100, innerHeight / 56.25);
  // başlık: kelime bölünmeden en fazla 2 satır
  document.querySelectorAll(".win-title").forEach((el) => {
    let size = u * 2.35;
    el.style.fontSize = `${size}px`;
    while (size > u * 1.4 && (el.scrollWidth > el.clientWidth + 1 || el.offsetHeight > size * 1.04 * 2 + 2)) {
      size *= 0.94;
      el.style.fontSize = `${size}px`;
    }
  });
  document.querySelectorAll(".win-body").forEach((el) => {
    let lo = u * 0.8;
    let hi = u * (data.settings.windowCount >= 5 ? 1.75 : 1.95);
    el.style.fontSize = `${hi}px`;
    if (el.scrollHeight <= el.clientHeight + 1) return;
    for (let k = 0; k < 9; k++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      if (el.scrollHeight <= el.clientHeight + 1) lo = mid;
      else hi = mid;
    }
    el.style.fontSize = `${lo}px`;
  });
}

// ---------- her saniye ----------
function tick(force = false) {
  const now = Date.now();
  const d = new Date(now);
  const { start, end } = dayWindow(now);
  const span = end - start;
  const raw = (now - start) / span;
  const p = Math.min(1, Math.max(0, raw));
  const inDay = raw >= 0 && raw < 1;

  // saat
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const colonDim = d.getSeconds() % 2 === 1 ? " dim" : "";
  $("clock").innerHTML =
    `<span class="d">${hh[0]}</span><span class="d">${hh[1]}</span>` +
    `<span class="colon${colonDim}">:</span>` +
    `<span class="d">${mm[0]}</span><span class="d">${mm[1]}</span>` +
    `<span class="sec">${pad(d.getSeconds())}</span>`;
  if (force || d.getSeconds() === 0) {
    $("date").textContent = d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  }

  // şerit
  $("room").classList.toggle("off-day", !inDay);
  $("past").style.width = `${p * 100}%`;
  $("now").style.left = `${p * 100}%`;
  $("nowPill").textContent = `${hh}:${mm}`;

  const block = inDay ? Math.min(3, Math.floor(p * 4)) : -1;
  document.querySelectorAll(".seg").forEach((s, i) => s.classList.toggle("is-current", i === block));
  document.querySelectorAll(".hour-label").forEach((l) => {
    l.classList.toggle("past", start + Number(l.dataset.h) * 3600e3 <= now);
  });

  // durum kartı
  const blkColors = ["var(--mint-deep)", "var(--mustard-2)", "var(--orange)", "var(--petrol)"];
  if (inDay) {
    const blockEnd = start + (block + 1) * 4 * 3600e3;
    $("blockKicker").textContent = `Blok ${block + 1} / 4`;
    $("blockName").textContent = data.settings.blockNames[block];
    $("blockRemain").innerHTML = fmtDur(blockEnd - now);
    $("status").style.setProperty("--blk", blkColors[block]);
    $("dayText").innerHTML = `Gün %${Math.floor(p * 100)} · ${fmtDur(end - now)} kaldı`;
  } else if (raw < 0) {
    $("blockKicker").textContent = "Gün başlamadı";
    $("blockName").textContent = `${hourLabel(data.settings.dayStart)}:00'de`;
    $("blockRemain").innerHTML = fmtDur(start - now);
    $("dayText").textContent = "Dinlen, hazırlan.";
  } else {
    $("blockKicker").textContent = "Gün bitti";
    $("blockName").textContent = "Dinlen";
    $("blockRemain").textContent = "—";
    $("dayText").textContent = "Yarın yeni 16 saat.";
  }
  $("dayFill").style.width = `${p * 100}%`;

  // blok geçişi
  if (lastBlock !== null && block !== lastBlock && block >= 0 && !force) {
    if (data.settings.flash.onBlockChange) flash();
    showToast(`Blok ${block + 1} başladı`, data.settings.blockNames[block]);
  }
  lastBlock = block;

  // işaretler
  const today = new Date(start);
  let nextFound = false;
  document.querySelectorAll(".marker").forEach((el) => {
    const [h, m] = el.dataset.time.split(":").map(Number);
    const t = new Date(today);
    t.setHours(h, m, 0, 0);
    if (t.getTime() < start) t.setDate(t.getDate() + 1);
    const pos = (t.getTime() - start) / span;
    el.hidden = pos < 0 || pos > 1;
    el.style.left = `${pos * 100}%`;
    const done = t.getTime() <= now;
    el.classList.toggle("done", done);
    el.classList.toggle("next", !done && !nextFound && !el.hidden);
    if (!done && !el.hidden) nextFound = true;

    const key = `${t.toDateString()} ${el.dataset.time}`;
    if (done && now - t.getTime() < 60e3 && !firedMarkers.has(key) && !force) {
      firedMarkers.add(key);
      if (data.settings.flash.onMarker) flash();
      showToast(`⏰ ${el.dataset.time}`, el.querySelector(".marker-pill > span").textContent);
    }
    if (done) firedMarkers.add(key);
  });
}

// ---------- flaş ----------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function flash() {
  const mode = data.settings.flash.mode;
  const col = () => (mode === "white" ? "#ffffff" : mode === "color" ? pick(BRIGHT.slice(1)) : pick(BRIGHT));
  const c = [col(), col(), col()];
  if (mode === "mix") c[0] = "#ffffff";
  $("flash").animate(
    [
      { opacity: 0, backgroundColor: c[0] },
      { opacity: 1, backgroundColor: c[0], offset: 0.07 },
      { opacity: 0, backgroundColor: c[0], offset: 0.2 },
      { opacity: 1, backgroundColor: c[1], offset: 0.3 },
      { opacity: 0, backgroundColor: c[1], offset: 0.45 },
      { opacity: 0.95, backgroundColor: c[2], offset: 0.56 },
      { opacity: 0, backgroundColor: c[2], offset: 1 },
    ],
    { duration: 1500, easing: "ease-out" }
  );
}

let flashTimer = null;
function scheduleFlash() {
  clearTimeout(flashTimer);
  const f = data.settings.flash;
  if (!f.enabled || PREVIEW) return;
  const min = Math.max(1, Math.min(f.minMinutes, f.maxMinutes));
  const max = Math.max(min, f.maxMinutes);
  const wait = (min + Math.random() * (max - min)) * 60e3;
  flashTimer = setTimeout(() => {
    flash();
    scheduleFlash();
  }, wait);
}

let toastTimer = null;
function showToast(kicker, text) {
  if (PREVIEW) return;
  $("toastKicker").textContent = kicker;
  $("toastText").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 25e3);
}
$("toast").addEventListener("click", () => ($("toast").hidden = true));

// ---------- veri ----------
function apply(next, source) {
  const key = JSON.stringify({ ...next, updatedAt: 0 });
  if (next.updatedAt < data.updatedAt && renderedKey) return;
  const flashKey = JSON.stringify(data.settings.flash);
  data = next;
  if (key !== renderedKey) {
    renderedKey = key;
    buildStatic();
  }
  if (JSON.stringify(data.settings.flash) !== flashKey || !flashTimer) scheduleFlash();
  setSync(true, source);
}

function setSync(ok, source) {
  const el = $("sync");
  el.classList.toggle("err", !ok);
  const t = data.updatedAt > 1e12 ? new Date(data.updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—";
  el.textContent = ok ? `${source} · ${t}` : "çevrimdışı";
}

async function pull() {
  try {
    apply(await fetchPublished(), "senkron");
  } catch {
    setSync(false);
  }
}

window.addEventListener("storage", (e) => {
  if (e.key === DATA_KEY) {
    const local = loadLocal();
    if (local) {
      if (PREVIEW) data.updatedAt = 0; // önizleme her zaman taslağı gösterir
      apply(local, "yerel");
    }
  }
});

// ---------- TV kullanım kolaylıkları ----------
async function keepAwake() {
  try {
    await navigator.wakeLock?.request("screen");
  } catch {
    /* desteklenmiyor */
  }
}
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && keepAwake());

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "f") toggleFullscreen();
  if (e.key === "t") flash();
  if (e.key === "c") location.href = "control.html";
});
document.addEventListener("dblclick", toggleFullscreen);
window.addEventListener("message", (e) => {
  if (e.origin === location.origin && e.data === "dopamin:flash") flash();
});

let idleTimer = null;
document.addEventListener("mousemove", () => {
  document.body.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add("idle"), 3000);
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitAll, 150);
});

// ---------- başlat ----------
(async function init() {
  const local = loadLocal();
  if (PREVIEW && local) {
    local.updatedAt = 0;
    apply(local, "yerel");
  } else {
    apply(local || data, local ? "yerel" : "varsayılan");
    if (!PREVIEW) {
      await pull();
      setInterval(pull, POLL_MS);
    }
  }
  document.fonts?.ready.then(fitAll);
  setInterval(tick, 1000);
  if (!PREVIEW) keepAwake();
  if (params.has("flash")) setTimeout(flash, 800);
})();
