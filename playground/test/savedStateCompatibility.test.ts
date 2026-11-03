// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const STATE_KEY = "poker-icm-app-state-v1";
const SAVED_STATE = {
  players: [
    { stack: 27.5, role: "hero", position: "BB" },
    { stack: 11, role: "villain", position: "SB" },
    { stack: 35, role: "other", position: "BTN" },
    { stack: 19, role: "other", position: "CO" },
  ],
  payouts: [60, 25, 15],
  nash: { sb: 0.5, bb: 1, ante: 0 },
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = '<input id="payouts" value="50,30,20"><input id="nash-sb" value="0.5"><input id="nash-bb" value="1"><input id="nash-ante" value="0">';
});

describe("既存保存形式の起動・再保存互換性", () => {
  it("スタック・役割・位置・賞金・アンティ0を読み込み、同じ形式で再保存する", async () => {
    localStorage.setItem(STATE_KEY, JSON.stringify(SAVED_STATE));
    const { players, persistedState } = await import("../src/appState.js");
    expect(persistedState).toEqual(SAVED_STATE);
    expect(players.map(({ id, ...player }) => player)).toEqual(SAVED_STATE.players);
    const { saveState } = await import("../src/domRefs.js");
    saveState();
    expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).toEqual(SAVED_STATE);
  });

  it("再起動しても役割とスタックを保持し、追加プレイヤーのIDが重複しない", async () => {
    localStorage.setItem(STATE_KEY, JSON.stringify(SAVED_STATE));
    await import("../src/appState.js");
    vi.resetModules();
    const { players, allocPlayerId } = await import("../src/appState.js");
    expect(players.map(({ id, ...player }) => player)).toEqual(SAVED_STATE.players);
    expect(new Set(players.map(player => player.id)).size).toBe(players.length);
    expect(players.map(player => player.id)).not.toContain(allocPlayerId());
  });

  it("壊れたJSONがあっても起動し、元の保存内容を読み込みだけでは上書きしない", async () => {
    const invalidState = "{invalid";
    localStorage.setItem(STATE_KEY, invalidState);
    const { persistedState, players } = await import("../src/appState.js");
    expect(persistedState).toBeNull();
    expect(players.length).toBeGreaterThan(0);
    expect(localStorage.getItem(STATE_KEY)).toBe(invalidState);
  });
});
