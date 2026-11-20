# 1.5.2 (build 1)

2026-11-20 の全体レビューで見つけた不具合と表示の直し。計算式・課金は 1.5.1 から変えていない。

## 変えたこと

### 不具合

- **計算結果がエラー文に置き換わる**: 次の局面で、ICM の表・ハンド表が「RequiredEquity: callAmount が不正です: 0」(英語表示でも日本語) に置き換わっていた。
  - 相手 (か自分) を「他」にしたまま開き直す (コール額の欄が空のまま計算に入る)
  - 自分か相手がブラインド・アンティを払った時点でオールインになるスタック (BB 0.5、SB 0.3 など)
  - コール額に 0 を手入力する

  原因は core の `calculateRequiredEquity` が 0 以下の額で例外を投げ、`recompute()` がそれを拾って表ごと差し替えていたこと。`calculator.ts` で計算に入る前に判断できない局面を見分け、理由を出すようにした (ICM の表・チョップ・BF マップはそのまま出る)。自動算出のとき、コールする額が残らない局面ではコール額の欄を空にする (以前は前の局面の値が残り、別の局面の数字が出ていた)。
- **自分が先に動く局面の説明が計算と食い違う**: 自分 SB / 相手 BB のような局面は 1.4 から「自分からオールイン」の向きで計算しているのに、「必要勝率と RP」のカードに「ポジション逆転: villain の open push に call することはあり得ません」という古い警告が出ていた。内訳も「相手のオールイン」「コール額」のままだった。警告を「自分がオールインして相手にコールされた場合の数字」という説明に置き換え、内訳を「追加で出す額」「相手(BB)のコール」「コールされて勝つ / 負ける」にした。
- 内訳の「SB dead (SB folded)」「BB dead (BB folded)」が日本語表示でも英語だった。位置が未設定の相手が「相手()」と出ていた。

### 表示

- 利用規約・プライバシーポリシー (アプリ内と公開ページ) の文中に、HTML の改行が半角スペースとして入っていたのを詰めた。文面は変えていない (`legalSync.test.ts` で一致を確認)。
- 英語表示で規約のタイトルが日本語のままだったのを英語にした。
- 初回案内のタイトルの 🎰 (スロットマシン) を ♠ に。2ページ目の項目が1つだけの番号付きリストを普通の文にした。
- ガイド・用語解説・BF マップの説明: 文中の改行による空白を詰めた。「BF が 1.00 を下回ることはない」にバウンティありの例外を足した。「hero/villain」「over-call」「〜20bb」「押しても」を「自分と相手」「オーバーコール」「20BB」「オールインしても」に。英語のガイドに抜けていた「3人以上の Nash を HoldemResources と照合」の項目を足した。
- 「チップだけなら → RP → 必要勝率」の3つの箱が狭い画面で折り返し、矢印が行末に取り残されていたのを、2段 (下向きの矢印) に組み直した。
- 「相手のオールインレンジ: 上位 25%」が「上位」と「25%」の間で折り返さないようにした。
- コール vs フォールドの表の見出しを短くして、スマホで「残りスタ/ック」のように折り返さないようにした。

## 検証

- typecheck、unit（core 112 / playground 363）、build、e2e 19件成功。e2e に `19-no-call-spots` を追加 (上の3つの局面でエラー文が出ないこと、自分 SB の説明と内訳、降りた SB・BB の行が日本語であること)。
- ブラウザ (390px・iOS 相当の判定) で、自分 SB / 相手 BB の内訳と説明、相手 SB 0.3 の案内、英語の初回案内と規約タイトル、日本語の規約に空白が残っていないこと、課金画面を目で確認。
- 実機・iPad・購入と復元は未確認。

## ストア文面

1.5.1 は審査中に取り下げて公開しないので、1.5.1 の変更 (上のカードの並び、アンティの表示) も 1.5.2 の更新説明に入れた。

更新説明（ja）:

```
・自分か相手がブラインドだけでオールインになるスタックや、相手を選んでいない卓を開き直したときに、計算結果がエラー文に置き換わることがあるのを直しました
・自分が先に動く局面（例: 自分 SB・相手 BB）の内訳と説明を、自分からオールインする向きの言葉にしました
・上のカードを「オールインする人 › コールする人」の順に並べました。スクロール中も、どちらがオールインかが分かります
・ブラインドの表示で、アンティが「1.0」と「1」で揺れることがあるのを直しました
・利用規約やガイドなどの表示を整えました
```

更新説明（en-US）:

```
- Fixed results sometimes being replaced by an error message (for example when a player is all-in from the blinds, or when reopening a table with no villain selected)
- When you act first (e.g. you in the SB vs the BB), the breakdown and notes now describe your shove
- The summary card now lists the player going all-in first and the caller second, and keeps the roles visible while scrolling
- Minor display fixes
```

審査メモは「What is new in 1.5.1」の節を「What is new in 1.5.2」に置き換えた (1.5.1 の2項目も含む)。説明文・キーワード・スクショは 1.5.1 で入れたもののまま (スクショは 1.5.1 で撮り直した5枚 + 07-bounty)。

## 提出

2026-11-20、本人の判断で 1.5.1 を審査中に取り下げ、1.5.2 だけを出した (1.5.1 の変更も 1.5.2 に入っている)。

- 1.5.1 の取り下げ: reviewSubmission `cde82616-eec5-4d61-aefc-c107302b5a54` を `canceled: true` → COMPLETE。バージョンは DEVELOPER_REJECTED になった。
- 同じバージョン (id `d1e12047-62cb-46f9-b60a-6f688bf573ac`) の versionString を 1.5.2 に変え、更新説明 (ja / en-US) と審査メモ (「What is new in 1.5.2」の節) を差し替えた。説明文・スクショは 1.5.1 のまま。
- ビルド: main `9262f08` から `npm run cap:sync` → Archive (`artifacts/release-1.5.2/PokerICM-1.5.2-build1.xcarchive`、1.5.2 / 1) → `-exportArchive` でアップロード。build `0ca1ee7c-2c16-4eea-a228-928f391acbca` が VALID、usesNonExemptEncryption は false。
- シミュレーター (iPhone 17、Release 構成、同梱の画面は build 9262f08) で、自分 SB / 相手 BB の内訳 (「追加で出す額」) と説明、自分 SB 0.3 での「コールする額がありません」の案内 (ICM の表と BF マップは出たまま) を確認。
- 提出: reviewSubmission `6cba888e-06a9-4091-912c-0ea56f06358a`、2026-11-20 02:25 UTC に WAITING_FOR_REVIEW。releaseType は AFTER_APPROVAL (承認されたら自動で公開)。
- ASC の補助スクリプトと ID は `artifacts/release-1.5.2/asc/` (git 管理外。認証の値は入れていない)。
