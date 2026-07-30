// ===== localStorage アクセスの共通層 =====
//
// このモジュールは「永続化キーの一覧」と「例外を出さない read/write」だけを持つ、
// 依存ゼロの最下層モジュール。DOM には触れないため、素の Node (vitest) からも
// import できる。
//
// なぜ層を作るか:
//   1. localStorage は Safari プライベートモードや容量超過で getItem/setItem 自体が
//      throw する。従来は各モジュールが個別に try/catch していて (全 12 モジュール・
//      約 40 箇所)、抜けても気づけなかった。ここを通せば全経路が安全になる。
//   2. 永続化キーは「既存ユーザーのデータ互換」を壊せない資産。散在した文字列
//      リテラルではなく STORAGE_KEYS 1 か所に集約し、うっかり改名できないようにする。
//
// 重要: STORAGE_KEYS の値 (キー文字列) は絶対に変更しないこと。
// 変更すると既存ユーザーの保存データ (シナリオ・成績・購入キャッシュ等) が
// 読めなくなる。キーの追加はよいが、既存キーの改名・削除は破壊的変更。

/**
 * アプリが使う localStorage キーの単一情報源。
 * すべて "poker-icm-" プレフィックス付き (他アプリとの衝突回避)。
 */
export const STORAGE_KEYS = {
  /** シナリオ本体 (プレイヤー・ペイ・Nash パラメータ) の永続化。 */
  appState: "poker-icm-app-state-v1",
  /** 最後に開いていたタブ。 */
  activeTab: "poker-icm-active-tab",
  /** UI 言語 ("ja" | "en")。 */
  lang: "poker-icm-lang",
  /** Hero サマリーカードの折りたたみ状態。 */
  heroSummaryCollapsed: "poker-icm-hero-summary-collapsed",
  /** 初回オンボーディングを一度でも閉じたか。 */
  onboardingDone: "poker-icm-onboarding-done",
  /** 初回ヒントバーを ✕ で閉じたか。 */
  firstHintDismissed: "poker-icm-first-hint-dismissed",
  /** ハンド比較タブのカスタム villain レンジ。 */
  customRange: "poker-icm-custom-range",
  /** ユーザー定義シナリオ (名前付きスナップショット) の一覧。 */
  userScenarios: "poker-icm-user-scenarios",
  /** 保存済みペイ構造プリセットの一覧。 */
  savedPayouts: "poker-icm-saved-payouts",
  /** シナリオプリセットカードの details 開閉状態。 */
  collapseScenarioPresets: "poker-icm-collapse-scenario-presets",
  /** ペイ構造プリセットカードの details 開閉状態。 */
  collapsePayoutPresets: "poker-icm-collapse-payout-presets",
  /** iOS ホーム画面追加ヒントを閉じたか。 */
  iosInstallHint: "poker-icm-ios-install-hint",
  /** 開発/E2E 用の Pro 裏口フラグ。 */
  pro: "poker-icm-pro",
  /** RevenueCat 由来 Pro 判定のオフラインキャッシュ。 */
  proRcCache: "poker-icm-pro-rc",
  /** 導入コース (固定5問) を修了したか。 */
  tutorialDone: "poker-icm-tutorial-done",
  /** 練習の難易度設定。 */
  practiceDifficulty: "poker-icm-practice-diff",
  /** 練習の出題モード設定。 */
  practiceMode: "poker-icm-practice-mode",
  /** 練習の連続正解数。 */
  practiceStreak: "poker-icm-practice-streak",
  /** 練習の通算成績 (total / correct)。 */
  practiceStats: "poker-icm-practice-stats",
  /** 間違えた問題の復習リスト。 */
  practiceReview: "poker-icm-practice-review",
  /** 練習の解答履歴 (成績の推移グラフ用)。 */
  practiceHistory: "poker-icm-practice-history",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// ===== 生の read / write (例外を飲み込む) =====

/**
 * 文字列として読む。localStorage が使えない環境・未設定キーでは null。
 * (localStorage 自体が存在しない素の Node でも安全。)
 */
export function readRaw(key: StorageKey): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 文字列として書く。quota 超過・プライベートモード等の失敗は無視する。 */
export function writeRaw(key: StorageKey, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / プライベートモード等は無視 (永続化は best-effort) */
  }
}

/** キーを削除する。失敗は無視する。 */
export function removeRaw(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 同上 */
  }
}

// ===== 真偽フラグ ("1" / "0" 表現) =====

/**
 * 真偽フラグを読む。"1" のときだけ true (未設定・不正値・読み取り失敗は false)。
 * 「一度やったか」系のフラグ (オンボーディング済み等) で使う既存表現。
 */
export function readFlag(key: StorageKey): boolean {
  return readRaw(key) === "1";
}

/** 真偽フラグを "1" / "0" で書く。 */
export function writeFlag(key: StorageKey, value: boolean): void {
  writeRaw(key, value ? "1" : "0");
}

// ===== JSON =====

/**
 * JSON として読み、検証を通ったときだけ返す。
 * パース失敗・検証不合格・読み取り失敗はすべて fallback を返す
 * (壊れた保存データで画面が落ちないための共通の防御)。
 */
export function readJson<T>(
  key: StorageKey,
  fallback: T,
  validate: (v: unknown) => v is T,
): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** JSON として書く。シリアライズ失敗・quota 超過は無視する。 */
export function writeJson(key: StorageKey, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    /* 循環参照等のシリアライズ失敗は無視 */
  }
}
