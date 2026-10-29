import { describe, expect, it } from "vitest";
import { ja } from "../src/locales/ja.js";
import { en } from "../src/locales/en.js";
import { comboPctOfRange, comboPctOfTopRange, topRange, topRangeByComboPct } from "../src/handRanking.js";

describe("レンジ比率の説明", () => {
  it("画面のスライダーはコンボ比率で上位 X% を取る", () => {
    for (const pct of [5, 10, 25, 50, 75]) {
      // 1 クラスは最大 12 コンボ (約0.9%) なので、それ以内で X% に合う
      expect(Math.abs(comboPctOfRange(topRangeByComboPct(pct)) - pct)).toBeLessThanOrEqual(0.5);
    }
    expect(topRangeByComboPct(0).size).toBe(0);
    expect(topRangeByComboPct(100).size).toBe(169);
    expect(topRangeByComboPct(25).has("AA")).toBe(true);
    expect(ja["hand.preset.top"]).toBe("上位");
    expect(en["hand.preset.top"]).toBe("Top");
  });
  it("練習の Top X% (種類ベース) はコンボ比率に直して表示する", () => {
    expect(topRange(25).size).toBe(42);
    // 2026-10-28 のランキング修正 (vs ランダム equity をコンボ重みで再計算) で 22% → 23%
    expect(comboPctOfTopRange(25)).toBe(23);
    expect(ja["practice.topPct"]).toContain("上位 {pct}%");
  });
  it.each(["call", "push"] as const)("%s 判定を単純な上位レンジと表現しない", (direction) => {
    const key = `calc.summary.verdict.${direction}` as const;
    expect(ja[key]).not.toContain("上位");
    expect(en[key]).not.toContain("top");
    expect(ja[key]).toContain("仮定");
    expect(en[key]).toContain("Assuming");
  });
});
