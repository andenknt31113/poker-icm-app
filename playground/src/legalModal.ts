// ===== 利用規約・プライバシーポリシーモーダル =====
// guide.ts (❓ガイド・footer) と paywall.ts (課金画面下部リンク) の両方から開くため、
// 循環 import を避けて独立モジュールに分離している。
import { t, getLang } from "./i18n.js";
import { LEGAL_CONTENT_HTML } from "./legalContent.js";

let legalModalEl: HTMLDivElement | null = null;
let keydownBound = false;

function ensureLegalModal(): HTMLDivElement {
  if (legalModalEl && legalModalEl.isConnected) return legalModalEl;
  const modal = document.createElement("div");
  modal.id = "legal-modal";
  modal.className = "guide-modal legal-modal hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "legal-modal-title");
  modal.innerHTML = `
    <div class="guide-modal-content">
      <div class="guide-modal-header">
        <h3 id="legal-modal-title">${t("legal.title")}</h3>
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
  if (!keydownBound) {
    keydownBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLegalModal();
    });
  }
  legalModalEl = modal;
  return modal;
}

export function openLegalModal(): void {
  ensureLegalModal().classList.remove("hidden");
}

export function closeLegalModal(): void {
  legalModalEl?.classList.add("hidden");
}
