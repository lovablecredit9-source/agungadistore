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
  MessageCircle, AlertCircle, ImagePlus, Shield, Wallet, Users, ArrowUpCircle,
  Bell, Check, Tag, Lock, Key, Music, Upload, Loader2, HardDrive, Megaphone, FileText, Globe, Zap, Crown
} from "lucide-react";
import { generateVoucherCode } from "@/lib/voucher-code";
import { getDeviceSummary } from "@/lib/device-info";
import { STORE_NAME } from "@/lib/social-links";
import storeQris from "@/assets/store-qris.jpg";
import AdminMusicTab from "@/components/AdminMusicTab";
import AdminSponsorTab from "@/components/AdminSponsorTab";
import AdminApiKeyTab from "@/components/AdminApiKeyTab";
import AdminPostsTab from "@/components/AdminPostsTab";
import AdminPromoTab from "@/components/AdminPromoTab";
import AdminConfessTab from "@/components/AdminConfessTab";
import AdminProductFlashSaleTab from "@/components/AdminProductFlashSaleTab";
import AdminSocialLinksTab from "@/components/AdminSocialLinksTab";
import AdminLuckyWheelTab from "@/components/AdminLuckyWheelTab";
import AdminStreakShopTab from "@/components/AdminStreakShopTab";
import AdminStreakVoucherTab from "@/components/AdminStreakVoucherTab";
import AdminStreakEventTab from "@/components/AdminStreakEventTab";
import AdminStreakFlashSaleTab from "@/components/AdminStreakFlashSaleTab";
import AdminMembershipTab from "@/components/AdminMembershipTab";
import AdminBannedTab from "@/components/AdminBannedTab";
import WhatsAppChat from "@/components/WhatsAppChat";
import PremiumBadgeAsync from "@/components/PremiumBadgeAsync";
import AdminStorePremiumTab from "@/components/AdminStorePremiumTab";
import AdminUserResetPanel from "@/components/AdminUserResetPanel";
import AdminWaNotifTab from "@/components/AdminWaNotifTab";
import AdminTotalUserTab from "@/components/AdminTotalUserTab";
import AdminBotTab from "@/components/AdminBotTab";
import AdminAppearanceMenu from "@/components/AdminAppearanceMenu";
import { sendAdminWaNotif } from "@/lib/wa-notif";

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

interface WholesaleTier {
  id?: string;
  min_quantity: number;
  price_per_item: number;
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
  email?: string;
  balance: number;
  created_at: string;
}

type AdminTab = "products" | "tokens" | "claims" | "tickets" | "chats" | "saldo" | "notif" | "deposit" | "settings" | "diskon" | "pin" | "musik" | "vmusik" | "sponsor" | "apikey" | "postingan" | "promo" | "sosmed" | "wheel" | "shopstreak" | "eventstreak" | "flashsale" | "prodflash" | "membership" | "banned" | "storeprem" | "strvoucher" | "userreset" | "confess" | "wanotif" | "totaluser" | "bot";
type ClaimDateFilter = "all" | "today" | "yesterday" | "lastmonth" | "custom";
type DepositStatusFilter = "all" | "pending" | "approved" | "rejected" | "cancelled";
type DepositMethodFilter = "all" | "qris" | "ewallet";

function isEwalletMethod(method: string) {
  return method.trim().toLowerCase() !== "qris";
}

