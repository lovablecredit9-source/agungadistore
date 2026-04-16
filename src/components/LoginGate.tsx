import { Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface LoginGateProps {
  title: string;
  description: string;
  emoji: string;
  gradient: string;
  onGoToLogin: () => void;
}

export default function LoginGate({ title, description, emoji, gradient, onGoToLogin }: LoginGateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        <div className={`mx-auto w-28 h-28 rounded-3xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl relative`}>
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 to-transparent" />
          <span className="text-5xl relative z-10">{emoji}</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>

        <div className="glass-card-strong rounded-2xl p-4 border border-primary/20 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-4 h-4 text-primary" />
            <span>Fitur ini memerlukan login saldo</span>
          </div>
          <Button
            onClick={onGoToLogin}
            className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold rounded-xl h-12 shadow-lg hover:shadow-xl transition-all gap-2"
          >
            <LogIn className="w-5 h-5" /> Login Saldo Sekarang
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Belum punya akun? Login lalu daftar di halaman Saldo.
        </p>
      </motion.div>
    </div>
  );
}
