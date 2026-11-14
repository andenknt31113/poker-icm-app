/**
 * オーバーコールつきの push/fold ナッシュ均衡ソルバ（ICM 反映）。
 *
 * multiwayNash.ts のモデルに「2 人目のコール」を足したもの:
 *   - pusher が all-in → 後ろの人が順に call / fold
 *   - 誰か (caller) が call したあと、さらに後ろの人が 1 人だけ overcall できる
 *     (3 人の all-in)。4 人目以降のコールは扱わない。
 *
 * 3 人の勝率は呼び出し側が渡す表 (threeWay) を使う。2 人対戦の勝率から近似すると
 * 誤差が大きい (平均 6pt) ため、表は別途モンテカルロで作ったものを前提にする。
 *
 * 解き方 (外側のくり返し):
 *   1. いまの overcall レンジを前提に、pusher と各 caller の「2 人対決の損得表」を作る
 *      (overcall されたときの 3 人対決ぶんを混ぜ込む)。
 *   2. その損得表で pusher と caller の均衡を Fictitious Play で解く。
 *   3. できたレンジに対して、各 overcaller の最適なレンジを計算し直す。
 *   これを数回くり返す。
 *
 * 近似:
 *   - 3 人のカードの重複は、2 人ずつの重複の掛け合わせで見積もる。
 *   - スタックが違うときのサイドポットは、勝者の確率 (表) と 2 人対戦の勝率から
 *     2 着を見積もる。
 *   - コールせず降りた人の $ は、overcall を含まない終端で評価する。
 */

import { calculateICM } from "./icm.js";
import { buildMultiwayTerminals, computeNodeValues, type MultiwayPushFoldInput } from "./multiwayNash.js";
import type { ComboWeightFn, HandLabel } from "./nash.js";

/**
 * 3 人同時 all-in の勝率。a / b / c は allHands の index。
 * out[0..2] に a / b / c が勝つ確率を書き、3 人が同時に持てない組なら false を返す。
 */
export type ThreeWayEquityFn = (a: number, b: number, c: number, out: Float64Array) => boolean;

export interface OvercallPushFoldInput extends MultiwayPushFoldInput {
  readonly threeWay: ThreeWayEquityFn;
  /** 外側のくり返し回数 (既定 5)。 */
  readonly outerIterations?: number;
}

export interface OvercallPushFoldResult {
  readonly pushRange: ReadonlySet<HandLabel>;
  /** callerIndices と同じ並び。 */
  readonly callRanges: readonly ReadonlySet<HandLabel>[];
  /**
   * overcallRanges[k][m] = callers[k] が call したあと、callers[k + 1 + m] が overcall するレンジ。
   * (それより前の人は全員 fold している前提)
   */
  readonly overcallRanges: readonly (readonly ReadonlySet<HandLabel>[])[];
  readonly converged: boolean;
  readonly exploitability: number;
  /** この局面での全員の $ の期待値 (1 つ前に動く人の foldEquities に使う)。 */
  readonly values: readonly number[];
}

const DEFAULT_MAX_ITER = 300;
const DEFAULT_TOLERANCE = 0.001;
const DEFAULT_OUTER = 5;
/** レンジの「入っている」とみなす下限 (損得表を作る対象を絞るため)。 */
const SUPPORT_EPS = 0.02;

function comboCount(hand: HandLabel): number {
  if (hand.length === 2) return 6;
  return hand[2] === "s" ? 4 : 12;
}

/** 3 人 (役割 0 = pusher, 1 = caller, 2 = overcaller) の着順 6 通り。 */
const PERMS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

/** PERM_INDEX[1 着][2 着] = PERMS の index。 */
const PERM_INDEX: readonly (readonly number[])[] = [
  [-1, 0, 1],
  [2, -1, 3],
  [4, 5, -1],
];

