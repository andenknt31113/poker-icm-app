import type { Equities, Payouts, Stacks } from "./types.js";

/**
 * Malmuth-Harville ICM。
 *
 * 各プレイヤーの $ エクイティ（賞金期待値）を計算する。
 *
 * アルゴリズム:
 *   状態 = まだ生き残っているプレイヤー集合 S（ビットマスク）
 *   遷移: S から、stack に比例した確率でプレイヤー i を選び「次に決まる順位」に確定する
 *         ※ 1位が先に決まり、続いて 2位、3位 …
 *
 *   P[S] = 状態 S に到達する確率
 *   1位 → 2位 → ... の順に位置を決めるため、
 *   現在 S にいる人数が N - place なら、次に決まるのは place + 1 位 (1-indexed)
 *
 * 計算量: O(2^n * n)。n=10 で約 10,240 演算なのでモバイルでも一瞬。
 *
 * 制約:
 *   - n は 1..MAX_PLAYERS（既定 12）
 *   - 全プレイヤーの stack の合計が 0 だとエラー
 *   - 個別の stack が 0 なのは許容（自動的に最下位へ流れる）
 *
 * @param stacks 各プレイヤーのチップ
 * @param payouts 順位別賞金。要素数は最大 stacks.length まで（足りない位は 0 扱い）
 * @returns 各プレイヤーの $ エクイティ（stacks と同じ順序）
 */
export const MAX_PLAYERS = 9;

export function calculateICM(stacks: Stacks, payouts: Payouts): Equities {
  const n = stacks.length;
  if (n === 0) return [];
  if (n > MAX_PLAYERS) {
    throw new Error(
      `ICM: プレイヤー数 ${n} は上限 ${MAX_PLAYERS} を超えています`,
    );
  }

  for (let i = 0; i < n; i++) {
    const s = stacks[i]!;
    if (!Number.isFinite(s) || s < 0) {
      throw new Error(`ICM: stacks[${i}] が不正です: ${s}`);
    }
  }
  for (let k = 0; k < payouts.length; k++) {
    const p = payouts[k]!;
    if (!Number.isFinite(p) || p < 0) {
      throw new Error(`ICM: payouts[${k}] が不正です: ${p}`);
    }
  }

  const total = sum(stacks);
  if (total <= 0) {
    throw new Error("ICM: 全員のスタック合計が 0 です");
  }

  const numPlaces = Math.min(n, payouts.length);
  const fullMask = (1 << n) - 1;

  // P[mask] = 「マスクに含まれる人がまだ生き残っている」状態に至る確率
  const P = new Float64Array(1 << n);
  P[fullMask] = 1.0;

  const equity = new Float64Array(n);

  // popcount 降順に処理して、子状態へ確率を流す
  for (let mask = fullMask; mask >= 1; mask--) {
    const prob = P[mask]!;
    if (prob === 0) continue;

    const aliveCount = popcount(mask);
    const placeIdx = n - aliveCount; // 0-indexed: 次に決まる順位

    // 生存者のスタック合計
    let sumAlive = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sumAlive += stacks[i]!;
    }

    if (sumAlive > 0) {
      // 通常ケース: stack 比例で次の順位を決める
      for (let i = 0; i < n; i++) {
        const bit = 1 << i;
        if (!(mask & bit)) continue;

        const stackI = stacks[i]!;
        if (stackI === 0) continue; // 0チップは別グループ

        const winProb = stackI / sumAlive;
        const transition = prob * winProb;

        if (placeIdx < numPlaces) {
          equity[i]! += transition * payouts[placeIdx]!;
        }
        P[mask & ~bit]! += transition;
      }

      // 残りの 0 チップ勢は、すべての非0プレイヤーが順位確定したあとに
      // 均等な順序で残り席に割り振られる。彼らはこのループの上で「待機」しており、
      // 後続の状態（mask 内に 0 チップだけ残った時点）で sumAlive=0 ブランチで処理される。
    } else {
      // 全員 0 チップ: 残席を均等に分配
      const aliveList: number[] = [];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) aliveList.push(i);
      }
      const winProb = 1 / aliveList.length;
      for (const i of aliveList) {
        const transition = prob * winProb;
        if (placeIdx < numPlaces) {
          equity[i]! += transition * payouts[placeIdx]!;
        }
        P[mask & ~(1 << i)]! += transition;
      }
    }
  }

  return Array.from(equity);
}

/**
 * Hero と Villain の 2 人だけの確率分布から、ヘッズアップでの hero エクイティを返す。
 * （ICM の妥当性チェックなどに有用）
 */
export function headsUpEquity(
  heroStack: number,
  villainStack: number,
  payouts: readonly [number, number],
): number {
  const total = heroStack + villainStack;
  if (total <= 0) throw new Error("headsUpEquity: 合計スタックが 0");
  const pWin = heroStack / total;
  return pWin * payouts[0] + (1 - pWin) * payouts[1];
}

function sum(arr: readonly number[]): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

function popcount(x: number): number {
  // 32-bit popcount（マスクは最大 2^12 = 4096 までしか使わないので十分）
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >>> 24;
}
