#!/usr/bin/env node
// App Store 提出用スクリーンショット生成スクリプト。
//
// ビルド済み playground/dist を vite preview で配信し、Playwright で各画面を
// 決定的な状態にしてから撮る。ASC が要求する実ピクセルサイズは
// 「viewport × deviceScaleFactor」で作る (例: iPad 13" = 1032×1376 @2x = 2064×2752)。
//
//   node e2e/store-screenshots.mjs --device ipad13 --lang ja --out ../screenshots/ipad13-ja
//
// 撮る画面は docs/APP_STORE_LISTING.md §8 の構成案に対応:
//   01 練習 (call/fold) / 02 計算結果 / 03 全員vs全員BFマップ /
//   04 導入コース / 05 Nash 均衡 / 06 ペイウォール (IAP 審査情報用)
//
// 乱数は snapshot.mjs と同じ xorshift32 で固定するため、同じビルドなら
// 何度実行しても同一の画像が出る。
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { loadPlaywright } from "./lib/pw.mjs";
import { ensureBuilt, startPreviewServer, PLAYGROUND_ROOT } from "./lib/server.mjs";

// ===== デバイス定義 =====
// ASC の「ディスプレイタイプ」ごとの必須ピクセルサイズ。
// px = viewport * scale で、Retina 相当の描画を保ったまま実サイズを作る。
const DEVICES = {
  // iPad Pro 13" (M4) 縦 = 2064×2752。ユニバーサルアプリでは必須。
  ipad13: { viewport: { width: 1032, height: 1376 }, scale: 2, px: "2064×2752" },
  // iPhone 6.7" 縦 = 1290×2796 (既にアップロード済みの分と同条件)。
  iphone67: { viewport: { width: 430, height: 932 }, scale: 3, px: "1290×2796" },
};

// ===== ペイウォールの表示価格 =====
// 実機では RevenueCat の offering から product.priceString が入るが、ブラウザでは
// SDK を初期化できず "—" のままになる。審査用スクショで価格が欠けていると
// 何の課金か伝わらないため、ASC に登録済みの実価格をここで流し込む。
// ASC 側の価格を変えたらこの値も合わせること。
const STORE_PRICE = "¥3,480";

// ===== 撮影用の初期 localStorage =====
// 5人卓・実際に賞金が付くペイ構造にしておく (BF マップが意味のある値になる)。
const SCENARIO = {
  players: [
    { stack: 12, role: "hero", position: "BB" },
    { stack: 9, role: "villain", position: "SB" },
    { stack: 25, role: "other", position: "BTN" },
    { stack: 18, role: "other", position: "CO" },
    { stack: 6, role: "other", position: "UTG" },
  ],
  payouts: [50000, 30000, 20000, 12000, 8000],
  nash: { sb: 0.5, bb: 1.0, ante: 1.0, anteMode: "total" },
};

// snapshot.mjs と同じ seed 固定 LCG (練習問題の出題を決定化する)。
const SEED_SCRIPT = () => {
  let s = 0x12345678 >>> 0;
  Math.random = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 0x100000000;
  };
};

function parseArgs(argv) {
  const args = { device: "ipad13", lang: "ja", out: null };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const val = argv[i + 1];
    if (key in args && val) args[key] = val;
    else {
      console.error(`usage: node e2e/store-screenshots.mjs --device <${Object.keys(DEVICES).join("|")}> --lang <ja|en> --out <dir>`);
      process.exit(1);
    }
  }
  if (!DEVICES[args.device]) {
    console.error(`unknown device: ${args.device} (${Object.keys(DEVICES).join(" / ")})`);
    process.exit(1);
  }
  args.out = path.resolve(PLAYGROUND_ROOT, args.out ?? `../screenshots/${args.device}-${args.lang}`);
  return args;
}

/**
 * 撮影用コンテキストを作る。
 * @param opts.native window.Capacitor をネイティブ相当に固定するか
 *   (ペイウォールの「アップグレード」「購入を復元」ボタンはネイティブ判定時のみ描画される)
 */
async function newPage(browser, device, lang, opts = {}) {
  const { native = false, tutorialDone = true } = opts;
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.scale,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });
  await context.addInitScript(SEED_SCRIPT);
  if (native) {
    // ペイウォールは ensurePaywallModal() の時点で isCapacitorNative() を見て
    // ボタンを組み立てるため、ページ読み込み前に注入する必要がある。
    //
    // window.Capacitor を直接置くだけでは足りない: pwa.ts の
    // import("@capacitor/status-bar") 経由で @capacitor/core が読み込まれると、
    // core が window.Capacitor を自前の web シムで丸ごと上書きしてしまう。
    // core は window.webkit.messageHandlers.bridge の有無で iOS を判定するため、
    // 実機と同じその判定材料を置いて「上書き後も native」にする。
    await context.addInitScript(() => {
      window.webkit = { messageHandlers: { bridge: { postMessage: () => {} } } };
      window.Capacitor = { isNativePlatform: () => true };
    });
  }
  await context.addInitScript(
    ({ lang, scenario, tutorialDone }) => {
      try {
        localStorage.setItem("poker-icm-lang", lang);
        localStorage.setItem("poker-icm-onboarding-done", "1");
        localStorage.setItem("poker-icm-first-hint-dismissed", "1");
        localStorage.setItem("poker-icm-ios-install-hint", "1");
        if (tutorialDone) localStorage.setItem("poker-icm-tutorial-done", "1");
        localStorage.setItem("poker-icm-practice-diff", "normal");
        localStorage.setItem("poker-icm-practice-mode", "callfold");
        localStorage.setItem("poker-icm-theme", "dark");
        localStorage.setItem("poker-icm-app-state-v1", JSON.stringify(scenario));
      } catch { /* ignore */ }
    },
    { lang, scenario: SCENARIO, tutorialDone },
  );
  const page = await context.newPage();
  return { context, page };
}

