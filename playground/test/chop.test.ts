import { describe, expect, it } from "vitest";
import { calculateICM } from "@poker-icm/core";
import { calculateChop, roundToTotal } from "../src/chop.js";

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

describe("calculateChop", () => {
  it("ICM チョップは ICM の賞金期待値そのもので、合計は賞金総額", () => {
    const stacks = [50, 30, 20];
    const payouts = [50000, 30000, 20000];
    const r = calculateChop(stacks, payouts);
    const icm = calculateICM(stacks, payouts);
    r.icm.forEach((v, i) => expect(v).toBeCloseTo(icm[i]!, 6));
    expect(sum(r.icm)).toBeCloseTo(100000, 6);
    // 手計算: 38,393 / 32,750 / 28,857
    expect(r.icm[0]).toBeCloseTo(38392.86, 1);
    expect(r.icm[1]).toBeCloseTo(32750, 1);
    expect(r.icm[2]).toBeCloseTo(28857.14, 1);
  });

  it("チップ比例は最下位ぶんを全員に保証し、残りをチップの比で分ける", () => {
    const r = calculateChop([50, 30, 20], [50000, 30000, 20000]);
    // 20,000 × 3 を保証、残り 40,000 を 50:30:20
    expect(r.chip).toEqual([40000, 32000, 28000]);
    expect(sum(r.chip)).toBe(100000);
  });

  it("人数より後ろの順位の賞金は分ける対象に入れない", () => {
    const r = calculateChop([10, 10], [500, 300, 200]);
    expect(r.total).toBe(800);
    expect(r.icm).toEqual([400, 400]);
  });

  it("入賞枠が人数より少ないときは保証額 0 でチップ比例", () => {
    const r = calculateChop([60, 30, 10], [700, 300]);
    expect(r.total).toBe(1000);
    expect(r.chip).toEqual([600, 300, 100]);
    expect(sum(r.icm)).toBeCloseTo(1000, 6);
  });

  it("刻みで丸めても合計が賞金総額に合う", () => {
    const r = calculateChop([50, 30, 20], [50000, 30000, 20000], 1000);
    expect(sum(r.icm)).toBe(100000);
    for (const v of r.icm) expect(v % 1000).toBe(0);
    // 38,393 → 38,000 / 32,750 → 33,000 / 28,857 → 29,000
    expect(r.icm).toEqual([38000, 33000, 29000]);
  });

  it("スタックが空なら空の結果", () => {
    expect(calculateChop([], [100]).icm).toEqual([]);
    expect(calculateChop([0, 0], [100, 50]).icm).toEqual([]);
  });
});

describe("roundToTotal", () => {
  it("刻み 0 は丸めない", () => {
    expect(roundToTotal([1.5, 2.5], 0, 4)).toEqual([1.5, 2.5]);
  });
  it("合計が刻みで割り切れない残りは、取り分のいちばん多い人に足す", () => {
    const r = roundToTotal([6000.4, 2500.3, 1550.3], 100, 10051);
    expect(sum(r)).toBe(10051);
    expect(r[1]! % 100).toBe(0);
    expect(r[2]! % 100).toBe(0);
    expect(r[0]).toBe(6051);
  });
});
