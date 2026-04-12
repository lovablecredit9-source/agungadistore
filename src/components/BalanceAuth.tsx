import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import { getDeviceSummary } from "@/lib/device-info";
import {
  Wallet, LogIn, UserPlus, LogOut, Smartphone, History, Eye, EyeOff, Mail, Lock, User, Phone,
  Edit2, KeyRound, Save, X,
} from "lucide-react";

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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [loginId, setLoginId] = useState(""); // for login: email/username/phone
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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
  const [emailPassword, setEmailPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const { toast } = useToast();

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

    onLogin(data.user);
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

    onLogin(data.user);
    toast({ title: `Selamat datang, ${data.user.username}! 👋` });
    resetForm();
  }

  function handleLogout() {
    localStorage.removeItem("balance_logged_in");
    localStorage.removeItem("balance_email");
    localStorage.removeItem("balance_visitor_id");
    onLogout();
    toast({ title: "Berhasil logout dari akun saldo" });
  }

  function handleSwitchAccount() {
    handleLogout();
    setMode("login");
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
    if (useResetToken) {
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
    if (!emailPassword) {
      toast({ title: "Masukkan sandi untuk konfirmasi", variant: "destructive" }); return;
    }
    setEditLoading(true);
    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: {
        action: "change_email",
        visitorId: currentUser.visitor_id,
        newEmail: editEmail.trim(),
        password: emailPassword,
      },
    });
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold" onClick={() => { setShowEditProfile(!showEditProfile); resetEditForm(); }}>
            <Edit2 className="w-3.5 h-3.5" /> Edit Profil
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold" onClick={handleSwitchAccount}>
            <LogIn className="w-3.5 h-3.5" /> Login Lain
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold text-destructive border-destructive/30" onClick={handleLogout}>
            <LogOut className="w-3.5 h-3.5" /> Logout
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs font-bold" onClick={() => setShowHistory(!showHistory)}>
            <Smartphone className="w-3.5 h-3.5" /> Riwayat
          </Button>
        </div>

        {/* Edit Profile Panel */}
        {showEditProfile && (
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
                  <Button size="sm" className="w-full gap-1.5" onClick={handleUpdateProfile} disabled={editLoading}>
                    <Save className="w-3.5 h-3.5" /> {editLoading ? "Menyimpan..." : "Simpan Profil"}
                  </Button>
                </div>
              )}

              {/* Change Password */}
              {editSection === "password" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant={!useResetToken ? "default" : "outline"} className="text-xs flex-1" onClick={() => setUseResetToken(false)}>
                      Sandi Lama
                    </Button>
                    <Button size="sm" variant={useResetToken ? "default" : "outline"} className="text-xs flex-1 gap-1" onClick={() => setUseResetToken(true)}>
                      <KeyRound className="w-3 h-3" /> Token Reset
                    </Button>
                  </div>

                  {!useResetToken ? (
                    <>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input className="pl-9 text-sm" type="password" placeholder="Sandi lama" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
                      </div>
                    </>
                  ) : (
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9 text-sm font-mono tracking-wider" placeholder="Token dari admin" value={resetToken} onChange={e => setResetToken(e.target.value.toUpperCase())} maxLength={8} />
                    </div>
                  )}

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9 pr-10 text-sm" type={showNewPw ? "text" : "password"} placeholder="Sandi baru (min. 6)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNewPw(!showNewPw)}>
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {!useResetToken && (
                    <Input className="text-sm" type="password" placeholder="Konfirmasi sandi baru" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  )}

                  <Button size="sm" className="w-full gap-1.5" onClick={handleChangePassword} disabled={editLoading}>
                    <Lock className="w-3.5 h-3.5" /> {editLoading ? "Memproses..." : useResetToken ? "Reset Sandi" : "Ubah Sandi"}
                  </Button>
                </div>
              )}

              {/* Change Email */}
              {editSection === "email" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Email saat ini: <span className="font-medium text-foreground">{currentUser.email || "-"}</span></p>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9 text-sm" type="email" placeholder="Email baru" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9 text-sm" type="password" placeholder="Konfirmasi sandi" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} />
                  </div>
                  <Button size="sm" className="w-full gap-1.5" onClick={handleChangeEmail} disabled={editLoading}>
                    <Mail className="w-3.5 h-3.5" /> {editLoading ? "Memproses..." : "Ubah Email"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showHistory && (
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
    <Card className="border-2 border-primary/20">
      <CardContent className="p-5 space-y-4">
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
        </div>
      </CardContent>
    </Card>
  );
}
