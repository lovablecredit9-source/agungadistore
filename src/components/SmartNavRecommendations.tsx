import { useMemo } from "react";
import { getNavActivity } from "@/lib/nav-activity";
import {
  Sparkles, Music, Gamepad2, Flame, Gift, Trophy, Ticket, Wallet,
  ShoppingBag, MessageCircleHeart, Crown, Disc3, ArrowRight, Zap,
} from "lucide-react";

type FeatureKey =
  | "produk" | "musik" | "game" | "streak" | "plus" | "peringkat"
  | "voucher" | "saldo" | "confess" | "storeai" | "rodadiskon" | "streakshop";

interface Feature {
  key: FeatureKey;
  label: string;
  desc: string;
  icon: React.ElementType;
  gradient: string;
}

const FEATURES: Feature[] = [
  { key: "produk", label: "Belanja Produk", desc: "Produk digital murah & terpercaya", icon: ShoppingBag, gradient: "from-fuchsia-500 to-pink-500" },
  { key: "musik", label: "Musik", desc: "Dengar lagu, mood radio & rekomendasi AI", icon: Music, gradient: "from-violet-500 to-indigo-500" },
  { key: "game", label: "Mini Games", desc: "Main game seru & kumpulin hadiah", icon: Gamepad2, gradient: "from-emerald-500 to-teal-500" },
  { key: "streak", label: "Daily Streak", desc: "Klaim hadiah harian tiap hari", icon: Flame, gradient: "from-orange-500 to-red-500" },
  { key: "streakshop", label: "Streak Shop", desc: "Tukar koin & gem jadi hadiah", icon: Gift, gradient: "from-amber-500 to-orange-500" },
  { key: "peringkat", label: "Peringkat", desc: "Cek posisi kamu di leaderboard", icon: Trophy, gradient: "from-yellow-500 to-amber-500" },
  { key: "voucher", label: "Voucher", desc: "Kumpulin voucher diskon", icon: Ticket, gradient: "from-rose-500 to-pink-500" },
  { key: "saldo", label: "Saldo & Deposit", desc: "Isi saldo & pantau transaksi", icon: Wallet, gradient: "from-green-500 to-emerald-500" },
  { key: "plus", label: "Plus Hub", desc: "Kelola premium & layanan spesial", icon: Crown, gradient: "from-sky-500 to-blue-500" },
  { key: "confess", label: "Confess", desc: "Kirim pesan anonim & wall publik", icon: MessageCircleHeart, gradient: "from-pink-500 to-fuchsia-500" },
  { key: "storeai", label: "Store AI", desc: "Tanya AI seputar produk toko", icon: Sparkles, gradient: "from-cyan-500 to-blue-500" },
  { key: "rodadiskon", label: "Roda Diskon", desc: "Putar roda, menangkan diskon", icon: Disc3, gradient: "from-purple-500 to-fuchsia-500" },
];

interface Props {
  currentTab: string;
  onSelect: (tab: FeatureKey) => void;
}

export default function SmartNavRecommendations({ currentTab, onSelect }: Props) {
  const items = useMemo(() => {
    const activity = getNavActivity();
    const scored = FEATURES.filter((f) => f.key !== currentTab).map((f) => {
      const a = activity[f.key];
      const count = a?.count || 0;
      const last = a?.last || 0;
      const daysSince = last ? (Date.now() - last) / 86400000 : Infinity;

      let score: number;
      let reason: string;
      if (count === 0) {
        // Belum pernah dibuka → dorong eksplorasi
        score = 60 + Math.random() * 20;
        reason = "Belum kamu coba ✨";
      } else if (daysSince > 2) {
        // Lama nggak dibuka → ajak balik
        score = 40 + count * 3 + daysSince;
        reason = "Lama nggak mampir, cek lagi yuk";
      } else {
        // Sering dipakai → lanjutkan
        score = 20 + count * 5;
        reason = "Favorit kamu, lanjutkan";
      }
      return { f, score, reason };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 6);
  }, [currentTab]);

  if (items.length === 0) return null;

  return (
    <div className="mb-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-transparent p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 flex items-center justify-center shadow">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="text-xs font-black text-foreground">Rekomendasi Untukmu</div>
        <span className="text-[9px] font-bold text-muted-foreground bg-primary/10 px-1.5 py-0.5 rounded-full">KHUSUS USER</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ f, reason }) => {
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onSelect(f.key)}
              className="group text-left rounded-xl border bg-card/70 backdrop-blur p-2.5 active:scale-95 transition hover:border-primary/40"
            >
              <div className="flex items-start gap-2">
                <div className={`w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow`}>
                  <Icon className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold leading-tight flex items-center gap-1">
                    <span className="truncate">{f.label}</span>
                    <ArrowRight className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition -translate-x-1 group-hover:translate-x-0" />
                  </div>
                  <div className="text-[10px] text-muted-foreground line-clamp-1">{f.desc}</div>
                </div>
              </div>
              <div className="mt-1.5 text-[9px] font-semibold text-primary flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{reason}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
