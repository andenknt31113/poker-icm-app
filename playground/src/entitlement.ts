// ===== EntitlementService (freemium ゲートの判定を一元化) =====
//
// このモジュールは「ユーザーが Pro 権限を持つか」の判定を 1 か所に集約する。
// UI 各所 (setup.ts のロック処理・paywall.ts) は必ず isPro() を経由し、
// localStorage キーを直接見ないこと。判定ロジックを差し替えるのはここだけで済む。
//
// --- Phase 1 (現在): localStorage の裏口のみ ---
//   localStorage["poker-icm-pro"] === "1" のとき Pro とみなす。
//   これは開発/E2E テスト用の裏口であり、UI からは設定できない
//   (どこにもトグルを置かない)。実ユーザーは常に無料状態で始まる。
//
// --- Phase 3 (将来): Capacitor + RevenueCat 接続 ---
//   ネイティブ (iOS/Android) では @capacitor 経由で RevenueCat SDK を初期化し、
//   購入状態 (entitlements.active["pro"]) をここに橋渡しする。具体的には
//   RevenueCat の customerInfo 更新リスナーで内部フラグを更新し、
//   isPro() がそのフラグ (localStorage 裏口との OR) を返すように拡張する。
//   購入/復元が成立したら notifyEntitlementChange() を呼んで購読者へ通知する。
//   この差し替えで setup.ts / paywall.ts 側は無変更で済む設計にしてある。

const PRO_KEY = "poker-icm-pro";

/**
 * ユーザーが Pro 権限を持つか。freemium ロックの唯一の判定関数。
 * Phase 1 実装: localStorage["poker-icm-pro"] === "1" (開発/テスト用の裏口)。
 */
export function isPro(): boolean {
  try {
    return localStorage.getItem(PRO_KEY) === "1";
  } catch {
    // localStorage 不可環境 (プライベートモード等) では無料扱い。
    return false;
  }
}

// ===== 権限変更の購読機構 (Phase 3 用。Phase 1 では未使用可) =====
const entitlementChangeCbs = new Set<(pro: boolean) => void>();

/**
 * Pro 権限の変化を購読する。RevenueCat 接続後 (Phase 3) に、購入/復元の完了で
 * 呼ばれて UI を再描画するために使う。戻り値は購読解除関数。
 */
export function onEntitlementChange(cb: (pro: boolean) => void): () => void {
  entitlementChangeCbs.add(cb);
  return () => entitlementChangeCbs.delete(cb);
}

/**
 * 権限変更を購読者へ通知する (Phase 3: RevenueCat の customerInfo 更新時に呼ぶ)。
 * Phase 1 では localStorage の裏口を UI から変更しないため呼び出し箇所は無い。
 */
export function notifyEntitlementChange(): void {
  const pro = isPro();
  for (const cb of entitlementChangeCbs) cb(pro);
}
