# 1.5.4 (build 1)

2026-11-27 作成。買い切り Pro の恒常価格改定（日本 ¥1,980 / 米国 $11.99・App Store Connect 反映済み）にあわせて、初見の体験（無料 PKO 例題・ヒントバー復活）、文脈別ペイウォール刷新と常設 Pro 導線、RevenueCat SDK による匿名ペイウォール計測と規約・App Privacy 整合、評価誘導の緩和、チョップ共有 URL、Web 入口（`/` LP 化・`/support` 改善）をまとめたアップデート。計算モデルおよび課金形態（買い切り・月額なし）は 1.5.3 から変えていない。

## 変えたこと

### 初回体験・無料 PKO 例題

- **無料で試せる組み込み PKO 例題を追加 (`setupScenarios.ts` / `bountyState.ts` / `setupBounty.ts` / `index.html` / `locales/{ja,en}.ts`)**:
  - 無料ユーザーでも 1 タップで PKO バウンティの計算結果（カバー時の必要勝率低下・`BF < 1.0` の緑表示・13×13 ハンド表の変化）を体感できる組み込み PKO 例題を追加。
  - 既存の「例題の閲覧・計算は無料、自分の卓の編集は Pro」原則に従い、組み込み PKO 例題を未編集で閲覧中のみ無料でも `bountySpecFor` によるバウンティ計算を有効化。バウンティ額の入力欄や KO / PKO モード切替をタップした際は `openPaywall("bounty")` を開く。
- **初回ヒントバーの復活と初回案内 CTA 整備 (`workspace.css` / `guide.ts`)**:
  - `.workspace .first-hint-bar { display: none; }` により初回ヒントバーが隠れていた不具合を修正し、初回起動時に意図どおり表示されるようにした。
  - 初回ガイド内のセットアップ導線ボタン（`#onboarding-cta-setup`）を視認性の高いプライマリ CTA スタイルに整えた。

### ペイウォール刷新・常設 Pro / 復元導線

- **文脈別ペイウォールへ刷新 (`paywall.ts` / `locales/{ja,en}.ts`)**:
  - `openPaywall(trigger)`（`players` / `payouts` / `bounty` / `save` / `header` / `guide`）へ拡張し、ロック箇所ごとの見出し・サブコピー、実測値ベースの Before / After ミニ比較カード（PKO カバー有無・多人数バブル等）、買い切り ROI 訴求、モーダル下部の規約リンク（`openLegalModal()`）を追加。
  - 起動時の価格先読み（`preloadOfferingPrice()`）により、ペイウォール表示直後の `"—"` チラつきを抑止。価格はコードへハードコードせず RevenueCat から App Store の最新価格を動的取得し、`.paywall-one-time` および「買い切り・月額課金なし」表記を維持。
- **常設 Pro / 購入復元入口を追加 (`index.html` / `main.ts` / `guide.ts` / `setup*.ts`)**:
  - ヘッダーに控えめな常設「Pro」ピルボタンを追加（Pro 購入済み時は非表示、`onEntitlementChange` で自動追従）。
  - `?` ガイド内の Pro 説明セクションにも「Pro を見る / 購入を復元」ボタンを設置し、ロックを踏む前から買い切り Pro の内容確認と購入復元へ進めるようにした。
  - 各ロック箇所（5人以上編集・賞金編集・バウンティ設定・局面/賞金保存）から適切な `trigger` を渡してペイウォールを開くよう統一。

### 匿名ペイウォール計測・利用規約＆プライバシーポリシー整合

- **匿名ペイウォール表示計測を導入 (`paywall.ts`)**:
  - 導入済みの `@revenuecat/purchases-capacitor` が備える `Purchases.trackCustomPaywallImpression` を、iOS ネイティブかつ IAP 設定済み時のみ `openPaywall(trigger)` 内で安全に呼び出す（`try/catch` で失敗時は無視・Web 非バンドル・新規 SDK 追加なし）。
  - ペイウォール表示数・ロック起点別の遭遇比率・表示から購入への転換率を RevenueCat 上で把握できるようにした。
