import { handAt, GRID_SIZE, type HandNotation } from "./handRanking.js";

/**
 * 13x13 のハンドグリッドを描画する共有ヘルパー。DOM 以外への依存はない。
 *
 * classifier: セルに付与する追加 class ("in-range-hero" / "marginal" / "" など)。
 * titleOf: セルの title 属性 (long-press ツールチップ)。既定はハンド表記そのまま。
 *   Nash のレンジ表示だけは frequency を併記する ("AKs (85%)") ためここを差し替える。
 */
export function renderGrid(
  container: HTMLDivElement,
  classifier: (hand: HandNotation) => string,
  titleOf: (hand: HandNotation) => string = (hand) => hand,
): void {
  const cells: string[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const hand = handAt(row, col);
      const extra = classifier(hand);
      const isPair = row === col;
      cells.push(
        `<div class="hand-cell ${isPair ? "pair" : ""} ${extra}" title="${titleOf(hand)}">${hand}</div>`,
      );
    }
  }
  container.innerHTML = cells.join("");
}
