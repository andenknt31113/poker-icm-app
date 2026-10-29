/**
 * 169 種類のスターティングハンドを「強さ順」に並べたランキング。
 *
 * 順位は対ランダムハンドの equity 順 (PokerStove の Top X% と同じ考え方)。
 * プリセットの「上位 X%」はこの順の先頭から X% の種類数を取る。
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
 * 自動生成: `hu-equity-matrix.json` から、カードリムーバル込みのコンボ数で重み付けした
 * vs 全 169 クラス (= ランダムハンド) の equity を降順ソート (AA 85.2% / KK 82.4% /
 * 72o 34.6% など既知値と一致)。同値は旧ランキングの順で並べる。
 *
 * 再生成: `npx tsx scripts/build-hand-ranking.mts` の出力でこの配列を置き換える。
 */
export const HAND_RANKING: HandNotation[] = [
  "AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs",
  "77", "AQs", "AJs", "AKo", "ATs", "AQo", "AJo", "KQs",
  "66", "A9s", "ATo", "KJs", "A8s", "KTs", "KQo", "A7s",
  "A9o", "KJo", "55", "QJs", "K9s", "A5s", "A6s", "A8o",
  "KTo", "QTs", "A4s", "A7o", "K8s", "A3s", "QJo", "K9o",
  "A5o", "A6o", "Q9s", "K7s", "JTs", "A2s", "QTo", "44",
  "A4o", "K6s", "K8o", "Q8s", "A3o", "K5s", "J9s", "Q9o",
  "JTo", "K7o", "A2o", "K4s", "Q7s", "K6o", "K3s", "T9s",
  "J8s", "33", "Q6s", "Q8o", "K5o", "J9o", "K2s", "Q5s",
  "T8s", "K4o", "J7s", "Q4s", "Q7o", "T9o", "J8o", "K3o",
  "Q3s", "Q6o", "98s", "T7s", "J6s", "K2o", "22", "Q2s",
  "Q5o", "J5s", "T8o", "J7o", "Q4o", "97s", "J4s", "T6s",
  "J3s", "Q3o", "98o", "87s", "T7o", "J6o", "96s", "J2s",
  "Q2o", "T5s", "J5o", "T4s", "97o", "86s", "J4o", "T6o",
  "95s", "T3s", "76s", "J3o", "87o", "T2s", "85s", "96o",
  "J2o", "T5o", "94s", "75s", "T4o", "93s", "86o", "65s",
  "84s", "95o", "T3o", "92s", "76o", "74s", "T2o", "54s",
  "85o", "64s", "83s", "94o", "75o", "82s", "73s", "93o",
  "65o", "53s", "63s", "84o", "92o", "43s", "74o", "54o",
  "72s", "64o", "52s", "62s", "83o", "42s", "82o", "73o",
  "53o", "63o", "32s", "43o", "72o", "52o", "62o", "42o",
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

/**
 * コンボ比率で「上位 X%」を取る。強度順の先頭から足していき、コンボ比率が
 * X% に最も近い所で切る (同じ近さなら狭い方)。スライダーなど画面上の % はこちら。
 */
export function topRangeByComboPct(percent: number): Set<HandNotation> {
  const clamped = Math.max(0, Math.min(100, percent));
  const target = (TOTAL_COMBOS * clamped) / 100;
  let combos = 0;
  let bestCount = 0;
  let bestDiff = target;
  for (let i = 0; i < FINAL_RANKING.length; i++) {
    combos += comboCount(FINAL_RANKING[i]!);
    const diff = Math.abs(combos - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestCount = i + 1;
    }
  }
  return new Set(FINAL_RANKING.slice(0, bestCount));
}

/** 種類ベースの topRange(percent) が実際に占めるコンボ比率 (表示用に四捨五入)。 */
export function comboPctOfTopRange(percent: number): number {
  return Math.round(comboPctOfRange(topRange(percent)));
}
