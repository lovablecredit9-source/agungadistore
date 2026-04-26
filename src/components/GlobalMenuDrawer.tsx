import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Menu,
  FileText,
  Code2,
  Info,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SectionKey = "terms" | "api" | "about" | "privacy";

interface ContentBlock {
  heading: string;
  body: string;
  bullets?: string[];
}

interface SectionDef {
  key: SectionKey;
  title: string;
  subtitle: string;
  icon: typeof FileText;
  /** tailwind gradient classes */
  gradient: string;
  /** soft tint for icon bg */
  tint: string;
  /** rich content blocks */
  blocks: ContentBlock[];
}

const SECTIONS: SectionDef[] = [
  {
    key: "terms",
    title: "Syarat & Ketentuan",
    subtitle: "Aturan penggunaan layanan",
    icon: FileText,
    gradient: "from-pink-500 via-rose-500 to-orange-400",
    tint: "bg-pink-500/15 text-pink-500",
    blocks: [
      {
        heading: "1. Penerimaan & Persetujuan",
        body: "Dengan mengakses, mendaftar, atau menggunakan aplikasi Agung Adi Store (selanjutnya disebut 'Layanan'), Anda menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan dalam dokumen ini secara penuh dan tanpa syarat. Apabila Anda tidak menyetujui salah satu atau seluruh ketentuan, mohon segera menghentikan penggunaan Layanan. Penggunaan berkelanjutan setelah pembaruan kebijakan dianggap sebagai bentuk persetujuan terhadap perubahan tersebut.",
      },
      {
        heading: "2. Definisi Istilah",
        body: "Untuk menghindari salah tafsir, berikut definisi istilah yang digunakan:",
        bullets: [
          "‘Pengguna’ adalah setiap orang yang membuat akun atau bertransaksi di Layanan.",
          "‘Saldo’ adalah nilai mata uang virtual internal yang tercatat pada akun pengguna.",
          "‘Token/Voucher’ adalah kode unik 16 karakter yang dapat ditukar dengan produk/layanan.",
          "‘Admin’ adalah pengelola resmi Agung Adi Store yang berwenang atas seluruh keputusan operasional.",
          "‘Konten Pengguna’ adalah materi yang diunggah pengguna seperti lagu, gambar, atau pesan tiket.",
        ],
      },
      {
        heading: "3. Pendaftaran & Akun Pengguna",
        body: "Pendaftaran mewajibkan data asli berupa nama lengkap, nomor HP aktif (format internasional didukung), email valid, dan kata sandi minimal 8 karakter. Anda bertanggung jawab penuh atas kerahasiaan kredensial. Seluruh aktivitas yang terjadi pada akun Anda dianggap sebagai tindakan Anda.",
        bullets: [
          "Satu nomor HP hanya untuk satu akun.",
          "Dilarang membuat akun ganda untuk menyalahgunakan promo, bonus, atau streak.",
          "Dilarang menggunakan identitas palsu, identitas orang lain, atau bot otomatis.",
          "Akun dapat dibekukan, dibatasi, atau dihapus tanpa pemberitahuan jika melanggar.",
          "Pemulihan akun yang dihapus karena pelanggaran tidak dijamin.",
        ],
      },
      {
        heading: "4. Saldo, Deposit & Penarikan",
        body: "Saldo bersifat non-tunai dan hanya berlaku di dalam ekosistem Agung Adi Store. Top up saldo dilakukan melalui WhatsApp resmi 085769302532 dengan alur deposit interaktif (`!deposit`). Saldo yang masuk akan tercatat real-time di aplikasi setelah diverifikasi admin.",
        bullets: [
          "Minimum & maksimum deposit mengikuti kebijakan terbaru di dalam aplikasi.",
          "Deposit pending dapat dibatalkan dalam jangka waktu tertentu sebelum verifikasi.",
          "Saldo TIDAK dapat dicairkan/diuangkan kembali (non-refundable) kecuali dalam kondisi khusus.",
          "Salah transfer/kelebihan transfer wajib dilaporkan maksimal 24 jam dengan bukti.",
          "Saldo dapat hangus apabila akun terbukti melakukan kecurangan.",
        ],
      },
      {
        heading: "5. Pembayaran & Kanal Resmi",
        body: "Seluruh pembayaran HANYA dilakukan melalui WhatsApp resmi 085769302532 dan/atau gateway pembayaran resmi yang ditampilkan di aplikasi. Kami TIDAK pernah meminta pembayaran ke nomor pribadi, akun media sosial palsu, atau perantara tidak resmi. Kerugian akibat transaksi di luar kanal resmi sepenuhnya menjadi tanggung jawab pengguna.",
      },
      {
        heading: "6. Voucher, Token & Kode Promo",
        body: "Voucher/token bersifat sekali pakai (16 karakter alfanumerik). Kode promo memiliki masa berlaku, kuota, dan ketentuan penggunaan masing-masing yang dapat dilihat di tab promo aplikasi.",
        bullets: [
          "Token yang sudah diklaim tidak dapat dibatalkan atau dikembalikan.",
          "Token rusak/tidak terbaca dapat dilaporkan dengan menyertakan kode dan bukti.",
          "Penyalahgunaan kode promo (mis. multi-akun, bot) menyebabkan pembatalan otomatis.",
          "Voucher diskon hanya berlaku untuk kategori produk tertentu sesuai aturan kode.",
        ],
      },
      {
        heading: "7. Produk Digital & Pengiriman",
        body: "Sebagian besar produk bersifat digital dan dikirim secara otomatis maksimal beberapa menit setelah pembayaran terverifikasi. Untuk produk yang memerlukan pemrosesan manual, estimasi waktu akan diinformasikan oleh admin.",
        bullets: [
          "Pastikan data tujuan (User ID, Server, Email, dll.) benar sebelum konfirmasi.",
          "Kesalahan input data oleh pengguna BUKAN tanggung jawab kami.",
          "Stok terbatas — sistem otomatis menolak transaksi jika stok habis.",
          "Komplain produk maksimal 1×24 jam dengan bukti screenshot/video.",
        ],
      },
      {
        heading: "8. Sistem Game, Streak & Reward",
        body: "Aplikasi menyediakan beragam mini game, daily streak, lucky wheel, lucky draw, scratch card, dan event berhadiah. Hadiah berupa saldo, koin, gem, voucher, atau item virtual lainnya yang nilainya ditentukan sistem.",
        bullets: [
          "Streak harian direset berdasarkan zona waktu WIB (UTC+7) pukul 00:00.",
          "Eksploitasi bug game (multi-claim, manipulasi waktu, modifikasi client) berakibat banned permanen.",
          "Sistem 3 nyawa berlaku pada game AI — habis nyawa wajib menunggu cooldown.",
          "Hadiah event terbatas waktu akan hangus jika tidak diklaim sebelum event berakhir.",
          "Keputusan sistem & admin terkait perhitungan reward bersifat final.",
        ],
      },
      {
        heading: "9. Sistem Sponsor & Rekber (Escrow)",
        body: "Iklan sponsor dari pihak ketiga ditampilkan di aplikasi dengan label terpisah dari produk admin. Untuk keamanan, transaksi sponsor diwajibkan menggunakan protokol Rekber Admin (escrow) via WhatsApp 085769302532. Transaksi langsung di luar rekber sepenuhnya risiko pengguna.",
      },
      {
        heading: "10. Konten Pengguna (Musik & Tiket)",
        body: "Pengguna dapat mengunggah lagu (publik/pribadi) ke Musik Publik dan mengirim pesan/lampiran melalui sistem tiket. Anda tetap menjadi pemilik konten, namun memberikan lisensi kepada Agung Adi Store untuk menampilkan, menyimpan, dan mendistribusikan konten dalam rangka penyelenggaraan Layanan.",
        bullets: [
          "Konten wajib bebas dari pelanggaran hak cipta pihak ketiga.",
          "Dilarang mengunggah konten SARA, pornografi, kekerasan, atau ilegal.",
          "Konten yang melanggar akan dihapus dan akun dapat ditindak.",
          "Sistem auto-check + review admin diberlakukan untuk lagu publik.",
        ],
      },
      {
        heading: "11. Larangan & Tindakan Pelanggaran",
        body: "Berikut tindakan yang DILARANG keras di dalam Layanan:",
        bullets: [
          "Eksploitasi celah keamanan, bug, atau race condition sistem.",
          "Scraping massal, reverse engineering, atau dekompilasi aplikasi.",
          "Manipulasi waktu perangkat untuk mengakali streak/cooldown.",
          "Menggunakan VPN/proxy untuk menghindari banned atau pembatasan wilayah.",
          "Phishing, impersonasi admin, atau penipuan terhadap pengguna lain.",
          "Menyebarkan ujaran kebencian, SARA, atau konten ilegal.",
          "Jual beli akun, saldo, atau item antar pengguna di luar sistem resmi.",
        ],
      },
      {
        heading: "12. Sanksi & Pembekuan Akun",
        body: "Pelanggaran dapat dikenai sanksi berjenjang sesuai tingkat keparahan: peringatan, pembatasan fitur, pembekuan sementara, hingga banned permanen tanpa pengembalian saldo. Akun ter-banned dapat dilihat statusnya melalui banner peringatan di aplikasi.",
      },
      {
        heading: "13. Hak Kekayaan Intelektual",
        body: "Seluruh logo, merek dagang, desain antarmuka, kode sumber, dan materi dalam aplikasi adalah milik Agung Adi Store atau pemberi lisensi. Dilarang menyalin, memodifikasi, mendistribusikan, atau menggunakan kembali tanpa izin tertulis.",
      },
      {
        heading: "14. Batasan Tanggung Jawab",
        body: "Layanan disediakan ‘sebagaimana adanya’ (as-is). Kami tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan, gangguan bisnis, atau kerusakan data akibat: gangguan jaringan internet pengguna, force majeure (bencana alam, pemadaman listrik, kebijakan pemerintah), tindakan pihak ketiga, atau kesalahan input oleh pengguna.",
      },
      {
        heading: "15. Force Majeure",
        body: "Kewajiban kami dapat ditangguhkan apabila terjadi keadaan kahar di luar kendali wajar, termasuk namun tidak terbatas pada: bencana alam, perang, kerusuhan, pandemi, gangguan infrastruktur cloud (downtime penyedia layanan), atau perubahan regulasi mendadak.",
      },
      {
        heading: "16. Perubahan Layanan & Harga",
        body: "Kami berhak menambah, mengubah, menangguhkan, atau menghentikan fitur, produk, dan harga sewaktu-waktu untuk peningkatan kualitas Layanan. Perubahan signifikan akan diumumkan melalui tab ‘Update’ atau notifikasi in-app.",
      },
      {
        heading: "17. Pengakhiran",
        body: "Pengguna berhak mengakhiri penggunaan Layanan kapan saja dengan menghapus akun melalui WhatsApp resmi. Kami berhak mengakhiri akses pengguna jika terbukti melanggar ketentuan ini, dengan atau tanpa pemberitahuan.",
      },
      {
        heading: "18. Hukum yang Berlaku & Penyelesaian Sengketa",
        body: "Ketentuan ini tunduk pada hukum Negara Republik Indonesia. Setiap sengketa diupayakan terlebih dahulu melalui musyawarah mufakat via kanal resmi. Apabila tidak tercapai, sengketa diselesaikan melalui Pengadilan Negeri yang berwenang di wilayah hukum Indonesia.",
      },
      {
        heading: "19. Kontak Resmi",
        body: "Untuk pertanyaan, klarifikasi, atau pelaporan terkait syarat & ketentuan ini:",
        bullets: [
          "WhatsApp Resmi: 085769302532",
          "Tiket Dukungan: tersedia di tab ‘Plus’ aplikasi",
          "Jam Operasional: setiap hari, 08.00 – 22.00 WIB",
        ],
      },
    ],
  },
  {
    key: "api",
    title: "API & Dokumentasi",
    subtitle: "Panduan teknis & endpoint",
    icon: Code2,
    gradient: "from-cyan-500 via-sky-500 to-indigo-500",
    tint: "bg-cyan-500/15 text-cyan-500",
    blocks: [
      {
        heading: "Ringkasan Arsitektur",
        body: "Agung Adi Store adalah aplikasi web Single Page Application (SPA) berbasis React 18 + Vite + TypeScript dengan Tailwind CSS sebagai framework styling. Backend ditenagai cloud terkelola (PostgreSQL + Edge Functions Deno) dengan kapabilitas realtime, auth, storage, dan serverless function. Aplikasi juga dibungkus Capacitor untuk distribusi APK Android dan mendukung instalasi PWA pada Chrome/Edge mobile.",
      },
      {
        heading: "Tumpukan Teknologi",
        body: "Berikut komponen teknologi utama yang digunakan:",
        bullets: [
          "Frontend: React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui.",
          "State & Data: TanStack Query, React Context, localStorage isolasi per visitor.",
          "Backend: Cloud terkelola (PostgreSQL 15 + Row Level Security).",
          "Edge Runtime: Deno 1.x dengan Web API standar (fetch, crypto).",
          "AI: AI Gateway (Gemini, GPT-5 family, image generation).",
          "Realtime: Postgres logical replication + WebSocket.",
          "Mobile: Capacitor 6 (Android), PWA dengan service worker.",
        ],
      },
      {
        heading: "Base URL & Konvensi",
        body: "Seluruh permintaan menggunakan base URL backend cloud yang dikonfigurasi via variabel lingkungan `VITE_SUPABASE_URL`. Klien resmi adalah JS SDK yang sudah di-bundle di `src/integrations/supabase/client.ts` (jangan diubah manual).",
        bullets: [
          "REST: `<BASE_URL>/rest/v1/<table>`",
          "RPC: `<BASE_URL>/rest/v1/rpc/<function>`",
          "Edge Functions: `<BASE_URL>/functions/v1/<name>`",
          "Realtime: `<BASE_URL>/realtime/v1/websocket`",
          "Storage: `<BASE_URL>/storage/v1/object/<bucket>/<path>`",
        ],
      },
      {
        heading: "Autentikasi & Otorisasi",
        body: "Sistem mendukung dua jalur: (1) Supabase Auth standar (email + password, Google OAuth) untuk admin dashboard, dan (2) sistem saldo internal berbasis username + nomor HP + PIN dengan hashing SHA-256 untuk pengguna umum. Permintaan REST wajib menyertakan header `apikey` (publishable) dan `Authorization: Bearer <jwt>` jika konteks user diperlukan.",
        bullets: [
          "RLS aktif di semua tabel sensitif (saldo, transaksi, tiket).",
          "Fungsi `has_role(uid, role)` digunakan untuk pengecekan admin tanpa risiko rekursi RLS.",
          "Token reset password/PIN format `#<5-digit>` dikirim via WhatsApp.",
          "Session isolation menggunakan `visitor_id` untuk mencegah kebocoran antar akun pada device yang sama.",
        ],
      },
      {
        heading: "Edge Functions Inti",
        body: "Berikut beberapa edge function publik/internal yang menggerakkan fitur utama:",
        bullets: [
          "POST `/functions/v1/wa-bot` — webhook bot WhatsApp v13.0.0 (chatFlows engine).",
          "POST `/functions/v1/cancel_deposit` — pembatalan deposit pending oleh user/admin.",
          "POST `/functions/v1/invalidate_tokens` — invalidasi token voucher massal.",
          "POST `/functions/v1/transcribe-lyrics` — transkripsi lirik via OpenAI Whisper.",
          "POST `/functions/v1/translate` — terjemahan runtime untuk 195 bahasa.",
          "POST `/functions/v1/streak-reminder` — penjadwalan & rekomendasi reminder pintar.",
          "POST `/functions/v1/ai-chat` — proxy ke AI Gateway untuk chatbot game.",
          "POST `/functions/v1/process-purchase` — pemrosesan transaksi saldo dengan validasi stok.",
        ],
      },
      {
        heading: "Tabel Utama (Skema Publik)",
        body: "Beberapa tabel inti yang diakses aplikasi (akses dibatasi RLS):",
        bullets: [
          "`profiles` — data profil pengguna (nama, foto, bio).",
          "`balances` — saldo aktif per user_id.",
          "`transactions` — riwayat transaksi saldo & pembelian.",
          "`tokens` — voucher 16-karakter dengan status (active/used/revoked).",
          "`tickets` & `ticket_messages` — sistem dukungan dengan read receipts.",
          "`songs`, `liked_songs`, `playlists` — modul musik.",
          "`daily_streaks`, `streak_rewards` — sistem streak & reward harian.",
          "`game_sessions`, `game_credits` — kredit & sesi mini games.",
          "`sponsor_ads`, `wholesale_pricing` — iklan sponsor & harga grosir.",
        ],
      },
      {
        heading: "Realtime Channels",
        body: "Sinkronisasi instan menggunakan Postgres Changes pada channel publikasi `supabase_realtime`. Klien berlangganan event `INSERT | UPDATE | DELETE` dengan filter `user_id=eq.<id>` untuk efisiensi.",
        bullets: [
          "Channel `balance:<user_id>` — perubahan saldo real-time.",
          "Channel `tickets:<user_id>` — pesan masuk & status read.",
          "Channel `notifications:<user_id>` — notifikasi sistem & promo.",
          "Channel `flash_sale` — broadcast countdown global.",
        ],
      },
      {
        heading: "Storage Buckets",
        body: "File assets disimpan di bucket Supabase Storage dengan policy publik/private sesuai kebutuhan:",
        bullets: [
          "`avatars` (public) — foto profil pengguna.",
          "`product-images` (public) — foto produk & galeri.",
          "`songs` (public) — file audio MP3/M4A musik publik.",
          "`tickets` (private) — lampiran tiket dukungan.",
          "`promo` (public) — banner promo & sponsor.",
        ],
      },
      {
        heading: "Format Respons Standar",
        body: "Edge function mengembalikan JSON dengan struktur konsisten:",
        bullets: [
          "Sukses: `{ success: true, data: <payload>, meta?: {...} }`",
          "Gagal: `{ success: false, error: { code, message, details? } }`",
          "Status HTTP: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 429 (Rate Limited), 500 (Server Error).",
        ],
      },
      {
        heading: "Rate Limit & Kuota",
        body: "Untuk menjaga stabilitas, beberapa endpoint dibatasi:",
        bullets: [
          "AI Gateway: kuota harian per pengguna sesuai tier.",
          "Edge function publik: ~100 request/menit per IP.",
          "Realtime: maksimal 100 channel aktif per koneksi.",
          "Hindari polling — gunakan kanal realtime untuk pembaruan live.",
        ],
      },
      {
        heading: "Kode Error Umum",
        body: "Daftar kode error internal yang sering muncul:",
        bullets: [
          "`AUTH_INVALID` — kredensial salah atau token kedaluwarsa.",
          "`BALANCE_INSUFFICIENT` — saldo tidak mencukupi untuk transaksi.",
          "`STOCK_EMPTY` — stok produk/token habis saat checkout.",
          "`TOKEN_USED` — voucher sudah pernah diklaim.",
          "`RATE_LIMITED` — terlalu banyak permintaan dalam waktu singkat.",
          "`BAN_ACTIVE` — akun sedang dalam status banned.",
        ],
      },
      {
        heading: "Webhook WhatsApp Bot",
        body: "Bot WhatsApp menggunakan engine `chatFlows` berbasis state machine yang didefinisikan di `src/lib/wa-bot-template.js`. Setiap status (`AWAITING_AMOUNT`, `AWAITING_METHOD`, dll.) memiliki handler tersendiri. Perintah utama: `!menu`, `!deposit`, `!cek`, `!riwayat`, `!batal`, `!bantuan`.",
      },
      {
        heading: "Keamanan & Best Practices",
        body: "Rekomendasi keamanan untuk integrasi:",
        bullets: [
          "Jangan pernah expose `service_role` key di sisi klien.",
          "Selalu validasi input sebelum query database.",
          "Gunakan parameterized query untuk mencegah SQL injection.",
          "Terapkan RLS sebagai garis pertahanan utama, bukan validasi sisi klien.",
          "Audit log perubahan sensitif (saldo, ban, peran admin).",
        ],
      },
      {
        heading: "Versi API & Changelog",
        body: "API mengikuti semantic versioning. Perubahan breaking diumumkan minimal 14 hari sebelumnya melalui tab ‘Update’. Versi minor & patch dirilis berkala tanpa downtime.",
      },
      {
        heading: "Dukungan Teknis",
        body: "Untuk laporan bug, request fitur, atau pertanyaan integrasi, hubungi WhatsApp resmi 085769302532 atau buka tiket dukungan di aplikasi. Sertakan informasi: ID transaksi, timestamp WIB, screenshot/log error, dan langkah reproduksi.",
      },
    ],
  },
  {
    key: "about",
    title: "Tentang Aplikasi",
    subtitle: "Versi, info toko & kontak",
    icon: Info,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    tint: "bg-emerald-500/15 text-emerald-500",
    blocks: [
      {
        heading: "Tentang Agung Adi Store",
        body: "Agung Adi Store adalah toko digital terpercaya yang berdiri dengan misi menyediakan layanan voucher, produk digital, hiburan game, dan musik komunitas dalam satu aplikasi terintegrasi. Mengusung slogan ‘Murah & Terpercaya’, kami berkomitmen memberikan pengalaman belanja digital yang cepat, aman, dan menyenangkan bagi seluruh pengguna di Indonesia maupun mancanegara.",
      },
      {
        heading: "Sejarah Singkat",
        body: "Berawal dari layanan top up sederhana via WhatsApp, Agung Adi Store berkembang menjadi platform multi-fitur dengan ribuan transaksi setiap bulannya. Kami terus berinovasi menghadirkan fitur seperti daily streak, mini games berhadiah, lucky wheel, sistem sponsor, hingga musik publik untuk meningkatkan engagement komunitas.",
      },
      {
        heading: "Visi",
        body: "Menjadi platform belanja digital paling ramah pengguna, cepat, dan terpercaya di Asia Tenggara — dengan harga yang bersaing, layanan responsif 24/7, dan pengalaman gamifikasi yang menyenangkan.",
      },
      {
        heading: "Misi",
        body: "Untuk mewujudkan visi tersebut, kami berkomitmen pada hal berikut:",
        bullets: [
          "Memberikan harga produk digital paling kompetitif di pasar.",
          "Menjamin keamanan transaksi melalui sistem rekber & verifikasi berlapis.",
          "Menyediakan layanan pelanggan responsif via WhatsApp & tiket in-app.",
          "Berinovasi terus dengan fitur reward, game, dan engagement komunitas.",
          "Mendukung kreator lokal melalui platform musik publik & sponsor.",
        ],
      },
      {
        heading: "Fitur Utama",
        body: "Aplikasi menyatukan beragam layanan dalam satu pengalaman terpadu:",
        bullets: [
          "🛒 Belanja produk digital, voucher game, & layanan top up.",
          "💰 Sistem saldo internal dengan deposit via WhatsApp interaktif.",
          "🎁 Daily Streak harian (sinkron WIB) dengan hadiah berjenjang.",
          "🎰 Lucky Wheel, Lucky Draw, Slot Machine dengan sistem pity & jackpot.",
          "🎮 11+ mini games berhadiah dengan sistem 3 nyawa & cooldown.",
          "🎵 Musik Publik dengan upload lagu, playlist, lirik otomatis (Whisper).",
          "💬 Sistem tiket dukungan dengan read receipts ala WhatsApp.",
          "🛍️ Keranjang belanja & pembelian massal (bulk purchase).",
          "📢 Iklan Sponsor pihak ketiga dengan protokol Rekber Admin.",
          "🏆 Weekly Leaderboard & sistem achievement badges.",
          "🌐 Dukungan 195 bahasa dengan auto-translation runtime.",
          "📱 Tersedia sebagai PWA (web) dan APK Android (Capacitor).",
        ],
      },
      {
        heading: "Keunggulan",
        body: "Mengapa memilih Agung Adi Store?",
        bullets: [
          "Harga grosir otomatis untuk pembelian dalam jumlah banyak.",
          "Notifikasi real-time tanpa perlu refresh halaman.",
          "Sistem keamanan berlapis: hash SHA-256, RLS, verifikasi WhatsApp.",
          "Pengalaman offline dengan caching service worker untuk PWA.",
          "Dashboard admin lengkap untuk transparansi pengelolaan.",
        ],
      },
      {
        heading: "Kontak Resmi",
        body: "Hubungi kami HANYA melalui kanal resmi berikut:",
        bullets: [
          "📱 WhatsApp Resmi: 085769302532",
          "🕐 Jam Operasional: Setiap hari, 08.00 – 22.00 WIB",
          "🎫 Tiket Dukungan: tersedia di tab ‘Plus’ → ‘Bantuan’.",
          "🌐 Website: agungadistore.lovable.app",
          "⚠️ Kami TIDAK pernah meminta data sensitif via DM media sosial.",
        ],
      },
      {
        heading: "Kanal Sosial Media",
        body: "Ikuti akun resmi kami untuk update promo, event, dan informasi terbaru. Daftar lengkap kanal sosial media tersedia di tab ‘Plus’ → ‘Sosial Media’.",
      },
      {
        heading: "Tim & Pengelola",
        body: "Agung Adi Store dikelola oleh tim kecil yang berdedikasi penuh pada layanan pelanggan. Setiap admin dilengkapi sistem otentikasi multi-faktor dan akses terbatas sesuai peran (role-based access control).",
      },
      {
        heading: "Teknologi yang Digunakan",
        body: "Aplikasi dibangun di atas tumpukan teknologi modern:",
        bullets: [
          "Frontend: React 18 + Vite + TypeScript + Tailwind CSS.",
          "Backend: Cloud terkelola (PostgreSQL + Edge Functions Deno).",
          "AI: AI Gateway (Gemini, GPT-5).",
          "Mobile: Capacitor 6 untuk Android, PWA untuk iOS/Web.",
          "Realtime: WebSocket via Postgres logical replication.",
        ],
      },
      {
        heading: "Komitmen Kualitas",
        body: "Kami berkomitmen pada uptime 99.9%, response time tiket <12 jam, dan transparansi penuh pada setiap transaksi. Setiap keluhan ditangani dengan SLA yang jelas.",
      },
      {
        heading: "Versi & Pembaruan",
        body: "Lihat tab ‘Update’ (ikon RefreshCw) di navigasi bawah untuk catatan perubahan (changelog) lengkap, daftar fitur baru, perbaikan bug, dan riwayat versi aplikasi yang dirilis secara berkala.",
      },
      {
        heading: "Penghargaan & Pengakuan",
        body: "Terima kasih kepada ribuan pengguna setia yang telah mempercayai Agung Adi Store. Setiap testimoni, masukan, dan kritik adalah bahan bakar kami untuk terus berkembang. 🙏",
      },
    ],
  },
  {
    key: "privacy",
    title: "Kebijakan Privasi",
    subtitle: "Perlindungan data pengguna",
    icon: ShieldCheck,
    gradient: "from-violet-500 via-fuchsia-500 to-pink-500",
    tint: "bg-violet-500/15 text-violet-500",
    blocks: [
      {
        heading: "1. Pendahuluan",
        body: "Privasi Anda adalah prioritas utama kami. Kebijakan Privasi ini menjelaskan jenis data yang kami kumpulkan, alasan pengumpulan, cara kami menggunakan, menyimpan, melindungi, dan kapan data tersebut dapat dibagikan kepada pihak ketiga. Dengan menggunakan Agung Adi Store, Anda menyetujui praktik yang dijelaskan di sini.",
      },
      {
        heading: "2. Data yang Kami Kumpulkan",
        body: "Kami hanya mengumpulkan data yang relevan dan diperlukan untuk menyediakan Layanan secara optimal. Jenis data meliputi:",
        bullets: [
          "Identitas: nama lengkap, username, alamat email, nomor HP (format internasional).",
          "Kredensial: kata sandi & PIN — selalu di-hash menggunakan SHA-256, tidak pernah disimpan plaintext.",
          "Profil: foto avatar, bio, preferensi bahasa & tema.",
          "Perangkat: jenis OS (Android/iOS/Web), versi browser, model & merek perangkat.",
          "Identifikasi: visitor ID (digenerate per browser untuk isolasi sesi).",
          "Aktivitas: log login, riwayat transaksi, klaim voucher, sesi game, klaim streak.",
          "Konten: lagu yang diunggah, lampiran tiket, pesan ke admin/bot.",
          "Lokasi (opsional): zona waktu untuk reset streak harian (default WIB).",
        ],
      },
      {
        heading: "3. Cara Pengumpulan Data",
        body: "Data dikumpulkan melalui beberapa cara:",
        bullets: [
          "Langsung dari Anda saat pendaftaran, login, atau pengisian profil.",
          "Otomatis dari perangkat saat Anda mengakses Layanan (device info).",
          "Dari interaksi Anda dengan fitur (transaksi, game, klaim, upload).",
          "Dari komunikasi via WhatsApp resmi & tiket dukungan.",
        ],
      },
      {
        heading: "4. Tujuan Penggunaan Data",
        body: "Data digunakan secara bertanggung jawab untuk tujuan berikut:",
        bullets: [
          "Autentikasi & verifikasi identitas pengguna.",
          "Pemrosesan transaksi, deposit, dan klaim voucher.",
          "Personalisasi pengalaman (bahasa, tema, rekomendasi).",
          "Deteksi penyalahgunaan, kecurangan, dan tindakan ilegal.",
          "Komunikasi terkait layanan (notifikasi, status transaksi, reminder).",
          "Analisis statistik anonim untuk peningkatan kualitas Layanan.",
          "Kepatuhan terhadap kewajiban hukum yang berlaku.",
        ],
      },
      {
        heading: "5. Dasar Hukum Pemrosesan",
        body: "Pemrosesan data Anda didasarkan pada salah satu dari: (a) persetujuan eksplisit Anda saat mendaftar, (b) pelaksanaan kontrak layanan, (c) kepatuhan terhadap kewajiban hukum, atau (d) kepentingan sah kami untuk operasional & keamanan platform.",
      },
      {
        heading: "6. Penyimpanan & Lokasi Data",
        body: "Data disimpan di server cloud terkelola dengan lokasi data center yang dipilih untuk performa & kepatuhan terbaik. Cadangan data dilakukan otomatis secara berkala.",
        bullets: [
          "Database: PostgreSQL 15 dengan enkripsi at-rest.",
          "Komunikasi: HTTPS/TLS 1.2+ untuk semua transmisi.",
          "Backup: harian & retensi sesuai kebijakan platform.",
        ],
      },
      {
        heading: "7. Keamanan Data",
        body: "Kami menerapkan langkah keamanan teknis & organisasional berlapis:",
        bullets: [
          "Hashing SHA-256 untuk kata sandi & PIN — tidak ada plaintext.",
          "Row Level Security (RLS) di tingkat database untuk isolasi data antar user.",
          "Token JWT dengan masa berlaku terbatas & rotasi otomatis.",
          "Verifikasi via WhatsApp untuk reset password/PIN (token format `#12345`).",
          "Audit log untuk perubahan sensitif (saldo, role admin, ban).",
          "Pemantauan anomali aktivitas login & transaksi mencurigakan.",
          "Akses admin dibatasi dengan role-based access control (RBAC).",
        ],
      },
      {
        heading: "8. Berbagi Data dengan Pihak Ketiga",
        body: "Kami TIDAK MENJUAL data pribadi Anda kepada pihak manapun untuk tujuan iklan. Data hanya dibagikan dalam kondisi terbatas:",
        bullets: [
          "Penyedia infrastruktur cloud untuk hosting.",
          "Layanan pengiriman pesan (WhatsApp Business API) untuk notifikasi.",
          "Penyedia AI (OpenAI, Google) untuk fitur transkripsi lirik & terjemahan — data dianonimkan.",
          "Otoritas hukum bila diwajibkan oleh peraturan perundang-undangan.",
          "Mitra rekber untuk transaksi sponsor — hanya data minimal yang relevan.",
        ],
      },
      {
        heading: "9. Cookie & Penyimpanan Lokal",
        body: "Aplikasi menggunakan teknologi penyimpanan lokal browser:",
        bullets: [
          "`localStorage` untuk sesi login, preferensi bahasa, tema, & cache offline.",
          "`sessionStorage` untuk state sementara per tab.",
          "Service Worker (PWA) untuk caching assets & dukungan offline.",
          "Tidak ada cookie pelacakan pihak ketiga untuk iklan/advertising.",
          "Tidak ada integrasi Google Analytics, Facebook Pixel, atau tracker iklan.",
        ],
      },
      {
        heading: "10. Hak Pengguna (Data Subject Rights)",
        body: "Sebagai subjek data, Anda memiliki hak penuh atas data Anda:",
        bullets: [
          "Hak akses: meminta salinan data pribadi yang kami simpan.",
          "Hak koreksi: memperbarui data yang tidak akurat melalui menu profil.",
          "Hak penghapusan: meminta penghapusan akun & data via WhatsApp resmi.",
          "Hak portabilitas: meminta data dalam format terstruktur (JSON/CSV).",
          "Hak keberatan: menolak pemrosesan data non-esensial.",
          "Hak menarik persetujuan: kapan saja tanpa konsekuensi pada layanan dasar.",
        ],
      },
      {
        heading: "11. Retensi Data",
        body: "Data disimpan selama akun aktif dan untuk jangka waktu yang wajar setelah penonaktifan, sesuai kebutuhan operasional, hukum, akuntansi, atau penyelesaian sengketa. Data transaksi disimpan minimal 5 tahun sesuai ketentuan perpajakan & audit.",
      },
      {
        heading: "12. Anak di Bawah Umur",
        body: "Layanan ditujukan untuk pengguna berusia minimal 13 tahun. Pengguna di bawah 18 tahun wajib mendapatkan persetujuan dari orang tua/wali sebelum bertransaksi. Kami tidak secara sengaja mengumpulkan data anak di bawah 13 tahun. Apabila terdeteksi, akun akan dihapus.",
      },
      {
        heading: "13. Notifikasi & Pemasaran",
        body: "Kami dapat mengirim notifikasi terkait layanan (transaksi, reminder streak, tiket). Untuk pesan promosi/marketing, Anda dapat memilih untuk berlangganan atau berhenti kapan saja melalui pengaturan notifikasi atau perintah `!stop` pada bot WhatsApp.",
      },
      {
        heading: "14. Pelanggaran Data (Data Breach)",
        body: "Apabila terjadi insiden keamanan yang berdampak pada data pribadi, kami akan: (a) mengisolasi & memitigasi insiden secepatnya, (b) memberitahukan pengguna terdampak melalui email/WhatsApp dalam waktu wajar (umumnya 72 jam), (c) melaporkan kepada otoritas terkait jika diwajibkan, dan (d) memberikan rekomendasi tindakan perlindungan.",
      },
      {
        heading: "15. Transfer Data Lintas Negara",
        body: "Karena infrastruktur cloud bersifat global, data Anda mungkin diproses di server yang berlokasi di luar Indonesia. Kami memastikan perlindungan setara dengan standar yang berlaku melalui kontrak penyedia & enkripsi end-to-end.",
      },
      {
        heading: "16. Tautan ke Situs Pihak Ketiga",
        body: "Aplikasi mungkin berisi tautan ke situs pihak ketiga (mis. WhatsApp, sponsor). Kami tidak bertanggung jawab atas praktik privasi situs eksternal — silakan baca kebijakan privasi masing-masing.",
      },
      {
        heading: "17. Perubahan Kebijakan Privasi",
        body: "Kebijakan ini dapat diperbarui sewaktu-waktu sesuai perkembangan layanan & regulasi. Versi terbaru selalu tersedia di menu ini, dengan tanggal pembaruan tertera di bagian bawah. Perubahan signifikan akan diumumkan melalui notifikasi in-app.",
      },
      {
        heading: "18. Penyelesaian Pengaduan",
        body: "Apabila Anda merasa hak privasi Anda dilanggar, silakan ajukan pengaduan melalui WhatsApp resmi 085769302532 atau tiket dukungan. Kami akan menanggapi dalam waktu maksimal 7 hari kerja.",
      },
      {
        heading: "19. Kontak Data Protection",
        body: "Untuk pertanyaan, permintaan akses data, atau pelaporan terkait privasi:",
        bullets: [
          "WhatsApp Resmi: 085769302532",
          "Tiket: tab ‘Plus’ → ‘Bantuan’ → kategori ‘Privasi & Keamanan’.",
          "Jam Tanggap: setiap hari, 08.00 – 22.00 WIB.",
        ],
      },
      {
        heading: "20. Persetujuan",
        body: "Dengan terus menggunakan Agung Adi Store, Anda mengonfirmasi telah membaca, memahami, dan menyetujui Kebijakan Privasi ini secara keseluruhan. Terima kasih atas kepercayaan Anda. 🛡️",
      },
    ],
  },
];

