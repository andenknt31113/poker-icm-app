import { matrixEquityVsRange } from "./rangeEquity.js";
import type { HandNotation } from "./handRanking.js";

/**
 * hero ハンドクラスの対レンジ equity。
 *
 * プリセット (Top X%) もカスタムレンジも、HU 169×169 マトリクスを
 * カードリムーバル込みコンボ数で重み付き平均する (空レンジ含め常に有限値を返す)。
 *
 * 以前はプリセット形だけ Top X% 用の MC 事前計算テーブルを引いていたが、
 * そのテーブルは相手ハンドを 169 クラスから均等に選んでいた (ペア6・スーテッド4・
 * オフスート12 のコンボ数で重み付けしていなかった) ため、正しい値から平均 1pt・
 * 最大 2pt ずれていた。マトリクス経由は正しい重み付けの MC と平均 0.07pt で一致する。
 */
export function equity(hand: HandNotation, vsRange: Set<HandNotation>): number {
  return matrixEquityVsRange(hand, vsRange);
}
