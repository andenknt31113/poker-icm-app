// ===== バウンティ (KO / PKO) の設定と、計算に渡す形への変換 =====
//
// DOM に触れない (vitest から素の Node でも import できる)。
// バウンティは Pro の機能。設定が保存されていても、Pro でなければ計算には入れない。
import type { BountySpec } from "@poker-icm/core";
import { persistedState, players, type Player } from "./appState.js";
import { isPro } from "./entitlement.js";
import { t as tr } from "./i18n.js";

/** off = バウンティなし / ko = 首を全額受け取る / pko = 半分が現金、半分が自分の首に乗る。 */
export type BountyMode = "off" | "ko" | "pko";

export const BOUNTY_MODES: readonly BountyMode[] = ["off", "ko", "pko"];

export function isBountyMode(value: unknown): value is BountyMode {
  return typeof value === "string" && (BOUNTY_MODES as readonly string[]).includes(value);
}

/** 保存値から首の額を読む。壊れた値 (負数・NaN・数値以外) は 0。 */
export function sanitizeBounty(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

let mode: BountyMode = isBountyMode(persistedState?.bounty?.mode) ? persistedState.bounty.mode : "off";

export function getBountyMode(): BountyMode {
  return mode;
}

export function setBountyMode(next: BountyMode): void {
  mode = next;
}

type SeatLike = Pick<Player, "stack" | "bounty">;

/**
 * 計算に渡すバウンティ。次のどれかなら undefined (= バウンティなしの計算):
 *   - 設定が off
 *   - Pro でない
 *   - 首が全員 0
 * チップが残っていない席の首は 0 として扱う。
 */
export function bountySpecFor(
  table: readonly SeatLike[],
  bountyMode: BountyMode,
  pro: boolean,
): BountySpec | undefined {
  if (bountyMode === "off" || !pro) return undefined;
  const heads = table.map((seat) => (seat.stack > 0 ? sanitizeBounty(seat.bounty) : 0));
  if (!heads.some((head) => head > 0)) return undefined;
  return { heads, progressive: bountyMode === "pko" };
}

/** いまの卓と設定での、計算に渡すバウンティ。 */
export function activeBounty(): BountySpec | undefined {
  return bountySpecFor(players, mode, isPro());
}

/** Nash の計算結果を使い回してよいか判定するための、バウンティ設定の要約。 */
export function bountyKey(): string {
  const spec = activeBounty();
  return spec ? `${spec.progressive ? "pko" : "ko"}:${spec.heads.join(",")}` : "off";
}

/** 入力値 (文字列) を首の額にする。空・負数・数値以外は 0。 */
export function parseBountyInput(value: string): number {
  return sanitizeBounty(Number(value));
}

const fmtAmount = (value: number): string => Number(value.toFixed(2)).toLocaleString("en-US");

/** 折りたたみ行の右側に出す、いまの設定の要約。 */
export function bountySummaryText(mode: BountyMode, heads: readonly number[], pro: boolean): string {
  if (!pro) return tr("setup.bounty.summary.locked");
  if (mode === "off") return tr("setup.bounty.summary.off");
  const label = tr(mode === "pko" ? "setup.bounty.mode.pko" : "setup.bounty.mode.ko");
  if (!heads.some((head) => head > 0)) return `${label} · ${tr("setup.bounty.summary.empty")}`;
  return `${label} · ${heads.map(fmtAmount).join(" / ")}`;
}
