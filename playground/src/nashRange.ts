// ===== いまの局面の push/fold Nash を解く =====
//
// Nash タブと「この局面の Nash を相手レンジに入れる」ボタンが共用する (DOM 非依存)。
//   - 押す人の後ろに 2 人以上残っているときは、全員のコールを入れた多人数モデル
//     (core solveMultiwayPushFold。2 人目のコール = オーバーコールは扱わない)
//   - 後ろが 1 人、またはポジション未設定の卓は、従来の 2 人モデル (solveHUNash)
import { solveHUNash, solveMultiwayPushFold, solveOvercallPushFold, type Payouts } from "@poker-icm/core";
import { ALL_169_HANDS, type HandNotation } from "./handRanking.js";
import { huEquity } from "./huEquityMatrix.js";
import { comboCountVsHero } from "./rangeEquity.js";
import { buildPushSpot } from "./pushSpot.js";
import { buildMultiwaySpot, type MultiwaySpot } from "./multiwaySpot.js";
import { hasThreeWayTable, threeWayEquity } from "./threeWay.js";
import { actionOrderIdx, type Player } from "./appState.js";

type SeatLike = Pick<Player, "stack" | "position">;

const NASH_MAX_ITERATIONS = 500;
const NASH_CONVERGENCE_TOLERANCE = 0.001;
// オーバーコールつきの計算 (solveOvercallPushFold) の収束設定
const OVERCALL_CONVERGENCE_TOLERANCE = 0.0001;
const OVERCALL_MAX_ITERATIONS = 1500;
const OVERCALL_OUTER_ITERATIONS = 10;

export interface SpotNashResult {
  readonly pushFreq: ReadonlyMap<HandNotation, number>;
  readonly pushRange: ReadonlySet<HandNotation>;
  /** callerIndex の人のコール頻度・レンジ。 */
  readonly callFreq: ReadonlyMap<HandNotation, number>;
  readonly callRange: ReadonlySet<HandNotation>;
  /** 押す人の後ろにいる、callerIndex 以外の人のコールレンジ (行動順)。2 人モデルでは空。 */
  readonly others: readonly { readonly index: number; readonly range: ReadonlySet<HandNotation> }[];
  readonly converged: boolean;
}

/** 押す人 (pusherIndex) と、注目するコール側 (callerIndex) を決めて Nash を解く。不正な入力は例外。 */
export function solveSpotNash(
  table: readonly SeatLike[],
  payouts: Payouts,
  pusherIndex: number,
  callerIndex: number,
  sb: number,
  bb: number,
  totalAnte: number,
): SpotNashResult {
  const multi = buildMultiwaySpot(table, pusherIndex, sb, bb, totalAnte);
  if (multi && multi.callerIndices.length > 1 && multi.callerIndices.includes(callerIndex)) {
    const all = solvePusherNash(table, payouts, pusherIndex, sb, bb, totalAnte)!;
    const mine = all.callers.find((caller) => caller.index === callerIndex)!;
    return {
      pushFreq: new Map([...all.pushRange].map((hand) => [hand, 1])),
      pushRange: all.pushRange,
      callFreq: new Map([...mine.range].map((hand) => [hand, 1])),
      callRange: mine.range,
      others: all.callers.filter((caller) => caller.index !== callerIndex).map(({ index, range }) => ({ index, range })),
      converged: all.converged,
    };
  }

  // 実際のポジションの blind / BB ante / 第三者の dead money で 2 人の局面を組む
  const spot = buildPushSpot(table, pusherIndex, callerIndex, sb, bb, totalAnte);
  const result = solveHUNash({
    stacks: spot.stacks,
    payouts,
    sbIndex: pusherIndex,
    bbIndex: callerIndex,
    sb,
    bb,
    ante: 0,
    pusherBlind: spot.pusherBlind,
    callerBlind: spot.callerBlind,
    deadMoney: spot.deadMoney,
    huEquity,
    allHands: ALL_169_HANDS,
    // カードリムーバル込みのコンボ重みで best response を厳密化（被搾取度を低減）。
    comboWeight: comboCountVsHero,
    maxIterations: NASH_MAX_ITERATIONS,
    convergenceTolerance: NASH_CONVERGENCE_TOLERANCE,
  });
  return {
    pushFreq: result.sbPushFreq,
    pushRange: result.sbPushRange,
    callFreq: result.bbCallFreq,
    callRange: result.bbCallRange,
    others: [],
    converged: result.converged,
  };
}

