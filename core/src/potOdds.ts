/**
 * プッシュ＆コール局面の pot / call / dead money を一元計算する。
 *
 * 想定シナリオ:
 *   - villain (pusher) が all-in
 *   - hero (caller) が call または fold を判断
 *   - blinds (sb / bb) と ante を pot に正しく反映
 *   - ante は BB ante 構造 (BB が全額負担、常に dead money) を仮定
 *
 * 「dead money」の定義:
 *   action に参加していない player の blind (= 既に出していて回収不可)
 *   と BB ante。pot at showdown には含まれるが、誰の commit でもない。
 *
 * 「matched」の定義:
 *   hero と villain それぞれが pot に出す chips の最大マッチ量 (ante 別)
 *   = min(heroLiveContribMax, villainLiveContribMax)
 *   live = ante を引いた "blind と call に使える" 残高
 *
 * cEV は「call vs fold」を比較するため、blind+ante は両者とも sunk になり
 * potIfWin = pot − callAmount に既出 blind が含まれる。
 */

export type PotOddsPosition = "SB" | "BB" | "OTHER";

export interface PotOddsInput {
  /** hero (caller) の hand 開始時 stack。 */
  readonly heroStack: number;
  /** villain (pusher) の hand 開始時 stack。 */
  readonly villainStack: number;
  /** hero のポジション (SB / BB / その他)。 */
  readonly heroPosition: PotOddsPosition;
  /** villain のポジション (SB / BB / その他)。 */
  readonly villainPosition: PotOddsPosition;
  /** SB blind 額。 */
  readonly sb: number;
  /** BB blind 額。 */
  readonly bb: number;
  /** ante 合計 (BB ante 構造のため BB が全額負担)。 */
  readonly ante: number;
}

export interface PotOddsResult {
  /** hero が追加で支払う call 額 (既出 blind は控除済)。 */
  readonly callAmount: number;
  /** call して勝ったときに獲得する純利得 (= pot − callAmount)。 */
  readonly potIfWin: number;
  /** showdown 時の pot 合計。 */
  readonly potAtShowdown: number;
  /** hero / villain それぞれが pot に入れる matched chips (ante 別)。 */
  readonly matched: number;
  /** dead money 内訳 (action に参加していない blind + ante)。 */
  readonly deadBreakdown: {
    readonly sbDead: number;
    readonly bbDead: number;
    readonly anteDead: number;
  };
  /** dead money 合計。 */
  readonly totalDead: number;
  /** hero の既出 commit (live; ante は含まない blind 部分)。 */
  readonly heroLiveCommit: number;
  /** villain の既出 commit (live; ante は含まない blind 部分)。 */
  readonly villainLiveCommit: number;
}

/** position → 既出 blind 額 (ante 抜き)。 */
function liveCommit(pos: PotOddsPosition, sb: number, bb: number): number {
  if (pos === "SB") return sb;
  if (pos === "BB") return bb;
  return 0;
}

/**
 * BB ante 構造前提で pot odds を計算する。
 *
 * 主要ルール:
 *   - BB が ante 全額を払う → BB の live stack = stack − ante
 *   - SB / BB 以外の player は live = stack
 *   - SB が action に居ない → SB blind は dead
 *   - BB が action に居ない → BB blind は dead
 *   - ante は常に dead (BB の bet 扱いではない)
 *   - matched = min(heroLive, villainLive)
 *   - callAmount = matched − heroLiveCommit (最低 0.01 にクランプ)
 *   - pot = heroLiveContrib + villainLiveContrib + dead
 *         = 2 × matched + dead
 *   - potIfWin = pot − callAmount
 */
export function calculatePotOdds(input: PotOddsInput): PotOddsResult {
  const { heroStack, villainStack, heroPosition, villainPosition, sb, bb, ante } = input;

  if (!Number.isFinite(heroStack) || heroStack <= 0) {
    throw new Error(`PotOdds: heroStack が不正です: ${heroStack}`);
  }
  if (!Number.isFinite(villainStack) || villainStack <= 0) {
    throw new Error(`PotOdds: villainStack が不正です: ${villainStack}`);
  }
  if (sb < 0 || bb < 0 || ante < 0) {
    throw new Error(`PotOdds: blind/ante は非負である必要があります`);
  }

  // BB ante 構造: BB が ante 全額を払う
  const heroAntePaid = heroPosition === "BB" ? ante : 0;
  const villainAntePaid = villainPosition === "BB" ? ante : 0;

  const heroLive = heroStack - heroAntePaid;
  const villainLive = villainStack - villainAntePaid;
  const matched = Math.min(heroLive, villainLive);

  const heroLiveCommit = liveCommit(heroPosition, sb, bb);
  const villainLiveCommit = liveCommit(villainPosition, sb, bb);

  const sbInAction = heroPosition === "SB" || villainPosition === "SB";
  const bbInAction = heroPosition === "BB" || villainPosition === "BB";
  const sbDead = sbInAction ? 0 : sb;
  const bbDead = bbInAction ? 0 : bb;
  const anteDead = ante;
  const totalDead = sbDead + bbDead + anteDead;

  const potAtShowdown = 2 * matched + totalDead;
  const callAmount = Math.max(0.01, matched - heroLiveCommit);
  const potIfWin = potAtShowdown - callAmount;

  return {
    callAmount,
    potIfWin,
    potAtShowdown,
    matched,
    deadBreakdown: { sbDead, bbDead, anteDead },
    totalDead,
    heroLiveCommit,
    villainLiveCommit,
  };
}
