// ===== レンジの文字表記 =====
// 169 ハンドの集合を「22+ Ax K5s+ KTo+ T8s+ 97s+ 87s」のような短い表記にする
// (Nash 計算ツールで一般的な書き方)。DOM 非依存。
//   - ペア: 「22+」(AA まで続く) / 「TT-77」(途中まで) / 「55」
//   - 同じハイカード: キッカーが上まで続くなら「K5s+」、途中なら「K9s-K7s」、1つなら「K5s」
//   - スーテッドもオフスートも全部入るハイカードは「Ax」
import type { HandNotation } from "./handRanking.js";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;

/** 連続する index のかたまりに分ける (昇順の配列を受け取る)。 */
function runs(indices: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const i of indices) {
    const last = out[out.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else out.push([i, i]);
  }
  return out;
}

export function rangeToText(range: ReadonlySet<HandNotation>): string {
  const parts: string[] = [];

  // ペア (index 0 = AA)
  const pairs = RANKS.map((r, i) => (range.has(`${r}${r}`) ? i : -1)).filter((i) => i >= 0);
  for (const [from, to] of runs(pairs)) {
    const low = `${RANKS[to]}${RANKS[to]}`;
    if (from === 0 && to > 0) parts.push(`${low}+`);
    else if (from === to) parts.push(low);
    else parts.push(`${RANKS[from]}${RANKS[from]}-${low}`);
  }

  for (let hi = 0; hi < RANKS.length - 1; hi++) {
    const kickers = (suffix: "s" | "o"): number[] => {
      const list: number[] = [];
      for (let lo = hi + 1; lo < RANKS.length; lo++) {
        if (range.has(`${RANKS[hi]}${RANKS[lo]}${suffix}`)) list.push(lo);
      }
      return list;
    };
    const suited = kickers("s");
    const offsuit = kickers("o");
    const all = RANKS.length - 1 - hi;
    if (suited.length === all && offsuit.length === all) {
      parts.push(`${RANKS[hi]}x`);
      continue;
    }
    for (const [suffix, list] of [["s", suited], ["o", offsuit]] as const) {
      for (const [from, to] of runs(list)) {
        const low = `${RANKS[hi]}${RANKS[to]}${suffix}`;
        if (from === to) parts.push(low);
        else if (from === hi + 1) parts.push(`${low}+`);
        else parts.push(`${RANKS[hi]}${RANKS[from]}${suffix}-${low}`);
      }
    }
  }
  return parts.join(" ");
}
