import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, SlidersHorizontal, LayoutGrid, Rows3, List, Clock, TrendingUp, Filter, RotateCcw, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export type ViewMode = "grid" | "list" | "compact";
export type SortKey = "newest" | "oldest" | "cheapest" | "expensive" | "popular" | "name_asc" | "name_desc";

export interface ProductNavToolbarValue {
  search: string;
  category: string;
  sort: SortKey;
  view: ViewMode;
  minPrice: string;
  maxPrice: string;
  inStockOnly: boolean;
  warrantyOnly: boolean;
}

interface Props {
  value: ProductNavToolbarValue;
  onChange: (next: Partial<ProductNavToolbarValue>) => void;
  categories: string[];
  categoryCounts?: Record<string, number>;
  storageKey?: string;
  popularSuggestions?: string[];
  showWarrantyFilter?: boolean;
  showStockFilter?: boolean;
  totalCount?: number;
  resultCount?: number;
  compact?: boolean;
  sortOptions?: { value: SortKey; label: string }[];
}

const DEFAULT_SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "⏱ Terbaru" },
  { value: "oldest", label: "📅 Terlama" },
  { value: "cheapest", label: "💰 Termurah" },
  { value: "expensive", label: "💎 Termahal" },
  { value: "popular", label: "🔥 Populer" },
  { value: "name_asc", label: "🔤 A → Z" },
  { value: "name_desc", label: "🔠 Z → A" },
];

const MAX_HISTORY = 6;

