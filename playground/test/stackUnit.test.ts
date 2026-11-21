import { describe, expect, it } from "vitest";
import {
  DEFAULT_BB_SIZE,
  bbToInputValue,
  formatBbCompact,
  formatStackDisplay,
  formatStackShareLabel,
  inputValueToBb,
  rescaleStacksForBbSize,
  sanitizeBbSize,
} from "../src/stackUnit.js";

describe("stackUnit 変換ロジック", () => {
  it("sanitizeBbSize は正の有限数だけを通し、0・負数・NaN はフォールバックする", () => {
    expect(sanitizeBbSize(10000)).toBe(10000);
    expect(sanitizeBbSize("5000")).toBe(5000);
    expect(sanitizeBbSize(0)).toBe(DEFAULT_BB_SIZE);
    expect(sanitizeBbSize(-100)).toBe(DEFAULT_BB_SIZE);
    expect(sanitizeBbSize(Number.NaN, 2000)).toBe(2000);
  });

  it("BB モードは小数2桁までそのまま、チップモードは bbSize 倍で整数表示する", () => {
    expect(bbToInputValue(12.5, "bb", 10000)).toBe("12.5");
    expect(bbToInputValue(4.5, "chips", 10000)).toBe("45000");
    expect(bbToInputValue(18, "chips", 1000)).toBe("18000");
    expect(bbToInputValue(-5, "chips", 1000)).toBe("0");
  });

  it("入力値から内部 BB へ正しく換算し、負数・非有限は 0 にする", () => {
    expect(inputValueToBb(45000, "chips", 10000)).toBeCloseTo(4.5, 6);
    expect(inputValueToBb(120000, "chips", 10000)).toBeCloseTo(12, 6);
    expect(inputValueToBb(15, "bb", 10000)).toBe(15);
    expect(inputValueToBb(-500, "chips", 1000)).toBe(0);
    expect(inputValueToBb(Number.NaN, "chips", 1000)).toBe(0);
  });

  it("表示用・チョップ共有用テキストのフォーマットがモードに追従する", () => {
    expect(formatBbCompact(40000 / 3000)).toBe("13.3");
    expect(formatBbCompact(18)).toBe("18");
    expect(formatBbCompact(-1)).toBe("0");
    expect(formatStackDisplay(4.5, "bb", 10000)).toBe("4.5");
    expect(formatStackDisplay(40000 / 3000, "bb", 3000)).toBe("13.33");
    expect(formatStackDisplay(4.5, "chips", 10000)).toBe("45,000");
    expect(formatStackShareLabel(12, "bb", 10000)).toBe("12BB");
    expect(formatStackShareLabel(4.5, "chips", 10000)).toBe("45,000 (4.5BB)");
  });

  it("1 BB の額を変更してもチップ枚数を保ったまま BB スタックを再計算する", () => {
    // 45,000 点 (9BB @ 5,000) と 120,000 点 (24BB @ 5,000) → BB 10,000 で 4.5BB と 12BB
    const rescaled = rescaleStacksForBbSize([9, 24], 5000, 10000);
    expect(rescaled[0]).toBeCloseTo(4.5, 6);
    expect(rescaled[1]).toBeCloseTo(12, 6);
    // チップ数が保たれていること
    expect(bbToInputValue(rescaled[0]!, "chips", 10000)).toBe("45000");
    expect(bbToInputValue(rescaled[1]!, "chips", 10000)).toBe("120000");
  });
});
