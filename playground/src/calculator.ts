// ===== 計算結果タブのオーケストレーション =====
//
// recompute() が唯一の「再計算エントリポイント」。入力 (players / payouts /
// Nash パラメータ) を読み、core の計算を呼び、各表示モジュールへ結果を渡す。
// 表示の実装はここには置かず、凝集した単位ごとに分けてある:
//   - heroSummary.ts … 上部の状況サマリーカード
//   - bfMatrix.ts    … 全員 vs 全員の BF 表
//   - warnings.ts    … モデル前提から外れた入力への注意書き
//   - infoModal.ts   … 用語解説モーダル
//   - format.ts      … 数値フォーマット
// このファイルに残すのは「計算の流れ」と「セクション5 (コール額/純利得) の配線」だけ。
import {
  calculateBubbleFactor,
  calculateICM,
  calculatePotOdds,
  calculateRequiredEquity,
} from "@poker-icm/core";
import { renderRangeComparison, updateHandPositionBanner } from "./handRange.js";
import { updateNashOvercallWarn } from "./nashUI.js";
import { t } from "./i18n.js";
import { $ } from "./dom.js";
import {
  players,
  parseList,
  DEFAULT_SB,
  DEFAULT_BB,
  posToPotOddsPos,
} from "./appState.js";
import {
  payoutsInput,
  nashSbInput,
  nashBbInput,
  nashAnteInput,
  saveState,
} from "./domRefs.js";
import { fmt, fmtPct, fmtSigned } from "./format.js";
import { renderHeroSummary, hideHeroSummary, initHeroSummary } from "./heroSummary.js";
import { renderBFMatrix, initBFMatrix } from "./bfMatrix.js";
import { updatePositionWarn, updateDepthWarn } from "./warnings.js";
import { initInfoModal } from "./infoModal.js";

// ===== DOM参照 (計算結果タブ) =====
const callInput = $<HTMLInputElement>("call");
const potWinInput = $<HTMLInputElement>("potwin");
const autofillBtn = $<HTMLButtonElement>("autofill-call");
const autofillHint = $<HTMLParagraphElement>("autofill-hint");
const icmRows = $<HTMLTableSectionElement>("icm-rows");
const bfResult = $<HTMLDivElement>("bf-result");
const eqResult = $<HTMLDivElement>("eq-result");

/** ステッパー (+/-) が下回れないコール額/純利得の下限。 */
const NUM_STEP_MIN = 0.1;

// セクション 5 のコール額/純利得を手動編集したかどうかのフラグ。
// true の間は自動更新を抑制。シナリオ変更や autofill ボタンで false にリセット。
let callManualOverride = false;
export function setCallManualOverride(v: boolean): void {
  callManualOverride = v;
}

// ===== メイン計算 =====

