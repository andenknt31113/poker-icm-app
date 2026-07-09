import type { PracticeProblem } from "../src/practice/types.js";
import type { Role, Position } from "../src/appState.js";

/** テスト用に PracticeProblem の最小雛形を組み立てるヘルパー。 */
export function makeProblem(overrides: Partial<PracticeProblem> = {}): PracticeProblem {
  const base: PracticeProblem = {
    scenarioPlayers: [
      { stack: 20, role: "hero" as Role, position: "BB" as Position },
      { stack: 15, role: "villain" as Role, position: "BTN" as Position },
      { stack: 25, role: "other" as Role, position: "SB" as Position },
    ],
    payouts: [50, 30, 20],
    sb: 0.5,
    bb: 1.0,
    totalAnte: 1.0,
    villainCallRangePct: 30,
    heroHand: "AKo",
    cEV: 0.3,
    dollarEV: 0.35,
    heroEq: 0.5,
    bf: 1.1,
    dollarEVApprox: 0.34,
    bfEquityNow: 10,
    bfEquityWin: 15,
    bfEquityLose: 5,
    equityFold: 10,
    equityWin: 15,
    equityLose: 5,
    stacksFold: [20, 15, 25],
    stacksWin: [30, 5, 25],
    stacksLose: [10, 35, 25],
    callAmount: 8,
    potIfWin: 12,
  };
  return { ...base, ...overrides };
}
