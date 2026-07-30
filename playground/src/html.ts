// innerHTML 文字列を組み立てる際の共通ヘルパー。DOM には触らない純関数のみ。

/**
 * ユーザー入力を innerHTML / 属性値へ埋め込む前にエスケープする。
 *
 * & < > " の 4 文字を実体参照に置換する。属性値は必ずダブルクォートで囲む前提
 * (シングルクォートは置換しないため `attr='...'` には使えない)。
 * ユーザーが名前を付けられる箇所 (保存シナリオ名・保存ペイ構造名) が対象。
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