export function recompute(): void {
  try {
    const stacks = players.map((p) => p.stack);
    const payouts = parseList(payoutsInput.value);

    if (stacks.length === 0) throw new Error(t("calc.err.needPlayer"));
    if (payouts.length === 0) throw new Error(t("calc.err.needPayout"));

    const heroIndex = players.findIndex((p) => p.role === "hero");
    const villainIndex = players.findIndex((p) => p.role === "villain");

    // ICM
    const equities = calculateICM(stacks, payouts);
    const totalPrize = payouts.reduce((a, b) => a + b, 0);
    icmRows.innerHTML = stacks
      .map((stack, i) => {
        const eq = equities[i] ?? 0;
        const pct = totalPrize > 0 ? eq / totalPrize : 0;
        const role = players[i]?.role;
        const tag =
          role === "hero" ? " 🎯" : role === "villain" ? " ⚔️" : "";
        const rowClass = role === "hero" ? ' class="hero-row"' : "";
        return `<tr${rowClass}>
          <td>${i + 1}${tag}</td>
          <td>${stack}</td>
          <td>${fmt(eq, 3)}</td>
          <td>${fmtPct(pct, 1)}</td>
        </tr>`;
      })
      .join("");

    // BF
    let bf = 1.0;
    if (heroIndex < 0 || villainIndex < 0) {
      bfResult.innerHTML = `<div class="error">${t("calc.bf.err.needHV")}</div>`;
    } else if (heroIndex === villainIndex) {
      // データモデル上到達不能: Player.role は単一の文字列 ("hero" | "villain" | "other")
      // であり、1人が hero と villain を同時に兼ねることはできない。findIndex が
      // 同じ index を返すのは heroIndex/villainIndex が両方 -1 の場合のみだが、
      // それは直前の分岐で既に弾かれている。防御的に残す。
      bfResult.innerHTML = `<div class="error">${t("calc.bf.err.sameHV")}</div>`;
    } else {
      const heroStack = stacks[heroIndex]!;
      const villainStack = stacks[villainIndex]!;
      const safeRisk = Math.min(heroStack, villainStack);
      if (safeRisk <= 0) {
        bfResult.innerHTML = `<div class="error">${t("calc.bf.err.zeroStack")}</div>`;
      } else {
        const r = calculateBubbleFactor({
          stacks,
          payouts,
          heroIndex,
          villainIndex,
          riskChips: safeRisk,
        });
        bf = r.bf;
        // 生の $ エクイティ数値 (equityNow/equityWin/equityLose) は単位が伝わりにくく
        // 状況サマリー (#hero-summary) や BF マップと重複するため非表示。
        // BF 値自体とリスクチップのみ、hero vs villain の一行サマリーとして残す。
        bfResult.innerHTML = `
          <div class="row"><span class="label">${t("calc.bf.label.bf")}</span><span class="value big">${fmt(r.bf, 3)}</span></div>
          <div class="row"><span class="label">${t("calc.bf.label.risk")}</span><span class="value">${safeRisk}</span></div>
        `;
      }
    }

    // BF マトリックス（全員 vs 全員）
    renderBFMatrix(stacks, payouts);

    // 必要勝率: hero/villain あれば自動更新 (BB ante 構造、ante は dead)
    // スタック0のプレイヤーが hero/villain の場合 calculatePotOdds が throw する
    // ため、自動算出はスキップ (throw で ICM 表全体が生エラーに置き換わるのを防ぐ)。
    if (
      heroIndex >= 0 &&
      villainIndex >= 0 &&
      heroIndex !== villainIndex &&
      stacks[heroIndex]! > 0 &&
      stacks[villainIndex]! > 0
    ) {
      // nashSbInput 等は $() 取得済みで必ず存在するため optional chaining は不要。
      const sbV = Number(nashSbInput.value) || DEFAULT_SB;
      const bbV = Number(nashBbInput.value) || DEFAULT_BB;
      const totalAnteV = Number(nashAnteInput.value) || 0;
      const heroPos = players[heroIndex]?.position;
      const villainPos = players[villainIndex]?.position;
      const r = calculatePotOdds({
        heroStack: stacks[heroIndex]!,
        villainStack: stacks[villainIndex]!,
        heroPosition: posToPotOddsPos(heroPos),
        villainPosition: posToPotOddsPos(villainPos),
        sb: sbV, bb: bbV, ante: totalAnteV,
      });
      if (r.matched > 0 && !callManualOverride) {
        callInput.value = r.callAmount.toFixed(1);
        potWinInput.value = r.potIfWin.toFixed(1);
        const heroStackV = stacks[heroIndex]!;
        const heroAntePaid = heroPos === "BB" ? totalAnteV : 0;
        const villainAntePaid = villainPos === "BB" ? totalAnteV : 0;
        const heroBlindPaid = r.heroLiveCommit;
        const heroSunk = heroAntePaid + heroBlindPaid;
        const heroLive = heroStackV - heroSunk;
        const stackIfFold = heroLive;
        const stackIfLose = heroLive - r.callAmount;
        const stackIfWin = stackIfLose + r.potAtShowdown;
        const netWin = stackIfWin - heroStackV;
        const netLose = stackIfLose - heroStackV;
        const netFold = stackIfFold - heroStackV;
        // ante は会計上 dead だが「誰が払ったか」をラベルで明示する
        const anteOwnerLabel = heroAntePaid > 0
          ? `自分(${heroPos})`
          : villainAntePaid > 0
            ? `相手(${villainPos})`
            : null; // どちらも BB じゃない (前任 BB folded)
        autofillHint.innerHTML = `
          <div class="autofill-summary-line">${t("calc.autofill.summaryLine", { call: r.callAmount.toFixed(1), pot: r.potIfWin.toFixed(1) })}</div>
          <details class="autofill-details">
            <summary>${t("calc.autofill.detailsSummary")}</summary>
            <div class="autofill-body">
              <div class="autofill-section">
                <div class="autofill-h">${t("calc.autofill.potComp")}</div>
                <ul class="autofill-list">
                  ${heroBlindPaid > 0 ? `<li>${t("calc.autofill.heroBlind", { pos: heroPos ?? "", v: heroBlindPaid.toFixed(1) })}</li>` : ""}
                  ${heroAntePaid > 0 ? `<li>${t("calc.autofill.heroAnte", { pos: heroPos ?? "", v: heroAntePaid.toFixed(1) })}</li>` : ""}
                  ${r.deadBreakdown.sbDead > 0 ? `<li>SB dead: <code>${r.deadBreakdown.sbDead.toFixed(1)}</code> <span class="muted">(SB folded)</span></li>` : ""}
                  ${r.deadBreakdown.bbDead > 0 ? `<li>BB dead: <code>${r.deadBreakdown.bbDead.toFixed(1)}</code> <span class="muted">(BB folded)</span></li>` : ""}
                  ${villainAntePaid > 0 ? `<li>${t("calc.autofill.villainAnte", { pos: villainPos ?? "", v: villainAntePaid.toFixed(1) })}</li>` : ""}
                  ${r.deadBreakdown.anteDead > 0 && anteOwnerLabel === null ? `<li>${t("calc.autofill.anteDead", { v: r.deadBreakdown.anteDead.toFixed(1) })}</li>` : ""}
                  <li>${t("calc.autofill.heroToPay", { v: r.callAmount.toFixed(1) })}</li>
                  <li>${t("calc.autofill.villainPush", { pos: villainPos ?? "", live: (r.matched - r.villainLiveCommit).toFixed(1), blind: r.villainLiveCommit > 0 ? t("calc.autofill.villainPushBlind", { v: r.villainLiveCommit.toFixed(1) }) : "", matched: r.matched.toFixed(1) })}</li>
                  <li><strong>${t("calc.autofill.totalPot", { v: r.potAtShowdown.toFixed(1) })}</strong></li>
                </ul>
              </div>
              <div class="autofill-section">
                <div class="autofill-h">${t("calc.autofill.callVsFold")}</div>
                <table class="autofill-table">
                  ${t("calc.autofill.tableHead")}
                  <tr><td>fold</td><td>${stackIfFold.toFixed(1)}</td><td>±0</td><td class="${netFold >= 0 ? 'good' : 'bad'}">${fmtSigned(netFold)}</td></tr>
                  <tr><td>call+win</td><td>${stackIfWin.toFixed(1)}</td><td class="good">+${r.potIfWin.toFixed(1)}</td><td class="${netWin >= 0 ? 'good' : 'bad'}">${fmtSigned(netWin)}</td></tr>
                  <tr><td>call+lose</td><td>${stackIfLose.toFixed(1)}</td><td class="bad">-${r.callAmount.toFixed(1)}</td><td class="bad">${fmtSigned(netLose)}</td></tr>
                </table>
              </div>
            </div>
          </details>
        `;
      }
    }
    const callAmount = Number(callInput.value);
    const potIfWin = Number(potWinInput.value);
    const eq = calculateRequiredEquity({
      callAmount,
      potIfWin,
      bubbleFactor: bf,
    });

    const rpSign = eq.riskPremium >= 0 ? "+" : "";
    eqResult.innerHTML = `
      <div class="eq-flow">
        <div class="eq-flow-item eq-flow-cev">
          <div class="eq-flow-label">cEV</div>
          <div class="eq-flow-value">${fmtPct(eq.cEV)}</div>
        </div>
        <div class="eq-flow-arrow">→</div>
        <div class="eq-flow-item eq-flow-rp">
          <div class="eq-flow-label">+ Risk Premium</div>
          <div class="eq-flow-value">${rpSign}${fmtPct(eq.riskPremium, 2)}</div>
        </div>
        <div class="eq-flow-arrow">→</div>
        <div class="eq-flow-item eq-flow-final">
          <div class="eq-flow-label">$EV (True Req)</div>
          <div class="eq-flow-value">${fmtPct(eq.dollarEV)}</div>
        </div>
      </div>
    `;

    // レンジ比較
    renderRangeComparison(eq.dollarEV);

    // Hero サマリー
    renderHeroSummary({
      heroIndex,
      villainIndex,
      stacks,
      payouts,
      heroEq: heroIndex >= 0 ? equities[heroIndex] ?? 0 : 0,
      villainEq: villainIndex >= 0 ? equities[villainIndex] ?? 0 : 0,
      totalPrize,
      bf,
      requiredEq: eq.dollarEV,
      rp: eq.riskPremium,
    });

    // 状態を保存
    saveState();
    updateNashOvercallWarn();
    updatePositionWarn(heroIndex, villainIndex);
    updateDepthWarn(heroIndex, villainIndex, stacks);
    updateHandPositionBanner(heroIndex);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    icmRows.innerHTML = `<tr><td colspan="4" class="error">${msg}</td></tr>`;
    bfResult.innerHTML = "";
    eqResult.innerHTML = "";
    hideHeroSummary();
    updateDepthWarn(-1, -1, []);
  }
}

