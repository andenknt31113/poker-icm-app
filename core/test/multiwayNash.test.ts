import { describe, expect, it } from "vitest";
import { solveHUNash } from "../src/nash.js";
import type { HandLabel } from "../src/nash.js";
import { buildMultiwayTerminals, solveMultiwayPushFold } from "../src/multiwayNash.js";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
const ALL_HANDS: HandLabel[] = [];
for (let i = 0; i < 13; i++) {
  for (let j = 0; j < 13; j++) {
    if (i === j) ALL_HANDS.push(`${RANKS[i]}${RANKS[j]}`);
    else if (i < j) ALL_HANDS.push(`${RANKS[i]}${RANKS[j]}s`);
    else ALL_HANDS.push(`${RANKS[j]}${RANKS[i]}o`);
  }
}

/** テスト用の単純な強さスコア → equity (本物の勝率表ではない)。 */
function score(h: HandLabel): number {
  const a = 12 - RANKS.indexOf(h[0] as (typeof RANKS)[number]);
  const b = 12 - RANKS.indexOf(h[1] as (typeof RANKS)[number]);
  if (h.length === 2) return 20 + a * 2;
  return a * 1.2 + b * 0.6 + (h[2] === "s" ? 1.5 : 0);
}
function huEquity(hero: HandLabel, villain: HandLabel): number {
  if (hero === villain) return 0.5;
  return 1 / (1 + Math.exp(-(score(hero) - score(villain)) / 6));
}
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
const comboPct = (range: ReadonlySet<HandLabel>): number => {
  let c = 0;
  for (const h of range) c += h.length === 2 ? 6 : h[2] === "s" ? 4 : 12;
  return (c / 1326) * 100;
};

describe("buildMultiwayTerminals", () => {
  // 並び: BTN(pusher) 10, SB 12, BB 15。BB が ante 1 を払う
  const base = {
    stacks: [10, 12, 15],
    payouts: [50, 30, 20],
    pusherIndex: 0,
    callerIndices: [1, 2],
    blinds: [0, 0.5, 1],
    antes: [0, 0, 1],
    foldWinnerIndex: 2,
  };

  it("どの終端でもチップの総量が変わらない", () => {
    const t = buildMultiwayTerminals(base);
    const total = sum(base.stacks);
    for (const s of [t.stacks.fold, t.stacks.steal, ...t.stacks.pusherWins, ...t.stacks.pusherLoses]) {
      expect(sum(s)).toBeCloseTo(total, 9);
    }
  });

  it("終端スタックの手計算", () => {
    const t = buildMultiwayTerminals(base);
    // fold: BB が SB 0.5 と ante 1 を取る (自分の blind は戻る)
    expect(t.stacks.fold).toEqual([10, 11.5, 15.5]);
    // steal: pusher が blind 1.5 + ante 1 を取る
    expect(t.stacks.steal).toEqual([12.5, 11.5, 13]);
    // SB が call: matched 10、dead = BB 1 + ante 1、pot 22
    expect(t.stacks.pusherWins[0]).toEqual([22, 2, 13]);
    expect(t.stacks.pusherLoses[0]).toEqual([0, 24, 13]);
    // BB が call: matched 10、dead = SB 0.5 + ante 1、pot 21.5
    expect(t.stacks.pusherWins[1]).toEqual([21.5, 11.5, 4]);
    expect(t.stacks.pusherLoses[1]).toEqual([0, 11.5, 25.5]);
  });

  it("$ エクイティの合計は賞金総額", () => {
    const t = buildMultiwayTerminals(base);
    for (const e of [t.fold, t.steal, ...t.pusherWins, ...t.pusherLoses]) {
      expect(sum(e)).toBeCloseTo(100, 6);
    }
  });
});

describe("solveMultiwayPushFold", () => {
  it("後ろが 1 人なら solveHUNash と同じレンジになる (3人卓・SB→BB)", () => {
    const stacks = [20, 10, 12];
    const payouts = [50, 30, 20];
    const hu = solveHUNash({
      stacks: [20, 10, 11], // BB の ante 1 を引いた後
      payouts,
      sbIndex: 1,
      bbIndex: 2,
      sb: 0.5,
      bb: 1,
      ante: 0,
      deadMoney: 1,
      huEquity,
      allHands: ALL_HANDS,
    });
    const multi = solveMultiwayPushFold({
      stacks,
      payouts,
      pusherIndex: 1,
      callerIndices: [2],
      blinds: [0, 0.5, 1],
      antes: [0, 0, 1],
      foldWinnerIndex: 2,
      huEquity,
      allHands: ALL_HANDS,
    });
    expect(multi.converged).toBe(true);
    expect([...multi.pushRange].sort()).toEqual([...hu.sbPushRange].sort());
    expect([...multi.callRanges[0]!].sort()).toEqual([...hu.bbCallRange].sort());
  });

  it("後ろに人が増えると、押せるレンジは狭くなる", () => {
    const common = {
      stacks: [10, 12, 15],
      payouts: [100],
      pusherIndex: 0,
      blinds: [0, 0.5, 1],
      antes: [0, 0, 0],
      foldWinnerIndex: 2,
      huEquity,
      allHands: ALL_HANDS,
    };
    const one = solveMultiwayPushFold({ ...common, callerIndices: [2] });
    const two = solveMultiwayPushFold({ ...common, callerIndices: [1, 2] });
    expect(two.converged).toBe(true);
    expect(comboPct(two.pushRange)).toBeLessThan(comboPct(one.pushRange));
    expect(two.pushRange.has("AA")).toBe(true);
    expect(two.callRanges).toHaveLength(2);
    expect(two.callRanges[0]!.has("AA")).toBe(true);
    expect(two.callRanges[1]!.has("AA")).toBe(true);
    expect(two.exploitability).toBeLessThan(0.001);
  });

  it("不正な入力はエラー", () => {
    const ok = {
      stacks: [10, 12, 15],
      payouts: [100],
      pusherIndex: 0,
      callerIndices: [1, 2],
      blinds: [0, 0.5, 1],
      antes: [0, 0, 0],
      foldWinnerIndex: 2,
      huEquity,
      allHands: ALL_HANDS,
    };
    expect(() => solveMultiwayPushFold({ ...ok, callerIndices: [] })).toThrow();
    expect(() => solveMultiwayPushFold({ ...ok, callerIndices: [0, 1] })).toThrow();
    expect(() => solveMultiwayPushFold({ ...ok, callerIndices: [1, 1] })).toThrow();
    expect(() => solveMultiwayPushFold({ ...ok, blinds: [0, 0.5] })).toThrow();
    expect(() => solveMultiwayPushFold({ ...ok, stacks: [10, 0.2, 15] })).toThrow();
  });
});
