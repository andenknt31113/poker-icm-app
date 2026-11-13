// ===== 日本語辞書 (Phase A) =====
// フラットな "a.b.c" キーの Record。値は表示文言そのもの (句読点・空白・絵文字を
// 含めて一字一句そのまま)。{n} 形式のプレースホルダは t() の第2引数で補間する。
// legalContent.ts (規約) は対象外 (Phase B で判断)。

export const ja: Record<string, string> = {
  "setup.players.roles": "🎯 自分　⚔️ 相手",
  "setup.players.swap": "自分 ⇄ 相手",
  "setup.players.locked": "{n}人まで無料で編集できます。人数を減らすか、Proで編集を解放できます。例題の分析はそのまま使えます。",
  "setup.player.stack.aria": "プレイヤー{n}のスタック（BB）",
  "setup.player.position.aria": "プレイヤー{n}のポジション",
  "setup.player.remove.aria": "プレイヤー{n}を削除",
  "hand.legend.title": "色と数字の見方",
  "hand.emptyRange": "相手のレンジが空です。ハンドを選ぶか「プリセットから読み込む」を押してください。",
  "calc.err.positivePrize": "賞金を1つ以上、0より大きい値で入力してください。",
  "nash.details": "賞金・ブラインド・残りのプレイヤー",
  "seat.number": "席 {n}",
  "seat.up": "ひとつ上の席へ",
  "seat.down": "ひとつ下の席へ",
  "seat.stack": "スタック",
  "seat.hero": "自分",
  "seat.villain": "相手",
  "seat.button": "BTN（ボタン）",
  "seat.setButton": "ここをBTNに",
  "nash.otherSeats": "ほかのプレイヤーを見る",
  "nash.prizes": "賞金配分",
  "nash.youPush": "自分：プッシュ",
  "nash.theyCall": "相手：コール",
  "nash.youCall": "自分：コール",
  "nash.theyPush": "相手：プッシュ",
  "nash.title.youPush": "自分が押すレンジ 🔴",
  "nash.title.theyCall": "相手がコールするレンジ 🟢",
  "nash.title.theyPush": "相手が押すレンジ 🔴",
  "nash.title.youCall": "自分がコールするレンジ 🟢",
  "flow.equityDetails": "コール額・必要勝率の内訳を見る →",
  "flow.example": "例題から試す",
  "flow.exampleHint": "よくある局面を選ぶだけ",
  "flow.own": "自分の局面を入力",
  "flow.ownHint": "スタック・賞金を再現",
  "flow.practice": "クイズで練習",
  "flow.practiceHint": "1問ずつ、判断の感覚を磨く",
  "flow.hand": "ハンド",
  "flow.equity": "賞金・BF",
  "flow.nash": "Nash",
  "workspace.eyebrow": "TOURNAMENT / STUDY",
  "workspace.title": "そのコールに、根拠を。",
  "workspace.intro": "気になった局面を再現して、賞金への影響とハンドの判断を確かめよう。",
  "workspace.step1": "01 局面をつくる",
  "workspace.step2": "02 ハンドを調べる",
  "workspace.step3": "03 練習で身につける",
  "workspace.practice": "まずは練習で試す →",
  "workspace.ready": "局面を設定したら",
  "workspace.readyHint": "相手のレンジと、自分のハンドを確かめよう。",
  "workspace.analyze": "この局面を分析する →",
  "workspace.analysisEyebrow": "YOUR DECISION",
  "workspace.analysisTitle": "局面の分析",
  "workspace.edit": "局面を編集",
  "workspace.you": "自分",
  "workspace.opponent": "相手",
  "workspace.table": "卓の配置を詳しく見る",
  // ===== index.html: ヘッダー =====
  "header.help.title": "使い方ガイド",
  "header.help.aria": "ヘルプ",
  "header.lang.title": "言語切替",
  "header.lang.aria": "言語切替",
  "header.infoModal.close.aria": "閉じる",

  // ===== index.html: タブ =====
  "tabs.aria": "セクション",
  "tabs.setup": "セットアップ",
  "tabs.analyze": "計算",
  "tabs.practice": "練習",
  "analyze.jump.aria": "分析セクション",
  "analyze.jump.results": "計算結果",
  "analyze.jump.hand": "レンジ比較",
  "analyze.jump.nash": "Nash",

  // ===== index.html: セットアップ - シナリオプリセット =====
  "setup.presets.h2": "シナリオプリセット",
  "setup.presets.summary": "例題・保存した局面",
  "setup.presets.hint": "タップで状況一発セット。スタック・ポジション・ペイアウトを丸ごと反映。",
  "setup.presets.ft9": "9人残り・全員入賞",
  "setup.presets.ftBubble": "4人残り・3人入賞（自分がショート）",
  "setup.presets.ft6": "6人残り・全員入賞",
  "setup.presets.ft4": "4人残り・全員入賞",
  "setup.presets.ft3": "3人残り・全員入賞",
  "setup.presets.hu": "最後の2人・10 BBずつ",
  "setup.presets.huShort": "最後の2人・自分5 BB／相手18 BB",
  "setup.presets.satellite3": "5人残り・上位3人が同額入賞",
  "setup.presets.userLabel": "自分のシナリオ",
  "setup.presets.saveBtn": "＋ 現在の状況を保存",

  // ===== セットアップ 動的部分 (setup.ts) =====
  "setup.common.delete": "削除",
  "setup.player.pos.title": "ポジション",
  "setup.player.role.hero": "自分",
  "setup.player.role.villain": "相手",
  "setup.player.role.other": "その他",
  "setup.player.role.otherText": "他",
  "setup.payout.rank": "{n}位",
  "setup.userScenarios.empty": "まだ保存なし。「＋ 現在の状況を保存」を押すと追加",
  "setup.prompt.scenarioName": "シナリオ名を入力",
  "setup.confirm.deleteScenario": "このシナリオを削除しますか？",
  "setup.prompt.savePayout": "名前を付けて保存（例: JOPT / APT / マイHU）",

  // ===== index.html: セットアップ - プレイヤー =====
  "setup.players.h2": "局面",
  "setup.players.hint.html": "スタックはBB単位。🎯と⚔️で自分・相手を指定します。",
  "seat.edit": "席順・BTN・削除を編集",
  "seat.done": "席の編集を終える",
  "setup.undo": "元に戻す",
  // add-player ボタンのテキストは renderPlayers() (setup.ts) が制御するため JS 側で t() する
  "setup.players.add": "+ プレイヤー追加",
  "setup.players.addMax": "(最大 {n} 人)",
  "setup.players.randomize.title": "現プレイヤーのスタックを 3-30 BB のランダム値に",
  "setup.players.randomize": "🎲 ランダム",

  // ===== index.html: セットアップ - ペイ構造 =====
  "setup.payouts.h2": "賞金",
  "setup.payouts.hint": "1位から順に入力。% でも金額でも OK。",
  "setup.payouts.add": "\n          + 順位追加\n        ",
  "setup.payouts.summary": "プリセット・保存済み（タップで開閉）",
  "setup.payouts.presetLabel": "プリセット",
  "setup.payouts.preset.top3": "50/30/20",
  "setup.payouts.preset.top2": "65/35",
  "setup.payouts.preset.wta": "総取り",
  "setup.payouts.preset.ft9": "7位まで",
  "setup.payouts.preset.satellite": "サテライト 3人通過",
  "setup.payouts.savedLabel": "\n              保存済み\n              ",
  "setup.payouts.saveBtn": "\n                ＋ 現在の値を保存\n              ",
  "setup.blinds.h2": "ブラインド",
  "setup.blinds.summary": "SB {sb} / BB {bb} / アンティ {ante}",
  "setup.cols.pos": "位置",
  "setup.cols.stack": "スタック (BB)",
  "setup.cols.role": "役割",
  "setup.presets.open": "選ぶ",
  "hand.quick.aria": "レンジの目安",
  "hand.thumb.aria": "相手のレンジを表で見る",
  "hand.thumb.caption": "表で見る",
  "calc.summary.chipOnly": "チップだけなら {v}%",
  "setup.blinds.hint": "スタックは BB 単位なので BB は 1 で固定です。アンティ有りの卓は「アンティ合計」を入力。",


  // ===== index.html: 計算結果 - ICM エクイティ =====
  "result.icm.h2": "賞金期待値 (ICM)",
  "result.icm.th.rank": "位置",
  "result.icm.th.stack": "スタック",
  "result.icm.th.equity": "賞金期待値",
  "result.icm.th.pct": "取り分",

  // ===== index.html: 計算結果 - BF マップ =====
  "result.bf.h2": "BF マップ（全員 vs 全員）",
  "result.bf.hint.html": "行が自分、列が相手。下段が BF、上段は同額を賭け合うときの RP。2人が実効スタックでオールインした場合の値です。",
  "result.bf.matrixTitle": "全員 vs 全員 BF マップ 🆕",
  "result.bf.matrixHint.html": "\n          縦軸 = Hero（自分）、横軸 = Villain（相手）。\n          上段=1:1ポット時のRisk Premium、下段=BF値。\n        ",
  "result.bf.howto.summary": "📖 表の見方（クリックで展開）",
  "result.bf.howto.body.html":
    "\n            <h4>1. 各セルの数字</h4>\n            <p><strong>下段の BF（Bubble Factor）</strong>がメイン指標。「この相手との勝負は、<strong>負けた痛みが勝った嬉しさの何倍か</strong>」を表す。</p>\n            <ul>\n              <li><strong>1.00</strong> = 痛み＝嬉しさ。チップの価値どおり戦ってよい（ICM圧ゼロ）</li>\n              <li><strong>1.16</strong> = 痛みが 1.16 倍。1:1 のポットなら勝率 50% では足りず、<strong>約 53.7%（+3.7pt）</strong>ないと割に合わない</li>\n              <li><strong>1.41</strong> = 痛みが 1.41 倍。同じ条件で<strong>約 58.5%（+8.5pt）</strong>必要。プレミアハンド級でないと合わない（やばい）</li>\n            </ul>\n            <p><strong>上段の Risk Premium</strong> は、まさにこの「上乗せ分」。コール額＝ポット（1:1オッズ）のとき、50% より<strong>何pt余分に勝率が必要か</strong>をそのまま表示している。</p>\n            <h4>2. 色の意味</h4>\n            <p>色は BF <strong>1.0（黄）→ 2.0 以上（赤）</strong>と連続的に濃くなる。ICM の性質上 <strong>BF が 1.00 を下回ることはない</strong>ため、実際に出るのは黄〜赤の範囲。読み方の目安:</p>\n            <ul>\n              <li>🟡 黄 (BF ≈ 1.0): ICM圧ほぼゼロ、ほぼ cEV 通りに戦ってよい</li>\n              <li>🟠 オレンジ (1.2〜1.5): ICM圧、タイトに</li>\n              <li>🔴 赤 (1.7 前後〜): 超危険、プレミア限定</li>\n            </ul>\n            <h4>3. 戦略的な読み方</h4>\n            <ul>\n              <li><strong>赤いセル</strong>の相手が絡んできたら → 降りる方向にウェイト</li>\n              <li><strong>黄色に近い（BF が 1.0 前後の）セル</strong>の相手 → ややルース寄せOK</li>\n              <li><strong>自分が最短スタック</strong>の行は全体的にBFが低い（=失うものが少ない）→ 比較的気楽に勝負できる</li>\n              <li><strong>チップリーダー対 2番手</strong>のセルは BF が跳ね上がる → リーダー同士の絡みは慎重に（表全体で BF 最大になりやすいのは、2番手がリーダーに絡まれるセル）</li>\n              <li>自分がリーダーでないなら、自分の行の中で<strong>チップリーダーの列</strong>が最も BF が高くなりやすい → 大きいスタックに絡まれた時ほどタイトに（典型的な ICM プレッシャー）</li>\n            </ul>\n            <h4>4. 実戦での使い方</h4>\n            <ol>\n              <li>テーブル着席後、全員のスタックを入力</li>\n              <li>左端の<strong>自分の行</strong>を見て「誰に対してタイト/ルース打つべきか」を把握</li>\n              <li>ハンド中に「あれ、この相手ヤバい？」となったら該当セルを確認</li>\n            </ol>\n            <p class=\"howto-note\">※ 表は左右対称ではない（hero/villain を入れ替えると BF が変わる）。同じチップ移動でも、双方のスタック量と順位状況で $ への影響が違うため（例: ショート側は負けると飛ぶが、カバーしている側は負けても生き残る）。</p>\n          ",
  "result.bf.scrollHint": "→ 横にスクロール",

  // ===== index.html: 計算結果 - 必要勝率 =====
  "result.eq.h2": "必要勝率と RP",
  "calc.eq.flow.chip": "チップだけなら",
  "calc.eq.flow.rp": "+ RP",
  "calc.eq.flow.icm": "必要勝率 (ICM)",
  "result.eq.hint.html": "自分と相手のオールインから自動で計算しています。数値を上書きすると手入力になります。",
  "result.eq.callLabel": "\n            コール額\n            ",
  "result.eq.call.placeholder": "例: 8.0",
  "result.eq.potwinLabel": "\n            勝った時の純利得\n            ",
  "result.eq.potwin.placeholder": "例: 10.5",
  "result.eq.autofillBtn": "\n          🔄 自動算出に戻す\n        ",

  // ===== index.html: ナッシュ均衡 =====
  "nash.h2": "Nash（2人の押し引き）",
  "nash.hint.html": "\n          先に動く方が push、後に動く方が call する2人の Nash 均衡を計算します（ICM反映済み）。\n          <br />\n          ※ HU 2-way 想定。BTN+BB のように間に他プレイヤーがいる場合は警告が出ます。\n          <br />\n          ※ <strong>プッシュ or フォールドの2択</strong>を前提にした均衡です。目安は実効 12BB 以下。12〜20BB では注意を表示し、20BB を超えると範囲外として結果を折りたたみます（実戦では 2BB オープンやリンプが入るため）。\n          <br />\n          ブラインドとアンティは実際のポジションの人が払う前提です（BTN からのプッシュなら自分は blind なし、BB ante は BB の人）。この画面を開くと自動計算します。\n        ",
  "nash.ante.label": "\n            アンティ合計\n            ",
  "nash.solveBtn": "再計算",
  "nash.explanation": "計算の前提・注意点を見る",
  "nash.editSpot": "局面を変更する",

  // ===== index.html: ハンド比較 =====
  "hand.h2": "ハンドの判断",
  "hand.hint.html": "相手のレンジを仮定して、自分がコール・プッシュできるハンドを調べます。",
  "hand.direction.callBack": "相手のオールインを受ける",
  "hand.direction.pushBack": "自分からオールイン",
  "hand.direction.autoHero": "席順で自動選択：自分（{pos}）が先に動きます",
  "hand.direction.autoVillain": "席順で自動選択：相手（{pos}）が先に動きます",
  "hand.preset.top": "上位",
  "hand.mode.preset": "上位レンジを指定",
  "hand.mode.custom": "\n            カスタム編集\n          ",
  "hand.custom.hint": "グリッドのセルをタップして相手のレンジに追加/削除。",
  "hand.custom.selected.html": "選択中: <strong>{n}</strong> 種類 / {combos} コンボ (<strong>{pct}%</strong>)",
  "hand.custom.actions.all": "全選択",
  "hand.custom.actions.clear": "全消去",
  "hand.custom.actions.fromPreset": "\n              プリセットから読み込む\n            ",
  // ハンド比較のグリッド見出し・統計・バナー (handRange.ts)
  "hand.title.villainPush": "相手が押すレンジ 🔴",
  "hand.title.heroCall": "コールできるハンド 🟢",
  "hand.label.villainPush": "相手が押すレンジ",
  "hand.title.villainCall": "相手がコールするレンジ 🟢",
  "hand.title.heroPush": "押せるハンド 🔴",
  "hand.label.villainCall": "相手がコールするレンジ",
  "hand.legend.html": "👆 <strong>セルをタップ</strong>すると、そのハンドの勝率と「コール可／フォールド」がグリッドの上に出ます。<br />相手のオールインを受けるとき: 🟩 必要勝率+0.1pt以上 = コール可 ／ 🟨 ±0.1pt = ボーダー (ほぼ完全に五分) ／ 無色 = フォールド。<br />自分からオールインするとき: 🟩 = push が $EV でフォールドを上回るハンド ／ 🟨 = ほぼ互角のボーダー ／ 無色 = フォールド。",
  "hand.inspect.detail.html": "<strong>{hand}</strong>: 勝率 {eq}% − 必要 {req}% = <strong>{margin}pt</strong> → {verdict}",
  "hand.inspect.verdict.call": "コール可",
  "hand.inspect.verdict.marginal": "五分 (ボーダー)",
  "hand.inspect.verdict.fold": "フォールド",
  "hand.callStats.callBack": "<strong>{callable}</strong> 種類・全ハンドの <strong>{callPct}%</strong>（{callCombos} コンボ）。必要勝率 <strong>{req}%</strong> 以上のハンドです。ボーダー: {marginal} 種類",
  "hand.callStats.pushBack": "<strong>{n}</strong> 種類・全ハンドの <strong>{pPct}%</strong>（{pushCombos} コンボ）。相手が <strong>{villainPct}%</strong> でコールする前提で、押した方が得なハンドです。ボーダー: {marginal} 種類",
  "hand.banner.callerLabel.hero": "hero (自分)",
  "hand.banner.noBehind.html": "\n      ✅ {label}=<strong>{pos}</strong>: 後ろにプレイヤーがいないので、この 1 対 1 モデルがそのまま当てはまります。\n    ",
  "hand.banner.behind.html": "\n      <details class=\"hand-caveat\">\n        <summary>⚠ {label}=<strong>{pos}</strong>: 後ろの {n} 人ぶんの over-call は未反映 — 実戦はもう少し硬めに</summary>\n        <div class=\"hand-caveat-body\">\n          この計算は「1 対 1 のオールイン」モデルです。{label} の後ろに残っている {n} 人 ({list}) が\n          割り込んでくるリスクは含まれていません。{note}\n        </div>\n      </details>\n    ",
  "hand.banner.note.callBack": "ここで「call OK」と出ても実戦ではより硬い range で受けるべきです。",
  "hand.banner.note.pushBack": "ここで「push OK」と出ても実戦では over-call の可能性を加味してより硬い range で push するべきです。",

  // ===== index.html: 練習 =====
  "practice.h2": "🎲 練習問題",
  // practice-hint は updatePracticeHint() (render.ts) が textContent を制御する
  "practice.hint.callfold": "実戦形式のクイズで call/fold 判断を鍛えます。",
  "practice.hint.rp": "状況の Risk Premium を当てて ICM 感覚を鍛えます。",
  "practice.hint.push": "自分がオールインすべきかを鍛えます。",
  "practice.reviewBtn.html": "📚 復習 (<span id=\"review-count\">0</span>)",
  "practice.mode.callfold": "⚖️ call/fold 判定",
  "practice.mode.rp": "📊 RP 当て",
  "practice.mode.push": "🚀 push 判定",
  "practice.diff.label": "難易度:",
  "practice.diff.easy": "Easy",
  "practice.diff.normal": "Normal",
  "practice.diff.hard": "Hard",
  "practice.progress.summary": "📈 成績の推移",
  "practice.newBtn": "🎲 新しい問題",
  "practice.tutorialBtn": "🎓 導入コース",

  // ===== index.html: フッター =====
  "footer.version": "Poker ICM/BF",
  "footer.legalLink": "\n            📄 利用規約・プライバシーポリシー\n          ",

  // ===== 導入コース (tutorialState.ts: 固定5問) =====
  "practice.tutorial.q1.title": "チップ＝賞金の世界",
  "practice.tutorial.q1.narration": "全員が同じ賞金を狙う一発勝負 (Winner Take All)。ここではチップ＝そのまま賞金です。",
  "practice.tutorial.q1.lesson": "WTA では順位を上げること自体に賞金価値がなく、勝率がそのまま賞金期待値に直結します。だから Risk Premium はゼロ。cEV（チップ的な必要勝率）だけで判断できる、ICM プレッシャーが存在しない最もシンプルなケースです。",
  "practice.tutorial.q2.title": "相手をカバーしている",
  "practice.tutorial.q2.narration": "相手のスタックはあなたより少ない。もし負けても、あなたはまだトーナメントに残ります。",
  "practice.tutorial.q2.lesson": "自分が相手をカバーしている（負けても飛ばない）ときは、Risk Premium は小さめ。cEV に近い感覚でコールして大丈夫です。ICM プレッシャーは『自分が飛ぶリスク』があるときに強く働きます。",
  "practice.tutorial.q3.title": "バブルの罠",
  "practice.tutorial.q3.narration": "あなたは4人残りの3番手。チップリーダーがオールイン。ハンドは悪くない…がこれはワナかもしれない。",
  "practice.tutorial.q3.lesson": "チップの上ではコールが得（cEV的には+EV）でも、厳密な ICM で計算すると必要勝率が跳ね上がり、フォールドが正解になることがあります。これが『ICM プレッシャー』の正体。飛べば賞金の可能性がその場で消える一方、降りれば入賞と上の賞金を狙うチャンスが残るため、コールのリスクは額面以上に重いのです。",
  "practice.tutorial.q4.title": "短スタックを待て",
  "practice.tutorial.q4.narration": "卓にはあなたよりずっと短いスタックの選手がいます。相手のオールインはギリギリ微妙なラインです。",
  "practice.tutorial.q4.lesson": "自分より短いスタックが残っている間は、その選手が先に飛んでくれれば自動的に順位が上がります。無理にコールしなくても得られる価値がある以上、微妙なラインはフォールド優位になりがちです。",
  "practice.tutorial.q5.title": "サテライトの掟",
  "practice.tutorial.q5.narration": "上位がほぼ均等に賞金を得るサテライト。生き残ることそのものが目的です。AKs のような好ハンドでも、一度考え直しましょう。",
  "practice.tutorial.q5.lesson": "賞金がほぼ均等なサテライトでは、順位を1つ落とすことの価値がとても大きく、勝っても得られる価値はわずかです。そのため Risk Premium が極端に跳ね上がり、AKs や QQ 級の強いハンドでもフォールドが正解になることが多いのです。『残ること』が全てを支配します。",

  // ===== 導入コース UI (tutorial.ts) =====
  "practice.tutorial.progressLabel": "🎓 導入コース {step}/{total}",
  "practice.tutorial.introTitle": "🎓 まずは導入コース (5問・3分)",
  "practice.tutorial.introBody": "ICM の核心を体感しよう",
  "practice.tutorial.introStart": "▶ 導入コースを始める",
  "practice.tutorial.introSkip": "スキップして通常練習",
  "practice.tutorial.narrationTitle": "問題 {step}: {title}",
  "practice.tutorial.narrationBtn": "この状況を見る →",
  "practice.tutorial.completeTitle": "🎉 導入コース修了！",
  "practice.tutorial.completeSub": "学んだ5つの教訓",
  "practice.tutorial.completeBtn": "🎲 通常練習へ",
  "practice.tutorial.explainTitle": "💡 教訓: {title}",
  "practice.tutorial.nextBtn": "次の問題へ →",

  // ===== オンボーディング (guide.ts) =====
  "onboarding.step1.title": "🎰 これは何？",
  "onboarding.step1.body": `
      <p>
        トーナメントの「チップ枚数」と「賞金への価値」は同じではありません。
        本アプリはこの <strong>ICM プレッシャー</strong>を、数字で『計算』しながら
        クイズで『練習』もできます。
      </p>
      <ul class="onboarding-tab-list">
        <li><span class="onboarding-tab-icon">📊</span> 計算（スタックと賞金を入れると、必要勝率・コールできるハンド・Nash がその場で出る）</li>
        <li><span class="onboarding-tab-icon">🎲</span> 練習（クイズで実戦感覚）</li>
      </ul>
      <p class="hint">扱うのはオールインが絡む判断（相手のオールインにコールするか、ショートスタックで押すか）です。2BB オープンやリンプは計算しません。</p>
    `,
  "onboarding.step2.title": "⚡ まず触ってみる",
  "onboarding.step2.body": `
      <p>おすすめの入り口は2つあります。</p>
      <ol>
        <li>
          <strong>📊 計算</strong>でスタックを打ち換える（「例題・保存した局面」から選んでも OK）→
          すぐ下の必要勝率とハンド表を確認する
        </li>
        <li>
          <strong>🎲 練習</strong>タブでクイズに答えながら感覚を掴む
        </li>
      </ol>
      <p class="hint">
        どちらから始めても OK。困ったときはヘッダー右上の <strong>❓</strong> から、
        いつでも使い方ガイドと用語解説を開けます。
      </p>
    `,
  "onboarding.skip": "スキップ",
  "onboarding.next": "次へ →",
  "onboarding.cta.practice": "🎲 練習を始める",
  "onboarding.cta.setup": "⚙️ 自分で設定する",

  // ===== 使い方ガイド (guide.ts) =====
  "guide.title": "📖 使い方ガイド",
  "guide.close.aria": "閉じる",
  // アプリ版のみ表示 (guide.ts proNoteHtml)。価格は書かない。
  "guide.proNote.html":
    "ℹ️ シナリオプリセット・計算結果・ナッシュ均衡・練習はすべて無料。<strong>4人までのテーブルはスタック・ペイ構造とも自由に編集できます</strong>。5人以上のテーブルの編集とシナリオ保存は 🔒 Pro（買い切り）機能です。",
  "guide.body.html": `
        <p class="guide-intro">
          このツールはショートスタック（〜20bb）のオールイン局面に特化しています。
        </p>
        <details class="howto">
          <summary>📊 計算: 局面の入力 — できること・使い方</summary>
          <div class="howto-body">
            <p>画面の一番上の「局面」で、スタック・位置・自分/相手・賞金を入れます。結果はそのすぐ下に出て、入力のたびに更新されます。</p>
            <ol>
              <li>「例題・保存した局面」を開いてタップすると、状況を一発セット</li>
              <li>スタックを調整（足りなければ + プレイヤー追加）。賞金とブラインドは行をタップして開く</li>
              <li>「自分」「相手」をタップで指定</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>📊 計算: 賞金・BF — できること・使い方</summary>
          <div class="howto-body">
            <p>賞金期待値 (ICM)、Bubble Factor、必要勝率と RP の内訳を見る画面。</p>
            <ol>
              <li>「局面」で状況を入力（例題でも OK）</li>
              <li>「賞金期待値 (ICM)」の表で各プレイヤーの取り分を確認</li>
              <li>「BF マップ」で自分の行・相手の列のセルを確認</li>
              <li>コール額と純利得は自動で入る（手で書き換えた後は「🔄 自動算出に戻す」で戻せる）</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🃏 計算: ハンド — できること・使い方</summary>
          <div class="howto-body">
            <p>相手のレンジを置いて、自分がコールできる（または押せる）ハンドを表で見る画面。</p>
            <ol>
              <li>向きは席順で自動で決まる（先に動く方がオールイン）。位置が未設定のときだけ自分で選ぶ</li>
              <li>スライダーか 10〜100% のボタンで相手のレンジを調整。左の小さい表をタップすると大きい表が開く。カスタム編集ならセルをタップして選択</li>
              <li>グリッドの色分けで自分がコール/プッシュすべきハンドを確認</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎯 計算: Nash — できること・使い方</summary>
          <div class="howto-body">
            <p>HU push/fold の Nash 均衡（ICM 反映済み）を計算する画面。</p>
            <ol>
              <li>「局面」で自分と相手を指定（先に動く方が押す側になる）</li>
              <li>必要なら「ブラインド」行を開いて SB / アンティ合計を変える</li>
              <li>「Nash」を開くと自動で計算される</li>
              <li>push レンジと call レンジのグリッドを見比べる</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎲 練習 — できること・使い方</summary>
          <div class="howto-body">
            <p>ランダムなシナリオでコール/フォールド判断や Risk Premium 当て、push 判定を練習できる画面。</p>
            <ol>
              <li>難易度を選んで「🎲 新しい問題」を押す</li>
              <li>相手の push 想定レンジと自分のハンドを見て ✅コール / ❌フォールドを判断（RP 当てモードはスライダーで数値回答、🚀push 判定モードでは自分 (SB) が 🚀オールイン / ❌フォールドかを判断）</li>
              <li>正誤と計算式を確認し、間違えたら 📚復習 リストで解き直す</li>
            </ol>
          </div>
        </details>
        <details class="howto" id="guide-limits">
          <summary>📐 計算の前提と限界</summary>
          <div class="howto-body">
            <h4>何を計算しているか</h4>
            <ul>
              <li><strong>ICM は Malmuth-Harville 方式</strong>。スタックの比で各順位の確率を決め、賞金期待値に直します。</li>
              <li><strong>必要勝率</strong>は、降りた時・コールして勝った時・負けた時の3通りを ICM で比べて出します。コール額を手入力したときと、BB の人が決まっていない卓だけ、BF を使った概算になります。</li>
              <li><strong>ハンドの勝率</strong>は 169 種類どうしの対戦表（1組あたり 100 万回のシミュレーション）を、手札でカードが減る分も数えて使います。</li>
              <li><strong>Nash</strong> は2人の「押すか降りるか／コールするか降りるか」の均衡を、賞金期待値で解きます。</li>
              <li>ブラインドは <strong>BB アンティ</strong>（BB の人が全員分のアンティを払う）前提です。</li>
            </ul>
            <h4>計算していないこと</h4>
            <ul>
              <li><strong>オールインに関わるのは2人だけ</strong>。後ろに残っている人がコールしてくる場合（オーバーコール）は計算せず、該当するときに注意を出します。</li>
              <li><strong>次のハンド以降は見ません</strong>。ICM の性質上、すぐブラインドが回ってくるか、プレイヤーの上手さの差などは入りません。</li>
              <li><strong>オールイン以外の選択肢</strong>（2BB オープン、リンプ、3ベット）は扱いません。自分から押す計算は実効 12BB 以下が目安で、20BB を超えると参考表示にします。</li>
              <li><strong>プレイヤーは 9 人まで</strong>。複数卓にまたがるバブルは入力できません。</li>
              <li>相手レンジの<strong>「上位 X%」は対ランダム勝率の順</strong>です。実際の相手はスーテッドコネクターや小さいペアを多めに含むことがあるので、気になるときは「カスタム編集」で相手のレンジを直接選んでください。</li>
            </ul>
            <h4>確かめたこと</h4>
            <ul>
              <li>ICM: 全順列を数える別の実装と 402 局面（2〜9人）で突き合わせ、差は 0.000000001 未満。</li>
              <li>ハンドの勝率: AA vs KK 82.0%、AKo vs QQ 43.2%、AA 対ランダム 85.2% など、よく知られた値と一致。</li>
              <li>Nash: 2人・10BB・勝者総取りで push 58.1% / call 37.4%。どちらが戦略を変えても 0.001BB も得をしないことを別の計算で確認。</li>
            </ul>
            <p class="hint">計算結果は判断の目安です。実戦では相手の傾向や後ろの人数も合わせて考えてください。</p>
          </div>
        </details>
        <details class="howto">
          <summary>📚 用語ミニ解説</summary>
          <div class="howto-body">
            <h4>ICM (Independent Chip Model)</h4>
            <p>
              トナメのチップは賞金と1:1では換算できません（<strong>チップ ≠ 賞金価値</strong>）。
              ICM は、いまのチップ量が賞金にするといくら分かを見積もる計算モデルです。
              例: ICM% が 25% なら、平均して総賞金の 1/4 を持っていける期待値ということ。
            </p>
            <h4>Bubble Factor (BF)</h4>
            <p>
              <strong>負けた時の痛み ÷ 勝った時の嬉しさ</strong>を表す係数。
              BF = 1.3 なら、負けて減る賞金期待値が、勝って増える分の 1.3 倍。同額を賭け合うオールインなら、必要勝率は 50% ではなく<strong>約 56.5%</strong>（1.3 ÷ 2.3）になります。
            </p>
            <h4>Risk Premium (RP)</h4>
            <p>
              チップだけで見た必要勝率（cEV）より<strong>何ポイント余分に勝率が必要か</strong>を表す差分。
              ICM プレッシャーが強い場面ほど RP は大きくなります。
            </p>
            <h4>Nash 均衡</h4>
            <p>
              🎯push 側も ⚔️call 側も、片方だけ戦略を変えても得をしない
              「お互いに搾取されない」push/fold 戦略の組み合わせのことです。
            </p>
          </div>
        </details>
        <details class="howto">
          <summary>❓ 「上位 X%」とは</summary>
          <div class="howto-body">
            <p>
              相手のレンジを決める「上位 X%」は、<strong>ランダムなハンドに対する勝率が高い順</strong>に、全ハンドの組合せの X% ぶんを取ったものです。
              他のツールの順位（プッシュ向きの順位など）とは並びが違うため、<strong>同じ X% でも中身のハンドが一致しないことがあります</strong>。
              実際の相手に合わせたいときは「カスタム編集」で直接選んでください。
            </p>
          </div>
        </details>
        <button type="button" class="solve-btn guide-reopen-btn" id="guide-reopen-onboarding-btn">🔄 もう一度はじめのガイドを見る</button>
        <button type="button" class="guide-legal-link" id="guide-legal-link">📄 利用規約・プライバシーポリシー</button>
      `,

  // ===== 初回ヒントバー (guide.ts) =====
  "firstHint.html": "👋 はじめてなら: <strong>プリセット</strong>をタップ → <strong>📊</strong>で結果を見る、か <strong>🎲</strong>で練習",
  "calc.limitsLink": "計算の前提と限界を見る ›",
  "firstHint.close.aria": "閉じる",

  // ===== PWA (pwa.ts) =====
  "pwa.swUpdate.aria": "新しいバージョンがあります。タップで更新",
  "pwa.swUpdate.text": "🔄 新しいバージョンがあります — タップで更新",
  "pwa.close.aria": "閉じる",
  "pwa.install.title": "ホーム画面に追加",
  "pwa.install.aria": "インストール",
  "pwa.iosBanner.text": "ホーム画面に追加でアプリとして使えます: 共有ボタン → ホーム画面に追加",
  "pwa.offline.text": "📡 オフライン — 計算はすべて端末内で動作します",

  // ===== 練習問題の表示 (render.ts) =====
  // 卓面ラベル (Phase B 抽出)
  "practice.table.bbLeft": "BB 残",
  "practice.table.pot": "Pot",
  "practice.table.ante": "ante",
  // bento カードの英語ラベル (Phase B 抽出。日本語表示でも従来どおり英語のまま)
  "practice.bento.tournamentState": "この問題の条件",
  "practice.bento.blinds": "ブラインド",
  "practice.bento.heroStack": "自分のスタック",
  "practice.bento.ante": "アンティ合計",
  "practice.bento.pay": "ペイ",
  "practice.villainWarn.head": "相手 ({pos}) がオールイン",
  "practice.villainWarn.estPush": "想定レンジ",
  "practice.villainCall.head": "相手 (BB) の想定コールレンジ",
  "practice.villainCall.estCall": "想定コールレンジ",
  "practice.villainPushRange.h3": "⚔️ 相手の push レンジ 🔴",
  "practice.villainCallRange.h3": "⚔️ 相手の call レンジ 🔴",
  "practice.yourHand": "あなたのハンド: {hand}",
  "practice.yourHandSb": "あなたのハンド (SB): {hand}",
  "practice.btn.call": "✅ コール",
  "practice.btn.fold": "❌ フォールド",
  "practice.btn.push": "🚀 オールイン",
  "practice.rp.callRisk": "コール額 (リスク)",
  "practice.rp.return": "リターン",
  "practice.rp.question": "📊 この状況の Risk Premium は？",
  "practice.rp.easyPick": "4択から選んでタップ (Easy)",
  "practice.rp.tol": "許容誤差 ±{tol}%（難易度で変化）",
  "practice.rp.answerBtn": "回答する",

  // ===== 練習: バッジ (judge.ts) =====
  "practice.badge.streak": "🔥 連続正解 {n}",
  "practice.badge.acc": "正解率 {pct}% ({correct}/{total})",
  "practice.badge.accEmpty": "正解率 -",

  // ===== 練習: 教訓 (judge.ts practiceLesson / practicePushLesson) =====
  "practice.lesson.wta": "🏆 WTA (勝者総取り) ではチップ＝賞金がリニア。ICM 圧はゼロなので、cEV (チップの損得) どおりに判断できます。",
  "practice.lesson.satellite": "🛰 サテライトでは『残ること』が全て。特に入賞圏に近い中〜大スタックほど RP が極端に上がり、強いハンドでもコールが正当化されにくくなります（逆に、飛んでも失うものが少ない最短スタックは広くコールできます）。",
  "practice.lesson.covered": "⚠️ カバーされている相手へのコールは、負け＝敗退。トーナメント生命を賭けるため Risk Premium が跳ね上がります。",
  "practice.lesson.covering": "自分が相手をカバーしている時は、負けても飛ばないため RP は小さめ。cEV に近い基準で判断できます（それでも勝率が足りないハンドはフォールドです）。",
  "practice.lesson.shorter": "自分より短いスタックが残っている間は、無理に勝負しなくても順位が上がる可能性があります。それが RP の源泉です。",
  "practice.lesson.general": "必要勝率 = cEV + Risk Premium。ICM 下では『チップで得』でも『賞金で損』になり得ることを常に確認しましょう。",
  "practice.pushLesson.wta": "🏆 WTA (勝者総取り) では ICM 圧はゼロ。push もチップ EV (cEV) どおりに判断できます。",
  "practice.pushLesson.satellite": "🛰 サテライトでは『残ること』が全て。入賞圏に近いスタックほど push 側も極端にタイトになり、スチールが見込めても多くのハンドは fold が正解になりがちです（最短スタックは逆に、ほぼ何でも push できる場面が出てきます）。",
  "practice.pushLesson.covered": "⚠️ カバーされている相手への push は、コールされて負ければ即敗退。トーナメント生命を賭けるため、通常よりタイトな range で push すべきです。",
  "practice.pushLesson.steal": "💨 相手のコール率 (=スチール成功率の裏返し) が低いほど、ハンドが弱くても push を広げられます。fold されて pot を丸取りできる期待が大きいためです。",
  "practice.pushLesson.general": "push の $EV = (1−コール率)×スチール成功時 + コール率×(勝率×勝ち時 + (1−勝率)×負け時)。fold の $EV と比較し、必ず ICM 込みで判断しましょう。",

  // ===== 練習: 判定フィードバック共通 (judge.ts) =====
  "practice.verdict.correct": "🎉 正解!",
  "practice.verdict.wrong": "😅 不正解",
  "practice.verdict.answerPrefix": "正答:",
  "practice.verdict.call": "✅ コール (+EV)",
  "practice.verdict.fold": "❌ フォールド (-EV)",
  "practice.verdict.push": "🚀 オールイン (+EV)",
  "practice.nextBtnTop": "🎲 次へ",
  "practice.nextBtn": "🎲 次の問題",
  "practice.applyBtn": "📥 設定に取り込む (詳細分析)",
  "practice.details.summary": "📖 詳しい計算式 (タップで展開)",
  "practice.label.margin": "余裕:",

  // ===== 練習: RP フィードバック (judge.ts judgePracticeRP) =====
  "practice.rp.yourAnswerLabel": "あなたの回答:",
  "practice.rp.correctLabel": "正解 RP (厳密 ICM):",
  "practice.rp.tolNote": "(許容 ±{tol}%)",
  "practice.rp.errorLabel": "誤差:",

  // ===== 練習: call/fold フィードバック (judge.ts judgePractice) =====
  "practice.cf.reqLabel": "必要勝率:",
  "practice.cf.cevNote": "（チップだけなら {v}%）",
  "practice.push.pCallLabel": "相手がコールする確率:",
  "practice.push.eqLabel": "コールされた時の勝率:",
  "practice.push.diffLabel": "push と fold の差（賞金総額比）:",
  "practice.topPct": "上位 {pct}%",
  "practice.cf.handEquity": "{hand} の勝率（相手 上位 {pct}%）:",
  "practice.cf.heroRangeH3": "🎯 自分の call レンジ 🟢 (必要勝率 {pct}% 超のハンド)",
  "practice.cf.legend.call": "call (余裕 +0% 以上 = +EV)",
  "practice.cf.legend.fold": "fold (余裕 マイナス = -EV)",

  // ===== 練習: push 判定フィードバック (judge.ts judgePracticePush) =====
  "practice.push.heroRangeH3": "🚀 自分の push レンジ 🟢 (push +EV のハンド)",

  // ===== 練習: 復習 (review.ts) =====
  "practice.review.empty": "まだ復習問題はありません。不正解の問題が自動で蓄積されます (最大50問)。",

  // ===== 練習: 成績の推移 (progress.ts) =====
  "practice.progress.notEnough": "まだデータが足りません ({n}問)",
  "practice.progress.sparklineAria": "直近の正解率推移",
  "practice.progress.recent20": "直近20問",
  "practice.progress.allTime": "全期間",
  "practice.progress.qCount": "{c}/{t}問",
  "practice.progress.trendTitle": "推移 (直近100問・10問ごとの正解率)",
  "practice.progress.byDiff": "難易度別",
  "practice.progress.byMode": "モード別",
  "practice.progress.mode.callfold": "コール/フォールド判定",
  "practice.progress.mode.rp": "RP 当て",
  "practice.progress.mode.push": "push 判定",
  "practice.progress.resetBtn": "🗑️ 履歴をリセット",
  "practice.progress.resetConfirm": "練習履歴（成績の推移データ）をリセットしますか？\n※連続正解数・累計正解率・復習リストは変更されません。",

  // ===== 計算結果 (calculator.ts) =====
  "calc.err.needPlayer": "プレイヤーを1人以上入れてください",
  "calc.err.needPayout": "賞金を1つ以上入れてください",
  "calc.bf.err.needHV": "🎯自分と⚔️相手を1人ずつ指定してください",
  "calc.bf.err.sameHV": "🎯自分と⚔️相手は別の人にしてください",
  "calc.bf.err.zeroStack": "スタックが0なのでBF計算不可",
  "calc.bf.label.bf": "自分 vs 相手の BF",
  "calc.bf.label.risk": "リスクチップ",
  "calc.autofill.summaryLine": "✓ 追加 call <strong>{call}</strong> / 純利得 <strong>{pot}</strong> BB",
  "calc.autofill.detailsSummary": "▸ 計算の内訳",
  "calc.autofill.err.needHV": "⚠ 🎯自分と⚔️相手を1人ずつ指定してください",
  "calc.autofill.err.zeroStack": "⚠ スタックが0です",
  "calc.autofill.result": "✓ コール <strong>{risk}</strong>, 純利得 <strong>{pot}</strong> = リスク {risk2} + 死に金 {dead} (SB {sb} + BB {bb} + アンティ {ante})",
  // 「▸ 計算の内訳」details 本体 (Phase B 抽出)
  "calc.autofill.potComp": "📊 ポット構成",
  "calc.autofill.heroBlind": "自分({pos}) blind: <code>{v}</code> <span class=\"muted\">(sunk)</span>",
  "calc.autofill.heroAnte": "自分({pos}) ante: <code>{v}</code> <span class=\"muted\">(sunk, BB全額)</span>",
  "calc.autofill.villainAnte": "相手({pos}) ante: <code>{v}</code> <span class=\"muted\">(sunk, BB全額)</span>",
  "calc.autofill.anteDead": "ante dead: <code>{v}</code> <span class=\"muted\">(前任 BB folded)</span>",
  "calc.autofill.heroToPay": "自分これから払う <strong>call</strong>: <code>{v}</code>",
  "calc.autofill.villainPush": "相手({pos}) push (live): <code>{live}</code>{blind} = <code>{matched}</code>",
  "calc.autofill.villainPushBlind": " + 既出 blind {v}",
  "calc.autofill.totalPot": "合計 pot: {v} BB",
  "calc.autofill.callVsFold": "⚖️ コール vs フォールド",
  "calc.autofill.tableHead": "<tr><th>選択</th><th>残スタック</th><th>vs fold</th><th>起点比</th></tr>",

  // ===== 状況サマリー (calculator.ts renderHeroSummary) =====
  "calc.summary.title": "この局面",
  "calc.summary.sample": "サンプル",
  "calc.summary.expand": "展開",
  "calc.summary.collapse": "折りたたみ",
  "calc.summary.collapseToggle": "折りたたみ切替",
  "calc.summary.hero": "自分",
  "calc.summary.prizeShare": "賞金の取り分",
  "calc.summary.prizeExplanation": "取り分は賞金総額に対する目安（ICM）です。33%なら総額1万円に対し約3,300円相当。ハンドの勝率や確定賞金ではありません。",
  "calc.summary.pushReference": "※ BF・必要勝率・RP はコールする場合の値です。",
  "nash.inputsChanged": "局面が変わりました。現在の条件でNashを再計算してください。",
  "calc.summary.considerCall": "コールを検討",
  "calc.summary.considerPush": "プッシュを検討",
  "calc.summary.allIn": "オールイン",
  "calc.summary.assumedCall": "コールを想定",
  "calc.summary.villain": "相手",
  "calc.summary.villainUnset": "相手未指定",
  "calc.summary.aroundHtml": "<span>👥 周り <strong>{stacks}</strong> BB</span>",
  "calc.summary.bfLabel": "BF ⓘ",
  "calc.eq.approxNote": "コール額を手入力したとき・BB の人が決まっていない卓では、BF を使った概算になります。",
  "calc.summary.reqLabel": "必要勝率 ⓘ",
  "calc.summary.rpLabel": "RP ⓘ",
  "calc.summary.verdict.call": "相手のレンジを {villain}% と仮定すると、コールできるのは全ハンドの約 <strong>{hero}%</strong>",
  "calc.summary.verdict.callNone": "相手のレンジを {villain}% と仮定すると、コールできるハンドはほぼ無し",
  "calc.summary.verdict.push": "相手のコールレンジを {villain}% と仮定すると、押せるのは全ハンドの約 <strong>{hero}%</strong>",
  "calc.summary.verdict.pushNone": "相手のコールレンジを {villain}% と仮定すると、押せるハンドはほぼ無し",
  "calc.summary.verdict.link": "ハンド表 ›",

  // ===== 警告 (calculator.ts) =====
  "calc.warn.position.html": "\n      ⚠ <strong>ポジション逆転</strong>: 行動順は <code>{heroPos}({heroAct}) → {villainPos}({villainAct})</code>。\n      実戦では <strong>hero ({heroPos}) が先に行動</strong>するため、villain ({villainPos}) の open push に対して call することはあり得ません。\n      (call 計算は math 上は動きますが、ポジを入れ替える方が現実的)\n    ",
  "calc.warn.depth.html": "⚠️ 実効 {eff}bb：オールインされた後のコール判断なので、この計算はそのまま使えます。ただ、この深さでいきなりオールインしてくる相手はかなり強いハンドに絞られることが多いので、相手レンジは狭めに設定してください。",

  // ===== 用語解説モーダル (calculator.ts INFO_TEXTS) =====
  "info.icm.title": "ICM (Independent Chip Model)",
  "info.icm.body": `
      <p>トナメの<strong>チップ量を、賞金にするといくら分か</strong>に直す計算モデル。</p>
      <p>賞金は順位ごとに決まっているので、チップが 2倍になっても賞金は 2倍になりません。<br />
      一方でチップを全部失うと、その時点の順位の賞金で確定します。この非対称を数字にします。</p>
      <p>ICM% は <code>その人の賞金期待値 ÷ 賞金総額</code>。例: 25% = 平均すると賞金総額の 1/4 を持ち帰れる見込み。</p>
      <p>このアプリは Malmuth-Harville 方式（スタックの比で各順位の確率を決める、最も一般的な ICM）で計算しています。</p>
    `,
  "info.bf.title": "BF (Bubble Factor)",
  "info.bf.body": `
      <p><strong>「負けて減る賞金期待値 ÷ 勝って増える賞金期待値」</strong>。2人が実効スタックを賭けてオールインした場合の値です。</p>
      <ul>
        <li><strong>1.00</strong>: 減る分と増える分が同じ（ICM の影響なし。2人だけの勝負など）</li>
        <li><strong>1.20</strong>: 減る分が増える分の 1.2 倍。同額を賭け合う勝負で必要勝率 54.5%</li>
        <li><strong>1.50</strong>: 同じ条件で必要勝率 60%。バブル前後でよく出る水準</li>
      </ul>
      <p>定義: <code>BF = (現在 − 負けた時) ÷ (勝った時 − 現在)</code>（いずれも ICM の賞金期待値）。ICM の解説で一般的に使われる定義です。</p>
      <p>※ 同額を賭け合う勝負（1:1 のオッズ）では <code>必要勝率 = BF ÷ (BF + 1)</code>。</p>
    `,
  "info.rp.title": "Risk Premium (RP)",
  "info.rp.body": `
      <p><strong>ICM を入れた必要勝率と、チップだけで見た必要勝率（cEV）の差</strong>。賞金を考えると、どれだけ余分に勝率が要るかを表します。</p>
      <ul>
        <li>RP = 0%: チップだけで判断してよい（ICM の影響なし）</li>
        <li>RP = +10%: チップだけなら 50% で足りる勝負に、60% が必要</li>
      </ul>
      <p>大きさは局面しだいです。バブル前後や、サテライトで通過圏にいるスタックほど大きくなり、飛んでも失うものが少ない最短スタックでは小さくなります。</p>
      <p>計算: <code>RP = ICM を入れた必要勝率 − チップだけの必要勝率</code></p>
      <p>同額を賭け合う勝負では: <code>RP = BF ÷ (BF + 1) − 50%</code></p>
    `,
  // ===== ナッシュ均衡 (nashUI.ts) =====
  "nash.overcall.between": "<strong>{n}</strong> 人が pusher と caller の間 ({list})",
  "nash.overcall.behind": "<strong>{n}</strong> 人が caller の後ろ ({list})",
  "nash.overcall.callerTighten": "<br />→ <strong>caller ({callerPos}) も狭く call</strong> すべき (後ろに {n} 人控えてるため)。",
  "nash.overcall.callerOk": "<br />→ caller ({callerPos}) は概ね HU Nash 通り (介在者が降りた前提なので)。",
  "nash.overcall.main.html": "\n    ⚠ <strong>HU Nash 想定外の介入者あり</strong>: {parts}。\n    <br />→ <strong>pusher ({pusherPos}) は HU Nash よりさらに狭く push</strong> すべき\n    （介在者が強いハンドで over-call/3bet する分、fold equity が減るため）。\n    {callerAdvice}\n    <br />当 Nash 結果は HU 2-way 想定の参考値として読んでください。\n  ",
  "nash.err.needHV": "🎯自分と⚔️相手をそれぞれ1人ずつ指定してください",
  "nash.err.needPayout": "ペイ構造を入力してください",
  "nash.err.sb": "SB が不正",
  "nash.err.bb": "BB が不正",
  "nash.err.ante": "アンティが不正",
  "nash.calculating": "計算中…",
  "nash.notConverged": "未収束",
  "nash.depthNote.html": "⚠ 実効 <strong>{eff}BB</strong>：実戦では 2BB オープンやリンプも普通に選ばれる深さです。この結果は「押すか降りるかの2択に限った場合」で、実際に押すべきハンドはこれより少なくなります。",
  "nash.depthOut.html": "⚠ 実効 <strong>{eff}BB</strong> は push/fold で判断する深さではありません。この深さでは 2BB オープン・リンプ・3ベットを含めて考えるのが普通で、本アプリはそれらを計算しません。下の結果を実戦の判断にそのまま使わないでください。",
  "nash.depthOut.reveal": "2択に限った参考値を見る",
  "hand.pushDepth.caution.html": "⚠ 実効 <strong>{eff}BB</strong>：実戦では 2BB オープンやリンプも選ばれる深さです。ここの push 可能ハンドは「押すか降りるかの2択に限った場合」の上限です。",
  "hand.pushDepth.out.html": "⚠ 実効 <strong>{eff}BB</strong> は push/fold の範囲外です（2BB オープン・リンプ・3ベットを計算していません）。この push 判定を実戦の判断にそのまま使わないでください。",
  "nash.stats": "{n} 種類 / {combos} コンボ (<strong>{pct}%</strong>)",
  "nash.matrixMissing": "⚠ HU equity matrix が未生成です（hu-equity-matrix.json）。`npx tsx scripts/build-hu-matchups.mts` を実行してください。",

  "info.req.title": "必要勝率 (Required Equity)",
  "info.req.body": `
      <p>このコールが<strong>損も得もしなくなる最低の勝率</strong>。ハンドの勝率がこれを超えるならコール、下回るならフォールド。</p>
      <ul>
        <li><strong>チップだけなら（cEV）</strong>: ポットオッズだけで出した必要勝率。ICM は見ない</li>
        <li><strong>必要勝率（ICM）</strong>: 賞金期待値で出した必要勝率。実戦の判断はこちら</li>
      </ul>
      <p>計算: <code>必要勝率 = (降りた時 − 負けた時) ÷ (勝った時 − 負けた時)</code><br />
      降りた時・コールして勝った時・コールして負けた時の全員のスタックを、それぞれ ICM で賞金期待値に直して比べます。</p>
      <p>コール額を手入力したときと、BB の人が決まっていない卓では、BF を使った概算
      <code>(コール額 × BF) ÷ (コール額 × BF + 勝った時の純利得)</code> になります。</p>
    `,

  // ===== 練習: 「📖 詳しい計算式」details 本体 (judge.ts, Phase B 抽出) =====
  // RP 当てモード
  "practice.rpDetails.body.html": `
        <h4>1. Bubble Factor (参考値: 対称フリップ近似)</h4>
        <p><code>BF = (現状 − 負け) ÷ (勝ち − 現状) = {bfNum} ÷ {bfDen} = {bf}</code></p>
        <h4>2. 必要勝率</h4>
        <ul>
          <li>cEV: <code>リスク ÷ (リスク + リターン) = {call} ÷ ({call} + {pot}) = {cev}%</code></li>
          <li>$EV (BF 近似): <code>(リスク × BF) ÷ (リスク × BF + リターン) = {evBF} ÷ ({evBF} + {pot}) = {approx}%</code></li>
          <li>$EV (厳密 ICM): <code>(Efold − Elose) ÷ (Ewin − Elose) = {exactNum} ÷ {exactDen} = {exact}%</code></li>
        </ul>
        <h4>3. Risk Premium</h4>
        <p><code>RP = 厳密$EV − cEV = {exact}% − {cev}% = +{rp}%</code></p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          BF 近似: <strong>+{rpApprox}%</strong> / 厳密 ICM: <strong style="color: var(--accent);">+{rp}%</strong>（判定はこちら）
        </p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF が大きい (バブルに近い / スタックが拮抗) ほど RP は大きくなります。BF 近似は境界付近で厳密値と数%ずれることがあります。
        </p>
      `,

  // call/fold 判定モード
  "practice.cfDetails.sbDeadLine": `<li>SB dead blind: <code>{v}</code> BB <span style="color: var(--muted);">(SB folded → dead)</span></li>`,
  "practice.cfDetails.verdictCall": "コール (+EV)",
  "practice.cfDetails.verdictFold": "フォールド (-EV)",
  "practice.cfDetails.body.html": `
        <h4>1. ポット構成 (BB ante 構造)</h4>
        <ul style="font-size: 12px; line-height: 1.5;">
          <li>自分(BB) blind: <code>{bb}</code> BB <span style="color: var(--muted);">(既出 sunk)</span></li>
          <li>自分(BB) ante: <code>{ante}</code> BB <span style="color: var(--muted);">(既出 sunk, BBが全額負担)</span></li>
          {sbDeadLine}
          <li>自分(BB) これから払う <strong>call</strong>: <code>{callFixed}</code> BB</li>
          <li>相手({villainPos}) match: <code>{villainMatch}</code> BB <span style="color: var(--muted);">(全 stack {villainStack} のうちマッチ分)</span></li>
          <li><strong>合計 pot (showdown 時): {pot} BB</strong></li>
        </ul>

        <h4>2. 判断 (call vs fold 比較・終端スタック)</h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr><th style="text-align:left; padding: 4px;">選択</th><th style="text-align:right; padding: 4px;">最終スタック</th><th style="text-align:right; padding: 4px;">vs fold</th><th style="text-align:right; padding: 4px;">起点比</th></tr>
          <tr><td style="padding: 4px;">フォールド</td><td style="text-align:right; padding: 4px;"><code>{stackFold}</code></td><td style="text-align:right; padding: 4px;"><code>±0</code></td><td style="text-align:right; padding: 4px; color: {netFoldCol};"><code>{netFoldSign}{netFold}</code></td></tr>
          <tr><td style="padding: 4px;">コール+勝ち</td><td style="text-align:right; padding: 4px;"><code>{stackWin}</code></td><td style="text-align:right; padding: 4px; color: var(--good);"><code>{winVsFoldSign}{winVsFold}</code></td><td style="text-align:right; padding: 4px; color: {netWinCol};"><code>{netWinSign}{netWin}</code></td></tr>
          <tr><td style="padding: 4px;">コール+負け</td><td style="text-align:right; padding: 4px;"><code>{stackLose}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>{loseVsFold}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>{netLose}</code></td></tr>
        </table>
        <p style="font-size: 11px; color: var(--muted); margin: 6px 0 0;">
          📌 この3つの終端スタック (fold / コール+勝ち / コール+負け) が、下の「3. ICM エクイティ」の計算にそのまま使われます。<br>
          「起点 (hand 開始) からの純利益」は <strong>{netWinSign}{netWin} BB</strong> (= 最終 {stackWin} − 起点 {heroStack})。
        </p>

        <h4>3. ICM エクイティ ($ 単位・厳密計算)</h4>
        <ul>
          <li>フォールド時: <code>{eqFold}</code></li>
          <li>コール+勝った時: <code>{eqWin}</code> (fold比 {eqWinVsFoldSign}{eqWinVsFold})</li>
          <li>コール+負けた時: <code>{eqLose}</code> (fold比 {eqLoseVsFold})</li>
        </ul>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ 上の「2. 判断」の終端スタックそれぞれを ICM (Malmuth-Harville) に通した $ エクイティです。近似 (BF) を経由しない厳密値です。
        </p>

        <h4>4. 参考: Bubble Factor 近似 (実効スタックの対称フリップ)</h4>
        <p><code>BF = (現状 − 負け) ÷ (勝ち − 現状) = {bfNum} ÷ {bfDen} = {bf}</code></p>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF は「実効スタック同士の対称フリップ」という汎用シナリオで測った指標で、実際のコールの fold/win/lose 終端 (上のセクション2・3) とは別の計算です。参考値として掲載しています。
        </p>

        <h4>5. 必要勝率 + Risk Premium</h4>
        <ul>
          <li>cEV: <code>リスク ÷ (リスク + リターン) = {call} ÷ ({call} + {potIfWin}) = {cev}%</code></li>
          <li>$EV (BF 近似・線形化): <code>(リスク × BF) ÷ (リスク × BF + リターン) = ({call} × {bf2}) ÷ ({call} × {bf2} + {potIfWin}) = {approx}%</code></li>
          <li>$EV (厳密 ICM): <code>(Efold − Elose) ÷ (Ewin − Elose) = {exactNum} ÷ {exactDen} = {exact}%</code></li>
        </ul>
        <p style="font-size: 12px; margin: 6px 0;">
          <strong>BF 近似: {approx}% / 厳密 ICM: <span style="color: var(--accent);">{exact}%</span>（判定はこちら）</strong>
        </p>
        <ul>
          <li><strong>RP (厳密 ICM)</strong>: <code>厳密$EV − cEV = {exact}% − {cev}% = {rpSign}{rp}%</code></li>
        </ul>
        <p style="font-size: 11px; color: var(--muted); margin: 4px 0 0;">
          ※ BF 近似は線形化のため境界付近で厳密値と 1〜2% ずれることがあります。call/fold の判定は必ず厳密 ICM 側 ({exact}%) を使用しています。
        </p>

        <h4>6. ハンド equity</h4>
        <p><code>{heroHand}</code> vs 上位 {villainCallRangePct}% → <strong>{heroEq}%</strong></p>

        <h4>7. 判定</h4>
        <p>
          ハンド equity <code>{heroEq}%</code>
          {verdictOp}
          必要勝率 (厳密 ICM) <code>{exact}%</code>
          → <strong>{verdict}</strong>
        </p>
      `,

  // push 判定モード
  "practice.pushDetails.verdictPush": "オールイン (+EV)",
  "practice.pushDetails.verdictFold": "フォールド (-EV)",
  "practice.pushDetails.body.html": `
        <h4>1. ポット構成 (push→call 時, BB ante 構造)</h4>
        <ul style="font-size: 12px; line-height: 1.5;">
          <li>自分(SB) push (全 stack): <code>{heroStack}</code> BB</li>
          <li>相手(BB) ante: <code>{ante}</code> BB <span style="color: var(--muted);">(BB が全額負担, dead)</span></li>
          <li>matched (少ない方に揃える): <code>{matched}</code> BB</li>
          <li><strong>合計 pot (showdown 時): {pot} BB</strong></li>
        </ul>

        <h4>2. 終端スタック (push 判定 4 終端)</h4>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr><th style="text-align:left; padding: 4px;">終端</th><th style="text-align:right; padding: 4px;">最終スタック</th><th style="text-align:right; padding: 4px;">起点比</th></tr>
          <tr><td style="padding: 4px;">フォールド (push しない)</td><td style="text-align:right; padding: 4px;"><code>{stackFold}</code></td><td style="text-align:right; padding: 4px; color: {foldCol};"><code>{foldSign}{foldRel}</code></td></tr>
          <tr><td style="padding: 4px;">push → villain fold (スチール)</td><td style="text-align:right; padding: 4px;"><code>{stackSteal}</code></td><td style="text-align:right; padding: 4px; color: {stealCol};"><code>{stealSign}{stealRel}</code></td></tr>
          <tr><td style="padding: 4px;">push → call → 勝ち</td><td style="text-align:right; padding: 4px;"><code>{stackWin}</code></td><td style="text-align:right; padding: 4px; color: var(--good);"><code>{winSign}{winRel}</code></td></tr>
          <tr><td style="padding: 4px;">push → call → 負け</td><td style="text-align:right; padding: 4px;"><code>{stackLose}</code></td><td style="text-align:right; padding: 4px; color: var(--bad);"><code>{loseRel}</code></td></tr>
        </table>

        <h4>3. ICM エクイティ ($ 単位・厳密計算)</h4>
        <ul>
          <li>フォールド時: <code>{eqFold}</code></li>
          <li>push → villain fold (スチール成功): <code>{eqSteal}</code></li>
          <li>push → call → 勝った時: <code>{eqWin}</code></li>
          <li>push → call → 負けた時: <code>{eqLose}</code></li>
        </ul>

        <h4>4. villain のコール率・equity 内訳</h4>
        <ul>
          <li>villain (BB) 想定コールレンジ: <code>上位 {villainCallRangePct}%</code></li>
          <li>コール率 (コンボ重み比) pCall: <code>{pCall}%</code> <span style="color: var(--muted);">(スチール成功率 = 1 − pCall = {stealPct}%)</span></li>
          <li>{heroHand} vs コールレンジ equity: <code>{eqVsCallRange}%</code></li>
        </ul>

        <h4>5. push の $EV</h4>
        <p><code>evPush = (1−pCall)×Esteal + pCall×(eq×Ewin + (1−eq)×Elose)<br />
        = {oneMinusPCall}×{eqSteal} + {pCall3}×({eq3}×{eqWin} + {oneMinusEq}×{eqLose})<br />
        = {evPush}</code></p>
        <p><code>evFold = {evFold}</code></p>

        <h4>6. 判定</h4>
        <p>
          push $EV <code>{evPush}</code>
          {verdictOp}
          fold $EV <code>{evFold}</code>
          → <strong>{verdict}</strong>
        </p>
      `,

  // ===== 規約モーダル: EN モード時のみ表示する注記 (guide.ts, Phase B) =====
  // 規約本文 (legalContent.ts) は日本語のまま。EN モードでは冒頭にこの一文を足す。
  "legal.enOnlyNote": "The terms below are currently available in Japanese only.",

  // ===== ペイウォール (freemium ゲート, paywall.ts) =====
  "paywall.title": "🔓 自分のテーブルを再現しよう",
  "paywall.lead": "Pro なら、自分の卓をそのまま再現して分析できます。",
  "paywall.feature.editStacks": "5人以上のフルテーブルを自由に再現 (スタック・ペイ構造)",
  "paywall.feature.replay": "実戦のハンドを再現して分析",
  "paywall.feature.save": "シナリオを保存していつでも呼び出し",
  "paywall.price": "価格: {price}",
  "paywall.cta.upgrade": "Pro にアップグレード",
  "paywall.cta.restore": "購入を復元",
  "paywall.web.note": "この機能はアプリ版でご利用いただけます。",
  "paywall.close.aria": "閉じる",
  "paywall.comingSoon": "準備中です",
  "paywall.lock.title": "Pro 機能です",
  "paywall.purchase.success": "Pro にアップグレードしました",
  "paywall.restore.success": "購入を復元しました",
  "paywall.restore.notFound": "復元できる購入が見つかりませんでした",
  "paywall.error": "処理に失敗しました。時間をおいて再度お試しください",
};
