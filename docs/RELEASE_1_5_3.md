# 1.5.3 (build 3)

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
- **Pro 保存・削除のブラウザ標準ダイアログをアプリ内ダークモーダルへ置換**: `window.prompt` / `window.confirm` を使っていた4箇所（局面保存・局面削除・賞金保存・練習履歴リセット）を `dialogModal.ts` に統一し、保存済み賞金の削除にも誤タップ防止の確認モーダルを追加。空欄時の保存ボタン無効化、破壊的操作の誤爆防止フォーカス、Escape・背景タップ対応、HTML エスケープを実装。
- **iOS 触覚フィードバック（`@capacitor/haptics`）を導入**: 同梱済みで未使用だったプラグインを `haptics.ts`（`isCapacitorNative()` ガード付き）から活用し、タブ切替・ハンド表セルタップ・レンジ目安・役割切替・コール額ステッパー・自動算出復帰・Undo・保存完了・購入/復元成功時に軽い触覚を追加。
- **ペイウォールに「買い切り・月額課金なし」を明記**: `paywall.ts` / 日英辞書に買い切り注記（`.paywall-one-time`）を追加し、サブスクとの違いが一目で伝わるようにした。
- **チョップを独立タブ化・1タップ結果コピー・自分の手札クイック判定を追加**:
  - 分析切替を `ハンド` / `チョップ` / `賞金・BF` / `Nash`（EN: `Hands` / `Chop` / `ICM · BF` / `Nash`）の 4 タブへ整理し、チョップ表へ 1 タップで到達できるようにした（チョップ表示中は上部サマリーを隠して視認性を改善）。
  - チョップ表に「結果をコピー」ボタン（`formatChopShareText`）を追加し、LINE やメモへそのまま貼れるようにした。チョップ結果のコピーもアプリ内評価依頼の完了回数に含めるよう拡張（`reviewPrompt.ts`）。
  - ハンド表の直上に「自分の手札」クイック選択（2 枚のランク + `s`/`o`）を追加し、13×13 の表から探さずに 1 発でコール/フォールド判定を出せるようにした（グリッドのセルタップとも双方向同期）。
  - ヘッダー右上のヘルプボタンを赤絵文字 `❓` から落ち着いた `?` に統一。
- **BB / チップ単位切替を追加 (`stackUnit.ts`)**: 局面ヘッダーに `BB` / `チップ` 切替を追加。チップモードでは `1 BB` 額（`1k` / `5k` / `10k` / `20k` プリセット＋任意入力）を指定し、ライブトナメの実チップ数のまま入力・ICM / チョップ表示・コピーができるようにした（内部計算は BB 換算で統一し、Undo・永続化にも対応）。
- **未使用のテンプレート画像を整理**: `Splash.imageset` に残っていた未参照の PNG 3枚を削除し、Xcode の asset warning 5件を解消。
- **自分からオールイン（`pushBack`）時の使い勝手と表示を統一**:
  - ハンド表のセルタップで相手コール率・コール時勝率・賞金期待値差・判定を確認できるようにした（向き切替時は選択解除）。
  - 凡例の記号色を実際の赤（🟥）に修正。
  - Hand タブ下部ボタン・入力ラベル（「追加で出す額」）・20BB 超の深さ警告をオールイン向きの表現に統一。
- **バウンティ関連の表示・Undo 改善**:
  - BF < 1.0 の有利セルを緑寄りグラデーション、負 RP を緑トーンに。ICM 表・チョップにバウンティ別の注記を追加。
  - バウンティ一括適用（`#bounty-all`）入力中の重複 Undo チェックポイントを解消し、無料ユーザーに過去の KO/PKO 設定が残っていても「なし」が選択表示されるようにした。
  - 日本語 UI のバウンティ説明・チョップ注記・使い方ガイドで「首」としていた表記をすべて「バウンティ」に統一。
