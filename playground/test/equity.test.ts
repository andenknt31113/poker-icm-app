import { describe, it, expect } from "vitest";
import { equity } from "../src/equity.js";
import { topRange, ALL_169_HANDS } from "../src/handRanking.js";

describe("equity() フォールバック", () => {
  it("テーブルに無いような極端なレンジでも有限な 0..1 の値を返す", () => {
    const range = topRange(50);
    for (const hand of ["AA", "72o", "AKs", "T9s"] as const) {
      const v = equity(hand, range);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("空レンジに対しても例外を投げない", () => {
    const v = equity("AA", new Set());
    expect(Number.isFinite(v)).toBe(true);
  });

  it("相対的な強さ: AA は 72o より広いレンジに対して高い equity を持つ", () => {
    const range = topRange(50);
    const aa = equity("AA", range);
    const weak = equity("72o", range);
    expect(aa).toBeGreaterThan(weak);
  });
});

describe("topRange", () => {
  it("Top 100% は全169ハンドを含む", () => {
    expect(topRange(100).size).toBe(169);
  });

  it("Top X% はおよそ X% のハンド数になる (丸め誤差を許容)", () => {
    const r = topRange(10);
    expect(r.size).toBeGreaterThan(0);
    expect(r.size).toBeLessThan(ALL_169_HANDS.length);
  });

  it("Top X% は Top X+10% の部分集合になる (単調性)", () => {
    const small = topRange(10);
    const big = topRange(50);
    for (const h of small) {
      expect(big.has(h)).toBe(true);
    }
  });
});
