// 17. 既定では練習を出さない: タブバーごと隠れ、計算 1 画面だけになる。
//     練習の機能自体は残っていて、保存値が「練習タブ」でも計算で開く。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testPracticeHidden({ baseURL, createContext }) {
  const context = await createContext({ practice: false, onboardingDone: false });
  try {
    await context.addInitScript(() => {
      try {
        localStorage.setItem("poker-icm-active-tab", "practice");
      } catch {
        /* ignore */
      }
    });
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "practice-hidden");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseURL, { waitUntil: "load" });

    // 初回案内に練習の記述・ボタンが見えない
    await page.waitForSelector("#onboarding-next-btn", { state: "visible" });
    if (await page.locator('[data-feature="practice"]:visible').count()) throw new Error("初回案内に練習の記述が見えている");
    await page.locator("#onboarding-next-btn").click();
    if (await page.locator("#onboarding-cta-practice").isVisible()) throw new Error("初回案内に「練習を始める」が見えている");
    await page.locator("#onboarding-cta-setup").click();

    if (await page.locator(".tab-bar").isVisible()) throw new Error("タブバーが見えている");
    if (await page.locator('section[data-tab="practice"]').isVisible()) throw new Error("練習の画面が見えている");
    if ((await page.locator("body").getAttribute("data-active-tab")) !== "analyze") throw new Error("保存値が練習のとき計算で開かない");
    if (!(await page.locator("#players-list .player-stack").first().isVisible())) throw new Error("局面の入力が見えない");
    if (!(await page.locator("#hero-summary").isVisible())) throw new Error("結果カードが見えない");

    // ヘルプにも練習の節が見えない
    await page.locator("#help-btn").click();
    await page.waitForSelector("#guide-modal:not(.hidden)");
    if (await page.locator('#guide-modal [data-feature="practice"]:visible').count()) throw new Error("ヘルプに練習の節が見えている");

    assertNoErrors(errors, "練習を非表示にした既定の画面");
  } finally {
    await context.close();
  }
}
