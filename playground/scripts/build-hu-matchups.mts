/**
 * HU (heads-up) ハンド対決マトリックス生成スクリプト
 *
 * 169 種類のスターティングハンド × 169 種類のスターティングハンドの
 * Monte Carlo equity を計算し `playground/src/data/hu-equity-matrix.json` に書き出す。
 *
 * 対称性: equity(A vs B) = 1 - equity(B vs A) を使って計算量半減。
 *
 * 使い方:
 *   npx tsx scripts/build-hu-matchups.mts                # trials=5000 (default)
 *   npx tsx scripts/build-hu-matchups.mts --trials 1000  # 早回し
 *   npx tsx scripts/build-hu-matchups.mts --resume       # 既存テーブルから再開
 *
 * 出力ファイル形式:
 *   {
 *     "AA":  { "AA": 0.5, "KK": 0.82, ... },
 *     "KK":  { ... },
 *     ...
 *     "_meta": { "trials": 5000, "generatedAt": "...", "version": 1 }
 *   }
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_169_HANDS,
  type HandNotation,
} from "../src/handRanking.js";
// @ts-expect-error - pokersolver has no types
import pokersolver from "pokersolver";

// ===== 定数 =====

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, "../src/data/hu-equity-matrix.json");

const DEFAULT_TRIALS = 5000;
const SUITS = ["s", "h", "d", "c"] as const;
const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A",
] as const;
const PROGRESS_VERSION = 1;
const MAX_RESAMPLE_VILLAIN = 50;
const SAVE_EVERY_HANDS = 5;
const LOG_EVERY = 100; // 100 ペアごとにログ

type SolvedHand = { _wins?: number };
const Hand = (pokersolver as { Hand: PokerHandStatic }).Hand;
interface PokerHandStatic {
  solve: (cards: string[]) => SolvedHand;
  winners: (hands: SolvedHand[]) => SolvedHand[];
}

// ===== CLI =====

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
        "Usage: npx tsx scripts/build-hu-matchups.mts [--trials N] [--resume]",
      );
      process.exit(0);
    }
  }
  return { trials, resume };
}

// ===== カード操作 =====

function combosForHand(hand: HandNotation): [string, string][] {
  const out: [string, string][] = [];
  const r1 = hand[0]!;
  const r2 = hand[1]!;
  const tail = hand[2];
  if (tail === undefined) {
    // pair
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        out.push([`${r1}${SUITS[i]!}`, `${r1}${SUITS[j]!}`]);
      }
    }
  } else if (tail === "s") {
    for (const s of SUITS) {
      out.push([`${r1}${s}`, `${r2}${s}`]);
    }
  } else {
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 === s2) continue;
        out.push([`${r1}${s1}`, `${r2}${s2}`]);
      }
    }
  }
  return out;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ===== Monte Carlo =====

/**
 * hero hand vs villain hand の HU equity を Monte Carlo で計算。
 */
function computeHUEquity(
  hero: HandNotation,
  villain: HandNotation,
  trials: number,
): number {
  const heroCombos = combosForHand(hero);
  const villainCombos = combosForHand(villain);
  if (heroCombos.length === 0 || villainCombos.length === 0) return 0.5;

  let wins = 0;
  let actualTrials = 0;

  for (let t = 0; t < trials; t++) {
    const heroCards = pick(heroCombos);

    let villainCards: [string, string] | null = null;
    for (let attempt = 0; attempt < MAX_RESAMPLE_VILLAIN; attempt++) {
      const cand = pick(villainCombos);
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
      // hero=AA vs villain=AA など、極端なブロッカー衝突。スキップ。
      continue;
    }
    actualTrials++;

    // 残デッキから 5 枚 board
    const used = new Set<string>([
      heroCards[0],
      heroCards[1],
      villainCards[0],
      villainCards[1],
    ]);
    const remaining: string[] = [];
    for (const r of RANKS) {
      for (const s of SUITS) {
        const c = `${r}${s}`;
        if (!used.has(c)) remaining.push(c);
      }
    }
    for (let i = 0; i < 5; i++) {
      const j = i + Math.floor(Math.random() * (remaining.length - i));
      const tmp = remaining[i]!;
      remaining[i] = remaining[j]!;
      remaining[j] = tmp;
    }
    const board = remaining.slice(0, 5);

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

// ===== 出力ファイル =====

interface MatrixMeta {
  trials: number;
  generatedAt: string;
  version: number;
  partial?: boolean;
}
interface HUMatrix {
  [hero: string]: { [villain: string]: number } | MatrixMeta;
  _meta: MatrixMeta;
}

function loadExisting(): HUMatrix | null {
  if (!fs.existsSync(OUTPUT_PATH)) return null;
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, "utf8");
    return JSON.parse(raw) as HUMatrix;
  } catch (e) {
    console.warn("既存ファイル読み込み失敗。最初から計算します。", e);
    return null;
  }
}

