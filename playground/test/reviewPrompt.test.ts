import { describe, expect, it } from "vitest";
import {
  REVIEW_COOLDOWN_DAYS,
  REVIEW_MIN_LAUNCHES,
  REVIEW_MIN_NASH_DONE,
  REVIEW_PAYWALL_SUPPRESS_MS,
  shouldRequestReview,
  shouldRequestReviewAfterPurchase,
} from "../src/reviewPrompt.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const ready = { launches: REVIEW_MIN_LAUNCHES, nashDone: REVIEW_MIN_NASH_DONE, lastAskedAt: 0 };

describe("shouldRequestReview", () => {
  it("起動回数の下限は 2 に緩和されている", () => {
    expect(REVIEW_MIN_LAUNCHES).toBe(2);
  });
  it("起動回数と Nash を見た回数が足りていて、まだ頼んでいなければ頼む", () => {
    expect(shouldRequestReview(ready, NOW)).toBe(true);
  });
  it("起動回数が足りなければ頼まない", () => {
    expect(shouldRequestReview({ ...ready, launches: REVIEW_MIN_LAUNCHES - 1 }, NOW)).toBe(false);
  });
  it("Nash を最後まで見た回数が足りなければ頼まない", () => {
    expect(shouldRequestReview({ ...ready, nashDone: REVIEW_MIN_NASH_DONE - 1 }, NOW)).toBe(false);
  });
  it("頼んでから間隔が空いていなければ頼まない", () => {
    expect(shouldRequestReview({ ...ready, lastAskedAt: NOW - (REVIEW_COOLDOWN_DAYS - 1) * DAY }, NOW)).toBe(false);
  });
  it("間隔が空いたらもう一度頼む", () => {
    expect(shouldRequestReview({ ...ready, lastAskedAt: NOW - REVIEW_COOLDOWN_DAYS * DAY }, NOW)).toBe(true);
  });
  it("チョップ結果のコピー回数・自分の手札クイック判定回数でも完了条件を満たす", () => {
    expect(shouldRequestReview({ launches: REVIEW_MIN_LAUNCHES, nashDone: 0, chopDone: REVIEW_MIN_NASH_DONE, lastAskedAt: 0 }, NOW)).toBe(true);
    expect(shouldRequestReview({ launches: REVIEW_MIN_LAUNCHES, nashDone: 1, chopDone: 1, lastAskedAt: 0 }, NOW)).toBe(true);
    expect(shouldRequestReview({ launches: REVIEW_MIN_LAUNCHES, nashDone: 0, handDone: REVIEW_MIN_NASH_DONE, lastAskedAt: 0 }, NOW)).toBe(true);
    expect(shouldRequestReview({ launches: REVIEW_MIN_LAUNCHES, nashDone: 0, chopDone: 1, handDone: 1, lastAskedAt: 0 }, NOW)).toBe(true);
    expect(shouldRequestReview({ launches: REVIEW_MIN_LAUNCHES, nashDone: 0, chopDone: 1, lastAskedAt: 0 }, NOW)).toBe(false);
  });
  it("ペイウォールを閉じた直後は評価ダイアログを出さず、抑止時間経過後に解除される", () => {
    expect(shouldRequestReview(ready, NOW, NOW - 1000)).toBe(false);
    expect(shouldRequestReview(ready, NOW, NOW - REVIEW_PAYWALL_SUPPRESS_MS + 1)).toBe(false);
    expect(shouldRequestReview(ready, NOW, NOW - REVIEW_PAYWALL_SUPPRESS_MS)).toBe(true);
  });
  it("Pro 購入成功時は初回起動でもクールダウンさえ空いていれば好機として頼む", () => {
    expect(shouldRequestReviewAfterPurchase({ launches: 1, nashDone: 0, lastAskedAt: 0 }, NOW)).toBe(true);
    expect(shouldRequestReviewAfterPurchase({ launches: 1, nashDone: 0, lastAskedAt: NOW - 10 * DAY }, NOW)).toBe(false);
    expect(shouldRequestReviewAfterPurchase({ launches: 1, nashDone: 0, lastAskedAt: NOW - REVIEW_COOLDOWN_DAYS * DAY }, NOW)).toBe(true);
  });
});
