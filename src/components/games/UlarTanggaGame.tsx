import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw, Trophy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BOARD_SIZE = 100;
const COLS = 10;

// Snakes (head -> tail) and Ladders (bottom -> top)
const SNAKES: Record<number, number> = {
  99: 54, 95: 75, 92: 73, 87: 24, 64: 60, 62: 19, 49: 11, 46: 25, 16: 6,
};
const LADDERS: Record<number, number> = {
  2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98, 80: 100,
};

const DiceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

function getRowCol(pos: number): { row: number; col: number } {
  if (pos <= 0) return { row: 9, col: 0 };
  const p = pos - 1;
  const row = 9 - Math.floor(p / COLS);
  const fromRight = Math.floor(p / COLS) % 2 === 1;
  const col = fromRight ? (COLS - 1 - (p % COLS)) : (p % COLS);
  return { row, col };
}

export default function UlarTanggaGame() {
  const [playerPos, setPlayerPos] = useState(0);
  const [aiPos, setAiPos] = useState(0);
  const [currentDice, setCurrentDice] = useState(0);
  const [aiDice, setAiDice] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);
  const [message, setMessage] = useState("Giliran kamu! Lempar dadu.");
  const [rollAnim, setRollAnim] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const rollDice = () => Math.floor(Math.random() * 6) + 1;

  const movePlayer = useCallback((pos: number, dice: number): number => {
    let newPos = pos + dice;
    if (newPos > BOARD_SIZE) return pos; // must land exactly
    if (newPos === BOARD_SIZE) return BOARD_SIZE;
    if (SNAKES[newPos]) {
      return SNAKES[newPos];
    }
    if (LADDERS[newPos]) {
      return LADDERS[newPos];
    }
    return newPos;
  }, []);

  const handleRoll = useCallback(() => {
    if (rolling || winner || !isPlayerTurn) return;
    setRolling(true);
    setRollAnim(true);

    // Animate dice
    let count = 0;
    const animInterval = setInterval(() => {
      setCurrentDice(rollDice());
      count++;
      if (count >= 8) {
        clearInterval(animInterval);
        const dice = rollDice();
        setCurrentDice(dice);
        setRollAnim(false);

        const newPos = movePlayer(playerPos, dice);
        setPlayerPos(newPos);

        if (newPos !== playerPos + dice && SNAKES[playerPos + dice]) {
          setMessage(`Kamu dapat ${dice}! Terkena ular 🐍 turun ke ${newPos}`);
        } else if (newPos !== playerPos + dice && LADDERS[playerPos + dice]) {
          setMessage(`Kamu dapat ${dice}! Naik tangga 🪜 ke ${newPos}`);
        } else if (newPos === playerPos) {
          setMessage(`Kamu dapat ${dice}! Tapi tidak bisa maju (harus tepat 100)`);
        } else {
          setMessage(`Kamu dapat ${dice}! Maju ke kotak ${newPos}`);
        }

        if (newPos >= BOARD_SIZE) {
          setWinner("player");
          setMessage("🎉 Kamu menang!");
          setRolling(false);
          return;
        }

        setIsPlayerTurn(false);
        // AI turn after delay
        timeoutRef.current = setTimeout(() => {
          const aiDiceVal = rollDice();
          setAiDice(aiDiceVal);
          const aiNewPos = movePlayer(aiPos, aiDiceVal);
          setAiPos(aiNewPos);

          if (aiNewPos !== aiPos + aiDiceVal && SNAKES[aiPos + aiDiceVal]) {
            setMessage(`AI dapat ${aiDiceVal}! Terkena ular 🐍 turun ke ${aiNewPos}. Giliran kamu!`);
          } else if (aiNewPos !== aiPos + aiDiceVal && LADDERS[aiPos + aiDiceVal]) {
            setMessage(`AI dapat ${aiDiceVal}! Naik tangga 🪜 ke ${aiNewPos}. Giliran kamu!`);
          } else {
            setMessage(`AI dapat ${aiDiceVal}! Maju ke kotak ${aiNewPos}. Giliran kamu!`);
          }

          if (aiNewPos >= BOARD_SIZE) {
            setWinner("ai");
            setMessage("😢 AI menang! Coba lagi.");
          } else {
            setIsPlayerTurn(true);
          }
          setRolling(false);
        }, 1500);
      }
    }, 100);
  }, [rolling, winner, isPlayerTurn, playerPos, aiPos, movePlayer]);

  const resetGame = () => {
    setPlayerPos(0);
    setAiPos(0);
    setCurrentDice(0);
    setAiDice(0);
    setIsPlayerTurn(true);
    setWinner(null);
    setMessage("Giliran kamu! Lempar dadu.");
    setRolling(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  // Render board
  const cells: { num: number; row: number; col: number }[] = [];
  for (let num = 1; num <= BOARD_SIZE; num++) {
    const { row, col } = getRowCol(num);
    cells.push({ num, row, col });
  }

  const playerRC = getRowCol(playerPos || 0);
  const aiRC = getRowCol(aiPos || 0);

  const DiceIcon = currentDice > 0 ? DiceIcons[currentDice - 1] : Dice1;

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="bg-muted/50 rounded-xl p-3 text-center">
        <p className="text-sm font-bold">{message}</p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Kamu: {playerPos}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> AI: {aiPos}
          </span>
        </div>
      </div>

      {/* Board */}
      <div className="relative bg-card rounded-xl border p-1 overflow-hidden">
        <div className="grid grid-cols-10 gap-[1px]" style={{ aspectRatio: "1" }}>
          {Array.from({ length: BOARD_SIZE }).map((_, i) => {
            const num = BOARD_SIZE - Math.floor(i / COLS) * COLS - (Math.floor(i / COLS) % 2 === 0 ? (i % COLS) : (COLS - 1 - (i % COLS)));
            const r = Math.floor(i / COLS);
            const c = i % COLS;
            const isSnakeHead = SNAKES[num] !== undefined;
            const isLadderBottom = LADDERS[num] !== undefined;
            const isPlayer = playerPos === num && playerPos > 0;
            const isAI = aiPos === num && aiPos > 0;

            return (
              <div
                key={i}
                className={`relative flex items-center justify-center text-[7px] font-bold rounded-sm aspect-square ${
                  isSnakeHead ? "bg-red-500/20 text-red-600" :
                  isLadderBottom ? "bg-green-500/20 text-green-600" :
                  (r + c) % 2 === 0 ? "bg-muted/40" : "bg-muted/20"
                }`}
              >
                <span className="opacity-60">{num}</span>
                {isSnakeHead && <span className="absolute text-[8px] top-0 right-0">🐍</span>}
                {isLadderBottom && <span className="absolute text-[8px] top-0 right-0">🪜</span>}
                {isPlayer && (
                  <motion.div
                    className="absolute w-3 h-3 rounded-full bg-blue-500 border border-white shadow-lg z-10"
                    layoutId="player"
                    style={{ bottom: isAI ? "55%" : "25%" }}
                  />
                )}
                {isAI && (
                  <motion.div
                    className="absolute w-3 h-3 rounded-full bg-red-500 border border-white shadow-lg z-10"
                    layoutId="ai"
                    style={{ bottom: isPlayer ? "15%" : "25%" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dice & Controls */}
      <div className="flex items-center justify-center gap-4">
        <motion.div animate={rollAnim ? { rotate: [0, 360], scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3, repeat: rollAnim ? Infinity : 0 }}>
          <DiceIcon className="w-12 h-12 text-primary" />
        </motion.div>
        {aiDice > 0 && !isPlayerTurn && (() => {
          const AiDiceIcon = DiceIcons[aiDice - 1];
          return <AiDiceIcon className="w-10 h-10 text-red-500" />;
        })()}
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1 h-12 font-bold gap-2"
          onClick={handleRoll}
          disabled={rolling || !!winner || !isPlayerTurn}
        >
          {rolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <DiceIcon className="w-5 h-5" />}
          {rolling ? "Melempar..." : "Lempar Dadu"}
        </Button>
        <Button variant="outline" size="icon" onClick={resetGame} className="h-12 w-12">
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {/* Winner */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card rounded-2xl border p-6 text-center space-y-3"
          >
            <Trophy className={`w-12 h-12 mx-auto ${winner === "player" ? "text-yellow-500" : "text-red-500"}`} />
            <h3 className="text-xl font-extrabold">
              {winner === "player" ? "🎉 Kamu Menang!" : "😢 AI Menang!"}
            </h3>
            <Button onClick={resetGame} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Main Lagi
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
