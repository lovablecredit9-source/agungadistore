import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gem, Loader2, Sparkles, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { visitorId: string; onUpdate?: () => void; }
interface GemPackage {
  id: string; name: string; gems: number; bonus_gems: number; price: number; icon: string; sort_order: number;
}

// Selalu utamakan visitor_id akun saldo (tempat pembelian gem dicatat)
function resolveActiveVisitor(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem("balance_visitor_id") || fallback;
}

export default function GemShop({ visitorId: visitorIdProp, onUpdate }: Props) {
  const visitorId = resolveActiveVisitor(visitorIdProp);
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState<GemPackage[]>([]);
  const [myGems, setMyGems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const [{ data: pkgs }, { data: prof }] = await Promise.all([
      supabase.from("gem_packages").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle(),
    ]);
    setPackages(pkgs || []);
    setMyGems(prof?.gems || 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [visitorId]);
  useEffect(() => { if (open) load(); }, [open]);

  // Realtime: ikut perubahan gem di game_profiles & gem_transactions
  useEffect(() => {
    if (!visitorId) return;
    const ch = supabase
      .channel(`gem-${visitorId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "game_profiles",
        filter: `visitor_id=eq.${visitorId}`,
      }, () => load())
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "gem_transactions",
        filter: `visitor_id=eq.${visitorId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId]);

  const buy = async (packageId: string) => {
    setBuying(packageId);
    try {
      const { data, error } = await supabase.functions.invoke("gem-purchase", {
        body: { visitorId, packageId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Gagal");
      toast({ title: "💎 Gem Dibeli!", description: `+${data.gems_added} 💎` });
      await load();
      onUpdate?.();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setBuying(null);
    }
  };

  return (
    <>
      <motion.div whileHover={{ scale: 1.02 }} className="relative overflow-hidden rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-br from-cyan-950/60 to-blue-950/60 p-4 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/40">
              <Gem className="w-6 h-6 text-white drop-shadow" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Gem Premium</p>
              <p className="text-2xl font-black text-white">{myGems.toLocaleString("id-ID")} 💎</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black shadow-lg shadow-cyan-500/40"
          >
            <Sparkles className="w-4 h-4 mr-1" /> Beli
          </Button>
        </div>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950 border-2 border-cyan-500/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Gem className="w-5 h-5 text-cyan-400" /> Toko Gem 💎
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-cyan-400" /></div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3 text-center">
                <p className="text-xs text-cyan-300 font-bold">Saldo Gem Kamu</p>
                <p className="text-3xl font-black text-white">{myGems.toLocaleString("id-ID")} 💎</p>
              </div>
              {packages.map((p) => {
                const total = p.gems + (p.bonus_gems || 0);
                const isPopular = p.sort_order === 2;
                const isBest = p.sort_order === 4;
                return (
                  <motion.div
                    key={p.id}
                    whileHover={{ scale: 1.02 }}
                    className={`relative rounded-xl border-2 p-3 ${
                      isBest ? "border-yellow-500/60 bg-gradient-to-br from-yellow-950/40 to-orange-950/40" :
                      isPopular ? "border-purple-500/60 bg-gradient-to-br from-purple-950/40 to-pink-950/40" :
                      "border-cyan-500/40 bg-cyan-950/20"
                    }`}
                  >
                    {isBest && (
                      <div className="absolute -top-2 right-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5" /> TERBAIK
                      </div>
                    )}
                    {isPopular && (
                      <div className="absolute -top-2 right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                        POPULER
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{p.icon}</div>
                        <div>
                          <p className="text-sm font-black text-white">{p.name}</p>
                          <p className="text-xs text-cyan-300 font-bold">
                            {p.gems.toLocaleString("id-ID")} 💎
                            {p.bonus_gems > 0 && <span className="text-yellow-400"> +{p.bonus_gems} bonus</span>}
                          </p>
                          <p className="text-[10px] text-white/60">Total: {total.toLocaleString("id-ID")} 💎</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={buying === p.id}
                        onClick={() => buy(p.id)}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black"
                      >
                        {buying === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : `Rp${(p.price/1000).toFixed(0)}k`}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
              <p className="text-[10px] text-white/50 text-center">💡 Pembelian potong saldo akun login</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
