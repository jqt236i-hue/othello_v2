# 相手アクション時フレーム停止の統合修正 設計書

## 文書の役割

- 役割: CPUがカードまたは石を使う瞬間に発生する数百ms級のメインスレッド停止、再生終了エラー、Pixiの過剰な更新、FPS表示の診断不足を一体として解消するための実装設計
- プレイヤー向け仕様の正本: `01-rulebook.md`
- 内部構造・authority・Single Visual Writerの正本: `docs/architecture-contracts.md`
- 実装手順: `docs/implementation/opponent-action-frame-stall-remediation-plan.md`
- 対象runtime: 通常のローカルCPU対戦を主対象とし、ブラウザVite/classic、headless、DOM compatibility、ネット対戦の既存契約を回帰対象に含める
- 非目標: CPUの強さ・カード選択結果・乱数結果、カード効果、演出の意味順や時間、ネットワークauthority、盤面デザインの変更

## 問題と期待結果

通常時は高い描画更新頻度を維持できる環境でも、相手CPUがカードを使う、または石を置く瞬間にFPS表示が一時的に約30まで低下する。実測では、FPS制限ではなく、CPU引き渡しタイマーの後でCPU判断、カード確認、状態反映、presentation handoffが一つのブラウザtaskへ集中し、約0.47〜0.67秒requestAnimationFrameを止めている。

期待結果は次のとおり。

- Lv1の通常着手・カード使用で数百ms級のメインスレッド停止を発生させない。
- CPUのカード判断、着手結果、発話内容、カード効果、turn orderを変更しない。
- 再生中の盤面writerとplayback claimを必ず一度だけ正常にsettleし、`local_playback_manager_finalizer_unavailable`を発生させない。
- 高リフレッシュレート端末でもPixi盤面演出を必要以上に再描画せず、同一内容のセルと同一canvasサイズを再構築しない。
- FPS表示から「平均FPS低下」なのか「長い1フレーム」なのかをプレイヤーが区別できる。
- 性能改善を主観ではなく、同一fixtureのframe interval、Long Task、stage duration、Pixi diagnosticsで再現・判定できる。

## 調査根拠

### 実ブラウザ計測

CPU Lv1、Pixi backend、8x8通常盤面で「黒の着手から白CPUの応答まで」を計測した。

| 条件 | アクション全体 | 最大frame interval | Long Task | Pixi diagnostics |
| --- | ---: | ---: | ---: | --- |
| 通常アニメーション | 約2.87秒 | 約467〜633ms | 約477〜650ms | ticker start +2、render +73、scene apply +7、updated views +448 |
| `noanim=1` | 約1.18秒 | 約650ms | 約667ms | ticker start 0、render +11、scene apply +5、updated views +320 |

- `noanim=1`でも停止が残るため、最大の停止はPixiアニメーションそのものではない。
- Chrome traceでは、約200ms後に発火したCPU handoffの`TimerFire`が長時間taskの起点だった。200msの待機ではなく、コールバック内の同期処理がframeを止めていた。
- 通常runのtrace集計ではGPU taskが合計約102msあり、Pixiアニメーションは二次的負荷として残る。
- 1回の黒+白着手で約15MBのheap増加と約35〜52msのGCが観測された。
- Playwright計測環境は60Hzだが、Long Taskの長さとTimerFireへの帰属はrefresh rateに依存しない。240Hz端末では同じ停止がより多くの失われたframeとして見える。

### コード上の根拠

- `ui/fps-display.ts` は500ms窓のRAF callback数だけを表示するため、数百msの1回の停止が「一時的な約30 FPS」として丸められる。
- `game/move-executor.ts` はCPU handoff delayを動的global/module解決で決め、レベル解決失敗時は200msへ倒す。実ブラウザではLv1選択中にも200ms timerが観測された。
- `game/cpu-decision-card-choice.ts` の`selectCardToUse()`は、使用可能カードが0枚か確認する前に合法手、全card decision context、quiescence、corner planを構築する。
- `game/cpu-decision-card-context.ts` は、実際の手札に該当カードがなくても盤面拡張、交換、誘惑、5種類の移動、marker走査、全体凍結候補を毎回計算する。
- 同じCPU invocation内で、カード判断用合法手、move phaseのcandidate moves、CPU発話用mobilityが別々に導出される。
- `ui/presentation-handler.ts` はcallback side-channelで受け取るmanager finalizerを必須とする一方、`ui/animation-engine.ts`にはdeferred settlementでfinalizerを登録せずreturnできる分岐があり、通常演出で`local_playback_manager_finalizer_unavailable`を再現した。
- `ui/pixi/board-scene.ts` はcell、stone、hintの各viewが同じcell全体`visualSignature`と同じ共通revision signatureを使う。このためhintだけの変更でもcell surfaceとstoneを再構築する。
- `ui/pixi/application.ts` の`resize()`は幅・高さ・resolutionが同じでもrenderer resizeを呼ぶ。
- `ui/pixi/timeline.ts` はactive run中のticker callbackごとに明示renderするため、240Hz端末では演出durationに対して最大約4倍のrender callbackを処理し得る。
- `ui/render-scheduler.ts`と`ui/board-visual/controller.ts`には既にRAF単位のrequest集約とplayback中のlatest-frame coalescingがある。新しいrender schedulerや第二writerを追加する必要はない。

## スコープ

### 含むもの

1. CPU handoff delayの明示的・player-awareな解決
2. 1回のCPU invocationに閉じたanalysis seedと用途別derived result
3. カード使用可否の早期判定、card-type別の必要feature計算、同一解析の再利用
4. CPU発話での重複盤面解析削減
5. CPU stageのdebug限定performance instrumentationと再現fixture
6. playback finalizer callback side-channelの型付きsettlement resultへの置換
7. Pixiのview別invalidation、同一resizeのno-op化、active animation render上限60Hz
8. FPS overlayへのsample内最大frame時間表示
9. focused unit/contract/browser performance検証、browser build、Worker mirror同期

### 含まないもの

- CPU Workerへcanonical game state、乱数、action選択・適用を移すこと
- CPUの評価重み、カード温存方針、合法手定義を変えること
- animation duration、phase gap、ordered `events[]`を短縮・省略・並列化すること
- controllerを迂回するcanvas、DOM writer、animation clockを追加すること
- FPS overlayをゲームauthority、入力gate、CPU判断へ接続すること
- network snapshot/publish protocolを変更すること
- DOM compatibility backendを通常Pixi pathの部分fallbackとして使うこと

## 前提と制約

