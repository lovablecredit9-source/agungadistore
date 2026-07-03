import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import { getDeviceSummary } from "@/lib/device-info";
import {
  getSavedAccounts, saveAccount, removeSavedAccount, MAX_SAVED_ACCOUNTS,
  type SavedAccount,
} from "@/lib/saved-accounts";
import {
  Wallet, LogIn, UserPlus, LogOut, Smartphone, History, Eye, EyeOff, Mail, Lock, User, Phone,
  Edit2, KeyRound, Save, X, Users, Trash2, ArrowRightLeft, Plus, ArrowLeft, QrCode, Camera, ImageIcon,
} from "lucide-react";
import { useAccountBan } from "@/hooks/useAccountBan";
import DeviceLoginCode from "@/components/DeviceLoginCode";

const SAVED_KEY = "saved_balance_accounts_v1";

interface UserBalance {
  id: string;
  visitor_id: string;
  username: string;
  phone: string;
  email?: string;
  balance: number;
}

interface LoginHistoryEntry {
  id: string;
  visitor_id: string;
  device_info: string | null;
  browser: string | null;
  ip_address: string | null;
  logged_in_at: string;
}

interface BalanceAuthProps {
  onLogin: (user: UserBalance) => void;
  onLogout: () => void;
  currentUser: UserBalance | null;
}

