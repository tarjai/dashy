# Dopamin — ADHD zaman & görev panosu

43" TV için scrollsuz tek sayfa pano + PC'den yönetilen kontrol paneli. Statik site, GitHub Pages üzerinde çalışır.

| Sayfa | Adres | Kullanım |
|---|---|---|
| TV ekranı | `/` | TV tarayıcısında aç, `Enter` / çift tık → tam ekran |
| Kontrol paneli | `/control.html` | PC'den içerik gir, **Kaydet & Yayınla** (`Ctrl+S`) |

## Özellikler
- **16 saatlik şerit** — 4 blok × 4 saat, her blok farklı tema; 15 dk çentikler, saat etiketleri, geçen süre taralı, ilerleyen kalın kırmızı "şimdi" çizgisi.
- **Durum kartı** — aktif blok, blokta kalan süre, günün yüzdesi.
- **3 / 4 / 5 pencere** — başlık + Markdown; 7 tema (niş kemer, kadife puf, antrasit lamba…), rastgele karıştırılabilir. Metin otomatik sığdırılır, kaydırma yok.
- **Wiggle** — pencereler farklı faz ve hızda çok hafif sallanır (kapatılabilir).
- **Rastgele flaş** — belirlenen aralıkta tam ekran beyaz/renkli yanıp sönme; blok geçişinde ve işaret saatlerinde de tetiklenir.
- **Şerit işaretleri** — saat + etiket; vaktinde tam ekran hatırlatma kartı.
- Dijital saat, ekran uyku kilidi (Wake Lock), boşta imleç gizleme.

## Senkron
TV, sitedeki `data.json` dosyasını 45 sn'de bir okur. Kontrol paneli bu dosyayı GitHub API ile repoya commit eder; Pages ~1 dk içinde yayınlar.

1. GitHub → Settings → Developer settings → **Fine-grained token** oluştur: yalnızca bu repo, *Contents: Read and write*.
2. Kontrol panelindeki **Senkron** kartına owner / repo / dal / token gir. Token yalnızca o tarayıcının `localStorage`'ında durur.

Aynı tarayıcıda açık TV sekmesi ve panel önizlemesi değişiklikleri anında gösterir.

## Kısayollar (TV)
`Enter`/`f` tam ekran · `t` flaş testi · `c` kontrol paneli · `?poll=30` okuma aralığı (sn) · `?flash` açılışta flaş

## Markdown
`# başlık` · `- madde` · `- [ ] görev` · `- [x] bitti` · `1. sıralı` · `**kalın**` · `*italik*` · `==vurgu==` · `!!acil!!` · `> alıntı` · `---`

## Yayın / önbellek
Kodda değişiklik yaptıktan sonra push etmeden önce `./bump.sh` çalıştır. Asset adreslerindeki `?v=` sürümünü ve `version.json`'u günceller. Açık duran TV yeni sürümü 45 sn içinde fark edip kendini yeniler.
