// ===== EntitlementService (freemium ゲートの判定を一元化) =====
//
// このモジュールは「ユーザーが Pro 権限を持つか」の判定を 1 か所に集約する。
// UI 各所 (setup.ts のロック処理・paywall.ts) は必ず isPro() を経由し、
// localStorage キーを直接見ないこと。判定ロジックを差し替えるのはここだけで済む。
//
// --- 開発/E2E 用の裏口 (常時有効) ---
//   localStorage["poker-icm-pro"] === "1" のとき Pro とみなす。
//   これは開発/E2E テスト用の裏口であり、UI からは設定できない
//   (どこにもトグルを置かない)。実ユーザーは常に無料状態で始まる。
//
// --- Phase 3: Capacitor + RevenueCat 接続 ---
//   ネイティブ (iOS) かつ IAP 設定済み (iapConfig の公開キーが空でない) のときのみ、
//   @revenuecat/purchases-capacitor を dynamic import して SDK を初期化し、
//   entitlement "pro" が active かどうかを判定する。判定結果は
//   localStorage["poker-icm-pro-rc"] にキャッシュし、オフライン起動でも
//   Pro を維持する。customerInfo 更新 (購入/復元) 時はリスナーで再評価し、
//   変化があれば notifyEntitlementChange() で購読者 (UI) へ通知する。
//   web / キー未設定時はここは一切動かず、従来挙動 (裏口のみ) を維持する。

import { isCapacitorNative } from "./capacitorEnv.js";
import { PRO_ENTITLEMENT_ID, REVENUECAT_IOS_API_KEY, isIapConfigured } from "./iapConfig.js";

const PRO_KEY = "poker-icm-pro";
// RevenueCat 判定のキャッシュ (開発用裏口 PRO_KEY とは別キー)。
// オフライン起動時でも直近の Pro 状態を復元できるようにする。
const PRO_RC_CACHE_KEY = "poker-icm-pro-rc";

// RevenueCat 由来の Pro 判定 (ランタイム)。localStorage が使えない環境でも
// セッション中の判定を保持するためのメモリ上フラグ。
let rcRuntimePro = false;

/**
 * ユーザーが Pro 権限を持つか。freemium ロックの唯一の判定関数。
 * 判定は以下の OR:
 *   1. 開発/E2E 用裏口   localStorage["poker-icm-pro"] === "1"
 *   2. RevenueCat キャッシュ localStorage["poker-icm-pro-rc"] === "1"
 *   3. RevenueCat ランタイム判定 (当セッションで active を確認済み)
 */
export function isPro(): boolean {
  // 通常ブラウザ (web) では全機能を無料開放する (誰でも完全版)。
  // Pro ゲートが効くのはアプリ版 (Capacitor ネイティブ) のみで、
  // web はデモ・宣伝を兼ねた完全版という位置づけ。
  if (!isCapacitorNative()) return true;
  if (rcRuntimePro) return true;
  try {
    if (localStorage.getItem(PRO_KEY) === "1") return true;
    if (localStorage.getItem(PRO_RC_CACHE_KEY) === "1") return true;
    return false;
  } catch {
    // localStorage 不可環境 (プライベートモード等) では裏口/キャッシュは読めないが、
    // メモリ上の rcRuntimePro は既にチェック済み。
    return false;
  }
}

// ===== 権限変更の購読機構 =====
const entitlementChangeCbs = new Set<(pro: boolean) => void>();

/**
 * Pro 権限の変化を購読する。RevenueCat の購入/復元完了で呼ばれて
 * UI を再描画するために使う。戻り値は購読解除関数。
 */
export function onEntitlementChange(cb: (pro: boolean) => void): () => void {
  entitlementChangeCbs.add(cb);
  return () => entitlementChangeCbs.delete(cb);
}

/**
 * 権限変更を購読者へ通知する (RevenueCat の customerInfo 更新時に呼ぶ)。
 */
export function notifyEntitlementChange(): void {
  const pro = isPro();
  for (const cb of entitlementChangeCbs) cb(pro);
}

/**
 * RevenueCat 由来の Pro 判定を反映する。メモリ上フラグと localStorage キャッシュを
 * 更新し、実質的な isPro() の結果が変化した場合のみ購読者へ通知する。
 */
function setRcPro(active: boolean): void {
  const before = isPro();
  rcRuntimePro = active;
  try {
    if (active) localStorage.setItem(PRO_RC_CACHE_KEY, "1");
    else localStorage.removeItem(PRO_RC_CACHE_KEY);
  } catch {
    /* localStorage 不可環境ではメモリ上フラグのみで運用 */
  }
  if (isPro() !== before) notifyEntitlementChange();
}

// RevenueCat の customerInfo から必要な部分だけを読むための最小構造 (構造的部分型)。
// SDK 型 (CustomerInfo) と互換で、静的 import を避けるためにここで定義する。
interface RcCustomerInfoLike {
  entitlements?: { active?: Record<string, { isActive?: boolean } | undefined> };
}

/**
 * RevenueCat の customerInfo を受け取り、Pro entitlement が active かを判定して
 * 反映する。purchasePackage / restorePurchases の結果や更新リスナーから呼ぶ。
 * 戻り値は「Pro が active か」。
 */
export function applyRevenueCatCustomerInfo(info: RcCustomerInfoLike | null | undefined): boolean {
  const active = info?.entitlements?.active?.[PRO_ENTITLEMENT_ID]?.isActive === true;
  setRcPro(active);
  return active;
}

/**
 * RevenueCat SDK を初期化して Pro 権限を判定する (Phase 3)。
 * - ネイティブ (iOS) かつ IAP 設定済みのときのみ実行し、それ以外は即 return
 *   (web / キー未設定では @revenuecat の dynamic import すら発生させない)。
 * - Purchases.configure → 初回 customerInfo 取得 → applyRevenueCatCustomerInfo。
 * - customerInfo 更新リスナーを登録し、購入/復元の反映を UI へ橋渡しする。
 * main.ts から fire-and-forget (await しない) で呼ぶ想定。失敗しても無料状態を維持。
 */
export async function initEntitlements(): Promise<void> {
  if (!isCapacitorNative() || !isIapConfigured()) return;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
    // 購入/復元による更新を購読 (初回取得より前に登録しておく)。
    await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      applyRevenueCatCustomerInfo(customerInfo);
    });
    const { customerInfo } = await Purchases.getCustomerInfo();
    applyRevenueCatCustomerInfo(customerInfo);
  } catch {
    // 初期化失敗 (ネットワーク不通・設定不備等) は無料状態のまま継続。
    // 直近の RC キャッシュがあればオフラインでも Pro を維持できる。
  }
}
