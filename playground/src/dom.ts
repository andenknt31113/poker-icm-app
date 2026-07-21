/** id 指定で DOM 要素を取得する共通ヘルパー。見つからない場合は例外。 */
export const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el as T;
};

/**
 * すべての number input (スタック・ペイアウト・Nash SB/BB/アンテ・コール額など) について、
 * フォーカス時に既存値を全選択する。モバイルで「消してから打ち直す」手間を省くための共通挙動。
 * 個別の input に実装せず、document レベルの focusin 委譲リスナー1つでまとめて対応する。
 * main.ts から一度だけ呼ぶ。
 */
export function initNumberInputAutoSelect(): void {
  document.addEventListener("focusin", (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === "number" && !target.readOnly) {
      // フォーカス直後は一部モバイルブラウザでカーソル位置確定前に select() が
      // 効かないことがあるため、次フレームまで遅延させる。
      // 注意: select() はフォーカスを失った input を再フォーカスさせるため、
      // 遅延中に blur された場合 (freemium のロック入力など) は実行しない。
      // これを怠ると blur → select() → focusin → blur… の無限ループになる。
      requestAnimationFrame(() => {
        if (document.activeElement === target) target.select();
      });
    }
  });
}
