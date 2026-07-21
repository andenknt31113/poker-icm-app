/**
 * HU (heads-up) push/fold ナッシュ均衡ソルバ（ICM 反映）。
 *
 * 概要:
 *   - SB（hero）が all-in push するか fold するかを各ハンドで決める。
 *   - BB（villain）は SB の push に対して call するか fold するかを各ハンドで決める。
 *   - Fictitious Play（相手の平均戦略への best response の平均化）で
 *     ε-Nash 均衡に収束させる。
 *   - 全ての終端 EV は ICM ($エクイティ) で評価する。これにより BF/ICM 圧が自然に反映される。
 *
 * 精度に関わる設計:
 *   - 各ハンド（pair / suited / offsuit）は組合せ数で重み付け。既定は固定重み
 *     6/4/12（comboCount）だが、`comboWeight` を注入することで hero の手札による
 *     カードリムーバル（ブロッカー）込みの重みに置き換えられる。これにより境界
 *     ハンドの best response 判定が厳密になり、被搾取度（exploitability）が下がる。
 *   - 収束は「戦略の変化量」ではなく実測 exploitability（ε）で判定する。
 *     Fictitious Play の平均戦略は ε→0 に収束するため、これが精度と直結する。
 *   - 均衡は基本的に pure だが、境界（無差別）ハンドの混合頻度は frequency map に保持する。
 */

import { calculateICM } from "./icm.js";
import type { Payouts, Stacks } from "./types.js";

/** 表記は文字列にしておき、上位コードで HandNotation を流し込む。 */
export type HandLabel = string;

/**
 * hero が heroHand（の代表コンボ）を持つときの、villain が villainHand を持つ
 * 組合せ数。カードリムーバル（ブロッカー効果）を反映した重み関数の型。
 * 省略時は固定重み（comboCount, hero を無視）を用いる。
 */
export type ComboWeightFn = (heroHand: HandLabel, villainHand: HandLabel) => number;

export interface HUNashInput {
  /** 全プレイヤーのスタック（hero/villain以外も ICM 計算で必要）。 */
  readonly stacks: Stacks;
  /** ペイ構造。 */
  readonly payouts: Payouts;
  /** SB を取るプレイヤーの index（hero）。プッシュする側。 */
  readonly sbIndex: number;
  /** BB を取るプレイヤーの index（villain）。コール/フォールド側。 */
  readonly bbIndex: number;
  /** SB（small blind）のチップ量。 */
  readonly sb: number;
  /** BB（big blind）のチップ量。 */
  readonly bb: number;
  /** ante（プレイヤー1人あたり）。0 でも可。 */
  readonly ante?: number;
  /** ハンド対決の equity 関数（hero, villain → hero の equity 0..1）。 */
  readonly huEquity: (hero: HandLabel, villain: HandLabel) => number;
  /** ハンド一覧（169個、順序は任意）。 */
  readonly allHands: readonly HandLabel[];
  /** 反復回数の上限（既定 300）。 */
  readonly maxIterations?: number;
  /**
   * 収束判定の閾値。実測 exploitability（ε）を bb 単位に換算した値がこれ未満で
   * 収束とみなす（既定 0.002bb）。
   */
  readonly convergenceTolerance?: number;
  /**
   * カードリムーバル込みのコンボ重み関数（省略時は固定重み 6/4/12）。
   * 注入すると best response の精度が上がる。
   */
  readonly comboWeight?: ComboWeightFn;
}

export interface HUNashResult {
  /** SB のプッシュレンジ（push する hand の集合、prob > 0.5）。 */
  readonly sbPushRange: ReadonlySet<HandLabel>;
  /** BB のコールレンジ（call する hand の集合、prob > 0.5）。 */
  readonly bbCallRange: ReadonlySet<HandLabel>;
  /** SB の各ハンドの push 確率 (mixed strategy frequency, 0..1)。 */
  readonly sbPushFreq: ReadonlyMap<HandLabel, number>;
  /** BB の各ハンドの call 確率 (mixed strategy frequency, 0..1)。 */
  readonly bbCallFreq: ReadonlyMap<HandLabel, number>;
  /** 反復回数。 */
  readonly iterations: number;
  /** 収束したか（false なら maxIterations 到達）。 */
  readonly converged: boolean;
  /** SB のプッシュレンジサイズ（個数 / 169）。 */
  readonly sbPushPct: number;
  /** BB のコールレンジサイズ（個数 / 169）。 */
  readonly bbCallPct: number;
  /** 収束時に達成された exploitability（bb 単位、SB/BB の大きい方）。 */
  readonly exploitability: number;
}

