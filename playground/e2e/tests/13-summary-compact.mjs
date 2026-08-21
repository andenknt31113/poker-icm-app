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
    await page.click('.tab-btn[data-tab="result"]');
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
        contextHidden: hidden(".hero-summary-context"),
        rowsHidden: hidden(".hero-summary-row"),
        gridVisible: !hidden(".hero-summary-grid"),
        verdictVisible: !hidden("#hero-summary-verdict-btn"),
        heightPct: el.getBoundingClientRect().height / window.innerHeight,
      };
    });
    if (!compact.contextHidden || !compact.rowsHidden) {
      throw new Error("floating 中に文脈行が畳まれていない");
    }
    if (!compact.gridVisible || !compact.verdictVisible) {
      throw new Error("floating 中に BF グリッド or 一行判定が消えている");
    }
    if (compact.heightPct > 0.2) {
      throw new Error(`floating 中の占有率が想定超え: ${(compact.heightPct * 100).toFixed(0)}%`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(
      () => !document.getElementById("hero-summary").classList.contains("floating"),
    );
    const expanded = await page.evaluate(() => {
      const el = document.getElementById("hero-summary");
      const t = el.querySelector(".hero-summary-row");
      return !!t && t.offsetParent !== null;
    });
    if (!expanded) throw new Error("トップ復帰後に自分/相手行が再表示されていない");

    assertNoErrors(errors, "サマリーのスクロール時コンパクト化フロー");
  } finally {
    await context.close();
  }
}
