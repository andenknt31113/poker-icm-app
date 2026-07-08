import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import {
  calculateBubbleFactor,
  calculateExactCallEquity,
  calculateICM,
  calculatePotOdds,
  calculateRequiredEquity,
  MAX_PLAYERS,
  solveHUNash,
  type PotOddsPosition,
} from "@poker-icm/core";
import {
  ALL_169_HANDS,
  handAt,
  topRange,
  type HandNotation,
} from "./handRanking.js";
import { approxEquity } from "./equityHeuristic.js";
import { tableEquityVsRange } from "./equityFromTable.js";
import { huEquity, hasHUMatrix } from "./huEquityMatrix.js";

/** Monte Carlo 事前計算テーブルを優先し、失敗時はヒューリスティックにフォールバック。 */
function equity(hand: HandNotation, vsRange: Set<HandNotation>): number {
  const v = tableEquityVsRange(hand, vsRange);
  if (v !== null && Number.isFinite(v)) return v;
  return approxEquity(hand, vsRange);
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el as T;
};

// ===== プレイヤー状態管理 =====

type Role = "hero" | "villain" | "other";
type Position = "" | "SB" | "BB" | "BTN" | "CO" | "HJ" | "LJ" | "MP" | "UTG+1" | "UTG";

/** 標準ブラインド (BB 単位)。プリセット/フォールバック値の単一情報源。 */
const DEFAULT_SB = 0.5;
const DEFAULT_BB = 1.0;
const DEFAULT_ANTE = 1.0; // BB ante 構造の標準値

/** Position → calculatePotOdds の position 種別 (SB / BB / OTHER) に変換。 */
function posToPotOddsPos(pos: Position | undefined): PotOddsPosition {
  if (pos === "SB") return "SB";
  if (pos === "BB") return "BB";
  return "OTHER";
}

/** N人テーブルでの時計回りポジション順（BTN起点）。 */
const POSITION_SETS: Record<number, Position[]> = {
  2: ["BTN", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "CO"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  7: ["BTN", "SB", "BB", "UTG", "MP", "HJ", "CO"],
  8: ["BTN", "SB", "BB", "UTG", "MP", "LJ", "HJ", "CO"],
  9: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "LJ", "HJ", "CO"],
};

function positionsForN(n: number): Position[] {
  return POSITION_SETS[n] ?? [];
}

interface Player {
  id: number;
  stack: number;
  role: Role;
  position: Position;
}

let nextId = 0;
const players: Player[] = [];

// localStorage 永続化キー
const STATE_KEY = "poker-icm-app-state-v1";
interface PersistedState {
  players: { stack: number; role: Role; position: Position }[];
  payouts: number[];
  nash: { sb: number; bb: number; ante: number; anteMode: "total" | "perPlayer" };
}

/**
 * 賞金配列のサニタイズ: 有限かつ非負の値のみ残す (parseList と同じ規則)。
 * 壊れた値 (負数・NaN・Infinity 等) は行ごと捨てる。
 * localStorage / 共有URL 経由で入り込んだ不正値がUI表示と実計算 (ICM) を
 * 乖離させるのを防ぐ。
 */
function sanitizePayoutsArray(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0,
  );
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(obj.players) || !Array.isArray(obj.payouts) || !obj.nash) {
      return null;
    }
    return { ...obj, payouts: sanitizePayoutsArray(obj.payouts) };
  } catch {
    return null;
  }
}

function saveState(): void {
  try {
    const sbEl = document.getElementById("nash-sb") as HTMLInputElement | null;
    const bbEl = document.getElementById("nash-bb") as HTMLInputElement | null;
    const anteEl = document.getElementById("nash-ante") as HTMLInputElement | null;
    const anteMode =
      (document.querySelector<HTMLInputElement>(
        'input[name="ante-mode"]:checked',
      )?.value ?? "total") as "total" | "perPlayer";
    const state: PersistedState = {
      players: players.map((p) => ({
        stack: p.stack,
        role: p.role,
        position: p.position,
      })),
      payouts: payoutsArr.length > 0 ? payoutsArr : [50, 30, 20],
      nash: {
        sb: sbEl ? Number(sbEl.value) || DEFAULT_SB : DEFAULT_SB,
        bb: bbEl ? Number(bbEl.value) || DEFAULT_BB : DEFAULT_BB,
        ante: anteEl ? Number(anteEl.value) || 0 : 0,
        anteMode,
      },
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* quota / serialize エラーは無視 */
  }
}

// デフォルト状態（初回起動時）
const DEFAULT_PLAYERS: { stack: number; role: Role; position: Position }[] = [
  { stack: 14, role: "hero", position: "SB" },
  { stack: 23, role: "villain", position: "BB" },
  { stack: 8, role: "other", position: "BTN" },
  { stack: 8, role: "other", position: "CO" },
  { stack: 8, role: "other", position: "HJ" },
  { stack: 8, role: "other", position: "LJ" },
];

// 起動時に state を復元
const persistedState = loadState();
const initialPlayers = persistedState?.players ?? DEFAULT_PLAYERS;
for (const p of initialPlayers) {
  players.push({
    id: nextId++,
    stack: p.stack,
    role: p.role,
    position: p.position,
  });
}

// ===== DOM参照 =====
const playersList = $<HTMLDivElement>("players-list");
const addPlayerBtn = $<HTMLButtonElement>("add-player");
const randomizeStacksBtn = $<HTMLButtonElement>("randomize-stacks");
const payoutsInput = $<HTMLInputElement>("payouts");
const callInput = $<HTMLInputElement>("call");
const potWinInput = $<HTMLInputElement>("potwin");
const autofillBtn = $<HTMLButtonElement>("autofill-call");
const autofillHint = $<HTMLParagraphElement>("autofill-hint");
const icmRows = $<HTMLTableSectionElement>("icm-rows");
const bfResult = $<HTMLDivElement>("bf-result");
const bfMatrix = $<HTMLDivElement>("bf-matrix");
const eqResult = $<HTMLDivElement>("eq-result");
const pushRangeInput = $<HTMLInputElement>("push-range");
const pushPctLabel = $<HTMLSpanElement>("push-pct");
const villainGrid = $<HTMLDivElement>("grid-villain");
const heroGrid = $<HTMLDivElement>("grid-hero");
const callStats = $<HTMLParagraphElement>("call-stats");
const presetControls = $<HTMLDivElement>("preset-controls");
const customControls = $<HTMLDivElement>("custom-controls");
const customCount = $<HTMLSpanElement>("custom-count");
const customPct = $<HTMLSpanElement>("custom-pct");
const customClearBtn = $<HTMLButtonElement>("custom-clear");
const customFromPresetBtn = $<HTMLButtonElement>("custom-from-preset");

// ===== ユーティリティ =====

// セクション 5 のコール額/純利得を手動編集したかどうかのフラグ。
// true の間は自動更新を抑制。シナリオ変更や autofill ボタンで false にリセット。
let callManualOverride = false;

function parseList(v: string): number[] {
  return v
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return n === Number.POSITIVE_INFINITY ? "∞" : "—";
  return n.toFixed(digits);
}

function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

// ===== プレイヤーUI =====

function renderPlayers(): void {
  playersList.innerHTML = "";
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
      <input type="number" inputmode="decimal" class="player-stack" min="0" step="1" value="${p.stack}" data-id="${p.id}" />
      <span class="player-unit">BB</span>
      <select class="player-pos" data-id="${p.id}" title="ポジション">${posOptions}</select>
      <div class="player-roles" data-id="${p.id}">
        <button type="button" class="role-btn ${p.role === "hero" ? "active hero" : ""}" data-role="hero" title="自分">🎯</button>
        <button type="button" class="role-btn ${p.role === "villain" ? "active villain" : ""}" data-role="villain" title="相手">⚔️</button>
        <button type="button" class="role-btn ${p.role === "other" ? "active" : ""}" data-role="other" title="その他">·</button>
      </div>
      <button type="button" class="player-remove" data-id="${p.id}" title="削除" ${players.length <= 2 ? "disabled" : ""}>✕</button>
    `;
    playersList.appendChild(row);
  });

  addPlayerBtn.disabled = players.length >= MAX_PLAYERS;
  addPlayerBtn.textContent =
    players.length >= MAX_PLAYERS
      ? `(最大 ${MAX_PLAYERS} 人)`
      : "+ プレイヤー追加";
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
    id: nextId++,
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
    const id = Number(remove.dataset.id);
    if (Number.isFinite(id)) removePlayer(id);
  }
});

playersList.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (!t.classList.contains("player-stack")) return;
  const id = Number(t.dataset.id);
  if (Number.isFinite(id)) updateStack(id, Number(t.value));
});

playersList.addEventListener("change", (e) => {
  const t = e.target as HTMLSelectElement;
  if (!t.classList.contains("player-pos")) return;
  const id = Number(t.dataset.id);
  if (Number.isFinite(id)) setPosition(id, t.value as Position);
});

addPlayerBtn.addEventListener("click", addPlayer);

function randomizeStacks(): void {
  // 3 〜 30 BB のランダム整数。トナメ終盤の幅広いスタックを再現。
  for (const p of players) {
    p.stack = 3 + Math.floor(Math.random() * 28); // 3..30
  }
  renderPlayers();
  recompute();
}

randomizeStacksBtn.addEventListener("click", randomizeStacks);

// ===== シナリオプリセット =====

interface Scenario {
  players: { stack: number; role: Role; position: Position }[];
  payouts: number[];
  sb: number;
  bb: number;
  ante: number; // テーブル合計
  anteMode?: "total" | "perPlayer"; // 省略時は "total" 扱い (組み込みプリセット)
}

const SCENARIOS: Record<string, Scenario> = {
  ft9: {
    players: [
      { stack: 35, role: "hero", position: "BTN" },
      { stack: 28, role: "villain", position: "SB" },
      { stack: 22, role: "other", position: "BB" },
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
      { stack: 4, role: "hero", position: "BTN" },
      { stack: 18, role: "villain", position: "SB" },
      { stack: 22, role: "other", position: "BB" },
      { stack: 16, role: "other", position: "CO" },
    ],
    payouts: [50, 30, 20],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ft6: {
    players: [
      { stack: 18, role: "hero", position: "BTN" },
      { stack: 12, role: "villain", position: "SB" },
      { stack: 22, role: "other", position: "BB" },
      { stack: 8, role: "other", position: "UTG" },
      { stack: 14, role: "other", position: "HJ" },
      { stack: 10, role: "other", position: "CO" },
    ],
    payouts: [45, 25, 15, 8, 4, 3],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ft4: {
    players: [
      { stack: 12, role: "hero", position: "BTN" },
      { stack: 18, role: "villain", position: "SB" },
      { stack: 8, role: "other", position: "BB" },
      { stack: 15, role: "other", position: "CO" },
    ],
    payouts: [50, 30, 15, 5],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ft3: {
    players: [
      { stack: 18, role: "hero", position: "BTN" },
      { stack: 14, role: "villain", position: "SB" },
      { stack: 20, role: "other", position: "BB" },
    ],
    payouts: [50, 30, 20],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  hu: {
    players: [
      { stack: 10, role: "hero", position: "BTN" },
      { stack: 10, role: "villain", position: "BB" },
    ],
    payouts: [100],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: 0,
  },
  huShort: {
    players: [
      { stack: 5, role: "hero", position: "BTN" },
      { stack: 18, role: "villain", position: "BB" },
    ],
    payouts: [100],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: 0,
  },
  // サテライト: 5 人卓、上位 3 人が同額入賞 (4 位以下は 0)。極端な ICM バブル圧。
  // hero は中堅スタック、villain は短いほうのバブル候補。
  satellite3: {
    players: [
      { stack: 28, role: "other", position: "BTN" },
      { stack: 22, role: "hero", position: "SB" },
      { stack: 18, role: "other", position: "BB" },
      { stack: 15, role: "other", position: "CO" },
      { stack: 5, role: "villain", position: "HJ" },
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
    players.push({ id: nextId++, stack: p.stack, role: p.role, position: p.position });
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
  callManualOverride = false;
  recompute();
}

document.querySelectorAll<HTMLButtonElement>(".scenario-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.scenario;
    if (id) applyScenario(id);
  });
});

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
    container.innerHTML = `<span class="hint" style="font-size:11px;color:var(--muted);">まだ保存なし。「＋ 現在の状況を保存」を押すと追加</span>`;
    return;
  }
  container.innerHTML = list
    .map(
      (s, i) => `
      <span class="user-scenario-item" data-i="${i}">
        <button type="button" class="scenario-btn user-load">${escapeAttr(s.name)}</button>
        <button type="button" class="user-del" title="削除">✕</button>
      </span>
    `,
    )
    .join("");
}

const saveScenarioBtn = document.getElementById("save-scenario-btn") as HTMLButtonElement | null;
saveScenarioBtn?.addEventListener("click", () => {
  const name = window.prompt("シナリオ名を入力", "");
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
    if (window.confirm("このシナリオを削除しますか？")) {
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
        players.push({ id: nextId++, stack: p.stack, role: p.role, position: p.position });
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
      callManualOverride = false;
      recompute();
    }
  }
});

renderUserScenarios();

// ===== メイン計算 =====

function recompute(): void {
  try {
    const stacks = players.map((p) => p.stack);
    const payouts = parseList(payoutsInput.value);

    if (stacks.length === 0) throw new Error("プレイヤーを1人以上入れてください");
    if (payouts.length === 0) throw new Error("賞金を1つ以上入れてください");

    const heroIndex = players.findIndex((p) => p.role === "hero");
    const villainIndex = players.findIndex((p) => p.role === "villain");

    // ICM
    const equities = calculateICM(stacks, payouts);
    const totalPrize = payouts.reduce((a, b) => a + b, 0);
    icmRows.innerHTML = stacks
      .map((stack, i) => {
        const eq = equities[i] ?? 0;
        const pct = totalPrize > 0 ? eq / totalPrize : 0;
        const role = players[i]?.role;
        const tag =
          role === "hero" ? " 🎯" : role === "villain" ? " ⚔️" : "";
        const rowClass = role === "hero" ? ' class="hero-row"' : "";
        return `<tr${rowClass}>
          <td>${i + 1}${tag}</td>
          <td>${stack}</td>
          <td>${fmt(eq, 3)}</td>
          <td>${fmtPct(pct, 1)}</td>
        </tr>`;
      })
      .join("");

    // BF
    let bf = 1.0;
    if (heroIndex < 0 || villainIndex < 0) {
      bfResult.innerHTML = `<div class="error">🎯自分と⚔️相手を1人ずつ指定してください</div>`;
    } else if (heroIndex === villainIndex) {
      // データモデル上到達不能: Player.role は単一の文字列 ("hero" | "villain" | "other")
      // であり、1人が hero と villain を同時に兼ねることはできない。findIndex が
      // 同じ index を返すのは heroIndex/villainIndex が両方 -1 の場合のみだが、
      // それは直前の分岐で既に弾かれている。防御的に残す。
      bfResult.innerHTML = `<div class="error">🎯自分と⚔️相手は別の人にしてください</div>`;
    } else {
      const heroStack = stacks[heroIndex]!;
      const villainStack = stacks[villainIndex]!;
      const safeRisk = Math.min(heroStack, villainStack);
      if (safeRisk <= 0) {
        bfResult.innerHTML = `<div class="error">スタックが0なのでBF計算不可</div>`;
      } else {
        const r = calculateBubbleFactor({
          stacks,
          payouts,
          heroIndex,
          villainIndex,
          riskChips: safeRisk,
        });
        bf = r.bf;
        bfResult.innerHTML = `
          <div class="row"><span class="label">BF</span><span class="value big">${fmt(r.bf, 3)}</span></div>
          <div class="row"><span class="label">現在の $ エクイティ</span><span class="value">${fmt(r.equityNow, 3)}</span></div>
          <div class="row"><span class="label">勝ち時 $ エクイティ</span><span class="value">${fmt(r.equityWin, 3)}</span></div>
          <div class="row"><span class="label">負け時 $ エクイティ</span><span class="value">${fmt(r.equityLose, 3)}</span></div>
          <div class="row"><span class="label">リスクチップ</span><span class="value">${safeRisk}</span></div>
        `;
      }
    }

    // BF マトリックス（全員 vs 全員）
    renderBFMatrix(stacks, payouts);

    // 必要勝率: hero/villain あれば自動更新 (BB ante 構造、ante は dead)
    if (
      heroIndex >= 0 &&
      villainIndex >= 0 &&
      heroIndex !== villainIndex
    ) {
      const sbV = Number(nashSbInput?.value) || DEFAULT_SB;
      const bbV = Number(nashBbInput?.value) || DEFAULT_BB;
      const totalAnteV = Number(nashAnteInput?.value) || 0;
      const heroPos = players[heroIndex]?.position;
      const villainPos = players[villainIndex]?.position;
      const r = calculatePotOdds({
        heroStack: stacks[heroIndex]!,
        villainStack: stacks[villainIndex]!,
        heroPosition: posToPotOddsPos(heroPos),
        villainPosition: posToPotOddsPos(villainPos),
        sb: sbV, bb: bbV, ante: totalAnteV,
      });
      if (r.matched > 0 && !callManualOverride) {
        callInput.value = r.callAmount.toFixed(1);
        potWinInput.value = r.potIfWin.toFixed(1);
        const heroStackV = stacks[heroIndex]!;
        const heroAntePaid = heroPos === "BB" ? totalAnteV : 0;
        const villainAntePaid = villainPos === "BB" ? totalAnteV : 0;
        const heroBlindPaid = r.heroLiveCommit;
        const heroSunk = heroAntePaid + heroBlindPaid;
        const heroLive = heroStackV - heroSunk;
        const stackIfFold = heroLive;
        const stackIfLose = heroLive - r.callAmount;
        const stackIfWin = stackIfLose + r.potAtShowdown;
        const netWin = stackIfWin - heroStackV;
        const netLose = stackIfLose - heroStackV;
        const netFold = stackIfFold - heroStackV;
        const fmt = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1);
        // ante は会計上 dead だが「誰が払ったか」をラベルで明示する
        const anteOwnerLabel = heroAntePaid > 0
          ? `自分(${heroPos})`
          : villainAntePaid > 0
            ? `相手(${villainPos})`
            : null; // どちらも BB じゃない (前任 BB folded)
        autofillHint.innerHTML = `
          <details class="autofill-details" open>
            <summary>✓ 追加 call <strong>${r.callAmount.toFixed(1)}</strong> / 純利得 <strong>${r.potIfWin.toFixed(1)}</strong> BB <span style="color: var(--muted); font-size: 11px;">(タップで内訳)</span></summary>
            <div class="autofill-body">
              <div class="autofill-section">
                <div class="autofill-h">📊 ポット構成</div>
                <ul class="autofill-list">
                  ${heroBlindPaid > 0 ? `<li>自分(${heroPos}) blind: <code>${heroBlindPaid.toFixed(1)}</code> <span class="muted">(sunk)</span></li>` : ""}
                  ${heroAntePaid > 0 ? `<li>自分(${heroPos}) ante: <code>${heroAntePaid.toFixed(1)}</code> <span class="muted">(sunk, BB全額)</span></li>` : ""}
                  ${r.deadBreakdown.sbDead > 0 ? `<li>SB dead: <code>${r.deadBreakdown.sbDead.toFixed(1)}</code> <span class="muted">(SB folded)</span></li>` : ""}
                  ${r.deadBreakdown.bbDead > 0 ? `<li>BB dead: <code>${r.deadBreakdown.bbDead.toFixed(1)}</code> <span class="muted">(BB folded)</span></li>` : ""}
                  ${villainAntePaid > 0 ? `<li>相手(${villainPos}) ante: <code>${villainAntePaid.toFixed(1)}</code> <span class="muted">(sunk, BB全額)</span></li>` : ""}
                  ${r.deadBreakdown.anteDead > 0 && anteOwnerLabel === null ? `<li>ante dead: <code>${r.deadBreakdown.anteDead.toFixed(1)}</code> <span class="muted">(前任 BB folded)</span></li>` : ""}
                  <li>自分これから払う <strong>call</strong>: <code>${r.callAmount.toFixed(1)}</code></li>
                  <li>相手(${villainPos}) push (live): <code>${(r.matched - r.villainLiveCommit).toFixed(1)}</code>${r.villainLiveCommit > 0 ? ` + 既出 blind ${r.villainLiveCommit.toFixed(1)}` : ""} = <code>${r.matched.toFixed(1)}</code></li>
                  <li><strong>合計 pot: ${r.potAtShowdown.toFixed(1)} BB</strong></li>
                </ul>
              </div>
              <div class="autofill-section">
                <div class="autofill-h">⚖️ コール vs フォールド</div>
                <table class="autofill-table">
                  <tr><th>選択</th><th>残スタック</th><th>vs fold</th><th>起点比</th></tr>
                  <tr><td>fold</td><td>${stackIfFold.toFixed(1)}</td><td>±0</td><td class="${netFold >= 0 ? 'good' : 'bad'}">${fmt(netFold)}</td></tr>
                  <tr><td>call+win</td><td>${stackIfWin.toFixed(1)}</td><td class="good">+${r.potIfWin.toFixed(1)}</td><td class="${netWin >= 0 ? 'good' : 'bad'}">${fmt(netWin)}</td></tr>
                  <tr><td>call+lose</td><td>${stackIfLose.toFixed(1)}</td><td class="bad">-${r.callAmount.toFixed(1)}</td><td class="bad">${fmt(netLose)}</td></tr>
                </table>
              </div>
            </div>
          </details>
        `;
      }
    }
    const callAmount = Number(callInput.value);
    const potIfWin = Number(potWinInput.value);
    const eq = calculateRequiredEquity({
      callAmount,
      potIfWin,
      bubbleFactor: bf,
    });

    const rpSign = eq.riskPremium >= 0 ? "+" : "";
    eqResult.innerHTML = `
      <div class="eq-flow">
        <div class="eq-flow-item eq-flow-cev">
          <div class="eq-flow-label">cEV</div>
          <div class="eq-flow-value">${fmtPct(eq.cEV)}</div>
        </div>
        <div class="eq-flow-arrow">→</div>
        <div class="eq-flow-item eq-flow-rp">
          <div class="eq-flow-label">+ Risk Premium</div>
          <div class="eq-flow-value">${rpSign}${fmtPct(eq.riskPremium, 2)}</div>
        </div>
        <div class="eq-flow-arrow">→</div>
        <div class="eq-flow-item eq-flow-final">
          <div class="eq-flow-label">$EV (True Req)</div>
          <div class="eq-flow-value">${fmtPct(eq.dollarEV)}</div>
        </div>
      </div>
    `;

    // レンジ比較
    renderRangeComparison(eq.dollarEV);

    // 🃏 ハンド別判定 (🎯自分/⚔️相手が両方指定されている時のみ有効)
    updateHandVerdictRequiredEquity(
      heroIndex >= 0 && villainIndex >= 0 && heroIndex !== villainIndex ? eq.dollarEV : null,
    );

    // Hero サマリー
    renderHeroSummary({
      heroIndex,
      villainIndex,
      stacks,
      payouts,
      heroEq: heroIndex >= 0 ? equities[heroIndex] ?? 0 : 0,
      villainEq: villainIndex >= 0 ? equities[villainIndex] ?? 0 : 0,
      totalPrize,
      bf,
      requiredEq: eq.dollarEV,
      rp: eq.riskPremium,
    });

    // 状態を保存
    saveState();
    updateNashOvercallWarn();
    updatePositionWarn(heroIndex, villainIndex);
    updateHandPositionBanner(heroIndex);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    icmRows.innerHTML = `<tr><td colspan="4" class="error">${msg}</td></tr>`;
    bfResult.innerHTML = "";
    eqResult.innerHTML = "";
    heroSummaryEl.classList.remove("active");
    updateHandVerdictRequiredEquity(null);
  }
}

// ===== Hero サマリーカード =====
const heroSummaryEl = $<HTMLDivElement>("hero-summary");

interface HeroSummaryArg {
  heroIndex: number;
  villainIndex: number;
  stacks: number[];
  payouts: number[];
  heroEq: number;
  villainEq: number;
  totalPrize: number;
  bf: number;
  requiredEq: number;
  rp: number;
}

function renderHeroSummary(a: HeroSummaryArg): void {
  if (a.heroIndex < 0) {
    heroSummaryEl.classList.remove("active");
    return;
  }
  heroSummaryEl.classList.add("active");
  const heroStack = a.stacks[a.heroIndex]!;
  const heroPos = players[a.heroIndex]?.position || "—";
  const heroEqPct = a.totalPrize > 0 ? (a.heroEq / a.totalPrize) * 100 : 0;

  const hasVillain = a.villainIndex >= 0;
  const villainStack = hasVillain ? a.stacks[a.villainIndex]! : 0;
  const villainPos = hasVillain ? players[a.villainIndex]?.position || "—" : "—";
  const villainEqPct =
    hasVillain && a.totalPrize > 0 ? (a.villainEq / a.totalPrize) * 100 : 0;

  // BF 色
  let bfClass = "accent";
  if (a.bf < 0.95) bfClass = "good";
  else if (a.bf > 1.15) bfClass = "bad";
  else if (a.bf > 1.05) bfClass = "warn";

  const villainRow = hasVillain
    ? `
      <div class="hero-summary-row villain">
        <div class="hero-summary-row-label">⚔️ 相手</div>
        <div class="hero-summary-row-stat">${villainStack}<span class="unit">BB</span></div>
        <div class="hero-summary-row-stat">${villainPos}</div>
        <div class="hero-summary-row-stat accent">${villainEqPct.toFixed(1)}<span class="unit">%</span></div>
      </div>`
    : `<div class="hero-summary-row villain muted-row">⚔️ 相手未指定</div>`;

  // 周りスタック (hero/villain 以外)
  const otherStacks = a.stacks
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => i !== a.heroIndex && i !== a.villainIndex)
    .map(({ s, i }) => `${players[i]?.position || "?"} ${s}`)
    .join(", ");
  const payoutText = a.payouts.length > 0 ? a.payouts.join("/") : "—";
  const contextLine = `
    <div class="hero-summary-context">
      <span>💰 <strong>${payoutText}</strong></span>
      ${otherStacks ? `<span>👥 周り <strong>${otherStacks}</strong> BB</span>` : ""}
    </div>
  `;

  heroSummaryEl.innerHTML = `
    <div class="hero-summary-title">状況サマリー (タップ＝用語解説)</div>
    ${contextLine}
    <div class="hero-summary-row hero">
      <div class="hero-summary-row-label">🎯 自分</div>
      <div class="hero-summary-row-stat">${heroStack}<span class="unit">BB</span></div>
      <div class="hero-summary-row-stat">${heroPos}</div>
      <div class="hero-summary-row-stat accent tappable" data-info="ICM">${heroEqPct.toFixed(1)}<span class="unit">%</span></div>
    </div>
    ${villainRow}
    <div class="hero-summary-grid">
      <div class="hero-summary-item" data-info="BF">
        <div class="hero-summary-label tappable">BF ⓘ</div>
        <div class="hero-summary-value ${bfClass}">${a.bf.toFixed(2)}</div>
      </div>
      <div class="hero-summary-item" data-info="必要勝率">
        <div class="hero-summary-label tappable">必要勝率 ⓘ</div>
        <div class="hero-summary-value">${(a.requiredEq * 100).toFixed(1)}<span class="unit">%</span></div>
      </div>
      <div class="hero-summary-item" data-info="RP">
        <div class="hero-summary-label tappable">RP ⓘ</div>
        <div class="hero-summary-value warn">+${(a.rp * 100).toFixed(1)}<span class="unit">%</span></div>
      </div>
    </div>
  `;
}

// ===== BF マトリックス =====

/** BF を hue（緑 → 黄 → 赤）に対応付けて HSL 文字列を返す。 */
function bfBackground(bf: number): string {
  if (!Number.isFinite(bf)) return "#444";
  const clamped = Math.max(0.6, Math.min(1.4, bf));
  // 0.6 → hue 130 (deep green), 1.0 → hue 60 (yellow), 1.4 → hue 0 (red)
  const t = (clamped - 0.6) / 0.8;
  const hue = 130 - t * 130;
  // 1.0 付近は彩度を抑え、両端は強める
  const sat = 50 + Math.abs(clamped - 1.0) * 30;
  const light = 32 - Math.abs(clamped - 1.0) * 4;
  return `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
}

/** BF を所与に、1:1ポット時の Risk Premium を返す（百分率）。 */
function bfRiskPremiumPct(bf: number): number {
  if (!Number.isFinite(bf)) return 0;
  // cEV breakeven (1:1 ポット) = 50%
  // $EV breakeven = bf / (bf + 1)
  return (bf / (bf + 1) - 0.5) * 100;
}

function renderBFMatrix(stacks: number[], payouts: number[]): void {
  const n = stacks.length;
  if (n < 2) {
    bfMatrix.innerHTML = "";
    return;
  }

  // CSS Grid: 1列目はラベル列、残り n 列はデータ。すべて 1fr。
  bfMatrix.style.gridTemplateColumns = `auto repeat(${n}, 1fr)`;

  const cells: string[] = [];

  // ラベル: ポジ指定があればポジ表記、なければ P1/P2/...
  const labelOf = (idx: number): string => {
    const pos = players[idx]?.position;
    if (pos && pos.length > 0) return pos;
    return `P${idx + 1}`;
  };

  // 1行目: 角空白 + ヘッダ
  cells.push('<div class="bf-hdr-corner"></div>');
  for (let j = 0; j < n; j++) {
    cells.push(
      `<div class="bf-hdr-col">${labelOf(j)}<span class="stack-info">${stacks[j]}</span></div>`,
    );
  }

  // 2行目以降
  for (let i = 0; i < n; i++) {
    cells.push(
      `<div class="bf-hdr-row">${labelOf(i)}<span class="stack-info">${stacks[i]}</span></div>`,
    );
    for (let j = 0; j < n; j++) {
      if (i === j) {
        cells.push('<div class="bf-diag"></div>');
        continue;
      }
      const heroStack = stacks[i]!;
      const villainStack = stacks[j]!;
      const risk = Math.min(heroStack, villainStack);
      if (risk <= 0) {
        cells.push('<div class="bf-cell" style="background:#222">—</div>');
        continue;
      }
      try {
        const r = calculateBubbleFactor({
          stacks,
          payouts,
          heroIndex: i,
          villainIndex: j,
          riskChips: risk,
        });
        const bg = bfBackground(r.bf);
        const rp = bfRiskPremiumPct(r.bf);
        const rpStr = (rp >= 0 ? "+" : "") + rp.toFixed(1);
        cells.push(
          `<div class="bf-cell" style="background:${bg}"><span class="bf-rp">${rpStr}%</span><span class="bf-val">${r.bf.toFixed(2)}</span></div>`,
        );
      } catch {
        cells.push('<div class="bf-cell" style="background:#444">—</div>');
      }
    }
  }

  bfMatrix.innerHTML = cells.join("");
}

// ===== レンジ比較ロジック =====

function renderGrid(
  container: HTMLDivElement,
  classifier: (hand: HandNotation) => string,
): void {
  const cells: string[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = handAt(row, col);
      const extra = classifier(hand);
      const isPair = row === col;
      cells.push(
        `<div class="hand-cell ${isPair ? "pair" : ""} ${extra}" title="${hand}">${hand}</div>`,
      );
    }
  }
  container.innerHTML = cells.join("");
}

