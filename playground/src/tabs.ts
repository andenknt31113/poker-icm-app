import { generatePracticeProblem } from "./practice/generate.js";
import { renderPracticeProblem, getCurrentProblem, setCurrentProblem } from "./practice/render.js";
import { updatePracticeProgress } from "./practice/progress.js";
import { isTutorialActive, isTutorialDone, isTutorialSkippedSession } from "./practice/tutorialState.js";
import { renderTutorialNarrationStep, renderTutorialIntroCard } from "./practice/tutorial.js";

// ===== タブナビ =====
export type TabId = "setup" | "result" | "hand" | "nash" | "practice";
const TAB_KEY = "poker-icm-active-tab";
let activeTab: TabId = "setup";
try {
  const saved = localStorage.getItem(TAB_KEY) as TabId | null;
  if (saved && ["setup", "result", "hand", "nash", "practice"].includes(saved)) {
    activeTab = saved;
  }
} catch {
  /* ignore */
}

export function getActiveTab(): TabId {
  return activeTab;
}

export function applyTab(tab: TabId): void {
  activeTab = tab;
  try { localStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ }
  document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll<HTMLElement>("[data-tab]").forEach((el) => {
    if (el.classList.contains("tab-btn")) return; // ボタン自体は対象外
    el.classList.toggle("hidden-tab", el.dataset.tab !== tab);
  });
  // 練習タブ中は Hero サマリーを隠す（メイン画面の状態と無関係なので邪魔）
  const heroSum = document.getElementById("hero-summary");
  if (heroSum) {
    if (tab === "practice") {
      heroSum.style.display = "none";
    } else {
      heroSum.style.display = ""; // CSS の .active 制御に戻す
    }
  }
  // 練習タブ表示時に成績の推移パネルを更新
  if (tab === "practice") updatePracticeProgress();
  // 練習タブを開いたとき、まだ問題が無ければ自動出題する
  // (オンボーディングの「練習を始める」CTA や、前回タブが練習で復元された場合も含む)
  // ただし初回 (導入コース未修了・このセッションでスキップもしていない) は
  // ランダム出題の代わりに導入コースの案内カードを出す。チュートリアル進行中に
  // タブ移動で中断された場合は、現在のステップのナレーションからやり直す。
  if (tab === "practice" && !getCurrentProblem()) {
    if (isTutorialActive()) {
      renderTutorialNarrationStep();
    } else if (!isTutorialDone() && !isTutorialSkippedSession()) {
      renderTutorialIntroCard();
    } else {
      const p = generatePracticeProblem();
      setCurrentProblem(p);
      renderPracticeProblem(p);
    }
  }
  // ハンド or Nash タブ初表示時にスムーズトップ
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** タブバー・スワイプジェスチャーの配線。main.ts から一度だけ呼ぶ。 */
export function initTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.tab as TabId | undefined;
      if (t) applyTab(t);
    });
  });

  // ===== タブ切替のスワイプ ジェスチャー =====
  const TABS: TabId[] = ["setup", "result", "hand", "nash", "practice"];
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartT = 0;
  const SWIPE_MIN_DX = 60;
  const SWIPE_MAX_DY = 50;
  const SWIPE_MAX_T = 600;

  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    // タブバーや入力要素上のスワイプは無視
    const target = e.target as HTMLElement;
    if (
      target.closest(".tab-bar") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest(".hand-grid") ||
      target.closest(".bf-matrix")
    ) {
      touchStartT = 0;
      return;
    }
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartT = Date.now();
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (touchStartT === 0) return;
    const dt = Date.now() - touchStartT;
    if (dt > SWIPE_MAX_T) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_MIN_DX) return;
    if (Math.abs(dy) > SWIPE_MAX_DY) return;
    const idx = TABS.indexOf(activeTab);
    if (dx < 0 && idx < TABS.length - 1) applyTab(TABS[idx + 1]!);
    if (dx > 0 && idx > 0) applyTab(TABS[idx - 1]!);
  }, { passive: true });
}
