import { describe, expect, it } from "vitest";
import { bountyEquities, equitiesWithBounty } from "../src/bounty.js";
import { calculateICM } from "../src/icm.js";
import { calculateExactCallEquity } from "../src/callDecision.js";
import { calculateBubbleFactor } from "../src/bf.js";
import { solveHUNash, type HandLabel } from "../src/nash.js";
import { buildMultiwayTerminals } from "../src/multiwayNash.js";
import { solveOvercallPushFold, type ThreeWayEquityFn } from "../src/overcallNash.js";

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

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
const threeWay: ThreeWayEquityFn = (a, b, c, out) => {
  const total = strength[a]! + strength[b]! + strength[c]!;
  out[0] = strength[a]! / total;
  out[1] = strength[b]! / total;
  out[2] = strength[c]! / total;
  return true;
};
const comboPct = (range: ReadonlySet<HandLabel>): number => {
  let c = 0;
  for (const h of range) c += h.length === 2 ? 6 : h[2] === "s" ? 4 : 12;
  return (c / 1326) * 100;
};

describe("bountyEquities", () => {
  it("誰も飛んでいなければ、残っている首の合計をチップ比率で分ける", () => {
    const extra = bountyEquities([30, 10], { heads: [5, 15] });
    expect(extra[0]).toBeCloseTo(15, 10);
    expect(extra[1]).toBeCloseTo(5, 10);
  });

  it("KO: 飛ばした人が相手の首を全額受け取り、残りの首はチップ比率で分ける", () => {
    // 3 人。0 が 2 を飛ばした。残る首は 0 と 1 の 10 + 10
    const extra = bountyEquities([30, 10, 0], { heads: [10, 10, 8] }, [{ winner: 0, loser: 2 }]);
    expect(extra[0]).toBeCloseTo(8 + 0.75 * 20, 10);
    expect(extra[1]).toBeCloseTo(0.25 * 20, 10);
    expect(extra[2]).toBe(0);
  });

  it("PKO: 半分がその場の現金、残り半分は飛ばした人の首に乗って卓に残る", () => {
    const extra = bountyEquities([30, 10, 0], { heads: [10, 10, 8], progressive: true }, [
      { winner: 0, loser: 2 },
    ]);
    // 現金 4。残る首は 14 + 10 = 24
    expect(extra[0]).toBeCloseTo(4 + 0.75 * 24, 10);
    expect(extra[1]).toBeCloseTo(0.25 * 24, 10);
  });

  it("KO でも PKO でも、全員の取り分の合計は首の合計と一致する", () => {
    for (const progressive of [false, true]) {
      const heads = [10, 20, 8];
      const extra = bountyEquities([25, 15, 0], { heads, progressive }, [{ winner: 1, loser: 2 }]);
      expect(sum(extra)).toBeCloseTo(sum(heads), 10);
    }
  });

  it("最後の 2 人で相手を飛ばすと、相手の首と自分の首を両方受け取る", () => {
    const extra = bountyEquities([40, 0], { heads: [7, 7] }, [{ winner: 0, loser: 1 }]);
    expect(extra[0]).toBeCloseTo(14, 10);
  });

  it("相手のスタックが残っていれば、飛ばした扱いにしない", () => {
    const extra = bountyEquities([30, 10], { heads: [5, 15] }, [{ winner: 0, loser: 1 }]);
    expect(extra[0]).toBeCloseTo(15, 10);
  });

  it("heads の長さや値がおかしければ例外", () => {
    expect(() => bountyEquities([10, 10], { heads: [1] })).toThrow();
    expect(() => bountyEquities([10, 10], { heads: [1, -1] })).toThrow();
  });
});

describe("equitiesWithBounty", () => {
  it("bounty を渡さなければ ICM と同じ", () => {
    const stacks = [20, 15, 10];
    const payouts = [50, 30, 20];
    expect(equitiesWithBounty(stacks, payouts)).toEqual([...calculateICM(stacks, payouts)]);
  });

  it("合計は 賞金の合計 + 首の合計", () => {
    const total = sum(equitiesWithBounty([20, 15, 10], [50, 30, 20], { heads: [5, 5, 5] }));
    expect(total).toBeCloseTo(115, 8);
  });
});

