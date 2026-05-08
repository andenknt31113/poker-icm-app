import {
  calculateBubbleFactor,
  calculateICM,
  calculateRequiredEquity,
  MAX_PLAYERS,
  solveHUNash,
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

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(obj.players) || !Array.isArray(obj.payouts) || !obj.nash) {
      return null;
    }
    return obj;
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
        sb: sbEl ? Number(sbEl.value) || 0.5 : 0.5,
        bb: bbEl ? Number(bbEl.value) || 1.0 : 1.0,
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
      <input type="number" inputmode="decimal" class="player-stack" min="0" step="0.5" value="${p.stack}" data-id="${p.id}" />
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
  // 3 〜 30 BB のランダム整数（0.5 BB 刻み）。トナメ終盤の幅広いスタックを再現。
  for (const p of players) {
    const raw = 3 + Math.random() * 27;
    p.stack = Math.round(raw * 2) / 2;
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
  ante: number;
  anteMode: "total" | "perPlayer";
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
    sb: 0.5, bb: 1, ante: 1, anteMode: "perPlayer",
  },
  ftBubble: {
    players: [
      { stack: 4, role: "hero", position: "BTN" },
      { stack: 18, role: "villain", position: "SB" },
      { stack: 22, role: "other", position: "BB" },
      { stack: 16, role: "other", position: "CO" },
    ],
    payouts: [50, 30, 20],
    sb: 0.5, bb: 1, ante: 1, anteMode: "perPlayer",
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
    sb: 0.5, bb: 1, ante: 1, anteMode: "perPlayer",
  },
  ft4: {
    players: [
      { stack: 12, role: "hero", position: "BTN" },
      { stack: 18, role: "villain", position: "SB" },
      { stack: 8, role: "other", position: "BB" },
      { stack: 15, role: "other", position: "CO" },
    ],
    payouts: [50, 30, 15, 5],
    sb: 0.5, bb: 1, ante: 1, anteMode: "perPlayer",
  },
  ft3: {
    players: [
      { stack: 18, role: "hero", position: "BTN" },
      { stack: 14, role: "villain", position: "SB" },
      { stack: 20, role: "other", position: "BB" },
    ],
    payouts: [50, 30, 20],
    sb: 0.5, bb: 1, ante: 1, anteMode: "perPlayer",
  },
  hu: {
    players: [
      { stack: 10, role: "hero", position: "BTN" },
      { stack: 10, role: "villain", position: "BB" },
    ],
    payouts: [100],
    sb: 0.5, bb: 1, ante: 0, anteMode: "perPlayer",
  },
  huShort: {
    players: [
      { stack: 5, role: "hero", position: "BTN" },
      { stack: 18, role: "villain", position: "BB" },
    ],
    payouts: [100],
    sb: 0.5, bb: 1, ante: 0, anteMode: "perPlayer",
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
    `input[name="ante-mode"][value="${scenario.anteMode}"]`,
  );
  if (radio) radio.checked = true;
  recompute();
}

