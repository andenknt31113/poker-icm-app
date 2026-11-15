import { describe, expect, it } from "vitest";
import worker from "../../worker/index.ts";
import { APP_STORE_URL, CLOSED_PAGE, classifyPath } from "../../worker/gate.ts";

describe("Web の入口 (worker): 通すパスの判定", () => {
  it("サポートページと利用規約は通す", () => {
    for (const p of ["/support", "/support.html", "/legal", "/legal.html", "/support/"]) {
      expect(classifyPath(p)).toBe("asset");
    }
  });

  it("サポートページで使う画像は通す", () => {
    expect(classifyPath("/icon.svg")).toBe("asset");
    expect(classifyPath("/apple-touch-icon.png")).toBe("asset");
  });

  it("計算アプリの画面とその部品は通さない", () => {
    for (const p of [
      "/",
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

  it("トップは 410 と案内ページを返し、App Store とサポートへのリンクがある", async () => {
    const res = await call("/");
    expect(res.status).toBe(410);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const body = await res.text();
    expect(body).toBe(CLOSED_PAGE);
    expect(body).toContain(APP_STORE_URL);
    expect(body).toContain('href="/support"');
    expect(body).toContain('href="/legal"');
  });

  it("サポートページは配信ファイルをそのまま返す", async () => {
    const res = await call("/support");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("asset:/support");
  });

  it("計算アプリのスクリプトは配信ファイルに渡さない", async () => {
    const res = await call("/assets/index-abc123.js");
    expect(res.status).toBe(410);
    expect(await res.text()).not.toContain("asset:");
  });

  it("sw.js は登録を外すスクリプトを返す", async () => {
    const res = await call("/sw.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toContain("registration.unregister()");
  });
});