// レンジ比較の状態
type RangeMode = "preset" | "custom";
let villainRangeMode: RangeMode = "preset";
// 方向: callBack = 相手 push → 自分 call (従来), pushBack = 相手 call → 自分 push (逆算)
type Direction = "callBack" | "pushBack";
let direction: Direction = "callBack";
const customVillainRange = new Set<HandNotation>();

const STORAGE_KEY = "poker-icm-custom-range";
function loadCustomRange(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      customVillainRange.clear();
      for (const h of arr) customVillainRange.add(h);
    }
  } catch {
    // ignore parse error
  }
}
function saveCustomRange(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(customVillainRange)),
    );
  } catch {
    // ignore quota error
  }
}

function getCurrentVillainRange(): Set<HandNotation> {
  if (villainRangeMode === "custom") return customVillainRange;
  return topRange(Number(pushRangeInput.value));
}

// 「相手 call → 自分 push (逆算)」モード用: 相手 call レンジを所与に
// hero がどのハンドで push +EV になるかを計算
interface PushBackResult {
  pushRange: Set<HandNotation>;
  marginal: Set<HandNotation>;
}

function computePushBackRange(villainCallRange: Set<HandNotation>): PushBackResult {
  const heroIdx = players.findIndex((p) => p.role === "hero");
  const villainIdx = players.findIndex((p) => p.role === "villain");
  const empty: PushBackResult = { pushRange: new Set(), marginal: new Set() };
  if (heroIdx < 0 || villainIdx < 0 || heroIdx === villainIdx) return empty;

  const stacks = players.map((p) => p.stack);
  if (stacks[heroIdx]! <= 0 || stacks[villainIdx]! <= 0) return empty;
  const payouts = parseList(payoutsInput.value);
  if (payouts.length === 0) return empty;

  const sb = Number(nashSbInput.value) || DEFAULT_SB;
  const bb = Number(nashBbInput.value) || DEFAULT_BB;
  const anteRaw = Number(nashAnteInput.value) || 0;
  const anteMode =
    (document.querySelector<HTMLInputElement>(
      'input[name="ante-mode"]:checked',
    )?.value ?? "total") as "total" | "perPlayer";
  const ante =
    anteMode === "perPlayer" ? anteRaw : anteRaw / Math.max(1, stacks.length);
  const totalAnte = ante * stacks.length;

  const baseStacks = stacks.map((s) => s - ante);
  if (baseStacks[heroIdx]! - sb < 0 || baseStacks[villainIdx]! - bb < 0) {
    return empty;
  }
  const matched = Math.min(baseStacks[heroIdx]!, baseStacks[villainIdx]!);

  function icmAt(hStack: number, vStack: number): number {
    const s = baseStacks.slice();
    s[heroIdx] = Math.max(0, hStack);
    s[villainIdx] = Math.max(0, vStack);
    return calculateICM(s, payouts)[heroIdx]!;
  }

  // hero(=pusher) 視点の各シナリオ ICM
  const foldEq = icmAt(baseStacks[heroIdx]! - sb, baseStacks[villainIdx]! + sb + totalAnte);
  const stealEq = icmAt(baseStacks[heroIdx]! + bb + totalAnte, baseStacks[villainIdx]! - bb);
  const winEq = icmAt(baseStacks[heroIdx]! + matched + totalAnte, baseStacks[villainIdx]! - matched);
  const loseEq = icmAt(baseStacks[heroIdx]! - matched, baseStacks[villainIdx]! + matched + totalAnte);

  // combo weight
  const comboCount = (h: HandNotation): number => {
    if (h.length === 2) return 6;
    return h[2] === "s" ? 4 : 12;
  };
  let totalCombos = 0;
  let callCombos = 0;
  for (const h of ALL_169_HANDS) {
    const c = comboCount(h);
    totalCombos += c;
    if (villainCallRange.has(h)) callCombos += c;
  }
  const foldRate = (totalCombos - callCombos) / totalCombos;

  const pushRange = new Set<HandNotation>();
  const marginal = new Set<HandNotation>();
  for (const heroHand of ALL_169_HANDS) {
    let evPush = foldRate * stealEq;
    if (callCombos > 0) {
      let sdSum = 0;
      for (const v of villainCallRange) {
        const w = comboCount(v);
        const heq = huEquity(heroHand, v);
        sdSum += w * (heq * winEq + (1 - heq) * loseEq);
      }
      evPush += sdSum / totalCombos;
    }
    const margin = evPush - foldEq;
    // foldEq の 0.5% を 1 単位として境界判定 (0=境界、+で push、-で fold)
    const norm = foldEq > 0 ? margin / foldEq : margin;
    if (norm >= 0.005) pushRange.add(heroHand);
    else if (norm >= -0.003) marginal.add(heroHand);
  }
  return { pushRange, marginal };
}

function renderRangeComparison(requiredEquity: number): void {
  const pushPct = Number(pushRangeInput.value);
  pushPctLabel.textContent = String(pushPct);

  const villainRange = getCurrentVillainRange();

  // カスタム時はクリック可能スタイルを付与
  if (villainRangeMode === "custom") {
    villainGrid.classList.add("editable");
  } else {
    villainGrid.classList.remove("editable");
  }

  // 方向に応じてラベルを切替
  const villainGridTitle = document.getElementById("villain-grid-title");
  const heroGridTitle = document.getElementById("hero-grid-title");
  const villainRangeLabel = document.getElementById("villain-range-label");
  if (direction === "callBack") {
    if (villainGridTitle) villainGridTitle.textContent = "相手のpushレンジ 🔴";
    if (heroGridTitle) heroGridTitle.textContent = "自分のcallレンジ 🟢";
    if (villainRangeLabel) villainRangeLabel.textContent = "相手のpushレンジ";
  } else {
    if (villainGridTitle) villainGridTitle.textContent = "相手のcallレンジ 🟢";
    if (heroGridTitle) heroGridTitle.textContent = "自分のpushレンジ 🔴";
    if (villainRangeLabel) villainRangeLabel.textContent = "相手のcallレンジ";
  }

  // 色ルール: push = 赤 (in-range-villain), call = 緑 (in-range-hero)
  // callBack 方向: villain=push(赤), hero=call(緑) ← 従来通り
  // pushBack 方向: villain=call(緑), hero=push(赤) ← 反転
  const villainClass = direction === "callBack" ? "in-range-villain" : "in-range-hero";
  const heroPushClass = direction === "callBack" ? "in-range-hero" : "in-range-villain";

  renderGrid(villainGrid, (hand) =>
    villainRange.has(hand) ? villainClass : "",
  );

  const totalHands = ALL_169_HANDS.length;

  if (direction === "callBack") {
    // 既存ロジック: 相手 push に対し自分 call できるハンド
    let callable = 0;
    let marginal = 0;
    renderGrid(heroGrid, (hand) => {
      const eq = equity(hand, villainRange);
      const margin = eq - requiredEquity;
      if (margin >= 0.03) {
        callable++;
        return heroPushClass;
      }
      if (margin >= -0.02) {
        marginal++;
        return "marginal";
      }
      return "";
    });
    const callPct = ((callable / totalHands) * 100).toFixed(0);
    callStats.innerHTML = `必要勝率 <strong>${(requiredEquity * 100).toFixed(1)}%</strong> 以上のハンド: <strong>${callable}</strong>個 (Top ${callPct}%) ／ ボーダーライン: ${marginal}個`;
  } else {
    // 逆算: 相手 call (villainRange) に対し自分が push +EV になるハンド
    const result = computePushBackRange(villainRange);
    renderGrid(heroGrid, (hand) => {
      if (result.pushRange.has(hand)) return heroPushClass;
      if (result.marginal.has(hand)) return "marginal";
      return "";
    });
    const pPct = ((result.pushRange.size / totalHands) * 100).toFixed(1);
    callStats.innerHTML = `相手が call <strong>${((villainRange.size / totalHands) * 100).toFixed(0)}%</strong> してくる前提で、自分が push +EV のハンド: <strong>${result.pushRange.size}</strong>個 (${pPct}%) ／ ボーダー: ${result.marginal.size}個。<br />相手が call ワイドだと push を狭めるべき方向に動きます。`;
  }

  // カスタムモードのカウント表示
  if (villainRangeMode === "custom") {
    const c = customVillainRange.size;
    customCount.textContent = String(c);
    customPct.textContent = ((c / totalHands) * 100).toFixed(0);
  }
}

// モード切替
document.querySelectorAll<HTMLButtonElement>(".mode-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll<HTMLButtonElement>(".mode-tab")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    villainRangeMode = btn.dataset.mode as RangeMode;
    if (villainRangeMode === "preset") {
      presetControls.classList.remove("hidden");
      customControls.classList.add("hidden");
    } else {
      presetControls.classList.add("hidden");
      customControls.classList.remove("hidden");
    }
    recompute();
  });
});

