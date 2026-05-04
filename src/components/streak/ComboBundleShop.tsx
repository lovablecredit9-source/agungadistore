import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Gift, Loader2, Lock, Sparkles, Coins, Gem, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCompactNumber } from "@/lib/utils";

interface Props { visitorId: string; onUpdate?: () => void; }
interface ComboPkg {
  id: string; name: string; gems: number; bonus_gems: number; bonus_streak_coins: number;
  price: number; icon: string; sort_order: number;
}

function resolveActiveVisitor(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem("balance_visitor_id") || fallback;
}

export default function ComboBundleShop({ visitorId: visitorIdProp, onUpdate }: Props) {
  const visitorId = resolveActiveVisitor(visitorIdProp);
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState<ComboPkg[]>([]);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [hasPin, setHasPin] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ pkg: ComboPkg; quantity: number } | null>(null);
  const [pinInput, setPinInput] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const [{ data: pkgs }, pinResp] = await Promise.all([
      supabase.from("gem_packages").select("*").eq("is_active", true).gt("bonus_streak_coins", 0).order("sort_order"),
      supabase.functions.invoke("manage-pin", { body: { action: "check", visitorId } }),
    ]);
    setPackages((pkgs || []) as ComboPkg[]);
    setHasPin(!!pinResp.data?.hasPin);
    setLoading(false);
  };

  useEffect(() => { load(); }, [visitorId]);
  useEffect(() => { if (open) load(); }, [open]);

  const getQty = (id: string) => Math.max(1, Math.min(99, qty[id] || 1));
  const setPkgQty = (id: string, n: number) => setQty(q => ({ ...q, [id]: Math.max(1, Math.min(99, n)) }));

  const requestBuy = (p: ComboPkg) => {
    const quantity = getQty(p.id);
    if (hasPin) { setPinInput(""); setPinDialog({ pkg: p, quantity }); }
    else { doBuy(p, quantity); }
  };

  const doBuy = async (p: ComboPkg, quantity: number, pin?: string) => {
    setBuying(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("gem-purchase", {
        body: { visitorId, packageId: p.id, quantity, pin },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Gagal");
      toast({
        title: "🎁 Combo Diterima!",
        description: `+${data.gems_added} 💎 + ${(data.streak_coins_added || 0).toLocaleString("id-ID")} 🪙`,
      });
      setPkgQty(p.id, 1);
      await load();
      onUpdate?.();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setBuying(null);
    }
  };

  const confirmPin = async () => {
    if (!pinDialog) return;
    if (pinInput.length < 4) { toast({ title: "PIN minimal 4 digit", variant: "destructive" }); return; }
    const { pkg, quantity } = pinDialog;
    setPinDialog(null);
    await doBuy(pkg, quantity, pinInput);
    setPinInput("");
  };

  return (
    <>
      <motion.div whileHover={{ scale: 1.02 }} className="relative overflow-hidden rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-950/60 via-orange-950/40 to-rose-950/60 p-4 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-500/15 to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/40 shrink-0">
              <Gift className="w-6 h-6 text-white drop-shadow" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Top Up Bonus</p>
              <p className="text-base font-black text-white truncate">Combo Gem + 🪙 Koin Streak</p>
              <p className="text-[10px] text-white/60">{packages.length} paket • Hemat hingga 80%</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black shadow-lg shadow-amber-500/40 shrink-0"
          >
            <Sparkles className="w-4 h-4 mr-1" /> Beli
          </Button>
        </div>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-950 via-amber-950/30 to-slate-950 border-2 border-amber-500/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Gift className="w-5 h-5 text-amber-400" /> Top Up Bonus 🎁
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-amber-400" /></div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-center">
                <p className="text-xs text-amber-200 font-bold">💎 Gem + 🪙 Koin Streak sekaligus!</p>
                <p className="text-[10px] text-white/60 mt-1">Pembelian otomatis menambah Gem & Koin Streak</p>
              </div>
              {packages.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-white/10 p-6 text-center">
                  <p className="text-3xl mb-2">🪙</p>
                  <p className="text-sm font-bold text-white/70">Belum ada paket combo aktif.</p>
                </div>
              )}
              {packages.map((p) => {
                const q = getQty(p.id);
                const totalPrice = p.price * q;
                return (
                  <motion.div
                    key={p.id}
                    whileHover={{ scale: 1.02 }}
                    className="relative rounded-xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-950/40 via-orange-950/30 to-rose-950/40 p-3"
                  >
                    <div className="absolute -top-2 right-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> COMBO BONUS
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-3xl shrink-0">{p.icon}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white truncate">{p.name}</p>
                          <div className="flex items-center gap-2 text-xs font-bold mt-0.5">
                            <span className="flex items-center gap-1 text-cyan-300">
                              <Gem className="w-3 h-3" /> {formatCompactNumber(p.gems * q)}
                            </span>
                            <span className="text-white/40">+</span>
                            <span className="flex items-center gap-1 text-amber-300">
                              <Coins className="w-3 h-3" /> {formatCompactNumber(p.bonus_streak_coins * q)}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/60 mt-0.5">
                            {formatCompactNumber(p.gems * q)} Gem + {formatCompactNumber(p.bonus_streak_coins * q)} Koin Streak
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-white/10">
                          <button type="button" onClick={() => setPkgQty(p.id, q - 1)} disabled={q <= 1 || buying === p.id} className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 flex items-center justify-center text-white">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-white font-black text-sm w-6 text-center">{q}</span>
                          <button type="button" onClick={() => setPkgQty(p.id, q + 1)} disabled={q >= 99 || buying === p.id} className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 flex items-center justify-center text-white">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <Button
                          size="sm"
                          disabled={buying === p.id}
                          onClick={() => requestBuy(p)}
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black h-8"
                        >
                          {buying === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : `Rp${totalPrice.toLocaleString("id-ID")}`}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <p className="text-[10px] text-white/50 text-center">💡 Pembelian potong saldo akun login{hasPin ? " · Dilindungi PIN" : ""}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pinDialog} onOpenChange={(o) => { if (!o) { setPinDialog(null); setPinInput(""); } }}>
        <DialogContent className="max-w-xs bg-gradient-to-br from-slate-950 to-amber-950/40 border-2 border-amber-500/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Lock className="w-4 h-4 text-amber-400" /> Masukkan PIN
            </DialogTitle>
          </DialogHeader>
          {pinDialog && (
            <div className="space-y-3">
              <p className="text-xs text-white/70 text-center">
                Beli <span className="font-bold text-amber-300">{pinDialog.pkg.name}</span> x{pinDialog.quantity} <br />
                Total: <span className="font-bold text-emerald-400">Rp{(pinDialog.pkg.price * pinDialog.quantity).toLocaleString("id-ID")}</span>
              </p>
              <Input
                type="password" inputMode="numeric" maxLength={6} placeholder="••••••"
                value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter") confirmPin(); }}
                className="text-center text-2xl tracking-[0.3em] font-black bg-black/40 border-amber-500/40 text-white"
                autoFocus
              />
              <Button onClick={confirmPin} disabled={pinInput.length < 4} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black">
                <Lock className="w-4 h-4 mr-1" /> Konfirmasi
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
