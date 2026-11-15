// Web (workers.dev) の入口の中身。Worker の本体は index.ts (Worker の入口ファイルは
// ハンドラ以外を export できないので、判定と文面はこちらに分けている)。
//
// 製品は iOS アプリだけで、Web では計算アプリを配信しない。
// ただし App Store に登録しているサポートページと利用規約は同じ場所で
// 配信しているので、その2ページ (と、そこで使う画像) だけ通す。
// それ以外は「iOS アプリで提供しています」の案内を返す。
//
// iOS アプリは playground/dist を端末内に同梱して動くため、この Worker の
// 影響を受けない。手元で Web の画面を確認するときは `npm run dev` を使う。

export const APP_STORE_URL = "https://apps.apple.com/jp/app/id6793358140";

/** そのまま配信するページ (拡張子なしは Cloudflare が .html から転送した先)。 */
const PUBLIC_PAGES = ["/support", "/support.html", "/legal", "/legal.html"];

/** 上のページやブックマークで使う画像。 */
const PUBLIC_FILES = [
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/og-image.png",
];

const SERVICE_WORKER_PATH = "/sw.js";

export type Route = "asset" | "service-worker" | "closed";

export function classifyPath(pathname: string): Route {
  // 末尾のスラッシュ違いは同じページとして扱う ("/support/" など)
  const path =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
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

export const CLOSED_PAGE = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Poker ICM</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
        background: #0f1115; color: #e8eaed; line-height: 1.7; }
      main { max-width: 520px; margin: 0 auto; padding: 72px 16px; }
      h1 { font-size: 22px; margin: 0 0 16px; }
      a { color: #8ab4f8; }
      .store { display: inline-block; margin: 16px 0 32px; padding: 12px 20px; border-radius: 10px;
        background: #8ab4f8; color: #0f1115; font-weight: 700; text-decoration: none; }
      .en { color: #9aa0a6; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Poker ICM</h1>
      <p>Poker ICM は iPhone / iPad 向けのアプリです。このページでは計算機能を提供していません。</p>
      <a class="store" href="${APP_STORE_URL}">App Store で見る</a>
      <p><a href="/support">サポート</a> ・ <a href="/legal">利用規約・プライバシーポリシー</a></p>
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
