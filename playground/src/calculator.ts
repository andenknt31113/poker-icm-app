import {
  calculateBubbleFactor,
  calculateICM,
  calculatePotOdds,
  calculateRequiredEquity,
} from "@poker-icm/core";
import { topRange, type HandNotation } from "./handRanking.js";
import { equity } from "./equity.js";
import { renderRangeComparison, updateHandPositionBanner } from "./handRange.js";
import { renderGrid } from "./grid.js";
import { updateNashOvercallWarn } from "./nashUI.js";
import { isOnboardingDone } from "./guide.js";
import { $ } from "./dom.js";
import {
  players,
  parseList,
  DEFAULT_SB,
  DEFAULT_BB,
  posToPotOddsPos,
  actionOrderIdx,
} from "./appState.js";
import { payoutsInput, nashSbInput, nashBbInput, nashAnteInput, saveState } from "./domRefs.js";

// ===== DOM参照 (計算結果タブ) =====
const callInput = $<HTMLInputElement>("call");
const potWinInput = $<HTMLInputElement>("potwin");
const autofillBtn = $<HTMLButtonElement>("autofill-call");
const autofillHint = $<HTMLParagraphElement>("autofill-hint");
const icmRows = $<HTMLTableSectionElement>("icm-rows");
const bfResult = $<HTMLDivElement>("bf-result");
const bfMatrix = $<HTMLDivElement>("bf-matrix");
const eqResult = $<HTMLDivElement>("eq-result");

// セクション 5 のコール額/純利得を手動編集したかどうかのフラグ。
// true の間は自動更新を抑制。シナリオ変更や autofill ボタンで false にリセット。
let callManualOverride = false;
export function setCallManualOverride(v: boolean): void {
  callManualOverride = v;
}

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return n === Number.POSITIVE_INFINITY ? "∞" : "—";
  return n.toFixed(digits);
}

function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

// ===== メイン計算 =====