/** 計算結果タブの初期化・イベント配線。main.ts から一度だけ呼ぶ。 */
// 「表の見方」details は常に閉じた状態で開始する (通常の details 挙動のまま、開閉は手動で可能)。
export function initCalculator(): void {
  initBFMatrix();

  [callInput, potWinInput].forEach((el) => {
    el.addEventListener("input", recompute);
  });

  // 🎯⚔️スタック + Nash blinds から call / potWin を自動算出
  autofillBtn.addEventListener("click", () => {
    const heroIdx = players.findIndex((p) => p.role === "hero");
    const villainIdx = players.findIndex((p) => p.role === "villain");
    if (heroIdx < 0 || villainIdx < 0) {
      autofillHint.textContent = t("calc.autofill.err.needHV");
      return;
    }
    const heroStack = players[heroIdx]!.stack;
    const villainStack = players[villainIdx]!.stack;
    const risk = Math.min(heroStack, villainStack);
    if (risk <= 0) {
      autofillHint.textContent = t("calc.autofill.err.zeroStack");
      return;
    }

    // 注意: ここのフォールバックは recompute() 側と意図的に異なる。
    // autofill は「入力欄が空/0 ならブラインド 0 として計算する」= `|| 0`、
    // recompute の自動追従は「空なら標準ブラインドで概算を出す」= `|| DEFAULT_SB`。
    // 表示される数値が変わるため統一しないこと。
    const sb = Number(nashSbInput.value) || 0;
    const bb = Number(nashBbInput.value) || 0;
    const totalAnte = Number(nashAnteInput.value) || 0; // アンティ入力は常にテーブル合計
    const dead = sb + bb + totalAnte;

    callInput.value = risk.toFixed(1);
    potWinInput.value = (risk + dead).toFixed(1);
    callManualOverride = false; // autofill 押したら自動追従モードに戻す

    autofillHint.innerHTML = t("calc.autofill.result", {
      risk,
      pot: (risk + dead).toFixed(1),
      risk2: risk,
      dead: dead.toFixed(1),
      sb,
      bb,
      ante: totalAnte.toFixed(1),
    });
    recompute();
  });

  // 手動編集を検知して override フラグを立てる
  [callInput, potWinInput].forEach((el) => {
    el.addEventListener("input", () => {
      callManualOverride = true;
    });
  });

  // ===== コール額 / 純利得の +/- ステッパー =====
  document.querySelectorAll<HTMLButtonElement>(".num-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const delta = Number(btn.dataset.delta) || 0;
      if (!targetId) return;
      const input = document.getElementById(targetId) as HTMLInputElement | null;
      if (!input) return;
      const cur = Number(input.value) || 0;
      const next = Math.max(NUM_STEP_MIN, cur + delta);
      input.value = next.toFixed(1);
      callManualOverride = true;
      recompute();
    });
  });

  initInfoModal();
  initHeroSummary();
}
