// 6. プリセット/デフォルトの position-warn ゼロ化 (Issue #13)
//
// 初期状態 (DEFAULT_PLAYERS) + 全8シナリオプリセットを順に適用し、
// 計算結果タブの #position-warn (ポジション逆転警告) が常に hidden で
// あることをループで機械的に確認する。
// (深さ警告 #depth-warn-* はこの検証の対象外。20bb 超のスタック構成では
//  出て構わない = 数学的に正しい注意のため。)
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

const SCENARIO_IDS = [
  "ft9",
  "ftBubble",
  "ft6",
  "ft4",
  "ft3",
  "hu",
  "huShort",
  "satellite3",
];

async function isPositionWarnHidden(page) {
  return page.$eval("#position-warn", (el) => el.classList.contains("hidden"));
}

export default async function testPositionWarnZero({ baseURL, createContext }) {
  const context = await createContext({ tutorialDone: true, pro: true });
  try {
    const page = await context.newPage();
    const errors = attachErrorCollector(page, "position-warn-zero");

    await page.goto(baseURL, { waitUntil: "load" });

    // ---- 0. 初期状態 (DEFAULT_PLAYERS) ----
    await page.click('.tab-btn[data-tab="analyze"]');
    await page.waitForSelector("#position-warn", { state: "attached" });
    if (!(await isPositionWarnHidden(page))) {
      throw new Error("初期状態 (デフォルトサンプル) で position-warn が表示されています");
    }

    // ---- 1〜8. 全シナリオプリセット ----
    for (const id of SCENARIO_IDS) {
      await page.click('.tab-btn[data-tab="setup"]');
      await page.click(`.scenario-btn[data-scenario="${id}"]`);
      // 並びは 自分 → 相手 → 残りを行動順 (卓の並びと対応が取れるように)
      const rows = await page.$$eval("#players-list .player-row", (els) =>
        els.map((el) => ({
          role: el.classList.contains("hero") ? "hero" : el.classList.contains("villain") ? "villain" : "other",
          pos: el.querySelector(".player-pos")?.value ?? "",
        })),
      );
      const ACT_ORDER = ["UTG", "UTG+1", "MP", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
      const others = rows.slice(2).map((r) => ACT_ORDER.indexOf(r.pos));
      if (rows[0]?.role !== "hero" || rows[1]?.role !== "villain" || others.some((v, i) => i > 0 && v < others[i - 1])) {
        throw new Error(`プリセット "${id}" の席の並びが行動順ではありません: ${JSON.stringify(rows)}`);
      }
      await page.click('.tab-btn[data-tab="analyze"]');
      const hidden = await isPositionWarnHidden(page);
      if (!hidden) {
        const html = await page.$eval("#position-warn", (el) => el.innerHTML);
        throw new Error(
          `プリセット "${id}" 適用後に position-warn が表示されています: ${html}`,
        );
      }
    }

    assertNoErrors(errors, "全プリセット+デフォルトの position-warn ゼロ化確認");
  } finally {
    await context.close();
  }
}
