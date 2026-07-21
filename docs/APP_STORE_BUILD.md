# App Store 提出ガイド (Capacitor iOS ラッパー)

対象アプリ: Poker ICM/BF (`dev.workers.andenknt31113.pokericm`)
Web 本体: Vite + TS の PWA (`playground/`)、ネイティブラッパー: Capacitor 8 (`ios/`)

このドキュメントは Web 側 (Linux/CI) から準備できる部分と、Mac + Xcode が
必要な部分を切り分けて手順化したものです。Linux 環境では Xcode ビルド・
署名・Archive はできないため、①ローカル Mac、②GitHub Actions (macos
ランナー) のどちらかで最終ビルドを行います。

---

## 0. 前提

- `capacitor.config.ts`: `appId = dev.workers.andenknt31113.pokericm`, `webDir = playground/dist`
- ネイティブ機能は最小限 (`@capacitor/status-bar` でステータスバーをダーク配色に固定)。
  カメラ・位置情報・通知など審査が重くなる権限は使用していない。
- 実マネー決済・実賭博機能は一切なし (ICM/BF 計算と練習問題のみ)。

---

## 1. Mac + Xcode でのビルド〜アップロード手順

### 1.1 事前準備 (一度だけ)

1. Xcode 最新版をインストール、初回起動して Command Line Tools を承諾する。
2. Apple Developer Program に登録済みの Apple ID で Xcode にサインインする
   (Xcode → Settings → Accounts)。
3. CocoaPods を導入する: `sudo gem install cocoapods` (Capacitor 8 は
   `ios/App/Podfile` で CocoaPods 管理。`pod --version` で確認)。

### 1.2 Web ビルド → ネイティブ同梱

```bash
# リポジトリルートで
npm install
npm run build          # core → playground の順にビルド (playground/dist を生成)
npx cap sync ios        # playground/dist を ios/App/App/public にコピーし、
                         # Podfile / Package.swift 等ネイティブ側の依存を更新
```

`npm run cap:sync` (= `npm run build && cap sync ios`) でも同じことができる。
`cap sync` は Web 資産のコピーと、`ios/App/App/public`・
`ios/App/App/capacitor.config.json`・`ios/capacitor-cordova-ios-plugins/`
配下のみを更新する (これらは `.gitignore` 済み)。Xcode プロジェクト本体
(`ios/App/App.xcodeproj` 等) の設定はここでは変更されない。

### 1.3 Xcode で開く

```bash
npx cap open ios   # = open ios/App/App.xcworkspace
```

`.xcworkspace` (CocoaPods 込み) を開くこと。`.xcodeproj` を直接開かない。

### 1.4 Signing & Capabilities 設定

1. 左のナビゲータで `App` ターゲットを選択 → `Signing & Capabilities` タブ。
2. `Automatically manage signing` を有効にし、Team に Apple Developer
   Program のチームを設定する。
3. Bundle Identifier が `dev.workers.andenknt31113.pokericm` になっている
   ことを確認する (App Store Connect 側で事前に同じ Bundle ID の App を
   作成しておく必要がある)。
4. General タブでバージョン (`Version`) / ビルド番号 (`Build`) を確認・
   インクリメントする。ビルド番号は提出のたびに一意な値にする必要がある
   (例: `date +%Y%m%d%H%M`)。
5. 実機 (iPhone) を USB 接続し、一度実機ビルドしてクラッシュしないことを
   確認しておくと安全 (Simulator ではカメラ等一部 API しか差が出ないが、
   最低限の起動確認として推奨)。

### 1.5 Archive → App Store Connect へアップロード

1. Xcode 上部のスキーム選択で実行先を `Any iOS Device (arm64)` に切り替える
   (Simulator が選ばれていると Archive できない)。
2. メニュー `Product → Archive` を実行。ビルドが終わると Organizer
   (`Window → Organizer`) が自動で開き、Archive 一覧に追加される。
3. 対象の Archive を選択し `Distribute App` → `App Store Connect` →
   `Upload` を選択。署名方式は `Automatically manage signing` のままでよい。
