/**
 * Monte Carlo equity 計算のコアプリミティブ（高精度事前計算用・共有モジュール）。
 *
 * - 高速整数評価器 `evaluate7` を使用（pokersolver の ~50 倍速）。
 * - 乱数は seedable な mulberry32。シードは (baseSeed, ペア識別子) から決定的に導出するため、
 *   どのワーカー/シャードで計算しても同じペアは同じ乱数列 → 完全に再現可能・resume 安全。
 * - カードは整数コード 0..51 (= rank*4 + suit) で扱う。
 */

import { evaluate7, cardCode } from "./_fastEval.mjs";
import type { HandNotation } from "../src/handRanking.js";

const SUITS = ["s", "h", "d", "c"] as const;
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;

/** ハンド表記(例 "AKs")から、その全カードコンボをコードペア配列で返す。 */
export function combosForHand(hand: HandNotation): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const r1 = hand[0]!;
  const r2 = hand[1]!;
  const tail = hand[2];
  if (tail === undefined) {
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        out.push([cardCode(`${r1}${SUITS[i]}`), cardCode(`${r1}${SUITS[j]}`)]);
      }
    }
  } else if (tail === "s") {
    for (const s of SUITS) out.push([cardCode(`${r1}${s}`), cardCode(`${r2}${s}`)]);
  } else {
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 === s2) continue;
        out.push([cardCode(`${r1}${s1}`), cardCode(`${r2}${s2}`)]);
      }
    }
  }
  return out;
}

/** mulberry32 seedable PRNG。返り値は [0,1) の一様乱数を返す関数。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** (baseSeed, a, b) から 32bit の決定的シードを導出（splitmix 風ミックス）。 */
export function deriveSeed(baseSeed: number, a: number, b: number): number {
  let h = (baseSeed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

// 使い回しバッファ（1 ワーカー = 1 スレッド前提でモジュールスコープ共有）
const used = new Uint8Array(52);
const remaining = new Int32Array(52);
const hero7 = new Int32Array(7);
const vil7 = new Int32Array(7);

const MAX_RESAMPLE_VILLAIN = 50;

/**
 * hero ハンド vs villain ハンド の HU equity を MC で計算。
 * @param heroCombos     hero クラスの全コンボ
 * @param villainCombos  villain クラスの全コンボ
 * @param trials         試行数
 * @param rng            seedable PRNG
 */
export function computeHUEquity(
  heroCombos: ReadonlyArray<readonly [number, number]>,
  villainCombos: ReadonlyArray<readonly [number, number]>,
  trials: number,
  rng: () => number,
): number {
  if (heroCombos.length === 0 || villainCombos.length === 0) return 0.5;
  let wins = 0;
  let actual = 0;
  for (let t = 0; t < trials; t++) {
    const h = heroCombos[(rng() * heroCombos.length) | 0]!;
    const h0 = h[0], h1 = h[1];
    let v0 = -1, v1 = -1, ok = false;
    for (let attempt = 0; attempt < MAX_RESAMPLE_VILLAIN; attempt++) {
      const cand = villainCombos[(rng() * villainCombos.length) | 0]!;
      if (cand[0] !== h0 && cand[0] !== h1 && cand[1] !== h0 && cand[1] !== h1) {
        v0 = cand[0]; v1 = cand[1]; ok = true; break;
      }
    }
    if (!ok) continue;
    actual++;
    wins += resolveTrial(h0, h1, v0, v1, rng);
  }
  if (actual === 0) return 0.5;
  return wins / actual;
}

/**
 * hero ハンド vs レンジ(=ハンドクラス集合) の equity を MC で計算。
 * villain は「ハンドクラスを一様抽選 → そのクラスのコンボを一様抽選」で配る
 * (既存テーブルと同一のサンプリング定義: クラス等確率)。
 */
export function computeRangeEquity(
  heroCombos: ReadonlyArray<readonly [number, number]>,
  villainCombosPerClass: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  trials: number,
  rng: () => number,
): number {
  if (heroCombos.length === 0 || villainCombosPerClass.length === 0) return 0.5;
  let wins = 0;
  let actual = 0;
  for (let t = 0; t < trials; t++) {
    const h = heroCombos[(rng() * heroCombos.length) | 0]!;
    const h0 = h[0], h1 = h[1];
    let v0 = -1, v1 = -1, ok = false;
    for (let attempt = 0; attempt < MAX_RESAMPLE_VILLAIN; attempt++) {
      const cls = villainCombosPerClass[(rng() * villainCombosPerClass.length) | 0]!;
      const cand = cls[(rng() * cls.length) | 0]!;
      if (cand[0] !== h0 && cand[0] !== h1 && cand[1] !== h0 && cand[1] !== h1) {
        v0 = cand[0]; v1 = cand[1]; ok = true; break;
      }
    }
    if (!ok) continue;
    actual++;
    wins += resolveTrial(h0, h1, v0, v1, rng);
  }
  if (actual === 0) return 0.5;
  return wins / actual;
}

/** 4 枚のホールカードを固定し、board 5 枚を配って勝敗を返す (1=hero勝ち, 0.5=chop, 0=負け)。 */
function resolveTrial(h0: number, h1: number, v0: number, v1: number, rng: () => number): number {
  used[h0] = 1; used[h1] = 1; used[v0] = 1; used[v1] = 1;
  let m = 0;
  for (let c = 0; c < 52; c++) if (used[c] === 0) remaining[m++] = c; // m = 48
  // 先頭 5 枚を partial Fisher–Yates で確定
  for (let k = 0; k < 5; k++) {
    const j = k + ((rng() * (48 - k)) | 0);
    const tmp = remaining[k]!; remaining[k] = remaining[j]!; remaining[j] = tmp;
  }
  hero7[0] = h0; hero7[1] = h1; vil7[0] = v0; vil7[1] = v1;
  for (let k = 0; k < 5; k++) {
    const b = remaining[k]!;
    hero7[2 + k] = b; vil7[2 + k] = b;
  }
  const hf = evaluate7(hero7);
  const vf = evaluate7(vil7);
  used[h0] = 0; used[h1] = 0; used[v0] = 0; used[v1] = 0;
  return hf > vf ? 1 : hf === vf ? 0.5 : 0;
}
