// ===== アプリ内ダイアログ (入力・確認モーダル) =====
//
// ブラウザ標準の window.prompt / window.confirm は iOS の WKWebView で
// 「capacitor://localhost」の見出しやシステム既定の見た目が出て浮いてしまう。
// 既存のガイド・ペイウォールと同じダークモーダルで統一する。
import { escapeHtml } from "./html.js";
import { t } from "./i18n.js";

export interface PromptModalOptions {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  maxLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

let activeDismiss: (() => void) | null = null;

function mountDialog(
  title: string,
  bodyHtml: string,
  onClose: () => void,
): { modal: HTMLDivElement; cleanup: () => void } {
  // 万一前のダイアログが残っていたらキャンセル扱いで閉じてから開く
  if (activeDismiss) activeDismiss();

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const modal = document.createElement("div");
  modal.id = "app-dialog-modal";
  modal.className = "guide-modal dialog-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "dialog-modal-title");
  modal.innerHTML = `
    <div class="guide-modal-content dialog-modal-content">
      <div class="guide-modal-header">
        <h3 id="dialog-modal-title">${escapeHtml(title)}</h3>
        <button type="button" class="guide-modal-close" data-dialog-cancel aria-label="${escapeHtml(t("dialog.close.aria"))}">✕</button>
      </div>
      <div class="guide-modal-body dialog-modal-body">
        ${bodyHtml}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let closed = false;
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };
  const onBackdropClick = (event: MouseEvent): void => {
    if (event.target === modal) onClose();
  };
  document.addEventListener("keydown", onKeyDown);
  modal.addEventListener("click", onBackdropClick);

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    if (activeDismiss === onClose) activeDismiss = null;
    document.removeEventListener("keydown", onKeyDown);
    modal.removeEventListener("click", onBackdropClick);
    modal.remove();
    if (previousFocus && document.contains(previousFocus)) {
      previousFocus.focus();
    }
  };

  activeDismiss = onClose;
  return { modal, cleanup };
}

/**
 * 1行テキスト入力のアプリ内モーダル。
 * 保存を押すと前後の空白を除いた文字列を返し、キャンセル・背景タップ・Escape は null。
 */
export function openPromptModal(options: PromptModalOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const confirmLabel = options.confirmLabel ?? t("dialog.save");
    const cancelLabel = options.cancelLabel ?? t("dialog.cancel");
    const maxAttr = options.maxLength ? ` maxlength="${options.maxLength}"` : "";
    const placeholderAttr = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : "";

    let settled = false;
    let cleanup = (): void => {};
    const finish = (value: string | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const bodyHtml = `
      <form class="dialog-modal-form" novalidate>
        <input type="text" class="dialog-modal-input" id="dialog-prompt-input" value="${escapeHtml(options.defaultValue ?? "")}"${placeholderAttr}${maxAttr} autocomplete="off" />
        <div class="dialog-modal-actions">
          <button type="button" class="workspace-secondary dialog-btn-cancel" data-dialog-cancel>${escapeHtml(cancelLabel)}</button>
          <button type="submit" class="workspace-primary dialog-btn-confirm" id="dialog-confirm-btn">${escapeHtml(confirmLabel)}</button>
        </div>
      </form>
    `;

    const mounted = mountDialog(options.title, bodyHtml, () => finish(null));
    cleanup = mounted.cleanup;

    const form = mounted.modal.querySelector<HTMLFormElement>(".dialog-modal-form");
    const input = mounted.modal.querySelector<HTMLInputElement>("#dialog-prompt-input");
    const confirmBtn = mounted.modal.querySelector<HTMLButtonElement>("#dialog-confirm-btn");

    const syncSubmitState = (): void => {
      if (!confirmBtn || !input) return;
      confirmBtn.disabled = input.value.trim().length === 0;
    };
    syncSubmitState();
    input?.addEventListener("input", syncSubmitState);

    mounted.modal.querySelectorAll<HTMLButtonElement>("[data-dialog-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => finish(null));
    });

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const trimmed = input?.value.trim() ?? "";
      if (!trimmed) return;
      finish(trimmed);
    });

    input?.focus();
    if (options.defaultValue) input?.select();
  });
}

/**
 * 確認用のアプリ内モーダル。確定で true、キャンセル・背景タップ・Escape で false。
 */
export function openConfirmModal(options: ConfirmModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmLabel = options.confirmLabel ?? t("dialog.ok");
    const cancelLabel = options.cancelLabel ?? t("dialog.cancel");

    let settled = false;
    let cleanup = (): void => {};
    const finish = (accepted: boolean): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(accepted);
    };

    const confirmCls = options.danger ? "dialog-btn-danger" : "workspace-primary";
    const bodyHtml = `
      <p class="dialog-modal-message">${escapeHtml(options.message)}</p>
      <div class="dialog-modal-actions">
        <button type="button" class="workspace-secondary dialog-btn-cancel" data-dialog-cancel>${escapeHtml(cancelLabel)}</button>
        <button type="button" class="${confirmCls} dialog-btn-confirm" id="dialog-confirm-btn">${escapeHtml(confirmLabel)}</button>
      </div>
    `;

    const mounted = mountDialog(options.title, bodyHtml, () => finish(false));
    cleanup = mounted.cleanup;

    mounted.modal.querySelectorAll<HTMLButtonElement>("[data-dialog-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => finish(false));
    });
    const confirmBtn = mounted.modal.querySelector<HTMLButtonElement>("#dialog-confirm-btn");
    confirmBtn?.addEventListener("click", () => finish(true));
    // 破壊的操作 (danger) は誤爆防止でキャンセル側へフォーカスを置く
    const initialFocus = options.danger
      ? mounted.modal.querySelector<HTMLButtonElement>(".dialog-btn-cancel")
      : confirmBtn;
    initialFocus?.focus();
  });
}
