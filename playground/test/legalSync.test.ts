import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGAL_CONTENT_HTML } from "../src/legalContent.js";
import { FREE_MAX_PLAYERS } from "../src/entitlement.js";

/** タグと空白を落として、文面だけを比べられる形にする。 */
function plain(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
}

const START = "1.サービスの目的";
const publicPage = plain(readFileSync(new URL("../public/legal.html", import.meta.url), "utf8"));
const inApp = plain(LEGAL_CONTENT_HTML);

describe("利用規約: アプリ内の表示と公開ページ", () => {
  it("本文が同じ (片方だけ直して食い違うのを防ぐ)", () => {
    const a = inApp.slice(inApp.indexOf(START));
    const b = publicPage.slice(publicPage.indexOf(START), publicPage.indexOf(START) + a.length);
    expect(inApp.indexOf(START)).toBeGreaterThanOrEqual(0);
    expect(b).toBe(a);
  });

  it("無料で編集できる人数が、実際の設定と合っている", () => {
    expect(inApp).toContain(`${FREE_MAX_PLAYERS}人までの卓の自由な編集）は無料`);
    expect(inApp).toContain(`${FREE_MAX_PLAYERS + 1}人以上の卓の編集`);
  });

  it("今の画面に無い呼び名 (練習・シナリオ・Web 版) を使っていない", () => {
    for (const text of [inApp, publicPage]) {
      expect(text).not.toMatch(/練習|シナリオ|プリセット|Web版|アプリ版/);
    }
  });
});
