import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Crown, Gem, Sparkles, Lock, Check, Star, Gift, Zap, Flame, Trophy } from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

interface Tier {
  id: string;
  name: string;
  minXp: number;
  icon: string;
  color: string;
  perks: string[];
}

const TIERS: Tier[] = [
  { id: "bronze", name: "Bronze VIP", minXp: 0, icon: "🥉", color: "from-amber-700 to-orange-700", perks: ["Akses dasar", "Streak boost +5%"] },
  { id: "silver", name: "Silver VIP", minXp: 100, icon: "🥈", color: "from-slate-300 to-slate-500", perks: ["Bonus harian +10 koin", "Streak boost +10%", "1x extra spin"] },
  { id: "gold", name: "Gold VIP", minXp: 300, icon: "🥇", color: "from-yellow-400 to-amber-600", perks: ["Bonus harian +30 koin", "Streak boost +20%", "3x extra spin", "Mystery box premium 1x/minggu"] },
  { id: "platinum", name: "Platinum VIP", minXp: 700, icon: "💎", color: "from-cyan-300 to-blue-500", perks: ["Bonus harian +75 koin", "Streak boost +35%", "Spin tak terbatas", "Early access fitur baru"] },
  { id: "diamond", name: "Diamond Elite", minXp: 1500, icon: "👑", color: "from-purple-400 via-fuchsia-500 to-pink-500", perks: ["Bonus harian +200 koin", "Streak boost +50%", "Eksklusif Diamond skin", "Avatar khusus VIP"] },
];

const EXCLUSIVE_ITEMS = [
  { id: "diamond_aura", icon: "💠", name: "Diamond Aura", desc: "Aura permanen di profil", costGem: 50, tier: "platinum", rarity: "legendary" },
  { id: "golden_crown", icon: "👑", name: "Golden Crown Title", desc: "Title eksklusif royalty", costGem: 30, tier: "gold", rarity: "epic" },
  { id: "phoenix_skin", icon: "🔥", name: "Phoenix Skin", desc: "Skin api abadi (epic)", costGem: 80, tier: "diamond", rarity: "legendary" },
  { id: "void_frame", icon: "🌌", name: "Void Frame", desc: "Frame avatar galaksi", costGem: 25, tier: "silver", rarity: "rare" },
  { id: "sunshine_emote", icon: "☀️", name: "Sunshine Emote", desc: "Emoji animasi eksklusif", costGem: 15, tier: "bronze", rarity: "common" },
  { id: "midnight_card", icon: "🌙", name: "Midnight Card", desc: "Kartu profil tema malam", costGem: 40, tier: "gold", rarity: "epic" },
];

const RARITY_COLORS: Record<string, string> = {
  common: "from-slate-500 to-slate-700",
  rare: "from-blue-500 to-cyan-600",
  epic: "from-fuchsia-500 to-purple-700",
  legendary: "from-amber-400 via-yellow-500 to-orange-600",
};

const TIER_RANK: Record<string, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4 };

