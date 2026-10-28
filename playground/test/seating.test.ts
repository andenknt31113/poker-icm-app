import { describe, expect, it } from "vitest";
import { arrangePositions, moveSeat, orderSavedSeats } from "../src/seating.js";
import { positionsForN, type Player } from "../src/appState.js";

function seats(count = 4): Player[] {
  return positionsForN(count).map((position, index) => ({ id: index, stack: 10 + index, role: index === 0 ? "hero" : index === 1 ? "villain" : "other", position }));
}

describe("時計回りの席順とBTN", () => {
  it("既に時計回りなら再読み込みで先頭の席を変えない", () => {
    const players = seats();
    moveSeat(players, 0, 1);
    const saved = structuredClone(players);
    orderSavedSeats(players);
    expect(players).toEqual(saved);
  });
  it.each([2, 3, 4, 5, 6, 7, 8, 9])("%i人でBTNを指定すると位置が重複しない", count => {
    const players = seats(count);
    arrangePositions(players, players[count - 1]!.id);
    expect(players[count - 1]!.position).toBe("BTN");
    expect(new Set(players.map(player => player.position)).size).toBe(count);
    expect(players[0]!.position).toBe(count === 2 ? "BB" : "SB");
  });
  it("移動ではスタック・役割・BTNの人を保持し、逆移動で元に戻る", () => {
    const players = seats();
    const original = structuredClone(players);
    moveSeat(players, 0, 1);
    expect(players[1]).toEqual(original[0]);
    expect(players[0]!.role).toBe("villain");
    expect(players.map(player => player.position)).toEqual(["CO", "BTN", "SB", "BB"]);
    moveSeat(players, 0, -1);
    expect(players).toEqual(original);
  });
  it("境界・不正な移動は何も変えない", () => {
    const players = seats();
    const original = structuredClone(players);
    moveSeat(players, 0, -1); moveSeat(players, 3, 1); moveSeat(players, -1, 1); moveSeat(players, 0, 4);
    expect(players).toEqual(original);
  });
  it("既存の位置と人物の関係を変えず表示順を整理する", () => {
    const original = seats();
    const players = [original[2]!, original[1]!, original[0]!, original[3]!];
    orderSavedSeats(players);
    expect(players).toEqual(original);
  });
});
