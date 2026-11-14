import { describe, expect, it } from "vitest";
import { rangeToText } from "../src/rangeText.js";
import { ALL_169_HANDS } from "../src/handRanking.js";

const set = (...hands: string[]) => new Set(hands);

describe("rangeToText (レンジの文字表記)", () => {
  it("ペア: AA まで続くなら「+」、途中なら範囲、1つならそのまま", () => {
    expect(rangeToText(set("AA", "KK", "QQ"))).toBe("QQ+");
    expect(rangeToText(set("TT", "99", "88"))).toBe("TT-88");
    expect(rangeToText(set("55"))).toBe("55");
    expect(rangeToText(set("AA"))).toBe("AA");
  });

  it("同じハイカード: キッカーが上まで続くなら「+」", () => {
    expect(rangeToText(set("AKs", "AQs", "AJs"))).toBe("AJs+");
    expect(rangeToText(set("KQo", "KJo", "KTo"))).toBe("KTo+");
    expect(rangeToText(set("T9s", "T8s"))).toBe("T8s+");
    expect(rangeToText(set("87s"))).toBe("87s");
  });

  it("途中だけなら範囲で書く", () => {
    expect(rangeToText(set("K9s", "K8s", "K7s"))).toBe("K9s-K7s");
    expect(rangeToText(set("AKs", "A5s", "A4s"))).toBe("AKs A5s-A4s");
  });

  it("スーテッドもオフスートも全部入るハイカードは「Ax」", () => {
    const ax = ALL_169_HANDS.filter((h) => h.length === 3 && h[0] === "A");
    expect(rangeToText(new Set(ax))).toBe("Ax");
  });

  it("HRC の表記と同じ並びになる (ペア → ハイカード順、スーテッド → オフスート)", () => {
    const range = set("AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o",
      "KQs", "KJs", "KTs", "KQo", "KJo", "QJs");
    expect(rangeToText(range)).toBe("33+ A4s+ A7o+ KTs+ KJo+ QJs");
  });

  it("空のレンジは空文字、全ハンドは全部の Ax 〜 3x とペア", () => {
    expect(rangeToText(new Set())).toBe("");
    expect(rangeToText(new Set(ALL_169_HANDS))).toBe("22+ Ax Kx Qx Jx Tx 9x 8x 7x 6x 5x 4x 3x");
  });
});
