import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Clock, Flame } from "lucide-react";

interface Props {
  visitorId: string;
  onClick?: () => void;
}

export default function StreakFlashSaleBanner({ visitorId, onClick }: Props) {
  const [deals, setDeals] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!visitorId) return;
    (async () => {
      const { data: res } = await supabase.functions.invoke("streak-flash-sale", { body: { action: "list", visitorId } });
      setDeals(res?.deals || []);
      setLoaded(true);
    })();
  }, [visitorId]);

  if (!loaded || deals.length === 0) return null;

  const featured = deals.find((d: any) => d.is_featured) || deals[0];
  const minDiscount = Math.max(...deals.map((d: any) => d.discount_pct || 0));

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-3 shadow-xl shadow-orange-500/30 border-2 border-amber-300/50 ios-pressable"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative flex items-center gap-3">
        <motion.div
          animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-3xl drop-shadow-lg"
        >
          {featured.icon}
        </motion.div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <Zap className="h-3.5 w-3.5 text-yellow-200 fill-yellow-200" />
            <span className="text-[10px] font-extrabold text-yellow-100 tracking-wide">FLASH SALE AKTIF</span>
            <span className="text-[9px] px-1 py-0 rounded bg-white/25 text-white font-bold">{deals.length} DEAL</span>
          </div>
          <h4 className="text-sm font-extrabold text-white truncate leading-tight">{featured.name}</h4>
          <div className="flex items-center gap-2 text-[10px] text-white/90 mt-0.5">
            {minDiscount > 0 && (
              <span className="inline-flex items-center gap-0.5 font-bold">
                <Flame className="h-3 w-3 text-yellow-200" />Diskon hingga {minDiscount}%
              </span>
            )}
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-3 w-3" />Terbatas
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 px-2 py-1 rounded-full bg-white/95 text-red-600 text-[10px] font-extrabold shadow-lg">
          BUKA →
        </div>
      </div>
    </motion.button>
  );
}
