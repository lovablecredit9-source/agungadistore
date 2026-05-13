import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Lock, LogIn, UserPlus, KeyRound, AtSign, LogOut, FileText } from "lucide-react";

export interface AnonAccount {
  id: string;
  email: string;
  primary_visitor_id: string | null;
  created_at: string;
  bio?: string | null;
}

async function call(action: string, visitorId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("anon-chat-auth", {
    body: { action, visitorId, ...extra },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchAnonAccount(visitorId: string): Promise<AnonAccount | null> {
  try {
    const data = await call("me", visitorId);
    return (data?.account as AnonAccount) || null;
  } catch {
    return null;
  }
}

export function AnonAccountDialog({
  open,
  onOpenChange,
  visitorId,
  account,
  onAccountChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  visitorId: string;
  account: AnonAccount | null;
  onAccountChange: (acc: AnonAccount | null) => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "manage" | "change-email" | "change-password">(
    account ? "manage" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(account ? "manage" : "login");
      setEmail(""); setPassword(""); setNewEmail(""); setNewPassword("");
    }
  }, [open, account]);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "register") {
        const data = await call("register", visitorId, { email, password });
        onAccountChange(data.account);
        toast.success("Akun Anon Chat berhasil dibuat 🎉");
        setMode("manage");
      } else if (mode === "login") {
        const data = await call("login", visitorId, { email, password });
        onAccountChange(data.account);
        toast.success("Berhasil login");
        setMode("manage");
      } else if (mode === "change-email") {
        const data = await call("change_email", visitorId, { newEmail, password });
        onAccountChange(data.account);
        toast.success("Email berhasil diubah");
        setMode("manage");
      } else if (mode === "change-password") {
        await call("change_password", visitorId, { oldPassword: password, newPassword });
        toast.success("Sandi berhasil diubah");
        setMode("manage");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!confirm("Putuskan akun Anon Chat di perangkat ini?")) return;
    setBusy(true);
    try {
      await call("logout", visitorId);
      onAccountChange(null);
      toast.success("Akun diputuskan");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const Field = ({ icon: Icon, ...p }: any) => (
    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5">
      <Icon className="w-4 h-4 text-emerald-300 shrink-0" />
      <input {...p} className="bg-transparent outline-none text-sm text-slate-100 flex-1 placeholder:text-slate-500" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-emerald-400/30 text-slate-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-emerald-200">
            {mode === "login" && "Login Akun Anon"}
            {mode === "register" && "Buat Akun Anon"}
            {mode === "manage" && "Akun Anon Chat"}
            {mode === "change-email" && "Ganti Email"}
            {mode === "change-password" && "Ganti Sandi"}
          </DialogTitle>
        </DialogHeader>

        {mode === "manage" && account && (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
              <div className="text-[11px] text-emerald-200/70 uppercase tracking-wide">Email</div>
              <div className="text-sm font-bold break-all">{account.email}</div>
            </div>
            <button onClick={() => setMode("change-email")} disabled={busy} className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold flex items-center justify-center gap-2"><AtSign className="w-4 h-4" /> Ganti Email</button>
            <button onClick={() => setMode("change-password")} disabled={busy} className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold flex items-center justify-center gap-2"><KeyRound className="w-4 h-4" /> Ganti Sandi</button>
            <button onClick={logout} disabled={busy} className="w-full py-3 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-sm font-bold flex items-center justify-center gap-2"><LogOut className="w-4 h-4" /> Putuskan Akun</button>
          </div>
        )}

        {(mode === "login" || mode === "register") && (
          <div className="space-y-3">
            <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={(e: any) => setEmail(e.target.value)} autoComplete="email" />
            <Field icon={Lock} type="password" placeholder="Sandi (min 6)" value={password} onChange={(e: any) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            <button onClick={submit} disabled={busy || !email || !password} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {mode === "login" ? <><LogIn className="w-4 h-4" /> Masuk</> : <><UserPlus className="w-4 h-4" /> Daftar</>}
            </button>
            <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="w-full text-xs text-emerald-300 hover:underline">
              {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Login"}
            </button>
            <p className="text-[10px] text-slate-500 text-center">Akun terpisah dari saldo. Hanya untuk Anon Chat.</p>
          </div>
        )}

        {mode === "change-email" && (
          <div className="space-y-3">
            <Field icon={Mail} type="email" placeholder="Email baru" value={newEmail} onChange={(e: any) => setNewEmail(e.target.value)} />
            <Field icon={Lock} type="password" placeholder="Sandi lama (untuk verifikasi)" value={password} onChange={(e: any) => setPassword(e.target.value)} autoComplete="current-password" />
            <div className="flex gap-2">
              <button onClick={() => setMode("manage")} className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold">Batal</button>
              <button onClick={submit} disabled={busy || !newEmail || !password} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold disabled:opacity-50">Simpan</button>
            </div>
          </div>
        )}

        {mode === "change-password" && (
          <div className="space-y-3">
            <Field icon={Lock} type="password" placeholder="Sandi lama" value={password} onChange={(e: any) => setPassword(e.target.value)} autoComplete="current-password" />
            <Field icon={KeyRound} type="password" placeholder="Sandi baru (min 6)" value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} autoComplete="new-password" />
            <div className="flex gap-2">
              <button onClick={() => setMode("manage")} className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold">Batal</button>
              <button onClick={submit} disabled={busy || !password || newPassword.length < 6} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold disabled:opacity-50">Simpan</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
