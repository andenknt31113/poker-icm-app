import type { PracticeProblem } from "./types.js";
import { t } from "../i18n.js";
import { ensureDerivedFields, problemRP, getPracticeDifficulty, getPracticeMode, RP_TOLERANCE, practiceProblemDedupKey } from "./generate.js";
import { getCurrentProblem, setCurrentProblem, renderJudgeHeroGrid, renderJudgeHeroGridPush } from "./render.js";
import { isTutorialActive, getTutorialStep, TUTORIAL_PROBLEMS } from "./tutorialState.js";
import { loadStreak, saveStreak, loadStats, saveStats, loadReviewList, saveReviewList, appendHistory } from "./store.js";
import { updatePracticeProgress } from "./progress.js";

export function updatePracticeBadges(): void {
  const streak = loadStreak();
  const stats = loadStats();
  const review = loadReviewList();
  const streakEl = document.getElementById("practice-streak");
  const accEl = document.getElementById("practice-acc");
  const reviewCountEl = document.getElementById("review-count");
  const reviewBtnEl = document.getElementById("practice-review-btn");
  if (streakEl) {
    streakEl.textContent = t("practice.badge.streak", { n: streak });
    streakEl.classList.toggle("active", streak >= 3);
  }
  if (accEl) {
    if (stats.total > 0) {
      accEl.textContent = t("practice.badge.acc", {
        pct: ((stats.correct / stats.total) * 100).toFixed(0),
        correct: stats.correct,
        total: stats.total,
      });
    } else {
      accEl.textContent = t("practice.badge.accEmpty");
    }
  }
  if (reviewCountEl) reviewCountEl.textContent = String(review.length);
  // 復習 0 件のときは常にボタン自体を隠す (雑音になるだけで押しても意味が無いため)
  if (reviewBtnEl) reviewBtnEl.classList.toggle("hidden", review.length === 0);
}

/**
 * 判定結果に添える「教訓」一行。優先順位で最初にマッチしたものだけを返す。
 * 1. ペイアウトがほぼ均等 (サテライト型)
 * 2. villain がカバーしている (villainStack >= heroStack) かつ RP が高い
 * 3. hero がカバーしている (villainStack < heroStack) かつ RP が低い
 * 4. hero より短いスタックの other プレイヤーがいる
 * 5. それ以外の一般則
 */
export function practiceLesson(p: PracticeProblem): string {
  const payouts = p.payouts;
  // WTA (ペイ1つ) は ICM 圧ゼロ。均等ペイ判定より先に処理しないと
  // max=min で「サテライト」に誤マッチする
  if (payouts.length === 1) {
    return t("practice.lesson.wta");
  }
  if (payouts.length >= 2) {
    const maxPayout = Math.max(...payouts);
    const minPayout = Math.min(...payouts);
    if (maxPayout > 0 && maxPayout - minPayout < maxPayout * 0.15) {
      return t("practice.lesson.satellite");
    }
  }

  const hero = p.scenarioPlayers.find((pl) => pl.role === "hero");
  const villain = p.scenarioPlayers.find((pl) => pl.role === "villain");
  const rp = problemRP(p);

  if (hero && villain) {
    if (villain.stack >= hero.stack && rp >= 5) {
      return t("practice.lesson.covered");
    }
    if (villain.stack < hero.stack && rp < 5) {
      return t("practice.lesson.covering");
    }
  }

  if (hero) {
    const hasShorterOther = p.scenarioPlayers.some(
      (pl) => pl.role === "other" && pl.stack < hero.stack,
    );
    if (hasShorterOther) {
      return t("practice.lesson.shorter");
    }
  }

  return t("practice.lesson.general");
}

/**
 * push 判定モード専用の「教訓」一行。practiceLesson と同様、優先順位で
 * 最初にマッチしたものだけを返す。
 * 1. WTA (ICM 圧ゼロ)
 * 2. サテライト型 (均等ペイ) → push もタイトに
 * 3. villain がカバーしている (villainStack >= heroStack) かつ push が厳しい
 * 4. スチール成功率が高い (villain のコール率が低い) → 広く push できる
 * 5. それ以外の一般則 (push $EV の式)
 */
