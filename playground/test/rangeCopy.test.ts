import { describe, expect, it } from "vitest";
import { ja } from "../src/locales/ja.js";
import { en } from "../src/locales/en.js";
import { comboPctOfRange, topRange } from "../src/handRanking.js";

describe("レンジ比率の説明", () => {
  it("既存の25%プリセットの計算を変えず、組合せ比率と区別する", () => {
    expect(topRange(25).size).toBe(42);
    expect(comboPctOfRange(topRange(25)).toFixed(0)).toBe("22");
    expect(ja["hand.preset.scale"]).toContain("種類");
    expect(ja["hand.preset.combos"]).toContain("{pct}%");
    expect(en["hand.preset.scale"]).toContain("class");
    expect(en["hand.preset.combos"]).toContain("{pct}%");
  });
  it.each(["call", "push"] as const)("%s 判定を単純な上位レンジと表現しない", (direction) => {
    const key = `calc.summary.verdict.${direction}` as const;
    expect(ja[key]).not.toContain("上位");
    expect(en[key]).not.toContain("top");
    expect(ja[key]).toContain("仮定");
    expect(en[key]).toContain("Assuming");
  });
});
