<!--
  このファイルは App Store 提出用リスティング素材の下書きです。文言・数値は
  実際の申請内容やストアガイドラインの変更に合わせて見直してください。
  法的助言ではありません。価格・年齢制限などは最終的に App Store Connect上の
  実データで確認・確定してください。

  対象アプリ: Poker ICM (appId: dev.workers.andenknt31113.pokericm)
  文字数はすべて Python の len()（Unicode コードポイント単位）で実測済みです。
  App Store Connect の入力欄は絵文字を推奨していないため、タイトル/サブタイトル/
  キーワード/プロモーションテキストには絵文字を使用していません。
-->

# App Store リスティング素材（下書き）

対象アプリ: **Poker ICM**（appId: `dev.workers.andenknt31113.pokericm`）
Web版: https://poker-icm-app.andenknt31113.workers.dev/（無料・継続提供）

---

## 1. アプリ名案・サブタイトル案

App Store の「名称」は30文字以内、「サブタイトル」も30文字以内。文字数は実測値（Unicodeコードポイント数）。

### アプリ名（日本語・30字以内）

| # | 案 | 文字数 |
|---|---|---|
| 1 | Poker ICM — バブルを制する練習帳 | 22 |
| 2 | Poker ICM：ICM/BF計算トレーナー | 23 |
| 3 | Poker ICM — 判断力を鍛える練習帳 | 22 |

推奨: **案1**。ブランド名 "Poker ICM" を保ちつつ、検索されやすい「バブル」「練習」を含む。

### サブタイトル（日本語・30字以内）

| # | 案 | 文字数 |
|---|---|---|
| 1 | ICM/BFを計算・練習 完全オフライン | 20 |
| 2 | call/foldをICMで判定する練習 | 20 |
| 3 | 厳密ICM判定で鍛えるpush/fold感覚 | 22 |

推奨: **案1**。「計算」「練習」「オフライン」という差別化ワードを最短で伝える。

### アプリ名（英語・30字以内）

| # | 案 | 文字数 |
|---|---|---|
| 1 | Poker ICM — ICM/BF Trainer | 26 |
| 2 | Poker ICM: Bubble Trainer | 25 |
| 3 | Poker ICM — Call/Fold Drills | 28 |

推奨: **案1**。

### サブタイトル（英語・30字以内）

| # | 案 | 文字数 |
|---|---|---|
| 1 | Practice ICM calls, offline | 27 |
| 2 | ICM & Bubble Factor trainer | 27 |
| 3 | Train push/fold with exact ICM | 30 |

推奨: **案1**。

---

## 2. 説明文（Description）

冒頭3行だけでストアの一覧・検索結果に表示されるため、価値提案を最初の3行に凝縮している。誇大表現（「必ず勝てる」「絶対に読まれない」等）は使用せず、実マネーギャンブルを連想させる表現（「賭ける」「稼げる」「儲かる」等）も避けた。

### 日本語（約1,900字）

