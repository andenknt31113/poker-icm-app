import { describe, expect, it } from "vitest";
import { nashRangeForSpot } from "../src/nashRange.js";
import { comboPctOfRange, topRangeByComboPct } from "../src/handRanking.js";
import type { Position } from "../src/appState.js";

const seat = (stack: number, position: Position) => ({ stack, position });
const SB = 0.5;
const BB = 1;

describe("nashRangeForSpot (相手レンジに入れる Nash)", () => {
  it("2人・10BB・勝者総取りは、押す側 約58% / 受ける側 約37%", () => {
    const table = [seat(10, "BTN"), seat(10, "BB")];
    const push = nashRangeForSpot(table, [100], 0, 1, SB, BB, 0, "push")!;
    const call = nashRangeForSpot(table, [100], 0, 1, SB, BB, 0, "call")!;
    expect(comboPctOfRange(push)).toBeGreaterThan(55);
    expect(comboPctOfRange(push)).toBeLessThan(61);
    expect(comboPctOfRange(call)).toBeGreaterThan(34);
    expect(comboPctOfRange(call)).toBeLessThan(40);
  });

  it("同じ広さの「上位 X%」には入らない小さいペアを含む", () => {
    const table = [seat(10, "BTN"), seat(10, "BB")];
    const call = nashRangeForSpot(table, [100], 0, 1, SB, BB, 0, "call")!;
    const sameSizeTop = topRangeByComboPct(Math.round(comboPctOfRange(call)));
    expect(call.has("22")).toBe(true);
    expect(sameSizeTop.has("22")).toBe(false);
  });

  it("バブルでは受ける側のレンジが勝者総取りより狭くなる", () => {
    const table = [seat(15, "SB"), seat(15, "BB"), seat(4, "BTN"), seat(20, "CO")];
    const bubble = nashRangeForSpot(table, [50, 30, 20], 0, 1, SB, BB, 1, "call")!;
    const chip = nashRangeForSpot(table, [100], 0, 1, SB, BB, 1, "call")!;
    expect(comboPctOfRange(bubble)).toBeLessThan(comboPctOfRange(chip));
    expect(bubble.has("AA")).toBe(true);
  });

  it("成り立たない局面は null", () => {
    const table = [seat(10, "BTN"), seat(10, "BB")];
    expect(nashRangeForSpot(table, [100], 0, 0, SB, BB, 0, "push")).toBeNull();
    expect(nashRangeForSpot(table, [], 0, 1, SB, BB, 0, "push")).toBeNull();
    expect(nashRangeForSpot(table, [100], -1, 1, SB, BB, 0, "push")).toBeNull();
  });
});
