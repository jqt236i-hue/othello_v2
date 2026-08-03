# 対局中ランタイム・ホットパス最適化 実装計画

## 文書情報

- 状態: 未実装
- 作成日: 2026-08-04
- 設計正本: `docs/implementation/in-game-runtime-hot-path-optimization-design.md`
- 内部契約: `docs/architecture-contracts.md`
- プレイヤー向け仕様: `01-rulebook.md`、`正本/演出正本.md`、`正本/ターン進行正本.md`、`正本/共通ルール正本.md`

## 1. 実装方針

6領域を一括で変更しない。低リスクで依存の少ないO(1) queryとfingerprintから始め、静的paint境界を作った後にsource trajectoryを移行する。入力・カメラ、client snapshot、versioned wire compactionは、それぞれ独立した検証・commit・rollback境界を持たせる。

プレイヤー向け仕様を変えないため、通常は `01-rulebook.md` と `正本/` を編集しない。実装中に現状と正本の矛盾を見つけた場合は作業を止め、仕様変更と最適化を同じcommitへ混ぜない。

root sourceが正本である。`dist/`、`public/module-registry.js`、`worker-public/` は手編集せず、最後に既存generatorから更新する。依存追加は行わない。

## 2. 実装前の固定条件

### 2.1 着手前確認

1. `git status --short` で別タスクの変更がないことを確認する。
2. 既存の関連変更がある場合はdiffを分類し、上書きしない。
3. 次の既存設計の完了状態を確認する。
   - `docs/implementation/pixijs-board-source-trajectory-design.md`
   - `docs/implementation/network-presentation-continuity-repair-design.md`
   - `docs/implementation/non-cpu-runtime-performance-remediation-design.md`
4. `npm run check:window` とheadless境界検索を実行し、開始時点の違反を記録する。
5. performance測定は同一browser、同一DPR、同一viewport、同一fixture、foreground tabで行う。

### 2.2 変更禁止事項

- `events[]`、phase、actionId、target gate、sound/log、duration、settlement順を変更しない。
- renderer quality、線数、対象数、演出FPS、解像度を下げない。
- 2つ目のPixi application/canvas/context/tickerを作らない。
- normal Pixi pathからDOM互換boardへeffect単位でfallbackしない。
- client snapshot、preview、cacheをgameplay authorityにしない。
- journal frameを参照形式へ変えない。
- broad catch、silent no-op、timeout成功扱いを追加しない。

## 3. Phase 0: Baselineとcharacterization

### 3.1 作業

- [ ] `test/ui.pixi-source-trajectory.test.ts` の既存profile fixtureを、固定progress点のsemantic baselineとして整理する。
- [ ] source trajectoryのprofileごとに、始終点、clip bounds、line/circle/polygon count、layer style、dynamic transformを採取するtest helperを追加する。
- [ ] debug/test injection時だけ、clip回数、descriptor生成数、Graphics clear/draw回数、static prepare回数、scalar apply回数を数えられるようにする。normal-playではhook lookupをtick loopへ残さない。
- [ ] full diagnostics呼出し、stone/effect static repaint、cell fingerprint visit、hit-test、camera render、snapshot clone/inspectionをspy可能にする。
- [ ] `ui/board-visual/performance-harness.ts` と `scripts/perf/ux-optimization-browser-probe.ts` の既存debug経路へ、8対象lightning、high-polling pointer、camera burst、large snapshotのfixture modeを追加する。
- [ ] representative legacy network payloadをblack/white/spectatorごとにJSON byte、frame count、snapshot count、playback countで記録する。
- [ ] baseline artifactへcommit SHA、browser version、DPR、viewport、sample count、有効/無効sample理由を保存する。

### 3.2 Baseline scenario

| ID | scenario | 記録する値 |
| --- | --- | --- |
| R1 | 8対象lightning | descriptor/clip/clear、JS self time、allocation、RAF gap |
| R2 | beam / fire / water / grass | static drawとtick draw、duration、pixel ROI |
| R3 | bite / suction / projectile | static drawとtick transform、target gate、pixel ROI |
| R4 | ghost/effectのalpha/scale animation | stone prepare、Graphics clear、Text style、RAF gap |
| F1 | 16x16 + 拡張盤frame compose | cell sort/visit、serialize time、revision結果 |
| I1 | 1000Hz相当pointermove burst | raw event、hit test、dispatch trace、longpress result |
| C1 | ResizeObserver/scroll/visualViewport burst | refresh callback、scene apply、renderer render、最終geometry |
| N1 | large accepted snapshot | board inspection、clone byte、freeze、intake time、hash/result |
| N2 | late special-card live envelope | legacy byte、duplicate playback byte、duplicate snapshot byte |

