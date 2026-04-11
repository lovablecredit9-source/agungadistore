import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Gamepad2, ArrowLeft } from "lucide-react";
import SuitGame from "@/components/games/SuitGame";
import TebakKataGame from "@/components/games/TebakKataGame";
import TebakGambarGame from "@/components/games/TebakGambarGame";
import TekaTekiGame from "@/components/games/TekaTekiGame";
import TebakAngkaGame from "@/components/games/TebakAngkaGame";
import TebakBarangGame from "@/components/games/TebakBarangGame";
import UlarTanggaGame from "@/components/games/UlarTanggaGame";
import LudoGame from "@/components/games/LudoGame";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog } from "@/components/games/GameCredits";

type GameMode = "menu" | "suit" | "tebak" | "tebak_gambar" | "teka_teki" | "tebak_angka" | "tebak_barang" | "ular_tangga" | "ludo";

const GAMES: { mode: GameMode; title: string; desc: string; emoji: string; gradient: string; bgEmoji: string }[] = [
  { mode: "suit", title: "Suit AI", desc: "Batu, Gunting, Kertas lawan AI!", emoji: "✊", gradient: "from-orange-500 to-red-500", bgEmoji: "✌️" },
  { mode: "tebak", title: "Tebak Kata", desc: "AI beri petunjuk, kamu tebak!", emoji: "🔤", gradient: "from-blue-500 to-indigo-600", bgEmoji: "💬" },
  { mode: "tebak_gambar", title: "Tebak Gambar", desc: "AI buat gambar, kamu tebak!", emoji: "🖼️", gradient: "from-green-500 to-emerald-600", bgEmoji: "🎨" },
  { mode: "teka_teki", title: "Teka-Teki", desc: "AI kasih riddle, jawab!", emoji: "🧩", gradient: "from-purple-500 to-violet-600", bgEmoji: "🤔" },
  { mode: "tebak_angka", title: "Tebak Angka", desc: "Tebak angka rahasia AI!", emoji: "🔢", gradient: "from-cyan-500 to-blue-600", bgEmoji: "🎯" },
  { mode: "tebak_barang", title: "Tebak Barang", desc: "AI deskripsikan, kamu tebak!", emoji: "📦", gradient: "from-amber-500 to-orange-600", bgEmoji: "🎁" },
  { mode: "ular_tangga", title: "Ular Tangga", desc: "Lawan AI di papan klasik!", emoji: "🐍", gradient: "from-emerald-500 to-green-700", bgEmoji: "🪜" },
  { mode: "ludo", title: "Ludo King", desc: "Siapa sampai duluan?", emoji: "♟️", gradient: "from-pink-500 to-rose-600", bgEmoji: "👑" },
];

const GAME_COMPONENTS: Record<string, React.ComponentType> = {
  suit: SuitGame,
  tebak: TebakKataGame,
  tebak_gambar: TebakGambarGame,
  teka_teki: TekaTekiGame,
  tebak_angka: TebakAngkaGame,
  tebak_barang: TebakBarangGame,
  ular_tangga: UlarTanggaGame,
  ludo: LudoGame,
};

export default function GameTab() {
  const [mode, setMode] = useState<GameMode>("menu");
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, unlimitedUntil, fetchCredits } = useGameCredits(visitorId);

  if (mode !== "menu") {
    const game = GAMES.find(g => g.mode === mode);
    const GameComponent = GAME_COMPONENTS[mode];
    if (!game || !GameComponent) return null;

    return (
      <div className="space-y-4 p-4 pb-24">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode("menu")} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Kembali
            </Button>
            <h2 className="font-extrabold text-lg flex items-center gap-2">
              <span className="text-xl">{game.emoji}</span> {game.title}
            </h2>
          </div>
          <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} unlimitedUntil={unlimitedUntil} />
        </div>
        <GameComponent />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-xl flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-primary" /> Game
          </h2>
          <div className="flex items-center gap-2">
            <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} unlimitedUntil={unlimitedUntil} />
            <BuyCreditsDialog visitorId={visitorId} onPurchased={fetchCredits} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((game, i) => (
            <motion.div
              key={game.mode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => setMode(game.mode)}
                className={`relative w-full overflow-hidden rounded-2xl bg-gradient-to-br ${game.gradient} p-4 text-left shadow-lg hover:shadow-xl transition-shadow aspect-[4/3] flex flex-col justify-between`}
              >
                {/* Background decorative emoji */}
                <span className="absolute -right-2 -top-2 text-5xl opacity-20 rotate-12 select-none pointer-events-none">
                  {game.bgEmoji}
                </span>
                <span className="absolute right-2 bottom-8 text-3xl opacity-15 -rotate-12 select-none pointer-events-none">
                  {game.emoji}
                </span>

                {/* Main emoji */}
                <div className="text-4xl mb-1 drop-shadow-lg">{game.emoji}</div>

                {/* Text */}
                <div>
                  <h3 className="font-extrabold text-sm text-white leading-tight drop-shadow">{game.title}</h3>
                  <p className="text-[10px] text-white/80 leading-tight mt-0.5">{game.desc}</p>
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
