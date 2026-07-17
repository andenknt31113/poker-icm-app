import { topRange, type HandNotation } from "../handRanking.js";
import { equity } from "../equity.js";
import { renderGrid } from "../grid.js";
import { t } from "../i18n.js";
import type { Role, Position } from "../appState.js";
import type { PracticeProblem } from "./types.js";
import { ensureDerivedFields, getPracticeMode, getPracticeDifficulty, RP_TOLERANCE, buildEasyRPChoices, problemRP } from "./generate.js";

let currentProblem: PracticeProblem | null = null;

export function getCurrentProblem(): PracticeProblem | null {
  return currentProblem;
}
export function setCurrentProblem(p: PracticeProblem | null): void {
  currentProblem = p;
}

/**
 * 上部の練習アクション列 (🎲新しい問題 / 📚復習 / 🎓導入コース) の表示切替。
 * 導入コース案内カード表示中は CTA を「始める/スキップ」の2択に絞るため隠し、
 * それ以外 (通常出題・チュートリアル進行中・スキップ後・修了後) は表示する。
 */
export function setPracticeActionsTopVisible(visible: boolean): void {
  const el = document.getElementById("practice-actions-top");
  if (el) el.classList.toggle("hidden", !visible);
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
          <div class="scenario-fact"><span class="scenario-fact-key">${t("practice.bento.ante")}</span><span class="scenario-fact-val">${p.totalAnte}</span></div>
          <div class="scenario-fact"><span class="scenario-fact-key">${t("practice.bento.pay")}</span><span class="scenario-fact-val">${payoutStr}</span></div>
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

export function renderPracticeProblem(rawP: PracticeProblem): void {
  // 通常の問題出題 (チュートリアル中の問題ステップも含む) では
  // 導入コース案内カード用に隠していたアクション列を必ず戻す
  setPracticeActionsTopVisible(true);
  // 復習リストなど旧スキーマの問題は派生値を再計算してから使う
  const p = ensureDerivedFields(rawP);
  currentProblem = p;
  if (getPracticeMode() === "rp") {
    renderPracticeProblemRP(p);
    return;
  }
  if (getPracticeMode() === "push") {
    renderPracticeProblemPush(p);
    return;
  }
  const area = document.getElementById("practice-area");
  if (!area) return;
  const villain = p.scenarioPlayers.find((pl) => pl.role === "villain");
  const villainWarnHtml = `
    <div class="scenario-warn">
      <div class="scenario-warn-head">${t("practice.villainWarn.head", { pos: villain?.position || "?" })}</div>
      <div class="scenario-warn-body">
        <span class="scenario-warn-item">Stack <strong>${villain ? villain.stack : "?"} BB</strong></span>
        <span class="scenario-warn-item">${t("practice.villainWarn.estPush")} <strong>Top ${p.villainCallRangePct}%</strong></span>
      </div>
    </div>
  `;
  area.innerHTML = `
    <div id="practice-table-wrapper"></div>
    ${renderScenarioBento(p, villainWarnHtml)}
    <p class="hint">${t("practice.topxNote")}</p>
    <h3 style="font-size: 13px; margin: 12px 0 4px;">${t("practice.villainPushRange.h3")}</h3>
    <div id="practice-villain-grid" class="hand-grid"></div>
    ${renderHeroHandCards(p.heroHand)}
    <div class="practice-hand">${t("practice.yourHand", { hand: p.heroHand })}</div>
    <div class="practice-actions">
      <button class="practice-btn call" data-answer="call">${t("practice.btn.call")}</button>
      <button class="practice-btn fold" data-answer="fold">${t("practice.btn.fold")}</button>
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

// push 判定モード: hero=SB (pusher) が villain=BB (caller) に all-in するか fold するか
export function renderPracticeProblemPush(p: PracticeProblem): void {
  const area = document.getElementById("practice-area");
  if (!area) return;
  const villain = p.scenarioPlayers.find((pl) => pl.role === "villain");
  const villainCallInfoHtml = `
    <div class="scenario-warn">
      <div class="scenario-warn-head">${t("practice.villainCall.head")}</div>
      <div class="scenario-warn-body">
        <span class="scenario-warn-item">Stack <strong>${villain ? villain.stack : "?"} BB</strong></span>
        <span class="scenario-warn-item">${t("practice.villainCall.estCall")} <strong>Top ${p.villainCallRangePct}%</strong></span>
      </div>
    </div>
  `;
  area.innerHTML = `
    <div id="practice-table-wrapper"></div>
    ${renderScenarioBento(p, villainCallInfoHtml)}
    <p class="hint">${t("practice.topxNote")}</p>
    <h3 style="font-size: 13px; margin: 12px 0 4px;">${t("practice.villainCallRange.h3")}</h3>
    <div id="practice-villain-grid" class="hand-grid"></div>
    ${renderHeroHandCards(p.heroHand)}
    <div class="practice-hand">${t("practice.yourHandSb", { hand: p.heroHand })}</div>
    <div class="practice-actions">
      <button class="practice-btn push" data-answer="push">${t("practice.btn.push")}</button>
      <button class="practice-btn fold" data-answer="fold">${t("practice.btn.fold")}</button>
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

// RP 当てモード: Normal/Hard はスライダー、Easy は4択ボタンで Risk Premium を推定させる
export function renderPracticeProblemRP(p: PracticeProblem): void {
  const area = document.getElementById("practice-area");
  if (!area) return;
  const tol = RP_TOLERANCE[getPracticeDifficulty()];
  const rpInfoHtml = `
    <div class="scenario-rp-info">
      <span class="scenario-warn-item">${t("practice.rp.callRisk")} <strong>${p.callAmount.toFixed(1)} BB</strong></span>
      <span class="scenario-warn-item">${t("practice.rp.return")} <strong>${p.potIfWin.toFixed(1)} BB</strong></span>
    </div>
  `;
  const isEasy = getPracticeDifficulty() === "easy";
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
          <div class="rp-quiz-tol">${t("practice.rp.easyPick")}</div>
        `;
      })()
    : `
      <div class="rp-slider-value" id="rp-slider-value">+20.0%</div>
      <input type="range" id="rp-slider" class="rp-slider" min="0" max="50" step="0.5" value="20" />
      <div class="rp-slider-scale"><span>0%</span><span>25%</span><span>50%</span></div>
      <div class="rp-quiz-tol">${t("practice.rp.tol", { tol })}</div>
      <button id="rp-answer-btn" type="button" class="solve-btn">${t("practice.rp.answerBtn")}</button>
    `;
  area.innerHTML = `
    <div id="practice-table-wrapper"></div>
    ${renderScenarioBento(p, rpInfoHtml)}
    <div class="rp-quiz">
      <div class="rp-quiz-q">${t("practice.rp.question")}</div>
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

// judgePractice (judge.ts) から呼ばれる、call/fold 判定後の「自分の call レンジ」グリッド描画。
export function renderJudgeHeroGrid(p: PracticeProblem): void {
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
}

// judgePracticePush (judge.ts) から呼ばれる、push 判定後の「自分の push レンジ」グリッド描画。
// callfold の renderJudgeHeroGrid と違い、単一の必要勝率しきい値ではなく
// (1-pCall)×steal + pCall×(eq×win+(1-eq)×lose) というアフィン式を各ハンドの
// eq (vs villain call レンジ) で評価し、fold の $EV と比較する。
export function renderJudgeHeroGridPush(p: PracticeProblem): void {
  const heroGridEl = document.getElementById(
    "practice-hero-grid",
  ) as HTMLDivElement | null;
  if (!heroGridEl) return;
  const villainRange = topRange(p.villainCallRangePct);
  const pCall = p.pushPCall ?? 0;
  const equitySteal = p.pushEquitySteal ?? 0;
  const equityWin = p.pushEquityWin ?? 0;
  const equityLose = p.pushEquityLose ?? 0;
  const evFold = p.pushEvFold ?? 0;
  renderGrid(heroGridEl, (h) => {
    const eq = equity(h, villainRange);
    const evPushH = (1 - pCall) * equitySteal + pCall * (eq * equityWin + (1 - eq) * equityLose);
    const isPicked = h === p.heroHand;
    let cls = evPushH >= evFold ? "in-range-hero" : "";
    if (isPicked) cls += " picked";
    return cls;
  });
}

// モード別のヒント文を更新
export function updatePracticeHint(): void {
  const hint = document.getElementById("practice-hint");
  if (!hint) return;
  const mode = getPracticeMode();
  if (mode === "rp") {
    hint.textContent = t("practice.hint.rp");
  } else if (mode === "push") {
    hint.textContent = t("practice.hint.push");
  } else {
    hint.textContent = t("practice.hint.callfold");
  }
}
