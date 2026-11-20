// ===== iOS 触覚フィードバック (@capacitor/haptics) =====
//
// iOS アプリ内 (Capacitor ネイティブ) でのみ軽い触覚を鳴らす。
// 重要: @capacitor/haptics は静的 import せず、isCapacitorNative() ガードの内側で
// dynamic import する (通常ブラウザ・テスト環境にネイティブ依存を持ち込まないため)。
// 失敗時 (シミュレーター・未対応端末) は黙って無視し、画面の操作を絶対に止めない。
import { isCapacitorNative } from "./capacitorEnv.js";

type HapticsModule = typeof import("@capacitor/haptics");

let cachedModule: Promise<HapticsModule> | null = null;

function loadHaptics(): Promise<HapticsModule> | null {
  if (!isCapacitorNative()) return null;
  if (!cachedModule) {
    cachedModule = import("@capacitor/haptics").catch((err) => {
      cachedModule = null;
      throw err;
    });
  }
  return cachedModule;
}

/**
 * 軽い選択のクリック感 (タブ切替・ハンド表セル選択・レンジ目安・バウンティ形式など)。
 * Capacitor の iOS 実装 (Haptics.swift) は selectionStart() で UISelectionFeedbackGenerator を
 * 生成したあとでなければ selectionChanged() が鳴らないため、start → changed → end を順に行う。
 */
export function hapticSelection(): void {
  const mod = loadHaptics();
  if (!mod) return;
  void mod
    .then(async ({ Haptics }) => {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    })
    .catch(() => undefined);
}

/** 軽いタップ感 (役割切替・自分⇄相手・追加/削除・ランダム・元に戻す・プリセット適用など)。 */
export function hapticLight(): void {
  const mod = loadHaptics();
  if (!mod) return;
  void mod
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => undefined);
}

/** 完了の通知感 (局面・賞金の保存、Pro 購入・復元の成功時)。 */
export function hapticSuccess(): void {
  const mod = loadHaptics();
  if (!mod) return;
  void mod
    .then(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success }))
    .catch(() => undefined);
}
