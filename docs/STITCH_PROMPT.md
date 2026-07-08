# Stitch UI プロンプト集 v2 — Poker ICM/BF

Google Stitch (stitch.withgoogle.com) で UI を改善するためのプロンプト集。
英語のほうが精度が出るため英語で記述。**1画面（または1部品）ずつ生成**がおすすめ。

> v2 更新: オンボーディング / ヘルプガイド / RP当てモード / 成績推移 /
> トランプ表示 / bento シナリオカードなど、実装済みの新機能を反映。

---

## 0. 共通デザインシステム（毎回のプロンプト冒頭に貼る）

```
Design a modern, mobile-first Progressive Web App called "Poker ICM/BF" —
a tool for poker tournament players to calculate ICM equity / Bubble Factor
and to TRAIN their all-in call/fold instincts with quizzes.

DESIGN SYSTEM (apply consistently):
- Mobile-first, single column, max content width 720px, safe-area aware.
- Dark theme default: bg #0F1419, deep #050709, cards #1A2027, borders #2A3038.
  Text #E6E6E6, muted #8A9099.
- Accent: cyan #4FC3F7 (primary actions, active states, key numbers).
- Semantic: good/green #66BB6A, warn/orange #FFA726, bad/red #EF5350.
- Fonts: Inter for UI text, JetBrains Mono for ALL numbers/percentages/odds.
- Language: Japanese UI text.
- Cards: 8-12px radius, subtle borders, occasional soft accent glow.
- Inputs: near-black background (#050709), inset shadow, cyan focus ring.
- Primary buttons: cyan fill with soft cyan glow shadow.
- Bottom nav: 5 tabs, icon + small Japanese label stacked; active tab = cyan
  text + small 3px bar at top of the tab.
  Tabs: ⚙️セットアップ / 📊計算結果 / 🃏ハンド比較 / 🎯ナッシュ均衡 / 🎲練習
- Header: "🎰 Poker ICM/BF" centered, round icon buttons right: ❓ help,
  🔗 share, 🌙 theme toggle.
```

---

## A. 画面プロンプト

### A-1. オンボーディング（初回起動モーダル・3ステップ）

```
Screen: first-run onboarding MODAL over a dimmed app background.
A centered card (max 480px) with:
- Step indicator: 3 dots, current one cyan.
- "スキップ" link at top-right of the card.
- Step 1 "🎰 これは何？": one friendly paragraph, then a compact list of the
  5 tabs with icon + one-line description each.
- Step 2 "⚡ まず触ってみる": two suggested entry points, shown as two
  tappable option cards: "プリセット → 📊 結果を見る" and "🎲 練習クイズに答える".
- Step 3 "📖 困ったら": points to the ❓ help button in the header.
- Final step has two CTAs: primary "🎲 練習を始める" (cyan, glowing) and
  secondary outline "⚙️ 自分で設定する".
Design all 3 steps. Friendly but not childish; this is a poker tool.
```

### A-2. 使い方ガイド（❓ヘルプモーダル）

```
Screen: a full-height help MODAL "📖 使い方ガイド", scrollable, opened from
the header ❓ button. Content is an accordion list (collapsed by default):
- 5 items for tabs: "⚙️ セットアップ", "📊 計算結果", "🃏 ハンド比較",
  "🎯 ナッシュ均衡", "🎲 練習" — each expands to "できること" plus a numbered
  2-4 step typical workflow.
- 4 glossary items: "ICMとは", "Bubble Factor とは", "Risk Premium とは",
  "Nash均衡とは" — each expands to a 2-4 sentence plain-language explanation
  with one tiny numeric example in monospace.
- 1 item "Top X% レンジとは".
- Bottom: a subtle "🔄 もう一度はじめのガイドを見る" button.
Make expanded/collapsed states visually clear; chevron rotation on expand.
```

### A-3. 練習 — call/fold 出題画面（bento + トランプ）

```
Screen: Practice quiz, mode "⚖️ call/fold 判定".
Top: segmented mode switch (⚖️ call/fold 判定 | 📊 RP 当て), stat pills
(🔥 streak, 正解率 %), difficulty segmented control (Easy/Normal/Hard).
Main scenario card (bento style, subtle cyan+red glow blobs clipped inside):
- Left: "TOURNAMENT STATE" label, blinds (SB 0.5 / BB 1 / Ante 1) and
  payout structure in mono font.
- Right: "HERO STACK" label with a big cyan number like "15.4 BB".
- Below a divider: "⚠️ Villain (BTN) All-in" in red, villain stack, and
  "想定レンジ: Top 35%".
Below the card: a small round poker-table diagram showing seat positions.
Hero's hand: TWO large white playing cards, slightly rotated (±6°),
overlapping, with rank+suit in corners and a big suit pip in the center
(e.g. A♣ and J♠). Cards cast soft shadows.
Bottom: two big chunky 3D buttons with hard offset shadows that visually
press down when tapped: "✓ コール" (green) and "✕ フォールド" (red).
```

