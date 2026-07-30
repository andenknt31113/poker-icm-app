// 練習モード・難易度の型ガード (src/practice/types.ts) のユニットテスト。
//
// これらは localStorage から復元した値を絞り込む唯一の関門で、以前は
// `as PracticeMode` キャスト + 手書きの `v === "..." ||` 列挙だった。
// 型と検証を PRACTICE_MODES / DIFFICULTIES 配列に一元化した結果、
// 「型に列挙を足したのに検証を直し忘れる」ずれが構造上起きなくなったことを固定する。
import { describe, it, expect } from "vitest";
import {
  PRACTICE_MODES,
  DIFFICULTIES,
  isPracticeMode,
  isDifficulty,
} from "../src/practice/types.js";

describe("PRACTICE_MODES", () => {
  it("3 モードが定義されている", () => {
    expect([...PRACTICE_MODES]).toEqual(["callfold", "rp", "push"]);
  });

  it("定義済みの全モードが型ガードを通る", () => {
    for (const m of PRACTICE_MODES) expect(isPracticeMode(m)).toBe(true);
  });
});

describe("DIFFICULTIES", () => {
  it("3 段階が定義されている", () => {
    expect([...DIFFICULTIES]).toEqual(["easy", "normal", "hard"]);
  });

  it("定義済みの全難易度が型ガードを通る", () => {
    for (const d of DIFFICULTIES) expect(isDifficulty(d)).toBe(true);
  });
});

describe("型ガードが不正値を弾く", () => {
  // localStorage には手で書き換えた値・旧バージョンの値・null が入り得る。
  const junk = [
    null,
    undefined,
    "",
    "CALLFOLD", // 大文字は別物として扱う
    "callfold ", // 前後空白は許さない
    "medium", // 旧名/存在しない難易度
    0,
    1,
    true,
    {},
    [],
    ["callfold"],
  ];

  it("isPracticeMode", () => {
    for (const v of junk) expect(isPracticeMode(v)).toBe(false);
  });

  it("isDifficulty", () => {
    for (const v of junk) expect(isDifficulty(v)).toBe(false);
  });

  it("互いのモード/難易度を取り違えない", () => {
    expect(isPracticeMode("easy")).toBe(false);
    expect(isDifficulty("callfold")).toBe(false);
  });
});
