// 4. プリセット (ftBubble) → 計算結果タブ → ハンド別判定セルタップ → バナー表示
//
// 「ハンド別判定」グリッド (#hv-grid) とバナー (#hv-banner) は
// data-tab="result" (計算結果タブ) のセクション内にある。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testPresetVerdictBanner({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "preset-verdict-banner");

    await page.goto(baseURL, { waitUntil: "load" });

    await page.click('.scenario-btn[data-scenario="ftBubble"]');
    await page.click('.tab-btn[data-tab="result"]');

    await page.waitForSelector("#hv-grid .hand-cell", { state: "visible" });
    // ftBubble は hero=BB(4bb) / villain=SB(18bb) 固定なので equity 差が明確な AKs で判定させる
    await page.click('#hv-grid .hand-cell[title="AKs"]');

    await page.waitForSelector("#hv-banner:not(.hidden)", { state: "visible" });
    const bannerText = await page.textContent("#hv-banner");
    if (!bannerText || !bannerText.includes("AKs")) {
      throw new Error(`ハンド別判定バナーの内容が想定と異なります: "${bannerText}"`);
    }
    const hasVerdictClass = await page.$eval(
      "#hv-banner",
      (el) => el.classList.contains("hv-banner-call") || el.classList.contains("hv-banner-fold"),
    );
    if (!hasVerdictClass) {
      throw new Error("ハンド別判定バナーに call/fold の判定クラスが付与されていません");
    }

    assertNoErrors(errors, "プリセット→計算結果→ハンド判定バナーのフロー");
  } finally {
    await context.close();
  }
}