```
バブル前後のオールイン判断、「なんとなく」で終わらせていませんか。

Poker ICMは、トーナメントポーカーのICM（賞金期待値）とBubble Factorを厳密に計算し、call/foldの判断力を反復練習で鍛える学習アプリです。日本語・英語に対応し、完全オフラインで動作します。

【このアプリでできること】

■ 厳密ICM判定による3つの練習モード
・Call decision（コール判定）: 相手のオールインに対してcall/foldを判断
・Push decision（プッシュ判定）: 自分がオールインすべきかを判断
・Guess the RP（RP当て）: その局面のRisk Premium（必要勝率の上乗せ分）を数値で当てる

多くのICMツールはBubble Factorによる近似だけで必要勝率を出しますが、本アプリは「フォールドした場合」「コールして勝った場合」「コールして負けた場合」の3つの最終スタックそれぞれについてICMを計算し直す方式を採用しています。近似との違いも画面上で比較でき、判定の根拠となる計算式もすべて確認できます。

■ 導入コース（5問）
ICMがなぜ重要なのかを、バブルの罠やサテライトの掟など5つの典型パターンを通じて体感できる短いコースを用意しました。初めての方でも数分でICMプレッシャーの正体を理解できます。

■ 全員vs全員 Bubble Factorヒートマップ
複数プレイヤーが絡む状況では、誰との組み合わせが特に危険なのか一目では分かりません。全プレイヤー同士のBubble Factorをヒートマップで一覧できる機能で、テーブル全体のプレッシャー構造を俯瞰できます。

■ Nash均衡計算
ヘッズアップのpush/foldにおけるNash均衡レンジ（ICM反映済み）を計算し、自分の判断とレンジを比較できます。ポジション関係の警告表示にも対応しています。

■ ハンドレンジ比較
相手の想定レンジと自分のコール/プッシュ可能ハンドを、Top X%のプリセットまたはカスタム編集で見比べられます。

■ 成績の推移・復習リスト
練習の正解率がモード別・難易度別に推移として記録され、得意・苦手を把握できます。間違えた問題は自動で復習リストに蓄積されるので、解きっぱなしにせず繰り返し解き直せます。

■ シナリオプリセット
FTバブルやサテライトなど、よくある状況をワンタップで再現できるプリセットを収録。作った状況は自分のシナリオとして端末内に保存できます。

■ 用語解説つきガイド
ICM・Bubble Factor・Risk Premium・Nash均衡といった専門用語は、アプリ内のヘルプからいつでも図解付きで確認できます。用語を覚えながら実践できるので、初めてICMに触れる方でも置いていかれません。

【画面構成】
1. セットアップ — プレイヤー・スタック・ペイアウトを入力（プリセットも利用可）
2. 計算結果 — ICMエクイティ・BFマップ・必要勝率（cEV / $EV / RP）
3. ハンド比較 — 相手レンジと自分のコール/プッシュ可能ハンドの比較
4. Nash均衡 — ヘッズアップpush/foldの最適解
5. 練習 — 3モードのクイズ・導入コース・復習リスト・成績の推移

シンプルな5タブ構成なので、迷わず行き来しながら使えます。

【こんな方におすすめ】
・店舗トーナメントやアマチュア大会でバブル前後の判断にいつも迷ってしまう方
・海外製のICMツールは英語表記で難しく感じ、続かなかった方
・「感覚」ではなく「計算」でICM判断を裏付けたい方
・移動時間やスキマ時間に判断力トレーニングをしたい方
・ICMやBubble Factorという言葉を耳にしたことはあるが、仕組みをきちんと理解したい方

【オフライン設計・プライバシー】
本アプリの計算処理はすべて端末内で完結し、入力したスタックやペイアウト、練習の成績・復習履歴が外部サーバーへ送信されることはありません。アカウント登録も不要で、ダウンロード後すぐに使い始められます。通信環境がない移動中でも、機内モードでも計算・練習機能はすべてご利用いただけます（Pro の購入・復元時のみ通信が必要です）。

【無料版と Pro（買い切り）】
無料版では、実戦を模した8種のシナリオプリセットで全計算機能（ICM・Bubble Factor マップ・必要勝率・レンジ比較・Nash 均衡・練習モード）をご利用いただけます。自分のテーブルを自由に再現したい方向けに、スタック・人数・ペイアウト構造の編集とシナリオ保存を、買い切りの Pro（一度の購入で永続利用・サブスクではありません）として提供しています。

【ご注意】
本アプリは実際の金銭を賭けるギャンブルではありません。ポーカートーナメントにおける意思決定を学習・シミュレーションするための計算・練習ツールです。表示される計算結果や判定は参考情報であり、その正確性・完全性を保証するものではありません。実戦での最終判断は、利用者ご自身の責任において行ってください。
```

### 英語（約3,100字）

