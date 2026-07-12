import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Ticket, Gem, Coins, Copy, Check, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ServerLuckCard } from "./ServerLuckCard";
import { triggerGameBalanceRefresh, useGameBalance, GameBalanceBadge } from "./GameBalance";
import { triggerGameCreditsRefresh } from "./GameCredits";
import { awardGamePoints } from "./gameStore";

const DRAW_POINTS: Record<string, number> = {
  none: 6,
  common: 12,
  rare: 24,
  epic: 40,
  legendary: 70,
};

const RARITY_STYLES: Record<string, string> = {
  common: "from-slate-400 to-slate-600",
  rare: "from-blue-500 to-indigo-600",
  epic: "from-purple-500 to-pink-600",
  legendary: "from-yellow-400 via-orange-500 to-red-500",
};

const RARITY_LABEL: Record<string, string> = {
  common: "Biasa",
  rare: "Langka",
  epic: "Epik",
  legendary: "Legendaris",
};

const RARITY_ORDER = ["legendary", "epic", "rare", "common"];

// Daftar hadiah (untuk info tampilan — sinkron dengan edge function lucky-draw)
const PRIZE_POOL: { emoji: string; label: string; rarity: string }[] = [
  { emoji: "💰", label: "ULTRA MEGA! Saldo IN Rp 100.000", rarity: "legendary" },
  { emoji: "💰", label: "SUPER MEGA! Saldo IN Rp 50.000", rarity: "legendary" },
  { emoji: "💎", label: "MEGA JACKPOT! 2.000 Gems", rarity: "legendary" },
  { emoji: "💰", label: "MEGA! Saldo IN Rp 20.000", rarity: "legendary" },
  { emoji: "💎", label: "JACKPOT! 1.000 Gems", rarity: "legendary" },
  { emoji: "💰", label: "Saldo IN Rp 10.000", rarity: "epic" },
  { emoji: "💎", label: "750 Gems", rarity: "epic" },
  { emoji: "🔥", label: "500 Streak Coins", rarity: "epic" },
  { emoji: "💎", label: "400 Gems", rarity: "epic" },
  { emoji: "🎮", label: "5 Game Credits (MAX)", rarity: "epic" },
  { emoji: "🪙", label: "Saldo IN Rp 5.000", rarity: "epic" },
  { emoji: "🪙", label: "Saldo IN Rp 2.000", rarity: "rare" },
  { emoji: "💎", label: "250 Gems", rarity: "rare" },
  { emoji: "💎", label: "120 Gems", rarity: "rare" },
  { emoji: "🔥", label: "200 Streak Coins", rarity: "rare" },
  { emoji: "🔥", label: "100 Streak Coins", rarity: "rare" },
  { emoji: "🎮", label: "4 Game Credits", rarity: "rare" },
  { emoji: "💎", label: "30–60 Gems", rarity: "common" },
  { emoji: "🔥", label: "25–50 Streak Coins", rarity: "common" },
  { emoji: "🎮", label: "1–3 Game Credits", rarity: "common" },
  { emoji: "😢", label: "Zonk! Coba lagi", rarity: "common" },
];


