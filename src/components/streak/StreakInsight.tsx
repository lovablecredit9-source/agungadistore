import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Share2, BarChart3, Calendar, Clock, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getStreakTitle } from "./StreakTitleBadge";

interface Props {
  visitorId: string;
  currentStreak: number;
  longestStreak: number;
  totalClaims: number;
}

interface Insight {
  totalDays: number;
  favoriteHour: number;
  favoriteDayName: string;
  last30Days: number;
  consistency: number; // 0-100
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function StreakInsight({ visitorId, currentStreak, longestStreak, totalClaims }: Props) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const tier = getStreakTitle(longestStreak);

  useEffect(() => {
    if (!visitorId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: logs } = await supabase
          .from("streak_rewards_log")
          .select("claim_date, created_at")
          .eq("visitor_id", visitorId)
          .order("created_at", { ascending: false })
          .limit(200);

        const list = logs || [];
        const totalDays = list.length;

        // Favorite hour (WIB)
        const hourCount: Record<number, number> = {};
        const dayCount: Record<number, number> = {};
        list.forEach((l: any) => {
          const wib = new Date(new Date(l.created_at).getTime() + 7 * 3600 * 1000);
          const h = wib.getUTCHours();
          const d = wib.getUTCDay();
          hourCount[h] = (hourCount[h] || 0) + 1;
          dayCount[d] = (dayCount[d] || 0) + 1;
        });
        const favoriteHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0];
        const favoriteDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0];

        // Last 30 days
        const thirtyAgo = Date.now() - 30 * 86400000;
        const last30Days = list.filter((l: any) => new Date(l.created_at).getTime() > thirtyAgo).length;
        const consistency = Math.round((last30Days / 30) * 100);

        setInsight({
          totalDays,
          favoriteHour: favoriteHour ? Number(favoriteHour) : 0,
          favoriteDayName: favoriteDay ? DAY_NAMES[Number(favoriteDay)] : "-",
          last30Days,
          consistency,
        });
      } catch {}
      setLoading(false);
    })();
  }, [visitorId]);

  async function shareStreak() {
    const text =
      `🔥 Streak ${currentStreak} hari di Agung Adi Store!\n` +
      `🏆 Title: ${tier.title}\n` +
      `📅 Total ${totalClaims} klaim\n` +
      `Streak terpanjang: ${longestStreak} hari\n\n` +
      `Yuk ikut streak harian: https://agungadistore.lovable.app`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Streak Saya", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Disalin!", description: "Tempel ke teman kamu untuk pamer streak 🔥" });
      }
    } catch {}
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex items-center justify-center min-h-[140px]">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!insight) return null;

  const stats = [
    { Icon: Calendar, label: "Total Hari Aktif", value: insight.totalDays, color: "from-blue-500 to-cyan-500" },
    { Icon: Clock, label: "Jam Favorit", value: `${String(insight.favoriteHour).padStart(2, "0")}:00`, color: "from-purple-500 to-pink-500" },
    { Icon: TrendingUp, label: "Hari Favorit", value: insight.favoriteDayName, color: "from-orange-500 to-red-500" },
    { Icon: BarChart3, label: "Konsistensi 30hr", value: `${insight.consistency}%`, color: "from-green-500 to-emerald-500" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/50 bg-gradient-to-br from-card to-card/50 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-sm">Statistik Streak Kamu</h3>
        </div>
        <Button size="sm" variant="outline" onClick={shareStreak} className="h-7 px-2 text-[11px]">
          <Share2 className="w-3 h-3 mr-1" />
          Pamer
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg bg-muted/30 border border-border/30 p-2.5"
          >
            <div className={`inline-flex p-1 rounded-md bg-gradient-to-br ${s.color} mb-1`}>
              <s.Icon className="w-3 h-3 text-white" />
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
            <p className="text-sm font-bold mt-0.5">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Consistency bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Konsistensi 30 hari terakhir</span>
          <span className="font-bold">{insight.last30Days}/30 hari</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${insight.consistency}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full bg-gradient-to-r ${
              insight.consistency >= 80
                ? "from-green-500 to-emerald-500"
                : insight.consistency >= 50
                ? "from-yellow-500 to-orange-500"
                : "from-red-500 to-pink-500"
            }`}
          />
        </div>
      </div>
    </motion.div>
  );
}
