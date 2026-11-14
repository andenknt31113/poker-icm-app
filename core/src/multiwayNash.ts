/**
 * 後ろに複数人残っている局面の push/fold ナッシュ均衡ソルバ（ICM 反映）。
 *
 * モデル:
 *   - 1 人 (pusher) が all-in するか fold するかを各ハンドで決める。
 *   - pusher の後ろに残っている人 (callers) が、行動順に call するか fold するかを決める。
 *   - 最初に call した人と pusher の 2 人でショーダウンする。**2 人目の call
 *     (オーバーコール) は扱わない** — 誰かが call したら、それより後ろの人は fold する。
 *     このため必要な勝率は 2 人対戦のものだけで、3 人同時 all-in の勝率表は使わない。
 *   - 全ての終端 EV は ICM ($ エクイティ) で評価する。
 *
 * solveHUNash との関係:
 *   callers が 1 人なら solveHUNash と同じゲームになる (テストで一致を確認)。
 *
 * 近似:
 *   - コール側どうしのカードの重複は見ない (pusher との重複だけ見る)。
 *   - pusher が fold したあとの残りの人の攻防は解かず、foldWinnerIndex (通常 BB) が
 *     ポットを取るものとする。
 */

import { calculateICM } from "./icm.js";
import type { ComboWeightFn, HandLabel } from "./nash.js";
import type { Payouts, Stacks } from "./types.js";

export interface MultiwayPushFoldInput {
  /** ハンド開始時点の全員のスタック (blind / ante を払う前)。 */
  readonly stacks: Stacks;
  readonly payouts: Payouts;
  /** all-in する人。 */
  readonly pusherIndex: number;
  /** pusher の後ろに残っている人。行動順 (先に動く人が先頭)。 */
  readonly callerIndices: readonly number[];
  /** 各プレイヤーが置いている blind (置いていなければ 0)。stacks と同じ並び。 */
  readonly blinds: readonly number[];
  /** 各プレイヤーが払った ante (dead money)。stacks と同じ並び。 */
  readonly antes: readonly number[];
  /** pusher が fold したときにポットを取る人 (通常 BB)。 */
  readonly foldWinnerIndex: number;
  /** ハンド対決の equity 関数 (hero, villain → hero の equity 0..1)。 */
  readonly huEquity: (hero: HandLabel, villain: HandLabel) => number;
  /** ハンド一覧 (169 個)。 */
  readonly allHands: readonly HandLabel[];
  /** カードリムーバル込みのコンボ重み (省略時は固定重み 6/4/12)。 */
  readonly comboWeight?: ComboWeightFn;
  /** 反復回数の上限 (既定 500)。 */
  readonly maxIterations?: number;
  /** 収束判定の閾値 (bb 単位の exploitability、既定 0.001)。 */
  readonly convergenceTolerance?: number;
  /** exploitability を bb に換算するための 1bb のチップ量 (既定 1)。 */
  readonly bigBlind?: number;
  /**
   * pusher が fold したときの全員の $ (stacks と同じ並び)。
   * 省略時は「foldWinnerIndex がポットを取って終わる」近似。次に動く人が押すか降りるかを
   * 選ぶ続きの局面を別に解いてあれば、その結果 (values) を渡すと、降りたあとの攻防まで入る。
   */
  readonly foldEquities?: readonly number[];
}

export interface MultiwayPushFoldResult {
  readonly pushFreq: ReadonlyMap<HandLabel, number>;
  /** callerIndices と同じ並び。 */
  readonly callFreqs: readonly ReadonlyMap<HandLabel, number>[];
  /** push 確率 > 0.5 のハンド。 */
  readonly pushRange: ReadonlySet<HandLabel>;
  /** call 確率 > 0.5 のハンド。callerIndices と同じ並び。 */
  readonly callRanges: readonly ReadonlySet<HandLabel>[];
  readonly iterations: number;
  readonly converged: boolean;
  /** 最終反復の exploitability (bb 単位、全員の最大値)。 */
  readonly exploitability: number;
  /**
   * この局面 (pusher が押すか降りるかを選ぶ時点) での全員の $ の期待値。stacks と同じ並び。
   * 1 つ前に動く人の foldEquities として使える。
   */
  readonly values: readonly number[];
}

const DEFAULT_MAX_ITER = 500;
const DEFAULT_TOLERANCE = 0.001;

function comboCount(hand: HandLabel): number {
  if (hand.length === 2) return 6;
  return hand[2] === "s" ? 4 : 12;
}

