/**
 * Nash ソルバの動作確認スクリプト。
 * 実際の HU matrix を使って push/fold equilibrium を解き、リファレンス値と比較する。
 *
 * 使い方:
 *   npx tsx scripts/_nash_verify.mts
 */
import { solveHUNash } from "@poker-icm/core";
import { ALL_169_HANDS } from "../src/handRanking.js";
import { huEquity, hasHUMatrix, HU_MATRIX_META } from "../src/huEquityMatrix.js";

if (!hasHUMatrix()) {
  console.error("HU matrix が空です");
  process.exit(1);
}
console.log("HU matrix meta:", HU_MATRIX_META);

const cases = [
  { label: "HU eff 10BB, no ante, WTA",   stacks: [10, 10] as const, sb: 0.5, bb: 1, ante: 0, payouts: [100] as const },
  { label: "HU eff 10BB, ante 0.1, WTA",  stacks: [10, 10] as const, sb: 0.5, bb: 1, ante: 0.1, payouts: [100] as const },
  { label: "HU eff 5BB, no ante, WTA",    stacks: [5, 5] as const,   sb: 0.5, bb: 1, ante: 0, payouts: [100] as const },
  { label: "HU eff 15BB, no ante, WTA",   stacks: [15, 15] as const, sb: 0.5, bb: 1, ante: 0, payouts: [100] as const },
  { label: "HU eff 20BB, no ante, WTA",   stacks: [20, 20] as const, sb: 0.5, bb: 1, ante: 0, payouts: [100] as const },
];

for (const c of cases) {
  const t0 = performance.now();
  const r = solveHUNash({
    stacks: c.stacks as unknown as number[],
    payouts: c.payouts as unknown as number[],
    sbIndex: 0,
    bbIndex: 1,
    sb: c.sb,
    bb: c.bb,
    ante: c.ante,
    huEquity,
    allHands: ALL_169_HANDS,
    maxIterations: 200,
  });
  const ms = performance.now() - t0;
  console.log(`\n=== ${c.label} ===`);
  console.log(`  iterations: ${r.iterations}, converged: ${r.converged}, time: ${ms.toFixed(1)}ms`);
  console.log(`  SB push range: ${r.sbPushRange.size} hands (${(r.sbPushPct * 100).toFixed(1)}%)`);
  console.log(`  BB call range: ${r.bbCallRange.size} hands (${(r.bbCallPct * 100).toFixed(1)}%)`);
  // 最弱・最強サンプル表示
  const sbSample = Array.from(r.sbPushRange).slice(0, 8).join(", ");
  const bbSample = Array.from(r.bbCallRange).slice(0, 12).join(", ");
  console.log(`  SB push (head): ${sbSample}...`);
  console.log(`  BB call: ${bbSample}`);
}

// バブル比較
const huResult = solveHUNash({
  stacks: [10, 10],
  payouts: [100],
  sbIndex: 0,
  bbIndex: 1,
  sb: 0.5,
  bb: 1,
  huEquity,
  allHands: ALL_169_HANDS,
  maxIterations: 200,
});

const bubbleResult = solveHUNash({
  stacks: [10, 10, 5],
  payouts: [50, 30, 20],
  sbIndex: 0,
  bbIndex: 1,
  sb: 0.5,
  bb: 1,
  huEquity,
  allHands: ALL_169_HANDS,
  maxIterations: 200,
});

console.log("\n=== ICM 圧の比較 (HU vs 3-handed bubble) ===");
console.log(`  HU [10,10] WTA: SB push ${(huResult.sbPushPct*100).toFixed(1)}%, BB call ${(huResult.bbCallPct*100).toFixed(1)}%`);
console.log(`  3-handed [10,10,5] [50,30,20], SB=P0(10), BB=P1(10): SB push ${(bubbleResult.sbPushPct*100).toFixed(1)}%, BB call ${(bubbleResult.bbCallPct*100).toFixed(1)}%`);
