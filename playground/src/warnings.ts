// ===== 計算結果タブの注意書きバナー =====
// 本計算機のモデル前提 (open-shove / push-fold) から外れる入力のとき、
// 「この数値はそのままでは使えない」と伝える 2 種類の警告。
// どちらも recompute() の最後に呼ばれ、条件を満たさなければ .hidden で隠す。
import { t } from "./i18n.js";
import { players, actionOrderIdx } from "./appState.js";
import { fmt } from "./format.js";

// ===== ポジション逆転警告 (Section 5 用) =====
// この計算機は open-shove (push or fold) モデルを前提とし、
// hero の既出 commit を blind+ante のみと仮定する。
// hero が villain より先に行動するポジ (例: hero=SB, villain=BB) は
// villain が直接 push する余地がないため、このモデルでは成立しない。
// 3-bet shove (hero open → villain re-shove) は hero の raise 額が
// pot に含まれるが、本計算機はそれをモデル化しないため警告対象。
export function updatePositionWarn(heroIndex: number, villainIndex: number): void {
  const warnEl = document.getElementById("position-warn");
  if (!warnEl) return;
  const hide = (): void => warnEl.classList.add("hidden");

  if (heroIndex < 0 || villainIndex < 0) {
    hide();
    return;
  }
  const heroPos = players[heroIndex]?.position;
  const villainPos = players[villainIndex]?.position;
  if (!heroPos || !villainPos) {
    hide();
    return;
  }
  const heroAct = actionOrderIdx(heroPos);
  const villainAct = actionOrderIdx(villainPos);
  // ポジション未割当 (-1) は判定不可 → 警告を出さない
  if (heroAct < 0 || villainAct < 0) {
    hide();
    return;
  }
  if (heroAct >= villainAct) {
    hide();
    return;
  }
  warnEl.classList.remove("hidden");
  warnEl.innerHTML = t("calc.warn.position.html", {
    heroPos,
    heroAct: heroAct + 1,
    villainPos,
    villainAct: villainAct + 1,
  });
}

// ===== 深さ警告 (必要勝率カード・🃏ハンド別判定セクション用) =====
// 本計算機は push/fold (オールイン) を前提としており、実効スタックが深い場面
// (20bb 超) では実戦上は小さいオープンやコールなど他の選択肢が現実的になる。
// 練習 (5-30bb で出題) 側は「オールイン前提」が自明なため警告は出さない。
const DEPTH_WARN_THRESHOLD_BB = 20;

export function updateDepthWarn(
  heroIndex: number,
  villainIndex: number,
  stacks: number[],
): void {
  const eqWarnEl = document.getElementById("depth-warn-eq");
  if (!eqWarnEl) return;

  const hide = (): void => {
    eqWarnEl.classList.add("hidden");
  };

  if (heroIndex < 0 || villainIndex < 0 || heroIndex === villainIndex) {
    hide();
    return;
  }
  const heroStack = stacks[heroIndex];
  const villainStack = stacks[villainIndex];
  if (heroStack === undefined || villainStack === undefined) {
    hide();
    return;
  }
  const effStack = Math.min(heroStack, villainStack);
  // NaN 対策で否定形の比較にしている (NaN > x は常に false のため hide される)
  if (!(effStack > DEPTH_WARN_THRESHOLD_BB)) {
    hide();
    return;
  }
  eqWarnEl.innerHTML = t("calc.warn.depth.html", { eff: fmt(effStack, 1) });
  eqWarnEl.classList.remove("hidden");
}
