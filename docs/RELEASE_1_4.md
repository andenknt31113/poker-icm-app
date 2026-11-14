# Poker ICM 1.4 リリース準備

## 2026-11-14: ビルド1（Web 版 9bc0396 と同じ内容）

- 収録内容は 2026-11-13〜14 の作業ぜんぶ（HANDOFF.md 参照）。入力と結果の1画面化、必要勝率の厳密 ICM 化、全員ぶんの Nash 一覧表、後ろに複数人残る局面と3人同時オールイン、相手レンジへの Nash 取り込み、チョップ表、用語説明と「計算の前提と限界」。練習モードは非表示（機能は残っている）。
- 同梱した Web 資産は main の 9bc0396 でビルドしたもの（フッターの表記も build 9bc0396）。
- **Xcode 27.2（iOS 27 SDK）でビルドすると、起動直後に落ちる問題があった。** 原因は UIScene ライフサイクル未対応（`UIScene life cycle is required for apps built with this SDK`）。公開中の 1.3 は旧 SDK でビルドしたものなので影響しない。対応として Capacitor を 8.3.4 → 8.6.2（`@capacitor/app` は 8.1.0 → 8.1.2）に上げ、公式テンプレートどおり `SceneDelegate.swift` の追加・`AppDelegate.swift` の差し替え・`Info.plist` への `UIApplicationSceneManifest` 追加を行った。
- シミュレーター（iPhone 17 / iOS 27.2、Release 構成）で起動と初回案内の表示を確認。確認用のコピーに自動操作を仕込み、Nash の一覧表が出ること、オーバーコールの行（3人の勝率表の読み込み）が出ることを確認した。タップ操作での確認（Pro の購入画面など）と実機での確認はしていない。

## 更新説明（日本語・下書き）

```
画面と計算を大きく見直しました。

・入力と結果を1つの画面にまとめました。局面を入れると、必要勝率・リスクプレミアム・Bubble Factor がその場で出ます
・必要勝率を厳密な ICM 計算に変更しました（これまでは近似で、局面によっては数ポイントずれていました）
・Nash を全員ぶんの一覧表にしました。誰が押すか・誰がコールするかごとのレンジが並び、行をタップすると 13×13 の表が開きます
・後ろに複数人が残っている局面と、3人が同時にオールインする局面（オーバーコール）に対応しました
・相手レンジに「この局面の Nash」を入れられるようにしました
・ICM チョップ（ディール）の配分表を追加しました
・用語の説明を書き直し、「計算の前提と限界」を追加しました
・練習モードは見直しのため、このバージョンでは表示していません

無料版・Proの利用範囲は従来どおりです。
```

## プロモーションテキスト（下書き）

```
オールインされた時のコール判断と、ショートスタックのプッシュ判断を厳密ICMで計算。全員ぶんのNashレンジを一覧で確認できます。2BBオープンやリンプは扱わず、オールインの判断に絞ったアプリです。計算はオフラインで動作。実際の金銭を賭けるものではありません。
```

## キーワード（下書き）

```
ポーカー,ICM,トーナメント,バブルファクター,ナッシュ,プッシュフォールド,テキサスホールデム,poker,チョップ,計算機
```

## 説明文（日本語・下書き）