- **利用規約・プライバシーポリシー 3 箇所を完全同期 (`legalContent.ts` / `playground/public/legal.html` / `docs/TERMS_PRIVACY_DRAFT.md`)**:
  - 起動時の購入状態確認通信および匿名の課金画面表示計測（個人情報と非紐付け・広告トラッキングなし）を正直に記載し、入力データ（スタック・賞金・保存局面）が端末外へ送信されない原則と整合させた（`legalSync.test.ts` で 3 箇所一致を保証）。

### ストアレビュー誘導・チョップ共有ループ

- **アプリ内評価依頼の発火条件を緩和＆手動評価リンクを追加 (`reviewPrompt.ts` / `handRange.ts` / `paywall.ts` / `guide.ts`)**:
  - 最小起動回数を `REVIEW_MIN_LAUNCHES = 3 → 2` に緩和し、「自分の手札」クイック判定などの完了操作も評価依頼のカウント対象に追加（ペイウォールを閉じた直後は表示しないガード付き、Pro 購入成功時は好機として扱う）。
  - ガイドモーダル下部に App Store のレビュー画面を直接開く評価リンク（`?action=write-review`）を 1 行追加。
- **チョップ共有テキストに App Store URL を追加 (`chop.ts`)**:
  - `formatChopShareText` の末尾にクリーンなグローバル App Store URL（`https://apps.apple.com/app/id6793358140`）を 1 行追加し、ライブ FT のディール結果を LINE やメモへ共有した際の自然流入導線を追加。

### Web 入口・サポートページ改善（iOS 専用方針を維持）

- **`worker/gate.ts`**:
  - App Store リンクを日本固定（`/jp/`）からグローバル URL（`https://apps.apple.com/app/id6793358140`）へ変更し、海外ユーザーにも現地ストアが開くようにした。
  - トップ `/` を `410 Gone` から軽量な `200 OK` の日英 iOS アプリ案内ランディングページ（ダークエメラルドテーマ `#101715` / `#a8e6bd`、Smart App Banner、OGP メタタグ、App Store ダウンロード CTA、`/support`・`/legal` リンク）へ改善。
  - `/assets/*`・`/index.html` 等の計算アプリ配信用パスに対する `410 Gone` 遮断および `/support`・`/legal` の `200 OK` 配信は維持（Web 版計算アプリ非提供・iOS 専用方針を厳守）。
- **`playground/public/support.html`**:
  - 上部・リンク欄・英語サポート欄にグローバル App Store URL を追加し、価格表記を「買い切り（月額課金なし・価格は App Store の表示に準拠）」に統一。

### バージョン・価格・プロモ更新

- `ios/App/App.xcodeproj/project.pbxproj` の `MARKETING_VERSION` を `1.5.4`、`CURRENT_PROJECT_VERSION` を `1` へ更新。
- App Store Connect 上の買い切り Pro（`pro_lifetime`）ライブ価格を **日本 ¥1,980 / 米国 $11.99** へ恒常改定済み。
- `docs/PROMO_X_QUIZ_PACK_2.md`（Q7〜Q12 改訂・実画面スクショ指示・ASC Campaign Link 手順・固定ポスト案）および `docs/PROMO_EN.md`（1.5.3 機能・$11.99 価格・`r/poker` / TwoPlusTwo §2 即投稿版）を最新化。

## 検証（提出前チェックリスト）

- [ ] `npm -w @poker-icm/core run build && npm run typecheck && npm test && npm run build` 全通過（`legalSync.test.ts`・`webGate.test.ts`・`chop.test.ts`・新規単体テスト含む）
- [ ] `cd playground && E2E_BROWSER_CHANNEL=chrome npm run e2e` 全通過
- [ ] 390×844（ja / en）スクリーンショット目視確認：新ペイウォール（`bounty` トリガー）、ヘッダー常設 Pro ボタン、無料 PKO 例題適用後の画面
- [ ] `npm run cap:sync` → Xcode Release ビルド（1.5.4 / build 1）・iOS シミュレーター動作確認
- [ ] **本人実機チェック**: Pro 購入・購入復元・App Store Connect 売上受取口座の確認
- [ ] **App Store Connect「App Privacy」更新**（下記手順のとおり `Usage Data > Product Interaction` を追加して Publish）
- [ ] Cloudflare Worker デプロイ後、`/`（200 LP）・`/support`（200）・`/legal`（200）・`/index.html`（410）の疎通確認および ASC Marketing URL 登録確認

## ストア文面（案）

### 更新説明（What's New — ja）

