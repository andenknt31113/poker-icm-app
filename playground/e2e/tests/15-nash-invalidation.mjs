import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testNashInvalidation({ baseURL, createContext }) {
  const context = await createContext();
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "nash-invalidation");
    await page.goto(baseURL, { waitUntil: "load" });
    await page.click('.scenario-btn[data-scenario="hu"]');
    await page.click('.tab-btn[data-tab="analyze"]');
    await page.click('[data-jump="sec-nash"]');
    await page.waitForFunction(() => document.querySelectorAll("#nash-table .nash-row").length > 0 && document.getElementById("nash-table-status")?.textContent === "");
    // 行をタップすると 13x13 の表が開き、もう一度で閉じる
    await page.locator("#nash-table .nash-row.push").first().click();
    if (await page.locator("#nash-table .nash-row-grid .hand-cell").count() !== 169) throw new Error("行をタップしても表が開かない");
    if (!(await page.locator("#nash-table .nash-row-grid .in-range-villain").count())) throw new Error("押すレンジが表に塗られていない");
    await page.locator("#nash-table .nash-row.push").first().click();
    if (await page.locator("#nash-table .nash-row-grid").count()) throw new Error("もう一度タップしても表が閉じない");
    const before = await page.locator("#nash-table").textContent();
    if (await page.locator(".nash-explanation").evaluate(element => element.open)) throw new Error("詳細説明が初期表示で開いている");
    await page.locator(".nash-explanation summary").click();
    if (!(await page.locator(".nash-explanation").evaluate(element => element.open))) throw new Error("計算前提を開けない");
    await page.locator(".nash-explanation summary").click();
    await page.locator('#sec-nash [data-scroll-spot]').click();
    await page.waitForFunction(() => document.getElementById("setup-players").getBoundingClientRect().top < window.innerHeight / 2);
    if (!(await page.locator("#blinds-fold").evaluate(element => element.open))) await page.locator("#blinds-fold > summary").click();
    await page.locator("#nash-ante").fill("1");
    await page.click('.tab-btn[data-tab="analyze"]');
    await page.click('[data-jump="sec-nash"]');
    await page.waitForSelector("#nash-table", { state: "visible" });
    await page.waitForFunction(() => document.querySelectorAll("#nash-table .nash-row").length > 0 && document.getElementById("nash-table-status")?.textContent === "");
    // アンティを変えたので、同じ表のままではない (旧結果を残さない)
    if ((await page.locator("#nash-table").textContent()) === before) throw new Error("条件を変えても Nash の表が変わらない");
    // HU 例題は自分=BB・相手=BTN。BTN が先に動くので BTN が押し、BB (自分) が受ける
    const rows = await page.locator("#nash-table .nash-row .nash-row-label").allTextContents();
    if (rows.length !== 2 || !rows[0].includes("BTN") || !rows[1].includes("BB") || !rows[1].includes("自分")) throw new Error(`Nashの役割が不明: ${rows.join(" / ")}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#nash-table").scrollIntoViewIfNeeded();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Nash画面が横にはみ出した");
    if (process.env.QA_SCREENSHOT_DIR) await page.screenshot({ path: process.env.QA_SCREENSHOT_DIR + "/nash.png" });
    assertNoErrors(errors, "Nash条件変更と再計算");
  } finally {
    await context.close();
  }
}