export function recompute(): void {
  try {
    const stacks = players.map((p) => p.stack);
    const payouts = parseList(payoutsInput.value);

    if (stacks.length === 0) throw new Error("プレイヤーを1人以上入れてください");
    if (payouts.length === 0) throw new Error("賞金を1つ以上入れてください");

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
      bfResult.innerHTML = `<div class="error">🎯自分と⚔️相手を1人ずつ指定してください</div>`;
    } else if (heroIndex === villainIndex) {
      // データモデル上到達不能: Player.role は単一の文字列 ("hero" | "villain" | "other")
      // であり、1人が hero と villain を同時に兼ねることはできない。findIndex が
      // 同じ index を返すのは heroIndex/villainIndex が両方 -1 の場合のみだが、
      // それは直前の分岐で既に弾かれている。防御的に残す。
      bfResult.innerHTML = `<div class="error">🎯自分と⚔️相手は別の人にしてください</div>`;
    } else {
      const heroStack = stacks[heroIndex]!;
      const villainStack = stacks[villainIndex]!;
      const safeRisk = Math.min(heroStack, villainStack);
      if (safeRisk <= 0) {
        bfResult.innerHTML = `<div class="error">スタックが0なのでBF計算不可</div>`;
      } else {
        const r = calculateBubbleFactor({
          stacks,
          payouts,
          heroIndex,
          villainIndex,
          riskChips: safeRisk,
        });
        bf = r.bf;
        bfResult.innerHTML = `
          <div class="row"><span class="label">BF</span><span class="value big">${fmt(r.bf, 3)}</span></div>
          <div class="row"><span class="label">現在の $ エクイティ</span><span class="value">${fmt(r.equityNow, 3)}</span></div>
          <div class="row"><span class="label">勝ち時 $ エクイティ</span><span class="value">${fmt(r.equityWin, 3)}</span></div>
          <div class="row"><span class="label">負け時 $ エクイティ</span><span class="value">${fmt(r.equityLose, 3)}</span></div>
          <div class="row"><span class="label">リスクチップ</span><span class="value">${safeRisk}</span></div>
        `;
      }
    }

    // BF マトリックス（全員 vs 全員）
    renderBFMatrix(stacks, payouts);

    // 必要勝率: hero/villain あれば自動更新 (BB ante 構造、ante は dead)
    if (
      heroIndex >= 0 &&
      villainIndex >= 0 &&
      heroIndex !== villainIndex
    ) {
      const sbV = Number(nashSbInput?.value) || DEFAULT_SB;
      const bbV = Number(nashBbInput?.value) || DEFAULT_BB;
      const totalAnteV = Number(nashAnteInput?.value) || 0;
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
        const fmt = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1);
        // ante は会計上 dead だが「誰が払ったか」をラベルで明示する
        const anteOwnerLabel = heroAntePaid > 0
          ? `自分(${heroPos})`
          : villainAntePaid > 0
            ? `相手(${villainPos})`
            : null; // どちらも BB じゃない (前任 BB folded)
        autofillHint.innerHTML = `
          <details class="autofill-details" open>
            <summary>✓ 追加 call <strong>${r.callAmount.toFixed(1)}</strong> / 純利得 <strong>${r.potIfWin.toFixed(1)}</strong> BB <span style="color: var(--muted); font-size: 11px;">(タップで内訳)</span></summary>
            <div class="autofill-body">
              <div class="autofill-section">
                <div class="autofill-h">📊 ポット構成</div>
                <ul class="autofill-list">
                  ${heroBlindPaid > 0 ? `<li>自分(${heroPos}) blind: <code>${heroBlindPaid.toFixed(1)}</code> <span class="muted">(sunk)</span></li>` : ""}
                  ${heroAntePaid > 0 ? `<li>自分(${heroPos}) ante: <code>${heroAntePaid.toFixed(1)}</code> <span class="muted">(sunk, BB全額)</span></li>` : ""}
                  ${r.deadBreakdown.sbDead > 0 ? `<li>SB dead: <code>${r.deadBreakdown.sbDead.toFixed(1)}</code> <span class="muted">(SB folded)</span></li>` : ""}
                  ${r.deadBreakdown.bbDead > 0 ? `<li>BB dead: <code>${r.deadBreakdown.bbDead.toFixed(1)}</code> <span class="muted">(BB folded)</span></li>` : ""}
                  ${villainAntePaid > 0 ? `<li>相手(${villainPos}) ante: <code>${villainAntePaid.toFixed(1)}</code> <span class="muted">(sunk, BB全額)</span></li>` : ""}
                  ${r.deadBreakdown.anteDead > 0 && anteOwnerLabel === null ? `<li>ante dead: <code>${r.deadBreakdown.anteDead.toFixed(1)}</code> <span class="muted">(前任 BB folded)</span></li>` : ""}
                  <li>自分これから払う <strong>call</strong>: <code>${r.callAmount.toFixed(1)}</code></li>
                  <li>相手(${villainPos}) push (live): <code>${(r.matched - r.villainLiveCommit).toFixed(1)}</code>${r.villainLiveCommit > 0 ? ` + 既出 blind ${r.villainLiveCommit.toFixed(1)}` : ""} = <code>${r.matched.toFixed(1)}</code></li>
                  <li><strong>合計 pot: ${r.potAtShowdown.toFixed(1)} BB</strong></li>
                </ul>
              </div>
              <div class="autofill-section">
                <div class="autofill-h">⚖️ コール vs フォールド</div>
                <table class="autofill-table">
                  <tr><th>選択</th><th>残スタック</th><th>vs fold</th><th>起点比</th></tr>
                  <tr><td>fold</td><td>${stackIfFold.toFixed(1)}</td><td>±0</td><td class="${netFold >= 0 ? 'good' : 'bad'}">${fmt(netFold)}</td></tr>
                  <tr><td>call+win</td><td>${stackIfWin.toFixed(1)}</td><td class="good">+${r.potIfWin.toFixed(1)}</td><td class="${netWin >= 0 ? 'good' : 'bad'}">${fmt(netWin)}</td></tr>
                  <tr><td>call+lose</td><td>${stackIfLose.toFixed(1)}</td><td class="bad">-${r.callAmount.toFixed(1)}</td><td class="bad">${fmt(netLose)}</td></tr>
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

    // 🃏 ハンド別判定 (🎯自分/⚔️相手が両方指定されている時のみ有効)
    updateHandVerdictRequiredEquity(
      heroIndex >= 0 && villainIndex >= 0 && heroIndex !== villainIndex ? eq.dollarEV : null,
    );

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
    updateHandPositionBanner(heroIndex);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    icmRows.innerHTML = `<tr><td colspan="4" class="error">${msg}</td></tr>`;
    bfResult.innerHTML = "";
    eqResult.innerHTML = "";
    heroSummaryEl.classList.remove("active");
    updateHandVerdictRequiredEquity(null);
  }
}

// ===== Hero サマリーカード =====
const heroSummaryEl = $<HTMLDivElement>("hero-summary");

const HERO_SUMMARY_COLLAPSED_KEY = "poker-icm-hero-summary-collapsed";
function isHeroSummaryCollapsed(): boolean {
  try {
    return localStorage.getItem(HERO_SUMMARY_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}
function setHeroSummaryCollapsed(v: boolean): void {
  try {
    localStorage.setItem(HERO_SUMMARY_COLLAPSED_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

interface HeroSummaryArg {
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
}

function renderHeroSummary(a: HeroSummaryArg): void {
  if (a.heroIndex < 0) {
    heroSummaryEl.classList.remove("active");
    return;
  }
  heroSummaryEl.classList.add("active");
  const heroStack = a.stacks[a.heroIndex]!;
  const heroPos = players[a.heroIndex]?.position || "—";
  const heroEqPct = a.totalPrize > 0 ? (a.heroEq / a.totalPrize) * 100 : 0;

  const hasVillain = a.villainIndex >= 0;
  const villainStack = hasVillain ? a.stacks[a.villainIndex]! : 0;
  const villainPos = hasVillain ? players[a.villainIndex]?.position || "—" : "—";
  const villainEqPct =
    hasVillain && a.totalPrize > 0 ? (a.villainEq / a.totalPrize) * 100 : 0;

  // BF 色
  let bfClass = "accent";
  if (a.bf < 0.95) bfClass = "good";
  else if (a.bf > 1.15) bfClass = "bad";
  else if (a.bf > 1.05) bfClass = "warn";

  const villainRow = hasVillain
    ? `
      <div class="hero-summary-row villain">
        <div class="hero-summary-row-label">⚔️ 相手</div>
        <div class="hero-summary-row-stat">${villainStack}<span class="unit">BB</span></div>
        <div class="hero-summary-row-stat">${villainPos}</div>
        <div class="hero-summary-row-stat accent">${villainEqPct.toFixed(1)}<span class="unit">%</span></div>
      </div>`
    : `<div class="hero-summary-row villain muted-row">⚔️ 相手未指定</div>`;

  // 周りスタック (hero/villain 以外)
  const otherStacks = a.stacks
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => i !== a.heroIndex && i !== a.villainIndex)
    .map(({ s, i }) => `${players[i]?.position || "?"} ${s}`)
    .join(", ");
  const payoutText = a.payouts.length > 0 ? a.payouts.join("/") : "—";
  const contextLine = `
    <div class="hero-summary-context">
      <span>💰 <strong>${payoutText}</strong></span>
      ${otherStacks ? `<span>👥 周り <strong>${otherStacks}</strong> BB</span>` : ""}
    </div>
  `;

  // 初回 (オンボーディング未完了) はダミーの6人シナリオが説明なく表示されるため、
  // 「これはまだ自分で入力していないサンプルです」と分かるバッジを添える。
  // オンボーディングを閉じると次回の recompute から自然に消える。
  const sampleBadge = !isOnboardingDone()
    ? `<span class="hero-summary-sample-badge">サンプル</span>`
    : "";
  const collapsed = isHeroSummaryCollapsed();

  heroSummaryEl.innerHTML = `
    <div class="hero-summary-title-row">
      <span class="hero-summary-title">状況サマリー (タップ＝用語解説)</span>
      ${sampleBadge}
      <button type="button" id="hero-summary-collapse-btn" class="hero-summary-collapse-btn" aria-label="${collapsed ? "展開" : "折りたたみ"}" title="折りたたみ切替">${collapsed ? "▲" : "▼"}</button>
    </div>
    <div class="hero-summary-body${collapsed ? " collapsed" : ""}">
      ${contextLine}
      <div class="hero-summary-row hero">
        <div class="hero-summary-row-label">🎯 自分</div>
        <div class="hero-summary-row-stat">${heroStack}<span class="unit">BB</span></div>
        <div class="hero-summary-row-stat">${heroPos}</div>
        <div class="hero-summary-row-stat accent tappable" data-info="ICM">${heroEqPct.toFixed(1)}<span class="unit">%</span></div>
      </div>
      ${villainRow}
      <div class="hero-summary-grid">
        <div class="hero-summary-item" data-info="BF">
          <div class="hero-summary-label tappable">BF ⓘ</div>
          <div class="hero-summary-value ${bfClass}">${a.bf.toFixed(2)}</div>
        </div>
        <div class="hero-summary-item" data-info="必要勝率">
          <div class="hero-summary-label tappable">必要勝率 ⓘ</div>
          <div class="hero-summary-value">${(a.requiredEq * 100).toFixed(1)}<span class="unit">%</span></div>
        </div>
        <div class="hero-summary-item" data-info="RP">
          <div class="hero-summary-label tappable">RP ⓘ</div>
          <div class="hero-summary-value warn">+${(a.rp * 100).toFixed(1)}<span class="unit">%</span></div>
        </div>
      </div>
    </div>
  `;
}

// ===== BF マトリックス =====

/** BF を hue（緑 → 黄 → 赤）に対応付けて HSL 文字列を返す。 */
function bfBackground(bf: number): string {
  if (!Number.isFinite(bf)) return "#444";
  const clamped = Math.max(0.6, Math.min(1.4, bf));
  // 0.6 → hue 130 (deep green), 1.0 → hue 60 (yellow), 1.4 → hue 0 (red)
  const t = (clamped - 0.6) / 0.8;
  const hue = 130 - t * 130;
  // 1.0 付近は彩度を抑え、両端は強める
  const sat = 50 + Math.abs(clamped - 1.0) * 30;
  const light = 32 - Math.abs(clamped - 1.0) * 4;
  return `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
}

