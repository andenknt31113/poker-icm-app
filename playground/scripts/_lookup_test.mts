// テーブル lookup の動作確認
import { tableEquityVsTop, tableEquityVsRange, EQUITY_TABLE_META } from "../src/equityFromTable.js";
import { topRange } from "../src/handRanking.js";

console.log("Meta:", EQUITY_TABLE_META);

const cases: Array<[string, number]> = [
  ["AA", 100],
  ["KK", 5],
  ["22", 50],
  ["AKs", 10],
  ["72o", 100],
];

console.log("\n--- tableEquityVsTop ---");
for (const [hand, pct] of cases) {
  const v = tableEquityVsTop(hand, pct);
  console.log(`${hand} vs Top${pct}% = ${v}`);
}

console.log("\n--- tableEquityVsRange (using topRange as a sanity check) ---");
for (const [hand, pct] of cases) {
  const r = topRange(pct);
  const v = tableEquityVsRange(hand, r);
  console.log(`${hand} vs topRange(${pct}) [${r.size} hands] = ${v}`);
}

// カスタムレンジ例: ハイポケのみ
console.log("\n--- カスタムレンジ ---");
const premium = new Set(["AA", "KK", "QQ"]);
console.log(`AKs vs {AA,KK,QQ} = ${tableEquityVsRange("AKs", premium)}`);
const trash = new Set(["72o", "32o", "82o"]);
console.log(`AA vs {72o,32o,82o} = ${tableEquityVsRange("AA", trash)}`);
