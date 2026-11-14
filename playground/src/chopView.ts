// ===== 賞金・BF: チョップ (ディール) の表 =====
// recompute() から全員のスタックと賞金を受け取り、ICM チョップとチップ比例の
// 金額を表にする。刻み (丸め) だけこの画面の状態として持つ。
import { calculateChop } from "./chop.js";
import { players } from "./appState.js";
import { t } from "./i18n.js";

/** 刻みを選べるのは、賞金の合計がその刻みの何倍以上あるときか。 */
const MIN_UNITS_IN_TOTAL = 20;

let roundingUnit = 0;
let lastStacks: number[] = [];
let lastPayouts: number[] = [];

function fmtAmount(value: number, unit: number): string {
  if (unit > 0 || Number.isInteger(value)) return Math.round(value).toLocaleString("en-US");
  // 丸めないときは、% 入力 (小さい数) でも読めるよう小数1〜2桁まで
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 1000 ? 0 : 2 });
}

export function renderChop(stacks: readonly number[], payouts: readonly number[]): void {
  lastStacks = stacks.slice();
  lastPayouts = payouts.slice();
  const rows = document.getElementById("chop-rows");
  const totalEl = document.getElementById("chop-total");
  if (!rows || !totalEl) return;
  // 賞金が % などの小さい数で入っているときは、刻みで丸めると意味のない値になるので使わせない
  const paidTotal = payouts.slice(0, stacks.length).reduce((x, y) => x + y, 0);
  const usable = (unit: number): boolean => unit === 0 || unit <= paidTotal / MIN_UNITS_IN_TOTAL;
  if (!usable(roundingUnit)) roundingUnit = 0;
  const result = calculateChop(stacks, payouts, roundingUnit);
  rows.innerHTML = result.icm
    .map((icm, i) => {
      const player = players[i];
      const role =
        player?.role === "hero"
          ? ` <span class="icm-role hero">${t("calc.summary.hero")}</span>`
          : player?.role === "villain"
            ? ` <span class="icm-role villain">${t("calc.summary.villain")}</span>`
            : "";
      return `<tr>
        <td>${player?.position || `#${i + 1}`}${role}</td>
        <td>${stacks[i]}</td>
        <td class="chop-icm">${fmtAmount(icm, roundingUnit)}</td>
        <td class="chop-chip">${fmtAmount(result.chip[i] ?? 0, roundingUnit)}</td>
      </tr>`;
    })
    .join("");
  totalEl.textContent = t("chop.total", { total: fmtAmount(result.total, roundingUnit), n: stacks.length });
  document.querySelectorAll<HTMLButtonElement>("[data-chop-unit]").forEach((button) => {
    const active = Number(button.dataset.chopUnit) === roundingUnit;
    button.disabled = !usable(Number(button.dataset.chopUnit));
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

export function clearChop(): void {
  const rows = document.getElementById("chop-rows");
  const totalEl = document.getElementById("chop-total");
  if (rows) rows.innerHTML = "";
  if (totalEl) totalEl.textContent = "";
}

/** 刻みボタンの配線。initCalculator から一度だけ呼ぶ。 */
export function initChop(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-chop-unit]").forEach((button) => {
    button.addEventListener("click", () => {
      roundingUnit = Number(button.dataset.chopUnit) || 0;
      renderChop(lastStacks, lastPayouts);
    });
  });
}
