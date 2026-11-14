// ===== Hero サマリーカード =====
// 画面上部に常設される「今の状況ひと目」カード。recompute() の計算結果を
// 受け取って描画するだけで、自分では計算しない。
import { $ } from "./dom.js";
import { t } from "./i18n.js";
import { players } from "./appState.js";
import { isOnboardingDone } from "./guide.js";
import { openInfoModal } from "./infoModal.js";
import { applyTab } from "./tabs.js";
import { setAnalysisView } from "./analysisView.js";
import type { RangeVerdictSummary } from "./handRange.js";

const heroSummaryEl = $<HTMLDivElement>("hero-summary");

// BF の色分け閾値。0.95 未満は有利 (緑)、1.05 超で注意 (黄)、1.15 超で危険 (赤)。
// 1.0 ちょうど付近 (0.95..1.05) は cEV とほぼ同じなので中立色 (accent) にする。
const BF_GOOD_BELOW = 0.95;
const BF_WARN_ABOVE = 1.05;
const BF_BAD_ABOVE = 1.15;

/** hero サマリーを非表示状態に戻す (計算エラー時・hero 未指定時)。 */
export function hideHeroSummary(): void {
  heroSummaryEl.classList.remove("active");
}

export interface HeroSummaryArg {
  heroIndex: number;
  villainIndex: number;
  stacks: number[];
  payouts: number[];
  heroEq: number;
  villainEq: number;
  totalPrize: number;
  bf: number;
  requiredEq: number;
  rp: number;
  rangeVerdict: RangeVerdictSummary;
}

// 一行判定で「ほぼ無し」表示に切り替えるコンボ%の下限。
const VERDICT_NONE_BELOW_PCT = 0.5;

/** 「結局コール(push)していいか」の一行判定 HTML。villain 未指定時は空文字。 */
function verdictLineHtml(hasVillain: boolean, v: RangeVerdictSummary): string {
  if (!hasVillain || v.available === false) return "";
  const none = v.heroPct < VERDICT_NONE_BELOW_PCT;
  const key =
    v.direction === "callBack"
      ? none
        ? "calc.summary.verdict.callNone"
        : "calc.summary.verdict.call"
      : none
        ? "calc.summary.verdict.pushNone"
        : "calc.summary.verdict.push";
  const text = t(key, {
    villain: v.villainPct.toFixed(0),
    hero: v.heroPct.toFixed(0),
  });
  return `
      <button type="button" class="hero-summary-verdict" id="hero-summary-verdict-btn">
        <span>${text}</span>
        <span class="hero-summary-verdict-link">${t("calc.summary.verdict.link")}</span>
      </button>`;
}

/** BF 値 → 色クラス。 */
function bfColorClass(bf: number): string {
  if (bf < BF_GOOD_BELOW) return "good";
  if (bf > BF_BAD_ABOVE) return "bad";
  if (bf > BF_WARN_ABOVE) return "warn";
  return "accent";
}

