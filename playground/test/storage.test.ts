// @vitest-environment jsdom
//
// localStorage 共通層 (src/storage.ts) のユニットテスト。
//
// このテストの主目的は 2 つ:
//   1. 永続化キー文字列の凍結。既存ユーザーの保存データ (シナリオ・成績・購入
//      キャッシュ) との互換はキー文字列そのものに依存するため、リファクタで
//      うっかり改名したら即座に落とす回帰テストにする。
//   2. 例外を投げないこと。localStorage は Safari プライベートモードや容量超過で
//      getItem/setItem 自体が throw するため、この層が全経路で throw を吸収して
//      いることを担保する (呼び出し側は try/catch を書かない前提)。
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  STORAGE_KEYS,
  readRaw,
  writeRaw,
  removeRaw,
  readFlag,
  writeFlag,
  readJson,
  writeJson,
} from "../src/storage.js";

beforeEach(() => {
  localStorage.clear();
});

describe("STORAGE_KEYS (永続化キーの凍結)", () => {
  // 値をハードコードで突き合わせる。ここを書き換える変更は
  // 「既存ユーザーのデータが読めなくなる」破壊的変更なので、意図的にしか通せない。
  it("既存ユーザーのデータ互換のためキー文字列が変わっていない", () => {
    expect(STORAGE_KEYS).toEqual({
      appState: "poker-icm-app-state-v1",
      activeTab: "poker-icm-active-tab",
      lang: "poker-icm-lang",
      heroSummaryCollapsed: "poker-icm-hero-summary-collapsed",
      onboardingDone: "poker-icm-onboarding-done",
      firstHintDismissed: "poker-icm-first-hint-dismissed",
      customRange: "poker-icm-custom-range",
      userScenarios: "poker-icm-user-scenarios",
      savedPayouts: "poker-icm-saved-payouts",
      collapseScenarioPresets: "poker-icm-collapse-scenario-presets",
      collapsePayoutPresets: "poker-icm-collapse-payout-presets",
      iosInstallHint: "poker-icm-ios-install-hint",
      pro: "poker-icm-pro",
      proRcCache: "poker-icm-pro-rc",
      tutorialDone: "poker-icm-tutorial-done",
      practiceDifficulty: "poker-icm-practice-diff",
      practiceMode: "poker-icm-practice-mode",
      practiceStreak: "poker-icm-practice-streak",
      practiceStats: "poker-icm-practice-stats",
      practiceReview: "poker-icm-practice-review",
      practiceHistory: "poker-icm-practice-history",
    });
  });

  it("すべてのキーが poker-icm- プレフィックスを持つ (他アプリとの衝突回避)", () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith("poker-icm-")).toBe(true);
    }
  });

  it("キーが重複していない (別用途が同じ場所を上書きしない)", () => {
    const values = Object.values(STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("readRaw / writeRaw / removeRaw", () => {
  it("書いた値をそのまま読める", () => {
    writeRaw(STORAGE_KEYS.lang, "en");
    expect(readRaw(STORAGE_KEYS.lang)).toBe("en");
  });

  it("未設定キーは null", () => {
    expect(readRaw(STORAGE_KEYS.lang)).toBeNull();
  });

  it("removeRaw で未設定に戻る", () => {
    writeRaw(STORAGE_KEYS.lang, "en");
    removeRaw(STORAGE_KEYS.lang);
    expect(readRaw(STORAGE_KEYS.lang)).toBeNull();
  });
});

describe("readFlag / writeFlag", () => {
  it('writeFlag(true) は "1"、false は "0" を書く (既存表現を維持)', () => {
    writeFlag(STORAGE_KEYS.onboardingDone, true);
    expect(readRaw(STORAGE_KEYS.onboardingDone)).toBe("1");
    writeFlag(STORAGE_KEYS.onboardingDone, false);
    expect(readRaw(STORAGE_KEYS.onboardingDone)).toBe("0");
  });

  it('"1" のときだけ true', () => {
    writeRaw(STORAGE_KEYS.onboardingDone, "1");
    expect(readFlag(STORAGE_KEYS.onboardingDone)).toBe(true);
    for (const v of ["0", "", "true", "yes", "01"]) {
      writeRaw(STORAGE_KEYS.onboardingDone, v);
      expect(readFlag(STORAGE_KEYS.onboardingDone)).toBe(false);
    }
  });

  it("未設定キーは false", () => {
    expect(readFlag(STORAGE_KEYS.onboardingDone)).toBe(false);
  });
});

describe("readJson / writeJson", () => {
  const isNumberArray = (v: unknown): v is number[] =>
    Array.isArray(v) && v.every((x) => typeof x === "number");

  it("書いた JSON を検証つきで読める", () => {
    writeJson(STORAGE_KEYS.savedPayouts, [50, 30, 20]);
    expect(readJson(STORAGE_KEYS.savedPayouts, [], isNumberArray)).toEqual([50, 30, 20]);
  });

  it("未設定キーは fallback", () => {
    expect(readJson(STORAGE_KEYS.savedPayouts, [1], isNumberArray)).toEqual([1]);
  });

  it("壊れた JSON は fallback (throw しない)", () => {
    writeRaw(STORAGE_KEYS.savedPayouts, "{ではないし配列でもない");
    expect(readJson(STORAGE_KEYS.savedPayouts, [1], isNumberArray)).toEqual([1]);
  });

  it("JSON として妥当でも検証に落ちれば fallback", () => {
    writeRaw(STORAGE_KEYS.savedPayouts, '["50","30"]');
    expect(readJson(STORAGE_KEYS.savedPayouts, [1], isNumberArray)).toEqual([1]);
  });

  it("循環参照でも throw しない (書き込みは黙って失敗)", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => writeJson(STORAGE_KEYS.savedPayouts, circular)).not.toThrow();
  });
});

describe("localStorage が使えない環境", () => {
  // Safari プライベートモード等では getItem/setItem 自体が SecurityError を投げる。
  // その状況を再現し、この層が全 API で throw を吸収することを確認する。
  let spies: ReturnType<typeof vi.spyOn>[] = [];

  beforeEach(() => {
    const boom = (): never => {
      throw new Error("SecurityError: localStorage は使用できません");
    };
    spies = [
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom),
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom),
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom),
    ];
  });

  afterEach(() => {
    for (const s of spies) s.mockRestore();
  });

  it("読み取りは throw せず既定値を返す", () => {
    expect(() => readRaw(STORAGE_KEYS.lang)).not.toThrow();
    expect(readRaw(STORAGE_KEYS.lang)).toBeNull();
    expect(readFlag(STORAGE_KEYS.pro)).toBe(false);
    expect(readJson(STORAGE_KEYS.savedPayouts, [7], Array.isArray)).toEqual([7]);
  });

  it("書き込み・削除は throw せず黙って失敗する", () => {
    expect(() => writeRaw(STORAGE_KEYS.lang, "en")).not.toThrow();
    expect(() => writeFlag(STORAGE_KEYS.pro, true)).not.toThrow();
    expect(() => writeJson(STORAGE_KEYS.savedPayouts, [1])).not.toThrow();
    expect(() => removeRaw(STORAGE_KEYS.lang)).not.toThrow();
  });
});
