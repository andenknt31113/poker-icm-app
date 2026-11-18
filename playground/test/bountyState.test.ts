import { describe, expect, it } from "vitest";
import { bountySpecFor, bountySummaryText, isBountyMode, parseBountyInput, sanitizeBounty } from "../src/bountyState.js";
import { exactCallRequiredEquity } from "../src/callSpot.js";
import { nashRangeForSpot } from "../src/nashRange.js";
import { comboPctOfRange } from "../src/handRanking.js";
import type { Position } from "../src/appState.js";

const seat = (stack: number, position: Position, bounty = 0) => ({ stack, position, bounty });

describe("bountySpecFor", () => {
  const table = [seat(20, "BB", 10), seat(8, "SB", 10), seat(15, "BTN", 5)];

  it("設定が off なら計算に入れない", () => {
    expect(bountySpecFor(table, "off", true)).toBeUndefined();
  });

  it("Pro でなければ、設定が入っていても計算に入れない", () => {
    expect(bountySpecFor(table, "ko", false)).toBeUndefined();
    expect(bountySpecFor(table, "pko", false)).toBeUndefined();
  });

  it("首が全員 0 なら計算に入れない", () => {
    expect(bountySpecFor([seat(20, "BB"), seat(8, "SB")], "ko", true)).toBeUndefined();
  });

  it("KO / PKO で首の並びと形式を渡す", () => {
    expect(bountySpecFor(table, "ko", true)).toEqual({ heads: [10, 10, 5], progressive: false });
    expect(bountySpecFor(table, "pko", true)).toEqual({ heads: [10, 10, 5], progressive: true });
  });

  it("チップが残っていない席の首は 0 にする", () => {
    const spec = bountySpecFor([seat(20, "BB", 10), seat(0, "SB", 10), seat(15, "BTN", 5)], "ko", true);
    expect(spec?.heads).toEqual([10, 0, 5]);
  });
});

describe("バウンティの入力値", () => {
  it("負数・NaN・数値以外は 0", () => {
    expect(sanitizeBounty(-1)).toBe(0);
    expect(sanitizeBounty(Number.NaN)).toBe(0);
    expect(sanitizeBounty("5")).toBe(0);
    expect(sanitizeBounty(undefined)).toBe(0);
    expect(sanitizeBounty(7.5)).toBe(7.5);
  });

  it("入力欄の文字列を額にする (空・不正は 0)", () => {
    expect(parseBountyInput("12")).toBe(12);
    expect(parseBountyInput("")).toBe(0);
    expect(parseBountyInput("abc")).toBe(0);
    expect(parseBountyInput("-3")).toBe(0);
  });

  it("形式の値を判定する", () => {
    expect(isBountyMode("ko")).toBe(true);
    expect(isBountyMode("pko")).toBe(true);
    expect(isBountyMode("off")).toBe(true);
    expect(isBountyMode("mystery")).toBe(false);
    expect(isBountyMode(undefined)).toBe(false);
  });
});

describe("バウンティ行の要約", () => {
  it("無料のときは Pro の印", () => {
    expect(bountySummaryText("ko", [10, 10], false)).toContain("Pro");
  });

  it("形式と額を並べる", () => {
    expect(bountySummaryText("pko", [10, 5], true)).toBe("PKO · 10 / 5");
  });

  it("形式を選んだだけで額が無ければ、入力を促す", () => {
    expect(bountySummaryText("ko", [0, 0], true)).not.toContain("0 / 0");
  });
});

describe("バウンティを入れた判断 (実際のポジションから)", () => {
  const SB = 0.5;
  const BB = 1;
  const PAYOUTS = [50, 30, 20];
  // 自分 BB 20、相手 SB 8 (飛ばせる)、BTN 15
  const table = [seat(20, "BB", 10), seat(8, "SB", 10), seat(15, "BTN", 10)];

  it("相手を飛ばせるとき、コールの必要勝率が下がる", () => {
    const plain = exactCallRequiredEquity(table, PAYOUTS, 0, 1, SB, BB, 1)!;
    const ko = exactCallRequiredEquity(table, PAYOUTS, 0, 1, SB, BB, 1, bountySpecFor(table, "ko", true))!;
    const pko = exactCallRequiredEquity(table, PAYOUTS, 0, 1, SB, BB, 1, bountySpecFor(table, "pko", true))!;
    expect(ko).toBeLessThan(pko);
    expect(pko).toBeLessThan(plain);
  });

  it("無料のとき (bounty が undefined) は、バウンティなしと同じ必要勝率", () => {
    const plain = exactCallRequiredEquity(table, PAYOUTS, 0, 1, SB, BB, 1)!;
    const free = exactCallRequiredEquity(table, PAYOUTS, 0, 1, SB, BB, 1, bountySpecFor(table, "ko", false))!;
    expect(free).toBe(plain);
  });

  it("Nash のコールレンジも、飛ばせる側は広がる", () => {
    // SB 8 がオールイン、BB 20 が受ける。BTN 15 は降りている
    const spec = bountySpecFor(table, "ko", true);
    const plain = nashRangeForSpot(table, PAYOUTS, 1, 0, SB, BB, 1, "call")!;
    const ko = nashRangeForSpot(table, PAYOUTS, 1, 0, SB, BB, 1, "call", spec)!;
    expect(comboPctOfRange(ko)).toBeGreaterThan(comboPctOfRange(plain));
  });

  it("2 人だけの卓では、バウンティを入れても Nash は変わらない (優勝賞金が増えるのと同じ)", () => {
    const hu = [seat(8, "BTN", 10), seat(20, "BB", 10)];
    const plain = nashRangeForSpot(hu, [65, 35], 0, 1, SB, BB, 0, "call")!;
    const ko = nashRangeForSpot(hu, [65, 35], 0, 1, SB, BB, 0, "call", bountySpecFor(hu, "ko", true))!;
    expect([...ko].sort()).toEqual([...plain].sort());
  });
});