/** BF を所与に、1:1ポット時の Risk Premium を返す（百分率）。 */
function bfRiskPremiumPct(bf: number): number {
  if (!Number.isFinite(bf)) return 0;
  // cEV breakeven (1:1 ポット) = 50%
  // $EV breakeven = bf / (bf + 1)
  return (bf / (bf + 1) - 0.5) * 100;
}

/**
 * 横スクロール可能 (scrollWidth > clientWidth) な時だけ、右端フェード表示と
 * 「→ 横にスクロール」ヒントを出す。9人時など右列が画面外に隠れて気づけない問題への対処。
 */
function updateBFMatrixScrollState(): void {
  const outer = document.getElementById("bf-matrix-outer");
  const hint = document.getElementById("bf-matrix-scroll-hint");
  if (!outer) return;
  const scrollable = bfMatrix.scrollWidth > bfMatrix.clientWidth + 1;
  outer.classList.toggle("scrollable", scrollable);
  hint?.classList.toggle("hidden", !scrollable);
}

function renderBFMatrix(stacks: number[], payouts: number[]): void {
  const n = stacks.length;
  if (n < 2) {
    bfMatrix.innerHTML = "";
    updateBFMatrixScrollState();
    return;
  }

  // CSS Grid: 1列目はラベル列、残り n 列はデータ。すべて 1fr。
  bfMatrix.style.gridTemplateColumns = `auto repeat(${n}, 1fr)`;

  const cells: string[] = [];

  // ラベル: ポジ指定があればポジ表記、なければ P1/P2/...
  const labelOf = (idx: number): string => {
    const pos = players[idx]?.position;
    if (pos && pos.length > 0) return pos;
    return `P${idx + 1}`;
  };

  // 1行目: 角空白 + ヘッダ
  cells.push('<div class="bf-hdr-corner"></div>');
  for (let j = 0; j < n; j++) {
    cells.push(
      `<div class="bf-hdr-col">${labelOf(j)}<span class="stack-info">${stacks[j]}</span></div>`,
    );
  }

  // 2行目以降
  for (let i = 0; i < n; i++) {
    cells.push(
      `<div class="bf-hdr-row">${labelOf(i)}<span class="stack-info">${stacks[i]}</span></div>`,
    );
    for (let j = 0; j < n; j++) {
      if (i === j) {
        cells.push('<div class="bf-diag"></div>');
        continue;
      }
      const heroStack = stacks[i]!;
      const villainStack = stacks[j]!;
      const risk = Math.min(heroStack, villainStack);
      if (risk <= 0) {
        cells.push('<div class="bf-cell" style="background:#222">—</div>');
        continue;
      }
      try {
        const r = calculateBubbleFactor({
          stacks,
          payouts,
          heroIndex: i,
          villainIndex: j,
          riskChips: risk,
        });
        const bg = bfBackground(r.bf);
        const rp = bfRiskPremiumPct(r.bf);
        const rpStr = (rp >= 0 ? "+" : "") + rp.toFixed(1);
        cells.push(
          `<div class="bf-cell" style="background:${bg}"><span class="bf-rp">${rpStr}%</span><span class="bf-val">${r.bf.toFixed(2)}</span></div>`,
        );
      } catch {
        cells.push('<div class="bf-cell" style="background:#444">—</div>');
      }
    }
  }

  bfMatrix.innerHTML = cells.join("");
  updateBFMatrixScrollState();
}

