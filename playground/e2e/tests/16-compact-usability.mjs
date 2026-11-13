import { mkdir } from "node:fs/promises";
import path from "node:path";
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testCompactUsability({ baseURL, createContext }) {
  const context = await createContext({ presetsOpen: false });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "compact-usability");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseURL, { waitUntil: "load" });
    if (await page.locator("#scenario-presets-toggle").evaluate(element => element.open)) throw new Error("初回から例題が画面を占有する");
    if (await page.locator(".workspace-intro, .workspace-starts, .workspace-steps").count()) throw new Error("不要な案内が残る");
    if (await page.locator(".player-stack").first().evaluate(element => element.getBoundingClientRect().top) > 500) throw new Error("入力欄が初期画面にない");
    const originalStacks = await page.locator(".player-stack").evaluateAll(elements => elements.map(element => element.value));
    const roleRows = () => page.locator(".player-row").evaluateAll(elements => elements.map(element => element.className));
    const originalRoles = await roleRows();
    await page.locator("#swap-players").click();
    if (!(await page.locator(".player-row").first().getAttribute("class")).includes("villain")) throw new Error("自分と相手を交換できない");
    if ((await page.locator(".player-stack").evaluateAll(elements => elements.map(element => element.value))).join() !== originalStacks.join()) throw new Error("交換でスタックが変わる");
    await page.locator("#setup-undo").click();
    if ((await roleRows()).join() !== originalRoles.join()) throw new Error("交換を取り消せない");
    await page.locator(".player-row").nth(1).locator('[data-role="hero"]').click();
    if (await page.locator(".role-btn.hero.active").count() !== 1 || await page.locator(".role-btn.villain.active").count() !== 1) throw new Error("役割変更で相手を失う");
    await page.locator("#setup-undo").click();
    await page.locator("#add-player").click();
    await page.locator(".player-row").nth(2).locator(".player-remove").click();
    const positions = await page.locator(".player-pos").evaluateAll(elements => elements.map(element => element.value));
    if (positions.join() !== "BB,SB,BTN") throw new Error("人数変更後に無効なポジションが残る");

    await page.locator('.tab-btn[data-tab="analyze"]').click();
    if (!(await page.locator(".hero-summary-row").first().textContent()).includes("BB")) throw new Error("スタック表示を失う");
    if (await page.locator(".hero-summary-stat-label, .hero-summary-prize-note").count()) throw new Error("削除した賞金取り分が戻る");
    if (await page.locator("#villain-range-details").evaluate(element => element.open)) throw new Error("結果より相手表が先に開く");
    await page.locator('#grid-hero .hand-cell[title="AKs"]').click();
    if (!(await page.locator("#hand-cell-detail").textContent()).includes("AKs")) throw new Error("ハンドの結果を見られない");
    await page.locator('.mode-tab[data-mode="custom"]').click();
    if (!(await page.locator("#villain-range-details").evaluate(element => element.open))) throw new Error("カスタム編集で相手表が開かない");
    await page.locator("#custom-clear").click();
    if (!(await page.locator("#range-unavailable").isVisible()) || await page.locator("#grid-hero").isVisible()) throw new Error("空レンジに判定を出す");
    if (await page.locator("#hero-summary-verdict-btn").count()) throw new Error("空レンジのコール可能率を表示する");
    await page.locator("#custom-from-preset").click();
    if (await page.locator("#range-unavailable").isVisible() || !(await page.locator("#grid-hero").isVisible())) throw new Error("レンジ復元で結果が戻らない");
    await page.locator('.mode-tab[data-mode="preset"]').click();

    await page.locator('.tab-btn[data-tab="analyze"]').click();
    await page.locator(".player-row.hero").locator('[data-role="other"]').click();
    await page.locator('.tab-btn[data-tab="analyze"]').click();
    if (!(await page.locator("#range-unavailable").isVisible()) || await page.locator("#range-content").isVisible()) throw new Error("自分未指定でも判定が残る");
    await page.locator('.tab-btn[data-tab="analyze"]').click();
    await page.locator("#setup-undo").click();
    await page.locator(".player-row.hero .player-stack").fill("0");
    await page.locator('.tab-btn[data-tab="analyze"]').click();
    if (!(await page.locator("#range-unavailable").isVisible()) || await page.locator("#range-content").isVisible()) throw new Error("自分0BBでも判定が残る");
    await page.locator('.tab-btn[data-tab="analyze"]').click();
    await page.locator("#setup-undo").click();

    await page.locator('.tab-btn[data-tab="analyze"]').click();
    if (!(await page.locator("#payouts-fold").evaluate(element => element.open))) await page.locator("#payouts-fold > summary").click();
    for (const input of await page.locator(".payout-amount").all()) await input.fill("0");
    await page.locator('.tab-btn[data-tab="analyze"]').click();
    if (!(await page.locator("#range-unavailable").isVisible()) || await page.locator("#range-content").isVisible()) throw new Error("不正な賞金でも前の結果を表示する");
    await page.locator('.tab-btn[data-tab="analyze"]').click();
    await page.locator(".payout-amount").first().fill("100");
    await page.locator('.tab-btn[data-tab="analyze"]').click();
    if (await page.locator("#range-unavailable").isVisible()) throw new Error("賞金修正で分析が戻らない");

    await page.locator('.tab-btn[data-tab="analyze"]').click();
    await page.locator('#scenario-presets-toggle > summary').click();
    await page.locator('.scenario-btn[data-scenario="ft6"]').click();
    if (!(await page.locator("#players-lock-notice").isVisible())) throw new Error("編集ロックの理由がない");
    await page.locator(".player-remove").first().click();
    await page.locator(".player-remove").first().click();
    if (await page.locator("#players-lock-notice").isVisible() || await page.locator(".player-stack").first().getAttribute("readonly") !== null) throw new Error("4人に減らしても編集できない");
    await page.locator('.scenario-btn[data-scenario="ftBubble"]').click();
    await page.locator('#scenario-presets-toggle > summary').click();

    const screenshotDirectory = process.env.QA_SCREENSHOT_DIR;
    if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('.tab-btn[data-tab="analyze"]').click();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`${width}px入力の横はみ出し`);
      if (await page.locator(".player-row").first().evaluate(element => element.getBoundingClientRect().height) > 85) throw new Error(`${width}pxの席が大きすぎる`);
      if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, `setup-${width}.png`) });
      await page.locator('.tab-btn[data-tab="analyze"]').click();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`${width}px分析の横はみ出し`);
      if (screenshotDirectory && width === 390) await page.screenshot({ path: path.join(screenshotDirectory, "analysis-390.png"), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-jump="sec-nash"]').click();
    await page.waitForFunction(() => document.querySelectorAll("#nash-table .nash-row").length > 0 && document.getElementById("nash-table-status")?.textContent === "");
    const heroRow = () => page.locator("#nash-table .nash-row", { has: page.locator(".icm-role.hero") }).first().locator(".nash-row-label").textContent();
    const heroBefore = await heroRow();
    if (!heroBefore) throw new Error("Nashの一覧に自分の行がない");
    await page.locator("#swap-players").click();
    await page.waitForFunction(() => document.querySelectorAll("#nash-table .nash-row").length > 0 && document.getElementById("nash-table-status")?.textContent === "");
    if ((await heroRow()) === heroBefore) throw new Error("役割を交換しても Nash の一覧の印が変わらない");
    if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, "nash-390.png"), fullPage: true });
    await page.locator("#lang-toggle").click();
    await page.waitForFunction(() => document.documentElement.lang === "en");
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("英語の横はみ出し");
    assertNoErrors(errors, "コンパクト入力と分析");
  } finally {
    await context.close();
  }
}
