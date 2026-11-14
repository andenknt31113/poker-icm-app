// ===== 3 人同時オールインの勝率表 =====
//
// public/three-way-equity.bin (scripts/build-three-way.mts で生成) を読む。
// 169 種類のハンドの 3 つ組 (i ≤ j ≤ k、ALL_169_HANDS の index 順) ごとに
// [i が勝つ確率, j が勝つ確率] を各 1 byte (0..254 = 0..1) で持つ。255 は
// 「3 人が同時には持てない組」の印。オーバーコールの計算 (core solveOvercallPushFold) で使う。
import type { ThreeWayEquityFn } from "@poker-icm/core";
import { HAND_COUNT } from "./handRanking.js";

const N = HAND_COUNT;
const SCALE = 254;
const IMPOSSIBLE = 255;

/** rowStart[i * N + j] = 3 つ組 (i, j, j) の通し番号。 */
const rowStart = new Int32Array(N * N);
let tripleCount = 0;
for (let i = 0; i < N; i++) {
  for (let j = i; j < N; j++) {
    rowStart[i * N + j] = tripleCount;
    tripleCount += N - j;
  }
}

/** 表の想定サイズ (bytes)。 */
export const THREE_WAY_BYTES = tripleCount * 2;

let table: Uint8Array | null = null;

/** 読み込んだ表をセットする (サイズが合わなければ無視して false)。 */
export function setThreeWayTable(bytes: Uint8Array): boolean {
  if (bytes.length !== THREE_WAY_BYTES) return false;
  table = bytes;
  return true;
}

export function hasThreeWayTable(): boolean {
  return table !== null;
}

/** core に渡す 3 人の勝率関数。a / b / c は ALL_169_HANDS の index。 */
export const threeWayEquity: ThreeWayEquityFn = (a, b, c, out) => {
  if (!table) return false;
  // 3 つを昇順に並べ、元の位置を覚えておく
  let i = a, j = b, k = c;
  let pi = 0, pj = 1, pk = 2;
  let t: number;
  if (i > j) { t = i; i = j; j = t; t = pi; pi = pj; pj = t; }
  if (j > k) { t = j; j = k; k = t; t = pj; pj = pk; pk = t; }
  if (i > j) { t = i; i = j; j = t; t = pi; pi = pj; pj = t; }
  const idx = (rowStart[i * N + j]! + (k - j)) * 2;
  const b0 = table[idx]!;
  const b1 = table[idx + 1]!;
  if (b0 === IMPOSSIBLE) return false;
  const p0 = b0 / SCALE;
  const p1 = b1 / SCALE;
  out[pi] = p0;
  out[pj] = p1;
  out[pk] = Math.max(0, 1 - p0 - p1);
  return true;
};

let loading: Promise<boolean> | null = null;

/** 表を一度だけ取りに行く。失敗しても例外にせず false (オーバーコールなしで計算を続ける)。 */
export function loadThreeWayTable(): Promise<boolean> {
  if (table) return Promise.resolve(true);
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}three-way-equity.bin`)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
      .then((buffer) => setThreeWayTable(new Uint8Array(buffer)))
      .catch(() => {
        loading = null;
        return false;
      });
  }
  return loading;
}
