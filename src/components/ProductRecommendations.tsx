import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";

interface Rec {
  id: string;
  title: string;
  price: number;
  category?: string | null;
  sold_count?: number;
  reason: string;
}

interface Props {
  activeVisitorId?: string | null;
  /** Daftar produk induk untuk mengambil gambar thumbnail. */
  products: { id: string; image_url: string | null }[];
  onSelect: (id: string) => void;
}

const formatPrice = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export default function ProductRecommendations({ activeVisitorId, products, onSelect }: Props) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke("recommend-products", {
          body: { visitorId: activeVisitorId || null },
        });
        if (alive) setRecs(((data as any)?.recommendations || []) as Rec[]);
      } catch {
        if (alive) setRecs([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activeVisitorId]);

  const imgOf = (id: string) => products.find((p) => p.id === id)?.image_url || null;

  if (loading) {
    return (
      <div className="mb-3 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 p-3">
        <div className="flex items-center gap-2 text-xs font-black text-violet-600 dark:text-violet-300">
          <Sparkles className="w-4 h-4" /> Rekomendasi Untukmu
        </div>
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </div>
    );
  }

  if (recs.length === 0) return null;

  return (
    <div className="mb-3 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 p-3">
      <div className="flex items-center gap-2 text-xs font-black text-violet-600 dark:text-violet-300 mb-2">
        <Sparkles className="w-4 h-4" /> Rekomendasi Untukmu
        <span className="text-[9px] font-bold text-muted-foreground bg-violet-500/10 px-1.5 py-0.5 rounded-full">AI</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {recs.map((r) => {
          const img = imgOf(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className="snap-start shrink-0 w-32 text-left rounded-xl border bg-card/80 backdrop-blur overflow-hidden active:scale-95 transition"
            >
              <div className="w-full aspect-square bg-muted/50 overflow-hidden">
                {img ? (
                  <img src={img} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>
                )}
              </div>
              <div className="p-1.5 space-y-0.5">
                <div className="text-[11px] font-bold leading-tight line-clamp-2">{r.title}</div>
                <div className="text-[11px] font-black text-violet-600 dark:text-violet-400">{formatPrice(r.price)}</div>
                <div className="text-[9px] text-muted-foreground line-clamp-1 flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5 shrink-0 text-fuchsia-500" />
                  {r.reason}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
