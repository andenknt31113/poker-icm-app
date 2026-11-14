/**
 * 2026-11-13 監査用: 計算コアを独立実装・既知値と突き合わせる (読み取りのみ)。
 * 実行: npx tsx playground/scripts/_audit_2026_11_13.mts
 */
import {
  calculateICM,
  calculateBubbleFactor,
  calculateRequiredEquity,
  calculatePotOdds,
  calculateExactCallEquity,
  solveHUNash,
} from "../../core/src/index.js";
import { huEquity } from "../src/huEquityMatrix.js";
import { ALL_169_HANDS, topRangeByComboPct, comboPctOfRange } from "../src/handRanking.js";
import { comboCountVsHero, matrixEquityVsRange } from "../src/rangeEquity.js";

// ---------- A. ICM: 順列を全部たどる別実装 ----------
function icmBrute(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const eq = new Array<number>(n).fill(0);
  const rec = (alive: number[], prob: number, place: number): void => {
    if (place >= payouts.length || alive.length === 0) return;
    const sum = alive.reduce((a, i) => a + stacks[i]!, 0);
    for (const i of alive) {
      const p = prob * (stacks[i]! / sum);
      if (p === 0) continue;
      eq[i]! += p * payouts[place]!;
      rec(alive.filter((j) => j !== i), p, place + 1);
    }
  };
  rec(stacks.map((_, i) => i), 1, 0);
  return eq;
}

let seed = 12345;
const rnd = (): number => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

console.log("== A. ICM ==");
console.log("50/30/20 stacks x 50/30/20 payouts:", calculateICM([5000, 3000, 2000], [50, 30, 20]).map((x) => x.toFixed(3)).join(" / "), "(手計算 38.393 / 32.750 / 28.857)");
let maxIcmDiff = 0;
let cases = 0;
for (let k = 0; k < 400; k++) {
  const n = 2 + Math.floor(rnd() * 6); // 2..7
  const stacks = Array.from({ length: n }, () => Math.round(1 + rnd() * 60));
  const places = 1 + Math.floor(rnd() * n);
  const payouts = Array.from({ length: places }, () => Math.round(rnd() * 100)).sort((a, b) => b - a);
  const a = calculateICM(stacks, payouts);
  const b = icmBrute(stacks, payouts);
  for (let i = 0; i < n; i++) maxIcmDiff = Math.max(maxIcmDiff, Math.abs(a[i]! - b[i]!));
  cases++;
}
for (const n of [8, 9]) {
  const stacks = Array.from({ length: n }, () => Math.round(1 + rnd() * 60));
  const payouts = [40, 25, 15, 10, 6, 4];
  const a = calculateICM(stacks, payouts);
  const b = icmBrute(stacks, payouts);
  for (let i = 0; i < n; i++) maxIcmDiff = Math.max(maxIcmDiff, Math.abs(a[i]! - b[i]!));
  cases++;
}
console.log(`random ${cases} cases (2..9 人): 最大差 ${maxIcmDiff.toExponential(2)}`);

// ---------- B. BF ----------
console.log("\n== B. BF ==");
const bfInd = (stacks: number[], payouts: number[], h: number, v: number): number => {
  const r = Math.min(stacks[h]!, stacks[v]!);
  const now = icmBrute(stacks, payouts)[h]!;
  const w = stacks.slice(); w[h]! += r; w[v]! -= r;
  const l = stacks.slice(); l[h]! -= r; l[v]! += r;
  return (now - icmBrute(l, payouts)[h]!) / (icmBrute(w, payouts)[h]! - now);
};
const bfCases: [string, number[], number[], number, number][] = [
  ["HU 勝者総取り", [30, 10], [100], 0, 1],
  ["HU 65/35", [30, 10], [65, 35], 0, 1],
  ["4人バブル 均等 50/30/20", [20, 20, 20, 20], [50, 30, 20], 0, 1],
  ["4人バブル 自分20 相手40 (ショート5あり)", [20, 40, 5, 35], [50, 30, 20], 0, 1],
  ["同上 自分40→相手20", [20, 40, 5, 35], [50, 30, 20], 1, 0],
  ["3人 50/30/20 均等", [20, 20, 20], [50, 30, 20], 0, 1],
];
for (const [name, s, p, h, v] of bfCases) {
  const app = calculateBubbleFactor({ stacks: s, payouts: p, heroIndex: h, villainIndex: v, riskChips: Math.min(s[h]!, s[v]!) }).bf;
  console.log(`${name}: app ${app.toFixed(4)} / 独立 ${bfInd(s, p, h, v).toFixed(4)}`);
}

