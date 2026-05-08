/**
 * Monte Carlo equity 事前計算スクリプト
 *
 * 169 種類の各ハンド H と Top X% (X = 1..100) のレンジ R との equity を
 * Monte Carlo で計算し、playground/src/data/equity-table.json に書き出す。
 *
 * 使い方:
 *   npx tsx scripts/build-equity-table.mts                # trials=5000
 *   npx tsx scripts/build-equity-table.mts --trials 1000  # 早回し
 *   npx tsx scripts/build-equity-table.mts --resume       # 既存テーブルから差分
 *
 * 出力ファイル形式:
 *   {
 *     "AA":  { "1": 0.85, "2": 0.84, ..., "100": 0.85 },
 *     "AKs": { ... },
 *     ...
 *     "_meta": { "trials": 5000, "generatedAt": "...", "version": 1 }
 *   }
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_169_HANDS,
  topRange,
  type HandNotation,
} from "../src/handRanking.js";
// @ts-expect-error - pokersolver has no types
import pokersolver from "pokersolver";

// ===== 定数 =====

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, "../src/data/equity-table.json");

const DEFAULT_TRIALS = 5000;
const SUITS = ["s", "h", "d", "c"] as const;
const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A",
] as const;
const PROGRESS_VERSION = 1;
const MAX_RESAMPLE_VILLAIN = 50; // villain 引きでカード被りした時の再試行上限
const SAVE_EVERY_HANDS = 5; // 5 ハンド (= 500 ペア) ごとに途中保存

// pokersolver の Hand
type SolvedHand = { _wins?: number };
const Hand = (pokersolver as { Hand: PokerHandStatic }).Hand;
interface PokerHandStatic {
  solve: (cards: string[]) => SolvedHand;
  winners: (hands: SolvedHand[]) => SolvedHand[];
}

// ===== CLI 解析 =====

interface CliArgs {
  trials: number;
  resume: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let trials = DEFAULT_TRIALS;
  let resume = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--trials") {
      const next = args[i + 1];
      if (next === undefined) throw new Error("--trials の後ろに数値が必要");
      trials = Number(next);
      if (!Number.isFinite(trials) || trials < 100) {
        throw new Error(`trials は 100 以上の数値: ${next}`);
      }
      i++;
    } else if (a === "--resume") {
      resume = true;
    } else if (a === "-h" || a === "--help") {
      console.log(
        "Usage: npx tsx scripts/build-equity-table.mts [--trials N] [--resume]",
      );
      process.exit(0);
    }
  }
  return { trials, resume };
}

// ===== カード操作 =====

/** デッキを生成する。例: "Ad", "Ks", ... */
function makeDeck(): string[] {
  const deck: string[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(`${r}${s}`);
  return deck;
}

/** Fisher–Yates シャッフル（in-place）。 */
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/** ハンド表記からその全カード組合せを返す。 */
function combosForHand(hand: HandNotation): [string, string][] {
  const out: [string, string][] = [];
  const r1 = hand[0]!;
  const r2 = hand[1]!;
  const tail = hand[2];
  if (tail === undefined) {
    // pair: 同じランク 2枚（スーツ違い）
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        out.push([`${r1}${SUITS[i]!}`, `${r1}${SUITS[j]!}`]);
      }
    }
  } else if (tail === "s") {
    // suited
    for (const s of SUITS) {
      out.push([`${r1}${s}`, `${r2}${s}`]);
    }
  } else {
    // offsuit
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 === s2) continue;
        out.push([`${r1}${s1}`, `${r2}${s2}`]);
      }
    }
  }
  return out;
}

/** ランダムに一要素を返す（空配列は呼ばない前提）。 */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ===== Monte Carlo =====

/**
 * hand vs vsRange の equity を Monte Carlo で計算。
 * - ブロッカー考慮の上、vsRange 内のハンド分布から一様にサンプリング。
 * - vsRange に hand 自身が含まれる場合もブロッカー除外で計算する（実戦に即す）。
 */
