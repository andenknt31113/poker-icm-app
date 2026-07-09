import { DEFAULT_SB, DEFAULT_BB, DEFAULT_ANTE } from "../appState.js";
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
    title: "チップ＝賞金の世界",
    narration:
      "全員が同じ賞金を狙う一発勝負 (Winner Take All)。ここではチップ＝そのまま賞金です。",
    lesson:
      "WTA では順位という概念がなく、勝率がそのまま賞金期待値に直結します。だから Risk Premium はゼロ。cEV（チップ的な必要勝率）だけで判断できる、ICM プレッシャーが存在しない最もシンプルなケースです。",
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
    title: "相手をカバーしている",
    narration:
      "相手のスタックはあなたより少ない。もし負けても、あなたはまだトーナメントに残ります。",
    lesson:
      "自分が相手をカバーしている（負けても飛ばない）ときは、Risk Premium は小さめ。cEV に近い感覚でコールして大丈夫です。ICM プレッシャーは『自分が飛ぶリスク』があるときに強く働きます。",
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
    title: "バブルの罠",
    narration:
      "あなたは4人残りの3番手。チップリーダーがオールイン。ハンドは悪くない…がこれはワナかもしれない。",
    lesson:
      "チップの上ではコールが得（cEV的には+EV）でも、厳密な ICM で計算すると必要勝率が跳ね上がり、フォールドが正解になることがあります。これが『ICM プレッシャー』の正体。飛べば賞金の可能性が消える一方、生き残れば上位の賞金が保証されるため、コールのリスクは額面以上に重いのです。",
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
    title: "短スタックを待て",
    narration:
      "卓にはあなたよりずっと短いスタックの選手がいます。相手のオールインはギリギリ微妙なラインです。",
    lesson:
      "自分より短いスタックが残っている間は、その選手が先に飛んでくれれば自動的に順位が上がります。無理にコールしなくても得られる価値がある以上、微妙なラインはフォールド優位になりがちです。",
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
    title: "サテライトの掟",
    narration:
      "上位がほぼ均等に賞金を得るサテライト。生き残ることそのものが目的です。AKs のような好ハンドでも、一度考え直しましょう。",
    lesson:
      "賞金がほぼ均等なサテライトでは、順位を1つ落とすことの価値がとても大きく、勝っても得られる価値はわずかです。そのため Risk Premium が極端に跳ね上がり、AKs や QQ 級の強いハンドでもフォールドが正解になることが多いのです。『残ること』が全てを支配します。",
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
