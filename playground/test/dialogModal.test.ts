// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { openConfirmModal, openPromptModal } from "../src/dialogModal.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("openPromptModal", () => {
  it("空欄のあいだは保存ボタンを無効にし、入力後の送信で前後空白を除いた値を返す", async () => {
    const promise = openPromptModal({
      title: "保存する名前",
      placeholder: "例: JOPT",
      maxLength: 24,
    });
    const modal = document.getElementById("app-dialog-modal");
    expect(modal?.getAttribute("role")).toBe("dialog");
    expect(modal?.getAttribute("aria-modal")).toBe("true");

    const input = document.getElementById("dialog-prompt-input") as HTMLInputElement;
    const confirmBtn = document.getElementById("dialog-confirm-btn") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    input.value = "   ";
    input.dispatchEvent(new Event("input"));
    expect(confirmBtn.disabled).toBe(true);

    input.value = "  My Spot  ";
    input.dispatchEvent(new Event("input"));
    expect(confirmBtn.disabled).toBe(false);

    confirmBtn.closest("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await expect(promise).resolves.toBe("My Spot");
    expect(document.getElementById("app-dialog-modal")).toBeNull();
  });

  it("Escape やキャンセルで null を返して DOM を片付ける", async () => {
    const p1 = openPromptModal({ title: "名前" });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect(p1).resolves.toBeNull();
    expect(document.getElementById("app-dialog-modal")).toBeNull();

    const p2 = openPromptModal({ title: "名前" });
    document.querySelector<HTMLButtonElement>(".dialog-btn-cancel")!.click();
    await expect(p2).resolves.toBeNull();
  });

  it("タイトルやメッセージの HTML をエスケープし、重なった呼び出しは前をキャンセルする", async () => {
    const first = openPromptModal({ title: "<img src=x onerror=alert(1)>" });
    expect(document.querySelector("#app-dialog-modal img")).toBeNull();
    const second = openConfirmModal({ title: "確認", message: "<b>消しますか</b>", danger: true });
    await expect(first).resolves.toBeNull();
    expect(document.querySelector("#app-dialog-modal b")).toBeNull();
    // danger 確認は誤爆防止でキャンセル側に初期フォーカス
    expect(document.activeElement).toBe(document.querySelector(".dialog-btn-cancel"));
    document.getElementById("dialog-confirm-btn")!.click();
    await expect(second).resolves.toBe(true);
  });
});

describe("openConfirmModal", () => {
  it("背景クリックで false、確定ボタンで true を返す", async () => {
    const p1 = openConfirmModal({ title: "確認", message: "実行しますか？" });
    const modal = document.getElementById("app-dialog-modal")!;
    modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect(p1).resolves.toBe(false);

    const p2 = openConfirmModal({ title: "確認", message: "実行しますか？" });
    document.getElementById("dialog-confirm-btn")!.click();
    await expect(p2).resolves.toBe(true);
  });
});
