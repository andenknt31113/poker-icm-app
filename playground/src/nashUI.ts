import { type HandNotation,
  comboCountOfRange,
  comboPctOfRange,
} from "./handRanking.js";
import { hasHUMatrix } from "./huEquityMatrix.js";
import { renderGrid } from "./grid.js";
import { pushDepthTier, type PushDepthTier } from "./pushSpot.js";
import { solveSpotNash } from "./nashRange.js";
import { ensureNashTable } from "./nashTableUI.js";
import { fmt } from "./format.js";
import { t } from "./i18n.js";
import { $ } from "./dom.js";
import {
  players,
  parseList,
  persistedState,
  actionOrderIdx,
  DEFAULT_BB,
} from "./appState.js";
import {
  payoutsInput,
  nashSbInput,
  nashBbInput,
  nashAnteInput,
  saveState,
} from "./domRefs.js";

const nashSolveBtn = $<HTMLButtonElement>("nash-solve");
const nashStatus = $<HTMLParagraphElement>("nash-status");
const nashSbStats = $<HTMLParagraphElement>("nash-sb-stats");
const nashBbStats = $<HTMLParagraphElement>("nash-bb-stats");
const nashSbGrid = $<HTMLDivElement>("nash-sb-grid");
const nashBbGrid = $<HTMLDivElement>("nash-bb-grid");
const nashDepthNote = $<HTMLDivElement>("nash-depth-note");
const nashResults = $<HTMLDivElement>("nash-results");

// mixed strategy の濃淡しきい値。
// pure (>= 0.5) は solid、mixed (0.05..0.5) は marginal 扱い、
// それ未満は無色 (ほぼ打たないハンド)。
const NASH_FREQ_SOLID = 0.5;
const NASH_FREQ_MARGINAL = 0.05;

// solveHUNash の収束条件。反復上限に達しても収束しなければ「未収束」と表示する。
const NASH_MAX_ITERATIONS = 500;
const NASH_CONVERGENCE_TOLERANCE = 0.001;
let resultInputKey: string | null = null;

/**
 * Nash で押す側・受ける側。先に動く側しか先にオールインできないので、
 * 席順が分かれば先に動く方が押す。ポジション未設定なら自分が押す側。
 */
export function nashRoles(heroIndex: number, villainIndex: number): { pusherIndex: number; callerIndex: number } {
  const heroAct = actionOrderIdx(players[heroIndex]?.position ?? "");
  const villainAct = actionOrderIdx(players[villainIndex]?.position ?? "");
  const villainFirst = heroAct >= 0 && villainAct >= 0 && villainAct < heroAct;
  return villainFirst
    ? { pusherIndex: villainIndex, callerIndex: heroIndex }
    : { pusherIndex: heroIndex, callerIndex: villainIndex };
}

/** 結果グリッドの見出し (押すのが自分か相手か)。 */
function renderNashTitles(heroPushes: boolean): void {
  const pushTitle = document.getElementById("nash-push-title");
  const callTitle = document.getElementById("nash-call-title");
  if (pushTitle) pushTitle.textContent = t(heroPushes ? "nash.title.youPush" : "nash.title.theyPush");
  if (callTitle) callTitle.textContent = t(heroPushes ? "nash.title.theyCall" : "nash.title.youCall");
}

