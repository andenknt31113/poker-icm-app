// ===== 相手レンジに使う「その局面の Nash レンジ」 =====
//
// 相手レンジの「上位 X%」は対ランダム勝率の順なので、小さいペアやスーテッド
// コネクターが入りにくい。実際の押し引きに近い形を1タップで入れられるように、
// いまの局面の2人 push/fold Nash を解いて、相手側のレンジを返す (DOM 非依存)。
import { solveHUNash, type Payouts } from "@poker-icm/core";
import { ALL_169_HANDS, type HandNotation } from "./handRanking.js";
import { huEquity } from "./huEquityMatrix.js";
import { comboCountVsHero } from "./rangeEquity.js";
import { buildPushSpot } from "./pushSpot.js";
import type { Player } from "./appState.js";

type SeatLike = Pick<Player, "stack" | "position">;

const NASH_MAX_ITERATIONS = 500;
const NASH_CONVERGENCE_TOLERANCE = 0.001;

/**
 * 押す側 (pusherIndex) と受ける側 (callerIndex) の Nash を解き、
 * want = "push" なら押す側のレンジ、"call" なら受ける側のレンジを返す。
 * 局面が成り立たない (スタックが blind / ante に足りない等) ときは null。
 */
export function nashRangeForSpot(
  table: readonly SeatLike[],
  payouts: Payouts,
  pusherIndex: number,
  callerIndex: number,
  sb: number,
  bb: number,
  totalAnte: number,
  want: "push" | "call",
): Set<HandNotation> | null {
  if (pusherIndex < 0 || callerIndex < 0 || pusherIndex === callerIndex) return null;
  if (payouts.length === 0 || !(sb > 0) || !(bb > 0) || !(totalAnte >= 0)) return null;
  try {
    const spot = buildPushSpot(table, pusherIndex, callerIndex, sb, bb, totalAnte);
    const result = solveHUNash({
      stacks: spot.stacks,
      payouts,
      sbIndex: pusherIndex,
      bbIndex: callerIndex,
      sb,
      bb,
      ante: 0,
      pusherBlind: spot.pusherBlind,
      callerBlind: spot.callerBlind,
      deadMoney: spot.deadMoney,
      huEquity,
      allHands: ALL_169_HANDS,
      comboWeight: comboCountVsHero,
      maxIterations: NASH_MAX_ITERATIONS,
      convergenceTolerance: NASH_CONVERGENCE_TOLERANCE,
    });
    return new Set(want === "push" ? result.sbPushRange : result.bbCallRange);
  } catch {
    return null;
  }
}
