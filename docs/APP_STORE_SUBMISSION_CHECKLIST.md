# App Store 提出チェックリスト (このまま上から実行)

最終更新: 2026-08-09。素材の本文は `APP_STORE_LISTING.md`、ビルド手順の詳細は
`APP_STORE_BUILD.md` を参照。ここは「提出当日に上から順に潰す」ための実行リスト。

**いま残っているのは §8 (iPad スクショ登録 → 審査用に追加 → 提出) だけ。**
画像は生成済みで `screenshots/` にコミットしてある。

## 0. 済んでいるもの (再作業不要)

- [x] ASC アプリレコード「Poker ICM」作成 (Bundle ID `dev.workers.andenknt31113.pokericm`)
- [x] IAP `pro_lifetime` (非消耗型, ¥3,480) 作成・表示名/説明 日英登録
- [x] App用共有シークレット発行 → RevenueCat に登録済み
- [x] RevenueCat: プロジェクト / entitlement `pro` / offering `default` (current) / In-App Purchase Key
- [x] アプリに公開 SDK キー組み込み済み (`playground/src/iapConfig.ts`)
- [x] スクリーンショット 7枚 (1290×2796) 生成済み (チャットで受領した zip)
- [x] 利用規約・プライバシーポリシーの課金対応 (アプリ内表示・デプロイ済み)
- [x] ビルド 1.0(1) を ASC にアップロード済み
- [x] メタデータ・価格・App Privacy・年齢制限・審査メモ 入力済み (§2〜§4)
- [x] iPad 13" スクショ (2064×2752) 生成済み → `screenshots/ipad13-{ja,en}/`

## 1. Mac: ビルド → 実機確認 → アップロード

```bash
# Node は 22 を推奨 (.nvmrc あり)。v20 でも大抵動くが @capacitor/cli が警告を出す
cd poker-icm-app && git pull
npm install && npm run build && npx cap sync ios && npx cap open ios
```

- [ ] Xcode: デバイス=自分のiPhone / Signing & Capabilities で Team 選択 / ▶ Run
- [ ] sandbox テスト (ASC → ユーザとアクセス → Sandboxテスターを作成し、
      iPhone の 設定 → App Store → サンドボックスアカウント にログイン):
  - [ ] スタック編集タップ → ペイウォールに **¥3,480** が表示される
  - [ ] 購入 → ロック解除 / アプリ再起動後も Pro のまま
  - [ ] アプリ削除 → 再インストール → 「購入を復元」で Pro に戻る
  - [ ] RevenueCat ダッシュボードに購入イベントが記録される
- [ ] Xcode: デバイスを「Any iOS Device (arm64)」→ Product > Archive → Distribute App → App Store Connect にアップロード

## 2. ASC: メタデータ入力 (スマホからでも可)

`APP_STORE_LISTING.md` の該当セクションからコピペ:

- [ ] アプリ名: **Poker ICM — バブルを制する練習帳** (§1 案1) / 英語名: **Poker ICM — ICM/BF Trainer**
- [ ] サブタイトル: **ICM/BFを計算・練習 完全オフライン** / EN: **Practice ICM calls, offline**
- [ ] 説明文 (§2 日本語・英語) ※「オフライン設計」「無料版と Pro」段落を含む最新版
- [ ] キーワード (§3) / プロモーションテキスト (§4)
- [ ] スクリーンショット 6.7インチ: 受領済み zip の 7枚をアップロード
- [ ] App Review 情報 → 審査ノート (§5 英語)
- [ ] **審査用に IAP を追加**: バージョンページ下部の「App内課金」欄で `pro_lifetime` を選択
      (非消耗型の初回はアプリ審査と同時提出が必須)

## 3. ASC: App Privacy (§6 の新しい回答で!)

- [ ] 「データを収集しますか?」→ **はい**
- [ ] **Purchases → Purchase History**: App Functionality / ユーザーと紐付け **なし** / トラッキング **なし**
- [ ] **Identifiers → User ID**: App Functionality / 紐付け **なし** / トラッキング **なし**
- [ ] 上記2つ以外のカテゴリはすべて「収集なし」

