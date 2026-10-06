import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Lock, Check, Coins, Gem, Crown, Timer, Backpack, Sparkles } from "lucide-react";
import { EmojiIcon } from "./emojiToIcon";
import { formatCompactNumber } from "@/lib/utils";

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";
interface StoreItem {
  id: string; name: string; description: string; icon: string; reward_type: string; reward_value: number;
  cost_coins: number; cost_gems: number; stock: number; rarity: Rarity; category: string; required_streak: number;
  plus_only: boolean; is_featured: boolean; duration_hours: number | null;
  price_coins: number; price_source: "normal" | "flash" | "daily"; price_ends_at: string | null;
  locked_streak: boolean; locked_plus: boolean; owned_qty: number;
}
interface InvRow { id: string; item_name: string; icon: string; rarity: Rarity; reward_type: string; quantity: number; is_equipped: boolean; expires_at: string | null; last_applied_date: string | null }

export const RARITY_LABEL: Record<Rarity, string> = { common: "COMMON", rare: "RARE", epic: "EPIC", legendary: "LEGENDARY", mythic: "MYTHIC" };
const CATS = [
  { id: "all", label: "✨ Semua" }, { id: "boost", label: "🔥 Boost" }, { id: "reward", label: "🎁 Reward" },
  { id: "profile", label: "🎨 Profile" }, { id: "avatar", label: "🖼️ Avatar" }, { id: "badge", label: "🏷️ Badge" },
  { id: "effect", label: "✨ Effect" }, { id: "voucher", label: "🎟️ Voucher" }, { id: "protection", label: "🛡️ Protection" },
  { id: "utility", label: "⚡ Utility" }, { id: "exclusive", label: "👑 Exclusive" },
];

