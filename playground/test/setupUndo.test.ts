// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { configureSetupUndo, checkpointSetup, undoSetup, canUndoSetup, stageSetupInput, commitSetupInput, endSetupInput } from "../src/setupUndo.js";

describe("局面の一段取り消し", () => {
  it("触っただけ・値が変わらない入力では以前の履歴を残す", () => {
    let stack = 18;
    configureSetupUndo(() => { const saved = stack; return () => { stack = saved; }; });
    checkpointSetup(); stack = 7;
    const input = document.createElement("input"); input.value = "7";
    stageSetupInput(input); commitSetupInput(input); endSetupInput();
    undoSetup(); expect(stack).toBe(18);
  });
  it("連続入力をまとめて入力開始時の状態へ戻す", () => {
    let stack = 18;
    configureSetupUndo(() => { const saved = stack; return () => { stack = saved; }; });
    const input = document.createElement("input"); input.value = "18";
    stageSetupInput(input); expect(canUndoSetup()).toBe(false);
    input.value = "2"; commitSetupInput(input); stack = 2;
    input.value = "25"; commitSetupInput(input); stack = 25;
    undoSetup(); expect(stack).toBe(18);
  });
  it("別操作後に古い入力スナップショットが復活しない", () => {
    let stack = 18;
    configureSetupUndo(() => { const saved = stack; return () => { stack = saved; }; });
    const input = document.createElement("input"); input.value = "18";
    stageSetupInput(input);
    stack = 7; checkpointSetup(); stack = 4;
    input.value = "4"; commitSetupInput(input);
    undoSetup(); expect(stack).toBe(7);
  });
  it("直前の状態へ一度だけ戻す", () => {
    let stack = 18;
    configureSetupUndo(() => {
      const saved = stack;
      return () => { stack = saved; };
    });
    expect(canUndoSetup()).toBe(false);
    checkpointSetup(); stack = 7;
    expect(canUndoSetup()).toBe(true);
    undoSetup();
    expect(stack).toBe(18);
    expect(canUndoSetup()).toBe(false);
    stack = 9; undoSetup();
    expect(stack).toBe(9);
  });
  it("次の操作で復元先を更新し、再初期化で履歴を捨てる", () => {
    let stack = 18;
    configureSetupUndo(() => {
      const saved = stack;
      return () => { stack = saved; };
    });
    checkpointSetup(); stack = 12;
    checkpointSetup(); stack = 4;
    undoSetup(); expect(stack).toBe(12);
    checkpointSetup(); configureSetupUndo(() => () => {});
    expect(canUndoSetup()).toBe(false);
  });
});
