import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Check, CheckCircle2, ChevronRight, Clock3, Copy, ExternalLink, Flag, Heart,
  Minus, MessageCircle, Package, Plus, Search, Settings, Share2, ShoppingBag, ShoppingCart,
  Star, Store, Trash2, WalletCards, XCircle, Zap,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import SellerDashboard from "@/components/SellerDashboard";
import SellerRegistrationTab from "@/components/SellerRegistrationTab";
import AccountAvatar from "@/components/AccountAvatar";
import MarketplaceReviews from "@/components/seller/MarketplaceReviews";
import { orderCode } from "@/components/seller/orderCode";
import StoreChat, { startStoreChat } from "@/components/seller/StoreChat";
import { calcCheckout } from "@/components/seller/fees";
import { SellerVerifiedBadge } from "@/components/seller/SellerVerifiedBadge";
import { useMarketSignal } from "@/hooks/useMarketSignal";
import DisputeRoom from "@/components/seller/DisputeRoom";
import StoreProfile from "@/components/seller/StoreProfile";

const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");
type Tab = "produk" | "chat" | "keranjang" | "pesanan" | "pengaturan";
type OrderFilter = "semua" | "dibayar" | "diproses" | "dikirim" | "selesai" | "dibatalkan";
const invoke = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("seller-shop", { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg || "Permintaan gagal");
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

export default function SellerCommerceHub({ visitorId }: { visitorId?: string | null }) {
  const vid = visitorId || getVisitorId();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("produk");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<Record<string, any>>({});
  const [flashes, setFlashes] = useState<any[]>([]);
  const [extras, setExtras] = useState<any>({ wishlist: [], followed: [], recent: [], reviews: [], vouchers: [] });
  const [productReviews, setProductReviews] = useState<any[] | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [username, setUsername] = useState("Pembeli");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [purchaseDialog, setPurchaseDialog] = useState<{ product: any; mode: "cart" | "buy" } | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [chatRole, setChatRole] = useState<"buyer" | "seller">("buyer");
  const [chatOpenId, setChatOpenId] = useState<string | null>(null);
  const [selectedCart, setSelectedCart] = useState<string[]>([]);
  const [checkoutStore, setCheckoutStore] = useState<string | null>(null);
  const [buyerNote, setBuyerNote] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPay, setConfirmPay] = useState(false);
  const [sending, setSending] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("semua");
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [reportProduct, setReportProduct] = useState<any>(null);
  const [reportReason, setReportReason] = useState("Produk tidak sesuai");
  const [reportDetail, setReportDetail] = useState("");
  const [reviewOrder, setReviewOrder] = useState<any>(null);
  const [stars, setStars] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const [storeReviews, setStoreReviews] = useState<any[]>([]);
  const [storeReviewsLoading, setStoreReviewsLoading] = useState(false);
  const [disputeOrder, setDisputeOrder] = useState<any>(null);
  const [disputeReason, setDisputeReason] = useState("Produk tidak sesuai");
  const [disputeDetail, setDisputeDetail] = useState("");
  const [disputeEvidence, setDisputeEvidence] = useState("");
  const [disputeCase, setDisputeCase] = useState<any>(null);
  const [caseMessages, setCaseMessages] = useState<any[]>([]);
  const [caseText, setCaseText] = useState("");
  const [now, setNow] = useState(Date.now());
  const [pinOpen, setPinOpen] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [successInfo, setSuccessInfo] = useState<any>(null);
  const [serverSkew, setServerSkew] = useState(0);
  const [reviewPhoto, setReviewPhoto] = useState("");
  const [loginPrompt, setLoginPrompt] = useState(false);
  const isLoggedIn = () => localStorage.getItem("balance_logged_in") === "true" && localStorage.getItem("balance_visitor_id") === vid;
  // Wajib login akun saldo sebelum membeli; pilihan disimpan agar bisa dilanjutkan setelah login
  const requireLogin = (intent: Record<string, unknown>) => {
    if (isLoggedIn()) return true;
    sessionStorage.setItem("market_pending_intent", JSON.stringify({ ...intent, at: Date.now() }));
    setLoginPrompt(true);
    return false;
  };
  const goLogin = (mode: "login" | "register") => { setLoginPrompt(false); window.dispatchEvent(new CustomEvent("market-login-request", { detail: { mode } })); };
  const cartTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingCart = useRef<Set<string>>(new Set());
  const roleInit = useRef(false);

  const isSeller = useMemo(() => Object.values(stores).some((s: any) => s.visitor_id === vid), [stores, vid]);
  useEffect(() => { if (isSeller && !roleInit.current) { roleInit.current = true; setChatRole("seller"); } }, [isSeller]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const load = async () => {
    try {
      const [catalog, mine] = await Promise.all([
        invoke({ action: "buyer_catalog", visitorId: vid }),
        invoke({ action: "buyer_data", visitorId: vid }),
      ]);
      const map: Record<string, any> = {};
      for (const store of catalog.stores || []) map[store.id] = store;
      setProducts(catalog.products || []); setStores(map); setFlashes(catalog.flashes || []); setExtras(catalog.extras || {});
      const prodList = catalog.products || [];
      setCart((old) => (mine.cart || []).map((c: any) => { const product = prodList.find((p: any) => p.id === c.product_id); const local = old.find((x) => x.product_id === c.product_id); const qty = pendingCart.current.has(c.product_id) && local ? local.qty : c.qty; return { ...c, qty: product ? Math.max(1, Math.min(qty, Number(product.stock || 0) || qty)) : qty, product }; }));
      setOrders(mine.orders || []); setBalance(Number(mine.balance || 0)); setUsername(mine.username || "Pembeli");
      setHasPin(mine.hasPin ?? null); if (mine.serverNow) setServerSkew(new Date(mine.serverNow).getTime() - Date.now());
      setSelectedProduct((cur: any) => cur ? (prodList.find((p: any) => p.id === cur.id) || cur) : cur);
      setSelectedStore((cur: any) => cur ? (map[cur.id] || cur) : cur);
      setOrderDetail((cur: any) => cur ? ((mine.orders || []).find((o: any) => o.id === cur.id) || cur) : cur);
    } catch (e: any) { toast({ title: "Marketplace gagal dimuat", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [vid]);
  useMarketSignal(["catalog", vid], () => { load(); if (disputeCase?.order_id) loadCase({ id: disputeCase.order_id }); if (selectedProduct) invoke({ action: "buyer_catalog", visitorId: vid, productId: selectedProduct.id, storeId: selectedProduct.store_id }).then((d) => setExtras(d.extras || {})).catch(() => {}); });

  useEffect(() => {
    const q = new URLSearchParams(location.search); const pid = q.get("product"); const sid = q.get("store");
    if (!products.length) return;
    if (pid) openProduct(products.find((p) => p.id === pid));
    else if (sid) openStore(stores[sid]);
  }, [products.length]);
  useEffect(() => {
    if (loading || !products.length || !isLoggedIn()) return;
    const raw = sessionStorage.getItem("market_pending_intent"); if (!raw) return;
    sessionStorage.removeItem("market_pending_intent");
    try {
      const it = JSON.parse(raw); if (Date.now() - Number(it.at || 0) > 3600_000) return;
      if (it.type === "product") { const p = products.find((x) => x.id === it.productId); if (!p) return; openProduct(p).then(() => { setDetailQty(Math.max(1, Math.min(Number(it.qty || 1), Number(p.stock || 1)))); setPurchaseDialog({ product: p, mode: it.mode === "buy" ? "buy" : "cart" }); }); }
      else { setTab("keranjang"); if (it.storeId) setCheckoutStore(it.storeId); }
      toast({ title: "Login berhasil", description: "Lanjutkan pembelianmu." });
    } catch { /* abaikan data rusak */ }
  }, [loading, products.length, vid]);
  useEffect(() => {
    const go = (e: any) => { const value = e?.detail?.tab as Tab; if (value) setTab(value); };
    window.addEventListener("seller-go-tab", go); return () => window.removeEventListener("seller-go-tab", go);
  }, []);

  const liveFlash = (id: string) => flashes.find((f) => f.product_id === id && new Date(f.starts_at).getTime() <= now && new Date(f.ends_at).getTime() > now && f.sold < f.flash_stock);
  const price = (p: any) => Number(liveFlash(p.id)?.flash_price || (Number(p.promo_price) > 0 && Number(p.promo_price) < Number(p.price) ? p.promo_price : p.price));
  const countdown = (date: string) => { const ms = Math.max(0, new Date(date).getTime() - now); return `${Math.floor(ms / 3600000)}:${String(Math.floor(ms % 3600000 / 60000)).padStart(2, "0")}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, "0")}`; };
  const categories = useMemo(() => ["Semua", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))], [products]);
  const visibleProducts = useMemo(() => products.filter((p) => (category === "Semua" || p.category === category) && `${p.title} ${stores[p.store_id]?.store_name}`.toLowerCase().includes(search.toLowerCase())), [products, stores, search, category]);

  const openProduct = async (p: any) => {
    if (!p) return; setSelectedStore(null); setSelectedProduct(p); setDetailQty(1); setProductReviews(null);
    history.replaceState(null, "", `${location.pathname}?product=${p.id}`);
    invoke({ action: "store_reviews", storeId: p.store_id }).then((d) => setProductReviews((d.reviews || []).filter((r: any) => r.product_id === p.id))).catch(() => setProductReviews([]));
    try { const data = await invoke({ action: "buyer_catalog", visitorId: vid, productId: p.id, storeId: p.store_id }); setExtras(data.extras || {}); } catch { /* halaman tetap dapat dibuka */ }
  };
  const openStore = async (store: any) => {
    if (!store) return; setSelectedProduct(null); setSelectedStore(store); setStoreReviews([]); setStoreReviewsLoading(true);
    invoke({ action: "store_reviews", storeId: store.id }).then((data) => setStoreReviews((data.reviews || []).map((r: any) => ({ ...r, product_title: products.find((p) => p.id === r.product_id)?.title })))).catch(() => setStoreReviews([])).finally(() => setStoreReviewsLoading(false));
    history.replaceState(null, "", `${location.pathname}?store=${store.id}`);
    try { const data = await invoke({ action: "buyer_catalog", visitorId: vid, storeId: store.id }); setExtras(data.extras || {}); } catch { /* profil publik tetap tampil */ }
  };
  const closeOverlay = () => { setSelectedProduct(null); setSelectedStore(null); history.replaceState(null, "", location.pathname); };
  const share = async (title: string, url: string) => {
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch { return; }
    await navigator.clipboard?.writeText(url); toast({ title: "Tautan disalin" });
  };
  const openChat = async (p: any) => {
    try { const id = await startStoreChat(vid, p.store_id, p.id, username); setChatRole("buyer"); setChatOpenId(id); setSelectedProduct(null); setSelectedStore(null); setTab("chat"); }
    catch (e: any) { toast({ title: "Chat gagal dibuka", description: e.message, variant: "destructive" }); }
  };
  const save = async (kind: "product" | "store", id: string) => {
    try { const data = await invoke({ action: "buyer_saved", visitorId: vid, kind, id }); await load(); if (kind === "store" && selectedStore?.id === id) { const fresh = await invoke({ action: "buyer_catalog", visitorId: vid, storeId: id }); setExtras(fresh.extras || {}); } toast({ title: data.active ? (kind === "product" ? "Masuk wishlist" : "Toko diikuti") : "Dihapus" }); }
    catch (e: any) { toast({ title: "Tindakan gagal", description: e.message, variant: "destructive" }); }
  };
  const cartUpdate = (p: any, qty: number) => {
    const stock = Number(p?.stock || 0);
    const remove = qty <= 0 && qty !== -1;
    const next = remove ? 0 : Math.max(1, Math.min(qty, stock));
    if (remove) setCart((old) => old.filter((c) => c.product_id !== p.id));
    else setCart((old) => old.map((c) => c.product_id === p.id ? { ...c, qty: next } : c));
    pendingCart.current.add(p.id);
    clearTimeout(cartTimers.current[p.id]);
    cartTimers.current[p.id] = setTimeout(async () => {
      try { await invoke({ action: "buyer_cart", visitorId: vid, productId: p.id, qty: next }); }
      catch (e: any) { toast({ title: "Keranjang gagal diperbarui", description: e.message, variant: "destructive" }); }
      finally { pendingCart.current.delete(p.id); if (remove) load(); }
    }, remove ? 0 : 350);
  };
  const addCart = async (p: any, qty = 1, buy = false) => {
    if (!requireLogin({ type: "product", productId: p.id, mode: buy ? "buy" : "cart", qty })) return;
    const old = cart.find((c) => c.product_id === p.id);
    const nextQty = Math.min(Number(p.stock), Number(old?.qty || 0) + qty);
    try {
      await invoke({ action: "buyer_cart", visitorId: vid, productId: p.id, qty: nextQty });
      const mine = await invoke({ action: "buyer_data", visitorId: vid });
      const nextCart = (mine.cart || []).map((c: any) => ({ ...c, product: products.find((product: any) => product.id === c.product_id) }));
      setCart(nextCart); setOrders(mine.orders || []); setBalance(Number(mine.balance || 0)); setUsername(mine.username || "Pembeli");
      setPurchaseDialog(null);
      if (buy) {
        const added = nextCart.find((c: any) => c.product_id === p.id);
        setSelectedProduct(null); setSelectedCart(added ? [added.id] : []); setCheckoutStore(p.store_id); setTab("keranjang");
      } else toast({ title: "Produk masuk keranjang", description: `${p.title} · ${qty} produk` });
    } catch (e: any) { toast({ title: "Keranjang gagal diperbarui", description: e.message, variant: "destructive" }); }
  };

  const groupedCart = useMemo<[string, any[]][]>(() => Object.entries(cart.reduce((m: Record<string, any[]>, c) => { const sid = c.product?.store_id || ""; (m[sid] ||= []).push(c); return m; }, {})) as [string, any[]][], [cart]);
  useEffect(() => { setSelectedCart((current) => current.filter((id) => cart.some((c) => c.id === id))); }, [cart]);
  const chosen = cart.filter((c) => selectedCart.includes(c.id) && (!checkoutStore || c.product?.store_id === checkoutStore));
  const subtotal = chosen.reduce((sum, c) => sum + price(c.product) * c.qty, 0);
  const voucher = (extras.vouchers || []).find((v: any) => v.code?.toUpperCase() === voucherCode.trim().toUpperCase());
  const rawDiscount = voucher && subtotal >= Number(voucher.min_purchase || 0)
    ? Math.min(voucher.discount_type === "percent" ? Math.floor(subtotal * Number(voucher.discount_value) / 100) : Number(voucher.discount_value), Number(voucher.max_discount || Infinity), subtotal) : 0;
  const bill = calcCheckout(chosen.map((c) => price(c.product) * c.qty), rawDiscount);
  const voucherDiscount = bill.discount;
  const total = bill.total;
  const serverNow = now + serverSkew;
  const canCancel = (o: any) => ["dibayar", "proses"].includes(o.status) && o.escrow_status === "held" && serverNow - new Date(o.paid_at || o.created_at).getTime() < 3600_000;
  const canReport = (o: any) => !o.dispute_used && !o.dispute && o.escrow_status === "held" && !["selesai", "batal"].includes(o.status);
  const canEditReview = (o: any) => o.review && Number(o.review.edit_count || 0) < 1 && serverNow - new Date(o.review.created_at).getTime() < 7 * 86400_000;
  const cancelOrder = async (o: any) => {
    if (!confirm(`Batalkan pesanan ${orderCode(o)}? Dana dikembalikan ke saldo.`)) return;
    try { await invoke({ action: "buyer_cancel", visitorId: vid, orderId: o.id }); toast({ title: "Pesanan dibatalkan", description: "Dana dikembalikan ke saldo." }); setOrderDetail(null); await load(); }
    catch (e: any) { toast({ title: "Pembatalan gagal", description: e.message, variant: "destructive" }); }
  };
  const createPin = async () => {
    if (!/^\d{4,6}$/.test(newPin) || newPin !== newPin2) return toast({ title: "PIN 4-6 angka dan konfirmasi harus sama", variant: "destructive" });
    const { data, error } = await supabase.functions.invoke("manage-pin", { body: { action: "create", visitorId: vid, pin: newPin } });
    if (error || data?.error) return toast({ title: data?.error || "Gagal membuat PIN", variant: "destructive" });
    setHasPin(true); setNewPin(""); setNewPin2(""); toast({ title: "PIN berhasil dibuat 🔒" });
  };
  const toggleStore = (sid: string, checked: boolean) => { const ids = cart.filter((c) => c.product?.store_id === sid).map((c) => c.id); setCheckoutStore(checked ? sid : null); setSelectedCart(checked ? ids : selectedCart.filter((id) => !ids.includes(id))); };
  const checkout = async () => {
    if (!requireLogin({ type: "checkout", storeId: checkoutStore })) { setPinOpen(false); setConfirmPay(false); return; }
    if (!checkoutStore || !chosen.length) return; setSending(true);
    try {
      const result = await invoke({ action: "checkout", visitorId: vid, pin, storeId: checkoutStore, cartIds: chosen.map((c) => c.id), voucherCode, buyerNote, checkoutRef: crypto.randomUUID() });
      setSuccessInfo(result); setPinOpen(false);
      setConfirmPay(false); setPin(""); setBuyerNote(""); setVoucherCode(""); setSelectedCart([]); setCheckoutStore(null); load();
    } catch (e: any) { if (/PIN belum dibuat/i.test(e.message)) setHasPin(false); setPin(""); toast({ title: "Pesanan belum dibuat", description: e.message, variant: "destructive" }); }
    finally { setSending(false); }
  };
  const report = async () => {
    try { const data = await invoke({ action: "buyer_report_product", visitorId: vid, productId: reportProduct.id, reason: reportReason, detail: reportDetail }); toast({ title: `Laporan #${data.reportNumber} dikirim` }); setReportProduct(null); setReportDetail(""); }
    catch (e: any) { toast({ title: "Laporan gagal", description: e.message, variant: "destructive" }); }
  };
  const confirmOrder = async (o: any) => { try { await invoke({ action: "confirm", visitorId: vid, orderId: o.id }); toast({ title: "Pesanan selesai" }); await load(); } catch (e: any) { toast({ title: "Konfirmasi gagal", description: e.message, variant: "destructive" }); } };
  const review = async () => { try { await invoke({ action: "buyer_review", visitorId: vid, orderId: reviewOrder.id, rating: stars, comment: reviewText, photo: reviewPhoto }); setReviewPhoto(""); toast({ title: "Rating tersimpan" }); setReviewOrder(null); setReviewText(""); await load();  } catch (e: any) { toast({ title: "Rating gagal", description: e.message, variant: "destructive" }); } };
  const loadCase = async (order: any) => {
    try { const data = await invoke({ action: "dispute_case", visitorId: vid, orderId: order.id }); setDisputeCase(data.case || null); setCaseMessages(data.messages || []); }
    catch (e: any) { toast({ title: "Kasus gagal dimuat", description: e.message, variant: "destructive" }); }
  };
  const submitDispute = async () => {
    if (!disputeOrder || disputeDetail.trim().length < 5) return;
    try { await invoke({ action: "dispute", visitorId: vid, orderId: disputeOrder.id, reason: `${disputeReason}: ${disputeDetail.trim()}`, evidence: disputeEvidence }); await load(); await loadCase(disputeOrder); setDisputeOrder(null); setOrderDetail(null); setDisputeEvidence(""); setTab("pesanan"); toast({ title: "Laporan diterima", description: `Kasus ${orderCode(disputeOrder)} dapat dibuka dari pesanan.` }); }
    catch (e: any) { toast({ title: "Laporan gagal", description: e.message, variant: "destructive" }); }
  };
  const sendCase = async () => {
    if (!disputeCase || !caseText.trim()) return;
    try { await invoke({ action: "dispute_message", visitorId: vid, disputeId: disputeCase.id, message: caseText.trim() }); setCaseText(""); await loadCase({ id: disputeCase.order_id }); }
    catch (e: any) { toast({ title: "Pesan gagal dikirim", description: e.message, variant: "destructive" }); }
  };
  const orderGroup = (status: string) => status === "proses" ? "diproses" : status === "batal" ? "dibatalkan" : status;

  const ProductCard = ({ p }: { p: any }) => { const flash = liveFlash(p.id); const effective = price(p); return <Card className="overflow-hidden border-border/70 bg-card/70"><button className="block w-full text-left" onClick={() => openProduct(p)}><div className="relative aspect-square bg-muted"><img src={p.image_url || "/placeholder.svg"} className="h-full w-full object-cover" alt={p.title} loading="lazy" />{flash && <Badge className="absolute left-2 top-2 bg-destructive text-destructive-foreground">⚡ {countdown(flash.ends_at)}</Badge>}</div></button><CardContent className="space-y-1 p-2.5"><div className="flex min-h-8 flex-wrap items-start gap-x-1"><Button variant="link" className="h-auto min-w-0 p-0 text-left text-xs font-bold text-foreground" onClick={() => openProduct(p)}><span className="line-clamp-2 break-words">{p.title}</span></Button>{p.rating_count > 0 && <Button variant="link" className="h-auto shrink-0 p-0 text-xs text-primary" onClick={() => { openProduct(p); window.setTimeout(() => document.getElementById("market-product-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); }} aria-label={`Lihat ${p.rating_count} ulasan ${p.title}`}>⭐ {Number(p.rating_avg).toFixed(1)} ({p.rating_count})</Button>}</div><button className="block w-full text-left" onClick={() => openProduct(p)}><p className="text-sm font-black text-primary">{rp(effective)} {effective < Number(p.price) && <span className="text-[10px] font-normal text-muted-foreground line-through">{rp(p.price)}</span>}</p><p className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">🏪 <span className="truncate">{stores[p.store_id]?.store_name || "Toko"}</span><SellerVerifiedBadge verified={stores[p.store_id]?.is_verified}/></p><p className="text-[10px] text-muted-foreground">{!p.rating_count && "Belum ada ulasan · "}{p.sold_count || 0} terjual</p></button></CardContent></Card>; };
  const tabs: [Tab, string, any][] = [["produk", "Produk", ShoppingBag], ["chat", "Chat", MessageCircle], ["keranjang", "Keranjang", ShoppingCart], ["pesanan", "Pesanan", Package], ["pengaturan", "Pengaturan", Settings]];

  return <div className="space-y-4 pb-20">
    <nav className="sticky top-0 z-30 grid grid-cols-5 gap-1 border-b bg-background/95 p-1.5 backdrop-blur">
      {tabs.map(([key, label, Icon]) => <Button key={key} variant="ghost" onClick={() => { if (key === "keranjang" && !requireLogin({ type: "cart" })) return; setTab(key); }} className={`h-12 flex-col gap-0.5 px-1 text-[10px] ${tab === key ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><Icon className="h-4 w-4" />{label}{key === "keranjang" && cart.length > 0 && <span className="absolute mt-[-8px] ml-5 rounded-full bg-destructive px-1 text-[8px] text-destructive-foreground">{cart.length}</span>}</Button>)}
    </nav>

    {loading && <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map((n) => <Skeleton key={n} className="aspect-[.8] rounded-lg" />)}</div>}
    {!loading && tab === "produk" && <div className="space-y-3">
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk atau toko" className="pl-9" /></div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">{categories.map((c) => <Button key={c} size="sm" variant={category === c ? "default" : "outline"} className="h-8 shrink-0 text-xs" onClick={() => setCategory(c)}>{c}</Button>)}</div>
      {extras.recent?.length > 0 && !search && category === "Semua" && <section><h3 className="mb-2 text-sm font-black">Terakhir dilihat</h3><div className="flex gap-2 overflow-x-auto">{extras.recent.map((id: string) => products.find((p) => p.id === id)).filter(Boolean).map((p: any) => <button key={p.id} onClick={() => openProduct(p)} className="w-24 shrink-0 text-left"><img src={p.image_url || "/placeholder.svg"} className="aspect-square w-full rounded-md object-cover" alt={p.title}/><p className="mt-1 truncate text-[10px] font-bold">{p.title}</p></button>)}</div></section>}
      <div className="grid grid-cols-2 gap-2">{visibleProducts.map((p) => <ProductCard key={p.id} p={p} />)}{!visibleProducts.length && <div className="col-span-2 py-12 text-center text-sm text-muted-foreground">Produk tidak ditemukan.</div>}</div>
    </div>}

    {tab === "chat" && <div className="space-y-2"><div className="flex gap-1.5 overflow-x-auto">{isSeller && <Button size="sm" variant={chatRole === "seller" ? "default" : "outline"} onClick={() => setChatRole("seller")}>Chat Pembeli</Button>}<Button size="sm" variant={chatRole === "buyer" ? "default" : "outline"} onClick={() => setChatRole("buyer")}>Chat Toko</Button><span className="ml-auto text-[10px] text-muted-foreground">Chat Admin di Bantuan</span></div><StoreChat key={`${chatRole}-${vid}`} visitorId={vid} role={isSeller ? chatRole : "buyer"} openThreadId={chatOpenId} buyerName={username} /></div>}

    {tab === "keranjang" && <div className="space-y-3">
      <header><h2 className="text-lg font-black">Keranjang</h2><p className="text-xs text-muted-foreground">Checkout diproses satu toko agar transaksi tetap aman.</p></header>
      {groupedCart.map(([sid, items]) => <Card key={sid}><CardContent className="p-3 space-y-3"><div className="flex items-center gap-2 border-b pb-2"><Checkbox checked={checkoutStore === sid && items.every((c) => selectedCart.includes(c.id))} onCheckedChange={(v) => toggleStore(sid, !!v)} /><Store className="h-4 w-4"/><button className="flex-1 text-left text-sm font-black" onClick={() => openStore(stores[sid])}>{stores[sid]?.store_name || "Toko"}</button><SellerVerifiedBadge verified={stores[sid]?.is_verified}/><ChevronRight className="h-4 w-4"/></div>{items.map((c) => <div key={c.id} className="flex gap-2"><Checkbox checked={selectedCart.includes(c.id)} onCheckedChange={(v) => { if (v && checkoutStore && checkoutStore !== sid) return toast({ title: "Pilih satu toko untuk checkout" }); setCheckoutStore(v ? sid : checkoutStore); setSelectedCart((old) => v ? [...old, c.id] : old.filter((id) => id !== c.id)); }} /><img src={c.product?.image_url || "/placeholder.svg"} className="h-16 w-16 rounded-md object-cover" alt={c.product?.title}/><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{c.product?.title}</p><p className="text-xs font-black text-primary">{rp(price(c.product))}</p><p className="text-[10px] text-muted-foreground">Stok: {c.product?.stock || 0} · Subtotal {rp(price(c.product) * c.qty)}</p><div className="mt-1 flex items-center gap-1"><Button size="icon" variant="outline" className="h-7 w-7" disabled={c.qty <= 1} onClick={() => cartUpdate(c.product, Math.max(1, c.qty - 1))}><Minus className="h-3 w-3"/></Button><Input aria-label="Jumlah" inputMode="numeric" className="h-7 w-12 px-1 text-center text-xs font-bold" value={c.qty} onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, "") || "1", 10); cartUpdate(c.product, n < 1 ? 1 : n); }}/><Button size="icon" variant="outline" className="h-7 w-7" disabled={!c.product || c.qty >= c.product.stock} onClick={() => cartUpdate(c.product, c.qty + 1)}><Plus className="h-3 w-3"/></Button><Button size="icon" variant="ghost" className="ml-auto h-7 w-7 text-destructive" onClick={() => cartUpdate(c.product, 0)}><Trash2 className="h-4 w-4"/></Button></div></div></div>)}</CardContent></Card>)}
      {!cart.length && <div className="py-14 text-center"><ShoppingCart className="mx-auto mb-2 h-9 w-9 text-muted-foreground"/><p className="font-bold">Keranjang masih kosong</p><Button variant="link" onClick={() => setTab("produk")}>Mulai belanja</Button></div>}
      {chosen.length > 0 && <section className="space-y-3 border-t pt-3"><div className="flex gap-2"><Input value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="Voucher toko"/><Button variant="outline" onClick={() => toast({ title: voucher ? "Voucher tersedia" : "Kode akan diverifikasi saat bayar" })}>Pakai</Button></div>{(extras.vouchers || []).length > 0 && <div className="flex gap-2 overflow-x-auto">{extras.vouchers.map((v: any) => <button key={v.code} onClick={() => setVoucherCode(v.code)} className="shrink-0 rounded-md border border-dashed border-primary p-2 text-left"><b className="text-xs">{v.code}</b><p className="text-[10px] text-muted-foreground">Min. {rp(v.min_purchase)}</p></button>)}</div>}<Textarea value={buyerNote} onChange={(e) => setBuyerNote(e.target.value.slice(0,500))} placeholder="Tulis catatan untuk penjual..."/><div className="space-y-1 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{rp(subtotal)}</span></div><div className="flex justify-between text-primary"><span>Diskon</span><span>-{rp(voucherDiscount)}</span></div><div className="flex justify-between"><span>Biaya Layanan 1%</span><span>+{rp(bill.serviceFee)}</span></div><div className="flex justify-between border-t pt-2 font-black"><span>Total</span><span>{rp(total)}</span></div></div><Card className="bg-muted/30"><CardContent className="p-3 text-sm"><p className="font-bold"><WalletCards className="mr-1 inline h-4 w-4"/>Metode Pembayaran: Saldo</p><p className="mt-2 text-xs">Saldo tersedia: <b>{rp(balance)}</b></p><p className="text-xs">Saldo setelah pembayaran: <b>{rp(Math.max(0, balance-total))}</b></p>{balance < total && <p className="mt-1 text-xs font-bold text-destructive">Saldo tidak mencukupi</p>}</CardContent></Card><Button className="w-full" disabled={balance < total} onClick={() => { if (requireLogin({ type: "checkout", storeId: checkoutStore })) setConfirmPay(true); }}>Checkout · {rp(total)}</Button></section>}
    </div>}

    {tab === "pesanan" && <div className="space-y-3"><h2 className="text-lg font-black">Pesanan Saya</h2><div className="flex gap-1.5 overflow-x-auto">{(["semua","dibayar","diproses","dikirim","selesai","dibatalkan"] as OrderFilter[]).map((f) => <Button key={f} size="sm" variant={orderFilter === f ? "default" : "outline"} className="h-8 shrink-0 capitalize" onClick={() => setOrderFilter(f)}>{f}</Button>)}</div>{orders.filter((o) => orderFilter === "semua" || orderGroup(o.status) === orderFilter).map((o) => <Card key={o.id}><CardContent className="p-3 space-y-2"><div className="flex items-center justify-between border-b pb-2"><button className="text-xs font-black" onClick={() => openStore(stores[o.store_id])}>🏪 {o.store_name || stores[o.store_id]?.store_name || "Toko"}</button><SellerVerifiedBadge verified={stores[o.store_id]?.is_verified}/><Badge variant="outline" className="capitalize">{orderGroup(o.status)}</Badge></div><div className="flex gap-2"><img src={o.product_image_url || products.find((p) => p.id === o.product_id)?.image_url || "/placeholder.svg"} className="h-16 w-16 rounded-md object-cover" alt={o.product_title}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{o.product_title}</p><p className="text-xs text-muted-foreground">{o.qty} × {rp(o.price)}</p><p className="font-black text-primary">{rp(o.grand_total ?? o.total)}</p></div></div><p className="text-[10px] text-muted-foreground">Order {orderCode(o)} · Saldo · {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p><div className="flex flex-wrap gap-1.5"><Button size="sm" variant="outline" onClick={() => { setOrderDetail(o); loadCase(o); }}>Lihat Detail</Button>{o.thread_id && <Button size="sm" variant="outline" onClick={() => { setChatRole("buyer"); setChatOpenId(o.thread_id); setTab("chat"); }}><MessageCircle className="mr-1 h-3 w-3"/>Chat Toko</Button>}<Button size="sm" variant="outline" onClick={() => addCart(products.find((p) => p.id === o.product_id) || o)}><ShoppingCart className="mr-1 h-3 w-3"/>Beli Lagi</Button>{o.status === "dikirim" && <Button size="sm" onClick={() => confirmOrder(o)}>Pesanan Diterima</Button>}{o.status === "selesai" && !o.review && <Button size="sm" onClick={() => { setStars(5); setReviewText(""); setReviewOrder(o); }}><Star className="mr-1 h-3 w-3"/>Beri Rating</Button>}{o.review && <span className="self-center text-[10px] text-primary">⭐ {o.review.product_rating} dinilai</span>}</div></CardContent></Card>)}{!orders.length && <div className="py-14 text-center text-sm text-muted-foreground">Belum ada pesanan.</div>}</div>}

    {tab === "pengaturan" && <>{isSeller ? <><Card><CardContent className="p-4"><p className="font-black">Pengaturan jualan</p><p className="mt-1 text-xs text-muted-foreground">Akun {username} · Saldo utama {rp(balance)}</p></CardContent></Card><SellerDashboard key={vid} visitorId={vid}/></> : <SellerRegistrationTab visitorId={vid} formOnly onRegistered={load}/>}</>}

    <Dialog open={!!selectedProduct} onOpenChange={(v) => !v && closeOverlay()}>{selectedProduct && <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-lg grid-cols-[minmax(0,1fr)] overflow-y-auto p-0"><div className="relative aspect-square bg-muted"><img src={selectedProduct.image_url || "/placeholder.svg"} className="h-full w-full object-cover" alt={selectedProduct.title}/><Button size="icon" variant="secondary" className="absolute left-3 top-3" onClick={closeOverlay}><ArrowLeft className="h-4 w-4"/></Button></div><div className="space-y-4 p-4 pb-4"><div><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h2 className="min-w-0 break-words text-xl font-black">{selectedProduct.title}</h2><Button size="sm" variant="ghost" className="h-7 px-1 text-xs text-primary" onClick={() => { document.getElementById("market-product-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Star className="mr-1 h-3 w-3 fill-current"/>{selectedProduct.rating_count ? `${Number(selectedProduct.rating_avg).toFixed(1)} (${selectedProduct.rating_count})` : "Belum ada ulasan"}</Button></div><p className="mt-1 text-xl font-black text-primary">{rp(price(selectedProduct))} {price(selectedProduct) < Number(selectedProduct.price) && <span className="text-sm font-normal text-muted-foreground line-through">{rp(selectedProduct.price)}</span>}</p>{liveFlash(selectedProduct.id) && <Badge variant="destructive" className="mt-2"><Zap className="mr-1 h-3 w-3"/>Flash Sale {countdown(liveFlash(selectedProduct.id).ends_at)}</Badge>}<p className="mt-2 text-xs text-muted-foreground">{selectedProduct.category ? <Badge variant="outline" className="mr-2">{selectedProduct.category}</Badge> : null}Stok tersedia: {selectedProduct.stock} · {selectedProduct.sold_count || 0} terjual</p></div><div className="flex flex-wrap items-center gap-2 rounded-md border p-3"><div className="flex min-w-0 items-center gap-2"><AccountAvatar visitorId={stores[selectedProduct.store_id]?.visitor_id} username={stores[selectedProduct.store_id]?.store_name} avatarUrl={stores[selectedProduct.store_id]?.avatar_url}/><button className="min-w-0 flex-1 text-left" onClick={() => openStore(stores[selectedProduct.store_id])}><p className="truncate text-sm font-black">{stores[selectedProduct.store_id]?.store_name} <SellerVerifiedBadge verified={stores[selectedProduct.store_id]?.is_verified}/></p><p className="truncate text-[10px] text-muted-foreground">{stores[selectedProduct.store_id]?.rating_count ? `⭐ ${Number(stores[selectedProduct.store_id]?.rating).toFixed(1)}` : "Belum ada ulasan"} · {products.filter((p) => p.store_id === selectedProduct.store_id).length} produk · {stores[selectedProduct.store_id]?.owner_online ? "Aktif" : "Offline"}</p></button></div><Button size="sm" variant="outline" className="shrink-0 max-w-full" onClick={() => openStore(stores[selectedProduct.store_id])}>Kunjungi Toko</Button></div><section><h3 className="mb-1 text-sm font-black">Deskripsi Produk</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selectedProduct.description || "Penjual belum menambahkan deskripsi."}</p></section><section id="market-product-reviews"><h3 className="mb-2 text-sm font-black">Ulasan Pembeli</h3>{productReviews === null && !(extras.reviews || []).some((r: any) => r.product_id === selectedProduct.id) ? <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin"/>Memuat ulasan...</p> : <MarketplaceReviews key={selectedProduct.id} rows={(productReviews ?? (extras.reviews || []).filter((r: any) => r.product_id === selectedProduct.id)).map((r: any) => ({ ...r, product_title: selectedProduct.title }))} scope="product"/>}</section><section><h3 className="mb-2 text-sm font-black">Produk Terkait</h3><div className="grid grid-cols-3 gap-2">{products.filter((p) => p.id !== selectedProduct.id && (p.category === selectedProduct.category || p.store_id === selectedProduct.store_id)).slice(0,3).map((p) => <button key={p.id} onClick={() => openProduct(p)} className="text-left"><img src={p.image_url || "/placeholder.svg"} className="aspect-square w-full rounded-md object-cover" alt={p.title}/><p className="mt-1 truncate text-[10px] font-bold">{p.title}</p></button>)}</div></section><div className="grid grid-cols-3 gap-2"><Button variant="outline" onClick={() => save("product", selectedProduct.id)}><Heart className={`mr-1 h-4 w-4 ${extras.wishlist?.includes(selectedProduct.id) ? "fill-current text-destructive" : ""}`}/>Wishlist</Button><Button variant="outline" onClick={() => share(selectedProduct.title, `${location.origin}${location.pathname}?product=${selectedProduct.id}`)}><Share2 className="mr-1 h-4 w-4"/>Bagikan</Button><Button variant="outline" onClick={() => setReportProduct(selectedProduct)}><Flag className="mr-1 h-4 w-4"/>Laporkan</Button></div></div><div className="sticky bottom-0 z-10 grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 rounded-b-lg border-t bg-background p-2 sm:gap-2 sm:p-3"><Button size="icon" variant="outline" onClick={() => openChat(selectedProduct)}><MessageCircle className="h-4 w-4"/></Button><Button className="min-w-0 px-1 text-xs sm:px-3 sm:text-sm" variant="outline" disabled={!selectedProduct.stock} onClick={() => { setDetailQty(1); if (requireLogin({ type: "product", productId: selectedProduct.id, mode: "cart", qty: detailQty })) setPurchaseDialog({ product: selectedProduct, mode: "cart" }); }}><ShoppingCart className="mr-1 h-4 w-4 shrink-0"/>Keranjang</Button><Button className="min-w-0 px-1 text-xs sm:px-3 sm:text-sm" disabled={!selectedProduct.stock} onClick={() => { setDetailQty(1); if (requireLogin({ type: "product", productId: selectedProduct.id, mode: "buy", qty: detailQty })) setPurchaseDialog({ product: selectedProduct, mode: "buy" }); }}><Zap className="mr-1 h-4 w-4 shrink-0"/>{selectedProduct.stock ? "Beli Sekarang" : "Stok Habis"}</Button></div></DialogContent>}</Dialog>

    <Dialog open={!!selectedStore} onOpenChange={(v) => !v && closeOverlay()}>{selectedStore && <DialogContent className="max-h-[94dvh] w-[calc(100%-1rem)] max-w-2xl grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto p-0"><StoreProfile key={selectedStore.id} store={selectedStore} products={products} reviews={storeReviews} reviewsLoading={storeReviewsLoading} vouchers={extras.vouchers || []} followed={extras.followed?.includes(selectedStore.id) || false} followerCount={Number(extras.followers || 0)} renderProduct={(p) => <ProductCard p={p} />} onFollow={() => save("store", selectedStore.id)} onChat={() => { const p = products.find((x) => x.store_id === selectedStore.id); if (p) openChat(p); }} onShare={() => share(selectedStore.store_name, `${location.origin}${location.pathname}?store=${selectedStore.id}`)} /></DialogContent>}</Dialog>

    <Dialog open={!!purchaseDialog} onOpenChange={(v) => !v && setPurchaseDialog(null)}>{purchaseDialog && <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm"><DialogHeader><DialogTitle>{purchaseDialog.mode === "cart" ? "Masuk Keranjang" : "Beli Sekarang"}</DialogTitle></DialogHeader><div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3"><img src={purchaseDialog.product.image_url || "/placeholder.svg"} className="h-16 w-16 rounded-md object-cover" alt={purchaseDialog.product.title}/><div className="min-w-0"><p className="line-clamp-2 text-sm font-bold">{purchaseDialog.product.title}</p><p className="mt-1 font-black text-primary">{rp(price(purchaseDialog.product))}</p><p className="text-xs text-muted-foreground">Stok tersedia: {purchaseDialog.product.stock}</p></div></div><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-y py-3"><div className="min-w-0"><p className="text-sm font-bold">Jumlah pembelian</p><p className="text-xs text-muted-foreground">Maksimal {purchaseDialog.product.stock}</p></div><div className="flex shrink-0 items-center gap-2"><Button size="icon" variant="outline" className="h-9 w-9" disabled={detailQty <= 1} onClick={() => setDetailQty(Math.max(1, detailQty - 1))}><Minus className="h-4 w-4"/></Button><b className="w-6 text-center">{detailQty}</b><Button size="icon" variant="outline" className="h-9 w-9" disabled={detailQty >= Number(purchaseDialog.product.stock)} onClick={() => setDetailQty(Math.min(Number(purchaseDialog.product.stock), detailQty + 1))}><Plus className="h-4 w-4"/></Button></div></div><Button className="w-full" onClick={() => addCart(purchaseDialog.product, detailQty, purchaseDialog.mode === "buy")}>{purchaseDialog.mode === "cart" ? "Konfirmasi Masuk Keranjang" : "Lanjutkan Beli Sekarang"}</Button></DialogContent>}</Dialog>

    <Dialog open={confirmPay} onOpenChange={setConfirmPay}><DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>Informasi Pesanan</DialogTitle></DialogHeader><div className="space-y-3"><p className="flex items-center gap-1 text-sm font-black">🏪 {stores[checkoutStore || ""]?.store_name}<SellerVerifiedBadge verified={stores[checkoutStore || ""]?.is_verified}/></p>{chosen.map((c) => <div key={c.id} className="flex gap-2 border-b pb-2"><img src={c.product?.image_url || "/placeholder.svg"} className="h-14 w-14 shrink-0 rounded-md object-cover" alt={c.product?.title}/><div className="min-w-0 flex-1"><p className="break-words text-xs font-bold">{c.product?.title}</p><p className="text-[11px] text-muted-foreground">Jumlah: {c.qty} × {rp(price(c.product))}</p><p className="text-xs font-bold">{rp(price(c.product) * c.qty)}</p></div></div>)}<div className="space-y-1 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{rp(bill.subtotal)}</span></div><div className="flex justify-between text-primary"><span>Diskon/Voucher{voucherDiscount > 0 ? ` ${voucherCode}` : ""}</span><span>-{rp(voucherDiscount)}</span></div><div className="flex justify-between"><span>Biaya Layanan 1%</span><span>+{rp(bill.serviceFee)}</span></div><div className="flex justify-between border-t pt-2 text-base font-black"><span>Total Pembayaran</span><span>{rp(total)}</span></div></div><div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1"><p className="font-bold"><WalletCards className="mr-1 inline h-4 w-4"/>Metode Pembayaran: Saldo</p><p>Saldo tersedia: <b>{rp(balance)}</b></p><p>Saldo setelah pembayaran: <b>{rp(Math.max(0, balance - total))}</b></p>{balance < total && <p className="font-bold text-destructive">Saldo tidak mencukupi</p>}</div><label className="block text-xs font-bold">Catatan untuk seller<Textarea className="mt-1" value={buyerNote} onChange={(e) => setBuyerNote(e.target.value.slice(0, 500))} placeholder="Opsional"/></label><p className="text-[10px] text-muted-foreground">Harga, voucher, stok, dan saldo diperiksa ulang oleh server saat pesanan dibuat.</p></div><Button className="w-full" disabled={sending || balance < total || !chosen.length} onClick={() => { if (!requireLogin({ type: "checkout", storeId: checkoutStore })) { setConfirmPay(false); return; } setPin(""); setPinOpen(true); }}>Checkout · {rp(total)}</Button></DialogContent></Dialog>

    <Dialog open={pinOpen} onOpenChange={(v) => { if (!sending) setPinOpen(v); }}><DialogContent className="w-[calc(100%-1.5rem)] max-w-sm"><DialogHeader><DialogTitle>Masukkan PIN Transaksi</DialogTitle></DialogHeader>{hasPin === false ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Kamu belum mempunyai PIN transaksi. Buat PIN dulu untuk melanjutkan.</p><Input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN baru (4-6 angka)"/><Input type="password" inputMode="numeric" maxLength={6} value={newPin2} onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, ""))} placeholder="Ulangi PIN"/><Button className="w-full" onClick={createPin}>Buat PIN</Button></div> : <div className="space-y-3"><p className="text-xs text-muted-foreground">Total {rp(total)} akan dipotong dari saldo setelah PIN benar.</p><Input autoFocus type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter" && pin.length >= 4 && !sending) checkout(); }} className="text-center text-2xl font-bold tracking-[0.4em]" placeholder="••••••"/><Button className="w-full" disabled={sending || pin.length < 4} onClick={checkout}>{sending ? "Memproses..." : "Konfirmasi & Bayar"}</Button><div className="flex justify-between text-xs"><Button variant="link" size="sm" className="h-auto p-0" onClick={() => setHasPin(false)}>Buat PIN</Button><Button variant="link" size="sm" className="h-auto p-0" onClick={() => { setPinOpen(false); setConfirmPay(false); window.dispatchEvent(new CustomEvent("open-pin-dialog", { detail: "forgot" })); }}>Lupa PIN?</Button></div></div>}</DialogContent></Dialog>

    <Dialog open={loginPrompt} onOpenChange={setLoginPrompt}><DialogContent className="w-[calc(100%-2rem)] max-w-sm"><DialogHeader><DialogTitle>Login Terlebih Dahulu</DialogTitle></DialogHeader><div className="space-y-4 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><WalletCards className="h-7 w-7"/></div><p className="text-sm text-muted-foreground">Silakan login ke akun Anda untuk menggunakan saldo dan melakukan pembelian.</p><div className="grid grid-cols-2 gap-2"><Button onClick={() => goLogin("login")}>Login</Button><Button variant="outline" onClick={() => goLogin("register")}>Daftar Akun</Button></div><p className="text-[10px] text-muted-foreground">Pilihan produk dan jumlahmu disimpan, lalu dilanjutkan setelah login.</p></div></DialogContent></Dialog>
    <Dialog open={!!successInfo} onOpenChange={(v) => !v && setSuccessInfo(null)}><DialogContent className="w-[calc(100%-1.5rem)] max-w-sm text-center"><DialogHeader><DialogTitle className="text-center">Pesanan berhasil dibuat 🎉</DialogTitle></DialogHeader><CheckCircle2 className="mx-auto h-14 w-14 text-primary"/><p className="text-sm text-muted-foreground">Silakan cek tab Pesanan dan hubungi seller jika diperlukan.</p>{successInfo?.orders?.[0]?.order_code && <p className="text-xs font-bold">#{successInfo.orders[0].order_code}</p>}<p className="text-xs">Saldo tersisa: <b>{rp(successInfo?.balance_after)}</b></p><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => { setSuccessInfo(null); setTab("pesanan"); }}>Lihat Pesanan</Button><Button onClick={() => { const t = successInfo?.orders?.[0]?.thread_id; setSuccessInfo(null); if (t) { setChatRole("buyer"); setChatOpenId(t); setTab("chat"); } else setTab("pesanan"); }}><MessageCircle className="mr-1 h-4 w-4"/>Chat Seller</Button></div></DialogContent></Dialog>

    <Dialog open={!!orderDetail} onOpenChange={(v) => !v && setOrderDetail(null)}>{orderDetail && <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>Pesanan {orderCode(orderDetail)}</DialogTitle></DialogHeader><div className="space-y-4 text-sm">
      <div className="flex items-center gap-3 border-b pb-3"><AccountAvatar visitorId={stores[orderDetail.store_id]?.visitor_id} username={orderDetail.store_name || stores[orderDetail.store_id]?.store_name} avatarUrl={stores[orderDetail.store_id]?.avatar_url} size={48}/><div className="min-w-0"><p className="flex items-center gap-1 font-bold"><span className="truncate">{orderDetail.store_name || stores[orderDetail.store_id]?.store_name || "Toko"}</span><SellerVerifiedBadge verified={stores[orderDetail.store_id]?.is_verified}/></p><p className="text-xs text-muted-foreground">{orderCode(orderDetail)}</p></div></div>
      <div className="flex gap-3"><img src={orderDetail.product_image_url || products.find((p) => p.id === orderDetail.product_id)?.image_url || "/placeholder.svg"} alt={orderDetail.product_title} className="h-20 w-20 shrink-0 rounded-md object-cover"/><div className="min-w-0"><p className="break-words font-semibold">{orderDetail.product_title}</p>{(orderDetail.product_category || products.find((p) => p.id === orderDetail.product_id)?.category) && <p className="text-xs text-muted-foreground">Kategori: {orderDetail.product_category || products.find((p) => p.id === orderDetail.product_id)?.category}</p>}<p className="text-muted-foreground">{orderDetail.qty} × {rp(orderDetail.price)}</p></div></div>
      <div className="space-y-1 rounded-md border p-3 text-xs"><div className="flex justify-between"><span>Harga produk</span><span>{rp(orderDetail.subtotal ?? orderDetail.price * orderDetail.qty)}</span></div>{Number(orderDetail.discount) > 0 && <div className="flex justify-between text-primary"><span>Voucher</span><span>-{rp(orderDetail.discount)}</span></div>}{Number(orderDetail.service_fee) > 0 && <div className="flex justify-between"><span>Biaya Layanan 1%</span><span>+{rp(orderDetail.service_fee)}</span></div>}<div className="flex justify-between border-t pt-1 text-sm font-black"><span>Total</span><span>{rp(orderDetail.grand_total ?? orderDetail.total)}</span></div></div>
      {orderDetail.status === "batal" && <p className="rounded-md bg-destructive/10 p-2 text-xs font-bold text-destructive">Dibatalkan / Refund{orderDetail.refunded_at ? ` · dana dikembalikan ${new Date(orderDetail.refunded_at).toLocaleString("id-ID")}` : ""}{orderDetail.cancel_reason ? ` · ${orderDetail.cancel_reason}` : ""}</p>}
      {orderDetail.dispute && <p className="rounded-md bg-muted p-2 text-xs">Kasus kendala: <b>{({ open: "Dana ditahan", fixing: "Proses perbaikan", refunded: "Refund ke pembeli", released: "Dana diteruskan", closed: "Ditutup" } as any)[orderDetail.dispute.status] || orderDetail.dispute.status}</b>{orderDetail.dispute.awaiting === "seller" && orderDetail.dispute.seller_respond_by ? ` · menunggu seller s/d ${new Date(orderDetail.dispute.seller_respond_by).toLocaleString("id-ID")}` : ""}{orderDetail.dispute.awaiting === "buyer" && orderDetail.dispute.buyer_respond_by ? ` · kamu perlu merespons s/d ${new Date(orderDetail.dispute.buyer_respond_by).toLocaleString("id-ID")}` : ""}</p>}
      <div className="space-y-1 border-t pt-3 text-xs"><p>Metode pembayaran: <b>Saldo</b></p>{orderDetail.buyer_note && <p className="break-words">Catatan Pembeli: {orderDetail.buyer_note}</p>}</div>
      {orderDetail.delivery_data && <section className="space-y-1 border-l-2 border-primary bg-muted/30 p-3"><p className="font-bold">Data pesanan dari penjual</p><p className="whitespace-pre-wrap break-all">{orderDetail.delivery_data}</p><p className="text-xs text-muted-foreground">Dikirim {orderDetail.delivery_sent_at || orderDetail.shipped_at ? new Date(orderDetail.delivery_sent_at || orderDetail.shipped_at).toLocaleString("id-ID") : "—"}</p></section>}
      <section className="space-y-2 border-l-2 border-primary/40 pl-4">{[["Pesanan dibuat",orderDetail.created_at],["Dibayar",orderDetail.paid_at],["Diproses",orderDetail.processed_at],["Data dikirim",orderDetail.delivery_sent_at || orderDetail.shipped_at],["Selesai",orderDetail.completed_at]].filter(([label,at]) => !!at || label === "Diproses").map(([label,at]) => <div key={label} className="text-xs"><CheckCircle2 className={`mr-2 inline h-4 w-4 ${at ? "text-primary" : "text-muted-foreground"}`}/><b>{label}</b><span className="block pl-6 text-muted-foreground">{at ? new Date(at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : orderDetail.status === "proses" ? "Sedang diproses" : "Menunggu"}</span></div>)}</section>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setOrderDetail(null); if (orderDetail.thread_id) { setChatRole("buyer"); setChatOpenId(orderDetail.thread_id); setTab("chat"); } else { const p = products.find((x) => x.id === orderDetail.product_id); if (p) openChat(p); } }}>Chat Seller</Button><Button size="sm" variant="outline" onClick={() => { setOrderDetail(null); openStore(stores[orderDetail.store_id]); }}>Kunjungi Toko</Button>{orderDetail.status === "selesai" && !orderDetail.review && <Button size="sm" onClick={() => { setOrderDetail(null); setStars(5); setReviewText(""); setReviewOrder(orderDetail); }}>Beri Rating</Button>}{orderDetail.status === "selesai" && canEditReview(orderDetail) && <Button size="sm" variant="outline" onClick={() => { setOrderDetail(null); setStars(orderDetail.review.product_rating); setReviewText(orderDetail.review.comment || ""); setReviewOrder(orderDetail); }}>Edit Rating (1x)</Button>}{orderDetail.status === "dikirim" && <Button size="sm" onClick={() => confirmOrder(orderDetail)}>Pesanan Diterima</Button>}{canCancel(orderDetail) && <Button size="sm" variant="outline" onClick={() => cancelOrder(orderDetail)}><XCircle className="mr-1 h-3 w-3"/>Batalkan ({Math.max(0, Math.ceil((3600_000 - (serverNow - new Date(orderDetail.paid_at || orderDetail.created_at).getTime())) / 60000))} mnt)</Button>}{canReport(orderDetail) && <Button size="sm" variant="destructive" onClick={() => { setDisputeOrder(orderDetail); setOrderDetail(null); loadCase(orderDetail); }}>Lapor Kendala</Button>}</div>
      {(disputeCase?.order_id === orderDetail.id || orderDetail.dispute) && <Button variant="outline" className="w-full" onClick={() => { setDisputeOrder(orderDetail); loadCase(orderDetail); setOrderDetail(null); }}>Buka Grup Kendala {orderCode(orderDetail)}</Button>}
    </div></DialogContent>}</Dialog>

    <Dialog open={!!disputeOrder} onOpenChange={(v) => !v && setDisputeOrder(null)}>{disputeOrder && <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>Kasus Pesanan {orderCode(disputeOrder)}</DialogTitle></DialogHeader>{disputeCase?.order_id === disputeOrder.id ? <DisputeRoom orderId={disputeOrder.id} visitorId={vid} onChanged={(c) => { if (c) setDisputeCase(c); }} /> : <div className="space-y-3"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)}>{["Produk tidak sesuai", "Data tidak diterima", "Penjual tidak merespons", "Masalah pembayaran", "Lainnya"].map((r) => <option key={r}>{r}</option>)}</select><Textarea maxLength={500} value={disputeDetail} onChange={(e) => setDisputeDetail(e.target.value)} placeholder="Jelaskan kendala (minimal 5 karakter)"/><label className="block text-xs">Bukti foto (opsional)<Input className="mt-1" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 1024 * 1024) { toast({ title: "Foto maksimal 1 MB", variant: "destructive" }); e.target.value = ""; return; } const reader = new FileReader(); reader.onload = () => setDisputeEvidence(String(reader.result || "")); reader.readAsDataURL(file); }}/></label><Button disabled={disputeDetail.trim().length < 5} onClick={submitDispute} className="w-full">Kirim Laporan ke Admin</Button></div>}</DialogContent>}</Dialog>

    <Dialog open={!!reportProduct} onOpenChange={(v) => !v && setReportProduct(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Laporkan Produk</DialogTitle></DialogHeader><select className="h-10 rounded-md border bg-background px-3 text-sm" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>{["Produk tidak sesuai","Informasi menyesatkan","Penipuan","Produk dilarang","Spam","Pelanggaran lainnya"].map((r) => <option key={r}>{r}</option>)}</select><Textarea value={reportDetail} onChange={(e) => setReportDetail(e.target.value.slice(0,1000))} placeholder="Tambahkan keterangan untuk admin..."/><Button onClick={report}><Flag className="mr-1 h-4 w-4"/>Kirim Laporan</Button></DialogContent></Dialog>
    <Dialog open={!!reviewOrder} onOpenChange={(v) => !v && setReviewOrder(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{reviewOrder?.review ? "Edit Rating (hanya 1 kali)" : "Beri Rating"}</DialogTitle></DialogHeader><div className="flex justify-center gap-2">{[1,2,3,4,5].map((n) => <Button key={n} size="icon" variant="ghost" onClick={() => setStars(n)}><Star className={`h-7 w-7 ${stars >= n ? "fill-current text-primary" : "text-muted-foreground"}`}/></Button>)}</div><Textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Bagikan pengalaman belanjamu..."/><label className="block text-xs">Foto ulasan (opsional, maks 1 MB)<Input className="mt-1" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 1024 * 1024) { toast({ title: "Foto maksimal 1 MB", variant: "destructive" }); e.target.value = ""; return; } const r = new FileReader(); r.onload = () => setReviewPhoto(String(r.result || "")); r.readAsDataURL(file); }}/></label>{reviewPhoto && <img src={reviewPhoto} alt="Pratinjau foto ulasan" className="max-h-32 rounded-md object-contain"/>}<p className="text-[10px] text-muted-foreground">{reviewOrder?.review ? "Setelah diedit, rating tidak bisa diubah lagi." : "Rating bisa diedit 1 kali dalam 7 hari."}</p><Button onClick={review}>{reviewOrder?.review ? "Simpan Perubahan" : "Kirim Rating"}</Button></DialogContent></Dialog>
  </div>;
}