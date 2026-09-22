# Godot移植用の演出・音・戦闘ライフサイクル

この資料は既存の演出と組み込み契約を他言語へ移すための引き継ぎ資料。仕様の正本は [01-rulebook.md](../01-rulebook.md)、[演出正本](../正本/演出正本.md)、[ターン進行正本](../正本/ターン進行正本.md)、[効果音対応表](../正本/効果音対応表.md)。内部契約は [architecture-contracts.md](architecture-contracts.md) §7.3 と [battle-integration.md](battle-integration.md)。演出刷新、Godot実装、Godotの実測保証は対象外。

## 状態確定と表示の分離

coreは操作の採否、乱数結果、石ID、マーカー、手番、勝敗を確定し、ordered presentation eventsを出す。UIは確定後の盤面を直接早出しせず、イベント前の表示状態から指定された演出を再生して、最後に確定フレームへ合流する。Godotにも「正本状態」「現在の演出投影」「確定表示フレーム」を分けて持たせる。セーブへ保存するのは正本状態と進行phaseであり、Tween、Node、テクスチャ、効果音再生位置ではない。

現行の分類は [playback-event-contract.ts](../shared/playback-event-contract.ts)、[playback-types.ts](../ui/board-visual/playback-types.ts)、[effect-branch-inventory.ts](../ui/board-visual/effect-branch-inventory.ts) を再利用する。最後の台帳は各分岐のevent/rawType/cause、所有renderer、同時表示境界、unit/browser検証先を持つ。[収集コマンド](../scripts/capture-godot-presentation.ts) はこの台帳をそのまま `effect-branches.json` へ出す。別の手書きの分岐一覧を正本にしない。

| 表示要素 | 契約上の区分 | Godotで保つ区別 |
| --- | --- | --- |
| 石本体、特殊石の種類、所有色 | `stone_body`、`stoneMutation: replace/remove/preserve` | 石IDと種類・色の変更。通常石化、転生、所有者変更を付与状態の解除と混同しない |
| 完全保護、生きる意志、毒、灼熱等 | `stone_status`、`preserve/replace/timer-only` | 本体に重ねる効果。付与だけで元の特殊石画像を失わない |
| 毒・灼熱・治癒・種・封鎖・凍結 | `cell_marker`、`preserve` | 石と独立した座標上の要素。空マスにも存在し、本体を置換しない |
| 穴、盤外、拡張・縮小 | `topology` | 通行可能性と盤面形状。破壊で空く通常マスと穴を区別 |
| 次配置予約 | `placement_effect` | 現在石ではなく次配置へ渡す効果 |
| ターン数字、毒三角、灼熱数字、説明・名称 | 表示ラベル | 数字が同じでも寿命を同一視しない。マス寿命は左上、石の毒/灼熱は中央左右。情報欄はsettled frameから作る |

`getRenderedCell()` の石診断は保持している確定表示石であり、演出中の一時投影とは別。転生の候補をこの診断だけで観測すると、候補が切り替わっていないと誤判定する。収集は既存の `setProjectedStone` を観測し、実PNG・動画と照合する。

## 順序・時間・重なり

`sequenceIndex` は意味順、`actionId` は特殊石1体/爆弾1個等の直列境界、`effectBlockId` は同時表示を許す1回の効果、`phase` はUIの再生単位。異なる非null actionIdを同じphaseへ統合しない。単一爆弾の範囲破壊は同じeffectBlockIdで並列にできる。別の爆弾は原因名が同じでも次のphase。UIが乱数を追加したり、snapshot差分からイベントを再構成してはならない。

通常の手番は前の再生完了→ラウンドボーナス→支払い→開始時効果→ドロー→カード使用/手札破壊→配置/選択解決/パス→挟み反転→配置後効果→布石表示→毒・灼熱・マスの終了処理→終了判定→交代。特殊石・継続効果は登場 `createdSeq` 順。同じ種類という理由でまとめない。

以下は現行通常速度の基準。イベントごとのsource trajectoryやハイライト最低時間があるため、全イベントを一律の秒数へ丸めない。正確な分岐は前掲台帳のrenderers参照。定数元は [animation-constants.ts](../ui/animation-constants.ts)、[board-playback.ts](../ui/pixi/board-playback.ts)、[reincarnation-animation.ts](../constants/reincarnation-animation.ts)。

