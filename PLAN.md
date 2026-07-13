# AFK Arena — Teknik Plan

Ekran köşesinde çalışan, çok düşük kaynak tüketen, AFK roguelite idle masaüstü
oyunu. Bu doküman teknoloji seçimlerini, klasör yapısını, performans stratejisini
ve fazlı teslim planını özetler.

## 1. Teknoloji Seçimleri (gerekçeli)

| Katman | Seçim | Gerekçe |
|---|---|---|
| Kabuk | **Tauri v2** (Rust + sistem WebView) | Electron'a göre ~10x küçük binary, düşük RAM/pil. Chromium paketlemez, OS WebView'ini kullanır. Düşük-kaynak şartının temeli. |
| Frontend | **React 19 + TypeScript + Vite** | Hızlı HMR, tip güvenliği, küçük prod bundle. React yalnızca **menü/HUD** için; sıcak render yolunda değil. |
| State | **Zustand** | Provider yok, seçici (selector) abonelik → gereksiz re-render yok. Sim↔UI köprüsü için minimal. |
| Render | Tek **`<canvas>`** + `requestAnimationFrame` | Sık değişen sayılar/animasyon DOM'da değil canvas'ta. React re-render'ı saniyede 2-4'e sabitlenir. |
| Kalıcılık | **JSON save**, Rust `std::fs` komutu (`save_game`/`load_game`) | fs-plugin scope izin karmaşasından kaçınıp `app_data_dir` altına atomik (tmp+rename) yazma. |
| Test | **Vitest** | `src/game/` saf TS; deterministik combat/offline testleri. |
| Build | Tauri bundler → macOS `.app`/`.dmg` (notarize'a hazır), sonra Windows | Spec önceliği macOS. |

## 2. Klasör Yapısı

```
src/
  game/       Saf TS simülasyon (framework-bağımsız, test edilebilir)
    constants.ts   Tuning sabitleri (tick hızı, ölçek, cap'ler)
    rng.ts         Seedable PRNG (mulberry32), save'de taşınan state
    types.ts       GameState + alt tipler, UISnapshot, OfflineReport
    economy.ts     Wave→HP/altın ölçek formülleri, spawn, beklenen DPS
    combat.ts      stepSim(): tek sabit tick (auto-battle, crit)
    offline.ts     applyOffline(): analitik/loop-capped toplu ilerleme
    save.ts        Başlangıç state, serialize/deserialize + migrate
    index.ts       Barrel
  render/     Canvas katmanı
    renderer.ts    Sahne çizimi (pixel-art), hit-flash, hasar sayıları
    particles.ts   Object-pool (ring buffer, sıfır alokasyon)
  store/
    gameStore.ts   Zustand — seçici abonelikli UI snapshot
  platform/
    storage.ts     Tauri invoke sarmalayıcı (save/load)
  ui/         React (Zustand'a bağlı)
    App.tsx, TitleBar.tsx, Hud.tsx, OfflineModal.tsx, format.ts, styles.css
  loop.ts     GameLoop: sim/render/store/save orkestrasyonu
  main.tsx    Mount
src-tauri/    Pencere config, fs komutları, capabilities
```

**Bağımlılık yönü:** `ui → store → (loop) → game`, `render → game`. `game/` hiçbir
şeye bağlı değil (Tauri/React/DOM yok) → izole test edilebilir.

## 3. Performans Stratejisi (baştan gömülü)

1. **Sim ↔ Render ayrık.** Sabit-timestep sim (10 tick/sn, `TICK_DT=100ms`),
   accumulator pattern. Render bağımsız `requestAnimationFrame`.
2. **Spiral-of-death guard.** Kare başına max 5 sim adımı; fazlası atılır.
3. **React re-render ≤ ~3/sn.** Loop, `STORE_PUSH_INTERVAL_MS=300` ile store'a
   hafif snapshot yollar. Bileşenler seçici selector'la abone (`s => s.gold`).
   Sık değişen her şey (hasar sayıları, HP bar, sprite) canvas'ta.
4. **Focus yokken render kısılır.** Blur → render ~5fps (`UNFOCUSED_FRAME_INTERVAL_MS=200`),
   sim tam hızda devam. Idle'da CPU ~%0-1.
5. **Offline/stall = analitik.** Kapanışta `lastSeen` timestamp. Açılışta veya
   uzun stall/minimize'da `(now-lastSeen)` süresi **tek tek tick atılmadan**
   `applyOffline()` ile O(wave) hesaplanır (beklenen DPS, süre + iterasyon cap).
   Aynı fonksiyon hem açılış offline'ı hem de loop içi büyük boşlukları karşılar.
6. **Object pooling.** Parçacıklar sabit boyutlu ring-buffer; runtime'da alokasyon yok.
7. **Autosave.** 10sn'de bir + kapanışta (`onCloseRequested` → save → destroy).
8. **Pencere.** Frameless, transparent, küçük sabit boyut (360×210), köşeye snap
   (Rust setup, bottom-right), `data-tauri-drag-region` ile sürüklenir,
   alwaysOnTop ayardan.

## 4. Teslim Planı (her faz sonunda çalışan build)

1. **İskelet (bu faz):** Tauri+React+Vite, frameless köşe penceresi, sabit-timestep
   sim, "düşman öldür → altın" döngüsü, canvas'ta 1 kahraman + 1 düşman,
   save/load + offline. Çalışan `.app`.
2. **Roguelite:** stage/biome ilerleme, 3-seç-1 relic ekranı, boss, birkaç
   relic + düşman tipi.
3. **Rebirth:** prestige reset, Essence, permanent meta-tree.
4. **Çeşitlilik & juice:** ek class/relic/biome, particle, ses.
5. **Release:** ikon, imza/notarize, build script, (ops.) Steamworks.
