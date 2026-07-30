// ===== 用語解説モーダル (ICM / BF / 必要勝率 / RP のⓘ) =====
// hero サマリー内の [data-info="キー"] をタップすると開く読み物モーダル。
import { t } from "./i18n.js";

// キーは HTML/描画側の data-info 属性値と一致させる (日本語キー "必要勝率" を含む)。
// 辞書引き (t) はモジュール読み込み時に一度だけ行う。言語切替は location.reload()
// で全モジュールを描き直す方式なので、動的な再取得は不要 (i18n.setLang 参照)。
const INFO_TEXTS: Record<string, { title: string; body: string }> = {
  ICM: {
    title: t("info.icm.title"),
    body: t("info.icm.body"),
  },
  BF: {
    title: t("info.bf.title"),
    body: t("info.bf.body"),
  },
  RP: {
    title: t("info.rp.title"),
    body: t("info.rp.body"),
  },
  必要勝率: {
    title: t("info.req.title"),
    body: t("info.req.body"),
  },
};

const infoModal = document.getElementById("info-modal") as HTMLDivElement | null;
const infoTitle = document.getElementById("info-modal-title") as HTMLHeadingElement | null;
const infoBody = document.getElementById("info-modal-body") as HTMLDivElement | null;
const infoClose = document.getElementById("info-modal-close") as HTMLButtonElement | null;

/** 未知のキー・DOM 不在時は何もしない (タップ元の data-info を信用しすぎない)。 */
export function openInfoModal(key: string): void {
  const info = INFO_TEXTS[key];
  if (!info || !infoModal || !infoTitle || !infoBody) return;
  infoTitle.textContent = info.title;
  infoBody.innerHTML = info.body;
  infoModal.classList.remove("hidden");
}

function closeInfoModal(): void {
  infoModal?.classList.add("hidden");
}

/** 閉じるボタン・背景タップ・Escape の配線。initCalculator から一度だけ呼ぶ。 */
export function initInfoModal(): void {
  infoClose?.addEventListener("click", closeInfoModal);
  infoModal?.addEventListener("click", (e) => {
    if (e.target === infoModal) closeInfoModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeInfoModal();
  });
}
