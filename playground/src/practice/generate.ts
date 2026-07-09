import {
  calculateBubbleFactor,
  calculatePotOdds,
  calculateExactCallEquity,
  calculateRequiredEquity,
} from "@poker-icm/core";
import { ALL_169_HANDS, topRange, type HandNotation } from "../handRanking.js";
import { equity } from "../equity.js";
import {
  type Role,
  type Position,
  DEFAULT_SB,
  DEFAULT_BB,
  DEFAULT_ANTE,
  posToPotOddsPos,
} from "../appState.js";
import type {
  PracticeProblem,
  PracticeProblemBase,
  PracticeProblemDerived,
  PracticeMode,
  Difficulty,
} from "./types.js";

/**
 * PracticeProblemBase から判定/表示に必要な派生値をすべて計算する。
 * generateRandomPracticeProblem() の本体でもあり、
 * 復習リストなど旧スキーマの問題を読み込んだ際の再計算にも使う
 * (ensureDerivedFields 参照)。
 */
export function computeDerivedFields(base: PracticeProblemBase): PracticeProblemDerived {
  const { scenarioPlayers, payouts, sb, bb, totalAnte, villainCallRangePct, heroHand } = base;
  const heroIdx = scenarioPlayers.findIndex((p) => p.role === "hero");
  const villainIdx = scenarioPlayers.findIndex((p) => p.role === "villain");
  const sbIdx = scenarioPlayers.findIndex((p) => p.position === "SB");
  const stacks = scenarioPlayers.map((p) => p.stack);
  const villainPos = scenarioPlayers[villainIdx]!.position;

  // BF 近似 (参考値: 実効スタックの対称フリップ → 線形化)
  const safeRisk = Math.min(stacks[heroIdx]!, stacks[villainIdx]!);
  const bfResult = calculateBubbleFactor({
    stacks,
    payouts,
    heroIndex: heroIdx,
    villainIndex: villainIdx,
    riskChips: safeRisk,
  });
  const podds = calculatePotOdds({
    heroStack: stacks[heroIdx]!,
    villainStack: stacks[villainIdx]!,
    heroPosition: "BB", // 練習問題では hero は常に BB
    villainPosition: posToPotOddsPos(villainPos),
    sb, bb, ante: totalAnte,
  });
  const callAmount = podds.callAmount;
  const potIfWin = podds.potIfWin;
  const approxEq = calculateRequiredEquity({
    callAmount,
    potIfWin,
    bubbleFactor: bfResult.bf,
  });

  // 厳密 ICM (fold / call-win / call-lose の3終端を直接解く)
  const exact = calculateExactCallEquity({
    stacks,
    payouts,
    heroIndex: heroIdx,
    villainIndex: villainIdx,
    heroPosition: "BB",
    villainPosition: posToPotOddsPos(villainPos),
    sbPlayerIndex: sbIdx >= 0 ? sbIdx : undefined,
    sb, bb, ante: totalAnte,
  });

  // hero hand equity vs villain push range (Top X%)
  const villainRange = topRange(villainCallRangePct);
  const heroEq = equity(heroHand, villainRange);

  return {
    cEV: approxEq.cEV,
    dollarEV: exact.requiredEquity,
    heroEq,
    bf: bfResult.bf,
    dollarEVApprox: approxEq.dollarEV,
    bfEquityNow: bfResult.equityNow,
    bfEquityWin: bfResult.equityWin,
    bfEquityLose: bfResult.equityLose,
    equityFold: exact.equityFold,
    equityWin: exact.equityWin,
    equityLose: exact.equityLose,
    stacksFold: exact.stacksFold.slice(),
    stacksWin: exact.stacksWin.slice(),
    stacksLose: exact.stacksLose.slice(),
    callAmount,
    potIfWin,
  };
}

/**
 * 復習リストなど旧スキーマ (厳密 ICM 導入前) の PracticeProblem を読み込んだ場合、
 * 新フィールド (equityFold 等) が欠けているため base フィールドから再計算して補う。
 * 新スキーマの問題はそのまま返す (無駄な再計算をしない)。
 */
