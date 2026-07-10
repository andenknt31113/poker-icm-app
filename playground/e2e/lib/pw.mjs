// playwright ローダー。
//
// CI では playground の devDependency として npm ci でインストールされた
// "playwright" を使う (node_modules 経由の通常の解決)。
// ローカル環境では /opt/node22/lib/node_modules/playwright にグローバル
// インストール済みの playwright がある場合があり、devDependency 未インストール
// でも動くようにフォールバックする。
//
// package.json が "type": "module" のため import() ではなく createRequire 経由の
// require() を使う (playwright は CommonJS パッケージで、名前付き export の
// ESM 相互運用が不安定なため)。
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const LOCAL_FALLBACK_PATH = "/opt/node22/lib/node_modules/playwright";

export function loadPlaywright() {
  try {
    return require("playwright");
  } catch (primaryError) {
    try {
      const mod = require(LOCAL_FALLBACK_PATH);
      console.warn(
        `[e2e] devDependency の "playwright" が見つからなかったため、ローカルの ${LOCAL_FALLBACK_PATH} にフォールバックしました。`,
      );
      return mod;
    } catch (fallbackError) {
      const err = new Error(
        [
          "playwright を読み込めませんでした。",
          `- require("playwright") エラー: ${primaryError && primaryError.message}`,
          `- フォールバック (${LOCAL_FALLBACK_PATH}) エラー: ${fallbackError && fallbackError.message}`,
          "playground/package.json の devDependencies に playwright があるか、`npm install` 済みか確認してください。",
        ].join("\n"),
      );
      throw err;
    }
  }
}
