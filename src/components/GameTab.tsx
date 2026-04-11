import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Gamepad2, ArrowLeft, Swords, Brain, ImageIcon, HelpCircle, Hash, Package, Grid3X3, Crown } from "lucide-react";
import SuitGame from "@/components/games/SuitGame";
import TebakKataGame from "@/components/games/TebakKataGame";
import TebakGambarGame from "@/components/games/TebakGambarGame";
import TekaTekiGame from "@/components/games/TekaTekiGame";
import TebakAngkaGame from "@/components/games/TebakAngkaGame";
import TebakBarangGame from "@/components/games/TebakBarangGame";
import UlarTanggaGame from "@/components/games/UlarTanggaGame";
import LudoGame from "@/components/games/LudoGame";

type GameMode = "menu" | "suit" | "tebak" | "tebak_gambar" | "teka_teki" | "tebak_angka" | "tebak_barang" | "ular_tangga" | "ludo";

const GAMES: { mode: GameMode; title: string; desc: string; icon: any; gradient: string }[] = [
  { mode: "suit", title: "Suit AI", desc: "Batu, Gunting, Kertas melawan AI!", icon: Swords, gradient: "from-orange-500 to-red-600" },
  { mode: "tebak", title: "Tebak Kata AI", desc: "AI beri petunjuk, kamu tebak kata!", icon: Brain, gradient: "from-blue-500 to-purple-600" },
  { mode: "tebak_gambar", title: "Tebak Gambar AI", desc: "AI buat gambar, kamu tebak objeknya!", icon: ImageIcon, gradient: "from-green-500 to-teal-600" },
  { mode: "teka_teki", title: "Teka-Teki Logika AI", desc: "AI kasih riddle, kamu jawab!", icon: HelpCircle, gradient: "from-indigo-500 to-purple-600" },
  { mode: "tebak_angka", title: "Tebak Angka AI", desc: "AI pilih angka rahasia, tebak dengan petunjuk!", icon: Hash, gradient: "from-cyan-500 to-blue-600" },
  { mode: "tebak_barang", title: "Tebak Barang AI", desc: "AI deskripsikan benda, kamu tebak!", icon: Package, gradient: "from-amber-500 to-orange-600" },
  { mode: "ular_tangga", title: "Ular Tangga", desc: "Lawan AI di papan ular tangga klasik!", icon: Grid3X3, gradient: "from-emerald-500 to-green-700" },
  { mode: "ludo", title: "Ludo King", desc: "Main Ludo lawan AI, siapa sampai duluan!", icon: Crown, gradient: "from-pink-500 to-rose-600" },
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

  if (mode !== "menu") {
    const game = GAMES.find(g => g.mode === mode);
    const GameComponent = GAME_COMPONENTS[mode];
    if (!game || !GameComponent) return null;
    const Icon = game.icon;

    return (
      <div className="space-y-4 p-4 pb-24">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("menu")} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Button>
          <h2 className="font-extrabold text-lg flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" /> {game.title}
          </h2>
        </div>
        <GameComponent />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-extrabold text-xl flex items-center gap-2 mb-4">
          <Gamepad2 className="w-6 h-6 text-primary" /> Game
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {GAMES.map(game => {
            const Icon = game.icon;
            return (
              <motion.div key={game.mode} whileTap={{ scale: 0.97 }}>
                <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode(game.mode)}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${game.gradient} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-extrabold text-base">{game.title}</h3>
                      <p className="text-xs text-muted-foreground">{game.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
