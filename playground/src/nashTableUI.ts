// ===== Nash タブ: 全員ぶんの一覧表 =====
//
// 「誰が最初に押すか」ごとに、押す人のレンジと、後ろにいる全員のコールレンジを
// 1 つの表に並べる (Nash 計算ツールで一般的な形)。自分 / 相手の指定には依らない。
//   BTN が押す        32.1%  22+ Ax K5s+ …
//     └ SB がコール   20.1%  22+ A2s+ …
//     └ BB がコール   24.3%  22+ A2s+ …
// 行をタップすると、その行の 13x13 の表がすぐ下に開く (もう一度タップで閉じる)。
//
// 押す人の数だけ Nash を解くので、1 人ぶんずつ間を空けて計算し、できた分から描画する。
import { comboPctOfRange, type HandNotation } from "./handRanking.js";
import { hasHUMatrix } from "./huEquityMatrix.js";
import { renderGrid } from "./grid.js";
import { createNashChain, type CallerNash, type NashChain, type PusherNash } from "./nashRange.js";
import { hasThreeWayTable, loadThreeWayTable } from "./threeWay.js";
import { rangeToText } from "./rangeText.js";
import { PUSH_FOLD_CAUTION_MAX_BB } from "./pushSpot.js";
import { t } from "./i18n.js";
import { players, parseList, DEFAULT_SB, DEFAULT_BB } from "./appState.js";
import { payoutsInput, nashSbInput, nashBbInput, nashAnteInput } from "./domRefs.js";

interface TableState {
  key: string;
  /** 押す人の index (行動順)。 */
  pushers: readonly number[];
  /** 後ろの席から 1 席ずつ解く入れ物 (降りたときの損得は次の席の結果で決まるため)。 */
  chain: NashChain | null;
  /** 解き終わった分 (押す人の index → 結果)。後ろの席から埋まっていく。 */
  solved: Map<number, PusherNash>;
  /** これ以上解く席がない。 */
  finished: boolean;
  error: string | null;
  /** error の理由が「位置が全員ぶん決まっていない」か。 */
  needPositions: boolean;
}

let state: TableState | null = null;
/** 開いている行。"p{pusher}" か "p{pusher}c{caller}"。 */
let openRow: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let threeWayTried = false;

function inputKey(): string {
  return JSON.stringify([
    players.map(({ stack, position }) => [stack, position]),
    payoutsInput.value, nashSbInput.value, nashBbInput.value, nashAnteInput.value,
  ]);
}

function roleBadge(index: number): string {
  const role = players[index]?.role;
  if (role === "hero") return ` <span class="icm-role hero">${t("calc.summary.hero")}</span>`;
  if (role === "villain") return ` <span class="icm-role villain">${t("calc.summary.villain")}</span>`;
  return "";
}

type RowKind = "push" | "call" | "overcall";

/**
 * 1 行ぶん。開いている行 (openRow と一致) のすぐ下に 13x13 の表を置く。
 * コール行は、自分かその下のオーバーコール行が開いている間、オーバーコールの行を並べる。
 */
function rowHtml(key: string, kind: RowKind, index: number, range: ReadonlySet<HandNotation>, caller?: CallerNash): string {
  const pos = players[index]?.position ?? "";
  const open = openRow === key;
  const expanded = open || (kind === "call" && openRow !== null && openRow.startsWith(`${key}o`));
  const label = t(kind === "push" ? "nash.table.push" : kind === "call" ? "nash.table.call" : "nash.table.overcall", { pos });
  const branch = kind === "push" ? "" : `<span class="nash-row-branch" aria-hidden="true">${kind === "call" ? "└" : "└└"}</span>`;
  const overcallers = (caller?.overcalls ?? []).filter((o) => o.range.size > 0);
  // 閉じているコール行には「このあとさらにコールする人」を 1 行で添える
  const overcallSummary = kind === "call" && overcallers.length > 0 && !expanded
    ? `<span class="nash-row-oc">${t("nash.table.overcallSummary", {
        list: overcallers.map((o) => `${players[o.index]?.position ?? ""} ${comboPctOfRange(o.range).toFixed(1)}%`).join(" / "),
      })}</span>`
    : "";
  const overcallRows = kind === "call" && expanded
    ? (caller?.overcalls ?? []).map((o) => rowHtml(`${key}o${o.index}`, "overcall", o.index, o.range)).join("")
    : "";
  return `
    <button type="button" class="nash-row ${kind}${expanded ? " open" : ""}" data-nash-row="${key}" aria-expanded="${expanded}">
      <span class="nash-row-label">${branch}${label}${roleBadge(index)}</span>
      <span class="nash-row-pct">${comboPctOfRange(range).toFixed(1)}%</span>
      <span class="nash-row-text">${rangeToText(range) || t("nash.table.none")}</span>
      ${overcallSummary}
    </button>
    ${open ? `<div class="hand-grid nash-row-grid" data-nash-grid="${key}"></div>` : ""}${overcallRows}`;
}