- `game/`と`shared/`はheadlessを維持し、DOM、`window`、RAF、sound、network clientを直接参照しない。
- CPUのderived analysisはadvisoryな計算結果であり、canonical stateではない。action適用前の既存検証を置き換えない。
- 状態変更、pending instance変更、player/turn変更後に古いanalysisを再利用しない。
- playback最適化はSingle Visual Writer、strict network committed-frame apply、local drain ownershipを維持する。
- animationは既存のPixi ticker `deltaMS`積算によるduration semanticsを維持する。60Hz上限はticker callback/render回数だけを減らす。
- debug instrumentationは`?perf=1`等の明示gate以外でPerformance API、文字列組立、report蓄積を行わない。
- 性能reportへ盤面全文、非公開手札、seat token、operationId等の機密・対戦識別情報を記録しない。

## 代替案と採用判断

### A. Pixiを30/60 FPSへ制限するだけ

GPU負荷は下がるが、`noanim=1`でも約667msのLong Taskが残ったため主因を解消しない。二次対策としてのみ採用する。

### B. CPUターン全体をDedicated Workerへ移す

メインスレッド停止を避けやすい一方、現在のWorker契約はpure candidate scoringとONNX inferenceに限定される。カード適用、RNG、pending、presentationまで移すとgame authorityが二重化し、browser/headless/network parityの危険が大きい。採用しない。

### C. CPU処理の途中へ無条件の`setTimeout(0)`を多数挿入する

一時的にframe opportunityを作れるが、状態変更後のstale continuation、turn re-entry、pending競合を増やし、重複計算も残す。固定位置のyieldを主解決にしない。

### D. finalizerが無い場合にno-op finalizerを補う

console errorは消えるが、writerやbusy stateが実際にはsettleしていない失敗を成功に見せる。architecture contractと実装品質ルールに反するため採用しない。

### E. CPU derived analysisのinvocation内再利用、必要featureだけの計算、型付きplayback settlement、既存Pixi laneの局所invalidaton

既存authorityとdependency directionを維持したまま、実測で見えた無条件計算、重複計算、callback欠落、過剰renderをそれぞれ所有moduleで除去できる。これを採用する。

## 採用設計の全体像

```text
turn handoff
  └─ explicit delay policy(nextPlayer, level, optional test override)
       └─ runCpuTurn(invocation identity)
            ├─ prepare trap-only debug state when explicitly enabled
            ├─ build immutable analysis seed
            │    ├─ identity / protection / blockers
            │    └─ usable card analysis + selector evidence
            ├─ commentary required → derive basic-semantics metrics for that moment
            ├─ no usable card → skip card-decision derivation entirely
            ├─ usable card → derive card legal + required feature groups only
            ├─ card applied/state changed → discard seed/derived data and resume normally
            └─ no card → derive placement candidates, reusing only proven-equivalent evidence
                 └─ canonical executeMove
                      └─ typed playback settlement
                           └─ one writer / one finalizer / committed final frame
                                └─ Pixi view-local updates at max 60 renders/sec
```

## 詳細設計

### 1. CPU handoff delayを一つのpure policyへ統合する

`game/cpu-turn-delay.ts`をpure helperとして追加し、次の入力だけでdelayを返す。

```ts
type CpuTurnDelayRequest = Readonly<{
  playerKey: 'black' | 'white';
  decisionLevel: number | null;
  explicitDelayMs?: number | null;
  defaultDelayMs?: number;
}>;

resolveCpuTurnDelayMs(request): number
```

ルールは以下で固定する。

1. test/debugから明示された有限の`explicitDelayMs`を最優先し、0以上の整数へnormalizeする。
2. 明示overrideがなく`decisionLevel === 1`なら0ms。
3. それ以外は既存互換の200msを既定値とする。
4. Lv6の最低思考時間は既存`resolveLv6MinThinkMs`が所有し、このhandoff delayへ混ぜない。

`game/move-executor.ts`と`game/pass-handler.ts`は暗黙の`CPU_TURN_DELAY_MS` globalを読まない。bootstrapがdebug/test overrideを明示的に注入し、handoffが確定した`nextPlayerKey`とCPU public resolverのlevelから同じhelperを呼ぶ。`game/network-turn-handoff.ts`は解決済み`cpuDelayMs`だけを受け取り、global fallbackやlevel判断を持たない。黒CPU自動対戦でも白hard-codeを使わない。

これは200msの意図的待機とCPU callbackの処理時間を分離し、Lv1の既存「応答性優先」方針を実ブラウザでも確実にする。delay変更自体はframe停止を解消しないため、以下のanalysis最適化と別metricで検証する。

### 2. CPU invocation identityと段階構築するderived analysis

`game/cpu-turn-analysis.ts`に、1回の`runCpuTurn()`だけで有効なimmutable seedと用途別deriverを置く。一括完成snapshotを先に作らず、必要になった用途だけを派生させる。seed/derived resultはserialized gameplay stateへ保存せず、module-level cross-turn cacheにも置かない。

```ts
type CpuTurnInvocationIdentity = Readonly<{
  runId: number;
  playerKey: 'black' | 'white';
  turnNumber: number | null;
  decisionLevel: number;
  stateVersion: number | string | null;
  decisionEpoch: number;
  pendingEffectId: string | null;
  pendingStage: string | null;
  retryGeneration: number;
}>;

type CpuTurnAnalysisSeed = Readonly<{
  identity: CpuTurnInvocationIdentity;
  protection: readonly unknown[];
  flipBlockers: readonly unknown[];
  cardUsability: Readonly<CardUsabilityAnalysis>;
}>;

type CpuCardDecisionAnalysis = Readonly<{
  identity: CpuTurnInvocationIdentity;
  cardLegalMoves: readonly CpuCardLegalMove[];
  boardMetrics: Readonly<CpuTurnBoardMetrics>;
  moveScanEvidence: Readonly<CpuMoveScanEvidence> | null;
}>;

type CpuPlacementAnalysis = Readonly<{
  identity: CpuTurnInvocationIdentity;
  placementCandidates: readonly CpuPlacementCandidate[];
}>;

type CpuCommentaryAnalysis = Readonly<{
  identity: CpuTurnInvocationIdentity;
  snapshotMoment: 'turn-start' | 'post-card' | 'post-move';
  metrics: Readonly<CpuCommentaryMetrics>;
}>;
```