/**
 * Floating hamburger button (top-left) + colorful playful drawer
 * with empty content sections (Syarat & Ketentuan, API Docs, About, Privacy).
 *
 * Hidden on admin / fullscreen routes to avoid overlapping admin UI.
 */
export default function GlobalMenuDrawer() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<SectionDef | null>(null);

  // Hide on admin / fullscreen pages
  const hidden =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/offline") ||
    location.pathname.startsWith("/luck-royale-nyawa") ||
    location.pathname.startsWith("/diamond-royale");

  if (hidden) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="Buka menu"
            className={cn(
              "fixed top-3 left-3 z-[60]",
              "h-10 w-10 rounded-2xl",
              "flex items-center justify-center",
              "bg-gradient-to-br from-pink-500 via-fuchsia-500 to-indigo-500",
              "text-white shadow-[0_8px_24px_-6px_rgba(236,72,153,0.55)]",
              "ring-1 ring-white/20",
              "transition-transform active:scale-95 hover:scale-105"
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-background animate-pulse" />
          </button>
        </SheetTrigger>

        <SheetContent
          side="left"
          className="w-[88vw] max-w-sm p-0 border-0 overflow-hidden bg-background"
        >
          {/* Decorative top hero */}
          <div className="relative h-36 overflow-hidden bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400">
            <div className="absolute -top-12 -left-10 w-44 h-44 rounded-full bg-white/25 blur-3xl" />
            <div className="absolute -bottom-14 -right-10 w-48 h-48 rounded-full bg-cyan-300/40 blur-3xl" />
            <div className="relative h-full flex flex-col justify-end p-5 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold opacity-90">
                <Sparkles className="h-3.5 w-3.5" />
                MENU UTAMA
              </div>
              <h2 className="text-2xl font-extrabold leading-tight drop-shadow">
                Agung Adi Store
              </h2>
              <p className="text-xs opacity-90">Pusat informasi & dokumentasi</p>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-9rem)]">
            <div className="p-4 space-y-3">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => {
                      setActive(s);
                    }}
                    className={cn(
                      "group w-full text-left relative overflow-hidden",
                      "rounded-2xl p-[1.5px]",
                      "bg-gradient-to-r",
                      s.gradient,
                      "transition-transform active:scale-[0.98] hover:scale-[1.01]"
                    )}
                  >
                    <div className="relative rounded-[14px] bg-card px-4 py-3.5 flex items-center gap-3">
                      <div
                        className={cn(
                          "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0",
                          s.tint
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm leading-tight">
                          {s.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {s.subtitle}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                );
              })}

              <div className="pt-4 text-center text-[10px] text-muted-foreground">
                © {new Date().getFullYear()} Agung Adi Store
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Section dialog with rich content */}
      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none">
          {active && (
            <div className="rounded-2xl overflow-hidden bg-background border border-border/60 shadow-2xl flex flex-col max-h-[85vh]">
              <div
                className={cn(
                  "h-24 relative bg-gradient-to-br flex-shrink-0",
                  active.gradient
                )}
              >
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
                  <div className="absolute -bottom-10 -right-8 w-36 h-36 rounded-full bg-white/25 blur-2xl" />
                </div>
                <div className="relative h-full flex items-center gap-3 px-5 text-white">
                  <div className="h-12 w-12 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center">
                    <active.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider opacity-90 font-semibold">
                      Bagian
                    </div>
                    <DialogTitle className="text-lg font-extrabold leading-tight">
                      {active.title}
                    </DialogTitle>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-5 py-5 space-y-4">
                  <DialogHeader className="space-y-1 text-left">
                    <p className="text-xs text-muted-foreground">
                      {active.subtitle}
                    </p>
                  </DialogHeader>

                  <div className="space-y-3">
                    {active.blocks.map((block, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-xl p-[1px] bg-gradient-to-r",
                          active.gradient,
                          "opacity-90"
                        )}
                      >
                        <div className="rounded-[11px] bg-card p-3.5 space-y-2">
                          <h3 className="text-sm font-bold leading-tight">
                            {block.heading}
                          </h3>
                          <p className="text-[12px] text-muted-foreground leading-relaxed">
                            {block.body}
                          </p>
                          {block.bullets && (
                            <ul className="list-disc pl-5 space-y-1 text-[12px] text-muted-foreground leading-relaxed">
                              {block.bullets.map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-center text-muted-foreground pt-1">
                    Terakhir diperbarui: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border/60 bg-background flex-shrink-0">
                <Button
                  onClick={() => setActive(null)}
                  className={cn(
                    "w-full h-10 rounded-xl font-bold text-sm text-white border-0",
                    "bg-gradient-to-r",
                    active.gradient
                  )}
                >
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
