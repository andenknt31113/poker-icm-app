// 9. web 全機能無料開放: 通常ブラウザでは pro フラグなしでも
//    スタック編集・プレイヤー追加・ペイ編集がすべて使え、ペイウォールが出ない。
//
// freemium の Pro ゲートはアプリ版 (Capacitor ネイティブ) のみで有効。
// ネイティブ時のゲート判定 (isPro の OR ロジック・RevenueCat 連携) は
// ユニットテスト (test/entitlement.test.ts) が担保する。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testWebFullyFree({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true }); // pro フラグ無し
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "web-fully-free");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.waitForSelector("#players-list .player-row", { state: "visible" });

    // ① スタック入力が編集可能 (readonly でも 🔒 でもない)
    const stackReadonly = await page.$eval("#players-list .player-stack", (el) =>
      el.hasAttribute("readonly"),
    );
    if (stackReadonly) throw new Error("web でスタック入力が readonly になっている");
    const lockBadge = await page.$("#players-list .lock-badge");
    if (lockBadge) throw new Error("web で 🔒 バッジが表示されている");

    // ② スタックを実際に編集できる
    await page.fill("#players-list .player-stack", "42");
    const applied = await page.$eval("#players-list .player-stack", (el) => el.value);
    if (applied !== "42") throw new Error(`スタック編集が反映されない: "${applied}"`);

    // ③ プレイヤー追加でペイウォールが出ず、実際に増える
    const before = await page.$$eval("#players-list .player-row", (els) => els.length);
    await page.click("#add-player");
    await page.waitForFunction(
      (n) => document.querySelectorAll("#players-list .player-row").length === n + 1,
      before,
      { timeout: 5_000 },
    );
    const paywallVisible = await page.evaluate(() => {
      const m = document.getElementById("paywall-modal");
      return !!m && !m.classList.contains("hidden");
    });
    if (paywallVisible) throw new Error("web でペイウォールが表示された");

    // ④ ペイ金額も編集できる
    const payoutReadonly = await page.$eval(".payout-amount", (el) => el.hasAttribute("readonly"));
    if (payoutReadonly) throw new Error("web でペイ金額入力が readonly になっている");

    assertNoErrors(errors, "web 全機能無料開放フロー");
  } finally {
    await context.close();
  }
}
