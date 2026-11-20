# 1.5.3 (build 1)

2026-11-20 の 1.5.2 提出後に実施した全体レビュー・改善（PR #103・PR #104・PR #106）をまとめた更新。計算式・課金の仕組みは 1.5.2 から変えていない。

## 変えたこと

### 計算・端ケースの不具合

- **ショート BB 相手に自分からオールイン（`pushBack`）すると 0%（AA も不可）になる不具合を修正**: `pushSpot.ts` および `core`（`callDecision.ts` / `potOdds.ts` / `pushDecision.ts`）でブラインド・アンティ支払いを所持スタック上限にクランプし、全終端の非負・チップ総量保存を保証。
- **負のブラインド・アンティ入力による画面崩れを防止**: `readBlindParams()` と blur 正規化により、負数入力時に英語 UI でも日本語の内部エラーで ICM 表ごと消滅する不具合を解消。スタック・賞金・バウンティ欄の負数も blur 時に正規化。
- **均等賞金（サテライト等）での `BF = Infinity` 表示を整理**: サマリーの `Infinity` 生文字を `∞` に、BF マップの灰セル `+0.0% / Infinity` を赤セル `+50.0% / ∞` に修正。
- **Nash 一覧の端ケース修正**:
  - 計算途中でタブ離脱→復帰すると未完了のまま止まるレース条件を修正。
  - 全員スタック 0 のときに「位置が足りない」誤案内と自動入力ボタンが出る不具合を修正。
  - 末尾席（BB 等）がスタック 0 のときに押せる席から除外し、有効 1 人以下（例: SB 10 / BB 0）で Nash タブが空白になる不具合を修正。
  - `overcallNash.ts` に入力検証・既 0 チップ席の順位補正・バウンティ考慮の傾き計算を追加。
- **保存済みデータ・保存シナリオの破損耐性**: `sanitizePlayersArray` を追加し、不正なスタック・ロール・ポジション・上限超過人数が混ざっていても安全に正規化して読み込むようにした。

### 画面・操作・課金・iOS ネイティブ

- **iOS 起動時の白フラッシュ解消・ダーク UI 統一**: `capacitor.config.ts`（`ios.backgroundColor: "#101715"`）、`SceneDelegate.swift`（ウィンドウ背景色）、`Info.plist`（`UIUserInterfaceStyle = Dark`）を設定。スプラッシュ終了〜WebView 初回描画の間の白画面とライトモードのネイティブダイアログ・キーボード混在を解消。
- **Pro 保存・削除のブラウザ標準ダイアログをアプリ内ダークモーダルへ置換**: `window.prompt` / `window.confirm` を使っていた4箇所（局面保存・局面削除・賞金保存・練習履歴リセット）を `dialogModal.ts` に統一。空欄時の保存ボタン無効化、破壊的操作の誤爆防止フォーカス、Escape・背景タップ対応、HTML エスケープを実装。
- **iOS 触覚フィードバック（`@capacitor/haptics`）を導入**: 同梱済みで未使用だったプラグインを `haptics.ts`（`isCapacitorNative()` ガード付き）から活用し、タブ切替・ハンド表セルタップ・レンジ目安・役割切替・Undo・保存完了・購入/復元成功時に軽い触覚を追加。
- **未使用のテンプレート画像を整理**: `Splash.imageset` に残っていた未参照の PNG 3枚を削除し、Xcode の asset warning 5件を解消。
- **自分からオールイン（`pushBack`）時の使い勝手と表示を統一**:
  - ハンド表のセルタップで相手コール率・コール時勝率・賞金期待値差・判定を確認できるようにした（向き切替時は選択解除）。
  - 凡例の記号色を実際の赤（🟥）に修正。
  - Hand タブ下部ボタン・入力ラベル（「追加で出す額」）・20BB 超の深さ警告をオールイン向きの表現に統一。
- **バウンティ関連の表示・Undo 改善**:
  - BF < 1.0 の有利セルを緑寄りグラデーション、負 RP を緑トーンに。ICM 表・チョップにバウンティ別の注記を追加。
  - バウンティ一括適用（`#bounty-all`）入力中の重複 Undo チェックポイントを解消し、無料ユーザーに過去の KO/PKO 設定が残っていても「なし」が選択表示されるようにした。