### 3.3 Checkpoint

- baselineだけでplayer behaviorを変えない。
- 約44,000 descriptor/秒はstatic estimateとして残し、R1の実測と混同しない。
- invalid sampleを成功件数へ含めない。

## 4. Phase 1: Operational Query API

### 4.1 変更対象

- `ui/pixi/board-scene.ts`
- `ui/pixi/board-playback.ts`
- `ui/pixi/effects/source-trajectory.ts`
- `ui/pixi/timeline.ts`
- `ui/pixi/board-backend.ts`
- `test/ui.pixi-board-scene.test.ts`
- `test/ui.pixi-board-playback.test.ts`
- `test/ui.pixi-timeline.test.ts`
- `test/ui.pixi-board-backend.test.ts`

### 4.2 作業

- [ ] sceneへ `isPlaybackScopeActive(scopeKey)` を追加し、active scope fieldを直接比較する。
- [ ] timelineへ `hasActiveRuns()` / `getActiveRunCount()` を追加する。
- [ ] playbackへ必要最小限のoperational queryを公開し、backendがtimeline diagnostics shapeを読まないようにする。
- [ ] scope cleanup、late callback、trajectory release、abort、active-run待機の分岐をoperational APIへ置換する。
- [ ] full `getDiagnostics()` は明示diagnostics/test用として維持する。
- [ ] stale scope releaseが新scopeを解放しないこと、scope replacement中のlate callbackがno-opになることをtestする。
- [ ] normal playback fixtureでfull diagnostics spyが0回であることをtestする。

### 4.3 Checkpoint

- full diagnosticsの戻りshapeは既存test/debug consumer向けに維持する。
- playback/order/settlementの既存testが無変更で通る。
- このphaseは描画primitiveやtimingを変更しない。

## 5. Phase 2: Board Model Fingerprintの1-pass化

### 5.1 変更対象

- `ui/board-visual/frame-presenter.ts`
- `test/ui.board-visual-frame-presenter.test.ts`
- 必要なら新規 `test/ui.board-visual-frame-presenter-hot-path.test.ts`

### 5.2 作業

- [ ] `modelFingerprint()` と `modelInteractionFingerprint()` の共通入力を `modelFingerprints()` へ統合する。
- [ ] topology key配列はmodelでcanonical化済みのものを再sortせず使う。
- [ ] cellsだけをkey順に1回sortし、同じloopでvisual/interaction descriptorを作る。
- [ ] exact stable stringを維持し、非暗号hashへ置換しない。
- [ ] frozen model identityをkeyにするWeakMap cacheを追加する。
- [ ] `compose()` が作るrevision付きmodelへ同じfingerprint pairを関連付ける。
- [ ] frameToken、renderSessionId、revision fieldの除外契約を維持する。

### 5.3 Test matrix

- [ ] cell順だけが異なる等価modelで同じrevisionになる。
- [ ] visualSignature変更でvisual revisionが進む。
- [ ] hintInputSignature / expansionSide変更でinteraction revisionが進む。
- [ ] topology、viewer、currentPlayer、control可否の各変更が正しいchannelを進める。
- [ ] 同一modelの再composeはcell getter/visitが0回になる。
- [ ] 新modelのsortは1回、fingerprint loopのcell visitは1回になる。
- [ ] cycle/function/symbol descriptorの既存fail-closed behaviorを維持する。

### 5.4 Checkpoint

- 現行fixtureのrevision sequenceをbefore/afterで完全一致させる。
- 同一revision idle frame抑止の既存契約を壊さない。

## 6. Phase 3: Static PaintとDynamic Transformの分離

### 6.1 変更対象

- `ui/pixi/stone-view.ts`
- `ui/pixi/board-scene.ts`
- `ui/pixi/pools.ts` または既存pool型定義
- 新規 `test/ui.pixi-stone-view.test.ts`
- `test/ui.pixi-board-scene.test.ts`
- `test/ui.pixi-board-playback.test.ts`

### 6.2 stone / ghost

