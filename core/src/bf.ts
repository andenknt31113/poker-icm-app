import { calculateICM } from "./icm.js";
import type { BubbleFactorInput, BubbleFactorResult } from "./types.js";

/**
 * ICM の反復計算に起因する浮動小数点丸め誤差 (実測 ~1e-13 オーダー) を
 * ノイズとして無視するための相対許容量。equityNow の絶対値に対する比率で
 * スケールし、payouts が小さい ($100 サテライト) でも大きい ($10,000 GTD) でも
 * 同じように機能させる。
 */
const EPS = 1e-9;

/**
 * Bubble Factor (BF) を計算する。
 *
 *   BF = (現在エクイティ − 負け時エクイティ) / (勝ち時エクイティ − 現在エクイティ)
 *
 * チップ数の利得・損失が同じでも、ICM下では「失う $ > 得る $」になる。
 * BF はその比率の指標で、1.0 = チップ ↔ $ がリニア（ヘッズアップなど）、
 * BF が大きいほどタイトに打つべき。
 *
 * 均等ペイ (例: サテライトの [33,33,33]) 等では、勝敗どちらでも $ エクイティが
 * 理論上ちょうど変わらないケースがある。ICM の反復計算は浮動小数点なので、
 * 実際には gain (勝ち時の増分) や loss (負け時の減分) が厳密な 0 ではなく
 * ±1e-13 程度のノイズを持つことがある。これを無視せず BF = loss/gain を素朴に
 * 計算すると、gain が微小な負値・loss が微小な負値になる組み合わせで
 * BF が負の有限値という数学的に無意味な結果を生み得る (呼び出し側で例外の原因に
 * なっていた)。そのため:
 *   - gain がノイズ相当以下 (<= EPS) なら「勝っても実質増えない」として Infinity 扱い
 *   - loss が負 (ノイズ由来) なら 0 にクランプする (負けても実質減らない → BF の
 *     分子はゼロ、つまり全くリスクがないという扱いにする)
 * この結果 bf = 0 になり得るが、これは「勝っても負けても $ エクイティが変わらない
 * のでノーリスク」という意味であり、calculateRequiredEquity 側で
 * dollarEV = 0 (=常にコールが正しい) として整合的に扱われる。
 */
export function calculateBubbleFactor(
  input: BubbleFactorInput,
): BubbleFactorResult {
  const { stacks, payouts, heroIndex, villainIndex, riskChips } = input;

  if (heroIndex === villainIndex) {
    throw new Error("BF: hero と villain が同じ index です");
  }
  if (heroIndex < 0 || heroIndex >= stacks.length) {
    throw new Error(`BF: heroIndex が範囲外です: ${heroIndex}`);
  }
  if (villainIndex < 0 || villainIndex >= stacks.length) {
    throw new Error(`BF: villainIndex が範囲外です: ${villainIndex}`);
  }
  if (!Number.isFinite(riskChips) || riskChips <= 0) {
    throw new Error(`BF: riskChips が不正です: ${riskChips}`);
  }
  if (riskChips > stacks[heroIndex]!) {
    throw new Error(
      `BF: riskChips ${riskChips} が hero のスタック ${stacks[heroIndex]} を超えています`,
    );
  }
  if (riskChips > stacks[villainIndex]!) {
    throw new Error(
      `BF: riskChips ${riskChips} が villain のスタック ${stacks[villainIndex]} を超えています`,
    );
  }

  const equityNow = calculateICM(stacks, payouts)[heroIndex]!;

  const winStacks = stacks.slice();
  winStacks[heroIndex] = stacks[heroIndex]! + riskChips;
  winStacks[villainIndex] = stacks[villainIndex]! - riskChips;
  const equityWin = calculateICM(winStacks, payouts)[heroIndex]!;

  const loseStacks = stacks.slice();
  loseStacks[heroIndex] = stacks[heroIndex]! - riskChips;
  loseStacks[villainIndex] = stacks[villainIndex]! + riskChips;
  const equityLose = calculateICM(loseStacks, payouts)[heroIndex]!;

  const gain = equityWin - equityNow;
  const rawLoss = equityNow - equityLose;

  // equityNow の絶対値に対する相対許容量 (最低でも絶対 EPS は確保する)
  const noiseFloor = EPS * Math.max(1, Math.abs(equityNow));

  if (gain <= noiseFloor) {
    // 勝っても $ エクイティが増えない（payouts が頭打ち等、または丸め誤差でゼロ相当）。
    // BF は無限大相当。
    return { bf: Number.POSITIVE_INFINITY, equityNow, equityWin, equityLose };
  }

  // 丸め誤差により loss が負のノイズになることがある。負けて $ エクイティが
  // 増えることは数学的にあり得ないため、0 にクランプする。
  const loss = rawLoss < 0 ? 0 : rawLoss;

  return {
    bf: loss / gain,
    equityNow,
    equityWin,
    equityLose,
  };
}
