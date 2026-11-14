/**
 * 3 人同時オールインの勝率表を作る (オーバーコールの計算用)。
 *
 * 2 人対戦の勝率から 3 人の勝率を近似する方法は誤差が大きい (平均 6pt・最大 15pt) ため、
 * 169 種類のハンドの 3 つ組 (順不同・818,805 通り) をすべてモンテカルロで計算する。
 *
 * 出力: public/three-way-equity.bin
 *   3 つ組 (i ≤ j ≤ k、ALL_169_HANDS の index) の順に、[i が勝つ確率, j が勝つ確率] を
 *   各 1 byte (0..255 = 0..1) で並べる。k の分は 1 から引く。引き分けは等分。
 *   3 人が同時に持てない組 (AA / AA / AA など) は [0, 0] で、k も 0 とみなす印として
 *   両方 0 かつ別ファイルの必要はなく、読む側は「i と j が 0 なら k = 1」と区別できないため、
 *   不可能な組は [255, 255] を入れる (合計が 1 を超える値は通常あり得ない)。
 *
 * 実行: npx tsx scripts/build-three-way.mts [trials=3000] [workers=8]
 *   8 ワーカーでおよそ 10〜20 分。
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { evaluate7 } from "./_fastEval.mts";
import { ALL_169_HANDS } from "../src/handRanking.ts";

const N = ALL_169_HANDS.length;
const RANK_CHARS = "23456789TJQKA";
const IMPOSSIBLE = 255;

function combosOf(hand: string): [number, number][] {
  const a = RANK_CHARS.indexOf(hand[0]!);
  const b = RANK_CHARS.indexOf(hand[1]!);
  const out: [number, number][] = [];
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (hand.length === 2) {
        if (s1 < s2) out.push([a * 4 + s1, a * 4 + s2]);
      } else if (hand[2] === "s") {
        if (s1 === s2) out.push([a * 4 + s1, b * 4 + s2]);
      } else if (s1 !== s2) out.push([a * 4 + s1, b * 4 + s2]);
    }
  }
  return out;
}

interface Job { i: number }
interface Result { i: number; data: Uint8Array }

function runWorker(): void {
  const { trials, seed0 } = workerData as { trials: number; seed0: number };
  const combos = ALL_169_HANDS.map(combosOf);
  let seed = seed0;
  const rnd = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const used = new Uint8Array(52);
  const seven = new Int32Array(7);
  const board = new Int32Array(5);
  // 3 つ組ごとの「カードが重ならない組合せ」一覧 (最大 12^3 = 1728 件、6 枚ぶんを詰めて持つ)
  const valid = new Int32Array(1728 * 6);

  parentPort!.on("message", (job: Job | null) => {
    if (job === null) {
      parentPort!.close();
      return;
    }
    const i = job.i;
    const out: number[] = [];
    for (let j = i; j < N; j++) {
      for (let k = j; k < N; k++) {
        // 重ならない組合せを列挙
        let count = 0;
        for (const a of combos[i]!) {
          for (const b of combos[j]!) {
            if (b[0] === a[0] || b[0] === a[1] || b[1] === a[0] || b[1] === a[1]) continue;
            for (const c of combos[k]!) {
              if (c[0] === a[0] || c[0] === a[1] || c[1] === a[0] || c[1] === a[1]) continue;
              if (c[0] === b[0] || c[0] === b[1] || c[1] === b[0] || c[1] === b[1]) continue;
              const base = count * 6;
              valid[base] = a[0]; valid[base + 1] = a[1];
              valid[base + 2] = b[0]; valid[base + 3] = b[1];
              valid[base + 4] = c[0]; valid[base + 5] = c[1];
              count++;
            }
          }
        }
        if (count === 0) {
          out.push(IMPOSSIBLE, IMPOSSIBLE);
          continue;
        }
        let w0 = 0;
        let w1 = 0;
        for (let t = 0; t < trials; t++) {
          const base = Math.floor(rnd() * count) * 6;
          used.fill(0);
          for (let x = 0; x < 6; x++) used[valid[base + x]!] = 1;
          let filled = 0;
          while (filled < 5) {
            const card = Math.floor(rnd() * 52);
            if (used[card]) continue;
            used[card] = 1;
            board[filled++] = card;
          }
          for (let x = 0; x < 5; x++) seven[2 + x] = board[x]!;
          seven[0] = valid[base]!; seven[1] = valid[base + 1]!;
          const s0 = evaluate7(seven);
          seven[0] = valid[base + 2]!; seven[1] = valid[base + 3]!;
          const s1 = evaluate7(seven);
          seven[0] = valid[base + 4]!; seven[1] = valid[base + 5]!;
          const s2 = evaluate7(seven);
          const best = s0 > s1 ? (s0 > s2 ? s0 : s2) : s1 > s2 ? s1 : s2;
          const share = 1 / ((s0 === best ? 1 : 0) + (s1 === best ? 1 : 0) + (s2 === best ? 1 : 0));
          if (s0 === best) w0 += share;
          if (s1 === best) w1 += share;
        }
        // 0..254 に丸める (255 は「不可能」の印)
        out.push(Math.min(254, Math.round((w0 / trials) * 254)), Math.min(254, Math.round((w1 / trials) * 254)));
      }
    }
    const data = Uint8Array.from(out);
    parentPort!.postMessage({ i, data } as Result, [data.buffer]);
  });
}

async function main(): Promise<void> {
  const trials = Number(process.argv[2]) || 3000;
  const workers = Number(process.argv[3]) || 8;
  // i ごとの先頭位置 (3 つ組の通し番号)
  const tripleCountFrom = (i: number): number => {
    const m = N - i; // j, k は i..N-1 の m 個から重複ありで 2 つ
    return (m * (m + 1)) / 2;
  };
  const offsets: number[] = [];
  let total = 0;
  for (let i = 0; i < N; i++) {
    offsets.push(total);
    total += tripleCountFrom(i);
  }
  const buffer = new Uint8Array(total * 2);
  const started = Date.now();
  let next = 0;
  let done = 0;

  await new Promise<void>((resolve, reject) => {
    let live = 0;
    for (let w = 0; w < workers; w++) {
      const worker = new Worker(new URL("./_workerBoot.mjs", import.meta.url), {
        workerData: { entry: fileURLToPath(import.meta.url), trials, seed0: 1000003 * (w + 1) },
      });
      live++;
      const dispatch = (): void => {
        if (next < N) worker.postMessage({ i: next++ } as Job);
        else worker.postMessage(null);
      };
      worker.on("message", (result: Result) => {
        buffer.set(result.data, offsets[result.i]! * 2);
        done++;
        if (done % 10 === 0 || done === N) {
          const sec = Math.round((Date.now() - started) / 1000);
          console.log(`${done}/${N} ハンドぶん完了 (${sec}s)`);
        }
        dispatch();
      });
      worker.on("error", reject);
      worker.on("exit", () => {
        live--;
        if (live === 0) resolve();
      });
      dispatch();
    }
  });

  const outPath = fileURLToPath(new URL("../public/three-way-equity.bin", import.meta.url));
  writeFileSync(outPath, buffer);
  console.log(`書き出し: ${outPath} (${total} 組・${buffer.length} bytes・trials=${trials}・${Math.round((Date.now() - started) / 1000)}s)`);
}

if (isMainThread) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  runWorker();
}
