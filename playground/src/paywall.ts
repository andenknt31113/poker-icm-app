// ===== ペイウォール (Pro 機能のロック時に出すモーダルシート) =====
//
// freemium ゲートの UI 側。ロックされた操作 (スタック編集・プレイヤー追加/削除・
// ランダム化・ペイ構造編集・シナリオ保存) を無料ユーザーが触ったとき
// openPaywall() で開く。既存の .guide-modal と同じトーンのモーダルシートで、
// 1 タップで閉じられる (過剰に押し付けない)。
//
// 価格・購入は 2 段構え:
//   - IAP 未設定 (iapConfig の公開キーが空) or web: 価格はプレースホルダ "—"、
//     「アップグレード」「購入を復元」はタップで「準備中」トーストのみ (従来挙動)。
//   - ネイティブ (iOS) かつ IAP 設定済み: モーダルを開くと RevenueCat の offerings
//     から実価格を取得して表示し、実購入/復元フローを起動する。
//
// 重要: このモジュールは @revenuecat/purchases-capacitor を静的 import しない。
// 実購入フローは isCapacitorNative() ガードの内側で dynamic import する
// (通常ブラウザ向け Web バンドルに RevenueCat のコードを含めないため)。
import { t } from "./i18n.js";
import { isCapacitorNative } from "./capacitorEnv.js";
import { isIapConfigured } from "./iapConfig.js";
import { applyRevenueCatCustomerInfo } from "./entitlement.js";

// RevenueCat から実価格を取得できないあいだの価格プレースホルダ。
const PRICE_PLACEHOLDER = "—";

// 型のみの参照 (import(...) 型構文はコンパイル時に消去され、実行時 import を生まない)。
type PurchasesPackage = import("@revenuecat/purchases-capacitor").PurchasesPackage;

let paywallEl: HTMLDivElement | null = null;
// 表示中の offering から選んだ Pro パッケージ (アップグレード時に購入する対象)。
let cachedProPackage: PurchasesPackage | null = null;

/** 実 IAP フロー (ネイティブ & キー設定済み) を使うか。 */
function useRealIap(): boolean {
  return isCapacitorNative() && isIapConfigured();
}

