import { describe, expect, it } from "vitest";
import { ja } from "../src/locales/ja.js";
import { en } from "../src/locales/en.js";

describe("用語説明の文言", () => {
  it.each([["ja", ja], ["en", en]] as const)("%s: 言い過ぎ・未確認の表現を含まない", (_name, dict) => {
    const text = Object.values(dict as Record<string, string>).join("\n");
    expect(text).not.toMatch(/余分にタイト|30% tighter|20% tighter/);
    expect(text).not.toMatch(/HRC \/ ICMIZER/);
    expect(text).not.toMatch(/True Req/);
  });

  it("必要勝率の説明は3終端の式を載せ、BF の式は概算と明記する", () => {
    const body = (ja as Record<string, string>)["info.req.body"]!;
    expect(body).toContain("(降りた時 − 負けた時) ÷ (勝った時 − 負けた時)");
    expect(body).toContain("概算");
  });

  it("必要勝率フローのラベルが両言語にある", () => {
    for (const dict of [ja, en] as Record<string, string>[]) {
      for (const key of ["calc.eq.flow.chip", "calc.eq.flow.rp", "calc.eq.flow.icm"]) {
        expect(dict[key]).toBeTruthy();
      }
    }
  });
});
