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

  it("ガイドに「計算の前提と限界」があり、扱わない場面と確かめた内容を載せる", () => {
    const jaBody = (ja as Record<string, string>)["guide.body.html"]!;
    const enBody = (en as Record<string, string>)["guide.body.html"]!;
    for (const body of [jaBody, enBody]) {
      expect(body).toContain('id="guide-limits"');
      expect(body).toContain("Malmuth-Harville");
      expect(body).toContain("58.1%");
    }
    expect(jaBody).toContain("4人以上が同時にオールインになる場合は計算しません");
    expect(jaBody).toContain("プレイヤーは 9 人まで");
    expect(jaBody).not.toContain("本ツール独自のハンド強度ランキング");
    expect(enBody).toContain("Four or more players all-in at once are not calculated");
  });

  it("ガイドの Nash の説明が、全員ぶんの一覧表という今の画面に合っている", () => {
    const jaBody = (ja as Record<string, string>)["guide.body.html"]!;
    const enBody = (en as Record<string, string>)["guide.body.html"]!;
    expect(jaBody).toContain("卓の全員ぶんの Nash");
    expect(jaBody).toContain("さらにコール");
    expect(enBody).toContain("Then also call");
    for (const body of [jaBody, enBody]) {
      // 以前の「2人だけの Nash」「計算ボタンを押す」という説明が残っていないこと
      expect(body).not.toContain("HU push/fold");
      expect(body).not.toContain("Solve Nash");
    }
  });

  it("ガイドと初回ヒントが、画面に無い名前 (プリセット・練習の絵文字) を案内しない", () => {
    for (const dict of [ja, en] as Record<string, string>[]) {
      expect(dict["firstHint.html"]).not.toContain("🎲");
      expect(dict["guide.proNote.html"]).not.toMatch(/プリセット|presets/);
    }
    expect((ja as Record<string, string>)["guide.body.html"]).toContain("チョップ（ディール）するなら");
    expect((en as Record<string, string>)["guide.body.html"]).toContain("If you chop (make a deal)");
  });
});
