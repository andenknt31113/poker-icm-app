# `playground/scripts/`

ビルド・データ生成系の補助スクリプト置き場。Vite ビルドに直接乗らない、開発時 / 事前計算時に走らせる用。

## equity 事前計算パイプライン（高精度版, 2026-07〜）

equity テーブルは 2 つ:

- `src/data/hu-equity-matrix.json` — 169×169 ハンドクラス対決 equity
- `src/data/equity-table.json` — 169 ハンド × Top1..100% レンジ equity

両者とも **1,000,000 試行/セルの Monte Carlo**（標準誤差 ~0.05pt）で生成する。

### 高速化・並列化の仕組み

- **`_fastEval.mts`** … 自作の高速整数 7-card 評価器。カードを整数 `rank*4+suit` で
  表し、ビット演算で best-5 を「比較可能なスコア」に落とす。pokersolver の ~80 倍速
  （~2M 試行/s/コア）。pokersolver と勝敗判定が **完全一致** することを 50 万ディールで
  検証済み（回帰テスト: `test/fastEval.test.ts`）。
- **`_mc.mts`** … MC コア（コンボ展開・seedable PRNG・HU/レンジ equity 計算）。
- **`_workerBoot.mjs`** … worker_threads 用ブートストラップ。worker では tsx の
  resolve リマップ（`.js`→`.ts`）が execArgv 経由で効かないため、`tsx/esm/api` の
  `register()` を明示的に呼んでから本体 `.mts` を動的 import する。
- 生成は **worker_threads で全 CPU コアに並列化**。

### 乱数と再現性

乱数は seedable な **mulberry32**。各セルのシードは `deriveSeed(baseSeed, i, j)` で
`(baseSeed, hero index, villain index)`（テーブル側は `(baseSeed, hand index, pct)`）から
決定的に導出する。**どのワーカー / どのバッチ順で計算しても同じセルは同じ乱数列**に
なるため、結果は完全に再現可能で resume 安全。baseSeed は `--seed` で変更可能
（HU 既定 `0x5eed01`、テーブル既定 `0x5eed02`）。

### 使い方

```bash
# 既定 (1,000,000 試行/セル, 全コア)
npx tsx scripts/build-hu-matchups.mts
npx tsx scripts/build-equity-table.mts

# 試行数・ワーカー数・シード指定
npx tsx scripts/build-hu-matchups.mts --trials 500000 --workers 4 --seed 7

# 中断後の再開（partial フラグ + 途中保存済みセルをスキップ）
npx tsx scripts/build-hu-matchups.mts --resume
```

- どちらも数百セルごとに途中保存し、`_meta.partial=true` を立てる。完了時に
  `partial:false`。中断しても `--resume` で未計算セルだけ再計算する。
- HU マトリクスは対称性 `eq(A,B)=1-eq(B,A)` を使い **上三角（hero index ≤ villain index）
  のみ計算・保存**（バンドルサイズ据え置き）。ランタイム `huEquityMatrix.ts` が対称性で
  下三角を補完する。
- 値は小数 4 桁に丸め（バンドルサイズ抑制。MC SE ~0.05pt に対し丸め誤差は無視できる）。

### 所要時間（参考: 4 コア）

| trials/セル | HU (14,196 ペア) | table (16,900 セル) |
|---|---|---|
| 1,000,000 | ~28 分 | ~45 分 |
| 500,000 | ~14 分 | ~23 分 |

### 期待値の目安（169 クラス平均・厳密列挙で確認済み）

- `AA vs 22` ≈ 0.822（単一コンボの俗称値 0.80 ではなく、スート/フラッシュ相互作用込みの
  クラス平均。厳密列挙 0.82217）
- `AA vs KK` ≈ 0.819（厳密 0.81946）
- `AKs vs QQ` ≈ 0.460（厳密 0.46049）
- `AKo vs AKs` ≈ 0.475（厳密 0.47508）
- `AA vs Top 100%` ≈ 0.85 / `72o vs Top 100%` ≈ 0.34

### 再生成のタイミング

- `src/handRanking.ts` の `HAND_RANKING`（レンジ定義）を編集したら必ず再生成。
- 精度を上げたい時に `--trials` を上げて再生成。

## 検証・開発補助スクリプト

- `_fastEval_verify.mts` … `evaluate7` と pokersolver を大量ディールで突き合わせる
  （`npx tsx scripts/_fastEval_verify.mts`）。
- `_bench.mts` / `_smoke.mts` ほか `_*.mts` … 開発時の動作確認用。
