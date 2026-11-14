// ===== チョップ (ディール) の配分 =====
//
// 残っている人で賞金を分けるときの金額を出す (DOM 非依存)。
//   - ICM チョップ: 各自の ICM 賞金期待値どおりに分ける。一般的に公平とされる方法
//   - チップ比例: 残り全員に最下位ぶんを保証し、残りをチップの比で分ける。
//     チップリーダーが1位賞金より多く受け取ることがあるので参考扱い
import { calculateICM, type Payouts, type Stacks } from "@poker-icm/core";

export interface ChopResult {
  /** 分ける賞金の合計 (残っている人数ぶんの順位の賞金)。 */
  readonly total: number;
  readonly icm: number[];
  readonly chip: number[];
}

/**
 * 金額を unit 刻みに丸める。丸めた後の合計が total に合うよう、切り捨てで余った
 * ぶんを端数の大きい人から unit ずつ配る (最大剰余方式)。total が unit で割り切れ
 * ない残りは、いちばん取り分の多い人に足す。unit が 0 以下なら丸めない。
 */
export function roundToTotal(values: readonly number[], unit: number, total: number): number[] {
  if (!(unit > 0)) return values.slice();
  const floors = values.map((v) => Math.floor(v / unit + 1e-9) * unit);
  const remainders = values.map((v, i) => v - floors[i]!);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = values.map((_, i) => i).sort((a, b) => remainders[b]! - remainders[a]! || values[b]! - values[a]!);
  for (const i of order) {
    if (left < unit - 1e-9) break;
    floors[i]! += unit;
    left -= unit;
  }
  if (left > 1e-9 && values.length > 0) {
    const top = values.indexOf(Math.max(...values));
    floors[top]! += left;
  }
  return floors;
}

/** ICM チョップとチップ比例チョップの金額。unit で丸める (0 なら丸めない)。 */
export function calculateChop(stacks: Stacks, payouts: Payouts, unit = 0): ChopResult {
  const n = stacks.length;
  const paid = payouts.slice(0, n);
  const total = paid.reduce((a, b) => a + b, 0);
  const chips = stacks.reduce((a, b) => a + b, 0);
  if (n === 0 || !(chips > 0)) return { total, icm: [], chip: [] };

  const icm = calculateICM(stacks, payouts).slice();
  // 全員が最低でも受け取る額 = 残り人数の最下位の賞金 (入賞枠が人数より少なければ 0)
  const floorPrize = paid.length === n ? Math.min(...paid) : 0;
  const rest = total - floorPrize * n;
  const chip = stacks.map((s) => floorPrize + (rest * s) / chips);

  return {
    total,
    icm: roundToTotal(icm, unit, total),
    chip: roundToTotal(chip, unit, total),
  };
}