// 方向 (push⇄call 逆算) 切替
document.querySelectorAll<HTMLButtonElement>(".direction-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll<HTMLButtonElement>(".direction-tab")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    direction = btn.dataset.direction as Direction;
    recompute();
  });
});

// ===== カスタムモード: タップ + ドラッグ塗り =====
// 動作:
//   - 押した最初のセルの状態を見て「追加」or「削除」モードを決定
//   - 指/マウスを動かして他セルを通過するたび同じ処理を適用
//   - タップだけならトグル動作（従来通り）
let dragMode: "add" | "remove" | null = null;
const dragVisited = new Set<string>();

function applyDragAction(hand: string): void {
  if (dragVisited.has(hand)) return;
  dragVisited.add(hand);
  if (dragMode === "add") {
    customVillainRange.add(hand);
  } else if (dragMode === "remove") {
    customVillainRange.delete(hand);
  }
  saveCustomRange();
  recompute();
}

function getCellHandFromPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  const cell = el.closest<HTMLDivElement>(".hand-cell");
  if (!cell || !villainGrid.contains(cell)) return null;
  return cell.title || null;
}

villainGrid.addEventListener("pointerdown", (e) => {
  if (villainRangeMode !== "custom") return;
  const cell = (e.target as HTMLElement).closest<HTMLDivElement>(".hand-cell");
  if (!cell) return;
  const hand = cell.title;
  // 最初のセルの状態で mode 決定
  dragMode = customVillainRange.has(hand) ? "remove" : "add";
  dragVisited.clear();
  applyDragAction(hand);
  // ポインターキャプチャしてドラッグ中スクロール抑制
  villainGrid.setPointerCapture(e.pointerId);
  e.preventDefault();
});

villainGrid.addEventListener("pointermove", (e) => {
  if (villainRangeMode !== "custom" || dragMode === null) return;
  const hand = getCellHandFromPoint(e.clientX, e.clientY);
  if (hand) applyDragAction(hand);
});

const endDrag = (e: PointerEvent): void => {
  if (dragMode !== null) {
    dragMode = null;
    dragVisited.clear();
    if (villainGrid.hasPointerCapture(e.pointerId)) {
      villainGrid.releasePointerCapture(e.pointerId);
    }
  }
};
villainGrid.addEventListener("pointerup", endDrag);
villainGrid.addEventListener("pointercancel", endDrag);
villainGrid.addEventListener("pointerleave", endDrag);

// CSS で touch-action: none を有効化するため class 付与
villainGrid.classList.add("draggable-grid");

customClearBtn.addEventListener("click", () => {
  customVillainRange.clear();
  saveCustomRange();
  recompute();
});

customFromPresetBtn.addEventListener("click", () => {
  customVillainRange.clear();
  for (const h of topRange(Number(pushRangeInput.value))) {
    customVillainRange.add(h);
  }
  saveCustomRange();
  recompute();
});

loadCustomRange();

// ===== ペイアウト行管理 =====

const payoutsList = $<HTMLDivElement>("payouts-list");
const addPayoutBtn = $<HTMLButtonElement>("add-payout");
const MAX_PAYOUTS = 12;
let payoutsArr: number[] = persistedState?.payouts && persistedState.payouts.length > 0
  ? persistedState.payouts.slice()
  : parseList(payoutsInput.value);
if (payoutsArr.length === 0) payoutsArr = [50, 30, 20];
payoutsInput.value = payoutsArr.join(", ");

function syncPayoutsInput(): void {
  payoutsInput.value = payoutsArr.join(", ");
}

function renderPayouts(): void {
  payoutsList.innerHTML = "";
  payoutsArr.forEach((amt, i) => {
    const row = document.createElement("div");
    row.className = "payout-row";
    row.innerHTML = `
      <span class="payout-num">${i + 1}位</span>
      <input type="number" inputmode="decimal" class="payout-amount" min="0" step="0.5" value="${amt}" data-i="${i}" />
      <button type="button" class="payout-remove" data-i="${i}" title="削除" ${payoutsArr.length <= 1 ? "disabled" : ""}>✕</button>
    `;
    payoutsList.appendChild(row);
  });
  addPayoutBtn.disabled = payoutsArr.length >= MAX_PAYOUTS;
}

function setPayouts(values: number[]): void {
  const sanitized = sanitizePayoutsArray(values);
  payoutsArr = sanitized.length > 0 ? sanitized : [100];
  syncPayoutsInput();
  renderPayouts();
  recompute();
}

payoutsList.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (!t.classList.contains("payout-amount")) return;
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
  if (remove && payoutsArr.length > 1) {
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
  if (payoutsArr.length >= MAX_PAYOUTS) return;
  payoutsArr.push(0);
  syncPayoutsInput();
  renderPayouts();
  recompute();
});

renderPayouts();

// ===== その他のリスナー =====

document
  .querySelectorAll<HTMLButtonElement>(".presets:not(.saved) button")
  .forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.preset;
      if (v) setPayouts(parseList(v));
    });
  });

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
        <button type="button" class="del" title="削除">✕</button>
      </span>
    `,
    )
    .join("");
}

savedPayoutsContainer.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const wrap = t.closest<HTMLSpanElement>(".saved-preset");
  if (!wrap) return;
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

savePayoutBtn.addEventListener("click", () => {
  const value = payoutsInput.value.trim();
  if (!value) return;
  const name = window.prompt(
    "名前を付けて保存（例: JOPT / APT / マイHU）",
    "",
  );
  if (!name) return;
  const list = loadSavedPayouts();
  list.push({ name: name.slice(0, 24), value });
  persistSavedPayouts(list);
  renderSavedPayouts();
});

renderSavedPayouts();

[payoutsInput, callInput, potWinInput, pushRangeInput].forEach((el) => {
  el.addEventListener("input", recompute);
});

// 🎯⚔️スタック + Nash blinds から call / potWin を自動算出
autofillBtn.addEventListener("click", () => {
  const heroIdx = players.findIndex((p) => p.role === "hero");
  const villainIdx = players.findIndex((p) => p.role === "villain");
  if (heroIdx < 0 || villainIdx < 0) {
    autofillHint.textContent = "⚠ 🎯自分と⚔️相手を1人ずつ指定してください";
    return;
  }
  const heroStack = players[heroIdx]!.stack;
  const villainStack = players[villainIdx]!.stack;
  const risk = Math.min(heroStack, villainStack);
  if (risk <= 0) {
    autofillHint.textContent = "⚠ スタックが0です";
    return;
  }

  const sbEl = document.getElementById("nash-sb") as HTMLInputElement | null;
  const bbEl = document.getElementById("nash-bb") as HTMLInputElement | null;
  const anteEl = document.getElementById("nash-ante") as HTMLInputElement | null;
  const sb = sbEl ? Number(sbEl.value) || 0 : DEFAULT_SB;
  const bb = bbEl ? Number(bbEl.value) || 0 : DEFAULT_BB;
  const anteRawV = anteEl ? Number(anteEl.value) || 0 : 0;
  const anteMode =
    (document.querySelector<HTMLInputElement>(
      'input[name="ante-mode"]:checked',
    )?.value ?? "total") as "total" | "perPlayer";
  const totalAnte =
    anteMode === "perPlayer" ? anteRawV * players.length : anteRawV;
  const dead = sb + bb + totalAnte;

  callInput.value = risk.toFixed(1);
  potWinInput.value = (risk + dead).toFixed(1);
  callManualOverride = false; // autofill 押したら自動追従モードに戻す

  const modeLabel = anteMode === "perPlayer" ? `1人${anteRawV}×${players.length}人` : "合計";
  autofillHint.innerHTML = `✓ コール <strong>${risk}</strong>, 純利得 <strong>${(risk + dead).toFixed(1)}</strong> = リスク ${risk} + 死に金 ${dead.toFixed(1)} (SB ${sb} + BB ${bb} + アンティ ${totalAnte.toFixed(1)} [${modeLabel}])`;
  recompute();
});

// 手動編集を検知して override フラグを立てる
[callInput, potWinInput].forEach((el) => {
  el.addEventListener("input", () => {
    callManualOverride = true;
  });
});

// Nash の frequency マップで描画。既存のレンジ表示と同じ class を使い、
// pure (>0.5) なら solid、mixed (0.05-0.5) は marginal 扱いで色の濃淡区別。
// frequency の値は title 属性 (long-press tooltip) でのみ確認可。
function renderNashGridWithFreq(
  container: HTMLDivElement,
  freqMap: ReadonlyMap<HandNotation, number>,
  type: "push" | "call",
): void {
  const solidClass = type === "push" ? "in-range-villain" : "in-range-hero";
  const cells: string[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = handAt(row, col);
      const freq = freqMap.get(hand) ?? 0;
      const isPair = row === col;
      let cls = "";
      if (freq >= 0.5) {
        cls = solidClass;
      } else if (freq >= 0.05) {
        cls = "marginal";
      }
      const pct = Math.round(freq * 100);
      cells.push(
        `<div class="hand-cell ${isPair ? "pair" : ""} ${cls}" title="${hand} (${pct}%)">${hand}</div>`,
      );
    }
  }
  container.innerHTML = cells.join("");
}

// ===== Nash 均衡 (HU) =====

const nashSbInput = $<HTMLInputElement>("nash-sb");
const nashBbInput = $<HTMLInputElement>("nash-bb");
const nashAnteInput = $<HTMLInputElement>("nash-ante");
const nashSolveBtn = $<HTMLButtonElement>("nash-solve");
const nashStatus = $<HTMLParagraphElement>("nash-status");
const nashSbStats = $<HTMLParagraphElement>("nash-sb-stats");
const nashBbStats = $<HTMLParagraphElement>("nash-bb-stats");
const nashSbGrid = $<HTMLDivElement>("nash-sb-grid");
const nashBbGrid = $<HTMLDivElement>("nash-bb-grid");

// プリフロップ行動順 (UTG → UTG+1 → MP → LJ → HJ → CO → BTN → SB → BB)
// (BB が最後に行動する)
const POSITION_ACT_ORDER = [
  "UTG",
  "UTG+1",
  "MP",
  "LJ",
  "HJ",
  "CO",
  "BTN",
  "SB",
  "BB",
] as const;

function actionOrderIdx(pos: string): number {
  return POSITION_ACT_ORDER.indexOf(pos as (typeof POSITION_ACT_ORDER)[number]);
}

// ===== コール額 / 純利得の +/- ステッパー =====
document.querySelectorAll<HTMLButtonElement>(".num-step-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const delta = Number(btn.dataset.delta) || 0;
    if (!targetId) return;
    const input = document.getElementById(targetId) as HTMLInputElement | null;
    if (!input) return;
    const cur = Number(input.value) || 0;
    const next = Math.max(0.1, cur + delta);
    input.value = next.toFixed(1);
    callManualOverride = true;
    recompute();
  });
});

// ===== カスタムレンジ「全選択」 =====
const customAllBtn = document.getElementById("custom-all") as HTMLButtonElement | null;
if (customAllBtn) {
  customAllBtn.addEventListener("click", () => {
    customVillainRange.clear();
    for (const h of ALL_169_HANDS) customVillainRange.add(h);
    saveCustomRange();
    recompute();
  });
}

// ===== メモ機能 (localStorage 永続化) =====
const MEMO_KEY = "poker-icm-scenario-memo";
const memoEl = document.getElementById("scenario-memo") as HTMLTextAreaElement | null;
if (memoEl) {
  try {
    memoEl.value = localStorage.getItem(MEMO_KEY) ?? "";
  } catch {
    /* ignore */
  }
  memoEl.addEventListener("input", () => {
    try {
      localStorage.setItem(MEMO_KEY, memoEl.value);
    } catch {
      /* ignore */
    }
  });
}

// ===== シナリオ URL 共有 =====
function encodeStateToHash(): string {
  const sbEl = document.getElementById("nash-sb") as HTMLInputElement | null;
  const bbEl = document.getElementById("nash-bb") as HTMLInputElement | null;
  const anteEl = document.getElementById("nash-ante") as HTMLInputElement | null;
  const anteMode =
    (document.querySelector<HTMLInputElement>(
      'input[name="ante-mode"]:checked',
    )?.value ?? "total") as "total" | "perPlayer";
  const compact = {
    p: players.map((p) => [p.stack, p.role[0], p.position]),
    py: payoutsArr,
    n: {
      sb: Number(sbEl?.value) || DEFAULT_SB,
      bb: Number(bbEl?.value) || DEFAULT_BB,
      a: Number(anteEl?.value) || 0,
      m: anteMode === "perPlayer" ? "p" : "t",
    },
  };
  const json = JSON.stringify(compact);
  return btoa(encodeURIComponent(json));
}

function decodeStateFromHash(hash: string): void {
  try {
    const json = decodeURIComponent(atob(hash));
    const data = JSON.parse(json) as {
      p?: [number, string, string][];
      py?: number[];
      n?: { sb?: number; bb?: number; a?: number; m?: string };
    };
    if (Array.isArray(data.p)) {
      players.length = 0;
      for (const [stack, roleC, position] of data.p) {
        const role: Role =
          roleC === "h" ? "hero" : roleC === "v" ? "villain" : "other";
        players.push({ id: nextId++, stack, role, position: position as Position });
      }
      renderPlayers();
    }
    if (Array.isArray(data.py) && data.py.length > 0) {
      setPayouts(data.py);
    }
    if (data.n) {
      const sbEl = document.getElementById("nash-sb") as HTMLInputElement | null;
      const bbEl = document.getElementById("nash-bb") as HTMLInputElement | null;
      const anteEl = document.getElementById("nash-ante") as HTMLInputElement | null;
      if (sbEl && data.n.sb != null) sbEl.value = String(data.n.sb);
      if (bbEl && data.n.bb != null) bbEl.value = String(data.n.bb);
      if (anteEl && data.n.a != null) anteEl.value = String(data.n.a);
      const modeValue = data.n.m === "p" ? "perPlayer" : "total";
      const radio = document.querySelector<HTMLInputElement>(
        `input[name="ante-mode"][value="${modeValue}"]`,
      );
      if (radio) radio.checked = true;
    }
    callManualOverride = false;
    recompute();
  } catch (e) {
    console.warn("URL hash decode 失敗", e);
  }
}

async function doShareScenario(): Promise<void> {
  const hash = encodeStateToHash();
  const url = `${location.origin}${location.pathname}#s=${hash}`;
  const hint = document.getElementById("share-url-hint");
  const toast = document.getElementById("share-url-toast");
  try {
    await navigator.clipboard.writeText(url);
    if (hint) hint.textContent = "✓ URL をクリップボードにコピー！";
    if (toast) {
      toast.textContent = "✓ URL をクリップボードにコピーしました";
      toast.classList.remove("hidden");
      setTimeout(() => toast.classList.add("hidden"), 2500);
    }
  } catch {
    if (hint) hint.textContent = url;
    if (toast) {
      toast.textContent = url;
      toast.classList.remove("hidden");
    }
  }
}

document.getElementById("share-url-btn")?.addEventListener("click", doShareScenario);
document.getElementById("share-url-btn-top")?.addEventListener("click", doShareScenario);

// 起動時に URL hash があれば復元
if (location.hash.startsWith("#s=")) {
  const hash = location.hash.slice(3);
  setTimeout(() => decodeStateFromHash(hash), 50);
}

// ===== 用語解説モーダル =====
const INFO_TEXTS: Record<string, { title: string; body: string }> = {
  ICM: {
    title: "ICM (Independent Chip Model)",
    body: `
      <p>トナメの<strong>チップを「今すぐ$に換金したらいくら？」</strong>に変換する計算式。</p>
      <p>賞金は順位ごとに固定なので、チップ 2倍 ≠ 賞金 2倍。<br />
      バストすると最低順位の賞金しか貰えない非対称性を反映する。</p>
      <p>ICM% は <code>その人の $EV ÷ 総賞金</code>。例: 25% = 平均すると総賞金の 1/4 を持っていける期待値。</p>
    `,
  },
  BF: {
    title: "BF (Bubble Factor)",
    body: `
      <p><strong>「チップの痛さ ÷ チップの嬉しさ」</strong>を表す係数。HU all-in 想定。</p>
      <ul>
        <li><strong>1.00</strong>: チップ ⇄ $ がリニア (ICM 圧ゼロ)</li>
        <li><strong>1.20</strong>: 「100失う痛さ = 83取る嬉しさ」→ 20%余分にタイト</li>
        <li><strong>1.50+</strong>: バブル/サテライトレベル、超タイト</li>
      </ul>
      <p>厳密な定義: <code>BF = (現在 - 負け時の $) ÷ (勝ち時 - 現在の $)</code>。
      HRC / ICMIZER と同じ計算。</p>
      <p>※ 1:1 ポットオッズ時に <code>必要勝率 = BF/(BF+1)</code>。BF=1.2 なら 54.5%、BF=1.5 なら 60%。</p>
    `,
  },
  RP: {
    title: "Risk Premium (RP)",
    body: `
      <p><strong>cEV (チップ EV) と $EV (ICM EV) の差</strong>。ICM の重みでどれだけ余分に勝率が必要か。</p>
      <ul>
        <li>RP = 0%: cEV と $EV が同じ (ICM 影響なし)</li>
        <li>RP = +10%: コインフリップ (50%) でも実際は 60% 必要</li>
        <li>RP = +20%: バブル時、+30% でサテライト</li>
      </ul>
      <p>計算: <code>RP = $EV 必要勝率 − cEV 必要勝率</code></p>
      <p>1:1 オッズの場合: <code>RP = BF/(BF+1) − 50%</code></p>
    `,
  },
  必要勝率: {
    title: "必要勝率 (Required Equity)",
    body: `
      <p>このコールが <strong>EV 0 になる最低勝率</strong>。ハンドの実勝率がこれを超えるなら call、下なら fold。</p>
      <ul>
        <li><strong>cEV 必要勝率</strong>: ポット odds だけ (ICM 無視)</li>
        <li><strong>$EV 必要勝率</strong>: BF (ICM 圧) を反映、こっちが実戦判断用</li>
      </ul>
      <p>厳密式: <code>$EV = (call × BF) ÷ (call × BF + win)</code></p>
      <p>例: コール 8 BB / pot 20 BB / BF 1.4<br />
      → cEV = 8/(8+20) = 28.6%<br />
      → $EV = (8×1.4)/(8×1.4 + 20) = 11.2/31.2 = <strong>35.9%</strong><br />
      (1:1 オッズ時は <code>BF/(BF+1)</code>)</p>
    `,
  },
};

const infoModal = document.getElementById("info-modal") as HTMLDivElement | null;
const infoTitle = document.getElementById("info-modal-title") as HTMLHeadingElement | null;
const infoBody = document.getElementById("info-modal-body") as HTMLDivElement | null;
const infoClose = document.getElementById("info-modal-close") as HTMLButtonElement | null;

function openInfoModal(key: string): void {
  const info = INFO_TEXTS[key];
  if (!info || !infoModal || !infoTitle || !infoBody) return;
  infoTitle.textContent = info.title;
  infoBody.innerHTML = info.body;
  infoModal.classList.remove("hidden");
}

function closeInfoModal(): void {
  infoModal?.classList.add("hidden");
}

infoClose?.addEventListener("click", closeInfoModal);
infoModal?.addEventListener("click", (e) => {
  if (e.target === infoModal) closeInfoModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeInfoModal();
});

// hero-summary 内の解説可能ラベルにクリック listener を delegate
heroSummaryEl?.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-info]");
  if (t) {
    const key = t.dataset.info;
    if (key) openInfoModal(key);
  }
});