- **細かな画面・課金ガード**:
  - 375px 英語・無料・9人卓で `None` ボタンが右端で切れていたのを、🔒 をスタック入力欄内に重ねるレイアウトで解消。
  - 初回案内を閉じた直後に「サンプル」札を即削除。各モーダルに `role="dialog" aria-modal="true"` を付与。
  - Pro 解放時に `#save-payout` のロック表示が外れない漏れを修正。賞金と局面で「保存なし」文言を統一。
  - 起動直後の RevenueCat `Purchases.configure()` 完了前呼び出しレースを防止し、購入・復元処理中はボタンを無効化。
  - RP の桁を上部カード・内訳とも小数 1 桁に統一し `-0.0%` を防止。相手未指定・手入力時に古い計算内訳が残らないように修正。
  - 公開サポートページ（`/support`）・利用規約ページ（`/legal`）・案内ページ（`/`）の配色をアプリのダークエメラルドテーマ（`#101715` / `#a8e6bd`）へ統一し、`/support` の FAQ に `BB / チップ` 単位切替・チョップ共有コピー・賞金保存・バウンティを追記。
  - チョップ結果コピーの WKWebView フォールバックで `setSelectionRange` / 16px フォント指定を追加し、ストアスクショ自動撮影（`capture-release.mjs`）に 2 枚目用の `07-bounty.png` を組み込んだ。
  - 深掘りバグ監査の 8 件を追加修正（build 2）：残り人数より賞金順位が多い卓での ICM 取り分 % 分母統一、全員スタック 0 時の多言語エラー化＆BF マップ/警告/Nash 残骸クリア、iPhone での `1 BB` 入力・手札セレクト自動ズーム防止（`font-size: 16px` 統一）＆`theme-color` 統一、iOS WKWebView での `1 BB` フォーカス中プリセット／Undo 表示同期、BB ≦ アンティ時の Nash 空白画面解消、バウンティ形式切替時の古い Nash 案内消去、`#bf-result` / `nashUI` の生小数丸め、破損ブラインド保存値のサニタイズ。
  - 計算コア＆多言語初回起動の残存バグ 5 件を追加修正（build 3）：英語端末での初回起動自動英語化（`i18n.ts`）、第三者ショート SB/BB のポット上限クランプで架空チップ混入と RP 水増しを解消（`potOdds.ts` / `calculator.ts`）、ブラインド時点で自動オールイン済みの BB/SB を Nash コール・オーバーコールとも強制 100% 参加に修正（`multiwayNash.ts` / `overcallNash.ts`）＆ `solveHUNash` の 0 スタック＋アンティ負数防止（`nash.ts`）、`pushBack` ボーダー帯を総賞金比 ±0.03pt の対称基準へ整理（`handRange.ts`）、必要勝率入力欄に `(BB)` 表記追加＆カスタムレンジ空時の空見出し非表示。
  - 追加総点検で見つかったコア・UI バグ 7 件を同 build 3 に統合修正：小数・チップモードでの自動算出 `cEV` / `RP` に `.toFixed(1)` 丸め誤差が混ざる問題と `0.05BB` 未満コールの `"0.0"` 誤エラー化を解消（`calculator.ts`）、2 人卓ポジション未設定時の架空第3者ブラインド計上を解消（`calculator.ts`）、0% Nash レンジ適用時にカスタムタブ切替のプリセット補完で無言上書きされる不具合を解消（`handRange.ts`）、既にオールイン済み／ブラインド未満プッシュに対する `pushBack`・HU/多人数/オーバーコール Nash での不要なフォールド率を 100% コール固定へ統一（`handRange.ts` / `nash.ts` / `multiwayNash.ts` / `overcallNash.ts`）、相手スタックが既出ブラインド未満のとき `calculateExactCallEquity` が負の必要勝率を返す不具合を修正（`callDecision.ts`）、BB=0 脱落席が `foldWinnerIndex` で復活する不具合（`multiwaySpot.ts`）と既 0 チップ席が今回飛んだ席と 2 位・3 位賞金を折半してしまう不具合を `equitiesWithBounty` の開始スタック順脱落判定（`bounty.ts` / `bf.ts` / `callDecision.ts` / `pushDecision.ts` / `nash.ts` / `multiwayNash.ts` / `handRange.ts`）で一括解消。

