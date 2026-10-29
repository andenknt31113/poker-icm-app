// ===== 「自分がプッシュ・相手がコール」局面のチップ配置 =====
//
// Nash (nashUI.ts) と「自分からオールイン」のレンジ逆算 (handRange.ts) が共用する。
// 実際のポジションから、誰がどの blind を払っているかを決める (DOM 非依存)。
//
//   - SB / BB の blind は実際にそのポジションの人が払う (2人卓の BTN は SB)
//   - ante は BB ante 構造: BB の人がテーブル合計を払い、ポットの dead money になる
//   - 自分・相手以外が払った blind / ante は dead money (降りた前提でポットに残る)
//
// 以前は役割だけで「自分 = SB、相手 = BB」とみなしていたため、BTN からの
// プッシュでも 0.5BB を払った扱いになり、プッシュが実際より広く出ていた。
import { posToPotOddsPos, type Player } from "./appState.js";

export interface PushSpot {
  /** ante と第三者の blind を引いた後のスタック (自分・相手の blind はまだ引かない)。 */
  readonly stacks: number[];
  /** プッシュする側 (自分) が置いている blind。 */
  readonly pusherBlind: number;
  /** コールする側 (相手) が置いている blind。 */
  readonly callerBlind: number;
  /** 2 人以外のチップ (ante・第三者の blind)。勝った側が受け取る。 */
  readonly deadMoney: number;
}

type SeatLike = Pick<Player, "stack" | "position">;

/**
 * push/fold の2択で考えてよい実効スタックの上限 (BB)。これ以下は実戦でも
 * プッシュかフォールドが主な選択肢。
 */
export const PUSH_FOLD_OK_MAX_BB = 12;
/**
 * これを超えると 2BB オープン・リンプ・3ベットが普通の選択肢になり、
 * push/fold の結果はそのまま使えない (Nash の結果は既定で隠す)。
 */
export const PUSH_FOLD_CAUTION_MAX_BB = 20;

export type PushDepthTier = "ok" | "caution" | "outOfRange";

/** 自分から押す判断 (Nash・自分からオールイン) に対する実効スタックの区分。 */
export function pushDepthTier(effectiveBB: number): PushDepthTier {
  if (!(effectiveBB > PUSH_FOLD_OK_MAX_BB)) return "ok";
  if (effectiveBB <= PUSH_FOLD_CAUTION_MAX_BB) return "caution";
  return "outOfRange";
}

export function buildPushSpot(
  table: readonly SeatLike[],
  pusherIndex: number,
  callerIndex: number,
  sb: number,
  bb: number,
  totalAnte: number,
): PushSpot {
  const n = table.length;
  const blindOf = (seat: SeatLike): number => {
    const kind = posToPotOddsPos(seat.position, n);
    return kind === "SB" ? sb : kind === "BB" ? bb : 0;
  };
  const hasPositions =
    table[pusherIndex]?.position !== "" &&
    table[callerIndex]?.position !== "" &&
    table.some((seat) => posToPotOddsPos(seat.position, n) === "BB");

  const stacks = table.map((seat) => seat.stack);
  if (!hasPositions) {
    // ポジション未設定の卓: 自分を SB、相手を BB (ante も相手が払う) とみなす
    const antePaid = Math.min(totalAnte, stacks[callerIndex]!);
    stacks[callerIndex] = stacks[callerIndex]! - antePaid;
    return { stacks, pusherBlind: sb, callerBlind: bb, deadMoney: antePaid };
  }

  let deadMoney = 0;
  let pusherBlind = 0;
  let callerBlind = 0;
  table.forEach((seat, i) => {
    const blind = blindOf(seat);
    const ante = posToPotOddsPos(seat.position, n) === "BB" ? totalAnte : 0;
    const antePaid = Math.min(ante, stacks[i]!);
    stacks[i] = stacks[i]! - antePaid;
    deadMoney += antePaid;
    if (i === pusherIndex) pusherBlind = blind;
    else if (i === callerIndex) callerBlind = blind;
    else {
      const blindPaid = Math.min(blind, stacks[i]!);
      stacks[i] = stacks[i]! - blindPaid;
      deadMoney += blindPaid;
    }
  });
  return { stacks, pusherBlind, callerBlind, deadMoney };
}
