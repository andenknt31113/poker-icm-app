# 1.5.1 (build 1)

表示の直しだけのリリース。計算・課金は 1.5 から変えていない。

## 変えたこと

- 上部のカードを「オールインする人 › コールする人」の順に並べる。スクロール中も「オールイン / コール / コール？」の短い役割を出す（PR #98）。
- ブラインド行のアンティが「1.0」と「1」で揺れるのを揃える（PR #99）。
- ストアのスクショ 01-spot / 03-range / 06-nash / 04-prizes / 05-chop を撮り直し（「オールイン」表記、iPad の「STUDY ROOM」なし）。07-bounty は 1.5 のまま。並びは 01-spot, 07-bounty, 03-range, 06-nash, 04-prizes, 05-chop。

## 検証

- typecheck、unit（core 112 / playground 363）、build、e2e 18件成功。
- シミュレーター（iPhone 17）で Release ビルドを起動し、スクロール中のカードが「相手 SB オールイン › 自分 BB コール？」と出ることを確認。
- 実機・iPad・購入と復元は未確認。

## ストア文面

更新説明（ja）:

```
・上のカードを「オールインする人 › コールする人」の順に並べました。スクロール中も、どちらがオールインかが分かります
・ブラインドの表示で、アンティが「1.0」と「1」で揺れることがあるのを直しました
```

更新説明（en-US）:

```
- The summary card now lists the player going all-in first and the caller second, and keeps the roles visible while scrolling
- Minor display fixes
```

説明文・キーワード等は 1.5 から引き継ぎ。審査メモの先頭に 1.5.1 の変更（表示の直しのみ）を足した。公開は承認後に自動（AFTER_APPROVAL）。
