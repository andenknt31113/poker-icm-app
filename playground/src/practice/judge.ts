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
      <div class="practice-details-body">
        <h4>1. Bubble Factor (参考値: 対称フリップ近似)</h4>
        <p><code>BF = (現状 − 負け) ÷ (勝ち − 現状) = ${(p.bfEquityNow - p.bfEquityLose).toFixed(3)} ÷ ${(p.bfEquityWin - p.bfEquityNow).toFixed(3)} = ${p.bf.toFixed(3)}</code></p>
        <h4>2. 必要勝率</h4>
        <ul>
          <li>cEV: <code>リスク ÷ (リスク + リターン) = ${p.callAmount} ÷ (${p.callAmount} + ${p.potIfWin.toFixed(1)}) = ${(p.cEV * 100).toFixed(1)}%</code></li>
          <li>$EV (BF 近似): <code>(リスク × BF) ÷ (リスク × BF + リターン) = ${evBF.toFixed(2)} ÷ (${evBF.toFixed(2)} + ${p.potIfWin.toFixed(1)}) = ${(p.dollarEVApprox * 100).toFixed(1)}%</code></li>
          <li>$EV (厳密 ICM): <code>(Efold − Elose) ÷ (Ewin − Elose) = ${(p.equityFold - p.equityLose).toFixed(3)} ÷ ${(p.equityWin - p.equityLose).toFixed(3)} = ${(p.dollarEV * 100).toFixed(1)}%</code></li>
        </ul>
        <h4>3. Risk Premium</h4>
        <p><code>RP = 厳密$EV − cEV = ${(p.dollarEV * 100).toFixed(1)}% − ${(p.cEV * 100).toFixed(1)}% = +${actualRP.toFixed(2)}%</code></p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          BF 近似: <strong>+${actualRPApprox.toFixed(2)}%</strong> / 厳密 ICM: <strong style="color: var(--accent);">+${actualRP.toFixed(2)}%</strong>（判定はこちら）
        </p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF が大きい (バブルに近い / スタックが拮抗) ほど RP は大きくなります。BF 近似は境界付近で厳密値と数%ずれることがあります。
        </p>
      </div>
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
      <div class="practice-details-body">
        ${(() => {
          const heroIdx = p.scenarioPlayers.findIndex((x) => x.role === "hero");
          const villainIdx = p.scenarioPlayers.findIndex((x) => x.role === "villain");
          const heroPlayer = p.scenarioPlayers[heroIdx]!;
          const villainPlayer = p.scenarioPlayers[villainIdx]!;
          const heroStack = heroPlayer.stack;
          const villainStack = villainPlayer.stack;
          const villainPos = villainPlayer.position;
          const sbDead = villainPos === "SB" ? 0 : p.sb;
          const villainMatch = p.callAmount + p.bb;
          const pot = p.potIfWin + p.callAmount;
          // 終端スタック (厳密 ICM = calculateExactCallEquity と全く同じ計算から取得)
          const stackIfFold = p.stacksFold[heroIdx]!;
          const stackIfWin = p.stacksWin[heroIdx]!;
          const stackIfLose = p.stacksLose[heroIdx]!;
          const winVsFold = stackIfWin - stackIfFold;
          const loseVsFold = stackIfLose - stackIfFold;
          const netWinFromStart = stackIfWin - heroStack;
          const netLoseFromStart = stackIfLose - heroStack;
          const netFoldFromStart = stackIfFold - heroStack;
          return `
        <h4>1. ポット構成 (BB ante 構造)</h4>
        <ul style="font-size: 12px; line-height: 1.5;">
          <li>自分(BB) blind: <code>${p.bb.toFixed(1)}</code> BB <span style="color: var(--muted);">(既出 sunk)</span></li>
          <li>自分(BB) ante: <code>${p.totalAnte.toFixed(1)}</code> BB <span style="color: var(--muted);">(既出 sunk, BBが全額負担)</span></li>
          ${sbDead > 0 ? `<li>SB dead blind: <code>${sbDead.toFixed(1)}</code> BB <span style="color: var(--muted);">(SB folded → dead)</span></li>` : ""}
          <li>自分(BB) これから払う <strong>call</strong>: <code>${p.callAmount.toFixed(1)}</code> BB</li>
          <li>相手(${villainPos}) match: <code>${villainMatch.toFixed(1)}</code> BB <span style="color: var(--muted);">(全 stack ${villainStack} のうちマッチ分)</span></li>
          <li><strong>合計 pot (showdown 時): ${pot.toFixed(1)} BB</strong></li>
        </ul>

        <h4>2. 判断 (call vs fold 比較・終端スタック)</h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr><th style="text-align:left; padding: 4px;">選択</th><th style="text-align:right; padding: 4px;">最終スタック</th><th style="text-align:right; padding: 4px;">vs fold</th><th style="text-align:right; padding: 4px;">起点比</th></tr>
          <tr><td style="padding: 4px;">フォールド</td><td style="text-align:right; padding: 4px;"><code>${stackIfFold.toFixed(1)}</code></td><td style="text-align:right; padding: 4px;"><code>±0</code></td><td style="text-align:right; padding: 4px; color: ${netFoldFromStart >= 0 ? 'var(--good)' : 'var(--bad)'};"><code>${netFoldFromStart >= 0 ? '+' : ''}${netFoldFromStart.toFixed(1)}</code></td></tr>
          <tr><td style="padding: 4px;">コール+勝ち</td><td style="text-align:right; padding: 4px;"><code>${stackIfWin.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: var(--good);"><code>${winVsFold >= 0 ? '+' : ''}${winVsFold.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: ${netWinFromStart >= 0 ? 'var(--good)' : 'var(--bad)'};"><code>${netWinFromStart >= 0 ? '+' : ''}${netWinFromStart.toFixed(1)}</code></td></tr>
          <tr><td style="padding: 4px;">コール+負け</td><td style="text-align:right; padding: 4px;"><code>${stackIfLose.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>${loseVsFold.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>${netLoseFromStart.toFixed(1)}</code></td></tr>
        </table>
        <p style="font-size: 11px; color: var(--muted); margin: 6px 0 0;">
          📌 この3つの終端スタック (fold / コール+勝ち / コール+負け) が、下の「3. ICM エクイティ」の計算にそのまま使われます。<br>
          「起点 (hand 開始) からの純利益」は <strong>${netWinFromStart >= 0 ? '+' : ''}${netWinFromStart.toFixed(1)} BB</strong> (= 最終 ${stackIfWin.toFixed(1)} − 起点 ${heroStack})。
        </p>
          `;
        })()}

        <h4>3. ICM エクイティ ($ 単位・厳密計算)</h4>
        <ul>
          <li>フォールド時: <code>${p.equityFold.toFixed(3)}</code></li>
          <li>コール+勝った時: <code>${p.equityWin.toFixed(3)}</code> (fold比 ${p.equityWin - p.equityFold >= 0 ? "+" : ""}${(p.equityWin - p.equityFold).toFixed(3)})</li>
          <li>コール+負けた時: <code>${p.equityLose.toFixed(3)}</code> (fold比 ${(p.equityLose - p.equityFold).toFixed(3)})</li>
        </ul>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ 上の「2. 判断」の終端スタックそれぞれを ICM (Malmuth-Harville) に通した $ エクイティです。近似 (BF) を経由しない厳密値です。
        </p>

        <h4>4. 参考: Bubble Factor 近似 (実効スタックの対称フリップ)</h4>
        <p><code>BF = (現状 − 負け) ÷ (勝ち − 現状) = ${(p.bfEquityNow - p.bfEquityLose).toFixed(3)} ÷ ${(p.bfEquityWin - p.bfEquityNow).toFixed(3)} = ${p.bf.toFixed(3)}</code></p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF は「実効スタック同士の対称フリップ」という汎用シナリオで測った指標で、実際のコールの fold/win/lose 終端 (上のセクション2・3) とは別の計算です。参考値として掲載しています。
        </p>

        <h4>5. 必要勝率 + Risk Premium</h4>
        <ul>
          <li>cEV: <code>リスク ÷ (リスク + リターン) = ${p.callAmount} ÷ (${p.callAmount} + ${p.potIfWin.toFixed(1)}) = ${(p.cEV * 100).toFixed(1)}%</code></li>
          <li>$EV (BF 近似・線形化): <code>(リスク × BF) ÷ (リスク × BF + リターン) = (${p.callAmount} × ${p.bf.toFixed(2)}) ÷ (${p.callAmount} × ${p.bf.toFixed(2)} + ${p.potIfWin.toFixed(1)}) = ${(p.dollarEVApprox * 100).toFixed(1)}%</code></li>
          <li>$EV (厳密 ICM): <code>(Efold − Elose) ÷ (Ewin − Elose) = ${(p.equityFold - p.equityLose).toFixed(3)} ÷ ${(p.equityWin - p.equityLose).toFixed(3)} = ${(p.dollarEV * 100).toFixed(1)}%</code></li>
        </ul>
        <p style="font-size: 12px; margin: 6px 0;">
          <strong>BF 近似: ${(p.dollarEVApprox * 100).toFixed(1)}% / 厳密 ICM: <span style="color: var(--accent);">${(p.dollarEV * 100).toFixed(1)}%</span>（判定はこちら）</strong>
        </p>
        <ul>
          <li><strong>RP (厳密 ICM)</strong>: <code>厳密$EV − cEV = ${(p.dollarEV * 100).toFixed(1)}% − ${(p.cEV * 100).toFixed(1)}% = ${((p.dollarEV - p.cEV) * 100 >= 0 ? "+" : "")}${((p.dollarEV - p.cEV) * 100).toFixed(2)}%</code></li>
        </ul>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF 近似は線形化のため境界付近で厳密値と 1〜2% ずれることがあります。call/fold の判定は必ず厳密 ICM 側 (${(p.dollarEV * 100).toFixed(1)}%) を使用しています。
        </p>

        <h4>6. ハンド equity</h4>
        <p><code>${p.heroHand}</code> vs Top ${p.villainCallRangePct}% range → <strong>${(p.heroEq * 100).toFixed(1)}%</strong></p>

        <h4>7. 判定</h4>
        <p>
          ハンド equity <code>${(p.heroEq * 100).toFixed(1)}%</code>
          ${p.heroEq >= p.dollarEV ? "≥" : "<"}
          必要勝率 (厳密 ICM) <code>${(p.dollarEV * 100).toFixed(1)}%</code>
          → <strong>${p.heroEq >= p.dollarEV ? "コール (+EV)" : "フォールド (-EV)"}</strong>
        </p>
      </div>
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
      <div class="practice-details-body">
        <h4>1. ポット構成 (push→call 時, BB ante 構造)</h4>
        <ul style="font-size: 12px; line-height: 1.5;">
          <li>自分(SB) push (全 stack): <code>${heroStack.toFixed(1)}</code> BB</li>
          <li>相手(BB) ante: <code>${p.totalAnte.toFixed(1)}</code> BB <span style="color: var(--muted);">(BB が全額負担, dead)</span></li>
          <li>matched (少ない方に揃える): <code>${matched.toFixed(1)}</code> BB</li>
          <li><strong>合計 pot (showdown 時): ${pot.toFixed(1)} BB</strong></li>
        </ul>

        <h4>2. 終端スタック (push 判定 4 終端)</h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr><th style="text-align:left; padding: 4px;">終端</th><th style="text-align:right; padding: 4px;">最終スタック</th><th style="text-align:right; padding: 4px;">起点比</th></tr>
          <tr><td style="padding: 4px;">フォールド (push しない)</td><td style="text-align:right; padding: 4px;"><code>${stackFold.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: ${stackFold - heroStack >= 0 ? "var(--good)" : "var(--bad)"};"><code>${stackFold - heroStack >= 0 ? "+" : ""}${(stackFold - heroStack).toFixed(1)}</code></td></tr>
          <tr><td style="padding: 4px;">push → villain fold (スチール)</td><td style="text-align:right; padding: 4px;"><code>${stackSteal.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: ${stackSteal - heroStack >= 0 ? "var(--good)" : "var(--bad)"};"><code>${stackSteal - heroStack >= 0 ? "+" : ""}${(stackSteal - heroStack).toFixed(1)}</code></td></tr>
          <tr><td style="padding: 4px;">push → call → 勝ち</td><td style="text-align:right; padding: 4px;"><code>${stackWin.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: var(--good);"><code>${stackWin - heroStack >= 0 ? "+" : ""}${(stackWin - heroStack).toFixed(1)}</code></td></tr>
          <tr><td style="padding: 4px;">push → call → 負け</td><td style="text-align:right; padding: 4px;"><code>${stackLose.toFixed(1)}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>${(stackLose - heroStack).toFixed(1)}</code></td></tr>
        </table>

        <h4>3. ICM エクイティ ($ 単位・厳密計算)</h4>
        <ul>
          <li>フォールド時: <code>${equityFold.toFixed(3)}</code></li>
          <li>push → villain fold (スチール成功): <code>${equitySteal.toFixed(3)}</code></li>
          <li>push → call → 勝った時: <code>${equityWin.toFixed(3)}</code></li>
          <li>push → call → 負けた時: <code>${equityLose.toFixed(3)}</code></li>
        </ul>

        <h4>4. villain のコール率・equity 内訳</h4>
        <ul>
          <li>villain (BB) 想定コールレンジ: <code>Top ${p.villainCallRangePct}%</code></li>
          <li>コール率 (コンボ重み比) pCall: <code>${(pCall * 100).toFixed(1)}%</code> <span style="color: var(--muted);">(スチール成功率 = 1 − pCall = ${((1 - pCall) * 100).toFixed(1)}%)</span></li>
          <li>${p.heroHand} vs コールレンジ equity: <code>${(eqVsCallRange * 100).toFixed(1)}%</code></li>
        </ul>

        <h4>5. push の $EV</h4>
        <p><code>evPush = (1−pCall)×Esteal + pCall×(eq×Ewin + (1−eq)×Elose)<br />
        = ${(1 - pCall).toFixed(3)}×${equitySteal.toFixed(3)} + ${pCall.toFixed(3)}×(${eqVsCallRange.toFixed(3)}×${equityWin.toFixed(3)} + ${(1 - eqVsCallRange).toFixed(3)}×${equityLose.toFixed(3)})<br />
        = ${evPush.toFixed(3)}</code></p>
        <p><code>evFold = ${evFold.toFixed(3)}</code></p>

        <h4>6. 判定</h4>
        <p>
          push $EV <code>${evPush.toFixed(3)}</code>
          ${evPush >= evFold ? "≥" : "<"}
          fold $EV <code>${evFold.toFixed(3)}</code>
          → <strong>${evPush >= evFold ? "オールイン (+EV)" : "フォールド (-EV)"}</strong>
        </p>
      </div>
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
