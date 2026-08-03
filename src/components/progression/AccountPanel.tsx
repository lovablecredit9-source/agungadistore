import { useCallback, useEffect, useState } from "react";
import { Activity, Bell, BarChart3, Palette, Shield, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACCENT_COLORS, PRIVACY_META, fetchActivity, fetchDevices, fetchSettings, fetchSocial, fetchStats,
  logActivity, removeDevice, saveSettings, saveSocial, thisDeviceKey, touchDevice,
  type AccountStats, type ActivityRow, type DeviceRow, type PrivacyDiscover, type SettingsRow, type SocialRow,
} from "@/lib/social-account";

interface Props { visitorId: string }

export default function AccountPanel({ visitorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [social, setSocial] = useState<SocialRow | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [stats, setStats] = useState<AccountStats | null>(null);

  const load = useCallback(async () => {
    await touchDevice(visitorId);
    const [s, so, d, a, st] = await Promise.all([
      fetchSettings(visitorId), fetchSocial(visitorId), fetchDevices(visitorId),
      fetchActivity(visitorId), fetchStats(visitorId),
    ]);
    setSettings(s); setSocial(so); setDevices(d); setActivity(a); setStats(st);
    setLoading(false);
  }, [visitorId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const patchSettings = async (p: Partial<SettingsRow>) => {
    if (!settings) return;
    setSettings({ ...settings, ...p });
    await saveSettings(visitorId, p);
  };

  const setPrivacy = async (v: PrivacyDiscover) => {
    if (!social) return;
    setSocial({ ...social, privacy_discover: v });
    await saveSocial(visitorId, { privacy_discover: v });
    await logActivity(visitorId, "Ubah privasi", PRIVACY_META[v].label);
    setActivity(await fetchActivity(visitorId));
  };

  const setDnd = async (v: boolean) => {
    if (!social) return;
    setSocial({ ...social, dnd: v });
    await saveSocial(visitorId, { dnd: v });
    toast.success(v ? "Mode Jangan Ganggu aktif" : "Mode Jangan Ganggu nonaktif");
  };

  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>;

  const row = (label: string, desc: string, value: boolean, onChange: (v: boolean) => void) => (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  const myKey = thisDeviceKey();

  return (
    <div className="space-y-4">
      {/* Statistik */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Statistik akun</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { l: "Total partner", v: stats?.partners ?? 0 },
            { l: "Total panggilan", v: stats?.calls ?? 0 },
            { l: "Total pesan", v: stats?.messages ?? 0 },
            { l: "Teman disimpan", v: stats?.favorites ?? 0 },
            { l: "Waktu pemakaian", v: `${stats?.usageMinutes ?? 0} mnt` },
            { l: "Perangkat aktif", v: devices.length },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-border p-3">
              <div className="text-lg font-black">{typeof s.v === "number" ? s.v.toLocaleString("id-ID") : s.v}</div>
              <div className="text-[11px] text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Notifikasi */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Notifikasi</h3>
        <div className="divide-y divide-border">
          {row("Teman favorit online", "Beri tahu saat teman favorit sedang aktif", !!settings?.notif_friend_online, (v) => patchSettings({ notif_friend_online: v }))}
          {row("Hadiah harian", "Pengingat klaim hadiah login harian", !!settings?.notif_daily_reward, (v) => patchSettings({ notif_daily_reward: v }))}
          {row("Level baru", "Notifikasi saat naik level atau membuka badge", !!settings?.notif_level_up, (v) => patchSettings({ notif_level_up: v }))}
          {row("Mode Jangan Ganggu", "Senyapkan semua notifikasi sementara", !!social?.dnd, setDnd)}
        </div>
      </section>

      {/* Keamanan & privasi */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Keamanan & privasi</h3>
        <p className="text-[11px] text-muted-foreground mb-2">Siapa yang dapat menemukan akunmu</p>
        <div className="space-y-2">
          {(Object.keys(PRIVACY_META) as PrivacyDiscover[]).map((k) => {
            const on = social?.privacy_discover === k;
            return (
              <button key={k} onClick={() => setPrivacy(k)}
                className={`w-full text-left rounded-xl border p-3 transition ${on ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
                <div className="text-sm font-semibold">{PRIVACY_META[k].label}</div>
                <div className="text-[11px] text-muted-foreground">{PRIVACY_META[k].desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Personalisasi */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /> Personalisasi</h3>
        <p className="text-[11px] text-muted-foreground mb-2">Warna aksen</p>
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((c) => (
            <button key={c.key} aria-label={c.label} onClick={() => patchSettings({ accent_color: c.key })}
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.class} ring-2 transition ${settings?.accent_color === c.key ? "ring-primary scale-105" : "ring-transparent"}`} />
          ))}
        </div>
        <div className="divide-y divide-border mt-2">
          {row("Efek suara", "Bunyi saat aksi penting", !!settings?.sound_enabled, (v) => patchSettings({ sound_enabled: v }))}
          {row("Animasi", "Animasi transisi dan efek visual", !!settings?.animation_enabled, (v) => patchSettings({ animation_enabled: v }))}
        </div>
      </section>

      {/* Perangkat */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Smartphone className="w-4 h-4 text-primary" /> Pengelolaan perangkat</h3>
        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">
                  {d.label || d.platform || "Perangkat"}
                  {d.device_key === myKey && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">Perangkat ini</span>}
                </div>
                <div className="text-[10px] text-muted-foreground">Aktif {new Date(d.last_active_at).toLocaleString("id-ID")}</div>
              </div>
              {d.device_key !== myKey && (
                <button aria-label="Hapus perangkat" onClick={async () => { await removeDevice(d.id); setDevices(await fetchDevices(visitorId)); toast.success("Perangkat dihapus"); }}>
                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Riwayat aktivitas */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Riwayat aktivitas akun</h3>
        {activity.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada aktivitas tercatat.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activity.map((a) => (
              <div key={a.id} className="rounded-xl border border-border p-2.5">
                <div className="text-xs font-semibold">{a.action}</div>
                <div className="text-[10px] text-muted-foreground">{a.detail ? `${a.detail} • ` : ""}{new Date(a.created_at).toLocaleString("id-ID")}</div>
              </div>
            ))}
          </div>
        )}
        <Button variant="secondary" size="sm" className="w-full mt-3"
          onClick={async () => { await logActivity(visitorId, "Cek keamanan", "Pemeriksaan manual dari panel akun"); setActivity(await fetchActivity(visitorId)); toast.success("Aktivitas dicatat"); }}>
          Catat pemeriksaan keamanan
        </Button>
      </section>
    </div>
  );
}
