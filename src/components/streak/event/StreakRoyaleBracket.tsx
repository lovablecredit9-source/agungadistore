import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { maskUsername } from "@/lib/mask-username";

interface Player { visitor_id: string; current_streak: number; display_name?: string }

export default function StreakRoyaleBracket({ visitorId }: { visitorId: string }) {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: streaks } = await supabase
          .from("daily_streaks")
          .select("visitor_id, current_streak")
          .order("current_streak", { ascending: false })
          .limit(8);
        const rows = (streaks ?? []) as Player[];
        if (rows.length === 0) { if (mounted) setPlayers([]); return; }
        const ids = rows.map(r => r.visitor_id);
        const { data: profiles } = await supabase
          .from("game_profiles")
          .select("visitor_id, display_name")
          .in("visitor_id", ids);
        const nameMap = new Map<string, string>();
        (profiles ?? []).forEach((p: any) => {
          if (p?.visitor_id && p?.display_name) nameMap.set(p.visitor_id, p.display_name);
        });
        const merged = rows.map(r => ({ ...r, display_name: nameMap.get(r.visitor_id) || "" }));
        if (mounted) setPlayers(merged);
      } catch { /* noop */ }
    })();
    return () => { mounted = false; };
  }, []);

  // Generate bracket pairs
  const pairs: [Player | null, Player | null][] = [];
  for (let i = 0; i < 4; i++) {
    pairs.push([players[i] || null, players[7 - i] || null]);
  }

  function Cell({ p }: { p: Player | null }) {
    const isMe = p?.visitor_id === visitorId;
    return (
      <div className={`px-2 py-1 rounded-md border text-[9px] font-black flex items-center justify-between gap-1 ${
        !p ? "bg-black/30 border-white/10 text-white/30" :
        isMe ? "bg-pink-500/30 border-pink-400/60 text-pink-100" : "bg-black/40 border-purple-400/30 text-white"
      }`}>
        <span className="truncate">{p ? (isMe ? "👉 Kamu" : maskUsername(p.display_name)) : "TBD"}</span>
        {p && <span className="text-orange-300 tabular-nums">🔥{p.current_streak}</span>}
      </div>
    );
  }

  function winner(a: Player | null, b: Player | null): Player | null {
    if (!a || !b) return a || b;
    return a.current_streak >= b.current_streak ? a : b;
  }

  const semis: [Player | null, Player | null][] = [
    [winner(pairs[0][0], pairs[0][1]), winner(pairs[1][0], pairs[1][1])],
    [winner(pairs[2][0], pairs[2][1]), winner(pairs[3][0], pairs[3][1])],
  ];
  const finals: [Player | null, Player | null] = [winner(semis[0][0], semis[0][1]), winner(semis[1][0], semis[1][1])];
  const champion = winner(finals[0], finals[1]);

  return (
    <div className="cyber-card rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Swords className="w-4 h-4 text-pink-300" strokeWidth={2.5} />
        <span className="text-[11px] font-black tracking-widest uppercase neon-text-pink">Streak Royale 8</span>
        <span className="ml-auto text-[9px] font-bold text-white/60">Top-8 minggu ini</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 items-center">
        <div className="space-y-2">
          {pairs.map((pair, i) => (
            <div key={i} className="space-y-0.5">
              <Cell p={pair[0]} />
              <Cell p={pair[1]} />
            </div>
          ))}
        </div>
        <div className="space-y-6 pt-2">
          {semis.map((pair, i) => (
            <div key={i} className="space-y-0.5">
              <Cell p={pair[0]} />
              <Cell p={pair[1]} />
            </div>
          ))}
        </div>
        <div className="space-y-1 pt-10">
          <Cell p={finals[0]} />
          <Cell p={finals[1]} />
        </div>
        <motion.div
          animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
          className="rounded-lg p-1.5 bg-gradient-to-br from-yellow-400 to-orange-500 border-2 border-yellow-200 text-center"
        >
          <Crown className="w-4 h-4 mx-auto text-white drop-shadow" strokeWidth={2.5} />
          <div className="text-[8px] font-black text-white mt-0.5 truncate">{champion ? maskUsername(champion.display_name) : "?"}</div>
          <div className="text-[8px] font-black text-yellow-100 mt-0.5">CHAMPION</div>
        </motion.div>
      </div>
    </div>
  );
}
