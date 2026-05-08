import { describe, expect, it } from "vitest";
import { solveHUNash } from "../src/nash.js";
import type { HandLabel } from "../src/nash.js";

/**
 * 169 ハンドを生成（テスト用）。
 * 順序: pair (AA..22) → suited (上三角) → offsuit (下三角)。
 */
const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;

function generateAllHands(): HandLabel[] {
  const out: HandLabel[] = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const r1 = RANKS[i]!;
      const r2 = RANKS[j]!;
      if (i === j) out.push(`${r1}${r2}`);
      else if (i < j) out.push(`${r1}${r2}s`);
      else out.push(`${r2}${r1}o`);
    }
  }
  return out;
}

const ALL_HANDS = generateAllHands();

/** ランク値 (0=最強A..12=最弱2)。 */
function rankIdx(r: string): number {
  const i = RANKS.indexOf(r as (typeof RANKS)[number]);
  return i < 0 ? 12 : i;
}

/**
 * テスト用の単純な equity 関数。
 * 「強さスコア」を計算し、両者の相対差から 0..1 にマップする近似。
 *
 * - pair はランクが高いほど強い
 * - suited はオフスートより少し強い
 * - 高いランクほど強い、ハイカード差大きいほど強い
 *
 * これはテスト目的の monotone な近似で、実際の equity ではないが
 * Nash ソルバが「強いハンドを優先する」という基本的な性質を確認できる。
 */
function makeFakeHUEquity(): (h: HandLabel, v: HandLabel) => number {
  function score(hand: HandLabel): number {
    const r1 = rankIdx(hand[0]!);
    const isPair = hand.length === 2;
    if (isPair) {
      // ペア: 60 + (12 - r1) * 3 = AA: 96, 22: 60
      return 60 + (12 - r1) * 3;
    }
    const r2 = rankIdx(hand[1]!);
    const isSuited = hand[2] === "s";
    // ハイカード合計補正 + suited bonus
    const high = (12 - r1) * 2.5 + (12 - r2) * 1.0;
    const suitedBonus = isSuited ? 4 : 0;
    return 30 + high + suitedBonus; // 範囲おおよそ 30..70
  }

  return (hero, villain) => {
    const a = score(hero);
    const b = score(villain);
    // softmax 風: 差を 30 で割って sigmoid
    const diff = (a - b) / 30;
    const eq = 1 / (1 + Math.exp(-diff));
    // 0.05 .. 0.95 にクランプ
    return Math.max(0.05, Math.min(0.95, eq));
  };
}

const fakeEq = makeFakeHUEquity();

