// DOM に触れる、複数モジュールから共有される参照・状態をまとめる薄い層。
// appState.ts を「DOM 非依存 (vitest から素の Node でも import 可能)」に保つため、
// $() や document.getElementById を伴うものはすべてここに集める。
import { $ } from "./dom.js";
import {
  persistedState,
  parseList,
  players,
  DEFAULT_SB,
  DEFAULT_BB,
  type PersistedState,
} from "./appState.js";
import { STORAGE_KEYS, writeJson } from "./storage.js";

/** #payouts が空・不正だった場合に使う既定のペイ構造 (Top3)。 */
export const DEFAULT_PAYOUTS: readonly number[] = [50, 30, 20];

// ===== 賞金配列 (共有状態) =====
export const payoutsInput = $<HTMLInputElement>("payouts");

export let payoutsArr: number[] = persistedState?.payouts && persistedState.payouts.length > 0
  ? persistedState.payouts.slice()
  : parseList(payoutsInput.value);
if (payoutsArr.length === 0) payoutsArr = [...DEFAULT_PAYOUTS];
payoutsInput.value = payoutsArr.join(", ");

/** payoutsArr の中身をインプレースで置き換える (配列の参照自体は不変に保つ)。 */
export function replacePayouts(values: number[]): void {
  payoutsArr.length = 0;
  payoutsArr.push(...values);
}

// ===== Nash パラメータ (SB/BB/アンティ) の共有 DOM 参照 =====
export const nashSbInput = $<HTMLInputElement>("nash-sb");
export const nashBbInput = $<HTMLInputElement>("nash-bb");
export const nashAnteInput = $<HTMLInputElement>("nash-ante");

export function saveState(): void {
  const state: PersistedState = {
    players: players.map((p) => ({
      stack: p.stack,
      role: p.role,
      position: p.position,
    })),
    payouts: payoutsArr.length > 0 ? payoutsArr : [...DEFAULT_PAYOUTS],
    nash: {
      sb: Number(nashSbInput.value) || DEFAULT_SB,
      bb: Number(nashBbInput.value) || DEFAULT_BB,
      ante: Number(nashAnteInput.value) || 0,
    },
  };
  writeJson(STORAGE_KEYS.appState, state);
}
