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

  // ===== 12. 深掘りバグ監査の回帰テスト =====
  // - 英語UIで全員スタック0時に日本語エラーが出ず、古いBFマップも消える
  // - 3人卓で7位まで賞金を入れてもICM取り分%の合計が100%になる
  // - BB<=ante (HU BTN 10BB / BB 0.8BB, ante 1) でNashタブが空白にならない
  // - KO→Nashレンジ適用→PKO切替で古いNash案内が消える
  // - #bb-size-input フォーカス中のプリセット反映＆iOS自動ズーム防止フォントサイズ(>=16px)
  {
    const context = await createContext({ onboardingDone: true, pro: true, practice: false });
    await context.addInitScript(() => localStorage.setItem("poker-icm-lang", "en"));
    try {
      const page = await context.newPage();
      const errors = attachErrorCollector(page, "deep-bug-audit-en");
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(baseURL, { waitUntil: "load" });
      await page.waitForSelector(".player-row", { state: "visible" });

      // iOS 自動ズーム防止: 1 BB 入力と手札セレクトが 16px 以上
      await page.click('[data-stack-unit="chips"]');
      const fontSizes = await page.evaluate(() => ({
        bbInput: parseFloat(getComputedStyle(document.getElementById("bb-size-input")).fontSize),
        handPick: parseFloat(getComputedStyle(document.getElementById("hand-pick-r1")).fontSize),
      }));
      if (fontSizes.bbInput < 16 || fontSizes.handPick < 16) {
        throw new Error(`iOS 自動ズーム防止の 16px 未満です: ${JSON.stringify(fontSizes)}`);
      }
      // フォーカス維持のまま 10k プリセットを押しても #bb-size-input 表示値が追従する
      await page.evaluate(() => {
        const input = document.getElementById("bb-size-input");
        input.focus();
        document.querySelector('[data-bb-preset="10000"]').click();
      });
      if ((await page.inputValue("#bb-size-input")) !== "10000") {
        throw new Error(`#bb-size-input フォーカス中のプリセット反映に失敗: ${await page.inputValue("#bb-size-input")}`);
      }
      await page.click('[data-stack-unit="bb"]');

      // 3人卓で7位まで賞金を入れても ICM 表の取り分 % 合計が 100%
      await page.click("#payouts-fold > summary");
      await page.click('button[data-preset="40,25,15,10,5,3,2"]');
      await page.click('[data-jump="sec-icm"]');
      const shareSum = await page.evaluate(() => {
        const cells = [...document.querySelectorAll("#icm-rows tr td:last-child")];
        return cells.reduce((acc, td) => acc + parseFloat(td.textContent || "0"), 0);
      });
      if (Math.abs(shareSum - 100) > 0.3) {
        throw new Error(`3人卓×7位まで賞金で ICM 取り分合計が 100% になりません: ${shareSum.toFixed(1)}%`);
      }

      // 全員スタック 0 → 英語エラー (日本語文字なし) かつ BF マップもクリアされる
      const stacks = page.locator(".player-stack");
      for (let i = 0; i < (await stacks.count()); i++) await stacks.nth(i).fill("0");
      const icmZeroText = await page.locator("#icm-rows").innerText();
      const bfAfterZero = (await page.locator("#bf-matrix").innerHTML()).trim();
      if (/[ぁ-んァ-ヶ一-龠]/.test(icmZeroText) || !icmZeroText.toLowerCase().includes("stack")) {
        throw new Error(`全員スタック0のエラー文が不適切: "${icmZeroText}"`);
      }
      if (bfAfterZero !== "") {
        throw new Error(`全員スタック0で古い BF マップが残っています: length=${bfAfterZero.length}`);
      }

      // KO で Nash レンジ適用後、PKO へ切り替えると古い案内が消える
      if (!(await page.locator("#scenario-presets-toggle").evaluate((el) => el.open))) {
        await page.click("#scenario-presets-toggle > summary");
      }
      await page.click('.scenario-btn[data-scenario="ft3"]');
      await page.click("#bounty-fold > summary");
      await page.click('[data-bounty-mode="ko"]');
      await page.fill("#bounty-all", "20");
      await page.click("#bounty-all-apply");
      await page.click('[data-jump="sec-hand"]');
      await page.click("#use-nash-range");
      await page.waitForSelector("#nash-range-note:not(.hidden)", { state: "visible" });
      await page.click('[data-bounty-mode="pko"]');
      if (await page.locator("#nash-range-note").isVisible()) {
        throw new Error("バウンティ形式 (KO→PKO) を変えたのに古い Nash レンジ案内が残っています");
      }

      assertNoErrors(errors, "deep-bug-audit-en");
    } finally {
      await context.close();
    }
  }

  // BB <= ante (HU BTN 10BB / BB 0.8BB, ante 1.0) で Nash タブが空白にならず案内を出す
  {
    const { context, page, errors } = await openWithState({
      tag: "review-nash-bb-allin-ante",
      state: {
        players: [
          { stack: 10, role: "hero", position: "BTN" },
          { stack: 0.8, role: "villain", position: "BB" },
        ],
        payouts: [100],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      await page.click('[data-jump="sec-nash"]');
      await page.waitForFunction(
        () => (document.getElementById("nash-table-status")?.textContent ?? "").includes("2人以上"),
        null,
        { timeout: 10000 },
      );
      assertNoErrors(errors, "review-nash-bb-allin-ante");
    } finally {
      await context.close();
    }
  }

  // ===== 13. 第4弾監査の回帰テスト =====
  // - 第三者ショート BB (0.4BB < ante 1.0) で架空チップがポットに入らず 16.9BB になる
  // - 必要勝率カードに (BB) 単位表記がある
  // - カスタムレンジ全消去で空の hero-range-result 見出しが残らない
  // - BB 自動オールイン局面 (BTN 15 / SB 10 / BB 1.5, ante 1.0) で BB オーバーコールが 100.0%
  {
    const { context, page, errors } = await openWithState({
      tag: "audit-round4",
      state: {
        players: [
          { stack: 10, role: "hero", position: "BTN" },
          { stack: 8, role: "villain", position: "CO" },
          { stack: 12, role: "other", position: "SB" },
          { stack: 0.4, role: "other", position: "BB" },
        ],
        payouts: [50, 30, 20],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      await page.click('[data-jump="sec-icm"]');
      const eqCallLabel = await page.textContent("#eq-call-label");
      if (!eqCallLabel?.includes("(BB)")) {
        throw new Error(`コール額ラベルに (BB) 単位がありません: "${eqCallLabel}"`);
      }
      await page.click("#autofill-hint summary");
      const hintText = await page.locator("#autofill-hint").innerText();
      if (!hintText.includes("16.9")) {
        throw new Error(`第三者ショート BB (0.4BB) のポット合計が 16.9 BB になっていません: "${hintText}"`);
      }

      // カスタムレンジ全消去で .hero-range-result ごと隠れる
      await page.click('[data-jump="sec-hand"]');
      await page.click('.mode-tab[data-mode="custom"]');
      await page.click("#custom-clear");
      if (await page.locator(".hero-range-result").isVisible()) {
        throw new Error("カスタムレンジ全消去時に .hero-range-result の空見出しが残っています");
      }

      assertNoErrors(errors, "audit-round4");
    } finally {
      await context.close();
    }
  }

  // BTN 15 / SB 10 / BB 1.5 (ante 1.0): 自動オールイン済みの BB はオーバーコールも 100.0%
  {
    const { context, page, errors } = await openWithState({
      tag: "audit-round4-bb-forced-allin",
      state: {
        players: [
          { stack: 15, role: "other", position: "BTN" },
          { stack: 10, role: "hero", position: "SB" },
          { stack: 1.5, role: "villain", position: "BB" },
        ],
        payouts: [50, 30, 20],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      await page.click('[data-jump="sec-nash"]');
      await page.waitForFunction(
        () => document.querySelectorAll("#nash-table .nash-row").length > 0 && document.getElementById("nash-table-status")?.textContent === "",
        null,
        { timeout: 20000 },
      );
      const nashText = await page.locator("#nash-table").innerText();
      if (!nashText.includes("BB 100.0%")) {
        throw new Error(`自動オールイン済み BB のオーバーコールが 100.0% になっていません: "${nashText}"`);
      }

      assertNoErrors(errors, "audit-round4-bb-forced-allin");
    } finally {
      await context.close();
    }
  }

  // ===== 14. 第5弾監査の回帰テスト =====
  // - 小数スタック (BB 10 vs SB 1.25) で丸め誤差による負 RP (-1.0%) が出ず +0.2% になる
  // - 0.05BB 未満コール (BB 10 vs SB 1.04) で "0.0" 扱いにならず正常に計算・表示される
  // - 2人卓ポジション未設定で架空の第3者 SB/BB デッドマネーが足されない
  // - 0% Nash レンジ適用でプリセット 25% に無言上書きされない
  // - pushBack で既にオールイン済みの BB (2.0BB, ante 1) が相手コール率 100% になる
  // - BB=0 脱落席でも Nash が HU 相当の妥当なコールレンジになる
  {
    const { context, page, errors } = await openWithState({
      tag: "audit-round5-fractional-call",
      state: {
        players: [
          { stack: 10, role: "hero", position: "BB" },
          { stack: 1.25, role: "villain", position: "SB" },
          { stack: 10, role: "other", position: "BTN" },
        ],
        payouts: [50, 30, 20],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      const summaryText = await page.locator("#hero-summary").innerText();
      if (!summaryText.includes("7.1%") || !summaryText.includes("+0.2%")) {
        throw new Error(`小数スタックの cEV/RP が丸め誤差でズレています: "${summaryText}"`);
      }
      assertNoErrors(errors, "audit-round5-fractional-call");
    } finally {
      await context.close();
    }
  }

  {
    const { context, page, errors } = await openWithState({
      tag: "audit-round5-tiny-call",
      state: {
        players: [
          { stack: 10, role: "hero", position: "BB" },
          { stack: 1.04, role: "villain", position: "SB" },
          { stack: 10, role: "other", position: "BTN" },
        ],
        payouts: [50, 30, 20],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      const callVal = await page.inputValue("#call");
      const summaryActive = await page.locator("#hero-summary.active").count();
      if (callVal !== "0.04" || summaryActive !== 1) {
        throw new Error(`0.04BB コールが誤って無効化されています: call="${callVal}", summaryActive=${summaryActive}`);
      }
      assertNoErrors(errors, "audit-round5-tiny-call");
    } finally {
      await context.close();
    }
  }

  {
    const { context, page, errors } = await openWithState({
      tag: "audit-round5-2p-unset-pos",
      state: {
        players: [
          { stack: 10, role: "hero", position: "" },
          { stack: 10, role: "villain", position: "" },
        ],
        payouts: [100],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      await page.click('[data-jump="sec-icm"]');
      await page.click("#autofill-hint summary");
      const hintText = await page.locator("#autofill-hint").innerText();
      if (hintText.includes("降りている")) {
        throw new Error(`2人卓ポジション未設定で架空の第3者ブラインドが計上されています: "${hintText}"`);
      }
      assertNoErrors(errors, "audit-round5-2p-unset-pos");
    } finally {
      await context.close();
    }
  }

  {
    const { context, page, errors } = await openWithState({
      tag: "audit-round5-zero-nash-range",
      state: {
        players: [
          { stack: 25, role: "villain", position: "BB" },
          { stack: 25, role: "hero", position: "SB" },
          { stack: 25, role: "other", position: "BTN" },
          { stack: 0.5, role: "other", position: "CO" },
        ],
        payouts: [33, 33, 33],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      await page.click("#use-nash-range");
      await page.waitForFunction(
        () => {
          const btn = document.getElementById("use-nash-range");
          return btn && !btn.hasAttribute("disabled");
        },
        null,
        { timeout: 15000 },
      );
      const selected = await page.locator("#custom-selected").innerText();
      const noteVisible = await page.locator("#nash-range-note").isVisible();
      if (!selected.includes("0 種類") || !noteVisible) {
        throw new Error(`0% Nash レンジがプリセットに上書きされています: selected="${selected}", noteVisible=${noteVisible}`);
      }
      assertNoErrors(errors, "audit-round5-zero-nash-range");
    } finally {
      await context.close();
    }
  }

  {
    const { context, page, errors } = await openWithState({
      tag: "audit-round5-pushback-forced-call",
      state: {
        players: [
          { stack: 14, role: "hero", position: "SB" },
          { stack: 2, role: "villain", position: "BB" },
          { stack: 20, role: "other", position: "BTN" },
        ],
        payouts: [50, 30, 20],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      await page.click('#grid-hero .hand-cell[title="72o"]');
      const detail = await page.locator("#hand-cell-detail").innerText();
      if (!detail.includes("相手コール率 100%")) {
        throw new Error(`強制オールイン BB に対し相手コール率が 100% になっていません: "${detail}"`);
      }
      assertNoErrors(errors, "audit-round5-pushback-forced-call");
    } finally {
      await context.close();
    }
  }

  {
    const { context, page, errors } = await openWithState({
      tag: "audit-round5-nash-dead-bb",
      state: {
        players: [
          { stack: 20, role: "other", position: "BTN" },
          { stack: 14, role: "villain", position: "SB" },
          { stack: 0, role: "hero", position: "BB" },
        ],
        payouts: [50, 30],
        nash: { sb: 0.5, bb: 1, ante: 1 },
      },
    });
    try {
      await page.click('[data-jump="sec-nash"]');
      await page.waitForFunction(
        () => document.querySelectorAll("#nash-table .nash-row").length > 0 && document.getElementById("nash-table-status")?.textContent === "",
        null,
        { timeout: 20000 },
      );
      const btnPushPctText = await page.locator("#nash-table .nash-row.push .nash-row-pct").first().innerText();
      const sbCallPctText = await page.locator("#nash-table .nash-row.call .nash-row-pct").first().innerText();
      const btnPushPct = Number.parseFloat(btnPushPctText);
      const sbCallPct = Number.parseFloat(sbCallPctText);
      if (!(btnPushPct < 50 && sbCallPct >= 8)) {
        throw new Error(`BB=0 脱落席の Nash が HU 相当になっていません: push="${btnPushPctText}", call="${sbCallPctText}"`);
      }
      assertNoErrors(errors, "audit-round5-nash-dead-bb");
    } finally {
      await context.close();
    }
  }

  // ===== 15. v1.5.4 回帰テスト =====
  // - 初回訪問時: オンボーディング Step2 CTA がプライマリ表現、閉じた後に #first-hint-bar が表示され
  //   1タップで無料 PKO 例題 (ft6Pko) を適用できる
  // - 無料 PKO 例題: 必要勝率が 34.7% に急落・バウンティ行に例題表示・額タップ/モード切替で bounty トリガーペイウォールが開く
  // - ペイウォール刷新: トリガー別見出し・Before/After比較・ROI訴求・.paywall-one-time・規約リンク表示
  // - ヘッダー常設 Pro ボタン & ガイド内 Pro / App Store 評価リンク (無料表示 / Pro 非表示)
  // - チョップ共有コピー末尾に綺麗なグローバル App Store URL が付く
  // - 390px / 320px の日英で横はみ出しゼロ
  {
    const context = await createContext({ onboardingDone: false, pro: false, practice: false });
    try {
      const page = await context.newPage();
      await page.setViewportSize({ width: 390, height: 844 });
      const errors = attachErrorCollector(page, "v154-free-growth-ja");
      await page.goto(baseURL, { waitUntil: "load" });

      // Step1 -> Step2 -> プライマリ CTA で閉じる
      await page.waitForSelector("#onboarding-next-btn", { state: "visible" });
      await page.click("#onboarding-next-btn");
      const ctaVisible = await page.locator("#onboarding-cta-setup").isVisible();
      const ctaBg = await page.locator("#onboarding-cta-setup").evaluate((el) => getComputedStyle(el).backgroundColor);
      if (!ctaVisible || ctaBg === "rgb(24, 35, 31)") {
        throw new Error(`#onboarding-cta-setup がプライマリ表現になっていません: visible=${ctaVisible} bg=${ctaBg}`);
      }
      await page.click("#onboarding-cta-setup");

      // 初回ヒントバーが表示され、1タップで PKO 例題を適用できる
      await page.waitForSelector("#first-hint-bar", { state: "visible" });
      await page.click('#first-hint-bar [data-quick-scenario="ft6Pko"]');
      await page.waitForFunction(() => document.querySelectorAll("#players-list .player-row").length === 6);
      const reqPko = (await page.locator("#hero-summary .hero-summary-item.primary .hero-summary-value").innerText()).trim();
      if (!reqPko.includes("34.7%")) {
        throw new Error(`無料 PKO 例題 (ft6Pko) の必要勝率が 34.7% になっていません: "${reqPko}"`);
      }

      // バウンティ折りたたみ内に例題プレビューと readonly 入力欄があり、タップで bounty ペイウォールが開く
      const bountySummary = (await page.locator("#bounty-summary").innerText()).trim();
      if (!bountySummary.includes("PKO") || !bountySummary.includes("例題")) {
        throw new Error(`無料 PKO 例題のバウンティ要約が不適切: "${bountySummary}"`);
      }
      await page.click("#bounty-fold > summary");
      await page.waitForSelector("#bounty-list .bounty-amount", { state: "visible" });
      await page.locator("#bounty-list .bounty-amount").first().click();
      await page.waitForSelector("#paywall-modal:not(.hidden)", { state: "visible" });
      const pwTitle = (await page.locator("#paywall-title").innerText()).trim();
      const pwOneTime = (await page.locator("#paywall-modal .paywall-one-time").innerText()).trim();
      const pwCompare = (await page.locator("#paywall-modal .paywall-compare").innerText()).trim();
      const pwRoi = (await page.locator("#paywall-modal .paywall-roi").innerText()).trim();
      if (!pwTitle.includes("バウンティ") || !pwOneTime.includes("買い切り") || !pwCompare.includes("34.7%") || !pwRoi.includes("元が取れます")) {
        throw new Error(`bounty トリガーのペイウォール内容が不十分: title="${pwTitle}" oneTime="${pwOneTime}" roi="${pwRoi}"`);
      }
      // モーダル下部から規約モーダルが開く
      await page.click("#paywall-legal-link");
      await page.waitForSelector("#legal-modal:not(.hidden)", { state: "visible" });
      await page.click("#legal-modal-close");
      await page.click("#paywall-close");

      // ヘッダー常設 Pro ボタン: 無料では表示され、タップで header トリガーのペイウォールが開く
      if (!(await page.locator("#header-pro-btn").isVisible())) {
        throw new Error("無料状態でヘッダーの Pro ボタンが見えません");
      }
      await page.click("#header-pro-btn");
      await page.waitForSelector("#paywall-modal:not(.hidden)", { state: "visible" });
      const headerPwTitle = (await page.locator("#paywall-title").innerText()).trim();
      if (!headerPwTitle.includes("9-max")) {
        throw new Error(`header トリガーのペイウォール見出しが不適切: "${headerPwTitle}"`);
      }
      await page.click("#paywall-close");

      // ガイドモーダルに Pro ボタンと App Store 評価リンクがある
      await page.click("#help-btn");
      await page.waitForSelector("#guide-modal:not(.hidden)", { state: "visible" });
      if (!(await page.locator("#guide-pro-btn").isVisible())) {
        throw new Error("ガイドモーダルに常設 Pro ボタンがありません");
      }
      const reviewHref = await page.locator("#guide-review-link").getAttribute("href");
      if (reviewHref !== "https://apps.apple.com/app/id6793358140?action=write-review") {
        throw new Error(`ガイドの評価リンク先が不正: "${reviewHref}"`);
      }
      await page.click("#guide-modal-close");

      // チョップ共有コピー末尾に App Store URL が含まれる
      await page.click('[data-jump="sec-chop"]');
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: async (txt) => { window.__copiedChopV154 = txt; } },
        });
      });
      await page.click("#chop-copy-btn");
      await page.waitForFunction(() => Boolean(window.__copiedChopV154));
      const copiedV154 = await page.evaluate(() => window.__copiedChopV154);
      if (!copiedV154.trim().endsWith("https://apps.apple.com/app/id6793358140")) {
        throw new Error(`チョップ共有末尾に App Store URL がありません: "${copiedV154}"`);
      }

      // 320px / 390px 日英で横はみ出しゼロ
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
          throw new Error(`v1.5.4 JA ${width}px で横はみ出し`);
        }
      }
      await page.click("#lang-toggle");
      await page.waitForFunction(() => document.documentElement.lang === "en");
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
          throw new Error(`v1.5.4 EN ${width}px で横はみ出し`);
        }
      }
      assertNoErrors(errors, "v154-free-growth-ja");
    } finally {
      await context.close();
    }
  }

  // Pro 状態ではヘッダーとガイドの Pro ボタンが非表示になる
  {
    const { context, page, errors } = await openWithState({ pro: true, tag: "v154-pro-hidden-entry" });
    try {
      if (await page.locator("#header-pro-btn").isVisible()) {
        throw new Error("Pro 状態なのにヘッダーの Pro ボタンが表示されています");
      }
      await page.click("#help-btn");
      await page.waitForSelector("#guide-modal:not(.hidden)", { state: "visible" });
      if (await page.locator("#guide-pro-btn").isVisible()) {
        throw new Error("Pro 状態なのにガイドの Pro ボタンが表示されています");
      }
      assertNoErrors(errors, "v154-pro-hidden-entry");
    } finally {
      await context.close();
    }
  }
}
