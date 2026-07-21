// 8. 言語切替: 既定 ja → EN トグル → 代表文言が英語 → ja へ戻すと日本語復帰。
//
// ヘッダーの言語トグルは setLang + location.reload() 方式なので、クリック後は
// ページ再読み込みの完了を待ってから文言を検証する。localStorage は各テストで
// 新しい BrowserContext を使うため空 (= 既定 ja) から始まる。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

async function textOf(page, sel) {
  return (await page.$eval(sel, (el) => el.innerText)).trim();
}

export default async function testLangSwitch({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true, pro: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "lang-switch");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.waitForSelector(".tab-btn", { state: "visible" });

    // --- 既定は ja ---
    const practiceTabJa = await textOf(page, '.tab-btn[data-tab="practice"] .tab-label');
    if (practiceTabJa !== "練習") {
      throw new Error(`既定言語が ja ではない: practice タブ = "${practiceTabJa}"`);
    }
    const toggleJa = await textOf(page, "#lang-toggle");
    if (toggleJa !== "EN") throw new Error(`ja 時のトグル表示が "EN" でない: "${toggleJa}"`);
    if ((await page.getAttribute("html", "lang")) !== "ja") {
      throw new Error("ja 時に <html lang> が ja でない");
    }

    // --- EN へ切替 (reload を待つ) ---
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.click("#lang-toggle"),
    ]);
    await page.waitForSelector(".tab-btn", { state: "visible" });

    // 代表文言が英語であることを 4 箇所以上で確認
    const checks = [
      ['.tab-btn[data-tab="practice"] .tab-label', "Practice"],
      ['.tab-btn[data-tab="setup"] .tab-label', "Setup"],
      ['.tab-btn[data-tab="nash"] .tab-label', "Nash"],
    ];
    for (const [sel, expected] of checks) {
      const actual = await textOf(page, sel);
      if (actual !== expected) throw new Error(`EN 切替後 ${sel} = "${actual}" (expected "${expected}")`);
    }
    // 練習タブのモードセグメント (練習ボタン) が英語
    await page.click('.tab-btn[data-tab="practice"]');
    await page.waitForSelector(".card[data-tab=\"practice\"] .mode-btn", { state: "visible" });
    const modeBtn = await textOf(page, '.mode-btn[data-mode="callfold"]');
    if (!modeBtn.includes("Call decision")) {
      throw new Error(`練習モードボタンが英語でない: "${modeBtn}"`);
    }
    const newHandBtn = await textOf(page, "#practice-new-btn");
    if (!newHandBtn.includes("New hand")) {
      throw new Error(`「新しい問題」ボタンが英語でない: "${newHandBtn}"`);
    }
    const toggleEn = await textOf(page, "#lang-toggle");
    if (toggleEn !== "日本語") throw new Error(`EN 時のトグル表示が "日本語" でない: "${toggleEn}"`);
    if ((await page.getAttribute("html", "lang")) !== "en") {
      throw new Error("EN 時に <html lang> が en でない");
    }

    // --- ja へ戻す ---
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.click("#lang-toggle"),
    ]);
    await page.waitForSelector(".tab-btn", { state: "visible" });
    const backJa = await textOf(page, '.tab-btn[data-tab="practice"] .tab-label');
    if (backJa !== "練習") throw new Error(`ja へ戻したのに練習タブ = "${backJa}"`);

    assertNoErrors(errors, "言語切替フロー");
  } finally {
    await context.close();
  }
}