function ensurePaywallModal(): HTMLDivElement {
  if (paywallEl) return paywallEl;
  const modal = document.createElement("div");
  modal.id = "paywall-modal";
  modal.className = "guide-modal paywall-modal hidden";

  const actionsHtml = isCapacitorNative()
    ? `
        <div class="paywall-actions">
          <button type="button" class="solve-btn" id="paywall-upgrade">${t("paywall.cta.upgrade")}</button>
          <button type="button" class="paywall-restore" id="paywall-restore">${t("paywall.cta.restore")}</button>
        </div>`
    : `
        <div class="paywall-actions">
          <p class="paywall-web-note">${t("paywall.web.note")}</p>
        </div>`;

  modal.innerHTML = `
    <div class="guide-modal-content">
      <div class="guide-modal-header">
        <h3>${t("paywall.title")}</h3>
        <button type="button" class="guide-modal-close" id="paywall-close" aria-label="${t("paywall.close.aria")}">✕</button>
      </div>
      <div class="guide-modal-body">
        <p class="paywall-lead">${t("paywall.lead")}</p>
        <ul class="paywall-features">
          <li>${t("paywall.feature.editStacks")}</li>
          <li>${t("paywall.feature.replay")}</li>
          <li>${t("paywall.feature.save")}</li>
        </ul>
        <p class="paywall-price">${t("paywall.price", { price: PRICE_PLACEHOLDER })}</p>
        ${actionsHtml}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#paywall-close")?.addEventListener("click", closePaywall);
  // 背景 (オーバーレイ) タップで閉じる = 1 タップで離脱できる。
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closePaywall();
  });
  modal.querySelector("#paywall-upgrade")?.addEventListener("click", onUpgradeClick);
  modal.querySelector("#paywall-restore")?.addEventListener("click", onRestoreClick);
  // Escape で閉じる (他モーダルと同じ挙動)。
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePaywallIfOpen();
  });

  paywallEl = modal;
  return modal;
}

/** ロックされた操作を無料ユーザーが触ったときに開く。 */
export function openPaywall(): void {
  ensurePaywallModal().classList.remove("hidden");
  // ネイティブ & キー設定済みのときだけ実価格を非同期で取得して反映する。
  if (useRealIap()) void loadOfferingPrice();
}

function closePaywall(): void {
  paywallEl?.classList.add("hidden");
}

/** 表示中モーダルの価格表示を差し替える。 */
function setPriceText(price: string): void {
  const el = paywallEl?.querySelector(".paywall-price");
  if (el) el.textContent = t("paywall.price", { price });
}

/** offerings から Pro パッケージ (lifetime 優先、無ければ先頭) を選ぶ。 */
function pickProPackage(
  offerings: import("@revenuecat/purchases-capacitor").PurchasesOfferings,
): PurchasesPackage | null {
  const current = offerings.current;
  if (!current) return null;
  return current.lifetime ?? current.availablePackages[0] ?? null;
}

/**
 * RevenueCat の current offering から実価格を取得して表示に反映する。
 * 取得失敗時はプレースホルダ "—" のまま (トーストは出さない)。
 */
async function loadOfferingPrice(): Promise<void> {
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const offerings = await Purchases.getOfferings();
    const pkg = pickProPackage(offerings);
    cachedProPackage = pkg;
    if (pkg) setPriceText(pkg.product.priceString);
  } catch {
    /* offerings 取得失敗時は "—" のまま */
  }
}

/** ユーザー操作から購入をブロックしないよう、多重タップを抑止する。 */
let purchaseInFlight = false;

async function onUpgradeClick(): Promise<void> {
  if (!useRealIap()) return showComingSoonToast();
  if (purchaseInFlight) return;
  purchaseInFlight = true;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    // 価格取得前にタップされた場合に備え、パッケージ未取得なら取り直す。
    let pkg = cachedProPackage;
    if (!pkg) {
      const offerings = await Purchases.getOfferings();
      pkg = pickProPackage(offerings);
      cachedProPackage = pkg;
    }
    if (!pkg) {
      showToast(t("paywall.error"));
      return;
    }
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const active = applyRevenueCatCustomerInfo(customerInfo);
    if (active) {
      closePaywall();
      showToast(t("paywall.purchase.success"));
    } else {
      // 購入自体は完了したが entitlement が取れない (設定ミス等) → エラー扱い。
      showToast(t("paywall.error"));
    }
  } catch (e) {
    // ユーザーキャンセルは黙って何もしない。それ以外はエラートースト。
    if (!isUserCancelled(e)) showToast(t("paywall.error"));
  } finally {
    purchaseInFlight = false;
  }
}

async function onRestoreClick(): Promise<void> {
  if (!useRealIap()) return showComingSoonToast();
  if (purchaseInFlight) return;
  purchaseInFlight = true;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.restorePurchases();
    const active = applyRevenueCatCustomerInfo(customerInfo);
    if (active) {
      closePaywall();
      showToast(t("paywall.restore.success"));
    } else {
      showToast(t("paywall.restore.notFound"));
    }
  } catch {
    showToast(t("paywall.error"));
  } finally {
    purchaseInFlight = false;
  }
}

/** RevenueCat のエラーがユーザーキャンセルか (purchasePackage が reject する形)。 */
function isUserCancelled(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { userCancelled?: unknown }).userCancelled === true
  );
}

// ===== トースト (画面下部の一時通知) =====
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(message: string): void {
  let toast = document.getElementById("paywall-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "paywall-toast";
    toast.className = "paywall-toast hidden";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast?.classList.add("hidden"), 2000);
}

// IAP 未設定時、「アップグレード」「購入を復元」はまだ動かないため「準備中」を出す。
function showComingSoonToast(): void {
  showToast(t("paywall.comingSoon"));
}

/** Escape キーでペイウォールも閉じられるよう main/guide のキーハンドラから使う想定の補助。 */
export function isPaywallOpen(): boolean {
  return !!paywallEl && !paywallEl.classList.contains("hidden");
}

export function closePaywallIfOpen(): void {
  if (isPaywallOpen()) closePaywall();
}
