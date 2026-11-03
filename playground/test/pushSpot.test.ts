import { describe, expect, it } from "vitest";
import {
  buildPushSpot,
  pushDepthTier,
  PUSH_FOLD_OK_MAX_BB,
  PUSH_FOLD_CAUTION_MAX_BB,
} from "../src/pushSpot.js";
import type { Position } from "../src/appState.js";

const seat = (stack: number, position: Position) => ({ stack, position });
const SB = 0.5;
const BB = 1;

describe("buildPushSpot (実際のポジションの blind・ante)", () => {
  it("SB → BB: 自分が SB・相手が BB を払い、BB ante は相手のスタックから引く", () => {
    const table = [seat(10, "BTN"), seat(12, "SB"), seat(15, "BB")];
    expect(buildPushSpot(table, 1, 2, SB, BB, 1)).toEqual({
      stacks: [10, 12, 14],
      pusherBlind: 0.5,
      callerBlind: 1,
      deadMoney: 1,
    });
  });

  it("BTN → BB: 自分は blind なし、降りた SB の blind と BB ante が dead money", () => {
    const table = [seat(10, "BTN"), seat(12, "SB"), seat(15, "BB")];
    expect(buildPushSpot(table, 0, 2, SB, BB, 1)).toEqual({
      stacks: [10, 11.5, 14],
      pusherBlind: 0,
      callerBlind: 1,
      deadMoney: 1.5,
    });
  });

  it("CO → BTN: 降りた SB・BB の blind と BB ante がすべて dead money", () => {
    const table = [seat(10, "BTN"), seat(12, "SB"), seat(15, "BB"), seat(8, "CO")];
    expect(buildPushSpot(table, 3, 0, SB, BB, 1)).toEqual({
      stacks: [10, 11.5, 13, 8],
      pusherBlind: 0,
      callerBlind: 0,
      deadMoney: 2.5,
    });
  });

  it("2人卓: BTN が SB を払う", () => {
    const table = [seat(10, "BTN"), seat(10, "BB")];
    expect(buildPushSpot(table, 0, 1, SB, BB, 0)).toEqual({
      stacks: [10, 10],
      pusherBlind: 0.5,
      callerBlind: 1,
      deadMoney: 0,
    });
  });

  it("第三者は持っている分しか払わない (0.3BB の SB)", () => {
    const table = [seat(10, "BTN"), seat(0.3, "SB"), seat(15, "BB")];
    const spot = buildPushSpot(table, 0, 2, SB, BB, 0);
    expect(spot.stacks[1]).toBe(0);
    expect(spot.deadMoney).toBeCloseTo(0.3, 10);
  });

  it("ポジション未設定なら 自分=SB・相手=BB (ante も相手) とみなす", () => {
    const table = [seat(10, ""), seat(12, ""), seat(15, "")];
    expect(buildPushSpot(table, 0, 2, SB, BB, 1)).toEqual({
      stacks: [10, 12, 14],
      pusherBlind: 0.5,
      callerBlind: 1,
      deadMoney: 1,
    });
  });

  it("チップの合計は変わらない (ポット + 各スタック = 元の合計)", () => {
    const table = [seat(10, "BTN"), seat(12, "SB"), seat(15, "BB"), seat(8, "CO")];
    const spot = buildPushSpot(table, 3, 2, SB, BB, 1);
    const before = table.reduce((a, s) => a + s.stack, 0);
    const after = spot.stacks.reduce((a, s) => a + s, 0) + spot.deadMoney;
    expect(after).toBeCloseTo(before, 10);
  });
});

describe("pushDepthTier (自分から押す判断の深さ区分)", () => {
  it("12BB 以下は ok、12〜20BB は caution、20BB 超は outOfRange", () => {
    expect(pushDepthTier(8)).toBe("ok");
    expect(pushDepthTier(PUSH_FOLD_OK_MAX_BB)).toBe("ok");
    expect(pushDepthTier(PUSH_FOLD_OK_MAX_BB + 0.1)).toBe("caution");
    expect(pushDepthTier(PUSH_FOLD_CAUTION_MAX_BB)).toBe("caution");
    expect(pushDepthTier(PUSH_FOLD_CAUTION_MAX_BB + 0.1)).toBe("outOfRange");
  });

  it("NaN は ok 扱い (注意を出さない)", () => {
    expect(pushDepthTier(Number.NaN)).toBe("ok");
  });
});
