/**
 * 2026-11-13 監査: こちらのソルバの答えと HRC (無料 Nash ICM 計算) の答えを、同じ採点器
 * (_nash_regret.mts: 実カードのシミュレーション) にかけて、どちらが均衡に近いかを比べる。
 *
 * 局面: 4 人・CO 17 / BTN 25 / SB 6 / BB 14BB・SB 0.5 / BB 1・アンティなし・賞金 50/30/20。
 * 実行: npx tsx playground/scripts/_audit_regret_2026_11_13.mts [trials=3000000]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setThreeWayTable } from "../src/threeWay.js";
import { createNashChain } from "../src/nashRange.js";
import { comboPctOfRange } from "../src/handRanking.js";
import { parseRange, scoreStrategy, type Spot, type Strategy } from "./_nash_regret.mts";

setThreeWayTable(new Uint8Array(readFileSync(fileURLToPath(new URL("../public/three-way-equity.bin", import.meta.url)))));
const trials = Number(process.argv[2]) || 3_000_000;

const spot: Spot = { positions: ["CO", "BTN", "SB", "BB"], stacks: [17, 25, 6, 14], payouts: [50, 30, 20], sb: 0.5, bb: 1 };
const n = spot.stacks.length;
const empty = (): Strategy => ({
  push: new Array(n).fill(undefined),
  call: Array.from({ length: n }, () => new Array(n).fill(undefined)),
  overcall: Array.from({ length: n }, () => Array.from({ length: n }, () => new Array(n).fill(undefined))),
}) as unknown as Strategy;

// ---- こちらのソルバ ----
const ours = empty() as any;
const table = spot.positions.map((position, i) => ({ stack: spot.stacks[i]!, position })) as any;
const chain = createNashChain(table, spot.payouts, spot.sb, spot.bb, 0)!;
for (let r = chain.next(); r; r = chain.next()) {
  ours.push[r.pusherIndex] = r.pushRange;
  for (const c of r.callers) {
    ours.call[r.pusherIndex][c.index] = c.range;
    for (const o of c.overcalls) ours.overcall[r.pusherIndex][c.index][o.index] = o.range;
  }
}

// ---- HRC の結果 (2026-11-13 に取得) ----
const hrc = empty() as any;
hrc.push[0] = parseRange("99+ A2s+ A9o+ A5o-A4o K8s+ K6s KTo+ Q9s+ QTo+ JTs");
hrc.call[0][1] = parseRange("TT+ AKs AKo");
hrc.overcall[0][1][2] = parseRange("AA");
hrc.overcall[0][1][3] = parseRange("AA");
hrc.call[0][2] = parseRange("88+ AJs+ AJo+");
hrc.overcall[0][2][3] = parseRange("99+ AKs AKo");
hrc.call[0][3] = parseRange("QQ+");
hrc.push[1] = parseRange("22+ Qx+ J2s+ J3o+ T2s+ T6o+ 92s+ 96o+ 82s+ 85o+ 73s+ 75o+ 62s+ 65o 52s+ 54o 42s+ 32s");
hrc.call[1][2] = parseRange("55+ A4s+ A7o+ K9s+ KTo+ QTs+");
hrc.overcall[1][2][3] = parseRange("66+ A7s+ A9o+ KTs+ KQo");
hrc.call[1][3] = parseRange("99+ AKs");
hrc.push[2] = parseRange("22+ Kx+ Q2s+ Q4o+ J2s+ J7o+ T4s+ T7o+ 95s+ 97o+ 85s+ 87o 74s+ 76o 64s+ 53s+");
hrc.call[2][3] = parseRange("22+ Ax K2s+ K4o+ Q5s+ Q8o+ J7s+ J9o+ T8s+");

const pct = (r: ReadonlySet<string> | undefined) => (r ? comboPctOfRange(r).toFixed(1) + "%" : "-");
for (const [name, strategy] of [["こちら", ours], ["HRC", hrc]] as const) {
  const rows = scoreStrategy(spot, strategy, trials);
  let sum = 0;
  console.log(`\n== ${name} (押す: CO ${pct(strategy.push[0])} / BTN ${pct(strategy.push[1])} / SB ${pct(strategy.push[2])}) ==`);
  for (const row of rows) {
    sum += row.regretPct;
    console.log(`${row.decision.padEnd(34)} 損 ${row.regretPct.toFixed(4)}%  到達 ${(row.reach * 100).toFixed(1)}%  ${row.worst}`);
  }
  console.log(`合計: 賞金総額の ${sum.toFixed(4)}% (1 ハンドあたり)`);
}
