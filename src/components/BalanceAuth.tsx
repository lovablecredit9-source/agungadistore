import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import { getDeviceSummary, collectDeviceInfo } from "@/lib/device-info";
import {
  Wallet, LogIn, UserPlus, LogOut, Smartphone, History, Eye, EyeOff, Mail, Lock, User, Phone,
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUser && showHistory) {
      fetchLoginHistory();
    }
  }, [currentUser, showHistory]);

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
    const visitorId = getVisitorId();
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

    // Save login state
    localStorage.setItem("balance_logged_in", "true");
    localStorage.setItem("balance_email", email.trim().toLowerCase());

    onLogin(data.user);
    toast({ title: "Pendaftaran berhasil! 🎉" });
    resetForm();
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      toast({ title: "Email dan sandi wajib diisi", variant: "destructive" }); return;
    }

    setLoading(true);
    const visitorId = getVisitorId();
    const deviceSummary = getDeviceSummary();

    const { data, error } = await supabase.functions.invoke("balance-auth", {
      body: {
        action: "login",
        email: email.trim(),
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
    localStorage.setItem("balance_email", email.trim().toLowerCase());

    onLogin(data.user);
    toast({ title: `Selamat datang, ${data.user.username}! 👋` });
    resetForm();
  }

  function handleLogout() {
    localStorage.removeItem("balance_logged_in");
    localStorage.removeItem("balance_email");
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
  }

  // Show logged-in state with logout + history
  if (currentUser) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
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
            {mode === "register" ? "Buat akun baru dengan email dan sandi" : "Masuk dengan email dan sandi"}
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
            </>
          )}

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
