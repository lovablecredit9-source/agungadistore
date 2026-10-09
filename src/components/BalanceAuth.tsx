import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import { getDeviceSummary } from "@/lib/device-info";
import { loginDeviceDetails, primeLoginDeviceDetails } from "@/lib/login-device-client";
import {
  getSavedAccounts, saveAccount, removeSavedAccount, getSlotLimit, setSlotLimitCache, displaySlotCap,
  type SavedAccount,
} from "@/lib/saved-accounts";
import { useServerFn } from "@/lib/server-fn-compat";
import { getAccountSlotStatus, type SlotResult } from "@/lib/account-slots.functions";
import AccountSlotUpgrade from "@/components/AccountSlotUpgrade";
import {
  Wallet, LogIn, UserPlus, LogOut, Smartphone, History, Eye, EyeOff, Mail, Lock, User, Phone,
  Edit2, KeyRound, Save, X, Users, Trash2, ArrowRightLeft, Plus, ArrowLeft, QrCode, Camera, ImageIcon,
  ShieldCheck, Copy, Download, Check,

} from "lucide-react";
import { useAccountBan } from "@/hooks/useAccountBan";
import DeviceLoginCode from "@/components/DeviceLoginCode";
import TwoFactorAuth from "@/components/TwoFactorAuth";
import QRCode from "qrcode";
import { sendAdminWaNotif } from "@/lib/wa-notif";
import WalletLanding from "@/components/wallet/WalletLanding";
import { lovable } from "@/integrations/lovable/index";
import ProfileSecurityTop from "@/components/security/ProfileSecurityTop";
import { linkWallet, claimLink, signOutWalletAuth, signOutWalletAuthEverywhere, friendlyAuthError, WALLET_AUTH_PENDING, markWalletAuthPending, readOAuthReturnError, friendlyOAuthReturnError, isSessionFromThisLogin } from "@/lib/authBridge";

type FnData = { error?: string } | null | undefined;
function fnErrorContext(error: unknown): Response | undefined {
  return (error as { context?: Response } | null)?.context;
}

// Ambil pesan server dari respons non-2xx tanpa menampilkan detail teknis.
async function readServerError(error: unknown, data: FnData): Promise<string | null> {
  if (data?.error) return String(data.error);
  const ctx = fnErrorContext(error);
  if (ctx && typeof ctx.json === "function") {
    try { const j = await ctx.clone?.().json?.() ?? await ctx.json(); if (j?.error) return String(j.error); } catch { /* ignore */ }
  }
  return null;
}


const SAVED_KEY = "saved_balance_accounts_v1";

interface UserBalance {
  id: string;
  visitor_id: string;
  username: string;
  phone: string;
  email?: string;
  balance: number;
}

interface BalanceAuthProps {
  onLogin: (user: UserBalance) => void;
  onLogout: () => void;
  currentUser: UserBalance | null;
  openTwoFaSignal?: number;
}

