import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Gamepad2, ArrowLeft } from "lucide-react";
import { BanBanner, BanLock } from "@/components/BanBanner";
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
import ScratchCardGame from "@/components/games/ScratchCardGame";
import SlotMachineGame from "@/components/games/SlotMachineGame";
import Match3Game from "@/components/games/Match3Game";
import LuckyDrawGame from "@/components/games/LuckyDrawGame";
import MineSweeperGame from "@/components/games/MineSweeperGame";
import TebakLaguGame from "@/components/games/TebakLaguGame";
import WeeklyLeaderboard from "@/components/WeeklyLeaderboard";
import FlashSaleBanner from "@/components/FlashSaleBanner";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog } from "@/components/games/GameCredits";
import { useGameBalance, GameBalanceBadge } from "@/components/games/GameBalance";
import { useGameProfile, GameProfileDialog, updateGameStats } from "@/components/games/GameProfile";
import NeonGameExtras from "@/components/games/NeonGameExtras";
import GamePvPBattle from "@/components/games/GamePvPBattle";
import GameQuestChain from "@/components/games/GameQuestChain";
import GameClanSystem from "@/components/games/GameClanSystem";
import GameSeasonPass from "@/components/games/GameSeasonPass";
import { Zap } from "lucide-react";

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
import gameScratchImg from "@/assets/game-scratch.png";
import gameSlotImg from "@/assets/game-slot.png";
import gameMatch3Img from "@/assets/game-match3.png";
import gameLuckyDrawImg from "@/assets/game-lucky-draw.png";
import gameMineImg from "@/assets/game-mine.png";
import gameTebakLaguImg from "@/assets/game-tebak-lagu.png";
type GameMode = "menu" | "suit" | "tebak" | "tebak_gambar" | "teka_teki" | "tebak_angka" | "tebak_barang" | "ular_tangga" | "ludo" | "kuis" | "teka_teki_v2" | "pilihan_ganda" | "scratch" | "slot" | "match3" | "lucky_draw" | "mine" | "tebak_lagu";

const GAMES: { mode: GameMode; title: string; desc: string; image: string; gradient: string }[] = [
  { mode: "scratch", title: "Scratch Card", desc: "Gosok hadiah harian", image: gameScratchImg, gradient: "from-violet-500 to-fuchsia-600" },
  { mode: "slot", title: "Slot 3-Reel", desc: "Spin & menang JACKPOT", image: gameSlotImg, gradient: "from-red-500 to-rose-600" },
  { mode: "mine", title: "Mine Sweeper", desc: "Cari bom, cash out!", image: gameMineImg, gradient: "from-cyan-500 to-blue-700" },
  { mode: "match3", title: "Match-3", desc: "Cocokkan permata", image: gameMatch3Img, gradient: "from-cyan-500 to-emerald-600" },
  { mode: "lucky_draw", title: "Lucky Draw", desc: "Undi hadiah misterius", image: gameLuckyDrawImg, gradient: "from-amber-500 to-rose-600" },
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
  { mode: "tebak_lagu", title: "Tebak Lagu", desc: "Tebak dari potongan lirik 🎵", image: gameTebakLaguImg, gradient: "from-pink-500 to-purple-600" },
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
  scratch: ScratchCardGame,
  slot: SlotMachineGame,
  match3: Match3Game,
  lucky_draw: LuckyDrawGame,
  mine: MineSweeperGame,
  tebak_lagu: TebakLaguGame,
};

