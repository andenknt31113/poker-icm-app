// ===== 軽量 i18n 基盤 (外部ライブラリ非依存) =====
// Phase A: 日本語辞書のみ。全 UI 文言を辞書へ外部化し、t() で引く。
// Phase B: 英語辞書と言語切替 UI を追加。言語状態は localStorage で永続化し、
//   切替時は location.reload() で全モジュールを描き直す (下記 setLang 参照)。
import { ja } from "./locales/ja.js";
import { en } from "./locales/en.js";

export type Lang = "ja" | "en";
type Dict = Record<string, string>;

const DICTIONARIES: Record<Lang, Dict> = { ja, en };
const LANG_KEY = "poker-icm-lang";
const DEFAULT_LANG: Lang = "ja";

function isLang(v: unknown): v is Lang {
  return v === "ja" || v === "en";
}

function readLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (isLang(v)) return v;
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

/** 言語切替時に呼ばれるコールバックを購読する。 */
export function onLanguageChange(cb: (lang: Lang) => void): () => void {
  languageChangeCbs.add(cb);
  return () => languageChangeCbs.delete(cb);
}

/**
 * 言語を切り替えて localStorage に永続化する。
 *
 * 実装方針: この関数自体は状態の永続化と <html lang> の更新、購読者通知
 * だけを行う。実際の画面反映は呼び出し側 (ヘッダーの言語トグル) が
 * location.reload() で行う。全モジュール (setup / calculator / handRange /
 * nashUI / practice/*) が初期化時に t() で文言を焼き込む設計のため、動的に
 * 全再描画するより、リロードで全モジュールを DEFAULT_LANG=新言語 の状態から
 * 描き直す方が確実かつ単純だと判断した (状態は localStorage 永続なので
 * リロードしてもユーザーのシナリオ・成績は失われない)。
 */
export function setLang(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* quota error 等は無視 */
  }
  try {
    document.documentElement.setAttribute("lang", lang);
  } catch {
    /* SSR/非 DOM 環境では無視 */
  }
  for (const cb of languageChangeCbs) cb(lang);
}

/**
 * 辞書引き + {name} プレースホルダ置換。
 * キーが辞書に無い場合は console.warn してキー文字列そのものを返す
 * (画面が空にならないためのフォールバック)。英語辞書にキーが無い場合は
 * 日本語辞書へフォールバックする。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTIONARIES[currentLang];
  let template = dict[key];
  if (template === undefined && currentLang !== "ja") {
    // 英語辞書に未定義のキーは日本語へフォールバック (未翻訳でも表示は保つ)
    template = ja[key];
    if (template !== undefined) {
      console.warn(`[i18n] "${currentLang}" 辞書に未定義のキー: "${key}" (ja へフォールバック)`);
    }
  }
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
 *    <strong>/<br> 等マークアップを含む文言用)
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
