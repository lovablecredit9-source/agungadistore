import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShoppingBag, KeyRound, Clock, Smartphone, Home, Package, Ticket,
  Download, MessageCircle, Copy, CheckCircle2, Shield, Crown,
  HelpCircle, X, ExternalLink, Search, ChevronLeft, ChevronRight, FileText,
  Heart, Send, ImagePlus, AlertCircle, History, Wallet, ArrowUpCircle, ArrowDownCircle,
  Bell, Check, CheckCheck, Globe, Edit2, ShoppingCart, Plus, Minus, Trash2,
  Moon, Sun, Lock, Tag, Music, Megaphone, Diamond, Image as ImageIcon, Gem, Sparkles, Palette, CalendarDays, Gamepad2, RefreshCw
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import storeQris from "@/assets/store-qris.jpg";
import musicBanner from "@/assets/music-banner.jpg";
import promoProductsImg from "@/assets/promo-products.jpg";
import promoSponsorsImg from "@/assets/promo-sponsors.jpg";
import promoSaldoImg from "@/assets/promo-saldo.jpg";
import promoPublikImg from "@/assets/promo-publik.jpg";
import promoTiketImg from "@/assets/promo-tiket.jpg";
import promoGameImg from "@/assets/promo-game.jpg";
import { STORE_NAME, WA_NUMBER, SOCIAL_LINKS, YOUTUBE_NAME } from "@/lib/social-links";
import { getDeviceSummary, collectDeviceInfo } from "@/lib/device-info";
import { getVisitorId } from "@/lib/visitor-id";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang, t, type Lang } from "@/lib/i18n";
import { z } from "zod";
import PlaylistTab, { type PlaybackState } from "@/components/PlaylistTab";
import LanguageSelector from "@/components/LanguageSelector";
import { LANGUAGES } from "@/lib/languages";
import InstallPrompt from "@/components/InstallPrompt";
import MusicPublicTab from "@/components/MusicPublicTab";
import SponsorBanner from "@/components/SponsorBanner";
import LikesTab from "@/components/LikesTab";
import DailyStreak from "@/components/DailyStreak";
import HomeBannerSlider from "@/components/HomeBannerSlider";
import BalanceAuth from "@/components/BalanceAuth";
import GameTab from "@/components/GameTab";
import PlusTab from "@/components/PlusTab";

type Tab = "beranda" | "produk" | "voucher" | "history" | "likes" | "tiket" | "saldo" | "playlist" | "publik" | "sponsor" | "streak" | "adminpost" | "game" | "plus" | "update";

interface UserBalance {
  id: string;
  visitor_id: string;
  username: string;
  phone: string;
  balance: number;
}

