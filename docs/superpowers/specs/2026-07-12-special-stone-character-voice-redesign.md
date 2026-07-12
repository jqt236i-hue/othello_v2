# 特殊石キャラクターボイス全面改稿設計

- 作成日: 2026-07-12
- 状態: Reviewed design
- 対象: 特殊石吹き出し、ローカル・Worker・ネットワーク再生経路
- 設計の正本: 本文書
- 人格設定の参照元: `assets/特殊石のキャラ設定メモ/全特殊石・顕現石キャラクター設定.md`
- プレイヤー表示仕様の正本: `01-rulebook.md`
- 内部境界の正本: `docs/architecture-contracts.md`

## 1. 問題と目標

現在の特殊石セリフは、2026-03-26 のドラフトを元に段階導入されたもので、最新のキャラクター設定と一致しないものが残っている。特に、性別・一人称・口調・バックストーリー・未練が設定される前の汎用文、複数キャラクターで共用される復活文、最新追加石の発話不足がある。

目標は、罠・爆弾を除く全特殊石26種について、ゲーム内で実際に表示される全吹き出しセリフを最新のキャラクター設定から再執筆し、各キャラクターの発言を名前を隠して読んでも識別できる状態にすることである。

完成後は次を満たす。

- 特殊石26種の発話カタログが、各石固有の一人称・語尾・価値観・未練を持つ。
- 共通復活文など、人格を横断する汎用セリフをプレイヤーへ表示しない。
- 同一文言を複数の石・シナリオで使わない。
- 発話追加によってゲーム進行、正規状態、ネットワーク権威、再生順、Single Visual Writer を変えない。

## 2. スコープ

### 2.1 対象特殊石26種

`PROTECTED`、`PERMA_PROTECTED`、`SNIPER`、`GHOST`、`SACRIFICE`、`AFTERIMAGE_WILL`、`TIME_STOP`、`TIME_STOP_DEITY`、`REGEN`、`ZOMBIE`、`DRAGON`、`BREEDING`、`PROLIFERATION`、`HYPERACTIVE`、`EXTREME_HYPERACTIVE`、`ESCAPE_HYPERACTIVE`、`ROBOT_VACUUM`、`GLUTTONOUS`、`WILL_HUNTER_KING`、`WORK`、`STONE_SALVATION_GOD`、`DESTROY_DRAGON`、`LIGHTNING`、`ULTIMATE_DESTROY_GOD`、`ULTIMATE_HYPERACTIVE`、`METEOR_GOD`。

### 2.2 明示的な除外

- 罠: `TRAP` / `TRAP_REVEAL`
- 爆弾: `TIME_BOMB`、`CROSS_BOMB`、`X_BOMB` および爆弾カテゴリの将来追加型
- 石状態: `GUARD`、`LIVING_WILL`、`POISONED`
- 盤面マーカー: `FREEZE`、`BLOCKADE`、`SEED`、`POISON_CELL`、`METEOR_HOLE`
- 配置時効果: `GOLD`、`SILVER`、`RAINBOW` など
- 顕現石: `THEORY_INCARNATION`、`BOARD_EXECUTOR`、`OBSERVER_WILL`
- CPUキャラクターの通常コメント、対戦チャット吹き出し、結果画面セリフ

顕現石3種は現時点の全面改稿対象に含めない。既存の特殊カード暗転時固有セリフは変更・削除せず、盤上の配置・終了吹き出しも追加しない。

### 2.3 非目標

- カード効果、持続ターン、発動条件、勝敗ルールの変更
- 吹き出しのデザイン、表示時間、アニメーション方式の刷新
- 音声ファイルやボイス再生の追加
- 顕現石の既存固有セリフの変更・削除、および新規吹き出し追加
- routine な毎ターン能力発動ごとの発話追加
- キャラクター設定メモ自体の再編集

## 3. 現行構造と根拠

### 3.1 文言と抽選

- `game/turn/turn_pipeline_phase_helpers.ts` の `SPECIAL_STONE_BUBBLE_SPEECH` が特殊石吹き出し本文を保持する。
- 同ファイルの `getSpecialStoneBubbleSpeechLines(...)` と `pickSpecialStoneBubbleSpeechLine(...)` がシナリオ解決と1文抽選を行う。
- 抽選済み本文は `SPECIAL_STONE_BUBBLE` presentation event に格納される。セリフ抽選はゲーム結果を決めず、presentation metadata に限られる。

