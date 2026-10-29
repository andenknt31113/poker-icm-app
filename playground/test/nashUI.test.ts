// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { players, solve } = vi.hoisted(() => ({
  players: [
    { stack: 18, role: "hero", position: "SB" },
    { stack: 14, role: "villain", position: "BB" },
  ],
  solve: vi.fn(),
}));
vi.mock("@poker-icm/core", () => ({ solveHUNash: solve }));
vi.mock("../src/appState.js", () => ({
  players, persistedState: null, actionOrderIdx: (position: string) => ["BTN", "SB", "BB"].indexOf(position),
  parseList: (value: string) => value.split(",").filter(Boolean).map(Number),
  posToPotOddsPos: (position: string, playerCount: number) =>
    position === "SB" || (position === "BTN" && playerCount === 2) ? "SB" : position === "BB" ? "BB" : "OTHER",
}));
vi.mock("../src/huEquityMatrix.js", () => ({ huEquity: vi.fn(), hasHUMatrix: () => true }));

beforeEach(() => {
  delete document.body.dataset.activeTab;
  delete document.body.dataset.analysisView;
  vi.resetModules();
  vi.useFakeTimers();
  players.length = 0;
  players.push({ stack: 18, role: "hero", position: "SB" }, { stack: 14, role: "villain", position: "BB" });
  document.body.innerHTML = `
    <input id="payouts" value="50,30,20"><input id="nash-sb" value="0.5">
    <input id="nash-bb" value="1"><input id="nash-ante" value="0">
    <button id="nash-solve">計算</button><p id="nash-status"></p>
    <p id="nash-sb-stats"></p><p id="nash-bb-stats"></p>
    <div id="nash-sb-grid"></div><div id="nash-bb-grid"></div><div id="nash-depth-note"></div>
    <div id="nash-results"></div>`;
  vi.doMock("../src/domRefs.js", () => ({
    payoutsInput: document.getElementById("payouts"),
    nashSbInput: document.getElementById("nash-sb"),
    nashBbInput: document.getElementById("nash-bb"),
    nashAnteInput: document.getElementById("nash-ante"),
    saveState: vi.fn(),
  }));
  solve.mockReset().mockReturnValue({
    sbPushFreq: new Map([["AA", 1]]), bbCallFreq: new Map([["AA", 1]]),
    sbPushRange: new Set(["AA"]), bbCallRange: new Set(["AA"]),
    converged: true, iterations: 1,
  });
});
afterEach(() => vi.useRealTimers());

function clickSolve(): void {
  document.getElementById("nash-solve")!.click();
}

function expectCleared(): void {
  expect(document.querySelectorAll(".in-range-villain, .in-range-hero")).toHaveLength(0);
  expect(document.getElementById("nash-sb-stats")!.textContent).toBe("");
  expect(document.getElementById("nash-bb-stats")!.textContent).toBe("");
  expect(document.getElementById("nash-depth-note")!.classList.contains("hidden")).toBe(true);
}

describe("Nashの結果と現在の入力を一致させる", () => {
  it("ポジション順とプッシュ役が逆なら入れ替え案内を表示する", async () => {
    const warn = document.createElement("div");
    warn.id = "nash-overcall-warn";
    document.body.appendChild(warn);
    const { updateNashOvercallWarn } = await import("../src/nashUI.js");
    players[0]!.position = "BB";
    players[1]!.position = "SB";
    updateNashOvercallWarn();
    expect(warn.classList.contains("hidden")).toBe(false);
    expect(warn.textContent).toContain("自分 ⇄ 相手");
    players[0]!.position = "SB";
    players[1]!.position = "BB";
    updateNashOvercallWarn();
    expect(warn.classList.contains("hidden")).toBe(true);
  });
  it("表示中の計算待ちに条件が変わっても最新局面で自動計算を完了する", async () => {
    const { ensureNashCalculated, invalidateChangedNash } = await import("../src/nashUI.js");
    document.body.dataset.activeTab = "analyze";
    document.body.dataset.analysisView = "nash";
    ensureNashCalculated();
    players[0]!.stack = 21;
    invalidateChangedNash();
    ensureNashCalculated();
    vi.runAllTimers();
    expect(solve).toHaveBeenCalledTimes(1);
    expect(solve.mock.calls[0]![0].stacks).toEqual([21, 14]);
    expect((document.getElementById("nash-solve") as HTMLButtonElement).disabled).toBe(false);
  });
  it("自動計算が失敗しても無限に再試行しない", async () => {
    const { ensureNashCalculated } = await import("../src/nashUI.js");
    document.body.dataset.activeTab = "analyze";
    document.body.dataset.analysisView = "nash";
    solve.mockImplementation(() => { throw new Error("calculation failed"); });
    ensureNashCalculated();
    vi.runAllTimers();
    expect(solve).toHaveBeenCalledTimes(1);
    expect(document.getElementById("nash-status")!.textContent).toBe("calculation failed");
  });
  it("Nashを表示すると自動計算し、同じ局面では再計算しない", async () => {
    const { ensureNashCalculated } = await import("../src/nashUI.js");
    document.body.dataset.activeTab = "analyze";
    document.body.dataset.analysisView = "nash";
    ensureNashCalculated();
    ensureNashCalculated();
    vi.runAllTimers();
    expect(solve).toHaveBeenCalledTimes(1);
    ensureNashCalculated();
    vi.runAllTimers();
    expect(solve).toHaveBeenCalledTimes(1);
  });
  it("Nash以外では計算せず、局面表示は現在のスタックと役割を使う", async () => {
    const context = document.createElement("div");
    context.id = "nash-context";
    document.body.appendChild(context);
    const { ensureNashCalculated, renderNashContext } = await import("../src/nashUI.js");
    document.body.dataset.activeTab = "setup";
    document.body.dataset.analysisView = "nash";
    ensureNashCalculated(); vi.runAllTimers();
    expect(solve).not.toHaveBeenCalled();
    renderNashContext();
    expect(context.textContent).toContain("18 BB");
    expect(context.textContent).toContain("自分：プッシュ");
    expect(context.textContent).toContain("相手：コール");
    players[0]!.stack = 7;
    renderNashContext();
    expect(context.textContent).toContain("7 BB");
    expect(context.textContent).not.toContain("18 BB");
  });
  it.each(["stack", "role", "position", "payouts", "nash-sb", "nash-bb", "nash-ante"])("%s変更で旧結果を消す", async field => {
    const { initNashUI, invalidateChangedNash } = await import("../src/nashUI.js");
    initNashUI(); clickSolve(); vi.runAllTimers();
    expect(document.querySelectorAll(".in-range-villain, .in-range-hero")).toHaveLength(2);
    if (field === "stack") players[0]!.stack = 20;
    else if (field === "role") players[0]!.role = "none";
    else if (field === "position") players[0]!.position = "BTN";
    else (document.getElementById(field) as HTMLInputElement).value = "2";
    invalidateChangedNash();
    expectCleared();
    expect(document.getElementById("nash-status")!.textContent).toContain("再計算");
  });

  it("同じ条件の再描画では結果を保つ", async () => {
    const { initNashUI, invalidateChangedNash } = await import("../src/nashUI.js");
    initNashUI(); clickSolve(); vi.runAllTimers(); invalidateChangedNash();
    expect(document.querySelectorAll(".in-range-villain, .in-range-hero")).toHaveLength(2);
  });

  it("実行待ちの間に条件が変われば古い計算を実行しない", async () => {
    const { initNashUI } = await import("../src/nashUI.js");
    initNashUI(); clickSolve(); players[0]!.stack = 20; vi.runAllTimers();
    expect(solve).not.toHaveBeenCalled(); expectCleared();
    expect((document.getElementById("nash-solve") as HTMLButtonElement).disabled).toBe(false);
  });

  it("再計算の失敗時も古い結果を残さない", async () => {
    const { initNashUI } = await import("../src/nashUI.js");
    initNashUI(); clickSolve(); vi.runAllTimers();
    solve.mockImplementation(() => { throw new Error("invalid input"); });
    clickSolve(); vi.runAllTimers(); expectCleared();
    expect(document.getElementById("nash-status")!.textContent).toBe("invalid input");
  });

});

