import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw, Trophy, Loader2 } from "lucide-react";

const DiceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

// Simplified Ludo: 2 players (Player vs AI), each has 2 tokens
// Track is 28 cells around the board, home stretch 4 cells each
const TRACK_LENGTH = 28;
const HOME_STRETCH = 4;
const TOTAL = TRACK_LENGTH + HOME_STRETCH;

// Player starts at 0, AI starts at 14 (opposite side)
const PLAYER_START = 0;
const AI_START = 14;

interface Token {
  id: number;
  pos: number; // -1 = base, 0..27 = track, 28..31 = home stretch, 32 = finished
  isFinished: boolean;
}

function createTokens(): Token[] {
  return [
    { id: 0, pos: -1, isFinished: false },
    { id: 1, pos: -1, isFinished: false },
  ];
}

function canMoveToken(token: Token, dice: number, startOffset: number): boolean {
  if (token.isFinished) return false;
  if (token.pos === -1) return dice === 6;
  const absPos = token.pos;
  const newPos = absPos + dice;
  if (newPos > TOTAL) return false;
  return true;
}

function moveToken(token: Token, dice: number, startOffset: number): Token {
  if (token.pos === -1 && dice === 6) {
    return { ...token, pos: 0 };
  }
  const newPos = token.pos + dice;
  if (newPos >= TOTAL) {
    return { ...token, pos: TOTAL, isFinished: true };
  }
  return { ...token, pos: newPos };
}

// Convert logical position to visual grid coordinates (7x7 Ludo-like)
function getTokenVisualPos(pos: number, startOffset: number): { x: number; y: number } {
  // Simplified: positions around a square track
  const trackPositions: { x: number; y: number }[] = [];

  // Bottom row (left to right): 0-6
  for (let i = 0; i <= 6; i++) trackPositions.push({ x: i, y: 6 });
  // Right col (bottom to top): 7-13
  for (let i = 5; i >= 0; i--) trackPositions.push({ x: 6, y: i });
  // Top row (right to left): 14-20
  for (let i = 5; i >= 0; i--) trackPositions.push({ x: i, y: 0 });
  // Left col (top to bottom): 21-27
  for (let i = 1; i <= 6; i++) trackPositions.push({ x: 0, y: i });

  const actualPos = (pos + startOffset) % TRACK_LENGTH;
  if (pos >= 0 && pos < TRACK_LENGTH) {
    return trackPositions[actualPos];
  }

  // Home stretch (center path)
  const homeIndex = pos - TRACK_LENGTH;
  if (startOffset === PLAYER_START) {
    return { x: 1 + homeIndex, y: 3 };
  } else {
    return { x: 5 - homeIndex, y: 3 };
  }
}