/**
 * 相手レンジに入れるための Nash レンジ。want = "push" なら押す側、"call" なら
 * callerIndex の人のレンジ。局面が成り立たないときは null。
 */
export function nashRangeForSpot(
  table: readonly SeatLike[],
  payouts: Payouts,
  pusherIndex: number,
  callerIndex: number,
  sb: number,
  bb: number,
  totalAnte: number,
  want: "push" | "call",
): Set<HandNotation> | null {
  if (pusherIndex < 0 || callerIndex < 0 || pusherIndex === callerIndex) return null;
  if (payouts.length === 0 || !(sb > 0) || !(bb > 0) || !(totalAnte >= 0)) return null;
  try {
    const result = solveSpotNash(table, payouts, pusherIndex, callerIndex, sb, bb, totalAnte);
    return new Set(want === "push" ? result.pushRange : result.callRange);
  } catch {
    return null;
  }
}

export interface CallerNash {
  readonly index: number;
  readonly range: ReadonlySet<HandNotation>;
  /**
   * この人がコールしたあと、さらに後ろの人がコールする (オーバーコール) レンジ。行動順。
   * 3 人の勝率表が読めていないときは空。
   */
  readonly overcalls: readonly { readonly index: number; readonly range: ReadonlySet<HandNotation> }[];
}

export interface PusherNash {
  readonly pusherIndex: number;
  readonly pushRange: ReadonlySet<HandNotation>;
  /** 押す人の後ろにいる全員のコールレンジ (行動順)。 */
  readonly callers: readonly CallerNash[];
  readonly converged: boolean;
  /** オーバーコールを計算に入れたか。 */
  readonly withOvercall: boolean;
  /** この席が押すか降りるかを選ぶ時点での、全員の $ の期待値。 */
  readonly values: readonly number[];
}

/**
 * 1 席ぶんを解く。後ろに 2 人以上いて 3 人の勝率表があれば、オーバーコールつき。
 * foldEquities は「この人が降りたあと、次の人が押すか降りるかを選ぶ局面」での全員の $。
 */
function solveNode(
  table: readonly SeatLike[],
  payouts: Payouts,
  multi: MultiwaySpot,
  bb: number,
  foldEquities: readonly number[] | undefined,
): PusherNash {
  const common = {
    stacks: table.map((seat) => seat.stack),
    payouts,
    pusherIndex: multi.pusherIndex,
    callerIndices: multi.callerIndices,
    blinds: multi.blinds,
    antes: multi.antes,
    foldWinnerIndex: multi.foldWinnerIndex,
    foldEquities,
    huEquity,
    allHands: ALL_169_HANDS,
    comboWeight: comboCountVsHero,
    bigBlind: bb,
  };
  if (hasThreeWayTable() && multi.callerIndices.length > 1) {
    // バブル前後は「押しても降りてもほぼ同じ」ハンドが多く、粗い収束だと設定しだいでレンジが
    // 数ポイント動く。オーバーコールつきは収束を厳しめにして、結果が安定するところまで回す。
    const result = solveOvercallPushFold({
      ...common,
      threeWay: threeWayEquity,
      convergenceTolerance: OVERCALL_CONVERGENCE_TOLERANCE,
      maxIterations: OVERCALL_MAX_ITERATIONS,
      outerIterations: OVERCALL_OUTER_ITERATIONS,
    });
    return {
      pusherIndex: multi.pusherIndex,
      pushRange: result.pushRange,
      callers: multi.callerIndices.map((index, k) => ({
        index,
        range: result.callRanges[k]!,
        overcalls: result.overcallRanges[k]!.map((range, m) => ({ index: multi.callerIndices[k + 1 + m]!, range })),
      })),
      converged: result.converged,
      withOvercall: true,
      values: result.values,
    };
  }
  const result = solveMultiwayPushFold({
    ...common,
    convergenceTolerance: multi.callerIndices.length > 1 ? NASH_CONVERGENCE_TOLERANCE : OVERCALL_CONVERGENCE_TOLERANCE,
    maxIterations: multi.callerIndices.length > 1 ? NASH_MAX_ITERATIONS : OVERCALL_MAX_ITERATIONS,
  });
  return {
    pusherIndex: multi.pusherIndex,
    pushRange: result.pushRange,
    callers: multi.callerIndices.map((index, k) => ({ index, range: result.callRanges[k]!, overcalls: [] })),
    converged: result.converged,
    withOvercall: false,
    values: result.values,
  };
}

