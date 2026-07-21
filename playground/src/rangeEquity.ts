/**
 * レンジ対レンジの equity 計算 (169 ハンドクラス抽象 + カードリムーバル)。
 *
 * 従来のカスタムレンジ equity は「レンジの平均ランクから相当する Top X% を推定して
 * テーブルを引く」という粗い近似だった (レンジの形を無視するため、二極化した
 * カスタムレンジなどで数ポイント単位のズレが出る)。ここでは
 * HU 169×169 マトリクス (各ペア MC 20,000 試行) を、hero の実カードを考慮した
 * コンボ数 (カードリムーバル/ブロッカー効果) で重み付き平均する方式に置き換える。
 *
 * 例: hero が AKs を持つと、相手の AA は 6→3 コンボ、AKo は 12→7 コンボに減る。
 * この効果は AX/KX ブロッカーを持つハンドの対レンジ equity を体感できるレベル
 * (最大 1〜2pt) で動かすため、境界判定の精度に直結する。
 *
 * ハンドクラスは具体的スートを持たないため、代表コンボ (pair: A♠A♥ 相当、
 * suited: 同スート、offsuit: 異スート) を固定してコンボ数を数える。
 * これは 169 抽象での標準的な扱いで、クラス内のスート対称性から誤差は生じない。
 */
import { rankOf, ALL_169_HANDS, type HandNotation } from "./handRanking.js";
import { huEquity } from "./huEquityMatrix.js";

/** "AKs" → ["A","K","s"] 形式の分解。pair は suit 部が undefined。 */
function parseHand(h: HandNotation): { r1: string; r2: string; suited: boolean; pair: boolean } {
  const r1 = h[0]!;
  const r2 = h[1]!;
  const pair = r1 === r2;
  const suited = !pair && h[2] === "s";
  return { r1, r2, suited, pair };
}

/**
 * hero がハンドクラス heroHand (代表コンボ) を持つときの、villain ハンドクラスの
 * 残りコンボ数。
 *
 * 代表コンボの取り方:
 *   - pair "AA"   → A♠ A♥
 *   - suited "AKs" → A♠ K♠
 *   - offsuit "AKo"→ A♠ K♥
 *
 * villain 側:
 *   - pair rr    → 残り r が n 枚なら C(n,2)
 *   - suited xy  → x と y が両方残っているスートの数
 *   - offsuit xy → (残り x 枚数)×(残り y 枚数) − suited コンボ数
 */
export function comboCountVsHero(heroHand: HandNotation, villainHand: HandNotation): number {
  const hero = parseHand(heroHand);
  const vil = parseHand(villainHand);

  // hero の代表コンボが占有するカード: rank → 占有スート集合
  // スートは 0..3 (0=♠, 1=♥) とする。
  const held = new Map<string, Set<number>>();
  const take = (rank: string, suit: number): void => {
    let s = held.get(rank);
    if (!s) {
      s = new Set<number>();
      held.set(rank, s);
    }
    s.add(suit);
  };
  if (hero.pair) {
    take(hero.r1, 0);
    take(hero.r1, 1);
  } else if (hero.suited) {
    take(hero.r1, 0);
    take(hero.r2, 0);
  } else {
    take(hero.r1, 0);
    take(hero.r2, 1);
  }

  const heldCount = (rank: string): number => held.get(rank)?.size ?? 0;
  const isFree = (rank: string, suit: number): boolean => !held.get(rank)?.has(suit);

  if (vil.pair) {
    const n = 4 - heldCount(vil.r1);
    return (n * (n - 1)) / 2;
  }
  const freeX = 4 - heldCount(vil.r1);
  const freeY = 4 - heldCount(vil.r2);
  let suitedCombos = 0;
  for (let s = 0; s < 4; s++) {
    if (isFree(vil.r1, s) && isFree(vil.r2, s)) suitedCombos++;
  }
  if (vil.suited) return suitedCombos;
  return freeX * freeY - suitedCombos;
}

/**
 * hero ハンドクラスの、villain レンジ (169 クラスの集合) に対する equity。
 * HU マトリクスをカードリムーバル込みコンボ数で重み付き平均する。
 * レンジが空なら 0.5 (対戦相手なし = 中立)。
 */
export function matrixEquityVsRange(hand: HandNotation, range: Set<HandNotation>): number {
  if (range.size === 0) return 0.5;
  let num = 0;
  let den = 0;
  for (const v of range) {
    const w = comboCountVsHero(hand, v);
    if (w <= 0) continue; // 完全ブロック (hero AA vs villain AA の残1コンボ未満は起きないが保険)
    num += w * huEquity(hand, v);
    den += w;
  }
  return den > 0 ? num / den : 0.5;
}

/**
 * range が「本ツールの強度順の上位 k 個ちょうど」(= topRange(X) の形) かどうか。
 * この形なら Top X% 用の MC 事前計算テーブル (レンジ全体を実際に配って回した値)
 * のほうが抽象誤差が小さいため、そちらを優先させる判定に使う。
 */
export function isTopPrefixRange(range: Set<HandNotation>): boolean {
  if (range.size === 0 || range.size > ALL_169_HANDS.length) return false;
  let maxRank = -1;
  for (const h of range) {
    const r = rankOf(h);
    if (r > maxRank) maxRank = r;
  }
  return maxRank === range.size - 1;
}
