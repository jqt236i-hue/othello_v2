# 盤理の観測者チュートリアル 実装計画・設計書

作成日: 2026-03-10  
対象: UI / game 公開入口 / docs / worker-public  
状態: 設計・実装計画書（未実装）

## 0. この文書の位置づけ

- この文書は、盤理の観測者チュートリアルを既存対戦システムへ混ぜ込まず、UI 層の独立機能として復元するための設計書です。
- ルールと挙動の一次情報は引き続き 01-rulebook.md です。
- この文書の内容のうち、まだコードに入っていないものは「実装予定」です。
- 実装で見え方や操作が確定的に変わる段階に入ったら、コード変更前に 01-rulebook.md のチュートリアル節を更新します。

---

## 1. 目的

### 1.1 追加したい体験

- タイトル画面ではなく、通常ゲーム画面から tutorial ボタンで開始できる。
- 盤理の観測者が会話を進行する、恋愛ゲーム風の会話演出を持つ。
- セリフは一文字ずつ表示し、クリックでその行だけ即時表示、さらに次クリックで次へ進む。
- 冒頭で はい / いいえ を選べる。
- いいえ を選んだ場合は、盤理の観測者との通常 CPU 対局へ入る。
- はい を選んだ場合は、指定済みの STEP 001 から STEP 038 までを順番通りに再生する。
- 観測者の立ち絵は通常時は画面中央に大きく表示し、盤面操作が必要な手順だけ上部退避表示へ切り替える。

### 1.2 到達点

- game は tutorial の DOM や演出状態を知らない。
- tutorial は UI の独立コントローラとして存在し、公開状態と公開イベントだけで進行する。
- セリフ本文と分岐文言は、ロジックから分離された不変データとして管理する。
- tutorial の開始、進行、終了、再開不能状態の解除までが 1 本の制御経路で完結する。

### 1.3 非目標

- 初回復元で、セリフ本文を要約し直したり言い換えたりすること
- tutorial の都合で core ルールを分岐させること
- worker-public を直接編集して本体との差分を恒久化すること
- 将来の別チュートリアルまで同時に設計すること

---

## 2. 絶対条件

### 2.1 セリフ・ストーリー不変

- ユーザーが指定したセリフとストーリーは一切改変しない。
- STEP 001 から STEP 038、冒頭の はい / いいえ 分岐、いいえ 側の観測者デュエル導線をそのまま扱う。
- 本文の編集事故を防ぐため、実装時は会話テキストを専用データファイルへ隔離し、ロジック側へ本文を直書きしない。
- この設計書には本文を再掲しない。理由は、計画書内での再記述自体が改変事故の入口になるため。

### 2.2 境界維持

- game/ は ui/ に依存しない。
- ui/ は game の公開入口だけを使う。
- cpu/ は読み取り専用で扱い、DOM/UI/音/タイマーを直接操作しない。
- チュートリアル専用分岐は UI 制御で吸収し、通常対局ロジックの分岐増殖を避ける。

### 2.3 UI/演出ルール

- UI は events[] を順番通りに再生する。
- 再生中に盤面 DOM を更新する書き手は Playback Engine に限定する。
- フリップは既存 UI 演出仕様を守る。
- 観測者レイアウトの切り替えは step ごとの表示モードで制御し、盤面 DOM 側で場当たり的に逃がさない。

---

## 3. 現状整理

### 3.1 残っているもの

- index.html には tutorial ボタンと tutorialOverlay の受け口が残っている。
- ui/handlers/init.js には setupTutorialControls 呼び出しが残っている。
- styles-layout.css と styles-responsive.css には tutorial ボタン、overlay、observer stage、dialog、choice panel のスタイルが残っている。
- worker-public 側にも同じ HTML/CSS の受け口が残っている。

### 3.2 消えているもの

- root の ui/tutorial/ は空。
- root の ui/handlers/tutorial.js が欠損している。
- worker-public/ui/tutorial/ も空。
- そのため、現在は HTML/CSS の受け口だけが残り、チュートリアル本体 JS が存在しない状態である。

### 3.3 この状態から言えること

