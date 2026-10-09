import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldPlus, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Admin = { email: string; role: string; last_sign_in_at: string | null };

/** Super admin menambah admin. Password dikirim sekali ke server lalu dikelola Auth; tidak disimpan di browser. */
export default function AdminAccountsPanel() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function call(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("admin-accounts", { body });
    let msg = (data as { error?: string } | null)?.error;
    if (error && !msg) { try { msg = (await (error as { context?: Response }).context?.json())?.error; } catch { /* noop */ } }
    if (error || msg) throw new Error(msg || "Gagal menghubungi server");
    return data as Record<string, unknown>;
  }

  const load = () => call({ action: "list" }).then((d) => setAdmins(d.admins as Admin[])).catch(() => setForbidden(true));
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const d = await call({ action: "create", email, password });
      toast({ title: d.already_admin ? "Akun sudah admin" : d.created ? "Admin baru dibuat" : "Akses admin diberikan", description: email });
      setEmail(""); setPassword(""); load();
    } catch (err) {
      toast({ title: "Gagal menambah admin", description: (err as Error).message, variant: "destructive" });
    } finally { setBusy(false); setPassword(""); }
  }

  if (forbidden) return null;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="font-bold text-sm flex items-center gap-2"><UserCog className="w-4 h-4 text-primary" /> Akun Admin</p>
        {admins === null ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <ul className="space-y-1">
            {admins.map((a) => (
              <li key={a.email + a.role} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                <span className="truncate font-medium">{a.email}</span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{a.role}</span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submit} className="space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Tambah admin baru. Password langsung disimpan aman oleh sistem login, tidak tersimpan di aplikasi.</p>
          <Input type="email" autoComplete="off" placeholder="Email admin baru" aria-label="Email admin baru" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="relative">
            <Input type={show ? "text" : "password"} autoComplete="new-password" placeholder="Password (min. 8 karakter)" aria-label="Password admin baru" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="pr-11" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"} className="absolute right-1 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center text-muted-foreground">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldPlus className="w-4 h-4" />} Tambah Admin</Button>
        </form>
      </CardContent>
    </Card>
  );
}