```
Still deciding bubble-stage all-ins by feel?

Poker ICM computes exact ICM (tournament prize equity) and Bubble Factor, then drills your call/fold instincts through focused repetition. It's available in Japanese and English, and it runs fully offline.

WHAT YOU GET

Three exact-ICM practice modes
- Call decision: judge call vs. fold against a villain's shove
- Push decision: judge whether you should shove
- Guess the RP: estimate a spot's Risk Premium (the extra equity ICM demands beyond chip EV)

None of these lean on a Bubble Factor approximation alone — each terminal outcome (fold / call-and-win / call-and-lose) recomputes ICM from scratch, and the full math behind every verdict is shown on screen.

5-hand intro course
Five short scenarios — including the bubble trap and the satellite rule — let you feel why ICM pressure matters, so newcomers can grasp the core idea in just a few minutes.

Everyone-vs-everyone Bubble Factor heatmap
See at a glance which matchups at the table carry the most ICM pressure, across every player pair, not just yours.

Nash equilibrium solver
Compute the heads-up push/fold Nash equilibrium (ICM included) and compare it against your own read.

Hand range comparison
Compare a villain's assumed range against your callable or shoveable hands, using Top X% presets or custom range editing.

Progress tracking & review list
Your accuracy over time is tracked so you can see your strengths and weaknesses. Missed hands are collected automatically into a review list you can redo later.

Scenario presets
Recreate common spots — final-table bubble, satellites, and more — with one tap, and save any scenario you build to your device.

Built-in glossary
ICM, Bubble Factor, Risk Premium, and Nash equilibrium are all explained with diagrams in the in-app help, whenever you need a refresher.

HOW IT'S LAID OUT
1. Setup — enter players, stacks, and payouts (presets available)
2. Results — ICM equity, BF map, required equity (cEV / $EV / RP)
3. Hand ranges — compare the villain's range with your callable/shoveable hands
4. Nash — the optimal heads-up push/fold solution
5. Practice — three quiz modes, the intro course, review list, and progress trend

A simple five-tab layout keeps everything within reach.

WHO IT'S FOR
- Live and online tournament players who've second-guessed a bubble-stage call
- Anyone who found existing ICM tools hard to use because they're English-only
- Players who want their ICM reads backed by exact math rather than feel
- Anyone looking for a quick, focused decision-making drill

FULLY OFFLINE & PRIVATE
All calculations run entirely on your device — nothing is sent to a server. Your stacks, payouts, and practice history are stored locally only. No account is required; open the app and start right away.

PLEASE NOTE
Poker ICM is not a real-money gambling app. It is a calculation and practice tool for learning and simulating tournament poker decisions. Results and verdicts are for reference only and are not guaranteed to be accurate or complete; decisions made at the table remain your own responsibility.
```

---

## 3. キーワード（Keywords、100字以内・カンマ区切り）

App名/サブタイトルと重複する単語（Poker, ICM 等）はApple側で自動的に検索対象になるため、キーワード欄では別の語を優先。

### 日本語（89字）

```
ポーカー,ICM,バブルファクター,トーナメント,テキサスホールデム,プッシュフォールド,ナッシュ均衡,ハンドレンジ,エクイティ,オフライン,サテライト,練習,計算,ポットオッズ
```

### 英語（97字）

```
poker,ICM,bubble factor,tournament,push fold,nash equilibrium,hand range,equity,offline,satellite
```

---

## 4. プロモーションテキスト（Promotional Text、170字以内）

アプリ名・説明文と違い、審査を経ずにいつでも更新できる欄。今回は説明文の要約＋非ギャンブル表明を優先。

### 日本語（102字）

```
厳密ICM計算でcall/fold・push判定・RP当てを練習できるアプリ。導入コース5問と全員vs全員BFヒートマップも収録。完全オフライン・データは端末内のみ。実際の金銭を賭けるものではありません。
```

### 英語（169字）

```
Train ICM instincts with exact call, push, and RP-guess drills, a 5-hand intro course, and a Bubble Factor heatmap. Offline only. Not real-money gambling — a study tool.
```

---

## 5. 審査員向けノート（App Review Notes、英語）

App Store Connect の「App Review Information」→「Notes」欄に貼り付ける想定。