/** 各終端での全員の $ エクイティ。 */
export interface MultiwayTerminals {
  /** pusher が fold。 */
  readonly fold: readonly number[];
  /** 全員が fold して pusher がスチール。 */
  readonly steal: readonly number[];
  /** callers[k] が call して pusher が勝った場合。 */
  readonly pusherWins: readonly (readonly number[])[];
  /** callers[k] が call して pusher が負けた場合。 */
  readonly pusherLoses: readonly (readonly number[])[];
  /** 各終端のスタック (検証・表示用)。同じキー構成。 */
  readonly stacks: {
    readonly fold: readonly number[];
    readonly steal: readonly number[];
    readonly pusherWins: readonly (readonly number[])[];
    readonly pusherLoses: readonly (readonly number[])[];
  };
}

function validate(input: MultiwayPushFoldInput): void {
  const { stacks, pusherIndex, callerIndices, blinds, antes, foldWinnerIndex, allHands } = input;
  const n = stacks.length;
  if (n < 2) throw new Error("MultiwayNash: プレイヤー数が 2 未満");
  if (blinds.length !== n || antes.length !== n) {
    throw new Error("MultiwayNash: blinds / antes の長さが stacks と一致しません");
  }
  const inRange = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < n;
  if (!inRange(pusherIndex)) throw new Error(`MultiwayNash: pusherIndex 範囲外 (${pusherIndex})`);
  if (!inRange(foldWinnerIndex)) throw new Error(`MultiwayNash: foldWinnerIndex 範囲外 (${foldWinnerIndex})`);
  if (callerIndices.length === 0) throw new Error("MultiwayNash: callerIndices が空");
  const seen = new Set<number>([pusherIndex]);
  for (const c of callerIndices) {
    if (!inRange(c)) throw new Error(`MultiwayNash: callerIndices 範囲外 (${c})`);
    if (seen.has(c)) throw new Error(`MultiwayNash: callerIndices に重複または pusher が含まれています (${c})`);
    seen.add(c);
  }
  for (let i = 0; i < n; i++) {
    const b = blinds[i]!;
    const a = antes[i]!;
    if (!(b >= 0) || !(a >= 0)) throw new Error("MultiwayNash: blinds / antes は非負である必要があります");
    if (stacks[i]! - a - b < 0) throw new Error(`MultiwayNash: stacks[${i}] が blind + ante に足りません`);
  }
  if (!(stacks[pusherIndex]! - antes[pusherIndex]! > 0)) {
    throw new Error("MultiwayNash: pusher のスタックは正の値である必要があります");
  }
  for (const c of callerIndices) {
    if (!(stacks[c]! - antes[c]! > 0)) {
      throw new Error("MultiwayNash: caller のスタックは正の値である必要があります");
    }
  }
  if (allHands.length === 0) throw new Error("MultiwayNash: allHands が空");
}

/** 各終端のスタックと ICM エクイティを組み立てる (チップの総量は常に保存される)。 */
export function buildMultiwayTerminals(
  input: Pick<
    MultiwayPushFoldInput,
    "stacks" | "payouts" | "pusherIndex" | "callerIndices" | "blinds" | "antes" | "foldWinnerIndex" | "foldEquities"
  >,
): MultiwayTerminals {
  const { stacks, payouts, pusherIndex, callerIndices, blinds, antes, foldWinnerIndex, foldEquities } = input;
  if (foldEquities && foldEquities.length !== stacks.length) {
    throw new Error("MultiwayNash: foldEquities の長さが stacks と一致しません");
  }
  // ante を払った後のスタック (blind はまだ自分のスタックに含める)
  const live = stacks.map((s, i) => s - antes[i]!);
  const anteTotal = antes.reduce((a, b) => a + b, 0);
  const blindTotal = blinds.reduce((a, b) => a + b, 0);
  // 全員が blind を置いた状態
  const posted = live.map((s, i) => s - blinds[i]!);

  // fold: pusher は自分の blind を失う。ポット (全員の blind + ante) は foldWinner が取る近似。
  const foldStacks = posted.slice();
  foldStacks[foldWinnerIndex] = posted[foldWinnerIndex]! + blindTotal + anteTotal;

  // steal: 全員 fold。pusher がポットを取る。
  const stealStacks = posted.slice();
  stealStacks[pusherIndex] = posted[pusherIndex]! + blindTotal + anteTotal;

  const winStacks: number[][] = [];
  const loseStacks: number[][] = [];
  for (const c of callerIndices) {
    const matched = Math.min(live[pusherIndex]!, live[c]!);
    // 2 人以外の blind と全員の ante が dead money
    const dead = blindTotal - blinds[pusherIndex]! - blinds[c]! + anteTotal;
    const pot = 2 * matched + dead;
    const win = posted.slice();
    win[pusherIndex] = live[pusherIndex]! - matched + pot;
    win[c] = live[c]! - matched;
    const lose = posted.slice();
    lose[pusherIndex] = live[pusherIndex]! - matched;
    lose[c] = live[c]! - matched + pot;
    winStacks.push(win);
    loseStacks.push(lose);
  }

  const icm = (s: readonly number[]): number[] => calculateICM(s.map((v) => Math.max(0, v)), payouts).slice();
  return {
    fold: foldEquities ? foldEquities.slice() : icm(foldStacks),
    steal: icm(stealStacks),
    pusherWins: winStacks.map(icm),
    pusherLoses: loseStacks.map(icm),
    stacks: { fold: foldStacks, steal: stealStacks, pusherWins: winStacks, pusherLoses: loseStacks },
  };
}

