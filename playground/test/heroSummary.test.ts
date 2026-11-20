// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HeroSummaryArg } from "../src/heroSummary.js";

vi.mock("../src/appState.js", () => ({ players: [{ position: "BB" }, { position: "SB" }] }));
vi.mock("../src/guide.js", () => ({ isOnboardingDone: () => true }));
vi.mock("../src/infoModal.js", () => ({ openInfoModal: vi.fn() }));
vi.mock("../src/tabs.js", () => ({ applyTab: vi.fn() }));

const SCENARIO: HeroSummaryArg = {
  heroIndex: 0, villainIndex: 1, stacks: [18, 14], payouts: [50, 30, 20],
  heroEq: 33.8, villainEq: 31.2, totalPrize: 100, bf: 1.19, requiredEq: 0.493, rp: 0.044,
  rangeVerdict: { direction: "callBack", heroPct: 17, villainPct: 39 },
};

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="hero-summary"></div>';
});

describe("サマリーの視点と役割", () => {
  it("RP がごく小さい負の値でも「-0.0%」と出さない", async () => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary({ ...SCENARIO, bf: 1, requiredEq: 0.4, rp: -0.00001 });
    const metrics = document.querySelector(".hero-summary-grid")?.textContent ?? "";
    expect(metrics).toContain("+0.0");
    expect(metrics).not.toContain("-0.0");
  });
  it("相手がいないときは数字を出さず、相手を選ぶよう案内する", async () => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary({ ...SCENARIO, villainIndex: -1, bf: 1, requiredEq: 0.448, rp: 0 });
    const metrics = document.querySelector(".hero-summary-grid")?.textContent ?? "";
    expect(metrics).not.toContain("44.8");
    expect(metrics).not.toContain("1.00");
    expect(metrics).toContain("—");
    expect(document.querySelector(".hero-summary-missing")?.textContent).toContain("相手");
    expect(document.getElementById("hero-summary-verdict-btn")).toBeNull();
  });
  it("スタックが 0 のときも数字を出さず、理由を出す", async () => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary({ ...SCENARIO, stacks: [0, 14], bf: 1, requiredEq: 0.448, rp: 0 });
    const metrics = document.querySelector(".hero-summary-grid")?.textContent ?? "";
    expect(metrics).not.toContain("44.8");
    expect(document.querySelector(".hero-summary-missing")?.textContent).toContain("スタック");
  });
  it("相手レンジが空ならコール可能率を表示しない", async () => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary({ ...SCENARIO, rangeVerdict: { ...SCENARIO.rangeVerdict, available: false } });
    expect(document.getElementById("hero-summary-verdict-btn")).toBeNull();
    expect(document.querySelector(".hero-summary-grid")).not.toBeNull();
  });
  it("賞金の取り分を表示せずスタック・位置と判断指標を残す", async () => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary(SCENARIO);
    expect(document.querySelector(".hero-summary-stat-label")).toBeNull();
    expect(document.querySelector(".hero-summary-prize-note")).toBeNull();
    for (const row of document.querySelectorAll(".hero-summary-row")) {
      expect(row.children).toHaveLength(3);
      expect(row.textContent).not.toContain("%");
    }
    expect(document.querySelector(".hero")?.textContent).toContain("BB");
    expect(document.querySelector(".villain")?.textContent).toContain("SB");
    const metrics = document.querySelector(".hero-summary-grid")?.textContent;
    expect(metrics).toContain("1.19");
    expect(metrics).toContain("49.3");
    expect(metrics).toContain("4.4");
  });
  it.each([
    ["callBack", "villain", "hero"],
    ["pushBack", "hero", "villain"],
  ] as const)("%s: オールインする人が先、コールする人が後に並ぶ", async (direction, first, second) => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary({ ...SCENARIO, rangeVerdict: { ...SCENARIO.rangeVerdict, direction } });
    const rows = document.querySelectorAll(".hero-summary-row");
    expect(rows[0]?.classList.contains(first)).toBe(true);
    expect(rows[1]?.classList.contains(second)).toBe(true);
    // 先頭はオールイン、後ろはコール (長い形・スクロール中の短い形とも)
    expect(rows[0]?.querySelector(".role-long")?.textContent).toContain("オールイン");
    expect(rows[0]?.querySelector(".role-short")?.textContent).toBe("オールイン");
    expect(rows[1]?.querySelector(".role-long")?.textContent).toContain("コール");
    expect(rows[1]?.querySelector(".role-short")?.textContent).toContain("コール");
    expect(document.querySelector(".hero")?.textContent).toContain("18");
    expect(document.querySelector(".villain")?.textContent).toContain("14");
    const reference = document.querySelector(".hero-summary-push-note");
    if (direction === "pushBack") expect(reference?.textContent).toContain("コールされた場合");
    else expect(reference).toBeNull();
  });

  it("相手未指定なら役割を決めつけない", async () => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary({ ...SCENARIO, villainIndex: -1 });
    expect(document.querySelector(".villain")?.textContent).toContain("相手未指定");
    expect(document.querySelectorAll(".hero-summary-role")).toHaveLength(0);
  });

  it("BF が Infinity のときは ∞ と表示し、負の RP (バウンティ有利) は good 色にする", async () => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary({ ...SCENARIO, bf: Number.POSITIVE_INFINITY, requiredEq: 1, rp: 0.55 });
    const bfVal = document.querySelector("[data-info='BF'] .hero-summary-value")?.textContent ?? "";
    expect(bfVal).toBe("∞");
    expect(bfVal).not.toContain("Infinity");

    renderHeroSummary({ ...SCENARIO, bf: 0.9, requiredEq: 0.42, rp: -0.025 });
    const rpEl = document.querySelector("[data-info='RP'] .hero-summary-value");
    expect(rpEl?.classList.contains("good")).toBe(true);
    expect(rpEl?.textContent).toContain("-2.5");
  });
});
