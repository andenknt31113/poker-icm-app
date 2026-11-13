import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { hasThreeWayTable, setThreeWayTable, threeWayEquity, THREE_WAY_BYTES } from "../src/threeWay.js";
import { solvePusherNash } from "../src/nashRange.js";
import { ALL_169_HANDS, comboPctOfRange } from "../src/handRanking.js";
import type { Position } from "../src/appState.js";

const seat = (stack: number, position: Position) => ({ stack, position });
const index = (hand: string) => ALL_169_HANDS.indexOf(hand);
const tablePath = fileURLToPath(new URL("../public/three-way-equity.bin", import.meta.url));

beforeAll(() => {
  setThreeWayTable(new Uint8Array(readFileSync(tablePath)));
});

describe("3 人同時オールインの勝率表", () => {
  it("同梱ファイルのサイズが想定どおりで読み込める", () => {
    expect(readFileSync(tablePath).length).toBe(THREE_WAY_BYTES);
    expect(hasThreeWayTable()).toBe(true);
    expect(setThreeWayTable(new Uint8Array(10))).toBe(false);
  });

  it("どの並びで聞いても同じ答えで、合計は 1", () => {
    const a = new Float64Array(3);
    const b = new Float64Array(3);
    expect(threeWayEquity(index("AKo"), index("QQ"), index("KK"), a)).toBe(true);
    expect(threeWayEquity(index("KK"), index("AKo"), index("QQ"), b)).toBe(true);
    expect(a[0]).toBeCloseTo(b[1]!, 9);
    expect(a[1]).toBeCloseTo(b[2]!, 9);
    expect(a[2]).toBeCloseTo(b[0]!, 9);
    expect(a[0]! + a[1]! + a[2]!).toBeCloseTo(1, 9);
  });

  it("別のモンテカルロで測った値と合う (AKo / QQ / KK は約 25 / 18 / 56)", () => {
    const p = new Float64Array(3);
    threeWayEquity(index("AKo"), index("QQ"), index("KK"), p);
    expect(Math.abs(p[0]! - 0.252)).toBeLessThan(0.03);
    expect(Math.abs(p[1]! - 0.184)).toBeLessThan(0.03);
    expect(Math.abs(p[2]! - 0.564)).toBeLessThan(0.03);
  });

  it("3 人が同時に持てない組は false", () => {
    expect(threeWayEquity(index("AA"), index("AA"), index("AA"), new Float64Array(3))).toBe(false);
  });
});

describe("オーバーコールつきの Nash (HRC の無料 Nash ICM 計算との照合)", () => {
  // 3 人・全員 10BB・SB 0.5 / BB 1・アンティなし・勝者総取り。
  // HRC: BU push 32.1% / SB call 17.8% / BB overcall 12.8% / BB call 24.3%
  it("3 人・10BB・勝者総取りで、HRC の各レンジと 1.5 ポイント以内", () => {
    const table = [seat(10, "BTN"), seat(10, "SB"), seat(10, "BB")];
    const r = solvePusherNash(table, [100], 0, 0.5, 1, 0)!;
    expect(r.withOvercall).toBe(true);
    const sb = r.callers[0]!;
    const bb = r.callers[1]!;
    expect(Math.abs(comboPctOfRange(r.pushRange) - 32.1)).toBeLessThan(1.5);
    expect(Math.abs(comboPctOfRange(sb.range) - 17.8)).toBeLessThan(1.5);
    expect(Math.abs(comboPctOfRange(sb.overcalls[0]!.range) - 12.8)).toBeLessThan(1.5);
    expect(Math.abs(comboPctOfRange(bb.range) - 24.3)).toBeLessThan(1.5);
    expect(bb.overcalls).toEqual([]);
    // オーバーコールの中身: HRC は 44+ A9s+ ATo+ KTs+ KQo QTs+ JTs
    for (const hand of ["AA", "44", "A9s", "ATo", "KQo", "JTs"]) expect(sb.overcalls[0]!.range.has(hand)).toBe(true);
    for (const hand of ["33", "A8s", "A9o", "KJo"]) expect(sb.overcalls[0]!.range.has(hand)).toBe(false);
  }, 30_000);

  // 4 人・CO 17 / BTN 25 / SB 6 / BB 14BB・賞金 50/30/20 (バブル、サイドポットあり)。
  // HRC: CO push 20.2% / BTN push 78.9% → SB call 18.4% → BB overcall 12.5% / BB call 3.0% / SB push 62.6% → BB call 41.2%
  it("スタックがばらばらのバブルでも HRC に近い (2 人同時に飛ぶときは開始スタックの多い方が上の順位)", () => {
    const table = [seat(17, "CO"), seat(25, "BTN"), seat(6, "SB"), seat(14, "BB")];
    const pct = (range: ReadonlySet<string>) => comboPctOfRange(range);
    const btn = solvePusherNash(table, [50, 30, 20], 1, 0.5, 1, 0)!;
    const sbCall = btn.callers[0]!;
    expect(Math.abs(pct(sbCall.range) - 18.4)).toBeLessThan(2);
    // 修正前は 5.0% だった (2 人同時に飛んだときの賞金を半分ずつにしていたため)
    expect(Math.abs(pct(sbCall.overcalls[0]!.range) - 12.5)).toBeLessThan(2.5);
    expect(Math.abs(pct(btn.callers[1]!.range) - 3.0)).toBeLessThan(1);
    // 押す側は「押しても降りてもほぼ同じ」ハンドが多く、差が残る (修正前は 94.6%)
    expect(Math.abs(pct(btn.pushRange) - 78.9)).toBeLessThan(8);

    const co = solvePusherNash(table, [50, 30, 20], 0, 0.5, 1, 0)!;
    expect(Math.abs(pct(co.pushRange) - 20.2)).toBeLessThan(3);
    expect(Math.abs(pct(co.callers[1]!.range) - 6.8)).toBeLessThan(1.5);

    const sb = solvePusherNash(table, [50, 30, 20], 2, 0.5, 1, 0)!;
    expect(Math.abs(pct(sb.pushRange) - 62.6)).toBeLessThan(2);
    expect(Math.abs(pct(sb.callers[0]!.range) - 41.2)).toBeLessThan(2.5);
  }, 60_000);
});