export default function LudoGame() {
  const [playerTokens, setPlayerTokens] = useState<Token[]>(createTokens());
  const [aiTokens, setAiTokens] = useState<Token[]>(createTokens());
  const [dice, setDice] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [rollAnim, setRollAnim] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);
  const [message, setMessage] = useState("Lempar dadu untuk mulai!");
  const [selectingToken, setSelectingToken] = useState(false);
  const [movableTokenIds, setMovableTokenIds] = useState<number[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rollDice = () => Math.floor(Math.random() * 6) + 1;

  const checkWin = (tokens: Token[]): boolean => tokens.every(t => t.isFinished);

  const checkCapture = (movedTokens: Token[], opponentTokens: Token[], startOffset: number, oppStartOffset: number): Token[] => {
    // Check if moved token captures opponent's token (same track position converted to absolute)
    const updated = [...opponentTokens];
    for (const mt of movedTokens) {
      if (mt.pos < 0 || mt.pos >= TRACK_LENGTH || mt.isFinished) continue;
      const mtAbs = (mt.pos + startOffset) % TRACK_LENGTH;
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].pos < 0 || updated[i].pos >= TRACK_LENGTH || updated[i].isFinished) continue;
        const oppAbs = (updated[i].pos + oppStartOffset) % TRACK_LENGTH;
        if (mtAbs === oppAbs) {
          updated[i] = { ...updated[i], pos: -1 };
        }
      }
    }
    return updated;
  };

  const handleRoll = useCallback(() => {
    if (rolling || winner || !isPlayerTurn || selectingToken) return;
    setRolling(true);
    setRollAnim(true);

    let count = 0;
    const anim = setInterval(() => {
      setDice(rollDice());
      count++;
      if (count >= 8) {
        clearInterval(anim);
        const d = rollDice();
        setDice(d);
        setRollAnim(false);

        // Check which tokens can move
        const movable = playerTokens
          .filter(t => canMoveToken(t, d, PLAYER_START))
          .map(t => t.id);

        if (movable.length === 0) {
          setMessage(`Dapat ${d}. Tidak ada token yang bisa bergerak.`);
          setRolling(false);
          setIsPlayerTurn(false);
          aiTurn();
          return;
        }

        if (movable.length === 1) {
          executePlayerMove(movable[0], d);
        } else {
          setMovableTokenIds(movable);
          setSelectingToken(true);
          setMessage(`Dapat ${d}! Pilih token yang mau digerakkan.`);
          setRolling(false);
        }
      }
    }, 100);
  }, [rolling, winner, isPlayerTurn, selectingToken, playerTokens, aiTokens]);

  const executePlayerMove = (tokenId: number, diceVal: number) => {
    const newTokens = playerTokens.map(t =>
      t.id === tokenId ? moveToken(t, diceVal, PLAYER_START) : t
    );
    
    // Check captures
    const newAiTokens = checkCapture(newTokens, aiTokens, PLAYER_START, AI_START);
    const captured = newAiTokens.some((t, i) => t.pos !== aiTokens[i].pos);
    
    setPlayerTokens(newTokens);
    setAiTokens(newAiTokens);
    setSelectingToken(false);
    setMovableTokenIds([]);

    if (captured) {
      setMessage(`Dapat ${diceVal}! Token AI tertangkap! 🎯`);
    } else {
      setMessage(`Dapat ${diceVal}! Token bergerak.`);
    }

    if (checkWin(newTokens)) {
      setWinner("player");
      setMessage("🎉 Kamu menang!");
      setRolling(false);
      return;
    }

    // Extra turn on 6
    if (diceVal === 6) {
      setMessage(prev => prev + " Dapat 6, lempar lagi!");
      setRolling(false);
      return;
    }

    setRolling(false);
    setIsPlayerTurn(false);
    aiTurn(newTokens, newAiTokens);
  };

  const selectToken = (tokenId: number) => {
    if (!movableTokenIds.includes(tokenId)) return;
    executePlayerMove(tokenId, dice);
  };

  const aiTurn = (currentPlayerTokens?: Token[], currentAiTokens?: Token[]) => {
    const pt = currentPlayerTokens || playerTokens;
    const at = currentAiTokens || aiTokens;

    timeoutRef.current = setTimeout(() => {
      const d = rollDice();
      setDice(d);

      const movable = at.filter(t => canMoveToken(t, d, AI_START));
      if (movable.length === 0) {
        setMessage(`AI dapat ${d}. Tidak bisa bergerak. Giliran kamu!`);
        setIsPlayerTurn(true);
        return;
      }

      // AI strategy: prefer moving token closest to finish, or exiting base
      const chosen = movable.sort((a, b) => {
        if (a.pos === -1) return -1; // prefer getting out
        return b.pos - a.pos; // prefer furthest along
      })[0];

      const newAiTokens = at.map(t =>
        t.id === chosen.id ? moveToken(t, d, AI_START) : t
      );

      // Check captures
      const newPlayerTokens = checkCapture(newAiTokens, pt, AI_START, PLAYER_START);
      const captured = newPlayerTokens.some((t, i) => t.pos !== pt[i].pos);

      setAiTokens(newAiTokens);
      setPlayerTokens(newPlayerTokens);

      if (captured) {
        setMessage(`AI dapat ${d}! Token kamu tertangkap! 😱 Giliran kamu!`);
      } else {
        setMessage(`AI dapat ${d}. Giliran kamu!`);
      }

      if (checkWin(newAiTokens)) {
        setWinner("ai");
        setMessage("😢 AI menang! Coba lagi.");
        return;
      }

      if (d === 6) {
        setMessage(`AI dapat 6, lempar lagi!`);
        // AI gets another turn
        setTimeout(() => aiTurn(newPlayerTokens, newAiTokens), 1000);
        return;
      }

      setIsPlayerTurn(true);
    }, 1200);
  };

  const resetGame = () => {
    setPlayerTokens(createTokens());
    setAiTokens(createTokens());
    setDice(0);
    setIsPlayerTurn(true);
    setRolling(false);
    setWinner(null);
    setMessage("Lempar dadu untuk mulai!");
    setSelectingToken(false);
    setMovableTokenIds([]);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const DiceIcon = dice > 0 ? DiceIcons[dice - 1] : Dice1;

  // Render a simplified board
  const GRID = 7;
  const boardCells: { x: number; y: number; type: "track" | "center" | "base" }[][] = [];
  for (let y = 0; y < GRID; y++) {
    const row: typeof boardCells[0] = [];
    for (let x = 0; x < GRID; x++) {
      const isEdge = x === 0 || x === GRID - 1 || y === 0 || y === GRID - 1;
      const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      row.push({ x, y, type: isEdge ? "track" : isCenter ? "center" : "base" });
    }
    boardCells.push(row);
  }

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="bg-muted/50 rounded-xl p-3 text-center">
        <p className="text-sm font-bold">{message}</p>
        <div className="flex items-center justify-center gap-6 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Kamu: {playerTokens.filter(t => t.isFinished).length}/2</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span>AI: {aiTokens.filter(t => t.isFinished).length}/2</span>
          </div>
        </div>
      </div>

      {/* Simplified Board */}
      <div className="bg-card rounded-xl border p-2">
        <div className="grid grid-cols-7 gap-[2px]" style={{ aspectRatio: "1" }}>
          {boardCells.flat().map((cell, i) => {
            const isTrack = cell.type === "track";
            const isCenter = cell.type === "center";

            // Find tokens on this cell
            const pHere = playerTokens.filter(t => {
              if (t.pos < 0 || t.isFinished) return false;
              const vis = getTokenVisualPos(t.pos, PLAYER_START);
              return vis.x === cell.x && vis.y === cell.y;
            });
            const aHere = aiTokens.filter(t => {
              if (t.pos < 0 || t.isFinished) return false;
              const vis = getTokenVisualPos(t.pos, AI_START);
              return vis.x === cell.x && vis.y === cell.y;
            });

            const isSelectable = selectingToken && pHere.some(t => movableTokenIds.includes(t.id));

            return (
              <div
                key={i}
                className={`relative flex items-center justify-center rounded-sm aspect-square ${
                  isTrack ? "bg-muted/50 border border-border/30" :
                  isCenter ? "bg-primary/5" : "bg-muted/20"
                } ${isSelectable ? "ring-2 ring-primary cursor-pointer animate-pulse" : ""}`}
                onClick={() => {
                  if (isSelectable) {
                    const tokenToSelect = pHere.find(t => movableTokenIds.includes(t.id));
                    if (tokenToSelect) selectToken(tokenToSelect.id);
                  }
                }}
              >
                {pHere.map((t, j) => (
                  <motion.div
                    key={`p${t.id}`}
                    className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-md z-10"
                    layoutId={`p${t.id}`}
                    style={{ position: pHere.length > 1 ? "absolute" : undefined, left: j === 0 ? "20%" : "50%" }}
                  />
                ))}
                {aHere.map((t, j) => (
                  <motion.div
                    key={`a${t.id}`}
                    className="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-md z-10"
                    layoutId={`a${t.id}`}
                    style={{ position: aHere.length > 1 ? "absolute" : undefined, right: j === 0 ? "20%" : "50%" }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Base tokens */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Base Kamu:</span>
          {playerTokens.filter(t => t.pos === -1).map(t => (
            <span key={t.id} className="w-4 h-4 rounded-full bg-blue-500/50 border inline-block" />
          ))}
          {playerTokens.filter(t => t.pos === -1).length === 0 && <span className="text-[10px] text-muted-foreground">-</span>}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Base AI:</span>
          {aiTokens.filter(t => t.pos === -1).map(t => (
            <span key={t.id} className="w-4 h-4 rounded-full bg-red-500/50 border inline-block" />
          ))}
          {aiTokens.filter(t => t.pos === -1).length === 0 && <span className="text-[10px] text-muted-foreground">-</span>}
        </div>
      </div>

      {/* Dice & Controls */}
      <div className="flex items-center justify-center gap-4">
        <motion.div animate={rollAnim ? { rotate: [0, 360], scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3, repeat: rollAnim ? Infinity : 0 }}>
          <DiceIcon className="w-12 h-12 text-primary" />
        </motion.div>
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1 h-12 font-bold gap-2"
          onClick={handleRoll}
          disabled={rolling || !!winner || !isPlayerTurn || selectingToken}
        >
          {rolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <DiceIcon className="w-5 h-5" />}
          {selectingToken ? "Pilih Token..." : rolling ? "Melempar..." : "Lempar Dadu"}
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
