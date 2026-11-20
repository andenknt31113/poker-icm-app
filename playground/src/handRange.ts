import { equitiesWithBounty, type Knockout } from "@poker-icm/core";
import { activeBounty } from "./bountyState.js";
import {
  ALL_169_HANDS,
  topRangeByComboPct,
  type HandNotation,
  comboCountOfRange,
  comboPctOfRange,
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
  actionOrderIdx,
} from "./appState.js";
import {
  payoutsInput,
  readBlindParams,
} from "./domRefs.js";
import { STORAGE_KEYS, readJson, writeJson } from "./storage.js";
import { buildPushSpot, pushDepthTier } from "./pushSpot.js";
import { fmt } from "./format.js";
import { solveSpotNash } from "./nashRange.js";
import { loadThreeWayTable } from "./threeWay.js";
import { hapticLight, hapticSelection } from "./haptics.js";

// ===== DOM 参照 (ハンド比較タブ) =====
const pushRangeInput = $<HTMLInputElement>("push-range");
const pushPctLabel = $<HTMLSpanElement>("push-pct");
const villainGrid = $<HTMLDivElement>("grid-villain");
const heroGrid = $<HTMLDivElement>("grid-hero");
const callStats = $<HTMLParagraphElement>("call-stats");
const presetControls = $<HTMLDivElement>("preset-controls");
const customControls = $<HTMLDivElement>("custom-controls");
const customSelected = $<HTMLSpanElement>("custom-selected");
const customClearBtn = $<HTMLButtonElement>("custom-clear");
const customFromPresetBtn = $<HTMLButtonElement>("custom-from-preset");

// レンジ比較の状態
type RangeMode = "preset" | "custom";
let villainRangeMode: RangeMode = "preset";
// 方向: callBack = 相手 push → 自分 call (従来), pushBack = 相手 call → 自分 push (逆算)
export type Direction = "callBack" | "pushBack";
let direction: Direction = "callBack";
const customVillainRange = new Set<HandNotation>();

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/**
 * 保存済みカスタムレンジを読み込む。壊れた値・未設定時は空配列扱い。
 * initHandRange から一度だけ呼ばれ、その時点で customVillainRange は必ず空
 * (この関数以外に集合を初期化する経路が無い) ため、clear() は形式上の防御。
 */
function loadCustomRange(): void {
  const arr = readJson<string[]>(STORAGE_KEYS.customRange, [], isStringArray);
  customVillainRange.clear();
  for (const h of arr) customVillainRange.add(h);
}
function saveCustomRange(): void {
  writeJson(STORAGE_KEYS.customRange, Array.from(customVillainRange));
}

function getCurrentVillainRange(): Set<HandNotation> {
  if (villainRangeMode === "custom") return customVillainRange;
  return topRangeByComboPct(Number(pushRangeInput.value));
}

// 「相手 call → 自分 push (逆算)」モード用: 相手 call レンジを所与に
// hero がどのハンドで push +EV になるかを計算
interface PushHandDetail {
  callRate: number;
  eqVsCall: number;
  diffPoolPct: number;
  status: "push" | "marginal" | "fold";
}

interface PushBackResult {
  pushRange: Set<HandNotation>;
  marginal: Set<HandNotation>;
  details: Map<HandNotation, PushHandDetail>;
}

