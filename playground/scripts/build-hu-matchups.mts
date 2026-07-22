/**
 * HU (heads-up) ハンド対決マトリックス生成スクリプト（高精度・並列版）
 *
 * 169 種類のスターティングハンド × 169 種類の Monte Carlo equity を計算し
 * `playground/src/data/hu-equity-matrix.json` に書き出す。
 *
 * 高精度化(2026-07):
 *   - 評価器を pokersolver から自作の高速整数評価器 `_fastEval` に変更（~80倍速、
 *     pokersolver と勝敗判定完全一致を 50 万ディールで検証済み）。
 *   - worker_threads で全 CPU コアに並列化。
 *   - 乱数は seedable な mulberry32。シードは (baseSeed, hero index, villain index)
 *     から決定的に導出するため、どのワーカーが計算しても同じペアは同じ乱数列
 *     → 完全に再現可能・resume 安全。
 *   - デフォルト試行数 1,000,000/ペア（標準誤差 ~0.05pt）。
 *
 * 対称性: equity(A vs B) = 1 - equity(B vs A)。上三角(hero index <= villain index)
 *   のみ計算・保存し、ランタイム(`huEquityMatrix.ts`)は対称性で下三角を補完する
 *   （バンドルサイズ据え置き）。
 *
 * 使い方:
 *   npx tsx scripts/build-hu-matchups.mts                       # trials=1,000,000
 *   npx tsx scripts/build-hu-matchups.mts --trials 500000       # 早め
 *   npx tsx scripts/build-hu-matchups.mts --workers 4 --seed 7  # ワーカー数/シード指定
 *   npx tsx scripts/build-hu-matchups.mts --resume              # 中断から再開
 *
 * 出力形式:
 *   { "AA": { "AA": 0.5, "KK": 0.82, ... }, ..., "_meta": { trials, generatedAt, version } }
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { ALL_169_HANDS } from "../src/handRanking.js";
import { combosForHand, computeHUEquity, mulberry32, deriveSeed } from "./_mc.mjs";

const __filename = fileURLToPath(import.meta.url);
const OUTPUT_PATH = path.resolve(path.dirname(__filename), "../src/data/hu-equity-matrix.json");

const DEFAULT_TRIALS = 1_000_000;
const DEFAULT_SEED = 0x5eed01;
const PROGRESS_VERSION = 2;
const BATCH_SIZE = 6; // 1 バッチ = 6 ペア（~3 秒相当、進捗の粒度）
const SAVE_EVERY_PAIRS = 300;

interface MatrixMeta {
  trials: number;
  generatedAt: string;
  version: number;
  method?: string;
  partial?: boolean;
}
type Row = { [villain: string]: number };
interface HUMatrix {
  [hero: string]: Row | MatrixMeta;
  _meta: MatrixMeta;
}

// ===== ワーカー =====

interface WorkerData {
  hands: string[];
  trials: number;
  baseSeed: number;
}
type BatchMsg = { type: "batch"; batchId: number; pairs: Array<[number, number]> } | { type: "done" };
type ResultMsg = { type: "result"; batchId: number; results: Array<[number, number, number]> };

function runWorker(): void {
  const { hands, trials, baseSeed } = workerData as WorkerData;
  const combos = hands.map((h) => combosForHand(h));
  parentPort!.on("message", (msg: BatchMsg) => {
    if (msg.type === "done") {
      parentPort!.close();
      return;
    }
    const results: Array<[number, number, number]> = [];
    for (const [i, j] of msg.pairs) {
      const rng = mulberry32(deriveSeed(baseSeed, i, j));
      const eq = computeHUEquity(combos[i]!, combos[j]!, trials, rng);
      results.push([i, j, Number(eq.toFixed(4))]);
    }
    const out: ResultMsg = { type: "result", batchId: msg.batchId, results };
    parentPort!.postMessage(out);
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
      console.log("Usage: npx tsx scripts/build-hu-matchups.mts [--trials N] [--workers N] [--seed N] [--resume]");
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

function loadExisting(): HUMatrix | null {
  if (!fs.existsSync(OUTPUT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")) as HUMatrix;
  } catch (e) {
    console.warn("既存ファイル読み込み失敗。最初から計算します。", e);
    return null;
  }
}
function saveTable(table: HUMatrix): void {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(table) + "\n", "utf8");
}

function isRow(v: Row | MatrixMeta | undefined): v is Row {
  return v !== undefined && typeof v === "object" && !("trials" in v);
}

// ===== メイン =====

async function main(): Promise<void> {
  const { trials, resume, workers, seed } = parseArgs();
  const startedAt = Date.now();
  const N = ALL_169_HANDS.length;

  let table: HUMatrix;
  if (resume) {
    table = loadExisting() ?? ({ _meta: newMeta(trials, seed, true) } as HUMatrix);
    table._meta = newMeta(trials, seed, true);
  } else {
    table = { _meta: newMeta(trials, seed, true) } as HUMatrix;
  }

  // 上三角(i<=j)を対象。対角(i==j)は 0.5 直接。
  for (let i = 0; i < N; i++) {
    const hero = ALL_169_HANDS[i]!;
    if (!isRow(table[hero])) table[hero] = {};
    (table[hero] as Row)[hero] = 0.5;
  }

  // 未計算ペアを列挙
  const pending: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const heroRow = table[ALL_169_HANDS[i]!] as Row;
    for (let j = i + 1; j < N; j++) {
      if (resume && typeof heroRow[ALL_169_HANDS[j]!] === "number") continue;
      pending.push([i, j]);
    }
  }
  const totalPending = pending.length;
  console.log(
    `[hu] N=${N} 上三角ペア(対角除く)=${(N * (N - 1)) / 2}, 未計算=${totalPending}, trials=${trials}, workers=${workers}, seed=${seed}`,
  );
  if (totalPending === 0) {
    finalize(table, trials, seed, startedAt);
    return;
  }

  // バッチ生成
  const batches: Array<Array<[number, number]>> = [];
  for (let k = 0; k < pending.length; k += BATCH_SIZE) batches.push(pending.slice(k, k + BATCH_SIZE));

  let nextBatch = 0;
  let donePairs = 0;
  let sinceSave = 0;

  await new Promise<void>((resolve, reject) => {
    const pool: Worker[] = [];
    let liveWorkers = 0;

    const dispatch = (w: Worker): void => {
      if (nextBatch >= batches.length) {
        w.postMessage({ type: "done" } as BatchMsg);
        return;
      }
      const id = nextBatch++;
      w.postMessage({ type: "batch", batchId: id, pairs: batches[id]! } as BatchMsg);
    };

    for (let wi = 0; wi < workers; wi++) {
      // worker_threads では tsx の resolve リマップが execArgv 経由で効かないため、
      // プレーン .mjs ブートストラップで tsx を register してから本体を import する。
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
        for (const [i, j, eq] of msg.results) {
          (table[ALL_169_HANDS[i]!] as Row)[ALL_169_HANDS[j]!] = eq;
        }
        donePairs += msg.results.length;
        sinceSave += msg.results.length;
        if (sinceSave >= SAVE_EVERY_PAIRS) {
          sinceSave = 0;
          saveTable(table);
          const el = (Date.now() - startedAt) / 1000;
          const rate = donePairs / el;
          const eta = rate > 0 ? (totalPending - donePairs) / rate : 0;
          console.log(
            `[hu] ${donePairs}/${totalPending} pairs (${((100 * donePairs) / totalPending).toFixed(1)}%) ` +
              `elapsed=${el.toFixed(0)}s rate=${rate.toFixed(1)} pairs/s ETA=${(eta / 60).toFixed(1)}min`,
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

function newMeta(trials: number, seed: number, partial: boolean): MatrixMeta {
  return {
    trials,
    generatedAt: new Date().toISOString(),
    version: PROGRESS_VERSION,
    method: `monte-carlo/fastEval seed=${seed}`,
    partial,
  };
}

function finalize(table: HUMatrix, trials: number, seed: number, startedAt: number): void {
  table._meta = newMeta(trials, seed, false);
  saveTable(table);
  const el = (Date.now() - startedAt) / 1000;
  console.log(`\n[hu] 完了 / 経過 ${(el / 60).toFixed(1)}min / trials/pair=${trials}`);
  console.log(`[hu] 出力: ${OUTPUT_PATH}`);
}

if (isMainThread) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  runWorker();
}