```
・無料のまま1タップで体験できる PKO バウンティ例題を追加しました（相手をカバーしたときの必要勝率の変化をすぐ確認できます）
・初回起動時のヒントバー表示を修正し、ヘッダーやガイドから Pro の詳細・購入復元へいつでもアクセスできるようにしました
・機能別の説明や買い切りメリットが伝わりやすいよう、Pro 案内画面を刷新しました
・チョップ共有コピーの整備、利用規約・プライバシーポリシーの更新（匿名の画面表示計測の明記）など細かな使い勝手を改善しました
```

### 更新説明（What's New — en-US）

```
- Added a free built-in PKO bounty example so you can try bounty math and see how covering a villain shifts required equity in one tap
- Restored the first-run hint bar and added quick access to Pro details and Restore Purchases from the header and guide
- Refreshed the Pro upgrade screen with context-specific explanations and clearer one-time purchase details
- Included the App Store link in copied ICM chop results, updated the Terms & Privacy Policy, and polished overall usability
```

### プロモーションテキスト（任意更新案・170字以内）

日本語（103/170字）:

```
4人までの卓と例題（PKO例題含む）は無料。厳密ICMの必要勝率・全員ぶんのNash（3人同時オールイン対応）・手札クイック判定・BB/チップ切替・ICMチョップ共有を完全オフラインで。買い切りPro対応。
```

英語（157/170字）:

```
Free up to 4 players & examples (incl. PKO). Exact ICM, 3-way Nash, quick hand check, BB/Chips toggle & 1-tap chop copy — 100% offline. One-time Pro, no sub.
```

### App Store 説明文（Description — 1.5.4 更新案・ja）

*1.5 時点の説明文に、1.5.3（独立チョップタブ＋1タップ共有、自分の手札クイック判定、BB / チップ単位切替）と 1.5.4（無料 PKO 例題、プライバシー記述整合）を反映した最新版。*

