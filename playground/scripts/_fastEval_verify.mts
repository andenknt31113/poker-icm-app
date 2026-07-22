import pokersolver from "pokersolver";
import { evaluate7, cardCode, RANK_CHARS, SUIT_CHARS } from "./_fastEval.mjs";
const Hand = (pokersolver as any).Hand;

const deckStr: string[] = [];
for (const r of RANK_CHARS) for (const s of SUIT_CHARS) deckStr.push(r + s);

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const N = 500000;
let disagree = 0;
let heroWinsFast = 0, heroWinsPS = 0, chopFast = 0, chopPS = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const d = shuffle(deckStr.slice());
  const hero = [d[0]!, d[1]!], vil = [d[2]!, d[3]!], board = d.slice(4, 9);
  const hf = evaluate7([...hero, ...board].map(cardCode));
  const vf = evaluate7([...vil, ...board].map(cardCode));
  const fastRes = hf > vf ? 1 : hf < vf ? -1 : 0;
  const hs = Hand.solve([...hero, ...board]);
  const vs = Hand.solve([...vil, ...board]);
  const w = Hand.winners([hs, vs]);
  const psRes = w.length === 2 ? 0 : w[0] === hs ? 1 : -1;
  if (fastRes !== psRes) {
    disagree++;
    if (disagree <= 5) console.log("DISAGREE", { hero, vil, board, fastRes, psRes, hf, vf });
  }
  if (fastRes === 1) heroWinsFast++;
  else if (fastRes === 0) chopFast++;
  if (psRes === 1) heroWinsPS++;
  else if (psRes === 0) chopPS++;
}
const dt = (Date.now() - t0) / 1000;
console.log(`compared ${N} deals in ${dt.toFixed(1)}s, disagreements: ${disagree}`);
console.log(`heroWins fast=${heroWinsFast} ps=${heroWinsPS}, chops fast=${chopFast} ps=${chopPS}`);
