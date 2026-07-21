// 2. 練習3モード (call/fold判定 ⇄ RP当て ⇄ push判定) 各1問回答
//
// 各モードで1問ずつ回答し、再回答できないよう操作要素が disabled になる
// ことを確認する (judge.ts の recordPracticeResult 後の disabled 化を検証)。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testPracticeModes({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true, pro: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "practice-modes");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.click('.tab-btn[data-tab="practice"]');
    await page.waitForSelector(".mode-btn", { state: "visible" });

    // ---- 1. call/fold 判定 (デフォルトでアクティブなモード) ----
    const activeMode = await page.$eval(".mode-btn.active", (el) => el.dataset.mode);
    if (activeMode !== "callfold") {
      throw new Error(`デフォルトの練習モードが callfold ではありません: ${activeMode}`);
    }
    await page.waitForSelector('.practice-actions .practice-btn[data-answer="call"]', {
      state: "visible",
    });
    await page.click('.practice-actions .practice-btn[data-answer="call"]');
    await page.waitForFunction(() => {
      const btns = document.querySelectorAll(".practice-actions .practice-btn");
      return btns.length > 0 && Array.from(btns).every((b) => b.disabled);
    });

    // ---- 2. RP 当てモード (デフォルト難易度 normal はスライダー入力) ----
    await page.click('.mode-btn[data-mode="rp"]');
    await page.waitForSelector("#rp-slider", { state: "visible" });
    await page.evaluate(() => {
      const slider = document.getElementById("rp-slider");
      slider.value = "15";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.click("#rp-answer-btn");
    await page.waitForFunction(() => {
      const btn = document.getElementById("rp-answer-btn");
      return !!btn && btn.disabled;
    });

    // ---- 3. push 判定モード ----
    await page.click('.mode-btn[data-mode="push"]');
    await page.waitForSelector('.practice-actions .practice-btn[data-answer="push"]', {
      state: "visible",
    });
    await page.click('.practice-actions .practice-btn[data-answer="push"]');
    await page.waitForFunction(() => {
      const btns = document.querySelectorAll(".practice-actions .practice-btn");
      return btns.length > 0 && Array.from(btns).every((b) => b.disabled);
    });

    assertNoErrors(errors, "練習3モードの回答フロー");
  } finally {
    await context.close();
  }
}
