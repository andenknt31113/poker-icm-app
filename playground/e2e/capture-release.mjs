import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadPlaywright } from "./lib/pw.mjs";
import { startPreviewServer } from "./lib/server.mjs";
import { attachErrorCollector, assertNoErrors } from "./lib/context.mjs";

const OUTPUT = process.argv[2];
if (!OUTPUT) throw new Error("スクリーンショットの出力先を指定してください");
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
      await context.addInitScript(() => {
        localStorage.setItem("poker-icm-onboarding-done", "1");
        localStorage.setItem("poker-icm-tutorial-done", "1");
      });
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
      await capture("01-setup", "#setup-players");
      await capture("02-seats", "#players-list");
      await page.locator('.tab-btn[data-tab="analyze"]').click();
      await capture("03-analysis", "#hero-summary");
      await page.locator('[data-jump="sec-icm"]').click();
      await capture("04-prizes", "#sec-icm");
      await page.locator('[data-jump="sec-nash"]').click();
      await page.waitForFunction(() => document.getElementById("nash-sb-stats")?.textContent.length > 0);
      await capture("05-nash", "#nash-context");
      await page.locator('.tab-btn[data-tab="practice"]').click();
      await capture("06-practice", ".practice-actions-top");
      assertNoErrors(errors, device.name);
      console.log(`${device.name}: 6枚作成、横はみ出し・JavaScriptエラーなし`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); server.stop(); }
