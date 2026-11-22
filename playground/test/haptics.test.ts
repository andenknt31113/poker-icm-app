import { beforeEach, describe, expect, it, vi } from "vitest";

let native = false;
const calls: string[] = [];
const mockHaptics = {
  selectionStart: vi.fn(async () => { calls.push("selectionStart"); }),
  selectionChanged: vi.fn(async () => { calls.push("selectionChanged"); }),
  selectionEnd: vi.fn(async () => { calls.push("selectionEnd"); }),
  impact: vi.fn(async (opts?: { style: string }) => { calls.push(`impact:${opts?.style}`); }),
  notification: vi.fn(async (opts?: { type: string }) => { calls.push(`notification:${opts?.type}`); }),
};

vi.mock("../src/capacitorEnv.js", () => ({
  isCapacitorNative: () => native,
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: mockHaptics,
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
  NotificationType: { Success: "SUCCESS", Warning: "WARNING", Error: "ERROR" },
}));

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.resetModules();
  calls.length = 0;
  vi.clearAllMocks();
  native = false;
});

describe("haptics", () => {
  it("非ネイティブ環境では @capacitor/haptics を呼ばない", async () => {
    const { hapticSelection, hapticLight, hapticSuccess } = await import("../src/haptics.js");
    hapticSelection();
    hapticLight();
    hapticSuccess();
    await flush();
    expect(calls).toEqual([]);
  });

  it("iOS ネイティブでは selectionStart→selectionChanged→selectionEnd / impact / notification を呼ぶ", async () => {
    native = true;
    const { hapticSelection, hapticLight, hapticSuccess } = await import("../src/haptics.js");
    hapticSelection();
    await vi.waitFor(() => {
      expect(calls).toEqual(["selectionStart", "selectionChanged", "selectionEnd"]);
    });

    calls.length = 0;
    hapticLight();
    hapticSuccess();
    await vi.waitFor(() => {
      expect(calls).toEqual(["impact:LIGHT", "notification:SUCCESS"]);
    });
  });

  it("ネイティブ側の呼び出しが失敗しても例外を漏らさない", async () => {
    native = true;
    mockHaptics.impact.mockRejectedValueOnce(new Error("unsupported"));
    const { hapticLight } = await import("../src/haptics.js");
    expect(() => hapticLight()).not.toThrow();
    await flush();
  });
});
