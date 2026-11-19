// 19. コールする額が無い・相手がいない局面でも、計算全体がエラー文に置き換わらない
//
// 以前は core の calculateRequiredEquity が 0 以下のコール額で投げる例外を recompute() が拾い、
// ICM の表・ハンド表ごと「RequiredEquity: callAmount が不正です: 0」(英語表示でも日本語) に
// 置き換えていた。起きていたのは次の3つ:
//   - 相手 (か自分) を「他」にしたまま開き直す (コール額の欄が空のまま計算に入る)
//   - 自分か相手がブラインド・アンティを払った時点でオールインになるスタック (BB 0.5、SB 0.3 など)
//   - コール額に 0 を手入力する
// あわせて、自分が先に動く局面 (自分からオールイン) の内訳の言葉と説明、
// 降りた SB / BB の行が日本語で出ることも確かめる。
import { attachErrorCollector, assertNoErrors } from "../lib/context.mjs";

const STATE_KEY = "poker-icm-app-state-v1";
const P = (stack, role, position) => ({ stack, role, position });
const NASH = { sb: 0.5, bb: 1, ante: 1 };

async function openWithState({ baseURL, createContext }, state) {
  const context = await createContext({ pro: true });
  await context.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STATE_KEY, state });
  const page = await context.newPage();
  const errors = attachErrorCollector(page, "no-call-spots");
  await page.goto(baseURL, { waitUntil: "load" });
  await page.waitForSelector("#icm-rows tr", { state: "attached" });
  return { context, page, errors };
}

function readout(page) {
  return page.evaluate(() => ({
    icmRows: document.querySelectorAll("#icm-rows tr").length,
    body: document.body.textContent ?? "",
    eq: document.getElementById("eq-result")?.textContent ?? "",
    range: document.getElementById("range-unavailable")?.textContent ?? "",
    summaryActive: document.getElementById("hero-summary")?.classList.contains("active") ?? false,
    note: document.getElementById("position-warn")?.classList.contains("hidden") ? "" : document.getElementById("position-warn")?.textContent ?? "",
    autofill: document.getElementById("autofill-hint")?.textContent ?? "",
  }));
}

function expectNoRawError(out, label) {
  if (/RequiredEquity|callAmount|potIfWin/.test(out.body)) throw new Error(`${label}: 内部のエラー文が画面に出ています`);
  if (out.icmRows < 2) throw new Error(`${label}: ICM の表が出ていません (${out.icmRows} 行)`);
}

export default async function testNoCallSpots(opts) {
  // 1. 相手がいない卓を開き直す
  {
    const { context, page, errors } = await openWithState(opts, {
      players: [P(18, "hero", "BB"), P(14, "other", "SB"), P(20, "other", "BTN")], payouts: [50, 30, 20], nash: NASH,
    });
    const out = await readout(page);
    expectNoRawError(out, "相手なし");
    if (!out.range.includes("相手")) throw new Error(`相手なし: ハンド表に相手を選ぶ案内がありません: ${out.range}`);
    if (out.summaryActive) throw new Error("相手なし: 上のカードに数字が出ています");
    assertNoErrors(errors, "相手なし");
    await context.close();
  }
  // 2. ブラインドだけでオールイン (自分 BB 0.5 / 相手 SB 0.3)
  for (const [label, players] of [
    ["自分 BB 0.5", [P(0.5, "hero", "BB"), P(14, "villain", "SB"), P(20, "other", "BTN")]],
    ["相手 SB 0.3", [P(18, "hero", "BB"), P(0.3, "villain", "SB"), P(20, "other", "BTN")]],
  ]) {
    const { context, page, errors } = await openWithState(opts, { players, payouts: [50, 30, 20], nash: NASH });
    const out = await readout(page);
    expectNoRawError(out, label);
    if (!out.eq.includes("コールする額がありません") || !out.range.includes("コールする額がありません")) {
      throw new Error(`${label}: コールする額が無いことの案内がありません: eq=${out.eq} range=${out.range}`);
    }
    if (out.summaryActive) throw new Error(`${label}: 上のカードに数字が出ています`);
    assertNoErrors(errors, label);
    await context.close();
  }
  // 3. コール額に 0 を手入力 → 案内 → 自動算出に戻すと元どおり
  {
    const { context, page, errors } = await openWithState(opts, {
      players: [P(18, "hero", "BB"), P(14, "villain", "SB"), P(20, "other", "BTN")], payouts: [50, 30, 20], nash: NASH,
    });
    await page.click('[data-jump="sec-icm"]');
    await page.fill("#call", "0");
    let out = await readout(page);
    expectNoRawError(out, "コール額 0");
    if (!out.eq.includes("0 より大きい数")) throw new Error(`コール額 0: 入力の案内がありません: ${out.eq}`);
    await page.click("#autofill-call");
    out = await readout(page);
    if (!/49\.8%/.test(out.eq) || !out.summaryActive) throw new Error(`自動算出に戻しても数字が戻りません: ${out.eq}`);
    assertNoErrors(errors, "コール額 0");
    await context.close();
  }
  // 4. 自分が先に動く (自分 SB / 相手 BB): 説明と内訳の言葉が「自分からオールイン」になる
  {
    const { context, page, errors } = await openWithState(opts, {
      players: [P(8, "hero", "SB"), P(20, "villain", "BB"), P(20, "other", "BTN"), P(15, "other", "CO")], payouts: [50, 30, 20], nash: NASH,
    });
    const out = await readout(page);
    expectNoRawError(out, "自分 SB");
    if (!out.note.includes("自分(SB)が先に動く")) throw new Error(`自分 SB: 向きの説明がありません: ${out.note}`);
    if (/ポジション逆転|あり得ません/.test(out.body)) throw new Error("自分 SB: 計算と食い違う「ポジション逆転」の警告が出ています");
    if (!out.autofill.includes("追加で出す額") || !out.autofill.includes("相手(BB)のコール") || !out.autofill.includes("コールされて勝つ")) {
      throw new Error(`自分 SB: 内訳が自分からオールインする言葉になっていません: ${out.autofill}`);
    }
    assertNoErrors(errors, "自分 SB");
    await context.close();
  }
  // 5. ブラインドの2人が降りている (相手 CO / 自分 BTN): 降りた SB・BB の行が日本語
  {
    const { context, page, errors } = await openWithState(opts, {
      players: [P(15, "hero", "BTN"), P(10, "villain", "CO"), P(20, "other", "SB"), P(25, "other", "BB")], payouts: [50, 30, 20], nash: NASH,
    });
    const out = await readout(page);
    expectNoRawError(out, "相手 CO");
    if (/SB dead|BB dead|folded/.test(out.autofill)) throw new Error(`相手 CO: 内訳に英語が残っています: ${out.autofill}`);
    if (!out.autofill.includes("SB のブラインド") || !out.autofill.includes("BB のブラインド")) {
      throw new Error(`相手 CO: 降りた SB・BB の行がありません: ${out.autofill}`);
    }
    if (out.note) throw new Error(`相手 CO: 相手が先に動く局面で向きの説明が出ています: ${out.note}`);
    assertNoErrors(errors, "相手 CO");
    await context.close();
  }
}
