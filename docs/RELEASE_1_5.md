# Poker ICM 1.5 リリース準備

2026-11-18 作成。バウンティ（KO / PKO）対応を入れた更新。

## 変えたこと

- **バウンティ（KO / PKO）に対応（Pro 限定）**: 「局面」のバウンティ行で形式と各プレイヤーの額を入れると、必要勝率・ハンド表・BF・Nash に反映する。無料で KO / PKO を選ぶと課金画面が出る。
- 日本語の「押す」を「オールイン」に統一。
- RP が「-0.0%」と出ることがあるのを修正。

バウンティの数え方は `core/src/bounty.ts` の冒頭に書いた近似（賞金の ICM ＋ その場で受け取る額 ＋ 卓に残っているバウンティのチップ比率ぶん）。他のツールとの数字の突き合わせはしていない。

## 検証

- 型チェック、単体テスト 112 + 361、E2E 18 件成功（PR #94 の時点）。
- シミュレーター（iPhone 17、Release 構成、`artifacts/release-1.5/sim-*.png`）: バウンティ行の表示、無料で KO を押すと課金画面（機能一覧にバウンティの行）、Pro 状態で KO・全員 10 を入れると必要勝率が 49.8% → 42.9% に変わること、Nash の表示を確認。Pro 状態は、検証用にコピーした .app に開発用の裏口を仕込んで作った（Archive には入っていない）。
- 署名付き Archive: 1.5 / 1、codesign 成功、同梱の Web 資産は build 76f6366（`playground/dist` と一致）。
- 未確認: 実機、iPad のシミュレーター、購入・復元、PKO のシミュレーター表示。

## ストアの文面

アプリ名・サブタイトル・キーワード・スクショは 1.4.2 から変えていない。説明文は、バウンティの節と Pro の範囲を足し、日本語の「プッシュレンジ」「押す」を「オールイン」に直した。審査メモは 1.5 の内容に書き直した（`artifacts/release-1.5/asc/review-notes.txt`）。課金アイテム（pro_lifetime）の説明は変えていない。

### ja-whatsnew

```
・バウンティトーナメント（KO / PKO）に対応しました（Pro）。各プレイヤーのバウンティ額を入れると、必要勝率・ハンド表・BF・Nash に反映されます
・日本語の表記を「オールイン」に統一しました
・RP が「-0.0%」と表示されることがあるのを直しました
```

### en-whatsnew

```
- Bounty tournaments (KO / PKO) are now supported (Pro). Enter each player's bounty and the required equity, hand charts, BF and Nash take it into account
- Fixed the risk premium sometimes showing as "-0.0%"
```

### 説明文に足した節（ja）

```
■ バウンティ（KO / PKO）【Pro】
各プレイヤーにかかっているバウンティの額を入れると、必要勝率・ハンド表・Bubble Factor・Nash のすべてに反映します。KO は飛ばした相手のバウンティを全額、PKO は半分をその場で受け取り、半分が自分のバウンティに乗る形で計算します。卓に残っているバウンティはチップの比率で見積もる近似です。ミステリーバウンティは平均の額を入れてください。
```

### 説明文に足した節（en）

```
- Bounty tournaments (KO / PKO) - Pro
Enter the bounty on each player and the required equity, hand charts, Bubble Factor and Nash all take it into account. KO pays the full bounty at once; PKO pays half at once and adds half to your own bounty. Bounties still on the table are valued by chip share, which is an approximation. For mystery bounties, enter the average value.
```

## スクショ（2026-11-18 追記）

バウンティの画面（`07-bounty.png`）を ja / en の iPhone・iPad に足し、2枚目に並べた。ほかの5枚は 1.4.2 から引き継ぎ。追加のために一度審査を取り下げ、同じ日に出し直した。
