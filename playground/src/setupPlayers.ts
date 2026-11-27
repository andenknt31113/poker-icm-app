// ===== セットアップタブ: プレイヤー行の UI =====
// スタック・ポジション・役割 (🎯hero / ⚔️villain / その他) の編集。
// freemium ゲート: 無料時はスタック編集・追加/削除・ランダム化がロックされる
// (判定は entitlement.isPro() のみに依存し、ここでは localStorage を見ない)。
import { MAX_PLAYERS } from "@poker-icm/core";
import { t as tr } from "./i18n.js";
import { $ } from "./dom.js";
import { isPro, FREE_MAX_PLAYERS } from "./entitlement.js";
import { openPaywall } from "./paywall.js";
import { recompute } from "./calculator.js";
import { checkpointSetup } from "./setupUndo.js";
import { getBountyMode, sanitizeBounty, setBountyMode } from "./bountyState.js";
import { renderBounty } from "./setupBounty.js";
import { renderPayouts } from "./setupPayouts.js";
import { hapticLight, hapticSelection } from "./haptics.js";
import {
  bbToInputValue,
  getBbSize,
  getStackUnit,
  inputValueToBb,
  rescaleStacksForBbSize,
  setBbSize,
  setStackUnit,
  type StackUnit,
} from "./stackUnit.js";
import {
  players,
  allocPlayerId,
  positionsForN,
  nextFreePosition,
  positionsAfterChange,
  positionsForChangedTable,
  assignRole,
  swapDecisionPlayers,
  type Role,
  type Position,
} from "./appState.js";

// ===== DOM参照 =====
const playersList = $<HTMLDivElement>("players-list");
const addPlayerBtn = $<HTMLButtonElement>("add-player");
const randomizeStacksBtn = $<HTMLButtonElement>("randomize-stacks");

/** テーブルとして成立する最小人数 (これ以下では削除ボタンを無効化)。 */
const MIN_PLAYERS = 2;

// 「スタックをランダム化」で生成する範囲 (BB)。トナメ終盤の幅広い分布を再現する。
const RANDOM_STACK_MIN_BB = 3;
const RANDOM_STACK_MAX_BB = 30;

// 1 BB 入力中のキーストローク (例: 1000 → 1 → 3 → 3000) でチップ丸め誤差が
// 蓄積しないよう、フォーカス時点のチップ枚数を基準値として保持する。
// プリセット適用や Undo で renderPlayers() が走ったときは無効化して古い基準を残さない。
let bbInputAnchorChips: number[] | null = null;

