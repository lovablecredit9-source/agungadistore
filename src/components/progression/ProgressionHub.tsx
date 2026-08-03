import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Award, Gift, History, Lock, Search, Sparkles, Star, Trophy, CheckCheck, Loader2, Inbox, AlertTriangle, Pin, Users, Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACHIEVEMENTS, CATEGORY_META, DIFFICULTY_META, MAX_EQUIPPED_BADGES, REWARD_SOURCES, awardXp,
  claimReward, equipBadge, fetchAchievements, fetchEquippedBadges, fetchLevelHistory, fetchProgression,
  fetchRewards, levelProgress, levelTitle, levelUpReward, unequipBadge,
  type AchievementCategory, type AchievementRow, type ProgressionRow, type RewardRow,
} from "@/lib/progression";
import SocialPanel from "@/components/progression/SocialPanel";
import AccountPanel from "@/components/progression/AccountPanel";

type Section = "level" | "badge" | "achievement" | "reward" | "sosial" | "akun";

const SECTIONS: { key: Section; label: string; icon: typeof Star }[] = [
  { key: "level", label: "Level", icon: Star },
  { key: "badge", label: "Badge", icon: Award },
  { key: "achievement", label: "Achievement", icon: Trophy },
  { key: "reward", label: "Pusat Hadiah", icon: Gift },
  { key: "sosial", label: "Sosial", icon: Users },
  { key: "akun", label: "Akun", icon: Settings },
];

interface Props {
  visitorId: string;
}

