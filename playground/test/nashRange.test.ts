import { describe, expect, it } from "vitest";
import { nashRangeForSpot, solveSpotNash } from "../src/nashRange.js";
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

describe("solveSpotNash (後ろに複数人いる局面)", () => {
  it("3人卓で BTN が押す: 後ろが BB だけの場合より狭く、SB と BB の両方のレンジが出る", () => {
    const three = [seat(10, "BTN"), seat(10, "SB"), seat(10, "BB")];
    const r = solveSpotNash(three, [100], 0, 2, SB, BB, 0);
    expect(r.converged).toBe(true);
    expect(r.others.map((o) => o.index)).toEqual([1]);
    // SB を降りた扱いにした 2 人モデル相当 (SB のスタックを 0 にして後ろから外す)
    const alone = solveSpotNash([seat(10, "BTN"), seat(0, "SB"), seat(10, "BB")], [100], 0, 2, SB, BB, 0);
    expect(comboPctOfRange(r.pushRange)).toBeLessThan(comboPctOfRange(alone.pushRange));
    // 勝者総取り・10BB の BTN は、全ハンドでは押せないが半分近くは押す
    expect(comboPctOfRange(r.pushRange)).toBeGreaterThan(30);
    expect(comboPctOfRange(r.pushRange)).toBeLessThan(55);
    expect(r.callRange.has("AA")).toBe(true);
    expect(r.others[0]!.range.has("AA")).toBe(true);
  });

  it("4人バブルで CO が押す: 2人モデルのように 100% にはならない", () => {
    const table = [seat(18, "BB"), seat(14, "SB"), seat(20, "BTN"), seat(17.3, "CO")];
    const r = solveSpotNash(table, [50, 30, 20], 3, 1, SB, BB, 1);
    expect(r.converged).toBe(true);
    expect(comboPctOfRange(r.pushRange)).toBeLessThan(90);
    expect(r.others.map((o) => o.index)).toEqual([2, 0]);
  });

  it("後ろが 1 人のときは 2 人モデルのまま (others は空)", () => {
    const r = solveSpotNash([seat(10, "BTN"), seat(10, "BB")], [100], 0, 1, SB, BB, 0);
    expect(r.others).toEqual([]);
  });
});