export function ensureDerivedFields(p: PracticeProblem): PracticeProblem {
  if (
    p.equityFold !== undefined &&
    p.dollarEVApprox !== undefined &&
    p.bfEquityNow !== undefined &&
    p.stacksFold !== undefined
  ) {
    return p;
  }
  return { ...p, ...computeDerivedFields(p) };
}

const POSITION_SETS_PRACTICE: Record<number, Position[]> = {
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "CO"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
};

const PAYOUT_TEMPLATES = [
  [50, 30, 20],
  [40, 25, 15, 10, 5, 3, 2],
  [100],
  [33, 33, 33], // satellite
  [60, 40],
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const DIFF_BANDS: Record<Difficulty, number> = {
  easy: 0.10,
  normal: 0.05,
  hard: 0.02,
};
let practiceDifficulty: Difficulty = "normal";
try {
  const v = localStorage.getItem("poker-icm-practice-diff") as Difficulty | null;
  if (v && (v === "easy" || v === "normal" || v === "hard")) practiceDifficulty = v;
} catch { /* ignore */ }

export function getPracticeDifficulty(): Difficulty {
  return practiceDifficulty;
}
export function setPracticeDifficulty(d: Difficulty): void {
  practiceDifficulty = d;
  try { localStorage.setItem("poker-icm-practice-diff", practiceDifficulty); } catch { /* ignore */ }
}

// RP モードのスライダー回答の許容誤差 (±%)
export const RP_TOLERANCE: Record<Difficulty, number> = {
  easy: 4,
  normal: 2.5,
  hard: 1.5,
};
let practiceMode: PracticeMode = "callfold";
try {
  const v = localStorage.getItem("poker-icm-practice-mode") as PracticeMode | null;
  if (v === "callfold" || v === "rp") practiceMode = v;
} catch { /* ignore */ }

export function getPracticeMode(): PracticeMode {
  return practiceMode;
}
export function setPracticeMode(m: PracticeMode): void {
  practiceMode = m;
  try { localStorage.setItem("poker-icm-practice-mode", practiceMode); } catch { /* ignore */ }
}
/** localStorage に書かず、一時的にモードを差し替えるだけ (導入コースの固定 callfold 表示用)。 */
export function setPracticeModeSilent(m: PracticeMode): void {
  practiceMode = m;
}

// RP (Risk Premium) = $EV 必要勝率 − cEV 必要勝率
export function problemRP(p: PracticeProblem): number {
  return (p.dollarEV - p.cEV) * 100;
}

/**
 * 縮退問題の検出: 勝っても負けても $ エクイティがほぼ変わらない
 * (例: ほぼ均等ペイのサテライトで残り人数 = 入賞数 → 全員インマネ確定)。
 * 33.4/33.3/33.3 のような微差ペイでは差が厳密ゼロにならないため、
 * 「賞金プールの 0.5% 未満しか懸かっていない」を縮退とみなす相対判定にする。
 */
export function isDegenerateProblem(p: PracticeProblem): boolean {
  // 実際に賞金がかかるのは先頭 min(プレイヤー数, payouts数) 件のみ (ICM の numPlaces
  // と同じ規則)。payouts の方が要素数が多い場合 (例: 7人分ペイのテーブルを3人戦に
  // 流用) に余剰分まで合計してしまうと totalPayout が過大になり、縮退判定の
  // 閾値 (0.5%) が実質より緩くなってしまう。
  const numPlaces = Math.min(p.scenarioPlayers.length, p.payouts.length);
  const totalPayout = p.payouts.slice(0, numPlaces).reduce((a, b) => a + b, 0);
  return p.equityWin - p.equityLose < totalPayout * 0.005;
}

// generateRandomPracticeProblem() は ICM の丸め誤差等でごく稀に例外を投げ得る
// (core 側で大部分は修正済みだが、防御的に多重で守る)。試行ループの中で1回
// 例外が出ても、そのドローを捨てて次の乱数で再試行するだけにし、練習画面全体を
// クラッシュさせない。
function tryGenerateRandomPracticeProblem(): PracticeProblem | null {
  try {
    return generateRandomPracticeProblem();
  } catch (err) {
    console.warn("練習問題の生成に失敗しました。このドローを破棄します:", err);
    return null;
  }
}

export function generatePracticeProblem(): PracticeProblem {
  if (practiceMode === "rp") {
    // RP モード: 縮退問題を除外し、RP が自明に小さい問題と
    // スライダー上限 (50%) を超えて回答不能な問題も避ける
    for (let attempt = 0; attempt < 100; attempt++) {
      const p = tryGenerateRandomPracticeProblem();
      if (!p) continue;
      const rp = problemRP(p);
      if (!isDegenerateProblem(p) && rp >= 3 && rp <= 50) return p;
    }
    for (let attempt = 0; attempt < 20; attempt++) {
      const p = tryGenerateRandomPracticeProblem();
      if (p) return p;
    }
    throw new Error("練習問題の生成に失敗しました");
  }
  const band = DIFF_BANDS[practiceDifficulty];
  for (let attempt = 0; attempt < 100; attempt++) {
    const p = tryGenerateRandomPracticeProblem();
    if (!p) continue;
    if (!isDegenerateProblem(p) && Math.abs(p.heroEq - p.dollarEV) <= band) return p;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const p = tryGenerateRandomPracticeProblem();
    if (p) return p;
  }
  throw new Error("練習問題の生成に失敗しました");
}

export function generateRandomPracticeProblem(): PracticeProblem {
  const n = 3 + Math.floor(Math.random() * 4); // 3-6
  const positions = POSITION_SETS_PRACTICE[n]!;
  const scenarioPlayers: { stack: number; role: Role; position: Position }[] = [];
  for (let i = 0; i < n; i++) {
    scenarioPlayers.push({
      stack: 5 + Math.floor(Math.random() * 25), // 5-30 BB
      role: "other",
      position: positions[i] ?? "",
    });
  }
  // hero は常に BB (call 側 = 最後に行動するポジション)
  // POSITION_SETS の各サイズで BB は index 2 に配置されている
  const heroIdx = positions.indexOf("BB");
  // villain (push 側) は BB 以外からランダム選定
  let villainIdx = Math.floor(Math.random() * n);
  while (villainIdx === heroIdx) villainIdx = Math.floor(Math.random() * n);
  scenarioPlayers[heroIdx]!.role = "hero";
  scenarioPlayers[villainIdx]!.role = "villain";

  const payouts = pickRandom(PAYOUT_TEMPLATES);
  const sb = DEFAULT_SB;
  const bb = DEFAULT_BB;
  const totalAnte = DEFAULT_ANTE;
  const villainCallRangePct = 5 + Math.floor(Math.random() * 95); // 5-100%

  // 自分のハンド
  const heroHand = ALL_169_HANDS[Math.floor(Math.random() * ALL_169_HANDS.length)]!;

  const base: PracticeProblemBase = {
    scenarioPlayers,
    payouts,
    sb, bb, totalAnte,
    villainCallRangePct,
    heroHand,
  };
  return { ...base, ...computeDerivedFields(base) };
}

// Easy モード用: 正解 RP (0.5%単位に丸め) から重複なし・非負の4択を作りシャッフルする。
// 既定オフセットは 0 / +5 / -5 / +10。-5 が負になる場合は 0 / +5 / +10 / +15 に切り替える。
export function buildEasyRPChoices(correctRounded: number): number[] {
  const wouldGoNegative = correctRounded - 5 < 0;
  const offsets = wouldGoNegative ? [0, 5, 10, 15] : [0, 5, -5, 10];
  const values = offsets.map((o) => correctRounded + o);
  // Fisher-Yates シャッフル
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  return values;
}

// 復習リストの重複判定用キー。ハンド・相手コールレンジに加え、スタック構成
// (順序込み) と支払いテーブルも含めて正規化し、"似ているが別シナリオ" の問題を
// 誤って重複扱いしないようにする。savedMode (出題時のモード) も含めることで、
// 同じシナリオでも callfold と rp では別問題として扱う (旧データの undefined は
// "callfold" として正規化し、実際に callfold で保存された問題と衝突させる)。
export function practiceProblemDedupKey(p: PracticeProblemBase): string {
  const stacks = p.scenarioPlayers.map((sp) => `${sp.role}:${sp.position}:${sp.stack}`).join(",");
  const payouts = p.payouts.join(",");
  const mode = p.savedMode ?? "callfold";
  return `${p.heroHand}|${p.villainCallRangePct}|${stacks}|${payouts}|${mode}`;
}
