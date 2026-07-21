// ===== ペイウォール (Pro 機能のロック時に出すモーダルシート) =====
//
// freemium ゲート (Phase 1) の UI 側。ロックされた操作 (スタック編集・
// プレイヤー追加/削除・ランダム化・ペイ構造編集・シナリオ保存) を無料ユーザーが
// 触ったとき openPaywall() で開く。既存の .guide-modal と同じトーンの
// モーダルシートで、1 タップで閉じられる (過剰に押し付けない)。
//
// 価格は Phase 1 ではプレースホルダ表示。Capacitor (ネイティブ) では
// 「アップグレード」「購入を復元」ボタンを出し、いずれもタップで「準備中」
// トーストを出すだけ (実 IAP は Phase 3 で RevenueCat に接続)。
// Web ではストア購入ができないため「アプリ版で利用可能」の案内文言を出す。
import { t } from "./i18n.js";
import { isCapacitorNative } from "./capacitorEnv.js";

// Phase 3 で RevenueCat の実価格 (getOfferings) に差し替えるプレースホルダ。
const PRICE_PLACEHOLDER = "—";

let paywallEl: HTMLDivElement | null = null;

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
  modal.querySelector("#paywall-upgrade")?.addEventListener("click", () => showComingSoonToast());
  modal.querySelector("#paywall-restore")?.addEventListener("click", () => showComingSoonToast());
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
}

function closePaywall(): void {
  paywallEl?.classList.add("hidden");
}

// Phase 1 では「アップグレード」「購入を復元」はまだ動かないため、
// タップで「準備中」トーストを出すだけ (実装は Phase 3)。
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showComingSoonToast(): void {
  let toast = document.getElementById("paywall-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "paywall-toast";
    toast.className = "paywall-toast hidden";
    document.body.appendChild(toast);
  }
  toast.textContent = t("paywall.comingSoon");
  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast?.classList.add("hidden"), 2000);
}

/** Escape キーでペイウォールも閉じられるよう main/guide のキーハンドラから使う想定の補助。 */
export function isPaywallOpen(): boolean {
  return !!paywallEl && !paywallEl.classList.contains("hidden");
}

export function closePaywallIfOpen(): void {
  if (isPaywallOpen()) closePaywall();
}