interface BalanceTransaction {
  id: string;
  visitor_id: string;
  type: string;
  amount: number;
  description: string | null;
  product_id: string | null;
  token_id: string | null;
  created_at: string;
  trx_id: string | null;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
  has_warranty: boolean;
  created_at: string;
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

interface PurchasedVoucher {
  tokens: { id: string; token_code: string; fields: { field_name: string; field_value: string }[] }[];
  product: Product;
  quantity: number;
  total_price: number;
  balance_remaining: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const TICKET_CATEGORIES = [
  { value: "akun", label: "Akun / Login" },
  { value: "voucher", label: "Voucher / Kode Redeem" },
  { value: "saldo", label: "Saldo / Top Up / Deposit" },
  { value: "sponsor", label: "Sponsor / Iklan Produk" },
  { value: "penipu", label: "Lapor Penipu / Penipuan" },
  { value: "lagu", label: "Lagu / Musik Bermasalah" },
  { value: "transaksi", label: "Transaksi / Pembayaran" },
  { value: "produk", label: "Produk / Token" },
  { value: "refund", label: "Refund / Pengembalian Dana" },
  { value: "garansi", label: "Klaim Garansi" },
  { value: "rekber", label: "Rekber / Escrow" },
  { value: "chat", label: "Chat / Pesan Tidak Dibalas" },
  { value: "pin", label: "PIN / Keamanan Akun" },
  { value: "deposit", label: "Deposit Belum Masuk" },
  { value: "playlist", label: "Playlist / Musik" },
  { value: "bug", label: "Bug / Error Aplikasi" },
  { value: "saran", label: "Saran / Masukan" },
  { value: "lainnya", label: "Lainnya" },
];

interface SupportTicket {
  id: string;
  ticket_number: number;
  name: string;
  phone: string;
  description: string;
  status: string;
  created_at: string;
  category?: string;
  screenshot_url?: string | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
  is_read: boolean;
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
  is_read: boolean;
}

type DepositStatusFilter = "all" | "pending" | "approved" | "rejected" | "cancelled";
type DepositMethodFilter = "all" | "qris" | "ewallet";

const usernameSchema = z.string().trim().min(3, "Username minimal 3 karakter").max(30, "Username maksimal 30 karakter").regex(/^[A-Za-z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore");

const phoneSchema = z.string().trim().transform((value) => value.replace(/[\s-]/g, "")).refine((value) => /^(\+?\d{1,4}\s?\d+|08\d+)$/.test(value), "Format nomor HP tidak valid").refine((value) => value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 16, "No HP tidak valid (7-16 digit)");

// WhatsApp-style checkmark component
function MessageStatus({ isRead, isUserMsg }: { isRead: boolean; isUserMsg: boolean }) {
  if (!isUserMsg) return null;
  return (
    <span className="inline-flex items-center ml-1">
      {isRead ? (
        <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
      ) : (
        <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/50" />
      )}
    </span>
  );
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

function isEwalletMethod(method: string) {
  return method.trim().toLowerCase() !== "qris";
}

function getDepositStatusLabel(status: string, lang: Lang) {
  if (status === "approved") return t("deposit.approved", lang);
  if (status === "rejected") return t("deposit.rejected", lang);
  if (status === "cancelled") return lang === "id" ? "Dibatalkan" : "Cancelled";
  return lang === "id" ? "Belum dikonfirmasi admin" : "Waiting for admin confirmation";
}

function validateProfileInput(username: string, phone: string) {
  const result = z.object({ username: usernameSchema, phone: phoneSchema }).safeParse({ username, phone });

  if (!result.success) {
    return {
      success: false as const,
      message: result.error.issues[0]?.message || "Data profil tidak valid",
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}

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

const TAB_PATHS: Record<string, Tab> = {
  "/": "beranda",
  "/produk": "produk",
  "/voucher": "voucher",
  "/saldo": "saldo",
  "/likes": "likes",
  "/history": "history",
  "/tiket": "tiket",
  "/playlist": "playlist",
  "/publik": "publik",
  "/sponsor": "sponsor",
  "/streak": "streak",
  "/admin-post": "adminpost",
  "/game": "game",
  "/plus": "plus",
  "/update": "update",
};
const PATH_FROM_TAB: Record<Tab, string> = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([k, v]) => [v, k])
) as Record<Tab, string>;

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme, resolvedTheme, customBgUrl, setCustomBgUrl } = useTheme();
  const customBgInputRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useLang();
  const tab: Tab = TAB_PATHS[location.pathname] || "beranda";
  const setTab = useCallback((t: Tab) => {
    navigate(PATH_FROM_TAB[t] || "/", { replace: false });
  }, [navigate]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [claimResults, setClaimResults] = useState<ClaimResult[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Sync selectedProduct with URL ?id= param
  const openProduct = useCallback((p: Product | null) => {
    setSelectedProduct(p);
    if (p) {
      const url = new URL(window.location.href);
      url.searchParams.set("id", p.id);
      window.history.replaceState({}, "", url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [productSearch, setProductSearch] = useState("");
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 5;
  const { toast } = useToast();

  // Music playback persistence
  const [playbackState, setPlaybackState] = useState<PlaybackState>({ song: null, isPlaying: false, currentTime: 0, duration: 0 });
  const togglePlayRef = useRef<(() => void) | null>(null);
  const openFullPlayerRef = useRef<(() => void) | null>(null);
  const playExternalRef = useRef<((song: { id: string; title: string; artist: string; file_url: string; cover_url: string | null }) => void) | null>(null);

  // Likes
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likedSponsorIds, setLikedSponsorIds] = useState<Set<string>>(new Set());
  const [productLikeCounts, setProductLikeCounts] = useState<Record<string, number>>({});
  const [sponsorLikeCounts, setSponsorLikeCounts] = useState<Record<string, number>>({});
  const visitorId = getVisitorId();

  // Admin posts
  const [adminPosts, setAdminPosts] = useState<any[]>([]);

  // Tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketView, setTicketView] = useState<"list" | "create" | "chat">("list");
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [ticketName, setTicketName] = useState("");
  const [ticketPhone, setTicketPhone] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketCategory, setTicketCategory] = useState("lainnya");
  const [ticketScreenshot, setTicketScreenshot] = useState<File | null>(null);
  const [ticketScreenshotPreview, setTicketScreenshotPreview] = useState<string | null>(null);
  const [ticketMsg, setTicketMsg] = useState("");
  const ticketChatRef = useRef<HTMLDivElement>(null);

  // Product Chat
  const [showProductChat, setShowProductChat] = useState(false);
  const [productChatProduct, setProductChatProduct] = useState<Product | null>(null);
  const [productChat, setProductChat] = useState<ProductChat | null>(null);
  const [productChatMessages, setProductChatMessages] = useState<ProductChatMessage[]>([]);
  const [productChatMsg, setProductChatMsg] = useState("");
  const [productChatHistory, setProductChatHistory] = useState<ProductChat[]>([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const productChatRef = useRef<HTMLDivElement>(null);

  // WhatsApp form
  const [showWaForm, setShowWaForm] = useState(false);
  const [waUsername, setWaUsername] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waDesc, setWaDesc] = useState("");

  // Saldo
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [balanceTransactions, setBalanceTransactions] = useState<BalanceTransaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<BalanceTransaction | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [showTxExport, setShowTxExport] = useState(false);
  const [setupUsername, setSetupUsername] = useState("");
  const [setupPhone, setSetupPhone] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showBuySaldo, setShowBuySaldo] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [purchaseSuccess, setPurchaseSuccess] = useState<PurchasedVoucher | null>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [navInfoDismissed, setNavInfoDismissed] = useState(() => !!localStorage.getItem("nav_swipe_info_dismissed"));
  const cartTotal = cart.reduce((sum, item) => sum + getWholesalePrice(item.product.id, item.quantity, item.product.price) * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // PIN
  const [hasPin, setHasPin] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPinVerify, setShowPinVerify] = useState(false);
  const [pinVerifyInput, setPinVerifyInput] = useState("");
  const [pendingPurchase, setPendingPurchase] = useState<{product: Product; quantity: number; discountCode: string} | null>(null);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPinInput, setNewPinInput] = useState("");

  // Discount voucher
  const [discountCode, setDiscountCode] = useState("");
  const [discountInfo, setDiscountInfo] = useState<{amount: number; code: string} | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);

  // Deposit
  interface Deposit {
    id: string; visitor_id: string; username: string; amount: number;
    payment_method: string; trx_id: string; status: string; created_at: string;
  }
  interface AdminSetting { id: string; setting_key: string; setting_value: string; }
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSetting[]>([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositStep, setDepositStep] = useState<"method" | "form">("method");
  const [depositMethod, setDepositMethod] = useState<string>("qris");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositHistoryStatusFilter, setDepositHistoryStatusFilter] = useState<DepositStatusFilter>("all");
  const [depositHistoryMethodFilter, setDepositHistoryMethodFilter] = useState<DepositMethodFilter>("all");
  const [depositHistorySort, setDepositHistorySort] = useState<"newest" | "oldest">("newest");
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);

  // Home banner sponsors
  interface HomeSponsor { id: string; title: string; image_url: string | null; price: number; seller_name: string; sponsor_number: number; }
  const [homeSponsors, setHomeSponsors] = useState<HomeSponsor[]>([]);

  async function fetchHomeSponsors() {
    const { data } = await supabase.from("sponsors").select("id, title, image_url, price, seller_name, sponsor_number").eq("is_active", true).order("created_at", { ascending: false }).limit(10);
    if (data) setHomeSponsors(data as unknown as HomeSponsor[]);
  }

  // Notifications
  interface Notification {
    id: string;
    visitor_id: string;
    title: string;
    message: string | null;
    type: string;
    is_read: boolean;
    created_at: string;
    related_id: string | null;
  }
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  async function fetchNotifications() {
    const { data } = await supabase.from("notifications").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(50);
    if (data) setNotifications(data as unknown as Notification[]);
  }

  async function markNotifRead(id: string) {
    await supabase.from("notifications").update({ is_read: true } as any).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true } as any).in("id", unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function createNotification(title: string, message: string, type: string, relatedId?: string) {
    await supabase.from("notifications").insert({
      visitor_id: visitorId, title, message, type, related_id: relatedId || null,
    } as any);
  }

  useEffect(() => {
    fetchProducts();
    loadHistory();
    fetchLikes();
    fetchAdminPosts();
    fetchTickets();
    fetchProductChatHistory();
    fetchUserBalance();
    fetchNotifications();
    fetchDeposits();
    fetchAdminSettings();
    checkPinStatus();
    fetchHomeSponsors();

    // First visit notification - geser navigasi
    const firstVisitKey = "first_visit_nav_notified";
    if (!localStorage.getItem(firstVisitKey)) {
      localStorage.setItem(firstVisitKey, "1");
      supabase.from("notifications").insert({
        visitor_id: visitorId,
        title: "👆 Geser Navigasi ke Kiri!",
        message: "Navigasi bawah bisa digeser untuk melihat tab lainnya seperti Musik, Sponsor, Streak, Game & lainnya.",
        type: "info",
      }).then(() => fetchNotifications());
    }

    // Deep link handling for sponsor share links
    const params = new URLSearchParams(window.location.search);
    const sponsorParam = params.get("sponsor");
    if (sponsorParam) {
      setTab("sponsor");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Auto-open product from URL ?id= param
  useEffect(() => {
    if (products.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("id");
    if (productId && tab === "produk") {
      const found = products.find(p => p.id === productId);
      if (found) setSelectedProduct(found);
    }
  }, [products, tab]);

  async function checkPinStatus() {
    const { data } = await supabase.functions.invoke("manage-pin", { body: { action: "check", visitorId } });
    if (data) setHasPin(data.hasPin);
  }

  async function createPin() {
    if (pinInput.length < 4 || pinInput.length > 6 || !/^\d+$/.test(pinInput)) {
      toast({ title: "PIN harus 4-6 digit angka", variant: "destructive" }); return;
    }
    if (pinInput !== pinConfirm) {
      toast({ title: "Konfirmasi PIN tidak cocok", variant: "destructive" }); return;
    }
    const { data, error } = await supabase.functions.invoke("manage-pin", { body: { action: "create", visitorId, pin: pinInput } });
    if (error || data?.error) { toast({ title: data?.error || "Gagal membuat PIN", variant: "destructive" }); return; }
    setHasPin(true);
    setShowPinSetup(false);
    setPinInput(""); setPinConfirm("");
    toast({ title: "PIN berhasil dibuat! 🔒" });
  }

  async function resetPinWithToken() {
    if (!resetToken || !newPinInput) {
      toast({ title: "Isi token dan PIN baru", variant: "destructive" }); return;
    }
    const { data, error } = await supabase.functions.invoke("manage-pin", {
      body: { action: "reset", visitorId, resetToken, newPin: newPinInput },
    });
    if (error || data?.error) { toast({ title: data?.error || "Gagal reset PIN", variant: "destructive" }); return; }
    setShowForgotPin(false);
    setResetToken(""); setNewPinInput("");
    toast({ title: "PIN berhasil direset! 🔒" });
  }

  async function checkDiscountCode(code: string) {
    if (!code.trim()) { setDiscountInfo(null); return; }
    setCheckingDiscount(true);
    const { data } = await supabase.from("discount_vouchers")
      .select("*").eq("code", code.toUpperCase()).eq("is_active", true).maybeSingle();
    if (data && (!data.expires_at || new Date(data.expires_at as string) > new Date()) && (data.used_count as number) < (data.max_uses as number)) {
      setDiscountInfo({ amount: data.discount_amount as number, code: data.code as string });
    } else {
      setDiscountInfo(null);
    }
    setCheckingDiscount(false);
  }

  async function fetchDeposits() {
    const { data } = await supabase.from("deposits").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false });
    if (data) setDeposits(data as unknown as Deposit[]);
  }

  async function fetchAdminSettings() {
    const { data } = await supabase.from("admin_settings").select("*");
    if (data) setAdminSettings(data as unknown as AdminSetting[]);
  }

  function getSettingValue(key: string): string {
    return adminSettings.find(s => s.setting_key === key)?.setting_value || "";
  }

  function getEwallets(): {name: string; number: string}[] {
    try { return JSON.parse(getSettingValue("ewallets") || "[]"); } catch { return []; }
  }

  async function submitDeposit() {
    const amount = parseInt(depositAmount) || 0;
    if (amount <= 0 || !userBalance) {
      toast({ title: lang === "id" ? "Isi nominal deposit" : "Enter deposit amount", variant: "destructive" }); return;
    }

    const methodLabel = depositMethod === "qris" ? "QRIS" : depositMethod;

    const { data, error } = await supabase.functions.invoke("create-deposit", {
      body: {
        visitorId,
        amount,
        paymentMethod: methodLabel,
      },
    });

    if (error || data?.error) {
      toast({ title: data?.error || "Gagal membuat deposit", variant: "destructive" });
      return;
    }

    const createdDeposit = data?.deposit as Deposit | undefined;
    const trxId = createdDeposit?.trx_id || "-";
    const msg = lang === "id"
      ? `Halo admin, saya mengajukan deposit saldo.\n\nUsername: ${userBalance.username}\nNominal: ${formatPrice(amount)}\nMetode: ${methodLabel}\nID Transaksi: ${trxId}`
      : `Hello admin, I submitted a balance deposit.\n\nUsername: ${userBalance.username}\nAmount: ${formatPrice(amount)}\nMethod: ${methodLabel}\nTransaction ID: ${trxId}`;
    window.open(`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
    toast({ title: lang === "id" ? `Deposit dibuat! ID: ${trxId}` : `Deposit created! ID: ${trxId}` });
    setShowDepositModal(false); setDepositAmount(""); setDepositStep("method");
    if (createdDeposit) setSelectedDeposit(createdDeposit);
    fetchDeposits();
  }

  // Realtime notifications
  useEffect(() => {
    const ch = supabase.channel("user-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `visitor_id=eq.${visitorId}` },
        (payload) => {
          const notif = payload.new as unknown as Notification;
          setNotifications(prev => [notif, ...prev]);
          // Show toast if not in chat view
          if (ticketView !== "chat" && !showProductChat) {
            toast({ title: notif.title, description: notif.message || undefined });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticketView, showProductChat]);

  // Realtime products
  useEffect(() => {
    const ch = supabase.channel("products-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => fetchProducts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Realtime user_balances & transactions - auto-refresh on admin changes
  useEffect(() => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) return;
    const ch = supabase.channel("balance-realtime-" + balVid)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_balances", filter: `visitor_id=eq.${balVid}` }, () => fetchUserBalance())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "balance_transactions", filter: `visitor_id=eq.${balVid}` }, () => fetchUserBalance())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `visitor_id=eq.${balVid}` }, (payload) => {
        const notif = payload.new as unknown as Notification;
        setNotifications(prev => [notif, ...prev]);
        toast({ title: notif.title, description: notif.message || undefined });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userBalance?.visitor_id]);

  const [wholesalePrices, setWholesalePrices] = useState<any[]>([]);

  async function fetchProducts() {
    const [pRes, piRes, wRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_images").select("*").order("image_order"),
      supabase.from("wholesale_prices").select("*").eq("entity_type", "product").order("min_quantity"),
    ]);
    if (pRes.data) setProducts(pRes.data as unknown as Product[]);
    if (piRes.data) setProductImages(piRes.data as ProductImage[]);
    if (wRes.data) setWholesalePrices(wRes.data);
  }

  function getWholesalePrice(productId: string, quantity: number, normalPrice: number): number {
    const tiers = wholesalePrices.filter((w: any) => w.entity_id === productId).sort((a: any, b: any) => b.min_quantity - a.min_quantity);
    for (const tier of tiers) {
      if (quantity >= tier.min_quantity) return tier.price_per_item;
    }
    return normalPrice;
  }

  function getProductWholesaleTiers(productId: string) {
    return wholesalePrices.filter((w: any) => w.entity_id === productId).sort((a: any, b: any) => a.min_quantity - b.min_quantity);
  }

  async function fetchLikes() {
    const [{ data: prodData }, { data: sponsorData }, { data: prodCounts }, { data: sponsorCounts }] = await Promise.all([
      supabase.from("liked_products").select("product_id").eq("visitor_id", visitorId),
      supabase.from("liked_sponsors").select("sponsor_id").eq("visitor_id", visitorId),
      supabase.from("liked_products").select("product_id"),
      supabase.from("liked_sponsors").select("sponsor_id"),
    ]);
    if (prodData) setLikedIds(new Set(prodData.map((d: any) => d.product_id)));
    if (sponsorData) setLikedSponsorIds(new Set(sponsorData.map((d: any) => d.sponsor_id)));
    if (prodCounts) {
      const counts: Record<string, number> = {};
      prodCounts.forEach((d: any) => { counts[d.product_id] = (counts[d.product_id] || 0) + 1; });
      setProductLikeCounts(counts);
    }
    if (sponsorCounts) {
      const counts: Record<string, number> = {};
      sponsorCounts.forEach((d: any) => { counts[d.sponsor_id] = (counts[d.sponsor_id] || 0) + 1; });
      setSponsorLikeCounts(counts);
    }
  }

  async function fetchAdminPosts() {
    const { data } = await supabase.from("admin_posts").select("*").eq("is_active", true).order("created_at", { ascending: false });
    if (data) setAdminPosts(data);
  }

  async function fetchUserBalance() {
    // Don't auto-restore session if user has logged out
    const isLoggedIn = localStorage.getItem("balance_logged_in");
    if (!isLoggedIn) {
      setUserBalance(null);
      setBalanceTransactions([]);
      return;
    }

    const savedEmail = localStorage.getItem("balance_email");
    let query = supabase.from("user_balances").select("*");
    
    // Prefer finding by saved email (more reliable across devices)
    if (savedEmail) {
      query = query.eq("email", savedEmail);
    } else {
      query = query.eq("visitor_id", visitorId);
    }
    
    const { data } = await query.maybeSingle();
    if (data) {
      const user = data as unknown as UserBalance;
      setUserBalance(user);
      setProfileUsername(user.username);
      setProfilePhone(user.phone);
    } else {
      // Session invalid, clean up
      localStorage.removeItem("balance_logged_in");
      localStorage.removeItem("balance_email");
      localStorage.removeItem("balance_visitor_id");
      setUserBalance(null);
    }
    const balVid = localStorage.getItem("balance_visitor_id") || visitorId;
    const { data: txns } = await supabase.from("balance_transactions").select("*").eq("visitor_id", balVid).order("created_at", { ascending: false });
    if (txns) setBalanceTransactions(txns as unknown as BalanceTransaction[]);
  }

  async function createUserBalance() {
    const validation = validateProfileInput(setupUsername, setupPhone);
    if (!validation.success) {
      toast({ title: validation.message, variant: "destructive" });
      return;
    }

    setSavingProfile(true);

    const { data, error } = await supabase.functions.invoke("upsert-balance-profile", {
      body: {
        visitorId,
        username: validation.data.username,
        phone: validation.data.phone,
      },
    });

    setSavingProfile(false);

    if (error || data?.error) { toast({ title: data?.error || "Gagal membuat akun", variant: "destructive" }); return; }

    const user = data?.user as UserBalance;
    setUserBalance(user);
    setProfileUsername(user.username);
    setProfilePhone(user.phone);
    setSetupUsername(""); setSetupPhone("");
    toast({ title: "Akun saldo berhasil dibuat! 🎉" });
    fetchUserBalance();
  }

  async function updateUserBalanceProfile() {
    const validation = validateProfileInput(profileUsername, profilePhone);
    if (!validation.success) {
      toast({ title: validation.message, variant: "destructive" });
      return;
    }

    setSavingProfile(true);

    const { data, error } = await supabase.functions.invoke("upsert-balance-profile", {
      body: {
        visitorId,
        username: validation.data.username,
        phone: validation.data.phone,
      },
    });

    setSavingProfile(false);

    if (error || data?.error) {
      toast({ title: data?.error || "Gagal memperbarui profil", variant: "destructive" });
      return;
    }

    const user = data?.user as UserBalance;
    setUserBalance(user);
    setProfileUsername(user.username);
    setProfilePhone(user.phone);
    setShowProfileModal(false);
    toast({ title: "Profil berhasil diperbarui" });
    fetchUserBalance();
  }

  function addToCart(product: Product, qty = 1) {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: Math.min(item.quantity + qty, product.stock) } : item);
      }
      return [...prev, { product, quantity: Math.min(qty, product.stock) }];
    });
    toast({ title: `${product.title} ditambahkan ke keranjang` });
  }

  function updateCartQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: Math.min(qty, item.product.stock) } : item));
    }
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }

  function attemptBuy(product: Product, quantity = 1) {
    const dc = discountCode.trim();
    if (hasPin) {
      setPendingPurchase({ product, quantity, discountCode: dc });
      setPinVerifyInput("");
      setShowPinVerify(true);
      setShowBuySaldo(false);
    } else {
      buyWithSaldo(product, quantity, dc);
    }
  }

  async function confirmPinAndBuy() {
    if (!pendingPurchase) return;
    const { data, error } = await supabase.functions.invoke("manage-pin", {
      body: { action: "verify", visitorId, pin: pinVerifyInput },
    });
    if (error || data?.error || !data?.valid) {
      toast({ title: "PIN salah", variant: "destructive" }); return;
    }
    setShowPinVerify(false);
    buyWithSaldo(pendingPurchase.product, pendingPurchase.quantity, pendingPurchase.discountCode, pinVerifyInput);
    setPendingPurchase(null);
    setPinVerifyInput("");
  }

  async function buyWithSaldo(product: Product, quantity = 1, voucherCode = "", pin?: string) {
    const unitPrice = getWholesalePrice(product.id, quantity, product.price);
    const totalPrice = unitPrice * quantity;
    if (!userBalance || userBalance.balance < totalPrice) {
      toast({ title: "Saldo tidak cukup", variant: "destructive" }); return;
    }
    const { data, error } = await supabase.functions.invoke("purchase-with-balance", {
      body: { visitorId, productId: product.id, quantity, discountCode: voucherCode || undefined, pin },
    });

    if (error || data?.error) {
      toast({ title: data?.error || "Pembelian gagal diproses", variant: "destructive" }); return;
    }

    const purchaseData = data as PurchasedVoucher;
    setUserBalance(prev => prev ? { ...prev, balance: purchaseData.balance_remaining } : prev);
    setShowBuySaldo(false);
    setBuyProduct(null);
    setBuyQuantity(1);
    openProduct(null);
    removeFromCart(product.id);
    setDiscountCode("");
    setDiscountInfo(null);
    setPurchaseSuccess(purchaseData);
    fetchUserBalance();
    const codes = purchaseData.tokens.map(t => t.token_code).join(", ");
    createNotification("Pembelian Berhasil 🛒", `Kamu berhasil membeli ${quantity}x ${product.title}. Kode: ${codes}`, "purchase", product.id);
  }

  async function claimVoucherCodes(codes: string[]) {
    if (codes.length === 0) return;

    setClaiming(true);
    setClaimResults([]);

    const deviceResult = await collectDeviceInfo();
    const { data, error } = await supabase.functions.invoke("claim-voucher", {
      body: {
        codes,
        visitorId,
        deviceInfo: deviceResult.raw,
        browser: deviceResult.browser,
      },
    });

    if (error || data?.error) {
      setClaiming(false);
      toast({ title: data?.error || "Gagal klaim voucher", variant: "destructive" });
      return;
    }

    const results = (data?.results || []) as ClaimResult[];
    const errors = (data?.errors || []) as string[];

    errors.forEach((message) => toast({ title: message, variant: "destructive" }));

    if (results.length > 0) {
      const newHistories = results.map((result) => {
        const prodImgs = getProductImages(result.product.id);
        return {
          id: result.token.id,
          token_code: result.token.token_code,
          product_title: result.product.title,
          product_price: result.product.price,
          product_image: prodImgs[0] || result.product.image_url || undefined,
          claimed_at: result.token.claimed_at || new Date().toISOString(),
          device_info: deviceResult.raw,
          browser: deviceResult.browser,
          fields: result.fields || [],
        };
      });

      setClaimResults(results);
      saveHistory([...newHistories, ...history]);
      setTokenInput("");
      toast({ title: `${results.length} voucher berhasil diklaim! 🎉` });
      results.forEach(r => createNotification("Voucher Diklaim ✅", `${r.product.title} berhasil diklaim.`, "claim", r.token.id));
    }

    setClaiming(false);
  }

  async function toggleLike(productId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (likedIds.has(productId)) {
      await supabase.from("liked_products").delete().eq("product_id", productId).eq("visitor_id", visitorId);
      setLikedIds(prev => { const n = new Set(prev); n.delete(productId); return n; });
      setProductLikeCounts(prev => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 1) - 1) }));
    } else {
      await supabase.from("liked_products").insert({ product_id: productId, visitor_id: visitorId });
      setLikedIds(prev => new Set(prev).add(productId));
      setProductLikeCounts(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
    }
  }

  async function toggleLikeSponsor(sponsorId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (likedSponsorIds.has(sponsorId)) {
      await supabase.from("liked_sponsors").delete().eq("sponsor_id", sponsorId).eq("visitor_id", visitorId);
      setLikedSponsorIds(prev => { const n = new Set(prev); n.delete(sponsorId); return n; });
      setSponsorLikeCounts(prev => ({ ...prev, [sponsorId]: Math.max(0, (prev[sponsorId] || 1) - 1) }));
    } else {
      await supabase.from("liked_sponsors").insert({ sponsor_id: sponsorId, visitor_id: visitorId });
      setLikedSponsorIds(prev => new Set(prev).add(sponsorId));
      setSponsorLikeCounts(prev => ({ ...prev, [sponsorId]: (prev[sponsorId] || 0) + 1 }));
    }
  }

  async function fetchTickets() {
    const stored = localStorage.getItem("my_ticket_ids");
    if (!stored) return;
    const ids = JSON.parse(stored) as string[];
    if (ids.length === 0) return;
    const { data } = await supabase.from("support_tickets").select("*").in("id", ids).order("created_at", { ascending: false });
    if (data) setTickets(data as unknown as SupportTicket[]);
  }

  async function fetchProductChatHistory() {
    const { data } = await supabase.from("product_chats").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false });
    if (data) setProductChatHistory(data as unknown as ProductChat[]);
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
    await claimVoucherCodes(codes);
  }

  function openClaimFromPurchase(code: string) {
    setPurchaseSuccess(null);
    setTokenInput(code);
    setTab("voucher");
    toast({ title: "Kode voucher sudah dimasukkan, lanjut klik Klaim Sekarang" });
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
    if (selectedHistoryIds.size === history.length && history.length > 0) {
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

    try {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        img.onload = () => { doc.addImage(img, "JPEG", pageW / 2 - 10, 5, 20, 20); resolve(); };
        img.onerror = () => resolve();
        img.src = storeQris;
      });
    } catch {}

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
    let txt = `${STORE_NAME} - Riwayat Klaim Voucher\nDicetak: ${new Date().toLocaleString("id-ID")}\n${"=".repeat(50)}\n\n`;
    items.forEach((h, idx) => {
      txt += `#${idx + 1} ${h.product_title}\nKode: ${h.token_code}\nWaktu: ${new Date(h.claimed_at).toLocaleString("id-ID")}\nHarga: ${formatPrice(h.product_price || 0)}\n`;
      const deviceSummary = h.device_info ? getDeviceSummary(h.device_info) : "-";
      txt += `Perangkat: ${deviceSummary}\n`;
      h.fields.forEach(f => { txt += `${f.field_name}: ${f.field_value}\n`; });
      txt += "-".repeat(40) + "\n\n";
    });
    txt += `\n${STORE_NAME} — WA: ${WA_NUMBER}\nHarap simpan bukti ini. Jika ada masalah hubungi admin.\n`;
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "riwayat-klaim-agung-adi-store.txt"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "TXT berhasil didownload! 📝" });
  }

  // === TICKET FUNCTIONS ===
  async function createTicket() {
    if (!ticketName.trim() || !ticketPhone.trim() || !ticketDesc.trim()) {
      toast({ title: "Semua field harus diisi", variant: "destructive" }); return;
    }
    let screenshotUrl: string | null = null;
    if (ticketScreenshot) {
      const ext = ticketScreenshot.name.split(".").pop();
      const path = `tickets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-images").upload(path, ticketScreenshot);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
        screenshotUrl = urlData.publicUrl;
      }
    }
    const { data, error } = await supabase.from("support_tickets").insert({
      name: ticketName.trim(), phone: ticketPhone.trim(), description: ticketDesc.trim(),
      category: ticketCategory, screenshot_url: screenshotUrl,
    }).select().single();
    if (error || !data) { toast({ title: "Gagal membuat tiket", variant: "destructive" }); return; }

    const stored = JSON.parse(localStorage.getItem("my_ticket_ids") || "[]");
    stored.push(data.id);
    localStorage.setItem("my_ticket_ids", JSON.stringify(stored));

    toast({ title: `Tiket #${(data as any).ticket_number} dibuat!` });
    setTicketName(""); setTicketPhone(""); setTicketDesc(""); setTicketCategory("lainnya");
    setTicketScreenshot(null); setTicketScreenshotPreview(null);
    await fetchTickets();
    setActiveTicket(data as unknown as SupportTicket);
    setTicketView("chat");
    loadTicketMessages(data.id);
  }

  async function loadTicketMessages(ticketId: string) {
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at");
    if (data) setTicketMessages(data as unknown as TicketMessage[]);
    setTimeout(() => ticketChatRef.current?.scrollTo(0, ticketChatRef.current.scrollHeight), 100);
  }

  async function sendTicketMessage() {
    if (!ticketMsg.trim() || !activeTicket) return;
    await supabase.from("ticket_messages").insert({
      ticket_id: activeTicket.id, sender_type: "user", message: ticketMsg.trim(),
    });
    setTicketMsg("");
  }

  async function sendTicketImage(file: File) {
    if (!activeTicket) return;
    const ext = file.name.split(".").pop();
    const path = `tickets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast({ title: "Gagal upload gambar", variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
    await supabase.from("ticket_messages").insert({
      ticket_id: activeTicket.id, sender_type: "user", image_url: urlData.publicUrl,
    });
  }

  // Realtime ticket messages
  useEffect(() => {
    if (!activeTicket) return;
    loadTicketMessages(activeTicket.id);
    const channel = supabase.channel(`ticket-${activeTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${activeTicket.id}` },
        (payload) => {
          setTicketMessages(prev => [...prev, payload.new as unknown as TicketMessage]);
          setTimeout(() => ticketChatRef.current?.scrollTo(0, ticketChatRef.current.scrollHeight), 100);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${activeTicket.id}` },
        (payload) => {
          setTicketMessages(prev => prev.map(m => m.id === (payload.new as any).id ? { ...m, is_read: (payload.new as any).is_read } : m));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTicket?.id]);

  // Refresh ticket status
  useEffect(() => {
    if (!activeTicket) return;
    const ch = supabase.channel(`ticket-status-${activeTicket.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${activeTicket.id}` },
        (payload) => {
          setActiveTicket(payload.new as unknown as SupportTicket);
          fetchTickets();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeTicket?.id]);

  // === PRODUCT CHAT FUNCTIONS ===
  async function openProductChat(product: Product) {
    setProductChatProduct(product);
    setShowProductChat(true);
    openProduct(null);

    // Check if existing chat for this product
    const { data: existing } = await supabase.from("product_chats")
      .select("*").eq("product_id", product.id).eq("visitor_id", visitorId).eq("status", "open").maybeSingle();

    if (existing) {
      setProductChat(existing as unknown as ProductChat);
      loadProductChatMessages(existing.id);
    } else {
      const { data: newChat } = await supabase.from("product_chats").insert({
        product_id: product.id, visitor_id: visitorId, visitor_name: "Pengunjung",
      }).select().single();
      if (newChat) {
        setProductChat(newChat as unknown as ProductChat);
        // Send initial product message
        await supabase.from("product_chat_messages").insert({
          chat_id: newChat.id, sender_type: "user",
          message: `Halo, saya tertarik dengan produk: ${product.title} (${formatPrice(product.price)})`,
        });
        loadProductChatMessages(newChat.id);
        fetchProductChatHistory();
      }
    }
  }

  async function loadProductChatMessages(chatId: string) {
    const { data } = await supabase.from("product_chat_messages").select("*").eq("chat_id", chatId).order("created_at");
    if (data) setProductChatMessages(data as unknown as ProductChatMessage[]);
    setTimeout(() => productChatRef.current?.scrollTo(0, productChatRef.current.scrollHeight), 100);
  }

  async function sendProductChatMessage() {
    if (!productChatMsg.trim() || !productChat) return;
    await supabase.from("product_chat_messages").insert({
      chat_id: productChat.id, sender_type: "user", message: productChatMsg.trim(),
    });
    setProductChatMsg("");
  }

  async function sendProductChatImage(file: File) {
    if (!productChat) return;
    const ext = file.name.split(".").pop();
    const path = `chats/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast({ title: "Gagal upload gambar", variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
    await supabase.from("product_chat_messages").insert({
      chat_id: productChat.id, sender_type: "user", image_url: urlData.publicUrl,
    });
  }

  // Realtime product chat
  useEffect(() => {
    if (!productChat) return;
    loadProductChatMessages(productChat.id);
    const channel = supabase.channel(`pchat-${productChat.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "product_chat_messages", filter: `chat_id=eq.${productChat.id}` },
        (payload) => {
          setProductChatMessages(prev => [...prev, payload.new as unknown as ProductChatMessage]);
          setTimeout(() => productChatRef.current?.scrollTo(0, productChatRef.current.scrollHeight), 100);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "product_chat_messages", filter: `chat_id=eq.${productChat.id}` },
        (payload) => {
          setProductChatMessages(prev => prev.map(m => m.id === (payload.new as any).id ? { ...m, is_read: (payload.new as any).is_read } : m));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [productChat?.id]);

  // Filters
  const categories = ["Semua", ...Array.from(new Set(products.map(p => p.category || "Lainnya").filter(Boolean)))];
  const filteredProducts = products
    .filter(p => selectedCategory === "Semua" || (p.category || "Lainnya") === selectedCategory)
    .filter(p => p.title.toLowerCase().includes(productSearch.toLowerCase()) || (p.description || "").toLowerCase().includes(productSearch.toLowerCase()));
  const sortedProducts = sortOrder === "oldest" ? [...filteredProducts].reverse() : filteredProducts;

  const totalClaimPrice = claimResults.reduce((sum, r) => sum + r.product.price, 0);

  const totalHistoryPages = Math.ceil(history.length / HISTORY_PER_PAGE);
  const paginatedHistory = history.slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE);

  const likedProducts = products.filter(p => likedIds.has(p.id));
  const filteredDeposits = [...deposits]
    .filter((dep) => depositHistoryStatusFilter === "all" ? true : dep.status === depositHistoryStatusFilter)
    .filter((dep) => {
      if (depositHistoryMethodFilter === "all") return true;
      return depositHistoryMethodFilter === "qris" ? dep.payment_method.trim().toLowerCase() === "qris" : isEwalletMethod(dep.payment_method);
    })
    .sort((a, b) => depositHistorySort === "newest"
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // WhatsApp send
  function sendWhatsApp() {
    if (!selectedProduct || !waUsername.trim() || !waPhone.trim()) {
      toast({ title: "Isi semua informasi", variant: "destructive" }); return;
    }
    const msg = `Halo, saya mau beli:\n\nProduk: ${selectedProduct.title}\nHarga: ${formatPrice(selectedProduct.price)}\n\nNama: ${waUsername}\nNo HP: ${waPhone}\nKeterangan: ${waDesc || "-"}`;
    window.open(`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
    setShowWaForm(false); setWaUsername(""); setWaPhone(""); setWaDesc("");
  }

  return (
    <div className={`min-h-screen text-foreground flex flex-col ${resolvedTheme === "custom" ? "bg-transparent" : "bg-background"}`}>
      <InstallPrompt />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <img src={storeQris} alt={STORE_NAME} className="w-11 h-11 rounded-xl object-cover border-2 border-primary-foreground/30 shadow-md" />
          <div className="flex-1">
            <h1 className="text-lg font-extrabold tracking-tight">{STORE_NAME}</h1>
            <p className="text-[10px] opacity-80 leading-tight">{t("header.tagline", lang)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-primary-foreground/30 transition-colors" title="Tema">
                  {resolvedTheme === "dark" ? <Moon className="w-4 h-4" /> : resolvedTheme === "gold" ? <Crown className="w-4 h-4" /> : resolvedTheme === "diamond" ? <Diamond className="w-4 h-4" /> : resolvedTheme === "silver" ? <Gem className="w-4 h-4" /> : resolvedTheme === "platinum" ? <Sparkles className="w-4 h-4" /> : resolvedTheme === "purple" ? <Palette className="w-4 h-4" /> : resolvedTheme === "custom" ? <ImageIcon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2 cursor-pointer">
                  <Sun className="w-4 h-4" /> Terang {theme === "light" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2 cursor-pointer">
                  <Moon className="w-4 h-4" /> Gelap {theme === "dark" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("gold")} className="gap-2 cursor-pointer">
                  <Crown className="w-4 h-4" /> Emas {theme === "gold" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("diamond")} className="gap-2 cursor-pointer">
                  <Diamond className="w-4 h-4" /> Diamond {theme === "diamond" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("silver")} className="gap-2 cursor-pointer">
                  <Gem className="w-4 h-4" /> Silver {theme === "silver" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("platinum")} className="gap-2 cursor-pointer">
                  <Sparkles className="w-4 h-4" /> Platinum {theme === "platinum" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("purple")} className="gap-2 cursor-pointer">
                  <Palette className="w-4 h-4" /> Ungu {theme === "purple" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.preventDefault();
                  setTimeout(() => customBgInputRef.current?.click(), 150);
                }} className="gap-2 cursor-pointer">
                  <ImageIcon className="w-4 h-4" /> Custom Foto {theme === "custom" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2 cursor-pointer">
                  <Smartphone className="w-4 h-4" /> Perangkat {theme === "system" && "✓"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={customBgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const url = ev.target?.result as string;
                    setCustomBgUrl(url);
                    setTheme("custom");
                  };
                  reader.readAsDataURL(file);
                }
                e.target.value = "";
              }}
            />
            <LanguageSelector currentLang={lang} onSelect={setLang} />
            <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative w-9 h-9 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-primary-foreground/30 transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>
            <a href={`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent("Halo, saya mau tanya di Agung Adi Store")}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-primary-foreground/30 transition-colors">
              <MessageCircle className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {tab === "beranda" && (
          <div className="space-y-5">
            {/* Info: Geser navigasi */}
            {!navInfoDismissed && (
              <div className="relative flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                <div className="shrink-0 text-primary">
                  <ChevronRight className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">👆 Geser navigasi ke kiri</p>
                  <p className="text-[11px] text-muted-foreground">Navigasi bawah bisa digeser untuk melihat tab lainnya seperti Musik, Sponsor, Streak, Game & lainnya.</p>
                </div>
                <button
                  onClick={() => { localStorage.setItem("nav_swipe_info_dismissed", "1"); setNavInfoDismissed(true); }}
                  className="shrink-0 p-1 rounded-full hover:bg-muted"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Hero Promo Slider — Music / Produk / Sponsor */}
            <HomeBannerSlider
              banners={[
                {
                  id: "music",
                  image: musicBanner,
                  title: "Dengarkan Musik Sambil Belanja!",
                  subtitle: `🎵 Lagu dari ${STORE_NAME}`,
                  cta: "Dengarkan Sekarang",
                  onClick: () => setTab("playlist"),
                },
                {
                  id: "products",
                  image: promoProductsImg,
                  title: "Jelajahi Produk Premium Kami",
                  subtitle: `🛍️ ${products.length} Produk Tersedia`,
                  cta: "Lihat Produk",
                  onClick: () => setTab("produk"),
                },
                {
                  id: "sponsors",
                  image: promoSponsorsImg,
                  title: "Iklan & Sponsor Terpercaya",
                  subtitle: `📢 ${homeSponsors.length} Sponsor Aktif`,
                  cta: "Lihat Sponsor",
                  onClick: () => setTab("sponsor"),
                },
                {
                  id: "saldo",
                  image: promoSaldoImg,
                  title: "Daftar Akun & Isi Saldo",
                  subtitle: "💰 Belanja Lebih Mudah",
                  cta: "Daftar Sekarang",
                  onClick: () => setTab("saldo"),
                },
                {
                  id: "publik",
                  image: promoPublikImg,
                  title: "Upload Lagu Kamu Sendiri!",
                  subtitle: "🎤 AI & Admin Cek Otomatis",
                  cta: "Mulai Upload",
                  onClick: () => setTab("publik"),
                },
                {
                  id: "game",
                  image: promoGameImg,
                  title: "Main Game Seru Lawan AI!",
                  subtitle: "🎮 11 Game AI Menantang",
                  cta: "Main Sekarang",
                  onClick: () => setTab("game"),
                },
                {
                  id: "tiket",
                  image: promoTiketImg,
                  title: "Ada Masalah? Hubungi Kami!",
                  subtitle: "🎫 Tiket & Chat Support",
                  cta: "Buat Tiket",
                  onClick: () => setTab("tiket"),
                },
              ]}
            />

            {/* Streak Promo Card */}
            <div
              onClick={() => setTab("streak")}
              className="relative overflow-hidden rounded-2xl cursor-pointer group transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #ff6b00 0%, #ff4500 40%, #e63900 100%)",
              }}
            >
              <div className="absolute inset-0 opacity-20">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full animate-pulse"
                    style={{
                      width: 40 + i * 20,
                      height: 40 + i * 20,
                      background: "radial-gradient(circle, rgba(255,204,0,0.4), transparent 70%)",
                      top: `${10 + i * 12}%`,
                      left: `${60 + i * 6}%`,
                      animationDelay: `${i * 0.3}s`,
                    }}
                  />
                ))}
              </div>
              <div className="relative z-10 p-4 flex items-center gap-4">
                <div className="shrink-0">
                  <svg viewBox="0 0 36 36" width={48} height={56} style={{ filter: "drop-shadow(0 2px 8px rgba(255,200,0,0.5))" }}>
                    <path d="M17.56 1.56c-.28-.45-.88-.45-1.12 0C14.86 4.36 6 18.56 6 24c0 6.63 4.92 12 11 12h2c6.08 0 11-5.37 11-12 0-5.44-8.86-19.64-10.44-22.44z" fill="#F4900C"/>
                    <path d="M18.5 3c-1 1.6-9.5 15.8-9.5 21 0 5.52 3.8 10 8.5 10.5C12.2 34 8 29.8 8 24.5 8 19 16.2 5.8 18.5 3z" fill="#FFAC33" opacity="0.7"/>
                    <path d="M18 8c-.2-.32-.64-.32-.82 0C16.08 10.08 10 19.6 10 24c0 4.42 3.36 8 7.5 8h1c4.14 0 7.5-3.58 7.5-8 0-4.4-6.08-13.92-7.18-16z" fill="#FFCC4D"/>
                    <ellipse cx="18" cy="28" rx="4" ry="5.5" fill="#FFEE93"/>
                    <ellipse cx="18" cy="29" rx="2.5" ry="3.5" fill="#FFF4C8" opacity="0.8"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-extrabold text-base leading-tight">Daily Streak 🔥</h3>
                  <p className="text-white/80 text-xs mt-0.5">Klaim setiap hari, raih milestone & gelar eksklusif!</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                    <span className="text-white text-[11px] font-bold">Klaim Sekarang →</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Promo Card */}
            <div
              onClick={() => setTab("game")}
              className="relative overflow-hidden rounded-2xl cursor-pointer group hover:shadow-xl transition-all hover:-translate-y-0.5 duration-200"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700" />
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 right-4 text-6xl">🎮</div>
                <div className="absolute bottom-2 left-4 text-4xl">🎲</div>
                <div className="absolute top-6 left-20 text-3xl">🧩</div>
              </div>
              <div className="relative z-10 p-4 flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/10 shrink-0">
                  <Gamepad2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-extrabold text-base leading-tight">Game AI Seru 🎮</h3>
                  <p className="text-white/80 text-xs mt-0.5">8 game menantang lawan AI! Suit, Tebak Kata, Ular Tangga & lainnya</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                    <span className="text-white text-[11px] font-bold">Main Sekarang →</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Posts Preview */}
            {adminPosts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> Postingan Admin
                  </h3>
                  <button onClick={() => setTab("adminpost")} className="text-xs text-primary font-medium hover:underline">
                    Lihat Semua →
                  </button>
                </div>
                {adminPosts.slice(0, 2).map(post => (
                  <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-all cursor-pointer" onClick={() => setTab("adminpost")}>
                    <CardContent className="p-3 flex items-center gap-3">
                      {post.image_url && (
                        <img src={post.image_url} alt={post.title} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm truncate">{post.title}</h4>
                        {post.content && <p className="text-[11px] text-muted-foreground line-clamp-1">{post.content}</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(post.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-5">
              <div className="absolute -top-4 -right-4 opacity-10"><Crown className="w-24 h-24 text-primary" /></div>
              <div className="relative z-10 text-center">
                <img src={storeQris} alt={STORE_NAME} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-lg border-2 border-primary/20" />
                <h2 className="text-xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{STORE_NAME}</h2>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{t("header.tagline", lang)}</p>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{t("home.buy_premium", lang)}</p>
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  <a href={`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent("Halo, saya mau order di Agung Adi Store")}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground shadow-md gap-1.5"><MessageCircle className="w-4 h-4" /> {t("home.contact_wa", lang)}</Button>
                  </a>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTab("voucher")}><Ticket className="w-4 h-4" /> {t("home.claim_voucher", lang)}</Button>
                </div>
              </div>
            </div>

            <Card className="border-dashed border-2 border-primary/20 hover:border-primary/40 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 duration-200" onClick={() => setTab("voucher")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md"><Ticket className="w-6 h-6 text-primary-foreground" /></div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm">{t("home.have_voucher", lang)}</h3>
                  <p className="text-xs text-muted-foreground">{t("home.claim_now", lang)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Voucher Tutorial */}
            <Card className="border border-primary/15 shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-2.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold">Cara Klaim Voucher</h3>
              </div>
              <CardContent className="p-4 space-y-3">
                {[
                  { step: "1", icon: <ShoppingBag className="w-4 h-4 text-primary" />, title: "Beli Produk", desc: "Pilih dan beli produk di tab Produk menggunakan saldo." },
                  { step: "2", icon: <Ticket className="w-4 h-4 text-accent" />, title: "Masukkan Kode Voucher", desc: "Setelah beli, masukkan kode voucher yang didapat di tab Voucher." },
                  { step: "3", icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, title: "Klaim & Dapat Akun!", desc: "Klik Klaim dan dapatkan detail akun produkmu." },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-extrabold text-primary">{item.step}</div>
                    <div>
                      <p className="text-sm font-bold flex items-center gap-1.5">{item.icon} {item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-full gap-1.5 mt-1" onClick={() => setTab("voucher")}>
                  <Ticket className="w-4 h-4" /> Coba Klaim Sekarang
                </Button>
              </CardContent>
            </Card>

            {/* Daily Streak moved to streak tab */}

            {/* Tiket support shortcut */}
            <Card className="border-dashed border-2 border-destructive/20 hover:border-destructive/40 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 duration-200" onClick={() => setTab("tiket")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-destructive to-destructive/70 flex items-center justify-center shadow-md"><AlertCircle className="w-6 h-6 text-destructive-foreground" /></div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm">{t("home.have_issue", lang)}</h3>
                  <p className="text-xs text-muted-foreground">{t("home.submit_ticket", lang)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("home.follow_us", lang)}</p>
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
              <h2 className="text-lg font-extrabold flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> {t("products.title", lang)}</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium">{sortedProducts.length} {t("products.items", lang)}</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t("products.search", lang)} value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-9" />
            </div>

            {/* Dropdown filters */}
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="flex-1 h-9 text-xs">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
                <SelectTrigger className="w-[120px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Terbaru</SelectItem>
                  <SelectItem value="oldest">Terlama</SelectItem>
                </SelectContent>
              </Select>
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
                <Card key={p.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 border-border/50 cursor-pointer" onClick={() => openProduct(p)}>
                  {imgs.length > 0 && (
                    <div className="relative">
                      <ImageCarousel images={imgs} />
                      <div className="absolute top-2 right-2 flex gap-1.5 items-center">
                        <span className="text-xs font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full shadow-md">{formatPrice(p.price)}</span>
                      </div>
                      <button onClick={(e) => toggleLike(p.id, e)}
                        className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-sm px-2 py-1">
                        <Heart className={`w-4 h-4 ${likedIds.has(p.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                        {(productLikeCounts[p.id] || 0) > 0 && <span className="text-[10px] font-bold text-muted-foreground">{productLikeCounts[p.id]}</span>}
                      </button>
                      {p.category && (
                        <div className="absolute bottom-2 left-2">
                          <span className="text-[10px] font-medium bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full">{p.category}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-base flex-1">{p.title}</h3>
                      {imgs.length === 0 && (
                        <button onClick={(e) => toggleLike(p.id, e)} className="flex items-center gap-1">
                          <Heart className={`w-4 h-4 ${likedIds.has(p.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                          {(productLikeCounts[p.id] || 0) > 0 && <span className="text-[10px] font-bold text-muted-foreground">{productLikeCounts[p.id]}</span>}
                        </button>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      {imgs.length === 0 && <span className="text-sm font-extrabold text-primary">{formatPrice(p.price)}</span>}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.stock > 0 ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>
                          {p.stock > 0 ? `✓ Stok: ${p.stock}` : '✗ Habis'}
                        </span>
                        {p.has_warranty && (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-primary/10 text-primary">
                            <Shield className="w-3 h-3 inline mr-0.5" />Garansi
                          </span>
                        )}
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-muted text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> {new Date(p.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "voucher" && (
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" /> {t("voucher.title", lang)}</h2>
            {/* Info: Harus beli dulu */}
            <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 shadow-md">
              <CardContent className="p-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 mt-0.5 shadow">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Cara Mendapatkan Voucher</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Beli produk terlebih dahulu di tab <span className="font-bold text-primary cursor-pointer" onClick={() => setTab("produk")}>Produk</span> atau gunakan <span className="font-bold text-primary cursor-pointer" onClick={() => setTab("saldo")}>Saldo</span>, lalu kode voucher akan diberikan setelah pembayaran berhasil.</p>
                </div>
              </CardContent>
            </Card>

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
              <h2 className="text-lg font-extrabold flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> {t("history.title", lang)}</h2>
            </div>

            {history.length > 0 && (
              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" onClick={toggleSelectAll} className="gap-1 text-xs">
                  <Checkbox checked={history.length > 0 && selectedHistoryIds.size === history.length} className="pointer-events-none" />
                  Pilih Semua ({selectedHistoryIds.size}/{history.length})
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={downloadHistoryPDF} className="gap-1 rounded-full border-primary/30 text-primary hover:bg-primary/10 text-xs">
                    <Download className="w-3 h-3" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadHistoryTXT} className="gap-1 rounded-full border-accent/30 text-accent hover:bg-accent/10 text-xs">
                    <FileText className="w-3 h-3" /> TXT
                  </Button>
                </div>
              </div>
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
                    <div className="flex items-start gap-3 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                      <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="leading-relaxed break-words">{deviceSummary}</span>
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

            {totalHistoryPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="icon" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-sm text-muted-foreground">{historyPage} / {totalHistoryPages}</span>
                <Button variant="outline" size="icon" disabled={historyPage >= totalHistoryPages} onClick={() => setHistoryPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            )}
          </div>
        )}

        {tab === "likes" && (
          <LikesTab
            products={products}
            likedIds={likedIds}
            likedSponsorIds={likedSponsorIds}
            getProductImages={getProductImages}
            toggleLike={toggleLike}
            toggleLikeSponsor={toggleLikeSponsor}
            setSelectedProduct={openProduct}
            setTab={setTab as any}
            lang={lang}
          />
        )}

        {tab === "tiket" && (
          <div className="space-y-4">
            {ticketView === "list" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold flex items-center gap-2"><AlertCircle className="w-5 h-5 text-destructive" /> {t("ticket.title", lang)}</h2>
                  <Button size="sm" onClick={() => setTicketView("create")} className="gap-1"><Send className="w-3 h-3" /> Buat Tiket</Button>
                </div>

                {tickets.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <AlertCircle className="w-16 h-16 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Belum ada tiket.</p>
                    <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setTicketView("create")}><Send className="w-4 h-4" /> Ajukan Keluhan</Button>
                  </div>
                )}

                {tickets.map(t => {
                  const catInfo = TICKET_CATEGORIES.find(c => c.value === (t as any).category) || TICKET_CATEGORIES[TICKET_CATEGORIES.length - 1];
                  return (
                  <Card key={t.id} className="cursor-pointer hover:shadow-lg transition-all" onClick={() => { setActiveTicket(t); setTicketView("chat"); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-primary">Tiket #{t.ticket_number}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.status === "open" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                          {t.status === "open" ? "Terbuka" : "Ditutup"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{catInfo.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(t.created_at).toLocaleString("id-ID")}</p>
                    </CardContent>
                  </Card>
                  );
                })}
              </>
            )}

            {ticketView === "create" && (
              <>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setTicketView("list")}><ChevronLeft className="w-5 h-5" /></Button>
                  <h2 className="text-lg font-extrabold">Buat Tiket Baru</h2>
                </div>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Kategori Masalah</label>
                      <Select value={ticketCategory} onValueChange={setTicketCategory}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih kategori..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input placeholder="Nama Lengkap" value={ticketName} onChange={e => setTicketName(e.target.value)} />
                    <Input placeholder="No HP" value={ticketPhone} onChange={e => setTicketPhone(e.target.value)} />
                    <Textarea placeholder="Jelaskan masalah kamu..." value={ticketDesc} onChange={e => setTicketDesc(e.target.value)} rows={4} />
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">📸 Screenshot Bukti (opsional)</label>
                      {ticketScreenshotPreview ? (
                        <div className="relative inline-block">
                          <img src={ticketScreenshotPreview} alt="Preview" className="max-h-32 rounded-lg border" />
                          <button
                            type="button"
                            onClick={() => { setTicketScreenshot(null); setTicketScreenshotPreview(null); }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                          >×</button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary/40 transition-colors">
                          <ImagePlus className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Pilih gambar...</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setTicketScreenshot(file);
                              const reader = new FileReader();
                              reader.onload = ev => setTicketScreenshotPreview(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                            e.target.value = "";
                          }} />
                        </label>
                      )}
                    </div>
                    <Button className="w-full" onClick={createTicket}><Send className="w-4 h-4 mr-2" /> Kirim Tiket</Button>
                  </CardContent>
                </Card>
              </>
            )}

            {ticketView === "chat" && activeTicket && (
              <>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { setTicketView("list"); setActiveTicket(null); }}><ChevronLeft className="w-5 h-5" /></Button>
                  <div className="flex-1">
                    <h2 className="text-sm font-extrabold">Tiket #{activeTicket.ticket_number}</h2>
                    <p className="text-[10px] text-muted-foreground">{activeTicket.status === "open" ? "🟢 Terbuka" : "🔴 Ditutup"}</p>
                  </div>
                </div>

                <div ref={ticketChatRef} className="bg-muted/30 rounded-xl p-3 space-y-3 max-h-[50vh] overflow-y-auto">
                  {/* Ticket info card */}
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs space-y-1">
                    {activeTicket.category && (
                      <p><strong>Kategori:</strong> {TICKET_CATEGORIES.find(c => c.value === activeTicket.category)?.label || activeTicket.category}</p>
                    )}
                    <p><strong>Nama:</strong> {activeTicket.name}</p>
                    <p><strong>HP:</strong> {activeTicket.phone}</p>
                    <p><strong>Masalah:</strong> {activeTicket.description}</p>
                    {activeTicket.screenshot_url && (
                      <div className="mt-2">
                        <p className="font-bold mb-1">📸 Screenshot:</p>
                        <img src={activeTicket.screenshot_url} alt="Screenshot bukti" className="max-w-full rounded-lg border" />
                      </div>
                    )}
                  </div>

                  {ticketMessages.map(m => (
                    <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.sender_type === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"}`}>
                        {m.sender_type === "admin" && <p className="text-[10px] font-bold text-primary mb-0.5">{STORE_NAME}</p>}
                        {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                        {m.image_url && <img src={m.image_url} className="max-w-full rounded-lg mt-1" alt="" />}
                        <p className={`text-[9px] mt-1 flex items-center gap-0.5 ${m.sender_type === "user" ? "text-primary-foreground/60 justify-end" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          <MessageStatus isRead={m.is_read} isUserMsg={m.sender_type === "user"} />
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {activeTicket.status === "open" ? (
                  <div className="flex gap-2">
                    <label className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80">
                      <ImagePlus className="w-4 h-4 text-muted-foreground" />
                      <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) sendTicketImage(e.target.files[0]); e.target.value = ""; }} />
                    </label>
                    <Input placeholder={t("chat.write_message", lang)} value={ticketMsg} onChange={e => setTicketMsg(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTicketMessage(); } }} className="flex-1" />
                    <Button size="icon" onClick={sendTicketMessage} disabled={!ticketMsg.trim()}><Send className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {t("chat.ticket_closed", lang)}
                    <Button size="sm" variant="outline" className="mt-2 gap-1" onClick={() => setTicketView("create")}><Send className="w-3 h-3" /> {t("ticket.create", lang)}</Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "saldo" && (
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> {t("balance.title", lang)}</h2>

            {!userBalance ? (
              <BalanceAuth
                currentUser={null}
                onLogin={(user) => {
                  localStorage.setItem("balance_visitor_id", user.visitor_id);
                  setUserBalance(user as any);
                  setProfileUsername(user.username);
                  setProfilePhone(user.phone);
                  fetchUserBalance();
                }}
                onLogout={() => {}}
              />
            ) : (
              <>
                {/* Balance Card */}
                <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Hai, {userBalance.username}</p>
                        <p className="text-[11px] text-muted-foreground">{userBalance.phone}</p>
                        <p className="text-3xl font-extrabold text-primary">{formatPrice(userBalance.balance)}</p>
                      </div>
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                        <Wallet className="w-7 h-7 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5 font-bold"
                        onClick={() => { setProfileUsername(userBalance.username); setProfilePhone(userBalance.phone); setShowProfileModal(true); }}>
                        <Edit2 className="w-4 h-4" /> Edit Profil
                      </Button>
                      <Button size="sm" className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground gap-1.5 font-bold"
                        onClick={() => { setShowDepositModal(true); setDepositStep("method"); }}>
                        <ArrowUpCircle className="w-4 h-4" /> {t("deposit.btn", lang)}
                      </Button>
                    </div>
                    {/* PIN Management */}
                    <div className="mt-2">
                      {!hasPin ? (
                        <Button size="sm" variant="outline" className="w-full gap-1.5 font-bold border-primary/30" onClick={() => setShowPinSetup(true)}>
                          <Lock className="w-4 h-4 text-primary" /> Buat PIN Keamanan
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 bg-accent/10 rounded-lg p-2 text-xs text-accent">
                            <Lock className="w-4 h-4" />
                            <span className="font-bold">PIN aktif</span>
                            <span className="text-muted-foreground">— Pembelian dilindungi PIN</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full gap-1.5 text-xs font-bold text-primary"
                            onClick={() => setShowForgotPin(true)}
                          >
                            <KeyRound className="w-4 h-4" /> Lupa PIN / Reset PIN
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Auth: Logout, Switch Account, Login History */}
                <BalanceAuth
                  currentUser={userBalance}
                  onLogin={(user) => {
                    localStorage.setItem("balance_visitor_id", user.visitor_id);
                    setUserBalance(user as any);
                    setProfileUsername(user.username);
                    setProfilePhone(user.phone);
                    fetchUserBalance();
                  }}
                  onLogout={() => {
                    localStorage.removeItem("balance_visitor_id");
                    setUserBalance(null);
                    setBalanceTransactions([]);
                  }}
                />



                {deposits.length > 0 && (
                  <>
                    <h3 className="font-bold text-sm flex items-center gap-1.5"><History className="w-4 h-4" /> {t("deposit.history", lang)}</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <select className="rounded-md border border-input bg-background px-2 py-2 text-[11px]" value={depositHistoryMethodFilter} onChange={e => setDepositHistoryMethodFilter(e.target.value as DepositMethodFilter)}>
                        <option value="all">Semua Metode</option>
                        <option value="qris">QRIS</option>
                        <option value="ewallet">E-Wallet</option>
                      </select>
                      <select className="rounded-md border border-input bg-background px-2 py-2 text-[11px]" value={depositHistoryStatusFilter} onChange={e => setDepositHistoryStatusFilter(e.target.value as DepositStatusFilter)}>
                        <option value="all">Semua Status</option>
                        <option value="pending">Belum Konfirmasi</option>
                        <option value="approved">Disetujui</option>
                        <option value="rejected">Ditolak</option>
                        <option value="cancelled">Dibatalkan</option>
                      </select>
                      <select className="rounded-md border border-input bg-background px-2 py-2 text-[11px]" value={depositHistorySort} onChange={e => setDepositHistorySort(e.target.value as "newest" | "oldest")}>
                        <option value="newest">Terbaru</option>
                        <option value="oldest">Terlama</option>
                      </select>
                    </div>
                    {filteredDeposits.map(dep => (
                      <Card key={dep.id} className="cursor-pointer transition-all hover:shadow-lg" onClick={() => setSelectedDeposit(dep)}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dep.status === "approved" ? "bg-accent/10" : dep.status === "rejected" ? "bg-destructive/10" : "bg-muted"}`}>
                            {dep.status === "approved" ? <CheckCircle2 className="w-5 h-5 text-accent" /> : dep.status === "rejected" ? <X className="w-5 h-5 text-destructive" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{formatPrice(dep.amount)}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">ID: {dep.trx_id}</p>
                            <p className="text-[10px] text-muted-foreground">{dep.payment_method.toUpperCase()} • {new Date(dep.created_at).toLocaleString("id-ID")}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dep.status === "approved" ? "bg-accent/10 text-accent" : dep.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                            {getDepositStatusLabel(dep.status, lang)}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                    {filteredDeposits.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Tidak ada deposit sesuai filter.</p>}
                  </>
                )}

                {/* Transaction History */}
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-1.5"><History className="w-4 h-4" /> {t("balance.transaction_history", lang)}</h3>
                  {balanceTransactions.length > 0 && (
                    <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setShowTxExport(!showTxExport)}>
                      <Download className="w-3 h-3" /> {showTxExport ? "Tutup" : "Ekspor"}
                    </Button>
                  )}
                </div>

                {showTxExport && balanceTransactions.length > 0 && (
                  <div className="space-y-2 bg-muted/30 rounded-xl p-3 border">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={selectedTxIds.size === balanceTransactions.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTxIds(new Set(balanceTransactions.map(tx => tx.id)));
                            } else {
                              setSelectedTxIds(new Set());
                            }
                          }}
                        />
                        <span className="font-bold">Pilih Semua ({balanceTransactions.length})</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">{selectedTxIds.size} dipilih</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full gap-1 text-xs"
                      disabled={selectedTxIds.size === 0}
                      onClick={() => {
                        const selected = balanceTransactions.filter(tx => selectedTxIds.has(tx.id));
                        if (selected.length === 0) return;
                        const doc = new jsPDF();
                        const pageW = doc.internal.pageSize.getWidth();
                        const pageH = doc.internal.pageSize.getHeight();
                        const totalPages = selected.length;
                        selected.forEach((tx, idx) => {
                          if (idx > 0) doc.addPage();
                          // Header
                          doc.setFillColor(41, 98, 255);
                          doc.rect(0, 0, pageW, 50, "F");
                          doc.setTextColor(255, 255, 255);
                          doc.setFontSize(16);
                          doc.setFont("helvetica", "bold");
                          doc.text(STORE_NAME, pageW / 2, 22, { align: "center" });
                          doc.setFontSize(9);
                          doc.setFont("helvetica", "normal");
                          doc.text("Bukti Transaksi Saldo", pageW / 2, 32, { align: "center" });
                          doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, pageW / 2, 40, { align: "center" });
                          // Body
                          doc.setTextColor(0, 0, 0);
                          let y = 65;
                          doc.setFontSize(11);
                          doc.setFont("helvetica", "bold");
                          doc.text(`Transaksi #${idx + 1}`, 20, y);
                          y += 10;
                          doc.setFontSize(10);
                          doc.setFont("helvetica", "normal");
                          if (tx.trx_id) { doc.text(`ID Transaksi: ${tx.trx_id}`, 20, y); y += 7; }
                          doc.text(`Tipe: ${tx.type === "topup" ? "Top Up" : "Pembelian"}`, 20, y); y += 7;
                          doc.text(`Jumlah: ${tx.type === "topup" ? "+" : "-"}${formatPrice(tx.amount)}`, 20, y); y += 7;
                          doc.text(`Tanggal: ${new Date(tx.created_at).toLocaleString("id-ID")}`, 20, y); y += 7;
                          if (tx.description) { doc.text(`Deskripsi: ${tx.description}`, 20, y, { maxWidth: pageW - 40 }); y += 10; }
                          if (userBalance) {
                            y += 5;
                            doc.text(`Username: ${userBalance.username}`, 20, y); y += 7;
                          }
                          // Footer
                          doc.setFontSize(8);
                          doc.setTextColor(150, 150, 150);
                          doc.text(`Halaman ${idx + 1} dari ${totalPages}`, pageW / 2, pageH - 20, { align: "center" });
                          doc.text("Harap simpan bukti ini. Jika ada masalah hubungi admin.", pageW / 2, pageH - 15, { align: "center" });
                          doc.text(`${STORE_NAME} — WA: ${WA_NUMBER}`, pageW / 2, pageH - 10, { align: "center" });
                        });
                        doc.save("riwayat-transaksi-saldo.pdf");
                        toast({ title: `${selected.length} transaksi berhasil diekspor!` });
                      }}
                    >
                      <FileText className="w-3 h-3" /> Download PDF ({selectedTxIds.size})
                    </Button>
                  </div>
                )}

                {balanceTransactions.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">{t("balance.no_transactions", lang)}</p>
                )}
                {balanceTransactions.map(tx => (
                  <Card key={tx.id} className="cursor-pointer transition-all hover:shadow-lg" onClick={() => setSelectedTransaction(tx)}>
                    <CardContent className="p-3 flex items-center gap-3">
                      {showTxExport && (
                        <Checkbox
                          checked={selectedTxIds.has(tx.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedTxIds);
                            if (checked) next.add(tx.id); else next.delete(tx.id);
                            setSelectedTxIds(next);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tx.type === "topup" ? "bg-accent/10" : "bg-destructive/10"}`}>
                        {tx.type === "topup" ? <ArrowUpCircle className="w-5 h-5 text-accent" /> : <ArrowDownCircle className="w-5 h-5 text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{tx.type === "topup" ? t("balance.topup", lang) : t("balance.purchase", lang)}</p>
                        {tx.trx_id && <p className="text-[10px] text-muted-foreground font-mono">ID: {tx.trx_id}</p>}
                        <p className="text-[10px] text-muted-foreground truncate">{tx.description || "-"}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString("id-ID")}</p>
                      </div>
                      <span className={`font-bold text-sm ${tx.type === "topup" ? "text-accent" : "text-destructive"}`}>
                        {tx.type === "topup" ? "+" : "-"}{formatPrice(tx.amount)}
                      </span>
                    </CardContent>
                  </Card>
                ))}

                {/* Transaction Detail Popup */}
                {selectedTransaction && (
                  <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedTransaction(null)}>
                    <div className="bg-background rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base">Detail Transaksi</h3>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedTransaction(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${selectedTransaction.type === "topup" ? "bg-accent/10" : "bg-destructive/10"}`}>
                        {selectedTransaction.type === "topup" ? <ArrowUpCircle className="w-8 h-8 text-accent" /> : <ArrowDownCircle className="w-8 h-8 text-destructive" />}
                      </div>
                      <p className={`text-center font-bold text-2xl ${selectedTransaction.type === "topup" ? "text-accent" : "text-destructive"}`}>
                        {selectedTransaction.type === "topup" ? "+" : "-"}{formatPrice(selectedTransaction.amount)}
                      </p>
                      <div className="space-y-2.5 text-sm">
                        {selectedTransaction.trx_id && (
                          <div className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-2">
                            <span className="text-muted-foreground text-xs">ID Transaksi</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs">{selectedTransaction.trx_id}</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(selectedTransaction.trx_id || ""); toast({ title: "ID Transaksi disalin!" }); }}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Tipe</span>
                          <span className="font-bold text-xs">{selectedTransaction.type === "topup" ? "Top Up" : "Pembelian"}</span>
                        </div>
                        <div className="flex justify-between px-3 py-1.5">
                          <span className="text-muted-foreground text-xs">Tanggal</span>
                          <span className="font-bold text-xs">{new Date(selectedTransaction.created_at).toLocaleString("id-ID")}</span>
                        </div>
                        {selectedTransaction.description && (
                          <div className="px-3 py-1.5">
                            <span className="text-muted-foreground text-xs block mb-1">Deskripsi</span>
                            <span className="text-xs">{selectedTransaction.description}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PlaylistTab always mounted, hidden when not active */}
        <div className={tab === "playlist" ? "" : "hidden"}>
          <PlaylistTab onPlaybackChange={setPlaybackState} onTogglePlay={togglePlayRef} onOpenFullPlayer={openFullPlayerRef} onPlayExternal={playExternalRef} />
        </div>

        {tab === "publik" && (
          <MusicPublicTab onPlaySong={(song) => playExternalRef.current?.(song)} />
        )}

        {tab === "sponsor" && (
          <SponsorBanner likedSponsorIds={likedSponsorIds} onToggleLikeSponsor={toggleLikeSponsor} sponsorLikeCounts={sponsorLikeCounts} />
        )}

        {tab === "streak" && (
          <DailyStreak />
        )}

        <div className={tab === "game" ? "" : "hidden"}>
          <GameTab />
        </div>

        {tab === "plus" && <PlusTab key={userBalance?.visitor_id || "no-user"} />}



        {tab === "update" && (
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" /> Update Web
            </h2>
            <p className="text-xs text-muted-foreground">Riwayat pembaruan dan fitur terbaru {STORE_NAME}.</p>

            {/* April 2026 - Week 2 */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-primary uppercase tracking-wider">🆕 12 April 2026</span>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">v2.5</span>
              </div>
              <ul className="text-[13px] space-y-1 text-muted-foreground">
                <li>✨ Tab <strong>Update Web</strong> baru — riwayat pembaruan</li>
                <li>✨ Bot WA diperlengkap: 20+ perintah</li>
                <li>✨ Pusat Bantuan lebih lengkap</li>
                <li>🔧 Perbaikan bug riwayat transaksi</li>
                <li>🔧 Fix data stale saat ganti akun</li>
                <li>🔧 Real-time update saldo & transaksi</li>
              </ul>
            </div>

            {/* April 2026 - Week 1 */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">🔄 8 April 2026</span>
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold">v2.4</span>
              </div>
              <ul className="text-[13px] space-y-1 text-muted-foreground">
                <li>✨ Paket bundel: Kredit + Streak + Storage</li>
                <li>✨ Flash sale paket streak & kredit</li>
                <li>✨ Admin bisa reset saldo, kredit, streak, storage user</li>
                <li>✨ Admin kelola paket Pro, Bundel, Mantap</li>
                <li>🔧 Fix pembelian kredit & streak gagal</li>
                <li>🔧 Fix error handling edge functions</li>
              </ul>
            </div>

            {/* April 2026 - Early */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">🔄 4 April 2026</span>
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold">v2.3</span>
              </div>
              <ul className="text-[13px] space-y-1 text-muted-foreground">
                <li>✨ Sponsor: Syarat & Ketentuan lengkap</li>
                <li>✨ Tombol Rekber WA kirim detail produk otomatis</li>
                <li>✨ Pusat Bantuan: panduan Sponsor & Rekber</li>
                <li>✨ FAQ diperluas 20+ pertanyaan</li>
                <li>🔧 Fix navigasi dan banner discovery</li>
              </ul>
            </div>

            {/* April 2026 - Launch */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">🚀 1 April 2026</span>
                <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-bold">v2.0</span>
              </div>
              <ul className="text-[13px] space-y-1 text-muted-foreground">
                <li>🚀 Peluncuran <strong>{STORE_NAME}</strong> v2.0</li>
                <li>✨ Dukungan {LANGUAGES.length}+ bahasa dengan bendera negara</li>
                <li>✨ Fitur musik: streaming, playlist, lirik sinkron</li>
                <li>✨ Voucher musik (kapasitas & diskon)</li>
                <li>✨ Sistem deposit QRIS & E-Wallet</li>
                <li>✨ Chat produk real-time dengan gambar</li>
                <li>✨ Sistem notifikasi lengkap</li>
                <li>✨ Tema emas premium</li>
                <li>✨ PWA + dukungan offline</li>
                <li>✨ Keranjang belanja multi-produk</li>
                <li>✨ Game AI: 8+ game seru</li>
                <li>✨ Sistem kredit game & Premium unlimited</li>
                <li>✨ Daily streak & langganan streak</li>
                <li>✨ Sponsor / iklan produk pihak ketiga</li>
                <li>✨ Sistem tiket dukungan dengan 18+ kategori</li>
                <li>✨ Pusat Bantuan komprehensif</li>
              </ul>
            </div>

            {/* Copyright */}
            <div className="text-center pt-4 pb-2 border-t border-border space-y-1">
              <p className="text-xs font-bold text-foreground">© 2026 {STORE_NAME}</p>
              <p className="text-[11px] text-muted-foreground">Murah & Terpercaya — Semua hak dilindungi.</p>
              <div className="flex items-center justify-center gap-3 mt-2">
                <a href={SOCIAL_LINKS.whatsapp} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">WhatsApp</a>
                <a href={SOCIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">YouTube</a>
                <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">Instagram</a>
                <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">TikTok</a>
              </div>
            </div>
          </div>
        )}

        {tab === "adminpost" && (
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Postingan Admin
            </h2>
            {adminPosts.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Belum ada postingan.</p>
              </div>
            )}
            {adminPosts.map(post => (
              <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-all">
                {post.image_url && (
                  <img src={post.image_url} alt={post.title} className="w-full h-48 object-cover" />
                )}
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-bold text-base">{post.title}</h3>
                  {post.content && <p className="text-xs text-muted-foreground whitespace-pre-line">{post.content}</p>}
                  {post.link_url && (
                    <a href={post.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                      <ExternalLink className="w-3 h-3" /> Buka Link
                    </a>
                  )}
                  {[
                    { val: post.whatsapp, label: "WhatsApp", href: post.whatsapp?.startsWith("http") ? post.whatsapp : `https://wa.me/62${(post.whatsapp || "").replace(/^0/, "")}` },
                    { val: post.instagram, label: "Instagram", href: post.instagram?.startsWith("http") ? post.instagram : `https://instagram.com/${post.instagram}` },
                    { val: post.tiktok, label: "TikTok", href: post.tiktok?.startsWith("http") ? post.tiktok : `https://tiktok.com/@${post.tiktok}` },
                    { val: post.youtube, label: "YouTube", href: post.youtube?.startsWith("http") ? post.youtube : `https://youtube.com/@${post.youtube}` },
                    { val: post.twitter, label: "X/Twitter", href: post.twitter?.startsWith("http") ? post.twitter : `https://twitter.com/${post.twitter}` },
                    { val: post.facebook, label: "Facebook", href: post.facebook?.startsWith("http") ? post.facebook : `https://facebook.com/${post.facebook}` },
                  ].filter(s => s.val).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        { val: post.whatsapp, label: "WhatsApp", href: post.whatsapp?.startsWith("http") ? post.whatsapp : `https://wa.me/62${(post.whatsapp || "").replace(/^0/, "")}` },
                        { val: post.instagram, label: "Instagram", href: post.instagram?.startsWith("http") ? post.instagram : `https://instagram.com/${post.instagram}` },
                        { val: post.tiktok, label: "TikTok", href: post.tiktok?.startsWith("http") ? post.tiktok : `https://tiktok.com/@${post.tiktok}` },
                        { val: post.youtube, label: "YouTube", href: post.youtube?.startsWith("http") ? post.youtube : `https://youtube.com/@${post.youtube}` },
                        { val: post.twitter, label: "X/Twitter", href: post.twitter?.startsWith("http") ? post.twitter : `https://twitter.com/${post.twitter}` },
                        { val: post.facebook, label: "Facebook", href: post.facebook?.startsWith("http") ? post.facebook : `https://facebook.com/${post.facebook}` },
                      ].filter(s => s.val).map(s => (
                        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          {s.label}
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground pt-1">
                    <CalendarDays className="w-3 h-3 inline mr-1" />
                    {new Date(post.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Mini Player - shown when music is playing and not on playlist tab */}
      {playbackState.song && tab !== "playlist" && (
        <div
          className="fixed bottom-[52px] left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-primary/20 shadow-lg cursor-pointer"
          onClick={() => openFullPlayerRef.current?.()}
        >
          <div className="max-w-lg mx-auto flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {playbackState.song.cover_url ? (
                <img src={playbackState.song.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Music className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{playbackState.song.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{playbackState.song.artist}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); togglePlayRef.current?.(); }}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
            >
              {playbackState.isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (() => {
        const imgs = getProductImages(selectedProduct.id);
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => openProduct(null)}>
            <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
              {imgs.length > 0 && <ImageCarousel images={imgs} className="w-full h-56" />}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold">{selectedProduct.title}</h2>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {selectedProduct.category && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{selectedProduct.category}</span>}
                      {selectedProduct.has_warranty && <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full"><Shield className="w-3 h-3 inline mr-0.5" />Garansi</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleLike(selectedProduct.id)}>
                      <Heart className={`w-6 h-6 ${likedIds.has(selectedProduct.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                    </button>
                    <button onClick={() => openProduct(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-primary">{formatPrice(selectedProduct.price)}</p>
                {/* Wholesale prices */}
                {(() => {
                  const tiers = getProductWholesaleTiers(selectedProduct.id);
                  if (tiers.length === 0) return null;
                  return (
                    <div className="bg-accent/5 border border-accent/20 rounded-lg p-2.5 space-y-1">
                      <p className="text-[10px] font-bold text-accent uppercase tracking-wider">💰 Harga Grosir</p>
                      {tiers.map((t: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Beli ≥{t.min_quantity} pcs</span>
                          <span className="font-bold text-accent">{formatPrice(t.price_per_item)} /pcs</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {selectedProduct.description && <p className="text-sm text-muted-foreground leading-relaxed">{selectedProduct.description}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${selectedProduct.stock > 0 ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>
                    {selectedProduct.stock > 0 ? `✓ Stok: ${selectedProduct.stock}` : '✗ Habis'}
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-muted text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> {new Date(selectedProduct.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>

                {/* Four buttons: Cart + Chat + Beli Saldo + WhatsApp */}
                <div className="grid grid-cols-4 gap-2">
                  <Button className="h-11 bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground font-bold gap-1 rounded-xl text-xs"
                    disabled={selectedProduct.stock <= 0}
                    onClick={() => { addToCart(selectedProduct); }}>
                    <ShoppingCart className="w-4 h-4" /> Keranjang
                  </Button>
                  <Button className="h-11 bg-gradient-to-r from-primary to-primary/80 font-bold gap-1 rounded-xl text-xs"
                    onClick={() => openProductChat(selectedProduct)}>
                    <MessageCircle className="w-4 h-4" /> Chat
                  </Button>
                  <Button className="h-11 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold gap-1 rounded-xl text-xs"
                    disabled={!userBalance || userBalance.balance < selectedProduct.price || selectedProduct.stock <= 0}
                    onClick={() => { setBuyProduct(selectedProduct); setBuyQuantity(1); setShowBuySaldo(true); }}>
                    <Wallet className="w-4 h-4" /> Saldo
                  </Button>
                  <Button className="h-11 bg-gradient-to-r from-accent to-accent/80 text-accent-foreground font-bold gap-1 rounded-xl text-xs"
                    onClick={() => setShowWaForm(true)}>
                    <ShoppingBag className="w-4 h-4" /> WA
                  </Button>
                </div>
                {userBalance && userBalance.balance < selectedProduct.price && (
                  <p className="text-[10px] text-destructive text-center">Saldo tidak cukup. <button className="underline text-primary" onClick={() => { openProduct(null); setTab("saldo"); }}>Deposit saldo →</button></p>
                )}
                {!userBalance && (
                  <p className="text-[10px] text-muted-foreground text-center">Buat akun saldo untuk beli pakai saldo. <button className="underline text-primary" onClick={() => { openProduct(null); setTab("saldo"); }}>Daftar →</button></p>
                )}

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

      {/* WhatsApp Form Modal */}
      {showWaForm && selectedProduct && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowWaForm(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">Beli via WhatsApp</h3>
              <button onClick={() => setShowWaForm(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="font-bold text-sm">{selectedProduct.title}</p>
              <p className="text-primary font-extrabold">{formatPrice(selectedProduct.price)}</p>
            </div>
            <div className="space-y-3">
              <Input placeholder="Username / Nama" value={waUsername} onChange={e => setWaUsername(e.target.value)} />
              <Input placeholder="No HP" value={waPhone} onChange={e => setWaPhone(e.target.value)} />
              <Textarea placeholder="Keterangan tambahan (opsional)" value={waDesc} onChange={e => setWaDesc(e.target.value)} rows={2} />
              <Button className="w-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground font-bold gap-2" onClick={sendWhatsApp}>
                <MessageCircle className="w-4 h-4" /> Kirim ke WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Product Chat Modal */}
      {showProductChat && productChatProduct && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowProductChat(false)}>
          <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            {/* Chat Header */}
            <div className="border-b border-border p-4 flex items-center gap-3">
              <button onClick={() => setShowProductChat(false)}><ChevronLeft className="w-5 h-5" /></button>
              <img src={storeQris} className="w-9 h-9 rounded-full object-cover" alt="" />
              <div className="flex-1">
                <p className="font-bold text-sm">{STORE_NAME}</p>
                <p className="text-[10px] text-muted-foreground">{t("chat.reply_time", lang)}</p>
              </div>
              <button onClick={() => { setShowChatHistory(true); setShowProductChat(false); }}>
                <History className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Chat Messages */}
            <div ref={productChatRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[50vh]">
              {productChatMessages.map(m => (
                <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.sender_type === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                    {m.sender_type === "admin" && <p className="text-[10px] font-bold text-primary mb-0.5">{STORE_NAME}</p>}
                    {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                    {m.image_url && <img src={m.image_url} className="max-w-full rounded-lg mt-1" alt="" />}
                    <p className={`text-[9px] mt-1 flex items-center gap-0.5 ${m.sender_type === "user" ? "text-primary-foreground/60 justify-end" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      <MessageStatus isRead={m.is_read} isUserMsg={m.sender_type === "user"} />
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="border-t border-border p-3 flex gap-2">
              <label className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80">
                <ImagePlus className="w-4 h-4 text-muted-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) sendProductChatImage(e.target.files[0]); e.target.value = ""; }} />
              </label>
              <Input placeholder={t("chat.write_message", lang)} value={productChatMsg} onChange={e => setProductChatMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendProductChatMessage(); } }} className="flex-1" />
              <Button size="icon" onClick={sendProductChatMessage} disabled={!productChatMsg.trim()}><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* Product Chat History Modal */}
      {showChatHistory && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowChatHistory(false)}>
          <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">Riwayat Chat</h3>
              <button onClick={() => setShowChatHistory(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            {productChatHistory.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Belum ada riwayat chat.</p>}
            {productChatHistory.map(ch => {
              const prod = products.find(p => p.id === ch.product_id);
              return (
                <Card key={ch.id} className="cursor-pointer hover:shadow-lg transition-all" onClick={() => {
                  if (prod) {
                    setProductChatProduct(prod);
                    setProductChat(ch);
                    loadProductChatMessages(ch.id);
                    setShowChatHistory(false);
                    setShowProductChat(true);
                  }
                }}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <img src={storeQris} className="w-9 h-9 rounded-full object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{prod?.title || "Produk"}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(ch.created_at).toLocaleString("id-ID")}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${ch.status === "open" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                      {ch.status === "open" ? "Aktif" : "Ditutup"}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Help Center Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-card w-full max-w-sm max-h-[85vh] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 pb-3 shrink-0">
              <div>
                <h3 className="font-extrabold text-lg">{t("help.title", lang)}</h3>
                <p className="text-[11px] text-muted-foreground">Web v2.0 — April 2026 — {STORE_NAME}</p>
              </div>
              <button onClick={() => setShowHelp(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto px-5 pb-5 space-y-4 text-sm text-muted-foreground">

              {/* Tentang Aplikasi */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📱 Tentang Aplikasi</p>
                <div className="space-y-1 text-[13px]">
                  <p><strong>{STORE_NAME}</strong> adalah platform digital terpercaya untuk pembelian akun premium, voucher, dan produk digital lainnya.</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Didirikan untuk memberikan kemudahan transaksi digital</li>
                    <li>Mendukung <strong>{LANGUAGES.length}+ bahasa</strong> dari seluruh dunia</li>
                    <li>Tersedia sebagai PWA (Progressive Web App) — bisa diinstal di HP</li>
                    <li>Mode gelap, terang, dan emas untuk kenyamanan visual</li>
                    <li>Tersedia offline untuk akses kapan saja</li>
                  </ul>
                </div>
              </div>

              {/* Cara Order */}
              <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🛒 Cara Order Produk</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[13px]">
                  <li>Buka tab <strong>Produk</strong>, pilih produk yang diinginkan</li>
                  <li>Klik <strong>Beli via WhatsApp</strong> atau <strong>Beli dengan Saldo</strong></li>
                  <li>Jika via WA: lakukan pembayaran sesuai instruksi admin</li>
                  <li>Admin akan mengirimkan kode voucher</li>
                  <li>Klaim voucher di tab <strong>Voucher</strong></li>
                </ol>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">💡 Tips:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Beli banyak sekaligus dengan fitur <strong>keranjang</strong></li>
                    <li>Gunakan <strong>voucher diskon</strong> untuk harga lebih hemat</li>
                    <li>Chat admin jika butuh rekomendasi produk</li>
                  </ul>
                </div>
              </div>

              {/* Cara Klaim Voucher */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎫 Cara Klaim Voucher</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[13px]">
                  <li>Buka tab <strong>Voucher</strong></li>
                  <li>Masukkan kode voucher yang diberikan admin</li>
                  <li>Klik tombol <strong>Klaim</strong></li>
                  <li>Data akun/informasi produk akan ditampilkan</li>
                  <li>Salin data atau <strong>download PDF</strong> sebagai bukti</li>
                </ol>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">⚠️ Penting:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Kode voucher hanya bisa digunakan <strong>satu kali</strong></li>
                    <li>Simpan data akun dengan aman setelah klaim</li>
                    <li>Jangan bagikan kode voucher ke orang lain</li>
                  </ul>
                </div>
              </div>

              {/* Fitur Saldo */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">💰 Fitur Saldo</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Daftar akun saldo di tab <strong>Saldo</strong> (gratis)</li>
                  <li>Isi saldo melalui <strong>deposit QRIS</strong> atau <strong>E-Wallet</strong></li>
                  <li>Beli produk langsung tanpa chat WA</li>
                  <li>Voucher otomatis diberikan setelah pembelian berhasil</li>
                  <li>Cek riwayat transaksi lengkap</li>
                  <li>Keamanan akun dengan <strong>PIN 6 digit</strong></li>
                </ul>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">🔐 Keamanan PIN:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>PIN diperlukan untuk setiap transaksi pembelian</li>
                    <li>Bisa diubah kapan saja melalui pengaturan saldo</li>
                    <li>Lupa PIN? Hubungi admin untuk reset</li>
                  </ul>
                </div>
              </div>

              {/* Fitur Deposit */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">💳 Cara Deposit Saldo</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[13px]">
                  <li>Buka tab <strong>Saldo</strong>, klik tombol <strong>Deposit</strong></li>
                  <li>Pilih metode: <strong>QRIS</strong> atau <strong>E-Wallet</strong></li>
                  <li>Masukkan nominal deposit</li>
                  <li>Lakukan pembayaran sesuai instruksi</li>
                  <li>Masukkan <strong>ID Transaksi</strong> sebagai bukti</li>
                  <li>Kirim konfirmasi ke admin via WhatsApp</li>
                  <li>Admin akan memverifikasi dan saldo otomatis masuk</li>
                </ol>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">⏱️ Waktu Proses:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>QRIS: biasanya <strong>5-15 menit</strong></li>
                    <li>E-Wallet: <strong>15-60 menit</strong></li>
                    <li>Status deposit bisa dicek di riwayat deposit</li>
                  </ul>
                </div>
              </div>

              {/* Fitur Musik */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎵 Fitur Musik</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Dengarkan musik gratis dari koleksi admin</li>
                  <li>Buat <strong>playlist pribadi</strong> sesuai selera</li>
                  <li>Fitur <strong>lirik sinkron</strong> — lirik berjalan sesuai lagu</li>
                  <li>Simpan musik untuk didengar <strong>offline</strong></li>
                  <li>Upgrade penyimpanan dengan <strong>voucher musik</strong></li>
                </ul>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">📦 Penyimpanan Musik:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Default: <strong>100 MB</strong> gratis</li>
                    <li>Tambah kapasitas dengan <strong>voucher kapasitas</strong></li>
                    <li>Kuota bersifat <strong>akumulatif</strong> — terus bertambah</li>
                  </ul>
                </div>
              </div>

              {/* Fitur Like */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">❤️ Fitur Suka / Like</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Tekan ikon hati di produk untuk menyimpannya</li>
                  <li>Lihat semua produk favorit di tab <strong>Suka</strong></li>
                  <li>Akses cepat ke produk yang sering dibeli</li>
                </ul>
              </div>

              {/* Tiket & Chat */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎧 Dukungan & Bantuan</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li><strong>Tiket Keluhan:</strong> buat tiket di tab Tiket untuk masalah serius</li>
                  <li><strong>Chat Produk:</strong> tanya langsung soal produk via chat</li>
                  <li>Admin biasanya membalas dalam <strong>5-10 menit</strong></li>
                  <li>Bisa kirim <strong>foto/gambar</strong> dalam chat</li>
                  <li>Status tiket: <strong>Terbuka → Ditutup</strong></li>
                  <li>Pilih <strong>kategori masalah</strong> saat buat tiket (Akun, Saldo, Sponsor, Penipu, dll)</li>
                  <li>Lampirkan <strong>screenshot bukti</strong> agar admin lebih cepat memproses</li>
                  <li>Tiket bisa dilihat kembali kapan saja di tab Tiket</li>
                  <li>Setiap tiket punya <strong>nomor unik</strong> untuk pelacakan</li>
                  <li>Notifikasi otomatis saat admin membalas tiket</li>
                </ul>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">📝 Kategori Tiket yang Tersedia:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>Akun/Login</strong> — masalah login, visitor ID hilang</li>
                    <li><strong>Voucher</strong> — kode tidak bisa diklaim, voucher expired</li>
                    <li><strong>Saldo/Deposit</strong> — deposit belum masuk, saldo berkurang</li>
                    <li><strong>Sponsor</strong> — produk sponsor bermasalah</li>
                    <li><strong>Lapor Penipu</strong> — laporkan penjual/pembeli yang menipu</li>
                    <li><strong>Lagu/Musik</strong> — lagu error, tidak bisa diputar</li>
                    <li><strong>Refund</strong> — permintaan pengembalian dana</li>
                    <li><strong>Garansi</strong> — klaim garansi produk</li>
                    <li><strong>PIN/Keamanan</strong> — lupa PIN, akun dicurigai dibobol</li>
                    <li><strong>Bug/Error</strong> — error tampilan atau fitur tidak berfungsi</li>
                    <li><strong>Saran</strong> — ide atau masukan untuk pengembangan</li>
                  </ul>
                </div>
              </div>

              {/* Cara Buat Tiket */}
              <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📋 Cara Membuat Tiket</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[13px]">
                  <li>Buka tab <strong>Tiket</strong> di navigasi bawah</li>
                  <li>Klik tombol <strong>Buat Tiket</strong></li>
                  <li>Pilih <strong>kategori masalah</strong> dari dropdown</li>
                  <li>Isi <strong>nama lengkap</strong> dan <strong>nomor HP</strong></li>
                  <li>Jelaskan masalah secara detail di kolom deskripsi</li>
                  <li>Lampirkan <strong>screenshot bukti</strong> jika ada (sangat disarankan!)</li>
                  <li>Klik <strong>Kirim Tiket</strong></li>
                  <li>Anda akan langsung masuk ke <strong>ruang chat</strong> tiket</li>
                  <li>Tunggu balasan admin — biasanya <strong>5-30 menit</strong></li>
                </ol>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">💡 Tips Membuat Tiket Efektif:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Pilih kategori yang <strong>tepat</strong> agar admin langsung paham</li>
                    <li>Sertakan <strong>detail spesifik</strong>: waktu kejadian, nama produk, nominal</li>
                    <li>Lampirkan screenshot yang <strong>jelas dan lengkap</strong></li>
                    <li>Jangan buat tiket duplikat — cukup satu tiket per masalah</li>
                    <li>Respon balasan admin agar proses lebih cepat</li>
                  </ul>
                </div>
              </div>

              {/* Keranjang Belanja */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🛒 Keranjang Belanja</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Tambah beberapa produk sekaligus ke keranjang</li>
                  <li>Atur jumlah masing-masing produk</li>
                  <li>Lihat <strong>total harga</strong> otomatis dihitung</li>
                  <li>Checkout via <strong>WhatsApp</strong> atau <strong>Saldo</strong></li>
                  <li>Gunakan <strong>voucher diskon</strong> untuk potongan harga</li>
                  <li>Hapus item satu per satu atau kosongkan sekaligus</li>
                </ul>
              </div>

              {/* Upload Musik Publik */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎤 Musik Publik (Upload Lagu)</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Upload lagu karyamu sendiri agar bisa didengar semua orang</li>
                  <li>Lagu akan melalui <strong>pemeriksaan AI copyright</strong> otomatis</li>
                  <li>Status lagu: <strong>Pending → Approved / Rejected</strong></li>
                  <li>Admin bisa memberikan catatan jika lagu ditolak</li>
                  <li>Atur visibilitas: <strong>publik</strong> atau <strong>privat</strong></li>
                  <li>Tambahkan cover, artis, dan deskripsi untuk tampilan menarik</li>
                  <li>Kapasitas upload tergantung <strong>kuota penyimpanan</strong> Anda</li>
                </ul>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">⚠️ Aturan Upload:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Hanya upload lagu yang Anda miliki haknya</li>
                    <li>Dilarang upload konten SARA atau melanggar hukum</li>
                    <li>Lagu yang melanggar copyright akan otomatis ditolak</li>
                    <li>Admin berhak menghapus lagu yang melanggar ketentuan</li>
                  </ul>
                </div>
              </div>

              {/* Profil Musik */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">👤 Profil Musik</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Buat profil musik dengan <strong>username</strong> unik</li>
                  <li>Upload <strong>foto profil</strong> (avatar)</li>
                  <li>Tambahkan <strong>deskripsi/bio</strong> tentang diri Anda</li>
                  <li>Profil tampil di lagu yang Anda upload</li>
                  <li>Orang lain bisa <strong>follow</strong> profil Anda</li>
                  <li>Lihat jumlah <strong>followers</strong> dan <strong>following</strong></li>
                </ul>
              </div>

              {/* Info Perangkat */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📱 Info Perangkat & Visitor ID</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li><strong>Visitor ID</strong> adalah identitas unik perangkat Anda</li>
                  <li>Digunakan untuk menghubungkan saldo, riwayat, dan preferensi</li>
                  <li>Setiap perangkat mendapat Visitor ID berbeda</li>
                  <li>Jika mengganti HP/browser, Visitor ID akan berubah</li>
                  <li>Hubungi admin untuk <strong>memindahkan saldo</strong> ke perangkat baru</li>
                  <li>Jangan hapus data browser agar Visitor ID tidak hilang</li>
                </ul>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">⚠️ Penting tentang Visitor ID:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Clear cache / data browser = Visitor ID <strong>hilang</strong></li>
                    <li>Mode incognito = Visitor ID <strong>sementara</strong></li>
                    <li>Gunakan browser biasa untuk menjaga Visitor ID tetap</li>
                  </ul>
                </div>
              </div>

              {/* Multi-bahasa */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🌍 Multi-Bahasa</p>
                <div className="space-y-1 text-[13px]">
                  <p>Aplikasi mendukung <strong>{LANGUAGES.length}+ bahasa</strong> dari seluruh dunia:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>🌏 <strong>Asia:</strong> Indonesia, Melayu, Jepang, Korea, China, Hindi, Thai, Vietnam, dll</li>
                    <li>🌍 <strong>Eropa:</strong> Inggris, Prancis, Jerman, Spanyol, Italia, Rusia, dll</li>
                    <li>🌎 <strong>Amerika:</strong> Portugis Brasil, Spanyol Meksiko, dll</li>
                    <li>🌍 <strong>Afrika:</strong> Swahili, Amharik, Hausa, Zulu, dll</li>
                    <li>🕌 <strong>Timur Tengah:</strong> Arab (16+ varian), Ibrani, Kurdi, dll</li>
                    <li>🏝️ <strong>Oseania:</strong> Māori, Samoa, Tonga, dll</li>
                  </ul>
                  <p className="mt-1">Ubah bahasa melalui tombol <strong>bendera</strong> di header.</p>
                </div>
              </div>

              {/* PWA & Offline */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📲 Install & Offline</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Instal aplikasi ke homescreen HP tanpa app store</li>
                  <li>Buka seperti aplikasi native dengan layar penuh</li>
                  <li>Data tersimpan di cache untuk <strong>akses offline</strong></li>
                  <li>Audio musik bisa dimainkan offline (jika sudah di-cache)</li>
                  <li>Sinkronisasi otomatis saat koneksi kembali</li>
                </ul>
              </div>

              {/* Tema & Tampilan */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎨 Tema & Tampilan</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>☀️ <strong>Mode Terang</strong> — tampilan bersih dan cerah</li>
                  <li>🌙 <strong>Mode Gelap</strong> — nyaman di malam hari</li>
                  <li>👑 <strong>Mode Emas</strong> — tampilan premium eksklusif</li>
                  <li>📱 <strong>Mode Perangkat</strong> — mengikuti pengaturan HP</li>
                </ul>
              </div>

              {/* Keamanan */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🛡️ Keamanan Akun</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Identifikasi unik menggunakan <strong>Visitor ID</strong></li>
                  <li>Transaksi dilindungi dengan <strong>PIN 6 digit</strong></li>
                  <li>Reset PIN tersedia melalui admin</li>
                  <li>Tidak perlu email atau password — lebih simpel</li>
                  <li>Data terenkripsi di server</li>
                </ul>
              </div>

              {/* Sponsor / Iklan Produk */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🏪 Sponsor / Iklan Produk</p>
                <div className="space-y-1 text-[13px]">
                  <p><strong>Sponsor</strong> adalah fitur iklan produk dari penjual pihak ketiga yang ditampilkan di platform. Admin hanya menyediakan tempat iklan.</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>Apa itu sponsor?</strong> Penjual membayar admin untuk mengiklankan produk mereka di platform selama durasi tertentu.</li>
                    <li><strong>Cara membeli dengan aman:</strong> Selalu gunakan layanan <strong>Rekber (Rekening Bersama)</strong> via Admin WA untuk menghindari penipuan.</li>
                    <li><strong>Cara menggunakan rekber:</strong> Klik tombol "Mohon Rekber Admin (WA)" pada halaman sponsor, pesan otomatis akan terkirim ke admin.</li>
                    <li><strong>Cara melaporkan penjual bermasalah:</strong> Buat tiket di tab Tiket atau hubungi admin WA 085769302532 dengan bukti screenshot.</li>
                    <li><strong>Produk admin vs produk sponsor:</strong> Produk admin dijual langsung dan dijamin. Produk sponsor dijual oleh pihak ketiga — admin tidak bertanggung jawab atas kualitas produk sponsor.</li>
                  </ul>
                </div>
              </div>

              {/* Cara Rekber */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🔄 Cara Rekber (Rekening Bersama)</p>
                <div className="space-y-1 text-[13px]">
                  <p><strong>Rekber</strong> adalah layanan perantara transaksi melalui admin untuk memastikan keamanan pembeli dan penjual.</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li><strong>Pembeli</strong> klik tombol "Mohon Rekber Admin (WA)" di halaman sponsor — detail produk otomatis terkirim.</li>
                    <li><strong>Admin</strong> menghubungi penjual untuk konfirmasi ketersediaan produk.</li>
                    <li><strong>Pembeli</strong> mengirimkan uang ke admin (bukan langsung ke penjual).</li>
                    <li><strong>Penjual</strong> mengirimkan produk ke pembeli. Pembeli mengecek produk.</li>
                    <li>Jika produk sesuai, <strong>admin meneruskan uang ke penjual</strong>. Jika tidak sesuai, uang dikembalikan ke pembeli.</li>
                  </ol>
                  <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                    <p className="font-semibold text-foreground">💡 Kapan harus pakai rekber?</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><strong>Selalu</strong> saat membeli produk sponsor dari penjual yang belum dikenal</li>
                      <li>Saat transaksi bernilai besar</li>
                      <li>Saat penjual baru atau belum punya reputasi</li>
                    </ul>
                    <p className="mt-1 font-semibold text-foreground">💰 Biaya rekber: <strong>Gratis</strong> (tidak dipungut biaya tambahan)</p>
                  </div>
                </div>
              </div>

              {/* Keamanan Transaksi Sponsor */}
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">⚠️ Keamanan Transaksi Sponsor</p>
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-foreground">🛡️ Tips agar tidak tertipu:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Selalu gunakan <strong>rekber admin</strong> untuk setiap transaksi sponsor</li>
                    <li>Cek <strong>deskripsi, stok, dan garansi</strong> produk sebelum membeli</li>
                    <li>Simpan <strong>screenshot percakapan dan bukti transfer</strong></li>
                    <li>Jangan transfer langsung ke penjual tanpa melalui rekber</li>
                    <li>Waspada jika penjual menolak menggunakan rekber</li>
                  </ul>
                  <p className="mt-2 font-semibold text-foreground">✅ Ciri-ciri penjual terpercaya:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Bersedia menggunakan rekber admin</li>
                    <li>Deskripsi produk jelas dan detail</li>
                    <li>Memiliki garansi produk</li>
                    <li>Responsif dan komunikatif</li>
                    <li>Memiliki sosial media yang aktif</li>
                  </ul>
                  <p className="mt-2 font-semibold text-foreground">🚨 Jika tertipu, lakukan:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Screenshot semua bukti (chat, transfer, produk)</li>
                    <li>Buat <strong>tiket keluhan</strong> di tab Tiket</li>
                    <li>Hubungi admin WA <strong>085769302532</strong></li>
                    <li>Admin akan membantu investigasi dan tindakan</li>
                  </ol>
                  <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                    <p className="font-semibold text-foreground">⚖️ Hak Pembeli & Penjual:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><strong>Pembeli:</strong> berhak mendapat produk sesuai deskripsi, refund jika produk tidak sesuai (via rekber)</li>
                      <li><strong>Penjual:</strong> berhak mendapat pembayaran setelah produk dikonfirmasi pembeli</li>
                      <li>Komplain dilayani <strong>maksimal 1x24 jam</strong> setelah transaksi</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Notifikasi */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🔔 Sistem Notifikasi</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Notifikasi real-time untuk setiap aktivitas akun</li>
                  <li>Pemberitahuan saat <strong>deposit disetujui</strong></li>
                  <li>Info saat ada <strong>balasan chat</strong> dari admin</li>
                  <li>Update status <strong>tiket keluhan</strong></li>
                  <li>Tandai semua dibaca dengan satu klik</li>
                  <li>Ikon lonceng di header menunjukkan <strong>jumlah notifikasi belum dibaca</strong></li>
                </ul>
              </div>

              {/* Game */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎮 Game AI</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li><strong>8 game seru</strong> melawan AI: Suit, Tebak Kata, Tebak Gambar, Teka-Teki, Tebak Angka, Tebak Barang, Ular Tangga, Ludo King</li>
                  <li>Setiap game <strong>gratis dimainkan</strong> tanpa batasan harian</li>
                  <li>Sistem <strong>kredit game</strong> — beli kredit atau paket <strong>Premium unlimited</strong></li>
                  <li>Premium memberikan akses <strong>tanpa batas</strong> hingga tanggal kedaluwarsa</li>
                  <li>Game tebakan punya <strong>3 nyawa</strong> (maksimal 3 kesalahan per ronde)</li>
                  <li>Game papan (Ular Tangga & Ludo) punya <strong>animasi bidak</strong> dan giliran AI otomatis</li>
                  <li>Kredit bisa dibeli dengan <strong>saldo akun</strong> atau voucher diskon game</li>
                  <li>Tingkat kesulitan bervariasi: Mudah, Sedang, Sulit, Pro, Sangat Pro</li>
                </ul>
              </div>

              {/* FAQ */}
              <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 space-y-2">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">❓ FAQ (Pertanyaan Umum)</p>
                <div className="space-y-2 text-[13px]">
                  <div>
                    <p className="font-semibold text-foreground">Q: Apakah aman bertransaksi di sini?</p>
                    <p>A: Ya, semua transaksi dilindungi dengan PIN dan data terenkripsi.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Berapa lama proses deposit?</p>
                    <p>A: QRIS 5-15 menit, E-Wallet 15-60 menit (jam kerja).</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Bagaimana jika voucher tidak bisa diklaim?</p>
                    <p>A: Pastikan kode benar dan belum diklaim sebelumnya. Hubungi admin jika masih bermasalah.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Bisa refund jika produk bermasalah?</p>
                    <p>A: Ya, ajukan tiket keluhan dengan kategori "Refund / Pengembalian Dana" dan admin akan memproses.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Apakah bisa diakses di desktop?</p>
                    <p>A: Ya, aplikasi responsif dan bisa diakses dari browser manapun.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Bagaimana cara mengganti bahasa?</p>
                    <p>A: Klik ikon bendera di header, cari bahasa yang diinginkan.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Apa itu voucher musik?</p>
                    <p>A: Kode khusus untuk menambah kapasitas penyimpanan musik atau mendapat diskon.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Apa itu rekber?</p>
                    <p>A: Rekber (Rekening Bersama) adalah layanan perantara transaksi melalui admin. Uang pembeli ditahan admin sampai produk diterima dan dikonfirmasi. Jika produk tidak sesuai, uang dikembalikan ke pembeli.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Apakah produk sponsor dijamin admin?</p>
                    <p>A: Tidak. Admin hanya menyediakan platform iklan. Produk sponsor dijual oleh pihak ketiga. Gunakan rekber untuk keamanan transaksi.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Bagaimana jika penjual sponsor menipu?</p>
                    <p>A: Segera buat tiket keluhan dengan kategori "Lapor Penipu" di tab Tiket. Lampirkan screenshot bukti. Admin akan investigasi dan memblokir penjual jika terbukti menipu.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Deposit saya belum masuk, bagaimana?</p>
                    <p>A: Buat tiket dengan kategori "Deposit Belum Masuk" dan sertakan screenshot bukti transfer serta ID transaksi. Admin akan mengecek manual.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Visitor ID saya hilang, bagaimana?</p>
                    <p>A: Hubungi admin WA dengan menyebutkan username saldo Anda. Admin dapat membantu memindahkan data ke Visitor ID baru.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Lagu saya ditolak, kenapa?</p>
                    <p>A: Lagu diperiksa AI untuk hak cipta. Jika ditolak, lihat catatan admin di detail lagu. Upload ulang setelah memperbaiki masalah.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Bagaimana cara klaim garansi produk?</p>
                    <p>A: Buat tiket dengan kategori "Klaim Garansi", sertakan kode voucher dan bukti pembelian. Garansi berlaku sesuai durasi yang tertulis di detail produk.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Berapa batas waktu komplain?</p>
                    <p>A: Komplain dilayani maksimal 1x24 jam setelah transaksi. Pastikan segera lapor jika ada masalah.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Bisa upload screenshot di tiket?</p>
                    <p>A: Ya! Saat membuat tiket, Anda bisa melampirkan screenshot sebagai bukti. Di dalam chat tiket juga bisa kirim gambar tambahan.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Saldo bisa dipindah ke akun lain?</p>
                    <p>A: Tidak bisa secara langsung. Hubungi admin untuk bantuan transfer saldo antar akun.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Apakah ada biaya admin untuk transaksi?</p>
                    <p>A: Tidak ada biaya tambahan. Harga yang tertera adalah harga final. Rekber juga gratis.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Apa itu kredit game?</p>
                    <p>A: Kredit game adalah mata uang virtual untuk bermain game AI. Bisa dibeli dengan saldo atau voucher. Paket Premium memberikan akses unlimited sampai tanggal tertentu.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Apakah game gratis dimainkan?</p>
                    <p>A: Memulai game gratis, tapi membutuhkan kredit untuk terus bermain. Beli kredit atau upgrade ke Premium untuk akses tanpa batas.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Apa bedanya kredit biasa dan Premium?</p>
                    <p>A: Kredit biasa habis setiap kali main. Premium memberikan akses unlimited hingga tanggal kedaluwarsa tanpa mengurangi kredit.</p>
                  </div>
                </div>
              </div>

              {/* Kontak */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📞 Kontak Admin</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>WhatsApp: <strong>{WA_NUMBER}</strong></li>
                  <li>Instagram: <strong>@agungadi57</strong></li>
                  <li>TikTok: <strong>@pphitampro9</strong></li>
                  <li>YouTube: <strong>{YOUTUBE_NAME}</strong></li>
                </ul>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">⏰ Jam Operasional:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Senin - Sabtu: <strong>08:00 - 22:00 WIB</strong></li>
                    <li>Minggu: <strong>10:00 - 20:00 WIB</strong></li>
                    <li>Di luar jam kerja: pesan akan dibalas keesokan harinya</li>
                  </ul>
                </div>
              </div>

              {/* Kebijakan Privasi */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🔒 Kebijakan Privasi</p>
                <div className="space-y-1.5 text-[13px]">
                  <p>{STORE_NAME} menghormati privasi pengguna. Berikut ketentuan kami:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>Data yang dikumpulkan:</strong> ID perangkat (visitor ID) untuk identifikasi saldo, riwayat transaksi, dan chat. Kami tidak mengumpulkan data pribadi seperti email atau password.</li>
                    <li><strong>Penggunaan data:</strong> Data digunakan hanya untuk memproses transaksi, mengelola saldo, dan menyediakan layanan dukungan.</li>
                    <li><strong>Keamanan:</strong> Data disimpan secara aman di server terenkripsi. Kami tidak membagikan data kepada pihak ketiga.</li>
                    <li><strong>Cookie & Cache:</strong> Aplikasi menggunakan cache lokal untuk menyimpan preferensi bahasa, tema, dan data sementara.</li>
                    <li><strong>Hak pengguna:</strong> Anda dapat menghubungi admin untuk meminta penghapusan data Anda kapan saja.</li>
                    <li><strong>Perubahan kebijakan:</strong> Kebijakan ini dapat diperbarui sewaktu-waktu. Perubahan akan diumumkan melalui aplikasi.</li>
                  </ul>
                </div>
              </div>

              {/* Syarat & Ketentuan */}
              <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📋 Syarat & Ketentuan</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Pengguna bertanggung jawab atas keamanan akun saldo masing-masing</li>
                  <li>Produk yang sudah diklaim <strong>tidak dapat dikembalikan</strong> kecuali ada kesalahan dari admin</li>
                  <li>Admin berhak memblokir akun yang melanggar ketentuan</li>
                  <li>Harga produk dapat berubah sewaktu-waktu tanpa pemberitahuan</li>
                  <li>Saldo yang sudah diisi <strong>tidak dapat ditarik kembali</strong> sebagai uang tunai</li>
                  <li>Penggunaan layanan ini berarti Anda menyetujui semua ketentuan di atas</li>
                </ul>
              </div>

              {/* Changelog */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📝 Changelog v2.0</p>
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-foreground text-xs">April 2026</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>✨ Dukungan {LANGUAGES.length}+ bahasa dengan bendera negara</li>
                    <li>✨ Fitur musik: streaming, playlist, lirik sinkron</li>
                    <li>✨ Voucher musik (kapasitas & diskon)</li>
                    <li>✨ Sistem deposit QRIS & E-Wallet</li>
                    <li>✨ Chat produk real-time dengan gambar</li>
                    <li>✨ Sistem notifikasi lengkap</li>
                    <li>✨ Tema emas premium</li>
                    <li>✨ PWA + dukungan offline</li>
                    <li>✨ Keranjang belanja multi-produk</li>
                    <li>✨ Pusat Bantuan komprehensif</li>
                  </ul>
                </div>
              </div>

              {/* Versi */}
              <div className="text-center pt-2 pb-1 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium">{STORE_NAME}</p>
                <p className="text-[11px] text-muted-foreground/70">{t("version.footer", lang)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buy with Saldo Confirmation Modal */}
      {showBuySaldo && buyProduct && (() => {
        const wholesaleUnitPrice = getWholesalePrice(buyProduct.id, buyQuantity, buyProduct.price);
        const isWholesale = wholesaleUnitPrice < buyProduct.price;
        const basePrice = wholesaleUnitPrice * buyQuantity;
        const discount = discountInfo ? Math.min(discountInfo.amount, basePrice) : 0;
        const totalPrice = basePrice - discount;
        return (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowBuySaldo(false); setBuyProduct(null); setBuyQuantity(1); setDiscountCode(""); setDiscountInfo(null); }}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">Konfirmasi Pembelian</h3>
              <button onClick={() => { setShowBuySaldo(false); setBuyProduct(null); setBuyQuantity(1); setDiscountCode(""); setDiscountInfo(null); }} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
              <p className="font-bold text-sm">{buyProduct.title}</p>
              {isWholesale ? (
                <div>
                  <p className="text-muted-foreground text-xs line-through">{formatPrice(buyProduct.price)} / pcs</p>
                  <p className="text-accent font-extrabold text-lg">{formatPrice(wholesaleUnitPrice)} / pcs <span className="text-xs font-medium bg-accent/10 px-1.5 py-0.5 rounded-full ml-1">Grosir</span></p>
                </div>
              ) : (
                <p className="text-primary font-extrabold text-lg">{formatPrice(buyProduct.price)} / pcs</p>
              )}
            </div>
            {/* Quantity selector */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <span className="text-sm font-medium">Jumlah</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setBuyQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted"><Minus className="w-4 h-4" /></button>
                <span className="font-extrabold text-lg w-8 text-center">{buyQuantity}</span>
                <button onClick={() => setBuyQuantity(q => Math.min(q + 1, buyProduct.stock))} className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            {/* Discount voucher input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" /> Kode Voucher Diskon</label>
              <div className="flex gap-2">
                <Input placeholder="Masukkan kode diskon" value={discountCode} onChange={e => setDiscountCode(e.target.value.toUpperCase())} className="flex-1 font-mono text-sm" />
                <Button size="sm" variant="outline" onClick={() => checkDiscountCode(discountCode)} disabled={checkingDiscount || !discountCode.trim()}>
                  {checkingDiscount ? "..." : "Cek"}
                </Button>
              </div>
              {discountInfo && (
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-2 text-xs text-accent flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Diskon {formatPrice(discountInfo.amount)} berlaku!
                </div>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo saat ini</span><span className="font-bold">{formatPrice(userBalance?.balance || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({buyQuantity}x)</span><span className="font-bold">-{formatPrice(basePrice)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between"><span className="text-accent">Diskon voucher</span><span className="font-bold text-accent">+{formatPrice(discount)}</span></div>
              )}
              <div className="flex justify-between border-t border-border pt-1"><span className="text-muted-foreground">Total bayar</span><span className="font-bold text-destructive">-{formatPrice(totalPrice)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sisa saldo</span><span className={`font-bold ${(userBalance?.balance || 0) >= totalPrice ? "text-primary" : "text-destructive"}`}>{formatPrice((userBalance?.balance || 0) - totalPrice)}</span></div>
            </div>
            {hasPin && <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> PIN akan diminta untuk konfirmasi</p>}
            <p className="text-xs text-muted-foreground text-center">{buyQuantity} token akun akan otomatis diberikan dari stok</p>
            <Button className="w-full h-11 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold gap-2"
              disabled={!userBalance || userBalance.balance < totalPrice}
              onClick={() => attemptBuy(buyProduct, buyQuantity)}>
              <Wallet className="w-5 h-5" /> Beli {buyQuantity}x — {formatPrice(totalPrice)}
            </Button>
          </div>
        </div>
        );
      })()}

      {/* Purchase Success Modal */}
      {purchaseSuccess && (
        <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPurchaseSuccess(null)}>
          <div className="bg-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-accent to-primary px-5 py-4 text-primary-foreground shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-90">Pembelian Berhasil</p>
                  <h3 className="mt-1 text-lg font-extrabold">{purchaseSuccess.quantity}x Voucher siap diklaim</h3>
                </div>
                <button onClick={() => setPurchaseSuccess(null)} className="w-8 h-8 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-sm font-bold text-center">{purchaseSuccess.product.title}</p>
              <p className="text-[11px] text-muted-foreground text-center">Berikut {purchaseSuccess.tokens.length} voucher Anda, silakan klaim atau salin kodenya.</p>
              {purchaseSuccess.tokens.map((tk, idx) => (
                <div key={tk.id} className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Voucher {idx + 1}</p>
                  <p className="font-mono text-base font-extrabold tracking-[0.15em] text-primary break-all text-center">{tk.token_code}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => copyText(tk.token_code, `voucher-${tk.id}`)}>
                      <Copy className="w-3 h-3" /> Salin
                    </Button>
                    <Button size="sm" className="gap-1 text-xs bg-gradient-to-r from-primary to-accent text-primary-foreground" onClick={() => openClaimFromPurchase(tk.token_code)}>
                      <Ticket className="w-3 h-3" /> Klaim
                    </Button>
                  </div>
                </div>
              ))}

              <div className="rounded-xl bg-muted/60 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Total ({purchaseSuccess.quantity}x)</span>
                  <span className="font-bold">{formatPrice(purchaseSuccess.total_price)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Sisa saldo</span>
                  <span className="font-bold text-primary">{formatPrice(purchaseSuccess.balance_remaining)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Panel */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 p-4" onClick={() => setShowNotifPanel(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl animate-in slide-in-from-top-5 duration-200 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-extrabold text-base flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> {t("notif.title", lang)}</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && <button onClick={markAllRead} className="text-[10px] text-primary font-bold hover:underline">{t("notif.mark_all_read", lang)}</button>}
                <button onClick={() => setShowNotifPanel(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {notifications.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{t("notif.no_notif", lang)}</p>
              ) : notifications.map(n => (
                <button key={n.id} onClick={() => { markNotifRead(n.id); }} className={`w-full text-left p-3 rounded-xl transition-colors ${n.is_read ? "bg-transparent hover:bg-muted/50" : "bg-primary/5 hover:bg-primary/10"}`}>
                  <div className="flex items-start gap-2">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.is_read ? "bg-muted-foreground/30" : "bg-primary"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>{n.title}</p>
                      {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(n.created_at).toLocaleString("id-ID")}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedDeposit && (
        <div className="fixed inset-0 z-[88] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedDeposit(null)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">Detail Deposit</h3>
              <button onClick={() => setSelectedDeposit(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">ID Transaksi</span><span className="font-mono text-xs text-right break-all">{selectedDeposit.trx_id}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Nominal</span><span className="font-bold text-primary">{formatPrice(selectedDeposit.amount)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Metode</span><span className="font-semibold">{selectedDeposit.payment_method}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Status</span><span className="font-semibold">{getDepositStatusLabel(selectedDeposit.status, lang)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Dibuat</span><span className="text-right">{new Date(selectedDeposit.created_at).toLocaleString("id-ID")}</span></div>
            </div>
            <Button className="w-full gap-2" onClick={() => copyText(selectedDeposit.trx_id, "deposit-transaction-id")}>
              <Copy className="w-4 h-4" /> Salin ID Transaksi
            </Button>
          </div>
        </div>
      )}

      {showProfileModal && userBalance && (
        <div className="fixed inset-0 z-[89] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowProfileModal(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">Edit Profil Saldo</h3>
              <button onClick={() => setShowProfileModal(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <Input placeholder="Username minimal 6 karakter" value={profileUsername} onChange={e => setProfileUsername(e.target.value)} />
              <Input placeholder="No HP diawali 08 atau +628" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Username minimal 6 karakter, nomor HP harus diawali 08 atau +628.</p>
              <Button className="w-full gap-2" onClick={updateUserBalanceProfile} disabled={savingProfile}>
                <Check className="w-4 h-4" /> Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {showDepositModal && userBalance && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDepositModal(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">{t("deposit.title", lang)}</h3>
              <button onClick={() => setShowDepositModal(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            {hasPin && (
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start gap-2 px-0 text-sm font-bold text-primary"
                onClick={() => {
                  setShowDepositModal(false);
                  setShowForgotPin(true);
                }}
              >
                <KeyRound className="w-4 h-4" /> Lupa PIN? Reset dari sini
              </Button>
            )}

            {depositStep === "method" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("deposit.select_method", lang)}</p>
                <button onClick={() => { setDepositMethod("qris"); setDepositStep("form"); }}
                  className="w-full p-4 rounded-xl border-2 border-primary/20 hover:border-primary/50 transition-colors text-left flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="font-bold text-sm">{t("deposit.qris", lang)}</p>
                    <p className="text-[10px] text-muted-foreground">Scan QR Code</p>
                  </div>
                </button>
                {getEwallets().map((ew, idx) => (
                  <button key={idx} onClick={() => { setDepositMethod(ew.name); setDepositStep("form"); }}
                    className="w-full p-4 rounded-xl border-2 border-primary/20 hover:border-primary/50 transition-colors text-left flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center"><Wallet className="w-5 h-5 text-accent" /></div>
                    <div>
                      <p className="font-bold text-sm">{ew.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ew.number}</p>
                    </div>
                  </button>
                ))}
                {getEwallets().length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-2">{lang === "id" ? "Belum ada e-wallet dikonfigurasi" : "No e-wallet configured"}</div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <button onClick={() => setDepositStep("method")} className="text-xs text-primary flex items-center gap-1"><ChevronLeft className="w-3 h-3" /> {lang === "id" ? "Kembali" : "Back"}</button>

                {/* Payment info */}
                {depositMethod === "qris" ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center space-y-2">
                    <p className="text-xs font-bold text-primary">{t("deposit.scan_qris", lang)}</p>
                    {getSettingValue("qris_url") ? (
                      <img src={getSettingValue("qris_url")} alt="QRIS" className="max-w-full max-h-48 mx-auto rounded-lg" />
                    ) : (
                      <div className="bg-muted rounded-lg p-6 text-xs text-muted-foreground">{lang === "id" ? "QRIS belum dikonfigurasi admin" : "QRIS not configured by admin"}</div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 space-y-1">
                    <p className="text-xs font-bold text-accent">{t("deposit.transfer_to", lang)}</p>
                    <p className="font-bold text-sm">{depositMethod}</p>
                    <p className="font-mono text-lg font-extrabold text-foreground">{getEwallets().find(ew => ew.name === depositMethod)?.number || "-"}</p>
                  </div>
                )}

                <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  ID transaksi akan dibuat otomatis setelah deposit diajukan.
                </div>
                <Input type="number" placeholder={t("deposit.amount", lang)} value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />

                <Button className="w-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground font-bold gap-2"
                  onClick={submitDeposit} disabled={!depositAmount}>
                  <MessageCircle className="w-4 h-4" /> Buat Deposit & Kirim WA
                </Button>
              </div>
            )}
          </div>
        </div>
      )}


      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex max-w-lg mx-auto overflow-x-auto scrollbar-hide">
          {([
            { key: "beranda" as Tab, icon: Home, label: t("nav.home", lang) },
            { key: "produk" as Tab, icon: Package, label: t("nav.products", lang) },
            { key: "voucher" as Tab, icon: Ticket, label: t("nav.voucher", lang) },
            { key: "saldo" as Tab, icon: Wallet, label: t("nav.balance", lang) },
            { key: "likes" as Tab, icon: Heart, label: t("nav.likes", lang) },
            { key: "history" as Tab, icon: Clock, label: t("nav.history", lang) },
            { key: "tiket" as Tab, icon: AlertCircle, label: t("nav.ticket", lang) },
            { key: "playlist" as Tab, icon: Music, label: t("nav.playlist", lang) },
            { key: "publik" as Tab, icon: Globe, label: "Publik" },
            { key: "sponsor" as Tab, icon: Megaphone, label: "Sponsor" },
            { key: "streak" as Tab, icon: CalendarDays, label: "Streak" },
            { key: "game" as Tab, icon: Gamepad2, label: "Game" },
            { key: "plus" as Tab, icon: Sparkles, label: "Plus" },
            { key: "update" as Tab, icon: RefreshCw, label: "Update" },
            { key: "adminpost" as Tab, icon: FileText, label: "Admin" },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`min-w-[52px] flex-shrink-0 flex flex-col items-center py-2 text-[10px] transition-all duration-200 ${tab === key ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}>
              <div className={`p-1 rounded-xl transition-all duration-200 ${tab === key ? "bg-primary/10 scale-110" : ""}`}><Icon className="w-4 h-4" /></div>
              <span className="mt-0.5">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button onClick={() => setShowCart(true)} className="fixed bottom-20 right-[4.5rem] z-50 w-12 h-12 rounded-full bg-accent text-accent-foreground shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>
        </button>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowCart(false)}>
          <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" /> Keranjang ({cartCount})</h3>
                <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>

              {cart.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Keranjang kosong</p>
              ) : (
                <>
                  {cart.map(item => {
                    const imgs = getProductImages(item.product.id);
                    return (
                      <Card key={item.product.id}>
                        <CardContent className="p-3 flex items-center gap-3">
                          {imgs.length > 0 && <img src={imgs[0]} className="w-14 h-14 rounded-xl object-cover" alt="" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{item.product.title}</p>
                            {(() => {
                              const wp = getWholesalePrice(item.product.id, item.quantity, item.product.price);
                              return wp < item.product.price ? (
                                <div>
                                  <span className="text-muted-foreground text-xs line-through mr-1">{formatPrice(item.product.price)}</span>
                                  <span className="text-accent font-extrabold text-sm">{formatPrice(wp)}</span>
                                </div>
                              ) : (
                                <p className="text-primary font-extrabold text-sm">{formatPrice(item.product.price)}</p>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateCartQty(item.product.id, item.quantity - 1)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                            <span className="font-bold text-sm w-5 text-center">{item.quantity}</span>
                            <button onClick={() => updateCartQty(item.product.id, item.quantity + 1)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                            <button onClick={() => removeFromCart(item.product.id)} className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center"><Trash2 className="w-3 h-3 text-destructive" /></button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total item</span><span className="font-bold">{cartCount} pcs</span></div>
                    <div className="flex justify-between border-t border-border pt-1"><span className="font-bold">Total harga</span><span className="font-extrabold text-primary">{formatPrice(cartTotal)}</span></div>
                    {userBalance && <div className="flex justify-between"><span className="text-muted-foreground">Saldo</span><span className={`font-bold ${userBalance.balance >= cartTotal ? "text-accent" : "text-destructive"}`}>{formatPrice(userBalance.balance)}</span></div>}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">Pilih item untuk checkout langsung dengan saldo</p>
                  {cart.map(item => {
                    const wp = getWholesalePrice(item.product.id, item.quantity, item.product.price);
                    const itemTotal = wp * item.quantity;
                    return (
                    <Button key={item.product.id} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold gap-2 text-xs"
                      disabled={!userBalance || userBalance.balance < itemTotal || item.product.stock < item.quantity}
                      onClick={() => { setBuyProduct(item.product); setBuyQuantity(item.quantity); setShowBuySaldo(true); setShowCart(false); }}>
                      <Wallet className="w-4 h-4" /> Beli {item.quantity}x {item.product.title} — {formatPrice(itemTotal)}
                    </Button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Help Button */}
      <button onClick={() => setShowHelp(true)} className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
        <HelpCircle className="w-6 h-6" />
      </button>

      {/* PIN Setup Modal */}
      {showPinSetup && (
        <div className="fixed inset-0 z-[92] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPinSetup(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Buat PIN Keamanan</h3>
              <button onClick={() => setShowPinSetup(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">PIN akan diminta setiap kali melakukan pembelian dengan saldo. PIN harus 4-6 digit angka.</p>
            <Input type="password" inputMode="numeric" maxLength={6} placeholder="Masukkan PIN (4-6 digit)" value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, ""))} />
            <Input type="password" inputMode="numeric" maxLength={6} placeholder="Konfirmasi PIN" value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ""))} />
            <Button className="w-full gap-2" onClick={createPin} disabled={pinInput.length < 4}>
              <Lock className="w-4 h-4" /> Buat PIN
            </Button>
          </div>
        </div>
      )}

      {/* PIN Verify Modal */}
      {showPinVerify && (
        <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowPinVerify(false); setPendingPurchase(null); }}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Masukkan PIN</h3>
              <button onClick={() => { setShowPinVerify(false); setPendingPurchase(null); }} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Masukkan PIN untuk konfirmasi pembelian</p>
            <Input type="password" inputMode="numeric" maxLength={6} placeholder="PIN" value={pinVerifyInput} onChange={e => setPinVerifyInput(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.3em] font-bold"
              onKeyDown={e => { if (e.key === "Enter") confirmPinAndBuy(); }} autoFocus />
            <Button className="w-full h-11 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold gap-2" onClick={confirmPinAndBuy} disabled={pinVerifyInput.length < 4}>
              <Lock className="w-4 h-4" /> Konfirmasi
            </Button>
            <button onClick={() => { setShowPinVerify(false); setShowForgotPin(true); }} className="w-full text-center text-xs text-primary hover:underline">
              Lupa PIN?
            </button>
          </div>
        </div>
      )}

      {/* Forgot PIN Modal */}
      {showForgotPin && (
        <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForgotPin(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">Reset PIN</h3>
              <button onClick={() => setShowForgotPin(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive space-y-1">
              <p className="font-bold">Cara reset PIN:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Hubungi admin via WhatsApp</li>
                <li>Admin akan memberikan token reset</li>
                <li>Masukkan token dan PIN baru di bawah</li>
              </ol>
            </div>
            <a href={`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent(`Halo admin, saya mau reset PIN.\nUsername: ${userBalance?.username || "-"}\nVisitor ID: ${visitorId}`)}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full gap-2 mb-2"><MessageCircle className="w-4 h-4" /> Hubungi Admin via WA</Button>
            </a>
            <Input placeholder="Token reset dari admin" value={resetToken} onChange={e => setResetToken(e.target.value.toUpperCase())} className="font-mono uppercase" autoFocus />
            <Input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="PIN baru (4-6 digit)" value={newPinInput} onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => { if (e.key === "Enter") resetPinWithToken(); }} />
            <Button className="w-full gap-2" onClick={resetPinWithToken} disabled={!resetToken || newPinInput.length < 4}>
              <Lock className="w-4 h-4" /> Reset PIN
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