export function renderNashContext(): void {
  const context = document.getElementById("nash-context");
  if (!context) return;
  context.replaceChildren();
  const heroIndex = players.findIndex((p) => p.role === "hero");
  const villainIndex = players.findIndex((p) => p.role === "villain");
  const heroPushes = heroIndex < 0 || villainIndex < 0 || nashRoles(heroIndex, villainIndex).pusherIndex === heroIndex;
  renderNashTitles(heroPushes);
  const conditions = document.createElement("p");
  conditions.textContent = `${t("nash.prizes")}: ${payoutsInput.value} · SB ${nashSbInput.value} / BB ${nashBbInput.value} · ${t("nash.ante.label")} ${nashAnteInput.value}`;
  const seats = document.createElement("div");
  seats.className = "nash-context-seats";
  const others = document.createElement("details");
  const othersTitle = document.createElement("summary");
  othersTitle.textContent = t("nash.details");
  others.appendChild(othersTitle);
  others.appendChild(conditions);
  players.forEach((player, index) => {
    const seat = document.createElement("span");
    seat.className = `nash-seat ${player.role}`;
    const role = player.role === "hero"
      ? t(heroPushes ? "nash.youPush" : "nash.youCall")
      : player.role === "villain"
        ? t(heroPushes ? "nash.theyCall" : "nash.theyPush")
        : t("seat.number", { n: index + 1 });
    seat.textContent = `${role} · ${player.position || "—"} · ${player.stack} BB`;
    if (player.role === "other") others.appendChild(seat);
    else seats.appendChild(seat);
  });
  context.appendChild(seats);
  context.appendChild(others);
}

export function ensureNashCalculated(): void {
  // 一覧表 (nashTableUI) がある画面では、そちらが全員ぶんを計算する。
  // ここから下は、自分 / 相手の 2 人ぶんだけを出す旧表示用。
  if (document.getElementById("nash-table")) {
    ensureNashTable();
    return;
  }
  if (document.body.dataset.activeTab !== "analyze" || document.body.dataset.analysisView !== "nash") return;
  renderNashContext();
  if (resultInputKey === currentInputKey() || nashSolveBtn.disabled || !hasHUMatrix()) return;
  runNash();
}

function currentInputKey(): string {
  return JSON.stringify([
    players.map(({ stack, role, position }) => [stack, role, position]),
    payoutsInput.value, nashSbInput.value, nashBbInput.value, nashAnteInput.value,
  ]);
}

function clearNashResult(): void {
  resultInputKey = null;
  renderGrid(nashSbGrid, () => "");
  renderGrid(nashBbGrid, () => "");
  nashSbStats.textContent = "";
  nashBbStats.textContent = "";
  nashDepthNote.classList.add("hidden");
  nashResults.classList.remove("hidden");
  const othersEl = document.getElementById("nash-others");
  if (othersEl) {
    othersEl.textContent = "";
    othersEl.classList.add("hidden");
  }
}

/** 実効スタックの深さに応じた注意表示と、範囲外のときの結果の折りたたみ。 */
function renderNashDepth(tier: PushDepthTier, effStack: number): void {
  if (tier === "ok") {
    nashDepthNote.classList.add("hidden");
    nashResults.classList.remove("hidden");
    return;
  }
  const eff = fmt(effStack, 1);
  nashDepthNote.replaceChildren();
  const text = document.createElement("p");
  text.innerHTML = t(tier === "caution" ? "nash.depthNote.html" : "nash.depthOut.html", { eff });
  nashDepthNote.appendChild(text);
  nashDepthNote.classList.remove("hidden");
  if (tier === "caution") {
    nashResults.classList.remove("hidden");
    return;
  }
  nashResults.classList.add("hidden");
  const reveal = document.createElement("button");
  reveal.type = "button";
  reveal.className = "workspace-secondary";
  reveal.id = "nash-show-deep";
  reveal.textContent = t("nash.depthOut.reveal");
  reveal.addEventListener("click", () => {
    nashResults.classList.remove("hidden");
    reveal.remove();
  });
  nashDepthNote.appendChild(reveal);
}

export function invalidateChangedNash(): void {
  if (resultInputKey === null || resultInputKey === currentInputKey()) return;
  clearNashResult();
  nashStatus.textContent = t("nash.inputsChanged");
}

