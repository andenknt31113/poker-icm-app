// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initAnalysisView, setAnalysisView } from "../src/analysisView.js";

beforeEach(() => {
  document.body.innerHTML = '<nav class="analyze-jump"><button data-jump="sec-hand"></button><button data-jump="sec-icm"></button><button data-jump="sec-nash"></button></nav><section data-analysis-panel="hand"><input value="AKs"></section><section data-analysis-panel="equity"></section><section data-analysis-panel="equity"></section><section data-analysis-panel="nash"></section>';
  HTMLElement.prototype.scrollIntoView = vi.fn();
  setAnalysisView("hand");
});

describe("目的別の分析画面", () => {
  it("初期表示は手札判断だけで、3つの目的を区別する", () => {
    initAnalysisView();
    expect(document.querySelectorAll("[data-analysis-panel]:not(.hidden-analysis)")).toHaveLength(1);
    expect(document.querySelector('[data-jump="sec-hand"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-jump="sec-nash"]')?.getAttribute("aria-pressed")).toBe("false");
  });

  it("賞金ビューでは関連する複数パネルだけを表示する", () => {
    initAnalysisView();
    document.querySelector<HTMLButtonElement>('[data-jump="sec-icm"]')!.click();
    expect(document.body.dataset.analysisView).toBe("equity");
    expect(document.querySelectorAll("[data-analysis-panel]:not(.hidden-analysis)")).toHaveLength(2);
  });

  it("ハンドから内訳への導線でも同じ画面状態を使う", () => {
    const button = document.createElement("button");
    button.dataset.analysisTarget = "sec-icm";
    document.body.appendChild(button);
    initAnalysisView();
    button.click();
    expect(document.body.dataset.analysisView).toBe("equity");
    expect(document.querySelector('[data-jump="sec-icm"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("Nashへの切替と復帰で入力を消さない", () => {
    initAnalysisView();
    document.querySelector<HTMLButtonElement>('[data-jump="sec-nash"]')!.click();
    expect(document.body.dataset.analysisView).toBe("nash");
    expect(document.querySelector('[data-analysis-panel="hand"]')?.classList.contains("hidden-analysis")).toBe(true);
    setAnalysisView("hand");
    expect(document.querySelector("input")?.value).toBe("AKs");
    expect(document.querySelector('[data-jump="sec-hand"]')?.getAttribute("aria-pressed")).toBe("true");
  });
});
