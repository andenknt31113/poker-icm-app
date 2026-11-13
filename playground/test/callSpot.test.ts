import { describe, expect, it } from "vitest";
import {
  calculateBubbleFactor,
  calculateICM,
  calculatePotOdds,
  calculateRequiredEquity,
} from "@poker-icm/core";
import { exactCallRequiredEquity } from "../src/callSpot.js";
import type { Position } from "../src/appState.js";

const seat = (stack: number, position: Position) => ({ stack, position });
const SB = 0.5;
const BB = 1;
const PAYOUTS = [50, 30, 20];

describe("exactCallRequiredEquity (分析タブの必要勝率)", () => {
  it("3終端を自分で組んだ ICM の式 (Efold − Elose) ÷ (Ewin − Elose) と一致する", () => {
    // 4人バブル: 自分 BB 12、相手 BTN 30、SB 4 (降りる)、CO 25。BB ante 1
    const table = [seat(12, "BB"), seat(30, "BTN"), seat(4, "SB"), seat(25, "CO")];
    const req = exactCallRequiredEquity(table, PAYOUTS, 0, 1, SB, BB, 1);
    // 自分: ante 1 と blind 1 は払い済み。matched 11、dead = SB 0.5 + ante 1、pot 23.5
    const fold = calculateICM([10, 31 + 1.5, 3.5, 25], PAYOUTS)[0]!;
    const win = calculateICM([23.5, 19, 3.5, 25], PAYOUTS)[0]!;
    const lose = calculateICM([0, 42.5, 3.5, 25], PAYOUTS)[0]!;
    expect(req).toBeCloseTo((fold - lose) / (win - lose), 9);
    expect(req!).toBeCloseTo(0.688, 3);
  });

  it("同じ局面で BF 近似 (旧計算) は約 2pt 低く出ていた", () => {
    const stacks = [12, 30, 4, 25];
    const bf = calculateBubbleFactor({ stacks, payouts: PAYOUTS, heroIndex: 0, villainIndex: 1, riskChips: 12 }).bf;
    const odds = calculatePotOdds({ heroStack: 12, villainStack: 30, heroPosition: "BB", villainPosition: "OTHER", sb: SB, bb: BB, ante: 1 });
    const approx = calculateRequiredEquity({ callAmount: odds.callAmount, potIfWin: odds.potIfWin, bubbleFactor: bf }).dollarEV;
    const table = [seat(12, "BB"), seat(30, "BTN"), seat(4, "SB"), seat(25, "CO")];
    const exact = exactCallRequiredEquity(table, PAYOUTS, 0, 1, SB, BB, 1)!;
    expect(exact - approx).toBeGreaterThan(0.015);
  });

  it("勝者総取りならポットオッズ (cEV) と一致する", () => {
    const table = [seat(12, "BB"), seat(30, "BTN"), seat(4, "SB"), seat(25, "CO")];
    const odds = calculatePotOdds({ heroStack: 12, villainStack: 30, heroPosition: "BB", villainPosition: "OTHER", sb: SB, bb: BB, ante: 1 });
    expect(exactCallRequiredEquity(table, [100], 0, 1, SB, BB, 1)).toBeCloseTo(
      odds.callAmount / (odds.callAmount + odds.potIfWin),
      9,
    );
  });

  it("自分も相手も BB でない (BTN のオールインを SB が受ける) 局面も解ける", () => {
    const table = [seat(20, "BTN"), seat(15, "SB"), seat(30, "BB")];
    const req = exactCallRequiredEquity(table, PAYOUTS, 1, 0, SB, BB, 1);
    // 自分 SB: blind 0.5 は払い済み。matched 15、dead = BB 1 + ante 1、pot 32
    const fold = calculateICM([22.5, 14.5, 28], PAYOUTS)[1]!;
    const win = calculateICM([5, 32, 28], PAYOUTS)[1]!;
    const lose = calculateICM([37, 0, 28], PAYOUTS)[1]!;
    expect(req).toBeCloseTo((fold - lose) / (win - lose), 9);
  });

  it("2人卓は BTN を SB として解く", () => {
    const table = [seat(10, "BTN"), seat(10, "BB")];
    const req = exactCallRequiredEquity(table, [65, 35], 1, 0, SB, BB, 0);
    // HU は順位が2つだけなので ICM = チップ比例。コール 9 でポット 20
    expect(req).toBeCloseTo(9 / 20, 9);
  });

  it("BB の人が決まらない卓 (ポジション未設定) は null", () => {
    const table = [seat(12, ""), seat(30, ""), seat(4, "")];
    expect(exactCallRequiredEquity(table, PAYOUTS, 0, 1, SB, BB, 1)).toBeNull();
  });

  it("BB の自分が ante を払うとチップが残らないなら null", () => {
    const table = [seat(1, "BB"), seat(30, "BTN"), seat(4, "SB")];
    expect(exactCallRequiredEquity(table, PAYOUTS, 0, 1, SB, BB, 1)).toBeNull();
  });
});
