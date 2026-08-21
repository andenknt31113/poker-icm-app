import { describe, it, expect } from "vitest";
import {
  sanitizePayoutsArray,
  parseList,
  positionsForN,
  posToPotOddsPos,
  nextFreePosition,
  positionsAfterChange,
} from "../src/appState.js";

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

describe("nextFreePosition", () => {
  it("正規セットのうち未使用の最初のポジションを返す (4人 BB/SB/BTN/CO → 5人目は UTG)", () => {
    expect(nextFreePosition(5, ["BB", "SB", "BTN", "CO"])).toBe("UTG");
  });

  it("2人 BTN/BB → 3人目は SB", () => {
    expect(nextFreePosition(3, ["BTN", "BB"])).toBe("SB");
  });

  it("3人 BTN/SB/BB → 4人目は CO", () => {
    expect(nextFreePosition(4, ["BTN", "SB", "BB"])).toBe("CO");
  });

  it("5人 BTN/SB/BB/UTG/CO → 6人目は HJ (セット順で最初の空き)", () => {
    expect(nextFreePosition(6, ["BTN", "SB", "BB", "UTG", "CO"])).toBe("HJ");
  });

  it("未設定 (\"\") のプレイヤーが混ざっていても空きから採番する", () => {
    expect(nextFreePosition(4, ["BTN", "", "BB"])).toBe("SB");
  });

  it("全員未設定なら勝手に採番せず \"\" を返す", () => {
    expect(nextFreePosition(4, ["", "", ""])).toBe("");
  });

  it("空きが無ければ \"\" を返す (重複割り当てはしない)", () => {
    expect(nextFreePosition(4, ["BTN", "SB", "BB", "CO"])).toBe("");
  });

  it("未知の人数 (正規セット無し) では \"\" を返す", () => {
    expect(nextFreePosition(10, ["BTN"])).toBe("");
  });
});

describe("positionsAfterChange", () => {
  it("autoLink: 空の5人卓で #1 を BB に → リング自動連動", () => {
    expect(positionsAfterChange(["", "", "", "", ""], 0, "BB", true)).toEqual([
      "BB", "UTG", "CO", "BTN", "SB",
    ]);
  });

  it("autoLink: 埋まっている卓でも起点から全員リング再割当 (プリセット直後の1回目)", () => {
    // #3 を BTN に → 入力順=席順として BTN から時計回りに SB, BB, CO が並ぶ
    expect(positionsAfterChange(["BB", "SB", "BTN", "CO"], 2, "BTN", true)).toEqual([
      "BB", "CO", "BTN", "SB",
    ]);
  });

  it("swap: 保持者と入れ替え、他は動かない (モグラ叩き防止)", () => {
    // #2 (UTG) を CO に → CO だった #3 が UTG を引き取る
    expect(positionsAfterChange(["BB", "UTG", "CO", "BTN", "SB"], 1, "CO", false)).toEqual([
      "BB", "CO", "UTG", "BTN", "SB",
    ]);
  });

  it("swap: 空きポジションへの変更は自分だけ変わる", () => {
    expect(positionsAfterChange(["BB", "", "CO", "", ""], 1, "SB", false)).toEqual([
      "BB", "SB", "CO", "", "",
    ]);
  });

  it("swap: 自分が未設定でも保持者は自分の旧値 (\"\") を引き取る", () => {
    expect(positionsAfterChange(["BB", "", "CO"], 1, "BB", false)).toEqual(["", "BB", "CO"]);
  });

  it('"" は autoLink に関係なくその行だけクリア', () => {
    expect(positionsAfterChange(["BB", "SB", "BTN"], 1, "", true)).toEqual(["BB", "", "BTN"]);
  });

  it("正規セット外のポジションは単独セット (他に影響しない)", () => {
    // 4人卓の正規セットに HJ は無い
    expect(positionsAfterChange(["BB", "SB", "BTN", "CO"], 1, "HJ", true)).toEqual([
      "BB", "HJ", "BTN", "CO",
    ]);
  });
});
