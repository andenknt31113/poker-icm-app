// 画面表示用の数値フォーマット。DOM に触らない純関数のみ。

/**
 * 小数 digits 桁の固定小数表記。
 * 非有限値は +∞ を "∞"、それ以外 (NaN / -∞) を "—" で表す
 * (計算不能を空欄ではなく明示するための表記ルール)。
 */
export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return n === Number.POSITIVE_INFINITY ? "∞" : "—";
  return n.toFixed(digits);
}

/** 0..1 の比率を百分率表記にする。非有限値は "—"。 */
export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

/** 符号付き固定小数 (増減を表す値用)。0 以上には明示的に "+" を付ける。 */
export function fmtSigned(n: number, digits = 1): string {
  return (n >= 0 ? "+" : "") + n.toFixed(digits);
}

/**
 * 入力欄の数値を、余分な 0 を付けずに出す ("1.0" → "1"、"0.50" → "0.5")。
 * 空欄や数値でないときは fallback。
 */
export function fmtInputNumber(raw: string, fallback: string): string {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) ? String(n) : fallback;
}
