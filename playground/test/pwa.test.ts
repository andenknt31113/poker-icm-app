// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initPwa } from "../src/pwa.js";

function setupDom(): void {
  document.body.innerHTML = `
    <header><div class="header-actions"></div></header>
    <div class="tab-bar"></div>
    <footer><p id="footer-version">Poker ICM/BF</p></footer>
  `;
}

function stubMatchMedia(): void {
  (window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  });
}

describe("Web 版向けの機能を持たない", () => {
  beforeEach(() => {
    setupDom();
    stubMatchMedia();
  });

  afterEach(() => {
    Reflect.deleteProperty(window.navigator, "serviceWorker");
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("Service Worker を登録しない", () => {
    const register = vi.fn();
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: { register, addEventListener: vi.fn(), controller: null },
    });
    initPwa();
    window.dispatchEvent(new Event("load"));
    expect(register).not.toHaveBeenCalled();
  });

  it("iPhone のブラウザで開いても「ホーム画面に追加」の案内を出さない", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    );
    initPwa();
    window.dispatchEvent(new Event("beforeinstallprompt"));
    expect(document.querySelector(".ios-install-banner")).toBeNull();
    expect(document.getElementById("install-btn")).toBeNull();
  });
});

describe("フッターのビルドバージョン表示", () => {
  beforeEach(() => {
    setupDom();
    stubMatchMedia();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("#footer-version に '· build <__APP_VERSION__>' が追記される", () => {
    initPwa();
    const el = document.getElementById("footer-version");
    // vitest.config.ts の define で __APP_VERSION__ = \"test\" に固定している
    expect(el?.textContent).toBe("Poker ICM/BF · build test");
  });

  it("#footer-version が存在しない場合でも例外にならない", () => {
    document.querySelector("footer")?.remove();
    expect(() => initPwa()).not.toThrow();
  });
});
