/** id 指定で DOM 要素を取得する共通ヘルパー。見つからない場合は例外。 */
export const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el as T;
};