export default function BalanceAuth({ onLogin, onLogout, currentUser, openTwoFaSignal }: BalanceAuthProps) {
  const { banned } = useAccountBan();
  const [mode, setMode] = useState<"login" | "register">("login");
  useEffect(() => {
    const m = sessionStorage.getItem("balance_auth_mode");
    if (m) { sessionStorage.removeItem("balance_auth_mode"); setMode(m === "register" ? "register" : "login"); }
    const onReq = (e: Event) => { sessionStorage.removeItem("balance_auth_mode"); setMode((e as CustomEvent<{ mode?: string }>).detail?.mode === "register" ? "register" : "login"); };
    window.addEventListener("market-login-request", onReq);
    return () => window.removeEventListener("market-login-request", onReq);
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [loginId, setLoginId] = useState(""); // for login: email/username/phone
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeLoginMode, setCodeLoginMode] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimId, setClaimId] = useState("");
  const [claimPw, setClaimPw] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const autoLinkRef = useRef(false);
  // Kembali dari Google / link verifikasi email: hubungkan sesi login ke dompet.
  useEffect(() => {
    if (currentUser) return;
    const fromUrl = /access_token|type=signup|type=email|code=/.test(window.location.hash + window.location.search);
    // Tampilkan error asli dari proses login Google (jika ada) dan jangan lanjut memakai sesi lain.
    const returnError = readOAuthReturnError();
    if (returnError && sessionStorage.getItem(WALLET_AUTH_PENDING)) {
      console.error("[google-return]", returnError);
      sessionStorage.removeItem(WALLET_AUTH_PENDING);
      toast({ title: "Login Google gagal", description: friendlyOAuthReturnError(returnError), variant: "destructive" });
      return;
    }
    const tryLink = async () => {
      if (autoLinkRef.current) return;
      const pending = sessionStorage.getItem(WALLET_AUTH_PENDING);
      if (!fromUrl && !pending) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      // Sesi lama di browser ini (mis. login panel admin) bukan hasil login ini: jangan dipakai sebagai wallet.
      if (!isSessionFromThisLogin(data.session.user.last_sign_in_at, pending)) {
        sessionStorage.removeItem(WALLET_AUTH_PENDING);
        toast({
          title: "Login Google belum selesai",
          description: "Browser ini masih memakai sesi login lain (mis. akun admin). Sesi itu tidak dipakai sebagai wallet. Coba login Google lagi.",
          variant: "destructive",
        });
        return;
      }
      autoLinkRef.current = true;
      const r = await linkWallet();
      if (r.ok) finalizeLogin(r.user, data.session.user.email || "");
      else if (r.needTotp) setTwoFA({ stage: "verify", mode: "auth" });
      else if (r.code === "link_required") {
        setClaimOpen(true);
        toast({ title: "Google berhasil masuk", description: "Hubungkan ke akun Dompet Digital kamu untuk melanjutkan." });
      }
      else if (r.code === "admin_conflict") { autoLinkRef.current = false; toast({ title: "Login gagal", description: "Akun admin tidak dapat digunakan sebagai akun saldo.", variant: "destructive" }); }
      else { autoLinkRef.current = false; toast({ title: "Login gagal", description: r.message, variant: "destructive" }); }
    };
    void tryLink();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setTimeout(() => { void tryLink(); }, 0);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);
  const [loginMethod, setLoginMethod] = useState<"manual" | "code">("manual");
  const [codeInput, setCodeInput] = useState("");
  const [pendingWaToken, setPendingWaToken] = useState<string | null>(null);
  const [showWaTokenInput, setShowWaTokenInput] = useState(false);
  const [waTokenInput, setWaTokenInput] = useState("");
  const [showCodeCard, setShowCodeCard] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [twoFA, setTwoFA] = useState<
    | { stage: "setup" | "verify"; mode: "password" | "code" | "auth"; otpauth?: string; secret?: string; backupCodes?: string[]; loginId?: string; password?: string; code?: string; sig?: string }
    | null
  >(null);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false); // when true, show login/register form even though logged in
  const [previousActiveAccount, setPreviousActiveAccount] = useState<SavedAccount | null>(null);
  const [slotLimit, setSlotLimit] = useState<number>(() => getSlotLimit());
  const [slotStatus, setSlotStatus] = useState<SlotResult | null>(null);
  const fetchSlotStatus = useServerFn(getAccountSlotStatus);
  const MAX_SAVED_ACCOUNTS = displaySlotCap(savedAccounts.length, slotLimit);
  const canAddAccount = savedAccounts.length < slotLimit;
  const applySlotStatus = (s: SlotResult) => {
    setSlotStatus(s);
    setSlotLimitCache(s.max_accounts, s.expires_at);
    setSlotLimit(getSlotLimit());
  };

  // Edit profile states
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editSection, setEditSection] = useState<"profile" | "password" | "email" | "pin" | "2fa" | null>(null);
  const [twoFaStatus, setTwoFaStatus] = useState<{ enabled: boolean; backupCount: number } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [twoFaNewBackup, setTwoFaNewBackup] = useState<string[] | null>(null);
  const [twoFaBarcode, setTwoFaBarcode] = useState<{ otpauth: string; secret: string } | null>(null);
  const [twoFaSetup, setTwoFaSetup] = useState<{ otpauth: string; secret: string; backupCodes: string[] } | null>(null);
  const [twoFaSetupCode, setTwoFaSetupCode] = useState("");
  const [twoFaSetupQr, setTwoFaSetupQr] = useState<string | null>(null);
  const [twoFaSavedConfirm, setTwoFaSavedConfirm] = useState(false);
  const [twoFaQr, setTwoFaQr] = useState<string | null>(null);
  const [twoFaBackupVisible, setTwoFaBackupVisible] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
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

  // Siapkan detail perangkat (Client Hints) agar ikut tercatat saat login berikutnya.
  useEffect(() => { void primeLoginDeviceDetails(); }, []);
  // Ganti akun: tutup panel milik akun sebelumnya agar tidak ada data akun lama yang tertinggal.
  useEffect(() => { setShowHistory(false); setShowEditProfile(false); setShowCodeCard(false); }, [currentUser?.visitor_id]);

  useEffect(() => {
    if (!currentUser?.visitor_id) return;
    fetchSlotStatus({ data: { visitorId: currentUser.visitor_id } })
      .then(applySlotStatus)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.visitor_id]);

  useEffect(() => {
    if (openTwoFaSignal && currentUser && !banned) {
      resetEditForm();
      setShowEditProfile(true);
      setEditSection("2fa");
      loadTwoFaStatus();
      setTimeout(() => {
        document.getElementById("balance-auth-2fa")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTwoFaSignal]);

  useEffect(() => {
    if (twoFaBarcode?.otpauth) {
      QRCode.toDataURL(twoFaBarcode.otpauth, { margin: 1, width: 220, color: { dark: "#be185d", light: "#ffffff" } })
        .then(setTwoFaQr)
        .catch(() => setTwoFaQr(null));
    } else {
      setTwoFaQr(null);
    }
  }, [twoFaBarcode]);

  useEffect(() => {
    if (twoFaSetup?.otpauth) {
      QRCode.toDataURL(twoFaSetup.otpauth, { margin: 1, width: 220, color: { dark: "#be185d", light: "#ffffff" } })
        .then(setTwoFaSetupQr)
        .catch(() => setTwoFaSetupQr(null));
    } else {
      setTwoFaSetupQr(null);
    }
  }, [twoFaSetup]);

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
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/saldo`,
        data: { username: username.trim(), phone: phone.trim() },
      },
    });
    setLoading(false);
    if (error) {
      console.error("[signUp]", error);
      toast({ title: "Pendaftaran gagal", description: friendlyAuthError(error), variant: "destructive" }); return;
    }
    // Email sudah terdaftar: Supabase mengembalikan user tanpa identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      toast({ title: "Pendaftaran gagal", description: "Email ini sudah terdaftar. Silakan login.", variant: "destructive" }); return;
    }
    if (data.session) {
      const r = await linkWallet();
      if (r.ok) { finalizeLogin(r.user, cleanEmail); return; }
      if (r.message) toast({ title: "Gagal memuat akun", description: r.message, variant: "destructive" });
      return;
    }
    markWalletAuthPending();
    setVerifyEmail(cleanEmail);
  }

  function finalizeLogin(user: UserBalance, fallbackEmail: string) {
    localStorage.setItem("balance_logged_in", "true");
    localStorage.setItem("balance_email", (user.email || fallbackEmail).toLowerCase());
    localStorage.setItem("balance_visitor_id", user.visitor_id);
    setSavedAccounts(saveAccount({
      visitor_id: user.visitor_id,
      username: user.username,
      email: user.email || fallbackEmail,
      phone: user.phone,
    }));
    onLogin(user);
    toast({ title: "✓ Login berhasil", description: user.username ? `Selamat datang kembali, ${user.username}` : undefined });
    notifyAuthChanged();
    setAddingAccount(false);
    setPreviousActiveAccount(null);
    setShowSwitcher(false);
    setCodeLoginMode(false);
    setCodeInput("");
    setTwoFA(null);
    resetForm();
  }

  async function completeAuthLogin(fallbackEmail: string) {
    const r = await linkWallet();
    if (r.ok) { finalizeLogin(r.user, fallbackEmail); return; }
    if (r.needTotp) { setTwoFA({ stage: "verify", mode: "auth" }); return; }
    if (r.code === "link_required") { setClaimOpen(true); return; }
    toast({ title: "Login gagal", description: r.message, variant: "destructive" });
    if (r.code === "email_not_confirmed") setVerifyEmail(fallbackEmail);
  }

  async function handleClaim() {
    if (!claimId.trim() || !claimPw) { toast({ title: "Isi data wallet lama", variant: "destructive" }); return; }
    setLoading(true);
    const c = await claimLink(claimId.trim(), claimPw);
    if (!c.ok) { setLoading(false); toast({ title: "Gagal menghubungkan", description: c.message, variant: "destructive" }); return; }
    setClaimOpen(false); setClaimId(""); setClaimPw("");
    await completeAuthLogin("");
    setLoading(false);
  }

  async function handleLogin() {
    const id = loginId.trim();
    if (!id || !password) {
      toast({ title: "Email/Username/No HP dan sandi wajib diisi", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      if (id.includes("@")) {
        const signInEmail = id.toLowerCase();
        const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password });
        if (!error) { await completeAuthLogin(signInEmail); return; }
        if (error.code !== "invalid_credentials") {
          console.error("[signIn]", error);
          toast({ title: "Login gagal", description: friendlyAuthError(error), variant: "destructive" });
          if (error.code === "email_not_confirmed") setVerifyEmail(signInEmail);
          return;
        }
      }
      // Wallet lama yang belum dihubungkan: login lama (tanpa membuat akun login otomatis).
      const { data, error } = await supabase.functions.invoke("balance-auth", {
        body: { action: "login", loginId: id, password, visitorId: getVisitorId(), deviceInfo: { device: getDeviceSummary(navigator.userAgent), browser: navigator.userAgent.substring(0, 100), details: loginDeviceDetails() }, deviceVisitorId: getVisitorId() },
      });
      if (error || data?.error) {
        let msg = data?.error as string | undefined;
        try { const j = await fnErrorContext(error)?.json?.(); msg = j?.error || msg; } catch { /* ignore */ }
        toast({ title: "Login gagal", description: msg || "Email/username atau sandi salah.", variant: "destructive" }); return;
      }
      if (data?.needTotp) { setTwoFA({ stage: "verify", mode: "password", loginId: id, password }); return; }
      finalizeLogin(data.user, id.includes("@") ? id : "");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    markWalletAuthPending();
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/saldo` });
    if (result.error) {
      console.error("[google]", result.error);
      sessionStorage.removeItem(WALLET_AUTH_PENDING);
      toast({ title: "Login Google gagal", description: "Silakan coba lagi.", variant: "destructive" }); return;
    }
    if (result.redirected) return;
    await completeAuthLogin("");
  }

  async function handleForgot() {
    const target = (forgotEmail || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { toast({ title: "Masukkan email yang terdaftar", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) { console.error("[reset]", error); toast({ title: "Gagal mengirim link", description: friendlyAuthError(error), variant: "destructive" }); return; }
    toast({ title: "Permintaan diterima", description: "Jika email terdaftar, link reset sandi dikirim ke email tersebut." });
    setForgotOpen(false);
  }

  async function handleResendVerify() {
    if (!verifyEmail) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: verifyEmail, options: { emailRedirectTo: `${window.location.origin}/saldo` } });
    setLoading(false);
    if (error) { console.error("[resend]", error); toast({ title: "Gagal mengirim ulang", description: friendlyAuthError(error), variant: "destructive" }); return; }
    toast({ title: "Email verifikasi dikirim ulang", description: verifyEmail });
  }

  async function handleLoginWithCode(rawCode?: string) {
    const raw = (rawCode ?? codeInput).trim().replace(/^AAS-LOGIN:/i, "");
    // Format barcode resmi: CODE:SIG. Input manual hanya CODE (butuh scan barcode resmi).
    const [codePart, sigPart] = raw.split(":");
    const code = (codePart || "").trim().toUpperCase();
    const sig = (sigPart || "").trim();
    if (!/^[A-Z0-9]{6,12}$/.test(code)) {
      toast({ title: "Masukkan kode login yang valid", variant: "destructive" }); return;
    }

    setLoading(true);
    const deviceSummary = getDeviceSummary(navigator.userAgent);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: {
        action: "login_with_code",
        code,
        sig,
        deviceInfo: { device: deviceSummary, browser: navigator.userAgent.substring(0, 100), details: loginDeviceDetails() }, deviceVisitorId: getVisitorId(),
      },
    });
    setLoading(false);
    if (error || data?.error) {
      if (error) console.error("[balance-auth login_with_code]", error);
      const msg = await readServerError(error, data);
      toast({ title: "Kode tidak valid", description: msg || "Masukkan kode login yang benar.", variant: "destructive" }); return;
    }
    // 2FA berlaku untuk login barcode juga
    if (data?.needTotp) {
      setTwoFA({ stage: "verify", mode: "code", code, sig });
      return;
    }
    finalizeLogin(data.user, "");
  }

  // Ambil pesan error asli dari FunctionsHttpError (respons non-2xx).
  async function extractFnError(error: unknown, data: FnData): Promise<string | null> {
    if (data?.error) return String(data.error);
    const ctx = fnErrorContext(error);
    if (ctx && typeof ctx.json === "function") {
      try { const j = await ctx.json(); if (j?.error) return String(j.error); } catch { /* ignore */ }
    }
    if (error) return "Token WA ditolak, mohon coba lagi";
    return null;
  }

  async function confirmWaTokenLogin() {
    if (!pendingWaToken || loading) return;
    setLoading(true);
    try {
      const deviceSummary = getDeviceSummary(navigator.userAgent);
      const visitorId = getVisitorId();
      const { data, error } = await supabase.functions.invoke("balance-auth", {
        body: {
          action: "verify_wa_login_token",
          code: pendingWaToken,
          visitorId,
          accountVisitorId: currentUser?.visitor_id,
          deviceInfo: { device: deviceSummary, browser: navigator.userAgent.substring(0, 100), details: loginDeviceDetails() }, deviceVisitorId: getVisitorId(),
        },
      });
      const errMsg = await extractFnError(error, data);
      if (errMsg) {
        toast({ title: errMsg, variant: "destructive" });
        setPendingWaToken(null);
        return;
      }
      if (data?.needTotp) {
        setTwoFA({ stage: "verify", mode: "code", code: pendingWaToken, sig: "wa-token" });
        setPendingWaToken(null);
        return;
      }
      setPendingWaToken(null);
      finalizeLogin(data.user, "");
      toast({ title: "✅ Login WA berhasil", description: "Token sudah diverifikasi." });
    } catch (e) {
      toast({ title: "Gagal memverifikasi token. Coba lagi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Submit kode 2FA (setup konfirmasi / verifikasi login)
  async function handleTwoFASubmit(inputCode: string) {
    if (!twoFA) return;
    if ((twoFA.mode as string) === "auth") {
      setTwoFALoading(true);
      const r = await linkWallet(inputCode);
      setTwoFALoading(false);
      if (r.ok) { finalizeLogin(r.user, ""); return; }
      toast({ title: r.message || "Kode 2FA salah", variant: "destructive" }); return;
    }
    setTwoFALoading(true);
    const deviceSummary = getDeviceSummary(navigator.userAgent);
    const visitorId = getVisitorId();
    let body: Record<string, unknown>;
    if (twoFA.mode === "code") {
      body = twoFA.sig === "wa-token"
        ? { action: "verify_wa_login_token", code: twoFA.code, visitorId, accountVisitorId: currentUser?.visitor_id, totpCode: inputCode, deviceInfo: { device: deviceSummary, browser: navigator.userAgent.substring(0, 100), details: loginDeviceDetails() }, deviceVisitorId: getVisitorId() }
        : { action: "login_with_code", code: twoFA.code, sig: twoFA.sig, totpCode: inputCode, deviceInfo: { device: deviceSummary, browser: navigator.userAgent.substring(0, 100), details: loginDeviceDetails() }, deviceVisitorId: getVisitorId() };
    } else {
      body = {
        action: twoFA.stage === "setup" ? "confirm_totp_setup" : "verify_totp",
        loginId: twoFA.loginId,
        password: twoFA.password,
        totpCode: inputCode,
        visitorId,
        deviceInfo: { device: deviceSummary, browser: navigator.userAgent.substring(0, 100), details: loginDeviceDetails() }, deviceVisitorId: getVisitorId(),
      };
    }
    const { data, error } = await supabase.functions.invoke("balance-auth", { body });
    setTwoFALoading(false);
    if (error || data?.error) {
      toast({ title: data?.error || "Kode 2FA salah", variant: "destructive" }); return;
    }
    finalizeLogin(data.user, twoFA.loginId || "");
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

  async function handleLogout() {
    // Cabut sesi login server untuk perangkat ini (bila akun memakai akun login), lalu bersihkan data lokal.
    await signOutWalletAuth();
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

  async function handleLogoutAll(revokeSupported: boolean) {
    let revoked = false;
    if (revokeSupported) {
      const r = await signOutWalletAuthEverywhere();
      if (r.error) { toast({ title: "Logout semua gagal", description: r.error, variant: "destructive" }); return; }
      revoked = r.revoked;
    }
    await signOutWalletAuth();
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
    toast(revoked
      ? { title: "Semua sesi dikeluarkan ✅", description: "Sesi login akun ini di semua perangkat sudah dicabut server, dan akun tersimpan di perangkat ini dihapus." }
      : { title: "Keluar dari perangkat ini", description: "Akun ini belum ditautkan ke akun login, jadi tidak ada sesi server di perangkat lain yang bisa dicabut. Akun tersimpan di perangkat ini sudah dihapus." });
  }

  function handleAddAccount() {
    if (!canAddAccount) {
      toast({
        title: `Slot penuh (${savedAccounts.length}/${MAX_SAVED_ACCOUNTS})`,
        description: slotLimit < 10 ? "Upgrade ke 10 slot di menu Ganti Akun, atau hapus salah satu akun." : "Hapus salah satu akun tersimpan untuk menambah akun baru.",
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
    // Logout active session so login/register form appears, then user logs into another account.
    // Sesi login akun lama ikut ditutup agar aksi akun baru tidak memakai identitas akun lama.
    void signOutWalletAuth();
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
    // Tutup sesi login akun sebelumnya: saldo/transaksi akun baru tidak boleh memakai identitas akun lama.
    if (currentUser) await signOutWalletAuth();
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
    setNewPin("");
    setConfirmPin("");
    setUseResetToken(false);
    setEmailPassword("");
    setEditSection(null);
    setShowNewPw(false);
    setPwResetMode("old");
    setWaCode("");
    setWaSentMask(null);
    setEmailUseWa(false);
    setTwoFaCode("");
    setTwoFaNewBackup(null);
    setTwoFaBarcode(null);
    setTwoFaSetup(null);
    setTwoFaSetupCode("");
    setTwoFaSavedConfirm(false);
    setTwoFaBackupVisible(false);
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



  async function handleUpdateProfile() {
    if (!currentUser) return;
    const phoneChanged = editPhone.trim() && editPhone.trim() !== (currentUser.phone || "");
    setEditLoading(true);
    // Nama tetap via update_profile; nomor WA lewat change_phone (aturan perangkat 30 hari, tanpa sandi)
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: {
        action: "update_profile",
        visitorId: currentUser.visitor_id,
        username: editUsername,
      },
    });
    if (error || data?.error) {
      setEditLoading(false);
      toast({ title: data?.error || "Gagal update profil", variant: "destructive" }); return;
    }
    let updatedUser = data.user;
    if (phoneChanged) {
      const res = await supabase.functions.invoke("balance-auth", {
        body: { action: "change_phone", visitorId: currentUser.visitor_id, newPhone: editPhone.trim() },
      });
      if (res.error || res.data?.error) {
        setEditLoading(false);
        onLogin(updatedUser);
        toast({ title: res.data?.error || "Gagal ganti nomor", variant: "destructive" }); return;
      }
      updatedUser = { ...updatedUser, phone: editPhone.trim() };
    }
    setEditLoading(false);
    onLogin(updatedUser);
    toast({ title: "Profil berhasil diperbarui ✅" });
    setEditSection(null);
  }


  // Sesi login baru milik dompet ini (bukan sesi admin di browser yang sama).
  async function currentAuthSession() {
    const flagged = localStorage.getItem("aas_wallet_auth_uid");
    if (!flagged) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id === flagged ? data.session : null;
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
      const authSess = await currentAuthSession();
      if (authSess) {
        setEditLoading(true);
        const { error: upErr } = await supabase.auth.updateUser({ password: newPassword, current_password: oldPassword } as Parameters<typeof supabase.auth.updateUser>[0]);
        setEditLoading(false);
        if (upErr) { console.error("[updateUser password]", upErr); toast({ title: "Gagal ubah sandi", description: friendlyAuthError(upErr), variant: "destructive" }); return; }
        toast({ title: "Sandi berhasil diubah ✅" });
        sendAdminWaNotif("password_change", { metode: "sandi lama" }, currentUser.visitor_id);
        resetEditForm();
        return;
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
      sendAdminWaNotif("password_change", { metode: "sandi lama" }, currentUser.visitor_id);

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
      const authSess = await currentAuthSession();
      if (authSess) {
        setEditLoading(true);
        const { error: upErr } = await supabase.auth.updateUser({ email: editEmail.trim().toLowerCase() }, { emailRedirectTo: `${window.location.origin}/saldo` });
        setEditLoading(false);
        if (upErr) { console.error("[updateUser email]", upErr); toast({ title: "Gagal ubah email", description: friendlyAuthError(upErr), variant: "destructive" }); return; }
        // Email di dompet baru berubah setelah konfirmasi (disinkronkan saat login berikutnya).
        toast({ title: "Cek email untuk konfirmasi", description: "Buka link konfirmasi yang dikirim. Email akun berubah setelah dikonfirmasi." });
        resetEditForm();
        return;
      }
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
    sendAdminWaNotif("email_change", { email_baru: editEmail.trim().toLowerCase() }, currentUser.visitor_id);

    resetEditForm();
  }

  async function handleResetPinWithWa() {
    if (!currentUser) return;
    if (!/^\d{6}$/.test(waCode.trim())) { toast({ title: "Masukkan kode WA 6 digit", variant: "destructive" }); return; }
    if (!/^\d{6}$/.test(newPin)) { toast({ title: "PIN baru harus 6 digit angka", variant: "destructive" }); return; }
    if (newPin !== confirmPin) { toast({ title: "Konfirmasi PIN tidak cocok", variant: "destructive" }); return; }
    setEditLoading(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: { action: "apply_reset_code", purpose: "pin", visitorId: currentUser.visitor_id, code: waCode.trim(), newValue: newPin },
    });
    setEditLoading(false);
    if (error || data?.error) { toast({ title: data?.error || "Gagal reset PIN", variant: "destructive" }); return; }
    toast({ title: "PIN berhasil direset ✅" });
    sendAdminWaNotif("pin_reset", { metode: "kode WhatsApp" }, currentUser.visitor_id);

    resetEditForm();
  }

  async function loadTwoFaStatus() {
    if (!currentUser) return;
    setTwoFaNewBackup(null);
    setTwoFaBarcode(null);
    setTwoFaCode("");
    setTwoFaBackupVisible(false);
    const { data } = await supabase.functions.invoke("balance-auth", {
      body: { action: "get_2fa_status", visitorId: currentUser.visitor_id },
    });
    if (data?.success) setTwoFaStatus({ enabled: !!data.enabled, backupCount: data.backupCount || 0 });
    setTwoFaSetup(null);
    setTwoFaSetupCode("");
    setTwoFaSavedConfirm(false);
  }

  async function handleStartSetup() {
    if (!currentUser) return;
    setTwoFaBusy(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: { action: "start_2fa_setup", visitorId: currentUser.visitor_id },
    });
    setTwoFaBusy(false);
    if (error || data?.error) { toast({ title: data?.error || "Gagal memulai setup 2FA", variant: "destructive" }); return; }
    setTwoFaSetup({ otpauth: data.otpauth, secret: data.secret, backupCodes: data.backupCodes || [] });
    setTwoFaSetupCode("");
    setTwoFaSavedConfirm(false);
    setTwoFaBackupVisible(false);
  }

  async function handleConfirmSetup() {
    if (!currentUser) return;
    if (!/^\d{6}$/.test(twoFaSetupCode)) { toast({ title: "Masukkan 6 digit kode authenticator", variant: "destructive" }); return; }
    setTwoFaBusy(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: { action: "confirm_2fa_setup", visitorId: currentUser.visitor_id, totpCode: twoFaSetupCode },
    });
    setTwoFaBusy(false);
    if (error || data?.error) { toast({ title: data?.error || "Kode 2FA salah", variant: "destructive" }); return; }
    const backupCodes = Array.isArray(data?.backupCodes) ? data.backupCodes : [];
    setTwoFaSetup((prev) => prev ? { ...prev, backupCodes } : prev);
    setTwoFaSetupCode("");
    setTwoFaSavedConfirm(false);
    setTwoFaBackupVisible(true);
    setTwoFaStatus({ enabled: true, backupCount: backupCodes.length });
    toast({ title: "2FA berhasil diaktifkan ✅", description: "8 kode cadangan sudah dibuat. Simpan sekarang." });
    sendAdminWaNotif("enable_2fa", {}, currentUser.visitor_id);

  }

  async function handleRegenBackup() {
    if (!currentUser) return;
    if (!/^\d{6}$/.test(twoFaCode)) { toast({ title: "Masukkan 6 digit kode authenticator", variant: "destructive" }); return; }
    setTwoFaBusy(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: { action: "regen_backup_codes", visitorId: currentUser.visitor_id, totpCode: twoFaCode },
    });
    setTwoFaBusy(false);
    if (error || data?.error) { toast({ title: data?.error || "Gagal buat kode cadangan", variant: "destructive" }); return; }
    setTwoFaNewBackup(data.backupCodes || []);
    setTwoFaBackupVisible(false);
    setTwoFaCode("");
    loadTwoFaStatus();
    toast({ title: "Kode cadangan baru dibuat ✅", description: "Kode lama tidak berlaku lagi." });
  }

  async function handleViewBarcode() {
    if (!currentUser) return;
    if (!/^\d{6}$/.test(twoFaCode)) { toast({ title: "Masukkan 6 digit kode authenticator", variant: "destructive" }); return; }
    setTwoFaBusy(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: { action: "view_2fa_barcode", visitorId: currentUser.visitor_id, totpCode: twoFaCode },
    });
    setTwoFaBusy(false);
    if (error || data?.error) { toast({ title: data?.error || "Gagal ambil barcode", variant: "destructive" }); return; }
    setTwoFaBarcode({ otpauth: data.otpauth, secret: data.secret });
    setTwoFaCode("");
  }

  async function handleDisableTwoFa() {
    if (!currentUser) return;
    if (!/^\d{6}$/.test(twoFaCode)) { toast({ title: "Masukkan 6 digit kode authenticator atau kode cadangan", variant: "destructive" }); return; }
    setTwoFaBusy(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: { action: "disable_2fa", visitorId: currentUser.visitor_id, totpCode: twoFaCode },
    });
    setTwoFaBusy(false);
    if (error || data?.error) { toast({ title: data?.error || "Gagal menonaktifkan 2FA", variant: "destructive" }); return; }
    setTwoFaCode("");
    setTwoFaNewBackup(null);
    setTwoFaBarcode(null);
    setTwoFaSetup(null);
    setTwoFaBackupVisible(false);
    setTwoFaStatus({ enabled: false, backupCount: 0 });
    toast({ title: "2FA berhasil dinonaktifkan" });
  }

  // Show logged-in state
  if (currentUser) {
    return (
      <div className="space-y-2">
        {pendingWaToken && (
          <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4" onClick={() => setPendingWaToken(null)}>
            <div className="w-full max-w-xs rounded-2xl border border-pink-200 bg-card p-4 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-pink-600" />
                <h4 className="text-sm font-bold">Konfirmasi Login WA</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Gunakan token <span className="font-mono font-bold text-foreground">{pendingWaToken}</span> untuk login WhatsApp ke akun saldo ini?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-1" onClick={() => { setPendingWaToken(null); toast({ title: "Login ditolak", description: "Mohon coba lagi jika token salah." }); }}>
                  <X className="h-3.5 w-3.5" /> Tidak
                </Button>
                <Button className="gap-1 bg-gradient-to-r from-pink-500 to-rose-500" onClick={confirmWaTokenLogin} disabled={loading}>
                  <Check className="h-3.5 w-3.5" /> Ya
                </Button>
              </div>
            </div>
          </div>
        )}
        <ProfileSecurityTop
          user={currentUser}
          banned={banned}
          savedCount={savedAccounts.length}
          slotCap={MAX_SAVED_ACCOUNTS}
          canAddAccount={canAddAccount}
          open={{ edit: showEditProfile, switcher: showSwitcher, code: showCodeCard, history: showHistory }}
          onToggleEdit={() => { setShowEditProfile(!showEditProfile); resetEditForm(); }}
          onToggleSwitcher={() => setShowSwitcher(!showSwitcher)}
          onToggleCode={() => setShowCodeCard(!showCodeCard)}
          onToggleHistory={(v) => setShowHistory(v ?? !showHistory)}
          onAddAccount={handleAddAccount}
          onLogout={() => { void handleLogout(); }}
          onLogoutAll={handleLogoutAll}
          summaryRefreshKey={twoFaStatus?.enabled ? 1 : 0}
        />

        {showCodeCard && !banned && currentUser?.visitor_id && (
          <div className="space-y-2">
            <DeviceLoginCode visitorId={currentUser.visitor_id} />

            {/* Verifikasi Token WA (.logintoken) — hanya setelah login */}
            <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Verifikasi Token WA</p>
                  <p className="text-[11px] text-muted-foreground">Ketik <span className="font-mono">.logintoken</span> di WhatsApp, lalu verifikasi di sini</p>
                </div>
              </div>

              {!showWaTokenInput ? (
                <Button size="sm" className="w-full gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white" onClick={() => setShowWaTokenInput(true)}>
                  <KeyRound className="h-3.5 w-3.5" /> Verifikasi Token WA
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input
                    className="text-sm font-mono tracking-wider text-center uppercase"
                    placeholder="Masukkan kode token WA"
                    value={waTokenInput}
                    onChange={(e) => setWaTokenInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    maxLength={32}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => { setShowWaTokenInput(false); setWaTokenInput(""); }}>
                      <X className="h-3.5 w-3.5" /> Batal
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                      disabled={waTokenInput.trim().length < 6}
                      onClick={() => { setPendingWaToken(waTokenInput.trim()); setShowWaTokenInput(false); setWaTokenInput(""); }}
                    >
                      <Check className="h-3.5 w-3.5" /> Verifikasi
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
                      <div
                        key={acc.visitor_id}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          isActive ? "bg-muted border-border" : "bg-background border-border hover:bg-muted/50"
                        }`}
                      >
                        <button
                          type="button"
                          disabled={isSwitching}
                          onClick={() => handleQuickSwitch(acc)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-wait"
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
                          ) : null}
                        </button>
                        {!isActive && !isSwitching && (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveSaved(acc.visitor_id, e)}
                            className="p-1 rounded hover:bg-destructive/10 text-destructive"
                            aria-label="Hapus akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {canAddAccount ? (
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
                  Slot penuh ({savedAccounts.length}/{MAX_SAVED_ACCOUNTS}). {slotLimit < 10 ? "Upgrade ke 10 slot atau hapus akun." : "Hapus salah satu akun untuk menambah baru."}
                </div>
              )}
              {currentUser && (
                <AccountSlotUpgrade visitorId={currentUser.visitor_id} status={slotStatus} onUpdated={applySlotStatus} />
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
                <Button size="sm" variant={editSection === "pin" ? "default" : "outline"} className="text-xs gap-1" onClick={() => { setEditSection(editSection === "pin" ? null : "pin"); resetEditForm(); setEditSection("pin"); }}>
                  <KeyRound className="w-3 h-3" /> PIN
                </Button>
                <Button size="sm" variant={editSection === "2fa" ? "default" : "outline"} className="text-xs gap-1" onClick={() => { resetEditForm(); if (editSection === "2fa") { setEditSection(null); } else { setEditSection("2fa"); loadTwoFaStatus(); } }}>
                  <ShieldCheck className="w-3 h-3" /> 2FA
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


              {/* Reset PIN via WhatsApp */}
              {editSection === "pin" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Reset PIN transaksi memakai kode 6 digit yang dikirim ke WhatsApp terdaftar.</p>
                  <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => requestWaCode("pin")} disabled={waSending}>
                    <Smartphone className="w-3.5 h-3.5" /> {waSending ? "Mengirim..." : "Kirim Kode Reset PIN ke WhatsApp"}
                  </Button>
                  {waSentMask && <p className="text-[10px] text-emerald-600 text-center">Kode dikirim ke {waSentMask} • 5 menit, 3x percobaan</p>}
                  <Input className="text-sm font-mono tracking-widest text-center" placeholder="Kode WA 6 digit" value={waCode} onChange={e => setWaCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" />
                  <Input className="text-sm font-mono tracking-widest text-center" type="password" placeholder="PIN baru 6 digit" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" />
                  <Input className="text-sm font-mono tracking-widest text-center" type="password" placeholder="Ulangi PIN baru" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" />
                  <Button size="sm" className="w-full gap-1.5" onClick={handleResetPinWithWa} disabled={editLoading}>
                    <KeyRound className="w-3.5 h-3.5" /> {editLoading ? "Memproses..." : "Reset PIN"}
                  </Button>
                </div>
              )}

              {/* 2FA Management */}
              {editSection === "2fa" && (
                <div id="balance-auth-2fa" className="space-y-3">

                  <div className="flex items-center gap-2 rounded-lg bg-secondary/60 p-2.5">
                    <ShieldCheck className={`h-4 w-4 ${twoFaStatus?.enabled ? "text-emerald-600" : "text-amber-600"}`} />
                    <p className="text-[11px] text-foreground">
                      Status 2FA:{" "}
                      <span className="font-bold">{twoFaStatus?.enabled ? "Aktif ✅" : "Belum aktif"}</span>
                      {twoFaStatus?.enabled && (
                        <span className="text-muted-foreground"> • {twoFaStatus.backupCount} kode cadangan tersisa</span>
                      )}
                    </p>
                  </div>

                  {twoFaSetup && twoFaSetup.backupCodes.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-semibold">
                        2FA berhasil aktif. Simpan 8 kode cadangan ini untuk masuk jika Google Authenticator tidak bisa dipakai.
                      </p>
                      <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/20">
                        <p className="mb-1.5 flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <KeyRound className="h-3.5 w-3.5" /> 8 Kode Cadangan
                        </p>
                        <div className="grid grid-cols-2 gap-1 font-mono text-sm font-semibold text-foreground">
                          {twoFaSetup.backupCodes.map((c) => <div key={c} className="rounded bg-background/70 px-2 py-1 text-center tracking-wider">{c}</div>)}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" onClick={() => { navigator.clipboard?.writeText(twoFaSetup.backupCodes.join("\n")); toast({ title: "Kode disalin" }); }}>
                            <Copy className="h-3.5 w-3.5" /> Salin
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" onClick={() => {
                            const blob = new Blob(["Kode Cadangan 2FA — Agung Adi Store\n\n" + twoFaSetup.backupCodes.join("\n")], { type: "text/plain" });
                            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "2fa-kode-cadangan.txt"; a.click();
                          }}>
                            <Download className="h-3.5 w-3.5" /> Unduh
                          </Button>
                        </div>
                        <label className="mt-2 flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                          <input type="checkbox" checked={twoFaSavedConfirm} onChange={(e) => setTwoFaSavedConfirm(e.target.checked)} className="mt-0.5" />
                          Saya sudah menyimpan kode cadangan ini.
                        </label>
                      </div>
                      <Button size="sm" className="w-full gap-1.5" onClick={loadTwoFaStatus} disabled={!twoFaSavedConfirm}>
                        <ShieldCheck className="w-3.5 h-3.5" /> Selesai
                      </Button>
                    </div>
                  ) : !twoFaStatus?.enabled ? (
                    !twoFaSetup ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Aktifkan sekarang: tekan tombol di bawah untuk memunculkan barcode & kunci, lalu scan di <b>Google Authenticator</b>.
                        </p>
                        <Button size="sm" className="w-full gap-1.5" onClick={handleStartSetup} disabled={twoFaBusy}>
                          <ShieldCheck className="w-3.5 h-3.5" /> {twoFaBusy ? "Memuat..." : "Aktifkan 2FA Sekarang"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Scan barcode ini di <b>Google Authenticator</b>, lalu masukkan 6 digit kode yang muncul untuk mengaktifkan.
                        </p>
                        <div className="flex flex-col items-center gap-2">
                          <div className="rounded-xl bg-white p-3 shadow-sm">
                            {twoFaSetupQr ? (
                              <img src={twoFaSetupQr} alt="Barcode 2FA" className="h-40 w-40" />
                            ) : (
                              <div className="h-40 w-40 animate-pulse rounded bg-muted" />
                            )}
                          </div>
                          <Button size="sm" variant="outline" className="w-full gap-1 text-xs" disabled={!twoFaSetupQr} onClick={() => {
                            if (!twoFaSetupQr) return;
                            const a = document.createElement("a"); a.href = twoFaSetupQr; a.download = "barcode-2fa.png"; a.click();
                            toast({ title: "Foto barcode diunduh" });
                          }}>
                            <Download className="h-3.5 w-3.5" /> Unduh Foto Barcode
                          </Button>
                        </div>
                        <div className="rounded-lg bg-secondary/60 p-2.5">
                          <p className="text-[11px] text-muted-foreground">Atau masukkan kunci manual:</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 break-all font-mono text-xs font-bold text-pink-600 dark:text-pink-400">{twoFaSetup.secret}</code>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { navigator.clipboard?.writeText(twoFaSetup.secret); toast({ title: "Kunci disalin" }); }}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <Input
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6 digit kode authenticator"
                          value={twoFaSetupCode}
                          onChange={(e) => setTwoFaSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="text-center text-base font-bold tracking-[0.3em]"
                        />
                        <Button size="sm" className="w-full gap-1.5" onClick={handleConfirmSetup} disabled={twoFaBusy || twoFaSetupCode.length !== 6}>
                          <ShieldCheck className="w-3.5 h-3.5" /> {twoFaBusy ? "Memproses..." : "Aktifkan 2FA"}
                        </Button>
                      </div>
                    )
                  ) : (
                    <>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Masukkan 6 digit kode dari <b>Google Authenticator</b> untuk melihat barcode, membuat ulang kode cadangan, atau menonaktifkan 2FA.
                      </p>
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6 digit kode authenticator"
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="text-center text-base font-bold tracking-[0.3em]"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleViewBarcode} disabled={twoFaBusy || twoFaCode.length !== 6}>
                          <QrCode className="w-3.5 h-3.5" /> Lihat Barcode
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleRegenBackup} disabled={twoFaBusy || twoFaCode.length !== 6}>
                          <KeyRound className="w-3.5 h-3.5" /> Kode Cadangan Baru
                        </Button>
                        <Button size="sm" variant="destructive" className="col-span-2 gap-1 text-xs" onClick={handleDisableTwoFa} disabled={twoFaBusy || twoFaCode.length !== 6}>
                          <X className="w-3.5 h-3.5" /> Nonaktifkan 2FA
                        </Button>
                      </div>

                      {twoFaBarcode && (
                        <div className="rounded-lg border border-pink-200/60 bg-background p-3 space-y-2 text-center">
                          {twoFaQr ? (
                            <img src={twoFaQr} alt="Barcode 2FA" className="mx-auto h-40 w-40" />
                          ) : (
                            <div className="mx-auto h-40 w-40 animate-pulse rounded bg-muted" />
                          )}
                          <div className="flex items-center gap-2">
                            <code className="flex-1 break-all font-mono text-[11px] font-bold text-pink-600 dark:text-pink-400">{twoFaBarcode.secret}</code>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { navigator.clipboard?.writeText(twoFaBarcode.secret); toast({ title: "Kunci disalin" }); }}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Button size="sm" variant="outline" className="w-full gap-1 text-xs" disabled={!twoFaQr} onClick={() => {
                            if (!twoFaQr) return;
                            const a = document.createElement("a"); a.href = twoFaQr; a.download = "barcode-2fa.png"; a.click();
                            toast({ title: "Foto barcode diunduh" });
                          }}>
                            <Download className="h-3.5 w-3.5" /> Unduh Foto Barcode
                          </Button>
                        </div>
                      )}

                      {twoFaNewBackup && twoFaNewBackup.length > 0 && (
                        <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/20">
                          <p className="mb-1.5 flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                            <KeyRound className="h-3.5 w-3.5" /> Kode Cadangan Baru
                          </p>
                          <Button size="sm" variant="outline" className="mb-2 h-7 w-full gap-1 text-xs" onClick={() => setTwoFaBackupVisible((v) => !v)}>
                            {twoFaBackupVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {twoFaBackupVisible ? "Sembunyikan kode" : "Tampilkan kode"}
                          </Button>
                          {twoFaBackupVisible && (
                            <div className="grid grid-cols-2 gap-1 font-mono text-sm font-semibold text-foreground">
                              {twoFaNewBackup.map((c) => <div key={c} className="rounded bg-background/70 px-2 py-1 text-center tracking-wider">{c}</div>)}
                            </div>
                          )}
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" onClick={() => { navigator.clipboard?.writeText(twoFaNewBackup.join("\n")); toast({ title: "Kode disalin" }); }}>
                              <Copy className="h-3.5 w-3.5" /> Salin
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" onClick={() => {
                              const blob = new Blob(["Kode Cadangan 2FA — Agung Adi Store\n\n" + twoFaNewBackup.join("\n")], { type: "text/plain" });
                              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "2fa-kode-cadangan.txt"; a.click();
                            }}>
                              <Download className="h-3.5 w-3.5" /> Unduh
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        )}

      </div>
    );
  }

  // Show login/register form
  const goForm = (next: "login" | "register" | "code") => {
    if (next === "register") { setMode("register"); setLoginMethod("manual"); setCodeLoginMode(false); }
    else if (next === "code") { setMode("login"); setLoginMethod("code"); setCodeLoginMode(true); }
    else { setMode("login"); setLoginMethod("manual"); setCodeLoginMode(false); }
    requestAnimationFrame(() => document.getElementById("balance-auth-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return (
    <div className={currentUser ? "" : "grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:items-start max-w-6xl mx-auto w-full"}>
      {!currentUser && <WalletLanding onLogin={() => goForm("login")} onRegister={() => goForm("register")} onCode={() => goForm("code")} />}
      <div id="balance-auth-form" className="scroll-mt-20 min-w-0">
    <Card className="border border-primary/20 relative rounded-[24px] shadow-xl shadow-primary/5 bg-card/90 backdrop-blur animate-fade-in">
      {!currentUser && <div className="sr-only" aria-live="polite">{mode === "register" ? "Form daftar" : loginMethod === "code" ? "Form login dengan kode" : "Form login"}</div>}
      {twoFA && (
        <TwoFactorAuth
          stage={twoFA.stage}
          otpauth={twoFA.otpauth}
          secret={twoFA.secret}
          backupCodes={twoFA.backupCodes}
          loading={twoFALoading}
          onSubmitCode={handleTwoFASubmit}
          onCancel={() => setTwoFA(null)}
        />
      )}
      <CardContent className="p-5 space-y-4">
        {pendingWaToken && (
          <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4" onClick={() => setPendingWaToken(null)}>
            <div className="w-full max-w-xs rounded-2xl border border-pink-200 bg-card p-4 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-pink-600" />
                <h4 className="text-sm font-bold">Konfirmasi Login WA</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Gunakan token <span className="font-mono font-bold text-foreground">{pendingWaToken}</span> untuk login WhatsApp ke akun saldo ini?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-1" onClick={() => { setPendingWaToken(null); toast({ title: "Login ditolak", description: "Mohon coba lagi jika token salah." }); }}>
                  <X className="h-3.5 w-3.5" /> Tidak
                </Button>
                <Button className="gap-1 bg-gradient-to-r from-pink-500 to-rose-500" onClick={confirmWaTokenLogin} disabled={loading}>
                  <Check className="h-3.5 w-3.5" /> Ya
                </Button>
              </div>
            </div>
          </div>
        )}
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/25">
            {mode === "register" ? <UserPlus className="w-7 h-7 text-primary-foreground" /> : <LogIn className="w-7 h-7 text-primary-foreground" />}
          </div>
          <h3 className="font-extrabold text-xl tracking-tight">
            {mode === "register" ? "Buat Akun Baru" : "Selamat Datang Kembali"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "register" ? "Daftar akun saldo Agung Adi Store" : "Masuk ke akun Agung Adi Store"}
          </p>
        </div>

        {verifyEmail && (
          <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-center animate-fade-in" role="status">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Mail className="h-6 w-6" /></div>
            <p className="text-base font-extrabold">Cek email kamu</p>
            <p className="text-sm text-muted-foreground">Kami meminta pengiriman link verifikasi ke <span className="break-all font-bold text-foreground">{verifyEmail}</span>. Buka link itu untuk mengaktifkan akun, lalu kamu otomatis masuk ke Saldo.</p>
            <p className="text-xs text-muted-foreground">Tidak ada email? Cek folder spam, atau kirim ulang.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" className="h-11 rounded-2xl" onClick={handleResendVerify} disabled={loading}>{loading ? "Mengirim..." : "Kirim ulang email"}</Button>
              <Button variant="ghost" className="h-11 rounded-2xl" onClick={() => { setVerifyEmail(null); setMode("login"); }}>Kembali ke login</Button>
            </div>
          </div>
        )}

        {claimOpen && (
          <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 animate-fade-in" role="dialog" aria-label="Hubungkan wallet lama">
            <p className="text-base font-extrabold">Hubungkan wallet lama</p>
            <p className="text-sm text-muted-foreground">Email ini sudah dipakai wallet lama. Demi keamanan, wallet tidak dihubungkan otomatis. Masukkan username/email/no HP dan sandi wallet lama untuk membuktikan kepemilikan. Saldo dan riwayat tetap sama.</p>
            <Input placeholder="Username / email / no HP wallet lama" value={claimId} onChange={(e) => setClaimId(e.target.value)} autoComplete="username" />
            <Input type="password" placeholder="Sandi wallet lama" value={claimPw} onChange={(e) => setClaimPw(e.target.value)} autoComplete="current-password" />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="h-11 rounded-2xl" onClick={handleClaim} disabled={loading}>{loading ? "Memeriksa..." : "Hubungkan wallet"}</Button>
              <Button variant="ghost" className="h-11 rounded-2xl" onClick={async () => { setClaimOpen(false); await signOutWalletAuth(); await supabase.auth.signOut({ scope: "local" }); }}>Batal</Button>
            </div>
          </div>
        )}

        {!verifyEmail && (
          <div className="space-y-3">
            <Button type="button" variant="outline" className="h-12 w-full gap-2 rounded-2xl font-bold" onClick={handleGoogle} disabled={loading}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>
              {mode === "register" ? "Daftar dengan Google" : "Lanjutkan dengan Google"}
            </Button>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" /> atau pakai email <span className="h-px flex-1 bg-border" /></div>
          </div>
        )}

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
                  <div
                    key={acc.visitor_id}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-transparent bg-muted/40 hover:bg-muted transition-colors"
                  >
                    <button
                      type="button"
                      disabled={isSwitching}
                      onClick={() => handleQuickSwitch(acc)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-wait"
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
                      {isSwitching && (
                        <span className="text-[10px] text-muted-foreground">Beralih...</span>
                      )}
                    </button>
                    {!isSwitching && (
                      <button
                        type="button"
                        onClick={(e) => handleRemoveSaved(acc.visitor_id, e)}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        aria-label="Hapus akun"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
          {/* Tab toggle: Login Manual vs Login Kode (selalu terlihat) */}
          {mode === "login" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/60 border border-border">
                <button
                  type="button"
                  onClick={() => { setLoginMethod("manual"); setCodeLoginMode(false); setCodeInput(""); }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    loginMethod === "manual"
                      ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  }`}
                >
                  <User className="w-4 h-4" /> Login Manual
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMethod("code"); setCodeLoginMode(true); setLoginId(""); setPassword(""); }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    loginMethod === "code"
                      ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  }`}
                >
                  <QrCode className="w-4 h-4" /> Login Kode
                </button>
              </div>
              <p className="text-[10px] text-center text-muted-foreground">
                {loginMethod === "manual"
                  ? "Email / Username / No HP + Sandi (+ 2FA jika aktif)"
                  : "Ketik kode / scan barcode dari perangkat yang sudah login"}
              </p>
            </div>
          )}



          {/* Form manual: register selalu, login hanya jika pilih manual */}
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

          {mode === "login" && loginMethod === "manual" && (
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

          {(mode === "register" || (mode === "login" && loginMethod === "manual")) && (
            <>
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

              {mode === "login" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-primary" /> 2FA (jika aktif) diminta setelah sandi benar.
                    </p>
                    <button type="button" className="shrink-0 text-xs font-bold text-primary hover:underline" onClick={() => { setForgotOpen((v) => !v); setForgotEmail(loginId.includes("@") ? loginId : ""); }}>
                      Lupa sandi?
                    </button>
                  </div>
                  {forgotOpen && (
                    <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-3 animate-fade-in">
                      <p className="text-xs font-bold">Reset sandi lewat email</p>
                      <Input type="email" placeholder="Email terdaftar" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                      <Button className="h-11 w-full rounded-2xl" onClick={handleForgot} disabled={loading}>{loading ? "Mengirim..." : "Kirim link reset"}</Button>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 font-bold gap-2 text-sm shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
                onClick={mode === "register" ? handleRegister : handleLogin}
                disabled={loading}
              >
                {loading ? "Loading..." : mode === "register" ? (
                  <><UserPlus className="w-4 h-4" /> Daftar</>
                ) : (
                  <><LogIn className="w-4 h-4" /> Login</>
                )}
              </Button>
            </>
          )}

          {/* Form kode perangkat: hanya di mode login + pilih code */}
          {mode === "login" && loginMethod === "code" && (
            <div className="space-y-2 rounded-xl border border-pink-200 bg-pink-50/50 dark:bg-pink-950/20 p-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-pink-600" /> Login Cepat Perangkat
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Masukkan <span className="font-bold text-pink-600">Kode Login</span> (6–12 karakter) dari halaman Saldo di perangkat yang sudah login.
              </p>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 uppercase tracking-widest font-mono"
                  placeholder="XPJD8H7S"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9: -]/g, ""))}
                  maxLength={64}
                />
              </div>
              <Button className="w-full gap-1 bg-gradient-to-r from-pink-500 to-rose-500 font-bold" onClick={() => handleLoginWithCode()} disabled={loading}>
                <LogIn className="w-4 h-4" /> {loading ? "Memproses..." : "Masuk dengan Kode"}
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
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-primary" />
                2FA (jika aktif) juga akan diminta setelah kode diverifikasi.
              </p>
            </div>
          )}

          <div className="text-center">
            {mode === "login" ? (
              <p className="text-xs text-muted-foreground">
                Belum punya akun?{" "}
                <button className="text-primary font-bold underline" onClick={() => { setMode("register"); setLoginMethod("manual"); resetForm(); }}>
                  Daftar
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sudah punya akun?{" "}
                <button className="text-primary font-bold underline" onClick={() => { setMode("login"); setLoginMethod("manual"); resetForm(); }}>
                  Login
                </button>
              </p>
            )}
          </div>
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
      </div>
    </div>
  );
}
