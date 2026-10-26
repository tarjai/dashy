// Dopamin — kontrol paneli
import { THEMES, randomThemes } from "./themes.js";
import {
  DAY_HOURS,
  DEFAULT_DATA,
  fetchPublished,
  fetchRemoteFile,
  loadLocal,
  loadSync,
  normalize,
  publishRemote,
  saveLocal,
  saveSync,
  testRemote,
} from "./store.js";

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");

const TEMPLATES = {
  odak: { title: "Bugünün Odakları", body: "- [ ] **Tek büyük iş:** \n- [ ] \n- [ ] \n- [ ] " },
  onemli: { title: "Önemli Konular", body: "- !!Acil:!! \n- ==Unutma:== \n- " },
  hafta: {
    title: "Haftanın Görünümü",
    body: "1. **Pzt** — \n2. **Sal** — \n3. **Çar** — \n4. **Per** — \n5. **Cum** — \n6. **Cmt** — \n7. **Paz** — ",
  },
  hatirlat: { title: "Hatırlatmalar", body: "- Su iç 💧\n- Her blok sonunda mola\n- Telefonu uzağa koy" },
  bos: { title: "", body: "" },
};
const BLOCK_CHIP = [
  ["var(--mint-deep)", "var(--ink)"],
  ["var(--mustard)", "var(--ink)"],
  ["var(--orange)", "#fff"],
  ["var(--petrol)", "var(--gold-2)"],
];

let data = normalize(DEFAULT_DATA);
let sync = loadSync();
let publishedAt = 0;

// ---------- durum ----------
function status(text, kind = "") {
  const el = $("status");
  el.textContent = text;
  el.className = `bar-status ${kind}`;
}
function dirtyStatus() {
  if (data.updatedAt > publishedAt) status("Taslak yerelde kaydedildi · yayınlanmamış değişiklik var", "warn");
  else status("Güncel · TV ile aynı", "ok");
}

let saveTimer = null;
function changed() {
  data.updatedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveLocal(data); // aynı tarayıcıdaki önizleme + TV sekmesi anında güncellenir
    dirtyStatus();
  }, 200);
}

// ---------- pencereler ----------
function renderWindows() {
  const list = $("winList");
  list.innerHTML = "";
  const tpl = $("winTpl");
  data.windows.forEach((w, i) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const theme = () => THEMES.find((t) => t.id === w.theme) || THEMES[0];
    const paint = () => node.style.setProperty("--c", theme().swatch[0]);
    node.classList.toggle("off", i >= data.settings.windowCount);
    node.querySelector(".wnum").textContent = i + 1;

    const title = node.querySelector(".wtitle");
    const body = node.querySelector(".wbody");
    title.value = w.title;
    body.value = w.body;
    title.addEventListener("input", () => {
      w.title = title.value;
      changed();
    });
    body.addEventListener("input", () => {
      w.body = body.value;
      changed();
    });

    const chips = node.querySelector(".themes");
    for (const t of THEMES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `theme-chip${t.id === w.theme ? " on" : ""}`;
      b.innerHTML = `<i style="background:linear-gradient(135deg, ${t.swatch[0]} 55%, ${t.swatch[1]} 55%)"></i>${t.name}`;
      b.addEventListener("click", () => {
        w.theme = t.id;
        chips.querySelectorAll(".theme-chip").forEach((c) => c.classList.toggle("on", c === b));
        paint();
        changed();
      });
      chips.appendChild(b);
    }
    paint();

    node.querySelector(".wtpl").addEventListener("change", (e) => {
      const t = TEMPLATES[e.target.value];
      e.target.value = "";
      if (!t) return;
      if (w.body.trim() && !confirm("Bu pencerenin içeriği şablonla değiştirilsin mi?")) return;
      w.title = title.value = t.title;
      w.body = body.value = t.body;
      changed();
      body.focus();
    });

    list.appendChild(node);
  });
}

