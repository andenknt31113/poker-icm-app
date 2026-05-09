// Poker ICM/BF プレイグラウンド サービスワーカー
//
// 戦略:
//   - HTML / manifest:  network-first (常に最新を取りに行き、失敗時のみキャッシュ)
//   - hashed assets (assets/*.[hash].js|css):  cache-first (immutable; vite が hash 付きで出力)
//   - その他 GET:  stale-while-revalidate
//
// vite が assets ファイル名にコンテンツハッシュを入れるため、
// HTML が新 hash を参照していれば自動的に新 asset がフェッチされる。
// CACHE 名の手動 bump は不要 (キャッシュ自体は古い hash でも害がない、
// HTML が参照しなくなれば LRU で消える / install 時に古い caches を全削除)。

const CACHE = "poker-icm-shell-v1";
const PRECACHE_URLS = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE_URLS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

function isHashedAsset(url) {
  // vite が出す assets/index-XXXXXXXX.js / index-XXXXXXXX.css などを判定
  return /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css|woff2?|png|svg|jpg)(\?.*)?$/.test(url);
}

function isHTML(request) {
  return (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html") ||
    request.url.endsWith("/") ||
    request.url.endsWith(".html")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = request.url;

  // 1) ハッシュ付き asset → cache-first (一度取ったら永続)
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        }),
      ),
    );
    return;
  }

  // 2) HTML / manifest → network-first (常に最新を取りに行く)
  if (isHTML(request) || url.endsWith("/manifest.json")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // 3) その他 → stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});
