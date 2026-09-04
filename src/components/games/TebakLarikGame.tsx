import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Check, X, Zap, Timer, Trophy, Star, ChevronDown, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { updateGameStats } from "./GameProfile";
import { useGameCredits } from "./GameCredits";
import { useToast } from "@/hooks/use-toast";
import {
  loadGameData, awardGamePoints, getPointsForQuestion, getPointMultiplier,
  getCurrentLevelThreshold, getNextLevelThreshold,
  DIFFICULTIES, type Difficulty, type GameLevel,
} from "./gameStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_COLORS = [
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
];

const GENRES = [
  { key: "acak", label: "🎲 Acak" },
  { key: "puisi", label: "📜 Puisi" },
  { key: "pantun", label: "🎋 Pantun" },
  { key: "lirik", label: "🎵 Lirik Lagu" },
  { key: "syair", label: "🪔 Syair" },
  { key: "peribahasa", label: "🗣️ Peribahasa" },
];

export default function TebakLarikGame() {
  const activeVisitorId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("balance_visitor_id") || getVisitorId();
  }, []);
  const { useCredit } = useGameCredits(activeVisitorId);
  const [title, setTitle] = useState("");
  const [genreLabel, setGenreLabel] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [missingIndex, setMissingIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [streak, setStreak] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("sedang");
  const [genre, setGenre] = useState("acak");
  const [playerData, setPlayerData] = useState<GameLevel>(loadGameData);
  const [timeLeft, setTimeLeft] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousLinesRef = useRef<string[]>([]);
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

  const fetchLarik = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setSelectedIndex(null);
    setEarnedPoints(0);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const { data, error } = await supabase.functions.invoke("tebak-larik", {
        body: { difficulty, genre, previousLines: previousLinesRef.current.slice(-40) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const rawLines: string[] = Array.isArray(data.lines) ? data.lines : [];
      const opts: string[] = Array.isArray(data.options) ? data.options.slice(0, 4) : [];
      if (rawLines.length < 2 || opts.length < 2) throw new Error("Bait tidak valid, coba lagi");

      setTitle(data.title || "Bait Misterius");
      setGenreLabel(String(data.genre || genre));
      setLines(rawLines);
      setMissingIndex(Math.min(Math.max(Number(data.missingIndex) || 0, 0), rawLines.length - 1));
      setOptions(opts);
      setCorrectIndex(Math.min(Math.max(Number(data.correctIndex) || 0, 0), opts.length - 1));
      setExplanation(data.explanation || "");
      previousLinesRef.current = [...previousLinesRef.current, ...opts].slice(-60);
      setGameActive(true);
      setTimeLeft(diffConfig.timeSeconds);
      setQuestionNumber(n => n + 1);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal memuat bait", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [difficulty, genre, diffConfig.timeSeconds, toast]);

  const handleAnswer = (index: number) => {
    if (!gameActive || result) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedIndex(index);

    if (index === correctIndex) {
      const pts = getPointsForQuestion(questionNumber);
      const bonusPts = streak >= 3 ? Math.floor(pts * 0.5) : 0;
      const { awardedPoints, data } = awardGamePoints(pts + bonusPts);
      setEarnedPoints(awardedPoints);
      setPlayerData(data);
      setResult("correct");
      setStreak(s => s + 1);
      updateGameStats(activeVisitorId, "tebak_larik", true, awardedPoints);
      setTimeout(() => fetchLarik(), 2200);
    } else {
      setResult("wrong");
      setGameActive(false);
      setStreak(0);
      updateGameStats(activeVisitorId, "tebak_larik", false, 0);
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
    setTimeout(() => fetchLarik(), 2200);
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
          <div className="flex items-center gap-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow">
            <Star className="w-3 h-3" /> Lv.{level}
          </div>
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${progressPercent}%` }} />
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

      {/* Selectors */}
      <div className="flex items-center gap-2 flex-wrap">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              {GENRES.find(g => g.key === genre)?.label}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {GENRES.map(g => (
              <DropdownMenuItem key={g.key} onClick={() => setGenre(g.key)}>{g.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" onClick={fetchLarik} disabled={loading} className="gap-1 ml-auto">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {questionNumber === 0 ? "Mulai" : "Bait Baru"}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {lines.length > 0 && (
          <motion.div
            key={questionNumber}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {gameActive && (
              <div className="flex items-center gap-2">
                <Timer className={`w-4 h-4 ${timeLeft <= 10 ? "text-red-500 animate-pulse" : timeLeft <= 20 ? "text-orange-500" : "text-muted-foreground"}`} />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${timeLeft <= 10 ? "bg-red-500" : timeLeft <= 20 ? "bg-orange-500" : "bg-primary"}`}
                    initial={{ width: "100%" }}
                    animate={{ width: `${(timeLeft / diffConfig.timeSeconds) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className={`text-sm font-mono font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : ""}`}>{timeLeft}s</span>
              </div>
            )}

            {/* Bait */}
            <div className="relative overflow-hidden rounded-2xl p-[2px]">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 opacity-80" />
              <div className="relative rounded-[14px] bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-fuchsia-300" />
                  <span className="text-sm font-bold text-white">{title}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-fuchsia-200 bg-white/10 px-2 py-0.5 rounded-full">{genreLabel}</span>
                </div>
                <div className="space-y-1.5">
                  {lines.map((line, i) => {
                    const isMissing = i === missingIndex || line.trim() === "____";
                    const filled = isMissing && result && options[correctIndex];
                    return (
                      <p
                        key={i}
                        className={`text-sm leading-relaxed ${isMissing ? "font-bold" : "text-white/85"} ${
                          isMissing ? (result === "correct" ? "text-emerald-300" : result ? "text-amber-300" : "text-fuchsia-300") : ""
                        }`}
                      >
                        {isMissing ? (filled ? `“${options[correctIndex]}”` : "＿＿＿＿＿＿＿＿") : line}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="grid gap-2">
              {options.map((opt, i) => {
                const isSelected = selectedIndex === i;
                const isCorrect = i === correctIndex;
                const showState = result !== null;
                return (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAnswer(i)}
                    disabled={!gameActive || result !== null}
                    className={`flex items-start gap-3 p-3 rounded-xl text-left border transition-all ${
                      showState && isCorrect
                        ? "bg-green-500/15 border-green-500/40"
                        : showState && isSelected
                          ? "bg-red-500/15 border-red-500/40"
                          : "bg-card border-border hover:border-primary/50"
                    }`}
                  >
                    <span className={`shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br ${OPTION_COLORS[i]} text-white text-xs font-bold flex items-center justify-center`}>
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="text-sm flex-1">{opt}</span>
                    {showState && isCorrect && <Check className="w-4 h-4 text-green-500 shrink-0" />}
                    {showState && isSelected && !isCorrect && <X className="w-4 h-4 text-red-500 shrink-0" />}
                  </motion.button>
                );
              })}
            </div>

            {gameActive && !result && (
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={handleReveal}>
                🔓 Kunci Jawaban (1 Kredit)
              </Button>
            )}

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
                      <span className="font-bold text-green-600">Larik tepat! +{earnedPoints}pts</span>
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5 text-red-500" />
                      <span className="font-bold text-red-600">{timeLeft === 0 ? "Waktu Habis!" : "Kurang pas!"}</span>
                    </>
                  )}
                </div>
                {explanation && <p className="text-xs text-muted-foreground">{explanation}</p>}
                {result === "correct" && getPointMultiplier() > 1 && (
                  <p className="text-[11px] text-muted-foreground mt-1">Bonus pengali ×{getPointMultiplier()}</p>
                )}
                {result === "wrong" && (
                  <Button size="sm" className="mt-3 gap-1" onClick={fetchLarik}>
                    <RefreshCw className="w-3 h-3" /> Coba Lagi
                  </Button>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {lines.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Tekan "Mulai" untuk membuka bait pertama ✨</p>
          <p className="text-xs mt-1">Lengkapi larik yang hilang dari puisi, pantun, syair, atau lirik buatan AI</p>
        </div>
      )}
    </div>
  );
}