- `buildCpuTurnAnalysisSeed()`はidentity、protection/blocker、CardLogicの使用可否analysisだけを作り、card legal、placement、commentaryを計算しない。
- `deriveCardDecisionAnalysis(seed)`、`derivePlacementAnalysis(seed, priorCardAnalysis?)`、`deriveCommentaryAnalysis(seed, snapshotMoment)`は、それぞれ新しいimmutable resultを返し、seedをmutationしない。
- カード判断用の`getLegalMoves()`、pending効果を反映した着手候補、実況の`getLegalMovesBasic()`は意味が異なるため、同じ配列として扱わない。用途別derived resultへ分離する。
- pendingなし、同一player/protection/blocker、同一盤面などの同値条件を`game/move-generator.ts`側で証明できる場合だけ、一つの盤面走査からカード用shapeと着手用shapeを同時に導出する。条件外では既存generatorを用途別に呼び、最適化のために結果を同一視しない。
- 同値条件下ではcard derivationが返す`moveScanEvidence`をplacement derivationが消費できる。evidenceが無い、identityが違う、条件が変わった場合はplacementを既存semanticsで新規導出する。
- candidate order、`effectUsed`、`player`等の付加情報は既存generatorの結果をそのままfreeze/copyし、再sortや別の合法手実装を追加しない。
- 実況用mobilityは発話engineのcheap precheckがcontextを必要としたsnapshot momentだけ、既存basic semanticsで黒白それぞれ一度計算する。カード用・着手用候補から推測しない。
- usable card 0件では`deriveCardDecisionAnalysis()`を呼ばない。move phaseへ進んだ時点で`derivePlacementAnalysis()`だけを一度呼ぶ。
- card use、hand destroy、pending resolution等でstateが変わった場合はそのinvocationを`handled`として終了し、既存resume pathで新しいseedを作る。
- `stateVersion`を取得できるruntimeでは、player、turn number、stateVersion、pending instance、decision epoch、CPU retry generationをidentityとして比較する。いずれかが不一致なら古い結果を捨て、actionを適用しない。
- ローカルruntime等で`stateVersion`を取得できない場合、同期した同一call stack内だけseed/derived resultを再利用する。Worker await、animation wait、明示的yield等の非同期境界を跨いだdataは再利用せずseedから再構築する。照合不能時に「同じと推測する」fallbackを置かない。
- 既存のcandidate scoring `decisionEpoch`をCPU invocation identityへ昇格し、最新run以外のWorker responseとcontinuationを拒否する。serialized game stateへ新しいauthority counterを追加しない。
- derived resultはcanonical validationを省略せず、`executeMove`直前のturn/pending guardを維持する。

### 2.1 使用可能カード解析とtarget evidence

`game/logic/cards-internal/hand-manager.ts`のpureな使用可否走査を、CPU専用ではない内部結果`CardUsabilityAnalysis`を返せる形へ分ける。既存`getUsableCardIds()`はこの結果のID配列だけを返すcompat APIとして維持する。

```ts
type CardUsabilityAnalysis = Readonly<{
  usableCardIds: readonly string[];
  usableCardTypes: readonly string[];
  selectorEvidence: Readonly<Record<string, Readonly<CardSelectorEvidence>>>;
}>;
```

- evidenceは同じstate object、player、card copy/hand index、selector method、引数、selector lane（local/module/public）が完全一致する呼出だけで再利用する。
- local selectorとmodule selectorは同名でも同一結果と仮定せず、既存parity確認を維持する。各laneで得た結果だけを同じlaneの後続評価へ渡す。
- card decision contextが必要とするtarget countは、使用可否走査でcanonical selector resultが既に得られていればevidenceから数え、無いfeatureだけを追加計算する。
- raw target/evidenceはinvocation終了時に破棄し、game state、snapshot、Worker message、performance reportへ保存しない。
- 公開カードID順、重複card copyの扱い、対象なし判定、hidden opponent trapの既存visibility semanticsを変更しない。

### 3. カード判断を「早期reject + feature-demand」に変更する

`game/cpu-decision-card-choice.ts`の順序を次へ変更する。

1. debug専用trap-only注入を先に実行する。通常playでは副作用なし。
2. analysis seedの`cardUsability.usableCardIds`を確定する。
3. 0件なら、card legal、decision context、quiescence、corner plan、decision-context由来の追加target getterを呼ばず`null`を返す。使用可否そのものの判定に必要だったselector evidenceはその一度だけで終える。
4. 1件以上なら`deriveCardDecisionAnalysis(seed)`を呼び、`cardLegalMoves`と再利用可能なselector evidenceを使ってdecision contextを一度だけ構築する。
5. 同じcontextとcorner planをshared policy、Lv6 consensus、risk、高confidence、fallbackへ渡す。

`game/cpu-decision-card-context.ts`は、全featureを無条件計算する一枚岩から、共通baseとcard-type別feature groupへ分ける。返すcontextの公開shapeとdefault値は維持する。

| feature group | 計算する条件 |
| --- | --- |
| board expansion corner targets | usable typeに`BOARD_EXPANSION_WILL`または`BOARD_EXPANSION_GOD`がある |
| swap enemy corner targets | `SWAP_WITH_ENEMY`がある |
| high-value temptation targets | `TEMPT_WILL`がある |
| movement corner swing | `BUOYANCY_WILL`、`GRAVITY_WILL`、`SUPER_BUOYANCY_WILL`、`SUPER_GRAVITY_WILL`、`SUPER_ATTRACTION_WILL`のうち実在するtypeだけ |
| clone source scan | `CLONE_WILL`がある |
| mass-freeze target scan | `MASS_FREEZE_WILL`がある |
| common board/card metrics | usable cardが1件以上ある場合に一度だけ |

featureを計算しない場合も既存fieldは`0`、空object、空array等の従来互換値を返し、policy側へ`undefined`分岐を増やさない。card IDからtypeへの変換は`CardLogic.getCardDef`を使い、catalog parserを複製しない。

使用可能カード判定が既に同じselectorを評価している場合は、Section 2.1のlane付きevidenceを消費してtarget countを作る。証明できないlane/引数の結果を横流しせず、そのfeatureだけを再計算する。これにより「使用可否で一度、評価contextでもう一度」という重複を除きながら、CardLogicの合法性とlocal/module parityを変えない。

`selectHandCardToDestroy`、`selectCardToUse`、no-legal-move retryは同じseedと必要なderived contextを受け取れるoptional internal APIへ揃える。互換引数なしのtest/headless callerはbuilder/deriverで同じ結果を作れるが、browser main pathは必ずprepared dataを渡す。

### 4. CPU発話の重複盤面解析を除く

`emitCpuCommentary()`は、cheapな発話interval/interrupt precheckを先に行い、詳細contextが必要な場合だけ該当snapshot momentの`CpuCommentaryAnalysis`を要求する。counts、phase、advantage、corner/edge/mobility等のprepared metricsを優先し、prepared値がない非CPUイベントだけ`shared/commentary-context-helpers.ts`の既存fallbackを使う。

- 発話engineの2ターン間隔、interrupt event、文面選択、乱数状態を変更しない。
- 発話precheckで表示対象外となるturnは詳細board/mobility解析を行わない。同じsnapshot momentで既にbasic semanticsにより計算済みなら、そのmetricsだけを参照して黒白を再走査しない。
- `cardLegalMoves`や`placementCandidates`からmobility/advantageを推測せず、既存`getLegalMovesBasic()`の結果と発話内容を維持する。
- 着手後の角取得発話はstate変更前snapshotを流用せず、`executeMove`結果または着手後の小さいdelta/新contextを使う。
- commentary failureは従来どおりturn progressionを止めない。

### 5. debug限定のCPU stage instrumentation

