import { describe, it, expect } from "vitest";
import { evaluate7, cardCode, RANK_CHARS, SUIT_CHARS } from "../scripts/_fastEval.mts";
// @ts-expect-error - pokersolver has no types
import pokersolver from "pokersolver";

const Hand = (pokersolver as { Hand: { solve: (c: string[]) => unknown; winners: (h: unknown[]) => unknown[] } }).Hand;

/**
 * 高速整数評価器 `evaluate7` が pokersolver と勝敗判定で完全一致することを
 * 確認する回帰テスト。equity 事前計算テーブルはこの評価器で生成されるため、
 * ここがズレると全 equity 値が汚染される。
 */
describe("evaluate7 (高速7枚評価器) は pokersolver と勝敗一致", () => {
  it("ランダム 8000 ディールで hero/villain の勝敗が一致する", () => {
    const deck: string[] = [];
    for (const r of RANK_CHARS) for (const s of SUIT_CHARS) deck.push(r + s);

    // 決定的な擬似乱数（テストの再現性のため）
    let seed = 123456789 >>> 0;
    const rand = (): number => {
      seed = (Math.imul(seed ^ (seed >>> 15), seed | 1) + 0x6d2b79f5) >>> 0;
      return seed / 4294967296;
    };
    const shuffle = (a: string[]): void => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
    };

    let disagreements = 0;
    for (let n = 0; n < 8000; n++) {
      shuffle(deck);
      const hero = [deck[0]!, deck[1]!];
      const vil = [deck[2]!, deck[3]!];
      const board = deck.slice(4, 9);
      const hf = evaluate7([...hero, ...board].map(cardCode));
      const vf = evaluate7([...vil, ...board].map(cardCode));
      const fast = hf > vf ? 1 : hf < vf ? -1 : 0;
      const hs = Hand.solve([...hero, ...board]);
      const vs = Hand.solve([...vil, ...board]);
      const w = Hand.winners([hs, vs]);
      const ps = w.length === 2 ? 0 : w[0] === hs ? 1 : -1;
      if (fast !== ps) disagreements++;
    }
    expect(disagreements).toBe(0);
  });

  it("既知の役の強弱を正しく順序付ける", () => {
    const score = (cards: string[]): number => evaluate7(cards.map(cardCode));
    const royalFlush = score(["As", "Ks", "Qs", "Js", "Ts", "2h", "3d"]);
    const quads = score(["Ac", "Ad", "Ah", "As", "Ks", "2h", "3d"]);
    const fullHouse = score(["Ac", "Ad", "Ah", "Ks", "Kd", "2h", "3d"]);
    const flush = score(["As", "Js", "9s", "5s", "2s", "Kd", "3d"]);
    const straight = score(["9c", "8d", "7h", "6s", "5s", "Ad", "Kd"]);
    const trips = score(["Ac", "Ad", "Ah", "Ks", "Qd", "2h", "3d"]);
    const twoPair = score(["Ac", "Ad", "Ks", "Kd", "Qd", "2h", "3d"]);
    const pair = score(["Ac", "Ad", "Ks", "Qd", "Jd", "2h", "3d"]);
    const highCard = score(["Ac", "Kd", "Qs", "Jd", "9d", "2h", "3d"]);
    expect(royalFlush).toBeGreaterThan(quads);
    expect(quads).toBeGreaterThan(fullHouse);
    expect(fullHouse).toBeGreaterThan(flush);
    expect(flush).toBeGreaterThan(straight);
    expect(straight).toBeGreaterThan(trips);
    expect(trips).toBeGreaterThan(twoPair);
    expect(twoPair).toBeGreaterThan(pair);
    expect(pair).toBeGreaterThan(highCard);
  });

  it("ホイールストレート (A-2-3-4-5) を認識する", () => {
    const wheel = evaluate7(["Ad", "2c", "3h", "4s", "5d", "Kh", "Qc"].map(cardCode));
    const sixHigh = evaluate7(["6d", "2c", "3h", "4s", "5d", "Kh", "Qc"].map(cardCode));
    const pairAces = evaluate7(["Ad", "Ac", "9h", "7s", "5d", "Kh", "Qc"].map(cardCode));
    expect(sixHigh).toBeGreaterThan(wheel); // 6-high straight > wheel
    expect(wheel).toBeGreaterThan(pairAces); // どのストレートも1ペアより強い
  });
});