function getDepositStatusLabel(status: string) {
  if (status === "approved") return "✅ Disetujui";
  if (status === "rejected") return "❌ Ditolak";
  if (status === "cancelled") return "🚫 Dibatalkan";
  return "⏳ Belum dikonfirmasi";
}

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
  const [wholesaleTiers, setWholesaleTiers] = useState<WholesaleTier[]>([]);
  const [allWholesalePrices, setAllWholesalePrices] = useState<any[]>([]);

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

  // Notifications
  const [notifTarget, setNotifTarget] = useState("all");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");

  // Deposits
  interface Deposit {
    id: string; visitor_id: string; username: string; amount: number;
    payment_method: string; trx_id: string; status: string; created_at: string;
    cancel_reason?: string | null;
  }
  interface AdminSetting { id: string; setting_key: string; setting_value: string; }
  const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSetting[]>([]);
  const [settingQris, setSettingQris] = useState("");
  const [ewallets, setEwallets] = useState<{name: string; number: string; holder?: string; logo?: string}[]>([]);
  const [ewalletLogoUploading, setEwalletLogoUploading] = useState<number | null>(null);
  const [qrisUploading, setQrisUploading] = useState(false);
  const qrisFileRef = useRef<HTMLInputElement | null>(null);
  const [depositSearchTrx, setDepositSearchTrx] = useState("");
  const [depositStatusFilter, setDepositStatusFilter] = useState<DepositStatusFilter>("all");
  const [depositMethodFilter, setDepositMethodFilter] = useState<DepositMethodFilter>("all");
  const [depositSort, setDepositSort] = useState<"newest" | "oldest">("newest");

  const chatRef = useRef<HTMLDivElement>(null);

  // Discount Vouchers
  interface DiscountVoucher {
    id: string; code: string; discount_amount: number; max_uses: number;
    used_count: number; is_active: boolean; expires_at: string | null; created_at: string;
  }
  const [discountVouchers, setDiscountVouchers] = useState<DiscountVoucher[]>([]);
  const [dvCode, setDvCode] = useState("");
  const [dvAmount, setDvAmount] = useState("");
  const [dvMaxUses, setDvMaxUses] = useState("10");
  const [dvExpiry, setDvExpiry] = useState("");
  const [dvSendTarget, setDvSendTarget] = useState("all");

  // PIN Reset
  const [pinResetTarget, setPinResetTarget] = useState("");
  const [generatedResetToken, setGeneratedResetToken] = useState("");

  // Password Reset
  const [pwResetTarget, setPwResetTarget] = useState("");
  const [generatedPwResetToken, setGeneratedPwResetToken] = useState("");

  // Music Storage Vouchers
  interface MusicStorageVoucher {
    id: string; code: string; storage_mb: number; max_uses: number;
    used_count: number; is_active: boolean; expires_at: string | null; created_at: string;
  }
  interface MusicDiscountVoucher {
    id: string; code: string; discount_amount: number; max_uses: number;
    used_count: number; is_active: boolean; expires_at: string | null; created_at: string;
  }
  const [musicStorageVouchers, setMusicStorageVouchers] = useState<MusicStorageVoucher[]>([]);
  const [musicDiscountVouchers, setMusicDiscountVouchers] = useState<MusicDiscountVoucher[]>([]);
  const [msvStorageMb, setMsvStorageMb] = useState("");
  const [msvMaxUses, setMsvMaxUses] = useState("1");
  const [msvExpiryDate, setMsvExpiryDate] = useState("");
  const [msvExpiryTime, setMsvExpiryTime] = useState("");
  const [mdvCode, setMdvCode] = useState("");
  const [mdvAmount, setMdvAmount] = useState("");
  const [mdvMaxUses, setMdvMaxUses] = useState("10");
  const [mdvExpiryDate, setMdvExpiryDate] = useState("");
  const [mdvExpiryTime, setMdvExpiryTime] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    checkAuth();
    fetchAll();
    fetchTickets();
    fetchChats();
    fetchUserBalances();
    fetchDeposits();
    fetchAdminSettings();
    fetchDiscountVouchers();
    fetchMusicVouchers();

    // Heartbeat: update status admin online setiap 30 detik
    const sendHeartbeat = async () => {
      const nowIso = new Date().toISOString();
      await supabase.from("admin_settings").upsert(
        { setting_key: "admin_last_active", setting_value: nowIso, updated_at: nowIso },
        { onConflict: "setting_key" }
      );
    };
    sendHeartbeat();
    const hb = setInterval(sendHeartbeat, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") sendHeartbeat(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(hb);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function fetchDiscountVouchers() {
    const { data } = await supabase.from("discount_vouchers").select("*").order("created_at", { ascending: false });
    if (data) setDiscountVouchers(data as unknown as DiscountVoucher[]);
  }

  async function fetchMusicVouchers() {
    const [{ data: sv }, { data: dv }] = await Promise.all([
      supabase.from("music_storage_vouchers").select("*").order("created_at", { ascending: false }),
      supabase.from("music_discount_vouchers").select("*").order("created_at", { ascending: false }),
    ]);
    if (sv) setMusicStorageVouchers(sv as unknown as MusicStorageVoucher[]);
    if (dv) setMusicDiscountVouchers(dv as unknown as MusicDiscountVoucher[]);
  }

  function formatStorageMb(mb: number): string {
    if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(0)} TB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
    return `${mb} MB`;
  }

  async function createMusicStorageVoucher() {
    const storageMb = parseInt(msvStorageMb) || 0;
    if (storageMb <= 0) { toast({ title: "Isi jumlah MB", variant: "destructive" }); return; }
    const code = generateVoucherCode();
    let expiresAt: string | null = null;
    if (msvExpiryDate) {
      const time = msvExpiryTime || "23:59:59";
      expiresAt = new Date(`${msvExpiryDate}T${time}`).toISOString();
    }
    const { error } = await supabase.from("music_storage_vouchers").insert({
      code, storage_mb: storageMb, max_uses: parseInt(msvMaxUses) || 1, expires_at: expiresAt,
    } as any);
    if (error) { toast({ title: "Gagal buat voucher", variant: "destructive" }); return; }
    toast({ title: `Voucher ${formatStorageMb(storageMb)} berhasil dibuat! 🎵`, description: `Kode: ${code}` });
    setMsvStorageMb(""); setMsvMaxUses("1"); setMsvExpiryDate(""); setMsvExpiryTime("");
    fetchMusicVouchers();
  }

  async function deleteMusicStorageVoucher(id: string) {
    await supabase.from("music_storage_vouchers").delete().eq("id", id);
    toast({ title: "Voucher dihapus" }); fetchMusicVouchers();
  }

  async function toggleMusicStorageVoucher(v: MusicStorageVoucher) {
    await supabase.from("music_storage_vouchers").update({ is_active: !v.is_active } as any).eq("id", v.id);
    toast({ title: v.is_active ? "Voucher dinonaktifkan" : "Voucher diaktifkan" }); fetchMusicVouchers();
  }

  async function createMusicDiscountVoucher() {
    if (!mdvAmount) { toast({ title: "Isi nominal diskon", variant: "destructive" }); return; }
    const amount = parseInt(mdvAmount) || 0;
    if (amount <= 0) { toast({ title: "Nominal harus lebih dari 0", variant: "destructive" }); return; }
    let expiresAt: string | null = null;
    if (mdvExpiryDate) {
      const time = mdvExpiryTime || "23:59:59";
      expiresAt = new Date(`${mdvExpiryDate}T${time}`).toISOString();
    }
    const autoCode = generateVoucherCode();
    const { error } = await supabase.from("music_discount_vouchers").insert({
      code: autoCode, discount_amount: amount,
      max_uses: parseInt(mdvMaxUses) || 10, expires_at: expiresAt,
    } as any);
    if (error) { toast({ title: "Gagal buat voucher", variant: "destructive" }); return; }
    toast({ title: `Voucher diskon musik ${autoCode} Rp${amount.toLocaleString()} berhasil dibuat! 🎵` });
    setMdvCode(autoCode); setMdvAmount(""); setMdvMaxUses("10"); setMdvExpiryDate(""); setMdvExpiryTime("");
    fetchMusicVouchers();
  }

  async function deleteMusicDiscountVoucher(id: string) {
    await supabase.from("music_discount_vouchers").delete().eq("id", id);
    toast({ title: "Voucher dihapus" }); fetchMusicVouchers();
  }

  async function toggleMusicDiscountVoucher(v: MusicDiscountVoucher) {
    await supabase.from("music_discount_vouchers").update({ is_active: !v.is_active } as any).eq("id", v.id);
    toast({ title: v.is_active ? "Voucher dinonaktifkan" : "Voucher diaktifkan" }); fetchMusicVouchers();
  }

  async function createDiscountVoucher() {
    if (!dvAmount) { toast({ title: "Isi nominal diskon", variant: "destructive" }); return; }
    const amount = parseInt(dvAmount) || 0;
    if (amount <= 0) { toast({ title: "Nominal harus lebih dari 0", variant: "destructive" }); return; }
    const autoCode = generateVoucherCode();
    const { error } = await supabase.from("discount_vouchers").insert({
      code: autoCode,
      discount_amount: amount,
      max_uses: parseInt(dvMaxUses) || 10,
      expires_at: dvExpiry ? new Date(dvExpiry).toISOString() : null,
    } as any);
    if (error) { toast({ title: "Gagal buat voucher", variant: "destructive" }); return; }
    toast({ title: `Voucher ${autoCode} berhasil dibuat! 🏷️` });
    setDvCode(autoCode); setDvAmount(""); setDvMaxUses("10"); setDvExpiry("");
    fetchDiscountVouchers();
  }

  async function toggleDiscountVoucher(v: DiscountVoucher) {
    await supabase.from("discount_vouchers").update({ is_active: !v.is_active } as any).eq("id", v.id);
    toast({ title: v.is_active ? "Voucher dinonaktifkan" : "Voucher diaktifkan" });
    fetchDiscountVouchers();
  }

  async function deleteDiscountVoucher(id: string) {
    await supabase.from("discount_vouchers").delete().eq("id", id);
    toast({ title: "Voucher dihapus" });
    fetchDiscountVouchers();
  }

  async function sendDiscountVoucherNotif(v: DiscountVoucher) {
    const message = `🏷️ Kode diskon: ${v.code}\nDiskon: Rp${v.discount_amount.toLocaleString()}\n${v.expires_at ? `Berlaku sampai: ${new Date(v.expires_at).toLocaleDateString("id-ID")}` : "Tidak ada batas waktu"}\nMasukkan kode saat checkout!`;
    if (dvSendTarget === "all") {
      const inserts = userBalances.map(u => ({
        visitor_id: u.visitor_id, title: "Voucher Diskon Baru! 🏷️", message, type: "discount_voucher",
      }));
      if (inserts.length === 0) { toast({ title: "Tidak ada user", variant: "destructive" }); return; }
      await supabase.from("notifications").insert(inserts as any);
      toast({ title: `Voucher dikirim ke ${inserts.length} user! 📢` });
    } else {
      await supabase.from("notifications").insert({
        visitor_id: dvSendTarget, title: "Voucher Diskon Baru! 🏷️", message, type: "discount_voucher",
      } as any);
      toast({ title: "Voucher dikirim! 📢" });
    }
  }

  async function generatePinResetToken() {
    if (!pinResetTarget) { toast({ title: "Pilih user", variant: "destructive" }); return; }
    // Invalidate old tokens first
    await supabase.functions.invoke("manage-pin", {
      body: { action: "invalidate_tokens", visitorId: pinResetTarget },
    });
    const numToken = String(Math.floor(10000 + Math.random() * 90000));
    const { error } = await supabase.from("pin_reset_tokens").insert({
      visitor_id: pinResetTarget, token: numToken,
    } as any);
    if (error) { toast({ title: "Gagal buat token", variant: "destructive" }); return; }
    setGeneratedResetToken(numToken);
    await supabase.from("notifications").insert({
      visitor_id: pinResetTarget, title: "Token Reset PIN 🔑", message: `Token reset PIN Anda: #${numToken}\nGunakan untuk membuat PIN baru.`, type: "pin_reset",
    } as any);
    toast({ title: `Token reset dibuat: #${numToken}` });
  }

  async function generatePwResetToken() {
    if (!pwResetTarget) { toast({ title: "Pilih user", variant: "destructive" }); return; }
    // Invalidate old password reset tokens
    await supabase.from("password_reset_tokens").update({ is_used: true } as any).eq("visitor_id", pwResetTarget).eq("is_used", false);
    const numPwToken = String(Math.floor(10000 + Math.random() * 90000));
    const { error } = await supabase.from("password_reset_tokens").insert({
      visitor_id: pwResetTarget, token: numPwToken,
    } as any);
    if (error) { toast({ title: "Gagal buat token", variant: "destructive" }); return; }
    setGeneratedPwResetToken(numPwToken);
    await supabase.from("notifications").insert({
      visitor_id: pwResetTarget, title: "Token Reset Sandi 🔐", message: `Token reset sandi Anda: #${numPwToken}\nGunakan untuk membuat sandi baru.`, type: "password_reset",
    } as any);
    toast({ title: `Token reset sandi dibuat: #${numPwToken}` });
  }

  async function fetchDeposits() {
    const { data } = await supabase.from("deposits").select("*").order("created_at", { ascending: false });
    if (data) setAllDeposits(data as unknown as Deposit[]);
  }

  async function fetchAdminSettings() {
    const { data } = await supabase.from("admin_settings").select("*");
    if (data) {
      setAdminSettings(data as unknown as AdminSetting[]);
      const q = (data as any[]).find(s => s.setting_key === "qris_url");
      if (q) setSettingQris(q.setting_value);
      const ew = (data as any[]).find(s => s.setting_key === "ewallets");
      if (ew) {
        try { setEwallets(JSON.parse(ew.setting_value)); } catch { setEwallets([]); }
      }
    }
  }

  async function updateSetting(key: string, value: string) {
    const existing = adminSettings.find(s => s.setting_key === key);
    if (existing) {
      await supabase.from("admin_settings").update({ setting_value: value }).eq("setting_key", key);
    } else {
      await supabase.from("admin_settings").insert({ setting_key: key, setting_value: value } as any);
    }
  }

  async function handleQrisUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrisUploading(true);
    const fileName = `qris_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from("payment-images").upload(fileName, file, { upsert: true });
    if (error) { toast({ title: "Upload gagal!", variant: "destructive" }); setQrisUploading(false); return; }
    const { data: urlData } = supabase.storage.from("payment-images").getPublicUrl(fileName);
    const url = urlData.publicUrl;
    setSettingQris(url);
    await updateSetting("qris_url", url);
    toast({ title: "QRIS berhasil diupload! ✅" });
    setQrisUploading(false);
    fetchAdminSettings();
  }

  async function handleEwalletLogoUpload(e: React.ChangeEvent<HTMLInputElement>, idx: number) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEwalletLogoUploading(idx);
    const fileName = `ewallet_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from("payment-images").upload(fileName, file, { upsert: true });
    if (error) { toast({ title: "Upload gagal!", variant: "destructive" }); setEwalletLogoUploading(null); return; }
    const { data: urlData } = supabase.storage.from("payment-images").getPublicUrl(fileName);
    const arr = [...ewallets]; arr[idx] = { ...arr[idx], logo: urlData.publicUrl }; setEwallets(arr);
    toast({ title: "Logo e-wallet diupload! ✅" });
    setEwalletLogoUploading(null);
  }

  async function saveAllSettings() {
    await Promise.all([
      updateSetting("qris_url", settingQris),
      updateSetting("ewallets", JSON.stringify(ewallets)),
    ]);
    toast({ title: "Pengaturan tersimpan! ✅" });
    fetchAdminSettings();
  }

  async function approveDeposit(dep: Deposit) {
    if (dep.status !== "pending") {
      toast({ title: "Deposit ini sudah diproses", variant: "destructive" });
      return;
    }
    const user = userBalances.find(u => u.visitor_id === dep.visitor_id);
    if (!user) { toast({ title: "User tidak ditemukan", variant: "destructive" }); return; }
    const { data: updatedDeposit, error: depositError } = await supabase.from("deposits").update({ status: "approved" } as any).eq("id", dep.id).eq("status", "pending").select("id");
    if (depositError || !updatedDeposit?.length) {
      toast({ title: "Deposit sudah diproses atau gagal diupdate", variant: "destructive" });
      fetchDeposits();
      return;
    }
    // Hitung bonus 10% jika deposit >= Rp 10.000 (masuk ke saldo IN terpisah)
    const bonus = dep.amount >= 10000 ? Math.floor(dep.amount * 0.1) : 0;
    // Add saldo utama (pokok saja)
    await supabase.from("user_balances").update({ balance: user.balance + dep.amount }).eq("id", user.id);
    // Add saldo IN (terpisah)
    if (bonus > 0) {
      await supabase.rpc("add_topup_bonus_to_saldo_in" as any, { p_visitor_id: dep.visitor_id, p_amount: bonus });
    }
    // Record transaction (pokok)
    await supabase.from("balance_transactions").insert({
      visitor_id: dep.visitor_id, type: "topup", amount: dep.amount,
      description: `Deposit ${dep.payment_method.toUpperCase()} - TRX: ${dep.trx_id}`,
    });
    if (bonus > 0) {
      await supabase.from("balance_transactions").insert({
        visitor_id: dep.visitor_id, type: "topup_bonus", amount: bonus,
        description: `🎁 Bonus 10% deposit → Saldo IN (TRX: ${dep.trx_id})`,
      });
    }
    const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
    await supabase.from("notifications").insert({
      visitor_id: dep.visitor_id, title: "Deposit Disetujui ✅",
      message: bonus > 0
        ? `Deposit ${fmt(dep.amount)} berhasil. Bonus 10% +${fmt(bonus)} masuk ke Saldo IN (bisa dipakai untuk Game Shop).`
        : `Deposit ${fmt(dep.amount)} berhasil diverifikasi. Saldo telah ditambahkan.`,
      type: "deposit_approved",
    } as any);
    toast({ title: bonus > 0 ? `Deposit ${fmt(dep.amount)} disetujui + Bonus ${fmt(bonus)} (Saldo IN)` : `Deposit ${fmt(dep.amount)} disetujui!` });
    fetchDeposits();
    fetchUserBalances();
  }

  async function rejectDeposit(dep: Deposit) {
    if (dep.status !== "pending") {
      toast({ title: "Deposit ini sudah diproses", variant: "destructive" });
      return;
    }
    const choice = window.prompt(
      "Alasan penolakan deposit:\n\n1 = Bukti palsu\n2 = Belum bayar\n3 = Custom (isi sendiri)\n\nKetik 1, 2, atau alasan custom:",
      "1"
    );
    if (choice === null) return;
    let reason = "";
    if (choice.trim() === "1") reason = "Bukti pembayaran palsu";
    else if (choice.trim() === "2") reason = "Belum melakukan pembayaran";
    else if (choice.trim() === "3") {
      const custom = window.prompt("Masukkan alasan custom:", "");
      if (!custom || !custom.trim()) { toast({ title: "Alasan wajib diisi", variant: "destructive" }); return; }
      reason = custom.trim();
    } else reason = choice.trim() || "Ditolak admin";

    const { data: updatedDeposit, error: depositError } = await supabase.from("deposits").update({ status: "rejected", cancel_reason: reason } as any).eq("id", dep.id).eq("status", "pending").select("id");
    if (depositError || !updatedDeposit?.length) {
      toast({ title: "Deposit sudah diproses atau gagal diupdate", variant: "destructive" });
      fetchDeposits();
      return;
    }
    await supabase.from("notifications").insert({
      visitor_id: dep.visitor_id, title: "Deposit Ditolak ❌",
      message: `Deposit ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(dep.amount)} ditolak. Alasan: ${reason}`,
      type: "deposit_rejected",
    } as any);
    toast({ title: "Deposit ditolak", description: `Alasan: ${reason}` });
    fetchDeposits();
  }

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/admin/login");
  }

   async function fetchAll() {
    const [pRes, piRes, fRes, tRes, cRes, wRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_images").select("*").order("image_order"),
      supabase.from("product_fields").select("*").order("field_order"),
      supabase.from("tokens").select("*").order("created_at", { ascending: false }),
      supabase.from("token_claims").select("*").order("claimed_at", { ascending: false }),
      supabase.from("wholesale_prices").select("*").eq("entity_type", "product").order("min_quantity"),
    ]);
    if (pRes.data) setProducts(pRes.data as unknown as Product[]);
    if (piRes.data) setProductImages(piRes.data as ProductImage[]);
    if (fRes.data) setFields(fRes.data);
    if (tRes.data) setTokens(tRes.data);
    if (cRes.data) setClaims(cRes.data);
    if (wRes.data) setAllWholesalePrices(wRes.data);
  }

  async function fetchTickets() {
    const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (data) setAllTickets(data as unknown as SupportTicket[]);
  }

  async function fetchChats() {
    const { data } = await supabase.from("product_chats").select("*").order("created_at", { ascending: false });
    if (data) setAllChats(data as unknown as ProductChat[]);
  }

  async function fetchUserBalances() {
    const { data } = await supabase.from("user_balances").select("*").order("created_at", { ascending: false });
    if (data) setUserBalances(data as unknown as UserBalance[]);
  }

  async function addTopup() {
    if (!topupVisitorId || !topupAmount) { toast({ title: "Pilih user dan isi jumlah", variant: "destructive" }); return; }
    const amount = parseInt(topupAmount) || 0;
    if (amount <= 0) { toast({ title: "Jumlah harus lebih dari 0", variant: "destructive" }); return; }
    const user = userBalances.find(u => u.visitor_id === topupVisitorId);
    if (!user) { toast({ title: "User tidak ditemukan", variant: "destructive" }); return; }

    // Hitung bonus 10% jika top up >= Rp 10.000 (masuk ke saldo IN terpisah)
    const bonus = amount >= 10000 ? Math.floor(amount * 0.1) : 0;
    const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

    // Update saldo utama (pokok saja)
    await supabase.from("user_balances").update({ balance: user.balance + amount }).eq("id", user.id);
    if (bonus > 0) {
      await supabase.rpc("add_topup_bonus_to_saldo_in" as any, { p_visitor_id: topupVisitorId, p_amount: bonus });
    }
    await supabase.from("balance_transactions").insert({
      visitor_id: topupVisitorId, type: "topup", amount, description: topupDesc.trim() || `Topup saldo oleh admin`,
    });
    if (bonus > 0) {
      await supabase.from("balance_transactions").insert({
        visitor_id: topupVisitorId, type: "topup_bonus", amount: bonus,
        description: `🎁 Bonus 10% topup admin → Saldo IN (${fmt(amount)})`,
      });
    }
    toast({ title: bonus > 0 ? `Saldo ${user.username} +${fmt(amount)} | Saldo IN +${fmt(bonus)}` : `Saldo ${user.username} ditambah ${fmt(amount)}` });
    await supabase.from("notifications").insert({
      visitor_id: topupVisitorId,
      title: bonus > 0 ? "🎁 Saldo + Bonus 10%" : "Saldo Ditambahkan 💰",
      message: bonus > 0
        ? `Saldo utama +${fmt(amount)}. Bonus 10% +${fmt(bonus)} masuk ke Saldo IN (bisa dipakai untuk Game Shop).`
        : `Saldo kamu bertambah ${fmt(amount)}`,
      type: "topup",
    } as any);
    setTopupAmount(""); setTopupDesc("");
    fetchUserBalances();
  }

  async function adminResetBalance(user: UserBalance) {
    if (!confirm(`Reset saldo ${user.username} ke Rp 0?`)) return;
    await supabase.from("user_balances").update({ balance: 0 }).eq("id", user.id);
    await supabase.from("notifications").insert({ visitor_id: user.visitor_id, title: "Saldo Direset", message: "Saldo kamu telah direset oleh admin menjadi Rp 0", type: "info" } as any);
    toast({ title: `Saldo ${user.username} berhasil direset ke Rp 0` });
    fetchUserBalances();
  }

  async function adminResetCredits(user: UserBalance) {
    if (!confirm(`Reset kredit game ${user.username} ke 0?`)) return;
    await supabase.from("user_game_credits").update({ credits: 0, unlimited_until: null }).eq("visitor_id", user.visitor_id);
    await supabase.from("notifications").insert({ visitor_id: user.visitor_id, title: "Kredit Direset", message: "Kredit game kamu telah direset oleh admin", type: "info" } as any);
    toast({ title: `Kredit ${user.username} berhasil direset` });
  }

  async function adminResetStreak(user: UserBalance) {
    if (!confirm(`Reset streak ${user.username}? (streak & langganan akan dihapus)`)) return;
    await supabase.from("daily_streaks").delete().eq("visitor_id", user.visitor_id);
    await supabase.from("streak_subscriptions").update({ is_active: false }).eq("visitor_id", user.visitor_id);
    await supabase.from("notifications").insert({ visitor_id: user.visitor_id, title: "Streak Direset", message: "Data streak kamu telah direset oleh admin", type: "info" } as any);
    toast({ title: `Streak ${user.username} berhasil direset` });
  }

  async function adminResetStorage(user: UserBalance) {
    if (!confirm(`Reset storage ${user.username}? (semua kuota storage akan dihapus)`)) return;
    await supabase.from("user_music_storage").delete().eq("visitor_id", user.visitor_id);
    await supabase.from("notifications").insert({ visitor_id: user.visitor_id, title: "Storage Direset", message: "Kuota storage musik kamu telah direset oleh admin", type: "info" } as any);
    toast({ title: `Storage ${user.username} berhasil direset` });
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
    const tiers = allWholesalePrices.filter((w: any) => w.entity_id === p.id).map((w: any) => ({ id: w.id, min_quantity: w.min_quantity, price_per_item: w.price_per_item }));
    setWholesaleTiers(tiers.length > 0 ? tiers : []);
  }

  function resetForm() {
    setEditingProduct(null);
    setTitle(""); setDesc(""); setPrice(""); setStock("1"); setCategory(""); setHasWarranty(false);
    setNewFields(["Email", "Password", "No HP", "A2F"]); clearPendingImages();
    setWholesaleTiers([]);
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
      const updateData: { title: string; description: string | null; price: number; stock: number; category: string | null; has_warranty: boolean; image_url?: string } = {
        title, description: desc || null, price: parseInt(price) || 0,
        stock: parseInt(stock) || 0, category: category || null, has_warranty: hasWarranty,
      };
      if (uploadedUrls.length > 0) updateData.image_url = uploadedUrls[0];
      await supabase.from("products").update(updateData).eq("id", editingProduct.id);
      sendAdminWaNotif("product_edit", {
        action: "DIUBAH",
        produk_id: `#${String(editingProduct.id).replace(/\D/g, "").slice(-5) || "—"}`,
        produk: title,
        harga: (parseInt(price) || 0).toLocaleString("id-ID"),
        stok: parseInt(stock) || 0,
        user: "Admin",
      });

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

      // Save wholesale tiers
      await supabase.from("wholesale_prices").delete().eq("entity_type", "product").eq("entity_id", editingProduct.id);
      const validTiers = wholesaleTiers.filter(t => t.min_quantity >= 2 && t.price_per_item > 0);
      if (validTiers.length > 0) {
        await supabase.from("wholesale_prices").insert(validTiers.map(t => ({
          entity_type: "product" as const, entity_id: editingProduct.id, min_quantity: t.min_quantity, price_per_item: t.price_per_item,
        })));
      }
      toast({ title: "Produk diperbarui!" });
    } else {
      const { data: product, error } = await supabase.from("products").insert({
        title, description: desc || null, price: parseInt(price) || 0,
        stock: parseInt(stock) || 0, image_url: uploadedUrls[0] || null,
        category: category || null, has_warranty: hasWarranty,
      }).select().single();

      if (error || !product) { toast({ title: "Gagal menambah produk", variant: "destructive" }); return; }

      sendAdminWaNotif("product_edit", {
        action: "DITAMBAHKAN",
        produk_id: `#${String(product.id).replace(/\D/g, "").slice(-5) || "—"}`,
        produk: title,
        harga: (parseInt(price) || 0).toLocaleString("id-ID"),
        stok: parseInt(stock) || 0,
        user: "Admin",
      });

      if (uploadedUrls.length > 0) {
        await supabase.from("product_images").insert(uploadedUrls.map((url, i) => ({
          product_id: product.id, image_url: url, image_order: i,
        })));
      }

      const fieldInserts = newFields.filter(Boolean).map((name, i) => ({
        product_id: product.id, field_name: name, field_order: i,
      }));
      if (fieldInserts.length > 0) await supabase.from("product_fields").insert(fieldInserts);

      // Save wholesale tiers
      const validTiers = wholesaleTiers.filter(t => t.min_quantity >= 2 && t.price_per_item > 0);
      if (validTiers.length > 0) {
        await supabase.from("wholesale_prices").insert(validTiers.map(t => ({
          entity_type: "product" as const, entity_id: product.id, min_quantity: t.min_quantity, price_per_item: t.price_per_item,
        })));
      }
      toast({ title: "Produk ditambahkan!" });
    }
    resetForm(); fetchAll();
  }

  async function handleDeleteProduct(id: string) {
    const prod = products.find(p => p.id === id);
    await supabase.from("wholesale_prices").delete().eq("entity_type", "product").eq("entity_id", id);
    await supabase.from("product_images").delete().eq("product_id", id);
    await supabase.from("products").delete().eq("id", id);
    sendAdminWaNotif("product_edit", {
      action: "DIHAPUS",
      produk_id: `#${String(id).replace(/\D/g, "").slice(-5) || "—"}`,
      produk: prod?.title || "-",
      harga: (prod?.price || 0).toLocaleString("id-ID"),
      stok: prod?.stock || 0,
      user: "Admin",
    });
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
    if (data) {
      setTicketMessages(data as unknown as TicketMessage[]);
      // Mark user messages as read
      const unreadIds = data.filter((m: any) => m.sender_type === "user" && !m.is_read).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from("ticket_messages").update({ is_read: true } as any).in("id", unreadIds);
      }
    }
    setTimeout(() => ticketChatRef.current?.scrollTo(0, ticketChatRef.current.scrollHeight), 100);
  }

   async function sendTicketMessage() {
    if (!ticketMsg.trim() || !activeTicket) return;
    const body = ticketMsg.trim();
    await supabase.from("ticket_messages").insert({
      ticket_id: activeTicket.id, sender_type: "admin", message: body,
    });
    // Notify visitor via stored ticket IDs — use ticket's phone as identifier
    // We need visitor_id from the ticket — search user_balances by phone
    const matchingUser = userBalances.find(u => u.phone === activeTicket.phone);
    if (matchingUser) {
      await supabase.from("notifications").insert({
        visitor_id: matchingUser.visitor_id, title: "Balasan Admin 💬", message: `Admin membalas tiket #${activeTicket.ticket_number}`, type: "ticket_reply", related_id: activeTicket.id,
      } as any);
    }
    // Kirim balasan ke WhatsApp user via antrian bot (jika bot aktif)
    try {
      const { data: settings } = await supabase.from("admin_settings").select("setting_key, setting_value").in("setting_key", ["bot_enabled", "bot_ticket_reply_prefix"]);
      const map = Object.fromEntries((settings ?? []).map((s: any) => [s.setting_key, s.setting_value]));
      if ((map.bot_enabled ?? "true") !== "false" && activeTicket.phone) {
        const prefix = (map.bot_ticket_reply_prefix || "💬 *Balasan Admin untuk Tiket #{ticket}*").replace("{ticket}", String(activeTicket.ticket_number));
        await supabase.from("wa_outbox").insert({
          phone: activeTicket.phone,
          message: `${prefix}\n\n${body}`,
          source: "ticket_reply",
          related_id: activeTicket.id,
        } as any);
      }
    } catch (e) { /* antrian WA opsional */ }
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
    if (data) {
      setChatMessages(data as unknown as ProductChatMessage[]);
      // Mark user messages as read
      const unreadIds = data.filter((m: any) => m.sender_type === "user" && !m.is_read).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from("product_chat_messages").update({ is_read: true } as any).in("id", unreadIds);
      }
    }
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  }

  async function sendChatMessage() {
    if (!chatMsg.trim() || !activeChat) return;
    await supabase.from("product_chat_messages").insert({
      chat_id: activeChat.id, sender_type: "admin", message: chatMsg.trim(),
    });
    // Notify the visitor
    await supabase.from("notifications").insert({
      visitor_id: activeChat.visitor_id, title: "Balasan Chat 💬", message: `Admin membalas chat produk Anda`, type: "chat_reply", related_id: activeChat.id,
    } as any);
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

  async function sendBroadcastNotification() {
    if (!notifTitle.trim()) { toast({ title: "Isi judul notifikasi", variant: "destructive" }); return; }
    if (notifTarget === "all") {
      // Send to all registered users
      const inserts = userBalances.map(u => ({
        visitor_id: u.visitor_id, title: notifTitle.trim(), message: notifMessage.trim() || null, type: "broadcast",
      }));
      if (inserts.length === 0) { toast({ title: "Tidak ada user terdaftar", variant: "destructive" }); return; }
      const { error } = await supabase.from("notifications").insert(inserts as any);
      if (error) { toast({ title: "Gagal kirim notifikasi", variant: "destructive" }); return; }
      toast({ title: `Notifikasi terkirim ke ${inserts.length} user! 📢` });
    } else {
      const { error } = await supabase.from("notifications").insert({
        visitor_id: notifTarget, title: notifTitle.trim(), message: notifMessage.trim() || null, type: "broadcast",
      } as any);
      if (error) { toast({ title: "Gagal kirim notifikasi", variant: "destructive" }); return; }
      toast({ title: "Notifikasi terkirim! 📢" });
    }
    setNotifTitle(""); setNotifMessage("");
  }

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
  const filteredDeposits = [...allDeposits]
    .filter((dep) => depositSearchTrx ? [dep.trx_id, dep.username, dep.payment_method].some((value) => value.toLowerCase().includes(depositSearchTrx.toLowerCase())) : true)
    .filter((dep) => depositStatusFilter === "all" ? true : dep.status === depositStatusFilter)
    .filter((dep) => {
      if (depositMethodFilter === "all") return true;
      return depositMethodFilter === "qris" ? dep.payment_method.trim().toLowerCase() === "qris" : isEwalletMethod(dep.payment_method);
    })
    .sort((a, b) => depositSort === "newest"
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 shadow-xl">
        <div className="bg-gradient-to-r from-primary via-primary/90 to-accent/80 text-primary-foreground px-4 py-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight">Admin Panel</h1>
                <p className="text-[10px] opacity-70">Dashboard Pengelolaan {STORE_NAME}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AdminAppearanceMenu />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:text-primary-foreground/80 bg-white/10 hover:bg-white/20 rounded-xl gap-1.5 font-bold">
                <LogOut className="w-4 h-4" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* === Apple Minimal Premium Tab Navigation === */}
      <div className="sticky top-[60px] z-40 border-b border-border/70 bg-background/80 backdrop-blur-2xl backdrop-saturate-200 shadow-[0_12px_34px_-30px_hsl(var(--foreground)/0.45)]">
        <div className="relative max-w-lg mx-auto px-2 py-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent z-10" />
          <div className="flex overflow-x-auto scrollbar-hide gap-1 rounded-[24px] border border-border/70 bg-card/55 p-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] snap-x snap-mandatory">
          {([
            { key: "userreset" as AdminTab, icon: Users, label: "🔧 Reset User" },
            { key: "totaluser" as AdminTab, icon: Users, label: "👥 Total User" },
            { key: "bot" as AdminTab, icon: MessageCircle, label: "🤖 Bot WA" },

            { key: "products" as AdminTab, icon: Package, label: "Produk" },
            { key: "tokens" as AdminTab, icon: Ticket, label: "Token" },
            { key: "claims" as AdminTab, icon: Clock, label: "Klaim" },
            { key: "saldo" as AdminTab, icon: Wallet, label: "Saldo" },
            { key: "deposit" as AdminTab, icon: ArrowUpCircle, label: "Deposit" },
            { key: "diskon" as AdminTab, icon: Tag, label: "Diskon" },
            { key: "pin" as AdminTab, icon: Lock, label: "PIN" },
            { key: "tickets" as AdminTab, icon: AlertCircle, label: "Tiket" },
            { key: "chats" as AdminTab, icon: MessageCircle, label: "Chat" },
            { key: "notif" as AdminTab, icon: Bell, label: "Notif" },
            { key: "settings" as AdminTab, icon: Edit2, label: "Setting" },
            { key: "musik" as AdminTab, icon: Music, label: "Musik" },
            { key: "vmusik" as AdminTab, icon: HardDrive, label: "V.Musik" },
            { key: "sponsor" as AdminTab, icon: Megaphone, label: "Sponsor" },
            { key: "apikey" as AdminTab, icon: Key, label: "API" },
            { key: "postingan" as AdminTab, icon: FileText, label: "Post" },
            { key: "promo" as AdminTab, icon: Tag, label: "Promo" },
            { key: "sosmed" as AdminTab, icon: Globe, label: "Sosmed" },
            { key: "wheel" as AdminTab, icon: Tag, label: "Wheel" },
            { key: "shopstreak" as AdminTab, icon: Tag, label: "Shop" },
            { key: "strvoucher" as AdminTab, icon: Tag, label: "Voucher" },
            { key: "eventstreak" as AdminTab, icon: Tag, label: "Event" },
            { key: "flashsale" as AdminTab, icon: Tag, label: "Flash" },
            { key: "prodflash" as AdminTab, icon: Zap, label: "F.Produk" },
            { key: "membership" as AdminTab, icon: Shield, label: "Member" },
            { key: "storeprem" as AdminTab, icon: Crown, label: "PremToko" },
            { key: "banned" as AdminTab, icon: Lock, label: "Banned" },
            { key: "confess" as AdminTab, icon: MessageCircle, label: "Confess" },
            { key: "wanotif" as AdminTab, icon: Bell, label: "WA Notif" },

            
          ]).map(({ key, icon: Icon, label }) => {
            const active = tab === key;
            const badgeCount = key === "tickets" ? allTickets.filter(t => t.status === "open").length
              : key === "chats" ? allChats.filter(c => c.status === "open").length
              : key === "deposit" ? allDeposits.filter(d => d.status === "pending").length : 0;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={active ? "page" : undefined}
                className={`group relative shrink-0 snap-center flex flex-col items-center justify-center gap-1 min-w-[62px] px-2.5 py-2 rounded-[20px] outline-none transition-all duration-300 ease-out ${active ? "bg-primary/10 text-primary shadow-[0_10px_26px_-18px_hsl(var(--primary)/0.9),inset_0_1px_0_hsl(var(--primary-foreground)/0.16)] ring-1 ring-primary/15" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground active:scale-[0.94]"}`}
              >
                <span className={`relative w-7 h-7 rounded-2xl flex items-center justify-center transition-all duration-300 ${active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 group-hover:bg-background"}`}>
                  <Icon
                    className={`transition-all duration-300 ease-out ${active ? "w-[17px] h-[17px]" : "w-4 h-4"}`}
                    strokeWidth={active ? 2.4 : 1.9}
                  />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-bold min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5 ring-2 ring-background">{badgeCount}</span>
                  )}
                </span>
                <span className={`max-w-[54px] truncate text-[9.5px] leading-none tracking-normal transition-all duration-200 ${active ? "font-bold" : "font-semibold"}`}>
                  {label}
                </span>
                {active && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
          </div>
        </div>
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
                  {/* Wholesale / Harga Grosir */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">💰 Harga Grosir (opsional)</label>
                    <p className="text-[10px] text-muted-foreground">Atur harga per item lebih murah jika beli banyak</p>
                    {wholesaleTiers.map((tier, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground">Min. Qty</label>
                          <Input type="number" min={2} placeholder="Min qty" value={tier.min_quantity || ""} onChange={e => { const c = [...wholesaleTiers]; c[i] = { ...c[i], min_quantity: parseInt(e.target.value) || 2 }; setWholesaleTiers(c); }} />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground">Harga/pcs</label>
                          <Input type="number" min={0} placeholder="Harga per item" value={tier.price_per_item || ""} onChange={e => { const c = [...wholesaleTiers]; c[i] = { ...c[i], price_per_item: parseInt(e.target.value) || 0 }; setWholesaleTiers(c); }} />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="mt-4" onClick={() => setWholesaleTiers(wholesaleTiers.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setWholesaleTiers([...wholesaleTiers, { min_quantity: 2, price_per_item: parseInt(price) || 0 }])}><Plus className="w-3 h-3 mr-1" /> Tambah Tier Grosir</Button>
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
                        <span className="font-bold text-sm text-primary flex items-center gap-1">
                          Tiket #{t.ticket_number}
                          {(() => {
                            const u = userBalances.find(x => x.phone === t.phone);
                            return u ? <PremiumBadgeAsync visitorId={u.visitor_id} /> : null;
                          })()}
                        </span>
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

                <WhatsAppChat
                  kind="ticket"
                  parentId={activeTicket.id}
                  viewerType="admin"
                  viewerId="admin"
                  incomingLabel={activeTicket.name}
                  className="bg-muted/30 rounded-xl border border-border h-[60vh]"
                  scrollClassName="max-h-full"
                  headerSlot={
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs space-y-1">
                      <p><strong>Nama:</strong> {activeTicket.name}</p>
                      <p><strong>HP:</strong> {activeTicket.phone}</p>
                      <p><strong>Masalah:</strong> {activeTicket.description}</p>
                      <p className="text-muted-foreground">{new Date(activeTicket.created_at).toLocaleString("id-ID")}</p>
                    </div>
                  }
                />
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
                          <p className="font-bold text-sm truncate flex items-center gap-1">{prod?.title || "Produk"} <PremiumBadgeAsync visitorId={ch.visitor_id} /></p>
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
                    <h2 className="text-sm font-extrabold flex items-center gap-1">{products.find(p => p.id === activeChat.product_id)?.title || "Chat"} <PremiumBadgeAsync visitorId={activeChat.visitor_id} size="sm" /></h2>
                    <p className="text-[10px] text-muted-foreground">Pengunjung: {activeChat.visitor_id.slice(0, 8)}...</p>
                  </div>
                </div>

                <WhatsAppChat
                  kind="product"
                  parentId={activeChat.id}
                  viewerType="admin"
                  viewerId="admin"
                  incomingLabel="Pengunjung"
                  className="bg-muted/30 rounded-xl border border-border h-[60vh]"
                  scrollClassName="max-h-full"
                />
              </>
            )}
          </>
        )}

        {tab === "saldo" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowUpCircle className="w-5 h-5 text-accent" /> Tambah Saldo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={topupVisitorId} onChange={e => setTopupVisitorId(e.target.value)} required>
                  <option value="">Pilih User</option>
                  {userBalances.map(u => (
                    <option key={u.id} value={u.visitor_id}>{u.username} ({u.phone}) - Saldo: Rp {u.balance.toLocaleString()}</option>
                  ))}
                </select>
                <Input type="number" placeholder="Jumlah (Rp)" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
                <Input placeholder="Keterangan (opsional)" value={topupDesc} onChange={e => setTopupDesc(e.target.value)} />
                <Button className="w-full" onClick={addTopup} disabled={!topupVisitorId || !topupAmount}><ArrowUpCircle className="w-4 h-4 mr-1" /> Tambah Saldo</Button>
              </CardContent>
            </Card>

            <h3 className="font-bold text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Daftar User ({userBalances.length})</h3>
            {userBalances.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada user terdaftar</p>}
            {userBalances.map(u => (
              <Card key={u.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{u.username}</p>
                      <p className="text-xs text-muted-foreground">HP: {u.phone}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">ID: {u.visitor_id.slice(0, 12)}...</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-primary text-lg">Rp {u.balance.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(u.created_at || "").toLocaleDateString("id-ID")}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => adminResetBalance(u)}>
                      <Wallet className="w-3 h-3" /> Reset Saldo
                    </Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => adminResetCredits(u)}>
                      <Key className="w-3 h-3" /> Reset Kredit
                    </Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => adminResetStreak(u)}>
                      <Clock className="w-3 h-3" /> Reset Streak
                    </Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => adminResetStorage(u)}>
                      <HardDrive className="w-3 h-3" /> Reset Storage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {tab === "notif" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Kirim Notifikasi</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={notifTarget} onChange={e => setNotifTarget(e.target.value)}>
                  <option value="all">📢 Semua User ({userBalances.length})</option>
                  {userBalances.map(u => (
                    <option key={u.id} value={u.visitor_id}>{u.username} ({u.phone})</option>
                  ))}
                </select>
                <Input placeholder="Judul notifikasi *" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} />
                <Textarea placeholder="Pesan (opsional)" value={notifMessage} onChange={e => setNotifMessage(e.target.value)} rows={3} />
                <Button className="w-full gap-2" onClick={sendBroadcastNotification} disabled={!notifTitle.trim()}>
                  <Bell className="w-4 h-4" /> Kirim Notifikasi
                </Button>
              </CardContent>
            </Card>
            <div className="rounded-xl bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-bold text-foreground">ℹ️ Info Notifikasi</p>
              <p>• Notifikasi otomatis dikirim saat: admin balas chat/tiket</p>
              <p>• Notifikasi otomatis dikirim saat: user beli via saldo atau klaim voucher</p>
              <p>• Gunakan form di atas untuk kirim notifikasi manual/broadcast</p>
            </div>
          </>
        )}

        {tab === "deposit" && (
          <>
            <h3 className="font-bold text-sm flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-accent" /> Deposit Masuk ({allDeposits.length})</h3>
            <Input placeholder="Cari ID transaksi, username, atau metode..." value={depositSearchTrx} onChange={e => setDepositSearchTrx(e.target.value)} className="text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <select className="rounded-md border border-input bg-background px-3 py-2 text-xs" value={depositMethodFilter} onChange={e => setDepositMethodFilter(e.target.value as DepositMethodFilter)}>
                <option value="all">Semua Metode</option>
                <option value="qris">QRIS</option>
                <option value="ewallet">E-Wallet</option>
              </select>
              <select className="rounded-md border border-input bg-background px-3 py-2 text-xs" value={depositStatusFilter} onChange={e => setDepositStatusFilter(e.target.value as DepositStatusFilter)}>
                <option value="all">Semua Status</option>
                <option value="pending">Belum Konfirmasi</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
              <select className="rounded-md border border-input bg-background px-3 py-2 text-xs" value={depositSort} onChange={e => setDepositSort(e.target.value as "newest" | "oldest")}>
                <option value="newest">Terbaru</option>
                <option value="oldest">Terlama</option>
              </select>
            </div>
            {filteredDeposits.map(dep => {
              const user = userBalances.find(u => u.visitor_id === dep.visitor_id);
              return (
                <Card key={dep.id} className={dep.status === "pending" ? "border-2 border-primary/30" : ""}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dep.status === "approved" ? "bg-accent/10 text-accent" : dep.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                        {getDepositStatusLabel(dep.status)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{new Date(dep.created_at).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="text-xs space-y-0.5">
                      <p><strong>Username:</strong> {dep.username}</p>
                      {user?.phone && <p><strong>No HP:</strong> {user.phone}</p>}
                      <p><strong>Nominal:</strong> <span className="text-primary font-extrabold text-sm">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(dep.amount)}</span></p>
                      <p><strong>Metode:</strong> {dep.payment_method.toUpperCase()}</p>
                      <p><strong>ID Transaksi:</strong> <span className="font-mono text-primary">{dep.trx_id}</span></p>
                      {dep.cancel_reason && <p className="text-destructive"><strong>Alasan:</strong> {dep.cancel_reason}</p>}
                    </div>
                    {dep.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1 bg-accent text-accent-foreground gap-1" onClick={() => approveDeposit(dep)}>
                          <Check className="w-3 h-3" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => rejectDeposit(dep)}>
                          <X className="w-3 h-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {filteredDeposits.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada deposit yang cocok</p>}
          </>
        )}

        {tab === "diskon" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tag className="w-5 h-5 text-primary" /> Buat Voucher Diskon</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Kode otomatis</p>
                  {dvCode && <p className="font-mono font-bold text-sm">{dvCode}</p>}
                  {!dvCode && <p className="text-xs text-muted-foreground italic">Kode akan dibuat otomatis</p>}
                </div>
                <Input type="number" placeholder="Nominal diskon (Rp)" value={dvAmount} onChange={e => setDvAmount(e.target.value)} />
                <Input type="number" placeholder="Maks pemakaian" value={dvMaxUses} onChange={e => setDvMaxUses(e.target.value)} />
                <div>
                  <label className="text-xs text-muted-foreground">Expired (opsional)</label>
                  <Input type="date" value={dvExpiry} onChange={e => setDvExpiry(e.target.value)} />
                </div>
                <Button className="w-full gap-2" onClick={createDiscountVoucher} disabled={!dvAmount}>
                  <Tag className="w-4 h-4" /> Buat Voucher Diskon (Auto-Kode)
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Kirim Voucher ke User</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={dvSendTarget} onChange={e => setDvSendTarget(e.target.value)}>
                  <option value="all">📢 Semua User ({userBalances.length})</option>
                  {userBalances.map(u => <option key={u.id} value={u.visitor_id}>{u.username} ({u.phone})</option>)}
                </select>
                {discountVouchers.filter(v => v.is_active).map(v => (
                  <div key={v.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                    <span className="font-mono text-xs font-bold">{v.code} (-Rp{v.discount_amount.toLocaleString()})</span>
                    <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => sendDiscountVoucherNotif(v)}>
                      <Bell className="w-3 h-3" /> Kirim
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
            <h3 className="font-bold text-sm">Daftar Voucher Diskon ({discountVouchers.length})</h3>
            {discountVouchers.map(v => (
              <Card key={v.id} className={!v.is_active ? "opacity-60" : ""}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-sm">{v.code}</p>
                      <p className="text-xs text-primary font-bold">-Rp{v.discount_amount.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toggleDiscountVoucher(v)}>{v.is_active ? "Nonaktif" : "Aktifkan"}</Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyText(v.code)}><Copy className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteDiscountVoucher(v.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex gap-3">
                    <span>Terpakai: {v.used_count}/{v.max_uses}</span>
                    <span>{v.expires_at ? `Exp: ${new Date(v.expires_at).toLocaleDateString("id-ID")}` : "Tanpa batas"}</span>
                    <span className={v.is_active ? "text-accent" : "text-destructive"}>{v.is_active ? "✓ Aktif" : "✗ Nonaktif"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {discountVouchers.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada voucher diskon</p>}
          </>
        )}

        {tab === "pin" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="w-5 h-5 text-primary" /> Buat Token Reset PIN</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={pinResetTarget} onChange={e => setPinResetTarget(e.target.value)}>
                  <option value="">Pilih User</option>
                  {userBalances.map(u => <option key={u.id} value={u.visitor_id}>{u.username} ({u.phone})</option>)}
                </select>
                <Button className="w-full gap-2" onClick={generatePinResetToken} disabled={!pinResetTarget}>
                  <Key className="w-4 h-4" /> Generate Token Reset
                </Button>
                {generatedResetToken && (
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">Token berhasil dibuat:</p>
                    <p className="font-mono text-xl font-extrabold text-primary tracking-[0.2em]">#{generatedResetToken}</p>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => copyText(generatedResetToken)}><Copy className="w-3 h-3" /> Salin Token</Button>
                    <p className="text-[10px] text-muted-foreground">Kirimkan token ini ke user. Berlaku 24 jam.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Buat Token Reset Sandi</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={pwResetTarget} onChange={e => setPwResetTarget(e.target.value)}>
                  <option value="">Pilih User</option>
                  {userBalances.map(u => <option key={u.id} value={u.visitor_id}>{u.username} ({u.email || u.phone})</option>)}
                </select>
                <Button className="w-full gap-2" onClick={generatePwResetToken} disabled={!pwResetTarget}>
                  <Lock className="w-4 h-4" /> Generate Token Reset Sandi
                </Button>
                {generatedPwResetToken && (
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">Token reset sandi berhasil dibuat:</p>
                    <p className="font-mono text-xl font-extrabold text-primary tracking-[0.2em]">#{generatedPwResetToken}</p>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => copyText(generatedPwResetToken)}><Copy className="w-3 h-3" /> Salin Token</Button>
                    <p className="text-[10px] text-muted-foreground">Kirimkan token ini ke user. Berlaku 24 jam.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="rounded-xl bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-bold text-foreground">ℹ️ Info PIN & Sandi</p>
              <p>• User membuat PIN 4-6 digit di tab Saldo</p>
              <p>• PIN diperlukan saat pembelian dengan saldo</p>
              <p>• Jika user lupa PIN atau sandi, buat token reset di sini</p>
              <p>• Token reset berlaku 24 jam, sekali pakai</p>
              <p>• Token lama otomatis dinonaktifkan saat buat baru</p>
            </div>
          </>
        )}

        {tab === "settings" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Edit2 className="w-5 h-5 text-primary" /> Pengaturan Pembayaran</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* QRIS Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Foto QRIS</label>
                  <input type="file" accept="image/*" ref={qrisFileRef} className="hidden" onChange={handleQrisUpload} />
                  <Button variant="outline" className="w-full gap-2" onClick={() => qrisFileRef.current?.click()} disabled={qrisUploading}>
                    <Image className="w-4 h-4" /> {qrisUploading ? "Uploading..." : "Upload Foto QRIS"}
                  </Button>
                  {settingQris && <img src={settingQris} alt="QRIS Preview" className="max-w-full max-h-40 rounded-lg border border-border" />}
                </div>

                {/* Multiple E-Wallets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground">Daftar E-Wallet</label>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEwallets([...ewallets, { name: "", number: "" }])}>
                      <Plus className="w-3 h-3" /> Tambah
                    </Button>
                  </div>
                  {ewallets.map((ew, idx) => (
                    <div key={idx} className="flex gap-2 items-start p-2 rounded-lg border border-border">
                      <div className="flex flex-col items-center gap-1">
                        {ew.logo ? (
                          <img src={ew.logo} alt={ew.name} className="w-10 h-10 rounded-lg object-contain border border-border bg-white" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg border border-dashed border-border flex items-center justify-center text-[8px] text-muted-foreground">Logo</div>
                        )}
                        <label className="text-[9px] text-primary cursor-pointer">
                          {ewalletLogoUploading === idx ? "..." : "Upload"}
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleEwalletLogoUpload(e, idx)} />
                        </label>
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input placeholder="Nama (DANA, OVO, GoPay...)" value={ew.name}
                          onChange={e => { const arr = [...ewallets]; arr[idx] = { ...arr[idx], name: e.target.value }; setEwallets(arr); }} />
                        <Input placeholder="Nomor rekening" value={ew.number}
                          onChange={e => { const arr = [...ewallets]; arr[idx] = { ...arr[idx], number: e.target.value }; setEwallets(arr); }} />
                        <Input placeholder="Atas nama (a/n)" value={ew.holder || ""}
                          onChange={e => { const arr = [...ewallets]; arr[idx] = { ...arr[idx], holder: e.target.value }; setEwallets(arr); }} />
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0 mt-1" onClick={() => setEwallets(ewallets.filter((_, i) => i !== idx))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {ewallets.length === 0 && <p className="text-xs text-muted-foreground">Belum ada e-wallet. Klik "Tambah" untuk menambahkan.</p>}
                </div>

                <Button className="w-full gap-2" onClick={saveAllSettings}>
                  <Check className="w-4 h-4" /> Simpan Pengaturan
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "musik" && <AdminMusicTab />}

        {tab === "vmusik" && (
          <>
            {/* Storage Vouchers */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><HardDrive className="w-5 h-5 text-primary" /> Buat Voucher Penyimpanan Musik</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Jumlah Storage (MB)</label>
                  <Input type="number" placeholder="Contoh: 1024 = 1GB, 10240 = 10GB" value={msvStorageMb} onChange={e => setMsvStorageMb(e.target.value)} />
                  {msvStorageMb && parseInt(msvStorageMb) > 0 && (
                    <p className="text-[10px] text-primary font-bold mt-1">= {formatStorageMb(parseInt(msvStorageMb))}</p>
                  )}
                </div>
                <Input type="number" placeholder="Maks pemakaian" value={msvMaxUses} onChange={e => setMsvMaxUses(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Tanggal expired</label>
                    <Input type="date" value={msvExpiryDate} onChange={e => setMsvExpiryDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Jam expired</label>
                    <Input type="time" step="1" value={msvExpiryTime} onChange={e => setMsvExpiryTime(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full gap-2" onClick={createMusicStorageVoucher} disabled={!msvStorageMb || parseInt(msvStorageMb) <= 0}>
                  <HardDrive className="w-4 h-4" /> Buat Voucher (Kode Otomatis)
                </Button>
              </CardContent>
            </Card>

            <h3 className="font-bold text-sm">Voucher Penyimpanan ({musicStorageVouchers.length})</h3>
            {musicStorageVouchers.map(v => (
              <Card key={v.id} className={!v.is_active ? "opacity-60" : ""}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-sm">{v.code}</p>
                      <p className="text-xs text-primary font-bold">+{formatStorageMb(v.storage_mb)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toggleMusicStorageVoucher(v)}>{v.is_active ? "Nonaktif" : "Aktifkan"}</Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyText(v.code)}><Copy className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteMusicStorageVoucher(v.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex flex-wrap gap-3">
                    <span>Terpakai: {v.used_count}/{v.max_uses}</span>
                    <span>{v.expires_at ? `Exp: ${new Date(v.expires_at).toLocaleString("id-ID")}` : "Tanpa batas"}</span>
                    <span className={v.is_active ? "text-accent" : "text-destructive"}>{v.is_active ? "✓ Aktif" : "✗ Nonaktif"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {musicStorageVouchers.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Belum ada voucher penyimpanan</p>}

            {/* Music Discount Vouchers */}
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tag className="w-5 h-5 text-primary" /> Buat Voucher Diskon Musik</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Kode otomatis</p>
                  {mdvCode && <p className="font-mono font-bold text-sm">{mdvCode}</p>}
                  {!mdvCode && <p className="text-xs text-muted-foreground italic">Kode akan dibuat otomatis</p>}
                </div>
                <Input type="number" placeholder="Nominal diskon (Rp)" value={mdvAmount} onChange={e => setMdvAmount(e.target.value)} />
                <Input type="number" placeholder="Maks pemakaian" value={mdvMaxUses} onChange={e => setMdvMaxUses(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Tanggal expired</label>
                    <Input type="date" value={mdvExpiryDate} onChange={e => setMdvExpiryDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Jam expired</label>
                    <Input type="time" step="1" value={mdvExpiryTime} onChange={e => setMdvExpiryTime(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full gap-2" onClick={createMusicDiscountVoucher} disabled={!mdvAmount}>
                  <Tag className="w-4 h-4" /> Buat Voucher Diskon Musik (Auto-Kode)
                </Button>
              </CardContent>
            </Card>

            <h3 className="font-bold text-sm">Voucher Diskon Musik ({musicDiscountVouchers.length})</h3>
            {musicDiscountVouchers.map(v => (
              <Card key={v.id} className={!v.is_active ? "opacity-60" : ""}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-sm">{v.code}</p>
                      <p className="text-xs text-primary font-bold">-Rp{v.discount_amount.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toggleMusicDiscountVoucher(v)}>{v.is_active ? "Nonaktif" : "Aktifkan"}</Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyText(v.code)}><Copy className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteMusicDiscountVoucher(v.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex flex-wrap gap-3">
                    <span>Terpakai: {v.used_count}/{v.max_uses}</span>
                    <span>{v.expires_at ? `Exp: ${new Date(v.expires_at).toLocaleString("id-ID")}` : "Tanpa batas"}</span>
                    <span className={v.is_active ? "text-accent" : "text-destructive"}>{v.is_active ? "✓ Aktif" : "✗ Nonaktif"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {musicDiscountVouchers.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Belum ada voucher diskon musik</p>}
          </>
        )}
        {tab === "sponsor" && <AdminSponsorTab />}
        {tab === "apikey" && <AdminApiKeyTab />}
        {tab === "postingan" && <AdminPostsTab />}
        {tab === "promo" && <AdminPromoTab />}
        {tab === "sosmed" && <AdminSocialLinksTab />}
        {tab === "wheel" && <AdminLuckyWheelTab />}
        {tab === "shopstreak" && <AdminStreakShopTab />}
        {tab === "strvoucher" && <AdminStreakVoucherTab />}
        {tab === "eventstreak" && <AdminStreakEventTab />}
        {tab === "flashsale" && <AdminStreakFlashSaleTab />}
        {tab === "prodflash" && <AdminProductFlashSaleTab />}
        {tab === "membership" && <AdminMembershipTab />}
        {tab === "storeprem" && <AdminStorePremiumTab />}
        {tab === "banned" && <AdminBannedTab />}
        {tab === "userreset" && <AdminUserResetPanel />}
        {tab === "confess" && <AdminConfessTab />}
        {tab === "wanotif" && <AdminWaNotifTab />}
        {tab === "totaluser" && <AdminTotalUserTab />}
        {tab === "bot" && <AdminBotTab />}
      </main>
    </div>
  );
};

export default AdminDashboard;