| イベント/効果 | 対象・表示と基準時間 | 音と重なり/再開 |
| --- | --- | --- |
| `place_hand_animation` → `place` → `flip` | 手が到達した接触時に完成石を表示。反転は最終色へ切替えて462ms。通常手置きは約440ms | 配置音は接触に対応。先に確定石を出さず、配置後効果まで完了して次へ |
| `destroy` | 対象を赤表示。event所有の石を500msフェード、settlementは700ms。攻撃軌道があれば着弾待ち | 通常破壊音と爆破/吸込等の専用音を二重再生しない。不成立の破壊も狙われた赤表示は残す |
| `spawn` | 完成した種類で生成、基準500ms、紫ハイライト最低500ms | 各生成に生成音。複数生成が直列指定なら1個ずつ |
| `move` | 通常移動400ms、種類固有の経路と速度あり。移動先は紫。入替は両方。テレポートは軌跡なし、pulse140ms | 多動/強風/浮力/重力/引力/テレポートの対応音。距離だけで種類を推測しない |
| `status_applied/removed`, `crossfade_stone` | 石本体・石状態・マスを区別。通常化等はクロスフェード600ms、再生消費500ms、紫最低500ms | 生きる意志の付与音と復活音は別。タイマー減少ごとに適用音を鳴らさない |
| 毒・火・水・草 | 発生源から対象へ軌道→着弾→マス成立。毒付与は独立した石状態 | 火/水/草は着弾時に成立した1マスにつき1回。不成立なら軌道・音なし |
| ゾンビ感染 | 移動後に影→牙→屍石へ変化。噛付基準800ms | 同一感染バッチに1回。対象なしなら噛付演出なし |
| `theory_incarnation_spawn_roulette` | 理論の化身は2500msルーレット→2000ms出現。転生は下記の別契約 | 同じevent種でも `target.reincarnation` を必ず区別 |
| `card_use_animation`, `hand_add/remove`, `capture_to_hand_animation` | 手札→使用、破棄→ドローなど指定順を維持。カード面は横5:縦6が基準 | 手札選択と使用確定は別音。カード移動完了前に選択UIを開かない |
| `special_card_cinematic` | 全画面暗転＋立ち絵＋文字送り。終了後サマリー3000ms＋500ms fade | 特殊使用音の開始からBGMを3000ms無音→専用BGM。通常カード音は重ねない |
| `manifest_ending` | 同色の通常石化と同時に2000ms暗転。最大約60%、前半in/後半out | 専用BGM早めfade out→後半通常BGM。盤面演出/SE/入力を重ねず、全体の完了後に再開 |
| `round_bonus_banner`, `observer_bubble`, `log` | 布石表示・短い台詞等。台詞基準3000ms＋700ms fade | 勝敗や盤面の正本ではない。台詞のNode寿命を戦闘終了結果と混同しない |

phase間の基準gapは200ms。動きを減らす設定は既存ポリシーに従うが、比較のためにアニメを無効化した状態を通常演出の確認済みとして扱わない。画面外の軌道は描画範囲をclipしても論理的な着弾・完了を省かない。

## 転生の意志の音同期

対象は自分の特殊石本体。候補はheadlessが列挙した `previewStates`、最終形は `after`。候補に表示された効果は発動しない。元本体だけを置換し、別の付与状態を一緒に消さない。転生確定後に登場直後効果が続き、その後に通常配置を受け付ける。

候補画像と専用音を準備してからvisual startと専用音 `reincarnation_will` を1回開始する。[animation-engine.ts](../ui/animation-engine.ts) が音bufferを事前準備し、[dispatcher.ts](../ui/presentation/dispatcher.ts) がbackendの最初のvisual frame準備通知に音を合わせる。[reincarnation.ts](../ui/pixi/effects/reincarnation.ts) は次の境界を使う。

