// ===== テーマ切替 (dark/light) =====
const THEME_KEY = "poker-icm-theme";
type Theme = "dark" | "light";
function applyTheme(t: Theme): void {
  if (t === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = t === "light" ? "☀️" : "🌙";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute("content", t === "light" ? "#f5f7fa" : "#0f1419");
  try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
}

function initTheme(): void {
  const savedTheme = ((): Theme => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "light" || v === "dark") return v;
    } catch { /* ignore */ }
    return window.matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  })();
  applyTheme(savedTheme);
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    applyTheme(cur === "dark" ? "light" : "dark");
  });
}

// ===== Service Worker 登録 (PWA) =====
function initServiceWorker(): void {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW 登録失敗は無視 */
      });
    });
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
    btn.title = "ホーム画面に追加";
    btn.setAttribute("aria-label", "インストール");
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
      text.textContent = "ホーム画面に追加でアプリとして使えます: 共有ボタン → ホーム画面に追加";
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "ios-install-banner-close";
      closeBtn.setAttribute("aria-label", "閉じる");
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
      document.body.appendChild(banner);
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
  banner.textContent = "📡 オフライン — 計算はすべて端末内で動作します";
  header.insertAdjacentElement("afterend", banner);
}

function initOfflineBanner(): void {
  window.addEventListener("online", updateOfflineBanner);
  window.addEventListener("offline", updateOfflineBanner);
  updateOfflineBanner();
}

/** テーマ・PWA インストール導線・オフラインバナーの初期化。main.ts から一度だけ呼ぶ。 */
export function initPwa(): void {
  initTheme();
  initServiceWorker();
  initInstallPrompt();
  initOfflineBanner();
}
