import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, LogOut, Package, Ticket, Copy, Image } from "lucide-react";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
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

type AdminTab = "products" | "tokens";

function generateToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `TKN-${seg()}-${seg()}`;
}

const AdminDashboard = () => {
  const [tab, setTab] = useState<AdminTab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [fields, setFields] = useState<ProductField[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);

  // New product form
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [newFields, setNewFields] = useState<string[]>(["Email", "Password", "No HP", "A2F"]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // New token form
  const [selProduct, setSelProduct] = useState("");
  const [tokenFieldValues, setTokenFieldValues] = useState<Record<string, string>>({});

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
    const [pRes, fRes, tRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_fields").select("*").order("field_order"),
      supabase.from("tokens").select("*").order("created_at", { ascending: false }),
    ]);
    if (pRes.data) setProducts(pRes.data);
    if (fRes.data) setFields(fRes.data);
    if (tRes.data) setTokens(tRes.data);
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    let image_url: string | null = null;

    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, imageFile);
      if (!error) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
    }

    const { data: product, error } = await supabase.from("products").insert({
      title,
      description: desc || null,
      price: parseInt(price) || 0,
      stock: parseInt(stock) || 0,
      image_url,
    }).select().single();

    if (error || !product) {
      toast({ title: "Gagal menambah produk", variant: "destructive" });
      return;
    }

    // Insert fields
    const fieldInserts = newFields.filter(Boolean).map((name, i) => ({
      product_id: product.id,
      field_name: name,
      field_order: i,
    }));
    if (fieldInserts.length > 0) {
      await supabase.from("product_fields").insert(fieldInserts);
    }

    toast({ title: "Produk ditambahkan!" });
    setTitle(""); setDesc(""); setPrice(""); setStock("1"); setImageFile(null);
    setNewFields(["Email", "Password", "No HP", "A2F"]);
    fetchAll();
  }

  async function handleDeleteProduct(id: string) {
    await supabase.from("products").delete().eq("id", id);
    toast({ title: "Produk dihapus" });
    fetchAll();
  }

  async function handleAddToken(e: React.FormEvent) {
    e.preventDefault();
    if (!selProduct) return;

    const code = generateToken();
    const { data: token, error } = await supabase.from("tokens").insert({
      product_id: selProduct,
      token_code: code,
    }).select().single();

    if (error || !token) {
      toast({ title: "Gagal membuat token", variant: "destructive" });
      return;
    }

    // Insert field values
    const productFields = fields.filter(f => f.product_id === selProduct);
    const fieldInserts = productFields.map(f => ({
      token_id: token.id,
      field_name: f.field_name,
      field_value: tokenFieldValues[f.field_name] || "",
    }));
    if (fieldInserts.length > 0) {
      await supabase.from("token_fields").insert(fieldInserts);
    }

    // Decrease stock
    const prod = products.find(p => p.id === selProduct);
    if (prod && prod.stock > 0) {
      await supabase.from("products").update({ stock: prod.stock - 1 }).eq("id", selProduct);
    }

    toast({ title: `Token dibuat: ${code}` });
    setTokenFieldValues({});
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-3 shadow-lg flex items-center justify-between">
        <h1 className="text-lg font-bold">Admin Panel</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:text-primary-foreground/80">
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </Button>
      </header>

      <div className="flex border-b border-border">
        <button onClick={() => setTab("products")} className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${tab === "products" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          <Package className="w-4 h-4 inline mr-1" /> Produk
        </button>
        <button onClick={() => setTab("tokens")} className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${tab === "tokens" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          <Ticket className="w-4 h-4 inline mr-1" /> Token
        </button>
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {tab === "products" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Tambah Produk Baru</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAddProduct} className="space-y-3">
                  <Input placeholder="Judul Produk" value={title} onChange={e => setTitle(e.target.value)} required />
                  <Textarea placeholder="Deskripsi" value={desc} onChange={e => setDesc(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Harga (Rp)" type="number" value={price} onChange={e => setPrice(e.target.value)} required />
                    <Input placeholder="Stok" type="number" value={stock} onChange={e => setStock(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Image className="w-3 h-3" /> Foto Produk
                    </label>
                    <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Field Akun (custom)</label>
                    {newFields.map((f, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={f}
                          onChange={e => {
                            const copy = [...newFields];
                            copy[i] = e.target.value;
                            setNewFields(copy);
                          }}
                          placeholder="Nama field"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setNewFields(newFields.filter((_, j) => j !== i))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setNewFields([...newFields, ""])}>
                      <Plus className="w-3 h-3 mr-1" /> Tambah Field
                    </Button>
                  </div>

                  <Button className="w-full">Simpan Produk</Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-bold text-sm">Daftar Produk ({products.length})</h3>
              {products.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {p.image_url && <img src={p.image_url} className="w-10 h-10 rounded object-cover" />}
                      <div>
                        <p className="font-semibold text-sm">{p.title}</p>
                        <p className="text-xs text-muted-foreground">Rp {p.price.toLocaleString()} • Stok: {p.stock}</p>
                        <p className="text-xs text-muted-foreground">
                          Fields: {fields.filter(f => f.product_id === p.id).map(f => f.field_name).join(", ")}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
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
                <form onSubmit={handleAddToken} className="space-y-3">
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selProduct}
                    onChange={e => { setSelProduct(e.target.value); setTokenFieldValues({}); }}
                    required
                  >
                    <option value="">Pilih Produk</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.title} (Stok: {p.stock})</option>
                    ))}
                  </select>

                  {selectedProductFields.map(f => (
                    <div key={f.id}>
                      <label className="text-xs text-muted-foreground">{f.field_name}</label>
                      <Input
                        placeholder={f.field_name}
                        value={tokenFieldValues[f.field_name] || ""}
                        onChange={e => setTokenFieldValues({ ...tokenFieldValues, [f.field_name]: e.target.value })}
                      />
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
                          <button onClick={() => copyText(t.token_code)}>
                            <Copy className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          </button>
                        </div>
                      </div>
                      {t.claimed_at && (
                        <p className="text-xs text-muted-foreground mt-1">Diklaim: {new Date(t.claimed_at).toLocaleString("id-ID")}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;