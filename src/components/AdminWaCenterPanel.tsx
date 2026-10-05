import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Shield, Trash2, Plus, Loader2, Activity } from "lucide-react";

const ROLES = [
  "super_admin",
  "admin",
  "moderator",
  "finance",
  "support",
  "game_admin",
  "firepass_admin",
] as const;
const FLAGS: [string, string][] = [
  ["wa_maintenance", "Maintenance mode"],
  ["wa_feature_ai", "Store AI"],
  ["wa_feature_router", "AI Router (tanpa command)"],
  ["wa_feature_firepass", "Fire Pass"],
  ["wa_feature_anon", "Anonymous Chat"],
  ["wa_feature_galau", "Bot Galau"],
  ["wa_feature_confess", "Confess"],
  ["wa_feature_notif", "Notifikasi"],
  ["wa_feature_broadcast", "Broadcast"],
];

type AdminRow = {
  id: string;
  phone: string;
  label: string | null;
  role: string;
  is_active: boolean;
};
type AuditRow = {
  id: string;
  actor_phone: string;
  actor_role: string | null;
  action: string;
  result: string;
  created_at: string;
};

/** Admin Center Bot WA: nomor admin + role, fitur ON/OFF, rate limit, kesehatan bot, audit log. */
export default function AdminWaCenterPanel() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<string>("admin");
  const [rate, setRate] = useState("30");
  const [botName, setBotName] = useState("Agung Adi Store Super Bot");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [a, s, l, h] = await Promise.all([
      supabase
        .from("wa_bot_admins")
        .select("id, phone, label, role, is_active")
        .order("created_at"),
      supabase
        .from("admin_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [...FLAGS.map((f) => f[0]), "wa_rate_limit_per_min", "wa_bot_name"]),
      supabase
        .from("wa_admin_audit_log")
        .select("id, actor_phone, actor_role, action, result, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("wa_bot_health").select("*").eq("id", "main").maybeSingle(),
    ]);
    setAdmins((a.data as AdminRow[]) ?? []);
    const m = Object.fromEntries((s.data ?? []).map((r: any) => [r.setting_key, r.setting_value]));
    setFlags(m);
    setRate(m.wa_rate_limit_per_min ?? "30");
    setBotName(m.wa_bot_name ?? "Agung Adi Store Super Bot");
    setAudit((l.data as AuditRow[]) ?? []);
    setHealth(h.data);
  };
  useEffect(() => {
    load();
  }, []);

  const flagOn = (k: string) =>
    k === "wa_maintenance" ? flags[k] === "true" : (flags[k] ?? "true") !== "false";
  const setFlag = async (k: string, on: boolean) => {
    setFlags((f) => ({ ...f, [k]: on ? "true" : "false" }));
    await supabase
      .from("admin_settings")
      .upsert({ setting_key: k, setting_value: on ? "true" : "false" } as any, {
        onConflict: "setting_key",
      });
  };
  const saveRate = async () => {
    const n = Math.max(5, Math.min(300, Number(rate) || 30));
    await supabase
      .from("admin_settings")
      .upsert({ setting_key: "wa_rate_limit_per_min", setting_value: String(n) } as any, {
        onConflict: "setting_key",
      });
    toast({ title: "Batas perintah disimpan" });
  };
  const saveName = async () => {
    const v = botName.trim().slice(0, 60) || "Agung Adi Store Super Bot";
    await supabase
      .from("admin_settings")
      .upsert({ setting_key: "wa_bot_name", setting_value: v } as any, { onConflict: "setting_key" });
    toast({ title: "Nama bot disimpan" });
  };
  const addAdmin = async () => {
    let d = phone.replace(/\D/g, "");
    if (d.startsWith("0")) d = "62" + d.slice(1);
    if (d.startsWith("8")) d = "62" + d;
    if (d.length < 10) return toast({ title: "Nomor tidak valid", variant: "destructive" });
    setBusy(true);
    const { error } = await supabase
      .from("wa_bot_admins")
      .insert({ phone: d, label: label || null, role } as any);
    setBusy(false);
    if (error)
      return toast({
        title: "Gagal menambah admin",
        description: error.message,
        variant: "destructive",
      });
    setPhone("");
    setLabel("");
    load();
  };
  const update = async (id: string, patch: Partial<AdminRow>) => {
    await supabase
      .from("wa_bot_admins")
      .update(patch as any)
      .eq("id", id);
    load();
  };
  const remove = async (id: string) => {
    await supabase.from("wa_bot_admins").delete().eq("id", id);
    load();
  };

  const beatAge = health
    ? Math.round((Date.now() - new Date(health.updated_at).getTime()) / 1000)
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="font-bold text-sm flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-primary" /> Kesehatan Bot
          </p>
          {health ? (
            <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
              <span>
                Status:{" "}
                <b className="text-foreground">
                  {beatAge !== null && beatAge < 180 ? health.status : "tidak terhubung"}
                </b>
              </span>
              <span>Versi: {health.version}</span>
              <span>Reconnect: {health.reconnect_count}</span>
              <span>Memori: {health.memory_mb} MB</span>
              <span>Error command: {health.command_errors}</span>
              <span>Heartbeat: {beatAge}s lalu</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Bot versi baru belum pernah terhubung. Download ulang ZIP bot lalu jalankan.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-bold text-sm flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-primary" /> Admin WhatsApp & Role
          </p>
          <p className="text-[11px] text-muted-foreground">
            Hanya nomor di sini yang bisa memakai perintah admin. Setiap role punya izin berbeda.
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="Nomor WA (08…/62…)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              placeholder="Nama (opsional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <select
              className="h-10 rounded-md border bg-background px-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Button onClick={addAdmin} disabled={busy} className="gap-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}{" "}
              Tambah
            </Button>
          </div>
          <div className="space-y-1.5">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl border p-2 text-xs">
                <span className="font-mono font-bold flex-1">
                  {a.phone} {a.label ? `· ${a.label}` : ""}
                </span>
                <select
                  className="h-8 rounded-md border bg-background px-1"
                  value={a.role}
                  onChange={(e) => update(a.id, { role: e.target.value })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <Switch
                  checked={a.is_active}
                  onCheckedChange={(v) => update(a.id, { is_active: v })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => remove(a.id)}
                  aria-label="Hapus admin"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {admins.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Belum ada admin. Nomor admin dari ZIP bot otomatis menjadi super admin saat bot
                pertama kali tersambung.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-bold text-sm">Fitur Bot WA</p>
          {FLAGS.map(([k, l]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span>{l}</span>
              <Switch checked={flagOn(k)} onCheckedChange={(v) => setFlag(k, v)} />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm flex-1">Batas perintah admin / menit</span>
            <Input
              className="w-20"
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/\D/g, ""))}
            />
            <Button size="sm" onClick={saveRate}>
              Simpan
            </Button>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm flex-1">Nama bot</span>
            <Input className="w-44" value={botName} maxLength={60} onChange={(e) => setBotName(e.target.value)} />
            <Button size="sm" onClick={saveName}>
              Simpan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="font-bold text-sm">Riwayat Aksi Admin</p>
          {audit.map((l) => (
            <div key={l.id} className="text-[11px] flex justify-between gap-2 border-b py-1">
              <span className="font-mono">
                {l.actor_phone.slice(0, 5)}*** ({l.actor_role})
              </span>
              <span className="font-bold">{l.action}</span>
              <span className="text-muted-foreground">{l.result}</span>
              <span className="text-muted-foreground">
                {new Date(l.created_at).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
          {audit.length === 0 && <p className="text-xs text-muted-foreground">Belum ada aksi.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
