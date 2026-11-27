// ===== ペイウォール (Pro 機能のロック時・常設 Pro 入口から出すモーダルシート) =====
//
// freemium ゲートの UI 側。ロックされた操作やヘッダー / ガイドの Pro 入口から
// openPaywall(trigger) で開く。トリガーに応じた見出し・サブコピーと、
// 実測値ベースの Before/After ミニ比較カード・ROI 訴求・規約リンクを表示する。
// 既存の .guide-modal と同じトーンで 1 タップ離脱可能。
//
// 価格・購入・匿名表示計測は 2 段構え:
//   - IAP 未設定 (iapConfig の公開キーが空) or web: 価格はプレースホルダ "—"、
//     「アップグレード」「購入を復元」はタップで「準備中」トーストのみ。
//     @revenuecat/purchases-capacitor は一切 dynamic import しない。
//   - ネイティブ (iOS) かつ IAP 設定済み: 起動時に preloadOfferingPrice() で価格を先読みし、
//     openPaywall(trigger) 時に Purchases.trackCustomPaywallImpression で匿名表示計測を送る。
//
// 重要: このモジュールは @revenuecat/purchases-capacitor を静的 import しない。
import { t } from "./i18n.js";
import { isCapacitorNative } from "./capacitorEnv.js";
import { isIapConfigured } from "./iapConfig.js";
import { applyRevenueCatCustomerInfo, ensurePurchasesConfigured } from "./entitlement.js";
import { hapticSuccess } from "./haptics.js";
import { openLegalModal } from "./legalModal.js";
import { notePaywallDismissedForReview, noteProPurchasedForReview } from "./reviewPrompt.js";

export type PaywallTrigger = "players" | "payouts" | "bounty" | "save" | "header" | "guide";

// RevenueCat から実価格を取得できないあいだの価格プレースホルダ。
const PRICE_PLACEHOLDER = "—";

// 型のみの参照 (import(...) 型構文はコンパイル時に消去され、実行時 import を生まない)。
type PurchasesModule = typeof import("@revenuecat/purchases-capacitor");
type PurchasesOffering = import("@revenuecat/purchases-capacitor").PurchasesOffering;
type PurchasesPackage = import("@revenuecat/purchases-capacitor").PurchasesPackage;

let paywallEl: HTMLDivElement | null = null;
// 表示中の offering と Pro パッケージ (価格先読み & 購入対象 & 匿名表示計測の文脈に使う)。
let cachedOffering: PurchasesOffering | null = null;
let cachedProPackage: PurchasesPackage | null = null;
let cachedPriceString: string | null = null;
let offeringLoadPromise: Promise<void> | null = null;
let purchasesModPromise: Promise<PurchasesModule> | null = null;
let keydownBound = false;

/** 実 IAP フロー (ネイティブ & キー設定済み) を使うか。 */
function useRealIap(): boolean {
  return isCapacitorNative() && isIapConfigured();
}

/** @revenuecat/purchases-capacitor を 1 度だけ dynamic import して共有する (haptics.ts と同流儀)。 */
function loadPurchases(): Promise<PurchasesModule> {
  if (!purchasesModPromise) {
    purchasesModPromise = import("@revenuecat/purchases-capacitor").catch((err) => {
      purchasesModPromise = null;
      throw err;
    });
  }
  return purchasesModPromise;
}

/** トリガーに応じて、関連度の高い実測 Before/After 比較カードを上段・強調にして描画する。 */
function renderCompareCardsHtml(trigger: PaywallTrigger): string {
  const pkoCard = `
    <div class="paywall-compare-card${trigger === "bounty" ? " is-featured" : ""}">
      <div class="paywall-compare-label">${t("paywall.compare.pko.label")}</div>
      <div class="paywall-compare-row">
        <span class="paywall-compare-before">${t("paywall.compare.pko.before")}</span>
        <span class="paywall-compare-arrow" aria-hidden="true">→</span>
        <span class="paywall-compare-after good">${t("paywall.compare.pko.after")}</span>
        <span class="paywall-compare-delta good">${t("paywall.compare.pko.delta")}</span>
      </div>
    </div>`;
  const bubbleCard = `
    <div class="paywall-compare-card${trigger !== "bounty" ? " is-featured" : ""}">
      <div class="paywall-compare-label">${t("paywall.compare.bubble9.label")}</div>
      <div class="paywall-compare-row">
        <span class="paywall-compare-before">${t("paywall.compare.bubble9.before")}</span>
        <span class="paywall-compare-arrow" aria-hidden="true">→</span>
        <span class="paywall-compare-after warn">${t("paywall.compare.bubble9.after")}</span>
        <span class="paywall-compare-delta warn">${t("paywall.compare.bubble9.delta")}</span>
      </div>
    </div>`;
  return trigger === "bounty" ? `${pkoCard}${bubbleCard}` : `${bubbleCard}${pkoCard}`;
}

