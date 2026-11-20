// 20. 全体レビュー改善の回帰テスト:
//   - 初回案内を閉じた直後に「サンプル」札が即消える
//   - 均等賞金で BF=Infinity が「∞」・BFマップが「+50.0% / ∞」で表示される
//   - 負のアンティ入力で英語UIに日本語エラーが出たり ICM 表が消えたりしない
//   - 自分 BTN vs ショート BB (1.5BB, ante 1) の pushBack でプッシュ可能ハンドが出て、セルタップ検分できる
//   - 相手なし・手入力時に古い計算内訳が残らない
//   - 全員スタック 0 の Nash で「位置が足りない」誤案内が出ない
//   - RP の桁が上のカードと内訳で小数 1 桁に揃う
//   - 賞金と局面で「保存なし」の文言が揃う
//   - 375px 英語・無料・9人卓で None ボタンが切れない
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

export default async function testReviewImprovements({ baseURL, createContext }) {
  // 1. 初回案内を閉じた直後にサンプル札が即消える
  {
    const context = await createContext({ onboardingDone: false, pro: true, practice: false });
    try {
      const page = await context.newPage();
      const errors = attachErrorCollector(page, "review-onboarding-sample");
      await page.goto(baseURL, { waitUntil: "load" });
      await page.waitForSelector("#onboarding-skip", { state: "visible" });
      await page.click("#onboarding-skip");
      const badgeCount = await page.locator(".hero-summary-sample-badge").count();
      if (badgeCount !== 0) throw new Error(`初回案内を閉じた後もサンプル札が残っています (${badgeCount})`);
      assertNoErrors(errors, "review-onboarding-sample");
    } finally {
      await context.close();
    }
  }

  // 2. 英語 UI でのエッジケース一括検証
  {
    const context = await createContext({ onboardingDone: true, pro: true, practice: false });
    await context.addInitScript(() => localStorage.setItem("poker-icm-lang", "en"));
    try {
      const page = await context.newPage();
      await page.setViewportSize({ width: 390, height: 844 });
      const errors = attachErrorCollector(page, "review-edges-en");
      await page.goto(baseURL, { waitUntil: "load" });
      await page.waitForSelector(".player-row", { state: "visible" });

      // RP 桁の一致 (小数1桁)
      await page.click('[data-jump="sec-icm"]');
      const rpSummary = (await page.locator("#hero-summary [data-info='RP'] .hero-summary-value").innerText()).trim();
      const rpFlow = (await page.locator(".eq-flow-rp .eq-flow-value").innerText()).trim();
      if (rpSummary !== rpFlow) throw new Error(`RP の桁が一致しません: summary="${rpSummary}" vs flow="${rpFlow}"`);

      // 賞金と局面の「保存なし」の言い方が揃っている
      await page.locator("#payouts-fold summary").click();
      const savedPayoutText = (await page.locator("#saved-payouts").innerText()).trim();
      if (!savedPayoutText.includes("No saves yet.")) {
        throw new Error(`賞金の保存なし文言が揃っていません: "${savedPayoutText}"`);
      }

      // 均等賞金 [33,33,33] → Infinity 文字列ゼロ、∞ と +50.0%
      await page.click('button[data-preset="33,33,33"]');
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (/\bInfinity\b/.test(bodyText)) throw new Error("均等賞金で生の Infinity 文字列が出ています");
      const bfVal = (await page.locator("#hero-summary [data-info='BF'] .hero-summary-value").innerText()).trim();
      if (bfVal !== "∞") throw new Error(`サマリー BF が ∞ でない: "${bfVal}"`);
      const matrixText = await page.locator("#bf-matrix").innerText();
      if (!matrixText.includes("+50.0%") || !matrixText.includes("∞")) {
        throw new Error(`BF マップの ∞ 表示が不正: "${matrixText}"`);
      }

      // 負のアンティ入力 → ICM 表が維持され、日本語エラーが出ない
      await page.click('button[data-preset="50,30,20"]');
      await page.locator("#blinds-fold summary").click();
      await page.fill("#nash-ante", "-1");
      const icmRows = await page.locator("#icm-rows tr").count();
      const icmText = await page.locator("#icm-rows").innerText();
      if (icmRows !== 3 || /[ぁ-んァ-ヶ一-龠]/.test(icmText)) {
        throw new Error(`負のアンティで ICM 表が壊れました: rows=${icmRows}, text="${icmText}"`);
      }
      await page.fill("#nash-ante", "1");

      // 自分 BTN 20BB vs 相手 BB 1.5BB (ante 1) の pushBack → 0% にならず AA がプッシュ可＆タップ検分できる
      const rows = page.locator(".player-row");
      await rows.nth(0).locator(".role-btn[data-role='villain']").click();
      await rows.nth(2).locator(".role-btn[data-role='hero']").click();
      await rows.nth(0).locator(".player-stack").fill("1.5");
      await page.click('[data-jump="sec-hand"]');
      const callStats = await page.locator("#call-stats").innerText();
      if (/^0 hand types/.test(callStats.trim())) {
        throw new Error(`ショート BB 相手の pushBack が 0 ハンドになっています: "${callStats}"`);
      }
      await page.locator('#grid-hero .hand-cell[title="AA"]').click();
      const detail = await page.locator("#hand-cell-detail").innerText();
      if (!detail.includes("AA") || !detail.includes("Shove")) {
        throw new Error(`pushBack で AA タップ検分が出ません: "${detail}"`);
      }
      const legendHtml = await page.locator(".hand-grid-legend").innerHTML();
      if (!legendHtml.includes("🟥")) {
        throw new Error(`pushBack の凡例に赤 🟥 がありません: "${legendHtml}"`);
      }

      // 相手を None にしたとき、古い計算内訳が残らない
      await rows.nth(0).locator(".role-btn[data-role='other']").click();
      await page.click('[data-jump="sec-icm"]');
      const hintNoVillain = (await page.locator("#autofill-hint").innerText()).trim();
      if (hintNoVillain !== "") {
        throw new Error(`相手未指定で古い内訳が残っています: "${hintNoVillain}"`);
      }

      // 手入力時に古い自動算出の内訳 (Calculation breakdown) が残らない
      await rows.nth(0).locator(".role-btn[data-role='villain']").click();
      await rows.nth(0).locator(".player-stack").fill("14");
      await page.fill("#call", "5.0");
      const hintManual = (await page.locator("#autofill-hint").innerText()).trim();
      if (hintManual.includes("Calculation breakdown")) {
        throw new Error(`手入力時に古い自動算出の内訳が残っています: "${hintManual}"`);
      }

      // 全員スタック 0 で Nash → 「位置が足りない」誤案内・自動入力ボタンが出ない
      await rows.nth(0).locator(".player-stack").fill("0");
      await rows.nth(1).locator(".player-stack").fill("0");
      await rows.nth(2).locator(".player-stack").fill("0");
      await page.click('[data-jump="sec-nash"]');
      const nashStatus = await page.locator("#nash-table-status").innerText();
      const fillBtnCount = await page.locator("[data-fill-positions]").count();
      if (fillBtnCount !== 0 || nashStatus.includes("no position")) {
        throw new Error(`スタック 0 で位置不足の誤案内が出ています: status="${nashStatus}", btn=${fillBtnCount}`);
      }

      assertNoErrors(errors, "review-edges-en");
    } finally {
      await context.close();
    }
  }

  // 3. 375px (iPhone SE) 英語・無料・9人卓で None ボタンが切れずに収まる
  {
    const context = await createContext({ onboardingDone: true, pro: false, practice: false });
    await context.addInitScript(() => localStorage.setItem("poker-icm-lang", "en"));
    try {
      const page = await context.newPage();
      await page.setViewportSize({ width: 375, height: 667 });
      const errors = attachErrorCollector(page, "review-375-en-ft9");
      await page.goto(baseURL, { waitUntil: "load" });
      await page.waitForSelector(".scenario-btn[data-scenario='ft9']", { state: "visible" });
      await page.click(".scenario-btn[data-scenario='ft9']");
      await page.waitForFunction(() => document.querySelectorAll(".player-row").length === 9);

      const clipped = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const rows = [...document.querySelectorAll(".player-row")];
        const bad = [];
        for (const [i, row] of rows.entries()) {
          const roles = row.querySelector(".player-roles");
          const noneBtn = row.querySelector('.role-btn[data-role="other"]');
          if (!roles || !noneBtn) continue;
          const rRect = roles.getBoundingClientRect();
          const bRect = noneBtn.getBoundingClientRect();
          if (bRect.right > rRect.right + 1) bad.push(`row${i}: noneBtn(${bRect.right}) > roles(${rRect.right})`);
          if (row.scrollWidth > row.clientWidth + 1) bad.push(`row${i}: scrollWidth overflow`);
        }
        return { overflow, bad };
      });
      if (clipped.overflow > 1 || clipped.bad.length > 0) {
        throw new Error(`375px 英語9人卓でレイアウト切れ: ${JSON.stringify(clipped)}`);
      }
      assertNoErrors(errors, "review-375-en-ft9");
    } finally {
      await context.close();
    }
  }
}
