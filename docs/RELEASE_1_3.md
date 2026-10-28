# Poker ICM 1.3 リリース準備

## 2026-10-01: 現在のローカル版

- 最新の改善・検証は [UX_UPDATE_2026_10_01.md](UX_UPDATE_2026_10_01.md) を参照。単体321件、画面操作16件、型チェック・ビルド成功。
- 9月21日の指定により、プレイヤー欄は1.2の横並び入力へ戻した。案内カードとサマリーの賞金取り分は削除。その上で入力の短縮・役割交換・不正入力時の表示を改善した。
- この内容はアップロード済み1.3(1)には含まれない。以下の9月の説明は履歴であり、席移動・折りたたみ席編集・賞金取り分の説明をそのままストアへ使用しない。
- 今回はネイティブ同期・Archive・ストアの変更・提出・公開を実施していない。

### 現在の更新説明（日本語・下書き）

局面の入力と分析を、さらに使いやすくしました。

・プレイヤー入力をコンパクトに整理し、自分と相手を1タップで入れ替えられるようにしました
・入力や役割の変更を「元に戻す」で取り消せます
・人数変更後のポジションと、入力エラー時に以前の結果が残る問題を修正しました
・レンジ比較では自分の結果を先に表示し、相手の表や詳しい説明を開閉できるようにしました
・Nashは自動計算し、現在の局面を表示。画面内で役割を変えた場合も再計算します
・小型スマホの表示と、ハンド表のタップ・スクロールを改善しました

無料版・Proの利用範囲は従来どおりです。

### 現在のReview Notes（下書き）

Version 1.3 improves setup and analysis navigation. Free/Pro availability, the calculation model and the existing non-consumable purchase are unchanged. The app is an on-device poker tournament calculator and training tool. No account is required.

Setup: enter stacks in BB and select You and Opponent. Edit up to four players for free. Use the position selectors to configure positions and the cross buttons to remove players. Examples and saved spots are in the expandable section. “You ⇄ opponent” swaps roles without moving stacks. Undo restores one previous change during the session.

Analyze: “Ranges” uses an assumed opponent range and shows your result first. Custom mode opens the opponent grid. The separate Nash view calculates automatically, treating You as the shover and Opponent as the caller. Current conditions remain visible; role swaps recalculate. Warnings explain the two-player model and role/position assumptions.

Purchase: choose a six-player example, then tap a locked stack field to open the Pro paywall. Purchase and restore require an internet connection.

## 2026-09-10: ビルド1の後のローカル修正

- 入力欄へのフォーカスだけでは取り消し履歴を変更せず、値が変わったときだけ入力開始前の状態を記録する。連続入力は一操作として戻す。
- コール額/純利得の＋／−と「自動算出に戻す」に取り消しを追加。下限で数値が変わらないステッパー操作は履歴を上書きしない。
- 選択済みの自分/相手を再タップしても役割を解除しない。変更のないタップで取り消し履歴も上書きしない。
- これらはアップロード済み1.3(1)には未収録。審査前に新ビルドを作成・アップロードして差し替える必要がある。ビルド1を最終版として提出しない。

2026-09-09。1.2公開後のローカル改善をまとめる。審査提出・公開とは別の準備作業。

## 2026-09-09 11:41 JST 時点

- App Store Connectに1.3の下書きを作成。「提出準備中」。日本語更新説明とレビュー用メモを保存済み。手動リリース設定を維持。
- 1.3(1)のArchive・IPA書き出し・App Store Connectへのアップロード成功。Apple側の処理完了とバージョンへのビルド選択は未確認。
- 単体307件・画面操作15件・型チェック・ビルド・署名検証が成功。同梱Web資産は今回検証したdistと一致（Capacitor生成ファイル2件を除く）。日本語/英語のローカライズを確認。
- artifacts/release-1.3にArchive、export/App.ipa、ソーススナップショット、変更差分、IPA SHA-256を保存。
- screenshot-candidatesにiPhone6.9相当1320×2868とiPad13相当2064×2752を各6枚作成。ブラウザ描画の候補であり、ネイティブ実機のスクリーンショットではない。全12枚で横はみ出し・JavaScriptエラーなし。主要画面を目視確認したが、ストアへの差し替え・提出用確定は未実施。
- スクリーンショットは playground/e2e/capture-release.mjs に出力先を渡して再生成可能。画像中の文字を生成AIで描き直していない。
- 実機確認、スクリーンショット確定と差し替え、処理済みビルド選択、最終提出判断が残る。審査提出・公開は未実施。

## 対象

- バージョン1.3、ビルド1。通常の無料/Pro構成で作成する。完全解放版を使わない。
- 課金範囲・価格・年齢区分・計算モデル・保存キーは変更しない。
- 実機での購入復元・キーボード・保存移行・機内モード再起動は未確認。自動テストの成功と区別する。

## 更新説明（日本語・下書き）

局面の入力と分析を、さらに使いやすくしました。

・プレイヤーの通常表示をコンパクトにし、席順・BTN・削除の操作を必要なときだけ表示
・席を移動してもスタックと役割を保持し、BTNの指定に合わせてポジションを自動設定
・局面変更を一段だけ取り消せる「直前の操作を戻す」を追加
・Nash画面を開いたときに自動計算し、現在の局面と自分・相手の行動を表示
・分析の目的とプリセットの内容を、よりわかりやすい言葉に整理
・賞金の取り分とハンドの勝率の違いを説明
・コール額を最初に手入力した際、自動計算に上書きされる不具合を修正

無料版・Proの利用範囲は従来どおりです。

## Review Notes（追加用・下書き）

Version 1.3 improves setup and analysis navigation. Free/Pro availability is unchanged. The app is an on-device poker tournament calculator and training tool, not a playable gambling simulation or a wagering service. No account is required.

Setup: choose a scenario preset or edit up to four players for free. Tap the seat-edit button to change the button position, move or remove players. Undo restores one previous situation during the current session; it is not a persistent history.

Analyze: the range comparison uses an assumed opponent range. The separate Nash view calculates automatically and explicitly models You as the pusher and Opponent as the caller. Prize share is an ICM estimate, not hand win probability.

Purchase: choose a six-player preset in Setup, then tap a locked stack field to open the Pro paywall. Pro is the existing non-consumable purchase. Purchase and restore require an internet connection.

## 実機確認（未実施）

- 1.2を削除せず上書きし、局面・練習履歴・設定が引き継がれる。
- 購入済みアカウントでPro復元を確認。新規の実課金は行わない。
- iPhoneでキーボードを出し、スタック・賞金・コール額を入力できる。
- 席移動・削除・プリセット変更の取り消しを確認する。
- 機内モードで再起動し、計算とNash表示が動く。
- 日本語/英語、小型iPhone/iPadで文字・表・ボタンが欠けない。

## 提出前

- 新ビルドをApp Store Connectで処理完了後に選択。
- 更新したスクリーンショットを目視確認して設定。
- 更新説明とレビュー用メモを保存。
- 実機確認の未完了を明示した上で、提出の判断をユーザーと行う。