// ===== 用語解説モーダル =====
const INFO_TEXTS: Record<string, { title: string; body: string }> = {
  ICM: {
    title: "ICM (Independent Chip Model)",
    body: `
      <p>トナメの<strong>チップを「今すぐ$に換金したらいくら？」</strong>に変換する計算式。</p>
      <p>賞金は順位ごとに固定なので、チップ 2倍 ≠ 賞金 2倍。<br />
      バストすると最低順位の賞金しか貰えない非対称性を反映する。</p>
      <p>ICM% は <code>その人の $EV ÷ 総賞金</code>。例: 25% = 平均すると総賞金の 1/4 を持っていける期待値。</p>
    `,
  },
  BF: {
    title: "BF (Bubble Factor)",
    body: `
      <p><strong>「チップの痛さ ÷ チップの嬉しさ」</strong>を表す係数。HU all-in 想定。</p>
      <ul>
        <li><strong>1.00</strong>: チップ ⇄ $ がリニア (ICM 圧ゼロ)</li>
        <li><strong>1.20</strong>: 「100失う痛さ = 83取る嬉しさ」→ 20%余分にタイト</li>
        <li><strong>1.50+</strong>: バブル/サテライトレベル、超タイト</li>
      </ul>
      <p>厳密な定義: <code>BF = (現在 - 負け時の $) ÷ (勝ち時 - 現在の $)</code>。
      HRC / ICMIZER と同じ計算。</p>
      <p>※ 1:1 ポットオッズ時に <code>必要勝率 = BF/(BF+1)</code>。BF=1.2 なら 54.5%、BF=1.5 なら 60%。</p>
    `,
  },
  RP: {
    title: "Risk Premium (RP)",
    body: `
      <p><strong>cEV (チップ EV) と $EV (ICM EV) の差</strong>。ICM の重みでどれだけ余分に勝率が必要か。</p>
      <ul>
        <li>RP = 0%: cEV と $EV が同じ (ICM 影響なし)</li>
        <li>RP = +10%: コインフリップ (50%) でも実際は 60% 必要</li>
        <li>RP = +20%: バブル時、+30% でサテライト</li>
      </ul>
      <p>計算: <code>RP = $EV 必要勝率 − cEV 必要勝率</code></p>
      <p>1:1 オッズの場合: <code>RP = BF/(BF+1) − 50%</code></p>
    `,
  },
  必要勝率: {
    title: "必要勝率 (Required Equity)",
    body: `
      <p>このコールが <strong>EV 0 になる最低勝率</strong>。ハンドの実勝率がこれを超えるなら call、下なら fold。</p>
      <ul>
        <li><strong>cEV 必要勝率</strong>: ポット odds だけ (ICM 無視)</li>
        <li><strong>$EV 必要勝率</strong>: BF (ICM 圧) を反映、こっちが実戦判断用</li>
      </ul>
      <p>厳密式: <code>$EV = (call × BF) ÷ (call × BF + win)</code></p>
      <p>例: コール 8 BB / pot 20 BB / BF 1.4<br />
      → cEV = 8/(8+20) = 28.6%<br />
      → $EV = (8×1.4)/(8×1.4 + 20) = 11.2/31.2 = <strong>35.9%</strong><br />
      (1:1 オッズ時は <code>BF/(BF+1)</code>)</p>
    `,
  },
};

