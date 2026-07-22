/**
 * 高精度 equity テーブルの検証スクリプト（生成後の QC）。
 *
 *   npx tsx scripts/_verify_precision.mts <old-hu.json> <old-table.json>
 *
 * - 対称性 / 既知値: HU マトリクスの MC 値を厳密列挙(exact)と突き合わせ、|MC-exact| を報告。
 * - 旧テーブルとの差分統計: 平均|Δ| / 最大Δ / Δ>1pt のセル数。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_169_HANDS } from "../src/handRanking.js";
import { combosForHand } from "./_mc.mjs";
import { evaluate7 } from "./_fastEval.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HU_PATH = path.resolve(__dirname, "../src/data/hu-equity-matrix.json");
const TABLE_PATH = path.resolve(__dirname, "../src/data/equity-table.json");

type AnyTable = Record<string, any>;
const load = (p: string): AnyTable => JSON.parse(fs.readFileSync(p, "utf8"));

/** 上三角のみ格納された HU テーブルから、対称性で任意方向を引く。 */
function huLookup(t: AnyTable, a: string, b: string): number | null {
  const ra = t[a];
  if (ra && typeof ra[b] === "number") return ra[b];
  const rb = t[b];
  if (rb && typeof rb[a] === "number") return 1 - rb[a];
  return null;
}

/** ハンドクラス hero vs villain の厳密 equity（全コンボ×全 board 列挙）。 */
function exactClassEquity(hero: string, villain: string): number {
  const heroCombos = combosForHand(hero);
  const vilCombos = combosForHand(villain);
  let wins = 0;
  let boards = 0;
  const hero7 = new Int32Array(7);
  const vil7 = new Int32Array(7);
  for (const h of heroCombos) {
    for (const v of vilCombos) {
      if (h[0] === v[0] || h[0] === v[1] || h[1] === v[0] || h[1] === v[1]) continue;
      const used = new Uint8Array(52);
      used[h[0]] = 1; used[h[1]] = 1; used[v[0]] = 1; used[v[1]] = 1;
      const rem: number[] = [];
      for (let c = 0; c < 52; c++) if (!used[c]) rem.push(c);
      hero7[0] = h[0]; hero7[1] = h[1]; vil7[0] = v[0]; vil7[1] = v[1];
      const n = rem.length;
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++)
          for (let c = b + 1; c < n; c++)
            for (let d = c + 1; d < n; d++)
              for (let e = d + 1; e < n; e++) {
                hero7[2] = rem[a]!; hero7[3] = rem[b]!; hero7[4] = rem[c]!; hero7[5] = rem[d]!; hero7[6] = rem[e]!;
                vil7[2] = rem[a]!; vil7[3] = rem[b]!; vil7[4] = rem[c]!; vil7[5] = rem[d]!; vil7[6] = rem[e]!;
                const hf = evaluate7(hero7);
                const vf = evaluate7(vil7);
                wins += hf > vf ? 1 : hf === vf ? 0.5 : 0;
                boards++;
              }
    }
  }
  return wins / boards;
}

