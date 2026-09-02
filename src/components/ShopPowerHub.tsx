import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History, Sparkles, GitCompare, Trophy, ChevronDown, ChevronUp,
  X, Plus, Check, ShoppingBag, Flame, Zap, Award, Shield, Package,
  TrendingUp, Star, Crown,
} from "lucide-react";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
  has_warranty: boolean;
  sold_count?: number;
  created_at: string;
}

interface ClaimHistoryLite {
  product_title: string;
  product_price: number;
  claimed_at: string;
}

interface Props {
  products: Product[];
  claimHistory?: ClaimHistoryLite[];
  totalSpent?: number;
  formatPrice: (n: number) => string;
  onOpen: (p: Product) => void;
}

type SectionKey = "recent" | "ai" | "compare" | "stats";

const SECTIONS: { key: SectionKey; label: string; icon: any; gradient: string; emoji: string }[] = [
  { key: "recent", label: "Recently Viewed", icon: History, gradient: "from-cyan-500 to-blue-500", emoji: "🕒" },
  { key: "ai", label: "AI Smart Picks", icon: Sparkles, gradient: "from-purple-500 to-pink-500", emoji: "✨" },
  { key: "compare", label: "Compare", icon: GitCompare, gradient: "from-amber-500 to-orange-500", emoji: "⚖️" },
  { key: "stats", label: "Shopping Stats", icon: Trophy, gradient: "from-emerald-500 to-green-500", emoji: "🏆" },
];

function getLevel(spent: number): { name: string; icon: string; next: number; color: string } {
  if (spent >= 1_000_000) return { name: "Diamond", icon: "💎", next: 0, color: "from-cyan-400 to-blue-500" };
  if (spent >= 500_000) return { name: "Platinum", icon: "🌟", next: 1_000_000, color: "from-slate-300 to-slate-500" };
  if (spent >= 200_000) return { name: "Gold", icon: "👑", next: 500_000, color: "from-yellow-400 to-amber-500" };
  if (spent >= 50_000) return { name: "Silver", icon: "🥈", next: 200_000, color: "from-zinc-300 to-zinc-500" };
  return { name: "Bronze", icon: "🥉", next: 50_000, color: "from-orange-400 to-amber-600" };
}

