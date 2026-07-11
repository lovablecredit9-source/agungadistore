import { useEffect, useState } from "react";
import { Star, Zap, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadGameData, getCurrentLevelThreshold, getNextLevelThreshold,
  getPointBoosterUntil, getActiveBoosterSummary,
} from "./gameStore";
import BuyBoosterDialog from "./BuyBoosterDialog";
import { useGameCredits } from "./GameCredits";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** Optional: jika game punya jawaban, sediakan callback untuk reveal */
  onRevealAnswer?: () => void;
  /** Disable hint (mis. game belum jalan / tidak ada jawaban aktif) */
  hintDisabled?: boolean;
  visitorId?: string | null;
}

function fmtShort(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}j${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export default function GameLevelMiniBar({ onRevealAnswer, hintDisabled, visitorId: visitorIdProp }: Props) {
  const visitorId = visitorIdProp ?? (typeof window !== "undefined"
    ? (localStorage.getItem("balance_visitor_id") || localStorage.getItem("visitor_id"))
    : null);
  const { credits, isUnlimited, useCredit } = useGameCredits(visitorId);
  const { toast } = useToast();
  const [data, setData] = useState(loadGameData);
  const [boosterUntil, setBoosterUntil] = useState(getPointBoosterUntil());
  const [boosterSummary, setBoosterSummary] = useState(getActiveBoosterSummary());
  const boosterTotal = boosterSummary.total;
  const [now, setNow] = useState(Date.now());
  const [usingHint, setUsingHint] = useState(false);

  useEffect(() => {
    const i = setInterval(() => {
      setData(loadGameData());
      setBoosterUntil(getPointBoosterUntil());
      setBoosterSummary(getActiveBoosterSummary());
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(i);
  }, []);

  const cur = getCurrentLevelThreshold(data.level);
  const nxt = getNextLevelThreshold(data.level);
  const pct = Math.min(100, ((data.totalPoints - cur) / Math.max(1, nxt - cur)) * 100);
  const boosterActive = boosterUntil > now;

  const handleHint = async () => {
    if (!onRevealAnswer || hintDisabled) return;
    if (!isUnlimited && credits <= 0) {
      toast({ title: "Kredit habis", description: "Beli kredit jawaban dulu", variant: "destructive" });
      return;
    }
    setUsingHint(true);
    const ok = isUnlimited ? true : await useCredit();
    setUsingHint(false);
    if (!ok) {
      toast({ title: "Gagal pakai kredit", variant: "destructive" });
      return;
    }
    onRevealAnswer();
    toast({ title: "👀 Jawaban dibuka!", description: isUnlimited ? "Akses unlimited aktif" : "−1 kredit" });
  };

  return (
    <div className="rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-purple-500/20 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs font-extrabold">
          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
          Lv.{data.level}
        </div>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-pink-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] tabular-nums font-bold text-muted-foreground">
          {data.totalPoints} pts
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {boosterActive ? (
          <div className="flex-1 flex items-center gap-1 bg-yellow-400/90 text-yellow-950 rounded-md px-2 py-1">
            <Zap className="w-3 h-3 fill-current" />
            <span className="text-[10px] font-black">x{boosterTotal} AKTIF</span>
            <span className="ml-auto text-[10px] font-bold tabular-nums">{fmtShort(boosterUntil - now)}</span>
          </div>
        ) : (
          <BuyBoosterDialog
            visitorId={visitorId}
            trigger={
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] font-bold gap-1">
                <Zap className="w-3 h-3 text-yellow-500" /> Beli Booster
              </Button>
            }
          />
        )}

        {onRevealAnswer && (
          <Button
            size="sm"
            variant="outline"
            disabled={hintDisabled || usingHint}
            onClick={handleHint}
            className="h-7 text-[10px] font-bold gap-1"
          >
            {usingHint ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3 text-blue-500" />}
            Lihat Jawaban {!isUnlimited && `(${Math.max(0, credits)})`}
          </Button>
        )}
      </div>
    </div>
  );
}
