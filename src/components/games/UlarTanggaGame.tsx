import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BOARD_SIZE = 100;
const COLS = 10;

const SNAKES: Record<number, number> = {
  99: 54, 95: 75, 92: 73, 87: 24, 64: 60, 62: 19, 49: 11, 46: 25, 16: 6,
};
const LADDERS: Record<number, number> = {
  2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98, 80: 100,
};

function DiceFace({ value, size = 64, color = "currentColor", rolling = false }: { value: number; size?: number; color?: string; rolling?: boolean }) {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };
  const dots = dotPositions[value] || dotPositions[1];
  const r = size < 50 ? 5 : 7;

  return (
    <motion.div
      animate={rolling ? { rotateX: [0, 360, 720], rotateY: [0, 360, 720], scale: [1, 1.2, 1] } : {}}
      transition={{ duration: 0.6, repeat: rolling ? Infinity : 0, ease: "easeInOut" }}
      style={{ width: size, height: size, perspective: 200 }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id="diceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <filter id="diceShadow">
            <feDropShadow dx="2" dy="3" stdDeviation="3" floodOpacity="0.3" />
          </filter>
        </defs>
        <rect x="5" y="5" width="90" height="90" rx="16" fill="url(#diceGrad)" stroke="#94a3b8" strokeWidth="2" filter="url(#diceShadow)" />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={color} />
        ))}
      </svg>
    </motion.div>
  );
}

function getCellColor(num: number): string {
  if (SNAKES[num]) return "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700";
  if (LADDERS[num]) return "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700";
  const row = Math.floor((num - 1) / COLS);
  const col = (num - 1) % COLS;
  if ((row + col) % 2 === 0) return "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800";
  return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
}

// Animate position step by step, calling onStep for each cell
function animateSteps(
  startPos: number,
  steps: number,
  delayMs: number,
  onStep: (pos: number) => void,
  onDone: (finalPos: number) => void
) {
  let current = startPos;
  let step = 0;

  function next() {
    step++;
    if (step > steps) {
      onDone(current);
      return;
    }
    current++;
    if (current > BOARD_SIZE) {
      // Can't move past 100
      onDone(startPos);
      return;
    }
    onStep(current);
    setTimeout(next, delayMs);
  }

  setTimeout(next, delayMs);
}

