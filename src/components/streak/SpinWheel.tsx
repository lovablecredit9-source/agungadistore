import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Coins, Sparkles, Trophy, Info, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Prize {
  type: string;
  value: number;
  label: string;
  rarity: string;
  weight: number;
  color: string;
}

interface Props {
  visitorId: string;
  coins: number;
  onUpdate?: () => void;
}

export default function SpinWheel({ visitorId, coins, onUpdate }: Props) {
  const { toast } = useToast();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [cost, setCost] = useState(50);
  const [spinsToday, setSpinsToday] = useState(0);
  const [lastSpin, setLastSpin] = useState<any>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resultPrize, setResultPrize] = useState<Prize | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  async function load() {
    const { data } = await supabase.functions.invoke("spin-wheel", { body: { visitorId, action: "check" } });
    if (data) {
      setPrizes(data.prizes || []);
      setCost(data.cost || 50);
      setSpinsToday(data.spinsToday || 0);
      setLastSpin(data.lastSpin || null);
    }
  }

  useEffect(() => {
    if (visitorId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId]);

  async function spin() {
    if (spinning || spinsToday > 0) return;
    if (coins < cost) {
      toast({ title: "Koin kurang", description: `Butuh ${cost} koin`, variant: "destructive" });
      return;
    }
    setSpinning(true);
    setShowResult(false);
    const { data, error } = await supabase.functions.invoke("spin-wheel", { body: { visitorId, action: "spin" } });
    if (error || data?.error) {
      toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" });
      setSpinning(false);
      return;
    }
    const idx = data.prizeIndex;
    const segAngle = 360 / prizes.length;
    const targetAngle = 360 * 6 + (360 - idx * segAngle - segAngle / 2);
    setRotation(targetAngle);
    setTimeout(() => {
      setResultPrize(data.prize);
      setShowResult(true);
      setSpinning(false);
      load();
      onUpdate?.();
      import("@/lib/daily-mission").then(m => m.trackDailyMission(visitorId, "spin_wheel", 1)).catch(() => {});
      import("@/components/games/gameStore").then(m => m.syncPowerUpsFromServer()).catch(() => {});
      window.dispatchEvent(new CustomEvent("power-ups-updated"));
    }, 4200);
  }

  if (prizes.length === 0) return null;

  const segAngle = 360 / prizes.length;
  const radius = 130;
  const cx = 150;
  const cy = 150;

  return (
    <div className="cyber-card-pink rounded-2xl p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 icon-3d-sparkles" strokeWidth={2.5} />
          <span className="text-xs font-black neon-text-pink tracking-widest uppercase">Spin Wheel Harian</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(true)}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-colors"
            aria-label="Lihat semua hadiah"
          >
            <Info className="w-3.5 h-3.5 text-cyan-300" strokeWidth={2.5} />
          </button>
          <span className="text-[10px] font-bold text-white/60">1x / hari</span>
        </div>
      </div>

      <div className="relative w-full aspect-square max-w-[300px] mx-auto">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
          <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[24px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
        </div>

        <motion.svg
          viewBox="0 0 300 300"
          className="w-full h-full drop-shadow-[0_0_30px_rgba(236,72,153,0.5)]"
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: [0.17, 0.67, 0.26, 1] }}
        >
          {prizes.map((p, i) => {
            const startAngle = i * segAngle - 90;
            const endAngle = (i + 1) * segAngle - 90;
            const x1 = cx + radius * Math.cos((startAngle * Math.PI) / 180);
            const y1 = cy + radius * Math.sin((startAngle * Math.PI) / 180);
            const x2 = cx + radius * Math.cos((endAngle * Math.PI) / 180);
            const y2 = cy + radius * Math.sin((endAngle * Math.PI) / 180);
            const largeArc = segAngle > 180 ? 1 : 0;
            const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
            const labelAngle = startAngle + segAngle / 2;
            const labelR = radius * 0.65;
            const lx = cx + labelR * Math.cos((labelAngle * Math.PI) / 180);
            const ly = cy + labelR * Math.sin((labelAngle * Math.PI) / 180);
            return (
              <g key={i}>
                <path d={path} fill={p.color} stroke="#0f172a" strokeWidth="2" />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${labelAngle + 90} ${lx} ${ly})`}
                  fill="white"
                  fontSize="10"
                  fontWeight="900"
                  className="select-none"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                >
                  {p.value > 0 ? `${p.type === "coins" ? "🪙" : "❄️"}${p.value}` : "💀"}
                </text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r="20" fill="#fbbf24" stroke="#0f172a" strokeWidth="3" />
          <circle cx={cx} cy={cy} r="8" fill="#0f172a" />
        </motion.svg>
      </div>

      <Button
        onClick={spin}
        disabled={spinning || spinsToday > 0 || coins < cost}
        className="w-full mt-3 h-12 bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-500 text-white font-black shadow-[0_0_20px_hsl(var(--neon-pink)/0.5)]"
      >
        {spinning ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> SPINNING...</>
        ) : spinsToday > 0 ? (
          <><Trophy className="w-4 h-4 mr-2" /> Sudah Spin: {lastSpin?.reward_label}</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" /> SPIN! ({cost} <Coins className="w-3.5 h-3.5 mx-1" /> koin)</>
        )}
      </Button>

      <AnimatePresence>
        {showResult && resultPrize && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center p-4"
            onClick={() => setShowResult(false)}
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 14 }}
              className="max-w-xs w-full rounded-3xl p-6 text-center shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${resultPrize.color}, #1e293b)` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-6xl mb-3">
                {resultPrize.rarity === "legendary" ? "🎰" : resultPrize.type === "coins" ? "🪙" : resultPrize.type === "freeze" ? "❄️" : "🎁"}
              </div>
              <div className="text-[10px] font-black tracking-widest text-white/80 mb-1">{resultPrize.rarity?.toUpperCase()}</div>
              <div className="text-2xl font-black text-white drop-shadow mb-3">{resultPrize.label}</div>
              <Button onClick={() => setShowResult(false)} className="bg-white text-black font-black w-full">
                MANTAP! 🚀
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur flex items-center justify-center p-4"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-sm w-full max-h-[80vh] overflow-y-auto rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 border border-pink-500/40 shadow-[0_0_40px_rgba(236,72,153,0.4)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-400" strokeWidth={2.5} />
                  <h3 className="text-base font-black text-white">Semua Hadiah Spin</h3>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" strokeWidth={2.5} />
                </button>
              </div>

              <div className="text-[10px] text-white/60 mb-3 px-1">
                Biaya: <span className="font-black text-yellow-300">{cost} 🪙</span> · Total {prizes.length} hadiah
              </div>

              <div className="space-y-2">
                {prizes.map((p, i) => {
                  const totalWeight = prizes.reduce((s, x) => s + (x.weight || 0), 0);
                  const chance = totalWeight > 0 ? ((p.weight / totalWeight) * 100).toFixed(1) : "0";
                  const icon = p.value > 0
                    ? p.type === "coins" ? "🪙"
                    : p.type === "freeze" ? "❄️"
                    : p.rarity === "legendary" ? "🎰" : "🎁"
                    : "💀";
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10"
                      style={{ background: `linear-gradient(90deg, ${p.color}33, transparent)` }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: p.color }}
                      >
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-white truncate">{p.label}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                            {p.rarity}
                          </span>
                          <span className="text-[10px] text-white/60">Peluang ~{chance}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={() => setShowInfo(false)}
                className="w-full mt-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black"
              >
                MENGERTI
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