function renderStackUnitBar(locked: boolean, syncBbInput = true): void {
  const mode = getStackUnit();
  const bbSize = getBbSize();
  document.querySelectorAll<HTMLButtonElement>("[data-stack-unit]").forEach((btn) => {
    const active = btn.dataset.stackUnit === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  const bar = document.getElementById("bb-size-bar");
  bar?.classList.toggle("hidden", mode !== "chips");
  const col = document.getElementById("spot-col-stack");
  if (col) col.textContent = tr(mode === "chips" ? "setup.cols.stackChips" : "setup.cols.stack");
  const bbInput = document.getElementById("bb-size-input") as HTMLInputElement | null;
  if (bbInput) {
    // iOS WKWebView ではボタン押下時に input からフォーカスが外れないことがあるため、
    // 入力中 (syncBbInput=false) 以外は activeElement に関わらず表示値を同期する。
    if (syncBbInput) {
      bbInput.value = String(bbSize);
      bbInputAnchorChips = null;
    }
    bbInput.readOnly = locked;
    bbInput.classList.toggle("locked-pro", locked);
  }
  document.querySelectorAll<HTMLButtonElement>("[data-bb-preset]").forEach((btn) => {
    const presetVal = Number(btn.dataset.bbPreset);
    const active = presetVal === bbSize;
    btn.classList.toggle("active", active);
    btn.classList.toggle("locked-pro", locked);
    btn.setAttribute("aria-pressed", String(active));
  });
}

function applyBbSizeChange(nextBbSize: number): void {
  const prev = getBbSize();
  if (!(nextBbSize > 0) || !Number.isFinite(nextBbSize) || nextBbSize === prev) return;
  const rescaled = rescaleStacksForBbSize(
    players.map((p) => p.stack),
    prev,
    nextBbSize,
  );
  players.forEach((p, idx) => {
    p.stack = rescaled[idx] ?? 0;
  });
  setBbSize(nextBbSize);
}

export function renderPlayers(): void {
  playersList.innerHTML = "";
  // freemium: 無料時はスタック編集をロック (readonly + 🔒)。役割/ポジションは無料のまま。
  // 4人以下のテーブルは無料でも自由編集。5人以上は Pro のみ。
  const locked = !isPro() && players.length > FREE_MAX_PLAYERS;
  renderStackUnitBar(locked);
  const unitMode = getStackUnit();
  const bbSize = getBbSize();
  const lockNotice = document.getElementById("players-lock-notice");
  if (lockNotice) {
    lockNotice.hidden = !locked;
    lockNotice.textContent = tr("setup.players.locked", { n: FREE_MAX_PLAYERS });
  }
  document.querySelectorAll<HTMLButtonElement>("[data-swap-players]").forEach(button => {
    button.disabled = !players.some(player => player.role === "hero") || !players.some(player => player.role === "villain");
  });
  const validPositions: Position[] = ["", ...positionsForN(players.length)];
  players.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = `player-row ${p.role}`;
    const posOptions = validPositions
      .map(
        (pos) =>
          `<option value="${pos}" ${pos === p.position ? "selected" : ""}>${pos === "" ? "—" : pos}</option>`,
      )
      .join("");
    const stackVal = bbToInputValue(p.stack, unitMode, bbSize);
    const stackStep = unitMode === "chips" ? "any" : "1";
    row.innerHTML = `
      <select class="player-pos" data-id="${p.id}" aria-label="${tr("setup.player.position.aria", { n: i + 1 })}" title="${tr("setup.player.pos.title")}">${posOptions}</select>
      <input type="number" inputmode="decimal" aria-label="${tr("setup.player.stack.aria", { n: i + 1 })}" class="player-stack${locked ? " locked-pro" : ""}" min="0" step="${stackStep}" value="${stackVal}" data-id="${p.id}"${locked ? " readonly" : ""} />
      ${locked ? `<span class="lock-badge" aria-hidden="true" title="${tr("paywall.lock.title")}">🔒</span>` : ""}
      <div class="player-roles" data-id="${p.id}">
        <button type="button" class="role-btn ${p.role === "hero" ? "active hero" : ""}" data-role="hero" aria-pressed="${p.role === "hero"}" title="${tr("setup.player.role.hero")}">${tr("setup.player.role.hero")}</button>
        <button type="button" class="role-btn ${p.role === "villain" ? "active villain" : ""}" data-role="villain" aria-pressed="${p.role === "villain"}" title="${tr("setup.player.role.villain")}">${tr("setup.player.role.villain")}</button>
        <button type="button" class="role-btn ${p.role === "other" ? "active" : ""}" data-role="other" aria-pressed="${p.role === "other"}" aria-label="${tr("setup.player.role.other")}" title="${tr("setup.player.role.other")}">${tr("setup.player.role.otherText")}</button>
      </div>
      <button type="button" class="player-remove" data-id="${p.id}" aria-label="${tr("setup.player.remove.aria", { n: i + 1 })}" title="${tr("setup.common.delete")}" ${players.length <= MIN_PLAYERS ? "disabled" : ""}>✕</button>
    `;
    playersList.appendChild(row);
  });

  // 追加ボタンは「無料で上限 (3人) に達している」ときにロック表示 (タップでペイウォール)。
  addPlayerBtn.classList.toggle("locked-pro", !isPro() && players.length >= FREE_MAX_PLAYERS);
  randomizeStacksBtn.classList.toggle("locked-pro", locked);
  // Pro 時のみ MAX で disable。無料時は disable せず、押下でペイウォールを出す。
  addPlayerBtn.disabled = isPro() && players.length >= MAX_PLAYERS;
  addPlayerBtn.textContent =
    players.length >= MAX_PLAYERS
      ? tr("setup.players.addMax", { n: MAX_PLAYERS })
      : tr("setup.players.add");
  // 人数・位置が変わると、バウンティの入力行も変わる
  renderBounty();
}

