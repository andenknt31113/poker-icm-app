# ストア説明の「対応範囲」整理（1.3 向け下書き・2026-10-29）

目的: 「GTO が分かるアプリ」と誤解されて「2BB オープンが正しいのに全部オールイン？」と批判されるのを防ぐ。
アプリが正しく答えられる範囲（ショートスタックのオールイン判断）をはっきり書き、できないことも先に書く。

- 元の文面: [APP_STORE_LISTING.md](APP_STORE_LISTING.md)（1.0 当時の下書き。5タブ構成など古い記述も残る）
- 公開中の 1.2 の説明文は App Store Connect 上の実データを正とする。下の差し替えは本人が ASC で反映する。
- 説明文・スクリーンショットの文言変更は新バージョン（1.3）の審査に含める。プロモーションテキストは審査なしでいつでも変更できる。

## 1. 誤解を招きやすい現行表現と差し替え案

| 場所 | 現行 | 差し替え案 |
|---|---|---|
| 説明文 Nash | ヘッズアップのpush/foldにおけるNash均衡レンジ（ICM反映済み）を計算し、自分の判断とレンジを比較できます。 | ショートスタック（目安：実効12BB以下）で「オールインか降りるか」の2択に絞ったときの Nash 均衡レンジを、ICM を反映して計算します。12〜20BB では注意を表示し、20BB を超える深さは範囲外として扱います。 |
| 説明文 画面構成 | 4. Nash均衡 — ヘッズアップpush/foldの最適解 | Nash — ショートスタックの push/fold 均衡（2人・オールインかフォールドの2択） |
| 説明文 練習 | Push decision（プッシュ判定）: 自分がオールインすべきかを判断 | Push decision（プッシュ判定）: ショートスタックでオールインすべきかを判断 |
| スクショ5 コピー（日） | ヘッズアップの正解レンジをNashで確認 | ショートスタックの押し引きをNashで確認 |
| スクショ5 コピー（英） | Solve the exact heads-up push/fold Nash range. | Check short-stack shove ranges with ICM Nash. |
| 英語説明 Nash | Compute the heads-up push/fold Nash equilibrium (ICM included) and compare it against your own read. | Compute the ICM-aware push/fold Nash equilibrium for short stacks (about 12BB or less), where the choice is shove or fold. Deeper spots show a caution, and beyond 20BB they are treated as out of range. |
| 英語説明 画面構成 | 4. Nash — the optimal heads-up push/fold solution | 4. Nash — short-stack push/fold equilibrium (two players, shove or fold) |

「厳密 ICM」「3つの終端を計算し直す」は事実どおり（2026-10-28 に厳密値との差を検証済み）なので残してよい。

## 2. 説明文に追加する節（日本語）

`【ご注意】` の直前に入れる。

```
【対応している場面・していない場面】
このアプリが計算するのは「オールイン」が絡む判断です。
・相手のオールインにコールするか降りるか（スタックの深さに関係なく使えます）
・ショートスタック（目安：実効12BB以下）で、自分からオールインするか降りるか

次の判断は計算しません。
・2BBオープン、リンプ、3ベットなど、オールイン以外のアクション
・3人以上がオールインに参加する局面（後ろに残っているプレイヤーがいる場合は注意を表示します）
・フロップ以降のプレイ

実効20BBを超える深さで自分から押す判断は、push/foldの範囲外として扱い、結果を参考値として折りたたんで表示します。
```

## 3. 説明文に追加する節（英語）

`PLEASE NOTE` の直前に入れる。

```
WHAT IT COVERS (AND WHAT IT DOESN'T)
Poker ICM calculates all-in decisions:
- Calling or folding against an opponent's all-in (valid at any stack depth)
- Shoving or folding with a short stack (about 12BB effective or less)

It does not calculate:
- Opens, limps, 3-bets or any action other than all-in
- Spots where three or more players get involved (a warning appears when players are left to act)
- Postflop play

Shove decisions deeper than 20BB effective are treated as out of push/fold range; the result is folded away as a reference only.
```

## 4. プロモーションテキスト（審査なしで更新可）

日本語（170字以内）:

```
オールインされた時のコール判断と、ショートスタックのプッシュ判断を厳密ICMで計算・練習。2BBオープンやリンプは扱わず、オールインの判断に絞った学習アプリです。完全オフライン。実際の金銭を賭けるものではありません。
```

英語（170字以内）:

```
Exact-ICM calls vs all-ins and short-stack shove drills. Focused on all-in spots only (no opens or limps). Fully offline. Not real-money gambling — a study tool.
```

## 5. 反映の手順（本人の操作）

1. 1.3 の新ビルドを作ってアップロードし、ASC の 1.3 下書きに紐付ける（Claude/Codex 側で準備可能）
2. ASC の 1.3 で説明文を差し替え（日本語・英語）、スクショ5のコピーを変更した画像に差し替え
3. プロモーションテキストは今すぐ差し替えても良い（公開中の 1.2 にも反映される）
4. 審査提出・公開は本人の判断で行う
