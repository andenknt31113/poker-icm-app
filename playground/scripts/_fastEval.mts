/**
 * 高速 7-card ポーカーハンド評価器（Monte Carlo equity 事前計算用）。
 *
 * pokersolver は 1 スレッド ~24K solve/s と遅く、500K〜1M trials/pair の
 * 高精度化には非現実的。本モジュールは整数ビット演算で 7 枚から
 * 「比較可能なスコア（大きいほど強い）」を返す軽量評価器を提供する。
 *
 * カード表現: 整数 0..51 = rank*4 + suit
 *   rank: 0='2' .. 12='A'
 *   suit: 0..3
 *
 * スコア: category(0..8) を最上位に、5 枚のタイブレークランクを 15 進で畳んだ整数。
 * pokersolver と勝敗判定が完全一致することを _fastEval.test で検証済み。
 */

export const RANK_CHARS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export const SUIT_CHARS = ["s", "h", "d", "c"] as const;

/** "As" 等の文字列カードを整数コード(0..51)に変換。 */
export function cardCode(card: string): number {
  const r = RANK_CHARS.indexOf(card[0] as (typeof RANK_CHARS)[number]);
  const s = SUIT_CHARS.indexOf(card[1] as (typeof SUIT_CHARS)[number]);
  return r * 4 + s;
}

/** 13bit ランクマスクから最上位ストレートの高位ランク(4..12, wheel=3)を返す。無ければ -1。 */
function straightTop(mask: number): number {
  for (let h = 12; h >= 4; h--) {
    const need = 0x1f << (h - 4);
    if ((mask & need) === need) return h;
  }
  // wheel A-2-3-4-5: ランク 12,0,1,2,3
  if ((mask & 0b1000000001111) === 0b1000000001111) return 3;
  return -1;
}

/** 5 個のタイブレークランクを 15 進で畳む（category を最上位に）。 */
function fold(cat: number, t1: number, t2: number, t3: number, t4: number, t5: number): number {
  return ((((cat * 15 + t1) * 15 + t2) * 15 + t3) * 15 + t4) * 15 + t5;
}

/**
 * 7 枚のカードコード配列から best-5 のスコアを返す（大きいほど強い）。
 */
export function evaluate7(cards: Int32Array | number[]): number {
  const rankCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const suitCount = [0, 0, 0, 0];
  const suitMask = [0, 0, 0, 0];
  let rankMask = 0;

  for (let i = 0; i < 7; i++) {
    const c = cards[i]!;
    const r = c >> 2;
    const s = c & 3;
    rankCount[r]!++;
    suitCount[s]!++;
    suitMask[s]! |= 1 << r;
    rankMask |= 1 << r;
  }

  // フラッシュスート
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (suitCount[s]! >= 5) {
      flushSuit = s;
      break;
    }
  }

  // ストレートフラッシュ
  if (flushSuit >= 0) {
    const sf = straightTop(suitMask[flushSuit]!);
    if (sf >= 0) return fold(8, sf, 0, 0, 0, 0);
  }

  // ランクグループ収集（降順）
  let quad = -1;
  let trip1 = -1;
  let trip2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const c = rankCount[r]!;
    if (c === 4) {
      quad = r;
    } else if (c === 3) {
      if (trip1 < 0) trip1 = r;
      else if (trip2 < 0) trip2 = r;
    } else if (c === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }

  // 4 カード
  if (quad >= 0) {
    let kicker = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== quad && rankCount[r]! > 0) {
        kicker = r;
        break;
      }
    }
    return fold(7, quad, kicker, 0, 0, 0);
  }

  // フルハウス（トリップス + ペア または 2 組のトリップス）
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    const pairRank = trip2 >= 0 ? Math.max(trip2, pair1) : pair1;
    return fold(6, trip1, pairRank, 0, 0, 0);
  }

  // フラッシュ
  if (flushSuit >= 0) {
    const fm = suitMask[flushSuit]!;
    const top: number[] = [];
    for (let r = 12; r >= 0 && top.length < 5; r--) {
      if (fm & (1 << r)) top.push(r);
    }
    return fold(5, top[0]!, top[1]!, top[2]!, top[3]!, top[4]!);
  }

  // ストレート
  const st = straightTop(rankMask);
  if (st >= 0) return fold(4, st, 0, 0, 0, 0);

  // スリーカード
  if (trip1 >= 0) {
    const kick: number[] = [];
    for (let r = 12; r >= 0 && kick.length < 2; r--) {
      if (r !== trip1 && rankCount[r]! > 0) kick.push(r);
    }
    return fold(3, trip1, kick[0]!, kick[1]!, 0, 0);
  }

  // ツーペア
  if (pair1 >= 0 && pair2 >= 0) {
    let kicker = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== pair1 && r !== pair2 && rankCount[r]! > 0) {
        kicker = r;
        break;
      }
    }
    return fold(2, pair1, pair2, kicker, 0, 0);
  }

  // ワンペア
  if (pair1 >= 0) {
    const kick: number[] = [];
    for (let r = 12; r >= 0 && kick.length < 3; r--) {
      if (r !== pair1 && rankCount[r]! > 0) kick.push(r);
    }
    return fold(1, pair1, kick[0]!, kick[1]!, kick[2]!, 0);
  }

  // ハイカード
  const top: number[] = [];
  for (let r = 12; r >= 0 && top.length < 5; r--) {
    if (rankCount[r]! > 0) top.push(r);
  }
  return fold(0, top[0]!, top[1]!, top[2]!, top[3]!, top[4]!);
}