| 音開始からの時刻(ms) | 必須表示 |
| --- | --- |
| 0、62.5、125、187.5、250、312.5、375、437.5 | 最初の8候補ステップ |
| 500、625、750、875、1000、1125、1250 | 次の7ステップ |
| 1375、1625、1875、2125 | 次の4ステップ |
| 2375 | 最後の途中候補 |
| 2500 | 最後の和音と最終石確定 |
| 2500–4300 | 確定石の光の余韻。続く登場直後効果も終わるまで入力不可 |

候補が多くても少なくても時間を変えない。ブラウザ描画はframe単位なので録画時のwall-clock観測は定数と小差がある。機械検査では音bufferの実start、候補変更、`noAnimation:false`、確定が2500ms±200ms、保存解放が少なくとも4250ms後であることを検査する。この許容幅は実ブラウザのframe単位の検査許容であり、Godotで200msずれてよいという製品仕様ではない。

実測でPixiの上限付きticker deltaを積算すると、2500msのtimelineが実時間2708msに伸び、音だけ先へ進む不一致を検出した。転生のtimelineだけ単調実時間 `performance.now()` に従うよう修正した。低FPSで見えなかったframeを後から遅れて再生せず、次に描けるframeで音に対応する候補/最終石へ追いつく。一般の盤面演出のdelta経路は変更していない。Godotでも音に同期する演出を描画frameのclamp付きdeltaだけで測らない。

収録環境はWindowsのANGLE/D3D11（既存の転生browser検査と同じ）。強制SwiftShaderと全画面・canvas同時録画では、修正後も最終frameの前に332msの描画callback停止が生じ、同期検査が失敗した。候補時計の累積遅れと、frame自体が来ない停止は区別する。検査閾値を緩めず通常のGPU描画へ戻した。正確な起動引数を `report.graphicsArgs` に残す。この検査は実行環境での実測であり、OS停止や任意のGPU/負荷で同じ上限を保証しない。

## 証拠の再生成と比較

repoの通常8000サーバーと最終 `npm run build:vite` を使用し、`node dist/scripts/capture-godot-presentation.js` を実行する。別URL/出力先は順に引数指定できる。新環境のブラウザは `npx playwright install chromium`。サーバーの再起動は不要。既存 `check-battle-browser.ts` と同じ公開adapterと盤面座標debug contractを利用し、手札クリック→使用ボタン→盤面クリックを実入力する。

録画成功後にライフサイクルだけ再検査する場合は `node dist/scripts/capture-godot-presentation.js http://127.0.0.1:8000/ output/godot-port-preparation/presentation --lifecycle-only`。既存の両場面の結果・録画時刻を保ち、`lifecycleCapturedAt` と最終UI撮影時刻を別に残す。対象の演出本体や音源を変更した場合は、この再利用をせず全収録をやり直す。

既定出力は `output/godot-port-preparation/presentation/`。

| ファイル | 意味 |
| --- | --- |
| `effect-branches.json` | 既存の全演出分岐と実装/検証先の台帳 |
| `report.json` | 実行URL、Vite/Pixi、animation有効、専用音・候補・確定時間・保存待機結果 |
| `reincarnation/` | 幽体からの転生。候補・確定・専用音・保存待機 |
| `destroy/` | 破壊の意志。赤表示、石消滅、破壊音、保存待機 |
| 各 `initial-save.json`, `pending-save.json`, `settled-save.json` | 比較できる正本状態。pendingを保存できた証拠も含む |
| 各 `selection.png`, `during.png`, `settled.png` | 実ブラウザの候補選択、演出中、確定画面 |
| 各 `final-ui.png` | 最終配信版にsettled-saveを新documentで復元した画面。カード名称と空欄でないことも検査。録画と別の撮影時刻をreportに記録 |
| 各 `screen.webm`, `audio.webm`, `board-and-audio.webm` | 全画面動画（無音）、実Web Audio出力の録音、Pixi盤面と実出力音声を同じMediaStreamで収録した同期動画。後から素材音を重ねた動画を再生成功の証拠にしていない |
| 各 `timeline.json` | `performance.now` 起点、phase event全体、SE要求と受理、実buffer start、投影した候補、timeline完了、保存要求/解放時刻 |
| `media-validation.json` | 同期動画の映像・音声stream、全編decode、非無音の確認とdecoder警告 |

