import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Filter, Download, FileText, FileSpreadsheet, BarChart3,
  Calendar as CalendarIcon, X, TrendingUp, TrendingDown, ChevronDown,
  LayoutList, Clock, BarChart2, ArrowDownUp,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import jsPDF from "jspdf";
import CountUp from "@/components/CountUp";
import storeQris from "@/assets/store-qris.jpg";
import {
  Document as DocxDocument, Packer, Paragraph, TextRun, Table as DocxTable,
  TableRow as DocxTableRow, TableCell as DocxTableCell, AlignmentType, HeadingLevel,
  BorderStyle, WidthType, ShadingType, ImageRun, Header as DocxHeader, Footer as DocxFooter,
  PageNumber, LevelFormat, VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";

interface WalletInfo {
  username?: string;
  balance?: number;
  gameBalance?: number;
}

interface WalletSnapshot {
  username: string;
  balance: number;
  gameBalance: number;
  gems: number;
  streakCoins: number;
  gameCredits: number;
  totalIn: number;
  totalOut: number;
}

async function fetchWalletSnapshot(visitorId: string | undefined, info: WalletInfo | undefined, totals: { in: number; out: number }): Promise<WalletSnapshot> {
  const snap: WalletSnapshot = {
    username: info?.username || "-",
    balance: info?.balance ?? 0,
    gameBalance: info?.gameBalance ?? 0,
    gems: 0,
    streakCoins: 0,
    gameCredits: 0,
    totalIn: totals.in,
    totalOut: totals.out,
  };
  if (!visitorId) return snap;
  try {
    const [gemRes, streakRes, credRes] = await Promise.all([
      supabase.rpc("get_account_gems" as any, { p_visitor_id: visitorId }),
      supabase.from("daily_streaks").select("streak_coins").eq("visitor_id", visitorId).maybeSingle(),
      supabase.from("user_game_credits").select("credits").eq("visitor_id", visitorId).maybeSingle(),
    ]);
    snap.gems = Number((gemRes as any)?.data ?? 0) || 0;
    snap.streakCoins = Number((streakRes.data as any)?.streak_coins ?? 0) || 0;
    snap.gameCredits = Number((credRes.data as any)?.credits ?? 0) || 0;
  } catch { /* ignore */ }
  return snap;
}

// Cache image load → base64 dataURL
const _imgCache: Record<string, string> = {};
async function loadImageAsDataURL(url: string): Promise<string | null> {
  if (_imgCache[url]) return _imgCache[url];
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    _imgCache[url] = dataUrl;
    return dataUrl;
  } catch { return null; }
}

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
  /** visitor id utk fetch gem/credit/streak coin saat export */
  visitorId?: string;
  /** info saldo akun yg ikut tercetak di file ekspor */
  walletInfo?: WalletInfo;
}

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const cleanExportText = (value: unknown) => {
  const text = String(value ?? "-")
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, "")
    .replace(/[\u2600-\u27BF]/g, "")
    .replace(/[\uFE0F\u200D]/g, "")
    .replace(/[\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/[\u2022\u00B7]/g, "-")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || "-";
};

const STORE_WEBSITE = "https://agungadistore.lovable.app";

