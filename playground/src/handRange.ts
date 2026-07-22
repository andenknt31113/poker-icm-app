import { calculateICM } from "@poker-icm/core";
import {
  ALL_169_HANDS,
  topRange,
  type HandNotation,
} from "./handRanking.js";
import { huEquity } from "./huEquityMatrix.js";
import { comboCountVsHero } from "./rangeEquity.js";
import { equity } from "./equity.js";
import { renderGrid } from "./grid.js";
import { t } from "./i18n.js";
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

  // コンボ重みは hero の実カードを考慮したカードリムーバル込みで数える
  // (hero が A を持てば villain の AX コンボは減る → fold 率が上がる)。
  const pushRange = new Set<HandNotation>();
  const marginal = new Set<HandNotation>();
  for (const heroHand of ALL_169_HANDS) {
    let totalCombos = 0;
    let callCombos = 0;
    let sdSum = 0;
    for (const v of ALL_169_HANDS) {
      const w = comboCountVsHero(heroHand, v);
      totalCombos += w;
      if (villainCallRange.has(v)) {
        callCombos += w;
        const heq = huEquity(heroHand, v);
        sdSum += w * (heq * winEq + (1 - heq) * loseEq);
      }
    }
    const foldRate = totalCombos > 0 ? (totalCombos - callCombos) / totalCombos : 1;
    let evPush = foldRate * stealEq;
    if (callCombos > 0 && totalCombos > 0) {
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

// ボーダー判定バンド幅 (±0.1pt)。equity テーブルは 100万試行/ペア
// (MC 標準誤差 ±0.05pt) に精密化済みで、±0.1pt はその約2σ。
// 「数値上ほぼ完全に五分」のセルだけを黄にする最小幅 (ユーザー指定)。
const MARGINAL_BAND = 0.001;

// タップで数値検分中のハンド (callBack 方向のみ)。
let inspectedHand: HandNotation | null = null;

/** 検分中ハンドの数値詳細 (勝率/必要勝率/差分/判定) を #hand-cell-detail に表示する。 */
function renderInspectDetail(villainRange: Set<HandNotation>, requiredEquity: number): void {
  const el = document.getElementById("hand-cell-detail");
  if (!el) return;
  if (!inspectedHand || direction !== "callBack") {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  const eq = equity(inspectedHand, villainRange);
  const margin = (eq - requiredEquity) * 100;
  const verdict =
    margin >= MARGINAL_BAND * 100
      ? t("hand.inspect.verdict.call")
      : margin > -MARGINAL_BAND * 100
        ? t("hand.inspect.verdict.marginal")
        : t("hand.inspect.verdict.fold");
  el.classList.remove("hidden");
  el.innerHTML = t("hand.inspect.detail.html", {
    hand: inspectedHand,
    eq: (eq * 100).toFixed(1),
    req: (requiredEquity * 100).toFixed(1),
    margin: `${margin >= 0 ? "+" : ""}${margin.toFixed(1)}`,
    verdict,
  });
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
    if (villainGridTitle) villainGridTitle.textContent = t("hand.title.villainPush");
    if (heroGridTitle) heroGridTitle.textContent = t("hand.title.heroCall");
    if (villainRangeLabel) villainRangeLabel.textContent = t("hand.label.villainPush");
  } else {
    if (villainGridTitle) villainGridTitle.textContent = t("hand.title.villainCall");
    if (heroGridTitle) heroGridTitle.textContent = t("hand.title.heroPush");
    if (villainRangeLabel) villainRangeLabel.textContent = t("hand.label.villainCall");
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
    // 相手 push に対し自分 call できるハンド。
    // 判定バンドは必要勝率 ±0.1pt の対称バンド:
    //   margin >= +0.1pt   → 緑 (コール可)
    //   |margin| < 0.1pt   → 黄 (ボーダー: 数値上ほぼ完全に五分)
    //   margin <= -0.1pt   → 無色 (フォールド)
    let callable = 0;
    let marginal = 0;
    renderGrid(heroGrid, (hand) => {
      const eq = equity(hand, villainRange);
      const margin = eq - requiredEquity;
      let cls = "";
      if (margin >= MARGINAL_BAND) {
        callable++;
        cls = heroPushClass;
      } else if (margin > -MARGINAL_BAND) {
        marginal++;
        cls = "marginal";
      }
      if (hand === inspectedHand) cls += " picked";
      return cls;
    });
    const callPct = ((callable / totalHands) * 100).toFixed(0);
    callStats.innerHTML = t("hand.callStats.callBack", {
      req: (requiredEquity * 100).toFixed(1),
      callable,
      callPct,
      marginal,
    });
    renderInspectDetail(villainRange, requiredEquity);
  } else {
    // 逆算: 相手 call (villainRange) に対し自分が push +EV になるハンド
    const result = computePushBackRange(villainRange);
    renderGrid(heroGrid, (hand) => {
      if (result.pushRange.has(hand)) return heroPushClass;
      if (result.marginal.has(hand)) return "marginal";
      return "";
    });
    const pPct = ((result.pushRange.size / totalHands) * 100).toFixed(1);
    callStats.innerHTML = t("hand.callStats.pushBack", {
      villainPct: ((villainRange.size / totalHands) * 100).toFixed(0),
      n: result.pushRange.size,
      pPct,
      marginal: result.marginal.size,
    });
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
  const callerLabel = direction === "callBack" ? t("hand.banner.callerLabel.hero") : t("hand.banner.callerLabel.villain");
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
    banner.innerHTML = t("hand.banner.noBehind.html", { label: callerLabel, pos: callerPos });
  } else {
    const list = behind.map((x) => `${x.pos} (${x.stack}BB)`).join(", ");
    const directionNote = direction === "callBack"
      ? t("hand.banner.note.callBack")
      : t("hand.banner.note.pushBack");
    banner.innerHTML = t("hand.banner.behind.html", {
      label: callerLabel,
      pos: callerPos,
      n: behind.length,
      list,
      note: directionNote,
    });
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

  // hero グリッド (call レンジ側) タップで数値検分。もう一度同じセルで解除。
  heroGrid.addEventListener("click", (e) => {
    if (direction !== "callBack") return;
    const cell = (e.target as HTMLElement).closest<HTMLDivElement>(".hand-cell");
    if (!cell || !cell.title) return;
    inspectedHand = inspectedHand === cell.title ? null : (cell.title as HandNotation);
    onChange();
  });

  // pushRangeInput の変更は再計算トリガー
  pushRangeInput.addEventListener("input", onChange);
}
