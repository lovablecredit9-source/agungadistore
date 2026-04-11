import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Lightbulb, Check, X, Zap, Timer, Trophy, Star, Package, ChevronDown, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { updateGameStats } from "./GameProfile";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog, RevealAnswerButton } from "./GameCredits";
import { useToast } from "@/hooks/use-toast";
import {
  loadGameData, addPoints, getPointsForQuestion,
  getNextLevelThreshold, getCurrentLevelThreshold,
  DIFFICULTIES, type Difficulty, type GameLevel,
} from "./gameStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_WRONG = 3;

export default function TebakBarangGame() {
  const activeVisitorId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("balance_visitor_id") || getVisitorId();
  }, []);
  const { credits, isUnlimited, fetchCredits, useCredit } = useGameCredits(activeVisitorId);
  const [item, setItem] = useState("");
  const [category, setCategory] = useState("");
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

  const startNewGame = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setGuess("");
    setRevealedHints(0);
    setWrongCount(0);
    setEarnedPoints(0);
    setAnswerRevealed(false);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const { data, error } = await supabase.functions.invoke("tebak-barang", {
        body: { difficulty },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setItem((data.item || "").toUpperCase());
      setHints(data.hints || []);
      setCategory(data.category || "");
      setRevealedHints(1);
      setGameActive(true);
      setTimeLeft(diffConfig.timeSeconds);
      setQuestionNumber(n => n + 1);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message || "Gagal memuat soal", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [difficulty, diffConfig.timeSeconds, toast]);

  const handleGuess = () => {
    if (!guess.trim() || !gameActive) return;
    const g = guess.trim().toUpperCase();
    const a = item.toUpperCase();

    if (g === a || a.includes(g) || g.includes(a)) {
      if (timerRef.current) clearInterval(timerRef.current);
      setResult("correct");
      setGameActive(false);
      updateGameStats(activeVisitorId, "tebak_barang", true, pts);
      const pts = getPointsForQuestion(questionNumber);
      setEarnedPoints(pts);
      const updated = addPoints(pts);
      setPlayerData(updated);
      setTimeout(() => startNewGame(), 2000);
    } else {
      const newWrong = wrongCount + 1;
      setWrongCount(newWrong);
      if (revealedHints < hints.length) setRevealedHints(r => r + 1);
      if (newWrong >= MAX_WRONG) {
        if (timerRef.current) clearInterval(timerRef.current);
        setResult("wrong");
        setGameActive(false);
        updateGameStats(activeVisitorId, "tebak_barang", false, 0);
      } else {
        setResult("wrong");
        setTimeout(() => setResult(null), 1500);
      }
    }
    setGuess("");
  };

  const handleRevealAnswer = async () => {
    const ok = await useCredit();
    if (ok) {
      setAnswerRevealed(true);
      setGuess(item);
      fetchCredits();
    }
  };

  const level = playerData.level;
  const currentThreshold = getCurrentLevelThreshold(level);
  const nextThreshold = getNextLevelThreshold(level);
  const progressPct = Math.min(100, ((playerData.totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100);

  const gameOver = result === "wrong" && wrongCount >= MAX_WRONG;

  if (!item && !loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" /> Level {level}
            </span>
            <span className="text-[10px] text-muted-foreground">{playerData.totalPoints} pts</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
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

        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-extrabold text-lg">Tebak Barang AI</h3>
          <p className="text-sm text-muted-foreground mb-4">AI deskripsikan benda, kamu tebak apa barangnya!</p>
          <Button onClick={startNewGame} disabled={loading} className="gap-2" size="lg">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
            Mulai Tebak!
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-500" /> Lv.{level}
        </span>
        <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-primary" /> Soal #{questionNumber}</span>
        {gameActive && (
          <span className={`flex items-center gap-1 font-mono font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : ""}`}>
            <Timer className="w-3 h-3" /> {timeLeft}s
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} />
        {category && <span className="text-[10px] bg-amber-500/10 text-amber-600 rounded-full px-2 py-0.5 flex items-center gap-1"><Tag className="w-2.5 h-2.5" /> {category}</span>}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">AI sedang memilih barang...</span>
        </div>
      ) : (
        <>
          {/* Item card */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border p-4 text-center">
            <Package className="w-6 h-6 text-amber-500 mx-auto mb-1" />
            <p className="text-sm font-bold">Barang apa ini? ({item.length} huruf)</p>
          </motion.div>

          {/* Hints */}
          {hints.length > 0 && (
            <div className="space-y-1">
              {hints.slice(0, revealedHints).map((h, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className="text-xs bg-yellow-500/10 rounded-lg px-3 py-2 flex items-start gap-2">
                  <Lightbulb className="w-3 h-3 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>{h}</span>
                </motion.div>
              ))}
              {revealedHints < hints.length && gameActive && (
                <Button variant="ghost" size="sm" onClick={() => setRevealedHints(r => r + 1)} className="text-xs gap-1">
                  <Lightbulb className="w-3 h-3" /> Petunjuk ({revealedHints}/{hints.length})
                </Button>
              )}
            </div>
          )}

          {/* Wrong count */}
          {wrongCount > 0 && gameActive && (
            <div className="flex gap-1 justify-center">
              {[0, 1, 2].map(i => (
                <X key={i} className={`w-5 h-5 ${i < wrongCount ? "text-destructive" : "text-muted"}`} />
              ))}
            </div>
          )}

          {/* Answer revealed */}
          {answerRevealed && gameActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Jawaban sudah diisi otomatis, tekan tombol untuk submit!</p>
            </motion.div>
          )}

          {/* Game over */}
          {gameOver && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-center space-y-2">
              <X className="w-8 h-8 text-red-500 mx-auto" />
              <p className="font-bold text-red-600">Game Over! Salah {MAX_WRONG}x</p>
              <p className="text-sm font-bold">Jawaban: <span className="uppercase text-primary">{item}</span></p>
              <Button onClick={startNewGame} className="gap-2 mt-2" size="sm">
                <RefreshCw className="w-4 h-4" /> Soal Baru
              </Button>
            </motion.div>
          )}

          {/* Results */}
          <AnimatePresence>
            {result === "correct" && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 text-center space-y-2">
                <Check className="w-8 h-8 text-green-500 mx-auto" />
                <p className="font-extrabold text-green-600">Benar! 🎉 {item}</p>
                <p className="text-xs font-semibold text-green-600">+{earnedPoints} poin!</p>
              </motion.div>
            )}
            {result === "timeout" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-4 text-center space-y-2">
                <Timer className="w-8 h-8 text-orange-500 mx-auto" />
                <p className="font-bold text-orange-600">Waktu Habis!</p>
                <p className="text-sm font-bold">Jawaban: {item}</p>
                <Button onClick={startNewGame} variant="outline" size="sm" className="gap-1">
                  <RefreshCw className="w-4 h-4" /> Soal Baru
                </Button>
              </motion.div>
            )}
            {result === "wrong" && !gameOver && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center text-sm font-bold text-destructive">
                Salah! Coba lagi ({MAX_WRONG - wrongCount} kesempatan)
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          {gameActive && (
            <div className="flex gap-2">
              <Input
                value={guess}
                onChange={e => setGuess(e.target.value)}
                placeholder="Ketik nama barang..."
                onKeyDown={e => e.key === "Enter" && handleGuess()}
                className="flex-1 font-bold uppercase"
                autoFocus
              />
              <Button onClick={handleGuess} disabled={!guess.trim()}>
                <Check className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Reveal answer */}
          {gameActive && !answerRevealed && (
            <div className="flex justify-center">
              <RevealAnswerButton credits={credits} isUnlimited={isUnlimited} onReveal={handleRevealAnswer} visitorId={activeVisitorId} useCredit={useCredit} />
            </div>
          )}

          {/* Next */}
          {!gameActive && !loading && result !== "correct" && (
            <Button onClick={startNewGame} className="w-full gap-2">
              <Zap className="w-4 h-4" /> Soal Berikutnya
            </Button>
          )}
        </>
      )}
    </div>
  );
}
