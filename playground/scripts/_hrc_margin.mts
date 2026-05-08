import { solveHUNash } from "../../core/src/nash.js";
import { huEquity } from "../src/huEquityMatrix.js";
import { ALL_169_HANDS } from "../src/handRanking.js";
import { calculateICM } from "../../core/src/icm.js";

const stacks = [8, 8, 8, 8];
const payouts = [50];
const sb = 0.5;
const bb = 1.0;
const ante = 0.25;
const totalAnte = ante * stacks.length;

const result = solveHUNash({
  stacks, payouts,
  sbIndex: 0, bbIndex: 1,
  sb, bb, ante,
  huEquity, allHands: ALL_169_HANDS,
  maxIterations: 2000,
  convergenceTolerance: 0.0005,
});

const sbPush = result.sbPushRange;
const bbCall = result.bbCallRange;
console.log(`Result: SB push ${sbPush.size}/169 (${(result.sbPushPct*100).toFixed(1)}%), BB call ${bbCall.size}/169 (${(result.bbCallPct*100).toFixed(1)}%)`);

const baseStacks = stacks.map(s => s - ante);
const matched = Math.min(baseStacks[0]!, baseStacks[1]!);

function icmAt(sbS: number, bbS: number) {
  const s = baseStacks.slice();
  s[0] = Math.max(0, sbS); s[1] = Math.max(0, bbS);
  const eq = calculateICM(s, payouts);
  return { sbEq: eq[0]!, bbEq: eq[1]! };
}

const foldICM = icmAt(baseStacks[0]! - sb, baseStacks[1]! + sb + totalAnte);
const stealICM = icmAt(baseStacks[0]! + bb + totalAnte, baseStacks[1]! - bb);
const winICM = icmAt(baseStacks[0]! + matched + totalAnte, baseStacks[1]! - matched);
const loseICM = icmAt(baseStacks[0]! - matched, baseStacks[1]! + matched + totalAnte);

console.log(`\nICM 値: foldSB=${foldICM.sbEq.toFixed(3)}, stealSB=${stealICM.sbEq.toFixed(3)}, winSB=${winICM.sbEq.toFixed(3)}, loseSB=${loseICM.sbEq.toFixed(3)}`);

// SB の border push EV を確認
function sbPushEv(hero: string): number {
  let bbCallW = 0;
  for (const h of bbCall) {
    const c = h.length === 2 ? 6 : (h[2] === "s" ? 4 : 12);
    bbCallW += c;
  }
  const totalCombos = 1326;
  const bbFoldW = totalCombos - bbCallW;
  let evPush = (bbFoldW / totalCombos) * stealICM.sbEq;
  let sdSum = 0;
  for (const v of bbCall) {
    const c = v.length === 2 ? 6 : (v[2] === "s" ? 4 : 12);
    const heq = huEquity(hero, v);
    sdSum += c * (heq * winICM.sbEq + (1 - heq) * loseICM.sbEq);
  }
  evPush += sdSum / totalCombos;
  return evPush;
}

// HRC stated: 80.1% (135 hands fold, 34 hands fold). 当アプリ pushes 141 hands.
// 当アプリで push してる弱いハンド top 10 を margin 順で表示
const sortedSB = [...sbPush].map(h => ({
  hand: h,
  margin: sbPushEv(h) - foldICM.sbEq,
})).sort((a, b) => a.margin - b.margin);
console.log("\n--- 当アプリで push している hands の EV margin (低い順, 上 15 個) ---");
console.log("(margin は evPush - evFold。0 に近いほど境界。マイナスは fold すべきだが微妙な誤差で push 入りしてる候補)");
sortedSB.slice(0, 15).forEach(x => console.log(`  ${x.hand}: margin = ${x.margin.toFixed(3)} EQ`));

// HRC で push しないのにこっちで push している境界の特定
console.log("\n--- HRC 範疇外と思われる弱め push 候補 ---");
const HRC_DEFINITELY_PUSH = new Set(["AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22","AKs","AKo","AQs","AQo","AJs","AJo","ATs","ATo","KQs","KQo","KJs","KJo","KTs","KTo","K9s","K9o","QJs","QTs","JTs"]);
sortedSB.filter(x => !HRC_DEFINITELY_PUSH.has(x.hand) && x.margin < 0.5).slice(0, 10).forEach(x => console.log(`  ${x.hand}: margin = ${x.margin.toFixed(3)} EQ`));
