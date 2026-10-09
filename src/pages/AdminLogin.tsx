import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@/lib/router-compat";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

/** Login admin: Auth email+password, lalu role admin/super_admin dicek di server (has_role). */
async function isAdmin(uid: string) {
  const [a, s] = await Promise.all([
    supabase.rpc("has_role" as never, { _user_id: uid, _role: "admin" } as never),
    supabase.rpc("has_role" as never, { _user_id: uid, _role: "super_admin" } as never),
  ]);
  return !!(a.data || s.data);
}

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Sesi admin yang masih aktif langsung diteruskan ke dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (uid && (await isAdmin(uid))) navigate("/admin/dashboard", { replace: true });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Format email tidak valid."); return; }
    if (!password) { setError("Password wajib diisi."); return; }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError || !data.user) {
        const msg = authError?.message?.toLowerCase() ?? "";
        setError(msg.includes("rate") || msg.includes("too many") ? "Terlalu banyak percobaan. Coba lagi beberapa saat." : "Kredensial admin tidak valid.");
        return;
      }
      if (!(await isAdmin(data.user.id))) {
        await supabase.auth.signOut();
        setError("Kredensial admin tidak valid.");
        return;
      }
      setSuccess(true);
      navigate("/admin/dashboard");
    } catch {
      setError(navigator.onLine ? "Server sedang bermasalah. Coba lagi." : "Tidak ada koneksi internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login relative min-h-dvh overflow-hidden flex items-center justify-center px-4 py-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="al-blob al-blob-a" />
        <span className="al-blob al-blob-b" />
        <span className="al-blob al-blob-c" />
        <span className="al-grid" />
      </div>

      <main className="relative w-full max-w-[400px]">
        <div className="al-card rounded-3xl p-[1px]">
          <div className="rounded-3xl bg-card/75 backdrop-blur-2xl px-6 py-7 sm:px-8 sm:py-8">
            <div className="text-center">
              <div className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform duration-500 ${success ? "al-success scale-110" : ""}`}>
                <ShieldCheck className="h-7 w-7" strokeWidth={2.2} />
              </div>
              <p className="mt-4 text-[11px] font-bold tracking-[0.3em] text-muted-foreground">AGUNG ADI STORE</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">Admin Portal</h1>
              <p className="mt-1 text-sm text-muted-foreground">Kelola toko dengan aman dan mudah.</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                <Lock className="h-3 w-3" /> Secure Admin Access
              </span>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="text-xs font-semibold text-foreground">Email Admin</label>
                <div className="al-field relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input id="admin-email" type="email" autoComplete="username" inputMode="email" placeholder="Masukkan email admin"
                    value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    className="h-12 w-full rounded-xl border border-border bg-background/60 pl-10 pr-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="text-xs font-semibold text-foreground">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input id="admin-password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Masukkan password"
                    value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className="h-12 w-full rounded-xl border border-border bg-background/60 pl-10 pr-12 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]" />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={show}
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="mt-px h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <button type="submit" disabled={loading || success} aria-busy={loading}
                className="al-btn relative h-12 w-full overflow-hidden rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-80 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                <span className="relative inline-flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Memverifikasi...</> : success ? <><ShieldCheck className="h-4 w-4" /> Berhasil</> : "Masuk ke Admin"}
                </span>
              </button>
            </form>
          </div>
        </div>
        <p className="mt-5 text-center text-[11px] text-muted-foreground">Hanya untuk admin resmi Agung Adi Store.</p>
      </main>
    </div>
  );
};

export default AdminLogin;