/** プレイヤー配列を丸ごと置き換える (プリセット適用・ユーザーシナリオ復元の共通処理)。 */
export function replacePlayers(
  next: readonly { stack: number; role: Role; position: Position; bounty?: number }[],
): void {
  players.length = 0;
  for (const p of next) {
    players.push({ id: allocPlayerId(), stack: p.stack, role: p.role, position: p.position, bounty: sanitizeBounty(p.bounty) });
  }
  // 卓を丸ごと入れ替えたので、次のポジション選択はリング自動連動に戻す
  ringAutoLinkArmed = true;
}

function setRole(playerId: number, role: Role): void {
  const target = players.find((p) => p.id === playerId);
  if (!target || target.role === role) return;
  hapticLight();
  checkpointSetup();
  assignRole(players, playerId, role);
  renderPlayers();
  recompute();
}

function leaveFreeBountyPreviewIfNeeded(): void {
  if (!isPro() && getBountyMode() !== "off") {
    setBountyMode("off");
    renderBounty();
  }
}

function updateStack(playerId: number, value: number): void {
  const target = players.find((p) => p.id === playerId);
  if (!target) return;
  target.stack = inputValueToBb(value, getStackUnit(), getBbSize());
  leaveFreeBountyPreviewIfNeeded();
  recompute();
}

function removePlayer(playerId: number): void {
  if (players.length <= MIN_PLAYERS) return;
  const idx = players.findIndex((p) => p.id === playerId);
  if (idx < 0) return;
  hapticLight();
  checkpointSetup();
  const removed = players.splice(idx, 1)[0]!;
  // 削除した役割が hero/villain なら別の人に振る
  if (removed.role !== "other") {
    const replacement = players.find((p) => p.role === "other");
    if (replacement) replacement.role = removed.role;
  }
  if (!isPro() && getBountyMode() !== "off") setBountyMode("off");
  repairPositions();
  renderPlayers();
  renderPayouts(); // 3人境界を跨ぐとペイ構造側のロック表示も変わる
  recompute();
}

function addPlayer(): void {
  if (players.length >= MAX_PLAYERS) return;
  hapticLight();
  checkpointSetup();
  const avg =
    players.reduce((a, p) => a + p.stack, 0) / Math.max(1, players.length);
  // ポジション自動採番: 既存の割り当ては動かさず、新しい人数の正規セットで
  // 未使用のポジションを新プレイヤーに与える (全員未設定なら "" のまま)。
  const position = nextFreePosition(
    players.length + 1,
    players.map((p) => p.position),
  );
  players.push({
    id: allocPlayerId(),
    stack: Math.round(avg * 10) / 10,
    role: "other",
    position,
    bounty: 0,
  });
  repairPositions();
  renderPlayers();
  renderPayouts(); // 3人境界を跨ぐとペイ構造側のロック表示も変わる
  recompute();
}

// ポジションの自動連動 (リング一括割当) を次の変更で使うか。
// プリセット適用・シナリオ復元・起動直後は true = 「1人選べば残りも自動で並ぶ」。
// 一度手動で選んだら false に落とし、以降の変更は入れ替え (swap) にする。
// 毎回リング再割当すると、席順どおりに入力しなかったときに
// 「1人直すと別の人のポジションが壊れる」モグラ叩きになるため。
let ringAutoLinkArmed = true;

export function getPositionAutoLink(): boolean {
  return ringAutoLinkArmed;
}

export function setPositionAutoLink(armed: boolean): void {
  ringAutoLinkArmed = armed;
}

function repairPositions(): void {
  const positions = positionsForChangedTable(players.map(player => player.position));
  players.forEach((player, index) => { player.position = positions[index]!; });
}

