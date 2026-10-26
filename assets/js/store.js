// Veri modeli, yerel kayıt ve GitHub üzerinden senkron.
import { randomThemes } from "./themes.js?v=20261026161052";

export const DATA_KEY = "dopamin:data";
export const SYNC_KEY = "dopamin:sync";
export const DAY_HOURS = 16;

export const DEFAULT_DATA = {
  version: 1,
  updatedAt: 0,
  settings: {
    title: "Dopamin",
    dayStart: 8,
    blockNames: ["Sabah", "Öğle", "İkindi", "Akşam"],
    windowCount: 4,
    wiggle: true,
    footer: "Tek iş. Şimdi. Sonra mola.",
    flash: {
      enabled: true,
      mode: "mix", // white | color | mix
      minMinutes: 15,
      maxMinutes: 40,
      onBlockChange: true,
      onMarker: true,
    },
  },
  markers: [
    { time: "10:30", label: "Stand-up" },
    { time: "13:00", label: "Öğle arası" },
    { time: "17:30", label: "Gün sonu gözden geçir" },
  ],
  windows: [
    {
      id: "w1",
      title: "Bugünün Odakları",
      theme: "hardal",
      body: "- [ ] **Tek büyük iş:** sunum taslağı\n- [ ] 3 e-postayı cevapla\n- [x] Sabah planı\n- [ ] 25 dk derin çalışma × 4",
    },
    {
      id: "w2",
      title: "Önemli Konular",
      theme: "portakal",
      body: "### Bu hafta\n- !!Cuma teslim!! müşteri raporu\n- Fatura ödemeleri\n- ==Doktor randevusu== Perşembe 15:00",
    },
    {
      id: "w3",
      title: "Haftanın Görünümü",
      theme: "mint",
      body: "1. **Pzt** — Planlama\n2. **Sal** — Derin iş\n3. **Çar** — Toplantılar\n4. **Per** — Üretim\n5. **Cum** — Teslim + kapanış",
    },
    {
      id: "w4",
      title: "Hatırlatmalar",
      theme: "antrasit",
      body: "- Su iç 💧\n- Her blok sonunda 10 dk yürü\n- Telefonu başka odaya bırak\n\n> Başlamak, bitirmenin yarısı.",
    },
    {
      id: "w5",
      title: "Notlar",
      theme: "pudra",
      body: "Aklına geleni buraya yaz, sonra dön.",
    },
  ],
};

const clone = (o) => JSON.parse(JSON.stringify(o));

export function normalize(input) {
  const d = clone(DEFAULT_DATA);
  if (!input || typeof input !== "object") return d;
  const s = input.settings || {};
  Object.assign(d.settings, s, { flash: { ...d.settings.flash, ...(s.flash || {}) } });
  const names = Array.isArray(s.blockNames) ? s.blockNames : [];
  d.settings.blockNames = [0, 1, 2, 3].map((i) => names[i] ?? DEFAULT_DATA.settings.blockNames[i]);
  d.settings.dayStart = clampInt(d.settings.dayStart, 0, 23, 8);
  d.settings.windowCount = clampInt(d.settings.windowCount, 3, 5, 4);
  if (Array.isArray(input.markers)) {
    d.markers = input.markers
      .filter((m) => m && /^\d{1,2}:\d{2}$/.test(m.time || ""))
      .map((m) => ({ time: m.time.padStart(5, "0"), label: String(m.label || "") }));
  }
  if (Array.isArray(input.windows)) {
    const fallback = randomThemes(5);
    d.windows = [0, 1, 2, 3, 4].map((i) => {
      const w = input.windows[i] || {};
      return {
        id: w.id || `w${i + 1}`,
        title: String(w.title ?? ""),
        theme: w.theme || fallback[i],
        body: String(w.body ?? ""),
      };
    });
  }
  d.updatedAt = Number(input.updatedAt) || 0;
  return d;
}

function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

// ---- yerel ----
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* depolama kapalı olabilir */
  }
}

export function loadLocal() {
  const raw = safeGet(DATA_KEY);
  if (!raw) return null;
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocal(data) {
  safeSet(DATA_KEY, JSON.stringify(data));
}

// ---- senkron ayarı (yalnızca kontrol panelinin tarayıcısında) ----
export function repoFromLocation(loc = location) {
  const host = loc.hostname;
  if (host.endsWith(".github.io")) {
    const owner = host.split(".")[0];
    const seg = loc.pathname.split("/").filter(Boolean)[0];
    const repo = seg && !seg.includes(".") ? seg : host;
    return { owner, repo };
  }
  return { owner: "", repo: "" };
}

export function loadSync() {
  const base = { ...repoFromLocation(), branch: "main", path: "data.json", token: "" };
  try {
    return { ...base, ...JSON.parse(safeGet(SYNC_KEY) || "{}") };
  } catch {
    return base;
  }
}

export function saveSync(cfg) {
  safeSet(SYNC_KEY, JSON.stringify(cfg));
}

// ---- uzak (TV): yayınlanan siteden data.json ----
export async function fetchPublished() {
  const res = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`data.json ${res.status}`);
  return normalize(await res.json());
}

// ---- GitHub API (kontrol paneli) ----
const b64encode = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

function explain(status, msg = "") {
  if (status === 401) return "Token geçersiz ya da süresi dolmuş. Yeni token oluşturup Senkron kartına gir.";
  if (status === 403 && /not accessible/i.test(msg))
    return "Token'ın bu repoya yazma izni yok. Token ayarı: Repository access → Only select repositories → bu repo; Permissions → Contents → Read and write.";
  if (status === 404) return "Repo ya da dal bulunamadı (veya token bu repoyu göremiyor). Owner / repo / dal adlarını kontrol et.";
  if (status === 409) return "Dosya aynı anda değişti, tekrar yayınla.";
  return msg || `GitHub ${status}`;
}

async function gh(cfg, path, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
    ...opts,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(explain(res.status, body.message));
    err.status = res.status;
    throw err;
  }
  return body;
}

export async function fetchRemoteFile(cfg) {
  const enc = encodeURIComponent(cfg.branch);
  try {
    const file = await gh(cfg, `/contents/${cfg.path}?ref=${enc}`);
    return { sha: file.sha, data: normalize(JSON.parse(b64decode(file.content))) };
  } catch (e) {
    if (e.status === 404) return { sha: null, data: null };
    throw e;
  }
}

export async function publishRemote(cfg, data) {
  if (!cfg.owner || !cfg.repo || !cfg.token) throw new Error("Senkron ayarları eksik (owner / repo / token).");
  const { sha } = await fetchRemoteFile(cfg);
  const content = b64encode(JSON.stringify(data, null, 2) + "\n");
  const stamp = new Date(data.updatedAt).toLocaleString("tr-TR");
  return gh(cfg, `/contents/${cfg.path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Dashboard verisi güncellendi · ${stamp}`,
      content,
      branch: cfg.branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export async function testRemote(cfg) {
  const repo = await gh(cfg, "");
  return { name: repo.full_name, canPush: !!repo.permissions?.push };
}
