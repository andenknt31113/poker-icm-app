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
    await page.waitForFunction(() => document.getElementById("nash-sb-stats")?.textContent.length > 0);
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
    await page.waitForSelector("#nash-context", { state: "visible" });
    await page.waitForFunction(() => document.getElementById("nash-sb-stats")?.textContent.length > 0);
    // HU 例題は自分=BB・相手=BTN。BTN が先に動くので相手が押し、自分が受ける
    if (!(await page.locator("#nash-context").textContent()).includes("自分：コール")) throw new Error("Nashの役割が不明");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#nash-context").scrollIntoViewIfNeeded();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Nash画面が横にはみ出した");
    if (process.env.QA_SCREENSHOT_DIR) await page.screenshot({ path: process.env.QA_SCREENSHOT_DIR + "/nash.png" });
    assertNoErrors(errors, "Nash条件変更と再計算");
  } finally {
    await context.close();
  }
}
