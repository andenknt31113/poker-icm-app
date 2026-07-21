// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { t, applyStaticTranslations, getLang } from "../src/i18n.js";
import { ja } from "../src/locales/ja.js";

describe("i18n t()", () => {
  it("辞書のキーを引き当てて文言を返す", () => {
    expect(t("tabs.setup")).toBe("セットアップ");
    expect(t("tabs.practice")).toBe("練習");
  });

  it("辞書の値がそのまま (句読点・空白込みで) 返る", () => {
    expect(t("setup.payouts.hint")).toBe(ja["setup.payouts.hint"]);
  });

  it("{name} プレースホルダを params で置換する", () => {
    expect(t("setup.players.addMax", { n: 9 })).toBe("(最大 9 人)");
    expect(t("hand.callStats.callBack", { req: 37.8, callable: 68, callPct: 40, marginal: 39 })).toBe(
      "必要勝率 <strong>37.8%</strong> 以上のハンド: <strong>68</strong>個 (Top 40%) ／ ボーダーライン: 39個",
    );
  });

  it("同じプレースホルダが複数回あってもすべて置換する", () => {
    const out = t("calc.warn.position.html", {
      heroPos: "BB",
      heroAct: 2,
      villainPos: "SB",
      villainAct: 1,
    });
    // heroPos は文中に複数回登場する
    expect(out.match(/BB/g)?.length).toBeGreaterThanOrEqual(2);
    expect(out).not.toContain("{heroPos}");
    expect(out).not.toContain("{villainPos}");
  });

  it("params を渡さなければテンプレートはそのまま返る", () => {
    expect(t("practice.badge.streak")).toBe("🔥 連続正解 {n}");
  });

  it("未定義のプレースホルダは元の {name} を残す", () => {
    expect(t("practice.badge.streak", { other: 1 })).toBe("🔥 連続正解 {n}");
  });

  it("欠損キーは console.warn してキー文字列を返す", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(t("this.key.does.not.exist")).toBe("this.key.does.not.exist");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("Phase A の既定言語は ja", () => {
    expect(getLang()).toBe("ja");
  });
});

describe("applyStaticTranslations", () => {
  it("[data-i18n] は textContent を辞書値にする", () => {
    document.body.innerHTML = `<span data-i18n="tabs.result">X</span>`;
    applyStaticTranslations(document.body);
    expect(document.body.querySelector("span")?.textContent).toBe("計算結果");
  });

  it("[data-i18n-html] は innerHTML を辞書値にする", () => {
    document.body.innerHTML = `<p data-i18n-html="firstHint.html">X</p>`;
    applyStaticTranslations(document.body);
    expect(document.body.querySelector("p")?.innerHTML).toBe(ja["firstHint.html"]);
    // <strong> マークアップが保持される
    expect(document.body.querySelector("strong")).not.toBeNull();
  });

  it("[data-i18n-attr] は指定属性を辞書値にする", () => {
    document.body.innerHTML = `<button data-i18n-attr="title:header.help.title;aria-label:header.help.aria">?</button>`;
    applyStaticTranslations(document.body);
    const btn = document.body.querySelector("button");
    expect(btn?.getAttribute("title")).toBe("使い方ガイド");
    expect(btn?.getAttribute("aria-label")).toBe("ヘルプ");
  });
});