export default function GameTab() {
  const [mode, setMode] = useState<GameMode>("menu");
  const [dailyGame, setDailyGame] = useState<string>("");
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, unlimitedUntil, fetchCredits } = useGameCredits(visitorId);
  const { amount: gameBalance } = useGameBalance(visitorId);
  const { profile, fetchProfile, visitorId: gameVisitorId } = useGameProfile();

  // Fetch today's daily challenge game (server-side deterministic)
  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.functions.invoke("game-profile", { body: { action: "get_daily_challenge" } })
        .then(({ data }) => { if (data?.game_type) setDailyGame(data.game_type); });
    });
  }, []);

  if (mode !== "menu") {
    const game = GAMES.find(g => g.mode === mode);
    const GameComponent = GAME_COMPONENTS[mode];
    if (!game || !GameComponent) return null;

    return (
      <div className="space-y-4 p-4 pb-24">
        <BanBanner />
        <BanLock fallbackLabel="game">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("menu")} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Button>
          <h2 className="font-extrabold text-lg flex items-center gap-2">
            <img src={game.image} alt={game.title} className="w-6 h-6 object-contain" /> {game.title}
          </h2>
        </div>
        <GameComponent />
        </BanLock>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <BanBanner />
      <BanLock fallbackLabel="game">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-extrabold text-xl flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-primary" /> Game
          </h2>
          <GameProfileDialog profile={profile} onUpdate={fetchProfile} visitorId={gameVisitorId} />
        </div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} unlimitedUntil={unlimitedUntil} />
          <GameBalanceBadge amount={gameBalance} />
          <BuyCreditsDialog visitorId={visitorId} onPurchased={fetchCredits} />
        </div>
        <p className="text-[10px] text-muted-foreground mb-3 px-1">
          💡 <strong>Saldo IN</strong> hanya untuk Game/Streak/Storage, bukan produk.
        </p>

        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 p-4 mb-4 shadow-lg"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.3),transparent_70%)]" />
          </div>
          <div className="relative z-10">
            <h3 className="font-extrabold text-white text-lg leading-tight">🎮 Game AI Seru!</h3>
            <p className="text-white/80 text-xs mt-1">{GAMES.length} game seru siap dimainkan. Tantang AI, kumpulkan poin, dan naik leaderboard!</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["Suit AI", "Tebak Kata", "Puzzle Huruf", "Kuis", "Ular Tangga", "Ludo"].map(name => (
                <span key={name} className="text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5">{name}</span>
              ))}
              <span className="text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5">+{GAMES.length - 6} lainnya</span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((game, i) => {
            const isDaily = game.mode === dailyGame;
            return (
              <motion.div
                key={game.mode}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex"
              >
                <button
                  onClick={() => setMode(game.mode)}
                  className={`relative w-full overflow-hidden rounded-2xl bg-gradient-to-br ${game.gradient} p-3 text-left shadow-lg hover:shadow-xl transition-all flex flex-col h-[140px]`}
                >
                  {isDaily && (
                    <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 bg-yellow-400 text-yellow-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">
                      <Zap className="w-2.5 h-2.5 fill-current" /> 2X
                    </div>
                  )}
                  <div className="flex items-center justify-center flex-1">
                    <img
                      src={game.image}
                      alt={game.title}
                      loading="lazy"
                      className="w-14 h-14 object-contain drop-shadow-lg"
                    />
                  </div>
                  <div className="mt-auto">
                    <h3 className="font-extrabold text-sm text-white leading-tight drop-shadow truncate">{game.title}</h3>
                    <p className="text-[10px] text-white/80 leading-snug mt-0.5 truncate">{game.desc}</p>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 space-y-3">
          <FlashSaleBanner />
          <WeeklyLeaderboard />
        </div>

        {/* ✨ Fitur Game baru */}
        <div className="mt-5 space-y-3">
          <GameSeasonPass visitorId={visitorId} />
          <div className="grid grid-cols-1 gap-3">
            <GamePvPBattle visitorId={visitorId} />
            <GameClanSystem visitorId={visitorId} />
          </div>
          <GameQuestChain visitorId={visitorId} />
        </div>

        {/* 🎮 Neon Extras: Daily Challenge · Tournament · Leaderboard · Achievements */}
        <div className="mt-5">
          <NeonGameExtras visitorId={visitorId} onPlayDailyChallenge={(g) => setMode(g as GameMode)} />
        </div>
      </motion.div>
    </div>
  );
}
