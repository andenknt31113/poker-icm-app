/**
 * HU 169×169 ハンド対決 equity テーブル lookup。
 *
 * `./data/hu-equity-matrix.json` を読み込み、`huEquity(hero, villain)` で
 * Monte Carlo で事前計算済みの値を返す。
 *
 * テーブルが未生成 / 未登録ハンドの場合は 0.5 を返す（呼び出し側はこれを許容する）。
 */

import huMatrixJson from "./data/hu-equity-matrix.json" with { type: "json" };
import type { HandNotation } from "./handRanking.js";

interface MatrixMeta {
  trials: number;
  generatedAt: string;
  version: number;
  partial?: boolean;
}
interface HUMatrixShape {
  [hero: string]: { [villain: string]: number } | MatrixMeta;
  _meta: MatrixMeta;
}

const TABLE = huMatrixJson as HUMatrixShape;
export const HU_MATRIX_META = TABLE._meta;

/** Hero hand vs villain hand の HU equity (0..1)。テーブル未登録時は 0.5。 */
export function huEquity(
  hero: HandNotation,
  villain: HandNotation,
): number {
  const row = TABLE[hero];
  if (!row || "trials" in row) return 0.5;
  const v = row[villain];
  return typeof v === "number" ? v : 0.5;
}

/** テーブルが正常にロードできているかの簡易チェック。 */
export function hasHUMatrix(): boolean {
  let count = 0;
  for (const k of Object.keys(TABLE)) {
    if (k !== "_meta") count++;
    if (count > 0) break;
  }
  return count > 0;
}