const DEFAULT_MAX_ITER = 500;
// 収束閾値（bb 単位の exploitability）。equity テーブルの MC 標準誤差
// (±0.35pt ≒ 0.0035 equity) 由来のノイズ床を下回る水準。これ以上厳しくしても
// テーブル精度の範囲では意味のある改善にならない。
const DEFAULT_TOLERANCE = 0.001;

/**
 * 169 ハンド表記からその組合せ数を返す。
 *   - "AA" / "KK" など (length 2): pair → C(4,2) = 6
 *   - "AKs" など (length 3, 末尾 s): suited → 4
 *   - "AKo" など (length 3, 末尾 o): offsuit → 12
 */
function comboCount(hand: HandLabel): number {
  if (hand.length === 2) return 6;
  const tail = hand[2];
  if (tail === "s") return 4;
  return 12;
}

/**
 * HU push/fold ゲームの「盤面」を構築する内部ヘルパ。
 * 終端 ICM エクイティ・コンボ重み行列・EV 評価関数・exploitability 換算係数を返す。
 * solveHUNash と huNashExploitability の双方から使い、数値の整合を保証する。
 */
interface HUGame {
  readonly n: number;
  readonly handCombo: number[];
  readonly totalCombos: number;
  /** dealt 事前確率 prior[i] = handCombo[i] / totalCombos。 */
  readonly prior: number[];
  /** SB fold 時の SB エクイティ。 */
  readonly evFoldSb: number;
  /** BB fold（SB steal 成功）時の BB エクイティ。 */
  readonly evFoldBb: number;
  /** SB が hand hi を push したときの EV（BB の call 頻度配列を所与）。 */
  pushEvSb(hi: number, bbCallProb: readonly number[]): number;
  /**
   * BB が hand vi を call したときの showdown EV と、
   * vi 視点で SB が push してくる割合（0..1）を返す。
   */
  callEvBb(vi: number, sbPushProb: readonly number[]): { ev: number; pushFrac: number };
  /** exploitability($) を bb 単位へ換算する係数（$ / bb）。SB 側。 */
  readonly chipSlopeSb: number;
  /** exploitability($) を bb 単位へ換算する係数（$ / bb）。BB 側。 */
  readonly chipSlopeBb: number;
}

