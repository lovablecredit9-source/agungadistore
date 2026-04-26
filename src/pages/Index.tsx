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
  Moon, Sun, Lock, Tag, Music, Music2, Megaphone, Diamond, Image as ImageIcon, Gem, Sparkles, Palette, CalendarDays, Gamepad2, RefreshCw,
  Eye, LayoutGrid, Rows3, Flame, SlidersHorizontal, Zap, TrendingUp, Award, Activity, Inbox, User, Phone, Gift, Menu, Lightbulb, MessageSquare, Star
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CountUp from "@/components/CountUp";
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
import MusicHub, { type MusicSubTab } from "@/components/MusicHub";
import LanguageSelector from "@/components/LanguageSelector";
import { LANGUAGES } from "@/lib/languages";
import InstallPrompt from "@/components/InstallPrompt";
import MusicPublicTab from "@/components/MusicPublicTab";
import SponsorBanner from "@/components/SponsorBanner";
import ProductNavToolbar from "@/components/ProductNavToolbar";
import ProductHypeStreakBar from "@/components/ProductHypeStreakBar";
import LikesTab from "@/components/LikesTab";
import DailyStreak from "@/components/DailyStreak";
import NeonStreakHub from "@/components/streak/NeonStreakHub";
import MembershipShop from "@/components/streak/MembershipShop";
import PowerPackShop from "@/components/streak/PowerPackShop";
import MembershipExtrasShop from "@/components/streak/MembershipExtrasShop";
import MembershipCarousel from "@/components/streak/MembershipCarousel";
import { Tabs as MembershipTabs, TabsList as MembershipTabsList, TabsTrigger as MembershipTabsTrigger, TabsContent as MembershipTabsContent } from "@/components/ui/tabs";
import HomeBannerSlider from "@/components/HomeBannerSlider";

import BalanceAuth from "@/components/BalanceAuth";
import GameTab from "@/components/GameTab";
import PlusTab from "@/components/PlusTab";
import { useGameBalance } from "@/components/games/GameBalance";
import LiveClock from "@/components/LiveClock";
import LoginGate from "@/components/LoginGate";
import WhatsAppChat from "@/components/WhatsAppChat";
import EngagementHub from "@/components/EngagementHub";
import WalletDashboard from "@/components/WalletDashboard";
import VoucherNavigation from "@/components/VoucherNavigation";
import HistoryEnhancer, { type HistoryItem } from "@/components/HistoryEnhancer";
import { TicketEnhancer, TICKET_TEMPLATES } from "@/components/TicketEnhancer";
import { useAccountBan } from "@/hooks/useAccountBan";

