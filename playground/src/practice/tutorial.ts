import type { PracticeProblem } from "./types.js";
import { t } from "../i18n.js";
import { computeDerivedFields, getPracticeMode, setPracticeModeSilent } from "./generate.js";
import { renderPracticeProblem, setCurrentProblem, setPracticeActionsTopVisible } from "./render.js";
import {
  TUTORIAL_PROBLEMS,
  setTutorialActive,
  getTutorialStep,
  setTutorialStep,
  markTutorialDone,
} from "./tutorialState.js";

function tutorialProgressHtml(step: number): string {
  const dots = TUTORIAL_PROBLEMS.map((_, i) => {
    const cls = i === step ? "active" : i < step ? "done" : "";
    return `<span class="tutorial-dot ${cls}"></span>`;
  }).join("");
  return `
    <div class="tutorial-progress">
      <span class="tutorial-progress-label">${t("practice.tutorial.progressLabel", { step: step + 1, total: TUTORIAL_PROBLEMS.length })}</span>
      <div class="tutorial-dots">${dots}</div>
    </div>
  `;
}

export function renderTutorialIntroCard(): void {
  const area = document.getElementById("practice-area");
  if (!area) return;
  // 案内カード表示中は上のアクション列 (新しい問題/復習/導入コース) を隠し、
  // 行動を「始める」/「スキップ」の2択に絞る (CTA一本化)
  setPracticeActionsTopVisible(false);
  area.innerHTML = `
    <div class="tutorial-intro-card">
      <div class="tutorial-intro-title">${t("practice.tutorial.introTitle")}</div>
      <div class="tutorial-intro-body">${t("practice.tutorial.introBody")}</div>
      <button id="tutorial-intro-start-btn" type="button" class="solve-btn">${t("practice.tutorial.introStart")}</button>
      <button id="tutorial-intro-skip-btn" type="button" class="tutorial-skip-link">${t("practice.tutorial.introSkip")}</button>
    </div>
  `;
}

export function renderTutorialNarrationStep(): void {
  const area = document.getElementById("practice-area");
  if (!area) return;
  // 案内カードから抜けた (導入コースを始めた) ので、アクション列を戻す
  setPracticeActionsTopVisible(true);
  const def = TUTORIAL_PROBLEMS[getTutorialStep()]!;
  setCurrentProblem(null);
  area.innerHTML = `
    ${tutorialProgressHtml(getTutorialStep())}
    <div class="tutorial-narration-card">
      <div class="tutorial-narration-title">${t("practice.tutorial.narrationTitle", { step: getTutorialStep() + 1, title: def.title })}</div>
      <div class="tutorial-narration-body">${def.narration}</div>
      <button id="tutorial-start-problem-btn" type="button" class="solve-btn">${t("practice.tutorial.narrationBtn")}</button>
    </div>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function renderTutorialProblemStep(): void {
  const def = TUTORIAL_PROBLEMS[getTutorialStep()]!;
  const p: PracticeProblem = { ...def.base, ...computeDerivedFields(def.base) };
  // チュートリアルは常に call/fold 判定 UI で出題する (RP当てモードが選択中でも固定)
  const savedMode = getPracticeMode();
  setPracticeModeSilent("callfold");
  renderPracticeProblem(p);
  setPracticeModeSilent(savedMode);
  const area = document.getElementById("practice-area");
  if (area) area.insertAdjacentHTML("afterbegin", tutorialProgressHtml(getTutorialStep()));
}

export function advanceTutorial(): void {
  setTutorialStep(getTutorialStep() + 1);
  if (getTutorialStep() >= TUTORIAL_PROBLEMS.length) {
    finishTutorial();
  } else {
    renderTutorialNarrationStep();
  }
}

export function finishTutorial(): void {
  markTutorialDone();
  setTutorialActive(false);
  setCurrentProblem(null);
  setPracticeActionsTopVisible(true);
  const area = document.getElementById("practice-area");
  if (!area) return;
  area.innerHTML = `
    <div class="tutorial-complete-card">
      <div class="tutorial-complete-title">${t("practice.tutorial.completeTitle")}</div>
      <div class="tutorial-complete-sub">${t("practice.tutorial.completeSub")}</div>
      <ol class="tutorial-complete-list">
        ${TUTORIAL_PROBLEMS.map(
          (d, i) => `<li><strong>${i + 1}. ${d.title}</strong><br>${d.lesson}</li>`,
        ).join("")}
      </ol>
      <button id="tutorial-goto-practice-btn" type="button" class="solve-btn">${t("practice.tutorial.completeBtn")}</button>
    </div>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function startTutorial(): void {
  setTutorialActive(true);
  setTutorialStep(0);
  setCurrentProblem(null);
  renderTutorialNarrationStep();
}