function renderCount() {
  $("countCtl")
    .querySelectorAll("button")
    .forEach((b) => b.classList.toggle("on", Number(b.dataset.n) === data.settings.windowCount));
  $("winList")
    .querySelectorAll(".wcard")
    .forEach((c, i) => c.classList.toggle("off", i >= data.settings.windowCount));
}

$("countCtl").addEventListener("click", (e) => {
  const n = Number(e.target.dataset?.n);
  if (!n) return;
  data.settings.windowCount = n;
  renderCount();
  changed();
});

$("shuffle").addEventListener("click", () => {
  const themes = randomThemes(data.windows.length);
  data.windows.forEach((w, i) => (w.theme = themes[i]));
  renderWindows();
  changed();
});

// ---------- ayarlar ----------
function renderSettings() {
  const s = data.settings;
  const ds = $("dayStart");
  ds.innerHTML = "";
  for (let h = 0; h < 24; h++) ds.add(new Option(`${pad(h)}:00`, h, false, h === s.dayStart));
  $("dayEnd").textContent = `${pad((s.dayStart + DAY_HOURS) % 24)}:00 · 16 saat`;

  const bn = $("blockNames");
  bn.innerHTML = "";
  s.blockNames.forEach((name, i) => {
    const l = document.createElement("label");
    const from = pad((s.dayStart + i * 4) % 24);
    const to = pad((s.dayStart + i * 4 + 4) % 24);
    l.innerHTML = `<span style="background:${BLOCK_CHIP[i][0]};color:${BLOCK_CHIP[i][1]}">${from}–${to}</span><input type="text" maxlength="18" />`;
    const inp = l.querySelector("input");
    inp.value = name;
    inp.addEventListener("input", () => {
      s.blockNames[i] = inp.value;
      changed();
    });
    bn.appendChild(l);
  });

  $("wiggle").checked = s.wiggle;
  $("flashOn").checked = s.flash.enabled;
  $("flashMode").value = s.flash.mode;
  $("flashMin").value = s.flash.minMinutes;
  $("flashMax").value = s.flash.maxMinutes;
  $("flashBlock").checked = s.flash.onBlockChange;
  $("flashMarker").checked = s.flash.onMarker;
  $("title").value = s.title;
  $("footer").value = s.footer;
  renderMarkers();
}

$("dayStart").addEventListener("change", (e) => {
  data.settings.dayStart = Number(e.target.value);
  renderSettings();
  changed();
});
const bind = (id, fn) => $(id).addEventListener("input", (e) => (fn(e.target), changed()));
bind("wiggle", (t) => (data.settings.wiggle = t.checked));
bind("flashOn", (t) => (data.settings.flash.enabled = t.checked));
bind("flashMode", (t) => (data.settings.flash.mode = t.value));
bind("flashMin", (t) => (data.settings.flash.minMinutes = Math.max(1, Number(t.value) || 1)));
bind("flashMax", (t) => (data.settings.flash.maxMinutes = Math.max(1, Number(t.value) || 1)));
bind("flashBlock", (t) => (data.settings.flash.onBlockChange = t.checked));
bind("flashMarker", (t) => (data.settings.flash.onMarker = t.checked));
bind("title", (t) => (data.settings.title = t.value));
bind("footer", (t) => (data.settings.footer = t.value));

function renderMarkers() {
  const list = $("markerList");
  list.innerHTML = "";
  data.markers
    .sort((a, b) => a.time.localeCompare(b.time))
    .forEach((m, i) => {
      const row = document.createElement("div");
      row.className = "marker-row";
      row.innerHTML = `<input type="time" step="300" /><input type="text" maxlength="32" placeholder="Etiket" /><button class="x" title="Sil">×</button>`;
      const [time, label] = row.querySelectorAll("input");
      time.value = m.time;
      label.value = m.label;
      time.addEventListener("change", () => {
        if (time.value) m.time = time.value;
        changed();
      });
      label.addEventListener("input", () => {
        m.label = label.value;
        changed();
      });
      row.querySelector(".x").addEventListener("click", () => {
        data.markers.splice(i, 1);
        renderMarkers();
        changed();
      });
      list.appendChild(row);
    });
}
$("addMarker").addEventListener("click", () => {
  const d = new Date(Date.now() + 3600e3);
  data.markers.push({ time: `${pad(d.getHours())}:00`, label: "" });
  renderMarkers();
  changed();
  $("markerList").querySelector(".marker-row:last-child input[type=text]")?.focus();
});

