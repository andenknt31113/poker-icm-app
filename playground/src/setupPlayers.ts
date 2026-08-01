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
import { renderPayouts } from "./setupPayouts.js";
import {
  players,
  allocPlayerId,
  positionsForN,
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

export function renderPlayers(): void {
  playersList.innerHTML = "";
  // freemium: 無料時はスタック編集をロック (readonly + 🔒)。役割/ポジションは無料のまま。
  // 3人以下のテーブルは無料でも自由編集。4人以上は Pro のみ。
  const locked = !isPro() && players.length > FREE_MAX_PLAYERS;
  const validPositions: Position[] = ["", ...positionsForN(players.length)];
  players.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const posOptions = validPositions
      .map(
        (pos) =>
          `<option value="${pos}" ${pos === p.position ? "selected" : ""}>${pos === "" ? "—" : pos}</option>`,
      )
      .join("");
    row.innerHTML = `
      <span class="player-num">#${i + 1}</span>
      <input type="number" inputmode="decimal" class="player-stack${locked ? " locked-pro" : ""}" min="0" step="1" value="${p.stack}" data-id="${p.id}"${locked ? " readonly" : ""} />
      ${locked ? `<span class="lock-badge" aria-hidden="true" title="${tr("paywall.lock.title")}">🔒</span>` : `<span class="player-unit">BB</span>`}
      <select class="player-pos" data-id="${p.id}" title="${tr("setup.player.pos.title")}">${posOptions}</select>
      <div class="player-roles" data-id="${p.id}">
        <button type="button" class="role-btn ${p.role === "hero" ? "active hero" : ""}" data-role="hero" title="${tr("setup.player.role.hero")}">🎯</button>
        <button type="button" class="role-btn ${p.role === "villain" ? "active villain" : ""}" data-role="villain" title="${tr("setup.player.role.villain")}">⚔️</button>
        <button type="button" class="role-btn ${p.role === "other" ? "active" : ""}" data-role="other" title="${tr("setup.player.role.other")}">${tr("setup.player.role.otherText")}</button>
      </div>
      <button type="button" class="player-remove${locked ? " locked-pro" : ""}" data-id="${p.id}" title="${tr("setup.common.delete")}" ${!locked && players.length <= MIN_PLAYERS ? "disabled" : ""}>✕</button>
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
}

/** プレイヤー配列を丸ごと置き換える (プリセット適用・ユーザーシナリオ復元の共通処理)。 */
export function replacePlayers(
  next: readonly { stack: number; role: Role; position: Position }[],
): void {
  players.length = 0;
  for (const p of next) {
    players.push({ id: allocPlayerId(), stack: p.stack, role: p.role, position: p.position });
  }
}

function setRole(playerId: number, role: Role): void {
  const target = players.find((p) => p.id === playerId);
  if (!target) return;

  // hero/villain は同時に1人ずつだけ
  if (role === "hero") {
    for (const p of players) {
      if (p.role === "hero") p.role = "other";
    }
  } else if (role === "villain") {
    for (const p of players) {
      if (p.role === "villain") p.role = "other";
    }
  }
  target.role = role;
  renderPlayers();
  recompute();
}

function updateStack(playerId: number, value: number): void {
  const target = players.find((p) => p.id === playerId);
  if (!target) return;
  target.stack = Number.isFinite(value) && value >= 0 ? value : 0;
  recompute();
}

function removePlayer(playerId: number): void {
  if (players.length <= MIN_PLAYERS) return;
  const idx = players.findIndex((p) => p.id === playerId);
  if (idx < 0) return;
  const removed = players.splice(idx, 1)[0]!;
  // 削除した役割が hero/villain なら別の人に振る
  if (removed.role !== "other") {
    const replacement = players.find((p) => p.role === "other");
    if (replacement) replacement.role = removed.role;
  }
  renderPlayers();
  renderPayouts(); // 3人境界を跨ぐとペイ構造側のロック表示も変わる
  recompute();
}

function addPlayer(): void {
  if (players.length >= MAX_PLAYERS) return;
  const avg =
    players.reduce((a, p) => a + p.stack, 0) / Math.max(1, players.length);
  players.push({
    id: allocPlayerId(),
    stack: Math.round(avg * 10) / 10,
    role: "other",
    position: "",
  });
  renderPlayers();
  renderPayouts(); // 3人境界を跨ぐとペイ構造側のロック表示も変わる
  recompute();
}

function setPosition(playerId: number, position: Position): void {
  const i = players.findIndex((p) => p.id === playerId);
  if (i < 0) return;

  if (position === "") {
    // この行だけクリア
    players[i]!.position = "";
    renderPlayers();
    recompute();
    return;
  }

  const N = players.length;
  const set = positionsForN(N);
  const k = set.indexOf(position);

  if (k < 0) {
    // 該当 N の正規セットに無いポジション → 単独セット（他には影響しない）
    players[i]!.position = position;
  } else {
    // 自動連動: i を起点に時計回り (j-i) ぶんセットからずらして割り当て
    for (let j = 0; j < N; j++) {
      const offset = (j - i + N) % N;
      players[j]!.position = (set[(k + offset) % set.length] ?? "") as Position;
    }
  }
  renderPlayers();
  recompute();
}

function randomizeStacks(): void {
  // RANDOM_STACK_MIN_BB 〜 RANDOM_STACK_MAX_BB のランダム整数。
  const span = RANDOM_STACK_MAX_BB - RANDOM_STACK_MIN_BB + 1;
  for (const p of players) {
    p.stack = RANDOM_STACK_MIN_BB + Math.floor(Math.random() * span);
  }
  renderPlayers();
  recompute();
}

/** プレイヤー行のイベント配線。initSetup から一度だけ呼ぶ。 */
export function initPlayersUI(): void {
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
      // 削除 (人数を減らす方向) は無料でも可能。3人以下にすれば自由編集できる。
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
      openPaywall();
    }
  });
  playersList.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("player-stack") && !isPro() && players.length > FREE_MAX_PLAYERS) {
      (el as HTMLInputElement).blur();
      openPaywall();
    }
  });

  playersList.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains("player-stack")) return;
    if (!isPro() && players.length > FREE_MAX_PLAYERS) return; // readonly のはずだが二重ガード
    const id = Number(target.dataset.id);
    if (Number.isFinite(id)) updateStack(id, Number(target.value));
  });

  playersList.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    if (!target.classList.contains("player-pos")) return;
    const id = Number(target.dataset.id);
    if (Number.isFinite(id)) setPosition(id, target.value as Position);
  });

  addPlayerBtn.addEventListener("click", () => {
    if (!isPro() && players.length >= FREE_MAX_PLAYERS) return openPaywall();
    addPlayer();
  });
  randomizeStacksBtn.addEventListener("click", () => {
    if (!isPro() && players.length > FREE_MAX_PLAYERS) return openPaywall();
    randomizeStacks();
  });
}
