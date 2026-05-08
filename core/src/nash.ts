/**
 * HU (heads-up) push/fold ナッシュ均衡ソルバ（ICM 反映）。
 *
 * 概要:
 *   - SB（hero）が all-in push するか fold するかを各ハンドで決める。
 *   - BB（villain）は SB の push に対して call するか fold するかを各ハンドで決める。
 *   - 反復応答 (best response) を交互に回して固定点（ナッシュ均衡）に収束させる。
 *   - 全ての終端 EV は ICM ($エクイティ) で評価する。これにより BF/ICM 圧が自然に反映される。
 *
 * 簡略化:
 *   - 各ハンド（pair / suited / offsuit）は組合せ数で重み付け。
 *   - カードリムーバル（ブロッカー効果）は huEquity 関数側に MC で大筋反映済み前提で簡略化。
 *   - 「Pure な push/fold 均衡」のみを求め、混合戦略は扱わない（境界ハンドは EV 比較で決定）。
 */

import { calculateICM } from "./icm.js";
import type { Payouts, Stacks } from "./types.js";

/** 表記は文字列にしておき、上位コードで HandNotation を流し込む。 */
export type HandLabel = string;

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
  /** 反復回数の上限（既定 100）。 */
  readonly maxIterations?: number;
  /** 収束判定の閾値（レンジ差 / 169。既定 0.001）。 */
  readonly convergenceTolerance?: number;
}

export interface HUNashResult {
  /** SB のプッシュレンジ（push する hand の集合）。 */
  readonly sbPushRange: ReadonlySet<HandLabel>;
  /** BB のコールレンジ（call する hand の集合）。 */
  readonly bbCallRange: ReadonlySet<HandLabel>;
  /** 反復回数。 */
  readonly iterations: number;
  /** 収束したか（false なら maxIterations 到達）。 */
  readonly converged: boolean;
  /** SB のプッシュレンジサイズ（個数 / 169）。 */
  readonly sbPushPct: number;
  /** BB のコールレンジサイズ（個数 / 169）。 */
  readonly bbCallPct: number;
}

const DEFAULT_MAX_ITER = 100;
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

/** Set 同士の対称差サイズ。 */
function symmetricDiffSize<T>(
  a: ReadonlySet<T>,
  b: ReadonlySet<T>,
): number {
  let count = 0;
  for (const v of a) if (!b.has(v)) count++;
  for (const v of b) if (!a.has(v)) count++;
  return count;
}

/**
 * HU push/fold ナッシュ均衡を解く（ICM 反映）。
 *
 * アルゴリズム:
 *   1. SB push range = any-two、BB call range = empty で初期化
 *   2. 以下を maxIterations 回繰り返す:
 *      a. BB の現 call range を所与に、SB の各ハンドで EV(push) vs EV(fold) を比較。
 *         push の方が EV 大なら新 push range に入れる。
 *      b. SB の新 push range を所与に、BB の各ハンドで EV(call) vs EV(fold) を比較。
 *         call の方が EV 大なら新 call range に入れる。
 *      c. レンジが前回とほぼ同じになったら（対称差 / 169 < tolerance）収束終了。
 */
