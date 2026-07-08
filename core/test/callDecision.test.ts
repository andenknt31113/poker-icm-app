import { describe, expect, it } from "vitest";
import { calculateExactCallEquity } from "../src/callDecision.js";
import { calculatePotOdds } from "../src/potOdds.js";

function sum(arr: readonly number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

describe("calculateExactCallEquity", () => {
  it("チップ保存則: villain が SB 本人の場合 (第三者 SB なし)", () => {
    const total = 3000 + 2000 + 1000;
    const r = calculateExactCallEquity({
      stacks: [3000, 2000, 1000],
      payouts: [50, 30, 20],
      heroIndex: 2,
      villainIndex: 1,
      heroPosition: "BB",
      villainPosition: "SB",
      sbPlayerIndex: 1,
      sb: 50,
      bb: 100,
      ante: 100,
    });
    expect(sum(r.stacksFold)).toBeCloseTo(total, 6);
    expect(sum(r.stacksWin)).toBeCloseTo(total, 6);
    expect(sum(r.stacksLose)).toBeCloseTo(total, 6);
    // 手計算リファレンス (BTN, SB=villain, BB=hero の並び)
    expect(r.stacksFold).toEqual([3000, 2200, 800]);
    expect(r.stacksWin).toEqual([3000, 1100, 1900]);
    expect(r.stacksLose).toEqual([3000, 3000, 0]);
  });

  it("チップ保存則: SB が hero/villain と別人 (第三者 SB は dead)", () => {
    const total = 3000 + 2000 + 1000;
    const r = calculateExactCallEquity({
      stacks: [3000, 2000, 1000],
      payouts: [50, 30, 20],
      heroIndex: 2,
      villainIndex: 0,
      heroPosition: "BB",
      villainPosition: "OTHER",
      sbPlayerIndex: 1,
      sb: 50,
      bb: 100,
      ante: 100,
    });
    expect(sum(r.stacksFold)).toBeCloseTo(total, 6);
    expect(sum(r.stacksWin)).toBeCloseTo(total, 6);
    expect(sum(r.stacksLose)).toBeCloseTo(total, 6);
    // 手計算リファレンス (BTN=villain, SB=第三者, BB=hero の並び)
    expect(r.stacksFold).toEqual([3250, 1950, 800]);
    expect(r.stacksWin).toEqual([2100, 1950, 1950]);
    expect(r.stacksLose).toEqual([4050, 1950, 0]);
  });

  it("チップ保存則: 4人・第三者SBあり (bubble シナリオでも保存される)", () => {
    const stacks = [3000, 3000, 3000, 3000];
    const total = sum(stacks);
    const r = calculateExactCallEquity({
      stacks,
      payouts: [50, 30, 20],
      heroIndex: 2,
      villainIndex: 3,
      heroPosition: "BB",
      villainPosition: "OTHER",
      sbPlayerIndex: 1,
      sb: 50,
      bb: 100,
      ante: 100,
    });
    expect(sum(r.stacksFold)).toBeCloseTo(total, 6);
    expect(sum(r.stacksWin)).toBeCloseTo(total, 6);
    expect(sum(r.stacksLose)).toBeCloseTo(total, 6);
  });

  it("WTA (payouts=[100]) では ICM がチップ比例 = リニアになるため、厳密必要勝率 ≈ cEV に一致する", () => {
    const heroStack = 1000;
    const villainStack = 2000;
    const sb = 50;
    const bb = 100;
    const ante = 100;

    const r = calculateExactCallEquity({
      stacks: [3000, villainStack, heroStack],
      payouts: [100],
      heroIndex: 2,
      villainIndex: 1,
      heroPosition: "BB",
      villainPosition: "SB",
      sbPlayerIndex: 1,
      sb,
      bb,
      ante,
    });

    const podds = calculatePotOdds({
      heroStack,
      villainStack,
      heroPosition: "BB",
      villainPosition: "SB",
      sb,
      bb,
      ante,
    });
    const cEV = podds.callAmount / (podds.callAmount + podds.potIfWin);

    expect(r.requiredEquity).toBeCloseTo(cEV, 6);
  });

  it("バブル状況 (4人残り, payouts 50/30/20) では厳密必要勝率 > cEV (リスクプレミアムが正)", () => {
    const heroStack = 3000;
    const villainStack = 3000;
    const sb = 50;
    const bb = 100;
    const ante = 100;

    const r = calculateExactCallEquity({
      stacks: [3000, 3000, heroStack, villainStack],
      payouts: [50, 30, 20],
      heroIndex: 2,
      villainIndex: 3,
      heroPosition: "BB",
      villainPosition: "OTHER",
      sbPlayerIndex: 1,
      sb,
      bb,
      ante,
    });

    const podds = calculatePotOdds({
      heroStack,
      villainStack,
      heroPosition: "BB",
      villainPosition: "OTHER",
      sb,
      bb,
      ante,
    });
    const cEV = podds.callAmount / (podds.callAmount + podds.potIfWin);

    expect(r.requiredEquity).toBeGreaterThan(cEV);
  });

  it("サテライト (top3均等ペイ, hero は大差の2番手) では requiredEquity が極端に高くなる (ロック)", () => {
    // hero(150) は villain(2000) より大幅に短いため call すれば全ロスト前提の
    // オールイン。だが fold してもチップリーダー級 (BTN 1000) の下に安全に
    // 逃げ込めるほど大きい一方、短スタックの第三者 SB(1) がほぼ確実に最下位で
    // バストするため、hero の fold エクイティは既に「ほぼロック」に近い。
    // → 勝っても (fold と大差ない) $ が増えない一方、負ければ即バスト。
    const r = calculateExactCallEquity({
      stacks: [1000, 1, 150, 2000],
      payouts: [33.4, 33.3, 33.3],
      heroIndex: 2,
      villainIndex: 3,
      heroPosition: "BB",
      villainPosition: "OTHER",
      sbPlayerIndex: 1,
      sb: 0.5,
      bb: 1,
      ante: 1,
    });
    expect(r.requiredEquity).toBeGreaterThan(0.99);
    expect(r.requiredEquity).toBeLessThanOrEqual(1);
  });

  it("勝っても $ エクイティが増えない (denom <= 0, 全順位ペイ額が同額) 場合は requiredEquity = 1", () => {
    // payouts が全順位で同額 (10/10/10) だと、誰が何位で終わっても賞金総取り分は
    // 変わらないため、stack がどう動いても ICM エクイティは変化しない
    // (equityWin = equityLose = equityFold)。この場合 call しても増える $ が
    // ないので、絶対 fold (requiredEquity = 1) が正しい。
    const r = calculateExactCallEquity({
      stacks: [1000, 1000, 1000],
      payouts: [10, 10, 10],
      heroIndex: 2,
      villainIndex: 1,
      heroPosition: "BB",
      villainPosition: "SB",
      sbPlayerIndex: 1,
      sb: 50,
      bb: 100,
      ante: 100,
    });
    expect(r.equityWin).toBeCloseTo(r.equityLose, 9);
    expect(r.equityWin).toBeCloseTo(r.equityFold, 9);
    expect(r.requiredEquity).toBe(1);
  });

  it("hero と villain が同じ index はエラー", () => {
    expect(() =>
      calculateExactCallEquity({
        stacks: [1000, 1000, 1000],
        payouts: [50, 30, 20],
        heroIndex: 1,
        villainIndex: 1,
        heroPosition: "BB",
        villainPosition: "SB",
        sb: 50,
        bb: 100,
        ante: 100,
      }),
    ).toThrow();
  });

  it("heroPosition/villainPosition のどちらも BB でないとエラー (ante 負担者不明)", () => {
    expect(() =>
      calculateExactCallEquity({
        stacks: [1000, 1000, 1000],
        payouts: [50, 30, 20],
        heroIndex: 0,
        villainIndex: 1,
        heroPosition: "SB",
        villainPosition: "OTHER",
        sb: 50,
        bb: 100,
        ante: 100,
      }),
    ).toThrow();
  });
});
