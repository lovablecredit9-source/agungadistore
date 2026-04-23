import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Zap, Sparkles, Gift, Lock, Check, Wallet, Flame, Crown, Star,
  Heart, Lightbulb, Snowflake, Shield, Package, Clover, Hourglass,
} from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
  compact?: boolean;
}

interface Pack {
  id: string;
  name: string;
  tier: string;
  description: string;
  duration_days: number;
  price_idr: number;
  daily_item_min: number;
  daily_item_max: number;
  instant_item_count: number;
  instant_full_pack: boolean;
  icon: string;
  badge_color: string;
  is_featured: boolean;
}

interface PPItem {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
}

interface Sub {
  id: string;
  pack_id: string;
  pack_name: string;
  starts_at: string;
  expires_at: string;
}

const RARITY_STYLE: Record<string, { bg: string; ring: string; text: string }> = {
  common: { bg: "from-slate-500/40 to-slate-700/40", ring: "ring-slate-300/40", text: "text-slate-100" },
  rare: { bg: "from-sky-500/40 to-blue-700/40", ring: "ring-sky-300/60", text: "text-sky-100" },
  epic: { bg: "from-fuchsia-500/40 to-purple-700/40", ring: "ring-fuchsia-300/60", text: "text-fuchsia-100" },
  legendary: { bg: "from-amber-400/50 to-red-500/50", ring: "ring-amber-300/80", text: "text-amber-100" },
};

const TIER_THEME: Record<string, { glow: string; panel: string; border: string; accent: string; chip: string; label: string }> = {
  trial: {
    glow: "from-cyan-400 via-sky-500 to-blue-600",
    panel: "from-[#0a1f3a] via-[#0e2c52] to-[#081a30]",
    border: "border-cyan-400/60",
    accent: "text-cyan-300",
    chip: "bg-cyan-500/30 text-cyan-100 border-cyan-400/60",
    label: "TRIAL",
  },
  weekly: {
    glow: "from-fuchsia-400 via-purple-500 to-violet-600",
    panel: "from-[#2a1340] via-[#3a1856] to-[#1f0d33]",
    border: "border-fuchsia-400/60",
    accent: "text-fuchsia-300",
    chip: "bg-fuchsia-500/30 text-fuchsia-100 border-fuchsia-400/60",
    label: "WEEKLY",
  },
  monthly: {
    glow: "from-amber-400 via-yellow-500 to-orange-500",
    panel: "from-[#3a2a0d] via-[#4a2f0e] to-[#2a1d08]",
    border: "border-amber-400/60",
    accent: "text-amber-300",
    chip: "bg-amber-500/30 text-amber-100 border-amber-400/60",
    label: "MONTHLY",
  },
  premium: {
    glow: "from-pink-400 via-rose-500 to-red-500",
    panel: "from-[#3a0d2a] via-[#4a0e3a] to-[#2a0820]",
    border: "border-pink-400/70",
    accent: "text-pink-300",
    chip: "bg-pink-500/30 text-pink-100 border-pink-400/60",
    label: "PREMIUM",
  },
};

function ItemIcon({ code, className }: { code: string; className?: string }) {
  const c = className || "h-4 w-4";
  switch (code) {
    case "nyawa": return <Heart className={`${c} text-red-400 fill-red-500/40`} />;
    case "hint": return <Lightbulb className={`${c} text-yellow-300 fill-yellow-300/30`} />;
    case "freeze": return <Snowflake className={`${c} text-cyan-300`} />;
    case "double_xp": return <Zap className={`${c} text-amber-300 fill-amber-300/40`} />;
    case "level_points": return <Star className={`${c} text-violet-300 fill-violet-400/40`} />;
    case "shield_streak": return <Shield className={`${c} text-emerald-300 fill-emerald-400/30`} />;
    case "mystery_box": return <Package className={`${c} text-pink-300`} />;
    case "lucky_token": return <Clover className={`${c} text-green-300 fill-green-400/40`} />;
    default: return <Sparkles className={c} />;
  }
}

