// 6. フッターのビルドバージョン表示 + ヘッダーレイアウト崩れ確認 (dark/light)
//
// Issue #15: 「Phase 0 動作確認 · @poker-icm/core」という開発中の文言を
// 「Poker ICM/BF · build <sha>」に差し替え、subtitle (値を変えるとリアル
// タイムに再計算されます) を削除した。ここでは
//   1. footer に "build " + 英数字のビルド SHA (dist ビルド時点の
//      git commit SHA、またはフォールバックの "dev") が表示されること
//   2. 利用規約・プライバシーポリシーのリンクが引き続き機能すること
//   3. subtitle 除去後もヘッダー (タイトル行 + アクションボタン列) が
//      重なったり崩れたりしていないこと (h1 とボタン列の bounding box が
//      overlap しない)
// を dark/light 両テーマで検証する。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testFooterVersion({ baseURL, createContext }) {
  for (const theme of ["dark", "light"]) {
    const context = await createContext({ theme, tutorialDone: true });
    try {
      const page = await context.newPage();
      const errors = attachErrorCollector(page, `theme=${theme}`);

      await page.goto(baseURL, { waitUntil: "load" });
      await page.waitForSelector("#footer-version", { state: "visible" });

      // subtitle は完全に削除されている
      const subtitleCount = await page.locator(".subtitle").count();
      if (subtitleCount !== 0) {
        throw new Error(`.subtitle が残存しています (count=${subtitleCount})`);
      }

      const footerText = await page.locator("#footer-version").textContent();
      if (!footerText || !/^Poker ICM\/BF · build [\w.-]+$/.test(footerText.trim())) {
        throw new Error(`footer の表記が想定と異なります: "${footerText}"`);
      }

      // 利用規約・プライバシーポリシーのリンクは維持されている
      const legalBtn = page.locator("#footer-legal-link");
      if ((await legalBtn.count()) === 0) {
        throw new Error("利用規約・プライバシーポリシーのボタンが見つかりません");
      }

      // ヘッダー: h1 とアクションボタン列が重なっていない (subtitle 削除で
      // レイアウトが崩れていないことの確認)
      const h1Box = await page.locator(".header-row h1").boundingBox();
      const actionsBox = await page.locator(".header-actions").boundingBox();
      if (!h1Box || !actionsBox) {
        throw new Error("header-row 内の要素が見つかりません");
      }
      const overlap = h1Box.x + h1Box.width > actionsBox.x + 1; // 1px 許容
      if (overlap) {
        throw new Error(
          `ヘッダーの見出しとアクションボタンが重なっています: h1=${JSON.stringify(h1Box)} actions=${JSON.stringify(actionsBox)}`,
        );
      }

      // ヘッダー直下の要素 (hero-summary) との間に十分な余白があること
      const headerBox = await page.locator("header").boundingBox();
      const heroBox = await page.locator("#hero-summary").boundingBox();
      if (!headerBox || !heroBox) {
        throw new Error("header / #hero-summary が見つかりません");
      }
      const gap = heroBox.y - (headerBox.y + headerBox.height);
      if (gap < 8) {
        throw new Error(`ヘッダーと本文の間の余白が想定より狭すぎます: gap=${gap}px`);
      }

      assertNoErrors(errors, `theme=${theme} でのフッター/ヘッダー確認`);
    } finally {
      await context.close();
    }
  }
}
