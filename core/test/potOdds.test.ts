import { describe, expect, it } from "vitest";
import { calculatePotOdds } from "../src/potOdds.js";

describe("calculatePotOdds (BB ante 構造)", () => {
  it("BB defends vs CO push (例: BB stack 9, CO stack 26)", () => {
    // BB ante 1, blind 1, SB folded → SB blind 0.5 dead
    // BB live = 9 - 1 (ante) = 8, CO live = 26
    // matched = min(8, 26) = 8
    // callAmount = 8 - 1 (BB blind) = 7
    // pot = 2 * 8 + (0.5 SB dead + 0 BB dead + 1 ante) = 17.5
    // potIfWin = 17.5 - 7 = 10.5
    const r = calculatePotOdds({
      heroStack: 9,
      villainStack: 26,
      heroPosition: "BB",
      villainPosition: "OTHER",
      sb: 0.5,
      bb: 1,
      ante: 1,
    });
    expect(r.matched).toBeCloseTo(8, 6);
    expect(r.callAmount).toBeCloseTo(7, 6);
    expect(r.potAtShowdown).toBeCloseTo(17.5, 6);
    expect(r.potIfWin).toBeCloseTo(10.5, 6);
    expect(r.deadBreakdown.sbDead).toBeCloseTo(0.5, 6);
    expect(r.deadBreakdown.bbDead).toBeCloseTo(0, 6);
    expect(r.deadBreakdown.anteDead).toBeCloseTo(1, 6);
  });

  it("BB defends vs SB push (SB blind は dead でなく villain commit)", () => {
    // BB stack 10, SB stack 10
    // BB live = 10 - 1 = 9, SB live = 10
    // matched = min(9, 10) = 9
    // callAmount = 9 - 1 = 8
    // pot = 2*9 + (0 SB dead + 0 BB dead + 1 ante) = 19
    // potIfWin = 19 - 8 = 11
    const r = calculatePotOdds({
      heroStack: 10,
      villainStack: 10,
      heroPosition: "BB",
      villainPosition: "SB",
      sb: 0.5,
      bb: 1,
      ante: 1,
    });
    expect(r.matched).toBeCloseTo(9, 6);
    expect(r.callAmount).toBeCloseTo(8, 6);
    expect(r.potAtShowdown).toBeCloseTo(19, 6);
    expect(r.potIfWin).toBeCloseTo(11, 6);
    expect(r.deadBreakdown.sbDead).toBeCloseTo(0, 6);
  });

  it("SB defends vs BB push (BB blind は villain commit, SB blind は hero commit)", () => {
    // 通常 BB は最終 actor だが理論上 SB が最後にコール選択する場合
    // hero=SB stack 10, villain=BB stack 9
    // hero live = 10 (SB は ante 払わない), villain live = 9 - 1 = 8
    // matched = min(10, 8) = 8
    // hero commit = sb 0.5, villain commit = bb 1
    // callAmount = 8 - 0.5 = 7.5
    // pot = 2*8 + 0 dead + 1 ante = 17
    // potIfWin = 17 - 7.5 = 9.5
    const r = calculatePotOdds({
      heroStack: 10,
      villainStack: 9,
      heroPosition: "SB",
      villainPosition: "BB",
      sb: 0.5,
      bb: 1,
      ante: 1,
    });
    expect(r.matched).toBeCloseTo(8, 6);
    expect(r.callAmount).toBeCloseTo(7.5, 6);
    expect(r.potAtShowdown).toBeCloseTo(17, 6);
    expect(r.potIfWin).toBeCloseTo(9.5, 6);
  });

  it("両者とも非blind (CO defends vs BTN push) → BB blind と SB blind 両方 dead", () => {
    // hero=CO stack 20, villain=BTN stack 15
    // hero live = 20, villain live = 15
    // matched = 15
    // callAmount = 15 - 0 = 15 (CO は既出 commit なし)
    // pot = 2*15 + (0.5 + 1 + 1) = 32.5
    // potIfWin = 32.5 - 15 = 17.5
    const r = calculatePotOdds({
      heroStack: 20,
      villainStack: 15,
      heroPosition: "OTHER",
      villainPosition: "OTHER",
      sb: 0.5,
      bb: 1,
      ante: 1,
    });
    expect(r.matched).toBeCloseTo(15, 6);
    expect(r.callAmount).toBeCloseTo(15, 6);
    expect(r.potAtShowdown).toBeCloseTo(32.5, 6);
    expect(r.potIfWin).toBeCloseTo(17.5, 6);
    expect(r.deadBreakdown.sbDead + r.deadBreakdown.bbDead).toBeCloseTo(1.5, 6);
  });

  it("hero stack > villain stack の partial call (BB が大きい)", () => {
    // BB stack 30, villain (CO) stack 10
    // BB live = 30 - 1 = 29, CO live = 10
    // matched = 10
    // callAmount = 10 - 1 = 9 (BB は blind 1 既出)
    // pot = 2*10 + (0.5 + 0 + 1) = 21.5
    // potIfWin = 21.5 - 9 = 12.5
    const r = calculatePotOdds({
      heroStack: 30,
      villainStack: 10,
      heroPosition: "BB",
      villainPosition: "OTHER",
      sb: 0.5,
      bb: 1,
      ante: 1,
    });
    expect(r.matched).toBeCloseTo(10, 6);
    expect(r.callAmount).toBeCloseTo(9, 6);
    expect(r.potAtShowdown).toBeCloseTo(21.5, 6);
    expect(r.potIfWin).toBeCloseTo(12.5, 6);
  });

  it("ante = 0 のクラシック構造 (BB の live は stack のまま)", () => {
    // BB stack 10, CO stack 10, ante なし
    // BB live = 10, CO live = 10, matched = 10
    // callAmount = 10 - 1 = 9
    // pot = 20 + 0.5 = 20.5
    // potIfWin = 20.5 - 9 = 11.5
    const r = calculatePotOdds({
      heroStack: 10,
      villainStack: 10,
      heroPosition: "BB",
      villainPosition: "OTHER",
      sb: 0.5,
      bb: 1,
      ante: 0,
    });
    expect(r.matched).toBeCloseTo(10, 6);
    expect(r.callAmount).toBeCloseTo(9, 6);
    expect(r.potAtShowdown).toBeCloseTo(20.5, 6);
    expect(r.potIfWin).toBeCloseTo(11.5, 6);
    expect(r.deadBreakdown.anteDead).toBeCloseTo(0, 6);
  });

  it("matched = heroLiveCommit のとき callAmount は 0.01 にクランプ", () => {
    // hero=BB stack 2, villain=OTHER stack 1
    // BB live = 2 - 1 = 1, villain live = 1, matched = 1
    // BB commit = 1 (blind)、つまり差は 0 → クランプで 0.01
    const r = calculatePotOdds({
      heroStack: 2,
      villainStack: 1,
      heroPosition: "BB",
      villainPosition: "OTHER",
      sb: 0.5,
      bb: 1,
      ante: 1,
    });
    expect(r.callAmount).toBeCloseTo(0.01, 6);
  });

  it("不正値はエラー", () => {
    expect(() =>
      calculatePotOdds({
        heroStack: 0, villainStack: 10,
        heroPosition: "BB", villainPosition: "OTHER",
        sb: 0.5, bb: 1, ante: 1,
      }),
    ).toThrow();
    expect(() =>
      calculatePotOdds({
        heroStack: 10, villainStack: -5,
        heroPosition: "BB", villainPosition: "OTHER",
        sb: 0.5, bb: 1, ante: 1,
      }),
    ).toThrow();
    expect(() =>
      calculatePotOdds({
        heroStack: 10, villainStack: 10,
        heroPosition: "BB", villainPosition: "OTHER",
        sb: -1, bb: 1, ante: 1,
      }),
    ).toThrow();
  });
});
