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

/** アンティ入力の解釈モード: テーブル合計 か 1人あたり。 */
export type AnteMode = "total" | "perPlayer";

export interface PersistedState {
  players: { stack: number; role: Role; position: Position }[];
  payouts: number[];
  nash: { sb: number; bb: number; ante: number; anteMode: AnteMode };
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
