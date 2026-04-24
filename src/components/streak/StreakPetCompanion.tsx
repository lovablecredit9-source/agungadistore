import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";

interface Props {
  visitorId: string;
  currentStreak: number;
}

const PET_STAGES = [
  { min: 0, emoji: "🥚", name: "Telur", color: "from-slate-400 to-slate-600" },
  { min: 3, emoji: "🐣", name: "Anak Naga", color: "from-yellow-400 to-orange-500" },
  { min: 7, emoji: "🦎", name: "Naga Muda", color: "from-emerald-400 to-cyan-500" },
  { min: 14, emoji: "🐉", name: "Naga Dewasa", color: "from-purple-500 to-pink-600" },
  { min: 30, emoji: "🔥", name: "Naga Api Legend", color: "from-red-500 via-orange-500 to-yellow-400" },
  { min: 60, emoji: "👑", name: "Naga Kosmik", color: "from-fuchsia-500 via-purple-600 to-cyan-500" },
];

export default function StreakPetCompanion({ visitorId, currentStreak }: Props) {
  const key = `streak_pet_${visitorId}`;
  const [petName, setPetName] = useState("Buddy");
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setPetName(JSON.parse(raw).name || "Buddy");
    } catch { /* noop */ }
  }, [key]);

  const stage = [...PET_STAGES].reverse().find(s => currentStreak >= s.min) || PET_STAGES[0];
  const nextStage = PET_STAGES.find(s => s.min > currentStreak);
  const progress = nextStage ? Math.min(100, (currentStreak / nextStage.min) * 100) : 100;

  function saveName() {
    const name = tempName.trim().slice(0, 12) || "Buddy";
    setPetName(name); setEditing(false);
    try { localStorage.setItem(key, JSON.stringify({ name })); } catch { /* noop */ }
  }

  return (
    <div className={`rounded-2xl p-3 relative overflow-hidden bg-gradient-to-br ${stage.color}`}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative flex items-center gap-3">
        <motion.div
          animate={{ y: [0, -6, 0], rotate: [0, -5, 5, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="text-5xl drop-shadow-2xl"
        >
          {stage.emoji}
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black tracking-widest text-white/80 uppercase flex items-center gap-1">
            <Heart className="w-3 h-3 fill-pink-400 text-pink-400" /> Pet Companion
          </div>
          {editing ? (
            <div className="flex gap-1 mt-0.5">
              <input
                autoFocus value={tempName} onChange={e => setTempName(e.target.value)}
                onBlur={saveName} onKeyDown={e => e.key === "Enter" && saveName()}
                className="flex-1 bg-black/40 text-white text-sm font-extrabold px-2 py-0.5 rounded border border-white/30 outline-none"
                placeholder="Nama pet..."
              />
            </div>
          ) : (
            <button
              onClick={() => { setTempName(petName); setEditing(true); }}
              className="font-extrabold text-white text-base drop-shadow text-left truncate w-full"
            >
              {petName} <span className="text-[11px] font-bold opacity-80">- {stage.name}</span>
            </button>
          )}
          {nextStage && (
            <>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mt-1">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-white/80" />
              </div>
              <div className="text-[9px] font-bold text-white/80 mt-0.5 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> {currentStreak}/{nextStage.min} hari → {nextStage.name}
              </div>
            </>
          )}
          {!nextStage && (
            <div className="text-[10px] font-black text-yellow-200 mt-0.5">✨ EVOLUSI MAKSIMUM!</div>
          )}
        </div>
      </div>
    </div>
  );
}
