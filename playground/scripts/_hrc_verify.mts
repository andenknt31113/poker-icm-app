import { solveHUNash } from "../../core/src/nash.js";
import { huEquity } from "../src/huEquityMatrix.js";
import { ALL_169_HANDS } from "../src/handRanking.js";

for (const cfg of [
  { iter: 500, tol: 0.005 },
  { iter: 1000, tol: 0.001 },
  { iter: 2000, tol: 0.0005 },
  { iter: 5000, tol: 0.0001 },
]) {
  const t0 = performance.now();
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
    maxIterations: cfg.iter,
    convergenceTolerance: cfg.tol,
  });
  const ms = performance.now() - t0;
  console.log(
    `iter=${cfg.iter}/tol=${cfg.tol}: SB ${(result.sbPushPct*100).toFixed(1)}% / BB ${(result.bbCallPct*100).toFixed(1)}% | converged=${result.converged} in ${result.iterations} iter / ${ms.toFixed(0)} ms`,
  );
}
