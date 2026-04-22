import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Diamond, Rocket, Gift, Shield, Wallet, Check, Sparkles, Clock, Crown, Zap,
} from "lucide-react";

interface Props {
  visitorId: string;
  kind: "diamond" | "boost" | "luckybox" | "saver";
  onUpdate?: () => void;
}

const META: Record<string, any> = {
  diamond: {
    title: "Diamond Elite",
    icon: Diamond,
    grad: "from-cyan-400 via-sky-400 to-blue-500",
    bg: "from-cyan-500/15 via-sky-500/10 to-blue-500/15",
    border: "border-cyan-400/40",
    desc: "Cashback otomatis tiap belanja Streak Shop + badge eksklusif",
  },
  boost: {
    title: "Boost Squad",
    icon: Rocket,
    grad: "from-orange-400 via-pink-500 to-purple-600",
    bg: "from-orange-500/15 via-pink-500/10 to-purple-500/15",
    border: "border-pink-400/40",
    desc: "Multiplier XP & Poin streak permanen selama langganan",
  },
  luckybox: {
    title: "Lucky Box Membership",
    icon: Gift,
    grad: "from-emerald-400 via-teal-400 to-cyan-500",
    bg: "from-emerald-500/15 via-teal-500/10 to-cyan-500/15",
    border: "border-emerald-400/40",
    desc: "Klaim kotak hadiah random tiap hari berisi coin, gem, freeze, hint",
  },
  saver: {
    title: "Auto-Streak Saver",
    icon: Shield,
    grad: "from-rose-400 via-red-500 to-orange-500",
    bg: "from-rose-500/15 via-red-500/10 to-orange-500/15",
    border: "border-rose-400/40",
    desc: "Anti-putus streak: auto pakai freeze + restore mingguan",
  },
};