※ 旧案の「データ収集なし (Data Not Collected)」は RevenueCat 導入前の回答。使わないこと。

## 4. ASC: 年齢制限 (§7)

- [ ] Simulated Gambling (模擬ギャンブル): **Infrequent/Mild (まれ/軽度)**
- [ ] その他の項目: すべて None → 想定レーティング 12+ (地域により 17+)

## 5. 提出前の事務 (未完了のもの)

- [ ] **ゆうちょ銀行の振込エラー解消** (ASC → 契約/税金/口座情報)。未解決だと売上を受け取れない
- [ ] RevenueCat の確認メールをクリック

## 6. 提出

- [ ] ビルドをバージョンに添付 → 審査へ提出
- [ ] 審査ステータスはメール通知。リジェクト時は本文を Claude に貼れば対応案を出します

## 7.5 スクリーンショットの作り直し

`playground/e2e/store-screenshots.mjs` が全画面を撮り直す。乱数は seed 固定なので
同じビルドなら何度実行しても同じ画像が出る。

```bash
npm install && npm run build
cd playground
node e2e/store-screenshots.mjs --device ipad13   --lang ja --out ../screenshots/ipad13-ja
node e2e/store-screenshots.mjs --device ipad13   --lang en --out ../screenshots/ipad13-en
node e2e/store-screenshots.mjs --device iphone67 --lang ja --out ../screenshots/iphone67-ja
```

出力は 6 枚。`01`〜`05` がストア掲載用 (`APP_STORE_LISTING.md` §8 の構成案に対応)、
`06-paywall.png` は IAP の「審査に関する情報」用。

- サイズは viewport × deviceScaleFactor で作る (iPad13 = 1032×1376 @2x = 2064×2752)。
  ASC は 1px でも違うと弾くので、`--device` の定義を勝手に変えないこと。
- `06` は `window.webkit.messageHandlers.bridge` を注入してネイティブ判定を通し、
  実機と同じ「Proにアップグレード / 購入を復元」入りのシートを撮っている。
  `window.Capacitor` を差し替えるだけでは足りない (@capacitor/core が後から上書きする)。
- `06` の価格 `¥3,480` はスクリプト内の `STORE_PRICE` 定数。実機では RevenueCat の
  `product.priceString` が入る位置。ASC 側で価格を変えたらこの定数も直す。

## 8. 残作業: iPad スクショ登録 → 審査用に追加 → 提出

`scripts/asc-submit.mjs` が App Store Connect API を叩く (依存パッケージなし)。
**Mac 側で実行すること** — Claude Code on the web のコンテナからは
`api.appstoreconnect.apple.com` が egress ポリシーで遮断されていて到達できない。

```bash
export ASC_KEY_PATH=~/Downloads/AuthKey_XUG3J47FGA.p8   # ASC の .p8 秘密鍵

node scripts/asc-submit.mjs status                      # まず現状確認
node scripts/asc-submit.mjs upload-screenshots --dir screenshots/ipad13-ja --locale ja
node scripts/asc-submit.mjs upload-screenshots --dir screenshots/ipad13-en --locale en-US
node scripts/asc-submit.mjs upload-iap-screenshot --file screenshots/ipad13-ja/06-paywall.png
node scripts/asc-submit.mjs prepare-submission          # 「審査用に追加」まで
```

- [ ] `status` で iPad13 未登録のロケールを確認 (en-US が無ければ ja だけでよい)
- [ ] `upload-screenshots` を必要なロケール分だけ実行
- [ ] `upload-iap-screenshot` で `pro_lifetime` の審査用スクショを登録
- [ ] `prepare-submission` でバージョン 1.0 と IAP を審査サブミッションに載せる
- [ ] **ASC の画面で内容を確認して「審査へ提出」を押す** (スクリプトは提出しない)

`.p8` は再ダウンロードできない。無ければ ASC → ユーザとアクセス → 統合 →
App Store Connect API で再発行し、`KEY_ID` を `scripts/asc-submit.mjs` 側も直す。

## 7. 承認後

- [ ] 公開 → `ANNOUNCEMENT_DRAFT.md` の告知 (App Store 版) を投稿
- [ ] RevenueCat / ASC の売上ダッシュボードを確認
