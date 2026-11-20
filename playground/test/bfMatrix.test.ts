// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";

let bfBackground: (bf: number) => string;
let renderBFMatrix: (stacks: number[], payouts: number[]) => void;

beforeAll(async () => {
  document.body.innerHTML = '<div id="bf-matrix"></div>';
  ({ bfBackground, renderBFMatrix } = await import("../src/bfMatrix.js"));
});

const hueOf = (color: string): number => Number(/hsl\((\d+)/.exec(color)![1]);

describe("BF マップの色", () => {
  it("1.0 は黄、2.0 以上と Infinity は赤", () => {
    expect(hueOf(bfBackground(1.0))).toBe(60);
    expect(hueOf(bfBackground(2.0))).toBe(0);
    expect(hueOf(bfBackground(3.5))).toBe(0);
    expect(hueOf(bfBackground(Number.POSITIVE_INFINITY))).toBe(0);
  });

  it("バウンティありで BF < 1.0 の有利局面は緑寄りになる", () => {
    expect(hueOf(bfBackground(0.8))).toBeGreaterThan(60);
    expect(hueOf(bfBackground(0.5))).toBeGreaterThan(hueOf(bfBackground(0.8)));
  });

  it("バブルでよく出る 1.5 と 1.9 も色で区別できる (以前は 1.4 以上が全部同じ赤)", () => {
    expect(hueOf(bfBackground(1.5)) - hueOf(bfBackground(1.9))).toBeGreaterThanOrEqual(20);
  });

  it("BF が大きいほど赤に近づく", () => {
    const hues = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0].map((bf) => hueOf(bfBackground(bf)));
    for (let i = 1; i < hues.length; i++) expect(hues[i]!).toBeLessThan(hues[i - 1]!);
  });

  it("全員均等賞金 (BF = Infinity) で Infinity 文字列を出さず +50.0% と ∞ を表示する", () => {
    renderBFMatrix([18, 14, 20], [33, 33, 33]);
    const text = document.getElementById("bf-matrix")!.textContent ?? "";
    expect(text).not.toContain("Infinity");
    expect(text).toContain("∞");
    expect(text).toContain("+50.0%");
  });
});