```
「バブルでこのオールイン、コールしていい？」— その疑問に、その場で数字で答えるアプリです。

Poker ICM は、ポーカートーナメントの ICM(Independent Chip Model)と Bubble Factor(BF)を計算し、オールインが絡む call/fold・push/fold の判断を数字で確かめるツールです。日本語で使える本格的な ICM 計算アプリを目指して作りました。

【できること】
■ 必要勝率 (ICM 込み / チップだけ / Risk Premium)
全員のスタックと賞金を入れて、自分と相手を選ぶだけ。コールに必要な勝率を、勝った場合・負けた場合・降りた場合の賞金期待値から厳密に計算します。「チップだけなら45%でいいのに、ICM 込みだと58%必要」のような ICM の重さを数字で確認できます。

■ ICM 計算と Bubble Factor マップ
各プレイヤーの賞金期待値を Malmuth-Harville 方式で計算。「誰に対してタイトに、誰に対してルースに打つべきか」を全員×全員のヒートマップで一望できます。

■ ハンドレンジ比較
相手のプッシュレンジを想定すると、自分がコールできるハンドが13×13グリッドで色分け表示。席順に合わせて「相手のオールインを受ける」「自分からオールイン」を自動で切り替えます。相手のレンジには、その局面の Nash をそのまま入れることもできます。

■ Nash 均衡 (プッシュ/フォールド)
「オールインか降りるか」の2択に絞ったときの Nash 均衡レンジを、ICM を反映して全員ぶん計算します。誰が最初に押すかごとに、押すレンジと後ろの全員のコールレンジを一覧で表示。コールが入ったあとにもう1人がコールする場合（3人同時オールイン）のレンジも出します。行をタップすると13×13の表が開きます。

■ ICM チョップ（ディール）
残った全員の ICM に基づく配分を表で表示。丸める刻みも選べます。

【こんな方に】
・店舗トーナメントやアマチュア大会で、バブル前後の判断に自信が持てない方
・海外製のICMツールは英語表記で難しく感じ、続かなかった方
・「感覚」ではなく「計算」でICM判断を裏付けたい方
・ICMやBubble Factorという言葉を耳にしたことはあるが、仕組みをきちんと理解したい方

【オフライン設計・プライバシー】
本アプリの計算処理はすべて端末内で完結し、入力したスタックやペイアウトが外部サーバーへ送信されることはありません。アカウント登録も不要で、ダウンロード後すぐに使い始められます。通信環境がない移動中でも、機内モードでも計算機能はすべてご利用いただけます(Pro の購入・復元時のみ通信が必要です)。

【無料版と Pro（買い切り）】
無料版では、実戦を模した8種の例題で全計算機能(ICM・Bubble Factor マップ・必要勝率・レンジ比較・Nash 均衡・チョップ)をご利用いただけるほか、4人までのテーブル(ヘッズアップ〜FTバブルの4人卓)ならスタックやペイアウトを自由に入力できます。5人以上のフルテーブルの再現とシナリオ保存は、買い切りの Pro(一度の購入で永続利用・サブスクではありません)として提供しています。

【対応している場面・していない場面】
このアプリが計算するのは「オールイン」が絡む判断です。
・相手のオールインにコールするか降りるか（スタックの深さに関係なく使えます）
・ショートスタック（目安：実効12BB以下）で、自分からオールインするか降りるか
・3人が同時にオールインする局面まで

次の判断は計算しません。
・2BBオープン、リンプ、3ベットなど、オールイン以外のアクション
・4人以上が同時にオールインする局面
・フロップ以降のプレイ

実効20BBを超える深さでは、押すか降りるかの2択で考える前提が実戦と合わなくなるため、Nash の結果は参考値として注意を添えて表示します。計算の前提と限界はアプリ内の「計算の前提と限界」にまとめています。

【練習モードについて】
以前のバージョンにあった練習モード（クイズ）は、内容を見直すため、このバージョンでは表示していません。

【ご注意】
本アプリは実際の金銭を賭けるギャンブルではありません。ポーカートーナメントにおける意思決定を学習・シミュレーションするための計算ツールです。表示される計算結果や判定は参考情報であり、その正確性・完全性を保証するものではありません。実戦での最終判断は、利用者ご自身の責任において行ってください。
```

## Review Notes（下書き。前半の Gambling 申告・Free/Pro の段落は 1.3 のまま残す）

```
Version 1.4 redesigns the main screen and extends the calculations. Free/Pro availability and the existing non-consumable purchase are unchanged. The quiz ("Practice") tab from earlier versions is not shown in this version.

Main screen: setup and results are now on one screen. Enter stacks in big blinds, pick a position for each seat, and mark You and Opponent (examples are under the expandable examples section). The required equity, risk premium and bubble factor appear in the result card. Edit up to four players for free.

Nash: the Nash view lists, for each possible first shover, the shoving range and every caller's range, including a second caller (three-way all-in). Tap a row to open its 13x13 chart. Larger tables take several seconds to compute; rows appear seat by seat.

Purchase: choose the "6 left · all paid" example (6人残り・全員入賞 in Japanese), then tap a locked stack field to open the Pro paywall. Purchase and restore require an internet connection. No account is required.
```

## スクリーンショット

- 現在のストアのスクショ（iPhone 6枚 / iPad 5枚）は 1.3 の旧画面。練習モードの画面を含むので、1.4 では新画面で撮り直して差し替える。
