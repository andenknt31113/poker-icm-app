import type { PotOddsPosition } from "@poker-icm/core";
import { STORAGE_KEYS, readJson } from "./storage.js";

// ===== プレイヤー状態管理 =====
//
// このファイルは DOM に一切触れない「純粋な状態・ロジック」だけを置く。
// (vitest から素の Node 環境でも import できるようにするための意図的な制約。
//  DOM に触れる共有参照 (payoutsInput / nashSbInput など) や saveState() は
//  ./domRefs.ts 側にある。)

export type Role = "hero" | "villain" | "other";
export type Position = "" | "SB" | "BB" | "BTN" | "CO" | "HJ" | "LJ" | "MP" | "UTG+1" | "UTG";

/** 標準ブラインド (BB 単位)。プリセット/フォールバック値の単一情報源。 */
export const DEFAULT_SB = 0.5;
export const DEFAULT_BB = 1.0;
export const DEFAULT_ANTE = 1.0; // BB ante 構造の標準値

/** Position → calculatePotOdds の position 種別 (SB / BB / OTHER) に変換。 */
export function posToPotOddsPos(pos: Position | undefined): PotOddsPosition {
  if (pos === "SB") return "SB";
  if (pos === "BB") return "BB";
  return "OTHER";
}

/** N人テーブルでの時計回りポジション順（BTN起点）。 */
const POSITION_SETS: Record<number, Position[]> = {
  2: ["BTN", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "CO"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  7: ["BTN", "SB", "BB", "UTG", "MP", "HJ", "CO"],
  8: ["BTN", "SB", "BB", "UTG", "MP", "LJ", "HJ", "CO"],
  9: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "LJ", "HJ", "CO"],
};

export function positionsForN(n: number): Position[] {
  return POSITION_SETS[n] ?? [];
}

/**
 * N人テーブルで未使用のポジションを1つ返す (プレイヤー追加時の自動採番用)。
 *
 * 既存プレイヤーのポジションは動かさない前提で、「N人の正規セットのうち
 * まだ誰も使っていない最初のポジション」を返す (例: 4人 BB/SB/BTN/CO に
 * 5人目を追加 → UTG)。誰もポジションを設定していないテーブルでは、勝手に
 * 採番を始めず "" を返す (ポジションを使わない運用を尊重する)。
 */
export function nextFreePosition(n: number, used: readonly Position[]): Position {
  const usedSet = new Set<Position>(used.filter((p) => p !== ""));
  if (usedSet.size === 0) return "";
  return positionsForN(n).find((p) => !usedSet.has(p)) ?? "";
}

/**
 * i 番目のプレイヤーのポジションを next に変更したときの新しい配列を返す
 * (ポジション変更規則の単一情報源)。
 *
 * - next = "" … その行だけクリア
 * - 正規セット外のポジション … その行だけ変更 (他に影響しない)
 * - autoLink = true … 入力順=席順とみなし、i を起点に全員をリングで自動連動
 *   (プリセット適用直後などの「1人選べば残りも並ぶ」クイックセット用)
 * - autoLink = false … 現在 next を持つプレイヤーと入れ替え (他は動かさない)。
 *   自動連動を毎回やると「1人直すと別の人が壊れる」モグラ叩きになるため、
 *   2回目以降の手動修正はこちら。
 */
export function positionsAfterChange(
  current: readonly Position[],
  i: number,
  next: Position,
  autoLink: boolean,
): Position[] {
  const out = [...current];
  if (next === "") {
    out[i] = "";
    return out;
  }
  const n = current.length;
  const set = positionsForN(n);
  const k = set.indexOf(next);
  if (k < 0) {
    out[i] = next;
    return out;
  }
  if (autoLink) {
    for (let j = 0; j < n; j++) {
      const offset = (j - i + n) % n;
      out[j] = set[(k + offset) % set.length] ?? "";
    }
    return out;
  }
  const holder = current.findIndex((p, j) => j !== i && p === next);
  if (holder >= 0) out[holder] = current[i] ?? "";
  out[i] = next;
  return out;
}

export interface Player {
  id: number;
  stack: number;
  role: Role;
  position: Position;
}

let nextId = 0;
/** 新しい Player.id を払い出す。 */
export function allocPlayerId(): number {
  return nextId++;
}

export const players: Player[] = [];

export interface PersistedState {
  players: { stack: number; role: Role; position: Position }[];
  payouts: number[];
  // ante は常にテーブル合計 (アンティ入力は「アンティ合計」1つだけ)
  nash: { sb: number; bb: number; ante: number };
}

/**
 * 賞金配列のサニタイズ: 有限かつ非負の値のみ残す (parseList と同じ規則)。
 * 壊れた値 (負数・NaN・Infinity 等) は行ごと捨てる。
 * localStorage 経由で入り込んだ不正値がUI表示と実計算 (ICM) を
 * 乖離させるのを防ぐ。
 */
export function sanitizePayoutsArray(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0,
  );
}

/**
 * 保存済み state が最低限の形 (players / payouts が配列で nash が存在) を
 * 満たすか。個々の値の妥当性は各利用箇所とサニタイズに委ねる。
 */
function isPersistedStateShape(v: unknown): v is PersistedState {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Partial<PersistedState>;
  return Array.isArray(o.players) && Array.isArray(o.payouts) && !!o.nash;
}

function loadState(): PersistedState | null {
  const obj = readJson<PersistedState | null>(
    STORAGE_KEYS.appState,
    null,
    (v): v is PersistedState | null => v === null || isPersistedStateShape(v),
  );
  if (obj === null) return null;
  return { ...obj, payouts: sanitizePayoutsArray(obj.payouts) };
}

// デフォルト状態（初回起動時）
// コール分析として成立する構成 (hero=BB、villain はそれより先に行動する SB) にしてある。
// #6 は 6-max のポジションセット (BTN/SB/BB/UTG/HJ/CO) に無い "LJ" だと選択肢に無いポジションとして
// 「—」(未割当) 表示になってしまうため、有効な UTG に修正。
// 初期状態は 3-handed (ft3 プリセット相当)。freemium の無料枠が「3人まで自由編集」
// のため、初回起動をロックされた画面ではなく「触って編集できる卓」から始める。
const DEFAULT_PLAYERS: { stack: number; role: Role; position: Position }[] = [
  { stack: 18, role: "hero", position: "BB" },
  { stack: 14, role: "villain", position: "SB" },
  { stack: 20, role: "other", position: "BTN" },
];

// 起動時に state を復元
export const persistedState = loadState();
const initialPlayers = persistedState?.players ?? DEFAULT_PLAYERS;
for (const p of initialPlayers) {
  players.push({
    id: nextId++,
    stack: p.stack,
    role: p.role,
    position: p.position,
  });
}

// ===== 数値リストのパース =====

export function parseList(v: string): number[] {
  return v
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

// プリフロップ行動順 (UTG → UTG+1 → MP → LJ → HJ → CO → BTN → SB → BB)
// (BB が最後に行動する)
const POSITION_ACT_ORDER = [
  "UTG",
  "UTG+1",
  "MP",
  "LJ",
  "HJ",
  "CO",
  "BTN",
  "SB",
  "BB",
] as const;

export function actionOrderIdx(pos: string): number {
  return POSITION_ACT_ORDER.indexOf(pos as (typeof POSITION_ACT_ORDER)[number]);
}
