// ===== スタック入力の単位 (BB / チップ) =====
//
// 計算コア・保存データ・例題はすべて BB 単位の単一表現を保ち、
// チップモード時は UI 層だけで `chips = bb * bbSize` として表示・入力変換する。
// これにより ICM / 必要勝率 / Nash / バウンティ / チョップのすべてが
// ライブのチップ数そのままの入力で矛盾なく動く。
import { STORAGE_KEYS, readJson, writeJson } from "./storage.js";

export type StackUnit = "bb" | "chips";

export const DEFAULT_BB_SIZE = 1000;
export const BB_SIZE_PRESETS = [1000, 5000, 10000, 20000] as const;

export interface StackUnitState {
  mode: StackUnit;
  bbSize: number;
}

const DEFAULT_STATE: StackUnitState = { mode: "bb", bbSize: DEFAULT_BB_SIZE };

/** 1 BB のチップ数を正の有限数に正規化する。不正値なら fallback。 */
export function sanitizeBbSize(value: unknown, fallback = DEFAULT_BB_SIZE): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isStackUnitState(v: unknown): v is StackUnitState {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (s.mode === "bb" || s.mode === "chips") && typeof s.bbSize === "number" && Number.isFinite(s.bbSize) && s.bbSize > 0;
}

let state: StackUnitState = { ...readJson(STORAGE_KEYS.stackUnit, DEFAULT_STATE, isStackUnitState) };

function persist(): void {
  writeJson(STORAGE_KEYS.stackUnit, state);
}

export function getStackUnit(): StackUnit {
  return state.mode;
}

export function getBbSize(): number {
  return state.bbSize;
}

export function setStackUnit(mode: StackUnit): void {
  state = { ...state, mode };
  persist();
}

export function setBbSize(bbSize: number): void {
  state = { ...state, bbSize: sanitizeBbSize(bbSize, state.bbSize) };
  persist();
}

/** 内部 BB 値を入力欄 (<input type="number">) 用の文字列にする。 */
export function bbToInputValue(bb: number, mode: StackUnit, bbSize: number): string {
  const safeBb = Number.isFinite(bb) && bb >= 0 ? bb : 0;
  if (mode === "chips") return String(Math.round(safeBb * sanitizeBbSize(bbSize)));
  return String(Math.round(safeBb * 100) / 100);
}

/** 入力欄の数値 (BB またはチップ) を内部の BB 値に変換する。 */
export function inputValueToBb(raw: number, mode: StackUnit, bbSize: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0;
  if (mode === "chips") return raw / sanitizeBbSize(bbSize);
  return raw;
}

/** サマリーや注意バナー向け: BB 値を最大小数 1 桁に丸めた短い表記 ("13.3", "4.5", "18")。 */
export function formatBbCompact(bb: number): string {
  const safeBb = Number.isFinite(bb) && bb >= 0 ? bb : 0;
  return String(Math.round(safeBb * 10) / 10);
}

/** 表 (ICM・チョップ・BF マップ) のスタック列に並べる表示文字列。 */
export function formatStackDisplay(bb: number, mode: StackUnit, bbSize: number): string {
  const safeBb = Number.isFinite(bb) && bb >= 0 ? bb : 0;
  if (mode === "chips") return Math.round(safeBb * sanitizeBbSize(bbSize)).toLocaleString("en-US");
  return String(Math.round(safeBb * 100) / 100);
}

/** チョップ共有テキスト内のスタック表記 (BB モード: "12BB" / チップモード: "120,000 (12BB)")。 */
export function formatStackShareLabel(bb: number, mode: StackUnit, bbSize: number): string {
  const safeBb = Number.isFinite(bb) && bb >= 0 ? bb : 0;
  const bbStr = `${Math.round(safeBb * 10) / 10}BB`;
  if (mode === "chips") {
    return `${Math.round(safeBb * sanitizeBbSize(bbSize)).toLocaleString("en-US")} (${bbStr})`;
  }
  return `${Math.round(safeBb * 100) / 100}BB`;
}

/**
 * チップモード中に 1 BB の額を変えたとき、各プレイヤーのチップ枚数を保ったまま
 * 内部の BB スタックを再計算する (例: 45,000 点は BB 5,000→10,000 で 9BB→4.5BB)。
 */
export function rescaleStacksForBbSize(
  stacksBb: readonly number[],
  oldBbSize: number,
  newBbSize: number,
): number[] {
  const oldSafe = sanitizeBbSize(oldBbSize);
  const newSafe = sanitizeBbSize(newBbSize, oldSafe);
  return stacksBb.map((bb) => {
    const chips = Math.round((Number.isFinite(bb) && bb >= 0 ? bb : 0) * oldSafe);
    return chips / newSafe;
  });
}