function computePushBackRange(villainCallRange: Set<HandNotation>): PushBackResult {
  const heroIdx = players.findIndex((p) => p.role === "hero");
  const villainIdx = players.findIndex((p) => p.role === "villain");
  const empty: PushBackResult = { pushRange: new Set(), marginal: new Set(), details: new Map() };
  if (heroIdx < 0 || villainIdx < 0 || heroIdx === villainIdx) return empty;

  const stacks = players.map((p) => p.stack);
  if (stacks[heroIdx]! <= 0 || stacks[villainIdx]! <= 0) return empty;
  const payouts = parseList(payoutsInput.value);
  if (payouts.length === 0) return empty;
  const totalPrize = payouts.slice(0, stacks.length).reduce((a, b) => a + b, 0);

  const { sb, bb, ante: totalAnte } = readBlindParams();
  // 実際のポジションの blind / BB ante / 第三者の dead money で局面を組む (Nash と共通)
  const spot = buildPushSpot(players, heroIdx, villainIdx, sb, bb, totalAnte);
  const baseStacks = spot.stacks;
  const { pusherBlind, callerBlind, deadMoney } = spot;
  if (baseStacks[heroIdx]! - pusherBlind < 0 || baseStacks[villainIdx]! - callerBlind < 0) {
    return empty;
  }
  const matched = Math.min(baseStacks[heroIdx]!, baseStacks[villainIdx]!);

  const bounty = activeBounty();
  function icmAt(hStack: number, vStack: number, knockouts: readonly Knockout[] = []): number {
    const s = baseStacks.slice();
    s[heroIdx] = Math.max(0, hStack);
    s[villainIdx] = Math.max(0, vStack);
    return equitiesWithBounty(s, payouts, bounty, knockouts)[heroIdx]!;
  }

  // hero(=pusher) 視点の各シナリオ ICM
  const foldEq = icmAt(baseStacks[heroIdx]! - pusherBlind, baseStacks[villainIdx]! + pusherBlind + deadMoney);
  const stealEq = icmAt(baseStacks[heroIdx]! + callerBlind + deadMoney, baseStacks[villainIdx]! - callerBlind);
  const winEq = icmAt(baseStacks[heroIdx]! + matched + deadMoney, baseStacks[villainIdx]! - matched, [
    { winner: heroIdx, loser: villainIdx },
  ]);
  const loseEq = icmAt(baseStacks[heroIdx]! - matched, baseStacks[villainIdx]! + matched + deadMoney, [
    { winner: villainIdx, loser: heroIdx },
  ]);

  // コンボ重みは hero の実カードを考慮したカードリムーバル込みで数える
  // (hero が A を持てば villain の AX コンボは減る → fold 率が上がる)。
  const pushRange = new Set<HandNotation>();
  const marginal = new Set<HandNotation>();
  const details = new Map<HandNotation, PushHandDetail>();
  const normBase = foldEq > 0 ? foldEq : Math.max(totalPrize, stealEq, winEq, 1);
  for (const heroHand of ALL_169_HANDS) {
    let totalCombos = 0;
    let callCombos = 0;
    let sdSum = 0;
    let eqSum = 0;
    for (const v of ALL_169_HANDS) {
      const w = comboCountVsHero(heroHand, v);
      totalCombos += w;
      if (villainCallRange.has(v)) {
        callCombos += w;
        const heq = huEquity(heroHand, v);
        eqSum += w * heq;
        sdSum += w * (heq * winEq + (1 - heq) * loseEq);
      }
    }
    const callRate = totalCombos > 0 ? callCombos / totalCombos : 0;
    const eqVsCall = callCombos > 0 ? eqSum / callCombos : 0.5;
    const foldRate = 1 - callRate;
    let evPush = foldRate * stealEq;
    if (callCombos > 0 && totalCombos > 0) {
      evPush += sdSum / totalCombos;
    }
    const margin = evPush - foldEq;
    // foldEq (0 なら賞金規模) の 0.5% を 1 単位として境界判定 (0=境界、+で push、-で fold)
    const norm = margin / normBase;
    let status: PushHandDetail["status"] = "fold";
    if (norm >= 0.005) {
      pushRange.add(heroHand);
      status = "push";
    } else if (norm >= -0.003) {
      marginal.add(heroHand);
      status = "marginal";
    }
    const diffPoolPct = totalPrize > 0 ? (margin / totalPrize) * 100 : 0;
    details.set(heroHand, { callRate, eqVsCall, diffPoolPct, status });
  }
  return { pushRange, marginal, details };
}

// ボーダー判定バンド幅 (±0.1pt)。equity テーブルは 100万試行/ペア
// (MC 標準誤差 ±0.05pt) に精密化済みで、±0.1pt はその約2σ。
// 「数値上ほぼ完全に五分」のセルだけを黄にする最小幅 (ユーザー指定)。
const MARGINAL_BAND = 0.001;

// タップで数値検分中のハンド (callBack / pushBack 両方向で使える)。
let inspectedHand: HandNotation | null = null;
// 直近の「この局面の Nash を相手レンジに入れる」適用時点の局面スナップショット。
// 局面・レンジが変わったら古い案内文を消すために使う。
let nashNoteSpotKey: string | null = null;

function currentNashNoteKey(): string {
  const { sb, bb, ante } = readBlindParams();
  return JSON.stringify([
    players.map(({ stack, role, position, bounty }) => [stack, role, position, bounty ?? 0]),
    payoutsInput.value,
    sb,
    bb,
    ante,
    direction,
    villainRangeMode,
    villainRangeMode === "custom" ? customVillainRange.size : pushRangeInput.value,
  ]);
}

