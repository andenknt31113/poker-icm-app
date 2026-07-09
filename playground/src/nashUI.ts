import { solveHUNash } from "@poker-icm/core";
import { ALL_169_HANDS, handAt, type HandNotation } from "./handRanking.js";
import { huEquity, hasHUMatrix } from "./huEquityMatrix.js";
import { renderGrid } from "./grid.js";
import { $ } from "./dom.js";
import {
  players,
  parseList,
  persistedState,
  actionOrderIdx,
} from "./appState.js";
import { payoutsInput, nashSbInput, nashBbInput, nashAnteInput, saveState } from "./domRefs.js";

const nashSolveBtn = $<HTMLButtonElement>("nash-solve");
const nashStatus = $<HTMLParagraphElement>("nash-status");
const nashSbStats = $<HTMLParagraphElement>("nash-sb-stats");
const nashBbStats = $<HTMLParagraphElement>("nash-bb-stats");
const nashSbGrid = $<HTMLDivElement>("nash-sb-grid");
const nashBbGrid = $<HTMLDivElement>("nash-bb-grid");

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

/** Nash タブの初期描画・イベント配線。main.ts から一度だけ呼ぶ。 */
export function initNashUI(): void {
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

  nashSolveBtn.addEventListener("click", runNash);
}
