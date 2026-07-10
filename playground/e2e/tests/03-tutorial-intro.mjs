// 3. 導入コース: 開始 → 1問目のナレーション表示まで
//
// このテストだけは tutorialDone:false (未完了・未スキップ状態) の
// コンテキストを使い、練習タブを開いたときに導入コースの案内カードが出て、
// 「導入コースを始める」をタップすると1問目のナレーションが表示される
// ところまでを検証する。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testTutorialIntro({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: false });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "tutorial-intro");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.click('.tab-btn[data-tab="practice"]');

    await page.waitForSelector("#tutorial-intro-start-btn", { state: "visible" });
    await page.click("#tutorial-intro-start-btn");

    await page.waitForSelector(".tutorial-narration-title", { state: "visible" });
    const title = await page.textContent(".tutorial-narration-title");
    if (!title || !title.includes("問題 1")) {
      throw new Error(`導入コース1問目のナレーションタイトルが想定と異なります: "${title}"`);
    }
    const narrationBody = await page.textContent(".tutorial-narration-body");
    if (!narrationBody || narrationBody.trim().length === 0) {
      throw new Error("導入コース1問目のナレーション本文が空です");
    }
    await page.waitForSelector("#tutorial-start-problem-btn", { state: "visible" });

    assertNoErrors(errors, "導入コース開始フロー");
  } finally {
    await context.close();
  }
}
