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
import { renderRangeComparison, updateHandPositionBanner, setRangeUnavailable, currentDirection } from "./handRange.js";
import { updateNashOvercallWarn, invalidateChangedNash, ensureNashCalculated } from "./nashUI.js";
import { t } from "./i18n.js";
import { checkpointSetup } from "./setupUndo.js";
import { $ } from "./dom.js";
import {
  players,
  parseList,
  posToPotOddsPos,
} from "./appState.js";
import {
  payoutsInput,
  nashSbInput,
  nashBbInput,
  nashAnteInput,
  readBlindParams,
  saveState,
} from "./domRefs.js";
import { escapeHtml } from "./html.js";
import { fmt, fmtPct, fmtSigned } from "./format.js";
import { renderHeroSummary, hideHeroSummary, initHeroSummary } from "./heroSummary.js";
import { renderBFMatrix, clearBFMatrix, initBFMatrix } from "./bfMatrix.js";
import { updatePositionWarn, updateDepthWarn } from "./warnings.js";
import { initInfoModal } from "./infoModal.js";
import { exactCallRequiredEquity } from "./callSpot.js";
import { renderChop, clearChop, initChop } from "./chopView.js";
import { activeBounty } from "./bountyState.js";
import { renderBountySummary } from "./setupBounty.js";
import { formatStackDisplay, getBbSize, getStackUnit } from "./stackUnit.js";
import { hapticLight, hapticSelection } from "./haptics.js";

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
export function getCallManualOverride(): boolean {
  return callManualOverride;
}
export function setCallManualOverride(v: boolean): void {
  callManualOverride = v;
}

// ===== メイン計算 =====

/** 局面カードの折りたたみ行 (賞金・ブラインド) に、今の設定を1行で出す。 */
function renderSpotFoldSummaries(): void {
  const payoutsEl = document.getElementById("payouts-summary");
  if (payoutsEl) {
    const list = parseList(payoutsInput.value);
    payoutsEl.textContent = list.length > 0 ? list.map((v) => Number(v.toFixed(2)).toLocaleString("en-US")).join(" / ") : "—";
  }
  const blindsEl = document.getElementById("blinds-summary");
  if (blindsEl) {
    const { sb, bb, ante } = readBlindParams();
    blindsEl.textContent = t("setup.blinds.summary", {
      sb: String(sb),
      bb: String(bb),
      ante: String(ante),
    });
  }
}