function updatePaywallContext(modal: HTMLDivElement, trigger: PaywallTrigger): void {
  modal.dataset.trigger = trigger;
  const titleEl = modal.querySelector("#paywall-title");
  if (titleEl) titleEl.textContent = t(`paywall.trigger.${trigger}.title`);
  const leadEl = modal.querySelector(".paywall-lead");
  if (leadEl) leadEl.textContent = t(`paywall.trigger.${trigger}.lead`);
  const compareEl = modal.querySelector(".paywall-compare");
  if (compareEl) compareEl.innerHTML = renderCompareCardsHtml(trigger);
  if (cachedPriceString) setPriceText(cachedPriceString);
}

function ensurePaywallModal(): HTMLDivElement {
  if (paywallEl && paywallEl.isConnected) return paywallEl;
  const modal = document.createElement("div");
  modal.id = "paywall-modal";
  modal.className = "guide-modal paywall-modal hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "paywall-title");

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
        <h3 id="paywall-title">${t("paywall.title")}</h3>
        <button type="button" class="guide-modal-close" id="paywall-close" aria-label="${t("paywall.close.aria")}">✕</button>
      </div>
      <div class="guide-modal-body">
        <p class="paywall-lead">${t("paywall.lead")}</p>
        <div class="paywall-compare" aria-label="${t("paywall.compare.aria")}"></div>
        <ul class="paywall-features">
          <li>${t("paywall.feature.editStacks")}</li>
          <li>${t("paywall.feature.replay")}</li>
          <li>${t("paywall.feature.save")}</li>
          <li>${t("paywall.feature.bounty")}</li>
        </ul>
        <p class="paywall-roi">${t("paywall.roi")}</p>
        <p class="paywall-price">${t("paywall.price", { price: cachedPriceString ?? PRICE_PLACEHOLDER })}</p>
        <p class="paywall-one-time">${t("paywall.oneTimeNote")}</p>
        ${actionsHtml}
        <button type="button" class="paywall-legal-link" id="paywall-legal-link">${t("paywall.legalLink")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#paywall-close")?.addEventListener("click", () => closePaywall(false));
  // 背景 (オーバーレイ) タップで閉じる = 1 タップで離脱できる。
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closePaywall(false);
  });
  modal.querySelector("#paywall-upgrade")?.addEventListener("click", onUpgradeClick);
  modal.querySelector("#paywall-restore")?.addEventListener("click", onRestoreClick);
  modal.querySelector("#paywall-legal-link")?.addEventListener("click", () => openLegalModal());
  // Escape で閉じる (他モーダルと同じ挙動)。
  if (!keydownBound) {
    keydownBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePaywallIfOpen();
    });
  }

  paywallEl = modal;
  return modal;
}

/**
 * 起動時に RevenueCat の current offering 価格を先読みする。
 * ペイウォール初回表示時の "—" チラつきを抑止するため、main.ts から fire-and-forget で呼ぶ。
 * 非ネイティブ / IAP 未設定時は @revenuecat を一切 import しない。
 */
export function preloadOfferingPrice(): Promise<void> {
  if (!useRealIap()) return Promise.resolve();
  return loadOfferingPrice();
}

/** ロックされた操作や常設 Pro 入口からペイウォールを開く。 */
export function openPaywall(trigger: PaywallTrigger = "header"): void {
  const wasOpen = isPaywallOpen();
  const modal = ensurePaywallModal();
  updatePaywallContext(modal, trigger);
  modal.classList.remove("hidden");
  // ネイティブ & キー設定済みのときだけ実価格を取得・匿名表示計測を送る。
  if (useRealIap()) {
    if (!cachedProPackage) void loadOfferingPrice();
    if (!wasOpen) void trackPaywallImpression(trigger);
  }
}

