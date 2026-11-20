// ===== 局面カード: バウンティ (KO / PKO) の入力 =====
//
// 形式 (なし / KO / PKO) と、各プレイヤーの首にかかっている額を入力する。
// バウンティは Pro の機能: 無料のときは KO / PKO を選ぶとペイウォールを出し、
// 計算にも入れない (判定は bountyState.activeBounty が isPro() で行う)。
import { t as tr } from "./i18n.js";
import { escapeHtml } from "./html.js";
import { isPro } from "./entitlement.js";
import { openPaywall } from "./paywall.js";
import { recompute } from "./calculator.js";
import { checkpointSetup } from "./setupUndo.js";
import { players } from "./appState.js";
import {
  BOUNTY_MODES,
  bountySummaryText,
  getBountyMode,
  parseBountyInput,
  setBountyMode,
  sanitizeBounty,
  type BountyMode,
} from "./bountyState.js";

export function renderBountySummary(): void {
  const el = document.getElementById("bounty-summary");
  if (!el) return;
  el.textContent = bountySummaryText(
    getBountyMode(),
    players.map((player) => sanitizeBounty(player.bounty)),
    isPro(),
  );
}

export function renderBounty(): void {
  renderBountySummary();
  const pro = isPro();
  const mode = getBountyMode();
  // 無料時は保存値に関わらず計算では off 扱いなので、ボタン表示も off を選択中に揃える
  const activeMode: BountyMode = pro ? mode : "off";
  document.querySelectorAll<HTMLButtonElement>("[data-bounty-mode]").forEach((button) => {
    const value = button.dataset.bountyMode as BountyMode;
    const active = value === activeMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("locked-pro", !pro && value !== "off");
  });
  const body = document.getElementById("bounty-inputs");
  const list = document.getElementById("bounty-list");
  if (!body || !list) return;
  // 無料のとき・「なし」のときは額の入力を出さない
  body.hidden = !pro || mode === "off";
  if (body.hidden) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = players
    .map((player, i) => {
      const name = player.position || `#${i + 1}`;
      const role =
        player.role === "hero"
          ? ` <span class="icm-role hero">${tr("calc.summary.hero")}</span>`
          : player.role === "villain"
            ? ` <span class="icm-role villain">${tr("calc.summary.villain")}</span>`
            : "";
      const head = sanitizeBounty(player.bounty);
      return `<label class="bounty-row">
        <span class="bounty-name">${escapeHtml(name)}${role}</span>
        <input type="number" inputmode="decimal" class="bounty-amount" min="0" step="1" data-id="${player.id}" value="${head > 0 ? head : ""}" placeholder="0" aria-label="${escapeHtml(tr("setup.bounty.amount.aria", { name }))}" />
      </label>`;
    })
    .join("");
}

function chooseMode(next: BountyMode): void {
  if (next !== "off" && !isPro()) {
    openPaywall();
    return;
  }
  if (next === getBountyMode()) return;
  checkpointSetup();
  setBountyMode(next);
  renderBounty();
  recompute();
}

/** バウンティ欄の配線と初期描画。initSetup から一度だけ呼ぶ。 */
export function initBountyUI(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-bounty-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.bountyMode;
      if ((BOUNTY_MODES as readonly string[]).includes(value ?? "")) chooseMode(value as BountyMode);
    });
  });

  const list = document.getElementById("bounty-list");
  list?.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.classList.contains("bounty-amount") || !isPro()) return;
    const player = players.find((p) => p.id === Number(input.dataset.id));
    if (!player) return;
    player.bounty = parseBountyInput(input.value);
    recompute();
  });
  // 負数などの不正入力が残らないよう、フォーカスが外れたら実計算値に揃える
  list?.addEventListener("focusout", (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.classList.contains("bounty-amount") || !isPro()) return;
    const player = players.find((p) => p.id === Number(input.dataset.id));
    if (!player) return;
    const head = sanitizeBounty(player.bounty);
    const raw = Number(input.value);
    if (input.value.trim() !== "" && (!Number.isFinite(raw) || raw < 0)) {
      input.value = head > 0 ? String(head) : "";
    }
  });

  // 「全員に同じ額」: 入れた額を全員の首に入れる
  const all = document.getElementById("bounty-all") as HTMLInputElement | null;
  all?.addEventListener("focusout", () => {
    const raw = Number(all.value);
    if (all.value.trim() !== "" && (!Number.isFinite(raw) || raw < 0)) {
      all.value = "";
    }
  });
  document.getElementById("bounty-all-apply")?.addEventListener("click", () => {
    if (!all || !isPro()) return;
    const head = parseBountyInput(all.value);
    if (all.value.trim() !== "" && !(Number(all.value) >= 0)) all.value = "";
    if (players.every((player) => sanitizeBounty(player.bounty) === head)) return;
    checkpointSetup();
    for (const player of players) player.bounty = head;
    renderBounty();
    recompute();
  });

  renderBounty();
}
