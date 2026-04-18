// Persistent game state via localStorage

export interface GameLevel {
  level: number;
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
}

const STORAGE_KEY = "game_player_data";

const LEVEL_THRESHOLDS = [0, 90, 250, 500, 1000, 2000, 4000, 8000];

export function getPointsForQuestion(questionNumber: number): number {
  if (questionNumber <= 1) return 20;
  if (questionNumber <= 3) return 30;
  return 60;
}

export function getLevelFromPoints(points: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function getNextLevelThreshold(level: number): number {
  return LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] * 2;
}

export function getCurrentLevelThreshold(level: number): number {
  return LEVEL_THRESHOLDS[level - 1] || 0;
}

export function loadGameData(): GameLevel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { level: 1, totalPoints: 0, gamesPlayed: 0, gamesWon: 0 };
}

export function saveGameData(data: GameLevel) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  if (!s.double_xp_until) return false;
  return new Date(s.double_xp_until).getTime() > Date.now();
}

export function applyDoubleXP(points: number): number {
  return isDoubleXPActive() ? points * 2 : points;
}