- [ ] stone view内部を `prepareStaticVisual()` と `applyTransform()` に分ける。
- [ ] 既存 `update()` は両者を呼ぶcompatibility wrapperとして維持する。
- [ ] static signatureからsceneX/Y、animation alpha/scale/rotationを除外する。
- [ ] cell visual、stone/marker、cellSize、theme、appearance、texture/context generationをstatic signatureへ含める。
- [ ] playback stone ghostとmarker ghostは、同じstatic signature中にtransformだけを適用する。
- [ ] pool reacquire時にprevious ownerのsignatureを誤再利用しない世代keyを入れる。

### 6.3 playback effect

- [ ] effect recordへpaint signature/revisionを追加する。
- [ ] `drawPlaybackEffect()` をstatic paint関数とtransform関数へ分割する。
- [ ] label Text styleはpaint key変更時だけ設定する。
- [ ] alpha/scale/rotation/position/visibleだけのupdateではGraphics clear/drawを行わない。
- [ ] cellSize/theme/appearance/context restoreで必ずrepaintする。

### 6.4 Test matrix

- [ ] transform-only 120 tickでstone prepare、effect Graphics clear、Text style assignが0回である。
- [ ] 各invalidation fieldを1つずつ変えるとちょうど1回repaintする。
- [ ] pool reuse、scope abort、context restoreで古いowner/styleを残さない。
- [ ] fixed keyframeでghost/effect position/alpha/scaleがbaselineと一致する。

### 6.5 Checkpoint

- 通常stone renderingの既存view diagnosticとvisual fixtureが一致する。
- static cacheはpresentation cacheに閉じ、modelやgame stateを書き換えない。

## 7. Phase 4: Prepared Source Trajectory Render Plan

### 7.1 変更対象

- 新規 `ui/pixi/effects/source-trajectory-render-plan.ts`
- `ui/pixi/effects/source-trajectory.ts`
- `ui/pixi/board-scene.ts`
- 必要に応じて `ui/pixi/timeline.ts`
- `test/ui.pixi-source-trajectory.test.ts`
- 新規 `test/ui.pixi-source-trajectory-render-plan.test.ts`
- `test/ui.pixi-board-scene.test.ts`
- `test/ui.pixi-board-playback.test.ts`
- `test/e2e/special_effects.e2e.test.ts`

### 7.2 共通plan compiler

- [ ] easing/keyframeを開始時にparseし、profileごとのsamplerを作る。
- [ ] geometry snapshotとclip rectからstatic geometryをcompileする。
- [ ] immutable static planとview-owned mutable scalar stateを分ける。
- [ ] `sampleInto(progress, target)` は配列/object/freezeを行わず、有限数のscalarを書くだけにする。
- [ ] planへgeometry/render-session/context generationを記録する。
- [ ] invalidation時は現在timeline progressを保ったままplan/viewを一度作り直す。

### 7.3 profile移行順

profileは次の順で1つずつ移行し、各profileのbaseline比較を通してから次へ進む。

1. [ ] projectile
2. [ ] suction
3. [ ] lightning
4. [ ] beam
5. [ ] fire / water / grass beam variant
6. [ ] bite

lightningではmain 4層・branch 3層をprepare時に固定Graphicsへ描く。beamとbiteではfull shape + reveal maskを第一実装とし、baseline pixel/semantic差が出る場合はsegment container方式へ切り替える。見た目を近似して完了扱いにしない。

### 7.4 scene API

- [ ] acquire時にstatic planを受けてGraphics/Sprite/Maskを準備する。
- [ ] tick APIをscalar state適用へ限定する。
- [ ] `drawSourceTrajectoryVisual()` のtick-time clear/redraw経路を削除する。
- [ ] pool releaseでmask、visibility、alpha、transform、plan generationを初期化する。
- [ ] child add/remove/sortをtick loopから除去する。

### 7.5 timeline補助整理

- [ ] trajectory移行後のprofileでtimeline自身の `Array.from(activeRuns)` / filter captureが残存上位なら、同じtick semanticsを保つsingle-pass iterationへ変更する。
- [ ] iteration中のcancel/add、deadline、settlement orderをcharacterization testで固定する。
- [ ] 計測で上位でない場合はこの補助変更を行わず、scopeを広げない。

### 7.6 Test matrix

- [ ] progress `0, 0.1, 0.25, 0.5, 0.75, 0.9, 1` の全profile semantic digestがbaselineと一致する。
- [ ] 画面内、sourceのみ画面外、targetのみ画面外、両方画面外、拡張盤scrollのclip/target gateが一致する。
- [ ] desktop/mobile、black/white orientation、DPR差でROI visual regressionを通す。
- [ ] 8対象を50回繰り返してpool、lease、display child、maskが増えない。
- [ ] context loss/restore、abort、scope replacementでsound/log/eventを再発火しない。
- [ ] duration、impact開始時点、結果表示、input unlock、visual settlementがbaselineと一致する。
- [ ] steady tickのclip/descriptor/static clear countが0である。

