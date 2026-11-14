// 13. 状況サマリーのスクロール時コンパクト化:
//     スクロール中は文脈行が畳まれ (floating)、BF/必要勝率/RP と一行判定だけ残る。
//     トップに戻ると全体表示に復帰する。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testSummaryCompact({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "summary-compact");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.click('.scenario-btn[data-scenario="ftBubble"]');
    await page.click('.tab-btn[data-tab="analyze"]');
    await page.click('[data-jump="sec-icm"]');
    await page.waitForSelector("#bf-matrix .bf-cell", { state: "visible" });

    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForFunction(() =>
      document.getElementById("hero-summary").classList.contains("floating"),
    );
    const compact = await page.evaluate(() => {
      const el = document.getElementById("hero-summary");
      const hidden = (sel) => {
        const t = el.querySelector(sel);
        return !t || t.offsetParent === null;
      };
      return {
        subHidden: hidden(".hero-summary-sub"),
        verdictHidden: hidden("#hero-summary-verdict-btn"),
        gridVisible: !hidden(".hero-summary-grid"),
        spotVisible: !hidden(".hero-summary-row-stack"),
        heightPct: el.getBoundingClientRect().height / window.innerHeight,
      };
    });
    if (!compact.subHidden || !compact.verdictHidden) {
      throw new Error("floating 中に補足行・一行判定が畳まれていない");
    }
    if (!compact.gridVisible || !compact.spotVisible) {
      throw new Error("floating 中に 必要勝率/RP/BF or 局面の1行 (スタック) が消えている");
    }
    if (compact.heightPct > 0.15) {
      throw new Error(`floating 中の占有率が想定超え: ${(compact.heightPct * 100).toFixed(0)}%`);
    }

    const safeAreaTop = 62;
    const safeAreaLayout = await page.evaluate((inset) => {
      document.documentElement.style.setProperty("--safe-area-top", `${inset}px`);
      return {
        summaryTop: document.getElementById("hero-summary").getBoundingClientRect().top,
        anchorMargin: parseFloat(getComputedStyle(document.getElementById("sec-icm")).scrollMarginTop),
        statusBarHeight: parseFloat(getComputedStyle(document.body, "::before").height),
      };
    }, safeAreaTop);
    if (safeAreaLayout.summaryTop < safeAreaTop || safeAreaLayout.anchorMargin < 170 + safeAreaTop || safeAreaLayout.statusBarHeight !== safeAreaTop) {
      throw new Error("サマリーまたはジャンプ先が上部セーフエリアを考慮していない");
    }
    await page.evaluate(() => document.documentElement.style.removeProperty("--safe-area-top"));

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(
      () => !document.getElementById("hero-summary").classList.contains("floating"),
    );
    const expanded = await page.evaluate(() => {
      const el = document.getElementById("hero-summary");
      const t = el.querySelector("#hero-summary-verdict-btn");
      return !!t && t.offsetParent !== null;
    });
    if (!expanded) throw new Error("トップ復帰後に一行判定が再表示されていない");

    assertNoErrors(errors, "サマリーのスクロール時コンパクト化フロー");
  } finally {
    await context.close();
  }
}
