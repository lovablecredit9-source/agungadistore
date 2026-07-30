import { useMemo, useState, useEffect } from "react";
import { Search, Sparkles, X, ChevronDown, Star, Clock, Shuffle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TICKET_TEMPLATES, type TicketTemplate } from "@/components/TicketEnhancer";

const RECENT_KEY = "ticket_tpl_recent_v1";
const FAV_KEY = "ticket_tpl_fav_v1";

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

interface Props {
  categoryLabels: Record<string, string>;
  onPick: (tpl: TicketTemplate) => void;
}

export function TicketTemplatePicker({ categoryLabels, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [preview, setPreview] = useState<TicketTemplate | null>(null);

  useEffect(() => {
    setRecent(readList(RECENT_KEY));
    setFavs(readList(FAV_KEY));
  }, []);

  const cats = useMemo(() => {
    const map = new Map<string, number>();
    TICKET_TEMPLATES.forEach((t) => map.set(t.category, (map.get(t.category) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = TICKET_TEMPLATES.filter((t) => {
      if (cat === "fav") return favs.includes(t.id);
      if (cat !== "all" && t.category !== cat) return false;
      return true;
    });
    if (q) {
      list = list.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (categoryLabels[t.category] || t.category).toLowerCase().includes(q),
      );
    }
    // favorit & terakhir dipakai naik ke atas
    return list.sort((a, b) => {
      const score = (t: TicketTemplate) =>
        (favs.includes(t.id) ? 2 : 0) + (recent.includes(t.id) ? 1 : 0);
      return score(b) - score(a);
    });
  }, [query, cat, favs, recent, categoryLabels]);

  const shown = expanded || query.trim() || cat !== "all" ? filtered : filtered.slice(0, 8);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [id, ...favs].slice(0, 20);
    setFavs(next);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const pick = (tpl: TicketTemplate) => {
    const next = [tpl.id, ...recent.filter((r) => r !== tpl.id)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setPreview(null);
    onPick(tpl);
  };

  const randomPick = () => {
    const pool = filtered.length ? filtered : TICKET_TEMPLATES;
    setPreview(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 overflow-hidden">
      <CardContent className="p-3 space-y-2.5">
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Template Cepat</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold">{TICKET_TEMPLATES.length}</Badge>
          <button
            type="button"
            onClick={randomPick}
            className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <Shuffle className="w-3 h-3" /> Acak
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari template… (deposit, voucher, bug)"
            className="h-9 pl-8 pr-8 text-xs rounded-xl bg-background/70 border-border/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {[{ key: "all", label: "Semua", n: TICKET_TEMPLATES.length }, { key: "fav", label: "★ Favorit", n: favs.length }].map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={`shrink-0 px-2.5 h-7 rounded-full text-[10px] font-bold border transition-all ${
                cat === c.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background/70 text-muted-foreground border-border/60 hover:border-primary/40"
              }`}
            >
              {c.label} <span className="opacity-70">{c.n}</span>
            </button>
          ))}
          {cats.map(([key, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCat(key)}
              className={`shrink-0 px-2.5 h-7 rounded-full text-[10px] font-bold border transition-all whitespace-nowrap ${
                cat === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background/70 text-muted-foreground border-border/60 hover:border-primary/40"
              }`}
            >
              {categoryLabels[key] || key} <span className="opacity-70">{n}</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        {shown.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4">
            Tidak ada template cocok. Coba kata kunci lain.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {shown.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setPreview(tpl)}
                className="relative group flex flex-col items-center gap-1 p-2 rounded-xl border border-border/60 bg-background/80 hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95"
              >
                {favs.includes(tpl.id) && (
                  <Star className="absolute top-1 right-1 w-2.5 h-2.5 fill-primary text-primary" />
                )}
                {recent.includes(tpl.id) && !favs.includes(tpl.id) && (
                  <Clock className="absolute top-1 right-1 w-2.5 h-2.5 text-muted-foreground" />
                )}
                <span className="text-xl leading-none">{tpl.emoji}</span>
                <span className="text-[9px] font-bold text-center leading-tight line-clamp-2">{tpl.label}</span>
              </button>
            ))}
          </div>
        )}

        {!expanded && !query.trim() && cat === "all" && filtered.length > shown.length && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full flex items-center justify-center gap-1 h-8 rounded-xl border border-dashed border-primary/40 text-[10px] font-bold text-primary hover:bg-primary/5 transition-colors"
          >
            Lihat semua {filtered.length} template <ChevronDown className="w-3 h-3" />
          </button>
        )}
        {expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="w-full h-8 rounded-xl border border-dashed border-border text-[10px] font-bold text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            Tutup daftar
          </button>
        )}

        {/* Preview */}
        {preview && (
          <div className="rounded-xl border border-primary/30 bg-background/90 p-2.5 space-y-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none">{preview.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold leading-tight">{preview.label}</p>
                <p className="text-[9px] text-muted-foreground">
                  {categoryLabels[preview.category] || preview.category}
                </p>
              </div>
              <button type="button" onClick={() => toggleFav(preview.id)} className="p-1">
                <Star className={`w-4 h-4 ${favs.includes(preview.id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
              <button type="button" onClick={() => setPreview(null)} className="p-1 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground whitespace-pre-line line-clamp-4 bg-muted/40 rounded-lg p-2">
              {preview.description}
            </p>
            <button
              type="button"
              onClick={() => pick(preview)}
              className="w-full h-8 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              Pakai template ini
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
