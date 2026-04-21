
## Tambah Changelog v2.8 — 21 April 2026

Saya akan menambahkan entri changelog terbaru **v2.8 (21 April 2026)** di tab "Update" pada `src/pages/Index.tsx`, dan menurunkan v2.7 jadi entri biasa (hapus flag `isNew`).

### Isi v2.8 (21 entri lengkap)

**🎨 Tema iOS Dark Vibrant baru (5 item)**
- Tema baru iOS Dark Vibrant — true black canvas + aksen Apple system colors
- Design tokens iOS global: surface bertingkat L1/L2/L3, hairline divider, radius pill
- Utility class baru: `ios-card-vibrant`, `ios-surface-1/2/3`, `ios-tint-*`, `ios-grad-bronze/silver/gold/diamond/jackpot`, `ios-btn-filled/tinted/gray`, `ios-pressable`
- Background gelap dengan dual radial glow ala Apple Music
- Tipografi SF Pro Display/Text dengan letter-spacing -0.011em

**🎰 Refactor Scratch-Off Lottery (3 item)**
- Kartu pakai gradient rarity, badge tinted, modal sheet backdrop-blur xl + spring animation
- Tombol pill putih ala iOS dengan `ios-pressable` (scale 0.96 saat ditekan)
- Achievement grid pakai `ios-tint-yellow` untuk unlocked, grayscale untuk locked

**💰 Rebalance hadiah Scratch-Off (6 item)**
- Jackpot terasa BESAR tapi LANGKA (~3% chance), sistem Zonk 40-50%
- Bronze (50): +30/+60/+100, jackpot +200
- Silver (150): +100/+200/+350, jackpot +600
- Gold (500): +200/+700/+800/+1000/+1500, jackpot +2000
- Diamond (1000): +200/+600/+700/+1500/+2500, jackpot +3000, MEGA +5000
- House edge positif agar ekonomi koin sehat

**🔧 Perbaikan transaksi & bug (4 item)**
- streak_coins dipotong saat beli, ditambahkan setelah scratch >55%
- Proteksi double-claim dengan `claimedRef`
- `setScratching` membedakan kartu berbayar vs gratis (free key terpisah)
- Combo multiplier diturunkan jadi ringan (1.0 → 1.2x maks)

**🏆 Tweaks lain (3 item)**
- Achievement bonus disesuaikan: First Win +10, High Roller +25, Jackpot Hunter +50, Diamond Master +100
- Modal scratch bisa ditutup dengan tap di luar setelah claim
- Banner kartu gratis harian dengan shimmer + `ios-grad-jackpot` rainbow

### File yang diubah

1. `src/pages/Index.tsx` (baris 3477-3502)
   - Tambah objek entry v2.8 di posisi pertama dengan `isNew: true`
   - Hapus `isNew: true` dari entry v2.7

### Catatan teknis

- Tidak ada perubahan komponen lain — hanya data array changelog
- Indikator visual baru (titik biru animate-pulse + ring primary) otomatis berlaku karena render sudah pakai flag `isNew`
- v2.7 tetap ditampilkan dengan styling normal (tanpa highlight)
