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

// ===== 画面下部トースト共通スタック =====
// タブバーの上に浮かぶ固定トースト (iOS インストール案内 / SW 更新通知) を
// 同じ場所に積み上げるための共有コンテナ。オフラインバナーは header 直後に
// インライン表示されるため対象外 (重なりは発生しない)。
function getBottomToastStack(): HTMLElement {
  let stack = document.getElementById("pwa-toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "pwa-toast-stack";
    stack.className = "pwa-toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

// ===== Service Worker 更新通知トースト =====
// ユーザーがトーストをタップして更新を明示的に要求したか。
// 初回訪問時の clients.claim() による controllerchange と区別するために必要。
let swUpdateRequested = false;

function showSwUpdateToast(waitingWorker: ServiceWorker): void {
  if (document.getElementById("sw-update-toast")) return;

  const toast = document.createElement("div");
  toast.id = "sw-update-toast";
  toast.className = "sw-update-toast";
  toast.setAttribute("role", "button");
  toast.tabIndex = 0;
  toast.setAttribute("aria-label", t("pwa.swUpdate.aria"));

  const text = document.createElement("span");
  text.textContent = t("pwa.swUpdate.text");

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sw-update-toast-close";
  closeBtn.setAttribute("aria-label", t("pwa.close.aria"));
  closeBtn.textContent = "✕";

  const applyUpdate = (): void => {
    swUpdateRequested = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  toast.addEventListener("click", (e) => {
    if (e.target === closeBtn) return;
    applyUpdate();
  });
  toast.addEventListener("keydown", (e) => {
    if (e.target === closeBtn) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      applyUpdate();
    }
  });
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toast.remove();
  });

  toast.appendChild(text);
  toast.appendChild(closeBtn);
  getBottomToastStack().appendChild(toast);
}

// ===== Service Worker 登録 (PWA) =====
function initServiceWorker(): void {
  // ページ初期化時点では更新は未要求 (テストの分離にも必要)
  swUpdateRequested = false;
  // Capacitor (iOS) は capacitor:// 独自スキームで動作し、file: と同様に
  // Service Worker のユースケース (オフラインキャッシュ・PWA インストール) が
  // 意味を持たない。SW 登録自体と更新トーストを丸ごとスキップする。
  if ("serviceWorker" in navigator && location.protocol !== "file:" && !isCapacitorNative()) {
    // load は 1 ページにつき一度しか発火しないため { once: true } で確実に自己解除する
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            registration.onupdatefound = () => {
              const newWorker = registration.installing;
              if (!newWorker) return;
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // controller が既に存在する = 新規インストールではなく更新
                  showSwUpdateToast(newWorker);
                }
              });
            };
          })
          .catch(() => {
            /* SW 登録失敗は無視 */
          });

        // ユーザーがトーストをタップして更新を要求した場合のみ、一度だけ
        // リロードして新版を反映する。
        // 注意: 初回訪問時も clients.claim() により controllerchange が発火する
        // ため、無条件にリロードすると「初回訪問者のページが勝手にリロードされる」
        // バグになる (E2E スイートが検出)。swUpdateRequested ガードが必須。
        let reloadedAfterUpdate = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!swUpdateRequested || reloadedAfterUpdate) return;
          reloadedAfterUpdate = true;
          location.reload();
        });
      },
      { once: true },
    );
  }
}

// ===== PWA インストール導線 =====
interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function isStandaloneDisplay(): boolean {
  const standaloneNav = (navigator as Navigator & { standalone?: boolean }).standalone;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    standaloneNav === true
  );
}

function initInstallPrompt(): void {
  // Capacitor (ネイティブアプリ) 内では「ホーム画面に追加」の概念自体が無意味。
  // UA に iPhone を含むため iOS Safari 向け案内バナーが誤表示されるのを防ぐ
  // (エージェント自己申告の抜けを fable レビューで補完)。
  if (isCapacitorNative()) return;
  if (isStandaloneDisplay()) return;

  let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

  const showInstallButton = (): void => {
    if (document.getElementById("install-btn")) return;
    const actions = document.querySelector(".header-actions");
    if (!actions) return;
    const btn = document.createElement("button");
    btn.id = "install-btn";
    btn.className = "header-btn";
    btn.type = "button";
    btn.title = t("pwa.install.title");
    btn.setAttribute("aria-label", t("pwa.install.aria"));
    btn.textContent = "📲";
    btn.addEventListener("click", () => {
      const prompt = deferredInstallPrompt;
      if (!prompt) return;
      prompt.prompt();
      prompt.userChoice
        .catch(() => {
          /* 選択取得失敗は無視 */
        })
        .finally(() => {
          deferredInstallPrompt = null;
          btn.remove();
        });
    });
    actions.appendChild(btn);
  };

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.getElementById("install-btn")?.remove();
  });

  // iOS Safari は beforeinstallprompt 非対応 → 初回訪問時のみ案内バナーを表示
  const IOS_INSTALL_HINT_KEY = "poker-icm-ios-install-hint";
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    let alreadyShown = false;
    try {
      alreadyShown = localStorage.getItem(IOS_INSTALL_HINT_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (!alreadyShown) {
      const banner = document.createElement("div");
      banner.className = "ios-install-banner";
      const text = document.createElement("span");
      text.textContent = t("pwa.iosBanner.text");
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "ios-install-banner-close";
      closeBtn.setAttribute("aria-label", t("pwa.close.aria"));
      closeBtn.textContent = "✕";
      const dismiss = (): void => {
        banner.remove();
        try {
          localStorage.setItem(IOS_INSTALL_HINT_KEY, "1");
        } catch {
          /* ignore */
        }
      };
      closeBtn.addEventListener("click", dismiss);
      banner.appendChild(text);
      banner.appendChild(closeBtn);
      getBottomToastStack().appendChild(banner);
    }
  }
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

/** テーマ・PWA インストール導線・オフラインバナー・フッターバージョンの初期化。main.ts から一度だけ呼ぶ。 */
export function initPwa(): void {
  initTheme();
  initServiceWorker();
  initInstallPrompt();
  initOfflineBanner();
  initFooterVersion();
}
