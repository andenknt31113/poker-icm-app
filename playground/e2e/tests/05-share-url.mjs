// 5. URL共有: hash生成 → 新しいコンテキストで復元 (プレイヤー数一致)
//
// Playwright の BrowserContext は既定でクリップボード権限を持たないため、
// navigator.clipboard.writeText() は常に失敗し、共有ボタンは決定的に
// フォールバック分岐 (readonly input に完全な共有URLを表示) に入る。
// そのフォールバック input の value から共有URL (#s=... ハッシュ付き) を
// 読み取り、新しいコンテキストでその URL を直接開いて状態が復元される
// ことを検証する (クリップボード読み取り権限に依存しないため安定)。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

const FTBUBBLE_PLAYER_COUNT = 4;

export default async function testShareUrl({ baseURL, createContext }) {
  const context1 = await createContext({ tutorialDone: true });
  try {
    const page1 = await context1.newPage();
    const errors1 = attachErrorCollector(page1, "share-url:source");

    await page1.goto(baseURL, { waitUntil: "load" });
    await page1.click('.scenario-btn[data-scenario="ftBubble"]');
    await page1.click("#share-url-btn-top");

    await page1.waitForSelector("#share-toast-url-input", { state: "visible" });
    const sharedUrl = await page1.getAttribute("#share-toast-url-input", "value");
    if (!sharedUrl || !sharedUrl.includes("#s=")) {
      throw new Error(`共有URLの生成に失敗しました: "${sharedUrl}"`);
    }

    assertNoErrors(errors1, "共有URL生成 (元コンテキスト)");

    const context2 = await createContext({ tutorialDone: true });
    try {
      const page2 = await context2.newPage();
      const errors2 = attachErrorCollector(page2, "share-url:restored");

      await page2.goto(sharedUrl, { waitUntil: "load" });
      await page2.waitForFunction(
        (expected) => document.querySelectorAll("#players-list .player-row").length === expected,
        FTBUBBLE_PLAYER_COUNT,
        { timeout: 10_000 },
      );

      const restoredCount = await page2.$$eval(
        "#players-list .player-row",
        (els) => els.length,
      );
      if (restoredCount !== FTBUBBLE_PLAYER_COUNT) {
        throw new Error(
          `復元後のプレイヤー数が一致しません: expected=${FTBUBBLE_PLAYER_COUNT} actual=${restoredCount}`,
        );
      }

      assertNoErrors(errors2, "共有URL復元 (新コンテキスト)");
    } finally {
      await context2.close();
    }
  } finally {
    await context1.close();
  }
}
