# `playground/scripts/`

ビルド・データ生成系の補助スクリプト置き場。Vite ビルドに直接乗らない、開発時 / 事前計算時に走らせる用。

## `build-equity-table.mts`

169 種類のスターティングハンド × 「相手 Top X% レンジ」(X=1..100) の Monte Carlo equity を事前計算し、`src/data/equity-table.json` に書き出す。

ランタイム側 (`src/equityFromTable.ts`) はこの JSON を直接 import して lookup する。

### 使い方

```bash
# デフォルト (5000 試行/ペア、所要 ~15 分目安)
npx tsx scripts/build-equity-table.mts

# 試行回数を指定（高精度には 10000 推奨）
npx tsx scripts/build-equity-table.mts --trials 10000

# 早回し動作確認
npx tsx scripts/build-equity-table.mts --trials 1000

# 中断後に途中再開（既存 hand のエントリは再計算しない）
npx tsx scripts/build-equity-table.mts --trials 10000 --resume
```

### 仕様

- 出力: `src/data/equity-table.json` (`{ hand: { "1": eq, ..., "100": eq }, _meta: {...} }`)
- 5 ハンドごと（500 ペア完了ごと）に途中保存。中断しても `--resume` で続けられる。
- 各 trial で hero / villain の具体カードと board 5 枚をランダム配布、`pokersolver` で 7-card best-5 を評価。
- ブロッカー (hero と villain でカードが被る) はリサンプリングで弾く。最大 50 回試して取れなければそのトライアルはスキップ。
- レンジは `topRange(X)` を使うので、レンジ定義を変えたら再計算が必要。

### 期待値の目安（リファレンス）

- `AA vs Top 100%` ≈ 0.85
- `KK vs Top 5%` ≈ 0.5–0.7（ブロッカー込みのレンジ内対戦は予想より高めに出る）
- `22 vs Top 50%` ≈ 0.40
- `AKs vs Top 10%` ≈ 0.55
- `72o vs Top 100%` ≈ 0.34

### 所要時間（参考: M1 Mac）

| trials | 16,900 ペア合計 |
|---|---|
| 100 | ~33 秒 |
| 1,000 | ~5 分 |
| 5,000 | ~25 分 |
| 10,000 | ~55 分 |

### 再生成のタイミング

- `src/handRanking.ts` の `HAND_RANKING` を編集したら必ず再生成。
- それ以外は基本不要。`--trials` を上げて精度を上げる時のみ走らせる。

## `_bench.mts` / `_smoke.mts`

開発用の動作確認スクリプト。`pokersolver` の wiring と equity 計算の感覚値チェック。コミットしなくても問題ない。
