// ===== IAP (アプリ内課金 / RevenueCat) 設定 =====
//
// 買い切り Pro (non-consumable) を RevenueCat 経由で提供するための静的設定。
// ここに実キーやエンタイトルメント ID を集約し、entitlement.ts / paywall.ts は
// これを参照するだけにする (設定変更をこの 1 ファイルに閉じ込める)。
//
// キーの貼り方・ストア連携の手順は docs/IAP_SETUP.md を参照。

/**
 * RevenueCat の iOS 用「公開 SDK キー」(appl_ で始まる文字列)。
 *
 * 空文字のあいだは IAP 未設定とみなし、RevenueCat SDK を一切初期化しない
 * (dynamic import も走らない)。ユーザーが RevenueCat ダッシュボードで取得した
 * appl_xxxxxxxx をここに貼ると、ネイティブ (iOS) で実 IAP が有効になる。
 *
 * 注意: これは公開 (public) SDK キーであり、クライアントに埋め込む前提の値。
 * シークレットキー (sk_...) は絶対にここに置かないこと。
 */
export const REVENUECAT_IOS_API_KEY = "appl_tAUhYwPoQmFHKrAOYqRgcoUJzCl";

/**
 * Pro 権限を表す RevenueCat の entitlement 識別子。
 * RevenueCat ダッシュボードの Entitlements で作成した ID と一致させること。
 */
export const PRO_ENTITLEMENT_ID = "pro";

/**
 * IAP (RevenueCat) が設定済みか。
 * 公開 SDK キーが空でなければ設定済みとみなす。
 * これが false のあいだはネイティブでも実購入フローを起動せず、
 * 従来どおり「準備中」トーストのままにする。
 */
export function isIapConfigured(): boolean {
  return REVENUECAT_IOS_API_KEY.trim().length > 0;
}