/**
 * 最初に押せる席 (チップがあって、後ろにまだ人がいる席) を行動順に返す。
 * 全員のポジションが決まっていなければ null。
 */
export function pusherOrder(table: readonly SeatLike[]): number[] | null {
  const orders = table.map((seat) => actionOrderIdx(seat.position));
  if (orders.some((order) => order < 0)) return null;
  const last = Math.max(...orders);
  return table
    .map((_, i) => i)
    .filter((i) => table[i]!.stack > 0 && orders[i]! < last)
    .sort((a, b) => orders[a]! - orders[b]!);
}

/**
 * 卓全体の Nash を、後ろの席から 1 席ずつ解いていくための入れ物。
 *
 * 「自分が降りたら、次の人が押すか降りるかを選ぶ」ので、ある席の降りたときの損得は、
 * 次の席の局面を解いた結果で決まる。そのため SB → BTN → CO … と後ろから順に解き、
 * 解けた局面の $ の期待値 (values) を、1 つ前の席の「降りたとき」に渡す。
 */
export interface NashChain {
  /** 押せる席 (行動順)。 */
  readonly pushers: readonly number[];
  /** まだ解いていない席があれば 1 席ぶん解いて返す (後ろの席から)。なければ null。 */
  next(): PusherNash | null;
}

export function createNashChain(
  table: readonly SeatLike[],
  payouts: Payouts,
  sb: number,
  bb: number,
  totalAnte: number,
): NashChain | null {
  const pushers = pusherOrder(table);
  if (!pushers || pushers.length === 0) return null;
  let cursor = pushers.length - 1;
  let foldEquities: readonly number[] | undefined;
  return {
    pushers,
    next(): PusherNash | null {
      while (cursor >= 0) {
        const pusher = pushers[cursor--]!;
        const multi = buildMultiwaySpot(table, pusher, sb, bb, totalAnte);
        if (!multi) continue;
        const result = solveNode(table, payouts, multi, bb, foldEquities);
        foldEquities = result.values;
        return result;
      }
      return null;
    },
  };
}

/**
 * pusherIndex の人が最初に押す場合の Nash を、後ろの全員ぶんまとめて返す。
 * その人より後ろの席の局面も順に解く (降りたときの損得に必要なため)。
 * 全員のポジションが決まっていない卓や、後ろに誰もいない場合は null。
 */
export function solvePusherNash(
  table: readonly SeatLike[],
  payouts: Payouts,
  pusherIndex: number,
  sb: number,
  bb: number,
  totalAnte: number,
): PusherNash | null {
  const chain = createNashChain(table, payouts, sb, bb, totalAnte);
  if (!chain || !chain.pushers.includes(pusherIndex)) return null;
  for (let result = chain.next(); result; result = chain.next()) {
    if (result.pusherIndex === pusherIndex) return result;
  }
  return null;
}
