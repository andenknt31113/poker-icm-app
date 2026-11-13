/**
 * push/fold の戦略一式を、実際のカードを配るシミュレーションで採点する。
 *
 * ソルバとは独立したコード: 勝率表を使わず、全員ぶんの実カードと 7 枚評価器で勝敗を決め、
 * サイドポット・同時に飛んだときの順位・降りたあとの続き (次の席が押すか降りるか) まで
 * そのまま再現して、ICM の賞金期待値で損得を出す。
 *
 * 出すもの: 各判断 (押す / コール / オーバーコール) について、「答えと逆の行動を取ると
 * 得をする分」を全ハンドぶん足したもの (= その戦略がどれだけ均衡から外れているか)。
 * 単位は賞金総額に対する % (1 ハンドあたり)。
 *
 * 使い方: 他のスクリプトから import して scoreStrategy() を呼ぶ。
 */
import { calculateICM } from "../../core/src/index.js";
import { evaluate7 } from "./_fastEval.mts";

const RANK_CHARS = "23456789TJQKA";

export interface Spot {
  /** 行動順 (最後が BB)。 */
  readonly positions: readonly string[];
  readonly stacks: readonly number[];
  readonly payouts: readonly number[];
  readonly sb: number;
  readonly bb: number;
}

/** 戦略一式。席は Spot の index。 */
export interface Strategy {
  /** push[a] = a が (全員降りて回ってきたとき) 押すレンジ。 */
  readonly push: readonly (ReadonlySet<string> | undefined)[];
  /** call[a][b] = a が押し、間の人が降りたとき b がコールするレンジ。 */
  readonly call: readonly (readonly (ReadonlySet<string> | undefined)[])[];
  /** overcall[a][b][c] = a が押し b がコールし、間の人が降りたとき c がコールするレンジ。 */
  readonly overcall: readonly (readonly (readonly (ReadonlySet<string> | undefined)[])[])[];
}

export interface RegretRow {
  readonly decision: string;
  /** 逆の行動で得をする分の合計 (賞金総額の %、1 ハンドあたり)。 */
  readonly regretPct: number;
  /** いちばん損の大きいハンド。 */
  readonly worst: string;
  /** その判断に到達する頻度。 */
  readonly reach: number;
}

function label(a: number, b: number): string {
  const ra = a >> 2;
  const rb = b >> 2;
  const hi = Math.max(ra, rb);
  const lo = Math.min(ra, rb);
  if (hi === lo) return RANK_CHARS[hi]! + RANK_CHARS[lo]!;
  return RANK_CHARS[hi]! + RANK_CHARS[lo]! + ((a & 3) === (b & 3) ? "s" : "o");
}

/** HRC の表記 ("22+ Ax K5s+ KTo+ A5s-A2s Kx+") を 169 ハンドの集合に展開する。 */
export function parseRange(spec: string): Set<string> {
  const R = "AKQJT98765432";
  const out = new Set<string>();
  for (const raw of spec.trim().split(/\s+/)) {
    if (!raw) continue;
    if (raw.includes("-")) {
      const [from, to] = raw.split("-") as [string, string];
      if (from.length === 2) {
        for (let i = R.indexOf(from[0]!); i <= R.indexOf(to[0]!); i++) out.add(R[i]! + R[i]!);
      } else {
        const hi = from[0]!;
        for (let i = R.indexOf(from[1]!); i <= R.indexOf(to[1]!); i++) out.add(hi + R[i]! + from[2]!);
      }
      continue;
    }
    const plus = raw.endsWith("+");
    const t = plus ? raw.slice(0, -1) : raw;
    if (t[1] === "x") {
      const top = R.indexOf(t[0]!);
      for (let hi = plus ? 0 : top; hi <= top; hi++) {
        for (let lo = hi + 1; lo < 13; lo++) {
          out.add(R[hi]! + R[lo]! + "s");
          out.add(R[hi]! + R[lo]! + "o");
        }
      }
      continue;
    }
    if (t.length === 2) {
      const i = R.indexOf(t[0]!);
      for (let k = plus ? 0 : i; k <= i; k++) out.add(R[k]! + R[k]!);
      continue;
    }
    const hi = R.indexOf(t[0]!);
    const lo = R.indexOf(t[1]!);
    for (let k = plus ? hi + 1 : lo; k <= lo; k++) out.add(R[hi]! + R[k]! + t[2]!);
  }
  return out;
}

