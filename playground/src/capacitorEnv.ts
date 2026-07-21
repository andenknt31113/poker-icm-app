// ===== Capacitor 実行環境判定 =====
// Capacitor (iOS/Android ネイティブラッパー) は `capacitor://` 独自スキームで
// 動作するため、通常のブラウザ/PWA と挙動を分ける必要がある箇所 (Service Worker
// 登録、ステータスバー、共有シート) から参照する共通ヘルパー。
//
// 重要: このモジュールは @capacitor/core を静的 import しない。
// Capacitor ランタイムは window.Capacitor をグローバルに注入するため、
// それを optional chaining で参照するだけで判定できる。こうすることで
// 通常ブラウザ向け Web バンドルに @capacitor/core のコードが含まれることを防ぐ
// (ネイティブ機能を使う各所は個別に dynamic import する)。
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

/** Capacitor のネイティブラッパー (iOS/Android) 上で動作しているか。通常ブラウザ/PWA では常に false。 */
export function isCapacitorNative(): boolean {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
