import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Loader2, BellRing, BellOff, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface Reminder {
  is_enabled: boolean;
  preferred_hour: number;
  preferred_minute: number;
  smart_mode: boolean;
  notify_browser: boolean;
}

interface Props {
  visitorId: string;
}

const REMINDER_FIRED_KEY = "streak_reminder_fired_date";

export default function SmartReminder({ visitorId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [smart, setSmart] = useState(true);
  const [hour, setHour] = useState(19);
  const [minute, setMinute] = useState(0);
  const [browserNotif, setBrowserNotif] = useState(true);
  const [suggestedHour, setSuggestedHour] = useState(19);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `streak-reminder?action=get&visitorId=${visitorId}`,
        { method: "GET" as any },
      );
      if (error) throw error;
      const r: Reminder | null = (data as any).reminder;
      setSuggestedHour((data as any).suggestedHour ?? 19);
      if (r) {
        setEnabled(r.is_enabled);
        setSmart(r.smart_mode);
        setHour(r.preferred_hour);
        setMinute(r.preferred_minute);
        setBrowserNotif(r.notify_browser);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") {
      toast({ title: "Browser tidak mendukung", description: "Notifikasi tidak tersedia di perangkat ini.", variant: "destructive" });
      return false;
    }
    const p = await Notification.requestPermission();
    setPermission(p);
    return p === "granted";
  };

  const save = async (overrides?: Partial<{ is_enabled: boolean; preferredHour: number; preferredMinute: number; smartMode: boolean; notifyBrowser: boolean }>) => {
    setSaving(true);
    try {
      const payload = {
        visitorId,
        isEnabled: overrides?.is_enabled ?? enabled,
        preferredHour: overrides?.preferredHour ?? hour,
        preferredMinute: overrides?.preferredMinute ?? minute,
        smartMode: overrides?.smartMode ?? smart,
        notifyBrowser: overrides?.notifyBrowser ?? browserNotif,
      };
      const { error } = await supabase.functions.invoke("streak-reminder?action=save", { body: payload });
      if (error) throw error;
      toast({ title: "💾 Tersimpan", description: "Pengaturan reminder diperbarui." });
    } catch (e) {
      toast({ title: "Gagal simpan", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEnable = async (val: boolean) => {
    setEnabled(val);
    if (val && browserNotif && permission !== "granted") {
      const ok = await requestPermission();
      if (!ok) {
        setEnabled(false);
        toast({ title: "Izin diperlukan", description: "Aktifkan notifikasi browser untuk menerima reminder." });
        return;
      }
    }
    save({ is_enabled: val });
  };

  // Effective hour/minute
  const effHour = smart ? suggestedHour : hour;
  const effMinute = smart ? 0 : minute;

  // In-app reminder check (every 60s while mounted)
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      const now = new Date();
      const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const todayKey = wibNow.toISOString().split("T")[0];
      const fired = localStorage.getItem(REMINDER_FIRED_KEY);
      if (fired === todayKey) return;
      const h = wibNow.getUTCHours();
      const m = wibNow.getUTCMinutes();
      if (h === effHour && m >= effMinute && m < effMinute + 5) {
        localStorage.setItem(REMINDER_FIRED_KEY, todayKey);
        if (browserNotif && permission === "granted" && typeof Notification !== "undefined") {
          new Notification("🔥 Jangan Lupa Klaim Streak!", {
            body: "Streak hariannya menunggu kamu. Yuk klaim sekarang!",
            icon: "/manifest.json",
          });
        }
        toast({ title: "🔥 Reminder Streak!", description: "Saatnya klaim streak harianmu." });
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [enabled, effHour, effMinute, browserNotif, permission]);

  if (loading) return (
    <div className="cyber-card-pink rounded-2xl p-4 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-pink-300" />
    </div>
  );

  return (
    <div className="cyber-card-pink rounded-2xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? <BellRing className="w-4 h-4 icon-3d-zap" strokeWidth={2.5} /> : <BellOff className="w-4 h-4 text-white/60" strokeWidth={2.5} />}
          <span className="text-xs font-black neon-text-pink tracking-widest uppercase">Reminder Pintar</span>
        </div>
        <Switch checked={enabled} onCheckedChange={handleEnable} disabled={saving} />
      </div>

      {enabled && (
        <>
          <div className="bg-black/40 rounded-lg p-2 border border-purple-500/30">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3 text-yellow-300" />
                <span className="text-[11px] font-bold text-white">Mode Pintar</span>
              </div>
              <Switch
                checked={smart}
                onCheckedChange={(v) => { setSmart(v); save({ smartMode: v }); }}
                disabled={saving}
              />
            </label>
            {smart ? (
              <p className="text-[9px] text-white/60 mt-1">
                Berdasarkan jam klaim biasamu: <span className="font-black text-cyan-300">{String(suggestedHour).padStart(2, "0")}:00 WIB</span>
              </p>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold text-white/70">Jam:</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hour}
                  onChange={(e) => setHour(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                  onBlur={() => save()}
                  className="w-12 bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-black text-white text-center"
                />
                <span className="text-white/60">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={minute}
                  onChange={(e) => setMinute(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  onBlur={() => save()}
                  className="w-12 bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-black text-white text-center"
                />
                <span className="text-[9px] text-white/60">WIB</span>
              </div>
            )}
          </div>

          <label className="flex items-center justify-between gap-2 cursor-pointer bg-black/30 rounded-lg p-2 border border-white/10">
            <div className="flex items-center gap-1.5">
              <Bell className="w-3 h-3 text-cyan-300" />
              <span className="text-[11px] font-bold text-white">Notifikasi Browser</span>
            </div>
            <Switch
              checked={browserNotif}
              onCheckedChange={(v) => { setBrowserNotif(v); save({ notifyBrowser: v }); }}
              disabled={saving}
            />
          </label>

          {browserNotif && permission !== "granted" && (
            <Button onClick={requestPermission} variant="outline" className="w-full h-8 text-[10px] font-black border-yellow-400/50 text-yellow-300 hover:bg-yellow-400/10">
              Izinkan Notifikasi
            </Button>
          )}

          <div className="text-[9px] text-center text-white/50">
            Reminder akan muncul sekitar <span className="font-black text-cyan-300">{String(effHour).padStart(2, "0")}:{String(effMinute).padStart(2, "0")} WIB</span> setiap hari.
          </div>
        </>
      )}
    </div>
  );
}