function clearStaleNashNote(): void {
  const note = document.getElementById("nash-range-note");
  if (!note || note.classList.contains("hidden")) return;
  if (nashNoteSpotKey !== currentNashNoteKey()) {
    note.classList.add("hidden");
    note.textContent = "";
    nashNoteSpotKey = null;
  }
}

export function setRangeUnavailable(message: string | null): void {
  const notice = document.getElementById("range-unavailable");
  const content = document.getElementById("range-content");
  if (notice) {
    notice.textContent = message ?? "";
    notice.classList.toggle("hidden", message === null);
  }
  content?.classList.toggle("hidden", message !== null);
  if (message !== null) {
    renderGrid(heroGrid, () => "");
    callStats.textContent = "";
    document.getElementById("hand-cell-detail")?.classList.add("hidden");
  }
}

/** 検分中ハンドの数値詳細を #hand-cell-detail に表示する (callBack / pushBack 両対応)。 */
function renderInspectDetail(
  villainRange: Set<HandNotation>,
  requiredEquity: number,
  pushDetails?: Map<HandNotation, PushHandDetail>,
): void {
  const el = document.getElementById("hand-cell-detail");
  if (!el) return;
  if (!inspectedHand) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  if (direction === "pushBack") {
    const d = pushDetails?.get(inspectedHand);
    if (!d) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    const diffRounded = Math.round(d.diffPoolPct * 100) / 100 || 0;
    const verdict =
      d.status === "push"
        ? t("hand.inspect.verdict.push")
        : d.status === "marginal"
          ? t("hand.inspect.verdict.marginal")
          : t("hand.inspect.verdict.fold");
    el.classList.remove("hidden");
    el.innerHTML = t("hand.inspect.pushDetail.html", {
      hand: inspectedHand,
      callRate: (d.callRate * 100).toFixed(0),
      eq: (d.eqVsCall * 100).toFixed(1),
      diff: `${diffRounded >= 0 ? "+" : ""}${diffRounded.toFixed(2)}`,
      verdict,
    });
    return;
  }
  const eq = equity(inspectedHand, villainRange);
  const rawMargin = (eq - requiredEquity) * 100;
  const margin = Math.round(rawMargin * 10) / 10 || 0;
  const verdict =
    rawMargin >= MARGINAL_BAND * 100
      ? t("hand.inspect.verdict.call")
      : rawMargin > -MARGINAL_BAND * 100
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

/**
 * レンジ比較の要約 (状況サマリーの一行判定用)。
 * direction が callBack なら heroPct は「コール可ハンドのコンボ%」、
 * pushBack なら「push +EV ハンドのコンボ%」。villainPct は相手レンジのコンボ%。
 */
export interface RangeVerdictSummary {
  direction: "callBack" | "pushBack";
  villainPct: number;
  heroPct: number;
  available?: boolean;
}

/**
 * 席順から決まる向き。先に動く側しか先にオールインできないので、
 * 自分が先なら「自分からオールイン」、相手が先なら「相手のオールインを受ける」。
 * どちらかのポジションが未設定なら null (ユーザーが選ぶ)。
 */
export function directionFromPositions(): Direction | null {
  const hero = players.find((p) => p.role === "hero");
  const villain = players.find((p) => p.role === "villain");
  if (!hero || !villain) return null;
  const heroAct = actionOrderIdx(hero.position);
  const villainAct = actionOrderIdx(villain.position);
  if (heroAct < 0 || villainAct < 0 || heroAct === villainAct) return null;
  return heroAct < villainAct ? "pushBack" : "callBack";
}

/** 今の向き。席順で決まるときはそれ、決まらないときは自分で選んだ向き。 */
export function currentDirection(): Direction {
  return directionFromPositions() ?? direction;
}

/** 席順で向きが決まるときはそれに合わせ、ありえない側のボタンを押せなくする。 */
function syncDirectionWithPositions(): void {
  const forced = directionFromPositions();
  if (forced && forced !== direction) {
    direction = forced;
    // 向きが変わったら、前の向きでタップ検分していたハンド選択を解除する
    inspectedHand = null;
  }
  document.querySelectorAll<HTMLButtonElement>(".direction-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.direction === direction);
    btn.disabled = forced !== null && btn.dataset.direction !== forced;
  });
  // 席順で向きが決まっているときは選ぶ余地がないので、切替タブごと隠す
  document.querySelector(".direction-tabs")?.classList.toggle("hidden", forced !== null);
  const hint = document.getElementById("direction-auto-hint");
  if (!hint) return;
  if (!forced) {
    hint.classList.add("hidden");
    return;
  }
  const first = players.find((p) => p.role === (forced === "pushBack" ? "hero" : "villain"));
  hint.textContent = t(forced === "pushBack" ? "hand.direction.autoHero" : "hand.direction.autoVillain", {
    pos: first?.position ?? "",
  });
  hint.classList.remove("hidden");
}