function closePaywall(completedPurchaseOrRestore = false): void {
  if (!isPaywallOpen()) return;
  paywallEl?.classList.add("hidden");
  if (!completedPurchaseOrRestore) notePaywallDismissedForReview();
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
 * RevenueCat の current offering から実価格を取得してキャッシュ・表示に反映する。
 * 並行呼び出しは 1 本にまとめ、取得失敗時はプレースホルダ "—" のまま (トーストは出さない)。
 */
function loadOfferingPrice(): Promise<void> {
  if (!useRealIap()) return Promise.resolve();
  if (offeringLoadPromise) return offeringLoadPromise;
  offeringLoadPromise = (async () => {
    try {
      if (!(await ensurePurchasesConfigured())) return;
      const { Purchases } = await loadPurchases();
      const offerings = await Purchases.getOfferings();
      cachedOffering = offerings.current ?? null;
      const pkg = pickProPackage(offerings);
      cachedProPackage = pkg;
      if (pkg) {
        cachedPriceString = pkg.product.priceString;
        setPriceText(pkg.product.priceString);
      }
    } catch {
      /* offerings 取得失敗時は "—" のまま */
    } finally {
      offeringLoadPromise = null;
    }
  })();
  return offeringLoadPromise;
}

/**
 * ペイウォール表示を RevenueCat へ匿名送信する (個人情報非紐付け・広告トラッキングなし)。
 * ネイティブ & IAP 設定済み時のみ実行し、失敗は完全に無視する。
 */
async function trackPaywallImpression(trigger: PaywallTrigger): Promise<void> {
  if (!useRealIap()) return;
  try {
    if (!(await ensurePurchasesConfigured())) return;
    const { Purchases } = await loadPurchases();
    if (typeof Purchases.trackCustomPaywallImpression !== "function") return;
    await Purchases.trackCustomPaywallImpression({
      paywallId: `pro_${trigger}`,
      ...(cachedOffering ? { offering: cachedOffering } : {}),
    });
  } catch {
    /* 計測失敗時は何もしない */
  }
}

/** ユーザー操作から購入をブロックしないよう、多重タップを抑止する。 */
let purchaseInFlight = false;

function setBusy(busy: boolean): void {
  purchaseInFlight = busy;
  const upgrade = paywallEl?.querySelector<HTMLButtonElement>("#paywall-upgrade");
  const restore = paywallEl?.querySelector<HTMLButtonElement>("#paywall-restore");
  for (const btn of [upgrade, restore]) {
    if (!btn) continue;
    btn.disabled = busy;
    btn.setAttribute("aria-busy", String(busy));
  }
}

async function onUpgradeClick(): Promise<void> {
  if (!useRealIap()) return showComingSoonToast();
  if (purchaseInFlight) return;
  setBusy(true);
  try {
    if (!(await ensurePurchasesConfigured())) {
      showToast(t("paywall.error"));
      return;
    }
    const { Purchases } = await loadPurchases();
    // 価格取得前にタップされた場合に備え、パッケージ未取得なら取り直す。
    let pkg = cachedProPackage;
    if (!pkg) {
      const offerings = await Purchases.getOfferings();
      cachedOffering = offerings.current ?? null;
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
      hapticSuccess();
      closePaywall(true);
      showToast(t("paywall.purchase.success"));
      noteProPurchasedForReview();
    } else {
      // 購入自体は完了したが entitlement が取れない (設定ミス等) → エラー扱い。
      showToast(t("paywall.error"));
    }
  } catch (e) {
    // ユーザーキャンセルは黙って何もしない。それ以外はエラートースト。
    if (!isUserCancelled(e)) showToast(t("paywall.error"));
  } finally {
    setBusy(false);
  }
}

async function onRestoreClick(): Promise<void> {
  if (!useRealIap()) return showComingSoonToast();
  if (purchaseInFlight) return;
  setBusy(true);
  try {
    if (!(await ensurePurchasesConfigured())) {
      showToast(t("paywall.error"));
      return;
    }
    const { Purchases } = await loadPurchases();
    const { customerInfo } = await Purchases.restorePurchases();
    const active = applyRevenueCatCustomerInfo(customerInfo);
    if (active) {
      hapticSuccess();
      closePaywall(true);
      showToast(t("paywall.restore.success"));
    } else {
      showToast(t("paywall.restore.notFound"));
    }
  } catch {
    showToast(t("paywall.error"));
  } finally {
    setBusy(false);
  }
}

/**
 * RevenueCat のエラーがユーザーキャンセルか (purchasePackage が reject する形)。
 * SDK のバージョン/ブリッジにより reject 形が揺れるため、複数のシグナルを見る:
 *   - userCancelled === true (hybrid SDK が付与するフラグ)
 *   - code が PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR (= 1 / "1") か
 *     "PURCHASE_CANCELLED" を含む文字列
 */
function isUserCancelled(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const err = e as { userCancelled?: unknown; code?: unknown; errorCode?: unknown };
  if (err.userCancelled === true) return true;
  for (const c of [err.code, err.errorCode]) {
    if (c === 1 || c === "1") return true;
    if (typeof c === "string" && c.toUpperCase().includes("PURCHASE_CANCELLED")) return true;
  }
  return false;
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

// ===== Escape キーでの閉じ操作 =====
function isPaywallOpen(): boolean {
  return !!paywallEl && !paywallEl.classList.contains("hidden");
}

function closePaywallIfOpen(): void {
  // 規約モーダルが上に重なっている間は、そちらの Escape ハンドラに任せる。
  const legal = document.getElementById("legal-modal");
  if (legal && !legal.classList.contains("hidden")) return;
  if (isPaywallOpen()) closePaywall(false);
}