// ---------- C. 分析タブの必要勝率 (BF 線形近似) vs 厳密 ICM ----------
console.log("\n== C. 分析タブの必要勝率 (BF近似) と 厳密ICM の差 ==");
type Pos = "SB" | "BB" | "OTHER";
interface Spot { name: string; stacks: number[]; payouts: number[]; h: number; v: number; hp: Pos; vp: Pos; sbIdx?: number; ante: number }
function compare(s: Spot): { approx: number; exact: number; cev: number; bf: number } {
  const bf = calculateBubbleFactor({ stacks: s.stacks, payouts: s.payouts, heroIndex: s.h, villainIndex: s.v, riskChips: Math.min(s.stacks[s.h]!, s.stacks[s.v]!) }).bf;
  const po = calculatePotOdds({ heroStack: s.stacks[s.h]!, villainStack: s.stacks[s.v]!, heroPosition: s.hp, villainPosition: s.vp, sb: 0.5, bb: 1, ante: s.ante });
  const req = calculateRequiredEquity({ callAmount: po.callAmount, potIfWin: po.potIfWin, bubbleFactor: bf });
  const exact = calculateExactCallEquity({ stacks: s.stacks, payouts: s.payouts, heroIndex: s.h, villainIndex: s.v, heroPosition: s.hp, villainPosition: s.vp, sbPlayerIndex: s.sbIdx, sb: 0.5, bb: 1, ante: s.ante });
  return { approx: req.dollarEV, exact: exact.requiredEquity, cev: req.cEV, bf };
}
const spots: Spot[] = [
  { name: "4人バブル均等20BB BB vs SB push", stacks: [20, 20, 20, 20], payouts: [50, 30, 20], h: 0, v: 1, hp: "BB", vp: "SB", ante: 1 },
  { name: "4人バブル 自分BB12 相手BTN30 ショート4あり", stacks: [12, 30, 4, 25], payouts: [50, 30, 20], h: 0, v: 1, hp: "BB", vp: "OTHER", sbIdx: 2, ante: 1 },
  { name: "4人バブル 自分BB30 相手SB8", stacks: [30, 8, 15, 20], payouts: [50, 30, 20], h: 0, v: 1, hp: "BB", vp: "SB", ante: 1 },
  { name: "4人バブル 自分BB6 相手SB25", stacks: [6, 25, 20, 20], payouts: [50, 30, 20], h: 0, v: 1, hp: "BB", vp: "SB", ante: 1 },
  { name: "6人FT 自分BB15 相手BTN15", stacks: [15, 15, 40, 25, 8, 30], payouts: [35, 23, 16, 11, 8, 7], h: 0, v: 1, hp: "BB", vp: "OTHER", sbIdx: 2, ante: 1 },
  { name: "サテライト 5人中3人通過 自分BB10 相手SB10", stacks: [10, 10, 20, 20, 5], payouts: [1, 1, 1], h: 0, v: 1, hp: "BB", vp: "SB", ante: 1 },
  { name: "3人 自分BB3 相手SB20 (超ショート)", stacks: [3, 20, 20], payouts: [50, 30, 20], h: 0, v: 1, hp: "BB", vp: "SB", ante: 1 },
];
for (const s of spots) {
  const r = compare(s);
  console.log(`${s.name}: cEV ${(r.cev * 100).toFixed(1)}% / BF ${r.bf.toFixed(2)} / 近似 ${(r.approx * 100).toFixed(1)}% / 厳密 ${(r.exact * 100).toFixed(1)}% / 差 ${((r.approx - r.exact) * 100).toFixed(1)}pt`);
}
// ランダム走査
let worst = { d: 0, desc: "" };
let sumAbs = 0, cnt = 0, over1 = 0, over2 = 0;
for (let k = 0; k < 3000; k++) {
  const n = 3 + Math.floor(rnd() * 5);
  const stacks = Array.from({ length: n }, () => Math.round(3 + rnd() * 37));
  const paid = Math.max(2, Math.min(n - 1, 2 + Math.floor(rnd() * 3)));
  const base = [50, 30, 20, 12, 8].slice(0, paid);
  const vSb = rnd() < 0.5;
  const s: Spot = { name: "", stacks, payouts: base, h: 0, v: 1, hp: "BB", vp: vSb ? "SB" : "OTHER", sbIdx: vSb ? undefined : 2, ante: 1 };
  if (stacks[0]! <= 2.5 || stacks[1]! <= 1) continue;
  const r = compare(s);
  const d = r.approx - r.exact;
  sumAbs += Math.abs(d); cnt++;
  if (Math.abs(d) > 0.01) over1++;
  if (Math.abs(d) > 0.02) over2++;
  if (Math.abs(d) > Math.abs(worst.d)) worst = { d, desc: `stacks=${stacks.join(",")} payouts=${base.join("/")} villain=${s.vp} 近似${(r.approx * 100).toFixed(1)} 厳密${(r.exact * 100).toFixed(1)}` };
}
console.log(`random ${cnt} 局面: 平均|差| ${(sumAbs / cnt * 100).toFixed(2)}pt, >1pt ${(over1 / cnt * 100).toFixed(1)}%, >2pt ${(over2 / cnt * 100).toFixed(1)}%, 最大 ${(worst.d * 100).toFixed(1)}pt (${worst.desc})`);

