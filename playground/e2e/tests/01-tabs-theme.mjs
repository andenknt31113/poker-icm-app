// 1. 2タブ (計算 / 練習) レンダリング (ダーク固定) + console error / pageerror ゼロ
//
// 各タブのコンテンツが実際に描画される (要素が visible になる) ことを
// waitForSelector(state:"visible") で確認しつつ、ページ全体で
// console.error / pageerror が一度も発生しないことを検証する。
// テーマはダーク固定に一本化したため、過去の localStorage に "light" が
// 残っていてもダーク表示 (data-theme 属性なし) になることも併せて確認する。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

const TABS = ["analyze", "practice"];

// 各タブが描画済みであることを示す代表セレクタ。
const TAB_READY_SELECTOR = {
  // 分析タブは 計算結果+レンジ比較+Nash の縦フロー。代表として必要勝率とレンジグリッドを待つ
  analyze: "#grid-hero",
  // .mode-btn は #practice-area の外 (静的マークアップ) にあるため tab セクション基準で待つ。
  // 導入コース完了扱いにしているので、練習タブは即座に問題が出題される。
  practice: '.card[data-tab="practice"] .mode-btn',
};

export default async function testTabsTheme({ baseURL, createContext }) {
  // 旧バージョンで保存された "light" 設定が残っているケースを再現し、
  // それでもダーク固定になることを検証する。
  const context = await createContext({ theme: "light", tutorialDone: true, pro: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "dark-fixed");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.waitForSelector(".tab-btn", { state: "visible" });

    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    if (dataTheme !== null) {
      throw new Error(`ダーク固定のはずが data-theme="${dataTheme}" が付与されている`);
    }
    const hasToggle = await page.$("#theme-toggle");
    if (hasToggle) throw new Error("廃止済みのテーマ切替ボタンが DOM に残っている");

    // 計算タブは局面の入力と結果が同じ画面にある
    await page.waitForSelector("#players-list .player-row", { state: "visible" });
    if (await page.locator('.tab-btn[data-tab="setup"]').count()) throw new Error("廃止したセットアップタブが残っている");
    for (const tab of TABS) {
      await page.click(`.tab-btn[data-tab="${tab}"]`);
      await page.waitForSelector(TAB_READY_SELECTOR[tab], { state: "visible", timeout: 10_000 });
      const isActive = await page.$eval(
        `.tab-btn[data-tab="${tab}"]`,
        (el) => el.classList.contains("active"),
      );
      if (!isActive) throw new Error(`タブ "${tab}" がアクティブになりませんでした`);
    }

    assertNoErrors(errors, "ダーク固定での3タブ巡回");
  } finally {
    await context.close();
  }
}
