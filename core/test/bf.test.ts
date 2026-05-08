import { describe, expect, it } from "vitest";
import { calculateBubbleFactor } from "../src/bf.js";

describe("calculateBubbleFactor", () => {
  it("ヘッズアップでは BF = 1.0 (チップ ↔ $ がリニア)", () => {
    const result = calculateBubbleFactor({
      stacks: [3000, 1000],
      payouts: [60, 40],
      heroIndex: 0,
      villainIndex: 1,
      riskChips: 1000,
    });
    expect(result.bf).toBeCloseTo(1.0, 6);
  });

  it("ヘッズアップ winner-take-all でも BF = 1.0", () => {
    const result = calculateBubbleFactor({
      stacks: [3000, 1000],
      payouts: [100, 0],
      heroIndex: 0,
      villainIndex: 1,
      riskChips: 1000,
    });
    expect(result.bf).toBeCloseTo(1.0, 6);
  });

  it("バブル直前 (3人, 2人ペイ) では BF > 1 (手計算リファレンス)", () => {
    // hero = p2 (3000), villain = p3 (2000), payouts [60, 40, 0]
    // WIN  -> stacks [5000, 5000, 0]    eq_hero = 50
    // LOSE -> stacks [5000, 1000, 4000] eq_hero ≈ 12.667
    // NOW  -> stacks [5000, 3000, 2000] eq_hero = 33
    // BF = (33 - 12.667) / (50 - 33) = 20.333 / 17 ≈ 1.196
    const result = calculateBubbleFactor({
      stacks: [5000, 3000, 2000],
      payouts: [60, 40, 0],
      heroIndex: 1,
      villainIndex: 2,
      riskChips: 2000,
    });
    expect(result.equityNow).toBeCloseTo(33, 5);
    expect(result.equityWin).toBeCloseTo(50, 5);
    expect(result.equityLose).toBeCloseTo(12.666667, 5);
    expect(result.bf).toBeCloseTo(1.196078, 4);
  });

  it("チップリーダー対ショート: BF はリーダー側でも 1 を超え得る", () => {
    const result = calculateBubbleFactor({
      stacks: [5000, 3000, 2000],
      payouts: [60, 40, 0],
      heroIndex: 0,
      villainIndex: 2,
      riskChips: 2000,
    });
    expect(result.bf).toBeGreaterThan(1.0);
  });

  it("hero と villain が同じ index はエラー", () => {
    expect(() =>
      calculateBubbleFactor({
        stacks: [3000, 1000],
        payouts: [60, 40],
        heroIndex: 0,
        villainIndex: 0,
        riskChips: 500,
      }),
    ).toThrow();
  });

  it("riskChips が hero スタックを超えるとエラー", () => {
    expect(() =>
      calculateBubbleFactor({
        stacks: [3000, 1000],
        payouts: [60, 40],
        heroIndex: 0,
        villainIndex: 1,
        riskChips: 4000,
      }),
    ).toThrow();
  });
});
