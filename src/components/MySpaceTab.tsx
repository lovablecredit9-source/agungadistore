import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AccountAvatar from "@/components/AccountAvatar";
import SmartNavRecommendations from "@/components/SmartNavRecommendations";
import { loadGameData, getNextLevelThreshold, getCurrentLevelThreshold } from "@/components/games/gameStore";
import {
  Wallet, Gamepad2, Flame, Ticket, Heart, Clock, Gift, Trophy,
  Crown, ShoppingBag, ChevronRight, Sparkles,
} from "lucide-react";

interface UserBalance {
  id: string;
  visitor_id: string;
  username: string;
  phone: string;
  email?: string | null;
  balance: number;
  bonus_balance?: number | null;
}

interface Props {
  user: UserBalance;
  onSelect: (tab: string) => void;
}

const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export default function MySpaceTab({ user, onSelect }: Props) {
  const [streak, setStreak] = useState<number>(0);
  const [wishlist, setWishlist] = useState<number>(0);
  const game = useMemo(() => loadGameData(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const vid = user.visitor_id;
      const [s, w] = await Promise.all([
        supabase.from("daily_streaks").select("current_streak").eq("visitor_id", vid).maybeSingle(),
        supabase.from("product_wishlist").select("id", { count: "exact", head: true }).eq("visitor_id", vid),
      ]);
      if (!alive) return;
      setStreak((s.data as any)?.current_streak || 0);
      setWishlist((w as any)?.count || 0);
    })();
    return () => { alive = false; };
  }, [user.visitor_id]);

  const totalBalance = (user.balance || 0) + (user.bonus_balance || 0);
  const curThreshold = getCurrentLevelThreshold(game.level);
  const nextThreshold = getNextLevelThreshold(game.level);
  const levelProgress = nextThreshold > curThreshold
    ? Math.min(100, Math.round(((game.totalPoints - curThreshold) / (nextThreshold - curThreshold)) * 100))
    : 100;

  const stats = [
    { label: "Saldo", value: rp(totalBalance), icon: Wallet, grad: "from-emerald-500 to-teal-500", tab: "saldo" },
    { label: "Level Game", value: `Lv ${game.level}`, icon: Gamepad2, grad: "from-violet-500 to-fuchsia-500", tab: "game" },
    { label: "Streak", value: `${streak} hari`, icon: Flame, grad: "from-orange-500 to-red-500", tab: "streak" },
    { label: "Wishlist", value: `${wishlist} item`, icon: Heart, grad: "from-rose-500 to-pink-500", tab: "likes" },
  ];

  const shortcuts = [
    { label: "Riwayat", desc: "Transaksi & klaim", icon: Clock, grad: "from-sky-500 to-blue-500", tab: "history" },
    { label: "Voucher", desc: "Kode & diskon", icon: Ticket, grad: "from-yellow-500 to-amber-500", tab: "voucher" },
    { label: "Suka", desc: "Produk & lagu favorit", icon: Heart, grad: "from-rose-500 to-pink-500", tab: "likes" },
    { label: "Streak Shop", desc: "Tukar koin & gem", icon: Gift, grad: "from-amber-500 to-orange-500", tab: "streakshop" },
    { label: "Peringkat", desc: "Posisi kamu", icon: Trophy, grad: "from-yellow-500 to-amber-500", tab: "peringkat" },
    { label: "Plus Hub", desc: "Premium & layanan", icon: Crown, grad: "from-sky-500 to-blue-500", tab: "plus" },
    { label: "Belanja", desc: "Produk digital", icon: ShoppingBag, grad: "from-fuchsia-500 to-pink-500", tab: "produk" },
    { label: "Roda Diskon", desc: "Putar & menang", icon: Sparkles, grad: "from-purple-500 to-fuchsia-500", tab: "rodadiskon" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header pribadi */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-fuchsia-500/10 to-transparent p-4">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <AccountAvatar visitorId={user.visitor_id} username={user.username} size={60} editable />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-primary/80">Ruang Ku</div>
            <div className="text-lg font-black leading-tight truncate">{user.username || "User"}</div>
            <div className="text-xs text-muted-foreground truncate">{user.phone}</div>
          </div>
        </div>
        {/* Progress level */}
        <div className="relative mt-3">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground mb-1">
            <span>Progress Level Game</span>
            <span>{game.totalPoints} / {nextThreshold} poin</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${levelProgress}%` }} />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => onSelect(s.tab)}
              className="text-left rounded-2xl border bg-card/70 backdrop-blur p-3 active:scale-95 transition hover:border-primary/40"
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shadow mb-2`}>
                <Icon className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">{s.label}</div>
              <div className="text-base font-black leading-tight truncate">{s.value}</div>
            </button>
          );
        })}
      </div>

      {/* Shortcuts */}
      <div>
        <div className="text-xs font-black text-foreground mb-2 px-1">Semua Milikku</div>
        <div className="grid grid-cols-2 gap-2">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => onSelect(s.tab)}
                className="group flex items-center gap-2.5 rounded-xl border bg-card/70 backdrop-blur p-2.5 active:scale-95 transition hover:border-primary/40"
              >
                <div className={`w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br ${s.grad} flex items-center justify-center shadow`}>
                  <Icon className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-[12px] font-bold leading-tight truncate">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground line-clamp-1">{s.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Rekomendasi personal */}
      <SmartNavRecommendations currentTab="myspace" onSelect={(t) => onSelect(t)} />
    </div>
  );
}