映像だけで音を判断せず、`sound` →対応する `audio-buffer-start` と `projected-stone/timeline-start` を照合する。収録する4種のSEは既存の `primeEffectBuffer` で先に準備するため、これは音源準備済みの比較ケース（cold HTMLAudio fallbackは録音graph外）である。音声録音の0秒は `audio-record-start.t`、同期動画の0秒は `combined-record-start.t`。全画面動画はページ開始からの別録画で、同じ0秒とは扱わない。候補投影とsettled石は別々に記録する。動画と時系列は移植比較資料であり、全カード全frameの画像一致保証ではない。通常クリック・新document復元・黒勝/白勝/引分・実CPU推論の統合検査は既存 `npm run check:battle-browser`。

2026-09-22の収録は全検査成功。転生の確定開始は音開始から2532.7ms、演出中saveの待機は4675.8ms。破壊は専用音の実buffer開始とsave待機737.5msを確認した。両同期動画は588×588のVP8と48kHz stereo Opusを含み、FFmpeg全編decodeはexit 0、音量の最大値は転生−14.9dB、破壊−17.9dB。生WebMのdecodeにはOpus packet header警告が1件ずつ出るが、映像と非無音の音声は復号できている。加工して警告を隠さず生データと検査結果を残した。録画開始は09:41 UTC、ライフサイクル再検査は09:51 UTC、最終UI画像は09:51:48/52 UTCである。

## 戦闘の寿命とGodotの後始末

| 状態/操作 | 条件と結果 | 検証の入口 |
| --- | --- | --- |
| 開始 | 1documentに1回、同じcontainer重複mount禁止。ブラウザadapter黒席は人のみ。`ready`後に操作可能 | `ui/battle/host.ts`, `embedded-runtime.ts` |
| 保存 | active/finishedのみ。renderer ready+idle、pending frameなし、processing/cardAnimating/playback/claim/selection settlement lock/未再生eventが全てない境界を待つ | `godot.presentation-lifecycle.test.ts`、実演出収集 |
| CPU思考/演出中save | 完了境界まで待つ。120秒で失敗。待機を完了扱いで即時snapshotしない | lifecycle単体は共有processing gateを制御。CPU遅延応答は後述の実処理テスト |
| 対象選択中save | 選択UIが落ち着けば保存可。未確定対象とpendingを維持、復元して開始済ターンを再実行しない | lifecycleと `battle.session.test.ts`、収集のpending-save |
| 正常終了 | 正本上の連続パス終局と演出完了後に `finished`。満盤だけを終了にしない | `battle.session.test.ts`、`check-battle-browser.ts` |
| 中断/退出 | `cancelled`。勝敗や報酬にしない。ready待ち、CPU中、演出中でもdispose可能 | lifecycle |
| 初期化・描画失敗 | `error`。タイムアウト/recovering/destroyed/settlement errorを勝利と混同しない | lifecycle、`battle.initialization-failure.test.ts` |
| 再戦 | 新battleId、新session、新document。disposed runtimeは復活させない | lifecycleのhost/rematch |
| dispose | 冪等。予約reset、CPU scheduler、Worker、save境界waiter、playback、rendererを破棄 | lifecycle、Worker/timeline既存テスト |

ブラウザでの最後の隔離はiframe削除に依存する。`CardReversiBattle.dispose()` だけ呼んで同じページを生かして再利用する契約ではない。Godotの `queue_free()` だけでも非NodeのTask/Worker/音声global singletonが自動で止まるとは限らない。scene ownerは次を一つの終了処理で扱う。

1. 終了generationを進め、入力・結果consumerを無効化する。同じ操作ID/完了通知を再適用しない。
2. CPU推論/探索と待機Taskをcancelし、返ってきた古いgeneration・requestId・decisionEpochの結果を捨てる。予約retryも取り消す。
3. 保存待機を失敗として解決、タイマーとframe callbackを解除。保存成功を捏造しない。
4. 演出queue、Tween/timeline、projection/ghost/highlight、render callback、texture leaseを解放。描画再生の完了通知を二重に送らない。
5. 戦闘所有の音声/BGM fade/timer、signal接続、input callback、UI Nodeを解放する。通常BGM等ホスト所有資源の扱いを所有境界で決める。
6. 新sceneは新contextで開始。前sceneのpending、CPU memory、結果consumerを流用しない。再開だけは検証済saveから明示的に復元する。

