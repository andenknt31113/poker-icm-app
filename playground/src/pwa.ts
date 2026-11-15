import { t } from "./i18n.js";
import { isCapacitorNative } from "./capacitorEnv.js";

// ===== テーマ (ダーク固定) =====
// ライトテーマと切替ボタンは製品判断で廃止し、ダーク配色のみにした。
// 過去に localStorage へ保存された "light" 設定が残っていても無視される
// (data-theme 属性を付けないことがダーク表示の条件のため、何もしなければダーク)。
function initTheme(): void {
  document.documentElement.removeAttribute("data-theme");
  // Capacitor (iOS) 上ではステータスバーの文字色を明示的に合わせる必要がある。
  // 通常ブラウザではステータスバー API 自体が存在しないため isCapacitorNative() で
  // 早期リターンし、dynamic import すら発生させない (web バンドルへの影響ゼロ)。
  if (!isCapacitorNative()) return;
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) =>
      // Style.Dark = 暗い背景向け (明るい文字色)
      StatusBar.setStyle({ style: Style.Dark }),
    )
    .catch(() => {
      /* @capacitor/status-bar が使えない (プラグイン未同梱・呼び出し失敗) 場合は無視 */
    });
}

// ===== オフライン状態インジケータ =====
function updateOfflineBanner(): void {
  const existing = document.getElementById("offline-banner");
  if (navigator.onLine) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const header = document.querySelector("header");
  if (!header) return;
  const banner = document.createElement("div");
  banner.id = "offline-banner";
  banner.className = "offline-banner";
  banner.textContent = t("pwa.offline.text");
  header.insertAdjacentElement("afterend", banner);
}

function initOfflineBanner(): void {
  window.addEventListener("online", updateOfflineBanner);
  window.addEventListener("offline", updateOfflineBanner);
  updateOfflineBanner();
}

// ===== フッター: ビルドバージョン表示 =====
// vite.config.ts の define で埋め込まれた __APP_VERSION__ (ビルド時点の
// git commit SHA 短縮形、git が使えない環境では "dev") を footer に追記する。
// デプロイ後、本番に表示される build SHA と main ブランチの最新 SHA を照合すれば
// 「意図した commit が確実にデプロイされているか」を検証できる、という
// デプロイ後検証の布石。
function initFooterVersion(): void {
  const el = document.getElementById("footer-version");
  if (!el) return;
  el.textContent = `${el.textContent} · build ${__APP_VERSION__}`;
}

/**
 * テーマ・オフラインバナー・フッターバージョンの初期化。main.ts から一度だけ呼ぶ。
 * 以前は Web 版向けの Service Worker 登録と「ホーム画面に追加」の案内もここにあったが、
 * Web では計算アプリを配信しなくなったので外した (製品は iOS アプリだけ)。
 */
export function initPwa(): void {
  initTheme();
  initOfflineBanner();
  initFooterVersion();
}
