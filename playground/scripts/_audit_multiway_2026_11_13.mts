/**
 * 2026-11-13 監査: 後ろに複数人いる Nash (solveSpotNash) を、実際にカードを配る
 * シミュレーションで確かめる。ソルバとは別のコード・別の方法 (勝率表を使わず、
 * 3 人ぶんの実カードと 7 枚評価器で勝敗を決める)。
 *
 * 局面: 3 人卓・全員 10BB・勝者総取り (チップがそのまま損得)・SB 0.5 / BB 1・アンティなし。
 *   BTN が押すか降りる → SB がコールか降りる → BB がコールか降りる。
 *
 * 確かめること:
 *   A. ソルバの答えどおりに全員が動くとき、各ハンドで「答えと逆の行動」を取ると
 *      どれだけ得をするか (= ソルバが均衡を外している度合い)。
 *   B. ソルバが扱っていない「SB がコールした後の BB のオーバーコール」が、
 *      実際にはどのくらい起きて、どのくらいの大きさか。
 *
 * 実行: npx tsx playground/scripts/_audit_multiway_2026_11_13.mts
 */
import { evaluate7 } from "./_fastEval.mts";
import { solveSpotNash } from "../src/nashRange.js";
import { comboPctOfRange } from "../src/handRanking.js";

const STACK = 10;
const SB = 0.5;
const BB = 1;
const RANK_CHARS = "23456789TJQKA";

const table = [
  { stack: STACK, position: "BTN" as const },
  { stack: STACK, position: "SB" as const },
  { stack: STACK, position: "BB" as const },
];
const solved = solveSpotNash(table, [100], 0, 2, SB, BB, 0);
const pushRange = solved.pushRange;
const sbCall = solved.others[0]!.range;
const bbCall = solved.callRange;
console.log(
  `ソルバの答え: BTN push ${comboPctOfRange(pushRange).toFixed(1)}% / SB call ${comboPctOfRange(sbCall).toFixed(1)}% / BB call ${comboPctOfRange(bbCall).toFixed(1)}% (収束 ${solved.converged})`,
);

// ---------- 乱数とカード ----------
let seed = 20261113;
function rnd(): number {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const deck = new Int32Array(52);
for (let i = 0; i < 52; i++) deck[i] = i;
/** 先頭 k 枚をランダムに選ぶ (部分 Fisher-Yates)。 */
function deal(k: number): void {
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rnd() * (52 - i));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
}
function label(a: number, b: number): string {
  const ra = a >> 2;
  const rb = b >> 2;
  const hi = Math.max(ra, rb);
  const lo = Math.min(ra, rb);
  if (hi === lo) return RANK_CHARS[hi]! + RANK_CHARS[lo]!;
  return RANK_CHARS[hi]! + RANK_CHARS[lo]! + ((a & 3) === (b & 3) ? "s" : "o");
}
const seven = new Int32Array(7);
function score(h1: number, h2: number): number {
  seven[0] = h1;
  seven[1] = h2;
  for (let i = 0; i < 5; i++) seven[2 + i] = deck[6 + i]!;
  return evaluate7(seven);
}

interface Acc { n: number; sum: number }
const acc = (): Map<string, Acc> => new Map();
function add(m: Map<string, Acc>, key: string, v: number): void {
  const a = m.get(key);
  if (a) { a.n++; a.sum += v; } else m.set(key, { n: 1, sum: v });
}
const combos = (h: string): number => (h.length === 2 ? 6 : h[2] === "s" ? 4 : 12);

/**
 * ハンドごとの「行動 X の損得 − 行動 Y の損得」から、答えと逆を選ぶと得をする分を合計する。
 * 返り値は 1 ハンドあたり (bb)。ばらつきぶん (2σ) を超えたものだけ数える。
 */
function regret(evAct: Map<string, Acc>, evPass: number, range: ReadonlySet<string>, reach: number): { bb: number; worst: string } {
  let total = 0;
  let worst = "";
  let worstGain = 0;
  for (const [hand, a] of evAct) {
    const ev = a.sum / a.n;
    const gain = range.has(hand) ? evPass - ev : ev - evPass; // 逆の行動を取ったときの得
    if (gain > worstGain) { worstGain = gain; worst = `${hand} (+${gain.toFixed(2)}bb, n=${a.n})`; }
    if (gain > 0) total += (combos(hand) / 1326) * gain;
  }
  return { bb: total * reach, worst };
}

// ---------- A-1. BTN: 押す vs 降りる (降りると 0) ----------
const N1 = 6_000_000;
const btnPush = acc();
for (let t = 0; t < N1; t++) {
  deal(11);
  const [b1, b2, s1, s2, g1, g2] = [deck[0]!, deck[1]!, deck[2]!, deck[3]!, deck[4]!, deck[5]!];
  const btn = label(b1, b2);
  let result: number;
  if (sbCall.has(label(s1, s2))) {
    const a = score(b1, b2);
    const b = score(s1, s2);
    result = a > b ? STACK + BB : a < b ? -STACK : BB / 2;
  } else if (bbCall.has(label(g1, g2))) {
    const a = score(b1, b2);
    const b = score(g1, g2);
    result = a > b ? STACK + SB : a < b ? -STACK : SB / 2;
  } else {
    result = SB + BB;
  }
  add(btnPush, btn, result);
}
const rBtn = regret(btnPush, 0, pushRange, 1);

