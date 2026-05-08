// テーブル lookup vs ヒューリスティックの値比較
import { tableEquityVsRange } from "../src/equityFromTable.js";
import { approxEquity } from "../src/equityHeuristic.js";
import { topRange, ALL_169_HANDS } from "../src/handRanking.js";

const pcts = [5, 10, 25, 50, 100];

console.log("hand | TopX% | table | heuristic | diff");
console.log("-----|-------|-------|-----------|-----");

let bigDiffs: Array<{ hand: string; pct: number; table: number; heuristic: number; diff: number }> = [];

for (const hand of ALL_169_HANDS) {
  for (const pct of pcts) {
    const r = topRange(pct);
    const t = tableEquityVsRange(hand, r) ?? NaN;
    const h = approxEquity(hand, r);
    const diff = t - h;
    if (Math.abs(diff) > 0.15) bigDiffs.push({ hand, pct, table: t, heuristic: h, diff });
  }
}

bigDiffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
console.log(`\nTotal big diffs (>0.15): ${bigDiffs.length}`);
console.log("\nTop 15 disagreements:");
for (const d of bigDiffs.slice(0, 15)) {
  console.log(
    `  ${d.hand} vs Top${d.pct}%  table=${d.table.toFixed(3)}  heuristic=${d.heuristic.toFixed(3)}  diff=${d.diff > 0 ? "+" : ""}${d.diff.toFixed(3)}`,
  );
}

// サンプル値表示
console.log("\nSamples:");
for (const [hand, pct] of [
  ["AA", 100], ["AA", 25], ["AA", 5],
  ["KK", 5], ["KK", 25], ["KK", 100],
  ["22", 50], ["22", 100],
  ["AKs", 10], ["AKs", 25],
  ["72o", 100], ["72o", 25],
  ["JTs", 25], ["JTs", 50],
] as const) {
  const r = topRange(pct);
  const t = tableEquityVsRange(hand, r) ?? NaN;
  const h = approxEquity(hand, r);
  console.log(`  ${hand} vs Top${pct}%  table=${t.toFixed(3)}  heuristic=${h.toFixed(3)}`);
}