### A-4. 練習 — 回答後フィードバック

```
Screen: Practice quiz feedback state, right after answering.
A feedback panel slides in below the action buttons:
- Verdict line: "🎉 正解!" (green tint) or "😅 不正解" (red tint), followed by
  the correct action.
- Key numbers in a compact grid (mono font): cEV 必要勝率, 厳密ICM 必要勝率
  (labeled "判定はこちら", cyan-underlined), ハンド equity vs range, 余裕 ±X%.
- A collapsed accordion "📖 詳しい計算式 (タップで展開)" — show it expanded in
  a second frame: sections for pot composition, a 3-row outcome table
  (フォールド / コール+勝ち / コール+負け with final stacks), ICM equities,
  Bubble Factor, and a comparison row "BF近似: 62.4% / 厳密ICM: 63.4%".
- Bottom buttons: primary "🎲 次の問題", secondary "📥 設定に取り込む".
Design both collapsed and expanded frames.
```

### A-5. 練習 — RP当てモード（スライダー）

```
Screen: Practice quiz, mode "📊 RP 当て".
Same top controls and bento scenario card as call/fold mode, but NO hand
cards. Instead a question card:
- "📊 この状況の Risk Premium は？" heading.
- A HUGE mono readout "+20.0%" in cyan.
- A horizontal slider 0%–50% with a glowing cyan thumb, scale marks
  0% / 25% / 50% below.
- Small hint "許容誤差 ±2.5%（難易度で変化）".
- Full-width primary button "回答する".
Second frame: answered state — user's guess vs correct RP vs error margin,
color-coded, plus the same collapsed "詳しい計算式" accordion.
```

### A-6. 練習 — 成績の推移パネル

```
Component: "📈 成績の推移" — an expandable card on the Practice tab.
Expanded state shows:
- Hero number: 直近20問の正解率 (big, color-coded green ≥70% / orange 50-70 /
  red <50) next to 全期間正解率 (smaller).
- A smooth sparkline chart (cyan line with soft area fill) of accuracy per
  10 answers over the last 100 answers, no axes, 60px tall, full width.
- Two compact stat groups: 難易度別 (Easy/Normal/Hard as 3 mini columns) and
  モード別 (⚖️ call/fold vs 📊 RP当て), each showing 正解数/回答数 (%).
- A tiny muted "履歴をリセット" text button bottom-right.
Also design the empty state: "まだデータが足りません (3問)".
```

### A-7. 計算結果 — 必要勝率フロー

```
Component: "必要勝率 (Req. Eq)" card on the Result tab.
- Two numeric inputs side by side with +/- stepper buttons inside the field:
  "コール額" and "勝った時の純利得" (mono font values).
- A button "🎯⚔️ から自動算出".
- RESULT BLOCK (the centerpiece): a horizontal flow on a darker inset strip:
  [cEV (Chip) 37.5%]  +  [Risk Premium +4.5% in orange]  →  [$EV (True Req)
  42.0% — larger, cyan, underlined with a 2px cyan bar]. Arrows/plus signs
  muted. On narrow screens the three blocks stay readable (shrink, not wrap
  chaotically).
```

### A-8. 計算結果 — BF ヒートマップ（改良）

```
Component: "全員 vs 全員 BF マップ" heatmap on the Result tab.
A grid: rows = Hero (P1..P6), columns = Villain. Each cell shows two stacked
mono numbers: top = Risk Premium %, bottom = BF value. Cell tinting by BF:
translucent green (<1.0) → yellow (~1.1) → orange (1.1-1.25) → red (>1.25),
with matching colored 1px borders. Hero row/column headers highlighted cyan.
Diagonal cells inert/dimmed. Legend chips Low/Med/High bottom-right.
Above the grid: a summary strip "Hero vs Villain (P2): BF 1.32 / +4.5% RP"
with the BF in orange and RP in green.
```

### A-9. セットアップ（初回ヒントバー込み・最新版）

