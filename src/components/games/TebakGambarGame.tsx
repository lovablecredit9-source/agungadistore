import { useState, useEffect, useCallback, useRef } from "react";
import { updateGameStats } from "./GameProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Image, Eye, EyeOff, HelpCircle, Trophy, XCircle,
  Loader2, RefreshCw, Clock, Star, Lightbulb, AlertTriangle, Gift
} from "lucide-react";
import {
  awardGamePoints, getPointsForQuestion, loadGameData, getLevelFromPoints,
  getNextLevelThreshold, getCurrentLevelThreshold, type GameLevel,
} from "./gameStore";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog, RevealAnswerButton } from "./GameCredits";
import PowerUpsBar, { ReviveButton } from "./PowerUpsBar";

type Difficulty = "mudah" | "sedang" | "sulit" | "super_sulit" | "sangat_susah" | "ekstrem";
type Theme = "objek" | "angka" | "pola" | "emoji" | "acak";

const THEMES: { key: Theme; label: string; desc: string; emoji: string }[] = [
  { key: "objek", label: "Tebak Gambar AI", desc: "Gambar objek dibuat AI, selalu baru", emoji: "🖼️" },
  { key: "angka", label: "Teka-Teki Angka", desc: "Pola deret angka, tak pernah sama", emoji: "🔢" },
  { key: "pola", label: "Hitung Pola", desc: "Hitung bentuk yang tersebar acak", emoji: "🔺" },
  { key: "emoji", label: "Tebak Emoji", desc: "Tebak kata dari rangkaian emoji", emoji: "🧩" },
  { key: "acak", label: "Mode Acak", desc: "Semua tema campur aduk", emoji: "🎲" },
];

const DIFFICULTIES: { key: Difficulty; label: string; color: string; time: number; mult: number }[] = [
  { key: "mudah", label: "Mudah", color: "text-green-500", time: 60, mult: 1 },
  { key: "sedang", label: "Sedang", color: "text-blue-500", time: 45, mult: 1.5 },
  { key: "sulit", label: "Sulit", color: "text-orange-500", time: 30, mult: 2 },
  { key: "super_sulit", label: "Super Sulit", color: "text-red-500", time: 24, mult: 3 },
  { key: "sangat_susah", label: "Sangat Susah", color: "text-fuchsia-500", time: 18, mult: 4 },
  { key: "ekstrem", label: "Ekstrem 💀", color: "text-purple-400", time: 12, mult: 6 },
];

const INITIAL_BLUR: Record<Difficulty, number> = {
  mudah: 0,
  sedang: 2,
  sulit: 4,
  super_sulit: 6,
  sangat_susah: 8,
  ekstrem: 10,
};

