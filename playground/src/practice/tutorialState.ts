import { DEFAULT_SB, DEFAULT_BB, DEFAULT_ANTE } from "../appState.js";
import { t } from "../i18n.js";
import type { PracticeProblemBase } from "./types.js";

// ===== 🎓 導入コース (固定5問チュートリアル) =====
// 初心者が ICM の核心を5問で体感する固定カリキュラム。
// スコア/streak/復習リストには一切記録しない (recordPracticeResult を呼ばない)。
const TUTORIAL_DONE_KEY = "poker-icm-tutorial-done";

export interface TutorialProblemDef {
  title: string;
  narration: string;
  lesson: string;
  base: PracticeProblemBase;
}

// 各問題のパラメータは core の厳密 ICM 計算 (calculateExactCallEquity) で
// 事前検証済み (report 参照)。以下はその検証結果:
//   Q1: margin(heroEq-厳密必要勝率) = +16.8% (明確なコール, RP=0)
//   Q2: RP = +2.35%, margin = +12.8% (小さい RP でも明確なコール)
//   Q3: cEV必要勝率(44.1%) < heroEq(53.6%) < 厳密必要勝率(63.4%) ← ICMプレッシャーの核心
//   Q4: margin = -3.2% (わずかにフォールド)
//   Q5: margin = -12.4% (AKs でも大きくフォールド)
export const TUTORIAL_PROBLEMS: TutorialProblemDef[] = [
  {
    title: t("practice.tutorial.q1.title"),
    narration: t("practice.tutorial.q1.narration"),
    lesson: t("practice.tutorial.q1.lesson"),
    base: {
      scenarioPlayers: [
        { stack: 20, role: "hero", position: "BB" },
        { stack: 15, role: "villain", position: "BTN" },
        { stack: 25, role: "other", position: "SB" },
      ],
      payouts: [100],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 50,
      heroHand: "AQo",
    },
  },
  {
    title: t("practice.tutorial.q2.title"),
    narration: t("practice.tutorial.q2.narration"),
    lesson: t("practice.tutorial.q2.lesson"),
    base: {
      scenarioPlayers: [
        { stack: 30, role: "hero", position: "BB" },
        { stack: 12, role: "villain", position: "BTN" },
        { stack: 20, role: "other", position: "SB" },
      ],
      payouts: [50, 30, 20],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 40,
      heroHand: "AJo",
    },
  },
  {
    title: t("practice.tutorial.q3.title"),
    narration: t("practice.tutorial.q3.narration"),
    lesson: t("practice.tutorial.q3.lesson"),
    base: {
      scenarioPlayers: [
        { stack: 15, role: "hero", position: "BB" },
        { stack: 22, role: "villain", position: "BTN" },
        { stack: 10, role: "other", position: "SB" },
        { stack: 18, role: "other", position: "CO" },
      ],
      payouts: [50, 30, 20],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 40,
      heroHand: "A9o",
    },
  },
  {
    title: t("practice.tutorial.q4.title"),
    narration: t("practice.tutorial.q4.narration"),
    lesson: t("practice.tutorial.q4.lesson"),
    base: {
      scenarioPlayers: [
        { stack: 18, role: "hero", position: "BB" },
        { stack: 20, role: "villain", position: "BTN" },
        { stack: 7, role: "other", position: "SB" },
        { stack: 25, role: "other", position: "CO" },
      ],
      payouts: [50, 30, 20],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 30,
      heroHand: "AKo",
    },
  },
  {
    title: t("practice.tutorial.q5.title"),
    narration: t("practice.tutorial.q5.narration"),
    lesson: t("practice.tutorial.q5.lesson"),
    base: {
      scenarioPlayers: [
        { stack: 18, role: "hero", position: "BB" },
        { stack: 20, role: "villain", position: "BTN" },
        { stack: 16, role: "other", position: "SB" },
        { stack: 20, role: "other", position: "CO" },
      ],
      payouts: [33.4, 33.3, 33.3],
      sb: DEFAULT_SB,
      bb: DEFAULT_BB,
      totalAnte: DEFAULT_ANTE,
      villainCallRangePct: 15,
      heroHand: "AKs",
    },
  },
];

let tutorialActive = false;
let tutorialStep = 0;
// このセッション中に「スキップ」した場合のみ true。tutorial-done は立てないので
// 次回訪問時はまた案内カードが出る。
let tutorialSkippedSession = false;

export function isTutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isTutorialActive(): boolean {
  return tutorialActive;
}

export function setTutorialActive(v: boolean): void {
  tutorialActive = v;
  document.body.classList.toggle("tutorial-active", v);
}

export function getTutorialStep(): number {
  return tutorialStep;
}

export function setTutorialStep(v: number): void {
  tutorialStep = v;
}

export function isTutorialSkippedSession(): boolean {
  return tutorialSkippedSession;
}

export function setTutorialSkippedSession(v: boolean): void {
  tutorialSkippedSession = v;
}
