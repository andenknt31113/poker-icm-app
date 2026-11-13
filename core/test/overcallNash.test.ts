import { describe, expect, it } from "vitest";
import type { HandLabel } from "../src/nash.js";
import { solveMultiwayPushFold } from "../src/multiwayNash.js";
import { solveOvercallPushFold, type ThreeWayEquityFn } from "../src/overcallNash.js";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
const ALL_HANDS: HandLabel[] = [];
for (let i = 0; i < 13; i++) {
  for (let j = 0; j < 13; j++) {
    if (i === j) ALL_HANDS.push(`${RANKS[i]}${RANKS[j]}`);
    else if (i < j) ALL_HANDS.push(`${RANKS[i]}${RANKS[j]}s`);
    else ALL_HANDS.push(`${RANKS[j]}${RANKS[i]}o`);
  }
}
/** テスト用の単純な強さスコア (本物の勝率表ではない)。 */
function score(h: HandLabel): number {
  const a = 12 - RANKS.indexOf(h[0] as (typeof RANKS)[number]);
  const b = 12 - RANKS.indexOf(h[1] as (typeof RANKS)[number]);
  if (h.length === 2) return 20 + a * 2;
  return a * 1.2 + b * 0.6 + (h[2] === "s" ? 1.5 : 0);
}
const strength = ALL_HANDS.map((h) => Math.exp(score(h) / 6));
function huEquity(hero: HandLabel, villain: HandLabel): number {
  if (hero === villain) return 0.5;
  const a = Math.exp(score(hero) / 6);
  const b = Math.exp(score(villain) / 6);
  return a / (a + b);
}
/** 強さに比例して勝つ 3 人の勝率 (2 人版と同じ考え方で整合する)。 */
const threeWay: ThreeWayEquityFn = (a, b, c, out) => {
  const total = strength[a]! + strength[b]! + strength[c]!;
  out[0] = strength[a]! / total;
  out[1] = strength[b]! / total;
  out[2] = strength[c]! / total;
  return true;
};
const neverThreeWay: ThreeWayEquityFn = () => false;

const comboPct = (range: ReadonlySet<HandLabel>): number => {
  let c = 0;
  for (const h of range) c += h.length === 2 ? 6 : h[2] === "s" ? 4 : 12;
  return (c / 1326) * 100;
};

const base = {
  stacks: [10, 10, 10],
  payouts: [100],
  pusherIndex: 0,
  callerIndices: [1, 2],
  blinds: [0, 0.5, 1],
  antes: [0, 0, 0],
  foldWinnerIndex: 2,
  huEquity,
  allHands: ALL_HANDS,
};

describe("solveOvercallPushFold", () => {
  it("3 人対決が起きない (表が常に不可能を返す) なら、オーバーコールなしのソルバと同じレンジ", () => {
    const plain = solveMultiwayPushFold(base);
    const result = solveOvercallPushFold({ ...base, threeWay: neverThreeWay });
    expect([...result.pushRange].sort()).toEqual([...plain.pushRange].sort());
    expect([...result.callRanges[0]!].sort()).toEqual([...plain.callRanges[0]!].sort());
    expect([...result.callRanges[1]!].sort()).toEqual([...plain.callRanges[1]!].sort());
    expect(result.overcallRanges[0]![0]!.size).toBe(0);
  });

  it("オーバーコールがあると、後ろに人がいるコール側は狭くなり、最後の人のコールは変わらない", () => {
    const plain = solveMultiwayPushFold(base);
    const result = solveOvercallPushFold({ ...base, threeWay });
    const overcall = result.overcallRanges[0]![0]!;
    expect(overcall.size).toBeGreaterThan(0);
    expect(overcall.has("AA")).toBe(true);
    // オーバーコールは、同じ人が最初にコールするレンジより狭い
    expect(comboPct(overcall)).toBeLessThan(comboPct(result.callRanges[1]!));
    expect(comboPct(result.callRanges[0]!)).toBeLessThanOrEqual(comboPct(plain.callRanges[0]!));
    expect(result.overcallRanges).toHaveLength(2);
    expect(result.overcallRanges[1]).toHaveLength(0);
  });

  it("スタックが違っても解ける (サイドポットあり)", () => {
    const result = solveOvercallPushFold({ ...base, stacks: [6, 14, 25], payouts: [50, 30, 20], threeWay });
    expect(result.pushRange.has("AA")).toBe(true);
    expect(result.callRanges[0]!.has("AA")).toBe(true);
    expect(result.overcallRanges[0]![0]!.has("AA")).toBe(true);
  });
});
