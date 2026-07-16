import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, Clock } from "lucide-react";

interface Props { visitorId: string }

export default function LagaQuestCard({ visitorId }: Props) {
  const { toast } = useToast();
  const [quests, setQuests] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("laga-quest", { body: { action: "status", visitorId } });
    setQuests((data as any)?.quests || []);
    setProgress((data as any)?.progress || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [visitorId]);

  const claim = async (id: string) => {
    setClaiming(id);
    try {
      const { data, error } = await supabase.functions.invoke("laga-quest", { body: { action: "claim", visitorId, questId: id } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🎉 Reward diterima!" });
      load();
    } catch (e) { toast({ title: "Gagal", description: String(e), variant: "destructive" }); }
    finally { setClaiming(null); }
  };

  if (loading) return <Card><CardContent className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></CardContent></Card>;
  if (!quests.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-yellow-500" />
        <h3 className="text-xs font-black uppercase tracking-wider">⚡ QUEST LAGA MINGGU INI</h3>
      </div>
      {quests.map(q => {
        const p = progress.find(x => x.quest_id === q.id);
        const cur = p?.current_value ?? 0;
        const done = p?.is_completed;
        const claimed = p?.is_claimed;
        const pct = Math.min(100, (cur / q.target_value) * 100);
        const activeUntil = new Date(new Date(q.active_date).getTime() + q.duration_hours * 3600000);
        const hoursLeft = Math.max(0, Math.ceil((activeUntil.getTime() - Date.now()) / 3600000));

        return (
          <Card key={q.id} className="border-yellow-500/40 bg-gradient-to-br from-yellow-500/5 to-orange-500/10">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <span className="text-2xl">{q.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{q.title}</div>
                  <div className="text-[10px] text-muted-foreground">{q.description}</div>
                  <div className="text-[10px] text-orange-500 flex items-center gap-1 mt-0.5"><Clock className="w-2.5 h-2.5" /> {hoursLeft}h tersisa</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-[10px] font-bold">{cur}/{q.target_value}</span>
                  </div>
                  <div className="text-[10px] mt-1 text-primary">🎁 Rp{q.reward_saldo_in.toLocaleString("id-ID")} + {q.reward_gems}💎 + {q.reward_coins}🪙</div>
                  {done && !claimed && (
                    <Button size="sm" className="mt-1.5 h-7 w-full text-[10px] bg-gradient-to-r from-yellow-500 to-orange-500" onClick={() => claim(q.id)} disabled={claiming === q.id}>
                      {claiming === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "🎁 Klaim Reward"}
                    </Button>
                  )}
                  {claimed && <div className="text-[10px] text-green-500 mt-1 font-bold">✓ Sudah diklaim</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
