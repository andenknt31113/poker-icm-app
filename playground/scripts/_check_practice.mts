import { solveHUNash } from "../../core/src/nash.js";
import { huEquity } from "../src/huEquityMatrix.js";
import { ALL_169_HANDS } from "../src/handRanking.js";

// 練習問題のシナリオ:
// BTN 8, CO 24, SB 10 (villain), BB 14 (hero)
// payouts 33/33/33
// SB 0.5, BB 1, アンティ合計 1 → per-player 0.25
const stacks = [8, 24, 10, 14]; // BTN, CO, SB, BB
const heroIdx = 3; // BB
const villainIdx = 2; // SB

const result = solveHUNash({
  stacks,
  payouts: [33, 33, 33],
  sbIndex: villainIdx, // pusher
  bbIndex: heroIdx,    // caller
  sb: 0.5, bb: 1, ante: 0.25, // per-player
  huEquity, allHands: ALL_169_HANDS,
  maxIterations: 2000, convergenceTolerance: 0.0005,
});

console.log("=== 当アプリ Nash (BB が SB の push に call する想定) ===");
console.log(`SB push range: ${result.sbPushRange.size}/169 = ${(result.sbPushPct*100).toFixed(1)}%`);
console.log(`BB call range: ${result.bbCallRange.size}/169 = ${(result.bbCallPct*100).toFixed(1)}%`);
console.log(`収束: ${result.converged} (${result.iterations} iter)`);
