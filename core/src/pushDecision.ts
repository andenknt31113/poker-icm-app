import { calculateICM } from "./icm.js";
import type { Payouts, Stacks } from "./types.js";

/**
 * 厳密 ICM による push/fold 判定 (hero = SB が pusher、villain = BB が caller)。
 *
 * `calculateExactCallEquity` (callDecision.ts) が「call するかどうか」を判定するのに対し、
 * こちらは「hero が自分から all-in するかどうか」を判定する。
 * villain のコール確率・コールされた際の hero equity は呼び出し側 (playground) が
 * レンジ→数値化 (equity(hand, topRange(pct)) 等) して渡す設計とし、本関数はそれらを
 * 受け取って ICM 上の $EV を厳密に解くところだけを担当する。
 *
 * 前提 (BB ante 構造・hero=SB / villain=BB 固定):
 *   - BB (villain) が ante を全額負担する。SB (hero) は ante を払わない。
 *   - hero/villain 以外の第三者 (すでに fold 済み想定) のスタックは一切変化しない。
 *
 * 終端は4つ:
 *   1. fold   : hero が push せず降りる (SB を失う)
 *   2. steal  : hero が push → villain が fold (何もコンテストせず pot を得る)
 *   3. win    : hero が push → villain が call → hero が勝つ
 *   4. lose   : hero が push → villain が call → hero が負ける
 */
export interface PushDecisionInput {
  /** ハンド開始時点の全員のスタック。 */
  readonly stacks: Stacks;
  readonly payouts: Payouts;
  /** hero (SB / pusher) の index。 */
  readonly heroIndex: number;
  /** villain (BB / caller) の index。 */
  readonly villainIndex: number;
  /** SB blind 額。 */
  readonly sb: number;
  /** BB blind 額。 */
  readonly bb: number;
  /** ante 合計 (BB ante 構造のため villain が全額負担)。 */
  readonly ante: number;
  /** villain がコールしてくる確率 (0..1)。レンジ→数値化は呼び出し側で行う。 */
  readonly pCall: number;
  /** villain がコールしてきた場合の hero equity (0..1)。 */
  readonly eqVsCallRange: number;
}

export interface PushDecisionResult {
  /** push した場合の hero $EV。 */
  readonly evPush: number;
  /** push せず fold した場合の hero $EV (= equityFold)。 */
  readonly evFold: number;
  readonly equityFold: number;
  readonly equitySteal: number;
  readonly equityWin: number;
  readonly equityLose: number;
  readonly stacksFold: Stacks;
  readonly stacksSteal: Stacks;
  readonly stacksWin: Stacks;
  readonly stacksLose: Stacks;
  /** evPush >= evFold なら true (push が正解)。 */
  readonly shouldPush: boolean;
}

export function evaluatePushDecision(
  input: PushDecisionInput,
): PushDecisionResult {
  const {
    stacks,
    payouts,
    heroIndex,
    villainIndex,
    sb,
    bb,
    ante,
    pCall,
    eqVsCallRange,
  } = input;

  if (heroIndex === villainIndex) {
    throw new Error("PushDecision: hero と villain が同じ index です");
  }
  if (heroIndex < 0 || heroIndex >= stacks.length) {
    throw new Error(`PushDecision: heroIndex が範囲外です: ${heroIndex}`);
  }
  if (villainIndex < 0 || villainIndex >= stacks.length) {
    throw new Error(`PushDecision: villainIndex が範囲外です: ${villainIndex}`);
  }
  if (sb < 0 || bb < 0 || ante < 0) {
    throw new Error("PushDecision: blind/ante は非負である必要があります");
  }
  if (pCall < 0 || pCall > 1) {
    throw new Error("PushDecision: pCall は 0..1 の範囲である必要があります");
  }
  if (eqVsCallRange < 0 || eqVsCallRange > 1) {
    throw new Error(
      "PushDecision: eqVsCallRange は 0..1 の範囲である必要があります",
    );
  }

  const heroStack = stacks[heroIndex]!;
  const villainStack = stacks[villainIndex]!;

  // SB (hero) は ante を払わない。BB (villain) が ante 全額を負担する。
  const heroLive = heroStack;
  const villainLive = villainStack - ante;
  const matched = Math.min(heroLive, villainLive);
  const pot = 2 * matched + ante;

  // fold: hero が push せず降りる → SB (sb) を失い、villain がそれを得る (第三者不変)
  const stacksFold = stacks.slice();
  stacksFold[heroIndex] = heroStack - sb;
  stacksFold[villainIndex] = villainStack + sb;

  // steal: hero が push → villain が fold (villain の blind + ante を丸取り)
  const stacksSteal = stacks.slice();
  stacksSteal[heroIndex] = heroStack + bb + ante;
  stacksSteal[villainIndex] = villainStack - ante - bb;

  // win: hero が push → villain が call → hero が勝つ
  const stacksWin = stacks.slice();
  stacksWin[heroIndex] = heroLive - matched + pot;
  stacksWin[villainIndex] = villainLive - matched;

  // lose: hero が push → villain が call → hero が負ける
  const stacksLose = stacks.slice();
  stacksLose[heroIndex] = heroLive - matched;
  stacksLose[villainIndex] = villainLive - matched + pot;

  const equityFold = calculateICM(stacksFold, payouts)[heroIndex]!;
  const equitySteal = calculateICM(stacksSteal, payouts)[heroIndex]!;
  const equityWin = calculateICM(stacksWin, payouts)[heroIndex]!;
  const equityLose = calculateICM(stacksLose, payouts)[heroIndex]!;

  const evFold = equityFold;
  const evPush =
    (1 - pCall) * equitySteal +
    pCall * (eqVsCallRange * equityWin + (1 - eqVsCallRange) * equityLose);

  return {
    evPush,
    evFold,
    equityFold,
    equitySteal,
    equityWin,
    equityLose,
    stacksFold,
    stacksSteal,
    stacksWin,
    stacksLose,
    shouldPush: evPush >= evFold,
  };
}
