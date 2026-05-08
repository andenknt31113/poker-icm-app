/**
 * ハンド vs レンジの equity を「ヒューリスティック」で推定する。
 *
 * これは MVP 用のプレースホルダ実装。実戦投入する時は、
 * Monte Carlo or 事前計算 equity table に置き換える。
 *
 * モデル:
 *   equity ≈ sigmoid( (avgRank(R) - rank(H)) / 30 )
 *   - rank が小さい (=強い) ほど equity が高い
 *   - 範囲 [0.05, 0.95] にクリップ
 *
 * 既知のアンカー値とのざっくり一致を狙う:
 *   AA vs random      → ≈0.85
 *   22 vs random      → ≈0.50
 *   AKs vs Top 20%    → ≈0.55
 *   72o vs Top 5%     → ≈0.10
 */

import { rankOf, type HandNotation } from "./handRanking.js";

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function approxEquity(hand: HandNotation, vsRange: Set<HandNotation>): number {
  const rH = rankOf(hand);

  // 自分自身が相手レンジに含まれるとブロッカー効果あり、ここでは無視
  if (vsRange.size === 0) return 0.5;

  // レンジ内ハンドの平均ランク
  let sum = 0;
  for (const h of vsRange) sum += rankOf(h);
  const avgRange = sum / vsRange.size;

  // 強さ差を sigmoid で 0..1 に押し込める
  // スケールパラメータ 30 は AA vs random ≈ 0.85 になるよう経験則調整
  const diff = (avgRange - rH) / 30;
  const eq = sigmoid(diff);

  // クリップ
  return Math.max(0.05, Math.min(0.95, eq));
}