function setPosition(playerId: number, position: Position): void {
  const i = players.findIndex((p) => p.id === playerId);
  if (i < 0 || players[i]?.position === position) return;

  checkpointSetup();
  const next = positionsAfterChange(
    players.map((p) => p.position),
    i,
    position,
    ringAutoLinkArmed,
  );
  players.forEach((p, j) => {
    p.position = next[j] ?? "";
  });
  if (position !== "") ringAutoLinkArmed = false;
  renderPlayers();
  recompute();
}

function randomizeStacks(): void {
  hapticLight();
  checkpointSetup();
  // RANDOM_STACK_MIN_BB 〜 RANDOM_STACK_MAX_BB のランダム整数。
  const span = RANDOM_STACK_MAX_BB - RANDOM_STACK_MIN_BB + 1;
  for (const p of players) {
    p.stack = RANDOM_STACK_MIN_BB + Math.floor(Math.random() * span);
  }
  if (!isPro() && getBountyMode() !== "off") setBountyMode("off");
  renderPlayers();
  recompute();
}

/** プレイヤー行のイベント配線。initSetup から一度だけ呼ぶ。 */
/**
 * 位置が未設定・重複している席を、その人数で使う位置のうち空いているもので埋める。
 * 誰も位置を持っていない卓は、上の行から BTN → SB → BB … の順に入れる。
 * 変えた席があれば true。
 */
export function fillMissingPositions(): boolean {
  const before = players.map((player) => player.position).join(",");
  if (players.every((player) => player.position === "")) {
    const order = positionsForN(players.length);
    players.forEach((player, index) => { player.position = order[index] ?? ""; });
  } else {
    repairPositions();
  }
  return players.map((player) => player.position).join(",") !== before;
}

