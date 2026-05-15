# Poker ICM/BF Calculator (仮称)

日本語UIの店舗トナメ向け ICM/BF/Nash 計算アプリ（モバイルWeb / PWA）。

## 現在のステータス
- 計算コア（ICM・BF・必要勝率・Nash・ポットオッズ）実装＆テスト済み
- モバイルWeb UI（playground）が稼働中。5タブ構成・PWA対応
- Cloudflare Workers にデプロイ済み
- 開始日: 2026-05-08

## ディレクトリ構成
```
poker-icm-app/
├── README.md            # このファイル
├── docs/
│   └── SPEC.md          # 完全な仕様書
├── core/                # 計算コア（純粋TypeScript、フレームワーク非依存）
│   ├── src/
│   │   ├── icm.ts       # Malmuth-Harville ICM
│   │   ├── bf.ts        # Bubble Factor
│   │   ├── equity.ts    # 必要勝率計算
│   │   ├── nash.ts      # Nash プッシュ/コールレンジ
│   │   ├── potOdds.ts   # ポットオッズ
│   │   └── index.ts     # エクスポート
│   └── test/
│       └── *.test.ts    # ユニットテスト
├── playground/          # モバイルWeb UI（Vite + TypeScript、PWA）
│   ├── index.html
│   └── src/
└── wrangler.jsonc       # Cloudflare Workers デプロイ設定
```

## UI 構成（playground）
モバイル向けの5タブ構成:
- ⚙️ セットアップ — プレイヤー・スタック・ペイアウト入力、プリセット
- 📊 結果 — ICM/BF/必要勝率の計算結果
- 🃏 ハンド — ハンドレンジ比較
- 🎯 Nash — Nash プッシュ/コールレンジ
- 🎲 練習問題 — ランダムシナリオで call/fold 即判定、円卓ビュー、復習リスト

## 設計原則
- 計算コアは純粋関数の集合（副作用なし）
- どのUIフレームワークからも呼べる
- 数値計算なので浮動小数点誤差に注意（テストで±0.001 まで許容）

## 開発
```bash
npm install        # 依存インストール
npm run dev        # playground を localhost:5173 で起動
npm test           # core のユニットテスト
npm run typecheck  # 型チェック
npm run build      # core + playground をビルド
```

## デプロイ
`main` ブランチへの push で Cloudflare Workers が自動ビルド＆デプロイ。
公開URL: https://poker-icm-app.andenknt31113.workers.dev/

詳細な仕様は `docs/SPEC.md` 参照。
