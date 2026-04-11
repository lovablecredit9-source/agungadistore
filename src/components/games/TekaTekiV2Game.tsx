import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Lightbulb, Check, X, Zap, Timer, Trophy, Star, ChevronDown, Puzzle, Delete } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog, RevealAnswerButton } from "./GameCredits";
import { useToast } from "@/hooks/use-toast";
import {
  loadGameData, addPoints, getPointsForQuestion,
  getCurrentLevelThreshold, getNextLevelThreshold,
  DIFFICULTIES, type Difficulty, type GameLevel,
} from "./gameStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

const buildKeyboardLetters = (rawAnswer: string) => {
  const answerLetters = rawAnswer
    .toUpperCase()
    .split("")
    .filter((letter) => /^[A-Z]$/.test(letter));

  const duplicateCounts = answerLetters.reduce<Record<string, number>>((acc, letter) => {
    acc[letter] = (acc[letter] || 0) + 1;
    return acc;
  }, {});

  const extras = Object.entries(duplicateCounts).flatMap(([letter, count]) =>
    Array.from({ length: Math.max(0, count - 1) }, () => letter),
  );

  return [...KEYBOARD_ROWS.join(""), ...extras];
};

export default function TekaTekiV2Game() {
  const activeVisitorId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("balance_visitor_id") || getVisitorId();
  }, []);
  const { credits, isUnlimited, fetchCredits, useCredit } = useGameCredits(activeVisitorId);
  const [riddle, setRiddle] = useState("");
  const [answer, setAnswer] = useState("");
  const [scrambledLetters, setScrambledLetters] = useState<string[]>([]);
  const [selectedLetters, setSelectedLetters] = useState<{ letter: string; fromIndex: number }[]>([]);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());
  const [hints, setHints] = useState<string[]>([]);
  const [revealedHints, setRevealedHints] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("sedang");
  const [playerData, setPlayerData] = useState<GameLevel>(loadGameData);
  const [timeLeft, setTimeLeft] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const diffConfig = DIFFICULTIES.find(d => d.key === difficulty)!;
  const MAX_WRONG = 3;
  const keyboardRows = useMemo(() => {
    const baseRows = [10, 9, 7].map((length, index) => {
      const start = index === 0 ? 0 : index === 1 ? 10 : 19;
      return scrambledLetters.slice(start, start + length);
    }).filter((row) => row.length > 0);

    const extraLetters = scrambledLetters.slice(26);
    return extraLetters.length > 0 ? [...baseRows, extraLetters] : baseRows;
  }, [scrambledLetters]);

  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setResult("wrong");
            setGameActive(false);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [gameActive, timeLeft > 0]);

  const fetchPuzzle = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setSelectedLetters([]);
    setUsedIndices(new Set());
    setRevealedHints(0);
    setWrongCount(0);
    setEarnedPoints(0);
    setAnswerRevealed(false);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const { data, error } = await supabase.functions.invoke("teka-teki-v2", {
        body: { difficulty },
      });
      if (error) throw error;
      const nextAnswer = (data.answer || "").toUpperCase().trim();
      setRiddle(data.riddle || "");
      setAnswer(nextAnswer);
      setScrambledLetters(buildKeyboardLetters(nextAnswer));
      setHints(data.hints || []);
      setExplanation(data.explanation || "");
      setGameActive(true);
      setTimeLeft(diffConfig.timeSeconds);
      setQuestionNumber(n => n + 1);
    } catch (e: any) {
      toast({ title: "Gagal memuat teka-teki", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [difficulty, diffConfig.timeSeconds, toast]);

  const selectLetter = (letter: string, index: number) => {
    if (usedIndices.has(index) || !gameActive) return;
    const newSelected = [...selectedLetters, { letter, fromIndex: index }];
    const newUsed = new Set(usedIndices);
    newUsed.add(index);
    setSelectedLetters(newSelected);
    setUsedIndices(newUsed);

    // Auto-check when length matches answer
    if (newSelected.length === answer.length) {
      const guess = newSelected.map(s => s.letter).join("");
      setTimeout(() => {
        if (guess === answer) {
          if (timerRef.current) clearInterval(timerRef.current);
          setResult("correct");
          setGameActive(false);
          const pts = getPointsForQuestion(questionNumber);
          setEarnedPoints(pts);
          const updated = addPoints(pts);
          setPlayerData(updated);
          setTimeout(() => fetchPuzzle(), 2000);
        } else {
          const newWrong = wrongCount + 1;
          setWrongCount(newWrong);
          // Reset selected letters
          setSelectedLetters([]);
          setUsedIndices(new Set());
          if (newWrong >= MAX_WRONG) {
            if (timerRef.current) clearInterval(timerRef.current);
            setResult("wrong");
            setGameActive(false);
          } else {
            setResult("wrong");
            setTimeout(() => setResult(null), 1200);
          }
        }
      }, 300);
    }
  };

  const removeLast = () => {
    if (selectedLetters.length === 0 || !gameActive) return;
    const last = selectedLetters[selectedLetters.length - 1];
    const newUsed = new Set(usedIndices);
    newUsed.delete(last.fromIndex);
    setSelectedLetters(selectedLetters.slice(0, -1));
    setUsedIndices(newUsed);
  };

  const revealHint = () => {
    if (revealedHints < hints.length) setRevealedHints(r => r + 1);
  };

  const handleRevealAnswer = async () => {
    const ok = await useCredit();
    if (ok) {
      setAnswerRevealed(true);
      // Auto-fill the answer
      const answerLetters = answer.split("");
      const newSelected: typeof selectedLetters = [];
      const newUsed = new Set<number>();
      for (const al of answerLetters) {
        const idx = scrambledLetters.findIndex((l, i) => l === al && !newUsed.has(i));
        if (idx >= 0) {
          newSelected.push({ letter: al, fromIndex: idx });
          newUsed.add(idx);
        }
      }
      setSelectedLetters(newSelected);
      setUsedIndices(newUsed);
      fetchCredits();
    }
  };

  const levelProgress = playerData.totalPoints - getCurrentLevelThreshold(playerData.level);
  const levelRange = getNextLevelThreshold(playerData.level) - getCurrentLevelThreshold(playerData.level);
  const progressPct = Math.min(100, (levelProgress / levelRange) * 100);

  if (!riddle && !loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-r from-teal-500/10 to-cyan-500/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" /> Level {playerData.level}
            </span>
            <span className="text-[10px] text-muted-foreground">{playerData.totalPoints} pts</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} />
          <BuyCreditsDialog visitorId={activeVisitorId} onPurchased={fetchCredits} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Kesulitan:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                {diffConfig.label} <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {DIFFICULTIES.map(d => (
                <DropdownMenuItem key={d.key} onClick={() => setDifficulty(d.key)}>
                  <span className={d.color}>{d.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button onClick={fetchPuzzle} className="w-full gap-2" size="lg">
          <Puzzle className="w-5 h-5" /> Mulai Teka-Teki v2!
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-500" /> Lv.{playerData.level}
        </span>
        <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-primary" /> #{questionNumber}</span>
        {gameActive && (
          <span className={`flex items-center gap-1 font-mono font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : ""}`}>
            <Timer className="w-3 h-3" /> {timeLeft}s
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">AI sedang membuat puzzle...</span>
        </div>
      ) : (
        <>
          {/* Riddle */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border p-4">
            <p className="text-sm font-semibold leading-relaxed text-center">{riddle}</p>
          </motion.div>

          {/* Answer slots */}
          <div className="flex justify-center gap-1.5 flex-wrap">
            {Array.from({ length: answer.length }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center font-extrabold text-lg transition-all ${
                  selectedLetters[i]
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-muted/50 border-muted-foreground/30"
                }`}
                animate={selectedLetters[i] ? { scale: [1, 1.1, 1] } : {}}
              >
                {selectedLetters[i]?.letter || ""}
              </motion.div>
            ))}
            {gameActive && selectedLetters.length > 0 && (
              <Button variant="ghost" size="sm" onClick={removeLast} className="h-12 w-10 p-0">
                <Delete className="w-5 h-5 text-muted-foreground" />
              </Button>
            )}
          </div>

          {/* Scrambled letter tiles */}
          {gameActive && (
            <div className="space-y-2">
              {keyboardRows.map((row, rowIndex) => {
                const rowStartIndex = rowIndex === 0 ? 0 : rowIndex === 1 ? 10 : rowIndex === 2 ? 19 : 26;

                return (
                  <div key={rowIndex} className="flex flex-wrap justify-center gap-2">
                    {row.map((letter, letterIndex) => {
                      const absoluteIndex = rowStartIndex + letterIndex;

                      return (
                        <motion.button
                          key={`${rowIndex}-${absoluteIndex}-${letter}`}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => selectLetter(letter, absoluteIndex)}
                          disabled={usedIndices.has(absoluteIndex)}
                          className={`w-11 h-11 rounded-xl font-extrabold text-base shadow-md transition-all ${
                            usedIndices.has(absoluteIndex)
                              ? "bg-muted/30 text-muted-foreground/30 cursor-default shadow-none"
                              : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white hover:from-blue-400 hover:to-indigo-500 active:shadow-inner"
                          }`}
                        >
                          {letter}
                        </motion.button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hints */}
          {hints.length > 0 && (
            <div className="space-y-1">
              {hints.slice(0, revealedHints).map((h, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className="text-xs bg-yellow-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Lightbulb className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                  <span>{h}</span>
                </motion.div>
              ))}
              {revealedHints < hints.length && gameActive && (
                <Button variant="ghost" size="sm" onClick={revealHint} className="text-xs gap-1">
                  <Lightbulb className="w-3 h-3" /> Petunjuk ({revealedHints}/{hints.length})
                </Button>
              )}
            </div>
          )}

          {/* Wrong count */}
          {wrongCount > 0 && gameActive && (
            <p className="text-xs text-muted-foreground text-center">Salah: {wrongCount}/{MAX_WRONG}</p>
          )}

          {/* Results */}
          <AnimatePresence>
            {result === "correct" && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 text-center space-y-2">
                <Check className="w-8 h-8 text-green-500 mx-auto" />
                <p className="font-extrabold text-green-600">Benar! 🎉</p>
                {explanation && <p className="text-xs text-muted-foreground">{explanation}</p>}
                <p className="text-xs font-semibold text-green-600">+{earnedPoints} poin!</p>
              </motion.div>
            )}
            {result === "wrong" && !gameActive && wrongCount >= MAX_WRONG && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-center space-y-2">
                <X className="w-8 h-8 text-red-500 mx-auto" />
                <p className="font-bold text-red-600">Game Over!</p>
                <p className="text-sm font-bold">Jawaban: <span className="text-primary">{answer}</span></p>
                {explanation && <p className="text-xs text-muted-foreground">{explanation}</p>}
                <Button onClick={fetchPuzzle} className="gap-2 mt-2" size="sm">
                  <RefreshCw className="w-4 h-4" /> Soal Baru
                </Button>
              </motion.div>
            )}
            {result === "wrong" && !gameActive && timeLeft <= 0 && wrongCount < MAX_WRONG && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-4 text-center space-y-2">
                <Timer className="w-8 h-8 text-orange-500 mx-auto" />
                <p className="font-bold text-orange-600">Waktu Habis!</p>
                <p className="text-sm font-bold">Jawaban: <span className="text-primary">{answer}</span></p>
                <Button onClick={fetchPuzzle} className="gap-2 mt-2" size="sm">
                  <RefreshCw className="w-4 h-4" /> Soal Baru
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {gameActive && !answerRevealed && (
            <div className="flex justify-center">
              <RevealAnswerButton credits={credits} isUnlimited={isUnlimited} onReveal={handleRevealAnswer} visitorId={activeVisitorId} useCredit={useCredit} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
