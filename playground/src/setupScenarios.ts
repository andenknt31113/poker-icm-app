// ===== セットアップタブ: シナリオ (組み込みプリセット + ユーザー定義) =====
// 「9人卓ファイナル」「バブル」等のワンタップ プリセットと、現在の卓状況を
// 名前を付けて保存/復元する機能。どちらもプレイヤー配列・ペイ構造・Nash
// パラメータをまとめて差し替える。
import { t as tr } from "./i18n.js";
import { checkpointSetup } from "./setupUndo.js";
import { isPro } from "./entitlement.js";
import { openPaywall } from "./paywall.js";
import { recompute, setCallManualOverride } from "./calculator.js";
import {
  players,
  sanitizePlayersArray,
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
  readBlindParams,
} from "./domRefs.js";
import { renderPlayers, replacePlayers } from "./setupPlayers.js";
import { setPayouts } from "./setupPayouts.js";
import { escapeHtml } from "./html.js";
import { openConfirmModal, openPromptModal } from "./dialogModal.js";
import { hapticLight, hapticSuccess } from "./haptics.js";
import {
  FREE_BOUNTY_EXAMPLES,
  getBountyMode,
  setBountyMode,
  isBountyMode,
  sanitizeBounty,
} from "./bountyState.js";
import { STORAGE_KEYS, readJson, writeJson } from "./storage.js";

/** 保存するシナリオ名の最大長。 */
const USER_SCENARIO_NAME_MAX = 30;

// ===== シナリオプリセット =====

interface Scenario {
  players: { stack: number; role: Role; position: Position; bounty?: number }[];
  /** バウンティの設定 (off / ko / pko)。例題と古い保存データには無い (= off)。 */
  bountyMode?: string;
  payouts: number[];
  sb: number;
  bb: number;
  ante: number; // テーブル合計
}

