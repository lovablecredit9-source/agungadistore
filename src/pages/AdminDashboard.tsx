import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, LogOut, Package, Ticket, Copy, Image, Edit2, X,
  Smartphone, Clock, ChevronLeft, ChevronRight, Search, Send,
  MessageCircle, AlertCircle, ImagePlus, Shield, Wallet, Users, ArrowUpCircle
} from "lucide-react";
import { generateVoucherCode } from "@/lib/voucher-code";
import { getDeviceSummary } from "@/lib/device-info";
import { STORE_NAME } from "@/lib/social-links";
import storeQris from "@/assets/store-qris.jpg";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
  has_warranty: boolean;
}

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  image_order: number;
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

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface SupportTicket {
  id: string;
  ticket_number: number;
  name: string;
  phone: string;
  description: string;
  status: string;
  created_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
}

interface ProductChat {
  id: string;
  product_id: string;
  visitor_name: string;
  visitor_id: string;
  status: string;
  created_at: string;
}

interface ProductChatMessage {
  id: string;
  chat_id: string;
  sender_type: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
}

interface UserBalance {
  id: string;
  visitor_id: string;
  username: string;
  phone: string;
  balance: number;
}

type AdminTab = "products" | "tokens" | "claims" | "tickets" | "chats" | "saldo";
type ClaimDateFilter = "all" | "today" | "yesterday" | "lastmonth" | "custom";

