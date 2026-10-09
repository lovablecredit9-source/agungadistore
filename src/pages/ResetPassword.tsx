import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyAuthError } from "@/lib/authBridge";

type Stage = "checking" | "ready" | "invalid" | "done";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Reset Sandi — Agung Adi Store";
    const params = new URLSearchParams(window.location.hash.slice(1) + "&" + window.location.search.slice(1));
    if (params.get("error_code")) {
      console.error("[reset-password link]", params.get("error_code"), params.get("error_description"));
      setError(params.get("error_code") === "otp_expired" ? "Link reset sandi sudah kedaluwarsa. Minta link baru dari halaman login." : "Link reset sandi tidak valid.");
      setStage("invalid");
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStage("ready");
    });
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setStage((s) => (s === "checking" ? (data.session ? "ready" : "invalid") : s));
    }, 1500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit() {
    setError(null);
    if (pw.length < 6) return setError("Sandi minimal 6 karakter.");
    if (pw !== pw2) return setError("Konfirmasi sandi tidak sama.");
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (e) { console.error("[updateUser password]", e); return setError(friendlyAuthError(e)); }
    setStage("done");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md rounded-[24px] border border-primary/20 bg-card p-6 shadow-xl shadow-primary/5 animate-fade-in">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold">Buat Sandi Baru</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agung Adi Store</p>
        </div>

        {stage === "checking" && <p className="text-center text-sm text-muted-foreground">Memeriksa link…</p>}

        {stage === "invalid" && (
          <div className="space-y-3 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="text-sm">{error || "Link reset sandi tidak valid atau sudah kedaluwarsa."}</p>
            <Button className="h-11 w-full rounded-2xl" onClick={() => navigate("/saldo")}>Ke halaman login</Button>
          </div>
        )}

        {stage === "ready" && (
          <div className="space-y-3">
            <div className="relative">
              <Input type={show ? "text" : "password"} placeholder="Sandi baru (min. 6 karakter)" value={pw} onChange={(e) => setPw(e.target.value)} className="pr-10" autoComplete="new-password" />
              <button type="button" aria-label={show ? "Sembunyikan sandi" : "Tampilkan sandi"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShow(!show)}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Input type={show ? "text" : "password"} placeholder="Ulangi sandi baru" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button className="h-12 w-full rounded-2xl font-bold" onClick={submit} disabled={busy}>{busy ? "Menyimpan…" : "Simpan sandi baru"}</Button>
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm">Sandi berhasil diganti. Silakan masuk ke Saldo.</p>
            <Button className="h-11 w-full rounded-2xl" onClick={async () => { await supabase.auth.signOut({ scope: "local" }); navigate("/saldo"); }}>Ke halaman login</Button>
          </div>
        )}
      </section>
    </main>
  );
}
