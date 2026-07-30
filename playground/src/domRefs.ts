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
  type AnteMode,
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

// ===== アンティモード (合計 / 1人あたり) =====
//
// 重要な現状の不変条件: index.html には input[name="ante-mode"] のラジオが存在しない
// (アンティ入力は #nash-ante の「アンティ合計」1つだけ)。したがって
//   - readAnteMode() は常に "total" を返す
//   - setAnteMode() は常に何もしない
//   - anteModeRadios() は常に空
// となり、各計算側の anteMode === "perPlayer" 分岐は現行 UI では到達しない。
// ラジオを再導入すれば分岐がそのまま生き返る設計として意図的に残している
// (HRC 互換の「1人あたり」入力を将来復活させるための受け口)。
// この 3 関数が DOM を触る唯一の口なので、復活時に変更するのはここと index.html だけ。
const ANTE_MODE_SELECTOR = 'input[name="ante-mode"]';
const DEFAULT_ANTE_MODE: AnteMode = "total";

/**
 * 選択中のアンティモードを読む。未選択・ラジオ不在時は "total"。
 * 従来は 5 箇所 (saveState / autofill / シナリオ保存 / pushBack 逆算 / Nash solve) が
 * 同じ querySelector + `as` キャストを重複して書いていたため、唯一の読み取り口に集約した。
 */
export function readAnteMode(): AnteMode {
  const checked = document.querySelector<HTMLInputElement>(`${ANTE_MODE_SELECTOR}:checked`);
  return checked?.value === "perPlayer" ? "perPlayer" : DEFAULT_ANTE_MODE;
}

/** 指定モードのラジオを選択状態にする (シナリオ適用・復元時)。ラジオ不在なら何もしない。 */
export function setAnteMode(mode: AnteMode): void {
  const radio = document.querySelector<HTMLInputElement>(
    `${ANTE_MODE_SELECTOR}[value="${mode}"]`,
  );
  if (radio) radio.checked = true;
}

/** アンティモードのラジオすべて (change 配線用)。現行 HTML では空。 */
export function anteModeRadios(): NodeListOf<HTMLInputElement> {
  return document.querySelectorAll<HTMLInputElement>(ANTE_MODE_SELECTOR);
}

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
      anteMode: readAnteMode(),
    },
  };
  writeJson(STORAGE_KEYS.appState, state);
}
