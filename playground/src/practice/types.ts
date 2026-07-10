import type { Role, Position } from "../appState.js";
import type { HandNotation } from "../handRanking.js";

// ===== 練習問題モード =====
// PracticeProblem のうち「問題そのもの」を定義する部分。
// localStorage の復習リストにもこの形のまま保存される (スキーマ不変)。

/** 練習モード: call/fold 判定 か RP 当て か push 判定 か */
export type PracticeMode = "callfold" | "rp" | "push";
export type Difficulty = "easy" | "normal" | "hard";

export interface PracticeProblemBase {
  scenarioPlayers: { stack: number; role: Role; position: Position }[];
  payouts: number[];
  sb: number;
  bb: number;
  totalAnte: number;
  villainCallRangePct: number;
  heroHand: HandNotation;
  /** 不正解時にどのモードで出題されたか (復習の再出題で使用)。旧データは undefined = callfold 扱い。 */
  savedMode?: PracticeMode;
}

// PracticeProblemBase から一意に計算できる派生値。
// 既存の復習リスト (旧スキーマ) にはこれらの値が古い形式で入っている、
// または一部が欠けているため、使用前に必ず computeDerivedFields() で
// base フィールドから再計算し直す (ensureDerivedFields 参照)。
export interface PracticeProblemDerived {
  // 判定用: cEV は近似/厳密で共通、dollarEV は厳密 ICM 必要勝率 (call/fold の正解基準)
  cEV: number;
  dollarEV: number;
  heroEq: number; // hero hand vs villain push range
  // 参考値: BF 線形化近似 (旧ロジック)。教育目的で「詳しい計算式」に表示する。
  bf: number;
  dollarEVApprox: number;
  bfEquityNow: number;
  bfEquityWin: number;
  bfEquityLose: number;
  // 厳密 ICM の3終端 (fold / call-win / call-lose) の hero エクイティ + 全員スタック
  equityFold: number;
  equityWin: number;
  equityLose: number;
  stacksFold: number[];
  stacksWin: number[];
  stacksLose: number[];
  callAmount: number;
  potIfWin: number;

  // ===== push 判定モード専用の派生値 =====
  // hero=SB が villain=BB に対し push するかどうかの厳密 ICM 判定
  // (core/src/pushDecision.ts の evaluatePushDecision に対応)。
  // callfold/rp モードの問題には存在しない (undefined のまま)。上の
  // 汎用フィールド (cEV/dollarEV/heroEq 等) は push モードでは意味を持たない
  // プレースホルダ値 (0) が入るだけで、判定/表示には使わない。
  /** push した場合の hero $EV (ICM)。 */
  pushEvPush?: number;
  /** push せず fold した場合の hero $EV (ICM)。 */
  pushEvFold?: number;
  pushEquityFold?: number;
  pushEquitySteal?: number;
  pushEquityWin?: number;
  pushEquityLose?: number;
  pushStacksFold?: number[];
  pushStacksSteal?: number[];
  pushStacksWin?: number[];
  pushStacksLose?: number[];
  /** 正解 (push すべきか)。 */
  pushShouldPush?: boolean;
  /** villain がコールしてくる確率 (0..1, コンボ重み比)。 */
  pushPCall?: number;
  /** villain のコールレンジに対する hero equity (0..1)。 */
  pushEqVsCallRange?: number;
  /** (evPush − evFold) を賞金プール総額で正規化したマージン (難易度バンド判定用)。 */
  pushMarginNorm?: number;
  /** push→call 時の matched chips (BB 単位、表示用)。 */
  pushMatched?: number;
  /** push→call 時の showdown pot (BB 単位、表示用)。 */
  pushPot?: number;
}

export type PracticeProblem = PracticeProblemBase & PracticeProblemDerived;
