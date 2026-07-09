import { calculateICM } from "@poker-icm/core";
import {
  ALL_169_HANDS,
  topRange,
  type HandNotation,
} from "./handRanking.js";
import { huEquity } from "./huEquityMatrix.js";
import { equity } from "./equity.js";
import { renderGrid } from "./grid.js";
import { $ } from "./dom.js";
import {
  players,
  parseList,
  DEFAULT_SB,
  DEFAULT_BB,
  actionOrderIdx,
} from "./appState.js";
import { payoutsInput, nashSbInput, nashBbInput, nashAnteInput } from "./domRefs.js";

// ===== DOM 参照 (ハンド比較タブ) =====
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

export function renderRangeComparison(requiredEquity: number): void {
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

// ハンドレンジ比較セクションの hero ポジション バナー
// HU all-in 想定 = 「最終 actor = caller」のときのみ厳密に有効:
//   - call モード: hero が caller → hero=BB が cleanest
//   - push モード: villain が caller → villain=BB が cleanest (hero は pusher)
// 「caller の後ろに残るプレイヤー」がいると over-call リスクで概算止まり。
export function updateHandPositionBanner(heroIndex: number): void {
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

// ===== 初期化 (イベント配線) =====
// onChange: レンジ/方向/カスタムレンジが変わるたびに呼ぶ再計算コールバック (calculator.recompute)。
// calculator.ts と handRange.ts の循環 import を避けるため、呼び出し元 (main.ts) から注入する。
export function initHandRange(onChange: () => void): void {
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
      onChange();
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
      onChange();
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
    onChange();
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
    onChange();
  });

  customFromPresetBtn.addEventListener("click", () => {
    customVillainRange.clear();
    for (const h of topRange(Number(pushRangeInput.value))) {
      customVillainRange.add(h);
    }
    saveCustomRange();
    onChange();
  });

  loadCustomRange();

  // ===== カスタムレンジ「全選択」 =====
  const customAllBtn = document.getElementById("custom-all") as HTMLButtonElement | null;
  if (customAllBtn) {
    customAllBtn.addEventListener("click", () => {
      customVillainRange.clear();
      for (const h of ALL_169_HANDS) customVillainRange.add(h);
      saveCustomRange();
      onChange();
    });
  }

  // pushRangeInput の変更は再計算トリガー
  pushRangeInput.addEventListener("input", onChange);
}