### 3.2 発火と重複抑止

- `game/turn/presentation-helpers.ts` が配置結果、marker差分、`STATUS_REMOVED`、`CHANGE`、`DESTROY`、時間停止遅延イベントなどから発話シナリオを決める。
- `buildSpecialStoneBubbleKey(...)` と tracker が同一マス・所有者・石種・シナリオの二重発話を抑止する。
- `生きる意志` 復活時は破壊・持続切れ発話を抑止し、`living_will_restored` を優先する既存契約がある。

### 3.3 playback と UI

- `game/turn/pipeline-ui/passive-event-playback.ts` が `SPECIAL_STONE_BUBBLE` を既存の `observer_bubble` playback event へ変換する。
- `ui/animation-feedback-events.ts` が対象セル近傍へ約3秒表示し、クリックを妨げずフェードアウトする。
- 添付画像の表示はこの既存経路であり、UIの作り直しは不要である。

### 3.4 顕現石の現状保持

- `shared/special-card-registry.ts` の `quote` / `quoteLines` が特殊カード暗転演出の固有セリフ正本である。
- `01-rulebook.md` と `正本/演出正本.md` に同じプレイヤー表示文言が記載されている。
- `01-rulebook.md` は顕現終了時に終了文言を表示しないと定めている。
- 今回は顕現石のセリフを対象外とするため、これらの既存文言・演出・テスト期待値は変更しない。

### 3.5 現行の不整合

- カタログは23キーで、`PROTECTED`、`TIME_STOP_DEITY`、`ZOMBIE` などに本文がない。
- `DRAGON` は共通の `living_will_restored` だけ、`REGEN` と `TIME_STOP` は専用発動時だけなど、基本シナリオが欠ける石がある。
- `GENERIC_LIVING_WILL_RESTORED_LINES` は一人称と性格を全石で共有し、最新の「被りなし」設定と両立しない。
- `WORK` は `placeLines` / `lostLine` / `incomeLinesByStep` という旧形式で、他の特殊石と発話シナリオ解決が分かれている。
- `turn_pipeline_phases.ts` と `pipeline_ui_adapter.ts` に労働石の古いフォールバック文言が複製されており、カタログだけを置換しても旧セリフが残り得る。
- `special-stone-speech-draft.md` は絶対保護石など削除済み仕様を含み、最新特殊石を網羅しない。

## 4. 検討した案

### 案A: 現行カタログの文字列だけを直接置換する

利点は差分が最小であること。欠点は発話漏れ、共通復活文、労働石の旧形式、複製フォールバック、最新石のシナリオ不足が残ること。「全てを置き換える」という要求を構造的に保証できないため不採用とする。

### 案B: Markdown設定メモを実行時に読み込む

人格と文言の単一ファイル化はできるが、ブラウザ・Worker・headless がMarkdown資産と独自パーサへ依存し、ロード失敗がゲーム内表示へ波及する。設定メモは構造化ランタイムデータではなく、仕様と実装の境界も曖昧になるため不採用とする。

### 案C: 既存イベント契約を保ち、カタログと発話ルーティングを完全化する

既存 `SPECIAL_STONE_BUBBLE` → `observer_bubble` 経路を維持し、人格設定を基に特殊石の全文を再執筆する。欠けた石・シナリオを追加し、労働石の旧形式と重複フォールバックを整理する。顕現石は変更しない。

既存の公開契約とSingle Visual Writerを保ちつつ要求を満たせるため、案Cを採用する。

### 案D: 新しい汎用会話エンジンを作る

将来の会話拡張には有利だが、今回必要なのは定型シナリオから1文を選ぶ処理であり、会話状態・好感度・文脈エンジンは不要である。過剰設計となるため不採用とする。

## 5. 選択設計

### 5.1 正本の役割

役割を次のように固定する。

| 正本 | 所有する内容 |
| --- | --- |
| `01-rulebook.md` | 誰が、いつ、どの表示方式で話すか。除外対象と優先順位を含むプレイヤー表示契約 |
| `assets/特殊石のキャラ設定メモ/全特殊石・顕現石キャラクター設定.md` | 性別、性格、年齢、口調、バックストーリー、未練という人格判断の参照元 |
| `special-stone-speech-draft.md` | 実装前に人間がレビューする特殊石セリフ台本。石種×シナリオ×候補文を列挙 |
| `game/turn/turn_pipeline_phase_helpers.ts` | 実行時に使う特殊石セリフカタログと抽選API |