// ハンドレンジ比較セクションの hero ポジション バナー
// HU all-in 想定 = 「最終 actor = caller」のときのみ厳密に有効:
//   - call モード: hero が caller → hero=BB が cleanest
//   - push モード: villain が caller → villain=BB が cleanest (hero は pusher)
// 「caller の後ろに残るプレイヤー」がいると over-call リスクで概算止まり。
function updateHandPositionBanner(heroIndex: number): void {
  const banner = document.getElementById("hand-position-banner");
  if (!banner) return;
  if (heroIndex < 0) {
    banner.classList.add("hidden");
    return;
  }
  const villainIndex = players.findIndex((p) => p.role === "villain");
  if (villainIndex < 0) {
    banner.classList.add("hidden");
    return;
  }
  // direction で「caller」を決める
  const callerIndex = direction === "callBack" ? heroIndex : villainIndex;
  const callerPos = players[callerIndex]?.position;
  const callerLabel = direction === "callBack" ? "hero (自分)" : "villain (相手)";
  if (!callerPos) {
    banner.classList.add("hidden");
    return;
  }
  if (callerPos === "BB") {
    banner.classList.add("hidden");
    return;
  }
  // caller の後ろに残ってるプレイヤー (caller 自身を除く)
  const callerAct = actionOrderIdx(callerPos);
  const behind = players
    .filter((_, i) => i !== callerIndex)
    .map((p) => ({ pos: p.position, act: actionOrderIdx(p.position), stack: p.stack }))
    .filter((x) => x.act > callerAct && x.act >= 0)
    .sort((a, b) => a.act - b.act);
  banner.classList.remove("hidden");
  if (behind.length === 0) {
    banner.innerHTML = `
      ℹ️ ${callerLabel}=<strong>${callerPos}</strong>。後ろにプレイヤーがいないので
      HU all-in モデルは厳密に有効です。
    `;
  } else {
    const list = behind.map((x) => `${x.pos} (${x.stack}BB)`).join(", ");
    const directionNote = direction === "callBack"
      ? "ここで「call OK」と出ても実戦ではより硬い range で受けるべきです。"
      : "ここで「push OK」と出ても実戦では over-call の可能性を加味してより硬い range で push するべきです。";
    banner.innerHTML = `
      ⚠ ${callerLabel}=<strong>${callerPos}</strong>。このセクションは
      <strong>caller=BB (最終 actor)</strong> 想定の HU all-in モデルです。
      ${callerLabel} の後ろに残ってる ${behind.length} 人 (${list}) の
      <strong>over-call リスク</strong>は反映されません。
      ${directionNote}
    `;
  }
}

// ポジション逆転警告 (Section 5 用)
// この計算機は open-shove (push or fold) モデルを前提とし、
// hero の既出 commit を blind+ante のみと仮定する。
// hero が villain より先に行動するポジ (例: hero=SB, villain=BB) は
// villain が直接 push する余地がないため、このモデルでは成立しない。
// 3-bet shove (hero open → villain re-shove) は hero の raise 額が
// pot に含まれるが、本計算機はそれをモデル化しないため警告対象。
function updatePositionWarn(heroIndex: number, villainIndex: number): void {
  const warnEl = document.getElementById("position-warn");
  if (!warnEl) return;
  if (heroIndex < 0 || villainIndex < 0) {
    warnEl.classList.add("hidden");
    return;
  }
  const heroPos = players[heroIndex]?.position;
  const villainPos = players[villainIndex]?.position;
  if (!heroPos || !villainPos) {
    warnEl.classList.add("hidden");
    return;
  }
  const heroAct = actionOrderIdx(heroPos);
  const villainAct = actionOrderIdx(villainPos);
  if (heroAct < 0 || villainAct < 0) {
    warnEl.classList.add("hidden");
    return;
  }
  if (heroAct < villainAct) {
    warnEl.classList.remove("hidden");
    warnEl.innerHTML = `
      ⚠ <strong>ポジション逆転</strong>: 行動順は <code>${heroPos}(${heroAct + 1}) → ${villainPos}(${villainAct + 1})</code>。
      実戦では <strong>hero (${heroPos}) が先に行動</strong>するため、villain (${villainPos}) の open push に対して call することはあり得ません。
      (call 計算は math 上は動きますが、ポジを入れ替える方が現実的)
    `;
  } else {
    warnEl.classList.add("hidden");
  }
}

// HU 限界に関する警告ボックス更新
// hero/villain の双方より後に行動するプレイヤー (over-caller 候補) が
// 生存している場合のみ警告を出す。
function updateNashOvercallWarn(): void {
  const warnEl = document.getElementById("nash-overcall-warn");
  if (!warnEl) return;
  const heroIdx = players.findIndex((p) => p.role === "hero");
  const villainIdx = players.findIndex((p) => p.role === "villain");
  if (heroIdx < 0 || villainIdx < 0) {
    warnEl.classList.add("hidden");
    return;
  }
  const heroPos = players[heroIdx]!.position;
  const villainPos = players[villainIdx]!.position;
  const heroAct = actionOrderIdx(heroPos);
  const villainAct = actionOrderIdx(villainPos);

  // hero/villain どちらかにポジ未指定があるなら判定不可 → 警告は出さない
  if (heroAct < 0 || villainAct < 0) {
    warnEl.classList.add("hidden");
    return;
  }

  // pusher = 行動順が早い方 (idx が小さい方)。caller = もう片方。
  const pusherAct = Math.min(heroAct, villainAct);
  // pusher の後ろに行動する全プレイヤー (= caller 含む全員) のうち、
  // villain でないプレイヤーが介在 (間 / 後) してれば「HU 想定外の介入者」あり。
  const intruders = players.filter((p, i) => {
    if (i === heroIdx || i === villainIdx) return false;
    if (p.stack <= 0) return false;
    const a = actionOrderIdx(p.position);
    return a > pusherAct;
  });

  if (intruders.length === 0) {
    warnEl.classList.add("hidden");
    return;
  }

  // 介在者の位置を「間」「後ろ」で分類
  const callerAct = Math.max(heroAct, villainAct);
  const between: typeof intruders = [];
  const behind: typeof intruders = [];
  for (const p of intruders) {
    const a = actionOrderIdx(p.position);
    if (a < callerAct) between.push(p);
    else behind.push(p);
  }

  const pusherIdx = heroAct < villainAct ? heroIdx : villainIdx;
  const callerIdx = heroAct < villainAct ? villainIdx : heroIdx;
  const pusherPos = players[pusherIdx]?.position;
  const callerPos = players[callerIdx]?.position;

  const partsHtml: string[] = [];
  if (between.length > 0) {
    partsHtml.push(
      `<strong>${between.length}</strong> 人が pusher と caller の間 (${between.map((p) => `${p.position}(${p.stack}BB)`).join(", ")})`,
    );
  }
  if (behind.length > 0) {
    partsHtml.push(
      `<strong>${behind.length}</strong> 人が caller の後ろ (${behind.map((p) => `${p.position}(${p.stack}BB)`).join(", ")})`,
    );
  }

  // 主要な調整: pusher は介在者の over-call リスクを織り込んで tighter に
  // caller は介在者が fold した後に判断するため HU Nash 通りで概ね OK
  // (caller の後ろに人がいる場合のみ caller も tighter)
  const callerNeedsTighten = behind.length > 0;

  warnEl.classList.remove("hidden");
  warnEl.innerHTML = `
    ⚠ <strong>HU Nash 想定外の介入者あり</strong>: ${partsHtml.join(" / ")}。
    <br />→ <strong>pusher (${pusherPos}) は HU Nash よりさらに狭く push</strong> すべき
    （介在者が強いハンドで over-call/3bet する分、fold equity が減るため）。
    ${callerNeedsTighten ? `<br />→ <strong>caller (${callerPos}) も狭く call</strong> すべき (後ろに ${behind.length} 人控えてるため)。` : `<br />→ caller (${callerPos}) は概ね HU Nash 通り (介在者が降りた前提なので)。`}
    <br />当 Nash 結果は HU 2-way 想定の参考値として読んでください。
  `;
}

// 起動時に保存された Nash パラメータを復元
// アンティモードは「合計」を必ずデフォルトにする（保存値は無視）。
// HRC 互換にしたい時はユーザーが明示的にラジオを切り替える。
if (persistedState?.nash) {
  nashSbInput.value = String(persistedState.nash.sb);
  nashBbInput.value = String(persistedState.nash.bb);
  nashAnteInput.value = String(persistedState.nash.ante);
}
const totalRadio = document.querySelector<HTMLInputElement>(
  'input[name="ante-mode"][value="total"]',
);
if (totalRadio) totalRadio.checked = true;

// Nash 入力変更時に状態保存
[nashSbInput, nashBbInput, nashAnteInput].forEach((el) => {
  el.addEventListener("input", saveState);
});
document.querySelectorAll<HTMLInputElement>('input[name="ante-mode"]').forEach((el) => {
  el.addEventListener("change", saveState);
});

// 初期描画（空のグリッド）
renderGrid(nashSbGrid, () => "");
renderGrid(nashBbGrid, () => "");

if (!hasHUMatrix()) {
  nashStatus.textContent =
    "⚠ HU equity matrix が未生成です（hu-equity-matrix.json）。`npx tsx scripts/build-hu-matchups.mts` を実行してください。";
}

function runNash(): void {
  const stacks = players.map((p) => p.stack);
  const payouts = parseList(payoutsInput.value);
  const heroIndex = players.findIndex((p) => p.role === "hero");
  const villainIndex = players.findIndex((p) => p.role === "villain");

  // heroIndex === villainIndex はデータモデル上到達不能 (Player.role は排他的な
  // 単一値のため)。heroIndex/villainIndex がともに -1 のケースは
  // `heroIndex < 0 || villainIndex < 0` で既に弾かれる。防御的に残す。
  if (heroIndex < 0 || villainIndex < 0 || heroIndex === villainIndex) {
    nashStatus.innerHTML = `<span class="error">🎯自分と⚔️相手をそれぞれ1人ずつ指定してください</span>`;
    return;
  }
  if (payouts.length === 0) {
    nashStatus.innerHTML = `<span class="error">ペイ構造を入力してください</span>`;
    return;
  }
  const sb = Number(nashSbInput.value);
  const bb = Number(nashBbInput.value);
  const anteRaw = Number(nashAnteInput.value);
  if (!Number.isFinite(sb) || sb <= 0) {
    nashStatus.innerHTML = `<span class="error">SB が不正</span>`;
    return;
  }
  if (!Number.isFinite(bb) || bb <= 0) {
    nashStatus.innerHTML = `<span class="error">BB が不正</span>`;
    return;
  }
  if (!Number.isFinite(anteRaw) || anteRaw < 0) {
    nashStatus.innerHTML = `<span class="error">アンティが不正</span>`;
    return;
  }
  // ante モード判定: total なら人数で割る、perPlayer ならそのまま
  const anteMode =
    (document.querySelector<HTMLInputElement>(
      'input[name="ante-mode"]:checked',
    )?.value ?? "total") as "total" | "perPlayer";
  const ante =
    anteMode === "perPlayer" ? anteRaw : anteRaw / Math.max(1, stacks.length);

  // ボタンを「計算中…」に
  nashSolveBtn.disabled = true;
  const oldText = nashSolveBtn.textContent;
  nashSolveBtn.textContent = "計算中…";
  nashStatus.textContent = "";

  // 描画ブロックを避けるため setTimeout で処理を後回し
  setTimeout(() => {
    try {
      const t0 = performance.now();
      const result = solveHUNash({
        stacks,
        payouts,
        sbIndex: heroIndex,
        bbIndex: villainIndex,
        sb,
        bb,
        ante,
        huEquity,
        allHands: ALL_169_HANDS,
        maxIterations: 2000,
        convergenceTolerance: 0.0005,
      });
      const elapsedMs = performance.now() - t0;

      // 描画: frequency に応じて濃淡（mixed strategy 表示）
      renderNashGridWithFreq(nashSbGrid, result.sbPushFreq, "push");
      renderNashGridWithFreq(nashBbGrid, result.bbCallFreq, "call");

      const sbCount = result.sbPushRange.size;
      const bbCount = result.bbCallRange.size;
      nashSbStats.innerHTML = `${sbCount} 個 (${(result.sbPushPct * 100).toFixed(1)}%)`;
      nashBbStats.innerHTML = `${bbCount} 個 (${(result.bbCallPct * 100).toFixed(1)}%)`;

      const convStr = result.converged
        ? `<span style="color: var(--good)">収束</span>`
        : `<span style="color: var(--warn)">未収束</span>`;
      nashStatus.innerHTML = `${convStr}（${result.iterations} iter / ${elapsedMs.toFixed(0)} ms）`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      nashStatus.innerHTML = `<span class="error">${msg}</span>`;
    } finally {
      nashSolveBtn.disabled = false;
      nashSolveBtn.textContent = oldText ?? "Nash 計算";
    }
  }, 10);
}

nashSolveBtn.addEventListener("click", runNash);

// ===== タブナビ =====
type TabId = "setup" | "result" | "hand" | "nash" | "practice";
const TAB_KEY = "poker-icm-active-tab";
let activeTab: TabId = "setup";
try {
  const saved = localStorage.getItem(TAB_KEY) as TabId | null;
  if (saved && ["setup", "result", "hand", "nash", "practice"].includes(saved)) {
    activeTab = saved;
  }
} catch {
  /* ignore */
}

function applyTab(tab: TabId): void {
  activeTab = tab;
  try { localStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ }
  document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll<HTMLElement>("[data-tab]").forEach((el) => {
    if (el.classList.contains("tab-btn")) return; // ボタン自体は対象外
    el.classList.toggle("hidden-tab", el.dataset.tab !== tab);
  });
  // 練習タブ中は Hero サマリーを隠す（メイン画面の状態と無関係なので邪魔）
  const heroSum = document.getElementById("hero-summary");
  if (heroSum) {
    if (tab === "practice") {
      heroSum.style.display = "none";
    } else {
      heroSum.style.display = ""; // CSS の .active 制御に戻す
    }
  }
  // 練習タブ表示時に成績の推移パネルを更新
  if (tab === "practice") updatePracticeProgress();
  // 練習タブを開いたとき、まだ問題が無ければ自動出題する
  // (オンボーディングの「練習を始める」CTA や、前回タブが練習で復元された場合も含む)
  // ただし初回 (導入コース未修了・このセッションでスキップもしていない) は
  // ランダム出題の代わりに導入コースの案内カードを出す。チュートリアル進行中に
  // タブ移動で中断された場合は、現在のステップのナレーションからやり直す。
  if (tab === "practice" && !currentProblem) {
    if (tutorialActive) {
      renderTutorialNarrationStep();
    } else if (!isTutorialDone() && !tutorialSkippedSession) {
      renderTutorialIntroCard();
    } else {
      currentProblem = generatePracticeProblem();
      renderPracticeProblem(currentProblem);
    }
  }
  // ハンド or Nash タブ初表示時にスムーズトップ
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const t = btn.dataset.tab as TabId | undefined;
    if (t) applyTab(t);
  });
});

// ===== テーマ切替 (dark/light) =====
const THEME_KEY = "poker-icm-theme";
type Theme = "dark" | "light";
function applyTheme(t: Theme): void {
  if (t === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = t === "light" ? "☀️" : "🌙";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute("content", t === "light" ? "#f5f7fa" : "#0f1419");
  try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
}
const savedTheme = ((): Theme => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
})();
applyTheme(savedTheme);
document.getElementById("theme-toggle")?.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
});

// ===== オンボーディング（初回ガイド）& 使い方ガイド =====
const ONBOARDING_DONE_KEY = "poker-icm-onboarding-done";
const FIRST_HINT_DISMISSED_KEY = "poker-icm-first-hint-dismissed";

