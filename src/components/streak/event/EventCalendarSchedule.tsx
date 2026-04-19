import { useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar, Sparkles, Flame, Coins, Gift, Trophy, Zap } from "lucide-react";

const SCHEDULE = [
  { day: "Senin", name: "Mega Monday", icon: Flame, color: "from-orange-500 to-red-500", desc: "x2 streak coin sepanjang hari" },
  { day: "Selasa", name: "Treasure Tuesday", icon: Gift, color: "from-amber-500 to-yellow-500", desc: "Treasure Hunt bonus tile" },
  { day: "Rabu", name: "Wild Wednesday", icon: Sparkles, color: "from-pink-500 to-fuchsia-500", desc: "Spin Wheel jackpot ganda" },
  { day: "Kamis", name: "Thunder Thursday", icon: Zap, color: "from-cyan-400 to-blue-500", desc: "Power Surge x3 pukul 19-21" },
  { day: "Jumat", name: "Fortune Friday", icon: Coins, color: "from-yellow-400 to-orange-400", desc: "Mystery Box rarity boost" },
  { day: "Sabtu", name: "Showdown Saturday", icon: Trophy, color: "from-purple-500 to-indigo-500", desc: "Battle Arena reward x2" },
  { day: "Minggu", name: "Super Sunday", icon: Sparkles, color: "from-emerald-400 to-cyan-400", desc: "Coin Rain hadiah maksimum" },
];

export default function EventCalendarSchedule() {
  const todayIdx = useMemo(() => {
    const d = new Date(Date.now() + 7 * 3600_000).getUTCDay();
    return d === 0 ? 6 : d - 1;
  }, []);

  return (
    <div className="cyber-card rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Calendar className="w-4 h-4 text-cyan-300" strokeWidth={2.5} />
        <span className="text-[11px] font-black tracking-widest uppercase neon-text-cyan">Jadwal Event Mingguan</span>
      </div>
      <div className="space-y-1.5">
        {SCHEDULE.map((e, i) => {
          const Icon = e.icon;
          const isToday = i === todayIdx;
          return (
            <motion.div
              key={e.day}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className={`relative rounded-lg p-2 border ${isToday ? "border-yellow-400/60 bg-gradient-to-r " + e.color + " bg-opacity-20" : "border-white/10 bg-black/30"}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center bg-gradient-to-br ${e.color} shrink-0`}>
                  <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-black ${isToday ? "text-yellow-200" : "text-white"}`}>{e.day}</span>
                    {isToday && <span className="text-[8px] font-black px-1 py-0.5 rounded-sm bg-yellow-400 text-black">HARI INI</span>}
                  </div>
                  <div className="text-[10px] font-black text-white/90 truncate">{e.name}</div>
                  <div className="text-[9px] text-white/60 truncate">{e.desc}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
