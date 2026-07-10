import type { Difficulty, PracticeMode } from "./types.js";
import { loadHistory, loadStats, HISTORY_KEY, type PracticeHistoryEntry } from "./store.js";

export { appendHistory } from "./store.js";

// 正解率に応じた色分け: 70%以上=good, 50-70%=warn, 未満=bad
function progressAccColor(acc: number | null): string {
  if (acc === null) return "var(--muted)";
  if (acc >= 0.7) return "var(--good)";
  if (acc >= 0.5) return "var(--warn)";
  return "var(--bad)";
}
function progressFmtPct(acc: number | null): string {
  return acc === null ? "-" : `${(acc * 100).toFixed(0)}%`;
}

// 直近100問を10問ごとの正解率にまとめて折れ線 SVG (文字列) を生成
function buildPracticeSparklineSVG(history: PracticeHistoryEntry[]): string {
  const recent = history.slice(-100);
  const groups: PracticeHistoryEntry[][] = [];
  for (let i = 0; i < recent.length; i += 10) groups.push(recent.slice(i, i + 10));
  if (groups.length < 4) {
    return `<div class="progress-sparkline-empty">まだデータが足りません (${recent.length}問)</div>`;
  }
  const accs = groups.map((g) => g.filter((e) => e.ok).length / g.length);
  const W = 300;
  const H = 60;
  const padX = 4;
  const padTop = 6;
  const padBottom = 6;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;
  const pts = accs.map((a, i) => {
    const x = groups.length > 1 ? padX + (i / (groups.length - 1)) * plotW : W / 2;
    const y = padTop + (1 - a) * plotH;
    return [x, y] as const;
  });
  const lineStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const firstX = pts[0]![0].toFixed(1);
  const lastX = pts[pts.length - 1]![0].toFixed(1);
  const areaStr = `${firstX},${(H - padBottom).toFixed(1)} ${lineStr} ${lastX},${(H - padBottom).toFixed(1)}`;
  return `
    <svg class="progress-sparkline-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="60" role="img" aria-label="直近の正解率推移">
      <polygon points="${areaStr}" style="fill: color-mix(in srgb, var(--accent) 22%, transparent); stroke: none;"></polygon>
      <polyline points="${lineStr}" style="fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;"></polyline>
    </svg>
  `;
}

export function updatePracticeProgress(): void {
  const body = document.getElementById("practice-progress-body");
  if (!body) return;
  const history = loadHistory();
  const stats = loadStats();
  const overallAcc = stats.total > 0 ? stats.correct / stats.total : null;

  const last20 = history.slice(-20);
  const last20Correct = last20.filter((e) => e.ok).length;
  const last20Acc = last20.length > 0 ? last20Correct / last20.length : null;

  const diffRows = (["easy", "normal", "hard"] as Difficulty[]).map((d) => {
    const items = history.filter((e) => e.diff === d);
    const c = items.filter((e) => e.ok).length;
    const t = items.length;
    const label = d === "easy" ? "Easy" : d === "normal" ? "Normal" : "Hard";
    return { label, c, t, acc: t > 0 ? c / t : null };
  });

  const modeRows = (["callfold", "rp", "push"] as PracticeMode[]).map((m) => {
    const items = history.filter((e) => e.mode === m);
    const c = items.filter((e) => e.ok).length;
    const t = items.length;
    const label = m === "callfold" ? "コール/フォールド判定" : m === "rp" ? "RP 当て" : "push 判定";
    return { label, c, t, acc: t > 0 ? c / t : null };
  });

  body.innerHTML = `
    <div class="progress-headline">
      <div class="progress-headline-item">
        <div class="progress-headline-label">直近20問</div>
        <div class="progress-headline-value" style="color: ${progressAccColor(last20Acc)}">${progressFmtPct(last20Acc)}</div>
        <div class="progress-headline-sub">${last20Correct}/${last20.length}問</div>
      </div>
      <div class="progress-headline-item">
        <div class="progress-headline-label">全期間</div>
        <div class="progress-headline-value" style="color: ${progressAccColor(overallAcc)}">${progressFmtPct(overallAcc)}</div>
        <div class="progress-headline-sub">${stats.correct}/${stats.total}問</div>
      </div>
    </div>
    <div class="progress-sparkline-wrap">
      <div class="progress-block-title">推移 (直近100問・10問ごとの正解率)</div>
      ${buildPracticeSparklineSVG(history)}
    </div>
    <div class="progress-block">
      <div class="progress-block-title">難易度別</div>
      <div class="progress-breakdown-grid">
        ${diffRows.map((r) => `
          <div class="progress-breakdown-cell">
            <div class="progress-breakdown-label">${r.label}</div>
            <div class="progress-breakdown-value" style="color: ${progressAccColor(r.acc)}">${progressFmtPct(r.acc)}</div>
            <div class="progress-breakdown-sub">${r.c}/${r.t}</div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="progress-block">
      <div class="progress-block-title">モード別</div>
      <div class="progress-breakdown-grid">
        ${modeRows.map((r) => `
          <div class="progress-breakdown-cell">
            <div class="progress-breakdown-label">${r.label}</div>
            <div class="progress-breakdown-value" style="color: ${progressAccColor(r.acc)}">${progressFmtPct(r.acc)}</div>
            <div class="progress-breakdown-sub">${r.c}/${r.t}</div>
          </div>
        `).join("")}
      </div>
    </div>
    <button id="practice-history-reset-btn" type="button" class="progress-reset-btn">🗑️ 履歴をリセット</button>
  `;
}

/** 成績の推移パネル: 履歴リセットボタンの配線。main.ts から一度だけ呼ぶ。 */
export function initProgress(): void {
  // 成績の推移パネル: 履歴リセットボタン (パネルは innerHTML で再生成されるため親要素に委譲)
  document.getElementById("practice-progress")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest("#practice-history-reset-btn")) return;
    if (confirm("練習履歴（成績の推移データ）をリセットしますか？\n※連続正解数・累計正解率・復習リストは変更されません。")) {
      try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
      updatePracticeProgress();
    }
  });
}
