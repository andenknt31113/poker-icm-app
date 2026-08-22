import { generatePracticeProblem } from "./practice/generate.js";
import { renderPracticeProblem, getCurrentProblem, setCurrentProblem } from "./practice/render.js";
import { updatePracticeProgress } from "./practice/progress.js";
import { isTutorialActive, isTutorialDone, isTutorialSkippedSession } from "./practice/tutorialState.js";
import { renderTutorialNarrationStep, renderTutorialIntroCard } from "./practice/tutorial.js";
import { STORAGE_KEYS, readRaw, writeRaw } from "./storage.js";

// ===== タブナビ =====
//
// タブ ID の単一情報源。この配列が
//   - TabId 型
//   - 保存値の検証 (isTabId)
//   - スワイプジェスチャーの並び順 (index ± 1 で隣のタブへ)
// をすべて兼ねる。表示順は index.html の .tab-btn の並びと一致させること。
export const TAB_IDS = ["setup", "analyze", "practice"] as const;
export type TabId = (typeof TAB_IDS)[number];

const DEFAULT_TAB: TabId = "setup";

// 旧5タブ構成 (result/hand/nash) の保存値は分析タブへ読み替える
// (既存ユーザーの localStorage との互換)。
const LEGACY_TAB_MAP: Record<string, TabId> = {
  result: "analyze",
  hand: "analyze",
  nash: "analyze",
};

function isTabId(v: unknown): v is TabId {
  return typeof v === "string" && (TAB_IDS as readonly string[]).includes(v);
}

const savedTabRaw = readRaw(STORAGE_KEYS.activeTab);
const savedTab = (savedTabRaw && LEGACY_TAB_MAP[savedTabRaw]) || savedTabRaw;
let activeTab: TabId = isTabId(savedTab) ? savedTab : DEFAULT_TAB;

export function getActiveTab(): TabId {
  return activeTab;
}

export function applyTab(tab: TabId): void {
  activeTab = tab;
  writeRaw(STORAGE_KEYS.activeTab, tab);
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

  // 分析タブ先頭のセクションジャンプ (計算結果 / レンジ比較 / Nash)。
  // 分析は3画面ぶんの縦フローなので、目的セクションへ1タップで飛べるようにする。
  document.querySelectorAll<HTMLButtonElement>(".analyze-jump [data-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.jump;
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
  });

  // ===== タブ切替のスワイプ ジェスチャー =====
  const TABS = TAB_IDS;
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
