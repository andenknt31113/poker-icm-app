// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/calculator.js", () => ({ recompute: vi.fn() }));
vi.mock("../src/setupPayouts.js", () => ({ renderPayouts: vi.fn() }));
vi.mock("../src/paywall.js", () => ({ openPaywall: vi.fn() }));
vi.mock("../src/entitlement.js", () => ({ isPro: () => true, FREE_MAX_PLAYERS: 4 }));

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="players-list"></div><button id="add-player"></button><button id="randomize-stacks"></button>';
});

async function setup(positions: string[]) {
  const { players } = await import("../src/appState.js");
  players.length = 0;
  positions.forEach((position, i) => players.push({ id: i, stack: 10 + i, role: i === 0 ? "hero" : i === 1 ? "villain" : "other", position } as never));
  const mod = await import("../src/setupPlayers.js");
  return { players, ...mod };
}

describe("fillMissingPositions (位置が未設定の席を埋める)", () => {
  it("決まっている席はそのままに、未設定の席へ空いている位置を入れる", async () => {
    const { players, fillMissingPositions } = await setup(["BTN", "BB", "SB", "CO", "UTG", "", "", ""]);
    expect(fillMissingPositions()).toBe(true);
    const positions = players.map((p) => p.position);
    expect(positions.slice(0, 5)).toEqual(["BTN", "BB", "SB", "CO", "UTG"]);
    expect(positions.slice(5).every((p) => p !== "")).toBe(true);
    expect(new Set(positions).size).toBe(8);
  });

  it("誰も位置を持っていない卓は、上の行から BTN → SB → BB の順に入れる", async () => {
    const { players, fillMissingPositions } = await setup(["", "", ""]);
    expect(fillMissingPositions()).toBe(true);
    expect(players.map((p) => p.position)).toEqual(["BTN", "SB", "BB"]);
  });

  it("全員決まっていれば何も変えない", async () => {
    const { players, fillMissingPositions } = await setup(["BTN", "SB", "BB"]);
    expect(fillMissingPositions()).toBe(false);
    expect(players.map((p) => p.position)).toEqual(["BTN", "SB", "BB"]);
  });

  it("data-fill-positions のボタンを押すと埋めて再計算する", async () => {
    const { players, initPlayersUI } = await setup(["BTN", "BB", ""]);
    const { recompute } = await import("../src/calculator.js");
    initPlayersUI();
    document.body.insertAdjacentHTML("beforeend", "<button data-fill-positions>fill</button>");
    document.querySelector<HTMLButtonElement>("[data-fill-positions]")!.click();
    expect(players.map((p) => p.position)).toEqual(["BTN", "BB", "SB"]);
    expect(recompute).toHaveBeenCalled();
  });
});
