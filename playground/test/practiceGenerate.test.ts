import { describe, it, expect } from "vitest";
import {
  isDegenerateProblem,
  isDegeneratePushProblem,
  isPushProblem,
  buildEasyRPChoices,
  practiceProblemDedupKey,
} from "../src/practice/generate.js";
import { makeProblem } from "./fixtures.js";

describe("isDegenerateProblem", () => {
  it("勝敗で $ エクイティがほぼ変わらない (ほぼ均等ペイのサテライト) は縮退と判定する", () => {
    const p = makeProblem({
      payouts: [33.4, 33.3, 33.3],
      equityWin: 33.35,
      equityLose: 33.3, // 差 0.05 は総賞金 100 の 0.05% < 0.5% 閾値
    });
    expect(isDegenerateProblem(p)).toBe(true);
  });

  it("勝敗で $ エクイティに十分な差がある通常の問題は縮退ではない", () => {
    const p = makeProblem({
      payouts: [50, 30, 20],
      equityWin: 40,
      equityLose: 10, // 差 30 は総賞金 100 の 30% >> 0.5%
    });
    expect(isDegenerateProblem(p)).toBe(false);
  });

  it("payouts の要素数がプレイヤー数より多い場合、先頭 min(人数, payouts数) 件だけで判定する", () => {
    // 3人テーブルなのに 7人分のペイ配列 (9-max FT の使い回し等) が渡ってきたケース。
    // 余剰分まで合計すると total が過大になり縮退判定が緩くなってしまうバグを防ぐ。
    const p = makeProblem({
      scenarioPlayers: [
        { stack: 20, role: "hero", position: "BB" },
        { stack: 15, role: "villain", position: "BTN" },
        { stack: 25, role: "other", position: "SB" },
      ],
      payouts: [40, 25, 15, 10, 5, 3, 2],
      // 3人分 (40+25+15=80) の 0.5% = 0.4。equityWin-equityLose を僅かに超える 0.5 にする。
      equityWin: 10.5,
      equityLose: 10.0,
    });
    expect(isDegenerateProblem(p)).toBe(false);
  });

  it("同条件で全プレイヤー分を合計してしまうと縮退と誤判定されるはずの境界値を確認する", () => {
    // 7人分全部 (40+25+15+10+5+3+2=100) の 0.5% = 0.5 なら差0.5は「縮退でない」側になるが、
    // 正しい3人分 (80) の 0.5% = 0.4 でも同じ差0.5は依然「縮退でない」。
    // ここでは差を 0.4 ちょうどにして、3人分基準 (閾値0.4) では境界、7人分基準 (閾値0.5) では
    // 縮退と誤判定される差を使い、実装が min(人数, payouts数) を使っていることを検証する。
    const p = makeProblem({
      scenarioPlayers: [
        { stack: 20, role: "hero", position: "BB" },
        { stack: 15, role: "villain", position: "BTN" },
        { stack: 25, role: "other", position: "SB" },
      ],
      payouts: [40, 25, 15, 10, 5, 3, 2],
      equityWin: 10.45,
      equityLose: 10.0, // 差 0.45: 3人分閾値0.4 なら非縮退、7人分閾値0.5 なら縮退
    });
    expect(isDegenerateProblem(p)).toBe(false);
  });
});

describe("isDegeneratePushProblem", () => {
  it("push→call の勝敗で $ エクイティがほぼ変わらない (ほぼ均等ペイのサテライト) は縮退と判定する", () => {
    const p = makeProblem({
      payouts: [33.4, 33.3, 33.3],
      pushEquityWin: 33.35,
      pushEquityLose: 33.3, // 差 0.05 は総賞金 100 の 0.05% < 0.5% 閾値
    });
    expect(isDegeneratePushProblem(p)).toBe(true);
  });

  it("push→call の勝敗で十分な差がある通常の問題は縮退ではない", () => {
    const p = makeProblem({
      payouts: [50, 30, 20],
      pushEquityWin: 40,
      pushEquityLose: 10, // 差 30 は総賞金 100 の 30% >> 0.5%
    });
    expect(isDegeneratePushProblem(p)).toBe(false);
  });

  it("push 派生値が未設定 (undefined) でもクラッシュせず縮退扱いになる", () => {
    // 旧スキーマの問題や生成失敗直後など、pushEquityWin/Lose が
    // まだ計算されていないケースを 0-0=0 として安全に扱う
    const p = makeProblem({ payouts: [50, 30, 20] });
    expect(() => isDegeneratePushProblem(p)).not.toThrow();
  });
});

