// 練習モードの localStorage 永続化をまとめる、依存の無い最下層モジュール。
// judge.ts (記録) と progress.ts (推移表示) の両方がこれを参照するため、
// 循環 import を避けるためにストレージ処理だけを切り出している。
import type { PracticeProblem, PracticeMode, Difficulty } from "./types.js";

const STREAK_KEY = "poker-icm-practice-streak";
const STATS_KEY = "poker-icm-practice-stats";
const REVIEW_KEY = "poker-icm-practice-review";
const HISTORY_KEY = "poker-icm-practice-history";
const HISTORY_MAX = 500;

export interface PracticeStats {
  total: number;
  correct: number;
}

export interface PracticeHistoryEntry {
  t: number; // epoch ms
  mode: PracticeMode;
  diff: Difficulty;
  ok: boolean;
}

export function loadStreak(): number {
  try { return Number(localStorage.getItem(STREAK_KEY)) || 0; } catch { return 0; }
}
export function saveStreak(n: number): void {
  try { localStorage.setItem(STREAK_KEY, String(n)); } catch { /* ignore */ }
}

export function loadStats(): PracticeStats {
  try {
    const v = JSON.parse(localStorage.getItem(STATS_KEY) ?? '{"total":0,"correct":0}');
    if (typeof v.total === "number" && typeof v.correct === "number") return v;
  } catch { /* ignore */ }
  return { total: 0, correct: 0 };
}
export function saveStats(s: PracticeStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function loadReviewList(): PracticeProblem[] {
  try {
    const v = JSON.parse(localStorage.getItem(REVIEW_KEY) ?? "[]");
    if (Array.isArray(v)) return v as PracticeProblem[];
  } catch { /* ignore */ }
  return [];
}
export function saveReviewList(list: PracticeProblem[]): void {
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify(list.slice(0, 50))); } catch { /* ignore */ }
}

export function loadHistory(): PracticeHistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (Array.isArray(v)) return v as PracticeHistoryEntry[];
  } catch { /* ignore */ }
  return [];
}
export function saveHistory(list: PracticeHistoryEntry[]): void {
  try {
    // 上限を超えたら古いものから捨てる (末尾が最新)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-HISTORY_MAX)));
  } catch { /* ignore */ }
}
export function appendHistory(entry: PracticeHistoryEntry): void {
  const list = loadHistory();
  list.push(entry);
  saveHistory(list);
}

export { HISTORY_KEY };
