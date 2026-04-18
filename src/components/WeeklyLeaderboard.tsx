import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, Medal, Loader2, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WeeklyLeaderboard() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.functions.invoke("weekly-leaderboard", { body: { action: "current" } })
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, []);

  const claimLastWeek = async () => {
    if (!visitorId) return toast({ title: "Login dulu", variant: "destructive" });
    setClaiming(true);
    const { data: r, error } = await supabase.functions.invoke("weekly-leaderboard", {
      body: { action: "claim_last_week", visitorId },
    });
    setClaiming(false);
    if (error || r?.error) return toast({ title: "Tidak bisa klaim", description: r?.error || "Coba lagi", variant: "destructive" });
    toast({ title: "🏆 Hadiah diklaim!", description: `Peringkat #${r.rank}: ${r.reward.reward_label}` });
  };

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <Card className="p-3 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-extrabold text-sm">Leaderboard Mingguan</h3>
        </div>
        <Button size="sm" variant="outline" onClick={claimLastWeek} disabled={claiming} className="h-7 text-xs">
          {claiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Gift className="w-3 h-3 mr-1" /> Klaim</>}
        </Button>
      </div>
      <div className="space-y-1.5">
        {(data?.leaderboard || []).slice(0, 5).map((p: any) => (
          <div key={p.visitor_id} className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${p.rank === 1 ? "bg-yellow-400" : p.rank === 2 ? "bg-slate-300" : p.rank === 3 ? "bg-amber-600" : "bg-muted"}`}>
              {p.rank <= 3 ? <Crown className="w-3 h-3" /> : p.rank}
            </div>
            <div className="flex-1 truncate text-xs font-bold">{p.display_name}</div>
            <div className="text-xs font-extrabold text-primary">{p.points} pts</div>
          </div>
        ))}
        {(!data?.leaderboard || data.leaderboard.length === 0) && (
          <div className="text-center text-xs text-muted-foreground py-3">Belum ada pemain minggu ini</div>
        )}
      </div>
      {data?.rewards?.length > 0 && (
        <div className="mt-3 text-[10px] text-muted-foreground border-t border-border pt-2">
          🎁 Hadiah: {data.rewards.map((r: any) => `#${r.rank_position} ${r.reward_label}`).join(" · ")}
        </div>
      )}
    </Card>
  );
}
