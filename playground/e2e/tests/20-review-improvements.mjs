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

  // 5. pushBack 時のフッターCTA・入力ラベル・20BB超の深さ警告がオールイン向きになる
  const openWithState = async ({ pro = true, state = null, tag = "review" } = {}) => {
    const context = await createContext({ onboardingDone: true, pro, practice: false });
    if (state) {
      await context.addInitScript(
        (s) => localStorage.setItem("poker-icm-app-state-v1", JSON.stringify(s)),
        state,
      );
    }
    const page = await context.newPage();
    const errors = attachErrorCollector(page, tag);
    await page.goto(baseURL, { waitUntil: "load" });
    await page.waitForSelector(".player-row", { state: "visible" });
    return { context, page, errors };
  };

  {
    const { context, page, errors } = await openWithState({
      tag: "review-pushback-copy",
      state: {
        players: [
          { stack: 25, role: "hero", position: "SB" },
          { stack: 25, role: "villain", position: "BB" },
          { stack: 20, role: "other", position: "BTN" },
        ],
        payouts: [50, 30, 20],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      const flowCta = await page.textContent("#flow-equity-details");
      if (!flowCta?.includes("必要勝率・ICM")) {
        throw new Error(`pushBack で Hand タブ下部CTAがコール表記のまま: ${flowCta}`);
      }
      await page.click('[data-jump="sec-icm"]');
      const eqLabel = await page.textContent("#eq-call-label");
      const depthWarn = await page.textContent("#depth-warn-eq");
      if (!eqLabel?.includes("追加で出す額")) {
        throw new Error(`pushBack で入力ラベルがコール額のまま: ${eqLabel}`);
      }
      if (!depthWarn?.includes("2BB オープン") || depthWarn.includes("オールインされた後のコール判断")) {
        throw new Error(`pushBack で深さ警告がコール向きのまま: ${depthWarn}`);
      }
      assertNoErrors(errors, "review-pushback-copy");
    } finally {
      await context.close();
    }
  }

  // 6. バウンティ一括適用は1回の Undo で戻り、負数入力は blur で正規化される
  {
    const { context, page, errors } = await openWithState({ tag: "review-bounty-undo" });
    try {
      await page.click("#bounty-fold > summary");
      await page.click('[data-bounty-mode="ko"]');
      // KO 切替で Undo が1件積まれた状態から、全員一括適用は1ステップのみ増える
      await page.fill("#bounty-all", "25");
      await page.click("#bounty-all-apply");
      const afterApply = await page.textContent("#bounty-summary");
      if (!afterApply?.includes("25 / 25 / 25")) {
        throw new Error(`バウンティ一括適用が反映されていません: ${afterApply}`);
      }
      await page.click("#setup-undo");
      const afterOneUndo = await page.textContent("#bounty-summary");
      if (afterOneUndo?.includes("25")) {
        throw new Error(`一括適用後の1回の Undo で戻っていません (重複積みの疑い): ${afterOneUndo}`);
      }
      await page.fill("#bounty-all", "-10");
      await page.locator("#bounty-all").blur();
      const normalized = await page.inputValue("#bounty-all");
      if (normalized !== "") {
        throw new Error(`#bounty-all の負数が blur で消えていません: ${normalized}`);
      }
      assertNoErrors(errors, "review-bounty-undo");
    } finally {
      await context.close();
    }
  }

  // 7. 無料ユーザーに KO 保存値が残っていても「なし」が選択状態になる
  {
    const { context, page, errors } = await openWithState({
      pro: false,
      tag: "review-free-bounty-mode",
      state: {
        players: [
          { stack: 18, role: "hero", position: "BB", bounty: 10 },
          { stack: 14, role: "villain", position: "SB", bounty: 10 },
          { stack: 20, role: "other", position: "BTN", bounty: 10 },
        ],
        payouts: [50, 30, 20],
        nash: { sb: 0.5, bb: 1, ante: 1 },
        bounty: { mode: "ko" },
      },
    });
    try {
      await page.click("#bounty-fold > summary");
      const offPressed = await page.getAttribute('[data-bounty-mode="off"]', "aria-pressed");
      const koPressed = await page.getAttribute('[data-bounty-mode="ko"]', "aria-pressed");
      if (offPressed !== "true" || koPressed !== "false") {
        throw new Error(`無料時のバウンティ選択表示が不整合: off=${offPressed} ko=${koPressed}`);
      }
      // KO タップでペイウォールが開き、買い切り・月額なしの注記が出る
      await page.click('[data-bounty-mode="ko"]');
      await page.waitForSelector("#paywall-modal:not(.hidden)", { state: "visible" });
      const oneTimeText = await page.textContent("#paywall-modal .paywall-one-time");
      if (!oneTimeText?.includes("買い切り")) {
        throw new Error(`ペイウォールに買い切り注記がありません: ${oneTimeText}`);
      }
      assertNoErrors(errors, "review-free-bounty-mode");
    } finally {
      await context.close();
    }
  }

  // 8. 末尾席 BB=0 (1人しかスタック>0がいない) のとき Nash タブが空白にならず案内を出す
  {
    const { context, page, errors } = await openWithState({
      tag: "review-nash-trailing-zero",
      state: {
        players: [
          { stack: 10, role: "hero", position: "SB" },
          { stack: 0, role: "villain", position: "BB" },
        ],
        payouts: [100],
        nash: { sb: 0.5, bb: 1, ante: 0 },
      },
    });
    try {
      await page.click('[data-jump="sec-nash"]');
      await page.waitForTimeout(200);
      const status = await page.textContent("#nash-table-status");
      if (!status?.includes("2人以上")) {
        throw new Error(`BB=0 (有効1人) で Nash に案内が出ていません: ${status}`);
      }
      assertNoErrors(errors, "review-nash-trailing-zero");
    } finally {
      await context.close();
    }
  }

  // 9. Pro の賞金保存・局面保存・局面削除が標準 prompt/confirm ではなくアプリ内モーダルで動く
  {
    const { context, page, errors } = await openWithState({ pro: true, tag: "review-inapp-dialogs" });
    let nativeDialogFired = null;
    page.on("dialog", async (dialog) => {
      nativeDialogFired = dialog.type();
      await dialog.dismiss();
    });
    try {
      // 賞金保存
      await page.click("#payouts-fold > summary");
      await page.click("#save-payout");
      await page.waitForSelector("#app-dialog-modal", { state: "visible" });
      if (!(await page.isDisabled("#dialog-confirm-btn"))) {
        throw new Error("空欄のあいだは保存ボタンが無効であるべきです");
      }
      await page.fill("#dialog-prompt-input", "JOPTテスト");
      await page.click("#dialog-confirm-btn");
      await page.waitForSelector("#app-dialog-modal", { state: "detached" });
      const savedPayoutText = await page.textContent("#saved-payouts");
      if (!savedPayoutText?.includes("JOPTテスト")) {
        throw new Error(`アプリ内モーダルから賞金が保存されていません: ${savedPayoutText}`);
      }

      // 賞金削除: 確認モーダルが開き、キャンセルで残存 → 削除確定で消える
      await page.click("#saved-payouts .del");
      await page.waitForSelector("#app-dialog-modal .dialog-btn-danger", { state: "visible" });
      await page.click("#app-dialog-modal .dialog-btn-cancel");
      await page.waitForSelector("#app-dialog-modal", { state: "detached" });
      if (!(await page.textContent("#saved-payouts"))?.includes("JOPTテスト")) {
        throw new Error("賞金削除をキャンセルしたのに消えてしまいました");
      }
      await page.click("#saved-payouts .del");
      await page.waitForSelector("#app-dialog-modal .dialog-btn-danger", { state: "visible" });
      await page.click("#dialog-confirm-btn");
      await page.waitForSelector("#app-dialog-modal", { state: "detached" });
      if ((await page.textContent("#saved-payouts"))?.includes("JOPTテスト")) {
        throw new Error("削除確認モーダルで保存済み賞金が消えていません");
      }

      // 局面保存 → 削除確認モーダル (createContext 既定で presetsOpen=true のため閉じていれば開く)
      if (!(await page.locator("#scenario-presets-toggle").evaluate((el) => el.open))) {
        await page.click("#scenario-presets-toggle > summary");
      }
      await page.click("#save-scenario-btn");
      await page.waitForSelector("#app-dialog-modal", { state: "visible" });
      await page.fill("#dialog-prompt-input", "バブル確認");
      await page.click("#dialog-confirm-btn");
      await page.waitForSelector("#app-dialog-modal", { state: "detached" });
      const savedScenarioText = await page.textContent("#user-scenarios");
      if (!savedScenarioText?.includes("バブル確認")) {
        throw new Error(`アプリ内モーダルから局面が保存されていません: ${savedScenarioText}`);
      }

      await page.click("#user-scenarios .user-del");
      await page.waitForSelector("#app-dialog-modal .dialog-btn-danger", { state: "visible" });
      await page.click("#dialog-confirm-btn");
      await page.waitForSelector("#app-dialog-modal", { state: "detached" });
      const afterDel = await page.textContent("#user-scenarios");
      if (afterDel?.includes("バブル確認")) {
        throw new Error(`削除確認モーダルで局面が消えていません: ${afterDel}`);
      }
      if (nativeDialogFired) {
        throw new Error(`ブラウザ標準ダイアログ (${nativeDialogFired}) が開いてしまいました`);
      }
      assertNoErrors(errors, "review-inapp-dialogs");
    } finally {
      await context.close();
    }
  }

  // ===== 10. チョップ独立タブ・結果コピー・自分の手札クイック判定・4タブ収まり =====
  {
    const context = await createContext({ tutorialDone: true });
    try {
      const page = await context.newPage();
      const errors = attachErrorCollector(page, "ux-chop-tab-hand-picker");
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(baseURL, { waitUntil: "load" });

      // ヘッダーの ? ボタンは赤絵文字ではなく "?"
      const helpText = (await page.textContent("#help-btn"))?.trim();
      if (helpText !== "?") {
        throw new Error(`#help-btn の表示が "?" ではありません: "${helpText}"`);
      }

      // 自分の手札クイック判定: A + J + o → AJo、s 切替 → AJs、ペア A + A → AA (s/o 無効化)、解除
      await page.selectOption("#hand-pick-r1", "A");
      await page.selectOption("#hand-pick-r2", "J");
      await page.waitForSelector("#hand-cell-detail:not(.hidden)");
      const ajoDetail = await page.textContent("#hand-cell-detail");
      if (!ajoDetail?.includes("AJo")) {
        throw new Error(`A+J 選択で AJo の判定が出ません: "${ajoDetail}"`);
      }
      await page.click('[data-pick-suit="s"]');
      const ajsDetail = await page.textContent("#hand-cell-detail");
      if (!ajsDetail?.includes("AJs")) {
        throw new Error(`s 切替で AJs の判定が出ません: "${ajsDetail}"`);
      }
      await page.selectOption("#hand-pick-r2", "A");
      const aaDetail = await page.textContent("#hand-cell-detail");
      if (!aaDetail?.includes("AA")) {
        throw new Error(`A+A 選択で AA の判定が出ません: "${aaDetail}"`);
      }
      if (!(await page.isDisabled('[data-pick-suit="s"]'))) {
        throw new Error("ペア選択時に s ボタンが無効化されていません");
      }
      await page.click("#hand-pick-clear");
      if (await page.locator("#hand-cell-detail").isVisible()) {
        throw new Error("解除ボタンで手札詳細が閉じていません");
      }

      // グリッド側セルタップでもクイック選択欄と同期する
      await page.click('#grid-hero .hand-cell[title="KQs"]');
      const syncedR1 = await page.inputValue("#hand-pick-r1");
      const syncedR2 = await page.inputValue("#hand-pick-r2");
      const syncedS = await page.getAttribute('[data-pick-suit="s"]', "aria-pressed");
      if (syncedR1 !== "K" || syncedR2 !== "Q" || syncedS !== "true") {
        throw new Error(`セルタップ後に手札選択欄が同期しません: ${syncedR1}${syncedR2} s=${syncedS}`);
      }

      // チョップ独立タブ: 1 タップで #sec-chop のみ表示、#hero-summary は非表示、コピー操作が動く
      await page.click('[data-jump="sec-chop"]');
      if (!(await page.locator("#sec-chop").isVisible()) || (await page.locator("#sec-icm").isVisible())) {
        throw new Error("チョップタブが独立表示になっていません");
      }
      if (await page.locator("#hero-summary").isVisible()) {
        throw new Error("チョップタブでは #hero-summary を隠す想定です");
      }
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (txt) => {
              window.__copiedChop = txt;
            },
          },
        });
      });
      await page.click("#chop-copy-btn");
      await page.waitForFunction(() => Boolean(window.__copiedChop));
      const copied = await page.evaluate(() => window.__copiedChop);
      if (!copied.includes("Poker ICM") || !copied.includes("BB")) {
        throw new Error(`チョップコピー内容が想定と異なります: "${copied}"`);
      }
      const btnLabel = await page.textContent("#chop-copy-btn");
      if (!btnLabel?.includes("コピーしました")) {
        throw new Error(`コピー後の確認表示が出ません: "${btnLabel}"`);
      }

      // 320px 幅で日英とも横はみ出しゼロ
      const overflowJa = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflowJa) throw new Error("320px 日本語 4タブ画面で横はみ出し");
      await page.click("#lang-toggle");
      await page.waitForFunction(() => document.documentElement.lang === "en");
      const overflowEn = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflowEn) throw new Error("320px 英語 4タブ画面で横はみ出し");

      assertNoErrors(errors, "ux-chop-tab-hand-picker");
    } finally {
      await context.close();
    }
  }

  // ===== 11. BB / チップ単位切替 (ライブ実チップ入力・1 BB プリセット・チョップ表示・Undo・永続化) =====
  {
    const context = await createContext({ tutorialDone: true });
    try {
      const page = await context.newPage();
      const errors = attachErrorCollector(page, "ux-stack-unit-chips");
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(baseURL, { waitUntil: "load" });

      const firstBb = Number(await page.locator(".player-stack").first().inputValue());
      const reqBefore = await page.textContent("#hero-summary .hero-summary-item.primary .hero-summary-value");
      // BB → チップ切替: 既定 1 BB = 1000 で BB×1000 に換算、必要勝率は不変
      await page.click('[data-stack-unit="chips"]');
      await page.waitForSelector("#bb-size-bar:not(.hidden)");
      const firstChip = await page.locator(".player-stack").first().inputValue();
      const expectedChip = String(Math.round(firstBb * 1000));
      if (firstChip !== expectedChip) {
        throw new Error(`チップ切替時の換算が不正です: expected "${expectedChip}", got "${firstChip}"`);
      }
      const reqAfterToggle = await page.textContent("#hero-summary .hero-summary-item.primary .hero-summary-value");
      if (reqAfterToggle !== reqBefore) {
        throw new Error(`単位切替だけで必要勝率が変わりました: ${reqBefore} → ${reqAfterToggle}`);
      }

      // 10k プリセット → チップ数を保ちつつ 1 BB=10000 になり、元に戻すで 1000 に戻る
      await page.click('[data-bb-preset="10000"]');
      if ((await page.inputValue("#bb-size-input")) !== "10000") {
        throw new Error("10k プリセットが反映されていません");
      }
      await page.click("#setup-undo");
      if ((await page.inputValue("#bb-size-input")) !== "1000") {
        throw new Error("元に戻すで 1 BB が 1000 に戻りません");
      }

      // 10k に戻して実チップ 45000 を入力 → 内部 4.5BB・チョップ表に 45,000 表示
      await page.click('[data-bb-preset="10000"]');
      await page.locator(".player-stack").first().fill("45000");
      await page.click('[data-jump="sec-chop"]');
      const chopText = await page.textContent("#chop-rows");
      if (!chopText?.includes("45,000")) {
        throw new Error(`チョップ表にチップ表示 45,000 が出ません: "${chopText}"`);
      }

      // 割り切れない 1 BB (40,000 ÷ 3,000 = 13.3333...) でも長大な小数が出ず、入力途中の丸めズレも起きない
      await page.locator(".player-stack").first().fill("40000");
      await page.locator("#bb-size-input").click();
      await page.locator("#bb-size-input").fill("3");
      await page.locator("#bb-size-input").fill("3000");
      await page.locator("#bb-size-input").blur();
      if ((await page.locator(".player-stack").first().inputValue()) !== "40000") {
        throw new Error(`1 BB 編集中にチップ値がずれました: "${await page.locator(".player-stack").first().inputValue()}"`);
      }
      await page.click('[data-jump="sec-icm"]');
      const summaryText = await page.textContent("#hero-summary");
      if (summaryText?.includes("13.333") || !summaryText?.includes("13.3")) {
        throw new Error(`サマリーの BB 表記が丸められていません: "${summaryText}"`);
      }
      const bfHeaderText = await page.textContent("#bf-matrix");
      if (!bfHeaderText?.includes("40,000")) {
        throw new Error(`BF マップの見出しがチップ表示 40,000 に追従していません: "${bfHeaderText}"`);
      }
      await page.click('[data-bb-preset="10000"]');
      await page.locator(".player-stack").first().fill("45000");

      // リロードしてもチップモードと 1 BB = 10000 が保持される
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector("#bb-size-bar:not(.hidden)");
      if ((await page.inputValue("#bb-size-input")) !== "10000") {
        throw new Error("リロード後に 1 BB 設定が復元されません");
      }
      if ((await page.locator(".player-stack").first().inputValue()) !== "45000") {
        throw new Error("リロード後に 45000 チップが復元されません");
      }

      // 320px 幅でチップモード日英とも横はみ出しゼロ
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
        throw new Error("320px チップモード (日本語) で横はみ出し");
      }
      await page.click("#lang-toggle");
      await page.waitForFunction(() => document.documentElement.lang === "en");
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
        throw new Error("320px チップモード (英語) で横はみ出し");
      }

      // BB モードへ戻すと 4.5 に戻る
      await page.click('[data-stack-unit="bb"]');
      if ((await page.locator(".player-stack").first().inputValue()) !== "4.5") {
        throw new Error("BB モード復帰で 4.5 になりません");
      }
      assertNoErrors(errors, "ux-stack-unit-chips");
    } finally {
      await context.close();
    }
  }
}