### 7.7 Checkpoint

- R1～R4を再測定し、profile別にbaseline/candidateを保存する。
- 1profileでもplayer-visible差が残れば、そのprofileの移行をrollbackし、他profileと分離して報告する。

## 8. Phase 5: Input Hot Path

### 8.1 変更対象

- `ui/board-input-controller.ts`
- `ui/pixi/board-input.ts`
- `test/ui.board-input-controller.test.ts`
- `test/ui.pixi-board-input.test.ts`
- `test/e2e/board-input-backends.e2e.test.ts`

### 8.2 hit-test projection

- [ ] `syncModel()` でinteractive key set、anchor、row/column reference、fallback key listを1回作る。
- [ ] `layoutRevision` ごとにanchor/reference rectとrow/column pixel stepをlazy cacheする。
- [ ] hot pathを座標逆算、key lookup、candidate rect確認へ限定する。
- [ ] affine projectionが成立しない場合だけcached fallback geometryを走査する。
- [ ] modelCommitId、boardDigest、layoutRevision、interactive state変更でcacheを破棄する。
- [ ] hit result objectの既存readonly contractを維持する。allocationがprofile上位ならcell単位のfrozen hit resultをprojectionへcacheする。

### 8.3 pointermove coalescing

- [ ] pointerIdごとのlatest move slotと1本のrAFを追加する。
- [ ] move burstでは最新sampleだけをhit testし、active press moveとhoverを更新する。
- [ ] pointerup/upoutside/cancel/leave/destroy前に同pointerのpending moveをflush/cancelする。
- [ ] pointerdownとterminal eventは同期のままにする。
- [ ] 既存layout retryとmove rAFを別stateとして管理する。
- [ ] native/federated二重event、preventDefault、touchAction、cursor、destroy cleanupを維持する。

### 8.4 Test matrix

- [ ] 100 moveを1 frameへ送るとhit/hover updateは1回、最新座標が採用される。
- [ ] move→upが同frameでもdrag/longpress cancellationとrelease cellがbaselineと一致する。
- [ ] mouse/touch、pointerupoutside、cancel、leave、destroyをevent trace比較する。
- [ ] 4x4、16x16、円形、穴、拡張負座標、回転、scrollで全interactive cell中心をhitできる。
- [ ] cell境界の半開区間判定が既存と一致する。

### 8.5 Checkpoint

- action dispatch trace、hover trace、blocked notification、longpress resultをbaselineと完全一致させる。
- DOM互換backendのinput contractは変更しない。

## 9. Phase 6: Camera Event Coalescing

### 9.1 変更対象

- `ui/pixi/camera.ts`
- `ui/pixi/board-backend.ts`
- `test/ui.pixi-camera.test.ts`
- `test/ui.pixi-board-backend.test.ts`
- context recovery関連test

### 9.2 作業

- [ ] event listener専用のpending refresh rAFを追加する。
- [ ] scroll、ResizeObserver、visualViewport resize/scrollを同じpending refreshへ集約する。
- [ ] explicit `sync()` / `refresh()` は同期のまま維持し、pending event refreshとの重複を安全にcancel/consumeする。
- [ ] layout/canvas viewport比較を `none` / `client-only` / `render-space` へ分類する。
- [ ] `none` ではstyle write、callback、renderを行わない。
- [ ] `client-only` ではcamera geometryとbackend current frame layoutだけを更新する。
- [ ] `render-space` では従来のresize/apply/renderを1回行う。
- [ ] style width/height/left/topは値が変わる場合だけwriteする。
- [ ] pending rAFをdestroyでcancelする。

### 9.3 Test matrix

- [ ] 1 frame内の異種event burstが1 refreshになる。
- [ ] unchanged layoutでcallback/render/style writeが0になる。
- [ ] client originだけの移動でcell client rectが更新され、renderer.renderは0になる。
- [ ] DPR、cellSize、scroll、viewport/canvas寸法、orientation、frame inset変更でrender-spaceになる。
- [ ] explicit syncはevent rAFを待たず同期完了する。
- [ ] callback/render errorはplayback abortへ伝播し、成功扱いにならない。
- [ ] context restore、topology expansion、orientation changeの既存testが通る。