`special-stone-speech-draft.md` を新しい台本で全面置換し、絶対保護石や削除済み継承多動石の記述を残さない。設定メモを実行時に読ませず、台本とランタイムカタログへ人間が確認できる形で転記する。

### 5.2 セリフ執筆規約

各文は次の制約を満たす。

- 一人称、語尾、語彙、他者への距離感は設定メモの「口調」を厳守する。
- `place` は自己紹介ではなく、盤に現れた瞬間の目的・態度を述べる。
- `destroy` は能力喪失への反応と未練を中心にする。バックストーリーを説明文として語り切らない。
- `duration_end` / `normal_revert` は敗北ではなく、役目や力が終わる反応にする。
- 専用発動シナリオは目の前で起きた効果へ即応し、過去語りを優先しない。
- `living_will_restored` は全石共通文を廃止し、それぞれの未練と再起の理由を反映する。
- 名前を隠しても石を推定できる固有語彙を最低1つ含める。
- 他の石・他シナリオと完全一致する文を作らない。
- 吹き出しは改行を含めず、`Array.from(text).length` で原則34文字以下、推奨12～26文字とする。
- 三人称ナレーション、設定項目の読み上げ、年齢や性別の自己申告は避ける。
- 罵倒・残酷表現は各人格に必要な範囲に留め、プレイヤー本人への攻撃ではなく盤上の相手・状況へ向ける。

`悪食石` の「いっぱい食べる俺が好き」は設定メモ自身に口調例として残っているため、全面改稿の唯一の明示的な再採用可能文とする。再採用する場合も他4候補は新規にする。

### 5.3 候補数

- 通常吹き出しシナリオ: 各5候補
- `living_will_restored`: 対象特殊石ごとに各5候補
- 労働石の収入: `incomeStep` 1～5ごとに固定1文。数字と生活感を両立する

候補抽選は既存PRNG経路を再利用する。本文を選んだ後のpresentation eventには確定文を格納し、クライアント側で再抽選しない。

### 5.4 シナリオ契約

標準シナリオは次の意味に固定する。

| key | 意味 |
| --- | --- |
| `place` | その個体が特殊石として盤上に成立した瞬間。カード配置、理論の化身・混沌召喚による生成、感染生成を含む |
| `destroy` | 石本体が盤から失われる、または強制効果で特殊石として失われる瞬間。復活成立時は抑止する |
| `duration_end` | 所有者ターン数などの期限満了で同色通常石へ戻る瞬間 |
| `normal_revert` | 移動候補なしや能力回数消費など、期限満了以外で石を残したまま通常石へ戻る瞬間 |
| `living_will_restored` | 生きる意志で同じ特殊石個体が復活した瞬間。`destroy` / `duration_end` / `normal_revert` より優先 |

専用シナリオは次を維持・追加する。

| key | 対象 | 発火条件 |
| --- | --- | --- |
| `proliferation_triggered` | 増殖石 | 破壊を増殖で置換できた時 |
| `time_stop_triggered` | 時間停石 | 時間停止成立時 |
| `time_stop_deity_triggered` | 時間停神 | 4連続行動を伴う時間停止成立時 |
| `regen_triggered` | 復活石 | 復活成立時 |
| `zombie_revived` | 屍石 | 屍石固有の復活成立時 |
| `zombie_infection` | 屍石 | 隣接敵通常石を新しい屍石へ変えた時。発話アンカーは感染元 |
| `card_nullified` | 犠牲石 | 相手通常カード効果を無効化した時 |
| `ghost_protected` | 幽体石 | 反転・破壊対象になったが受けなかった時 |
| `escape_exploded` | 逃亡石 | 移動先なし爆発時 |
| `special_destroy_triggered` | 意志狩りの王 | 優先対象の敵特殊石を撃破した時 |
| `work_income` | 労働石 | 所有者ターン開始時に布石を得た時。`incomeStep` も保持 |

`inherit_selected` / `inherit_applied` は現在の特殊石一覧に対応個体がなく、過去の継承多動仕様由来なので削除する。

### 5.5 石種別シナリオ行列

次表の「専用」以外に、全26種へ `place`、`destroy`、`living_will_restored` を用意する。ただし、同じ処理で専用シナリオが成立した場合は専用を優先し、二重表示しない。

