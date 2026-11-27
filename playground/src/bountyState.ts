// ===== バウンティ (KO / PKO) の設定と、計算に渡す形への変換 =====
//
// DOM に触れない (vitest から素の Node でも import できる)。
// バウンティは Pro の機能。設定が保存されていても、Pro でなければ計算には入れない。
import type { BountySpec } from "@poker-icm/core";
import { persistedState, players, type Player, type Position, type Role } from "./appState.js";
import { isPro } from "./entitlement.js";
import { t as tr } from "./i18n.js";

/** off = バウンティなし / ko = バウンティ全額を受け取る / pko = 半分が現金、半分が自分のバウンティに乗る。 */
export type BountyMode = "off" | "ko" | "pko";

export const BOUNTY_MODES: readonly BountyMode[] = ["off", "ko", "pko"];

export interface FreeBountyExample {
  readonly bountyMode: Exclude<BountyMode, "off">;
  readonly players: readonly { stack: number; role: Role; position: Position; bounty: number }[];
  readonly payouts: readonly number[];
}

/**
 * 無料ユーザーでも 1 タップでバウンティ計算の差を体感できる組み込み PKO 例題。
 * 未編集で閲覧中のあいだだけ、無料でも計算を有効化する（額の編集・形式切替は Pro）。
 */
export const FREE_BOUNTY_EXAMPLES: Record<"ft6Pko" | "ft4Pko", FreeBountyExample> = {
  ft6Pko: {
    bountyMode: "pko",
    players: [
      { stack: 22, role: "hero", position: "BB", bounty: 15 },
      { stack: 10, role: "villain", position: "SB", bounty: 30 },
      { stack: 14, role: "other", position: "UTG", bounty: 10 },
      { stack: 12, role: "other", position: "HJ", bounty: 10 },
      { stack: 7, role: "other", position: "CO", bounty: 5 },
      { stack: 26, role: "other", position: "BTN", bounty: 20 },
    ],
    payouts: [45, 25, 15, 8, 4, 3],
  },
  ft4Pko: {
    bountyMode: "pko",
    players: [
      { stack: 20, role: "hero", position: "BB", bounty: 15 },
      { stack: 9, role: "villain", position: "SB", bounty: 30 },
      { stack: 14, role: "other", position: "CO", bounty: 10 },
      { stack: 25, role: "other", position: "BTN", bounty: 20 },
    ],
    payouts: [50, 30, 20],
  },
};

const FREE_BOUNTY_EXAMPLE_LIST = Object.values(FREE_BOUNTY_EXAMPLES);

export function isBountyMode(value: unknown): value is BountyMode {
  return typeof value === "string" && (BOUNTY_MODES as readonly string[]).includes(value);
}

/** 保存値からバウンティ額を読む。壊れた値 (負数・NaN・数値以外) は 0。 */
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
 * いまの卓と形式が、未編集の組み込み無料 PKO 例題に一致するか。
 * スタックとバウンティ額の並びが完全に一致するときのみ true（自分/相手の役割入替は許容）。
 */
export function isFreeBountyExample(table: readonly SeatLike[], bountyMode: BountyMode): boolean {
  if (bountyMode === "off") return false;
  return FREE_BOUNTY_EXAMPLE_LIST.some(
    (example) =>
      example.bountyMode === bountyMode &&
      example.players.length === table.length &&
      example.players.every(
        (seat, i) =>
          table[i]!.stack === seat.stack && sanitizeBounty(table[i]!.bounty) === seat.bounty,
      ),
  );
}

/**
 * 計算に渡すバウンティ。次のどれかなら undefined (= バウンティなしの計算):
 *   - 設定が off
 *   - Pro でなく、かつ未編集の組み込み無料 PKO 例題でもない
 *   - バウンティ額が全員 0
 * チップが残っていない席のバウンティは 0 として扱う。
 */
export function bountySpecFor(
  table: readonly SeatLike[],
  bountyMode: BountyMode,
  pro: boolean,
): BountySpec | undefined {
  if (bountyMode === "off" || (!pro && !isFreeBountyExample(table, bountyMode))) return undefined;
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

/** 入力値 (文字列) をバウンティ額にする。空・負数・数値以外は 0。 */
export function parseBountyInput(value: string): number {
  return sanitizeBounty(Number(value));
}

const fmtAmount = (value: number): string => Number(value.toFixed(2)).toLocaleString("en-US");

/** 折りたたみ行の右側に出す、いまの設定の要約。 */
export function bountySummaryText(
  bountyMode: BountyMode,
  heads: readonly number[],
  pro: boolean,
  freeExample = false,
): string {
  if (!pro && !freeExample) return tr("setup.bounty.summary.locked");
  if (bountyMode === "off") return tr("setup.bounty.summary.off");
  const label = tr(bountyMode === "pko" ? "setup.bounty.mode.pko" : "setup.bounty.mode.ko");
  if (!heads.some((head) => head > 0)) return `${label} · ${tr("setup.bounty.summary.empty")}`;
  const amounts = `${label} · ${heads.map(fmtAmount).join(" / ")}`;
  return !pro && freeExample ? `${amounts} (${tr("setup.bounty.summary.exampleTag")})` : amounts;
}