### 9.4 Checkpoint

- C1の最終layout、cell rect、canvas size、scene projectionをbaselineと一致させる。
- full render回数がrender-space change数を超えない。

## 10. Phase 7: Client Snapshot CPU最適化

### 10.1 変更対象

- `ui/network/snapshot-canonical.ts`
- `ui/network/snapshot.ts`
- `ui/network-client.ts`
- `ui/network/visual-state-store.ts` はcontract test中心。ownership変更はしない
- `test/ui.network-snapshot-canonical.test.ts`
- `test/ui.network-snapshot.single-writer-baseline.test.ts`
- `test/ui.network-visual-state-store.test.ts`
- `test/ui.network-visual-state-store-readonly.test.ts`
- `test/ui.network-client.publish-base-version.test.ts`
- `test/ui.network-client.apply-coordinator.test.ts`
- `test/ui.network-client.multi-stage-selection.test.ts`

### 10.2 accepted snapshot preparation

- [ ] cheap authority envelope inspectorを追加し、authority/projection/own-hand/version metadataだけを検査する。
- [ ] stale/version gateをdeep board validationより前へ置く。
- [ ] accepted candidateを1回cloneする。
- [ ] clone上でboard contractを1回検査し、transient queue除去とcharge正規化を行う。
- [ ] prepared resultにmeta/version/strip summaryを含め、apply側でraw snapshotを再参照しない。
- [ ] clone/inspection/sanitize失敗をrejectし、raw object適用へfallbackしない。

### 10.3 previous projectionとstate mirror

- [ ] apply前にprevious board geometry、charge values、transient queues、busy/playback stateだけをcaptureする。
- [ ] strict base visual snapshotが未設定の境界だけfull base copyを作る。
- [ ] 通常継続frameのfull previous `gameState` / `cardState` cloneを除去する。
- [ ] `authoritativeMatchState.gameState/cardState` を `authoritativeTurnIndex` scalarへ置換する。
- [ ] `getCurrentPublishTurnIndex()` をscalar + live valueへ更新する。
- [ ] create/join/reset/leave/reconnect/session epoch cleanupを新shapeへ更新する。
- [ ] global置換用copyとvisual-state-store copy-on-commit/deep-freezeは維持する。

### 10.4 Test matrix

- [ ] stale snapshotはdeep board inspectorを呼ばない。
- [ ] accepted snapshotはclone対象boardを1回だけinspectする。
- [ ] malformed board、projection mismatch、own-hand hidden、missing versionを従来どおりrejectする。
- [ ] charge delta synthesis、geometry change telemetry、transient queue reconciliationが一致する。
- [ ] canonical/visual snapshot ownership、readonly peek、commit receipt、visualSeq順序を維持する。
- [ ] authoritativeTurnIndexとlive turnIndexの最大値がpublishへ使われる。
- [ ] reset/leave/session epoch変更後に旧turn/hashを再利用しない。
- [ ] pending selectionのaction identity、stage、対象、publish signalがsnapshot適用前後で一致する。
- [ ] N1のcanonical snapshot digest、projected hash、UI result、settlementがbaselineと一致する。

### 10.5 Checkpoint

- network wire shapeはこのphaseでは変更しない。
- client intakeだけをrollbackできるcommitにする。

## 11. Phase 8: Versioned Presentation Envelope V2

### 11.1 変更対象

- 新規 `shared/network-presentation-envelope.ts`
- `shared/network-presentation-frame.ts`
- `ui/network/intake-envelope.ts`
- `ui/network/intake-coordinator.ts`
- `ui/network/stream-session.ts`
- `ui/network/transport.ts`
- `ui/network/publish-flow.ts` またはpublish body構築の正本箇所
- `ui/network-client.ts`
- `workers/match-worker-types.ts`
- `workers/match-worker-publish-controller.ts`
- `workers/match-worker-broadcast-controller.ts`
- `workers/match-worker-stream-route-controller.ts`
- `workers/match-worker-stream-controller.ts`
- `workers/match-worker.ts`
- `scripts/local-match-server.ts`
- `utils/match-authority/publish.ts` はpayload正本との整合が必要な場合だけ変更

### 11.2 shared schema/helper

