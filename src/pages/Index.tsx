import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingBag, KeyRound, Clock, Smartphone, Home, Package, Ticket, Sparkles, Star, Zap, Download, MessageCircle, Copy, CheckCircle2, Shield, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import storeQris from "@/assets/store-qris.jpg";

type Tab = "beranda" | "produk" | "voucher" | "history";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
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
  claimed_at: string;
  device_info: string | null;
  browser: string | null;
  fields: { field_name: string; field_value: string }[];
}

const WA_NUMBER = "085769302532";

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

const Index = () => {
  const [tab, setTab] = useState<Tab>("beranda");
  const [products, setProducts] = useState<Product[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    loadHistory();
  }, []);

  async function fetchProducts() {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (data) setProducts(data);
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

  async function handleClaim() {
    const code = tokenInput.trim().toUpperCase();
    if (!code) return;
    setClaiming(true);
    setClaimResult(null);

    try {
      const { data: token, error: tErr } = await supabase
        .from("tokens")
        .select("*")
        .eq("token_code", code)
        .maybeSingle();

      if (tErr || !token) {
        toast({ title: "Kode voucher tidak ditemukan", variant: "destructive" });
        setClaiming(false);
        return;
      }

      if (token.is_claimed) {
        toast({ title: "Voucher sudah pernah diklaim", description: "Kode ini hanya berlaku 1 kali.", variant: "destructive" });
        setClaiming(false);
        return;
      }

      const { data: product } = await supabase.from("products").select("*").eq("id", token.product_id).single();
      const { data: fields } = await supabase.from("token_fields").select("field_name, field_value").eq("token_id", token.id);

      const now = new Date().toISOString();
      await supabase.from("tokens").update({ is_claimed: true, claimed_at: now }).eq("id", token.id);

      const deviceInfo = navigator.userAgent;
      const browser = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera|Samsung)/i)?.[0] || "Unknown";
      await supabase.from("token_claims").insert({ token_id: token.id, device_info: deviceInfo, browser });

      const result: ClaimResult = {
        token: { ...token, claimed_at: now },
        product: product!,
        fields: fields || [],
      };
      setClaimResult(result);

      const newEntry: ClaimHistory = {
        id: token.id,
        token_code: code,
        product_title: product!.title,
        claimed_at: now,
        device_info: deviceInfo,
        browser,
        fields: fields || [],
      };
      saveHistory([newEntry, ...history]);

      toast({ title: "Voucher berhasil diklaim! 🎉" });
    } catch {
      toast({ title: "Terjadi kesalahan", variant: "destructive" });
    }
    setClaiming(false);
  }

  function copyText(text: string, id?: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(id || text);
    setTimeout(() => setCopiedField(null), 2000);
    toast({ title: "Berhasil disalin!" });
  }

  function downloadHistoryPDF() {
    if (history.length === 0) return;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageW, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Agung Adi Store", pageW / 2, 18, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Riwayat Klaim Voucher", pageW / 2, 28, { align: "center" });
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, pageW / 2, 34, { align: "center" });

    let y = 50;
    doc.setTextColor(0, 0, 0);

    history.forEach((h, idx) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      // Card background
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(14, y - 4, pageW - 28, 42 + h.fields.length * 8, 3, 3, "F");
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, y - 4, pageW - 28, 42 + h.fields.length * 8, 3, 3, "S");

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(99, 102, 241);
      doc.text(`#${idx + 1} ${h.product_title}`, 20, y + 4);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Kode: ${h.token_code}`, 20, y + 12);
      doc.text(`Waktu: ${new Date(h.claimed_at).toLocaleString("id-ID")}`, 20, y + 18);
      doc.text(`Browser: ${h.browser || "-"}`, 20, y + 24);
      doc.text(`Perangkat: ${(h.device_info || "-").slice(0, 70)}`, 20, y + 30);

      if (h.fields.length > 0) {
        let fy = y + 36;
        doc.setTextColor(30, 30, 30);
        h.fields.forEach((f) => {
          doc.setFont("helvetica", "bold");
          doc.text(`${f.field_name}: `, 20, fy);
          doc.setFont("helvetica", "normal");
          doc.text(f.field_value, 20 + doc.getTextWidth(`${f.field_name}: `), fy);
          fy += 8;
        });
      }

      y += 50 + h.fields.length * 8;
    });

    // Footer
    const lastPage = doc.getNumberOfPages();
    for (let i = 1; i <= lastPage; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Agung Adi Store — WA: 085769302532", pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
    }

    doc.save("riwayat-klaim-agung-adi-store.pdf");
    toast({ title: "PDF berhasil didownload! 📄" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <img
            src={storeQris}
            alt="Agung Adi Store"
            className="w-11 h-11 rounded-xl object-cover border-2 border-primary-foreground/30 shadow-md"
          />
          <div className="flex-1">
            <h1 className="text-lg font-extrabold tracking-tight">Agung Adi Store</h1>
            <p className="text-[10px] opacity-80 leading-tight">Toko Akun Digital Murah & Terpercaya</p>
          </div>
          <a
            href={`https://wa.me/62${WA_NUMBER.replace(/^0/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {tab === "beranda" && (
          <div className="space-y-5">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-5">
              <div className="absolute -top-4 -right-4 opacity-10">
                <Crown className="w-24 h-24 text-primary" />
              </div>
              <div className="relative z-10 text-center">
                <img
                  src={storeQris}
                  alt="Agung Adi Store"
                  className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-lg border-2 border-primary/20"
                />
                <h2 className="text-xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Agung Adi Store
                </h2>
                <p className="text-xs text-muted-foreground mt-1 font-medium">Murah • Terpercaya • Fast Response</p>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  Beli akun digital premium dengan harga terbaik. Gunakan kode voucher untuk klaim akun kamu.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <a
                    href={`https://wa.me/62${WA_NUMBER.replace(/^0/, "")}?text=${encodeURIComponent("Halo, saya mau order di Agung Adi Store")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground shadow-md gap-1.5">
                      <MessageCircle className="w-4 h-4" />
                      Hubungi WA
                    </Button>
                  </a>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent" onClick={() => setTab("produk")}>
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-2xl font-extrabold text-primary">{products.length}</p>
                  <p className="text-xs text-muted-foreground font-medium">Produk Tersedia</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-accent/10 bg-gradient-to-br from-accent/5 to-transparent" onClick={() => setTab("history")}>
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-2xl font-extrabold text-accent">{history.length}</p>
                  <p className="text-xs text-muted-foreground font-medium">Voucher Diklaim</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Link - Voucher */}
            <Card className="border-dashed border-2 border-primary/20 hover:border-primary/40 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 duration-200" onClick={() => setTab("voucher")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                  <Ticket className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm">Punya Kode Voucher?</h3>
                  <p className="text-xs text-muted-foreground">Klaim akun premium kamu sekarang →</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "produk" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> Daftar Produk
              </h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium">{products.length} item</span>
            </div>
            {products.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Belum ada produk.</p>
                <p className="text-xs mt-1">Hubungi admin untuk info produk terbaru.</p>
              </div>
            )}
            {products.map((p) => (
              <Card key={p.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 border-border/50">
                {p.image_url && (
                  <div className="relative">
                    <img src={p.image_url} alt={p.title} className="w-full h-44 object-cover" />
                    <div className="absolute top-2 right-2">
                      <span className="text-xs font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full shadow-md">
                        {formatPrice(p.price)}
                      </span>
                    </div>
                  </div>
                )}
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-base">{p.title}</h3>
                    {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                    {!p.image_url && (
                      <span className="text-sm font-extrabold text-primary">{formatPrice(p.price)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.stock > 0 ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>
                        {p.stock > 0 ? `✓ Stok: ${p.stock}` : '✗ Habis'}
                      </span>
                    </div>
                    <Button size="sm" className="bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 text-accent-foreground shadow-md gap-1.5 rounded-full" asChild>
                      <a
                        href={`https://wa.me/62${WA_NUMBER.replace(/^0/, "")}?text=${encodeURIComponent(`Halo, saya mau beli: ${p.title} (${formatPrice(p.price)})`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Beli via WA
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tab === "voucher" && (
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" /> Klaim Voucher
            </h2>
            <Card className="border-2 border-primary/20 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-1" />
              <CardContent className="p-5 space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Ticket className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <p className="text-sm font-medium">Masukkan Kode Voucher</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Contoh: JXPIBAIF86H686UU</p>
                </div>
                <div className="space-y-3">
                  <Input
                    placeholder="MASUKKAN KODE VOUCHER"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                    className="font-mono text-center text-base tracking-[0.2em] uppercase border-2 border-primary/20 focus:border-primary h-12"
                  />
                  <Button onClick={handleClaim} disabled={claiming || !tokenInput.trim()} className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 shadow-lg font-bold text-base gap-2">
                    {claiming ? (
                      <span className="animate-pulse">Memproses...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Klaim Sekarang
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {claimResult && (
              <Card className="border-2 border-accent/40 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-accent to-accent/70 p-3 text-accent-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold text-sm">Voucher Berhasil Diklaim!</span>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-md">
                      <Crown className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-bold">{claimResult.product.title}</h3>
                      <p className="text-xs text-muted-foreground">{formatPrice(claimResult.product.price)}</p>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 space-y-2 border border-border">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Detail Akun
                    </p>
                    {claimResult.fields.map((f, i) => {
                      const fieldId = `claim-${i}`;
                      return (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <span className="text-xs text-muted-foreground">{f.field_name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono font-bold">{f.field_value}</span>
                            <button
                              onClick={() => copyText(f.field_value, fieldId)}
                              className={`text-xs font-bold px-2 py-0.5 rounded-md transition-all ${
                                copiedField === fieldId
                                  ? 'bg-accent/20 text-accent'
                                  : 'bg-primary/10 text-primary hover:bg-primary/20'
                              }`}
                            >
                              {copiedField === fieldId ? (
                                <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> OK</span>
                              ) : (
                                <span className="flex items-center gap-0.5"><Copy className="w-3 h-3" /> Salin</span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-destructive font-medium bg-destructive/10 p-2.5 rounded-lg text-center">
                    ⚠ Kode voucher hanya berlaku 1 kali klaim
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Riwayat Klaim
              </h2>
              {history.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadHistoryPDF}
                  className="gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </Button>
              )}
            </div>

            {history.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Belum ada riwayat klaim.</p>
                <p className="text-xs mt-1">Klaim kode voucher pertamamu!</p>
                <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setTab("voucher")}>
                  <Ticket className="w-4 h-4" />
                  Klaim Voucher
                </Button>
              </div>
            )}

            {history.map((h, idx) => (
              <Card key={h.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 border-border/50">
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">#{idx + 1}</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">{h.token_code}</span>
                </div>
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                      <Crown className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{h.product_title}</h3>
                      <p className="text-[10px] text-muted-foreground">{new Date(h.claimed_at).toLocaleString("id-ID")}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                    <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{h.browser} — {h.device_info?.slice(0, 40)}...</span>
                  </div>

                  {h.fields.length > 0 && (
                    <div className="bg-background border border-border rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Detail Akun
                      </p>
                      {h.fields.map((f, i) => {
                        const fid = `h-${h.id}-${i}`;
                        return (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                            <span className="text-xs text-muted-foreground">{f.field_name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold">{f.field_value}</span>
                              <button
                                onClick={() => copyText(f.field_value, fid)}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all ${
                                  copiedField === fid
                                    ? 'bg-accent/20 text-accent'
                                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                                }`}
                              >
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
            ))}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex max-w-lg mx-auto">
          {([
            { key: "beranda", icon: Home, label: "Beranda" },
            { key: "produk", icon: Package, label: "Produk" },
            { key: "voucher", icon: Ticket, label: "Voucher" },
            { key: "history", icon: Clock, label: "Riwayat" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center py-3 text-xs transition-all duration-200 ${
                tab === key 
                  ? "text-primary font-bold" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${tab === key ? "bg-primary/10 scale-110" : ""}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="mt-0.5">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Index;
