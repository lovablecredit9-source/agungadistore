import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { Zap, Gift, Sparkles, Clock, Flame, Box, X, Loader2, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FlashSale {
  id: string;
  title: string;
  description: string;
  icon: string;
  content_type: "product" | "reward";
  reward_type?: string;
  reward_value?: number;
  cost_coins?: number;
  cost_gems?: number;
  original_price: number;
  flash_price: number;
  discount_percent: number;
  total_stock: number;
  sold_count: number;
  starts_at: string;
  ends_at: string;
  session_slot: string;
}

interface MysteryDrop {
  id: string;
  starts_at: string;
  ends_at: string;
  total_stock: number;
  opened_count: number;
  rarity_pool: any[];
  slot_index: number;
}

interface SpinSegment {
  id: string;
  label: string;
  reward_type: string;
  reward_value: number;
  weight: number;
  icon: string;
  color: string;
}

const RARITY_COLOR: Record<string, string> = {
  common: "from-slate-400 to-slate-500",
  rare: "from-blue-500 to-cyan-500",
  epic: "from-purple-500 to-pink-500",
  legendary: "from-amber-400 via-orange-500 to-red-500",
};

function fmtCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function EngagementHub() {
  const { toast } = useToast();
  const visitorId = getVisitorId();
  const [tab, setTab] = useState<"flash" | "spin" | "mystery">("flash");
  const [active, setActive] = useState<FlashSale[]>([]);
  const [upcoming, setUpcoming] = useState<FlashSale[]>([]);
  const [drops, setDrops] = useState<MysteryDrop[]>([]);
  const [serverTime, setServerTime] = useState<number>(Date.now());
  const [tick, setTick] = useState(0);

  // Spin
  const [spinSegments, setSpinSegments] = useState<SpinSegment[]>([]);
  const [spinClaimed, setSpinClaimed] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinSegment | null>(null);
  const [spinRotation, setSpinRotation] = useState(0);

  // Mystery
  const [mysteryOpening, setMysteryOpening] = useState<string | null>(null);
  const [mysteryResult, setMysteryResult] = useState<any>(null);
  const [openedDrops, setOpenedDrops] = useState<Set<string>>(new Set());

  const fetchAll = async () => {
    const [{ data: list }, { data: spin }, { data: claims }] = await Promise.all([
      supabase.functions.invoke("auto-engagement", { body: {}, method: "GET" as any }).catch(async () => {
        const r = await fetch(`https://qhkcohwrforhqjylaapo.supabase.co/functions/v1/auto-engagement?action=list&visitorId=${visitorId}`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        return { data: await r.json() };
      }),
      fetch(`https://qhkcohwrforhqjylaapo.supabase.co/functions/v1/auto-engagement?action=spin_status&visitorId=${visitorId}`, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      }).then(r => r.json()).then(d => ({ data: d })),
      supabase.from("mystery_box_drop_claims").select("drop_id").eq("visitor_id", visitorId),
    ]);

    if (list) {
      setActive(list.active || []);
      setUpcoming(list.upcoming || []);
      setDrops(list.mystery_drops || []);
      if (list.server_time) setServerTime(new Date(list.server_time).getTime());
    }
    if (spin) {
      setSpinSegments(spin.segments || []);
      setSpinClaimed(!!spin.claimed_today);
    }
    if (claims) setOpenedDrops(new Set(claims.map((c: any) => c.drop_id)));
  };

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 60000);
    const ti = setInterval(() => setTick(x => x + 1), 1000);
    return () => { clearInterval(t); clearInterval(ti); };
    // eslint-disable-next-line
  }, []);

  const now = Date.now() + (tick * 0); // re-render every sec

  const handleSpin = async () => {
    if (spinning || spinClaimed) return;
    setSpinning(true);
    try {
      const r = await fetch(`https://qhkcohwrforhqjylaapo.supabase.co/functions/v1/auto-engagement?action=spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ visitorId }),
      });
      const data = await r.json();
      if (data.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setSpinning(false); return; }
      const winnerIdx = spinSegments.findIndex(s => s.id === data.segment.id);
      const segAngle = 360 / spinSegments.length;
      const targetAngle = 360 * 6 + (360 - winnerIdx * segAngle - segAngle / 2);
      setSpinRotation(targetAngle);
      setTimeout(() => {
        setSpinResult(data.segment);
        setSpinClaimed(true);
        setSpinning(false);
        toast({ title: "🎉 Selamat!", description: `Kamu dapat ${data.segment.label}` });
      }, 4500);
    } catch (e) {
      toast({ title: "Error", description: "Gagal spin", variant: "destructive" });
      setSpinning(false);
    }
  };

  const handleOpenMystery = async (dropId: string) => {
    setMysteryOpening(dropId);
    try {
      const r = await fetch(`https://qhkcohwrforhqjylaapo.supabase.co/functions/v1/auto-engagement?action=mystery_open`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ dropId, visitorId }),
      });
      const data = await r.json();
      if (data.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setMysteryOpening(null); return; }
      setMysteryResult(data.reward);
      setOpenedDrops(p => new Set([...p, dropId]));
      fetchAll();
    } catch (e) {
      toast({ title: "Error", description: "Gagal buka", variant: "destructive" });
    } finally {
      setMysteryOpening(null);
    }
  };

  const handleBuyFlash = async (sale: FlashSale, paymentMethod: "coin" | "gem") => {
    try {
      const r = await fetch(`https://qhkcohwrforhqjylaapo.supabase.co/functions/v1/auto-engagement?action=purchase_flash`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ saleId: sale.id, visitorId, paymentMethod }),
      });
      const data = await r.json();
      if (data.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); return; }
      toast({ title: "🎉 Berhasil!", description: `${sale.title} - bayar ${data.cost_paid} ${paymentMethod === "gem" ? "💎" : "🪙"}` });
      fetchAll();
    } catch (e) {
      toast({ title: "Error", description: "Gagal beli", variant: "destructive" });
    }
  };

  const activeMystery = drops.find(d => {
    const s = new Date(d.starts_at).getTime();
    const e = new Date(d.ends_at).getTime();
    return Date.now() >= s && Date.now() <= e;
  });

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-1 shadow-2xl">
      <div className="rounded-[22px] bg-background p-4 space-y-4">
        {/* Header tabs */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-pink-500" /> Live Hub
            </h3>
            <p className="text-[10px] text-muted-foreground">Update otomatis tiap hari · Beda terus!</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-bold text-red-500">LIVE</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-muted">
          {[
            { k: "flash", label: "Flash Sale", icon: Zap, count: active.length },
            { k: "spin", label: "Spin Hari", icon: Gift, count: spinClaimed ? 0 : 1 },
            { k: "mystery", label: "Mystery", icon: Box, count: activeMystery && !openedDrops.has(activeMystery.id) ? 1 : 0 },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={`relative flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-[11px] font-bold transition-all ${
                tab === t.k ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg scale-105" : "text-muted-foreground hover:bg-background"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 animate-pulse">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* FLASH SALE TAB */}
        {tab === "flash" && (
          <div className="space-y-3">
            {active.length === 0 && upcoming.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Belum ada flash sale aktif. Cek lagi nanti! ⚡
              </div>
            )}
            {active.map(sale => {
              const remaining = new Date(sale.ends_at).getTime() - Date.now();
              const stock = sale.total_stock - sale.sold_count;
              const stockPct = (stock / sale.total_stock) * 100;
              return (
                <motion.div
                  key={sale.id}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 p-3 text-white shadow-lg"
                >
                  <div className="flex items-start gap-2">
                    <div className="text-3xl shrink-0">{sale.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase bg-white/25 px-1.5 py-0.5 rounded-full">⚡ {sale.session_slot}</span>
                        <span className="text-[9px] font-bold bg-yellow-300 text-red-700 px-1.5 py-0.5 rounded-full">-{sale.discount_percent}%</span>
                      </div>
                      <div className="font-black text-sm truncate mt-0.5">{sale.title}</div>
                      <div className="text-[10px] opacity-90 truncate">{sale.description}</div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {fmtCountdown(remaining)}</span>
                        <span className="flex items-center gap-0.5"><Flame className="w-3 h-3" /> Sisa {stock}/{sale.total_stock}</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-white/20 overflow-hidden">
                        <div className="h-full bg-white" style={{ width: `${stockPct}%` }} />
                      </div>
                      {sale.content_type === "reward" && (
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={() => handleBuyFlash(sale, "coin")}
                            className="flex-1 px-2 py-1.5 rounded-lg bg-white/95 text-orange-700 text-[10px] font-black hover:bg-white"
                          >
                            🪙 {sale.cost_coins}
                          </button>
                          <button
                            onClick={() => handleBuyFlash(sale, "gem")}
                            className="flex-1 px-2 py-1.5 rounded-lg bg-cyan-500 text-white text-[10px] font-black hover:bg-cyan-600"
                          >
                            💎 {sale.cost_gems}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {upcoming.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground mb-1.5 px-1">⏰ SEGERA HADIR</p>
                <div className="space-y-1.5">
                  {upcoming.slice(0, 3).map(s => {
                    const startsIn = new Date(s.starts_at).getTime() - Date.now();
                    return (
                      <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl bg-muted/50 border border-border/50">
                        <span className="text-xl">{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{s.title}</div>
                          <div className="text-[10px] text-muted-foreground">Mulai dalam {fmtCountdown(startsIn)}</div>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-600">-{s.discount_percent}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SPIN WHEEL TAB */}
        {tab === "spin" && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">🎁 Spin gratis 1x sehari, hadiah random!</p>
            </div>
            <div className="relative aspect-square max-w-[260px] mx-auto">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
                <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-red-500 drop-shadow-lg" />
              </div>
              <motion.div
                animate={{ rotate: spinRotation }}
                transition={{ duration: 4.5, ease: [0.17, 0.67, 0.12, 0.99] }}
                className="relative w-full h-full rounded-full overflow-hidden border-4 border-yellow-400 shadow-2xl"
                style={{ background: "conic-gradient(" + spinSegments.map((s, i) => `${s.color} ${(i / spinSegments.length) * 360}deg ${((i + 1) / spinSegments.length) * 360}deg`).join(", ") + ")" }}
              >
                {spinSegments.map((s, i) => {
                  const angle = (360 / spinSegments.length) * i + (180 / spinSegments.length);
                  return (
                    <div
                      key={s.id}
                      className="absolute top-1/2 left-1/2 origin-left text-white text-[10px] font-black drop-shadow-md whitespace-nowrap"
                      style={{ transform: `translate(0, -50%) rotate(${angle}deg) translate(20px, 0)` }}
                    >
                      <span className="mr-1">{s.icon}</span>
                      <span>{s.label}</span>
                    </div>
                  );
                })}
              </motion.div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 border-4 border-white shadow-xl flex items-center justify-center z-10">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </div>
            <button
              onClick={handleSpin}
              disabled={spinning || spinClaimed}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-sm shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {spinning ? <><Loader2 className="w-4 h-4 animate-spin" /> Memutar...</> :
                spinClaimed ? <>✓ Sudah Spin Hari Ini · Balik Besok!</> :
                <><Sparkles className="w-4 h-4" /> SPIN GRATIS!</>}
            </button>
          </div>
        )}

        {/* MYSTERY BOX TAB */}
        {tab === "mystery" && (
          <div className="space-y-3">
            <p className="text-[11px] text-center text-muted-foreground">📦 Mystery Box drop tiap 6 jam - buka 1x per drop!</p>
            {drops.map(d => {
              const startsAt = new Date(d.starts_at).getTime();
              const endsAt = new Date(d.ends_at).getTime();
              const isActive = Date.now() >= startsAt && Date.now() <= endsAt;
              const isUpcoming = Date.now() < startsAt;
              const opened = openedDrops.has(d.id);
              const stockLeft = d.total_stock - d.opened_count;

              return (
                <motion.div
                  key={d.id}
                  whileHover={{ scale: isActive && !opened ? 1.02 : 1 }}
                  className={`relative overflow-hidden rounded-2xl p-3 ${
                    isActive ? "bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-xl" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={isActive && !opened ? { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-4xl shrink-0"
                    >
                      {opened ? "✅" : isActive ? "📦" : isUpcoming ? "🔒" : "⌛"}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black">Slot #{d.slot_index + 1}</div>
                      <div className="text-[10px] opacity-90">
                        {isActive ? `Berakhir ${fmtCountdown(endsAt - Date.now())}` :
                          isUpcoming ? `Mulai ${fmtCountdown(startsAt - Date.now())}` : "Sudah lewat"}
                      </div>
                      <div className="text-[10px] opacity-75">Sisa {stockLeft}/{d.total_stock} box</div>
                    </div>
                    {isActive && !opened && (
                      <button
                        onClick={() => handleOpenMystery(d.id)}
                        disabled={mysteryOpening === d.id}
                        className="px-3 py-2 rounded-xl bg-white text-purple-700 text-xs font-black shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-50"
                      >
                        {mysteryOpening === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "BUKA"}
                      </button>
                    )}
                  </div>
                  {isActive && !opened && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(d.rarity_pool as any[]).map((p, i) => (
                        <span key={i} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r ${RARITY_COLOR[p.rarity] || RARITY_COLOR.common} text-white shadow-sm`}>
                          {p.icon} {p.rarity}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spin Result Modal */}
      <AnimatePresence>
        {spinResult && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSpinResult(null)}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5 }}
              className="relative bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-500 rounded-3xl p-6 max-w-xs w-full text-center text-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSpinResult(null)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/20 flex items-center justify-center"><X className="w-4 h-4" /></button>
              <Trophy className="w-12 h-12 mx-auto mb-2" />
              <div className="text-2xl font-black mb-1">SELAMAT!</div>
              <div className="text-5xl my-3">{spinResult.icon}</div>
              <div className="text-xl font-extrabold">{spinResult.label}</div>
              <p className="text-xs opacity-90 mt-2">Hadiah sudah masuk akun kamu 🎉</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mystery Result Modal */}
      <AnimatePresence>
        {mysteryResult && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setMysteryResult(null)}
          >
            <motion.div
              initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}
              className={`relative bg-gradient-to-br ${RARITY_COLOR[mysteryResult.rarity] || RARITY_COLOR.common} rounded-3xl p-6 max-w-xs w-full text-center text-white shadow-2xl`}
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setMysteryResult(null)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/20 flex items-center justify-center"><X className="w-4 h-4" /></button>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Rarity</div>
              <div className="text-lg font-black uppercase">{mysteryResult.rarity}</div>
              <div className="text-6xl my-3">{mysteryResult.icon}</div>
              <div className="text-xl font-extrabold">{mysteryResult.label}</div>
              <p className="text-xs opacity-90 mt-2">Buka lagi 6 jam lagi! 📦</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
