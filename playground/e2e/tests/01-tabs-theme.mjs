// 1. 5タブ x ダーク/ライト レンダリング + console error / pageerror ゼロ
//
// 各タブのコンテンツが実際に描画される (要素が visible になる) ことを
// waitForSelector(state:"visible") で確認しつつ、ページ全体で
// console.error / pageerror が一度も発生しないことを検証する。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

const TABS = ["setup", "result", "hand", "nash", "practice"];

// 各タブが描画済みであることを示す代表セレクタ。
const TAB_READY_SELECTOR = {
  setup: "#players-list .player-row",
  result: "#eq-result",
  hand: '.card[data-tab="hand"] .hand-grid',
  nash: "#nash-solve",
  // .mode-btn は #practice-area の外 (静的マークアップ) にあるため tab セクション基準で待つ。
  // 導入コース完了扱いにしているので、練習タブは即座に問題が出題される。
  practice: '.card[data-tab="practice"] .mode-btn',
};

export default async function testTabsTheme({ baseURL, createContext }) {
  for (const theme of ["dark", "light"]) {
    const context = await createContext({ theme, tutorialDone: true, pro: true });
    try {
      const page = await context.newPage();
      const errors = attachErrorCollector(page, `theme=${theme}`);

      await page.goto(baseURL, { waitUntil: "load" });
      await page.waitForSelector(".tab-btn", { state: "visible" });

      const actualTheme = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
      );
      if (actualTheme !== theme) {
        throw new Error(`テーマの反映に失敗: expected=${theme} actual=${actualTheme}`);
      }

      for (const tab of TABS) {
        await page.click(`.tab-btn[data-tab="${tab}"]`);
        await page.waitForSelector(TAB_READY_SELECTOR[tab], { state: "visible", timeout: 10_000 });
        const isActive = await page.$eval(
          `.tab-btn[data-tab="${tab}"]`,
          (el) => el.classList.contains("active"),
        );
        if (!isActive) throw new Error(`タブ "${tab}" がアクティブになりませんでした`);
      }

      assertNoErrors(errors, `theme=${theme} での5タブ巡回`);
    } finally {
      await context.close();
    }
  }
}