document.querySelectorAll<HTMLButtonElement>(".scenario-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.scenario;
    if (id) applyScenario(id);
  });
});

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
        return `<tr>
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

    // 必要勝率
    const callAmount = Number(callInput.value);
    const potIfWin = Number(potWinInput.value);
    const eq = calculateRequiredEquity({
      callAmount,
      potIfWin,
      bubbleFactor: bf,
    });

    eqResult.innerHTML = `
      <div class="row"><span class="label">cEV 必要勝率</span><span class="value">${fmtPct(eq.cEV)}</span></div>
      <div class="row"><span class="label">$EV 必要勝率</span><span class="value big">${fmtPct(eq.dollarEV)}</span></div>
      <div class="row"><span class="label">Risk Premium</span><span class="value">${fmtPct(eq.riskPremium, 2)}</span></div>
    `;

    // レンジ比較
    renderRangeComparison(eq.dollarEV);

    // Hero サマリー
    renderHeroSummary({
      heroIndex,
      villainIndex,
      stacks,
      heroEq: heroIndex >= 0 ? equities[heroIndex] ?? 0 : 0,
      totalPrize,
      bf,
      requiredEq: eq.dollarEV,
      rp: eq.riskPremium,
    });

    // 状態を保存
    saveState();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    icmRows.innerHTML = `<tr><td colspan="4" class="error">${msg}</td></tr>`;
    bfResult.innerHTML = "";
    eqResult.innerHTML = "";
    heroSummaryEl.classList.remove("active");
  }
}

// ===== Hero サマリーカード =====
const heroSummaryEl = $<HTMLDivElement>("hero-summary");

interface HeroSummaryArg {
  heroIndex: number;
  villainIndex: number;
  stacks: number[];
  heroEq: number;
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
  const eqPct = a.totalPrize > 0 ? (a.heroEq / a.totalPrize) * 100 : 0;
  const villainStr =
    a.villainIndex >= 0
      ? `vs ${a.stacks[a.villainIndex]} BB`
      : "相手未指定";

  // BF 色
  let bfClass = "accent";
  if (a.bf < 0.95) bfClass = "good";
  else if (a.bf > 1.15) bfClass = "bad";
  else if (a.bf > 1.05) bfClass = "warn";

  heroSummaryEl.innerHTML = `
    <div class="hero-summary-title">🎯 自分の状況サマリー</div>
    <div class="hero-summary-grid">
      <div class="hero-summary-item">
        <div class="hero-summary-label">スタック</div>
        <div class="hero-summary-value">${heroStack}<span style="font-size:11px;color:var(--muted);">BB</span></div>
      </div>
      <div class="hero-summary-item">
        <div class="hero-summary-label">ポジ</div>
        <div class="hero-summary-value">${heroPos}</div>
      </div>
      <div class="hero-summary-item">
        <div class="hero-summary-label">ICM</div>
        <div class="hero-summary-value accent">${eqPct.toFixed(1)}<span style="font-size:11px;color:var(--muted);">%</span></div>
      </div>
      <div class="hero-summary-item">
        <div class="hero-summary-label">BF (${villainStr})</div>
        <div class="hero-summary-value ${bfClass}">${a.bf.toFixed(2)}</div>
      </div>
      <div class="hero-summary-item">
        <div class="hero-summary-label">必要勝率</div>
        <div class="hero-summary-value">${(a.requiredEq * 100).toFixed(1)}<span style="font-size:11px;color:var(--muted);">%</span></div>
      </div>
      <div class="hero-summary-item">
        <div class="hero-summary-label">RP</div>
        <div class="hero-summary-value warn">+${(a.rp * 100).toFixed(1)}<span style="font-size:11px;color:var(--muted);">%</span></div>
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

  // 1行目: 角空白 + ヘッダ
  cells.push('<div class="bf-hdr-corner"></div>');
  for (let j = 0; j < n; j++) {
    cells.push(
      `<div class="bf-hdr-col">P${j + 1}<span class="stack-info">${stacks[j]}</span></div>`,
    );
  }

  // 2行目以降
  for (let i = 0; i < n; i++) {
    cells.push(
      `<div class="bf-hdr-row">P${i + 1}<span class="stack-info">${stacks[i]}</span></div>`,
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

  renderGrid(villainGrid, (hand) =>
    villainRange.has(hand) ? "in-range-villain" : "",
  );

  let callable = 0;
  let marginal = 0;
  renderGrid(heroGrid, (hand) => {
    const eq = equity(hand, villainRange);
    const margin = eq - requiredEquity;
    if (margin >= 0.03) {
      callable++;
      return "in-range-hero";
    }
    if (margin >= -0.02) {
      marginal++;
      return "marginal";
    }
    return "";
  });

  const totalHands = ALL_169_HANDS.length;
  const callPct = ((callable / totalHands) * 100).toFixed(0);
  callStats.innerHTML = `必要勝率 <strong>${(requiredEquity * 100).toFixed(1)}%</strong> 以上のハンド: <strong>${callable}</strong>個 (Top ${callPct}%) ／ ボーダーライン: ${marginal}個`;

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

// カスタムモードでセルクリック
villainGrid.addEventListener("click", (e) => {
  if (villainRangeMode !== "custom") return;
  const cell = (e.target as HTMLElement).closest<HTMLDivElement>(".hand-cell");
  if (!cell) return;
  const hand = cell.title;
  if (customVillainRange.has(hand)) {
    customVillainRange.delete(hand);
  } else {
    customVillainRange.add(hand);
  }
  saveCustomRange();
  recompute();
});

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
  payoutsArr = values.length > 0 ? values.slice() : [100];
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
  const sb = sbEl ? Number(sbEl.value) || 0 : 0.5;
  const bb = bbEl ? Number(bbEl.value) || 0 : 1.0;
  const totalAnte = anteEl ? Number(anteEl.value) || 0 : 0;
  const dead = sb + bb + totalAnte;

  callInput.value = risk.toFixed(1);
  potWinInput.value = (risk + dead).toFixed(1);

  autofillHint.innerHTML = `✓ コール <strong>${risk}</strong>, 純利得 <strong>${(risk + dead).toFixed(1)}</strong> = リスク ${risk} + 死に金 ${dead.toFixed(1)} (SB ${sb} + BB ${bb} + アンティ計 ${totalAnte.toFixed(1)})`;
  recompute();
});

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

// 起動時に保存された Nash パラメータを復元
if (persistedState?.nash) {
  nashSbInput.value = String(persistedState.nash.sb);
  nashBbInput.value = String(persistedState.nash.bb);
  nashAnteInput.value = String(persistedState.nash.ante);
  const radio = document.querySelector<HTMLInputElement>(
    `input[name="ante-mode"][value="${persistedState.nash.anteMode}"]`,
  );
  if (radio) radio.checked = true;
}

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

      // 描画
      renderGrid(nashSbGrid, (h) =>
        result.sbPushRange.has(h) ? "in-range-villain" : "",
      );
      renderGrid(nashBbGrid, (h) =>
        result.bbCallRange.has(h) ? "in-range-hero" : "",
      );

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

// ===== 初期描画 =====
renderPlayers();
recompute();
