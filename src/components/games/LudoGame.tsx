import { useState, useCallback, useRef } from "react";
import { updateGameStats } from "./GameProfile";
import { getVisitorId } from "@/lib/visitor-id";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TRACK_LENGTH = 52;
const HOME_LENGTH = 5;
const TOKENS_PER_PLAYER = 2;

// Dice face SVG
function DiceFace({ value, size = 56, color = "#1e293b", rolling = false }: { value: number; size?: number; color?: string; rolling?: boolean }) {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 30], [50, 50], [70, 70]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
    6: [[30, 30], [70, 30], [30, 50], [70, 50], [30, 70], [70, 70]],
  };
  const dots = dotPositions[value] || dotPositions[1];
  return (
    <motion.div
      animate={rolling ? { rotateX: [0, 360], rotateY: [0, 360], scale: [1, 1.15, 1] } : {}}
      transition={{ duration: 0.5, repeat: rolling ? Infinity : 0 }}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id="ludoDice" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <filter id="ludoShadow"><feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.25" /></filter>
        </defs>
        <rect x="5" y="5" width="90" height="90" rx="14" fill="url(#ludoDice)" stroke="#94a3b8" strokeWidth="1.5" filter="url(#ludoShadow)" />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={6} fill={color} />
        ))}
      </svg>
    </motion.div>
  );
}

interface Token {
  id: number;
  state: "base" | "track" | "home" | "finished";
  trackPos: number; // 0-51 for track, 0-4 for home stretch
}

function createTokens(): Token[] {
  return Array.from({ length: TOKENS_PER_PLAYER }, (_, i) => ({
    id: i, state: "base", trackPos: 0,
  }));
}

function canMove(token: Token, dice: number): boolean {
  if (token.state === "finished") return false;
  if (token.state === "base") return dice === 6;
  if (token.state === "home") return token.trackPos + dice <= HOME_LENGTH;
  if (token.state === "track") {
    const newPos = token.trackPos + dice;
    if (newPos >= TRACK_LENGTH) {
      const homeEntry = newPos - TRACK_LENGTH;
      return homeEntry <= HOME_LENGTH;
    }
    return true;
  }
  return false;
}

function doMove(token: Token, dice: number): Token {
  if (token.state === "base" && dice === 6) {
    return { ...token, state: "track", trackPos: 0 };
  }
  if (token.state === "home") {
    const np = token.trackPos + dice;
    if (np >= HOME_LENGTH) return { ...token, state: "finished", trackPos: HOME_LENGTH };
    return { ...token, trackPos: np };
  }
  if (token.state === "track") {
    const np = token.trackPos + dice;
    if (np >= TRACK_LENGTH) {
      const homeEntry = np - TRACK_LENGTH;
      if (homeEntry >= HOME_LENGTH) return { ...token, state: "finished", trackPos: HOME_LENGTH };
      return { ...token, state: "home", trackPos: homeEntry };
    }
    return { ...token, trackPos: np };
  }
  return token;
}

