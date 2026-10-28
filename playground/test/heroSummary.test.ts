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
    ["callBack", "オールイン", "コールを検討"],
    ["pushBack", "コールを想定", "プッシュを検討"],
  ] as const)("%sでも相手が上・自分が下", async (direction, villainRole, heroRole) => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary({ ...SCENARIO, rangeVerdict: { ...SCENARIO.rangeVerdict, direction } });
    const rows = document.querySelectorAll(".hero-summary-row");
    expect(rows[0]?.classList.contains("villain")).toBe(true);
    expect(rows[0]?.textContent).toContain(villainRole);
    expect(rows[0]?.textContent).toContain("14");
    expect(rows[1]?.classList.contains("hero")).toBe(true);
    expect(rows[1]?.textContent).toContain(heroRole);
    expect(rows[1]?.textContent).toContain("18");
    const reference = document.querySelector(".hero-summary-push-note");
    if (direction === "pushBack") expect(reference?.textContent).toContain("自分がコールする場合");
    else expect(reference).toBeNull();
  });

  it("相手未指定なら役割を決めつけない", async () => {
    const { renderHeroSummary } = await import("../src/heroSummary.js");
    renderHeroSummary({ ...SCENARIO, villainIndex: -1 });
    expect(document.querySelector(".villain")?.textContent).toContain("相手未指定");
    expect(document.querySelectorAll(".hero-summary-role")).toHaveLength(0);
  });
});
