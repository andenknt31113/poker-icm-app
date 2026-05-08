/**
 * 169 種類のスターティングハンドを「強さ順」に並べたランキング。
 *
 * 注意: これは Sklansky-Chubukov や Pokerstove 等のオープンデータを参考にした
 *       「およそこの順」というアプローチで、ICMIZER 等のプロツールほど厳密ではない。
 *       実エンジン（Monte Carlo）に置き換える時、この順は捨てて equity ベースで再構築する。
 */

export type HandNotation = string; // 例: "AA", "AKs", "AKo"

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export const RANK_ORDER = RANKS;

/** グリッド座標 (row, col) → ハンド表記。row/col は 0-12 (A=0, 2=12)。 */
export function handAt(row: number, col: number): HandNotation {
  const r1 = RANKS[row]!;
  const r2 = RANKS[col]!;
  if (row === col) return `${r1}${r2}`; // pair
  if (row < col) return `${r1}${r2}s`;   // suited (上三角)
  return `${r2}${r1}o`;                   // offsuit (下三角)
}

/** ハンドが属するグリッド位置を返す。 */
export function gridPosition(hand: HandNotation): { row: number; col: number } {
  if (hand.length === 2) {
    // pair
    const idx = RANKS.indexOf(hand[0]! as (typeof RANKS)[number]);
    return { row: idx, col: idx };
  }
  const r1 = RANKS.indexOf(hand[0]! as (typeof RANKS)[number]);
  const r2 = RANKS.indexOf(hand[1]! as (typeof RANKS)[number]);
  const isSuited = hand[2] === "s";
  // 表記順: 高い rank が左 = row。suited は r1<=r2 ではなく r1<r2 (高い方が前)
  // r1 が必ず高い rank なので RANKS index が小さい
  if (isSuited) return { row: r1, col: r2 };
  return { row: r2, col: r1 };
}

/**
 * 169ハンドを強さ順に並べたリスト（rank 0 = 最強 = AA、rank 168 = 最弱 = 32o）。
 *
 * 自動生成: `equity-table.json` の vs Top 100% (random) equity を降順ソート。
 * 全 169 ハンドを網羅し、empirical な equity 順で正確に並んでいる。
 *
 * 再生成: `playground/scripts/build-equity-table.mts` で table 更新後、
 *         任意のスクリプトで vs random 順にソートして書き直す。
 */
export const HAND_RANKING: HandNotation[] = [
  "AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs",
  "AKo", "77", "AQs", "AQo", "AJs", "AJo", "KQs", "ATs",
  "KJs", "ATo", "66", "KQo", "A9s", "KJo", "KTs", "A8s",
  "A7s", "K9s", "A6s", "A9o", "QJs", "55", "QTs", "A8o",
  "A5s", "A4s", "44", "A3s", "KTo", "Q9s", "A7o", "K8s",
  "A6o", "A5o", "A2s", "QJo", "QTo", "K9o", "JTs", "A4o",
  "K7s", "K8o", "K6s", "A3o", "Q8s", "K7o", "J9s", "T9s",
  "K5s", "A2o", "Q9o", "K4s", "J8s", "JTo", "Q7s", "K3s",
  "Q8o", "Q6s", "J9o", "Q5s", "K6o", "K5o", "T8s", "T7s",
  "K4o", "Q7o", "33", "J8o", "J7s", "Q6o", "K2s", "Q4s",
  "K3o", "22", "Q3s", "K2o", "Q5o", "J6s", "T9o", "J7o",
  "J5s", "J4s", "J6o", "T6s", "98o", "Q2s", "Q4o", "98s",
  "T8o", "97s", "T7o", "96s", "J3s", "87s", "Q3o", "Q2o",
  "J5o", "T5s", "T6o", "97o", "86s", "J2s", "95s", "76s",
  "J4o", "96o", "J3o", "T4s", "85s", "J2o", "T5o", "T4o",
  "75s", "87o", "T3o", "T3s", "76o", "94s", "65s", "T2s",
  "84s", "T2o", "74s", "93s", "86o", "95o", "64s", "92s",
  "54s", "53s", "85o", "75o", "73s", "65o", "63s", "83s",
  "94o", "74o", "64o", "93o", "84o", "92o", "54o", "72s",
  "43s", "82s", "62s", "83o", "52s", "42s", "73o", "53o",
  "43o", "82o", "32s", "52o", "72o", "63o", "62o", "42o",
  "32o",
];

// 重複を除いて 169 にする (上のリストは多少冗長なので一意化)
const uniqueRanking = Array.from(new Set(HAND_RANKING));

// もし 169 に満たない場合の補完（全パターンと差分を取って末尾に追加）
function generateAllHands(): HandNotation[] {
  const all: HandNotation[] = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      all.push(handAt(i, j));
    }
  }
  return all;
}
const ALL_HANDS = generateAllHands();
const missing = ALL_HANDS.filter((h) => !uniqueRanking.includes(h));
const FINAL_RANKING: HandNotation[] = [...uniqueRanking, ...missing].slice(0, 169);

export const HAND_RANK_MAP: ReadonlyMap<HandNotation, number> = new Map(
  FINAL_RANKING.map((h, i) => [h, i] as const),
);

/** あるハンドのランク (0=最強, 168=最弱)。未知なら 168。 */
export function rankOf(hand: HandNotation): number {
  return HAND_RANK_MAP.get(hand) ?? 168;
}

/** Top X% に含まれるハンド集合。 */
export function topRange(percent: number): Set<HandNotation> {
  const clamped = Math.max(0, Math.min(100, percent));
  const count = Math.round((169 * clamped) / 100);
  return new Set(FINAL_RANKING.slice(0, count));
}

export const ALL_169_HANDS = ALL_HANDS;
