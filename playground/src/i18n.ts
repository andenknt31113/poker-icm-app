// ===== 軽量 i18n 基盤 (外部ライブラリ非依存) =====
// Phase A: 日本語辞書のみ。全 UI 文言を辞書へ外部化し、t() で引く。
// Phase B で英語辞書・言語切替 UI を追加する布石として、言語状態の永続化と
// onLanguageChange 購読機構だけ用意してある (Phase A では未使用)。
import { ja } from "./locales/ja.js";

export type Lang = "ja";
type Dict = Record<string, string>;

const DICTIONARIES: Record<Lang, Dict> = { ja };
const LANG_KEY = "poker-icm-lang";
const DEFAULT_LANG: Lang = "ja";

function readLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "ja") return v;
  } catch {
    /* localStorage 不可環境では既定言語 */
  }
  return DEFAULT_LANG;
}

let currentLang: Lang = readLang();

export function getLang(): Lang {
  return currentLang;
}

const languageChangeCbs = new Set<(lang: Lang) => void>();

/** Phase B 用: 言語切替時に呼ばれるコールバックを購読する (Phase A では未使用)。 */
export function onLanguageChange(cb: (lang: Lang) => void): () => void {
  languageChangeCbs.add(cb);
  return () => languageChangeCbs.delete(cb);
}

/** Phase B 用: 言語を切り替えて永続化し、購読者へ通知する (Phase A では未使用)。 */
export function setLang(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* quota error 等は無視 */
  }
  for (const cb of languageChangeCbs) cb(lang);
}

/**
 * 辞書引き + {name} プレースホルダ置換。
 * キーが辞書に無い場合は console.warn してキー文字列そのものを返す
 * (画面が空にならないためのフォールバック)。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTIONARIES[currentLang];
  let template = dict[key];
  if (template === undefined) {
    console.warn(`[i18n] 未定義のキー: "${key}"`);
    template = key;
  }
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = params[name];
    return v === undefined ? whole : String(v);
  });
}

/**
 * 静的 DOM への翻訳適用。
 *  - [data-i18n="key"] → textContent を t(key) に差し替え
 *  - [data-i18n-html="key"] → innerHTML を t(key) に差し替え (インラインの
 *    <strong>/<br> 等マークアップを含む文言用。ja では元と同一 HTML を再設定する)
 *  - [data-i18n-attr="attr:key;attr2:key2"] → 指定属性を t(key) に差し替え
 *    (title / aria-label / placeholder など)
 */
export function applyStaticTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml;
    if (key) el.innerHTML = t(key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-attr]").forEach((el) => {
    const spec = el.dataset.i18nAttr;
    if (!spec) return;
    for (const pair of spec.split(";")) {
      const idx = pair.indexOf(":");
      if (idx < 0) continue;
      const attr = pair.slice(0, idx).trim();
      const key = pair.slice(idx + 1).trim();
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
}
