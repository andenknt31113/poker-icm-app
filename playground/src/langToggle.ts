// ヘッダーの言語切替トグル。
// 表示は「今の言語の逆」(ja のとき "EN"、en のとき "日本語") で、タップすると
// 反対の言語へ setLang して location.reload() する。全モジュールが初期化時に
// t() で文言を焼き込む設計のため、動的な全再描画より確実で単純なリロード方式を
// 採る (状態は localStorage 永続なのでシナリオ・成績は失われない)。詳細は
// i18n.ts の setLang コメントを参照。
import { getLang, setLang, type Lang } from "./i18n.js";

const NEXT_LANG: Record<Lang, Lang> = { ja: "en", en: "ja" };
// トグルに出す「切替先の言語」ラベル。
const TOGGLE_LABEL: Record<Lang, string> = { ja: "EN", en: "日本語" };

export function initLangToggle(): void {
  // 初期ロード時に <html lang> を永続言語へ合わせる (静的 HTML の既定は ja)。
  document.documentElement.setAttribute("lang", getLang());

  const btn = document.getElementById("lang-toggle");
  if (!btn) return;
  const cur = getLang();
  const next = NEXT_LANG[cur];
  // 「反対言語」を表示する。
  btn.textContent = TOGGLE_LABEL[cur];
  btn.addEventListener("click", () => {
    setLang(next);
    location.reload();
  });
}
