// Pencere temaları. Görsel stil assets/css/tv.css içindeki .theme-<id> sınıflarında.
export const THEMES = [
  { id: "hardal", name: "Hardal Niş", swatch: ["#eec84a", "#fbf6ec"] },
  { id: "portakal", name: "Portakal Kadife", swatch: ["#ea6a2c", "#fbf6ec"] },
  { id: "mint", name: "Mint Oluk", swatch: ["#5fb49d", "#ffffff"] },
  { id: "antrasit", name: "Antrasit Lamba", swatch: ["#232327", "#cfa750"] },
  { id: "pudra", name: "Pudra Kadife", swatch: ["#f3b7a1", "#fbf6ec"] },
  { id: "petrol", name: "Petrol Niş", swatch: ["#1d5a56", "#e3f4ee"] },
  { id: "altin", name: "Altın Kubbe", swatch: ["#cfa750", "#fbf6ec"] },
];

export const themeIds = THEMES.map((t) => t.id);

// Yan yana iki pencere aynı temayı almasın diye karıştırılmış dizi döner.
export function randomThemes(n) {
  const pool = [...themeIds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out = [];
  for (let i = 0; i < n; i++) out.push(pool[i % pool.length]);
  return out;
}

// Şeridin 4 bloğunun sabit temaları (sabah → gece akışı)
export const BLOCK_THEMES = ["mint", "hardal", "portakal", "gece"];
