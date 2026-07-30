import { useMemo } from "react";
import { Search, X, ArrowDownWide, ArrowUpWide, Filter, Sparkles } from "lucide-react";

export interface TicketFilterState {
  q: string;
  cat: string;
  status: "all" | "open" | "closed";
  sort: "new" | "old";
}

interface TicketLike {
  id: string;
  status: string;
  category?: string | null;
  created_at: string;
}

interface Props {
  tickets: TicketLike[];
  categories: { value: string; label: string }[];
  value: TicketFilterState;
  onChange: (v: TicketFilterState) => void;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  akun: "👤", voucher: "🎟️", saldo: "💰", sponsor: "📢", penipu: "🚨",
  lagu: "🎵", transaksi: "🧾", produk: "📦", refund: "↩️", garansi: "🛡️",
  rekber: "🤝", chat: "💬", pin: "🔐", deposit: "🏦", playlist: "🎧",
  bug: "🐞", saran: "💡", lainnya: "✨",
};

const CATEGORY_ACCENT: Record<string, string> = {
  akun: "from-sky-500 to-blue-600", voucher: "from-rose-500 to-pink-600",
  saldo: "from-emerald-500 to-green-600", sponsor: "from-amber-500 to-orange-600",
  penipu: "from-red-500 to-rose-600", lagu: "from-violet-500 to-purple-600",
  transaksi: "from-cyan-500 to-teal-600", produk: "from-fuchsia-500 to-pink-600",
  refund: "from-lime-500 to-emerald-600", garansi: "from-indigo-500 to-blue-600",
  rekber: "from-teal-500 to-cyan-600", chat: "from-blue-500 to-indigo-600",
  pin: "from-orange-500 to-red-600", deposit: "from-green-500 to-emerald-600",
  playlist: "from-purple-500 to-fuchsia-600", bug: "from-yellow-500 to-amber-600",
  saran: "from-pink-500 to-rose-600", lainnya: "from-slate-500 to-zinc-600",
};

export function filterTickets<T extends TicketLike>(tickets: T[], f: TicketFilterState): T[] {
  const q = f.q.trim().toLowerCase();
  const out = tickets.filter((t) => {
    if (f.cat !== "all" && (t.category || "lainnya") !== f.cat) return false;
    if (f.status === "open" && t.status !== "open") return false;
    if (f.status === "closed" && t.status === "open") return false;
    if (q) {
      const hay = `${(t as any).ticket_number ?? ""} ${(t as any).description ?? ""} ${(t as any).name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  out.sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return f.sort === "new" ? db - da : da - db;
  });
  return out;
}

export default function TicketCategoryNav({ tickets, categories, value, onChange }: Props) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tickets) {
      const c = t.category || "lainnya";
      map[c] = (map[c] || 0) + 1;
    }
    return map;
  }, [tickets]);

  const used = categories.filter((c) => counts[c.value]);
  const shown = used.length ? used : categories.slice(0, 6);
  const set = (patch: Partial<TicketFilterState>) => onChange({ ...value, ...patch });
  const activeCount = (value.cat !== "all" ? 1 : 0) + (value.status !== "all" ? 1 : 0) + (value.q ? 1 : 0);

  return (
    <div className="relative overflow-hidden rounded-[22px] bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 p-3 space-y-2.5 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.14)]">
      <div className="pointer-events-none absolute -top-16 -right-10 w-40 h-40 rounded-full bg-orange-500/10 blur-3xl" />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          value={value.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Cari nomor tiket, isi keluhan..."
          className="w-full h-10 pl-9 pr-9 rounded-xl bg-white/[0.05] border border-white/12 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
        />
        {value.q && (
          <button
            type="button"
            onClick={() => set({ q: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status segmented + sort */}
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/10">
          {([
            { k: "all", label: "Semua" },
            { k: "open", label: "Terbuka" },
            { k: "closed", label: "Selesai" },
          ] as const).map((s) => (
            <button
              key={s.k}
              type="button"
              onClick={() => set({ status: s.k })}
              className={`h-7 rounded-lg text-[11.5px] font-semibold transition-all active:scale-95 ${
                value.status === s.k
                  ? "bg-foreground text-background shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set({ sort: value.sort === "new" ? "old" : "new" })}
          className="h-9 px-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition"
          title="Urutkan"
        >
          {value.sort === "new" ? <ArrowDownWide className="w-3.5 h-3.5" /> : <ArrowUpWide className="w-3.5 h-3.5" />}
          {value.sort === "new" ? "Baru" : "Lama"}
        </button>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x" style={{ scrollbarWidth: "none" }}>
        <button
          type="button"
          onClick={() => set({ cat: "all" })}
          className={`shrink-0 snap-start h-8 px-3 rounded-full text-[11.5px] font-bold flex items-center gap-1.5 transition-all active:scale-95 border ${
            value.cat === "all"
              ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white border-white/20 shadow-[0_6px_16px_-6px_rgba(251,146,60,0.8)]"
              : "bg-white/[0.05] text-foreground/80 border-white/10"
          }`}
        >
          <Sparkles className="w-3 h-3" /> Semua
          <span className="text-[10px] opacity-80">{tickets.length}</span>
        </button>
        {shown.map((c) => {
          const active = value.cat === c.value;
          const n = counts[c.value] || 0;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => set({ cat: active ? "all" : c.value })}
              className={`shrink-0 snap-start h-8 px-3 rounded-full text-[11.5px] font-semibold flex items-center gap-1.5 transition-all active:scale-95 border ${
                active
                  ? `bg-gradient-to-r ${CATEGORY_ACCENT[c.value] || "from-slate-500 to-zinc-600"} text-white border-white/20 shadow-lg`
                  : "bg-white/[0.05] text-foreground/75 border-white/10 hover:bg-white/[0.09]"
              }`}
            >
              <span>{CATEGORY_EMOJI[c.value] || "🏷️"}</span>
              <span className="max-w-[110px] truncate">{c.label}</span>
              {n > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${active ? "bg-black/25" : "bg-white/10"}`}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange({ q: "", cat: "all", status: "all", sort: value.sort })}
          className="w-full h-8 rounded-xl bg-white/[0.05] border border-white/10 text-[11.5px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition"
        >
          <Filter className="w-3.5 h-3.5" /> Reset filter ({activeCount})
        </button>
      )}
    </div>
  );
}