export function solveOvercallPushFold(input: OvercallPushFoldInput): OvercallPushFoldResult {
  const {
    stacks,
    payouts,
    pusherIndex: P,
    callerIndices,
    blinds,
    antes,
    huEquity,
    allHands,
    comboWeight,
    threeWay,
    maxIterations = DEFAULT_MAX_ITER,
    convergenceTolerance = DEFAULT_TOLERANCE,
    outerIterations = DEFAULT_OUTER,
    bigBlind = 1,
  } = input;

  // 入力の検証と 2 人対決の終端は multiwayNash と共通
  const terminals = buildMultiwayTerminals(input);
  if (callerIndices.length === 0) throw new Error("OvercallNash: callerIndices が空");
  const n = allHands.length;
  const K = callerIndices.length;

  // ----- コンボ重みと equity -----
  const combo = allHands.map(comboCount);
  const totalCombos = combo.reduce((a, b) => a + b, 0);
  const prior = combo.map((c) => c / totalCombos);
  const wfn: ComboWeightFn = comboWeight ?? ((_h, v) => comboCount(v));
  const W = new Float64Array(n * n);
  const rowTotal = new Float64Array(n);
  const E = new Float64Array(n * n);
  for (let a = 0; a < n; a++) {
    let t = 0;
    for (let b = 0; b < n; b++) {
      const w = wfn(allHands[a]!, allHands[b]!);
      W[a * n + b] = w;
      t += w;
      E[a * n + b] = huEquity(allHands[a]!, allHands[b]!);
    }
    rowTotal[a] = t;
  }
  // 3 人目の重み: pusher が h、caller が v のとき、3 人目が c を持つ組合せ数の見積もり
  //   w3(c | h, v) = W[h][c] * W[v][c] / combo(c)
  // その合計 D[h][v] (overcall する確率の分母)
  const D = new Float64Array(n * n);
  for (let h = 0; h < n; h++) {
    for (let v = 0; v < n; v++) {
      let d = 0;
      for (let c = 0; c < n; c++) d += (W[h * n + c]! * W[v * n + c]!) / combo[c]!;
      D[h * n + v] = d;
    }
  }

  // ----- 3 人対決の終端 (サイドポット込み) -----
  const live = stacks.map((s, i) => s - antes[i]!);
  const posted = live.map((s, i) => s - blinds[i]!);
  const anteTotal = antes.reduce((a, b) => a + b, 0);
  const blindTotal = blinds.reduce((a, b) => a + b, 0);
  /**
   * 終端スタックから全員の $ を出す。3 人対決では 2 人が同時に飛ぶことがあり、その場合は
   * トーナメントのルールどおり「ハンド開始時のスタックが多い方が上の順位」になる
   * (同額なら賞金を等分)。calculateICM は 0 チップどうしを等分で扱うため、ここで直す。
   */
  function icmWithBustOrder(final: readonly number[], involved: readonly number[]): number[] {
    const clipped = final.map((v) => Math.max(0, v));
    const icm = calculateICM(clipped, payouts).slice();
    const busted = involved.filter((i) => clipped[i]! <= 0);
    if (busted.length < 2) return icm;
    const alive = clipped.filter((v) => v > 0).length;
    // 開始スタックの多い順に、残っている人の次の順位から割り当てる
    const ordered = busted.slice().sort((a, b) => stacks[b]! - stacks[a]!);
    let place = alive;
    for (let i = 0; i < ordered.length; ) {
      let j = i;
      while (j + 1 < ordered.length && stacks[ordered[j + 1]!] === stacks[ordered[i]!]) j++;
      let sum = 0;
      for (let q = i; q <= j; q++) sum += payouts[place + (q - i)] ?? 0;
      for (let q = i; q <= j; q++) icm[ordered[q]!] = sum / (j - i + 1);
      place += j - i + 1;
      i = j + 1;
    }
    return icm;
  }

  /** T3[k][m][perm] = [pusher の $, caller の $, overcaller の $] */
  const T3: number[][][][] = [];
  for (let k = 0; k < K; k++) {
    T3.push([]);
    for (let j = k + 1; j < K; j++) {
      const ids = [P, callerIndices[k]!, callerIndices[j]!];
      const lives = ids.map((i) => live[i]!);
      const sorted = lives.slice().sort((a, b) => a - b);
      const small = sorted[0]!;
      const mid = sorted[1]!;
      const dead = blindTotal - ids.reduce((a, i) => a + blinds[i]!, 0) + anteTotal;
      const mainPot = 3 * small + dead;
      const sidePot = 2 * (mid - small);
      // サイドポットに参加できるのは、いちばん小さい人以外の 2 人 (同額なら 0 なので誰でもよい)
      const smallestRole = lives.indexOf(small);
      const perRole: number[][] = [];
      for (const perm of PERMS) {
        const final = posted.slice();
        ids.forEach((i, role) => {
          final[i] = lives[role]! - Math.min(lives[role]!, mid);
        });
        final[ids[perm[0]]!]! += mainPot;
        const sideWinner = perm.find((role) => role !== smallestRole)!;
        final[ids[sideWinner]!]! += sidePot;
        const icm = icmWithBustOrder(final, ids);
        perRole.push([icm[ids[0]!]!, icm[ids[1]!]!, icm[ids[2]!]!]);
      }
      T3[k]!.push(perRole);
    }
  }

  const p3 = new Float64Array(3);
  const hands3 = [0, 0, 0];
  /**
   * 役割ごとの 3 人対決の $ 期待値を out3 に足し込む (重み w つき)。持てない組なら何もしない。
   * 2 着は「勝者の確率」と「残り 2 人の 2 人対戦勝率」から見積もる。
   */
  function addThreeWay(h: number, v: number, c: number, table: number[][], w: number, out3: Float64Array): boolean {
    if (!threeWay(h, v, c, p3)) return false;
    hands3[0] = h; hands3[1] = v; hands3[2] = c;
    for (let x = 0; x < 3; x++) {
      const px = p3[x]!;
      if (px <= 0) continue;
      const y = x === 0 ? 1 : 0;
      const z = x === 2 ? 1 : 2;
      // y が z より上に来る確率 (x が勝ったとき)
      const ahead = E[hands3[y]! * n + hands3[z]!]!;
      let r = (ahead - p3[y]!) / px;
      if (r < 0) r = 0;
      else if (r > 1) r = 1;
      const permYZ = PERM_INDEX[x]![y]!;
      const permZY = PERM_INDEX[x]![z]!;
      for (let role = 0; role < 3; role++) {
        out3[role]! += w * px * (r * table[permYZ]![role]! + (1 - r) * table[permZY]![role]!);
      }
    }
    return true;
  }

  // ----- 戦略 -----
  const push = new Float64Array(n).fill(1);
  const call: Float64Array[] = callerIndices.map(() => new Float64Array(n));
  /** oc[k][m][c] = callers[k] が call したあと callers[k+1+m] が c で overcall する確率 */
  const oc: Float64Array[][] = callerIndices.map((_, k) =>
    Array.from({ length: K - k - 1 }, () => new Float64Array(n)),
  );

  // 2 人対決の損得表 (overcall の可能性を混ぜ込んだもの)。pay[k] = { p: pusher の $, c: caller の $ }
  const payP: Float64Array[] = callerIndices.map(() => new Float64Array(n * n));
  const payC: Float64Array[] = callerIndices.map(() => new Float64Array(n * n));

  function buildPayoffs(): void {
    const acc = new Float64Array(3);
    for (let k = 0; k < K; k++) {
      const me = callerIndices[k]!;
      const winP = terminals.pusherWins[k]![P]!;
      const loseP = terminals.pusherLoses[k]![P]!;
      const winC = terminals.pusherWins[k]![me]!;
      const loseC = terminals.pusherLoses[k]![me]!;
      const supports = oc[k]!.map((range) => {
        const list: number[] = [];
        for (let c = 0; c < n; c++) if (range[c]! > SUPPORT_EPS) list.push(c);
        return list;
      });
      const anyOvercall = supports.some((list) => list.length > 0);
      const pp = payP[k]!;
      const pc = payC[k]!;
      for (let h = 0; h < n; h++) {
        const pushIn = push[h]! > SUPPORT_EPS;
        for (let v = 0; v < n; v++) {
          const idx = h * n + v;
          const e = E[idx]!;
          const baseP = e * winP + (1 - e) * loseP;
          const baseC = e * winC + (1 - e) * loseC;
          if (!anyOvercall || W[idx]! <= 0 || (!pushIn && !(call[k]![v]! > SUPPORT_EPS))) {
            pp[idx] = baseP;
            pc[idx] = baseC;
            continue;
          }
          let noOc = 1;
          let evP = 0;
          let evC = 0;
          const d = D[idx]!;
          for (let m = 0; m < supports.length; m++) {
            const list = supports[m]!;
            if (list.length === 0 || d <= 0) continue;
            acc[0] = 0; acc[1] = 0; acc[2] = 0;
            let mass = 0;
            for (const c of list) {
              const w = ((W[h * n + c]! * W[v * n + c]!) / combo[c]!) * oc[k]![m]![c]!;
              if (w <= 0) continue;
              if (addThreeWay(h, v, c, T3[k]![m]!, w, acc)) mass += w;
            }
            if (mass <= 0) continue;
            const q = Math.min(1, mass / d);
            evP += noOc * q * (acc[0]! / mass);
            evC += noOc * q * (acc[1]! / mass);
            noOc *= 1 - q;
          }
          pp[idx] = evP + noOc * baseP;
          pc[idx] = evC + noOc * baseC;
        }
      }
    }
  }

  // ----- 内側: pusher と caller の Fictitious Play -----
  const callFrac: Float64Array[] = callerIndices.map(() => new Float64Array(n));
  const winFrac: Float64Array[] = callerIndices.map(() => new Float64Array(n));
  const sdP: Float64Array[] = callerIndices.map(() => new Float64Array(n));
  const reachP = new Float64Array(n);
  const pushBR = new Float64Array(n);
  const callBR: Float64Array[] = callerIndices.map(() => new Float64Array(n));
  const evFoldP = terminals.fold[P]!;
  const stealP = terminals.steal[P]!;

  const slopeOf = (i: number): number => {
    const d = bigBlind * 0.01;
    const up = stacks.slice();
    const down = stacks.slice();
    up[i] = stacks[i]! + d;
    down[i] = Math.max(0, stacks[i]! - d);
    const s = (calculateICM(up, payouts)[i]! - calculateICM(down, payouts)[i]!) / (up[i]! - down[i]!);
    return Math.abs(s) > 1e-12 ? Math.abs(s) * bigBlind : 1;
  };
  const slopeP = slopeOf(P);
  const slopeC = callerIndices.map(slopeOf);

  let converged = false;
  let epsilonBb = Infinity;

  function solveInner(): void {
    converged = false;
    for (let iter = 1; iter <= maxIterations; iter++) {
      const lr = 2 / (iter + 1);
      for (let k = 0; k < K; k++) {
        const ck = call[k]!;
        const pp = payP[k]!;
        for (let h = 0; h < n; h++) {
          const base = h * n;
          let cw = 0;
          let ww = 0;
          let sd = 0;
          for (let v = 0; v < n; v++) {
            const c = ck[v]!;
            if (c <= 0) continue;
            const w = W[base + v]! * c;
            cw += w;
            ww += w * E[base + v]!;
            sd += w * pp[base + v]!;
          }
          const T = rowTotal[h]!;
          callFrac[k]![h] = T > 0 ? cw / T : 0;
          winFrac[k]![h] = T > 0 ? ww / T : 0;
          sdP[k]![h] = T > 0 ? sd / T : 0;
        }
      }

      let epsP = 0;
      for (let h = 0; h < n; h++) {
        let reach = 1;
        let ev = 0;
        for (let k = 0; k < K; k++) {
          ev += reach * sdP[k]![h]!;
          reach *= 1 - callFrac[k]![h]!;
        }
        ev += reach * stealP;
        pushBR[h] = ev > evFoldP ? 1 : 0;
        const best = ev > evFoldP ? ev : evFoldP;
        epsP += prior[h]! * (best - (push[h]! * ev + (1 - push[h]!) * evFoldP));
      }
      epsilonBb = epsP / slopeP;

      reachP.fill(1);
      for (let k = 0; k < K; k++) {
        const me = callerIndices[k]!;
        let mass = 0;
        let evFoldSum = 0;
        for (let h = 0; h < n; h++) {
          const w = prior[h]! * push[h]! * reachP[h]!;
          if (w <= 0) continue;
          mass += w;
          let reach = 1;
          let ev = 0;
          for (let j = k + 1; j < K; j++) {
            const cf = callFrac[j]![h]!;
            const wf = winFrac[j]![h]!;
            ev += reach * (wf * terminals.pusherWins[j]![me]! + (cf - wf) * terminals.pusherLoses[j]![me]!);
            reach *= 1 - cf;
          }
          ev += reach * terminals.steal[me]!;
          evFoldSum += w * ev;
        }
        const evFoldMe = mass > 0 ? evFoldSum / mass : terminals.steal[me]!;

        let epsK = 0;
        const ck = call[k]!;
        const br = callBR[k]!;
        const pc = payC[k]!;
        for (let c = 0; c < n; c++) {
          let pw = 0;
          let sd = 0;
          for (let h = 0; h < n; h++) {
            const w = W[c * n + h]! * push[h]! * reachP[h]!;
            if (w <= 0) continue;
            pw += w;
            sd += w * pc[h * n + c]!;
          }
          if (pw <= 0) {
            br[c] = 0;
            continue;
          }
          const evCall = sd / pw;
          br[c] = evCall > evFoldMe ? 1 : 0;
          const best = evCall > evFoldMe ? evCall : evFoldMe;
          epsK += prior[c]! * (pw / rowTotal[c]!) * (best - (ck[c]! * evCall + (1 - ck[c]!) * evFoldMe));
        }
        epsilonBb = Math.max(epsilonBb, epsK / slopeC[k]!);
        const cf = callFrac[k]!;
        for (let h = 0; h < n; h++) reachP[h] = reachP[h]! * (1 - cf[h]!);
      }

      for (let h = 0; h < n; h++) push[h] = (1 - lr) * push[h]! + lr * pushBR[h]!;
      for (let k = 0; k < K; k++) {
        const ck = call[k]!;
        const br = callBR[k]!;
        for (let c = 0; c < n; c++) ck[c] = (1 - lr) * ck[c]! + lr * br[c]!;
      }
      if (iter >= 2 && epsilonBb < convergenceTolerance) {
        converged = true;
        break;
      }
    }
  }

  // ----- overcaller の最適レンジ -----
  function updateOvercalls(damping: number): void {
    const acc = new Float64Array(3);
    // reach[h] = callers[k] の番まで全員 fold している確率
    const reach = new Float64Array(n).fill(1);
    for (let k = 0; k < K; k++) {
      const pushSupport: number[] = [];
      const callSupport: number[] = [];
      for (let h = 0; h < n; h++) if (push[h]! * reach[h]! > SUPPORT_EPS) pushSupport.push(h);
      for (let v = 0; v < n; v++) if (call[k]![v]! > SUPPORT_EPS) callSupport.push(v);
      for (let m = 0; m < K - k - 1; m++) {
        const j = k + 1 + m;
        const me = callerIndices[j]!;
        const winMe = terminals.pusherWins[k]![me]!;
        const loseMe = terminals.pusherLoses[k]![me]!;
        const range = oc[k]![m]!;
        for (let c = 0; c < n; c++) {
          let mass = 0;
          let evFold = 0;
          acc[0] = 0; acc[1] = 0; acc[2] = 0;
          for (const h of pushSupport) {
            const wch = W[c * n + h]!;
            if (wch <= 0) continue;
            const ph = push[h]! * reach[h]! * wch;
            for (const v of callSupport) {
              const w = (ph * call[k]![v]! * W[c * n + v]! * W[h * n + v]!) / combo[v]!;
              if (w <= 0) continue;
              if (!addThreeWay(h, v, c, T3[k]![m]!, w, acc)) continue;
              mass += w;
              const e = E[h * n + v]!;
              evFold += w * (e * winMe + (1 - e) * loseMe);
            }
          }
          const target = mass > 0 && acc[2]! / mass > evFold / mass ? 1 : 0;
          range[c] = (1 - damping) * range[c]! + damping * target;
        }
      }
      for (let h = 0; h < n; h++) {
        let cw = 0;
        for (let v = 0; v < n; v++) cw += W[h * n + v]! * call[k]![v]!;
        reach[h] = reach[h]! * (1 - (rowTotal[h]! > 0 ? cw / rowTotal[h]! : 0));
      }
    }
  }

  // ----- 外側のくり返し -----
  buildPayoffs(); // overcall なしの損得表
  solveInner();
  for (let outer = 0; outer < outerIterations; outer++) {
    // 最初は一気に寄せ、あとは半分ずつ動かして振動を抑える
    updateOvercalls(outer === 0 ? 1 : 0.5);
    buildPayoffs();
    solveInner();
  }
  // 最後のレンジに対する overcall を確定させる
  updateOvercalls(1);

  const toSet = (freq: Float64Array): Set<HandLabel> => {
    const out = new Set<HandLabel>();
    for (let i = 0; i < n; i++) if (freq[i]! > 0.5) out.add(allHands[i]!);
    return out;
  };
  return {
    pushRange: toSet(push),
    callRanges: call.map(toSet),
    overcallRanges: oc.map((list) => list.map(toSet)),
    converged,
    exploitability: epsilonBb,
    values: computeNodeValues(terminals, prior, push, call, W, rowTotal, E),
  };
}
