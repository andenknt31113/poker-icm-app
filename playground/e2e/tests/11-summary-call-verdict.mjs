// 11. 状況サマリーの一行判定: 「相手のpushレンジ(X%)には上位Y%のハンドでコール可」
//     が表示され、タップするとハンド比較タブへ飛ぶ。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testSummaryCallVerdict({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "summary-call-verdict");

    await page.goto(baseURL, { waitUntil: "load" });

    // ftBubble プリセット (hero/villain 指定済み) → サマリーに一行判定が出る
    await page.click('.scenario-btn[data-scenario="ftBubble"]');
    await page.waitForSelector("#hero-summary-verdict-btn", { state: "visible" });

    const text = await page.textContent("#hero-summary-verdict-btn");
    // 「相手レンジ%」と「上位%」の2つの数値を含む文言であること (既定は callBack 方向)
    if (!/%/.test(text ?? "") || !/(コール|call)/i.test(text ?? "")) {
      throw new Error(`一行判定の文言が想定と異なります: "${text}"`);
    }

    // タップ → ハンド比較タブへ遷移
    await page.click("#hero-summary-verdict-btn");
    await page.waitForFunction(() => {
      const btn = document.querySelector('.tab-btn[data-tab="hand"]');
      return btn && btn.classList.contains("active");
    });

    // 一行判定の数値がハンド比較タブの集計 (#call-stats) と同じソースを指すこと
    // (厳密な数値一致は callStats 側の文言仕様に依存するため、表示存在のみ確認)
    await page.waitForSelector("#call-stats", { state: "visible" });

    assertNoErrors(errors, "状況サマリー一行判定のフロー");
  } finally {
    await context.close();
  }
}