// 並びは 自分 → 相手 → 残りを行動順 (UTG → … → BTN → SB)。
// 各プリセットは call 分析として成立する構成 (hero=BB、villain はそれより先に行動するポジション)
// にしてある。これは #position-warn (ポジション逆転警告) を出さないための配置で、
// スタック分布・人数・ペイの「意味」自体は変えていない (hero/villain のスタック・役割は
// 従来どおりで、席の並び=position だけを付け替えてある)。
const SCENARIOS: Record<string, Scenario> = {
  ft9: {
    players: [
      { stack: 35, role: "hero", position: "BB" },
      { stack: 28, role: "villain", position: "SB" },
      { stack: 18, role: "other", position: "UTG" },
      { stack: 15, role: "other", position: "UTG+1" },
      { stack: 12, role: "other", position: "MP" },
      { stack: 10, role: "other", position: "LJ" },
      { stack: 7, role: "other", position: "HJ" },
      { stack: 5, role: "other", position: "CO" },
      { stack: 22, role: "other", position: "BTN" },
    ],
    payouts: [40, 25, 15, 10, 5, 3, 2, 1, 0.5],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ftBubble: {
    players: [
      { stack: 4, role: "hero", position: "BB" },
      { stack: 18, role: "villain", position: "SB" },
      { stack: 16, role: "other", position: "CO" },
      { stack: 22, role: "other", position: "BTN" },
    ],
    payouts: [50, 30, 20],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ft6: {
    players: [
      { stack: 18, role: "hero", position: "BB" },
      { stack: 12, role: "villain", position: "SB" },
      { stack: 8, role: "other", position: "UTG" },
      { stack: 14, role: "other", position: "HJ" },
      { stack: 10, role: "other", position: "CO" },
      { stack: 22, role: "other", position: "BTN" },
    ],
    payouts: [45, 25, 15, 8, 4, 3],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ft4: {
    players: [
      { stack: 12, role: "hero", position: "BB" },
      { stack: 18, role: "villain", position: "SB" },
      { stack: 15, role: "other", position: "CO" },
      { stack: 8, role: "other", position: "BTN" },
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
  // 無料でも体験できる組み込み PKO 例題 (6人FT / 4人バブル)。
  // 定義の単一情報源は bountyState.FREE_BOUNTY_EXAMPLES。
  ft6Pko: {
    players: FREE_BOUNTY_EXAMPLES.ft6Pko.players.map((p) => ({ ...p })),
    bountyMode: FREE_BOUNTY_EXAMPLES.ft6Pko.bountyMode,
    payouts: [...FREE_BOUNTY_EXAMPLES.ft6Pko.payouts],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  ft4Pko: {
    players: FREE_BOUNTY_EXAMPLES.ft4Pko.players.map((p) => ({ ...p })),
    bountyMode: FREE_BOUNTY_EXAMPLES.ft4Pko.bountyMode,
    payouts: [...FREE_BOUNTY_EXAMPLES.ft4Pko.payouts],
    sb: DEFAULT_SB, bb: DEFAULT_BB, ante: DEFAULT_ANTE,
  },
  // サテライト: 5 人卓、上位 3 人が同額入賞 (4 位以下は 0)。極端な ICM バブル圧。
  // hero は中堅スタック、villain は短いほうのバブル候補 (早いポジションから shove)。
  satellite3: {
    players: [
      { stack: 22, role: "hero", position: "BB" },
      { stack: 5, role: "villain", position: "UTG" },
      { stack: 15, role: "other", position: "CO" },
      { stack: 28, role: "other", position: "BTN" },
      { stack: 18, role: "other", position: "SB" },
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
  const sb = typeof s.sb === "number" && Number.isFinite(s.sb) && s.sb > 0 ? s.sb : DEFAULT_SB;
  const ante = typeof s.ante === "number" && Number.isFinite(s.ante) && s.ante >= 0 ? s.ante : DEFAULT_ANTE;
  nashSbInput.value = String(sb);
  // BB はスタックの単位なので常に 1 (古い保存シナリオに別の値があっても使わない)
  nashBbInput.value = String(DEFAULT_BB);
  nashAnteInput.value = String(ante);
}

function applyScenario(scenarioId: string): void {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return;
  checkpointSetup();
  // 例題に指定されたバウンティ形式を反映 (通常の例題は off に戻す)
  setBountyMode(isBountyMode(scenario.bountyMode) ? scenario.bountyMode : "off");
  // プレイヤーリスト置換
  replacePlayers(scenario.players);
  renderPlayers();
  // ペイアウト (次の applyNashParams のあとに 1 回だけ recompute する)
  setPayouts(scenario.payouts, false);
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

/** 保存名と中身の最低限の形を検証する (壊れた localStorage で落ちないようにする)。 */
function isUserScenario(x: unknown): x is UserScenario {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Partial<UserScenario>;
  return (
    typeof o.name === "string" &&
    typeof o.s === "object" &&
    o.s !== null &&
    Array.isArray(o.s.players) &&
    Array.isArray(o.s.payouts)
  );
}

function loadUserScenarios(): UserScenario[] {
  const arr = readJson<unknown[]>(STORAGE_KEYS.userScenarios, [], Array.isArray);
  return arr.filter(isUserScenario);
}

function saveUserScenarios(list: UserScenario[]): void {
  writeJson(STORAGE_KEYS.userScenarios, list);
}

function captureCurrentScenario(): Scenario {
  const { sb, bb, ante } = readBlindParams();
  return {
    players: players.map((p) => ({
      stack: p.stack,
      role: p.role,
      position: p.position,
      bounty: sanitizeBounty(p.bounty),
    })),
    bountyMode: getBountyMode(),
    payouts: payoutsArr.slice(),
    sb,
    bb,
    ante,
  };
}

function renderUserScenarios(): void {
  const container = document.getElementById("user-scenarios");
  if (!container) return;
  const list = loadUserScenarios();
  if (list.length === 0) {
    container.innerHTML = `<span class="hint saved-empty-hint">${tr("setup.userScenarios.empty")}</span>`;
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
      if (id) {
        hapticLight();
        applyScenario(id);
      }
    });
  });

  const saveScenarioBtn = document.getElementById("save-scenario-btn") as HTMLButtonElement | null;
  saveScenarioBtn?.classList.toggle("locked-pro", !isPro());
  saveScenarioBtn?.addEventListener("click", () => {
    if (!isPro()) return openPaywall("save");
    void openPromptModal({
      title: tr("setup.prompt.scenarioName"),
      placeholder: tr("setup.prompt.scenarioPlaceholder"),
      maxLength: USER_SCENARIO_NAME_MAX,
    }).then((name) => {
      if (!name) return;
      const list = loadUserScenarios();
      list.push({ name: name.slice(0, USER_SCENARIO_NAME_MAX), s: captureCurrentScenario() });
      saveUserScenarios(list);
      renderUserScenarios();
      hapticSuccess();
    });
  });

  document.getElementById("user-scenarios")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const wrap = target.closest<HTMLSpanElement>(".user-scenario-item");
    if (!wrap) return;
    const idx = Number(wrap.dataset.i);
    if (target.classList.contains("user-del")) {
      void openConfirmModal({
        title: tr("setup.confirm.deleteScenarioTitle"),
        message: tr("setup.confirm.deleteScenario"),
        confirmLabel: tr("dialog.delete"),
        danger: true,
      }).then((confirmed) => {
        if (!confirmed) return;
        const list = loadUserScenarios();
        if (idx < 0 || idx >= list.length) return;
        list.splice(idx, 1);
        saveUserScenarios(list);
        renderUserScenarios();
        hapticLight();
      });
      return;
    }
    const list = loadUserScenarios();
    if (target.classList.contains("user-load")) {
      const s = list[idx]?.s;
      const sanitizedPlayers = s ? sanitizePlayersArray(s.players) : [];
      if (s && sanitizedPlayers.length > 0) {
        hapticLight();
        checkpointSetup();
        setBountyMode(isBountyMode(s.bountyMode) ? s.bountyMode : "off");
        replacePlayers(sanitizedPlayers);
        renderPlayers();
        setPayouts(s.payouts, false);
        applyNashParams(s);
        setCallManualOverride(false);
        recompute();
      }
    }
  });

  renderUserScenarios();
}
