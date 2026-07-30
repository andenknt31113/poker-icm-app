// ハンド表記・ランキング (src/handRanking.ts) のユニットテスト。
//
// このモジュールは全レンジ計算 (topRange / equity / Nash / 練習出題) の土台で、
// 「169 ハンドが一意に揃っている」ことが暗黙の前提になっている。にもかかわらず
// HAND_RANKING は手書きの配列で、重複排除と不足補完の防御コードが入っている。
// その防御が実際には発動していない (= 配列が正しく 169 件揃っている) ことを
// テストで固定し、将来レンジを編集して崩したときに気づけるようにする。
import { describe, it, expect } from "vitest";
import {
  GRID_SIZE,
  HAND_COUNT,
  HAND_RANKING,
  HAND_RANK_MAP,
  ALL_169_HANDS,
  handAt,
  rankOf,
  topRange,
  comboCount,
} from "../src/handRanking.js";

describe("グリッド定数", () => {
  it("13x13 = 169", () => {
    expect(GRID_SIZE).toBe(13);
    expect(HAND_COUNT).toBe(169);
  });
});

describe("handAt", () => {
  it("対角はペア", () => {
    expect(handAt(0, 0)).toBe("AA");
    expect(handAt(12, 12)).toBe("22");
    expect(handAt(4, 4)).toBe("TT");
  });

  it("上三角はスーテッド、下三角はオフスート", () => {
    expect(handAt(0, 1)).toBe("AKs");
    expect(handAt(1, 0)).toBe("AKo");
    expect(handAt(0, 12)).toBe("A2s");
    expect(handAt(12, 0)).toBe("A2o");
  });

  it("強いランクが必ず先に来る (KAs のような表記を作らない)", () => {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const hand = handAt(r, c);
        expect(hand).toBe(handAt(Math.min(r, c), Math.max(r, c)).replace(/s$/, r > c ? "o" : "s"));
      }
    }
  });
});

describe("ALL_169_HANDS", () => {
  it("169 件ちょうどで重複が無い", () => {
    expect(ALL_169_HANDS).toHaveLength(HAND_COUNT);
    expect(new Set(ALL_169_HANDS).size).toBe(HAND_COUNT);
  });

  it("ペア 13 / スーテッド 78 / オフスート 78 の内訳になっている", () => {
    const pairs = ALL_169_HANDS.filter((h) => h.length === 2);
    const suited = ALL_169_HANDS.filter((h) => h.endsWith("s"));
    const offsuit = ALL_169_HANDS.filter((h) => h.endsWith("o"));
    expect(pairs).toHaveLength(13);
    expect(suited).toHaveLength(78);
    expect(offsuit).toHaveLength(78);
  });

  it("全 169 クラスのコンボ合計が 1326 (= C(52,2)) になる", () => {
    const total = ALL_169_HANDS.reduce((a, h) => a + comboCount(h), 0);
    expect(total).toBe(1326);
  });
});

describe("HAND_RANKING (手書きレンジ配列) の健全性", () => {
  // handRanking.ts には「重複を除いて 169 にする」「不足分を末尾に補完する」
  // 防御コードがあるが、正常な配列ならどちらも発動しない。
  // 以下 2 件が緑である限り、その防御は保険として眠っているだけと言える。
  it("重複が無い (重複排除が発動していない)", () => {
    expect(new Set(HAND_RANKING).size).toBe(HAND_RANKING.length);
  });

  it("169 ハンドを漏れなく網羅している (不足補完が発動していない)", () => {
    const missing = ALL_169_HANDS.filter((h) => !HAND_RANKING.includes(h));
    expect(missing).toEqual([]);
    expect(HAND_RANKING).toHaveLength(HAND_COUNT);
  });

  it("ランクは 0..168 の連番で一意 (順位に穴や重複が無い)", () => {
    expect(HAND_RANK_MAP.size).toBe(HAND_COUNT);
    const ranks = [...HAND_RANK_MAP.values()].sort((a, b) => a - b);
    expect(ranks).toEqual([...Array(HAND_COUNT).keys()]);
  });

  it("AA が最強 (rank 0)", () => {
    expect(rankOf("AA")).toBe(0);
  });

  it("未知のハンドは最弱扱い", () => {
    expect(rankOf("ZZ")).toBe(HAND_COUNT - 1);
    expect(rankOf("")).toBe(HAND_COUNT - 1);
  });
});

describe("topRange", () => {
  it("0% は空、100% は全ハンド", () => {
    expect(topRange(0).size).toBe(0);
    expect(topRange(100).size).toBe(HAND_COUNT);
  });

  it("範囲外の入力は 0..100 に丸める", () => {
    expect(topRange(-50).size).toBe(0);
    expect(topRange(1000).size).toBe(HAND_COUNT);
  });

  it("必ず最強ハンドから順に含む (AA は 1% でも入る)", () => {
    expect(topRange(1).has("AA")).toBe(true);
  });

  it("percent が増えるとレンジは単調に広がる (縮まない)", () => {
    let prev = 0;
    for (let p = 0; p <= 100; p += 5) {
      const size = topRange(p).size;
      expect(size).toBeGreaterThanOrEqual(prev);
      prev = size;
    }
  });

  it("広いレンジは狭いレンジを完全に包含する", () => {
    const narrow = topRange(10);
    const wide = topRange(30);
    for (const h of narrow) expect(wide.has(h)).toBe(true);
  });
});

describe("comboCount", () => {
  it("ペア=6 / スーテッド=4 / オフスート=12", () => {
    expect(comboCount("AA")).toBe(6);
    expect(comboCount("AKs")).toBe(4);
    expect(comboCount("AKo")).toBe(12);
  });
});
