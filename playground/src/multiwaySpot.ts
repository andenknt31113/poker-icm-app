// ===== 後ろに複数人残っている push/fold 局面の入力 =====
//
// 押す人の後ろ (行動順で後) に残っている全員を「コールするかもしれない人」として、
// core の solveMultiwayPushFold に渡す形を実際のポジションから組み立てる (DOM 非依存)。
//   - blind は SB / BB の人が払う (2人卓の BTN は SB)。持っている分まで
//   - ante は BB ante 構造: BB の人がテーブル合計を払う
//   - 押す人より前の人は降りた前提 (blind を置いていないので何も失わない)
import { actionOrderIdx, posToPotOddsPos, type Player } from "./appState.js";

export interface MultiwaySpot {
  readonly pusherIndex: number;
  /** 押す人の後ろに残っている人。行動順。 */
  readonly callerIndices: number[];
  readonly blinds: number[];
  readonly antes: number[];
  /** 押す人が降りたときにポットを取る人 (BB)。 */
  readonly foldWinnerIndex: number;
}

type SeatLike = Pick<Player, "stack" | "position">;

/**
 * 全員のポジションが決まっていて BB の人がいるときだけ組み立てる。
 * それ以外 (ポジション未設定など) は null を返し、呼び出し側は2人モデルに戻す。
 */
export function buildMultiwaySpot(
  table: readonly SeatLike[],
  pusherIndex: number,
  sb: number,
  bb: number,
  totalAnte: number,
): MultiwaySpot | null {
  const n = table.length;
  const orders = table.map((seat) => actionOrderIdx(seat.position));
  if (pusherIndex < 0 || pusherIndex >= n || orders.some((order) => order < 0)) return null;
  const kinds = table.map((seat) => posToPotOddsPos(seat.position, n));
  const bbIndex = kinds.indexOf("BB");
  if (bbIndex < 0 || bbIndex === pusherIndex) return null;

  const antes = table.map((seat, i) => (i === bbIndex ? Math.min(totalAnte, seat.stack) : 0));
  const blinds = table.map((seat, i) => {
    const blind = kinds[i] === "SB" ? sb : kinds[i] === "BB" ? bb : 0;
    return Math.min(blind, seat.stack - antes[i]!);
  });
  if (!(table[pusherIndex]!.stack - antes[pusherIndex]! > 0)) return null;

  const callerIndices = table
    .map((_, i) => i)
    .filter((i) => i !== pusherIndex && orders[i]! > orders[pusherIndex]! && table[i]!.stack - antes[i]! > 0)
    .sort((a, b) => orders[a]! - orders[b]!);
  if (callerIndices.length === 0) return null;

  return { pusherIndex, callerIndices, blinds, antes, foldWinnerIndex: bbIndex };
}
