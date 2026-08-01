// ===== セットアップタブ: ペイ構造 (賞金配分) の UI =====
// ペイアウト行の編集、プリセットピル (Top3/Top2/WTA 等)、名前付きペイ構造の保存/復元。
// freemium ゲート: 無料時はペイ構造の手編集・プリセット適用・保存がロックされる。
// (シナリオプリセット経由の setPayouts はプログラム的な差し替えなので許可。)
import { t as tr } from "./i18n.js";
import { $ } from "./dom.js";
import { isPro, FREE_MAX_PLAYERS } from "./entitlement.js";
import { openPaywall } from "./paywall.js";
import { recompute } from "./calculator.js";
import { parseList, sanitizePayoutsArray, players } from "./appState.js";
import { payoutsInput, payoutsArr, replacePayouts } from "./domRefs.js";
import { escapeHtml } from "./html.js";
import { STORAGE_KEYS, readJson, writeJson } from "./storage.js";

const payoutsList = $<HTMLDivElement>("payouts-list");
const addPayoutBtn = $<HTMLButtonElement>("add-payout");
const savedPayoutsContainer = $<HTMLDivElement>("saved-payouts");
const savePayoutBtn = $<HTMLButtonElement>("save-payout");

/** 追加できるペイアウト行数の上限。 */
const MAX_PAYOUTS = 12;
/** 全額 1 位取り (winner takes all) の既定値。setPayouts が空入力を受けたときの保険。 */
const WINNER_TAKES_ALL: readonly number[] = [100];
/** 保存するペイ構造名の最大長。 */
const SAVED_PAYOUT_NAME_MAX = 24;

function syncPayoutsInput(): void {
  payoutsInput.value = payoutsArr.join(", ");
}

export function renderPayouts(): void {
  payoutsList.innerHTML = "";
  // freemium: 無料時はペイ構造の手編集をロック (readonly + 🔒)。
  // シナリオプリセット適用によるペイ変更 (setPayouts 経由) は許可 (プログラム的な差し替え)。
  // ペイ構造の編集ロックはプレイヤー数と連動 (3人以下は無料で編集可)。
  const locked = !isPro() && players.length > FREE_MAX_PLAYERS;
  payoutsArr.forEach((amt, i) => {
    const row = document.createElement("div");
    row.className = "payout-row";
    row.innerHTML = `
      <span class="payout-num">${tr("setup.payout.rank", { n: i + 1 })}</span>
      <input type="number" inputmode="decimal" class="payout-amount${locked ? " locked-pro" : ""}" min="0" step="0.5" value="${amt}" data-i="${i}"${locked ? " readonly" : ""} />
      ${locked ? `<span class="lock-badge" aria-hidden="true" title="${tr("paywall.lock.title")}">🔒</span>` : ""}
      <button type="button" class="payout-remove${locked ? " locked-pro" : ""}" data-i="${i}" title="${tr("setup.common.delete")}" ${!locked && payoutsArr.length <= 1 ? "disabled" : ""}>✕</button>
    `;
    payoutsList.appendChild(row);
  });
  addPayoutBtn.classList.toggle("locked-pro", locked);
  document
    .querySelectorAll<HTMLButtonElement>(".presets:not(.saved) button")
    .forEach((btn) => btn.classList.toggle("locked-pro", locked));
  addPayoutBtn.disabled = !locked && payoutsArr.length >= MAX_PAYOUTS;
}

/**
 * ペイ構造を差し替えて再計算する。シナリオプリセット・保存ペイ復元・
 * プリセットピルの共通出口。不正値はサニタイズで捨て、全滅した場合のみ
 * WTA (=[100]) にフォールバックする (ペイ 0 件は ICM 計算が成立しないため)。
 */
export function setPayouts(values: number[]): void {
  const sanitized = sanitizePayoutsArray(values);
  replacePayouts(sanitized.length > 0 ? sanitized : [...WINNER_TAKES_ALL]);
  syncPayoutsInput();
  renderPayouts();
  recompute();
}

// ===== ペイ構造の保存・復元 =====

interface SavedPayout {
  name: string;
  value: string;
}

function isSavedPayout(x: unknown): x is SavedPayout {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as SavedPayout).name === "string" &&
    typeof (x as SavedPayout).value === "string"
  );
}

function loadSavedPayouts(): SavedPayout[] {
  const arr = readJson<unknown[]>(STORAGE_KEYS.savedPayouts, [], Array.isArray);
  return arr.filter(isSavedPayout);
}

