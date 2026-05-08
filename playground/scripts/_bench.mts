// Quick benchmark / sanity check
import { topRange } from "../src/handRanking.js";
// @ts-expect-error - pokersolver has no types
import pokersolver from "pokersolver";
const Hand = (pokersolver as { Hand: { solve: (c: string[]) => unknown; winners: (h: unknown[]) => unknown[] } }).Hand;

const SUITS = ["s", "h", "d", "c"] as const;
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;

function combosForHand(hand: string): [string, string][] {
  const out: [string, string][] = [];
  const r1 = hand[0]!;
  const r2 = hand[1]!;
  const tail = hand[2];
  if (tail === undefined) {
    for (let i = 0; i < SUITS.length; i++)
      for (let j = i + 1; j < SUITS.length; j++)
        out.push([`${r1}${SUITS[i]!}`, `${r1}${SUITS[j]!}`]);
  } else if (tail === "s") {
    for (const s of SUITS) out.push([`${r1}${s}`, `${r2}${s}`]);
  } else {
    for (const s1 of SUITS) for (const s2 of SUITS) if (s1 !== s2) out.push([`${r1}${s1}`, `${r2}${s2}`]);
  }
  return out;
}
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }

function computeEquity(hand: string, vsRange: readonly string[], trials: number): number {
  const heroCombos = combosForHand(hand);
  const villainCombosPerHand = vsRange.map(combosForHand);
  let wins = 0; let actualTrials = 0;
  for (let t = 0; t < trials; t++) {
    const heroCards = pick(heroCombos);
    let villainCards: [string, string] | null = null;
    for (let attempt = 0; attempt < 50; attempt++) {
      const cand = pick(pick(villainCombosPerHand));
      if (cand[0] !== heroCards[0] && cand[0] !== heroCards[1] && cand[1] !== heroCards[0] && cand[1] !== heroCards[1]) {
        villainCards = cand; break;
      }
    }
    if (!villainCards) continue;
    actualTrials++;
    const used = new Set([heroCards[0], heroCards[1], villainCards[0], villainCards[1]]);
    const remaining: string[] = [];
    for (const r of RANKS) for (const s of SUITS) { const c = `${r}${s}`; if (!used.has(c)) remaining.push(c); }
    for (let i = 0; i < 5; i++) {
      const j = i + Math.floor(Math.random() * (remaining.length - i));
      const tmp = remaining[i]!; remaining[i] = remaining[j]!; remaining[j] = tmp;
    }
    const board = remaining.slice(0, 5);
    const h1 = Hand.solve([...heroCards, ...board]);
    const h2 = Hand.solve([...villainCards, ...board]);
    const winners = Hand.winners([h1, h2]);
    if (winners.length === 2) wins += 0.5;
    else if (winners.length === 1 && winners[0] === h1) wins += 1;
  }
  return wins / actualTrials;
}

const checks: Array<[string, number, string]> = [
  ["AA", 100, "≈0.85"],
  ["KK", 5, "≈0.4-0.5"],
  ["22", 50, "≈0.40"],
  ["AKs", 10, "≈0.50"],
  ["72o", 100, "≈0.34"],
];

for (const [hand, pct, expected] of checks) {
  const t0 = Date.now();
  const eq = computeEquity(hand, Array.from(topRange(pct)), 5000);
  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`${hand} vs Top${pct}% (5000 trials): ${eq.toFixed(3)}  expected ${expected}  ${dt}s`);
}