async function shoot(page, outDir, name) {
  const file = path.join(outDir, `${name}.png`);
  // fullPage: false = viewport ちょうど。ASC は 1px でも違うと受け付けないため。
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function main() {
  const { device: deviceName, lang, out } = parseArgs(process.argv.slice(2));
  const device = DEVICES[deviceName];
  const { chromium } = loadPlaywright();

  ensureBuilt();
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const server = await startPreviewServer();
  const browser = await chromium.launch();
  console.log(`[shots] ${deviceName} (${device.px}) / lang=${lang} → ${out}`);

  try {
    // ===== 01 練習タブ: call/fold 出題 =====
    {
      const { context, page } = await newPage(browser, device, lang);
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.click('.tab-btn[data-tab="practice"]');
      await page.waitForSelector(".practice-btn[data-answer='call']");
      await page.waitForTimeout(400);
      await shoot(page, out, "01-practice-callfold");
      await context.close();
    }

    // ===== 02 計算結果タブ: ICM エクイティ + 必要勝率 =====
    {
      const { context, page } = await newPage(browser, device, lang);
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.click('.tab-btn[data-tab="result"]');
      await page.waitForSelector("#icm-rows tr");
      await page.waitForTimeout(400);
      await shoot(page, out, "02-result-icm");
      await context.close();
    }

    // ===== 03 計算結果タブ: 全員 vs 全員 BF マップ =====
    {
      const { context, page } = await newPage(browser, device, lang);
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.click('.tab-btn[data-tab="result"]');
      await page.waitForSelector("#bf-matrix .bf-cell");
      // ヒートマップが画面中央に来るまでスクロール。
      await page.evaluate(() => {
        document.getElementById("bf-matrix-outer")
          ?.scrollIntoView({ block: "center", behavior: "instant" });
      });
      await page.waitForTimeout(400);
      await shoot(page, out, "03-bf-matrix");
      await context.close();
    }

    // ===== 04 練習タブ: 導入コース =====
    {
      const { context, page } = await newPage(browser, device, lang, { tutorialDone: false });
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.click('.tab-btn[data-tab="practice"]');
      await page.waitForSelector("#tutorial-intro-start-btn");
      await page.click("#tutorial-intro-start-btn");
      // 導入(1/5)の説明 → 実際の設問まで進める。説明画面だけだと iPad の
      // 縦長ビューポートに対して中身が薄く、下 2/3 が余白になるため。
      await page.waitForSelector("#tutorial-start-problem-btn");
      await page.click("#tutorial-start-problem-btn");
      await page.waitForSelector("#practice-area .practice-btn");
      // 回答して「教訓 (lesson)」まで出す (docs/APP_STORE_LISTING.md §8 の構成案)。
      await page.click("#practice-area .practice-btn");
      await page.waitForTimeout(600);
      await shoot(page, out, "04-tutorial");
      await context.close();
    }

    // ===== 05 Nash タブ: push/call レンジ =====
    {
      const { context, page } = await newPage(browser, device, lang);
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      await page.click('.tab-btn[data-tab="nash"]');
      await page.click("#nash-solve");
      await page.waitForSelector("#nash-sb-grid .hand-cell");
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        document.getElementById("nash-sb-grid")
          ?.scrollIntoView({ block: "center", behavior: "instant" });
      });
      await page.waitForTimeout(300);
      await shoot(page, out, "05-nash");
      await context.close();
    }

    // ===== 06 ペイウォール (IAP `pro_lifetime` の審査情報用) =====
    // window.Capacitor をネイティブ相当に固定して、実機と同じ
    // 「アップグレード / 購入を復元」入りのシートを出す。
    {
      const { context, page } = await newPage(browser, device, lang, { native: true });
      await page.goto(server.baseURL, { waitUntil: "networkidle" });
      // 無料枠は 3 人まで。5 人卓なのでプレイヤー追加でペイウォールが開く。
      await page.click("#add-player");
      await page.waitForSelector("#paywall-modal:not(.hidden)");
      // ブラウザでは RevenueCat から価格を取れないため、ASC 登録済みの実価格を入れる
      // (実機では同じ位置に product.priceString が入る)。
      await page.evaluate((price) => {
        const el = document.querySelector("#paywall-modal .paywall-price");
        if (el) el.textContent = el.textContent.replace("—", price);
      }, STORE_PRICE);
      await page.waitForTimeout(400);
      await shoot(page, out, "06-paywall");
      await context.close();
    }
  } finally {
    await browser.close().catch(() => {});
    server.stop();
  }
  console.log(`[shots] done → ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); })
  .finally(() => setImmediate(() => process.exit(process.exitCode ?? 0)));
