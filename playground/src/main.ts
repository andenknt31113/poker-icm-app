import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/jetbrains-mono/latin-700.css";

// ===== 共有状態・基盤 (import するだけで players / payouts / DOM 参照が初期化される) =====
import "./appState.js";
import "./domRefs.js";
import { applyStaticTranslations } from "./i18n.js";
import { initLangToggle } from "./langToggle.js";
import { initNumberInputAutoSelect } from "./dom.js";

// ===== 各機能モジュール =====
import { initSetup, renderPlayers, refreshProGatedUi } from "./setup.js";
import { initEntitlements, onEntitlementChange } from "./entitlement.js";
import { initCalculator, recompute } from "./calculator.js";
import { initHandRange } from "./handRange.js";
import { initNashUI } from "./nashUI.js";
import { initTabs, applyTab, getActiveTab } from "./tabs.js";
import { initPwa } from "./pwa.js";
import { initGuide, isOnboardingDone, openOnboardingModal } from "./guide.js";
import { initPracticeInteractions } from "./practice/interactions.js";
import { initReview } from "./practice/review.js";
import { initProgress } from "./practice/progress.js";

// ===== 初期化 (元 main.ts の実行順を踏襲) =====
// 静的 DOM の文言を辞書から適用する。各 init より前に実行することで、
// footer のビルドSHA追記 (initPwa) など JS 側の後処理がその上に乗る。
applyStaticTranslations();
initLangToggle();

initNumberInputAutoSelect();
initSetup();
initCalculator();
initHandRange(recompute);
initNashUI();
initTabs();
initPwa();
initGuide();
initPracticeInteractions();
initReview();
initProgress();

// ===== 課金 (RevenueCat) の初期化 =====
// Pro 権限が確定/変化したら freemium ロックの見た目を再描画し、計算も更新する。
// initEntitlements は await しない (ネットワーク待ちで初期描画をブロックしない)。
// web / IAP 未設定では initEntitlements は即 return するため実質ノーオペ。
onEntitlementChange(() => {
  refreshProGatedUi();
  recompute();
});
void initEntitlements();

// ===== 初期描画 =====
applyTab(getActiveTab());
renderPlayers();
recompute();

// 初回訪問時のみオンボーディングを表示（2回目以降は poker-icm-onboarding-done により出さない）
if (!isOnboardingDone()) {
  openOnboardingModal();
}