function render(): void {
  const el = document.getElementById("nash-table");
  const status = document.getElementById("nash-table-status");
  if (!el || !status) return;
  if (!state) {
    el.innerHTML = "";
    status.textContent = "";
    return;
  }
  if (state.error) {
    // 位置が足りないときは、空いている位置を入れるボタンを添える (押すと setupPlayers が埋めて再計算)
    el.innerHTML = state.needPositions
      ? `<button type="button" class="workspace-secondary" data-fill-positions>${t("nash.table.fillPositions")}</button>`
      : "";
    status.textContent = state.error;
    return;
  }
  status.textContent = state.finished ? "" : t("nash.table.calculating", { done: state.solved.size, total: state.pushers.length });

  const ranges = new Map<string, { range: ReadonlySet<HandNotation>; kind: RowKind }>();
  const html: string[] = [];
  state.pushers.forEach((pusher) => {
    const result = state!.solved.get(pusher);
    if (!result) return;
    const eff = Math.max(...result.callers.map((c) => Math.min(players[pusher]!.stack, players[c.index]!.stack)));
    const pushKey = `p${pusher}`;
    ranges.set(pushKey, { range: result.pushRange, kind: "push" });
    html.push(`<div class="nash-group">${rowHtml(pushKey, "push", pusher, result.pushRange)}`);
    for (const caller of result.callers) {
      const key = `p${pusher}c${caller.index}`;
      ranges.set(key, { range: caller.range, kind: "call" });
      for (const o of caller.overcalls) ranges.set(`${key}o${o.index}`, { range: o.range, kind: "overcall" });
      html.push(rowHtml(key, "call", caller.index, caller.range, caller));
    }
    if (eff > PUSH_FOLD_CAUTION_MAX_BB) html.push(`<p class="hint nash-group-note">${t("nash.table.deep", { eff: String(Number(eff.toFixed(1))) })}</p>`);
    if (!result.withOvercall && result.callers.length > 1) html.push(`<p class="hint nash-group-note">${t("nash.table.noOvercall")}</p>`);
    if (!result.converged) html.push(`<p class="hint nash-group-note">${t("nash.notConverged")}</p>`);
    html.push("</div>");
  });
  el.innerHTML = html.join("");

  const gridEl = el.querySelector<HTMLDivElement>("[data-nash-grid]");
  const opened = openRow ? ranges.get(openRow) : undefined;
  if (gridEl && opened) {
    const cls = opened.kind === "push" ? "in-range-villain" : "in-range-hero";
    renderGrid(gridEl, (hand) => (opened.range.has(hand) ? cls : ""));
  }
}

function solveNext(): void {
  timer = null;
  const current = state;
  if (!current || current.error || current.finished || !current.chain) return;
  if (current.key !== inputKey()) {
    ensureNashTable();
    return;
  }
  try {
    const result = current.chain.next();
    if (result) current.solved.set(result.pusherIndex, result);
    else current.finished = true;
  } catch (err) {
    current.error = err instanceof Error ? err.message : String(err);
  }
  render();
  if (!current.error && !current.finished) timer = setTimeout(solveNext, 0);
}

/** Nash タブが表示中で、入力が変わっていれば一覧を作り直す。recompute とビュー切替から呼ぶ。 */
export function ensureNashTable(): void {
  if (document.body.dataset.activeTab !== "analyze" || document.body.dataset.analysisView !== "nash") return;
  // 3 人の勝率表 (オーバーコール用) をまだ読んでいなければ、先に読む。読めなくても計算は続ける
  if (!hasThreeWayTable() && !threeWayTried) {
    threeWayTried = true;
    const status = document.getElementById("nash-table-status");
    if (status) status.textContent = t("nash.table.loading");
    void loadThreeWayTable().then(() => {
      state = null;
      ensureNashTable();
    });
    return;
  }
  const key = inputKey();
  if (state?.key === key) {
    // 計算は同じでも、自分 / 相手の印は変わっていることがあるので描き直す
    render();
    return;
  }
  if (timer !== null) clearTimeout(timer);
  timer = null;
  openRow = null;
  const payouts = parseList(payoutsInput.value);
  let error: string | null = null;
  let chain: NashChain | null = null;
  let needPositions = false;
  if (!hasHUMatrix()) error = t("nash.matrixMissing");
  else if (payouts.length === 0 || !payouts.some((p) => p > 0)) error = t("nash.err.needPayout");
  else {
    chain = createNashChain(
      players,
      payouts,
      Number(nashSbInput.value) || DEFAULT_SB,
      Number(nashBbInput.value) || DEFAULT_BB,
      Number(nashAnteInput.value) || 0,
    );
    if (!chain) {
      error = t("nash.table.needPositions");
      needPositions = true;
    }
  }
  state = { key, pushers: chain?.pushers ?? [], chain, solved: new Map(), finished: false, error, needPositions };
  render();
  if (!error) timer = setTimeout(solveNext, 0);
}

/** 行タップの開閉を配線する。main から一度だけ呼ぶ。 */
export function initNashTable(): void {
  const el = document.getElementById("nash-table");
  if (!el) return;
  el.addEventListener("click", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-nash-row]");
    if (!row) return;
    const key = row.dataset.nashRow ?? null;
    openRow = openRow === key ? null : key;
    render();
  });
  document.addEventListener("analysis-view-change", ensureNashTable);
}
