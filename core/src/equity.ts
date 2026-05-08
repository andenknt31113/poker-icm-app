import type { RequiredEquityInput, RequiredEquityResult } from "./types.js";

/**
 * 必要勝率 (cEV / $EV) と Risk Premium を計算する。
 *
 *   cEV 必要勝率   = call / (call + potIfWin)
 *   $EV 必要勝率   = (call * BF) / (call * BF + potIfWin)
 *   Risk Premium   = $EV − cEV
 */
export function calculateRequiredEquity(
  input: RequiredEquityInput,
): RequiredEquityResult {
  const { callAmount, potIfWin, bubbleFactor } = input;

  if (!Number.isFinite(callAmount) || callAmount <= 0) {
    throw new Error(`RequiredEquity: callAmount が不正です: ${callAmount}`);
  }
  if (!Number.isFinite(potIfWin) || potIfWin <= 0) {
    throw new Error(`RequiredEquity: potIfWin が不正です: ${potIfWin}`);
  }
  if (!Number.isFinite(bubbleFactor) || bubbleFactor <= 0) {
    // Infinity の場合のみ別扱い（BF 計算側で出る可能性あり）
    if (bubbleFactor === Number.POSITIVE_INFINITY) {
      return { cEV: callAmount / (callAmount + potIfWin), dollarEV: 1, riskPremium: 1 - callAmount / (callAmount + potIfWin) };
    }
    throw new Error(`RequiredEquity: bubbleFactor が不正です: ${bubbleFactor}`);
  }

  const cEV = callAmount / (callAmount + potIfWin);
  const callEffective = callAmount * bubbleFactor;
  const dollarEV = callEffective / (callEffective + potIfWin);

  return {
    cEV,
    dollarEV,
    riskPremium: dollarEV - cEV,
  };
}