function computeEquity(
  hand: HandNotation,
  vsRange: readonly HandNotation[],
  trials: number,
): number {
  // hand のカード組合せを事前展開
  const heroCombos = combosForHand(hand);
  if (heroCombos.length === 0) return 0.5;

  // villain 候補のカード組合せ群（ハンド毎にまとめる）
  const villainCombosPerHand = vsRange.map((h) => combosForHand(h));
  if (villainCombosPerHand.length === 0) return 0.5;

  let wins = 0;
  let actualTrials = 0;

  for (let t = 0; t < trials; t++) {
    const heroCards = pick(heroCombos);

    // villain を一様サンプリング（ハンド分布的にも各ハンド等確率を仮定）
    let villainCards: [string, string] | null = null;
    for (let attempt = 0; attempt < MAX_RESAMPLE_VILLAIN; attempt++) {
      const vCombos = pick(villainCombosPerHand);
      const cand = pick(vCombos);
      if (
        cand[0] !== heroCards[0] &&
        cand[0] !== heroCards[1] &&
        cand[1] !== heroCards[0] &&
        cand[1] !== heroCards[1]
      ) {
        villainCards = cand;
        break;
      }
    }
    if (!villainCards) {
      // ブロッカー過多（極端な例: hand=AA, vsRange={AA}）。スキップ。
      continue;
    }
    actualTrials++;

    // 残り 48 枚から 5 枚board
    const used = new Set<string>([
      heroCards[0],
      heroCards[1],
      villainCards[0],
      villainCards[1],
    ]);
    // Reservoir 方式じゃなく単純シャッフルでよい（48 枚程度）
    const remaining: string[] = [];
    for (const r of RANKS) {
      for (const s of SUITS) {
        const c = `${r}${s}`;
        if (!used.has(c)) remaining.push(c);
      }
    }
    // 5 枚だけ取りたいので、partial Fisher–Yates
    for (let i = 0; i < 5; i++) {
      const j = i + Math.floor(Math.random() * (remaining.length - i));
      const tmp = remaining[i]!;
      remaining[i] = remaining[j]!;
      remaining[j] = tmp;
    }
    const board = remaining.slice(0, 5);

    // hero + board, villain + board をそれぞれ評価
    const heroSolved = Hand.solve([...heroCards, ...board]);
    const villainSolved = Hand.solve([...villainCards, ...board]);
    const winners = Hand.winners([heroSolved, villainSolved]);
    if (winners.length === 2) {
      wins += 0.5;
    } else if (winners.length === 1 && winners[0] === heroSolved) {
      wins += 1;
    }
  }

  if (actualTrials === 0) return 0.5;
  return wins / actualTrials;
}

// ===== 出力ファイル管理 =====

interface EquityTable {
  [hand: string]: { [percent: string]: number } | EquityMeta;
  _meta: EquityMeta;
}
interface EquityMeta {
  trials: number;
  generatedAt: string;
  version: number;
  partial?: boolean;
}

function loadExisting(): EquityTable | null {
  if (!fs.existsSync(OUTPUT_PATH)) return null;
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, "utf8");
    return JSON.parse(raw) as EquityTable;
  } catch (e) {
    console.warn("既存ファイル読み込み失敗。最初から計算します。", e);
    return null;
  }
}

function saveTable(table: EquityTable): void {
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(table) + "\n", "utf8");
}

// ===== メイン =====

async function main(): Promise<void> {
  const { trials, resume } = parseArgs();
  const startedAt = Date.now();

  let table: EquityTable;
  if (resume) {
    const existing = loadExisting();
    if (!existing) {
      console.log("[resume] 既存ファイルなし、最初から開始");
      table = {
        _meta: {
          trials,
          generatedAt: new Date().toISOString(),
          version: PROGRESS_VERSION,
          partial: true,
        },
      };
    } else {
      console.log("[resume] 既存ファイルから再開");
      table = existing;
      table._meta = {
        ...table._meta,
        trials, // 上書き（最新の trials 数を記録）
        partial: true,
      };
    }
  } else {
    table = {
      _meta: {
        trials,
        generatedAt: new Date().toISOString(),
        version: PROGRESS_VERSION,
        partial: true,
      },
    };
  }

  const totalPairs = ALL_169_HANDS.length * 100;
  let pairCount = 0;
  let processedHands = 0;

  for (const hand of ALL_169_HANDS) {
    const existingForHand = table[hand];
    const isExistingValid =
      existingForHand !== undefined &&
      typeof existingForHand === "object" &&
      !("trials" in existingForHand) &&
      Object.keys(existingForHand).length === 100;

    if (resume && isExistingValid) {
      pairCount += 100;
      processedHands++;
      continue;
    }

    const perHand: { [percent: string]: number } = {};
    for (let pct = 1; pct <= 100; pct++) {
      const range = Array.from(topRange(pct));
      const eq = computeEquity(hand, range, trials);
      perHand[String(pct)] = Number(eq.toFixed(4));
      pairCount++;
      // ログは 25, 50, 75, 100 % のみ抑制
      if (pct === 25 || pct === 50 || pct === 75 || pct === 100) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(
          `[${pairCount}/${totalPairs}] ${hand} vs Top ${pct}%: ${eq.toFixed(3)}  (elapsed ${elapsed}s)`,
        );
      }
    }
    table[hand] = perHand;
    processedHands++;

    if (processedHands % SAVE_EVERY_HANDS === 0) {
      saveTable(table);
    }
  }

  // 最終保存（partial フラグ外す）
  table._meta = {
    trials,
    generatedAt: new Date().toISOString(),
    version: PROGRESS_VERSION,
    partial: false,
  };
  saveTable(table);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\n完了: ${ALL_169_HANDS.length} ハンド × 100 pct = ${totalPairs} ペア / 経過 ${elapsed}s / trials/pair = ${trials}`,
  );
  console.log(`出力先: ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
