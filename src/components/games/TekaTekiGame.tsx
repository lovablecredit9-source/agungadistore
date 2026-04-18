import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Lightbulb, Check, X, Zap, Timer, Trophy, Star, HelpCircle, ChevronDown, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { updateGameStats } from "./GameProfile";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog, RevealAnswerButton } from "./GameCredits";
import PowerUpsBar from "./PowerUpsBar";
import { applyDoubleXP } from "./gameStore";
import { useToast } from "@/hooks/use-toast";
import {
  loadGameData, addPoints, getPointsForQuestion,
  getLevelFromPoints, getNextLevelThreshold, getCurrentLevelThreshold,
  DIFFICULTIES, type Difficulty, type GameLevel,
} from "./gameStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TekaTekiGame() {
  const activeVisitorId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("balance_visitor_id") || getVisitorId();
  }, []);
  const { credits, isUnlimited, fetchCredits, useCredit } = useGameCredits(activeVisitorId);
  const [riddle, setRiddle] = useState("");
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [revealedHints, setRevealedHints] = useState(0);
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | "timeout" | null>(null);
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

  // Timer
  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setResult("timeout");
            setGameActive(false);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [gameActive, timeLeft > 0]);

  const fetchRiddle = useCallback(async () => {

    setLoading(true);
    setResult(null);
    setGuess("");
    setRevealedHints(0);
    setWrongCount(0);
    setEarnedPoints(0);
    setAnswerRevealed(false);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const { data, error } = await supabase.functions.invoke("teka-teki", {
        body: { difficulty },
      });
      if (error) throw error;
      setRiddle(data.riddle || "");
      setAnswer((data.answer || "").toLowerCase().trim());
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
  }, [difficulty, diffConfig.timeSeconds, toast, questionNumber, isUnlimited, credits, useCredit]);

  const MAX_WRONG = 3;

  const handleGuess = () => {
    if (!guess.trim()) return;
    const g = guess.trim().toLowerCase();
    const a = answer.toLowerCase();

    if (g === a || a.includes(g) || g.includes(a)) {
      if (timerRef.current) clearInterval(timerRef.current);
      const pts = applyDoubleXP(getPointsForQuestion(questionNumber));
      setResult("correct");
      setGameActive(false);
      setEarnedPoints(pts);
      const updated = addPoints(pts);
      setPlayerData(updated);
      updateGameStats(activeVisitorId, "teka_teki", true, pts);
      // Auto-next after 2 seconds
      setTimeout(() => fetchRiddle(), 2000);
    } else {
      const newWrong = wrongCount + 1;
      setWrongCount(newWrong);
      setGuess("");
      if (newWrong >= MAX_WRONG) {
        if (timerRef.current) clearInterval(timerRef.current);
        setResult("wrong");
        setGameActive(false);
        updateGameStats(activeVisitorId, "teka_teki", false, 0);
      } else {
        setResult("wrong");
        setTimeout(() => setResult(null), 1500);
      }
    }
  };

  const revealHint = () => {
    if (revealedHints < hints.length) setRevealedHints(r => r + 1);
  };

  const handleRevealAnswer = async () => {
    const ok = await useCredit();
    if (ok) {
      setAnswerRevealed(true);
      setGuess(answer);
      fetchCredits();
    }
  };

  const levelProgress = playerData.totalPoints - getCurrentLevelThreshold(playerData.level);
  const levelRange = getNextLevelThreshold(playerData.level) - getCurrentLevelThreshold(playerData.level);
  const progressPct = Math.min(100, (levelProgress / levelRange) * 100);

  // Pre-game
  if (!riddle && !loading) {
    return (
      <div className="space-y-4">
        {/* Player stats */}
        <div className="rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" /> Level {playerData.level}
            </span>
            <span className="text-[10px] text-muted-foreground">{playerData.totalPoints} pts</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
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

        <Button onClick={fetchRiddle} className="w-full gap-2" size="lg">
          <HelpCircle className="w-5 h-5" /> Mulai Teka-Teki!
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-500" /> Lv.{playerData.level}
        </span>
        <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-primary" /> Soal #{questionNumber}</span>
        {gameActive && (
          <span className={`flex items-center gap-1 font-mono font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : timeLeft <= 20 ? "text-orange-500 animate-pulse" : timeLeft <= 30 ? "text-yellow-600" : ""}`}>
            <Timer className="w-3 h-3" /> {timeLeft}s
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} />
      </div>

      {gameActive && (
        <PowerUpsBar
          enabled={gameActive}
          onUseExtraLife={() => setWrongCount(w => Math.max(0, w - 1))}
          onUseHint={() => setRevealedHints(r => Math.min(hints.length, r + 1))}
          onUseTimeFreeze={(s) => setTimeLeft(t => t + s)}
        />
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">AI sedang membuat teka-teki...</span>
        </div>
      ) : (
        <>
          {/* Riddle card */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border p-4">
            <div className="flex items-start gap-2 mb-2">
              <HelpCircle className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-semibold leading-relaxed">{riddle}</p>
            </div>
          </motion.div>

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
                  <Lightbulb className="w-3 h-3" /> Tampilkan Petunjuk ({revealedHints}/{hints.length})
                </Button>
              )}
            </div>
          )}

          {/* Wrong count */}
          {wrongCount > 0 && gameActive && (
            <p className="text-xs text-muted-foreground text-center">Salah: {wrongCount}/{MAX_WRONG} — Sisa {MAX_WRONG - wrongCount} kesempatan!</p>
          )}

          {/* Answer revealed - still need to submit */}
          {answerRevealed && gameActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Jawaban sudah diisi otomatis, tekan tombol untuk submit!</p>
            </motion.div>
          )}

          {/* Game over - max wrong */}
          {result === "wrong" && !gameActive && wrongCount >= MAX_WRONG && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-center space-y-2">
              <X className="w-8 h-8 text-red-500 mx-auto" />
              <p className="font-bold text-red-600">Game Over! Salah {MAX_WRONG}x</p>
              <p className="text-sm font-bold">Jawaban: <span className="uppercase">{answer}</span></p>
              {explanation && <p className="text-xs text-muted-foreground">{explanation}</p>}
              <Button onClick={fetchRiddle} className="gap-2 mt-2" size="sm">
                <RefreshCw className="w-4 h-4" /> Soal Baru
              </Button>
            </motion.div>
          )}

          {/* Result */}
          <AnimatePresence>
            {result === "correct" && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 text-center space-y-2">
                <Check className="w-8 h-8 text-green-500 mx-auto" />
                <p className="font-extrabold text-green-600">Benar! 🎉</p>
                {explanation && <p className="text-xs text-muted-foreground">{explanation}</p>}
                <p className="text-xs font-semibold text-green-600">+{earnedPoints} poin!</p>
                <Button onClick={fetchRiddle} className="gap-2 mt-2" size="sm">
                  <Zap className="w-4 h-4" /> Soal Berikutnya
                </Button>
              </motion.div>
            )}
            {result === "timeout" && !answerRevealed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-4 text-center space-y-2">
                <Timer className="w-8 h-8 text-orange-500 mx-auto" />
                <p className="font-bold text-orange-600">Waktu Habis!</p>
                <div className="flex gap-2 justify-center">
                  <RevealAnswerButton credits={credits} isUnlimited={isUnlimited} onReveal={handleRevealAnswer} visitorId={activeVisitorId} useCredit={useCredit} />
                  <Button onClick={fetchRiddle} variant="outline" size="sm" className="gap-1">
                    <RefreshCw className="w-4 h-4" /> Soal Baru
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          {gameActive && (
            <div className="flex gap-2">
              <Input
                value={guess}
                onChange={e => setGuess(e.target.value)}
                placeholder="Ketik jawabanmu..."
                onKeyDown={e => e.key === "Enter" && handleGuess()}
                className="flex-1"
                autoFocus
              />
              <Button onClick={handleGuess} disabled={!guess.trim()}>
                <Check className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Reveal answer button during game */}
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
