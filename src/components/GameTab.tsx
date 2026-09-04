import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Gamepad2, ArrowLeft, Sparkles, Trophy, Flame, Star, Crown, Rocket } from "lucide-react";
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
import TebakLarikGame from "@/components/games/TebakLarikGame";
import PilihanGandaGame from "@/components/games/PilihanGandaGame";
import ScratchCardGame from "@/components/games/ScratchCardGame";
import SlotMachineGame from "@/components/games/SlotMachineGame";
import Match3Game from "@/components/games/Match3Game";
import LuckyDrawGame from "@/components/games/LuckyDrawGame";
import MineSweeperGame from "@/components/games/MineSweeperGame";
import TebakLaguGame from "@/components/games/TebakLaguGame";
import MemoryFlipGame from "@/components/games/MemoryFlipGame";
import SnakeNeonGame from "@/components/games/SnakeNeonGame";
import Game2048 from "@/components/games/Game2048";
import PlinkoGame from "@/components/games/PlinkoGame";
import TetrisNeonGame from "@/components/games/TetrisNeonGame";
import BubbleShooterGame from "@/components/games/BubbleShooterGame";
import FlappyBirdGame from "@/components/games/FlappyBirdGame";
import BrickBreakerGame from "@/components/games/BrickBreakerGame";
import CatchStarGame from "@/components/games/CatchStarGame";
import ColorReflexGame from "@/components/games/ColorReflexGame";
import WhackAMoleGame from "@/components/games/WhackAMoleGame";
import TapBeatGame from "@/components/games/TapBeatGame";
import SkyJumperGame from "@/components/games/SkyJumperGame";
import SpaceShooterGame from "@/components/games/SpaceShooterGame";
import HelicopterCaveGame from "@/components/games/HelicopterCaveGame";
import StackTowerGame from "@/components/games/StackTowerGame";
import PongClassicGame from "@/components/games/PongClassicGame";
import FroggerMiniGame from "@/components/games/FroggerMiniGame";
import {
  PianoTilesGame, BlockStackerGame, HoopShotGame, LaneRacerGame, NinjaSliceGame,
  SimonSaysGame, FishingGame, CrossyChickenGame, SpinWinGame, BalloonPopGame,
} from "@/components/games/MiniGamesPack";
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
import GameLevelHero from "@/components/games/GameLevelHero";
import GameLevelMiniBar from "@/components/games/GameLevelMiniBar";
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
import gameMemoryImg from "@/assets/game-memory.png";
import gameSnakeImg from "@/assets/game-snake.png";
import game2048Img from "@/assets/game-2048.png";
import gamePlinkoImg from "@/assets/game-plinko.png";
import gameTetrisImg from "@/assets/game-tetris.png";
import gameBubbleImg from "@/assets/game-bubble.png";
import gameFlappyImg from "@/assets/game-flappy.png";
import gameBrickImg from "@/assets/game-brick.png";
import gameCatchImg from "@/assets/game-catch.png";
import gameReflexImg from "@/assets/game-reflex.png";
import gameMoleImg from "@/assets/game-mole.png";
import gameBeatImg from "@/assets/game-beat.png";
import gameJumpImg from "@/assets/game-jump.png";
import gamePianoImg from "@/assets/game-piano.png";
import gameTowerImg from "@/assets/game-tower.png";
import gameHoopImg from "@/assets/game-hoop.png";
import gameCarImg from "@/assets/game-car.png";
import gameNinjaImg from "@/assets/game-ninja.png";
import gameArrowImg from "@/assets/game-arrow.png";
import gameFishImg from "@/assets/game-fish.png";
import gameChickenImg from "@/assets/game-chicken.png";
import gameWheelImg from "@/assets/game-wheel.png";
import gameBalloonImg from "@/assets/game-balloon.png";
import gameSpaceShooterImg from "@/assets/game-space-shooter.png";
import gameHelicopterImg from "@/assets/game-helicopter.png";
import gameStackTowerImg from "@/assets/game-stack-tower.png";
import gamePongImg from "@/assets/game-pong.png";
import gameFroggerImg from "@/assets/game-frogger.png";
import gameTebakLarikImg from "@/assets/game-tebak-larik.png";
type GameMode = "menu" | "suit" | "tebak" | "tebak_gambar" | "teka_teki" | "tebak_angka" | "tebak_barang" | "ular_tangga" | "ludo" | "kuis" | "teka_teki_v2" | "pilihan_ganda" | "scratch" | "slot" | "match3" | "lucky_draw" | "mine" | "tebak_lagu" | "memory" | "snake" | "g2048" | "plinko" | "tetris" | "bubble" | "flappy" | "brick" | "catch" | "reflex" | "mole" | "beat" | "jump" | "piano" | "tower" | "hoop" | "racer" | "ninja" | "simon" | "fish" | "chicken" | "spin" | "balloon" | "space_shooter" | "helicopter" | "stack_tower" | "pong" | "frogger" | "tebak_larik";

