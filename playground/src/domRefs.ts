// DOM に触れる、複数モジュールから共有される参照・状態をまとめる薄い層。
// appState.ts を「DOM 非依存 (vitest から素の Node でも import 可能)」に保つため、
// $() や document.getElementById を伴うものはすべてここに集める。
import { $ } from "./dom.js";
import { persistedState, parseList, players, DEFAULT_SB, DEFAULT_BB, STATE_KEY, type PersistedState } from "./appState.js";

// ===== 賞金配列 (共有状態) =====
export const payoutsInput = $<HTMLInputElement>("payouts");

export let payoutsArr: number[] = persistedState?.payouts && persistedState.payouts.length > 0
  ? persistedState.payouts.slice()
  : parseList(payoutsInput.value);
if (payoutsArr.length === 0) payoutsArr = [50, 30, 20];
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
  try {
    const sbEl = document.getElementById("nash-sb") as HTMLInputElement | null;
    const bbEl = document.getElementById("nash-bb") as HTMLInputElement | null;
    const anteEl = document.getElementById("nash-ante") as HTMLInputElement | null;
    const anteMode =
      (document.querySelector<HTMLInputElement>(
        'input[name="ante-mode"]:checked',
      )?.value ?? "total") as "total" | "perPlayer";
    const state: PersistedState = {
      players: players.map((p) => ({
        stack: p.stack,
        role: p.role,
        position: p.position,
      })),
      payouts: payoutsArr.length > 0 ? payoutsArr : [50, 30, 20],
      nash: {
        sb: sbEl ? Number(sbEl.value) || DEFAULT_SB : DEFAULT_SB,
        bb: bbEl ? Number(bbEl.value) || DEFAULT_BB : DEFAULT_BB,
        ante: anteEl ? Number(anteEl.value) || 0 : 0,
        anteMode,
      },
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* quota / serialize エラーは無視 */
  }
}
