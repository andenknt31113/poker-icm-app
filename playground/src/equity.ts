import { approxEquity } from "./equityHeuristic.js";
import { tableEquityVsRange } from "./equityFromTable.js";
import type { HandNotation } from "./handRanking.js";

/** Monte Carlo 事前計算テーブルを優先し、失敗時はヒューリスティックにフォールバック。 */
export function equity(hand: HandNotation, vsRange: Set<HandNotation>): number {
  const v = tableEquityVsRange(hand, vsRange);
  if (v !== null && Number.isFinite(v)) return v;
  return approxEquity(hand, vsRange);
}