const GAMES: { mode: GameMode; title: string; desc: string; image: string; gradient: string }[] = [
  { mode: "tebak_larik", title: "Tebak Larik AI", desc: "Lengkapi larik puisi & lirik ✍️", image: gameTebakLarikImg, gradient: "from-violet-600 to-fuchsia-600" },
  { mode: "space_shooter", title: "Space Shooter", desc: "Tembak alien, raih skor 🚀", image: gameSpaceShooterImg, gradient: "from-indigo-600 to-fuchsia-700" },
  { mode: "helicopter", title: "Helicopter Cave", desc: "Tahan untuk naik, hindari gua 🚁", image: gameHelicopterImg, gradient: "from-amber-500 to-orange-700" },
  { mode: "stack_tower", title: "Stack Tower", desc: "Tap pas waktunya, bangun tower 🧱", image: gameStackTowerImg, gradient: "from-pink-500 to-rose-600" },
  { mode: "pong", title: "Pong Classic", desc: "Lawan AI, pertama 5 menang 🏓", image: gamePongImg, gradient: "from-cyan-500 to-blue-700" },
  { mode: "frogger", title: "Frogger Mini", desc: "Hindari mobil, capai goal 🐸", image: gameFroggerImg, gradient: "from-emerald-500 to-green-700" },
  { mode: "piano", title: "Piano Tiles", desc: "Tap tile hitam, jangan miss 🎹", image: gamePianoImg, gradient: "from-violet-500 to-fuchsia-700" },
  { mode: "tower", title: "Block Stacker", desc: "Susun balok setinggi mungkin 🧱", image: gameTowerImg, gradient: "from-orange-500 to-rose-700" },
  { mode: "hoop", title: "Hoop Shot", desc: "Lempar bola masuk ring 🏀", image: gameHoopImg, gradient: "from-amber-500 to-red-600" },
  { mode: "racer", title: "Lane Racer", desc: "Hindari mobil, ambil koin 🚗", image: gameCarImg, gradient: "from-red-500 to-rose-700" },
  { mode: "ninja", title: "Ninja Slice", desc: "Potong buah hindari bom 🥷", image: gameNinjaImg, gradient: "from-zinc-700 to-red-700" },
  { mode: "simon", title: "Simon Says", desc: "Ingat urutan warna 🎯", image: gameArrowImg, gradient: "from-indigo-500 to-purple-700" },
  { mode: "fish", title: "Fishing Master", desc: "Tap pas zona hijau 🎣", image: gameFishImg, gradient: "from-cyan-500 to-blue-700" },
  { mode: "chicken", title: "Crossy Chicken", desc: "Seberangi jalan! 🐔", image: gameChickenImg, gradient: "from-amber-500 to-yellow-600" },
  { mode: "spin", title: "Spin & Win", desc: "Putar roda hoki 🎡", image: gameWheelImg, gradient: "from-fuchsia-500 to-pink-700" },
  { mode: "balloon", title: "Balloon Pop", desc: "Pop balon, hindari bom 🎈", image: gameBalloonImg, gradient: "from-pink-500 to-rose-700" },
  { mode: "mole", title: "Whack-a-Mole", desc: "Pukul tikus, hindari bom 🔨", image: gameMoleImg, gradient: "from-emerald-500 to-lime-600" },
  { mode: "beat", title: "Tap Tap Beat", desc: "Rhythm tap 4 lane 🎵", image: gameBeatImg, gradient: "from-fuchsia-500 to-purple-600" },
  { mode: "jump", title: "Sky Jumper", desc: "Lompat setinggi mungkin 🚀", image: gameJumpImg, gradient: "from-blue-500 to-indigo-700" },
  { mode: "brick", title: "Brick Breaker", desc: "Pecahkan semua bata!", image: gameBrickImg, gradient: "from-pink-500 to-violet-600" },
  { mode: "catch", title: "Catch Star", desc: "Tangkap bintang & permata", image: gameCatchImg, gradient: "from-amber-400 to-orange-600" },
  { mode: "reflex", title: "Color Reflex", desc: "Tes refleks warna ⚡", image: gameReflexImg, gradient: "from-emerald-500 to-cyan-600" },
  { mode: "tetris", title: "Tetris Neon", desc: "Susun blok klasik bergaya neon", image: gameTetrisImg, gradient: "from-fuchsia-500 to-cyan-500" },
  { mode: "bubble", title: "Bubble Shooter", desc: "Tembak & cocokkan 3 warna", image: gameBubbleImg, gradient: "from-rose-500 to-orange-500" },
  { mode: "flappy", title: "Flappy Bird", desc: "Lompati pipa, raih skor!", image: gameFlappyImg, gradient: "from-sky-500 to-emerald-500" },
  { mode: "g2048", title: "2048", desc: "Gabung tile, raih 2048!", image: game2048Img, gradient: "from-amber-500 to-orange-600" },
  { mode: "plinko", title: "Plinko", desc: "Drop bola, menang multiplier", image: gamePlinkoImg, gradient: "from-purple-500 to-pink-600" },
  { mode: "memory", title: "Memory Flip", desc: "Cocokkan pasangan kartu", image: gameMemoryImg, gradient: "from-indigo-500 to-pink-600" },
  { mode: "snake", title: "Snake Neon", desc: "Ular klasik bergaya neon", image: gameSnakeImg, gradient: "from-cyan-500 to-fuchsia-600" },
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
  tebak_larik: TebakLarikGame,
  scratch: ScratchCardGame,
  slot: SlotMachineGame,
  match3: Match3Game,
  lucky_draw: LuckyDrawGame,
  mine: MineSweeperGame,
  tebak_lagu: TebakLaguGame,
  memory: MemoryFlipGame,
  snake: SnakeNeonGame,
  g2048: Game2048,
  plinko: PlinkoGame,
  tetris: TetrisNeonGame,
  bubble: BubbleShooterGame,
  flappy: FlappyBirdGame,
  brick: BrickBreakerGame,
  catch: CatchStarGame,
  reflex: ColorReflexGame,
  mole: WhackAMoleGame,
  beat: TapBeatGame,
  jump: SkyJumperGame,
  piano: PianoTilesGame,
  tower: BlockStackerGame,
  hoop: HoopShotGame,
  racer: LaneRacerGame,
  ninja: NinjaSliceGame,
  simon: SimonSaysGame,
  fish: FishingGame,
  chicken: CrossyChickenGame,
  spin: SpinWinGame,
  balloon: BalloonPopGame,
  space_shooter: SpaceShooterGame,
  helicopter: HelicopterCaveGame,
  stack_tower: StackTowerGame,
  pong: PongClassicGame,
  frogger: FroggerMiniGame,
};