- [ ] `PRESENTATION_ENVELOPE_VERSION = 2` を定義する。
- [ ] capability値を2またはlegacyへ正規化するpure helperを作る。
- [ ] viewer payloadをV2へcompactするpure helperを作る。
- [ ] frame snapshotとenvelope snapshotのroom/version/hash/projection一致判定を1箇所へ置く。
- [ ] V2 referenceをfull frameへresolveするpure helperを作る。
- [ ] compact前のinput objectとjournal entryをmutationしない。
- [ ] compactorはenvelopeと変更frameだけをshallow copyし、省略するfull snapshot/playbackをdeep cloneしない。

### 11.3 client opt-inとresolve

- [ ] publish bodyへ `presentationEnvelopeVersion: 2` を追加する。
- [ ] capabilityは `ui/network/transport.ts` のwire boundaryで付与し、action schema、baseVersion、turnIndex、pending selection payload、operationId digestへ混ぜない。
- [ ] EventSource URLへ同queryを追加する。
- [ ] old serverがfieldを無視してlegacyを返す場合も正常に処理する。
- [ ] intake envelopeがV2 referenceをcanonical frame normalize前にresolveする。
- [ ] unknown version、reference without V2、hash/version/room/projection mismatchをrejectし、state-sync/journal recoveryを起動する。
- [ ] resolve後は既存frame shapeだけを下流へ渡す。

### 11.4 Worker

- [ ] publish request capabilityをresponse builderまでthreadする。
- [ ] operation/idempotency cacheにはfull canonical resultを保持し、cache hit後にrequest capability別deliveryへ変換する。
- [ ] full legacy publish payloadを先に構築し、requestがV2の時だけdelivery copyをcompactする。
- [ ] black/white/spectator別publish artifactをjournal/buffer、publish response、SSE deliveryで再利用し、viewer projectionを経路ごとに再計算しない。
- [ ] stream URL capabilityを `MatchWorkerSseStreamInfo` へ保存する。
- [ ] SSE buffer/persisted recordはfull viewer payloadのまま保持する。
- [ ] live broadcastとbuffer replayのwrite直前にstream capability別にcompactする。
- [ ] idempotent replayでもrequest capabilityに応じたwire shapeを返し、operation resultは変えない。

### 11.5 local server

- [ ] Workerと同じshared helper、capability parse、delivery順を使う。
- [ ] `room.streams` entryへversionを保存する。
- [ ] live/replay write直前だけcompactし、room/journal/bufferをfullのままにする。
- [ ] local固有の独自reference検査を作らない。

### 11.6 protocol delta

| surface | legacy | V2 |
| --- | --- | --- |
| publish request | fieldなし | `presentationEnvelopeVersion: 2` |
| stream URL | queryなし | `presentationEnvelopeVersion=2` |
| top-level playback | framesと重複し得る | valid framesがあれば省略 |
| frame snapshot | full `snapshotAfter` | exact一致時だけ `snapshotAfterRef` |
| journal storage/GET | full | 常にfull。V2化しない |
| unknown capability | legacy response | legacy response |

### 11.7 Test matrix

- [ ] shared helperのfull→compact→resolveがsemanticに同一で、inputをmutationしない。
- [ ] exact version/hash/room/projection一致時だけreference化する。
- [ ] latest以外のhistorical frameは必要ならfull snapshotを保持する。
- [ ] legacy publish/stream payload fixtureが従来shapeと一致する。
- [ ] V2 publish response、SSE live、SSE buffered replayが解決後に同じframe digestになる。
- [ ] journal GETがV2 clientに対してもfull self-contained frameを返す。
- [ ] black/white/spectatorのhidden-hand projectionを跨いでreferenceしない。
- [ ] idempotent publish replay、operationId、stateVersion、projected hashが一致する。
- [ ] version conflict retryとpending selection deferred publishでもcapabilityはwire boundaryから再付与され、canonical command body/digestは変わらない。
- [ ] session epoch変更後のstale stream payloadを適用しない。
- [ ] malformed refはlatest snapshot推測へfallbackせずrecoveryする。
- [ ] Worker/local parityを同fixtureで通す。

### 11.8 Checkpoint

- N2でlegacy/V2 byte数とsemantic digestを保存する。
- Worker supportを先にdeploy可能なcommit、client advertisementを後にdeploy可能なcommitへ分ける。
- legacy path削除はこの計画の対象外とする。

## 12. Phase 9: Architecture文書・生成・統合検証

### 12.1 文書

- [ ] `docs/architecture-contracts.md` 7.3へoperational query、static/dynamic paint、prepared trajectory、camera change分類を追記する。
- [ ] network sectionへaccepted snapshot single preparation、V2 envelope negotiation、journal self-contained契約を追記する。
- [ ] player-visible仕様に差がないことを再確認し、`01-rulebook.md` と `正本/` を変更しない。
- [ ] 実測値、未達項目、残存riskを本計画末尾の実装結果へ追記する。