`game/`はPerformance APIを呼ばない。portableなentry型、clock正規化、safe recorder呼出は`game/cpu-turn-performance.ts`へ集約し、CPU handlerへoptionalなpure callbackをDIする。handoff開始時点ではCPU levelがまだ確定していない経路があるため、`handoff-delay`だけは`level: null`を許し、run開始後のentryは確定したnumberを記録する。

```ts
recordCpuTurnStage?: (entry: Readonly<{
  correlationId: string;
  runId: number | null;
  stage: CpuTurnStage;
  kind: 'sync' | 'wait';
  startMs: number;
  endMs: number;
  durationMs: number;
  playerKey: 'black' | 'white';
  level: number | null;
  outcome: 'continue' | 'handled' | 'stale' | 'error';
}>) => void;
```

stage名は`handoff-delay`、`card-availability`、`card-context-base`、各`card-context-feature:*`、`move-candidates`、`commentary-context`、`canonical-commit`、`presentation-handoff`へ固定する。perf有効時だけhandoff schedulerがephemeralな`correlationId`を割り当て、scheduled callbackの内部optionとして`runCpuTurn()`まで渡す。カードのpending target選択とanimation retryも同じ`correlationId`を引き継ぎ、再開した各`runCpuTurn()`には新しい`runId`を割り当てる。`handoff-delay`は`kind: 'wait'`かつ`runId: null`で記録でき、callback開始後のstageは同じ`correlationId`と確定した`runId`を持つ。通常playではcorrelation IDを組み立てない。

- CPU/card/move/contextの同期関数呼出は`kind: 'sync'`とし、同じtime origin上の`startMs`/`endMs`を持つ。
- timer delay、Lv6 minimum think、Worker response待機、animation/presentation Promise待機は`kind: 'wait'`とし、250ms ceilingと70%短縮gateから除外する。
- `presentation-handoff`のPromise全体をsyncとして測らず、dispatch前後の同期sliceとsettlement待機を別entryにする。
- Long Task/Long Animation Frameをapp-attributedとするのは、そのtimestamp区間が同じreportの`kind: 'sync'` entryと重なる場合だけとする。observerとstage clockのtime originをreportで検証する。
- invocation当たりのsync合計は入れ子stageのdurationを単純加算せず、`sync` timestamp intervalのunion長として算出する。
- UI bootstrapは`ui/perf-benchmarks.ts`が`?perf=1`で有効な時だけPerformance measureへ変換する。通常playではcallback自体を注入せず、report bufferもglobalも作らない。

ブラウザ内collectorは1反復を`cpu_turn_frame_stall_sample.v1`としてstage measures、Long Task、Long Animation Frame、RAF intervals、Pixi diagnostics deltaへまとめる。Node側capture scriptだけがvalid sampleを集約した`cpu_turn_frame_stall_report.v1`を生成する。reportにはscenario IDと集計値だけを入れ、盤面・手札の実データは含めない。

### 6. playback finalizationを型付き戻り値へする

callback side-channelの`onFinalizationReady`を正規経路から外し、`AnimationEngine.play()`と`PlaybackEngine.dispatchPresentationEvent()`がsettlement結果を返す。

```ts
type PlaybackSettlementResult =
  | Readonly<{
      kind: 'deferred-finalization';
      runId: number;
      mode: 'finalize';
      finalize: () => boolean;
    }>
  | Readonly<{
      kind: 'deferred-finalization';
      runId: number;
      mode: 'already-aborted-ack';
      finalize: () => boolean;
    }>;
```

- `deferFinalSettlement: true`かつpayloadありの成功returnは必ずこのresultを返す。
- 通常完了は`mode: 'finalize'`とし、`finalize()`が`PlaybackStateManager.finalizePlayback()`を一度だけ呼ぶ。
- watchdog/external abortでmanager stateが既にabort済みの場合は`mode: 'already-aborted-ack'`とし、writer settlement完了を確認した後に一度だけtrueを返すacknowledgement finalizerを返す。
- playback失敗、writer settlement失敗、strict committed-frame準備失敗はresultを捏造せずthrowする。
- `finalize()`は返却した`runId`にだけ紐づき、2回目はfalseを返して新しいplayback runを解除しない。
- `PlaybackEngine.playPlaybackBatch()`と`dispatchPresentationEvent()`はこのresultを欠落・変換させず伝播する。`presentation-handler.ts`はawaitした`kind`、`runId`、`mode`、functionを検証してlocal drain claimまたはstrict settlement handleへ登録し、callbackが呼ばれたかを推測しない。
- strict networkの成功settleでは、従来どおりcommitted visual frameのapply成功後にのみ`mode: 'finalize'`を実行してclaimを解放する。
- strict cancelではcommitted applyを要求せず、既存どおりsettlement errorの記録、writer cancel/abort完了後にmanagerをabort-finalizeする。strict settlement handleを唯一の実行ownerとし、戻り値を直接実行する第二ownerを作らない。
- migration中の内部callerがcallback optionを渡しても、単一release内では戻り値から一度だけ通知するcompat adapterを置けるが、root callerとtestsの移行完了後にadapterを削除し、二つの正規経路を残さない。

| branch | result | cleanup owner / 順序 |
| --- | --- | --- |
| local通常成功、payloadあり | `mode: 'finalize'`を1個 | local drainがwriter settlement後に一度実行 |
| local watchdog/external abort後に成功return | `mode: 'already-aborted-ack'`を1個 | local drainがwriter settlement後に一度ack |
| strict animation成功・handoff成功 | resultを1個strict handleへ登録 | strict成功はcommitted apply後、cancelはerror記録とwriter cancel後にstrict handleが実行 |
| result生成前のlocal/strict failure | result 0、throw | handoff前abort/recovery ownerがclaim/writerを一度cleanup |
| strict handoff後cancel | 登録済みresultを新規生成しない | strict cancel ownerが登録済みresultを一度処理 |
| empty payload | AnimationEngine result 0 | PresentationHandlerが外側claimだけをrelease |

これにより`local_playback_manager_finalizer_unavailable`は「握りつぶす」のではなく、payloadありの成功returnなのにfinalizer resultが無い分岐を型・testで排除する。throw branchはresult 0を正しい契約としてcleanup ownerを検証する。

### 7. Pixiの局所invalidationとresize no-op

#### 7.1 view別signature

`BoardCellVisualState`のaggregate `visualSignature`はframe hashingと互換診断用に維持し、Pixi static view用に次のsignatureを追加する。

- `surfaceSignature`: kind、expansion、boundary、cell markers、surface appearanceに関係する値
- `stoneSignature`: stone owner/type/status/badgeとstone appearanceに関係する値
- `interactionSignature`: legal/selectable/selected/hover/keyboard/direction hintに関係する値

`PixiStaticViewContext`も一つの共通revisionではなく、surface、stone、interactionのrevision signatureを持つ。

