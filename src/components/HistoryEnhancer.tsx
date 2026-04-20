import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Filter, Download, FileText, FileSpreadsheet, BarChart3,
  Calendar as CalendarIcon, X, TrendingUp, TrendingDown, ChevronDown,
  LayoutList, Clock, Sparkles, ArrowDownUp,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import jsPDF from "jspdf";
import CountUp from "@/components/CountUp";

/** Generic record yang harus dimiliki setiap item */
export interface HistoryItem {
  id: string;
  title: string;        // judul utama (mis. nama produk / "Top Up" / "TRX-...")
  subtitle?: string;    // sub info (mis. deskripsi / metode)
  amount?: number;      // nominal (positif = masuk, negatif = keluar)
  date: string;         // ISO timestamp
  category?: string;    // tag (mis. type/status)
  meta?: Record<string, string | number | undefined>; // info tambahan untuk export
}

export type ViewMode = "timeline" | "list";

interface Props {
  /** label hero, mis. "Riwayat Klaim Voucher" */
  title: string;
  /** semua item original (tidak terfilter) */
  items: HistoryItem[];
  /** kategori unik untuk dropdown filter */
  categories?: string[];
  /** format harga konsisten dgn aplikasi */
  formatAmount?: (n: number) => string;
  /** prefix nama file export */
  exportPrefix?: string;
  /** render item ketika view = list (default tampilan) */
  renderItem: (item: HistoryItem, idx: number) => React.ReactNode;
  /** items yang sudah difilter dipassing balik supaya parent bisa render */
  onFilteredChange?: (filteredIds: string[]) => void;
  /** sembunyikan stats chart (utk tab kecil) */
  showStats?: boolean;
  /** view mode awal */
  defaultView?: ViewMode;
  /** nama toko utk PDF */
  storeName?: string;
}

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

/**
 * Komponen "keren" untuk semua tab Riwayat:
 * - Filter & Pencarian (search realtime, range tanggal, kategori, urutan)
 * - Statistik visual (total/masuk/keluar + mini bar 14 hari)
 * - Export PDF & CSV (Excel-compatible)
 * - View: Timeline (group by tanggal) atau List standar
 */