```
「バブルでこのオールイン、コールしていい？」— その疑問に、その場で数字で答えるアプリです。

Poker ICM は、ポーカートーナメントの ICM（Independent Chip Model）と Bubble Factor（BF）を計算し、オールインが絡むコール／フォールド判断を数字で確かめる iOS ツールです。日本語・英語に対応し、完全オフラインで動作します。

【できること】
■ 必要勝率（ICM 込み / チップだけ / Risk Premium）
全員のスタックと賞金を入れて、自分と相手を選ぶだけ。コールに必要な勝率を、勝った場合・負けた場合・降りた場合の賞金期待値から厳密に計算します。「チップだけなら45%でいいのに、ICM 込みだと58%必要」のような ICM の重さを数字で確認できます。

■ BB / チップ単位切替（ライブトーナメント対応）
スタック入力は「BB」と「チップ」をワンタップで切替可能。1 BB の額（1k / 5k / 10k / 20k プリセットまたは任意入力）を設定すれば、ライブトーナメントの実チップ数のまま ICM・ハンド判断・チョップを計算できます。

■ ハンドレンジ比較 ＆ 「自分の手札」クイック判定
相手のオールインレンジを想定すると、自分がコールできるハンドが 13×13 グリッドで色分け表示されます。表の上にある「自分の手札」から 2 枚を選べば、表から探さずに即座にコール／フォールド判定と勝率を確認可能。席順に合わせて「相手のオールインを受ける」「自分からオールイン」も自動で切り替わります。

■ ICM 計算と Bubble Factor マップ
各プレイヤーの賞金期待値を Malmuth-Harville 方式で計算。「誰に対してタイトに、誰に対してルースに打つべきか」を全員×全員のヒートマップで一望できます。バウンティ局面で BF が 1.0 を下回る有利な相手は緑で強調されます。

■ Nash 均衡（プッシュ／フォールド・3人同時オールイン対応）
「オールインか降りるか」の2択に絞ったときの Nash 均衡レンジを、ICM を反映して全員ぶん計算します。誰が最初にオールインするかごとに、そのレンジと後ろの全員のコールレンジを一覧で表示。1人コールが入ったあとにもう1人が入るオーバーコール（3人同時オールイン）のレンジにも対応しています。行をタップすると 13×13 の表が開きます。

■ ICM チョップ（ディール）＆ 1タップ結果コピー
独立タブから残った全員の ICM チョップとチップチョップを比較でき、丸める刻みも選択可能。計算結果は 1 タップでコピーしてそのまま共有できます。

■ バウンティ（KO / PKO）
各プレイヤーにかかっているバウンティの額を入れると、必要勝率・ハンド表・Bubble Factor・Nash のすべてに反映します。KO は飛ばした相手のバウンティを全額、PKO は半分をその場で受け取り、半分が自分のバウンティに乗る形で計算します（卓に残っているバウンティはチップ比率で見積もる近似、ミステリーバウンティは平均額を入力）。組み込みの PKO 例題は無料のまま体験でき、自分の卓でのバウンティ設定・編集は Pro で利用できます。

【こんな方に】
・店舗トーナメントやアマチュア大会で、バブルやファイナルテーブルの判断に自信が持てない方
・海外製の ICM ツールは英語表記や月額課金がハードルで続かなかった方
・「感覚」ではなく「計算」で ICM 判断やディール配分を裏付けたい方
・ICM や Bubble Factor、PKO バウンティの仕組みを数字でしっかり理解したい方

【オフライン設計・プライバシー】
計算処理はすべて端末内で完結し、入力したスタック・賞金・保存した局面が外部サーバーへ送信されることはありません。アカウント登録も不要で、ダウンロード後すぐにお使いいただけます。通信環境がない移動中や機内モードでも計算機能はすべて利用できます（Pro の購入・復元、起動時の購入状態確認、および個人情報と紐付かない匿名の課金案内表示計測には RevenueCat との通信を使用します）。

【無料版と Pro（買い切り・月額なし）】
無料版では、組み込みの例題（PKO バウンティ例題を含む）で全計算機能（ICM・Bubble Factor マップ・必要勝率・ハンド比較・Nash 均衡・チョップ）をご利用いただけるほか、4人までのテーブル（ヘッズアップ〜4人卓）ならスタック・賞金・BB/チップ切替・チョップコピーを自由に利用できます。5人以上のフルテーブル編集、局面・賞金の保存、自分の卓でのバウンティ（KO / PKO）設定は、一度の購入で永続利用できる買い切り Pro（月額課金なし）として提供しています。

【対応している場面・していない場面】
このアプリが計算するのは「オールイン」が絡む判断です。
・相手のオールインにコールするか降りるか（スタックの深さに関係なく使えます）
・ショートスタック（目安：実効12BB以下）で、自分からオールインするか降りるか
・3人が同時にオールインする局面まで

次の判断は計算しません。
・2BBオープン、リンプ、3ベットなど、オールイン以外のアクション
・4人以上が同時にオールインする局面
・フロップ以降のプレイ

実効20BBを超える深さでは、オールインか降りるかの2択で考える前提が実戦と合わなくなるため、Nash の結果は参考値として注意を添えて表示します。計算の前提と限界はアプリ内のガイドにまとめています。

【ご注意】
本アプリは実際の金銭を賭けるギャンブルではありません。ポーカートーナメントにおける意思決定を学習・シミュレーションするための計算ツールです。表示される計算結果や判定は参考情報であり、その正確性・完全性を保証するものではありません。実戦での最終判断は、利用者ご自身の責任において行ってください。
```

### App Store 説明文（Description — 1.5.4 更新案・en-US）

