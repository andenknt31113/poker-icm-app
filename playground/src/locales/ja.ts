// ===== 日本語辞書 (Phase A) =====
// フラットな "a.b.c" キーの Record。値は表示文言そのもの (句読点・空白・絵文字を
// 含めて一字一句そのまま)。{n} 形式のプレースホルダは t() の第2引数で補間する。
// legalContent.ts (規約) は対象外 (Phase B で判断)。

export const ja: Record<string, string> = {
  // ===== index.html: ヘッダー =====
  "header.help.title": "使い方ガイド",
  "header.help.aria": "ヘルプ",
  "header.share.title": "シナリオを URL で共有",
  "header.share.aria": "共有",
  "header.theme.title": "テーマ切替",
  "header.theme.aria": "テーマ切替",
  "header.lang.title": "言語切替",
  "header.lang.aria": "言語切替",
  "header.infoModal.close.aria": "閉じる",

  // ===== index.html: タブ =====
  "tabs.aria": "セクション",
  "tabs.setup": "セットアップ",
  "tabs.result": "計算結果",
  "tabs.hand": "ハンド比較",
  "tabs.nash": "ナッシュ均衡",
  "tabs.practice": "練習",

  // ===== index.html: セットアップ - シナリオプリセット =====
  "setup.presets.h2": "シナリオプリセット",
  "setup.presets.summary": "プリセット一覧（タップで開閉）",
  "setup.presets.hint": "タップで状況一発セット。スタック・ポジション・ペイアウトを丸ごと反映。",
  "setup.presets.ft9": "9-max FT 開幕",
  "setup.presets.ftBubble": "FT バブル (短/普通×3)",
  "setup.presets.ft6": "6 残り",
  "setup.presets.ft4": "4 残り",
  "setup.presets.ft3": "3-handed",
  "setup.presets.hu": "HU 10/10",
  "setup.presets.huShort": "HU 短/長",
  "setup.presets.satellite3": "🛰 サテライト (3人入賞)",
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
  "setup.share.copiedHint": "✓ URL をクリップボードにコピー！",
  "setup.share.copiedToast": "✓ URL をクリップボードにコピーしました",
  "setup.share.failHint": "⚠ 自動コピーに失敗しました。下の欄を長押ししてコピーしてください",
  "setup.share.failToastMsg": "⚠ 自動コピーに失敗しました。長押しでコピーしてください",
  "setup.prompt.scenarioName": "シナリオ名を入力",
  "setup.confirm.deleteScenario": "このシナリオを削除しますか？",
  "setup.prompt.savePayout": "名前を付けて保存（例: JOPT / APT / マイHU）",

  // ===== index.html: セットアップ - プレイヤー =====
  "setup.players.h2": "プレイヤー",
  "setup.players.hint.html": "\n          各プレイヤーのスタックを入力。<strong>🎯 自分</strong> /\n          <strong>⚔️ 相手</strong> をタップで指定。最大9人。\n        ",
  // add-player ボタンのテキストは renderPlayers() (setup.ts) が制御するため JS 側で t() する
  "setup.players.add": "+ プレイヤー追加",
  "setup.players.addMax": "(最大 {n} 人)",
  "setup.players.randomize.title": "現プレイヤーのスタックを 3-30 BB のランダム値に",
  "setup.players.randomize": "\n            🎲 スタックをランダム化\n          ",

  // ===== index.html: セットアップ - ペイ構造 =====
  "setup.payouts.h2": "ペイ構造",
  "setup.payouts.hint": "1位から順に賞金を入力。単位は % でも $ でも OK。",
  "setup.payouts.add": "\n          + 順位追加\n        ",
  "setup.payouts.summary": "プリセット・保存済み（タップで開閉）",
  "setup.payouts.presetLabel": "プリセット",
  "setup.payouts.preset.top3": "Top3 (50/30/20)",
  "setup.payouts.preset.top2": "Top2 (65/35)",
  "setup.payouts.preset.wta": "WTA",
  "setup.payouts.preset.ft9": "9-max FT",
  "setup.payouts.preset.satellite": "🛰 サテライト Top3",
  "setup.payouts.savedLabel": "\n              保存済み\n              ",
  "setup.payouts.saveBtn": "\n                ＋ 現在の値を保存\n              ",

  // ===== index.html: セットアップ - URL共有 =====
  "setup.share.btn": "🔗 シナリオを URL で共有",

  // ===== index.html: 計算結果 - ICM エクイティ =====
  "result.icm.h2": "ICM エクイティ",
  "result.icm.th.rank": "#",
  "result.icm.th.stack": "スタック",
  "result.icm.th.equity": "$ エクイティ",
  "result.icm.th.pct": "%",

  // ===== index.html: 計算結果 - BF マップ =====
  "result.bf.h2": "BF マップ",
  "result.bf.hint.html": "\n          🎯自分と⚔️相手のオールイン想定。リスクするチップは小さい方のスタックに自動調整されます。\n        ",
  "result.bf.matrixTitle": "全員 vs 全員 BF マップ 🆕",
  "result.bf.matrixHint.html": "\n          縦軸 = Hero（自分）、横軸 = Villain（相手）。\n          上段=1:1ポット時のRisk Premium、下段=BF値。\n        ",
  "result.bf.howto.summary": "📖 表の見方（クリックで展開）",
  "result.bf.scrollHint": "→ 横にスクロール",

  // ===== index.html: 計算結果 - 必要勝率 =====
  "result.eq.h2": "必要勝率 (cEV / $EV / RP)",
  "result.eq.hint.html": "\n          🎯と⚔️のオールイン想定で自動計算。手動入力したい場合は数値を上書きしてください。\n        ",
  "result.eq.callLabel": "\n            コール額\n            ",
  "result.eq.call.placeholder": "例: 8.0",
  "result.eq.potwinLabel": "\n            勝った時の純利得\n            ",
  "result.eq.potwin.placeholder": "例: 10.5",
  "result.eq.autofillBtn": "\n          🔄 自動算出に戻す\n        ",
  "result.hv.h3": "🃏 このハンド、コールできる？",
  "result.hv.hint.html": "\n            上の必要勝率を「自分の持っているハンド」に当てはめる機能です。\n            ① 相手がオールインしてきそうなレンジの広さを選ぶ →\n            ② 🟩緑 = コールできるハンド → ③ 自分のハンドをタップで個別判定。\n          ",
  "result.hv.emptyMsg": "プレイヤーで 🎯自分 と ⚔️相手 を指定してください",
  "result.hv.range.tight": "タイト Top15%",
  "result.hv.range.normal": "普通 Top30%",
  "result.hv.range.loose": "ルース Top50%",
  "result.hv.sourceNote": "必要勝率 = 上の $EV (True Req)",

  // ===== index.html: ナッシュ均衡 =====
  "nash.h2": "Nash 均衡 (HU push/fold)",
  "nash.hint.html": "\n          🎯自分 (pusher) と ⚔️相手 (caller) のヘッズアップ Nash 均衡を計算（ICM反映済み）。\n          <br />\n          ※ HU 2-way 想定。BTN+BB のように間に他プレイヤーがいる場合は警告が出ます。\n          <br />\n          上の「1. プレイヤー」で 🎯/⚔️ を指定してから Nash 計算を押してください。\n        ",
  "nash.ante.label": "\n            アンティ合計\n            ",
  "nash.solveBtn": "Nash 計算",
  "nash.sbRange.h3": "🎯自分 push レンジ 🔴",
  "nash.bbRange.h3": "⚔️相手 call レンジ 🟢",

  // ===== index.html: ハンド比較 =====
  "hand.h2": "ハンドレンジ比較",
  "hand.hint.html": "\n          HU all-in 想定。<strong>hero=BB</strong>（最終 actor）のときに完全に有効。\n          他ポジションは「後ろのプレイヤーが全員 fold した」想定の概算として参考程度に。\n        ",
  "hand.direction.callBack": "\n            自分の call レンジを求める\n          ",
  "hand.direction.pushBack": "\n            自分の push レンジを求める\n          ",
  "hand.mode.preset": "\n            プリセット (Top X%)\n          ",
  "hand.mode.custom": "\n            カスタム編集\n          ",
  "hand.preset.hint": "※ Top X% は本ツール定義の強度順。他ツールとは一致しない場合があります。",
  "hand.custom.actions.all": "全選択",
  "hand.custom.actions.clear": "全消去",
  "hand.custom.actions.fromPreset": "\n              プリセットから読み込む\n            ",
  // ハンド比較のグリッド見出し・統計・バナー (handRange.ts)
  "hand.title.villainPush": "相手のpushレンジ 🔴",
  "hand.title.heroCall": "自分のcallレンジ 🟢",
  "hand.label.villainPush": "相手のpushレンジ",
  "hand.title.villainCall": "相手のcallレンジ 🟢",
  "hand.title.heroPush": "自分のpushレンジ 🔴",
  "hand.label.villainCall": "相手のcallレンジ",
  "hand.callStats.callBack": "必要勝率 <strong>{req}%</strong> 以上のハンド: <strong>{callable}</strong>個 (Top {callPct}%) ／ ボーダーライン: {marginal}個",
  "hand.callStats.pushBack": "相手が call <strong>{villainPct}%</strong> してくる前提で、自分が push +EV のハンド: <strong>{n}</strong>個 ({pPct}%) ／ ボーダー: {marginal}個。<br />相手が call ワイドだと push を狭めるべき方向に動きます。",
  "hand.banner.callerLabel.hero": "hero (自分)",
  "hand.banner.callerLabel.villain": "villain (相手)",
  "hand.banner.noBehind.html": "\n      ℹ️ {label}=<strong>{pos}</strong>。後ろにプレイヤーがいないので\n      HU all-in モデルは厳密に有効です。\n    ",
  "hand.banner.behind.html": "\n      ⚠ {label}=<strong>{pos}</strong>。このセクションは\n      <strong>caller=BB (最終 actor)</strong> 想定の HU all-in モデルです。\n      {label} の後ろに残ってる {n} 人 ({list}) の\n      <strong>over-call リスク</strong>は反映されません。\n      {note}\n    ",
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
  "practice.tutorial.q1.lesson": "WTA では順位という概念がなく、勝率がそのまま賞金期待値に直結します。だから Risk Premium はゼロ。cEV（チップ的な必要勝率）だけで判断できる、ICM プレッシャーが存在しない最もシンプルなケースです。",
  "practice.tutorial.q2.title": "相手をカバーしている",
  "practice.tutorial.q2.narration": "相手のスタックはあなたより少ない。もし負けても、あなたはまだトーナメントに残ります。",
  "practice.tutorial.q2.lesson": "自分が相手をカバーしている（負けても飛ばない）ときは、Risk Premium は小さめ。cEV に近い感覚でコールして大丈夫です。ICM プレッシャーは『自分が飛ぶリスク』があるときに強く働きます。",
  "practice.tutorial.q3.title": "バブルの罠",
  "practice.tutorial.q3.narration": "あなたは4人残りの3番手。チップリーダーがオールイン。ハンドは悪くない…がこれはワナかもしれない。",
  "practice.tutorial.q3.lesson": "チップの上ではコールが得（cEV的には+EV）でも、厳密な ICM で計算すると必要勝率が跳ね上がり、フォールドが正解になることがあります。これが『ICM プレッシャー』の正体。飛べば賞金の可能性が消える一方、生き残れば上位の賞金が保証されるため、コールのリスクは額面以上に重いのです。",
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
        本ツールはこの <strong>ICM プレッシャー</strong>を、数字で『計算』しながら
        クイズで『練習』もできる無料アプリです。
      </p>
      <ul class="onboarding-tab-list">
        <li><span class="onboarding-tab-icon">⚙️</span> 状況入力（スタック・ペイアウトなど）</li>
        <li><span class="onboarding-tab-icon">📊</span> 計算結果（ICM・BF・必要勝率）</li>
        <li><span class="onboarding-tab-icon">🃏</span> レンジ比較</li>
        <li><span class="onboarding-tab-icon">🎯</span> Nash 均衡（push/fold の最適解）</li>
        <li><span class="onboarding-tab-icon">🎲</span> 練習（クイズで実戦感覚）</li>
      </ul>
    `,
  "onboarding.step2.title": "⚡ まず触ってみる",
  "onboarding.step2.body": `
      <p>おすすめの入り口は2つあります。</p>
      <ol>
        <li>
          <strong>⚙️ セットアップ</strong>で<strong>シナリオプリセット</strong>をタップ →
          <strong>📊 計算結果</strong>で ICM / BF をすぐ確認する
        </li>
        <li>
          <strong>🎲 練習</strong>タブでクイズに答えながら感覚を掴む
        </li>
      </ol>
      <p class="hint">どちらから始めても OK。行き来しながら覚えられます。</p>
    `,
  "onboarding.step3.title": "📖 困ったら",
  "onboarding.step3.body": `
      <p>
        ヘッダー右上の <strong>❓</strong> ボタンから、いつでもこの使い方ガイドと
        ICM / Bubble Factor などの用語解説を開けます。
      </p>
      <p class="hint">さっそく始めましょう。</p>
    `,
  "onboarding.skip": "スキップ",
  "onboarding.next": "次へ →",
  "onboarding.cta.practice": "🎲 練習を始める",
  "onboarding.cta.setup": "⚙️ 自分で設定する",

  // ===== 使い方ガイド (guide.ts) =====
  "guide.title": "📖 使い方ガイド",
  "guide.close.aria": "閉じる",
  "guide.reopenBtn": "🔄 もう一度はじめのガイドを見る",
  "guide.legalLink": "📄 利用規約・プライバシーポリシー",
  "guide.body.html": `
        <p class="guide-intro">
          このツールはショートスタック（〜20bb）のオールイン局面に特化しています。
        </p>
        <details class="howto">
          <summary>⚙️ セットアップ — できること・使い方</summary>
          <div class="howto-body">
            <p>プレイヤーのスタック、ペイ構造、🎯自分/⚔️相手を設定してシナリオを作る画面。</p>
            <ol>
              <li>「シナリオプリセット」をタップして状況を一発セット</li>
              <li>「プレイヤー」でスタックを調整（足りなければ + プレイヤー追加）</li>
              <li>🎯自分 / ⚔️相手 をタップで指定</li>
              <li>🔗 で今のシナリオを URL 共有</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>📊 計算結果 — できること・使い方</summary>
          <div class="howto-body">
            <p>ICM エクイティ、Bubble Factor、必要勝率 (cEV / $EV / RP) を自動計算する画面。</p>
            <ol>
              <li>⚙️で状況を入力（プリセットでも OK）</li>
              <li>「ICM エクイティ」表で各プレイヤーの $ 価値を確認</li>
              <li>「全員 vs 全員 BF マップ」で 🎯 vs ⚔️ のセルを確認</li>
              <li>コール額/純利得は🎯⚔️から自動算出（手動編集した後は「🔄 自動算出に戻す」で戻せる）</li>
              <li>「🃏 ハンド別判定」で相手レンジを選び、自分のハンドをタップして個別に call/fold を確認</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🃏 ハンド比較 — できること・使い方</summary>
          <div class="howto-body">
            <p>相手の push/call レンジと自分のレンジを Top X% やカスタム編集で比較する画面。</p>
            <ol>
              <li>「自分の call を逆算」か「自分の push を逆算」を選ぶ</li>
              <li>プリセットならスライダーで Top X% を調整、カスタムならグリッドのセルをタップして選択</li>
              <li>グリッドの色分けで自分がコール/プッシュすべきハンドを確認</li>
            </ol>
          </div>
        </details>
        <details class="howto">
          <summary>🎯 ナッシュ均衡 — できること・使い方</summary>
          <div class="howto-body">
            <p>HU push/fold の Nash 均衡（ICM 反映済み）を計算する画面。</p>
            <ol>
              <li>⚙️で 🎯自分 (pusher) と ⚔️相手 (caller) を指定</li>
              <li>SB / BB / アンティ合計を設定</li>
              <li>「Nash 計算」を押す</li>
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
        <details class="howto">
          <summary>📚 用語ミニ解説</summary>
          <div class="howto-body">
            <h4>ICM (Independent Chip Model)</h4>
            <p>
              トナメのチップは賞金と1:1では換算できません（<strong>チップ ≠ 賞金価値</strong>）。
              ICM はチップ構成を「今すぐ$に換金したらいくら？」に変換する定義です。
              例: ICM% が 25% なら、平均して総賞金の 1/4 を持っていける期待値ということ。
            </p>
            <h4>Bubble Factor (BF)</h4>
            <p>
              <strong>負けた時の痛み ÷ 勝った時の嬉しさ</strong>を表す係数。
              BF = 1.3 なら、cEV（チップ基準）より <strong>30% 余分にタイト</strong>に打つべきという意味です。
            </p>
            <h4>Risk Premium (RP)</h4>
            <p>
              cEV（チップだけで見た必要勝率）より<strong>何%余分に勝率が必要か</strong>を表す差分。
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
          <summary>❓ 「Top X%」とは</summary>
          <div class="howto-body">
            <p>
              「Top X%」は本ツール独自のハンド強度ランキングに基づく上位 X% の簡易レンジです。
              Sklansky-Chubukov など他ツールのランキングとは前提（サンプル数・想定シナリオなど）が異なるため、
              <strong>同じ X% でも具体的なハンドの構成や数字が一致しない場合があります</strong>。
              あくまで傾向を掴むための目安としてご利用ください。
            </p>
          </div>
        </details>
        <button type="button" class="solve-btn guide-reopen-btn" id="guide-reopen-onboarding-btn">🔄 もう一度はじめのガイドを見る</button>
        <button type="button" class="guide-legal-link" id="guide-legal-link">📄 利用規約・プライバシーポリシー</button>
      `,

  // ===== 初回ヒントバー (guide.ts) =====
  "firstHint.html": "👋 はじめてなら: <strong>プリセット</strong>をタップ → <strong>📊</strong>で結果を見る、か <strong>🎲</strong>で練習",
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
  "practice.bento.tournamentState": "TOURNAMENT STATE",
  "practice.bento.blinds": "Blinds",
  "practice.bento.heroStack": "HERO STACK",
  "practice.bento.ante": "アンティ合計",
  "practice.bento.pay": "ペイ",
  "practice.topxNote": "※ Top X% は本ツール定義の強度順。他ツールとは一致しない場合があります。",
  "practice.villainWarn.head": "⚠️ Villain ({pos}) All-in",
  "practice.villainWarn.estPush": "Est. Push Range",
  "practice.villainCall.head": "⚔️ Villain (BB) の想定コールレンジ",
  "practice.villainCall.estCall": "Est. Call Range",
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
  "practice.lesson.satellite": "🛰 サテライトでは『残ること』が全て。どんな強いハンドでも RP が極端に上がり、ほぼ全てのコールが正当化されません。",
  "practice.lesson.covered": "⚠️ カバーされている相手へのコールは、負け＝敗退。トーナメント生命を賭けるため Risk Premium が跳ね上がります。",
  "practice.lesson.covering": "自分が相手をカバーしている時は、負けても飛ばないため RP は小さめ。cEV に近い感覚でコールできます。",
  "practice.lesson.shorter": "自分より短いスタックが残っている間は、無理に勝負しなくても順位が上がる可能性があります。それが RP の源泉です。",
  "practice.lesson.general": "必要勝率 = cEV + Risk Premium。ICM 下では『チップで得』でも『賞金で損』になり得ることを常に確認しましょう。",
  "practice.pushLesson.wta": "🏆 WTA (勝者総取り) では ICM 圧はゼロ。push もチップ EV (cEV) どおりに判断できます。",
  "practice.pushLesson.satellite": "🛰 サテライトでは『残ること』が全て。push 側も極端にタイトになり、スチールが見込めても大半のハンドは fold が正解になります。",
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
  "practice.cf.cevLabel": "cEV 必要勝率:",
  "practice.cf.reqLabel": "必要勝率 (厳密 ICM):",
  "practice.cf.reqApproxNote": "(参考: BF近似 {v}%)",
  "practice.cf.handEquity": "{hand} の equity vs Top{pct}%:",
  "practice.cf.heroRangeH3": "🎯 自分の call レンジ 🟢 (必要勝率 {pct}% 超のハンド)",
  "practice.cf.legend.call": "call (余裕 +0% 以上 = +EV)",
  "practice.cf.legend.fold": "fold (余裕 マイナス = -EV)",

  // ===== 練習: push 判定フィードバック (judge.ts judgePracticePush) =====
  "practice.push.evNote": "(villain call率 {pcall}% / call された時の hero equity {eq}%)",
  "practice.push.marginPoolNote": "(プール比 {v}%)",
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
  "calc.bf.label.bf": "🎯 vs ⚔️ の BF",
  "calc.bf.label.risk": "リスクチップ",
  "calc.autofill.summaryLine": "✓ 追加 call <strong>{call}</strong> / 純利得 <strong>{pot}</strong> BB",
  "calc.autofill.detailsSummary": "▸ 計算の内訳",
  "calc.autofill.err.needHV": "⚠ 🎯自分と⚔️相手を1人ずつ指定してください",
  "calc.autofill.err.zeroStack": "⚠ スタックが0です",
  "calc.autofill.modeTotal": "合計",
  "calc.autofill.modePerPlayer": "1人{ante}×{n}人",
  "calc.autofill.result": "✓ コール <strong>{risk}</strong>, 純利得 <strong>{pot}</strong> = リスク {risk2} + 死に金 {dead} (SB {sb} + BB {bb} + アンティ {ante} [{mode}])",
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
  "calc.summary.title": "状況サマリー (タップ＝用語解説)",
  "calc.summary.sample": "サンプル",
  "calc.summary.expand": "展開",
  "calc.summary.collapse": "折りたたみ",
  "calc.summary.collapseToggle": "折りたたみ切替",
  "calc.summary.hero": "🎯 自分",
  "calc.summary.villain": "⚔️ 相手",
  "calc.summary.villainUnset": "⚔️ 相手未指定",
  "calc.summary.aroundHtml": "<span>👥 周り <strong>{stacks}</strong> BB</span>",
  "calc.summary.bfLabel": "BF ⓘ",
  "calc.summary.reqLabel": "必要勝率 ⓘ",
  "calc.summary.rpLabel": "RP ⓘ",

  // ===== 警告 (calculator.ts) =====
  "calc.warn.position.html": "\n      ⚠ <strong>ポジション逆転</strong>: 行動順は <code>{heroPos}({heroAct}) → {villainPos}({villainAct})</code>。\n      実戦では <strong>hero ({heroPos}) が先に行動</strong>するため、villain ({villainPos}) の open push に対して call することはあり得ません。\n      (call 計算は math 上は動きますが、ポジを入れ替える方が現実的)\n    ",
  "calc.warn.depth.html": "\n    ⚠️ 実効 {eff}bb: この深さでは push/fold 以外の選択肢\n    (小さいオープンやコール) が現実的です。本ツールの計算はオールイン前提です。\n  ",

  // ===== ハンド別判定 (calculator.ts renderHandVerdict) =====
  "calc.hv.count": "169中 {n} ハンド ({pct}%)",
  "calc.hv.verdict.call": "✅ コール ({margin}%)",
  "calc.hv.verdict.fold": "❌ フォールド ({margin}%)",
  "calc.hv.banner": "<strong>{hand}</strong>: equity {eq}% {op} 必要 {req}% → {verdict}",

  // ===== 用語解説モーダル (calculator.ts INFO_TEXTS) =====
  "info.icm.title": "ICM (Independent Chip Model)",
  "info.icm.body": `
      <p>トナメの<strong>チップを「今すぐ$に換金したらいくら？」</strong>に変換する計算式。</p>
      <p>賞金は順位ごとに固定なので、チップ 2倍 ≠ 賞金 2倍。<br />
      バストすると最低順位の賞金しか貰えない非対称性を反映する。</p>
      <p>ICM% は <code>その人の $EV ÷ 総賞金</code>。例: 25% = 平均すると総賞金の 1/4 を持っていける期待値。</p>
    `,
  "info.bf.title": "BF (Bubble Factor)",
  "info.bf.body": `
      <p><strong>「チップの痛さ ÷ チップの嬉しさ」</strong>を表す係数。HU all-in 想定。</p>
      <ul>
        <li><strong>1.00</strong>: チップ ⇄ $ がリニア (ICM 圧ゼロ)</li>
        <li><strong>1.20</strong>: 「100失う痛さ = 83取る嬉しさ」→ 20%余分にタイト</li>
        <li><strong>1.50+</strong>: バブル/サテライトレベル、超タイト</li>
      </ul>
      <p>厳密な定義: <code>BF = (現在 - 負け時の $) ÷ (勝ち時 - 現在の $)</code>。
      HRC / ICMIZER と同じ計算。</p>
      <p>※ 1:1 ポットオッズ時に <code>必要勝率 = BF/(BF+1)</code>。BF=1.2 なら 54.5%、BF=1.5 なら 60%。</p>
    `,
  "info.rp.title": "Risk Premium (RP)",
  "info.rp.body": `
      <p><strong>cEV (チップ EV) と $EV (ICM EV) の差</strong>。ICM の重みでどれだけ余分に勝率が必要か。</p>
      <ul>
        <li>RP = 0%: cEV と $EV が同じ (ICM 影響なし)</li>
        <li>RP = +10%: コインフリップ (50%) でも実際は 60% 必要</li>
        <li>RP = +20%: バブル時、+30% でサテライト</li>
      </ul>
      <p>計算: <code>RP = $EV 必要勝率 − cEV 必要勝率</code></p>
      <p>1:1 オッズの場合: <code>RP = BF/(BF+1) − 50%</code></p>
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
  "nash.converged": "収束",
  "nash.notConverged": "未収束",
  "nash.statusSuffix": "（{iter} iter / {ms} ms）",
  "nash.stats": "{n} 個 ({pct}%)",
  "nash.matrixMissing": "⚠ HU equity matrix が未生成です（hu-equity-matrix.json）。`npx tsx scripts/build-hu-matchups.mts` を実行してください。",

  "info.req.title": "必要勝率 (Required Equity)",
  "info.req.body": `
      <p>このコールが <strong>EV 0 になる最低勝率</strong>。ハンドの実勝率がこれを超えるなら call、下なら fold。</p>
      <ul>
        <li><strong>cEV 必要勝率</strong>: ポット odds だけ (ICM 無視)</li>
        <li><strong>$EV 必要勝率</strong>: BF (ICM 圧) を反映、こっちが実戦判断用</li>
      </ul>
      <p>厳密式: <code>$EV = (call × BF) ÷ (call × BF + win)</code></p>
      <p>例: コール 8 BB / pot 20 BB / BF 1.4<br />
      → cEV = 8/(8+20) = 28.6%<br />
      → $EV = (8×1.4)/(8×1.4 + 20) = 11.2/31.2 = <strong>35.9%</strong><br />
      (1:1 オッズ時は <code>BF/(BF+1)</code>)</p>
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
        <p><code>{heroHand}</code> vs Top {villainCallRangePct}% range → <strong>{heroEq}%</strong></p>

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
          <li>villain (BB) 想定コールレンジ: <code>Top {villainCallRangePct}%</code></li>
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
  "paywall.feature.editStacks": "スタックを自由に編集",
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