function main(): void {
  const [oldHuPath, oldTablePath] = process.argv.slice(2);
  const hu = load(HU_PATH);
  const table = load(TABLE_PATH);

  console.log("=== HU マトリクス _meta ===");
  console.log(JSON.stringify(hu._meta));
  console.log("=== equity-table _meta ===");
  console.log(JSON.stringify(table._meta));

  // ---- 1) 既知値: MC vs 厳密列挙 ----
  console.log("\n=== HU: MC 値 vs 厳密列挙 (|Δ|) ===");
  const spot: Array<[string, string]> = [
    ["AA", "22"], ["AA", "KK"], ["AKs", "QQ"], ["AKo", "AKs"],
    ["72o", "AA"], ["JJ", "AKs"], ["QQ", "AKo"], ["55", "A5s"],
    ["KK", "QQ"], ["T9s", "AKo"], ["98s", "22"], ["A2s", "KQo"],
  ];
  let maxSpot = 0;
  let sumSpot = 0;
  for (const [a, b] of spot) {
    const mc = huLookup(hu, a, b)!;
    const ex = exactClassEquity(a, b);
    const d = Math.abs(mc - ex);
    maxSpot = Math.max(maxSpot, d);
    sumSpot += d;
    console.log(`${a} vs ${b}: MC=${mc.toFixed(4)} exact=${ex.toFixed(5)} |Δ|=${(d * 100).toFixed(3)}pt`);
  }
  console.log(`spot: mean|Δ|=${((sumSpot / spot.length) * 100).toFixed(3)}pt max|Δ|=${(maxSpot * 100).toFixed(3)}pt`);

  // ---- 2) 対称性: ランダムペアで exact と突き合わせ (exact は完全対称なので二重チェック) ----
  console.log("\n=== HU: ランダム 8 ペアで MC vs 厳密 ===");
  let rng = 987654321 >>> 0;
  const rand = (): number => ((rng = (Math.imul(rng ^ (rng >>> 15), rng | 1) + 0x6d2b79f5) >>> 0) / 4294967296);
  let maxRand = 0;
  for (let k = 0; k < 8; k++) {
    const i = Math.floor(rand() * ALL_169_HANDS.length);
    let j = Math.floor(rand() * ALL_169_HANDS.length);
    if (i === j) j = (j + 1) % ALL_169_HANDS.length;
    const a = ALL_169_HANDS[i]!, b = ALL_169_HANDS[j]!;
    const mc = huLookup(hu, a, b)!;
    const ex = exactClassEquity(a, b);
    maxRand = Math.max(maxRand, Math.abs(mc - ex));
    console.log(`${a} vs ${b}: MC=${mc.toFixed(4)} exact=${ex.toFixed(5)} |Δ|=${(Math.abs(mc - ex) * 100).toFixed(3)}pt`);
  }
  console.log(`random: max|Δ|=${(maxRand * 100).toFixed(3)}pt`);

  // ---- 3) 旧テーブルとの差分統計 ----
  if (oldHuPath && fs.existsSync(oldHuPath)) {
    const oldHu = load(oldHuPath);
    let n = 0, sum = 0, max = 0, over1 = 0;
    let maxPair = "";
    const N = ALL_169_HANDS.length;
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const a = ALL_169_HANDS[i]!, b = ALL_169_HANDS[j]!;
        const nv = huLookup(hu, a, b);
        const ov = huLookup(oldHu, a, b);
        if (nv == null || ov == null) continue;
        const d = Math.abs(nv - ov);
        n++; sum += d; if (d > max) { max = d; maxPair = `${a} vs ${b}`; }
        if (d > 0.01) over1++;
      }
    console.log(`\n=== HU: 旧テーブル差分 (${n} ペア) ===`);
    console.log(`mean|Δ|=${((sum / n) * 100).toFixed(3)}pt  max|Δ|=${(max * 100).toFixed(3)}pt (${maxPair})  Δ>1pt=${over1} (${((100 * over1) / n).toFixed(2)}%)`);
  }

  if (oldTablePath && fs.existsSync(oldTablePath)) {
    const oldT = load(oldTablePath);
    let n = 0, sum = 0, max = 0, over1 = 0;
    let maxCell = "";
    for (const hand of ALL_169_HANDS) {
      const nr = table[hand], or = oldT[hand];
      if (!nr || !or) continue;
      for (let pct = 1; pct <= 100; pct++) {
        const nv = nr[String(pct)], ov = or[String(pct)];
        if (typeof nv !== "number" || typeof ov !== "number") continue;
        const d = Math.abs(nv - ov);
        n++; sum += d; if (d > max) { max = d; maxCell = `${hand}@${pct}%`; }
        if (d > 0.01) over1++;
      }
    }
    console.log(`\n=== table: 旧テーブル差分 (${n} セル) ===`);
    console.log(`mean|Δ|=${((sum / n) * 100).toFixed(3)}pt  max|Δ|=${(max * 100).toFixed(3)}pt (${maxCell})  Δ>1pt=${over1} (${((100 * over1) / n).toFixed(2)}%)`);
  }

  // ---- 4) table 既知値スポット + 単調性 ----
  console.log("\n=== table 既知値スポット ===");
  const ts: Array<[string, number]> = [["AA", 100], ["22", 50], ["72o", 100], ["AKs", 10], ["KK", 5]];
  for (const [h, p] of ts) console.log(`${h} vs Top${p}%: ${table[h][String(p)]}`);
}

main();
