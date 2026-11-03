// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { players } = vi.hoisted(() => ({
  players: [] as { stack: number; role: string; position: string }[],
}));
vi.mock("../src/appState.js", () => ({
  players,
  parseList: (value: string) => value.split(",").filter(Boolean).map(Number),
  DEFAULT_SB: 0.5,
  DEFAULT_BB: 1,
  actionOrderIdx: (position: string) =>
    ["UTG", "UTG+1", "MP", "LJ", "HJ", "CO", "BTN", "SB", "BB"].indexOf(position),
  posToPotOddsPos: (position: string, playerCount: number) =>
    position === "SB" || (position === "BTN" && playerCount === 2) ? "SB" : position === "BB" ? "BB" : "OTHER",
}));

beforeEach(() => {
  vi.resetModules();
  players.length = 0;
  document.body.innerHTML = `
    <input id="payouts" value="50,30,20"><input id="nash-sb" value="0.5">
    <input id="nash-bb" value="1"><input id="nash-ante" value="0">
    <button class="direction-tab active" data-direction="callBack"></button>
    <button class="direction-tab" data-direction="pushBack"></button>
    <p id="direction-auto-hint" class="hidden"></p>
    <input id="push-range" type="range" min="1" max="100" value="25"><span id="push-pct"></span>
    <div id="grid-villain"></div><div id="grid-hero"></div><p id="call-stats"></p>
    <div id="preset-controls"></div><div id="custom-controls"></div><span id="custom-selected"></span>
    <button id="custom-clear"></button><button id="custom-from-preset"></button>`;
  vi.doMock("../src/domRefs.js", () => ({
    payoutsInput: document.getElementById("payouts"),
    nashSbInput: document.getElementById("nash-sb"),
    nashBbInput: document.getElementById("nash-bb"),
    nashAnteInput: document.getElementById("nash-ante"),
  }));
});

const tab = (direction: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`.direction-tab[data-direction="${direction}"]`)!;

describe("レンジ比較の向きを席順で決める", () => {
  it("自分が BB・相手が SB なら「相手のオールインを受ける」に固定する", async () => {
    players.push({ stack: 18, role: "hero", position: "BB" }, { stack: 14, role: "villain", position: "SB" });
    const { renderRangeComparison } = await import("../src/handRange.js");
    // 「自分からオールイン」を選んでいても、BB は先に押せないので受ける側で計算する
    tab("pushBack").click();
    const verdict = renderRangeComparison(0.5);
    expect(verdict.direction).toBe("callBack");
    expect(tab("pushBack").disabled).toBe(true);
    expect(tab("callBack").classList.contains("active")).toBe(true);
    expect(document.getElementById("direction-auto-hint")!.textContent).toContain("相手（SB）が先に動きます");
  });

  it("自分が BTN・相手が BB なら「自分からオールイン」に固定する", async () => {
    players.push({ stack: 10, role: "hero", position: "BTN" }, { stack: 15, role: "villain", position: "BB" });
    const { renderRangeComparison } = await import("../src/handRange.js");
    const verdict = renderRangeComparison(0.5);
    expect(verdict.direction).toBe("pushBack");
    expect(tab("callBack").disabled).toBe(true);
    expect(document.getElementById("direction-auto-hint")!.textContent).toContain("自分（BTN）が先に動きます");
  });

  it("ポジション未設定なら選べるままにする", async () => {
    players.push({ stack: 10, role: "hero", position: "" }, { stack: 15, role: "villain", position: "" });
    const { renderRangeComparison, directionFromPositions } = await import("../src/handRange.js");
    expect(directionFromPositions()).toBeNull();
    renderRangeComparison(0.5);
    expect(tab("callBack").disabled).toBe(false);
    expect(tab("pushBack").disabled).toBe(false);
    expect(document.getElementById("direction-auto-hint")!.classList.contains("hidden")).toBe(true);
  });

  it("スライダーの % はコンボ比率 (25% → 約25%)", async () => {
    players.push({ stack: 18, role: "hero", position: "BB" }, { stack: 14, role: "villain", position: "SB" });
    const { renderRangeComparison } = await import("../src/handRange.js");
    const verdict = renderRangeComparison(0.5);
    expect(Math.abs(verdict.villainPct - 25)).toBeLessThanOrEqual(0.5);
  });
});
