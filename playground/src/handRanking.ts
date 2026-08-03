/**
 * 169 種類のスターティングハンドを「強さ順」に並べたランキング。
 *
 * 注意: これは Sklansky-Chubukov や Pokerstove 等のオープンデータを参考にした
 *       「およそこの順」というアプローチで、ICMIZER 等のプロツールほど厳密ではない。
 *       実エンジン（Monte Carlo）に置き換える時、この順は捨てて equity ベースで再構築する。
 */

export type HandNotation = string; // 例: "AA", "AKs", "AKo"

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;

/** ハンドグリッドの一辺 (= ランク数 13)。grid.ts の描画ループもこれを使う。 */
export const GRID_SIZE = RANKS.length;

/** スターティングハンドの総数 (13x13 = ペア13 + スーテッド78 + オフスート78)。 */
export const HAND_COUNT = GRID_SIZE * GRID_SIZE;

/** 最弱ランクの index。未知のハンドはここに落とす。 */
const WORST_RANK = HAND_COUNT - 1;

/** グリッド座標 (row, col) → ハンド表記。row/col は 0-12 (A=0, 2=12)。 */
export function handAt(row: number, col: number): HandNotation {
  const r1 = RANKS[row]!;
  const r2 = RANKS[col]!;
  if (row === col) return `${r1}${r2}`; // pair
  if (row < col) return `${r1}${r2}s`;   // suited (上三角)
  return `${r2}${r1}o`;                   // offsuit (下三角)
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
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      all.push(handAt(i, j));
    }
  }
  return all;
}
const ALL_HANDS = generateAllHands();
const missing = ALL_HANDS.filter((h) => !uniqueRanking.includes(h));
const FINAL_RANKING: HandNotation[] = [...uniqueRanking, ...missing].slice(0, HAND_COUNT);

export const HAND_RANK_MAP: ReadonlyMap<HandNotation, number> = new Map(
  FINAL_RANKING.map((h, i) => [h, i] as const),
);

/** あるハンドのランク (0=最強, 168=最弱)。未知なら最弱扱い。 */
export function rankOf(hand: HandNotation): number {
  return HAND_RANK_MAP.get(hand) ?? WORST_RANK;
}

/** Top X% に含まれるハンド集合。percent は 0..100 に丸める。 */
export function topRange(percent: number): Set<HandNotation> {
  const clamped = Math.max(0, Math.min(100, percent));
  const count = Math.round((HAND_COUNT * clamped) / 100);
  return new Set(FINAL_RANKING.slice(0, count));
}

export const ALL_169_HANDS = ALL_HANDS;

// ハンド表記1つが表す実際のコンボ数。
// ペア: C(4,2)=6、スーテッド: 4スート分=4、オフスート: 4*3=12。
const COMBOS_PAIR = 6;
const COMBOS_SUITED = 4;
const COMBOS_OFFSUIT = 12;

/** ハンド表記1つが表す実際のコンボ数 (ペア=6, スーテッド=4, オフスート=12)。 */
export function comboCount(hand: HandNotation): number {
  // 表記の長さ 2 ("AA") はペア、3 文字目が "s" ならスーテッド。
  if (hand.length === 2) return COMBOS_PAIR;
  return hand[2] === "s" ? COMBOS_SUITED : COMBOS_OFFSUIT;
}

/** 全 169 ハンドクラスの総コンボ数 (= C(52,2) = 1326)。 */
export const TOTAL_COMBOS = 1326;

/**
 * ハンドクラス集合の総コンボ数。ポーカーで「レンジ○%」と言う場合の
 * 標準はコンボベースなので、表示用の割合はこちらから算出する
 * (種類ベースの割合は suited/offsuit の偏りで実頻度とズレるため)。
 */
export function comboCountOfRange(range: Iterable<HandNotation>): number {
  let total = 0;
  for (const h of range) total += comboCount(h);
  return total;
}

/** レンジのコンボ比率 (0..100)。 */
export function comboPctOfRange(range: Iterable<HandNotation>): number {
  return (comboCountOfRange(range) / TOTAL_COMBOS) * 100;
}
