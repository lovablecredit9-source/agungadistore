import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Zap, X } from "lucide-react";
import { Link } from "react-router-dom";

export default function FlashSaleBanner() {
  const [sales, setSales] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetch = () =>
      supabase
        .from("flash_sales")
        .select("*, products(title, image_url)")
        .eq("is_active", true)
        .gte("ends_at", new Date().toISOString())
        .lte("starts_at", new Date().toISOString())
        .order("ends_at")
        .then(({ data }) => setSales(data || []));
    fetch();
    const ch = supabase
      .channel("flash-sales")
      .on("postgres_changes", { event: "*", schema: "public", table: "flash_sales" }, fetch)
      .subscribe();
    const t = setInterval(fetch, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, []);

  const visible = sales.filter(s => !dismissed.has(s.id));
  if (visible.length === 0) return null;
  const sale = visible[0];

  const endsIn = Math.max(0, Math.floor((new Date(sale.ends_at).getTime() - Date.now()) / 60000));
  const hours = Math.floor(endsIn / 60);
  const mins = endsIn % 60;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        className="relative bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 text-white rounded-2xl p-3 shadow-lg overflow-hidden"
      >
        <button
          onClick={() => setDismissed(p => new Set([...p, sale.id]))}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/20 flex items-center justify-center"
          aria-label="Tutup"
        >
          <X className="w-3 h-3" />
        </button>
        <Link to="/produk" className="flex items-center gap-3">
          <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}>
            <Zap className="w-7 h-7 fill-yellow-200" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest">⚡ FLASH SALE</div>
            <div className="font-extrabold text-sm truncate">{sale.title}</div>
            <div className="text-[10px] opacity-90">
              Diskon {sale.discount_percent > 0 ? `${sale.discount_percent}%` : `Rp ${sale.discount_amount.toLocaleString("id-ID")}`}
              {hours > 0 || mins > 0 ? ` · Berakhir ${hours}j ${mins}m` : " · Berakhir!"}
            </div>
          </div>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
