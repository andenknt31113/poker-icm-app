// ===== 賞金・BF: チョップ (ディール) の表 =====
// recompute() から全員のスタックと賞金を受け取り、ICM チョップとチップ比例の
// 金額を表にする。刻み (丸め) だけこの画面の状態として持つ。
import { calculateChop, formatChopShareText } from "./chop.js";
import { activeBounty } from "./bountyState.js";
import { players } from "./appState.js";
import { hapticSelection, hapticSuccess } from "./haptics.js";
import { t } from "./i18n.js";
import { noteChopCopiedForReview } from "./reviewPrompt.js";
import { formatStackDisplay, formatStackShareLabel, getBbSize, getStackUnit } from "./stackUnit.js";

/** 刻みを選べるのは、賞金の合計がその刻みの何倍以上あるときか。 */
const MIN_UNITS_IN_TOTAL = 20;
const COPY_FEEDBACK_MS = 1800;

let roundingUnit = 0;
let lastStacks: number[] = [];
let lastPayouts: number[] = [];
let lastShareText = "";
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

function fmtAmount(value: number, unit: number): string {
  if (unit > 0 || Number.isInteger(value)) return Math.round(value).toLocaleString("en-US");
  // 丸めないときは、% 入力 (小さい数) でも読めるよう小数1〜2桁まで
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 1000 ? 0 : 2 });
}

async function copyPlainText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 権限や WebView 制限時はフォールバック */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function renderChop(stacks: readonly number[], payouts: readonly number[]): void {
  lastStacks = stacks.slice();
  lastPayouts = payouts.slice();
  const rows = document.getElementById("chop-rows");
  const totalEl = document.getElementById("chop-total");
  const copyBtn = document.getElementById("chop-copy-btn") as HTMLButtonElement | null;
  if (!rows || !totalEl) return;
  // 賞金が % などの小さい数で入っているときは、刻みで丸めると意味のない値になるので使わせない
  const paidTotal = payouts.slice(0, stacks.length).reduce((x, y) => x + y, 0);
  const usable = (unit: number): boolean => unit === 0 || unit <= paidTotal / MIN_UNITS_IN_TOTAL;
  if (!usable(roundingUnit)) roundingUnit = 0;
  const result = calculateChop(stacks, payouts, roundingUnit);
  const unitMode = getStackUnit();
  const bbSize = getBbSize();
  const shareRows = result.icm.map((icm, i) => {
    const player = players[i];
    const label = player?.position || `#${i + 1}`;
    const stackVal = stacks[i] ?? 0;
    return {
      label,
      stack: stackVal,
      stackDisplay: formatStackDisplay(stackVal, unitMode, bbSize),
      stackText: formatStackShareLabel(stackVal, unitMode, bbSize),
      icmText: fmtAmount(icm, roundingUnit),
      chipText: fmtAmount(result.chip[i] ?? 0, roundingUnit),
      role: player?.role,
    };
  });
  rows.innerHTML = shareRows
    .map((row) => {
      const role =
        row.role === "hero"
          ? ` <span class="icm-role hero">${t("calc.summary.hero")}</span>`
          : row.role === "villain"
            ? ` <span class="icm-role villain">${t("calc.summary.villain")}</span>`
            : "";
      return `<tr>
        <td>${row.label}${role}</td>
        <td>${row.stackDisplay}</td>
        <td class="chop-icm">${row.icmText}</td>
        <td class="chop-chip">${row.chipText}</td>
      </tr>`;
    })
    .join("");
  const totalText = t("chop.total", { total: fmtAmount(result.total, roundingUnit), n: stacks.length });
  totalEl.textContent = totalText;
  lastShareText = formatChopShareText({
    title: t("chop.h2"),
    totalText,
    icmLabel: t("chop.th.icm"),
    chipLabel: t("chop.th.chip"),
    rows: shareRows,
    bountyNote: activeBounty() ? t("chop.bountyNote") : undefined,
  });
  if (copyBtn) copyBtn.disabled = lastShareText.length === 0;
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
  const copyBtn = document.getElementById("chop-copy-btn") as HTMLButtonElement | null;
  if (rows) rows.innerHTML = "";
  if (totalEl) totalEl.textContent = "";
  lastShareText = "";
  if (copyBtn) copyBtn.disabled = true;
}

/** 刻みボタン・コピーボタンの配線。initCalculator から一度だけ呼ぶ。 */
export function initChop(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-chop-unit]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = Number(button.dataset.chopUnit) || 0;
      if (next !== roundingUnit) hapticSelection();
      roundingUnit = next;
      renderChop(lastStacks, lastPayouts);
    });
  });

  const copyBtn = document.getElementById("chop-copy-btn") as HTMLButtonElement | null;
  copyBtn?.addEventListener("click", async () => {
    if (!lastShareText) return;
    const ok = await copyPlainText(lastShareText);
    if (ok) {
      hapticSuccess();
      noteChopCopiedForReview();
    }
    copyBtn.textContent = t(ok ? "chop.copied" : "chop.copyFailed");
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = setTimeout(() => {
      copyBtn.textContent = t("chop.copyBtn");
      copyFeedbackTimer = null;
    }, COPY_FEEDBACK_MS);
  });
}
