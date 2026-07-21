// 9. freemium ゲート (無料状態): スタック readonly / 追加でペイウォール /
//    プリセット計算結果は閲覧可 / 役割変更は可 / 共有URL閲覧可 / ペイウォール日英表示。
//
// このテストだけ pro フラグを立てない (= 無料状態) で走らせる。他の回帰テストは
// { pro: true } (ロック解除 = 現行挙動) で走る。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testFreemiumGate({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true }); // pro 省略 = 無料
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "freemium-gate");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.waitForSelector("#players-list .player-row", { state: "visible" });

    // ① スタック入力欄が readonly + 🔒 バッジ
    const stackReadonly = await page.$eval("#players-list .player-stack", (el) =>
      el.hasAttribute("readonly"),
    );
    if (!stackReadonly) throw new Error("無料時にスタック入力が readonly でない");
    const lockBadge = await page.$("#players-list .lock-badge");
    if (!lockBadge) throw new Error("無料時にスタック行の 🔒 バッジが表示されていない");

    // ② プレイヤー追加ボタン → ペイウォール表示 / プレイヤーは増えない
    const beforeCount = await page.$$eval("#players-list .player-row", (els) => els.length);
    await page.click("#add-player");
    await page.waitForSelector("#paywall-modal:not(.hidden)", { state: "visible" });
    const afterCount = await page.$$eval("#players-list .player-row", (els) => els.length);
    if (afterCount !== beforeCount) {
      throw new Error(`ペイウォール表示中にプレイヤーが追加された: ${beforeCount} → ${afterCount}`);
    }

    // ⑥ (ja) ペイウォールが日本語で表示される
    const titleJa = await page.textContent("#paywall-modal h3");
    if (!titleJa || !titleJa.includes("自分のテーブルを再現")) {
      throw new Error(`ペイウォール見出し(ja)が想定と異なる: "${titleJa}"`);
    }
    const webNoteJa = await page.textContent("#paywall-modal .paywall-web-note");
    if (!webNoteJa || !webNoteJa.includes("アプリ版")) {
      throw new Error(`ペイウォール本文(ja/web)が想定と異なる: "${webNoteJa}"`);
    }
    // 1 タップで閉じられる
    await page.click("#paywall-close");
    await page.waitForSelector("#paywall-modal.hidden", { state: "hidden" });

    // ④ 役割 (🎯/⚔️/None) の付け替えは無料でも可能
    const roleSel = '#players-list .player-row:nth-child(3) .role-btn[data-role="hero"]';
    await page.click(roleSel);
    const roleActive = await page.$eval(roleSel, (el) => el.classList.contains("active"));
    if (!roleActive) throw new Error("無料時に役割 (hero) の付け替えができていない");

    // ③ シナリオプリセット適用 → 計算結果タブで全結果が閲覧できる
    await page.click('.scenario-btn[data-scenario="ftBubble"]');
    await page.click('.tab-btn[data-tab="result"]');
    await page.waitForSelector("#hv-grid .hand-cell", { state: "visible" });
    await page.click('#hv-grid .hand-cell[title="AKs"]');
    await page.waitForSelector("#hv-banner:not(.hidden)", { state: "visible" });
    const bannerText = await page.textContent("#hv-banner");
    if (!bannerText || !bannerText.includes("AKs")) {
      throw new Error(`無料時に計算結果 (ハンド判定バナー) が閲覧できない: "${bannerText}"`);
    }

    // ⑤ 共有URLで開いたシナリオが (無料でも) 閲覧できる
    await page.click('.tab-btn[data-tab="setup"]');
    await page.click("#share-url-btn-top");
    await page.waitForSelector("#share-toast-url-input", { state: "visible" });
    const sharedUrl = await page.getAttribute("#share-toast-url-input", "value");
    if (!sharedUrl || !sharedUrl.includes("#s=")) {
      throw new Error(`共有URLの生成に失敗: "${sharedUrl}"`);
    }

    const context2 = await createContext({ tutorialDone: true }); // 無料状態で開く
    try {
      const page2 = await context2.newPage();
      const errors2 = attachErrorCollector(page2, "freemium-gate:shared");
      await page2.goto(sharedUrl, { waitUntil: "load" });
      await page2.waitForFunction(
        (n) => document.querySelectorAll("#players-list .player-row").length === n,
        4, // ftBubble = 4 人
        { timeout: 10_000 },
      );
      // 閲覧はできるが、無料なので編集はロック (readonly のまま)
      const sharedReadonly = await page2.$eval("#players-list .player-stack", (el) =>
        el.hasAttribute("readonly"),
      );
      if (!sharedReadonly) {
        throw new Error("共有URLで開いたシナリオが無料時に編集可能になっている (readonly でない)");
      }
      assertNoErrors(errors2, "共有URL閲覧 (無料・新コンテキスト)");
    } finally {
      await context2.close();
    }

    // ⑥ (en) 言語を英語へ切り替えてもペイウォールが表示される
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.click("#lang-toggle"),
    ]);
    await page.waitForSelector(".tab-btn", { state: "visible" });
    await page.click('.tab-btn[data-tab="setup"]');
    await page.waitForSelector("#add-player", { state: "visible" });
    await page.click("#add-player");
    await page.waitForSelector("#paywall-modal:not(.hidden)", { state: "visible" });
    const titleEn = await page.textContent("#paywall-modal h3");
    if (!titleEn || !titleEn.includes("Recreate your own table")) {
      throw new Error(`ペイウォール見出し(en)が想定と異なる: "${titleEn}"`);
    }
    const webNoteEn = await page.textContent("#paywall-modal .paywall-web-note");
    if (!webNoteEn || !webNoteEn.toLowerCase().includes("app version")) {
      throw new Error(`ペイウォール本文(en/web)が想定と異なる: "${webNoteEn}"`);
    }

    assertNoErrors(errors, "freemium ゲート (無料状態) フロー");
  } finally {
    await context.close();
  }
}
