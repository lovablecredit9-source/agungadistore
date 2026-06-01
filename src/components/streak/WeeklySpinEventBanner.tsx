import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Clock, Coins, Gem, Gift, Info, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Segment {
  id: string;
  label: string;
  icon: string;
  color: string;
  rarity: string;
  weight: number;
  is_active: boolean;
  reward_type: string;
  reward_value: number;
}

interface Settings {
  id: string;
  is_active: boolean;
  banner_title: string;
  banner_description: string;
  banner_color: string;
  admin_note: string;
  event_days: number;
  event_starts_at: string | null;
  event_ends_at: string | null;
  cost_coins: number;
  cost_gems: number;
  free_spin_per_week: number;
  max_spin_per_week: number;
}

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}h ${h.toString().padStart(2, "0")}j ${m.toString().padStart(2, "0")}m ${sec.toString().padStart(2, "0")}d`;
}

export default function WeeklySpinEventBanner() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: s } = await supabase.from("weekly_spin_event_settings").select("*").limit(1).maybeSingle();
      const { data: seg } = await supabase.from("weekly_spin_wheel_segments").select("*").eq("is_active", true).order("sort_order");
      if (mounted) {
        setSettings(s as Settings | null);
        setSegments((seg as Segment[]) ?? []);
        setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const endsAt = useMemo(() => {
    if (!settings) return null;
    if (settings.event_ends_at) return new Date(settings.event_ends_at).getTime();
    const start = settings.event_starts_at ? new Date(settings.event_starts_at).getTime() : null;
    if (start) return start + (settings.event_days ?? 7) * 86400_000;
    return null;
  }, [settings]);

  if (loading) {
    return (
      <div className="rounded-2xl border-2 border-purple-500/40 p-4 bg-gradient-to-br from-purple-950 to-indigo-950 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
        <span className="text-xs text-purple-200 font-bold">Memuat event roda spin...</span>
      </div>
    );
  }

  // Hanya tampil kalau admin set event aktif
  if (!settings || !settings.is_active) {
    return (
      <div className="rounded-2xl border-2 border-white/10 p-4 bg-black/30 text-center">
        <Info className="w-5 h-5 text-white/40 mx-auto mb-1" />
        <p className="text-xs font-bold text-white/60">Belum ada event roda spin yang aktif saat ini.</p>
        <p className="text-[10px] text-white/40 mt-0.5">Cek lagi nanti ya!</p>
      </div>
    );
  }

  const remaining = endsAt ? endsAt - now : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border-2 border-fuchsia-500/50 p-4 bg-gradient-to-br from-fuchsia-950 via-purple-950 to-indigo-950 shadow-[0_0_30px_rgba(217,70,239,0.35)] space-y-3"
      style={settings.banner_color ? { borderColor: settings.banner_color + "80" } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>
            <Sparkles className="w-6 h-6 text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]" strokeWidth={2.5} />
          </motion.div>
          <div>
            <div className="text-[10px] font-black tracking-widest text-fuchsia-300 uppercase">Event Roda Spin · Live</div>
            <div className="text-base font-black text-white">{settings.banner_title || "Spin Wheel Event"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/30 border border-green-400/50">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
          <span className="text-[9px] font-black text-green-200">AKTIF</span>
        </div>
      </div>

      {settings.banner_description && (
        <p className="text-xs text-white/80 font-medium">{settings.banner_description}</p>
      )}

      {remaining !== null && (
        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-black/40 border border-fuchsia-500/30">
          <Clock className="w-3.5 h-3.5 text-fuchsia-300" strokeWidth={2.5} />
          <span className="text-[10px] font-black text-fuchsia-200 uppercase tracking-wider">Berakhir dalam</span>
          <span className="ml-auto text-xs font-black text-white tabular-nums">{fmt(remaining)}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-yellow-500/15 border border-yellow-400/40">
          <div className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5 text-yellow-300" strokeWidth={2.5} /><span className="text-[9px] font-black text-yellow-100 uppercase">Biaya Koin</span></div>
          <div className="text-base font-black text-yellow-50 tabular-nums">{settings.cost_coins?.toLocaleString("id-ID") ?? 0}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/40">
          <div className="flex items-center gap-1.5"><Gem className="w-3.5 h-3.5 text-cyan-200" strokeWidth={2.5} /><span className="text-[9px] font-black text-cyan-100 uppercase">Biaya Gem</span></div>
          <div className="text-base font-black text-cyan-50 tabular-nums">{settings.cost_gems?.toLocaleString("id-ID") ?? 0}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40">
          <div className="flex items-center gap-1.5"><Gift className="w-3.5 h-3.5 text-emerald-300" strokeWidth={2.5} /><span className="text-[9px] font-black text-emerald-100 uppercase">Spin Gratis/Minggu</span></div>
          <div className="text-base font-black text-emerald-50 tabular-nums">{settings.free_spin_per_week ?? 0}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-pink-500/15 border border-pink-400/40">
          <div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-pink-300" strokeWidth={2.5} /><span className="text-[9px] font-black text-pink-100 uppercase">Max Spin/Minggu</span></div>
          <div className="text-base font-black text-pink-50 tabular-nums">{settings.max_spin_per_week ?? 0}</div>
        </div>
      </div>

      {segments.length > 0 && (
        <div>
          <div className="text-[10px] font-black text-white/80 uppercase tracking-wider mb-1.5">🎁 Hadiah ({segments.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {segments.map((s) => (
              <div key={s.id} className="flex items-center gap-1 px-2 py-1 rounded-full border border-white/15 bg-white/5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: s.color }}>{s.icon}</span>
                <span className="text-[10px] font-bold text-white">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {settings.admin_note && (
        <div className="flex items-start gap-1.5 p-2 rounded-xl bg-black/30 border border-white/10">
          <Info className="w-3.5 h-3.5 text-white/60 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
          <span className="text-[11px] text-white/80 font-medium">{settings.admin_note}</span>
        </div>
      )}
    </motion.div>
  );
}
