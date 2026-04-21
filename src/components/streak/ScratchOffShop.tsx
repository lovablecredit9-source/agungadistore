import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Coins, Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

interface Card {
  id: string;
  cost: number;
  name: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  color: string;
  prizes: { label: string; value: number; weight: number }[];
}

const CARDS: Card[] = [
  {
    id: "bronze", cost: 50, name: "Bronze Scratch", emoji: "🥉", rarity: "common", color: "from-amber-700 to-orange-700",
    prizes: [
      { label: "+10 koin", value: 10, weight: 50 },
      { label: "+25 koin", value: 25, weight: 30 },
      { label: "+50 koin", value: 50, weight: 15 },
      { label: "+150 koin JACKPOT", value: 150, weight: 5 },
    ],
  },
  {
    id: "silver", cost: 150, name: "Silver Scratch", emoji: "🥈", rarity: "rare", color: "from-slate-300 to-slate-500",
    prizes: [
      { label: "+50 koin", value: 50, weight: 50 },
      { label: "+100 koin", value: 100, weight: 30 },
      { label: "+200 koin", value: 200, weight: 15 },
      { label: "+500 koin JACKPOT", value: 500, weight: 5 },
    ],
  },
  {
    id: "gold", cost: 400, name: "Gold Scratch", emoji: "🥇", rarity: "epic", color: "from-yellow-400 to-amber-600",
    prizes: [
      { label: "+150 koin", value: 150, weight: 45 },
      { label: "+300 koin", value: 300, weight: 30 },
      { label: "+600 koin", value: 600, weight: 18 },
      { label: "+1500 koin JACKPOT", value: 1500, weight: 7 },
    ],
  },
  {
    id: "diamond", cost: 1000, name: "Diamond Scratch", emoji: "💎", rarity: "legendary", color: "from-cyan-300 via-blue-400 to-purple-500",
    prizes: [
      { label: "+500 koin", value: 500, weight: 40 },
      { label: "+1000 koin", value: 1000, weight: 30 },
      { label: "+2500 koin", value: 2500, weight: 20 },
      { label: "+5000 koin MEGA JACKPOT", value: 5000, weight: 10 },
    ],
  },
];

const RARITY_BG: Record<string, string> = {
  common: "border-amber-400/50",
  rare: "border-slate-300/50",
  epic: "border-yellow-300/60",
  legendary: "border-cyan-300/70",
};

function pickPrize(card: Card) {
  const total = card.prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of card.prizes) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return card.prizes[0];
}