/** 「自分からオールイン」のときだけ、実効スタックの深さに応じた注意を出す。 */
function updatePushDepthWarn(): void {
  const warnEl = document.getElementById("push-depth-warn");
  if (!warnEl) return;
  const hero = players.find((p) => p.role === "hero");
  const villain = players.find((p) => p.role === "villain");
  const tier = direction === "pushBack" && hero && villain
    ? pushDepthTier(Math.min(hero.stack, villain.stack))
    : "ok";
  if (tier === "ok") {
    warnEl.classList.add("hidden");
    return;
  }
  const eff = fmt(Math.min(hero!.stack, villain!.stack), 1);
  warnEl.innerHTML = t(tier === "caution" ? "hand.pushDepth.caution.html" : "hand.pushDepth.out.html", { eff });
  warnEl.classList.remove("hidden");
}

export function renderRangeComparison(requiredEquity: number): RangeVerdictSummary {
  const pushPct = Number(pushRangeInput.value);
  pushPctLabel.textContent = String(pushPct);
  document.querySelectorAll<HTMLButtonElement>("[data-range-pct]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.rangePct) === pushPct);
  });

  syncDirectionWithPositions();
  updatePushDepthWarn();
  const villainRange = getCurrentVillainRange();
  const emptyRange = villainRange.size === 0;
  const rangeNotice = document.getElementById("range-unavailable");
  if (rangeNotice) {
    rangeNotice.textContent = emptyRange ? t("hand.emptyRange") : "";
    rangeNotice.classList.toggle("hidden", !emptyRange);
  }
  heroGrid.classList.toggle("hidden", emptyRange);

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

  // スライダーの横の小さい表 (相手レンジの形がその場で見える)
  const miniGrid = document.getElementById("grid-villain-mini") as HTMLDivElement | null;
  if (miniGrid) renderGrid(miniGrid, (hand) => (villainRange.has(hand) ? villainClass : ""));

  const villainPct = comboPctOfRange(villainRange);
  let verdict: RangeVerdictSummary;
  let pushDetails: Map<HandNotation, PushHandDetail> | undefined;

  if (direction === "callBack") {
    // 相手 push に対し自分 call できるハンド。
    // 判定バンドは必要勝率 ±0.1pt の対称バンド:
    //   margin >= +0.1pt   → 緑 (コール可)
    //   |margin| < 0.1pt   → 黄 (ボーダー: 数値上ほぼ完全に五分)
    //   margin <= -0.1pt   → 無色 (フォールド)
    let callable = 0;
    let marginal = 0;
    const callableHands = new Set<HandNotation>();
    renderGrid(heroGrid, (hand) => {
      const eq = equity(hand, villainRange);
      const margin = eq - requiredEquity;
      let cls = "";
      if (margin >= MARGINAL_BAND) {
        callable++;
        callableHands.add(hand);
        cls = heroPushClass;
      } else if (margin > -MARGINAL_BAND) {
        marginal++;
        cls = "marginal";
      }
      if (hand === inspectedHand) cls += " picked";
      return cls;
    });
    // 割合はコンボベース (ポーカーで「レンジ○%」と言うときの標準)。
    const callComboPct = comboPctOfRange(callableHands);
    callStats.innerHTML = t("hand.callStats.callBack", {
      req: (requiredEquity * 100).toFixed(1),
      callable,
      callCombos: comboCountOfRange(callableHands),
      callPct: callComboPct.toFixed(0),
      marginal,
    });
    verdict = { direction, villainPct, heroPct: callComboPct };
  } else {
    // 逆算: 相手 call (villainRange) に対し自分が push +EV になるハンド
    const result = computePushBackRange(villainRange);
    pushDetails = result.details;
    renderGrid(heroGrid, (hand) => {
      let cls = "";
      if (result.pushRange.has(hand)) cls = heroPushClass;
      else if (result.marginal.has(hand)) cls = "marginal";
      if (hand === inspectedHand) cls += " picked";
      return cls;
    });
    const pushComboPct = comboPctOfRange(result.pushRange);
    callStats.innerHTML = t("hand.callStats.pushBack", {
      villainPct: villainPct.toFixed(0),
      n: result.pushRange.size,
      pushCombos: comboCountOfRange(result.pushRange),
      pPct: pushComboPct.toFixed(1),
      marginal: result.marginal.size,
    });
    verdict = { direction, villainPct, heroPct: pushComboPct };
  }
  if (emptyRange) {
    callStats.textContent = "";
    document.getElementById("hand-cell-detail")?.classList.add("hidden");
  } else {
    renderInspectDetail(villainRange, requiredEquity, pushDetails);
  }
  clearStaleNashNote();

  // カスタムモードのカウント表示
  if (villainRangeMode === "custom") {
    const c = customVillainRange.size;
    customSelected.innerHTML = t("hand.custom.selected.html", {
      n: c,
      combos: comboCountOfRange(customVillainRange),
      pct: comboPctOfRange(customVillainRange).toFixed(0),
    });
  }

  return { ...verdict, available: !emptyRange };
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
  // 自分より後に行動する、相手以外のプレイヤー = 割り込んでくる可能性がある人。
  //   - 相手のオールインを受ける: 自分 (caller) の後ろの人
  //   - 自分からオールイン: 自分 (pusher) の後ろ全員。相手との間 (例: BTN→BB の SB) も含む
  // どちらの向きも基準は自分の位置になる。
  const heroPos = players[heroIndex]?.position;
  const callerLabel = t("hand.banner.callerLabel.hero");
  if (!heroPos) {
    banner.classList.add("hidden");
    return;
  }
  const heroAct = actionOrderIdx(heroPos);
  const behind = players
    .filter((p, i) => i !== heroIndex && i !== villainIndex && p.stack > 0)
    .map((p) => ({ pos: p.position, act: actionOrderIdx(p.position), stack: p.stack }))
    .filter((x) => x.act > heroAct && x.act >= 0)
    .sort((a, b) => a.act - b.act);
  if (behind.length === 0 && heroPos === "BB") {
    banner.classList.add("hidden");
    return;
  }
  const callerPos = heroPos;
  banner.classList.remove("hidden");
  banner.classList.toggle("ok-box", behind.length === 0);
  banner.classList.toggle("warn-box", behind.length > 0);
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
/** いまの「上位 X%」のレンジをカスタム編集の中身にして保存する。 */
function seedCustomRangeFromPreset(): void {
  customVillainRange.clear();
  for (const h of topRangeByComboPct(Number(pushRangeInput.value))) customVillainRange.add(h);
  saveCustomRange();
}

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
      // カスタム編集を空のまま開くと「レンジが空です」の注意だけが出て、何をすればいいか分かりにくい。
      // まだ何も選んでいなければ、いま見ていた上位レンジを出発点として入れておく。
      if (villainRangeMode === "custom" && customVillainRange.size === 0) seedCustomRangeFromPreset();
      const rangeDetails = document.getElementById("villain-range-details") as HTMLDetailsElement | null;
      if (rangeDetails) rangeDetails.open = villainRangeMode === "custom";
      document.getElementById("sec-hand")?.classList.toggle("custom-range-mode", villainRangeMode === "custom");
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
      const next = btn.dataset.direction as Direction;
      if (next !== direction) {
        inspectedHand = null;
        hapticSelection();
      }
      direction = next;
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
  let dragRafId: number | null = null;

  function flushDragChange(): void {
    dragRafId = null;
    saveCustomRange();
    onChange();
  }

  function applyDragAction(hand: string, immediate: boolean): void {
    if (dragVisited.has(hand)) return;
    dragVisited.add(hand);
    if (dragMode === "add") {
      customVillainRange.add(hand);
    } else if (dragMode === "remove") {
      customVillainRange.delete(hand);
    }
    if (immediate) {
      if (dragRafId !== null) {
        cancelAnimationFrame(dragRafId);
        dragRafId = null;
      }
      saveCustomRange();
      onChange();
    } else if (dragRafId === null) {
      // 連続ドラッグ中はフレーム単位に束ねて、毎セルのフル再計算によるカクつきを防ぐ
      dragRafId = requestAnimationFrame(flushDragChange);
    }
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
    applyDragAction(hand, true);
    // ポインターキャプチャしてドラッグ中スクロール抑制
    villainGrid.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  villainGrid.addEventListener("pointermove", (e) => {
    if (villainRangeMode !== "custom" || dragMode === null) return;
    const hand = getCellHandFromPoint(e.clientX, e.clientY);
    if (hand) applyDragAction(hand, false);
  });

  const endDrag = (e: PointerEvent): void => {
    if (dragMode !== null) {
      dragMode = null;
      dragVisited.clear();
      if (dragRafId !== null) {
        cancelAnimationFrame(dragRafId);
        flushDragChange();
      }
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
    seedCustomRangeFromPreset();
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

  // hero グリッド タップで数値検分 (callBack / pushBack 両対応)。もう一度同じセルで解除。
  heroGrid.addEventListener("click", (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLDivElement>(".hand-cell");
    if (!cell || !cell.title) return;
    hapticSelection();
    inspectedHand = inspectedHand === cell.title ? null : (cell.title as HandNotation);
    onChange();
    if (inspectedHand) document.getElementById("hand-cell-detail")?.scrollIntoView({ block: "center", behavior: "smooth" });
  });


  // pushRangeInput の変更は再計算トリガー
  pushRangeInput.addEventListener("input", onChange);

  // この局面の Nash を相手レンジ (カスタム) に入れる。上位 X% は対ランダム勝率順で、
  // 小さいペアやスーテッドコネクターが入りにくいため、実際の押し引きに近い形を1タップで置けるようにする。
  const useNashBtn = document.getElementById("use-nash-range") as HTMLButtonElement | null;
  useNashBtn?.addEventListener("click", async () => {
    if (useNashBtn.disabled) return;
    useNashBtn.disabled = true;
    const note = document.getElementById("nash-range-note");
    try {
      // オーバーコールまで入れた Nash タブと同じ結果にするため、3 人の勝率表を先に読む (失敗しても続ける)
      await loadThreeWayTable();
      const heroIdx = players.findIndex((p) => p.role === "hero");
      const villainIdx = players.findIndex((p) => p.role === "villain");
      const villainPushes = direction === "callBack";
      const pusherIdx = villainPushes ? villainIdx : heroIdx;
      const callerIdx = villainPushes ? heroIdx : villainIdx;
      const payouts = parseList(payoutsInput.value);
      const { sb, bb, ante } = readBlindParams();
      let range: Set<HandNotation> | null = null;
      let includedOthers = 0;
      if (pusherIdx >= 0 && callerIdx >= 0 && pusherIdx !== callerIdx && payouts.length > 0) {
        try {
          const solved = solveSpotNash(players, payouts, pusherIdx, callerIdx, sb, bb, ante, activeBounty());
          range = new Set(villainPushes ? solved.pushRange : solved.callRange);
          includedOthers = solved.others.length;
        } catch {
          range = null;
        }
      }
      if (note) note.classList.remove("hidden");
      if (!range) {
        nashNoteSpotKey = null;
        if (note) note.textContent = t("hand.nashRange.failed");
        return;
      }
      customVillainRange.clear();
      for (const hand of range) customVillainRange.add(hand);
      saveCustomRange();
      hapticLight();
      if (note) {
        note.textContent =
          t(villainPushes ? "hand.nashRange.donePush" : "hand.nashRange.doneCall", {
            pct: comboPctOfRange(range).toFixed(0),
          }) + (includedOthers > 0 ? " " + t("hand.nashRange.multiway", { n: includedOthers }) : "");
      }
      const customTab = document.querySelector<HTMLButtonElement>('.mode-tab[data-mode="custom"]');
      if (villainRangeMode !== "custom" && customTab) {
        // customTab.click() 内の onChange() より前に nashNoteSpotKey を合わせておく
        villainRangeMode = "custom";
        nashNoteSpotKey = currentNashNoteKey();
        villainRangeMode = "preset";
        customTab.click();
      } else {
        nashNoteSpotKey = currentNashNoteKey();
        onChange();
      }
    } finally {
      useNashBtn.disabled = false;
    }
  });

  // 小さい表をタップ → 大きい表をその場で開く
  document.getElementById("villain-range-thumb")?.addEventListener("click", () => {
    const details = document.getElementById("villain-range-details") as HTMLDetailsElement | null;
    if (!details) return;
    details.open = !details.open;
    if (details.open) details.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  // レンジの目安ボタン (スライダーはスマホで狙った値に合わせにくい)
  document.querySelectorAll<HTMLButtonElement>("[data-range-pct]").forEach((button) => {
    button.addEventListener("click", () => {
      hapticSelection();
      pushRangeInput.value = button.dataset.rangePct ?? pushRangeInput.value;
      onChange();
    });
  });
}