| 特殊石 | `duration_end` | `normal_revert` | 専用 |
| --- | --- | --- | --- |
| 弱い石 | あり | なし | なし |
| 強い石 | なし | なし | なし |
| 狙撃石 | あり | なし | なし |
| 幽体石 | あり | なし | `ghost_protected` |
| 犠牲石 | あり | なし | `card_nullified` |
| 残像石 | なし | 能力消費で通常石化する経路がある場合に使用 | なし |
| 時間停石 | なし。期限到達は専用発動へ集約 | なし | `time_stop_triggered` |
| 時間停神 | なし。期限到達は専用発動へ集約 | なし | `time_stop_deity_triggered` |
| 復活石 | なし。復活回数消費は専用発動へ集約 | なし | `regen_triggered` |
| 屍石 | なし | 復活回数消費後も屍石は残るためなし | `zombie_infection` / `zombie_revived` |
| 究極反転龍 | あり | なし | なし |
| 繁殖石 | あり | なし | なし |
| 増殖石 | あり | なし | `proliferation_triggered` |
| 多動石 | なし | 移動候補なし | なし |
| 極悪多動魔 | なし | 移動候補なし | なし |
| 逃亡石 | なし | なし | `escape_exploded` |
| ロボット掃除機石 | あり | なし | なし |
| 悪食石 | なし | なし | 飢餓消滅は `destroy` |
| 意志狩りの王 | あり | なし | `special_destroy_triggered` |
| 労働石 | あり | なし | `work_income` |
| 救済神 | あり | なし | なし |
| 破壊龍 | あり | なし | なし |
| 落雷石 | あり | なし | なし |
| 究極破壊神 | あり | なし | なし |
| 究極多動神 | あり | 移動候補なし | なし |
| 因果抹消神石 | あり | なし | なし |

残像石の能力消費終了については、実装時に既存 `STATUS_REMOVED` のreasonが通常石化を明示している場合だけ `normal_revert` を出す。markerだけが消え、石本体も同時に破壊される経路では `destroy` を優先する。新しいゲーム状態や推測判定は追加しない。

### 5.6 発話頻度と再生時間

毎ターン発動する狙撃、落雷、龍、掃除機、救済などへ発動ごとの吹き出しは追加しない。`observer_bubble` は約3秒＋フェードを同じplayback timelineで占有するため、routine効果で毎回話すと操作待ちが累積する。

発話は登場、特殊能力の節目、復活、特殊石としての終了に限定する。同一phaseで複数個体が同時に話す場合は既存presentation順を維持し、同じ石の重複だけtrackerで抑止する。複数個体を一つの文へまとめたり、クライアントで間引いたりしない。

### 5.7 労働石の旧経路整理

労働石も人格カタログ上は標準 `place` / `destroy` / `duration_end` / `living_will_restored` を持たせる。配置・喪失・期限切れ・復活は汎用 `SPECIAL_STONE_BUBBLE` を使い、`WORK_BUBBLE` の専用本文経路は収入表示だけに限定する。

`WORK_INCOME` は `gained` / `incomeStep` を持つため既存専用マッピングを維持するが、本文は新しい `incomeLinesByStep` からのみ解決する。`turn_pipeline_phases.ts` と `pipeline_ui_adapter.ts` の古い完全一致フォールバック文は削除し、カタログが解決できない場合は古い人格で表示せず発話を省略する。通常ビルドで依存が欠けることはテストで失敗させる。

### 5.8 顕現石の非変更契約

顕現石は現時点でセリフ改稿対象外とする。次のファイルと挙動は変更しない。

- `shared/special-card-registry.ts` の `quote` / `quoteLines`
- `01-rulebook.md` の顕現石固有セリフ
- `正本/演出正本.md` の顕現石3行
- 顕現固有セリフを検証する既存テスト期待値
- 暗転固有セリフ、短期サマリー、顕現効果パネル、終了2秒演出の順序

特殊石カタログへ顕現石3種を追加せず、盤上の配置時・持続切れ・終了時吹き出しも新設しない。将来ユーザーが顕現石セリフを明示的に依頼したとき、別タスクとして設計する。

## 6. データと制御フロー

```text
人格設定メモ
  └─ 人間レビュー用台本 special-stone-speech-draft.md
       └─ 特殊石候補文 → turn_pipeline_phase_helpers.ts

game event / marker差分
  → presentation-helpers.ts が scenario を決定
  → phase helper が候補から本文を1つ確定
  → SPECIAL_STONE_BUBBLE presentation event
  → passive-event-playback.ts
  → observer_bubble playback event
  → animation-feedback-events.ts が石近傍へ表示
```

