// 10. プレイヤー追加時のポジション自動採番: 既存の割り当ては動かさず、
//     新しい人数の正規セットで未使用のポジションが新プレイヤーに付く。
//     (4人 BB/SB/BTN/CO の ftBubble に追加 → 5人目は UTG)
//
// 追加は Pro 機能 (無料は3人まで) のため { pro: true } で実行する。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testAddPlayerAutoPosition({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true, pro: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "add-player-auto-position");

    await page.goto(baseURL, { waitUntil: "load" });

    // ftBubble プリセット: 4人 (BB / SB / BTN / CO)
    await page.click('.scenario-btn[data-scenario="ftBubble"]');
    await page.waitForFunction(
      () => document.querySelectorAll("#players-list .player-row").length === 4,
    );

    const positions = () =>
      page.$$eval("#players-list .player-pos", (els) => els.map((el) => el.value));

    const before = await positions();
    if (before.join(",") !== "BB,SB,BTN,CO") {
      throw new Error(`ftBubble の初期ポジションが想定と異なります: ${before.join(",")}`);
    }

    // 5人目を追加 → 既存4人は不変、新プレイヤーは 5-max セットの空き (UTG)
    await page.click("#add-player");
    await page.waitForFunction(
      () => document.querySelectorAll("#players-list .player-row").length === 5,
    );
    const after5 = await positions();
    if (after5.join(",") !== "BB,SB,BTN,CO,UTG") {
      throw new Error(`5人目の自動採番が想定と異なります: ${after5.join(",")}`);
    }

    // さらに追加 → 6-max セットの残り (HJ)
    await page.click("#add-player");
    await page.waitForFunction(
      () => document.querySelectorAll("#players-list .player-row").length === 6,
    );
    const after6 = await positions();
    if (after6.join(",") !== "BB,SB,BTN,CO,UTG,HJ") {
      throw new Error(`6人目の自動採番が想定と異なります: ${after6.join(",")}`);
    }

    assertNoErrors(errors, "プレイヤー追加のポジション自動採番フロー");
  } finally {
    await context.close();
  }
}