export function practicePushLesson(p: PracticeProblem): string {
  const payouts = p.payouts;
  if (payouts.length === 1) {
    return t("practice.pushLesson.wta");
  }
  if (payouts.length >= 2) {
    const maxPayout = Math.max(...payouts);
    const minPayout = Math.min(...payouts);
    if (maxPayout > 0 && maxPayout - minPayout < maxPayout * 0.15) {
      return t("practice.pushLesson.satellite");
    }
  }

  const hero = p.scenarioPlayers.find((pl) => pl.role === "hero");
  const villain = p.scenarioPlayers.find((pl) => pl.role === "villain");
  const marginNorm = p.pushMarginNorm ?? 0;

  if (hero && villain && villain.stack >= hero.stack && marginNorm < 0.03) {
    return t("practice.pushLesson.covered");
  }

  const pCall = p.pushPCall ?? 0;
  if (pCall < 0.15) {
    return t("practice.pushLesson.steal");
  }

  return t("practice.pushLesson.general");
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
    const key = practiceProblemDedupKey({ ...p, savedMode: getPracticeMode() });
    if (!list.some((x) => practiceProblemDedupKey(x) === key)) {
      // 出題時のモードを記録し、復習では同じモードで再出題する
      list.unshift({ ...p, savedMode: getPracticeMode() });
      saveReviewList(list);
    }
  }
  appendHistory({ t: Date.now(), mode: getPracticeMode(), diff: getPracticeDifficulty(), ok: isCorrect });
  updatePracticeBadges();
  updatePracticeProgress();
}

