import { handAt, type HandNotation } from "./handRanking.js";

/** 13x13 のハンドグリッドを描画する共有ヘルパー。DOM 以外への依存はない。 */
export function renderGrid(
  container: HTMLDivElement,
  classifier: (hand: HandNotation) => string,
): void {
  const cells: string[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = handAt(row, col);
      const extra = classifier(hand);
      const isPair = row === col;
      cells.push(
        `<div class="hand-cell ${isPair ? "pair" : ""} ${extra}" title="${hand}">${hand}</div>`,
      );
    }
  }
  container.innerHTML = cells.join("");
}