const infoModal = document.getElementById("info-modal") as HTMLDivElement | null;
const infoTitle = document.getElementById("info-modal-title") as HTMLHeadingElement | null;
const infoBody = document.getElementById("info-modal-body") as HTMLDivElement | null;
const infoClose = document.getElementById("info-modal-close") as HTMLButtonElement | null;

function openInfoModal(key: string): void {
  const info = INFO_TEXTS[key];
  if (!info || !infoModal || !infoTitle || !infoBody) return;
  infoTitle.textContent = info.title;
  infoBody.innerHTML = info.body;
  infoModal.classList.remove("hidden");
}

function closeInfoModal(): void {
  infoModal?.classList.add("hidden");
}

// ポジション逆転警告 (Section 5 用)
// この計算機は open-shove (push or fold) モデルを前提とし、
// hero の既出 commit を blind+ante のみと仮定する。
// hero が villain より先に行動するポジ (例: hero=SB, villain=BB) は
// villain が直接 push する余地がないため、このモデルでは成立しない。
// 3-bet shove (hero open → villain re-shove) は hero の raise 額が
// pot に含まれるが、本計算機はそれをモデル化しないため警告対象。
function updatePositionWarn(heroIndex: number, villainIndex: number): void {
  const warnEl = document.getElementById("position-warn");
  if (!warnEl) return;
  if (heroIndex < 0 || villainIndex < 0) {
    warnEl.classList.add("hidden");
    return;
  }
  const heroPos = players[heroIndex]?.position;
  const villainPos = players[villainIndex]?.position;
  if (!heroPos || !villainPos) {
    warnEl.classList.add("hidden");
    return;
  }
  const heroAct = actionOrderIdx(heroPos);
  const villainAct = actionOrderIdx(villainPos);
  if (heroAct < 0 || villainAct < 0) {
    warnEl.classList.add("hidden");
    return;
  }
  if (heroAct < villainAct) {
    warnEl.classList.remove("hidden");
    warnEl.innerHTML = `
      ⚠ <strong>ポジション逆転</strong>: 行動順は <code>${heroPos}(${heroAct + 1}) → ${villainPos}(${villainAct + 1})</code>。
      実戦では <strong>hero (${heroPos}) が先に行動</strong>するため、villain (${villainPos}) の open push に対して call することはあり得ません。
      (call 計算は math 上は動きますが、ポジを入れ替える方が現実的)
    `;
  } else {
    warnEl.classList.add("hidden");
  }
}