export default function LuckyDrawGame() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const [tickets, setTickets] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);

  const [drawing, setDrawing] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [prize, setPrize] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();


  const refresh = async () => {
    if (!visitorId) return;
    const [{ data: status }, { data: pkgs }] = await Promise.all([
      supabase.functions.invoke("lucky-draw", { body: { action: "status", visitorId } }),
      supabase.from("lucky_draw_ticket_packages").select("*").eq("is_active", true).order("sort_order"),
    ]);
    if (status?.tickets) setTickets(status.tickets);
    if (status?.promos) setPromos(status.promos);
    if (pkgs) setPackages(pkgs);
  };


  useEffect(() => { refresh(); }, [visitorId]);

  const extractError = async (error: any, data: any): Promise<string> => {
    if (data?.error) return data.error;
    try {
      const ctx = error?.context;
      if (ctx instanceof Response) {
        const txt = await ctx.text();
        try { return JSON.parse(txt)?.error || txt || "Coba lagi"; } catch { return txt || "Coba lagi"; }
      }
    } catch {}
    return error?.message || "Coba lagi";
  };

  const buyPackage = async (pkgId: string) => {
    setBuying(pkgId);
    const { data, error } = await supabase.functions.invoke("lucky-draw", { body: { action: "buy", visitorId, packageId: pkgId } });
    setBuying(null);
    if (error || data?.error) {
      const msg = await extractError(error, data);
      return toast({ title: "Gagal", description: msg, variant: "destructive" });
    }
    setTickets(data.tickets);
    toast({ title: "Berhasil!", description: "Tiket bertambah" });
  };

  const buyPromo = async (code: string) => {
    setBuying(code);
    const { data, error } = await supabase.functions.invoke("lucky-draw", { body: { action: "buy_promo", visitorId, promoCode: code } });
    setBuying(null);
    if (error || data?.error) {
      const msg = await extractError(error, data);
      return toast({ title: "Gagal", description: msg, variant: "destructive" });
    }
    if (data.tickets) setTickets(data.tickets);
    if (data.promos) setPromos(data.promos);
    toast({ title: "Promo berhasil!", description: "Tiket promo bertambah 🎉" });
  };


  const draw = async () => {
    if (!tickets || tickets.ticket_count < 1) return toast({ title: "Tiket habis", description: "Beli tiket dulu", variant: "destructive" });
    setDrawing(true); setPrize(null);
    const { data, error } = await supabase.functions.invoke("lucky-draw", { body: { action: "draw", visitorId } });
    if (error || data?.error) {
      setDrawing(false);
      return toast({ title: "Gagal", description: data?.error || "Coba lagi", variant: "destructive" });
    }
    // dramatic delay
    await new Promise(r => setTimeout(r, 1500));
    const { awardedPoints } = awardGamePoints(DRAW_POINTS[data.prize?.rarity] || DRAW_POINTS.none);
    setPrize({ ...data.prize, awardedPoints });
    setDrawing(false);
    refresh();
    import("@/lib/daily-mission").then(m => m.trackDailyMission(visitorId, "lucky_draw", 1)).catch(() => {});
    // Refresh Saldo IN, kredit, gems lintas-komponen — supaya hadiah langsung terlihat
    triggerGameBalanceRefresh();
    triggerGameCreditsRefresh();
    toast({ title: data.prize.reward_type === "none" ? "🎲 Undian selesai" : "🎉 Hadiah didapat!", description: `+${awardedPoints} poin level` });
  };

  if (!visitorId) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Login akun saldo dulu untuk main Lucky Draw.</div>;
  }

  return (
    <div className="space-y-4">
      <ServerLuckCard visitorId={visitorId} />

      <Card className="p-4 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white border-none text-center">
        <Sparkles className="w-8 h-8 mx-auto mb-1" />
        <h3 className="font-extrabold text-lg">🎯 Lucky Draw Belanja</h3>
        <p className="text-xs opacity-90 mt-1">Beli tiket pakai gems/coins, undi hadiah! Hati-hati ada zonk juga 😅</p>
      </Card>

      {/* Ticket counter */}
      <div className="bg-gradient-to-r from-yellow-400/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="w-6 h-6 text-orange-500" />
          <div>
            <div className="text-xs text-muted-foreground">Tiket kamu</div>
            <div className="font-black text-2xl">{tickets?.ticket_count || 0}</div>
          </div>
        </div>
        <Button onClick={draw} disabled={drawing || !tickets || tickets.ticket_count < 1} className="bg-gradient-to-r from-orange-500 to-rose-500 font-bold">
          {drawing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Undi!
        </Button>
      </div>

      {/* Prize reveal */}
      <AnimatePresence>
        {drawing && (
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [1, 1.1, 1], opacity: 1, rotate: [0, 5, -5, 0] }} transition={{ duration: 1.4, repeat: Infinity }} className="aspect-square rounded-2xl bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center text-white shadow-2xl">
            <Sparkles className="w-20 h-20 animate-spin" />
          </motion.div>
        )}
        {prize && !drawing && (
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", duration: 0.8 }} className={`aspect-[4/3] rounded-2xl bg-gradient-to-br ${prize.reward_type === "none" ? "from-slate-500 to-slate-700" : (RARITY_STYLES[prize.rarity] || RARITY_STYLES.common)} text-white flex flex-col items-center justify-center p-6 shadow-2xl`}>
            <div className="text-5xl mb-2">{prize.reward_type === "none" ? "😢" : "🎉"}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{prize.rarity}</div>
            <div className="text-2xl font-black mt-1 text-center drop-shadow">{prize.reward_label}</div>
            {prize.awardedPoints ? <div className="mt-2 text-xs font-black bg-white/20 rounded-full px-3 py-1">+{prize.awardedPoints} poin level</div> : null}
            {prize.voucher_code && (
              <button onClick={() => { navigator.clipboard.writeText(prize.voucher_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="mt-3 inline-flex items-center gap-1 text-xs bg-white/20 backdrop-blur rounded-full px-3 py-1 font-mono font-bold">
                {prize.voucher_code} {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Packages */}
      <div>
        <div className="text-sm font-bold mb-2">Beli Tiket</div>
        <div className="grid grid-cols-2 gap-2">
          {packages.map(pkg => {
            const isPromo = firstPromoAvailable && pkg.cost_currency === "gems" && pkg.tickets === 1;
            return (
            <motion.button
              key={pkg.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => buyPackage(pkg.id)}
              disabled={buying === pkg.id}
              className={`relative p-3 rounded-xl text-left shadow-md disabled:opacity-50 text-white ${isPromo ? "bg-gradient-to-br from-rose-500 to-orange-500 ring-2 ring-yellow-300" : "bg-gradient-to-br from-violet-600 to-purple-700"}`}
            >
              {isPromo && (
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-rose-700 text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                  PROMO 1×
                </div>
              )}
              <div className="flex items-center gap-1 text-xs opacity-80">
                <Ticket className="w-3 h-3" /> {pkg.tickets} tiket
              </div>
              <div className="font-extrabold text-sm mt-1">{pkg.name}</div>
              <div className="flex items-center gap-1 text-xs mt-2 bg-white/20 rounded-full px-2 py-0.5 w-fit">
                {pkg.cost_currency === "gems" ? <Gem className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                {isPromo ? (
                  <span className="font-bold flex items-center gap-1">
                    <span className="line-through opacity-60">{pkg.cost_amount}</span>
                    <span className="text-yellow-200">{promoPrice}</span>
                  </span>
                ) : (
                  <span className="font-bold">{pkg.cost_amount}</span>
                )}
              </div>
              {isPromo && <div className="text-[9px] mt-1 opacity-90">Khusus pembelian pertama</div>}
              {buying === pkg.id && <Loader2 className="w-3 h-3 animate-spin mt-1" />}
            </motion.button>
            );
          })}

        </div>
      </div>

      {/* Info Hadiah + Rarity */}
      <div>
        <div className="text-sm font-bold mb-2 flex items-center gap-1">
          <Gem className="w-4 h-4 text-purple-500" /> Info Hadiah & Kelangkaan
        </div>
        <div className="space-y-1.5">
          {RARITY_ORDER.map(rar => {
            const items = PRIZE_POOL.filter(p => p.rarity === rar);
            if (!items.length) return null;
            return (
              <div key={rar} className="rounded-xl border border-border/50 overflow-hidden">
                <div className={`bg-gradient-to-r ${RARITY_STYLES[rar]} text-white px-3 py-1.5 flex items-center justify-between`}>
                  <span className="text-xs font-black uppercase tracking-wider">{RARITY_LABEL[rar]}</span>
                  <span className="text-[10px] font-bold opacity-90">{RARITY_LABEL[rar] === "Legendaris" ? "🌟 Super langka" : RARITY_LABEL[rar] === "Epik" ? "Sangat langka" : RARITY_LABEL[rar] === "Langka" ? "Jarang" : "Sering muncul"}</span>
                </div>
                <div className="divide-y divide-border/40 bg-card">
                  {items.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="text-lg">{p.emoji}</span>
                      <span className="font-medium flex-1">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">💡 Aktifkan Server Luck untuk perbesar peluang hadiah langka & kurangi zonk.</p>
      </div>
    </div>

  );
}