function buildHUGame(input: HUNashInput): HUGame {
  const {
    stacks,
    payouts,
    sbIndex,
    bbIndex,
    sb,
    bb,
    ante = 0,
    huEquity,
    allHands,
    comboWeight,
  } = input;

  // ----- バリデーション -----
  const n0 = stacks.length;
  if (n0 < 2) throw new Error("HUNash: プレイヤー数が 2 未満");
  if (sbIndex === bbIndex) {
    throw new Error("HUNash: sbIndex と bbIndex が同じ");
  }
  if (sbIndex < 0 || sbIndex >= n0) {
    throw new Error(`HUNash: sbIndex 範囲外 (${sbIndex})`);
  }
  if (bbIndex < 0 || bbIndex >= n0) {
    throw new Error(`HUNash: bbIndex 範囲外 (${bbIndex})`);
  }
  if (sb <= 0 || bb <= 0) {
    throw new Error(`HUNash: sb/bb が不正 (${sb}, ${bb})`);
  }
  if (ante < 0) throw new Error(`HUNash: ante が負 (${ante})`);
  if (allHands.length === 0) {
    throw new Error("HUNash: allHands が空");
  }

  const sbStack0 = stacks[sbIndex]!;
  const bbStack0 = stacks[bbIndex]!;
  if (sbStack0 <= 0 || bbStack0 <= 0) {
    throw new Error(
      `HUNash: SB/BB のスタックは正の値である必要がある (${sbStack0}, ${bbStack0})`,
    );
  }

  const playerCount = n0;
  const totalAnte = ante * playerCount;

  // 全プレイヤーから ante 控除した「ハンド開始時」のスタック
  const baseStacks: number[] = stacks.map((s) => s - ante);

  const sbBaseAfterBlind = baseStacks[sbIndex]! - sb;
  const bbBaseAfterBlind = baseStacks[bbIndex]! - bb;
  if (sbBaseAfterBlind < 0) {
    throw new Error("HUNash: SB の支払い後スタックが負");
  }
  if (bbBaseAfterBlind < 0) {
    throw new Error("HUNash: BB の支払い後スタックが負");
  }

  const matched = Math.min(baseStacks[sbIndex]!, baseStacks[bbIndex]!);

  // 任意の (sbStack, bbStack) を所与に ICM を評価。
  function icmAt(sbStack: number, bbStack: number): { sbEq: number; bbEq: number } {
    const s: number[] = baseStacks.slice();
    s[sbIndex] = Math.max(0, sbStack);
    s[bbIndex] = Math.max(0, bbStack);
    const eq = calculateICM(s, payouts);
    return { sbEq: eq[sbIndex]!, bbEq: eq[bbIndex]! };
  }

  // ----- 各終端のスタックと ICM -----
  const foldSbStack = baseStacks[sbIndex]! - sb;
  const foldBbStack = baseStacks[bbIndex]! + sb + totalAnte;
  const foldICM = icmAt(foldSbStack, foldBbStack);

  const stealSbStack = baseStacks[sbIndex]! + bb + totalAnte;
  const stealBbStack = baseStacks[bbIndex]! - bb;
  const stealICM = icmAt(stealSbStack, stealBbStack);

  const winSbStack = baseStacks[sbIndex]! + matched + totalAnte;
  const winBbStack = baseStacks[bbIndex]! - matched;
  const winICM = icmAt(winSbStack, winBbStack);

  const loseSbStack = baseStacks[sbIndex]! - matched;
  const loseBbStack = baseStacks[bbIndex]! + matched + totalAnte;
  const loseICM = icmAt(loseSbStack, loseBbStack);

  // ----- コンボ重み行列 W[hi*n+vi] = comboWeight(hero=hi, villain=vi) -----
  const n = allHands.length;
  const handCombo = allHands.map((h) => comboCount(h));
  const totalCombos = handCombo.reduce((a, x) => a + x, 0);
  const prior = handCombo.map((c) => c / totalCombos);

  const wfn: ComboWeightFn =
    comboWeight ?? ((_h, v) => comboCount(v));
  const W = new Float64Array(n * n);
  const rowTotal = new Float64Array(n);
  for (let hi = 0; hi < n; hi++) {
    let t = 0;
    const hh = allHands[hi]!;
    for (let vi = 0; vi < n; vi++) {
      const w = wfn(hh, allHands[vi]!);
      W[hi * n + vi] = w;
      t += w;
    }
    rowTotal[hi] = t;
  }

  // equity キャッシュ（huEquity(hero=hi, villain=vi)）
  const equityCache = new Float32Array(n * n);
  const equityCached = new Uint8Array(n * n);
  function cachedEq(hi: number, vi: number): number {
    const idx = hi * n + vi;
    if (!equityCached[idx]) {
      equityCache[idx] = huEquity(allHands[hi]!, allHands[vi]!);
      equityCached[idx] = 1;
    }
    return equityCache[idx]!;
  }

  const evFoldSb = foldICM.sbEq;
  const evFoldBb = stealICM.bbEq;
  const winSbEq = winICM.sbEq;
  const loseSbEq = loseICM.sbEq;
  const winBbEq = winICM.bbEq;
  const loseBbEq = loseICM.bbEq;
  const stealSbEq = stealICM.sbEq;

  function pushEvSb(hi: number, bbCallProb: readonly number[]): number {
    const base = hi * n;
    const T = rowTotal[hi]!;
    let callW = 0;
    let sd = 0;
    for (let vi = 0; vi < n; vi++) {
      const cp = bbCallProb[vi]!;
      if (cp <= 0) continue;
      const wc = W[base + vi]! * cp;
      callW += wc;
      const heq = cachedEq(hi, vi);
      sd += wc * (heq * winSbEq + (1 - heq) * loseSbEq);
    }
    const foldW = T - callW;
    return (foldW * stealSbEq + sd) / T;
  }

  function callEvBb(vi: number, sbPushProb: readonly number[]): { ev: number; pushFrac: number } {
    const base = vi * n;
    const T = rowTotal[vi]!;
    let pushW = 0;
    let sd = 0;
    for (let hi = 0; hi < n; hi++) {
      const pp = sbPushProb[hi]!;
      if (pp <= 0) continue;
      const wp = W[base + hi]! * pp;
      pushW += wp;
      const sbWin = cachedEq(hi, vi);
      sd += wp * (sbWin * winBbEq + (1 - sbWin) * loseBbEq);
    }
    if (pushW <= 0) return { ev: evFoldBb, pushFrac: 0 };
    return { ev: sd / pushW, pushFrac: pushW / T };
  }

  // chip → $ 換算係数（数値微分）。sb/bb は BB 単位なので chip = bb。
  const d = 0.01;
  const slopeSb =
    (icmAt(sbStack0 + d, bbStack0).sbEq - icmAt(sbStack0 - d, bbStack0).sbEq) /
    (2 * d);
  const slopeBb =
    (icmAt(sbStack0, bbStack0 + d).bbEq - icmAt(sbStack0, bbStack0 - d).bbEq) /
    (2 * d);

  return {
    n,
    handCombo,
    totalCombos,
    prior,
    evFoldSb,
    evFoldBb,
    pushEvSb,
    callEvBb,
    chipSlopeSb: Math.abs(slopeSb) > 1e-12 ? Math.abs(slopeSb) : 1,
    chipSlopeBb: Math.abs(slopeBb) > 1e-12 ? Math.abs(slopeBb) : 1,
  };
}

