import { describe, it, expect } from "vitest";
import { practiceLesson } from "../src/practice/judge.js";
import { makeProblem } from "./fixtures.js";

describe("practiceLesson", () => {
  it("payouts が1つ (WTA) なら ICM 圧ゼロのメッセージを返す", () => {
    const p = makeProblem({ payouts: [100] });
    expect(practiceLesson(p)).toMatch(/WTA/);
  });

  it("WTA 判定は均等ペイ判定より優先される (payouts=[100] は max=min でサテライトに誤マッチしない)", () => {
    const p = makeProblem({ payouts: [100] });
    expect(practiceLesson(p)).toMatch(/WTA/);
    expect(practiceLesson(p)).not.toMatch(/サテライト/);
  });

  it("ペイアウトがほぼ均等 (サテライト型) ならサテライトのメッセージを返す", () => {
    const p = makeProblem({ payouts: [33.4, 33.3, 33.3] });
    expect(practiceLesson(p)).toMatch(/サテライト/);
  });

  it("villain がカバーしていて RP が高い (>=5) ならカバーされている警告を返す", () => {
    const p = makeProblem({
      payouts: [50, 30, 20],
      scenarioPlayers: [
        { stack: 15, role: "hero", position: "BB" },
        { stack: 25, role: "villain", position: "BTN" }, // villain.stack(25) >= hero.stack(15)
        { stack: 20, role: "other", position: "SB" },
      ],
      cEV: 0.3,
      dollarEV: 0.4, // rp = (0.4-0.3)*100 = 10 >= 5
    });
    expect(practiceLesson(p)).toMatch(/カバーされている相手/);
  });

  it("hero がカバーしていて RP が低い (<5) なら cEV に近い感覚というメッセージを返す", () => {
    const p = makeProblem({
      payouts: [50, 30, 20],
      scenarioPlayers: [
        { stack: 30, role: "hero", position: "BB" },
        { stack: 10, role: "villain", position: "BTN" }, // villain.stack(10) < hero.stack(30)
        { stack: 20, role: "other", position: "SB" },
      ],
      cEV: 0.3,
      dollarEV: 0.32, // rp = 2 < 5
    });
    expect(practiceLesson(p)).toMatch(/cEV に近い感覚/);
  });

  it("hero より短いスタックの other プレイヤーがいれば、そのメッセージを返す", () => {
    // villain/hero の分岐 (カバー関係) に引っかからないよう、両者を拮抗させて
    // rp が中間 (5 未満だが hero がカバーしていない) になるよう調整。
    const p = makeProblem({
      payouts: [50, 30, 20],
      scenarioPlayers: [
        { stack: 20, role: "hero", position: "BB" },
        { stack: 20, role: "villain", position: "BTN" }, // villain.stack(20) >= hero.stack(20) だが rp<5 にして分岐2をスキップ
        { stack: 5, role: "other", position: "SB" }, // hero より短い
      ],
      cEV: 0.3,
      dollarEV: 0.31, // rp = 1 < 5 → 分岐2 (villain>=hero && rp>=5) は不成立
    });
    expect(practiceLesson(p)).toMatch(/短いスタック/);
  });

  it("どの特別条件にも当てはまらない場合は一般則のメッセージを返す", () => {
    const p = makeProblem({
      payouts: [50, 30, 20],
      scenarioPlayers: [
        { stack: 20, role: "hero", position: "BB" },
        { stack: 20, role: "villain", position: "BTN" },
      ],
      cEV: 0.3,
      dollarEV: 0.31, // rp = 1 < 5, villain.stack(20) >= hero.stack(20) だが rp<5 → 分岐2不成立、分岐3(villain<hero)も不成立
    });
    expect(practiceLesson(p)).toMatch(/必要勝率 = cEV \+ Risk Premium/);
  });
});
