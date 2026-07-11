import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Gem, Loader2, Sparkles, Crown, Plus, Minus, Lock, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCompactNumber } from "@/lib/utils";
import { sendAdminWaNotif } from "@/lib/wa-notif";


interface Props { visitorId: string; onUpdate?: () => void; }
interface GemPackage {
  id: string; name: string; gems: number; bonus_gems: number; price: number; icon: string; sort_order: number;
  is_first_purchase_only?: boolean;
  bonus_streak_coins?: number;
  bonus_game_credits?: number;
}

// Selalu utamakan visitor_id akun saldo (tempat pembelian gem dicatat)
function resolveActiveVisitor(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem("balance_visitor_id") || fallback;
}

export default function GemShop({ visitorId: visitorIdProp, onUpdate }: Props) {
  const visitorId = resolveActiveVisitor(visitorIdProp);
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState<GemPackage[]>([]);
  const [myGems, setMyGems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [usedFirstIds, setUsedFirstIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"normal" | "diskon" | "bonus" | "komplit">("diskon");
  const [hasPin, setHasPin] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ pkg: GemPackage; quantity: number } | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [paySource, setPaySource] = useState<"auto" | "game" | "main">("auto");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const [{ data: pkgs }, { data: gemTotal }, pinResp] = await Promise.all([
      supabase.from("gem_packages").select("*").eq("is_active", true).order("sort_order"),
      supabase.rpc("get_account_gems", { p_visitor_id: visitorId }),
      supabase.functions.invoke("manage-pin", { body: { action: "check", visitorId } }),
    ]);
    const list = (pkgs || []) as GemPackage[];
    setPackages(list);
    setMyGems(typeof gemTotal === "number" ? gemTotal : 0);
    setHasPin(!!pinResp.data?.hasPin);
    // Check which first-purchase-only packages already used
    const firstIds = list.filter((p) => p.is_first_purchase_only).map((p) => p.id);
    if (firstIds.length && visitorId) {
      const { data: txs } = await supabase
        .from("gem_transactions")
        .select("reference_id")
        .eq("visitor_id", visitorId)
        .in("reference_id", firstIds);
      setUsedFirstIds(new Set((txs || []).map((t: any) => t.reference_id).filter(Boolean)));
    } else {
      setUsedFirstIds(new Set());
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [visitorId]);
  useEffect(() => { if (open) load(); }, [open]);

  useEffect(() => {
    if (!visitorId) return;
    const ch = supabase
      .channel(`gem-${visitorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_profiles" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gem_transactions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId]);

  const getQty = (id: string) => Math.max(1, Math.min(99, qty[id] || 1));
  const setPkgQty = (id: string, n: number) => setQty(q => ({ ...q, [id]: Math.max(1, Math.min(99, n)) }));

  const requestBuy = (p: GemPackage) => {
    const quantity = getQty(p.id);
    if (hasPin) {
      setPinInput("");
      setPinDialog({ pkg: p, quantity });
    } else {
      doBuy(p, quantity);
    }
  };

  const doBuy = async (p: GemPackage, quantity: number, pin?: string) => {
    setBuying(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("gem-purchase", {
        body: { visitorId, packageId: p.id, quantity, pin, paymentSource: paySource },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Gagal");
      toast({ title: "💎 Gem Dibeli!", description: `+${data.gems_added} 💎 (x${data.quantity})` });
      sendAdminWaNotif("gem_purchase", {
        gem: data.gems_added,
        jumlah: data.quantity,
        paket: p.name || p.id,
      }, visitorId);
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
      <motion.div whileHover={{ scale: 1.02 }} className="relative overflow-hidden rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-br from-cyan-950/60 to-blue-950/60 p-4 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/40">
              <Gem className="w-6 h-6 text-white drop-shadow" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Gem Premium</p>
              <p className="text-2xl font-black text-white">{formatCompactNumber(myGems)} 💎</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black shadow-lg shadow-cyan-500/40"
          >
            <Sparkles className="w-4 h-4 mr-1" /> Beli
          </Button>
        </div>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950 border-2 border-cyan-500/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Gem className="w-5 h-5 text-cyan-400" /> Toko Gem 💎
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-cyan-400" /></div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3 text-center">
                <p className="text-xs text-cyan-300 font-bold">Saldo Gem Kamu</p>
                <p className="text-3xl font-black text-white">{formatCompactNumber(myGems)} 💎</p>
              </div>
              <div className="rounded-lg bg-black/40 border border-white/10 p-2 space-y-1.5">
                <p className="text-[10px] font-black text-white/70 uppercase tracking-wider text-center">Sumber Pembayaran</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={() => setPaySource("auto")} className={`text-[10px] font-black rounded-md py-1.5 px-1 border transition ${paySource === "auto" ? "bg-cyan-500 text-white border-cyan-400" : "bg-black/40 border-white/10 text-white/60"}`}>Auto</button>
                  <button type="button" onClick={() => setPaySource("game")} className={`text-[10px] font-black rounded-md py-1.5 px-1 border transition ${paySource === "game" ? "bg-emerald-600 text-white border-emerald-500" : "bg-black/40 border-white/10 text-white/60"}`}>Saldo IN</button>
                  <button type="button" onClick={() => setPaySource("main")} className={`text-[10px] font-black rounded-md py-1.5 px-1 border transition ${paySource === "main" ? "bg-cyan-500 text-white border-cyan-400" : "bg-black/40 border-white/10 text-white/60"}`}>Saldo Utama</button>
                </div>
                <p className="text-[9px] text-white/50 text-center">{paySource === "auto" ? "Pakai Saldo IN dulu, lalu Saldo Utama." : paySource === "game" ? "Pakai Saldo IN saja." : "Pakai Saldo Utama saja."}</p>
              </div>
              {(() => {
                const allDiskon = packages.filter((p) => p.is_first_purchase_only);
                const diskonPkgs = [
                  ...allDiskon.filter((p) => !usedFirstIds.has(p.id)),
                  ...allDiskon.filter((p) => usedFirstIds.has(p.id)),
                ];
                const komplitPkgs = packages.filter((p) => !p.is_first_purchase_only && (p.bonus_game_credits || 0) > 0);
                const bonusPkgs = packages.filter((p) => !p.is_first_purchase_only && (p.bonus_streak_coins || 0) > 0 && !((p.bonus_game_credits || 0) > 0));
                const normalPkgs = packages.filter((p) => !p.is_first_purchase_only && !((p.bonus_streak_coins || 0) > 0) && !((p.bonus_game_credits || 0) > 0));
                const activePkgs = tab === "diskon" ? diskonPkgs : tab === "bonus" ? bonusPkgs : tab === "komplit" ? komplitPkgs : normalPkgs;
                return (
                  <>
                    <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => setTab("diskon")}
                        className={`py-2 rounded-lg text-[9px] font-black transition-all ${tab === "diskon" ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg" : "text-white/60 hover:text-white"}`}
                      >
                        🎁 Diskon {diskonPkgs.length > 0 && <span className="ml-0.5 px-1 py-0.5 rounded bg-white/20 text-[8px]">{diskonPkgs.length}</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("normal")}
                        className={`py-2 rounded-lg text-[9px] font-black transition-all ${tab === "normal" ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg" : "text-white/60 hover:text-white"}`}
                      >
                        💎 Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("bonus")}
                        className={`py-2 rounded-lg text-[9px] font-black transition-all ${tab === "bonus" ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg" : "text-white/60 hover:text-white"}`}
                      >
                        🪙 Bonus {bonusPkgs.length > 0 && <span className="ml-0.5 px-1 py-0.5 rounded bg-white/20 text-[8px]">{bonusPkgs.length}</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("komplit")}
                        className={`py-2 rounded-lg text-[9px] font-black transition-all ${tab === "komplit" ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg" : "text-white/60 hover:text-white"}`}
                      >
                        🎯 Komplit {komplitPkgs.length > 0 && <span className="ml-0.5 px-1 py-0.5 rounded bg-white/20 text-[8px]">{komplitPkgs.length}</span>}
                      </button>
                    </div>
                    {activePkgs.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed border-white/10 p-6 text-center">
                        <p className="text-3xl mb-2">{tab === "diskon" ? "✅" : tab === "bonus" ? "🪙" : tab === "komplit" ? "🎯" : "💎"}</p>
                        <p className="text-sm font-bold text-white/70">
                          {tab === "diskon" ? "Promo pertama sudah kamu klaim semua!" : tab === "bonus" ? "Belum ada paket Bonus." : tab === "komplit" ? "Belum ada paket Komplit." : "Belum ada paket normal."}
                        </p>
                        {tab === "diskon" && (
                          <button onClick={() => setTab("normal")} className="mt-3 text-xs text-cyan-400 underline">Lihat paket normal →</button>
                        )}
                      </div>
                    )}
                    {activePkgs.map((p) => {
                const total = p.gems + (p.bonus_gems || 0);
                const isPopular = p.sort_order === 2;
                const isBest = p.sort_order === 4;
                const isFirst = !!p.is_first_purchase_only;
                const isUsed = isFirst && usedFirstIds.has(p.id);
                const q = isFirst ? 1 : getQty(p.id);
                const totalPrice = p.price * q;
                return (
                  <motion.div
                    key={p.id}
                    whileHover={isUsed ? undefined : { scale: 1.02 }}
                    className={`relative rounded-xl border-2 p-3 ${
                      isUsed ? "border-white/10 bg-black/30 opacity-60 grayscale" :
                      isFirst ? "border-pink-500/60 bg-gradient-to-br from-pink-950/40 to-rose-950/40" :
                      isBest ? "border-yellow-500/60 bg-gradient-to-br from-yellow-950/40 to-orange-950/40" :
                      isPopular ? "border-purple-500/60 bg-gradient-to-br from-purple-950/40 to-pink-950/40" :
                      "border-cyan-500/40 bg-cyan-950/20"
                    }`}
                  >
                    {isUsed && (
                      <div className="absolute -top-2 right-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        ✅ SUDAH DIKLAIM
                      </div>
                    )}
                    {!isUsed && isFirst && (
                      <div className="absolute -top-2 right-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> PROMO PERTAMA · 1x
                      </div>
                    )}
                    {!isFirst && isBest && (
                      <div className="absolute -top-2 right-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5" /> TERBAIK
                      </div>
                    )}
                    {!isFirst && isPopular && (
                      <div className="absolute -top-2 right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                        POPULER
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-3xl shrink-0">{p.icon}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white truncate">{p.name}</p>
                          <p className="text-xs text-cyan-300 font-bold">
                            {formatCompactNumber(p.gems)} 💎
                            {p.bonus_gems > 0 && <span className="text-yellow-400"> +{p.bonus_gems}</span>}
                            {(p.bonus_streak_coins || 0) > 0 && (
                              <span className="text-amber-300"> + {formatCompactNumber((p.bonus_streak_coins || 0) * q)} 🪙</span>
                            )}
                            {(p.bonus_game_credits || 0) > 0 && (
                              <span className="text-emerald-300"> + {formatCompactNumber((p.bonus_game_credits || 0) * q)} 🔑</span>
                            )}
                          </p>
                          <p className="text-[10px] text-white/60">
                            Total: {formatCompactNumber(total * q)} 💎
                            {(p.bonus_streak_coins || 0) > 0 && <> · {formatCompactNumber((p.bonus_streak_coins || 0) * q)} Koin Streak</>}
                            {(p.bonus_game_credits || 0) > 0 && <> · {formatCompactNumber((p.bonus_game_credits || 0) * q)} Kredit Game</>}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {!isFirst && (
                          <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-white/10">
                            <button
                              type="button"
                              onClick={() => setPkgQty(p.id, q - 1)}
                              disabled={q <= 1 || buying === p.id}
                              className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 flex items-center justify-center text-white"
                              aria-label="Kurangi"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-white font-black text-sm w-6 text-center">{q}</span>
                            <button
                              type="button"
                              onClick={() => setPkgQty(p.id, q + 1)}
                              disabled={q >= 99 || buying === p.id}
                              className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 flex items-center justify-center text-white"
                              aria-label="Tambah"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <Button
                          size="sm"
                          disabled={buying === p.id || isUsed}
                          onClick={() => requestBuy(p)}
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black h-8 disabled:opacity-50"
                        >
                          {isUsed ? "Terpakai" : (buying === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : `Rp${totalPrice.toLocaleString("id-ID")}`)}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
                  </>
                );
              })()}
              <p className="text-[10px] text-white/50 text-center">💡 Pembelian potong saldo akun login{hasPin ? " · Dilindungi PIN" : ""}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PIN dialog */}
      <Dialog open={!!pinDialog} onOpenChange={(o) => { if (!o) { setPinDialog(null); setPinInput(""); } }}>
        <DialogContent className="max-w-xs bg-gradient-to-br from-slate-950 to-cyan-950/40 border-2 border-cyan-500/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Lock className="w-4 h-4 text-cyan-400" /> Masukkan PIN
            </DialogTitle>
          </DialogHeader>
          {pinDialog && (
            <div className="space-y-3">
              <p className="text-xs text-white/70 text-center">
                Beli <span className="font-bold text-cyan-300">{pinDialog.pkg.name}</span> x{pinDialog.quantity} <br />
                Total: <span className="font-bold text-emerald-400">Rp{(pinDialog.pkg.price * pinDialog.quantity).toLocaleString("id-ID")}</span>
              </p>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter") confirmPin(); }}
                className="text-center text-2xl tracking-[0.3em] font-black bg-black/40 border-cyan-500/40 text-white"
                autoFocus
              />
              <Button
                onClick={confirmPin}
                disabled={pinInput.length < 4}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black"
              >
                <Lock className="w-4 h-4 mr-1" /> Konfirmasi
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