/**
 * 与えられた戦略プロファイルの被搾取度（exploitability, ε-Nash の ε）を計算する。
 *
 * 定義:
 *   - SB 側 ε: BB 戦略を固定したとき、SB が各ハンドで best response（push/fold の
 *     良い方）に切り替えて得られる EV 利得。全ハンドを dealt prior で加重。
 *   - BB 側 ε: SB 戦略を固定したとき、BB が各ハンドで best response（call/fold）に
 *     切り替えて得られる EV 利得。BB は SB が push してきたときのみ行動するため、
 *     その頻度で加重。
 *   - ε は両者の大きい方。$ 単位と bb 単位の両方を返す。
 *
 * カードリムーバル込みの厳密なゲームで測るため、`comboWeight` を渡すことを推奨。
 */
export interface ExploitabilityResult {
  /** SB 側 exploitability（$）。 */
  readonly sbDollar: number;
  /** BB 側 exploitability（$）。 */
  readonly bbDollar: number;
  /** SB 側 exploitability（bb）。 */
  readonly sbBb: number;
  /** BB 側 exploitability（bb）。 */
  readonly bbBb: number;
  /** ε = max(SB, BB)（bb）。 */
  readonly epsilonBb: number;
  /** ε = max(SB, BB)（$）。 */
  readonly epsilonDollar: number;
}

export function huNashExploitability(
  input: HUNashInput,
  profile: {
    readonly sbPushFreq: ReadonlyMap<HandLabel, number>;
    readonly bbCallFreq: ReadonlyMap<HandLabel, number>;
  },
): ExploitabilityResult {
  const game = buildHUGame(input);
  const { allHands } = input;
  const n = game.n;

  const sbProb = new Array<number>(n);
  const bbProb = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const h = allHands[i]!;
    sbProb[i] = profile.sbPushFreq.get(h) ?? 0;
    bbProb[i] = profile.bbCallFreq.get(h) ?? 0;
  }

  let sbDollar = 0;
  let bbDollar = 0;
  for (let hi = 0; hi < n; hi++) {
    const evPush = game.pushEvSb(hi, bbProb);
    const evFold = game.evFoldSb;
    const best = Math.max(evPush, evFold);
    const cur = sbProb[hi]! * evPush + (1 - sbProb[hi]!) * evFold;
    sbDollar += game.prior[hi]! * (best - cur);
  }
  for (let vi = 0; vi < n; vi++) {
    const { ev: evCall, pushFrac } = game.callEvBb(vi, sbProb);
    const evFold = game.evFoldBb;
    const best = Math.max(evCall, evFold);
    const cur = bbProb[vi]! * evCall + (1 - bbProb[vi]!) * evFold;
    // BB は SB が push してきたときのみ行動する → pushFrac で加重
    bbDollar += game.prior[vi]! * pushFrac * (best - cur);
  }

  const sbBb = sbDollar / game.chipSlopeSb;
  const bbBb = bbDollar / game.chipSlopeBb;
  return {
    sbDollar,
    bbDollar,
    sbBb,
    bbBb,
    epsilonBb: Math.max(sbBb, bbBb),
    epsilonDollar: Math.max(sbDollar, bbDollar),
  };
}

