import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Coins, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameCredits } from "./GameCredits";

const SYMBOLS = ["🍒", "🍋", "🍇", "🔔", "⭐", "💎", "7️⃣"];

export default function SlotMachineGame() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, useCredit, fetchCredits } = useGameCredits(visitorId);
  const [reels, setReels] = useState<string[]>(["🍒", "🍋", "🍇"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const spin = async () => {
    if (!visitorId) return toast({ title: "Login dulu", variant: "destructive" });
    if (!isUnlimited && credits < 1) return toast({ title: "Kredit habis", description: "Beli kredit di tab Game", variant: "destructive" });

    setResult(null);
    setSpinning(true);
    const ok = await useCredit();
    if (!ok) { setSpinning(false); return; }

    // animate reels
    const animDuration = 1500;
    const start = Date.now();
    const interval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
      if (Date.now() - start >= animDuration) clearInterval(interval);
    }, 80);

    const { data, error } = await supabase.functions.invoke("slot-machine", { body: { visitorId } });
    
    setTimeout(() => {
      clearInterval(interval);
      if (error || data?.error) {
        toast({ title: "Gagal", description: data?.error || "Coba lagi", variant: "destructive" });
        setSpinning(false);
        return;
      }
      setReels(data.reels);
      setResult(data.payout);
      setSpinning(false);
      fetchCredits();
      if (data.payout.type !== "none") {
        toast({ title: "🎉 Menang!", description: data.payout.label });
      }
    }, animDuration);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 text-white border-none text-center">
        <h3 className="font-extrabold text-lg">🎰 Slot Machine 3-Reel</h3>
        <p className="text-xs opacity-80 mt-1">3 sama = JACKPOT! 1 kredit per spin</p>
      </Card>

      <div className="bg-gradient-to-b from-amber-700 via-amber-600 to-amber-800 rounded-3xl p-5 shadow-2xl border-4 border-amber-900">
        <div className="bg-black rounded-xl p-4 grid grid-cols-3 gap-2">
          {reels.map((sym, i) => (
            <motion.div
              key={i}
              animate={spinning ? { y: [0, -10, 0] } : {}}
              transition={{ duration: 0.15, repeat: spinning ? Infinity : 0 }}
              className="aspect-square bg-gradient-to-br from-white to-slate-200 rounded-lg flex items-center justify-center text-5xl shadow-inner"
            >
              {sym}
            </motion.div>
          ))}
        </div>

        <Button
          onClick={spin}
          disabled={spinning || (!isUnlimited && credits < 1)}
          className="w-full mt-4 h-14 text-lg font-black bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-amber-950 border-2 border-yellow-300 shadow-lg"
        >
          {spinning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Coins className="w-5 h-5 mr-2" />}
          {spinning ? "SPINNING..." : "PUTAR! (1 kredit)"}
        </Button>
      </div>

      {result && !spinning && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl text-center ${result.type === "none" ? "bg-muted" : "bg-gradient-to-r from-green-500 to-emerald-600 text-white"}`}
        >
          <div className="text-2xl mb-1">{result.type === "none" ? "😢" : "🎉"}</div>
          <div className="font-extrabold">{result.label}</div>
          {result.voucher_code && (
            <button
              onClick={() => { navigator.clipboard.writeText(result.voucher_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="mt-2 inline-flex items-center gap-1 text-xs bg-white/20 backdrop-blur rounded-full px-3 py-1 font-mono font-bold"
            >
              {result.voucher_code} {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </motion.div>
      )}

      <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded-lg">
        <div className="font-bold mb-1">💰 Hadiah:</div>
        <div>7️⃣7️⃣7️⃣ → JACKPOT Voucher Rp 25.000</div>
        <div>💎💎💎 → Saldo Rp 10.000</div>
        <div>⭐⭐⭐ → 50 Gems</div>
        <div>🔔🔔🔔 → Saldo Rp 3.000</div>
        <div>🍒🍒 → 1 kredit gratis</div>
      </div>
    </div>
  );
}
