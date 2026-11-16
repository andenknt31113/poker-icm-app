// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/domRefs.js", () => ({ payoutsInput: { value: "" } }));
vi.mock("../src/dom.js", () => ({ $: () => document.createElement("div") }));
vi.mock("../src/calculator.js", () => ({ recompute: vi.fn() }));
vi.mock("../src/paywall.js", () => ({ openPaywall: vi.fn() }));

describe("賞金プリセットの選択中の印", () => {
  it("中身が同じプリセットだけ一致する", async () => {
    const { payoutsMatchPreset } = await import("../src/setupPayouts.js");
    expect(payoutsMatchPreset([50, 30, 20], "50,30,20")).toBe(true);
    expect(payoutsMatchPreset([50, 30, 20], "50, 30, 20")).toBe(true);
    expect(payoutsMatchPreset([100], "100")).toBe(true);
  });

  it("1 つでも書き換えたら一致しない", async () => {
    const { payoutsMatchPreset } = await import("../src/setupPayouts.js");
    expect(payoutsMatchPreset([50, 30, 21], "50,30,20")).toBe(false);
    expect(payoutsMatchPreset([50, 30], "50,30,20")).toBe(false);
    expect(payoutsMatchPreset([33, 33, 33], "100")).toBe(false);
  });

  it("中身の無いボタンには付かない", async () => {
    const { payoutsMatchPreset } = await import("../src/setupPayouts.js");
    expect(payoutsMatchPreset([], "")).toBe(false);
    expect(payoutsMatchPreset([100], undefined)).toBe(false);
  });
});