export function solveHUNash(input: HUNashInput): HUNashResult {
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
    maxIterations = DEFAULT_MAX_ITER,
    convergenceTolerance = DEFAULT_TOLERANCE,
  } = input;

  // ----- バリデーション -----
  const n = stacks.length;
  if (n < 2) throw new Error("HUNash: プレイヤー数が 2 未満");
  if (sbIndex === bbIndex) {
    throw new Error("HUNash: sbIndex と bbIndex が同じ");
  }
  if (sbIndex < 0 || sbIndex >= n) {
    throw new Error(`HUNash: sbIndex 範囲外 (${sbIndex})`);
  }
  if (bbIndex < 0 || bbIndex >= n) {
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

  // ante は実際には全員から取るが、SB/BB のリスクが減るわけではない。
  // SB の実プット額 = sb（ante は別途引かれる）。
  // ICM 評価時は「SB/BB から ante 分も既に控除済み」のスタックで考える。

  const playerCount = n;
  // ante 全員分の dead money（all-in 終結時に勝者が得る部分）
  const totalAnte = ante * playerCount;

  // 全プレイヤーから ante 控除した「ハンド開始時」のスタック
  const baseStacks: number[] = stacks.map((s, i) => {
    if (i === sbIndex || i === bbIndex) {
      // SB/BB は ante も blinds も控除
      return s - ante;
    }
    return s - ante;
  });

  // SB/BB から blinds をさらに控除した「ハンドプレイ前」のチップ。
  // ※ blinds は pot に入っており、最終的に勝者へ。
  const sbBaseAfterBlind = baseStacks[sbIndex]! - sb;
  const bbBaseAfterBlind = baseStacks[bbIndex]! - bb;
  if (sbBaseAfterBlind < 0) {
    throw new Error("HUNash: SB の支払い後スタックが負");
  }
  if (bbBaseAfterBlind < 0) {
    throw new Error("HUNash: BB の支払い後スタックが負");
  }

  // 両者 all-in 時の matched 額（pot に入る各プレイヤーの total commitment）。
  // = min(baseStacks[sb], baseStacks[bb]) = 短いスタックの全 chip。
  // ※ 旧 effRemaining = min(sbBaseAfterBlind, bbBaseAfterBlind) はブラインド非対称時に
  //   matched と 0.5 BB ずれて chip conservation を歪める（SB 負け時に 0 → 0.5 BB の幻 dust）。
  const matched = Math.min(baseStacks[sbIndex]!, baseStacks[bbIndex]!);

  // ===== 終端 ICM 評価ヘルパ =====
  // 任意の (sbStack, bbStack) を所与に、その他のスタックは baseStacks のまま ICM を評価し、
  // SB と BB の $ エクイティを返す。
  function icmAt(sbStack: number, bbStack: number): { sbEq: number; bbEq: number } {
    const s: number[] = baseStacks.slice();
    s[sbIndex] = Math.max(0, sbStack);
    s[bbIndex] = Math.max(0, bbStack);
    const eq = calculateICM(s, payouts);
    return { sbEq: eq[sbIndex]!, bbEq: eq[bbIndex]! };
  }

  // ----- 各終端のスタック -----

  // (1) SB folds: BB がポット全部（SB blind + 全員のアンティ）を回収。
  //   SB stack = baseStacks[sb] - sb
  //   BB stack = baseStacks[bb] + sb + totalAnte
  const foldSbStack = baseStacks[sbIndex]! - sb;
  const foldBbStack = baseStacks[bbIndex]! + sb + totalAnte;
  const foldICM = icmAt(foldSbStack, foldBbStack);

  // (2) SB pushes, BB folds: SB は BB blind と ante (dead money) を回収する。
  //   厳密には SB は sb だけ pot に入れ、BB は bb だけ入れていた。
  //   BB がフォールドすると SB は bb (BB の blind) と totalAnte (全員の ante) を取る。
  //   SB の最終スタック = baseStacks[sb] + bb + totalAnte (※ ante はもう支払い済みなので、
  //   ここで totalAnte を加算するのは「dead money 回収」に相当)
  //   BB の最終スタック = baseStacks[bb] - bb
  const stealSbStack = baseStacks[sbIndex]! + bb + totalAnte;
  const stealBbStack = baseStacks[bbIndex]! - bb;
  const stealICM = icmAt(stealSbStack, stealBbStack);

  // (3) SB pushes, BB calls. SB が勝ち。
  //   両者 matched chip ずつ commit。pot = 2×matched + totalAnte。
  //   勝者は (自分の余剰 = baseStacks - matched) + pot を取る。
  //   = baseStacks[winner] - matched + 2×matched + totalAnte = baseStacks[winner] + matched + totalAnte
  //   敗者は baseStacks[loser] - matched が残る（短い側なら 0、長い側なら正の余剰）。
  const winSbStack = baseStacks[sbIndex]! + matched + totalAnte;
  const winBbStack = baseStacks[bbIndex]! - matched;
  const winICM = icmAt(winSbStack, winBbStack);

  // (4) SB pushes, BB calls. BB が勝ち。SB と BB を逆に。
  const loseSbStack = baseStacks[sbIndex]! - matched;
  const loseBbStack = baseStacks[bbIndex]! + matched + totalAnte;
  const loseICM = icmAt(loseSbStack, loseBbStack);

  // ===== ハンドの組合せ重み =====
  const weights: { hand: HandLabel; w: number }[] = allHands.map((h) => ({
    hand: h,
    w: comboCount(h),
  }));
  const totalCombos = weights.reduce((a, x) => a + x.w, 0);

  // ===== Fictitious Play (混合戦略の平均化更新) =====
  // 各ハンドの push/call 確率を実数で持ち、毎 iter で best response (binary 0/1) を計算、
  // 学習率 lr で平均化更新: prob = (1 - lr) * prob + lr * best_response
  // pure best response の振動を抑え、HU push/fold の真の Nash 均衡（ほぼ pure）に収束する。

  // ハンドのインデックスマップ
  const handIndex = new Map<HandLabel, number>(
    allHands.map((h, i) => [h, i] as const),
  );
  const handCombo = allHands.map((h) => comboCount(h));

  // 確率（0..1）。初期値: SB=1.0 (any-two push), BB=0.0 (empty call)
  const sbPushProb = new Array<number>(allHands.length).fill(1.0);
  const bbCallProb = new Array<number>(allHands.length).fill(0.0);

  // huEquity をキャッシュ（同じセルを毎iter何度も叩くため）
  const equityCache = new Float32Array(allHands.length * allHands.length);
  const equityCached = new Uint8Array(allHands.length * allHands.length);
  function cachedEq(hi: number, vi: number): number {
    const idx = hi * allHands.length + vi;
    if (!equityCached[idx]) {
      equityCache[idx] = huEquity(allHands[hi]!, allHands[vi]!);
      equityCached[idx] = 1;
    }
    return equityCache[idx]!;
  }

  let iter = 0;
  let converged = false;

  for (iter = 1; iter <= maxIterations; iter++) {
    const lr = 1.0 / (iter + 1); // 古典 fictitious play の learning rate (1/(t+1))

    // BB call の混合 weight 合計
    let bbCallW = 0;
    for (let i = 0; i < allHands.length; i++) bbCallW += handCombo[i]! * bbCallProb[i]!;
    const bbFoldW = totalCombos - bbCallW;

    // (a) SB best response (binary 0/1) given current bbCallProb
    const evFoldSb = foldICM.sbEq;
    const sbBR = new Array<number>(allHands.length);
    for (let hi = 0; hi < allHands.length; hi++) {
      let evPush = (bbFoldW / totalCombos) * stealICM.sbEq;
      if (bbCallW > 0) {
        let sdSum = 0;
        for (let vi = 0; vi < allHands.length; vi++) {
          const cp = bbCallProb[vi]!;
          if (cp <= 0) continue;
          const w = handCombo[vi]! * cp;
          const heq = cachedEq(hi, vi);
          sdSum += w * (heq * winICM.sbEq + (1 - heq) * loseICM.sbEq);
        }
        evPush += sdSum / totalCombos;
      }
      sbBR[hi] = evPush > evFoldSb ? 1 : 0;
    }

    // SB push の混合 weight 合計（NEW best response）
    let sbPushW = 0;
    for (let i = 0; i < allHands.length; i++) sbPushW += handCombo[i]! * sbBR[i]!;

    // (b) BB best response given SB's NEW best response (binary 0/1)
    const evFoldBb = stealICM.bbEq;
    const bbBR = new Array<number>(allHands.length);
    if (sbPushW === 0) {
      for (let i = 0; i < allHands.length; i++) bbBR[i] = 0;
    } else {
      for (let vi = 0; vi < allHands.length; vi++) {
        let sdSum = 0;
        for (let hi = 0; hi < allHands.length; hi++) {
          const pp = sbBR[hi]!;
          if (pp <= 0) continue;
          const w = handCombo[hi]! * pp;
          const sbWin = cachedEq(hi, vi);
          sdSum += w * (sbWin * winICM.bbEq + (1 - sbWin) * loseICM.bbEq);
        }
        const evCall = sdSum / sbPushW;
        bbBR[vi] = evCall > evFoldBb ? 1 : 0;
      }
    }

    // (c) 平均化更新 (fictitious play): prob = (1-lr)*prob + lr*BR
    let maxDelta = 0;
    for (let i = 0; i < allHands.length; i++) {
      const newSb = (1 - lr) * sbPushProb[i]! + lr * sbBR[i]!;
      const newBb = (1 - lr) * bbCallProb[i]! + lr * bbBR[i]!;
      const dSb = Math.abs(newSb - sbPushProb[i]!);
      const dBb = Math.abs(newBb - bbCallProb[i]!);
      if (dSb > maxDelta) maxDelta = dSb;
      if (dBb > maxDelta) maxDelta = dBb;
      sbPushProb[i] = newSb;
      bbCallProb[i] = newBb;
    }

    // 収束: 全ハンドの確率変化が tolerance 未満
    if (maxDelta < convergenceTolerance) {
      converged = true;
      break;
    }
  }

  // 確率 > 0.5 を「レンジに含む」として binary 出力
  const sbPushRange = new Set<HandLabel>();
  const bbCallRange = new Set<HandLabel>();
  for (let i = 0; i < allHands.length; i++) {
    if (sbPushProb[i]! > 0.5) sbPushRange.add(allHands[i]!);
    if (bbCallProb[i]! > 0.5) bbCallRange.add(allHands[i]!);
  }

  // handIndex は使わないので破棄させる（lint 抑制 + 将来の混合戦略出力用予約）
  void handIndex;

  return {
    sbPushRange,
    bbCallRange,
    iterations: iter,
    converged,
    sbPushPct: sbPushRange.size / allHands.length,
    bbCallPct: bbCallRange.size / allHands.length,
  };
}
