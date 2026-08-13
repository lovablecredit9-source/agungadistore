import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Gem, Loader2, Package, Sparkles, Crown } from "lucide-react";

const TOTAL_BOXES = 30;
const SPECIAL_MOD = [2, 3, 5, 7, 9]; // (box % 10) + 1
const LIMITED_BOXES = [11, 17, 23, 29];

interface OpenedBox {
  box: number;
  special: boolean;
  limited: boolean;
  label: string;
  emoji: string;
  rarity: string;
}

const RARITY_GRAD: Record<string, string> = {
  common: "from-slate-500 to-slate-700",
  rare: "from-cyan-500 to-blue-600",
  epic: "from-fuchsia-500 to-purple-700",
  legendary: "from-amber-400 to-orange-600",
  mythic: "from-rose-400 via-red-500 to-yellow-400",
};

export default function MysteryBoxArena({
  visitorId,
  gems,
  setGems,
  onSpent,
}: {
  visitorId: string;
  gems: number;
  setGems: (n: number) => void;
  onSpent?: () => void;
}) {
  const { toast } = useToast();
  const [tier, setTier] = useState<"free" | "premium">("free");
  const [selected, setSelected] = useState<number[]>([]);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState<Record<number, OpenedBox>>({});
  const [reveal, setReveal] = useState<OpenedBox[] | null>(null);

  const costPerBox = tier === "premium" ? 120 : 40;
  const totalCost = useMemo(() => {
    const n = selected.length || 1;
    return costPerBox * n - (n === 9 ? costPerBox : 0);
  }, [selected.length, costPerBox]);

  const isSpecial = (i: number) => SPECIAL_MOD.includes((i % 10) + 1);
  const isLimited = (i: number) => tier === "premium" && LIMITED_BOXES.includes(i + 1);

  const toggle = (i: number) => {
    if (opened[i] || opening) return;
    setSelected((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= 9) return prev;
      return [...prev, i];
    });
  };

  const quickPick = (n: number) => {
    const free = Array.from({ length: TOTAL_BOXES }, (_, i) => i).filter((i) => !opened[i]);
    const shuffled = free.sort(() => Math.random() - 0.5).slice(0, n);
    setSelected(shuffled);
  };

  const openBoxes = async () => {
    if (!visitorId || opening) return;
    const boxes = selected.length ? selected : [Math.floor(Math.random() * TOTAL_BOXES)];
    const count = [1, 5, 9].includes(boxes.length) ? boxes.length : boxes.length >= 9 ? 9 : boxes.length >= 5 ? 5 : 1;
    const picked = boxes.slice(0, count);
    if (gems < totalCost) {
      toast({ title: "Gem kurang", description: `Butuh ${totalCost} gem`, variant: "destructive" });
      return;
    }
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "mystery_box_open", tier, count, boxes: picked },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Gagal", description: data.error, variant: "destructive" });
        return;
      }
      const list: OpenedBox[] = data.opened || [];
      setOpened((prev) => {
        const next = { ...prev };
        for (const o of list) next[o.box] = o;
        return next;
      });
      setGems(data.gems ?? gems);
      setSelected([]);
      setReveal(list);
      onSpent?.();
    } catch (e: any) {
      toast({ title: "Gagal buka box", description: e?.message || "Coba lagi", variant: "destructive" });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/10 to-amber-500/10 border-fuchsia-400/30">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-fuchsia-300" />
          <div className="min-w-0">
            <h3 className="text-sm font-black text-fuchsia-200">MYSTERY BOX · 30 KOTAK</h3>
            <p className="text-[10px] text-white/60">
              Kotak ✨ SPECIAL = hadiah minimal EPIC · 🌌 LIMITED EDITION (Premium) = minimal LEGENDARY · Buka 9 bayar 8.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {(["free", "premium"] as const).map((k) => (
          <button
            key={k}
            onClick={() => { setTier(k); setSelected([]); }}
            className={`rounded-2xl border px-3 py-2 text-left transition ${
              tier === k
                ? k === "premium"
                  ? "border-amber-300 bg-gradient-to-br from-amber-500/30 to-orange-600/30"
                  : "border-cyan-300 bg-gradient-to-br from-cyan-500/25 to-blue-600/25"
                : "border-white/10 bg-black/40"
            }`}
          >
            <div className="text-[11px] font-black text-white flex items-center gap-1">
              {k === "premium" ? <Crown className="w-3.5 h-3.5 text-amber-300" /> : <Sparkles className="w-3.5 h-3.5 text-cyan-300" />}
              {k === "premium" ? "PREMIUM BOX" : "FREE BOX"}
            </div>
            <div className="text-[9px] text-white/60 mt-0.5">{k === "premium" ? 120 : 40} gem / kotak</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[1, 5, 9].map((n) => (
          <Button key={n} size="sm" variant="outline" onClick={() => quickPick(n)}
            className="h-7 px-2.5 text-[10px] font-black border-white/15 bg-black/40 text-white/80">
            ACAK x{n}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setSelected([])} className="h-7 px-2 text-[10px] text-white/60">
          Reset pilihan
        </Button>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: TOTAL_BOXES }, (_, i) => {
          const done = opened[i];
          const sel = selected.includes(i);
          const spec = isSpecial(i);
          const lim = isLimited(i);
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.9 }}
              onClick={() => toggle(i)}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-center overflow-hidden ${
                done
                  ? `bg-gradient-to-br ${RARITY_GRAD[done.rarity] || RARITY_GRAD.common} border-white/20`
                  : sel
                  ? "border-amber-300 bg-amber-500/25"
                  : lim
                  ? "border-fuchsia-300/60 bg-fuchsia-500/15"
                  : spec
                  ? "border-cyan-300/50 bg-cyan-500/10"
                  : "border-white/10 bg-black/40"
              }`}
            >
              {done ? (
                <span className="text-base leading-none">{done.emoji}</span>
              ) : (
                <>
                  <span className="text-sm leading-none">{lim ? "🌌" : spec ? "✨" : "📦"}</span>
                  <span className="text-[8px] font-black text-white/60 mt-0.5">{i + 1}</span>
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      <Button
        onClick={openBoxes}
        disabled={opening}
        className="w-full h-12 rounded-2xl font-black text-xs bg-gradient-to-r from-fuchsia-500 via-purple-600 to-amber-500 text-white shadow-lg"
      >
        {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <span className="flex items-center gap-1.5">
            <Gem className="w-4 h-4" /> BUKA {selected.length || 1} BOX · {totalCost.toLocaleString("id-ID")} GEM
          </span>
        )}
      </Button>

      <AnimatePresence>
        {reveal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setReveal(null)}
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0b0616] p-4"
            >
              <div className="text-center text-sm font-black text-fuchsia-200">📦 ISI MYSTERY BOX</div>
              <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
                {reveal.map((o, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2 bg-gradient-to-r ${RARITY_GRAD[o.rarity] || RARITY_GRAD.common}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-white truncate">{o.emoji} {o.label}</span>
                      {o.limited ? (
                        <Badge className="text-[8px] bg-black/40 text-amber-200 border-0">LIMITED</Badge>
                      ) : o.special ? (
                        <Badge className="text-[8px] bg-black/40 text-cyan-100 border-0">SPECIAL</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={() => setReveal(null)} className="mt-3 w-full h-11 rounded-2xl font-black text-[11px] bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white">
                MANTAP!
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