const csvCell = (value: unknown) => `"${cleanExportText(value).replace(/"/g, '""')}"`;

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
    const list = items.filter((it) => {
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
  useEffect(() => {
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

  const getExportAmount = (it: HistoryItem) => {
    if (typeof it.amount === "number" && it.amount !== 0) return it.amount;
    const raw = it.meta?.deposit_amount ?? it.meta?.nominal ?? it.meta?.jumlah;
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw.replace(/[^0-9-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const formatExportAmount = (it: HistoryItem) => {
    const amount = getExportAmount(it);
    return amount !== 0 ? `${amount > 0 ? "+" : "-"}${formatAmount(Math.abs(amount))}` : "-";
  };

  // ======= EXPORT =======
  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["No", "Tanggal", "Judul", "Kategori", "Deskripsi", "Nominal"];
    const rows = filtered.map((it, i) => [
      i + 1,
      new Date(it.date).toLocaleString("id-ID"),
      csvCell(it.title),
      csvCell(it.category),
      csvCell(it.subtitle),
      getExportAmount(it),
    ].join(","));
    const csv = "\uFEFF" + [headers.join(","), ...rows, `"Website: ${STORE_WEBSITE}"`].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const defaultName = `${exportPrefix}-${Date.now()}`;
    const input = window.prompt("Masukkan nama file CSV (tanpa .csv):", defaultName);
    if (input === null) { URL.revokeObjectURL(url); return; }
    const safe = (input.trim() || defaultName).replace(/[\\/:*?"<>|]+/g, "_");
    a.href = url; a.download = `${safe}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    if (filtered.length === 0) return;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Preload assets
    const [logoData, qrisData] = await Promise.all([
      loadImageAsDataURL("/icons/icon-192.png"),
      loadImageAsDataURL(storeQris),
    ]);

    // ===== HEADER GRADIENT =====
    const headerH = 46;
    doc.setFillColor(41, 98, 255);
    doc.rect(0, 0, pageW, headerH, "F");
    for (let i = 0; i < 24; i++) {
      doc.setFillColor(99, 102, 241, 255 - i * 8);
      doc.rect(0, i * (headerH / 24), pageW, headerH / 24 + 0.4, "F");
    }
    doc.setFillColor(255, 255, 255);
    doc.circle(pageW - 50, -8, 22, "F");
    doc.circle(pageW - 70, headerH + 4, 14, "F");
    // Logo bulat (QRIS)
    if (qrisData) {
      doc.setFillColor(255, 255, 255);
      doc.circle(20, headerH / 2, 11, "F");
      try { doc.addImage(qrisData, "JPEG", 11, headerH / 2 - 9, 18, 18); } catch { /* ignore invalid image data */ }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text(cleanExportText(storeName), 36, 18);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(cleanExportText(title), 36, 25);
    doc.setFontSize(7.5);
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")} WIB`, 36, 31);
    doc.text(`Total: ${filtered.length} item`, 36, 36);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(36, 39, 38, 5, 2.5, 2.5, "F");
    doc.setTextColor(41, 98, 255);
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    doc.text("MURAH & TERPERCAYA", 55, 42.5, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6); doc.setFont("helvetica", "normal");
    doc.text(STORE_WEBSITE, 55, 45.5, { align: "center" });
    if (qrisData) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageW - 36, 4, 32, 38, 2, 2, "F");
      try { doc.addImage(qrisData, "JPEG", pageW - 34, 6, 28, 28); } catch { /* ignore invalid image data */ }
      doc.setTextColor(41, 98, 255);
      doc.setFontSize(6); doc.setFont("helvetica", "bold");
      doc.text("SCAN QRIS", pageW - 20, 39, { align: "center" });
    }

    // ===== RINGKASAN CARDS =====
    const cardY = 52;
    const cardW = (pageW - 30) / 3;
    const drawCard = (x: number, label: string, value: string, fill: number[], border: number[], txtColor: number[]) => {
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(border[0], border[1], border[2]);
      doc.roundedRect(x, cardY, cardW, 16, 2, 2, "FD");
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text(label, x + 3, cardY + 5);
      doc.setTextColor(txtColor[0], txtColor[1], txtColor[2]);
      doc.setFontSize(11);
      doc.text(value, x + 3, cardY + 13);
    };
    drawCard(10, "TOTAL ITEM", String(filtered.length), [239, 246, 255], [191, 219, 254], [30, 41, 59]);
    drawCard(15 + cardW, "MASUK", `+${formatAmount(stats.totalIn || 0)}`, [236, 253, 245], [167, 243, 208], [5, 150, 105]);
    drawCard(20 + cardW * 2, "KELUAR", `-${formatAmount(stats.totalOut || 0)}`, [254, 242, 242], [254, 202, 202], [220, 38, 38]);

    // ===== PERINGATAN =====
    const warnY = 72;
    doc.setFillColor(254, 252, 232);
    doc.setDrawColor(234, 179, 8);
    doc.roundedRect(10, warnY, pageW - 20, 22, 2, 2, "FD");
    doc.setFillColor(234, 179, 8);
    doc.rect(10, warnY, 1.5, 22, "F");
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
    doc.text("PERINGATAN", 14, warnY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7); doc.setTextColor(60, 60, 60);
    const warnLines = [
      "- File ini hanya tampilan/ekspos riwayat - BUKAN bukti pembayaran resmi pihak ketiga.",
      "- Transaksi produk SPONSOR di luar tanggung jawab admin. Hubungi admin sponsor / Rekber via WhatsApp.",
      "- Hanya transaksi RESMI Agung Adi Store yang dijamin admin (WA: 085769302532).",
    ];
    let wwy = warnY + 10;
    warnLines.forEach((ln) => {
      const wrapped = doc.splitTextToSize(ln, pageW - 28);
      doc.text(wrapped, 14, wwy);
      wwy += wrapped.length * 2.8;
    });
    doc.setTextColor(0, 0, 0);

    // ===== DETAIL RIWAYAT TABEL =====
    const autoTable = (await import("jspdf-autotable")).default;
    autoTable(doc, {
      startY: 100,
      head: [["No", "ID", "Tanggal", "Kategori", "Judul", "Keterangan", "Jumlah"]],
      body: filtered.map((it, i) => [
        String(i + 1),
        cleanExportText(it.meta?.trx_id || it.id || "-"),
        new Date(it.date).toLocaleString("id-ID"),
        cleanExportText(it.category),
        cleanExportText(it.title),
        cleanExportText(it.subtitle),
        formatExportAmount(it),
      ]),
      styles: {
        fontSize: 7,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        textColor: [30, 41, 59],
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [41, 98, 255],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 2.4,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 9, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 25, font: "courier", fontSize: 6.3 },
        2: { cellWidth: 27, fontSize: 6.4 },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 35, fontStyle: "bold" },
        5: { cellWidth: "auto" },
        6: { cellWidth: 25, halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 6) {
          const raw = String(data.cell.raw || "");
          data.cell.styles.textColor = raw.startsWith("+") ? [5, 150, 105] : raw.startsWith("-") ? [220, 38, 38] : [100, 116, 139];
        }
      },
      margin: { top: 18, bottom: 18, left: 10, right: 10 },
    });

    // QRIS page (lampiran pembayaran)
    if (qrisData) {
      doc.addPage();
      doc.setFillColor(41, 98, 255);
      doc.rect(0, 0, pageW, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("QRIS Pembayaran", pageW / 2, 14, { align: "center" });
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text("Scan QRIS di bawah untuk melakukan pembayaran/top up.", pageW / 2, 32, { align: "center" });
      const size = 110;
      try { doc.addImage(qrisData, "JPEG", (pageW - size) / 2, 40, size, size); } catch { /* ignore invalid image data */ }
      doc.setFontSize(9); doc.setTextColor(100);
      doc.text(`${cleanExportText(storeName)} - WA 085769302532`, pageW / 2, 40 + size + 8, { align: "center" });
    }

    // Footer band per halaman
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFillColor(41, 98, 255);
      doc.rect(0, pageH - 14, pageW, 14, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text(cleanExportText(storeName), 10, pageH - 8);
      doc.setFont("helvetica", "normal");
      doc.text("WA: 085769302532 - Murah & Terpercaya", 10, pageH - 3.5);
      doc.text(`Halaman ${p}/${pageCount}`, pageW - 10, pageH - 5.5, { align: "right" });
    }
    const defaultPdfName = `${exportPrefix}-${Date.now()}`;
    const pdfInput = window.prompt("Masukkan nama file PDF (tanpa .pdf):", defaultPdfName);
    if (pdfInput === null) return;
    const safePdf = (pdfInput.trim() || defaultPdfName).replace(/[\\/:*?"<>|]+/g, "_");
    doc.save(`${safePdf}.pdf`);
  }

  async function exportWord() {
    if (filtered.length === 0) return;

    // Fetch QRIS as ArrayBuffer for ImageRun
    let qrisBuffer: ArrayBuffer | null = null;
    try {
      const res = await fetch(storeQris);
      qrisBuffer = await res.arrayBuffer();
    } catch { qrisBuffer = null; }

    const PRIMARY = "2962FF";
    const MUTED = "64748B";
    const SUCCESS = "059669";
    const DANGER = "DC2626";

    const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" };
    const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

    // ===== HEADER TABLE (Brand band) =====
    const headerCells: DocxTableCell[] = [];
    headerCells.push(new DocxTableCell({
      width: { size: 7000, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
      shading: { fill: PRIMARY, type: ShadingType.CLEAR },
      margins: { top: 200, bottom: 200, left: 240, right: 200 },
      children: [
        new Paragraph({ children: [new TextRun({ text: storeName, bold: true, color: "FFFFFF", size: 36 })] }),
        new Paragraph({ children: [new TextRun({ text: title, color: "FFFFFF", size: 22 })] }),
        new Paragraph({ children: [new TextRun({ text: `Dicetak: ${new Date().toLocaleString("id-ID")} WIB`, color: "DBEAFE", size: 16 })] }),
        new Paragraph({ children: [new TextRun({ text: `Total: ${filtered.length} item - MURAH & TERPERCAYA`, color: "FFFFFF", size: 16, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: STORE_WEBSITE, color: "DBEAFE", size: 14 })] }),
      ],
    }));
    if (qrisBuffer) {
      headerCells.push(new DocxTableCell({
        width: { size: 2360, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "jpg", data: qrisBuffer, transformation: { width: 90, height: 90 }, altText: { title: "QRIS", description: "QRIS", name: "qris" } })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SCAN QRIS", bold: true, color: PRIMARY, size: 14 })] }),
        ],
      }));
    } else {
      headerCells.push(new DocxTableCell({
        width: { size: 2360, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        shading: { fill: PRIMARY, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: " ", color: "FFFFFF" })] })],
      }));
    }

    const headerTable = new DocxTable({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [7000, 2360],
      rows: [new DocxTableRow({ children: headerCells })],
    });

    // ===== SUMMARY CARDS (3 columns) =====
    const summaryCard = (label: string, value: string, fill: string, txtColor: string) =>
      new DocxTableCell({
        width: { size: 3120, type: WidthType.DXA },
        borders: cellBorders,
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 180, right: 180 },
        children: [
          new Paragraph({ children: [new TextRun({ text: label, bold: true, color: MUTED, size: 14 })] }),
          new Paragraph({ children: [new TextRun({ text: value, bold: true, color: txtColor, size: 22 })] }),
        ],
      });

    const summaryTable = new DocxTable({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3120, 3120, 3120],
      rows: [new DocxTableRow({ children: [
        summaryCard("TOTAL ITEM", String(filtered.length), "EFF6FF", "1E293B"),
        summaryCard("MASUK", `+${formatAmount(stats.totalIn || 0)}`, "ECFDF5", SUCCESS),
        summaryCard("KELUAR", `-${formatAmount(stats.totalOut || 0)}`, "FEF2F2", DANGER),
      ]})],
    });

    // ===== WARNING BOX =====
    const warningTable = new DocxTable({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [9360],
      rows: [new DocxTableRow({ children: [new DocxTableCell({
        width: { size: 9360, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "EAB308" }, bottom: { style: BorderStyle.SINGLE, size: 8, color: "EAB308" }, left: { style: BorderStyle.SINGLE, size: 32, color: "EAB308" }, right: { style: BorderStyle.SINGLE, size: 8, color: "EAB308" } },
        shading: { fill: "FEFCE8", type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        children: [
          new Paragraph({ children: [new TextRun({ text: "PERINGATAN", bold: true, color: "92400E", size: 18 })] }),
          new Paragraph({ children: [new TextRun({ text: "- File ini hanya tampilan/ekspos riwayat - BUKAN bukti pembayaran resmi pihak ketiga.", color: "3F3F46", size: 16 })] }),
          new Paragraph({ children: [new TextRun({ text: "- Transaksi produk SPONSOR di luar tanggung jawab admin. Hubungi admin sponsor / Rekber via WhatsApp.", color: "3F3F46", size: 16 })] }),
          new Paragraph({ children: [new TextRun({ text: "- Hanya transaksi RESMI Agung Adi Store yang dijamin admin (WA: 085769302532).", color: "3F3F46", size: 16 })] }),
        ],
      })] })],
    });

    // ===== DETAIL RIWAYAT TABEL =====
    const itemBlocks: (DocxTable | Paragraph)[] = [];
    itemBlocks.push(new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: "Detail Riwayat Tabel", bold: true, color: PRIMARY, size: 26 })],
    }));

    const tableHeaders = ["No", "ID", "Tanggal", "Kategori", "Judul", "Keterangan", "Jumlah"];
    const tableWidths = [520, 1180, 1460, 1000, 1500, 2300, 1400];
    const makeCell = (text: string, width: number, opts: { header?: boolean; amount?: number; align?: typeof AlignmentType.RIGHT | typeof AlignmentType.CENTER } = {}) => new DocxTableCell({
      width: { size: width, type: WidthType.DXA },
      borders: cellBorders,
      shading: { fill: opts.header ? PRIMARY : "FFFFFF", type: ShadingType.CLEAR },
      margins: { top: 90, bottom: 90, left: 90, right: 90 },
      children: [new Paragraph({
        alignment: opts.align,
        children: [new TextRun({
          text,
          bold: opts.header || opts.amount !== undefined,
          color: opts.header ? "FFFFFF" : opts.amount !== undefined ? (opts.amount > 0 ? SUCCESS : opts.amount < 0 ? DANGER : MUTED) : "1E293B",
          size: opts.header ? 15 : 13,
        })],
      })],
    });

    itemBlocks.push(new DocxTable({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: tableWidths,
      rows: [
        new DocxTableRow({ children: tableHeaders.map((h, idx) => makeCell(h, tableWidths[idx], { header: true, align: idx === 0 || idx === 3 ? AlignmentType.CENTER : undefined })) }),
        ...filtered.map((it, i) => {
          const amount = getExportAmount(it);
          const amountText = formatExportAmount(it);
          return new DocxTableRow({ children: [
            makeCell(String(i + 1), tableWidths[0], { align: AlignmentType.CENTER }),
            makeCell(cleanExportText(it.meta?.trx_id || it.id || "-"), tableWidths[1]),
            makeCell(new Date(it.date).toLocaleString("id-ID"), tableWidths[2]),
            makeCell(cleanExportText(it.category), tableWidths[3], { align: AlignmentType.CENTER }),
            makeCell(cleanExportText(it.title), tableWidths[4]),
            makeCell(cleanExportText(it.subtitle), tableWidths[5]),
            makeCell(amountText, tableWidths[6], { amount, align: AlignmentType.RIGHT }),
          ] });
        }),
      ],
    }));

    const spacerSmall = new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: "" })] });

    const wordDoc = new DocxDocument({
      creator: storeName,
      title,
      styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 720, right: 720, bottom: 1000, left: 720 },
          },
        },
        footers: {
          default: new DocxFooter({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `${storeName} - WA: 085769302532 - ${STORE_WEBSITE} - Murah & Terpercaya - Halaman `, color: PRIMARY, bold: true, size: 16 }),
                new TextRun({ children: [PageNumber.CURRENT], color: PRIMARY, bold: true, size: 16 }),
                new TextRun({ text: "/", color: PRIMARY, bold: true, size: 16 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], color: PRIMARY, bold: true, size: 16 }),
              ],
            })],
          }),
        },
        children: [
          headerTable,
          spacerSmall,
          summaryTable,
          spacerSmall,
          warningTable,
          ...itemBlocks,
        ],
      }],
    });

    const blob = await Packer.toBlob(wordDoc);
    const defaultName = `${exportPrefix}-${Date.now()}`;
    const input = window.prompt("Masukkan nama file Word (tanpa .docx):", defaultName);
    if (input === null) return;
    const safe = (input.trim() || defaultName).replace(/[\\/:*?"<>|]+/g, "_");
    saveAs(blob, `${safe}.docx`);
  }

  const activeFiltersCount =
    (search ? 1 : 0) + (category !== "all" ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) + (sort !== "newest" ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* === Toolbar === */}
      <div className="bg-card rounded-2xl border border-border/60 p-3 space-y-2.5">
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
            type="button"
            size="sm"
            variant="outline"
            className="h-9 px-2.5 rounded-xl border-border bg-card text-xs font-medium text-foreground gap-1 shadow-none"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="w-3.5 h-3.5" strokeWidth={1.8} />
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
                "px-2.5 h-7 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 transition-colors",
                view === "list" ? "bg-card text-foreground" : "text-muted-foreground"
              )}
            >
              <LayoutList className="w-3 h-3" strokeWidth={1.8} /> List
            </button>
            <button
              onClick={() => setView("timeline")}
              className={cn(
                "px-2.5 h-7 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 transition-colors",
                view === "timeline" ? "bg-card text-foreground" : "text-muted-foreground"
              )}
            >
              <Clock className="w-3 h-3" strokeWidth={1.8} /> Timeline
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 rounded-lg border-border bg-card text-[10px] font-medium text-foreground gap-1 shadow-none"
              onClick={() => setShowStatsPanel((v) => !v)}
            >
              <BarChart3 className="w-3 h-3" strokeWidth={1.8} /> Statistik
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 rounded-lg border-border bg-card text-[10px] font-medium text-foreground gap-1 shadow-none"
                  disabled={filtered.length === 0}
                >
                  <Download className="w-3 h-3" strokeWidth={1.8} /> Export
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1.5">
                <button
                  onClick={exportPDF}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted text-xs font-medium"
                >
                  <FileText className="w-3.5 h-3.5 text-foreground" /> PDF
                </button>
                <button
                  onClick={exportWord}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted text-xs font-medium"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> Word (.docx)
                </button>
                <button
                  onClick={exportCSV}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted text-xs font-medium"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-foreground" /> Excel (CSV)
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
                    className="text-[10px] font-semibold px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
                      className="text-[10px] font-semibold px-2 py-1 rounded-full bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-1"
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
                  <Button onClick={clearFilters} variant="ghost" size="sm" className="h-7 text-[11px] font-semibold w-full gap-1 text-foreground hover:bg-muted">
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
            <Card className="border border-border/60 bg-card shadow-none">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-foreground" />
                    <p className="text-[11px] font-semibold text-foreground">Statistik 14 Hari Terakhir</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-semibold">{stats.count} item</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border bg-muted/40 p-2 text-center">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase">Total</p>
                    <p className="text-base font-semibold text-foreground leading-none mt-1"><CountUp value={stats.count} /></p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-2 text-center">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase inline-flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" /> Masuk</p>
                    <p className="text-[10px] font-semibold text-foreground leading-tight mt-1">{formatAmount(stats.totalIn)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-2 text-center">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase inline-flex items-center gap-0.5"><TrendingDown className="w-2.5 h-2.5" /> Keluar</p>
                    <p className="text-[10px] font-semibold text-foreground leading-tight mt-1">{formatAmount(stats.totalOut)}</p>
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
                                className="w-1/2 bg-foreground rounded-t min-h-[1px] opacity-70"
                                title={`Masuk: ${formatAmount(d.in)}`}
                              />
                              <motion.div
                                initial={{ height: 0 }} animate={{ height: `${outH}%` }}
                                transition={{ duration: 0.4, delay: i * 0.02 + 0.05 }}
                                className="w-1/2 bg-muted-foreground rounded-t min-h-[1px] opacity-60"
                                title={`Keluar: ${formatAmount(d.out)}`}
                              />
                            </>
                          ) : (
                            <motion.div
                              initial={{ height: 0 }} animate={{ height: `${h}%` }}
                              transition={{ duration: 0.4, delay: i * 0.02 }}
                                className="w-full bg-foreground/70 rounded-t min-h-[1px]"
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
          <span className="text-[9px] font-semibold text-foreground inline-flex items-center gap-1">
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