```
Screen: Setup tab, latest version.
- At the very top a dismissible hint bar (only for new users): "👋 はじめて
  なら: プリセットをタップ → 📊 で結果を見る、か 🎲 で練習" with an ✕.
- Card 1 シナリオプリセット: pill buttons grid (9-max FT 開幕 / FT バブル /
  6 残り / 4 残り / 3-handed / HU 10/10 / HU 短/長 / 🛰 サテライト) plus
  "＋ 現在の状況を保存" and a row for saved user scenarios.
- Card 2 プレイヤー (4/9): rows with position select, big mono stack input,
  🎯自分 / ⚔️相手 toggle chips (cyan/red borders when active). Buttons:
  + プレイヤー追加, 🎲 スタックをランダム化.
- Card 3 ペイ構造: rank rows (1st/2nd/3rd + %), preset pills, saved payouts.
- Card 4 📝 メモ textarea.
- Full-width glowing primary "🔗 シナリオを URL で共有".
```

### A-10. PWA 系バナー（インストール導線・オフライン）

```
Components (design 3 small pieces on one canvas):
1. iOS install banner: a card fixed above the bottom nav — "📲 ホーム画面に
   追加でアプリとして使えます: 共有ボタン → ホーム画面に追加" with an ✕.
2. An install icon-button 📲 that appears among the header round buttons.
3. Offline strip under the header: "📡 オフライン — 計算はすべて端末内で
   動作します" on a subtle orange-tinted band.
All must feel native to the dark cyan design system, non-intrusive.
```

---

## B. バリエーション・改善イテレーション用

### B-1. ライトモード一式

```
Take the current screen and create a LIGHT theme variation:
bg #F5F7FA, cards #FFFFFF, borders #D4DAE1, text #1A2027, muted #6B7280,
accent #0288D1, good #2E7D32, warn #EF6C00, bad #C62828.
Keep ALL layout identical. Inset input shadows become much subtler; glows
become soft colored shadows. Playing cards stay white with a visible border.
Check number legibility in JetBrains Mono at small sizes.
```

### B-2. 情報密度チューニング（上級者向け）

```
Create a "compact density" variation of this screen for expert users:
reduce paddings ~30%, smaller labels, same font sizes for key numbers.
Nothing may be removed — only tightened. Keep tap targets ≥ 40px.
```

### B-3. 初心者向け「やさしい」バリエーション

```
Create a "beginner-friendly" variation: add one short explanatory sentence
under each section title, increase whitespace, and add a small "?" chip
next to technical terms (ICM, BF, RP) implying a tappable explanation.
```

### B-4. Stitch 内での微調整に使う短文コマンド集

そのまま追記で送る用:

- `Make the key numbers 20% larger and increase their contrast.`
- `The buttons feel flat — add depth with shadows consistent with the design system.`
- `Too cramped on 360px width — show me the mobile-S layout.`
- `Replace emoji icons with Material Symbols equivalents, keep Japanese labels.`
- `Show the pressed/active state of the main buttons.`
- `Show this screen with a very long Japanese payout list (7 places) to test overflow.`
- `Add an empty state for this list.`

---

## C. 公開準備用（おまけ）

### C-1. ランディングページ（マネタイズ準備）

```
Design a single-page mobile-first LANDING PAGE for "Poker ICM/BF" (Japanese):
- Hero: app icon, one-liner "ICM プレッシャーを、計算して、鍛える。",
  sub-line about free tournament ICM/BF calculator + training quizzes,
  big CTA "無料で使ってみる" and a phone mockup of the Practice screen.
- 3 feature cards: 🎲 練習クイズ (毎日30秒のICMトレーニング),
  📊 リアルタイム計算 (ICM/BF/Nash), 📈 成績の見える化.
- A screenshot strip of the 5 tabs.
- Simple FAQ accordion (3 items) and a footer.
Dark theme, same design system, tasteful poker mood without casino kitsch.
```

### C-2. OGP シェアカード画像

```
Design a 1200x630 social share card (OGP image) for "Poker ICM/BF":
dark #0F1419 background, app title with 🎰, tagline "ICMプレッシャーを、
計算して、鍛える。", a stylized BF heatmap fragment and two playing cards
as visual elements, cyan #4FC3F7 accents. Text must be legible at
thumbnail size. No UI chrome, no browser frame.
```

---

## 使い方メモ

- **Experimental モード**推奨。まず「0. 共通デザインシステム」を含めて1画面
  生成 → 同スレッドで次の画面を続けると、トーンが揃いやすい。
- 出力の Copy as Code は**そのまま使わず**、配色・レイアウトの参考として
  `playground/src/style.css` に反映する（実装は既存の id/クラス構造を維持）。
- 13x13 ハンドグリッドが崩れる場合の補足:
  `a 13x13 grid of small squares, like a poker hand range chart`
- 生成結果をこのリポジトリに反映するときは、コード一式を会話に貼れば OK。
  差分の質が高いのは「新しい部品を含む画面」だけ（既知の部品は不要）。
```
