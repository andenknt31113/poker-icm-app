import { calculateICM } from "./icm.js";
import type { BubbleFactorInput, BubbleFactorResult } from "./types.js";

/**
 * Bubble Factor (BF) を計算する。
 *
 *   BF = (現在エクイティ − 負け時エクイティ) / (勝ち時エクイティ − 現在エクイティ)
 *
 * チップ数の利得・損失が同じでも、ICM下では「失う $ > 得る $」になる。
 * BF はその比率の指標で、1.0 = チップ ↔ $ がリニア（ヘッズアップなど）、
 * BF が大きいほどタイトに打つべき。
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
  const loss = equityNow - equityLose;

  if (gain <= 0) {
    // 勝っても $ エクイティが増えない（payouts が頭打ち等）。BF は無限大相当。
    return { bf: Number.POSITIVE_INFINITY, equityNow, equityWin, equityLose };
  }

  return {
    bf: loss / gain,
    equityNow,
    equityWin,
    equityLose,
  };
}