function isOnboardingDone(): boolean {
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
    title: "🎰 これは何？",
    body: `
      <p>
        トーナメントの「チップ枚数」と「賞金への価値」は同じではありません。
        本ツールはこの <strong>ICM プレッシャー</strong>を、数字で『計算』しながら
        クイズで『練習』もできる無料アプリです。
      </p>
      <ul class="onboarding-tab-list">
        <li><span class="onboarding-tab-icon">⚙️</span> 状況入力（スタック・ペイアウトなど）</li>
        <li><span class="onboarding-tab-icon">📊</span> 計算結果（ICM・BF・必要勝率）</li>
        <li><span class="onboarding-tab-icon">🃏</span> レンジ比較</li>
        <li><span class="onboarding-tab-icon">🎯</span> Nash 均衡（push/fold の最適解）</li>
        <li><span class="onboarding-tab-icon">🎲</span> 練習（クイズで実戦感覚）</li>
      </ul>
    `,
  },
  {
    title: "⚡ まず触ってみる",
    body: `
      <p>おすすめの入り口は2つあります。</p>
      <ol>
        <li>
          <strong>⚙️ セットアップ</strong>で<strong>シナリオプリセット</strong>をタップ →
          <strong>📊 計算結果</strong>で ICM / BF をすぐ確認する
        </li>
        <li>
          <strong>🎲 練習</strong>タブでクイズに答えながら感覚を掴む
        </li>
      </ol>
      <p class="hint">どちらから始めても OK。行き来しながら覚えられます。</p>
    `,
  },
  {
    title: "📖 困ったら",
    body: `
      <p>
        ヘッダー右上の <strong>❓</strong> ボタンから、いつでもこの使い方ガイドと
        ICM / Bubble Factor などの用語解説を開けます。
      </p>
      <p class="hint">さっそく始めましょう。</p>
    `,
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
        <button type="button" class="onboarding-skip" id="onboarding-skip">スキップ</button>
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
      footerActions.innerHTML = `<button type="button" class="solve-btn onboarding-next-btn" id="onboarding-next-btn">次へ →</button>`;
      footerActions.querySelector("#onboarding-next-btn")?.addEventListener("click", () => {
        onboardingStep++;
        renderOnboardingStep();
      });
    } else {
      footerActions.innerHTML = `
        <div class="onboarding-cta-row">
          <button type="button" class="solve-btn" id="onboarding-cta-practice">🎲 練習を始める</button>
          <button type="button" class="solve-btn" id="onboarding-cta-setup" style="background: var(--card); color: var(--text); border: 1px solid var(--border);">⚙️ 自分で設定する</button>
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

function openOnboardingModal(): void {
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
        <h3>📖 使い方ガイド</h3>
        <button type="button" class="guide-modal-close" id="guide-modal-close" aria-label="閉じる">✕</button>
      </div>
      <div class="guide-modal-body">
        <details class="howto">
          <summary>⚙️ セットアップ — できること・使い方</summary>
          <div class="howto-body">
            <p>プレイヤーのスタック、ペイ構造、🎯自分/⚔️相手を設定してシナリオを作る画面。</p>
            <ol>
              <li>「シナリオプリセット」をタップして状況を一発セット</li>
              <li>「プレイヤー」でスタックを調整（足りなければ + プレイヤー追加）</li>
              <li>🎯自分 / ⚔️相手 をタップで指定</li>
              <li>必要なら📝メモに気付きを残す</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>📊 計算結果 — できること・使い方</summary>
          <div class="howto-body">
            <p>ICM エクイティ、Bubble Factor、必要勝率 (cEV / $EV / RP) を自動計算する画面。</p>
            <ol>
              <li>⚙️で状況を入力（プリセットでも OK）</li>
              <li>「ICM エクイティ」表で各プレイヤーの $ 価値を確認</li>
              <li>「全員 vs 全員 BF マップ」で 🎯 vs ⚔️ のセルを確認</li>
              <li>「🎯⚔️ から自動算出」を押して必要勝率でコール判断</li>
              <li>「🃏 ハンド別判定」で相手レンジを選び、自分のハンドをタップして個別に call/fold を確認</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🃏 ハンド比較 — できること・使い方</summary>
          <div class="howto-body">
            <p>相手の push/call レンジと自分のレンジを Top X% やカスタム編集で比較する画面。</p>
            <ol>
              <li>「自分の call を逆算」か「自分の push を逆算」を選ぶ</li>
              <li>プリセットならスライダーで Top X% を調整、カスタムならグリッドのセルをタップして選択</li>
              <li>グリッドの色分けで自分がコール/プッシュすべきハンドを確認</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎯 ナッシュ均衡 — できること・使い方</summary>
          <div class="howto-body">
            <p>HU push/fold の Nash 均衡（ICM 反映済み）を計算する画面。</p>
            <ol>
              <li>⚙️で 🎯自分 (pusher) と ⚔️相手 (caller) を指定</li>
              <li>SB / BB / アンティ合計を設定</li>
              <li>「Nash 計算」を押す</li>
              <li>push レンジと call レンジのグリッドを見比べる</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎲 練習 — できること・使い方</summary>
          <div class="howto-body">
            <p>ランダムなシナリオでコール/フォールド判断や Risk Premium 当てを練習できる画面。</p>
            <ol>
              <li>難易度を選んで「🎲 新しい問題」を押す</li>
              <li>相手の push 想定レンジと自分のハンドを見て ✅コール / ❌フォールドを判断（RP 当てモードはスライダーで数値回答）</li>
              <li>正誤と計算式を確認し、間違えたら 📚復習 リストで解き直す</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>📚 用語ミニ解説</summary>
          <div class="howto-body">
            <h4>ICM (Independent Chip Model)</h4>
            <p>
              トナメのチップは賞金と1:1では換算できません（<strong>チップ ≠ 賞金価値</strong>）。
              ICM はチップ構成を「今すぐ$に換金したらいくら？」に変換する定義です。
              例: ICM% が 25% なら、平均して総賞金の 1/4 を持っていける期待値ということ。
            </p>
            <h4>Bubble Factor (BF)</h4>
            <p>
              <strong>負けた時の痛み ÷ 勝った時の嬉しさ</strong>を表す係数。
              BF = 1.3 なら、cEV（チップ基準）より <strong>30% 余分にタイト</strong>に打つべきという意味です。
            </p>
            <h4>Risk Premium (RP)</h4>
            <p>
              cEV（チップだけで見た必要勝率）より<strong>何%余分に勝率が必要か</strong>を表す差分。
              ICM プレッシャーが強い場面ほど RP は大きくなります。
            </p>
            <h4>Nash 均衡</h4>
            <p>
              🎯push 側も ⚔️call 側も、片方だけ戦略を変えても得をしない
              「お互いに搾取されない」push/fold 戦略の組み合わせのことです。
            </p>
          </div>
        </details>
        <details class="howto">
          <summary>❓ 「Top X%」とは</summary>
          <div class="howto-body">
            <p>
              「Top X%」は本ツール独自のハンド強度ランキングに基づく上位 X% の簡易レンジです。
              Sklansky-Chubukov など他ツールのランキングとは前提（サンプル数・想定シナリオなど）が異なるため、
              <strong>同じ X% でも具体的なハンドの構成や数字が一致しない場合があります</strong>。
              あくまで傾向を掴むための目安としてご利用ください。
            </p>
          </div>
        </details>
        <button type="button" class="solve-btn guide-reopen-btn" id="guide-reopen-onboarding-btn">🔄 もう一度はじめのガイドを見る</button>
      </div>
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
  guideModalEl = modal;
  return modal;
}

function openGuideModal(): void {
  ensureGuideModal().classList.remove("hidden");
}
function closeGuideModal(): void {
  guideModalEl?.classList.add("hidden");
}

document.getElementById("help-btn")?.addEventListener("click", openGuideModal);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (onboardingModalEl && !onboardingModalEl.classList.contains("hidden")) closeOnboardingModal();
  if (guideModalEl && !guideModalEl.classList.contains("hidden")) closeGuideModal();
});

// ===== 初回ヒントバー（セットアップタブ最上部、シナリオプリセットの上） =====
function insertFirstHintBar(): void {
  if (!shouldShowFirstHint) return;
  const firstSetupCard = document.querySelector('section.card[data-tab="setup"]');
  if (!firstSetupCard || !firstSetupCard.parentElement) return;
  const bar = document.createElement("div");
  bar.id = "first-hint-bar";
  bar.className = "first-hint-bar";
  bar.dataset.tab = "setup";
  bar.classList.toggle("hidden-tab", activeTab !== "setup");
  const text = document.createElement("span");
  text.innerHTML =
    "👋 はじめてなら: <strong>プリセット</strong>をタップ → <strong>📊</strong>で結果を見る、か <strong>🎲</strong>で練習";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "first-hint-bar-close";
  closeBtn.setAttribute("aria-label", "閉じる");
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => {
    bar.remove();
    markFirstHintDismissed();
  });
  bar.appendChild(text);
  bar.appendChild(closeBtn);
  firstSetupCard.parentElement.insertBefore(bar, firstSetupCard);
}
insertFirstHintBar();

// ===== タブ切替のスワイプ ジェスチャー =====
(() => {
  const TABS: TabId[] = ["setup", "result", "hand", "nash", "practice"];
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartT = 0;
  const SWIPE_MIN_DX = 60;
  const SWIPE_MAX_DY = 50;
  const SWIPE_MAX_T = 600;

  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    // タブバーや入力要素上のスワイプは無視
    const target = e.target as HTMLElement;
    if (
      target.closest(".tab-bar") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest(".hand-grid") ||
      target.closest(".bf-matrix")
    ) {
      touchStartT = 0;
      return;
    }
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartT = Date.now();
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (touchStartT === 0) return;
    const dt = Date.now() - touchStartT;
    if (dt > SWIPE_MAX_T) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_MIN_DX) return;
    if (Math.abs(dy) > SWIPE_MAX_DY) return;
    const idx = TABS.indexOf(activeTab);
    if (dx < 0 && idx < TABS.length - 1) applyTab(TABS[idx + 1]!);
    if (dx > 0 && idx > 0) applyTab(TABS[idx - 1]!);
  }, { passive: true });
})();

// ===== Service Worker 登録 (PWA) =====
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* SW 登録失敗は無視 */
    });
  });
}

// ===== PWA インストール導線 =====
interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function isStandaloneDisplay(): boolean {
  const standaloneNav = (navigator as Navigator & { standalone?: boolean }).standalone;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    standaloneNav === true
  );
}

if (!isStandaloneDisplay()) {
  let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

  const showInstallButton = (): void => {
    if (document.getElementById("install-btn")) return;
    const actions = document.querySelector(".header-actions");
    if (!actions) return;
    const btn = document.createElement("button");
    btn.id = "install-btn";
    btn.className = "header-btn";
    btn.type = "button";
    btn.title = "ホーム画面に追加";
    btn.setAttribute("aria-label", "インストール");
    btn.textContent = "📲";
    btn.addEventListener("click", () => {
      const prompt = deferredInstallPrompt;
      if (!prompt) return;
      prompt.prompt();
      prompt.userChoice
        .catch(() => {
          /* 選択取得失敗は無視 */
        })
        .finally(() => {
          deferredInstallPrompt = null;
          btn.remove();
        });
    });
    actions.appendChild(btn);
  };

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.getElementById("install-btn")?.remove();
  });

  // iOS Safari は beforeinstallprompt 非対応 → 初回訪問時のみ案内バナーを表示
  const IOS_INSTALL_HINT_KEY = "poker-icm-ios-install-hint";
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    let alreadyShown = false;
    try {
      alreadyShown = localStorage.getItem(IOS_INSTALL_HINT_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (!alreadyShown) {
      const banner = document.createElement("div");
      banner.className = "ios-install-banner";
      const text = document.createElement("span");
      text.textContent = "ホーム画面に追加でアプリとして使えます: 共有ボタン → ホーム画面に追加";
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "ios-install-banner-close";
      closeBtn.setAttribute("aria-label", "閉じる");
      closeBtn.textContent = "✕";
      const dismiss = (): void => {
        banner.remove();
        try {
          localStorage.setItem(IOS_INSTALL_HINT_KEY, "1");
        } catch {
          /* ignore */
        }
      };
      closeBtn.addEventListener("click", dismiss);
      banner.appendChild(text);
      banner.appendChild(closeBtn);
      document.body.appendChild(banner);
    }
  }
}

// ===== オフライン状態インジケータ =====
function updateOfflineBanner(): void {
  const existing = document.getElementById("offline-banner");
  if (navigator.onLine) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const header = document.querySelector("header");
  if (!header) return;
  const banner = document.createElement("div");
  banner.id = "offline-banner";
  banner.className = "offline-banner";
  banner.textContent = "📡 オフライン — 計算はすべて端末内で動作します";
  header.insertAdjacentElement("afterend", banner);
}
window.addEventListener("online", updateOfflineBanner);
window.addEventListener("offline", updateOfflineBanner);
updateOfflineBanner();

// ===== 練習問題モード =====
// PracticeProblem のうち「問題そのもの」を定義する部分。
// localStorage の復習リストにもこの形のまま保存される (スキーマ不変)。
interface PracticeProblemBase {
  scenarioPlayers: { stack: number; role: Role; position: Position }[];
  payouts: number[];
  sb: number;
  bb: number;
  totalAnte: number;
  villainCallRangePct: number;
  heroHand: HandNotation;
  /** 不正解時にどのモードで出題されたか (復習の再出題で使用)。旧データは undefined = callfold 扱い。 */
  savedMode?: PracticeMode;
}

// PracticeProblemBase から一意に計算できる派生値。
// 既存の復習リスト (旧スキーマ) にはこれらの値が古い形式で入っている、
// または一部が欠けているため、使用前に必ず computeDerivedFields() で
// base フィールドから再計算し直す (ensureDerivedFields 参照)。
interface PracticeProblemDerived {
  // 判定用: cEV は近似/厳密で共通、dollarEV は厳密 ICM 必要勝率 (call/fold の正解基準)
  cEV: number;
  dollarEV: number;
  heroEq: number; // hero hand vs villain push range
  // 参考値: BF 線形化近似 (旧ロジック)。教育目的で「詳しい計算式」に表示する。
  bf: number;
  dollarEVApprox: number;
  bfEquityNow: number;
  bfEquityWin: number;
  bfEquityLose: number;
  // 厳密 ICM の3終端 (fold / call-win / call-lose) の hero エクイティ + 全員スタック
  equityFold: number;
  equityWin: number;
  equityLose: number;
  stacksFold: number[];
  stacksWin: number[];
  stacksLose: number[];
  callAmount: number;
  potIfWin: number;
}

type PracticeProblem = PracticeProblemBase & PracticeProblemDerived;

/**
 * PracticeProblemBase から判定/表示に必要な派生値をすべて計算する。
 * generateRandomPracticeProblem() の本体でもあり、
 * 復習リストなど旧スキーマの問題を読み込んだ際の再計算にも使う
 * (ensureDerivedFields 参照)。
 */
function computeDerivedFields(base: PracticeProblemBase): PracticeProblemDerived {
  const { scenarioPlayers, payouts, sb, bb, totalAnte, villainCallRangePct, heroHand } = base;
  const heroIdx = scenarioPlayers.findIndex((p) => p.role === "hero");
  const villainIdx = scenarioPlayers.findIndex((p) => p.role === "villain");
  const sbIdx = scenarioPlayers.findIndex((p) => p.position === "SB");
  const stacks = scenarioPlayers.map((p) => p.stack);
  const villainPos = scenarioPlayers[villainIdx]!.position;

  // BF 近似 (参考値: 実効スタックの対称フリップ → 線形化)
  const safeRisk = Math.min(stacks[heroIdx]!, stacks[villainIdx]!);
  const bfResult = calculateBubbleFactor({
    stacks,
    payouts,
    heroIndex: heroIdx,
    villainIndex: villainIdx,
    riskChips: safeRisk,
  });
  const podds = calculatePotOdds({
    heroStack: stacks[heroIdx]!,
    villainStack: stacks[villainIdx]!,
    heroPosition: "BB", // 練習問題では hero は常に BB
    villainPosition: posToPotOddsPos(villainPos),
    sb, bb, ante: totalAnte,
  });
  const callAmount = podds.callAmount;
  const potIfWin = podds.potIfWin;
  const approxEq = calculateRequiredEquity({
    callAmount,
    potIfWin,
    bubbleFactor: bfResult.bf,
  });

  // 厳密 ICM (fold / call-win / call-lose の3終端を直接解く)
  const exact = calculateExactCallEquity({
    stacks,
    payouts,
    heroIndex: heroIdx,
    villainIndex: villainIdx,
    heroPosition: "BB",
    villainPosition: posToPotOddsPos(villainPos),
    sbPlayerIndex: sbIdx >= 0 ? sbIdx : undefined,
    sb, bb, ante: totalAnte,
  });

  // hero hand equity vs villain push range (Top X%)
  const villainRange = topRange(villainCallRangePct);
  const heroEq = equity(heroHand, villainRange);

  return {
    cEV: approxEq.cEV,
    dollarEV: exact.requiredEquity,
    heroEq,
    bf: bfResult.bf,
    dollarEVApprox: approxEq.dollarEV,
    bfEquityNow: bfResult.equityNow,
    bfEquityWin: bfResult.equityWin,
    bfEquityLose: bfResult.equityLose,
    equityFold: exact.equityFold,
    equityWin: exact.equityWin,
    equityLose: exact.equityLose,
    stacksFold: exact.stacksFold.slice(),
    stacksWin: exact.stacksWin.slice(),
    stacksLose: exact.stacksLose.slice(),
    callAmount,
    potIfWin,
  };
}

/**
 * 復習リストなど旧スキーマ (厳密 ICM 導入前) の PracticeProblem を読み込んだ場合、
 * 新フィールド (equityFold 等) が欠けているため base フィールドから再計算して補う。
 * 新スキーマの問題はそのまま返す (無駄な再計算をしない)。
 */
function ensureDerivedFields(p: PracticeProblem): PracticeProblem {
  if (
    p.equityFold !== undefined &&
    p.dollarEVApprox !== undefined &&
    p.bfEquityNow !== undefined &&
    p.stacksFold !== undefined
  ) {
    return p;
  }
  return { ...p, ...computeDerivedFields(p) };
}

const POSITION_SETS_PRACTICE: Record<number, Position[]> = {
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "CO"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
};

const PAYOUT_TEMPLATES = [
  [50, 30, 20],
  [40, 25, 15, 10, 5, 3, 2],
  [100],
  [33, 33, 33], // satellite
  [60, 40],
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

type Difficulty = "easy" | "normal" | "hard";
const DIFF_BANDS: Record<Difficulty, number> = {
  easy: 0.10,
  normal: 0.05,
  hard: 0.02,
};
let practiceDifficulty: Difficulty = "normal";
try {
  const v = localStorage.getItem("poker-icm-practice-diff") as Difficulty | null;
  if (v && (v === "easy" || v === "normal" || v === "hard")) practiceDifficulty = v;
} catch { /* ignore */ }

// 練習モード: call/fold 判定 か RP 当て か
type PracticeMode = "callfold" | "rp";
// RP モードのスライダー回答の許容誤差 (±%)
const RP_TOLERANCE: Record<Difficulty, number> = {
  easy: 4,
  normal: 2.5,
  hard: 1.5,
};
let practiceMode: PracticeMode = "callfold";
try {
  const v = localStorage.getItem("poker-icm-practice-mode") as PracticeMode | null;
  if (v === "callfold" || v === "rp") practiceMode = v;
} catch { /* ignore */ }

// RP (Risk Premium) = $EV 必要勝率 − cEV 必要勝率
function problemRP(p: PracticeProblem): number {
  return (p.dollarEV - p.cEV) * 100;
}

/**
 * 判定結果に添える「教訓」一行。優先順位で最初にマッチしたものだけを返す。
 * 1. ペイアウトがほぼ均等 (サテライト型)
 * 2. villain がカバーしている (villainStack >= heroStack) かつ RP が高い
 * 3. hero がカバーしている (villainStack < heroStack) かつ RP が低い
 * 4. hero より短いスタックの other プレイヤーがいる
 * 5. それ以外の一般則
 */
function practiceLesson(p: PracticeProblem): string {
  const payouts = p.payouts;
  // WTA (ペイ1つ) は ICM 圧ゼロ。均等ペイ判定より先に処理しないと
  // max=min で「サテライト」に誤マッチする
  if (payouts.length === 1) {
    return "🏆 WTA (勝者総取り) ではチップ＝賞金がリニア。ICM 圧はゼロなので、cEV (チップの損得) どおりに判断できます。";
  }
  if (payouts.length >= 2) {
    const maxPayout = Math.max(...payouts);
    const minPayout = Math.min(...payouts);
    if (maxPayout > 0 && maxPayout - minPayout < maxPayout * 0.15) {
      return "🛰 サテライトでは『残ること』が全て。どんな強いハンドでも RP が極端に上がり、ほぼ全てのコールが正当化されません。";
    }
  }

  const hero = p.scenarioPlayers.find((pl) => pl.role === "hero");
  const villain = p.scenarioPlayers.find((pl) => pl.role === "villain");
  const rp = problemRP(p);

  if (hero && villain) {
    if (villain.stack >= hero.stack && rp >= 5) {
      return "⚠️ カバーされている相手へのコールは、負け＝敗退。トーナメント生命を賭けるため Risk Premium が跳ね上がります。";
    }
    if (villain.stack < hero.stack && rp < 5) {
      return "自分が相手をカバーしている時は、負けても飛ばないため RP は小さめ。cEV に近い感覚でコールできます。";
    }
  }

  if (hero) {
    const hasShorterOther = p.scenarioPlayers.some(
      (pl) => pl.role === "other" && pl.stack < hero.stack,
    );
    if (hasShorterOther) {
      return "自分より短いスタックが残っている間は、無理に勝負しなくても順位が上がる可能性があります。それが RP の源泉です。";
    }
  }

  return "必要勝率 = cEV + Risk Premium。ICM 下では『チップで得』でも『賞金で損』になり得ることを常に確認しましょう。";
}

/**
 * 縮退問題の検出: 勝っても負けても $ エクイティがほぼ変わらない
 * (例: ほぼ均等ペイのサテライトで残り人数 = 入賞数 → 全員インマネ確定)。
 * 33.4/33.3/33.3 のような微差ペイでは差が厳密ゼロにならないため、
 * 「賞金プールの 0.5% 未満しか懸かっていない」を縮退とみなす相対判定にする。
 */
function isDegenerateProblem(p: PracticeProblem): boolean {
  // 実際に賞金がかかるのは先頭 min(プレイヤー数, payouts数) 件のみ (ICM の numPlaces
  // と同じ規則)。payouts の方が要素数が多い場合 (例: 7人分ペイのテーブルを3人戦に
  // 流用) に余剰分まで合計してしまうと totalPayout が過大になり、縮退判定の
  // 閾値 (0.5%) が実質より緩くなってしまう。
  const numPlaces = Math.min(p.scenarioPlayers.length, p.payouts.length);
  const totalPayout = p.payouts.slice(0, numPlaces).reduce((a, b) => a + b, 0);
  return p.equityWin - p.equityLose < totalPayout * 0.005;
}

// generateRandomPracticeProblem() は ICM の丸め誤差等でごく稀に例外を投げ得る
// (core 側で大部分は修正済みだが、防御的に多重で守る)。試行ループの中で1回
// 例外が出ても、そのドローを捨てて次の乱数で再試行するだけにし、練習画面全体を
// クラッシュさせない。
function tryGenerateRandomPracticeProblem(): PracticeProblem | null {
  try {
    return generateRandomPracticeProblem();
  } catch (err) {
    console.warn("練習問題の生成に失敗しました。このドローを破棄します:", err);
    return null;
  }
}

function generatePracticeProblem(): PracticeProblem {
  if (practiceMode === "rp") {
    // RP モード: 縮退問題を除外し、RP が自明に小さい問題と
    // スライダー上限 (50%) を超えて回答不能な問題も避ける
    for (let attempt = 0; attempt < 100; attempt++) {
      const p = tryGenerateRandomPracticeProblem();
      if (!p) continue;
      const rp = problemRP(p);
      if (!isDegenerateProblem(p) && rp >= 3 && rp <= 50) return p;
    }
    for (let attempt = 0; attempt < 20; attempt++) {
      const p = tryGenerateRandomPracticeProblem();
      if (p) return p;
    }
    throw new Error("練習問題の生成に失敗しました");
  }
  const band = DIFF_BANDS[practiceDifficulty];
  for (let attempt = 0; attempt < 100; attempt++) {
    const p = tryGenerateRandomPracticeProblem();
    if (!p) continue;
    if (!isDegenerateProblem(p) && Math.abs(p.heroEq - p.dollarEV) <= band) return p;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const p = tryGenerateRandomPracticeProblem();
    if (p) return p;
  }
  throw new Error("練習問題の生成に失敗しました");
}

// streak / accuracy / review state
const STREAK_KEY = "poker-icm-practice-streak";
const STATS_KEY = "poker-icm-practice-stats";
const REVIEW_KEY = "poker-icm-practice-review";

interface PracticeStats {
  total: number;
  correct: number;
}

function loadStreak(): number {
  try { return Number(localStorage.getItem(STREAK_KEY)) || 0; } catch { return 0; }
}
function saveStreak(n: number): void {
  try { localStorage.setItem(STREAK_KEY, String(n)); } catch { /* ignore */ }
}
function loadStats(): PracticeStats {
  try {
    const v = JSON.parse(localStorage.getItem(STATS_KEY) ?? '{"total":0,"correct":0}');
    if (typeof v.total === "number" && typeof v.correct === "number") return v;
  } catch { /* ignore */ }
  return { total: 0, correct: 0 };
}
function saveStats(s: PracticeStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
function loadReviewList(): PracticeProblem[] {
  try {
    const v = JSON.parse(localStorage.getItem(REVIEW_KEY) ?? "[]");
    if (Array.isArray(v)) return v as PracticeProblem[];
  } catch { /* ignore */ }
  return [];
}
function saveReviewList(list: PracticeProblem[]): void {
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify(list.slice(0, 50))); } catch { /* ignore */ }
}

// ===== 練習履歴 (成績の推移パネル用) =====
const HISTORY_KEY = "poker-icm-practice-history";
const HISTORY_MAX = 500;

interface PracticeHistoryEntry {
  t: number; // epoch ms
  mode: PracticeMode;
  diff: Difficulty;
  ok: boolean;
}

function loadHistory(): PracticeHistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (Array.isArray(v)) return v as PracticeHistoryEntry[];
  } catch { /* ignore */ }
  return [];
}
function saveHistory(list: PracticeHistoryEntry[]): void {
  try {
    // 上限を超えたら古いものから捨てる (末尾が最新)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-HISTORY_MAX)));
  } catch { /* ignore */ }
}
function appendHistory(entry: PracticeHistoryEntry): void {
  const list = loadHistory();
  list.push(entry);
  saveHistory(list);
}

function updatePracticeBadges(): void {
  const streak = loadStreak();
  const stats = loadStats();
  const review = loadReviewList();
  const streakEl = document.getElementById("practice-streak");
  const accEl = document.getElementById("practice-acc");
  const reviewCountEl = document.getElementById("review-count");
  if (streakEl) {
    streakEl.textContent = `🔥 連続正解 ${streak}`;
    streakEl.classList.toggle("active", streak >= 3);
  }
  if (accEl) {
    if (stats.total > 0) {
      accEl.textContent = `正解率 ${((stats.correct / stats.total) * 100).toFixed(0)}% (${stats.correct}/${stats.total})`;
    } else {
      accEl.textContent = "正解率 -";
    }
  }
  if (reviewCountEl) reviewCountEl.textContent = String(review.length);
}

// ===== 成績の推移パネル =====

// 正解率に応じた色分け: 70%以上=good, 50-70%=warn, 未満=bad
function progressAccColor(acc: number | null): string {
  if (acc === null) return "var(--muted)";
  if (acc >= 0.7) return "var(--good)";
  if (acc >= 0.5) return "var(--warn)";
  return "var(--bad)";
}
function progressFmtPct(acc: number | null): string {
  return acc === null ? "-" : `${(acc * 100).toFixed(0)}%`;
}

// 直近100問を10問ごとの正解率にまとめて折れ線 SVG (文字列) を生成
function buildPracticeSparklineSVG(history: PracticeHistoryEntry[]): string {
  const recent = history.slice(-100);
  const groups: PracticeHistoryEntry[][] = [];
  for (let i = 0; i < recent.length; i += 10) groups.push(recent.slice(i, i + 10));
  if (groups.length < 4) {
    return `<div class="progress-sparkline-empty">まだデータが足りません (${recent.length}問)</div>`;
  }
  const accs = groups.map((g) => g.filter((e) => e.ok).length / g.length);
  const W = 300;
  const H = 60;
  const padX = 4;
  const padTop = 6;
  const padBottom = 6;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;
  const pts = accs.map((a, i) => {
    const x = groups.length > 1 ? padX + (i / (groups.length - 1)) * plotW : W / 2;
    const y = padTop + (1 - a) * plotH;
    return [x, y] as const;
  });
  const lineStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const firstX = pts[0]![0].toFixed(1);
  const lastX = pts[pts.length - 1]![0].toFixed(1);
  const areaStr = `${firstX},${(H - padBottom).toFixed(1)} ${lineStr} ${lastX},${(H - padBottom).toFixed(1)}`;
  return `
    <svg class="progress-sparkline-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="60" role="img" aria-label="直近の正解率推移">
      <polygon points="${areaStr}" style="fill: color-mix(in srgb, var(--accent) 22%, transparent); stroke: none;"></polygon>
      <polyline points="${lineStr}" style="fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;"></polyline>
    </svg>
  `;
}

function updatePracticeProgress(): void {
  const body = document.getElementById("practice-progress-body");
  if (!body) return;
  const history = loadHistory();
  const stats = loadStats();
  const overallAcc = stats.total > 0 ? stats.correct / stats.total : null;

  const last20 = history.slice(-20);
  const last20Correct = last20.filter((e) => e.ok).length;
  const last20Acc = last20.length > 0 ? last20Correct / last20.length : null;

  const diffRows = (["easy", "normal", "hard"] as Difficulty[]).map((d) => {
    const items = history.filter((e) => e.diff === d);
    const c = items.filter((e) => e.ok).length;
    const t = items.length;
    const label = d === "easy" ? "Easy" : d === "normal" ? "Normal" : "Hard";
    return { label, c, t, acc: t > 0 ? c / t : null };
  });

  const modeRows = (["callfold", "rp"] as PracticeMode[]).map((m) => {
    const items = history.filter((e) => e.mode === m);
    const c = items.filter((e) => e.ok).length;
    const t = items.length;
    const label = m === "callfold" ? "コール/フォールド判定" : "RP 当て";
    return { label, c, t, acc: t > 0 ? c / t : null };
  });

  body.innerHTML = `
    <div class="progress-headline">
      <div class="progress-headline-item">
        <div class="progress-headline-label">直近20問</div>
        <div class="progress-headline-value" style="color: ${progressAccColor(last20Acc)}">${progressFmtPct(last20Acc)}</div>
        <div class="progress-headline-sub">${last20Correct}/${last20.length}問</div>
      </div>
      <div class="progress-headline-item">
        <div class="progress-headline-label">全期間</div>
        <div class="progress-headline-value" style="color: ${progressAccColor(overallAcc)}">${progressFmtPct(overallAcc)}</div>
        <div class="progress-headline-sub">${stats.correct}/${stats.total}問</div>
      </div>
    </div>
    <div class="progress-sparkline-wrap">
      <div class="progress-block-title">推移 (直近100問・10問ごとの正解率)</div>
      ${buildPracticeSparklineSVG(history)}
    </div>
    <div class="progress-block">
      <div class="progress-block-title">難易度別</div>
      <div class="progress-breakdown-grid">
        ${diffRows.map((r) => `
          <div class="progress-breakdown-cell">
            <div class="progress-breakdown-label">${r.label}</div>
            <div class="progress-breakdown-value" style="color: ${progressAccColor(r.acc)}">${progressFmtPct(r.acc)}</div>
            <div class="progress-breakdown-sub">${r.c}/${r.t}</div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="progress-block">
      <div class="progress-block-title">モード別</div>
      <div class="progress-breakdown-grid progress-breakdown-grid-2">
        ${modeRows.map((r) => `
          <div class="progress-breakdown-cell">
            <div class="progress-breakdown-label">${r.label}</div>
            <div class="progress-breakdown-value" style="color: ${progressAccColor(r.acc)}">${progressFmtPct(r.acc)}</div>
            <div class="progress-breakdown-sub">${r.c}/${r.t}</div>
          </div>
        `).join("")}
      </div>
    </div>
    <button id="practice-history-reset-btn" type="button" class="progress-reset-btn">🗑️ 履歴をリセット</button>
  `;
}

function generateRandomPracticeProblem(): PracticeProblem {
  const n = 3 + Math.floor(Math.random() * 4); // 3-6
  const positions = POSITION_SETS_PRACTICE[n]!;
  const scenarioPlayers: { stack: number; role: Role; position: Position }[] = [];
  for (let i = 0; i < n; i++) {
    scenarioPlayers.push({
      stack: 5 + Math.floor(Math.random() * 25), // 5-30 BB
      role: "other",
      position: positions[i] ?? "",
    });
  }
  // hero は常に BB (call 側 = 最後に行動するポジション)
  // POSITION_SETS の各サイズで BB は index 2 に配置されている
  const heroIdx = positions.indexOf("BB");
  // villain (push 側) は BB 以外からランダム選定
  let villainIdx = Math.floor(Math.random() * n);
  while (villainIdx === heroIdx) villainIdx = Math.floor(Math.random() * n);
  scenarioPlayers[heroIdx]!.role = "hero";
  scenarioPlayers[villainIdx]!.role = "villain";

  const payouts = pickRandom(PAYOUT_TEMPLATES);
  const sb = DEFAULT_SB;
  const bb = DEFAULT_BB;
  const totalAnte = DEFAULT_ANTE;
  const villainCallRangePct = 5 + Math.floor(Math.random() * 95); // 5-100%

  // 自分のハンド
  const heroHand = ALL_169_HANDS[Math.floor(Math.random() * ALL_169_HANDS.length)]!;

  const base: PracticeProblemBase = {
    scenarioPlayers,
    payouts,
    sb, bb, totalAnte,
    villainCallRangePct,
    heroHand,
  };
  return { ...base, ...computeDerivedFields(base) };
}

function renderRoundTable(
  container: HTMLElement,
  scenarioPlayers: { stack: number; role: Role; position: Position }[],
  blinds?: { sb: number; bb: number; totalAnte: number },
): void {
  const n = scenarioPlayers.length;
  const heroIdx = scenarioPlayers.findIndex((p) => p.role === "hero");
  const seats: string[] = [];
  const chips: string[] = [];
  // 席の配置半径と「場」チップの配置半径 (席と中央ポットの中間に配置)
  const seatR = 46;
  const chipR = 23;
  // BB ante 構造: BB が ante 全部を負担、他はゼロ
  // hero を 6 時方向 (90度=π/2) に配置、他は時計回り
  for (let i = 0; i < n; i++) {
    const offset = heroIdx >= 0 ? (i - heroIdx + n) % n : i;
    const angle = Math.PI / 2 + (offset / n) * 2 * Math.PI;
    const sx = 50 + Math.cos(angle) * seatR;
    const sy = 50 + Math.sin(angle) * seatR;
    const p = scenarioPlayers[i]!;
    const cls =
      p.role === "hero" ? "hero" : p.role === "villain" ? "villain" : "";
    const tag = p.role === "hero" ? "🎯 " : p.role === "villain" ? "⚔️ " : "";

    // BB ante 構造: 「場」拠出は live commit (blind) のみ
    //   SB は SB blind、BB は BB blind、他は 0
    //   BB ante は dead 扱いなので中央 pot のチップに集約 (ここでは出さない)
    let committed = 0;
    if (p.position === "SB" && blinds) committed = blinds.sb;
    if (p.position === "BB" && blinds) committed = blinds.bb;
    const remaining = p.stack - committed;

    seats.push(`
      <div class="round-table-seat ${cls}" style="left:${sx}%;top:${sy}%">
        <div class="seat-pos">${tag}${p.position || `P${i + 1}`}</div>
        <div class="seat-stack">${remaining.toFixed(remaining % 1 === 0 ? 0 : 2)}<span class="seat-stack-unit">BB 残</span></div>
      </div>
    `);

    // 場のチップ: 席から中央へ向かう途中に配置
    if (committed > 0) {
      const cx = 50 + Math.cos(angle) * chipR;
      const cy = 50 + Math.sin(angle) * chipR;
      chips.push(`
        <div class="round-table-chip ${cls}" style="left:${cx}%;top:${cy}%">
          ${committed.toFixed(committed % 1 === 0 ? 0 : 1)}<small>bb</small>
        </div>
      `);
    }
  }
  // 中央: ポット合計 (BB ante 構造: BB が ante 全部負担)
  let potHtml = "";
  if (blinds) {
    const potTotal = blinds.sb + blinds.bb + blinds.totalAnte;
    // ante は dead money として中央 pot の脇にチップ表示 (どの席にも紐付かないため)
    const anteChip = blinds.totalAnte > 0
      ? `<div class="round-table-chip ante" style="left:42%;top:50%">ante ${blinds.totalAnte.toFixed(blinds.totalAnte % 1 === 0 ? 0 : 1)}<small>bb</small></div>`
      : "";
    potHtml = `
      ${anteChip}
      <div class="round-table-pot">Pot ${potTotal.toFixed(1)}<small>bb</small></div>
    `;
  }
  container.innerHTML = `
    <div class="round-table">
      ${potHtml}
      ${chips.join("")}
      ${seats.join("")}
    </div>
  `;
}

// 「トーナメント状態」bento カード: 左にブラインド/ペイ、右に Hero スタック。
// extraHtml には呼び出し側で用意した下段(Villain All-in 警告 or RP用の call/return 情報)を差し込む。
function renderScenarioBento(p: PracticeProblem, extraHtml: string): string {
  const totalPrize = p.payouts.reduce((a, b) => a + b, 0);
  const payoutStr = p.payouts
    .map((v) => ((v / totalPrize) * 100).toFixed(0) + "%")
    .join(" / ");
  const hero = p.scenarioPlayers.find((pl) => pl.role === "hero");
  const heroStack = hero ? hero.stack : 0;
  return `
    <div class="scenario-card">
      <div class="scenario-glow scenario-glow-a"></div>
      <div class="scenario-glow scenario-glow-b"></div>
      <div class="scenario-main">
        <div class="scenario-col">
          <div class="scenario-label">TOURNAMENT STATE</div>
          <div class="scenario-fact"><span class="scenario-fact-key">Blinds</span><span class="scenario-fact-val">SB ${p.sb} / BB ${p.bb}</span></div>
          <div class="scenario-fact"><span class="scenario-fact-key">アンティ合計</span><span class="scenario-fact-val">${p.totalAnte}</span></div>
          <div class="scenario-fact"><span class="scenario-fact-key">ペイ</span><span class="scenario-fact-val">${payoutStr}</span></div>
        </div>
        <div class="scenario-divider"></div>
        <div class="scenario-col scenario-col-hero">
          <div class="scenario-label">HERO STACK</div>
          <div class="scenario-hero-stack">${heroStack}<span class="scenario-unit">BB</span></div>
        </div>
      </div>
      ${extraHtml}
    </div>
  `;
}

// ハンド表記 (例 "AKs" / "QQ" / "T9o") をトランプ2枚の視覚表現に変換。
// suited は ♠♠、offsuit/pair は ♠♥ (♥/♦ は赤、♠/♣ は濃色)。
function renderHeroHandCards(hand: HandNotation): string {
  const isPair = hand.length === 2;
  const r1 = hand[0]!;
  const r2 = hand[1]!;
  const suited = !isPair && hand[2] === "s";
  const label = (r: string) => (r === "T" ? "10" : r);
  const suit2 = suited ? "♠" : "♥";
  const red2 = !suited;
  const cardHtml = (
    rank: string,
    suit: string,
    red: boolean,
    rotateCls: string,
  ) => `
    <div class="playing-card ${rotateCls}${red ? " pc-red" : ""}">
      <div class="pc-corner pc-corner-tl">${label(rank)}<br />${suit}</div>
      <div class="pc-suit-center">${suit}</div>
      <div class="pc-corner pc-corner-br">${label(rank)}<br />${suit}</div>
    </div>
  `;
  return `
    <div class="hero-hand-cards" aria-hidden="true">
      ${cardHtml(r1, "♠", false, "pc-rotate-l")}
      ${cardHtml(r2, suit2, red2, "pc-rotate-r")}
    </div>
  `;
}

let currentProblem: PracticeProblem | null = null;

function renderPracticeProblem(rawP: PracticeProblem): void {
  // 復習リストなど旧スキーマの問題は派生値を再計算してから使う
  const p = ensureDerivedFields(rawP);
  currentProblem = p;
  if (practiceMode === "rp") {
    renderPracticeProblemRP(p);
    return;
  }
  const area = document.getElementById("practice-area");
  if (!area) return;
  const villain = p.scenarioPlayers.find((pl) => pl.role === "villain");
  const villainWarnHtml = `
    <div class="scenario-warn">
      <div class="scenario-warn-head">⚠️ Villain (${villain?.position || "?"}) All-in</div>
      <div class="scenario-warn-body">
        <span class="scenario-warn-item">Stack <strong>${villain ? villain.stack : "?"} BB</strong></span>
        <span class="scenario-warn-item">Est. Push Range <strong>Top ${p.villainCallRangePct}%</strong></span>
      </div>
    </div>
  `;
  area.innerHTML = `
    <div id="practice-table-wrapper"></div>
    ${renderScenarioBento(p, villainWarnHtml)}
    <p class="hint">※ Top X% は本ツール定義の強度順。他ツールとは一致しない場合があります。</p>
    <h3 style="font-size: 13px; margin: 12px 0 4px;">⚔️ 相手の push レンジ 🔴</h3>
    <div id="practice-villain-grid" class="hand-grid"></div>
    ${renderHeroHandCards(p.heroHand)}
    <div class="practice-hand">あなたのハンド: ${p.heroHand}</div>
    <div class="practice-actions">
      <button class="practice-btn call" data-answer="call">✅ コール</button>
      <button class="practice-btn fold" data-answer="fold">❌ フォールド</button>
    </div>
    <div id="practice-feedback"></div>
  `;
  const tableWrap = document.getElementById("practice-table-wrapper");
  if (tableWrap) renderRoundTable(tableWrap, p.scenarioPlayers, {
    sb: p.sb, bb: p.bb, totalAnte: p.totalAnte,
  });
  const villainGridEl = document.getElementById(
    "practice-villain-grid",
  ) as HTMLDivElement | null;
  if (villainGridEl) {
    const range = topRange(p.villainCallRangePct);
    renderGrid(villainGridEl, (h) => {
      const isPicked = h === p.heroHand;
      const inRange = range.has(h);
      if (isPicked && inRange) return "in-range-villain picked";
      if (isPicked) return "picked";
      return inRange ? "in-range-villain" : "";
    });
  }
}

// Easy モード用: 正解 RP (0.5%単位に丸め) から重複なし・非負の4択を作りシャッフルする。
// 既定オフセットは 0 / +5 / -5 / +10。-5 が負になる場合は 0 / +5 / +10 / +15 に切り替える。
function buildEasyRPChoices(correctRounded: number): number[] {
  const wouldGoNegative = correctRounded - 5 < 0;
  const offsets = wouldGoNegative ? [0, 5, 10, 15] : [0, 5, -5, 10];
  const values = offsets.map((o) => correctRounded + o);
  // Fisher-Yates シャッフル
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  return values;
}

// RP 当てモード: Normal/Hard はスライダー、Easy は4択ボタンで Risk Premium を推定させる
function renderPracticeProblemRP(p: PracticeProblem): void {
  const area = document.getElementById("practice-area");
  if (!area) return;
  const tol = RP_TOLERANCE[practiceDifficulty];
  const rpInfoHtml = `
    <div class="scenario-rp-info">
      <span class="scenario-warn-item">コール額 (リスク) <strong>${p.callAmount.toFixed(1)} BB</strong></span>
      <span class="scenario-warn-item">リターン <strong>${p.potIfWin.toFixed(1)} BB</strong></span>
    </div>
  `;
  const isEasy = practiceDifficulty === "easy";
  const quizBodyHtml = isEasy
    ? (() => {
        const correctRounded = Math.round(problemRP(p) * 2) / 2;
        const choices = buildEasyRPChoices(correctRounded);
        return `
          <div class="rp-choices" id="rp-choices">
            ${choices
              .map(
                (v) =>
                  `<button type="button" class="rp-choice-btn" data-value="${v}">+${v.toFixed(1)}%</button>`,
              )
              .join("")}
          </div>
          <div class="rp-quiz-tol">4択から選んでタップ (Easy)</div>
        `;
      })()
    : `
      <div class="rp-slider-value" id="rp-slider-value">+20.0%</div>
      <input type="range" id="rp-slider" class="rp-slider" min="0" max="50" step="0.5" value="20" />
      <div class="rp-slider-scale"><span>0%</span><span>25%</span><span>50%</span></div>
      <div class="rp-quiz-tol">許容誤差 ±${tol}%（難易度で変化）</div>
      <button id="rp-answer-btn" type="button" class="solve-btn">回答する</button>
    `;
  area.innerHTML = `
    <div id="practice-table-wrapper"></div>
    ${renderScenarioBento(p, rpInfoHtml)}
    <div class="rp-quiz">
      <div class="rp-quiz-q">📊 この状況の Risk Premium は？</div>
      ${quizBodyHtml}
    </div>
    <div id="practice-feedback"></div>
  `;
  const tableWrap = document.getElementById("practice-table-wrapper");
  if (tableWrap) renderRoundTable(tableWrap, p.scenarioPlayers, {
    sb: p.sb, bb: p.bb, totalAnte: p.totalAnte,
  });
  const slider = document.getElementById("rp-slider") as HTMLInputElement | null;
  const valLabel = document.getElementById("rp-slider-value");
  if (slider && valLabel) {
    slider.addEventListener("input", () => {
      valLabel.textContent = "+" + Number(slider.value).toFixed(1) + "%";
    });
  }
}

function judgePracticeRP(guess: number): void {
  if (!currentProblem) return;
  const p = ensureDerivedFields(currentProblem);
  currentProblem = p;
  const fb = document.getElementById("practice-feedback");
  if (!fb) return;
  // RP = 厳密必要勝率 (p.dollarEV) − cEV に統一
  const actualRP = problemRP(p);
  const actualRPApprox = (p.dollarEVApprox - p.cEV) * 100;
  const tol = RP_TOLERANCE[practiceDifficulty];
  const diff = guess - actualRP;
  const isCorrect = Math.abs(diff) <= tol;
  fb.className = "practice-feedback " + (isCorrect ? "correct" : "wrong");

  recordPracticeResult(isCorrect, p);

  // 同じ問題を再回答できないようスライダー/ボタンを無効化
  const slider = document.getElementById("rp-slider") as HTMLInputElement | null;
  const ansBtn = document.getElementById("rp-answer-btn") as HTMLButtonElement | null;
  if (slider) slider.disabled = true;
  if (ansBtn) ansBtn.disabled = true;

  // Easy モードの4択: 全て無効化し、正解をハイライト
  const choiceWrap = document.getElementById("rp-choices");
  if (choiceWrap) {
    const correctRounded = Math.round(actualRP * 2) / 2;
    choiceWrap.querySelectorAll<HTMLButtonElement>(".rp-choice-btn").forEach((b) => {
      b.disabled = true;
      const v = Number(b.dataset.value);
      if (v === correctRounded) b.classList.add("correct-choice");
      else if (v === guess) b.classList.add("wrong-choice");
    });
  }

  const evBF = p.callAmount * p.bf;
  fb.innerHTML = `
    <div class="verdict-row">
      <div class="verdict">${isCorrect ? "🎉 正解!" : "😅 不正解"}</div>
      <button id="practice-next-btn-top" type="button" class="solve-btn compact">🎲 次へ</button>
    </div>
    <div class="practice-lesson">💡 ${practiceLesson(p)}</div>
    <div>あなたの回答: <strong>+${guess.toFixed(1)}%</strong></div>
    <div>正解 RP (厳密 ICM): <strong style="color: var(--accent)">+${actualRP.toFixed(1)}%</strong> <span class="muted">(許容 ±${tol}%)</span></div>
    <div>誤差: <strong style="color: ${isCorrect ? "var(--good)" : "var(--bad)"}">${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%</strong></div>
    <details class="practice-details">
      <summary>📖 詳しい計算式 (タップで展開)</summary>
      <div class="practice-details-body">
        <h4>1. Bubble Factor (参考値: 対称フリップ近似)</h4>
        <p><code>BF = (現状 − 負け) ÷ (勝ち − 現状) = ${(p.bfEquityNow - p.bfEquityLose).toFixed(3)} ÷ ${(p.bfEquityWin - p.bfEquityNow).toFixed(3)} = ${p.bf.toFixed(3)}</code></p>
        <h4>2. 必要勝率</h4>
        <ul>
          <li>cEV: <code>リスク ÷ (リスク + リターン) = ${p.callAmount} ÷ (${p.callAmount} + ${p.potIfWin.toFixed(1)}) = ${(p.cEV * 100).toFixed(1)}%</code></li>
          <li>$EV (BF 近似): <code>(リスク × BF) ÷ (リスク × BF + リターン) = ${evBF.toFixed(2)} ÷ (${evBF.toFixed(2)} + ${p.potIfWin.toFixed(1)}) = ${(p.dollarEVApprox * 100).toFixed(1)}%</code></li>
          <li>$EV (厳密 ICM): <code>(Efold − Elose) ÷ (Ewin − Elose) = ${(p.equityFold - p.equityLose).toFixed(3)} ÷ ${(p.equityWin - p.equityLose).toFixed(3)} = ${(p.dollarEV * 100).toFixed(1)}%</code></li>
        </ul>
        <h4>3. Risk Premium</h4>
        <p><code>RP = 厳密$EV − cEV = ${(p.dollarEV * 100).toFixed(1)}% − ${(p.cEV * 100).toFixed(1)}% = +${actualRP.toFixed(2)}%</code></p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          BF 近似: <strong>+${actualRPApprox.toFixed(2)}%</strong> / 厳密 ICM: <strong style="color: var(--accent);">+${actualRP.toFixed(2)}%</strong>（判定はこちら）
        </p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF が大きい (バブルに近い / スタックが拮抗) ほど RP は大きくなります。BF 近似は境界付近で厳密値と数%ずれることがあります。
        </p>
      </div>
    </details>
    <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">
      <button id="practice-next-btn" type="button" class="solve-btn">🎲 次の問題</button>
      <button id="practice-apply-btn" type="button" class="solve-btn" style="background: var(--card); color: var(--text); border: 1px solid var(--border);">📥 設定に取り込む (詳細分析)</button>
    </div>
  `;
  fb.scrollIntoView({ behavior: "smooth", block: "start" });
}

// streak / stats / review をまとめて更新 (call/fold・RP 両モード共通)
// 復習リストの重複判定用キー。ハンド・相手コールレンジに加え、スタック構成
// (順序込み) と支払いテーブルも含めて正規化し、"似ているが別シナリオ" の問題を
// 誤って重複扱いしないようにする。savedMode (出題時のモード) も含めることで、
// 同じシナリオでも callfold と rp では別問題として扱う (旧データの undefined は
// "callfold" として正規化し、実際に callfold で保存された問題と衝突させる)。
function practiceProblemDedupKey(p: PracticeProblemBase): string {
  const stacks = p.scenarioPlayers.map((sp) => `${sp.role}:${sp.position}:${sp.stack}`).join(",");
  const payouts = p.payouts.join(",");
  const mode = p.savedMode ?? "callfold";
  return `${p.heroHand}|${p.villainCallRangePct}|${stacks}|${payouts}|${mode}`;
}

function recordPracticeResult(isCorrect: boolean, p: PracticeProblem): void {
  const stats = loadStats();
  stats.total += 1;
  if (isCorrect) stats.correct += 1;
  saveStats(stats);
  let streak = loadStreak();
  if (isCorrect) streak += 1;
  else streak = 0;
  saveStreak(streak);
  if (!isCorrect) {
    const list = loadReviewList();
    // p.savedMode は「復習リストから再出題された場合」のみ入っているため、
    // 新規に間違えた問題のキーは「今出題しているモード」を使って正規化する
    // (保存時の savedMode: practiceMode と一致させる)。
    const key = practiceProblemDedupKey({ ...p, savedMode: practiceMode });
    if (!list.some((x) => practiceProblemDedupKey(x) === key)) {
      // 出題時のモードを記録し、復習では同じモードで再出題する
      list.unshift({ ...p, savedMode: practiceMode });
      saveReviewList(list);
    }
  }
  appendHistory({ t: Date.now(), mode: practiceMode, diff: practiceDifficulty, ok: isCorrect });
  updatePracticeBadges();
  updatePracticeProgress();
}

function judgePractice(answer: "call" | "fold"): void {
  if (!currentProblem) return;
  const p = ensureDerivedFields(currentProblem);
  currentProblem = p;
  const fb = document.getElementById("practice-feedback");
  if (!fb) return;
  const margin = p.heroEq - p.dollarEV;
  const correctIsCall = margin >= 0;
  const isCorrect = (correctIsCall && answer === "call") || (!correctIsCall && answer === "fold");
  const verdict = correctIsCall ? "✅ コール (+EV)" : "❌ フォールド (-EV)";
  fb.className = "practice-feedback " + (isCorrect ? "correct" : "wrong");

  // チュートリアル中は streak/正解率/復習リストに記録しない
  if (!tutorialActive) {
    recordPracticeResult(isCorrect, p);
  }
  const tutorialDef = tutorialActive ? TUTORIAL_PROBLEMS[tutorialStep] : undefined;
  const tutorialBlockHtml = tutorialDef
    ? `
    <div class="tutorial-explain-card">
      <div class="tutorial-explain-title">💡 教訓: ${tutorialDef.title}</div>
      <div class="tutorial-explain-body">${tutorialDef.lesson}</div>
      <button id="tutorial-next-btn" type="button" class="solve-btn">次の問題へ →</button>
    </div>
  `
    : "";
  fb.innerHTML = `
    ${tutorialBlockHtml}
    <div class="verdict-row">
      <div class="verdict">${isCorrect ? "🎉 正解!" : "😅 不正解"} 正答: ${verdict}</div>
      <button id="practice-next-btn-top" type="button" class="solve-btn compact">🎲 次へ</button>
    </div>
    <div class="practice-lesson">💡 ${practiceLesson(p)}</div>
    <div>cEV 必要勝率: <strong>${(p.cEV * 100).toFixed(1)}%</strong></div>
    <div>必要勝率 (厳密 ICM): <strong>${(p.dollarEV * 100).toFixed(1)}%</strong> <span class="muted">(参考: BF近似 ${(p.dollarEVApprox * 100).toFixed(1)}%)</span></div>
    <div>${p.heroHand} の equity vs Top${p.villainCallRangePct}%: <strong>${(p.heroEq * 100).toFixed(1)}%</strong></div>
    <div>余裕: <strong style="color: ${margin >= 0 ? "var(--good)" : "var(--bad)"}">${margin >= 0 ? "+" : ""}${(margin * 100).toFixed(1)}%</strong></div>
    <details class="practice-details">
      <summary>📖 詳しい計算式 (タップで展開)</summary>
      <div class="practice-details-body">
        ${(() => {
          const heroIdx = p.scenarioPlayers.findIndex((x) => x.role === "hero");
          const villainIdx = p.scenarioPlayers.findIndex((x) => x.role === "villain");
          const heroPlayer = p.scenarioPlayers[heroIdx]!;
          const villainPlayer = p.scenarioPlayers[villainIdx]!;
          const heroStack = heroPlayer.stack;
          const villainStack = villainPlayer.stack;
          const villainPos = villainPlayer.position;
          const sbDead = villainPos === "SB" ? 0 : p.sb;
          const villainMatch = p.callAmount + p.bb;
          const pot = p.potIfWin + p.callAmount;
          // 終端スタック (厳密 ICM = calculateExactCallEquity と全く同じ計算から取得)
          const stackIfFold = p.stacksFold[heroIdx]!;
          const stackIfWin = p.stacksWin[heroIdx]!;
          const stackIfLose = p.stacksLose[heroIdx]!;
          const winVsFold = stackIfWin - stackIfFold;
          const loseVsFold = stackIfLose - stackIfFold;
          const netWinFromStart = stackIfWin - heroStack;
          const netLoseFromStart = stackIfLose - heroStack;
          const netFoldFromStart = stackIfFold - heroStack;
          return `
        <h4>1. ポット構成 (BB ante 構造)</h4>
        <ul style="font-size: 12px; line-height: 1.5;">
          <li>自分(BB) blind: <code>${p.bb.toFixed(1)}</code> BB <span style="color: var(--muted);">(既出 sunk)</span></li>
          <li>自分(BB) ante: <code>${p.totalAnte.toFixed(1)}</code> BB <span style="color: var(--muted);">(既出 sunk, BBが全額負担)</span></li>
          ${sbDead > 0 ? `<li>SB dead blind: <code>${sbDead.toFixed(1)}</code> BB <span style="color: var(--muted);">(SB folded → dead)</span></li>` : ""}
          <li>自分(BB) これから払う <strong>call</strong>: <code>${p.callAmount.toFixed(1)}</code> BB</li>
          <li>相手(${villainPos}) match: <code>${villainMatch.toFixed(1)}</code> BB <span style="color: var(--muted);">(全 stack ${villainStack} のうちマッチ分)</span></li>
          <li><strong>合計 pot (showdown 時): ${pot.toFixed(1)} BB</strong></li>
        </ul>

        <h4>2. 判断 (call vs fold 比較・終端スタック)</h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr><th style="text-align:left; padding: 4px;">選択</th><th style="text-align:right; padding: 4px;">最終スタック</th><th style="text-align:right; padding: 4px;">vs fold</th><th style="text-align:right; padding: 4px;">起点比</th></tr>
          <tr><td style="padding: 4px;">フォールド</td><td style="text-align:right; padding: 4px;"><code>${stackIfFold.toFixed(1)}</code></td><td style="text-align:right; padding: 4px;"><code>±0</code></td><td style="text-align:right; padding: 4px; color: ${netFoldFromStart >= 0 ? 'var(--good)' : 'var(--bad)'};"><code>${netFoldFromStart >= 0 ? '+' : ''}${netFoldFromStart.toFixed(1)}</code></td></tr>
          <tr><td style="padding: 4px;">コール+勝ち</td><td style="text-align:right; padding: 4px;"><code>${stackIfWin.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: var(--good);"><code>${winVsFold >= 0 ? '+' : ''}${winVsFold.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: ${netWinFromStart >= 0 ? 'var(--good)' : 'var(--bad)'};"><code>${netWinFromStart >= 0 ? '+' : ''}${netWinFromStart.toFixed(1)}</code></td></tr>
          <tr><td style="padding: 4px;">コール+負け</td><td style="text-align:right; padding: 4px;"><code>${stackIfLose.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>${loseVsFold.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>${netLoseFromStart.toFixed(1)}</code></td></tr>
        </table>
        <p style="font-size: 11px; color: var(--muted); margin: 6px 0 0;">
          📌 この3つの終端スタック (fold / コール+勝ち / コール+負け) が、下の「3. ICM エクイティ」の計算にそのまま使われます。<br>
          「起点 (hand 開始) からの純利益」は <strong>${netWinFromStart >= 0 ? '+' : ''}${netWinFromStart.toFixed(1)} BB</strong> (= 最終 ${stackIfWin.toFixed(1)} − 起点 ${heroStack})。
        </p>
          `;
        })()}

        <h4>3. ICM エクイティ ($ 単位・厳密計算)</h4>
        <ul>
          <li>フォールド時: <code>${p.equityFold.toFixed(3)}</code></li>
          <li>コール+勝った時: <code>${p.equityWin.toFixed(3)}</code> (fold比 ${p.equityWin - p.equityFold >= 0 ? "+" : ""}${(p.equityWin - p.equityFold).toFixed(3)})</li>
          <li>コール+負けた時: <code>${p.equityLose.toFixed(3)}</code> (fold比 ${(p.equityLose - p.equityFold).toFixed(3)})</li>
        </ul>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ 上の「2. 判断」の終端スタックそれぞれを ICM (Malmuth-Harville) に通した $ エクイティです。近似 (BF) を経由しない厳密値です。
        </p>

        <h4>4. 参考: Bubble Factor 近似 (実効スタックの対称フリップ)</h4>
        <p><code>BF = (現状 − 負け) ÷ (勝ち − 現状) = ${(p.bfEquityNow - p.bfEquityLose).toFixed(3)} ÷ ${(p.bfEquityWin - p.bfEquityNow).toFixed(3)} = ${p.bf.toFixed(3)}</code></p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF は「実効スタック同士の対称フリップ」という汎用シナリオで測った指標で、実際のコールの fold/win/lose 終端 (上のセクション2・3) とは別の計算です。参考値として掲載しています。
        </p>

        <h4>5. 必要勝率 + Risk Premium</h4>
        <ul>
          <li>cEV: <code>リスク ÷ (リスク + リターン) = ${p.callAmount} ÷ (${p.callAmount} + ${p.potIfWin.toFixed(1)}) = ${(p.cEV * 100).toFixed(1)}%</code></li>
          <li>$EV (BF 近似・線形化): <code>(リスク × BF) ÷ (リスク × BF + リターン) = (${p.callAmount} × ${p.bf.toFixed(2)}) ÷ (${p.callAmount} × ${p.bf.toFixed(2)} + ${p.potIfWin.toFixed(1)}) = ${(p.dollarEVApprox * 100).toFixed(1)}%</code></li>
          <li>$EV (厳密 ICM): <code>(Efold − Elose) ÷ (Ewin − Elose) = ${(p.equityFold - p.equityLose).toFixed(3)} ÷ ${(p.equityWin - p.equityLose).toFixed(3)} = ${(p.dollarEV * 100).toFixed(1)}%</code></li>
        </ul>
        <p style="font-size: 12px; margin: 6px 0;">
          <strong>BF 近似: ${(p.dollarEVApprox * 100).toFixed(1)}% / 厳密 ICM: <span style="color: var(--accent);">${(p.dollarEV * 100).toFixed(1)}%</span>（判定はこちら）</strong>
        </p>
        <ul>
          <li><strong>RP (厳密 ICM)</strong>: <code>厳密$EV − cEV = ${(p.dollarEV * 100).toFixed(1)}% − ${(p.cEV * 100).toFixed(1)}% = ${((p.dollarEV - p.cEV) * 100 >= 0 ? "+" : "")}${((p.dollarEV - p.cEV) * 100).toFixed(2)}%</code></li>
        </ul>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF 近似は線形化のため境界付近で厳密値と 1〜2% ずれることがあります。call/fold の判定は必ず厳密 ICM 側 (${(p.dollarEV * 100).toFixed(1)}%) を使用しています。
        </p>

        <h4>6. ハンド equity</h4>
        <p><code>${p.heroHand}</code> vs Top ${p.villainCallRangePct}% range → <strong>${(p.heroEq * 100).toFixed(1)}%</strong></p>

        <h4>7. 判定</h4>
        <p>
          ハンド equity <code>${(p.heroEq * 100).toFixed(1)}%</code>
          ${p.heroEq >= p.dollarEV ? "≥" : "<"}
          必要勝率 (厳密 ICM) <code>${(p.dollarEV * 100).toFixed(1)}%</code>
          → <strong>${p.heroEq >= p.dollarEV ? "コール (+EV)" : "フォールド (-EV)"}</strong>
        </p>
      </div>
    </details>

    <h3 style="font-size: 13px; margin: 12px 0 4px;">🎯 自分の call レンジ 🟢 (必要勝率 ${(p.dollarEV * 100).toFixed(1)}% 超のハンド)</h3>
    <div id="practice-hero-grid" class="hand-grid"></div>
    <div class="grid-legend">
      <span><span class="legend-box in-range-hero"></span>call (余裕 +0% 以上 = +EV)</span>
      <span><span class="legend-box"></span>fold (余裕 マイナス = -EV)</span>
    </div>
    <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">
      <button id="practice-next-btn" type="button" class="solve-btn">🎲 次の問題</button>
      <button id="practice-apply-btn" type="button" class="solve-btn" style="background: var(--card); color: var(--text); border: 1px solid var(--border);">📥 設定に取り込む (詳細分析)</button>
    </div>
  `;
  const heroGridEl = document.getElementById(
    "practice-hero-grid",
  ) as HTMLDivElement | null;
  if (heroGridEl) {
    const villainRange = topRange(p.villainCallRangePct);
    renderGrid(heroGridEl, (h) => {
      const eq = equity(h, villainRange);
      const margin2 = eq - p.dollarEV;
      const isPicked = h === p.heroHand;
      let cls = margin2 >= 0 ? "in-range-hero" : "";
      if (isPicked) cls += " picked";
      return cls;
    });
  }
  fb.scrollIntoView({ behavior: "smooth", block: "start" });
}

const practiceNewBtn = document.getElementById("practice-new-btn");
practiceNewBtn?.addEventListener("click", () => {
  if (tutorialActive) setTutorialActive(false); // 導入コース中に離脱したら中断扱い
  currentProblem = generatePracticeProblem();
  renderPracticeProblem(currentProblem);
});

// モード別のヒント文を更新
function updatePracticeHint(): void {
  const hint = document.getElementById("practice-hint");
  if (!hint) return;
  hint.textContent = practiceMode === "rp"
    ? "ランダムシナリオの Risk Premium をスライダーで推定。BF と必要勝率の感覚を養う。"
    : "ランダムシナリオ + 相手 push 想定レンジ + 自分のハンド → call/fold を即判定。";
}
updatePracticeHint();

// モード切替 (call/fold 判定 ⇄ RP 当て)
document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
  if (btn.dataset.mode === practiceMode) {
    document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }
  btn.addEventListener("click", () => {
    if (btn.dataset.mode === practiceMode) return;
    document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    practiceMode = btn.dataset.mode as PracticeMode;
    try { localStorage.setItem("poker-icm-practice-mode", practiceMode); } catch { /* ignore */ }
    updatePracticeHint();
    if (tutorialActive) setTutorialActive(false); // 導入コース中に離脱したら中断扱い
    // モードを変えたら新しい問題を出題
    currentProblem = generatePracticeProblem();
    renderPracticeProblem(currentProblem);
  });
});

// 難易度切替
document.querySelectorAll<HTMLButtonElement>(".diff-btn").forEach((btn) => {
  if (btn.dataset.diff === practiceDifficulty) {
    document.querySelectorAll<HTMLButtonElement>(".diff-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }
  btn.addEventListener("click", () => {
    document.querySelectorAll<HTMLButtonElement>(".diff-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    practiceDifficulty = btn.dataset.diff as Difficulty;
    try { localStorage.setItem("poker-icm-practice-diff", practiceDifficulty); } catch { /* ignore */ }
    // 難易度変更は出題中の問題の見た目 (許容誤差表示・スライダー⇄4択など) に影響するため、
    // モード切替と同様に新しい問題を生成して再描画する (チュートリアル中は問題構成が
    // 固定なので対象外)。
    if (!tutorialActive) {
      currentProblem = generatePracticeProblem();
      renderPracticeProblem(currentProblem);
    }
  });
});

// 復習ボタン: 不正解だった問題を順に出題
document.getElementById("practice-review-btn")?.addEventListener("click", () => {
  if (tutorialActive) setTutorialActive(false); // 導入コース中に離脱したら中断扱い
  const list = loadReviewList();
  if (list.length === 0) {
    const area = document.getElementById("practice-area");
    if (area) area.innerHTML = `<div class="practice-info">まだ復習問題はありません。不正解の問題が自動で蓄積されます (最大50問)。</div>`;
    return;
  }
  // 先頭から取り出して再出題 (過去に保存された縮退問題はスキップして破棄)
  let next: PracticeProblem | null = null;
  while (list.length > 0) {
    const candidate = ensureDerivedFields(list.shift()!);
    if (!isDegenerateProblem(candidate)) { next = candidate; break; }
  }
  saveReviewList(list);
  if (!next) {
    const area = document.getElementById("practice-area");
    if (area) area.innerHTML = `<div class="practice-info">まだ復習問題はありません。不正解の問題が自動で蓄積されます (最大50問)。</div>`;
    updatePracticeBadges();
    return;
  }
  // 保存時のモードで再出題する (callfold で保存した問題が RP クイズとして
  // 出てしまうと、RP 用の出題フィルタを素通りした問題になるため)
  const targetMode: PracticeMode = next.savedMode ?? "callfold";
  if (practiceMode !== targetMode) {
    practiceMode = targetMode;
    try { localStorage.setItem("poker-icm-practice-mode", practiceMode); } catch { /* ignore */ }
    document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.mode === practiceMode),
    );
    updatePracticeHint();
  }
  currentProblem = next;
  renderPracticeProblem(currentProblem);
  updatePracticeBadges();
});

// 成績の推移パネル: 履歴リセットボタン (パネルは innerHTML で再生成されるため親要素に委譲)
document.getElementById("practice-progress")?.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest("#practice-history-reset-btn")) return;
  if (confirm("練習履歴（成績の推移データ）をリセットしますか？\n※連続正解数・累計正解率・復習リストは変更されません。")) {
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
    updatePracticeProgress();
  }
});

// 起動時にバッジ更新
updatePracticeBadges();
updatePracticeProgress();

document.getElementById("practice-area")?.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  // 次の問題ボタン (フィードバック内・下部 / 上部どちらも同じ挙動)
  if (target.closest("#practice-next-btn") || target.closest("#practice-next-btn-top")) {
    if (tutorialActive) {
      advanceTutorial();
    } else {
      currentProblem = generatePracticeProblem();
      renderPracticeProblem(currentProblem);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  // RP 当てモードの回答ボタン (Normal/Hard: スライダー)
  if (target.closest("#rp-answer-btn")) {
    const slider = document.getElementById("rp-slider") as HTMLInputElement | null;
    if (slider) judgePracticeRP(Number(slider.value));
    return;
  }
  // RP 当てモードの4択ボタン (Easy)
  const choiceBtn = target.closest<HTMLButtonElement>(".rp-choice-btn");
  if (choiceBtn) {
    if (choiceBtn.disabled) return;
    judgePracticeRP(Number(choiceBtn.dataset.value));
    return;
  }
  // 取り込みボタン (チュートリアル中は CSS で非表示だが念のためガード)
  if (target.closest("#practice-apply-btn")) {
    if (tutorialActive) return;
    if (!currentProblem) return;
    const p = currentProblem;
    players.length = 0;
    for (const sp of p.scenarioPlayers) {
      players.push({
        id: nextId++,
        stack: sp.stack,
        role: sp.role,
        position: sp.position,
      });
    }
    renderPlayers();
    setPayouts(p.payouts);
    nashSbInput.value = String(p.sb);
    nashBbInput.value = String(p.bb);
    nashAnteInput.value = String(p.totalAnte);
    callManualOverride = false;
    recompute();
    applyTab("setup");
    return;
  }
  // call / fold ボタン
  const btn = target.closest<HTMLButtonElement>(".practice-btn");
  if (!btn) return;
  const ans = btn.dataset.answer as "call" | "fold" | undefined;
  if (ans) judgePractice(ans);
});

// ===== 🎓 導入コース (固定5問チュートリアル) =====
// 初心者が ICM の核心を5問で体感する固定カリキュラム。
// スコア/streak/復習リストには一切記録しない (recordPracticeResult を呼ばない)。
const TUTORIAL_DONE_KEY = "poker-icm-tutorial-done";

interface TutorialProblemDef {
  title: string;
  narration: string;
  lesson: string;
  base: PracticeProblemBase;
}

// 各問題のパラメータは core の厳密 ICM 計算 (calculateExactCallEquity) で
// 事前検証済み (report 参照)。以下はその検証結果:
//   Q1: margin(heroEq-厳密必要勝率) = +16.8% (明確なコール, RP=0)
//   Q2: RP = +2.35%, margin = +12.8% (小さい RP でも明確なコール)
//   Q3: cEV必要勝率(44.1%) < heroEq(53.6%) < 厳密必要勝率(63.4%) ← ICMプレッシャーの核心
//   Q4: margin = -3.2% (わずかにフォールド)
//   Q5: margin = -12.4% (AKs でも大きくフォールド)
const TUTORIAL_PROBLEMS: TutorialProblemDef[] = [
  {
    title: "チップ＝賞金の世界",
    narration:
      "全員が同じ賞金を狙う一発勝負 (Winner Take All)。ここではチップ＝そのまま賞金です。",
    lesson:
      "WTA では順位という概念がなく、勝率がそのまま賞金期待値に直結します。だから Risk Premium はゼロ。cEV（チップ的な必要勝率）だけで判断できる、ICM プレッシャーが存在しない最もシンプルなケースです。",
    base: {
      scenarioPlayers: [
        { stack: 20, role: "hero", position: "BB" },
        { stack: 15, role: "villain", position: "BTN" },
        { stack: 25, role: "other", position: "SB" },
      ],
      payouts: [100],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 50,
      heroHand: "AQo",
    },
  },
  {
    title: "相手をカバーしている",
    narration:
      "相手のスタックはあなたより少ない。もし負けても、あなたはまだトーナメントに残ります。",
    lesson:
      "自分が相手をカバーしている（負けても飛ばない）ときは、Risk Premium は小さめ。cEV に近い感覚でコールして大丈夫です。ICM プレッシャーは『自分が飛ぶリスク』があるときに強く働きます。",
    base: {
      scenarioPlayers: [
        { stack: 30, role: "hero", position: "BB" },
        { stack: 12, role: "villain", position: "BTN" },
        { stack: 20, role: "other", position: "SB" },
      ],
      payouts: [50, 30, 20],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 40,
      heroHand: "AJo",
    },
  },
  {
    title: "バブルの罠",
    narration:
      "あなたは4人残りの3番手。チップリーダーがオールイン。ハンドは悪くない…がこれはワナかもしれない。",
    lesson:
      "チップの上ではコールが得（cEV的には+EV）でも、厳密な ICM で計算すると必要勝率が跳ね上がり、フォールドが正解になることがあります。これが『ICM プレッシャー』の正体。飛べば賞金の可能性が消える一方、生き残れば上位の賞金が保証されるため、コールのリスクは額面以上に重いのです。",
    base: {
      scenarioPlayers: [
        { stack: 15, role: "hero", position: "BB" },
        { stack: 22, role: "villain", position: "BTN" },
        { stack: 10, role: "other", position: "SB" },
        { stack: 18, role: "other", position: "CO" },
      ],
      payouts: [50, 30, 20],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 40,
      heroHand: "A9o",
    },
  },
  {
    title: "短スタックを待て",
    narration:
      "卓にはあなたよりずっと短いスタックの選手がいます。相手のオールインはギリギリ微妙なラインです。",
    lesson:
      "自分より短いスタックが残っている間は、その選手が先に飛んでくれれば自動的に順位が上がります。無理にコールしなくても得られる価値がある以上、微妙なラインはフォールド優位になりがちです。",
    base: {
      scenarioPlayers: [
        { stack: 18, role: "hero", position: "BB" },
        { stack: 20, role: "villain", position: "BTN" },
        { stack: 7, role: "other", position: "SB" },
        { stack: 25, role: "other", position: "CO" },
      ],
      payouts: [50, 30, 20],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 30,
      heroHand: "AKo",
    },
  },
  {
    title: "サテライトの掟",
    narration:
      "上位がほぼ均等に賞金を得るサテライト。生き残ることそのものが目的です。AKs のような好ハンドでも、一度考え直しましょう。",
    lesson:
      "賞金がほぼ均等なサテライトでは、順位を1つ落とすことの価値がとても大きく、勝っても得られる価値はわずかです。そのため Risk Premium が極端に跳ね上がり、AKs や QQ 級の強いハンドでもフォールドが正解になることが多いのです。『残ること』が全てを支配します。",
    base: {
      scenarioPlayers: [
        { stack: 18, role: "hero", position: "BB" },
        { stack: 20, role: "villain", position: "BTN" },
        { stack: 16, role: "other", position: "SB" },
        { stack: 20, role: "other", position: "CO" },
      ],
      payouts: [33.4, 33.3, 33.3],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 15,
      heroHand: "AKs",
    },
  },
];

let tutorialActive = false;
let tutorialStep = 0;
// このセッション中に「スキップ」した場合のみ true。tutorial-done は立てないので
// 次回訪問時はまた案内カードが出る。
let tutorialSkippedSession = false;

function isTutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function setTutorialActive(v: boolean): void {
  tutorialActive = v;
  document.body.classList.toggle("tutorial-active", v);
}

function tutorialProgressHtml(step: number): string {
  const dots = TUTORIAL_PROBLEMS.map((_, i) => {
    const cls = i === step ? "active" : i < step ? "done" : "";
    return `<span class="tutorial-dot ${cls}"></span>`;
  }).join("");
  return `
    <div class="tutorial-progress">
      <span class="tutorial-progress-label">🎓 導入コース ${step + 1}/${TUTORIAL_PROBLEMS.length}</span>
      <div class="tutorial-dots">${dots}</div>
    </div>
  `;
}

function renderTutorialIntroCard(): void {
  const area = document.getElementById("practice-area");
  if (!area) return;
  area.innerHTML = `
    <div class="tutorial-intro-card">
      <div class="tutorial-intro-title">🎓 まずは導入コース (5問・3分)</div>
      <div class="tutorial-intro-body">ICM の核心を体感しよう</div>
      <button id="tutorial-intro-start-btn" type="button" class="solve-btn">▶ 導入コースを始める</button>
      <button id="tutorial-intro-skip-btn" type="button" class="tutorial-skip-link">スキップして通常練習</button>
    </div>
  `;
}

function renderTutorialNarrationStep(): void {
  const area = document.getElementById("practice-area");
  if (!area) return;
  const def = TUTORIAL_PROBLEMS[tutorialStep]!;
  currentProblem = null;
  area.innerHTML = `
    ${tutorialProgressHtml(tutorialStep)}
    <div class="tutorial-narration-card">
      <div class="tutorial-narration-title">問題 ${tutorialStep + 1}: ${def.title}</div>
      <div class="tutorial-narration-body">${def.narration}</div>
      <button id="tutorial-start-problem-btn" type="button" class="solve-btn">この状況を見る →</button>
    </div>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTutorialProblemStep(): void {
  const def = TUTORIAL_PROBLEMS[tutorialStep]!;
  const p: PracticeProblem = { ...def.base, ...computeDerivedFields(def.base) };
  // チュートリアルは常に call/fold 判定 UI で出題する (RP当てモードが選択中でも固定)
  const savedMode = practiceMode;
  practiceMode = "callfold";
  renderPracticeProblem(p);
  practiceMode = savedMode;
  const area = document.getElementById("practice-area");
  if (area) area.insertAdjacentHTML("afterbegin", tutorialProgressHtml(tutorialStep));
}

function advanceTutorial(): void {
  tutorialStep += 1;
  if (tutorialStep >= TUTORIAL_PROBLEMS.length) {
    finishTutorial();
  } else {
    renderTutorialNarrationStep();
  }
}

function finishTutorial(): void {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
  setTutorialActive(false);
  currentProblem = null;
  const area = document.getElementById("practice-area");
  if (!area) return;
  area.innerHTML = `
    <div class="tutorial-complete-card">
      <div class="tutorial-complete-title">🎉 導入コース修了！</div>
      <div class="tutorial-complete-sub">学んだ5つの教訓</div>
      <ol class="tutorial-complete-list">
        ${TUTORIAL_PROBLEMS.map(
          (d, i) => `<li><strong>${i + 1}. ${d.title}</strong><br>${d.lesson}</li>`,
        ).join("")}
      </ol>
      <button id="tutorial-goto-practice-btn" type="button" class="solve-btn">🎲 通常練習へ</button>
    </div>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startTutorial(): void {
  setTutorialActive(true);
  tutorialStep = 0;
  currentProblem = null;
  renderTutorialNarrationStep();
}

document.getElementById("practice-tutorial-btn")?.addEventListener("click", () => {
  startTutorial();
});

// チュートリアル専用の各種ボタンの委譲ハンドラ (既存の #practice-area クリックハンドラとは別に登録)
document.getElementById("practice-area")?.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest("#tutorial-intro-start-btn")) {
    startTutorial();
    return;
  }
  if (target.closest("#tutorial-intro-skip-btn")) {
    tutorialSkippedSession = true;
    currentProblem = generatePracticeProblem();
    renderPracticeProblem(currentProblem);
    return;
  }
  if (target.closest("#tutorial-start-problem-btn")) {
    renderTutorialProblemStep();
    return;
  }
  if (target.closest("#tutorial-next-btn")) {
    advanceTutorial();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (target.closest("#tutorial-goto-practice-btn")) {
    currentProblem = generatePracticeProblem();
    renderPracticeProblem(currentProblem);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
});

// ===== 🃏 ハンド別判定 (計算結果タブ・必要勝率カード内) =====
// クイック判断 (合成テーブルの概算) は精度と入力の手間が見合わず廃止したが、
// 「13x13グリッドでハンドをタップ→即 GO/NO GO」というインタラクションは実データに
// 基づく判定として価値が高いため、recompute() が出す必要勝率 ($EV) を使って移植する。
const hvBodyEl = $<HTMLDivElement>("hv-body");
const hvEmptyMsgEl = $<HTMLParagraphElement>("hv-empty-msg");
const hvRangePillsEl = $<HTMLDivElement>("hv-range-pills");
const hvBannerEl = $<HTMLDivElement>("hv-banner");
const hvGridEl = $<HTMLDivElement>("hv-grid");
const hvGridCountEl = $<HTMLParagraphElement>("hv-grid-count");

let hvRangePct = 30;
let hvPickedHand: HandNotation | null = null;
/** recompute() が出した必要勝率 ($EV, 0〜1)。🎯/⚔️ 未指定など計算不能時は null。 */
let hvRequiredEquity: number | null = null;

/** hvRequiredEquity と選択中のレンジ/ハンドを元にグリッドとバナーを再描画する。 */
function renderHandVerdict(): void {
  if (hvRequiredEquity === null) {
    hvBodyEl.classList.add("hidden");
    hvEmptyMsgEl.classList.remove("hidden");
    return;
  }
  hvBodyEl.classList.remove("hidden");
  hvEmptyMsgEl.classList.add("hidden");

  const reqEquity = hvRequiredEquity;
  const reqPct = reqEquity * 100;
  const villainRange = topRange(hvRangePct);

  let inRangeCount = 0;
  renderGrid(hvGridEl, (hand) => {
    const eq = equity(hand, villainRange);
    const inRange = eq >= reqEquity;
    if (inRange) inRangeCount++;
    let cls = inRange ? "in-range-hero" : "";
    if (hand === hvPickedHand) cls += " picked";
    return cls;
  });
  const coveragePct = (inRangeCount / 169) * 100;
  hvGridCountEl.textContent = `169中 ${inRangeCount} ハンド (${coveragePct.toFixed(0)}%)`;

  if (hvPickedHand) {
    const eq = equity(hvPickedHand, villainRange) * 100;
    const isCall = eq >= reqPct;
    const margin = eq - reqPct;
    hvBannerEl.classList.remove("hidden");
    hvBannerEl.classList.toggle("hv-banner-call", isCall);
    hvBannerEl.classList.toggle("hv-banner-fold", !isCall);
    const verdict = isCall
      ? `✅ コール (${margin >= 0 ? "+" : ""}${margin.toFixed(1)}%)`
      : `❌ フォールド (${margin.toFixed(1)}%)`;
    hvBannerEl.innerHTML = `<strong>${hvPickedHand}</strong>: equity ${eq.toFixed(1)}% ${isCall ? "≥" : "<"} 必要 ${reqPct.toFixed(1)}% → ${verdict}`;
  } else {
    hvBannerEl.classList.add("hidden");
    hvBannerEl.innerHTML = "";
  }
}

/** recompute() の末尾から呼ばれるフック。必要勝率 (dollarEV) か null (計算不能) を渡す。 */
function updateHandVerdictRequiredEquity(requiredEquity: number | null): void {
  hvRequiredEquity = requiredEquity;
  renderHandVerdict();
}

hvRangePillsEl.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".hv-pill");
  if (!btn || !btn.dataset.range) return;
  hvRangePillsEl.querySelectorAll(".hv-pill").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  hvRangePct = Number(btn.dataset.range);
  renderHandVerdict();
});

hvGridEl.addEventListener("click", (e) => {
  const cell = (e.target as HTMLElement).closest<HTMLDivElement>(".hand-cell");
  if (!cell) return;
  hvPickedHand = cell.title;
  renderHandVerdict();
});

// ===== 初期描画 =====
applyTab(activeTab);
renderPlayers();
recompute();

// 初回訪問時のみオンボーディングを表示（2回目以降は poker-icm-onboarding-done により出さない）
if (!isOnboardingDone()) {
  openOnboardingModal();
}
