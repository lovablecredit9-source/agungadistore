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
  { key: "mudah", label: "Mudah", color: "text-green-500", timeSeconds: 120, hintCount: 8 },
  { key: "sedang", label: "Sedang", color: "text-blue-500", timeSeconds: 90, hintCount: 6 },
  { key: "sulit", label: "Sulit", color: "text-orange-500", timeSeconds: 60, hintCount: 5 },
  { key: "pro", label: "Pro", color: "text-red-500", timeSeconds: 45, hintCount: 4 },
  { key: "sangat_pro", label: "Sangat Pro", color: "text-purple-500", timeSeconds: 30, hintCount: 3 },
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

// Daily free reveal system
const FREE_REVEAL_KEY = "game_daily_free_reveals";
const MAX_FREE_REVEALS = 3;

interface DailyFreeData {
  date: string; // YYYY-MM-DD
  used: number;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDailyFreeReveals(): { used: number; remaining: number } {
  try {
    const raw = localStorage.getItem(FREE_REVEAL_KEY);
    if (raw) {
      const data: DailyFreeData = JSON.parse(raw);
      if (data.date === getTodayStr()) {
        return { used: data.used, remaining: Math.max(0, MAX_FREE_REVEALS - data.used) };
      }
    }
  } catch {}
  return { used: 0, remaining: MAX_FREE_REVEALS };
}

export function useDailyFreeReveal(): boolean {
  const { remaining } = getDailyFreeReveals();
  if (remaining <= 0) return false;
  const today = getTodayStr();
  try {
    const raw = localStorage.getItem(FREE_REVEAL_KEY);
    let data: DailyFreeData = { date: today, used: 0 };
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) data = parsed;
      else data = { date: today, used: 0 };
    }
    data.used += 1;
    localStorage.setItem(FREE_REVEAL_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export { MAX_FREE_REVEALS };
