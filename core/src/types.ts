/**
 * 本パッケージで扱う型定義。
 * 計算コアは数値配列ベースで動くシンプルな関数群とし、
 * 上位（UI）でドメインモデル（Player など）に変換する想定。
 */

/** プレイヤーの順位別賞金（0-indexed: payouts[0] = 1位賞金）。 */
export type Payouts = readonly number[];

/** 各プレイヤーのスタック（チップ数）。順序は呼び出し側で固定する。 */
export type Stacks = readonly number[];

/** ICM計算結果。各プレイヤーの $ エクイティ（payouts と同単位）。 */
export type Equities = readonly number[];

/** Bubble Factor 計算の入力。 */
export interface BubbleFactorInput {
  readonly stacks: Stacks;
  readonly payouts: Payouts;
  readonly heroIndex: number;
  readonly villainIndex: number;
  /** リスクするチップ量。通常は all-in なら min(heroStack, villainStack)。 */
  readonly riskChips: number;
}

export interface BubbleFactorResult {
  /** Bubble Factor 本体。 */
  readonly bf: number;
  /** 現状の hero $ エクイティ。 */
  readonly equityNow: number;
  /** 勝った場合の hero $ エクイティ。 */
  readonly equityWin: number;
  /** 負けた場合の hero $ エクイティ。 */
  readonly equityLose: number;
}

/** 必要勝率計算の入力。すべて同じ単位（BB or チップ）で渡す。 */
export interface RequiredEquityInput {
  /** コールに必要な額。 */
  readonly callAmount: number;
  /** コールして勝ったときに得られる純利得（=既存ポット+相手のベット分）。 */
  readonly potIfWin: number;
  /** Bubble Factor。1.0 を渡すと cEV と一致。 */
  readonly bubbleFactor: number;
}

export interface RequiredEquityResult {
  /** cEV 必要勝率（0..1）。 */
  readonly cEV: number;
  /** $EV 必要勝率（0..1）。BF 反映済み。 */
  readonly dollarEV: number;
  /** Risk Premium（$EV − cEV）。 */
  readonly riskPremium: number;
}
