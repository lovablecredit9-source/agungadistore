import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Check, X, Zap, Timer, Trophy, Star, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { updateGameStats } from "./GameProfile";
import { useGameCredits } from "./GameCredits";
import { useToast } from "@/hooks/use-toast";
import {
  loadGameData, awardGamePoints, getPointsForQuestion, getPointMultiplier,
  getLevelFromPoints, getNextLevelThreshold, getCurrentLevelThreshold,
  DIFFICULTIES, type Difficulty, type GameLevel,
} from "./gameStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_COLORS = [
  "from-blue-500 to-blue-600",
  "from-green-500 to-green-600",
  "from-yellow-500 to-orange-500",
  "from-pink-500 to-rose-600",
];

export default function PilihanGandaGame() {
  const activeVisitorId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("balance_visitor_id") || getVisitorId();
  }, []);
  const { credits, isUnlimited, fetchCredits, useCredit } = useGameCredits(activeVisitorId);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [streak, setStreak] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("sedang");
  const [playerData, setPlayerData] = useState<GameLevel>(loadGameData);
  const [timeLeft, setTimeLeft] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousQuestionsRef = useRef<string[]>([]);
  const { toast } = useToast();

  const diffConfig = DIFFICULTIES.find(d => d.key === difficulty)!;

  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setResult("wrong");
            setGameActive(false);
            setStreak(0);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [gameActive, timeLeft > 0]);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setSelectedIndex(null);
    setEarnedPoints(0);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const { data, error } = await supabase.functions.invoke("pilihan-ganda", {
        body: { difficulty, previousQuestions: previousQuestionsRef.current.slice(-10) },
      });
      if (error) throw error;
      setQuestion(data.question || "");
      setOptions(data.options || []);
      setCorrectIndex(data.correctIndex ?? 0);
      setExplanation(data.explanation || "");
      setCategory(data.category || "");
      const topic = (data.question || "").slice(0, 50);
      previousQuestionsRef.current = [...previousQuestionsRef.current, topic].slice(-15);
      setGameActive(true);
      setTimeLeft(diffConfig.timeSeconds);
      setQuestionNumber(n => n + 1);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal memuat soal", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [difficulty, diffConfig.timeSeconds, toast]);

  const handleAnswer = (index: number) => {
    if (!gameActive || result) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedIndex(index);

    const isCorrect = index === correctIndex;
    if (isCorrect) {
      const pts = getPointsForQuestion(questionNumber);
      const bonusPts = streak >= 3 ? Math.floor(pts * 0.5) : 0;
      const { awardedPoints, data } = awardGamePoints(pts + bonusPts);
      setEarnedPoints(awardedPoints);
      setPlayerData(data);
      setResult("correct");
      setStreak(s => s + 1);
      updateGameStats(activeVisitorId, "pilihan_ganda", true, awardedPoints);
      setTimeout(() => fetchQuestion(), 2000);
    } else {
      setResult("wrong");
      setGameActive(false);
      setStreak(0);
      updateGameStats(activeVisitorId, "pilihan_ganda", false, 0);
    }
  };

  const handleReveal = async () => {
    if (!gameActive) return;
    const ok = await useCredit();
    if (!ok) {
      toast({ title: "Kredit habis", description: "Beli kredit untuk menggunakan fitur ini", variant: "destructive" });
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedIndex(correctIndex);
    setResult("correct");
    setGameActive(false);
    setTimeout(() => fetchQuestion(), 2000);
  };

  const level = playerData.level;
  const currentThreshold = getCurrentLevelThreshold(level);
  const nextThreshold = getNextLevelThreshold(level);
  const progressPercent = Math.min(100, ((playerData.totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow">
            <Star className="w-3 h-3" /> Lv.{level}
          </div>
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {streak >= 3 && (
            <span className="flex items-center gap-1 text-orange-500 font-bold animate-pulse">
              <Zap className="w-3 h-3" /> {streak}x Streak!
            </span>
          )}
          <span className="text-muted-foreground">🏆 {playerData.totalPoints}pts</span>
        </div>
      </div>

      {/* Difficulty selector */}
      <div className="flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              Level: <span className={diffConfig.color}>{diffConfig.label}</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {DIFFICULTIES.map(d => (
              <DropdownMenuItem key={d.key} onClick={() => setDifficulty(d.key)}>
                <span className={d.color}>{d.label}</span>
                <span className="text-muted-foreground text-xs ml-2">{d.timeSeconds}s</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" onClick={fetchQuestion} disabled={loading} className="gap-1">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {questionNumber === 0 ? "Mulai" : "Soal Baru"}
        </Button>
      </div>

      {/* Question area */}
      <AnimatePresence mode="wait">
        {question && (
          <motion.div
            key={questionNumber}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Timer */}
            {gameActive && (
              <div className="flex items-center gap-2">
                <Timer className={`w-4 h-4 ${timeLeft <= 10 ? "text-red-500 animate-pulse" : timeLeft <= 20 ? "text-orange-500 animate-pulse" : timeLeft <= 30 ? "text-yellow-600" : "text-muted-foreground"}`} />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${timeLeft <= 10 ? "bg-red-500" : timeLeft <= 20 ? "bg-orange-500" : timeLeft <= 30 ? "bg-yellow-500" : "bg-primary"}`}
                    initial={{ width: "100%" }}
                    animate={{ width: `${(timeLeft / diffConfig.timeSeconds) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className={`text-sm font-mono font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : timeLeft <= 20 ? "text-orange-500 animate-pulse" : timeLeft <= 30 ? "text-yellow-600" : ""}`}>{timeLeft}s</span>
              </div>
            )}

            {/* Category badge */}
            {category && (
              <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {category}
              </span>
            )}

            {/* Question */}
            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <p className="text-sm font-semibold leading-relaxed">{question}</p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 gap-2">
              {options.map((opt, i) => {
                const isSelected = selectedIndex === i;
                const isCorrectOption = i === correctIndex;
                const showResult = result !== null;

                let borderClass = "border-border";
                let bgClass = "";
                if (showResult && isCorrectOption) {
                  borderClass = "border-green-500";
                  bgClass = "bg-green-500/10";
                } else if (showResult && isSelected && !isCorrectOption) {
                  borderClass = "border-red-500";
                  bgClass = "bg-red-500/10";
                }

                return (
                  <motion.button
                    key={i}
                    whileTap={!showResult ? { scale: 0.97 } : {}}
                    onClick={() => handleAnswer(i)}
                    disabled={!!result}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${borderClass} ${bgClass} ${!result ? "hover:border-primary/50 active:bg-primary/5" : ""}`}
                  >
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br ${OPTION_COLORS[i]} text-white font-bold text-sm flex items-center justify-center shadow-sm`}>
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="text-sm flex-1">{opt}</span>
                    {showResult && isCorrectOption && <Check className="w-5 h-5 text-green-500 flex-shrink-0" />}
                    {showResult && isSelected && !isCorrectOption && <X className="w-5 h-5 text-red-500 flex-shrink-0" />}
                  </motion.button>
                );
              })}
            </div>

            {/* Reveal answer button */}
            {gameActive && !result && (
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={handleReveal}>
                🔓 Kunci Jawaban (1 Kredit)
              </Button>
            )}

            {/* Result feedback */}
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-xl border ${result === "correct" ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {result === "correct" ? (
                    <>
                      <Trophy className="w-5 h-5 text-green-500" />
                      <span className="font-bold text-green-600">Benar! +{earnedPoints}pts</span>
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5 text-red-500" />
                      <span className="font-bold text-red-600">
                        {timeLeft === 0 ? "Waktu Habis!" : "Salah!"}
                      </span>
                    </>
                  )}
                </div>
                {explanation && <p className="text-xs text-muted-foreground">{explanation}</p>}
                {result === "correct" && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Dasar {getPointsForQuestion(questionNumber) + (streak >= 3 ? Math.floor(getPointsForQuestion(questionNumber) * 0.5) : 0)}{getPointMultiplier() > 1 ? ` ×${getPointMultiplier()}` : ""}
                  </p>
                )}
                {result === "wrong" && (
                  <Button size="sm" className="mt-3 gap-1" onClick={fetchQuestion}>
                    <RefreshCw className="w-3 h-3" /> Coba Lagi
                  </Button>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!question && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Tekan "Mulai" untuk memulai kuis!</p>
          <p className="text-xs mt-1">Pilih jawaban yang benar dari 4 pilihan</p>
        </div>
      )}
    </div>
  );
}
