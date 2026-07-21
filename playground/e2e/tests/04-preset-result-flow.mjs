// 4. プリセット (ftBubble) → 計算結果タブ → BF マトリクス + 必要勝率フローの描画
//
// 「🃏 このハンド、コールできる？」パネルは製品判断で廃止したため、
// 計算結果タブの中核である BF マトリクス (#bf-matrix) と
// 必要勝率フロー ($EV 表示を含む #eq-result) が描画されることを検証する。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testPresetResultFlow({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "preset-result-flow");

    await page.goto(baseURL, { waitUntil: "load" });

    await page.click('.scenario-btn[data-scenario="ftBubble"]');
    await page.click('.tab-btn[data-tab="result"]');

    // BF マトリクス: ftBubble は 4 人なので 4x4 のデータセル (対角以外 12 個) が並ぶ
    await page.waitForSelector("#bf-matrix .bf-cell", { state: "visible" });
    const cellCount = await page.$$eval("#bf-matrix .bf-cell", (els) => els.length);
    if (cellCount < 12) {
      throw new Error(`BF マトリクスのセル数が少なすぎます: ${cellCount} (期待: 4人で12)`);
    }

    // 必要勝率フロー: $EV (True Req) の値が % 表示される
    await page.waitForSelector("#eq-result .eq-flow-final", { state: "visible" });
    const evText = await page.textContent("#eq-result .eq-flow-final");
    if (!evText || !/%/.test(evText)) {
      throw new Error(`$EV (True Req) の表示が想定と異なります: "${evText}"`);
    }

    // 廃止済みのハンド別判定パネルが DOM に残っていないこと
    const hvLeftover = await page.$("#hv-grid");
    if (hvLeftover) throw new Error("廃止済みの #hv-grid が DOM に残っている");

    assertNoErrors(errors, "プリセット→計算結果 (BFマトリクス+必要勝率) のフロー");
  } finally {
    await context.close();
  }
}