/**
 * 解いた戦略のもとでの全員の $ の期待値 (pusher が押すか降りるかを選ぶ時点)。
 * オーバーコールは起きる頻度が小さいので、ここでは 2 人対決の終端だけで見積もる。
 */
export function computeNodeValues(
  terminals: MultiwayTerminals,
  prior: readonly number[],
  push: ArrayLike<number>,
  call: readonly ArrayLike<number>[],
  W: ArrayLike<number>,
  rowTotal: ArrayLike<number>,
  E: ArrayLike<number>,
): number[] {
  const n = prior.length;
  const players = terminals.fold.length;
  const K = call.length;
  const values = new Array<number>(players).fill(0);
  for (let h = 0; h < n; h++) {
    const ph = prior[h]!;
    if (ph <= 0) continue;
    const pushProb = push[h]!;
    for (let i = 0; i < players; i++) values[i]! += ph * (1 - pushProb) * terminals.fold[i]!;
    if (pushProb <= 0) continue;
    let reach = 1;
    for (let k = 0; k < K; k++) {
      let cw = 0;
      let ww = 0;
      const ck = call[k]!;
      for (let v = 0; v < n; v++) {
        const c = ck[v]!;
        if (c <= 0) continue;
        const w = W[h * n + v]! * c;
        cw += w;
        ww += w * E[h * n + v]!;
      }
      const T = rowTotal[h]!;
      const cf = T > 0 ? cw / T : 0;
      const wf = T > 0 ? ww / T : 0;
      const win = terminals.pusherWins[k]!;
      const lose = terminals.pusherLoses[k]!;
      for (let i = 0; i < players; i++) values[i]! += ph * pushProb * reach * (wf * win[i]! + (cf - wf) * lose[i]!);
      reach *= 1 - cf;
    }
    for (let i = 0; i < players; i++) values[i]! += ph * pushProb * reach * terminals.steal[i]!;
  }
  return values;
}

/**
 * 後ろに複数人いる push/fold 均衡を Fictitious Play (線形平均化) で解く。
 */
