#!/usr/bin/env node
// playground の E2E 回帰スイート。テストランナーを使わない素の node
// スクリプト + playwright で、ビルド済み dist を vite preview で配信して
// 実ブラウザ (Chromium) で一通りの主要フローを確認する。
//
// 使い方: npm run e2e (= node e2e/index.mjs)
//   1. dist が無ければ vite build (通常は CI/ローカルで事前に npm run build 済み)
//   2. 空きポートで vite preview を起動
//   3. Chromium を1つ起動し、テストごとに新しい BrowserContext で実行
//   4. 失敗したテストは1回だけリトライ
//   5. 全テスト終了後、サーバー・ブラウザを終了し、失敗があれば exit code 1
import { loadPlaywright } from "./lib/pw.mjs";
import { ensureBuilt, startPreviewServer } from "./lib/server.mjs";
import { makeContextFactory } from "./lib/context.mjs";
import { runSuite } from "./lib/harness.mjs";

import testTabsTheme from "./tests/01-tabs-theme.mjs";
import testPracticeModes from "./tests/02-practice-modes.mjs";
import testTutorialIntro from "./tests/03-tutorial-intro.mjs";
import testPresetVerdictBanner from "./tests/04-preset-verdict-banner.mjs";
import testShareUrl from "./tests/05-share-url.mjs";

async function main() {
  const t0 = Date.now();
  const { chromium } = loadPlaywright();

  ensureBuilt();
  const server = await startPreviewServer();
  console.log(`[e2e] vite preview 起動: ${server.baseURL}`);

  const browser = await chromium.launch();
  const createContext = makeContextFactory(browser);
  const baseURL = server.baseURL;

  const tests = [
    {
      name: "5タブ x ダーク/ライト レンダリング (console/pageerror ゼロ)",
      run: () => testTabsTheme({ baseURL, createContext }),
    },
    {
      name: "練習3モード (call/fold・RP当て・push判定) 各1問回答",
      run: () => testPracticeModes({ baseURL, createContext }),
    },
    {
      name: "導入コース: 開始 → 1問目ナレーション表示",
      run: () => testTutorialIntro({ baseURL, createContext }),
    },
    {
      name: "プリセット(ftBubble) → 計算結果タブ → ハンド判定バナー",
      run: () => testPresetVerdictBanner({ baseURL, createContext }),
    },
    {
      name: "URL共有: hash生成 → 新コンテキストで復元",
      run: () => testShareUrl({ baseURL, createContext }),
    },
  ];

  let results = [];
  try {
    results = await runSuite(tests);
  } finally {
    await browser.close().catch(() => {});
    server.stop();
  }

  const failed = results.filter((r) => !r.passed);
  const totalMs = Date.now() - t0;
  console.log("");
  console.log(
    `[e2e] 合計 ${results.length}件 / 成功 ${results.length - failed.length}件 / 失敗 ${failed.length}件  (${totalMs}ms)`,
  );

  process.exitCode = failed.length > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error("[e2e] 致命的エラー:", e);
    process.exitCode = 1;
  })
  .finally(() => {
    // vite preview の子プロセスや fetch keep-alive ソケットなどが残っていても
    // 確実にプロセスを終了させる。
    setImmediate(() => process.exit(process.exitCode ?? 0));
  });
