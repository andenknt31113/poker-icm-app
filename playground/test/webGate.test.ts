import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import worker from "../../worker/index.ts";
import { APP_STORE_URL, CLOSED_PAGE, LANDING_PAGE, classifyPath } from "../../worker/gate.ts";

const GLOBAL_APP_STORE_URL = "https://apps.apple.com/app/id6793358140";
const BANNED_JP_WORDS = /首|押す|押し|GTO|練習/;
const FIXED_PRICE_PATTERN = /[¥￥]\s?\d|\$\s?\d/;

describe("Web の入口 (worker): 通すパスの判定", () => {
  it("トップ (/) は案内ランディングページとして扱う", () => {
    expect(classifyPath("/")).toBe("landing");
  });

  it("サポートページと利用規約は通す", () => {
    for (const p of ["/support", "/support.html", "/legal", "/legal.html", "/support/", "/legal/"]) {
      expect(classifyPath(p)).toBe("asset");
    }
  });

  it("サポートページやランディングで使う画像は通す", () => {
    for (const p of ["/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"]) {
      expect(classifyPath(p)).toBe("asset");
    }
  });

  it("計算アプリの画面とその部品は通さない", () => {
    for (const p of [
      "/index.html",
      "/assets/index-abc123.js",
      "/three-way-equity.bin",
      "/manifest.json",
      "/support.html.bak",
      "/legal/extra",
    ]) {
      expect(classifyPath(p)).toBe("closed");
    }
  });

  it("sw.js は片付け用として別扱い", () => {
    expect(classifyPath("/sw.js")).toBe("service-worker");
  });
});

describe("Web の入口 (worker): 応答", () => {
  const assets = {
    fetch: async (req: Request) => new Response(`asset:${new URL(req.url).pathname}`),
  };
  const call = (path: string) =>
    worker.fetch(new Request(`https://example.test${path}`), { ASSETS: assets });

  it("App Store URL は /jp/ 固定ではなくグローバル URL を使う", () => {
    expect(APP_STORE_URL).toBe(GLOBAL_APP_STORE_URL);
    expect(APP_STORE_URL).not.toContain("/jp/");
  });

  it("トップ (/) は 200 OK の iOS アプリ案内ランディングページを返す", async () => {
    const res = await call("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-robots-tag")).toBeNull();
    const body = await res.text();
    expect(body).toBe(LANDING_PAGE);
    expect(body).not.toContain("noindex");
    expect(body).toContain(GLOBAL_APP_STORE_URL);
    expect(body).not.toContain("/jp/app/");
    expect(body).toContain('href="/support"');
    expect(body).toContain('href="/legal"');
    expect(body).toContain("#101715");
    expect(body).toContain("#a8e6bd");
    expect(body).toContain("iOS アプリ専用");
    expect(body).toContain("買い切り Pro");
    expect(body).toContain("完全オフライン");
    expect(body).toContain("One-Time Pro");
    expect(body).toContain("100% Offline");
  });

  it("サポートページと利用規約は配信ファイルをそのまま 200 で返す", async () => {
    for (const p of ["/support", "/legal"]) {
      const res = await call(p);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(`asset:${p}`);
    }
  });

  it("計算アプリの HTML とスクリプトは 410 Gone で遮断し配信ファイルに渡さない", async () => {
    for (const p of ["/index.html", "/assets/index-abc123.js"]) {
      const res = await call(p);
      expect(res.status).toBe(410);
      expect(res.headers.get("x-robots-tag")).toBe("noindex");
      const body = await res.text();
      expect(body).toBe(CLOSED_PAGE);
      expect(body).toContain(GLOBAL_APP_STORE_URL);
      expect(body).not.toContain("asset:");
    }
  });

  it("sw.js は登録を外すスクリプトを返す", async () => {
    const res = await call("/sw.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toContain("registration.unregister()");
  });
});

describe("公開 Web 文面 (gate / support.html) の整合と禁則チェック", () => {
  const supportHtml = readFileSync(new URL("../public/support.html", import.meta.url), "utf8");

  it("support.html にグローバル App Store ダウンロードリンクがあり、固定価格をハードコードしない", () => {
    expect(supportHtml).toContain(`href="${GLOBAL_APP_STORE_URL}"`);
    expect(supportHtml).not.toContain("/jp/app/");
    expect(supportHtml).toContain("買い切り");
    expect(supportHtml).toContain("App Store の表示に準拠");
    expect(supportHtml).not.toMatch(FIXED_PRICE_PATTERN);
  });

  it("ランディング・遮断ページ・サポートページの文面に禁則語や固定価格を含まない", () => {
    for (const html of [LANDING_PAGE, CLOSED_PAGE, supportHtml]) {
      expect(html).not.toMatch(BANNED_JP_WORDS);
      expect(html).not.toMatch(FIXED_PRICE_PATTERN);
    }
  });
});