describe("バウンティを入れたコール判断", () => {
  // 3 人。BB の自分が SB のオールインを受ける。賞金 50 / 30 / 20
  const spot = {
    payouts: [50, 30, 20],
    heroIndex: 0,
    villainIndex: 1,
    heroPosition: "BB" as const,
    villainPosition: "SB" as const,
    sb: 0.5,
    bb: 1,
    ante: 1,
  };
  const heads = [10, 10, 10];

  it("首が全員 0 なら、バウンティなしと同じ必要勝率", () => {
    const stacks = [20, 8, 15];
    const plain = calculateExactCallEquity({ ...spot, stacks });
    const zero = calculateExactCallEquity({ ...spot, stacks, bounty: { heads: [0, 0, 0] } });
    expect(zero.requiredEquity).toBeCloseTo(plain.requiredEquity, 12);
  });

  it("相手を飛ばせるとき、必要勝率はバウンティなしより下がる", () => {
    const stacks = [20, 8, 15];
    const plain = calculateExactCallEquity({ ...spot, stacks });
    const ko = calculateExactCallEquity({ ...spot, stacks, bounty: { heads } });
    expect(ko.requiredEquity).toBeLessThan(plain.requiredEquity);
    // 勝ったときの $ は、相手の首ぶんだけ増えている
    expect(ko.equityWin - plain.equityWin).toBeGreaterThan(10);
  });

  it("PKO は KO より下がり方が小さい (その場の現金が半分)", () => {
    const stacks = [20, 8, 15];
    const plain = calculateExactCallEquity({ ...spot, stacks });
    const ko = calculateExactCallEquity({ ...spot, stacks, bounty: { heads } });
    const pko = calculateExactCallEquity({ ...spot, stacks, bounty: { heads, progressive: true } });
    expect(pko.requiredEquity).toBeGreaterThan(ko.requiredEquity);
    expect(pko.requiredEquity).toBeLessThan(plain.requiredEquity);
  });

  it("相手にカバーされているときは、飛ばせるときほど下がらない", () => {
    const covering = calculateExactCallEquity({ ...spot, stacks: [20, 8, 15], bounty: { heads } });
    const coveringPlain = calculateExactCallEquity({ ...spot, stacks: [20, 8, 15] });
    const covered = calculateExactCallEquity({ ...spot, stacks: [8, 20, 15], bounty: { heads } });
    const coveredPlain = calculateExactCallEquity({ ...spot, stacks: [8, 20, 15] });
    const dropCovering = coveringPlain.requiredEquity - covering.requiredEquity;
    const dropCovered = coveredPlain.requiredEquity - covered.requiredEquity;
    expect(dropCovering).toBeGreaterThan(dropCovered);
  });

  it("BF も、相手を飛ばせるときは下がる", () => {
    const stacks = [20, 8, 15];
    const input = { stacks, payouts: spot.payouts, heroIndex: 0, villainIndex: 1, riskChips: 8 };
    const plain = calculateBubbleFactor(input);
    const ko = calculateBubbleFactor({ ...input, bounty: { heads } });
    expect(ko.bf).toBeLessThan(plain.bf);
  });
});

describe("バウンティを入れた Nash", () => {
  const base = {
    stacks: [8, 20, 15],
    payouts: [50, 30, 20],
    sbIndex: 0,
    bbIndex: 1,
    sb: 0.5,
    bb: 1,
    huEquity,
    allHands: ALL_HANDS,
  };

  it("飛ばせる側のコールレンジが広がる", () => {
    const plain = solveHUNash(base);
    const ko = solveHUNash({ ...base, bounty: { heads: [10, 10, 10] } });
    expect(comboPct(ko.bbCallRange)).toBeGreaterThan(comboPct(plain.bbCallRange));
  });

  it("首が全員 0 なら、バウンティなしと同じレンジ", () => {
    const plain = solveHUNash(base);
    const zero = solveHUNash({ ...base, bounty: { heads: [0, 0, 0] } });
    expect([...zero.sbPushRange].sort()).toEqual([...plain.sbPushRange].sort());
    expect([...zero.bbCallRange].sort()).toEqual([...plain.bbCallRange].sort());
  });
});

describe("バウンティを入れた多人数の終端", () => {
  const base = {
    stacks: [10, 12, 15],
    payouts: [50, 30, 20],
    pusherIndex: 0,
    callerIndices: [1, 2],
    blinds: [0, 0.5, 1],
    antes: [0, 0, 1],
    foldWinnerIndex: 2,
  };
  const heads = [6, 6, 6];

  it("どの終端でも、全員の $ の合計は 賞金の合計 + 首の合計", () => {
    for (const progressive of [false, true]) {
      const terminals = buildMultiwayTerminals({ ...base, bounty: { heads, progressive } });
      const all = [terminals.fold, terminals.steal, ...terminals.pusherWins, ...terminals.pusherLoses];
      for (const values of all) expect(sum(values)).toBeCloseTo(118, 8);
    }
  });

  it("押した人が負けて飛ぶ終端では、勝った人が首を受け取る", () => {
    const plain = buildMultiwayTerminals(base);
    const ko = buildMultiwayTerminals({ ...base, bounty: { heads } });
    // callers[0] (index 1) が勝った終端。index 1 の増え方は、残る首の取り分だけの index 2 より大きい
    const gainWinner = ko.pusherLoses[0]![1]! - plain.pusherLoses[0]![1]!;
    const gainBystander = ko.pusherLoses[0]![2]! - plain.pusherLoses[0]![2]!;
    expect(gainWinner).toBeGreaterThan(6);
    expect(gainWinner).toBeGreaterThan(gainBystander);
    expect(ko.pusherLoses[0]![0]).toBeCloseTo(plain.pusherLoses[0]![0]!, 10);
  });
});

describe("バウンティを入れたオーバーコールつきの計算", () => {
  it("押す人がいちばん小さいとき、後ろのコールレンジが広がる", () => {
    const base = {
      stacks: [6, 14, 16],
      payouts: [50, 30, 20],
      pusherIndex: 0,
      callerIndices: [1, 2],
      blinds: [0, 0.5, 1],
      antes: [0, 0, 0],
      foldWinnerIndex: 2,
      huEquity,
      allHands: ALL_HANDS,
      threeWay,
    };
    const plain = solveOvercallPushFold(base);
    const ko = solveOvercallPushFold({ ...base, bounty: { heads: [10, 10, 10] } });
    expect(comboPct(ko.callRanges[1]!)).toBeGreaterThan(comboPct(plain.callRanges[1]!));
    expect(sum(ko.values)).toBeCloseTo(130, 4);
  });
});
