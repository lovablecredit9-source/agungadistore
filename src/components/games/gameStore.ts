// Persistent game state via localStorage

export interface GameLevel {
  level: number;
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
}

const STORAGE_KEY = "game_player_data";

const LEVEL_THRESHOLDS = [0, 90, 250, 500, 1000, 2000, 4000, 8000];

function getGameDataKey(): string {
  const vid = getActiveVisitorId();
  return vid ? `${STORAGE_KEY}_${vid}` : STORAGE_KEY;
}

export function getPointsForQuestion(questionNumber: number): number {
  if (questionNumber <= 1) return 20;
  if (questionNumber <= 3) return 30;
  return 60;
}

function getThresholdForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  const lastDefinedLevel = LEVEL_THRESHOLDS.length;
  const lastThreshold = LEVEL_THRESHOLDS[lastDefinedLevel - 1];
  const steps = level - lastDefinedLevel;
  return lastThreshold * Math.pow(2, steps);
}

export function getLevelFromPoints(points: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  // Beyond defined thresholds: each next level needs double the previous threshold
  if (level === LEVEL_THRESHOLDS.length) {
    let threshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    while (points >= threshold * 2) {
      level++;
      threshold *= 2;
    }
  }
  return level;
}

export function getNextLevelThreshold(level: number): number {
  return getThresholdForLevel(level + 1);
}

export function getCurrentLevelThreshold(level: number): number {
  return getThresholdForLevel(level);
}

export function loadGameData(): GameLevel {
  try {
    const raw = localStorage.getItem(getGameDataKey());
    if (raw) {
      const data = JSON.parse(raw) as GameLevel;
      // Pastikan data lama ikut tersinkron ke server untuk peringkat (sekali per sesi)
      ensureSyncedOnce(data);
      return data;
    }
  } catch {}
  return { level: 1, totalPoints: 0, gamesPlayed: 0, gamesWon: 0 };
}

let _lastSyncedVid: string | null = null;
function ensureSyncedOnce(data: GameLevel) {
  const vid = getActiveVisitorId();
  if (!vid || _lastSyncedVid === vid) return;
  _lastSyncedVid = vid;
  syncGameLevelToServer(data);
}

export function saveGameData(data: GameLevel) {
  localStorage.setItem(getGameDataKey(), JSON.stringify(data));
  syncGameLevelToServer(data);
}

/**
 * Rekonsiliasi poin/level dengan server (sumber kebenaran untuk peringkat).
 * Memperbaiki bug "level tiba-tiba turun" saat localStorage kosong/perangkat baru:
 * ambil nilai poin tertinggi antara lokal dan server, lalu hitung ulang level.
 */
export async function reconcileGameLevelFromServer(): Promise<GameLevel> {
  const local = loadGameData();
  const vid = getActiveVisitorId();
  if (!vid) return local;
  try {
    const { data: row } = await supabase
      .from("game_levels")
      .select("total_points")
      .eq("visitor_id", vid)
      .maybeSingle();
    const serverPoints = Number(row?.total_points) || 0;
    if (serverPoints > local.totalPoints) {
      local.totalPoints = serverPoints;
      local.level = getLevelFromPoints(serverPoints);
      saveGameData(local);
      try { window.dispatchEvent(new CustomEvent("game-level-updated")); } catch {}
    } else if (serverPoints < local.totalPoints) {
      // Lokal lebih tinggi → dorong ke server agar konsisten.
      syncGameLevelToServer(local);
    }
    // Pastikan level selalu konsisten dengan poin (perbaiki data lama yang tidak sesuai).
    const correctLevel = getLevelFromPoints(local.totalPoints);
    if (correctLevel !== local.level) {
      local.level = correctLevel;
      saveGameData(local);
    }
  } catch {}
  return local;
}

/** Simpan level & poin game ke server (untuk peringkat Top Level Game). */
function syncGameLevelToServer(data: GameLevel) {
  const vid = getActiveVisitorId();
  if (!vid) return;
  supabase
    .from("game_levels")
    .upsert(
      { visitor_id: vid, level: data.level, total_points: data.totalPoints },
      { onConflict: "visitor_id" },
    )
    .then(() => {}, () => {});
}

export function addPoints(points: number): GameLevel {
  const data = loadGameData();
  data.totalPoints += points;
  data.level = getLevelFromPoints(data.totalPoints);
  data.gamesPlayed += 1;
  if (points > 0) data.gamesWon += 1;
  saveGameData(data);
  return data;
}