export function initPlayersUI(): void {
  // 「空いている位置を入れる」ボタン (Nash の一覧など、位置が全員ぶん必要な画面の案内から押す)。
  // 画面のあちこちに後から描かれるので、document で受ける。
  document.addEventListener("click", (event) => {
    if (!(event.target as HTMLElement).closest("[data-fill-positions]")) return;
    const nextPositions = players.every((player) => player.position === "")
      ? positionsForN(players.length)
      : positionsForChangedTable(players.map((player) => player.position));
    if (players.every((player, index) => player.position === (nextPositions[index] ?? ""))) return;
    checkpointSetup();
    fillMissingPositions();
    ringAutoLinkArmed = false;
    renderPlayers();
    recompute();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-swap-players]").forEach(button => button.addEventListener("click", () => {
    if (!players.some(player => player.role === "hero") || !players.some(player => player.role === "villain")) return;
    hapticLight();
    checkpointSetup();
    swapDecisionPlayers(players);
    renderPlayers();
    recompute();
  }));
  // イベントデリゲーション
  playersList.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const roleBtn = target.closest<HTMLButtonElement>(".role-btn");
    if (roleBtn) {
      const wrap = roleBtn.closest<HTMLDivElement>(".player-roles");
      const id = Number(wrap?.dataset.id);
      const role = roleBtn.dataset.role as Role;
      if (Number.isFinite(id) && role) setRole(id, role);
      return;
    }
    const remove = target.closest<HTMLButtonElement>(".player-remove");
    if (remove) {
      // 削除 (人数を減らす方向) は無料でも可能。FREE_MAX_PLAYERS (4人) 以下にすれば自由編集できる。
      const id = Number(remove.dataset.id);
      if (Number.isFinite(id)) removePlayer(id);
    }
  });

  // freemium: ロック中のスタック入力はタップ/フォーカスでペイウォールを出す
  // (readonly なので値は変えられないが、能動的にアップグレード導線を見せる)。
  // pointerdown + preventDefault でそもそもフォーカスさせない (モバイルで
  // フォーカス起点の副作用ループやキーボード表示を防ぐ)。focusin は
  // キーボード操作 (Tab 移動) 向けのフォールバック。
  playersList.addEventListener("pointerdown", (e) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("player-stack") && !isPro() && players.length > FREE_MAX_PLAYERS) {
      e.preventDefault();
      openPaywall("players");
    }
  });
  playersList.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("player-stack") && !isPro() && players.length > FREE_MAX_PLAYERS) {
      (el as HTMLInputElement).blur();
      openPaywall("players");
    }
  });

  playersList.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains("player-stack")) return;
    if (!isPro() && players.length > FREE_MAX_PLAYERS) return; // readonly のはずだが二重ガード
    const id = Number(target.dataset.id);
    if (Number.isFinite(id)) updateStack(id, Number(target.value));
  });
  // 負数・空欄などが入ったまま残らないよう、フォーカスが外れたら実計算値 (非負) に表示を揃える
  playersList.addEventListener("focusout", (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains("player-stack") || target.readOnly) return;
    const id = Number(target.dataset.id);
    const p = players.find((item) => item.id === id);
    if (!p) return;
    const raw = Number(target.value);
    if (!Number.isFinite(raw) || raw < 0 || target.value.trim() === "") {
      target.value = bbToInputValue(p.stack, getStackUnit(), getBbSize());
    }
  });

  // ===== BB / チップ単位切替と 1 BB サイズ =====
  document.querySelectorAll<HTMLButtonElement>("[data-stack-unit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.stackUnit as StackUnit;
      if (next !== "bb" && next !== "chips") return;
      if (next === getStackUnit()) return;
      hapticSelection();
      setStackUnit(next);
      renderPlayers();
      recompute();
    });
  });

  const bbInput = document.getElementById("bb-size-input") as HTMLInputElement | null;
  if (bbInput) {
    bbInput.addEventListener("pointerdown", (e) => {
      if (!isPro() && players.length > FREE_MAX_PLAYERS) {
        e.preventDefault();
        openPaywall("players");
      }
    });
    bbInput.addEventListener("focusin", () => {
      if (!isPro() && players.length > FREE_MAX_PLAYERS) {
        bbInput.blur();
        openPaywall("players");
        return;
      }
      const curBb = getBbSize();
      bbInputAnchorChips = players.map((p) => Math.round(p.stack * curBb));
    });
    bbInput.addEventListener("input", () => {
      if (!isPro() && players.length > FREE_MAX_PLAYERS) return;
      const val = Number(bbInput.value);
      if (!Number.isFinite(val) || val <= 0) return;
      if (!bbInputAnchorChips || bbInputAnchorChips.length !== players.length) {
        const curBb = getBbSize();
        bbInputAnchorChips = players.map((p) => Math.round(p.stack * curBb));
      }
      players.forEach((p, idx) => {
        p.stack = (bbInputAnchorChips![idx] ?? 0) / val;
      });
      setBbSize(val);
      leaveFreeBountyPreviewIfNeeded();
      renderStackUnitBar(false, false);
      recompute();
    });
    bbInput.addEventListener("focusout", () => {
      bbInputAnchorChips = null;
      if (bbInput.readOnly) return;
      const val = Number(bbInput.value);
      if (!Number.isFinite(val) || val <= 0) {
        bbInput.value = String(getBbSize());
      }
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-bb-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isPro() && players.length > FREE_MAX_PLAYERS) return openPaywall("players");
      const val = Number(btn.dataset.bbPreset);
      if (!Number.isFinite(val) || val <= 0 || val === getBbSize()) return;
      hapticSelection();
      checkpointSetup();
      applyBbSizeChange(val);
      if (!isPro() && getBountyMode() !== "off") setBountyMode("off");
      renderPlayers();
      recompute();
    });
  });

  playersList.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    if (!target.classList.contains("player-pos")) return;
    const id = Number(target.dataset.id);
    if (Number.isFinite(id)) setPosition(id, target.value as Position);
  });

  addPlayerBtn.addEventListener("click", () => {
    if (!isPro() && players.length >= FREE_MAX_PLAYERS) return openPaywall("players");
    addPlayer();
  });
  randomizeStacksBtn.addEventListener("click", () => {
    if (!isPro() && players.length > FREE_MAX_PLAYERS) return openPaywall("players");
    randomizeStacks();
  });
}