```
WHAT THIS APP IS
Poker ICM is an offline, ad-free training tool for tournament poker players. It
calculates ICM (Independent Chip Model) equity, Bubble Factor, and required
equity for all-in decisions, and lets users drill call/fold, push/fold, and
Risk Premium judgment through randomly generated practice scenarios. All
numbers are abstract math (percent-of-prize-pool equity, chip counts) — there
is no real-money wagering, no purchase of chips or credits, and no connection
to any gambling service of any kind.

NOT REAL-MONEY GAMBLING
- No real or virtual currency can be purchased, wagered, deposited, or
  withdrawn anywhere in the app.
- There is no in-app purchase tied to chips, credits, or wagers.
- The app teaches poker tournament decision theory (similar in spirit to a
  chess puzzle trainer or a math-drill app) rather than offering a game of
  chance for stakes.
- Because poker hands and hand rankings are shown on screen, we expect this
  content to fall under Apple's "Simulated Gambling" age-rating question, and
  we've answered it as "Infrequent/Mild" (no wagering loop, no purchasable
  chips, no encouragement to gamble with real money) — see the Age Rating
  section of this submission for details.

FULLY OFFLINE, NO ACCOUNT NEEDED
- Every feature — all calculations, the practice quizzes, progress tracking,
  and the review list — runs entirely on-device. The app makes no network
  requests at runtime; reviewing in Airplane Mode should work identically to
  reviewing online.
- There is no sign-up, login, or account system anywhere in the app. No demo
  account or credentials are required to reach any screen or feature; every
  part of the app is available immediately after launch.

HOW TO REVIEW
1. Open the app. An optional, dismissible walkthrough appears once; it does
   not gate any feature.
2. Go to the "Setup" tab and tap any scenario preset (e.g. "FT bubble") to
   auto-fill players, stacks, and payouts.
3. Go to "Results" to see ICM equity, the Bubble Factor map, and required
   equity, computed instantly with no network round trip.
4. Go to "Practice" → "New hand" to try a randomly generated call/fold
   decision, or tap "Intro course" for the 5-hand guided walkthrough that
   explains the core ICM concepts.
5. Go to "Nash" to solve a heads-up push/fold Nash equilibrium.

DATA & PRIVACY
No data is collected, transmitted to, or shared with any server. All user
input (player stacks, payout structures, practice history, and progress
stats) is persisted only in the device's local storage, and never leaves the
device. See the App Privacy answers submitted alongside this build for
details.

CONTACT
andenknt31113@gmail.com
```

---

## 6. App Privacy（プライバシー）の回答案

前提: 計算・練習のデータ（プレイヤー設定・スタック・ペイアウト・練習履歴・成績）はすべて端末内ストレージにのみ保存され、外部送信・広告SDK・アクセス解析SDKは組み込まれていない。**ただし買い切り Pro (IAP) の権限管理に RevenueCat SDK を使用しており、購入・復元時に購入情報（レシート）とランダム生成の匿名 App User ID が RevenueCat に送信される**。このため「データ収集なし」ではなく、以下の2カテゴリを申告する。

### App Store Connect「App Privacy」質問への回答方針

最初の質問「Do you or your third-party partners collect data from this app?」に対して:

> **はい（Yes, we collect data from this app）** を選択し、以下の2カテゴリのみ申告する。

| 申告カテゴリ | 項目 | 用途 | ユーザーとの紐付け | トラッキング |
|---|---|---|---|---|
| **Purchases** | Purchase History（購入履歴） | App Functionality（IAP の権限判定） | **紐付けなし (Not linked)** | **なし (No)** |
| **Identifiers** | User ID（RevenueCat の匿名 App User ID） | App Functionality | **紐付けなし (Not linked)** | **なし (No)** |

RevenueCat はランダム生成の匿名 ID のみを使い、氏名・メール等は収集しない（アカウント機能自体が無い）ため「Not linked to the user's identity」、広告・計測目的の使用は無いため「Tracking: No」で申告する。

### カテゴリ別の考え方（内部確認用メモ・参考）

| カテゴリ | 収集有無 | 理由 |
|---|---|---|
| Contact Info（連絡先） | 収集なし | 入力フォーム・登録機能自体が存在しない |
| Financial Info（決済情報） | 収集なし | 決済（カード情報等）は Apple が処理。アプリ・RevenueCat はカード情報に触れない |
| Location（位置情報） | 収集なし | 位置情報 API を一切使用しない |
| User Content（ユーザーコンテンツ） | 収集なし | プレイヤー名・スタック・ペイアウト等はすべてローカル保存のみで、サーバー送信なし |
| Identifiers（識別子） | **収集あり (User ID)** | RevenueCat の匿名 App User ID（ランダム生成、個人と紐付けなし）。広告ID (IDFA) は不使用 |
| Usage Data（利用状況） | 収集なし | アクセス解析・行動トラッキングSDK未導入（`docs/TERMS_PRIVACY_DRAFT.md` の方針と一致） |
| Diagnostics（診断情報） | 収集なし | クラッシュレポート／パフォーマンス計測SDK未導入 |
| Purchases（購入） | **収集あり** | IAP の購入履歴を RevenueCat が権限判定のために処理 |
| Other Data（その他） | 収集なし | 該当データなし |

### 注意事項（将来変更時）

- 将来的にアクセス解析（例: privacy-friendly な計測ツール）やクラッシュレポートSDKを追加する場合は、App Privacy の回答を **必ず更新**し、`docs/TERMS_PRIVACY_DRAFT.md` のプライバシーポリシーにも追記すること。
- 買い切り課金 (IAP + RevenueCat) は導入済みで、上記のとおり Purchases / Identifiers を申告する。SDK 追加・用途変更時は必ずこの回答を見直すこと。