export function judgePracticeRP(guess: number): void {
  const raw = getCurrentProblem();
  if (!raw) return;
  const p = ensureDerivedFields(raw);
  setCurrentProblem(p);
  const fb = document.getElementById("practice-feedback");
  if (!fb) return;
  // RP = 厳密必要勝率 (p.dollarEV) − cEV に統一
  const actualRP = problemRP(p);
  const actualRPApprox = (p.dollarEVApprox - p.cEV) * 100;
  const tol = RP_TOLERANCE[getPracticeDifficulty()];
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
      <div class="verdict">${isCorrect ? t("practice.verdict.correct") : t("practice.verdict.wrong")}</div>
      <button id="practice-next-btn-top" type="button" class="solve-btn compact">${t("practice.nextBtnTop")}</button>
    </div>
    <div class="practice-lesson">💡 ${practiceLesson(p)}</div>
    <div>${t("practice.rp.yourAnswerLabel")} <strong>+${guess.toFixed(1)}%</strong></div>
    <div>${t("practice.rp.correctLabel")} <strong style="color: var(--accent)">+${actualRP.toFixed(1)}%</strong> <span class="muted">${t("practice.rp.tolNote", { tol })}</span></div>
    <div>${t("practice.rp.errorLabel")} <strong style="color: ${isCorrect ? "var(--good)" : "var(--bad)"}">${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%</strong></div>
    <details class="practice-details">
      <summary>${t("practice.details.summary")}</summary>
      <div class="practice-details-body">${t("practice.rpDetails.body.html", {
        bfNum: (p.bfEquityNow - p.bfEquityLose).toFixed(3),
        bfDen: (p.bfEquityWin - p.bfEquityNow).toFixed(3),
        bf: p.bf.toFixed(3),
        call: p.callAmount,
        pot: p.potIfWin.toFixed(1),
        cev: (p.cEV * 100).toFixed(1),
        evBF: evBF.toFixed(2),
        approx: (p.dollarEVApprox * 100).toFixed(1),
        exactNum: (p.equityFold - p.equityLose).toFixed(3),
        exactDen: (p.equityWin - p.equityLose).toFixed(3),
        exact: (p.dollarEV * 100).toFixed(1),
        rp: actualRP.toFixed(2),
        rpApprox: actualRPApprox.toFixed(2),
      })}</div>
    </details>
    <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">
      <button id="practice-next-btn" type="button" class="solve-btn">${t("practice.nextBtn")}</button>
      <button id="practice-apply-btn" type="button" class="solve-btn" style="background: var(--card); color: var(--text); border: 1px solid var(--border);">${t("practice.applyBtn")}</button>
    </div>
  `;
  fb.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function judgePractice(answer: "call" | "fold"): void {
  const raw = getCurrentProblem();
  if (!raw) return;
  const p = ensureDerivedFields(raw);
  setCurrentProblem(p);
  const fb = document.getElementById("practice-feedback");
  if (!fb) return;
  const margin = p.heroEq - p.dollarEV;
  const correctIsCall = margin >= 0;
  const isCorrect = (correctIsCall && answer === "call") || (!correctIsCall && answer === "fold");
  const verdict = correctIsCall ? t("practice.verdict.call") : t("practice.verdict.fold");
  fb.className = "practice-feedback " + (isCorrect ? "correct" : "wrong");

  // チュートリアル中は streak/正解率/復習リストに記録しない
  if (!isTutorialActive()) {
    recordPracticeResult(isCorrect, p);
  }

  // 同じ問題に再回答して成績が変動しないよう、call/fold ボタンを無効化する
  // (RP 当てモードのスライダー/4択と同じパターン)
  document.querySelectorAll<HTMLButtonElement>(".practice-actions .practice-btn").forEach((b) => {
    b.disabled = true;
  });

  const tutorialDef = isTutorialActive() ? TUTORIAL_PROBLEMS[getTutorialStep()] : undefined;
  const tutorialBlockHtml = tutorialDef
    ? `
    <div class="tutorial-explain-card">
      <div class="tutorial-explain-title">${t("practice.tutorial.explainTitle", { title: tutorialDef.title })}</div>
      <div class="tutorial-explain-body">${tutorialDef.lesson}</div>
      <button id="tutorial-next-btn" type="button" class="solve-btn">${t("practice.tutorial.nextBtn")}</button>
    </div>
  `
    : "";

  // 「📖 詳しい計算式」details 本体を組み立てる (辞書化のため値を先に確定)。
  const dHeroIdx = p.scenarioPlayers.findIndex((x) => x.role === "hero");
  const dVillainIdx = p.scenarioPlayers.findIndex((x) => x.role === "villain");
  const dHeroStack = p.scenarioPlayers[dHeroIdx]!.stack;
  const dVillainStack = p.scenarioPlayers[dVillainIdx]!.stack;
  const dVillainPos = p.scenarioPlayers[dVillainIdx]!.position;
  const dSbDead = dVillainPos === "SB" ? 0 : p.sb;
  const dVillainMatch = p.callAmount + p.bb;
  const dPot = p.potIfWin + p.callAmount;
  // 終端スタック (厳密 ICM = calculateExactCallEquity と全く同じ計算から取得)
  const dStackIfFold = p.stacksFold[dHeroIdx]!;
  const dStackIfWin = p.stacksWin[dHeroIdx]!;
  const dStackIfLose = p.stacksLose[dHeroIdx]!;
  const dWinVsFold = dStackIfWin - dStackIfFold;
  const dLoseVsFold = dStackIfLose - dStackIfFold;
  const dNetWin = dStackIfWin - dHeroStack;
  const dNetLose = dStackIfLose - dHeroStack;
  const dNetFold = dStackIfFold - dHeroStack;
  const dSgn = (v: number) => (v >= 0 ? "+" : "");
  const dCol = (v: number) => (v >= 0 ? "var(--good)" : "var(--bad)");
  const cfDetailsBody = t("practice.cfDetails.body.html", {
    sbDeadLine: dSbDead > 0 ? t("practice.cfDetails.sbDeadLine", { v: dSbDead.toFixed(1) }) : "",
    bb: p.bb.toFixed(1),
    ante: p.totalAnte.toFixed(1),
    call: p.callAmount,
    callFixed: p.callAmount.toFixed(1),
    villainPos: dVillainPos ?? "",
    villainMatch: dVillainMatch.toFixed(1),
    villainStack: dVillainStack,
    pot: dPot.toFixed(1),
    potIfWin: p.potIfWin.toFixed(1),
    stackFold: dStackIfFold.toFixed(1),
    stackWin: dStackIfWin.toFixed(1),
    stackLose: dStackIfLose.toFixed(1),
    netFoldCol: dCol(dNetFold),
    netFoldSign: dSgn(dNetFold),
    netFold: dNetFold.toFixed(1),
    winVsFoldSign: dSgn(dWinVsFold),
    winVsFold: dWinVsFold.toFixed(1),
    netWinCol: dCol(dNetWin),
    netWinSign: dSgn(dNetWin),
    netWin: dNetWin.toFixed(1),
    loseVsFold: dLoseVsFold.toFixed(1),
    netLose: dNetLose.toFixed(1),
    heroStack: dHeroStack,
    eqFold: p.equityFold.toFixed(3),
    eqWin: p.equityWin.toFixed(3),
    eqWinVsFoldSign: p.equityWin - p.equityFold >= 0 ? "+" : "",
    eqWinVsFold: (p.equityWin - p.equityFold).toFixed(3),
    eqLose: p.equityLose.toFixed(3),
    eqLoseVsFold: (p.equityLose - p.equityFold).toFixed(3),
    bfNum: (p.bfEquityNow - p.bfEquityLose).toFixed(3),
    bfDen: (p.bfEquityWin - p.bfEquityNow).toFixed(3),
    bf: p.bf.toFixed(3),
    bf2: p.bf.toFixed(2),
    cev: (p.cEV * 100).toFixed(1),
    approx: (p.dollarEVApprox * 100).toFixed(1),
    exactNum: (p.equityFold - p.equityLose).toFixed(3),
    exactDen: (p.equityWin - p.equityLose).toFixed(3),
    exact: (p.dollarEV * 100).toFixed(1),
    rpSign: (p.dollarEV - p.cEV) * 100 >= 0 ? "+" : "",
    rp: ((p.dollarEV - p.cEV) * 100).toFixed(2),
    heroHand: p.heroHand,
    villainCallRangePct: p.villainCallRangePct,
    heroEq: (p.heroEq * 100).toFixed(1),
    verdictOp: p.heroEq >= p.dollarEV ? "≥" : "<",
    verdict: p.heroEq >= p.dollarEV ? t("practice.cfDetails.verdictCall") : t("practice.cfDetails.verdictFold"),
  });

  fb.innerHTML = `
    ${tutorialBlockHtml}
    <div class="verdict-row">
      <div class="verdict">${isCorrect ? t("practice.verdict.correct") : t("practice.verdict.wrong")} ${t("practice.verdict.answerPrefix")} ${verdict}</div>
      <button id="practice-next-btn-top" type="button" class="solve-btn compact">${t("practice.nextBtnTop")}</button>
    </div>
    <div class="practice-lesson">💡 ${practiceLesson(p)}</div>
    <div>${t("practice.cf.cevLabel")} <strong>${(p.cEV * 100).toFixed(1)}%</strong></div>
    <div>${t("practice.cf.reqLabel")} <strong>${(p.dollarEV * 100).toFixed(1)}%</strong> <span class="muted">${t("practice.cf.reqApproxNote", { v: (p.dollarEVApprox * 100).toFixed(1) })}</span></div>
    <div>${t("practice.cf.handEquity", { hand: p.heroHand, pct: p.villainCallRangePct })} <strong>${(p.heroEq * 100).toFixed(1)}%</strong></div>
    <div>${t("practice.label.margin")} <strong style="color: ${margin >= 0 ? "var(--good)" : "var(--bad)"}">${margin >= 0 ? "+" : ""}${(margin * 100).toFixed(1)}%</strong></div>
    <details class="practice-details">
      <summary>${t("practice.details.summary")}</summary>
      <div class="practice-details-body">${cfDetailsBody}</div>
    </details>

    <h3 style="font-size: 13px; margin: 12px 0 4px;">${t("practice.cf.heroRangeH3", { pct: (p.dollarEV * 100).toFixed(1) })}</h3>
    <div id="practice-hero-grid" class="hand-grid"></div>
    <div class="grid-legend">
      <span><span class="legend-box in-range-hero"></span>${t("practice.cf.legend.call")}</span>
      <span><span class="legend-box"></span>${t("practice.cf.legend.fold")}</span>
    </div>
    <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">
      <button id="practice-next-btn" type="button" class="solve-btn">${t("practice.nextBtn")}</button>
      <button id="practice-apply-btn" type="button" class="solve-btn" style="background: var(--card); color: var(--text); border: 1px solid var(--border);">${t("practice.applyBtn")}</button>
    </div>
  `;
  renderJudgeHeroGrid(p);
  fb.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function judgePracticePush(answer: "push" | "fold"): void {
  const raw = getCurrentProblem();
  if (!raw) return;
  const p = ensureDerivedFields(raw);
  setCurrentProblem(p);
  const fb = document.getElementById("practice-feedback");
  if (!fb) return;

  const shouldPush = p.pushShouldPush ?? false;
  const isCorrect = (shouldPush && answer === "push") || (!shouldPush && answer === "fold");
  const verdict = shouldPush ? t("practice.verdict.push") : t("practice.verdict.fold");
  fb.className = "practice-feedback " + (isCorrect ? "correct" : "wrong");

  if (!isTutorialActive()) {
    recordPracticeResult(isCorrect, p);
  }

  // 同じ問題に再回答して成績が変動しないよう、push/fold ボタンを無効化する
  document.querySelectorAll<HTMLButtonElement>(".practice-actions .practice-btn").forEach((b) => {
    b.disabled = true;
  });

  const heroIdx = p.scenarioPlayers.findIndex((x) => x.role === "hero");
  const villainIdx = p.scenarioPlayers.findIndex((x) => x.role === "villain");
  const heroStack = p.scenarioPlayers[heroIdx]!.stack;

  const evPush = p.pushEvPush ?? 0;
  const evFold = p.pushEvFold ?? 0;
  const equityFold = p.pushEquityFold ?? 0;
  const equitySteal = p.pushEquitySteal ?? 0;
  const equityWin = p.pushEquityWin ?? 0;
  const equityLose = p.pushEquityLose ?? 0;
  const stacksFold = p.pushStacksFold ?? [];
  const stacksSteal = p.pushStacksSteal ?? [];
  const stacksWin = p.pushStacksWin ?? [];
  const stacksLose = p.pushStacksLose ?? [];
  const pCall = p.pushPCall ?? 0;
  const eqVsCallRange = p.pushEqVsCallRange ?? 0;
  const matched = p.pushMatched ?? 0;
  const pot = p.pushPot ?? 0;

  const marginDollar = evPush - evFold;
  const numPlaces = Math.min(p.scenarioPlayers.length, p.payouts.length);
  const totalPayout = p.payouts.slice(0, numPlaces).reduce((a, b) => a + b, 0);
  const marginPct = totalPayout > 0 ? (marginDollar / totalPayout) * 100 : 0;

  const stackFold = stacksFold[heroIdx] ?? 0;
  const stackSteal = stacksSteal[heroIdx] ?? 0;
  const stackWin = stacksWin[heroIdx] ?? 0;
  const stackLose = stacksLose[heroIdx] ?? 0;

  fb.innerHTML = `
    <div class="verdict-row">
      <div class="verdict">${isCorrect ? t("practice.verdict.correct") : t("practice.verdict.wrong")} ${t("practice.verdict.answerPrefix")} ${verdict}</div>
      <button id="practice-next-btn-top" type="button" class="solve-btn compact">${t("practice.nextBtnTop")}</button>
    </div>
    <div class="practice-lesson">💡 ${practicePushLesson(p)}</div>
    <div>fold $EV: <strong>${evFold.toFixed(3)}</strong></div>
    <div>push $EV: <strong>${evPush.toFixed(3)}</strong> <span class="muted">${t("practice.push.evNote", { pcall: (pCall * 100).toFixed(0), eq: (eqVsCallRange * 100).toFixed(1) })}</span></div>
    <div>${t("practice.label.margin")} <strong style="color: ${marginDollar >= 0 ? "var(--good)" : "var(--bad)"}">${marginDollar >= 0 ? "+" : ""}${marginDollar.toFixed(3)}</strong> <span class="muted">${t("practice.push.marginPoolNote", { v: `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(2)}` })}</span></div>
    <details class="practice-details">
      <summary>${t("practice.details.summary")}</summary>
      <div class="practice-details-body">${t("practice.pushDetails.body.html", {
        heroStack: heroStack.toFixed(1),
        ante: p.totalAnte.toFixed(1),
        matched: matched.toFixed(1),
        pot: pot.toFixed(1),
        stackFold: stackFold.toFixed(1),
        foldCol: stackFold - heroStack >= 0 ? "var(--good)" : "var(--bad)",
        foldSign: stackFold - heroStack >= 0 ? "+" : "",
        foldRel: (stackFold - heroStack).toFixed(1),
        stackSteal: stackSteal.toFixed(1),
        stealCol: stackSteal - heroStack >= 0 ? "var(--good)" : "var(--bad)",
        stealSign: stackSteal - heroStack >= 0 ? "+" : "",
        stealRel: (stackSteal - heroStack).toFixed(1),
        stackWin: stackWin.toFixed(1),
        winSign: stackWin - heroStack >= 0 ? "+" : "",
        winRel: (stackWin - heroStack).toFixed(1),
        stackLose: stackLose.toFixed(1),
        loseRel: (stackLose - heroStack).toFixed(1),
        eqFold: equityFold.toFixed(3),
        eqSteal: equitySteal.toFixed(3),
        eqWin: equityWin.toFixed(3),
        eqLose: equityLose.toFixed(3),
        villainCallRangePct: p.villainCallRangePct,
        pCall: (pCall * 100).toFixed(1),
        stealPct: ((1 - pCall) * 100).toFixed(1),
        heroHand: p.heroHand,
        eqVsCallRange: (eqVsCallRange * 100).toFixed(1),
        oneMinusPCall: (1 - pCall).toFixed(3),
        pCall3: pCall.toFixed(3),
        eq3: eqVsCallRange.toFixed(3),
        oneMinusEq: (1 - eqVsCallRange).toFixed(3),
        evPush: evPush.toFixed(3),
        evFold: evFold.toFixed(3),
        verdictOp: evPush >= evFold ? "≥" : "<",
        verdict: evPush >= evFold ? t("practice.pushDetails.verdictPush") : t("practice.pushDetails.verdictFold"),
      })}</div>
    </details>

    <h3 style="font-size: 13px; margin: 12px 0 4px;">${t("practice.push.heroRangeH3")}</h3>
    <div id="practice-hero-grid" class="hand-grid"></div>
    <div class="grid-legend">
      <span><span class="legend-box in-range-hero"></span>push (+EV)</span>
      <span><span class="legend-box"></span>fold (-EV)</span>
    </div>
    <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">
      <button id="practice-next-btn" type="button" class="solve-btn">${t("practice.nextBtn")}</button>
      <button id="practice-apply-btn" type="button" class="solve-btn" style="background: var(--card); color: var(--text); border: 1px solid var(--border);">${t("practice.applyBtn")}</button>
    </div>
  `;
  renderJudgeHeroGridPush(p);
  fb.scrollIntoView({ behavior: "smooth", block: "start" });
}
