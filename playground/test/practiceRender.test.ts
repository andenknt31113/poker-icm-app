// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { renderPracticeProblem } from "../src/practice/render.js";
import { setPracticeModeSilent } from "../src/practice/generate.js";
import { makeProblem } from "./fixtures.js";

beforeEach(() => {
  document.body.innerHTML = '<div id="practice-area"></div>';
});

describe("練習のレンジ表", () => {
  it.each(["callfold", "push"] as const)("%s は表を閉じて手札と回答を優先する", (mode) => {
    setPracticeModeSilent(mode);
    renderPracticeProblem(makeProblem());
    const details = document.querySelector<HTMLDetailsElement>(".practice-range-details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toBeTruthy();
    expect(details?.querySelectorAll(".hand-cell")).toHaveLength(169);
    expect(document.querySelector(".practice-hand")?.closest("details")).toBeNull();
    expect(document.querySelectorAll(".practice-actions button")).toHaveLength(2);
    expect(document.querySelector(".practice-actions")?.closest("details")).toBeNull();
    expect(document.querySelector("#practice-table-wrapper .round-table")).not.toBeNull();
    expect(document.querySelectorAll(".practice-player-strip .practice-seat")).toHaveLength(3);
    const actions = document.querySelector(".practice-actions")!;
    expect(actions.compareDocumentPosition(details!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    if (details) details.open = true;
    expect(details?.open).toBe(true);
  });
});

describe("練習の想定レンジの表示", () => {
  it.each(["callfold", "push"] as const)("%s はコンボ比率の「上位 X%」で出す", (mode) => {
    setPracticeModeSilent(mode);
    const p = makeProblem();
    renderPracticeProblem({ ...p, villainCallRangePct: 25 });
    const card = document.querySelector(".scenario-warn")!.textContent!;
    // 種類ベースの Top 25% は 42 種類 = 全コンボの約 23%
    expect(card).toContain("上位 23%");
    expect(card).not.toContain("Top");
  });
});
