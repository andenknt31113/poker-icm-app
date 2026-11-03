import { describe, expect, it } from "vitest";
import { assignRole, positionsForChangedTable, swapDecisionPlayers, type Player } from "../src/appState.js";

function table(): Player[] {
  return [
    { id: 1, stack: 18, role: "hero", position: "BB" },
    { id: 2, stack: 14, role: "villain", position: "SB" },
    { id: 3, stack: 20, role: "other", position: "BTN" },
  ];
}

describe("プレイヤーの選択と入れ替え", () => {
  it("相手を自分に指定すると以前の自分が相手になる", () => {
    const players = table();
    expect(assignRole(players, 2, "hero")).toBe(true);
    expect(players.map(player => player.role)).toEqual(["villain", "hero", "other"]);
    expect(players.map(player => player.stack)).toEqual([18, 14, 20]);
  });

  it("第三者を自分にしても相手の指定を失わない", () => {
    const players = table();
    assignRole(players, 3, "hero");
    expect(players.map(player => player.role)).toEqual(["other", "villain", "hero"]);
  });

  it("選択済みの役割や存在しない人を選んでも変更しない", () => {
    const players = table();
    expect(assignRole(players, 1, "hero")).toBe(false);
    expect(assignRole(players, 99, "hero")).toBe(false);
    expect(players).toEqual(table());
  });

  it("自分・相手の入れ替えで席・スタック・IDを変えない", () => {
    const players = table();
    expect(swapDecisionPlayers(players)).toBe(true);
    expect(players.map(player => player.role)).toEqual(["villain", "hero", "other"]);
    expect(players.map(({ role, ...player }) => player)).toEqual(table().map(({ role, ...player }) => player));
    swapDecisionPlayers(players);
    expect(players).toEqual(table());
  });

  it("相手未指定なら入れ替えない", () => {
    const players = table();
    players[1]!.role = "other";
    expect(swapDecisionPlayers(players)).toBe(false);
    expect(players[0]!.role).toBe("hero");
  });
});

describe("人数変更時のポジション", () => {
  it("4人から3人へ減らすとCOをBTNへ補い、SBとBBを維持する", () => {
    expect(positionsForChangedTable(["SB", "BB", "CO"])).toEqual(["SB", "BB", "BTN"]);
  });

  it("2人卓にSBを残さない", () => {
    expect(positionsForChangedTable(["SB", "BB"])).toEqual(["BTN", "BB"]);
  });

  it("人数を増やしても既存の位置を変えない", () => {
    expect(positionsForChangedTable(["BB", "SB", "BTN", "CO", "UTG"])).toEqual(["BB", "SB", "BTN", "CO", "UTG"]);
  });

  it("未指定だけの卓を勝手に割り当てず、重複がある卓では重複を直す", () => {
    expect(positionsForChangedTable(["", "", ""])).toEqual(["", "", ""]);
    expect(positionsForChangedTable(["BTN", "BTN", "BB"])).toEqual(["BTN", "SB", "BB"]);
  });
});
