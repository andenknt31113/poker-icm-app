// 練習モードの localStorage 永続化をまとめる、依存の無い最下層モジュール。
// judge.ts (記録) と progress.ts (推移表示) の両方がこれを参照するため、
// 循環 import を避けるためにストレージ処理だけを切り出している。
import { STORAGE_KEYS, readRaw, writeRaw, removeRaw, readJson, writeJson } from "../storage.js";
import type { PracticeProblem, PracticeMode, Difficulty } from "./types.js";

/** 解答履歴の保持上限 (成績の推移グラフ用。超過分は古いものから捨てる)。 */
const HISTORY_MAX = 500;
/** 復習リストの保持上限。 */
const REVIEW_MAX = 50;

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

/** 連続正解数。未設定・不正値は 0。 */
export function loadStreak(): number {
  return Number(readRaw(STORAGE_KEYS.practiceStreak)) || 0;
}
export function saveStreak(n: number): void {
  writeRaw(STORAGE_KEYS.practiceStreak, String(n));
}

function isPracticeStats(v: unknown): v is PracticeStats {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Partial<PracticeStats>;
  return typeof o.total === "number" && typeof o.correct === "number";
}

export function loadStats(): PracticeStats {
  return readJson<PracticeStats>(
    STORAGE_KEYS.practiceStats,
    { total: 0, correct: 0 },
    isPracticeStats,
  );
}
export function saveStats(s: PracticeStats): void {
  writeJson(STORAGE_KEYS.practiceStats, s);
}

// 復習リスト / 履歴は「配列であること」だけを検証し、要素の形は信用する。
// 自アプリが書いた値しか入らない前提で、要素ごとの検証コストは払わない
// (壊れた要素があっても描画側が ?? / 型ガードで防御する)。
export function loadReviewList(): PracticeProblem[] {
  return readJson<PracticeProblem[]>(STORAGE_KEYS.practiceReview, [], Array.isArray);
}
export function saveReviewList(list: PracticeProblem[]): void {
  writeJson(STORAGE_KEYS.practiceReview, list.slice(0, REVIEW_MAX));
}

export function loadHistory(): PracticeHistoryEntry[] {
  return readJson<PracticeHistoryEntry[]>(STORAGE_KEYS.practiceHistory, [], Array.isArray);
}
/** 上限を超えたら古いものから捨てて保存する (末尾が最新)。 */
function saveHistory(list: PracticeHistoryEntry[]): void {
  writeJson(STORAGE_KEYS.practiceHistory, list.slice(-HISTORY_MAX));
}
export function appendHistory(entry: PracticeHistoryEntry): void {
  const list = loadHistory();
  list.push(entry);
  saveHistory(list);
}

/** 解答履歴を全消去する (成績の推移パネルのリセットボタン用)。 */
export function clearHistory(): void {
  removeRaw(STORAGE_KEYS.practiceHistory);
}
