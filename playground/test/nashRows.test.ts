import { describe, expect, it } from "vitest";
import { NASH_COLLAPSE_MIN_CALLERS, isCallerRowPinned } from "../src/nashRows.js";

describe("Nash 一覧: 人数が多い卓で先に出す行", () => {
  it("5 人以上の卓 (コールに回る人が 4 人以上) から畳む", () => {
    expect(NASH_COLLAPSE_MIN_CALLERS).toBe(4);
  });

  it("自分と相手の行は畳まない", () => {
    expect(isCallerRowPinned("hero", "p0c3", null)).toBe(true);
    expect(isCallerRowPinned("villain", "p0c3", null)).toBe(true);
  });

  it("それ以外の人の行は畳む", () => {
    expect(isCallerRowPinned("other", "p0c3", null)).toBe(false);
    expect(isCallerRowPinned(undefined, "p0c3", "p0c4")).toBe(false);
  });

  it("表を開いている行と、その下のオーバーコールを開いている行は畳まない", () => {
    expect(isCallerRowPinned("other", "p0c3", "p0c3")).toBe(true);
    expect(isCallerRowPinned("other", "p0c3", "p0c3o5")).toBe(true);
  });

  it("番号が前方一致するだけの別の行 (c3 と c31) を取り違えない", () => {
    expect(isCallerRowPinned("other", "p0c3", "p0c31")).toBe(false);
  });
});