### 12.2 生成

- [ ] focused test完了後に `npm run build:browser` を実行する。
- [ ] Worker/local/shared変更後に `npm run worker:prepare` を実行する。
- [ ] `public/module-registry.js`、browser bundle/cachebuster、`worker-public/` は生成結果だけを確認する。
- [ ] generated/mirror差分をsource差分と照合する。

### 12.3 統合browser scenario

- [ ] 通常配置、beam、lightning 8対象、bite、ghost/effect、盤面拡張を1対局内で再生する。
- [ ] animation中にpointer move、resize、visualViewport shiftを発生させ、見た目とsettlementを確認する。
- [ ] local networkでblack/white、spectator、reconnect、journal recovery、終局resultを確認する。
- [ ] legacy/V2接続を同roomへ混在させ、同じcanonical/visual結果になることを確認する。
- [ ] context loss/fallback smokeを実行する。

## 13. 検証コマンド

実装中は各phaseの最小testから始める。最終候補では次を実行する。

```powershell
npx jest --runInBand test/ui.pixi-source-trajectory.test.ts test/ui.pixi-source-trajectory-render-plan.test.ts
npx jest --runInBand test/ui.pixi-board-scene.test.ts test/ui.pixi-board-playback.test.ts test/ui.pixi-timeline.test.ts test/ui.pixi-board-backend.test.ts
npx jest --runInBand test/ui.board-visual-frame-presenter.test.ts test/ui.board-visual-frame-presenter-hot-path.test.ts
npx jest --runInBand test/ui.pixi-stone-view.test.ts test/ui.pixi-board-input.test.ts test/ui.board-input-controller.test.ts test/ui.pixi-camera.test.ts
npx jest --runInBand test/ui.network-snapshot-canonical.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts
npx jest --runInBand test/ui.network-intake-envelope.test.ts test/ui.network-intake-coordinator.test.ts test/ui.network-visual-state-store.test.ts test/ui.network-visual-state-store-readonly.test.ts
npx jest --runInBand test/shared.network-presentation-frame.test.ts test/shared.network-presentation-envelope.test.ts
npx jest --runInBand test/utils.match-authority.presentation-journal.test.ts test/utils.match-authority.publish-artifacts.test.ts test/utils.match-authority.publish-response.test.ts
npx jest --runInBand test/local-match-server.publish-contract.test.ts test/local-match-server.presentation-journal.test.ts
npx jest --runInBand test/workers.match-presentation-journal.test.ts test/workers.match-publish-idempotency.test.ts test/workers.match-stream-sse.test.ts test/workers.match-worker.publish-persistence.test.ts
npm run typecheck
npm run build:ts
npm run test:network:parity
npm run match:pixijs-board-playback-check
npm run match:pixi-runtime-fallback-check
npm run match:cross-platform-smoke:vite
npm run check:board-test-selectors
npm run build:vite
npm run build:browser
npm run worker:prepare
npm run check:worker-mirror
```

新規test fileは該当phaseで作成後に上記へ含める。存在しない予定fileを実装前baseline commandへ混ぜない。長時間selfplay/trainingは実行しない。

visual/browser検証は最小関連scenarioから開始し、最終候補で次を追加する。

```powershell
npm run test:visual
```

全visual suiteが長時間になる場合は関連specへ絞った実行コマンドと対象を記録し、未実行範囲を報告する。

## 14. Performance合否表

| Gate | 必須判定 |
| --- | --- |
| R1 trajectory structure | steady tickのclip/descriptor/static clear = 0 |
| R1 performance | allocation 90%以上減、trajectory JS self time p95 70%以上減 |
| R4 static views | transform-only tickのstatic prepare/repaint = 0 |
| F1 fingerprint | new modelはsort 1回/pass 1回、same modelはpass 0回 |
| I1 input | dispatch trace同一、move hit-test回数はframe数以下 |
| C1 camera | final geometry同一、none/client-only render = 0 |
| N1 intake structure | accepted deep inspection 1回、ordinary full previous/mirror clone = 0 |
| N1 performance | intake JS time p95 30%以上減を目標。未達は残存profileを報告 |
| N2 wire | V2 byte 30%以上減、legacy shape同一、semantic digest同一 |
| overall | app Long Task 50ms以上 = 0、RAF stall 50ms以上 = 0、frame p95非悪化 |

