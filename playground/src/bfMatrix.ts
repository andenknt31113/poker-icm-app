// ===== BF マトリックス (全員 vs 全員の Bubble Factor 表) =====
// 計算結果タブの 1 セクション。calculator.ts の recompute() から
// renderBFMatrix() を呼ばれるだけの独立した描画モジュール。
import { calculateBubbleFactor } from "@poker-icm/core";
import { $ } from "./dom.js";
import { players } from "./appState.js";

const bfMatrix = $<HTMLDivElement>("bf-matrix");

/** BF が算出できないセル (計算例外・非有限値) の背景。 */
const BF_CELL_BG_ERROR = "#444";
/** スタック 0 でリスクが発生しないセルの背景。 */
const BF_CELL_BG_NO_RISK = "#222";

/**
 * BF を hue（緑 → 黄 → 赤）に対応付けて HSL 文字列を返す。
 *
 * 注意: 定数を式から導出しないこと。0.8 は「1.4 - 0.6」だが JS の
 * 浮動小数では 1.4 - 0.6 === 0.7999999999999998 になり hue が僅かにずれる。
 * 見た目を 1px も変えないため、リテラルのまま据え置く。
 */
function bfBackground(bf: number): string {
  if (!Number.isFinite(bf)) return BF_CELL_BG_ERROR;
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

export function renderBFMatrix(stacks: number[], payouts: number[]): void {
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
        cells.push(`<div class="bf-cell" style="background:${BF_CELL_BG_NO_RISK}">—</div>`);
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
        cells.push(`<div class="bf-cell" style="background:${BF_CELL_BG_ERROR}">—</div>`);
      }
    }
  }

  bfMatrix.innerHTML = cells.join("");
  updateBFMatrixScrollState();
}

/** BF マトリックスの初期化。calculator の initCalculator から一度だけ呼ぶ。 */
export function initBFMatrix(): void {
  // BF マトリクスは計算結果タブが非表示 (display:none) の間は幅が0になり、
  // renderBFMatrix() 内の scrollWidth/clientWidth 判定が不正確になる。
  // ResizeObserver ならタブ切替で表示され実サイズが確定した瞬間にも発火するため、
  // タブ管理モジュール (tabs.ts) 側に手を入れずに正しく再判定できる。
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => updateBFMatrixScrollState()).observe(bfMatrix);
  }
}
