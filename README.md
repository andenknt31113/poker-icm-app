# Poker ICM/BF Calculator (仮称)

日本語UIの店舗トナメ向けICM/BF計算アプリ。

## 現在のステータス
- **Phase 0**: TypeScriptで計算コアを実装中
- 開始日: 2026-05-08

## ディレクトリ構成
```
Poker_ICM_App/
├── README.md            # このファイル
├── docs/
│   └── SPEC.md          # 完全な仕様書
├── core/                # 計算コア（純粋TypeScript、フレームワーク非依存）
│   ├── src/
│   │   ├── icm.ts       # Malmuth-Harville ICM
│   │   ├── bf.ts        # Bubble Factor
│   │   ├── equity.ts    # 必要勝率計算
│   │   └── index.ts     # エクスポート
│   └── test/
│       └── *.test.ts    # ユニットテスト
└── app/                 # UIアプリ（後で React Native + Expo or PWA で構築）
```

## 設計原則
- 計算コアは純粋関数の集合（副作用なし）
- どのUIフレームワークからも呼べる
- 数値計算なので浮動小数点誤差に注意（テストで±0.001 まで許容）

## 次のステップ
- [x] プロジェクト構造作成
- [ ] core/ で ICM・BF・必要勝率を実装＆テスト
- [ ] UI技術スタック決定（RN+Expo vs PWA）
- [ ] メイン画面プロトタイプ
- [ ] プリセット拡充
- [ ] β配布

詳細は `docs/SPEC.md` 参照。