## 検証

- `npm -w @poker-icm/core run build` & `npm run typecheck` 成功
- `npm test`: core 124件 / playground 393件 すべて成功
- `npm run build` 成功
- `cd playground && E2E_BROWSER_CHANNEL=chrome npm run e2e`: 20件すべて成功
- ストア用スクリーンショット（`artifacts/release-1.5.3/screenshots/{ja,en}`）: `01-spot`〜`07-bounty` の 7 枚 × 2 デバイス × 2 言語 = 28 枚を横はみ出し・JS エラーゼロで生成＆目視確認。
- iOS シミュレーター（Release 構成）:
  - **iPhone 17（iOS 26.5）**・**iPad Pro 13-inch (M5)**: 起動直後（0.3s）から暗色背景・白ステータスバーで白フラッシュなし、新 UX（4 タブ・`?` ボタン・手札クイック判定・独立チョップタブ＋コピー・BB/チップ切替・ダークモーダル）を目視確認。Xcode Release ビルドの自前コード・asset warning ゼロ。
- 未確認: 実機・iPad 実機・実際の購入と復元（RevenueCat）・実機での触覚（Taptic Engine）の体感。

## ストア文面（案）

更新説明（ja）:

```
・チョップ（ディール）を独立タブにし、結果をそのままコピーして共有できるボタンを追加しました
・ハンド表の上で「自分の手札」を直接選んで、コール／フォールドの判定と勝率をすぐ確認できるようになりました
・ライブトナメ向け「BB / チップ」単位切替を追加し、実チップ数のまま入力・ICM／チョップ計算ができるようになりました
・自分からオールインする場面でのセルタップ検分、ショート BB やサテライト BF の計算修正、起動時の白フラッシュ解消・ダークモーダル統一・軽い触覚フィードバックなど細かな使い勝手を改善しました
```

更新説明（en-US）:

```
- Moved ICM Chop to its own top-level tab and added a one-tap Copy button to share deal splits
- Added a quick "Your hand" picker above the 13x13 chart to check call/fold verdicts and equity immediately
- Added a "BB / Chips" unit toggle with 1 BB presets so you can enter live chip counts directly for ICM, Nash, and chops
- Added cell inspection when shoving first, eliminated the launch white flash, unified dark in-app modals, added subtle haptics, and fixed short-BB / satellite BF edge cases
```

審査メモ（1.5.2 の節を置き換える案）:

```
What is new in 1.5.3 (UX polish and bug fixes; no changes to purchases or calculation model):
- Promoted ICM Chop to its own analysis tab with a one-tap copy button for deal splits.
- Added a quick "Your hand" selector above the 13x13 hand chart (synced with cell tap inspection) and a "BB / Chips" input unit toggle for live tournaments.
- Tapping a hand cell now also shows hand details when you act first (shoving mode).
- Fixed edge-case calculations (shoving into a short big blind, negative blind/ante inputs, equal-payout satellite Bubble Factor display, and Nash table when a trailing seat has 0 chips).
- Fixed a brief white flash on launch, aligned native iOS dialogs/keyboards to dark mode, replaced browser prompt/confirm alerts with dark in-app modals, clarified one-time purchase on the paywall, and added subtle iOS haptic feedback.
```

## 提出状況

- 2026-11-21 17:17 JST に **`1.5.2` が審査承認・日米 App Store 公開（`READY_FOR_SALE`）** となった。
- 2026-11-22 15:02 JST に `1.5.3 (build 2)` を提出済み（`WAITING_FOR_REVIEW`）。さらに計算コア＆英語端末初回起動の 5 件修正を入れた **`1.5.3 (build 3)`** へ差し替えて再提出予定。