export default function TebakGambarGame() {
  const balanceVisitorId = localStorage.getItem("balance_visitor_id");
  const activeVisitorId = balanceVisitorId || localStorage.getItem("visitor_id");
  const { credits, isUnlimited, fetchCredits, useCredit } = useGameCredits(activeVisitorId);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [imageData, setImageData] = useState("");
  const [answer, setAnswer] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [letterCount, setLetterCount] = useState(0);
  const [shownHints, setShownHints] = useState(0);
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [questionNum, setQuestionNum] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [playerData, setPlayerData] = useState<GameLevel>(loadGameData());
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [error, setError] = useState("");
  const [blurLevel, setBlurLevel] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [theme, setTheme] = useState<Theme>("objek");
  const [roundTheme, setRoundTheme] = useState<string>("objek");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const seenRef = useRef<string[]>([]);

  // Timer
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t);
          setTimerActive(false);
          setGameOver(true);
          updateGameStats(activeVisitorId || "", "tebak_gambar", false, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerActive, timeLeft]);

  const fetchNewImage = useCallback(async () => {
    if (!difficulty) return;

    setLoading(true);
    setError("");
    setResult(null);
    setWrongCount(0);
    setGuess("");
    setShownHints(0);
    setEarnedPoints(0);
    setImageData("");
    setAnswer("");
    setHints([]);
    setLetterCount(0);
    setBlurLevel(INITIAL_BLUR[difficulty]);
    setGameOver(false);
    setAnswerRevealed(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("tebak-gambar", {
        body: { action: "new_image", difficulty, theme, exclude: seenRef.current.slice(-40) },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (!data?.image || !data?.answer) throw new Error("Ronde gambar tidak valid");
      setImageData(data.image);
      setAnswer(data.answer);
      setRoundTheme(data.theme || theme);
      seenRef.current = [...seenRef.current, String(data.answer).toUpperCase()].slice(-60);
      setHints(data.hints || []);
      setLetterCount(data.letterCount || 0);
      setQuestionNum(prev => prev + 1);

      const diffConfig = DIFFICULTIES.find(d => d.key === difficulty);
      setTimeLeft(diffConfig?.time || 60);
      setTimerActive(true);
    } catch (e: any) {
      setError(e.message || "Gagal memuat gambar");
    } finally {
      setLoading(false);
    }
  }, [difficulty]);

  useEffect(() => {
    if (difficulty) fetchNewImage();
  }, [difficulty]);

  const handleGuess = async () => {
    if (!guess.trim() || gameOver) return;
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("tebak-gambar", {
        body: { action: "check_guess", guess: guess.trim(), answer },
      });
      if (fnError) throw fnError;

      if (data.correct) {
        setResult("correct");
        setTimerActive(false);
        const { awardedPoints, data: updatedData } = awardGamePoints(getPointsForQuestion(questionNum));
        setEarnedPoints(awardedPoints);
        setScore(prev => prev + awardedPoints);
        setPlayerData(updatedData);
        updateGameStats(activeVisitorId || "", "tebak_gambar", true, awardedPoints);
      } else {
        const newWrong = wrongCount + 1;
        setWrongCount(newWrong);
        setResult("wrong");
        setBlurLevel(prev => Math.max(prev - 2, 0));
        if (newWrong >= 3) {
          setTimerActive(false);
          setGameOver(true);
          updateGameStats(activeVisitorId || "", "tebak_gambar", false, 0);
        } else {
          setTimeout(() => setResult(null), 1200);
        }
      }
    } catch (e: any) {
      setError(e.message || "Gagal memeriksa jawaban");
    } finally {
      setLoading(false);
      setGuess("");
    }
  };

  const revealHint = () => {
    if (shownHints < hints.length) {
      setShownHints(prev => prev + 1);
      setBlurLevel(prev => Math.max(prev - 1, 0));
    }
  };

  const nextRound = () => {
    setResult(null);
    fetchNewImage();
  };

  const resetGame = () => {
    setDifficulty(null);
    setScore(0);
    setQuestionNum(0);
    setImageData("");
    setAnswer("");
    setResult(null);
    setGameOver(false);
    setError("");
  };

  // Level progress
  const level = playerData.level;
  const currentThreshold = getCurrentLevelThreshold(level);
  const nextThreshold = getNextLevelThreshold(level);
  const progress = ((playerData.totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

  // Difficulty selection
  if (!difficulty) {
    return (
      <div className="space-y-4">
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-bold">Level {level}</span>
              <span className="text-xs text-muted-foreground ml-auto">{playerData.totalPoints} poin</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Credits & Free plays */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} />
          </div>
          <BuyCreditsDialog visitorId={activeVisitorId} onPurchased={fetchCredits} />
        </div>

        <p className="text-sm text-muted-foreground text-center">Pilih tingkat kesulitan:</p>
        <div className="grid gap-2">
          {DIFFICULTIES.map(d => (
            <motion.div key={d.key} whileTap={{ scale: 0.97 }}>
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-3"
                onClick={() => setDifficulty(d.key)}
              >
                <span className={`font-bold ${d.color}`}>{d.label}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {d.time}s
                </span>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm">
        <Badge variant="outline" className="gap-1">
          <Star className="w-3 h-3 text-yellow-500" /> Lv.{level}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Trophy className="w-3 h-3 text-primary" /> {score} poin
        </Badge>
        <Badge variant={timeLeft <= 10 ? "destructive" : "outline"} className={`gap-1 ${timeLeft <= 20 && timeLeft > 10 ? "text-orange-500 animate-pulse border-orange-500" : timeLeft <= 30 && timeLeft > 20 ? "text-yellow-600 border-yellow-600" : ""}`}>
          <Clock className="w-3 h-3" /> {timeLeft}s
        </Badge>
      </div>

      {/* Wrong count */}
      <div className="flex gap-1 justify-center">
        {[0, 1, 2].map(i => (
          <XCircle key={i} className={`w-5 h-5 ${i < wrongCount ? "text-destructive" : "text-muted"}`} />
        ))}
      </div>

      {!gameOver && (
        <PowerUpsBar
          enabled={!gameOver}
          onUseHint={() => setShownHints(s => Math.min(hints.length, s + 1))}
          onUseTimeFreeze={(s) => setTimeLeft(t => t + s)}
        />
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" /> {error}
            <Button size="sm" variant="ghost" onClick={fetchNewImage} className="ml-auto">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Image area */}
      {loading && !imageData ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI sedang membuat gambar...</p>
          </CardContent>
        </Card>
      ) : imageData ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="overflow-hidden">
            <CardContent className="p-0 relative">
              <img
                src={imageData}
                alt="Tebak gambar ini"
                 className="w-full aspect-square object-contain bg-muted/30 transition-all duration-300"
                style={{ filter: result === "correct" || gameOver ? "none" : `blur(${blurLevel}px)` }}
              />
              {letterCount > 0 && !result && !gameOver && (
                <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur rounded-md px-2 py-1 text-xs font-bold">
                  {letterCount} huruf
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
            <p className="text-sm font-semibold">Gambar belum berhasil dimuat</p>
            <Button size="sm" variant="outline" onClick={fetchNewImage}>
              <RefreshCw className="w-4 h-4 mr-1" /> Muat Ulang
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Hints */}
      {shownHints > 0 && (
        <div className="space-y-1">
          {hints.slice(0, shownHints).map((h, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-start gap-2 text-xs bg-muted/50 rounded-lg p-2">
                <Lightbulb className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                <span>{h}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Game result */}
      <AnimatePresence>
        {result === "correct" && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="font-bold text-green-600">Benar! Jawabannya: {answer}</p>
                <p className="text-xs text-muted-foreground mt-1">+{earnedPoints} poin</p>
                <Button className="mt-3" onClick={nextRound}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Gambar Berikutnya
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {gameOver && result !== "correct" && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Card className="border-destructive/50 bg-destructive/10">
              <CardContent className="p-4 text-center">
                <XCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="font-bold text-destructive">
                  {timeLeft <= 0 ? "Waktu habis!" : "3x salah!"}
                </p>
                <p className="text-sm mt-1">Jawabannya: <strong>{answer}</strong></p>
                <ReviveButton onRevive={() => {
                  setWrongCount(w => Math.max(0, w - 1));
                  setGameOver(false);
                  setResult(null);
                  if (timeLeft <= 0) {
                    setTimeLeft(30);
                    setTimerActive(true);
                  }
                }} />
                <div className="flex gap-2 mt-3 justify-center">
                  <Button variant="outline" onClick={resetGame}>Menu</Button>
                  <Button onClick={nextRound}>
                    <RefreshCw className="w-4 h-4 mr-1" /> Coba Lagi
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      {!result && !gameOver && imageData && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={guess}
              onChange={e => setGuess(e.target.value)}
              placeholder="Ketik jawabanmu..."
              onKeyDown={e => e.key === "Enter" && handleGuess()}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleGuess} disabled={loading || !guess.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tebak"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={revealHint}
              disabled={shownHints >= hints.length}
              className="gap-1 text-xs"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Petunjuk ({shownHints}/{hints.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
               onClick={() => setBlurLevel(prev => Math.max(prev - 1, 0))}
              disabled={blurLevel <= 0}
              className="gap-1 text-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              Perjelas
            </Button>
            {!answerRevealed && (
              <RevealAnswerButton
                onReveal={() => setAnswerRevealed(true)}
                visitorId={activeVisitorId}
                useCredit={useCredit}
                credits={credits}
                isUnlimited={isUnlimited}
              />
            )}
          </div>
          {answerRevealed && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-accent/10 border border-accent/20 rounded-xl p-3 text-center"
            >
              <p className="text-xs text-muted-foreground">Kunci Jawaban:</p>
              <p className="font-extrabold text-lg text-accent">{answer}</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Credits info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} />
        </div>
        <BuyCreditsDialog visitorId={activeVisitorId} onPurchased={fetchCredits} />
      </div>

      {/* Result wrong flash */}
      <AnimatePresence>
        {result === "wrong" && !gameOver && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-sm font-bold text-destructive"
          >
            Salah! Coba lagi ({3 - wrongCount} kesempatan)
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back button */}
      <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={resetGame}>
        Kembali ke menu
      </Button>
    </div>
  );
}