export default function MembershipExtrasShop({ visitorId, kind, onUpdate }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [revealItems, setRevealItems] = useState<any[] | null>(null);

  const meta = META[kind];
  const Icon = meta.icon;

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke("membership-extras", { body: { action: "list", visitorId } });
      setData(res || null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  async function purchase(tier: string, key: string) {
    setBusy(key);
    try {
      const { data: res } = await supabase.functions.invoke("membership-extras", { body: { action: "purchase", visitorId, kind, tier } });
      if (res?.error) toast({ title: "Gagal", description: res.error, variant: "destructive" });
      else if (res?.success) {
        toast({ title: "🎉 Berhasil!", description: res.message });
        await load();
        onUpdate?.();
      }
    } finally { setBusy(null); }
  }

  async function claimLuckyBox() {
    setBusy("claim");
    try {
      const { data: res } = await supabase.functions.invoke("membership-extras", { body: { action: "claim_luckybox", visitorId } });
      if (res?.error) toast({ title: "Gagal", description: res.error, variant: "destructive" });
      else if (res?.success) {
        setRevealItems(res.rewards);
        await load();
        onUpdate?.();
      }
    } finally { setBusy(null); }
  }

  if (loading) {
    return (
      <div className={`rounded-2xl bg-gradient-to-br ${meta.bg} border ${meta.border} p-6 text-center`}>
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }
  if (!data) return null;

  const catalog = data.catalogs[kind] || [];
  const active = data.active[kind];

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${meta.bg} border-2 ${meta.border} p-3 sm:p-4 shadow-2xl`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <motion.div
          animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${meta.grad} flex items-center justify-center shadow-lg`}
        >
          <Icon className="w-6 h-6 text-white drop-shadow" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-black text-base bg-gradient-to-r ${meta.grad} bg-clip-text text-transparent`}>
            {meta.title}
          </h3>
          <p className="text-[11px] text-white/70 leading-tight">{meta.desc}</p>
        </div>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between rounded-lg bg-black/30 border border-white/10 px-3 py-1.5 mb-3">
        <span className="text-[10px] text-white/60 uppercase tracking-wider">Saldo</span>
        <span className="text-sm font-bold text-amber-300 flex items-center gap-1">
          <Wallet className="w-3.5 h-3.5" /> Rp{(data.main_balance || 0).toLocaleString("id-ID")}
        </span>
      </div>

      {/* Active subscription banner */}
      {active && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl bg-gradient-to-r ${meta.grad} p-[2px] mb-3`}
        >
          <div className="rounded-[10px] bg-black/80 p-3">
            <div className="flex items-center justify-between mb-1">
              <Badge className={`bg-gradient-to-r ${meta.grad} text-white border-0 text-[10px]`}>
                <Check className="w-3 h-3 mr-0.5" /> AKTIF · {active.tier?.toUpperCase()}
              </Badge>
              <span className="text-[10px] text-white/60 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(active.expires_at).toLocaleDateString("id-ID")}
              </span>
            </div>

            {/* Diamond — show cashback earned */}
            {kind === "diamond" && (
              <div className="text-[11px] text-cyan-200 space-y-0.5">
                <div>Cashback {active.best_cashback_percent ?? active.cashback_percent}% · Sudah dapat <span className="font-bold text-amber-300">Rp{(active.total_cashback_earned || 0).toLocaleString("id-ID")}</span></div>
                {active.stacked_count > 1 && (
                  <Badge className="bg-cyan-500/40 text-cyan-100 border-cyan-400/50 text-[9px]">
                    📦 {active.stacked_count} paket stack · berakhir {new Date(active.latest_expires_at).toLocaleDateString("id-ID")}
                  </Badge>
                )}
              </div>
            )}

            {/* Boost — multiplier */}
            {kind === "boost" && (
              <div className="text-[11px] text-pink-200 space-y-0.5">
                <div>Multiplier <span className="font-black text-pink-100">x{active.best_multiplier ?? active.multiplier}</span> aktif untuk semua aktivitas streak</div>
                {active.stacked_count > 1 && (
                  <Badge className="bg-pink-500/40 text-pink-100 border-pink-400/50 text-[9px]">
                    📦 {active.stacked_count} paket stack · berakhir {new Date(active.latest_expires_at).toLocaleDateString("id-ID")}
                  </Badge>
                )}
              </div>
            )}

            {/* Lucky Box — claim button */}
            {kind === "luckybox" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-emerald-200">
                  <span>Sudah klaim <span className="font-bold">{active.total_days_claimed}</span> hari</span>
                  {active.stacked_count > 1 && (
                    <Badge className="bg-emerald-500/40 text-emerald-100 border-emerald-400/50 text-[9px]">
                      📦 {active.stacked_count} paket stack
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-emerald-100/80 bg-black/30 rounded px-2 py-1 space-y-0.5">
                  <div>🎁 Hari ini: <span className="font-black text-emerald-300">{active.effective_items_today || 0}</span> item siap klaim</div>
                  {active.pending_items_tomorrow > 0 && (
                    <div className="text-amber-200">⏰ Menunggu besok: <span className="font-black">+{active.pending_items_tomorrow}</span> item</div>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={data.claimed_today || busy === "claim" || (active.effective_items_today || 0) === 0}
                  onClick={claimLuckyBox}
                  className={`w-full h-9 bg-gradient-to-r ${meta.grad} text-white font-bold disabled:opacity-50`}
                >
                  {busy === "claim" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   data.claimed_today ? <><Check className="w-4 h-4 mr-1" /> Sudah klaim hari ini</> :
                   (active.effective_items_today || 0) === 0 ? <><Clock className="w-4 h-4 mr-1" /> Aktif besok</> :
                   <><Gift className="w-4 h-4 mr-1" /> Klaim {active.effective_items_today} Item Hari Ini</>}
                </Button>
              </div>
            )}

            {/* Saver — usage (stacked totals) */}
            {kind === "saver" && (
              <div className="space-y-1.5">
                {active.stacked_count > 1 && (
                  <Badge className="bg-rose-500/40 text-rose-100 border-rose-400/50 text-[9px]">
                    📦 {active.stacked_count} paket stack
                  </Badge>
                )}
                <div className="flex justify-between text-[10px] text-rose-200">
                  <span>🧊 Auto-Freeze: {active.freezes_used_this_week}/{active.total_auto_freeze_per_week ?? active.auto_freeze_per_week}</span>
                  <span>♻️ Restore: {active.restores_used_this_week}/{active.total_restore_per_week ?? active.restore_per_week}</span>
                </div>
                <Progress value={(active.freezes_used_this_week / Math.max(1, active.total_auto_freeze_per_week ?? active.auto_freeze_per_week)) * 100} className="h-1" />
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 gap-2">
        {catalog.map((p: any, idx: number) => {
          const isCurrentTier = active?.tier === p.tier;
          const isStackable = kind === "luckybox";
          const blocked = !isStackable && !!active;
          const showActiveBadge = isCurrentTier && !isStackable;
          return (
            <motion.div
              key={p.tier}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.01 }}
              className={`rounded-xl bg-gradient-to-r ${meta.bg} border ${showActiveBadge ? "border-amber-400/70 shadow-lg shadow-amber-500/30" : meta.border} p-2.5`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.grad} flex items-center justify-center shrink-0 shadow`}>
                  {idx === 0 ? <Sparkles className="w-5 h-5 text-white" /> :
                   idx === 1 ? <Zap className="w-5 h-5 text-white" /> :
                   <Crown className="w-5 h-5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-white/70 truncate">
                    {kind === "diamond" && `Cashback ${p.cashback_percent}% · ${p.duration_days} hari`}
                    {kind === "boost" && `XP & Poin x${p.multiplier} · ${p.duration_days} hari`}
                    {kind === "luckybox" && `${p.items_per_day} item/hari · ${p.duration_days} hari · 📦 stack`}
                    {kind === "saver" && `${p.auto_freeze_per_week}x freeze${p.restore_per_week > 0 ? ` + ${p.restore_per_week} restore` : ""} / minggu`}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={busy === `b-${p.tier}` || blocked}
                  onClick={() => purchase(p.tier, `b-${p.tier}`)}
                  className={`h-9 px-2.5 bg-gradient-to-r ${meta.grad} text-white font-bold text-[11px] shrink-0 disabled:opacity-60`}
                >
                  {busy === `b-${p.tier}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                   showActiveBadge ? <><Check className="w-3 h-3 mr-0.5" /> Aktif</> :
                   blocked ? "Terkunci" :
                   `Rp${(p.price_idr / 1000).toFixed(0)}K`}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Reveal modal */}
      <AnimatePresence>
        {revealItems && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRevealItems(null)}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 12 }}
              onClick={(e) => e.stopPropagation()}
              className={`rounded-3xl bg-gradient-to-br ${meta.bg} border-2 ${meta.border} p-6 max-w-xs w-full text-center shadow-2xl`}
            >
              <div className="text-5xl mb-2">🎁</div>
              <h3 className={`font-black text-xl bg-gradient-to-r ${meta.grad} bg-clip-text text-transparent mb-3`}>
                Hadiah Lucky Box!
              </h3>
              <div className="space-y-2 mb-4">
                {revealItems.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.15 }}
                    className="rounded-xl bg-black/40 border border-white/20 p-2.5 flex items-center gap-2"
                  >
                    <div className="text-2xl">{r.icon}</div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm text-white">{r.name}</p>
                    </div>
                    <Badge className="bg-amber-500/40 text-amber-100 border-amber-400/50 font-black">
                      x{r.qty}
                    </Badge>
                  </motion.div>
                ))}
              </div>
              <Button onClick={() => setRevealItems(null)} className={`w-full bg-gradient-to-r ${meta.grad} text-white font-bold`}>
                Mantap!
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