export function recompute(): void {
  invalidateChangedNash();
  renderSpotFoldSummaries();
  renderBountySummary();
  try {
    const stacks = players.map((p) => p.stack);
    // バウンティ (Pro)。設定なし・無料のときは undefined で、従来どおりの計算になる
    const bounty = activeBounty();
    const payouts = parseList(payoutsInput.value);

    if (stacks.length === 0) throw new Error(t("calc.err.needPlayer"));
    if (payouts.length === 0) throw new Error(t("calc.err.needPayout"));
    const paidPayouts = payouts.slice(0, stacks.length);
    const totalPrize = paidPayouts.reduce((a, b) => a + b, 0);
    if (!(totalPrize > 0)) throw new Error(t("calc.err.positivePrize"));
    if (!stacks.some((s) => s > 0)) throw new Error(t("calc.err.zeroTotalStack"));

    const heroIndex = players.findIndex((p) => p.role === "hero");
    const villainIndex = players.findIndex((p) => p.role === "villain");
    const decisionUnavailable = heroIndex < 0 || villainIndex < 0
      ? t("calc.bf.err.needHV")
      : stacks[heroIndex]! <= 0 || stacks[villainIndex]! <= 0
        ? t("calc.bf.err.zeroStack")
        : null;
    setRangeUnavailable(decisionUnavailable);

    // ICM
    const equities = calculateICM(stacks, payouts);
    const unitMode = getStackUnit();
    const bbSize = getBbSize();
    icmRows.innerHTML = stacks
      .map((stack, i) => {
        const eq = equities[i] ?? 0;
        const pct = totalPrize > 0 ? eq / totalPrize : 0;
        const role = players[i]?.role;
        const tag =
          role === "hero"
            ? ` <span class="icm-role hero">${t("calc.summary.hero")}</span>`
            : role === "villain"
              ? ` <span class="icm-role villain">${t("calc.summary.villain")}</span>`
              : "";
        const rowClass = role === "hero" ? ' class="hero-row"' : "";
        return `<tr${rowClass}>
          <td>${players[i]?.position || `#${i + 1}`}${tag}</td>
          <td>${formatStackDisplay(stack, unitMode, bbSize)}</td>
          <td>${fmt(eq, 3)}</td>
          <td>${fmtPct(pct, 1)}</td>
        </tr>`;
      })
      .join("");

    renderChop(stacks, payouts);
    const hasBounty = bounty !== undefined;
    document.getElementById("icm-bounty-note")?.classList.toggle("hidden", !hasBounty);
    document.getElementById("chop-bounty-note")?.classList.toggle("hidden", !hasBounty);

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
          bounty,
        });
        bf = r.bf;
        // 生の $ エクイティ数値 (equityNow/equityWin/equityLose) は単位が伝わりにくく
        // 状況サマリー (#hero-summary) や BF マップと重複するため非表示。
        // BF 値自体とリスクチップのみ、hero vs villain の一行サマリーとして残す。
        const riskLabel =
          unitMode === "chips"
            ? formatStackDisplay(safeRisk, unitMode, bbSize)
            : `${formatStackDisplay(safeRisk, unitMode, bbSize)} BB`;
        bfResult.innerHTML = `
          <div class="row"><span class="label">${t("calc.bf.label.bf")}</span><span class="value big">${fmt(r.bf, 3)}</span></div>
          <div class="row"><span class="label">${t("calc.bf.label.risk")}</span><span class="value">${riskLabel}</span></div>
        `;
      }
    }

    // BF マトリックス（全員 vs 全員）
    renderBFMatrix(stacks, payouts, bounty);

    // 必要勝率: hero/villain あれば自動更新 (BB ante 構造、ante は dead)
    // スタック0のプレイヤーが hero/villain の場合 calculatePotOdds が throw する
    // ため、自動算出はスキップ (throw で ICM 表全体が生エラーに置き換わるのを防ぐ)。
    const { sb: sbV, bb: bbV, ante: totalAnteV } = readBlindParams();
    autofillBtn.classList.toggle("is-manual", callManualOverride);
    if (
      heroIndex < 0 ||
      villainIndex < 0 ||
      heroIndex === villainIndex ||
      stacks[heroIndex]! <= 0 ||
      stacks[villainIndex]! <= 0
    ) {
      // 相手未指定やスタック 0 のときは、前の局面の内訳が残らないように空にする
      autofillHint.innerHTML = "";
    } else if (callManualOverride) {
      // 手入力中は、自動算出時の古い内訳を表示しない (混同防止)
      autofillHint.innerHTML = `<span class="autofill-manual-note">${t("calc.autofill.manualMode")}</span>`;
    } else {
      const heroPos = players[heroIndex]?.position;
      const villainPos = players[villainIndex]?.position;
      const r = calculatePotOdds({
        heroStack: stacks[heroIndex]!,
        villainStack: stacks[villainIndex]!,
        heroPosition: posToPotOddsPos(heroPos, players.length),
        villainPosition: posToPotOddsPos(villainPos, players.length),
        sb: sbV, bb: bbV, ante: totalAnteV,
      });
      // 自分か相手がブラインド・アンティを払った時点でオールインになっていると、
      // コールする額が残らない (判断する場面がない)。古い値を残すと別の局面の数字が出るので空にする。
      if (!(r.matched > r.heroLiveCommit)) {
        callInput.value = "";
        potWinInput.value = "";
        autofillHint.innerHTML = "";
      } else {
        const pushes = currentDirection() === "pushBack";
        // 位置が未設定の人は括弧ごと省く (「相手()」と出さない)
        const seat = (pos: string | undefined): string => (pos ? `(${pos})` : "");
        callInput.value = r.callAmount.toFixed(1);
        potWinInput.value = r.potIfWin.toFixed(1);
        const heroStackV = stacks[heroIndex]!;
        const heroAntePaid = heroPos === "BB" ? Math.min(totalAnteV, heroStackV) : 0;
        const villainAntePaid = villainPos === "BB" ? Math.min(totalAnteV, stacks[villainIndex]!) : 0;
        const heroBlindPaid = r.heroLiveCommit;
        const heroSunk = heroAntePaid + heroBlindPaid;
        const heroLive = heroStackV - heroSunk;
        const stackIfFold = heroLive;
        const stackIfLose = heroLive - r.callAmount;
        const stackIfWin = stackIfLose + r.potAtShowdown;
        const netWin = stackIfWin - heroStackV;
        const netLose = stackIfLose - heroStackV;
        const netFold = stackIfFold - heroStackV;
        // 「誰が払ったか」が分かる行 (自分・相手のアンティ) が無いときだけ、場のアンティを別に出す
        const anteShownAsOwn = heroAntePaid > 0 || villainAntePaid > 0;
        const villainStake = r.villainLiveCommit > 0
          ? t(pushes ? "calc.autofill.villainCall" : "calc.autofill.villainPush", {
              pos: seat(villainPos),
              live: Math.max(0, r.matched - r.villainLiveCommit).toFixed(1),
              blind: t("calc.autofill.villainPushBlind", { v: r.villainLiveCommit.toFixed(1) }),
              matched: r.matched.toFixed(1),
            })
          : t(pushes ? "calc.autofill.villainCallNoBlind" : "calc.autofill.villainPushNoBlind", {
              pos: seat(villainPos),
              matched: r.matched.toFixed(1),
            });
        autofillHint.innerHTML = `
          <div class="autofill-summary-line">${t(pushes ? "calc.autofill.summaryLinePush" : "calc.autofill.summaryLine", { call: r.callAmount.toFixed(1), pot: r.potIfWin.toFixed(1) })}</div>
          <details class="autofill-details">
            <summary>${t("calc.autofill.detailsSummary")}</summary>
            <div class="autofill-body">
              <div class="autofill-section">
                <div class="autofill-h">${t("calc.autofill.potComp")}</div>
                <ul class="autofill-list">
                  ${heroBlindPaid > 0 ? `<li>${t("calc.autofill.heroBlind", { pos: seat(heroPos), v: heroBlindPaid.toFixed(1) })}</li>` : ""}
                  ${heroAntePaid > 0 ? `<li>${t("calc.autofill.heroAnte", { pos: seat(heroPos), v: heroAntePaid.toFixed(1) })}</li>` : ""}
                  ${r.deadBreakdown.sbDead > 0 ? `<li>${t("calc.autofill.sbDead", { v: r.deadBreakdown.sbDead.toFixed(1) })}</li>` : ""}
                  ${r.deadBreakdown.bbDead > 0 ? `<li>${t("calc.autofill.bbDead", { v: r.deadBreakdown.bbDead.toFixed(1) })}</li>` : ""}
                  ${villainAntePaid > 0 ? `<li>${t("calc.autofill.villainAnte", { pos: seat(villainPos), v: villainAntePaid.toFixed(1) })}</li>` : ""}
                  ${r.deadBreakdown.anteDead > 0 && !anteShownAsOwn ? `<li>${t("calc.autofill.anteDead", { v: r.deadBreakdown.anteDead.toFixed(1) })}</li>` : ""}
                  <li>${t(pushes ? "calc.autofill.heroToPush" : "calc.autofill.heroToPay", { v: r.callAmount.toFixed(1) })}</li>
                  <li>${villainStake}</li>
                  <li><strong>${t("calc.autofill.totalPot", { v: r.potAtShowdown.toFixed(1) })}</strong></li>
                </ul>
              </div>
              <div class="autofill-section">
                <div class="autofill-h">${t(pushes ? "calc.autofill.pushVsFold" : "calc.autofill.callVsFold")}</div>
                <table class="autofill-table">
                  ${t("calc.autofill.tableHead")}
                  <tr><td>${t("calc.autofill.row.fold")}</td><td>${stackIfFold.toFixed(1)}</td><td>±0</td><td class="${netFold >= 0 ? 'good' : 'bad'}">${fmtSigned(netFold)}</td></tr>
                  <tr><td>${t(pushes ? "calc.autofill.row.pushWin" : "calc.autofill.row.win")}</td><td>${stackIfWin.toFixed(1)}</td><td class="good">+${r.potIfWin.toFixed(1)}</td><td class="${netWin >= 0 ? 'good' : 'bad'}">${fmtSigned(netWin)}</td></tr>
                  <tr><td>${t(pushes ? "calc.autofill.row.pushLose" : "calc.autofill.row.lose")}</td><td>${stackIfLose.toFixed(1)}</td><td class="bad">-${r.callAmount.toFixed(1)}</td><td class="bad">${fmtSigned(netLose)}</td></tr>
                </table>
              </div>
            </div>
          </details>
        `;
      }
    }
    const callAmount = Number(callInput.value);
    const potIfWin = Number(potWinInput.value);
    // 判断できない局面では必要勝率を出さず、理由だけを出す。
    // core の calculateRequiredEquity は 0 以下の額で例外を投げるので、呼ぶ前にここで止める
    // (以前は例外が ICM の表ごとエラー文に置き換えていた)。
    const callUnavailable =
      decisionUnavailable ??
      (callAmount > 0 && potIfWin > 0 ? null : t(callManualOverride ? "calc.err.callInput" : "calc.err.noCall"));

    if (callUnavailable) {
      eqResult.innerHTML = `<p class="hint eq-unavailable" role="status">${callUnavailable}</p>`;
      setRangeUnavailable(callUnavailable);
      hideHeroSummary();
    } else {
      const approxEq = calculateRequiredEquity({
        callAmount,
        potIfWin,
        bubbleFactor: bf,
      });
      // 必要勝率は厳密 ICM (fold / コール勝ち / コール負けの3終端) で出す。練習タブと同じ計算。
      // コール額・純利得を手入力したときと、BB の人が決まらない卓は BF 近似に戻す。
      const exactReq = !callManualOverride
        ? exactCallRequiredEquity(
            players,
            payouts,
            heroIndex,
            villainIndex,
            sbV,
            bbV,
            totalAnteV,
            bounty,
          )
        : null;
      const eq =
        exactReq === null
          ? approxEq
          : { cEV: approxEq.cEV, dollarEV: exactReq, riskPremium: exactReq - approxEq.cEV };

      // 上のカードと桁を揃えて小数 1 桁にし、微小な負値で「-0.0%」が出ないようにする
      const rpPct = Math.round(eq.riskPremium * 1000) / 10 || 0;
      const rpSign = rpPct >= 0 ? "+" : "";
      const rpTone = rpPct < 0 ? " is-good" : rpPct === 0 ? " is-neutral" : "";
      eqResult.innerHTML = `
        <div class="eq-flow">
          <div class="eq-flow-item eq-flow-cev">
            <div class="eq-flow-label">${t("calc.eq.flow.chip")}</div>
            <div class="eq-flow-value">${fmtPct(eq.cEV)}</div>
          </div>
          <div class="eq-flow-arrow" aria-hidden="true">→</div>
          <div class="eq-flow-item eq-flow-rp${rpTone}">
            <div class="eq-flow-label">${t("calc.eq.flow.rp")}</div>
            <div class="eq-flow-value">${rpSign}${rpPct.toFixed(1)}%</div>
          </div>
          <div class="eq-flow-arrow" aria-hidden="true">→</div>
          <div class="eq-flow-item eq-flow-final">
            <div class="eq-flow-label">${t("calc.eq.flow.icm")}</div>
            <div class="eq-flow-value">${fmtPct(eq.dollarEV)}</div>
          </div>
        </div>
        ${exactReq === null ? `<p class="hint eq-approx-note">${t("calc.eq.approxNote")}</p>` : ""}
        ${bounty ? `<p class="hint eq-bounty-note">${t(bounty.progressive ? "calc.eq.bountyNote.pko" : "calc.eq.bountyNote.ko")}</p>` : ""}
      `;

      // レンジ比較 (戻り値の要約は状況サマリーの一行判定に使う)
      const rangeVerdict = renderRangeComparison(eq.dollarEV);

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
        rangeVerdict,
      });
    }

    // 状態を保存
    saveState();
    const activeDirection = callUnavailable ? null : currentDirection();
    const pushes = activeDirection === "pushBack";
    const eqCallLabel = document.getElementById("eq-call-label");
    if (eqCallLabel) eqCallLabel.textContent = t(pushes ? "result.eq.pushLabel" : "result.eq.callLabel").trim();
    const flowEqDetails = document.getElementById("flow-equity-details");
    if (flowEqDetails) flowEqDetails.textContent = t(pushes ? "flow.equityDetailsPush" : "flow.equityDetails");
    updateNashOvercallWarn();
    updatePositionWarn(activeDirection, heroIndex, villainIndex);
    updateDepthWarn(heroIndex, villainIndex, stacks, activeDirection);
    updateHandPositionBanner(heroIndex);
    ensureNashCalculated();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    icmRows.innerHTML = `<tr><td colspan="4" class="error">${escapeHtml(msg)}</td></tr>`;
    bfResult.innerHTML = "";
    clearBFMatrix();
    eqResult.innerHTML = "";
    autofillHint.innerHTML = "";
    clearChop();
    hideHeroSummary();
    setRangeUnavailable(msg);
    updatePositionWarn(null, -1, -1);
    updateDepthWarn(-1, -1, []);
    updateHandPositionBanner(-1);
    ensureNashCalculated();
  }
}

/** 計算結果タブの初期化・イベント配線。main.ts から一度だけ呼ぶ。 */
// 「表の見方」details は常に閉じた状態で開始する (通常の details 挙動のまま、開閉は手動で可能)。
export function initCalculator(): void {
  initBFMatrix();

  [callInput, potWinInput].forEach((el) => {
    el.addEventListener("input", () => {
      callManualOverride = true;
      recompute();
    });
  });

  // SB/BB/アンティの編集も即時再計算 (必要勝率の自動算出とサマリーが追従する)。
  // 負数・不正値が入力欄に残ったままにならないよう blur 時にサニタイズ値へ戻す。
  [nashSbInput, nashBbInput, nashAnteInput].forEach((el) => {
    el.addEventListener("input", recompute);
    el.addEventListener("blur", () => {
      const { sb, bb, ante } = readBlindParams();
      if (el === nashSbInput && !(Number(el.value) > 0)) el.value = String(sb);
      if (el === nashBbInput && !(Number(el.value) > 0)) el.value = String(bb);
      if (el === nashAnteInput && (!(Number(el.value) >= 0) || el.value.trim() === "")) el.value = String(ante);
    });
  });

  // 自動算出に戻す (recompute が現在の局面・ブラインドから call / potWin と内訳を再構築する)
  autofillBtn.addEventListener("click", () => {
    const heroIdx = players.findIndex((p) => p.role === "hero");
    const villainIdx = players.findIndex((p) => p.role === "villain");
    if (heroIdx < 0 || villainIdx < 0) {
      autofillHint.textContent = t("calc.autofill.err.needHV");
      return;
    }
    const risk = Math.min(players[heroIdx]!.stack, players[villainIdx]!.stack);
    if (risk <= 0) {
      autofillHint.textContent = t("calc.autofill.err.zeroStack");
      return;
    }
    hapticLight();
    checkpointSetup();
    callManualOverride = false;
    recompute();
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
      if (next === cur) return;
      hapticSelection();
      checkpointSetup();
      input.value = next.toFixed(1);
      callManualOverride = true;
      recompute();
    });
  });

  initInfoModal();
  initHeroSummary();
  initChop();
}
