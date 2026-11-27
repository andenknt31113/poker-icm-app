import { applyTab, getActiveTab } from "./tabs.js";
import { t } from "./i18n.js";
import { STORAGE_KEYS, readFlag, writeFlag } from "./storage.js";
import { isPro } from "./entitlement.js";
import { openPaywall } from "./paywall.js";
import { openLegalModal } from "./legalModal.js";
import { APP_STORE_REVIEW_URL } from "./reviewPrompt.js";

export { openLegalModal } from "./legalModal.js";

// ===== オンボーディング（初回ガイド）& 使い方ガイド =====

export function isOnboardingDone(): boolean {
  return readFlag(STORAGE_KEYS.onboardingDone);
}
function markOnboardingDone(): void {
  writeFlag(STORAGE_KEYS.onboardingDone, true);
}
function isFirstHintDismissed(): boolean {
  return readFlag(STORAGE_KEYS.firstHintDismissed);
}
function markFirstHintDismissed(): void {
  writeFlag(STORAGE_KEYS.firstHintDismissed, true);
}

// 初回ヒントバーを出すかどうかは起動時点で確定させる。
// オンボーディング未完了 (= まだ一度も閉じていない) の間はずっと true になり、
// 完了直後の同一セッションでも引き続き表示される。次回起動時は done フラグにより非表示。
const shouldShowFirstHint = !isOnboardingDone() && !isFirstHintDismissed();

const ONBOARDING_STEPS: { title: string; body: string }[] = [
  {
    title: t("onboarding.step1.title"),
    body: t("onboarding.step1.body"),
  },
  {
    title: t("onboarding.step2.title"),
    body: t("onboarding.step2.body"),
  },
];

let onboardingStep = 0;
let onboardingModalEl: HTMLDivElement | null = null;

function ensureOnboardingModal(): HTMLDivElement {
  if (onboardingModalEl) return onboardingModalEl;
  const modal = document.createElement("div");
  modal.id = "onboarding-modal";
  modal.className = "onboarding-modal hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "onboarding-title");
  modal.innerHTML = `
    <div class="onboarding-modal-content">
      <div class="onboarding-modal-header">
        <h3 id="onboarding-title"></h3>
        <button type="button" class="onboarding-skip" id="onboarding-skip">${t("onboarding.skip")}</button>
      </div>
      <div class="onboarding-modal-body" id="onboarding-body"></div>
      <div class="onboarding-modal-footer">
        <div class="onboarding-dots" id="onboarding-dots"></div>
        <div id="onboarding-footer-actions"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeOnboardingModal();
  });
  modal.querySelector("#onboarding-skip")?.addEventListener("click", () => {
    closeOnboardingModal();
  });
  onboardingModalEl = modal;
  return modal;
}

function renderOnboardingStep(): void {
  const modal = ensureOnboardingModal();
  const step = ONBOARDING_STEPS[onboardingStep];
  if (!step) return;
  const title = modal.querySelector("#onboarding-title");
  const body = modal.querySelector("#onboarding-body");
  const dots = modal.querySelector("#onboarding-dots");
  const footerActions = modal.querySelector("#onboarding-footer-actions");
  if (title) title.textContent = step.title;
  if (body) body.innerHTML = step.body;
  if (dots) {
    dots.innerHTML = ONBOARDING_STEPS.map(
      (_, i) => `<span class="onboarding-dot${i === onboardingStep ? " active" : ""}"></span>`,
    ).join("");
  }
  if (footerActions) {
    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
      footerActions.innerHTML = `<button type="button" class="solve-btn onboarding-next-btn" id="onboarding-next-btn">${t("onboarding.next")}</button>`;
      footerActions.querySelector("#onboarding-next-btn")?.addEventListener("click", () => {
        onboardingStep++;
        renderOnboardingStep();
      });
    } else {
      footerActions.innerHTML = `
        <div class="onboarding-cta-row">
          <button type="button" class="solve-btn" id="onboarding-cta-practice" data-feature="practice">${t("onboarding.cta.practice")}</button>
          <button type="button" class="solve-btn onboarding-cta-setup" id="onboarding-cta-setup">${t("onboarding.cta.setup")}</button>
        </div>
      `;
      footerActions.querySelector("#onboarding-cta-practice")?.addEventListener("click", () => {
        closeOnboardingModal();
        applyTab("practice");
      });
      footerActions.querySelector("#onboarding-cta-setup")?.addEventListener("click", () => {
        closeOnboardingModal();
      });
    }
  }
}

export function openOnboardingModal(): void {
  onboardingStep = 0;
  const modal = ensureOnboardingModal();
  renderOnboardingStep();
  modal.classList.remove("hidden");
}

function closeOnboardingModal(): void {
  onboardingModalEl?.classList.add("hidden");
  markOnboardingDone();
  // 初回案内を閉じた直後に「サンプル」札が残らないよう、その場で外す
  document.querySelector(".hero-summary-sample-badge")?.remove();
}

// ===== 使い方ガイド（? ボタン、常設） =====
let guideModalEl: HTMLDivElement | null = null;

/**
 * ガイド冒頭に出す「どこまで無料か」の注記と、常設の Pro / 購入復元入口。
 * 価格はここに書かない (ストア/offerings 由来の表示に一元化する)。
 */
function proNoteHtml(): string {
  return `
    <div class="guide-pro-note">
      <p class="guide-pro-note-text">${t("guide.proNote.html")}</p>
      <button type="button" class="guide-pro-btn" id="guide-pro-btn"${isPro() ? " hidden" : ""}>${t("guide.proBtn")}</button>
    </div>`;
}

function syncGuideProButton(): void {
  const btn = guideModalEl?.querySelector<HTMLButtonElement>("#guide-pro-btn");
  if (btn) btn.hidden = isPro();
}

function ensureGuideModal(): HTMLDivElement {
  if (guideModalEl) return guideModalEl;
  const modal = document.createElement("div");
  modal.id = "guide-modal";
  modal.className = "guide-modal hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "guide-modal-title");
  modal.innerHTML = `
    <div class="guide-modal-content">
      <div class="guide-modal-header">
        <h3 id="guide-modal-title">${t("guide.title")}</h3>
        <button type="button" class="guide-modal-close" id="guide-modal-close" aria-label="${t("guide.close.aria")}">✕</button>
      </div>
      <div class="guide-modal-body">
        ${proNoteHtml()}
        ${t("guide.body.html")}
        <a class="guide-review-link" id="guide-review-link" href="${APP_STORE_REVIEW_URL}" target="_blank" rel="noopener noreferrer">${t("guide.reviewLink")}</a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#guide-modal-close")?.addEventListener("click", closeGuideModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeGuideModal();
  });
  modal.querySelector("#guide-pro-btn")?.addEventListener("click", () => {
    closeGuideModal();
    openPaywall("guide");
  });
  modal.querySelector("#guide-reopen-onboarding-btn")?.addEventListener("click", () => {
    closeGuideModal();
    openOnboardingModal();
  });
  modal.querySelector("#guide-legal-link")?.addEventListener("click", () => {
    openLegalModal();
  });
  guideModalEl = modal;
  return modal;
}

