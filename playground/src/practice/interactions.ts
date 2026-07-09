import type { Difficulty, PracticeMode } from "./types.js";
import {
  generatePracticeProblem,
  getPracticeMode,
  setPracticeMode,
  getPracticeDifficulty,
  setPracticeDifficulty,
} from "./generate.js";
import { renderPracticeProblem, getCurrentProblem, setCurrentProblem, updatePracticeHint } from "./render.js";
import { judgePractice, judgePracticeRP, updatePracticeBadges } from "./judge.js";
import { updatePracticeProgress } from "./progress.js";
import {
  isTutorialActive,
  setTutorialActive,
  setTutorialSkippedSession,
} from "./tutorialState.js";
import { startTutorial, advanceTutorial, renderTutorialProblemStep } from "./tutorial.js";
import { players, allocPlayerId } from "../appState.js";
import { nashSbInput, nashBbInput, nashAnteInput } from "../domRefs.js";
import { renderPlayers, setPayouts } from "../setup.js";
import { recompute, setCallManualOverride } from "../calculator.js";
import { applyTab } from "../tabs.js";

/** 練習タブのボタン配線・クリック委譲。main.ts から一度だけ呼ぶ。 */
export function initPracticeInteractions(): void {
  const practiceNewBtn = document.getElementById("practice-new-btn");
  practiceNewBtn?.addEventListener("click", () => {
    if (isTutorialActive()) setTutorialActive(false); // 導入コース中に離脱したら中断扱い
    const p = generatePracticeProblem();
    setCurrentProblem(p);
    renderPracticeProblem(p);
  });

  updatePracticeHint();

  // モード切替 (call/fold 判定 ⇄ RP 当て)
  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    if (btn.dataset.mode === getPracticeMode()) {
      document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => {
      if (btn.dataset.mode === getPracticeMode()) return;
      document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      setPracticeMode(btn.dataset.mode as PracticeMode);
      updatePracticeHint();
      if (isTutorialActive()) setTutorialActive(false); // 導入コース中に離脱したら中断扱い
      // モードを変えたら新しい問題を出題
      const p = generatePracticeProblem();
      setCurrentProblem(p);
      renderPracticeProblem(p);
    });
  });

  // 難易度切替
  document.querySelectorAll<HTMLButtonElement>(".diff-btn").forEach((btn) => {
    if (btn.dataset.diff === getPracticeDifficulty()) {
      document.querySelectorAll<HTMLButtonElement>(".diff-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => {
      document.querySelectorAll<HTMLButtonElement>(".diff-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      setPracticeDifficulty(btn.dataset.diff as Difficulty);
      // 難易度変更は出題中の問題の見た目 (許容誤差表示・スライダー⇄4択など) に影響するため、
      // モード切替と同様に新しい問題を生成して再描画する (チュートリアル中は問題構成が
      // 固定なので対象外)。
      if (!isTutorialActive()) {
        const p = generatePracticeProblem();
        setCurrentProblem(p);
        renderPracticeProblem(p);
      }
    });
  });

  // 起動時にバッジ更新
  updatePracticeBadges();
  updatePracticeProgress();

  document.getElementById("practice-area")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    // 次の問題ボタン (フィードバック内・下部 / 上部どちらも同じ挙動)
    if (target.closest("#practice-next-btn") || target.closest("#practice-next-btn-top")) {
      if (isTutorialActive()) {
        advanceTutorial();
      } else {
        const p = generatePracticeProblem();
        setCurrentProblem(p);
        renderPracticeProblem(p);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // RP 当てモードの回答ボタン (Normal/Hard: スライダー)
    if (target.closest("#rp-answer-btn")) {
      const slider = document.getElementById("rp-slider") as HTMLInputElement | null;
      if (slider) judgePracticeRP(Number(slider.value));
      return;
    }
    // RP 当てモードの4択ボタン (Easy)
    const choiceBtn = target.closest<HTMLButtonElement>(".rp-choice-btn");
    if (choiceBtn) {
      if (choiceBtn.disabled) return;
      judgePracticeRP(Number(choiceBtn.dataset.value));
      return;
    }
    // 取り込みボタン (チュートリアル中は CSS で非表示だが念のためガード)
    if (target.closest("#practice-apply-btn")) {
      if (isTutorialActive()) return;
      const p = getCurrentProblem();
      if (!p) return;
      players.length = 0;
      for (const sp of p.scenarioPlayers) {
        players.push({
          id: allocPlayerId(),
          stack: sp.stack,
          role: sp.role,
          position: sp.position,
        });
      }
      renderPlayers();
      setPayouts(p.payouts);
      nashSbInput.value = String(p.sb);
      nashBbInput.value = String(p.bb);
      nashAnteInput.value = String(p.totalAnte);
      setCallManualOverride(false);
      recompute();
      applyTab("setup");
      return;
    }
    // call / fold ボタン
    const btn = target.closest<HTMLButtonElement>(".practice-btn");
    if (!btn) return;
    const ans = btn.dataset.answer as "call" | "fold" | undefined;
    if (ans) judgePractice(ans);
  });

  document.getElementById("practice-tutorial-btn")?.addEventListener("click", () => {
    startTutorial();
  });

  // チュートリアル専用の各種ボタンの委譲ハンドラ (既存の #practice-area クリックハンドラとは別に登録)
  document.getElementById("practice-area")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("#tutorial-intro-start-btn")) {
      startTutorial();
      return;
    }
    if (target.closest("#tutorial-intro-skip-btn")) {
      setTutorialSkippedSession(true);
      const p = generatePracticeProblem();
      setCurrentProblem(p);
      renderPracticeProblem(p);
      return;
    }
    if (target.closest("#tutorial-start-problem-btn")) {
      renderTutorialProblemStep();
      return;
    }
    if (target.closest("#tutorial-next-btn")) {
      advanceTutorial();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (target.closest("#tutorial-goto-practice-btn")) {
      const p = generatePracticeProblem();
      setCurrentProblem(p);
      renderPracticeProblem(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  });
}
