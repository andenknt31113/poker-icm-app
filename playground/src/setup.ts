// ===== セットアップタブの取りまとめ =====
//
// タブ内の 3 セクションはそれぞれ独立したモジュールに分けてある:
//   - setupPlayers.ts   … プレイヤー行 (スタック・ポジション・役割)
//   - setupScenarios.ts … シナリオ プリセット + ユーザー定義シナリオ
//   - setupPayouts.ts   … ペイ構造の行編集・プリセット・保存/復元
// このファイルはそれらの初期化順を決め、外向けの API (main.ts / practice が
// 使う renderPlayers / setPayouts / refreshProGatedUi) を再公開するだけ。
import { isPro } from "./entitlement.js";
import { configureSetupUndo, canUndoSetup, undoSetup, stageSetupInput, commitSetupInput, endSetupInput } from "./setupUndo.js";
import { players } from "./appState.js";
import { payoutsArr, replacePayouts, payoutsInput, nashSbInput, nashBbInput, nashAnteInput } from "./domRefs.js";
import { recompute, getCallManualOverride, setCallManualOverride } from "./calculator.js";
import { renderPlayers, initPlayersUI, getPositionAutoLink, setPositionAutoLink } from "./setupPlayers.js";
import { initScenariosUI } from "./setupScenarios.js";
import { renderPayouts, initPayoutsUI } from "./setupPayouts.js";
import { STORAGE_KEYS, readRaw, writeRaw, type StorageKey } from "./storage.js";

// 既存の import 元 (main.ts / practice/interactions.ts) を変えずに済むよう再公開する。
export { renderPlayers } from "./setupPlayers.js";
export { setPayouts } from "./setupPayouts.js";

// ===== メモ機能は UI から削除済み (オーナーフィードバック対応) =====
// 「📝 メモ」カードと入力 UI は削除したが、localStorage の既存データ
// ("poker-icm-scenario-memo") は消さずに残してある。将来 UI を復活させた際に
// 過去のメモを引き継げるようにするための措置。読み書きするコードはもう無い
// (そのため storage.ts の STORAGE_KEYS にも載せていない)。

/**
 * Pro 権限が変化したとき (RevenueCat の購入/復元完了) に、freemium ロックの
 * 見た目を一括で再描画する。ロック判定ロジック自体は各 render 関数内の isPro()
 * に委ねており、ここではそれらを呼び直すだけ (ゲートの挙動は不変)。
 * main.ts が onEntitlementChange 経由で呼ぶ。
 */
export function refreshProGatedUi(): void {
  renderPlayers();
  renderPayouts();
  const saveScenarioBtn = document.getElementById("save-scenario-btn") as HTMLButtonElement | null;
  saveScenarioBtn?.classList.toggle("locked-pro", !isPro());
}

// ===== 折りたたみセクションの開閉状態を localStorage に永続化 =====
// 値は "open" / "closed" の文字列。真偽フラグ ("1"/"0") ではなく、
// 「キー未設定 (初回起動) = 開いた状態」を既定にしたいため
// `!== "closed"` という判定にしている (readFlag では表現できない既定値)。
const COLLAPSE_CLOSED = "closed";
const COLLAPSE_OPEN = "open";

function initCollapsibleSection(detailsId: string, storageKey: StorageKey, defaultOpen = true): void {
  const details = document.getElementById(detailsId) as HTMLDetailsElement | null;
  if (!details) return;
  const saved = readRaw(storageKey);
  details.open = saved === COLLAPSE_OPEN || (saved !== COLLAPSE_CLOSED && defaultOpen);
  details.addEventListener("toggle", () => {
    writeRaw(storageKey, details.open ? COLLAPSE_OPEN : COLLAPSE_CLOSED);
  });
}

/**
 * セットアップタブ全体 (プレイヤー・シナリオ・ペイ構造) の初期化。
 * main.ts から一度だけ呼ぶ。呼び出し順は元 initSetup の配線順を踏襲している
 * (同一要素に複数 listener を張る箇所があるため、順序は意味を持つ)。
 */
export function initSetup(): void {
  configureSetupUndo(() => {
    const savedPlayers = players.map(player => ({ ...player }));
    const autoLink = getPositionAutoLink();
    const prizes = payoutsArr.slice();
    const blinds = [nashSbInput.value, nashBbInput.value, nashAnteInput.value];
    const call = document.querySelector<HTMLInputElement>("#call")!;
    const pot = document.querySelector<HTMLInputElement>("#potwin")!;
    const amounts = [call.value, pot.value];
    const manual = getCallManualOverride();
    return () => {
      players.splice(0, players.length, ...savedPlayers);
      setPositionAutoLink(autoLink);
      replacePayouts(prizes);
      payoutsInput.value = prizes.join(", ");
      [nashSbInput, nashBbInput, nashAnteInput].forEach((input, index) => { input.value = blinds[index]!; });
      call.value = amounts[0]!;
      pot.value = amounts[1]!;
      setCallManualOverride(manual);
      renderPlayers();
      renderPayouts();
      recompute();
    };
  });
  const undo = document.querySelector<HTMLButtonElement>("#setup-undo");
  undo?.addEventListener("click", undoSetup);
  document.addEventListener("focusin", event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && !input.readOnly && input.matches(".player-stack, .payout-amount, #nash-sb, #nash-bb, #nash-ante, #call, #potwin")) stageSetupInput(input);
  });
  document.addEventListener("input", event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && !input.readOnly) commitSetupInput(input);
  }, true);
  document.addEventListener("focusout", endSetupInput);
  document.addEventListener("setup-undo-change", () => { if (undo) undo.disabled = !canUndoSetup(); });
  initPlayersUI();
  initScenariosUI();
  initPayoutsUI();

  initCollapsibleSection("scenario-presets-toggle", STORAGE_KEYS.collapseScenarioPresets, false);
  initCollapsibleSection("payout-presets-toggle", STORAGE_KEYS.collapsePayoutPresets);
}