export default function ShopPowerHub({
  products, claimHistory = [], totalSpent = 0, formatPrice, onOpen,
}: Props) {
  const [active, setActive] = useState<SectionKey | null>("recent");
  const [recentEntries, setRecentEntries] = useState<{ id: string; viewedAt: number }[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // Load recent + compare from storage and listen for updates
  useEffect(() => {
    const load = () => {
      try {
        const rawRecent: any[] = JSON.parse(localStorage.getItem("recent_products_v1") || "[]");
        setRecentEntries(rawRecent.map((e) => (typeof e === "string" ? { id: e, viewedAt: 0 } : e)));
        setCompareIds(JSON.parse(localStorage.getItem("compare_products_v1") || "[]"));
      } catch {}
    };
    load();
    const onUpd = () => load();
    window.addEventListener("recent-products-update", onUpd);
    window.addEventListener("storage", onUpd);
    return () => {
      window.removeEventListener("recent-products-update", onUpd);
      window.removeEventListener("storage", onUpd);
    };
  }, []);

  const recent = useMemo(
    () => recentEntries.map(e => products.find(p => p.id === e.id)).filter(Boolean) as Product[],
    [recentEntries, products]
  );

  const recentViewedAt = useMemo(() => {
    const m = new Map<string, number>();
    recentEntries.forEach((e) => m.set(e.id, e.viewedAt || 0));
    return m;
  }, [recentEntries]);

  const formatViewedAt = (ts: number) => {
    if (!ts) return "";
    return "Terakhir dilihat: " + new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";
  };

  const compare = useMemo(
    () => compareIds.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[],
    [compareIds, products]
  );

  // AI heuristic: top categories + price band from recent + claimHistory
  const aiPicks = useMemo(() => {
    const catScore = new Map<string, number>();
    const seen = new Set<string>();
    recent.forEach((p, i) => {
      if (p.category) catScore.set(p.category, (catScore.get(p.category) || 0) + (recent.length - i));
      seen.add(p.id);
    });
    claimHistory.forEach(c => {
      const t = c.product_title.toLowerCase();
      products.forEach(p => {
        if (p.title.toLowerCase() === t && p.category) {
          catScore.set(p.category, (catScore.get(p.category) || 0) + 2);
        }
      });
    });
    // Price band
    const prices = recent.map(p => p.price).filter(p => p > 0);
    const avg = prices.length ? prices.reduce((s, n) => s + n, 0) / prices.length : 0;
    const band = avg > 0 ? [avg * 0.5, avg * 1.8] : [0, Infinity];

    const scored = products
      .filter(p => p.stock > 0 && !seen.has(p.id))
      .map(p => {
        let score = 0;
        if (p.category && catScore.get(p.category)) score += catScore.get(p.category)! * 5;
        if (p.price >= band[0] && p.price <= band[1]) score += 4;
        if ((p.sold_count || 0) > 0) score += Math.min(8, p.sold_count!);
        if (p.has_warranty) score += 2;
        const isNew = (Date.now() - new Date(p.created_at).getTime()) < 7 * 86400_000;
        if (isNew) score += 3;
        score += Math.random() * 1.5;
        return { p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(x => x.p);
    return scored;
  }, [products, recent, claimHistory]);

  const stats = useMemo(() => {
    const totalOrders = claimHistory.length;
    const catCount = new Map<string, number>();
    let saved = 0;
    claimHistory.forEach(c => {
      const prod = products.find(p => p.title.toLowerCase() === c.product_title.toLowerCase());
      if (prod?.category) catCount.set(prod.category, (catCount.get(prod.category) || 0) + 1);
      // estimate "savings" as 5% of price
      saved += Math.round(c.product_price * 0.05);
    });
    const topCat = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const level = getLevel(totalSpent);
    const progress = level.next > 0 ? Math.min(100, Math.round((totalSpent / level.next) * 100)) : 100;

    const achievements = [
      { id: "first", label: "First Buy", icon: ShoppingBag, achieved: totalOrders >= 1, color: "text-cyan-400" },
      { id: "five", label: "5 Orders", icon: Package, achieved: totalOrders >= 5, color: "text-purple-400" },
      { id: "ten", label: "10 Orders", icon: Flame, achieved: totalOrders >= 10, color: "text-orange-400" },
      { id: "spend", label: "100k Spent", icon: TrendingUp, achieved: totalSpent >= 100_000, color: "text-emerald-400" },
      { id: "big", label: "500k Club", icon: Crown, achieved: totalSpent >= 500_000, color: "text-amber-400" },
      { id: "loyal", label: "Loyal Diamond", icon: Star, achieved: totalSpent >= 1_000_000, color: "text-pink-400" },
    ];

    return { totalOrders, topCat, saved, level, progress, achievements };
  }, [claimHistory, totalSpent, products]);

  const toggleCompare = (id: string) => {
    let next: string[];
    if (compareIds.includes(id)) next = compareIds.filter(x => x !== id);
    else if (compareIds.length >= 3) next = [...compareIds.slice(1), id];
    else next = [...compareIds, id];
    setCompareIds(next);
    localStorage.setItem("compare_products_v1", JSON.stringify(next));
  };

  const clearCompare = () => {
    setCompareIds([]);
    localStorage.setItem("compare_products_v1", "[]");
  };

  const clearRecent = () => {
    setRecentEntries([]);
    localStorage.setItem("recent_products_v1", "[]");
  };

  const pickerResults = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return products
      .filter(p => p.stock > 0)
      .filter(p => !q || p.title.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [pickerSearch, products]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-3xl overflow-hidden p-[1.5px] aurora-shift mb-3"
      style={{
        background: "linear-gradient(135deg, hsl(190 95% 55%/0.6), hsl(280 90% 65%/0.6), hsl(45 95% 55%/0.6), hsl(150 80% 50%/0.6), hsl(190 95% 55%/0.6))",
        backgroundSize: "300% 300%",
      }}
    >
      <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-3 overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-cyan-500/15 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 blur-md opacity-60" />
              <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
              </div>
            </div>
            <div>
              <p className="text-xs font-extrabold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent uppercase tracking-wider">
                Shop Power Hub
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Fitur belanja keren — semua di satu tempat</p>
            </div>
          </div>
        </div>

        {/* Tab pills */}
        <div className="relative grid grid-cols-4 gap-1.5 mb-3">
          {SECTIONS.map(s => {
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActive(isActive ? null : s.key)}
                className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all overflow-hidden ${
                  isActive
                    ? "border-white/30 bg-white/[0.08] shadow-lg"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-15`} />
                )}
                <div className={`relative w-8 h-8 rounded-lg bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-md`}>
                  <s.icon className="w-4 h-4 text-white" strokeWidth={2.4} />
                </div>
                <span className="relative text-[9px] font-extrabold text-foreground leading-tight text-center">{s.label}</span>
                {s.key === "compare" && compareIds.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-500 text-[8px] font-extrabold text-white flex items-center justify-center">
                    {compareIds.length}
                  </span>
                )}
                {s.key === "recent" && recent.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-cyan-500 text-[8px] font-extrabold text-white flex items-center justify-center">
                    {recent.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content panels */}
        <AnimatePresence mode="wait">
          {active && (
            <motion.div
              key={active}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden"
            >
              {/* RECENT */}
              {active === "recent" && (
                <div>
                  {recent.length === 0 ? (
                    <p className="text-[10px] text-center text-muted-foreground py-4 italic">
                      🕒 Belum ada produk yang dilihat
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-muted-foreground">{recent.length} produk terakhir</p>
                        <button onClick={clearRecent} className="text-[9px] font-bold text-rose-400 hover:text-rose-300">Bersihkan</button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                        {recent.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onOpen(p)}
                            className="shrink-0 w-24 snap-start rounded-xl overflow-hidden bg-white/[0.04] border border-white/10 hover:border-cyan-400/40 transition-all group"
                          >
                            <div className="relative w-full aspect-square bg-muted">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>
                              )}
                            </div>
                            <div className="p-1.5">
                              <p className="text-[10px] font-bold text-foreground truncate">{p.title}</p>
                              <p className="text-[9px] font-extrabold text-cyan-400 truncate">{formatPrice(p.price)}</p>
                              <p className="text-[8px] text-muted-foreground truncate">🏪 Agung Adi Store</p>
                              {recentViewedAt.get(p.id) ? (
                                <p className="text-[8px] text-muted-foreground/80 leading-tight">{formatViewedAt(recentViewedAt.get(p.id) || 0)}</p>
                              ) : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* AI */}
              {active === "ai" && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <p className="text-[10px] font-extrabold text-foreground">Rekomendasi pintar buat kamu</p>
                  </div>
                  {aiPicks.length === 0 ? (
                    <p className="text-[10px] text-center text-muted-foreground py-4 italic">
                      ✨ Lihat beberapa produk dulu — AI akan kasih rekomendasi
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {aiPicks.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onOpen(p)}
                          className="relative rounded-xl overflow-hidden bg-white/[0.04] border border-white/10 hover:border-purple-400/40 transition-all group"
                        >
                          {i === 0 && (
                            <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-[8px] font-extrabold text-white shadow-lg">
                              ⭐ TOP
                            </span>
                          )}
                          <div className="relative w-full aspect-square bg-muted">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>
                            )}
                          </div>
                          <div className="p-1.5">
                            <p className="text-[10px] font-bold text-foreground truncate">{p.title}</p>
                            <p className="text-[9px] font-extrabold text-purple-400 truncate">{formatPrice(p.price)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* COMPARE */}
              {active === "compare" && (
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[10px] font-bold text-muted-foreground">{compare.length}/3 produk</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setPickerOpen(true)}
                        disabled={compare.length >= 3}
                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-2.5 h-2.5" /> Tambah
                      </button>
                      {compare.length > 0 && (
                        <button onClick={clearCompare} className="text-[9px] font-bold text-rose-400">Reset</button>
                      )}
                    </div>
                  </div>
                  {compare.length === 0 ? (
                    <p className="text-[10px] text-center text-muted-foreground py-4 italic">
                      ⚖️ Pilih sampai 3 produk untuk dibandingkan
                    </p>
                  ) : (
                    <div className="overflow-x-auto -mx-1 px-1">
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${compare.length}, minmax(110px,1fr))` }}>
                        {compare.map(p => {
                          const isCheapest = compare.every(o => p.price <= o.price);
                          const isMostStock = compare.every(o => p.stock >= o.stock);
                          return (
                            <div key={p.id} className="relative rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden">
                              <button
                                onClick={() => toggleCompare(p.id)}
                                className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-rose-500/80 hover:bg-rose-500 text-white flex items-center justify-center shadow-md"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <button onClick={() => onOpen(p)} className="block w-full">
                                <div className="relative w-full aspect-square bg-muted">
                                  {p.image_url ? (
                                    <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>
                                  )}
                                </div>
                                <div className="p-1.5 space-y-1 text-left">
                                  <p className="text-[10px] font-extrabold text-foreground line-clamp-2 min-h-[24px]">{p.title}</p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-extrabold text-amber-400">{formatPrice(p.price)}</span>
                                    {isCheapest && compare.length > 1 && <span className="px-1 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-extrabold">MURAH</span>}
                                  </div>
                                  <div className="flex items-center gap-1 text-[9px]">
                                    <Package className="w-2.5 h-2.5 text-muted-foreground" />
                                    <span className={p.stock > 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                      {p.stock > 0 ? `Stok ${p.stock}` : "Habis"}
                                    </span>
                                    {isMostStock && compare.length > 1 && p.stock > 0 && <span className="text-cyan-400">▲</span>}
                                  </div>
                                  <div className="flex items-center gap-1 text-[9px]">
                                    <Shield className={`w-2.5 h-2.5 ${p.has_warranty ? "text-purple-400" : "text-muted-foreground/50"}`} />
                                    <span className={p.has_warranty ? "text-purple-400 font-bold" : "text-muted-foreground"}>
                                      {p.has_warranty ? "Garansi" : "—"}
                                    </span>
                                  </div>
                                  <p className="text-[8px] text-muted-foreground truncate">{p.category || "Tanpa kategori"}</p>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STATS */}
              {active === "stats" && (
                <div className="space-y-2.5">
                  {/* Level card */}
                  <div className={`relative rounded-xl p-3 bg-gradient-to-br ${stats.level.color} bg-opacity-10 border border-white/15 overflow-hidden`}>
                    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative flex items-center gap-2.5">
                      <div className="text-3xl drop-shadow-lg">{stats.level.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-white/80 uppercase tracking-wider">Level Belanja</p>
                        <p className="text-base font-extrabold text-white drop-shadow">{stats.level.name}</p>
                        <p className="text-[9px] text-white/80 mt-0.5">Total: {formatPrice(totalSpent)}</p>
                      </div>
                    </div>
                    {stats.level.next > 0 && (
                      <div className="relative mt-2">
                        <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                          <div
                            className="h-full bg-white/80 rounded-full transition-all duration-700"
                            style={{ width: `${stats.progress}%` }}
                          />
                        </div>
                        <p className="text-[8px] text-white/70 mt-1">{stats.progress}% menuju level berikutnya</p>
                      </div>
                    )}
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                      <p className="text-[8px] font-bold text-cyan-400 uppercase">Order</p>
                      <p className="text-sm font-extrabold text-foreground">{stats.totalOrders}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-[8px] font-bold text-emerald-400 uppercase">Hemat</p>
                      <p className="text-[11px] font-extrabold text-foreground truncate">{formatPrice(stats.saved)}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20">
                      <p className="text-[8px] font-bold text-pink-400 uppercase">Top Kat.</p>
                      <p className="text-[10px] font-extrabold text-foreground truncate">{stats.topCat}</p>
                    </div>
                  </div>

                  {/* Achievements */}
                  <div>
                    <p className="text-[10px] font-extrabold text-foreground mb-1.5 flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-400" /> Pencapaian
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {stats.achievements.map(a => (
                        <div
                          key={a.id}
                          className={`relative flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-all ${
                            a.achieved
                              ? "bg-white/[0.06] border-white/20"
                              : "bg-white/[0.02] border-white/5 opacity-40 grayscale"
                          }`}
                        >
                          <a.icon className={`w-4 h-4 ${a.color}`} strokeWidth={2.4} />
                          <span className="text-[8px] font-bold text-foreground text-center leading-tight">{a.label}</span>
                          {a.achieved && (
                            <Check className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-emerald-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Picker modal for compare */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setPickerOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="w-full max-w-md bg-card rounded-t-3xl border-t border-white/10 max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <p className="text-sm font-extrabold text-foreground">Pilih Produk untuk Compare</p>
                <button onClick={() => setPickerOpen(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3">
                <input
                  type="search"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Cari produk…"
                  className="w-full h-9 px-3 rounded-lg bg-white/[0.06] border border-white/10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/40"
                />
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                <div className="grid grid-cols-3 gap-2">
                  {pickerResults.map(p => {
                    const selected = compareIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleCompare(p.id)}
                        className={`relative rounded-xl overflow-hidden border transition-all ${
                          selected ? "border-amber-500 bg-amber-500/10" : "border-white/10 bg-white/[0.04] hover:border-white/30"
                        }`}
                      >
                        {selected && (
                          <div className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        <div className="w-full aspect-square bg-muted">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>
                          )}
                        </div>
                        <div className="p-1.5 text-left">
                          <p className="text-[10px] font-bold text-foreground truncate">{p.title}</p>
                          <p className="text-[9px] font-extrabold text-amber-400">{formatPrice(p.price)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {pickerResults.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-8">Tidak ada produk ditemukan</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