export default function GameTab({ visitorId: visitorIdProp }: { visitorId?: string | null }) {
  const [mode, setMode] = useState<GameMode>("menu");
  const [dailyGame, setDailyGame] = useState<string>("");
  const visitorId = visitorIdProp ?? (typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null);
  const { credits, isUnlimited, unlimitedUntil, fetchCredits } = useGameCredits(visitorId);
  const { amount: gameBalance } = useGameBalance(visitorId);
  const { profile, fetchProfile, visitorId: gameVisitorId } = useGameProfile(visitorId);

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
        <GameLevelMiniBar visitorId={visitorId} />
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
        {/* 🎮 Maximalist Hero Header */}
        <div className="relative overflow-hidden rounded-3xl p-[2px] mb-4 game-hero-pulse">
          <div className="absolute inset-0 game-border-rainbow opacity-90" />
          <div className="relative rounded-[22px] update-aurora-bg p-4 overflow-hidden">
            {/* Floating background emojis */}
            <div className="absolute top-2 right-3 text-3xl float-emoji opacity-70" style={{ animationDelay: "0s" }}>🎮</div>
            <div className="absolute bottom-2 left-4 text-2xl float-emoji opacity-60" style={{ animationDelay: "0.8s" }}>🕹️</div>
            <div className="absolute top-1/2 left-1/2 text-2xl float-emoji opacity-50" style={{ animationDelay: "1.4s" }}>🏆</div>
            <div className="absolute top-3 left-1/3 text-xl float-emoji opacity-50" style={{ animationDelay: "2s" }}>⚡</div>

            <div className="relative flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-yellow-300/40 blur-md rounded-full" />
                  <Gamepad2 className="relative w-7 h-7 text-white drop-shadow-[0_2px_8px_rgba(255,255,0,0.8)] quick-action-bounce" />
                </div>
                <h2 className="font-black text-xl text-white drop-shadow-lg tracking-tight">
                  GAME <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">HUB</span>
                </h2>
                <Sparkles className="w-4 h-4 text-yellow-300 quick-action-bounce" />
              </div>
              <GameProfileDialog profile={profile} onUpdate={fetchProfile} visitorId={gameVisitorId} />
            </div>

            <div className="relative flex items-center gap-2 flex-wrap">
              <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} unlimitedUntil={unlimitedUntil} />
              <GameBalanceBadge amount={gameBalance} />
              <BuyCreditsDialog visitorId={visitorId} onPurchased={fetchCredits} />
            </div>
            <p className="relative text-[10px] text-white/90 mt-2 font-medium drop-shadow">
              💡 <strong className="text-yellow-200">Saldo IN</strong> hanya untuk Game/Streak/Storage.
            </p>
          </div>
        </div>

        {/* Hero level pemain + booster x2 */}
        <div className="mb-4">
          <GameLevelHero visitorId={visitorId} />
        </div>

        {/* 📊 Hero Banner — Maximalist */}
        <div className="relative overflow-hidden rounded-2xl p-[2px] mb-4">
          <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-500 game-border-rainbow" />
          <div className="relative rounded-[14px] bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-pink-500/30 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-cyan-500/30 rounded-full blur-2xl" />

            <div className="relative flex items-center gap-3 mb-2">
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 via-orange-500 to-rose-600 flex items-center justify-center shadow-xl shadow-orange-500/40">
                <Rocket className="w-6 h-6 text-white drop-shadow quick-action-bounce" />
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-300 border-2 border-orange-600 game-chip-bounce" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-white text-base leading-tight">
                  <span className="bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent animate-count-glow">{GAMES.length}</span>
                  {" "}game siap dimainkan
                </h3>
                <p className="text-white/70 text-[11px] mt-0.5 flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-yellow-300" /> Kumpulkan poin & naik leaderboard
                </p>
              </div>
            </div>
            <div className="relative flex flex-wrap gap-1.5 mt-3">
              {[
                { name: "🥊 Suit", c: "from-orange-500 to-red-600" },
                { name: "🔤 Tebak Kata", c: "from-blue-500 to-indigo-600" },
                { name: "🧩 Puzzle", c: "from-teal-500 to-cyan-600" },
                { name: "❓ Kuis", c: "from-emerald-500 to-green-600" },
                { name: "🐍 Ular Tangga", c: "from-lime-500 to-emerald-600" },
                { name: "🎲 Ludo", c: "from-pink-500 to-rose-600" },
              ].map((tag, i) => (
                <span
                  key={tag.name}
                  className={`text-[10px] font-bold text-white rounded-full px-2.5 py-1 bg-gradient-to-r ${tag.c} shadow-md game-chip-bounce`}
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  {tag.name}
                </span>
              ))}
              <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-white/15 backdrop-blur text-white border border-white/30">
                +{GAMES.length - 6} lainnya ✨
              </span>
            </div>
          </div>
        </div>

        {/* 🎯 Game Grid — Maximalist */}
        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((game, i) => {
            const isDaily = game.mode === dailyGame;
            return (
              <motion.div
                key={game.mode}
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 260, damping: 20 }}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.04, y: -4 }}
                className="flex"
              >
                <button
                  onClick={() => setMode(game.mode)}
                  className={`group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br ${game.gradient} p-3 text-left shadow-lg flex flex-col h-[150px] game-card-float`}
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    boxShadow: "0 8px 20px -4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)",
                  }}
                >
                  {/* Animated gradient overlay on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />

                  {/* Shine sweep */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent game-shine-sweep" style={{ animationDelay: `${i * 0.3}s` }} />
                  </div>

                  {/* Floating sparkle dots */}
                  <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-white/70 quick-action-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                  <div className="absolute bottom-12 right-2 w-1 h-1 rounded-full bg-white/60 quick-action-bounce" style={{ animationDelay: `${i * 0.2 + 0.5}s` }} />

                  {/* Daily 2X badge */}
                  {isDaily && (
                    <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 bg-gradient-to-r from-yellow-300 to-amber-500 text-yellow-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg game-daily-glow">
                      <Flame className="w-2.5 h-2.5 fill-current" /> 2X
                    </div>
                  )}

                  {/* Icon container with glow */}
                  <div className="relative flex items-center justify-center flex-1 z-10">
                    <div className="absolute w-16 h-16 rounded-full bg-white/20 blur-xl group-hover:bg-white/40 transition-all" />
                    <img
                      src={game.image}
                      alt={game.title}
                      loading="lazy"
                      className="relative w-14 h-14 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)] game-icon-wiggle"
                    />
                  </div>

                  {/* Title with gradient text */}
                  <div className="relative mt-auto z-10">
                    <h3 className="font-black text-sm text-white leading-tight drop-shadow-md truncate flex items-center gap-1">
                      {game.title}
                      {isDaily && <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />}
                    </h3>
                    <p className="text-[10px] text-white/85 leading-snug mt-0.5 truncate font-medium">{game.desc}</p>
                  </div>

                  {/* Bottom accent bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
      </BanLock>
    </div>
  );
}
