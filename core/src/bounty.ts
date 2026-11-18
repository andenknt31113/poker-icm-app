import { calculateICM } from "./icm.js";
import type { Payouts } from "./types.js";

/**
 * バウンティ (KO / PKO) トーナメントの $ の数え方。
 *
 * 各プレイヤーの $ を次の 3 つの和で表す:
 *
 *   1. 賞金の ICM エクイティ (従来どおり)
 *   2. このハンドで相手を飛ばして、その場で受け取るバウンティ
 *   3. まだ卓に残っているバウンティ (全員の首の合計) の取り分 = チップ比率 × 合計
 *
 * 3 は「残っている首は、最後は誰かが受け取る。優勝者は自分の首を自分で受け取り、
 * それ以外の首は飛ばした人が受け取る。飛ばす人がチップ比率で決まるとみなすと、
 * 各自の取り分はチップ比率 × 首の合計になる」という近似。調整用の係数を持たない。
 *
 * 飛ばしたときの扱い:
 *   - KO (progressive = false): 飛ばした人が相手の首を全額その場で受け取る。
 *   - PKO (progressive = true): 半分をその場で受け取り、残り半分は自分の首に乗る
 *     (乗った分は 3 の合計に残り、チップ比率で評価される)。
 */
export interface BountySpec {
  /** 各プレイヤーの首にかかっているバウンティ (payouts と同じ単位)。stacks と同じ並び。 */
  readonly heads: readonly number[];
  /** PKO (半分がその場の現金、半分が飛ばした人の首に乗る) なら true。既定は通常の KO。 */
  readonly progressive?: boolean;
}

/** このハンドで winner が loser のチップを取り切った、という記録。 */
export interface Knockout {
  readonly winner: number;
  readonly loser: number;
}

/** PKO でその場の現金になる割合 (残りは飛ばした人の首に乗る)。 */
export const PROGRESSIVE_CASH_SHARE = 0.5;

function validateBounty(length: number, bounty: BountySpec): void {
  if (bounty.heads.length !== length) {
    throw new Error("Bounty: heads の長さが stacks と一致しません");
  }
  for (const head of bounty.heads) {
    if (!Number.isFinite(head) || head < 0) {
      throw new Error(`Bounty: heads は非負の有限値である必要があります (${head})`);
    }
  }
}

/**
 * 終端スタックでの、バウンティぶんの $ (上の 2 と 3 の和) を全員ぶん返す。
 * knockouts のうち、実際に loser のスタックが 0 になっているものだけを数える。
 */
export function bountyEquities(
  finalStacks: readonly number[],
  bounty: BountySpec,
  knockouts: readonly Knockout[] = [],
): number[] {
  validateBounty(finalStacks.length, bounty);
  const stacks = finalStacks.map((stack) => Math.max(0, stack));
  const heads = bounty.heads.slice();
  const cash = new Array<number>(stacks.length).fill(0);
  const cashShare = bounty.progressive ? PROGRESSIVE_CASH_SHARE : 1;

  for (const { winner, loser } of knockouts) {
    if (winner === loser || stacks[loser]! > 0 || !(stacks[winner]! > 0)) continue;
    const head = heads[loser]!;
    if (!(head > 0)) continue;
    cash[winner]! += head * cashShare;
    heads[winner]! += head * (1 - cashShare);
    heads[loser] = 0;
  }
  // 記録のないまま 0 になっている人 (もともと飛んでいる席など) の首は数えない
  stacks.forEach((stack, i) => {
    if (!(stack > 0)) heads[i] = 0;
  });

  const totalChips = stacks.reduce((a, b) => a + b, 0);
  const totalHeads = heads.reduce((a, b) => a + b, 0);
  return stacks.map((stack, i) => cash[i]! + (totalChips > 0 ? (stack / totalChips) * totalHeads : 0));
}

/**
 * 賞金の ICM にバウンティぶんを足した $。bounty を省略すると ICM と同じ。
 * スタックは 0 未満を 0 に切り上げてから計算する。
 */
export function equitiesWithBounty(
  stacks: readonly number[],
  payouts: Payouts,
  bounty?: BountySpec,
  knockouts: readonly Knockout[] = [],
): number[] {
  const clipped = stacks.map((stack) => Math.max(0, stack));
  const icm = calculateICM(clipped, payouts).slice();
  if (!bounty) return icm;
  const extra = bountyEquities(clipped, bounty, knockouts);
  return icm.map((value, i) => value + extra[i]!);
}
