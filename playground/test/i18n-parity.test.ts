// en.ts と ja.ts が完全に同一のキー集合を持つことを機械チェックする (Phase B)。
// 翻訳漏れ (en に無いキー) と余剰 (ja に無いキー) を両方向で検出する。
import { describe, it, expect } from "vitest";
import { ja } from "../src/locales/ja.js";
import { en } from "../src/locales/en.js";

describe("i18n 辞書のキー網羅性 (ja ⇔ en)", () => {
  const jaKeys = Object.keys(ja).sort();
  const enKeys = Object.keys(en).sort();

  it("en は ja の全キーを持つ (翻訳漏れなし)", () => {
    const missingInEn = jaKeys.filter((k) => !(k in en));
    expect(missingInEn).toEqual([]);
  });

  it("en に ja へ存在しない余剰キーが無い", () => {
    const extraInEn = enKeys.filter((k) => !(k in ja));
    expect(extraInEn).toEqual([]);
  });

  it("キー集合が完全一致する", () => {
    expect(enKeys).toEqual(jaKeys);
  });

  it("同一プレースホルダ集合を持つ (訳出時の {name} 取りこぼし検出)", () => {
    const placeholders = (s: string) =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const mismatches: string[] = [];
    for (const k of jaKeys) {
      const jp = JSON.stringify(placeholders(ja[k]!));
      const ep = JSON.stringify(placeholders(en[k]!));
      if (jp !== ep) mismatches.push(`${k}: ja=${jp} en=${ep}`);
    }
    expect(mismatches).toEqual([]);
  });

  it("en に未翻訳の日本語が残っていない (かな/漢字ゼロ)", () => {
    // 用語・コード内の全角記号は許容し、かな・漢字のみを検出対象にする。
    const jpChars = /[ぁ-んァ-ヶ一-龠]/;
    const leftover = enKeys.filter((k) => jpChars.test(en[k]!));
    expect(leftover).toEqual([]);
  });
});