function persistSavedPayouts(list: SavedPayout[]): void {
  writeJson(STORAGE_KEYS.savedPayouts, list);
}

function renderSavedPayouts(): void {
  const list = loadSavedPayouts();
  savedPayoutsContainer.innerHTML = list
    .map(
      (p, i) => `
      <span class="saved-preset" data-i="${i}">
        <button type="button" class="load" data-value="${escapeHtml(p.value)}">${escapeHtml(p.name)}: ${escapeHtml(p.value)}</button>
        <button type="button" class="del" title="${tr("setup.common.delete")}">✕</button>
      </span>
    `,
    )
    .join("");
}

/** ペイ構造セクションのイベント配線と初期描画。initSetup から一度だけ呼ぶ。 */
export function initPayoutsUI(): void {
  // freemium: ロック中のペイ金額入力はタップ/フォーカスでペイウォール。
  // (スタック入力と同じく pointerdown で先取りし、focusin はフォールバック。)
  payoutsList.addEventListener("pointerdown", (e) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("payout-amount") && !isPro() && players.length > FREE_MAX_PLAYERS) {
      e.preventDefault();
      openPaywall();
    }
  });
  payoutsList.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("payout-amount") && !isPro() && players.length > FREE_MAX_PLAYERS) {
      (el as HTMLInputElement).blur();
      openPaywall();
    }
  });

  payoutsList.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains("payout-amount")) return;
    if (!isPro() && players.length > FREE_MAX_PLAYERS) return; // readonly のはずだが二重ガード
    const i = Number(target.dataset.i);
    const v = Number(target.value);
    if (Number.isFinite(i) && i >= 0 && i < payoutsArr.length) {
      payoutsArr[i] = Number.isFinite(v) && v >= 0 ? v : 0;
      syncPayoutsInput();
      recompute();
    }
  });

  payoutsList.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const remove = target.closest<HTMLButtonElement>(".payout-remove");
    if (!remove) return;
    if (!isPro() && players.length > FREE_MAX_PLAYERS) {
      openPaywall();
      return;
    }
    if (payoutsArr.length > 1) {
      const i = Number(remove.dataset.i);
      if (Number.isFinite(i) && i >= 0 && i < payoutsArr.length) {
        payoutsArr.splice(i, 1);
        syncPayoutsInput();
        renderPayouts();
        recompute();
      }
    }
  });

  addPayoutBtn.addEventListener("click", () => {
    if (!isPro() && players.length > FREE_MAX_PLAYERS) return openPaywall();
    if (payoutsArr.length >= MAX_PAYOUTS) return;
    payoutsArr.push(0);
    syncPayoutsInput();
    renderPayouts();
    recompute();
  });

  renderPayouts();

  // ペイプリセットピル (Top3/Top2/WTA 等) は「ペイ構造の編集」に含まれるためロック。
  // (シナリオプリセットの scenario-btn は無料。こちらは payout プリセットのみ。)
  document
    .querySelectorAll<HTMLButtonElement>(".presets:not(.saved) button")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!isPro() && players.length > FREE_MAX_PLAYERS) return openPaywall();
        const v = btn.dataset.preset;
        if (v) setPayouts(parseList(v));
      });
    });

  savedPayoutsContainer.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const wrap = target.closest<HTMLSpanElement>(".saved-preset");
    if (!wrap) return;
    if (!isPro()) {
      openPaywall();
      return;
    }
    const idx = Number(wrap.dataset.i);
    const list = loadSavedPayouts();
    if (target.classList.contains("del")) {
      list.splice(idx, 1);
      persistSavedPayouts(list);
      renderSavedPayouts();
      return;
    }
    if (target.classList.contains("load")) {
      setPayouts(parseList(target.dataset.value ?? ""));
    }
  });

  savePayoutBtn.classList.toggle("locked-pro", !isPro());
  savePayoutBtn.addEventListener("click", () => {
    if (!isPro()) return openPaywall();
    const value = payoutsInput.value.trim();
    if (!value) return;
    const name = window.prompt(
      tr("setup.prompt.savePayout"),
      "",
    );
    if (!name) return;
    const list = loadSavedPayouts();
    list.push({ name: name.slice(0, SAVED_PAYOUT_NAME_MAX), value });
    persistSavedPayouts(list);
    renderSavedPayouts();
  });

  renderSavedPayouts();

  payoutsInput.addEventListener("input", recompute);
}
