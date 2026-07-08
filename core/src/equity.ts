import type { RequiredEquityInput, RequiredEquityResult } from "./types.js";

/**
 * 必要勝率 (cEV / $EV) と Risk Premium を計算する。
 *
 *   cEV 必要勝率   = call / (call + potIfWin)
 *   $EV 必要勝率   = (call * BF) / (call * BF + potIfWin)
 *   Risk Premium   = $EV − cEV
 *
 * bubbleFactor は理論上 0 以上 (0 は「勝っても負けても $ エクイティが変わらない
 * = ノーリスク」、Infinity は「勝っても $ エクイティが増えない = 常にフォールド
 * すべき」)。bf=0 のとき callEffective = call*0 = 0 なので dollarEV = 0 となり、
 * 「$EV 的にはどんな勝率でもコールが正しい」という結果になる。これは
 * calculateBubbleFactor 側で丸め誤差ノイズを 0 にクランプした結果として実際に
 * 起こり得るため、正常系として扱う（例外を投げない）。負値は数学的に無意味な
 * 入力ミスとして引き続きエラーにする。
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
  if (!Number.isFinite(bubbleFactor) || bubbleFactor < 0) {
    // Infinity の場合のみ別扱い（BF 計算側で出る可能性あり）
    if (bubbleFactor === Number.POSITIVE_INFINITY) {
      return { cEV: callAmount / (callAmount + potIfWin), dollarEV: 1, riskPremium: 1 - callAmount / (callAmount + potIfWin) };
    }
    throw new Error(`RequiredEquity: bubbleFactor が不正です: ${bubbleFactor}`);
  }
  // bubbleFactor === 0: 丸め誤差ノイズのクランプ結果として起こり得る正常値。
  // dollarEV = 0 (常にコールが正しい) として下の通常計算に進む。

  const cEV = callAmount / (callAmount + potIfWin);
  const callEffective = callAmount * bubbleFactor;
  const dollarEV = callEffective / (callEffective + potIfWin);

  return {
    cEV,
    dollarEV,
    riskPremium: dollarEV - cEV,
  };
}
