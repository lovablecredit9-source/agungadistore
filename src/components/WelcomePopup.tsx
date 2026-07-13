import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, ShieldCheck, Bug, MessageCircle, Sparkles } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/social-links";

const STORAGE_KEY = "welcome_popup_seen_v1";

export default function WelcomePopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("play")) return;

    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleAccept(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none [&>button]:bg-primary/95 [&>button]:text-primary-foreground [&>button]:opacity-100 [&>button]:rounded-full [&>button]:shadow-lg">
        <div className="relative rounded-[22px] overflow-hidden bg-[hsl(var(--welcome-surface))] text-[hsl(var(--welcome-ink))] border border-primary/20 shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.4)]">
          {/* Decorative top */}
          <div className="relative h-28 bg-gradient-to-br from-primary via-primary/80 to-accent overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
              <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-white/30 blur-xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-xl">
                  <Heart className="w-10 h-10 text-primary fill-primary" />
                </div>
              </div>
            </div>
            <Sparkles className="absolute top-3 right-4 w-5 h-5 text-white/70 animate-pulse" />
            <Sparkles className="absolute bottom-3 left-6 w-4 h-4 text-white/60 animate-pulse" style={{ animationDelay: "0.5s" }} />
          </div>

          <div className="px-6 pt-6 pb-5 space-y-4">
            <div className="text-center space-y-1.5">
              <h2 className="text-xl font-extrabold tracking-tight text-[hsl(var(--welcome-ink))]">
                Terima Kasih Sudah Masuk 🎉
              </h2>
              <p className="text-sm text-[hsl(var(--welcome-muted))] leading-relaxed font-medium">
                Selamat datang di <span className="font-extrabold text-[hsl(var(--welcome-ink))]">Agung Adi Store</span>.
                Kami selalu menjaga <span className="font-semibold text-primary">kepuasan pelanggan</span> sebagai prioritas utama.
              </p>
            </div>

            <div className="rounded-xl bg-[hsl(var(--welcome-surface-soft))] border border-primary/15 p-3 space-y-2.5 text-[hsl(var(--welcome-ink))] shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.7)]">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs leading-relaxed pt-0.5 font-medium text-[hsl(var(--welcome-ink))]">
                  Mohon <span className="font-semibold">tidak melanggar</span> aturan & ketentuan toko.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Bug className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs leading-relaxed pt-0.5 font-medium text-[hsl(var(--welcome-ink))]">
                  Jika menemukan <span className="font-semibold">bug</span>, silakan buat tiket atau hubungi admin via WhatsApp.
                </p>
              </div>
              <a
                href={SOCIAL_LINKS.whatsapp + "?text=" + encodeURIComponent("Halo admin, saya ingin melaporkan bug / kendala")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline pl-9"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Hubungi Admin WhatsApp
              </a>
            </div>

            <Button
              onClick={handleAccept}
              className="w-full h-11 font-bold text-sm rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25"
            >
              Oke, Mengerti ✓
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
