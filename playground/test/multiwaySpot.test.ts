import { describe, expect, it } from "vitest";
import { buildMultiwaySpot } from "../src/multiwaySpot.js";
import type { Position } from "../src/appState.js";

const seat = (stack: number, position: Position) => ({ stack, position });

describe("buildMultiwaySpot (押す人の後ろに残る全員)", () => {
  it("CO が押す: 後ろは BTN → SB → BB の順。blind と BB ante を実ポジションで払う", () => {
    const table = [seat(18, "BB"), seat(14, "SB"), seat(20, "BTN"), seat(17, "CO")];
    expect(buildMultiwaySpot(table, 3, 0.5, 1, 1)).toEqual({
      pusherIndex: 3,
      callerIndices: [2, 1, 0],
      blinds: [1, 0.5, 0, 0],
      antes: [1, 0, 0, 0],
      foldWinnerIndex: 0,
    });
  });

  it("SB が押す: 後ろは BB だけ (押す人より前の BTN・CO は降りた前提)", () => {
    const table = [seat(18, "BB"), seat(14, "SB"), seat(20, "BTN"), seat(17, "CO")];
    expect(buildMultiwaySpot(table, 1, 0.5, 1, 1)?.callerIndices).toEqual([0]);
  });

  it("2人卓は BTN が SB を払って先に動く", () => {
    const spot = buildMultiwaySpot([seat(10, "BTN"), seat(10, "BB")], 0, 0.5, 1, 0);
    expect(spot?.callerIndices).toEqual([1]);
    expect(spot?.blinds).toEqual([0.5, 1]);
  });

  it("チップの無い人は後ろに数えない。ショートの blind は持っている分まで", () => {
    const table = [seat(1.4, "BB"), seat(0, "SB"), seat(20, "BTN")];
    const spot = buildMultiwaySpot(table, 2, 0.5, 1, 1)!;
    expect(spot.callerIndices).toEqual([0]);
    expect(spot.antes[0]).toBe(1);
    expect(spot.blinds[0]).toBeCloseTo(0.4, 9);
    expect(spot.blinds[1]).toBe(0);
  });

  it("ポジション未設定・BB が押す・BB 不在は null (2人モデルに戻す)", () => {
    expect(buildMultiwaySpot([seat(10, ""), seat(10, "BB")], 0, 0.5, 1, 0)).toBeNull();
    expect(buildMultiwaySpot([seat(10, "SB"), seat(10, "BB")], 1, 0.5, 1, 0)).toBeNull();
    expect(buildMultiwaySpot([seat(10, "SB"), seat(10, "BTN")], 0, 0.5, 1, 0)).toBeNull();
  });
});
