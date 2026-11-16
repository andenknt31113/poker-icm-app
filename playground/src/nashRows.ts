// Nash 一覧 (nashTableUI.ts) の行の出し方の判定。DOM に触らないのでここに分けてある。

/**
 * コールする人がこの人数以上の組は、自分・相手の行だけ先に出して残りを畳む。
 * 9 人卓だと行が 40 以上並んで、目当ての行までのスクロールが長くなるため。
 * (4 人以上がコールに回る = 5 人以上の卓)
 */
export const NASH_COLLAPSE_MIN_CALLERS = 4;

/**
 * 畳んでいる組でも最初から出しておくコール行か。
 * 自分・相手の行と、表を開いている行 (その下のオーバーコール行を開いている場合も含む) は隠さない。
 */
export function isCallerRowPinned(role: string | undefined, rowKey: string, openKey: string | null): boolean {
  if (role === "hero" || role === "villain") return true;
  return openKey !== null && (openKey === rowKey || openKey.startsWith(`${rowKey}o`));
}
