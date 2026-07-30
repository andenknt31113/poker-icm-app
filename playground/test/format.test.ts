// 表示フォーマット (src/format.ts) と HTML エスケープ (src/html.ts) の
// ユニットテスト。どちらも画面に出る文字列を直接作る純関数で、
// 非有限値の扱い ("∞" / "—") が UI の取り決めそのものなので固定しておく。
import { describe, it, expect } from "vitest";
import { fmt, fmtPct, fmtSigned } from "../src/format.js";
import { escapeHtml } from "../src/html.js";

describe("fmt", () => {
  it("既定は小数2桁", () => {
    expect(fmt(1)).toBe("1.00");
    expect(fmt(1.005)).toBe("1.00"); // toFixed の丸め挙動をそのまま採用
  });

  it("桁数を指定できる", () => {
    expect(fmt(1.23456, 3)).toBe("1.235");
    expect(fmt(1.5, 0)).toBe("2");
  });

  it("+∞ は ∞、それ以外の非有限値は — で表す", () => {
    expect(fmt(Number.POSITIVE_INFINITY)).toBe("∞");
    expect(fmt(Number.NEGATIVE_INFINITY)).toBe("—");
    expect(fmt(NaN)).toBe("—");
  });

  it("負数はそのまま符号付き", () => {
    expect(fmt(-2.5)).toBe("-2.50");
  });
});

describe("fmtPct", () => {
  it("0..1 を百分率にする (既定 1 桁)", () => {
    expect(fmtPct(0.5)).toBe("50.0%");
    expect(fmtPct(0.12345, 2)).toBe("12.35%");
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(1)).toBe("100.0%");
  });

  it("非有限値は — (∞ ではなく一律 —)", () => {
    expect(fmtPct(NaN)).toBe("—");
    expect(fmtPct(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("fmtSigned", () => {
  it("0 以上には + を付ける", () => {
    expect(fmtSigned(0)).toBe("+0.0");
    expect(fmtSigned(2.34)).toBe("+2.3");
  });

  it("負数は - のまま (二重符号にしない)", () => {
    expect(fmtSigned(-2.34)).toBe("-2.3");
  });

  it("桁数を指定できる", () => {
    expect(fmtSigned(1.25, 1)).toBe("+1.3");
    // 1.2345 は 2 進表現がわずかに下側なので toFixed(3) は切り下がる。
    // 表示側の丸めは toFixed 任せという取り決めをそのまま固定する。
    expect(fmtSigned(1.2345, 3)).toBe("+1.234");
  });
});

describe("escapeHtml", () => {
  it("& < > \" を実体参照にする", () => {
    expect(escapeHtml('&<>"')).toBe("&amp;&lt;&gt;&quot;");
  });

  it("& を最初に処理するので二重エスケープにならない", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
    expect(escapeHtml("a&lt;b")).toBe("a&amp;lt;b");
  });

  it("ユーザーが付けた名前に script を混ぜても無害な文字列になる", () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("属性値を閉じる \" を打ち消せる (属性はダブルクォート前提)", () => {
    expect(escapeHtml('" onclick="x')).toBe("&quot; onclick=&quot;x");
  });

  it("シングルクォートは変換しない (仕様: 属性はダブルクォートで囲む)", () => {
    expect(escapeHtml("it's")).toBe("it's");
  });

  it("通常の日本語・空文字はそのまま", () => {
    expect(escapeHtml("バブル 4人卓")).toBe("バブル 4人卓");
    expect(escapeHtml("")).toBe("");
  });
});
