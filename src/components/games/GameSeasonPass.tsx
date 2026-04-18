import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Lock, Check, Crown, Loader2, Wallet, Gem, Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { matchColor, matchLabel, type SlotResult } from "./seasonPassRewards";

interface Props { visitorId: string | null }

const TIERS = Array.from({ length: 30 }, (_, i) => {
  const lvl = i + 1;
  const isPremium = lvl % 3 === 0;
  return { lvl, isPremium, xpRequired: lvl * 50 };
});

interface TierPreview extends SlotResult {
  tier: number;
  isPremiumTier: boolean;
}

export default function GameSeasonPass({ visitorId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState<any>(null);
  const [previews, setPreviews] = useState<TierPreview[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showBuy, setShowBuy] = useState(false);
  const [pin, setPin] = useState("");
  const [revealSlot, setRevealSlot] = useState<{ tier: number; slot: SlotResult; awarded: number; label: string } | null>(null);

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  async function load() {
    if (!visitorId) return;
    const { data } = await supabase.functions.invoke("season-pass-purchase", { body: { action: "get", visitorId } });
    setPass(data?.pass);
    setPreviews(data?.previews || []);
  }

  const xp = pass?.total_xp || 0;
  const claimed: number[] = pass?.claimed_tiers || [];
  const isPremium = !!pass?.is_premium;
  const currentLvl = TIERS.filter(t => xp >= t.xpRequired).length;

  async function claim(t: typeof TIERS[number]) {
    if (!visitorId) return;
    setBusy(`tier_${t.lvl}`);
    const { data, error } = await supabase.functions.invoke("season-pass-purchase", {
      body: { action: "claim_tier", visitorId, tierLevel: t.lvl },
    });
    setBusy(null);
    if (error || data?.error) { toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" }); return; }
    setPass(data.pass);
    setRevealSlot({ tier: t.lvl, slot: data.slot, awarded: data.awarded, label: data.rewardLabel });
  }

  async function buyPremium(source: "balance" | "gems" | "coins") {
    if (!visitorId) return;
    if (source === "balance" && !pin.trim()) { toast({ title: "PIN diperlukan", variant: "destructive" }); return; }
    setBusy(`buy_${source}`);
    const { data, error } = await supabase.functions.invoke("season-pass-purchase", {
      body: { action: "buy_premium", visitorId, source, pin: pin.trim() },
    });
    setBusy(null);
    if (error || data?.error) { toast({ title: "Gagal beli", description: data?.error || error?.message, variant: "destructive" }); return; }
    setPass(data.pass); setShowBuy(false); setPin("");
    toast({ title: "👑 Premium Pass aktif!", description: "Reward premium kini bisa diklaim." });
    load();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={!visitorId}
        className="w-full rounded-2xl p-3 text-left relative overflow-hidden bg-gradient-to-r from-yellow-500 via-pink-600 to-purple-700 disabled:opacity-50">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative flex items-center gap-3">
          <Crown className="w-9 h-9 text-yellow-300 drop-shadow-lg" strokeWidth={2.5} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest text-white/90 uppercase">Season Pass — Q2 2026</div>
            <div className="font-extrabold text-white text-sm">Tier {currentLvl}/30 • {xp.toLocaleString("id-ID")} XP</div>
            <div className="text-[10px] text-white/80">🎰 Slot reward: koin·gems·kredit·storage·nyawa</div>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-black">{isPremium ? "PREMIUM" : "FREE"}</span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-yellow-950 via-purple-950 to-pink-950 border-yellow-500/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-black text-white flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-300" /> SEASON PASS Q2 2026</DialogTitle></DialogHeader>

          <div className="rounded-xl bg-black/40 border border-yellow-500/30 p-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/80 mb-1">
              <span>Tier {currentLvl}/30</span><span>{xp.toLocaleString("id-ID")} XP</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(currentLvl / 30) * 100}%` }} className="h-full bg-gradient-to-r from-yellow-400 to-pink-500" />
            </div>
          </div>

          <div className="rounded-lg bg-black/30 border border-white/10 p-2 text-[10px] text-white/80 leading-relaxed">
            <div className="font-black text-white text-[11px] mb-0.5 flex items-center gap-1"><Sparkles className="w-3 h-3 text-yellow-300" /> Cara Slot Reward</div>
            3 emoji sama = <b className="text-yellow-300">JACKPOT</b> (hadiah penuh) · 2 sama = <b className="text-cyan-300">2× COCOK</b> (sebagian) · beda = <b className="text-slate-300">HIBURAN</b> (kecil).
          </div>

          {!isPremium && (
            <Button onClick={() => setShowBuy(true)} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black">
              <Crown className="w-4 h-4 mr-1" /> Aktifkan Premium Pass
            </Button>
          )}
          {isPremium && (
            <div className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 p-2 text-center">
              <span className="text-xs font-black text-emerald-300">✓ PREMIUM AKTIF — via {pass?.premium_source?.toUpperCase()}</span>
            </div>
          )}

          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
            {TIERS.map(t => {
              const unlocked = xp >= t.xpRequired;
              const done = claimed.includes(t.lvl);
              const ready = unlocked && !done && (!t.isPremium || isPremium);
              const preview = previews.find(p => p.tier === t.lvl);
              return (
                <div key={t.lvl} className={`rounded-lg p-2 flex items-center gap-2 border ${done ? "bg-emerald-500/10 border-emerald-500/40" : t.isPremium ? "bg-gradient-to-r from-yellow-500/10 to-pink-500/10 border-yellow-500/40" : "bg-black/30 border-white/10"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${t.isPremium ? "bg-gradient-to-br from-yellow-400 to-pink-500 text-black" : "bg-cyan-500/30 text-cyan-200"}`}>{t.lvl}</div>

                  <div className="flex-1 min-w-0">
                    {/* Slot reels */}
                    <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gradient-to-r ${preview ? matchColor(preview.matchType) : "from-slate-600 to-slate-700"} shadow-inner`}>
                      <span className="text-base leading-none">{preview?.reels[0].emoji ?? "❔"}</span>
                      <span className="text-base leading-none">{preview?.reels[1].emoji ?? "❔"}</span>
                      <span className="text-base leading-none">{preview?.reels[2].emoji ?? "❔"}</span>
                    </div>
                    <div className="text-[10px] font-bold text-white mt-0.5 truncate">
                      {preview ? (
                        <>
                          <span className="text-yellow-300">+{preview.awardedValue}</span> {preview.primary.label}
                          <span className="text-white/50"> · {matchLabel(preview.matchType)}</span>
                        </>
                      ) : "Memuat…"}
                    </div>
                    <div className="text-[9px] text-white/50">{t.xpRequired} XP {t.isPremium && "• Premium"}</div>
                  </div>

                  {!unlocked ? <Lock className="w-3.5 h-3.5 text-white/40 shrink-0" /> :
                   done ? <Check className="w-4 h-4 text-emerald-300 shrink-0" strokeWidth={3} /> :
                   ready ? (
                    <Button size="sm" disabled={busy === `tier_${t.lvl}`} onClick={() => claim(t)} className="h-6 text-[10px] bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-black shrink-0">
                      {busy === `tier_${t.lvl}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "KLAIM"}
                    </Button>
                  ) : t.isPremium && !isPremium ? <span className="text-[9px] font-black text-yellow-300 shrink-0">PREMIUM</span> : null}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reveal popup saat klaim */}
      <Dialog open={!!revealSlot} onOpenChange={(o) => !o && setRevealSlot(null)}>
        <DialogContent className="max-w-xs bg-gradient-to-br from-yellow-950 via-purple-950 to-pink-950 border-yellow-500/40">
          <DialogHeader><DialogTitle className="text-center text-white font-black">🎰 Tier {revealSlot?.tier}</DialogTitle></DialogHeader>
          <AnimatePresence>
            {revealSlot && (
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-3">
                <div className={`rounded-2xl p-4 bg-gradient-to-r ${matchColor(revealSlot.slot.matchType)} text-center shadow-xl`}>
                  <div className="flex justify-center gap-2 text-5xl">
                    {revealSlot.slot.reels.map((r, i) => (
                      <motion.span key={i} initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.15, type: "spring" }}>
                        {r.emoji}
                      </motion.span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-black text-white/90">{matchLabel(revealSlot.slot.matchType)}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-yellow-300">+{revealSlot.awarded}</div>
                  <div className="text-sm font-bold text-white">{revealSlot.label}</div>
                </div>
                <Button onClick={() => setRevealSlot(null)} className="w-full bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-black">OK</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Buy Premium dialog */}
      <Dialog open={showBuy} onOpenChange={setShowBuy}>
        <DialogContent className="max-w-sm bg-gradient-to-br from-yellow-950 via-purple-950 to-pink-950 border-yellow-500/40">
          <DialogHeader><DialogTitle className="text-lg font-black text-white">Beli Premium Pass</DialogTitle></DialogHeader>
          <p className="text-[11px] text-white/70">Pilih metode pembayaran. Premium aktif sampai akhir musim (Q2 2026).</p>

          <button onClick={() => buyPremium("balance")} disabled={!!busy} className="w-full p-3 rounded-xl bg-gradient-to-r from-cyan-500/30 to-blue-600/30 border border-cyan-400/40 text-left disabled:opacity-50">
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6 text-cyan-300" />
              <div className="flex-1">
                <div className="text-sm font-black text-white">Bayar pakai Saldo</div>
                <div className="text-[10px] text-white/70">Rp 25.000 — perlu PIN</div>
              </div>
              {busy === "buy_balance" && <Loader2 className="w-4 h-4 animate-spin text-white" />}
            </div>
          </button>
          <Input type="password" inputMode="numeric" placeholder="Masukkan PIN saldo" value={pin} onChange={(e) => setPin(e.target.value)}
            className="bg-black/40 border-cyan-500/30 text-white text-center" />

          <button onClick={() => buyPremium("gems")} disabled={!!busy} className="w-full p-3 rounded-xl bg-gradient-to-r from-pink-500/30 to-purple-600/30 border border-pink-400/40 text-left disabled:opacity-50">
            <div className="flex items-center gap-2">
              <Gem className="w-6 h-6 text-pink-300" />
              <div className="flex-1">
                <div className="text-sm font-black text-white">Bayar pakai Gems</div>
                <div className="text-[10px] text-white/70">500 Gems</div>
              </div>
              {busy === "buy_gems" && <Loader2 className="w-4 h-4 animate-spin text-white" />}
            </div>
          </button>

          <button onClick={() => buyPremium("coins")} disabled={!!busy} className="w-full p-3 rounded-xl bg-gradient-to-r from-yellow-500/30 to-orange-600/30 border border-yellow-400/40 text-left disabled:opacity-50">
            <div className="flex items-center gap-2">
              <Coins className="w-6 h-6 text-yellow-300" />
              <div className="flex-1">
                <div className="text-sm font-black text-white">Tukar Streak Koin</div>
                <div className="text-[10px] text-white/70">5.000 Streak Koin</div>
              </div>
              {busy === "buy_coins" && <Loader2 className="w-4 h-4 animate-spin text-white" />}
            </div>
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
