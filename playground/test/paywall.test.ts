// @vitest-environment jsdom
//
// paywall.ts のユニットテスト:
// - トリガー別の見出し・比較カード・.paywall-one-time・規約リンク表示
// - preloadOfferingPrice() による価格先読み ("—" チラつき抑止)
// - Purchases.trackCustomPaywallImpression のネイティブ&IAP設定済みガードと例外握りつぶし
// - Web / IAP 未設定時に @revenuecat を一切呼ばないこと
import { describe, it, expect, vi, beforeEach } from "vitest";

const purchasesMock = vi.hoisted(() => ({
  configure: vi.fn(),
  addCustomerInfoUpdateListener: vi.fn(),
  getCustomerInfo: vi.fn(),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  trackCustomPaywallImpression: vi.fn(),
}));

const inAppReviewMock = vi.hoisted(() => ({
  requestReview: vi.fn(),
}));

const iapKeyState = vi.hoisted(() => ({ key: "" }));

vi.mock("@revenuecat/purchases-capacitor", () => ({ Purchases: purchasesMock }));
vi.mock("@capacitor-community/in-app-review", () => ({ InAppReview: inAppReviewMock }));
vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
    selectionStart: vi.fn(),
    selectionChanged: vi.fn(),
    selectionEnd: vi.fn(),
  },
  ImpactStyle: { Light: "LIGHT" },
  NotificationType: { Success: "SUCCESS" },
}));
vi.mock("../src/iapConfig.js", () => ({
  get REVENUECAT_IOS_API_KEY() {
    return iapKeyState.key;
  },
  PRO_ENTITLEMENT_ID: "pro",
  isIapConfigured: () => iapKeyState.key.trim().length > 0,
}));

function makeOfferings(priceString: string) {
  const pkg = { identifier: "$rc_lifetime", product: { priceString } };
  return {
    current: {
      identifier: "default",
      lifetime: pkg,
      availablePackages: [pkg],
    },
  };
}

async function loadPaywall(opts: { key?: string; native?: boolean } = {}) {
  iapKeyState.key = opts.key ?? "";
  if (opts.native) {
    (window as unknown as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
  }
  return await import("../src/paywall.js");
}

beforeEach(() => {
  vi.resetModules();
  iapKeyState.key = "";
  document.body.innerHTML = "";
  localStorage.clear();
  for (const fn of Object.values(purchasesMock)) fn.mockReset();
  inAppReviewMock.requestReview.mockReset();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe("paywall UI & trigger context", () => {
  it("トリガー別にタイトル・比較カード・買い切り表記・規約リンクを表示する", async () => {
    const { openPaywall } = await loadPaywall({ native: false });
    openPaywall("bounty");

    const title = document.querySelector("#paywall-title")?.textContent ?? "";
    const oneTime = document.querySelector(".paywall-one-time")?.textContent ?? "";
    const compare = document.querySelector(".paywall-compare")?.textContent ?? "";
    expect(title).toContain("バウンティ");
    expect(oneTime).toContain("買い切り");
    expect(compare).toContain("47.6%");
    expect(compare).toContain("34.7%");

    // 規約リンクから規約モーダルが開く
    document.querySelector<HTMLButtonElement>("#paywall-legal-link")?.click();
    expect(document.querySelector("#legal-modal")?.classList.contains("hidden")).toBe(false);

    // 別トリガーに切り替わると見出しも追従する
    openPaywall("players");
    expect(document.querySelector("#paywall-title")?.textContent).toContain("5〜9人");
  });

  it("Web では RevenueCat (getOfferings / trackCustomPaywallImpression) を一切呼ばない", async () => {
    const { openPaywall, preloadOfferingPrice } = await loadPaywall({ key: "appl_test", native: false });
    await preloadOfferingPrice();
    openPaywall("bounty");
    await Promise.resolve();
    expect(purchasesMock.configure).not.toHaveBeenCalled();
    expect(purchasesMock.getOfferings).not.toHaveBeenCalled();
    expect(purchasesMock.trackCustomPaywallImpression).not.toHaveBeenCalled();
  });
});

describe("paywall native offering preload & anonymous impression tracking", () => {
  it("起動時先読みした価格を即表示し、openPaywall で匿名表示計測を送る", async () => {
    purchasesMock.configure.mockResolvedValue(undefined);
    purchasesMock.getOfferings.mockResolvedValue(makeOfferings("¥1,980"));
    purchasesMock.trackCustomPaywallImpression.mockResolvedValue(undefined);

    const { openPaywall, preloadOfferingPrice } = await loadPaywall({ key: "appl_test", native: true });
    await preloadOfferingPrice();

    openPaywall("bounty");
    // 先読み済みのため初回表示時点で "—" ではなく実価格が入っている
    expect(document.querySelector(".paywall-price")?.textContent).toContain("¥1,980");

    // 非同期の trackCustomPaywallImpression 完了を待つ
    await vi.waitFor(() => {
      expect(purchasesMock.trackCustomPaywallImpression).toHaveBeenCalledTimes(1);
    });
    expect(purchasesMock.trackCustomPaywallImpression).toHaveBeenCalledWith(
      expect.objectContaining({
        paywallId: "pro_bounty",
        offering: expect.objectContaining({ identifier: "default" }),
      }),
    );
  });

  it("trackCustomPaywallImpression が失敗しても例外を外に出さない", async () => {
    purchasesMock.configure.mockResolvedValue(undefined);
    purchasesMock.getOfferings.mockResolvedValue(makeOfferings("$11.99"));
    purchasesMock.trackCustomPaywallImpression.mockRejectedValue(new Error("network"));

    const { openPaywall } = await loadPaywall({ key: "appl_test", native: true });
    expect(() => openPaywall("header")).not.toThrow();
    await vi.waitFor(() => {
      expect(purchasesMock.trackCustomPaywallImpression).toHaveBeenCalledTimes(1);
    });
    expect(document.querySelector("#paywall-modal")?.classList.contains("hidden")).toBe(false);
  });

  it("Pro 購入成功時にモーダルを閉じて評価ダイアログを好機として呼ぶ", async () => {
    purchasesMock.configure.mockResolvedValue(undefined);
    purchasesMock.getOfferings.mockResolvedValue(makeOfferings("¥1,980"));
    purchasesMock.trackCustomPaywallImpression.mockResolvedValue(undefined);
    purchasesMock.purchasePackage.mockResolvedValue({
      customerInfo: { entitlements: { active: { pro: { isActive: true } } } },
    });
    inAppReviewMock.requestReview.mockResolvedValue(undefined);

    const { openPaywall, preloadOfferingPrice } = await loadPaywall({ key: "appl_test", native: true });
    await preloadOfferingPrice();
    openPaywall("bounty");
    document.querySelector<HTMLButtonElement>("#paywall-upgrade")?.click();

    await vi.waitFor(() => {
      expect(inAppReviewMock.requestReview).toHaveBeenCalledTimes(1);
    });
    expect(document.querySelector("#paywall-modal")?.classList.contains("hidden")).toBe(true);
  });
});
