import { describe, it, expect } from "vitest";
import {
  comboCountVsHero,
  matrixEquityVsRange,
  isTopPrefixRange,
} from "../src/rangeEquity.js";
import { topRange, ALL_169_HANDS, type HandNotation } from "../src/handRanking.js";
import { equity } from "../src/equity.js";
import { tableEquityVsTop } from "../src/equityFromTable.js";

describe("comboCountVsHero (カードリムーバル込みコンボ数)", () => {
  it("ブロッカーなしの基本値: pair=6, suited=4, offsuit=12", () => {
    expect(comboCountVsHero("AA", "KK")).toBe(6);
    expect(comboCountVsHero("AA", "87s")).toBe(4);
    expect(comboCountVsHero("AA", "87o")).toBe(12);
  });

  it("hero AA vs villain AA: 残り2枚から C(2,2)=1", () => {
    expect(comboCountVsHero("AA", "AA")).toBe(1);
  });

  it("hero AKs vs villain AA/KK: A・K を1枚ずつブロック → C(3,2)=3", () => {
    expect(comboCountVsHero("AKs", "AA")).toBe(3);
    expect(comboCountVsHero("AKs", "KK")).toBe(3);
  });

  it("hero AKo vs villain AKo: 12 → 7 コンボ (定番のブロッカー計算)", () => {
    expect(comboCountVsHero("AKo", "AKo")).toBe(7);
  });

  it("hero AKs vs villain AQs: A のスートを1つブロック → 3", () => {
    expect(comboCountVsHero("AKs", "AQs")).toBe(3);
  });

  it("hero AKo vs villain QJs: 無関係ランクはブロックされず 4", () => {
    expect(comboCountVsHero("AKo", "QJs")).toBe(4);
  });

  it("全 villain クラスの合計コンボ = 1225 (52-2 枚から C(50,2))", () => {
    let total = 0;
    for (const v of ALL_169_HANDS) total += comboCountVsHero("AKo", v);
    expect(total).toBe(1225);
    total = 0;
    for (const v of ALL_169_HANDS) total += comboCountVsHero("55", v);
    expect(total).toBe(1225);
  });
});

describe("matrixEquityVsRange", () => {
  it("空レンジは 0.5 (中立)", () => {
    expect(matrixEquityVsRange("AA", new Set())).toBe(0.5);
  });

  it("AA vs {AA} はミラーなので 0.5 近傍", () => {
    const eq = matrixEquityVsRange("AA", new Set<HandNotation>(["AA"]));
    expect(eq).toBeGreaterThan(0.47);
    expect(eq).toBeLessThan(0.53);
  });

  it("AA は Top30% レンジに対して 72% 以上の equity", () => {
    const eq = matrixEquityVsRange("AA", topRange(30));
    expect(eq).toBeGreaterThan(0.72);
  });

  it("72o は Top50% レンジに対して 40% 未満", () => {
    const eq = matrixEquityVsRange("72o", topRange(50));
    expect(eq).toBeLessThan(0.4);
  });

  it("MC テーブル (Top X% 実レンジ配布) と大きく乖離しない (代表点で ±2.5pt)", () => {
    // 抽象の取り方が違う2系統 (クラス平均マトリクス vs 実カード MC) の
    // クロスチェック。系統誤差がこの範囲に収まっていれば両者は整合とみなす。
    for (const [hand, pct] of [
      ["43s", 54],
      ["A9o", 30],
      ["KQs", 40],
      ["22", 20],
    ] as [HandNotation, number][]) {
      const mc = tableEquityVsTop(hand, pct);
      expect(mc).not.toBeNull();
      const mx = matrixEquityVsRange(hand, topRange(pct));
      expect(Math.abs(mx - mc!)).toBeLessThan(0.025);
    }
  });
});

describe("isTopPrefixRange / equity() の経路選択", () => {
  it("topRange(X) は top-prefix と判定される", () => {
    expect(isTopPrefixRange(topRange(15))).toBe(true);
    expect(isTopPrefixRange(topRange(54))).toBe(true);
    expect(isTopPrefixRange(topRange(100))).toBe(true);
  });

  it("穴あきカスタムレンジは top-prefix ではない", () => {
    const custom = new Set<HandNotation>(topRange(20));
    // 最上位を1つ抜いて下位を1つ足す → prefix でなくなる
    const sorted = [...custom];
    custom.delete(sorted[0]!);
    custom.add("72o");
    expect(isTopPrefixRange(custom)).toBe(false);
  });

  it("equity(): プリセット形は MC テーブル値と一致する", () => {
    const viaEquity = equity("43s", topRange(54));
    expect(viaEquity).toBe(tableEquityVsTop("43s", 54));
  });

  it("equity(): カスタム形はマトリクス重み付き平均に切り替わる", () => {
    const custom = new Set<HandNotation>(["AA", "KK", "QQ", "72o"]);
    expect(equity("AKs", custom)).toBe(matrixEquityVsRange("AKs", custom));
  });
});