type Tab = "musik" | "beranda" | "produk" | "voucher" | "history" | "likes" | "tiket" | "saldo" | "playlist" | "publik" | "sponsor" | "streak" | "streakevent" | "streakshop" | "streakmembership" | "adminpost" | "game" | "plus" | "update";

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
  "/beranda": "beranda",
  "/musik": "musik",
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
  "/streak-event": "streakevent",
  "/streak-shop": "streakshop",
  "/streak-membership": "streakmembership",
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
  const { banned } = useAccountBan();
  const { theme, setTheme, resolvedTheme, customBgUrl, setCustomBgUrl } = useTheme();
  const customBgInputRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useLang();
  const tab: Tab = TAB_PATHS[location.pathname] || "beranda";
  const setTab = useCallback((t: Tab) => {
    navigate(PATH_FROM_TAB[t] || "/", { replace: false });
  }, [navigate]);
  const [musicSubTab, setMusicSubTab] = useState<MusicSubTab>("playlist");
  const [products, setProducts] = useState<Product[]>([]);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [socialLinks, setSocialLinks] = useState<{ id: string; platform: string; label: string; url: string; icon_url: string | null; color_from: string; color_to: string; sort_order: number }[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [claimResults, setClaimResults] = useState<ClaimResult[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [voucherSection, setVoucherSection] = useState<"claim" | "recent" | "tips">("claim");
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
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "cheapest" | "expensive" | "popular" | "name_asc" | "name_desc">("newest");
  const [productSearch, setProductSearch] = useState("");
  const [productViewMode, setProductViewMode] = useState<"list" | "grid" | "compact">(() => (localStorage.getItem("product_view_mode") as "list" | "grid" | "compact") || "list");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [warrantyOnly, setWarrantyOnly] = useState(false);
  const [productMinPrice, setProductMinPrice] = useState("");
  const [productMaxPrice, setProductMaxPrice] = useState("");
  const [productsLoading, setProductsLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 5;
  const [smartHistory, setSmartHistory] = useState<boolean>(() => localStorage.getItem("smart_history_v1") === "1");
  const [smartSaldo, setSmartSaldo] = useState<boolean>(() => localStorage.getItem("smart_saldo_v1") === "1");
  const [smartTickets, setSmartTickets] = useState<boolean>(() => localStorage.getItem("smart_tickets_v1") !== "0");
  useEffect(() => { localStorage.setItem("smart_history_v1", smartHistory ? "1" : "0"); }, [smartHistory]);
  useEffect(() => { localStorage.setItem("smart_saldo_v1", smartSaldo ? "1" : "0"); }, [smartSaldo]);
  useEffect(() => { localStorage.setItem("smart_tickets_v1", smartTickets ? "1" : "0"); }, [smartTickets]);
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

  async function fetchSocialLinks() {
    const { data } = await supabase.from("social_links").select("*").eq("is_active", true).order("sort_order");
    if (data) setSocialLinks(data as any[]);
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
  const [showNavMenu, setShowNavMenu] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const activeBalanceVisitorId = useMemo(() => {
    if (userBalance?.visitor_id) return userBalance.visitor_id;
    return localStorage.getItem("balance_visitor_id") || visitorId;
  }, [userBalance?.visitor_id, visitorId]);
  const { amount: gameBalanceAmount } = useGameBalance(activeBalanceVisitorId);

  async function fetchNotifications(targetVisitorId = activeBalanceVisitorId) {
    const { data } = await (supabase as any).rpc("get_my_notifications", {
      p_visitor_id: targetVisitorId,
      p_limit: 50,
    });
    if (data) setNotifications(data as unknown as Notification[]);
  }

  async function markNotificationsRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await (supabase as any).rpc("mark_notifications_read", {
      p_visitor_id: activeBalanceVisitorId,
      p_ids: unreadIds,
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function markAllRead() {
    await markNotificationsRead();
  }

  async function markNotifRead(id: string) {
    await (supabase as any).rpc("mark_notifications_read", {
      p_visitor_id: activeBalanceVisitorId,
      p_ids: [id],
    });
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function createNotification(title: string, message: string, type: string, relatedId?: string) {
    await (supabase as any).rpc("create_notification", {
      p_visitor_id: activeBalanceVisitorId,
      p_title: title,
      p_message: message,
      p_type: type,
      p_related_id: relatedId || null,
    });
  }

  useEffect(() => {
    fetchProducts();
    loadHistory();
    fetchLikes();
    fetchAdminPosts();
    fetchTickets();
    fetchProductChatHistory();
    fetchUserBalance();
    fetchAdminSettings();
    fetchHomeSponsors();
    fetchSocialLinks();

    // First visit notification - geser navigasi
    const firstVisitKey = "first_visit_nav_notified";
    if (!localStorage.getItem(firstVisitKey)) {
      localStorage.setItem(firstVisitKey, "1");
      (supabase as any).rpc("create_notification", {
        p_visitor_id: visitorId,
        p_title: "👆 Geser Navigasi ke Kiri!",
        p_message: "Navigasi bawah bisa digeser untuk melihat tab lainnya seperti Musik, Sponsor, Streak, Game & lainnya.",
        p_type: "info",
        p_related_id: null,
      }).then(() => fetchNotifications(visitorId));
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

  useEffect(() => {
    fetchNotifications();
    fetchDeposits();
    checkPinStatus();
    // Auto-claim streak harian (server-side cek subscription aktif). Throttle 1x per hari per browser.
    if (activeBalanceVisitorId) {
      const todayKey = `auto_streak_claimed_${new Date().toISOString().slice(0, 10)}`;
      if (!localStorage.getItem(todayKey)) {
        supabase.functions.invoke("auto-claim-streak", { body: {} })
          .then(() => localStorage.setItem(todayKey, "1"))
          .catch(() => {});
      }
    }
  }, [activeBalanceVisitorId]);

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
    const { data } = await supabase.functions.invoke("manage-pin", { body: { action: "check", visitorId: activeBalanceVisitorId } });
    setHasPin(Boolean(data?.hasPin));
  }

  async function createPin() {
    if (pinInput.length < 4 || pinInput.length > 6 || !/^\d+$/.test(pinInput)) {
      toast({ title: "PIN harus 4-6 digit angka", variant: "destructive" }); return;
    }
    if (pinInput !== pinConfirm) {
      toast({ title: "Konfirmasi PIN tidak cocok", variant: "destructive" }); return;
    }
    const { data, error } = await supabase.functions.invoke("manage-pin", { body: { action: "create", visitorId: activeBalanceVisitorId, pin: pinInput } });
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
      body: { action: "reset", visitorId: activeBalanceVisitorId, resetToken, newPin: newPinInput },
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
    const { data } = await supabase
      .from("deposits")
      .select("*")
      .eq("visitor_id", activeBalanceVisitorId)
      .order("created_at", { ascending: false });
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
        visitorId: activeBalanceVisitorId,
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

  // Notifications: poll + refetch on focus (realtime postgres_changes blocked by RLS for privacy)
  useEffect(() => {
    if (!activeBalanceVisitorId) return;
    let lastIds = new Set(notifications.map(n => n.id));
    const check = async () => {
      const { data } = await (supabase as any).rpc("get_my_notifications", {
        p_visitor_id: activeBalanceVisitorId,
        p_limit: 50,
      });
      if (!data) return;
      const fresh = data as Notification[];
      const newOnes = fresh.filter(n => !lastIds.has(n.id));
      if (newOnes.length > 0 && lastIds.size > 0) {
        // Toast for new notifications
        newOnes.forEach(notif => {
          if (ticketView !== "chat" && !showProductChat) {
            toast({ title: notif.title, description: notif.message || undefined });
          }
        });
      }
      lastIds = new Set(fresh.map(n => n.id));
      setNotifications(fresh);
    };
    const interval = setInterval(check, 15000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketView, showProductChat, activeBalanceVisitorId]);

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
    setProductsLoading(true);
    const [pRes, piRes, wRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_images").select("*").order("image_order"),
      supabase.from("wholesale_prices").select("*").eq("entity_type", "product").order("min_quantity"),
    ]);
    if (pRes.data) setProducts(pRes.data as unknown as Product[]);
    if (piRes.data) setProductImages(piRes.data as ProductImage[]);
    if (wRes.data) setWholesalePrices(wRes.data);
    setProductsLoading(false);
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

    const storedBalanceVisitorId = localStorage.getItem("balance_visitor_id");
    const savedEmail = localStorage.getItem("balance_email");
    let query = supabase.from("user_balances_public" as any).select("*");

    // Always resolve the active account from the stored balance account id first.
    if (storedBalanceVisitorId) {
      query = query.eq("visitor_id", storedBalanceVisitorId);
    } else if (savedEmail) {
      query = query.eq("email", savedEmail);
    } else {
      query = query.eq("visitor_id", visitorId);
    }
    
    const { data } = await query.maybeSingle();
    if (data) {
      const user = data as unknown as UserBalance;
      localStorage.setItem("balance_visitor_id", user.visitor_id);
      setUserBalance(user);
      setProfileUsername(user.username);
      setProfilePhone(user.phone);
    } else {
      // Session invalid, clean up
      localStorage.removeItem("balance_logged_in");
      localStorage.removeItem("balance_email");
      localStorage.removeItem("balance_visitor_id");
      setUserBalance(null);
      setBalanceTransactions([]);
      setHasPin(false);
      return;
    }
    const currentBalanceVisitorId = (data as any).visitor_id;
    const { data: txns } = await supabase.from("balance_transactions").select("*").eq("visitor_id", currentBalanceVisitorId).order("created_at", { ascending: false });
    if (txns) setBalanceTransactions(txns as unknown as BalanceTransaction[]);
    else setBalanceTransactions([]);
    setSelectedTxIds(new Set());
    setSelectedTransaction(null);
    setShowTxExport(false);
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
      body: { action: "verify", visitorId: activeBalanceVisitorId, pin: pinVerifyInput },
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
      body: { visitorId: activeBalanceVisitorId, productId: product.id, quantity, discountCode: voucherCode || undefined, pin },
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
    doc.text(`Riwayat Klaim Voucher - ${new Date().toLocaleString("id-ID")}`, pageW / 2, 43, { align: "center" });

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
      doc.text(`${STORE_NAME} - WA: ${WA_NUMBER}`, pageW / 2, pageH - 10, { align: "center" });
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
    txt += `\n${STORE_NAME} - WA: ${WA_NUMBER}\nHarap simpan bukti ini. Jika ada masalah hubungi admin.\n`;
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
  const productCategoryCounts: Record<string, number> = { Semua: products.length };
  products.forEach(p => {
    const k = p.category || "Lainnya";
    productCategoryCounts[k] = (productCategoryCounts[k] || 0) + 1;
  });
  const _minP = parseInt(productMinPrice) || 0;
  const _maxP = parseInt(productMaxPrice) || 0;
  const filteredProducts = products
    .filter(p => selectedCategory === "Semua" || (p.category || "Lainnya") === selectedCategory)
    .filter(p => p.title.toLowerCase().includes(productSearch.toLowerCase()) || (p.description || "").toLowerCase().includes(productSearch.toLowerCase()))
    .filter(p => !inStockOnly || p.stock > 0)
    .filter(p => !warrantyOnly || p.has_warranty)
    .filter(p => _minP <= 0 || p.price >= _minP)
    .filter(p => _maxP <= 0 || p.price <= _maxP);
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOrder === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortOrder === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortOrder === "cheapest") return a.price - b.price;
    if (sortOrder === "expensive") return b.price - a.price;
    if (sortOrder === "popular") return (productLikeCounts[b.id] || 0) - (productLikeCounts[a.id] || 0);
    if (sortOrder === "name_asc") return a.title.localeCompare(b.title);
    if (sortOrder === "name_desc") return b.title.localeCompare(a.title);
    return 0;
  });
  const popularProductTerms = [...products]
    .sort((a, b) => (productLikeCounts[b.id] || 0) - (productLikeCounts[a.id] || 0))
    .slice(0, 6)
    .map(p => p.title.split(" ").slice(0, 2).join(" "));

  // Persist view mode
  useEffect(() => { localStorage.setItem("product_view_mode", productViewMode); }, [productViewMode]);

  // Helper untuk badge dinamis produk
  function getProductBadges(p: Product) {
    const badges: { label: string; className: string }[] = [];
    const ageDays = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const likes = productLikeCounts[p.id] || 0;
    // Trending: top 3 berdasarkan likes (likes > 0)
    const sortedByLikes = [...products].sort((a, b) => (productLikeCounts[b.id] || 0) - (productLikeCounts[a.id] || 0));
    const isTrending = likes > 0 && sortedByLikes.slice(0, 3).some(x => x.id === p.id);
    if (isTrending) badges.push({ label: "🔥 Trending", className: "bg-gradient-to-r from-orange-500 to-red-500 text-white" });
    if (ageDays < 7) badges.push({ label: "✨ Baru", className: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white" });
    if (p.stock > 0 && p.stock <= 5) badges.push({ label: "⚡ Terbatas", className: "bg-gradient-to-r from-amber-500 to-yellow-500 text-white" });
    return badges;
  }

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
      {/* Header - flat IG/TikTok style */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md text-foreground px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Sheet open={showNavMenu} onOpenChange={setShowNavMenu}>
            <SheetTrigger asChild>
              <button
                aria-label="Buka menu navigasi"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
              >
                <Menu className="w-5 h-5" strokeWidth={1.7} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 flex flex-col">
              <SheetHeader className="px-4 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <img src={storeQris} alt={STORE_NAME} className="w-10 h-10 rounded-lg object-cover border border-border" />
                  <div className="text-left">
                    <SheetTitle className="text-base font-semibold tracking-tight">{STORE_NAME}</SheetTitle>
                    <p className="text-[10px] text-muted-foreground">{t("header.tagline", lang)}</p>
                  </div>
                </div>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto py-1">
                {([
                  { key: "beranda" as Tab, icon: Home, label: "Beranda" },
                  { key: "musik" as Tab, icon: Music2, label: "Musik" },
                  { key: "playlist" as Tab, icon: Music, label: "Playlist" },
                  { key: "publik" as Tab, icon: Globe, label: "Publik" },
                  { key: "produk" as Tab, icon: Package, label: t("nav.products", lang) },
                  { key: "voucher" as Tab, icon: Ticket, label: t("nav.voucher", lang) },
                  { key: "saldo" as Tab, icon: Wallet, label: t("nav.balance", lang) },
                  { key: "likes" as Tab, icon: Heart, label: t("nav.likes", lang) },
                  { key: "history" as Tab, icon: Clock, label: t("nav.history", lang) },
                  { key: "tiket" as Tab, icon: AlertCircle, label: t("nav.ticket", lang) },
                  { key: "sponsor" as Tab, icon: Megaphone, label: "Sponsor" },
                  { key: "streak" as Tab, icon: CalendarDays, label: "Streak" },
                  { key: "streakevent" as Tab, icon: CalendarDays, label: "Streak Event" },
                  { key: "streakshop" as Tab, icon: CalendarDays, label: "Streak Shop" },
                  { key: "streakmembership" as Tab, icon: Crown, label: "M.Streak" },
                  { key: "luckroyale" as any, icon: Crown, label: "L.Royale", external: "/luck-royale-nyawa" },
                  { key: "game" as Tab, icon: Gamepad2, label: "Game" },
                  { key: "plus" as Tab, icon: Gem, label: "Plus" },
                  { key: "update" as Tab, icon: RefreshCw, label: "Update" },
                  { key: "adminpost" as Tab, icon: FileText, label: "Admin" },
                ] as Array<{ key: any; icon: any; label: string; external?: string }>).map(({ key, icon: Icon, label, external }) => {
                  const active = !external && tab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (external) {
                          navigate(external);
                        } else {
                          setTab(key);
                        }
                        setShowNavMenu(false);
                      }}
                      className={`relative w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${active ? "bg-muted/60" : "hover:bg-muted/40"}`}
                    >
                      {active && <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-foreground rounded-r" />}
                      <Icon className="w-[18px] h-[18px] text-foreground flex-shrink-0" strokeWidth={active ? 2.2 : 1.7} />
                      <span className={`text-sm flex-1 text-left ${active ? "font-semibold text-foreground" : "font-normal text-foreground"}`}>{label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="px-4 py-3 border-t border-border text-center text-[10px] text-muted-foreground">
                © {new Date().getFullYear()} {STORE_NAME}
              </div>
            </SheetContent>
          </Sheet>
          <img src={storeQris} alt={STORE_NAME} className="w-9 h-9 rounded-full object-cover border border-border" />
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold tracking-tight truncate text-foreground">{STORE_NAME}</h1>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">{t("header.tagline", lang)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-foreground" title="Tema">
                  {resolvedTheme === "dark" ? <Moon className="w-[18px] h-[18px]" strokeWidth={1.7} /> : resolvedTheme === "gold" ? <Crown className="w-[18px] h-[18px]" strokeWidth={1.7} /> : resolvedTheme === "diamond" ? <Diamond className="w-[18px] h-[18px]" strokeWidth={1.7} /> : resolvedTheme === "silver" ? <Gem className="w-[18px] h-[18px]" strokeWidth={1.7} /> : resolvedTheme === "platinum" ? <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.7} /> : resolvedTheme === "purple" ? <Palette className="w-[18px] h-[18px]" strokeWidth={1.7} /> : resolvedTheme === "custom" ? <ImageIcon className="w-[18px] h-[18px]" strokeWidth={1.7} /> : <Sun className="w-[18px] h-[18px]" strokeWidth={1.7} />}
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
            <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-foreground">
              <Bell className="w-[18px] h-[18px]" strokeWidth={1.7} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[9px] font-semibold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1 border border-background">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>
            <a href={`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent("Halo, saya mau tanya di Agung Adi Store")}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-foreground">
              <MessageCircle className="w-[18px] h-[18px]" strokeWidth={1.7} />
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {tab === "musik" && (
          <MusicHub
            subTab={musicSubTab}
            onSubTabChange={setMusicSubTab}
            onPlayExternal={(song) => playExternalRef.current?.(song)}
            playlistSlot={null /* PlaylistTab is mounted persistently below */}
            playbackState={playbackState}
            onTogglePlay={() => togglePlayRef.current?.()}
            onOpenFullPlayer={() => openFullPlayerRef.current?.()}
          />
        )}

        {tab === "beranda" && (
          <div className="space-y-5 animate-fade-in">
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

            {/* Welcome Header - Aurora Neon Premium */}
            <div className="relative rounded-3xl overflow-hidden p-[1.5px] aurora-shift" style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.6), hsl(280 90% 65%/0.6), hsl(190 95% 55%/0.6), hsl(var(--primary)/0.6))", backgroundSize: "300% 300%" }}>
              <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-4 overflow-hidden">
                {/* Decorative glow blobs */}
                <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-purple-500/20 blur-3xl" />
                <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-cyan-400/10 blur-2xl" />

                <div className="relative flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary via-purple-500 to-cyan-400 blur-md opacity-70 animate-pulse" />
                    <img src={storeQris} alt={STORE_NAME} className="relative w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-2xl" />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-card animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.18em] font-bold bg-gradient-to-r from-primary via-purple-500 to-cyan-400 bg-clip-text text-transparent">
                        {new Date().getHours() < 12 ? "✨ Pagi" : new Date().getHours() < 18 ? "☀️ Siang" : "🌙 Malam"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-500 text-[8px] font-bold">LIVE</span>
                    </div>
                    <h2 className="text-[19px] font-extrabold leading-tight truncate bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">{STORE_NAME}</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                      <span className="text-yellow-500">⭐</span> {t("header.tagline", lang)}
                    </p>
                  </div>
                </div>

                <div className="relative mt-3 pt-3 border-t border-white/10">
                  <LiveClock />
                </div>

                <div className="relative grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10">
                  <a
                    href={`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent("Halo, saya mau order di Agung Adi Store")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative overflow-hidden flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl py-2.5 bg-gradient-to-r from-green-500/15 to-emerald-500/15 border border-green-500/30 text-green-500 hover:scale-[1.02] transition-transform shine-sweep"
                  >
                    <MessageCircle className="w-3.5 h-3.5" strokeWidth={2.2} />
                    <span className="truncate">{t("home.contact_wa", lang)}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setTab("voucher")}
                    className="relative overflow-hidden flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl py-2.5 bg-gradient-to-r from-primary/15 to-purple-500/15 border border-primary/30 text-primary hover:scale-[1.02] transition-transform shine-sweep"
                  >
                    <Ticket className="w-3.5 h-3.5" strokeWidth={2.2} />
                    <span className="truncate">{t("home.claim_voucher", lang)}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Action Grid - Aurora Neon Premium */}
            <div className="relative rounded-3xl overflow-hidden p-[1.5px] aurora-shift" style={{ background: "linear-gradient(135deg, hsl(190 95% 55%/0.5), hsl(280 90% 65%/0.5), hsl(330 90% 60%/0.5), hsl(45 95% 55%/0.5), hsl(150 80% 50%/0.5))", backgroundSize: "400% 400%" }}>
              <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-3 overflow-hidden">
                <div className="pointer-events-none absolute -top-16 right-1/4 w-40 h-40 rounded-full bg-purple-500/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 left-1/4 w-40 h-40 rounded-full bg-cyan-400/15 blur-3xl" />

                <div className="relative flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-[0.15em] bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">⚡ Quick Access</h3>
                  <span className="text-[9px] text-muted-foreground font-semibold">18 Menu</span>
                </div>

                <div className="relative grid grid-cols-4 gap-1.5">
                  {([
                    { icon: <Music className="w-5 h-5" strokeWidth={1.9} />, label: "Musik", tab: "playlist" as Tab, color: "from-pink-500 to-rose-500", glow: "236,72,153" },
                    { icon: <Package className="w-5 h-5" strokeWidth={1.9} />, label: "Produk", tab: "produk" as Tab, badge: `${products.length}`, color: "from-cyan-400 to-blue-500", glow: "34,211,238" },
                    { icon: <Ticket className="w-5 h-5" strokeWidth={1.9} />, label: "Voucher", tab: "voucher" as Tab, color: "from-purple-500 to-violet-600", glow: "168,85,247" },
                    { icon: <Wallet className="w-5 h-5" strokeWidth={1.9} />, label: "Saldo", tab: "saldo" as Tab, color: "from-emerald-500 to-green-500", glow: "16,185,129" },
                    { icon: <Heart className="w-5 h-5" strokeWidth={1.9} />, label: "Suka", tab: "likes" as Tab, color: "from-rose-500 to-pink-500", glow: "244,63,94" },
                    { icon: <Gamepad2 className="w-5 h-5" strokeWidth={1.9} />, label: "Game", tab: "game" as Tab, badge: "11", color: "from-yellow-400 to-orange-500", glow: "250,204,21" },
                    { icon: <Flame className="w-5 h-5" strokeWidth={1.9} />, label: "Streak", tab: "streak" as Tab, color: "from-orange-500 to-red-500", glow: "249,115,22" },
                    { icon: <Gem className="w-5 h-5" strokeWidth={1.9} />, label: "Plus", tab: "plus" as Tab, color: "from-indigo-500 to-purple-500", glow: "99,102,241" },
                    { icon: <Megaphone className="w-5 h-5" strokeWidth={1.9} />, label: "Sponsor", tab: "sponsor" as Tab, color: "from-amber-500 to-yellow-500", glow: "245,158,11" },
                    { icon: <MessageSquare className="w-5 h-5" strokeWidth={1.9} />, label: "Tiket", tab: "tiket" as Tab, color: "from-blue-500 to-cyan-500", glow: "59,130,246" },
                    { icon: <Globe className="w-5 h-5" strokeWidth={1.9} />, label: "Publik", tab: "publik" as Tab, color: "from-teal-500 to-cyan-500", glow: "20,184,166" },
                    { icon: <History className="w-5 h-5" strokeWidth={1.9} />, label: "Riwayat", tab: "history" as Tab, color: "from-slate-500 to-zinc-500", glow: "100,116,139" },
                    { icon: <CalendarDays className="w-5 h-5" strokeWidth={1.9} />, label: "Event", tab: "streakevent" as Tab, color: "from-fuchsia-500 to-pink-500", glow: "217,70,239" },
                    { icon: <ShoppingBag className="w-5 h-5" strokeWidth={1.9} />, label: "S.Shop", tab: "streakshop" as Tab, color: "from-lime-500 to-green-500", glow: "132,204,22" },
                    { icon: <Crown className="w-5 h-5" strokeWidth={1.9} />, label: "Member", tab: "streakmembership" as Tab, color: "from-yellow-500 to-amber-500", glow: "234,179,8" },
                    { icon: <RefreshCw className="w-5 h-5" strokeWidth={1.9} />, label: "Update", tab: "update" as Tab, color: "from-sky-500 to-blue-500", glow: "14,165,233" },
                    { icon: <Crown className="w-5 h-5" strokeWidth={1.9} />, label: "L.Royale", external: "/luck-royale-nyawa", color: "from-violet-500 to-fuchsia-500", glow: "139,92,246" },
                    { icon: <FileText className="w-5 h-5" strokeWidth={1.9} />, label: "Admin", tab: "adminpost" as Tab, color: "from-red-500 to-rose-500", glow: "239,68,68" },
                  ] as any[]).map((item) => (
                    <button
                      key={item.label}
                      onClick={() => item.external ? navigate(item.external) : setTab(item.tab)}
                      className="group relative flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/30 hover:bg-white/[0.08] active:scale-95 transition-all duration-200 overflow-hidden"
                      style={{ boxShadow: `0 0 0 0 rgba(${item.glow}, 0)` }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 20px -2px rgba(${item.glow}, 0.5)`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 0 0 0 rgba(${item.glow}, 0)`; }}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                      <div className="relative">
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.color} blur-md opacity-0 group-hover:opacity-60 transition-opacity scale-150`} />
                        <div className={`relative w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg`}>
                          {item.icon}
                        </div>
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-lg ring-2 ring-card">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="relative text-[10px] font-bold text-foreground">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Hero Promo Slider */}
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

            {/* Streak & Game Side by Side - Aurora Premium */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTab("streak")}
                className="group relative overflow-hidden rounded-2xl p-[1.5px] aurora-shift active:scale-[0.98] transition-transform"
                style={{ background: "linear-gradient(135deg, hsl(20 90% 55%/0.7), hsl(0 90% 60%/0.7), hsl(45 95% 55%/0.7), hsl(20 90% 55%/0.7))", backgroundSize: "300% 300%" }}
              >
                <div className="relative rounded-[15px] bg-card/95 backdrop-blur-xl p-3 text-left overflow-hidden">
                  <div className="pointer-events-none absolute -top-6 -right-6 w-20 h-20 rounded-full bg-orange-500/20 blur-2xl" />
                  <div className="relative flex items-center gap-2.5">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                        <Flame className="w-5 h-5 text-white" strokeWidth={2.2} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-foreground leading-tight">Daily Streak</h3>
                      <p className="text-[10px] text-orange-500 font-bold mt-0.5">🔥 Klaim harian</p>
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setTab("game")}
                className="group relative overflow-hidden rounded-2xl p-[1.5px] aurora-shift active:scale-[0.98] transition-transform"
                style={{ background: "linear-gradient(135deg, hsl(280 90% 65%/0.7), hsl(330 90% 60%/0.7), hsl(190 95% 55%/0.7), hsl(280 90% 65%/0.7))", backgroundSize: "300% 300%" }}
              >
                <div className="relative rounded-[15px] bg-card/95 backdrop-blur-xl p-3 text-left overflow-hidden">
                  <div className="pointer-events-none absolute -top-6 -right-6 w-20 h-20 rounded-full bg-purple-500/20 blur-2xl" />
                  <div className="relative flex items-center gap-2.5">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                        <Gamepad2 className="w-5 h-5 text-white" strokeWidth={2.2} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-foreground leading-tight">Game AI</h3>
                      <p className="text-[10px] text-purple-500 font-bold mt-0.5">🎮 11 permainan</p>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Stats Bar - Aurora Premium */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { value: `${products.length}+`, label: "Produk", Icon: Package, color: "from-cyan-400 to-blue-500", glow: "34,211,238" },
                { value: `${homeSponsors.length}`, label: "Sponsor", Icon: Megaphone, color: "from-amber-500 to-yellow-500", glow: "245,158,11" },
                { value: "11", label: "Game", Icon: Gamepad2, color: "from-purple-500 to-pink-500", glow: "168,85,247" },
              ].map(({ value, label, Icon, color, glow }) => (
                <div
                  key={label}
                  className="relative overflow-hidden rounded-2xl p-[1.5px]"
                  style={{ background: `linear-gradient(135deg, rgba(${glow}, 0.6), rgba(${glow}, 0.2), rgba(${glow}, 0.6))` }}
                >
                  <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-3 text-center overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, rgba(${glow}, 0.4) 0%, transparent 70%)` }} />
                    <div className={`relative w-8 h-8 mx-auto rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-4 h-4 text-white" strokeWidth={2.2} />
                    </div>
                    <p className={`relative text-lg font-extrabold mt-1.5 bg-gradient-to-r ${color} bg-clip-text text-transparent tabular-nums`}>{value}</p>
                    <p className="relative text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Admin Posts Preview */}
            {adminPosts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5 text-white" />
                    </div>
                    Postingan Admin
                  </h3>
                  <button onClick={() => setTab("adminpost")} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                    Lihat Semua <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {adminPosts.slice(0, 2).map(post => (
                  <Card key={post.id} className="overflow-hidden glass-card hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1 duration-300 border-border/50 group" onClick={() => setTab("adminpost")}>
                    <CardContent className="p-3.5 flex items-center gap-3.5">
                      {post.image_url && (
                        <img src={post.image_url} alt={post.title} className="w-16 h-16 rounded-xl object-cover shrink-0 shadow-md group-hover:scale-105 transition-transform" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm truncate">{post.title}</h4>
                        {post.content && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{post.content}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(post.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Voucher Card - Aurora */}
            <button
              onClick={() => setTab("voucher")}
              className="group relative w-full text-left rounded-2xl p-[1.5px] aurora-shift overflow-hidden active:scale-[0.99] transition-transform"
              style={{ background: "linear-gradient(135deg, hsl(280 90% 65%/0.6), hsl(330 90% 60%/0.6), hsl(280 90% 65%/0.6))", backgroundSize: "300% 300%" }}
            >
              <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-4 flex items-center gap-3 overflow-hidden shine-sweep">
                <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-purple-500/20 blur-2xl" />
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 blur-md opacity-60" />
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shrink-0">
                    <Ticket className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </div>
                </div>
                <div className="flex-1 min-w-0 relative">
                  <h3 className="font-extrabold text-sm bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">{t("home.have_voucher", lang)}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{t("home.claim_now", lang)}</p>
                </div>
                <ChevronRight className="relative w-4 h-4 text-purple-500 shrink-0 group-hover:translate-x-1 transition-transform" strokeWidth={2.2} />
              </div>
            </button>

            {/* How To Claim - Aurora Premium */}
            <div
              className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden"
              style={{ background: "linear-gradient(135deg, hsl(190 95% 55%/0.5), hsl(280 90% 65%/0.5), hsl(150 80% 50%/0.5), hsl(190 95% 55%/0.5))", backgroundSize: "300% 300%" }}
            >
              <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl overflow-hidden">
                <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-cyan-400/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-purple-500/15 blur-3xl" />

                <div className="relative px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-lg">
                    <HelpCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
                  </div>
                  <h3 className="text-sm font-extrabold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">📚 Cara Klaim Voucher</h3>
                </div>
                <div className="relative p-4 space-y-3">
                  {[
                    { step: "1", icon: <ShoppingBag className="w-4 h-4" strokeWidth={2.2} />, title: "Beli Produk", desc: "Pilih dan beli produk di tab Produk menggunakan saldo.", color: "from-cyan-400 to-blue-500", glow: "34,211,238" },
                    { step: "2", icon: <Ticket className="w-4 h-4" strokeWidth={2.2} />, title: "Masukkan Kode Voucher", desc: "Setelah beli, masukkan kode voucher yang didapat di tab Voucher.", color: "from-purple-500 to-pink-500", glow: "168,85,247" },
                    { step: "3", icon: <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} />, title: "Klaim & Dapat Akun", desc: "Klik Klaim dan dapatkan detail akun produkmu.", color: "from-emerald-500 to-green-500", glow: "16,185,129" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3 relative">
                      <div className="relative shrink-0">
                        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${item.color} blur-md opacity-50`} />
                        <div className={`relative w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center text-xs font-extrabold shadow-lg`}>
                          {item.step}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-extrabold bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setTab("voucher")}
                    className="relative w-full mt-2 h-10 rounded-xl bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 text-white text-xs font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-lg overflow-hidden shine-sweep"
                  >
                    <Ticket className="w-3.5 h-3.5" strokeWidth={2.5} /> ✨ Coba Klaim Sekarang
                  </button>
                </div>
              </div>
            </div>

            {/* Support Shortcut - Aurora */}
            <button
              onClick={() => setTab("tiket")}
              className="group relative w-full text-left rounded-2xl p-[1.5px] aurora-shift overflow-hidden active:scale-[0.99] transition-transform"
              style={{ background: "linear-gradient(135deg, hsl(0 90% 60%/0.6), hsl(20 90% 55%/0.6), hsl(0 90% 60%/0.6))", backgroundSize: "300% 300%" }}
            >
              <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-4 flex items-center gap-3 overflow-hidden shine-sweep">
                <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-red-500/20 blur-2xl" />
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 blur-md opacity-60" />
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
                    <AlertCircle className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </div>
                </div>
                <div className="flex-1 min-w-0 relative">
                  <h3 className="font-extrabold text-sm bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">{t("home.have_issue", lang)}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{t("home.submit_ticket", lang)}</p>
                </div>
                <ChevronRight className="relative w-4 h-4 text-red-500 shrink-0 group-hover:translate-x-1 transition-transform" strokeWidth={2.2} />
              </div>
            </button>

            {/* Social Links - Aurora Premium */}
            <div
              className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden"
              style={{ background: "linear-gradient(135deg, hsl(150 80% 50%/0.5), hsl(190 95% 55%/0.5), hsl(280 90% 65%/0.5), hsl(150 80% 50%/0.5))", backgroundSize: "300% 300%" }}
            >
              <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-4 overflow-hidden">
                <div className="pointer-events-none absolute -top-12 right-0 w-32 h-32 rounded-full bg-emerald-500/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-12 left-0 w-32 h-32 rounded-full bg-cyan-400/15 blur-3xl" />

                <div className="relative flex items-center justify-between mb-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.15em] flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
                    <Globe className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.2} /> {t("home.follow_us", lang)}
                  </p>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[9px] font-bold">{socialLinks.length} Akun</span>
                </div>
                <div className="relative grid grid-cols-3 gap-2">
                  {socialLinks.map((s, i) => {
                    const palette = [
                      { color: "from-pink-500 to-rose-500", glow: "236,72,153" },
                      { color: "from-cyan-400 to-blue-500", glow: "34,211,238" },
                      { color: "from-purple-500 to-violet-600", glow: "168,85,247" },
                      { color: "from-emerald-500 to-green-500", glow: "16,185,129" },
                      { color: "from-yellow-400 to-orange-500", glow: "250,204,21" },
                    ][i % 5];
                    return (
                      <a
                        key={s.id}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/30 hover:bg-white/[0.08] transition-all overflow-hidden active:scale-95"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${palette.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                        <div className="relative">
                          <div className={`absolute inset-0 bg-gradient-to-br ${palette.color} blur-md opacity-0 group-hover:opacity-50 transition-opacity scale-150`} />
                          {s.icon_url ? (
                            <img src={s.icon_url} alt={s.platform} className="relative w-8 h-8 object-contain rounded-lg" />
                          ) : (
                            <span className={`relative w-8 h-8 rounded-lg bg-gradient-to-br ${palette.color} flex items-center justify-center text-xs font-extrabold text-white shadow-lg`}>{s.platform[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <span className="relative truncate text-[10px] font-bold w-full text-center text-foreground">{s.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "produk" && (
          <div className="space-y-4 animate-fade-in">
            {/* Hero Header - Holographic Aurora Premium */}
            <div
              className="relative rounded-3xl p-[2px] aurora-shift overflow-hidden shadow-[0_8px_40px_-10px_rgba(34,211,238,0.5)]"
              style={{ background: "linear-gradient(135deg, hsl(190 95% 55%), hsl(220 90% 60%), hsl(280 90% 65%), hsl(330 90% 60%), hsl(45 95% 55%), hsl(190 95% 55%))", backgroundSize: "400% 400%" }}
            >
              <div className="relative rounded-[22px] bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-xl p-4 overflow-hidden">
                {/* Animated mesh gradient background */}
                <div className="pointer-events-none absolute inset-0 opacity-60">
                  <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-cyan-500/30 blur-3xl animate-pulse" />
                  <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-purple-500/30 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-pink-500/20 blur-2xl animate-pulse" style={{ animationDelay: "0.5s" }} />
                </div>
                {/* Floating particles */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-white/60"
                      style={{
                        top: `${15 + (i * 13) % 70}%`,
                        left: `${(i * 17) % 90}%`,
                        animation: `float-up ${3 + (i % 3)}s ease-in-out ${i * 0.4}s infinite`,
                        boxShadow: "0 0 6px rgba(255,255,255,0.8)",
                      }}
                    />
                  ))}
                </div>
                {/* Shine sweep overlay */}
                <div className="pointer-events-none absolute inset-0 shine-sweep opacity-40" />

                <div className="relative flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 blur-lg opacity-80 animate-pulse" />
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 opacity-50 animate-spin" style={{ animationDuration: "8s" }} />
                    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.7),inset_0_2px_8px_rgba(255,255,255,0.3)] border border-white/30">
                      <Package className="w-7 h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-pink-200 to-purple-300 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(34,211,238,0.4)]">{t("products.title", lang)}</h2>
                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.7)] border border-white/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_4px_white]" /> LIVE
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white shadow-[0_0_15px_rgba(251,146,60,0.6)] border border-white/30 animate-pulse">
                        🔥 HOT
                      </span>
                    </div>
                    <p className="text-cyan-100/80 text-[11px] mt-1 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-yellow-300" /> {sortedProducts.length} {t("products.items", lang)} siap diklaim instant
                    </p>
                  </div>
                </div>

                {/* Premium Stats Grid - 3D Cards */}
                <div className="relative grid grid-cols-3 gap-2 mt-4">
                  {[
                    { label: "Total", value: sortedProducts.length, from: "from-cyan-500/30", to: "to-blue-600/20", border: "border-cyan-300/40", text: "text-cyan-200", glow: "rgba(34,211,238,0.5)", icon: "📦" },
                    { label: "Tersedia", value: sortedProducts.filter(p => p.stock > 0).length, from: "from-emerald-500/30", to: "to-green-600/20", border: "border-emerald-300/40", text: "text-emerald-200", glow: "rgba(16,185,129,0.5)", icon: "✨" },
                    { label: "Garansi", value: sortedProducts.filter(p => p.has_warranty).length, from: "from-purple-500/30", to: "to-pink-600/20", border: "border-purple-300/40", text: "text-purple-200", glow: "rgba(168,85,247,0.5)", icon: "🛡️" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className={`relative rounded-xl p-2.5 bg-gradient-to-br ${s.from} ${s.to} border ${s.border} backdrop-blur-md overflow-hidden hover:scale-105 transition-transform duration-300 group/stat`}
                      style={{ boxShadow: `0 4px 20px -4px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.15)` }}
                    >
                      <div className="absolute -top-6 -right-6 w-14 h-14 rounded-full opacity-40 blur-xl group-hover/stat:opacity-70 transition" style={{ background: s.glow }} />
                      <div className="relative flex items-center justify-between">
                        <p className={`text-2xl font-black tabular-nums leading-none ${s.text} drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]`}>{s.value}</p>
                        <span className="text-base opacity-60 group-hover/stat:opacity-100 group-hover/stat:scale-125 transition-transform">{s.icon}</span>
                      </div>
                      <p className="text-white/70 text-[9px] font-bold uppercase tracking-wider mt-1.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Streak-powered hype + bonus bar */}
            <ProductHypeStreakBar
              visitorId={activeBalanceVisitorId || visitorId}
              totalProducts={sortedProducts.length}
              inStockProducts={sortedProducts.filter(p => p.stock > 0).length}
            />

            {/* Advanced Product Navigation Toolbar */}
            <ProductNavToolbar
              value={{
                search: productSearch,
                category: selectedCategory,
                sort: sortOrder,
                view: productViewMode,
                minPrice: productMinPrice,
                maxPrice: productMaxPrice,
                inStockOnly,
                warrantyOnly,
              }}
              onChange={(next) => {
                if (next.search !== undefined) setProductSearch(next.search);
                if (next.category !== undefined) setSelectedCategory(next.category);
                if (next.sort !== undefined) setSortOrder(next.sort as any);
                if (next.view !== undefined) setProductViewMode(next.view);
                if (next.minPrice !== undefined) setProductMinPrice(next.minPrice);
                if (next.maxPrice !== undefined) setProductMaxPrice(next.maxPrice);
                if (next.inStockOnly !== undefined) setInStockOnly(next.inStockOnly);
                if (next.warrantyOnly !== undefined) setWarrantyOnly(next.warrantyOnly);
              }}
              categories={categories}
              categoryCounts={productCategoryCounts}
              storageKey="product_search_history_v1"
              popularSuggestions={popularProductTerms}
              totalCount={products.length}
              resultCount={sortedProducts.length}
            />

            {/* Skeleton loading */}
            {productsLoading && (
              <div className={productViewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-border/40 overflow-hidden glass-card animate-pulse">
                    <div className={`bg-muted/60 ${productViewMode === "grid" ? "h-32" : "h-44"} shimmer`} />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-muted/60 rounded w-3/4" />
                      <div className="h-2.5 bg-muted/40 rounded w-1/2" />
                      <div className="h-5 bg-muted/40 rounded-full w-16" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!productsLoading && sortedProducts.length === 0 && (
              <div className="text-center py-16 text-muted-foreground glass-card rounded-2xl border-2 border-dashed border-border/50">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 flex items-center justify-center mx-auto mb-4 floating">
                  <Package className="w-12 h-12 opacity-40" />
                </div>
                <p className="text-sm font-extrabold">Tidak ada produk cocok</p>
                <p className="text-xs text-muted-foreground mt-1 px-6">Coba ubah filter, kategori, atau kata kunci pencarian.</p>
              </div>
            )}

            {/* Product list/grid */}
            {!productsLoading && sortedProducts.length > 0 && (
              <div className={productViewMode === "grid" ? "grid grid-cols-2 gap-3" : productViewMode === "compact" ? "space-y-2 [&_.aspect-square]:aspect-[3/1] [&_img]:max-h-24" : "space-y-4"}>
                {sortedProducts.map((p) => {
                  const imgs = getProductImages(p.id);
                  const badges = getProductBadges(p);
                  const isGrid = productViewMode === "grid";
                  const inStock = p.stock > 0;
                  const isNew = (Date.now() - new Date(p.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
                  return (
                    <div
                      key={p.id}
                      className="relative rounded-2xl p-[2px] aurora-shift overflow-hidden cursor-pointer group transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02]"
                      style={{ background: inStock
                        ? "linear-gradient(135deg, hsl(190 95% 55%/0.8), hsl(280 90% 65%/0.7), hsl(330 90% 60%/0.8), hsl(45 95% 55%/0.7), hsl(190 95% 55%/0.8))"
                        : "linear-gradient(135deg, hsl(0 0% 50%/0.4), hsl(0 70% 50%/0.5), hsl(0 0% 50%/0.4))",
                        backgroundSize: "300% 300%",
                        boxShadow: inStock ? "0 8px 32px -8px rgba(34,211,238,0.4), 0 4px 16px -4px rgba(168,85,247,0.3)" : "0 4px 16px -4px rgba(0,0,0,0.3)" }}
                      onClick={() => openProduct(p)}
                    >
                      <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 backdrop-blur-xl rounded-[14px] card-shine relative">
                      {/* Holographic shimmer overlay */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      {/* Inner neon glow on hover */}
                      <div className="absolute -inset-0.5 bg-gradient-to-br from-cyan-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-cyan-500/30 group-hover:via-purple-500/20 group-hover:to-pink-500/30 rounded-[14px] blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10" />

                      {/* Corner ribbon for warranty */}
                      {p.has_warranty && (
                        <div className="absolute top-0 right-0 z-20 overflow-hidden w-16 h-16 pointer-events-none">
                          <div className="absolute top-2 -right-6 rotate-45 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-black text-[8px] font-black px-6 py-0.5 shadow-[0_2px_8px_rgba(251,191,36,0.6)] tracking-wider">
                            ✓ GARANSI
                          </div>
                        </div>
                      )}

                      {imgs.length > 0 && (
                        <div className={`relative overflow-hidden ${isGrid ? "aspect-square" : ""}`}>
                          <ImageCarousel images={imgs} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                          {/* Scan line effect on hover */}
                          <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-[float-up_2s_ease-in-out_infinite]" style={{ top: "50%" }} />
                          </div>

                          {/* Dynamic badges (top-left, stacked) */}
                          {(badges.length > 0 || isNew) && (
                            <div className="absolute top-2 left-2 flex flex-col gap-1 max-w-[60%] z-10">
                              {isNew && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.7)] border border-white/40 animate-pulse">
                                  ✨ NEW
                                </span>
                              )}
                              {badges.map((b, i) => (
                                <span key={i} className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-md border border-white/20 ${b.className} animate-fade-in`} style={{ animationDelay: `${i * 80}ms` }}>
                                  {b.label}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Price badge top-right - holographic neon */}
                          <div className="absolute top-2 right-2 z-10" style={{ marginRight: p.has_warranty ? "0" : "0" }}>
                            <div className="relative">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 blur-md opacity-70 animate-pulse" />
                              <span className={`relative inline-block font-black bg-gradient-to-r from-cyan-300 via-white to-purple-200 text-slate-900 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.8),inset_0_1px_2px_rgba(255,255,255,0.5)] backdrop-blur-sm border-2 border-white/50 ${isGrid ? "text-[10px] px-2.5 py-1" : "text-xs px-3 py-1.5"}`}>{formatPrice(p.price)}</span>
                            </div>
                          </div>

                          {/* Action buttons bottom-right */}
                          <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
                            <button onClick={(e) => { e.stopPropagation(); setQuickViewProduct(p); }}
                              className="rounded-full bg-cyan-500/80 backdrop-blur-md p-2 shadow-[0_0_12px_rgba(34,211,238,0.6)] hover:bg-cyan-400 hover:scale-110 hover:rotate-12 transition-all border border-white/30"
                              aria-label="Quick view">
                              <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                            </button>
                            <button onClick={(e) => toggleLike(p.id, e)}
                              className={`rounded-full backdrop-blur-md p-2 shadow-lg hover:scale-110 transition-all border border-white/30 ${likedIds.has(p.id) ? "bg-pink-500/90 shadow-[0_0_12px_rgba(236,72,153,0.7)]" : "bg-slate-800/80 hover:bg-pink-500/80"}`}
                              aria-label="Like">
                              <Heart className={`w-3.5 h-3.5 transition-all ${likedIds.has(p.id) ? "fill-white text-white scale-110" : "text-white"}`} />
                            </button>
                          </div>

                          {p.category && !isGrid && (
                            <div className="absolute bottom-2 left-2 z-10">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-gradient-to-r from-purple-500/90 to-pink-500/90 text-white backdrop-blur-md px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)] border border-white/30">
                                <Sparkles className="w-2.5 h-2.5" /> {p.category}
                              </span>
                            </div>
                          )}
                          {(productLikeCounts[p.id] || 0) > 0 && (
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-gradient-to-r from-rose-500/90 to-pink-500/90 backdrop-blur-md px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)] border border-white/30 z-10" style={isGrid || !p.category ? {} : { display: "none" }}>
                              <Heart className="w-3 h-3 fill-white text-white" />
                              <span className="text-[10px] font-black text-white">{productLikeCounts[p.id]}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <CardContent className={`space-y-2 ${isGrid ? "p-3" : "p-4 space-y-3"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={`font-black flex-1 text-white group-hover:bg-gradient-to-r group-hover:from-cyan-300 group-hover:to-pink-300 group-hover:bg-clip-text group-hover:text-transparent transition-all line-clamp-2 ${isGrid ? "text-xs" : "text-base"}`}>{p.title}</h3>
                          {imgs.length === 0 && (
                            <button onClick={(e) => toggleLike(p.id, e)} className="flex items-center gap-1 shrink-0">
                              <Heart className={`w-4 h-4 transition-all ${likedIds.has(p.id) ? "fill-pink-500 text-pink-500" : "text-muted-foreground"}`} />
                            </button>
                          )}
                        </div>
                        {/* Star rating row */}
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.5)]" />
                            ))}
                          </div>
                          <span className="text-[9px] font-bold text-amber-300/80">5.0</span>
                          <span className="text-[9px] text-muted-foreground">• Terverifikasi</span>
                        </div>
                        {p.description && !isGrid && <p className="text-xs text-slate-300/80 line-clamp-2 leading-relaxed">{p.description}</p>}
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          {imgs.length === 0 && <span className={`font-black bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent ${isGrid ? "text-xs" : "text-sm"}`}>{formatPrice(p.price)}</span>}
                          <div className={`flex items-center gap-1.5 flex-wrap ${isGrid ? "text-[9px]" : ""}`}>
                            <span className={`px-2 py-0.5 rounded-full font-black flex items-center gap-1 backdrop-blur-sm ${isGrid ? "text-[9px]" : "text-[10px] px-2.5 py-1"} ${inStock ? 'bg-gradient-to-r from-emerald-500/30 to-green-500/20 text-emerald-200 border border-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-r from-rose-500/30 to-red-500/20 text-rose-200 border border-rose-400/40'}`}>
                              {inStock ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_rgb(52,211,153)]" /> {p.stock} stok</> : '✗ Habis'}
                            </span>
                            {!isGrid && (
                              <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-slate-800/60 text-slate-300 flex items-center gap-1 border border-slate-700/50">
                                <CalendarDays className="w-3 h-3" /> {new Date(p.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Premium CTA button */}
                        {inStock && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openProduct(p); }}
                            className={`relative w-full overflow-hidden rounded-lg font-black text-white shadow-[0_4px_15px_rgba(34,211,238,0.4)] hover:shadow-[0_6px_20px_rgba(168,85,247,0.6)] transition-all hover:scale-[1.02] active:scale-[0.98] group/btn ${isGrid ? "h-7 text-[10px]" : "h-9 text-xs"}`}
                            style={{ background: "linear-gradient(135deg, hsl(190 95% 50%), hsl(220 90% 55%), hsl(280 90% 60%), hsl(330 90% 55%))", backgroundSize: "200% 200%" }}
                          >
                            <span className="absolute inset-0 shine-sweep opacity-60" />
                            <span className="relative flex items-center justify-center gap-1.5">
                              <ShoppingBag className={`${isGrid ? "w-3 h-3" : "w-3.5 h-3.5"} group-hover/btn:rotate-12 transition-transform`} />
                              Beli Sekarang
                            </span>
                          </button>
                        )}
                      </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "voucher" && (() => {
          const today = new Date();
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const todayCount = history.filter(h => new Date(h.claimed_at) >= todayStart).length;
          const pendingCount = parseCodes(tokenInput).length;
          const recentClaims = history.slice(0, 5);

          return (
          <div className="space-y-4 animate-fade-in">
            {/* Hero Header - Aurora Premium */}
            <div
              className="relative rounded-3xl p-[1.5px] aurora-shift overflow-hidden"
              style={{ background: "linear-gradient(135deg, hsl(330 90% 60%/0.7), hsl(280 90% 65%/0.7), hsl(45 95% 55%/0.7), hsl(330 90% 60%/0.7))", backgroundSize: "300% 300%" }}
            >
              <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-4 overflow-hidden">
                <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-pink-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl" />
                <div className="pointer-events-none absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-yellow-400/10 blur-2xl" />

                <div className="relative flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-yellow-400 blur-md opacity-70 animate-pulse" />
                    <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-yellow-400 flex items-center justify-center shadow-2xl">
                      <Ticket className="w-6 h-6 text-white" strokeWidth={2.2} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.18em] font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-400 bg-clip-text text-transparent">🎟️ Pusat Voucher</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-500 text-[8px] font-bold">LIVE</span>
                    </div>
                    <h2 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-foreground via-pink-500 to-foreground bg-clip-text text-transparent leading-tight">{t("voucher.title", lang)}</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">✨ Klaim kode voucher produkmu</p>
                  </div>
                </div>

                <div className="relative grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10">
                  {[
                    { label: "Total", value: history.length, color: "from-pink-500 to-rose-500", glow: "236,72,153" },
                    { label: "Hari Ini", value: todayCount, color: "from-purple-500 to-violet-600", glow: "168,85,247" },
                    { label: "Pending", value: pendingCount, color: "from-yellow-400 to-amber-500", glow: "250,204,21" },
                  ].map((s) => (
                    <div key={s.label} className="relative rounded-xl p-[1px] overflow-hidden" style={{ background: `linear-gradient(135deg, rgba(${s.glow},0.5), rgba(${s.glow},0.15))` }}>
                      <div className="relative rounded-[10px] bg-card/95 backdrop-blur-xl p-2 text-center overflow-hidden">
                        <div className="pointer-events-none absolute inset-0 opacity-15" style={{ background: `radial-gradient(circle at center, rgba(${s.glow},0.6) 0%, transparent 70%)` }} />
                        <p className={`relative text-lg font-extrabold bg-gradient-to-r ${s.color} bg-clip-text text-transparent tabular-nums leading-none`}>{s.value}</p>
                        <p className="relative text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-1">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* === Navigasi Voucher Keren === */}
            <VoucherNavigation
              active={voucherSection}
              onChange={setVoucherSection}
              totalClaimed={history.length}
              todayCount={todayCount}
              pendingCodes={pendingCount}
              onGoProduk={() => setTab("produk")}
              onGoSaldo={() => setTab("saldo")}
              onGoHistory={() => setTab("history")}
            />

            {voucherSection === "claim" && (
              <>
                {/* Info: Harus beli dulu - Aurora */}
                <div
                  className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden"
                  style={{ background: "linear-gradient(135deg, hsl(190 95% 55%/0.5), hsl(280 90% 65%/0.5), hsl(190 95% 55%/0.5))", backgroundSize: "300% 300%" }}
                >
                  <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-3.5 flex items-start gap-3 overflow-hidden">
                    <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-cyan-400/15 blur-3xl" />
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 blur-md opacity-50" />
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-lg">
                        <ShoppingBag className="w-5 h-5 text-white" strokeWidth={2.2} />
                      </div>
                    </div>
                    <div className="relative">
                      <p className="text-xs font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">💡 Cara Mendapatkan Voucher</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">Beli produk terlebih dahulu di tab <span className="font-extrabold text-cyan-500 underline cursor-pointer" onClick={() => setTab("produk")}>Produk</span> atau gunakan <span className="font-extrabold text-purple-500 underline cursor-pointer" onClick={() => setTab("saldo")}>Saldo</span>, lalu kode voucher akan diberikan setelah pembayaran berhasil.</p>
                    </div>
                  </div>
                </div>

                {/* Claim Form - Aurora Premium */}
                <div
                  className="relative rounded-3xl p-[1.5px] aurora-shift overflow-hidden"
                  style={{ background: "linear-gradient(135deg, hsl(280 90% 65%/0.6), hsl(330 90% 60%/0.6), hsl(45 95% 55%/0.6), hsl(150 80% 50%/0.6), hsl(280 90% 65%/0.6))", backgroundSize: "400% 400%" }}
                >
                  <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl overflow-hidden">
                    <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-purple-500/15 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-pink-500/15 blur-3xl" />

                    <div className="relative p-5 space-y-4">
                      <div className="text-center">
                        <div className="relative w-16 h-16 mx-auto mb-3">
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-400 blur-lg opacity-60 animate-pulse" />
                          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-400 flex items-center justify-center shadow-2xl">
                            <Ticket className="w-8 h-8 text-white" strokeWidth={2.2} />
                          </div>
                        </div>
                        <p className="text-base font-extrabold bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 bg-clip-text text-transparent">✨ Masukkan Kode Voucher</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Pisahkan dengan <span className="font-mono font-extrabold text-purple-500 bg-purple-500/15 px-1.5 py-0.5 rounded border border-purple-500/30">|</span> atau Enter untuk banyak kode</p>
                      </div>
                      <div className="space-y-3">
                        <Textarea
                          placeholder="KODE1 | KODE2 | KODE3"
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                          className="font-mono text-center text-sm tracking-wider uppercase border-2 border-purple-500/30 focus:border-purple-500 min-h-[60px] bg-purple-500/5 rounded-xl"
                          rows={2}
                        />
                        {parseCodes(tokenInput).length > 0 && (
                          <div className="flex items-center justify-center gap-2 rounded-xl p-2.5 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg">
                              <span className="text-[10px] font-extrabold text-white">{parseCodes(tokenInput).length}</span>
                            </div>
                            <span className="text-xs text-emerald-500 font-extrabold">✅ kode terdeteksi</span>
                          </div>
                        )}
                        <button
                          onClick={handleClaim}
                          disabled={claiming || !tokenInput.trim()}
                          className="relative w-full h-12 font-extrabold text-sm rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 text-white shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shine-sweep flex items-center justify-center gap-2"
                        >
                          {claiming ? <span className="animate-pulse">⏳ Memproses...</span> : <><CheckCircle2 className="w-5 h-5" strokeWidth={2.5} /> 🎉 Klaim Sekarang</>}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {claimResults.length > 0 && (
                  <div className="space-y-3">
                    <Card className="border-0 shadow-lg overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-accent to-primary" />
                      <CardContent className="p-5 text-center bg-gradient-to-br from-accent/5 to-primary/5">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Harga</p>
                        <p className="text-3xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{formatPrice(totalClaimPrice)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{claimResults.length} voucher berhasil diklaim</p>
                      </CardContent>
                    </Card>

                    {claimResults.map((result, ri) => (
                      <Card key={ri} className="border-0 shadow-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-accent to-accent/70 p-3.5 text-accent-foreground flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="font-extrabold text-sm">Voucher Berhasil Diklaim!</span>
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
              </>
            )}

            {voucherSection === "recent" && (
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-sky-500 to-blue-500" />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-sky-500" />
                      <p className="text-xs font-extrabold">Klaim Terbaru</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-primary" onClick={() => setTab("history")}>
                      Lihat Semua <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                  {recentClaims.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-2">
                        <Inbox className="w-7 h-7 text-muted-foreground opacity-40" />
                      </div>
                      <p className="text-xs font-bold text-muted-foreground">Belum ada klaim</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Klaim voucher pertamamu sekarang!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentClaims.map(h => (
                        <div key={h.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-500/5 dark:to-blue-500/5 border border-sky-200/50 dark:border-sky-500/20">
                          {h.product_image ? (
                            <img src={h.product_image} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shrink-0">
                              <Crown className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold truncate">{h.product_title}</p>
                            <p className="text-[10px] font-mono text-muted-foreground truncate">{h.token_code}</p>
                          </div>
                          <span className="text-[9px] text-muted-foreground shrink-0">{new Date(h.claimed_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {voucherSection === "tips" && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-foreground" strokeWidth={1.7} />
                  <p className="text-xs font-semibold">Tips & Trik Klaim Voucher</p>
                </div>
                {[
                  { icon: Zap, title: "Klaim Massal", desc: "Pisahkan kode dengan tanda | atau Enter untuk klaim banyak voucher sekaligus." },
                  { icon: Shield, title: "Aman & Terpercaya", desc: "Setiap kode hanya berlaku sekali pakai. Jangan bagikan ke siapapun." },
                  { icon: Gift, title: "Cek Histori", desc: "Semua klaim tersimpan di tab Riwayat lengkap dengan detail akun." },
                  { icon: Award, title: "Beli Produk Dulu", desc: "Voucher hanya didapat setelah pembelian produk berhasil." },
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <tip.icon className="w-4 h-4 text-foreground" strokeWidth={1.7} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{tip.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{tip.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })()}


        {tab === "history" && (
          <div className="space-y-4 animate-fade-in">
            {/* Hero Header - Aurora Premium */}
            <div
              className="relative rounded-3xl p-[2px] aurora-shift overflow-hidden shadow-[0_8px_40px_-10px_rgba(168,85,247,0.5)]"
              style={{ background: "linear-gradient(135deg, hsl(280 90% 65%), hsl(220 90% 60%), hsl(190 95% 55%), hsl(330 90% 60%), hsl(280 90% 65%))", backgroundSize: "400% 400%" }}
            >
              <div className="relative rounded-[22px] bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-xl p-4 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 opacity-60">
                  <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-purple-500/30 blur-3xl animate-pulse" />
                  <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-cyan-500/30 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
                </div>
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-white/60"
                      style={{
                        top: `${20 + (i * 17) % 60}%`,
                        left: `${(i * 21) % 90}%`,
                        animation: `float-up ${3 + (i % 3)}s ease-in-out ${i * 0.5}s infinite`,
                        boxShadow: "0 0 6px rgba(255,255,255,0.8)",
                      }}
                    />
                  ))}
                </div>
                <div className="pointer-events-none absolute inset-0 shine-sweep opacity-40" />

                <div className="relative flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-400 via-pink-500 to-cyan-500 blur-lg opacity-80 animate-pulse" />
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-purple-400 via-pink-500 to-cyan-500 opacity-50 animate-spin" style={{ animationDuration: "8s" }} />
                    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.7),inset_0_2px_8px_rgba(255,255,255,0.3)] border border-white/30">
                      <Clock className="w-7 h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-purple-200 via-pink-200 to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(168,85,247,0.4)]">{t("history.title", lang)}</h2>
                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.7)] border border-white/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_4px_white]" /> LIVE
                      </span>
                    </div>
                    <p className="text-purple-100/80 text-[11px] mt-1 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-yellow-300" /> {history.length} klaim voucher tercatat
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Summary - Aurora 3D */}
            {history.length > 0 && (() => {
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const weekAgo = new Date(today.getTime() - 7 * 86400000);
              const todayCount = history.filter(h => new Date(h.claimed_at) >= today).length;
              const weekCount = history.filter(h => new Date(h.claimed_at) >= weekAgo).length;
              return (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Total", value: history.length, icon: Award, from: "from-cyan-500/30", to: "to-blue-600/20", border: "border-cyan-300/40", text: "text-cyan-200", glow: "rgba(34,211,238,0.5)" },
                    { label: "Hari Ini", value: todayCount, icon: CalendarDays, from: "from-emerald-500/30", to: "to-green-600/20", border: "border-emerald-300/40", text: "text-emerald-200", glow: "rgba(16,185,129,0.5)" },
                    { label: "7 Hari", value: weekCount, icon: TrendingUp, from: "from-fuchsia-500/30", to: "to-pink-600/20", border: "border-fuchsia-300/40", text: "text-fuchsia-200", glow: "rgba(217,70,239,0.5)" },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.label}
                        className={`relative rounded-xl p-2.5 bg-gradient-to-br ${s.from} ${s.to} border ${s.border} backdrop-blur-md overflow-hidden hover:scale-105 transition-transform duration-300 group/stat`}
                        style={{ boxShadow: `0 4px 20px -4px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.15)` }}
                      >
                        <div className="absolute -top-6 -right-6 w-14 h-14 rounded-full opacity-40 blur-xl group-hover/stat:opacity-70 transition" style={{ background: s.glow }} />
                        <Icon className={`w-4 h-4 ${s.text} mb-1 drop-shadow-[0_0_4px_currentColor]`} />
                        <p className={`text-xl font-black tabular-nums leading-none ${s.text} drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]`}><CountUp value={s.value} /></p>
                        <p className="text-white/70 text-[9px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {history.length > 0 && (
              <div
                className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden"
                style={{ background: "linear-gradient(135deg, hsl(190 95% 55%/0.6), hsl(280 90% 65%/0.6), hsl(330 90% 60%/0.6), hsl(190 95% 55%/0.6))", backgroundSize: "300% 300%" }}
              >
                <div className="rounded-[14px] bg-gradient-to-br from-slate-950/90 to-slate-900/90 backdrop-blur-xl p-3 flex items-center justify-between gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={toggleSelectAll} className="gap-1.5 text-xs rounded-lg font-bold bg-slate-800/60 border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/20">
                    <Checkbox checked={history.length > 0 && selectedHistoryIds.size === history.length} className="pointer-events-none" />
                    Pilih Semua ({selectedHistoryIds.size}/{history.length})
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setSmartHistory(v => !v)}
                      className={`gap-1 rounded-full text-xs font-bold border ${smartHistory ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]" : "bg-slate-800/60 text-amber-200 border-amber-400/30 hover:bg-amber-500/20"}`}
                    >
                      <Lightbulb className="w-3 h-3" strokeWidth={2.2} /> {smartHistory ? "Pintar ✓" : "Pintar"}
                    </Button>
                    <Button size="sm" onClick={downloadHistoryPDF} className="gap-1 rounded-full bg-gradient-to-r from-rose-500/80 to-red-500/80 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black border border-rose-300/40 shadow-[0_0_12px_rgba(244,63,94,0.4)]">
                      <Download className="w-3 h-3" /> PDF
                    </Button>
                    <Button size="sm" onClick={downloadHistoryTXT} className="gap-1 rounded-full bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-black border border-emerald-300/40 shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                      <FileText className="w-3 h-3" /> TXT
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {history.length === 0 && (
              <div
                className="relative rounded-3xl p-[2px] aurora-shift overflow-hidden"
                style={{ background: "linear-gradient(135deg, hsl(280 90% 65%/0.5), hsl(190 95% 55%/0.5), hsl(280 90% 65%/0.5))", backgroundSize: "300% 300%" }}
              >
                <div className="rounded-[22px] bg-gradient-to-br from-slate-950/95 to-slate-900/95 backdrop-blur-xl text-center py-16 px-6 relative overflow-hidden">
                  <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-purple-500/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-cyan-500/20 blur-3xl" />
                  <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500/30 via-fuchsia-500/20 to-cyan-500/30 flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-[0_0_40px_rgba(168,85,247,0.4)]">
                    <Clock className="w-12 h-12 text-purple-200/60" />
                  </div>
                  <p className="relative text-base font-black bg-gradient-to-r from-purple-200 to-cyan-200 bg-clip-text text-transparent">Belum ada riwayat klaim</p>
                  <p className="relative text-xs text-slate-400 mt-1.5">Klaim voucher untuk melihat riwayat di sini</p>
                  <Button size="sm" className="relative mt-4 gap-1.5 rounded-xl font-black bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_4px_20px_rgba(168,85,247,0.5)] hover:scale-105 transition-transform border border-white/20" onClick={() => setTab("voucher")}>
                    <Ticket className="w-4 h-4" /> Klaim Voucher
                  </Button>
                </div>
              </div>
            )}

            {history.length > 0 && smartHistory && (() => {
              const items: HistoryItem[] = history.map(h => ({
                id: h.id,
                title: h.product_title,
                subtitle: h.fields.map(f => `${f.field_name}: ${f.field_value}`).join(" • ") || h.token_code,
                amount: h.product_price || 0,
                date: h.claimed_at,
                category: "Klaim",
                meta: { token: h.token_code },
              }));
              const renderClaim = (it: HistoryItem) => {
                const h = history.find(hh => hh.id === it.id);
                if (!h) return null;
                const deviceSummary = h.device_info ? getDeviceSummary(h.device_info) : "Tidak diketahui";
                return (
                  <Card className="overflow-hidden border border-border/60 shadow-sm">
                    <div className="bg-gradient-to-r from-primary/10 to-accent/5 px-3 py-2 flex items-center justify-between border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={selectedHistoryIds.has(h.id)} onCheckedChange={() => toggleHistorySelect(h.id)} />
                        <span className="text-[11px] font-extrabold text-primary">{h.product_title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full border border-border/50">{h.token_code}</span>
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Smartphone className="w-3 h-3" /> {deviceSummary}
                      </div>
                      {h.fields.length > 0 && (
                        <div className="bg-muted/30 rounded-lg p-2 space-y-1">
                          {h.fields.map((f, i) => {
                            const fid = `sm-${h.id}-${i}`;
                            return (
                              <div key={i} className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">{f.field_name}</span>
                                <button onClick={() => copyText(f.field_value, fid)}
                                  className={`font-mono font-bold px-1.5 py-0.5 rounded ${copiedField === fid ? 'bg-accent/20 text-accent' : 'bg-primary/10 text-primary'}`}>
                                  {copiedField === fid ? '✓ Disalin' : f.field_value}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              };
              return (
                <HistoryEnhancer
                  title="Riwayat Klaim Voucher"
                  items={items}
                  categories={["Klaim"]}
                  formatAmount={formatPrice}
                  exportPrefix="riwayat-klaim"
                  storeName={STORE_NAME}
                  renderItem={renderClaim}
                />
              );
            })()}

            {history.length > 0 && !smartHistory && (
              <>
                {paginatedHistory.map((h, idx) => {
                  const deviceSummary = h.device_info ? getDeviceSummary(h.device_info) : "Tidak diketahui";
                  const globalIdx = (historyPage - 1) * HISTORY_PER_PAGE + idx;
                  return (
                    <div
                      key={`${h.id}-${globalIdx}`}
                      className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden group transition-all duration-500 hover:-translate-y-1.5 hover:scale-[1.01]"
                      style={{ background: "linear-gradient(135deg, hsl(280 90% 65%/0.7), hsl(220 90% 60%/0.6), hsl(190 95% 55%/0.7), hsl(330 90% 60%/0.6), hsl(280 90% 65%/0.7))", backgroundSize: "300% 300%", boxShadow: "0 8px 28px -10px rgba(168,85,247,0.4)" }}
                    >
                      <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 backdrop-blur-xl rounded-[14px] card-shine relative">
                        {/* Hover glow */}
                        <div className="absolute -inset-0.5 bg-gradient-to-br from-purple-500/0 via-cyan-500/0 to-pink-500/0 group-hover:from-purple-500/20 group-hover:via-cyan-500/15 group-hover:to-pink-500/20 rounded-[14px] blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10" />

                        <div className="relative bg-gradient-to-r from-purple-500/20 via-fuchsia-500/15 to-cyan-500/20 px-4 py-2.5 flex items-center justify-between border-b border-white/10 overflow-hidden">
                          <div className="absolute inset-0 shine-sweep opacity-30 pointer-events-none" />
                          <div className="relative flex items-center gap-2.5">
                            <Checkbox checked={selectedHistoryIds.has(h.id)} onCheckedChange={() => toggleHistorySelect(h.id)} className="border-cyan-300/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500" />
                            <span className="text-xs font-black bg-gradient-to-r from-cyan-300 via-pink-300 to-purple-300 bg-clip-text text-transparent drop-shadow">#{globalIdx + 1}</span>
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-black shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                              <CheckCircle2 className="w-2.5 h-2.5" /> CLAIMED
                            </span>
                          </div>
                          <span className="relative text-[10px] font-mono font-bold text-cyan-200 bg-slate-950/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-cyan-400/30 shadow-[0_0_8px_rgba(34,211,238,0.3)]">{h.token_code}</span>
                        </div>
                        <CardContent className="p-4 space-y-2.5">
                          <div className="flex items-center gap-3">
                            {h.product_image ? (
                              <div className="relative shrink-0">
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 blur-md opacity-50" />
                                <img src={h.product_image} className="relative w-12 h-12 rounded-xl object-cover ring-2 ring-purple-400/40 shadow-[0_0_12px_rgba(168,85,247,0.4)]" alt="" />
                              </div>
                            ) : (
                              <div className="relative shrink-0">
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 blur-md opacity-60 animate-pulse" />
                                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.6),inset_0_1px_4px_rgba(255,255,255,0.3)] ring-2 ring-white/20">
                                  <Crown className="w-6 h-6 text-white drop-shadow" />
                                </div>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-black text-sm text-white group-hover:bg-gradient-to-r group-hover:from-cyan-300 group-hover:to-pink-300 group-hover:bg-clip-text group-hover:text-transparent transition-all line-clamp-1">{h.product_title}</h3>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Clock className="w-2.5 h-2.5" /> {new Date(h.claimed_at).toLocaleString("id-ID")}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 text-xs text-cyan-100/80 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-xl p-2.5 border border-cyan-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                            <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.6)]" />
                            <span className="leading-relaxed break-words font-medium">{deviceSummary}</span>
                          </div>
                          {h.fields.length > 0 && (
                            <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-purple-400/30 rounded-xl p-3 space-y-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.3),0_0_15px_rgba(168,85,247,0.15)] overflow-hidden">
                              <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />
                              <p className="relative text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
                                <Shield className="w-3 h-3 text-purple-300" /> Detail Akun Premium
                              </p>
                              {h.fields.map((f, i) => {
                                const fid = `h-${h.id}-${i}`;
                                const copied = copiedField === fid;
                                return (
                                  <div key={i} className="relative flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                                    <span className="text-xs text-slate-400 font-semibold">{f.field_name}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-mono font-black text-white max-w-[120px] truncate drop-shadow">{f.field_value}</span>
                                      <button
                                        onClick={() => copyText(f.field_value, fid)}
                                        className={`text-[10px] font-black px-2 py-0.5 rounded-md transition-all border ${copied ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.6)] scale-110' : 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 text-cyan-200 border-cyan-400/40 hover:scale-105 hover:shadow-[0_0_8px_rgba(34,211,238,0.4)]'}`}
                                      >
                                        {copied ? '✓ OK' : (<><Copy className="w-2.5 h-2.5 inline mr-0.5" />Salin</>)}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}

                {totalHistoryPages > 1 && (
                  <div
                    className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden"
                    style={{ background: "linear-gradient(135deg, hsl(280 90% 65%/0.5), hsl(190 95% 55%/0.5), hsl(280 90% 65%/0.5))", backgroundSize: "300% 300%" }}
                  >
                    <div className="rounded-[14px] bg-gradient-to-br from-slate-950/90 to-slate-900/90 backdrop-blur-xl flex items-center justify-center gap-3 p-3">
                      <Button size="icon" className="rounded-full bg-slate-800/60 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-30" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                      <span className="text-sm font-black tabular-nums bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">{historyPage} / {totalHistoryPages}</span>
                      <Button size="icon" className="rounded-full bg-slate-800/60 border border-purple-400/30 text-purple-200 hover:bg-purple-500/20 disabled:opacity-30" disabled={historyPage >= totalHistoryPages} onClick={() => setHistoryPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
              </>
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
          <div className="space-y-4 animate-fade-in">
            {ticketView === "list" && (
              <>
                {/* Hero Header - Aurora Premium */}
                <div
                  className="relative rounded-3xl p-[2px] aurora-shift overflow-hidden shadow-[0_8px_40px_-10px_rgba(251,146,60,0.5)]"
                  style={{ background: "linear-gradient(135deg, hsl(15 90% 55%), hsl(45 95% 55%), hsl(330 90% 60%), hsl(280 90% 65%), hsl(15 90% 55%))", backgroundSize: "400% 400%" }}
                >
                  <div className="relative rounded-[22px] bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-xl p-4 overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 opacity-60">
                      <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-orange-500/30 blur-3xl animate-pulse" />
                      <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-pink-500/30 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
                    </div>
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="absolute w-1 h-1 rounded-full bg-white/60" style={{ top: `${20 + (i * 17) % 60}%`, left: `${(i * 21) % 90}%`, animation: `float-up ${3 + (i % 3)}s ease-in-out ${i * 0.5}s infinite`, boxShadow: "0 0 6px rgba(255,255,255,0.8)" }} />
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0 shine-sweep opacity-40" />

                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-400 via-amber-500 to-pink-500 blur-lg opacity-80 animate-pulse" />
                          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-orange-400 via-amber-500 to-pink-500 opacity-50 animate-spin" style={{ animationDuration: "8s" }} />
                          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-pink-500 flex items-center justify-center shadow-[0_0_30px_rgba(251,146,60,0.7),inset_0_2px_8px_rgba(255,255,255,0.3)] border border-white/30">
                            <AlertCircle className="w-7 h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-orange-200 via-amber-200 to-pink-200 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(251,146,60,0.4)]">{t("ticket.title", lang)}</h2>
                            <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.7)] border border-white/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> 24/7
                            </span>
                          </div>
                          <p className="text-orange-100/80 text-[11px] mt-1 font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-yellow-300" /> {tickets.length} tiket dukungan
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setTicketView("create")} className="relative overflow-hidden gap-1.5 rounded-full text-xs font-black bg-gradient-to-r from-orange-500 via-amber-500 to-pink-500 text-white shadow-[0_4px_20px_rgba(251,146,60,0.5)] hover:scale-105 transition-transform border border-white/30">
                        <span className="absolute inset-0 shine-sweep opacity-60" />
                        <Send className="relative w-3.5 h-3.5" strokeWidth={2.2} /> <span className="relative">Buat</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Smart Mode Toggle */}
                {tickets.length > 0 && (
                  <div className="flex items-center justify-between gap-2 px-1">
                    <div className="text-[11px] text-slate-400 font-medium">
                      {smartTickets ? "🧠 Mode Pintar — timeline & filter" : "📋 Tampilan klasik"}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setSmartTickets(v => !v)}
                      className={`gap-1 rounded-full text-xs font-bold border ${smartTickets ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]" : "bg-slate-800/60 text-amber-200 border-amber-400/30 hover:bg-amber-500/20"}`}
                    >
                      <Lightbulb className="w-3 h-3" strokeWidth={2.2} /> {smartTickets ? "Pintar ✓" : "Pintar"}
                    </Button>
                  </div>
                )}

                {tickets.length === 0 && (
                  <div
                    className="relative rounded-3xl p-[2px] aurora-shift overflow-hidden"
                    style={{ background: "linear-gradient(135deg, hsl(15 90% 55%/0.5), hsl(45 95% 55%/0.5), hsl(330 90% 60%/0.5), hsl(15 90% 55%/0.5))", backgroundSize: "300% 300%" }}
                  >
                    <div className="rounded-[22px] bg-gradient-to-br from-slate-950/95 to-slate-900/95 backdrop-blur-xl text-center py-16 px-6 relative overflow-hidden">
                      <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-orange-500/20 blur-3xl" />
                      <div className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-pink-500/20 blur-3xl" />
                      <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500/30 via-amber-500/20 to-pink-500/30 flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-[0_0_40px_rgba(251,146,60,0.4)] floating">
                        <Inbox className="w-12 h-12 text-orange-200/70" />
                      </div>
                      <p className="relative text-base font-black bg-gradient-to-r from-orange-200 to-pink-200 bg-clip-text text-transparent">Belum ada tiket</p>
                      <p className="relative text-xs text-slate-400 mt-1.5">Hubungi kami jika ada kendala</p>
                      <Button size="sm" className="relative mt-4 gap-1.5 rounded-xl font-black bg-gradient-to-r from-orange-500 via-amber-500 to-pink-500 text-white shadow-[0_4px_20px_rgba(251,146,60,0.5)] hover:scale-105 transition-transform border border-white/20" onClick={() => setTicketView("create")}>
                        <Send className="w-4 h-4" /> Ajukan Keluhan
                      </Button>
                    </div>
                  </div>
                )}

                {tickets.length > 0 && smartTickets && (
                  <TicketEnhancer
                    tickets={tickets as any}
                    categoryLabels={Object.fromEntries(TICKET_CATEGORIES.map(c => [c.value, c.label]))}
                    onOpen={(t) => { setActiveTicket(t as any); setTicketView("chat"); }}
                    onReopen={(t) => {
                      setTicketCategory(t.category || "lainnya");
                      setTicketDesc(`[REOPEN dari Tiket #${t.ticket_number}]\n\n${t.description}`);
                      setTicketName((t as any).name || "");
                      setTicketPhone((t as any).phone || "");
                      setTicketView("create");
                      toast({ title: "Form siap di-reopen", description: "Edit detail lalu kirim ulang" });
                    }}
                    onDuplicate={(t) => {
                      setTicketCategory(t.category || "lainnya");
                      setTicketDesc(t.description);
                      setTicketName((t as any).name || "");
                      setTicketPhone((t as any).phone || "");
                      setTicketView("create");
                      toast({ title: "Template tiket disalin ✨" });
                    }}
                  />
                )}

                {tickets.length > 0 && !smartTickets && (
                  <>
                    {/* Stats Summary - Aurora 3D */}
                    {(() => {
                      const openCount = tickets.filter(t => t.status === "open").length;
                      const closedCount = tickets.filter(t => t.status !== "open").length;
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Total", value: tickets.length, icon: Inbox, from: "from-orange-500/30", to: "to-amber-600/20", border: "border-orange-300/40", text: "text-orange-200", glow: "rgba(251,146,60,0.5)" },
                            { label: "Terbuka", value: openCount, icon: Activity, from: "from-cyan-500/30", to: "to-blue-600/20", border: "border-cyan-300/40", text: "text-cyan-200", glow: "rgba(34,211,238,0.5)" },
                            { label: "Selesai", value: closedCount, icon: CheckCircle2, from: "from-emerald-500/30", to: "to-green-600/20", border: "border-emerald-300/40", text: "text-emerald-200", glow: "rgba(16,185,129,0.5)" },
                          ].map((s) => {
                            const Icon = s.icon;
                            return (
                              <div key={s.label} className={`relative rounded-xl p-2.5 bg-gradient-to-br ${s.from} ${s.to} border ${s.border} backdrop-blur-md overflow-hidden hover:scale-105 transition-transform duration-300 group/stat`} style={{ boxShadow: `0 4px 20px -4px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.15)` }}>
                                <div className="absolute -top-6 -right-6 w-14 h-14 rounded-full opacity-40 blur-xl group-hover/stat:opacity-70 transition" style={{ background: s.glow }} />
                                <Icon className={`w-4 h-4 ${s.text} mb-1 drop-shadow-[0_0_4px_currentColor]`} />
                                <p className={`text-xl font-black tabular-nums leading-none ${s.text} drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]`}><CountUp value={s.value} /></p>
                                <p className="text-white/70 text-[9px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {tickets.map(t => {
                      const catInfo = TICKET_CATEGORIES.find(c => c.value === (t as any).category) || TICKET_CATEGORIES[TICKET_CATEGORIES.length - 1];
                      const isOpen = t.status === "open";
                      return (
                      <div
                        key={t.id}
                        className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden cursor-pointer group transition-all duration-500 hover:-translate-y-1.5 hover:scale-[1.01]"
                        style={{ background: isOpen
                          ? "linear-gradient(135deg, hsl(15 90% 55%/0.7), hsl(45 95% 55%/0.6), hsl(330 90% 60%/0.7), hsl(15 90% 55%/0.7))"
                          : "linear-gradient(135deg, hsl(160 70% 45%/0.5), hsl(190 95% 55%/0.5), hsl(160 70% 45%/0.5))",
                          backgroundSize: "300% 300%",
                          boxShadow: isOpen ? "0 8px 28px -10px rgba(251,146,60,0.4)" : "0 8px 28px -10px rgba(16,185,129,0.3)" }}
                        onClick={() => { setActiveTicket(t); setTicketView("chat"); }}
                      >
                        <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 backdrop-blur-xl rounded-[14px] card-shine relative">
                          <div className="absolute -inset-0.5 bg-gradient-to-br from-orange-500/0 via-pink-500/0 to-purple-500/0 group-hover:from-orange-500/20 group-hover:via-pink-500/15 group-hover:to-purple-500/20 rounded-[14px] blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10" />
                          <CardContent className="p-4 relative">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`relative shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${isOpen ? "bg-gradient-to-br from-orange-500/40 to-pink-500/30 border-orange-400/40 shadow-[0_0_10px_rgba(251,146,60,0.4)]" : "bg-gradient-to-br from-emerald-500/40 to-cyan-500/30 border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.4)]"}`}>
                                  <AlertCircle className={`w-4 h-4 ${isOpen ? "text-orange-200" : "text-emerald-200"}`} />
                                </div>
                                <span className="font-black text-sm bg-gradient-to-r from-orange-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">Tiket #{t.ticket_number}</span>
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border backdrop-blur-sm ${isOpen ? "bg-gradient-to-r from-orange-500/30 to-amber-500/20 text-orange-200 border-orange-400/40 shadow-[0_0_8px_rgba(251,146,60,0.3)]" : "bg-gradient-to-r from-emerald-500/30 to-cyan-500/20 text-emerald-200 border-emerald-400/40"} flex items-center gap-1`}>
                                {isOpen ? <><span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" /> Terbuka</> : <><CheckCircle2 className="w-2.5 h-2.5" /> Ditutup</>}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-black bg-gradient-to-r from-purple-500/30 to-fuchsia-500/20 text-purple-200 border border-purple-400/40 shadow-[0_0_8px_rgba(168,85,247,0.3)]">
                                <Tag className="w-2.5 h-2.5" /> {catInfo.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed group-hover:text-white transition-colors">{t.description}</p>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {new Date(t.created_at).toLocaleString("id-ID")}
                              </p>
                              <span className="text-[10px] font-black text-cyan-300 group-hover:text-cyan-200 transition-colors flex items-center gap-0.5">
                                Buka <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {ticketView === "create" && (
              <div className="space-y-4 animate-fade-in">
                {/* Hero Header */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setTicketView("list")} className="shrink-0 -ml-2 h-9 w-9">
                      <ChevronLeft className="w-5 h-5" strokeWidth={1.7} />
                    </Button>
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Send className="w-5 h-5 text-foreground" strokeWidth={1.7} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold tracking-tight text-foreground">Buat Tiket Baru</h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Ceritakan kendala kamu, kami siap bantu</p>
                    </div>
                  </div>
                </div>

                {/* Smart Templates */}
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Template Cepat</span>
                      <span className="text-[10px] text-muted-foreground">- tap untuk isi otomatis</span>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x" style={{ scrollbarWidth: "none" }}>
                      {TICKET_TEMPLATES.map(tpl => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            setTicketCategory(tpl.category);
                            setTicketDesc(tpl.description);
                            toast({ title: `${tpl.emoji} Template "${tpl.label}" dipakai`, description: "Edit detail sesuai kasus kamu" });
                          }}
                          className="shrink-0 snap-start flex flex-col items-center gap-1 p-2 min-w-[78px] rounded-xl border border-border/60 bg-background/80 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95"
                        >
                          <span className="text-xl">{tpl.emoji}</span>
                          <span className="text-[9px] font-bold text-center leading-tight line-clamp-2">{tpl.label}</span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Form Card */}
                <Card className="glass-card-strong border-primary/10 shadow-xl overflow-hidden">
                  <CardContent className="p-4 space-y-4">
                    {/* Kategori */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1 h-3 rounded-full bg-primary" />
                        Kategori Masalah
                      </label>
                      <Select value={ticketCategory} onValueChange={setTicketCategory}>
                        <SelectTrigger className="w-full h-11 rounded-xl border-border/60 bg-background/60 backdrop-blur-sm hover:border-primary/40 transition-colors">
                          <SelectValue placeholder="Pilih kategori..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Nama */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1 h-3 rounded-full bg-primary" />
                        Nama Lengkap
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input placeholder="Contoh: Budi Santoso" value={ticketName} onChange={e => setTicketName(e.target.value)} className="h-11 pl-9 rounded-xl border-border/60 bg-background/60 backdrop-blur-sm" />
                      </div>
                    </div>

                    {/* HP */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1 h-3 rounded-full bg-primary" />
                        Nomor HP
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input placeholder="08xxxxxxxxxx" value={ticketPhone} onChange={e => setTicketPhone(e.target.value)} className="h-11 pl-9 rounded-xl border-border/60 bg-background/60 backdrop-blur-sm" />
                      </div>
                    </div>

                    {/* Deskripsi */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1 h-3 rounded-full bg-primary" />
                        Deskripsi Masalah
                      </label>
                      <Textarea placeholder="Jelaskan masalah kamu sedetail mungkin..." value={ticketDesc} onChange={e => setTicketDesc(e.target.value)} rows={4} className="rounded-xl border-border/60 bg-background/60 backdrop-blur-sm resize-none" />
                      <p className="text-[10px] text-muted-foreground text-right">{ticketDesc.length} karakter</p>
                    </div>

                    {/* Screenshot */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1 h-3 rounded-full bg-accent" />
                        Screenshot Bukti <span className="text-muted-foreground/60 normal-case font-medium">(opsional)</span>
                      </label>
                      {ticketScreenshotPreview ? (
                        <div className="relative inline-block group">
                          <div className="absolute -inset-1 bg-gradient-to-br from-primary/30 to-accent/30 rounded-xl blur opacity-60" />
                          <img src={ticketScreenshotPreview} alt="Preview" className="relative max-h-40 rounded-xl border border-border/60 shadow-lg" />
                          <button
                            type="button"
                            onClick={() => { setTicketScreenshot(null); setTicketScreenshotPreview(null); }}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-sm shadow-lg hover:scale-110 transition-transform"
                          >×</button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-border/60 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors group-hover:scale-110">
                            <ImagePlus className="w-5 h-5 text-primary" />
                          </div>
                          <span className="text-xs font-medium text-foreground">Tap untuk pilih gambar</span>
                          <span className="text-[10px] text-muted-foreground">PNG, JPG hingga 5MB</span>
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

                    {/* Submit */}
                    <Button
                      className="w-full h-12 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-white border-0"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)" }}
                      onClick={createTicket}
                    >
                      <Send className="w-4 h-4 mr-2" /> Kirim Tiket Sekarang
                    </Button>

                    <p className="text-[10px] text-center text-muted-foreground">
                      💡 Respon admin biasanya dalam 1-24 jam
                    </p>
                  </CardContent>
                </Card>
              </div>
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

                <WhatsAppChat
                  kind="ticket"
                  parentId={activeTicket.id}
                  viewerType="user"
                  viewerId={visitorId}
                  incomingLabel={STORE_NAME}
                  disabled={activeTicket.status !== "open"}
                  disabledHint={
                    <div>
                      {t("chat.ticket_closed", lang)}
                      <Button size="sm" variant="outline" className="mt-2 gap-1 mx-auto flex" onClick={() => setTicketView("create")}>
                        <Send className="w-3 h-3" /> {t("ticket.create", lang)}
                      </Button>
                    </div>
                  }
                  className="bg-muted/30 rounded-xl border border-border h-[55vh]"
                  scrollClassName="max-h-full"
                  headerSlot={
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
                  }
                />
              </>
            )}
          </div>
        )}

        {tab === "saldo" && (
          <div className="space-y-4 animate-fade-in">
            {!userBalance ? (
              <BalanceAuth
                currentUser={null}
                onLogin={(user) => {
                  localStorage.setItem("balance_visitor_id", user.visitor_id);
                  setUserBalance(user as any);
                  setProfileUsername(user.username);
                  setProfilePhone(user.phone);
                    setBalanceTransactions([]);
                    setSelectedTxIds(new Set());
                    setSelectedTransaction(null);
                    setShowTxExport(false);
                  fetchUserBalance();
                }}
                onLogout={() => {}}
              />
            ) : (
              <>
                <div className={banned ? "pointer-events-none select-none opacity-60" : ""}>
                {/* === Wallet Dashboard - clean minimal hero === */}
                <WalletDashboard
                  username={userBalance.username}
                  balance={userBalance.balance}
                  gameBalance={gameBalanceAmount}
                  transactions={balanceTransactions}
                  formatPrice={formatPrice}
                  onTopUp={() => { if (banned) return; setShowDepositModal(true); setDepositStep("method"); }}
                  onHistory={() => { if (banned) return; setTab("history"); }}
                  onShop={() => { if (banned) return; setTab("produk"); }}
                  onVoucher={() => { if (banned) return; setTab("voucher"); }}
                />


                {/* Account Actions Card - Aurora Premium */}
                <div
                  className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden"
                  style={{ background: "linear-gradient(135deg, hsl(190 95% 55%/0.6), hsl(280 90% 65%/0.6), hsl(150 80% 50%/0.6), hsl(190 95% 55%/0.6))", backgroundSize: "300% 300%" }}
                >
                  <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-4 space-y-3 overflow-hidden">
                    <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-cyan-400/15 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-purple-500/15 blur-3xl" />

                    <div className="relative flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 blur-md opacity-60" />
                          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-lg text-white text-sm font-extrabold">
                            {userBalance.username[0]?.toUpperCase()}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">👤 Akun</p>
                          <p className="text-sm font-extrabold text-foreground truncate">{userBalance.username}</p>
                          <p className="text-[10px] text-muted-foreground truncate">📱 {userBalance.phone}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="relative bg-gradient-to-r from-emerald-500 to-green-500 text-white gap-1.5 font-extrabold rounded-xl h-9 shadow-lg hover:scale-[1.03] active:scale-[0.97] transition-transform shine-sweep overflow-hidden shrink-0"
                        onClick={() => { if (banned) return; setShowDepositModal(true); setDepositStep("method"); }}
                        disabled={banned}
                      >
                        <ArrowUpCircle className="w-4 h-4" /> {t("deposit.btn", lang)}
                      </Button>
                    </div>

                    <div className="relative grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { if (banned) return; setProfileUsername(userBalance.username); setProfilePhone(userBalance.phone); setShowProfileModal(true); }}
                        disabled={banned}
                        className="group relative flex items-center justify-center gap-1.5 h-10 rounded-xl bg-gradient-to-r from-cyan-400/15 to-blue-500/15 border border-cyan-400/30 text-xs font-extrabold text-cyan-500 hover:scale-[1.02] active:scale-[0.98] transition-transform overflow-hidden disabled:opacity-50"
                      >
                        <Edit2 className="w-4 h-4" strokeWidth={2.2} /> Edit Profil
                      </button>
                      {!hasPin ? (
                        <button
                          onClick={() => { if (banned) return; setShowPinSetup(true); }}
                          disabled={banned}
                          className="group relative flex items-center justify-center gap-1.5 h-10 rounded-xl bg-gradient-to-r from-purple-500/15 to-pink-500/15 border border-purple-500/30 text-xs font-extrabold text-purple-500 hover:scale-[1.02] active:scale-[0.98] transition-transform overflow-hidden shine-sweep disabled:opacity-50"
                        >
                          <Lock className="w-4 h-4" strokeWidth={2.2} /> Buat PIN
                        </button>
                      ) : (
                        <button
                          onClick={() => { if (banned) return; setShowForgotPin(true); }}
                          disabled={banned}
                          className="group relative flex items-center justify-center gap-1.5 h-10 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 text-xs font-extrabold text-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-transform overflow-hidden disabled:opacity-50"
                        >
                          <KeyRound className="w-4 h-4" strokeWidth={2.2} /> Reset PIN
                        </button>
                      )}
                    </div>

                    {hasPin && (
                      <div className="relative flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-green-500/10 p-2.5 text-xs">
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 rounded-lg bg-emerald-500 blur-sm opacity-50 animate-pulse" />
                          <div className="relative w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg">
                            <Lock className="w-3 h-3 text-white" strokeWidth={2.4} />
                          </div>
                        </div>
                        <span className="font-extrabold text-emerald-500">PIN Aktif</span>
                        <span className="text-muted-foreground text-[11px]">• Pembelian dilindungi PIN 🔒</span>
                      </div>
                    )}
                  </div>
                </div>
                </div>

                {/* Auth: Logout, Switch Account, Login History */}
                <BalanceAuth
                  currentUser={userBalance}
                  onLogin={(user) => {
                    localStorage.setItem("balance_visitor_id", user.visitor_id);
                    setUserBalance(user as any);
                    setProfileUsername(user.username);
                    setProfilePhone(user.phone);
                    setBalanceTransactions([]);
                    setSelectedTxIds(new Set());
                    setSelectedTransaction(null);
                    setShowTxExport(false);
                    fetchUserBalance();
                  }}
                  onLogout={() => {
                    localStorage.removeItem("balance_visitor_id");
                    setUserBalance(null);
                    setBalanceTransactions([]);
                    setHasPin(false);
                    setSelectedTxIds(new Set());
                    setSelectedTransaction(null);
                    setShowTxExport(false);
                  }}
                />



                <div className={banned ? "pointer-events-none select-none opacity-60" : ""}>
                {deposits.length > 0 && (
                  <>
                    {/* Deposit History Header - Aurora Premium */}
                    <div
                      className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden"
                      style={{ background: "linear-gradient(135deg, hsl(150 80% 50%/0.6), hsl(190 95% 55%/0.6), hsl(150 80% 50%/0.6))", backgroundSize: "300% 300%" }}
                    >
                      <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-3 overflow-hidden">
                        <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-emerald-500/15 blur-3xl" />
                        <div className="relative flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 blur-md opacity-60" />
                              <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg">
                                <History className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
                              </div>
                            </div>
                            <h3 className="text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">📜 {t("deposit.history", lang)}</h3>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[9px] font-extrabold">{filteredDeposits.length}</span>
                        </div>
                        <div className="relative grid grid-cols-3 gap-2">
                          <select className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 px-2 py-2 text-[11px] font-bold text-foreground focus:border-cyan-400 focus:outline-none transition-colors" value={depositHistoryMethodFilter} onChange={e => setDepositHistoryMethodFilter(e.target.value as DepositMethodFilter)}>
                            <option value="all">Semua Metode</option>
                            <option value="qris">QRIS</option>
                            <option value="ewallet">E-Wallet</option>
                          </select>
                          <select className="rounded-xl border border-purple-500/30 bg-purple-500/5 px-2 py-2 text-[11px] font-bold text-foreground focus:border-purple-500 focus:outline-none transition-colors" value={depositHistoryStatusFilter} onChange={e => setDepositHistoryStatusFilter(e.target.value as DepositStatusFilter)}>
                            <option value="all">Semua Status</option>
                            <option value="pending">Belum Konfirmasi</option>
                            <option value="approved">Disetujui</option>
                            <option value="rejected">Ditolak</option>
                            <option value="cancelled">Dibatalkan</option>
                          </select>
                          <select className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-2 py-2 text-[11px] font-bold text-foreground focus:border-emerald-500 focus:outline-none transition-colors" value={depositHistorySort} onChange={e => setDepositHistorySort(e.target.value as "newest" | "oldest")}>
                            <option value="newest">Terbaru</option>
                            <option value="oldest">Terlama</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {!banned && filteredDeposits.map(dep => {
                      const isApproved = dep.status === "approved";
                      const isRejected = dep.status === "rejected";
                      const accent = isApproved
                        ? { color: "from-emerald-500 to-green-500", glow: "16,185,129", icon: <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2.4} /> }
                        : isRejected
                        ? { color: "from-rose-500 to-red-500", glow: "244,63,94", icon: <X className="w-5 h-5 text-white" strokeWidth={2.4} /> }
                        : { color: "from-amber-500 to-orange-500", glow: "245,158,11", icon: <Clock className="w-5 h-5 text-white" strokeWidth={2.4} /> };
                      return (
                        <button
                          key={dep.id}
                          onClick={() => setSelectedDeposit(dep)}
                          className="group relative w-full text-left rounded-2xl p-[1.5px] overflow-hidden hover:scale-[1.01] active:scale-[0.99] transition-transform"
                          style={{ background: `linear-gradient(135deg, rgba(${accent.glow},0.5), rgba(${accent.glow},0.2), rgba(${accent.glow},0.5))` }}
                        >
                          <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-3 flex items-center gap-3 overflow-hidden">
                            <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl" style={{ background: `rgba(${accent.glow},1)` }} />
                            <div className="relative shrink-0">
                              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${accent.color} blur-md opacity-50`} />
                              <div className={`relative w-10 h-10 rounded-xl bg-gradient-to-br ${accent.color} flex items-center justify-center shadow-lg`}>
                                {accent.icon}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 relative">
                              <p className={`font-extrabold text-sm bg-gradient-to-r ${accent.color} bg-clip-text text-transparent`}>{formatPrice(dep.amount)}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">🆔 {dep.trx_id}</p>
                              <p className="text-[10px] text-muted-foreground">💳 {dep.payment_method.toUpperCase()} • {new Date(dep.created_at).toLocaleString("id-ID")}</p>
                            </div>
                            <span className={`relative shrink-0 text-[10px] px-2.5 py-1 rounded-full font-extrabold bg-gradient-to-r ${accent.color} text-white shadow-lg`}>
                              {getDepositStatusLabel(dep.status, lang)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {filteredDeposits.length === 0 && (
                      <div className="text-center py-6 rounded-2xl border border-dashed border-border/60 bg-muted/20">
                        <p className="text-sm text-muted-foreground">📭 Tidak ada deposit sesuai filter.</p>
                      </div>
                    )}
                  </>
                )}

                {/* Transaction History - Aurora Premium Header */}
                <div
                  className="relative rounded-2xl p-[1.5px] aurora-shift overflow-hidden"
                  style={{ background: "linear-gradient(135deg, hsl(280 90% 65%/0.6), hsl(330 90% 60%/0.6), hsl(190 95% 55%/0.6), hsl(280 90% 65%/0.6))", backgroundSize: "300% 300%" }}
                >
                  <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-3 overflow-hidden">
                    <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-purple-500/15 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-pink-500/15 blur-3xl" />
                    <div className="relative flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-400 blur-md opacity-60" />
                          <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-400 flex items-center justify-center shadow-lg">
                            <History className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
                          </div>
                        </div>
                        <h3 className="text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 bg-clip-text text-transparent">💸 {t("balance.transaction_history", lang)}</h3>
                        {balanceTransactions.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-500 text-[9px] font-extrabold">{balanceTransactions.length}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {balanceTransactions.length > 0 && (
                          <button
                            onClick={() => setSmartSaldo(v => !v)}
                            className={`flex items-center gap-1 text-[11px] h-7 px-2.5 rounded-full font-extrabold transition-all ${smartSaldo ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg" : "bg-yellow-400/15 border border-yellow-400/30 text-yellow-500"}`}
                          >
                            <Sparkles className="w-3 h-3" /> {smartSaldo ? "Pintar ✓" : "Pintar"}
                          </button>
                        )}
                        {balanceTransactions.length > 0 && (
                          <button
                            onClick={() => setShowTxExport(!showTxExport)}
                            className={`flex items-center gap-1 text-[11px] h-7 px-2.5 rounded-full font-extrabold transition-all ${showTxExport ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg" : "bg-cyan-400/15 border border-cyan-400/30 text-cyan-500"}`}
                          >
                            <Download className="w-3 h-3" /> {showTxExport ? "Tutup" : "Ekspor"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
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
                          doc.text(`${STORE_NAME} - WA: ${WA_NUMBER}`, pageW / 2, pageH - 10, { align: "center" });
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
                {!banned && balanceTransactions.length > 0 && smartSaldo && (() => {
                  const items: HistoryItem[] = balanceTransactions.map(tx => ({
                    id: tx.id,
                    title: tx.type === "topup" ? t("balance.topup", lang) : t("balance.purchase", lang),
                    subtitle: tx.description || (tx.trx_id ? `ID: ${tx.trx_id}` : "-"),
                    amount: tx.type === "topup" ? Math.abs(tx.amount) : -Math.abs(tx.amount),
                    date: tx.created_at,
                    category: tx.type === "topup" ? "Top Up" : "Pembelian",
                    meta: { trx_id: tx.trx_id || "" },
                  }));
                  const renderTx = (it: HistoryItem) => {
                    const tx = balanceTransactions.find(t => t.id === it.id);
                    if (!tx) return null;
                    return (
                      <Card className="cursor-pointer transition-all hover:shadow-md border border-border/60" onClick={() => setSelectedTransaction(tx)}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tx.type === "topup" ? "bg-accent/10" : "bg-destructive/10"}`}>
                            {tx.type === "topup" ? <ArrowUpCircle className="w-5 h-5 text-accent" /> : <ArrowDownCircle className="w-5 h-5 text-destructive" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{tx.type === "topup" ? t("balance.topup", lang) : t("balance.purchase", lang)}</p>
                            {tx.trx_id && <p className="text-[10px] text-muted-foreground font-mono">ID: {tx.trx_id}</p>}
                            <p className="text-[10px] text-muted-foreground truncate">{tx.description || "-"}</p>
                          </div>
                          <span className={`font-bold text-sm ${tx.type === "topup" ? "text-accent" : "text-destructive"}`}>
                            {tx.type === "topup" ? "+" : "-"}{formatPrice(tx.amount)}
                          </span>
                        </CardContent>
                      </Card>
                    );
                  };
                  return (
                    <HistoryEnhancer
                      title="Riwayat Transaksi Saldo"
                      items={items}
                      categories={["Top Up", "Pembelian"]}
                      formatAmount={formatPrice}
                      exportPrefix="riwayat-saldo"
                      storeName={STORE_NAME}
                      renderItem={renderTx}
                    />
                  );
                })()}
                {!banned && !smartSaldo && balanceTransactions.map(tx => {
                  const isTopup = tx.type === "topup";
                  const accent = isTopup
                    ? { color: "from-emerald-500 to-green-500", glow: "16,185,129", icon: <ArrowUpCircle className="w-5 h-5 text-white" strokeWidth={2.4} /> }
                    : { color: "from-rose-500 to-red-500", glow: "244,63,94", icon: <ArrowDownCircle className="w-5 h-5 text-white" strokeWidth={2.4} /> };
                  return (
                    <button
                      key={tx.id}
                      onClick={() => setSelectedTransaction(tx)}
                      className="group relative w-full text-left rounded-2xl p-[1.5px] overflow-hidden hover:scale-[1.01] active:scale-[0.99] transition-transform"
                      style={{ background: `linear-gradient(135deg, rgba(${accent.glow},0.5), rgba(${accent.glow},0.15), rgba(${accent.glow},0.5))` }}
                    >
                      <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-3 flex items-center gap-3 overflow-hidden">
                        <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl" style={{ background: `rgba(${accent.glow},1)` }} />
                        {showTxExport && (
                          <div onClick={(e) => e.stopPropagation()} className="relative">
                            <Checkbox
                              checked={selectedTxIds.has(tx.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedTxIds);
                                if (checked) next.add(tx.id); else next.delete(tx.id);
                                setSelectedTxIds(next);
                              }}
                            />
                          </div>
                        )}
                        <div className="relative shrink-0">
                          <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${accent.color} blur-md opacity-50`} />
                          <div className={`relative w-10 h-10 rounded-xl bg-gradient-to-br ${accent.color} flex items-center justify-center shadow-lg`}>
                            {accent.icon}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 relative">
                          <p className="font-extrabold text-sm text-foreground">{isTopup ? t("balance.topup", lang) : t("balance.purchase", lang)}</p>
                          {tx.trx_id && <p className="text-[10px] text-muted-foreground font-mono truncate">🆔 {tx.trx_id}</p>}
                          <p className="text-[10px] text-muted-foreground truncate">📝 {tx.description || "-"}</p>
                          <p className="text-[10px] text-muted-foreground">⏱️ {new Date(tx.created_at).toLocaleString("id-ID")}</p>
                        </div>
                        <span className={`relative shrink-0 font-extrabold text-sm bg-gradient-to-r ${accent.color} bg-clip-text text-transparent tabular-nums`}>
                          {isTopup ? "+" : "-"}{formatPrice(tx.amount)}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Transaction Detail Popup */}
                {!banned && selectedTransaction && (
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
                </div>
              </>
            )}
          </div>
        )}

        {/* PlaylistTab always mounted (audio persistence). Visible on legacy /playlist OR Musik hub Playlist sub-tab. */}
        <div className={tab === "playlist" || (tab === "musik" && musicSubTab === "playlist") ? "" : "hidden"}>
          <PlaylistTab onPlaybackChange={setPlaybackState} onTogglePlay={togglePlayRef} onOpenFullPlayer={openFullPlayerRef} onPlayExternal={playExternalRef} />
        </div>

        {tab === "publik" && (
          <MusicPublicTab onPlaySong={(song) => playExternalRef.current?.(song)} />
        )}

        {tab === "sponsor" && (
          <SponsorBanner likedSponsorIds={likedSponsorIds} onToggleLikeSponsor={toggleLikeSponsor} sponsorLikeCounts={sponsorLikeCounts} />
        )}

        {tab === "streak" && (
          userBalance ? (
            <DailyStreak key={userBalance.visitor_id} visitorId={userBalance.visitor_id} />
          ) : (
            <LoginGate
              title="Daily Streak"
              description="Login saldo untuk mulai klaim streak harian dan dapatkan reward keren!"
              emoji="🔥"
              gradient="from-orange-500 to-red-600"
              onGoToLogin={() => setTab("saldo")}
            />
          )
        )}

        {tab === "streakevent" && (
          userBalance ? (
            <NeonStreakHub key={`event-${userBalance.visitor_id}`} visitorId={userBalance.visitor_id} forcedView="event" />
          ) : (
            <LoginGate
              title="Streak Event"
              description="Login saldo untuk akses Daily Gift, Spin Wheel, Mystery Box, Power Hour, Battle Arena & Quest mingguan."
              emoji="✨"
              gradient="from-pink-500 to-purple-600"
              onGoToLogin={() => setTab("saldo")}
            />
          )
        )}

        {tab === "streakshop" && (
          userBalance ? (
            <NeonStreakHub key={`shop-${activeBalanceVisitorId}`} visitorId={activeBalanceVisitorId} forcedView="shop" />
          ) : (
            <LoginGate
              title="Streak Event Shop"
              description="Login saldo untuk akses shop event dan reward streak."
              emoji="🛒"
              gradient="from-fuchsia-500 to-rose-600"
              onGoToLogin={() => setTab("saldo")}
            />
          )
        )}

        {tab === "streakmembership" && (
          userBalance ? (
            <div className="space-y-3">
              <div className="rounded-2xl p-4 bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-orange-500/20 border-2 border-amber-400/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/40">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black bg-gradient-to-r from-amber-200 via-yellow-100 to-orange-200 bg-clip-text text-transparent">
                      Membership Streak VIP
                    </h2>
                    <p className="text-[11px] text-white/70">Bayar pakai saldo · Klaim hadiah harian otomatis</p>
                  </div>
                </div>
              </div>
              <MembershipCarousel visitorId={activeBalanceVisitorId} />
            </div>
          ) : (
            <LoginGate
              title="Membership Streak VIP"
              description="Login saldo untuk berlangganan membership streak dan klaim hadiah harian."
              emoji="👑"
              gradient="from-amber-500 to-orange-600"
              onGoToLogin={() => setTab("saldo")}
            />
          )
        )}

        <div className={tab === "game" ? "" : "hidden"}>
          {userBalance ? (
            <GameTab />
          ) : (
            <LoginGate
              title="Game AI"
              description="Login saldo untuk bermain 11 game AI seru dan kumpulkan poin!"
              emoji="🎮"
              gradient="from-violet-500 to-purple-700"
              onGoToLogin={() => setTab("saldo")}
            />
          )}
        </div>

        {tab === "plus" && <PlusTab key={userBalance?.visitor_id || "no-user"} />}



        {tab === "update" && (
          <div className="space-y-4 animate-fade-in">
            {/* Hero Header */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="w-5 h-5 text-foreground" strokeWidth={1.7} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Update Web</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Fitur tambahan terbaru tanggal 19 April 2026</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              
              {[
                {
                  date: "24 April 2026", version: "v2.8", isNew: true,
                  items: [
                    "🎮 4 Game baru ditambahkan ke tab Game: Memory Flip, Snake Neon, 2048, dan Plinko - semua client-side, ramah mobile",
                    "🎮 Memory Flip - cocokkan pasangan kartu, makin cepat selesai makin besar reward poin",
                    "🐍 Snake Neon - ular grafis neon dengan swipe controls, makin panjang ular makin tinggi skor",
                    "🧩 2048 - geser ubin angka, gabungkan jadi 2048, swipe gesture full mobile-friendly",
                    "🎪 Plinko - jatuhkan bola di papan paku, hadiah random dengan visual seru",
                    "🎮 Reward poin otomatis terintegrasi via gameStore.ts (awardGamePoints)",
                    "🎮 4 ikon game 3D baru (game-memory, game-snake, game-2048, game-plinko)",
                    "🎨 Tema baru iOS Dark Vibrant - true black canvas + aksen Apple system colors (Blue/Pink/Purple/Orange/Green/Yellow/Teal/Indigo)",
                    "🎨 Design tokens iOS global di index.css: surface bertingkat L1/L2/L3, hairline divider, radius pill, blur bar",
                    "🎨 Utility class baru: ios-card-vibrant, ios-surface-1/2/3, ios-tint-*, ios-grad-bronze/silver/gold/diamond/jackpot, ios-btn-filled/tinted/gray, ios-pressable",
                    "🎨 Background gelap dengan dual radial glow (Blue di pojok atas, Pink di pojok bawah) ala Apple Music",
                    "🎨 Tipografi pakai SF Pro Display/Text dengan letter-spacing -0.011em untuk look Apple yang khas",
                    "🎰 Scratch-Off Lottery dirombak total dengan gaya iOS Vibrant - kartu pakai gradient rarity, badge tinted, modal sheet dengan backdrop-blur xl + spring animation",
                    "🎰 Tombol pill putih ala iOS pada modal scratch dengan ios-pressable (scale 0.96 saat ditekan)",
                    "🎰 Achievement grid pakai ios-tint-yellow untuk yang unlocked, grayscale untuk locked",
                    "💰 Rebalance hadiah Scratch-Off: jackpot sekarang TERASA besar tapi tetap LANGKA (~3% chance)",
                    "💰 Bronze (50 koin): hadiah +30/+60/+100, jackpot +200 koin",
                    "💰 Silver (150 koin): hadiah +100/+200/+350, jackpot +600 koin",
                    "💰 Gold (500 koin): hadiah +200/+700/+800/+1000/+1500, jackpot +2000 koin",
                    "💰 Diamond (1000 koin): hadiah +200/+600/+700/+1500/+2500, jackpot +3000, MEGA JACKPOT +5000 koin",
                    "💰 Sistem Zonk diperkenalkan (40-50% peluang) agar ekonomi koin tetap sehat & house edge positif",
                    "🔧 Perbaikan transaksi Scratch-Off: streak_coins dipotong saat beli kartu, ditambahkan setelah scratch >55%",
                    "🔧 Proteksi double-claim dengan claimedRef - mencegah saldo kredit ganda dari satu sesi gosok",
                    "🔧 setScratching state diperbaiki untuk membedakan kartu berbayar vs kartu gratis (free key terpisah)",
                    "🔧 Combo multiplier diturunkan jadi ringan (1.0 → 1.05 → 1.1 → 1.2x) agar tidak menggandakan jackpot besar",
                    "🏆 Achievement bonus disesuaikan: First Win +10, High Roller +25, Jackpot Hunter +50, Diamond Master +100 koin",
                    "📱 Modal scratch sekarang bisa ditutup dengan tap di luar setelah hadiah ter-claim (UX iOS)",
                    "🎁 Banner kartu gratis harian dengan shimmer animation + ios-grad-jackpot rainbow",
                  ]
                },
                {
                  date: "19 April 2026", version: "v2.7",
                  items: [
                    "💎 Isolasi Gem per akun balance - tiap login akun saldo gem beda (akun A 220 ≠ akun B 220)",
                    "💎 Migrasi otomatis: semua gem lama dari device dipindah ke akun balance pertama yang login",
                    "💎 Sinkronisasi gem real-time saat ganti akun balance (trigger login + remount komponen)",
                    "💎 Sumber gem terpusat di akun (account-level) bukan lagi di visitor_id/device",
                    "🛒 Mystery Box harian (gacha) di Streak Shop Extras dengan rarity Common→Legendary",
                    "🛒 Auction House - lelang barang langka per jam dengan bidding antar user",
                    "🛒 Loyalty Tier system: Bronze → Silver → Gold → Platinum → Diamond dengan reward tier-up",
                    "🛒 Referral Vault - reward bertingkat untuk undang teman aktif",
                    "🎰 Lucky Wheel Shop di MegaShopHub: jackpot, sistem pity 50 spin, free spin harian",
                    "🎰 Lucky Wheel mendukung 4 mata uang: free / coins / gems / saldo (wajib PIN)",
                    "🍀 Server Luck booster tier x2 / x6 / x8 / x10 / x20 untuk Slot Machine & Lucky Draw",
                    "🍀 Server Luck wajib unlock berurutan tier demi tier (tidak bisa lompat)",
                    "🔧 Bug fix: Gem tampil 0 padahal akun punya saldo (Mystery Box, Auction, Lucky Wheel)",
                    "🔧 Edge function streak-shop-extras, streak-lucky-wheel & gem-purchase pakai RPC akun",
                    "🔧 Database function add_account_gems & get_account_gems untuk mutasi atomik",
                    "🔧 Proteksi anti saldo gem negatif di server (validasi sebelum deduct)",
                    "🔧 Refund otomatis ke akun yang benar jika transaksi gem gagal di tengah jalan",
                    "🔧 Riwayat gem_transactions konsisten dengan akun balance aktif",
                    "🛡️ PIN 6-digit tetap wajib untuk pembelian gem & lucky wheel via saldo",
                    "📱 Komponen gem auto-remount saat ganti akun balance (key=visitor_id+balance_id)",
                  ]
                },
                {
                  date: "17 April 2026", version: "v2.6",
                  items: [
                    "✨ Hero beranda baru dengan tampilan Vibrant Spatial Commerce",
                    "✨ Badge '100% Trusted Store' ditambahkan di bagian atas beranda",
                    "✨ Tombol cepat baru: Flash Sale, Grosir, Baru Datang, dan Premium",
                    "✨ Statistik live produk, sponsor, dan support 24/7 di hero beranda",
                    "✨ CTA baru 'Mulai Belanja' dan 'Lihat Katalog' agar navigasi lebih cepat",
                  ]
                },
                {
                  date: "12 April 2026", version: "v2.5",
                  items: [
                    "✨ Tab Update Web baru - riwayat pembaruan aplikasi",
                    "✨ Bot WhatsApp diperlengkap: 40+ perintah (User & Admin)",
                    "✨ Pusat Bantuan diperluas dengan FAQ & panduan lengkap",
                    "🔧 Perbaikan bug riwayat transaksi & data stale saat ganti akun",
                    "🔧 Real-time update saldo, transaksi, dan notifikasi",
                  ]
                },
                {
                  date: "8 April 2026", version: "v2.4",
                  items: [
                    "✨ Paket bundel: Kredit + Streak + Storage dalam satu paket",
                    "✨ Flash sale untuk paket streak & kredit game",
                    "✨ Admin bisa reset saldo, kredit, streak, & storage user",
                    "✨ Admin kelola paket Pro, Bundel, dan Mantap",
                    "🔧 Fix pembelian kredit & streak yang sebelumnya gagal",
                    "🔧 Fix error handling pada edge functions",
                  ]
                },
                {
                  date: "4 April 2026", version: "v2.3",
                  items: [
                    "✨ Sponsor: Syarat & Ketentuan lengkap sebelum pembelian",
                    "✨ Tombol Rekber WA otomatis kirim detail produk",
                    "✨ Pusat Bantuan: panduan Sponsor & sistem Rekber",
                    "✨ FAQ diperluas hingga 20+ pertanyaan",
                    "🔧 Fix navigasi dan banner discovery untuk pengguna baru",
                  ]
                },
                {
                  date: "1 April 2026", version: "v2.2",
                  items: [
                    "✨ Sistem sponsor pihak ketiga dengan ID numerik",
                    "✨ Wholesale pricing (harga grosir) untuk produk & sponsor",
                    "✨ Ekspor riwayat transaksi PDF / Word / TXT",
                    "🔧 Perbaikan tampilan kartu produk dan sponsor",
                  ]
                },
                {
                  date: "1 April 2026", version: "v2.1",
                  items: [
                    "✨ Sistem musik publik dengan moderasi AI + admin",
                    "✨ Lirik otomatis menggunakan AI transkripsi",
                    "✨ Direktori artis dengan profil lengkap",
                    "✨ Like song & follow artist",
                    "🔧 Fix sinkronisasi pemutar musik antar tab",
                  ]
                },
                {
                  date: "1 April 2026", version: "v2.0", isLaunch: true,
                  items: [
                    "🚀 Peluncuran resmi Agung Adi Store v2.0",
                    "🚀 Sistem saldo, PIN 6-digit, & deposit QRIS/Dana",
                    "🚀 Game AI dengan 11 jenis permainan & sistem kredit",
                    "🚀 Daily streak harian dengan reset 00:00 WIB",
                    "🚀 Bot WhatsApp interaktif untuk deposit & dukungan",
                    "🚀 Multi-bahasa otomatis (195 negara) via Gemini AI",
                  ]
                },
              ].map((entry, i) => (
                <div key={i} className="relative pl-12 pb-4">
                  {/* Timeline dot */}
                  <div className={`absolute left-3 top-1.5 w-3 h-3 rounded-full border-2 border-background ${entry.isNew ? 'bg-foreground' : 'bg-muted-foreground/40'}`} />
                  
                  <div className={`rounded-xl border bg-card overflow-hidden ${entry.isNew ? 'border-foreground/30' : 'border-border'}`}>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold tracking-wide text-foreground">
                          {entry.date}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${entry.isNew ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>{entry.version}</span>
                      </div>
                      <ul className="text-[12px] space-y-1.5 text-muted-foreground">
                        {entry.items.map((item, j) => (
                          <li key={j} className="leading-relaxed">{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Copyright */}
            <div className="rounded-xl border border-border bg-card p-4 text-center space-y-2">
              <p className="text-xs font-semibold text-foreground">© 2026 {STORE_NAME}</p>
              <p className="text-[11px] text-muted-foreground">Murah & Terpercaya - Semua hak dilindungi.</p>
              <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                {socialLinks.map(s => (
                  <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium px-3 py-1.5 rounded-full bg-muted text-foreground hover:bg-muted/70 transition-colors border border-border flex items-center gap-1">
                    {s.icon_url && <img src={s.icon_url} alt={s.platform} className="w-3 h-3 object-contain" />}
                    {s.platform}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "adminpost" && (
          <div className="space-y-4 animate-fade-in">
            {/* Hero Header */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-foreground" strokeWidth={1.7} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Postingan Admin</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{adminPosts.length} pengumuman resmi</p>
                </div>
              </div>
            </div>
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
      {playbackState.song && tab !== "playlist" && (() => {
        const mpProgress = playbackState.duration > 0
          ? Math.min(100, (playbackState.currentTime / playbackState.duration) * 100)
          : 0;
        const mpPlaying = playbackState.isPlaying;
        const fmtTime = (s: number) => {
          if (!Number.isFinite(s) || s < 0) s = 0;
          const m = Math.floor(s / 60);
          const ss = Math.floor(s % 60).toString().padStart(2, "0");
          return `${m}:${ss}`;
        };
        const titleLong = (playbackState.song.title || "").length > 22;
        return (
          <div
            className="fixed bottom-[56px] left-0 right-0 z-50 cursor-pointer animate-fade-in"
            onClick={() => openFullPlayerRef.current?.()}
          >
            <div className="max-w-lg mx-auto px-2 pb-1">
              <div className="relative rounded-2xl p-[1.5px] shadow-[0_18px_50px_-10px_rgba(217,70,239,0.85)]"
                style={{
                  background: "linear-gradient(120deg, #ec4899, #a855f7, #6366f1, #06b6d4, #ec4899)",
                  backgroundSize: "300% 300%",
                  animation: "aurora-shift 8s ease infinite",
                }}
              >
                <div className="relative overflow-hidden rounded-[14px] bg-gradient-to-r from-[#1a0b2e]/95 via-[#2a0f47]/95 to-[#0f0a3d]/95 backdrop-blur-xl">
                  {/* Aurora glow blobs */}
                  <div className="pointer-events-none absolute -top-8 -left-6 w-32 h-32 rounded-full bg-fuchsia-500/30 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-10 right-0 w-36 h-36 rounded-full bg-indigo-500/30 blur-3xl" />
                  <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-cyan-400/15 blur-2xl" />

                  {/* Shine sweep */}
                  <div
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12 pointer-events-none"
                    style={{ animation: "shine-sweep 4s linear infinite" }}
                  />

                  {/* Top progress bar (glowing playhead) */}
                  <div className="absolute top-0 inset-x-0 h-[3px] bg-white/10">
                    <div
                      className="relative h-full bg-gradient-to-r from-pink-400 via-fuchsia-400 to-cyan-300 shadow-[0_0_10px_rgba(236,72,153,0.9)] transition-all duration-300"
                      style={{ width: `${mpProgress}%` }}
                    >
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)]" />
                    </div>
                  </div>

                  <div className="relative flex items-center gap-3 px-3 pt-3 pb-2.5">
                    {/* Vinyl-style cover with orbit dot */}
                    <div className="relative shrink-0 w-14 h-14">
                      {mpPlaying && (
                        <span className="pointer-events-none absolute inset-0 rounded-full border border-pink-400/60"
                          style={{ animation: "pulse-ring 1.8s ease-out infinite" }} />
                      )}
                      <div
                        className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/40 bg-black shadow-[0_0_18px_rgba(217,70,239,0.7)] relative"
                        style={mpPlaying ? { animation: "spin 6s linear infinite" } : undefined}
                      >
                        {playbackState.song.cover_url ? (
                          <img src={playbackState.song.cover_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
                            <Music className="w-5 h-5 text-white" />
                          </div>
                        )}
                        {/* Vinyl rings */}
                        <div className="absolute inset-1 rounded-full border border-white/10" />
                        <div className="absolute inset-3 rounded-full border border-white/10" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-3 h-3 rounded-full bg-black border border-white/50 shadow-inner" />
                        </div>
                      </div>
                      {mpPlaying && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1a0b2e] shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
                      )}
                    </div>

                    {/* Title + status + waveform */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-pink-500/40 to-fuchsia-500/40 border border-pink-300/60 text-[9px] font-black text-pink-50 uppercase tracking-wider shadow-[0_0_8px_rgba(236,72,153,0.5)]">
                          {mpPlaying ? "♪ Live" : "Paused"}
                        </span>
                        {mpPlaying && (
                          <div className="flex items-end gap-[2px] h-3">
                            {[0.5, 0.9, 0.4, 0.8, 0.6].map((h, i) => (
                              <span
                                key={i}
                                className="w-[2px] bg-gradient-to-t from-cyan-300 via-fuchsia-300 to-pink-200 rounded-full"
                                style={{
                                  height: "100%",
                                  transformOrigin: "bottom",
                                  animation: `wave-bounce ${0.55 + i * 0.08}s ease-in-out ${i * 0.06}s infinite`,
                                }}
                              />
                            ))}
                          </div>
                        )}
                        <span className="ml-auto text-[10px] font-mono tabular-nums text-white/80 bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                          {fmtTime(playbackState.currentTime)} <span className="text-white/40">/</span> {fmtTime(playbackState.duration)}
                        </span>
                      </div>

                      {/* Title with marquee if long */}
                      <div className="overflow-hidden">
                        {titleLong && mpPlaying ? (
                          <div className="whitespace-nowrap" style={{ animation: "marquee-x 12s linear infinite" }}>
                            <span className="text-sm font-bold text-white inline-block pr-8">{playbackState.song.title}</span>
                            <span className="text-sm font-bold text-white inline-block pr-8">{playbackState.song.title}</span>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-white truncate leading-tight drop-shadow-[0_1px_4px_rgba(236,72,153,0.5)]">{playbackState.song.title}</p>
                        )}
                      </div>
                      <p className="text-[11px] text-fuchsia-200/80 truncate">{playbackState.song.artist}</p>
                    </div>

                    {/* Play/Pause */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePlayRef.current?.(); }}
                        className="relative w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 via-fuchsia-500 to-purple-600 text-white flex items-center justify-center shadow-[0_8px_24px_-4px_rgba(236,72,153,0.8)] active:scale-95 transition-transform"
                      >
                        {mpPlaying && (
                          <span className="absolute inset-0 rounded-full border-2 border-pink-300/70"
                            style={{ animation: "pulse-ring 1.6s ease-out infinite" }} />
                        )}
                        {mpPlaying ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                        )}
                      </button>
                      <span className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/80"><polyline points="18 15 12 9 6 15" /></svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Product Detail Modal */}
      {selectedProduct && (() => {
        const imgs = getProductImages(selectedProduct.id);
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => openProduct(null)}>
            <div className="bg-card w-full max-w-lg rounded-t-3xl border-t border-border max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
              {imgs.length > 0 && <ImageCarousel images={imgs} className="w-full h-56" />}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold">{selectedProduct.title}</h2>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {selectedProduct.category && <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">{selectedProduct.category}</span>}
                      {selectedProduct.has_warranty && <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground"><Shield className="mr-0.5 inline w-3 h-3" />Garansi</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleLike(selectedProduct.id)}>
                      <Heart className={`w-6 h-6 ${likedIds.has(selectedProduct.id) ? "fill-foreground text-foreground" : "text-muted-foreground"}`} />
                    </button>
                    <button onClick={() => openProduct(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-foreground">{formatPrice(selectedProduct.price)}</p>
                {/* Wholesale prices */}
                {(() => {
                  const tiers = getProductWholesaleTiers(selectedProduct.id);
                  if (tiers.length === 0) return null;
                  return (
                    <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">Harga Grosir</p>
                      {tiers.map((t: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Beli ≥{t.min_quantity} pcs</span>
                          <span className="font-bold text-foreground">{formatPrice(t.price_per_item)} /pcs</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {selectedProduct.description && <p className="text-sm text-muted-foreground leading-relaxed">{selectedProduct.description}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
                    {selectedProduct.stock > 0 ? `Stok: ${selectedProduct.stock}` : 'Stok habis'}
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-muted text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> {new Date(selectedProduct.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>

                {/* Four buttons: Cart + Chat + Beli Saldo + WhatsApp */}
                <div className="grid grid-cols-4 gap-2">
                  <Button variant="outline" className="h-11 rounded-xl border-border bg-card text-xs font-medium text-foreground shadow-none"
                    disabled={selectedProduct.stock <= 0}
                    onClick={() => { addToCart(selectedProduct); }}>
                    <ShoppingCart className="w-4 h-4" /> Keranjang
                  </Button>
                  <Button variant="outline" className="h-11 rounded-xl border-border bg-card text-xs font-medium text-foreground shadow-none"
                    onClick={() => openProductChat(selectedProduct)}>
                    <MessageCircle className="w-4 h-4" /> Chat
                  </Button>
                  <Button className="h-11 rounded-xl bg-foreground text-background text-xs font-medium shadow-none hover:bg-foreground/90"
                    disabled={!userBalance || userBalance.balance < selectedProduct.price || selectedProduct.stock <= 0}
                    onClick={() => { setBuyProduct(selectedProduct); setBuyQuantity(1); setShowBuySaldo(true); }}>
                    <Wallet className="w-4 h-4" /> Saldo
                  </Button>
                  <Button variant="outline" className="h-11 rounded-xl border-border bg-card text-xs font-medium text-foreground shadow-none"
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
            <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">Beli via WhatsApp</h3>
              <button onClick={() => setShowWaForm(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm font-bold">{selectedProduct.title}</p>
              <p className="font-extrabold text-foreground">{formatPrice(selectedProduct.price)}</p>
            </div>
            <div className="space-y-3">
              <Input placeholder="Username / Nama" value={waUsername} onChange={e => setWaUsername(e.target.value)} />
              <Input placeholder="No HP" value={waPhone} onChange={e => setWaPhone(e.target.value)} />
              <Textarea placeholder="Keterangan tambahan (opsional)" value={waDesc} onChange={e => setWaDesc(e.target.value)} rows={2} />
              <Button className="w-full gap-2 bg-foreground font-medium text-background shadow-none hover:bg-foreground/90" onClick={sendWhatsApp}>
                <MessageCircle className="w-4 h-4" /> Kirim ke WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Product Chat Modal */}
      {showProductChat && productChatProduct && productChat && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowProductChat(false)}>
          <div className="bg-card w-full max-w-lg rounded-t-3xl border-t border-border max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-border p-4">
              <button onClick={() => setShowProductChat(false)}><ChevronLeft className="w-5 h-5" /></button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground">
                A
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{STORE_NAME}</p>
                <p className="text-[10px] text-muted-foreground">{t("chat.reply_time", lang)}</p>
              </div>
              <button onClick={() => { setShowChatHistory(true); setShowProductChat(false); }}>
                <History className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Chat (WhatsApp-style) */}
            <WhatsAppChat
              kind="product"
              parentId={productChat.id}
              viewerType="user"
              viewerId={visitorId}
              incomingLabel={STORE_NAME}
              className="flex-1 min-h-[300px] max-h-[60vh]"
              scrollClassName="max-h-full"
            />
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
                <p className="text-[11px] text-muted-foreground">Web v2.0 - April 2026 - {STORE_NAME}</p>
              </div>
              <button onClick={() => setShowHelp(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto px-5 pb-5 space-y-4 text-sm text-muted-foreground">

              {/* Tentang Aplikasi */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📱 Tentang Aplikasi</p>
                <div className="space-y-1 text-[13px]">
                  <p><strong>{STORE_NAME}</strong> adalah platform digital terpercaya untuk pembelian akun premium, voucher, dan produk digital lainnya.</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Didirikan untuk memberikan kemudahan transaksi digital</li>
                    <li>Mendukung <strong>{LANGUAGES.length}+ bahasa</strong> dari seluruh dunia</li>
                    <li>Tersedia sebagai PWA (Progressive Web App) - bisa diinstal di HP</li>
                    <li>Mode gelap, terang, dan emas untuk kenyamanan visual</li>
                    <li>Tersedia offline untuk akses kapan saja</li>
                  </ul>
                </div>
              </div>

              {/* Cara Order */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎵 Fitur Musik</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Dengarkan musik gratis dari koleksi admin</li>
                  <li>Buat <strong>playlist pribadi</strong> sesuai selera</li>
                  <li>Fitur <strong>lirik sinkron</strong> - lirik berjalan sesuai lagu</li>
                  <li>Simpan musik untuk didengar <strong>offline</strong></li>
                  <li>Upgrade penyimpanan dengan <strong>voucher musik</strong></li>
                </ul>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">📦 Penyimpanan Musik:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Default: <strong>100 MB</strong> gratis</li>
                    <li>Tambah kapasitas dengan <strong>voucher kapasitas</strong></li>
                    <li>Kuota bersifat <strong>akumulatif</strong> - terus bertambah</li>
                  </ul>
                </div>
              </div>

              {/* Fitur Like */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">❤️ Fitur Suka / Like</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Tekan ikon hati di produk untuk menyimpannya</li>
                  <li>Lihat semua produk favorit di tab <strong>Suka</strong></li>
                  <li>Akses cepat ke produk yang sering dibeli</li>
                </ul>
              </div>

              {/* Tiket & Chat */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
                    <li><strong>Akun/Login</strong> - masalah login, visitor ID hilang</li>
                    <li><strong>Voucher</strong> - kode tidak bisa diklaim, voucher expired</li>
                    <li><strong>Saldo/Deposit</strong> - deposit belum masuk, saldo berkurang</li>
                    <li><strong>Sponsor</strong> - produk sponsor bermasalah</li>
                    <li><strong>Lapor Penipu</strong> - laporkan penjual/pembeli yang menipu</li>
                    <li><strong>Lagu/Musik</strong> - lagu error, tidak bisa diputar</li>
                    <li><strong>Refund</strong> - permintaan pengembalian dana</li>
                    <li><strong>Garansi</strong> - klaim garansi produk</li>
                    <li><strong>PIN/Keamanan</strong> - lupa PIN, akun dicurigai dibobol</li>
                    <li><strong>Bug/Error</strong> - error tampilan atau fitur tidak berfungsi</li>
                    <li><strong>Saran</strong> - ide atau masukan untuk pengembangan</li>
                  </ul>
                </div>
              </div>

              {/* Cara Buat Tiket */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
                  <li>Tunggu balasan admin - biasanya <strong>5-30 menit</strong></li>
                </ol>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">💡 Tips Membuat Tiket Efektif:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Pilih kategori yang <strong>tepat</strong> agar admin langsung paham</li>
                    <li>Sertakan <strong>detail spesifik</strong>: waktu kejadian, nama produk, nominal</li>
                    <li>Lampirkan screenshot yang <strong>jelas dan lengkap</strong></li>
                    <li>Jangan buat tiket duplikat - cukup satu tiket per masalah</li>
                    <li>Respon balasan admin agar proses lebih cepat</li>
                  </ul>
                </div>
              </div>

              {/* Keranjang Belanja */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎨 Tema & Tampilan</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>☀️ <strong>Mode Terang</strong> - tampilan bersih dan cerah</li>
                  <li>🌙 <strong>Mode Gelap</strong> - nyaman di malam hari</li>
                  <li>👑 <strong>Mode Emas</strong> - tampilan premium eksklusif</li>
                  <li>📱 <strong>Mode Perangkat</strong> - mengikuti pengaturan HP</li>
                </ul>
              </div>

              {/* Keamanan */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🛡️ Keamanan Akun</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Identifikasi unik menggunakan <strong>Visitor ID</strong></li>
                  <li>Transaksi dilindungi dengan <strong>PIN 6 digit</strong></li>
                  <li>Reset PIN tersedia melalui admin</li>
                  <li>Tidak perlu email atau password - lebih simpel</li>
                  <li>Data terenkripsi di server</li>
                </ul>
              </div>

              {/* Sponsor / Iklan Produk */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🏪 Sponsor / Iklan Produk</p>
                <div className="space-y-1 text-[13px]">
                  <p><strong>Sponsor</strong> adalah fitur iklan produk dari penjual pihak ketiga yang ditampilkan di platform. Admin hanya menyediakan tempat iklan.</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>Apa itu sponsor?</strong> Penjual membayar admin untuk mengiklankan produk mereka di platform selama durasi tertentu.</li>
                    <li><strong>Cara membeli dengan aman:</strong> Selalu gunakan layanan <strong>Rekber (Rekening Bersama)</strong> via Admin WA untuk menghindari penipuan.</li>
                    <li><strong>Cara menggunakan rekber:</strong> Klik tombol "Mohon Rekber Admin (WA)" pada halaman sponsor, pesan otomatis akan terkirim ke admin.</li>
                    <li><strong>Cara melaporkan penjual bermasalah:</strong> Buat tiket di tab Tiket atau hubungi admin WA 085769302532 dengan bukti screenshot.</li>
                    <li><strong>Produk admin vs produk sponsor:</strong> Produk admin dijual langsung dan dijamin. Produk sponsor dijual oleh pihak ketiga - admin tidak bertanggung jawab atas kualitas produk sponsor.</li>
                  </ul>
                </div>
              </div>

              {/* Cara Rekber */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🔄 Cara Rekber (Rekening Bersama)</p>
                <div className="space-y-1 text-[13px]">
                  <p><strong>Rekber</strong> adalah layanan perantara transaksi melalui admin untuk memastikan keamanan pembeli dan penjual.</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li><strong>Pembeli</strong> klik tombol "Mohon Rekber Admin (WA)" di halaman sponsor - detail produk otomatis terkirim.</li>
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎮 Game AI</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li><strong>8 game seru</strong> melawan AI: Suit, Tebak Kata, Tebak Gambar, Teka-Teki, Tebak Angka, Tebak Barang, Ular Tangga, Ludo King</li>
                  <li>Setiap game <strong>gratis dimainkan</strong> tanpa batasan harian</li>
                  <li>Sistem <strong>kredit game</strong> - beli kredit atau paket <strong>Premium unlimited</strong></li>
                  <li>Premium memberikan akses <strong>tanpa batas</strong> hingga tanggal kedaluwarsa</li>
                  <li>Game tebakan punya <strong>3 nyawa</strong> (maksimal 3 kesalahan per ronde)</li>
                  <li>Game papan (Ular Tangga & Ludo) punya <strong>animasi bidak</strong> dan giliran AI otomatis</li>
                  <li>Kredit bisa dibeli dengan <strong>saldo akun</strong> atau voucher diskon game</li>
                  <li>Tingkat kesulitan bervariasi: Mudah, Sedang, Sulit, Pro, Sangat Pro</li>
                </ul>
              </div>

              {/* FAQ */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
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
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📝 Changelog v2.8</p>
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-foreground text-xs">24 April 2026 - Update Terbaru</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>🎮 <strong>4 Game baru:</strong> Memory Flip, Snake Neon, 2048, Plinko - semua mobile-friendly</li>
                    <li>🎨 Tema iOS Dark Vibrant - true black + aksen Apple system colors</li>
                    <li>🎰 Scratch-Off Lottery dirombak total (Bronze/Silver/Gold/Diamond)</li>
                    <li>💰 Rebalance hadiah: jackpot terasa BESAR tapi LANGKA (~3% chance)</li>
                    <li>🏆 Achievement bonus baru: First Win, High Roller, Jackpot Hunter, Diamond Master</li>
                    <li>🔧 Proteksi double-claim & combo multiplier ringan (1.0 → 1.2x)</li>
                  </ul>
                  <p className="font-semibold text-foreground text-xs pt-2">Fitur Lengkap App</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>🎮 <strong>15+ Game:</strong> Tebak Kata, Tebak Lagu, Suit, Ular Tangga, Ludo, Match-3, Slot Machine, Lucky Draw, Plinko, 2048, Memory Flip, Snake Neon, Mine Sweeper, Scratch Card, dll</li>
                    <li>🔥 <strong>Streak System:</strong> Daily Streak, Boosters, Power Hour, Mission Chain, Tournament, PvP Battle, Clan System, Season Pass</li>
                    <li>🛒 <strong>Streak Shop:</strong> Mystery Box, Auction House, Lucky Wheel, Flash Deals, Loyalty Tier (Bronze→Diamond), VIP Lounge</li>
                    <li>💎 <strong>Gem & Saldo:</strong> Gem Shop, Diamond Royale, Luck Royale Nyawa, deposit QRIS/E-Wallet, PIN 6-digit</li>
                    <li>🎵 <strong>Musik:</strong> Streaming, playlist, lirik sinkron AI, voucher musik, upload publik/pribadi, artist directory</li>
                    <li>🛍️ <strong>Belanja:</strong> Keranjang multi-produk, harga grosir, Flash Sale, voucher diskon, chat produk real-time</li>
                    <li>🎁 <strong>Sponsor:</strong> Iklan pihak ketiga dengan Rekber Admin (Escrow) via WhatsApp</li>
                    <li>🌍 <strong>Multi-bahasa:</strong> {LANGUAGES.length}+ bahasa dengan auto-translate runtime</li>
                    <li>📱 <strong>PWA + APK:</strong> Install di Chrome, build native via Capacitor, dukungan offline</li>
                    <li>🤖 <strong>WhatsApp Bot:</strong> 40+ perintah (User & Admin), deposit interaktif, support tiket</li>
                    <li>🔔 <strong>Real-time:</strong> Saldo, transaksi, notifikasi, chat - semua sinkron tanpa refresh</li>
                    <li>🛡️ <strong>Keamanan:</strong> Hash SHA-256, PIN 6-digit, isolasi sesi per akun, device tracking</li>
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
              <Wallet className="w-5 h-5" /> Beli {buyQuantity}x - {formatPrice(totalPrice)}
            </Button>
          </div>
        </div>
        );
      })()}

      {/* Quick View Modal - preview cepat tanpa buka detail */}
      {quickViewProduct && (() => {
        const p = quickViewProduct;
        const imgs = getProductImages(p.id);
        const badges = getProductBadges(p);
        return (
          <div className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setQuickViewProduct(null)}>
            <div className="bg-card w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="relative">
                {imgs.length > 0 ? (
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Package className="w-20 h-20 text-primary/40" />
                  </div>
                )}
                <button
                  onClick={() => setQuickViewProduct(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/90 backdrop-blur-md flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
                {badges.length > 0 && (
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    {badges.map((b, i) => (
                      <span key={i} className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-lg ${b.className}`}>{b.label}</span>
                    ))}
                  </div>
                )}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {p.category && <span className="text-[10px] font-bold bg-background/80 backdrop-blur-md px-2 py-0.5 rounded-full inline-block mb-1">{p.category}</span>}
                    <h3 className="text-white font-extrabold text-lg drop-shadow-lg line-clamp-2">{p.title}</h3>
                  </div>
                  <span className="text-sm font-extrabold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-1.5 rounded-full shadow-xl shrink-0">{formatPrice(p.price)}</span>
                </div>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                {p.description && <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>}

                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 ${p.stock > 0 ? 'bg-gradient-to-r from-accent/15 to-accent/5 text-accent border border-accent/20' : 'bg-gradient-to-r from-destructive/15 to-destructive/5 text-destructive border border-destructive/20'}`}>
                    {p.stock > 0 ? `✓ Stok ${p.stock}` : '✗ Habis'}
                  </span>
                  {p.has_warranty && (
                    <span className="text-xs px-3 py-1.5 rounded-full font-bold bg-gradient-to-r from-primary/15 to-primary/5 text-primary border border-primary/20 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Garansi
                    </span>
                  )}
                  {(productLikeCounts[p.id] || 0) > 0 && (
                    <span className="text-xs px-3 py-1.5 rounded-full font-bold bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-current" /> {productLikeCounts[p.id]} suka
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={(e) => { toggleLike(p.id, e); }}
                    className="flex-1 h-11 rounded-xl border-2 font-bold gap-2"
                  >
                    <Heart className={`w-4 h-4 ${likedIds.has(p.id) ? "fill-destructive text-destructive" : ""}`} />
                    {likedIds.has(p.id) ? "Disukai" : "Suka"}
                  </Button>
                  <Button
                    onClick={() => { setQuickViewProduct(null); openProduct(p); }}
                    className="flex-[2] h-11 rounded-xl bg-gradient-to-r from-primary to-accent shadow-xl font-extrabold gap-2 hover:scale-[1.02] transition-transform"
                  >
                    <ShoppingBag className="w-4 h-4" /> Lihat Detail
                  </Button>
                </div>
              </div>
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

      {!banned && selectedDeposit && (
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

      {showProfileModal && userBalance && !banned && (
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
      {showDepositModal && userBalance && !banned && (
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

                {/* Visual bonus badge (display only - no actual bonus applied) */}
                {(() => {
                  const amt = parseInt(depositAmount) || 0;
                  if (amt < 50000) return null;
                  const pct = amt >= 200000 ? 10 : amt >= 100000 ? 7 : 5;
                  return (
                    <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-r from-yellow-400/15 via-orange-400/10 to-pink-400/15 p-2.5 flex items-center gap-2 animate-pulse">
                      <span className="text-base">⚡</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 tracking-wider uppercase">Cyber Bonus Badge</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Nominal besar terdeteksi · tampilan visual +{pct}%</p>
                      </div>
                      <span className="text-[11px] font-black bg-yellow-400 text-yellow-950 rounded-full px-2 py-0.5 shadow">+{pct}%</span>
                    </div>
                  );
                })()}

                <Button className="w-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground font-bold gap-2"
                  onClick={submitDeposit} disabled={!depositAmount}>
                  <MessageCircle className="w-4 h-4" /> Buat Deposit & Kirim WA
                </Button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* === Minimal Bottom Nav (IG/TikTok style) === */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto">
          <div className="flex overflow-x-auto scrollbar-hide">
            {([
              { key: "beranda" as Tab, icon: Home, label: "Beranda" },
              { key: "musik" as Tab, icon: Music2, label: "Musik" },
              { key: "produk" as Tab, icon: Package, label: t("nav.products", lang) },
              { key: "voucher" as Tab, icon: Ticket, label: t("nav.voucher", lang) },
              { key: "saldo" as Tab, icon: Wallet, label: t("nav.balance", lang) },
              { key: "likes" as Tab, icon: Heart, label: t("nav.likes", lang) },
              { key: "history" as Tab, icon: Clock, label: t("nav.history", lang) },
              { key: "tiket" as Tab, icon: AlertCircle, label: t("nav.ticket", lang) },
              { key: "sponsor" as Tab, icon: Megaphone, label: "Sponsor" },
              { key: "streak" as Tab, icon: CalendarDays, label: "Streak" },
              { key: "streakevent" as Tab, icon: CalendarDays, label: "Event" },
              { key: "streakshop" as Tab, icon: CalendarDays, label: "Shop" },
              { key: "streakmembership" as Tab, icon: Crown, label: "M.Streak" },
              { key: "luckroyale" as any, icon: Crown, label: "L.Royale", external: "/luck-royale-nyawa" },
              { key: "game" as Tab, icon: Gamepad2, label: "Game" },
              { key: "plus" as Tab, icon: Gem, label: "Plus" },
              { key: "update" as Tab, icon: RefreshCw, label: "Update" },
              { key: "adminpost" as Tab, icon: FileText, label: "Admin" },
            ] as Array<{ key: any; icon: any; label: string; external?: string }>).map(({ key, icon: Icon, label, external }) => {
              const active = !external && tab === key;
              return (
                <button
                  key={key}
                  onClick={() => external ? navigate(external) : setTab(key)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className="shrink-0 flex flex-col items-center justify-center gap-0.5 min-w-[60px] px-2 py-2 outline-none focus-visible:bg-muted/50 active:bg-muted/40 transition-colors"
                >
                  <Icon
                    className={`w-[22px] h-[22px] transition-colors ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                    strokeWidth={active ? 2.2 : 1.7}
                    fill={active && (Icon === Heart) ? "currentColor" : "none"}
                  />
                  <span
                    className={`text-[10px] leading-none transition-colors ${
                      active ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
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
                      <Wallet className="w-4 h-4" /> Beli {item.quantity}x {item.product.title} - {formatPrice(itemTotal)}
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
      <button onClick={() => setShowHelp(true)} aria-label="Bantuan" className="fixed bottom-20 right-4 z-50 w-10 h-10 rounded-full bg-card border border-border text-foreground shadow-sm flex items-center justify-center hover:bg-muted transition-colors">
        <HelpCircle className="w-5 h-5" strokeWidth={1.7} />
      </button>

      {/* PIN Setup Modal */}
      {!banned && showPinSetup && (
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
      {!banned && showForgotPin && (
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
