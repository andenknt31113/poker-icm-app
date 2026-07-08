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

  describe("均等ペイ (n=payouts.length) の丸め誤差ケース", () => {
    // n=3, payouts=[33,33,33] は「誰が勝っても同額」の数学的な縮退ケース。
    // ICM は理論上 equityNow === equityWin === equityLose (常に33) になるはずだが、
    // 反復計算の浮動小数点誤差で ~1e-14 のノイズが乗り、
    // gain (equityWin-equityNow) や loss (equityNow-equityLose) が
    // 極小の正/負どちらにもなり得る。
    // 修正前はこの結果 bf が負の有限値になり、calculateRequiredEquity 側で
    // 例外が投げられていた (P0 バグの再現ケース)。
    it("実測で負の bf を生んでいた入力 (stacks=[20,17,19]) で例外を投げず Infinity になる", () => {
      const result = calculateBubbleFactor({
        stacks: [20, 17, 19],
        payouts: [33, 33, 33],
        heroIndex: 2,
        villainIndex: 1,
        riskChips: 17,
      });
      expect(Number.isFinite(result.bf) && result.bf < 0).toBe(false);
      expect(result.bf).toBe(Number.POSITIVE_INFINITY);
    });

    it("別の実測ケース (stacks=[14,14,29]) でも例外を投げず Infinity になる", () => {
      const result = calculateBubbleFactor({
        stacks: [14, 14, 29],
        payouts: [33, 33, 33],
        heroIndex: 2,
        villainIndex: 0,
        riskChips: 14,
      });
      expect(result.bf).toBe(Number.POSITIVE_INFINITY);
    });

    it("任意のスタック構成 (縮退ケース) で bf は常に有限の負値にならない", () => {
      // 決定的な複数パターンで丸め誤差の再発を防ぐリグレッションチェック
      const cases: Array<{
        stacks: [number, number, number];
        heroIndex: number;
        villainIndex: number;
        riskChips: number;
      }> = [
        { stacks: [26, 7, 27], heroIndex: 2, villainIndex: 1, riskChips: 7 },
        { stacks: [8, 18, 9], heroIndex: 2, villainIndex: 0, riskChips: 8 },
        { stacks: [7, 24, 23], heroIndex: 2, villainIndex: 0, riskChips: 7 },
      ];
      for (const c of cases) {
        const result = calculateBubbleFactor({
          stacks: c.stacks,
          payouts: [33, 33, 33],
          heroIndex: c.heroIndex,
          villainIndex: c.villainIndex,
          riskChips: c.riskChips,
        });
        expect(result.bf >= 0).toBe(true);
      }
    });
  });
});
