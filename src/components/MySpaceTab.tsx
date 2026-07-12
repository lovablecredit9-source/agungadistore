import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AccountAvatar from "@/components/AccountAvatar";
import SmartNavRecommendations from "@/components/SmartNavRecommendations";
import RuangKuHub from "@/components/RuangKuHub";
import { loadGameData, getNextLevelThreshold, getCurrentLevelThreshold } from "@/components/games/gameStore";
import {
  Wallet, Gamepad2, Flame, Ticket, Heart, Clock, Gift, Trophy,
  Crown, ShoppingBag, ChevronRight, Sparkles, Music, MessageCircle,
  Users, Bell, HelpCircle, Star, Calendar, CheckCircle2, Circle, Target,
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

  // Sapaan berdasarkan waktu (WIB)
  const hour = new Date(Date.now() + 7 * 3600 * 1000).getUTCHours();
  const greeting = hour < 5 ? "Selamat dini hari" : hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";

  // Gelar pemain berdasarkan level game
  const title =
    game.level >= 50 ? { name: "Legend", grad: "from-yellow-400 via-orange-500 to-red-500" }
    : game.level >= 30 ? { name: "Master", grad: "from-fuchsia-500 to-purple-600" }
    : game.level >= 15 ? { name: "Pro", grad: "from-sky-500 to-blue-600" }
    : game.level >= 5 ? { name: "Rising Star", grad: "from-emerald-500 to-teal-600" }
    : { name: "Pemula", grad: "from-slate-500 to-gray-600" };

  // Lencana pencapaian
  const badges = [
    { label: "Streak 7 Hari", icon: Flame, done: streak >= 7 },
    { label: "Level 10", icon: Star, done: game.level >= 10 },
    { label: "10 Kemenangan", icon: Trophy, done: (game.gamesWon || 0) >= 10 },
    { label: "Wishlist 5", icon: Heart, done: wishlist >= 5 },
    { label: "Saldo Aktif", icon: Wallet, done: totalBalance > 0 },
  ];
  const badgeDone = badges.filter((b) => b.done).length;

  // Misi harian
  const missions = [
    { label: "Klaim streak hari ini", done: streak > 0, tab: "streak" },
    { label: "Main 1 game", done: (game.gamesPlayed || 0) > 0, tab: "game" },
    { label: "Putar Roda Diskon", done: false, tab: "rodadiskon" },
    { label: "Tambah 1 wishlist", done: wishlist > 0, tab: "likes" },
  ];
  const missionDone = missions.filter((m) => m.done).length;
  const missionPct = Math.round((missionDone / missions.length) * 100);

  // Tips harian (berganti tiap hari)
  const tips = [
    "Klaim streak setiap hari biar bonusnya makin gede! 🔥",
    "Main game buat naik level & buka gelar baru. 🎮",
    "Cek Roda Diskon, siapa tahu dapet potongan gede. 🎡",
    "Simpan produk favorit ke wishlist biar dapet notif turun harga. 💖",
    "Kumpulin koin & gem buat ditukar di Streak Shop. 🎁",
    "Ikut peringkat mingguan buat rebut hadiah top player. 🏆",
    "Isi saldo sekarang biar checkout makin cepat & aman. 💳",
  ];
  const dayIdx = Math.floor((Date.now() + 7 * 3600 * 1000) / 86400000) % tips.length;
  const tipToday = tips[dayIdx];

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

  const quickActions = [
    { label: "Main Game", icon: Gamepad2, grad: "from-violet-500 to-fuchsia-500", tab: "game" },
    { label: "Klaim Streak", icon: Flame, grad: "from-orange-500 to-red-500", tab: "streak" },
    { label: "Spin", icon: Sparkles, grad: "from-purple-500 to-pink-500", tab: "rodadiskon" },
    { label: "Isi Saldo", icon: Wallet, grad: "from-emerald-500 to-teal-500", tab: "saldo" },
  ];

  const explore = [
    { label: "Musik", desc: "Dengar & playlist", icon: Music, grad: "from-indigo-500 to-purple-500", tab: "musik" },
    { label: "Anon Chat", desc: "Ngobrol anonim", icon: MessageCircle, grad: "from-cyan-500 to-blue-500", tab: "anonchat" },
    { label: "Confess", desc: "Curhat & wall", icon: Users, grad: "from-pink-500 to-rose-500", tab: "confess" },
    { label: "Notifikasi", desc: "Info terbaru", icon: Bell, grad: "from-amber-500 to-yellow-500", tab: "botnotif" },
    { label: "Peringkat Mingguan", desc: "Kompetisi", icon: Star, grad: "from-yellow-500 to-orange-500", tab: "peringkat" },
    { label: "Pusat Bantuan", desc: "FAQ & support", icon: HelpCircle, grad: "from-slate-500 to-gray-500", tab: "bantuan" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header pribadi */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-fuchsia-500/10 to-transparent p-4">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <AccountAvatar visitorId={user.visitor_id} username={user.username} size={60} editable />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-primary/80">{greeting} 👋</div>
            <div className="text-lg font-black leading-tight truncate">{user.username || "User"}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black text-white bg-gradient-to-r ${title.grad} shadow`}>
                <Crown className="w-3 h-3" /> {title.name} · Lv {game.level}
              </span>
            </div>
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

      {/* Tips hari ini */}
      <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-3">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow">
          <Sparkles className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-wide text-primary/80">Tips Hari Ini</div>
          <div className="text-[12px] font-bold leading-snug">{tipToday}</div>
        </div>
      </div>



      {/* Lencana pencapaian */}
      <div className="rounded-2xl border bg-card/70 backdrop-blur p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-black text-foreground">Pencapaian</div>
          <div className="text-[10px] font-bold text-muted-foreground">{badgeDone}/{badges.length} terbuka</div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {badges.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.label}
                className={`shrink-0 flex flex-col items-center gap-1 w-[72px] rounded-xl p-2 border transition ${b.done ? "border-primary/40 bg-primary/5" : "opacity-50 grayscale"}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${b.done ? "bg-gradient-to-br from-yellow-400 to-orange-500 shadow" : "bg-muted"}`}>
                  <Icon className={`w-4.5 h-4.5 ${b.done ? "text-white" : "text-muted-foreground"}`} />
                </div>
                <div className="text-[8px] font-bold text-center leading-tight line-clamp-2">{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Misi harian */}
      <div className="rounded-2xl border bg-card/70 backdrop-blur p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-primary" />
            <div className="text-xs font-black text-foreground">Misi Harian</div>
          </div>
          <div className="text-[10px] font-bold text-muted-foreground">{missionDone}/{missions.length} selesai</div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-2.5">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${missionPct}%` }} />
        </div>
        <div className="space-y-1.5">
          {missions.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => onSelect(m.tab)}
              className="w-full flex items-center gap-2 rounded-xl border bg-background/40 p-2 active:scale-[0.98] transition hover:border-primary/40"
            >
              {m.done ? (
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="w-4.5 h-4.5 shrink-0 text-muted-foreground" />
              )}
              <span className={`text-[11px] font-bold flex-1 text-left ${m.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{m.label}</span>
              {!m.done && <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </div>


      {/* Quick actions */}
      <div>
        <div className="text-xs font-black text-foreground mb-2 px-1">Aksi Cepat</div>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => onSelect(q.tab)}
                className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card/70 backdrop-blur p-2 active:scale-95 transition hover:border-primary/40"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${q.grad} flex items-center justify-center shadow`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-[9px] font-bold leading-tight text-center line-clamp-2">{q.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily CTA banner */}
      <button
        type="button"
        onClick={() => onSelect("streak")}
        className="w-full text-left relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 shadow-lg active:scale-[0.98] transition"
      >
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/25 backdrop-blur flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1 text-white">
            <div className="text-sm font-black leading-tight">Klaim Hadiah Harian Kamu!</div>
            <div className="text-[11px] font-semibold opacity-90">Streak {streak} hari · jangan sampai putus</div>
          </div>
          <ChevronRight className="w-5 h-5 text-white shrink-0" />
        </div>
      </button>

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

      {/* Jelajahi */}
      <div>
        <div className="text-xs font-black text-foreground mb-2 px-1">Jelajahi</div>
        <div className="grid grid-cols-2 gap-2">
          {explore.map((s) => {
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



      {/* Misi Mingguan, Lucky Box & Leaderboard Saldo IN */}
      <RuangKuHub visitorId={user.visitor_id} />

      {/* Rekomendasi personal */}
      <SmartNavRecommendations currentTab="myspace" onSelect={(t) => onSelect(t)} />
    </div>
  );
}