/**
 * HU push/fold ナッシュ均衡を解く（ICM 反映）。
 *
 * アルゴリズム（Fictitious Play）:
 *   1. SB push prob = 1（any-two push）、BB call prob = 0（empty）で初期化。
 *   2. 各 iteration で、両者が相手の「平均戦略」に対する best response（binary）を
 *      同時に計算し、平均化更新 prob = (1-lr)*prob + lr*BR（lr = 1/(t+1)）。
 *      これにより prob は best response の時間平均となり、その exploitability は
 *      理論上 ε→0 に収束する。
 *   3. 実測 exploitability（bb 換算）が tolerance 未満になったら早期終了。
 *
 * 混合戦略: 境界（無差別）ハンドの頻度は frequency map に保持される。
 */
export function solveHUNash(input: HUNashInput): HUNashResult {
  const {
    allHands,
    maxIterations = DEFAULT_MAX_ITER,
    convergenceTolerance = DEFAULT_TOLERANCE,
  } = input;

  const game = buildHUGame(input);
  const n = game.n;
  const { evFoldSb, evFoldBb, chipSlopeSb, chipSlopeBb, prior } = game;

  // 確率（0..1）。初期値: SB=1.0 (any-two push), BB=0.0 (empty call)
  const sbPushProb = new Array<number>(n).fill(1.0);
  const bbCallProb = new Array<number>(n).fill(0.0);

  const sbBR = new Array<number>(n);
  const bbBR = new Array<number>(n);

  let iter = 0;
  let converged = false;
  let epsilonBb = Infinity;

  for (iter = 1; iter <= maxIterations; iter++) {
    // 線形平均化 (recency-weighted FP): 重み w_t = t → lr = 2/(t+1)。
    // 一様平均 (1/(t+1)) より収束が速く、near-pure 均衡で ε を短時間で小さくできる。
    const lr = 2.0 / (iter + 1);

    // (a) 両者、相手の「現平均戦略」に対する best response（binary）を同時計算。
    //     同時に、その平均戦略の exploitability（$）を積算する。
    let sbEpsDollar = 0;
    for (let hi = 0; hi < n; hi++) {
      const evPush = game.pushEvSb(hi, bbCallProb);
      sbBR[hi] = evPush > evFoldSb ? 1 : 0;
      const best = evPush > evFoldSb ? evPush : evFoldSb;
      const cur = sbPushProb[hi]! * evPush + (1 - sbPushProb[hi]!) * evFoldSb;
      sbEpsDollar += prior[hi]! * (best - cur);
    }

    let bbEpsDollar = 0;
    for (let vi = 0; vi < n; vi++) {
      const { ev: evCall, pushFrac } = game.callEvBb(vi, sbPushProb);
      bbBR[vi] = evCall > evFoldBb ? 1 : 0;
      const best = evCall > evFoldBb ? evCall : evFoldBb;
      const cur = bbCallProb[vi]! * evCall + (1 - bbCallProb[vi]!) * evFoldBb;
      bbEpsDollar += prior[vi]! * pushFrac * (best - cur);
    }

    epsilonBb = Math.max(sbEpsDollar / chipSlopeSb, bbEpsDollar / chipSlopeBb);

    // (b) 平均化更新（fictitious play）
    for (let i = 0; i < n; i++) {
      sbPushProb[i] = (1 - lr) * sbPushProb[i]! + lr * sbBR[i]!;
      bbCallProb[i] = (1 - lr) * bbCallProb[i]! + lr * bbBR[i]!;
    }

    // (c) 実測 exploitability による収束判定（最低 2 反復は回す）。
    if (iter >= 2 && epsilonBb < convergenceTolerance) {
      converged = true;
      break;
    }
  }

  // 確率 > 0.5 を「レンジに含む」として binary 出力。頻度は map に保持。
  const sbPushRange = new Set<HandLabel>();
  const bbCallRange = new Set<HandLabel>();
  const sbPushFreq = new Map<HandLabel, number>();
  const bbCallFreq = new Map<HandLabel, number>();
  for (let i = 0; i < n; i++) {
    const h = allHands[i]!;
    sbPushFreq.set(h, sbPushProb[i]!);
    bbCallFreq.set(h, bbCallProb[i]!);
    if (sbPushProb[i]! > 0.5) sbPushRange.add(h);
    if (bbCallProb[i]! > 0.5) bbCallRange.add(h);
  }

  return {
    sbPushRange,
    bbCallRange,
    sbPushFreq,
    bbCallFreq,
    iterations: iter,
    converged,
    sbPushPct: sbPushRange.size / allHands.length,
    bbCallPct: bbCallRange.size / allHands.length,
    exploitability: epsilonBb,
  };
}
