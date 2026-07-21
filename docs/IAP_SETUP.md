# アプリ内課金 (買い切り Pro) セットアップ手順

このアプリの Pro は「買い切り (non-consumable) のアプリ内課金 (IAP)」で提供します。
決済は Apple (App Store)、権限管理は [RevenueCat](https://www.revenuecat.com/) を使います。
価格は App Store Connect 側で設定し、アプリは RevenueCat の offering から
価格文字列を動的に取得して表示します(アプリ内に価格をハードコードしません)。

対象読者: Mac と App Store Connect アカウントを持ち、RevenueCat はこれから登録する方。
所要時間の目安: 30〜60 分(審査待ちを除く)。

---

## 全体の流れ

1. App Store Connect で non-consumable の IAP を作成する
2. RevenueCat プロジェクトを作り、iOS アプリと App Store を連携する
3. RevenueCat で entitlement `pro` と offering を設定する
4. RevenueCat の公開 SDK キー (`appl_...`) を `iapConfig.ts` に貼る
5. sandbox テスターで購入・復元を実機確認する

---

## 1. App Store Connect で IAP を作成する

1. [App Store Connect](https://appstoreconnect.apple.com/) → 対象アプリ →
   「App内課金 (In-App Purchases)」→「+」。
2. 種別は **非消耗型 (Non-Consumable)** を選ぶ。
3. 設定値の例:
   - **参照名 (Reference Name)**: `Pro Lifetime`(社内用の名前。ユーザーには出ない)
   - **製品 ID (Product ID)**: `pro_lifetime`
     - 一度作ると変更できません。逆ドメイン形式(例 `dev.workers.andenknt31113.pokericm.pro_lifetime`)でも構いません。
     - ここで決めた製品 ID は後で RevenueCat の Product 登録に使います。
   - **価格**: 希望の価格帯 (Price Tier) を選ぶ。各国の実売価格は Apple が自動換算します。
   - **表示名 / 説明**: ローカライズ。日本語・英語の両方を入れておくと審査がスムーズ。
4. スクリーンショット(審査用のレビュー用スクショ)を 1 枚添付する。
5. ステータスが「提出準備完了 (Ready to Submit)」になれば OK。
   - 単体では審査に出せません。**アプリのバージョン審査と同時に**初回審査されます。
   - sandbox テストは審査前でも可能です(手順 5)。

> メモ: **App用共有シークレット (App-Specific Shared Secret)** を
> 「App情報 → App内課金」から発行しておきます。手順 2 で RevenueCat に登録します。

---

## 2. RevenueCat プロジェクトを作る

1. [RevenueCat](https://app.revenuecat.com/) にサインアップしてログイン。
2. **Create new project**(プロジェクト名は任意、例 `Poker ICM`)。
3. プロジェクトに **App** を追加:
   - Platform は **App Store**(iOS)を選ぶ。
   - **App Bundle ID**: `dev.workers.andenknt31113.pokericm`
     (このリポジトリの `capacitor.config.ts` の `appId` と一致させること)。
   - **App-Specific Shared Secret**: 手順 1 で発行した共有シークレットを貼る
     (購入レシート検証に使われます)。
   - 必要に応じて App Store Connect API キー (P8) を登録すると、製品情報の
     取り込みが自動化されます(任意)。

---

## 3. Product / Entitlement / Offering を設定する

RevenueCat では 3 つの概念を紐付けます。

### 3-1. Product(ストアの製品を取り込む)

- 左メニュー **Product catalog → Products → New**。
- **Store**: App Store、**Identifier**: 手順 1 の製品 ID(例 `pro_lifetime`)。
- App Store Connect と連携済みなら候補から選べます。

### 3-2. Entitlement(アプリ内の権限)

- **Product catalog → Entitlements → New**。
- **Identifier**: `pro`
  - **この文字列はアプリ側の `PRO_ENTITLEMENT_ID` と完全一致させること**
    (`playground/src/iapConfig.ts`。デフォルトで `"pro"`)。
- 作成した entitlement に、手順 3-1 の Product を **Attach** する。

### 3-3. Offering(アプリに出す売り物のまとまり)

- **Product catalog → Offerings → New**。
- Offering を 1 つ作り、**Default(current)** に設定する。
  - アプリは `getOfferings()` の `current` を参照します。
- その Offering に **Package** を追加し、手順 3-1 の Product を紐付ける。
  - 買い切りなので **Lifetime** パッケージにするのが分かりやすい
    (アプリは `current.lifetime` を優先し、無ければ先頭パッケージを使います)。

---

## 4. 公開 SDK キーをアプリに貼る

1. RevenueCat の **Project settings → API keys**(または App の設定画面)を開く。
2. **App Store 用の Public SDK Key**(`appl_` で始まる文字列)をコピーする。
   - **Public(公開)キーを使うこと。** シークレットキー `sk_...` は絶対にアプリへ入れない。
3. `playground/src/iapConfig.ts` を開き、次のように貼り付ける:

   ```ts
   export const REVENUECAT_IOS_API_KEY = "appl_xxxxxxxxxxxxxxxxxxxx";
   ```

   - `PRO_ENTITLEMENT_ID` は手順 3-2 の entitlement ID(既定 `"pro"`)と一致させる。
   - キーが空文字のあいだは IAP は無効(ペイウォールのボタンは「準備中」表示のまま)で、
     キーを入れると自動的に実購入フローが有効になります。
4. 反映してネイティブへ同期:

   ```bash
   npm run build
   npx cap sync ios
   npx cap open ios   # Xcode が開く
   ```

> 補足: 公開 SDK キーはクライアントに埋め込む前提の値なので、リポジトリにコミット
> しても運用上は問題ありません(不安なら別途 Xcode の xcconfig や環境変数へ
> 逃がす運用にしても構いませんが、本アプリの現状は `iapConfig.ts` 直書きです)。

---

## 5. sandbox テスターで動作確認する

1. App Store Connect → **ユーザーとアクセス → Sandbox → テスター** で、
   本番と別のメールアドレスの sandbox テスターを作成する。
2. Xcode で実機(または StoreKit 対応シミュレータ)にビルドして起動。
   - 実機の場合、iOS の「設定 → App Store → Sandbox アカウント」で sandbox
     テスターにサインインしておくと確実です。
3. アプリでロックされた操作(スタック編集・シナリオ保存など)を触り、
   ペイウォールを開く。
   - 価格欄に App Store Connect で設定した価格が表示されれば offering 連携 OK。
     ("—" のままなら offering / entitlement / キーの紐付けを見直す)。
4. **「Pro にアップグレード」** をタップ → sandbox の購入ダイアログ →
   購入完了でモーダルが閉じ「Pro にアップグレードしました」トーストが出て、
   ロックが解除されることを確認する。
5. アプリ再インストール後などに **「購入を復元」** をタップ →
   「購入を復元しました」トースト+ロック解除を確認する。
   - 未購入アカウントで復元すると「復元できる購入が見つかりませんでした」が出れば正常。

---

## トラブルシューティング

| 症状 | 確認ポイント |
| --- | --- |
| ペイウォールのボタンが「準備中」のまま | `REVENUECAT_IOS_API_KEY` が空。キーを貼って `npm run build && npx cap sync ios`。 |
| 価格が "—" のまま | Offering が current に設定されているか / Package に Product が紐付いているか / Product が App Store Connect で「提出準備完了」か。 |
| 購入は通るが Pro にならない | Entitlement ID がアプリの `PRO_ENTITLEMENT_ID`(既定 `pro`)と一致しているか / Product が entitlement に attach されているか。 |
| sandbox で購入ダイアログが出ない | Bundle ID の一致、共有シークレットの登録、sandbox アカウントのサインインを確認。 |
| 復元で見つからない | 同じ sandbox アカウントで購入済みか。別アカウントでは復元されません。 |

---

## 参考リンク

- RevenueCat iOS / Capacitor ドキュメント: https://www.revenuecat.com/docs/getting-started/installation/capacitor
- Apple 「非消耗型App内課金の作成」: https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-in-app-purchases
