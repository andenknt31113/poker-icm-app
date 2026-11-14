import { describe, expect, it } from "vitest";
import { REVIEW_COOLDOWN_DAYS, REVIEW_MIN_LAUNCHES, REVIEW_MIN_NASH_DONE, shouldRequestReview } from "../src/reviewPrompt.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const ready = { launches: REVIEW_MIN_LAUNCHES, nashDone: REVIEW_MIN_NASH_DONE, lastAskedAt: 0 };

describe("shouldRequestReview", () => {
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
});