// ---------- D. equity マトリクスの既知値 ----------
console.log("\n== D. ハンド対ハンド / 対ランダム equity (既知値) ==");
const known: [string, string, number][] = [
  ["AA", "KK", 81.9], ["AKs", "QQ", 46.0], ["AKo", "QQ", 43.0], ["AKo", "22", 47.3],
  ["KK", "AKo", 70.0], ["AKo", "AQo", 74.0], ["JTs", "AKo", 40.5], ["AA", "72o", 88.0], ["QQ", "JJ", 81.7],
];
for (const [a, b, k] of known) console.log(`${a} vs ${b}: ${(huEquity(a, b) * 100).toFixed(1)}% (既知 約${k}%)`);
const all = new Set(ALL_169_HANDS);
for (const [h, k] of [["AA", 85.2], ["KK", 82.4], ["AKo", 65.3], ["22", 50.3], ["JTs", 57.5], ["72o", 34.6], ["32o", 31.2]] as [string, number][]) {
  console.log(`${h} vs random: ${(matrixEquityVsRange(h, all) * 100).toFixed(1)}% (既知 ${k}%)`);
}
// 対称性
let maxAsym = 0;
for (const a of ALL_169_HANDS) for (const b of ALL_169_HANDS) if (a !== b) maxAsym = Math.max(maxAsym, Math.abs(huEquity(a, b) + huEquity(b, a) - 1));
console.log(`eq(a,b)+eq(b,a)-1 の最大ずれ: ${(maxAsym * 100).toFixed(2)}pt`);

// ---------- E. Nash (HU chip EV) を公開チャートの水準・独立 best response と比べる ----------
console.log("\n== E. HU push/fold Nash (勝者総取り = chip EV) ==");
function comboPct(freq: ReadonlyMap<string, number>): number {
  let num = 0, den = 0;
  for (const h of ALL_169_HANDS) {
    const c = h.length === 2 ? 6 : h[2] === "s" ? 4 : 12;
    num += c * (freq.get(h) ?? 0); den += c;
  }
  return (num / den) * 100;
}
for (const eff of [5, 8, 10, 15, 20]) {
  const r = solveHUNash({ stacks: [eff, eff], payouts: [1], sbIndex: 0, bbIndex: 1, sb: 0.5, bb: 1, ante: 0, huEquity, allHands: ALL_169_HANDS, comboWeight: comboCountVsHero });
  // 独立 best response (chip EV, 自前でチップを数える)
  const push = r.sbPushFreq, call = r.bbCallFreq;
  let sbGain = 0, bbGain = 0, tot = 0;
  for (const h of ALL_169_HANDS) {
    const prior = h.length === 2 ? 6 : h[2] === "s" ? 4 : 12;
    tot += prior;
    // SB: fold = -0.5, push
    let T = 0, ev = 0;
    for (const v of ALL_169_HANDS) {
      const w = comboCountVsHero(h, v); T += w;
      const c = call.get(v) ?? 0;
      const e = huEquity(h, v);
      ev += w * ((1 - c) * 1 + c * (e * eff + (1 - e) * -eff));
    }
    ev /= T;
    const cur = (push.get(h) ?? 0) * ev + (1 - (push.get(h) ?? 0)) * -0.5;
    sbGain += prior * (Math.max(ev, -0.5) - cur);
    // BB: fold = -1, call
    let P = 0, evc = 0, T2 = 0;
    for (const s of ALL_169_HANDS) {
      const w = comboCountVsHero(h, s); T2 += w;
      const pp = push.get(s) ?? 0;
      const e = huEquity(h, s);
      P += w * pp; evc += w * pp * (e * eff + (1 - e) * -eff);
    }
    const evCall = P > 0 ? evc / P : -1;
    const curB = (call.get(h) ?? 0) * evCall + (1 - (call.get(h) ?? 0)) * -1;
    bbGain += prior * (P / T2) * (Math.max(evCall, -1) - curB);
  }
  console.log(`${eff}BB: push ${comboPct(push).toFixed(1)}% / call ${comboPct(call).toFixed(1)}% (収束 ${r.converged}, iter ${r.iterations}) 独立ε: SB ${(sbGain / tot).toFixed(4)}bb BB ${(bbGain / tot).toFixed(4)}bb`);
}
console.log("公開チャート (HU Nash, アンティなし) の目安: 10BB で push 約58% / call 約37%");

// ---------- F. 上位X% レンジの中身 ----------
console.log("\n== F. 上位X% (対ランダム equity 順) の中身 ==");
for (const pct of [10, 20, 40]) {
  const r = topRangeByComboPct(pct);
  console.log(`上位${pct}% (${comboPctOfRange(r).toFixed(1)}%): 76s=${r.has("76s")} 54s=${r.has("54s")} T9s=${r.has("T9s")} K2o=${r.has("K2o")} Q5o=${r.has("Q5o")} A2o=${r.has("A2o")} 22=${r.has("22")}`);
}
