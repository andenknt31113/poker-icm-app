import { describe, expect, it } from "vitest";
import { evaluatePushDecision } from "../src/pushDecision.js";

function sum(arr: readonly number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

describe("evaluatePushDecision", () => {
  it("チップ保存則: 全4終端 (fold/steal/win/lose) で総チップが保存される (2人)", () => {
    const stacks = [1000, 2000];
    const total = sum(stacks);
    const r = evaluatePushDecision({
      stacks,
      payouts: [100],
      heroIndex: 0,
      villainIndex: 1,
      sb: 50,
      bb: 100,
      ante: 100,
      pCall: 0.4,
      eqVsCallRange: 0.35,
    });
    expect(sum(r.stacksFold)).toBeCloseTo(total, 6);
    expect(sum(r.stacksSteal)).toBeCloseTo(total, 6);
    expect(sum(r.stacksWin)).toBeCloseTo(total, 6);
    expect(sum(r.stacksLose)).toBeCloseTo(total, 6);
    // 手計算リファレンス
    expect(r.stacksFold).toEqual([950, 2050]);
    expect(r.stacksSteal).toEqual([1200, 1800]);
    expect(r.stacksWin).toEqual([2100, 900]);
    expect(r.stacksLose).toEqual([0, 3000]);
  });

  it("チップ保存則: 第三者プレイヤーがいても不変 (4人)", () => {
    const stacks = [15, 8, 20, 20];
    const total = sum(stacks);
    const r = evaluatePushDecision({
      stacks,
      payouts: [50, 30, 20],
      heroIndex: 2,
      villainIndex: 3,
      sb: 0.5,
      bb: 1,
      ante: 1,
      pCall: 0.3,
      eqVsCallRange: 0.4,
    });
    expect(sum(r.stacksFold)).toBeCloseTo(total, 6);
    expect(sum(r.stacksSteal)).toBeCloseTo(total, 6);
    expect(sum(r.stacksWin)).toBeCloseTo(total, 6);
    expect(sum(r.stacksLose)).toBeCloseTo(total, 6);
    // 第三者 (index 0, 1) のスタックはどの終端でも不変
    for (const terminal of [r.stacksFold, r.stacksSteal, r.stacksWin, r.stacksLose]) {
      expect(terminal[0]).toBe(stacks[0]);
      expect(terminal[1]).toBe(stacks[1]);
    }
  });

  it("WTA (payouts=[100]) では evPush-evFold がチップ EV の差とスケール一致する (手計算)", () => {
    // heroStack=1000, villainStack=2000, sb=50, bb=100, ante=100, pCall=0.4, eq=0.35
    // 手計算 (本文参照):
    //   stacksFold=[950,2050] stacksSteal=[1200,1800] stacksWin=[2100,900] stacksLose=[0,3000]
    //   チップ EV: fold=950, push=0.6*1200+0.4*(0.35*2100+0.65*0)=720+294=1014
    //   差 = 1014-950 = 64 → WTA では equity = stack/total*100 なので
    //   evPush-evFold = 64/3000*100 = 2.1333...%
    const stacks = [1000, 2000];
    const total = sum(stacks);
    const r = evaluatePushDecision({
      stacks,
      payouts: [100],
      heroIndex: 0,
      villainIndex: 1,
      sb: 50,
      bb: 100,
      ante: 100,
      pCall: 0.4,
      eqVsCallRange: 0.35,
    });
    const chipFold = 950;
    const chipPush = 0.6 * 1200 + 0.4 * (0.35 * 2100 + 0.65 * 0);
    const expectedDiffPct = ((chipPush - chipFold) / total) * 100;
    expect(r.evPush - r.evFold).toBeCloseTo(expectedDiffPct, 6);
    expect(r.evPush - r.evFold).toBeCloseTo(2.133333, 5);
    expect(r.shouldPush).toBe(true);
  });

  it("バブル (4人, payouts 50/30/20) ではチップ EV 上の損益分岐点でも push は -EV になる (push 側もタイト化)", () => {
    // heroStack=20, villainStack=20, sb=0.5, bb=1, ante=1
    //   heroLive=20, villainLive=19, matched=19, pot=39
    //   stealChips=22, winChips=40, loseChips=1, foldChips=19.5
    // pCall=0.5 のとき、eq=8/19.5 でチップ EV 上ちょうど push=fold (損益分岐点)。
    //   0.5*22 + 0.5*(eq*40+(1-eq)*1) = 19.5  →  eq = 8/19.5
    const pCall = 0.5;
    const eq = 8 / 19.5;
    const stacks = [20, 20, 20, 20];
    const r = evaluatePushDecision({
      stacks,
      payouts: [50, 30, 20],
      heroIndex: 2,
      villainIndex: 3,
      sb: 0.5,
      bb: 1,
      ante: 1,
      pCall,
      eqVsCallRange: eq,
    });
    // チップだけなら損益分岐 (0付近) だが、ICM 下ではバブルの生存圧により
    // push が -EV に転じる (= 実戦で押されるより広い range で push しないよう
    // タイトにすべき、という方向性)
    expect(r.evPush).toBeLessThan(r.evFold);
    expect(r.shouldPush).toBe(false);
  });

  it("hero と villain が同じ index はエラー", () => {
    expect(() =>
      evaluatePushDecision({
        stacks: [1000, 1000, 1000],
        payouts: [50, 30, 20],
        heroIndex: 1,
        villainIndex: 1,
        sb: 50,
        bb: 100,
        ante: 100,
        pCall: 0.3,
        eqVsCallRange: 0.5,
      }),
    ).toThrow();
  });

  it("heroIndex/villainIndex が範囲外はエラー", () => {
    expect(() =>
      evaluatePushDecision({
        stacks: [1000, 1000],
        payouts: [50, 30, 20],
        heroIndex: 0,
        villainIndex: 5,
        sb: 50,
        bb: 100,
        ante: 100,
        pCall: 0.3,
        eqVsCallRange: 0.5,
      }),
    ).toThrow();
  });

  it("sb/bb/ante が負ならエラー", () => {
    expect(() =>
      evaluatePushDecision({
        stacks: [1000, 1000],
        payouts: [50, 30, 20],
        heroIndex: 0,
        villainIndex: 1,
        sb: -50,
        bb: 100,
        ante: 100,
        pCall: 0.3,
        eqVsCallRange: 0.5,
      }),
    ).toThrow();
  });

  it("pCall が 0..1 の範囲外はエラー", () => {
    expect(() =>
      evaluatePushDecision({
        stacks: [1000, 1000],
        payouts: [50, 30, 20],
        heroIndex: 0,
        villainIndex: 1,
        sb: 50,
        bb: 100,
        ante: 100,
        pCall: 1.5,
        eqVsCallRange: 0.5,
      }),
    ).toThrow();
  });

  it("eqVsCallRange が 0..1 の範囲外はエラー", () => {
    expect(() =>
      evaluatePushDecision({
        stacks: [1000, 1000],
        payouts: [50, 30, 20],
        heroIndex: 0,
        villainIndex: 1,
        sb: 50,
        bb: 100,
        ante: 100,
        pCall: 0.5,
        eqVsCallRange: -0.1,
      }),
    ).toThrow();
  });
});