function saveTable(table: HUMatrix): void {
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(table) + "\n", "utf8");
}

// ===== メイン =====

async function main(): Promise<void> {
  const { trials, resume } = parseArgs();
  const startedAt = Date.now();

  let table: HUMatrix;
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
        trials,
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

  // 全ペア数 = 169 * 169 = 28561、対称性で実計算は (169*168/2) + 169 = 14365 ペア
  const N = ALL_169_HANDS.length;
  const totalUniquePairs = (N * (N - 1)) / 2 + N; // 14365
  let pairCount = 0;
  let processedHands = 0;

  // hero index 0..168 で外側ループ。
  // 同一ハンド (hero == villain) は 0.5 (チョップ近似)。
  // hero index < villain index の組合せのみ実計算 → 対称的に埋める。
  for (let i = 0; i < N; i++) {
    const hero = ALL_169_HANDS[i]!;
    const existingHeroRow = table[hero];
    const heroRowIsValid =
      existingHeroRow !== undefined &&
      typeof existingHeroRow === "object" &&
      !("trials" in existingHeroRow);

    let row: { [villain: string]: number };
    if (resume && heroRowIsValid) {
      row = existingHeroRow as { [villain: string]: number };
    } else {
      row = {};
      table[hero] = row;
    }

    for (let j = i; j < N; j++) {
      const villain = ALL_169_HANDS[j]!;

      // resume: 既に計算済みならスキップ
      if (resume && row[villain] !== undefined) {
        // 反対側も保証
        const otherRow = table[villain];
        if (
          otherRow !== undefined &&
          typeof otherRow === "object" &&
          !("trials" in otherRow)
        ) {
          (otherRow as { [k: string]: number })[hero] = 1 - row[villain]!;
        }
        pairCount++;
        continue;
      }

      let eq: number;
      if (i === j) {
        // 同一ハンド: 厳密にはブロッカー考慮で 0.5 ぴったり、厳密 MC でも僅差。
        // 簡略化として 0.5 を直接代入する（テーブル size 削減 + 計算節約）。
        eq = 0.5;
      } else {
        eq = computeHUEquity(hero, villain, trials);
      }

      row[villain] = Number(eq.toFixed(4));

      // 反対側にも書く
      if (i !== j) {
        let otherRow = table[ALL_169_HANDS[j]!];
        if (
          otherRow === undefined ||
          typeof otherRow !== "object" ||
          "trials" in otherRow
        ) {
          otherRow = {};
          table[ALL_169_HANDS[j]!] = otherRow;
        }
        (otherRow as { [k: string]: number })[hero] = Number(
          (1 - eq).toFixed(4),
        );
      }

      pairCount++;
      if (pairCount % LOG_EVERY === 0 || (i < 3 && j < i + 5)) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(
          `[${pairCount}/${totalUniquePairs}] ${hero} vs ${villain}: ${eq.toFixed(3)}  (elapsed ${elapsed}s)`,
        );
      }
    }

    processedHands++;
    if (processedHands % SAVE_EVERY_HANDS === 0) {
      saveTable(table);
    }
  }

  // 最終保存
  table._meta = {
    trials,
    generatedAt: new Date().toISOString(),
    version: PROGRESS_VERSION,
    partial: false,
  };
  saveTable(table);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\n完了: ${N}×${N} = ${N * N} ペア（実計算 ${totalUniquePairs} ペア） / 経過 ${elapsed}s / trials/pair = ${trials}`,
  );
  console.log(`出力先: ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
