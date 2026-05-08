// Quick smoke test for handRanking + pokersolver wiring.
import { topRange, HAND_RANK_MAP, ALL_169_HANDS } from "../src/handRanking.js";
// @ts-expect-error - pokersolver has no types
import pokersolver from "pokersolver";

const Hand = pokersolver.Hand as {
  solve: (cards: string[]) => unknown;
  winners: (hands: unknown[]) => unknown[];
};

console.log("ALL_169 size:", ALL_169_HANDS.length);
console.log("RANK_MAP size:", HAND_RANK_MAP.size);
console.log("Top 5:", Array.from(topRange(5)));
console.log("Top 100 size:", topRange(100).size);

const h1 = Hand.solve(["Ad", "As", "Jc", "Th", "2d", "3c", "Kd"]);
const h2 = Hand.solve(["Ad", "As", "Jc", "Th", "2d", "Qs", "Qd"]);
const winners = Hand.winners([h1, h2]);
console.log("winner is h2?", winners.length === 1 && winners[0] === h2);
