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

  // effStack = min(SB, BB) の blinds 控除後の残額。
  // これが「all-in で実際に動くチップ量（自分の bet 全額）」。
  // SB が all-in する時、SB の bet 額 = sb + sbBaseAfterBlind = SB の総スタック - ante.
  // BB がコールする額 = sbBaseAfterBlind + (sb - bb) = SB と同額になるよう調整、
  // ただし BB のスタックを超えない範囲で。
  // 簡単のため effStack = min(sbBaseAfterBlind, bbBaseAfterBlind) としてコールは all-in 前提。
  const effRemaining = Math.min(sbBaseAfterBlind, bbBaseAfterBlind);

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

  // (1) SB folds: SB は SB blind を失う、BB は SB blind を得る。
  //   SB stack = baseStacks[sb] - sb,  BB stack = baseStacks[bb] + sb
  //   ※ ante は dead money として失われる（誰も得ない、payout の一部とは別）。
  //   現実的には ante はラウンド毎にチップが減る扱いで構わない。
  const foldSbStack = baseStacks[sbIndex]! - sb;
  const foldBbStack = baseStacks[bbIndex]! + sb;
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
  //   SB の bet = sb + effRemaining (実プット), BB の bet = bb + effRemaining
  //   勝者が pot を全取り。pot = (SB bet) + (BB bet) + totalAnte
  //   (ただし SB の元スタックから effRemaining 余剰がある場合、それは戻ってこない簡略化:
  //    BB のスタックが小さい場合 SB の超過分は SB に戻すべきだが、ここでは effRemaining を
  //    両者共通の bet 額としているのでこの問題は発生しない。)
  //   SB の最終スタック = baseStacks[sb] - sb - effRemaining + pot
  //                    = baseStacks[sb] + (BB bet) + totalAnte
  //                    = baseStacks[sb] + bb + effRemaining + totalAnte
  //   BB の最終スタック = baseStacks[bb] - bb - effRemaining
  const winSbStack = baseStacks[sbIndex]! + bb + effRemaining + totalAnte;
  const winBbStack = baseStacks[bbIndex]! - bb - effRemaining;
  const winICM = icmAt(winSbStack, winBbStack);

  // (4) SB pushes, BB calls. BB が勝ち。SB と BB を逆に。
  const loseSbStack = baseStacks[sbIndex]! - sb - effRemaining;
  const loseBbStack = baseStacks[bbIndex]! + sb + effRemaining + totalAnte;
  const loseICM = icmAt(loseSbStack, loseBbStack);

  // ===== ハンドの組合せ重み =====
  const weights: { hand: HandLabel; w: number }[] = allHands.map((h) => ({
    hand: h,
    w: comboCount(h),
  }));
  const totalCombos = weights.reduce((a, x) => a + x.w, 0);

  // ===== 反復ベストレスポンス =====
  let sbPushRange: Set<HandLabel> = new Set(allHands); // any-two
  let bbCallRange: Set<HandLabel> = new Set(); // empty

  let iter = 0;
  let converged = false;

  for (iter = 1; iter <= maxIterations; iter++) {
    // ----- (a) SB の各ハンドで push vs fold を判定 -----
    // EV(fold) = SB が SB blind を失った場合の SB の $ エクイティ
    const evFoldSb = foldICM.sbEq;

    // BB の現 call range の重み合計（コールされる確率に対応する分母）
    let bbCallWeight = 0;
    for (const h of bbCallRange) bbCallWeight += comboCount(h);
    const bbFoldWeight = totalCombos - bbCallWeight;

    const newSbPushRange = new Set<HandLabel>();
    for (const heroHand of allHands) {
      // EV(push) = (BB が fold する確率) * stealICM.sbEq
      //          + Σ (BB が call ハンド h_v で call する確率) * showdownEV
      // showdownEV(hero, h_v) = huEquity(hero, h_v) * winICM.sbEq + (1 - huEquity) * loseICM.sbEq

      let evPush = 0;
      // BB fold 部分
      if (bbFoldWeight > 0) {
        evPush += (bbFoldWeight / totalCombos) * stealICM.sbEq;
      }
      // BB call 部分
      if (bbCallWeight > 0) {
        let showdownSum = 0;
        for (const hv of bbCallRange) {
          const w = comboCount(hv);
          const heq = huEquity(heroHand, hv);
          const sdEv = heq * winICM.sbEq + (1 - heq) * loseICM.sbEq;
          showdownSum += w * sdEv;
        }
        evPush += showdownSum / totalCombos;
      }

      if (evPush > evFoldSb) {
        newSbPushRange.add(heroHand);
      }
    }

    // ----- (b) BB の各ハンドで call vs fold を判定 -----
    // SB が push してくる前提。
    // EV(fold) = stealICM.bbEq (BB が降りた=SBがstealしたシナリオ)
    const evFoldBb = stealICM.bbEq;

    // SB の new push range の重み合計
    let sbPushWeight = 0;
    for (const h of newSbPushRange) sbPushWeight += comboCount(h);

    const newBbCallRange = new Set<HandLabel>();

    if (sbPushWeight === 0) {
      // SB が誰も push しないなら BB の判断対象がない（call range は空）
    } else {
      for (const villainHand of allHands) {
        // EV(call) = Σ (SB の push hand h_s) の重み付き平均で
        //   showdownEV_BB(villain, h_s) = (1 - huEquity(h_s, villain)) * winICM.bbEq + huEquity * loseICM.bbEq
        //   ※ winICM.bbEq は SB が勝った時の BB の $ エクイティ
        //   ※ loseICM.bbEq は SB が負けた時の BB の $ エクイティ → これが BB 視点では「BB が勝った」
        //   なので: BB のショーダウン EV = P(BB勝) * loseICM.bbEq + P(BB負) * winICM.bbEq
        //                                = (1 - huEquity(h_s, v)) * loseICM.bbEq + huEquity * winICM.bbEq
        let showdownSum = 0;
        for (const hs of newSbPushRange) {
          const w = comboCount(hs);
          const sbWinProb = huEquity(hs, villainHand);
          const bbEv = sbWinProb * winICM.bbEq + (1 - sbWinProb) * loseICM.bbEq;
          showdownSum += w * bbEv;
        }
        const evCall = showdownSum / sbPushWeight;

        if (evCall > evFoldBb) {
          newBbCallRange.add(villainHand);
        }
      }
    }

    // ----- (c) 収束判定 -----
    const sbDiff = symmetricDiffSize(sbPushRange, newSbPushRange) / allHands.length;
    const bbDiff = symmetricDiffSize(bbCallRange, newBbCallRange) / allHands.length;

    sbPushRange = newSbPushRange;
    bbCallRange = newBbCallRange;

    if (sbDiff < convergenceTolerance && bbDiff < convergenceTolerance) {
      converged = true;
      break;
    }
  }

  return {
    sbPushRange,
    bbCallRange,
    iterations: iter,
    converged,
    sbPushPct: sbPushRange.size / allHands.length,
    bbCallPct: bbCallRange.size / allHands.length,
  };
}
