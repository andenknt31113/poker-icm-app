// 18. バウンティ (KO / PKO): Pro 限定の入力と、必要勝率への反映。
//   - 無料: KO / PKO を選ぶとペイウォールが出て、設定は変わらない
//   - Pro: 額を入れると、相手を飛ばせる局面の必要勝率が下がる。再読み込みしても残る。
//          「なし」に戻すと元の数字に戻る
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

const requiredEquity = (page) =>
  page.$eval("#eq-result .eq-flow-final .eq-flow-value", (el) => Number.parseFloat(el.textContent));
const activeMode = (page) =>
  page.$eval('[data-bounty-mode][aria-pressed="true"]', (el) => el.dataset.bountyMode);

export default async function testBounty({ baseURL, createContext }) {
  // ----- 無料 -----
  const freeContext = await createContext({ practice: false });
  try {
    const page = await freeContext.newPage();
    const errors = attachErrorCollector(page, "bounty-free");
    await page.goto(baseURL, { waitUntil: "load" });
    await page.waitForSelector("#players-list .player-row", { state: "visible" });

    const summary = await page.$eval("#bounty-summary", (el) => el.textContent);
    if (!summary.includes("Pro")) throw new Error(`無料なのにバウンティ行に Pro の印がない: "${summary}"`);
    const before = await requiredEquity(page);

    await page.click("#bounty-fold > summary");
    await page.click('[data-bounty-mode="ko"]');
    await page.waitForSelector("#paywall-modal:not(.hidden)", { state: "visible" });
    const paywallText = await page.$eval("#paywall-modal", (el) => el.textContent);
    if (!paywallText.includes("バウンティ")) throw new Error("ペイウォールにバウンティの記載がない");
    await page.click("#paywall-close");
    if ((await activeMode(page)) !== "off") throw new Error("無料なのにバウンティの形式が変わった");
    if (await page.$eval("#bounty-inputs", (el) => !el.hidden)) throw new Error("無料なのに額の入力が出ている");
    if ((await requiredEquity(page)) !== before) throw new Error("無料なのに必要勝率が変わった");
    assertNoErrors(errors, "バウンティ (無料)");
  } finally {
    await freeContext.close();
  }

  // ----- Pro -----
  const proContext = await createContext({ pro: true, practice: false });
  try {
    const page = await proContext.newPage();
    const errors = attachErrorCollector(page, "bounty-pro");
    await page.goto(baseURL, { waitUntil: "load" });
    await page.waitForSelector("#players-list .player-row", { state: "visible" });

    // 既定の卓: 自分 BB 18 / 相手 SB 14 / BTN 20。自分が相手を飛ばせる
    const plain = await requiredEquity(page);
    await page.click("#bounty-fold > summary");
    await page.click('[data-bounty-mode="ko"]');
    await page.waitForSelector("#bounty-inputs:not([hidden])");
    if ((await page.$$eval("#bounty-list .bounty-amount", (els) => els.length)) !== 3) {
      throw new Error("バウンティの入力行が人数ぶん出ていない");
    }
    // 額が空のうちは計算は変わらない
    if ((await requiredEquity(page)) !== plain) throw new Error("額を入れる前に必要勝率が変わった");

    await page.fill("#bounty-all", "10");
    await page.click("#bounty-all-apply");
    const ko = await requiredEquity(page);
    if (!(ko < plain)) throw new Error(`KO を入れても必要勝率が下がらない: ${plain} → ${ko}`);
    if (!(await page.$("#eq-result .eq-bounty-note"))) throw new Error("バウンティ込みの注記が出ていない");
    const summary = await page.$eval("#bounty-summary", (el) => el.textContent);
    if (summary !== "KO · 10 / 10 / 10") throw new Error(`バウンティ行の要約が違う: "${summary}"`);

    // PKO はその場の現金が半分なので、KO ほどは下がらない
    await page.click('[data-bounty-mode="pko"]');
    const pko = await requiredEquity(page);
    if (!(pko > ko && pko < plain)) throw new Error(`PKO の必要勝率が KO となしの間にない: ${ko} / ${pko} / ${plain}`);

    // 1 人ぶんだけ書き換えられる (相手の首を大きくすると、さらに下がる)
    const villainInput = page.locator("#bounty-list .bounty-row", { hasText: "SB" }).locator(".bounty-amount");
    await villainInput.fill("30");
    const bigHead = await requiredEquity(page);
    if (!(bigHead < pko)) throw new Error(`相手の首を大きくしても必要勝率が下がらない: ${pko} → ${bigHead}`);

    // 再読み込みしても、形式と額が残る
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#players-list .player-row", { state: "visible" });
    if ((await activeMode(page)) !== "pko") throw new Error("再読み込みで形式が消えた");
    if ((await requiredEquity(page)) !== bigHead) throw new Error("再読み込みで必要勝率が変わった");

    // 「なし」に戻すと、元の数字に戻る
    await page.click("#bounty-fold > summary");
    await page.click('[data-bounty-mode="off"]');
    if ((await requiredEquity(page)) !== plain) throw new Error("「なし」に戻しても必要勝率が戻らない");
    if (await page.$("#eq-result .eq-bounty-note")) throw new Error("「なし」なのに注記が残っている");

    // 例題を選ぶと、バウンティは「なし」になる
    await page.click('[data-bounty-mode="ko"]');
    await page.click('.scenario-btn[data-scenario="ft4"]');
    if ((await activeMode(page)) !== "off") throw new Error("例題を選んでもバウンティが残っている");

    assertNoErrors(errors, "バウンティ (Pro)");
  } finally {
    await proContext.close();
  }
}
