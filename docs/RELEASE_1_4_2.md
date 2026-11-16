# Poker ICM 1.4.2 リリース準備

2026-11-16 作成。1.4.1 公開後の全体レビューで見つけたものをまとめた更新。計算の内容は 1.4 から変えていない。

## 変えたこと

- **Nash**: コールに回る人が4人以上の組（5人以上の卓）は、自分・相手の行を先に出し、残りは「ほか N 人のコールを表示」で開く。
- **iPad**: 「賞金・BF」のカード配置を揃え、ハンド表の最大幅を決めた。
- **結果サマリー**: 相手がいない・スタックが 0 のときは数字を出さず、何を入れればよいかを出す。
- **カスタム編集**: 空で開いたときは、見ていた上位レンジを最初に入れる。
- **賞金**: プリセットに選択中の印。無料で5人以上の卓を開いたときの行のくずれを修正。
- **使い方ガイド・説明文**: 今の画面に合わせて書き直し（Nash の説明、英語版、計算の内訳、色の説明、エラー文）。英語の呼び名は Villain に統一。
- **利用規約**: 無料の範囲（4人まで）と呼び名を今のアプリに合わせた。
- 続けてタップしたときに画面が拡大されるのを防ぐ（`touch-action: manipulation`）。
- Web 版向けのコード（Service Worker、ホーム画面に追加の案内、OGP）を削除。iOS では元から動いていなかった部分。

## 検証

- 型チェック、単体テスト 93 + 345、E2E 17 件成功。
- ブラウザ（幅 393 / 1032、日本語 / 英語）で全画面を撮って目視。
- シミュレーター（iPhone 17、Release 構成、`artifacts/release-1.4.2/sim-*.png`）で、初回起動、9人卓の Nash の折りたたみ、新しいガイド、5人以上の卓の賞金行を確認。
- 署名付き Archive: 1.4.2 / 1、codesign 成功、同梱の Web 資産は build 2e511da（`playground/dist` と一致）。
- 未確認: 実機、iPad のシミュレーター、購入・復元、ダブルタップ拡大の対策が実機で効いているか。

## ストアの文面

アプリ名・サブタイトル・キーワード・説明文・スクショは 1.4.1 から変えていない（スクショは 1.4.1 のものを引き継ぎ。iPad のスクショにはヘッダーの「STUDY ROOM」が写っているが、アプリからは外した）。

### ja-whatsnew

```
・人数の多い卓の Nash を見やすくしました（自分と相手の行を先に表示し、ほかの人は開いて確認できます）
・iPad での「賞金・BF」とハンド表の表示を整えました
・相手を選んでいないときやスタックが 0 のときに、何を入れればよいかを表示するようにしました
・カスタム編集を開いたとき、上位レンジが最初から入るようにしました
・賞金のプリセットに選択中の印を付けました
・使い方ガイドと説明文を今の画面に合わせて書き直しました
・続けてタップしたときに画面が拡大されることがあるのを防ぎました

計算の内容は 1.4 から変わりません。
```

### en-whatsnew

```
- Nash for larger tables is easier to read: your row and the villain's row are shown first, and the other players can be expanded
- Tidied the Prizes / BF view and the hand charts on iPad
- When no villain is selected or a stack is 0, the summary now tells you what to enter
- Custom edit now starts from the current top range
- Payout presets show which one is selected
- Rewrote the in-app guide and explanations to match the current screens
- Prevented the screen from zooming on quick repeated taps

The calculations are unchanged from 1.4.
```
