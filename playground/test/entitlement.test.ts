// @vitest-environment jsdom
//
// EntitlementService (freemium ゲート判定の一元化) のユニットテスト。
// - 裏口 / RevenueCat キャッシュ / OR 判定
// - RevenueCat 由来 customerInfo の反映と onEntitlementChange 通知
// - IAP 未設定 / 非ネイティブ時に @revenuecat が dynamic import されないこと
//
// @revenuecat/purchases-capacitor と iapConfig は vi.doMock でモックし、
// vi.resetModules() + 動的 import で各テストを分離する (module 内フラグの持ち越し防止)。
import { describe, it, expect, vi, beforeEach } from "vitest";

// RevenueCat SDK (Purchases) のモック。全テストで共有し beforeEach でリセットする。
const purchasesMock = {
  configure: vi.fn(),
  addCustomerInfoUpdateListener: vi.fn(),
  getCustomerInfo: vi.fn(),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
};

type CustomerInfoLike = { entitlements: { active: Record<string, { isActive: boolean }> } };
function makeCustomerInfo(proActive: boolean): CustomerInfoLike {
  return { entitlements: { active: proActive ? { pro: { isActive: true } } : {} } };
}

/**
 * entitlement.ts を、指定した IAP 設定 / ネイティブ状態でモックしたうえで
 * 新しいモジュールインスタンスとして読み込む。
 */
async function loadEntitlement(opts: { key?: string; native?: boolean } = {}) {
  const key = opts.key ?? "";
  vi.doMock("@revenuecat/purchases-capacitor", () => ({ Purchases: purchasesMock }));
  vi.doMock("../src/iapConfig.js", () => ({
    REVENUECAT_IOS_API_KEY: key,
    PRO_ENTITLEMENT_ID: "pro",
    isIapConfigured: () => key.trim().length > 0,
  }));
  if (opts.native) {
    (window as unknown as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
  }
  return await import("../src/entitlement.js");
}

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@revenuecat/purchases-capacitor");
  vi.doUnmock("../src/iapConfig.js");
  localStorage.clear();
  for (const fn of Object.values(purchasesMock)) fn.mockReset();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe("isPro の OR 判定", () => {
  it("開発用裏口 poker-icm-pro==='1' で Pro", async () => {
    const { isPro } = await loadEntitlement();
    expect(isPro()).toBe(false);
    localStorage.setItem("poker-icm-pro", "1");
    expect(isPro()).toBe(true);
  });

  it("RevenueCat キャッシュ poker-icm-pro-rc==='1' で Pro (オフライン起動維持)", async () => {
    const { isPro } = await loadEntitlement();
    localStorage.setItem("poker-icm-pro-rc", "1");
    expect(isPro()).toBe(true);
  });

  it("裏口もキャッシュも無ければ無料", async () => {
    const { isPro } = await loadEntitlement();
    expect(isPro()).toBe(false);
  });

  it("裏口と RC キャッシュは別キー (裏口を消しても RC が残れば Pro)", async () => {
    const { isPro } = await loadEntitlement();
    localStorage.setItem("poker-icm-pro", "1");
    localStorage.setItem("poker-icm-pro-rc", "1");
    localStorage.removeItem("poker-icm-pro");
    expect(isPro()).toBe(true);
  });
});

describe("applyRevenueCatCustomerInfo", () => {
  it("pro active でキャッシュを立て isPro=true・onEntitlementChange 発火", async () => {
    const { applyRevenueCatCustomerInfo, isPro, onEntitlementChange } = await loadEntitlement();
    const seen: boolean[] = [];
    onEntitlementChange((pro) => seen.push(pro));

    const active = applyRevenueCatCustomerInfo(makeCustomerInfo(true));
    expect(active).toBe(true);
    expect(isPro()).toBe(true);
    expect(localStorage.getItem("poker-icm-pro-rc")).toBe("1");
    expect(seen).toEqual([true]);
  });

  it("pro 非 active でキャッシュを消し isPro=false", async () => {
    const { applyRevenueCatCustomerInfo, isPro } = await loadEntitlement();
    localStorage.setItem("poker-icm-pro-rc", "1");
    const active = applyRevenueCatCustomerInfo(makeCustomerInfo(false));
    expect(active).toBe(false);
    expect(isPro()).toBe(false);
    expect(localStorage.getItem("poker-icm-pro-rc")).toBeNull();
  });

  it("状態が変わらないときは onEntitlementChange を呼ばない", async () => {
    const { applyRevenueCatCustomerInfo, onEntitlementChange } = await loadEntitlement();
    const cb = vi.fn();
    onEntitlementChange(cb);
    applyRevenueCatCustomerInfo(makeCustomerInfo(false)); // false のまま (初期も false)
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("initEntitlements の dynamic import ガード", () => {
  it("IAP 未設定 (キー空) なら @revenuecat を import せず configure しない", async () => {
    const { initEntitlements } = await loadEntitlement({ key: "", native: true });
    await initEntitlements();
    expect(purchasesMock.configure).not.toHaveBeenCalled();
    expect(purchasesMock.getCustomerInfo).not.toHaveBeenCalled();
  });

  it("非ネイティブ (web) ならキー設定済みでも configure しない", async () => {
    const { initEntitlements } = await loadEntitlement({ key: "appl_test", native: false });
    await initEntitlements();
    expect(purchasesMock.configure).not.toHaveBeenCalled();
  });

  it("ネイティブ & キー設定済みなら configure→getCustomerInfo で Pro を判定", async () => {
    purchasesMock.configure.mockResolvedValue(undefined);
    purchasesMock.addCustomerInfoUpdateListener.mockResolvedValue("cb-id");
    purchasesMock.getCustomerInfo.mockResolvedValue({ customerInfo: makeCustomerInfo(true) });

    const { initEntitlements, isPro } = await loadEntitlement({ key: "appl_test", native: true });
    await initEntitlements();

    expect(purchasesMock.configure).toHaveBeenCalledWith({ apiKey: "appl_test" });
    expect(purchasesMock.getCustomerInfo).toHaveBeenCalled();
    expect(isPro()).toBe(true);
  });

  it("customerInfo 更新リスナーが購入反映を橋渡しする", async () => {
    purchasesMock.configure.mockResolvedValue(undefined);
    purchasesMock.addCustomerInfoUpdateListener.mockResolvedValue("cb-id");
    purchasesMock.getCustomerInfo.mockResolvedValue({ customerInfo: makeCustomerInfo(false) });

    const { initEntitlements, isPro, onEntitlementChange } = await loadEntitlement({
      key: "appl_test",
      native: true,
    });
    const seen: boolean[] = [];
    onEntitlementChange((pro) => seen.push(pro));
    await initEntitlements();

    expect(isPro()).toBe(false);
    // 登録されたリスナーを取り出し、購入完了 (pro active) を疑似発火。
    const listener = purchasesMock.addCustomerInfoUpdateListener.mock.calls[0]![0] as (
      ci: CustomerInfoLike,
    ) => void;
    listener(makeCustomerInfo(true));
    expect(isPro()).toBe(true);
    expect(seen).toEqual([true]);
  });
});