// ===== 🃏 ハンド別判定 (計算結果タブ・必要勝率カード内) =====
// クイック判断 (合成テーブルの概算) は精度と入力の手間が見合わず廃止したが、
// 「13x13グリッドでハンドをタップ→即 GO/NO GO」というインタラクションは実データに
// 基づく判定として価値が高いため、recompute() が出す必要勝率 ($EV) を使って移植する。
const hvBodyEl = $<HTMLDivElement>("hv-body");
const hvEmptyMsgEl = $<HTMLParagraphElement>("hv-empty-msg");
const hvRangePillsEl = $<HTMLDivElement>("hv-range-pills");
const hvBannerEl = $<HTMLDivElement>("hv-banner");
const hvGridEl = $<HTMLDivElement>("hv-grid");
const hvGridCountEl = $<HTMLParagraphElement>("hv-grid-count");

let hvRangePct = 30;
let hvPickedHand: HandNotation | null = null;
/** recompute() が出した必要勝率 ($EV, 0〜1)。🎯/⚔️ 未指定など計算不能時は null。 */
let hvRequiredEquity: number | null = null;

/** hvRequiredEquity と選択中のレンジ/ハンドを元にグリッドとバナーを再描画する。 */
function renderHandVerdict(): void {
  if (hvRequiredEquity === null) {
    hvBodyEl.classList.add("hidden");
    hvEmptyMsgEl.classList.remove("hidden");
    return;
  }
  hvBodyEl.classList.remove("hidden");
  hvEmptyMsgEl.classList.add("hidden");

  const reqEquity = hvRequiredEquity;
  const reqPct = reqEquity * 100;
  const villainRange = topRange(hvRangePct);

  let inRangeCount = 0;
  renderGrid(hvGridEl, (hand) => {
    const eq = equity(hand, villainRange);
    const inRange = eq >= reqEquity;
    if (inRange) inRangeCount++;
    let cls = inRange ? "in-range-hero" : "";
    if (hand === hvPickedHand) cls += " picked";
    return cls;
  });
  const coveragePct = (inRangeCount / 169) * 100;
  hvGridCountEl.textContent = `169中 ${inRangeCount} ハンド (${coveragePct.toFixed(0)}%)`;

  if (hvPickedHand) {
    const eq = equity(hvPickedHand, villainRange) * 100;
    const isCall = eq >= reqPct;
    const margin = eq - reqPct;
    hvBannerEl.classList.remove("hidden");
    hvBannerEl.classList.toggle("hv-banner-call", isCall);
    hvBannerEl.classList.toggle("hv-banner-fold", !isCall);
    const verdict = isCall
      ? `✅ コール (${margin >= 0 ? "+" : ""}${margin.toFixed(1)}%)`
      : `❌ フォールド (${margin.toFixed(1)}%)`;
    hvBannerEl.innerHTML = `<strong>${hvPickedHand}</strong>: equity ${eq.toFixed(1)}% ${isCall ? "≥" : "<"} 必要 ${reqPct.toFixed(1)}% → ${verdict}`;
  } else {
    hvBannerEl.classList.add("hidden");
    hvBannerEl.innerHTML = "";
  }
}