---

## 7. 年齢制限（Age Rating）の設定案

Apple の年齢制限アンケートには「Simulated Gambling（模擬ギャンブル）」という質問項目があり、頻度を **None / Infrequent or Mild / Frequent or Intense** の3段階で回答する。

### 回答案

> **Simulated Gambling: Infrequent or Mild**

理由:
- 本アプリはポーカーのハンドレンジ・チップ・賞金期待値（ICM）という「トランプゲームの数学」を扱うため、Apple のガイドライン上「模擬ギャンブル表現あり」に該当しうる（実際の賭け・課金による疑似チップ購入・射幸心を煽る演出は一切ないが、ポーカーというゲーム自体とチップ/ベットの概念を画面上で扱うため "None" と言い切るのはリスクがある）。
- 一方で、実際の賭け金のやり取り・連続プレイを煽るループ・カジノ風の演出・チップの課金購入は存在しないため、"Frequent or Intense" ではなく **"Infrequent or Mild"** が実態に即している。

### 想定レーティング

- Apple の年齢区分（4+ / 9+ / 13+ / 16+ / 18+、2025年改定後の新区分）において、Simulated Gambling = Infrequent/Mild の回答は一般的に **13+** 相当のレーティングに寄与する（他の項目 — 暴力表現・成人向けテーマ・ギャンブル以外の項目 — はすべて「None」と回答する前提）。
- 他のカテゴリ（Cartoon or Fantasy Violence、Realistic Violence、Sexual Content、Profanity、Alcohol/Tobacco/Drugs、Horror、Contests 等）はすべて **None** を選択する。
- 最終的なレーティングは App Store Connect 上のアンケート回答の組み合わせで自動算出されるため、実際に申請フォームへ入力した上で表示される数値を必ず確認すること（本書はあくまで想定・推奨回答であり最終値の保証ではない）。

---

## 8. スクリーンショット構成案（6.7インチ・5枚）

撮影自体は別途 Playwright で行う想定のため、ここでは「どの画面を撮るか」と「キャッチコピー（オーバーレイテキスト）」の構成案のみを示す。順序はストア一覧でのサムネイル表示順（1枚目が最重要）。

| # | 画面 | 撮影対象・状態 | キャッチコピー（日本語） | キャッチコピー（英語） |
|---|---|---|---|---|
| 1 | 練習タブ / Call decision モード | 「⚖️ call/fold 判定」でランダム出題された1問。ハンド・相手pushレンジ・✅コール/❌フォールドボタンが見える状態 | 感覚じゃなく、計算で。ICM判断トレーナー | Stop guessing bubble calls. Start calculating. |
| 2 | 計算結果タブ | ICMエクイティ表 + 必要勝率(cEV/$EV/RP)パネルが両方見える状態（🎯自分・⚔️相手指定済み） | ICM・Bubble Factor・必要勝率を自動計算 | ICM, Bubble Factor, and required equity — instantly. |
| 3 | 計算結果タブ / 全員vs全員BFマップ | 「全員 vs 全員 BF マップ 🆕」のヒートマップ表示（複数プレイヤー設定済み） | 誰との一騎打ちが一番危険か、一目で | See every matchup's ICM pressure at a glance. |
| 4 | 練習タブ / 導入コース | 5問構成の導入コース中、「バブルの罠」または「サテライトの掟」の教訓(lesson)表示画面 | 5問で体感する、ICMプレッシャーの正体 | Feel the core of ICM in 5 hands. |
| 5 | Nashタブ | Nash均衡計算後、push レンジ🔴とcall レンジ🟢のグリッドが並んで見える状態 | ヘッズアップの正解レンジをNashで確認 | Solve the exact heads-up push/fold Nash range. |

補足:
- 全て日本語UI・英語UIの両方でセット撮影し、ローカライズ済みストア掲載（日本語App Store / 英語App Store）双方に対応させる。
- スクリーンショットはダークテーマで撮る（本アプリはダーク固定）。
- 5枚目までで「練習(差別化の核)→計算(信頼性)→ヒートマップ(独自性)→導入コース(初心者導線)→Nash(上級者導線)」の順に、初心者〜上級者どちらにも刺さる構成にしている。