const AdminDashboard = () => {
  const [tab, setTab] = useState<AdminTab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
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
  const [hasWarranty, setHasWarranty] = useState(false);
  const [newFields, setNewFields] = useState<string[]>(["Email", "Password", "No HP", "A2F"]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Token form
  const [selProduct, setSelProduct] = useState("");
  const [tokenFieldValues, setTokenFieldValues] = useState<Record<string, string>>({});
  const [tokenCount, setTokenCount] = useState("1");

  // Claims
  const [claimSort, setClaimSort] = useState<"newest" | "oldest">("newest");
  const [claimDateFilter, setClaimDateFilter] = useState<ClaimDateFilter>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [claimPage, setClaimPage] = useState(1);
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(new Set());
  const CLAIMS_PER_PAGE = 5;

  // Tickets
  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [ticketMsg, setTicketMsg] = useState("");
  const ticketChatRef = useRef<HTMLDivElement>(null);

  // Product Chats
  const [allChats, setAllChats] = useState<ProductChat[]>([]);
  const [activeChat, setActiveChat] = useState<ProductChat | null>(null);
  const [chatMessages, setChatMessages] = useState<ProductChatMessage[]>([]);
  const [chatMsg, setChatMsg] = useState("");
  // User Balances
  const [userBalances, setUserBalances] = useState<UserBalance[]>([]);
  const [topupVisitorId, setTopupVisitorId] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupDesc, setTopupDesc] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    checkAuth();
    fetchAll();
    fetchTickets();
    fetchChats();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/admin/login");
  }

  async function fetchAll() {
    const [pRes, piRes, fRes, tRes, cRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_images").select("*").order("image_order"),
      supabase.from("product_fields").select("*").order("field_order"),
      supabase.from("tokens").select("*").order("created_at", { ascending: false }),
      supabase.from("token_claims").select("*").order("claimed_at", { ascending: false }),
    ]);
    if (pRes.data) setProducts(pRes.data as unknown as Product[]);
    if (piRes.data) setProductImages(piRes.data as ProductImage[]);
    if (fRes.data) setFields(fRes.data);
    if (tRes.data) setTokens(tRes.data);
    if (cRes.data) setClaims(cRes.data);
  }

  async function fetchTickets() {
    const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (data) setAllTickets(data as unknown as SupportTicket[]);
  }

  async function fetchChats() {
    const { data } = await supabase.from("product_chats").select("*").order("created_at", { ascending: false });
    if (data) setAllChats(data as unknown as ProductChat[]);
  }

  function getProductImages(productId: string): string[] {
    const imgs = productImages.filter(i => i.product_id === productId).map(i => i.image_url);
    const product = products.find(p => p.id === productId);
    if (imgs.length === 0 && product?.image_url) return [product.image_url];
    return imgs;
  }

  function clearPendingImages() {
    setPendingImages((prev) => { prev.forEach((image) => URL.revokeObjectURL(image.previewUrl)); return []; });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addPendingImages(files: FileList | File[]) {
    const nextFiles = Array.from(files ?? []);
    if (nextFiles.length === 0) return;
    setPendingImages((prev) => [
      ...prev,
      ...nextFiles.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`, file, previewUrl: URL.createObjectURL(file),
      })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingImage(imageId: string) {
    setPendingImages((prev) => {
      const img = prev.find((i) => i.id === imageId);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter((i) => i.id !== imageId);
    });
  }

  function startEdit(p: Product) {
    setEditingProduct(p);
    setTitle(p.title);
    setDesc(p.description || "");
    setPrice(String(p.price));
    setStock(String(p.stock));
    setCategory(p.category || "");
    setHasWarranty(p.has_warranty || false);
    setNewFields(fields.filter(f => f.product_id === p.id).map(f => f.field_name));
    clearPendingImages();
  }

  function resetForm() {
    setEditingProduct(null);
    setTitle(""); setDesc(""); setPrice(""); setStock("1"); setCategory(""); setHasWarranty(false);
    setNewFields(["Email", "Password", "No HP", "A2F"]); clearPendingImages();
  }

  async function uploadImages(): Promise<string[]> {
    const urls: string[] = [];
    for (const { file } of pendingImages) {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
    }
    return urls;
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    const uploadedUrls = await uploadImages();

    if (editingProduct) {
      const updateData: Record<string, unknown> = {
        title, description: desc || null, price: parseInt(price) || 0,
        stock: parseInt(stock) || 0, category: category || null, has_warranty: hasWarranty,
      };
      if (uploadedUrls.length > 0) updateData.image_url = uploadedUrls[0];
      await supabase.from("products").update(updateData).eq("id", editingProduct.id);

      if (uploadedUrls.length > 0) {
        const existingImgs = productImages.filter(i => i.product_id === editingProduct.id);
        const startOrder = existingImgs.length;
        await supabase.from("product_images").insert(uploadedUrls.map((url, i) => ({
          product_id: editingProduct.id, image_url: url, image_order: startOrder + i,
        })));
      }

      await supabase.from("product_fields").delete().eq("product_id", editingProduct.id);
      const fieldInserts = newFields.filter(Boolean).map((name, i) => ({
        product_id: editingProduct.id, field_name: name, field_order: i,
      }));
      if (fieldInserts.length > 0) await supabase.from("product_fields").insert(fieldInserts);
      toast({ title: "Produk diperbarui!" });
    } else {
      const { data: product, error } = await supabase.from("products").insert({
        title, description: desc || null, price: parseInt(price) || 0,
        stock: parseInt(stock) || 0, image_url: uploadedUrls[0] || null,
        category: category || null, has_warranty: hasWarranty,
      }).select().single();

      if (error || !product) { toast({ title: "Gagal menambah produk", variant: "destructive" }); return; }

      if (uploadedUrls.length > 0) {
        await supabase.from("product_images").insert(uploadedUrls.map((url, i) => ({
          product_id: product.id, image_url: url, image_order: i,
        })));
      }

      const fieldInserts = newFields.filter(Boolean).map((name, i) => ({
        product_id: product.id, field_name: name, field_order: i,
      }));
      if (fieldInserts.length > 0) await supabase.from("product_fields").insert(fieldInserts);
      toast({ title: "Produk ditambahkan!" });
    }
    resetForm(); fetchAll();
  }

  async function handleDeleteProduct(id: string) {
    await supabase.from("product_images").delete().eq("product_id", id);
    await supabase.from("products").delete().eq("id", id);
    toast({ title: "Produk dihapus" }); fetchAll();
  }

  async function handleDeleteProductImage(imgId: string) {
    await supabase.from("product_images").delete().eq("id", imgId);
    toast({ title: "Foto dihapus" }); fetchAll();
  }

  async function handleAddTokens(e: React.FormEvent) {
    e.preventDefault();
    if (!selProduct) return;
    const count = Math.max(1, Math.min(50, parseInt(tokenCount) || 1));

    for (let c = 0; c < count; c++) {
      const code = generateVoucherCode();
      const { data: token, error } = await supabase.from("tokens").insert({
        product_id: selProduct, token_code: code,
      }).select().single();
      if (error || !token) continue;

      const productFields = fields.filter(f => f.product_id === selProduct);
      const fieldInserts = productFields.map(f => ({
        token_id: token.id, field_name: f.field_name, field_value: tokenFieldValues[f.field_name] || "",
      }));
      if (fieldInserts.length > 0) await supabase.from("token_fields").insert(fieldInserts);

      const prod = products.find(p => p.id === selProduct);
      if (prod && prod.stock > 0) {
        await supabase.from("products").update({ stock: prod.stock - 1 }).eq("id", selProduct);
      }
    }
    toast({ title: `${count} token dibuat!` });
    setTokenFieldValues({}); fetchAll();
  }

  async function handleDeleteToken(id: string) {
    await supabase.from("token_fields").delete().eq("token_id", id);
    await supabase.from("tokens").delete().eq("id", id);
    toast({ title: "Token dihapus" }); fetchAll();
  }

  async function handleDeleteClaim(id: string) {
    await supabase.from("token_claims").delete().eq("id", id);
    toast({ title: "Klaim dihapus" }); fetchAll();
  }

  function toggleClaimSelect(id: string) {
    const s = new Set(selectedClaimIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedClaimIds(s);
  }

  function toggleSelectAllClaims() {
    const fc = getFilteredClaims();
    if (selectedClaimIds.size === fc.length && fc.length > 0) {
      setSelectedClaimIds(new Set());
    } else {
      setSelectedClaimIds(new Set(fc.map(c => c.id)));
    }
  }

  async function deleteSelectedClaims() {
    for (const id of selectedClaimIds) {
      await supabase.from("token_claims").delete().eq("id", id);
    }
    toast({ title: `${selectedClaimIds.size} klaim dihapus` });
    setSelectedClaimIds(new Set());
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

  // === TICKET FUNCTIONS ===
  async function loadTicketMessages(ticketId: string) {
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at");
    if (data) setTicketMessages(data as unknown as TicketMessage[]);
    setTimeout(() => ticketChatRef.current?.scrollTo(0, ticketChatRef.current.scrollHeight), 100);
  }

  async function sendTicketMessage() {
    if (!ticketMsg.trim() || !activeTicket) return;
    await supabase.from("ticket_messages").insert({
      ticket_id: activeTicket.id, sender_type: "admin", message: ticketMsg.trim(),
    });
    setTicketMsg("");
  }

  async function sendTicketImage(file: File) {
    if (!activeTicket) return;
    const ext = file.name.split(".").pop();
    const path = `tickets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast({ title: "Gagal upload", variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
    await supabase.from("ticket_messages").insert({
      ticket_id: activeTicket.id, sender_type: "admin", image_url: urlData.publicUrl,
    });
  }

  async function toggleTicketStatus(ticket: SupportTicket) {
    const newStatus = ticket.status === "open" ? "closed" : "open";
    await supabase.from("support_tickets").update({ status: newStatus }).eq("id", ticket.id);
    toast({ title: `Tiket ${newStatus === "open" ? "dibuka" : "ditutup"}` });
    fetchTickets();
    if (activeTicket?.id === ticket.id) setActiveTicket({ ...ticket, status: newStatus });
  }

  // Realtime ticket messages
  useEffect(() => {
    if (!activeTicket) return;
    loadTicketMessages(activeTicket.id);
    const channel = supabase.channel(`admin-ticket-${activeTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${activeTicket.id}` },
        (payload) => {
          setTicketMessages(prev => [...prev, payload.new as unknown as TicketMessage]);
          setTimeout(() => ticketChatRef.current?.scrollTo(0, ticketChatRef.current.scrollHeight), 100);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTicket?.id]);

  // Realtime new tickets
  useEffect(() => {
    const ch = supabase.channel("admin-tickets-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => fetchTickets())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // === PRODUCT CHAT FUNCTIONS ===
  async function loadChatMessages(chatId: string) {
    const { data } = await supabase.from("product_chat_messages").select("*").eq("chat_id", chatId).order("created_at");
    if (data) setChatMessages(data as unknown as ProductChatMessage[]);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  }

  async function sendChatMessage() {
    if (!chatMsg.trim() || !activeChat) return;
    await supabase.from("product_chat_messages").insert({
      chat_id: activeChat.id, sender_type: "admin", message: chatMsg.trim(),
    });
    setChatMsg("");
  }

  async function sendChatImage(file: File) {
    if (!activeChat) return;
    const ext = file.name.split(".").pop();
    const path = `chats/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast({ title: "Gagal upload", variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
    await supabase.from("product_chat_messages").insert({
      chat_id: activeChat.id, sender_type: "admin", image_url: urlData.publicUrl,
    });
  }

  useEffect(() => {
    if (!activeChat) return;
    loadChatMessages(activeChat.id);
    const channel = supabase.channel(`admin-chat-${activeChat.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "product_chat_messages", filter: `chat_id=eq.${activeChat.id}` },
        (payload) => {
          setChatMessages(prev => [...prev, payload.new as unknown as ProductChatMessage]);
          setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChat?.id]);

  useEffect(() => {
    const ch = supabase.channel("admin-chats-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_chats" }, () => fetchChats())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const selectedProductFields = fields.filter(f => f.product_id === selProduct);

  const filteredProducts = products.filter(p =>
    p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(productSearch.toLowerCase())
  );

  function getFilteredClaims() {
    let filtered = [...claims];
    const now = new Date();

    if (claimDateFilter === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(c => new Date(c.claimed_at) >= start);
    } else if (claimDateFilter === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(c => { const d = new Date(c.claimed_at); return d >= start && d < end; });
    } else if (claimDateFilter === "lastmonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(c => { const d = new Date(c.claimed_at); return d >= start && d < end; });
    } else if (claimDateFilter === "custom" && customDateFrom && customDateTo) {
      const start = new Date(customDateFrom);
      const end = new Date(customDateTo); end.setDate(end.getDate() + 1);
      filtered = filtered.filter(c => { const d = new Date(c.claimed_at); return d >= start && d < end; });
    }

    return filtered.sort((a, b) =>
      claimSort === "newest"
        ? new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime()
        : new Date(a.claimed_at).getTime() - new Date(b.claimed_at).getTime()
    );
  }

  const filteredClaims = getFilteredClaims();
  const totalClaimPages = Math.ceil(filteredClaims.length / CLAIMS_PER_PAGE);
  const paginatedClaims = filteredClaims.slice((claimPage - 1) * CLAIMS_PER_PAGE, claimPage * CLAIMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-3 shadow-lg flex items-center justify-between">
        <h1 className="text-lg font-bold">Admin Panel</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:text-primary-foreground/80">
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </Button>
      </header>

      <div className="flex border-b border-border overflow-x-auto">
        {([
          { key: "products" as AdminTab, icon: Package, label: "Produk" },
          { key: "tokens" as AdminTab, icon: Ticket, label: "Token" },
          { key: "claims" as AdminTab, icon: Clock, label: "Klaim" },
          { key: "tickets" as AdminTab, icon: AlertCircle, label: "Tiket" },
          { key: "chats" as AdminTab, icon: MessageCircle, label: "Chat" },
        ]).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors whitespace-nowrap px-2 ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            <Icon className="w-4 h-4 inline mr-1" /> {label}
            {key === "tickets" && allTickets.filter(t => t.status === "open").length > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0.5 rounded-full">{allTickets.filter(t => t.status === "open").length}</span>
            )}
            {key === "chats" && allChats.filter(c => c.status === "open").length > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0.5 rounded-full">{allChats.filter(c => c.status === "open").length}</span>
            )}
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
                  {editingProduct && <Button variant="ghost" size="sm" onClick={resetForm}><X className="w-4 h-4" /></Button>}
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

                  {/* Warranty toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={hasWarranty} onCheckedChange={(v) => setHasWarranty(!!v)} />
                    <span className="text-sm flex items-center gap-1"><Shield className="w-4 h-4 text-primary" /> Garansi Akun</span>
                  </label>

                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Image className="w-3 h-3" /> Foto Produk</label>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => { if (e.target.files) addPendingImages(e.target.files); }} />
                    <div className="flex gap-2 items-center">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Plus className="w-4 h-4 mr-1" /> Tambah Foto
                      </Button>
                      {pendingImages.length > 0 && <p className="text-xs text-muted-foreground">{pendingImages.length} foto baru</p>}
                    </div>
                    {pendingImages.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {pendingImages.map((image) => (
                          <div key={image.id} className="relative">
                            <img src={image.previewUrl} className="w-16 h-16 rounded object-cover border border-border" alt="" />
                            <button type="button" onClick={() => removePendingImage(image.id)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {editingProduct && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {getProductImages(editingProduct.id).map((url, i) => {
                          const imgRecord = productImages.find(pi => pi.image_url === url);
                          return (
                            <div key={i} className="relative">
                              <img src={url} className="w-16 h-16 rounded object-cover" alt="" />
                              <button type="button"
                                onClick={async () => {
                                  if (imgRecord) { await handleDeleteProductImage(imgRecord.id); }
                                  else { await supabase.from("products").update({ image_url: null }).eq("id", editingProduct.id); toast({ title: "Foto dihapus" }); fetchAll(); }
                                }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cari produk..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-9" />
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-sm">Daftar Produk ({filteredProducts.length})</h3>
              {filteredProducts.map(p => {
                const imgs = getProductImages(p.id);
                return (
                  <Card key={p.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {imgs.length > 0 && <img src={imgs[0]} className="w-10 h-10 rounded object-cover" alt="" />}
                        <div>
                          <p className="font-semibold text-sm">{p.title}</p>
                          <p className="text-xs text-muted-foreground">Rp {p.price.toLocaleString()} • Stok: {p.stock}</p>
                          <div className="flex gap-1 mt-0.5">
                            {p.category && <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{p.category}</span>}
                            {p.has_warranty && <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-full"><Shield className="w-2.5 h-2.5 inline" /> Garansi</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(p)}><Edit2 className="w-4 h-4 text-primary" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                          {!t.is_claimed && <button onClick={() => handleDeleteToken(t.id)}><Trash2 className="w-4 h-4 text-destructive/60 hover:text-destructive" /></button>}
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
              <h3 className="font-bold text-sm">Riwayat Klaim ({filteredClaims.length})</h3>
              <div className="flex gap-2">
                <button onClick={() => setClaimSort("newest")} className={`text-xs px-3 py-1 rounded-full ${claimSort === "newest" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground"}`}>Terbaru</button>
                <button onClick={() => setClaimSort("oldest")} className={`text-xs px-3 py-1 rounded-full ${claimSort === "oldest" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground"}`}>Terlama</button>
              </div>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: "all" as ClaimDateFilter, label: "Semua" },
                { key: "today" as ClaimDateFilter, label: "Hari Ini" },
                { key: "yesterday" as ClaimDateFilter, label: "Kemarin" },
                { key: "lastmonth" as ClaimDateFilter, label: "Bulan Lalu" },
                { key: "custom" as ClaimDateFilter, label: "Custom" },
              ]).map(({ key, label }) => (
                <button key={key} onClick={() => { setClaimDateFilter(key); setClaimPage(1); }}
                  className={`text-xs px-3 py-1.5 rounded-full transition-all ${claimDateFilter === key ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"}`}>
                  {label}
                </button>
              ))}
            </div>
            {claimDateFilter === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={customDateFrom} onChange={e => { setCustomDateFrom(e.target.value); setClaimPage(1); }} />
                <Input type="date" value={customDateTo} onChange={e => { setCustomDateTo(e.target.value); setClaimPage(1); }} />
              </div>
            )}

            {/* Select all + delete */}
            {filteredClaims.length > 0 && (
              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" onClick={toggleSelectAllClaims} className="gap-1 text-xs">
                  <Checkbox checked={filteredClaims.length > 0 && selectedClaimIds.size === filteredClaims.length} className="pointer-events-none" />
                  Pilih Semua ({selectedClaimIds.size})
                </Button>
                {selectedClaimIds.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={deleteSelectedClaims} className="gap-1 text-xs">
                    <Trash2 className="w-3 h-3" /> Hapus ({selectedClaimIds.size})
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-3">
              {paginatedClaims.map(c => {
                const token = tokens.find(t => t.id === c.token_id);
                const prod = token ? products.find(p => p.id === token.product_id) : null;
                const deviceSummary = c.device_info ? getDeviceSummary(c.device_info) : "Tidak diketahui";
                const prodImgs = prod ? getProductImages(prod.id) : [];

                return (
                  <Card key={c.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={selectedClaimIds.has(c.id)} onCheckedChange={() => toggleClaimSelect(c.id)} />
                          {prodImgs.length > 0 && <img src={prodImgs[0]} className="w-8 h-8 rounded object-cover" alt="" />}
                          <div>
                            <p className="font-semibold text-sm">{prod?.title || "?"}</p>
                            <p className="font-mono text-xs text-muted-foreground">{token?.token_code || "?"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{new Date(c.claimed_at).toLocaleString("id-ID")}</span>
                          <button onClick={() => handleDeleteClaim(c.id)}><Trash2 className="w-4 h-4 text-destructive/60 hover:text-destructive" /></button>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                        <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="leading-relaxed break-words">{deviceSummary}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {paginatedClaims.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Tidak ada riwayat klaim</p>}
            </div>

            {totalClaimPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="icon" disabled={claimPage <= 1} onClick={() => setClaimPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-sm text-muted-foreground">{claimPage} / {totalClaimPages}</span>
                <Button variant="outline" size="icon" disabled={claimPage >= totalClaimPages} onClick={() => setClaimPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            )}
          </>
        )}

        {tab === "tickets" && (
          <>
            {!activeTicket ? (
              <>
                <h3 className="font-bold text-sm">Tiket Keluhan ({allTickets.length})</h3>
                {allTickets.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada tiket</p>}
                {allTickets.map(t => (
                  <Card key={t.id} className="cursor-pointer hover:shadow-lg transition-all" onClick={() => setActiveTicket(t)}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-primary">Tiket #{t.ticket_number}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.status === "open" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                            {t.status === "open" ? "Terbuka" : "Ditutup"}
                          </span>
                          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={(e) => { e.stopPropagation(); toggleTicketStatus(t); }}>
                            {t.status === "open" ? "Tutup" : "Buka"}
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p><strong>Nama:</strong> {t.name}</p>
                        <p><strong>HP:</strong> {t.phone}</p>
                        <p className="line-clamp-1"><strong>Masalah:</strong> {t.description}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString("id-ID")}</p>
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setActiveTicket(null)}><ChevronLeft className="w-5 h-5" /></Button>
                  <div className="flex-1">
                    <h2 className="text-sm font-extrabold">Tiket #{activeTicket.ticket_number}</h2>
                    <p className="text-[10px] text-muted-foreground">{activeTicket.name} • {activeTicket.phone}</p>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => toggleTicketStatus(activeTicket)}>
                    {activeTicket.status === "open" ? "Tutup Tiket" : "Buka Tiket"}
                  </Button>
                </div>

                <div ref={ticketChatRef} className="bg-muted/30 rounded-xl p-3 space-y-3 max-h-[55vh] overflow-y-auto">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs space-y-1">
                    <p><strong>Nama:</strong> {activeTicket.name}</p>
                    <p><strong>HP:</strong> {activeTicket.phone}</p>
                    <p><strong>Masalah:</strong> {activeTicket.description}</p>
                    <p className="text-muted-foreground">{new Date(activeTicket.created_at).toLocaleString("id-ID")}</p>
                  </div>

                  {ticketMessages.map(m => (
                    <div key={m.id} className={`flex ${m.sender_type === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.sender_type === "admin" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"}`}>
                        {m.sender_type === "admin" && <p className="text-[10px] font-bold mb-0.5">Admin</p>}
                        {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                        {m.image_url && <img src={m.image_url} className="max-w-full rounded-lg mt-1" alt="" />}
                        <p className={`text-[9px] mt-1 ${m.sender_type === "admin" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <label className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80">
                    <ImagePlus className="w-4 h-4 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) sendTicketImage(e.target.files[0]); e.target.value = ""; }} />
                  </label>
                  <Input placeholder="Balas tiket..." value={ticketMsg} onChange={e => setTicketMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTicketMessage(); } }} className="flex-1" />
                  <Button size="icon" onClick={sendTicketMessage} disabled={!ticketMsg.trim()}><Send className="w-4 h-4" /></Button>
                </div>
              </>
            )}
          </>
        )}

        {tab === "chats" && (
          <>
            {!activeChat ? (
              <>
                <h3 className="font-bold text-sm">Chat Produk ({allChats.length})</h3>
                {allChats.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada chat</p>}
                {allChats.map(ch => {
                  const prod = products.find(p => p.id === ch.product_id);
                  const prodImgs = prod ? getProductImages(prod.id) : [];
                  return (
                    <Card key={ch.id} className="cursor-pointer hover:shadow-lg transition-all" onClick={() => setActiveChat(ch)}>
                      <CardContent className="p-3 flex items-center gap-3">
                        {prodImgs.length > 0 && <img src={prodImgs[0]} className="w-10 h-10 rounded-lg object-cover" alt="" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{prod?.title || "Produk"}</p>
                          <p className="text-[10px] text-muted-foreground">ID: {ch.visitor_id.slice(0, 8)}...</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(ch.created_at).toLocaleString("id-ID")}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${ch.status === "open" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                          {ch.status === "open" ? "Aktif" : "Ditutup"}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setActiveChat(null)}><ChevronLeft className="w-5 h-5" /></Button>
                  <div className="flex-1">
                    <h2 className="text-sm font-extrabold">{products.find(p => p.id === activeChat.product_id)?.title || "Chat"}</h2>
                    <p className="text-[10px] text-muted-foreground">Pengunjung: {activeChat.visitor_id.slice(0, 8)}...</p>
                  </div>
                </div>

                <div ref={chatRef} className="bg-muted/30 rounded-xl p-3 space-y-3 max-h-[55vh] overflow-y-auto">
                  {chatMessages.map(m => (
                    <div key={m.id} className={`flex ${m.sender_type === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.sender_type === "admin" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"}`}>
                        {m.sender_type === "admin" && <p className="text-[10px] font-bold mb-0.5">Admin</p>}
                        {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                        {m.image_url && <img src={m.image_url} className="max-w-full rounded-lg mt-1" alt="" />}
                        <p className={`text-[9px] mt-1 ${m.sender_type === "admin" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <label className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80">
                    <ImagePlus className="w-4 h-4 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) sendChatImage(e.target.files[0]); e.target.value = ""; }} />
                  </label>
                  <Input placeholder="Balas chat..." value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }} className="flex-1" />
                  <Button size="icon" onClick={sendChatMessage} disabled={!chatMsg.trim()}><Send className="w-4 h-4" /></Button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