// Nash の frequency マップで描画。既存のレンジ表示と同じ class / 同じ 13x13
// マークアップを使うため、セル生成は grid.renderGrid に委ね、
// frequency 依存の class 判定と title (long-press tooltip) だけを渡す。
function renderNashGridWithFreq(
  container: HTMLDivElement,
  freqMap: ReadonlyMap<HandNotation, number>,
  type: "push" | "call",
): void {
  const solidClass = type === "push" ? "in-range-villain" : "in-range-hero";
  const freqOf = (hand: HandNotation): number => freqMap.get(hand) ?? 0;
  renderGrid(
    container,
    (hand) => {
      const freq = freqOf(hand);
      if (freq >= NASH_FREQ_SOLID) return solidClass;
      if (freq >= NASH_FREQ_MARGINAL) return "marginal";
      return "";
    },
    (hand) => `${hand} (${Math.round(freqOf(hand) * 100)}%)`,
  );
}

// HU 限界に関する警告ボックス更新
// hero/villain の双方より後に行動するプレイヤー (over-caller 候補) が
// 生存している場合のみ警告を出す。
export function updateNashOvercallWarn(): void {
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

  // 押す人の後ろにいる人は、全員のコールを入れて解いている (solveSpotNash)。
  // ただし 2 人目のコール (オーバーコール) は入れていないので、その旨を出す。
  warnEl.classList.remove("hidden");
  warnEl.innerHTML = t("nash.multiway.note.html", {
    n: intruders.length,
    list: intruders.map((p) => `${p.position} ${p.stack}BB`).join("、"),
  });
}