この段落はGodotが満たすべき移植条件で、未実装のGodot sceneを検証済みとするものではない。

## 物語と報酬の契約

`BattleOutcome` は `finished {battleId,resultId,result}`、`cancelled`、`error {message}` の排他的3種。[host.ts](../ui/battle/host.ts) の `finished` Promiseは一度だけ確定し、重複結果通知や終了後disposeで勝敗を上書きしない。`resultId = battleId + ':result'`。新しい戦闘に古いbattleIdを再利用しない。

物語ホストは「戦闘save、進行、報酬、受領済resultId集合」を同じatomic保存世代として確定する。既受領resultIdなら進行と報酬を再加算しない。保存失敗なら直前世代と戦闘を保持し、再試行する。正常終了を受信しただけで先に報酬をメモリーへ加算してはならない。error/cancelledでは報酬を反映しない。[独立サンプル](../examples/story-host/story.ts) の `persist` と `settledIds` が既存実装。組み込み中の標準リザルト・観測石報酬は無効。

## 検証範囲

実ブラウザのカード使用後、UIが `lastUsedCardByPlayer` の正本IDを `{id,name,desc}` へ上書きする既存の不一致を検出した。新しい保存検証を緩めず、[card-interaction.ts](../cards/card-interaction.ts) の表示用上書きを除去した。pipelineのID/所有者を保ち、表示名・説明は従来のcatalog解決を使う。`test/ui.card-use-source-element.test.ts` の回帰テストと、実入力→対象選択保存→新document復元で確認する。ルールと表示内容の変更ではない。

追加 `test/godot.presentation-lifecycle.test.ts` は境界待機、退出、pending復元、二重結果、初期化失敗、mount中dispose、再戦隔離を検査する。実ブラウザのCPUをmockしたまま動作確認済みとはしない。既存の `browser-vite.cpu-worker-client/runtime`、`game.cpu-lv10-turn`、`cpu.turn-handler.retry` テストがcancel後遅延応答・古い思考結果・予約retryを、`ui.pixi-timeline` がabort/destroy後のticker停止を、`ui.presentation-dispatcher` と `ui.playback-settlement` が再生所有権と一度だけの完了を検査する。実行した検査と件数は移植準備の最終検証記録と `presentation/report.json` で確認する。

実CPU検査はLv6を起動し、人の配置後、白の開始処理済み・processing中・cardAnimating/playback停止・盤面writer idleの同時成立を待つ。これにより手番交代アニメ中とCPU処理待機中を区別する。save成功ケースは実ONNXのloadedとinferenceCallsも検査し、4回の推論後にturn2で保存できた。退出ケースは推論開始前の処理待機中に実施し、待機saveの `Battle disposed` と `cancelled` を確認した。実推論の途中に退出して遅延応答が届くケースは既存worker単体テストの範囲で、今回ブラウザ動画の検証範囲と混同しない。初回収集のtimeoutは、factoryが返す内部メソッドをmoduleのexport関数として監視した計測側の誤りだった。上記の公開状態境界へ直し、ゲーム側の待機条件やtimeoutを緩めていない。

録画時には転生の意志の使用済み欄コピーが未登録で空表示になる既存欠落も見つかった。正本カードIDは保存されており、表示読取はstring IDに対応済みだった。カードコピーを登録した最終配信で `final-ui.png` を撮り直し、名称と説明を目視・機械検査で確認した。元の音同期録画は当時の空欄を含む証拠として保持する。

今回の証拠は通常Vite/Pixi、転生・破壊の代表場面であり、classic、全カードの音の実聴、全OS/全GPU、Godotの画面・音・CPU性能を実測したものではない。音源の申告出典は [asset-provenance.md](asset-provenance.md)。録画・録音は出典の権利確定資料ではない。
