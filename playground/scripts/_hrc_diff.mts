import { solveHUNash } from "../../core/src/nash.js";
import { huEquity } from "../src/huEquityMatrix.js";
import { ALL_169_HANDS } from "../src/handRanking.js";

// HRC の SB push range (80.1%): 22+ 8x+ 72s+ 73o+ 62s+ 63o+ 52s+ 53o+ 42s+ 32s
// HRC の BB call range (68.0%): 22+ Qx+ J2s+ J3o+ T2s+ T6o+ 95s+ 96o+ 85s+ 87o 75s+
// これらをパースして比較

// HRC range notation: "22+ 8x+ 72s+ 73o+ ..." を 169 ハンド集合に変換
// 簡略実装: 主要なパターンだけサポート
function parseHRCRange(notation: string): Set<string> {
  const out = new Set<string>();
  const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
  const tokens = notation.split(/\s+/).filter(s => s.length > 0);
  for (const t of tokens) {
    // "22+" 全ペア from 22 上
    if (/^[2-9TJQKA][2-9TJQKA]\+$/.test(t)) {
      const r = t[0]!;
      const idx = RANKS.indexOf(r);
      for (let i = 0; i <= idx; i++) {
        out.add(`${RANKS[i]}${RANKS[i]}`);
      }
      continue;
    }
    // "8x+" "Jx+" 等: 任意の X 以上の同じ rank 含むハンド
    if (/^[2-9TJQKA]x\+$/.test(t)) {
      const r = t[0]!;
      const idx = RANKS.indexOf(r);
      for (let i = 0; i <= idx; i++) {
        for (let j = 0; j < RANKS.length; j++) {
          if (i === j) out.add(`${RANKS[i]}${RANKS[i]}`);
          else if (i < j) {
            out.add(`${RANKS[i]}${RANKS[j]}s`);
            out.add(`${RANKS[i]}${RANKS[j]}o`);
          }
        }
      }
      continue;
    }
    // "72s+" "73o+" 等: 同じ高い rank で suit/offsuit 一致、低い rank が指定値以上
    const m1 = /^([2-9TJQKA])([2-9TJQKA])([so])\+$/.exec(t);
    if (m1) {
      const high = m1[1]!, low = m1[2]!, suit = m1[3]!;
      const hIdx = RANKS.indexOf(high), lIdx = RANKS.indexOf(low);
      for (let l = lIdx; l > hIdx; l--) {
        out.add(`${high}${RANKS[l]}${suit}`);
      }
      continue;
    }
    // "5x" や個別ハンド
    if (/^[2-9TJQKA]x$/.test(t)) {
      const r = t[0]!;
      for (const r2 of RANKS) {
        if (r === r2) out.add(`${r}${r}`);
        else if (RANKS.indexOf(r) < RANKS.indexOf(r2)) {
          out.add(`${r}${r2}s`);
          out.add(`${r}${r2}o`);
        }
      }
      continue;
    }
    if (/^[2-9TJQKA][2-9TJQKA][so]?$/.test(t)) {
      out.add(t);
      continue;
    }
  }
  return out;
}

const hrcSB = parseHRCRange("22+ 8x+ 72s+ 73o+ 62s+ 63o+ 52s+ 53o+ 42s+ 32s");
const hrcBB = parseHRCRange("22+ Qx+ J2s+ J3o+ T2s+ T6o+ 95s+ 96o+ 85s+ 87o 75s+");

console.log("HRC SB push 推定:", hrcSB.size, "/ 169 =", (hrcSB.size/169*100).toFixed(1)+"%");
console.log("HRC BB call 推定:", hrcBB.size, "/ 169 =", (hrcBB.size/169*100).toFixed(1)+"%");

const result = solveHUNash({
  stacks: [8, 8, 8, 8],
  payouts: [50],
  sbIndex: 0,
  bbIndex: 1,
  sb: 0.5,
  bb: 1.0,
  ante: 0.25,
  huEquity,
  allHands: ALL_169_HANDS,
  maxIterations: 500,
  convergenceTolerance: 0.005,
});

const ourSB = result.sbPushRange;
const ourBB = result.bbCallRange;
console.log("\n当アプリ SB push:", ourSB.size, "/ 169 =", (ourSB.size/169*100).toFixed(1)+"%");
console.log("当アプリ BB call:", ourBB.size, "/ 169 =", (ourBB.size/169*100).toFixed(1)+"%");

// 差分
const sbExtra = [...ourSB].filter(h => !hrcSB.has(h)).sort();
const sbMissing = [...hrcSB].filter(h => !ourSB.has(h)).sort();
const bbExtra = [...ourBB].filter(h => !hrcBB.has(h)).sort();
const bbMissing = [...hrcBB].filter(h => !ourBB.has(h)).sort();

console.log("\n--- SB push 差分 ---");
console.log("当アプリのみ push (HRC は fold):", sbExtra.join(" ") || "(なし)");
console.log("HRC のみ push (当アプリ は fold):", sbMissing.join(" ") || "(なし)");
console.log("\n--- BB call 差分 ---");
console.log("当アプリのみ call:", bbExtra.join(" ") || "(なし)");
console.log("HRC のみ call:", bbMissing.join(" ") || "(なし)");