// ---------- senkron ayarı ----------
function renderSync() {
  $("ghOwner").value = sync.owner;
  $("ghRepo").value = sync.repo;
  $("ghBranch").value = sync.branch;
  $("ghToken").value = sync.token;
}
for (const [id, key] of [
  ["ghOwner", "owner"],
  ["ghRepo", "repo"],
  ["ghBranch", "branch"],
  ["ghToken", "token"],
]) {
  $(id).addEventListener("input", (e) => {
    sync[key] = e.target.value.trim();
    saveSync(sync);
  });
}
$("ghTest").addEventListener("click", async () => {
  status("GitHub'a bağlanılıyor…");
  try {
    const r = await testRemote(sync);
    status(r.canPush ? `Bağlantı tamam · ${r.name} (yazma izni var)` : `${r.name} okunuyor ama yazma izni yok`, r.canPush ? "ok" : "warn");
  } catch (e) {
    status(`Bağlantı hatası: ${e.message}`, "warn");
  }
});

// ---------- yayınla ----------
$("publish").addEventListener("click", async () => {
  const btn = $("publish");
  btn.disabled = true;
  status("Yayınlanıyor…");
  try {
    if (!data.updatedAt) data.updatedAt = Date.now();
    saveLocal(data);
    await publishRemote(sync, data);
    publishedAt = data.updatedAt;
    status("Yayınlandı ✓ · TV ~1 dakika içinde güncellenir", "ok");
  } catch (e) {
    status(`Yayınlanamadı: ${e.message}`, "warn");
  } finally {
    btn.disabled = false;
  }
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    $("publish").click();
  }
});

// ---------- önizleme ----------
const frame = $("previewFrame");
new ResizeObserver(([entry]) => {
  frame.style.transform = `scale(${entry.contentRect.width / 1920})`;
}).observe($("preview"));
$("testFlash").addEventListener("click", () => frame.contentWindow?.postMessage("dopamin:flash", "*"));

// ---------- yedek ----------
$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `dopamin-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    data = normalize(JSON.parse(await file.text()));
    renderAll();
    changed();
    status("JSON yüklendi · yayınlamayı unutma", "warn");
  } catch {
    status("Geçersiz JSON dosyası", "warn");
  }
  e.target.value = "";
});
$("resetBtn").addEventListener("click", () => {
  if (!confirm("Tüm içerik varsayılan örneğe dönsün mü?")) return;
  data = normalize(DEFAULT_DATA);
  renderAll();
  changed();
});

// ---------- başlat ----------
function renderAll() {
  renderWindows();
  renderCount();
  renderSettings();
}

(async function init() {
  renderSync();
  const local = loadLocal();
  let remote = null;
  try {
    remote = sync.token && sync.owner && sync.repo ? (await fetchRemoteFile(sync)).data : null;
  } catch {
    /* token yoksa / hatalıysa yayınlanan dosyaya düş */
  }
  if (!remote) {
    try {
      remote = await fetchPublished();
    } catch {
      /* yerel dosya sisteminden açılmış olabilir */
    }
  }
  publishedAt = remote?.updatedAt || 0;
  data = local && (!remote || local.updatedAt > remote.updatedAt) ? local : remote || local || data;
  renderAll();
  saveLocal(data);
  dirtyStatus();
  if (!sync.token) status("Yayınlamak için aşağıdaki Senkron kartına GitHub token gir", "warn");
})();
