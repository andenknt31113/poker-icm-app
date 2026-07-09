import type { PotOddsPosition } from "@poker-icm/core";

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

// localStorage 永続化キー
export const STATE_KEY = "poker-icm-app-state-v1";
export interface PersistedState {
  players: { stack: number; role: Role; position: Position }[];
  payouts: number[];
  nash: { sb: number; bb: number; ante: number; anteMode: "total" | "perPlayer" };
}

/**
 * 賞金配列のサニタイズ: 有限かつ非負の値のみ残す (parseList と同じ規則)。
 * 壊れた値 (負数・NaN・Infinity 等) は行ごと捨てる。
 * localStorage / 共有URL 経由で入り込んだ不正値がUI表示と実計算 (ICM) を
 * 乖離させるのを防ぐ。
 */
export function sanitizePayoutsArray(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0,
  );
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(obj.players) || !Array.isArray(obj.payouts) || !obj.nash) {
      return null;
    }
    return { ...obj, payouts: sanitizePayoutsArray(obj.payouts) };
  } catch {
    return null;
  }
}

// デフォルト状態（初回起動時）
const DEFAULT_PLAYERS: { stack: number; role: Role; position: Position }[] = [
  { stack: 14, role: "hero", position: "SB" },
  { stack: 23, role: "villain", position: "BB" },
  { stack: 8, role: "other", position: "BTN" },
  { stack: 8, role: "other", position: "CO" },
  { stack: 8, role: "other", position: "HJ" },
  { stack: 8, role: "other", position: "LJ" },
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
