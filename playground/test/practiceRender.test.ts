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
