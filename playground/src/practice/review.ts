import type { PracticeProblem, PracticeMode } from "./types.js";
import { loadReviewList, saveReviewList } from "./store.js";
import {
  ensureDerivedFields,
  isDegenerateProblem,
  isDegeneratePushProblem,
  isPushProblem,
  getPracticeMode,
  setPracticeMode,
} from "./generate.js";
import { renderPracticeProblem, setCurrentProblem, updatePracticeHint } from "./render.js";
import { updatePracticeBadges } from "./judge.js";
import { isTutorialActive, setTutorialActive } from "./tutorialState.js";

/** 復習ボタンの配線。main.ts から一度だけ呼ぶ。 */
export function initReview(): void {
  document.getElementById("practice-review-btn")?.addEventListener("click", () => {
    if (isTutorialActive()) setTutorialActive(false); // 導入コース中に離脱したら中断扱い
    const list = loadReviewList();
    if (list.length === 0) {
      const area = document.getElementById("practice-area");
      if (area) area.innerHTML = `<div class="practice-info">まだ復習問題はありません。不正解の問題が自動で蓄積されます (最大50問)。</div>`;
      return;
    }
    // 先頭から取り出して再出題 (過去に保存された縮退問題はスキップして破棄)。
    // push 判定モードの問題は callfold/rp とは派生フィールドの意味が異なるため
    // (hero=SB, equityWin/equityLose は使わない placeholder 0)、専用の縮退判定
    // (isDegeneratePushProblem) を使う。ここを間違えると push の復習問題が
    // 「equityWin===equityLose===0 (未使用フィールド)」を縮退と誤検知し、
    // 復習リストから問題自体が失われてしまう。
    let next: PracticeProblem | null = null;
    while (list.length > 0) {
      const candidate = ensureDerivedFields(list.shift()!);
      const degenerate = isPushProblem(candidate)
        ? isDegeneratePushProblem(candidate)
        : isDegenerateProblem(candidate);
      if (!degenerate) { next = candidate; break; }
    }
    saveReviewList(list);
    if (!next) {
      const area = document.getElementById("practice-area");
      if (area) area.innerHTML = `<div class="practice-info">まだ復習問題はありません。不正解の問題が自動で蓄積されます (最大50問)。</div>`;
      updatePracticeBadges();
      return;
    }
    // 保存時のモードで再出題する (callfold で保存した問題が RP クイズとして
    // 出てしまうと、RP 用の出題フィルタを素通りした問題になるため)
    const targetMode: PracticeMode = next.savedMode ?? "callfold";
    if (getPracticeMode() !== targetMode) {
      setPracticeMode(targetMode);
      document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((b) =>
        b.classList.toggle("active", b.dataset.mode === getPracticeMode()),
      );
      updatePracticeHint();
    }
    setCurrentProblem(next);
    renderPracticeProblem(next);
    updatePracticeBadges();
  });
}