ローカル対戦では同じheadless pipelineが直接イベントを生成する。ネットワーク対戦ではWorker/local-server authorityが確定本文を含むpresentation event/playback eventを発行し、各クライアントは受信した本文をそのまま再生する。クライアントごとの再抽選は行わない。

## 7. API・状態・境界

- `SPECIAL_STONE_BUBBLE` の既存payload（`special`、`scenario`、`player`、`row`、`col`、`text`、`reason`、`cause`、`meta`）を維持する。
- `scenario` に `normal_revert`、`time_stop_deity_triggered`、`zombie_infection`、`zombie_revived`、`work_income` を追加する。
- セリフ候補、抽選結果、bubble trackerはcanonical gameplay stateへ保存しない。
- `game/` はDOM、タイマー、音、network clientへ依存しない。
- UIは受け取った本文と座標を表示するだけで、石種から本文を再解決しない。
- `markerId` による個体識別と既存presentation順を維持する。
- 新しい公開モジュールやランタイムglobalは追加しない。既存phase helper APIを継続するため、browser preload/Worker preloadの依存増加を避ける。

## 8. エラー・境界ケース

- 未知の石種または未定義シナリオ: 発話を省略し、ゲーム進行は継続する。別人格の汎用文へフォールバックしない。
- 空文字・候補0件: 構造テストで失敗させる。実行時は発話しない。
- PRNGが不正値: 既存の0～1正規化を維持する。
- 生きる意志と破壊が同時: `living_will_restored` だけを表示する。
- 復活石・屍石の固有復活: `regen_triggered` / `zombie_revived` を表示し、`destroy` を抑止する。
- 増殖成功: `proliferation_triggered` を表示し、元個体の `destroy` は表示しない。
- 時間停止発動: 専用発動文だけを表示し、同じ期限到達の `duration_end` は表示しない。
- 逃亡石爆発: `escape_exploded` を表示し、同じ個体の `destroy` を重ねない。
- 屍石感染: 感染元が話す。感染先の新規屍石 `place` は同じphaseでは表示せず、1回の感染で2個の吹き出しを出さない。
- 理論の化身・混沌召喚による特殊石生成: 生成個体の `place` を1回表示する。ルーレット演出より前へ割り込ませない。
- 同時消滅: authoritative presentation orderのまま再生する。
- 顕現石: 今回の変更対象外。既存固有セリフと文言なし終了をそのまま維持する。
- 長文: 執筆時制約とテストで抑止し、UI側の切り詰めや省略記号追加は行わない。

## 9. 互換性・生成物・移行

- スナップショット形式、marker形式、カードID、playback event typeは変更しない。
- 既存の `OBSERVER_BUBBLE` / `WORK_BUBBLE` 読み取り互換は残す。新規生成だけを整理し、過去のpresentation fixtureを壊さない。
- `turn_pipeline_phase_helpers.ts` はブラウザ表示に影響するroot sourceであるため、focused test後に `npm run build:browser` を実行する。
- Worker/local authorityも同じセリフ選択コードを使うため、`npm run worker:prepare` とネットワークparityを実行する。`worker-public/` は直接編集しない。
- `public/module-registry.js`、browser bundle、cachebuster、`worker-public/` は既存スクリプトで再生成する。

## 10. 性能・セキュリティ・並行性

- 候補配列は起動時の静的データで、盤面サイズやターン数に比例して増えない。
- routine発動ごとの吹き出しを追加しないため、通常プレイのplayback時間増加を節目イベントに限定できる。
- セリフは固定リテラルで、ユーザー入力やHTMLを含めない。UIは既存どおり `textContent` で描画する。
- ネットワークではauthorityが選択済み本文を配信するため、クライアント間で乱数結果がずれない。
- presentation eventは正規状態ではないため、セリフ変更が勝敗・合法手・CPU判断へ影響しない。

## 11. 検証戦略

### 11.1 台本・カタログ構造

- 対象26種がカタログに全て存在する。
- 除外対象はカタログから解決できない。
- シナリオ行列で必要な候補数が5件である。
- 全候補が非空、改行なし、34文字以下である。
- 全候補文がカタログ全体で一意である。
- `GENERIC_LIVING_WILL_RESTORED_LINES` と古い労働石フォールバックが残らない。
- 顕現石3種が特殊石カタログへ混入していないことを検証する。

