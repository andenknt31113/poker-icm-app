#!/usr/bin/env node
// 2つのスナップショット JSON を画面ごとに完全一致比較する。
import { readFileSync } from "node:fs";

const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error("usage: node e2e/compare-snapshots.mjs <baseline.json> <branch.json>");
  process.exit(1);
}
// 正規化: (1) 追加した i18n 配線属性は表示に影響しないので除去、
//         (2) Nash solve の実測 ms はビルド間で変わるため伏せる
function normalize(s) {
  return s
    .replace(/ data-i18n(-attr|-html)?="[^"]*"/g, "")
    .replace(/\d+ ms/g, "<MS> ms");
}
function load(p) {
  const o = JSON.parse(readFileSync(p, "utf8"));
  for (const k of Object.keys(o)) o[k] = normalize(o[k]);
  return o;
}
const a = load(aPath);
const b = load(bPath);

const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
let diffs = 0;
for (const k of keys) {
  if (a[k] === undefined) { console.log(`+ branch のみ: ${k}`); diffs++; continue; }
  if (b[k] === undefined) { console.log(`- baseline のみ: ${k}`); diffs++; continue; }
  if (a[k] !== b[k]) {
    diffs++;
    console.log(`\n### DIFF: ${k}`);
    // 最初の相違位置を示す
    const av = a[k], bv = b[k];
    let i = 0;
    while (i < av.length && i < bv.length && av[i] === bv[i]) i++;
    const ctx = 80;
    console.log(`  baseline[${i}..]: ${JSON.stringify(av.slice(Math.max(0, i - 20), i + ctx))}`);
    console.log(`  branch  [${i}..]: ${JSON.stringify(bv.slice(Math.max(0, i - 20), i + ctx))}`);
  }
}
if (diffs === 0) {
  console.log(`✓ 完全一致: ${keys.length} 画面すべてで差分なし`);
  process.exit(0);
} else {
  console.log(`\n✗ ${diffs} 画面で差分あり`);
  process.exit(1);
}
