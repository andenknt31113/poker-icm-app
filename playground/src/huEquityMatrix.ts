/**
 * HU 169×169 ハンド対決 equity テーブル lookup。
 *
 * `./data/hu-equity-matrix.json` を読み込み、`huEquity(hero, villain)` で
 * Monte Carlo で事前計算済みの値を返す。
 *
 * テーブルが partial の間は欠損セルにヒューリスティック近似（ハンドランクと
 * pair/suited/offsuit から推定）でフォールバックする。Nash ソルバが
 * 退化（全ハンド 0.5 → push 100% / call 0%）しないようにするため。
 */

import huMatrixJson from "./data/hu-equity-matrix.json" with { type: "json" };
import { rankOf, type HandNotation } from "./handRanking.js";

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

/**
 * ヒューリスティック equity 近似（テーブル欠損時の fallback）。
 *
 * - ハンドランク差を sigmoid にかけてベースライン eq を出す
 * - pair vs non-pair なら +/-5% 補正（下位ペアでも 70%+ の vs broadway-low 等を再現）
 * - 同一ランクは 0.5（厳密にはブロッカー差で僅差）
 *
 * 完璧ではないが「強いハンドが勝つ」「pair は強い」「ランク差が equity に効く」
 * という基本性質を満たし、Nash が退化せず妥当なレンジに収束する。
 */
function heuristicEquity(hero: HandNotation, villain: HandNotation): number {
  if (hero === villain) return 0.5;
  const rH = rankOf(hero); // 0=最強, 168=最弱
  const rV = rankOf(villain);
  // -168..+168 のランク差を 0..1 にマップ
  const diff = (rV - rH) / 100; // 100 で割って sigmoid に通す（弱ハンド equity を低く見積もりすぎないため）
  let eq = 1 / (1 + Math.exp(-diff));
  // pair vs non-pair 補正
  const heroIsPair = hero.length === 2;
  const villainIsPair = villain.length === 2;
  if (heroIsPair && !villainIsPair) eq += 0.04;
  else if (!heroIsPair && villainIsPair) eq -= 0.04;
  return Math.max(0.1, Math.min(0.9, eq));
}

/** Hero hand vs villain hand の HU equity (0..1)。 */
export function huEquity(
  hero: HandNotation,
  villain: HandNotation,
): number {
  const row = TABLE[hero];
  if (row && !("trials" in row)) {
    const v = row[villain];
    if (typeof v === "number") return v;
  }
  return heuristicEquity(hero, villain);
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
