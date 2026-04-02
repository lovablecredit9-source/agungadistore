import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingBag, KeyRound, Clock, Smartphone, Home, Package, Ticket } from "lucide-react";
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
      // Find token
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

      // Get product
      const { data: product } = await supabase.from("products").select("*").eq("id", token.product_id).single();
      // Get fields
      const { data: fields } = await supabase.from("token_fields").select("field_name, field_value").eq("token_id", token.id);

      // Mark claimed
      const now = new Date().toISOString();
      await supabase.from("tokens").update({ is_claimed: true, claimed_at: now }).eq("id", token.id);

      // Save claim record
      const deviceInfo = navigator.userAgent;
      const browser = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera|Samsung)/i)?.[0] || "Unknown";
      await supabase.from("token_claims").insert({ token_id: token.id, device_info: deviceInfo, browser });

      const result: ClaimResult = {
        token: { ...token, claimed_at: now },
        product: product!,
        fields: fields || [],
      };
      setClaimResult(result);

      // Save to local history
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
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <ShoppingBag className="w-6 h-6" />
          <h1 className="text-lg font-bold tracking-tight">Toko Akun Digital</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {tab === "beranda" && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Selamat Datang</h2>
              <p className="text-muted-foreground text-sm mt-1">Masukkan token yang sudah dibeli untuk mendapatkan akun kamu</p>
            </div>

            {/* Token Input */}
            <Card className="border-2 border-primary/20">
              <CardContent className="p-4 space-y-3">
                <label className="text-sm font-semibold">Masukkan Kode Token</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Contoh: TKN-XXXX-XXXX"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="font-mono"
                  />
                  <Button onClick={handleClaim} disabled={claiming || !tokenInput.trim()}>
                    {claiming ? "..." : "Klaim"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Claim Result */}
            {claimResult && (
              <Card className="border-2 border-accent/40 bg-accent/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Ticket className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{claimResult.product.title}</h3>
                      <p className="text-xs text-muted-foreground">{formatPrice(claimResult.product.price)}</p>
                    </div>
                  </div>
                  {claimResult.product.description && (
                    <p className="text-xs text-muted-foreground">{claimResult.product.description}</p>
                  )}
                  <div className="bg-background rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detail Akun</p>
                    {claimResult.fields.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <span className="text-xs text-muted-foreground">{f.field_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium">{f.field_value}</span>
                          <button onClick={() => copyText(f.field_value)} className="text-primary text-xs hover:underline">
                            Salin
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-destructive font-medium">⚠ Token berlaku 1 kali klaim</p>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTab("produk")}>
                <CardContent className="p-4 text-center">
                  <Package className="w-6 h-6 mx-auto mb-1 text-primary" />
                  <p className="text-2xl font-bold">{products.length}</p>
                  <p className="text-xs text-muted-foreground">Produk</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTab("history")}>
                <CardContent className="p-4 text-center">
                  <Clock className="w-6 h-6 mx-auto mb-1 text-accent" />
                  <p className="text-2xl font-bold">{history.length}</p>
                  <p className="text-xs text-muted-foreground">Token Diklaim</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {tab === "produk" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Daftar Produk</h2>
            {products.length === 0 && <p className="text-muted-foreground text-sm">Belum ada produk.</p>}
            {products.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                {p.image_url && (
                  <img src={p.image_url} alt={p.title} className="w-full h-40 object-cover" />
                )}
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold">{p.title}</h3>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                    </div>
                    <span className="text-sm font-bold text-primary whitespace-nowrap">{formatPrice(p.price)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Stok: {p.stock}</span>
                    <Button size="sm" asChild>
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
            <h2 className="text-lg font-bold">Masukkan Token</h2>
            <Card className="border-2 border-primary/20">
              <CardContent className="p-4 space-y-3">
                <label className="text-sm font-semibold">Kode Token</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Contoh: TKN-XXXX-XXXX"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="font-mono"
                  />
                  <Button onClick={handleClaim} disabled={claiming || !tokenInput.trim()}>
                    {claiming ? "..." : "Klaim"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {claimResult && (
              <Card className="border-2 border-accent/40 bg-accent/5">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-bold">{claimResult.product.title}</h3>
                  <p className="text-xs text-muted-foreground">{claimResult.product.description}</p>
                  <p className="font-bold text-primary">{formatPrice(claimResult.product.price)}</p>
                  <div className="bg-background rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detail Akun</p>
                    {claimResult.fields.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <span className="text-xs text-muted-foreground">{f.field_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium">{f.field_value}</span>
                          <button onClick={() => copyText(f.field_value)} className="text-primary text-xs hover:underline">
                            Salin
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-destructive font-medium">⚠ Token berlaku 1 kali klaim</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Riwayat Token & Perangkat</h2>
            {history.length === 0 && <p className="text-muted-foreground text-sm">Belum ada riwayat klaim.</p>}
            {history.map((h) => (
              <Card key={h.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">{h.product_title}</h3>
                    <span className="text-xs font-mono text-muted-foreground">{h.token_code}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(h.claimed_at).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Smartphone className="w-3 h-3" />
                      <span>{h.browser} — {h.device_info?.slice(0, 60)}...</span>
                    </div>
                  </div>
                  {h.fields.length > 0 && (
                    <div className="bg-muted rounded-lg p-2 space-y-1">
                      {h.fields.map((f, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{f.field_name}</span>
                          <div className="flex gap-1">
                            <span className="font-mono">{f.field_value}</span>
                            <button onClick={() => copyText(f.field_value)} className="text-primary hover:underline">Salin</button>
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
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
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
              className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-colors ${
                tab === key ? "text-primary font-semibold" : "text-muted-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${tab === key ? "text-primary" : ""}`} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Index;