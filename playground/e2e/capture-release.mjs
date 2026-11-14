import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadPlaywright } from "./lib/pw.mjs";
import { startPreviewServer } from "./lib/server.mjs";
import { attachErrorCollector, assertNoErrors } from "./lib/context.mjs";

const OUTPUT = process.argv[2];
if (!OUTPUT) throw new Error("スクリーンショットの出力先を指定してください");
// 表示言語 ("ja" / "en")。省略時はアプリの既定 (日本語)。例: node capture-release.mjs out en
const CAPTURE_LANG = process.argv[3] ?? "";
const DEVICES = [
  { name: "iphone-6.9", viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 },
  { name: "ipad-13", viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2 },
];
const { chromium } = loadPlaywright();
const server = await startPreviewServer();
const browser = await chromium.launch(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {});
try {
  for (const device of DEVICES) {
    const folder = path.join(OUTPUT, device.name);
    await mkdir(folder, { recursive: true });
    const context = await browser.newContext({ viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor });
    try {
      await context.addInitScript((lang) => {
        localStorage.setItem("poker-icm-onboarding-done", "1");
        localStorage.setItem("poker-icm-tutorial-done", "1");
        if (lang) localStorage.setItem("poker-icm-lang", lang);
      }, CAPTURE_LANG);
      const page = await context.newPage();
      const errors = attachErrorCollector(page, device.name);
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.locator('#scenario-presets-toggle > summary').click();
      await page.locator('.scenario-btn[data-scenario="ftBubble"]').click();
      await page.locator('#scenario-presets-toggle > summary').click();
      const capture = async (name, selector) => {
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(selector => {
          if (selector === "#hero-summary") window.scrollTo({ top: 0, behavior: "instant" });
          else document.querySelector(selector)?.scrollIntoView({ block: "start", behavior: "instant" });
        }, selector);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForFunction(() => !document.getAnimations().some(animation => animation.playState === "running"));
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`${name}: 横はみ出し`);
        await page.screenshot({ path: path.join(folder, `${name}.png`), animations: "disabled" });
      };
      // 1 画面構成 (局面 + 結果カード → レンジ → 賞金・BF → チョップ → Nash)。練習タブは非表示なので撮らない
      await capture("01-spot", "#hero-summary");
      await capture("02-players", "#setup-players");
      await page.locator('[data-jump="sec-hand"]').click();
      await capture("03-range", "#sec-hand");
      await page.locator('[data-jump="sec-icm"]').click();
      await capture("04-prizes", "#sec-icm");
      await capture("05-chop", "#sec-chop");
      await page.locator('[data-jump="sec-nash"]').click();
      await page.waitForFunction(() => document.querySelectorAll("#nash-table .nash-row").length > 0 && document.getElementById("nash-table-status")?.textContent === "", null, { timeout: 60000 });
      await capture("06-nash", "#sec-nash");
      assertNoErrors(errors, device.name);
      console.log(`${device.name}: 6枚作成、横はみ出し・JavaScriptエラーなし`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); server.stop(); }
