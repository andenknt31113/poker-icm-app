#!/usr/bin/env node
// 日本語不変性検証用スナップショット取得スクリプト。
// Math.random を決定的な LCG に差し替えることで、練習問題などの乱数依存画面も
// 再現可能にし、各画面の innerText を JSON に書き出す。
// origin/main と feature ブランチの両ビルドで実行し、出力を完全一致比較する。
import { writeFileSync } from "node:fs";
import { loadPlaywright } from "./lib/pw.mjs";
import { ensureBuilt, startPreviewServer } from "./lib/server.mjs";

const OUT = process.argv[2];
if (!OUT) {
  console.error("usage: node e2e/snapshot.mjs <out.json>");
  process.exit(1);
}

// ページ読み込み前に仕込む初期化スクリプト:
//  - Math.random を seed 固定の LCG に差し替え (練習問題の乱数を決定化)
//  - オンボーディング/チュートリアル done フラグはテスト側で個別に制御
const SEED_SCRIPT = () => {
  let s = 0x12345678 >>> 0;
  Math.random = () => {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 0x100000000;
  };
};

async function newPage(browser, { onboardingDone = true, tutorialDone = true } = {}) {
  const context = await browser.newContext();
  await context.addInitScript(SEED_SCRIPT);
  await context.addInitScript(
    ({ onboardingDone, tutorialDone }) => {
      try {
        if (onboardingDone) localStorage.setItem("poker-icm-onboarding-done", "1");
        if (tutorialDone) localStorage.setItem("poker-icm-tutorial-done", "1");
        // 決定的にするため難易度/モードも固定
        localStorage.setItem("poker-icm-practice-diff", "normal");
        localStorage.setItem("poker-icm-practice-mode", "callfold");
        localStorage.setItem("poker-icm-theme", "dark");
      } catch { /* ignore */ }
    },
    { onboardingDone, tutorialDone },
  );
  const page = await context.newPage();
  return { context, page };
}

async function bodyText(page) {
  return await page.evaluate(() => document.body.innerText);
}

async function main() {
  const { chromium } = loadPlaywright();
  ensureBuilt();
  const server = await startPreviewServer();
  const browser = await chromium.launch();
  const snap = {};

  try {
    // ===== 5タブ (決定的) =====
    {
      const { context, page } = await newPage(browser);
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);
      for (const tab of ["setup", "result", "hand", "nash"]) {
        await page.click(`.tab-btn[data-tab="${tab}"]`);
        await page.waitForTimeout(150);
        snap[`tab:${tab}`] = await bodyText(page);
      }
      // innerHTML も取得 (textContent では検出できない <strong> 等マークアップの欠落を検出する)
      snap["html:container"] = await page.evaluate(() => document.querySelector("main.container").innerHTML);
      // Nash 計算実行後
      await page.click(`.tab-btn[data-tab="nash"]`);
      await page.click("#nash-solve");
      await page.waitForTimeout(400);
      snap["nash:solved"] = await bodyText(page);
      await context.close();
    }

    // ===== 用語解説モーダル (INFO_TEXTS: ICM / BF / 必要勝率 / RP) =====
    {
      const { context, page } = await newPage(browser);
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);
      for (const key of ["ICM", "BF", "必要勝率", "RP"]) {
        await page.click(`#hero-summary [data-info="${key}"]`);
        await page.waitForTimeout(100);
        snap[`info:${key}:title`] = await page.evaluate(() => document.getElementById("info-modal-title").textContent);
        snap[`info:${key}:body`] = await page.evaluate(() => document.getElementById("info-modal-body").innerHTML);
        await page.click("#info-modal-close");
        await page.waitForTimeout(60);
      }
      await context.close();
    }

    // ===== ガイドモーダル =====
    {
      const { context, page } = await newPage(browser);
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.waitForTimeout(150);
      await page.click("#help-btn");
      await page.waitForTimeout(150);
      snap["guide-modal"] = await page.evaluate(() => document.getElementById("guide-modal").innerText);
      snap["guide-modal:html"] = await page.evaluate(() => document.getElementById("guide-modal").innerHTML);
      await context.close();
    }

    // ===== オンボーディングモーダル (3ステップ) =====
    {
      const { context, page } = await newPage(browser, { onboardingDone: false });
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);
      snap["onboarding:step1"] = await page.evaluate(() => document.getElementById("onboarding-modal").innerText);
      await page.click("#onboarding-next-btn");
      await page.waitForTimeout(120);
      snap["onboarding:step2"] = await page.evaluate(() => document.getElementById("onboarding-modal").innerText);
      await page.click("#onboarding-next-btn");
      await page.waitForTimeout(120);
      snap["onboarding:step3"] = await page.evaluate(() => document.getElementById("onboarding-modal").innerText);
      await context.close();
    }

    // ===== 練習 3モード: 決定的問題 + 回答フィードバック =====
    for (const mode of ["callfold", "rp", "push"]) {
      const { context, page } = await newPage(browser);
      await page.addInitScript((m) => {
        try { localStorage.setItem("poker-icm-practice-mode", m); } catch { /* ignore */ }
      }, mode);
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.click(`.tab-btn[data-tab="practice"]`);
      await page.waitForTimeout(300);
      snap[`practice:${mode}:problem`] = await page.evaluate(() => document.getElementById("practice-area").innerText);
      // 回答する
      if (mode === "callfold") {
        await page.click('.practice-btn[data-answer="call"]');
      } else if (mode === "push") {
        await page.click('.practice-btn[data-answer="push"]');
      } else {
        // rp: normal はスライダー → 回答するボタン
        await page.click("#rp-answer-btn");
      }
      await page.waitForTimeout(300);
      snap[`practice:${mode}:feedback`] = await page.evaluate(() => document.getElementById("practice-feedback").innerText);
      await context.close();
    }

    // ===== 導入コース =====
    {
      const { context, page } = await newPage(browser, { tutorialDone: false });
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.click(`.tab-btn[data-tab="practice"]`);
      await page.waitForTimeout(250);
      snap["tutorial:intro"] = await page.evaluate(() => document.getElementById("practice-area").innerText);
      await page.click("#tutorial-intro-start-btn");
      await page.waitForTimeout(200);
      snap["tutorial:narration1"] = await page.evaluate(() => document.getElementById("practice-area").innerText);
      await context.close();
    }
  } finally {
    await browser.close().catch(() => {});
    server.stop();
  }

  // footer の build SHA・dist アセットのハッシュはビルドごとに変わるため正規化
  for (const k of Object.keys(snap)) {
    snap[k] = snap[k]
      .replace(/build [0-9a-f]+/g, "build <SHA>")
      .replace(/build dev/g, "build <SHA>")
      .replace(/index-[0-9A-Za-z_-]+\.(js|css)/g, "index-<HASH>.$1")
      .replace(/-[0-9A-Za-z_-]{8}\.woff2?/g, "-<HASH>.woff");
  }
  writeFileSync(OUT, JSON.stringify(snap, null, 2));
  console.log(`[snapshot] wrote ${OUT} (${Object.keys(snap).length} screens)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => setImmediate(() => process.exit(process.exitCode ?? 0)));
