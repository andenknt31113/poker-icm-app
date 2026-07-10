// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initPwa } from "../src/pwa.js";

// navigator.serviceWorker / registration / worker はブラウザ実装が複雑なため、
// EventTarget を土台にした最小限のフェイクで統合的に振る舞いを検証する。
class FakeEventTarget extends EventTarget {}

interface FakeWorker extends EventTarget {
  state: string;
  postMessage: ReturnType<typeof vi.fn>;
}

function makeFakeWorker(): FakeWorker {
  const worker = new FakeEventTarget() as unknown as FakeWorker;
  worker.state = "installing";
  worker.postMessage = vi.fn();
  return worker;
}

interface FakeRegistration extends EventTarget {
  installing: FakeWorker | null;
  onupdatefound: (() => void) | null;
}

function makeFakeRegistration(): FakeRegistration {
  const reg = new FakeEventTarget() as unknown as FakeRegistration;
  reg.installing = null;
  reg.onupdatefound = null;
  return reg;
}

function setupDom(): void {
  document.body.innerHTML = `
    <header><div class="header-actions"></div></header>
    <div class="tab-bar"></div>
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

describe("SW 更新通知トースト", () => {
  let registerMock: ReturnType<typeof vi.fn>;
  let swContainer: FakeEventTarget & {
    controller: unknown;
    register: ReturnType<typeof vi.fn>;
  };
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setupDom();
    stubMatchMedia();

    reloadMock = vi.fn();
    vi.stubGlobal("location", { protocol: "http:", reload: reloadMock });

    registerMock = vi.fn().mockImplementation(() => Promise.resolve(makeFakeRegistration()));
    swContainer = new FakeEventTarget() as unknown as typeof swContainer;
    swContainer.controller = { fake: "existing-controller" };
    swContainer.register = registerMock;

    Object.defineProperty(window.navigator, "serviceWorker", {
      value: swContainer,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    Reflect.deleteProperty(window.navigator, "serviceWorker");
  });

  async function triggerUpdateInstalled(): Promise<FakeWorker> {
    initPwa();
    window.dispatchEvent(new Event("load"));
    // register() の .then(...) が解決されるまでマイクロタスクを進める
    await Promise.resolve();
    await Promise.resolve();

    const registration = await (registerMock.mock.results[0]!.value as Promise<FakeRegistration>);
    const worker = makeFakeWorker();
    registration.installing = worker;
    registration.onupdatefound?.();
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));
    return worker;
  }

  it("既存 controller がある状態で installed になったら更新トーストを表示する", async () => {
    await triggerUpdateInstalled();

    const toast = document.getElementById("sw-update-toast");
    expect(toast).toBeTruthy();
    expect(toast?.textContent).toContain("新しいバージョンがあります");
    expect(toast?.textContent).toContain("タップで更新");

    // タブバーの上に固定表示される共有スタックに載っていること
    const stack = document.getElementById("pwa-toast-stack");
    expect(stack).toBeTruthy();
    expect(toast?.parentElement).toBe(stack);
  });

  it("トーストをタップすると新 worker に SKIP_WAITING を postMessage する", async () => {
    const worker = await triggerUpdateInstalled();
    const toast = document.getElementById("sw-update-toast")!;

    toast.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("✕ を押すとトーストを dismiss し、postMessage は送らない", async () => {
    const worker = await triggerUpdateInstalled();
    const toast = document.getElementById("sw-update-toast")!;
    const closeBtn = toast.querySelector(".sw-update-toast-close") as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();

    closeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("sw-update-toast")).toBeNull();
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it("controllerchange で 1 度だけ location.reload する (多重リロードガード)", async () => {
    await triggerUpdateInstalled();

    swContainer.dispatchEvent(new Event("controllerchange"));
    swContainer.dispatchEvent(new Event("controllerchange"));
    swContainer.dispatchEvent(new Event("controllerchange"));

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("既存 controller がない (初回インストール) 場合は更新トーストを出さない", async () => {
    swContainer.controller = null;
    initPwa();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();

    const registration = await (registerMock.mock.results[0]!.value as Promise<FakeRegistration>);
    const worker = makeFakeWorker();
    registration.installing = worker;
    registration.onupdatefound?.();
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));

    expect(document.getElementById("sw-update-toast")).toBeNull();
  });

  it("同時に iOS インストールバナーが出ていても更新トーストと重ならず同じスタックに積まれる", async () => {
    // iOS UA を偽装して iOS インストール案内バナーも表示させる
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );

    const worker = await triggerUpdateInstalled();

    const stack = document.getElementById("pwa-toast-stack");
    const iosBanner = document.querySelector(".ios-install-banner");
    const updateToast = document.getElementById("sw-update-toast");

    expect(stack).toBeTruthy();
    expect(iosBanner?.parentElement).toBe(stack);
    expect(updateToast?.parentElement).toBe(stack);
    // 2 つのバナーが共存し、DOM 上は別要素として重ならず積み上がっている
    expect(stack?.children.length).toBe(2);
    expect(worker).toBeTruthy();
  });
});
