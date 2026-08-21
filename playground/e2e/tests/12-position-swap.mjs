// 12. ポジション変更の2段階挙動:
//     プリセット直後の1回目 = リング自動連動 / 2回目以降 = 保持者との入れ替え。
//     旧挙動 (毎回リング再割当) では「1人直すと別の人が壊れる」モグラ叩きに
//     なっていた回帰を防ぐ。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testPositionSwap({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true, pro: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "position-swap");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.click('.scenario-btn[data-scenario="ftBubble"]'); // 4人 BB,SB,BTN,CO
    await page.waitForFunction(
      () => document.querySelectorAll("#players-list .player-row").length === 4,
    );
    const positions = () =>
      page.$$eval("#players-list .player-pos", (els) => els.map((el) => el.value));

    // 1回目 (プリセット直後): リング自動連動 — #1 を BTN にすると全員が並び直す
    await page.selectOption("#players-list .player-row:nth-child(1) .player-pos", "BTN");
    const afterLink = await positions();
    if (afterLink.join(",") !== "BTN,SB,BB,CO") {
      throw new Error(`1回目のリング自動連動が想定と異なります: ${afterLink.join(",")}`);
    }

    // 2回目: 入れ替え — #2 (SB) を CO にすると、CO だった #4 が SB を引き取り
    // #1 と #3 は動かない
    await page.selectOption("#players-list .player-row:nth-child(2) .player-pos", "CO");
    const afterSwap = await positions();
    if (afterSwap.join(",") !== "BTN,CO,BB,SB") {
      throw new Error(`2回目の入れ替えが想定と異なります: ${afterSwap.join(",")}`);
    }

    // プリセットを適用し直すと自動連動に戻る
    await page.click('.scenario-btn[data-scenario="ftBubble"]');
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("#players-list .player-pos"))
          .map((el) => el.value)
          .join(",") === "BB,SB,BTN,CO",
    );
    await page.selectOption("#players-list .player-row:nth-child(2) .player-pos", "BTN");
    const afterRearm = await positions();
    if (afterRearm.join(",") !== "CO,BTN,SB,BB") {
      throw new Error(`プリセット再適用後の自動連動が想定と異なります: ${afterRearm.join(",")}`);
    }

    assertNoErrors(errors, "ポジション変更 (自動連動→入れ替え) のフロー");
  } finally {
    await context.close();
  }
}
