// 6. プリセット/デフォルトの position-warn ゼロ化 (Issue #13)
//
// 初期状態 (DEFAULT_PLAYERS) + 全8シナリオプリセットを順に適用し、
// 計算結果タブの #position-warn (ポジション逆転警告) が常に hidden で
// あることをループで機械的に確認する。
// (深さ警告 #depth-warn-* はこの検証の対象外。20bb 超のスタック構成では
//  出て構わない = 数学的に正しい注意のため。)
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

const SCENARIO_IDS = [
  "ft9",
  "ftBubble",
  "ft6",
  "ft4",
  "ft3",
  "hu",
  "huShort",
  "satellite3",
];

async function isPositionWarnHidden(page) {
  return page.$eval("#position-warn", (el) => el.classList.contains("hidden"));
}

export default async function testPositionWarnZero({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true, pro: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "position-warn-zero");

    await page.goto(baseURL, { waitUntil: "load" });

    // ---- 0. 初期状態 (DEFAULT_PLAYERS) ----
    await page.click('.tab-btn[data-tab="result"]');
    await page.waitForSelector("#position-warn", { state: "attached" });
    if (!(await isPositionWarnHidden(page))) {
      throw new Error("初期状態 (デフォルトサンプル) で position-warn が表示されています");
    }

    // ---- 1〜8. 全シナリオプリセット ----
    for (const id of SCENARIO_IDS) {
      await page.click('.tab-btn[data-tab="setup"]');
      await page.click(`.scenario-btn[data-scenario="${id}"]`);
      await page.click('.tab-btn[data-tab="result"]');
      const hidden = await isPositionWarnHidden(page);
      if (!hidden) {
        const html = await page.$eval("#position-warn", (el) => el.innerHTML);
        throw new Error(
          `プリセット "${id}" 適用後に position-warn が表示されています: ${html}`,
        );
      }
    }

    assertNoErrors(errors, "全プリセット+デフォルトの position-warn ゼロ化確認");
  } finally {
    await context.close();
  }
}