function openGuideModal(): void {
  ensureGuideModal().classList.remove("hidden");
  syncGuideProButton();
}
/** 使い方ガイドを開き、指定した節 (details の id) を開いてそこまでスクロールする。 */
export function openGuideAt(sectionId: string): void {
  const modal = ensureGuideModal();
  modal.classList.remove("hidden");
  syncGuideProButton();
  const section = modal.querySelector<HTMLDetailsElement>(`#${sectionId}`);
  if (!section) return;
  section.open = true;
  section.scrollIntoView({ block: "start" });
}
function closeGuideModal(): void {
  guideModalEl?.classList.add("hidden");
}

// ===== 初回ヒントバー（局面カードの直上。PKO / 4人バブルへの 1 タップ導線付き） =====
function insertFirstHintBar(): void {
  if (!shouldShowFirstHint) return;
  const firstSetupCard = document.querySelector('section.card[data-tab="analyze"]');
  if (!firstSetupCard || !firstSetupCard.parentElement) return;
  const bar = document.createElement("div");
  bar.id = "first-hint-bar";
  bar.className = "first-hint-bar";
  bar.dataset.tab = "analyze";
  bar.classList.toggle("hidden-tab", getActiveTab() !== "analyze");

  const body = document.createElement("div");
  body.className = "first-hint-body";
  const text = document.createElement("span");
  text.innerHTML = t("firstHint.html");
  const actions = document.createElement("div");
  actions.className = "first-hint-actions";
  actions.innerHTML = `
    <button type="button" class="first-hint-chip is-pko" data-quick-scenario="ft6Pko">${t("firstHint.tryPko")}</button>
    <button type="button" class="first-hint-chip" data-quick-scenario="ftBubble">${t("firstHint.tryBubble")}</button>
  `;
  actions.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-quick-scenario]");
    const id = btn?.dataset.quickScenario;
    if (!id) return;
    document.querySelector<HTMLButtonElement>(`.scenario-btn[data-scenario="${id}"]`)?.click();
  });
  body.appendChild(text);
  body.appendChild(actions);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "first-hint-bar-close";
  closeBtn.setAttribute("aria-label", t("firstHint.close.aria"));
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => {
    bar.remove();
    markFirstHintDismissed();
  });
  bar.appendChild(body);
  bar.appendChild(closeBtn);
  firstSetupCard.parentElement.insertBefore(bar, firstSetupCard);
}

/** ガイド関連 (?ボタン・初回ヒントバー・Escape キー) の配線。main.ts から一度だけ呼ぶ。 */
export function initGuide(): void {
  document.getElementById("help-btn")?.addEventListener("click", openGuideModal);
  document.getElementById("open-limits")?.addEventListener("click", () => openGuideAt("guide-limits"));
  document.getElementById("footer-legal-link")?.addEventListener("click", () => {
    openLegalModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // 規約モーダルが最前面にある間はそちらの Escape ハンドラに任せる。
    const legal = document.getElementById("legal-modal");
    if (legal && !legal.classList.contains("hidden")) return;
    if (onboardingModalEl && !onboardingModalEl.classList.contains("hidden")) closeOnboardingModal();
    if (guideModalEl && !guideModalEl.classList.contains("hidden")) closeGuideModal();
  });

  insertFirstHintBar();
}
