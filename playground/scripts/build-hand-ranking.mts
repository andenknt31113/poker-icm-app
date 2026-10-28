/**
 * `src/handRanking.ts` の HAND_RANKING (169 ハンドの強さ順) を再生成する。
 *
 * 順位 = vs 全 169 クラス (ランダムハンド) の equity 降順。equity は
 * `hu-equity-matrix.json` をカードリムーバル込みコンボ数で重み付き平均した値
 * (`matrixEquityVsRange`)。同値は現行ランキングの順を保つ。
 *
 *   npx tsx scripts/build-hand-ranking.mts
 *
 * 出力 (8 個/行の配列本体) で handRanking.ts の配列を置き換える。
 * HU マトリクスを再生成したときに実行する。
 */

import { ALL_169_HANDS, HAND_RANKING } from "../src/handRanking.js";
import { matrixEquityVsRange } from "../src/rangeEquity.js";

const HANDS_PER_LINE = 8;

const all = new Set(ALL_169_HANDS);
const eq = new Map(ALL_169_HANDS.map((h) => [h, matrixEquityVsRange(h, all)] as const));
const sorted = [...ALL_169_HANDS].sort(
  (a, b) => eq.get(b)! - eq.get(a)! || HAND_RANKING.indexOf(a) - HAND_RANKING.indexOf(b),
);

const lines: string[] = [];
for (let i = 0; i < sorted.length; i += HANDS_PER_LINE) {
  lines.push("  " + sorted.slice(i, i + HANDS_PER_LINE).map((h) => JSON.stringify(h)).join(", ") + ",");
}
console.log(lines.join("\n"));
