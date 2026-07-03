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
  Eye, LayoutGrid, Rows3, Flame, SlidersHorizontal, Zap, TrendingUp, Award, Activity, Inbox, User, Phone, Gift, Menu, Lightbulb, MessageSquare, MessageSquareWarning, Star, Share2, VenetianMask, HeartCrack, Disc3
} from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import StoreAITab from "@/components/StoreAITab";
import ConfessTab from "@/components/ConfessTab";
import PremiumBadge from "@/components/PremiumBadge";
import { useStorePremium } from "@/hooks/useStorePremium";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CountUp from "@/components/CountUp";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import storeQris from "@/assets/store-qris.jpg";

// PDF asset cache
const _pdfImgCache: Record<string, string> = {};
async function loadPdfImage(url: string): Promise<string | null> {
  if (_pdfImgCache[url]) return _pdfImgCache[url];
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    _pdfImgCache[url] = data;
    return data;
  } catch { return null; }
}
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
import MusicMegaHub from "@/components/MusicMegaHub";
import { useMusicListenTracker } from "@/hooks/useMusicListenTracker";
import LanguageSelector from "@/components/LanguageSelector";
import { LANGUAGES } from "@/lib/languages";
import InstallPrompt from "@/components/InstallPrompt";
import MusicPublicTab from "@/components/MusicPublicTab";
import SponsorBanner from "@/components/SponsorBanner";
import ProductNavToolbar from "@/components/ProductNavToolbar";
import ProductShowcaseBar from "@/components/ProductShowcaseBar";
import ShopPowerHub from "@/components/ShopPowerHub";
import LikesTab from "@/components/LikesTab";
import DailyStreak from "@/components/DailyStreak";
import NeonStreakHub from "@/components/streak/NeonStreakHub";
import WeeklySpinEventBanner from "@/components/streak/WeeklySpinEventBanner";
import MembershipShop from "@/components/streak/MembershipShop";
import PowerPackShop from "@/components/streak/PowerPackShop";
import MembershipExtrasShop from "@/components/streak/MembershipExtrasShop";
import MembershipCarousel from "@/components/streak/MembershipCarousel";
import { Tabs as MembershipTabs, TabsList as MembershipTabsList, TabsTrigger as MembershipTabsTrigger, TabsContent as MembershipTabsContent } from "@/components/ui/tabs";
import HomeBannerSlider from "@/components/HomeBannerSlider";
import PlayfulHero3D from "@/components/PlayfulHero3D";

import BalanceAuth from "@/components/BalanceAuth";
import GameTab from "@/components/GameTab";
import PlusTab from "@/components/PlusTab";
import UserWaNotifSettings from "@/components/UserWaNotifSettings";
import AnonChatTab from "@/components/AnonChatTab";
import BotGalauTab from "@/components/BotGalauTab";
import DiscountWheelTab from "@/components/DiscountWheelTab";
import { triggerGameBalanceRefresh, useGameBalance } from "@/components/games/GameBalance";
import LiveClock from "@/components/LiveClock";
import LoginGate from "@/components/LoginGate";
import WhatsAppChat from "@/components/WhatsAppChat";
import WelcomePopup from "@/components/WelcomePopup";
import EngagementHub from "@/components/EngagementHub";
import WalletDashboard from "@/components/WalletDashboard";
import VoucherNavigation from "@/components/VoucherNavigation";
import HistoryEnhancer, { type HistoryItem } from "@/components/HistoryEnhancer";
import { TicketEnhancer, TICKET_TEMPLATES } from "@/components/TicketEnhancer";
import { useAccountBan } from "@/hooks/useAccountBan";
import { StoreProfile, StoreMiniCard, StoreProfileModal } from "@/components/StoreProfile";

type Tab = "musik" | "beranda" | "produk" | "voucher" | "history" | "likes" | "tiket" | "saldo" | "playlist" | "publik" | "sponsor" | "streak" | "streakevent" | "streakshop" | "streakvoucher" | "streakmembership" | "adminpost" | "game" | "plus" | "update" | "anonchat" | "storeai" | "confess" | "botgalau" | "botnotif" | "rodadiskon";