export default function HistoryEnhancer({
  title, items, categories = [], formatAmount = fmtIDR,
  exportPrefix = "riwayat", renderItem, onFilteredChange,
  showStats = true, defaultView = "list", storeName = "Agung Adi Store",
}: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "amount_high" | "amount_low">("newest");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [view, setView] = useState<ViewMode>(defaultView);
  const [showStatsPanel, setShowStatsPanel] = useState(showStats);
  const [showFilters, setShowFilters] = useState(false);

  const quickRange = (days: number) => {
    setDateFrom(subDays(new Date(), days - 1));
    setDateTo(new Date());
  };

  const clearFilters = () => {
    setSearch(""); setCategory("all"); setSort("newest");
    setDateFrom(undefined); setDateTo(undefined);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((it) => {
      if (q) {
        const blob = `${it.title} ${it.subtitle ?? ""} ${it.category ?? ""} ${Object.values(it.meta ?? {}).join(" ")}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (category !== "all" && it.category !== category) return false;
      const d = new Date(it.date);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sort === "newest") return +new Date(b.date) - +new Date(a.date);
      if (sort === "oldest") return +new Date(a.date) - +new Date(b.date);
      if (sort === "amount_high") return (b.amount ?? 0) - (a.amount ?? 0);
      return (a.amount ?? 0) - (b.amount ?? 0);
    });
    return list;
  }, [items, search, category, sort, dateFrom, dateTo]);

  // Sinkronkan ke parent
  useMemo(() => {
    onFilteredChange?.(filtered.map((it) => it.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const stats = useMemo(() => {
    const totalIn = filtered.filter((i) => (i.amount ?? 0) > 0).reduce((s, i) => s + (i.amount ?? 0), 0);
    const totalOut = filtered.filter((i) => (i.amount ?? 0) < 0).reduce((s, i) => s + Math.abs(i.amount ?? 0), 0);
    // 14-day bars
    const days: { key: string; label: string; in: number; out: number; count: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = subDays(today, i);
      days.push({
        key: format(d, "yyyy-MM-dd"),
        label: format(d, "d/M"),
        in: 0, out: 0, count: 0,
      });
    }
    filtered.forEach((it) => {
      const k = it.date.slice(0, 10);
      const day = days.find((dd) => dd.key === k);
      if (!day) return;
      day.count += 1;
      if ((it.amount ?? 0) > 0) day.in += it.amount ?? 0;
      else if ((it.amount ?? 0) < 0) day.out += Math.abs(it.amount ?? 0);
    });
    const max = Math.max(1, ...days.flatMap((d) => [d.in, d.out, d.count]));
    return { totalIn, totalOut, days, max, count: filtered.length };
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    filtered.forEach((it) => {
      const k = it.date.slice(0, 10);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    });
    return Array.from(map.entries()).map(([k, list]) => ({ key: k, items: list }));
  }, [filtered]);

  // ======= EXPORT =======
  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["No", "Tanggal", "Judul", "Kategori", "Deskripsi", "Nominal"];
    const rows = filtered.map((it, i) => [
      i + 1,
      new Date(it.date).toLocaleString("id-ID"),
      `"${(it.title ?? "").replace(/"/g, '""')}"`,
      it.category ?? "",
      `"${(it.subtitle ?? "").replace(/"/g, '""')}"`,
      it.amount ?? 0,
    ].join(","));
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${exportPrefix}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (filtered.length === 0) return;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    // Header
    doc.setFillColor(41, 98, 255);
    doc.rect(0, 0, pageW, 36, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text(storeName, pageW / 2, 16, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(title, pageW / 2, 24, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")} • ${filtered.length} item`, pageW / 2, 31, { align: "center" });
    // Summary box
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    let y = 46;
    doc.text(`Ringkasan`, 14, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`Total Item   : ${filtered.length}`, 14, y); y += 5;
    if (stats.totalIn > 0)  { doc.text(`Total Masuk  : ${formatAmount(stats.totalIn)}`, 14, y); y += 5; }
    if (stats.totalOut > 0) { doc.text(`Total Keluar : ${formatAmount(stats.totalOut)}`, 14, y); y += 5; }
    y += 3;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Detail Riwayat", 14, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    filtered.forEach((it, i) => {
      if (y > pageH - 20) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. ${it.title}`, 14, y, { maxWidth: pageW - 28 }); y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(`   ${new Date(it.date).toLocaleString("id-ID")}`, 14, y); y += 4;
      if (it.category) { doc.text(`   Kategori: ${it.category}`, 14, y); y += 4; }
      if (it.subtitle) { doc.text(`   ${it.subtitle}`, 14, y, { maxWidth: pageW - 28 }); y += 4; }
      if (typeof it.amount === "number" && it.amount !== 0) {
        doc.text(`   Nominal: ${it.amount > 0 ? "+" : "-"}${formatAmount(Math.abs(it.amount))}`, 14, y); y += 4;
      }
      y += 2;
    });
    // Footer halaman
    const pageCount = (doc as any).internal.getNumberOfPages?.() ?? 1;
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`${storeName} • Halaman ${p}/${pageCount}`, pageW / 2, pageH - 8, { align: "center" });
    }
    doc.save(`${exportPrefix}-${Date.now()}.pdf`);
  }

  const activeFiltersCount =
    (search ? 1 : 0) + (category !== "all" ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) + (sort !== "newest" ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* === Toolbar === */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-3 space-y-2.5">
        {/* Search + Toggles */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari riwayat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs rounded-xl"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button
            type="button" size="sm" variant={showFilters ? "default" : "outline"}
            className="h-9 px-2.5 rounded-xl text-xs font-bold gap-1"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="w-3.5 h-3.5" />
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px]">{activeFiltersCount}</Badge>
            )}
          </Button>
        </div>

        {/* View switch + Export */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex bg-muted rounded-xl p-0.5">
            <button
              onClick={() => setView("list")}
              className={cn(
                "px-2.5 h-7 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors",
                view === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              <LayoutList className="w-3 h-3" /> List
            </button>
            <button
              onClick={() => setView("timeline")}
              className={cn(
                "px-2.5 h-7 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors",
                view === "timeline" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              <Clock className="w-3 h-3" /> Timeline
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button" size="sm" variant="outline"
              className="h-7 px-2 rounded-lg text-[10px] font-bold gap-1"
              onClick={() => setShowStatsPanel((v) => !v)}
            >
              <BarChart3 className="w-3 h-3" /> Statistik
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button" size="sm"
                  className="h-7 px-2 rounded-lg text-[10px] font-bold gap-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                  disabled={filtered.length === 0}
                >
                  <Download className="w-3 h-3" /> Export
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1.5">
                <button
                  onClick={exportPDF}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted text-xs font-bold"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-500" /> PDF
                </button>
                <button
                  onClick={exportCSV}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted text-xs font-bold"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel (CSV)
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-2 space-y-2 border-t border-border/40">
                {/* Quick range chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Hari ini", days: 1 },
                    { label: "7 hari", days: 7 },
                    { label: "30 hari", days: 30 },
                    { label: "90 hari", days: 90 },
                  ].map((q) => (
                    <button
                      key={q.label}
                      onClick={() => quickRange(q.days)}
                      className="text-[10px] font-bold px-2 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
                      className="text-[10px] font-bold px-2 py-1 rounded-full bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 inline-flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Tanggal
                    </button>
                  )}
                </div>

                {/* Date pickers + Category + Sort */}
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-8 text-[11px] font-bold justify-start gap-1.5 rounded-xl">
                        <CalendarIcon className="w-3 h-3" />
                        {dateFrom ? format(dateFrom, "d MMM", { locale: localeId }) : "Dari"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single" selected={dateFrom} onSelect={setDateFrom}
                        initialFocus className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-8 text-[11px] font-bold justify-start gap-1.5 rounded-xl">
                        <CalendarIcon className="w-3 h-3" />
                        {dateTo ? format(dateTo, "d MMM", { locale: localeId }) : "Sampai"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single" selected={dateTo} onSelect={setDateTo}
                        initialFocus className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  {categories.length > 0 && (
                    <select
                      value={category} onChange={(e) => setCategory(e.target.value)}
                      className="h-8 rounded-xl border border-input bg-background px-2 text-[11px] font-bold"
                    >
                      <option value="all">Semua kategori</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  <select
                    value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
                    className={cn(
                      "h-8 rounded-xl border border-input bg-background px-2 text-[11px] font-bold",
                      categories.length === 0 && "col-span-2"
                    )}
                  >
                    <option value="newest">Terbaru dulu</option>
                    <option value="oldest">Terlama dulu</option>
                    <option value="amount_high">Nominal tertinggi</option>
                    <option value="amount_low">Nominal terendah</option>
                  </select>
                </div>

                {activeFiltersCount > 0 && (
                  <Button onClick={clearFilters} variant="ghost" size="sm" className="h-7 text-[11px] font-bold w-full gap-1 text-rose-600 hover:bg-rose-500/10">
                    <X className="w-3 h-3" /> Reset semua filter
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* === Stats Panel === */}
      <AnimatePresence>
        {showStatsPanel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="border border-border/60 shadow-sm bg-card">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <p className="text-[11px] font-extrabold text-foreground">Statistik 14 Hari Terakhir</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-bold">{stats.count} item</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 rounded-xl p-2 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Total</p>
                    <p className="text-base font-extrabold text-primary leading-none mt-1"><CountUp value={stats.count} /></p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-2 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase inline-flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" /> Masuk</p>
                    <p className="text-[10px] font-extrabold text-emerald-600 leading-tight mt-1">{formatAmount(stats.totalIn)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-rose-500/15 to-rose-500/5 border border-rose-500/20 rounded-xl p-2 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase inline-flex items-center gap-0.5"><TrendingDown className="w-2.5 h-2.5" /> Keluar</p>
                    <p className="text-[10px] font-extrabold text-rose-600 leading-tight mt-1">{formatAmount(stats.totalOut)}</p>
                  </div>
                </div>

                {/* Mini chart 14 hari */}
                <div className="flex items-end justify-between gap-0.5 h-16">
                  {stats.days.map((d, i) => {
                    const h = (d.count / stats.max) * 100;
                    const inH = (d.in / stats.max) * 100;
                    const outH = (d.out / stats.max) * 100;
                    const useAmount = stats.totalIn > 0 || stats.totalOut > 0;
                    return (
                      <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full h-12 flex items-end justify-center gap-0.5">
                          {useAmount ? (
                            <>
                              <motion.div
                                initial={{ height: 0 }} animate={{ height: `${inH}%` }}
                                transition={{ duration: 0.4, delay: i * 0.02 }}
                                className="w-1/2 bg-emerald-500/80 rounded-t min-h-[1px]"
                                title={`Masuk: ${formatAmount(d.in)}`}
                              />
                              <motion.div
                                initial={{ height: 0 }} animate={{ height: `${outH}%` }}
                                transition={{ duration: 0.4, delay: i * 0.02 + 0.05 }}
                                className="w-1/2 bg-rose-500/80 rounded-t min-h-[1px]"
                                title={`Keluar: ${formatAmount(d.out)}`}
                              />
                            </>
                          ) : (
                            <motion.div
                              initial={{ height: 0 }} animate={{ height: `${h}%` }}
                              transition={{ duration: 0.4, delay: i * 0.02 }}
                              className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t min-h-[1px]"
                              title={`${d.count} item`}
                            />
                          )}
                        </div>
                        <span className="text-[7px] text-muted-foreground font-bold">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Result count === */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold text-muted-foreground">
          {filtered.length === items.length
            ? `${filtered.length} riwayat`
            : `${filtered.length} dari ${items.length} riwayat`}
        </p>
        {sort !== "newest" && (
          <span className="text-[9px] font-bold text-primary inline-flex items-center gap-1">
            <ArrowDownUp className="w-2.5 h-2.5" />
            {sort === "oldest" ? "Terlama" : sort === "amount_high" ? "Nominal ↓" : "Nominal ↑"}
          </span>
        )}
      </div>

      {/* === Items === */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-2">
            <Search className="w-6 h-6 opacity-40" />
          </div>
          <p className="text-xs font-bold">Tidak ada riwayat sesuai filter</p>
          {activeFiltersCount > 0 && (
            <Button onClick={clearFilters} variant="ghost" size="sm" className="mt-2 text-[11px] font-bold">
              Reset filter
            </Button>
          )}
        </div>
      ) : view === "timeline" ? (
        <div className="space-y-3">
          {grouped.map((group) => {
            const groupDate = new Date(group.key);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const isToday = group.key === format(today, "yyyy-MM-dd");
            const isYesterday = group.key === format(subDays(today, 1), "yyyy-MM-dd");
            const label = isToday
              ? "Hari Ini"
              : isYesterday
              ? "Kemarin"
              : format(groupDate, "EEEE, d MMM yyyy", { locale: localeId });
            const groupIn = group.items.reduce((s, i) => s + Math.max(0, i.amount ?? 0), 0);
            const groupOut = group.items.reduce((s, i) => s + Math.abs(Math.min(0, i.amount ?? 0)), 0);
            return (
              <div key={group.key}>
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1.5 mb-1.5 flex items-center gap-2">
                  <div className={cn(
                    "h-6 px-2.5 rounded-full inline-flex items-center gap-1.5 text-[10px] font-extrabold",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  )}>
                    <CalendarIcon className="w-2.5 h-2.5" /> {label}
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[9px] font-bold text-muted-foreground">{group.items.length} item</span>
                  {(groupIn > 0 || groupOut > 0) && (
                    <div className="flex items-center gap-1 text-[9px] font-bold">
                      {groupIn > 0 && <span className="text-emerald-600">+{formatAmount(groupIn)}</span>}
                      {groupOut > 0 && <span className="text-rose-600">-{formatAmount(groupOut)}</span>}
                    </div>
                  )}
                </div>
                <div className="space-y-2 pl-2 border-l-2 border-dashed border-border/60 ml-2">
                  {group.items.map((it, i) => (
                    <div key={it.id} className="relative">
                      <div className={cn(
                        "absolute -left-[11px] top-3 w-2 h-2 rounded-full ring-2 ring-background",
                        isToday ? "bg-primary" : "bg-muted-foreground/40"
                      )} />
                      <div className="pl-2">
                        {renderItem(it, i)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((it, i) => renderItem(it, i))}
        </div>
      )}
    </div>
  );
}
