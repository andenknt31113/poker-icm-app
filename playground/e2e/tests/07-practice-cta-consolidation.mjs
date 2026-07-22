// 7. 練習タブの CTA 一本化 (Issue #14)
//
// 初見 (導入コース未完了・未スキップ) の練習タブでは、上のアクション列
// (🎲新しい問題 / 📚復習 / 🎓導入コース) を隠し、案内カードの
// 「始める」/「スキップ」の2択だけを CTA として見せる。
// スキップ後はアクション列が現れるが、復習リストが空 (0件) の間は
// 📚復習 ボタン自体を隠す。不正解を1つ作ると復習(1)として現れる。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

const MAX_ATTEMPTS = 30;

export default async function testPracticeCtaConsolidation({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: false, pro: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "practice-cta-consolidation");

    await page.goto(baseURL, { waitUntil: "load" });
    await page.click('.tab-btn[data-tab="practice"]');

    // ---- 1. 初見: CTA は「始める/スキップ」の2択のみ ----
    await page.waitForSelector(".tutorial-intro-card", { state: "visible" });
    const actionsTopHiddenBefore = await page.$eval("#practice-actions-top", (el) =>
      el.classList.contains("hidden"),
    );
    if (!actionsTopHiddenBefore) {
      throw new Error(
        "初見の練習タブで practice-actions-top が表示されています (CTA が2択になっていない)",
      );
    }
    const ctaButtonIds = await page.$$eval("#practice-area button", (btns) =>
      btns.map((b) => b.id).filter(Boolean),
    );
    const expectedCtas = ["tutorial-intro-start-btn", "tutorial-intro-skip-btn"];
    const sameSet =
      ctaButtonIds.length === expectedCtas.length &&
      expectedCtas.every((id) => ctaButtonIds.includes(id));
    if (!sameSet) {
      throw new Error(`初見の練習タブの CTA が想定と異なります: ${JSON.stringify(ctaButtonIds)}`);
    }

    // ---- 2. スキップ → ボタン列出現 / 復習(0) は非表示 ----
    await page.click("#tutorial-intro-skip-btn");
    await page.waitForSelector('.practice-actions .practice-btn[data-answer="call"]', {
      state: "visible",
    });
    const actionsTopVisibleAfterSkip = await page.$eval(
      "#practice-actions-top",
      (el) => !el.classList.contains("hidden"),
    );
    if (!actionsTopVisibleAfterSkip) {
      throw new Error("スキップ後も practice-actions-top が非表示のままです");
    }
    const reviewBtnHiddenAtZero = await page.$eval("#practice-review-btn", (el) =>
      el.classList.contains("hidden"),
    );
    if (!reviewBtnHiddenAtZero) {
      throw new Error("復習 0 件のはずなのに 📚復習 ボタンが表示されています");
    }

    // ---- 3. 不正解を1つ作る → 復習(1) が表示される ----
    // call/fold はランダム出題なので、正解率50%前提で「call」を固定で押し続け、
    // 不正解になる問題が出るまで新しい問題を引き直す (最大 MAX_ATTEMPTS 回)。
    let becameWrong = false;
    for (let i = 0; i < MAX_ATTEMPTS && !becameWrong; i++) {
      await page.click('.practice-actions .practice-btn[data-answer="call"]');
      await page.waitForSelector("#practice-feedback.correct, #practice-feedback.wrong", {
        state: "attached",
      });
      const isWrong = await page.$eval("#practice-feedback", (el) =>
        el.classList.contains("wrong"),
      );
      if (isWrong) {
        becameWrong = true;
        break;
      }
      await page.click("#practice-new-btn");
      await page.waitForSelector(
        '.practice-actions .practice-btn[data-answer="call"]:not([disabled])',
        { state: "visible" },
      );
    }
    if (!becameWrong) {
      throw new Error(`${MAX_ATTEMPTS} 回試行しても不正解を作れませんでした`);
    }

    await page.waitForFunction(() => {
      const el = document.getElementById("review-count");
      return !!el && el.textContent !== "0";
    });
    const reviewBtnVisibleAfterWrong = await page.$eval(
      "#practice-review-btn",
      (el) => !el.classList.contains("hidden"),
    );
    if (!reviewBtnVisibleAfterWrong) {
      throw new Error("不正解を作った後も 📚復習 ボタンが非表示のままです");
    }
    const reviewCountText = await page.textContent("#review-count");
    if (reviewCountText !== "1") {
      throw new Error(`復習件数が想定と異なります: "${reviewCountText}"`);
    }

    assertNoErrors(errors, "練習タブ CTA 一本化フロー");
  } finally {
    await context.close();
  }
}