interface UserBalance {
  id: string;
  visitor_id: string;
  username: string;
  phone: string;
  email?: string | null;
  balance: number;
  bonus_balance?: number | null;
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
  sold_count?: number;
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

// Tipe transaksi pemasukan (saldo bertambah)
const INCOME_TX_TYPES = new Set(["topup", "topup_bonus", "reward", "lucky_draw_win", "weekly_leaderboard", "game_credit_reward"]);
function isIncomeTx(type: string) { return INCOME_TX_TYPES.has(type); }
function getTxLabel(type: string, lang: Lang) {
  if (type === "topup_bonus") return lang === "id" ? "🎁 Bonus Top Up" : "🎁 Topup Bonus";
  if (type === "topup") return t("balance.topup", lang);
  if (type === "reward") return lang === "id" ? "🏆 Hadiah" : "🏆 Reward";
  if (type === "lucky_draw_win") return lang === "id" ? "🎰 Lucky Draw" : "🎰 Lucky Draw";
  if (type === "weekly_leaderboard") return lang === "id" ? "🏅 Leaderboard" : "🏅 Leaderboard";
  if (type === "gem_purchase") return lang === "id" ? "💎 Beli Gem" : "💎 Gem Purchase";
  if (type === "luck_buy") return lang === "id" ? "🍀 Luck Spin" : "🍀 Luck Spin";
  if (type === "streak_pass_premium") return lang === "id" ? "🔥 Streak Pass" : "🔥 Streak Pass";
  if (type === "game_credit_reward") return lang === "id" ? "🔑 Reward Kredit" : "🔑 Credit Reward";
  return t("balance.purchase", lang);
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
  "/streak-voucher": "streakvoucher",
  "/streak-membership": "streakmembership",
  "/admin-post": "adminpost",
  "/game": "game",
  "/plus": "plus",
  "/bot-notif": "botnotif",
  "/update": "update",
  "/store-ai": "storeai",
  "/confess": "confess",
  "/bot-galau": "botgalau",
  "/roda-diskon": "rodadiskon",
  "/anon-chat": "anonchat",
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
  const [anonView, setAnonView] = useState<string>("lobby");
  const [discountWheelEventActive, setDiscountWheelEventActive] = useState<boolean | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") setAnonView(detail);
    };
    window.addEventListener("anon-chat-view", handler as EventListener);
    return () => window.removeEventListener("anon-chat-view", handler as EventListener);
  }, []);
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
      try {
        const key = "recent_products_v1";
        const raw = localStorage.getItem(key);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        const next = [p.id, ...arr.filter(id => id !== p.id)].slice(0, 12);
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("recent-products-update"));
      } catch {}
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
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 5;
  const [smartHistory, setSmartHistory] = useState<boolean>(() => localStorage.getItem("smart_history_v1") === "1");
  const [smartSaldo, setSmartSaldo] = useState<boolean>(() => {
    const saved = localStorage.getItem("smart_saldo_v2");
    if (saved !== null) return saved === "1";
    return true;
  });
  const [smartTickets, setSmartTickets] = useState<boolean>(() => localStorage.getItem("smart_tickets_v1") !== "0");
  useEffect(() => { localStorage.setItem("smart_history_v1", smartHistory ? "1" : "0"); }, [smartHistory]);
  useEffect(() => {
    localStorage.setItem("smart_saldo_v1", smartSaldo ? "1" : "0");
    localStorage.setItem("smart_saldo_v2", smartSaldo ? "1" : "0");
    if (smartSaldo) setShowTxExport(false);
  }, [smartSaldo]);
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

  // Track listening time → XP, quest, leaderboard
  useMusicListenTracker(playbackState, visitorId);

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
  const storePremium = useStorePremium(userBalance?.visitor_id ?? null);
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
  const [wholesalePrices, setWholesalePrices] = useState<any[]>([]);
  const [activeFlashSales, setActiveFlashSales] = useState<any[]>([]);
  const [flashTick, setFlashTick] = useState(0);
  function getActiveFlashSaleForProduct(productId: string) {
    const now = Date.now() + flashTick * 0; // tie to flashTick for re-eval
    return activeFlashSales.find((s) => {
      if (!s.is_active || s.product_id !== productId) return false;
      const start = new Date(s.starts_at).getTime();
      const end = new Date(s.ends_at).getTime();
      if (start > now || end <= now) return false;
      const remaining = (s.quota || 0) === 0 ? Infinity : Math.max(0, (s.quota || 0) - (s.sold || 0));
      return remaining > 0;
    });
  }
  function getFlashUnitPrice(flash: any, basePrice: number) {
    if (!flash) return basePrice;
    if (flash.mode === "discount_percent") {
      return Math.max(0, Math.round(basePrice * (1 - (flash.discount_percent || 0) / 100)));
    }
    return flash.flash_price ?? basePrice;
  }
  function getEffectivePrice(productId: string, basePrice: number, quantity: number = 1) {
    const flash = getActiveFlashSaleForProduct(productId);
    const flashRemaining = flash ? (flash.quota === 0 ? Infinity : Math.max(0, flash.quota - (flash.sold || 0))) : 0;
    if (flash && quantity <= flashRemaining) {
      return { price: getFlashUnitPrice(flash, basePrice), isFlash: true, flash };
    }
    return { price: getWholesalePrice(productId, quantity, basePrice), isFlash: false, flash: null as any };
  }
  const cartTotal = cart.reduce((sum, item) => {
    const eff = getEffectivePrice(item.product.id, item.product.price, item.quantity);
    return sum + eff.price * item.quantity;
  }, 0);
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
    cancel_reason?: string | null;
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
  const spendableStoreBalance = (userBalance?.balance || 0) + gameBalanceAmount;

  function formatPurchaseError(raw?: string | null, totalPrice?: number) {
    const message = raw || "Pembelian gagal diproses";
    if (/PIN belum dibuat/i.test(message)) return "PIN belum dibuat. Buat PIN terlebih dahulu di menu Saldo.";
    if (/INSUFFICIENT_BALANCE|Saldo tidak cukup|insufficient/i.test(message)) {
      const available = spendableStoreBalance;
      const shortage = Math.max(0, (totalPrice || 0) - available);
      return shortage > 0
        ? `Saldo tidak cukup. Kurang ${formatPrice(shortage)} — top up dulu atau gunakan Saldo IN jika ada.`
        : "Saldo tidak cukup. Top up dulu atau gunakan Saldo IN jika ada.";
    }
    if (/FunctionsHttpError|Edge Function|non-2xx|returned/i.test(message)) return "Pembelian gagal. Cek saldo/PIN lalu coba lagi.";
    return message;
  }

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
    fetchActiveFlashSales();
    const ch = supabase
      .channel("store_flash_sales_idx")
      .on("postgres_changes", { event: "*", schema: "public", table: "store_flash_sales" }, () => fetchActiveFlashSales())
      .subscribe();
    const tick = setInterval(() => setFlashTick((t) => (t + 1) % 1000000), 1000);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
  }, []);

  async function fetchActiveFlashSales() {
    const { data } = await supabase
      .from("store_flash_sales")
      .select("*")
      .eq("is_active", true);
    setActiveFlashSales((data as any[]) || []);
  }

  useEffect(() => {
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
    setHasPin(false);
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
    window.addEventListener("refresh-notifications", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("refresh-notifications", check);
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
      toast({ title: "PIN belum dibuat", description: "Buat PIN terlebih dahulu di menu Saldo sebelum membeli.", variant: "destructive" });
      setShowBuySaldo(false);
      setShowPinSetup(true);
    }
  }

  async function confirmPinAndBuy() {
    if (!pendingPurchase) return;
    const { data, error } = await supabase.functions.invoke("manage-pin", {
      body: { action: "verify", visitorId: activeBalanceVisitorId, pin: pinVerifyInput },
    });
    if (error || data?.error || !data?.valid) {
      if (data?.error && /PIN belum dibuat/i.test(data.error)) {
        setShowPinVerify(false);
        setShowPinSetup(true);
        toast({ title: "PIN belum dibuat", description: "Buat PIN terlebih dahulu di menu Saldo sebelum membeli.", variant: "destructive" });
      } else {
        toast({ title: data?.error || "PIN salah", variant: "destructive" });
      }
      return;
    }
    setShowPinVerify(false);
    buyWithSaldo(pendingPurchase.product, pendingPurchase.quantity, pendingPurchase.discountCode, pinVerifyInput);
    setPendingPurchase(null);
    setPinVerifyInput("");
  }

  async function buyWithSaldo(product: Product, quantity = 1, voucherCode = "", pin?: string) {
    const unitPrice = getWholesalePrice(product.id, quantity, product.price);
    const totalPrice = unitPrice * quantity;
    const availableBalance = (userBalance?.balance || 0) + gameBalanceAmount;
    if (!userBalance || availableBalance < totalPrice) {
      const shortage = Math.max(0, totalPrice - availableBalance);
      toast({ title: "Saldo tidak cukup", description: `Kurang ${formatPrice(shortage)}. Top up dulu atau gunakan Saldo IN jika ada.`, variant: "destructive" }); return;
    }
    const { data, error } = await supabase.functions.invoke("purchase-with-balance", {
      body: { visitorId: activeBalanceVisitorId, productId: product.id, quantity, discountCode: voucherCode || undefined, pin },
    });

    if (error || data?.error) {
      toast({ title: "Pembelian gagal", description: formatPurchaseError(data?.error || error?.message, totalPrice), variant: "destructive" }); return;
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
    triggerGameBalanceRefresh();
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

  async function shareProduct(p: Product, e?: React.MouseEvent) {
    e?.stopPropagation();
    const url = `${window.location.origin}/?produk=${p.id}`;
    const text = `🛍️ ${p.title}\n💰 ${formatPrice(p.price)}\n${p.description ? `\n${p.description}\n` : ""}\n👉 Cek di Agung Adi Store:\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.title, text, url });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Link disalin! 🔗", description: "Tempel di mana saja untuk berbagi produk ini." });
      }
    } catch {}
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

    const logoData = await loadPdfImage("/icons/icon-192.png");
    const qrisData = await loadPdfImage(storeQris);
    if (logoData) {
      try { doc.addImage(logoData, "PNG", 10, 5, 22, 22); } catch {}
    }
    if (qrisData) {
      try { doc.addImage(qrisData, "JPEG", pageW - 32, 5, 22, 22); } catch {}
    }

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
    const defName1 = "riwayat-klaim-agung-adi-store";
    const inp1 = window.prompt("Masukkan nama file PDF (tanpa .pdf):", defName1);
    if (inp1 === null) return;
    const safe1 = (inp1.trim() || defName1).replace(/[\\/:*?"<>|]+/g, "_");
    doc.save(`${safe1}.pdf`);
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

  // Listener: buka chat toko (general) — pakai produk pertama sebagai konteks
  useEffect(() => {
    const handler = () => {
      const first = products[0];
      if (first) openProductChat(first);
      else toast({ title: "Belum ada produk", description: "Silakan coba lagi nanti.", variant: "destructive" });
    };
    window.addEventListener("open-store-chat", handler);
    return () => window.removeEventListener("open-store-chat", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

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
      <WelcomePopup />
      {/* Modal Profil Toko global — selalu mounted, bisa dibuka dari mana saja via event "open-store-profile" */}
      <StoreProfileModal
        products={products}
        userBalance={userBalance}
        activeVisitorId={userBalance ? activeBalanceVisitorId : null}
        onLoginRequired={() => setTab("saldo")}
        onProductClick={(id) => { const p = products.find(x => x.id === id); if (p) { setTab("produk"); setSelectedProduct(p); } }}
      />
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
              <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                {([
                  { key: "beranda" as Tab, icon: Home, label: "Beranda", grad: "from-orange-400 via-pink-500 to-rose-500", glow: "244,114,182" },
                  { key: "musik" as Tab, icon: Music2, label: "Musik", grad: "from-fuchsia-500 via-purple-500 to-indigo-500", glow: "168,85,247" },
                  { key: "playlist" as Tab, icon: Music, label: "Playlist", grad: "from-purple-400 via-violet-500 to-indigo-600", glow: "139,92,246" },
                  { key: "publik" as Tab, icon: Globe, label: "Publik", grad: "from-blue-400 via-sky-500 to-cyan-500", glow: "14,165,233" },
                  { key: "produk" as Tab, icon: Package, label: t("nav.products", lang), grad: "from-amber-400 via-orange-500 to-red-500", glow: "251,146,60" },
                  { key: "voucher" as Tab, icon: Ticket, label: t("nav.voucher", lang), grad: "from-yellow-400 via-amber-500 to-orange-500", glow: "245,158,11" },
                  { key: "saldo" as Tab, icon: Wallet, label: t("nav.balance", lang), grad: "from-emerald-400 via-cyan-500 to-purple-500", glow: "16,185,129" },
                  { key: "likes" as Tab, icon: Heart, label: t("nav.likes", lang), grad: "from-rose-400 via-pink-500 to-red-500", glow: "244,63,94" },
                  { key: "history" as Tab, icon: Clock, label: t("nav.history", lang), grad: "from-sky-400 via-blue-500 to-indigo-500", glow: "59,130,246" },
                  { key: "tiket" as Tab, icon: AlertCircle, label: t("nav.ticket", lang), grad: "from-lime-400 via-green-500 to-emerald-500", glow: "34,197,94" },
                  { key: "sponsor" as Tab, icon: Megaphone, label: "Sponsor", grad: "from-cyan-400 via-teal-500 to-emerald-500", glow: "20,184,166" },
                  { key: "streak" as Tab, icon: CalendarDays, label: "Streak", grad: "from-orange-400 via-red-500 to-pink-600", glow: "239,68,68" },
                  { key: "streakevent" as Tab, icon: CalendarDays, label: "Streak Event", grad: "from-pink-400 via-fuchsia-500 to-purple-600", glow: "217,70,239" },
                  { key: "streakshop" as Tab, icon: CalendarDays, label: "Streak Shop", grad: "from-teal-400 via-emerald-500 to-green-600", glow: "16,185,129" },
                  { key: "streakmembership" as Tab, icon: Crown, label: "Membership Streak", grad: "from-yellow-300 via-amber-400 to-orange-500", glow: "250,204,21" },
                  { key: "luckroyale" as any, icon: Crown, label: "Lucky Royale", external: "/luck-royale-nyawa", grad: "from-amber-300 via-yellow-400 to-orange-500", glow: "234,179,8" },
                  { key: "streakvoucher" as Tab, icon: Ticket, label: "Streak Voucher", grad: "from-pink-400 via-fuchsia-500 to-purple-600", glow: "217,70,239" },
                  { key: "game" as Tab, icon: Gamepad2, label: "Game", grad: "from-violet-500 via-purple-500 to-fuchsia-500", glow: "139,92,246" },
                  { key: "plus" as Tab, icon: Gem, label: "Plus", grad: "from-cyan-300 via-sky-400 to-blue-500", glow: "56,189,248" },
                  { key: "botnotif" as Tab, icon: Bell, label: "Bot Notifikasi", grad: "from-green-400 via-emerald-500 to-teal-500", glow: "34,197,94" },
                  { key: "anonchat" as Tab, icon: VenetianMask, label: "Anon Chat", grad: "from-emerald-400 via-teal-500 to-cyan-500", glow: "16,185,129" },
                  { key: "update" as Tab, icon: RefreshCw, label: "Update", grad: "from-emerald-300 via-teal-400 to-cyan-500", glow: "45,212,191" },
                  { key: "storeai" as Tab, icon: Sparkles, label: "Store AI", grad: "from-violet-400 via-fuchsia-500 to-cyan-400", glow: "168,85,247" },
                  { key: "confess" as Tab, icon: MessageSquareWarning, label: "Confess", grad: "from-pink-500 via-rose-500 to-orange-400", glow: "236,72,153" },
                  { key: "botgalau" as Tab, icon: HeartCrack, label: "Bot Galau", grad: "from-rose-500 via-pink-500 to-purple-600", glow: "244,63,94" },
                  { key: "rodadiskon" as Tab, icon: Disc3, label: "Roda Diskon", grad: "from-fuchsia-500 via-purple-500 to-cyan-400", glow: "217,70,239" },
                  { key: "adminpost" as Tab, icon: FileText, label: "Admin", grad: "from-slate-400 via-zinc-500 to-gray-600", glow: "148,163,184" },
                ] as Array<{ key: any; icon: any; label: string; external?: string; grad: string; glow: string }>).map(({ key, icon: Icon, label, external, grad, glow }) => {
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
                      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all overflow-hidden ${active ? "shadow-md" : "hover:bg-muted/50 active:scale-[0.98]"}`}
                      style={active ? { background: `rgba(${glow}, 0.12)` } : undefined}
                    >
                      {/* Active accent bar */}
                      {active && (
                        <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b ${grad}`} />
                      )}
                      {/* Icon pill */}
                      <span className="relative shrink-0">
                        <span
                          className={`absolute inset-0 rounded-xl blur-md transition-opacity ${active ? "opacity-70" : "opacity-0 group-hover:opacity-40"}`}
                          style={{ background: `rgba(${glow}, 0.5)` }}
                        />
                        <span className={`relative w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${grad} ${active ? "shadow-md" : "opacity-80 group-hover:opacity-100"}`}>
                          <Icon className="w-[16px] h-[16px] text-white drop-shadow" strokeWidth={2.2} />
                        </span>
                      </span>
                      <span className={`text-sm flex-1 text-left transition-all ${active ? `font-extrabold bg-clip-text text-transparent bg-gradient-to-r ${grad}` : "font-medium text-foreground group-hover:font-semibold"}`}>{label}</span>
                      {active && <ChevronRight className={`w-3.5 h-3.5 bg-clip-text text-transparent bg-gradient-to-r ${grad}`} style={{ color: `rgb(${glow})` }} />}
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
            <button
              onClick={() => setShowCart(true)}
              aria-label="Buka keranjang"
              className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-foreground"
            >
              <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={1.7} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent text-accent-foreground text-[9px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1 border border-background animate-in zoom-in-50">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-foreground">
              <Bell className="w-[18px] h-[18px]" strokeWidth={1.7} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[9px] font-semibold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1 border border-background">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>
            <a
              href={`${SOCIAL_LINKS.whatsapp}?text=${encodeURIComponent("Halo, saya mau tanya di Agung Adi Store")}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat WhatsApp"
              className="group relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-foreground"
            >
              {/* Glow halo */}
              <span className="absolute inset-0 rounded-full bg-emerald-400/0 group-hover:bg-emerald-400/15 blur-md transition-all" />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative w-[20px] h-[20px] drop-shadow-[0_0_4px_rgba(16,185,129,0.4)] group-hover:scale-110 transition-transform"
              >
                <defs>
                  <linearGradient id="chatGradFront" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" />
                  </linearGradient>
                  <linearGradient id="chatGradBack" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                  </linearGradient>
                </defs>
                {/* Back bubble */}
                <path
                  d="M10 7h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.5L15 19.5V17h-5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                  fill="url(#chatGradBack)"
                  stroke="url(#chatGradBack)"
                  strokeWidth="0.5"
                />
                {/* Front bubble */}
                <path
                  d="M5 4h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6.5L5 16.5V14a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                  fill="url(#chatGradFront)"
                />
                {/* Lines inside front bubble */}
                <line x1="6.5" y1="7.5" x2="13" y2="7.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.95" />
                <line x1="6.5" y1="10.5" x2="11" y2="10.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.95" />
                {/* Dots inside back bubble */}
                <circle cx="13" cy="12.2" r="0.7" fill="white" opacity="0.9" />
                <circle cx="15.2" cy="12.2" r="0.7" fill="white" opacity="0.9" />
                <circle cx="17.4" cy="12.2" r="0.7" fill="white" opacity="0.9" />
              </svg>
              {/* Pulse online dot */}
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 border border-background shadow-[0_0_6px_rgba(16,185,129,0.8)]">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </span>
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {tab === "musik" && (
          <>
            <MusicHub
              subTab={musicSubTab}
              onSubTabChange={setMusicSubTab}
              onPlayExternal={(song) => playExternalRef.current?.(song)}
              playlistSlot={null /* PlaylistTab is mounted persistently below */}
              playbackState={playbackState}
              onTogglePlay={() => togglePlayRef.current?.()}
              onOpenFullPlayer={() => openFullPlayerRef.current?.()}
            />
            <div className="mt-3">
              <MusicMegaHub
                visitorId={visitorId}
                playbackState={playbackState}
                onPlaySong={(song) => playExternalRef.current?.(song)}
              />
            </div>
          </>
        )}

        {tab === "beranda" && (
          <div className="space-y-5 animate-fade-in">
            {/* Profil Toko Agung Adi Store */}
            <StoreProfile
              products={products}
              userBalance={userBalance}
              onLoginRequired={() => setTab("saldo")}
              onProductClick={(id) => { const p = products.find(x => x.id === id); if (p) { setTab("produk"); setSelectedProduct(p); } }}
            />

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

            {/* Welcome Header - Aurora Neon Premium + Maksimalis Confetti */}
            <div className="relative">
              {/* Confetti emoji rain di belakang card */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                {["🎉","✨","💎","🎵","🔥","⭐","🎮","💰","🎁","🚀","💫","🎊"].map((emoji, i) => (
                  <span
                    key={i}
                    className="confetti-piece"
                    style={{
                      left: `${(i * 8.3) % 100}%`,
                      animationDelay: `${(i * 0.35) % 4}s`,
                      animationDuration: `${3 + (i % 3)}s`,
                    }}
                  >
                    {emoji}
                  </span>
                ))}
              </div>

              {/* Sticker emoji floating di sudut */}
              <div className="pointer-events-none absolute -top-3 -left-2 text-3xl animate-sticker z-10 drop-shadow-[0_4px_8px_rgba(236,72,153,0.6)]">🌈</div>
              <div className="pointer-events-none absolute -top-2 -right-3 text-2xl animate-sticker z-10 drop-shadow-[0_4px_8px_rgba(250,204,21,0.7)]" style={{ animationDelay: "0.8s" }}>⚡</div>
              <div className="pointer-events-none absolute -bottom-2 -right-2 text-2xl animate-sticker z-10 drop-shadow-[0_4px_8px_rgba(34,211,238,0.7)]" style={{ animationDelay: "1.4s" }}>💎</div>

              <div className="relative rounded-3xl overflow-hidden p-[2px] aurora-shift" style={{ background: "linear-gradient(135deg, #ec4899, #a855f7, #06b6d4, #f59e0b, #10b981, #ec4899)", backgroundSize: "400% 400%" }}>
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
                    <h2 className="text-[19px] font-extrabold leading-tight truncate bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                      {STORE_NAME}
                    </h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                      <span className="text-yellow-500">⭐</span> {t("header.tagline", lang)}
                    </p>
                    {storePremium.isPremium && (
                      <div className="mt-1 flex items-center">
                        <PremiumBadge size="xs" />
                      </div>
                    )}
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
            </div>

            {/* Marquee Ticker Warna-warni */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-pink-500 via-fuchsia-500 via-purple-500 via-cyan-400 to-emerald-500 p-[2px] aurora-shift" style={{ backgroundSize: "300% 100%" }}>
              <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl py-2 overflow-hidden">
                <div className="flex whitespace-nowrap" style={{ animation: "marquee-x 22s linear infinite" }}>
                  {[...Array(2)].map((_, k) => (
                    <div key={k} className="flex items-center gap-6 px-4 text-xs font-bold shrink-0">
                      <span className="text-pink-500">🎉 PROMO HARIAN</span>
                      <span className="text-cyan-400">💎 VOUCHER GRATIS</span>
                      <span className="text-yellow-500">⭐ TERPERCAYA</span>
                      <span className="text-emerald-500">💰 SALDO INSTAN</span>
                      <span className="text-fuchsia-500">🎵 MUSIK GRATIS</span>
                      <span className="text-orange-500">🔥 GAME SERU</span>
                      <span className="text-violet-500">🎮 11 GAME AI</span>
                      <span className="text-rose-500">❤️ ADMIN RAMAH</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Stats Dashboard - Maksimalis Neon Glow */}
            <div className="relative rounded-3xl p-[2px] overflow-hidden" style={{ background: "linear-gradient(135deg, #ec4899, #a855f7, #06b6d4, #10b981, #f59e0b, #ec4899)", backgroundSize: "400% 400%", animation: "aurora-shift 6s ease infinite, neon-border-flow 4s ease-in-out infinite" }}>
              <div className="relative rounded-[22px] bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-3 overflow-hidden">
                <div className="pointer-events-none absolute -top-10 -left-10 w-32 h-32 rounded-full bg-pink-500/30 blur-3xl animate-blob" />
                <div className="pointer-events-none absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-cyan-500/30 blur-3xl animate-blob" style={{ animationDelay: "2s" }} />
                <div className="pointer-events-none absolute top-1/2 left-1/2 w-24 h-24 rounded-full bg-amber-500/20 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />
                {[...Array(8)].map((_, i) => (
                  <div key={`spk-${i}`} className="pointer-events-none absolute w-1 h-1 rounded-full bg-white animate-ping" style={{ top: `${15 + (i * 11) % 70}%`, left: `${(i * 13) % 95}%`, animationDelay: `${i * 0.3}s`, boxShadow: "0 0 8px rgba(255,255,255,0.9)" }} />
                ))}

                <div className="relative flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base animate-wiggle inline-block">🚀</span>
                    <h3 className="text-xs font-black uppercase tracking-[0.18em] bg-gradient-to-r from-pink-300 via-cyan-300 to-amber-300 bg-clip-text text-transparent animate-count-glow">Live Dashboard</h3>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-300 uppercase">Realtime</span>
                  </div>
                </div>

                <div className="relative grid grid-cols-4 gap-1.5">
                  {[
                    { emoji: "🎵", label: "Lagu", value: "200+", grad: "from-pink-500/30 to-rose-500/15", border: "border-pink-400/50", text: "text-pink-200", glow: "rgba(236,72,153,0.5)" },
                    { emoji: "🎮", label: "Game", value: "40", grad: "from-violet-500/30 to-purple-500/15", border: "border-violet-400/50", text: "text-violet-200", glow: "rgba(168,85,247,0.5)" },
                    { emoji: "🎁", label: "Hadiah", value: "∞", grad: "from-amber-500/30 to-yellow-500/15", border: "border-amber-400/50", text: "text-amber-200", glow: "rgba(250,204,21,0.5)" },
                    { emoji: "⚡", label: "Instan", value: "24/7", grad: "from-cyan-500/30 to-teal-500/15", border: "border-cyan-400/50", text: "text-cyan-200", glow: "rgba(34,211,238,0.5)" },
                  ].map((s, i) => (
                    <div key={`stat-${i}`} className={`relative rounded-xl p-2 bg-gradient-to-br ${s.grad} border ${s.border} overflow-hidden animate-pop-in`} style={{ animationDelay: `${i * 0.1}s`, boxShadow: `0 4px 16px -4px ${s.glow}` }}>
                      <div className="absolute inset-0 animate-shimmer-bar opacity-40 pointer-events-none" />
                      <div className="relative text-center">
                        <div className="text-xl mb-0.5 animate-wiggle inline-block" style={{ animationDelay: `${i * 0.2}s`, filter: `drop-shadow(0 2px 4px ${s.glow})` }}>{s.emoji}</div>
                        <p className={`text-[8px] font-black ${s.text} uppercase tracking-wider leading-none`}>{s.label}</p>
                        <p className="text-sm font-black text-white tabular-nums leading-tight mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">{s.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative mt-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                  {[
                    { icon: "🏆", text: "Trusted #1", grad: "from-amber-400 to-orange-500" },
                    { icon: "🔥", text: "Hot Deals", grad: "from-rose-500 to-pink-500" },
                    { icon: "⭐", text: "5-Star", grad: "from-yellow-400 to-amber-500" },
                    { icon: "🎯", text: "Akurat", grad: "from-emerald-400 to-teal-500" },
                    { icon: "💖", text: "Loved", grad: "from-fuchsia-500 to-purple-500" },
                  ].map((b, i) => (
                    <div key={`chip-${i}`} className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r ${b.grad} border border-white/30 animate-pop-in`} style={{ animationDelay: `${0.4 + i * 0.08}s`, boxShadow: "0 4px 12px -2px rgba(0,0,0,0.3)" }}>
                      <span className="text-[10px]">{b.icon}</span>
                      <span className="text-[9px] font-black text-white whitespace-nowrap drop-shadow">{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Access - iOS Style Frosted Card */}
            <div className="relative rounded-[28px] bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.18)] overflow-hidden">
              <div className="pointer-events-none absolute -top-20 right-1/4 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 left-1/4 w-48 h-48 rounded-full bg-cyan-400/10 blur-3xl" />

              <div className="relative p-3.5">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-[13px] font-bold tracking-tight text-foreground">Quick Access</h3>
                  <span className="text-[10px] text-muted-foreground font-medium">21 Menu</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {([
                    { icon: <Music className="w-5 h-5" strokeWidth={2} />, label: "Musik", tab: "playlist" as Tab, color: "from-pink-500 to-rose-500", glow: "236,72,153" },
                    { icon: <Package className="w-5 h-5" strokeWidth={2} />, label: "Produk", tab: "produk" as Tab, badge: `${products.length}`, color: "from-cyan-400 to-blue-500", glow: "34,211,238" },
                    { icon: <Ticket className="w-5 h-5" strokeWidth={2} />, label: "Voucher", tab: "voucher" as Tab, color: "from-purple-500 to-violet-600", glow: "168,85,247" },
                    { icon: <Wallet className="w-5 h-5" strokeWidth={2} />, label: "Saldo", tab: "saldo" as Tab, color: "from-emerald-500 to-green-500", glow: "16,185,129" },
                    { icon: <Heart className="w-5 h-5" strokeWidth={2} />, label: "Suka", tab: "likes" as Tab, color: "from-rose-500 to-pink-500", glow: "244,63,94" },
                    { icon: <Gamepad2 className="w-5 h-5" strokeWidth={2} />, label: "Game", tab: "game" as Tab, badge: "40", color: "from-yellow-400 to-orange-500", glow: "250,204,21" },
                    { icon: <Flame className="w-5 h-5" strokeWidth={2} />, label: "Streak", tab: "streak" as Tab, color: "from-orange-500 to-red-500", glow: "249,115,22" },
                    { icon: <Gem className="w-5 h-5" strokeWidth={2} />, label: "Plus", tab: "plus" as Tab, color: "from-indigo-500 to-purple-500", glow: "99,102,241" },
                    { icon: <Bell className="w-5 h-5" strokeWidth={2} />, label: "Bot Notif", tab: "botnotif" as Tab, color: "from-green-500 to-emerald-500", glow: "34,197,94" },
                    { icon: <VenetianMask className="w-5 h-5" strokeWidth={2} />, label: "Anon Chat", tab: "anonchat" as Tab, color: "from-emerald-500 to-teal-500", glow: "16,185,129" },
                    { icon: <MessageSquareWarning className="w-5 h-5" strokeWidth={2} />, label: "Confess", tab: "confess" as Tab, color: "from-pink-500 via-rose-500 to-orange-400", glow: "236,72,153" },
                    { icon: <Megaphone className="w-5 h-5" strokeWidth={2} />, label: "Sponsor", tab: "sponsor" as Tab, color: "from-amber-500 to-yellow-500", glow: "245,158,11" },
                    { icon: <MessageSquare className="w-5 h-5" strokeWidth={2} />, label: "Tiket", tab: "tiket" as Tab, color: "from-blue-500 to-cyan-500", glow: "59,130,246" },
                    { icon: <Globe className="w-5 h-5" strokeWidth={2} />, label: "Publik", tab: "publik" as Tab, color: "from-teal-500 to-cyan-500", glow: "20,184,166" },
                    { icon: <History className="w-5 h-5" strokeWidth={2} />, label: "Riwayat", tab: "history" as Tab, color: "from-slate-500 to-zinc-500", glow: "100,116,139" },
                    { icon: <CalendarDays className="w-5 h-5" strokeWidth={2} />, label: "Event", tab: "streakevent" as Tab, color: "from-fuchsia-500 to-pink-500", glow: "217,70,239" },
                    { icon: <ShoppingBag className="w-5 h-5" strokeWidth={2} />, label: "S.Shop", tab: "streakshop" as Tab, color: "from-lime-500 to-green-500", glow: "132,204,22" },
                    { icon: <Crown className="w-5 h-5" strokeWidth={2} />, label: "Member", tab: "streakmembership" as Tab, color: "from-yellow-500 to-amber-500", glow: "234,179,8" },
                    { icon: <RefreshCw className="w-5 h-5" strokeWidth={2} />, label: "Update", tab: "update" as Tab, color: "from-sky-500 to-blue-500", glow: "14,165,233" },
                    { icon: <Crown className="w-5 h-5" strokeWidth={2} />, label: "Lucky Royale", external: "/luck-royale-nyawa", color: "from-violet-500 to-fuchsia-500", glow: "139,92,246" },
                    { icon: <Disc3 className="w-5 h-5" strokeWidth={2} />, label: "Roda Diskon", tab: "rodadiskon" as Tab, color: "from-fuchsia-500 to-cyan-400", glow: "217,70,239" },
                    { icon: <HeartCrack className="w-5 h-5" strokeWidth={2} />, label: "Bot Galau", tab: "botgalau" as Tab, color: "from-rose-500 to-purple-600", glow: "244,63,94" },
                    { icon: <FileText className="w-5 h-5" strokeWidth={2} />, label: "Admin", tab: "adminpost" as Tab, color: "from-red-500 to-rose-500", glow: "239,68,68" },
                  ] as any[]).map((item) => (
                    <button
                      key={item.label}
                      onClick={() => item.external ? navigate(item.external) : setTab(item.tab)}
                      className="group relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.92] transition-all duration-200 ease-out"
                      style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06)" }}
                    >
                      {/* Icon */}
                      <div className="relative">
                        {/* Soft glow halo (subtle, iOS-like) */}
                        <div
                          className="absolute inset-0 rounded-2xl blur-md opacity-60 group-hover:opacity-90 transition-opacity"
                          style={{ background: `rgba(${item.glow}, 0.45)` }}
                        />
                        <div
                          className={`relative w-10 h-10 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white transition-transform duration-200 group-active:scale-95`}
                          style={{ boxShadow: `0 6px 16px -4px rgba(${item.glow}, 0.55), inset 0 1px 0 0 rgba(255,255,255,0.25)` }}
                        >
                          {item.icon}
                        </div>
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[#FF3B30] text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md ring-2 ring-background">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] font-semibold text-foreground/85 tracking-tight">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Playful 3D Hero */}
            <PlayfulHero3D
              title={`Selamat datang di ${STORE_NAME}!`}
              subtitle="Murah & Terpercaya • Belanja, Musik, Game seru semua di sini ✨"
              emoji="🛍️"
              gradient="from-fuchsia-500 via-pink-500 to-orange-400"
              ctaLabel="Mulai Jelajah"
              onClick={() => setTab("produk")}
              variant="shop"
              height={190}
            />

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
                { value: "40", label: "Game", Icon: Gamepad2, color: "from-purple-500 to-pink-500", glow: "168,85,247" },
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

            {/* Admin Posts Preview — Apple Minimal Premium */}
            {adminPosts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-[10px] bg-primary/30 blur-md" />
                      <div className="relative w-7 h-7 rounded-[10px] bg-gradient-to-br from-foreground to-foreground/70 flex items-center justify-center shadow-[0_4px_14px_-4px_hsl(var(--foreground)/0.4)]">
                        <FileText className="w-3.5 h-3.5 text-background" strokeWidth={2.4} />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-bold text-[13px] tracking-tight leading-tight">Postingan Admin</h3>
                      <span className="text-[10px] text-muted-foreground font-medium leading-tight">Pengumuman resmi</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setTab("adminpost")}
                    className="text-[11px] font-semibold text-foreground/80 hover:text-foreground flex items-center gap-0.5 px-2.5 py-1.5 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.1] transition-all active:scale-95"
                  >
                    Semua <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {adminPosts.slice(0, 2).map((post, idx) => (
                    <button
                      key={post.id}
                      onClick={() => setTab("adminpost")}
                      className="group relative w-full text-left overflow-hidden rounded-[18px] bg-background/60 backdrop-blur-2xl backdrop-saturate-150 border border-foreground/[0.08] shadow-[0_2px_10px_-2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_14px_-2px_rgba(0,0,0,0.08),0_18px_40px_-12px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300"
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
                      <div className="p-3 flex items-center gap-3">
                        {post.image_url ? (
                          <div className="relative shrink-0">
                            <div className="absolute -inset-0.5 rounded-[14px] bg-gradient-to-br from-foreground/10 to-transparent blur-sm" />
                            <img
                              src={post.image_url}
                              alt={post.title}
                              className="relative w-[58px] h-[58px] rounded-[14px] object-cover ring-1 ring-foreground/10 group-hover:scale-[1.04] transition-transform duration-500"
                            />
                          </div>
                        ) : (
                          <div className="relative shrink-0 w-[58px] h-[58px] rounded-[14px] bg-gradient-to-br from-foreground/[0.08] to-foreground/[0.03] ring-1 ring-foreground/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-foreground/50" strokeWidth={2} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase text-foreground/70 px-1.5 py-0.5 rounded-md bg-foreground/[0.06] ring-1 ring-foreground/[0.06]">
                              <span className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_6px_hsl(142_76%_45%)]" />
                              Resmi
                            </span>
                            {idx === 0 && (
                              <span className="text-[9px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">Baru</span>
                            )}
                          </div>
                          <h4 className="font-semibold text-[13.5px] tracking-tight truncate leading-snug">{post.title}</h4>
                          {post.content && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-snug">{post.content}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/80 mt-1 flex items-center gap-1 font-medium">
                            <CalendarDays className="w-2.5 h-2.5" strokeWidth={2.2} />
                            {new Date(post.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-foreground/70 group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth={2.2} />
                      </div>
                    </button>
                  ))}
                </div>
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

            {/* Ikuti Kami - Premium Animated Card */}
            <div className="relative rounded-[28px] overflow-hidden p-[1.5px] bg-gradient-to-br from-pink-500/60 via-violet-500/60 to-cyan-400/60 shadow-[0_20px_60px_-15px_rgba(168,85,247,0.5)] animate-fade-in">
              <div className="relative rounded-[26px] bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-2xl overflow-hidden">
                {/* Animated aurora blobs */}
                <div className="pointer-events-none absolute -top-20 -right-10 w-48 h-48 rounded-full bg-pink-500/25 blur-3xl animate-pulse" />
                <div className="pointer-events-none absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-cyan-400/25 blur-3xl animate-pulse" style={{ animationDelay: "1.2s" }} />
                <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-violet-500/15 blur-3xl animate-pulse" style={{ animationDelay: "0.6s" }} />
                {/* Shimmer line */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                <div className="relative p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-pink-500 to-violet-500 blur-md opacity-70 animate-pulse" />
                        <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-500 flex items-center justify-center shadow-lg" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 8px 20px -5px rgba(236,72,153,0.6)" }}>
                          <Globe className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-[14px] font-black tracking-tight bg-gradient-to-r from-pink-300 via-fuchsia-200 to-violet-300 bg-clip-text text-transparent">{t("home.follow_us", lang)}</h3>
                        <p className="text-[10px] text-white/60 font-medium">Connect • Engage • Win</p>
                      </div>
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-white/85 font-bold">{socialLinks.length} Aktif</span>
                    </div>
                  </div>

                  {/* Social grid */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {socialLinks.map((s, i) => {
                      const palette = [
                        { color: "from-pink-500 to-rose-500", glow: "236,72,153", ring: "rgba(236,72,153,0.6)" },
                        { color: "from-cyan-400 to-blue-500", glow: "34,211,238", ring: "rgba(34,211,238,0.6)" },
                        { color: "from-purple-500 to-violet-600", glow: "168,85,247", ring: "rgba(168,85,247,0.6)" },
                        { color: "from-emerald-500 to-green-500", glow: "16,185,129", ring: "rgba(16,185,129,0.6)" },
                        { color: "from-yellow-400 to-orange-500", glow: "250,204,21", ring: "rgba(250,204,21,0.6)" },
                      ][i % 5];
                      return (
                        <a
                          key={s.id}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] active:scale-[0.92] transition-all duration-200 ease-out overflow-hidden animate-fade-in"
                          style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.08)", animationDelay: `${i * 60}ms` }}
                        >
                          {/* Hover glow background */}
                          <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(circle at center, rgba(${palette.glow},0.18), transparent 70%)` }} />
                          {/* Shimmer */}
                          <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                          <div className="relative">
                            {/* Glow ring */}
                            <div className="absolute inset-0 rounded-2xl blur-lg opacity-50 group-hover:opacity-90 transition-opacity duration-300 group-hover:animate-pulse" style={{ background: `rgba(${palette.glow}, 0.55)` }} />
                            {s.icon_url ? (
                              <div
                                className="relative w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center overflow-hidden group-hover:scale-110 group-hover:rotate-[-4deg] transition-transform duration-300 ease-out"
                                style={{ boxShadow: `0 8px 20px -4px ${palette.ring}, inset 0 1px 0 0 rgba(255,255,255,0.3)` }}
                              >
                                <img src={s.icon_url} alt={s.platform} className="w-7 h-7 object-contain group-hover:scale-110 transition-transform" />
                              </div>
                            ) : (
                              <div
                                className={`relative w-11 h-11 rounded-2xl bg-gradient-to-br ${palette.color} flex items-center justify-center text-base font-black text-white group-hover:scale-110 group-hover:rotate-[-4deg] transition-transform duration-300 ease-out`}
                                style={{ boxShadow: `0 8px 20px -4px ${palette.ring}, inset 0 1px 0 0 rgba(255,255,255,0.3)` }}
                              >
                                {s.platform[0]?.toUpperCase()}
                              </div>
                            )}
                            {/* Sparkle */}
                            <div className="pointer-events-none absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="absolute inset-0 rounded-full bg-white animate-ping" />
                            </div>
                          </div>
                          <span className="truncate text-[10.5px] font-bold w-full text-center text-white/90 tracking-tight relative">{s.label}</span>
                        </a>
                      );
                    })}
                  </div>

                  {/* Bottom CTA pill */}
                  <div className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-gradient-to-r from-pink-500/15 via-violet-500/15 to-cyan-400/15 border border-white/10">
                    <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                    <span className="text-[10px] font-semibold text-white/80 tracking-wide">Tap untuk follow & dapatkan info update</span>
                    <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" style={{ animationDelay: "0.5s" }} />
                  </div>
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

            {/* Live product showcase bar */}
            <ProductShowcaseBar
              totalProducts={products.length}
              inStockProducts={products.filter(p => p.stock > 0).length}
              newProducts={products.filter(p => (Date.now() - new Date(p.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000).length}
              topCategory={(Object.entries(productCategoryCounts).filter(([k]) => k !== "Semua").sort((a, b) => b[1] - a[1])[0]?.[0]) || null}
            />

            {/* Shop Power Hub: Recently Viewed, AI Picks, Compare, Stats */}
            <ShopPowerHub
              products={products}
              claimHistory={history.map(h => ({ product_title: h.product_title, product_price: h.product_price, claimed_at: h.claimed_at }))}
              totalSpent={history.reduce((s, h) => s + (h.product_price || 0), 0)}
              formatPrice={formatPrice}
              onOpen={openProduct}
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
                {sortedProducts.map((p, idx) => {
                  const imgs = getProductImages(p.id);
                  const badges = getProductBadges(p);
                  const isGrid = productViewMode === "grid";
                  const inStock = p.stock > 0;
                  const isNew = (Date.now() - new Date(p.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
                  const isHot = (productLikeCounts[p.id] || 0) >= 5;
                  return (
                    <div
                      key={p.id}
                      className="relative rounded-2xl p-[2px] aurora-shift overflow-hidden cursor-pointer group transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] animate-fade-in"
                      style={{
                        animationDelay: `${Math.min(idx, 12) * 60}ms`,
                        animationFillMode: "both",
                        background: inStock
                          ? "linear-gradient(135deg, hsl(190 95% 55%/0.8), hsl(280 90% 65%/0.7), hsl(330 90% 60%/0.8), hsl(45 95% 55%/0.7), hsl(190 95% 55%/0.8))"
                          : "linear-gradient(135deg, hsl(0 0% 50%/0.4), hsl(0 70% 50%/0.5), hsl(0 0% 50%/0.4))",
                        backgroundSize: "300% 300%",
                        boxShadow: inStock ? "0 8px 32px -8px rgba(34,211,238,0.4), 0 4px 16px -4px rgba(168,85,247,0.3)" : "0 4px 16px -4px rgba(0,0,0,0.3)",
                      }}
                      onClick={() => openProduct(p)}
                    >
                      <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 backdrop-blur-xl rounded-[14px] card-shine relative">
                      {/* Holographic shimmer overlay */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      {/* Inner neon glow on hover */}
                      <div className="absolute -inset-0.5 bg-gradient-to-br from-cyan-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-cyan-500/30 group-hover:via-purple-500/20 group-hover:to-pink-500/30 rounded-[14px] blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10" />

                      {/* Floating sparkle particles on hover */}
                      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10">
                        {[...Array(6)].map((_, i) => (
                          <span
                            key={i}
                            className="absolute w-1 h-1 rounded-full bg-white"
                            style={{
                              top: `${15 + (i * 13) % 70}%`,
                              left: `${(i * 17) % 90}%`,
                              boxShadow: "0 0 6px rgba(255,255,255,0.9), 0 0 12px rgba(34,211,238,0.7)",
                              animation: `float-up ${1.6 + (i % 3) * 0.4}s ease-in-out ${i * 0.15}s infinite`,
                            }}
                          />
                        ))}
                      </div>

                      {/* HOT badge for popular items */}
                      {isHot && inStock && (
                        <div className="absolute -top-1 -left-1 z-30 pointer-events-none">
                          <div className="relative">
                            <div className="absolute inset-0 rounded-br-2xl bg-gradient-to-br from-rose-500 to-orange-500 blur-md opacity-80 animate-pulse" />
                            <div className="relative rounded-br-2xl rounded-tl-[14px] bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 px-2 py-1 border-r border-b border-white/40 shadow-[0_0_14px_rgba(244,63,94,0.7)]">
                              <span className="text-[9px] font-black text-white tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] flex items-center gap-0.5">
                                🔥 HOT
                              </span>
                            </div>
                          </div>
                        </div>
                      )}


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

                          {/* Price badge top-right - holographic neon (with flash sale support) */}
                          {(() => {
                            const flashEff = getActiveFlashSaleForProduct(p.id);
                            const flashPrice = flashEff ? getFlashUnitPrice(flashEff, p.price) : p.price;
                            return (
                              <div className="absolute top-2 right-2 z-10">
                                <div className="relative flex flex-col items-end gap-1">
                                  {flashEff && (
                                    <span className={`inline-flex items-center gap-0.5 font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.8)] border border-white/40 animate-pulse ${isGrid ? "text-[8px]" : "text-[9px]"}`}>
                                      ⚡ FLASH
                                    </span>
                                  )}
                                  <div className="relative">
                                    <div className={`absolute inset-0 rounded-full blur-md opacity-70 animate-pulse ${flashEff ? "bg-gradient-to-r from-red-400 via-orange-500 to-yellow-500" : "bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500"}`} />
                                    <span className={`relative inline-block font-black ${flashEff ? "bg-gradient-to-r from-yellow-200 via-white to-orange-200 text-red-700 shadow-[0_0_20px_rgba(239,68,68,0.8),inset_0_1px_2px_rgba(255,255,255,0.5)]" : "bg-gradient-to-r from-cyan-300 via-white to-purple-200 text-slate-900 shadow-[0_0_20px_rgba(34,211,238,0.8),inset_0_1px_2px_rgba(255,255,255,0.5)]"} rounded-full backdrop-blur-sm border-2 border-white/50 ${isGrid ? "text-[10px] px-2.5 py-1" : "text-xs px-3 py-1.5"}`}>{formatPrice(flashPrice)}</span>
                                  </div>
                                  {flashEff && (
                                    <span className={`inline-block font-bold line-through text-white/80 bg-black/40 px-1.5 py-0.5 rounded-full ${isGrid ? "text-[8px]" : "text-[9px]"}`}>{formatPrice(p.price)}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

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
                          <h3 className={`font-black flex-1 text-white group-hover:bg-gradient-to-r group-hover:from-cyan-300 group-hover:to-pink-300 group-hover:bg-clip-text group-hover:text-transparent transition-all line-clamp-2 ${isGrid ? "text-xs" : "text-base"}`}>
                            <span className="inline">{p.title}</span>
                            <VerifiedBadge size={isGrid ? "xs" : "sm"} className="ml-1 -mt-0.5" />
                          </h3>
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
                         {imgs.length === 0 && (() => {
                           const fEff = getActiveFlashSaleForProduct(p.id);
                           const fPrice = fEff ? getFlashUnitPrice(fEff, p.price) : p.price;
                           return (
                             <span className={`font-black ${fEff ? "text-red-500" : "bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent"} ${isGrid ? "text-xs" : "text-sm"}`}>
                               {formatPrice(fPrice)}{fEff && <span className="text-[10px] font-bold line-through text-muted-foreground ml-1">{formatPrice(p.price)}</span>}
                             </span>
                           );
                         })()}
                          <div className={`flex items-center gap-1.5 flex-wrap ${isGrid ? "text-[9px]" : ""}`}>
                            <span className={`px-2 py-0.5 rounded-full font-black flex items-center gap-1 backdrop-blur-sm ${isGrid ? "text-[9px]" : "text-[10px] px-2.5 py-1"} ${inStock ? 'bg-gradient-to-r from-emerald-500/30 to-green-500/20 text-emerald-200 border border-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-r from-rose-500/30 to-red-500/20 text-rose-200 border border-rose-400/40'}`}>
                              {inStock ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_rgb(52,211,153)]" /> {p.stock} stok</> : '✗ Habis'}
                            </span>
                            {(p.sold_count ?? 0) > 0 && (
                              <span className={`px-2 py-0.5 rounded-full font-black flex items-center gap-1 backdrop-blur-sm bg-gradient-to-r from-orange-500/30 to-amber-500/20 text-orange-200 border border-orange-400/40 shadow-[0_0_8px_rgba(251,146,60,0.3)] ${isGrid ? "text-[9px]" : "text-[10px] px-2.5 py-1"}`}>
                                🔥 {p.sold_count} terjual
                              </span>
                            )}
                            {!isGrid && (
                              <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-slate-800/60 text-slate-300 flex items-center gap-1 border border-slate-700/50">
                                <CalendarDays className="w-3 h-3" /> {new Date(p.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Premium CTA + Share row */}
                        <div className="flex items-stretch gap-1.5">
                          {inStock && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openProduct(p); }}
                              className={`relative flex-1 overflow-hidden rounded-lg font-black text-white shadow-[0_4px_15px_rgba(34,211,238,0.4)] hover:shadow-[0_6px_20px_rgba(168,85,247,0.6)] transition-all hover:scale-[1.02] active:scale-[0.98] group/btn ${isGrid ? "h-7 text-[10px]" : "h-9 text-xs"}`}
                              style={{ background: "linear-gradient(135deg, hsl(190 95% 50%), hsl(220 90% 55%), hsl(280 90% 60%), hsl(330 90% 55%))", backgroundSize: "200% 200%" }}
                            >
                              <span className="absolute inset-0 shine-sweep opacity-60" />
                              <span className="relative flex items-center justify-center gap-1.5">
                                <ShoppingBag className={`${isGrid ? "w-3 h-3" : "w-3.5 h-3.5"} group-hover/btn:rotate-12 transition-transform`} />
                                Beli Sekarang
                              </span>
                            </button>
                          )}
                          <button
                            onClick={(e) => shareProduct(p, e)}
                            aria-label="Bagikan produk"
                            className={`relative ${inStock ? "" : "flex-1"} overflow-hidden rounded-lg font-black text-white shadow-[0_4px_15px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 ${isGrid ? "h-7 text-[10px] px-2.5" : "h-9 text-xs px-3"}`}
                            style={{ background: "linear-gradient(135deg, hsl(260 85% 55%), hsl(290 85% 55%), hsl(220 85% 55%))", backgroundSize: "200% 200%" }}
                          >
                            <span className="absolute inset-0 shine-sweep opacity-60" />
                            <Share2 className={`${isGrid ? "w-3 h-3" : "w-3.5 h-3.5"} relative`} />
                            {!inStock && <span className="relative">Bagikan</span>}
                          </button>
                        </div>
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

      {/* Image Zoom Lightbox */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[95] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-fade-in select-none"
          onClick={() => { setZoomImage(null); setZoomScale(1); }}
        >
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/70 to-transparent">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/90 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
              <Search className="w-3.5 h-3.5" /> Zoom {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setZoomImage(null); setZoomScale(1); }}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all"
              aria-label="Tutup zoom"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Zoomable image */}
          <div className="w-full h-full overflow-auto flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoomImage}
              alt="Zoom"
              onClick={() => setZoomScale((s) => (s >= 3 ? 1 : s + 0.5))}
              className="max-w-none transition-transform duration-300 ease-out cursor-zoom-in shadow-2xl rounded-lg"
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: "center center",
                maxHeight: zoomScale === 1 ? "85vh" : "none",
                maxWidth: zoomScale === 1 ? "95vw" : "none",
              }}
              draggable={false}
            />
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setZoomScale((s) => Math.max(1, s - 0.5)); }}
                disabled={zoomScale <= 1}
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Perkecil"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoomScale(1); }}
                className="px-4 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold hover:bg-white/20 active:scale-95 transition-all"
              >
                Reset
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoomScale((s) => Math.min(4, s + 0.5)); }}
                disabled={zoomScale >= 4}
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Perbesar"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <p className="text-center text-[10px] text-white/60 mt-2 font-medium">Tap gambar untuk zoom • Tap luar untuk tutup</p>
          </div>
        </div>
      )}


        {tab === "history" && (
          <div className="space-y-4 animate-fade-in">
            {/* Hero Header - iOS Frosted Glass */}
            <div className="relative overflow-hidden rounded-[24px] bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.18)]">
              <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-blue-500/12 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-indigo-500/12 blur-3xl" />

              <div className="relative flex items-center gap-3 p-4">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-2xl blur-md opacity-60" style={{ background: "rgba(59,130,246,0.5)" }} />
                  <div
                    className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white"
                    style={{ boxShadow: "0 8px 20px -4px rgba(59,130,246,0.55), inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
                  >
                    <Clock className="w-6 h-6" strokeWidth={2.2} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[17px] font-bold tracking-tight text-foreground">{t("history.title", lang)}</h2>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[12px] mt-0.5 font-medium">{history.length} klaim voucher tercatat</p>
                </div>
              </div>
            </div>

            {/* Stats Summary - iOS Style */}
            {history.length > 0 && (() => {
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const weekAgo = new Date(today.getTime() - 7 * 86400000);
              const todayCount = history.filter(h => new Date(h.claimed_at) >= today).length;
              const weekCount = history.filter(h => new Date(h.claimed_at) >= weekAgo).length;
              return (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Total", value: history.length, icon: Award, accent: "from-blue-500 to-indigo-500", glow: "59,130,246" },
                    { label: "Hari Ini", value: todayCount, icon: CalendarDays, accent: "from-emerald-500 to-green-500", glow: "16,185,129" },
                    { label: "7 Hari", value: weekCount, icon: TrendingUp, accent: "from-pink-500 to-rose-500", glow: "236,72,153" },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.label}
                        className="relative overflow-hidden rounded-2xl p-3 bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15"
                        style={{ boxShadow: `0 8px 24px -8px rgba(${s.glow},0.25), inset 0 1px 0 0 rgba(255,255,255,0.12)` }}
                      >
                        <div
                          className={`relative w-7 h-7 rounded-xl bg-gradient-to-br ${s.accent} flex items-center justify-center text-white mb-1.5`}
                          style={{ boxShadow: `0 4px 12px -2px rgba(${s.glow},0.5), inset 0 1px 0 0 rgba(255,255,255,0.25)` }}
                        >
                          <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                        </div>
                        <p className="text-[20px] font-bold tabular-nums leading-none text-foreground tracking-tight"><CountUp value={s.value} /></p>
                        <p className="text-muted-foreground text-[11px] font-medium mt-1">{s.label}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {history.length > 0 && (
              <div className="relative overflow-hidden rounded-2xl bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 p-3 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.12)]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={toggleSelectAll}
                    className="gap-1.5 text-[12px] rounded-full font-semibold bg-white/[0.06] text-foreground hover:bg-white/[0.1] border border-white/15 active:scale-95 transition-transform"
                  >
                    <Checkbox checked={history.length > 0 && selectedHistoryIds.size === history.length} className="pointer-events-none" />
                    Pilih Semua ({selectedHistoryIds.size}/{history.length})
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setSmartHistory(v => !v)}
                      className={`gap-1 rounded-full text-[12px] font-semibold transition-all active:scale-95 ${smartHistory ? "bg-foreground text-background hover:bg-foreground/90" : "bg-white/[0.06] text-foreground hover:bg-white/[0.1] border border-white/15"}`}
                    >
                      <Lightbulb className="w-3 h-3" strokeWidth={2.2} /> Pintar
                    </Button>
                    <Button
                      size="sm"
                      onClick={downloadHistoryPDF}
                      className="gap-1 rounded-full text-[12px] font-semibold bg-white/[0.06] text-foreground hover:bg-white/[0.1] border border-white/15 active:scale-95 transition-transform"
                    >
                      <Download className="w-3 h-3" /> PDF
                    </Button>
                    <Button
                      size="sm"
                      onClick={downloadHistoryTXT}
                      className="gap-1 rounded-full text-[12px] font-semibold bg-white/[0.06] text-foreground hover:bg-white/[0.1] border border-white/15 active:scale-95 transition-transform"
                    >
                      <FileText className="w-3 h-3" /> TXT
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {history.length === 0 && (
              <div className="relative overflow-hidden rounded-[24px] bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.18)] text-center py-14 px-6">
                <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl" />
                <div
                  className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/30 via-indigo-500/20 to-purple-500/30 flex items-center justify-center mx-auto mb-4"
                  style={{ boxShadow: "0 10px 30px -8px rgba(59,130,246,0.4), inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
                >
                  <Clock className="w-10 h-10 text-blue-300/80" />
                </div>
                <p className="relative text-[15px] font-semibold text-foreground tracking-tight">Belum ada riwayat klaim</p>
                <p className="relative text-[12px] text-muted-foreground mt-1">Klaim voucher untuk melihat riwayat di sini</p>
                <Button
                  size="sm"
                  className="relative mt-4 gap-1.5 rounded-full font-semibold bg-foreground text-background hover:bg-foreground/90 active:scale-95 transition-transform shadow-md"
                  onClick={() => setTab("voucher")}
                >
                  <Ticket className="w-4 h-4" /> Klaim Voucher
                </Button>
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
                      className="relative overflow-hidden rounded-2xl bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 transition-all duration-200 active:scale-[0.99]"
                      style={{ boxShadow: "0 8px 24px -10px rgba(59,130,246,0.25), inset 0 1px 0 0 rgba(255,255,255,0.12)" }}
                    >
                      {/* Top Bar - iOS style */}
                      <div className="relative flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.08]">
                        <div className="flex items-center gap-2.5">
                          <Checkbox
                            checked={selectedHistoryIds.has(h.id)}
                            onCheckedChange={() => toggleHistorySelect(h.id)}
                            className="border-white/30 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                          />
                          <span className="text-[12px] font-semibold text-foreground tracking-tight">#{globalIdx + 1}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Selesai
                          </span>
                        </div>
                        <span className="text-[10.5px] font-mono font-semibold text-foreground/80 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/10">{h.token_code}</span>
                      </div>

                      <div className="p-3.5 space-y-2.5">
                        {/* Product row */}
                        <div className="flex items-center gap-3">
                          {h.product_image ? (
                            <img
                              src={h.product_image}
                              className="w-12 h-12 rounded-2xl object-cover border border-white/15 shadow-[0_4px_10px_-2px_rgba(0,0,0,0.3)]"
                              alt=""
                            />
                          ) : (
                            <div
                              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white"
                              style={{ boxShadow: "0 6px 14px -4px rgba(59,130,246,0.55), inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
                            >
                              <Crown className="w-6 h-6" strokeWidth={2.2} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[14px] text-foreground tracking-tight line-clamp-1">{h.product_title}</h3>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="w-2.5 h-2.5" /> {new Date(h.claimed_at).toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>

                        {/* Device info chip */}
                        <div className="flex items-start gap-2 text-[11.5px] text-foreground/80 bg-white/[0.04] rounded-xl p-2.5 border border-white/10">
                          <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                          <span className="leading-relaxed break-words font-medium">{deviceSummary}</span>
                        </div>

                        {/* Account fields */}
                        {h.fields.length > 0 && (
                          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                              <Shield className="w-3 h-3" /> Detail Akun
                            </p>
                            {h.fields.map((f, i) => {
                              const fid = `h-${h.id}-${i}`;
                              const copied = copiedField === fid;
                              return (
                                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.06] last:border-0">
                                  <span className="text-[12px] text-muted-foreground font-medium">{f.field_name}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[12px] font-mono font-semibold text-foreground max-w-[120px] truncate">{f.field_value}</span>
                                    <button
                                      onClick={() => copyText(f.field_value, fid)}
                                      className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full transition-all active:scale-95 ${copied ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-white/[0.08] text-foreground border border-white/15 hover:bg-white/[0.14]'}`}
                                    >
                                      {copied ? '✓ OK' : (<><Copy className="w-2.5 h-2.5 inline mr-0.5" />Salin</>)}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {totalHistoryPages > 1 && (
                  <div className="relative overflow-hidden rounded-2xl bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 p-3 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.12)]">
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        size="icon"
                        className="rounded-full bg-white/[0.06] border border-white/15 text-foreground hover:bg-white/[0.12] disabled:opacity-30 active:scale-95 transition-transform"
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-[13px] font-semibold tabular-nums text-foreground tracking-tight">{historyPage} / {totalHistoryPages}</span>
                      <Button
                        size="icon"
                        className="rounded-full bg-white/[0.06] border border-white/15 text-foreground hover:bg-white/[0.12] disabled:opacity-30 active:scale-95 transition-transform"
                        disabled={historyPage >= totalHistoryPages}
                        onClick={() => setHistoryPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
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
                {/* Hero Header - iOS Style Frosted */}
                <div className="relative overflow-hidden rounded-[24px] bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.18)]">
                  <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-orange-500/12 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-pink-500/12 blur-3xl" />

                  <div className="relative flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className="absolute inset-0 rounded-2xl blur-md opacity-60"
                          style={{ background: "rgba(251,146,60,0.5)" }}
                        />
                        <div
                          className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-pink-500 flex items-center justify-center text-white"
                          style={{ boxShadow: "0 8px 20px -4px rgba(251,146,60,0.55), inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
                        >
                          <AlertCircle className="w-6 h-6" strokeWidth={2.2} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-[17px] font-bold tracking-tight text-foreground">{t("ticket.title", lang)}</h2>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 24/7
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[12px] mt-0.5 font-medium">{tickets.length} tiket dukungan</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setTicketView("create")}
                      className="gap-1.5 rounded-full text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 active:scale-95 transition-transform shadow-md"
                    >
                      <Send className="w-3.5 h-3.5" strokeWidth={2.2} /> Buat
                    </Button>
                  </div>
                </div>
                {/* Smart Mode Toggle - iOS Segmented */}
                {tickets.length > 0 && (
                  <div className="flex items-center justify-between gap-2 px-1">
                    <div className="text-[12px] text-muted-foreground font-medium">
                      {smartTickets ? "Mode Pintar" : "Tampilan klasik"}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setSmartTickets(v => !v)}
                      className={`gap-1 rounded-full text-[12px] font-semibold transition-all active:scale-95 ${smartTickets ? "bg-foreground text-background hover:bg-foreground/90" : "bg-white/10 text-foreground hover:bg-white/15 border border-white/15"}`}
                    >
                      <Lightbulb className="w-3 h-3" strokeWidth={2.2} /> Pintar
                    </Button>
                  </div>
                )}

                {tickets.length === 0 && (
                  <div className="relative overflow-hidden rounded-[24px] bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.18)] text-center py-14 px-6">
                    <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-orange-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-pink-500/10 blur-3xl" />
                    <div
                      className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500/30 via-amber-500/20 to-pink-500/30 flex items-center justify-center mx-auto mb-4"
                      style={{ boxShadow: "0 10px 30px -8px rgba(251,146,60,0.4), inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
                    >
                      <Inbox className="w-10 h-10 text-orange-300/80" />
                    </div>
                    <p className="relative text-[15px] font-semibold text-foreground tracking-tight">Belum ada tiket</p>
                    <p className="relative text-[12px] text-muted-foreground mt-1">Hubungi kami jika ada kendala</p>
                    <Button
                      size="sm"
                      className="relative mt-4 gap-1.5 rounded-full font-semibold bg-foreground text-background hover:bg-foreground/90 active:scale-95 transition-transform shadow-md"
                      onClick={() => setTicketView("create")}
                    >
                      <Send className="w-4 h-4" /> Ajukan Keluhan
                    </Button>
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
                    {/* Stats Summary - iOS Style */}
                    {(() => {
                      const openCount = tickets.filter(t => t.status === "open").length;
                      const closedCount = tickets.filter(t => t.status !== "open").length;
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Total", value: tickets.length, icon: Inbox, accent: "from-orange-500 to-amber-500", glow: "251,146,60" },
                            { label: "Terbuka", value: openCount, icon: Activity, accent: "from-cyan-500 to-blue-500", glow: "34,211,238" },
                            { label: "Selesai", value: closedCount, icon: CheckCircle2, accent: "from-emerald-500 to-green-500", glow: "16,185,129" },
                          ].map((s) => {
                            const Icon = s.icon;
                            return (
                              <div
                                key={s.label}
                                className="relative overflow-hidden rounded-2xl p-3 bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15"
                                style={{ boxShadow: `0 8px 24px -8px rgba(${s.glow},0.25), inset 0 1px 0 0 rgba(255,255,255,0.12)` }}
                              >
                                <div
                                  className={`relative w-7 h-7 rounded-xl bg-gradient-to-br ${s.accent} flex items-center justify-center text-white mb-1.5`}
                                  style={{ boxShadow: `0 4px 12px -2px rgba(${s.glow},0.5), inset 0 1px 0 0 rgba(255,255,255,0.25)` }}
                                >
                                  <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                                </div>
                                <p className="text-[20px] font-bold tabular-nums leading-none text-foreground tracking-tight"><CountUp value={s.value} /></p>
                                <p className="text-muted-foreground text-[11px] font-medium mt-1">{s.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {tickets.map(t => {
                      const catInfo = TICKET_CATEGORIES.find(c => c.value === (t as any).category) || TICKET_CATEGORIES[TICKET_CATEGORIES.length - 1];
                      const isOpen = t.status === "open";
                      const accentGlow = isOpen ? "251,146,60" : "16,185,129";
                      return (
                        <div
                          key={t.id}
                          onClick={() => { setActiveTicket(t); setTicketView("chat"); }}
                          className="relative overflow-hidden rounded-2xl bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 cursor-pointer active:scale-[0.99] hover:bg-white/[0.04] transition-all duration-200"
                          style={{ boxShadow: `0 8px 24px -10px rgba(${accentGlow},0.3), inset 0 1px 0 0 rgba(255,255,255,0.12)` }}
                        >
                          <div className="p-3.5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`relative shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${isOpen ? "from-orange-500 to-pink-500" : "from-emerald-500 to-cyan-500"} flex items-center justify-center text-white`}
                                  style={{ boxShadow: `0 4px 12px -2px rgba(${accentGlow},0.5), inset 0 1px 0 0 rgba(255,255,255,0.25)` }}
                                >
                                  <AlertCircle className="w-4 h-4" strokeWidth={2.4} />
                                </div>
                                <span className="font-semibold text-[14px] text-foreground tracking-tight">Tiket #{t.ticket_number}</span>
                              </div>
                              <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${isOpen ? "bg-orange-500/15 text-orange-500 border border-orange-500/25" : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25"}`}>
                                {isOpen ? <><span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Terbuka</> : <><CheckCircle2 className="w-2.5 h-2.5" /> Ditutup</>}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full font-medium bg-white/[0.06] text-foreground/80 border border-white/10">
                                <Tag className="w-2.5 h-2.5" /> {catInfo.label}
                              </span>
                            </div>
                            <p className="text-[12.5px] text-muted-foreground line-clamp-2 leading-relaxed">{t.description}</p>
                            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/[0.06]">
                              <p className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {new Date(t.created_at).toLocaleString("id-ID")}
                              </p>
                              <span className="text-[11px] font-semibold text-foreground/80 flex items-center gap-0.5">
                                Buka <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
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
                {/* === Header keren: gradient + glass === */}
                <div className="relative overflow-hidden rounded-[22px] border border-white/15 bg-gradient-to-br from-violet-600/25 via-fuchsia-500/15 to-cyan-500/20 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.18)]">
                  <div className="pointer-events-none absolute -top-12 -right-10 w-36 h-36 rounded-full bg-fuchsia-400/25 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-12 -left-10 w-36 h-36 rounded-full bg-cyan-400/25 blur-3xl" />
                  <div className="relative flex items-center gap-2 p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full bg-white/10 hover:bg-white/20 text-foreground h-9 w-9 shrink-0 backdrop-blur-md"
                      onClick={() => { setTicketView("list"); setActiveTicket(null); }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 blur-md opacity-60" />
                      <div
                        className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 flex items-center justify-center text-white"
                        style={{ boxShadow: "0 8px 20px -4px rgba(168,85,247,0.55), inset 0 1px 0 0 rgba(255,255,255,0.3)" }}
                      >
                        <MessageCircle className="w-5 h-5" strokeWidth={2.4} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-[14px] font-extrabold tracking-tight truncate">Tiket #{activeTicket.ticket_number}</h2>
                        <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black border ${
                          activeTicket.status === "open"
                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${activeTicket.status === "open" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                          {activeTicket.status === "open" ? "Terbuka" : "Ditutup"}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground truncate">Chat dengan {STORE_NAME}</p>
                    </div>
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
                  className="bg-gradient-to-b from-background/40 to-background/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.08)] h-[55vh]"
                  scrollClassName="max-h-full"
                  headerSlot={
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-cyan-500/10 backdrop-blur-xl p-3 text-[11.5px] space-y-1.5">
                      <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-violet-500/15 blur-3xl" />
                      <div className="relative space-y-1.5">
                        {activeTicket.category && (
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-500 font-black text-[9px] uppercase tracking-wider">Kategori</span>
                            <span className="font-semibold text-foreground">{TICKET_CATEGORIES.find(c => c.value === activeTicket.category)?.label || activeTicket.category}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-500 font-black text-[9px] uppercase tracking-wider">Nama</span>
                          <span className="font-semibold text-foreground truncate">{activeTicket.name}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 font-black text-[9px] uppercase tracking-wider">HP</span>
                          <span className="font-semibold text-foreground">{activeTicket.phone}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-fuchsia-500/15 text-fuchsia-500 font-black text-[9px] uppercase tracking-wider">Masalah</span>
                          <span className="text-foreground/90 leading-snug">{activeTicket.description}</span>
                        </div>
                        {activeTicket.screenshot_url && (
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <p className="font-black mb-1.5 text-[10px] flex items-center gap-1 text-amber-500">📸 Screenshot Bukti</p>
                            <img src={activeTicket.screenshot_url} alt="Screenshot bukti" className="max-w-full rounded-xl border border-white/15 shadow-lg" />
                          </div>
                        )}
                      </div>
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
                  setHasPin(false);
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

                {/* Account Actions Card - iOS Frosted */}
                <div className="relative overflow-hidden rounded-[24px] bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.18)]">
                  <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-cyan-400/12 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-purple-500/12 blur-3xl" />

                  <div className="relative p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 blur-md opacity-50" />
                          <div
                            className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-white text-[15px] font-bold"
                            style={{ boxShadow: "0 8px 20px -4px rgba(34,211,238,0.5), inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
                          >
                            {userBalance.username[0]?.toUpperCase()}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10.5px] text-muted-foreground font-medium">Akun</p>
                          <p className="text-[14px] font-semibold text-foreground truncate tracking-tight flex items-center gap-1">
                            {userBalance.username}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{userBalance.phone}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:opacity-90 active:scale-95 transition-transform shadow-md shrink-0"
                        onClick={() => { if (banned) return; setShowDepositModal(true); setDepositStep("method"); }}
                        disabled={banned}
                      >
                        <ArrowUpCircle className="w-4 h-4" /> {t("deposit.btn", lang)}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { if (banned) return; setProfileUsername(userBalance.username); setProfilePhone(userBalance.phone); setShowProfileModal(true); }}
                        disabled={banned}
                        className="flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] active:scale-[0.97] text-[12.5px] font-semibold text-foreground transition-all disabled:opacity-50"
                        style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.08)" }}
                      >
                        <Edit2 className="w-4 h-4 text-cyan-400" strokeWidth={2.2} /> Edit Profil
                      </button>
                      {!hasPin ? (
                        <button
                          onClick={() => { if (banned) return; setShowPinSetup(true); }}
                          disabled={banned}
                          className="flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] active:scale-[0.97] text-[12.5px] font-semibold text-foreground transition-all disabled:opacity-50"
                          style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.08)" }}
                        >
                          <Lock className="w-4 h-4 text-purple-400" strokeWidth={2.2} /> Buat PIN
                        </button>
                      ) : (
                        <button
                          onClick={() => { if (banned) return; setShowForgotPin(true); }}
                          disabled={banned}
                          className="flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] active:scale-[0.97] text-[12.5px] font-semibold text-foreground transition-all disabled:opacity-50"
                          style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.08)" }}
                        >
                          <KeyRound className="w-4 h-4 text-amber-400" strokeWidth={2.2} /> Reset PIN
                        </button>
                      )}
                    </div>

                    {hasPin && (
                      <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-2.5 text-[12px]">
                        <div className="relative shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center"
                          style={{ boxShadow: "0 4px 10px -2px rgba(16,185,129,0.5), inset 0 1px 0 0 rgba(255,255,255,0.25)" }}>
                          <Lock className="w-3 h-3 text-white" strokeWidth={2.4} />
                        </div>
                        <span className="font-semibold text-emerald-500">PIN Aktif</span>
                        <span className="text-muted-foreground text-[11px]">Pembelian dilindungi PIN</span>
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
                    setHasPin(false);
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
                    {/* Deposit History Header - iOS Frosted */}
                    <div className="relative overflow-hidden rounded-[20px] bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                      <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full bg-emerald-500/10 blur-3xl" />
                      <div className="relative p-3.5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="relative w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white"
                              style={{ boxShadow: "0 4px 10px -2px rgba(16,185,129,0.5), inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
                            >
                              <History className="w-3.5 h-3.5" strokeWidth={2.4} />
                            </div>
                            <h3 className="text-[13px] font-bold tracking-tight text-foreground">{t("deposit.history", lang)}</h3>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 text-[10px] font-semibold">{filteredDeposits.length}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <select className="rounded-xl bg-white/[0.06] border border-white/10 px-2 py-2 text-[11px] font-medium text-foreground focus:border-cyan-400/50 focus:outline-none transition-colors" value={depositHistoryMethodFilter} onChange={e => setDepositHistoryMethodFilter(e.target.value as DepositMethodFilter)}>
                            <option value="all">Semua Metode</option>
                            <option value="qris">QRIS</option>
                            <option value="ewallet">E-Wallet</option>
                          </select>
                          <select className="rounded-xl bg-white/[0.06] border border-white/10 px-2 py-2 text-[11px] font-medium text-foreground focus:border-purple-400/50 focus:outline-none transition-colors" value={depositHistoryStatusFilter} onChange={e => setDepositHistoryStatusFilter(e.target.value as DepositStatusFilter)}>
                            <option value="all">Semua Status</option>
                            <option value="pending">Belum Konfirmasi</option>
                            <option value="approved">Disetujui</option>
                            <option value="rejected">Ditolak</option>
                            <option value="cancelled">Dibatalkan</option>
                          </select>
                          <select className="rounded-xl bg-white/[0.06] border border-white/10 px-2 py-2 text-[11px] font-medium text-foreground focus:border-emerald-400/50 focus:outline-none transition-colors" value={depositHistorySort} onChange={e => setDepositHistorySort(e.target.value as "newest" | "oldest")}>
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
                          className="relative w-full text-left overflow-hidden rounded-2xl bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 active:scale-[0.99] hover:bg-white/[0.04] transition-all duration-200"
                          style={{ boxShadow: `0 8px 24px -10px rgba(${accent.glow},0.3), inset 0 1px 0 0 rgba(255,255,255,0.12)` }}
                        >
                          <div className="relative p-3 flex items-center gap-3">
                            <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-15 blur-2xl" style={{ background: `rgba(${accent.glow},1)` }} />
                            <div
                              className={`relative shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br ${accent.color} flex items-center justify-center text-white`}
                              style={{ boxShadow: `0 6px 16px -4px rgba(${accent.glow},0.55), inset 0 1px 0 0 rgba(255,255,255,0.25)` }}
                            >
                              {accent.icon}
                            </div>
                            <div className="flex-1 min-w-0 relative">
                              <p className="font-semibold text-[14px] text-foreground tracking-tight">{formatPrice(dep.amount)}</p>
                              <p className="text-[10.5px] text-muted-foreground font-mono truncate">{dep.trx_id}</p>
                              <p className="text-[10.5px] text-muted-foreground">{dep.payment_method.toUpperCase()} • {new Date(dep.created_at).toLocaleString("id-ID")}</p>
                            </div>
                            <span className={`relative shrink-0 text-[10px] px-2.5 py-1 rounded-full font-semibold bg-gradient-to-r ${accent.color} text-white`}
                              style={{ boxShadow: `0 4px 10px -2px rgba(${accent.glow},0.4)` }}>
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

                {/* Transaction History - iOS Frosted Header */}
                <div className="relative overflow-hidden rounded-[20px] bg-background/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                  <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full bg-purple-500/10 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-pink-500/10 blur-3xl" />
                  <div className="relative p-3.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="relative w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-400 flex items-center justify-center text-white"
                          style={{ boxShadow: "0 4px 10px -2px rgba(168,85,247,0.5), inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
                        >
                          <History className="w-3.5 h-3.5" strokeWidth={2.4} />
                        </div>
                        <h3 className="text-[13px] font-bold tracking-tight text-foreground">{t("balance.transaction_history", lang)}</h3>
                        {balanceTransactions.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-400 text-[10px] font-semibold">{balanceTransactions.length}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {balanceTransactions.length > 0 && (
                          <button
                            onClick={() => setSmartSaldo(v => !v)}
                            className={`flex items-center gap-1 text-[11px] h-7 px-2.5 rounded-full font-semibold transition-all active:scale-95 ${smartSaldo ? "bg-foreground text-background" : "bg-white/[0.08] text-foreground border border-white/10 hover:bg-white/[0.12]"}`}
                          >
                            <Sparkles className="w-3 h-3" /> Pintar
                          </button>
                        )}
                        {balanceTransactions.length > 0 && !smartSaldo && (
                          <button
                            onClick={() => setShowTxExport(!showTxExport)}
                            className={`flex items-center gap-1 text-[11px] h-7 px-2.5 rounded-full font-semibold transition-all active:scale-95 ${showTxExport ? "bg-foreground text-background" : "bg-white/[0.08] text-foreground border border-white/10 hover:bg-white/[0.12]"}`}
                          >
                            <Download className="w-3 h-3" /> {showTxExport ? "Tutup" : "Ekspor"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {showTxExport && !smartSaldo && balanceTransactions.length > 0 && (
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
                      onClick={async () => {
                        const selected = balanceTransactions.filter(tx => selectedTxIds.has(tx.id));
                        if (selected.length === 0) return;
                        const [logoData, qrisData] = await Promise.all([
                          loadPdfImage("/icons/icon-192.png"),
                          loadPdfImage(storeQris),
                        ]);
                        const doc = new jsPDF();
                        const autoTable = (await import("jspdf-autotable")).default;
                        const pageW = doc.internal.pageSize.getWidth();
                        const pageH = doc.internal.pageSize.getHeight();
                        // ===== HEADER GRADIENT (faux) =====
                        const headerH = 46;
                        // Base color
                        doc.setFillColor(41, 98, 255);
                        doc.rect(0, 0, pageW, headerH, "F");
                        // Faux gradient overlay (strips makin transparan)
                        for (let i = 0; i < 24; i++) {
                          doc.setFillColor(99, 102, 241, 255 - i * 8);
                          doc.rect(0, i * (headerH / 24), pageW, headerH / 24 + 0.4, "F");
                        }
                        // Decorative circles
                        doc.setFillColor(255, 255, 255);
                        doc.circle(pageW - 50, -8, 22, "F");
                        doc.circle(pageW - 70, headerH + 4, 14, "F");
                        // Logo bulat (QRIS)
                        if (qrisData) {
                          doc.setFillColor(255, 255, 255);
                          doc.circle(20, headerH / 2, 11, "F");
                          try { doc.addImage(qrisData, "JPEG", 11, headerH / 2 - 9, 18, 18); } catch {}
                        }
                        // Title
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(18);
                        doc.setFont("helvetica", "bold");
                        doc.text(STORE_NAME, 36, 18);
                        doc.setFontSize(10);
                        doc.setFont("helvetica", "normal");
                        doc.text("Riwayat Transaksi Saldo Resmi", 36, 25);
                        doc.setFontSize(7.5);
                        doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")} WIB`, 36, 31);
                        doc.text(`Total: ${selected.length} transaksi`, 36, 36);
                        // Tagline pill
                        doc.setFillColor(255, 255, 255);
                        doc.roundedRect(36, 39, 38, 5, 2.5, 2.5, "F");
                        doc.setTextColor(41, 98, 255);
                        doc.setFontSize(6.5);
                        doc.setFont("helvetica", "bold");
                        doc.text("MURAH & TERPERCAYA", 55, 42.5, { align: "center" });
                        // QRIS kanan
                        if (qrisData) {
                          doc.setFillColor(255, 255, 255);
                          doc.roundedRect(pageW - 36, 4, 32, 38, 2, 2, "F");
                          try { doc.addImage(qrisData, "JPEG", pageW - 34, 6, 28, 28); } catch {}
                          doc.setTextColor(41, 98, 255);
                          doc.setFontSize(6);
                          doc.setFont("helvetica", "bold");
                          doc.text("SCAN QRIS", pageW - 20, 39, { align: "center" });
                        }

                        // ===== RINGKASAN CARDS =====
                        const totalIn = selected.filter(t => t.type === "topup").reduce((s, t) => s + t.amount, 0);
                        const totalOut = selected.filter(t => t.type !== "topup").reduce((s, t) => s + t.amount, 0);
                        const cardY = 52;
                        const cardW = (pageW - 30) / 3;
                        // Card 1 - Total
                        doc.setFillColor(239, 246, 255);
                        doc.setDrawColor(191, 219, 254);
                        doc.roundedRect(10, cardY, cardW, 16, 2, 2, "FD");
                        doc.setTextColor(100, 116, 139);
                        doc.setFontSize(7);
                        doc.setFont("helvetica", "bold");
                        doc.text("TOTAL TRANSAKSI", 13, cardY + 5);
                        doc.setTextColor(30, 41, 59);
                        doc.setFontSize(13);
                        doc.text(String(selected.length), 13, cardY + 13);
                        // Card 2 - Masuk
                        doc.setFillColor(236, 253, 245);
                        doc.setDrawColor(167, 243, 208);
                        doc.roundedRect(15 + cardW, cardY, cardW, 16, 2, 2, "FD");
                        doc.setTextColor(100, 116, 139);
                        doc.setFontSize(7);
                        doc.text("DANA MASUK", 18 + cardW, cardY + 5);
                        doc.setTextColor(5, 150, 105);
                        doc.setFontSize(11);
                        doc.text(`+${formatPrice(totalIn)}`, 18 + cardW, cardY + 13);
                        // Card 3 - Keluar
                        doc.setFillColor(254, 242, 242);
                        doc.setDrawColor(254, 202, 202);
                        doc.roundedRect(20 + cardW * 2, cardY, cardW, 16, 2, 2, "FD");
                        doc.setTextColor(100, 116, 139);
                        doc.setFontSize(7);
                        doc.text("DANA KELUAR", 23 + cardW * 2, cardY + 5);
                        doc.setTextColor(220, 38, 38);
                        doc.setFontSize(11);
                        doc.text(`-${formatPrice(totalOut)}`, 23 + cardW * 2, cardY + 13);

                        // ===== PERINGATAN PENTING =====
                        const warnY = 72;
                        doc.setFillColor(254, 252, 232);
                        doc.setDrawColor(234, 179, 8);
                        doc.setLineWidth(0.5);
                        doc.roundedRect(10, warnY, pageW - 20, 28, 2, 2, "FD");
                        // Strip kiri
                        doc.setFillColor(234, 179, 8);
                        doc.rect(10, warnY, 1.5, 28, "F");
                        doc.setTextColor(146, 64, 14);
                        doc.setFontSize(9);
                        doc.setFont("helvetica", "bold");
                        doc.text("⚠ PERINGATAN PENTING - BACA SEBELUM TRANSAKSI", 14, warnY + 5);
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(7);
                        doc.setTextColor(60, 60, 60);
                        const warnLines = [
                          "• File PDF ini hanya tampilan/ekspos riwayat — BUKAN bukti pembayaran resmi pihak ketiga.",
                          "• Transaksi produk SPONSOR: penipuan DI LUAR tanggung jawab admin Agung Adi Store. Kendala? Hubungi admin sponsor / pakai Rekber via WhatsApp.",
                          "• Hanya transaksi produk RESMI Agung Adi Store yang dijamin & dapat diklaim ke admin (WA: 085769302532).",
                        ];
                        let wy = warnY + 10;
                        warnLines.forEach((ln) => {
                          const wrapped = doc.splitTextToSize(ln, pageW - 28);
                          doc.text(wrapped, 14, wy);
                          wy += wrapped.length * 2.8;
                        });
                        doc.setTextColor(0, 0, 0);

                        // ===== TABEL =====
                        autoTable(doc, {
                          startY: 104,
                          head: [["#", "ID Transaksi", "Tipe", "Jumlah", "Tanggal", "Deskripsi"]],
                          body: selected.map((tx, idx) => [
                            String(idx + 1),
                            tx.trx_id || "-",
                            tx.type === "topup" ? "Top Up" : "Pembelian",
                            `${tx.type === "topup" ? "+" : "-"}${formatPrice(tx.amount)}`,
                            new Date(tx.created_at).toLocaleString("id-ID"),
                            tx.description || "-",
                          ]),
                          styles: {
                            fontSize: 8,
                            cellPadding: 2.5,
                            lineColor: [226, 232, 240],
                            lineWidth: 0.1,
                            textColor: [30, 41, 59],
                          },
                          headStyles: {
                            fillColor: [41, 98, 255],
                            textColor: 255,
                            fontStyle: "bold",
                            fontSize: 8.5,
                            cellPadding: 3,
                            lineColor: [41, 98, 255],
                            lineWidth: 0,
                          },
                          alternateRowStyles: { fillColor: [248, 250, 252] },
                          columnStyles: {
                            0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
                            1: { cellWidth: 38, font: "courier", fontSize: 7 },
                            2: { cellWidth: 20, halign: "center" },
                            3: { cellWidth: 24, halign: "right", fontStyle: "bold" },
                            4: { cellWidth: 32, fontSize: 7 },
                            5: { cellWidth: "auto" },
                          },
                          didParseCell: (data) => {
                            if (data.section === "body" && data.column.index === 3) {
                              const isTopup = String(data.cell.raw).startsWith("+");
                              data.cell.styles.textColor = isTopup ? [5, 150, 105] : [220, 38, 38];
                            }
                          },
                          didDrawPage: (data) => {
                            // Footer band
                            doc.setFillColor(41, 98, 255);
                            doc.rect(0, pageH - 14, pageW, 14, "F");
                            doc.setTextColor(255, 255, 255);
                            doc.setFontSize(7.5);
                            doc.setFont("helvetica", "bold");
                            doc.text(`${STORE_NAME}`, 10, pageH - 8);
                            doc.setFont("helvetica", "normal");
                            doc.text(`WA: ${WA_NUMBER} • Murah & Terpercaya`, 10, pageH - 3.5);
                            doc.text(`Halaman ${data.pageNumber}`, pageW - 10, pageH - 5.5, { align: "right" });
                          },
                          margin: { top: 104, bottom: 18 },
                        });
                        if (userBalance) {
                          const finalY = (doc as any).lastAutoTable.finalY + 6;
                          doc.setFontSize(9);
                          doc.setTextColor(0, 0, 0);
                          doc.text(`Username: ${userBalance.username}  |  Total: ${selected.length} transaksi`, 14, finalY);
                        }
                        const defName2 = "riwayat-transaksi-saldo";
                        const inp2 = window.prompt("Masukkan nama file PDF (tanpa .pdf):", defName2);
                        if (inp2 === null) return;
                        const safe2 = (inp2.trim() || defName2).replace(/[\\/:*?"<>|]+/g, "_");
                        doc.save(`${safe2}.pdf`);
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
                  const sourceLabel = (type: string) => {
                    if (type === "topup_bonus") return "💎 Saldo IN";
                    if (type === "topup") return "💰 Saldo Utama (Top Up)";
                    if (isIncomeTx(type)) return "💰 Saldo Utama";
                    return "💰 Saldo Utama (Pembelian)";
                  };
                  const txItems: HistoryItem[] = balanceTransactions.map(tx => {
                    const income = isIncomeTx(tx.type);
                    const src = sourceLabel(tx.type);
                    const desc = tx.description || (tx.trx_id ? `ID: ${tx.trx_id}` : "-");
                    return {
                      id: `tx-${tx.id}`,
                      title: getTxLabel(tx.type, lang),
                      subtitle: `${src}  •  ${desc}`,
                      amount: income ? Math.abs(tx.amount) : -Math.abs(tx.amount),
                      date: tx.created_at,
                      category: tx.type === "topup_bonus" ? "Saldo IN" : income ? "Top Up" : "Pembelian",
                      meta: { trx_id: tx.trx_id || "", sumber: src },
                    };
                  });
                  const depItems: HistoryItem[] = deposits.map(dp => {
                    const statusLabel: Record<string, string> = {
                      pending: "⏳ Menunggu",
                      approved: "✅ Disetujui",
                      cancelled: "❌ Dibatalkan",
                      rejected: "❌ Ditolak",
                    };
                    const st = statusLabel[dp.status] || dp.status;
                    return {
                      id: `dp-${dp.id}`,
                      title: `🏦 Deposit ${(dp.payment_method || "").toUpperCase()}`,
                      subtitle: `🧾 Deposit  •  ${st}  •  ${dp.trx_id || dp.id.slice(0, 8)}${dp.cancel_reason ? "  •  " + dp.cancel_reason : ""}`,
                      amount: Math.abs(dp.amount),
                      date: dp.created_at,
                      category: "Deposit",
                      meta: { trx_id: dp.trx_id || "", status: dp.status, deposit_amount: dp.amount },
                    };
                  });
                  const items: HistoryItem[] = [...txItems, ...depItems];
                  const renderTx = (it: HistoryItem) => {
                    if (it.id.startsWith("dp-")) {
                      const dp = deposits.find(d => `dp-${d.id}` === it.id);
                      if (!dp) return null;
                      const isApproved = dp.status === "approved";
                      const isPending = dp.status === "pending";
                       return (
                         <Card className="border border-border/60 cursor-pointer transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.99]" onClick={() => setSelectedDeposit(dp)}>
                           <CardContent className="p-3 flex items-center gap-3">
                             <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isApproved ? "bg-emerald-500/15" : isPending ? "bg-amber-500/15" : "bg-rose-500/15"}`}>
                              <span className="text-lg">🏦</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm">Deposit {(dp.payment_method || "").toUpperCase()}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">ID: {dp.trx_id || dp.id.slice(0, 8)}</p>
                              <p className={`text-[10px] font-semibold ${isApproved ? "text-emerald-600" : isPending ? "text-amber-600" : "text-rose-600"}`}>
                                {isApproved ? "✅ Disetujui" : isPending ? "⏳ Menunggu" : dp.status === "cancelled" ? "❌ Dibatalkan" : "❌ Ditolak"}
                              </p>
                            </div>
                            <span className={`font-bold text-sm ${isApproved ? "text-emerald-600" : "text-muted-foreground"}`}>
                              {isApproved ? "+" : ""}{formatPrice(dp.amount)}
                            </span>
                          </CardContent>
                        </Card>
                      );
                    }
                    const tx = balanceTransactions.find(t => `tx-${t.id}` === it.id);
                    if (!tx) return null;
                    const income = isIncomeTx(tx.type);
                    const isBonus = tx.type === "topup_bonus";
                    return (
                      <Card className={`cursor-pointer transition-all hover:shadow-md border ${isBonus ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20" : "border-border/60"}`} onClick={() => setSelectedTransaction(tx)}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isBonus ? "bg-amber-500/15" : income ? "bg-accent/10" : "bg-destructive/10"}`}>
                            {isBonus ? <span className="text-lg">🎁</span> : income ? <ArrowUpCircle className="w-5 h-5 text-accent" /> : <ArrowDownCircle className="w-5 h-5 text-destructive" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{getTxLabel(tx.type, lang)}</p>
                            <p className={`text-[10px] font-semibold ${isBonus ? "text-amber-600" : "text-muted-foreground"}`}>{sourceLabel(tx.type)}</p>
                            {tx.trx_id && <p className="text-[10px] text-muted-foreground font-mono">ID: {tx.trx_id}</p>}
                            <p className="text-[10px] text-muted-foreground truncate">{tx.description || "-"}</p>
                          </div>
                          <span className={`font-bold text-sm ${isBonus ? "text-amber-600 dark:text-amber-400" : income ? "text-accent" : "text-destructive"}`}>
                            {income ? "+" : "-"}{formatPrice(tx.amount)}
                          </span>
                        </CardContent>
                      </Card>
                    );
                  };
                  return (
                    <HistoryEnhancer
                      title="Riwayat Transaksi Saldo & Deposit"
                      items={items}
                      categories={["Top Up", "Saldo IN", "Pembelian", "Deposit"]}
                      formatAmount={formatPrice}
                      exportPrefix="riwayat-saldo"
                      storeName={STORE_NAME}
                      renderItem={renderTx}
                      visitorId={activeBalanceVisitorId ?? undefined}
                      walletInfo={{
                        username: userBalance?.username,
                        email: userBalance?.email,
                        phone: userBalance?.phone,
                        balance: userBalance?.balance ?? 0,
                        gameBalance: gameBalanceAmount,
                      }}
                    />
                  );
                })()}
                {!banned && !smartSaldo && balanceTransactions.map(tx => {
                  const isTopup = isIncomeTx(tx.type);
                  const isBonus = tx.type === "topup_bonus";
                  const accent = isBonus
                    ? { color: "from-amber-400 to-orange-500", glow: "251,191,36", icon: <span className="text-xl">🎁</span> }
                    : isTopup
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
                          <p className="font-extrabold text-sm text-foreground">{getTxLabel(tx.type, lang)}</p>
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
                      {(() => { const _inc = isIncomeTx(selectedTransaction.type); const _bonus = selectedTransaction.type === "topup_bonus"; return (<>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${_bonus ? "bg-amber-500/15" : _inc ? "bg-accent/10" : "bg-destructive/10"}`}>
                        {_bonus ? <span className="text-3xl">🎁</span> : _inc ? <ArrowUpCircle className="w-8 h-8 text-accent" /> : <ArrowDownCircle className="w-8 h-8 text-destructive" />}
                      </div>
                      <p className={`text-center font-bold text-2xl ${_bonus ? "text-amber-600 dark:text-amber-400" : _inc ? "text-accent" : "text-destructive"}`}>
                        {_inc ? "+" : "-"}{formatPrice(Math.abs(selectedTransaction.amount))}
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
                          <span className="font-bold text-xs">{getTxLabel(selectedTransaction.type, lang)}</span>
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
                      </>); })()}
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

        {tab === "streakvoucher" && (
          userBalance ? (
            <NeonStreakHub key={`voucher-${activeBalanceVisitorId}`} visitorId={activeBalanceVisitorId} forcedView="voucher" />
          ) : (
            <LoginGate
              title="Streak Voucher"
              description="Login saldo untuk klaim kode voucher streak (Gem, Koin, Kredit, Hint, Freeze)."
              emoji="🎟️"
              gradient="from-pink-500 to-purple-600"
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
            <GameTab key={userBalance.visitor_id} />
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

        {tab === "botnotif" && (
          <div className="space-y-3">
            <UserWaNotifSettings key={userBalance?.visitor_id || "no-user-notif"} />
          </div>
        )}

        {tab === "anonchat" && (
          <div className="-mx-4 sm:mx-0">
            <AnonChatTab key="anon-chat" />
          </div>
        )}



        {tab === "storeai" && (
          <div className="animate-fade-in"><StoreAITab /></div>
        )}

        {tab === "confess" && (
          <div className="animate-fade-in"><ConfessTab /></div>
        )}

        {tab === "botgalau" && (
          <div className="animate-fade-in"><BotGalauTab key={visitorId || "no-v"} /></div>
        )}

        {tab === "rodadiskon" && (
          <div className="animate-fade-in space-y-3">
            <WeeklySpinEventBanner onActiveChange={setDiscountWheelEventActive} />
            {discountWheelEventActive === true && <DiscountWheelTab key={visitorId || "no-v"} />}
          </div>
        )}

        {tab === "update" && (
          <div className="space-y-4 animate-fade-in">
            {/* === MAXIMALIST HERO HEADER === */}
            <div className="relative rounded-2xl overflow-hidden p-[2px] update-aurora-bg shadow-[0_10px_40px_-10px_rgba(236,72,153,0.5)]">
              <div className="relative rounded-2xl bg-gradient-to-br from-background via-background to-background/95 p-5 overflow-hidden">
                {/* Floating emojis bg */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {['🚀','✨','🎉','💎','⚡','🔥','🌈','⭐'].map((e, i) => (
                    <span
                      key={i}
                      className="absolute text-2xl opacity-20 float-emoji"
                      style={{
                        left: `${(i * 13) % 100}%`,
                        top: `${(i * 23) % 80}%`,
                        animationDelay: `${i * 0.3}s`,
                      }}
                    >{e}</span>
                  ))}
                </div>
                <div className="relative flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl update-aurora-bg flex items-center justify-center flex-shrink-0 shadow-lg">
                    <RefreshCw className="w-7 h-7 text-white animate-spin" style={{ animationDuration: '4s' }} strokeWidth={2.4} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
                        Update Web
                      </h2>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 text-white shadow new-badge-bounce">
                        🆕 LIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                      Riwayat semua pembaruan & fitur baru aplikasi
                    </p>
                  </div>
                </div>

                {/* Stats grid colorful */}
                <div className="relative grid grid-cols-3 gap-2 mt-4">
                  {[
                    { label: 'Versi', value: '10', icon: '🏷️', grad: 'from-pink-500 to-rose-500' },
                    { label: 'Update', value: '120+', icon: '⚡', grad: 'from-cyan-500 to-blue-500' },
                    { label: 'Bulan', value: '1', icon: '📅', grad: 'from-amber-400 to-orange-500' },
                  ].map((s, i) => (
                    <div
                      key={s.label}
                      className={`stat-pop rounded-xl p-2.5 bg-gradient-to-br ${s.grad} text-white shadow-md text-center`}
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <div className="text-lg leading-none">{s.icon}</div>
                      <div className="text-base font-extrabold leading-none mt-1">{s.value}</div>
                      <div className="text-[9px] font-semibold opacity-90 uppercase tracking-wider mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Marquee ticker */}
            <div className="rounded-xl overflow-hidden border-2 border-fuchsia-400/40 bg-gradient-to-r from-pink-500/10 via-fuchsia-500/10 to-cyan-500/10 backdrop-blur">
              <div className="flex whitespace-nowrap" style={{ animation: 'marquee-x 22s linear infinite' }}>
                {[...Array(2)].flatMap((_, k) => ['🎉 Update terbaru', '✨ Fitur baru tiap minggu', '🚀 Performa makin ngebut', '💎 UI makin keren', '🔥 Bug fix harian', '🌈 Tema baru tiap rilis'].map((t, i) => (
                  <span key={`${k}-${i}`} className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-foreground">
                    {t} <span className="text-pink-500">●</span>
                  </span>
                )))}
              </div>
            </div>

            {/* === TIMELINE MAXIMALIST === */}
            <div className="relative">
              {/* Vertical animated line */}
              <div className="absolute left-[22px] top-2 bottom-0 w-[3px] rounded-full timeline-line-flow opacity-60" />
              
              {[
                {
                  date: "5 Mei 2026", version: "v3.1", isNew: true, isLaunch: true,
                  items: [
                    "🔊 Perbaikan player musik - audio tidak keluar di sebagian device kini sudah normal kembali",
                    "🎧 Auto-detect audio output (speaker/earphone/bluetooth) dengan toast notifikasi saat perangkat berubah",
                    "▶️ Resume playback otomatis setelah ganti tab/route - state player tetap hidup global di Index.tsx",
                    "⏯️ Media Session API: kontrol musik dari lockscreen, notification bar, dan tombol headset bluetooth",
                    "🎚️ Visualizer audio real-time dengan equalizer 8-band di player full-screen",
                    "📚 Pusat Informasi diperluas total: dokumentasi v3.1, performance budget, monitoring & observability",
                    "📖 Dokumentasi baru: Compatibility Matrix (browser/OS support), Deprecation Policy, SLA & Uptime 99.5%",
                    "❓ Pusat Bantuan ditambah: troubleshooting audio, install PWA Android/iOS, cara update aplikasi",
                    "❓ FAQ baru: cara reset PIN, klaim voucher follow toko, top-up saldo via QRIS/Dana, deposit cancel",
                    "📝 Tab Update dirombak ringan - entri v3.1 ditampilkan paling atas dengan badge launch animasi",
                    "🧭 Navigasi bawah ditambah indikator dot biru untuk tab dengan konten baru (Update, Bantuan, Info)",
                    "🛡️ Penguatan validasi PIN 6-digit dengan rate-limit 5 percobaan/menit per akun",
                    "🛡️ Session isolation antar akun pada device yang sama - visitor_id auto-regenerate setelah logout",
                    "🔐 Token reset PIN 5-digit kini expired 10 menit (sebelumnya 30 menit) untuk keamanan ekstra",
                    "⚡ Optimasi bundle size: lazy-load route Music, Game, Streak (~280KB → ~95KB initial)",
                    "⚡ Code splitting per-tab dengan React.lazy + Suspense fallback skeleton",
                    "⚡ First paint di koneksi 3G turun dari 4.2s → 1.8s (LCP improvement 57%)",
                    "🖼️ Image lazy-load dengan blur placeholder untuk produk, banner, dan playlist cover",
                    "🔁 Auto-reconnect realtime channel saat aplikasi kembali ke foreground (visibilitychange API)",
                    "🌐 Network Status detector - banner offline muncul instan + auto-retry queue saat online kembali",
                    "🔋 Battery & Charging status di Music page diagnostics via Battery API",
                    "📡 Network type detector (4G/3G/Wifi) ditampilkan di device simulator card",
                    "🌍 Multi-language auto-translate via Gemini diperbaiki - tidak ada double-translation lagi",
                    "💾 PWA offline strategy: cache strategy stale-while-revalidate untuk gambar & font",
                    "📦 PWA install prompt dirombak - banner dengan benefit list & screenshot preview",
                    "🎨 Tema Custom Photo: wrapper transparan agar background foto user terlihat penuh",
                    "🎨 Glassmorphism .custom-bg dengan backdrop-blur 24px + saturate 180% ala Apple",
                    "🏷️ Badge Premium Toko 👑 dengan animasi shine - tampil di chat, profil, dan komentar",
                    "💬 Chat read receipts WhatsApp-style: ✓ abu-abu (terkirim), ✓✓ biru (dibaca)",
                    "🔔 Notifikasi Realtime untuk pembelian, chat, perubahan saldo, dan broadcast admin",
                    "📊 Response Rate admin dihitung real-time dari chat produk + tiket support gabungan",
                    "🛒 Shopping cart bulk checkout divalidasi atomik via Edge Function (stok + saldo)",
                    "🎁 Voucher diskon kategori dinamis dengan auto-apply saat checkout",
                    "🎁 Follow store voucher Rp 1.000 (30 hari, single-use) auto-issued saat user follow",
                    "💰 Wholesale pricing tier server-validated berdasarkan min_quantity threshold",
                    "🔥 Product Flash Sale tab ke-3 di StoreProfile dengan countdown live & kuota tracker",
                    "👑 Store Premium Membership 1/2/6 bulan (Rp 20k/30k/50k) dengan voucher harian Rp 2.000",
                    "🎵 Music Mega Hub: listener level XP, daily quest, AI mood radio & rekomendasi",
                    "💬 Komentar musik + reaction emoji, top fans leaderboard, wrapped year-end stats",
                    "🎤 Lirik sync AI auto-transcription dengan onset lead compensation client/server",
                    "💤 Sleep timer musik (5/10/15/30/60 menit) dengan fade-out smooth",
                    "🎨 Music share via Web Share API + deep link langsung ke lagu",
                    "🎲 Lucky Wheel Shop di MegaShopHub: jackpot, pity 50 spin, free harian, 4 mata uang",
                    "🎰 Scratch-Off Lottery dengan Combo Multiplier ringan (max 1.2x), Daily Free Bronze",
                    "🎟️ Streak Voucher admin redeem code (STR-XXXX) untuk klaim Gem/Koin/Kredit/Hint",
                    "🎯 Premium Spin Milestones harian (2/5/10/20 spin = 50/200/500/1500 gem)",
                    "💎 Normal Spin Discount harian dengan 8 tier (1-500 spin) reset 00:00 WIB",
                    "🎫 Spin Tickets Normal/Premium pengganti gem (rate 50/100), kombinasi otomatis",
                    "🏆 Daily Streak auto-claiming cumulative reset 00:00 WIB (UTC+7)",
                    "📢 Admin Announcements rich-text resmi tampil di home & tab Admin",
                    "🎮 11 AI Games dengan 3 lives, dynamic timer colors, base64 fix untuk WA bot",
                    "🎮 Game Credits: dynamic packages, cumulative premium/unlimited, PIN verification",
                    "🤝 Game Account System: guest → bound, update stats, leaderboards, follow system",
                    "🤖 WhatsApp Bot Baileys v13: status-based flow engine, session locking, dynamic receipts",
                    "📤 Transaction Export PDF/Word/TXT branded - bulk atau range tanggal",
                    "🔧 Admin User Management: reset balance/credits/streaks dengan auto-notifikasi",
                    "🐛 Bug fix: tombol play kadang stuck loading, lirik geser 0.3 detik, stok produk telat update",
                    "🐛 Bug fix: ghost login setelah logout, double notifikasi push, badge counter tidak reset",
                    "🐛 Bug fix: scroll position hilang saat back navigation, modal stack overflow di iOS Safari",
                    "🐛 Bug fix: timer game pause saat tab inactive (sekarang pakai requestAnimationFrame + visibilityChange)",
                    "♿ Accessibility: focus ring lebih jelas, ARIA labels lengkap di semua tombol icon-only",
                    "🌙 Dark mode contrast ratio AAA compliant untuk text utama (WCAG 2.1)",
                    "📱 Touch target minimum 44x44px (Apple HIG) di semua tombol interaktif",
                    "🚀 Service Worker update prompt - banner muncul saat versi baru tersedia, klik untuk reload",
                  ]
                },
                {
                  date: "28 April 2026", version: "v3.0", isLaunch: true,
                  items: [
                    "💬 Badge Response Rate Admin - persentase respon admin (chat produk + tiket support) ditampilkan dinamis di profil toko",
                    "📊 Rumus rasio sederhana semua waktu: (chat dibalas / total chat user) × 100% - update real-time via Supabase",
                    "💚 Ikon MessageCircle hijau dengan fill-current menggantikan ikon petir - lebih jelas merepresentasikan chat & komunikasi",
                    "🏪 Halaman Toko Full-Screen - klik 'Kunjungi Toko' kini buka tampilan profil toko penuh layar (100dvh) tanpa modal sempit",
                    "📦 Halaman Produk Full-Screen - detail produk kini full-page layout dengan slide-in animation dari bawah, lebih imersif",
                    "✨ Override Radix Dialog dengan !w-screen !h-[100dvh] !inset-0 !rounded-none untuk pengalaman native app",
                    "🔄 Realtime sync response rate - badge auto-update saat ada chat baru atau balasan admin",
                  ]
                },
                {
                  date: "26 April 2026", version: "v2.9",
                  items: [
                    "🌈 Beranda Maximalist Colorful - tema warna-warni penuh energi & playful",
                    "🎨 Quick Access buttons dengan animasi gerak: float, bounce, conic gradient border + particle sparkles",
                    "📊 Live Stats Dashboard baru di beranda - 4 kartu (Lagu, Game, Hadiah, Instan) dengan pop-in animation",
                    "🎉 Welcome header confetti emoji + sticker mascot floating (🌈⚡💎)",
                    "🏷️ Marquee ticker promosi horizontal di antara hero & quick access",
                    "✨ Multi-color gradient borders dengan aurora-shift animation",
                    "🎯 Achievement chips ribbon (Trusted #1, Premium, Hot Deals) di dashboard",
                    "💫 Tab Update dirombak total - hero aurora, stats colorful, timeline animated dengan dot pulse",
                    "🎁 Version badge dengan shine animation untuk versi terbaru",
                    "📱 Floating emoji background di hero Update untuk vibe playful",
                  ]
                },
                {
                  date: "24 April 2026", version: "v2.8",
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
              ].map((entry, i) => {
                const palettes = [
                  { ring: 'from-pink-500 to-fuchsia-500', dot: 'bg-pink-500', tint: 'from-pink-500/15 to-fuchsia-500/5', border: 'border-pink-400/40', text: 'text-pink-500' },
                  { ring: 'from-cyan-500 to-blue-500', dot: 'bg-cyan-500', tint: 'from-cyan-500/15 to-blue-500/5', border: 'border-cyan-400/40', text: 'text-cyan-500' },
                  { ring: 'from-emerald-500 to-teal-500', dot: 'bg-emerald-500', tint: 'from-emerald-500/15 to-teal-500/5', border: 'border-emerald-400/40', text: 'text-emerald-500' },
                  { ring: 'from-amber-400 to-orange-500', dot: 'bg-amber-500', tint: 'from-amber-400/15 to-orange-500/5', border: 'border-amber-400/40', text: 'text-amber-500' },
                  { ring: 'from-violet-500 to-purple-500', dot: 'bg-violet-500', tint: 'from-violet-500/15 to-purple-500/5', border: 'border-violet-400/40', text: 'text-violet-500' },
                ];
                const p = palettes[i % palettes.length];
                return (
                <div key={i} className="relative pl-14 pb-5 update-card-rise" style={{ animationDelay: `${Math.min(i * 0.06, 0.4)}s` }}>
                  {/* Timeline dot maximalist */}
                  <div className={`absolute left-[14px] top-3 w-5 h-5 rounded-full bg-gradient-to-br ${p.ring} border-[3px] border-background shadow-lg ${entry.isNew ? 'timeline-dot-pulse' : ''} flex items-center justify-center`}>
                    {entry.isNew && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  
                  <div className={`relative rounded-2xl border-2 ${entry.isNew ? 'border-pink-400/60' : p.border} overflow-hidden shadow-md ${entry.isNew ? 'shadow-pink-500/30' : ''}`}>
                    <div className={`relative bg-gradient-to-br ${p.tint} bg-card backdrop-blur`}>
                      {/* Header strip */}
                      <div className={`flex items-center justify-between px-4 py-2.5 bg-gradient-to-r ${p.ring} text-white`}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">📅</span>
                          <span className="text-xs font-extrabold tracking-wide">{entry.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {entry.isNew && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-white text-pink-600 new-badge-bounce">
                              BARU
                            </span>
                          )}
                          {(entry as any).isLaunch && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-yellow-300 text-amber-900">
                              🚀 LAUNCH
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-black bg-white ${p.text} shadow`}>
                            {entry.version}
                          </span>
                        </div>
                      </div>
                      {/* Items */}
                      <div className="p-3.5">
                        <ul className="text-[12px] space-y-2 text-foreground/85">
                          {entry.items.map((item, j) => (
                            <li key={j} className="leading-relaxed flex gap-2 items-start">
                              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${p.dot} flex-shrink-0`} />
                              <span className="flex-1">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Footer count chip */}
                      <div className="px-3.5 pb-3 flex items-center justify-between">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${p.ring} text-white shadow-sm`}>
                          ✨ {entry.items.length} pembaruan
                        </span>
                        <span className="text-[9px] font-medium text-muted-foreground">#{String(i + 1).padStart(2, '0')}</span>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Copyright maximalist */}
            <div className="relative rounded-2xl overflow-hidden p-[2px] update-aurora-bg">
              <div className="rounded-2xl bg-card p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl float-emoji">💖</span>
                  <p className="text-sm font-extrabold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">© 2026 {STORE_NAME}</p>
                  <span className="text-2xl float-emoji" style={{ animationDelay: '0.5s' }}>✨</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">Murah & Terpercaya - Semua hak dilindungi.</p>
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  <a
                    href="https://agungadistore.lovable.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-extrabold px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-cyan-500 text-white shadow-md hover:scale-105 hover:shadow-lg transition-all border-2 border-white/30 flex items-center gap-1"
                  >
                    🌐 Website Resmi
                  </a>
                  {socialLinks.map(s => (
                    <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500/15 to-cyan-500/15 text-foreground hover:from-pink-500/30 hover:to-cyan-500/30 transition-all border-2 border-fuchsia-400/30 flex items-center gap-1 hover:scale-105">
                      {s.icon_url && <img src={s.icon_url} alt={s.platform} className="w-3 h-3 object-contain" />}
                      {s.platform}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "adminpost" && (
          <div className="space-y-5 animate-fade-in">
            {/* Hero Header — Apple Minimal Premium */}
            <div className="relative overflow-hidden rounded-[22px] bg-background/70 backdrop-blur-2xl backdrop-saturate-150 border border-foreground/[0.08] shadow-[0_2px_10px_-2px_rgba(0,0,0,0.06),0_18px_50px_-18px_rgba(0,0,0,0.2)]">
              <div className="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full bg-foreground/[0.05] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-primary/[0.06] blur-3xl" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
              <div className="relative p-5 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-2xl bg-foreground/20 blur-xl" />
                  <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-foreground to-foreground/70 flex items-center justify-center shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.5),inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                    <FileText className="w-5 h-5 text-background" strokeWidth={2.3} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[17px] font-bold tracking-tight text-foreground leading-tight">Postingan Admin</h2>
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 shrink-0">
                      <svg viewBox="0 0 16 16" fill="none" className="w-2.5 h-2.5 text-white"><path d="M3 8.5L6 11.5L13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_hsl(142_76%_45%)] animate-pulse" />
                    <p className="text-[11.5px] text-muted-foreground font-medium tracking-tight">{adminPosts.length} pengumuman resmi terverifikasi</p>
                  </div>
                </div>
              </div>
            </div>

            {adminPosts.length === 0 && (
              <div className="relative overflow-hidden rounded-[22px] bg-background/60 backdrop-blur-2xl border border-foreground/[0.08] py-16 text-center">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-foreground/[0.02] to-transparent" />
                <div className="relative w-16 h-16 mx-auto mb-3 rounded-2xl bg-foreground/[0.06] flex items-center justify-center">
                  <FileText className="w-7 h-7 text-foreground/40" strokeWidth={1.8} />
                </div>
                <p className="text-sm font-semibold text-foreground/80 tracking-tight">Belum ada postingan</p>
                <p className="text-[11px] text-muted-foreground mt-1">Pengumuman dari admin akan muncul di sini</p>
              </div>
            )}

            {adminPosts.map((post, idx) => {
              const socials = [
                { val: post.whatsapp, label: "WhatsApp", href: post.whatsapp?.startsWith("http") ? post.whatsapp : `https://wa.me/62${(post.whatsapp || "").replace(/^0/, "")}` },
                { val: post.instagram, label: "Instagram", href: post.instagram?.startsWith("http") ? post.instagram : `https://instagram.com/${post.instagram}` },
                { val: post.tiktok, label: "TikTok", href: post.tiktok?.startsWith("http") ? post.tiktok : `https://tiktok.com/@${post.tiktok}` },
                { val: post.youtube, label: "YouTube", href: post.youtube?.startsWith("http") ? post.youtube : `https://youtube.com/@${post.youtube}` },
                { val: post.twitter, label: "X/Twitter", href: post.twitter?.startsWith("http") ? post.twitter : `https://twitter.com/${post.twitter}` },
                { val: post.facebook, label: "Facebook", href: post.facebook?.startsWith("http") ? post.facebook : `https://facebook.com/${post.facebook}` },
              ].filter(s => s.val);

              return (
                <article
                  key={post.id}
                  className="group relative overflow-hidden rounded-[22px] bg-background/70 backdrop-blur-2xl backdrop-saturate-150 border border-foreground/[0.08] shadow-[0_2px_10px_-2px_rgba(0,0,0,0.06),0_18px_50px_-18px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_14px_-2px_rgba(0,0,0,0.08),0_28px_60px_-18px_rgba(0,0,0,0.28)] transition-all duration-500"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent z-10" />

                  {post.image_url && (
                    <div className="relative overflow-hidden">
                      <img
                        src={post.image_url}
                        alt={post.title}
                        className="w-full h-52 object-cover group-hover:scale-[1.03] transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
                      {idx === 0 && (
                        <div className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-white px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Terbaru
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold tracking-wider uppercase text-foreground/70 px-2 py-0.5 rounded-md bg-foreground/[0.06] ring-1 ring-foreground/[0.06]">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_6px_hsl(142_76%_45%)]" />
                            Resmi
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                            <CalendarDays className="w-2.5 h-2.5" strokeWidth={2.2} />
                            {new Date(post.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                        </div>
                        <h3 className="font-bold text-[17px] tracking-tight leading-snug text-foreground">{post.title}</h3>
                      </div>
                    </div>

                    {post.content && (
                      <p className="text-[12.5px] text-muted-foreground whitespace-pre-line leading-relaxed">{post.content}</p>
                    )}

                    {post.link_url && (
                      <a
                        href={post.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground bg-foreground/[0.06] hover:bg-foreground/[0.1] px-3 py-1.5 rounded-full ring-1 ring-foreground/[0.08] transition-all active:scale-95"
                      >
                        <ExternalLink className="w-3 h-3" strokeWidth={2.4} /> Buka Tautan
                      </a>
                    )}

                    {socials.length > 0 && (
                      <div className="pt-2 border-t border-foreground/[0.06]">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Hubungi via</p>
                        <div className="flex flex-wrap gap-1.5">
                          {socials.map(s => (
                            <a
                              key={s.label}
                              href={s.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10.5px] font-semibold px-3 py-1.5 rounded-full bg-foreground/[0.06] text-foreground/80 hover:bg-foreground hover:text-background ring-1 ring-foreground/[0.06] transition-all active:scale-95"
                            >
                              {s.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
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
            className="fixed left-0 right-0 z-50 cursor-pointer animate-fade-in"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
            onClick={() => openFullPlayerRef.current?.()}
          >
            <div className="max-w-lg mx-auto px-3">
              <div className="relative overflow-hidden rounded-[20px] bg-background/60 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.18)]">
                {/* Subtle ambient glow from cover */}
                <div className="pointer-events-none absolute -top-10 -left-6 w-32 h-32 rounded-full bg-fuchsia-500/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-10 right-0 w-32 h-32 rounded-full bg-indigo-500/15 blur-3xl" />

                {/* Top thin progress bar (iOS style) */}
                <div className="absolute top-0 inset-x-0 h-[2px] bg-white/10">
                  <div
                    className="h-full bg-foreground/80 transition-all duration-300"
                    style={{ width: `${mpProgress}%` }}
                  />
                </div>

                <div className="relative flex items-center gap-3 px-3 py-2.5">
                  {/* Square rounded cover (iOS style) */}
                  <div className="relative shrink-0">
                    <div
                      className="w-12 h-12 rounded-xl overflow-hidden bg-black/40"
                      style={{ boxShadow: "0 6px 16px -4px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.15)" }}
                    >
                      {playbackState.song.cover_url ? (
                        <img src={playbackState.song.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
                          <Music className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title + artist */}
                  <div className="flex-1 min-w-0">
                    <div className="overflow-hidden">
                      {titleLong && mpPlaying ? (
                        <div className="whitespace-nowrap" style={{ animation: "marquee-x 12s linear infinite" }}>
                          <span className="text-[14px] font-semibold text-foreground inline-block pr-8 tracking-tight">{playbackState.song.title}</span>
                          <span className="text-[14px] font-semibold text-foreground inline-block pr-8 tracking-tight">{playbackState.song.title}</span>
                        </div>
                      ) : (
                        <p className="text-[14px] font-semibold text-foreground truncate leading-tight tracking-tight">{playbackState.song.title}</p>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate leading-tight mt-0.5">{playbackState.song.artist}</p>
                  </div>

                  {/* Controls (iOS style: minimal, monochrome) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePlayRef.current?.(); }}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-foreground active:scale-90 transition-transform hover:bg-white/10"
                      aria-label={mpPlaying ? "Pause" : "Play"}
                    >
                      {mpPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.2" /><rect x="14" y="4" width="4" height="16" rx="1.2" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                      )}
                    </button>
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
          <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in fade-in duration-200" onClick={() => openProduct(null)}>
            <div className="bg-background w-full h-[100dvh] overflow-y-auto animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
              {imgs.length > 0 && (
                <div className="relative group/zoom">
                  <ImageCarousel images={imgs} className="w-full h-56" />
                  {/* Zoom buttons overlay - one per image area, top-right floating */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setZoomImage(imgs[0]); setZoomScale(1); }}
                    className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5 border border-white/20 shadow-lg active:scale-95 transition-transform"
                    aria-label="Perbesar gambar">
                    <Search className="w-3.5 h-3.5" /> Perbesar
                  </button>
                  {/* Quick tap hint at bottom */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white/90 text-[10px] font-medium flex items-center gap-1 pointer-events-none border border-white/10">
                    <Search className="w-3 h-3" /> Klik "Perbesar" untuk zoom
                  </div>
                </div>
              )}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold flex items-center gap-1.5 flex-wrap">
                      <span>{selectedProduct.title}</span>
                      <VerifiedBadge size="md" />
                    </h2>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {selectedProduct.category && <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">{selectedProduct.category}</span>}
                      {selectedProduct.has_warranty && <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground"><Shield className="mr-0.5 inline w-3 h-3" />Garansi</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => shareProduct(selectedProduct, e)}
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-md active:scale-95 transition-transform"
                      aria-label="Bagikan produk">
                      <Share2 className="w-4 h-4 text-white" />
                    </button>
                    <button onClick={() => toggleLike(selectedProduct.id)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
                      <Heart className={`w-5 h-5 ${likedIds.has(selectedProduct.id) ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
                    </button>
                    <button onClick={() => openProduct(null)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                {/* Profil Toko Mini */}
                <StoreMiniCard productCount={products.length} onVisit={() => window.dispatchEvent(new Event("open-store-profile"))} />
                {/* Premium price card with shimmer */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-amber-400/15 border border-white/15 p-4 animate-fade-in">
                  <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-fuchsia-400/30 blur-3xl animate-pulse" />
                  <div className="pointer-events-none absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-violet-500/30 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
                  <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" style={{ animation: "shimmer 3s ease-in-out infinite" }} />
                  <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
                  {(() => {
                    const flashEff = getActiveFlashSaleForProduct(selectedProduct.id);
                    const flashPrice = flashEff ? getFlashUnitPrice(flashEff, selectedProduct.price) : selectedProduct.price;
                    const remainSec = flashEff ? Math.max(0, Math.floor((new Date(flashEff.ends_at).getTime() - Date.now()) / 1000)) : 0;
                    const hh = String(Math.floor(remainSec / 3600)).padStart(2, "0");
                    const mm = String(Math.floor((remainSec % 3600) / 60)).padStart(2, "0");
                    const ss = String(remainSec % 60).padStart(2, "0");
                    const flashRemainQty = flashEff ? (flashEff.quota === 0 ? null : Math.max(0, flashEff.quota - (flashEff.sold || 0))) : null;
                    return (
                      <div className="relative flex items-end justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70 flex items-center gap-1">
                            {flashEff ? <><span className="text-red-500">⚡</span> Flash Sale</> : <><Sparkles className="w-3 h-3 text-amber-400" /> Harga Terbaik</>}
                          </p>
                          <p className={`text-3xl font-black tracking-tight mt-0.5 ${flashEff ? "text-red-500" : "text-foreground bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text"}`}>{formatPrice(flashPrice)}</p>
                          {flashEff && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs line-through text-muted-foreground font-semibold">{formatPrice(selectedProduct.price)}</span>
                              {flashEff.mode === "discount_percent" && (
                                <span className="px-1.5 py-0.5 rounded-md bg-red-500 text-white text-[10px] font-black">-{flashEff.discount_percent}%</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {flashEff ? (
                            <>
                              <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-400/40 text-[9px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                              </span>
                              <span className="font-mono text-[11px] font-black text-red-400 bg-black/40 px-2 py-0.5 rounded">{hh}:{mm}:{ss}</span>
                              {flashRemainQty !== null && (
                                <span className="text-[9px] text-foreground/70 font-bold">Sisa kuota: {flashRemainQty}</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[9px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                              </span>
                              <span className="text-[9px] text-foreground/60 font-medium">100% Original</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {/* Wholesale prices */}
                {(() => {
                  const tiers = getProductWholesaleTiers(selectedProduct.id);
                  if (tiers.length === 0) return null;
                  return (
                    <div className="space-y-1.5 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-3 animate-fade-in">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Harga Grosir</p>
                      {tiers.map((t: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs items-center">
                          <span className="text-muted-foreground">Beli ≥{t.min_quantity} pcs</span>
                          <span className="font-bold text-amber-300">{formatPrice(t.price_per_item)} /pcs</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {selectedProduct.description && (
                  <div className="rounded-2xl bg-muted/40 border border-border/50 p-3 animate-fade-in">
                    <p className="text-sm text-foreground/80 leading-relaxed">{selectedProduct.description}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap animate-fade-in">
                  <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5 border ${selectedProduct.stock > 0 ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-rose-500/15 border-rose-400/40 text-rose-300'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedProduct.stock > 0 ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
                    {selectedProduct.stock > 0 ? `${selectedProduct.stock} stok tersedia` : 'Stok habis'}
                  </span>
                  <span className="text-[11px] px-3 py-1.5 rounded-full font-semibold bg-violet-500/15 border border-violet-400/40 text-violet-300 flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3" /> {new Date(selectedProduct.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>

                {/* Premium action buttons - 4 grid with gradients */}
                <div className="grid grid-cols-4 gap-2 animate-fade-in">
                  <button
                    disabled={selectedProduct.stock <= 0}
                    onClick={() => { addToCart(selectedProduct); }}
                    className="group relative overflow-hidden h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400/30 disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-colors" />
                    <ShoppingCart className="w-4 h-4 text-blue-300 relative" />
                    <span className="text-[10px] font-bold text-foreground relative">Keranjang</span>
                  </button>
                  <button
                    onClick={() => openProductChat(selectedProduct)}
                    className="group relative overflow-hidden h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-colors" />
                    <MessageCircle className="w-4 h-4 text-purple-300 relative" />
                    <span className="text-[10px] font-bold text-foreground relative">Chat</span>
                  </button>
                  {(() => {
                    const effPrice = getEffectivePrice(selectedProduct.id, selectedProduct.price, 1).price;
                    return <>
                      <button
                        disabled={!userBalance || spendableStoreBalance < effPrice || selectedProduct.stock <= 0}
                        onClick={() => { setBuyProduct(selectedProduct); setBuyQuantity(1); setShowBuySaldo(true); }}
                        className="group relative overflow-hidden h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-orange-500/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/20 group-hover:to-transparent transition-colors" />
                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        <Wallet className="w-4 h-4 text-white relative" />
                        <span className="text-[10px] font-extrabold text-white relative">Beli Sekarang</span>
                      </button>
                      <button
                        onClick={() => setShowWaForm(true)}
                        className="group relative overflow-hidden h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-400/30 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-green-500/0 group-hover:from-emerald-500/30 group-hover:to-green-500/30 transition-colors" />
                        <ShoppingBag className="w-4 h-4 text-emerald-300 relative" />
                        <span className="text-[10px] font-bold text-foreground relative">WhatsApp</span>
                      </button>
                    </>;
                  })()}
                </div>
                {userBalance && spendableStoreBalance < getEffectivePrice(selectedProduct.id, selectedProduct.price, 1).price && (
                  <p className="text-[10px] text-destructive text-center">Saldo tidak cukup. Kurang {formatPrice(getEffectivePrice(selectedProduct.id, selectedProduct.price, 1).price - spendableStoreBalance)}. <button className="underline text-primary" onClick={() => { openProduct(null); setTab("saldo"); }}>Top up →</button></p>
                )}
                {!userBalance && (
                  <p className="text-[10px] text-muted-foreground text-center">Buat akun saldo untuk beli pakai saldo. <button className="underline text-primary" onClick={() => { openProduct(null); setTab("saldo"); }}>Daftar →</button></p>
                )}

                {/* Produk Lainnya */}
                {(() => {
                  const others = products.filter(p => p.id !== selectedProduct.id);
                  const sameCat = selectedProduct.category
                    ? others.filter(p => p.category === selectedProduct.category)
                    : [];
                  const rest = others.filter(p => !sameCat.includes(p));
                  const shuffled = [...sameCat, ...rest].slice(0, 30).sort(() => Math.random() - 0.5).slice(0, 6);
                  if (shuffled.length === 0) return null;
                  return (
                    <div className="border-t border-border pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary" /> Produk Lainnya
                        </p>
                        <span className="text-[10px] text-muted-foreground">{shuffled.length} pilihan</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {shuffled.map((p, idx) => {
                          const pImgs = getProductImages(p.id);
                          const cover = pImgs[0];
                          return (
                            <button
                              key={p.id}
                              onClick={() => openProduct(p)}
                              className="group relative overflow-hidden rounded-xl border border-border bg-muted/40 hover:border-primary/60 transition-all hover:scale-[1.03] animate-fade-in text-left"
                              style={{ animationDelay: `${idx * 50}ms` }}
                            >
                              <div className="aspect-square w-full overflow-hidden bg-muted">
                                {cover ? (
                                  <img src={cover} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <ShoppingBag className="w-6 h-6" />
                                  </div>
                                )}
                                {p.stock <= 0 && (
                                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                                    <span className="text-[9px] font-bold text-destructive uppercase">Habis</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-1.5 space-y-0.5">
                                <p className="text-[10px] font-bold text-foreground line-clamp-1 leading-tight">
                                  {p.title}
                                  <VerifiedBadge size="xs" className="ml-0.5" />
                                </p>
                                <p className="text-[10px] font-extrabold text-primary leading-tight">{formatPrice(p.price)}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="relative pt-5 mt-2">
                  {/* Top divider with gradient */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-fuchsia-500 to-cyan-500 blur-md opacity-60 animate-pulse" />
                      <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-500 flex items-center justify-center shadow-lg">
                        <Sparkles className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                      </div>
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-500 bg-clip-text text-transparent">
                      Hubungi Kami
                    </p>
                    <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
                  </div>

                  {/* Social grid - data dari admin */}
                  <div className="grid grid-cols-2 gap-2">
                    {socialLinks.length === 0 ? (
                      <p className="col-span-2 text-center text-[10px] text-muted-foreground py-4">Belum ada sosial media</p>
                    ) : socialLinks.map((s, i) => {
                      const isLast = i === socialLinks.length - 1 && socialLinks.length % 2 === 1;
                      return (
                        <a
                          key={s.id}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            animationDelay: `${i * 70}ms`,
                            background: `linear-gradient(135deg, ${s.color_from}, ${s.color_to})`,
                            boxShadow: `0 4px 14px -4px ${s.color_from}59`,
                          }}
                          className={`group relative overflow-hidden rounded-xl p-2.5 animate-fade-in transition-all duration-300 hover:scale-[1.04] active:scale-95 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4)] ${isLast ? "col-span-2" : ""}`}
                        >
                          {/* Shimmer */}
                          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                          {/* Aurora blob */}
                          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/20 blur-2xl group-hover:bg-white/40 transition-colors" />

                          <div className="relative flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-white/25 backdrop-blur-sm flex items-center justify-center overflow-hidden shadow-inner group-hover:rotate-6 transition-transform duration-300">
                              {s.icon_url ? (
                                <img src={s.icon_url} alt={s.platform} className="w-6 h-6 object-contain drop-shadow" />
                              ) : (
                                <span className="text-white text-sm font-black drop-shadow">{s.platform[0]?.toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-black text-white leading-tight tracking-tight drop-shadow capitalize">{s.platform}</p>
                              <p className="text-[10px] text-white/85 truncate font-medium">{s.label}</p>
                            </div>
                            <ExternalLink className="w-3 h-3 text-white/80 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </div>
                        </a>
                      );
                    })}
                  </div>

                  {/* Footer pill */}
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Online · Respon cepat 24/7
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
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
              <p className="text-sm font-bold flex items-center gap-1 flex-wrap">
                <span>{selectedProduct.title}</span>
                <VerifiedBadge size="sm" />
              </p>
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
        <div className="fixed inset-0 z-[70] bg-background flex flex-col animate-in fade-in duration-200">
          <div className="bg-card w-full h-full flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-border p-4">
              <button onClick={() => setShowProductChat(false)}><ChevronLeft className="w-5 h-5" /></button>
              <img src={storeQris} alt={STORE_NAME} className="h-9 w-9 rounded-full object-cover border border-border" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-bold text-sm truncate">{STORE_NAME}</p>
                  {storePremium.isPremium && (
                    <span className="inline-flex items-center rounded-full border border-zinc-400/70 bg-gradient-to-r from-zinc-300 via-slate-100 to-zinc-400 px-2.5 py-0.5 text-[11px] font-extrabold tracking-[0.25em] text-zinc-800 shadow-md">
                      PRIORITAS
                    </span>
                  )}
                </div>
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
              className="flex-1 min-h-0"
              scrollClassName="max-h-full"
            />
          </div>
        </div>
      )}

      {/* Product Chat History Modal */}
      {showChatHistory && (
        <div className="fixed inset-0 z-[70] bg-background flex flex-col animate-in fade-in duration-200">
          <div className="bg-card w-full h-full overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
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
                <p className="text-[11px] text-muted-foreground">Web v3.1 - Mei 2026 - {STORE_NAME}</p>
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

              {/* Troubleshooting Audio */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🔊 Audio Tidak Keluar?</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[13px]">
                  <li>Pastikan volume HP <strong>tidak silent</strong> & mode getar mati</li>
                  <li>Cek output audio - jika ada Bluetooth/headset terpasang, suara mungkin lewat sana</li>
                  <li>Tutup aplikasi musik/video lain (YouTube, Spotify) yang merebut audio focus</li>
                  <li>Reload halaman, lalu tekan tombol play <strong>setelah</strong> halaman selesai dimuat</li>
                  <li>Browser iOS Safari: aktifkan Media Auto-play di Settings &gt; Safari</li>
                  <li>Coba ganti lagu lain - jika file rusak akan auto-skip</li>
                  <li>Bersihkan cache browser, lalu install ulang PWA dari Home Screen</li>
                  <li>Masih bermasalah? Kirim tiket kategori <strong>Lagu/Musik</strong> dengan model HP & browser</li>
                </ol>
              </div>

              {/* Update Aplikasi */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">⬆️ Cara Update Aplikasi</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Aplikasi auto-update saat dibuka & terkoneksi internet</li>
                  <li>PWA: tutup semua tab lalu buka kembali untuk dapat versi terbaru</li>
                  <li>Cek versi di tab <strong>Update</strong> (ikon Refresh) di navigasi bawah</li>
                  <li>Jika versi tidak berubah, force refresh: tarik ke bawah (pull-to-refresh)</li>
                  <li>Hard reload browser: Ctrl+Shift+R (desktop) / clear cache PWA (mobile)</li>
                  <li>Versi saat ini: <strong>v3.1 (Mei 2026)</strong></li>
                </ul>
              </div>

              {/* Game AI */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎮 Game AI & Mini Games</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Buka tab <strong>Game</strong> untuk akses 30+ mini game</li>
                  <li>Game tebak (Kata, Lagu, Gambar, Barang, Angka) menggunakan <strong>AI</strong></li>
                  <li>Sistem <strong>3 nyawa</strong> per game - hilang nyawa jika salah/timeout</li>
                  <li>Setiap game ada <strong>timer</strong> dengan warna dinamis (hijau→kuning→merah)</li>
                  <li>Beli <strong>Game Credits</strong> untuk extra life, hint, & status premium</li>
                  <li>Premium / Unlimited bersifat <strong>akumulatif</strong> tidak reset</li>
                  <li>Booster keberuntungan x2/x6/x8/x10/x20 untuk Slot & Lucky Draw</li>
                </ul>
                <div className="mt-2 p-2 bg-muted/40 rounded-lg text-[12px]">
                  <p className="font-semibold text-foreground">🎯 Daftar Game Tersedia:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Tebak Kata, Lagu, Gambar, Barang, Angka (AI)</li>
                    <li>2048, Tetris, Snake, Flappy, Brick Breaker, Bubble Shooter</li>
                    <li>Match-3, Memory, MineSweeper, Sky Jumper, Catch Star</li>
                    <li>Slot Machine, Lucky Draw, Plinko, Scratch Card, Roda Putar</li>
                    <li>Suit, Ular Tangga, Ludo, Whack-a-Mole, Tap Beat, Color Reflex</li>
                    <li>Kuis, Pilihan Ganda, Teka-Teki, Teka-Teki V2</li>
                  </ul>
                </div>
              </div>

              {/* Streak Harian */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🔥 Daily Streak Harian</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Klaim hadiah harian otomatis setiap hari</li>
                  <li>Streak <strong>akumulatif</strong> - makin panjang makin besar hadiah</li>
                  <li>Reset <strong>00:00 WIB (UTC+7)</strong> setiap hari</li>
                  <li>Lewat 1 hari = streak <strong>reset ke 0</strong></li>
                  <li>Gunakan <strong>Streak Freeze</strong> untuk skip 1 hari tanpa kehilangan streak</li>
                  <li>Akses <strong>Streak Shop</strong>: Mystery Box, Auction House, Loyalty Tier, Referral Vault</li>
                  <li>Loyalty Tier: Bronze → Silver → Gold → Platinum → Diamond</li>
                </ul>
              </div>

              {/* Mega Shop / Lucky Wheel */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎡 Mega Shop & Lucky Wheel</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li><strong>Roda Putar</strong> dengan jackpot besar di MegaShopHub</li>
                  <li>Pity system <strong>50 spin</strong> jamin hadiah besar</li>
                  <li><strong>Free spin harian</strong> - klaim setiap hari gratis</li>
                  <li>4 mata uang: Free / Coins / Gems / Saldo+PIN</li>
                  <li><strong>Scratch-Off Lottery</strong> dengan combo multiplier max 1.2x</li>
                  <li>Daily Free Bronze + achievement bonus</li>
                </ul>
              </div>

              {/* Luck Royale & Spin Tickets */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">💎 Luck Royale (Normal & Premium)</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li><strong>Diamond Royale</strong> - Premium Spin dengan hadiah eksklusif</li>
                  <li>Milestone Premium Spin harian: 2/5/10/20 spin = 50/200/500/1500 gem</li>
                  <li>Diskon harian Normal: 1/5/10/20/100/125/200/500 spin</li>
                  <li>Tiket <strong>Normal & Premium</strong> sebagai pengganti gem (rate 50/100)</li>
                  <li>Beli tiket pakai gem - kombinasi otomatis saat spin</li>
                  <li>Reset diskon & milestone <strong>00:00 WIB</strong></li>
                </ul>
              </div>

              {/* Voucher Diskon */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎟️ Voucher Diskon & Follow Toko</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Voucher diskon dinamis berdasarkan <strong>kategori produk</strong></li>
                  <li><strong>Follow Toko</strong> = dapat voucher Rp 1.000 (30 hari, single-use)</li>
                  <li>Member Premium dapat voucher harian <strong>Rp 2.000</strong></li>
                  <li>Voucher Streak (kode <strong>STR-XXXX</strong>) bisa berisi gem/koin/kredit/hint/freeze</li>
                  <li>Kode redeem dari admin via tab Voucher</li>
                  <li>Cek expiry voucher sebelum digunakan</li>
                </ul>
              </div>

              {/* Premium Membership */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">👑 Premium Membership Toko</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Paket: <strong>1 bulan (Rp 20k)</strong>, 2 bulan (Rp 30k), 6 bulan (Rp 50k)</li>
                  <li>Voucher harian <strong>Rp 2.000</strong> selama membership aktif</li>
                  <li>Badge <strong>👑 Premium</strong> di profil & chat</li>
                  <li>Chat prioritas - dibalas lebih cepat oleh admin</li>
                  <li>Akses tab Premium di halaman StoreProfile</li>
                </ul>
              </div>

              {/* Flash Sale */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">⚡ Flash Sale Produk</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Produk diskon dengan <strong>kuota terbatas</strong> & countdown live</li>
                  <li>Mode diskon: <strong>persen %</strong> atau harga manual</li>
                  <li>Cek tab Flash Sale di StoreProfile</li>
                  <li>Stok flash sale otomatis berkurang real-time</li>
                  <li>Notifikasi otomatis saat flash sale baru dimulai</li>
                </ul>
              </div>

              {/* Wholesale */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📦 Harga Grosir (Wholesale)</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Beli dalam jumlah banyak = <strong>harga otomatis lebih murah</strong></li>
                  <li>Tier harga berdasarkan <strong>min_quantity</strong></li>
                  <li>Validasi server-side - tidak bisa diakali dari client</li>
                  <li>Cocok untuk reseller / pembelian bulk</li>
                </ul>
              </div>

              {/* Sponsor & Rekber */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🤝 Produk Sponsor & Rekber</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Produk pihak ketiga ditampilkan di tab Sponsor</li>
                  <li>Setiap sponsor punya <strong>ID numerik unik</strong></li>
                  <li>Wajib gunakan <strong>Rekber (Rekening Bersama)</strong> via admin</li>
                  <li>Admin sebagai perantara - dana ditahan sampai barang sampai</li>
                  <li>Hindari transaksi langsung tanpa rekber - <strong>risiko penipuan</strong></li>
                  <li>Lapor sponsor bermasalah via tiket kategori <strong>Sponsor / Lapor Penipu</strong></li>
                </ul>
              </div>

              {/* Bot WhatsApp */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🤖 Bot WhatsApp (085769302532)</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Bot otomatis 24/7 untuk cek saldo, deposit, voucher</li>
                  <li>Perintah: <code>!saldo</code>, <code>!deposit</code>, <code>!voucher</code>, <code>!tiket</code></li>
                  <li><code>!lihatsemuatiket</code> - lihat semua tiket aktif</li>
                  <li>Deposit interaktif: pilih QRIS/Dana lalu ikuti instruksi</li>
                  <li>Cancel deposit wajib pakai <strong>TX ID</strong></li>
                  <li>Bot kirim <strong>resi visual</strong> otomatis setelah transaksi sukses</li>
                </ul>
              </div>

              {/* Notifikasi */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🔔 Sistem Notifikasi</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Realtime notif untuk: pembelian, chat, perubahan saldo, broadcast admin</li>
                  <li>Lihat semua notif di ikon <strong>lonceng</strong> top bar</li>
                  <li>Aktifkan notif browser/PWA untuk dapat push notification</li>
                  <li>Tandai sudah dibaca atau hapus notif</li>
                  <li>Read receipts chat: ✓ abu (terkirim) → ✓✓ biru (dibaca)</li>
                </ul>
              </div>

              {/* Bahasa */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🌐 Multi-Bahasa & Auto-Translate</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Mendukung <strong>{LANGUAGES.length}+ bahasa</strong> dengan bendera</li>
                  <li>Pilih bahasa di menu drawer atau pengaturan</li>
                  <li>Auto-translate konten dinamis via <strong>Gemini AI</strong></li>
                  <li>Sistem cegah double-translation untuk akurasi</li>
                  <li>Bahasa tersimpan di cache lokal</li>
                </ul>
              </div>

              {/* Tema */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🎨 Tema & Tampilan</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Tema: <strong>Light, Dark, Gold, Custom Photo</strong></li>
                  <li>Custom Photo: upload foto sendiri sebagai background</li>
                  <li>Glassmorphism & blur effect modern</li>
                  <li>Font Plus Jakarta Sans untuk readability</li>
                  <li>Tema tersimpan otomatis per device</li>
                </ul>
              </div>

              {/* PWA Install */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📲 Cara Install PWA</p>
                <div className="text-[13px] space-y-1.5">
                  <p className="font-semibold text-foreground">Android (Chrome):</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Buka aplikasi di Chrome</li>
                    <li>Tap menu <strong>⋮</strong> di kanan atas</li>
                    <li>Pilih <strong>"Tambah ke Layar Utama"</strong></li>
                    <li>Konfirmasi - icon muncul di home screen</li>
                  </ol>
                  <p className="font-semibold text-foreground pt-1">iOS (Safari):</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Buka aplikasi di Safari (bukan Chrome)</li>
                    <li>Tap ikon <strong>Share</strong> (kotak panah ke atas)</li>
                    <li>Scroll & pilih <strong>"Add to Home Screen"</strong></li>
                    <li>Tap <strong>Add</strong> di kanan atas</li>
                  </ol>
                  <p className="font-semibold text-foreground pt-1">Desktop (Chrome/Edge):</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Klik ikon <strong>install (+)</strong> di address bar</li>
                    <li>Atau menu &gt; Install Agung Adi Store</li>
                  </ol>
                </div>
              </div>

              {/* Mode Offline */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📴 Mode Offline</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Aplikasi tetap bisa dibuka tanpa internet (PWA)</li>
                  <li>Halaman & gambar di-cache otomatis (Workbox)</li>
                  <li>Musik offline bisa diputar tanpa internet</li>
                  <li>Transaksi & chat butuh internet aktif</li>
                  <li>Auto-reconnect saat internet kembali</li>
                  <li>Overlay otomatis blokir game saat offline (cegah corruption)</li>
                </ul>
              </div>

              {/* Keamanan Akun */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🔐 Keamanan Akun</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>PIN <strong>6 digit</strong> wajib untuk setiap transaksi saldo</li>
                  <li>Reset PIN via <strong>token 5 digit</strong> dikirim ke WhatsApp</li>
                  <li>Token reset valid <strong>10 menit</strong></li>
                  <li>Login multi-identifier: email / nomor HP / username</li>
                  <li>Session isolation - data tidak bocor antar akun</li>
                  <li>Rate-limit untuk cegah brute-force PIN</li>
                  <li>Logout otomatis hapus session lokal</li>
                </ul>
              </div>

              {/* Leaderboard */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🏆 Leaderboard & Komunitas</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Weekly Leaderboard untuk game</li>
                  <li>Top Fans untuk artist musik</li>
                  <li>Stats akun: total game dimainkan, win rate, best score</li>
                  <li>Follow profil musik & toko favorit</li>
                  <li>Komentar & reaction lagu publik</li>
                </ul>
              </div>

              {/* Export Data */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📤 Export Riwayat Transaksi</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Export riwayat dalam format <strong>PDF / Word / TXT</strong></li>
                  <li>Pilih <strong>range tanggal</strong> atau bulk semua</li>
                  <li>File dilengkapi <strong>branding toko</strong></li>
                  <li>Cocok untuk laporan keuangan / pencatatan</li>
                </ul>
              </div>

              {/* Share & Deep Link */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🔗 Share & Deep Link</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Bagikan produk / lagu / sponsor via <strong>Web Share API</strong></li>
                  <li>Deep link otomatis buka produk spesifik</li>
                  <li>Query params: <code>?p=ID</code> untuk produk, <code>?s=ID</code> untuk sponsor</li>
                  <li>Real-time deteksi output audio (Bluetooth/Speaker/Headset)</li>
                </ul>
              </div>

              {/* Pengumuman Admin */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📢 Pengumuman Admin</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li>Postingan resmi admin di tab <strong>Home</strong> & <strong>Admin</strong></li>
                  <li>Format rich-text dengan gambar & link</li>
                  <li>Notifikasi otomatis saat ada pengumuman baru</li>
                  <li>Cek tab Update untuk changelog & info versi</li>
                </ul>
              </div>

              {/* Pertanyaan Umum (FAQ) */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">❓ FAQ - Pertanyaan Umum</p>
                <div className="space-y-2 text-[13px]">
                  <div>
                    <p className="font-semibold text-foreground">Q: Apakah aman beli di sini?</p>
                    <p>A: Ya, kami menggunakan sistem rekber & garansi. Bukti transaksi disimpan otomatis.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Voucher saya tidak bisa diklaim, kenapa?</p>
                    <p>A: Cek expiry, pastikan kode benar (16 char), atau sudah pernah diklaim. Jika masih error, buat tiket.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Saldo saya tidak masuk setelah deposit?</p>
                    <p>A: Tunggu 5-15 menit. Jika lebih lama, kirim TX ID ke admin via WhatsApp atau tiket.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Bisa pindah saldo ke HP baru?</p>
                    <p>A: Ya, hubungi admin dengan menyertakan visitor ID lama & baru.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Lupa PIN, bagaimana reset?</p>
                    <p>A: Klik "Lupa PIN" di halaman saldo - token reset 5 digit dikirim ke WhatsApp.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Kenapa lagu/musik tidak bisa diputar?</p>
                    <p>A: Cek troubleshooting audio di atas. Pastikan tidak ada app lain merebut audio focus.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Game saya stuck/tidak respon?</p>
                    <p>A: Pastikan online, refresh halaman. Game state di-persist di localStorage.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Q: Apakah bisa request fitur baru?</p>
                    <p>A: Bisa! Buat tiket kategori "Saran" dengan deskripsi detail.</p>
                  </div>
                </div>
              </div>

              {/* Kontak Darurat */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">🆘 Kontak Darurat</p>
                <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                  <li><strong>WhatsApp Admin:</strong> 085769302532 (24/7)</li>
                  <li><strong>Tiket Sistem:</strong> tab Tiket - respon 5-30 menit</li>
                  <li><strong>Email:</strong> kelinganmantannnn@gmail.com</li>
                  <li>Untuk laporan penipuan: tiket kategori <strong>Lapor Penipu</strong></li>
                  <li>Untuk pelanggaran serius: hubungi admin langsung WA</li>
                </ul>
              </div>

              {/* Changelog */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="font-bold text-foreground text-xs uppercase tracking-wider">📝 Changelog v3.1</p>
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-foreground text-xs">5 Mei 2026 - Update Terbaru</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>🔊 <strong>Fix audio musik</strong> - tidak keluar suara di sebagian device sudah normal</li>
                    <li>▶️ Resume playback otomatis lintas tab/route</li>
                    <li>📚 Pusat Informasi diperluas: dokumentasi v3.1, performance, observability</li>
                    <li>❓ Pusat Bantuan ditambah: troubleshooting audio, install PWA, cara update</li>
                    <li>🛡️ Penguatan validasi PIN & session isolation antar akun</li>
                    <li>⚡ Optimasi bundle & lazy-load route</li>
                    <li>🔁 Auto-reconnect realtime saat app kembali ke foreground</li>
                    <li>🐛 Bug fix: tombol play stuck, lirik geser 0.3s, stok telat update</li>
                  </ul>
                  <p className="font-semibold text-foreground text-xs pt-2">v3.0 - 28 April 2026</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>💬 Badge Response Rate Admin (chat produk + tiket)</li>
                    <li>🏪 Halaman Toko & Produk Full-Screen</li>
                    <li>🔄 Realtime sync response rate</li>
                  </ul>
                  <p className="font-semibold text-foreground text-xs pt-2">v2.8 - 24 April 2026</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>🎮 4 Game baru: Memory Flip, Snake Neon, 2048, Plinko</li>
                    <li>🎨 Tema iOS Dark Vibrant</li>
                    <li>🎰 Scratch-Off Lottery dirombak total</li>
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
        const eff = getEffectivePrice(buyProduct.id, buyProduct.price, buyQuantity);
        const unitPrice = eff.price;
        const isFlash = eff.isFlash;
        const isWholesale = !isFlash && unitPrice < buyProduct.price;
        const basePrice = unitPrice * buyQuantity;
        const discount = discountInfo ? Math.min(discountInfo.amount, basePrice) : 0;
        const totalPrice = basePrice - discount;
        const availableStoreBalance = (userBalance?.balance || 0) + gameBalanceAmount;
        const saldoInUsed = Math.min(gameBalanceAmount, totalPrice);
        const mainUsed = totalPrice - saldoInUsed;
        return (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowBuySaldo(false); setBuyProduct(null); setBuyQuantity(1); setDiscountCode(""); setDiscountInfo(null); }}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg">Konfirmasi Pembelian</h3>
              <button onClick={() => { setShowBuySaldo(false); setBuyProduct(null); setBuyQuantity(1); setDiscountCode(""); setDiscountInfo(null); }} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
              <p className="font-bold text-sm flex items-center gap-1 flex-wrap">
                <span>{buyProduct.title}</span>
                <VerifiedBadge size="sm" />
              </p>
              {isFlash ? (
                <div>
                  <p className="text-muted-foreground text-xs line-through">{formatPrice(buyProduct.price)} / pcs</p>
                  <p className="text-red-500 font-extrabold text-lg">{formatPrice(unitPrice)} / pcs <span className="text-xs font-medium bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full ml-1">⚡ Flash Sale</span></p>
                </div>
              ) : isWholesale ? (
                <div>
                  <p className="text-muted-foreground text-xs line-through">{formatPrice(buyProduct.price)} / pcs</p>
                  <p className="text-accent font-extrabold text-lg">{formatPrice(unitPrice)} / pcs <span className="text-xs font-medium bg-accent/10 px-1.5 py-0.5 rounded-full ml-1">Grosir</span></p>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo utama</span><span className="font-bold">{formatPrice(userBalance?.balance || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo IN</span><span className="font-bold text-amber-500">{formatPrice(gameBalanceAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({buyQuantity}x)</span><span className="font-bold">-{formatPrice(basePrice)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between"><span className="text-accent">Diskon voucher</span><span className="font-bold text-accent">+{formatPrice(discount)}</span></div>
              )}
              {saldoInUsed > 0 && <div className="flex justify-between"><span className="text-amber-500">Dipakai dari Saldo IN</span><span className="font-bold text-amber-500">-{formatPrice(saldoInUsed)}</span></div>}
              {mainUsed > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Dipakai dari saldo utama</span><span className="font-bold">-{formatPrice(mainUsed)}</span></div>}
              <div className="flex justify-between border-t border-border pt-1"><span className="text-muted-foreground">Total bayar</span><span className="font-bold text-destructive">-{formatPrice(totalPrice)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sisa total saldo</span><span className={`font-bold ${availableStoreBalance >= totalPrice ? "text-primary" : "text-destructive"}`}>{formatPrice(availableStoreBalance - totalPrice)}</span></div>
            </div>
            {hasPin && <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> PIN akan diminta untuk konfirmasi</p>}
            <p className="text-xs text-muted-foreground text-center">{buyQuantity} token akun akan otomatis diberikan dari stok</p>
            <Button className="w-full h-11 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold gap-2"
              disabled={!userBalance || availableStoreBalance < totalPrice}
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
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setZoomScale(1); setZoomImage(imgs[0]); }}
                    className="relative aspect-square overflow-hidden bg-muted w-full block group/zoom cursor-zoom-in"
                    aria-label="Perbesar gambar"
                  >
                    <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover transition-transform duration-300 group-hover/zoom:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-extrabold bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded-full border border-white/20 shadow-lg opacity-90">
                      <Search className="w-3 h-3" /> Klik untuk zoom
                    </span>
                  </button>
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
                    <h3 className="text-white font-extrabold text-lg drop-shadow-lg line-clamp-2">
                      {p.title}
                      <VerifiedBadge size="sm" className="ml-1" />
                    </h3>
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
              {selectedDeposit.cancel_reason && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-2 mt-2">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Alasan</p>
                  <p className="text-xs font-semibold text-destructive">{selectedDeposit.cancel_reason}</p>
                </div>
              )}
              {selectedDeposit.status === "pending" && (
                <p className="text-[11px] text-amber-500 pt-1">⏰ Otomatis dibatalkan jika tidak dikonfirmasi admin dalam 24 jam.</p>
              )}
            </div>
            <Button className="w-full gap-2" onClick={() => copyText(selectedDeposit.trx_id, "deposit-transaction-id")}>
              <Copy className="w-4 h-4" /> Salin ID Transaksi
            </Button>
            {selectedDeposit.status === "pending" && (
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={async () => {
                  if (!confirm("Batalkan deposit ini? Tindakan tidak bisa dibatalkan.")) return;
                  const { data, error } = await supabase.functions.invoke("cancel-deposit", {
                    body: { depositId: selectedDeposit.id, visitorId: selectedDeposit.visitor_id, reason: "Dibatalkan oleh pengguna" },
                  });
                  if (error || (data as any)?.error) {
                    toast({ title: (data as any)?.error || "Gagal membatalkan", variant: "destructive" });
                    return;
                  }
                  toast({ title: "Deposit dibatalkan" });
                  setSelectedDeposit(null);
                  fetchDeposits();
                }}
              >
                <X className="w-4 h-4" /> Batalkan Deposit
              </Button>
            )}
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
              <p className="text-[11px] text-amber-500">⚠️ Ganti nama maksimal 3× dalam sebulan.</p>
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

                {/* Bonus Saldo IN preview (QRIS 15%, e-wallet 12%, min Rp 10.000) */}
                {(() => {
                  const amt = parseInt(depositAmount) || 0;
                  if (amt <= 0) return null;
                  const isEwallet = depositMethod !== "qris";
                  const pct = isEwallet ? 12 : 15;
                  if (amt < 10000) {
                    return (
                      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                        Minimal <b>Rp 10.000</b> untuk bonus <b>{pct}% Saldo IN</b> ({isEwallet ? "e-wallet" : "QRIS"}). Nominal sekarang: <b>Rp {amt.toLocaleString("id-ID")}</b>.
                      </div>
                    );
                  }
                  const bonus = Math.floor(amt * (pct / 100));
                  const total = amt + bonus;
                  return (
                    <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-r from-yellow-400/15 via-orange-400/10 to-pink-400/15 p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎁</span>
                        <p className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 tracking-wider uppercase flex-1">Bonus Saldo IN +{pct}% ({isEwallet ? "E-Wallet" : "QRIS"})</p>
                        <span className="text-[11px] font-black bg-yellow-400 text-yellow-950 rounded-full px-2 py-0.5 shadow">+{pct}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="rounded-lg bg-background/60 p-1.5">
                          <p className="text-[9px] text-muted-foreground uppercase">Deposit</p>
                          <p className="text-[11px] font-extrabold">Rp {amt.toLocaleString("id-ID")}</p>
                        </div>
                        <div className="rounded-lg bg-background/60 p-1.5">
                          <p className="text-[9px] text-muted-foreground uppercase">Bonus</p>
                          <p className="text-[11px] font-extrabold text-yellow-600 dark:text-yellow-400">+Rp {bonus.toLocaleString("id-ID")}</p>
                        </div>
                        <div className="rounded-lg bg-background/60 p-1.5">
                          <p className="text-[9px] text-muted-foreground uppercase">Total</p>
                          <p className="text-[11px] font-extrabold">Rp {total.toLocaleString("id-ID")}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">Bonus masuk ke <b>Saldo IN</b> setelah deposit dikonfirmasi admin. Top-up langsung oleh admin tetap dapat <b>15%</b>.</p>
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


      {/* === Apple Minimal Premium Bottom Nav === */}
      {!(tab === "anonchat" && anonView === "chat") && (
      <nav className="fixed left-0 right-0 z-50 px-3 pointer-events-none" style={{ bottom: "calc(env(safe-area-inset-bottom) + 10px)" }}>
        <div className="max-w-lg mx-auto pointer-events-auto">
          <div className="rounded-[26px] bg-background/70 backdrop-blur-2xl backdrop-saturate-200 border border-foreground/[0.08] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_-1px_0_0_rgba(0,0,0,0.04)_inset,0_20px_40px_-18px_rgba(0,0,0,0.35),0_8px_24px_-12px_rgba(0,0,0,0.25)] overflow-hidden">
            <div className="flex overflow-x-auto scrollbar-hide px-1.5 py-1.5 gap-0.5">
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
                { key: "streakmembership" as Tab, icon: Crown, label: "Membership Streak" },
                { key: "luckroyale" as any, icon: Crown, label: "Lucky Royale", external: "/luck-royale-nyawa" },
                { key: "streakvoucher" as Tab, icon: Ticket, label: "Streak Voucher" },
                { key: "game" as Tab, icon: Gamepad2, label: "Game" },
                { key: "plus" as Tab, icon: Gem, label: "Plus" },
                { key: "botnotif" as Tab, icon: Bell, label: "Bot Notifikasi" },
                { key: "anonchat" as Tab, icon: VenetianMask, label: "Anon Chat" },
                { key: "update" as Tab, icon: RefreshCw, label: "Update" },
                { key: "storeai" as Tab, icon: Sparkles, label: "Store AI" },
                { key: "confess" as Tab, icon: MessageSquareWarning, label: "Confess" },
                { key: "botgalau" as Tab, icon: HeartCrack, label: "Bot Galau" },
                { key: "rodadiskon" as Tab, icon: Disc3, label: "Roda Diskon" },
                { key: "adminpost" as Tab, icon: FileText, label: "Admin" },
              ] as Array<{ key: any; icon: any; label: string; external?: string }>).map(({ key, icon: Icon, label, external }) => {
                const active = !external && tab === key;
                const isSaldo = key === "saldo";
                return (
                  <button
                    key={key}
                    onClick={() => external ? navigate(external) : setTab(key)}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className={`group shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-2xl outline-none transition-all duration-300 ease-out relative ${active ? "bg-foreground/[0.08] scale-100" : "hover:bg-foreground/[0.04] active:scale-[0.94]"}`}
                  >
                    <span className="relative w-7 h-7 rounded-xl flex items-center justify-center">
                      <Icon
                        className={`transition-all duration-300 ease-out ${active ? "w-[19px] h-[19px] text-foreground" : "w-[17px] h-[17px] text-foreground/55 group-hover:text-foreground/85"}`}
                        strokeWidth={active ? 2.4 : 1.9}
                        fill={Icon === Heart && active ? "currentColor" : "none"}
                      />
                      {isSaldo && !active && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-foreground/70 ring-2 ring-background" />
                      )}
                    </span>
                    <span
                      className={`text-[9.5px] leading-none tracking-[-0.005em] transition-all duration-200 ${active ? "font-semibold text-foreground" : "font-medium text-foreground/55 group-hover:text-foreground/80"}`}
                    >
                      {label}
                    </span>
                    {active && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-foreground/80" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
      )}

      {/* Floating cart button moved into header (always visible next to language selector) */}

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
                            <p className="font-bold text-sm truncate flex items-center gap-1">
                              <span className="truncate">{item.product.title}</span>
                              <VerifiedBadge size="xs" />
                            </p>
                            {(() => {
                              const eff = getEffectivePrice(item.product.id, item.product.price, item.quantity);
                              const wp = eff.price;
                              return wp < item.product.price ? (
                                <div>
                                  <span className="text-muted-foreground text-xs line-through mr-1">{formatPrice(item.product.price)}</span>
                                  <span className={`font-extrabold text-sm ${eff.isFlash ? "text-red-500" : "text-accent"}`}>{formatPrice(wp)}{eff.isFlash ? " ⚡" : ""}</span>
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
                    {userBalance && <div className="flex justify-between"><span className="text-muted-foreground">Saldo + IN</span><span className={`font-bold ${spendableStoreBalance >= cartTotal ? "text-accent" : "text-destructive"}`}>{formatPrice(spendableStoreBalance)}</span></div>}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">Pilih item untuk checkout langsung dengan saldo</p>
                  {cart.map(item => {
                    const eff = getEffectivePrice(item.product.id, item.product.price, item.quantity);
                    const wp = eff.price;
                    const itemTotal = wp * item.quantity;
                    return (
                    <Button key={item.product.id} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold gap-2 text-xs"
                      disabled={!userBalance || spendableStoreBalance < itemTotal || item.product.stock < item.quantity}
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