describe("実際のポジションの blind で Nash を解く", () => {
  async function solveOnce(): Promise<Record<string, unknown>> {
    const { initNashUI } = await import("../src/nashUI.js");
    initNashUI(); clickSolve(); vi.runAllTimers();
    return solve.mock.calls[0]![0];
  }

  it("SB からのプッシュ: 自分が SB・相手が BB の blind を払う", async () => {
    const input = await solveOnce();
    expect(input).toMatchObject({ pusherBlind: 0.5, callerBlind: 1, deadMoney: 0, ante: 0 });
  });

  it("BTN からのプッシュ: 自分は blind なし、降りた SB と BB ante はポットに残る", async () => {
    players.length = 0;
    players.push(
      { stack: 10, role: "hero", position: "BTN" },
      { stack: 12, role: "other", position: "SB" },
      { stack: 15, role: "villain", position: "BB" },
    );
    (document.getElementById("nash-ante") as HTMLInputElement).value = "1";
    const input = await solveOnce();
    expect(input).toMatchObject({ pusherBlind: 0, callerBlind: 1, deadMoney: 1.5 });
    // SB は blind 0.5、BB は ante 1 をすでに払っている
    expect(input.stacks).toEqual([10, 11.5, 14]);
  });

  it("2人卓の BTN は SB を払う", async () => {
    players[0]!.position = "BTN";
    const input = await solveOnce();
    expect(input).toMatchObject({ pusherBlind: 0.5, callerBlind: 1, deadMoney: 0 });
  });
});

describe("実効スタックの深さで Nash の見せ方を変える", () => {
  async function solveWithStacks(hero: number, villain: number): Promise<void> {
    players[0]!.stack = hero;
    players[1]!.stack = villain;
    const { initNashUI } = await import("../src/nashUI.js");
    initNashUI(); clickSolve(); vi.runAllTimers();
  }
  const note = (): HTMLElement => document.getElementById("nash-depth-note")!;
  const results = (): HTMLElement => document.getElementById("nash-results")!;

  it("12BB 以下は注意なしで結果を表示", async () => {
    await solveWithStacks(10, 30);
    expect(note().classList.contains("hidden")).toBe(true);
    expect(results().classList.contains("hidden")).toBe(false);
  });

  it("12〜20BB は結果の上に 2BB オープン等の注意を出す", async () => {
    await solveWithStacks(16, 30);
    expect(note().classList.contains("hidden")).toBe(false);
    expect(note().textContent).toContain("2BB");
    expect(results().classList.contains("hidden")).toBe(false);
  });

  it("20BB 超は範囲外として結果を隠し、ボタンで参考表示できる", async () => {
    await solveWithStacks(25, 30);
    expect(note().textContent).toContain("push/fold で判断する深さではありません");
    expect(results().classList.contains("hidden")).toBe(true);
    (document.getElementById("nash-show-deep") as HTMLButtonElement).click();
    expect(results().classList.contains("hidden")).toBe(false);
    expect(document.getElementById("nash-show-deep")).toBeNull();
  });
});
