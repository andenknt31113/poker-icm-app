# Stitch UI プロンプト集 — Poker ICM/BF

Google Stitch (stitch.withgoogle.com) で UI を作り直すためのプロンプト。
英語のほうが精度が出るため英語で記述。**1画面ずつ生成**するのがおすすめ。

---

## 0. 共通デザインシステム（毎回のプロンプト冒頭に貼る or 最初に設定）

```
Design a modern, mobile-first Progressive Web App called "Poker ICM/BF" —
a tool for poker tournament players to calculate ICM equity, Bubble Factor,
and to train their all-in call/fold decisions.

DESIGN SYSTEM (apply consistently to every screen):
- Platform: mobile-first, single column, max content width ~720px, safe-area aware.
- Theme: dark by default. Background #0F1419, deep #050709, cards #1A2027,
  borders #2A3038. Primary text #E6E6E6, muted text #8A9099.
- Accent color: cyan/sky blue #4FC3F7 (used for primary actions, highlights, active tabs).
- Semantic colors: positive/green #66BB6A, warning/orange #FFA726, danger/red #EF5350.
- Typography: clean sans-serif (SF Pro / Inter style). Numeric/monospace font for
  all figures, odds, and percentages.
- Language: Japanese UI text.
- Style: sleek, data-dense but breathable, rounded cards (8–12px radius),
  subtle shadows, poker/finance dashboard feel. Emoji icons are used as accents.
- Navigation: a compact top or bottom tab bar with 5 icon tabs:
  ⚙️ Setup, 📊 Result, 🃏 Hand, 🎯 Nash, 🎲 Practice. Active tab tinted with the accent color.
- Header: app title "🎰 Poker ICM/BF" with two round icon buttons on the right:
  a share button (🔗) and a light/dark theme toggle (🌙).
```

---

## 1. Setup（⚙️ セットアップ画面）

```
Screen: "Setup / シナリオ設定".
Sections stacked as cards:
1) Scenario presets: a grid of pill buttons for quick table setups
   (e.g. "9-max FT 開幕", "FT バブル", "6 残り", "4 残り", "3-handed",
   "HU 10/10", "🛰 サテライト"). Plus a "＋ 現在の状況を保存" save button.
2) Players: a list of up to 9 players. Each row has a chip-stack number input,
   and two toggle chips to mark "🎯 自分 (Hero)" and "⚔️ 相手 (Villain)".
   Buttons below: "+ プレイヤー追加" and "🎲 スタックをランダム化".
3) Payout structure: rows to enter prize for each finishing position (% or $),
   preset chips (Top3 50/30/20, WTA, etc.), and saved payouts.
4) Memo: a multi-line note textarea for the scenario.
5) A prominent "🔗 シナリオを URL で共有" button.
Keep it tidy, card-separated, easy to tap.
```

---

## 2. Result（📊 計算結果画面）

```
Screen: "Result / 計算結果". Three cards:
1) "ICM エクイティ": a clean table with columns #, スタック (stack),
   $ エクイティ, % — one row per player, hero row highlighted.
2) "Bubble Factor (BF)": a headline BF value for Hero vs Villain, then a
   heatmap MATRIX grid ("全員 vs 全員 BF マップ"): rows = Hero, columns = Villain,
   each cell shows two stacked numbers (top = Risk Premium %, bottom = BF value),
   color-coded from green (BF < 0.85, favorable) through yellow (~1.0 neutral)
   to orange and red (BF > 1.25, dangerous). Diagonal is inert.
3) "必要勝率 (cEV / $EV / RP)": inputs for call amount and pot-if-win with
   +/- steppers, an "自動算出" button, and a result block showing the required
   equity for cEV, $EV, and the Risk Premium between them.
Emphasize the color-coded BF heatmap as the visual centerpiece.
```

---

## 3. Hand（🃏 ハンドレンジ比較画面）

```
Screen: "Hand Range / ハンドレンジ比較".
- Two toggle tab rows at top: direction ("自分の call を逆算" / "自分の push を逆算")
  and mode ("プリセット (Top X%)" / "カスタム編集").
- A range slider labeled "相手のpushレンジ: 25%".
- The centerpiece: TWO 13x13 poker hand-range grids side by side (or stacked on
  mobile). A poker range grid = 13 columns × 13 rows of hand cells
  (AA, AKs, AKo ... 22), pairs on the diagonal, suited above, offsuit below.
  Left grid "相手のpushレンジ 🔴" with selected cells filled in red/danger tint;
  right grid "自分のcallレンジ 🟢" with cells filled in green.
  Cells are small rounded squares with the hand label; selected cells are
  saturated, unselected are dim. Below the hero grid, show call stats text.
Make the hand grids crisp and legible with the monospace font.
```

---

## 4. Nash（🎯 Nash均衡画面）

```
Screen: "Nash Equilibrium / Nash均衡 (HU push/fold)".
- A short explanatory hint at top.
- A row of three numeric inputs: SB, BB, アンティ合計 (ante).
- A primary "Nash 計算" button in the accent color, with a status line.
- Results: two labeled 13x13 poker hand-range grids side by side:
  "🎯自分 push レンジ 🔴" (red-filled selected cells) and
  "⚔️相手 call レンジ 🟢" (green-filled selected cells), each with a stats
  line above showing the range percentage.
Same crisp grid styling as the Hand screen.
```

---

## 5. Practice（🎲 練習問題画面）

```
Screen: "Practice / 練習問題" — a training quiz.
Top controls:
- A mode switch (segmented control): "⚖️ call/fold 判定" and "📊 RP 当て".
- Stat badges: "🔥 連続正解 (streak)" and "正解率 (accuracy %)".
- A difficulty segmented control: Easy / Normal / Hard.

Mode A "call/fold 判定": shows a generated table scenario (payouts, blinds,
villain's push range as a small 13x13 grid, and the hero's dealt hand as two
playing cards), then two big buttons "コール" (green) and "フォールド" (red).
After answering, a feedback panel shows correct/incorrect, the required equity,
and an expandable "詳しい計算式" details section.

Mode B "RP 当て": shows the scenario, then a prominent question
"この状況の Risk Premium は？" with a LARGE numeric readout (e.g. "+20.0%")
above a horizontal SLIDER (0%–50%), a scale (0% / 25% / 50%), a tolerance hint
("許容誤差 ±2.5%"), and a "回答する" button. After answering: feedback panel with
the user's answer vs the correct RP, the error margin, and an expandable
calculation breakdown (Bubble Factor, required equity, RP formula).

Make it feel like a game: satisfying, focused, one clear decision per screen.
```

---

## 使い方メモ

- Stitch では **Experimental モード**の方が長いプロンプトを反映しやすい。
- まず「0. 共通デザインシステム」で1画面作り、生成後に **"次はこの画面"** と
  各画面プロンプトを続けて投げると、トーンが揃いやすい。
- 13x13 のハンドグリッドは Stitch が苦手なことがあるので、うまく出ない場合は
  「a 13x13 grid of small squares, like a poker hand range chart」と補足する。
- 出力の HTML/CSS をそのまま使うのではなく、**配色・レイアウトの参考**として
  現行の `playground/src/style.css` に反映させるのがおすすめ。
```
