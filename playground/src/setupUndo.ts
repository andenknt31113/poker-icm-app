let capture: (() => () => void) | undefined;
let restore: (() => void) | undefined;
let pendingInput: { input: HTMLInputElement; value: string; restore: () => void } | undefined;

export function configureSetupUndo(captureState: () => () => void): void {
  capture = captureState;
  restore = undefined;
  pendingInput = undefined;
}

export function checkpointSetup(): void {
  pendingInput = undefined;
  restore = capture?.();
  document.dispatchEvent(new Event("setup-undo-change"));
}

export function stageSetupInput(input: HTMLInputElement): void {
  const snapshot = capture?.();
  pendingInput = snapshot ? { input, value: input.value, restore: snapshot } : undefined;
}

export function commitSetupInput(input: HTMLInputElement): void {
  if (!pendingInput || pendingInput.input !== input || pendingInput.value === input.value) return;
  restore = pendingInput.restore;
  pendingInput = undefined;
  document.dispatchEvent(new Event("setup-undo-change"));
}

export function endSetupInput(): void {
  pendingInput = undefined;
}

export function canUndoSetup(): boolean {
  return restore !== undefined;
}

export function undoSetup(): void {
  pendingInput = undefined;
  const action = restore;
  restore = undefined;
  action?.();
  document.dispatchEvent(new Event("setup-undo-change"));
}
