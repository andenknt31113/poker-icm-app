/**
 * 事前計算済み equity テーブル (`./data/equity-table.json`) を使った lookup。
 *
 * テーブルは 169 starting hand × Top 1%..100% で生成されている。
 * - `tableEquityVsTop(hand, X)` : Top X% に対する equity を直接 lookup。
 * - `tableEquityVsRange(hand, range)` : 任意レンジに対しては
 *     1) range 内のハンドのランキングを見て、平均ランクから「相当する Top X%」を推定
 *     2) その X% の equity を返す
 *   …という近似で十分（カスタムレンジの希少な使い方なので、精密値は別途 Monte Carlo を走らせる）。
 *
 * テーブル lookup が失敗した（ハンド未登録など）時は `null` を返す。
 * 呼び出し側はその時 `equityHeuristic.approxEquity` にフォールバックする。
 */

import equityTableJson from "./data/equity-table.json" with { type: "json" };
import { rankOf, type HandNotation } from "./handRanking.js";

type EquityRow = { [percent: string]: number };
type EquityTableShape = {
  [hand: string]: EquityRow | { trials: number; generatedAt: string; version: number; partial?: boolean };
  _meta: { trials: number; generatedAt: string; version: number; partial?: boolean };
};

const TABLE = equityTableJson as EquityTableShape;
export const EQUITY_TABLE_META = TABLE._meta;

/** 169 ハンドの総数（topRange と同じ）。 */
const TOTAL_HANDS = 169;

/** Top X% (X は整数 1..100) に対する hand の equity。テーブルにない場合は null。 */
export function tableEquityVsTop(
  hand: HandNotation,
  topPct: number,
): number | null {
  const row = TABLE[hand];
  if (!row || "trials" in row) return null;
  // 1..100 にクランプして整数に
  let pct = Math.round(topPct);
  if (pct < 1) pct = 1;
  if (pct > 100) pct = 100;
  const v = row[String(pct)];
  return typeof v === "number" ? v : null;
}

/**
 * カスタムレンジに対する equity 近似。
 *
 * 戦略:
 *  - レンジ内のハンドの平均ランクを取り、それが「Top X%」のレンジの平均ランクと
 *    最も近くなる X を選んで、テーブルの (hand, X) を返す。
 *  - 単純に「range.size / 169 * 100 = 同等の Top X%」とすると、ランキング上位
 *    に偏ったレンジと下位寄りのレンジを区別できないので、平均ランク近似のほうが筋が良い。
 *
 * テーブル lookup が失敗したら null。
 */
export function tableEquityVsRange(
  hand: HandNotation,
  range: Set<HandNotation>,
): number | null {
  if (range.size === 0) return 0.5;

  // レンジの平均ランク (0=最強, 168=最弱)
  let sum = 0;
  for (const h of range) sum += rankOf(h);
  const avgRangeRank = sum / range.size;

  // Top X% の平均ランク = (X * 169 / 100 - 1) / 2 と近似 (端値 0..(N-1) の平均)
  // X を 1..100 で総当たりし、avgRangeRank に最も近い X を採用
  let bestX = 1;
  let bestDiff = Infinity;
  for (let x = 1; x <= 100; x++) {
    const count = Math.round((TOTAL_HANDS * x) / 100);
    if (count === 0) continue;
    const avgTopRank = (count - 1) / 2;
    const d = Math.abs(avgTopRank - avgRangeRank);
    if (d < bestDiff) {
      bestDiff = d;
      bestX = x;
    }
  }

  return tableEquityVsTop(hand, bestX);
}

/** テーブルが正常にロードできているか（簡易チェック）。 */
export function hasEquityTable(): boolean {
  // _meta 以外に hand キーが存在することを確認
  let count = 0;
  for (const k of Object.keys(TABLE)) {
    if (k !== "_meta") count++;
    if (count > 0) break;
  }
  return count > 0;
}
