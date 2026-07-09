import { describe, it, expect } from "vitest";
import { sanitizePayoutsArray, parseList, positionsForN, posToPotOddsPos } from "../src/appState.js";

describe("sanitizePayoutsArray", () => {
  it("有限かつ非負の数値だけを残す", () => {
    expect(sanitizePayoutsArray([50, 30, 20])).toEqual([50, 30, 20]);
  });

  it("負数・NaN・Infinity を除外する", () => {
    expect(sanitizePayoutsArray([50, -10, NaN, Infinity, 20])).toEqual([50, 20]);
  });

  it("0 は有効な賞金として残す", () => {
    expect(sanitizePayoutsArray([50, 0, 20])).toEqual([50, 0, 20]);
  });

  it("数値以外の要素 (文字列・null・オブジェクト) を除外する", () => {
    expect(sanitizePayoutsArray(["50", null, {}, 20] as unknown[])).toEqual([20]);
  });

  it("配列でない入力には空配列を返す", () => {
    expect(sanitizePayoutsArray(null)).toEqual([]);
    expect(sanitizePayoutsArray(undefined)).toEqual([]);
    expect(sanitizePayoutsArray("50,30,20")).toEqual([]);
    expect(sanitizePayoutsArray({ 0: 50 })).toEqual([]);
  });

  it("空配列はそのまま空配列", () => {
    expect(sanitizePayoutsArray([])).toEqual([]);
  });
});

describe("parseList", () => {
  it("カンマ区切り・空白区切りの両方をパースする", () => {
    expect(parseList("50, 30, 20")).toEqual([50, 30, 20]);
    expect(parseList("50 30 20")).toEqual([50, 30, 20]);
    expect(parseList("50,30 20")).toEqual([50, 30, 20]);
  });

  it("負数・非数値を除外する", () => {
    expect(parseList("50, -10, abc, 20")).toEqual([50, 20]);
  });

  it("空文字は空配列を返す", () => {
    expect(parseList("")).toEqual([]);
  });
});

describe("positionsForN", () => {
  it("既知の人数はポジションセットを返す", () => {
    expect(positionsForN(2)).toEqual(["BTN", "BB"]);
    expect(positionsForN(6)).toEqual(["BTN", "SB", "BB", "UTG", "HJ", "CO"]);
  });

  it("未知の人数 (0, 10, 負数) には空配列を返す", () => {
    expect(positionsForN(0)).toEqual([]);
    expect(positionsForN(10)).toEqual([]);
    expect(positionsForN(-1)).toEqual([]);
  });
});

describe("posToPotOddsPos", () => {
  it("SB/BB はそのまま、それ以外は OTHER にマップする", () => {
    expect(posToPotOddsPos("SB")).toBe("SB");
    expect(posToPotOddsPos("BB")).toBe("BB");
    expect(posToPotOddsPos("BTN")).toBe("OTHER");
    expect(posToPotOddsPos("")).toBe("OTHER");
    expect(posToPotOddsPos(undefined)).toBe("OTHER");
  });
});
