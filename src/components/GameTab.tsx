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
import { Zap, Heart, ShoppingCart, Play, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import GameShopSheet from "@/components/games/GameShopSheet";
import { useGameHub, relativeTime } from "@/components/games/useGameHub";
import { gameCategories, GAME_CATEGORY_LABELS, GAME_OPEN_KEY } from "@/components/games/gameCatalog";
import { loadGameData } from "@/components/games/gameStore";

import { GAMES, type GameMode } from "@/components/games/gameCatalog";
import { useMemo } from "react";
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
  const { hub, toggleFavorite, touchPlayed, refresh: refreshHub } = useGameHub(gameVisitorId);
  const { toast } = useToast();
  const [category, setCategory] = useState<string>("all");
  const [detail, setDetail] = useState<GameMode | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [heartBurst, setHeartBurst] = useState<string | null>(null);
  const level = loadGameData();
  const statOf = (m: string) => hub.stats.find((s) => s.game_type === m);
  const bestGame = useMemo(() => [...hub.stats].sort((a, b) => b.points - a.points)[0], [hub.stats]);
  const activeMember = hub.memberships[0];
  const recommended = useMemo(() => {
    const top = Object.entries(hub.play_counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!top) return [] as typeof GAMES;
    const cats = gameCategories(top);
    return GAMES.filter((g) => g.mode !== top && gameCategories(g.mode).some((c) => cats.includes(c))).slice(0, 6);
  }, [hub.play_counts]);
  const visibleGames = useMemo(() => category === "all" ? GAMES : category === "favorite" ? GAMES.filter((g) => hub.favorite_games.includes(g.mode)) : GAMES.filter((g) => gameCategories(g.mode).includes(category as any)), [category, hub.favorite_games]);

  const openGame = (m: GameMode) => { setDetail(null); touchPlayed(m); setMode(m); };
  const onFavorite = async (m: GameMode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!gameVisitorId) { toast({ title: "Profil game belum siap", description: "Coba lagi sebentar.", variant: "destructive" }); return; }
    const was = hub.favorite_games.includes(m);
    if (!was) { setHeartBurst(m); setTimeout(() => setHeartBurst(null), 700); }
    const res = await toggleFavorite(m);
    const title = GAMES.find((g) => g.mode === m)?.title;
    if (res !== null) toast({ title: res ? `❤️ ${title} ditambahkan ke Favorit` : `${title} dihapus dari Favorit` });
  };

  // Open a game requested from Favorites
  useEffect(() => {
    const req = localStorage.getItem(GAME_OPEN_KEY);
    if (req && GAMES.some((g) => g.mode === req)) { localStorage.removeItem(GAME_OPEN_KEY); openGame(req as GameMode); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameVisitorId]);

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
          <div className="ml-auto flex gap-1.5">
            <Button size="icon" variant="outline" className="h-10 w-10" aria-label="Favorit" onClick={() => onFavorite(mode)}>
              <Heart className={`w-4 h-4 ${hub.favorite_games.includes(mode) ? "text-rose-500" : ""}`} fill={hub.favorite_games.includes(mode) ? "currentColor" : "none"} />
            </Button>
            <Button size="sm" className="h-10 gap-1 font-black" onClick={() => setShopOpen(true)}><ShoppingCart className="w-4 h-4" />Shop</Button>
          </div>
        </div>
        <GameShopSheet visitorId={visitorId} open={shopOpen} onOpenChange={setShopOpen} onChanged={fetchCredits} />
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
                  GAME <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">CENTER</span>
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
            <p className="relative text-[11px] text-white/90 mt-1 font-semibold">Mainkan game, kumpulkan reward, naikkan level, dan buka item baru.</p>
            <div className="relative mt-3 grid grid-cols-4 gap-1.5">
              {[
                ["Level", level.level], ["XP", level.totalPoints.toLocaleString("id-ID")], ["Credits", isUnlimited ? "∞" : credits],
                ["Saldo IN", gameBalance.toLocaleString("id-ID")], ["Best", bestGame ? bestGame.points.toLocaleString("id-ID") : "-"],
                ["Rank", hub.rank ? `#${hub.rank}` : "-"], ["Main", level.gamesPlayed], ["Member", activeMember ? "👑" : "Free"],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-black/30 backdrop-blur border border-white/15 px-1.5 py-1.5 text-center">
                  <div className="text-[13px] font-black text-white tabular-nums truncate">{v}</div>
                  <div className="text-[9px] font-bold text-white/70 uppercase">{l}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShopOpen(true)} className="relative mt-3 w-full min-h-11 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition shadow-lg shadow-orange-500/30">
              <ShoppingCart className="w-4 h-4" /> 🛒 GAME SHOP
            </button>
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

        {/* 👑 Membership status (existing memberships) */}
        <div className="mb-4 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 to-fuchsia-500/10 p-3 flex items-center gap-3">
          <Crown className="w-8 h-8 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            {activeMember ? (<>
              <p className="text-xs font-black text-amber-500">👑 MEMBERSHIP ACTIVE · {activeMember.plan_name}</p>
              <p className="text-[11px] text-muted-foreground">Bonus klaim streak x{Number(activeMember.bonus_multiplier).toFixed(1)} · coin harian · item khusus Plus di Game Shop · s/d {new Date(activeMember.expires_at).toLocaleDateString("id-ID")}</p>
            </>) : (<>
              <p className="text-xs font-black">👑 Membership</p>
              <p className="text-[11px] text-muted-foreground">Dapatkan coin harian, bonus streak & item khusus member.</p>
            </>)}
          </div>
          <Button size="sm" className="h-10 font-black" onClick={() => setShopOpen(true)}>{activeMember ? "Kelola" : "Lihat"}</Button>
        </div>

        {/* ⚡ Lanjutkan bermain */}
        {hub.last_played_game && GAMES.some((g) => g.mode === hub.last_played_game) && (() => {
          const g = GAMES.find((x) => x.mode === hub.last_played_game)!; const st = statOf(g.mode);
          return (
            <div className={`mb-4 rounded-2xl bg-gradient-to-r ${g.gradient} p-[1.5px]`}>
              <div className="rounded-[14px] bg-slate-950/85 p-3 flex items-center gap-3">
                <img src={g.image} alt="" className="w-14 h-14 object-contain" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-amber-300 tracking-widest">⚡ LANJUTKAN BERMAIN</p>
                  <p className="font-black text-white truncate">{g.title}</p>
                  <p className="text-[10px] text-white/60">{st ? `${st.points.toLocaleString("id-ID")} poin · ${st.wins} menang · ` : ""}{relativeTime(hub.last_played_at)}</p>
                </div>
                <Button className="h-11 font-black gap-1" onClick={() => openGame(g.mode)}><Play className="w-4 h-4" fill="currentColor" />Lanjut</Button>
              </div>
            </div>
          );
        })()}

        {/* ⭐ Rekomendasi */}
        {recommended.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-black mb-2">⭐ DIREKOMENDASIKAN UNTUKMU</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recommended.map((g) => (
                <button key={g.mode} onClick={() => setDetail(g.mode)} className={`shrink-0 w-28 rounded-2xl bg-gradient-to-br ${g.gradient} p-2 text-left active:scale-95 transition`}>
                  <img src={g.image} alt="" loading="lazy" className="w-12 h-12 mx-auto object-contain" />
                  <p className="text-[11px] font-black text-white truncate mt-1">{g.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Kategori */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {GAME_CATEGORY_LABELS.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className={`shrink-0 min-h-9 px-3 rounded-full text-[11px] font-black border transition ${category === c.id ? "bg-foreground text-background border-foreground" : "bg-card border-border text-foreground/80"}`}>
              {c.label}{c.id === "favorite" && hub.favorite_games.length ? ` (${hub.favorite_games.length})` : ""}
            </button>
          ))}
        </div>
        {visibleGames.length === 0 && <p className="text-center text-sm text-muted-foreground py-8 rounded-2xl border border-dashed border-border">{category === "favorite" ? "Belum ada game favorit. Tekan ❤️ di kartu game." : "Tidak ada game di kategori ini."}</p>}

        {/* 🎯 Game Grid — Maximalist */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleGames.map((game, i) => {
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
                <div className="relative w-full">
                <button
                  type="button"
                  aria-label={hub.favorite_games.includes(game.mode) ? "Hapus favorit" : "Tambah favorit"}
                  onClick={(e) => onFavorite(game.mode, e)}
                  className="absolute top-1.5 left-1.5 z-30 w-9 h-9 rounded-full bg-black/35 backdrop-blur flex items-center justify-center active:scale-90 transition"
                >
                  <Heart className={`w-4 h-4 ${hub.favorite_games.includes(game.mode) ? "text-rose-400 scale-110" : "text-white"} transition-transform`} fill={hub.favorite_games.includes(game.mode) ? "currentColor" : "none"} />
                  {heartBurst === game.mode && [0, 1, 2, 3, 4, 5].map((k) => (
                    <motion.span key={k} className="absolute w-1.5 h-1.5 rounded-full bg-rose-400" initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(k * 1.05) * 18, y: Math.sin(k * 1.05) * 18, opacity: 0 }} transition={{ duration: 0.6 }} />
                  ))}
                </button>
                <button
                  onClick={() => setDetail(game.mode)}
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
                </div>
              </motion.div>
            );
          })}
        </div>


        <div className="mt-4 space-y-3">
          <FlashSaleBanner />
          <div id="game-weekly-leaderboard"><WeeklyLeaderboard /></div>
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
          <NeonGameExtras visitorId={visitorId} onPlayDailyChallenge={(g) => openGame(g as GameMode)} />
        </div>

        <GameShopSheet visitorId={visitorId} open={shopOpen} onOpenChange={setShopOpen} onChanged={() => { fetchCredits(); refreshHub(); }} />
        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-w-sm p-0 overflow-hidden">
            {detail && (() => {
              const g = GAMES.find((x) => x.mode === detail)!; const st = statOf(g.mode); const fav = hub.favorite_games.includes(g.mode);
              return (
                <div>
                  <div className={`relative h-40 bg-gradient-to-br ${g.gradient} flex items-center justify-center`}>
                    <img src={g.image} alt={g.title} className="w-28 h-28 object-contain drop-shadow-2xl" />
                    <div className="absolute top-2 left-2 flex gap-1">{gameCategories(g.mode).map((c) => <span key={c} className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-black/40 text-white">{c}</span>)}</div>
                  </div>
                  <div className="p-4 space-y-3">
                    <DialogTitle className="text-xl font-black">🎮 {g.title}</DialogTitle>
                    <p className="text-xs text-muted-foreground -mt-2">{g.desc}</p>
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      {[["⭐ Poin", st ? st.points.toLocaleString("id-ID") : "-"], ["🏆 Menang", st?.wins ?? "-"], ["🎯 Main", hub.play_counts[g.mode] || 0], ["🕒", relativeTime(statOf(g.mode)?.updated_at || (hub.last_played_game === g.mode ? hub.last_played_at : null))]].map(([l, v]) => (
                        <div key={l as string} className="rounded-xl bg-muted p-1.5"><div className="text-[11px] font-black truncate">{v}</div><div className="text-[9px] text-muted-foreground">{l}</div></div>
                      ))}
                    </div>
                    <Button className="w-full h-12 font-black text-base gap-2" onClick={() => openGame(g.mode)}><Play className="w-5 h-5" fill="currentColor" />MAIN SEKARANG</Button>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" className="h-11 gap-1" onClick={() => onFavorite(g.mode)}><Heart className={`w-4 h-4 ${fav ? "text-rose-500" : ""}`} fill={fav ? "currentColor" : "none"} />{fav ? "Favorit" : "Favorit"}</Button>
                      <Button variant="outline" className="h-11 gap-1" onClick={() => { setDetail(null); setTimeout(() => document.getElementById("game-weekly-leaderboard")?.scrollIntoView({ behavior: "smooth" }), 100); }}><Trophy className="w-4 h-4" />Rank</Button>
                      <Button variant="outline" className="h-11 gap-1" onClick={() => { setDetail(null); setShopOpen(true); }}><ShoppingCart className="w-4 h-4" />Shop</Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </motion.div>
      </BanLock>
    </div>
  );
}
