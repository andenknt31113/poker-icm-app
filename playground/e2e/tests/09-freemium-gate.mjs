// 9. freemium ゲート (3人ルール): 3人以下は自由編集 / 4人以上の編集と
//    プレイヤー追加 (3人到達後) は Pro ゲート / プリセット閲覧は常に無料。
//
// ネイティブ判定に依存しないゲート (isPro + 人数) は web でも同一挙動のため
// ブラウザ E2E で検証できる。RevenueCat 連携はユニットテストが担保。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testFreemiumGate({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true }); // pro フラグ無し = 無料
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "freemium-3max");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.waitForSelector("#players-list .player-row", { state: "visible" });

    const rowCount = () => page.$$eval("#players-list .player-row", (els) => els.length);
    const stackReadonly = () =>
      page.$eval("#players-list .player-stack", (el) => el.hasAttribute("readonly"));
    const paywallVisible = () =>
      page.evaluate(() => {
        const m = document.getElementById("paywall-modal");
        return !!m && !m.classList.contains("hidden");
      });

    // ① 初期状態はデフォルト3人 (ft3相当) → 無料でも編集可能な状態で始まる
    if ((await rowCount()) !== 3) throw new Error("デフォルトが3人になっていない");
    if (await stackReadonly()) throw new Error("初期3人なのにスタックが readonly");

    // ② プリセット閲覧は無料 (ftBubble=4人 → 計算結果が見られる)
    await page.click('.scenario-btn[data-scenario="ftBubble"]');
    await page.click('.tab-btn[data-tab="result"]');
    await page.waitForSelector("#bf-matrix .bf-cell", { state: "visible" });

    // ③ 3-handed プリセット (3人) → 編集可能になり、実際に編集できる
    await page.click('.tab-btn[data-tab="setup"]');
    await page.click('.scenario-btn[data-scenario="ft3"]');
    await page.waitForFunction(
      () => document.querySelectorAll("#players-list .player-row").length === 3,
    );
    if (await stackReadonly()) throw new Error("3人なのにスタックが readonly");
    await page.fill("#players-list .player-stack", "42");
    const v = await page.$eval("#players-list .player-stack", (el) => el.value);
    if (v !== "42") throw new Error(`3人での編集が反映されない: "${v}"`);
    const payoutReadonly = await page.$eval(".payout-amount", (el) => el.hasAttribute("readonly"));
    if (payoutReadonly) throw new Error("3人なのにペイ金額が readonly");

    // ④ 3人から追加しようとする → ペイウォール表示 + 人数は増えない
    await page.click("#add-player");
    await page.waitForSelector("#paywall-modal:not(.hidden)", { state: "visible" });
    if ((await rowCount()) !== 3) throw new Error("ペイウォール表示中に人数が増えた");
    await page.click("#paywall-close");
    await page.waitForSelector("#paywall-modal.hidden", { state: "hidden" });

    // ⑤ 4人プリセット → ロック / 1人削除して3人 → 再び編集可能 (削除は無料)
    await page.click('.scenario-btn[data-scenario="ft4"]');
    await page.waitForFunction(
      () => document.querySelectorAll("#players-list .player-row").length === 4,
    );
    if (!(await stackReadonly())) throw new Error("4人で編集可能になっている");
    await page.click("#players-list .player-remove");
    await page.waitForFunction(
      () => document.querySelectorAll("#players-list .player-row").length === 3,
    );
    if (await paywallVisible()) throw new Error("削除でペイウォールが出た (削除は無料のはず)");
    if (await stackReadonly()) throw new Error("3人に減らしたのに編集できない");

    assertNoErrors(errors, "freemium 3人ルールのフロー");
  } finally {
    await context.close();
  }
}
