// ===== 「相手のオールインを自分がコールする」局面の厳密な必要勝率 =====
//
// 分析タブの必要勝率は以前、BF の線形近似 (calculateRequiredEquity) だった。
// 練習タブと同じ厳密 ICM (fold / コール勝ち / コール負けの3終端を直接解く) に
// そろえるため、実際のポジションから core の入力を組み立てる (DOM 非依存)。
import { calculateExactCallEquity, type Payouts } from "@poker-icm/core";
import { posToPotOddsPos, type Player } from "./appState.js";

type SeatLike = Pick<Player, "stack" | "position">;

/**
 * 厳密 ICM の必要勝率 (0..1)。厳密に解けない局面は null:
 *   - 卓に BB の人がいない (ポジション未設定など。ante と blind の負担者が決まらない)
 *   - 自分か相手が blind / ante を払った時点でチップが残らない
 * null のとき呼び出し側は BF 近似に戻す。
 */
export function exactCallRequiredEquity(
  table: readonly SeatLike[],
  payouts: Payouts,
  heroIndex: number,
  villainIndex: number,
  sb: number,
  bb: number,
  totalAnte: number,
): number | null {
  const n = table.length;
  const kinds = table.map((seat) => posToPotOddsPos(seat.position, n));
  const bbIndex = kinds.indexOf("BB");
  if (bbIndex < 0) return null;
  const sbIndex = kinds.indexOf("SB");
  const heroPosition = kinds[heroIndex];
  const villainPosition = kinds[villainIndex];
  if (heroPosition === undefined || villainPosition === undefined) return null;

  const stacks = table.map((seat) => seat.stack);
  const heroLive = stacks[heroIndex]! - (heroPosition === "BB" ? totalAnte : 0);
  const villainLive = stacks[villainIndex]! - (villainPosition === "BB" ? totalAnte : 0);
  if (!(heroLive > 0) || !(villainLive > 0)) return null;

  const result = calculateExactCallEquity({
    stacks,
    payouts,
    heroIndex,
    villainIndex,
    heroPosition,
    villainPosition,
    sbPlayerIndex: sbIndex >= 0 ? sbIndex : undefined,
    bbPlayerIndex: bbIndex,
    sb,
    bb,
    ante: totalAnte,
  });
  return Number.isFinite(result.requiredEquity) ? result.requiredEquity : null;
}