- cell viewはsurface signature + layout + board appearance/themeだけを見る。
- stone viewはstone signature + layout + stone appearance/themeだけを見る。
- hint viewはinteraction signature + layout + hint themeだけを見る。

これによりturn changeで合法手hintが変わっても、変化していない盤面surfaceとstone graphicsをclear/rebuildしない。DOM compatibility modelの意味、controller frame hash、input semantic layerは変更しない。

#### 7.2 resize idempotency

`ui/pixi/application.ts`は最後に適用したlogical width、height、resolutionを保持する。3値が同じ`resize()`はrendererへ渡さず、diagnosticsの`resizeSkippedCount`だけを増やす。初期mount、DPR変更、viewport変更、context restore、backend replacementでは保持値をresetし、必要なresizeを省略しない。

#### 7.3 60Hz active playback render ceiling

既存のprivate Pixi tickerを唯一のanimation clockのまま使い、`maxFPS = 60`を設定する。

- animation progressはtickerのelapsed deltaで進め、0.46秒等の既存duration semanticsを維持する。
- 新しい`performance.now()` clockへ置き換えず、Pixi tickerが渡す既存`deltaMS`積算semanticsを維持する。`maxFPS`はapplication/ticker adapter境界だけでcallback頻度を抑える。
- phase終端のterminal writeとexplicit final renderは必ず行う。
- idle時ticker stop契約を維持する。
- `noanim`、reduced motion、context recovery、DOM compatibilityへ別clockを追加しない。
- 60Hz未満の端末では自然なRAF/ticker頻度で動き、frameを水増ししない。

### 8. FPS overlayに最大frame時間を追加する

500ms sample窓の平均FPSに加え、同じ500ms窓内の連続RAF timestamp差の最大値を表示する。これは起動後の累積最大値ではない。

```text
FPS: 240
MAX: 5 ms
```

50ms以上のsampleは`data-stall="true"`で既存overlayを警告色にし、値を隠さない。計測開始時の最初のtimestampはintervalへ数えない。background tab等で現在のlong-gap閾値を超えた場合は`FPS: --` / `MAX: -- ms`へresetし、復帰後の最初のtimestampも新しい基準点にしてbackground時間をstallとして報告しない。OFF時は従来どおりRAF loopと表示を停止する。

これは表示専用で、Long Task observer、Pixi ticker、game state、CPU schedulingへ接続しない。保存keyとON/OFF session範囲は変更しない。プレイヤー向け表示文言が増えるため、実装時に`01-rulebook.md` 3.1をroot sourceより先に更新する。

## ownershipとdependency direction

| concern | owner | 禁止する依存 |
| --- | --- | --- |
| delay policy、analysis identity、derived CPU data | `game/` pure modules | DOM、`window`、Timer API、UI module |
| browser timer/perf mark injection | `ui/bootstrap.ts`、`ui/perf-benchmarks.ts` | game state authorityの保持 |
| card legality/effect | 既存CardLogic/turn pipeline | analysis snapshotによるauthority置換 |
| playback claim/busy lifecycle | `ui/playback-state-manager.ts` | animation branchごとの独自busy state |
| finalizer handoff | `ui/animation-engine.ts` → `ui/playback-engine.ts` → `ui/presentation-handler.ts` | no-op success fallback、二重release |
| board writer | `ui/board-visual/controller.ts`とactive backend | 第二canvas、DOM部分fallback |
| Pixi render cadence/view invalidation | `ui/pixi/*` | game/CPU/networkへの逆依存 |
| FPS diagnostics | `ui/fps-display.ts` | canonical state、input gate、CPU policy |

## エラー・edge case・concurrency

- CPU analysis中にplayer、turn、stateVersion、pending effect ID、decision epoch、retry generationが変わった場合、結果を破棄し、古いactionを適用しない。stateVersion不明のまま非同期境界を跨いだ場合も同様に破棄する。
- card use/hand destroyがstateを変えたら同じseed/derived resultをplacementへ流用しない。
- Worker unavailable/timeout時は既存の同一local scorer fallbackを維持する。今回のanalysis snapshotはWorker authorityを広げない。
- debug trap-only modeは早期returnより前に準備し、既存test用のhand/charge注入を失わない。通常playへdebug副作用を出さない。
- usable card IDが不正、card definitionが無い場合は既存CardLogic結果に従い除外し、feature resolverでthrowしない。
- finalizer生成前のplayback failureはclaim abort pathを通り、busy stateを成功扱いで解除しない。
- local presentation drain内の複数batchは各finalizerをreceived orderで一度ずつ実行し、外側claimを最後に解放する。
- strict networkのcommitted frame apply失敗はrecovery handleを保持し、authoritative eventを再生し直さない。
- context loss後はresize cache、view signatures、ticker stateをrestore transaction内で再初期化する。
- orientation、DPR、skin、font-ready、camera viewportの変化は該当signatureだけをinvalidateする。
- 240Hz/144Hz/60Hz相当のticker入力でも既存delta積算duration semanticsとterminal stateを一致させる。
- FPS overlayはtimestamp逆行・非有限値をsample resetとして扱い、負値や`Infinity`を表示しない。

## 互換性・migration・cleanup

- serialized `gameState`、`cardState`、snapshot、Worker publish payload、CPU Worker protocolは変更しない。
- `CpuTurnAnalysisSeed`、用途別derived result、`PlaybackSettlementResult`は内部TypeScript contractであり、classic globalsへ新しい通常play APIを公開しない。
- adjacent `.js`、`dist/`、`public/module-registry.js`、`vite-dist/`、`worker-public/`はsource editせずbuild/generationから更新する。
- playback callback adapterを一時的に置く場合も、全root caller移行とfocused tests通過を同一実装単位のdone条件とし、最終diffへadapterを残さない。
- player-visible animation order/timingは変わらないため`正本/演出正本.md`は更新しない。新しい安定内部契約が確定したら`docs/architecture-contracts.md`のCPU boundaryと7.3 settlement/render cadenceを更新する。
- FPSの`MAX`表示だけは`01-rulebook.md`を更新する。

## 性能検証設計

### deterministic contract tests