function runNash(): void {
  clearNashResult();
  const stacks = players.map((p) => p.stack);
  const payouts = parseList(payoutsInput.value);
  const heroIndex = players.findIndex((p) => p.role === "hero");
  const villainIndex = players.findIndex((p) => p.role === "villain");

  // heroIndex === villainIndex はデータモデル上到達不能 (Player.role は排他的な
  // 単一値のため)。heroIndex/villainIndex がともに -1 のケースは
  // `heroIndex < 0 || villainIndex < 0` で既に弾かれる。防御的に残す。
  if (heroIndex < 0 || villainIndex < 0 || heroIndex === villainIndex) {
    nashStatus.innerHTML = `<span class="error">${t("nash.err.needHV")}</span>`;
    return;
  }
  if (payouts.length === 0) {
    nashStatus.innerHTML = `<span class="error">${t("nash.err.needPayout")}</span>`;
    return;
  }
  const sb = Number(nashSbInput.value);
  const bb = Number(nashBbInput.value);
  const anteRaw = Number(nashAnteInput.value);
  if (!Number.isFinite(sb) || sb <= 0) {
    nashStatus.innerHTML = `<span class="error">${t("nash.err.sb")}</span>`;
    return;
  }
  if (!Number.isFinite(bb) || bb <= 0) {
    nashStatus.innerHTML = `<span class="error">${t("nash.err.bb")}</span>`;
    return;
  }
  if (!Number.isFinite(anteRaw) || anteRaw < 0) {
    nashStatus.innerHTML = `<span class="error">${t("nash.err.ante")}</span>`;
    return;
  }
  // 先に動く方が押す。実際のポジションの blind / BB ante / 第三者の dead money で局面を組む
  // (アンティ入力はテーブル合計。BB の人が払う)
  const { pusherIndex, callerIndex } = nashRoles(heroIndex, villainIndex);

  // ボタンを「計算中…」に
  nashSolveBtn.disabled = true;
  const oldText = nashSolveBtn.textContent;
  nashSolveBtn.textContent = t("nash.calculating");
  nashStatus.textContent = "";
  const inputKey = currentInputKey();
  resultInputKey = inputKey;

  // 描画ブロックを避けるため setTimeout で処理を後回し
  setTimeout(() => {
    try {
      if (resultInputKey !== inputKey || currentInputKey() !== inputKey) {
        clearNashResult();
        nashStatus.textContent = t("nash.inputsChanged");
        return;
      }
      // 押す人の後ろに 2 人以上いれば全員のコールを入れて解く (それ以外は 2 人モデル)
      const result = solveSpotNash(players, payouts, pusherIndex, callerIndex, sb, bb, anteRaw);

      // 描画: frequency に応じて濃淡（mixed strategy 表示）
      renderNashGridWithFreq(nashSbGrid, result.pushFreq, "push");
      renderNashGridWithFreq(nashBbGrid, result.callFreq, "call");

      const sbCount = result.pushRange.size;
      const bbCount = result.callRange.size;
      // 割合はコンボベース (ポーカー標準)。件数は「種類 / コンボ」を併記する。
      nashSbStats.innerHTML = t("nash.stats", {
        n: sbCount,
        combos: comboCountOfRange(result.pushRange),
        pct: comboPctOfRange(result.pushRange).toFixed(1),
      });
      nashBbStats.innerHTML = t("nash.stats", {
        n: bbCount,
        combos: comboCountOfRange(result.callRange),
        pct: comboPctOfRange(result.callRange).toFixed(1),
      });

      // 後ろにいる他の人のコールレンジ (多人数モデルのときだけ)
      const othersEl = document.getElementById("nash-others");
      if (othersEl) {
        othersEl.classList.toggle("hidden", result.others.length === 0);
        othersEl.textContent = result.others.length === 0 ? "" : t("nash.others", {
          list: result.others
            .map(({ index, range }) => `${players[index]?.position ?? ""} ${comboPctOfRange(range).toFixed(0)}%`)
            .join(" / "),
        });
      }

      // 収束したときは何も出さない (反復回数・計算時間は利用者には不要)
      nashStatus.innerHTML = result.converged
        ? ""
        : `<span style="color: var(--warn)">${t("nash.notConverged")}</span>`;

      // push/fold 前提の注意。深くなるほど実戦には 2BB オープンやリンプが入り、
      // push/fold 2択の均衡は実際より広く押す結果になる。
      //   - caution (12〜20BB): 結果の上に「2択に限った場合の上限」と注意
      //   - outOfRange (20BB 超): 範囲外と説明し、結果は押したときだけ表示
      const effStack = Math.min(stacks[heroIndex] ?? 0, stacks[villainIndex] ?? 0);
      renderNashDepth(pushDepthTier(effStack), effStack);
    } catch (err) {
      clearNashResult();
      const msg = err instanceof Error ? err.message : String(err);
      nashStatus.textContent = msg;
    } finally {
      nashSolveBtn.disabled = false;
      nashSolveBtn.textContent = oldText ?? t("nash.solveBtn");
      if (currentInputKey() !== inputKey) ensureNashCalculated();
    }
  }, 10);
}

/** Nash タブの初期描画・イベント配線。main.ts から一度だけ呼ぶ。 */
export function initNashUI(): void {
  // 起動時に保存された Nash パラメータを復元
  // アンティモードは「合計」を必ずデフォルトにする（保存値は無視）。
  // HRC 互換にしたい時はユーザーが明示的にラジオを切り替える。
  // BB はスタックの単位なので常に 1 (以前の版で変えた値が保存されていても戻す)。
  if (persistedState?.nash) {
    nashSbInput.value = String(persistedState.nash.sb);
    nashBbInput.value = String(DEFAULT_BB);
    nashAnteInput.value = String(persistedState.nash.ante);
  }
  // Nash 入力変更時に状態保存
  [nashSbInput, nashBbInput, nashAnteInput].forEach((el) => {
    el.addEventListener("input", saveState);
  });

  // 初期描画（空のグリッド）
  renderGrid(nashSbGrid, () => "");
  renderGrid(nashBbGrid, () => "");

  if (!hasHUMatrix()) {
    nashStatus.textContent = t("nash.matrixMissing");
  }

  nashSolveBtn.addEventListener("click", runNash);
  document.addEventListener("analysis-view-change", ensureNashCalculated);
}
