import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, LogOut, Package, Ticket, Copy, Image, Edit2, X, Smartphone, Clock } from "lucide-react";
import { generateVoucherCode } from "@/lib/voucher-code";
import { getDeviceSummary } from "@/lib/device-info";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
}

interface ProductField {
  id: string;
  product_id: string;
  field_name: string;
  field_order: number;
}

interface Token {
  id: string;
  product_id: string;
  token_code: string;
  is_claimed: boolean;
  claimed_at: string | null;
}

interface TokenClaim {
  id: string;
  token_id: string;
  device_info: string | null;
  browser: string | null;
  claimed_at: string;
}

type AdminTab = "products" | "tokens" | "claims";

const AdminDashboard = () => {
  const [tab, setTab] = useState<AdminTab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [fields, setFields] = useState<ProductField[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [claims, setClaims] = useState<TokenClaim[]>([]);

  // Product form
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [category, setCategory] = useState("");
  const [newFields, setNewFields] = useState<string[]>(["Email", "Password", "No HP", "A2F"]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Token form
  const [selProduct, setSelProduct] = useState("");
  const [tokenFieldValues, setTokenFieldValues] = useState<Record<string, string>>({});
  const [tokenCount, setTokenCount] = useState("1");

  // Sort
  const [claimSort, setClaimSort] = useState<"newest" | "oldest">("newest");

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchAll();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/admin/login");
  }

  async function fetchAll() {
    const [pRes, fRes, tRes, cRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_fields").select("*").order("field_order"),
      supabase.from("tokens").select("*").order("created_at", { ascending: false }),
      supabase.from("token_claims").select("*").order("claimed_at", { ascending: false }),
    ]);
    if (pRes.data) setProducts(pRes.data as Product[]);
    if (fRes.data) setFields(fRes.data);
    if (tRes.data) setTokens(tRes.data);
    if (cRes.data) setClaims(cRes.data);
  }

  function startEdit(p: Product) {
    setEditingProduct(p);
    setTitle(p.title);
    setDesc(p.description || "");
    setPrice(String(p.price));
    setStock(String(p.stock));
    setCategory(p.category || "");
    setNewFields(fields.filter(f => f.product_id === p.id).map(f => f.field_name));
    setImageFile(null);
  }

  function resetForm() {
    setEditingProduct(null);
    setTitle("");
    setDesc("");
    setPrice("");
    setStock("1");
    setCategory("");
    setNewFields(["Email", "Password", "No HP", "A2F"]);
    setImageFile(null);
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, imageFile);
    if (!error) {
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      return urlData.publicUrl;
    }
    return null;
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    const image_url = await uploadImage();

    if (editingProduct) {
      // Update existing
      const updateData: Record<string, unknown> = {
        title,
        description: desc || null,
        price: parseInt(price) || 0,
        stock: parseInt(stock) || 0,
        category: category || null,
      };
      if (image_url) updateData.image_url = image_url;

      await supabase.from("products").update(updateData).eq("id", editingProduct.id);

      // Update fields: delete old, insert new
      await supabase.from("product_fields").delete().eq("product_id", editingProduct.id);
      const fieldInserts = newFields.filter(Boolean).map((name, i) => ({
        product_id: editingProduct.id,
        field_name: name,
        field_order: i,
      }));
      if (fieldInserts.length > 0) await supabase.from("product_fields").insert(fieldInserts);

      toast({ title: "Produk diperbarui!" });
    } else {
      // Create new
      const { data: product, error } = await supabase.from("products").insert({
        title,
        description: desc || null,
        price: parseInt(price) || 0,
        stock: parseInt(stock) || 0,
        image_url,
        category: category || null,
      }).select().single();

      if (error || !product) {
        toast({ title: "Gagal menambah produk", variant: "destructive" });
        return;
      }

      const fieldInserts = newFields.filter(Boolean).map((name, i) => ({
        product_id: product.id,
        field_name: name,
        field_order: i,
      }));
      if (fieldInserts.length > 0) await supabase.from("product_fields").insert(fieldInserts);

      toast({ title: "Produk ditambahkan!" });
    }

    resetForm();
    fetchAll();
  }

  async function handleDeleteProduct(id: string) {
    await supabase.from("products").delete().eq("id", id);
    toast({ title: "Produk dihapus" });
    fetchAll();
  }

  async function handleAddTokens(e: React.FormEvent) {
    e.preventDefault();
    if (!selProduct) return;
    const count = Math.max(1, Math.min(50, parseInt(tokenCount) || 1));

    for (let c = 0; c < count; c++) {
      const code = generateVoucherCode();
      const { data: token, error } = await supabase.from("tokens").insert({
        product_id: selProduct,
        token_code: code,
      }).select().single();

      if (error || !token) continue;

      const productFields = fields.filter(f => f.product_id === selProduct);
      const fieldInserts = productFields.map(f => ({
        token_id: token.id,
        field_name: f.field_name,
        field_value: tokenFieldValues[f.field_name] || "",
      }));
      if (fieldInserts.length > 0) await supabase.from("token_fields").insert(fieldInserts);

      const prod = products.find(p => p.id === selProduct);
      if (prod && prod.stock > 0) {
        await supabase.from("products").update({ stock: prod.stock - 1 }).eq("id", selProduct);
      }
    }

    toast({ title: `${count} token dibuat!` });
    setTokenFieldValues({});
    fetchAll();
  }

  async function handleDeleteToken(id: string) {
    await supabase.from("token_fields").delete().eq("token_id", id);
    await supabase.from("tokens").delete().eq("id", id);
    toast({ title: "Token dihapus" });
    fetchAll();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/admin/login");
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Disalin!", description: text });
  }

  const selectedProductFields = fields.filter(f => f.product_id === selProduct);

  const sortedClaims = [...claims].sort((a, b) =>
    claimSort === "newest"
      ? new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime()
      : new Date(a.claimed_at).getTime() - new Date(b.claimed_at).getTime()
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-3 shadow-lg flex items-center justify-between">
        <h1 className="text-lg font-bold">Admin Panel</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:text-primary-foreground/80">
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </Button>
      </header>

      <div className="flex border-b border-border">
        {([
          { key: "products" as AdminTab, icon: Package, label: "Produk" },
          { key: "tokens" as AdminTab, icon: Ticket, label: "Token" },
          { key: "claims" as AdminTab, icon: Clock, label: "Klaim" },
        ]).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            <Icon className="w-4 h-4 inline mr-1" /> {label}
          </button>
        ))}
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {tab === "products" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
                  {editingProduct && (
                    <Button variant="ghost" size="sm" onClick={resetForm}><X className="w-4 h-4" /></Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProduct} className="space-y-3">
                  <Input placeholder="Judul Produk" value={title} onChange={e => setTitle(e.target.value)} required />
                  <Textarea placeholder="Deskripsi" value={desc} onChange={e => setDesc(e.target.value)} />
                  <Input placeholder="Kategori (misal: Netflix, Spotify)" value={category} onChange={e => setCategory(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Harga (Rp)" type="number" value={price} onChange={e => setPrice(e.target.value)} required />
                    <Input placeholder="Stok" type="number" value={stock} onChange={e => setStock(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Image className="w-3 h-3" /> Foto Produk</label>
                    <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                    {editingProduct?.image_url && !imageFile && (
                      <img src={editingProduct.image_url} className="w-16 h-16 rounded mt-2 object-cover" alt="" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Field Akun (custom)</label>
                    {newFields.map((f, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={f} onChange={e => { const c = [...newFields]; c[i] = e.target.value; setNewFields(c); }} placeholder="Nama field" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setNewFields(newFields.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setNewFields([...newFields, ""])}><Plus className="w-3 h-3 mr-1" /> Tambah Field</Button>
                  </div>
                  <Button className="w-full">{editingProduct ? "Update Produk" : "Simpan Produk"}</Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-bold text-sm">Daftar Produk ({products.length})</h3>
              {products.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {p.image_url && <img src={p.image_url} className="w-10 h-10 rounded object-cover" alt="" />}
                      <div>
                        <p className="font-semibold text-sm">{p.title}</p>
                        <p className="text-xs text-muted-foreground">Rp {p.price.toLocaleString()} • Stok: {p.stock}</p>
                        {p.category && <p className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full inline-block">{p.category}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(p)}><Edit2 className="w-4 h-4 text-primary" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {tab === "tokens" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Buat Token Baru</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAddTokens} className="space-y-3">
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selProduct} onChange={e => { setSelProduct(e.target.value); setTokenFieldValues({}); }} required>
                    <option value="">Pilih Produk</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.title} (Stok: {p.stock})</option>)}
                  </select>

                  <Input type="number" placeholder="Jumlah token" value={tokenCount} onChange={e => setTokenCount(e.target.value)} min="1" max="50" />

                  {selectedProductFields.map(f => (
                    <div key={f.id}>
                      <label className="text-xs text-muted-foreground">{f.field_name}</label>
                      <Input placeholder={f.field_name} value={tokenFieldValues[f.field_name] || ""} onChange={e => setTokenFieldValues({ ...tokenFieldValues, [f.field_name]: e.target.value })} />
                    </div>
                  ))}

                  <Button className="w-full" disabled={!selProduct}>Generate Token</Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-bold text-sm">Daftar Token ({tokens.length})</h3>
              {tokens.map(t => {
                const prod = products.find(p => p.id === t.product_id);
                return (
                  <Card key={t.id} className={t.is_claimed ? "opacity-60" : ""}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm font-bold">{t.token_code}</p>
                          <p className="text-xs text-muted-foreground">{prod?.title || "?"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_claimed ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>
                            {t.is_claimed ? "Diklaim" : "Tersedia"}
                          </span>
                          <button onClick={() => copyText(t.token_code)}><Copy className="w-4 h-4 text-muted-foreground hover:text-primary" /></button>
                          {!t.is_claimed && (
                            <button onClick={() => handleDeleteToken(t.id)}><Trash2 className="w-4 h-4 text-destructive/60 hover:text-destructive" /></button>
                          )}
                        </div>
                      </div>
                      {t.claimed_at && <p className="text-xs text-muted-foreground mt-1">Diklaim: {new Date(t.claimed_at).toLocaleString("id-ID")}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {tab === "claims" && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Riwayat Klaim ({claims.length})</h3>
              <div className="flex gap-2">
                <button onClick={() => setClaimSort("newest")} className={`text-xs px-3 py-1 rounded-full ${claimSort === "newest" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground"}`}>Terbaru</button>
                <button onClick={() => setClaimSort("oldest")} className={`text-xs px-3 py-1 rounded-full ${claimSort === "oldest" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground"}`}>Terlama</button>
              </div>
            </div>
            <div className="space-y-3">
              {sortedClaims.map(c => {
                const token = tokens.find(t => t.id === c.token_id);
                const prod = token ? products.find(p => p.id === token.product_id) : null;
                const deviceSummary = c.device_info ? getDeviceSummary(c.device_info) : "Tidak diketahui";

                return (
                  <Card key={c.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{prod?.title || "?"}</p>
                          <p className="font-mono text-xs text-muted-foreground">{token?.token_code || "?"}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(c.claimed_at).toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                        <Smartphone className="w-3.5 h-3.5 shrink-0" />
                        <span>{deviceSummary}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {sortedClaims.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada riwayat klaim</p>}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