export function scoreStrategy(spot: Spot, strategy: Strategy, trials: number, seed0 = 12345): RegretRow[] {
  const n = spot.stacks.length;
  const total = spot.payouts.reduce((a, b) => a + b, 0);
  const sbIdx = n === 2 ? 0 : n - 2;
  const bbIdx = n - 1;
  const blinds = spot.stacks.map((_, i) => (i === sbIdx ? spot.sb : i === bbIdx ? spot.bb : 0));

  let seed = seed0;
  const rnd = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const deck = new Int32Array(52);
  for (let i = 0; i < 52; i++) deck[i] = i;
  const need = 2 * n + 5;
  const hands: string[] = new Array(n).fill("");
  const scores = new Float64Array(n);
  const seven = new Int32Array(7);

  /** all-in した人たち (2〜3 人) の勝敗から最終スタックを作り、全員の $ を返す。 */
  function showdown(allIn: number[]): number[] {
    const final = spot.stacks.map((s, i) => s - blinds[i]!);
    // 降りた人の blind はポットに残る。all-in した人は blind を含めて全額を賭ける
    let dead = 0;
    for (let i = 0; i < n; i++) if (!allIn.includes(i)) dead += blinds[i]!;
    const lives = allIn.map((i) => spot.stacks[i]!);
    const order = allIn.map((_, k) => k).sort((x, y) => lives[x]! - lives[y]!);
    // 自分より大きい人がいない分は戻る
    const sortedLives = order.map((k) => lives[k]!);
    const cap = sortedLives.length >= 2 ? sortedLives[sortedLives.length - 2]! : sortedLives[0]!;
    for (const i of allIn) final[i] = spot.stacks[i]! - Math.min(spot.stacks[i]!, cap);
    // ポットを小さい方から層に分ける
    let prev = 0;
    let first = true;
    for (let level = 0; level < order.length; level++) {
      const lv = Math.min(sortedLives[level]!, cap);
      const eligible = order.slice(level).map((k) => allIn[k]!);
      let pot = (lv - prev) * eligible.length;
      if (first) {
        pot += dead;
        first = false;
      }
      prev = lv;
      if (pot <= 0 || eligible.length === 0) continue;
      let best = -1;
      for (const i of eligible) if (scores[i]! > best) best = scores[i]!;
      const winners = eligible.filter((i) => scores[i]! === best);
      for (const i of winners) final[i]! += pot / winners.length;
    }
    return prize(final);
  }

  /** 最終スタック → 全員の $。同時に飛んだ人は開始スタックの多い方が上の順位。 */
  function prize(final: number[]): number[] {
    const clipped = final.map((v) => (v < 1e-9 ? 0 : v));
    const icm = calculateICM(clipped, spot.payouts).slice();
    const busted: number[] = [];
    for (let i = 0; i < n; i++) if (clipped[i] === 0) busted.push(i);
    if (busted.length >= 2) {
      const alive = n - busted.length;
      busted.sort((a, b) => spot.stacks[b]! - spot.stacks[a]!);
      let place = alive;
      for (let i = 0; i < busted.length; ) {
        let j = i;
        while (j + 1 < busted.length && spot.stacks[busted[j + 1]!] === spot.stacks[busted[i]!]) j++;
        let sum = 0;
        for (let q = i; q <= j; q++) sum += spot.payouts[place + (q - i)] ?? 0;
        for (let q = i; q <= j; q++) icm[busted[q]!] = sum / (j - i + 1);
        place += j - i + 1;
        i = j + 1;
      }
    }
    return icm;
  }

  type Force = { kind: "push" | "call" | "overcall"; who: number; act: boolean } | null;

  /**
   * from 番目の人から先を戦略どおりに進めて、全員の $ を返す。
   * force があれば、その人のその判断だけ指定の行動に差し替える。
   */
  function play(from: number, force: Force): number[] {
    for (let a = from; a < n - 1; a++) {
      const pushes = force && force.kind === "push" && force.who === a ? force.act : !!strategy.push[a]?.has(hands[a]!);
      if (!pushes) continue;
      for (let b = a + 1; b < n; b++) {
        const calls = force && force.kind === "call" && force.who === b ? force.act : !!strategy.call[a]?.[b]?.has(hands[b]!);
        if (!calls) continue;
        for (let c = b + 1; c < n; c++) {
          const over = force && force.kind === "overcall" && force.who === c ? force.act : !!strategy.overcall[a]?.[b]?.[c]?.has(hands[c]!);
          if (over) return showdown([a, b, c]);
        }
        return showdown([a, b]);
      }
      // 全員降りた: a がブラインドを取る
      const final = spot.stacks.map((s, i) => s - blinds[i]!);
      final[a]! += blinds.reduce((x, y) => x + y, 0);
      return prize(final);
    }
    // 全員降りて BB まで回った
    const final = spot.stacks.map((s, i) => s - blinds[i]!);
    final[bbIdx]! += blinds.reduce((x, y) => x + y, 0);
    return prize(final);
  }

  interface Acc { n: number; diff: number; sq: number }
  const tables = new Map<string, { range: ReadonlySet<string> | undefined; reach: number; byHand: Map<string, Acc> }>();
  const record = (key: string, range: ReadonlySet<string> | undefined, hand: string, diff: number): void => {
    let t = tables.get(key);
    if (!t) {
      t = { range, reach: 0, byHand: new Map() };
      tables.set(key, t);
    }
    t.reach++;
    const a = t.byHand.get(hand);
    if (a) {
      a.n++;
      a.diff += diff;
      a.sq += diff * diff;
    } else t.byHand.set(hand, { n: 1, diff, sq: diff * diff });
  };

  for (let trial = 0; trial < trials; trial++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rnd() * (52 - i));
      const tmp = deck[i]!;
      deck[i] = deck[j]!;
      deck[j] = tmp;
    }
    for (let x = 0; x < 5; x++) seven[2 + x] = deck[2 * n + x]!;
    for (let i = 0; i < n; i++) {
      hands[i] = label(deck[2 * i]!, deck[2 * i + 1]!);
      seven[0] = deck[2 * i]!;
      seven[1] = deck[2 * i + 1]!;
      scores[i] = evaluate7(seven);
    }

    // 各席の「押す / 降りる」: そこまで全員が降りているときだけ到達する
    for (let a = 0; a < n - 1; a++) {
      const evPush = play(a, { kind: "push", who: a, act: true })[a]!;
      const evFold = play(a, { kind: "push", who: a, act: false })[a]!;
      record(`${spot.positions[a]} 押す`, strategy.push[a], hands[a]!, evPush - evFold);

      // a が実際に押す手のとき、後ろの人のコール判断
      if (strategy.push[a]?.has(hands[a]!)) {
        for (let b = a + 1; b < n; b++) {
          const evCall = play(a, { kind: "call", who: b, act: true })[b]!;
          const evPass = play(a, { kind: "call", who: b, act: false })[b]!;
          record(`${spot.positions[a]} 押す → ${spot.positions[b]} コール`, strategy.call[a]?.[b], hands[b]!, evCall - evPass);
          // b が実際にコールする手のとき、さらに後ろの人のオーバーコール判断
          if (strategy.call[a]?.[b]?.has(hands[b]!)) {
            for (let c = b + 1; c < n; c++) {
              const evOver = play(a, { kind: "overcall", who: c, act: true })[c]!;
              const evNo = play(a, { kind: "overcall", who: c, act: false })[c]!;
              record(`${spot.positions[a]} 押す → ${spot.positions[b]} コール → ${spot.positions[c]} もコール`, strategy.overcall[a]?.[b]?.[c], hands[c]!, evOver - evNo);
              if (strategy.overcall[a]?.[b]?.[c]?.has(hands[c]!)) break; // c がコールしたら、その先の人には回らない
            }
            break; // b がコールしたら、b より後ろの「最初のコール」の判断には回らない
          }
        }
      }
      if (strategy.push[a]?.has(hands[a]!)) break; // a が押したら、次の席の「押す」判断には回らない
    }
  }

  const rows: RegretRow[] = [];
  for (const [decision, t] of tables) {
    let regret = 0;
    let worst = "";
    let worstGain = 0;
    for (const [hand, a] of t.byHand) {
      const mean = a.diff / a.n; // 「する」−「しない」
      const gain = t.range?.has(hand) ? -mean : mean; // 逆の行動で得をする分
      if (gain <= 0 || a.n < 50) continue;
      // ばらつきで出た見かけの損を数えないよう、標準誤差の 2 倍を超えたものだけ数える
      const variance = Math.max(0, a.sq / a.n - mean * mean);
      if (gain < 2 * Math.sqrt(variance / a.n)) continue;
      regret += (a.n / trials) * gain;
      if (gain * a.n > worstGain) {
        worstGain = gain * a.n;
        worst = `${hand} (${t.range?.has(hand) ? "やめると" : "すると"} +${((gain / total) * 100).toFixed(3)}%, n=${a.n})`;
      }
    }
    rows.push({ decision, regretPct: (regret / total) * 100, worst, reach: t.reach / trials });
  }
  return rows;
}