- empty handまたはcost/turn等のcheap precheckだけでusable 0件になるfixtureでは、card context、corner plan、quiescence、target getterを0回呼ぶ。
- targetなしを確認してusable 0件になるfixtureでは、使用可否に必要なselectorだけをlaneごとに一度呼び、card decision contextからの追加target getter、corner plan、quiescenceは0回とする。
- usable card 0件ではanalysis seedだけを作り、card decision derivationは0回、move phaseへ進んだ時だけplacement derivationを1回呼ぶ。
- 同じCPU invocationではcard legal、placement、commentaryの各用途が明示されたfieldだけを読み、意味の異なる結果を相互流用しない。
- pendingなし等の同値条件fixtureではmove-generatorの共通盤面走査が1回であり、そこから導出したcard legalとplacement shapeが各既存generatorの結果・順序と一致する。条件外では用途別生成結果が従来と一致する。
- 使用可否解析で得たselector evidenceは同一lane・method・引数のcontext featureだけが再利用し、同一target getterを同じlaneで2回呼ばない。
- feature groupは対応するusable card typeがある時だけ呼ばれ、contextの従来field/default値は一致する。
- stateVersionを含むidentity不一致時、またはstateVersion不明で非同期境界を跨いだ時はprepared seed/derived resultを捨て、`executeMove`を呼ばない。
- Lv1 delayはoverrideなしで0ms、explicit overrideはlevelより優先、他levelと解決失敗は200ms。
- deferred playbackはbranch matrixどおり、payloadありの成功returnだけresultをちょうど1個返して二重finalizeを拒否する。result生成前throw/empty payloadはresult 0で、対応ownerのcleanupだけが一度実行される。
- 同一Pixi frameの2回目applyではmaterialized viewが全てskipされ、同一resizeはrendererへ届かない。
- Pixi Application/ticker adapter境界で60/144/240Hz相当のtimestampを進め、`maxFPS = 60`適用後のtimeline callbackとlive renderが毎秒60回程度に制限される。Timelineへ直接240回tickを注入してthrottleをtestしない。
- 各refresh rateで既存delta積算duration、終端progress 1、terminal render、settlementが一致する。
- FPS 500ms窓で平均FPSと最大frame intervalを同時に算出し、long gapで両方resetする。

### browser performance scenarios

baseline側・candidate側それぞれで一つのimmutable browser artifactを使い、各scenarioをwarmup後5回以上、標準captureでは20回測る。

1. `lv1-empty-or-unusable-hand-place-8x8`
2. `lv1-usable-card-then-place-8x8`
3. `lv1-multi-target-card-playback-8x8`
4. `lv6-worker-backed-place-8x8`
5. `pixi-high-refresh-playback-8x8`

カードfixtureはRNGへ依存させず、既存pipelineのcanonical actionを固定する。animation duration全体は失敗条件にせず、frame blockingとstage durationを評価する。

### acceptance threshold

共有workstation/通常CIで必須にするblocking gateと、隔離したreference環境だけで有効なstrict performance gateを分ける。

#### 必須blocking gate

- deterministic testでearly reject、selector evidence、用途別move semantics、stale rejection、exactly-once settlement、view/resize skip、ticker上限のcall count契約が全て成立する。
- 同一lane/build mode・同一fixture・同一capture profileのbaselineとcandidateを比較し、Lv1 3scenarioのinvocation当たり`kind: 'sync'`合計p95/最大と、baselineで50ms以上だった各stall-contributing stageのp95/最大がそれぞれ70%以上短縮する。baselineで50ms未満のstageには70%条件を課さず、candidateがbaselineを`max(5ms, 20%)`より大きく超えないことを確認する。各側の反復sample内ではartifact hashを固定し、baseline/candidateの異なるcode hashをreportで識別する。`wait` entryは別集計とする。
- CPU callbackからpresentation handoffまでに、同じtime originのLong Taskと重なる単一のapp-attributed `sync` sliceが250ms以上残らない。timer/Worker/animation wait、OS scheduling、background、DevTools pause、他process起因のraw Long Taskはこの判定へ混ぜない。
- Lv6のtotal think timeは`01-rulebook.md`の既存目安内を維持し、Worker待ちの間もRAF recorderが進む。
- active Pixi live render rateは毎秒65回以下（terminal explicit renderを別集計）で、既存ticker delta semantics、終端progress、terminal frameが一致する。
- 同一内容frameの再applyは`updatedViews = 0`、同一canvas geometryの再applyはphysical `resizeCount`を増やさない。
- consoleに`local_playback_manager_finalizer_unavailable`、writer/settlement error、unhandled rejectionがない。

#### reference環境のstrict gate

- visible/focusedで外部負荷を隔離した自動desktop captureに限り、Lv1 3scenarioのCPU callback開始からpresentation handoffまでにduration 50ms以上のapp-attributed Long Taskが0件。
- action中frame intervalのp95が`max(2 × nominal interval, 33.4ms)`以下、最大値が`max(3 × nominal interval, 50ms)`以下。
- 各CPU stageのp95は50ms未満、単発最大は100ms未満。
- 120/144/240Hzの物理または妥当性確認済みemulationで、animation完了時間は既存captureの許容範囲内かつ終端frameが一致する。

raw RAF interval、Long Task、Long Animation Frameは全sampleをreportへ保存するが、共有workstationでは診断値とし、外部負荷だけでreleaseを失敗させない。background/非表示/DevTools pauseはvalidity failureとして当該runを不採用にする。baseline/candidateはfixture digest、lane/build mode、capture order、device/profileを一致させ、artifact hashは各capture内の同一性確認と両code versionの識別に使う。

## 検証bundle

- CPU: `test/cpu-turn-card-phase.test.ts`、`test/cpu-turn-move-phase*.test.ts`、`test/cpu.decision.card-*.test.ts`、`test/cpu.turn-handler.commentary.test.ts`、delay/handoff tests
- playback: `test/ui.animation-engine.playback-state.test.ts`、`test/ui.presentation-handler.playback-claim.test.ts`、`test/ui.presentation-handler.strict-network.test.ts`、network parityの既存playback対象
- Pixi: `test/ui.pixi-application.test.ts`、`test/ui.pixi-board-scene.test.ts`、`test/ui.pixi-timeline.test.ts`、board backend/context recovery tests
- FPS: `test/ui.fps-display.test.ts`とmarkup/CSS contract
- boundary/build: `npm run check:window`、`npm run typecheck`、`npm run build:ts`、`npm run build:browser`
- browser: focused performance capture、`npm run match:pixijs-board-playback-check`、`npm run match:pixi-runtime-fallback-check`、必要に応じ`npm run match:cross-platform-smoke:vite`
- network/strict settlement: focused suites後に`npm run test:network:parity`
- mirror: `npm run worker:prepare`、`npm run check:worker-mirror`
- delivery: `git diff --check`、task-owned diff、生成物source一致、最終`git status --short`

## リスクと緩和

