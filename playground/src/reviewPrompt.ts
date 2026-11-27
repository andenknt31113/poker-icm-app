// ===== App Store の評価のお願い =====
//
// iOS アプリの中でだけ、Apple 標準の評価ダイアログ (SKStoreReviewController) を出す。
// 出すのは「2回以上起動していて、Nash 完了・チョップコピー・自分の手札クイック判定などの
// 価値体験を終えた直後」、または「Pro の購入に成功した直後」。
// ペイウォールを閉じた直後は頼まない（ネガティブな体験の直後を避ける）。
// 実際に表示するかは iOS 側が決める (年 3 回まで等)。こちらは「頼んでよい時か」だけを判定する。
import { isCapacitorNative } from "./capacitorEnv.js";
import { STORAGE_KEYS, readJson, writeRaw } from "./storage.js";

/** App Store のグローバルページ URL。 */
export const APP_STORE_URL = "https://apps.apple.com/app/id6793358140";
/** App Store のレビュー投稿画面を開く URL。 */
export const APP_STORE_REVIEW_URL = `${APP_STORE_URL}?action=write-review`;

/** これ以上起動していること。初回起動では頼まない（v1.5.4 で 3 → 2 に緩和）。 */
export const REVIEW_MIN_LAUNCHES = 2;
/** Nash 完了・チョップコピー・手札クイック判定などの合計完了回数がこれ以上。 */
export const REVIEW_MIN_NASH_DONE = 2;
/** 一度頼んだら、次に頼むまで空ける日数。 */
export const REVIEW_COOLDOWN_DAYS = 120;
/** ペイウォールを閉じた直後に評価ダイアログを抑止する時間 (ms)。 */
export const REVIEW_PAYWALL_SUPPRESS_MS = 10 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReviewState {
  launches: number;
  nashDone: number;
  /** チョップ結果をコピーした回数 (旧保存データでは未定義のことがある)。 */
  chopDone?: number;
  /** 「自分の手札」クイック判定・Nash 相手レンジ適用などの分析完了回数 (旧保存データでは未定義)。 */
  handDone?: number;
  /** 最後に頼んだ時刻 (ms)。まだなら 0。 */
  lastAskedAt: number;
}

const EMPTY: ReviewState = { launches: 0, nashDone: 0, chopDone: 0, handDone: 0, lastAskedAt: 0 };

// 当セッション内でペイウォールを購入せずに閉じた直近の時刻 (ms)。
let paywallDismissedAt = 0;

function isReviewState(v: unknown): v is ReviewState {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  const validNum = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
  if (![s.launches, s.nashDone, s.lastAskedAt].every(validNum)) return false;
  if (s.chopDone !== undefined && !validNum(s.chopDone)) return false;
  return s.handDone === undefined || validNum(s.handDone);
}

/** クールダウン期間を経過しているか。 */
function isCooldownPassed(lastAskedAt: number, now: number): boolean {
  return lastAskedAt === 0 || now - lastAskedAt >= REVIEW_COOLDOWN_DAYS * MS_PER_DAY;
}

/** ペイウォールを閉じた直後の抑止期間内か。 */
export function isSuppressedAfterPaywall(now: number, dismissedAt: number = paywallDismissedAt): boolean {
  return dismissedAt > 0 && now - dismissedAt < REVIEW_PAYWALL_SUPPRESS_MS;
}

/** いま評価を頼んでよいか。 */
export function shouldRequestReview(
  state: ReviewState,
  now: number,
  dismissedAtMs: number = 0,
): boolean {
  if (state.launches < REVIEW_MIN_LAUNCHES) return false;
  const completed = state.nashDone + (state.chopDone ?? 0) + (state.handDone ?? 0);
  if (completed < REVIEW_MIN_NASH_DONE) return false;
  if (!isCooldownPassed(state.lastAskedAt, now)) return false;
  if (isSuppressedAfterPaywall(now, dismissedAtMs)) return false;
  return true;
}

/** Pro 購入成功直後に評価を頼んでよいか (クールダウンのみ確認し、好機として扱う)。 */
export function shouldRequestReviewAfterPurchase(state: ReviewState, now: number): boolean {
  return isCooldownPassed(state.lastAskedAt, now);
}

function load(): ReviewState {
  return { ...EMPTY, ...readJson(STORAGE_KEYS.reviewState, EMPTY, isReviewState) };
}

function save(state: ReviewState): void {
  writeRaw(STORAGE_KEYS.reviewState, JSON.stringify(state));
}

function fireInAppReview(): void {
  // プラグインは必要なときだけ読む (Web では読み込まない)。失敗しても画面には何も出さない
  void import("@capacitor-community/in-app-review")
    .then(({ InAppReview }) => InAppReview.requestReview())
    .catch(() => undefined);
}

function maybeRequestReview(state: ReviewState, now: number): void {
  const ask = shouldRequestReview(state, now, paywallDismissedAt);
  if (ask) state.lastAskedAt = now;
  save(state);
  if (!ask) return;
  fireInAppReview();
}

/** ペイウォールを購入せず閉じたことを記録し、直後の評価ダイアログを抑止する。 */
export function notePaywallDismissedForReview(now: number = Date.now()): void {
  paywallDismissedAt = now;
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
  maybeRequestReview(state, now);
}

/** チョップ結果をコピーしたときに呼ぶ。チョップ中心のユーザーにも適切なタイミングで評価を頼む。 */
export function noteChopCopiedForReview(now: number = Date.now()): void {
  if (!isCapacitorNative()) return;
  const state = load();
  state.chopDone = (state.chopDone ?? 0) + 1;
  maybeRequestReview(state, now);
}

/** 「自分の手札」クイック判定や Nash 相手レンジ適用などの分析完了時に呼ぶ。 */
export function noteHandPickedForReview(now: number = Date.now()): void {
  if (!isCapacitorNative()) return;
  const state = load();
  state.handDone = (state.handDone ?? 0) + 1;
  maybeRequestReview(state, now);
}

/** Pro 購入に成功した直後に呼ぶ。満足度が高い好機として評価ダイアログを頼む。 */
export function noteProPurchasedForReview(now: number = Date.now()): void {
  paywallDismissedAt = 0;
  if (!isCapacitorNative()) return;
  const state = load();
  if (!shouldRequestReviewAfterPurchase(state, now)) return;
  state.lastAskedAt = now;
  save(state);
  fireInAppReview();
}