export function renderHeroSummary(a: HeroSummaryArg): void {
  if (a.heroIndex < 0) {
    hideHeroSummary();
    return;
  }
  heroSummaryEl.classList.add("active");
  const heroStack = a.stacks[a.heroIndex]!;
  const heroPos = players[a.heroIndex]?.position || "—";

  const hasVillain = a.villainIndex >= 0;
  const villainStack = hasVillain ? a.stacks[a.villainIndex]! : 0;
  const villainPos = hasVillain ? players[a.villainIndex]?.position || "—" : "—";

  const bfClass = bfColorClass(a.bf);
  const heroRole = a.rangeVerdict.direction === "callBack" ? "calc.summary.considerCall" : "calc.summary.considerPush";
  const villainRole = a.rangeVerdict.direction === "callBack" ? "calc.summary.allIn" : "calc.summary.assumedCall";

  // 局面は1行で: 相手 → 自分 (役割つき)。入力欄はこのカードのすぐ上にある。
  const villainRow = hasVillain
    ? `
      <div class="hero-summary-row villain">
        <span class="hero-summary-row-label">${t("calc.summary.villain")}</span>
        <span class="hero-summary-row-stat">${villainPos}<span class="hero-summary-row-stack"> ${villainStack}<span class="unit">BB</span></span></span>
        <span class="hero-summary-role">${t(villainRole)}</span>
      </div>`
    : `<div class="hero-summary-row villain muted-row">${t("calc.summary.villainUnset")}</div>`;
  const heroRow = `
      <div class="hero-summary-row hero">
        <span class="hero-summary-row-label">${t("calc.summary.hero")}</span>
        <span class="hero-summary-row-stat">${heroPos}<span class="hero-summary-row-stack"> ${heroStack}<span class="unit">BB</span></span></span>
        ${hasVillain ? `<span class="hero-summary-role">${t(heroRole)}</span>` : ""}
      </div>`;

  // 初回 (オンボーディング未完了) はサンプル局面が説明なく表示されるため、
  // 「まだ自分で入力していないサンプルです」と分かるバッジを添える。
  const sampleBadge = !isOnboardingDone()
    ? `<span class="hero-summary-sample-badge">${t("calc.summary.sample")}</span>`
    : "";
  const cev = a.requiredEq - a.rp;

  heroSummaryEl.innerHTML = `
    <div class="hero-summary-body">
      <div class="hero-summary-spot">
        ${villainRow}
        <span class="hero-summary-arrow" aria-hidden="true">›</span>
        ${heroRow}
        ${sampleBadge}
      </div>
      ${a.rangeVerdict.direction === "pushBack" ? `<p class="hint hero-summary-push-note">${t("calc.summary.pushReference")}</p>` : ""}
      <div class="hero-summary-grid">
        <div class="hero-summary-item primary" data-info="必要勝率">
          <div class="hero-summary-label tappable">${t("calc.summary.reqLabel")}</div>
          <div class="hero-summary-value">${(a.requiredEq * 100).toFixed(1)}<span class="unit">%</span></div>
          <div class="hero-summary-sub">${t("calc.summary.chipOnly", { v: (cev * 100).toFixed(1) })}</div>
        </div>
        <div class="hero-summary-item" data-info="RP">
          <div class="hero-summary-label tappable">${t("calc.summary.rpLabel")}</div>
          <div class="hero-summary-value warn">${a.rp >= 0 ? "+" : ""}${(a.rp * 100).toFixed(1)}<span class="unit">%</span></div>
        </div>
        <div class="hero-summary-item" data-info="BF">
          <div class="hero-summary-label tappable">${t("calc.summary.bfLabel")}</div>
          <div class="hero-summary-value ${bfClass}">${a.bf.toFixed(2)}</div>
        </div>
      </div>
      ${verdictLineHtml(hasVillain, a.rangeVerdict)}
    </div>
  `;
}

/**
 * hero サマリー内のタップ操作を配線する。initCalculator から一度だけ呼ぶ。
 * カードは recompute ごとに innerHTML で作り直されるため、個々の要素ではなく
 * カード自身へ 1 つだけ listener を張って委譲する。
 */
// ===== スクロール時のコンパクト表示 =====
// sticky なサマリーは展開状態で画面の約3割を常時占有する (390×844 実測 31%)。
// スクロール中は副次的な数字 (チップだけなら・一行判定のリンク) を畳み、
// 局面の1行と 必要勝率/RP/BF だけを残す。
// ヒステリシス (入り 160px / 戻り 40px) で境界での明滅を防ぐ。
const FLOAT_ENTER_Y = 160;
const FLOAT_EXIT_Y = 40;
let floating = false;
let scrollRafPending = false;

function updateFloating(): void {
  scrollRafPending = false;
  const y = window.scrollY;
  const next = floating ? y > FLOAT_EXIT_Y : y > FLOAT_ENTER_Y;
  if (next !== floating) {
    floating = next;
    heroSummaryEl.classList.toggle("floating", floating);
  }
}

export function initHeroSummary(): void {
  window.addEventListener(
    "scroll",
    () => {
      if (scrollRafPending) return;
      scrollRafPending = true;
      requestAnimationFrame(updateFloating);
    },
    { passive: true },
  );
  heroSummaryEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    // 一行判定タップ → 分析タブのレンジ比較セクションへ (根拠のグリッドを見せる)
    const verdictBtn = target.closest<HTMLButtonElement>("#hero-summary-verdict-btn");
    if (verdictBtn) {
      setAnalysisView("hand");
      applyTab("analyze");
      // applyTab のスムーズトップスクロールの後に上書きしてセクションへ
      requestAnimationFrame(() => {
        document.getElementById("sec-hand")?.scrollIntoView({ behavior: "smooth" });
      });
      return;
    }
    const infoEl = target.closest<HTMLElement>("[data-info]");
    if (infoEl) {
      const key = infoEl.dataset.info;
      if (key) openInfoModal(key);
    }
  });
}
