// ===== セットアップタブ: シナリオ (組み込みプリセット + ユーザー定義) =====
// 「9人卓ファイナル」「バブル」等のワンタップ プリセットと、現在の卓状況を
// 名前を付けて保存/復元する機能。どちらもプレイヤー配列・ペイ構造・Nash
// パラメータをまとめて差し替える。
import { t as tr } from "./i18n.js";
import { isPro } from "./entitlement.js";
import { openPaywall } from "./paywall.js";
import { recompute, setCallManualOverride } from "./calculator.js";
import {
  players,
  type Role,
  type Position,
  DEFAULT_SB,
  DEFAULT_BB,
  DEFAULT_ANTE,
} from "./appState.js";
import {
  payoutsArr,
  nashSbInput,
  nashBbInput,
  nashAnteInput,
} from "./domRefs.js";
import { renderPlayers, replacePlayers } from "./setupPlayers.js";
import { setPayouts } from "./setupPayouts.js";
import { escapeHtml } from "./html.js";
import { STORAGE_KEYS, readJson, writeJson } from "./storage.js";

/** 保存するシナリオ名の最大長。 */
const USER_SCENARIO_NAME_MAX = 30;

// ===== シナリオプリセット =====

interface Scenario {
  players: { stack: number; role: Role; position: Position }[];
  payouts: number[];
  sb: number;
  bb: number;
  ante: number; // テーブル合計
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

/**
 * シナリオの Nash パラメータ (SB/BB/アンティ/アンティモード) を入力欄へ反映する。
 * 組み込みプリセット適用とユーザー定義シナリオ復元の両方から使う共通処理。
 */
function applyNashParams(s: Scenario): void {
  nashSbInput.value = String(s.sb);
  nashBbInput.value = String(s.bb);
  nashAnteInput.value = String(s.ante);
}

function applyScenario(scenarioId: string): void {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return;
  // プレイヤーリスト置換
  replacePlayers(scenario.players);
  renderPlayers();
  // ペイアウト
  setPayouts(scenario.payouts);
  // Nash パラメータ
  applyNashParams(scenario);
  // コール額/純利得を自動追従モードに戻す
  setCallManualOverride(false);
  recompute();
}

// ===== ユーザー定義シナリオ (保存・呼び出し・削除) =====
interface UserScenario {
  name: string;
  s: Scenario;
}

/** 保存名だけ検証する緩い判定 (中身の Scenario は読み出し側の ?? で防御)。 */
function isUserScenario(x: unknown): x is UserScenario {
  return typeof x === "object" && x !== null && typeof (x as UserScenario).name === "string";
}

function loadUserScenarios(): UserScenario[] {
  const arr = readJson<unknown[]>(STORAGE_KEYS.userScenarios, [], Array.isArray);
  return arr.filter(isUserScenario);
}

function saveUserScenarios(list: UserScenario[]): void {
  writeJson(STORAGE_KEYS.userScenarios, list);
}

function captureCurrentScenario(): Scenario {
  const sbV = Number(nashSbInput.value) || DEFAULT_SB;
  const bbV = Number(nashBbInput.value) || DEFAULT_BB;
  const anteV = Number(nashAnteInput.value) || 0;
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
  };
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
        <button type="button" class="scenario-btn user-load">${escapeHtml(s.name)}</button>
        <button type="button" class="user-del" title="${tr("setup.common.delete")}">✕</button>
      </span>
    `,
    )
    .join("");
}

/** シナリオセクション (プリセットピル・保存/復元) の配線と初期描画。initSetup から一度だけ呼ぶ。 */
export function initScenariosUI(): void {
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
    list.push({ name: name.slice(0, USER_SCENARIO_NAME_MAX), s: captureCurrentScenario() });
    saveUserScenarios(list);
    renderUserScenarios();
  });

  document.getElementById("user-scenarios")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const wrap = target.closest<HTMLSpanElement>(".user-scenario-item");
    if (!wrap) return;
    const idx = Number(wrap.dataset.i);
    const list = loadUserScenarios();
    if (target.classList.contains("user-del")) {
      if (window.confirm(tr("setup.confirm.deleteScenario"))) {
        list.splice(idx, 1);
        saveUserScenarios(list);
        renderUserScenarios();
      }
      return;
    }
    if (target.classList.contains("user-load")) {
      const s = list[idx]?.s;
      if (s) {
        replacePlayers(s.players);
        renderPlayers();
        setPayouts(s.payouts);
        applyNashParams(s);
        setCallManualOverride(false);
        recompute();
      }
    }
  });

  renderUserScenarios();
}