export function solveMultiwayPushFold(input: MultiwayPushFoldInput): MultiwayPushFoldResult {
  validate(input);
  const {
    stacks,
    payouts,
    pusherIndex,
    callerIndices,
    huEquity,
    allHands,
    comboWeight,
    maxIterations = DEFAULT_MAX_ITER,
    convergenceTolerance = DEFAULT_TOLERANCE,
    bigBlind = 1,
  } = input;

  const terminals = buildMultiwayTerminals(input);
  const n = allHands.length;
  const K = callerIndices.length;

  // ----- コンボ重みと equity -----
  const handCombo = allHands.map(comboCount);
  const totalCombos = handCombo.reduce((a, b) => a + b, 0);
  const prior = handCombo.map((c) => c / totalCombos);
  const wfn: ComboWeightFn = comboWeight ?? ((_h, v) => comboCount(v));
  // W[a*n+b] = a を持つ人から見た、相手が b を持つ組合せ数
  const W = new Float64Array(n * n);
  const rowTotal = new Float64Array(n);
  // E[a*n+b] = a の b に対する equity
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

  const P = pusherIndex;
  const evFoldP = terminals.fold[P]!;
  const stealP = terminals.steal[P]!;

  // ----- 戦略 -----
  const push = new Float64Array(n).fill(1);
  const call: Float64Array[] = callerIndices.map(() => new Float64Array(n));

  // 反復ごとの作業領域
  const callFrac: Float64Array[] = callerIndices.map(() => new Float64Array(n)); // pusher が h のとき k が call する確率
  const winFrac: Float64Array[] = callerIndices.map(() => new Float64Array(n)); // そのうち pusher が勝つ確率質量
  const reachP = new Float64Array(n); // k の番まで全員 fold している確率 (pusher の手 h ごと)
  const pushBR = new Float64Array(n);
  const callBR: Float64Array[] = callerIndices.map(() => new Float64Array(n));

  // chip → $ の換算 (exploitability を bb で測る)。各自のスタックを 1bb 動かしたときの $ 変化。
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

  let iter = 0;
  let converged = false;
  let epsilonBb = Infinity;

  for (iter = 1; iter <= maxIterations; iter++) {
    const lr = 2 / (iter + 1);

    // (1) pusher の手 h ごとに、各 caller が call する確率と、そのとき pusher が勝つ確率質量
    for (let k = 0; k < K; k++) {
      const ck = call[k]!;
      const cf = callFrac[k]!;
      const wf = winFrac[k]!;
      for (let h = 0; h < n; h++) {
        const base = h * n;
        let cw = 0;
        let ww = 0;
        for (let v = 0; v < n; v++) {
          const c = ck[v]!;
          if (c <= 0) continue;
          const w = W[base + v]! * c;
          cw += w;
          ww += w * E[base + v]!;
        }
        const T = rowTotal[h]!;
        cf[h] = T > 0 ? cw / T : 0;
        wf[h] = T > 0 ? ww / T : 0;
      }
    }

    // (2) pusher の best response
    let epsP = 0;
    for (let h = 0; h < n; h++) {
      let reach = 1;
      let ev = 0;
      for (let k = 0; k < K; k++) {
        const cf = callFrac[k]![h]!;
        const wf = winFrac[k]![h]!;
        ev += reach * (wf * terminals.pusherWins[k]![P]! + (cf - wf) * terminals.pusherLoses[k]![P]!);
        reach *= 1 - cf;
      }
      ev += reach * stealP;
      pushBR[h] = ev > evFoldP ? 1 : 0;
      const best = ev > evFoldP ? ev : evFoldP;
      const cur = push[h]! * ev + (1 - push[h]!) * evFoldP;
      epsP += prior[h]! * (best - cur);
    }
    epsilonBb = epsP / slopeP;

    // (3) 各 caller の best response
    reachP.fill(1);
    for (let k = 0; k < K; k++) {
      const me = callerIndices[k]!;
      const winMe = terminals.pusherWins[k]![me]!; // pusher が勝つ = 自分は負け
      const loseMe = terminals.pusherLoses[k]![me]!; // pusher が負ける = 自分の勝ち

      // 自分が fold したときの $: 後ろの人と pusher の勝負 or スチールの混合。
      // pusher のレンジは「自分の番まで全員 fold している」条件で重み付けする。
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
      for (let c = 0; c < n; c++) {
        const base = c * n;
        let pw = 0;
        let sd = 0;
        for (let h = 0; h < n; h++) {
          const w = W[base + h]! * push[h]! * reachP[h]!;
          if (w <= 0) continue;
          pw += w;
          const pusherEq = E[h * n + c]!;
          sd += w * (pusherEq * winMe + (1 - pusherEq) * loseMe);
        }
        if (pw <= 0) {
          br[c] = 0;
          continue;
        }
        const evCall = sd / pw;
        br[c] = evCall > evFoldMe ? 1 : 0;
        const best = evCall > evFoldMe ? evCall : evFoldMe;
        const cur = ck[c]! * evCall + (1 - ck[c]!) * evFoldMe;
        epsK += prior[c]! * (pw / rowTotal[c]!) * (best - cur);
      }
      epsilonBb = Math.max(epsilonBb, epsK / slopeC[k]!);

      // 次の caller の番に進むには、この caller が fold している必要がある
      const cf = callFrac[k]!;
      for (let h = 0; h < n; h++) reachP[h] = reachP[h]! * (1 - cf[h]!);
    }

    // (4) 平均化更新
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

  const pushFreq = new Map<HandLabel, number>();
  const pushRange = new Set<HandLabel>();
  for (let h = 0; h < n; h++) {
    pushFreq.set(allHands[h]!, push[h]!);
    if (push[h]! > 0.5) pushRange.add(allHands[h]!);
  }
  const callFreqs: Map<HandLabel, number>[] = [];
  const callRanges: Set<HandLabel>[] = [];
  for (let k = 0; k < K; k++) {
    const freq = new Map<HandLabel, number>();
    const range = new Set<HandLabel>();
    for (let c = 0; c < n; c++) {
      freq.set(allHands[c]!, call[k]![c]!);
      if (call[k]![c]! > 0.5) range.add(allHands[c]!);
    }
    callFreqs.push(freq);
    callRanges.push(range);
  }

  return {
    pushFreq,
    callFreqs,
    pushRange,
    callRanges,
    iterations: Math.min(iter, maxIterations),
    converged,
    exploitability: epsilonBb,
    values: computeNodeValues(terminals, prior, push, call, W, rowTotal, E),
  };
}