/** recompute() の末尾から呼ばれるフック。必要勝率 (dollarEV) か null (計算不能) を渡す。 */
function updateHandVerdictRequiredEquity(requiredEquity: number | null): void {
  hvRequiredEquity = requiredEquity;
  renderHandVerdict();
}

/** 計算結果タブの初期化・イベント配線。main.ts から一度だけ呼ぶ。 */
const BF_HOWTO_SEEN_KEY = "poker-icm-bf-howto-seen";
/** 「表の見方」details を初回表示時のみ自動で開く。以降は閉じたまま (通常の details 挙動)。 */
function initBFHowto(): void {
  const details = document.getElementById("bf-howto") as HTMLDetailsElement | null;
  if (!details) return;
  try {
    if (localStorage.getItem(BF_HOWTO_SEEN_KEY) !== "1") {
      details.open = true;
      localStorage.setItem(BF_HOWTO_SEEN_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

export function initCalculator(): void {
  initBFHowto();

  // BF マトリクスは計算結果タブが非表示 (display:none) の間は幅が0になり、
  // renderBFMatrix() 内の scrollWidth/clientWidth 判定が不正確になる。
  // ResizeObserver ならタブ切替で表示され実サイズが確定した瞬間にも発火するため、
  // タブ管理モジュール (tabs.ts) 側に手を入れずに正しく再判定できる。
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => updateBFMatrixScrollState()).observe(bfMatrix);
  }

  [callInput, potWinInput].forEach((el) => {
    el.addEventListener("input", recompute);
  });

  // 🎯⚔️スタック + Nash blinds から call / potWin を自動算出
  autofillBtn.addEventListener("click", () => {
    const heroIdx = players.findIndex((p) => p.role === "hero");
    const villainIdx = players.findIndex((p) => p.role === "villain");
    if (heroIdx < 0 || villainIdx < 0) {
      autofillHint.textContent = "⚠ 🎯自分と⚔️相手を1人ずつ指定してください";
      return;
    }
    const heroStack = players[heroIdx]!.stack;
    const villainStack = players[villainIdx]!.stack;
    const risk = Math.min(heroStack, villainStack);
    if (risk <= 0) {
      autofillHint.textContent = "⚠ スタックが0です";
      return;
    }

    const sbEl = document.getElementById("nash-sb") as HTMLInputElement | null;
    const bbEl = document.getElementById("nash-bb") as HTMLInputElement | null;
    const anteEl = document.getElementById("nash-ante") as HTMLInputElement | null;
    const sb = sbEl ? Number(sbEl.value) || 0 : DEFAULT_SB;
    const bb = bbEl ? Number(bbEl.value) || 0 : DEFAULT_BB;
    const anteRawV = anteEl ? Number(anteEl.value) || 0 : 0;
    const anteMode =
      (document.querySelector<HTMLInputElement>(
        'input[name="ante-mode"]:checked',
      )?.value ?? "total") as "total" | "perPlayer";
    const totalAnte =
      anteMode === "perPlayer" ? anteRawV * players.length : anteRawV;
    const dead = sb + bb + totalAnte;

    callInput.value = risk.toFixed(1);
    potWinInput.value = (risk + dead).toFixed(1);
    callManualOverride = false; // autofill 押したら自動追従モードに戻す

    const modeLabel = anteMode === "perPlayer" ? `1人${anteRawV}×${players.length}人` : "合計";
    autofillHint.innerHTML = `✓ コール <strong>${risk}</strong>, 純利得 <strong>${(risk + dead).toFixed(1)}</strong> = リスク ${risk} + 死に金 ${dead.toFixed(1)} (SB ${sb} + BB ${bb} + アンティ ${totalAnte.toFixed(1)} [${modeLabel}])`;
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
      const next = Math.max(0.1, cur + delta);
      input.value = next.toFixed(1);
      callManualOverride = true;
      recompute();
    });
  });

  infoClose?.addEventListener("click", closeInfoModal);
  infoModal?.addEventListener("click", (e) => {
    if (e.target === infoModal) closeInfoModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeInfoModal();
  });

  // hero-summary 内の解説可能ラベル・折りたたみボタンにクリック listener を delegate
  heroSummaryEl?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    // タイトル行右端の専用ボタン: 折りたたみ⇄展開 (ⓘ の用語解説タップとは別の判定にして競合を避ける)
    const collapseBtn = target.closest<HTMLButtonElement>("#hero-summary-collapse-btn");
    if (collapseBtn) {
      const nextCollapsed = !isHeroSummaryCollapsed();
      setHeroSummaryCollapsed(nextCollapsed);
      const body = heroSummaryEl.querySelector<HTMLElement>(".hero-summary-body");
      body?.classList.toggle("collapsed", nextCollapsed);
      collapseBtn.textContent = nextCollapsed ? "▲" : "▼";
      collapseBtn.setAttribute("aria-label", nextCollapsed ? "展開" : "折りたたみ");
      return;
    }
    const t = target.closest<HTMLElement>("[data-info]");
    if (t) {
      const key = t.dataset.info;
      if (key) openInfoModal(key);
    }
  });

  hvRangePillsEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".hv-pill");
    if (!btn || !btn.dataset.range) return;
    hvRangePillsEl.querySelectorAll(".hv-pill").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    hvRangePct = Number(btn.dataset.range);
    renderHandVerdict();
  });

  hvGridEl.addEventListener("click", (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLDivElement>(".hand-cell");
    if (!cell) return;
    hvPickedHand = cell.title;
    renderHandVerdict();
  });
}
