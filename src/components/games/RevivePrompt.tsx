import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { HeartPulse, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { consumePowerUp, loadPowerUps } from "./gameStore";

interface RevivePromptProps {
  active: boolean;
  seconds?: number;
  scoreLabel?: string;
  onRevive: () => void;
  onExpire: () => void;
}

export default function RevivePrompt({
  active,
  seconds = 10,
  scoreLabel,
  onRevive,
  onExpire,
}: RevivePromptProps) {
  const { toast } = useToast();
  const [left, setLeft] = useState(seconds);
  const [lives, setLives] = useState(0);

  useEffect(() => {
    if (!active) return;
    let remaining = seconds;
    setLeft(remaining);
    setLives(loadPowerUps().extra_life || 0);

    const timer = window.setInterval(() => {
      remaining -= 1;
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        window.clearInterval(timer);
        onExpire();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [active, seconds, onExpire]);

  if (!active) return null;

  const revive = () => {
    if (!consumePowerUp("extra_life")) {
      setLives(loadPowerUps().extra_life || 0);
      toast({ title: "Nyawa habis", description: "Kamu tidak punya Nyawa Ekstra.", variant: "destructive" });
      return;
    }
    setLives(loadPowerUps().extra_life || 0);
    onRevive();
  };

  return (
    <div className="text-center p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-2">
      <div className="flex items-center justify-center gap-2 font-extrabold text-rose-600">
        <HeartPulse className="w-5 h-5 fill-current" /> Pakai Nyawa?
      </div>
      {scoreLabel && <p className="text-xs text-muted-foreground">{scoreLabel}</p>}
      <div className="flex items-center justify-center gap-1 text-sm font-black tabular-nums">
        <Timer className="w-4 h-4" /> {left}s
      </div>
      <Button size="sm" onClick={revive} disabled={lives <= 0} className="gap-1">
        <HeartPulse className="w-3.5 h-3.5 fill-current" /> Hidup Lagi ({lives})
      </Button>
      <p className="text-[10px] text-muted-foreground">Kalau tidak dipakai dalam 10 detik, baru Game Over.</p>
    </div>
  );
}