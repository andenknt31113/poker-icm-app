// ===== App Store の評価のお願い =====
//
// iOS アプリの中でだけ、Apple 標準の評価ダイアログ (SKStoreReviewController) を出す。
// 出すのは「何度か使っていて、Nash の一覧を最後まで見た直後」。起動直後や入力中には出さない。
// 実際に表示するかは iOS 側が決める (年 3 回まで等)。こちらは「頼んでよい時か」だけを判定する。
import { isCapacitorNative } from "./capacitorEnv.js";
import { STORAGE_KEYS, readJson, writeRaw } from "./storage.js";

/** これ以上起動していること。初回・2 回目の起動では頼まない。 */
export const REVIEW_MIN_LAUNCHES = 3;
/** Nash の一覧を最後まで計算し終えた回数がこれ以上。 */
export const REVIEW_MIN_NASH_DONE = 2;
/** 一度頼んだら、次に頼むまで空ける日数。 */
export const REVIEW_COOLDOWN_DAYS = 120;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReviewState {
  launches: number;
  nashDone: number;
  /** 最後に頼んだ時刻 (ms)。まだなら 0。 */
  lastAskedAt: number;
}

const EMPTY: ReviewState = { launches: 0, nashDone: 0, lastAskedAt: 0 };

function isReviewState(v: unknown): v is ReviewState {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return [s.launches, s.nashDone, s.lastAskedAt].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0);
}

/** いま評価を頼んでよいか。 */
export function shouldRequestReview(state: ReviewState, now: number): boolean {
  if (state.launches < REVIEW_MIN_LAUNCHES) return false;
  if (state.nashDone < REVIEW_MIN_NASH_DONE) return false;
  if (state.lastAskedAt > 0 && now - state.lastAskedAt < REVIEW_COOLDOWN_DAYS * MS_PER_DAY) return false;
  return true;
}

function load(): ReviewState {
  return { ...readJson(STORAGE_KEYS.reviewState, EMPTY, isReviewState) };
}

function save(state: ReviewState): void {
  writeRaw(STORAGE_KEYS.reviewState, JSON.stringify(state));
}

/** 起動を 1 回数える。main から一度だけ呼ぶ。 */
export function recordLaunchForReview(): void {
  if (!isCapacitorNative()) return;
  const state = load();
  state.launches += 1;
  save(state);
}

/** Nash の一覧を最後まで計算し終えたときに呼ぶ。条件を満たしていれば評価ダイアログを頼む。 */
export function noteNashFinishedForReview(now: number = Date.now()): void {
  if (!isCapacitorNative()) return;
  const state = load();
  state.nashDone += 1;
  const ask = shouldRequestReview(state, now);
  if (ask) state.lastAskedAt = now;
  save(state);
  if (!ask) return;
  // プラグインは必要なときだけ読む (Web では読み込まない)。失敗しても画面には何も出さない
  void import("@capacitor-community/in-app-review")
    .then(({ InAppReview }) => InAppReview.requestReview())
    .catch(() => undefined);
}
