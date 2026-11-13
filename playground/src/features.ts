// ===== 画面に出す機能の切替 =====
import { STORAGE_KEYS, readFlag } from "./storage.js";

/**
 * 練習タブを画面に出すか。
 *
 * 2026-11-13: 計算 1 画面に絞るため、既定では出さない (機能とデータは残してある)。
 * localStorage の "poker-icm-practice-enabled" が "1" のときだけ表示する。
 * 既定で戻したくなったら、ここで true を返すようにすればよい。
 */
export function isPracticeEnabled(): boolean {
  return readFlag(STORAGE_KEYS.practiceEnabled);
}
