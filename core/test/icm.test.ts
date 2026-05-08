import { describe, expect, it } from "vitest";
import { calculateICM, headsUpEquity, MAX_PLAYERS } from "../src/icm.js";

const EPS = 1e-6;

describe("calculateICM", () => {
  it("空の入力には空を返す", () => {
    expect(calculateICM([], [])).toEqual([]);
  });

  it("対称な4人 → 全員エクイティが等しい", () => {
    const stacks = [2500, 2500, 2500, 2500];
    const payouts = [50, 30, 20];
    const eq = calculateICM(stacks, payouts);
    expect(eq).toHaveLength(4);
    const expected = (50 + 30 + 20) / 4; // = 25
    for (const v of eq) expect(v).toBeCloseTo(expected, 6);
  });

  it("ヘッズアップは線形 (リファレンス: stacks [3000, 1000], payouts [60, 40])", () => {
    const eq = calculateICM([3000, 1000], [60, 40]);
    expect(eq[0]).toBeCloseTo(55, 6); // 0.75*60 + 0.25*40
    expect(eq[1]).toBeCloseTo(45, 6); // 0.25*60 + 0.75*40
  });

  it("3人ICM: 手計算と一致 (stacks [5000, 3000, 2000], payouts [50, 30, 20])", () => {
    const eq = calculateICM([5000, 3000, 2000], [50, 30, 20]);
    expect(eq[0]).toBeCloseTo(38.392857, 5);
    expect(eq[1]).toBeCloseTo(32.75, 5);
    expect(eq[2]).toBeCloseTo(28.857143, 5);
  });

  it("エクイティの合計 = 賞金合計", () => {
    const stacks = [4000, 3000, 2000, 1000];
    const payouts = [50, 30, 20, 0];
    const eq = calculateICM(stacks, payouts);
    const sum = eq.reduce((a, b) => a + b, 0);
    const total = payouts.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(total, 6);
  });

  it("スタック順 → エクイティ順を保つ", () => {
    const stacks = [4000, 3000, 2000, 1000];
    const payouts = [50, 30, 20, 0];
    const eq = calculateICM(stacks, payouts);
    expect(eq[0]).toBeGreaterThan(eq[1]!);
    expect(eq[1]).toBeGreaterThan(eq[2]!);
    expect(eq[2]).toBeGreaterThan(eq[3]!);
  });

  it("バブル: 賞金枠より人数が多ければ一部はエクイティ 0 寄りになる", () => {
    // 5人で賞金は3位まで。最下位はエクイティが小さい
    const eq = calculateICM([3000, 2500, 2000, 1500, 1000], [50, 30, 20]);
    expect(eq[4]).toBeGreaterThan(0); // バブル前なので完全に0ではない
    expect(eq[0]).toBeGreaterThan(eq[4]!);
  });

  it("payouts.length < n でも合計は payouts 合計と一致", () => {
    const eq = calculateICM([3000, 2500, 2000, 1500, 1000], [50, 30, 20]);
    const sum = eq.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it("payouts.length > n は超過分が無視される", () => {
    const eq = calculateICM([3000, 1000], [60, 40, 30]); // 3位賞金は割当不能
    const sum = eq.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it("スタック0のプレイヤーは選ばれない", () => {
    const eq = calculateICM([5000, 0], [60, 40]);
    expect(eq[0]).toBeCloseTo(60, 6);
    expect(eq[1]).toBeCloseTo(40, 6);
  });

  it("全員0チップはエラー", () => {
    expect(() => calculateICM([0, 0, 0], [50, 30, 20])).toThrow();
  });

  it("負のスタックはエラー", () => {
    expect(() => calculateICM([3000, -100], [60, 40])).toThrow();
  });

  it(`プレイヤー数が ${MAX_PLAYERS} を超えるとエラー`, () => {
    const stacks = Array.from({ length: MAX_PLAYERS + 1 }, () => 1000);
    expect(() => calculateICM(stacks, [50])).toThrow();
  });

  it("9人MTT FT 想定 (stacks 等差) でも合計が一致する", () => {
    const stacks = [9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000];
    const payouts = [40, 25, 15, 10, 5, 3, 2];
    const eq = calculateICM(stacks, payouts);
    const sum = eq.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 6);
    // 順位保持
    for (let i = 0; i < stacks.length - 1; i++) {
      expect(eq[i]).toBeGreaterThan(eq[i + 1]!);
    }
  });
});

describe("headsUpEquity", () => {
  it("線形補間で正しい", () => {
    expect(headsUpEquity(3000, 1000, [60, 40])).toBeCloseTo(55, EPS);
    expect(headsUpEquity(1000, 3000, [60, 40])).toBeCloseTo(45, EPS);
  });
});