4. アップロード完了後、App Store Connect (https://appstoreconnect.apple.com)
   の対象アプリ → `TestFlight` タブでビルドの処理完了 (数分〜数十分) を待つ。
5. `App Store` タブで新規バージョンを作成し、アップロード済みビルドを
   紐付け、スクリーンショット・説明文・年齢区分 (下記 §3 参照) を入力して
   `Submit for Review` する。

---

## 2. GitHub Actions (macos ランナー + fastlane) での代替手順の骨子

ローカル Mac が使えない場合、CI 上でビルド〜TestFlight/App Store への
アップロードまで自動化できる。以下は導入時に用意すべきものの骨子。

### 2.1 全体フロー

```
push/tag
  → macos-latest ランナー起動
  → npm ci && npm run build && npx cap sync ios
  → (Pods install)
  → fastlane (match で証明書取得 → gym で Archive → pilot/deliver でアップロード)
```

### 2.2 必要な Secrets / 準備物

| 用途 | 内容 |
|---|---|
| App Store Connect API キー | 後述の手順で発行した `.p8` キー本体 (Base64 化して Secrets に保存)、Key ID、Issuer ID |
| 署名証明書・プロビジョニング | `fastlane match` を使う場合は match 用の Git リポジトリ (証明書を暗号化して保存) + 復号パスフレーズ。match を使わない場合は証明書 (.p12) とパスフレーズ、プロビジョニングプロファイルを直接 Secrets に保存 |
| Bundle ID / Team ID | Apple Developer の Team ID、`dev.workers.andenknt31113.pokericm` |

### 2.3 App Store Connect API キーの登録方法

1. App Store Connect → `Users and Access` → `Integrations` タブ →
   `App Store Connect API` を開く (Account Holder または Admin 権限が必要)。
2. `Generate API Key` (または `+`) を押し、キー名を入力、Access を
   `App Manager` 以上に設定して発行する。
3. 発行直後の画面でのみ `.p8` 秘密鍵ファイルをダウンロードできる
   (再ダウンロード不可のため必ずその場で保存する)。あわせて `Key ID` と、
   画面上部に表示される `Issuer ID` を控える。
4. GitHub リポジトリの `Settings → Secrets and variables → Actions` で
   以下を登録する:
   - `ASC_KEY_ID`: Key ID
   - `ASC_ISSUER_ID`: Issuer ID
   - `ASC_KEY_CONTENT`: `.p8` ファイルの中身 (もしくは `base64 -i AuthKey_XXXX.p8` した文字列)
5. fastlane 側では `app_store_connect_api_key` アクション (もしくは
   `ASC_KEY_CONTENT` を一時ファイルに書き出して `key_filepath` で渡す) で
   これらを読み込み、`match` / `pilot` / `deliver` に渡す。
   ```ruby
   app_store_connect_api_key(
     key_id: ENV["ASC_KEY_ID"],
     issuer_id: ENV["ASC_ISSUER_ID"],
     key_content: ENV["ASC_KEY_CONTENT"],
     is_key_content_base64: true,
   )
   ```

### 2.4 ワークフロー雛形 (骨子)

```yaml
# .github/workflows/ios-release.yml (骨子・要調整)
name: iOS Release
on:
  workflow_dispatch: {}
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - run: npx cap sync ios
      - uses: ruby/setup-ruby@v1
        with: { ruby-version: "3.3", bundler-cache: true }
      - run: bundle exec fastlane ios release
        env:
          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          ASC_KEY_CONTENT: ${{ secrets.ASC_KEY_CONTENT }}
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
```

`fastlane/Fastfile` 側の `release` レーンで `cocoapods` → `match(type:
"appstore")` → `gym`(Archive) → `pilot`/`deliver` を呼ぶ。証明書・
プロビジョニングは初回のみ手動 (ローカル Mac) で `match` を実行して
match 用リポジトリを作成しておく必要がある。

この骨子は導入時の叩き台であり、実際の Fastfile / workflow ファイルは
本タスクのスコープ外 (別途着手が必要)。

---

## 3. 審査対策メモ

### 3.1 年齢区分 (Age Rating): Simulated Gambling → 17+

- App Store Connect の `App Information → Age Rating` アンケートで
  「Simulated Gambling (シミュレートされたギャンブル)」の項目に
  該当する可能性が高い (ポーカーのトーナメント状況を扱うため)。
  正直に「Infrequent/Mild」〜実態に応じた選択をすること。これにより
  年齢区分は自動的に **17+** となる想定。
- 実際には「賭け金のやり取りを行わない計算・練習ツール」であっても、
  ポーカー用語・トーナメント構造を扱う以上は保守的に申告するのが安全。
  過少申告してリジェクトされるより、17+ 前提で説明文を用意しておく方が
  審査がスムーズ。

### 3.2 Guideline 4.2 (Minimum Functionality) 対策

App Store Review Guideline 4.2 は「Web サイトをただ App にラップしただけ」
のアプリを主な対象にリジェクトする。本アプリは以下の点で単純な Web
ラップではないことを説明できるようにしておく。

- **オフライン動作**: ICM/BF/Nash 計算・練習問題はすべてクライアント側
  JS で完結し、ネットワーク接続なしで動作する (Service Worker による
  PWA キャッシュを Web 版では使うが、ネイティブ版はアプリバンドルに
  Web 資産を同梱しているため、そもそも初回起動からオフラインで完結する)。
- **練習機能 (Practice モード)**: 単なる情報表示ではなく、押し引き判定
  クイズ・レンジ当てクイズなど、ユーザーが能動的に回答し正誤判定を得る
  インタラクティブな学習機能を持つ。
- **ネイティブ UI 調整**: アプリのダーク配色に合わせたステータスバーの
  スタイル設定 (`@capacitor/status-bar`) など、単なる WebView 表示では
  なく OS ネイティブ UI と連携する調整を行っている。

**審査ノート (App Review 提出時の "Notes" 欄への記入例、英語)**:

```
This app is an offline-first poker tournament calculator and practice
tool (ICM / Bubble Factor / Nash equilibrium push-fold ranges).

- No real-money gambling: the app does not accept, process, or facilitate
  any real-money wagers, payments, or in-app purchases of any kind. All
  calculations are educational/reference tools for players who already
  play poker tournaments elsewhere (e.g. at licensed venues).
- Fully functional offline: all math runs client-side; the app bundles
  its web assets and requires no network connection after install.
- Interactive practice mode: users answer push/fold and hand-range
  quizzes and receive immediate right/wrong judgments and explanations,
  which goes beyond a simple content viewer.
- Native integration: the status bar style is set natively to match the
  app's fixed dark theme (@capacitor/status-bar).

Given the poker terminology and tournament context, we expect this to
be rated 17+ (Simulated Gambling) and have set the age rating
accordingly.
```

**日本語版 (社内メモ用)**:

```
本アプリはオフライン動作するポーカートーナメント用の計算・練習ツール
(ICM / バブルファクター / ナッシュ均衡プッシュ/フォールドレンジ) です。

- 実マネー機能なし: 実際の金銭を賭ける・受け取る機能、決済機能、
  アプリ内課金は一切ありません。本アプリはあくまで、他所 (実店舗等)
  でポーカートーナメントをプレイするプレイヤー向けの学習・参考ツール
  です。
- 完全オフライン動作: 計算処理はすべてクライアント側で完結し、
  インストール後はネットワーク接続なしで利用できます。
- インタラクティブな練習機能: 押し引き判定・レンジ当てなどのクイズに
  ユーザーが回答し、即座に正誤判定と解説を得られる、単なるコンテンツ
  閲覧に留まらない機能を備えています。
- ネイティブ連携: ステータスバーのスタイルをアプリのダーク配色に合わせて
  ネイティブに設定するなど、OS ネイティブ UI との連携を行っています。

ポーカー用語・トーナメント文脈を扱うため、年齢区分は 17+
(Simulated Gambling) を想定し、そのように設定しています。
```

### 3.3 その他チェック項目

- プライバシーポリシー URL (App Store Connect 提出時に必須): 現状
  `docs/TERMS_PRIVACY_DRAFT.md` は下書きのため、公開用ページとして
  ホスティングし、実際の URL を App Store Connect に登録すること。
- App Store のスクリーンショットは iPhone 6.7インチ (必須) を最低限
  用意する (iPad 対応する場合は iPad 用も別途)。
- `NSPhotoLibraryUsageDescription` 等、実際には使用していない権限の
  `Info.plist` エントリが Capacitor プラグインの追加によって不要に
  混入していないか、Archive 前に `ios/App/App/Info.plist` を確認する
  (今回追加した `@capacitor/share` / `@capacitor/status-bar` は追加の
  権限プロンプトを必要としない)。