function useCountdown(targetIso?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!targetIso) return "";
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PowerPackShop({ visitorId, onUpdate, compact = false }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [items, setItems] = useState<PPItem[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [inv, setInv] = useState<{ item_code: string; quantity: number }[]>([]);
  const [claimedMap, setClaimedMap] = useState<Record<string, boolean>>({});
  const [mainBalance, setMainBalance] = useState(0);
  const [nextUnlock, setNextUnlock] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reveal dialog
  const [reveal, setReveal] = useState<{ items: any[]; isInstant: boolean; packName: string } | null>(null);

  const countdown = useCountdown(nextUnlock);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("power-pack", { body: { action: "list", visitorId } });
      const list: Pack[] = data?.packs || [];
      setPacks(list);
      setItems(data?.items || []);
      setSubs(data?.subscriptions || []);
      setInv(data?.inventory || []);
      setClaimedMap(data?.claimed_today_map || {});
      setMainBalance(data?.main_balance || 0);
      setNextUnlock(data?.next_unlock || null);
      if (list.length > 0 && (!selectedId || !list.find((p) => p.id === selectedId))) {
        setSelectedId(list.find((p) => p.is_featured)?.id || list[0].id);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { if (visitorId) load(); /* eslint-disable-next-line */ }, [visitorId]);

  const selected = useMemo(() => packs.find((p) => p.id === selectedId) || packs[0], [packs, selectedId]);
  const theme = TIER_THEME[selected?.tier || "trial"] || TIER_THEME.trial;
  const activeSub = useMemo(() => subs.find((s) => s.pack_id === selected?.id), [subs, selected]);
  const ownedTotal = useMemo(() => inv.reduce((s, i) => s + i.quantity, 0), [inv]);

  async function purchase(packId: string) {
    setBusy(`buy-${packId}`);
    try {
      const { data, error } = await supabase.functions.invoke("power-pack", {
        body: { action: "purchase", visitorId, packId },
      });
      if (error || data?.error) {
        toast({ title: "Gagal", description: data?.error || error?.message || "Terjadi kesalahan", variant: "destructive" });
        return;
      }
      if (data?.instant_items?.length > 0) {
        setReveal({ items: data.instant_items, isInstant: true, packName: data.pack_name });
        if (data?.extended) {
          toast({ title: "⏱️ Durasi Diperpanjang!", description: `${data?.pack_name} aktif sampai ${new Date(data.expires_at).toLocaleDateString("id-ID")}` });
        }
      } else {
        toast({
          title: data?.extended ? "⏱️ Durasi Diperpanjang!" : "🎉 Power Pack Aktif!",
          description: data?.extended
            ? `${data?.pack_name} aktif sampai ${new Date(data.expires_at).toLocaleDateString("id-ID")}`
            : `${data?.pack_name} siap dimainkan`,
        });
      }
      await load();
      onUpdate?.();
    } finally { setBusy(null); }
  }

  async function claimDaily(subId: string) {
    setBusy(`claim-${subId}`);
    try {
      const { data, error } = await supabase.functions.invoke("power-pack", {
        body: { action: "daily-claim", visitorId, subscriptionId: subId },
      });
      if (error || data?.error) {
        toast({ title: "Gagal klaim", description: data?.error || error?.message, variant: "destructive" });
        return;
      }
      const sub = subs.find((s) => s.id === subId);
      setReveal({ items: data?.items || [], isInstant: false, packName: sub?.pack_name || "Power Pack" });
      await load();
      onUpdate?.();
    } finally { setBusy(null); }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <Loader2 className="h-7 w-7 animate-spin mx-auto text-purple-300" />
      </div>
    );
  }
  if (!selected) return <div className="text-center text-xs text-white/60 py-8">Belum ada Power Pack</div>;

  // ===== Compact showcase mode (untuk NeonStreakHub) =====
  if (compact) {
    return (
      <>
        <div className="relative rounded-2xl overflow-hidden border-2 border-pink-400/40 bg-gradient-to-br from-[#1a0820] via-[#2a0d1f] to-[#0d0815] shadow-[0_15px_40px_-10px_rgba(236,72,153,0.5)]">
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 h-px w-1/3 bg-gradient-to-r from-transparent via-pink-300 to-transparent"
          />
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-pink-500 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-fuchsia-500 blur-3xl" />
          </div>

          <div className="relative p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Flame className="h-4 w-4 text-pink-300" />
                </motion.div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                  Power Pack
                </h3>
                <Badge className="bg-pink-500/40 text-pink-100 border-pink-400/60 text-[9px] h-4 px-1.5">NEW</Badge>
              </div>
              {subs.length > 0 && (
                <Badge className="bg-emerald-500/30 text-emerald-100 border-emerald-400/60 text-[9px] h-4">
                  <Check className="h-2.5 w-2.5 mr-0.5" />{subs.length} aktif
                </Badge>
              )}
            </div>

            {/* Item pool preview */}
            <div className="flex items-center gap-1 mb-2 overflow-x-auto scrollbar-hide pb-1">
              {items.slice(0, 8).map((it) => (
                <motion.div
                  key={it.code}
                  whileHover={{ scale: 1.15 }}
                  className={`shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${RARITY_STYLE[it.rarity]?.bg} ring-1 ${RARITY_STYLE[it.rarity]?.ring} flex items-center justify-center`}
                  title={it.name}
                >
                  <ItemIcon code={it.code} className="h-4 w-4" />
                </motion.div>
              ))}
            </div>

            {/* Inventory mini */}
            {ownedTotal > 0 && (
              <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-black/30 border border-white/10">
                <Gift className="h-3 w-3 text-pink-300" />
                <span className="text-[10px] text-pink-100 font-bold">{ownedTotal} item</span>
                <span className="text-[10px] text-white/50">di inventaris</span>
              </div>
            )}

            <Button
              onClick={() => {
                document.getElementById("power-pack-full")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="w-full h-8 text-[11px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold shadow-lg shadow-pink-500/30"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {subs.length > 0 ? "Klaim Reward Harian" : "Lihat Paket Power"}
            </Button>
          </div>
        </div>
        <RevealDialog reveal={reveal} onClose={() => setReveal(null)} />
      </>
    );
  }

  // ===== FULL MODE =====
  return (
    <>
      <div id="power-pack-full" className="relative rounded-3xl overflow-hidden border-2 border-pink-500/40 bg-gradient-to-br from-[#1a0820] via-[#15102e] to-[#0d0815] shadow-[0_20px_60px_-15px_rgba(236,72,153,0.4)]">
        {/* BG orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute -top-12 -left-12 w-48 h-48 rounded-full bg-gradient-to-br ${theme.glow} opacity-20 blur-3xl`}
          />
          <motion.div
            animate={{ x: [0, -25, 0], y: [0, 20, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className={`absolute -bottom-12 -right-12 w-56 h-56 rounded-full bg-gradient-to-br ${theme.glow} opacity-15 blur-3xl`}
          />
        </div>

        {/* TOP BAR */}
        <div className="relative flex items-center justify-between gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm border-b border-pink-500/30">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className="bg-gradient-to-r from-emerald-500/40 to-teal-500/40 text-emerald-100 border-emerald-400/60 gap-1 text-[10px] h-5">
              <Wallet className="h-3 w-3" /> Rp{mainBalance.toLocaleString("id-ID")}
            </Badge>
            <Badge className="bg-gradient-to-r from-pink-500/40 to-fuchsia-500/40 text-pink-100 border-pink-400/60 gap-1 text-[10px] h-5">
              <Gift className="h-3 w-3" /> {ownedTotal} item
            </Badge>
            {nextUnlock && (
              <Badge className="bg-black/40 text-white/80 border-white/20 gap-1 text-[10px] h-5">
                <Hourglass className="h-3 w-3" /> {countdown}
              </Badge>
            )}
          </div>
          <motion.div
            animate={{ boxShadow: ["0 0 0px rgba(236,72,153,0.5)", "0 0 12px rgba(236,72,153,0.8)", "0 0 0px rgba(236,72,153,0.5)"] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-500/50 to-fuchsia-500/50 border border-pink-300/60 px-2 py-0.5"
          >
            <Flame className="h-3 w-3 text-white" />
            <span className="text-[9px] font-black text-white uppercase tracking-widest">Power Pack</span>
          </motion.div>
        </div>

        {/* MAIN AREA */}
        <div className="relative grid grid-cols-[1fr_104px] gap-2 p-2.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: -10, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className={`relative rounded-2xl overflow-hidden border-2 ${theme.border} bg-gradient-to-br ${theme.panel} p-3`}
            >
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 left-0 h-px w-1/2 bg-gradient-to-r from-transparent via-white to-transparent"
              />

              {/* Title */}
              <div className="relative mb-2.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-2xl shrink-0">{selected.icon}</span>
                    <div className="min-w-0">
                      <p className="font-black text-sm text-white truncate">{selected.name}</p>
                      <p className="text-[10px] text-white/70">{selected.duration_days} hari</p>
                    </div>
                  </div>
                  <Badge className={`${theme.chip} text-[9px] h-5 shrink-0`}>{theme.label}</Badge>
                </div>
                <p className="text-[10px] text-white/80 leading-snug">
                  Beli <span className="font-black text-white">Rp{selected.price_idr.toLocaleString("id-ID")}</span> ·{" "}
                  {selected.instant_full_pack ? (
                    <span className={`font-black ${theme.accent}`}>INSTAN PAKET LENGKAP</span>
                  ) : (
                    <>instan <span className={`font-black ${theme.accent}`}>{selected.instant_item_count} item</span></>
                  )}
                  {" · "}
                  <span className={`font-black ${theme.accent}`}>
                    {selected.daily_item_min === selected.daily_item_max
                      ? selected.daily_item_min
                      : `${selected.daily_item_min}-${selected.daily_item_max}`}
                  </span>{" "}
                  random/hari
                </p>
              </div>

              {/* Item pool grid */}
              <div className="relative grid grid-cols-4 gap-1.5 mb-2.5">
                {items.map((it) => (
                  <motion.div
                    key={it.code}
                    whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
                    className={`relative aspect-square rounded-lg bg-gradient-to-br ${RARITY_STYLE[it.rarity]?.bg} ring-1 ${RARITY_STYLE[it.rarity]?.ring} flex flex-col items-center justify-center p-1`}
                    title={it.name}
                  >
                    <ItemIcon code={it.code} className="h-4 w-4 mb-0.5" />
                    <p className="text-[8px] font-bold text-white/90 truncate w-full text-center leading-none">{it.name.split(" ")[0]}</p>
                    {it.rarity === "legendary" && (
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-lg ring-2 ring-amber-300/80 pointer-events-none"
                      />
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Action area */}
              {activeSub ? (
                <div className="relative space-y-1.5">
                  <div className="rounded-lg bg-black/40 border border-emerald-400/40 px-2 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-300" />
                      <span className="text-[10px] text-emerald-100 font-bold">
                        {subs.filter((s) => s.pack_id === selected.id).length > 1
                          ? `${subs.filter((s) => s.pack_id === selected.id).length}× Aktif (stack)`
                          : "Aktif"}
                      </span>
                    </div>
                    <span className="text-[9px] text-white/70">
                      Berakhir {new Date(activeSub.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <Button
                    disabled={!!claimedMap[activeSub.id] || busy === `claim-${activeSub.id}`}
                    onClick={() => claimDaily(activeSub.id)}
                    className={`w-full h-9 text-[11px] font-black bg-gradient-to-r ${theme.glow} text-white shadow-lg`}
                  >
                    {busy === `claim-${activeSub.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                     claimedMap[activeSub.id] ? <><Check className="h-3.5 w-3.5 mr-1" />Sudah Klaim Hari Ini</> :
                     <><Gift className="h-3.5 w-3.5 mr-1" />KLAIM HADIAH HARI INI</>}
                  </Button>
                  {/* Tombol beli lagi (extend / stack) */}
                  <Button
                    disabled={busy === `buy-${selected.id}` || mainBalance < selected.price_idr}
                    onClick={() => purchase(selected.id)}
                    variant="outline"
                    className="w-full h-8 text-[10px] font-bold border-white/30 bg-black/30 text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {busy === `buy-${selected.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                     mainBalance < selected.price_idr ? <><Lock className="h-3 w-3 mr-1" />Saldo Kurang</> :
                     <>+ Beli Lagi Rp{selected.price_idr.toLocaleString("id-ID")}</>}
                  </Button>
                </div>
              ) : (
                <Button
                  disabled={busy === `buy-${selected.id}` || mainBalance < selected.price_idr}
                  onClick={() => purchase(selected.id)}
                  className={`w-full h-9 text-[11px] font-black bg-gradient-to-r ${theme.glow} text-white shadow-lg disabled:opacity-50`}
                >
                  {busy === `buy-${selected.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                   mainBalance < selected.price_idr ? <><Lock className="h-3.5 w-3.5 mr-1" />Saldo Kurang</> :
                   <><Zap className="h-3.5 w-3.5 mr-1" />BELI Rp{selected.price_idr.toLocaleString("id-ID")}</>}
                </Button>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Side: pack list */}
          <div className="flex flex-col gap-1.5">
            {packs.map((p) => {
              const t = TIER_THEME[p.tier] || TIER_THEME.trial;
              const isSelected = p.id === selectedId;
              const isActive = subs.some((s) => s.pack_id === p.id);
              return (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedId(p.id)}
                  className={`relative rounded-xl border-2 p-1.5 text-left transition-all ${
                    isSelected ? `${t.border} bg-gradient-to-br ${t.panel} shadow-lg` : "border-white/10 bg-black/30"
                  }`}
                >
                  {p.is_featured && (
                    <Badge className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[8px] h-3.5 px-1 border-0">
                      <Crown className="h-2 w-2 mr-0.5" />HOT
                    </Badge>
                  )}
                  {isActive && (
                    <div className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-emerald-400 shadow shadow-emerald-400" />
                  )}
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-base">{p.icon}</span>
                    <span className={`text-[9px] font-black ${isSelected ? t.accent : "text-white/70"}`}>{t.label}</span>
                  </div>
                  <p className="text-[9px] text-white/80 font-bold">{p.duration_days}h</p>
                  <p className="text-[10px] font-black text-white">Rp{(p.price_idr / 1000).toFixed(0)}k</p>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Inventory bar */}
        {inv.length > 0 && (
          <div className="relative px-2.5 pb-2.5">
            <div className="rounded-xl bg-black/40 border border-white/10 p-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Gift className="h-3 w-3 text-pink-300" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">Inventaris Power</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {items.map((it) => {
                  const owned = inv.find((i) => i.item_code === it.code)?.quantity || 0;
                  return (
                    <div key={it.code} className={`relative flex items-center gap-1 rounded-lg px-1.5 py-1 bg-gradient-to-br ${RARITY_STYLE[it.rarity]?.bg} ${owned === 0 ? "opacity-30" : ""}`}>
                      <ItemIcon code={it.code} className="h-3 w-3 shrink-0" />
                      <span className="text-[9px] font-black text-white">×{owned}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <RevealDialog reveal={reveal} onClose={() => setReveal(null)} />
    </>
  );
}

function RevealDialog({ reveal, onClose }: { reveal: { items: any[]; isInstant: boolean; packName: string } | null; onClose: () => void }) {
  return (
    <Dialog open={!!reveal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm bg-gradient-to-br from-[#1a0820] via-[#2a0d3a] to-[#0d0815] border-2 border-pink-400/60">
        <DialogHeader>
          <DialogTitle className="text-center text-foreground text-lg font-black uppercase tracking-wider">
            {reveal?.isInstant ? "🎉 Bonus Pembelian!" : "🎁 Hadiah Harian!"}
          </DialogTitle>
          <p className="text-center text-xs text-white/70">{reveal?.packName}</p>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 py-2">
          {reveal?.items.map((it, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
              className={`relative rounded-xl p-3 bg-gradient-to-br ${RARITY_STYLE[it.rarity]?.bg} ring-2 ${RARITY_STYLE[it.rarity]?.ring} flex flex-col items-center gap-1`}
            >
              <ItemIcon code={it.code} className="h-6 w-6" />
              <p className="text-[10px] font-bold text-white text-center leading-tight">{it.name}</p>
              <Badge className="text-[8px] h-3 px-1 bg-black/40 text-white border-0">{it.rarity.toUpperCase()}</Badge>
              {it.rarity === "legendary" && (
                <motion.div
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="absolute inset-0 rounded-xl ring-2 ring-amber-300 pointer-events-none"
                />
              )}
            </motion.div>
          ))}
        </div>
        <Button onClick={onClose} className="w-full bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white font-bold">
          <Sparkles className="h-4 w-4 mr-1" />MANTAP!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
