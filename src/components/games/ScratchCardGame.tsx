import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Gift, Loader2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RARITY_STYLES: Record<string, string> = {
  common: "from-slate-400 to-slate-600",
  rare: "from-blue-500 to-indigo-600",
  epic: "from-purple-500 to-pink-600",
  legendary: "from-yellow-400 via-orange-500 to-red-500",
};

export default function ScratchCardGame() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState<any>(null);
  const [scratching, setScratching] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [scratchPercent, setScratchPercent] = useState(0);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!visitorId) { setLoading(false); return; }
    supabase.functions.invoke("scratch-card", { body: { action: "status", visitorId } })
      .then(({ data }) => {
        if (data?.claimed) {
          setClaimed(data.today);
          setRevealed(true);
        }
      })
      .finally(() => setLoading(false));
  }, [visitorId]);

  const handleScratch = (e: React.PointerEvent) => {
    if (revealed || !visitorId) return;
    setScratchPercent(p => Math.min(100, p + 8));
  };

  useEffect(() => {
    if (scratchPercent >= 60 && !revealed && !scratching) {
      setScratching(true);
      supabase.functions.invoke("scratch-card", { body: { action: "claim", visitorId } })
        .then(({ data, error }) => {
          if (error || data?.error) {
            toast({ title: "Gagal", description: data?.error || "Coba lagi", variant: "destructive" });
            setScratchPercent(0);
            setScratching(false);
            return;
          }
          setClaimed(data.reward);
          setRevealed(true);
          setScratching(false);
        });
    }
  }, [scratchPercent, revealed, scratching, visitorId, toast]);

  if (!visitorId) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Login akun saldo dulu untuk klaim scratch card harian.</div>;
  }

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const rarityClass = claimed?.rarity ? RARITY_STYLES[claimed.rarity] || RARITY_STYLES.common : RARITY_STYLES.common;

  return (
    <div className="space-y-4">
      <Card className="p-4 text-center bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white border-none">
        <Sparkles className="w-8 h-8 mx-auto mb-1" />
        <h3 className="font-extrabold text-lg">Scratch Card Harian</h3>
        <p className="text-xs opacity-80 mt-1">Gosok untuk dapat hadiah misterius. 1x setiap hari!</p>
      </Card>

      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl select-none">
        {/* Reward layer */}
        <div className={`absolute inset-0 bg-gradient-to-br ${rarityClass} flex flex-col items-center justify-center p-6 text-white`}>
          <AnimatePresence>
            {revealed && claimed && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 0.6 }}
                className="text-center"
              >
                <Gift className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{claimed.rarity}</div>
                <div className="text-2xl font-black mt-1 drop-shadow">{claimed.reward_label}</div>
                {claimed.voucher_code && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(claimed.voucher_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="mt-3 inline-flex items-center gap-1 text-xs bg-white/20 backdrop-blur rounded-full px-3 py-1 font-mono font-bold"
                  >
                    {claimed.voucher_code}
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scratch overlay */}
        {!revealed && (
          <div
            onPointerMove={handleScratch}
            onPointerDown={handleScratch}
            className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 cursor-pointer flex items-center justify-center"
            style={{ opacity: 1 - scratchPercent / 100 }}
          >
            <div className="text-center text-white">
              <Sparkles className="w-12 h-12 mx-auto mb-2 animate-pulse" />
              <p className="font-extrabold text-lg drop-shadow">GOSOK DI SINI!</p>
              <p className="text-xs opacity-90 mt-1">{Math.round(scratchPercent)}%</p>
              {scratching && <Loader2 className="w-5 h-5 animate-spin mx-auto mt-2" />}
            </div>
          </div>
        )}
      </div>

      {revealed && (
        <p className="text-center text-xs text-muted-foreground">
          🎉 Sudah klaim hari ini. Datang lagi besok!
        </p>
      )}
    </div>
  );
}
