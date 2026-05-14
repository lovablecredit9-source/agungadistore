# Halaman "Tentang" Anon Chat

Mengganti `toast.info` pada item "Tentang" di pengaturan Anon Chat dengan halaman penuh seperti screenshot, lengkap dengan 5 sub-halaman.

## Struktur halaman

**Tentang** (menu utama) — daftar 5 item dengan ikon:
1. **Pulihkan langganan** — tombol untuk cek/restore status premium akun Anon (panggil ulang `fetchAnonAccount`, tampilkan toast "Tidak ada langganan aktif" / "Langganan dipulihkan").
2. **Privasi data** — halaman teks: "Seluruh chat dan file media disimpan di server kami. Mereka digunakan untuk: sistem deteksi otomatis spam, memulihkan chat setelah aplikasi diinstal ulang. Datamu tidak pernah dan tidak akan pernah dijual ke siapa pun…"
3. **Aturan** — halaman daftar peraturan dengan heading + paragraf: Iklan, Menjual dan meminta-minta, Mengirim pornografi anak, Penghinaan dan Ancaman, Kekerasan, Konten Penghinaan (+ tambah: Spam, Identitas Palsu).
4. **Tutorial** — slider/carousel bergambar dengan logo 🥷 anon.chat di header dan tombol panah lanjut. Minimal 3 slide (kirim foto/voice, panggilan, tambah teman), slide terakhir tombol "Selesai".
5. **Informasi Sistem** — kartu data: Versi aplikasi, ID Akun (visitor_id), Perangkat (user-agent ringkas via Client Hints), Sistem (OS) + 2 link bawah: Ketentuan Penggunaan & Kebijakan Privasi (buka modal teks).

## Perubahan file

- `src/components/AnonChatTab.tsx`
  - Tambah View baru: `about | about_privacy | about_rules | about_tutorial | about_system`.
  - Ganti onClick item "Tentang" → `setView("about")`.
  - Tambah 5 blok render sub-halaman dengan header "← Kembali" + judul, mengikuti gaya `notif`/`appearance`.
  - Tutorial pakai state `tutorialStep` lokal + transisi sederhana, ikon mask emoji untuk header.
  - Informasi Sistem pakai `getVisitorId()` + `navigator.userAgent`/`userAgentData` untuk Perangkat & OS, versi aplikasi dari konstanta `APP_VERSION` (definisikan `const APP_VERSION = "v5.35.0"` selaras changelog).
  - Nav bawah `InnerNav` tetap `active="settings"`, kembali ke `prefs`.

## Catatan

- Semua teks Bahasa Indonesia mengikuti screenshot persis.
- Tidak butuh perubahan database — murni UI/konten statis.
- Tutorial pakai gambar placeholder generik (gradient + emoji) agar tidak butuh upload aset.