export default function UlarTanggaGame() {
  const [playerPos, setPlayerPos] = useState(0);
  const [aiPos, setAiPos] = useState(0);
  const [displayPlayerPos, setDisplayPlayerPos] = useState(0);
  const [displayAiPos, setDisplayAiPos] = useState(0);
  const [currentDice, setCurrentDice] = useState(1);
  const [aiDice, setAiDice] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);
  const [message, setMessage] = useState("Giliran kamu! Lempar dadu 🎲");
  const [rollAnim, setRollAnim] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const rollDice = () => Math.floor(Math.random() * 6) + 1;

  const STEP_DELAY = 350; // ms per step

  const handleRoll = useCallback(() => {
    if (rolling || animating || winner || !isPlayerTurn) return;
    setRolling(true);
    setRollAnim(true);

    let count = 0;
    const animInterval = setInterval(() => {
      setCurrentDice(rollDice());
      count++;
      if (count >= 10) {
        clearInterval(animInterval);
        const dice = rollDice();
        setCurrentDice(dice);
        setRollAnim(false);

        const rawNewPos = playerPos + dice;

        // Check if move is valid
        if (rawNewPos > BOARD_SIZE) {
          setMessage(`Dapat ${dice}! Tidak bisa maju (harus tepat 100)`);
          setRolling(false);
          setIsPlayerTurn(false);
          // AI turn after delay
          startAiTurn(playerPos, aiPos);
          return;
        }

        setAnimating(true);
        setMessage(`Dapat ${dice}! Maju...`);

        // Step-by-step animation
        animateSteps(playerPos, dice, STEP_DELAY, (stepPos) => {
          setDisplayPlayerPos(stepPos);
        }, (landedPos) => {
          // Check snake/ladder
          const finalPos = SNAKES[landedPos] ? SNAKES[landedPos] :
                           LADDERS[landedPos] ? LADDERS[landedPos] : landedPos;

          if (SNAKES[landedPos]) {
            setMessage(`Dapat ${dice}! 🐍 Ular! Turun ke ${finalPos}`);
            toast({ title: "🐍 Terkena Ular!", description: `Turun dari ${landedPos} ke ${finalPos}` });
            // Animate slide down after a short pause
            setTimeout(() => {
              setDisplayPlayerPos(finalPos);
              setPlayerPos(finalPos);
              finishPlayerTurn(finalPos);
            }, 500);
          } else if (LADDERS[landedPos]) {
            setMessage(`Dapat ${dice}! 🪜 Tangga! Naik ke ${finalPos}`);
            toast({ title: "🪜 Naik Tangga!", description: `Naik dari ${landedPos} ke ${finalPos}` });
            setTimeout(() => {
              setDisplayPlayerPos(finalPos);
              setPlayerPos(finalPos);
              finishPlayerTurn(finalPos);
            }, 500);
          } else {
            setMessage(`Dapat ${dice}! Maju ke kotak ${finalPos}`);
            setPlayerPos(finalPos);
            finishPlayerTurn(finalPos);
          }
        });
      }
    }, 80);
  }, [rolling, animating, winner, isPlayerTurn, playerPos, aiPos, toast]);

  function finishPlayerTurn(finalPos: number) {
    setAnimating(false);
    setRolling(false);

    if (finalPos >= BOARD_SIZE) {
      setWinner("player");
      setMessage("🎉 Kamu MENANG!");
      return;
    }

    setIsPlayerTurn(false);
    setMessage("⏳ Giliran AI...");
    // Start AI turn after 1 second
    startAiTurn(finalPos, aiPos);
  }

  function startAiTurn(currentPlayerPos: number, currentAiPos: number) {
    timeoutRef.current = setTimeout(() => {
      // AI rolls dice with animation
      setRollAnim(false);
      setMessage("🤖 AI melempar dadu...");

      let aiCount = 0;
      const aiAnimInterval = setInterval(() => {
        setAiDice(rollDice());
        aiCount++;
        if (aiCount >= 8) {
          clearInterval(aiAnimInterval);
          const aiDiceVal = rollDice();
          setAiDice(aiDiceVal);

          const aiRawPos = currentAiPos + aiDiceVal;

          if (aiRawPos > BOARD_SIZE) {
            setMessage(`AI dapat ${aiDiceVal}! Tidak bisa maju. Giliran kamu!`);
            setIsPlayerTurn(true);
            return;
          }

          setAnimating(true);
          setMessage(`AI dapat ${aiDiceVal}! Maju...`);

          // AI step-by-step
          animateSteps(currentAiPos, aiDiceVal, STEP_DELAY, (stepPos) => {
            setDisplayAiPos(stepPos);
          }, (landedPos) => {
            const finalAiPos = SNAKES[landedPos] ? SNAKES[landedPos] :
                               LADDERS[landedPos] ? LADDERS[landedPos] : landedPos;

            if (SNAKES[landedPos]) {
              setMessage(`AI dapat ${aiDiceVal}! 🐍 Ular turun ke ${finalAiPos}. Giliran kamu!`);
              setTimeout(() => {
                setDisplayAiPos(finalAiPos);
                setAiPos(finalAiPos);
                setAnimating(false);
                checkAiWin(finalAiPos);
              }, 500);
            } else if (LADDERS[landedPos]) {
              setMessage(`AI dapat ${aiDiceVal}! 🪜 Tangga naik ke ${finalAiPos}. Giliran kamu!`);
              setTimeout(() => {
                setDisplayAiPos(finalAiPos);
                setAiPos(finalAiPos);
                setAnimating(false);
                checkAiWin(finalAiPos);
              }, 500);
            } else {
              setMessage(`AI dapat ${aiDiceVal}, maju ke ${finalAiPos}. Giliran kamu!`);
              setAiPos(finalAiPos);
              setAnimating(false);
              checkAiWin(finalAiPos);
            }
          });
        }
      }, 80);
    }, 1000);
  }

  function checkAiWin(pos: number) {
    if (pos >= BOARD_SIZE) {
      setWinner("ai");
      setMessage("😢 AI menang! Coba lagi.");
    } else {
      setIsPlayerTurn(true);
    }
  }

  const resetGame = () => {
    setPlayerPos(0); setAiPos(0);
    setDisplayPlayerPos(0); setDisplayAiPos(0);
    setCurrentDice(1); setAiDice(0);
    setIsPlayerTurn(true); setWinner(null);
    setMessage("Giliran kamu! Lempar dadu 🎲");
    setRolling(false); setAnimating(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  // Sync display positions when not animating
  useEffect(() => {
    if (!animating) {
      setDisplayPlayerPos(playerPos);
      setDisplayAiPos(aiPos);
    }
  }, [playerPos, aiPos, animating]);

  const boardNums: number[] = [];
  for (let row = 0; row < 10; row++) {
    const rowNums: number[] = [];
    for (let col = 0; col < 10; col++) {
      const num = (9 - row) * 10 + (row % 2 === 1 ? col + 1 : 10 - col);
      rowNums.push(num);
    }
    boardNums.push(...rowNums);
  }

  return (
    <div className="space-y-3">
      {/* Score Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-400 border-2 border-white flex items-center justify-center text-xs font-black">K</div>
            <div>
              <p className="font-extrabold text-sm">Kamu</p>
              <p className="text-[10px] opacity-80">Kotak {playerPos}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold opacity-70">VS</p>
            <p className={`text-xs font-bold ${!isPlayerTurn && !winner ? "animate-pulse" : ""}`}>
              {animating ? "Berjalan..." : isPlayerTurn ? "Giliran Kamu" : "⏳ Giliran AI"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <p className="font-extrabold text-sm text-right">AI</p>
              <p className="text-[10px] opacity-80 text-right">Kotak {aiPos}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-red-400 border-2 border-white flex items-center justify-center text-xs font-black">AI</div>
          </div>
        </div>
        <div className="mt-2 bg-white/20 rounded-lg p-2">
          <p className="text-xs text-center font-medium">{message}</p>
        </div>
      </div>

      {/* Board */}
      <div className="bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-2xl border-2 border-amber-300 dark:border-amber-700 p-1.5 shadow-xl">
        <div className="grid grid-cols-10 gap-[2px]">
          {boardNums.map((num, i) => {
            const isSnakeHead = SNAKES[num] !== undefined;
            const isLadderBottom = LADDERS[num] !== undefined;
            const hasPlayer = displayPlayerPos === num && displayPlayerPos > 0;
            const hasAI = displayAiPos === num && displayAiPos > 0;
            const isFinish = num === 100;
            const isStart = num === 1;

            return (
              <div
                key={i}
                className={`relative flex items-center justify-center aspect-square rounded-[3px] border text-[7px] font-bold ${getCellColor(num)} ${
                  isFinish ? "!bg-yellow-300 dark:!bg-yellow-600 !border-yellow-500" : ""
                } ${isStart ? "!bg-green-300 dark:!bg-green-600 !border-green-500" : ""}`}
              >
                <span className={`${isSnakeHead || isLadderBottom ? "font-black" : "opacity-50"} ${
                  isFinish ? "text-yellow-800 dark:text-yellow-100" : ""
                }`}>
                  {num}
                </span>
                {isSnakeHead && <span className="absolute -top-0.5 -right-0.5 text-[9px] leading-none">🐍</span>}
                {isLadderBottom && <span className="absolute -top-0.5 -right-0.5 text-[9px] leading-none">🪜</span>}
                {isFinish && <span className="absolute -top-0.5 -right-0.5 text-[9px] leading-none">🏁</span>}

                {hasPlayer && (
                  <motion.div
                    className="absolute w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg z-20 flex items-center justify-center"
                    initial={false}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.25 }}
                    style={{ top: hasAI ? "-2px" : "50%", left: hasAI ? "-2px" : "50%", transform: hasAI ? undefined : "translate(-50%, -50%)" }}
                  >
                    <span className="text-[5px] text-white font-black">K</span>
                  </motion.div>
                )}
                {hasAI && (
                  <motion.div
                    className="absolute w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg z-20 flex items-center justify-center"
                    initial={false}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.25 }}
                    style={{ bottom: hasPlayer ? "-2px" : "50%", right: hasPlayer ? "-2px" : "50%", transform: hasPlayer ? undefined : "translate(50%, 50%)" }}
                  >
                    <span className="text-[5px] text-white font-black">AI</span>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px]">
        <span className="flex items-center gap-1">🐍 Ular (turun)</span>
        <span className="flex items-center gap-1">🪜 Tangga (naik)</span>
        <span className="flex items-center gap-1">🏁 Finish</span>
      </div>

      {/* Dice Area */}
      <div className="bg-card rounded-2xl border p-4">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground font-bold mb-1">Kamu</p>
            <DiceFace value={currentDice} size={56} color="#3b82f6" rolling={rollAnim} />
          </div>
          {aiDice > 0 && (
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground font-bold mb-1">AI</p>
              <DiceFace value={aiDice} size={56} color="#ef4444" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <Button
          className="flex-1 h-14 font-extrabold text-base gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg"
          onClick={handleRoll}
          disabled={rolling || animating || !!winner || !isPlayerTurn}
        >
          {rolling || animating ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Melempar...</>
          ) : !isPlayerTurn ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Giliran AI...</>
          ) : (
            <>🎲 Lempar Dadu</>
          )}
        </Button>
        <Button variant="outline" onClick={resetGame} className="h-14 w-14 rounded-2xl">
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {/* Winner Modal */}
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
              <p className="text-sm text-muted-foreground">
                {winner === "player" ? "Selamat! Kamu berhasil sampai di kotak 100!" : "AI lebih cepat kali ini. Coba lagi!"}
              </p>
              <Button onClick={resetGame} className="w-full h-12 font-bold gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                <RotateCcw className="w-4 h-4" /> Main Lagi
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
