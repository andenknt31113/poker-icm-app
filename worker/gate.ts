// Web (workers.dev) の入口の中身。Worker の本体は index.ts (Worker の入口ファイルは
// ハンドラ以外を export できないので、判定と文面はこちらに分けている)。
//
// 製品は iOS アプリだけで、Web では計算アプリを配信しない。
// トップ ("/") は軽量な iOS アプリ案内ランディングページを 200 OK で返し、
// App Store に登録しているサポートページと利用規約 (と、そこで使う画像) だけ
// 静的ファイルから配信する。
// それ以外の計算アプリ配信用パス (/index.html, /assets/* 等) は 410 Gone で遮断する。
//
// iOS アプリは playground/dist を端末内に同梱して動くため、この Worker の
// 影響を受けない。手元で Web の画面を確認するときは `npm run dev` を使う。

export const APP_STORE_URL = "https://apps.apple.com/app/id6793358140";

/** そのまま配信するページ (拡張子なしは Cloudflare が .html から転送した先)。 */
const PUBLIC_PAGES = ["/support", "/support.html", "/legal", "/legal.html"];

/** 上のページやブックマークで使う画像。 */
const PUBLIC_FILES = [
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

const SERVICE_WORKER_PATH = "/sw.js";

export type Route = "landing" | "asset" | "service-worker" | "closed";

export function classifyPath(pathname: string): Route {
  // 末尾のスラッシュ違いは同じページとして扱う ("/support/" など)
  const path =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path === "/" || path === "") return "landing";
  if (PUBLIC_PAGES.includes(path) || PUBLIC_FILES.includes(path)) return "asset";
  if (path === SERVICE_WORKER_PATH) return "service-worker";
  return "closed";
}

/**
 * 以前 Web 版を開いた端末に残っている service worker を片付けるためのもの。
 * 更新として受け取った端末でキャッシュを消し、自分自身の登録も外す。
 */