```
"It's the bubble. Can I call this shove?" Poker ICM answers that with numbers, on the spot.

Poker ICM calculates exact ICM (Independent Chip Model) equity and Bubble Factor for poker tournaments, so you can check all-in call/fold and push/fold decisions with real numbers. Launches automatically in English on English devices (Japanese also supported) and runs 100% offline.

WHAT IT DOES

- Exact required equity (ICM / chips only / risk premium)
Enter everyone's stack and payouts, then mark yourself and your opponent. Required calling equity is computed exactly across all three terminal outcomes (win, lose, and fold), showing the true weight of ICM pressure.

- BB / Chips unit toggle for live tournaments
Switch between big blinds and raw chip counts in one tap. Pick a 1 BB preset (1k / 5k / 10k / 20k) or enter any value to run ICM, hand charts, and deal chops using real live chip counts.

- 13x13 hand charts & quick "Your hand" picker
Set villain's shoving range (Top X%, custom paint, or the spot's Nash range) and see every callable hand colored on a 13x13 grid. Pick your exact two cards above the grid for an instant call/fold verdict and equity. Seat order automatically switches between facing a shove and shoving first.

- ICM equity & Bubble Factor heatmap
Malmuth-Harville prize equity for every player, plus an everyone-vs-everyone Bubble Factor matrix showing who to play tight or loose against (cells highlight green when BF drops below 1.0 in bounty spots).

- Full-table Nash equilibrium (up to 3-way all-in)
ICM push/fold Nash ranges for every seat. For each possible first shover, see their shoving range and every caller behind, including second-caller overcalls (3-way simultaneous all-in). Tap any row to open its 13x13 chart.

- Dedicated ICM Chop tab & 1-tap Copy
Compare ICM deal splits against a chip chop with selectable rounding units, then copy the formatted breakdown in one tap.

- Bounty tournaments (KO / PKO)
Enter each player's bounty to reflect it across required equity, hand charts, Bubble Factor, and Nash. KO awards the full bounty immediately; PKO awards half immediately and adds half to your own bounty (remaining bounties use a chip-proportional approximation; use the average value for mystery bounties). Try a built-in PKO example for free; custom bounty editing unlocks with Pro.

WHO IT IS FOR

- Live and online MTT players who want clear math around bubbles, final tables, and deal chops
- Players tired of monthly subscriptions or web tools that stall at live venues
- Anyone who wants to understand ICM, Bubble Factor, and PKO swings with real numbers

OFFLINE & PRIVATE

All calculations run on-device, and your stacks, payouts, and saved spots never leave your device. No account is required, and every calculator feature works offline (internet is used only for purchasing/restoring Pro, launch entitlement checks, and anonymous, non-identifying upgrade-screen impression counts via RevenueCat).

FREE & PRO (ONE-TIME PURCHASE, NO SUBSCRIPTION)

Free: full calculation features on built-in examples (including PKO), plus freely editable tables up to 4 players (including BB/Chips toggle and 1-tap chop copy).
Pro is a one-time purchase with no subscription. It unlocks 5–9 player table editing, saving spots/payouts, and KO/PKO bounty editing on custom tables.

WHAT IT COVERS AND WHAT IT DOES NOT

Covers all-in decisions only: calling/folding against a shove at any depth, shoving/folding short-stacked (~12 BB effective or less), and up to 3-way all-ins. Does not calculate min-raises, limps, 3-bets, 4+ way all-ins, or postflop play. Above 20 BB effective, Nash results are shown as reference with a note. All assumptions are documented in-app.

NOTE

Not real-money gambling — an offline calculation tool for studying tournament decisions. Results are for reference only; decisions at the table remain your own responsibility.
```

## 審査メモ（App Review Notes — 1.5.4 差し替え案）

App Store Connect の `App Review Information > Notes` にある `What is new in 1.5.3` の節を、以下の `What is new in 1.5.4` へ置き換える（文字数上限 4,000 字以内を確認すること）。

```
What is new in 1.5.4 (UX, paywall clarity, anonymous paywall impression counting, and web landing polish; no changes to calculation model, wagering scope, or non-consumable purchase type):
- Free built-in PKO bounty example: users can now tap a built-in PKO scenario under Examples to see how KO/PKO bounty math works on-device without purchasing Pro. Editing bounty amounts or switching bounty modes on custom tables still opens the Pro paywall.
- First-run hint bar & persistent Pro entry: fixed a CSS rule that hid the first-run hint bar, polished the onboarding CTA, and added a subtle "Pro" button in the header (hidden once Pro is unlocked) plus a "View Pro / Restore Purchases" button in the Help guide.
- Context-aware Pro paywall: the Pro upgrade modal now adapts its heading and before/after example card to the feature tapped, preloads the live App Store price via RevenueCat (still non-consumable one-time purchase "pro_lifetime", no subscription), and links to Terms & Privacy inside the modal.
- Anonymous paywall impression counting & Privacy Policy alignment: when the Pro paywall opens on iOS, the app calls RevenueCat's Purchases.trackCustomPaywallImpression (no new SDK added, not linked to user identity, no IDFA, no tracking, no ATT needed). The in-app Terms & Privacy Policy and public /legal page have been updated to document both launch entitlement checks and anonymous paywall impression counting, and App Store Connect App Privacy has been updated with Usage Data > Product Interaction (Analytics, Not Linked, Tracking: No).
- Review prompt & chop copy: broadened in-app SKStoreReviewController eligibility (min 2 launches; includes quick hand checks; guarded against appearing right after dismissing the paywall), added a manual App Store review link in Help, and appended the global App Store URL to copied ICM chop text.
- Web landing & support page: updated the public landing page (/) and /support to use the global App Store link and describe the iOS-only app (calculator web routes remain 410 Gone).

No changes to age-rating answers ("Gambling: Yes" per earlier Guideline 2.3.6 guidance; "Simulated Gambling: None" — purely an offline math calculator, no playable game or wagering). No account or demo credentials required.
```

