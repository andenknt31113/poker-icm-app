import { describe, expect, it } from "vitest";
import { calculateRequiredEquity } from "../src/equity.js";

describe("calculateRequiredEquity", () => {
  it("BF=1.0 なら $EV = cEV、RP = 0", () => {
    const r = calculateRequiredEquity({
      callAmount: 10,
      potIfWin: 30,
      bubbleFactor: 1.0,
    });
    expect(r.cEV).toBeCloseTo(0.25, 6); // 10 / (10 + 30)
    expect(r.dollarEV).toBeCloseTo(0.25, 6);
    expect(r.riskPremium).toBeCloseTo(0, 6);
  });

  it("ポット 1:1 なら cEV = 50%", () => {
    const r = calculateRequiredEquity({
      callAmount: 10,
      potIfWin: 10,
      bubbleFactor: 1.0,
    });
    expect(r.cEV).toBeCloseTo(0.5, 6);
  });

  it("BF > 1 なら $EV > cEV (RP > 0)", () => {
    const r = calculateRequiredEquity({
      callAmount: 10,
      potIfWin: 20,
      bubbleFactor: 1.5,
    });
    expect(r.cEV).toBeCloseTo(10 / 30, 6);
    // (10 * 1.5) / (10 * 1.5 + 20) = 15 / 35 = 0.4286
    expect(r.dollarEV).toBeCloseTo(15 / 35, 6);
    expect(r.riskPremium).toBeGreaterThan(0);
  });

  it("BF が大きいほど必要勝率が上がる", () => {
    const a = calculateRequiredEquity({
      callAmount: 10,
      potIfWin: 20,
      bubbleFactor: 1.0,
    });
    const b = calculateRequiredEquity({
      callAmount: 10,
      potIfWin: 20,
      bubbleFactor: 2.0,
    });
    expect(b.dollarEV).toBeGreaterThan(a.dollarEV);
  });

  it("BF=Infinity は必要勝率 100%", () => {
    const r = calculateRequiredEquity({
      callAmount: 10,
      potIfWin: 20,
      bubbleFactor: Number.POSITIVE_INFINITY,
    });
    expect(r.dollarEV).toBeCloseTo(1.0, 6);
  });

  it("不正値はエラー", () => {
    expect(() =>
      calculateRequiredEquity({ callAmount: 0, potIfWin: 10, bubbleFactor: 1 }),
    ).toThrow();
    expect(() =>
      calculateRequiredEquity({ callAmount: 10, potIfWin: -5, bubbleFactor: 1 }),
    ).toThrow();
    expect(() =>
      calculateRequiredEquity({ callAmount: 10, potIfWin: 10, bubbleFactor: -1 }),
    ).toThrow();
  });
});
