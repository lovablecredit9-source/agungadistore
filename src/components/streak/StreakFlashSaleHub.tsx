import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Zap, Coins, Gem, Wallet, Clock, Flame, Sparkles, ShoppingBag,
  Crown, Snowflake, Gift, Star, Lock,
} from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
  compact?: boolean;
}

const RARITY_RING: Record<string, string> = {
  common: "ring-slate-400/40",
  rare: "ring-sky-400/60",
  epic: "ring-fuchsia-400/70",
  legendary: "ring-amber-300/80",
  mythic: "ring-red-400/90 animate-pulse",
};

const RARITY_LABEL: Record<string, string> = {
  common: "COMMON", rare: "RARE", epic: "EPIC", legendary: "LEGENDARY", mythic: "MYTHIC",
};

const ITEM_ICON: Record<string, JSX.Element> = {
  coins: <Coins className="h-3.5 w-3.5" />,
  freeze: <Snowflake className="h-3.5 w-3.5" />,
  booster: <Zap className="h-3.5 w-3.5" />,
  scratch_card: <Gift className="h-3.5 w-3.5" />,
  mystery_box: <Gift className="h-3.5 w-3.5" />,
  cosmetic: <Crown className="h-3.5 w-3.5" />,
};

function Countdown({ endsAt }: { endsAt: string | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);
  if (!endsAt) return null;
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const text = d > 0 ? `${d}h ${h}j` : h > 0 ? `${h}j ${m}m` : `${m}m ${s}d`;
  return (
    <span className={`inline-flex items-center gap-1 ${diff < 3600000 ? "text-red-300 animate-pulse" : "text-amber-200"}`}>
      <Clock className="h-3 w-3" /> {text}
    </span>
  );
}

