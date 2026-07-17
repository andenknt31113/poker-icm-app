import { applyTab, getActiveTab } from "./tabs.js";
import { t, getLang } from "./i18n.js";
import { LEGAL_CONTENT_HTML, LEGAL_CONTENT_TITLE } from "./legalContent.js";

// ===== オンボーディング（初回ガイド）& 使い方ガイド =====
const ONBOARDING_DONE_KEY = "poker-icm-onboarding-done";
const FIRST_HINT_DISMISSED_KEY = "poker-icm-first-hint-dismissed";

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}
function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}
function isFirstHintDismissed(): boolean {
  try {
    return localStorage.getItem(FIRST_HINT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}
function markFirstHintDismissed(): void {
  try {
    localStorage.setItem(FIRST_HINT_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
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
  {
    title: t("onboarding.step3.title"),
    body: t("onboarding.step3.body"),
  },
];

let onboardingStep = 0;
let onboardingModalEl: HTMLDivElement | null = null;

function ensureOnboardingModal(): HTMLDivElement {
  if (onboardingModalEl) return onboardingModalEl;
  const modal = document.createElement("div");
  modal.id = "onboarding-modal";
  modal.className = "onboarding-modal hidden";
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
          <button type="button" class="solve-btn" id="onboarding-cta-practice">${t("onboarding.cta.practice")}</button>
          <button type="button" class="solve-btn" id="onboarding-cta-setup" style="background: var(--card); color: var(--text); border: 1px solid var(--border);">${t("onboarding.cta.setup")}</button>
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
}

// ===== 使い方ガイド（❓ ボタン、常設） =====
let guideModalEl: HTMLDivElement | null = null;

function ensureGuideModal(): HTMLDivElement {
  if (guideModalEl) return guideModalEl;
  const modal = document.createElement("div");
  modal.id = "guide-modal";
  modal.className = "guide-modal hidden";
  modal.innerHTML = `
    <div class="guide-modal-content">
      <div class="guide-modal-header">
        <h3>${t("guide.title")}</h3>
        <button type="button" class="guide-modal-close" id="guide-modal-close" aria-label="${t("guide.close.aria")}">✕</button>
      </div>
      <div class="guide-modal-body">${t("guide.body.html")}</div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#guide-modal-close")?.addEventListener("click", closeGuideModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeGuideModal();
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
}
function closeGuideModal(): void {
  guideModalEl?.classList.add("hidden");
}

// ===== 利用規約・プライバシーポリシー（❓ガイド最下部・footer から開く） =====
let legalModalEl: HTMLDivElement | null = null;

function ensureLegalModal(): HTMLDivElement {
  if (legalModalEl) return legalModalEl;
  const modal = document.createElement("div");
  modal.id = "legal-modal";
  modal.className = "guide-modal hidden";
  modal.innerHTML = `
    <div class="guide-modal-content">
      <div class="guide-modal-header">
        <h3>${LEGAL_CONTENT_TITLE}</h3>
        <button type="button" class="guide-modal-close" id="legal-modal-close" aria-label="${t("guide.close.aria")}">✕</button>
      </div>
      <div class="guide-modal-body legal-modal-body">
        ${getLang() === "en" ? `<p class="legal-en-note"><strong>${t("legal.enOnlyNote")}</strong></p>` : ""}
        ${LEGAL_CONTENT_HTML}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#legal-modal-close")?.addEventListener("click", closeLegalModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeLegalModal();
  });
  legalModalEl = modal;
  return modal;
}

export function openLegalModal(): void {
  ensureLegalModal().classList.remove("hidden");
}
function closeLegalModal(): void {
  legalModalEl?.classList.add("hidden");
}

// ===== 初回ヒントバー（セットアップタブ最上部、シナリオプリセットの上） =====
function insertFirstHintBar(): void {
  if (!shouldShowFirstHint) return;
  const firstSetupCard = document.querySelector('section.card[data-tab="setup"]');
  if (!firstSetupCard || !firstSetupCard.parentElement) return;
  const bar = document.createElement("div");
  bar.id = "first-hint-bar";
  bar.className = "first-hint-bar";
  bar.dataset.tab = "setup";
  bar.classList.toggle("hidden-tab", getActiveTab() !== "setup");
  const text = document.createElement("span");
  text.innerHTML = t("firstHint.html");
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "first-hint-bar-close";
  closeBtn.setAttribute("aria-label", t("firstHint.close.aria"));
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => {
    bar.remove();
    markFirstHintDismissed();
  });
  bar.appendChild(text);
  bar.appendChild(closeBtn);
  firstSetupCard.parentElement.insertBefore(bar, firstSetupCard);
}

/** ガイド関連 (❓ボタン・初回ヒントバー・Escape キー) の配線。main.ts から一度だけ呼ぶ。 */
export function initGuide(): void {
  document.getElementById("help-btn")?.addEventListener("click", openGuideModal);
  document.getElementById("footer-legal-link")?.addEventListener("click", () => {
    openLegalModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (onboardingModalEl && !onboardingModalEl.classList.contains("hidden")) closeOnboardingModal();
    if (guideModalEl && !guideModalEl.classList.contains("hidden")) closeGuideModal();
    if (legalModalEl && !legalModalEl.classList.contains("hidden")) closeLegalModal();
  });

  insertFirstHintBar();
}