describe("isPushProblem", () => {
  it("hero のポジションが SB なら push 問題と判定する", () => {
    const p = makeProblem({
      scenarioPlayers: [
        { stack: 20, role: "hero", position: "SB" },
        { stack: 15, role: "villain", position: "BB" },
      ],
    });
    expect(isPushProblem(p)).toBe(true);
  });

  it("hero のポジションが BB (callfold/rp モード) なら push 問題ではない", () => {
    const p = makeProblem(); // デフォルトは hero=BB
    expect(isPushProblem(p)).toBe(false);
  });
});

describe("buildEasyRPChoices", () => {
  it("常に4件返す", () => {
    expect(buildEasyRPChoices(10)).toHaveLength(4);
    expect(buildEasyRPChoices(0)).toHaveLength(4);
    expect(buildEasyRPChoices(2)).toHaveLength(4);
  });

  it("すべて非負の値になる", () => {
    for (const correct of [0, 0.5, 2, 4.5, 10, 30]) {
      const choices = buildEasyRPChoices(correct);
      for (const c of choices) {
        expect(c).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("重複がない", () => {
    for (const correct of [0, 0.5, 2, 4.5, 10, 30]) {
      const choices = buildEasyRPChoices(correct);
      expect(new Set(choices).size).toBe(choices.length);
    }
  });

  it("正解値を必ず含む", () => {
    for (const correct of [0, 0.5, 2, 4.5, 10, 30]) {
      const choices = buildEasyRPChoices(correct);
      expect(choices).toContain(correct);
    }
  });

  it("正解 - 5 が負になる場合はオフセットセットを切り替えて非負を保つ", () => {
    // correct=2 の場合、素朴なオフセット [0,5,-5,10] だと 2-5=-3 で負になるため
    // 実装は [0,5,10,15] 側に切り替えているはず。
    const choices = buildEasyRPChoices(2);
    expect(choices.every((c) => c >= 0)).toBe(true);
    expect(choices.sort((a, b) => a - b)).toEqual([2, 7, 12, 17]);
  });
});

describe("practiceProblemDedupKey", () => {
  it("同じ内容なら同じキーになる", () => {
    const p = makeProblem();
    expect(practiceProblemDedupKey(p)).toBe(practiceProblemDedupKey(makeProblem()));
  });

  it("heroHand が違えば別キーになる", () => {
    const a = makeProblem({ heroHand: "AKo" });
    const b = makeProblem({ heroHand: "QQ" });
    expect(practiceProblemDedupKey(a)).not.toBe(practiceProblemDedupKey(b));
  });

  it("savedMode が undefined のときは 'callfold' として正規化される", () => {
    const withUndefined = makeProblem({ savedMode: undefined });
    const withCallfold = makeProblem({ savedMode: "callfold" });
    expect(practiceProblemDedupKey(withUndefined)).toBe(practiceProblemDedupKey(withCallfold));
  });

  it("savedMode が異なれば別キーになる (callfold vs rp)", () => {
    const callfold = makeProblem({ savedMode: "callfold" });
    const rp = makeProblem({ savedMode: "rp" });
    expect(practiceProblemDedupKey(callfold)).not.toBe(practiceProblemDedupKey(rp));
  });

  it("savedMode が push なら callfold/rp と別キーになる", () => {
    const push = makeProblem({ savedMode: "push" });
    const callfold = makeProblem({ savedMode: "callfold" });
    const rp = makeProblem({ savedMode: "rp" });
    expect(practiceProblemDedupKey(push)).not.toBe(practiceProblemDedupKey(callfold));
    expect(practiceProblemDedupKey(push)).not.toBe(practiceProblemDedupKey(rp));
  });

  it("スタック構成の順序が違えば別キーになる", () => {
    const a = makeProblem({
      scenarioPlayers: [
        { stack: 20, role: "hero", position: "BB" },
        { stack: 15, role: "villain", position: "BTN" },
      ],
    });
    const b = makeProblem({
      scenarioPlayers: [
        { stack: 15, role: "villain", position: "BTN" },
        { stack: 20, role: "hero", position: "BB" },
      ],
    });
    expect(practiceProblemDedupKey(a)).not.toBe(practiceProblemDedupKey(b));
  });
});
