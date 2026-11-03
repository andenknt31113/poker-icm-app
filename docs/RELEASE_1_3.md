# Poker ICM 1.3 リリース準備

## 2026-10-29: ビルド2（計算の修正・見せ方の整理）

- 10-01 版の改善に加え、レンジ勝率の重み修正・実ポジションの blind・深さの見せ方・席順での向きの自動選択・% のコンボ基準統一・文字量の整理・小さめのUI修正を収録（詳細は HANDOFF.md の 2026-10-28〜29）。
- アップロード済み 1.3(1) には含まれない。審査には 1.3(2) を使う。ビルド1を提出しない。
- ストア説明・スクショ文言の差し替え案は [STORE_SCOPE_2026-10-29.md](STORE_SCOPE_2026-10-29.md)。
- 例題（すべて自分=BB）では Nash が「相手：プッシュ・自分：コール」で表示される。旧スクショの Nash 画面（自分がプッシュ）は使わない。
- Xcode を 1.3(2) に変更。cap sync 後、`artifacts/release-1.3/PokerICM-1.3-build2.xcarchive` を作成（ARCHIVE SUCCEEDED、Info.plist 1.3/2、codesign 検証成功、同梱 public と playground/dist が一致）。ログは `archive-build2.log`。
- 最初の IPA 書き出しは Xcode に Apple ID が未ログインのため失敗（`No Accounts` / `No signing certificate "iOS Distribution"`）。本人のログイン後に解消（下記）。
- コミット ce4e405 の状態で cap sync と Archive を作り直し済み（フッターのビルド表記 ce4e405、Info.plist 1.3/2、codesign 検証成功、同梱 public は dist と一致。差分は Capacitor 生成の cordova.js / cordova_plugins.js のみ）。
- 2026-10-29 20:38 JST: Xcode のログインを確認し、ce4e405 の Archive から IPA を書き出し（`artifacts/release-1.3/export-build2/App.ipa`、1.3/2、Apple Distribution 署名、codesign 検証成功、同梱 public は dist と一致、SHA-256 は ipa-sha256.txt）。設定は `opts-build2/`（manageAppVersionAndBuildNumber=false でビルド番号を 2 のまま維持）。
- 2026-10-29 20:40 JST: App Store Connect へアップロード成功（`Upload succeeded` / `Uploaded package is processing`、ログ `upload-build2.log`）。Apple 側の処理完了・1.3 へのビルド選択は未確認（アプリ内ブラウザは ASC 未ログイン）。審査提出はしていない。
- 2026-11-01: ユーザー指示で App Store Connect API から 1.3 の下書きを更新（審査提出はしていない）。1.3 にビルド2を選択（処理済み VALID、暗号化の申告は Info.plist で false）。日本語の更新説明を下の下書き＋「Bubble Factor マップの色分けを見分けやすくしました」に差し替え。説明文は STORE_SCOPE の差し替え（Nash 節をショートスタック・実効12BB以下の説明に、練習を「ショートスタックのプッシュ判断」に、レンジ比較に席順での自動切替を追記）と【対応している場面・していない場面】節を追加。Review Notes は前半（Gambling の申告理由・Free/Pro）を残し、1.3 の部分を下の下書きに差し替え。読み直して3項目とも一致を確認。変更前の内容は `artifacts/release-1.3/asc-backup-2026-11-01.json`、反映した文面は `asc-new-2026-11-01.json`。キーワード・プロモーションテキスト・スクショは変更していない（スクショは旧 iPhone 4枚 / iPad 5枚のまま）。
- 2026-11-01: ユーザー指示で 1.3 のスクショを API で差し替え。候補のフッターが build c3bdb87 だったため、ce4e405 の dist で撮り直した `artifacts/release-1.3/screenshot-final-2026-11-01` を使用。iPhone 6.9（APP_IPHONE_67、1320×2868）は 分析→Nash→賞金・BF→練習→プレイヤー→ペイ の6枚、iPad 13（APP_IPAD_PRO_3GEN_129、2064×2752）は同じ順で重複していた 02 を除く5枚。全枚 COMPLETE、旧スクショ（iPhone 4枚・iPad 5枚）は削除。公開中 1.2 のスクショは変わっていないことを確認。旧スクショの控えは `artifacts/release-1.3/asc-screenshots-backup-2026-11-01/`。
- 2026-11-03 13:07 JST: ユーザー指示（審査提出まで全部）で提出。事前に API で必須項目（ビルド2 VALID・暗号化 false・著作権・審査連絡先・年齢区分・説明文/更新説明/スクショ）を確認。ce4e405 を Release 構成でシミュレーター（iPhone 17）にビルドして起動し、初回案内・セットアップ・分析・Nash・練習の答え合わせまで動作を確認（起動直後に1〜2秒白画面、その後表示）。プロモーションテキストを STORE_SCOPE 案（「完全オフライン」を「計算と練習はオフラインで動作」に変更）で設定。reviewSubmission d0e4d6d1-dfc5-4e59-a85b-77c1dc3e73bb で提出し、1.3 は WAITING_FOR_REVIEW。リリースは手動のまま（承認後に公開操作が必要）。実機での確認は未実施。
- スクショ候補（ブラウザ描画）: `artifacts/release-1.3/screenshot-candidates-2026-10-29/{iphone-6.9,ipad-13}/01〜06.png`。iPad の 01 と 02 は同じ画面。実機画像ではない。

### 更新説明（日本語・下書き）

計算の正確さと、画面のわかりやすさを改善しました。

・相手レンジ（上位X%）に対する勝率の計算を修正しました
・Nash と「自分からオールイン」で、実際のポジションどおりにブラインドを払う計算にしました（BTN からのプッシュ範囲が広く出ていた問題を修正）
・スタックが深いときは注意を表示し、実効20BBを超える自分からのプッシュは参考表示にしました
・席順から「相手のオールインを受ける」「自分からオールイン」を自動で選ぶようにしました
・レンジの % をカードの組合せ基準にそろえました
・Nash と練習の答え合わせを見やすく整理しました
・プレイヤー入力の整理、自分と相手の入れ替え、元に戻す機能を追加しました

無料版・Proの利用範囲は従来どおりです。

### Review Notes（下書き）

Version 1.3 improves calculation accuracy and the analysis screens. Free/Pro availability and the existing non-consumable purchase are unchanged. The app is an on-device poker tournament calculator and training tool, not a gambling service. No account is required.

Setup: enter stacks in big blinds and select You and Opponent (examples are in the expandable section). Edit up to four players for free. Because stacks are in big blinds, BB is fixed at 1; enter the table ante total if needed.

Analyze: "Ranges" compares your hands against an assumed opponent range. Whether you call an all-in or shove first follows the seat order (the earlier position shoves). The Nash view follows the same rule and calculates automatically. Deep stacks show a caution, and shoves deeper than 20BB effective are collapsed as a reference only.

Purchase: choose a six-player example, then tap a locked stack field to open the Pro paywall. Purchase and restore require an internet connection.

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