- 今回の復元対象は UI shell の新設ではなく、tutorial JS モジュール群の再建である。
- index.html はすでに tutorial スクリプト群を読み込む構造なので、canonical source を root 側へ戻すのが自然である。
- 既存 CSS は「上部表示」を前提にしているため、「中央大表示」と「上部退避表示」の 2 状態を追加設計する必要がある。

---

## 4. 結論と推奨方針

### 4.1 結論

- tutorial は root の ui/tutorial/ を正本として再実装する。
- セリフ本文は tutorial-script.js のような専用データへ隔離し、進行制御は tutorial-controller.js へ集約する。
- 観測者表示は step ごとの observerLayout で切り替える。
- 盤面待ち手順は action-wait モジュールに集約し、クリック制御やハイライト解除漏れを controller から分離する。
- いいえ 分岐の観測者デュエルは scenario モジュールで分離し、通常ゲームロジックの特例化を最小にする。

### 4.2 canonical source 方針

- 正本: ui/tutorial/*.js, ui/handlers/tutorial.js
- ミラー: worker-public/ui/tutorial/*.js, worker-public/ui/handlers/tutorial.js
- styles と HTML は既存受け口を活かす。
- worker-public は同期結果のみを持つ。直接編集前提にはしない。

### 4.3 復元の考え方

- まず本文保全と進行データを固定する。
- 次に overlay と typewriter を戻す。
- その上で action-wait、observer layout 切替、observer duel を積み上げる。
- 最後に root と worker-public の同期、回帰確認を行う。

---

## 5. モジュール設計

### 5.1 新設または復元するモジュール

- ui/tutorial/tutorial-script.js
  - セリフ本文、話者名、選択肢文言だけを持つ不変データ層
  - ロジック条件を書かない

- ui/tutorial/tutorial-steps.js
  - step 順序、chapter、observerLayout、待機条件、分岐先、セットアップキーを持つ
  - tutorial-script.js の lineId を参照する

- ui/tutorial/tutorial-state.js
  - active、route、stepIndex、typingState、observerDuelState、flags、cleanup ハンドルを保持する

- ui/tutorial/tutorial-storage.js
  - intro 既読や clear 状態の localStorage 管理

- ui/tutorial/typewriter.js
  - 一文字送り、句読点ウェイト、skip、cancel を担当

- ui/tutorial/tutorial-overlay.js
  - observer stage、head bubble、dialog window、choice panel の描画だけを担当
  - observerLayout に応じて center / top を切り替える

- ui/tutorial/tutorial-action-wait.js
  - 許可対象ハイライト、他 UI 無効化、成功条件監視、解除 cleanup を担当

- ui/tutorial/tutorial-scenario-duel.js
  - いいえ 分岐の観測者戦セットアップ、結果判定、後続会話遷移を担当

- ui/tutorial/tutorial-controller.js
  - 開始、終了、step 遷移、render、action-wait 開始終了、event 監視の総合制御

- ui/handlers/tutorial.js
  - tutorial ボタンと overlay の open/close 制御、開始不可条件の判定を担当

### 5.2 依存方向

- tutorial-script.js → どこにも依存しない
- tutorial-steps.js → tutorial-script.js だけ参照する
- tutorial-overlay.js / typewriter.js / tutorial-action-wait.js / tutorial-scenario-duel.js → state と公開 UI/game 状態だけを見る
- tutorial-controller.js → 上記モジュールを束ねる
- ui/handlers/tutorial.js → tutorial-controller.js の公開入口だけを呼ぶ

### 5.3 禁止事項

- game の内部変数へ直接依存しない
- tutorial の都合で game に DOM 制御を持ち込まない
- セリフ本文を controller や handler に直書きしない

---

## 6. データ設計

### 6.1 セリフデータ

本文は lineId 基準で持つ。

```js
{
  lineId: 'step_001_line_01',
  speaker: '盤理の観測者',
  body: 'ここにユーザー指定の原文をそのまま格納する'
}
```

方針:

- body は原文をそのまま格納する
- 改行位置も原則保持する
- 選択肢ラベルも同じく原文固定にする

### 6.2 step データ

```js
{
  id: 'step_012',
  route: 'main',
  chapter: 'STEP 012',
  lineId: 'step_012_line_01',
  observerLayout: 'center',
  overlayMode: 'modal',
  setupKey: 'observer_card_demo',
  waitFor: null,
  choices: null,
  next: 'step_013'
}
```

追加フィールド:

- observerLayout: center / top
- overlayMode: modal / passthrough
- waitFor.type: selected_card / used_card / placed_stone / placed_stone_numeric / duel_finished / button_click
- waitFor.target: board.legal, hand.card:observer_01 などの記号指定
- instruction: 盤面操作が必要なときだけ表示する補足文
- onEnterSetup: 盤面、手札、チャージ、手番の staged snapshot を適用するキー
- branchKey: はい / いいえ 分岐などの分岐識別子

### 6.3 staged snapshot

チュートリアル用の盤面や手札は、controller が直接その場で組み立てるのではなく、名前付き snapshot を参照して適用する。

例:

- intro_idle
- observer_card_demo
- numeric_tile_demo
- observer_duel_intro

利点:

- 本文と盤面準備を分離できる
- freeze 調査時に「文言」ではなく「セットアップキー」で原因切り分けできる

---

## 7. UI 設計

### 7.1 観測者レイアウト

- center
  - 通常会話用
  - 画面中央に大きく表示する
  - dialog は下部中央、choice panel はその上

- top
  - 盤面操作待ち用
  - 観測者を上部中央へ退避
  - dialog は左下寄せの passthrough モードへ切り替える
  - 盤面操作を邪魔しないことを最優先にする

### 7.2 切替ルール

- 会話だけの step は center
- 石を置く、カードを選ぶ、カードを使う、マスを指定する step は top
- 切替判定は CSS の場当たり調整ではなく、step データの observerLayout で明示する

### 7.3 クリック挙動

- typing 中のクリック: その行だけ全文表示
- typing 完了後のクリック: 次 step へ進む
- choice 表示中の dialog クリック: 進めない
- action-wait 中の dialog クリック: ヒント表示のみ、進行はしない

---

## 8. 進行設計

### 8.1 ルート

- intro
  - 最初の導入と はい / いいえ

- main
  - STEP 001 から STEP 038 の本編

- observer-duel
  - いいえ 分岐で入る観測者との通常 CPU 対戦

### 8.2 共通進行ルール

- 1 step につき表示責務は 1 つにする
- choice がある step と action-wait がある step を同時に持たせない
- onEnter で snapshot 適用、onExit でハイライトや監視を必ず解除する

### 8.3 いいえ 分岐

- intro で いいえ 選択
- 観測者デュエル導入会話へ遷移
- CPU 白 Lv6 の通常対局を開始
- 対局結果を scenario モジュールが拾う
- 専用の後続会話または終了へ遷移

### 8.4 はい 分岐

- intro で はい 選択
- main ルートの STEP 001 へ入る
- step 順を飛ばさず、指定順序のまま進行する

---

## 9. 固まり対策設計

ユーザー報告の「盤理の観測者カード使用フェーズで固まる」を、実装前提のリスクとして先に吸収する。

### 9.1 原因候補

- used_card 判定が cardId 監視だけで終わり、pending 解消や playback 開始を見ていない
- action-wait 開始前後の cleanup 漏れで、対象以外が永久に disabled のまま残る
- snapshot 適用順と event 監視開始順が逆で、成功イベントを取り逃がす
- カード使用後に overlay が modal のままで、盤面入力復帰が起きない

### 9.2 対策

- success 判定を 1 条件にしない
  - lastUsedCardByPlayer
  - pendingEffectByPlayer の解消
  - turnIndex の進行
  - playback 開始
  - board 更新
  を組み合わせて成立判定する

- action-wait は毎回 cleanup 関数を返す
- controller は step 遷移ごとに前 step の cleanup を必ず実行する
- action-wait には watchdog を持たせ、一定時間進展がない場合はログ付きで解除と再評価を行う
- closeTutorial 時はハイライト、disabled、event listener、typing timer を全解除する

### 9.3 受け入れ条件

- 観測者カード使用 step で使用後に進行が止まらない
- overlay を閉じても通常ゲーム UI が操作不能にならない
- 再開や再起動後に tutorial-disabled-target が残留しない

---

## 10. 観測者デュエル設計

### 10.1 位置づけ

- いいえ 分岐の専用シナリオであり、main 本編とは独立した route とする
- 対局自体は通常 CPU 対局を使い、tutorial は開始条件と結果表示だけを上乗せする

### 10.2 固定条件

- 相手は盤理の観測者
- CPU レベルは 6
- 通常ゲームロジックを使う
- 結果表示だけ tutorial 用の専用文脈を持てるようにする

### 10.3 分離方針

- duel 開始条件の注入は scenario モジュールで行う
- result overlay 側は observer duel 文脈がある時だけ差し替える
- 通常対戦の result 処理を tutorial 専用分岐だらけにしない

---

## 11. ファイル配置方針

### 11.1 正本

- ui/tutorial/tutorial-script.js
- ui/tutorial/tutorial-steps.js
- ui/tutorial/tutorial-state.js
- ui/tutorial/tutorial-storage.js
- ui/tutorial/typewriter.js
- ui/tutorial/tutorial-overlay.js
- ui/tutorial/tutorial-action-wait.js
- ui/tutorial/tutorial-scenario-duel.js
- ui/tutorial/tutorial-controller.js
- ui/handlers/tutorial.js

### 11.2 既存利用

- index.html の tutorialBtn / tutorialOverlay を再利用
- styles-layout.css の tutorial 関連スタイルをベースに利用
- styles-responsive.css の tutorial 関連スタイルをベースに利用
- ui/handlers/init.js の setupTutorialControls 呼び出しを利用

### 11.3 worker-public

- root 正本の復元後に同期する
- 同期確認をフェーズ終盤の完了条件へ含める

---

## 12. フェーズチェックリスト

### 12.1 Phase 0: 台本固定

目的:

- セリフ改変事故を防ぐため、本文と選択肢文言を不変データとして確定する

作業:

- ユーザー指定の全文を tutorial-script.js へそのまま転記する
- lineId 命名規則を決める
- step 数、章順、分岐点を一覧化する

完了条件:

- セリフ本文がロジックファイルへ 1 行も直書きされていない
- STEP 001 から STEP 038、はじめの分岐、いいえ ルートが一覧で確認できる

チェックリスト:

- セリフ原文をそのまま格納した
- 選択肢ラベルをそのまま格納した
- lineId と stepId の対応表を作った

### 12.2 Phase 1: tutorial shell 復元

目的:

- tutorial ボタンから controller を起動できる土台を戻す

作業:

- tutorial-state.js, tutorial-storage.js, tutorial-controller.js, ui/handlers/tutorial.js を復元する
- open / close / start block 条件を定義する

完了条件:

- tutorial ボタンで overlay が開閉し、通常 UI に副作用を残さない

チェックリスト:

- tutorial ボタンから起動できる
- close で aria 状態が戻る
- 他 overlay 開放中の start block がある

### 12.3 Phase 2: 会話表示復元

目的:

- typewriter と dialog 表示を復元する

作業:

- typewriter.js を復元する
- tutorial-overlay.js で dialog、speaker、chapter、head bubble を描画する
- typing 中 skip と typing 完了後 advance を分ける

完了条件:

- 会話だけの step が正しい順で再生される

チェックリスト:

- 一文字送りが動く
- クリック skip が動く
- 次クリックで advance する
- choice 中は誤 advance しない

### 12.4 Phase 3: 観測者レイアウト切替

目的:

- 中央大表示と上部退避表示を step 単位で切り替える

作業:

- observerLayout=center/top を overlay が解釈できるようにする
- center 用スタイルを追加し、top は既存スタイルを基準に調整する
- passthrough dialog の位置を盤面非干渉で固定する

完了条件:

- 盤面操作が不要な step は中央大表示になる
- 盤面操作が必要な step は上部退避表示になる

チェックリスト:

- 中央表示で会話を邪魔しない
- 上部退避で盤面を邪魔しない
- モバイル系プロファイルでも位置が破綻しない

### 12.5 Phase 4: action-wait 復元

目的:

- 指定したカード選択、カード使用、着手待ちを安全に進行させる

作業:

- tutorial-action-wait.js を復元する
- target 記号を DOM と公開状態へ解決する
- success 条件を複合判定にする
- cleanup を controller に統合する

完了条件:

- 指定操作だけが受理され、成功後に確実に次へ進む

チェックリスト:

- highlight が対象にだけ付く
- 非対象が disabled になる
- 成功後に disabled が解除される
- 観測者カード使用 step が固まらない

### 12.6 Phase 5: 本編 step 復元

目的:

- STEP 001 から STEP 038 を順序どおり再生できるようにする

作業:

- tutorial-steps.js を route 単位で復元する
- step ごとの snapshot と instruction を結ぶ
- 分岐後の合流点を明示する

完了条件:

- 本編が途中欠落なく最後まで進行する

チェックリスト:

- step 順序がずれない
- chapter 表示が合う
- 各操作 step に必要な snapshot がある
- 終了時の cleanup が入る

### 12.7 Phase 6: いいえ ルート復元

目的:

- 観測者デュエルを通常対局として復元する

作業:

- tutorial-scenario-duel.js を復元する
- CPU Lv6 固定、観測者文脈、結果遷移を実装する
- result overlay との文脈受け渡しを戻す

完了条件:

- いいえ から観測者戦へ入り、対局後に正しい遷移を行う

チェックリスト:

- いいえ で duel route に入る
- 相手が観測者 Lv6 になる
- 勝敗後の遷移が壊れない

### 12.8 Phase 7: 同期と回帰確認

目的:

- root を正本として worker-public と整合を取る

作業:

- worker-public へ同期する
- index.html / worker-public/index.html の読み込み整合を確認する
- チュートリアルの開始から終了まで通し確認する

完了条件:

- root と worker-public の tutorial 資産が一致する
- 通し確認で開始不能、進行停止、終了後の残留状態がない

チェックリスト:

- root 側で起動する
- worker-public 側で起動する
- 404 参照がない
- overlay close 後に通常対局へ戻れる

---

## 13. 検証項目

- tutorial ボタンが debug ボタンの上に出る
- tutorial ボタンから開始できる
- セリフは原文どおりである
- typing 中クリックで全文表示される
- 本文表示後クリックで次へ進む
- はい で本編へ進む
- いいえ で観測者との通常 CPU 戦へ進む
- 観測者は通常 step で中央大表示になる
- 盤面操作 step では上部退避表示になる
- 観測者カード使用 step で進行が止まらない
- close 後にボタンや盤面が操作不能のまま残らない
- root / worker-public で読み込みエラーが出ない

---

## 14. 実装順の推奨

1. tutorial-script.js を先に作る
2. tutorial-steps.js で route と step を固定する
3. shell, overlay, typewriter を戻す
4. observerLayout=center/top を入れる
5. action-wait を戻して freeze 対策を先に入れる
6. 本編 step を接続する
7. 観測者デュエルを戻す
8. worker-public 同期と回帰確認を行う

---

## 15. 01-rulebook.md の扱い

- 今回は設計書追加だけなので、01-rulebook.md はまだ更新しない。
- 理由は、現時点では実装が存在せず、最終的な UI 挙動とチュートリアル節の確定がまだ終わっていないため。
- 実装着手時には、tutorial の開始条件、分岐、中央表示/上部退避表示、skip 操作、いいえ ルートの観測者戦を 01-rulebook.md へ先に反映する。

---

## 16. この計画書で先に固定したこと

- セリフ本文は一切改変しない
- tutorial は UI 独立モジュールとして復元する
- 正本は root 側に置く
- 観測者表示は center / top の 2 状態で管理する
- action-wait は専用モジュールで cleanup 付きにする
- いいえ 分岐は観測者との通常 CPU 戦として分離する
- 盤理の観測者カード使用フェーズの停止不具合は、成功条件の複合判定で先に対策する
