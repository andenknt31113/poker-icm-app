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
  "setup.players.roles": "🎯 You　⚔️ Opponent",
  "setup.players.swap": "⇄ Swap roles",
  "setup.players.locked": "Edit up to {n} players for free. Remove players or unlock Pro to edit this spot. You can still analyze the example.",
  "setup.player.stack.aria": "Player {n} stack in BB",
  "setup.player.position.aria": "Player {n} position",
  "setup.player.remove.aria": "Remove player {n}",
  "hand.legend.title": "Reading colors and numbers",
  "hand.emptyRange": "The opponent range is empty. Select hands or load the preset.",
  "calc.err.positivePrize": "Enter at least one prize greater than zero.",
  "nash.details": "Prizes, blinds and remaining players",
  "seat.number": "Seat {n}",
  "seat.up": "Move one seat up",
  "seat.down": "Move one seat down",
  "seat.stack": "Stack",
  "seat.hero": "You",
  "seat.villain": "Opponent",
  "seat.button": "BTN (button)",
  "seat.setButton": "Set BTN here",
  "nash.otherSeats": "Show other players",
  "nash.prizes": "Payouts",
  "nash.youPush": "You: push",
  "nash.theyCall": "Opponent: call",
  "nash.youCall": "You: call",
  "nash.theyPush": "Opponent: push",
  "nash.title.youPush": "Range you shove 🔴",
  "nash.title.theyCall": "Range they call with 🟢",
  "nash.title.theyPush": "Range they shove 🔴",
  "nash.title.youCall": "Range you call with 🟢",
  "flow.equityDetails": "Review call amount and required equity →",
  "flow.example": "Start with an example",
  "flow.exampleHint": "Choose a familiar tournament spot",
  "flow.own": "Build your own spot",
  "flow.ownHint": "Enter stacks and payouts",
  "flow.practice": "Practice a decision",
  "flow.practiceHint": "Build intuition, one hand at a time",
  "flow.hand": "Hands",
  "flow.equity": "Prizes / BF",
  "flow.nash": "Nash",
  "workspace.eyebrow": "TOURNAMENT / STUDY",
  "workspace.title": "Give your call a reason.",
  "workspace.intro": "Recreate a spot. Understand the prize equity at risk and explore your decision.",
  "workspace.step1": "01 Build a spot",
  "workspace.step2": "02 Explore your hand",
  "workspace.step3": "03 Practice the decision",
  "workspace.practice": "Try a practice hand →",
  "workspace.ready": "Your spot is ready",
  "workspace.readyHint": "Explore their range and your hand.",
  "workspace.analyze": "Analyze this spot →",
  "workspace.analysisEyebrow": "YOUR DECISION",
  "workspace.analysisTitle": "Spot analysis",
  "workspace.edit": "Edit spot",
  "workspace.you": "You",
  "workspace.opponent": "Opponent",
  "workspace.table": "View table layout",
  // ===== index.html: ヘッダー =====
  "header.help.title": "How to use",
  "header.help.aria": "Help",
  "header.lang.title": "Switch language",
  "header.lang.aria": "Switch language",
  "header.infoModal.close.aria": "Close",

  // ===== index.html: タブ (幅制約: 短く) =====
  "tabs.aria": "Sections",
  "tabs.setup": "Setup",
  "tabs.analyze": "Calculator",
  "tabs.practice": "Practice",
  "analyze.jump.aria": "Analysis sections",
  "analyze.jump.results": "Results",
  "analyze.jump.hand": "Ranges",
  "analyze.jump.nash": "Nash",

  // ===== index.html: セットアップ - シナリオプリセット =====
  "setup.presets.h2": "Scenario presets",
  "setup.presets.summary": "Examples and saved spots",
  "setup.presets.hint": "Tap to load a full situation — stacks, positions, and payouts all at once.",
  "setup.presets.ft9": "9 left · all paid",
  "setup.presets.ftBubble": "4 left · 3 paid · you are short",
  "setup.presets.ft6": "6 left · all paid",
  "setup.presets.ft4": "4 left · all paid",
  "setup.presets.ft3": "3 left · all paid",
  "setup.presets.hu": "Final 2 · 10 BB each",
  "setup.presets.huShort": "Final 2 · you 5 BB / opponent 18 BB",
  "setup.presets.satellite3": "5 left · top 3 paid equally",
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
  "setup.players.h2": "Spot",
  "setup.players.hint.html": "Enter stacks in BB. Choose 🎯 you and ⚔️ your opponent.",
  "seat.edit": "Edit seats / BTN / removal",
  "seat.done": "Done editing seats",
  "setup.undo": "Undo",
  "setup.players.add": "+ Add player",
  "setup.players.addMax": "(max {n})",
  "setup.players.randomize.title": "Randomize current players’ stacks to 3–30 BB",
  "setup.players.randomize": "🎲 Random",

  // ===== index.html: セットアップ - ペイ構造 =====
  "setup.payouts.h2": "Payouts",
  "setup.payouts.hint": "Enter from 1st place down. % or amounts both work.",
  "setup.payouts.add": "\n          + Add place\n        ",
  "setup.payouts.summary": "Presets & saved (tap to expand)",
  "setup.payouts.presetLabel": "Presets",
  "setup.payouts.preset.top3": "50/30/20",
  "setup.payouts.preset.top2": "65/35",
  "setup.payouts.preset.wta": "Winner takes all",
  "setup.payouts.preset.ft9": "Top 7",
  "setup.payouts.preset.satellite": "Satellite, 3 seats",
  "setup.payouts.savedLabel": "\n              Saved\n              ",
  "setup.payouts.saveBtn": "\n                + Save current values\n              ",
  "setup.blinds.h2": "Blinds",
  "setup.blinds.summary": "SB {sb} / BB {bb} / ante {ante}",
  "setup.cols.pos": "Seat",
  "setup.cols.stack": "Stack (BB)",
  "setup.cols.role": "Role",
  "setup.presets.open": "Choose",
  "hand.quick.aria": "Range shortcuts",
  "hand.thumb.aria": "Show their range as a chart",
  "hand.thumb.caption": "Open chart",
  "calc.summary.chipOnly": "Chips only: {v}%",
  "setup.blinds.hint": "Stacks are in BB units, so BB is fixed at 1. For ante games, enter the table total.",


  // ===== index.html: 計算結果 - ICM エクイティ =====
  "result.icm.h2": "Prize equity (ICM)",
  "result.icm.th.rank": "Seat",
  "result.icm.th.stack": "Stack",
  "result.icm.th.equity": "Prize equity",
  "result.icm.th.pct": "Share",

  // ===== index.html: 計算結果 - BF マップ =====
  "result.bf.h2": "BF map (everyone vs everyone)",
  "result.bf.hint.html": "Rows are you, columns are the opponent. Bottom = BF, top = RP in an even-money all-in. Values assume a two-player all-in for the effective stack.",
  "result.bf.matrixTitle": "Everyone vs everyone BF map 🆕",
  "result.bf.matrixHint.html": "\n          Rows = Hero (you), columns = Villain.\n          Top = Risk Premium at a 1:1 pot, bottom = BF value.\n        ",
  "result.bf.howto.summary": "📖 How to read the table (click to expand)",
  "result.bf.howto.body.html":
    "\n            <h4>1. The numbers in each cell</h4>\n            <p>The <strong>BF (Bubble Factor) on the bottom row</strong> is the main metric: <strong>how many times more losing hurts than winning feels good</strong> against this opponent.</p>\n            <ul>\n              <li><strong>1.00</strong> = pain equals joy — play your chips at face value (no ICM pressure)</li>\n              <li><strong>1.16</strong> = losing hurts 1.16×. In a 1:1 pot, 50% equity is not enough — you need <strong>about 53.7% (+3.7pt)</strong> to break even</li>\n              <li><strong>1.41</strong> = losing hurts 1.41×. Same spot needs <strong>about 58.5% (+8.5pt)</strong> — premium hands only (yikes)</li>\n            </ul>\n            <p>The <strong>Risk Premium on the top row</strong> is exactly that surcharge: <strong>how many extra points above 50%</strong> you need when the call is pot-sized (1:1 odds).</p>\n            <h4>2. What the colors mean</h4>\n            <p>The color deepens continuously from BF <strong>1.0 (yellow) to 2.0 and above (red)</strong>. Because of how ICM works, <strong>BF never drops below 1.00</strong>, so in practice you only ever see yellow through red. As a rule of thumb:</p>\n            <ul>\n              <li>🟡 Yellow (BF ≈ 1.0): almost no ICM pressure, play close to cEV</li>\n              <li>🟠 Orange (1.2–1.5): ICM pressure, play tight</li>\n              <li>🔴 Red (around 1.7+): very dangerous, premiums only</li>\n            </ul>\n            <h4>3. Reading it strategically</h4>\n            <ul>\n              <li>If an opponent in a <strong>red cell</strong> gets involved → weight toward folding</li>\n              <li>Opponents in <strong>near-yellow cells (BF around 1.0)</strong> → leaning a bit looser is OK</li>\n              <li>Your row <strong>when you're the shortest stack</strong> has low BFs overall (= little to lose) → you can gamble relatively freely</li>\n              <li>The <strong>chip leader vs. second stack</strong> cell has a spiking BF → clashes between big stacks call for caution (the highest BF in the whole table is usually the second stack facing the leader)</li>\n              <li>Unless you are the leader, the <strong>chip leader's column</strong> tends to be the highest BF in your row → the bigger the stack you tangle with, the tighter you play (classic ICM pressure)</li>\n            </ul>\n            <h4>4. Using it in play</h4>\n            <ol>\n              <li>Once seated, enter every player's stack</li>\n              <li>Look at <strong>your row</strong> on the far left to see who to play tight/loose against</li>\n              <li>Mid-hand, when you think \"wait, is this opponent dangerous?\", check the matching cell</li>\n            </ol>\n            <p class=\"howto-note\">Note: the table is not symmetric (swapping hero/villain changes the BF). The same chip transfer affects each player's $ equity differently depending on their stacks and payout position (e.g. the short stack busts when losing, while the covering stack survives).</p>\n          ",
  "result.bf.scrollHint": "→ Scroll sideways",

  // ===== index.html: 計算結果 - 必要勝率 =====
  "result.eq.h2": "Required equity & RP",
  "calc.eq.flow.chip": "Chips only",
  "calc.eq.flow.rp": "+ RP",
  "calc.eq.flow.icm": "Required (ICM)",
  "result.eq.hint.html": "Calculated automatically from your all-in against the villain. Overwrite the numbers to enter them manually.",
  "result.eq.callLabel": "\n            Call amount\n            ",
  "result.eq.call.placeholder": "e.g. 8.0",
  "result.eq.potwinLabel": "\n            Net gain if you win\n            ",
  "result.eq.potwin.placeholder": "e.g. 10.5",
  "result.eq.autofillBtn": "\n          🔄 Back to auto-calc\n        ",

  // ===== index.html: ナッシュ均衡 =====
  "nash.h2": "Nash (two-player push/fold)",
  "nash.hint.html": "\n          Computes the two-player Nash equilibrium where the earlier position pushes and the later one calls, ICM included.\n          <br />\n          ※ Assumes HU 2-way. A warning appears when other players sit between (e.g. BTN + BB).\n          <br />\n          ※ This equilibrium assumes a <strong>push-or-fold only</strong> game. Guide: effective 12BB or less. From 12 to 20BB a caution is shown, and above 20BB the result is folded away as out of range (real play adds min-raises and limps).\n          <br />\n          Blinds and antes are paid by the actual positions (a BTN shove posts no blind; the BB pays the BB ante). Opening this view calculates automatically.\n        ",
  "nash.ante.label": "\n            Total ante\n            ",
  "nash.solveBtn": "Recalculate",
  "nash.explanation": "Assumptions and limitations",
  "nash.editSpot": "Edit situation",

  // ===== index.html: ハンド比較 =====
  "hand.h2": "Hand decision",
  "hand.hint.html": "Assume an opponent range to find the hands you can call or shove.",
  "hand.direction.callBack": "Facing an all-in",
  "hand.direction.pushBack": "Shoving myself",
  "hand.direction.autoHero": "Set by seat order: you ({pos}) act first",
  "hand.direction.autoVillain": "Set by seat order: the opponent ({pos}) acts first",
  "hand.preset.top": "Top",
  "hand.mode.preset": "Choose top range",
  "hand.mode.custom": "\n            Custom edit\n          ",
  "hand.custom.hint": "Tap grid cells to add/remove hands from the villain’s range.",
  "hand.custom.selected.html": "Selected: <strong>{n}</strong> hand types / {combos} combos (<strong>{pct}%</strong>)",
  "hand.custom.actions.all": "Select all",
  "hand.custom.actions.clear": "Clear all",
  "hand.custom.actions.fromPreset": "\n              Load from preset\n            ",
  "hand.title.villainPush": "Range they shove 🔴",
  "hand.title.heroCall": "Hands you can call 🟢",
  "hand.label.villainPush": "Range they shove",
  "hand.title.villainCall": "Range they call with 🟢",
  "hand.title.heroPush": "Hands you can shove 🔴",
  "hand.label.villainCall": "Range they call with",
  "hand.legend.html": "👆 <strong>Tap any cell</strong> to see that hand’s equity and a call/fold verdict above the grid.<br />In “Find my call range”: 🟩 ≥ required +0.1pt = call ／ 🟨 within ±0.1pt = borderline (a true coin flip) ／ uncolored = fold.<br />In “Find my push range”: 🟩 = shoving beats folding in $EV ／ 🟨 = borderline, essentially a tie ／ uncolored = fold.",
  "hand.inspect.detail.html": "<strong>{hand}</strong>: equity {eq}% − required {req}% = <strong>{margin}pt</strong> → {verdict}",
  "hand.inspect.verdict.call": "Call",
  "hand.inspect.verdict.marginal": "Borderline",
  "hand.inspect.verdict.fold": "Fold",
  "hand.callStats.callBack": "<strong>{callable}</strong> hand types, <strong>{callPct}%</strong> of all hands ({callCombos} combos): hands at or above the required equity of <strong>{req}%</strong>. Borderline: {marginal} types",
  "hand.callStats.pushBack": "<strong>{n}</strong> hand types, <strong>{pPct}%</strong> of all hands ({pushCombos} combos): hands where shoving beats folding if they call <strong>{villainPct}%</strong>. Borderline: {marginal} types",
  "hand.banner.callerLabel.hero": "hero (you)",
  "hand.banner.noBehind.html": "\n      ✅ {label} = <strong>{pos}</strong>: nobody left to act, so this 1-vs-1 model applies exactly.\n    ",
  "hand.banner.behind.html": "\n      <details class=\"hand-caveat\">\n        <summary>⚠ {label} = <strong>{pos}</strong>: over-calls from {n} player(s) behind are not reflected — play a bit tighter</summary>\n        <div class=\"hand-caveat-body\">\n          This is a 1-vs-1 all-in model. It does not include the risk of the {n} players ({list}) behind {label} coming over the top. {note}\n        </div>\n      </details>\n    ",
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
  "practice.tutorial.q1.lesson": "In WTA there is no prize value in laddering up, so your win rate maps straight to prize EV. That makes the Risk Premium zero. You can decide on cEV (chip-based required equity) alone — the simplest case, with no ICM pressure.",
  "practice.tutorial.q2.title": "You cover them",
  "practice.tutorial.q2.narration": "The villain’s stack is smaller than yours. Even if you lose, you’re still in the tournament.",
  "practice.tutorial.q2.lesson": "When you cover the villain (losing doesn’t bust you), the Risk Premium is small. You can call close to cEV. ICM pressure bites hardest when you risk busting yourself.",
  "practice.tutorial.q3.title": "The bubble trap",
  "practice.tutorial.q3.narration": "You’re 3rd of 4 players left. The chip leader shoves. Your hand isn’t bad… but this might be a trap.",
  "practice.tutorial.q3.lesson": "Even when calling wins chips (+EV in cEV terms), exact ICM can push the required equity way up and make folding correct. That’s the essence of ICM pressure: busting kills your shot at the prize on the spot, while folding keeps your chance at the money and a higher payout alive, so calling costs more than its face value.",
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
        This app lets you both <strong>calculate</strong> that ICM pressure in numbers and
        <strong>practice</strong> it with quizzes.
      </p>
      <ul class="onboarding-tab-list">
        <li><span class="onboarding-tab-icon">📊</span> Calculator (enter stacks and payouts; required equity, callable hands and Nash appear right below)</li>
        <li><span class="onboarding-tab-icon">🎲</span> Practice (real-feel quizzes)</li>
      </ul>
      <p class="hint">It covers all-in decisions: calling an opponent’s all-in, or shoving with a short stack. It does not calculate min-raises or limps.</p>
    `,
  "onboarding.step2.title": "⚡ Try it first",
  "onboarding.step2.body": `
      <p>There are two good ways in.</p>
      <ol>
        <li>
          Change the stacks in <strong>📊 Calculator</strong> (or pick from “Examples and saved spots”) →
          check the required equity and hand chart right below
        </li>
        <li>
          Answer quizzes in the <strong>🎲 Practice</strong> tab to build a feel
        </li>
      </ol>
      <p class="hint">
        Start from either one — and if you get stuck, the <strong>❓</strong> at the
        top right opens the how-to guide and term explanations anytime.
      </p>
    `,
  "onboarding.skip": "Skip",
  "onboarding.next": "Next →",
  "onboarding.cta.practice": "🎲 Start practicing",
  "onboarding.cta.setup": "⚙️ Set it up myself",

  // ===== 使い方ガイド (guide.ts) =====
  "guide.title": "📖 How-to guide",
  "guide.close.aria": "Close",
  // アプリ版のみ表示 (guide.ts proNoteHtml)。価格は書かない。
  "guide.proNote.html":
    "ℹ️ Scenario presets, results, Nash equilibrium, and practice are all free. <strong>Tables with up to 4 players are fully editable (stacks & payouts)</strong>. Editing tables with 5+ players and saving scenarios are 🔒 Pro (one-time purchase) features.",
  "guide.body.html": `
        <p class="guide-intro">
          This tool focuses on short-stack (~20bb) all-in spots.
        </p>
        <details class="howto">
          <summary>📊 Calculator: entering the spot — what it does & how to use</summary>
          <div class="howto-body">
            <p>Enter stacks, seats, You / Villain and payouts in the “Spot” card at the top. Results appear right below and update as you type.</p>
            <ol>
              <li>Open “Examples and saved spots” and tap one to load a situation instantly</li>
              <li>Adjust stacks (add more with + Add player). Tap the Payouts and Blinds rows to open them</li>
              <li>Tap “You” / “Villain” to set the roles</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>📊 Analyze: Results — what it does & how to use</summary>
          <div class="howto-body">
            <p>Auto-calculates ICM equity, Bubble Factor, and required equity (cEV / $EV / RP).</p>
            <ol>
              <li>Enter a situation in “Spot” (examples are fine)</li>
              <li>Check each player’s $ value in the “ICM equity” table</li>
              <li>Check the 🎯 vs ⚔️ cell in the “everyone vs everyone BF map”</li>
              <li>Call amount / net gain auto-calc from 🎯⚔️ (after editing, “🔄 Back to auto-calc” restores them)</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🃏 Analyze: Ranges — what it does & how to use</summary>
          <div class="howto-body">
            <p>Compare the villain’s push/call range with yours via Top X% or custom editing.</p>
            <ol>
              <li>Choose “Find my call range” or “Find my push range”</li>
              <li>For presets, adjust Top X% with the slider; for custom, tap grid cells to select</li>
              <li>Use the grid colors to see which hands you should call/push</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎯 Analyze: Nash — what it does & how to use</summary>
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
        <details class="howto" id="guide-limits">
          <summary>📐 Assumptions and limits</summary>
          <div class="howto-body">
            <h4>What is calculated</h4>
            <ul>
              <li><strong>ICM uses the Malmuth-Harville method</strong>: finish probabilities proportional to stacks, converted to prize equity.</li>
              <li><strong>Required equity</strong> compares three outcomes with ICM: folding, calling and winning, calling and losing. Only with a manually entered call amount, or when no seat is the BB, it falls back to a Bubble Factor estimate.</li>
              <li><strong>Hand equity</strong> comes from a 169 × 169 matchup table (1,000,000 simulated deals per matchup), weighted for the cards your hand removes.</li>
              <li><strong>Nash</strong> solves the two-player push-or-fold / call-or-fold equilibrium in prize equity.</li>
              <li>Blinds assume a <strong>big blind ante</strong> (the BB posts the ante for the table).</li>
            </ul>
            <h4>What is not calculated</h4>
            <ul>
              <li><strong>Only two players are all-in.</strong> Calls from players still to act (over-calls) are not calculated; a warning appears when that applies.</li>
              <li><strong>Future hands are ignored.</strong> By the nature of ICM, upcoming blinds and skill differences are not included.</li>
              <li><strong>Options other than all-in</strong> (2BB opens, limps, 3-bets) are not handled. Shoving results are meant for effective stacks of 12BB or less and are shown as reference only above 20BB.</li>
              <li><strong>Up to 9 players.</strong> Multi-table bubbles cannot be entered.</li>
              <li>The opponent’s <strong>“Top X%” is ordered by equity against a random hand</strong>. Real opponents may include more suited connectors and small pairs; use “Custom edit” to pick their range directly.</li>
            </ul>
            <h4>What has been checked</h4>
            <ul>
              <li>ICM: compared with a separate brute-force implementation on 402 spots (2–9 players); differences below 0.000000001.</li>
              <li>Hand equity: matches well-known values such as AA vs KK 82.0%, AKo vs QQ 43.2%, AA vs random 85.2%.</li>
              <li>Nash: heads-up, 10BB, winner takes all gives push 58.1% / call 37.4%; a separate calculation confirms neither side gains even 0.001BB by deviating.</li>
            </ul>
            <p class="hint">Results are a guide. At the table, also weigh your opponent’s tendencies and the players behind.</p>
          </div>
        </details>
        <details class="howto">
          <summary>📚 Quick term glossary</summary>
          <div class="howto-body">
            <h4>ICM (Independent Chip Model)</h4>
            <p>
              Tournament chips don’t convert to prizes 1:1 (<strong>chips ≠ prize value</strong>).
              ICM is a model that estimates how much prize money your current chip stack is worth.
              E.g. if your ICM% is 25%, on average you expect to take home a quarter of the total prize pool.
            </p>
            <h4>Bubble Factor (BF)</h4>
            <p>
              A coefficient for <strong>the pain of losing ÷ the joy of winning</strong>.
              BF = 1.3 means the prize equity you lose by losing is 1.3× what you gain by winning. In an even-money all-in you need <strong>about 56.5%</strong> (1.3 ÷ 2.3) instead of 50%.
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
              The opponent’s “Top X%” takes X% of all hand combinations, <strong>ordered by equity against a random hand</strong>.
              Other tools rank hands differently (for example by how well they shove), so <strong>the same X% may contain different hands</strong>.
              To match a real opponent, pick the range directly with “Custom edit”.
            </p>
          </div>
        </details>
        <button type="button" class="solve-btn guide-reopen-btn" id="guide-reopen-onboarding-btn">🔄 See the intro guide again</button>
        <button type="button" class="guide-legal-link" id="guide-legal-link">📄 Terms & Privacy Policy</button>
      `,

  // ===== 初回ヒントバー (guide.ts) =====
  "firstHint.html": "👋 New here? Tap a <strong>preset</strong> → see results in <strong>📊</strong>, or practice in <strong>🎲</strong>",
  "calc.limitsLink": "Assumptions and limits ›",
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
  "practice.lesson.satellite": "🛰 In satellites, survival is everything. RP spikes hardest for the mid and big stacks close to locking up a seat, so even strong hands struggle to justify a call (the shortest stack, with little left to lose, can still call wide).",
  "practice.lesson.covered": "⚠️ Calling a player who covers you means losing = elimination. You’re risking your tournament life, so the Risk Premium spikes.",
  "practice.lesson.covering": "When you cover the villain, losing doesn’t bust you, so RP is small — judge close to cEV (hands short on equity are still folds).",
  "practice.lesson.shorter": "While a shorter stack is still in, you can ladder up without forcing a spot. That’s the source of RP.",
  "practice.lesson.general": "Required equity = cEV + Risk Premium. Under ICM, always check that a “chip profit” isn’t a “prize loss.”",
  "practice.pushLesson.wta": "🏆 In WTA (winner-take-all), ICM pressure is zero. You can judge shoves on chip EV (cEV) too.",
  "practice.pushLesson.satellite": "🛰 In satellites, survival is everything. The closer a stack is to locking up a seat, the tighter it has to shove — even with fold equity, most hands become folds (the shortest stack is the opposite: it can end up shoving almost anything).",
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
  "practice.cf.reqLabel": "Required equity:",
  "practice.cf.cevNote": "(chips only: {v}%)",
  "practice.push.pCallLabel": "Opponent call frequency:",
  "practice.push.eqLabel": "Equity when called:",
  "practice.push.diffLabel": "Push minus fold (share of prize pool):",
  "practice.topPct": "Top {pct}%",
  "practice.cf.handEquity": "Equity of {hand} (vs top {pct}%):",
  "practice.cf.heroRangeH3": "🎯 Your call range 🟢 (hands above {pct}% required equity)",
  "practice.cf.legend.call": "call (margin ≥ +0% = +EV)",
  "practice.cf.legend.fold": "fold (negative margin = -EV)",

  // ===== 練習: push 判定フィードバック (judge.ts judgePracticePush) =====
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
  "calc.bf.label.bf": "You vs villain BF",
  "calc.bf.label.risk": "Chips at risk",
  "calc.autofill.summaryLine": "✓ Added call <strong>{call}</strong> / net gain <strong>{pot}</strong> BB",
  "calc.autofill.detailsSummary": "▸ Calculation breakdown",
  "calc.autofill.err.needHV": "⚠ Set exactly one 🎯 you and one ⚔️ villain",
  "calc.autofill.err.zeroStack": "⚠ Stack is 0",
  "calc.autofill.result": "✓ Call <strong>{risk}</strong>, net gain <strong>{pot}</strong> = risk {risk2} + dead money {dead} (SB {sb} + BB {bb} + ante {ante})",
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
  "calc.summary.title": "This spot",
  "calc.summary.sample": "Sample",
  "calc.summary.expand": "Expand",
  "calc.summary.collapse": "Collapse",
  "calc.summary.collapseToggle": "Toggle collapse",
  "calc.summary.hero": "You",
  "calc.summary.prizeShare": "Prize share",
  "calc.summary.prizeExplanation": "Estimated share of the total prize pool (ICM). 33% of a $100 pool means about $33 in value, not your hand's win rate or a guaranteed payout.",
  "calc.summary.pushReference": "BF, required equity and RP are values for calling.",
  "nash.inputsChanged": "The spot has changed. Recalculate Nash for the current conditions.",
  "calc.summary.considerCall": "Considering call",
  "calc.summary.considerPush": "Considering push",
  "calc.summary.allIn": "All-in",
  "calc.summary.assumedCall": "Assumed caller",
  "calc.summary.villain": "Villain",
  "calc.summary.villainUnset": "⚔️ Villain unset",
  "calc.summary.aroundHtml": "<span>👥 Around <strong>{stacks}</strong> BB</span>",
  "calc.summary.bfLabel": "BF ⓘ",
  "calc.eq.approxNote": "With a manually entered call amount, or when no seat is the BB, this is an estimate based on the Bubble Factor.",
  "calc.summary.reqLabel": "Req. eq ⓘ", // fable レビュー済: ピル幅優先の短縮形
  "calc.summary.rpLabel": "RP ⓘ",
  "calc.summary.verdict.call": "Assuming they shove {villain}% of hands, you can call with about <strong>{hero}%</strong> of hands",
  "calc.summary.verdict.callNone": "Assuming they shove {villain}% of hands, almost no hands can call",
  "calc.summary.verdict.push": "Assuming they call with {villain}% of hands, you can shove about <strong>{hero}%</strong> of hands",
  "calc.summary.verdict.pushNone": "Assuming they call with {villain}% of hands, almost no hands can shove",
  "calc.summary.verdict.link": "Hand chart ›",

  // ===== 警告 (calculator.ts) =====
  "calc.warn.position.html": "\n      ⚠ <strong>Position reversed</strong>: action order is <code>{heroPos}({heroAct}) → {villainPos}({villainAct})</code>.\n      In practice <strong>hero ({heroPos}) acts first</strong>, so calling a villain ({villainPos}) open shove can’t happen.\n      (The call math still runs, but swapping positions is more realistic.)\n    ",
  "calc.warn.depth.html": "⚠️ Effective {eff}bb: this is a call decision after an all-in, so the math still applies. But players who shove this deep usually have a narrow, strong range, so set the opponent range tighter.",

  // ===== 用語解説モーダル (calculator.ts INFO_TEXTS) =====
  "info.icm.title": "ICM (Independent Chip Model)",
  "info.icm.body": `
      <p>A model that converts your tournament <strong>chips into the prize money they are worth</strong>.</p>
      <p>Prizes are fixed per finishing position, so doubling your chips does not double your prize.<br />
      Losing all your chips, however, locks in the payout for your finishing place. ICM puts a number on that asymmetry.</p>
      <p>ICM% is <code>your prize equity ÷ total prize pool</code>. E.g. 25% = on average you take home a quarter of the pool.</p>
      <p>This app uses the Malmuth-Harville method (finish probabilities proportional to stacks), the most common form of ICM.</p>
    `,
  "info.bf.title": "BF (Bubble Factor)",
  "info.bf.body": `
      <p><strong>“Prize equity lost when you lose ÷ prize equity gained when you win.”</strong> Measured for a two-player all-in for the effective stack.</p>
      <ul>
        <li><strong>1.00</strong>: loss and gain are equal (no ICM effect, e.g. heads-up)</li>
        <li><strong>1.20</strong>: the loss is 1.2× the gain. An even-money all-in needs 54.5%</li>
        <li><strong>1.50</strong>: the same spot needs 60%. Common around the bubble</li>
      </ul>
      <p>Definition: <code>BF = (now − if you lose) ÷ (if you win − now)</code>, all in ICM prize equity. This is the definition commonly used in ICM literature.</p>
      <p>※ In an even-money (1:1 odds) all-in, <code>required equity = BF ÷ (BF + 1)</code>.</p>
    `,
  "info.rp.title": "Risk Premium (RP)",
  "info.rp.body": `
      <p>The <strong>difference between the required equity under ICM and the chips-only required equity (cEV)</strong>: how much extra equity the prize structure demands.</p>
      <ul>
        <li>RP = 0%: decide on chips alone (no ICM effect)</li>
        <li>RP = +10%: a spot that needs 50% on chips alone needs 60%</li>
      </ul>
      <p>Its size depends on the spot. It grows around the bubble and for stacks sitting inside the seats in a satellite, and shrinks for the shortest stack, which has little to lose.</p>
      <p>Calculation: <code>RP = required equity under ICM − chips-only required equity</code></p>
      <p>In an even-money all-in: <code>RP = BF ÷ (BF + 1) − 50%</code></p>
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
  "nash.notConverged": "Not converged",
  "nash.depthNote.html": "⚠ Effective <strong>{eff}BB</strong>: at this depth, min-raises and limps are normal options. This result only holds if your choice is limited to shove or fold; in real play you should shove fewer hands than shown.",
  "nash.depthOut.html": "⚠ Effective <strong>{eff}BB</strong> is too deep for push/fold. At this depth players open small, limp and 3-bet, and this app does not model those lines. Do not use the result below as a real-play decision.",
  "nash.depthOut.reveal": "Show the shove-or-fold reference anyway",
  "hand.pushDepth.caution.html": "⚠ Effective <strong>{eff}BB</strong>: min-raises and limps are normal at this depth. These shove hands are an upper bound for a shove-or-fold choice only.",
  "hand.pushDepth.out.html": "⚠ Effective <strong>{eff}BB</strong> is outside push/fold range (opens, limps and 3-bets are not modeled). Do not use these shove results as a real-play decision.",
  "nash.stats": "{n} hand types / {combos} combos (<strong>{pct}%</strong>)",
  "nash.matrixMissing": "⚠ HU equity matrix not generated (hu-equity-matrix.json). Run `npx tsx scripts/build-hu-matchups.mts`.",

  "info.req.title": "Required equity",
  "info.req.body": `
      <p>The <strong>minimum equity at which this call breaks even</strong>. If your hand’s equity is above it, call; below it, fold.</p>
      <ul>
        <li><strong>Chips only (cEV)</strong>: required equity from pot odds alone, ignoring ICM</li>
        <li><strong>Required (ICM)</strong>: required equity in prize equity — use this one in practice</li>
      </ul>
      <p>Calculation: <code>required equity = (if you fold − if you lose) ÷ (if you win − if you lose)</code><br />
      Everyone’s stacks after folding, calling and winning, and calling and losing are each converted to prize equity with ICM and compared.</p>
      <p>With a manually entered call amount, or when no seat is the BB, it falls back to the Bubble Factor estimate
      <code>(call × BF) ÷ (call × BF + net win)</code>.</p>
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

  // ===== ペイウォール (freemium ゲート, paywall.ts) =====
  "paywall.title": "🔓 Recreate your own table",
  "paywall.lead": "With Pro, recreate your exact table and analyze it.",
  "paywall.feature.editStacks": "Recreate full tables with 5+ players (stacks & payouts)",
  "paywall.feature.replay": "Recreate and analyze real hands",
  "paywall.feature.save": "Save scenarios and reload them anytime",
  "paywall.price": "Price: {price}",
  "paywall.cta.upgrade": "Upgrade to Pro",
  "paywall.cta.restore": "Restore purchases",
  "paywall.web.note": "This feature is available in the app version.",
  "paywall.close.aria": "Close",
  "paywall.comingSoon": "Coming soon",
  "paywall.lock.title": "Pro feature",
  "paywall.purchase.success": "Upgraded to Pro",
  "paywall.restore.success": "Purchases restored",
  "paywall.restore.notFound": "No purchases found to restore",
  "paywall.error": "Something went wrong. Please try again later",
};