export default function ProductNavToolbar({
  value, onChange, categories, categoryCounts = {},
  storageKey = "product_search_history",
  popularSuggestions = [],
  showWarrantyFilter = true,
  showStockFilter = true,
  totalCount, resultCount,
  compact = false,
  sortOptions = DEFAULT_SORTS,
}: Props) {
  const [history, setHistory] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  const persistHistory = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setHistory(prev => {
      const next = [t, ...prev.filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_HISTORY);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const removeHistoryItem = (term: string) => {
    setHistory(prev => {
      const next = prev.filter(x => x !== term);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const suggestions = useMemo(() => {
    const q = value.search.toLowerCase().trim();
    if (!q) return [] as string[];
    const fromCats = categories.filter(c => c !== "Semua" && c !== "all" && c.toLowerCase().includes(q));
    return Array.from(new Set([...fromCats, ...popularSuggestions.filter(p => p.toLowerCase().includes(q))])).slice(0, 5);
  }, [value.search, categories, popularSuggestions]);

  const activeFilterCount =
    (value.category !== "Semua" && value.category !== "all" ? 1 : 0) +
    (value.minPrice ? 1 : 0) +
    (value.maxPrice ? 1 : 0) +
    (value.inStockOnly ? 1 : 0) +
    (value.warrantyOnly ? 1 : 0);

  const hasAny = activeFilterCount > 0 || value.search || value.sort !== "newest";

  const reset = () => onChange({
    search: "", category: categories[0] || "Semua", sort: "newest",
    minPrice: "", maxPrice: "", inStockOnly: false, warrantyOnly: false,
  });

  return (
    <div className="space-y-3">
      {/* Search bar with animated gradient glow */}
      <div className="relative group">
        <div className={`absolute -inset-[2px] rounded-2xl bg-[conic-gradient(from_0deg,hsl(var(--primary)),hsl(var(--accent)),hsl(var(--primary)))] opacity-0 blur-[6px] transition-opacity duration-500 ${focused ? "opacity-70 animate-pulse" : "group-hover:opacity-30"}`} />
        <div className="relative">
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${focused ? "bg-gradient-to-br from-primary to-accent text-primary-foreground scale-110 shadow-lg shadow-primary/30" : "bg-muted/60 text-muted-foreground"}`}>
            <Search className="w-3.5 h-3.5" />
          </div>
          <Input
            ref={inputRef}
            placeholder="Cari produk, kategori, atau kata kunci…"
            value={value.search}
            onChange={(e) => onChange({ search: e.target.value })}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                persistHistory(value.search);
                inputRef.current?.blur();
              }
            }}
            className="pl-12 pr-10 h-12 rounded-2xl border-2 border-border/40 focus:border-transparent focus-visible:ring-0 glass-card-strong text-sm font-medium shadow-sm"
          />
          {value.search && (
            <button
              onClick={() => onChange({ search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Bersihkan pencarian"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Dropdown: suggestions + history */}
        {focused && (suggestions.length > 0 || history.length > 0 || popularSuggestions.length > 0) && (
          <div className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl border-2 border-border/50 glass-card-strong shadow-2xl overflow-hidden animate-fade-in max-h-72 overflow-y-auto">
            {suggestions.length > 0 && (
              <div className="p-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2 py-1">Saran</p>
                {suggestions.map(s => (
                  <button
                    key={`sg-${s}`}
                    onMouseDown={(e) => { e.preventDefault(); onChange({ search: s }); persistHistory(s); }}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/70 text-xs"
                  >
                    <Search className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{s}</span>
                  </button>
                ))}
              </div>
            )}
            {history.length > 0 && (
              <div className="p-2 border-t border-border/40">
                <div className="flex items-center justify-between px-2 py-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Riwayat</p>
                  <button onMouseDown={(e) => { e.preventDefault(); clearHistory(); }} className="text-[10px] text-destructive hover:underline font-bold">Hapus semua</button>
                </div>
                {history.map(h => (
                  <div key={`hs-${h}`} className="group/item flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/70">
                    <button
                      onMouseDown={(e) => { e.preventDefault(); onChange({ search: h }); }}
                      className="flex-1 flex items-center gap-2 text-xs text-left"
                    >
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>{h}</span>
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); removeHistoryItem(h); }}
                      className="opacity-0 group-hover/item:opacity-100 w-5 h-5 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!value.search && popularSuggestions.length > 0 && (
              <div className="p-2 border-t border-border/40">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2 py-1">Populer</p>
                <div className="flex flex-wrap gap-1.5 px-2 py-1">
                  {popularSuggestions.slice(0, 8).map(p => (
                    <button
                      key={`pp-${p}`}
                      onMouseDown={(e) => { e.preventDefault(); onChange({ search: p }); persistHistory(p); }}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary border border-primary/20 hover:from-primary/25 hover:to-accent/25"
                    >
                      <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />{p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category chips horizontal scroll */}
      {categories.length > 1 && (
        <div className="-mx-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 px-1 pb-1">
            {categories.map(cat => {
              const active = value.category === cat;
              const count = categoryCounts[cat];
              return (
                <button
                  key={cat}
                  onClick={() => onChange({ category: cat })}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-[11px] font-bold transition-all ${
                    active
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground border-transparent shadow-md scale-[1.03]"
                      : "bg-card text-foreground/80 border-border/50 hover:border-primary/40 hover:bg-muted/60"
                  }`}
                >
                  <span>{cat}</span>
                  {count !== undefined && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/25" : "bg-muted"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sort + Filter + View row */}
      <div className="flex gap-2 items-stretch">
        {/* Sort */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 h-10 rounded-xl glass-card border-2 border-border/50 text-xs justify-between gap-1.5">
              <span className="flex items-center gap-1.5 truncate">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate">{sortOptions.find(s => s.value === value.sort)?.label || "Urutkan"}</span>
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-1">
            {sortOptions.map(s => (
              <button
                key={s.value}
                onClick={() => onChange({ sort: s.value })}
                className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center justify-between hover:bg-muted ${value.sort === s.value ? "bg-muted font-bold" : ""}`}
              >
                <span>{s.label}</span>
                {value.sort === s.value && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Advanced filter */}
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 rounded-xl glass-card border-2 border-border/50 px-3 relative">
              <Filter className="w-3.5 h-3.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[9px] font-extrabold flex items-center justify-center shadow">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Rentang Harga</p>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" placeholder="Min" value={value.minPrice} onChange={e => onChange({ minPrice: e.target.value })} className="h-9 text-xs" />
                <Input type="number" inputMode="numeric" placeholder="Max" value={value.maxPrice} onChange={e => onChange({ maxPrice: e.target.value })} className="h-9 text-xs" />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {[
                  { l: "<10rb", min: "", max: "10000" },
                  { l: "10-50rb", min: "10000", max: "50000" },
                  { l: "50-100rb", min: "50000", max: "100000" },
                  { l: ">100rb", min: "100000", max: "" },
                ].map(p => (
                  <button
                    key={p.l}
                    onClick={() => onChange({ minPrice: p.min, maxPrice: p.max })}
                    className="text-[10px] font-bold px-2 py-1 rounded-md border border-border/60 hover:bg-muted"
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 pt-1 border-t border-border/40">
              {showStockFilter && (
                <label className="flex items-center justify-between px-1 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                  <span className="text-xs font-medium">✅ Hanya tersedia</span>
                  <input type="checkbox" checked={value.inStockOnly} onChange={e => onChange({ inStockOnly: e.target.checked })} className="w-4 h-4 accent-primary" />
                </label>
              )}
              {showWarrantyFilter && (
                <label className="flex items-center justify-between px-1 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                  <span className="text-xs font-medium">🛡 Bergaransi</span>
                  <input type="checkbox" checked={value.warrantyOnly} onChange={e => onChange({ warrantyOnly: e.target.checked })} className="w-4 h-4 accent-primary" />
                </label>
              )}
            </div>
            <div className="flex gap-2 pt-1 border-t border-border/40">
              <Button variant="outline" size="sm" onClick={reset} className="flex-1 h-8 text-xs"><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
              <Button size="sm" onClick={() => setFilterOpen(false)} className="flex-1 h-8 text-xs">Terapkan</Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* View mode */}
        {!compact && (
          <div className="flex rounded-xl glass-card border-2 border-border/50 overflow-hidden">
            {([
              { mode: "list" as ViewMode, Icon: Rows3, label: "List" },
              { mode: "grid" as ViewMode, Icon: LayoutGrid, label: "Grid" },
              { mode: "compact" as ViewMode, Icon: List, label: "Compact" },
            ]).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => onChange({ view: mode })}
                aria-label={label}
                className={`px-2.5 flex items-center justify-center transition-all ${
                  value.view === mode
                    ? "bg-gradient-to-br from-primary to-accent text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active filter pills + result count */}
      {(hasAny || (resultCount !== undefined && totalCount !== undefined)) && (
        <div className="flex items-center gap-2 flex-wrap">
          {resultCount !== undefined && totalCount !== undefined && (
            <span className="text-[11px] font-bold text-muted-foreground">
              {resultCount} dari {totalCount} {resultCount === totalCount ? "ditampilkan" : "cocok"}
            </span>
          )}
          {value.inStockOnly && (
            <FilterPill onRemove={() => onChange({ inStockOnly: false })}>Tersedia</FilterPill>
          )}
          {value.warrantyOnly && (
            <FilterPill onRemove={() => onChange({ warrantyOnly: false })}>🛡 Garansi</FilterPill>
          )}
          {value.minPrice && (
            <FilterPill onRemove={() => onChange({ minPrice: "" })}>≥ {Number(value.minPrice).toLocaleString("id-ID")}</FilterPill>
          )}
          {value.maxPrice && (
            <FilterPill onRemove={() => onChange({ maxPrice: "" })}>≤ {Number(value.maxPrice).toLocaleString("id-ID")}</FilterPill>
          )}
          {hasAny && (
            <button
              onClick={reset}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full border-2 bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 transition-all ml-auto"
            >
              <X className="w-3 h-3 inline mr-0.5" /> Reset semua
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterPill({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
      {children}
      <button onClick={onRemove} className="hover:bg-primary/20 rounded-full w-3.5 h-3.5 flex items-center justify-center">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}
