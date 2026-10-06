// Shared catalog of EXISTING games (metadata only, no game code) used by Game Center and Favorites.
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
export type GameMode = "menu" | "suit" | "tebak" | "tebak_gambar" | "teka_teki" | "tebak_angka" | "tebak_barang" | "ular_tangga" | "ludo" | "kuis" | "teka_teki_v2" | "pilihan_ganda" | "scratch" | "slot" | "match3" | "lucky_draw" | "mine" | "tebak_lagu" | "memory" | "snake" | "g2048" | "plinko" | "tetris" | "bubble" | "flappy" | "brick" | "catch" | "reflex" | "mole" | "beat" | "jump" | "piano" | "tower" | "hoop" | "racer" | "ninja" | "simon" | "fish" | "chicken" | "spin" | "balloon" | "space_shooter" | "helicopter" | "stack_tower" | "pong" | "frogger" | "tebak_larik";

export const GAMES: { mode: GameMode; title: string; desc: string; image: string; gradient: string }[] = [
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


export type GameCategory = "trending" | "new" | "competitive" | "puzzle" | "arcade" | "casual" | "premium";
const CAT: Record<string, GameCategory[]> = {
  tebak_larik: ["new", "puzzle"], space_shooter: ["new", "arcade"], helicopter: ["new", "arcade"], stack_tower: ["new", "arcade", "casual"], pong: ["new", "competitive", "arcade"], frogger: ["new", "arcade"],
  piano: ["arcade"], tower: ["casual"], hoop: ["casual"], racer: ["arcade"], ninja: ["arcade"], simon: ["puzzle"], fish: ["casual"], chicken: ["arcade"], spin: ["casual", "premium"], balloon: ["casual"],
  mole: ["arcade", "casual"], beat: ["arcade"], jump: ["arcade"], brick: ["arcade", "trending"], catch: ["casual"], reflex: ["arcade", "competitive"], tetris: ["puzzle", "trending"], bubble: ["puzzle", "casual"],
  flappy: ["arcade", "trending"], g2048: ["puzzle", "trending"], plinko: ["premium", "casual"], memory: ["puzzle"], snake: ["arcade", "trending"], scratch: ["premium"], slot: ["premium"], mine: ["premium", "puzzle"],
  match3: ["puzzle", "trending"], lucky_draw: ["premium"], suit: ["competitive", "casual"], tebak: ["puzzle"], tebak_gambar: ["puzzle"], teka_teki: ["puzzle"], tebak_angka: ["puzzle"], tebak_barang: ["puzzle"],
  kuis: ["casual"], teka_teki_v2: ["puzzle"], ular_tangga: ["competitive", "casual"], ludo: ["competitive"], pilihan_ganda: ["puzzle"], tebak_lagu: ["puzzle"],
};
export function gameCategories(mode: string): GameCategory[] { return CAT[mode] || ["casual"]; }
export const GAME_CATEGORY_LABELS: { id: "all" | "favorite" | GameCategory; label: string }[] = [
  { id: "all", label: "🎮 Semua" }, { id: "trending", label: "🔥 Trending" }, { id: "favorite", label: "❤️ Favorit" }, { id: "new", label: "🆕 Baru" },
  { id: "competitive", label: "🏆 Competitive" }, { id: "puzzle", label: "🧠 Puzzle" }, { id: "arcade", label: "⚡ Arcade" }, { id: "casual", label: "🎯 Casual" }, { id: "premium", label: "👑 Premium" },
];
/** Request GameTab to open a specific existing game (used by Favorites "Main"). */
export const GAME_OPEN_KEY = "game_open_request";