// Simple visual: show tokens as circles on a progress bar style
function TokenProgress({ tokens, color, label }: { tokens: Token[]; color: string; label: string }) {
  const totalSteps = TRACK_LENGTH + HOME_LENGTH;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      {tokens.map(t => {
        let progress = 0;
        if (t.state === "track") progress = (t.trackPos / totalSteps) * 100;
        else if (t.state === "home") progress = ((TRACK_LENGTH + t.trackPos) / totalSteps) * 100;
        else if (t.state === "finished") progress = 100;

        return (
          <div key={t.id} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full ${color} border-2 border-white shadow-sm flex items-center justify-center`}>
              <span className="text-[8px] text-white font-black">{t.id + 1}</span>
            </div>
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${color} rounded-full`}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-[9px] font-bold w-12 text-right">
              {t.state === "base" ? "Base" : t.state === "finished" ? "✅" : t.state === "home" ? "Home" : `${t.trackPos}/${TRACK_LENGTH}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function LudoGame() {
  const [pTokens, setPTokens] = useState<Token[]>(createTokens());
  const [aTokens, setATokens] = useState<Token[]>(createTokens());
  const [dice, setDice] = useState(1);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [rollAnim, setRollAnim] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);
  const [message, setMessage] = useState("Lempar dadu untuk mulai! Dapat 6 untuk keluar base.");
  const [selectMode, setSelectMode] = useState(false);
  const [movableIds, setMovableIds] = useState<number[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const rollDiceVal = () => Math.floor(Math.random() * 6) + 1;
  const checkWin = (tokens: Token[]) => tokens.every(t => t.state === "finished");

  // Check capture: if player lands on opponent's track position
  const checkCapture = (movedTokens: Token[], oppTokens: Token[], offset: number): Token[] => {
    const result = [...oppTokens];
    for (const mt of movedTokens) {
      if (mt.state !== "track") continue;
      for (let i = 0; i < result.length; i++) {
        if (result[i].state !== "track") continue;
        // Simplify: both on same relative track position but offset
        const mtAbs = mt.trackPos;
        const oppAbs = (result[i].trackPos + offset) % TRACK_LENGTH;
        if (mtAbs === oppAbs) {
          result[i] = { ...result[i], state: "base", trackPos: 0 };
        }
      }
    }
    return result;
  };

  const executeMove = (tokenId: number, diceVal: number) => {
    const newTokens = pTokens.map(t => t.id === tokenId ? doMove(t, diceVal) : t);
    const newATokens = checkCapture(newTokens, aTokens, TRACK_LENGTH / 2);
    const captured = newATokens.some((t, i) => t.state !== aTokens[i].state);

    setPTokens(newTokens);
    setATokens(newATokens);
    setSelectMode(false);
    setMovableIds([]);

    if (captured) {
      setMessage(`Dapat ${diceVal}! Token AI tertangkap! 🎯`);
      toast({ title: "🎯 Tangkap!", description: "Token AI kembali ke base!" });
    } else {
      const moved = newTokens.find(t => t.id === tokenId)!;
      setMessage(`Dapat ${diceVal}! Token ${tokenId + 1} ${moved.state === "finished" ? "sampai! ✅" : "bergerak."}`);
    }

    if (checkWin(newTokens)) {
      setWinner("player");
      setMessage("🎉 Kamu MENANG!");
      setRolling(false);
      const vid = localStorage.getItem("balance_visitor_id") || getVisitorId();
      updateGameStats(vid, "ludo", true, 50);
      return;
    }

    if (diceVal === 6) {
      setMessage(prev => prev + " Dapat 6, lempar lagi! 🎲");
      setRolling(false);
      return;
    }

    setRolling(false);
    setIsPlayerTurn(false);
    aiTurn(newTokens, newATokens);
  };

  const handleRoll = useCallback(() => {
    if (rolling || winner || !isPlayerTurn || selectMode) return;
    setRolling(true);
    setRollAnim(true);

    let count = 0;
    const anim = setInterval(() => {
      setDice(rollDiceVal());
      count++;
      if (count >= 10) {
        clearInterval(anim);
        const d = rollDiceVal();
        setDice(d);
        setRollAnim(false);

        const movable = pTokens.filter(t => canMove(t, d)).map(t => t.id);
        if (movable.length === 0) {
          setMessage(`Dapat ${d}. Tidak ada token yang bisa bergerak.`);
          setRolling(false);
          setIsPlayerTurn(false);
          aiTurn();
          return;
        }
        if (movable.length === 1) {
          executeMove(movable[0], d);
        } else {
          setMovableIds(movable);
          setSelectMode(true);
          setMessage(`Dapat ${d}! Pilih token yang mau digerakkan.`);
          setRolling(false);
        }
      }
    }, 80);
  }, [rolling, winner, isPlayerTurn, selectMode, pTokens, aTokens]);

  const aiTurn = (currentPTokens?: Token[], currentATokens?: Token[]) => {
    const pt = currentPTokens || pTokens;
    const at = currentATokens || aTokens;

    timeoutRef.current = setTimeout(() => {
      const d = rollDiceVal();
      setDice(d);

      const movable = at.filter(t => canMove(t, d));
      if (movable.length === 0) {
        setMessage(`AI dapat ${d}. Tidak bisa bergerak. Giliran kamu!`);
        setIsPlayerTurn(true);
        return;
      }

      // AI: prefer exiting base, then furthest token
      const chosen = movable.sort((a, b) => {
        if (a.state === "base") return -1;
        if (b.state === "base") return 1;
        if (a.state === "home" && b.state !== "home") return -1;
        return b.trackPos - a.trackPos;
      })[0];

      const newAt = at.map(t => t.id === chosen.id ? doMove(t, d) : t);
      const newPt = checkCapture(newAt, pt, TRACK_LENGTH / 2);
      const captured = newPt.some((t, i) => t.state !== pt[i].state);

      setATokens(newAt);
      setPTokens(newPt);

      if (captured) {
        setMessage(`AI dapat ${d}! Token kamu tertangkap! 😱`);
        toast({ title: "😱 Tertangkap!", description: "Token kamu kembali ke base!", variant: "destructive" });
      } else {
        setMessage(`AI dapat ${d}. Giliran kamu!`);
      }

      if (checkWin(newAt)) {
        setWinner("ai");
        setMessage("😢 AI menang! Coba lagi.");
        const vid = localStorage.getItem("balance_visitor_id") || getVisitorId();
        updateGameStats(vid, "ludo", false, 0);
        return;
      }

      if (d === 6) {
        setMessage(`AI dapat 6, lempar lagi!`);
        setTimeout(() => aiTurn(newPt, newAt), 1200);
        return;
      }

      setIsPlayerTurn(true);
    }, 1200);
  };

  const resetGame = () => {
    setPTokens(createTokens()); setATokens(createTokens());
    setDice(1); setIsPlayerTurn(true); setRolling(false); setWinner(null);
    setMessage("Lempar dadu untuk mulai! Dapat 6 untuk keluar base.");
    setSelectMode(false); setMovableIds([]);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-600 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-400 border-2 border-white flex items-center justify-center text-xs font-black">K</div>
            <span className="font-extrabold text-sm">Kamu</span>
          </div>
          <span className="text-xs font-bold opacity-80">{isPlayerTurn ? "Giliran Kamu" : "Giliran AI"}</span>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm">AI</span>
            <div className="w-8 h-8 rounded-full bg-red-400 border-2 border-white flex items-center justify-center text-xs font-black">AI</div>
          </div>
        </div>
        <div className="bg-white/20 rounded-lg p-2">
          <p className="text-xs text-center font-medium">{message}</p>
        </div>
      </div>

      {/* Token Progress */}
      <div className="bg-card rounded-2xl border p-4 space-y-3">
        <TokenProgress tokens={pTokens} color="bg-blue-500" label="🔵 Token Kamu" />
        <div className="border-t pt-3">
          <TokenProgress tokens={aTokens} color="bg-red-500" label="🔴 Token AI" />
        </div>
      </div>

      {/* Token Selection */}
      {selectMode && (
        <div className="bg-primary/5 border-2 border-primary/30 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-center">Pilih token yang mau digerakkan:</p>
          <div className="flex items-center justify-center gap-3">
            {movableIds.map(id => (
              <motion.button
                key={id}
                whileTap={{ scale: 0.9 }}
                className="w-14 h-14 rounded-2xl bg-blue-500 text-white font-black text-lg flex items-center justify-center shadow-lg border-2 border-blue-300"
                onClick={() => executeMove(id, dice)}
              >
                {id + 1}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Dice */}
      <div className="bg-card rounded-2xl border p-4 flex items-center justify-center">
        <DiceFace value={dice} size={64} color="#1e293b" rolling={rollAnim} />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <Button
          className="flex-1 h-14 font-extrabold text-base gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg"
          onClick={handleRoll}
          disabled={rolling || !!winner || !isPlayerTurn || selectMode}
        >
          {rolling ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Melempar...</>
          ) : !isPlayerTurn ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Giliran AI...</>
          ) : selectMode ? (
            "Pilih Token ☝️"
          ) : (
            <>🎲 Lempar Dadu</>
          )}
        </Button>
        <Button variant="outline" onClick={resetGame} className="h-14 w-14 rounded-2xl">
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {/* Rules */}
      <div className="bg-muted/30 rounded-xl p-3 text-[10px] text-muted-foreground space-y-1">
        <p className="font-bold text-xs">📖 Cara Main:</p>
        <p>• Dapat <strong>6</strong> untuk mengeluarkan token dari base</p>
        <p>• Dapat <strong>6</strong> mendapat giliran lempar lagi</p>
        <p>• Token yang mendarat di posisi lawan akan menangkap & mengembalikan ke base</p>
        <p>• Semua token sampai finish = MENANG! 🏆</p>
      </div>

      {/* Winner */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-card w-full max-w-xs rounded-3xl p-8 text-center space-y-4 shadow-2xl"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Trophy className={`w-16 h-16 mx-auto ${winner === "player" ? "text-yellow-500" : "text-red-500"}`} />
              </motion.div>
              <h3 className="text-2xl font-black">
                {winner === "player" ? "🎉 Kamu Menang!" : "😢 AI Menang!"}
              </h3>
              <Button onClick={resetGame} className="w-full h-12 font-bold gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white">
                <RotateCcw className="w-4 h-4" /> Main Lagi
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
