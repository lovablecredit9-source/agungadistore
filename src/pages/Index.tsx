import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingBag, KeyRound, Clock, Smartphone, Home, Package, Ticket, Sparkles, Star, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Tab = "beranda" | "produk" | "token" | "history";

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
    const code = tokenInput.trim();
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
        toast({ title: "Token tidak ditemukan", variant: "destructive" });
        setClaiming(false);
        return;
      }

      if (token.is_claimed) {
        toast({ title: "Token sudah pernah diklaim", description: "Token ini hanya berlaku 1 kali.", variant: "destructive" });
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

      toast({ title: "Token berhasil diklaim!" });
    } catch {
      toast({ title: "Terjadi kesalahan", variant: "destructive" });
    }
    setClaiming(false);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Disalin!", description: text.slice(0, 40) });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-4 shadow-xl">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Agung Adi Store</h1>
            <p className="text-[10px] opacity-80">Toko Akun Digital Terpercaya</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {tab === "beranda" && (
          <div className="space-y-5">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 p-6 text-center">
              <div className="absolute top-2 right-3 opacity-20">
                <Sparkles className="w-16 h-16 text-primary" />
              </div>
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Star className="w-8 h-8 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Selamat Datang!
                </h2>
                <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
                  Beli akun digital premium dengan harga terbaik. Gunakan token untuk klaim akun kamu.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent" onClick={() => setTab("produk")}>
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-primary">{products.length}</p>
                  <p className="text-xs text-muted-foreground font-medium">Produk Tersedia</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-accent/10 bg-gradient-to-br from-accent/5 to-transparent" onClick={() => setTab("history")}>
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-2xl font-bold text-accent">{history.length}</p>
                  <p className="text-xs text-muted-foreground font-medium">Token Diklaim</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Links */}
            <Card className="border-dashed border-2 border-primary/20 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setTab("token")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
                  <KeyRound className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm">Punya Token?</h3>
                  <p className="text-xs text-muted-foreground">Klaim akun kamu sekarang →</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "produk" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> Daftar Produk
            </h2>
            {products.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada produk.</p>
              </div>
            )}
            {products.map((p) => (
              <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
                {p.image_url && (
                  <img src={p.image_url} alt={p.title} className="w-full h-40 object-cover" />
                )}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold">{p.title}</h3>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                    </div>
                    <span className="text-sm font-bold text-primary whitespace-nowrap bg-primary/10 px-2 py-1 rounded-lg">{formatPrice(p.price)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">Stok: {p.stock}</span>
                    <Button size="sm" className="bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-accent-foreground shadow-md" asChild>
                      <a
                        href={`https://wa.me/62${WA_NUMBER.replace(/^0/, "")}?text=${encodeURIComponent(`Halo, saya mau beli: ${p.title} (${formatPrice(p.price)})`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Beli via WA
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tab === "token" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" /> Klaim Token
            </h2>
            <Card className="border-2 border-primary/20 shadow-lg">
              <CardContent className="p-5 space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <Ticket className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Masukkan kode token yang sudah kamu beli</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="TKN-XXXX-XXXX"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="font-mono text-center text-base tracking-wider"
                  />
                  <Button onClick={handleClaim} disabled={claiming || !tokenInput.trim()} className="px-6 bg-gradient-to-r from-primary to-primary/80">
                    {claiming ? "..." : "Klaim"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {claimResult && (
              <Card className="border-2 border-accent/40 bg-gradient-to-br from-accent/5 to-transparent shadow-lg">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-md">
                      <Ticket className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-bold">{claimResult.product.title}</h3>
                      <p className="text-xs text-muted-foreground">{formatPrice(claimResult.product.price)}</p>
                    </div>
                  </div>
                  {claimResult.product.description && (
                    <p className="text-xs text-muted-foreground">{claimResult.product.description}</p>
                  )}
                  <div className="bg-background rounded-xl p-3 space-y-2 border border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detail Akun</p>
                    {claimResult.fields.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <span className="text-xs text-muted-foreground">{f.field_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium">{f.field_value}</span>
                          <button onClick={() => copyText(f.field_value)} className="text-primary text-xs font-semibold hover:underline bg-primary/10 px-2 py-0.5 rounded-md">
                            Salin
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded-lg text-center">⚠ Token berlaku 1 kali klaim</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Riwayat Klaim
            </h2>
            {history.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada riwayat klaim.</p>
              </div>
            )}
            {history.map((h) => (
              <Card key={h.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">{h.product_title}</h3>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{h.token_code}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(h.claimed_at).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3 h-3" />
                      <span>{h.browser} — {h.device_info?.slice(0, 50)}...</span>
                    </div>
                  </div>
                  {h.fields.length > 0 && (
                    <div className="bg-muted/50 rounded-xl p-2.5 space-y-1.5 border border-border/50">
                      {h.fields.map((f, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{f.field_name}</span>
                          <div className="flex gap-1.5">
                            <span className="font-mono font-medium">{f.field_value}</span>
                            <button onClick={() => copyText(f.field_value)} className="text-primary font-semibold hover:underline">Salin</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex max-w-lg mx-auto">
          {([
            { key: "beranda", icon: Home, label: "Beranda" },
            { key: "produk", icon: Package, label: "Produk" },
            { key: "token", icon: KeyRound, label: "Token" },
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