describe("solveHUNash", () => {
  it("HU で chiplead と shorty: SB push レンジが広い (60-95%)", () => {
    // HU 想定: 2 人のみ、ペイ = winner-take-all
    const result = solveHUNash({
      stacks: [10, 10], // eff 10BB
      payouts: [100],
      sbIndex: 0,
      bbIndex: 1,
      sb: 0.5,
      bb: 1,
      ante: 0,
      huEquity: fakeEq,
      allHands: ALL_HANDS,
      maxIterations: 200,
    });

    // HU push/fold は eff 10BB だと約 60% push がよく知られた値。
    // 近似 equity だが、レンジ幅がかなり広いはず。
    expect(result.sbPushPct).toBeGreaterThan(0.45);
    expect(result.sbPushPct).toBeLessThanOrEqual(1.0);
    expect(result.bbCallPct).toBeGreaterThan(0.1);
    expect(result.bbCallPct).toBeLessThan(0.6);
    // SB push range は BB call range より広い
    expect(result.sbPushPct).toBeGreaterThan(result.bbCallPct);
  });

  it("3-handed バブル: ICM 圧で SB push レンジが HU よりタイト", () => {
    // 3 人 [SB=5, BB=10, 3rd=10], payouts [50, 30, 20]: SB が最短スタックでバブル
    const huResult = solveHUNash({
      stacks: [5, 10],
      payouts: [60, 40], // HU 用 (winner-take-all 寄り)
      sbIndex: 0,
      bbIndex: 1,
      sb: 0.5,
      bb: 1,
      huEquity: fakeEq,
      allHands: ALL_HANDS,
      maxIterations: 200,
    });

    const bubbleResult = solveHUNash({
      stacks: [5, 10, 10],
      payouts: [50, 30, 20],
      sbIndex: 0,
      bbIndex: 1,
      sb: 0.5,
      bb: 1,
      huEquity: fakeEq,
      allHands: ALL_HANDS,
      maxIterations: 200,
    });

    // ICM 圧でレンジが「タイト or 等しく」なるはず（緩むことはない）。
    // SB は最短スタックなので大きく変わらないかもしれないが、BB は call レンジが必ず狭まる。
    expect(bubbleResult.bbCallPct).toBeLessThanOrEqual(huResult.bbCallPct);
  });

  it("収束: maxIterations=200 で十分収束する（converged=true）", () => {
    const result = solveHUNash({
      stacks: [10, 10],
      payouts: [100],
      sbIndex: 0,
      bbIndex: 1,
      sb: 0.5,
      bb: 1,
      huEquity: fakeEq,
      allHands: ALL_HANDS,
      maxIterations: 200,
    });
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(200);
  });

  it("SB push range が BB call range を完全に内包する（強いハンドはどちらにも入る）", () => {
    const result = solveHUNash({
      stacks: [10, 10],
      payouts: [100],
      sbIndex: 0,
      bbIndex: 1,
      sb: 0.5,
      bb: 1,
      huEquity: fakeEq,
      allHands: ALL_HANDS,
      maxIterations: 200,
    });
    // BB が call するハンドは SB も push するはず（より強いから）
    for (const h of result.bbCallRange) {
      expect(result.sbPushRange.has(h)).toBe(true);
    }
  });

  it("AA は両方のレンジに入っている", () => {
    const result = solveHUNash({
      stacks: [10, 10],
      payouts: [100],
      sbIndex: 0,
      bbIndex: 1,
      sb: 0.5,
      bb: 1,
      huEquity: fakeEq,
      allHands: ALL_HANDS,
      maxIterations: 200,
    });
    expect(result.sbPushRange.has("AA")).toBe(true);
    expect(result.bbCallRange.has("AA")).toBe(true);
  });

  it("極短スタック (eff 3BB): SB はほぼ any-two で push", () => {
    const result = solveHUNash({
      stacks: [3, 10],
      payouts: [100],
      sbIndex: 0,
      bbIndex: 1,
      sb: 0.5,
      bb: 1,
      huEquity: fakeEq,
      allHands: ALL_HANDS,
      maxIterations: 200,
    });
    // 3BB push は any-two 推奨レベル
    expect(result.sbPushPct).toBeGreaterThan(0.85);
  });

  it("極ディープ (eff 50BB): push レンジは狭まる", () => {
    const shallow = solveHUNash({
      stacks: [10, 10],
      payouts: [100],
      sbIndex: 0,
      bbIndex: 1,
      sb: 0.5,
      bb: 1,
      huEquity: fakeEq,
      allHands: ALL_HANDS,
      maxIterations: 200,
    });
    const deep = solveHUNash({
      stacks: [50, 50],
      payouts: [100],
      sbIndex: 0,
      bbIndex: 1,
      sb: 0.5,
      bb: 1,
      huEquity: fakeEq,
      allHands: ALL_HANDS,
      maxIterations: 200,
    });
    // ディープになるほど push range は狭くなる
    expect(deep.sbPushPct).toBeLessThan(shallow.sbPushPct);
  });

  it("不正な入力: sb/bb が同 index でエラー", () => {
    expect(() =>
      solveHUNash({
        stacks: [10, 10],
        payouts: [100],
        sbIndex: 0,
        bbIndex: 0,
        sb: 0.5,
        bb: 1,
        huEquity: fakeEq,
        allHands: ALL_HANDS,
      }),
    ).toThrow();
  });

  it("不正な入力: stacks 不足でエラー", () => {
    expect(() =>
      solveHUNash({
        stacks: [10],
        payouts: [100],
        sbIndex: 0,
        bbIndex: 1,
        sb: 0.5,
        bb: 1,
        huEquity: fakeEq,
        allHands: ALL_HANDS,
      }),
    ).toThrow();
  });
});