## App Store Connect「App Privacy」申告更新手順（1.5.4 提出前必須）

1.5.4 で既存 RevenueCat SDK の `Purchases.trackCustomPaywallImpression` を導入するため、**審査提出前に必ず App Store Connect の「App Privacy（アプリのプライバシー）」を更新して Publish する**。

### 申告カテゴリ一覧（1.5.4 時点）

最初の質問「このアプリからデータを収集しますか？」は引き続き **はい（Yes）**。以下の 3 カテゴリを申告する（既存の 2 カテゴリに **`Usage Data > Product Interaction`** を 1 件追加）。

| 状態 | 申告カテゴリ | 項目 | 用途（Purpose） | ユーザーとの紐付け | トラッキング | 補足 |
|---|---|---|---|---|---|---|
| 既存維持 | **Purchases** | Purchase History（購入履歴） | App Functionality | **紐付けなし (Not Linked)** | **なし (No)** | RevenueCat による IAP 権限判定 |
| 既存維持 | **Identifiers** | User ID | App Functionality | **紐付けなし (Not Linked)** | **なし (No)** | RevenueCat の匿名 App User ID（IDFA 不使用） |
| **1.5.4 追加** | **Usage Data** | **Product Interaction（製品インタラクション）** | **Analytics（分析）** | **紐付けなし (Not Linked)** | **なし (No)** | `trackCustomPaywallImpression` による匿名ペイウォール表示回数計測 |

### App Store Connect 画面での更新手順

1. **App Store Connect → マイ App → Poker ICM → App Privacy（アプリのプライバシー）** を開く。
2. **「編集（Edit）」** をクリックし、データタイプ一覧から **「利用状況データ（Usage Data）」→「製品インタラクション（Product Interaction）」** にチェックを入れて **「保存（Save）」**。
3. App Privacy トップに戻り、追加された **「製品インタラクション（Product Interaction）」の「設定（Set Up）」** を開く。
4. 用途（How is this data used?）で **「分析（Analytics）」のみ** にチェックを入れて次へ。
5. ユーザーとの紐付け（Is this data linked to the user's identity?）で **「いいえ（No）」** を選択（アカウント機能なし・匿名 ID のみ）。
6. トラッキング用途（Do you or your third-party partners use this data for tracking purposes?）で **「いいえ（No）」** を選択（他社アプリ・Web を横断する追跡や広告配信なし・ATT 不要）。
7. **「保存（Save）」** 後、App Privacy 画面右上の **「公開（Publish）」** をクリックして反映を確定する。

### 変わらないプライバシー原則（審査・ユーザー説明の一貫性）

- 入力したスタック・賞金・バウンティ額・保存した局面は端末内ローカルストレージのみに保存され、外部サーバーへ一切送信されない（User Content / Financial Info / Contact Info / Location / Diagnostics はすべて収集なし）。
- 広告 SDK・IDFA は未導入のため、ATT（App Tracking Transparency）許諾ダイアログは不要。
- アプリ内規約（`legalContent.ts`）と公開 `/legal` ページ（`playground/public/legal.html`）の記載が上記 App Privacy 申告と一致していることを `legalSync.test.ts` で担保する。

### 併せて確認する ASC 設定

- **Marketing URL**: Cloudflare Worker デプロイ後、`/`（200 OK の日英 iOS 案内ページ）を App Store Connect の Marketing URL に設定可能（アプリ内から Web へ誘導しない方針は継続）。

## 提出状況

- 2026-11-27 時点: ブランチ `feat/v1.5.4-growth-paywall` にて実装・検証進行中。買い切り Pro 価格は App Store Connect にて **日本 ¥1,980 / 米国 $11.99** へ改定・確認完了済み。