- **細かな画面・課金ガード**:
  - 375px 英語・無料・9人卓で `None` ボタンが右端で切れていたのを、🔒 をスタック入力欄内に重ねるレイアウトで解消。
  - 初回案内を閉じた直後に「サンプル」札を即削除。各モーダルに `role="dialog" aria-modal="true"` を付与。
  - Pro 解放時に `#save-payout` のロック表示が外れない漏れを修正。賞金と局面で「保存なし」文言を統一。
  - 起動直後の RevenueCat `Purchases.configure()` 完了前呼び出しレースを防止し、購入・復元処理中はボタンを無効化。
  - RP の桁を上部カード・内訳とも小数 1 桁に統一し `-0.0%` を防止。相手未指定・手入力時に古い計算内訳が残らないように修正。
  - 公開サポートページ（`/support`）の 🎰 を ♠ に変更し、賞金保存・バウンティの FAQ を追記（Workers 反映済み）。

## 検証

- `npm run typecheck` 成功
- `npm test`: core 116件 / playground 379件 すべて成功（`dialogModal.test.ts`・`haptics.test.ts` を追加）
- `npm run build` 成功
- `cd playground && E2E_BROWSER_CHANNEL=chrome npm run e2e`: 20件すべて成功（`20-review-improvements.mjs` にアプリ内モーダル検証を含む全9シナリオを収録）
- iOS シミュレーター（Release 構成）:
  - **iPhone 17（iOS 26.5）**: 起動直後（0.3s）から暗色背景で白フラッシュなし、初回案内スキップ後の「サンプル」札削除、自分からオールイン時の追従カード・赤丸凡例・13×13 ハンド表、アプリ内ダークモーダル（保存・削除確認）を確認。
  - **iPad Pro 13-inch (M5)**: 起動直後（0.3s）から暗色背景・白ステータスバーで白フラッシュなし、2 カラムのハンド・賞金/BF（ICM/チョップ/BFマップ）・Nash 一覧を確認。
  - Xcode Release ビルドで `Splash.imageset` の warning 解消・自前コードの warning ゼロを確認。
- 未確認: 実機・iPad 実機・実際の購入と復元（RevenueCat）・実機での触覚（Taptic Engine）の体感。

## ストア文面（案）

更新説明（ja）:

```
・自分からオールインする場面でも、ハンド表のマスをタップして相手コール率や賞金期待値差を確認できるようになりました
・相手がショートスタックの BB のときにオールイン可能ハンドが正しく出ないことがある不具合や、均等賞金（サテライト等）での BF 表示を直しました
・アプリ起動直後に一瞬白い画面が見える現象を直し、局面・賞金の保存ダイアログもアプリ内のダーク表示に統一しました
・タップ時の軽い触覚フィードバックを追加し、バウンティ・Nash 一覧・狭い画面のレイアウトなど細かな不具合を直しました
```

更新説明（en-US）:

```
- You can now tap any hand cell when shoving first to inspect villain call rate, equity when called, and prize EV difference
- Fixed shove ranges sometimes showing 0% against a short BB, and improved BF display for equal-payout (satellite) structures
- Eliminated the brief white flash on launch and replaced system prompt/confirm alerts for saving spots and payouts with dark in-app modals
- Added subtle iOS haptic feedback and fixed minor bounty, Nash table, and compact-screen layout issues
```

審査メモ（1.5.2 の節を置き換える案）:

```
What is new in 1.5.3 (fixes and polish only; no new features or purchases):
- Tapping a hand cell now also shows hand details when you act first (shoving mode).
- Fixed edge-case calculations (shoving into a short big blind, negative blind/ante inputs, equal-payout satellite Bubble Factor display, and Nash table when a trailing seat has 0 chips).
- Fixed a brief white flash on launch, aligned native iOS dialogs/keyboards to dark mode, replaced browser prompt/confirm alerts for saving/deleting spots and payouts with in-app modals, and added subtle iOS haptic feedback.
- Fixed compact-screen layout on 9-player tables in English and added a guard against tapping purchase/restore before RevenueCat finishes configuring.
```

## 提出状況

- 未提出・未アーカイブ（2026-11-20 時点）。
- 1.5.2 が `WAITING_FOR_REVIEW`（`AFTER_APPROVAL`）で審査待ちのため、1.5.2 の公開後（または本人の指示後）に Archive → アップロード → ASC で 1.5.3 を作成して提出する。