export default function VIPLoungeShop({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const xpKey = `vip-xp-${visitorId}`;
  const ownedKey = `vip-owned-${visitorId}`;
  const dailyKey = `vip-daily-${visitorId}-${new Date().toISOString().split("T")[0]}`;

  const [xp, setXp] = useState(0);
  const [owned, setOwned] = useState<string[]>([]);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [purchase, setPurchase] = useState<typeof EXCLUSIVE_ITEMS[number] | null>(null);

  useEffect(() => {
    setXp(Number(localStorage.getItem(xpKey) || "0"));
    try { setOwned(JSON.parse(localStorage.getItem(ownedKey) || "[]")); } catch {}
    setDailyClaimed(!!localStorage.getItem(dailyKey));
  }, [xpKey, ownedKey, dailyKey]);

  const currentTier = [...TIERS].reverse().find((t) => xp >= t.minXp) || TIERS[0];
  const nextTier = TIERS.find((t) => t.minXp > xp);
  const tierProgress = nextTier ? Math.min(100, ((xp - currentTier.minXp) / (nextTier.minXp - currentTier.minXp)) * 100) : 100;

  function gainXp(amount: number, reason: string) {
    const newXp = xp + amount;
    setXp(newXp);
    localStorage.setItem(xpKey, String(newXp));
    toast({ title: `+${amount} VIP XP`, description: reason });
  }

  function claimDaily() {
    if (dailyClaimed) return;
    const tierBonus = TIER_RANK[currentTier.id] * 30 + 20; // bronze=20, diamond=140
    gainXp(15, "Bonus check-in harian VIP");
    try {
      const bonusKey = `dcr-bonus-${visitorId}`;
      const cur = Number(localStorage.getItem(bonusKey) || "0");
      localStorage.setItem(bonusKey, String(cur + tierBonus));
    } catch {}
    setDailyClaimed(true);
    localStorage.setItem(dailyKey, "1");
    toast({ title: `🎁 ${currentTier.name} Daily Reward`, description: `+${tierBonus} koin masuk ke bonus profilmu!` });
    onUpdate?.();
  }

  function buyItem(item: typeof EXCLUSIVE_ITEMS[number]) {
    const need = TIER_RANK[item.tier];
    const have = TIER_RANK[currentTier.id];
    if (have < need) {
      toast({ title: "Tier kurang", description: `Butuh tier ${item.tier.toUpperCase()} untuk membuka item ini`, variant: "destructive" });
      return;
    }
    setPurchase(item);
  }

  function confirmBuy() {
    if (!purchase) return;
    // Simulasi: cuma client-side cosmetic; tidak potong gem real
    const newOwned = [...owned, purchase.id];
    setOwned(newOwned);
    localStorage.setItem(ownedKey, JSON.stringify(newOwned));
    gainXp(50, `Beli ${purchase.name}`);
    toast({ title: `✨ ${purchase.name} dimiliki!`, description: "Item kosmetik telah ditambahkan ke koleksi VIP-mu." });
    setPurchase(null);
    onUpdate?.();
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-orange-500/15 border-2 border-amber-400/50 p-3 sm:p-4 shadow-2xl relative overflow-hidden">
      {/* Crown decoration */}
      <Crown className="absolute -top-2 -right-2 h-16 w-16 text-amber-400/10" />

      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-300 animate-pulse" />
          <h3 className="font-bold text-base sm:text-lg bg-gradient-to-r from-amber-200 via-yellow-100 to-orange-200 bg-clip-text text-transparent">
            VIP Lounge Shop
          </h3>
          <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[9px] h-4 border-0 font-black">EXCLUSIVE</Badge>
        </div>
      </div>

      {/* Current tier card */}
      <motion.div
        layout
        className={`rounded-2xl bg-gradient-to-br ${currentTier.color} bg-opacity-30 border-2 border-white/30 p-3 mb-3 relative overflow-hidden`}
      >
        <div className="absolute top-0 right-0 text-7xl opacity-20">{currentTier.icon}</div>
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[10px] text-white/80 uppercase tracking-wider">Tier saat ini</p>
              <p className="font-black text-lg text-white">{currentTier.icon} {currentTier.name}</p>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
              <Star className="h-3 w-3 mr-0.5" /> {xp} XP
            </Badge>
          </div>
          {nextTier ? (
            <>
              <Progress value={tierProgress} className="h-1.5 mb-1" />
              <p className="text-[10px] text-white/90">
                {nextTier.minXp - xp} XP lagi → {nextTier.icon} {nextTier.name}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-amber-100 font-bold">👑 Tier maksimum tercapai!</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {currentTier.perks.map((p, i) => (
              <Badge key={i} className="bg-black/30 text-white border-white/20 text-[9px] h-4">
                <Check className="h-2.5 w-2.5 mr-0.5" /> {p}
              </Badge>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Daily VIP claim */}
      <Button
        disabled={dailyClaimed}
        onClick={claimDaily}
        className={`w-full h-10 mb-3 font-black ${dailyClaimed ? "bg-emerald-600/30 text-emerald-200 cursor-not-allowed" : "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:shadow-lg"}`}
      >
        {dailyClaimed ? <><Check className="h-4 w-4 mr-1" /> Sudah klaim hari ini</> : (
          <><Gift className="h-4 w-4 mr-1" /> Klaim {currentTier.name} Daily Reward</>
        )}
      </Button>

      {/* Tier ladder */}
      <div className="rounded-xl bg-black/20 border border-white/10 p-2 mb-3">
        <p className="text-[10px] text-white/70 uppercase tracking-wider mb-1.5">Tier Ladder</p>
        <div className="flex justify-between gap-1">
          {TIERS.map((t) => {
            const isActive = t.id === currentTier.id;
            const isUnlocked = xp >= t.minXp;
            return (
              <div key={t.id} className={`flex-1 text-center rounded-lg p-1 ${isActive ? `bg-gradient-to-br ${t.color} bg-opacity-50 ring-1 ring-white/40` : isUnlocked ? "bg-white/10" : "bg-black/30 opacity-50"}`}>
                <div className="text-lg">{t.icon}</div>
                <p className="text-[8px] font-bold text-white truncate">{t.name.split(" ")[0]}</p>
                <p className="text-[7px] text-white/60">{t.minXp}xp</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exclusive items */}
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
        <p className="text-[11px] font-bold text-amber-100 uppercase tracking-wider">Eksklusif VIP</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {EXCLUSIVE_ITEMS.map((item) => {
          const isOwned = owned.includes(item.id);
          const need = TIER_RANK[item.tier];
          const have = TIER_RANK[currentTier.id];
          const locked = have < need;
          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: locked ? 1 : 1.02 }}
              className={`rounded-xl bg-gradient-to-br ${RARITY_COLORS[item.rarity]} bg-opacity-25 border ${locked ? "border-white/10 opacity-60" : "border-white/30"} p-2 text-center relative`}
            >
              {locked && (
                <div className="absolute top-1 right-1">
                  <Lock className="h-3 w-3 text-white/70" />
                </div>
              )}
              <div className="text-2xl mb-0.5">{item.icon}</div>
              <p className="font-bold text-[10px] text-white truncate">{item.name}</p>
              <p className="text-[8px] text-white/70 truncate">{item.desc}</p>
              <Badge className="bg-black/30 text-white/90 text-[8px] h-3 px-1 my-0.5 border-0 capitalize">{item.tier}</Badge>
              <Button
                size="sm"
                disabled={isOwned || locked}
                onClick={() => buyItem(item)}
                className={`w-full h-6 text-[10px] mt-1 ${isOwned ? "bg-emerald-500/30 text-emerald-100" : locked ? "bg-black/30 text-white/50" : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"}`}
              >
                {isOwned ? <><Check className="h-3 w-3 mr-0.5" /> Punya</> : locked ? "Terkunci" : (
                  <><Gem className="h-3 w-3 mr-0.5" />{item.costGem}</>
                )}
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Purchase confirm modal */}
      <AnimatePresence>
        {purchase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPurchase(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className={`max-w-xs w-full rounded-3xl bg-gradient-to-br ${RARITY_COLORS[purchase.rarity]} border-2 border-white/40 p-5 text-center shadow-2xl`}
            >
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-6xl mb-2">
                {purchase.icon}
              </motion.div>
              <p className="font-black text-lg text-white">{purchase.name}</p>
              <p className="text-xs text-white/90 mb-3">{purchase.desc}</p>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge className="bg-black/30 text-white border-white/30 text-[10px] capitalize">{purchase.rarity}</Badge>
                <Badge className="bg-cyan-500/40 text-cyan-100 border-cyan-300/50 text-[10px]">
                  <Gem className="h-3 w-3 mr-0.5" /> {purchase.costGem} (simulasi)
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setPurchase(null)} variant="outline" className="flex-1 bg-black/30 text-white border-white/30 hover:bg-black/50">
                  Batal
                </Button>
                <Button onClick={confirmBuy} className="flex-1 bg-white/30 hover:bg-white/40 text-white border border-white/40 font-bold">
                  <Trophy className="h-4 w-4 mr-1" /> Beli
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
