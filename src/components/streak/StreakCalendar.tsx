import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Flame, Snowflake, X } from "lucide-react";

interface Props {
  visitorId: string;
}

interface DayInfo {
  date: string;
  claimed: boolean;
  isFreeze: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export default function StreakCalendar({ visitorId }: Props) {
  const [days, setDays] = useState<DayInfo[]>([]);
  const [monthLabel, setMonthLabel] = useState("");
  const [stats, setStats] = useState({ claimed: 0, missed: 0, freeze: 0 });

  async function load() {
    // Reward log gives claim history
    const { data: logs } = await supabase
      .from("streak_rewards_log")
      .select("claim_date")
      .eq("visitor_id", visitorId)
      .gte("claim_date", new Date(Date.now() - 35 * 86400000).toISOString().split("T")[0]);

    const { data: streak } = await supabase
      .from("daily_streaks")
      .select("freeze_used_at")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    const claimedSet = new Set((logs || []).map((l: any) => l.claim_date));
    const freezeDate = streak?.freeze_used_at;

    const today = new Date();
    const wibToday = new Date(today.getTime() + 7 * 3600 * 1000);
    const year = wibToday.getUTCFullYear();
    const month = wibToday.getUTCMonth();
    setMonthLabel(wibToday.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }));

    const firstDay = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const startWeekday = firstDay.getUTCDay();

    const arr: DayInfo[] = [];
    // Padding before
    for (let i = 0; i < startWeekday; i++) {
      arr.push({ date: "", claimed: false, isFreeze: false, isToday: false, isFuture: false });
    }
    let claimed = 0, missed = 0, freezeCount = 0;
    const todayStr = wibToday.toISOString().split("T")[0];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isFuture = ds > todayStr;
      const wasClaimed = claimedSet.has(ds);
      const isFreeze = ds === freezeDate;
      arr.push({ date: ds, claimed: wasClaimed, isFreeze, isToday: ds === todayStr, isFuture });
      if (!isFuture) {
        if (wasClaimed) claimed++;
        else if (isFreeze) freezeCount++;
        else missed++;
      }
    }
    setDays(arr);
    setStats({ claimed, missed, freeze: freezeCount });
  }

  useEffect(() => { if (visitorId) load(); /* eslint-disable-next-line */ }, [visitorId]);

  return (
    <div className="cyber-card-cyan rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 icon-3d-target" strokeWidth={2.5} />
          <span className="text-xs font-black neon-text-cyan tracking-widest uppercase">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-bold">
          <span className="text-emerald-400 flex items-center gap-1"><Flame className="w-2.5 h-2.5" /> {stats.claimed}</span>
          <span className="text-cyan-400 flex items-center gap-1"><Snowflake className="w-2.5 h-2.5" /> {stats.freeze}</span>
          <span className="text-red-400 flex items-center gap-1"><X className="w-2.5 h-2.5" /> {stats.missed}</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => (
          <div key={i} className="text-[9px] font-black text-white/40">{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d.date) return <div key={i} />;
          const num = parseInt(d.date.split("-")[2]);
          return (
            <div
              key={i}
              className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-black border ${
                d.isToday
                  ? "ring-2 ring-yellow-400 border-yellow-400"
                  : ""
              } ${
                d.isFuture
                  ? "bg-white/5 border-white/10 text-white/30"
                  : d.claimed
                  ? "bg-gradient-to-br from-orange-500/40 to-pink-500/40 border-orange-400/50 text-white"
                  : d.isFreeze
                  ? "bg-cyan-500/30 border-cyan-400/50 text-cyan-100"
                  : "bg-red-950/30 border-red-500/30 text-red-300/50"
              }`}
            >
              {d.claimed ? "🔥" : d.isFreeze ? "❄️" : num}
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-center text-white/50">🔥 Klaim · ❄️ Freeze · ❌ Terlewat</p>
    </div>
  );
}
