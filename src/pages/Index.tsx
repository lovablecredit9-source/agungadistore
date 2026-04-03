import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShoppingBag, KeyRound, Clock, Smartphone, Home, Package, Ticket,
  Download, MessageCircle, Copy, CheckCircle2, Shield, Crown,
  HelpCircle, X, ExternalLink, Search, ChevronLeft, ChevronRight, FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import storeQris from "@/assets/store-qris.jpg";
import { STORE_NAME, WA_NUMBER, SOCIAL_LINKS, YOUTUBE_NAME } from "@/lib/social-links";
import { getDeviceSummary, collectDeviceInfo } from "@/lib/device-info";

type Tab = "beranda" | "produk" | "voucher" | "history";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
}

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  image_order: number;
}

interface ClaimResult {
  token: { id: string; token_code: string; claimed_at: string | null };
  product: Product;
  fields: { field_name: string; field_value: string }[];
}

interface ClaimHistory {
  id: string;
  token_code: string;
  product_title: string;
  product_price: number;
  product_image?: string;
  claimed_at: string;
  device_info: string | null;
  browser: string | null;
  fields: { field_name: string; field_value: string }[];
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

// Image carousel component
function ImageCarousel({ images, className = "w-full h-44" }: { images: string[]; className?: string }) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) return null;
  if (images.length === 1) return <img src={images[0]} alt="" className={`${className} object-cover`} />;

  return (
    <div className="relative">
      <img src={images[current]} alt="" className={`${className} object-cover`} />
      <button onClick={e => { e.stopPropagation(); setCurrent(c => (c - 1 + images.length) % images.length); }}
        className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button onClick={e => { e.stopPropagation(); setCurrent(c => (c + 1) % images.length); }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center">
        <ChevronRight className="w-4 h-4" />
      </button>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {images.map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === current ? "bg-white" : "bg-white/50"}`} />
        ))}
      </div>
    </div>
  );
}

const Index = () => {
  const [tab, setTab] = useState<Tab>("beranda");
  const [products, setProducts] = useState<Product[]>([]);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [claimResults, setClaimResults] = useState<ClaimResult[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [productSearch, setProductSearch] = useState("");
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 5;
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    loadHistory();
  }, []);

  async function fetchProducts() {
    const [pRes, piRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_images").select("*").order("image_order"),
    ]);
    if (pRes.data) setProducts(pRes.data as Product[]);
    if (piRes.data) setProductImages(piRes.data as ProductImage[]);
  }

  function getProductImages(productId: string): string[] {
    const imgs = productImages.filter(i => i.product_id === productId).map(i => i.image_url);
    const product = products.find(p => p.id === productId);
    if (imgs.length === 0 && product?.image_url) return [product.image_url];
    return imgs;
  }

  function loadHistory() {
    try {
      const stored = localStorage.getItem("token_history");
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }

  function saveHistory(h: ClaimHistory[]) {
    setHistory(h);
    localStorage.setItem("token_history", JSON.stringify(h));
  }

  function parseCodes(input: string): string[] {
    return input.split(/[|\n]/).map(c => c.trim().toUpperCase()).filter(Boolean);
  }

  async function handleClaim() {
    const codes = parseCodes(tokenInput);
    if (codes.length === 0) return;
    setClaiming(true);
    setClaimResults([]);

    const results: ClaimResult[] = [];
    const newHistories: ClaimHistory[] = [];

    for (const code of codes) {
      try {
        const { data: token } = await supabase.from("tokens").select("*").eq("token_code", code).maybeSingle();
        if (!token) { toast({ title: `Kode ${code} tidak ditemukan`, variant: "destructive" }); continue; }
        if (token.is_claimed) { toast({ title: `Kode ${code} sudah diklaim`, variant: "destructive" }); continue; }

        const { data: product } = await supabase.from("products").select("*").eq("id", token.product_id).single();
        const { data: fields } = await supabase.from("token_fields").select("field_name, field_value").eq("token_id", token.id);

        const now = new Date().toISOString();
        await supabase.from("tokens").update({ is_claimed: true, claimed_at: now }).eq("id", token.id);

        const deviceResult = await collectDeviceInfo();
        const deviceInfo = deviceResult.raw;
        await supabase.from("token_claims").insert({ token_id: token.id, device_info: deviceInfo, browser: deviceResult.browser });

        const prodImgs = getProductImages(token.product_id);

        results.push({ token: { ...token, claimed_at: now }, product: product as Product, fields: fields || [] });
        newHistories.push({
          id: token.id,
          token_code: code,
          product_title: product!.title,
          product_price: product!.price,
          product_image: prodImgs[0] || product!.image_url || undefined,
          claimed_at: now,
          device_info: deviceInfo,
          browser,
          fields: fields || [],
        });
      } catch { toast({ title: `Error klaim ${code}`, variant: "destructive" }); }
    }

    if (results.length > 0) {
      setClaimResults(results);
      saveHistory([...newHistories, ...history]);
      toast({ title: `${results.length} voucher berhasil diklaim! 🎉` });
    }
    setClaiming(false);
  }

  function copyText(text: string, id?: string) {
    if (!navigator.clipboard) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    } else { navigator.clipboard.writeText(text); }
    setCopiedField(id || text);
    setTimeout(() => setCopiedField(null), 2000);
    toast({ title: "Berhasil disalin!" });
  }

  function getSelectedHistory(): ClaimHistory[] {
    if (selectedHistoryIds.size === 0) return history;
    return history.filter(h => selectedHistoryIds.has(h.id));
  }

  function toggleHistorySelect(id: string) {
    const s = new Set(selectedHistoryIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedHistoryIds(s);
  }

  function toggleSelectAll() {
    if (selectedHistoryIds.size === history.length) {
      setSelectedHistoryIds(new Set());
    } else {
      setSelectedHistoryIds(new Set(history.map(h => h.id)));
    }
  }

  async function downloadHistoryPDF() {
    const items = getSelectedHistory();
    if (items.length === 0) return;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Try to add logo
    try {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        img.onload = () => {
          doc.addImage(img, "JPEG", pageW / 2 - 10, 5, 20, 20);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = storeQris;
      });
    } catch {}

    // Header
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 28, pageW, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(STORE_NAME, pageW / 2, 38, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Riwayat Klaim Voucher — ${new Date().toLocaleString("id-ID")}`, pageW / 2, 43, { align: "center" });

    let y = 54;
    doc.setTextColor(0, 0, 0);

    items.forEach((h, idx) => {
      const blockH = 50 + h.fields.length * 8;
      if (y + blockH > pageH - 30) { doc.addPage(); y = 20; }

      doc.setFillColor(248, 249, 250);
      doc.roundedRect(14, y - 4, pageW - 28, blockH, 3, 3, "F");
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, y - 4, pageW - 28, blockH, 3, 3, "S");

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(99, 102, 241);
      doc.text(`#${idx + 1} ${h.product_title}`, 20, y + 4);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Kode: ${h.token_code}`, 20, y + 12);
      doc.text(`Waktu: ${new Date(h.claimed_at).toLocaleString("id-ID")}`, 20, y + 18);
      doc.text(`Harga: ${formatPrice(h.product_price || 0)}`, 20, y + 24);
      const deviceSummary = h.device_info ? getDeviceSummary(h.device_info) : "-";
      doc.text(`Perangkat: ${deviceSummary}`, 20, y + 30);

      if (h.fields.length > 0) {
        let fy = y + 38;
        doc.setTextColor(30, 30, 30);
        h.fields.forEach((f) => {
          doc.setFont("helvetica", "bold");
          doc.text(`${f.field_name}: `, 20, fy);
          doc.setFont("helvetica", "normal");
          doc.text(f.field_value, 20 + doc.getTextWidth(`${f.field_name}: `), fy);
          fy += 8;
        });
      }
      y += blockH + 8;
    });

    const lastPage = doc.getNumberOfPages();
    for (let i = 1; i <= lastPage; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Harap simpan bukti ini. Jika ada masalah hubungi admin.", pageW / 2, pageH - 15, { align: "center" });
      doc.text(`${STORE_NAME} — WA: ${WA_NUMBER}`, pageW / 2, pageH - 10, { align: "center" });
    }

    doc.save("riwayat-klaim-agung-adi-store.pdf");
    toast({ title: "PDF berhasil didownload! 📄" });
  }

  function downloadHistoryTXT() {
    const items = getSelectedHistory();
    if (items.length === 0) return;

    let txt = `${STORE_NAME} - Riwayat Klaim Voucher\n`;
    txt += `Dicetak: ${new Date().toLocaleString("id-ID")}\n`;
    txt += "=".repeat(50) + "\n\n";

    items.forEach((h, idx) => {
      txt += `#${idx + 1} ${h.product_title}\n`;
      txt += `Kode: ${h.token_code}\n`;
      txt += `Waktu: ${new Date(h.claimed_at).toLocaleString("id-ID")}\n`;
      txt += `Harga: ${formatPrice(h.product_price || 0)}\n`;
      const deviceSummary = h.device_info ? getDeviceSummary(h.device_info) : "-";
      txt += `Perangkat: ${deviceSummary}\n`;
      h.fields.forEach(f => { txt += `${f.field_name}: ${f.field_value}\n`; });
      txt += "-".repeat(40) + "\n\n";
    });

    txt += `\n${STORE_NAME} — WA: ${WA_NUMBER}\n`;
    txt += "Harap simpan bukti ini. Jika ada masalah hubungi admin.\n";

    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "riwayat-klaim-agung-adi-store.txt"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "TXT berhasil didownload! 📝" });
  }

  const categories = ["Semua", ...Array.from(new Set(products.map(p => p.category || "Lainnya").filter(Boolean)))];
  const filteredProducts = products
    .filter(p => selectedCategory === "Semua" || (p.category || "Lainnya") === selectedCategory)
    .filter(p => p.title.toLowerCase().includes(productSearch.toLowerCase()) || (p.description || "").toLowerCase().includes(productSearch.toLowerCase()));
  const sortedProducts = sortOrder === "oldest" ? [...filteredProducts].reverse() : filteredProducts;

  const totalClaimPrice = claimResults.reduce((sum, r) => sum + r.product.price, 0);

  // History pagination
  const totalHistoryPages = Math.ceil(history.length / HISTORY_PER_PAGE);
  const paginatedHistory = history.slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <img src={storeQris} alt={STORE_NAME} className="w-11 h-11 rounded-xl object-cover border-2 border-primary-foreground/30 shadow-md" />
          <div className="flex-1">
            <h1 className="text-lg font-extrabold tracking-tight">{STORE_NAME}</h1>
            <p className="text-[10px] opacity-80 leading-tight">Terpercaya • Aman • Murah</p>
          </div>
          <a href={`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent("Halo, saya mau tanya di Agung Adi Store")}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-primary-foreground/30 transition-colors">
            <MessageCircle className="w-5 h-5" />
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {tab === "beranda" && (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-5">
              <div className="absolute -top-4 -right-4 opacity-10"><Crown className="w-24 h-24 text-primary" /></div>
              <div className="relative z-10 text-center">
                <img src={storeQris} alt={STORE_NAME} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-lg border-2 border-primary/20" />
                <h2 className="text-xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{STORE_NAME}</h2>
                <p className="text-xs text-muted-foreground mt-1 font-medium">Terpercaya • Aman • Murah</p>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">Beli akun digital premium dengan harga terbaik.</p>
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  <a href={`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent("Halo, saya mau order di Agung Adi Store")}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground shadow-md gap-1.5"><MessageCircle className="w-4 h-4" /> Hubungi WA</Button>
                  </a>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTab("voucher")}><Ticket className="w-4 h-4" /> Klaim Voucher</Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent" onClick={() => setTab("produk")}>
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2"><Package className="w-5 h-5 text-primary" /></div>
                  <p className="text-2xl font-extrabold text-primary">{products.length}</p>
                  <p className="text-xs text-muted-foreground font-medium">Produk Tersedia</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-accent/10 bg-gradient-to-br from-accent/5 to-transparent" onClick={() => setTab("history")}>
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2"><Clock className="w-5 h-5 text-accent" /></div>
                  <p className="text-2xl font-extrabold text-accent">{history.length}</p>
                  <p className="text-xs text-muted-foreground font-medium">Voucher Diklaim</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-dashed border-2 border-primary/20 hover:border-primary/40 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 duration-200" onClick={() => setTab("voucher")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md"><Ticket className="w-6 h-6 text-primary-foreground" /></div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm">Punya Kode Voucher?</h3>
                  <p className="text-xs text-muted-foreground">Klaim akun premium kamu sekarang →</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Ikuti Kami</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: `WA: ${WA_NUMBER}`, href: SOCIAL_LINKS.whatsapp, color: "from-green-500 to-green-600" },
                    { label: YOUTUBE_NAME, href: SOCIAL_LINKS.youtube, color: "from-red-500 to-red-600" },
                    { label: "@agungadi981", href: SOCIAL_LINKS.twitter, color: "from-sky-400 to-sky-500" },
                    { label: "@agungadi57", href: SOCIAL_LINKS.instagram, color: "from-pink-500 to-purple-500" },
                    { label: "@pphitampro9", href: SOCIAL_LINKS.tiktok, color: "from-gray-800 to-black" },
                  ].map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                      className={`bg-gradient-to-r ${s.color} text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 hover:opacity-90 transition-opacity`}>
                      <ExternalLink className="w-3 h-3 shrink-0" /><span className="truncate">{s.label}</span>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "produk" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Daftar Produk</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium">{sortedProducts.length} item</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cari produk..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-9" />
            </div>

            {/* Category filter + sort */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategory === cat ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSortOrder("newest")} className={`text-xs px-3 py-1 rounded-full ${sortOrder === "newest" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground"}`}>Terbaru</button>
              <button onClick={() => setSortOrder("oldest")} className={`text-xs px-3 py-1 rounded-full ${sortOrder === "oldest" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground"}`}>Terlama</button>
            </div>

            {sortedProducts.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Belum ada produk.</p>
              </div>
            )}

            {sortedProducts.map((p) => {
              const imgs = getProductImages(p.id);
              return (
                <Card key={p.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 border-border/50 cursor-pointer" onClick={() => setSelectedProduct(p)}>
                  {imgs.length > 0 && (
                    <div className="relative">
                      <ImageCarousel images={imgs} />
                      <div className="absolute top-2 right-2">
                        <span className="text-xs font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full shadow-md">{formatPrice(p.price)}</span>
                      </div>
                      {p.category && (
                        <div className="absolute top-2 left-2">
                          <span className="text-[10px] font-medium bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full">{p.category}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-bold text-base">{p.title}</h3>
                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                    <div className="flex items-center justify-between">
                      {imgs.length === 0 && <span className="text-sm font-extrabold text-primary">{formatPrice(p.price)}</span>}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.stock > 0 ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>
                        {p.stock > 0 ? `✓ Stok: ${p.stock}` : '✗ Habis'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "voucher" && (
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" /> Klaim Voucher</h2>
            <Card className="border-2 border-primary/20 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-1" />
              <CardContent className="p-5 space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Ticket className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <p className="text-sm font-medium">Masukkan Kode Voucher</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pisahkan dengan <span className="font-mono font-bold text-primary">|</span> atau Enter untuk banyak kode</p>
                </div>
                <div className="space-y-3">
                  <Textarea placeholder="KODE1 | KODE2 | KODE3" value={tokenInput} onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                    className="font-mono text-center text-sm tracking-wider uppercase border-2 border-primary/20 focus:border-primary min-h-[60px]" rows={2} />
                  <p className="text-xs text-muted-foreground text-center">{parseCodes(tokenInput).length > 0 && `${parseCodes(tokenInput).length} kode terdeteksi`}</p>
                  <Button onClick={handleClaim} disabled={claiming || !tokenInput.trim()} className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 shadow-lg font-bold text-base gap-2">
                    {claiming ? <span className="animate-pulse">Memproses...</span> : <><CheckCircle2 className="w-5 h-5" /> Klaim Sekarang</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {claimResults.length > 0 && (
              <div className="space-y-3">
                <Card className="bg-gradient-to-r from-accent/10 to-primary/10 border-accent/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground font-medium">Total Harga</p>
                    <p className="text-2xl font-extrabold text-primary">{formatPrice(totalClaimPrice)}</p>
                    <p className="text-xs text-muted-foreground">{claimResults.length} voucher berhasil diklaim</p>
                  </CardContent>
                </Card>

                {claimResults.map((result, ri) => (
                  <Card key={ri} className="border-2 border-accent/40 shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-accent to-accent/70 p-3 text-accent-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" /><span className="font-bold text-sm">Voucher Berhasil Diklaim!</span>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-md">
                          <Crown className="w-5 h-5 text-accent-foreground" />
                        </div>
                        <div>
                          <h3 className="font-bold">{result.product.title}</h3>
                          <p className="text-xs text-muted-foreground">{formatPrice(result.product.price)}</p>
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded-xl p-3 space-y-2 border border-border">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1"><Shield className="w-3 h-3" /> Detail Akun</p>
                        {result.fields.map((f, i) => {
                          const fieldId = `claim-${ri}-${i}`;
                          return (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                              <span className="text-xs text-muted-foreground">{f.field_name}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-mono font-bold max-w-[140px] truncate">{f.field_value}</span>
                                <button onClick={() => copyText(f.field_value, fieldId)}
                                  className={`text-xs font-bold px-2 py-0.5 rounded-md transition-all ${copiedField === fieldId ? 'bg-accent/20 text-accent' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                                  {copiedField === fieldId ? <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> OK</span> : <span className="flex items-center gap-0.5"><Copy className="w-3 h-3" /> Salin</span>}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-destructive font-medium bg-destructive/10 p-2.5 rounded-lg text-center">⚠ Kode voucher hanya berlaku 1 kali klaim</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Riwayat Klaim</h2>
            </div>

            {history.length > 0 && (
              <>
                {/* Select all + download buttons */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={selectedHistoryIds.size === history.length} onCheckedChange={toggleSelectAll} />
                    <span className="text-muted-foreground">Pilih Semua ({selectedHistoryIds.size}/{history.length})</span>
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={downloadHistoryPDF} className="gap-1 rounded-full border-primary/30 text-primary hover:bg-primary/10 text-xs">
                      <Download className="w-3 h-3" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={downloadHistoryTXT} className="gap-1 rounded-full border-accent/30 text-accent hover:bg-accent/10 text-xs">
                      <FileText className="w-3 h-3" /> TXT
                    </Button>
                  </div>
                </div>
              </>
            )}

            {history.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Belum ada riwayat klaim.</p>
                <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setTab("voucher")}><Ticket className="w-4 h-4" /> Klaim Voucher</Button>
              </div>
            )}

            {paginatedHistory.map((h, idx) => {
              const deviceSummary = h.device_info ? getDeviceSummary(h.device_info) : "Tidak diketahui";
              const globalIdx = (historyPage - 1) * HISTORY_PER_PAGE + idx;
              return (
                <Card key={`${h.id}-${globalIdx}`} className="overflow-hidden hover:shadow-lg transition-all duration-200 border-border/50">
                  <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selectedHistoryIds.has(h.id)} onCheckedChange={() => toggleHistorySelect(h.id)} />
                      <span className="text-xs font-bold text-primary">#{globalIdx + 1}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">{h.token_code}</span>
                  </div>
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center gap-3">
                      {h.product_image ? (
                        <img src={h.product_image} className="w-9 h-9 rounded-xl object-cover" alt="" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                          <Crown className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-sm">{h.product_title}</h3>
                        <p className="text-[10px] text-muted-foreground">{new Date(h.claimed_at).toLocaleString("id-ID")}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                      <Smartphone className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{deviceSummary}</span>
                    </div>

                    {h.fields.length > 0 && (
                      <div className="bg-background border border-border rounded-xl p-3 space-y-2">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1"><Shield className="w-3 h-3" /> Detail Akun</p>
                        {h.fields.map((f, i) => {
                          const fid = `h-${h.id}-${i}`;
                          return (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                              <span className="text-xs text-muted-foreground">{f.field_name}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono font-bold max-w-[120px] truncate">{f.field_value}</span>
                                <button onClick={() => copyText(f.field_value, fid)}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all ${copiedField === fid ? 'bg-accent/20 text-accent' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                                  {copiedField === fid ? '✓' : 'Salin'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Pagination */}
            {totalHistoryPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="icon" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{historyPage} / {totalHistoryPages}</span>
                <Button variant="outline" size="icon" disabled={historyPage >= totalHistoryPages} onClick={() => setHistoryPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (() => {
        const imgs = getProductImages(selectedProduct.id);
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedProduct(null)}>
            <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
              {imgs.length > 0 && <ImageCarousel images={imgs} className="w-full h-56" />}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold">{selectedProduct.title}</h2>
                    {selectedProduct.category && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{selectedProduct.category}</span>}
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-2xl font-extrabold text-primary">{formatPrice(selectedProduct.price)}</p>
                {selectedProduct.description && <p className="text-sm text-muted-foreground leading-relaxed">{selectedProduct.description}</p>}
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${selectedProduct.stock > 0 ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>
                    {selectedProduct.stock > 0 ? `✓ Stok: ${selectedProduct.stock}` : '✗ Habis'}
                  </span>
                </div>
                <Button className="w-full h-12 bg-gradient-to-r from-accent to-accent/80 text-accent-foreground shadow-lg font-bold text-base gap-2 rounded-xl" asChild>
                  <a href={`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent(`Halo, saya mau beli: ${selectedProduct.title} (${formatPrice(selectedProduct.price)})`)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-5 h-5" /> Beli via WhatsApp
                  </a>
                </Button>
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hubungi Kami</p>
                  <div className="space-y-1.5">
                    {[
                      { label: `WA: ${WA_NUMBER}`, href: SOCIAL_LINKS.whatsapp },
                      { label: `YouTube: ${YOUTUBE_NAME}`, href: SOCIAL_LINKS.youtube },
                      { label: "Twitter: @agungadi981", href: SOCIAL_LINKS.twitter },
                      { label: "Instagram: @agungadi57", href: SOCIAL_LINKS.instagram },
                      { label: "TikTok: @pphitampro9", href: SOCIAL_LINKS.tiktok },
                    ].map(s => (
                      <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1.5">
                        <ExternalLink className="w-3 h-3" /> {s.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Help Center Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">Pusat Bantuan</h3>
              <button onClick={() => setShowHelp(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p><strong>Cara order:</strong> Pilih produk → Chat WA → Bayar → Dapat kode voucher → Klaim di tab Voucher</p>
              <p><strong>Cara klaim:</strong> Masukkan kode voucher, klik Klaim.</p>
              <p><strong>Masalah?</strong> Hubungi admin lewat WA.</p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex max-w-lg mx-auto">
          {([
            { key: "beranda", icon: Home, label: "Beranda" },
            { key: "produk", icon: Package, label: "Produk" },
            { key: "voucher", icon: Ticket, label: "Voucher" },
            { key: "history", icon: Clock, label: "Riwayat" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center py-3 text-xs transition-all duration-200 ${tab === key ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}>
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${tab === key ? "bg-primary/10 scale-110" : ""}`}><Icon className="w-5 h-5" /></div>
              <span className="mt-0.5">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Floating Help Button */}
      <button onClick={() => setShowHelp(true)} className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
        <HelpCircle className="w-6 h-6" />
      </button>
    </div>
  );
};

export default Index;