export default function ScratchOffShop({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const totalKey = `scratch-total-${visitorId}`;
  const [totalWon, setTotalWon] = useState(0);
  const [scratching, setScratching] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ card: Card; prize: ReturnType<typeof pickPrize> } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scratchPct, setScratchPct] = useState(0);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    setTotalWon(Number(localStorage.getItem(totalKey) || "0"));
  }, [totalKey]);

  async function buyCard(card: Card) {
    if (!visitorId) return;
    if (scratching) return;
    setScratching(card.id);
    try {
      // 1. Validasi & potong koin di DB
      const { data: streak, error: selErr } = await supabase
        .from("daily_streaks")
        .select("id, streak_coins")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!streak) {
        toast({ title: "Belum ada streak", description: "Klaim streak harian dulu untuk dapat koin.", variant: "destructive" });
        setScratching(null);
        return;
      }
      const balance = streak.streak_coins || 0;
      if (balance < card.cost) {
        toast({ title: "Koin kurang", description: `Butuh ${card.cost} koin (kamu punya ${balance})`, variant: "destructive" });
        setScratching(null);
        return;
      }
      const { error: updErr } = await supabase
        .from("daily_streaks")
        .update({ streak_coins: balance - card.cost })
        .eq("id", streak.id);
      if (updErr) throw updErr;
      onUpdate?.();

      // 2. Roll hadiah lalu buka kartu untuk digosok
      const prize = pickPrize(card);
      setReveal({ card, prize });
      setScratchPct(0);
      setActivated(false);
    } catch (e) {
      toast({ title: "Gagal beli kartu", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setScratching(null);
    }
  }

  // Initialize scratch canvas when reveal opens
  useEffect(() => {
    if (!reveal) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    grad.addColorStop(0, "#94a3b8");
    grad.addColorStop(1, "#475569");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✋ GOSOK DI SINI", rect.width / 2, rect.height / 2);
  }, [reveal]);

  function scratchAt(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!reveal) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    // Calculate cleared % every few moves
    if (Math.random() < 0.15) {
      const dpr = window.devicePixelRatio || 1;
      const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
      let cleared = 0;
      const step = 60;
      for (let i = 3; i < data.length; i += 4 * step) {
        if (data[i] === 0) cleared++;
      }
      const total = data.length / (4 * step);
      const pct = (cleared / total) * 100;
      setScratchPct(pct);
      if (pct > 55 && !activated) {
        setActivated(true);
        // Tambahkan hadiah ke saldo koin DB (atomic-ish: re-fetch saldo terbaru)
        const prizeValue = reveal.prize.value;
        (async () => {
          try {
            const { data: s } = await supabase
              .from("daily_streaks")
              .select("id, streak_coins")
              .eq("visitor_id", visitorId)
              .maybeSingle();
            if (s) {
              await supabase
                .from("daily_streaks")
                .update({ streak_coins: (s.streak_coins || 0) + prizeValue })
                .eq("id", s.id);
            }
            const newTotal = totalWon + prizeValue;
            setTotalWon(newTotal);
            localStorage.setItem(totalKey, String(newTotal));
            toast({ title: "🎉 Hadiah Terbuka!", description: reveal.prize.label });
            onUpdate?.();
          } catch (err) {
            toast({ title: "Gagal mencairkan hadiah", description: err instanceof Error ? err.message : "Coba lagi", variant: "destructive" });
          }
        })();
      }
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500/15 via-purple-500/15 to-pink-500/15 border-2 border-fuchsia-400/40 p-3 sm:p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-fuchsia-300 animate-pulse" />
          <h3 className="font-bold text-base sm:text-lg bg-gradient-to-r from-fuchsia-200 via-pink-200 to-purple-200 bg-clip-text text-transparent">
            Scratch-Off Lottery
          </h3>
          <Badge className="bg-fuchsia-500/40 text-fuchsia-100 border-fuchsia-400/60 text-[9px] h-4 animate-pulse">JACKPOT</Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-300 font-bold">
          <Coins className="h-3.5 w-3.5" /> {totalWon}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CARDS.map((c) => (
          <motion.div
            key={c.id}
            whileHover={{ scale: 1.02 }}
            className={`rounded-xl bg-gradient-to-br ${c.color} bg-opacity-25 border-2 ${RARITY_BG[c.rarity]} p-2.5 text-center relative overflow-hidden`}
          >
            <div className="absolute -top-3 -right-3 text-5xl opacity-20">{c.emoji}</div>
            <div className="text-3xl mb-1 relative">{c.emoji}</div>
            <p className="font-bold text-[11px] text-white truncate">{c.name}</p>
            <Badge className="bg-black/40 text-white/90 text-[8px] h-3 px-1 my-1 border-0">{c.rarity.toUpperCase()}</Badge>
            <p className="text-[9px] text-white/80 mb-1.5">Max +{Math.max(...c.prizes.map(p => p.value))} 🪙</p>
            <Button
              size="sm"
              disabled={scratching === c.id}
              onClick={() => buyCard(c)}
              className="w-full h-7 text-[10px] bg-black/40 hover:bg-black/60 text-amber-200 border border-amber-400/40 font-bold"
            >
              {scratching === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                <><Coins className="h-3 w-3 mr-0.5" />{c.cost}</>
              )}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Scratch reveal modal */}
      <AnimatePresence>
        {reveal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8 }}
              className={`relative max-w-xs w-full rounded-3xl bg-gradient-to-br ${reveal.card.color} border-2 ${RARITY_BG[reveal.card.rarity]} p-5 shadow-2xl`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm text-white">{reveal.card.emoji} {reveal.card.name}</p>
                <Button size="sm" variant="ghost" onClick={() => setReveal(null)} className="h-6 px-2 text-white hover:bg-white/20">✕</Button>
              </div>

              <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-yellow-200 to-amber-400 shadow-inner">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                  <motion.div
                    animate={activated ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : {}}
                    transition={{ duration: 0.6, repeat: activated ? 3 : 0 }}
                    className="text-5xl mb-2"
                  >
                    {reveal.prize.value >= 1000 ? "👑" : reveal.prize.value >= 500 ? "💎" : "🪙"}
                  </motion.div>
                  <p className="font-black text-xl text-amber-900">{reveal.prize.label}</p>
                </div>
                <canvas
                  ref={canvasRef}
                  onPointerMove={(e) => { if (e.buttons === 1 || e.pointerType === "touch") scratchAt(e); }}
                  onPointerDown={scratchAt}
                  className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                />
              </div>

              <p className="text-[10px] text-center text-white/90 mt-2">
                {activated ? "✨ Hadiah sudah dimasukkan ke poin bonusmu!" : `Gosok lebih dari 50% untuk klaim · ${Math.round(scratchPct)}%`}
              </p>

              {activated && (
                <Button onClick={() => setReveal(null)} className="w-full mt-3 bg-white/30 hover:bg-white/40 text-white border border-white/40 font-bold">
                  <Star className="h-4 w-4 mr-1" /> Selesai
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
