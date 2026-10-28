import { describe, it, expect } from "vitest";
import { comboCountVsHero, matrixEquityVsRange } from "../src/rangeEquity.js";
import { topRange, ALL_169_HANDS, HAND_RANKING, type HandNotation } from "../src/handRanking.js";
import { equity } from "../src/equity.js";
import { combosForHand, computeRangeEquity, mulberry32 } from "../scripts/_mc.mts";

/** MC 1 点あたりの試行数 (標準誤差 ≈ 0.2pt)。 */
const MC_TRIALS = 60_000;
/** MC との許容差 (標準誤差の約 4 倍)。旧テーブルのズレ (1.5〜2pt) は検出できる。 */
const MC_TOLERANCE = 0.008;

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

  it("レンジ内のコンボを直接配る MC と一致する (旧テーブルが 1.5〜2pt ずれていた局面)", () => {
    // 旧 Top X% テーブルは相手ハンドを 169 クラスから等確率に選んでいた
    // (オフスートが実際の 1/3 の頻度)。正しく重み付けした MC と比べて
    // AKo vs Top30% で -1.9pt、AJo vs Top10% で +2.1pt などのズレがあった。
    const rng = mulberry32(20261028);
    for (const [hand, pct] of [
      ["AKo", 30],
      ["AJo", 10],
      ["22", 20],
      ["55", 15],
    ] as [HandNotation, number][]) {
      const villain = [...topRange(pct)].map((h) => combosForHand(h));
      const mc = computeRangeEquity(combosForHand(hand), villain, MC_TRIALS, rng);
      const mx = matrixEquityVsRange(hand, topRange(pct));
      expect(Math.abs(mx - mc)).toBeLessThan(MC_TOLERANCE);
    }
  });

  it("vs ランダムハンドの既知値: AA 85.2% / KK 82.4% / 72o 34.6%", () => {
    const all = new Set(ALL_169_HANDS);
    expect(matrixEquityVsRange("AA", all)).toBeCloseTo(0.852, 2);
    expect(matrixEquityVsRange("KK", all)).toBeCloseTo(0.824, 2);
    expect(matrixEquityVsRange("72o", all)).toBeCloseTo(0.346, 2);
  });
});

describe("computeRangeEquity (MC) のコンボ重み", () => {
  it("相手のハンドをコンボ数どおりの頻度で配る (AKo vs Top30% ≈ 64.5%)", () => {
    // クラス等確率で配ると 62.6% になる (旧テーブルの値)
    const villain = [...topRange(30)].map((h) => combosForHand(h));
    const eq = computeRangeEquity(combosForHand("AKo"), villain, MC_TRIALS, mulberry32(7));
    expect(Math.abs(eq - 0.645)).toBeLessThan(MC_TOLERANCE);
  });
});

describe("HAND_RANKING (Top X% の順序)", () => {
  it("169 種類を重複なく含み、AA が最強・32o が最弱", () => {
    expect(new Set(HAND_RANKING).size).toBe(169);
    expect(HAND_RANKING[0]).toBe("AA");
    expect(HAND_RANKING[168]).toBe("32o");
  });

  it("同じランクの組み合わせはスーテッドが必ずオフスートより上", () => {
    // 旧ランキングは 98o が 98s より、T3o が T3s より上だった
    for (const h of HAND_RANKING) {
      if (!h.endsWith("o")) continue;
      const suited = h.slice(0, 2) + "s";
      expect(HAND_RANKING.indexOf(suited)).toBeLessThan(HAND_RANKING.indexOf(h));
    }
  });

  it("vs ランダムの equity が降順に並んでいる", () => {
    const all = new Set(ALL_169_HANDS);
    const eqs = HAND_RANKING.map((h) => matrixEquityVsRange(h, all));
    for (let i = 1; i < eqs.length; i++) {
      expect(eqs[i]!).toBeLessThanOrEqual(eqs[i - 1]!);
    }
  });
});

describe("equity() はプリセットもカスタムもマトリクス計算を使う", () => {
  it("プリセット形 (Top X%)", () => {
    expect(equity("43s", topRange(54))).toBe(matrixEquityVsRange("43s", topRange(54)));
  });

  it("カスタム形", () => {
    const custom = new Set<HandNotation>(["AA", "KK", "QQ", "72o"]);
    expect(equity("AKs", custom)).toBe(matrixEquityVsRange("AKs", custom));
  });
});