// ---------- A-2. SB: BTN が押してきたとき、コール vs 降りる (降りると −0.5) ----------
const N2 = 3_000_000;
const sbCallEv = acc();
let done = 0;
while (done < N2) {
  deal(4);
  if (!pushRange.has(label(deck[0]!, deck[1]!))) continue;
  // 残りを配る
  for (let i = 4; i < 11; i++) {
    const j = i + Math.floor(rnd() * (52 - i));
    const tmp = deck[i]!; deck[i] = deck[j]!; deck[j] = tmp;
  }
  const a = score(deck[0]!, deck[1]!);
  const b = score(deck[2]!, deck[3]!);
  add(sbCallEv, label(deck[2]!, deck[3]!), b > a ? STACK + BB : b < a ? -STACK : BB / 2);
  done++;
}
const pPush = comboPctOfRange(pushRange) / 100;
const rSb = regret(sbCallEv, -SB, sbCall, pPush);

// ---------- A-3. BB: BTN が押して SB が降りたとき、コール vs 降りる (降りると −1) ----------
const bbCallEv = acc();
done = 0;
while (done < N2) {
  deal(4);
  if (!pushRange.has(label(deck[0]!, deck[1]!)) || sbCall.has(label(deck[2]!, deck[3]!))) continue;
  for (let i = 4; i < 11; i++) {
    const j = i + Math.floor(rnd() * (52 - i));
    const tmp = deck[i]!; deck[i] = deck[j]!; deck[j] = tmp;
  }
  const a = score(deck[0]!, deck[1]!);
  const b = score(deck[4]!, deck[5]!);
  add(bbCallEv, label(deck[4]!, deck[5]!), b > a ? STACK + SB : b < a ? -STACK : SB / 2);
  done++;
}
const pSbFold = 1 - comboPctOfRange(sbCall) / 100;
const rBb = regret(bbCallEv, -BB, bbCall, pPush * pSbFold);

console.log("\n== A. 答えと逆の行動で得をする分 (1ハンドあたり、実カードで計測) ==");
console.log(`BTN: ${rBtn.bb.toFixed(4)}bb  いちばん大きいずれ: ${rBtn.worst || "なし"}`);
console.log(`SB : ${rSb.bb.toFixed(4)}bb  いちばん大きいずれ: ${rSb.worst || "なし"}`);
console.log(`BB : ${rBb.bb.toFixed(4)}bb  いちばん大きいずれ: ${rBb.worst || "なし"}`);

// ---------- B. BB のオーバーコール (BTN push → SB call の後) ----------
const overcallEv = acc();
done = 0;
let tries = 0;
while (done < N2) {
  deal(4);
  tries++;
  if (!pushRange.has(label(deck[0]!, deck[1]!)) || !sbCall.has(label(deck[2]!, deck[3]!))) continue;
  for (let i = 4; i < 11; i++) {
    const j = i + Math.floor(rnd() * (52 - i));
    const tmp = deck[i]!; deck[i] = deck[j]!; deck[j] = tmp;
  }
  const a = score(deck[0]!, deck[1]!);
  const b = score(deck[2]!, deck[3]!);
  const g = score(deck[4]!, deck[5]!);
  const best = Math.max(a, b, g);
  let result: number;
  if (g < best) result = -STACK;
  else {
    const winners = (a === best ? 1 : 0) + (b === best ? 1 : 0) + 1;
    result = (3 * STACK) / winners - STACK;
  }
  add(overcallEv, label(deck[4]!, deck[5]!), result);
  done++;
}
const pSpot = done / tries; // BTN が押して SB がコールする頻度 (実カード)
const overcallHands: string[] = [];
let overcallShare = 0;
let overcallGain = 0;
for (const [hand, a] of overcallEv) {
  const ev = a.sum / a.n;
  if (ev > -BB + 0.3) {
    overcallHands.push(`${hand}(${ev >= 0 ? "+" : ""}${ev.toFixed(1)})`);
    overcallShare += combos(hand) / 1326;
    overcallGain += (combos(hand) / 1326) * (ev + BB);
  }
}
console.log("\n== B. ソルバが扱わない BB のオーバーコール ==");
console.log(`BTN が押して SB がコールする頻度: ${(pSpot * 100).toFixed(1)}% (全ハンドに対して)`);
console.log(`そのとき BB がコールした方が得なハンド: 全体の ${(overcallShare * 100).toFixed(1)}%  ${overcallHands.sort().join(" ")}`);
console.log(`オーバーコールが実際に起きる頻度: ${(pSpot * overcallShare * 100).toFixed(2)}% (約 ${Math.round(1 / (pSpot * overcallShare))} ハンドに 1 回)`);
console.log(`BB が取りこぼしている分: 1ハンドあたり ${(pSpot * overcallGain).toFixed(4)}bb`);