export default function StreakFlashSaleHub({ visitorId, onUpdate, compact = false }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke("streak-flash-sale", { body: { action: "list", visitorId } });
      setData(res || null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  // auto refresh tiap 30 detik biar countdown & stok fresh
  useEffect(() => {
    const i = setInterval(() => { if (visitorId) load(); }, 30000);
    return () => clearInterval(i);
  }, [visitorId]);

  async function buy(deal: any, currency: "coins" | "gems" | "balance") {
    setBusy(`${deal.id}-${currency}`);
    try {
      const { data: res } = await supabase.functions.invoke("streak-flash-sale", {
        body: { action: "purchase", visitorId, dealId: deal.id, currency },
      });
      if (res?.error) toast({ title: "Gagal beli", description: res.error, variant: "destructive" });
      else if (res?.success) {
        toast({ title: `🎉 ${deal.name}`, description: res.rewardSummary });
        await load();
        onUpdate?.();
      }
    } finally {
      setBusy(null);
    }
  }

  const deals = data?.deals || [];
  const filtered = useMemo(() => {
    if (filter === "all") return deals;
    if (filter === "featured") return deals.filter((d: any) => d.is_featured);
    return deals.filter((d: any) => d.item_type === filter);
  }, [deals, filter]);

  const categories = [
    { key: "all", label: "Semua", icon: Sparkles },
    { key: "featured", label: "Unggulan", icon: Star },
    { key: "coins", label: "Coin", icon: Coins },
    { key: "freeze", label: "Freeze", icon: Snowflake },
    { key: "booster", label: "Booster", icon: Zap },
    { key: "mystery_box", label: "Mystery", icon: Gift },
    { key: "scratch_card", label: "Scratch", icon: Gift },
    { key: "cosmetic", label: "Kosmetik", icon: Crown },
  ];

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-300" />
      </div>
    );
  }
  if (!data || deals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <Flame className="h-6 w-6 mx-auto text-orange-300/60 mb-2" />
        <p className="text-xs text-muted-foreground">Belum ada Flash Sale aktif. Pantengin terus ya! ⚡</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 relative overflow-hidden">
      {/* shimmer bg */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Zap className="h-5 w-5 text-amber-300 fill-amber-300" />
          </motion.div>
          <h3 className="font-extrabold text-base sm:text-lg bg-gradient-to-r from-amber-200 via-orange-100 to-red-200 bg-clip-text text-transparent truncate">
            ⚡ Flash Sale Streak
          </h3>
          <Badge className="bg-red-500/40 text-red-100 border-red-400/60 text-[9px] px-1.5 py-0 h-4 animate-pulse flex-shrink-0">HOT</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] flex-shrink-0">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40">
            <Coins className="h-3 w-3" />{data.user_coins}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/40">
            <Gem className="h-3 w-3" />{data.user_gems}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="relative flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide -mx-1 px-1">
          {categories.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ios-pressable ${
                filter === key
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30"
                  : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
              }`}
            >
              <Icon className="h-3 w-3" />{label}
            </button>
          ))}
        </div>
      )}

      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <AnimatePresence mode="popLayout">
          {filtered.slice(0, compact ? 3 : 50).map((deal: any) => {
            const stockLow = deal.total_stock && deal.stock_pct < 25;
            const ended = deal.ends_at && new Date(deal.ends_at).getTime() < Date.now();
            return (
              <motion.div
                key={deal.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`relative rounded-xl bg-gradient-to-br ${deal.gradient || "from-orange-500/30 to-red-500/30"} p-2.5 ring-2 ${RARITY_RING[deal.rarity] || ""} border border-white/10 overflow-hidden`}
              >
                {deal.is_featured && (
                  <div className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-full bg-yellow-400/90 text-yellow-950 text-[8px] font-extrabold shadow-lg">
                    ⭐ FEATURED
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <div className="text-2xl sm:text-3xl flex-shrink-0 drop-shadow-lg">{deal.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                      <span className="text-[8px] px-1 py-0 rounded bg-black/30 text-white font-bold tracking-wide">
                        {RARITY_LABEL[deal.rarity] || "COMMON"}
                      </span>
                      <span className="text-[8px] inline-flex items-center gap-0.5 px-1 py-0 rounded bg-white/15 text-white/90">
                        {ITEM_ICON[deal.item_type]}
                        {deal.item_type.replace("_", " ")}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-[12px] sm:text-[13px] text-white leading-tight truncate">{deal.name}</h4>
                    {deal.description && (
                      <p className="text-[10px] text-white/80 line-clamp-2 leading-snug mt-0.5">{deal.description}</p>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-[9px]">
                  <Countdown endsAt={deal.ends_at} />
                  {deal.discount_pct > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/80 text-white font-extrabold">
                      -{deal.discount_pct}%
                    </span>
                  )}
                </div>

                {deal.total_stock != null && (
                  <div className="mt-1.5">
                    <div className="flex justify-between text-[8px] text-white/80 mb-0.5">
                      <span>Stok: {deal.remaining_stock}/{deal.total_stock}</span>
                      {stockLow && <span className="text-red-200 font-bold animate-pulse">HAMPIR HABIS!</span>}
                    </div>
                    <Progress value={deal.stock_pct} className="h-1 bg-black/30" />
                  </div>
                )}

                <div className="mt-2 grid grid-cols-3 gap-1">
                  {deal.price_coins > 0 && (
                    <Button
                      size="sm"
                      disabled={!deal.can_purchase || ended || busy === `${deal.id}-coins` || data.user_coins < deal.price_coins}
                      onClick={() => buy(deal, "coins")}
                      className="h-7 text-[10px] px-1 bg-amber-500 hover:bg-amber-400 text-amber-950 font-extrabold rounded-lg ios-pressable disabled:opacity-40"
                    >
                      {busy === `${deal.id}-coins` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Coins className="h-3 w-3 mr-0.5" />{deal.price_coins}</>}
                    </Button>
                  )}
                  {deal.price_gems > 0 && (
                    <Button
                      size="sm"
                      disabled={!deal.can_purchase || ended || busy === `${deal.id}-gems` || data.user_gems < deal.price_gems}
                      onClick={() => buy(deal, "gems")}
                      className="h-7 text-[10px] px-1 bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-extrabold rounded-lg ios-pressable disabled:opacity-40"
                    >
                      {busy === `${deal.id}-gems` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Gem className="h-3 w-3 mr-0.5" />{deal.price_gems}</>}
                    </Button>
                  )}
                  {deal.price_balance > 0 && (
                    <Button
                      size="sm"
                      disabled={!deal.can_purchase || ended || busy === `${deal.id}-balance`}
                      onClick={() => buy(deal, "balance")}
                      className="h-7 text-[10px] px-1 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold rounded-lg ios-pressable disabled:opacity-40"
                    >
                      {busy === `${deal.id}-balance` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Wallet className="h-3 w-3 mr-0.5" />{(deal.price_balance / 1000).toFixed(0)}k</>}
                    </Button>
                  )}
                </div>

                {!deal.can_purchase && (
                  <div className="mt-1.5 text-center text-[9px] text-white/70 inline-flex items-center justify-center gap-1 w-full">
                    <Lock className="h-3 w-3" />
                    {deal.remaining_daily === 0 ? "Limit harian habis" : "Stok habis"}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {compact && deals.length > 3 && (
        <div className="relative mt-2 text-center text-[10px] text-amber-200/80">
          +{deals.length - 3} flash sale lainnya — buka tab Shop
        </div>
      )}
    </div>
  );
}
