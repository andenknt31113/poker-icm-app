/**
 * Monte Carlo equity 事前計算スクリプト（高精度・並列版）
 *
 * 169 種類の各ハンド H と Top X% (X=1..100) のレンジ R との equity を計算し
 * `playground/src/data/equity-table.json` に書き出す。
 *
 * 高精度化(2026-07):
 *   - 評価器を pokersolver から自作の高速整数評価器 `_fastEval` に変更（pokersolver と
 *     勝敗判定完全一致を 50 万ディールで検証済み、~80倍速）。
 *   - worker_threads で全 CPU コアに並列化。
 *   - 乱数は seedable な mulberry32。シードは (baseSeed, hand index, pct) から決定的に
 *     導出 → 完全に再現可能・resume 安全。
 *   - デフォルト試行数 1,000,000/セル（標準誤差 ~0.05pt）。
 *
 * villain のサンプリング定義は従来テーブルと同一（レンジ内のハンドクラスを一様抽選 →
 * そのクラスのコンボを一様抽選）。
 *
 * 使い方:
 *   npx tsx scripts/build-equity-table.mts                   # trials=1,000,000
 *   npx tsx scripts/build-equity-table.mts --trials 500000
 *   npx tsx scripts/build-equity-table.mts --workers 4 --seed 7
 *   npx tsx scripts/build-equity-table.mts --resume
 *
 * 出力形式:
 *   { "AA": { "1": 0.85, ..., "100": 0.85 }, ..., "_meta": { trials, generatedAt, version } }
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { ALL_169_HANDS, topRange, type HandNotation } from "../src/handRanking.js";
import { combosForHand, computeRangeEquity, mulberry32, deriveSeed } from "./_mc.mjs";

const __filename = fileURLToPath(import.meta.url);
const OUTPUT_PATH = path.resolve(path.dirname(__filename), "../src/data/equity-table.json");

const DEFAULT_TRIALS = 1_000_000;
const DEFAULT_SEED = 0x5eed02;
const PROGRESS_VERSION = 2;
const BATCH_SIZE = 6;
const SAVE_EVERY_CELLS = 400;
const PCTS = 100;

interface EquityMeta {
  trials: number;
  generatedAt: string;
  version: number;
  method?: string;
  partial?: boolean;
}
type Row = { [pct: string]: number };
interface EquityTable {
  [hand: string]: Row | EquityMeta;
  _meta: EquityMeta;
}

// ===== ワーカー =====

interface WorkerData {
  hands: string[];
  trials: number;
  baseSeed: number;
}
type BatchMsg = { type: "batch"; batchId: number; cells: Array<[number, number]> } | { type: "done" };
type ResultMsg = { type: "result"; batchId: number; results: Array<[number, number, number]> };

function runWorker(): void {
  const { hands, trials, baseSeed } = workerData as WorkerData;
  const combos = hands.map((h) => combosForHand(h));
  const comboByHand = new Map<string, ReturnType<typeof combosForHand>>();
  hands.forEach((h, i) => comboByHand.set(h, combos[i]!));
  // pct → villain クラス別コンボ配列 のキャッシュ
  const rangeCache = new Map<number, Array<ReturnType<typeof combosForHand>>>();
  const rangeFor = (pct: number): Array<ReturnType<typeof combosForHand>> => {
    let r = rangeCache.get(pct);
    if (!r) {
      r = Array.from(topRange(pct) as Set<HandNotation>).map((h) => comboByHand.get(h)!);
      rangeCache.set(pct, r);
    }
    return r;
  };

  parentPort!.on("message", (msg: BatchMsg) => {
    if (msg.type === "done") {
      parentPort!.close();
      return;
    }
    const results: Array<[number, number, number]> = [];
    for (const [handIdx, pct] of msg.cells) {
      const rng = mulberry32(deriveSeed(baseSeed, handIdx, pct));
      const eq = computeRangeEquity(combos[handIdx]!, rangeFor(pct), trials, rng);
      results.push([handIdx, pct, Number(eq.toFixed(4))]);
    }
    parentPort!.postMessage({ type: "result", batchId: msg.batchId, results } as ResultMsg);
  });
}

// ===== CLI =====

interface CliArgs {
  trials: number;
  resume: boolean;
  workers: number;
  seed: number;
}
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let trials = DEFAULT_TRIALS;
  let resume = false;
  let workers = Math.max(1, os.availableParallelism?.() ?? os.cpus().length);
  let seed = DEFAULT_SEED;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--trials") trials = requireNum(args[++i], "--trials", 1000);
    else if (a === "--workers") workers = requireNum(args[++i], "--workers", 1);
    else if (a === "--seed") seed = requireNum(args[++i], "--seed", 0);
    else if (a === "--resume") resume = true;
    else if (a === "-h" || a === "--help") {
      console.log("Usage: npx tsx scripts/build-equity-table.mts [--trials N] [--workers N] [--seed N] [--resume]");
      process.exit(0);
    }
  }
  return { trials, resume, workers, seed };
}
function requireNum(v: string | undefined, flag: string, min: number): number {
  if (v === undefined) throw new Error(`${flag} の後ろに数値が必要`);
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new Error(`${flag} は ${min} 以上の数値: ${v}`);
  return n;
}

// ===== 出力 =====

function loadExisting(): EquityTable | null {
  if (!fs.existsSync(OUTPUT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")) as EquityTable;
  } catch (e) {
    console.warn("既存ファイル読み込み失敗。最初から計算します。", e);
    return null;
  }
}
function saveTable(table: EquityTable): void {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(table) + "\n", "utf8");
}
function isRow(v: Row | EquityMeta | undefined): v is Row {
  return v !== undefined && typeof v === "object" && !("trials" in v);
}

// ===== メイン =====

async function main(): Promise<void> {
  const { trials, resume, workers, seed } = parseArgs();
  const startedAt = Date.now();
  const N = ALL_169_HANDS.length;

  let table: EquityTable;
  if (resume) {
    table = loadExisting() ?? ({ _meta: newMeta(trials, seed, true) } as EquityTable);
    table._meta = newMeta(trials, seed, true);
  } else {
    table = { _meta: newMeta(trials, seed, true) } as EquityTable;
  }

  for (let i = 0; i < N; i++) {
    const hand = ALL_169_HANDS[i]!;
    if (!isRow(table[hand])) table[hand] = {};
  }

  const pending: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const row = table[ALL_169_HANDS[i]!] as Row;
    for (let pct = 1; pct <= PCTS; pct++) {
      if (resume && typeof row[String(pct)] === "number") continue;
      pending.push([i, pct]);
    }
  }
  const totalPending = pending.length;
  console.log(
    `[table] N=${N} cells=${N * PCTS} 未計算=${totalPending} trials=${trials} workers=${workers} seed=${seed}`,
  );
  if (totalPending === 0) {
    finalize(table, trials, seed, startedAt);
    return;
  }

  const batches: Array<Array<[number, number]>> = [];
  for (let k = 0; k < pending.length; k += BATCH_SIZE) batches.push(pending.slice(k, k + BATCH_SIZE));

  let nextBatch = 0;
  let doneCells = 0;
  let sinceSave = 0;

  await new Promise<void>((resolve, reject) => {
    let liveWorkers = 0;
    const dispatch = (w: Worker): void => {
      if (nextBatch >= batches.length) {
        w.postMessage({ type: "done" } as BatchMsg);
        return;
      }
      const id = nextBatch++;
      w.postMessage({ type: "batch", batchId: id, cells: batches[id]! } as BatchMsg);
    };
    for (let wi = 0; wi < workers; wi++) {
      const w = new Worker(new URL("./_workerBoot.mjs", import.meta.url), {
        workerData: {
          entry: pathToFileURL(__filename).href,
          hands: ALL_169_HANDS,
          trials,
          baseSeed: seed,
        } as WorkerData & { entry: string },
      });
      liveWorkers++;
      w.on("message", (msg: ResultMsg) => {
        for (const [handIdx, pct, eq] of msg.results) {
          (table[ALL_169_HANDS[handIdx]!] as Row)[String(pct)] = eq;
        }
        doneCells += msg.results.length;
        sinceSave += msg.results.length;
        if (sinceSave >= SAVE_EVERY_CELLS) {
          sinceSave = 0;
          saveTable(table);
          const el = (Date.now() - startedAt) / 1000;
          const rate = doneCells / el;
          const eta = rate > 0 ? (totalPending - doneCells) / rate : 0;
          console.log(
            `[table] ${doneCells}/${totalPending} cells (${((100 * doneCells) / totalPending).toFixed(1)}%) ` +
              `elapsed=${el.toFixed(0)}s rate=${rate.toFixed(1)} cells/s ETA=${(eta / 60).toFixed(1)}min`,
          );
        }
        dispatch(w);
      });
      w.on("error", reject);
      w.on("exit", () => {
        liveWorkers--;
        if (liveWorkers === 0) resolve();
      });
      dispatch(w);
    }
  });

  finalize(table, trials, seed, startedAt);
}

function newMeta(trials: number, seed: number, partial: boolean): EquityMeta {
  return {
    trials,
    generatedAt: new Date().toISOString(),
    version: PROGRESS_VERSION,
    method: `monte-carlo/fastEval seed=${seed}`,
    partial,
  };
}
function finalize(table: EquityTable, trials: number, seed: number, startedAt: number): void {
  table._meta = newMeta(trials, seed, false);
  saveTable(table);
  const el = (Date.now() - startedAt) / 1000;
  console.log(`\n[table] 完了 / 経過 ${(el / 60).toFixed(1)}min / trials/cell=${trials}`);
  console.log(`[table] 出力: ${OUTPUT_PATH}`);
}

if (isMainThread) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  runWorker();
}
