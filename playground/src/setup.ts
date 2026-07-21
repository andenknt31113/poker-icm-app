import { MAX_PLAYERS } from "@poker-icm/core";
import { t as tr } from "./i18n.js";
import { $ } from "./dom.js";
import { isPro } from "./entitlement.js";
import { openPaywall } from "./paywall.js";
import { recompute, setCallManualOverride } from "./calculator.js";
import {
  players,
  allocPlayerId,
  positionsForN,
  type Role,
  type Position,
  parseList,
  sanitizePayoutsArray,
  DEFAULT_SB,
  DEFAULT_BB,
  DEFAULT_ANTE,
} from "./appState.js";
import {
  payoutsInput,
  payoutsArr,
  replacePayouts,
  nashSbInput,
  nashBbInput,
  nashAnteInput,
} from "./domRefs.js";

// ===== DOM参照 =====
const playersList = $<HTMLDivElement>("players-list");
const addPlayerBtn = $<HTMLButtonElement>("add-player");
const randomizeStacksBtn = $<HTMLButtonElement>("randomize-stacks");

// ===== プレイヤーUI =====

export function renderPlayers(): void {
  playersList.innerHTML = "";
  // freemium: 無料時はスタック編集をロック (readonly + 🔒)。役割/ポジションは無料のまま。
  const locked = !isPro();
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
      <button type="button" class="player-remove${locked ? " locked-pro" : ""}" data-id="${p.id}" title="${tr("setup.common.delete")}" ${!locked && players.length <= 2 ? "disabled" : ""}>✕</button>
    `;
    playersList.appendChild(row);
  });

  addPlayerBtn.classList.toggle("locked-pro", locked);
  randomizeStacksBtn.classList.toggle("locked-pro", locked);
  // Pro 時のみ MAX で disable。無料時は disable せず、押下でペイウォールを出す。
  addPlayerBtn.disabled = !locked && players.length >= MAX_PLAYERS;
  addPlayerBtn.textContent =
    players.length >= MAX_PLAYERS
      ? tr("setup.players.addMax", { n: MAX_PLAYERS })
      : tr("setup.players.add");
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
  if (players.length <= 2) return;
  const idx = players.findIndex((p) => p.id === playerId);
  if (idx < 0) return;
  const removed = players.splice(idx, 1)[0]!;
  // 削除した役割が hero/villain なら別の人に振る
  if (removed.role !== "other") {
    const replacement = players.find((p) => p.role === "other");
    if (replacement) replacement.role = removed.role;
  }
  renderPlayers();
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
  // 3 〜 30 BB のランダム整数。トナメ終盤の幅広いスタックを再現。
  for (const p of players) {
    p.stack = 3 + Math.floor(Math.random() * 28); // 3..30
  }
  renderPlayers();
  recompute();
}

// ===== シナリオプリセット =====

interface Scenario {
  players: { stack: number; role: Role; position: Position }[];
  payouts: number[];
  sb: number;
  bb: number;
  ante: number; // テーブル合計
  anteMode?: "total" | "perPlayer"; // 省略時は "total" 扱い (組み込みプリセット)
}

// 各プリセットは call 分析として成立する構成 (hero=BB、villain はそれより先に行動するポジション)
// にしてある。これは #position-warn (ポジション逆転警告) を出さないための配置で、
// スタック分布・人数・ペイの「意味」自体は変えていない (hero/villain のスタック・役割は
// 従来どおりで、席の並び=position だけを付け替えてある)。
const SCENARIOS: Record<string, Scenario> = {
  ft9: {
    players: [
      { stack: 35, role: "hero", position: "BB" },
      { stack: 28, role: "villain", position: "SB" },
      { stack: 22, role: "other", position: "BTN" },
      { stack: 18, role: "other", position: "UTG" },
      { stack: 15, role: "other", position: "UTG+1" },
      { stack: 12, role: "other", position: "MP" },
      { stack: 10, role: "other", position: "LJ" },
      { stack: 7, role: "other", position: "HJ" },
      { stack: 5, role: "other", position: "CO" },
    ],
    payouts: [40, 25, 15, 10, 5, 3, 2, 1, 0.5],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ftBubble: {
    players: [
      { stack: 4, role: "hero", position: "BB" },
      { stack: 18, role: "villain", position: "SB" },
      { stack: 22, role: "other", position: "BTN" },
      { stack: 16, role: "other", position: "CO" },
    ],
    payouts: [50, 30, 20],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ft6: {
    players: [
      { stack: 18, role: "hero", position: "BB" },
      { stack: 12, role: "villain", position: "SB" },
      { stack: 22, role: "other", position: "BTN" },
      { stack: 8, role: "other", position: "UTG" },
      { stack: 14, role: "other", position: "HJ" },
      { stack: 10, role: "other", position: "CO" },
    ],
    payouts: [45, 25, 15, 8, 4, 3],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ft4: {
    players: [
      { stack: 12, role: "hero", position: "BB" },
      { stack: 18, role: "villain", position: "SB" },
      { stack: 8, role: "other", position: "BTN" },
      { stack: 15, role: "other", position: "CO" },
    ],
    payouts: [50, 30, 15, 5],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ft3: {
    players: [
      { stack: 18, role: "hero", position: "BB" },
      { stack: 14, role: "villain", position: "SB" },
      { stack: 20, role: "other", position: "BTN" },
    ],
    payouts: [50, 30, 20],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  hu: {
    players: [
      { stack: 10, role: "hero", position: "BB" },
      { stack: 10, role: "villain", position: "BTN" },
    ],
    payouts: [100],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: 0,
  },
  huShort: {
    players: [
      { stack: 5, role: "hero", position: "BB" },
      { stack: 18, role: "villain", position: "BTN" },
    ],
    payouts: [100],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: 0,
  },
  // サテライト: 5 人卓、上位 3 人が同額入賞 (4 位以下は 0)。極端な ICM バブル圧。
  // hero は中堅スタック、villain は短いほうのバブル候補 (早いポジションから shove)。
  satellite3: {
    players: [
      { stack: 28, role: "other", position: "BTN" },
      { stack: 22, role: "hero", position: "BB" },
      { stack: 18, role: "other", position: "SB" },
      { stack: 15, role: "other", position: "CO" },
      { stack: 5, role: "villain", position: "UTG" },
    ],
    payouts: [33, 33, 33],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
};

function applyScenario(scenarioId: string): void {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return;
  // プレイヤーリスト置換
  players.length = 0;
  for (const p of scenario.players) {
    players.push({ id: allocPlayerId(), stack: p.stack, role: p.role, position: p.position });
  }
  renderPlayers();
  // ペイアウト
  setPayouts(scenario.payouts);
  // Nash パラメータ
  const sbEl = document.getElementById("nash-sb") as HTMLInputElement | null;
  const bbEl = document.getElementById("nash-bb") as HTMLInputElement | null;
  const anteEl = document.getElementById("nash-ante") as HTMLInputElement | null;
  if (sbEl) sbEl.value = String(scenario.sb);
  if (bbEl) bbEl.value = String(scenario.bb);
  if (anteEl) anteEl.value = String(scenario.ante);
  const radio = document.querySelector<HTMLInputElement>(
    `input[name="ante-mode"][value="${scenario.anteMode ?? "total"}"]`,
  );
  if (radio) radio.checked = true;
  // コール額/純利得を自動追従モードに戻す
  setCallManualOverride(false);
  recompute();
}

// ===== ユーザー定義シナリオ (保存・呼び出し・削除) =====
const USER_SCENARIOS_KEY = "poker-icm-user-scenarios";
interface UserScenario {
  name: string;
  s: Scenario;
}

function loadUserScenarios(): UserScenario[] {
  try {
    const raw = localStorage.getItem(USER_SCENARIOS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is UserScenario =>
        typeof x === "object" && x !== null && typeof (x as UserScenario).name === "string",
    );
  } catch {
    return [];
  }
}

function saveUserScenarios(list: UserScenario[]): void {
  try {
    localStorage.setItem(USER_SCENARIOS_KEY, JSON.stringify(list));
  } catch {
    /* quota error は無視 */
  }
}

function captureCurrentScenario(): Scenario {
  const sbV = Number(nashSbInput.value) || DEFAULT_SB;
  const bbV = Number(nashBbInput.value) || DEFAULT_BB;
  const anteV = Number(nashAnteInput.value) || 0;
  const anteMode =
    (document.querySelector<HTMLInputElement>(
      'input[name="ante-mode"]:checked',
    )?.value ?? "total") as "total" | "perPlayer";
  return {
    players: players.map((p) => ({
      stack: p.stack,
      role: p.role,
      position: p.position,
    })),
    payouts: payoutsArr.slice(),
    sb: sbV,
    bb: bbV,
    ante: anteV,
    anteMode,
  };
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderUserScenarios(): void {
  const container = document.getElementById("user-scenarios");
  if (!container) return;
  const list = loadUserScenarios();
  if (list.length === 0) {
    container.innerHTML = `<span class="hint" style="font-size:11px;color:var(--muted);">${tr("setup.userScenarios.empty")}</span>`;
    return;
  }
  container.innerHTML = list
    .map(
      (s, i) => `
      <span class="user-scenario-item" data-i="${i}">
        <button type="button" class="scenario-btn user-load">${escapeAttr(s.name)}</button>
        <button type="button" class="user-del" title="${tr("setup.common.delete")}">✕</button>
      </span>
    `,
    )
    .join("");
}

// ===== ペイアウト行管理 =====

const payoutsList = $<HTMLDivElement>("payouts-list");
const addPayoutBtn = $<HTMLButtonElement>("add-payout");
const MAX_PAYOUTS = 12;

function syncPayoutsInput(): void {
  payoutsInput.value = payoutsArr.join(", ");
}

function renderPayouts(): void {
  payoutsList.innerHTML = "";
  // freemium: 無料時はペイ構造の手編集をロック (readonly + 🔒)。
  // シナリオプリセット適用によるペイ変更 (setPayouts 経由) は許可 (プログラム的な差し替え)。
  const locked = !isPro();
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
  addPayoutBtn.disabled = !locked && payoutsArr.length >= MAX_PAYOUTS;
}

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

export function setPayouts(values: number[]): void {
  const sanitized = sanitizePayoutsArray(values);
  replacePayouts(sanitized.length > 0 ? sanitized : [100]);
  syncPayoutsInput();
  renderPayouts();
  recompute();
}

// ===== ペイ構造の保存・復元 =====

const PAYOUTS_KEY = "poker-icm-saved-payouts";
interface SavedPayout {
  name: string;
  value: string;
}

function loadSavedPayouts(): SavedPayout[] {
  try {
    const raw = localStorage.getItem(PAYOUTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SavedPayout =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as SavedPayout).name === "string" &&
        typeof (x as SavedPayout).value === "string",
    );
  } catch {
    return [];
  }
}

function persistSavedPayouts(list: SavedPayout[]): void {
  try {
    localStorage.setItem(PAYOUTS_KEY, JSON.stringify(list));
  } catch {
    /* quota error は無視 */
  }
}

const savedPayoutsContainer = $<HTMLDivElement>("saved-payouts");
const savePayoutBtn = $<HTMLButtonElement>("save-payout");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

// ===== メモ機能は UI から削除済み (オーナーフィードバック対応) =====
// 「📝 メモ」カードと入力 UI は削除したが、localStorage の既存データ
// ("poker-icm-scenario-memo") は消さずに残してある。将来 UI を復活させた際に
// 過去のメモを引き継げるようにするための措置。読み書きするコードはもう無い。

// ===== 折りたたみセクションの開閉状態を localStorage に永続化 =====
function initCollapsibleSection(detailsId: string, storageKey: string): void {
  const details = document.getElementById(detailsId) as HTMLDetailsElement | null;
  if (!details) return;
  try {
    // キー未設定 (初回起動) はデフォルトで開いた状態にする
    details.open = localStorage.getItem(storageKey) !== "closed";
  } catch {
    /* localStorage が使えない環境ではデフォルト (開) のまま */
  }
  details.addEventListener("toggle", () => {
    try {
      localStorage.setItem(storageKey, details.open ? "open" : "closed");
    } catch {
      /* quota error 等は無視 */
    }
  });
}

/** セットアップタブ全体 (プレイヤー・シナリオ・ペイ構造) の初期化。main.ts から一度だけ呼ぶ。 */
export function initSetup(): void {
  // イベントデリゲーション
  playersList.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const roleBtn = t.closest<HTMLButtonElement>(".role-btn");
    if (roleBtn) {
      const wrap = roleBtn.closest<HTMLDivElement>(".player-roles");
      const id = Number(wrap?.dataset.id);
      const role = roleBtn.dataset.role as Role;
      if (Number.isFinite(id) && role) setRole(id, role);
      return;
    }
    const remove = t.closest<HTMLButtonElement>(".player-remove");
    if (remove) {
      if (!isPro()) {
        openPaywall();
        return;
      }
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
    if (el.classList.contains("player-stack") && !isPro()) {
      e.preventDefault();
      openPaywall();
    }
  });
  playersList.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("player-stack") && !isPro()) {
      (el as HTMLInputElement).blur();
      openPaywall();
    }
  });

  playersList.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.classList.contains("player-stack")) return;
    if (!isPro()) return; // readonly のはずだが二重ガード
    const id = Number(t.dataset.id);
    if (Number.isFinite(id)) updateStack(id, Number(t.value));
  });

  playersList.addEventListener("change", (e) => {
    const t = e.target as HTMLSelectElement;
    if (!t.classList.contains("player-pos")) return;
    const id = Number(t.dataset.id);
    if (Number.isFinite(id)) setPosition(id, t.value as Position);
  });

  addPlayerBtn.addEventListener("click", () => {
    if (!isPro()) return openPaywall();
    addPlayer();
  });
  randomizeStacksBtn.addEventListener("click", () => {
    if (!isPro()) return openPaywall();
    randomizeStacks();
  });

  document.querySelectorAll<HTMLButtonElement>(".scenario-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.scenario;
      if (id) applyScenario(id);
    });
  });

  const saveScenarioBtn = document.getElementById("save-scenario-btn") as HTMLButtonElement | null;
  saveScenarioBtn?.classList.toggle("locked-pro", !isPro());
  saveScenarioBtn?.addEventListener("click", () => {
    if (!isPro()) return openPaywall();
    const name = window.prompt(tr("setup.prompt.scenarioName"), "");
    if (!name) return;
    const list = loadUserScenarios();
    list.push({ name: name.slice(0, 30), s: captureCurrentScenario() });
    saveUserScenarios(list);
    renderUserScenarios();
  });

  document.getElementById("user-scenarios")?.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const wrap = t.closest<HTMLSpanElement>(".user-scenario-item");
    if (!wrap) return;
    const idx = Number(wrap.dataset.i);
    const list = loadUserScenarios();
    if (t.classList.contains("user-del")) {
      if (window.confirm(tr("setup.confirm.deleteScenario"))) {
        list.splice(idx, 1);
        saveUserScenarios(list);
        renderUserScenarios();
      }
      return;
    }
    if (t.classList.contains("user-load")) {
      const s = list[idx]?.s;
      if (s) {
        players.length = 0;
        for (const p of s.players) {
          players.push({ id: allocPlayerId(), stack: p.stack, role: p.role, position: p.position });
        }
        renderPlayers();
        setPayouts(s.payouts);
        nashSbInput.value = String(s.sb);
        nashBbInput.value = String(s.bb);
        nashAnteInput.value = String(s.ante);
        const radio = document.querySelector<HTMLInputElement>(
          `input[name="ante-mode"][value="${s.anteMode ?? "total"}"]`,
        );
        if (radio) radio.checked = true;
        setCallManualOverride(false);
        recompute();
      }
    }
  });

  renderUserScenarios();

  // freemium: ロック中のペイ金額入力はタップ/フォーカスでペイウォール。
  // (スタック入力と同じく pointerdown で先取りし、focusin はフォールバック。)
  payoutsList.addEventListener("pointerdown", (e) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("payout-amount") && !isPro()) {
      e.preventDefault();
      openPaywall();
    }
  });
  payoutsList.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("payout-amount") && !isPro()) {
      (el as HTMLInputElement).blur();
      openPaywall();
    }
  });

  payoutsList.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.classList.contains("payout-amount")) return;
    if (!isPro()) return; // readonly のはずだが二重ガード
    const i = Number(t.dataset.i);
    const v = Number(t.value);
    if (Number.isFinite(i) && i >= 0 && i < payoutsArr.length) {
      payoutsArr[i] = Number.isFinite(v) && v >= 0 ? v : 0;
      syncPayoutsInput();
      recompute();
    }
  });

  payoutsList.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const remove = t.closest<HTMLButtonElement>(".payout-remove");
    if (!remove) return;
    if (!isPro()) {
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
    if (!isPro()) return openPaywall();
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
      btn.classList.toggle("locked-pro", !isPro());
      btn.addEventListener("click", () => {
        if (!isPro()) return openPaywall();
        const v = btn.dataset.preset;
        if (v) setPayouts(parseList(v));
      });
    });

  savedPayoutsContainer.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const wrap = t.closest<HTMLSpanElement>(".saved-preset");
    if (!wrap) return;
    if (!isPro()) {
      openPaywall();
      return;
    }
    const idx = Number(wrap.dataset.i);
    const list = loadSavedPayouts();
    if (t.classList.contains("del")) {
      list.splice(idx, 1);
      persistSavedPayouts(list);
      renderSavedPayouts();
      return;
    }
    if (t.classList.contains("load")) {
      setPayouts(parseList(t.dataset.value ?? ""));
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
    list.push({ name: name.slice(0, 24), value });
    persistSavedPayouts(list);
    renderSavedPayouts();
  });

  renderSavedPayouts();

  payoutsInput.addEventListener("input", recompute);

  initCollapsibleSection("scenario-presets-toggle", "poker-icm-collapse-scenario-presets");
  initCollapsibleSection("payout-presets-toggle", "poker-icm-collapse-payout-presets");

}
