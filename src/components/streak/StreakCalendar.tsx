import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Flame, Snowflake, X, Trophy } from "lucide-react";
import StreakFlame from "./StreakFlame";
import { getStreakTier, isMilestoneDay } from "./streakTiers";

interface Props {
  visitorId: string;
}

interface DayInfo {
  date: string;
  claimed: boolean;
  isFreeze: boolean;
  isToday: boolean;
  isFuture: boolean;
  /** consecutive claimed days ending on this date (from the real claim log) */
  run: number;
}

function prevDay(ds: string) {
  const d = new Date(`${ds}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

export default function StreakCalendar({ visitorId }: Props) {
  const [days, setDays] = useState<DayInfo[]>([]);
  const [monthLabel, setMonthLabel] = useState("");
  const [stats, setStats] = useState({ claimed: 0, missed: 0, freeze: 0 });
  const [currentStreak, setCurrentStreak] = useState(0);

  async function load() {
    // Reward log gives claim history (wider window so run lengths are accurate)
    const { data: logs } = await supabase
      .from("streak_rewards_log")
      .select("claim_date")
      .eq("visitor_id", visitorId)
      .gte("claim_date", new Date(Date.now() - 400 * 86400000).toISOString().split("T")[0]);

    const { data: streak } = await supabase
      .from("daily_streaks")
      .select("freeze_used_at, current_streak")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    const claimedSet = new Set((logs || []).map((l: any) => l.claim_date));
    const freezeDate = streak?.freeze_used_at;
    setCurrentStreak((streak as any)?.current_streak || 0);

    const runCache = new Map<string, number>();
    const runOf = (ds: string): number => {
      if (!claimedSet.has(ds) && ds !== freezeDate) return 0;
      if (runCache.has(ds)) return runCache.get(ds)!;
      // iterative walk back
      let n = 0; let cur = ds;
      while ((claimedSet.has(cur) || cur === freezeDate) && n < 1000) { n++; cur = prevDay(cur); }
      runCache.set(ds, n);
      return n;
    };

    const today = new Date();
    const wibToday = new Date(today.getTime() + 7 * 3600 * 1000);
    const year = wibToday.getUTCFullYear();
    const month = wibToday.getUTCMonth();
    setMonthLabel(wibToday.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }));

    const firstDay = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const startWeekday = firstDay.getUTCDay();

    const arr: DayInfo[] = [];
    for (let i = 0; i < startWeekday; i++) {
      arr.push({ date: "", claimed: false, isFreeze: false, isToday: false, isFuture: false, run: 0 });
    }
    let claimed = 0, missed = 0, freezeCount = 0;
    const todayStr = wibToday.toISOString().split("T")[0];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isFuture = ds > todayStr;
      const wasClaimed = claimedSet.has(ds);
      const isFreeze = ds === freezeDate;
      arr.push({ date: ds, claimed: wasClaimed, isFreeze, isToday: ds === todayStr, isFuture, run: wasClaimed ? runOf(ds) : 0 });
      if (!isFuture) {
        if (wasClaimed) claimed++;
        else if (isFreeze) freezeCount++;
        else if (ds !== todayStr) missed++;
      }
    }
    setDays(arr);
    setStats({ claimed, missed, freeze: freezeCount });
  }

  useEffect(() => { if (visitorId) load(); /* eslint-disable-next-line */ }, [visitorId]);

  const tier = getStreakTier(currentStreak);

  return (
    <div
      className="streak-stage rounded-2xl p-3 space-y-2 border"
      style={{ background: `linear-gradient(160deg, ${tier.color}1f, ${tier.bg} 50%, #05050a)`, borderColor: `${tier.color}44` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="w-4 h-4 shrink-0" style={{ color: tier.accent }} strokeWidth={2.5} />
          <span className="text-xs font-black tracking-widest uppercase truncate" style={{ color: tier.accent }}>{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-bold shrink-0">
          <span className="flex items-center gap-1" style={{ color: tier.color }}><Flame className="w-2.5 h-2.5" /> {stats.claimed}</span>
          <span className="flex items-center gap-1" style={{ color: "#67e8f9" }}><Snowflake className="w-2.5 h-2.5" /> {stats.freeze}</span>
          <span className="flex items-center gap-1" style={{ color: "#f87171" }}><X className="w-2.5 h-2.5" /> {stats.missed}</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => (
          <div key={i} className="text-[9px] font-black stk-muted">{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d.date) return <div key={i} />;
          const num = parseInt(d.date.split("-")[2]);
          const dayTier = getStreakTier(d.run);
          const milestone = d.claimed && isMilestoneDay(d.run);
          let style: React.CSSProperties;
          if (d.isFuture) style = { background: "rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.3)" };
          else if (d.claimed) style = { background: `radial-gradient(circle, ${dayTier.color}44, ${dayTier.bg})`, borderColor: `${dayTier.color}99`, boxShadow: `0 0 8px ${dayTier.color}55` };
          else if (d.isFreeze) style = { background: "linear-gradient(135deg, #0e7490aa, #1e3a8a88)", borderColor: "#67e8f9aa", color: "#cffafe" };
          else if (d.isToday) style = { background: "rgba(255,255,255,.05)", borderColor: tier.color, borderStyle: "dashed", color: tier.accent };
          else style = { background: "repeating-linear-gradient(135deg, #450a0a66 0 4px, #1c050566 4px 8px)", borderColor: "#ef444466", color: "#fca5a5aa" };

          return (
            <div
              key={i}
              className={`relative aspect-square rounded-lg flex items-center justify-center text-[10px] font-black border overflow-visible ${d.isToday ? "stk-pulse" : ""}`}
              style={{ ...style, ["--stk-c" as any]: `${tier.color}88`, outline: d.isToday ? `2px solid ${tier.accent}` : undefined, outlineOffset: d.isToday ? 1 : undefined }}
              title={d.claimed ? `Klaim · streak ${d.run} hari` : d.isFreeze ? "Freeze dipakai" : d.isFuture ? "" : d.isToday ? "Hari ini" : "Terlewat"}
            >
              {d.claimed ? (
                <StreakFlame streak={d.run} tier={dayTier} size={26} mini />
              ) : d.isFreeze ? (
                <Snowflake className="w-3.5 h-3.5" />
              ) : !d.isFuture && !d.isToday ? (
                <span className="relative">{num}<X className="absolute -top-1 -right-2 w-2 h-2" /></span>
              ) : num}
              {milestone && (
                <span
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center border"
                  style={{ background: dayTier.color, borderColor: dayTier.accent, boxShadow: `0 0 6px ${dayTier.color}` }}
                >
                  <Trophy className="w-2.5 h-2.5" style={{ color: dayTier.bg }} strokeWidth={3} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px] stk-muted">
        <span className="flex items-center gap-1"><Flame className="w-2.5 h-2.5" style={{ color: tier.color }} /> Klaim</span>
        <span className="flex items-center gap-1"><Snowflake className="w-2.5 h-2.5" style={{ color: "#67e8f9" }} /> Freeze</span>
        <span className="flex items-center gap-1"><X className="w-2.5 h-2.5" style={{ color: "#f87171" }} /> Terlewat</span>
        <span className="flex items-center gap-1"><Trophy className="w-2.5 h-2.5" style={{ color: tier.accent }} /> Milestone</span>
      </div>
    </div>
  );
}
