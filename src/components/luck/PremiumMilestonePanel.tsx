import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Gem, Gift } from "lucide-react";

interface Props {
  visitorId: string | null;
  gems: number;
  setGems: (n: number) => void;
  /** Bump this number to trigger a refetch (e.g. after a spin completes) */
  refreshKey?: number;
}

type MilestoneDef = { spins: number; gems: number; credits?: number; coins?: number };

const DEFAULT_MILESTONES: MilestoneDef[] = [
  { spins: 2, gems: 50 },
  { spins: 5, gems: 200, coins: 500 },
  { spins: 10, gems: 500, credits: 2 },
  { spins: 20, gems: 1500, coins: 2000 },
  { spins: 30, gems: 2500, credits: 5, coins: 3000 },
  { spins: 50, gems: 5000, credits: 10, coins: 6000 },
  { spins: 75, gems: 8000, credits: 15, coins: 10000 },
  { spins: 100, gems: 15000, credits: 30, coins: 20000 },
];

export default function PremiumMilestonePanel({ visitorId, gems, setGems, refreshKey = 0 }: Props) {
  const { toast } = useToast();
  const [milestone, setMilestone] = useState<{ spinCount: number; claimed: number[]; cap: number }>({
    spinCount: 0,
    claimed: [],
    cap: 100,
  });
  const [MILESTONES, setMilestones] = useState<MilestoneDef[]>(DEFAULT_MILESTONES);
  const [claimingMs, setClaimingMs] = useState<number | null>(null);

  const loadMilestone = async () => {
    if (!visitorId) return;
    try {
      const { data } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "milestone_status" },
      });
      if (data && !data.error) {
        setMilestone({ spinCount: data.spinCount || 0, claimed: data.claimed || [], cap: data.cap || 100 });
        if (Array.isArray(data.milestones) && data.milestones.length) setMilestones(data.milestones);
      }
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    loadMilestone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId, refreshKey]);

  const claimMilestone = async (spins: number) => {
    if (!visitorId || claimingMs !== null) return;
    setClaimingMs(spins);
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "milestone_claim", milestone: spins },
      });
      if (error || data?.error) {
        toast({
          title: "Gagal klaim",
          description: data?.error || error?.message || "Coba lagi",
          variant: "destructive",
        });
        return;
      }
      if (typeof data.gems === "number") setGems(data.gems);
      setMilestone((m) => ({ ...m, claimed: data.claimed || m.claimed }));
      toast({ title: "🎁 Hadiah Milestone!", description: `+${data.gemReward} 💎 berhasil ditambahkan` });
    } finally {
      setClaimingMs(null);
    }
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-fuchsia-900/40 border-2 border-amber-400/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-amber-300" />
          <span className="text-[11px] font-black tracking-widest bg-gradient-to-r from-amber-200 to-fuchsia-200 bg-clip-text text-transparent">
            HADIAH MILESTONE PREMIUM SPIN
          </span>
        </div>
        <span className="text-[9px] font-black bg-black/40 text-amber-200 px-2 py-0.5 rounded-full">
          {Math.min(milestone.spinCount, milestone.cap)}/{milestone.cap} spin
        </span>
      </div>

      <div className="relative h-2 bg-black/50 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-500 transition-all"
          style={{ width: `${Math.min(100, (milestone.spinCount / milestone.cap) * 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {MILESTONES.map((m) => {
          const reached = milestone.spinCount >= m.spins;
          const claimed = milestone.claimed.includes(m.spins);
          const claimable = reached && !claimed;
          return (
            <button
              key={m.spins}
              disabled={!claimable || claimingMs !== null}
              onClick={() => claimMilestone(m.spins)}
              className={`relative rounded-lg p-2 text-center transition active:scale-95 disabled:active:scale-100 ${
                claimed
                  ? "bg-emerald-700/30 ring-1 ring-emerald-400/40 opacity-70"
                  : claimable
                    ? "bg-gradient-to-br from-amber-500 to-fuchsia-600 ring-2 ring-amber-300 shadow-lg shadow-amber-500/40 animate-pulse"
                    : reached
                      ? "bg-slate-700/60 ring-1 ring-slate-500/30"
                      : "bg-slate-800/60 ring-1 ring-slate-600/30 opacity-60"
              }`}
            >
              <div className="text-[9px] font-black text-white/80 tracking-wider">{m.spins} SPIN</div>
              {(m.credits || m.coins) && (
                <div className="text-[8px] font-bold text-white/50">
                  {m.credits ? `🔑${m.credits}` : ""}{m.credits && m.coins ? " · " : ""}{m.coins ? `🪙${m.coins.toLocaleString("id-ID")}` : ""}
                </div>
              )}
              <div className="flex items-center justify-center gap-0.5 mt-0.5">
                <Gem className="w-3 h-3 text-cyan-200" />
                <span className="text-[11px] font-black text-white">{m.gems}</span>
              </div>
              {claimed ? (
                <div className="text-[8px] font-black text-emerald-300 mt-0.5">✓ DIKLAIM</div>
              ) : claimable ? (
                <div className="text-[8px] font-black text-amber-100 mt-0.5">
                  {claimingMs === m.spins ? "..." : "KLAIM!"}
                </div>
              ) : (
                <div className="text-[8px] font-bold text-white/50 mt-0.5">🔒 belum</div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[9px] text-amber-200/70 text-center leading-snug">
        Hitung semua spin Luck Royale (Normal + Premium + Free). Klaim manual tiap milestone. Reset 00:00 WIB.
      </p>
    </div>
  );
}
