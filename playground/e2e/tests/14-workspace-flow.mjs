import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

export default async function testWorkspaceFlow({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: false });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "workspace-flow");
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(baseURL, { waitUntil: "load" });
    if (await page.locator(".workspace-starts, .workspace-steps").count()) throw new Error("不要な案内カードが残っています");
    if (!(await page.locator("#scenario-presets-toggle").evaluate(element => element.open))) await page.locator('#scenario-presets-toggle > summary').click();
    if (!(await page.locator("#scenario-presets-toggle").evaluate(element => element.open))) throw new Error("例題一覧が開きません");
    if (await page.locator("#hero-summary").isVisible()) throw new Error("入力画面に分析サマリーが表示されています");
    await page.locator('.scenario-btn[data-scenario="ftBubble"]').click();
    await page.locator('[data-open-tab="analyze"]').click();
    if (await page.locator('#quick-hand, #hand-rank-first, #hand-rank-second, #hand-suited').count()) throw new Error("不要な手札選択欄が残っています");
    await page.locator('#grid-hero .hand-cell[title="AKs"]').click();
    await page.waitForFunction(() => document.getElementById("hand-cell-detail")?.textContent.includes("AKs"));
    await page.locator('[data-jump="sec-icm"]').click();
    if (!(await page.locator("#sec-icm").isVisible()) || await page.locator("#sec-hand").isVisible()) throw new Error("目的別表示が切り替わりません");
    await page.locator("#hero-summary-verdict-btn").click();
    await page.waitForSelector("#sec-hand", { state: "visible" });
    await page.locator('[data-jump="sec-nash"]').click();
    if (await page.locator("#hero-summary").isVisible()) throw new Error("Nashに別条件のサマリーが表示されています");
    if (!(await page.locator("#sec-nash .analysis-assumptions").isVisible())) throw new Error("Nashの前提がありません");
    await page.locator('[data-jump="sec-hand"]').click();
    if (!(await page.locator("#hand-cell-detail").textContent()).includes("AKs")) throw new Error("画面切替で選択が失われました");
    await page.locator('.direction-tab[data-direction="pushBack"]').click();
    if (await page.locator("#hand-cell-detail").isVisible()) throw new Error("pushモードにコール専用の詳細が残っています");
    await page.locator('.direction-tab[data-direction="callBack"]').click();
    await page.locator('[data-i18n="workspace.edit"]').click();
    await page.locator('.tab-bar [data-tab="practice"]').click();
    await page.locator("#tutorial-intro-start-btn").click();
    await page.locator("#tutorial-start-problem-btn").click();
    await page.waitForFunction(() => {
      const button = document.querySelector('.practice-btn[data-answer="call"]');
      const nav = document.querySelector(".tab-bar");
      return button && nav && button.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top;
    });
    if (await page.locator(".practice-player-strip .practice-seat").count() !== 3) throw new Error("全員のスタックがありません");
    await page.locator('.practice-btn[data-answer="call"]').click();
    await page.waitForSelector("#tutorial-next-btn", { state: "visible" });
    for (const viewport of [MOBILE_VIEWPORT, DESKTOP_VIEWPORT]) {
      await page.setViewportSize(viewport);
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("横はみ出しがあります");
    }
    await page.reload({ waitUntil: "load" });
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (background === "rgba(0, 0, 0, 0)" || background === "rgb(255, 255, 255)") throw new Error("再読み込み後にスタイルが適用されていません");
    assertNoErrors(errors, "新しい入力・手札・練習の導線");
  } finally {
    await context.close();
  }
}