performance数値だけ未達でも、見た目・authority・settlementを弱めて通さない。構造gate未達は該当phaseを完了扱いにしない。

## 15. Commitとrollback単位

各単位はfocused verification後に、タスク所有fileだけをstageしてcommitする。

1. `Characterize in-game hot paths`: baseline fixture、debug/test counter、characterization test
2. `Separate Pixi operational queries`: scope/active-run queryとtest
3. `Cache board frame fingerprints`: 1-pass/WeakMapとtest
4. `Separate playback static paint`: stone/ghost/effect paint boundaryとtest
5. `Prepare source trajectory rendering`: profile plan、scene scalar apply、visual/performance test
6. `Coalesce board input and camera events`: hit projection、pointermove、camera分類とtest
7. `Prepare network snapshots once`: client inspector/clone/mirror縮小とtest
8. `Add presentation envelope V2 contract`: shared schemaとclient resolver。advertisementはまだ有効にしない
9. `Add presentation envelope V2 server support`: Worker/local、legacy/V2 server tests
10. `Enable presentation envelope V2 clients`: publish/SSE opt-inとrecovery tests
11. `Verify in-game runtime optimization`: architecture docs、generated artifacts、統合測定結果

rollbackは上記commit単位で行う。source trajectoryはprofileごとにfeature implementationを分離し、差が出たprofileだけ旧pathへ戻せる構造にする。ただしnormal runtimeで新旧両方を同時描画するfeature flagは作らない。比較用dual calculationはtest/debugだけに限定する。

## 16. Deployment順

1. client snapshot CPU最適化までを通常browser/Worker parityでlandingする。
2. V2を理解するshared/client resolverをlandingしても、advertisementを有効にする前はlegacyを受ける。
3. legacyとV2を両対応するWorker/local server supportをdeployする。
4. browser clientのpublish/SSE advertisementを有効にする。
5. Worker/local telemetryではなくdebug captureでlegacy/V2比率、recovery reason、payload byteを確認する。
6. legacy supportは残す。削除判断は別タスクとする。

old clientはfield/queryを送らないためlegacyを受ける。new clientがold serverへ接続した場合、old serverは未知field/queryを無視してlegacyを返し、new clientはlegacyを処理する。

## 17. Stop条件

次のいずれかが起きたphaseは、先へ進まず該当commitをlandingしない。

- fixed progressの見た目、duration、sound/log、target gateに差が出る。
- input trace、longpress、pointerup/cancel結果に差が出る。
- camera client-only分類でscene/cell geometryがずれる。
- snapshot hash、projection、stateVersion、visualSeq、settlementが変わる。
- malformed V2 refを推測適用する経路が必要になる。
- Worker/local parityまたはlegacy compatibilityが証明できない。
- pre-existing unrelated dirty changeと安全に分離できない。

## 18. 完了条件

- Phase 0～9の必須項目とperformance合否表の構造gateが完了している。
- player-visible behaviorと正本の差分が0である。
- focused test、typecheck、browser/Vite build、Pixi playback/fallback/cross-platform smoke、network parity、visual/browser確認が成功している。
- Worker/local/legacy/V2、black/white/spectator、live/replay/journal/reconnectが一致する。
- generated/mirrorをgeneratorから更新し、関連diffを確認している。
- 実測条件、baseline/candidate、無効sample、未達目標、残存riskを最終報告へ記載している。
- coherentなtask-owned diffがcommitされている。

## 19. Self-review

- 初案はsource trajectoryを最初に変更する順だったが、static paint境界がないままではscene APIが二重化するため、stone/effectの分離を先に置いた。
- inputとcameraを同一phaseにまとめていたが、terminal pointer semanticsとvisual transaction errorのriskが異なるため、実装・test checkpointを分けた。
- snapshot CPU削減とwire compactionを同時に行う案は、原因とrollbackが混ざるため、client内部処理を先、protocol変更を後に分離した。
- V2 server/clientを1commitにする案はdeploy順を制御できないため、server supportとclient advertisementを別commitにした。
- timeline allocation整理を必須化すると調査範囲が広がるため、trajectory移行後もprofile上位に残る場合だけ行う条件付き項目へ変更した。
- visual regressionだけではtiming/settlement差を捕捉できないため、semantic digest、event trace、duration、input unlock、sound/log countを同じgateへ追加した。
- performance目標未達時に品質を下げる逃げ道をなくし、構造gateとplayer-visible contractを優先するStop条件を追加した。