export default function ProgressionHub({ visitorId }: Props) {
  const [section, setSection] = useState<Section>("level");
  const [loading, setLoading] = useState(true);
  const [prog, setProg] = useState<ProgressionRow | null>(null);
  const [achRows, setAchRows] = useState<AchievementRow[]>([]);
  const [equipped, setEquipped] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<AchievementCategory | "semua">("semua");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, a, e, h, r] = await Promise.all([
        fetchProgression(visitorId),
        fetchAchievements(visitorId),
        fetchEquippedBadges(visitorId),
        fetchLevelHistory(visitorId),
        fetchRewards(visitorId),
      ]);
      setProg(p); setAchRows(a); setEquipped(e); setHistory(h); setRewards(r);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat data progresi. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [visitorId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // XP login harian (1x per hari per akun)
  useEffect(() => {
    const key = `xp-login-${visitorId}`;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
    awardXp(visitorId, "login").then((res) => {
      if (!res) return;
      if (res.leveledUp) window.dispatchEvent(new CustomEvent("level-up", { detail: { level: res.newLevel } }));
      load();
    });
  }, [visitorId, load]);

  const rowOf = (id: string) => achRows.find((r) => r.achievement_id === id);
  const unlockedIds = useMemo(() => achRows.filter((r) => r.unlocked).map((r) => r.achievement_id), [achRows]);
  const completionPct = Math.round((unlockedIds.length / ACHIEVEMENTS.length) * 100);
  const lp = levelProgress(Number(prog?.xp || 0));
  const title = levelTitle(lp.level);
  const pending = rewards.filter((r) => !r.claimed);

  /* ---------- aksi ---------- */
  const toggleBadge = async (id: string) => {
    const isOn = equipped.includes(id);
    if (!isOn && equipped.length >= MAX_EQUIPPED_BADGES) {
      toast.error(`Maksimal ${MAX_EQUIPPED_BADGES} badge terpasang`);
      return;
    }
    setBusyId(id);
    try {
      if (isOn) { await unequipBadge(visitorId, id); setEquipped((p) => p.filter((b) => b !== id)); toast.success("Badge dilepas"); }
      else { await equipBadge(visitorId, id, equipped.length); setEquipped((p) => [...p, id]); toast.success("Badge dipasang di profil"); }
    } catch { toast.error("Gagal memperbarui badge"); }
    finally { setBusyId(null); }
  };

  const doClaim = async (r: RewardRow) => {
    setBusyId(r.id);
    try {
      const ok = await claimReward(visitorId, r);
      if (!ok) { toast.error("Hadiah tidak bisa diklaim (sudah diambil atau kedaluwarsa)"); return; }
      setRewards((prev) => prev.map((x) => (x.id === r.id ? { ...x, claimed: true, claimed_at: new Date().toISOString() } : x)));
      toast.success(`+${r.reward_amount.toLocaleString("id-ID")} ${r.reward_type === "gem" ? "Gem" : "Koin"} diterima!`);
    } catch { toast.error("Gagal klaim hadiah"); }
    finally { setBusyId(null); }
  };

  const claimAll = async () => {
    if (!pending.length) return;
    setClaimingAll(true);
    let ok = 0;
    for (const r of pending) { if (await claimReward(visitorId, r)) ok++; }
    await load();
    setClaimingAll(false);
    ok ? toast.success(`${ok} hadiah berhasil diklaim!`) : toast.error("Tidak ada hadiah yang bisa diklaim");
  };

  /* ---------- render ---------- */
  if (loading) {
    return (
      <div className="px-4 py-4 space-y-3">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => { setLoading(true); load(); }}>Muat Ulang</Button>
      </div>
    );
  }

  return (
    <div className="px-3 pb-24 pt-3 space-y-4">
      {/* HERO LEVEL */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border p-4 bg-gradient-to-br ${title.color} text-white shadow-xl`}>
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">Level Pengguna</p>
            <h2 className="mt-1 flex items-center gap-2 text-3xl font-black leading-none">
              <Star className="h-6 w-6 fill-yellow-200 text-yellow-200" /> {lp.level}
            </h2>
            <p className="mt-1 text-xs font-bold text-white/90">{title.title}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/80">Total XP</p>
            <p className="text-xl font-black tabular-nums">{Number(prog?.xp || 0).toLocaleString("id-ID")}</p>
            <p className="mt-1 text-[10px] font-bold text-white/80">{unlockedIds.length}/{ACHIEVEMENTS.length} badge</p>
          </div>
        </div>
        <div className="relative mt-3 space-y-1">
          <div className="flex justify-between text-[10px] font-black tabular-nums text-white/85">
            <span>{lp.gained} / {lp.range} XP</span>
            <span>{lp.remaining} XP lagi ke Lv.{lp.level + 1}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
            <motion.div initial={{ width: 0 }} animate={{ width: `${lp.percent}%` }} transition={{ duration: 0.9 }}
              className="h-full rounded-full bg-gradient-to-r from-yellow-200 via-white to-cyan-200" />
          </div>
          <p className="text-[10px] font-bold text-white/80">Hadiah Lv.{lp.level + 1}: {levelUpReward(lp.level + 1).label}</p>
        </div>
        {equipped.length > 0 && (
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {equipped.map((id) => {
              const def = ACHIEVEMENTS.find((a) => a.id === id);
              if (!def) return null;
              return (
                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold backdrop-blur">
                  {def.emoji} {def.name}
                </span>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* NAV SECTION */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {SECTIONS.map((s) => {
          const active = section === s.key;
          const badgeCount = s.key === "reward" ? pending.length : 0;
          return (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                active ? "border-primary bg-primary text-primary-foreground shadow-md" : "bg-card text-muted-foreground hover:bg-muted"
              }`}>
              <s.icon className="h-3.5 w-3.5" /> {s.label}
              {badgeCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-black text-destructive-foreground">
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---------- LEVEL ---------- */}
      {section === "level" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Aktivitas", value: prog?.total_activities || 0, icon: Sparkles },
              { label: "XP Minggu Ini", value: prog?.weekly_xp || 0, icon: Star },
              { label: "XP Bulan Ini", value: prog?.monthly_xp || 0, icon: Trophy },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border bg-card p-3 text-center">
                <s.icon className="mx-auto h-4 w-4 text-primary" />
                <p className="mt-1 text-[9px] font-black uppercase text-muted-foreground">{s.label}</p>
                <p className="text-base font-black tabular-nums">{Number(s.value).toLocaleString("id-ID")}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4 text-primary" /> Riwayat Kenaikan Level</h3>
            {history.length === 0 ? (
              <EmptyState emoji="📈" title="Belum ada kenaikan level" desc="Kumpulkan XP dari aktivitas harian untuk naik level." />
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2">
                    <div>
                      <p className="text-xs font-bold">Lv.{h.from_level} → Lv.{h.to_level}</p>
                      <p className="text-[10px] text-muted-foreground">{h.reward_summary || "-"}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Batas XP Tiap Level</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => {
                const lv = lp.level + i;
                const reached = Number(prog?.xp || 0) >= levelProgress(0).curThreshold && lv <= lp.level;
                return (
                  <div key={lv} className={`rounded-xl border px-3 py-2 text-center ${reached ? "border-primary/40 bg-primary/10" : "bg-muted/30"}`}>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Level {lv}</p>
                    <p className="text-xs font-bold tabular-nums">{levelProgress(0) && (50 * (lv - 1) * lv + 25 * (lv - 1) ** 2).toLocaleString("id-ID")} XP</p>
                    <p className="text-[9px] text-muted-foreground">{levelUpReward(lv).label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------- BADGE ---------- */}
      {section === "badge" && (
        <div className="space-y-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold"><Pin className="h-4 w-4 text-primary" /> Badge di Profil</h3>
              <span className="text-[10px] font-bold text-muted-foreground">{equipped.length}/{MAX_EQUIPPED_BADGES} terpasang</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Ketuk badge yang sudah terbuka untuk memasang atau melepasnya dari profil.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ACHIEVEMENTS.map((def) => {
              const row = rowOf(def.id);
              const unlocked = !!row?.unlocked;
              const isEquipped = equipped.includes(def.id);
              const hidden = def.secret && !unlocked;
              return (
                <button key={def.id} disabled={!unlocked || busyId === def.id} onClick={() => toggleBadge(def.id)}
                  className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border p-2 transition-all ${
                    isEquipped ? "border-primary bg-primary/10 shadow-md" : unlocked ? "bg-card hover:bg-muted" : "bg-muted/40 opacity-60"
                  }`}>
                  {busyId === def.id ? <Loader2 className="h-5 w-5 animate-spin" />
                    : unlocked ? <span className="text-2xl leading-none">{def.emoji}</span>
                    : <Lock className="h-4 w-4 text-muted-foreground/60" />}
                  <p className="line-clamp-2 text-center text-[9px] font-bold leading-tight">{hidden ? "???" : def.name}</p>
                  {isEquipped && <span className="absolute right-1 top-1 rounded-full bg-primary px-1 text-[8px] font-black text-primary-foreground">ON</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- ACHIEVEMENT ---------- */}
      {section === "achievement" && (
        <div className="space-y-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold">Penyelesaian Achievement</h3>
              <span className="text-xs font-black text-primary">{completionPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.div initial={{ width: 0 }} animate={{ width: `${completionPct}%` }} transition={{ duration: 0.8 }}
                className="h-full rounded-full bg-gradient-to-r from-primary via-fuchsia-500 to-amber-400" />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{unlockedIds.length} dari {ACHIEVEMENTS.length} terbuka</p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value.slice(0, 60))} placeholder="Cari achievement..." className="pl-9" />
          </div>

          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {(["semua", ...Object.keys(CATEGORY_META)] as (AchievementCategory | "semua")[]).map((c) => {
              const active = cat === c;
              const meta = c === "semua" ? { label: "Semua", emoji: "✨" } : CATEGORY_META[c as AchievementCategory];
              return (
                <button key={c} onClick={() => setCat(c)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  }`}>
                  {meta.emoji} {meta.label}
                </button>
              );
            })}
          </div>

          {(() => {
            const list = ACHIEVEMENTS.filter((a) => {
              const row = rowOf(a.id);
              if (a.secret && !row?.unlocked) return false;
              if (cat !== "semua" && a.category !== cat) return false;
              if (query && !`${a.name} ${a.description}`.toLowerCase().includes(query.toLowerCase())) return false;
              return true;
            });
            const secretLocked = ACHIEVEMENTS.filter((a) => a.secret && !rowOf(a.id)?.unlocked).length;
            if (!list.length) return <EmptyState emoji="🔍" title="Tidak ada hasil" desc="Coba kata kunci atau kategori lain." />;
            return (
              <div className="space-y-2">
                {list.map((def, i) => {
                  const row = rowOf(def.id);
                  const unlocked = !!row?.unlocked;
                  const pct = Math.min(100, ((row?.progress || 0) / def.target) * 100);
                  const dm = DIFFICULTY_META[def.difficulty];
                  return (
                    <motion.div key={def.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                      className={`rounded-2xl border p-3 ${unlocked ? "border-primary/40 bg-primary/5" : "bg-card"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${CATEGORY_META[def.category].grad} text-xl`}>
                          {unlocked ? def.emoji : <Lock className="h-4 w-4 text-white/80" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-bold">{def.name}</p>
                            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black ${dm.color}`}>{dm.label}</span>
                            {def.secret && <span className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[9px] font-black text-fuchsia-500">RAHASIA</span>}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{def.description}</p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] font-bold">
                            <span className="tabular-nums text-muted-foreground">{row?.progress || 0}/{def.target}</span>
                            <span className="text-amber-500">🎁 {def.rewardGems} Gem + {def.rewardCoins.toLocaleString("id-ID")} Koin</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {secretLocked > 0 && (
                  <div className="rounded-2xl border border-dashed p-3 text-center text-[11px] text-muted-foreground">
                    🕵️ {secretLocked} pencapaian rahasia masih tersembunyi — akan muncul setelah terbuka.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ---------- PUSAT HADIAH ---------- */}
      {section === "sosial" && <SocialPanel visitorId={visitorId} />}
      {section === "akun" && <AccountPanel visitorId={visitorId} />}

      {section === "reward" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
            <div>
              <h3 className="text-sm font-bold">Hadiah Belum Diklaim</h3>
              <p className="text-[11px] text-muted-foreground">{pending.length} hadiah menunggu</p>
            </div>
            <Button size="sm" disabled={!pending.length || claimingAll} onClick={claimAll} className="font-bold">
              {claimingAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 h-3.5 w-3.5" />}
              Klaim Semua
            </Button>
          </div>

          {rewards.length === 0 ? (
            <EmptyState emoji="🎁" title="Belum ada hadiah" desc="Selesaikan misi, naik level, atau buka achievement untuk mendapatkan hadiah." />
          ) : (
            Object.entries(
              rewards.reduce<Record<string, RewardRow[]>>((acc, r) => {
                (acc[r.source] ||= []).push(r);
                return acc;
              }, {}),
            ).map(([source, list]) => {
              const meta = REWARD_SOURCES[source] || { label: source, emoji: "📦", grad: "from-slate-400 to-slate-600" };
              return (
                <div key={source} className="space-y-2">
                  <p className="px-1 text-xs font-black uppercase tracking-wider text-muted-foreground">{meta.emoji} {meta.label}</p>
                  {list.map((r) => {
                    const expired = !!r.expires_at && new Date(r.expires_at).getTime() < Date.now();
                    const soon = !!r.expires_at && !expired && new Date(r.expires_at).getTime() - Date.now() < 86400000 * 2;
                    return (
                      <motion.div key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-3 rounded-2xl border p-3 ${r.claimed ? "opacity-60" : "bg-card"}`}>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.grad} text-lg`}>
                          {r.reward_type === "gem" ? "💎" : "🪙"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold">{r.title}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{r.description || "-"}</p>
                          <p className="text-[10px] font-black text-primary">
                            +{r.reward_amount.toLocaleString("id-ID")} {r.reward_type === "gem" ? "Gem" : "Koin"}
                          </p>
                          {soon && <p className="text-[9px] font-bold text-amber-500">⚠️ Segera kedaluwarsa</p>}
                          {expired && <p className="text-[9px] font-bold text-destructive">Kedaluwarsa</p>}
                        </div>
                        {r.claimed ? (
                          <span className="shrink-0 rounded-lg border bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">Diklaim</span>
                        ) : (
                          <Button size="sm" disabled={busyId === r.id || expired} onClick={() => doClaim(r)} className="shrink-0 font-bold">
                            {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Klaim"}
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-8 text-center">
      <Inbox className="mb-1 h-6 w-6 text-muted-foreground/50" />
      <p className="text-2xl">{emoji}</p>
      <p className="text-sm font-bold">{title}</p>
      <p className="max-w-[260px] text-[11px] text-muted-foreground">{desc}</p>
    </div>
  );
}
