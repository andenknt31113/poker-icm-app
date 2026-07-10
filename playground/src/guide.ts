import { applyTab, getActiveTab } from "./tabs.js";

// ===== オンボーディング（初回ガイド）& 使い方ガイド =====
const ONBOARDING_DONE_KEY = "poker-icm-onboarding-done";
const FIRST_HINT_DISMISSED_KEY = "poker-icm-first-hint-dismissed";

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}
function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}
function isFirstHintDismissed(): boolean {
  try {
    return localStorage.getItem(FIRST_HINT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}
function markFirstHintDismissed(): void {
  try {
    localStorage.setItem(FIRST_HINT_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

// 初回ヒントバーを出すかどうかは起動時点で確定させる。
// オンボーディング未完了 (= まだ一度も閉じていない) の間はずっと true になり、
// 完了直後の同一セッションでも引き続き表示される。次回起動時は done フラグにより非表示。
const shouldShowFirstHint = !isOnboardingDone() && !isFirstHintDismissed();

const ONBOARDING_STEPS: { title: string; body: string }[] = [
  {
    title: "🎰 これは何？",
    body: `
      <p>
        トーナメントの「チップ枚数」と「賞金への価値」は同じではありません。
        本ツールはこの <strong>ICM プレッシャー</strong>を、数字で『計算』しながら
        クイズで『練習』もできる無料アプリです。
      </p>
      <ul class="onboarding-tab-list">
        <li><span class="onboarding-tab-icon">⚙️</span> 状況入力（スタック・ペイアウトなど）</li>
        <li><span class="onboarding-tab-icon">📊</span> 計算結果（ICM・BF・必要勝率）</li>
        <li><span class="onboarding-tab-icon">🃏</span> レンジ比較</li>
        <li><span class="onboarding-tab-icon">🎯</span> Nash 均衡（push/fold の最適解）</li>
        <li><span class="onboarding-tab-icon">🎲</span> 練習（クイズで実戦感覚）</li>
      </ul>
    `,
  },
  {
    title: "⚡ まず触ってみる",
    body: `
      <p>おすすめの入り口は2つあります。</p>
      <ol>
        <li>
          <strong>⚙️ セットアップ</strong>で<strong>シナリオプリセット</strong>をタップ →
          <strong>📊 計算結果</strong>で ICM / BF をすぐ確認する
        </li>
        <li>
          <strong>🎲 練習</strong>タブでクイズに答えながら感覚を掴む
        </li>
      </ol>
      <p class="hint">どちらから始めても OK。行き来しながら覚えられます。</p>
    `,
  },
  {
    title: "📖 困ったら",
    body: `
      <p>
        ヘッダー右上の <strong>❓</strong> ボタンから、いつでもこの使い方ガイドと
        ICM / Bubble Factor などの用語解説を開けます。
      </p>
      <p class="hint">さっそく始めましょう。</p>
    `,
  },
];

let onboardingStep = 0;
let onboardingModalEl: HTMLDivElement | null = null;

function ensureOnboardingModal(): HTMLDivElement {
  if (onboardingModalEl) return onboardingModalEl;
  const modal = document.createElement("div");
  modal.id = "onboarding-modal";
  modal.className = "onboarding-modal hidden";
  modal.innerHTML = `
    <div class="onboarding-modal-content">
      <div class="onboarding-modal-header">
        <h3 id="onboarding-title"></h3>
        <button type="button" class="onboarding-skip" id="onboarding-skip">スキップ</button>
      </div>
      <div class="onboarding-modal-body" id="onboarding-body"></div>
      <div class="onboarding-modal-footer">
        <div class="onboarding-dots" id="onboarding-dots"></div>
        <div id="onboarding-footer-actions"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeOnboardingModal();
  });
  modal.querySelector("#onboarding-skip")?.addEventListener("click", () => {
    closeOnboardingModal();
  });
  onboardingModalEl = modal;
  return modal;
}

function renderOnboardingStep(): void {
  const modal = ensureOnboardingModal();
  const step = ONBOARDING_STEPS[onboardingStep];
  if (!step) return;
  const title = modal.querySelector("#onboarding-title");
  const body = modal.querySelector("#onboarding-body");
  const dots = modal.querySelector("#onboarding-dots");
  const footerActions = modal.querySelector("#onboarding-footer-actions");
  if (title) title.textContent = step.title;
  if (body) body.innerHTML = step.body;
  if (dots) {
    dots.innerHTML = ONBOARDING_STEPS.map(
      (_, i) => `<span class="onboarding-dot${i === onboardingStep ? " active" : ""}"></span>`,
    ).join("");
  }
  if (footerActions) {
    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
      footerActions.innerHTML = `<button type="button" class="solve-btn onboarding-next-btn" id="onboarding-next-btn">次へ →</button>`;
      footerActions.querySelector("#onboarding-next-btn")?.addEventListener("click", () => {
        onboardingStep++;
        renderOnboardingStep();
      });
    } else {
      footerActions.innerHTML = `
        <div class="onboarding-cta-row">
          <button type="button" class="solve-btn" id="onboarding-cta-practice">🎲 練習を始める</button>
          <button type="button" class="solve-btn" id="onboarding-cta-setup" style="background: var(--card); color: var(--text); border: 1px solid var(--border);">⚙️ 自分で設定する</button>
        </div>
      `;
      footerActions.querySelector("#onboarding-cta-practice")?.addEventListener("click", () => {
        closeOnboardingModal();
        applyTab("practice");
      });
      footerActions.querySelector("#onboarding-cta-setup")?.addEventListener("click", () => {
        closeOnboardingModal();
      });
    }
  }
}

export function openOnboardingModal(): void {
  onboardingStep = 0;
  const modal = ensureOnboardingModal();
  renderOnboardingStep();
  modal.classList.remove("hidden");
}

function closeOnboardingModal(): void {
  onboardingModalEl?.classList.add("hidden");
  markOnboardingDone();
}

// ===== 使い方ガイド（❓ ボタン、常設） =====
let guideModalEl: HTMLDivElement | null = null;

function ensureGuideModal(): HTMLDivElement {
  if (guideModalEl) return guideModalEl;
  const modal = document.createElement("div");
  modal.id = "guide-modal";
  modal.className = "guide-modal hidden";
  modal.innerHTML = `
    <div class="guide-modal-content">
      <div class="guide-modal-header">
        <h3>📖 使い方ガイド</h3>
        <button type="button" class="guide-modal-close" id="guide-modal-close" aria-label="閉じる">✕</button>
      </div>
      <div class="guide-modal-body">
        <details class="howto">
          <summary>⚙️ セットアップ — できること・使い方</summary>
          <div class="howto-body">
            <p>プレイヤーのスタック、ペイ構造、🎯自分/⚔️相手を設定してシナリオを作る画面。</p>
            <ol>
              <li>「シナリオプリセット」をタップして状況を一発セット</li>
              <li>「プレイヤー」でスタックを調整（足りなければ + プレイヤー追加）</li>
              <li>🎯自分 / ⚔️相手 をタップで指定</li>
              <li>必要なら📝メモに気付きを残す</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>📊 計算結果 — できること・使い方</summary>
          <div class="howto-body">
            <p>ICM エクイティ、Bubble Factor、必要勝率 (cEV / $EV / RP) を自動計算する画面。</p>
            <ol>
              <li>⚙️で状況を入力（プリセットでも OK）</li>
              <li>「ICM エクイティ」表で各プレイヤーの $ 価値を確認</li>
              <li>「全員 vs 全員 BF マップ」で 🎯 vs ⚔️ のセルを確認</li>
              <li>「🎯⚔️ から自動算出」を押して必要勝率でコール判断</li>
              <li>「🃏 ハンド別判定」で相手レンジを選び、自分のハンドをタップして個別に call/fold を確認</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🃏 ハンド比較 — できること・使い方</summary>
          <div class="howto-body">
            <p>相手の push/call レンジと自分のレンジを Top X% やカスタム編集で比較する画面。</p>
            <ol>
              <li>「自分の call を逆算」か「自分の push を逆算」を選ぶ</li>
              <li>プリセットならスライダーで Top X% を調整、カスタムならグリッドのセルをタップして選択</li>
              <li>グリッドの色分けで自分がコール/プッシュすべきハンドを確認</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎯 ナッシュ均衡 — できること・使い方</summary>
          <div class="howto-body">
            <p>HU push/fold の Nash 均衡（ICM 反映済み）を計算する画面。</p>
            <ol>
              <li>⚙️で 🎯自分 (pusher) と ⚔️相手 (caller) を指定</li>
              <li>SB / BB / アンティ合計を設定</li>
              <li>「Nash 計算」を押す</li>
              <li>push レンジと call レンジのグリッドを見比べる</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎲 練習 — できること・使い方</summary>
          <div class="howto-body">
            <p>ランダムなシナリオでコール/フォールド判断や Risk Premium 当て、push 判定を練習できる画面。</p>
            <ol>
              <li>難易度を選んで「🎲 新しい問題」を押す</li>
              <li>相手の push 想定レンジと自分のハンドを見て ✅コール / ❌フォールドを判断（RP 当てモードはスライダーで数値回答、🚀push 判定モードでは自分 (SB) が 🚀オールイン / ❌フォールドかを判断）</li>
              <li>正誤と計算式を確認し、間違えたら 📚復習 リストで解き直す</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>📚 用語ミニ解説</summary>
          <div class="howto-body">
            <h4>ICM (Independent Chip Model)</h4>
            <p>
              トナメのチップは賞金と1:1では換算できません（<strong>チップ ≠ 賞金価値</strong>）。
              ICM はチップ構成を「今すぐ$に換金したらいくら？」に変換する定義です。
              例: ICM% が 25% なら、平均して総賞金の 1/4 を持っていける期待値ということ。
            </p>
            <h4>Bubble Factor (BF)</h4>
            <p>
              <strong>負けた時の痛み ÷ 勝った時の嬉しさ</strong>を表す係数。
              BF = 1.3 なら、cEV（チップ基準）より <strong>30% 余分にタイト</strong>に打つべきという意味です。
            </p>
            <h4>Risk Premium (RP)</h4>
            <p>
              cEV（チップだけで見た必要勝率）より<strong>何%余分に勝率が必要か</strong>を表す差分。
              ICM プレッシャーが強い場面ほど RP は大きくなります。
            </p>
            <h4>Nash 均衡</h4>
            <p>
              🎯push 側も ⚔️call 側も、片方だけ戦略を変えても得をしない
              「お互いに搾取されない」push/fold 戦略の組み合わせのことです。
            </p>
          </div>
        </details>
        <details class="howto">
          <summary>❓ 「Top X%」とは</summary>
          <div class="howto-body">
            <p>
              「Top X%」は本ツール独自のハンド強度ランキングに基づく上位 X% の簡易レンジです。
              Sklansky-Chubukov など他ツールのランキングとは前提（サンプル数・想定シナリオなど）が異なるため、
              <strong>同じ X% でも具体的なハンドの構成や数字が一致しない場合があります</strong>。
              あくまで傾向を掴むための目安としてご利用ください。
            </p>
          </div>
        </details>
        <button type="button" class="solve-btn guide-reopen-btn" id="guide-reopen-onboarding-btn">🔄 もう一度はじめのガイドを見る</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#guide-modal-close")?.addEventListener("click", closeGuideModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeGuideModal();
  });
  modal.querySelector("#guide-reopen-onboarding-btn")?.addEventListener("click", () => {
    closeGuideModal();
    openOnboardingModal();
  });
  guideModalEl = modal;
  return modal;
}

function openGuideModal(): void {
  ensureGuideModal().classList.remove("hidden");
}
function closeGuideModal(): void {
  guideModalEl?.classList.add("hidden");
}

// ===== 初回ヒントバー（セットアップタブ最上部、シナリオプリセットの上） =====
function insertFirstHintBar(): void {
  if (!shouldShowFirstHint) return;
  const firstSetupCard = document.querySelector('section.card[data-tab="setup"]');
  if (!firstSetupCard || !firstSetupCard.parentElement) return;
  const bar = document.createElement("div");
  bar.id = "first-hint-bar";
  bar.className = "first-hint-bar";
  bar.dataset.tab = "setup";
  bar.classList.toggle("hidden-tab", getActiveTab() !== "setup");
  const text = document.createElement("span");
  text.innerHTML =
    "👋 はじめてなら: <strong>プリセット</strong>をタップ → <strong>📊</strong>で結果を見る、か <strong>🎲</strong>で練習";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "first-hint-bar-close";
  closeBtn.setAttribute("aria-label", "閉じる");
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => {
    bar.remove();
    markFirstHintDismissed();
  });
  bar.appendChild(text);
  bar.appendChild(closeBtn);
  firstSetupCard.parentElement.insertBefore(bar, firstSetupCard);
}

/** ガイド関連 (❓ボタン・初回ヒントバー・Escape キー) の配線。main.ts から一度だけ呼ぶ。 */
export function initGuide(): void {
  document.getElementById("help-btn")?.addEventListener("click", openGuideModal);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (onboardingModalEl && !onboardingModalEl.classList.contains("hidden")) closeOnboardingModal();
    if (guideModalEl && !guideModalEl.classList.contains("hidden")) closeGuideModal();
  });

  insertFirstHintBar();
}
