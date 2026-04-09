import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Star, Gift, Check, Zap } from "lucide-react";

interface StreakData {
  id: string;
  visitor_id: string;
  last_claim_date: string;
  current_streak: number;
  longest_streak: number;
  total_claims: number;
}

const MILESTONES = [
  { days: 3, label: "3 Hari", icon: "🔥", reward: "Pemula" },
  { days: 7, label: "7 Hari", icon: "⭐", reward: "Rajin" },
  { days: 14, label: "14 Hari", icon: "💪", reward: "Konsisten" },
  { days: 30, label: "30 Hari", icon: "🏆", reward: "Master" },
  { days: 60, label: "60 Hari", icon: "👑", reward: "Legend" },
  { days: 100, label: "100 Hari", icon: "💎", reward: "Diamond" },
  { days: 365, label: "1 Tahun", icon: "🌟", reward: "Immortal" },
];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function isYesterday(dateStr: string) {
  const d = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toISOString().split("T")[0] === yesterday.toISOString().split("T")[0];
}

function isToday(dateStr: string) {
  return dateStr === getToday();
}

export default function DailyStreak() {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [showMilestone, setShowMilestone] = useState<typeof MILESTONES[0] | null>(null);
  const visitorId = getVisitorId();

  useEffect(() => {
    fetchStreak();
  }, []);

  async function fetchStreak() {
    const { data } = await supabase
      .from("daily_streaks")
      .select("*")
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (data) setStreak(data as unknown as StreakData);
  }

  const canClaim = !streak || !isToday(streak.last_claim_date);
  const streakBroken = streak && !isToday(streak.last_claim_date) && !isYesterday(streak.last_claim_date);

  async function claimStreak() {
    if (!canClaim) return;
    setClaiming(true);

    try {
      if (!streak) {
        // First claim ever
        const { data, error } = await supabase.from("daily_streaks").insert({
          visitor_id: visitorId,
          last_claim_date: getToday(),
          current_streak: 1,
          longest_streak: 1,
          total_claims: 1,
        } as any).select().single();
        if (!error && data) {
          setStreak(data as unknown as StreakData);
          setJustClaimed(true);
          checkMilestone(1);
        }
      } else {
        const newStreak = streakBroken ? 1 : streak.current_streak + 1;
        const newLongest = Math.max(streak.longest_streak, newStreak);
        const { data, error } = await supabase.from("daily_streaks").update({
          last_claim_date: getToday(),
          current_streak: newStreak,
          longest_streak: newLongest,
          total_claims: streak.total_claims + 1,
        } as any).eq("id", streak.id).select().single();
        if (!error && data) {
          setStreak(data as unknown as StreakData);
          setJustClaimed(true);
          checkMilestone(newStreak);
        }
      }
    } finally {
      setClaiming(false);
      setTimeout(() => setJustClaimed(false), 3000);
    }
  }

  function checkMilestone(days: number) {
    const milestone = MILESTONES.find(m => m.days === days);
    if (milestone) {
      setShowMilestone(milestone);
      setTimeout(() => setShowMilestone(null), 4000);
    }
  }

  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;
  const totalClaims = streak?.total_claims || 0;

  // Calculate progress to next milestone
  const nextMilestone = MILESTONES.find(m => m.days > currentStreak) || MILESTONES[MILESTONES.length - 1];
  const prevMilestone = [...MILESTONES].reverse().find(m => m.days <= currentStreak);
  const progressStart = prevMilestone ? prevMilestone.days : 0;
  const progressEnd = nextMilestone.days;
  const progress = Math.min(100, ((currentStreak - progressStart) / (progressEnd - progressStart)) * 100);

  // 7-day calendar display
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("id-ID", { weekday: "short" });
    const isClaimedDay = streak && (
      i === 0 ? isToday(streak.last_claim_date) :
      currentStreak > i && !streakBroken
    );
    days.push({ date: dateStr, dayName, day: d.getDate(), isClaimed: !!isClaimedDay, isToday: i === 0 });
  }

  return (
    <div className="space-y-3">
      {/* Main Streak Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/15 via-red-500/10 to-yellow-500/10 border border-orange-500/20 p-4">
        {/* Animated background */}
        {justClaimed && (
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 animate-pulse" />
        )}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentStreak > 0 ? "bg-gradient-to-br from-orange-500 to-red-500" : "bg-muted"} transition-all ${justClaimed ? "scale-125 animate-bounce" : ""}`}>
                <Flame className={`w-6 h-6 ${currentStreak > 0 ? "text-white" : "text-muted-foreground"}`} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm">Streak Harian</h3>
                <p className="text-[10px] text-muted-foreground">Klaim setiap hari!</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-black ${currentStreak > 0 ? "bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent" : "text-muted-foreground"}`}>
                {currentStreak}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold">HARI</p>
            </div>
          </div>

          {/* 7-day Calendar */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {days.map((d, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-[9px] text-muted-foreground font-medium">{d.dayName}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 transition-all ${
                  d.isClaimed
                    ? "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/30"
                    : d.isToday
                      ? canClaim ? "border-2 border-dashed border-orange-500 text-orange-500 animate-pulse" : "bg-orange-500/20 text-orange-500"
                      : "bg-muted/50 text-muted-foreground"
                }`}>
                  {d.isClaimed ? <Check className="w-4 h-4" /> : d.day}
                </div>
              </div>
            ))}
          </div>

          {/* Progress to next milestone */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">{prevMilestone ? `${prevMilestone.icon} ${prevMilestone.reward}` : "Mulai"}</span>
              <span className="font-bold text-foreground">{nextMilestone.icon} {nextMilestone.label} ({nextMilestone.reward})</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 text-center">
              {progressEnd - currentStreak} hari lagi ke {nextMilestone.reward}
            </p>
          </div>

          {/* Claim Button */}
          <Button
            onClick={claimStreak}
            disabled={!canClaim || claiming}
            className={`w-full font-bold gap-2 text-sm transition-all ${
              canClaim
                ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02]"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {claiming ? (
              <><Zap className="w-4 h-4 animate-spin" /> Mengklaim...</>
            ) : !canClaim ? (
              <><Check className="w-4 h-4" /> Sudah Diklaim Hari Ini ✅</>
            ) : streakBroken ? (
              <><Flame className="w-4 h-4" /> Mulai Streak Baru! 🔥</>
            ) : (
              <><Flame className="w-4 h-4" /> Klaim Hari Ini! 🔥</>
            )}
          </Button>

          {streakBroken && canClaim && (
            <p className="text-[10px] text-destructive text-center mt-1 font-medium">
              ⚠️ Streak terputus! Klaim sekarang untuk mulai lagi.
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-background/50 rounded-xl p-2 text-center">
              <Flame className="w-4 h-4 mx-auto text-orange-500 mb-0.5" />
              <p className="text-xs font-extrabold">{currentStreak}</p>
              <p className="text-[9px] text-muted-foreground">Streak</p>
            </div>
            <div className="bg-background/50 rounded-xl p-2 text-center">
              <Trophy className="w-4 h-4 mx-auto text-yellow-500 mb-0.5" />
              <p className="text-xs font-extrabold">{longestStreak}</p>
              <p className="text-[9px] text-muted-foreground">Terbaik</p>
            </div>
            <div className="bg-background/50 rounded-xl p-2 text-center">
              <Star className="w-4 h-4 mx-auto text-primary mb-0.5" />
              <p className="text-xs font-extrabold">{totalClaims}</p>
              <p className="text-[9px] text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Milestones List */}
      <div className="bg-card rounded-xl border p-3 space-y-2">
        <h4 className="text-xs font-bold flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-primary" /> Milestone Streak
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {MILESTONES.map((m) => {
            const achieved = currentStreak >= m.days;
            return (
              <div
                key={m.days}
                className={`flex items-center gap-2 rounded-lg p-2 text-xs transition-all ${
                  achieved
                    ? "bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20"
                    : "bg-muted/30 opacity-60"
                }`}
              >
                <span className="text-lg">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold truncate ${achieved ? "text-foreground" : "text-muted-foreground"}`}>{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.reward}</p>
                </div>
                {achieved && <Check className="w-4 h-4 text-orange-500 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestone Achievement Popup */}
      {showMilestone && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-xs rounded-2xl p-6 text-center animate-in zoom-in-95 duration-300 space-y-3">
            <div className="text-6xl animate-bounce">{showMilestone.icon}</div>
            <h3 className="text-xl font-extrabold">🎉 Milestone Tercapai!</h3>
            <p className="text-sm text-muted-foreground">
              Kamu berhasil streak <span className="font-bold text-foreground">{showMilestone.label}</span>!
            </p>
            <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-xl p-3">
              <p className="text-xs font-bold text-muted-foreground">Gelar Baru</p>
              <p className="text-lg font-extrabold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                {showMilestone.reward}
              </p>
            </div>
            <Button onClick={() => setShowMilestone(null)} className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold">
              Mantap! 🔥
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
