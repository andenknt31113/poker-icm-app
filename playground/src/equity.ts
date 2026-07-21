import { approxEquity } from "./equityHeuristic.js";
import { tableEquityVsRange } from "./equityFromTable.js";
import { matrixEquityVsRange, isTopPrefixRange } from "./rangeEquity.js";
import type { HandNotation } from "./handRanking.js";

/**
 * hero ハンドクラスの対レンジ equity。
 *
 * 経路の使い分け:
 *  1. レンジが「強度順の上位ちょうど」(プリセット Top X% の形) → Top X% ごとに
 *     レンジ全体を実際に配って回した MC 事前計算テーブル (最も抽象誤差が小さい)
 *  2. それ以外 (カスタムレンジ) → HU 169×169 マトリクスをカードリムーバル込み
 *     コンボ数で重み付き平均 (旧: 平均ランクから Top X% を推定する粗い近似を置換)
 *  3. どちらも失敗 → ヒューリスティックにフォールバック
 */
export function equity(hand: HandNotation, vsRange: Set<HandNotation>): number {
  if (isTopPrefixRange(vsRange)) {
    const v = tableEquityVsRange(hand, vsRange);
    if (v !== null && Number.isFinite(v)) return v;
  }
  const m = matrixEquityVsRange(hand, vsRange);
  if (Number.isFinite(m)) return m;
  return approxEquity(hand, vsRange);
}