function fmtLeft(ms: number) {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}h ${h % 24}j` : [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function Particles({ n = 5 }: { n?: number }) {
  return <>{Array.from({ length: n }).map((_, i) => (
    <span key={i} className="rarity-particle" style={{ left: `${12 + i * 18}%`, bottom: 4, animationDelay: `${i * 0.7}s` }} />
  ))}</>;
}

interface Props { visitorId: string; coins: number; gems: number; onPurchased: (item: StoreItem) => void; scope?: "all" | "game" }

/** Item types that actually work inside games (power-ups, XP boost, credits, mystery box). */
const GAME_REWARD_TYPES = new Set(["extra_life", "auto_hint", "time_freeze", "double_xp", "game_credit", "mystery_box"]);
const CONFIRM_COINS = 1000;

export default function StreakShopStore({ visitorId, coins, gems, onPurchased, scope = "all" }: Props) {
  const [confirmBuy, setConfirmBuy] = useState<{ item: StoreItem; method: "coin" | "gem" } | null>(null);
  const { toast } = useToast();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [view, setView] = useState<"shop" | "inventory">("shop");
  const [selected, setSelected] = useState<StoreItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ item: StoreItem; summary: string } | null>(null);
  const [inv, setInv] = useState<InvRow[]>([]);
  const [plus, setPlus] = useState<any>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [offset, setOffset] = useState(0); // server - client clock
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.functions.invoke("streak-shop-redeem", { body: { action: "catalog", visitorId } }),
      supabase.functions.invoke("streak-shop-redeem", { body: { action: "inventory", visitorId } }),
    ]);
    if (c?.items) {
      setItems(scope === "game" ? c.items.filter((i: StoreItem) => GAME_REWARD_TYPES.has(i.reward_type)) : c.items); setPlus(c.plus); setStreakDays(c.currentStreak || 0);
      if (c.serverNow) setOffset(new Date(c.serverNow).getTime() - Date.now());
    }
    setInv((i?.inventory || []).filter((r: InvRow) => r.reward_type !== "plus_daily_marker"));
    setLoading(false);
  }, [visitorId, scope]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const serverNow = now + offset;

  const flash = useMemo(() => items.filter((i) => i.price_source === "flash"), [items]);
  const daily = useMemo(() => items.filter((i) => i.price_source === "daily"), [items]);
  const featured = useMemo(() => items.filter((i) => i.is_featured).slice(0, 8), [items]);
  const filtered = useMemo(() => cat === "all" ? items : items.filter((i) => i.category === cat), [items, cat]);

  function requestBuy(item: StoreItem, method: "coin" | "gem") {
    const expensive = method === "coin" ? item.price_coins >= CONFIRM_COINS : item.cost_gems >= CONFIRM_COINS / 10;
    if (expensive) { setConfirmBuy({ item, method }); return; }
    buy(item, method);
  }

  async function buy(item: StoreItem, method: "coin" | "gem") {
    setConfirmBuy(null);
    setBusy(item.id + method);
    try {
      const { data, error } = await supabase.functions.invoke("streak-shop-redeem", { body: { visitorId, itemId: item.id, paymentMethod: method } });
      if (error || data?.error) { toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" }); return; }
      setSelected(null);
      setSuccess({ item, summary: data.rewardCode ? `Kode: ${data.rewardCode}` : data.rewardSummary });
      onPurchased(item);
      load();
    } finally { setBusy(null); }
  }

  async function invAction(row: InvRow, action: "use" | "equip" | "unequip") {
    setBusy(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("streak-shop-redeem", { body: { visitorId, action, inventoryId: row.id } });
      if (error || data?.error) { toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" }); return; }
      if (action === "use") toast({ title: `🎁 ${RARITY_LABEL[data.rarity as Rarity]}!`, description: `+${data.coins} Streak Coin` });
      else toast({ title: action === "equip" ? "✓ Dipasang" : "Dilepas" });
      onPurchased(row as any);
      load();
    } finally { setBusy(null); }
  }

  const Card = ({ it, compact = false }: { it: StoreItem; compact?: boolean }) => {
    const locked = it.locked_streak || it.locked_plus;
    const left = it.price_ends_at ? new Date(it.price_ends_at).getTime() - serverNow : 0;
    return (
      <motion.button type="button" layout whileTap={{ scale: 0.96 }} onClick={() => setSelected(it)}
        className={`rarity-card rarity-${it.rarity} p-3 text-left flex flex-col ${compact ? "w-36 shrink-0" : ""} ${locked ? "opacity-70" : ""}`}>
        {(it.rarity === "legendary" || it.rarity === "mythic" || it.rarity === "epic") && <Particles n={it.rarity === "mythic" ? 6 : 4} />}
        <div className="relative flex items-start justify-between gap-1">
          <span className={`rarity-chip text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full`}>{RARITY_LABEL[it.rarity]}</span>
          {it.plus_only && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-black flex items-center gap-0.5"><Crown className="w-2.5 h-2.5" />PLUS</span>}
        </div>
        <div className="relative my-2 flex justify-center"><EmojiIcon emoji={it.icon} className="w-11 h-11 drop-shadow-[0_0_12px_rgba(255,255,255,.35)]" /></div>
        <div className="relative font-extrabold text-white text-xs leading-tight line-clamp-2 min-h-[2rem]">{it.name}</div>
        <div className="relative mt-1.5 flex items-center gap-1 text-[11px] font-black tabular-nums">
          <Coins className="w-3.5 h-3.5 text-amber-300" />
          {it.price_source !== "normal" && <span className="line-through text-white/40 text-[9px]">{it.cost_coins}</span>}
          <span className="text-amber-200">{formatCompactNumber(it.price_coins)}</span>
        </div>
        <div className="relative mt-1 text-[9px] font-bold">
          {locked ? (
            <span className="text-rose-300 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" />{it.locked_plus ? "Khusus Plus" : `Streak ${it.required_streak} Hari`}</span>
          ) : it.price_source !== "normal" && left > 0 ? (
            <span className="text-cyan-200 flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" />{fmtLeft(left)}</span>
          ) : it.owned_qty > 0 ? <span className="text-emerald-300">Dimiliki ×{it.owned_qty}</span> : <span className="text-emerald-300/80 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />Terbuka</span>}
        </div>
      </motion.button>
    );
  };

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-300" /></div>;

  return (
    <div className="space-y-4 min-w-0">
      {/* Header */}
      <div className="rounded-2xl p-4 plus-hero-bg border border-amber-400/30 relative overflow-hidden">
        <h3 className="text-xl font-black text-white tracking-tight">{scope === "game" ? "🛒 GAME SHOP" : "🔥 STREAK SHOP"}</h3>
        <p className="text-[11px] text-white/70">{scope === "game" ? "Power-up, XP boost, credit & mystery box untuk game — dibayar Streak Coin atau Gem" : "Gunakan Streak Coin untuk mendapatkan item eksklusif"}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black tabular-nums">
          <span className="px-2.5 py-1 rounded-full bg-black/40 border border-amber-400/40 text-amber-200">🔥 Streak Coin: {coins.toLocaleString("id-ID")}</span>
          <span className="px-2.5 py-1 rounded-full bg-black/40 border border-cyan-400/40 text-cyan-200">💎 Gem: {gems.toLocaleString("id-ID")}</span>
          <span className="px-2.5 py-1 rounded-full bg-black/40 border border-orange-400/40 text-orange-200">🔥 {streakDays} Hari</span>
          {plus && <span className="px-2.5 py-1 rounded-full bg-amber-400 text-black">👑 {plus.plan_name}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 border border-white/10">
        {(["shop", "inventory"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`min-h-10 rounded-lg text-xs font-black transition ${view === v ? "bg-amber-400 text-black" : "text-white/70"}`}>
            {v === "shop" ? "🛒 Shop" : `🎒 Inventory (${inv.length})`}
          </button>
        ))}
      </div>

      {view === "shop" ? (
        <>
          {flash.length > 0 && (
            <section>
              <h4 className="text-xs font-black text-cyan-200 tracking-widest mb-2">⚡ FLASH SALE</h4>
              <div className="flex gap-2 overflow-x-auto pb-1 snap-x">{flash.map((it) => <Card key={it.id} it={it} compact />)}</div>
            </section>
          )}
          {daily.length > 0 && (
            <section>
              <h4 className="text-xs font-black text-pink-200 tracking-widest mb-2">🎁 DAILY DEAL <span className="text-white/50 font-bold">· reset 00:00 WIB</span></h4>
              <div className="flex gap-2 overflow-x-auto pb-1">{daily.map((it) => <Card key={it.id} it={it} compact />)}</div>
            </section>
          )}
          {featured.length > 0 && (
            <section>
              <h4 className="text-xs font-black text-amber-200 tracking-widest mb-2">⭐ FEATURED</h4>
              <div className="flex gap-2 overflow-x-auto pb-1">{featured.map((it) => <Card key={it.id} it={it} compact />)}</div>
            </section>
          )}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {CATS.filter((c) => c.id === "all" || items.some((i) => i.category === c.id)).map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 min-h-9 px-3 rounded-full text-[11px] font-black border transition ${cat === c.id ? "bg-white text-black border-white" : "bg-black/40 text-white/70 border-white/15"}`}>{c.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map((it) => <Card key={it.id} it={it} />)}
            {filtered.length === 0 && <p className="col-span-full text-center text-xs text-white/50 py-6">Belum ada item di kategori ini.</p>}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {inv.length === 0 && <p className="text-center text-xs text-white/50 py-8"><Backpack className="w-8 h-8 mx-auto mb-2 opacity-50" />Inventory kosong.</p>}
          {inv.map((r) => {
            const expired = r.expires_at ? new Date(r.expires_at).getTime() < serverNow : false;
            const cosmetic = r.reward_type.startsWith("cosmetic_");
            const status = expired ? "Expired" : r.is_equipped ? "Active" : r.reward_type === "streak_boost" ? "Active" : r.quantity > 0 || cosmetic ? "Owned" : "Habis";
            return (
              <div key={r.id} className={`rarity-card rarity-${r.rarity} p-3 flex items-center gap-3`}>
                <EmojiIcon emoji={r.icon || "🎁"} className="w-9 h-9 relative" />
                <div className="relative flex-1 min-w-0">
                  <div className="text-xs font-extrabold text-white truncate">{r.item_name}</div>
                  <div className="text-[10px] text-white/60">
                    <span className="rarity-text font-black">{RARITY_LABEL[r.rarity]}</span> · {status}
                    {!cosmetic && r.reward_type !== "streak_boost" && ` · ×${r.quantity}`}
                    {r.expires_at && !expired && ` · sisa ${fmtLeft(new Date(r.expires_at).getTime() - serverNow)}`}
                  </div>
                </div>
                <div className="relative">
                  {cosmetic ? (
                    <button disabled={busy === r.id} onClick={() => invAction(r, r.is_equipped ? "unequip" : "equip")} className={`min-h-9 px-3 rounded-lg text-[10px] font-black ${r.is_equipped ? "bg-white/15 text-white" : "bg-amber-400 text-black"}`}>{r.is_equipped ? "UNEQUIP" : "EQUIP"}</button>
                  ) : r.reward_type === "mystery_box" ? (
                    <button disabled={busy === r.id || r.quantity <= 0} onClick={() => invAction(r, "use")} className="min-h-9 px-3 rounded-lg text-[10px] font-black bg-pink-500 text-white disabled:opacity-40">BUKA</button>
                  ) : <span className="text-[9px] text-white/50 font-bold">Otomatis saat klaim</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-0 bg-transparent">
          {selected && (() => {
            const it = selected; const locked = it.locked_streak || it.locked_plus;
            const canCoin = !locked && coins >= it.price_coins; const canGem = !locked && it.cost_gems > 0 && gems >= it.cost_gems;
            return (
              <div className={`rarity-card rarity-${it.rarity} p-5`}>
                <Particles n={6} />
                <div className="relative flex justify-center py-4"><motion.div initial={{ scale: .6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}><EmojiIcon emoji={it.icon} className="w-24 h-24 drop-shadow-[0_0_24px_rgba(255,255,255,.4)]" /></motion.div></div>
                <div className="relative text-center">
                  <span className="rarity-chip text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full">{RARITY_LABEL[it.rarity]}</span>
                  <DialogTitle className="mt-2 text-xl font-black text-white">{it.name.toUpperCase()}</DialogTitle>
                  <p className="text-xs text-white/70 mt-1">{it.description}</p>
                </div>
                <div className="relative mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-black/40 p-2"><div className="text-white/50">Harga</div><div className="font-black text-amber-200">🔥 {it.price_coins.toLocaleString("id-ID")} Coin{it.price_source !== "normal" && <span className="ml-1 line-through text-white/40">{it.cost_coins}</span>}</div></div>
                  <div className="rounded-lg bg-black/40 p-2"><div className="text-white/50">Requirement</div><div className={`font-black ${it.locked_streak ? "text-rose-300" : "text-emerald-300"}`}>{it.required_streak > 0 ? `🔥 ${it.required_streak} Day Streak` : "Tidak ada"}</div></div>
                  <div className="rounded-lg bg-black/40 p-2"><div className="text-white/50">Stok</div><div className="font-black text-white">{it.stock < 0 ? "Tak terbatas" : it.stock}</div></div>
                  <div className="rounded-lg bg-black/40 p-2"><div className="text-white/50">Dimiliki</div><div className="font-black text-white">×{it.owned_qty}</div></div>
                  {it.duration_hours ? <div className="rounded-lg bg-black/40 p-2 col-span-2"><div className="text-white/50">Durasi aktif</div><div className="font-black text-white">{it.duration_hours} jam</div></div> : null}
                  {it.plus_only && <div className="rounded-lg bg-amber-400/20 p-2 col-span-2 font-black text-amber-200">👑 PLUS ONLY {it.locked_plus && "— aktifkan Streak Plus"}</div>}
                </div>
                <div className="relative mt-4 grid grid-cols-2 gap-2">
                  <button disabled={!canCoin || !!busy} onClick={() => requestBuy(it, "coin")} className="min-h-11 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 to-orange-500 text-black disabled:opacity-40 flex items-center justify-center gap-1">
                    {busy === it.id + "coin" ? <Loader2 className="w-4 h-4 animate-spin" /> : locked ? <><Lock className="w-4 h-4" />Terkunci</> : <><Coins className="w-4 h-4" />BELI</>}
                  </button>
                  <button disabled={!canGem || !!busy} onClick={() => requestBuy(it, "gem")} className="min-h-11 rounded-xl font-black text-sm bg-cyan-500/25 border border-cyan-300/50 text-cyan-100 disabled:opacity-40 flex items-center justify-center gap-1">
                    {busy === it.id + "gem" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Gem className="w-4 h-4" />{it.cost_gems || "-"}</>}
                  </button>
                </div>
                {!locked && !canCoin && <p className="relative text-center text-[10px] text-white/50 mt-2">Coin kurang {Math.max(0, it.price_coins - coins)}</p>}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Purchase confirmation (expensive items) */}
      <Dialog open={!!confirmBuy} onOpenChange={(o) => !o && setConfirmBuy(null)}>
        <DialogContent className="max-w-xs">
          <DialogTitle>KONFIRMASI PEMBELIAN</DialogTitle>
          {confirmBuy && (() => {
            const isCoin = confirmBuy.method === "coin";
            const price = isCoin ? confirmBuy.item.price_coins : confirmBuy.item.cost_gems;
            const bal = isCoin ? coins : gems;
            const unit = isCoin ? "Coin" : "Gem";
            return (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Item</span><span className="font-bold">{confirmBuy.item.icon} {confirmBuy.item.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Harga</span><span className="font-bold">{price.toLocaleString("id-ID")} {unit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Saldo</span><span className="font-bold">{bal.toLocaleString("id-ID")} {unit}</span></div>
                <div className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">Setelah beli</span><span className="font-black">{(bal - price).toLocaleString("id-ID")} {unit}</span></div>
                <p className="text-[10px] text-muted-foreground">Harga final dicek ulang oleh server.</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button className="min-h-11 rounded-xl bg-muted font-bold" onClick={() => setConfirmBuy(null)}>BATAL</button>
                  <button className="min-h-11 rounded-xl bg-primary text-primary-foreground font-black" onClick={() => buy(confirmBuy.item, confirmBuy.method)}>BELI</button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Purchase animation */}
      <AnimatePresence>
        {success && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSuccess(null)}>
            <motion.div className={`rarity-card rarity-${success.item.rarity} p-6 w-72 text-center`} initial={{ scale: .4 }} animate={{ scale: [0.4, 1.12, 1] }} transition={{ duration: .6 }}>
              <motion.div className="absolute inset-0 rounded-full" initial={{ scale: 0, opacity: .8 }} animate={{ scale: 3, opacity: 0 }} transition={{ duration: .9 }} style={{ background: "radial-gradient(circle, hsl(var(--r-h) 100% 70% / .6), transparent 60%)" }} />
              <Particles n={7} />
              <motion.div className="relative flex justify-center" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .35 }}><EmojiIcon emoji={success.item.icon} className="w-20 h-20" /></motion.div>
              <motion.div className="relative text-xs font-black text-amber-200 mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .5 }}>-{success.item.price_coins ?? 0} 🔥</motion.div>
              <motion.p className="relative mt-2 text-lg font-black text-white flex items-center justify-center gap-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .7 }}><Sparkles className="w-4 h-4" />✨ PURCHASE SUCCESS</motion.p>
              <p className="relative text-xs font-black text-emerald-300">+1 {success.item.name} · ✓ ITEM BERHASIL DIBELI</p>
              <p className="relative text-[11px] text-white/70 mt-1">{success.summary}</p>
              <button className="relative mt-4 min-h-10 px-6 rounded-xl bg-white text-black text-xs font-black">OK</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
