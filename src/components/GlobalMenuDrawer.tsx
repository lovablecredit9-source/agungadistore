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

interface SectionDef {
  key: SectionKey;
  title: string;
  subtitle: string;
  icon: typeof FileText;
  /** tailwind gradient classes */
  gradient: string;
  /** soft tint for icon bg */
  tint: string;
}

const SECTIONS: SectionDef[] = [
  {
    key: "terms",
    title: "Syarat & Ketentuan",
    subtitle: "Aturan penggunaan layanan",
    icon: FileText,
    gradient: "from-pink-500 via-rose-500 to-orange-400",
    tint: "bg-pink-500/15 text-pink-500",
  },
  {
    key: "api",
    title: "API & Dokumentasi",
    subtitle: "Panduan teknis & endpoint",
    icon: Code2,
    gradient: "from-cyan-500 via-sky-500 to-indigo-500",
    tint: "bg-cyan-500/15 text-cyan-500",
  },
  {
    key: "about",
    title: "Tentang Aplikasi",
    subtitle: "Versi, info toko & kontak",
    icon: Info,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    tint: "bg-emerald-500/15 text-emerald-500",
  },
  {
    key: "privacy",
    title: "Kebijakan Privasi",
    subtitle: "Perlindungan data pengguna",
    icon: ShieldCheck,
    gradient: "from-violet-500 via-fuchsia-500 to-pink-500",
    tint: "bg-violet-500/15 text-violet-500",
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
