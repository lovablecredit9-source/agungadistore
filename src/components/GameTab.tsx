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
import KuisGame from "@/components/games/KuisGame";
import TekaTekiV2Game from "@/components/games/TekaTekiV2Game";
import PilihanGandaGame from "@/components/games/PilihanGandaGame";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog } from "@/components/games/GameCredits";
import { useGameProfile, GameProfileDialog, updateGameStats } from "@/components/games/GameProfile";

import gameSuitImg from "@/assets/game-suit.png";
import gameTebakKataImg from "@/assets/game-tebak-kata.png";
import gameTebakGambarImg from "@/assets/game-tebak-gambar.png";
import gameTekaTekiImg from "@/assets/game-teka-teki.png";
import gameTebakAngkaImg from "@/assets/game-tebak-angka.png";
import gameTebakBarangImg from "@/assets/game-tebak-barang.png";
import gameUlarTanggaImg from "@/assets/game-ular-tangga.png";
import gameLudoImg from "@/assets/game-ludo.png";
import gameKuisImg from "@/assets/game-kuis.png";
import gameTekaTekiV2Img from "@/assets/game-teka-teki-v2.png";
import gamePilihanGandaImg from "@/assets/game-pilihan-ganda.png";
type GameMode = "menu" | "suit" | "tebak" | "tebak_gambar" | "teka_teki" | "tebak_angka" | "tebak_barang" | "ular_tangga" | "ludo" | "kuis" | "teka_teki_v2" | "pilihan_ganda";

const GAMES: { mode: GameMode; title: string; desc: string; image: string; gradient: string }[] = [
  { mode: "suit", title: "Suit AI", desc: "Batu Gunting Kertas", image: gameSuitImg, gradient: "from-orange-500 to-red-500" },
  { mode: "tebak", title: "Tebak Kata", desc: "Tebak dari petunjuk AI", image: gameTebakKataImg, gradient: "from-blue-500 to-indigo-600" },
  { mode: "tebak_gambar", title: "Tebak Gambar", desc: "Tebak gambar dari AI", image: gameTebakGambarImg, gradient: "from-green-500 to-emerald-600" },
  { mode: "teka_teki", title: "Teka-Teki", desc: "Jawab riddle AI", image: gameTekaTekiImg, gradient: "from-purple-500 to-violet-600" },
  { mode: "tebak_angka", title: "Tebak Angka", desc: "Cari angka rahasia", image: gameTebakAngkaImg, gradient: "from-cyan-500 to-blue-600" },
  { mode: "tebak_barang", title: "Tebak Barang", desc: "Tebak dari deskripsi", image: gameTebakBarangImg, gradient: "from-amber-500 to-orange-600" },
  { mode: "kuis", title: "Kuis Ya/Tidak", desc: "Jawab Ya atau Tidak!", image: gameKuisImg, gradient: "from-green-500 to-teal-600" },
  { mode: "teka_teki_v2", title: "Puzzle Huruf", desc: "Susun huruf jadi kata", image: gameTekaTekiV2Img, gradient: "from-teal-500 to-cyan-600" },
  { mode: "ular_tangga", title: "Ular Tangga", desc: "Papan klasik vs AI", image: gameUlarTanggaImg, gradient: "from-emerald-500 to-green-700" },
  { mode: "ludo", title: "Ludo King", desc: "Siapa duluan finish?", image: gameLudoImg, gradient: "from-pink-500 to-rose-600" },
  { mode: "pilihan_ganda", title: "Pilihan Ganda", desc: "Pilih jawaban benar!", image: gamePilihanGandaImg, gradient: "from-violet-500 to-purple-600" },
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
  kuis: KuisGame,
  teka_teki_v2: TekaTekiV2Game,
  pilihan_ganda: PilihanGandaGame,
};

export default function GameTab() {
  const [mode, setMode] = useState<GameMode>("menu");
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, unlimitedUntil, fetchCredits } = useGameCredits(visitorId);
  const { profile, fetchProfile, visitorId: gameVisitorId } = useGameProfile();

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
              <img src={game.image} alt={game.title} className="w-6 h-6 object-contain" /> {game.title}
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
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => setMode(game.mode)}
                className={`relative w-full overflow-hidden rounded-2xl bg-gradient-to-br ${game.gradient} p-3 text-left shadow-lg hover:shadow-xl transition-all aspect-[4/3] flex flex-col justify-between`}
              >
                <div className="flex-1 flex items-center justify-center">
                  <img
                    src={game.image}
                    alt={game.title}
                    loading="lazy"
                    className="w-16 h-16 object-contain drop-shadow-lg"
                  />
                </div>
                <div className="mt-1">
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