### 11.2 headless / presentation

- 配置、破壊、期限満了、通常石化、専用発動、復活優先、重複抑止をfocused Jestで確認する。
- `TIME_STOP_DEITY` と `ZOMBIE` の既存効果テストへ吹き出し契約を追加する。
- 理論・混沌生成時の配置吹き出し順を確認する。
- 労働石収入が `incomeStep` と新本文を維持することを確認する。

### 11.3 playback / UI

- `SPECIAL_STONE_BUBBLE` が座標・所有者・本文・scenarioを保持して `observer_bubble` へ変換されることを確認する。
- 生きる意志、時間停止などと同phaseになった場合の順序を確認する。
- 添付画像相当のデスクトップ表示と、最長34文字の折り返しをブラウザで確認する。
- 狭幅では盤外へはみ出さず、クリックを妨げず、約3秒＋フェードで消えることを確認する。

### 11.4 cross-runtime

- typecheck、focused Jest、`npm run test:network:parity`、`npm run build:browser`、`npm run worker:prepare` を順に実行する。
- authorityが確定した本文を両seat・spectatorへ同じ順序で配信する既存contractを確認する。

## 12. リスクと緩和

| リスク | 緩和 |
| --- | --- |
| 台本とTSカタログがずれる | 台本完成を先行し、実装差分レビューで石種・シナリオ単位に照合。構造・候補数・一意性は自動テスト |
| 古い固定文が別ファイルに残る | 既知旧文、`placeLines` / `lostLine`、汎用復活定数をfocused `rg` で確認 |
| 発話が増えてゲームが遅くなる | routine能力では発話せず、節目イベントだけ。実機でplayback時間を確認 |
| 復活時に破壊文も出る | 既存復活優先を維持し、復活石・屍石・生きる意志を個別テスト |
| Workerとローカルで抽選が違う | authority側で本文を確定し、クライアント再抽選禁止。network parityを実行 |
| 顕現石へ意図せず変更が波及 | registry・rulebook顕現節・演出正本・関連テストにtask diffがないことを最終監査 |
| キャラクター同士の口調が似る | 一人称・語尾・固有語彙のチェック表と全文一意性検査を使う |

## 13. 完了条件

- 設定メモのうち対象特殊石26種について、吹き出し台本が確定している。
- 罠・爆弾系に新しい発話がない。
- 現行の特殊石本文は「いっぱい食べる俺が好き」を明示再採用した場合を除き全面的に新規文へ置換されている。
- 全候補が人格、シナリオ、一意性、長さ制約を満たす。
- 特殊石26種の `place` / `destroy` / `living_will_restored` と、行列上の追加シナリオに発話がある。
- 顕現石3種の既存固有セリフ、演出、テスト期待値に変更がなく、新規吹き出しも追加されていない。
- ゲームルール、状態、ネットワーク権威、playback type、表示時間、Single Visual Writerに変更がない。
- focused tests、typecheck、network parity、browser build、Worker mirror準備、実機表示確認が通る。
- root sourceから生成物を作り、generated/mirrorを直接編集していない。

## 14. Self-review

初稿では顕現石3種の既存固有セリフも人格設定に合わせて置換する設計だった。ユーザーから「顕現石は現時点ではセリフ不要」と明示されたため、顕現石を全面改稿対象から外し、既存固有セリフを変更・削除せず、新規吹き出しも追加しない非変更契約へ修正した。

また、単純な全文置換だけでは、共通 `living_will_restored`、労働石の旧形式、複製フォールバック、`TIME_STOP_DEITY` / `ZOMBIE` の発話漏れが残ることを確認した。そこで既存イベント型を維持したまま、対象行列、専用シナリオ、労働石の汎用化、旧文フォールバック削除を設計へ追加した。

毎ターン発動時にも話させる案は、1発話あたり約3秒のplayback待ちが狙撃・落雷・龍系などで累積するため不採用とした。発話頻度を節目へ限定しても、全キャラクターの人格は登場・喪失・終了・復活で十分に表現できる。

最終確認では、対象特殊石26種、罠・爆弾・顕現石除外、権威境界、台本正本、生成物、cross-runtime検証、顕現石非変更監査、客観的完了条件がすべて本文へ含まれている。未解決の実装判断は残していない。
