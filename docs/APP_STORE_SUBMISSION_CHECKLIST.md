# App Store 提出チェックリスト (このまま上から実行)

最終更新: 2026-07-23。素材の本文は `APP_STORE_LISTING.md`、ビルド手順の詳細は
`APP_STORE_BUILD.md` を参照。ここは「提出当日に上から順に潰す」ための実行リスト。

## 0. 済んでいるもの (再作業不要)

- [x] ASC アプリレコード「Poker ICM」作成 (Bundle ID `dev.workers.andenknt31113.pokericm`)
- [x] IAP `pro_lifetime` (非消耗型, ¥3,480) 作成・表示名/説明 日英登録
- [x] App用共有シークレット発行 → RevenueCat に登録済み
- [x] RevenueCat: プロジェクト / entitlement `pro` / offering `default` (current) / In-App Purchase Key
- [x] アプリに公開 SDK キー組み込み済み (`playground/src/iapConfig.ts`)
- [x] スクリーンショット 7枚 (1290×2796) 生成済み (チャットで受領した zip)
- [x] 利用規約・プライバシーポリシーの課金対応 (アプリ内表示・デプロイ済み)

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

## 7. 承認後

- [ ] 公開 → `ANNOUNCEMENT_DRAFT.md` の告知 (App Store 版) を投稿
- [ ] RevenueCat / ASC の売上ダッシュボードを確認