- feature-demand化で暗黙に参照されていたcontext fieldを計算しなくなる危険: 全card typeとfeature requirementのtable-driven testを作り、未計算fieldは従来default shapeを維持する。
- legal moves共有でcard用、placement用、commentary basicの条件差を消してしまう危険: pending/protection/blockerをidentity/inputへ含め、同値条件下だけ共通走査を許可する。既存generator結果一致をfixtureで確認し、不一致の用途は別field・別導出のままにする。
- 使用可否とcard context間のtarget再利用でselector laneを混同する危険: evidence keyへlocal/module/public lane、method、引数identityを含め、対応しないevidenceは再利用しない。
- stateVersionが無いローカル経路で古いanalysisを使う危険: 同期範囲だけ再利用し、非同期境界では無条件に破棄するfail-closed testを置く。
- typed settlement移行でstrict network recoveryを壊す危険: local、strict、watchdog、external abort、context recoveryを別contract testにし、no-op fallbackを禁止する。
- 60Hz上限で演出が遅くなる危険: progressは既存delta基準のままにし、Application/ticker adapterを通した60/144/240Hz相当入力でduration semanticsとterminal writeを比較する。
- signature分割で必要なskin/theme更新をskipする危険: viewごとのdependency listをtest fixture化し、DPR、orientation、font、board skin、stone skin、hint stateを個別に変更する。
- performance thresholdの環境差: 共有workstationではdeterministic契約、app-attributed 250ms ceiling、同一環境baseline比をblocking gateとし、raw RAF/Long Taskの厳格値は隔離reference環境へ限定する。
- instrumentation自体の負荷: explicit perf gate時だけ有効化し、通常pathではobserver未注入・buffer未生成とする。

## 完了条件

- CPU Lv1の石着手とカード使用の双方で、実測の約0.47〜0.67秒Long Taskがacceptance threshold内へ解消される。
- 無使用カード時の重いcard contextが0回になり、使用時も該当card typeに必要なfeatureだけを一度計算する。
- CPUのカード選択、move選択、pending/turn progression、発話、headless結果の既存testsが一致する。
- Lv1 delayがplayer-awareに0msとなり、debug/test overrideと他levelの既存挙動を維持する。
- `local_playback_manager_finalizer_unavailable`が再現せず、local/strict playbackのclaimとwriterがexactly onceでsettleする。
- Pixi active renderが60Hz以下に抑えられ、同一view/resizeの不要な再構築が発生しない。
- FPS overlayが平均FPSとsample内最大frame時間を表示し、OFF/background挙動を維持する。
- Single Visual Writer、network authority、ordered `events[]`、animation duration、DOM fallback exclusivityを回帰させない。
- focused tests、typecheck/build、browser performance capture、Pixi/browser checks、network parity、mirror checksが成功する。
- root sourceからbrowser/generated/mirror面が再生成され、task-owned変更だけがcommitされる。

## Self-review

- 初期案の「CPU処理を全部Workerへ移す」はauthorityとbrowser/headless parityの負担が大きいため退け、既存Dedicated Worker契約を広げずに無条件・重複計算を除く設計へ修正した。
- `noanim=1`でも停止する実測を反映し、Pixi 60Hz化だけを主解決にしなかった。
- Lv1で200ms timerが観測された点はframe停止とresponse delayを混同せず、別policy・別metricとして修正対象にした。
- card contextは単なるearly returnだけでなく、実際にカードがあるturnでも不要な全target getterが走る問題をcard-type別feature tableで解消した。
- renderingはscene apply自体を無理に省略するとsettlementを壊すため、controller/phase applyは維持し、view-local invalidationとphysical resize/render cadenceを最適化対象に限定した。
- finalizer欠落をno-opで隠さず、返却contractで全分岐を網羅する設計にした。
- FPS表示の追加文言だけをplayer-visible spec変更とし、CPU強さ・演出時間・演出順序は変更しないことを明記した。
- 独立reviewを受け、カード用・着手用・実況用の合法手を一つの配列へ統合する案を撤回し、同値条件下だけ共通走査する用途別derived resultへ修正した。
- 最終整合reviewを受け、一括完成analysisをやめ、usable 0件でcard derivationを呼ばないimmutable seed→必要用途だけの段階構築へ修正した。
- 最終整合reviewを受け、性能entryへ`correlationId`、`sync`/`wait`、timestamp rangeを追加し、Long Taskのapp attributionとblocking gateを機械判定可能にした。
- 最終整合reviewを受け、playbackの成功return、throw、strict cancel、empty payloadごとのresult個数とcleanup ownerをbranch matrixで固定した。
- 独立reviewを受け、identityへ`stateVersion`と`decisionEpoch`を追加し、stateVersion不明の非同期境界では再利用しないfail-closed契約へ修正した。
- 独立reviewを受け、strict成功settleとcancel/abort-finalizeを分離した識別union、Application/ticker adapter境界の60Hz検証、共有workstationと隔離reference環境を分けた性能gateへ修正した。
- FPSの`MAX`は累積値ではなく500ms sample窓内の最大RAF間隔であり、初回/background復帰timestampを除外することまで定義した。

## 2026-07-21 実GPU再検証フォローアップ

- Status: implemented and verified

### 結論の修正

既存修正後の現行HEADを再計測した結果、CPUがカードを使う、または石を置くたびにゲームロジックが50ms以上メインスレッドを占有する、という説明は現時点では成立しない。RTX 2070 / ANGLE D3D11の実GPU経路で5シナリオを各3回、合計15回計測したところ、Long Taskは全件0、CPU同期処理は約6〜16ms、初回warmup後の最大RAF間隔は通常着手・Lv6で約16.8ms、カード演出で主に約16.8〜33.4msだった。

一方、従来の相手アクション性能captureが使う既定Playwright ChromiumはANGLE SwiftShaderで、Pixi経路に限って約50〜66msのLong Taskを再現した。traceでは`FireAnimationFrame`約29msに加えてPrePaintと`GLES2::ReadPixels`待ち約21msが同じtaskへ含まれた。同じSwiftShader環境でDOM compatibilityを使うと10回すべてLong Task 0だった。したがって残存問題は次の二つへ分離する。

1. 通常起動で明示的なソフトウェアWebGLをPixi正常系として選び、CPU処理と無関係なGPU/ReadPixels待ちを相手アクションの瞬間へ重ね得る。
2. 性能captureがソフトウェアWebGLを実機GPU性能として扱い、raw RAF/Long Taskをアプリ固有の退行と誤認し得る。

画面のFPS表示はブラウザ`requestAnimationFrame` callback頻度であり、Pixiの実render回数やGPUだけのFPSではない。240Hz表示で約220を示す値と、別ゲームの内部FPS 300は同じ計測対象ではない。現行Pixiはactive playbackのprivate tickerを60Hz以下に制限し、idle時は停止するため、この表示差だけを定常負荷の証拠にはしない。

### 対象と非目標

- 対象: 通常起動時のPixi初期capability判定、明示的software WebGLからDOM compatibilityへの排他的fallback、Pixi ApplicationのGPU選好、desktop性能captureのGPU妥当性確認、分類契約とbrowser fallbackの回帰検証。
- 非目標: CPU選択、カード効果、turn order、animation duration、Single Visual Writer、FPS表示仕様、60Hz ticker上限、ネットワークauthorityの変更。
- `01-rulebook.md`と`正本/*.md`は変更しない。描画backendのcapability選択は内部品質契約で、盤面の意味・入力・演出順を変えない。

### 選択した設計

#### 1. software WebGL分類をportable helperへ一元化する

