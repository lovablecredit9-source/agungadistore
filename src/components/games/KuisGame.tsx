import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Check, X, Zap, Timer, Trophy, Star, ChevronDown, ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog } from "./GameCredits";
import { useToast } from "@/hooks/use-toast";
import {
  loadGameData, addPoints, getPointsForQuestion,
  getLevelFromPoints, getNextLevelThreshold, getCurrentLevelThreshold,
  DIFFICULTIES, type Difficulty, type GameLevel,
} from "./gameStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function KuisGame() {
  const activeVisitorId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("balance_visitor_id") || getVisitorId();
  }, []);
  const { credits, isUnlimited, fetchCredits, useCredit } = useGameCredits(activeVisitorId);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<"ya" | "tidak">("ya");
  const [explanation, setExplanation] = useState("");
  const [funFact, setFunFact] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [streak, setStreak] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("sedang");
  const [playerData, setPlayerData] = useState<GameLevel>(loadGameData);
  const [timeLeft, setTimeLeft] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousTopicsRef = useRef<string[]>([]);
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
    setEarnedPoints(0);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const { data, error } = await supabase.functions.invoke("kuis-yatidak", {
        body: { difficulty, previousTopics: previousTopicsRef.current.slice(-10) },
      });
      if (error) throw error;
      setQuestion(data.question || "");
      setAnswer((data.answer || "ya").toLowerCase().trim() as "ya" | "tidak");
      setExplanation(data.explanation || "");
      setFunFact(data.funFact || "");
      const topic = (data.question || "").slice(0, 50);
      previousTopicsRef.current = [...previousTopicsRef.current, topic].slice(-15);
      setGameActive(true);
      setTimeLeft(diffConfig.timeSeconds);
      setQuestionNumber(n => n + 1);
    } catch (e: any) {
      toast({ title: "Gagal memuat kuis", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [difficulty, diffConfig.timeSeconds, toast]);

  const handleAnswer = (picked: "ya" | "tidak") => {
    if (!gameActive) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setGameActive(false);

    if (picked === answer) {
      setResult("correct");
      setStreak(s => s + 1);
      const pts = getPointsForQuestion(questionNumber) + (streak >= 3 ? 5 : 0);
      setEarnedPoints(pts);
      const updated = addPoints(pts);
      setPlayerData(updated);
      setTimeout(() => fetchQuestion(), 2000);
    } else {
      setResult("wrong");
      setStreak(0);
    }
  };

  const levelProgress = playerData.totalPoints - getCurrentLevelThreshold(playerData.level);
  const levelRange = getNextLevelThreshold(playerData.level) - getCurrentLevelThreshold(playerData.level);
  const progressPct = Math.min(100, (levelProgress / levelRange) * 100);

  if (!question && !loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-r from-green-500/10 to-red-500/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" /> Level {playerData.level}
            </span>
            <span className="text-[10px] text-muted-foreground">{playerData.totalPoints} pts</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
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

        <Button onClick={fetchQuestion} className="w-full gap-2" size="lg">
          <ThumbsUp className="w-5 h-5" /> Mulai Kuis!
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
        {streak >= 2 && <span className="text-orange-500 font-bold">🔥 Streak {streak}!</span>}
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
          <span className="text-sm text-muted-foreground">AI sedang membuat pertanyaan...</span>
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border p-5">
            <p className="text-base font-bold leading-relaxed text-center">{question}</p>
          </motion.div>

          {gameActive && (
            <div className="grid grid-cols-2 gap-3">
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => handleAnswer("ya")}
                  className="w-full h-20 text-xl font-extrabold gap-2 bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-lg"
                  size="lg"
                >
                  <ThumbsUp className="w-7 h-7" /> YA
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => handleAnswer("tidak")}
                  className="w-full h-20 text-xl font-extrabold gap-2 bg-red-500 hover:bg-red-600 text-white rounded-2xl shadow-lg"
                  size="lg"
                >
                  <ThumbsDown className="w-7 h-7" /> TIDAK
                </Button>
              </motion.div>
            </div>
          )}

          <AnimatePresence>
            {result === "correct" && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 text-center space-y-2">
                <Check className="w-8 h-8 text-green-500 mx-auto" />
                <p className="font-extrabold text-green-600">Benar! 🎉</p>
                {explanation && <p className="text-xs text-muted-foreground">{explanation}</p>}
                {funFact && <p className="text-xs text-blue-600">💡 {funFact}</p>}
                <p className="text-xs font-semibold text-green-600">+{earnedPoints} poin!</p>
              </motion.div>
            )}
            {result === "wrong" && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-center space-y-2">
                <X className="w-8 h-8 text-red-500 mx-auto" />
                <p className="font-bold text-red-600">Salah!</p>
                <p className="text-sm font-bold">Jawaban: <span className="uppercase text-primary">{answer}</span></p>
                {explanation && <p className="text-xs text-muted-foreground">{explanation}</p>}
                {funFact && <p className="text-xs text-blue-600">💡 {funFact}</p>}
                <Button onClick={fetchQuestion} className="gap-2 mt-2" size="sm">
                  <RefreshCw className="w-4 h-4" /> Soal Baru
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