export function adjustGameLevelPoints(pointsDelta: number): GameLevel {
  const data = loadGameData();
  data.totalPoints = Math.max(0, data.totalPoints + pointsDelta);
  data.level = getLevelFromPoints(data.totalPoints);
  saveGameData(data);
  return data;
}

export type Difficulty = "mudah" | "sedang" | "sulit" | "pro" | "sangat_pro";

export const DIFFICULTIES: { key: Difficulty; label: string; color: string; timeSeconds: number; hintCount: number }[] = [
  { key: "mudah", label: "Mudah", color: "text-green-500", timeSeconds: 120, hintCount: 4 },
  { key: "sedang", label: "Sedang", color: "text-blue-500", timeSeconds: 90, hintCount: 4 },
  { key: "sulit", label: "Sulit", color: "text-orange-500", timeSeconds: 60, hintCount: 3 },
  { key: "pro", label: "Pro", color: "text-red-500", timeSeconds: 45, hintCount: 3 },
  { key: "sangat_pro", label: "Sangat Pro", color: "text-purple-500", timeSeconds: 30, hintCount: 2 },
];

// Suit game persistent state
const SUIT_KEY = "suit_game_state";
export interface SuitScore { win: number; lose: number; draw: number }
export function loadSuitScore(): SuitScore {
  try {
    const raw = localStorage.getItem(SUIT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { win: 0, lose: 0, draw: 0 };
}
export function saveSuitScore(s: SuitScore) {
  localStorage.setItem(SUIT_KEY, JSON.stringify(s));
}

// Daily free plays system - 3 free game plays per day across all games
const FREE_PLAYS_KEY = "game_daily_free_plays";
const MAX_FREE_PLAYS = 3;

interface DailyFreeData {
  date: string; // YYYY-MM-DD
  used: number;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDailyFreePlays(): { used: number; remaining: number } {
  try {
    const raw = localStorage.getItem(FREE_PLAYS_KEY);
    if (raw) {
      const data: DailyFreeData = JSON.parse(raw);
      if (data.date === getTodayStr()) {
        return { used: data.used, remaining: Math.max(0, MAX_FREE_PLAYS - data.used) };
      }
    }
  } catch {}
  return { used: 0, remaining: MAX_FREE_PLAYS };
}

export function useDailyFreePlay(): boolean {
  const { remaining } = getDailyFreePlays();
  if (remaining <= 0) return false;
  const today = getTodayStr();
  try {
    const raw = localStorage.getItem(FREE_PLAYS_KEY);
    let data: DailyFreeData = { date: today, used: 0 };
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) data = parsed;
      else data = { date: today, used: 0 };
    }
    data.used += 1;
    localStorage.setItem(FREE_PLAYS_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export { MAX_FREE_PLAYS };

// =====================================================
// POWER-UPS (server-backed; localStorage = cache UX cepat)
// Dibeli di Streak Shop → user_power_ups, dipakai di game.
// =====================================================
import { supabase } from "@/integrations/supabase/client";

export interface PowerUpsState {
  extra_life: number;
  auto_hint: number;
  time_freeze: number;
  double_xp_until: string | null;
}

const POWERUPS_KEY_PREFIX = "streak_powerups_";

function getActiveVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("balance_visitor_id") ||
    localStorage.getItem("visitor_id") ||
    null
  );
}

function getPowerUpsKey(): string | null {
  const vid = getActiveVisitorId();
  return vid ? `${POWERUPS_KEY_PREFIX}${vid}` : null;
}

const EMPTY_PU: PowerUpsState = { extra_life: 0, auto_hint: 0, time_freeze: 0, double_xp_until: null };

export function loadPowerUps(): PowerUpsState {
  try {
    const key = getPowerUpsKey();
    if (!key) return EMPTY_PU;
    const raw = localStorage.getItem(key);
    if (raw) return { ...EMPTY_PU, ...JSON.parse(raw) };
  } catch {}
  return EMPTY_PU;
}

export function savePowerUps(s: PowerUpsState) {
  try {
    const key = getPowerUpsKey();
    if (key) localStorage.setItem(key, JSON.stringify(s));
  } catch {}
}

/** Sinkron dari server (sumber kebenaran) lalu cache ke localStorage. */
export async function syncPowerUpsFromServer(): Promise<PowerUpsState> {
  const vid = getActiveVisitorId();
  if (!vid) return EMPTY_PU;
  try {
    const { data } = await supabase.functions.invoke("power-up-consume", {
      body: { action: "get", visitorId: vid },
    });
    if (data && !data.error) {
      const next: PowerUpsState = {
        extra_life: data.extra_life || 0,
        auto_hint: data.auto_hint || 0,
        time_freeze: data.time_freeze || 0,
        double_xp_until: data.double_xp_until || null,
      };
      savePowerUps(next);
      const syncedUntil = next.double_xp_until ? new Date(next.double_xp_until).getTime() : 0;
      setPointBoosterUntil(Number.isFinite(syncedUntil) ? syncedUntil : 0);
      return next;
    }
  } catch {}
  return loadPowerUps();
}

export type PowerUpKind = "extra_life" | "auto_hint" | "time_freeze";

/** Konsumsi 1 power-up: kurangi cache lokal dulu (instan) lalu sinkron ke server. */
export function consumePowerUp(kind: PowerUpKind): boolean {
  const s = loadPowerUps();
  if ((s[kind] || 0) <= 0) return false;
  s[kind] = (s[kind] || 0) - 1;
  savePowerUps(s);
  // fire-and-forget sync ke server
  const vid = getActiveVisitorId();
  if (vid) {
    supabase.functions.invoke("power-up-consume", {
      body: { action: "consume", visitorId: vid, kind },
    }).catch(() => {});
  }
  return true;
}

export function isDoubleXPActive(): boolean {
  const s = loadPowerUps();
  if (s.double_xp_until && new Date(s.double_xp_until).getTime() > Date.now()) return true;
  return isPointBoosterActive();
}

/** Pengali poin aktif saat ini. Booster ditumpuk (dijumlah), mis. x2 + x3 = x5. */
export function getPointMultiplier(): number {
  let sum = activeBoosters().reduce((acc, b) => acc + b.multiplier, 0);
  const doubleXpUntil = getActiveDoubleXpUntil();
  if (doubleXpUntil > Date.now()) sum += 2;
  return sum > 0 ? sum : 1;
}

export function applyDoubleXP(points: number): number {
  return points * getPointMultiplier();
}

export function awardGamePoints(basePoints: number): { awardedPoints: number; data: GameLevel } {
  const awardedPoints = applyDoubleXP(basePoints);
  const data = addPoints(awardedPoints);
  const vid = getActiveVisitorId();
  if (vid) {
    import("@/lib/daily-mission")
      .then(({ trackDailyMission }) => trackDailyMission(vid, "game_play", 1))
      .catch(() => {});
    if (awardedPoints > 0) {
      import("@/lib/daily-mission")
        .then(({ trackDailyMission }) => Promise.all([
          trackDailyMission(vid, "game_win", 1),
          trackDailyMission(vid, "game_points", awardedPoints),
        ]))
        .catch(() => {});
    }
  }
  return { awardedPoints, data };
}

// =====================================================
// POINT BOOSTER x2/x3 (gem-based, durasi pilihan, BISA DITUMPUK)
// Contoh: beli x2 lalu tambah x3 = x5 selama keduanya aktif.
// Saat salah satu habis, sisa booster yang masih aktif tetap berlaku.
// =====================================================
const BOOSTERS_KEY_PREFIX = "game_point_boosters_";

interface StoredBooster { multiplier: number; until: number }

export interface ActiveBoosterSlot {
  key: string;
  multiplier: number;
  until: number;
}

function getBoostersKey(): string | null {
  const vid = getActiveVisitorId();
  return vid ? `${BOOSTERS_KEY_PREFIX}${vid}` : null;
}

function loadBoosters(): StoredBooster[] {
  try {
    const key = getBoostersKey();
    const raw = key ? localStorage.getItem(key) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((b: any) => b && Number.isFinite(b.multiplier) && Number.isFinite(b.until));
  } catch { return []; }
}

function saveBoosters(list: StoredBooster[]) {
  try {
    const key = getBoostersKey();
    if (key) localStorage.setItem(key, JSON.stringify(list));
  } catch {}
}

/** Booster yang masih aktif saat ini. */
function activeBoosters(): StoredBooster[] {
  const now = Date.now();
  return loadBoosters().filter(b => b.until > now);
}

function getActiveDoubleXpUntil(): number {
  const raw = loadPowerUps().double_xp_until;
  const until = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(until) && until > Date.now() ? until : 0;
}

export interface BoosterTier {
  key: string;
  label: string;
  durationMs: number;
  gemCost: number;
  multiplier: 2 | 3;
}

export const BOOSTER_TIERS: BoosterTier[] = [
  { key: "x2_30m", label: "30 menit", durationMs: 30 * 60 * 1000, gemCost: 50, multiplier: 2 },
  { key: "x2_1h", label: "1 jam", durationMs: 60 * 60 * 1000, gemCost: 100, multiplier: 2 },
  { key: "x2_2h", label: "2 jam", durationMs: 2 * 60 * 60 * 1000, gemCost: 110, multiplier: 2 },
  { key: "x3_30m", label: "30 menit", durationMs: 30 * 60 * 1000, gemCost: 90, multiplier: 3 },
  { key: "x3_1h", label: "1 jam", durationMs: 60 * 60 * 1000, gemCost: 180, multiplier: 3 },
  { key: "x3_2h", label: "2 jam", durationMs: 2 * 60 * 60 * 1000, gemCost: 200, multiplier: 3 },
];

// =====================================================
// BIAYA NYAWA BERTINGKAT (revive cost scaling)
// 1-10 revive = 1 nyawa, 11-50 = 2, 51-100 = 3, 100+ = 5.
// Reset ke awal saat game benar-benar over / mulai baru.
// =====================================================
let _reviveCount = 0;

/** Biaya nyawa untuk revive berikutnya berdasarkan jumlah revive yang sudah dipakai. */
export function getReviveCost(): number {
  const next = _reviveCount + 1;
  if (next <= 10) return 1;
  if (next <= 50) return 2;
  if (next <= 100) return 3;
  return 5;
}

export function getReviveCount(): number {
  return _reviveCount;
}

export function incrementReviveCount(): void {
  _reviveCount += 1;
}

export function resetReviveCount(): void {
  _reviveCount = 0;
}

/** Konsumsi beberapa nyawa sekaligus (untuk revive bertingkat). */
export function consumeLives(count: number): boolean {
  const s = loadPowerUps();
  if ((s.extra_life || 0) < count) return false;
  s.extra_life = (s.extra_life || 0) - count;
  savePowerUps(s);
  const vid = getActiveVisitorId();
  if (vid) {
    for (let i = 0; i < count; i++) {
      supabase.functions.invoke("power-up-consume", {
        body: { action: "consume", visitorId: vid, kind: "extra_life" },
      }).catch(() => {});
    }
  }
  return true;
}

/** Waktu selesai booster paling akhir yang masih aktif (untuk tampilan). */
export function getPointBoosterUntil(): number {
  const active = activeBoosters();
  let max = active.reduce((m, b) => Math.max(m, b.until), 0);
  const pu = getActiveDoubleXpUntil();
  if (pu > Date.now()) max = Math.max(max, pu);
  return max;
}

export function isPointBoosterActive(): boolean {
  return getPointBoosterUntil() > Date.now();
}

/** Ringkasan booster aktif untuk UI: pengali gabungan + tiap slot + total sisa durasi. */
export function getActiveBoosterSummary(): { total: number; totalRemainingMs: number; slots: ActiveBoosterSlot[] } {
  const now = Date.now();
  const slots: ActiveBoosterSlot[] = activeBoosters().map((b, index) => ({
    key: `gem-x${b.multiplier}-${b.until}-${index}`,
    multiplier: b.multiplier,
    until: b.until,
  }));
  const doubleXpUntil = getActiveDoubleXpUntil();
  if (doubleXpUntil > now) {
    slots.push({ key: `powerup-x2-${doubleXpUntil}`, multiplier: 2, until: doubleXpUntil });
  }
  slots.sort((a, b) => a.until - b.until);
  const totalRemainingMs = slots.reduce((sum, slot) => sum + Math.max(0, slot.until - now), 0);
  return { total: getPointMultiplier(), totalRemainingMs, slots };
}

/**
 * Aktifkan booster baru. Booster ditumpuk sebagai slot terpisah sehingga
 * pengali dijumlah (x2 + x3 = x5). Membeli tier yang sama saat aktif akan
 * memperpanjang durasi slot tersebut.
 */
export function activatePointBooster(durationMs: number, multiplier: 2 | 3 = 2): number {
  const now = Date.now();
  const list = loadBoosters().filter(b => b.until > now);
  const same = list.find(b => b.multiplier === multiplier);
  if (same) {
    same.until = same.until + durationMs;
  } else {
    list.push({ multiplier, until: now + durationMs });
  }
  saveBoosters(list);
  return getPointBoosterUntil();
}

/** Kompat: diabaikan (durasi kini dikelola per-slot). */
export function setPointBoosterUntil(_untilMs: number): number {
  return getPointBoosterUntil();
}