`shared/webgl-renderer-classification.ts`を追加し、renderer/vendor文字列だけから明示的software rendererかを判定する純粋関数を持たせる。SwiftShader、llvmpipe/softpipe、`software rasterizer`、Microsoft Basic Render Driverをsoftwareとして分類し、不明・空文字・一般的なANGLE文字列はhardwareと断定せず`unknown`相当の非softwareとして扱う。

このhelperはDOM、`window`、Playwright、Pixiへ依存しない。browser runtimeのWebGL context情報とNode captureのCDP SystemInfoが同じ分類規則を利用し、regexのdriftを防ぐ。

#### 2. 通常Pixi mountをcapability gateにする

`ui/pixi/board-backend.ts`はApplication mount後、scene/texture/input/playback生成前にWebGL contextを確認する。`WEBGL_debug_renderer_info`が使える場合はunmasked renderer/vendorを読み、使えない場合は標準`RENDERER`/`VENDOR`へ限定的に戻す。明示的softwareと分類できた場合は`pixi_software_webgl_renderer`を`stage: webgl`かつcompatibility fallback eligibleな初期化失敗として返す。

不明なrendererをsoftwareと推測してfallbackしない。拡張非対応、privacy制限、文字列取得失敗はPixi継続とし、誤判定で正常なGPUをDOMへ落とさない。失敗mountは既存`cleanupOwnedResources()`でcanvas/context/cameraを破棄してから、controllerがDOM backendを排他的にmountするため、二重writer・二重canvasは作らない。

`debug=1&boardRenderer=pixi`という明示的debug選択だけはsoftware Pixiを許可する。これはSwiftShaderしかないCIでPixi固有のplayback/testを継続するための診断escape hatchであり、通常URLには適用しない。normal pathと性能captureはこの例外で成功扱いにしない。

#### 3. Pixi Applicationは高性能GPUを選好する

`ui/pixi/application.ts`の既存WebGL固定optionへ`powerPreference: 'high-performance'`を追加する。これはOS/ブラウザへの選好であり、hardware利用の保証には使わない。実際のrenderer分類が最終gateである。

#### 4. desktop性能captureはhardwareを証明してから測る

`scripts/browser-performance-environment.ts`へdesktop Chromium起動option、CDP SystemInfo正規化、graphics environment読取を集約する。Windowsでは既存どおりANGLE D3D11を要求し、他platformでは既定起動後の実情報を検査する。

`capture-pixijs-playfield-performance.ts`と`perf/measure-opponent-action-frame-stall.ts`は同じhelperを使い、`hardwareAccelerated !== true`ならrenderer名を含む明示的な失敗にする。相手アクションreportはschema v2とし、必須の`capture.graphics`へsanitized graphics情報を保存する。baseline/candidate比較はhardware証拠とrenderer/vendor/display typeの一致を要求し、旧schemaやsoftware captureを性能baselineとして再利用しない。raw RAF/Long Taskはhardware証明済みcaptureだけを性能根拠にする。

Pixi固有browser checkは明示的debug Pixi選択を維持するため、software CIでもrendererロジック自体を検証できる。runtime fallback checkには通常選択かつsoftware rendererのシナリオを追加し、DOMへ排他的に切り替わることを確認する。

### 代替案と不採用理由

- Pixiを全環境で無効化する: hardware経路ではstallを再現せず、通常backendと演出品質を不必要に失うため不採用。
- softwareでもPixiのantialiasやresolutionだけを下げる: traceのReadPixels/compositor待ちを確実に除けず、端末依存の調整を正常系へ増やすため不採用。
- user agentやGPU vendor名で判定する: renderer実体と一致せず、remote desktopやhybrid GPUで誤判定するため不採用。
- capture側だけ直す: 測定誤認は防げるが、実ユーザーのhardware acceleration無効・remote/driver fallback時の瞬間停止を残すため不採用。
- software判定時にPixi phaseの途中だけDOM描画する: Single Visual Writer、ordered playback、settlementを破るため禁止。

### 失敗・復旧契約

- software判定は初期mount中だけ行い、canonical game stateやpresentation eventを消費する前に失敗する。
- `pixi_software_webgl_renderer`は既存のruntime/WebGL/Application初期化失敗と同じcontroller fallback transactionへ入る。
- mount失敗時はPixi資源を全破棄し、hostのrenderer属性をDOMへ切り替えた後でcompatibility backendをmountする。
- debug強制Pixiを除き、software rendererを検出したのにfallbackできない場合は成功形へ隠さずreadyをrejectする。
- runtime中のcontext lossは既存recovery/fallback契約を変更しない。GPUが途中でsoftwareへ変わるケースを新しいpollingや第二clockで監視しない。

### 検証と完了条件

- 分類helperのtable testでSwiftShader/llvmpipe/software rasterizer、hardware ANGLE、空・不明値を固定する。
- Pixi backend testでsoftware WebGLはscene生成前にfallback eligible errorとなり、hardware/unknownは従来mountを継続し、debug overrideは明示時だけ許可される。
- board renderer selection testで通常選択と明示的debug Pixiのoption伝播を固定する。
- Application testで`powerPreference: high-performance`を固定する。
- capture helper testでWindows D3D11 option、hardware/software判定、CDP environmentのreport付与を固定する。
- software Chromiumの通常URLがDOM backendでreadyになり、canvas/contextとDOM cellsが同時に残らない。
- 実GPUの相手アクションquick captureで全scenarioの有効sampleを取得し、Long Task 0、console/page error 0、hardware environmentがreportへ記録される。
- focused Jest、`check:window`、typecheck、browser build、Pixi playback/fallback check、Worker mirror生成を通し、task-owned diffだけをcommitする。

### フォローアップSelf-review

- 最初のraw RAF 50〜66msを現行ゲームの回帰と断定せず、CDP traceとSystemInfoでSwiftShaderの`ReadPixels`待ちへ帰属させ、実GPU15回・software DOM 10回との反証比較を追加した。
- hardwareでLong Task 0だったため、CPUロジックをさらに分割・Worker化する案を撤回した。選択結果やauthorityを動かさず、観測された残存原因だけを修正対象にした。
- softwareを一律「低性能GPU」と推測せず、明示文字列に限定したfail-safe分類にした。不明値はPixi継続とし、privacy制限下の誤fallbackを避けた。
- captureとruntimeで別regexを持つ案を撤回し、portable helperへ一元化した。
- software Pixiを完全禁止するとCIのPixi固有検証を失うため、明示的debug選択だけのescape hatchを設けた。通常起動と性能証拠には使えない境界を明記した。
- fallbackをactive phase内に入れず、scene生成前のmount capability failureへ置いたため、Single Visual Writerとsettlement順を維持できることを確認した。
- `powerPreference`だけではhardwareを保証しないため、runtime実体判定とcaptureのCDP検証を別々の必須条件にした。
