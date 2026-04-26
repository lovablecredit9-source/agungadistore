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
        heading: "1. Penerimaan Syarat",
        body: "Dengan menggunakan aplikasi Agung Adi Store, Anda dianggap telah membaca, memahami, dan menyetujui seluruh syarat & ketentuan yang berlaku. Jika tidak setuju, mohon hentikan penggunaan aplikasi.",
      },
      {
        heading: "2. Akun Pengguna",
        body: "Anda bertanggung jawab penuh atas keamanan akun, kata sandi, dan PIN transaksi. Jangan membagikan kredensial kepada pihak lain. Aktivitas yang terjadi pada akun Anda menjadi tanggung jawab Anda sepenuhnya.",
        bullets: [
          "Wajib menggunakan data asli (nama, email, nomor HP).",
          "Dilarang membuat akun ganda untuk menyalahgunakan promo.",
          "Akun yang melanggar dapat dibekukan tanpa pemberitahuan.",
        ],
      },
      {
        heading: "3. Transaksi & Pembayaran",
        body: "Seluruh transaksi diproses melalui sistem saldo internal dan/atau WhatsApp resmi (085769302532). Pastikan Anda melakukan pembayaran hanya melalui kanal resmi. Kami tidak bertanggung jawab atas kerugian akibat transaksi di luar kanal resmi.",
      },
      {
        heading: "4. Voucher & Token",
        body: "Voucher/token bersifat sekali pakai dan tidak dapat dikembalikan setelah berhasil diklaim. Penyalahgunaan kode voucher dapat menyebabkan pembatalan transaksi.",
      },
      {
        heading: "5. Larangan",
        body: "Pengguna dilarang melakukan tindakan curang seperti exploit bug, scraping data, manipulasi sistem game/streak, atau menyebarkan konten yang melanggar hukum Indonesia.",
      },
      {
        heading: "6. Perubahan Layanan",
        body: "Kami berhak mengubah, menambah, atau menghentikan fitur kapan saja demi peningkatan layanan. Perubahan signifikan akan diumumkan melalui tab Update di aplikasi.",
      },
      {
        heading: "7. Kontak",
        body: "Pertanyaan terkait syarat & ketentuan dapat diajukan via WhatsApp 085769302532 atau melalui sistem tiket di aplikasi.",
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
        heading: "Ringkasan",
        body: "Agung Adi Store dibangun di atas Lovable Cloud (PostgreSQL + Edge Functions) dengan arsitektur realtime. Dokumentasi berikut adalah gambaran umum integrasi internal aplikasi.",
      },
      {
        heading: "Base URL",
        body: "Seluruh permintaan API menggunakan base URL backend Lovable Cloud yang sudah dikonfigurasi otomatis di aplikasi. Klien resmi menggunakan SDK Supabase JS.",
        bullets: [
          "Endpoint REST: /rest/v1/<table>",
          "Edge Functions: /functions/v1/<function-name>",
          "Realtime Channel: /realtime/v1/websocket",
        ],
      },
      {
        heading: "Autentikasi",
        body: "Permintaan API menggunakan header `apikey` (publishable key) dan `Authorization: Bearer <jwt>` untuk akses pengguna terautentikasi. Operasi sensitif dilindungi Row Level Security (RLS).",
      },
      {
        heading: "Endpoint Utama (Internal)",
        body: "Berikut beberapa edge function inti yang digunakan aplikasi:",
        bullets: [
          "POST /functions/v1/cancel_deposit — pembatalan deposit pending.",
          "POST /functions/v1/invalidate_tokens — invalidasi token voucher.",
          "POST /functions/v1/wa-bot — webhook bot WhatsApp.",
          "POST /functions/v1/transcribe-lyrics — transkripsi lirik (Whisper).",
        ],
      },
      {
        heading: "Realtime",
        body: "Aplikasi memanfaatkan Postgres Changes untuk sinkronisasi instan saldo, tiket, dan notifikasi. Channel berlangganan event INSERT/UPDATE/DELETE pada tabel terkait.",
      },
      {
        heading: "Rate Limit & Kuota",
        body: "Permintaan dibatasi sesuai kebijakan platform untuk menjaga stabilitas. Hindari polling berlebihan — gunakan kanal realtime untuk pembaruan langsung.",
      },
      {
        heading: "Status & Dukungan",
        body: "Laporkan kendala teknis melalui WhatsApp 085769302532 atau tiket dukungan di aplikasi. Sertakan ID transaksi/log waktu kejadian agar mudah ditelusuri.",
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
        heading: "Agung Adi Store",
        body: "Toko digital terpercaya dengan slogan 'Murah & Terpercaya'. Menyediakan produk digital, voucher, layanan game, musik komunitas, serta sistem reward harian.",
      },
      {
        heading: "Visi",
        body: "Menjadi platform belanja digital paling ramah, cepat, dan aman bagi pengguna Indonesia dengan harga bersaing dan layanan responsif 24/7.",
      },
      {
        heading: "Fitur Utama",
        body: "Aplikasi menyatukan beragam layanan dalam satu tempat:",
        bullets: [
          "Belanja produk digital & voucher dengan saldo internal.",
          "Sistem streak harian, lucky wheel, dan mini games berhadiah.",
          "Musik publik & playlist dengan pemutar offline.",
          "Notifikasi realtime untuk transaksi dan tiket.",
          "Dukungan multi-bahasa (195 negara).",
        ],
      },
      {
        heading: "Kontak Resmi",
        body: "Hubungi kami melalui kanal resmi:",
        bullets: [
          "WhatsApp: 085769302532",
          "Operasional: Setiap hari, 08.00 – 22.00 WIB",
          "Tiket dukungan: tersedia di tab 'Plus' aplikasi",
        ],
      },
      {
        heading: "Teknologi",
        body: "Dibangun menggunakan React, Vite, Tailwind CSS, dan Lovable Cloud (PostgreSQL + Edge Functions). Mendukung instalasi PWA dan APK Android via Capacitor.",
      },
      {
        heading: "Versi",
        body: "Lihat tab 'Update' di aplikasi untuk catatan perubahan terbaru dan riwayat versi.",
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
        heading: "1. Data yang Kami Kumpulkan",
        body: "Kami mengumpulkan data minimum yang diperlukan untuk menyediakan layanan:",
        bullets: [
          "Identitas: nama, username, email, nomor HP.",
          "Kredensial: kata sandi & PIN (disimpan terenkripsi/hash SHA-256).",
          "Perangkat: OS, versi browser, model perangkat, visitor ID.",
          "Transaksi: riwayat pembelian, klaim voucher, dan saldo.",
        ],
      },
      {
        heading: "2. Tujuan Penggunaan",
        body: "Data digunakan untuk autentikasi, pemrosesan transaksi, deteksi penyalahgunaan, personalisasi pengalaman, dan komunikasi terkait layanan.",
      },
      {
        heading: "3. Penyimpanan & Keamanan",
        body: "Data disimpan di server Lovable Cloud dengan enkripsi in-transit (HTTPS) dan proteksi Row Level Security (RLS) di tingkat database. Kata sandi & PIN tidak pernah disimpan dalam bentuk plaintext.",
      },
      {
        heading: "4. Berbagi Data",
        body: "Kami TIDAK menjual data pribadi Anda. Data hanya dibagikan kepada pihak ketiga jika diwajibkan hukum atau untuk keperluan operasional inti (mis. gateway pembayaran, pengiriman pesan WhatsApp).",
      },
      {
        heading: "5. Hak Pengguna",
        body: "Anda berhak untuk:",
        bullets: [
          "Mengakses & memperbarui data profil kapan saja.",
          "Meminta penghapusan akun melalui WhatsApp resmi.",
          "Menarik persetujuan komunikasi non-transaksional.",
        ],
      },
      {
        heading: "6. Cookie & Penyimpanan Lokal",
        body: "Aplikasi menggunakan localStorage untuk menjaga sesi login, preferensi bahasa, dan cache offline. Tidak ada cookie pelacakan pihak ketiga untuk iklan.",
      },
      {
        heading: "7. Anak di Bawah Umur",
        body: "Layanan ditujukan untuk pengguna berusia 13 tahun ke atas. Pengguna di bawah umur wajib mendapat persetujuan orang tua/wali.",
      },
      {
        heading: "8. Perubahan Kebijakan",
        body: "Kebijakan ini dapat diperbarui sewaktu-waktu. Versi terbaru selalu tersedia di menu ini.",
      },
      {
        heading: "9. Kontak",
        body: "Pertanyaan terkait privasi: WhatsApp 085769302532.",
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
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="h-8 w-8 rounded-full bg-white/25 hover:bg-white/35 backdrop-blur flex items-center justify-center text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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

      {/* Section dialog (empty placeholder content) */}
      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none">
          {active && (
            <div className="rounded-2xl overflow-hidden bg-background border border-border/60 shadow-2xl">
              <div
                className={cn(
                  "h-24 relative bg-gradient-to-br",
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

              <div className="px-5 py-5 space-y-4">
                <DialogHeader className="space-y-1 text-left">
                  <p className="text-xs text-muted-foreground">
                    {active.subtitle}
                  </p>
                </DialogHeader>

                {/* Empty content scaffold */}
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-center space-y-2">
                  <div className="text-2xl">📝</div>
                  <p className="text-sm font-semibold">Konten belum tersedia</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Bagian ini sengaja dikosongkan. Konten {active.title.toLowerCase()}{" "}
                    dapat ditambahkan kemudian melalui dashboard admin atau diisi
                    langsung di sini.
                  </p>
                </div>

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
