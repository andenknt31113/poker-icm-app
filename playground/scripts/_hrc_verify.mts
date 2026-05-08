import { solveHUNash } from "../../core/src/nash.js";
import { huEquity } from "../src/huEquityMatrix.js";
import { ALL_169_HANDS } from "../src/handRanking.js";

const result = solveHUNash({
  stacks: [8, 8, 8, 8],
  payouts: [50],
  sbIndex: 0,
  bbIndex: 1,
  sb: 0.5,
  bb: 1.0,
  ante: 0.25,
  huEquity,
  allHands: ALL_169_HANDS,
  maxIterations: 500,
  convergenceTolerance: 0.005,
});

console.log("=== HRC URL ベンチ ===");
console.log("URL: s1=s2=s3=s4=800, p1=50, sb=50, bb=100, ante=25");
console.log("HRC 期待値: SB push 80.1%, BB call 68.0%");
console.log("---");
console.log(`収束: ${result.converged} (${result.iterations} iter)`);
console.log(`SB push: ${result.sbPushRange.size}/169 = ${(result.sbPushPct*100).toFixed(1)}%`);
console.log(`BB call: ${result.bbCallRange.size}/169 = ${(result.bbCallPct*100).toFixed(1)}%`);
