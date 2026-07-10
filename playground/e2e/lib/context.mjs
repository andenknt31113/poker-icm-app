// テスト用 BrowserContext ファクトリ。
//
// 既定でオンボーディングモーダルと練習タブの導入コース案内をスキップする
// localStorage フラグを addInitScript で仕込む (テストの本題と関係ないモーダルで
// 要素待ちが不安定になるのを防ぐため)。導入コース自体をテストする場合は
// { tutorialDone: false } を渡す。
//
// クリップボード権限は既定では何も付与しない (Playwright の Chromium は
// 既定で clipboard-write を拒否する)。これにより「URL共有」機能の
// navigator.clipboard.writeText() は常に失敗し、決定的にフォールバック
// (readonly input に URL を表示する分岐) に入るため、クリップボード権限の
// 付与タイミングに依存しない安定したテストになる。
export function makeContextFactory(browser) {
  return async function createContext(opts = {}) {
    const { theme, tutorialDone = true, onboardingDone = true } = opts;
    const context = await browser.newContext();
    await context.addInitScript(
      ({ theme, tutorialDone, onboardingDone }) => {
        try {
          if (onboardingDone) localStorage.setItem("poker-icm-onboarding-done", "1");
          if (tutorialDone) localStorage.setItem("poker-icm-tutorial-done", "1");
          if (theme) localStorage.setItem("poker-icm-theme", theme);
        } catch {
          /* ignore */
        }
      },
      { theme, tutorialDone, onboardingDone },
    );
    return context;
  };
}

/** page に console error / pageerror コレクターを取り付け、蓄積用の配列を返す。 */
export function attachErrorCollector(page, label) {
  const errors = [];
  const prefix = label ? `[${label}] ` : "";
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${prefix}[console] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    errors.push(`${prefix}[pageerror] ${err && err.message ? err.message : String(err)}`);
  });
  return errors;
}

export function assertNoErrors(errors, context) {
  if (errors.length > 0) {
    throw new Error(`${context} で console error / pageerror が検出されました:\n${errors.join("\n")}`);
  }
}
