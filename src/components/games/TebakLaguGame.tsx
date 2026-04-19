import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Loader2, Sparkles, Check, X, Trophy, Lightbulb, RotateCcw, Heart, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog } from "./GameCredits";

interface Question {
  lyric_snippet: string;
  correct_title: string;
  correct_artist: string;
  options: string[];
  hint: string;
}

const TOTAL_ROUNDS = 5;
const TIME_PER_QUESTION = 45;
const MAX_LIVES = 3;
const HINT_COST = 5;
const REVEAL_ANSWER_COST = 1;

export default function TebakLaguGame() {
  const { toast } = useToast();
  const activeVisitorId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("balance_visitor_id") || getVisitorId();
  }, []);
  const { credits, isUnlimited, fetchCredits, useCredit } = useGameCredits(activeVisitorId);

  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hintUsed, setHintUsed] = useState(0); // jumlah hint terpakai (1 gratis, sisanya 5 kredit)
  const [showHint, setShowHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const loadQuestion = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
    setHintUsed(0);
    setTimeLeft(TIME_PER_QUESTION);
    stopTimer();
    try {
      const { data, error } = await supabase.functions.invoke("tebak-lagu", {
        body: { action: "question" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setQuestion(data as Question);
    } catch (e) {
      toast({
        title: "Gagal memuat soal",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (round < TOTAL_ROUNDS && !finished && !gameOver) loadQuestion();
  }, [round, finished, gameOver, loadQuestion]);

  // Timer countdown
  useEffect(() => {
    if (loading || !question || revealed || finished || gameOver) return;
    stopTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          stopTimer();
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, question, revealed, finished, gameOver]);

  const submitScore = async (finalScore: number, finalCorrect: number) => {
    if (!activeVisitorId) return;
    setSubmittingScore(true);
    try {
      await supabase.functions.invoke("tebak-lagu", {
        body: {
          action: "submit_score",
          visitorId: activeVisitorId,
          score: finalScore,
          totalQuestions: TOTAL_ROUNDS,
          correctAnswers: finalCorrect,
        },
      });
    } catch (e) {
      console.error("[tebak-lagu] submit", e);
    } finally {
      setSubmittingScore(false);
    }
  };

  const advanceAfterReveal = (newScore: number, newCorrect: number, newLives: number) => {
    setTimeout(() => {
      if (newLives <= 0) {
        setGameOver(true);
        submitScore(newScore, newCorrect);
        return;
      }
      const nextRound = round + 1;
      if (nextRound >= TOTAL_ROUNDS) {
        setFinished(true);
        submitScore(newScore, newCorrect);
      } else {
        setRound(nextRound);
      }
    }, 1800);
  };

  const handleTimeout = () => {
    if (revealed || !question) return;
    setRevealed(true);
    const newLives = Math.max(0, lives - 1);
    setLives(newLives);
    advanceAfterReveal(score, correctCount, newLives);
  };

  const handleSelect = (opt: string) => {
    if (revealed || !question) return;
    stopTimer();
    setSelected(opt);
    setRevealed(true);

    const isCorrect = opt === question.correct_title;
    // Poin berkurang berdasarkan jumlah hint yang dipakai
    const basePoints = isCorrect ? 10 : 0;
    const points = isCorrect ? Math.max(2, basePoints - hintUsed * 3) : 0;
    const newScore = score + points;
    const newCorrect = correctCount + (isCorrect ? 1 : 0);
    const newLives = isCorrect ? lives : Math.max(0, lives - 1);

    setScore(newScore);
    if (isCorrect) setCorrectCount(newCorrect);
    if (!isCorrect) setLives(newLives);

    advanceAfterReveal(newScore, newCorrect, newLives);
  };

  const handleRequestHint = async () => {
    if (showHint || revealed) return;
    if (hintUsed === 0) {
      // hint pertama gratis
      setShowHint(true);
      setHintUsed(1);
      return;
    }
    // hint berikutnya = 5 kredit (kalau bukan unlimited)
    if (!isUnlimited) {
      if (credits < HINT_COST) {
        toast({
          title: "Kredit kurang",
          description: `Butuh ${HINT_COST} kredit untuk hint tambahan.`,
          variant: "destructive",
        });
        return;
      }
      // konsumsi 5 kredit (loop useCredit)
      for (let i = 0; i < HINT_COST; i++) {
        const ok = await useCredit();
        if (!ok) {
          toast({ title: "Gagal konsumsi kredit", variant: "destructive" });
          await fetchCredits();
          return;
        }
      }
    }
    setShowHint(true);
    setHintUsed((h) => h + 1);
    toast({ title: "Hint ditampilkan", description: isUnlimited ? "Mode unlimited" : `-${HINT_COST} kredit` });
  };

  const handleRevealAnswer = async () => {
    if (revealed || !question) return;
    if (!isUnlimited) {
      if (credits < REVEAL_ANSWER_COST) {
        toast({
          title: "Kredit kurang",
          description: `Butuh ${REVEAL_ANSWER_COST} kredit untuk lihat jawaban.`,
          variant: "destructive",
        });
        return;
      }
      const ok = await useCredit();
      if (!ok) {
        toast({ title: "Gagal konsumsi kredit", variant: "destructive" });
        await fetchCredits();
        return;
      }
    }
    stopTimer();
    setRevealed(true);
    setSelected(question.correct_title);
    const newLives = Math.max(0, lives - 1);
    setLives(newLives);
    toast({
      title: "Jawaban ditampilkan",
      description: isUnlimited ? "Mode unlimited · -1 nyawa" : `-${REVEAL_ANSWER_COST} kredit · -1 nyawa · 0 poin`,
    });
    advanceAfterReveal(score, correctCount, newLives);
  };

  const restart = () => {
    stopTimer();
    setRound(0);
    setScore(0);
    setCorrectCount(0);
    setLives(MAX_LIVES);
    setQuestion(null);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
    setHintUsed(0);
    setFinished(false);
    setGameOver(false);
    setTimeLeft(TIME_PER_QUESTION);
  };

  // ===== Game Over (nyawa habis) =====
  if (gameOver) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border-2 border-red-500/50 p-6 bg-gradient-to-br from-red-950 via-rose-950 to-purple-950 text-center"
      >
        <Heart className="w-16 h-16 text-red-400 mx-auto mb-3 drop-shadow-[0_0_15px_rgba(248,113,113,0.6)]" />
        <div className="text-2xl font-black text-white mb-1">💔 GAME OVER</div>
        <div className="text-xs text-rose-200 mb-4">Nyawa habis di round {round + 1}</div>
        <div className="text-5xl font-black text-yellow-200 tabular-nums mb-2">{score}</div>
        <div className="text-sm text-white/80 mb-4">{correctCount} jawaban benar</div>
        {submittingScore && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-rose-200 mb-3">
            <Loader2 className="w-3 h-3 animate-spin" /> Menyimpan skor...
          </div>
        )}
        <Button
          onClick={restart}
          className="w-full h-11 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-black"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Main Lagi
        </Button>
      </motion.div>
    );
  }

  // ===== Finished (5 round selesai) =====
  if (finished) {
    const pct = Math.round((correctCount / TOTAL_ROUNDS) * 100);
    const verdict = pct === 100 ? "🏆 SEMPURNA!" : pct >= 80 ? "🎉 LUAR BIASA!" : pct >= 60 ? "👍 BAGUS!" : pct >= 40 ? "🙂 LUMAYAN" : "💪 COBA LAGI!";
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border-2 border-purple-500/50 p-6 bg-gradient-to-br from-purple-950 via-pink-950 to-rose-950 text-center"
      >
        <Trophy className="w-16 h-16 text-yellow-300 mx-auto mb-3 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
        <div className="text-2xl font-black text-white mb-1">{verdict}</div>
        <div className="text-xs text-pink-200 mb-4">Skor akhir kamu</div>
        <div className="text-5xl font-black text-yellow-200 tabular-nums mb-2">{score}</div>
        <div className="text-sm text-white/80 mb-4">
          {correctCount}/{TOTAL_ROUNDS} jawaban benar ({pct}%)
        </div>
        {submittingScore && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-pink-200 mb-3">
            <Loader2 className="w-3 h-3 animate-spin" /> Menyimpan skor ke leaderboard...
          </div>
        )}
        <Button
          onClick={restart}
          className="w-full h-11 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-black"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Main Lagi
        </Button>
      </motion.div>
    );
  }

  const timeColor = timeLeft <= 10 ? "text-red-300" : timeLeft <= 20 ? "text-yellow-200" : "text-emerald-200";
  const timePct = (timeLeft / TIME_PER_QUESTION) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-purple-500/50 p-4 bg-gradient-to-br from-purple-950 via-pink-950 to-rose-950 shadow-[0_0_30px_rgba(168,85,247,0.35)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <Music className="w-6 h-6 text-pink-300 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" strokeWidth={2.5} />
          </motion.div>
          <div>
            <div className="text-[10px] font-black tracking-widest text-pink-300 uppercase">🎵 TEBAK LAGU AI</div>
            <div className="text-base font-black text-white">Round {round + 1} / {TOTAL_ROUNDS}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/30 border border-yellow-400/50">
          <Sparkles className="w-3 h-3 text-yellow-200" strokeWidth={2.5} />
          <span className="text-[11px] font-black text-yellow-100 tabular-nums">{score} pts</span>
        </div>
      </div>

      {/* Lives + Timer + Credits */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <motion.div
              key={i}
              animate={i >= lives ? { scale: [1, 0.8, 1], opacity: 0.3 } : { scale: 1, opacity: 1 }}
            >
              <Heart
                className={`w-4 h-4 ${i < lives ? "text-red-400 fill-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.7)]" : "text-white/20"}`}
                strokeWidth={2.5}
              />
            </motion.div>
          ))}
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 border border-white/10 ${timeColor}`}>
          <Timer className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span className="text-xs font-black tabular-nums">{timeLeft}s</span>
        </div>
        <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} />
      </div>

      {/* Timer bar */}
      <div className="h-1 rounded-full bg-black/40 overflow-hidden mb-2">
        <motion.div
          className={`h-full ${timeLeft <= 10 ? "bg-red-400" : timeLeft <= 20 ? "bg-yellow-300" : "bg-emerald-400"}`}
          animate={{ width: `${timePct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      {/* Round progress bar */}
      <div className="h-1.5 rounded-full bg-black/40 overflow-hidden mb-4">
        <motion.div
          className="h-full bg-gradient-to-r from-pink-400 to-purple-500"
          animate={{ width: `${(round / TOTAL_ROUNDS) * 100}%` }}
        />
      </div>

      {loading || !question ? (
        <div className="flex flex-col items-center justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-pink-300 mb-2" />
          <span className="text-xs text-pink-200 font-bold">AI sedang menyiapkan lagu...</span>
        </div>
      ) : (
        <>
          {/* Lyric snippet */}
          <motion.div
            key={round}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-gradient-to-br from-black/50 to-purple-900/40 border border-pink-400/30 mb-3"
          >
            <div className="text-[10px] font-black text-pink-300 uppercase tracking-wider mb-2">🎤 Potongan Lirik</div>
            <div className="text-sm md:text-base font-bold text-white italic leading-relaxed whitespace-pre-line">
              "{question.lyric_snippet}"
            </div>
          </motion.div>

          {/* Hint button */}
          {!showHint && !revealed && (
            <button
              onClick={handleRequestHint}
              className="w-full mb-3 p-2 rounded-lg bg-yellow-500/20 border border-yellow-400/40 flex items-center justify-center gap-1.5 hover:bg-yellow-500/30 transition disabled:opacity-50"
            >
              <Lightbulb className="w-3.5 h-3.5 text-yellow-300" strokeWidth={2.5} />
              <span className="text-[11px] font-black text-yellow-100">
                {hintUsed === 0 ? "Lihat Hint (Gratis)" : `Hint Lagi (${isUnlimited ? "Unlimited" : `-${HINT_COST} kredit`})`}
              </span>
            </button>
          )}
          {showHint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-3 p-2.5 rounded-lg bg-yellow-500/15 border border-yellow-400/40"
            >
              <div className="flex items-start gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                <span className="text-[11px] text-yellow-100 font-medium">{question.hint}</span>
              </div>
            </motion.div>
          )}

          {/* Options */}
          <div className="grid grid-cols-1 gap-2">
            <AnimatePresence>
              {question.options.map((opt, i) => {
                const isCorrect = opt === question.correct_title;
                const isSelected = selected === opt;
                let bg = "bg-gradient-to-r from-purple-700/60 to-pink-700/60 hover:from-purple-600 hover:to-pink-600 border-purple-400/40";
                if (revealed) {
                  if (isCorrect) bg = "bg-gradient-to-r from-green-600 to-emerald-600 border-green-300 ring-2 ring-green-300/60";
                  else if (isSelected) bg = "bg-gradient-to-r from-red-600 to-rose-600 border-red-300";
                  else bg = "bg-black/30 border-white/10 opacity-50";
                }
                return (
                  <motion.button
                    key={`${round}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleSelect(opt)}
                    disabled={revealed}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${bg}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{opt}</span>
                      {revealed && isCorrect && <Check className="w-5 h-5 text-white flex-shrink-0" strokeWidth={3} />}
                      {revealed && isSelected && !isCorrect && <X className="w-5 h-5 text-white flex-shrink-0" strokeWidth={3} />}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Reveal */}
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 rounded-xl bg-gradient-to-r from-purple-900/60 to-pink-900/60 border border-purple-400/40 text-center"
            >
              <div className="text-[10px] font-black text-pink-300 uppercase tracking-wider mb-1">Lagu ini adalah</div>
              <div className="text-base font-black text-white">{question.correct_title}</div>
              <div className="text-xs text-pink-200">— {question.correct_artist}</div>
            </motion.div>
          )}

          {/* Buy credits */}
          <div className="mt-3 flex justify-center">
            <BuyCreditsDialog visitorId={activeVisitorId} onPurchased={fetchCredits} />
          </div>
        </>
      )}

      <p className="text-[9px] text-purple-200/60 mt-4 text-center">
        🎮 45 detik · 3 nyawa · Hint pertama gratis · Hint lagi {HINT_COST} kredit
      </p>
    </motion.div>
  );
}
