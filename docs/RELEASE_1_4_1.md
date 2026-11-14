# Poker ICM 1.4.1 リリース準備

2026-11-14 作成。目的は「ストアで見つけてもらいやすくする」こと。計算と画面は 1.4 から変えていない。

## 変えたこと

- **評価のお願い**: 3回以上起動し、Nash の一覧を2回最後まで見た直後に、Apple 標準の評価ダイアログを頼む。一度頼んだら120日あける。iOS アプリの中だけで動く（`playground/src/reviewPrompt.ts`、しきい値は同ファイルの定数）。実際に出すかどうかは iOS が決める（年3回までなど）。
- **アプリ名・サブタイトル・キーワード（日本語）** を見直した。名前に「ポーカー」「トーナメント」「計算」を入れ、サブタイトルから「練習」を外し、キーワードは名前・サブタイトルと重ならない語で埋めた。
- **英語のストアページ（en-US）** を追加した。スクショも英語表示で撮った（`node playground/e2e/capture-release.mjs <出力先> en`）。
- アプリに同梱するサポートページと利用規約が、Web 版の案内を外した新しい文面になる。

## 検証

- 型チェック、単体テスト 93 + 328 成功。
- シミュレーター（iPhone 17 / iOS 27.2、Release 構成）で起動し、条件を満たした状態で Nash の一覧を開くと、計算が終わった直後に評価ダイアログが出ることを確認（確認用コピーに保存値と自動操作を仕込む方法）。
- 英語表示のスクショ（局面・レンジ・Nash・チョップ）を目視。はみ出しや未翻訳は見当たらなかった。
- 実機では未確認。

## ストアの文面

### ja-name

```
Poker ICM - ポーカー トーナメント計算
```

### ja-subtitle

```
必要勝率・Nashレンジ・ICMチョップを計算
```

### ja-keywords

```
バブルファクター,ナッシュ,プッシュフォールド,テキサスホールデム,ホールデム,トナメ,MTT,GTO,プリフロップ,ディール,オールイン,リスクプレミアム,SNG,賞金,ソルバー,勝率
```

### ja-whatsnew

```
・数回ご利用いただいたあとに、App Store の評価のお願いが表示されることがあります（Apple 標準の画面です）
・アプリ内のサポートページと利用規約の記述を更新しました
・App Store の表記（アプリ名・説明・キーワード）を見直し、英語のストアページを追加しました

計算の内容は 1.4 から変わりません。

```

### en-name

```
Poker ICM - Nash Push/Fold
```

### en-subtitle

```
ICM calculator, ranges & chop
```

### en-keywords

```
tournament,holdem,bubble,factor,risk,premium,equity,shove,call,mtt,sng,deal,final,table,solver,gto
```

### en-promo

```
Exact ICM for all-in decisions: the equity you need to call a shove, and when to shove short. Nash ranges for every seat. Works offline. No real-money gambling.
```

### en-whatsnew

```
- Added an English App Store page
- After a few uses, the app may ask you to rate it (the standard Apple prompt)
- Updated the in-app support page and terms

Calculations are unchanged from 1.4.

```

### en-description

```
"It's the bubble. Can I call this shove?" Poker ICM answers that with numbers, on the spot.

Poker ICM calculates ICM (Independent Chip Model) equity and Bubble Factor for poker tournaments, so you can check call/fold and push/fold decisions around all-ins with real numbers.

WHAT IT DOES

- Required equity (with ICM / chips only / risk premium)
Enter everyone's stack and the payouts, then mark yourself and your opponent. The equity you need to call is computed exactly from your prize equity when you win, lose or fold. You see how heavy ICM is: "28.6% on chips alone, 33.5% with ICM."

- ICM and the Bubble Factor map
Prize equity for every player using the Malmuth-Harville method, and a heatmap of everyone versus everyone that shows who you should play tight or loose against.

- Hand ranges
Set the range your opponent shoves and the hands you can call are colored on a 13x13 grid. The app follows the seat order and switches between "facing a shove" and "shoving first" for you. You can also drop the spot's Nash range in as the opponent's range.

- Nash equilibrium (push or fold)
Nash ranges with ICM for every seat. For each player who could shove first, you get their shoving range and the calling range of every player behind, including a second caller (three-way all-in). Tap a row to open its 13x13 chart.

- ICM chop (deal)
A table of ICM-based payouts for the remaining players, next to a chip-chop, with optional rounding.

WHO IT IS FOR

- Players who are not sure about their decisions around the bubble and at final tables
- Players who want to back their ICM reads with calculation rather than feel
- Players who have heard of ICM and Bubble Factor and want to see how they work

OFFLINE AND PRIVATE

All calculations run on your device. Your stacks and payouts are never sent to a server. No account is needed. Everything works without a connection (purchasing or restoring Pro needs one).

FREE AND PRO (ONE-TIME PURCHASE)

Free: every calculation (ICM, Bubble Factor map, required equity, ranges, Nash, chop) on 8 built-in example spots, and tables of up to 4 players with stacks and payouts you can edit freely. Pro is a one-time purchase, not a subscription. It unlocks tables of 5 or more players and saving your own spots.

WHAT IT COVERS AND WHAT IT DOES NOT

The app is about decisions that involve an all-in:
- Calling or folding against a shove, at any stack depth
- Shoving or folding with a short stack (roughly 12 big blinds effective or less)
- Up to three players all-in at once

It does not calculate:
- Min-raises, limps, 3-bets or any action other than all-in
- Four or more players all-in at once
- Postflop play

Above 20 big blinds effective, push-or-fold no longer matches real play, so Nash results are shown as a reference with a note. The assumptions and limits are listed inside the app.

NOTE

This app is not real-money gambling. It is a calculation tool for studying tournament decisions. Results are for reference and are not guaranteed to be accurate or complete. Decisions at the table are your own responsibility.

```

