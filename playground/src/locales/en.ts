// ===== 英語辞書 (Phase B) =====
// ja.ts と完全に同一のキー集合を持つ (test/i18n-parity.test.ts が機械チェック)。
// ポーカー英語の用語規約 (fable 指定):
//   必要勝率 = required equity / cEV = Chip EV / $EV = $EV (true required equity)
//   Bubble Factor・Risk Premium はそのまま / 実効スタック = effective stack
//   オールイン = shove(動詞) / all-in(名詞) / コール = call / フォールド = fold
//   順位を上げる = ladder up / 入賞 = in the money (ITM) / 残りN人 = {n} players left
//   教訓 = Takeaway / サテライトの掟 = The satellite rule: survival is everything
//   モード名: call/fold 判定 = Call decision / push 判定 = Push decision / RP 当て = Guess the RP
//   ボタンは命令形・簡潔に、文は sentence case。
// 訳語に迷った箇所は "REVIEW:" コメントで印を付けている (fable レビュー用)。

export const en: Record<string, string> = {
  // ===== index.html: ヘッダー =====
  "header.help.title": "How to use",
  "header.help.aria": "Help",
  "header.lang.title": "Switch language",
  "header.lang.aria": "Switch language",
  "header.infoModal.close.aria": "Close",

  // ===== index.html: タブ (幅制約: 短く) =====
  "tabs.aria": "Sections",
  "tabs.setup": "Setup",
  "tabs.result": "Results",
  "tabs.hand": "Ranges", // REVIEW: 「ハンド比較」。Hands/Ranges で迷い、幅優先で Ranges
  "tabs.nash": "Nash",
  "tabs.practice": "Practice",

  // ===== index.html: セットアップ - シナリオプリセット =====
  "setup.presets.h2": "Scenario presets",
  "setup.presets.summary": "Preset list (tap to expand)",
  "setup.presets.hint": "Tap to load a full situation — stacks, positions, and payouts all at once.",
  "setup.presets.ft9": "9-max FT start",
  "setup.presets.ftBubble": "FT bubble (short/mid ×3)",
  "setup.presets.ft6": "6 left",
  "setup.presets.ft4": "4 left",
  "setup.presets.ft3": "3-handed",
  "setup.presets.hu": "HU 10/10",
  "setup.presets.huShort": "HU short/deep", // REVIEW: 「HU 短/長」
  "setup.presets.satellite3": "🛰 Satellite (3 paid)",
  "setup.presets.userLabel": "Your scenarios",
  "setup.presets.saveBtn": "+ Save current situation",

  // ===== セットアップ 動的部分 (setup.ts) =====
  "setup.common.delete": "Delete",
  "setup.player.pos.title": "Position",
  "setup.player.role.hero": "You",
  "setup.player.role.villain": "Villain",
  "setup.player.role.other": "Other",
  "setup.player.role.otherText": "None", // fable レビュー済: 役割なしを自然な英語で
  "setup.payout.rank": "#{n}",
  "setup.userScenarios.empty": "No saves yet. Tap “+ Save current situation” to add one.",
  "setup.prompt.scenarioName": "Enter a scenario name",
  "setup.confirm.deleteScenario": "Delete this scenario?",
  "setup.prompt.savePayout": "Save with a name (e.g. JOPT / APT / My HU)",

  // ===== index.html: セットアップ - プレイヤー =====
  "setup.players.h2": "Players",
  "setup.players.hint.html": "\n          Enter each player’s stack. Tap to set <strong>🎯 You</strong> /\n          <strong>⚔️ Villain</strong>. Up to 9 players.\n        ",
  "setup.players.add": "+ Add player",
  "setup.players.addMax": "(max {n})",
  "setup.players.randomize.title": "Randomize current players’ stacks to 3–30 BB",
  "setup.players.randomize": "\n            🎲 Randomize stacks\n          ",

  // ===== index.html: セットアップ - ペイ構造 =====
  "setup.payouts.h2": "Payout structure",
  "setup.payouts.hint": "Enter prizes from 1st place down. % or $ both work.",
  "setup.payouts.add": "\n          + Add place\n        ",
  "setup.payouts.summary": "Presets & saved (tap to expand)",
  "setup.payouts.presetLabel": "Presets",
  "setup.payouts.preset.top3": "Top 3 (50/30/20)",
  "setup.payouts.preset.top2": "Top 2 (65/35)",
  "setup.payouts.preset.wta": "WTA",
  "setup.payouts.preset.ft9": "9-max FT",
  "setup.payouts.preset.satellite": "🛰 Satellite Top 3",
  "setup.payouts.savedLabel": "\n              Saved\n              ",
  "setup.payouts.saveBtn": "\n                + Save current values\n              ",


  // ===== index.html: 計算結果 - ICM エクイティ =====
  "result.icm.h2": "ICM equity",
  "result.icm.th.rank": "#",
  "result.icm.th.stack": "Stack",
  "result.icm.th.equity": "$ equity",
  "result.icm.th.pct": "%",

  // ===== index.html: 計算結果 - BF マップ =====
  "result.bf.h2": "BF map",
  "result.bf.hint.html": "\n          Assumes 🎯 you vs ⚔️ villain all-in. Chips at risk auto-adjust to the shorter stack.\n        ",
  "result.bf.matrixTitle": "Everyone vs everyone BF map 🆕",
  "result.bf.matrixHint.html": "\n          Rows = Hero (you), columns = Villain.\n          Top = Risk Premium at a 1:1 pot, bottom = BF value.\n        ",
  "result.bf.howto.summary": "📖 How to read the table (click to expand)",
  "result.bf.howto.body.html":
    "\n            <h4>1. The numbers in each cell</h4>\n            <p>The <strong>BF (Bubble Factor) on the bottom row</strong> is the main metric.</p>\n            <ul>\n              <li><strong>1.00</strong> = chips ⇄ $ are linear (no ICM pressure)</li>\n              <li><strong>1.16</strong> = losing 100 chips hurts as much as winning 86 feels good. You should play <strong>16% tighter</strong> than chip-EV</li>\n              <li><strong>1.41</strong> = losing 100 chips hurts as much as winning 71 feels good. You should play <strong>41% tighter</strong> (yikes)</li>\n            </ul>\n            <p>The <strong>Risk Premium on the top row</strong> is how many extra % of equity you need beyond cEV when the call is pot-sized (1:1 odds). For example, +8.5% means \"even a coin flip (50%) isn't enough — you actually need 58.5% to call.\"</p>\n            <h4>2. What the colors mean</h4>\n            <ul>\n              <li>🟢 <strong>Dark green</strong> (BF &lt; 0.85): ICM tailwind, call wide</li>\n              <li>🟢 Green (0.85–1.0): slightly favorable</li>\n              <li>🟡 Yellow-green to yellow (1.0–1.1): neutral, roughly cEV</li>\n              <li>🟠 Orange (1.1–1.25): ICM pressure, play tight</li>\n              <li>🔴 Red (&gt; 1.25): very dangerous, premiums only</li>\n            </ul>\n            <h4>3. Reading it strategically</h4>\n            <ul>\n              <li>If an opponent in a <strong>red cell</strong> gets involved → weight toward folding</li>\n              <li>Opponents in <strong>green cells</strong> → leaning a bit looser is OK</li>\n              <li>Your row <strong>when you're the shortest stack</strong> has low BFs overall (= little to lose) → you can gamble relatively freely</li>\n              <li>The <strong>chip leader vs. second stack</strong> cell has a spiking BF → clashes between big stacks call for caution</li>\n              <li>A <strong>mid stack</strong> facing the leader is the spot to play tightest (classic ICM pressure)</li>\n            </ul>\n            <h4>4. Using it in play</h4>\n            <ol>\n              <li>Once seated, enter every player's stack</li>\n              <li>Look at <strong>your row</strong> on the far left to see who to play tight/loose against</li>\n              <li>Mid-hand, when you think \"wait, is this opponent dangerous?\", check the matching cell</li>\n            </ol>\n            <p class=\"howto-note\">Note: the table is not symmetric (swapping hero/villain shifts the BF slightly). This is because the calling side takes on risk, and the distribution of the other players makes it asymmetric.</p>\n          ",
  "result.bf.scrollHint": "→ Scroll sideways",

  // ===== index.html: 計算結果 - 必要勝率 =====
  "result.eq.h2": "Required equity (cEV / $EV / RP)",
  "result.eq.hint.html": "\n          Auto-calculated for a 🎯 vs ⚔️ all-in. Overwrite the numbers to enter them manually.\n        ",
  "result.eq.callLabel": "\n            Call amount\n            ",
  "result.eq.call.placeholder": "e.g. 8.0",
  "result.eq.potwinLabel": "\n            Net gain if you win\n            ",
  "result.eq.potwin.placeholder": "e.g. 10.5",
  "result.eq.autofillBtn": "\n          🔄 Back to auto-calc\n        ",

  // ===== index.html: ナッシュ均衡 =====
  "nash.h2": "Nash equilibrium (HU push/fold)",
  "nash.hint.html": "\n          Computes the heads-up Nash equilibrium for 🎯 you (pusher) and ⚔️ villain (caller), ICM included.\n          <br />\n          ※ Assumes HU 2-way. A warning appears when other players sit between (e.g. BTN + BB).\n          <br />\n          Set 🎯/⚔️ in “1. Players” above, then press Solve Nash.\n        ",
  "nash.ante.label": "\n            Total ante\n            ",
  "nash.solveBtn": "Solve Nash",
  "nash.sbRange.h3": "🎯 You push range 🔴",
  "nash.bbRange.h3": "⚔️ Villain call range 🟢",

  // ===== index.html: ハンド比較 =====
  "hand.h2": "Hand range comparison",
  "hand.hint.html": "\n          Assumes HU all-in. Fully valid when <strong>hero = BB</strong> (last actor).\n          For other positions, treat it as a rough estimate assuming everyone behind folds.\n        ",
  "hand.direction.callBack": "\n            Find my call range\n          ",
  "hand.direction.pushBack": "\n            Find my push range\n          ",
  "hand.mode.preset": "\n            Preset (Top X%)\n          ",
  "hand.mode.custom": "\n            Custom edit\n          ",
  "hand.preset.hint": "※ Top X% uses this tool’s own strength ranking. It may not match other tools.",
  "hand.custom.actions.all": "Select all",
  "hand.custom.actions.clear": "Clear all",
  "hand.custom.actions.fromPreset": "\n              Load from preset\n            ",
  "hand.title.villainPush": "Villain push range 🔴",
  "hand.title.heroCall": "Your call range 🟢",
  "hand.label.villainPush": "Villain push range",
  "hand.title.villainCall": "Villain call range 🟢",
  "hand.title.heroPush": "Your push range 🔴",
  "hand.label.villainCall": "Villain call range",
  "hand.legend.html": "🟩 ≥ required +2pt = call ／ 🟨 within ±2pt = borderline (coin-flip zone) ／ uncolored = fold. Tap a cell for exact numbers.",
  "hand.inspect.detail.html": "<strong>{hand}</strong>: equity {eq}% − required {req}% = <strong>{margin}pt</strong> → {verdict}",
  "hand.inspect.verdict.call": "Call",
  "hand.inspect.verdict.marginal": "Borderline",
  "hand.inspect.verdict.fold": "Fold",
  "hand.callStats.callBack": "Hands with required equity <strong>{req}%</strong> or higher: <strong>{callable}</strong> (Top {callPct}%) / borderline: {marginal}",
  "hand.callStats.pushBack": "Assuming the villain calls <strong>{villainPct}%</strong>, hands where your shove is +EV: <strong>{n}</strong> ({pPct}%) / borderline: {marginal}.<br />If the villain calls wider, you should shove tighter.",
  "hand.banner.callerLabel.hero": "hero (you)",
  "hand.banner.callerLabel.villain": "villain",
  "hand.banner.noBehind.html": "\n      ℹ️ {label} = <strong>{pos}</strong>. No players left to act, so the\n      HU all-in model is exactly valid.\n    ",
  "hand.banner.behind.html": "\n      ⚠ {label} = <strong>{pos}</strong>. This section assumes the\n      <strong>caller = BB (last actor)</strong> HU all-in model.\n      The <strong>over-call risk</strong> from the {n} players ({list}) behind {label}\n      is not reflected.\n      {note}\n    ",
  "hand.banner.note.callBack": "Even if it says “call OK” here, defend with a tighter range in practice.",
  "hand.banner.note.pushBack": "Even if it says “push OK” here, account for over-calls and shove a tighter range in practice.",

  // ===== index.html: 練習 =====
  "practice.h2": "🎲 Practice",
  "practice.hint.callfold": "Drill call/fold decisions with realistic quiz hands.",
  "practice.hint.rp": "Guess a spot’s Risk Premium to sharpen your ICM instinct.",
  "practice.hint.push": "Train whether you should shove.",
  "practice.reviewBtn.html": "📚 Review (<span id=\"review-count\">0</span>)",
  "practice.mode.callfold": "⚖️ Call decision",
  "practice.mode.rp": "📊 Guess the RP",
  "practice.mode.push": "🚀 Push decision",
  "practice.diff.label": "Difficulty:",
  "practice.diff.easy": "Easy",
  "practice.diff.normal": "Normal",
  "practice.diff.hard": "Hard",
  "practice.progress.summary": "📈 Progress trend",
  "practice.newBtn": "🎲 New hand",
  "practice.tutorialBtn": "🎓 Intro course",

  // ===== index.html: フッター =====
  "footer.version": "Poker ICM/BF",
  "footer.legalLink": "\n            📄 Terms & Privacy Policy\n          ",

  // ===== 導入コース (tutorialState.ts: 固定5問) =====
  "practice.tutorial.q1.title": "When chips = prize",
  "practice.tutorial.q1.narration": "Winner-take-all, everyone chasing the same prize. Here chips are the prize, one to one.",
  "practice.tutorial.q1.lesson": "In WTA there’s no notion of finishing position, so your win rate maps straight to prize EV. That makes the Risk Premium zero. You can decide on cEV (chip-based required equity) alone — the simplest case, with no ICM pressure.",
  "practice.tutorial.q2.title": "You cover them",
  "practice.tutorial.q2.narration": "The villain’s stack is smaller than yours. Even if you lose, you’re still in the tournament.",
  "practice.tutorial.q2.lesson": "When you cover the villain (losing doesn’t bust you), the Risk Premium is small. You can call close to cEV. ICM pressure bites hardest when you risk busting yourself.",
  "practice.tutorial.q3.title": "The bubble trap",
  "practice.tutorial.q3.narration": "You’re 3rd of 4 players left. The chip leader shoves. Your hand isn’t bad… but this might be a trap.",
  "practice.tutorial.q3.lesson": "Even when calling wins chips (+EV in cEV terms), exact ICM can push the required equity way up and make folding correct. That’s the essence of ICM pressure: busting kills your shot at the prize, while surviving locks in a higher payout, so calling costs more than its face value.",
  "practice.tutorial.q4.title": "Wait for the short stacks",
  "practice.tutorial.q4.narration": "There’s a much shorter stack at the table. The villain’s all-in is a borderline spot.",
  "practice.tutorial.q4.lesson": "While a shorter stack is still in, you ladder up automatically if they bust first. Since there’s value to be had without risking anything, borderline spots tend to favor folding.",
  "practice.tutorial.q5.title": "The satellite rule", // REVIEW: 規約では「survival is everything」まで含む。narrationTitle への差し込みを考え短縮
  "practice.tutorial.q5.narration": "A satellite where the top spots pay almost equally. Surviving is the whole point. Even with a hand like AKs, think twice.",
  "practice.tutorial.q5.lesson": "When prizes are nearly equal, dropping one spot costs a lot and winning gains little. The Risk Premium spikes so hard that even strong hands like AKs or QQ are often folds. Survival dominates everything.",

  // ===== 導入コース UI (tutorial.ts) =====
  "practice.tutorial.progressLabel": "🎓 Intro course {step}/{total}",
  "practice.tutorial.introTitle": "🎓 Start with the intro course (5 hands · 3 min)",
  "practice.tutorial.introBody": "Feel the core of ICM",
  "practice.tutorial.introStart": "▶ Start the course",
  "practice.tutorial.introSkip": "Skip to regular practice",
  "practice.tutorial.narrationTitle": "Hand {step}: {title}",
  "practice.tutorial.narrationBtn": "See this spot →",
  "practice.tutorial.completeTitle": "🎉 Course complete!",
  "practice.tutorial.completeSub": "The 5 takeaways you learned",
  "practice.tutorial.completeBtn": "🎲 To regular practice",
  "practice.tutorial.explainTitle": "💡 Takeaway: {title}",
  "practice.tutorial.nextBtn": "Next hand →",

  // ===== オンボーディング (guide.ts) =====
  "onboarding.step1.title": "🎰 What is this?",
  "onboarding.step1.body": `
      <p>
        In tournaments, your <strong>chip count</strong> and its <strong>prize value</strong> aren’t the same.
        This free app lets you both <strong>calculate</strong> that ICM pressure in numbers and
        <strong>practice</strong> it with quizzes.
      </p>
      <ul class="onboarding-tab-list">
        <li><span class="onboarding-tab-icon">⚙️</span> Situation input (stacks, payouts, etc.)</li>
        <li><span class="onboarding-tab-icon">📊</span> Results (ICM, BF, required equity)</li>
        <li><span class="onboarding-tab-icon">🃏</span> Range comparison</li>
        <li><span class="onboarding-tab-icon">🎯</span> Nash equilibrium (optimal push/fold)</li>
        <li><span class="onboarding-tab-icon">🎲</span> Practice (real-feel quizzes)</li>
      </ul>
    `,
  "onboarding.step2.title": "⚡ Try it first",
  "onboarding.step2.body": `
      <p>There are two good ways in.</p>
      <ol>
        <li>
          Tap a <strong>scenario preset</strong> in <strong>⚙️ Setup</strong> →
          check ICM / BF right away in <strong>📊 Results</strong>
        </li>
        <li>
          Answer quizzes in the <strong>🎲 Practice</strong> tab to build a feel
        </li>
      </ol>
      <p class="hint">Start from either one — you learn by going back and forth.</p>
    `,
  "onboarding.step3.title": "📖 If you get stuck",
  "onboarding.step3.body": `
      <p>
        The <strong>❓</strong> button at the top right opens this how-to guide and
        term explanations (ICM, Bubble Factor, and more) anytime.
      </p>
      <p class="hint">Let’s get started.</p>
    `,
  "onboarding.skip": "Skip",
  "onboarding.next": "Next →",
  "onboarding.cta.practice": "🎲 Start practicing",
  "onboarding.cta.setup": "⚙️ Set it up myself",

  // ===== 使い方ガイド (guide.ts) =====
  "guide.title": "📖 How-to guide",
  "guide.close.aria": "Close",
  "guide.reopenBtn": "🔄 See the intro guide again",
  "guide.legalLink": "📄 Terms & Privacy Policy",
  "guide.body.html": `
        <p class="guide-intro">
          This tool focuses on short-stack (~20bb) all-in spots.
        </p>
        <details class="howto">
          <summary>⚙️ Setup — what it does & how to use</summary>
          <div class="howto-body">
            <p>Build a scenario by setting player stacks, payout structure, and 🎯 you / ⚔️ villain.</p>
            <ol>
              <li>Tap “Scenario presets” to load a situation instantly</li>
              <li>Adjust stacks under “Players” (add more with + Add player)</li>
              <li>Tap to set 🎯 you / ⚔️ villain</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>📊 Results — what it does & how to use</summary>
          <div class="howto-body">
            <p>Auto-calculates ICM equity, Bubble Factor, and required equity (cEV / $EV / RP).</p>
            <ol>
              <li>Enter a situation in ⚙️ (presets are fine)</li>
              <li>Check each player’s $ value in the “ICM equity” table</li>
              <li>Check the 🎯 vs ⚔️ cell in the “everyone vs everyone BF map”</li>
              <li>Call amount / net gain auto-calc from 🎯⚔️ (after editing, “🔄 Back to auto-calc” restores them)</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🃏 Hand comparison — what it does & how to use</summary>
          <div class="howto-body">
            <p>Compare the villain’s push/call range with yours via Top X% or custom editing.</p>
            <ol>
              <li>Choose “solve my call” or “solve my push”</li>
              <li>For presets, adjust Top X% with the slider; for custom, tap grid cells to select</li>
              <li>Use the grid colors to see which hands you should call/push</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎯 Nash equilibrium — what it does & how to use</summary>
          <div class="howto-body">
            <p>Computes the HU push/fold Nash equilibrium (ICM included).</p>
            <ol>
              <li>Set 🎯 you (pusher) and ⚔️ villain (caller) in ⚙️</li>
              <li>Set SB / BB / total ante</li>
              <li>Press “Solve Nash”</li>
              <li>Compare the push-range and call-range grids</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎲 Practice — what it does & how to use</summary>
          <div class="howto-body">
            <p>Practice call/fold decisions, Risk Premium guessing, and push decisions on random scenarios.</p>
            <ol>
              <li>Pick a difficulty and press “🎲 New hand”</li>
              <li>Look at the villain’s assumed push range and your hand, then decide ✅ call / ❌ fold (Guess-the-RP mode answers a number via the slider; in 🚀 push-decision mode decide whether you (SB) 🚀 shove / ❌ fold)</li>
              <li>Check the verdict and math; missed hands go to the 📚 review list to redo</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>📚 Quick term glossary</summary>
          <div class="howto-body">
            <h4>ICM (Independent Chip Model)</h4>
            <p>
              Tournament chips don’t convert to prizes 1:1 (<strong>chips ≠ prize value</strong>).
              ICM is the definition that turns a chip stack into “what would it cash for right now?”
              E.g. if your ICM% is 25%, on average you expect to take home a quarter of the total prize pool.
            </p>
            <h4>Bubble Factor (BF)</h4>
            <p>
              A coefficient for <strong>the pain of losing ÷ the joy of winning</strong>.
              BF = 1.3 means you should play <strong>30% tighter</strong> than cEV (chip basis).
            </p>
            <h4>Risk Premium (RP)</h4>
            <p>
              The extra <strong>equity you need beyond cEV</strong> (the required equity looking at chips only).
              The stronger the ICM pressure, the larger the RP.
            </p>
            <h4>Nash equilibrium</h4>
            <p>
              A push/fold strategy pair where neither the 🎯 pusher nor the ⚔️ caller gains by
              deviating alone — a mutually unexploitable combination.
            </p>
          </div>
        </details>
        <details class="howto">
          <summary>❓ What is “Top X%”</summary>
          <div class="howto-body">
            <p>
              “Top X%” is a simplified top-X% range based on this tool’s own hand-strength ranking.
              Because the assumptions (sample size, scenarios, etc.) differ from other tools like
              Sklansky-Chubukov, <strong>the same X% may not match the exact hands or numbers</strong>.
              Use it as a rough guide to grasp tendencies.
            </p>
          </div>
        </details>
        <button type="button" class="solve-btn guide-reopen-btn" id="guide-reopen-onboarding-btn">🔄 See the intro guide again</button>
        <button type="button" class="guide-legal-link" id="guide-legal-link">📄 Terms & Privacy Policy</button>
      `,

  // ===== 初回ヒントバー (guide.ts) =====
  "firstHint.html": "👋 New here? Tap a <strong>preset</strong> → see results in <strong>📊</strong>, or practice in <strong>🎲</strong>",
  "firstHint.close.aria": "Close",

  // ===== PWA (pwa.ts) =====
  "pwa.swUpdate.aria": "A new version is available. Tap to update",
  "pwa.swUpdate.text": "🔄 A new version is available — tap to update",
  "pwa.close.aria": "Close",
  "pwa.install.title": "Add to home screen",
  "pwa.install.aria": "Install",
  "pwa.iosBanner.text": "Add to your home screen to use it as an app: Share button → Add to Home Screen",
  "pwa.offline.text": "📡 Offline — all calculations run on your device",

  // ===== 練習問題の表示 (render.ts) =====
  "practice.table.bbLeft": "BB left",
  "practice.table.pot": "Pot",
  "practice.table.ante": "ante",
  "practice.bento.tournamentState": "TOURNAMENT STATE",
  "practice.bento.blinds": "Blinds",
  "practice.bento.heroStack": "HERO STACK",
  "practice.bento.ante": "Ante",
  "practice.bento.pay": "Pay",
  "practice.topxNote": "※ Top X% uses this tool’s own strength ranking. It may not match other tools.",
  "practice.villainWarn.head": "⚠️ Villain ({pos}) all-in",
  "practice.villainWarn.estPush": "Est. Push Range",
  "practice.villainCall.head": "⚔️ Villain (BB) estimated call range",
  "practice.villainCall.estCall": "Est. Call Range",
  "practice.villainPushRange.h3": "⚔️ Villain push range 🔴",
  "practice.villainCallRange.h3": "⚔️ Villain call range 🔴",
  "practice.yourHand": "Your hand: {hand}",
  "practice.yourHandSb": "Your hand (SB): {hand}",
  "practice.btn.call": "✅ Call",
  "practice.btn.fold": "❌ Fold",
  "practice.btn.push": "🚀 Shove",
  "practice.rp.callRisk": "Call amount (risk)",
  "practice.rp.return": "Return",
  "practice.rp.question": "📊 What’s this spot’s Risk Premium?",
  "practice.rp.easyPick": "Pick one of 4 (Easy)",
  "practice.rp.tol": "Tolerance ±{tol}% (varies by difficulty)",
  "practice.rp.answerBtn": "Answer",

  // ===== 練習: バッジ (judge.ts) =====
  "practice.badge.streak": "🔥 Streak {n}",
  "practice.badge.acc": "Accuracy {pct}% ({correct}/{total})",
  "practice.badge.accEmpty": "Accuracy -",

  // ===== 練習: 教訓 (judge.ts practiceLesson / practicePushLesson) =====
  "practice.lesson.wta": "🏆 In WTA (winner-take-all), chips = prize is linear. ICM pressure is zero, so you can decide purely on cEV (chip gain/loss).",
  "practice.lesson.satellite": "🛰 In satellites, survival is everything. Even the strongest hands see RP spike so much that almost no call is justified.",
  "practice.lesson.covered": "⚠️ Calling a player who covers you means losing = elimination. You’re risking your tournament life, so the Risk Premium spikes.",
  "practice.lesson.covering": "When you cover the villain, losing doesn’t bust you, so RP is small. You can call close to cEV.",
  "practice.lesson.shorter": "While a shorter stack is still in, you can ladder up without forcing a spot. That’s the source of RP.",
  "practice.lesson.general": "Required equity = cEV + Risk Premium. Under ICM, always check that a “chip profit” isn’t a “prize loss.”",
  "practice.pushLesson.wta": "🏆 In WTA (winner-take-all), ICM pressure is zero. You can judge shoves on chip EV (cEV) too.",
  "practice.pushLesson.satellite": "🛰 In satellites, survival is everything. The shoving side also gets extremely tight — even with fold equity, most hands are folds.",
  "practice.pushLesson.covered": "⚠️ Shoving into a player who covers you means instant elimination if called and beaten. Shove a tighter range than usual.",
  "practice.pushLesson.steal": "💨 The lower the villain’s call rate (the flip side of steal success), the wider you can shove even weak hands, because the fold equity to scoop the pot is large.",
  "practice.pushLesson.general": "Shove $EV = (1−call rate)×steal + call rate×(equity×win + (1−equity)×lose). Compare with fold $EV and always judge with ICM included.",

  // ===== 練習: 判定フィードバック共通 (judge.ts) =====
  "practice.verdict.correct": "🎉 Correct!",
  "practice.verdict.wrong": "😅 Incorrect",
  "practice.verdict.answerPrefix": "— answer:", // 「正答:」。"Correct!"/"Incorrect" どちらの後でも読めるよう区切りを付与

  "practice.verdict.call": "✅ Call (+EV)",
  "practice.verdict.fold": "❌ Fold (-EV)",
  "practice.verdict.push": "🚀 Shove (+EV)",
  "practice.nextBtnTop": "🎲 Next",
  "practice.nextBtn": "🎲 Next hand",
  "practice.applyBtn": "📥 Load into setup (deep analysis)",
  "practice.details.summary": "📖 Detailed math (tap to expand)",
  "practice.label.margin": "Margin:",

  // ===== 練習: RP フィードバック (judge.ts judgePracticeRP) =====
  "practice.rp.yourAnswerLabel": "Your answer:",
  "practice.rp.correctLabel": "Correct RP (exact ICM):",
  "practice.rp.tolNote": "(tolerance ±{tol}%)",
  "practice.rp.errorLabel": "Error:",

  // ===== 練習: call/fold フィードバック (judge.ts judgePractice) =====
  "practice.cf.cevLabel": "cEV required equity:",
  "practice.cf.reqLabel": "Required equity (exact ICM):",
  "practice.cf.reqApproxNote": "(ref: BF approx {v}%)",
  "practice.cf.handEquity": "Equity of {hand} vs Top {pct}%:",
  "practice.cf.heroRangeH3": "🎯 Your call range 🟢 (hands above {pct}% required equity)",
  "practice.cf.legend.call": "call (margin ≥ +0% = +EV)",
  "practice.cf.legend.fold": "fold (negative margin = -EV)",

  // ===== 練習: push 判定フィードバック (judge.ts judgePracticePush) =====
  "practice.push.evNote": "(villain call rate {pcall}% / hero equity when called {eq}%)",
  "practice.push.marginPoolNote": "(vs pool {v}%)",
  "practice.push.heroRangeH3": "🚀 Your push range 🟢 (shove +EV hands)",

  // ===== 練習: 復習 (review.ts) =====
  "practice.review.empty": "No review hands yet. Missed hands are collected here automatically (up to 50).",

  // ===== 練習: 成績の推移 (progress.ts) =====
  "practice.progress.notEnough": "Not enough data yet ({n} hands)",
  "practice.progress.sparklineAria": "Recent accuracy trend",
  "practice.progress.recent20": "Last 20",
  "practice.progress.allTime": "All time",
  "practice.progress.qCount": "{c}/{t}",
  "practice.progress.trendTitle": "Trend (accuracy per 10 of the last 100 hands)",
  "practice.progress.byDiff": "By difficulty",
  "practice.progress.byMode": "By mode",
  "practice.progress.mode.callfold": "Call/fold decision",
  "practice.progress.mode.rp": "Guess the RP",
  "practice.progress.mode.push": "Push decision",
  "practice.progress.resetBtn": "🗑️ Reset history",
  "practice.progress.resetConfirm": "Reset practice history (progress-trend data)?\n※ Streak, cumulative accuracy, and the review list are unaffected.",

  // ===== 計算結果 (calculator.ts) =====
  "calc.err.needPlayer": "Add at least one player",
  "calc.err.needPayout": "Add at least one prize",
  "calc.bf.err.needHV": "Set exactly one 🎯 you and one ⚔️ villain",
  "calc.bf.err.sameHV": "🎯 you and ⚔️ villain must be different players",
  "calc.bf.err.zeroStack": "Stack is 0, so BF can’t be computed",
  "calc.bf.label.bf": "🎯 vs ⚔️ BF",
  "calc.bf.label.risk": "Chips at risk",
  "calc.autofill.summaryLine": "✓ Added call <strong>{call}</strong> / net gain <strong>{pot}</strong> BB",
  "calc.autofill.detailsSummary": "▸ Calculation breakdown",
  "calc.autofill.err.needHV": "⚠ Set exactly one 🎯 you and one ⚔️ villain",
  "calc.autofill.err.zeroStack": "⚠ Stack is 0",
  "calc.autofill.modeTotal": "total",
  "calc.autofill.modePerPlayer": "{ante} each × {n}",
  "calc.autofill.result": "✓ Call <strong>{risk}</strong>, net gain <strong>{pot}</strong> = risk {risk2} + dead money {dead} (SB {sb} + BB {bb} + ante {ante} [{mode}])",
  // 「▸ 計算の内訳」details 本体 (Phase B 抽出)
  "calc.autofill.potComp": "📊 Pot composition",
  "calc.autofill.heroBlind": "You ({pos}) blind: <code>{v}</code> <span class=\"muted\">(sunk)</span>",
  "calc.autofill.heroAnte": "You ({pos}) ante: <code>{v}</code> <span class=\"muted\">(sunk, BB pays all)</span>",
  "calc.autofill.villainAnte": "Villain ({pos}) ante: <code>{v}</code> <span class=\"muted\">(sunk, BB pays all)</span>",
  "calc.autofill.anteDead": "ante dead: <code>{v}</code> <span class=\"muted\">(prev BB folded)</span>",
  "calc.autofill.heroToPay": "You still owe <strong>call</strong>: <code>{v}</code>",
  "calc.autofill.villainPush": "Villain ({pos}) push (live): <code>{live}</code>{blind} = <code>{matched}</code>",
  "calc.autofill.villainPushBlind": " + posted blind {v}",
  "calc.autofill.totalPot": "Total pot: {v} BB",
  "calc.autofill.callVsFold": "⚖️ Call vs fold",
  "calc.autofill.tableHead": "<tr><th>Choice</th><th>Stack left</th><th>vs fold</th><th>vs start</th></tr>",

  // ===== 状況サマリー (calculator.ts renderHeroSummary) =====
  "calc.summary.title": "Situation summary (tap = term help)",
  "calc.summary.sample": "Sample",
  "calc.summary.expand": "Expand",
  "calc.summary.collapse": "Collapse",
  "calc.summary.collapseToggle": "Toggle collapse",
  "calc.summary.hero": "🎯 You",
  "calc.summary.villain": "⚔️ Villain",
  "calc.summary.villainUnset": "⚔️ Villain unset",
  "calc.summary.aroundHtml": "<span>👥 Around <strong>{stacks}</strong> BB</span>",
  "calc.summary.bfLabel": "BF ⓘ",
  "calc.summary.reqLabel": "Req. eq ⓘ", // fable レビュー済: ピル幅優先の短縮形
  "calc.summary.rpLabel": "RP ⓘ",

  // ===== 警告 (calculator.ts) =====
  "calc.warn.position.html": "\n      ⚠ <strong>Position reversed</strong>: action order is <code>{heroPos}({heroAct}) → {villainPos}({villainAct})</code>.\n      In practice <strong>hero ({heroPos}) acts first</strong>, so calling a villain ({villainPos}) open shove can’t happen.\n      (The call math still runs, but swapping positions is more realistic.)\n    ",
  "calc.warn.depth.html": "\n    ⚠️ Effective {eff}bb: at this depth, options other than push/fold\n    (small opens or calls) are realistic. This tool assumes all-in.\n  ",

  // ===== 用語解説モーダル (calculator.ts INFO_TEXTS) =====
  "info.icm.title": "ICM (Independent Chip Model)",
  "info.icm.body": `
      <p>A formula that converts your tournament <strong>chips into “what would they cash for right now?”</strong></p>
      <p>Prizes are fixed per finishing position, so 2× chips ≠ 2× prize.<br />
      It reflects the asymmetry that busting leaves you only the lowest remaining payout.</p>
      <p>ICM% is <code>your $EV ÷ total prize pool</code>. E.g. 25% = on average you take home a quarter of the pool.</p>
    `,
  "info.bf.title": "BF (Bubble Factor)",
  "info.bf.body": `
      <p>A coefficient for <strong>“chip pain ÷ chip joy.”</strong> Assumes HU all-in.</p>
      <ul>
        <li><strong>1.00</strong>: chips ⇄ $ is linear (zero ICM pressure)</li>
        <li><strong>1.20</strong>: “losing 100 hurts = winning 83 feels good” → 20% tighter</li>
        <li><strong>1.50+</strong>: bubble/satellite level, ultra-tight</li>
      </ul>
      <p>Exact definition: <code>BF = (current − $ when losing) ÷ ($ when winning − current)</code>.
      Same calculation as HRC / ICMIZER.</p>
      <p>※ At 1:1 pot odds, <code>required equity = BF/(BF+1)</code>. BF=1.2 → 54.5%, BF=1.5 → 60%.</p>
    `,
  "info.rp.title": "Risk Premium (RP)",
  "info.rp.body": `
      <p>The <strong>difference between cEV (chip EV) and $EV (ICM EV)</strong>. How much extra equity you need under ICM weighting.</p>
      <ul>
        <li>RP = 0%: cEV and $EV match (no ICM effect)</li>
        <li>RP = +10%: a coin flip (50%) actually needs 60%</li>
        <li>RP = +20%: on the bubble, +30% in a satellite</li>
      </ul>
      <p>Calculation: <code>RP = $EV required equity − cEV required equity</code></p>
      <p>At 1:1 odds: <code>RP = BF/(BF+1) − 50%</code></p>
    `,
  // ===== ナッシュ均衡 (nashUI.ts) =====
  "nash.overcall.between": "<strong>{n}</strong> between pusher and caller ({list})",
  "nash.overcall.behind": "<strong>{n}</strong> behind the caller ({list})",
  "nash.overcall.callerTighten": "<br />→ <strong>caller ({callerPos}) should also call tighter</strong> (with {n} still to act behind).",
  "nash.overcall.callerOk": "<br />→ caller ({callerPos}) is roughly per HU Nash (assuming those in between folded).",
  "nash.overcall.main.html": "\n    ⚠ <strong>Intervening players outside the HU Nash assumption</strong>: {parts}.\n    <br />→ <strong>pusher ({pusherPos}) should push even tighter than HU Nash</strong>\n    (fold equity drops as intervening players over-call/3-bet with strong hands).\n    {callerAdvice}\n    <br />Read this Nash result as a reference under HU 2-way assumptions.\n  ",
  "nash.err.needHV": "Set exactly one 🎯 you and one ⚔️ villain",
  "nash.err.needPayout": "Enter a payout structure",
  "nash.err.sb": "Invalid SB",
  "nash.err.bb": "Invalid BB",
  "nash.err.ante": "Invalid ante",
  "nash.calculating": "Calculating…",
  "nash.converged": "Converged",
  "nash.notConverged": "Not converged",
  "nash.statusSuffix": "({iter} iter / {ms} ms)",
  "nash.stats": "{n} ({pct}%)",
  "nash.matrixMissing": "⚠ HU equity matrix not generated (hu-equity-matrix.json). Run `npx tsx scripts/build-hu-matchups.mts`.",

  "info.req.title": "Required equity",
  "info.req.body": `
      <p>The <strong>minimum equity for this call to be EV 0</strong>. If your hand’s real equity exceeds it, call; below it, fold.</p>
      <ul>
        <li><strong>cEV required equity</strong>: pot odds only (ignores ICM)</li>
        <li><strong>$EV required equity</strong>: reflects BF (ICM pressure) — use this one in practice</li>
      </ul>
      <p>Exact formula: <code>$EV = (call × BF) ÷ (call × BF + win)</code></p>
      <p>E.g. call 8 BB / pot 20 BB / BF 1.4<br />
      → cEV = 8/(8+20) = 28.6%<br />
      → $EV = (8×1.4)/(8×1.4 + 20) = 11.2/31.2 = <strong>35.9%</strong><br />
      (at 1:1 odds it’s <code>BF/(BF+1)</code>)</p>
    `,

  // ===== 練習: 「📖 詳しい計算式」details 本体 (judge.ts, Phase B 抽出) =====
  // RP 当てモード
  "practice.rpDetails.body.html": `
        <h4>1. Bubble Factor (reference: symmetric-flip approximation)</h4>
        <p><code>BF = (now − lose) ÷ (win − now) = {bfNum} ÷ {bfDen} = {bf}</code></p>
        <h4>2. Required equity</h4>
        <ul>
          <li>cEV: <code>risk ÷ (risk + return) = {call} ÷ ({call} + {pot}) = {cev}%</code></li>
          <li>$EV (BF approx): <code>(risk × BF) ÷ (risk × BF + return) = {evBF} ÷ ({evBF} + {pot}) = {approx}%</code></li>
          <li>$EV (exact ICM): <code>(Efold − Elose) ÷ (Ewin − Elose) = {exactNum} ÷ {exactDen} = {exact}%</code></li>
        </ul>
        <h4>3. Risk Premium</h4>
        <p><code>RP = exact $EV − cEV = {exact}% − {cev}% = +{rp}%</code></p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          BF approx: <strong>+{rpApprox}%</strong> / exact ICM: <strong style="color: var(--accent);">+{rp}%</strong> (used for the verdict)
        </p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ The larger the BF (closer to the bubble / more even stacks), the larger the RP. The BF approximation can differ from the exact value by a few % near the boundary.
        </p>
      `,

  // call/fold 判定モード
  "practice.cfDetails.sbDeadLine": `<li>SB dead blind: <code>{v}</code> BB <span style="color: var(--muted);">(SB folded → dead)</span></li>`,
  "practice.cfDetails.verdictCall": "Call (+EV)",
  "practice.cfDetails.verdictFold": "Fold (-EV)",
  "practice.cfDetails.body.html": `
        <h4>1. Pot composition (BB ante structure)</h4>
        <ul style="font-size: 12px; line-height: 1.5;">
          <li>You (BB) blind: <code>{bb}</code> BB <span style="color: var(--muted);">(already sunk)</span></li>
          <li>You (BB) ante: <code>{ante}</code> BB <span style="color: var(--muted);">(already sunk, BB pays all)</span></li>
          {sbDeadLine}
          <li>You (BB) still owe <strong>call</strong>: <code>{callFixed}</code> BB</li>
          <li>Villain ({villainPos}) match: <code>{villainMatch}</code> BB <span style="color: var(--muted);">(matched portion of the {villainStack} stack)</span></li>
          <li><strong>Total pot (at showdown): {pot} BB</strong></li>
        </ul>

        <h4>2. Decision (call vs fold · terminal stacks)</h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr><th style="text-align:left; padding: 4px;">Choice</th><th style="text-align:right; padding: 4px;">Final stack</th><th style="text-align:right; padding: 4px;">vs fold</th><th style="text-align:right; padding: 4px;">vs start</th></tr>
          <tr><td style="padding: 4px;">Fold</td><td style="text-align:right; padding: 4px;"><code>{stackFold}</code></td><td style="text-align:right; padding: 4px;"><code>±0</code></td><td style="text-align:right; padding: 4px; color: {netFoldCol};"><code>{netFoldSign}{netFold}</code></td></tr>
          <tr><td style="padding: 4px;">Call + win</td><td style="text-align:right; padding: 4px;"><code>{stackWin}</code></td><td style="text-align:right; padding: 4px; color: var(--good);"><code>{winVsFoldSign}{winVsFold}</code></td><td style="text-align:right; padding: 4px; color: {netWinCol};"><code>{netWinSign}{netWin}</code></td></tr>
          <tr><td style="padding: 4px;">Call + lose</td><td style="text-align:right; padding: 4px;"><code>{stackLose}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>{loseVsFold}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>{netLose}</code></td></tr>
        </table>
        <p style="font-size: 11px; color: var(--muted); margin: 6px 0 0;">
          📌 These three terminal stacks (fold / call+win / call+lose) feed straight into “3. ICM equity” below.<br>
          “Net profit from the start (hand start)” is <strong>{netWinSign}{netWin} BB</strong> (= final {stackWin} − start {heroStack}).
        </p>

        <h4>3. ICM equity ($ units · exact)</h4>
        <ul>
          <li>If fold: <code>{eqFold}</code></li>
          <li>If call + win: <code>{eqWin}</code> (vs fold {eqWinVsFoldSign}{eqWinVsFold})</li>
          <li>If call + lose: <code>{eqLose}</code> (vs fold {eqLoseVsFold})</li>
        </ul>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ Each terminal stack from “2. Decision” run through ICM (Malmuth-Harville) as $ equity. Exact values, not via the BF approximation.
        </p>

        <h4>4. Reference: Bubble Factor approximation (symmetric flip of effective stacks)</h4>
        <p><code>BF = (now − lose) ÷ (win − now) = {bfNum} ÷ {bfDen} = {bf}</code></p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF is measured on a generic scenario — a symmetric flip of equal effective stacks — and is a separate calculation from the actual call’s fold/win/lose terminals (sections 2·3). Shown as a reference.
        </p>

        <h4>5. Required equity + Risk Premium</h4>
        <ul>
          <li>cEV: <code>risk ÷ (risk + return) = {call} ÷ ({call} + {potIfWin}) = {cev}%</code></li>
          <li>$EV (BF approx · linearized): <code>(risk × BF) ÷ (risk × BF + return) = ({call} × {bf2}) ÷ ({call} × {bf2} + {potIfWin}) = {approx}%</code></li>
          <li>$EV (exact ICM): <code>(Efold − Elose) ÷ (Ewin − Elose) = {exactNum} ÷ {exactDen} = {exact}%</code></li>
        </ul>
        <p style="font-size: 12px; margin: 6px 0;">
          <strong>BF approx: {approx}% / exact ICM: <span style="color: var(--accent);">{exact}%</span> (used for the verdict)</strong>
        </p>
        <ul>
          <li><strong>RP (exact ICM)</strong>: <code>exact $EV − cEV = {exact}% − {cev}% = {rpSign}{rp}%</code></li>
        </ul>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ The BF approximation is linearized, so it can differ from the exact value by 1–2% near the boundary. The call/fold verdict always uses the exact ICM side ({exact}%).
        </p>

        <h4>6. Hand equity</h4>
        <p><code>{heroHand}</code> vs Top {villainCallRangePct}% range → <strong>{heroEq}%</strong></p>

        <h4>7. Verdict</h4>
        <p>
          hand equity <code>{heroEq}%</code>
          {verdictOp}
          required equity (exact ICM) <code>{exact}%</code>
          → <strong>{verdict}</strong>
        </p>
      `,

  // push 判定モード
  "practice.pushDetails.verdictPush": "Shove (+EV)",
  "practice.pushDetails.verdictFold": "Fold (-EV)",
  "practice.pushDetails.body.html": `
        <h4>1. Pot composition (on push→call, BB ante structure)</h4>
        <ul style="font-size: 12px; line-height: 1.5;">
          <li>You (SB) push (full stack): <code>{heroStack}</code> BB</li>
          <li>Villain (BB) ante: <code>{ante}</code> BB <span style="color: var(--muted);">(BB pays all, dead)</span></li>
          <li>matched (to the shorter stack): <code>{matched}</code> BB</li>
          <li><strong>Total pot (at showdown): {pot} BB</strong></li>
        </ul>

        <h4>2. Terminal stacks (4 endpoints of the push decision)</h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr><th style="text-align:left; padding: 4px;">Endpoint</th><th style="text-align:right; padding: 4px;">Final stack</th><th style="text-align:right; padding: 4px;">vs start</th></tr>
          <tr><td style="padding: 4px;">Fold (don’t push)</td><td style="text-align:right; padding: 4px;"><code>{stackFold}</code></td><td style="text-align:right; padding: 4px; color: {foldCol};"><code>{foldSign}{foldRel}</code></td></tr>
          <tr><td style="padding: 4px;">push → villain fold (steal)</td><td style="text-align:right; padding: 4px;"><code>{stackSteal}</code></td><td style="text-align:right; padding: 4px; color: {stealCol};"><code>{stealSign}{stealRel}</code></td></tr>
          <tr><td style="padding: 4px;">push → call → win</td><td style="text-align:right; padding: 4px;"><code>{stackWin}</code></td><td style="text-align:right; padding: 4px; color: var(--good);"><code>{winSign}{winRel}</code></td></tr>
          <tr><td style="padding: 4px;">push → call → lose</td><td style="text-align:right; padding: 4px;"><code>{stackLose}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>{loseRel}</code></td></tr>
        </table>

        <h4>3. ICM equity ($ units · exact)</h4>
        <ul>
          <li>If fold: <code>{eqFold}</code></li>
          <li>push → villain fold (steal succeeds): <code>{eqSteal}</code></li>
          <li>push → call → win: <code>{eqWin}</code></li>
          <li>push → call → lose: <code>{eqLose}</code></li>
        </ul>

        <h4>4. Villain call rate · equity breakdown</h4>
        <ul>
          <li>Villain (BB) estimated call range: <code>Top {villainCallRangePct}%</code></li>
          <li>Call rate (combo-weighted) pCall: <code>{pCall}%</code> <span style="color: var(--muted);">(steal success = 1 − pCall = {stealPct}%)</span></li>
          <li>{heroHand} vs call range equity: <code>{eqVsCallRange}%</code></li>
        </ul>

        <h4>5. $EV of the push</h4>
        <p><code>evPush = (1−pCall)×Esteal + pCall×(eq×Ewin + (1−eq)×Elose)<br />
        = {oneMinusPCall}×{eqSteal} + {pCall3}×({eq3}×{eqWin} + {oneMinusEq}×{eqLose})<br />
        = {evPush}</code></p>
        <p><code>evFold = {evFold}</code></p>

        <h4>6. Verdict</h4>
        <p>
          push $EV <code>{evPush}</code>
          {verdictOp}
          fold $EV <code>{evFold}</code>
          → <strong>{verdict}</strong>
        </p>
      `,

  // ===== 規約モーダル: EN モード時のみ表示する注記 (guide.ts, Phase B) =====
  "legal.enOnlyNote": "The terms below are currently available in Japanese only.",
};
