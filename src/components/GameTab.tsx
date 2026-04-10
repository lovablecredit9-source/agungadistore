import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Gamepad2, ArrowLeft, Swords, Brain, ImageIcon } from "lucide-react";
import SuitGame from "@/components/games/SuitGame";
import TebakKataGame from "@/components/games/TebakKataGame";
import TebakGambarGame from "@/components/games/TebakGambarGame";

type GameMode = "menu" | "suit" | "tebak" | "tebak_gambar";

export default function GameTab() {
  const [mode, setMode] = useState<GameMode>("menu");

  if (mode === "suit") {
    return (
      <div className="space-y-4 p-4 pb-24">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("menu")} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Button>
          <h2 className="font-extrabold text-lg flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" /> Suit AI
          </h2>
        </div>
        <SuitGame />
      </div>
    );
  }

  if (mode === "tebak") {
    return (
      <div className="space-y-4 p-4 pb-24">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("menu")} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Button>
          <h2 className="font-extrabold text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" /> Tebak Kata AI
          </h2>
        </div>
        <TebakKataGame />
      </div>
    );
  }

  if (mode === "tebak_gambar") {
    return (
      <div className="space-y-4 p-4 pb-24">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("menu")} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Button>
          <h2 className="font-extrabold text-lg flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" /> Tebak Gambar AI
          </h2>
        </div>
        <TebakGambarGame />
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
          <motion.div whileTap={{ scale: 0.97 }}>
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode("suit")}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                  <Swords className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-base">Suit AI</h3>
                  <p className="text-xs text-muted-foreground">Batu, Gunting, Kertas melawan AI!</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileTap={{ scale: 0.97 }}>
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode("tebak")}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-base">Tebak Kata AI</h3>
                  <p className="text-xs text-muted-foreground">AI beri petunjuk, kamu tebak kata!</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileTap={{ scale: 0.97 }}>
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode("tebak_gambar")}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <ImageIcon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-base">Tebak Gambar AI</h3>
                  <p className="text-xs text-muted-foreground">AI buat gambar, kamu tebak objeknya!</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>
      </motion.div>
    </div>
  );
}
