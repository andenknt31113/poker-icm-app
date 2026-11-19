// ===== 計算結果タブの注意書きバナー =====
// 本計算機のモデル前提 (open-shove / push-fold) から外れる入力のとき、
// 「この数値はそのままでは使えない」と伝える 2 種類の警告。
// どちらも recompute() の最後に呼ばれ、条件を満たさなければ .hidden で隠す。
import { t } from "./i18n.js";
import { players } from "./appState.js";
import { fmt } from "./format.js";

// ===== 自分からオールインする向きの説明 (必要勝率と RP のカード) =====
// 自分が先に動く局面 (例: 自分 SB / 相手 BB) は、自分がオールインして相手がコールする向きで計算する
// (向きは handRange.currentDirection)。このカードの「コール額」は自分が追加で出す額になり、
// 必要勝率は「コールされたときに要る勝率」で、降りてもらえる分は入らない。それをここで断る。
// 以前は同じ局面に「ポジション逆転: ありえない」という警告を出していたが、
// 向きを席順で自動で決めるようになってからは計算と食い違うので、説明に置き換えた。
export function updatePositionWarn(direction: "callBack" | "pushBack" | null, heroIndex: number, villainIndex: number): void {
  const noteEl = document.getElementById("position-warn");
  if (!noteEl) return;
  if (direction !== "pushBack" || heroIndex < 0 || villainIndex < 0) {
    noteEl.classList.add("hidden");
    noteEl.innerHTML = "";
    return;
  }
  const seat = (pos: string | undefined): string => (pos ? `(${pos})` : "");
  noteEl.innerHTML = t("calc.note.pushDirection.html", {
    hero: seat(players[heroIndex]?.position),
    villain: seat(players[villainIndex]?.position),
  });
  noteEl.classList.remove("hidden");
}

// ===== 深さ警告 (必要勝率カード = 相手のオールインへのコール判断) =====
// オールインされた後は call/fold しかないので、深くても計算自体は成り立つ。
// ただ 20bb 超でいきなりオールインしてくる相手のレンジは強く絞られるのが普通なので、
// 相手レンジを狭めに置くよう促す。自分から押す側の深さ注意は pushSpot.pushDepthTier。
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