export const CLEANUP_SERVICE_WORKER = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister()),
  );
});
`;

export const LANDING_PAGE = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#101715" />
    <meta name="apple-itunes-app" content="app-id=6793358140" />
    <title>Poker ICM — iOS トーナメント ICM・バウンティ・チョップ計算アプリ</title>
    <meta
      name="description"
      content="iPhone / iPad 専用のトーナメント ICM・Bubble Factor・KO/PKO バウンティ・Nash レンジ・チョップ計算アプリ。完全オフライン、無料ダウンロード・買い切り Pro（月額課金なし）。"
    />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Poker ICM — Offline Tournament ICM &amp; Bounty Calculator for iOS" />
    <meta
      property="og:description"
      content="iPhone / iPad 向けの完全オフライン ICM・Bubble Factor・KO/PKO バウンティ・Nash レンジ・チョップ計算アプリ。買い切り Pro（月額なし）。"
    />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Inter", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif;
        background: #101715;
        color: #eef3ed;
        line-height: 1.7;
      }
      main { max-width: 680px; margin: 0 auto; padding: 48px 18px 64px; }
      .eyebrow {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: #a8e6bd;
        background: #18231f;
        border: 1px solid #304239;
        border-radius: 999px;
        padding: 4px 12px;
        margin-bottom: 14px;
      }
      h1 { font-size: 28px; margin: 0 0 12px; color: #a8e6bd; letter-spacing: -0.01em; }
      h2 { font-size: 16px; margin: 0 0 10px; color: #a8e6bd; }
      p { margin: 0 0 12px; }
      .lead { font-size: 16px; color: #eef3ed; }
      .lead-en { font-size: 14px; color: #c7d4cc; margin-bottom: 22px; }
      .cta-wrap { margin: 22px 0 18px; }
      .store {
        display: inline-block;
        padding: 13px 22px;
        border-radius: 12px;
        background: #a8e6bd;
        color: #101715;
        font-weight: 700;
        font-size: 15px;
        text-decoration: none;
      }
      .store:hover { opacity: 0.92; }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        list-style: none;
        padding: 0;
        margin: 14px 0 28px;
      }
      .pills li {
        font-size: 13px;
        color: #c7d4cc;
        background: #18231f;
        border: 1px solid #304239;
        border-radius: 8px;
        padding: 5px 10px;
      }
      .card {
        background: #18231f;
        border: 1px solid #304239;
        border-radius: 14px;
        padding: 18px 20px;
        margin: 0 0 16px;
      }
      .features { margin: 0; padding-left: 18px; color: #c7d4cc; font-size: 14px; }
      .features li { margin-bottom: 8px; }
      .features li:last-child { margin-bottom: 0; }
      .features strong { color: #eef3ed; }
      a { color: #a8e6bd; }
      footer {
        margin-top: 28px;
        padding-top: 18px;
        border-top: 1px solid #304239;
        font-size: 14px;
      }
      .nav-links { margin-bottom: 12px; }
      .muted { color: #a1b2a7; font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <span class="eyebrow">iOS アプリ専用 · iPhone / iPad</span>
      <h1>♠ Poker ICM</h1>
      <p class="lead">
        トーナメントの ICM・Bubble Factor・バウンティ (KO / PKO)・Nash 均衡レンジ・チョップ計算を、iPhone / iPad の完全オフラインで。
      </p>
      <p class="lead-en">
        Offline tournament ICM, Bubble Factor, KO/PKO bounty, Nash push/fold range, and deal chop calculator for iPhone &amp; iPad.
      </p>

      <div class="cta-wrap">
        <a class="store" href="${APP_STORE_URL}" rel="noopener">App Store で無料ダウンロード / Download on the App Store</a>
      </div>

      <ul class="pills">
        <li>iOS アプリ専用 / iOS Only</li>
        <li>買い切り Pro（月額なし） / One-Time Pro</li>
        <li>完全オフライン / 100% Offline</li>
      </ul>

      <section class="card">
        <h2>主な機能・料金（日本語）</h2>
        <ul class="features">
          <li><strong>厳密 ICM・Bubble Factor・13×13 ハンド表</strong>：Malmuth-Harville 方式の厳密計算で、オールインやコールに必要な勝率と全席の ICM Nash 均衡を即確認。</li>
          <li><strong>ライブ卓にも強い実用機能</strong>：BB / 実チップ数の切替、自分の手札クイック判定、ICM チョップ計算と結果の1タップコピーに対応。</li>
          <li><strong>無料ダウンロード・買い切り Pro</strong>：組み込みの例題での全計算と4人までの卓の自由編集は無料。5人以上の卓編集・局面や賞金の保存・バウンティ (KO / PKO) 設定は買い切り Pro（月額課金なし・価格は App Store の表示に準拠）。</li>
          <li><strong>完全オフライン・登録不要</strong>：計算処理はすべて端末内で完結。電波の届きにくい会場でも動作します。</li>
        </ul>
      </section>

      <section class="card" lang="en">
        <h2>Overview (English)</h2>
        <ul class="features">
          <li><strong>Exact ICM, Bubble Factor &amp; Ranges</strong>: Exact Malmuth-Harville ICM, Bubble Factor matrix, required equity, 13×13 hand grid, and full-table ICM Nash push/fold ranges.</li>
          <li><strong>Built for Live &amp; Online MTTs</strong>: Switch between BB and actual chip counts, quick-check your hand, and calculate ICM deal chops with one-tap copy.</li>
          <li><strong>Free Download · One-Time Pro (No Subscription)</strong>: Built-in scenarios and custom tables up to 4 players are free. Unlock 5–9 player editing, saved spots/payouts, and KO/PKO bounty setup with a one-time Pro purchase (price as shown on the App Store).</li>
          <li><strong>iOS-Only &amp; 100% Offline</strong>: Built exclusively for iPhone and iPad. All calculations run on-device with no account required.</li>
        </ul>
      </section>

      <footer>
        <p class="nav-links">
          <a href="/support">サポート / Support</a> ・ <a href="/legal">利用規約・プライバシーポリシー / Terms &amp; Privacy</a>
        </p>
        <p class="muted">
          ※ この Web サイトでは計算機能を提供していません（iOS アプリ専用です）。<br />
          The calculator is not available on the web (iOS app only).
        </p>
      </footer>
    </main>
  </body>
</html>
`;

export const CLOSED_PAGE = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Poker ICM</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
        background: #101715; color: #eef3ed; line-height: 1.7; }
      main { max-width: 520px; margin: 0 auto; padding: 72px 16px; }
      h1 { font-size: 22px; margin: 0 0 16px; color: #a8e6bd; }
      a { color: #a8e6bd; }
      .store { display: inline-block; margin: 16px 0 32px; padding: 12px 20px; border-radius: 10px;
        background: #a8e6bd; color: #101715; font-weight: 700; text-decoration: none; }
      .en { color: #a1b2a7; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Poker ICM</h1>
      <p>Poker ICM は iPhone / iPad 向けのアプリです。このページでは計算機能を提供していません。</p>
      <a class="store" href="${APP_STORE_URL}" rel="noopener">App Store で見る</a>
      <p><a href="/">アプリ案内トップ</a> ・ <a href="/support">サポート</a> ・ <a href="/legal">利用規約・プライバシーポリシー</a></p>
      <p class="en">Poker ICM is an app for iPhone and iPad. The calculator is not available on this page.</p>
    </main>
  </body>
</html>
`;

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const route = classifyPath(new URL(request.url).pathname);
  if (route === "landing") {
    return new Response(LANDING_PAGE, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  if (route === "asset") return env.ASSETS.fetch(request);
  if (route === "service-worker") {
    return new Response(CLEANUP_SERVICE_WORKER, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  return new Response(CLOSED_PAGE, {
    // 410 = 以前はあったが、もう提供していない
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
