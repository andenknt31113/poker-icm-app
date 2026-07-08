import { calculateICM } from "./icm.js";
import type { Payouts, Stacks } from "./types.js";
import type { PotOddsPosition } from "./potOdds.js";

/**
 * 厳密 ICM による call/fold 必要勝率の計算。
 *
 * `calculateBubbleFactor` + `calculateRequiredEquity` は「実効スタックの対称
 * フリップ」から求めた汎用 BF を線形化した近似式 ($EV = risk*BF / (risk*BF+return))
 * であり、境界付近では厳密値と 1〜2% ずれることがある。
 * こちらは 3 つの終端（fold / call-win / call-lose）それぞれで実際に ICM を解き、
 *
 *   requiredEquity = (Efold − Elose) / (Ewin − Elose)
 *
 * から必要勝率を直接求める（線形化を経由しない）。
 *
 * 前提 (BB ante 構造):
 *   - BB が ante を全額負担する。したがって heroPosition か villainPosition の
 *     どちらかが "BB" である必要がある（ante の負担者を特定するため）。
 *   - practice では hero は常に BB として呼ばれるが、関数自体は heroPosition /
 *     villainPosition を尊重するため一般化されている。
 *   - SB を務めるプレイヤーが hero/villain のどちらでもない場合、その SB は
 *     「dead（no-fold-equity 前提: すでに他家に降りられていて matched に参加しない）」
 *     として扱う。
 */
export interface ExactCallEquityInput {
  /** ハンド開始時点の全員のスタック。 */
  readonly stacks: Stacks;
  readonly payouts: Payouts;
  readonly heroIndex: number;
  readonly villainIndex: number;
  /** hero のポジション (SB / BB / その他)。 */
  readonly heroPosition: PotOddsPosition;
  /** villain のポジション (SB / BB / その他)。 */
  readonly villainPosition: PotOddsPosition;
  /**
   * SB を務めるプレイヤーの index。
   * hero/villain のどちらかが SB なら、その index を渡しても渡さなくても良い
   * （どちらでも同じ結果になる）。テーブルに SB がいない/該当なしなら省略可。
   */
  readonly sbPlayerIndex?: number;
  /** SB blind 額。 */
  readonly sb: number;
  /** BB blind 額。 */
  readonly bb: number;
  /** ante 合計 (BB ante 構造のため BB が全額負担)。 */
  readonly ante: number;
}

export interface ExactCallEquityResult {
  /** 厳密必要勝率 (0..1)。分母が 0 以下 (勝っても $ が増えない) の場合は 1。 */
  readonly requiredEquity: number;
  /** fold した場合の hero $ エクイティ。 */
  readonly equityFold: number;
  /** call して勝った場合の hero $ エクイティ。 */
  readonly equityWin: number;
  /** call して負けた場合の hero $ エクイティ。 */
  readonly equityLose: number;
  /** fold 終端での全員のスタック (表示用)。 */
  readonly stacksFold: Stacks;
  /** call-win 終端での全員のスタック (表示用)。 */
  readonly stacksWin: Stacks;
  /** call-lose 終端での全員のスタック (表示用)。 */
  readonly stacksLose: Stacks;
}

function liveCommit(pos: PotOddsPosition, sb: number, bb: number): number {
  if (pos === "SB") return sb;
  if (pos === "BB") return bb;
  return 0;
}

export function calculateExactCallEquity(
  input: ExactCallEquityInput,
): ExactCallEquityResult {
  const {
    stacks,
    payouts,
    heroIndex,
    villainIndex,
    heroPosition,
    villainPosition,
    sbPlayerIndex,
    sb,
    bb,
    ante,
  } = input;

  if (heroIndex === villainIndex) {
    throw new Error("ExactCallEquity: hero と villain が同じ index です");
  }
  if (heroIndex < 0 || heroIndex >= stacks.length) {
    throw new Error(`ExactCallEquity: heroIndex が範囲外です: ${heroIndex}`);
  }
  if (villainIndex < 0 || villainIndex >= stacks.length) {
    throw new Error(
      `ExactCallEquity: villainIndex が範囲外です: ${villainIndex}`,
    );
  }
  if (sb < 0 || bb < 0 || ante < 0) {
    throw new Error("ExactCallEquity: blind/ante は非負である必要があります");
  }
  if (heroPosition !== "BB" && villainPosition !== "BB") {
    // ante 負担者 (BB ante 構造) を hero/villain のどちらかから特定できないと
    // dead money の計算が不定になる。practice では hero は常に BB。
    throw new Error(
      "ExactCallEquity: heroPosition か villainPosition のどちらかが BB である必要があります",
    );
  }

  const heroStack = stacks[heroIndex]!;
  const villainStack = stacks[villainIndex]!;

  // BB ante 構造: BB が ante 全額を払う → その live stack は ante 分減る
  const heroAntePaid = heroPosition === "BB" ? ante : 0;
  const villainAntePaid = villainPosition === "BB" ? ante : 0;

  const heroLive = heroStack - heroAntePaid;
  const villainLive = villainStack - villainAntePaid;
  const matched = Math.min(heroLive, villainLive);

  const heroBlind = liveCommit(heroPosition, sb, bb);

  // SB が hero/villain どちらでもない第三者なら、その SB は dead money になる
  const sbIsThirdParty =
    sbPlayerIndex !== undefined &&
    sbPlayerIndex >= 0 &&
    sbPlayerIndex !== heroIndex &&
    sbPlayerIndex !== villainIndex;
  const sbDead = sbIsThirdParty ? sb : 0;
  // ante は BB ante 構造上つねに dead money (誰の commit でもない)
  const dead = sbDead + ante;

  const pot = 2 * matched + dead;

  const applyThirdPartySb = (arr: number[]): void => {
    if (sbIsThirdParty) {
      arr[sbPlayerIndex!] = stacks[sbPlayerIndex!]! - sb;
    }
  };

  // fold: hero が降りる → villain が無競争で pot を獲得
  const stacksFold = stacks.slice();
  stacksFold[heroIndex] = heroLive - heroBlind;
  stacksFold[villainIndex] = villainLive + heroBlind + dead;
  applyThirdPartySb(stacksFold);

  // call して勝ち
  const stacksWin = stacks.slice();
  stacksWin[heroIndex] = heroLive - matched + pot;
  stacksWin[villainIndex] = villainLive - matched;
  applyThirdPartySb(stacksWin);

  // call して負け
  const stacksLose = stacks.slice();
  stacksLose[heroIndex] = heroLive - matched;
  stacksLose[villainIndex] = villainLive - matched + pot;
  applyThirdPartySb(stacksLose);

  const equityFold = calculateICM(stacksFold, payouts)[heroIndex]!;
  const equityWin = calculateICM(stacksWin, payouts)[heroIndex]!;
  const equityLose = calculateICM(stacksLose, payouts)[heroIndex]!;

  const denom = equityWin - equityLose;
  // 勝っても $ エクイティが増えない (payouts 頭打ち / サテライトロック等):
  // どんな勝率でも call は損なので、必要勝率は 100% (絶対 fold)。
  const requiredEquity = denom <= 0 ? 1 : (equityFold - equityLose) / denom;

  return {
    requiredEquity,
    equityFold,
    equityWin,
    equityLose,
    stacksFold,
    stacksWin,
    stacksLose,
  };
}