export default function BalanceAuth({ onLogin, onLogout, currentUser }: BalanceAuthProps) {
  const { banned } = useAccountBan();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [loginId, setLoginId] = useState(""); // for login: email/username/phone
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeLoginMode, setCodeLoginMode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [showCodeCard, setShowCodeCard] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false); // when true, show login/register form even though logged in
  const [previousActiveAccount, setPreviousActiveAccount] = useState<SavedAccount | null>(null);

  // Edit profile states
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editSection, setEditSection] = useState<"profile" | "password" | "email" | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [useResetToken, setUseResetToken] = useState(false);
  const [pwResetMode, setPwResetMode] = useState<"old" | "token" | "wa">("old");
  const [waCode, setWaCode] = useState("");
  const [waSending, setWaSending] = useState(false);
  const [waSentMask, setWaSentMask] = useState<string | null>(null);
  const [emailUseWa, setEmailUseWa] = useState(false);
  const [emailPassword, setEmailPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const { toast } = useToast();

  function notifyAuthChanged() {
    window.dispatchEvent(new CustomEvent("balance-auth-changed"));
  }

  useEffect(() => {
    if (currentUser && showHistory) {
      fetchLoginHistory();
    }
  }, [currentUser, showHistory]);

  useEffect(() => {
    if (currentUser && showEditProfile) {
      setEditUsername(currentUser.username);
      setEditPhone(currentUser.phone);
      setEditEmail(currentUser.email || "");
    }
  }, [currentUser, showEditProfile]);

  // Auto-reset "tambah akun" mode if no saved accounts — back arrow only
  // makes sense when the user has at least one account to return to.
  useEffect(() => {
    if (addingAccount && savedAccounts.length === 0) {
      setAddingAccount(false);
    }
  }, [addingAccount, savedAccounts.length]);

  function resetTransientUiState() {
    setAddingAccount(false);
    setPreviousActiveAccount(null);
    setShowSwitcher(false);
    resetForm();
  }

  useEffect(() => {
    const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

    if (!currentUser && navigationEntry?.type === "reload") {
      resetTransientUiState();
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (!currentUser && event.persisted) {
        resetTransientUiState();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [currentUser]);

  async function fetchLoginHistory() {
    if (!currentUser) return;
    const { data } = await supabase.functions.invoke("balance-auth", {
      body: { action: "login_history", userBalanceId: currentUser.id },
    });
    if (data?.history) setLoginHistory(data.history);
  }

  async function handleRegister() {
    if (!username.trim() || username.trim().length < 3) {
      toast({ title: "Username minimal 3 karakter", variant: "destructive" }); return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      toast({ title: "Nomor HP tidak valid", variant: "destructive" }); return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: "Format email tidak valid", variant: "destructive" }); return;
    }
    if (!password || password.length < 6) {
      toast({ title: "Sandi minimal 6 karakter", variant: "destructive" }); return;
    }

    setLoading(true);
    // Generate fresh visitor_id for new registration to avoid linking to old account
    const isLoggedOut = !localStorage.getItem("balance_logged_in");
    let visitorId = getVisitorId();
    if (isLoggedOut) {
      visitorId = crypto.randomUUID();
      localStorage.setItem("visitor_id", visitorId);
    }
    const deviceSummary = getDeviceSummary(navigator.userAgent);

    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: {
        action: "register",
        username: username.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        visitorId,
        deviceInfo: { device: deviceSummary, browser: navigator.userAgent.substring(0, 100) },
      },
    });

    setLoading(false);

    if (error || data?.error) {
      toast({ title: data?.error || "Gagal mendaftar", variant: "destructive" }); return;
    }

    localStorage.setItem("balance_logged_in", "true");
    localStorage.setItem("balance_email", (data.user.email || email.trim()).toLowerCase());
    localStorage.setItem("balance_visitor_id", data.user.visitor_id);
    setSavedAccounts(saveAccount({
      visitor_id: data.user.visitor_id,
      username: data.user.username,
      email: data.user.email || email.trim(),
      phone: data.user.phone,
    }));

    onLogin(data.user);
    notifyAuthChanged();
    setAddingAccount(false);
    setPreviousActiveAccount(null);
    setShowSwitcher(false);
    toast({ title: "Pendaftaran berhasil! 🎉" });
    resetForm();
  }

  async function handleLogin() {
    if (!loginId.trim() || !password) {
      toast({ title: "Email/Username/No HP dan sandi wajib diisi", variant: "destructive" }); return;
    }

    setLoading(true);
    const visitorId = getVisitorId();
    const deviceSummary = getDeviceSummary(navigator.userAgent);

    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: {
        action: "login",
        loginId: loginId.trim(),
        password,
        visitorId,
        deviceInfo: { device: deviceSummary, browser: navigator.userAgent.substring(0, 100) },
      },
    });

    setLoading(false);

    if (error || data?.error) {
      toast({ title: data?.error || "Gagal login", variant: "destructive" }); return;
    }

    localStorage.setItem("balance_logged_in", "true");
    localStorage.setItem("balance_email", (data.user.email || loginId.trim()).toLowerCase());
    localStorage.setItem("balance_visitor_id", data.user.visitor_id);
    setSavedAccounts(saveAccount({
      visitor_id: data.user.visitor_id,
      username: data.user.username,
      email: data.user.email || loginId.trim(),
      phone: data.user.phone,
    }));

    onLogin(data.user);
    notifyAuthChanged();
    setAddingAccount(false);
    setPreviousActiveAccount(null);
    setShowSwitcher(false);
    toast({ title: `Selamat datang, ${data.user.username}! 👋` });
    resetForm();
  }

  async function handleLoginWithCode(rawCode?: string) {
    const raw = (rawCode ?? codeInput).trim().replace(/^AAS-LOGIN:/i, "");
    // Format barcode resmi: CODE:SIG. Input manual hanya CODE (butuh scan barcode resmi).
    const [codePart, sigPart] = raw.split(":");
    const code = (codePart || "").trim().toUpperCase();
    const sig = (sigPart || "").trim();
    if (code.length < 6) {
      toast({ title: "Masukkan kode login yang valid", variant: "destructive" }); return;
    }
    if (!sig) {
      toast({ title: "Scan barcode dari website resmi", description: "Login kode manual tidak didukung, silakan scan barcode resmi.", variant: "destructive" }); return;
    }
    setLoading(true);
    const deviceSummary = getDeviceSummary(navigator.userAgent);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: {
        action: "login_with_code",
        code,
        sig,
        deviceInfo: { device: deviceSummary, browser: navigator.userAgent.substring(0, 100) },
      },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: data?.error || "Gagal login", variant: "destructive" }); return;
    }
    localStorage.setItem("balance_logged_in", "true");
    localStorage.setItem("balance_email", (data.user.email || "").toLowerCase());
    localStorage.setItem("balance_visitor_id", data.user.visitor_id);
    setSavedAccounts(saveAccount({
      visitor_id: data.user.visitor_id,
      username: data.user.username,
      email: data.user.email || "",
      phone: data.user.phone,
    }));
    onLogin(data.user);
    notifyAuthChanged();
    setAddingAccount(false);
    setPreviousActiveAccount(null);
    setShowSwitcher(false);
    setCodeLoginMode(false);
    setCodeInput("");
    toast({ title: `Selamat datang, ${data.user.username}! 👋` });
    resetForm();
  }

  function stopCamera() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setScanning(false);
  }

  function closeScanner() {
    stopCamera();
    setShowScanner(false);
  }

  function decodeFromImageData(data: ImageData): string | null {
    const result = jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" });
    return result?.data ?? null;
  }

  async function startCameraScan() {
    setShowScanner(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: "Kamera tidak didukung", description: "Coba upload gambar barcode dari galeri.", variant: "destructive" });
      return;
    }
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      // Wait for the video element to mount
      await new Promise((r) => setTimeout(r, 50));
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const started = Date.now();

      const tick = () => {
        if (!streamRef.current) return;
        if (Date.now() - started > 30000) {
          stopCamera();
          toast({ title: "Waktu scan habis", description: "Coba lagi atau upload dari galeri.", variant: "destructive" });
          return;
        }
        if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const raw = decodeFromImageData(imageData);
            if (raw) { closeScanner(); handleLoginWithCode(raw); return; }
          } catch (_) { /* keep trying */ }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (_) {
      stopCamera();
      toast({ title: "Kamera tidak dapat diakses", description: "Izinkan kamera atau upload dari galeri.", variant: "destructive" });
    }
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no ctx");
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const raw = decodeFromImageData(imageData);
      if (raw) { closeScanner(); handleLoginWithCode(raw); }
      else toast({ title: "Barcode tidak terbaca", description: "Pastikan gambar jelas & tidak buram.", variant: "destructive" });
    } catch (_) {
      toast({ title: "Gagal membaca gambar", variant: "destructive" });
    }
  }

  // Stop camera on unmount
  useEffect(() => () => stopCamera(), []);

  function handleLogout() {
    localStorage.removeItem("balance_logged_in");
    localStorage.removeItem("balance_email");
    localStorage.removeItem("balance_visitor_id");
    setAddingAccount(false);
    setPreviousActiveAccount(null);
    setShowSwitcher(false);
    onLogout();
    notifyAuthChanged();
    toast({ title: "Berhasil logout (akun tetap tersimpan di daftar)" });
  }

  function handleLogoutAll() {
    if (!window.confirm("Logout & hapus SEMUA akun tersimpan di perangkat ini? Anda harus login ulang dengan username & sandi.")) return;
    localStorage.removeItem("balance_logged_in");
    localStorage.removeItem("balance_email");
    localStorage.removeItem("balance_visitor_id");
    localStorage.removeItem(SAVED_KEY);
    setSavedAccounts([]);
    setAddingAccount(false);
    setPreviousActiveAccount(null);
    setShowSwitcher(false);
    onLogout();
    notifyAuthChanged();
    toast({ title: "Semua akun dihapus dari perangkat ini" });
  }

  function handleAddAccount() {
    if (savedAccounts.length >= MAX_SAVED_ACCOUNTS) {
      toast({
        title: `Maksimal ${MAX_SAVED_ACCOUNTS} akun`,
        description: "Hapus salah satu akun tersimpan untuk menambah akun baru.",
        variant: "destructive",
      });
      return;
    }
    setPreviousActiveAccount(currentUser ? {
      visitor_id: currentUser.visitor_id,
      username: currentUser.username,
      email: currentUser.email ?? null,
      phone: currentUser.phone,
      last_used_at: Date.now(),
    } : null);
    // Logout active session so login/register form appears, then user logs into another account
    localStorage.removeItem("balance_logged_in");
    localStorage.removeItem("balance_email");
    localStorage.removeItem("balance_visitor_id");
    onLogout();
    notifyAuthChanged();
    setMode("login");
    setAddingAccount(true);
    setShowSwitcher(false);
    toast({ title: "Silakan login / daftar akun baru" });
  }

  async function handleBackToPreviousAccount() {
    if (!previousActiveAccount) return;
    resetForm();
    await handleQuickSwitch(previousActiveAccount);
  }

  function handleSwitchAccount() {
    handleLogout();
    setMode("login");
    setShowSwitcher(true);
  }

  async function handleQuickSwitch(account: SavedAccount) {
    if (currentUser?.visitor_id === account.visitor_id) {
      toast({ title: `Akun ${account.username} sedang aktif` }); return;
    }
    setSwitchingId(account.visitor_id);
    const { data, error } = await supabase
      .from("user_balances_public" as any)
      .select("id, visitor_id, username, phone, email, balance")
      .eq("visitor_id", account.visitor_id)
      .maybeSingle();
    setSwitchingId(null);
    if (error || !data) {
      toast({ title: "Akun tidak ditemukan, silakan login ulang", variant: "destructive" });
      setSavedAccounts(removeSavedAccount(account.visitor_id));
      return;
    }
    const user = data as unknown as UserBalance;
    localStorage.setItem("balance_logged_in", "true");
    localStorage.setItem("balance_email", (user.email || account.email || "").toLowerCase());
    localStorage.setItem("balance_visitor_id", user.visitor_id);
    setSavedAccounts(saveAccount({
      visitor_id: user.visitor_id,
      username: user.username,
      email: user.email,
      phone: user.phone,
    }));
    onLogin(user);
    notifyAuthChanged();
    setAddingAccount(false);
    setPreviousActiveAccount(null);
    setShowSwitcher(false);
    resetForm();
    toast({ title: `Beralih ke ${user.username} ✅` });
  }

  function handleRemoveSaved(visitorId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSavedAccounts(removeSavedAccount(visitorId));
    toast({ title: "Akun dihapus dari daftar" });
  }

  function resetForm() {
    setEmail("");
    setPassword("");
    setUsername("");
    setPhone("");
    setLoginId("");
  }

  function resetEditForm() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setResetToken("");
    setUseResetToken(false);
    setEmailPassword("");
    setEditSection(null);
    setShowNewPw(false);
    setPwResetMode("old");
    setWaCode("");
    setWaSentMask(null);
    setEmailUseWa(false);
  }

  // Kirim kode reset via WhatsApp ke nomor terdaftar (password / pin / email)
  async function requestWaCode(purpose: "password" | "pin" | "email", loginId?: string) {
    const visitorId = currentUser?.visitor_id || localStorage.getItem("balance_visitor_id") || "";
    if (!visitorId && !loginId) {
      toast({ title: "Perangkat tidak dikenal", variant: "destructive" }); return;
    }
    setWaSending(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: { action: "request_reset_code", purpose, visitorId, loginId: loginId || undefined },
    });
    setWaSending(false);
    if (error || data?.error) {
      toast({ title: data?.error || "Gagal kirim kode", variant: "destructive" }); return;
    }
    setWaSentMask(data.phoneMasked || "WA terdaftar");
    toast({ title: "Kode dikirim ke WhatsApp 📲", description: `Cek WA ${data.phoneMasked || ""}. Berlaku 5 menit.` });
  }

  async function handleChangePhone(newPhone: string) {
    if (!currentUser) return;
    if (!newPhone.trim() || newPhone.trim().length < 7) {
      toast({ title: "Nomor baru tidak valid", variant: "destructive" }); return;
    }
    setEditLoading(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: { action: "change_phone", visitorId: currentUser.visitor_id, newPhone: newPhone.trim() },
    });
    setEditLoading(false);
    if (error || data?.error) {
      toast({ title: data?.error || "Gagal ganti nomor", variant: "destructive" }); return;
    }
    onLogin({ ...currentUser, phone: newPhone.trim() });
    toast({ title: "Nomor WhatsApp berhasil diganti ✅" });
    resetEditForm();
  }


  async function handleUpdateProfile() {
    if (!currentUser) return;
    setEditLoading(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: {
        action: "update_profile",
        visitorId: currentUser.visitor_id,
        username: editUsername,
        phone: editPhone,
      },
    });
    setEditLoading(false);
    if (error || data?.error) {
      toast({ title: data?.error || "Gagal update profil", variant: "destructive" }); return;
    }
    onLogin(data.user);
    toast({ title: "Profil berhasil diperbarui ✅" });
    setEditSection(null);
  }

  async function handleChangePassword() {
    if (!currentUser) return;
    if (pwResetMode === "wa") {
      if (!waCode.trim()) { toast({ title: "Masukkan kode dari WhatsApp", variant: "destructive" }); return; }
      if (!newPassword || newPassword.length < 6) { toast({ title: "Sandi baru minimal 6 karakter", variant: "destructive" }); return; }
      setEditLoading(true);
      const { data, error } = await supabase.functions.invoke("balance-auth", {
        body: { action: "apply_reset_code", purpose: "password", visitorId: currentUser.visitor_id, code: waCode.trim(), newValue: newPassword },
      });
      setEditLoading(false);
      if (error || data?.error) { toast({ title: data?.error || "Gagal reset sandi", variant: "destructive" }); return; }
      toast({ title: "Sandi berhasil direset ✅" });
      resetEditForm();
    } else if (pwResetMode === "token") {
      if (!resetToken.trim()) {
        toast({ title: "Masukkan token reset", variant: "destructive" }); return;
      }
      if (!newPassword || newPassword.length < 6) {
        toast({ title: "Sandi baru minimal 6 karakter", variant: "destructive" }); return;
      }
      setEditLoading(true);
      const { data, error } = await supabase.functions.invoke("balance-auth", {
        body: {
          action: "reset_password",
          visitorId: currentUser.visitor_id,
          resetToken: resetToken.trim(),
          newPassword,
        },
      });
      setEditLoading(false);
      if (error || data?.error) {
        toast({ title: data?.error || "Gagal reset sandi", variant: "destructive" }); return;
      }
      toast({ title: "Sandi berhasil direset ✅" });
      resetEditForm();
    } else {
      if (!oldPassword) {
        toast({ title: "Masukkan sandi lama", variant: "destructive" }); return;
      }
      if (!newPassword || newPassword.length < 6) {
        toast({ title: "Sandi baru minimal 6 karakter", variant: "destructive" }); return;
      }
      if (newPassword !== confirmPassword) {
        toast({ title: "Konfirmasi sandi tidak cocok", variant: "destructive" }); return;
      }
      setEditLoading(true);
      const { data, error } = await supabase.functions.invoke("balance-auth", {
        body: {
          action: "change_password",
          visitorId: currentUser.visitor_id,
          oldPassword,
          newPassword,
        },
      });
      setEditLoading(false);
      if (error || data?.error) {
        toast({ title: data?.error || "Gagal ubah sandi", variant: "destructive" }); return;
      }
      toast({ title: "Sandi berhasil diubah ✅" });
      resetEditForm();
    }
  }

  async function handleChangeEmail() {
    if (!currentUser) return;
    if (!editEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      toast({ title: "Format email tidak valid", variant: "destructive" }); return;
    }
    let data: any; let error: any;
    if (emailUseWa) {
      if (!waCode.trim()) { toast({ title: "Masukkan kode dari WhatsApp", variant: "destructive" }); return; }
      setEditLoading(true);
      ({ data, error } = await supabase.functions.invoke("balance-auth", {
        body: { action: "apply_reset_code", purpose: "email", visitorId: currentUser.visitor_id, code: waCode.trim(), newValue: editEmail.trim() },
      }));
    } else {
      if (!emailPassword) {
        toast({ title: "Masukkan sandi untuk konfirmasi", variant: "destructive" }); return;
      }
      setEditLoading(true);
      ({ data, error } = await supabase.functions.invoke("balance-auth", {
        body: {
          action: "change_email",
          visitorId: currentUser.visitor_id,
          newEmail: editEmail.trim(),
          password: emailPassword,
        },
      }));
    }
    setEditLoading(false);
    if (error || data?.error) {
      toast({ title: data?.error || "Gagal ubah email", variant: "destructive" }); return;
    }
    // Update local user
    onLogin({ ...currentUser, email: editEmail.trim().toLowerCase() });
    localStorage.setItem("balance_email", editEmail.trim().toLowerCase());
    localStorage.setItem("balance_visitor_id", currentUser.visitor_id);
    toast({ title: "Email berhasil diubah ✅" });
    resetEditForm();
  }

  // Show logged-in state
  if (currentUser) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" className="h-10 justify-start gap-2 rounded-xl border-border bg-card text-xs font-medium text-foreground shadow-none" onClick={() => { setShowEditProfile(!showEditProfile); resetEditForm(); }} disabled={banned}>
            <Edit2 className="w-3.5 h-3.5" strokeWidth={1.8} /> Edit Profil
          </Button>
          <Button size="sm" variant="outline" className="h-10 justify-start gap-2 rounded-xl border-border bg-card text-xs font-medium text-foreground shadow-none" onClick={() => setShowSwitcher(!showSwitcher)} disabled={banned}>
            <Users className="w-3.5 h-3.5" strokeWidth={1.8} /> Ganti Akun
            {savedAccounts.length > 0 && (
              <span className="ml-auto rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {savedAccounts.length}/{MAX_SAVED_ACCOUNTS}
              </span>
            )}
          </Button>
          <Button size="sm" variant="outline" className="h-10 justify-start gap-2 rounded-xl border-border bg-card text-xs font-medium text-foreground shadow-none" onClick={handleAddAccount} disabled={banned || savedAccounts.length >= MAX_SAVED_ACCOUNTS}>
            <Plus className="w-3.5 h-3.5" strokeWidth={1.8} /> Tambah Akun
          </Button>
          <Button size="sm" variant="outline" className="h-10 justify-start gap-2 rounded-xl border-border bg-card text-xs font-medium text-foreground shadow-none" onClick={handleLogout}>
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.8} /> Logout
          </Button>
          <Button size="sm" variant="outline" className="h-10 justify-start gap-2 rounded-xl border-border bg-card text-xs font-medium text-foreground shadow-none" onClick={handleLogoutAll}>
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} /> Logout Semua
          </Button>
          <Button size="sm" variant="outline" className="h-10 justify-start gap-2 rounded-xl border-border bg-card text-xs font-medium text-foreground shadow-none" onClick={() => setShowHistory(!showHistory)} disabled={banned}>
            <Smartphone className="w-3.5 h-3.5" strokeWidth={1.8} /> Riwayat
          </Button>
          <Button size="sm" variant="outline" className="col-span-2 h-10 justify-start gap-2 rounded-xl border-pink-300 bg-pink-50/60 dark:bg-pink-950/20 text-xs font-medium text-pink-600 shadow-none" onClick={() => setShowCodeCard(!showCodeCard)} disabled={banned}>
            <QrCode className="w-3.5 h-3.5" strokeWidth={1.8} /> Kode & Barcode Login
          </Button>
        </div>

        {showCodeCard && !banned && currentUser?.visitor_id && (
          <DeviceLoginCode visitorId={currentUser.visitor_id} />
        )}


        {showSwitcher && !banned && (
          <Card className="border border-border bg-card shadow-none">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-foreground" /> Akun Tersimpan ({savedAccounts.length}/{MAX_SAVED_ACCOUNTS})
                </h4>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setShowSwitcher(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
              {savedAccounts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-2">
                  Belum ada akun tersimpan di perangkat ini.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {savedAccounts.map((acc) => {
                    const isActive = acc.visitor_id === currentUser.visitor_id;
                    const isSwitching = switchingId === acc.visitor_id;
                    return (
                      <button
                        key={acc.visitor_id}
                        type="button"
                        disabled={isSwitching}
                        onClick={() => handleQuickSwitch(acc)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                          isActive ? "bg-muted border-border" : "bg-background border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs ${
                          isActive ? "bg-foreground text-background" : "bg-muted text-foreground"
                        }`}>
                          {acc.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{acc.username}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {acc.email || acc.phone || acc.visitor_id.slice(0, 8)}
                          </p>
                        </div>
                        {isActive ? (
                          <span className="text-[10px] font-semibold text-foreground">Aktif</span>
                        ) : isSwitching ? (
                          <span className="text-[10px] text-muted-foreground">Beralih...</span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveSaved(acc.visitor_id, e)}
                            className="p-1 rounded hover:bg-destructive/10 text-destructive"
                            aria-label="Hapus akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {savedAccounts.length < MAX_SAVED_ACCOUNTS ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 text-xs font-bold border-dashed"
                  onClick={handleAddAccount}
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Akun ({savedAccounts.length}/{MAX_SAVED_ACCOUNTS})
                </Button>
              ) : (
                <div className="text-[10px] text-muted-foreground text-center py-2 px-2 rounded-xl bg-muted/50 border border-border">
                  Slot penuh ({MAX_SAVED_ACCOUNTS}/{MAX_SAVED_ACCOUNTS}). Hapus salah satu akun untuk menambah baru.
                </div>
              )}
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Klik akun untuk beralih cepat tanpa input sandi. <strong>Logout Semua</strong> akan menghapus semua akun tersimpan dari perangkat.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Edit Profile Panel */}
        {showEditProfile && !banned && (
          <Card className="border border-primary/20">
            <CardContent className="p-3 space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-primary" /> Edit Profil
              </h4>

              {/* Section Buttons */}
              <div className="flex gap-1.5 flex-wrap">
                <Button size="sm" variant={editSection === "profile" ? "default" : "outline"} className="text-xs gap-1" onClick={() => { setEditSection(editSection === "profile" ? null : "profile"); }}>
                  <User className="w-3 h-3" /> Profil
                </Button>
                <Button size="sm" variant={editSection === "password" ? "default" : "outline"} className="text-xs gap-1" onClick={() => { setEditSection(editSection === "password" ? null : "password"); resetEditForm(); setEditSection("password"); }}>
                  <Lock className="w-3 h-3" /> Sandi
                </Button>
                <Button size="sm" variant={editSection === "email" ? "default" : "outline"} className="text-xs gap-1" onClick={() => { setEditSection(editSection === "email" ? null : "email"); resetEditForm(); setEditSection("email"); }}>
                  <Mail className="w-3 h-3" /> Email
                </Button>
              </div>

              {/* Edit Username & Phone */}
              {editSection === "profile" && (
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9 text-sm" placeholder="Username" value={editUsername} onChange={e => setEditUsername(e.target.value)} />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9 text-sm" placeholder="No HP" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-9 text-sm"
                      type="email"
                      placeholder="Email"
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                    />
                  </div>
                  {editEmail.trim().toLowerCase() !== (currentUser.email || "").toLowerCase() && (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-9 text-sm"
                          type="password"
                          placeholder="Konfirmasi sandi (untuk ubah email)"
                          value={emailPassword}
                          onChange={e => setEmailPassword(e.target.value)}
                        />
                      </div>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ Email diubah — masukkan sandi untuk konfirmasi.
                      </p>
                    </div>
                  )}
                  <Button size="sm" className="w-full gap-1.5" onClick={async () => {
                    const emailChanged = editEmail.trim().toLowerCase() !== (currentUser.email || "").toLowerCase();
                    if (emailChanged) {
                      await handleChangeEmail();
                      if (editPhone !== currentUser.phone || editUsername !== currentUser.username) {
                        await handleUpdateProfile();
                      }
                    } else {
                      await handleUpdateProfile();
                    }
                  }} disabled={editLoading}>
                    <Save className="w-3.5 h-3.5" /> {editLoading ? "Menyimpan..." : "Simpan Profil"}
                  </Button>
                </div>
              )}

              {/* Change Password */}
              {editSection === "password" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button size="sm" variant={pwResetMode === "old" ? "default" : "outline"} className="text-[11px]" onClick={() => setPwResetMode("old")}>
                      Sandi Lama
                    </Button>
                    <Button size="sm" variant={pwResetMode === "wa" ? "default" : "outline"} className="text-[11px] gap-1" onClick={() => setPwResetMode("wa")}>
                      <Smartphone className="w-3 h-3" /> Via WA
                    </Button>
                    <Button size="sm" variant={pwResetMode === "token" ? "default" : "outline"} className="text-[11px] gap-1" onClick={() => setPwResetMode("token")}>
                      <KeyRound className="w-3 h-3" /> Token
                    </Button>
                  </div>

                  {pwResetMode === "old" ? (
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9 text-sm" type="password" placeholder="Sandi lama" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
                    </div>
                  ) : pwResetMode === "token" ? (
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9 text-sm font-mono tracking-wider" placeholder="Token dari admin" value={resetToken} onChange={e => setResetToken(e.target.value.toUpperCase())} maxLength={8} />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => requestWaCode("password")} disabled={waSending}>
                        <Smartphone className="w-3.5 h-3.5" /> {waSending ? "Mengirim..." : "Kirim Kode ke WhatsApp"}
                      </Button>
                      {waSentMask && <p className="text-[10px] text-emerald-600 text-center">Kode dikirim ke {waSentMask} • berlaku 5 menit, 3x percobaan</p>}
                      <Input className="text-sm font-mono tracking-widest text-center" placeholder="Kode 6 digit" value={waCode} onChange={e => setWaCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" />
                    </div>
                  )}

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9 pr-10 text-sm" type={showNewPw ? "text" : "password"} placeholder="Sandi baru (min. 6)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNewPw(!showNewPw)}>
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {pwResetMode === "old" && (
                    <Input className="text-sm" type="password" placeholder="Konfirmasi sandi baru" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  )}

                  <Button size="sm" className="w-full gap-1.5" onClick={handleChangePassword} disabled={editLoading}>
                    <Lock className="w-3.5 h-3.5" /> {editLoading ? "Memproses..." : pwResetMode === "old" ? "Ubah Sandi" : "Reset Sandi"}
                  </Button>
                </div>
              )}


              {/* Change Email */}
              {editSection === "email" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Email saat ini: <span className="font-medium text-foreground">{currentUser.email || "-"}</span></p>
                  <p className="text-[10px] text-amber-600">⚠️ Ganti email butuh perangkat utama / perangkat yang sudah terhubung 30 hari.</p>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9 text-sm" type="email" placeholder="Email baru" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" variant={!emailUseWa ? "default" : "outline"} className="text-[11px]" onClick={() => setEmailUseWa(false)}>Pakai Sandi</Button>
                    <Button size="sm" variant={emailUseWa ? "default" : "outline"} className="text-[11px] gap-1" onClick={() => setEmailUseWa(true)}><Smartphone className="w-3 h-3" /> Kode WA</Button>
                  </div>
                  {!emailUseWa ? (
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9 text-sm" type="password" placeholder="Konfirmasi sandi" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => requestWaCode("email")} disabled={waSending}>
                        <Smartphone className="w-3.5 h-3.5" /> {waSending ? "Mengirim..." : "Kirim Kode ke WhatsApp"}
                      </Button>
                      {waSentMask && <p className="text-[10px] text-emerald-600 text-center">Kode dikirim ke {waSentMask} • 5 menit, 3x percobaan</p>}
                      <Input className="text-sm font-mono tracking-widest text-center" placeholder="Kode 6 digit" value={waCode} onChange={e => setWaCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" />
                    </div>
                  )}
                  <Button size="sm" className="w-full gap-1.5" onClick={handleChangeEmail} disabled={editLoading}>
                    <Mail className="w-3.5 h-3.5" /> {editLoading ? "Memproses..." : "Ubah Email"}
                  </Button>
                </div>

              )}
            </CardContent>
          </Card>
        )}

        {showHistory && !banned && (
          <Card className="border border-muted">
            <CardContent className="p-3 space-y-2">
              <h4 className="text-xs font-bold flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Riwayat Login Perangkat
              </h4>
              {loginHistory.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-2">Belum ada riwayat login</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {loginHistory.map((entry) => (
                    <div key={entry.id} className="bg-muted/50 rounded-lg p-2 text-[11px] space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="w-3 h-3 text-primary" />
                        <span className="font-medium truncate">{entry.device_info || "Perangkat tidak diketahui"}</span>
                      </div>
                      {entry.browser && (
                        <p className="text-muted-foreground truncate pl-4">{entry.browser}</p>
                      )}
                      <p className="text-muted-foreground pl-4">
                        {new Date(entry.logged_in_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Show login/register form
  return (
    <Card className="border-2 border-primary/20 relative">
      <CardContent className="p-5 space-y-4">
        {addingAccount && previousActiveAccount && (
          <button
            type="button"
            onClick={handleBackToPreviousAccount}
            className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70 text-xs font-bold text-foreground transition-colors shadow-sm"
            aria-label="Kembali ke akun awal"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
        )}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Wallet className="w-8 h-8 text-primary-foreground" />
          </div>
          <h3 className="font-bold text-lg">
            {mode === "register" ? "Daftar Akun Saldo" : "Login Akun Saldo"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === "register" ? "Buat akun baru dengan email dan sandi" : "Masuk dengan email, username, atau no HP"}
          </p>
        </div>

        {savedAccounts.length > 0 && mode === "login" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" /> Akun Tersimpan ({savedAccounts.length}/{MAX_SAVED_ACCOUNTS})
              </p>
              <span className="text-[10px] text-muted-foreground">Klik untuk masuk cepat</span>
            </div>
            <div className="space-y-1.5">
              {savedAccounts.map((acc) => {
                const isSwitching = switchingId === acc.visitor_id;
                return (
                  <button
                    key={acc.visitor_id}
                    type="button"
                    disabled={isSwitching}
                    onClick={() => handleQuickSwitch(acc)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-transparent bg-muted/40 hover:bg-muted text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/70 to-accent/70 text-primary-foreground flex items-center justify-center font-bold text-xs">
                      {acc.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{acc.username}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {acc.email || acc.phone || acc.visitor_id.slice(0, 8)}
                      </p>
                    </div>
                    {isSwitching ? (
                      <span className="text-[10px] text-muted-foreground">Beralih...</span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleRemoveSaved(acc.visitor_id, e)}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        aria-label="Hapus akun"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="relative flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">atau login akun lain</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {mode === "register" && (
            <>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Username (min. 3 karakter)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="No HP (08xxx atau +628xxx)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </>
          )}

          {mode === "login" && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Email / Username / No HP"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 pr-10"
              placeholder={mode === "register" ? "Sandi (min. 6 karakter)" : "Sandi"}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            className="w-full bg-gradient-to-r from-primary to-primary/80 font-bold gap-2"
            onClick={mode === "register" ? handleRegister : handleLogin}
            disabled={loading}
          >
            {loading ? "Loading..." : mode === "register" ? (
              <><UserPlus className="w-4 h-4" /> Daftar</>
            ) : (
              <><LogIn className="w-4 h-4" /> Login</>
            )}
          </Button>

          <div className="text-center">
            {mode === "login" ? (
              <p className="text-xs text-muted-foreground">
                Belum punya akun?{" "}
                <button className="text-primary font-bold underline" onClick={() => { setMode("register"); resetForm(); }}>
                  Daftar
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sudah punya akun?{" "}
                <button className="text-primary font-bold underline" onClick={() => { setMode("login"); resetForm(); }}>
                  Login
                </button>
              </p>
            )}
          </div>

          {/* Login via kode / barcode */}
          <div className="relative flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground">atau</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {!codeLoginMode ? (
            <Button
              variant="outline"
              className="w-full gap-2 border-pink-300 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30"
              onClick={() => setCodeLoginMode(true)}
            >
              <QrCode className="w-4 h-4" /> Login via Barcode atau Kode
            </Button>
          ) : (
            <div className="space-y-2 rounded-xl border border-pink-200 bg-pink-50/50 dark:bg-pink-950/20 p-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-pink-600" /> Login Cepat
              </p>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 uppercase tracking-widest font-mono"
                  placeholder="Kode mis. XPJD8HS"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  maxLength={12}
                />
              </div>
              <Button className="w-full gap-1 bg-gradient-to-r from-pink-500 to-rose-500 font-bold" onClick={() => handleLoginWithCode()} disabled={loading}>
                <LogIn className="w-4 h-4" /> Masuk dengan Kode
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-1" onClick={startCameraScan} disabled={scanning}>
                  <Camera className="w-4 h-4" /> Scan Kamera
                </Button>
                <Button variant="outline" className="gap-1" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4" /> Dari Galeri
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleGalleryUpload}
              />
              <button className="text-[11px] text-muted-foreground underline w-full text-center" onClick={() => { setCodeLoginMode(false); setCodeInput(""); }}>
                Kembali ke login biasa
              </button>
            </div>
          )}

        </div>
      </CardContent>

      {showScanner && (
        <div className="fixed inset-0 z-[95] bg-black/90 flex flex-col items-center justify-center p-4" onClick={closeScanner}>
          <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold text-sm flex items-center gap-2"><Camera className="w-4 h-4" /> Arahkan ke Barcode</p>
              <button onClick={closeScanner} className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black ring-2 ring-pink-500/60">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-xl" />
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center text-white/80 text-xs">Membuka kamera…</div>
              )}
            </div>
            <p className="text-white/70 text-[11px] text-center mt-3">Barcode akan terbaca otomatis. Susah? Gunakan upload dari galeri.</p>
            <Button variant="outline" className="w-full mt-3 gap-1 bg-white/10 text-white border-white/30 hover:bg-white/20" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="w-4 h-4" /> Upload dari Galeri
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
