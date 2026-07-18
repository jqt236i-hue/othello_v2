# PixiJS board source trajectory migration design

- Status: implementation-ready follow-up design
- Last reviewed: 2026-07-19
- Scope: 盤面セルから盤面セルへ移動する破壊前・変化前の source trajectory
- Player-visible specification: 変更なし

## 1. Authority and relationship to the completed playfield migration

この文書は、完了済みの `docs/implementation/pixijs-playfield-migration-design.md` に対する限定的な後継設計である。同文書が `source-to-board` / `global DOM` と分類したもののうち、**始点と終点がどちらも盤面 world coordinate である軌跡**だけを既存 Pixi board effect layer へ移す。

次の優先順位を守る。

1. player-visible behavior は `01-rulebook.md` と `正本/演出正本.md`、処理順は `正本/ターン進行正本.md` を正本とする。
2. authority、Single Visual Writer、strict-network settlement は `docs/architecture-contracts.md` を正本とする。
3. sparse render model、viewport materialization、排他的 DOM compatibility fallback など、完了済み移行の契約は `docs/implementation/pixijs-playfield-migration-design.md` を引き継ぐ。
4. この文書は、盤面セル間 source trajectory の renderer ownership と実装境界だけを上書きする。

この移行自体では `01-rulebook.md` と `正本/*.md` を変更しない。色、形、意味、表示時間、発動順、対象への到達順、効果音、ハイライト、対応環境のいずれかを変える必要が判明した場合は実装を止め、先に仕様更新の要否をユーザーへ確認する。

## 2. Decision summary

通常 Pixi backend では、盤面セル間 source trajectory を既存の一枚の Pixi canvas、既存の private timeline、既存の effect layer で描画する。新しい `PIXI.Application`、fullscreen canvas、Canvas 2D overlay、DOM/SVG overlay は追加しない。

source trajectory は独立した global event として再生せず、元の `destroy` または `flip` を処理する `BoardVisualBackend.playPhase()` の一部にする。各 backend は同じ profile registry と同じ ordered event/target を受け、次を一つの board phase settlement として完了させる。

```text
original ordered event
  -> backend preflight
  -> source trajectory start
  -> target-local impact / pulse start
  -> per-target trajectory gate
  -> destroy / flip / replacement pixels
  -> phase settlement
```

DOM compatibility backend は、WebGL/Pixi 初期化失敗、復旧不能な context loss、または正確な debug flag で単独選択された場合だけ、現在の DOM 実装を同じ `playPhase()` 内から使う。Pixi backend の実行中に、一つの trajectory だけを DOM fallback へ逃がしてはならない。

## 3. Why this follow-up is needed

現行実装は盤面本体と対象地点の impact/removal を Pixi が描く一方、次の軌跡だけを `ui/presentation/global-board-effect-presenter.ts` から fixed DOM/SVG overlay として描いている。

- 狙撃の意志: 小球
- ロボット掃除機: 対象石の吸い込み
- 破壊龍: 炎ブレス
- 因果抹消神: 黒いビーム
- 落雷 / 究極破壊神: 雷
- 屍石: 黒紫の影と牙

この構成では、一つの効果が DOM と Pixi の二つの animation clock、二つの座標系、二つの cleanup 経路に分かれる。今後、粒子、残光、歪み、複数レイヤーの光、品質 tier を追加するほど、layout read、DOM/SVG node、WAAPI、Pixi target effect の同期が複雑になる。

一方、現在の `ui/pixi/effects/destroy.ts` と `ui/pixi/effects/flip.ts` には target impact、赤ハイライト、石の消去・変化、`waitForTargetPrelude` gate がすでにある。source trajectory を同じ backend/timelineへ移すことで、演出品質を上げるための拡張点を一箇所にできる。

## 4. Goals and non-goals

### 4.1 Goals

- 盤面セル間 source trajectory を既存 Pixi effect layer の owner にする。
- 現在の見た目、タイミング、target gate、同時/直列関係を維持する。
- `events[]` の内容と順序、`sequenceIndex`、`actionId`、`effectBlockId`、`phase` を変更しない。
- source trajectory を canonical state、network snapshot、game RNG から独立した UI presentation に保つ。
- context loss recovery と DOM compatibility fallback を、既存の board phase checkpoint だけで再現できるようにする。
- sparse model と viewport materialization を壊さず、遠い source/target のために cell view や canvas backing store を増やさない。
- 将来の高品質 profile を追加できる、typed かつ fail-closed な registry を作る。

### 4.2 Non-goals

- 今回の移行で粒子数、色、形、shader、表示時間を高品質版へ変更すること。
- 手札から盤面、盤面から手札、カードから盤面など UI と盤面を横断する演出を Pixi 化すること。
- 特殊カード暗転、ラウンドバナー、入退室 HUD、観測吹き出しなど fullscreen/global UI を Pixi 化すること。
- 手札、HUD、カード、設定、説明文、アクセシビリティ semantic layer を canvas 化すること。
- game/headless/Worker が演出 profile や Pixi runtime を知ること。
- 新しい network payload、canonical field、game event type を追加すること。
- 長時間 soak や実機入力を本移行の完了条件へ戻すこと。

## 5. Current behavior that must remain invariant

### 5.1 Ordered launch and per-target gate

現行 `ui/presentation/dispatcher.ts` は対象配列を受信順に走査し、各 source trajectory を await 前に同期的に開始する。その後 board phase を並行開始し、各 target の removal/change だけが自分の trajectory Promise を待つ。

移行後も次の順序を固定する。

1. planner step 全体を、sound、global、board のいずれも開始する前に preflight する。
2. 一つの backend `playPhase()` launch に含まれる raw events と raw targets を受信順に走査する。flip の target dedupe より前の配列を使う。
3. その launch に属する **全 target の source trajectory を先に**同期開始し、`trajectoryId` ごとの Promise map を作る。
4. 全 source trajectory の start が終わった後にだけ、既存順の target-local impact/pulse と board effect launch を開始する。
5. 各 target の消去、屍石化、置換は、自分に対応する trajectory Promise と必要な target impact が完了してから行う。
6. 同じ `effectBlockId` で同時表示を許された targets は並行のままとする。
7. 異なる action/phase は planner が定めた直列順を変えない。

したがって、単純な `targets.map(playTarget)` 内で trajectory と impact を交互に開始してはならない。backend は必ず `prelaunch all trajectories → launch board target effects` の二段構成にする。複数の `playPhase()` launch が同じ planner step で並行する場合は、dispatcher が現在呼び出す launch 間の順序を変えず、各 launch の内部だけでこの二段構成を適用する。

parity trace は、移行前の `global:destroy_source_animation` / `global:zombie_bite_source_animation` と移行後の backend-local call 名を文字列のまま比較しない。canonical input `events[]` とその順序は完全一致を要求し、内部routeは両実装を `trajectory:start(profile, trajectoryId)`、`trajectory:settle(profile, trajectoryId)`、`impact:start(targetId)`、`target:commit(targetId)` という共通semantic traceへ正規化して相対順を比較する。旧/new固有route名は診断情報として別欄に残す。

### 5.2 Visual and timing parity matrix

初回実装は次の current baseline を再現する。distance は phase 開始時の同一 layout snapshot 上の cell center 間 CSS pixel 距離である。安全 deadline は animation API が完了通知を返さない場合の上限であり、通常完了を不必要に延長してはならない。

| Profile | Direction | Current visible contract | Current duration/gate policy |
| --- | --- | --- | --- |
| `sniperShot` | source → target | owner 色の通常石画像、通常石の25%相当、小球を直線移動 | `clamp(90 + distance*0.35, 120, 420) ms`、linear、通常はanimation finishで到達扱い、safety deadlineはduration+120ms |
| `robotVacuumSuck` | target → source | `ownerBefore`色の対象石を吸引元へ移動しつつ 1 → 0.68 に縮小、opacity 1 → 0.78 | `clamp(140 + distance*0.28, 140, 360) ms`、通常はanimation finish、safety deadlineはduration+120ms。到達後はgeneric fadeを重ねずcell clear |
| `destroyDragonBreath` | source → target | 黄橙赤の beam、source muzzle。Pixi laneのtarget impactは既存`destroy.ts`だけが描く | beam `clamp(240 + distance*0.28, 280, 520) ms`、trajectory gateは常にduration+120ms |
| `meteorGodBlackBeam` | source → target | 黒紫の outer/core beam、source muzzle。Pixi laneのtarget impact/ringは既存`destroy.ts`だけが描く | beam `clamp(230 + distance*0.22, 260, 460) ms`、trajectory gateは常にduration+140ms |
| `lightningDestroyed` | source → target | 青白い main glow/core、seeded branches。Pixi laneのtarget flash/ringは既存`destroy.ts`だけが描く | `clamp(170 + distance*0.12, 170, 300) ms`。Pixi laneはsource animations finish（通常duration、deadline duration+140ms）、DOM laneは自身のtarget要素を含む既存finish/deadlineを維持 |
| `udgDestroyed` | source → target | `lightningDestroyed` と同じ trajectory renderer | 同上 |
| `zombieBite` | source → target | 黒紫の影が這い、対象を挟む上下の半透明牙が閉じた後に屍石化 | 800 ms。`prefers-reduced-motion` では source trajectory を出さず、既存 target change policyを維持 |

`willHunterKingSlash` は現在すでに `ui/pixi/effects/destroy.ts` の target-local impact であり、DOM global prelude ではない。今回重複実装しない。将来 source と target を結ぶ新しい斬撃へ仕様変更する場合だけ、新規 trajectory profile と正本確認を行う。

source coordinate は `target.sourceRow/sourceCol` を優先し、未指定時だけ `target.meta.sourceRow/sourceCol` を使い、有限値を整数化する現行解決順を固定する。`sniperShot` の projectile owner は `target.projectileOwner → target.meta.projectileOwner → ownerBeforeの反対色 → black` の順で解決する。`robotVacuumSuck` は `ownerBefore` をそのまま使う。

### 5.3 NOANIM, reduced motion, sound and logs

- `NOANIM=1` は trajectory object を materialize せず、同じ start → settle → final sync 経路を duration 0 で通る。
- destroy 系 trajectory は、現行どおり reduced-motion だけを理由に duration を変えない。
- `zombieBite` は現行どおり reduced-motion で source shadow/fangs を省略する。
- source trajectory は音を鳴らさない。既存 `sound_effect` event の位置と回数を変えない。
- recovery replay は sound、log、global DOM event を再発火しない。

## 6. Alternatives considered

### A. Keep the current global DOM presenter

変更量は最小だが、演出を高品質化するたびに DOM/SVG と Pixi の二重実装・二重clock・二重cleanupが増える。今回の目的を満たさないため採用しない。

### B. Add a fullscreen Pixi overlay application

盤面外まで自由に描ける一方、WebGL context と canvas が二つになり、context loss、DPR、resize、z-order、fallback、入力透過を別管理することになる。既存の一context契約と Single Visual Writer を弱めるため採用しない。

### C. Add `playSourceTrajectory()` beside `playPhase()` on the controller

dispatcher の現在形に近いが、writer claim 前後、strict-network settlement、context checkpoint、DOM fallback のすべてに二つ目の board visual entry point ができる。trajectory と target effect が別 recovery unit になるため採用しない。

### D. Execute trajectory inside the existing backend `playPhase()`

元の ordered event、target order、checkpoint、timeline、effect layer、abort、fallback をそのまま再利用できる。新しい authority や writer path を作らず、将来 profile も backend 内へ追加できるため、この案を採用する。

## 7. Target architecture

```text
game / Worker / snapshot
  ordered presentation events (unchanged)
            |
            v
ui/presentation/phase-planner.ts
            |
            v
ui/presentation/dispatcher.ts
  - preflight whole step
  - route original destroy/flip only
  - no synthetic destroy_source_animation / zombie_bite_source_animation
            |
            v
ui/board-visual/controller.ts
  - one writer token
  - existing phase checkpoint/recovery
  - one active backend
       /                         \
      v                           v
Pixi backend                 DOM compatibility backend
  playPhase()                  playPhase()
  trajectory registry         same registry
  existing effect layer       compatibility DOM implementation
  existing Pixi timeline      compatibility timers/WAAPI
```

### 7.1 Shared presentation-only classifier

`shared/presentation-effect-profiles.ts` remains the single cause/reason classifier. It must expose one board-source-trajectory classification surface covering the six destroy profiles and zombie infection. Callers must not duplicate cause/reason string parsing.

The visual profile and backend request types live under `ui/board-visual/` or `ui/presentation/`; they are not imported by `game/`, canonical network authority, or Worker logic.

```ts
type BoardSourceTrajectoryProfileKey =
  | 'sniperShot'
  | 'robotVacuumSuck'
  | 'destroyDragonBreath'
  | 'meteorGodBlackBeam'
  | 'lightningDestroyed'
  | 'udgDestroyed'
  | 'zombieBite';

interface BoardSourceTrajectoryRequest {
  readonly trajectoryId: string;
  readonly profileKey: BoardSourceTrajectoryProfileKey;
  readonly eventType: 'destroy' | 'flip';
  readonly eventOrdinal: number;
  readonly targetOrdinal: number;
  readonly source: Readonly<{ row: number; col: number }>;
  readonly target: Readonly<{ row: number; col: number }>;
  readonly direction: 'source-to-target' | 'target-to-source';
  readonly owner: 'black' | 'white' | null;
  readonly visualSeed: number | null;
  readonly event: PresentationPlaybackEvent;
  readonly targetPayload: unknown;
}
```

この request は UI-only の frozen DTO であり、canonical state へ保存しない。`trajectoryId` は `phaseKey/stepIndex/eventOrdinal/targetOrdinal/profileKey` から作るpresentation identityで、profile completeness、diagnostics、backend内部target gateにだけ使う。eventを並べ替えるためには使わない。

flip trajectoryは必ずraw event/raw target列から作る。既存のcombined flip/dedupeはtarget visualにだけ適用する。dedupe後targetには対応する`trajectoryId`列をraw順で関連付け、一つのdeduped targetが複数requestを持つ場合は全Promiseを待つ。target identityだけの`Map`に依存して、merge後の新objectでgateが消える実装は禁止する。

### 7.2 Profile registry

一つの frozen registry が最低限次を宣言する。

- profile key と対応する cause/reason/event type
- endpoint resolver と direction
- renderer primitive (`projectile`, `suction`, `beam`, `lightning`, `bite`)
- duration/easing/settlement policy
- required owner/texture inputs
- seeded random の要否
- target impact の owner と重複抑止
- `NOANIM` / reduced-motion policy
- halo/effect gutter 上限
- required asset と baseline procedural renderer

未知の profile、欠けた source/target、必要 owner の欠損、未登録 renderer は、step preflight で typed error にする。既知の特殊演出を generic destroy や silent no-op に落としてはならない。

### 7.3 Backend execution contract

各 backend は `validatePhase()` で全 event/target の request を列挙し、renderer、geometry inputs、required assets を、step のどの visual/sound/global launch より前に検証する。

`playPhase()` は launch ごとに次の二段順で実行する。

```ts
const trajectoryById = new Map<string, Promise<void>>();
for (const request of rawOrderedTrajectoryRequests) {
  // 全trajectoryを、最初のboard effect/awaitより前にraw順で開始する。
  trajectoryById.set(request.trajectoryId, startSourceTrajectory(request));
}

await launchExistingBoardEffectsInCurrentOrder({
  waitForTrajectory: (ids) => Promise.all(ids.map((id) => trajectoryById.get(id)))
});
```

target effect内部では既存target impact/pulseを開始し、対応trajectory gateと並行に待ってからremoval/changeへ進んでよい。ただし全source startがboard effect開始より先であること、source start順、impact start順、removal gateの相対順をfixture digestと一致させる。

`BoardPlaybackPhaseScope.waitForTargetPrelude` と synthetic global source events は cutover 後に不要になる。代わりのgateはcontroller/dispatcherの公開portではなく、各backendの一回の`playPhase()`内部に閉じたtyped Promise mapとする。caller countがゼロであることを確認してから旧callbackを削除し、互換性のためだけのsuccess-shaped no-opは残さない。

## 8. Pixi rendering design

### 8.1 Existing canvas and layer only

source trajectory renderer は `ui/pixi/board-scene.ts` の既存 playback/effect layer に child container を持つ。`PIXI.Application`、renderer、ticker、canvas、WebGL contextを新設しない。

primitive は profile に応じて次を組み合わせる。

- projectile/suction: pooled Sprite。現在選択中の normal stone texture lease を使う。
- breath/black beam: pooled Graphics または geometry handle。source muzzle、beam core/outerを別handleにできる。
- lightning: deterministic polyline Graphics。main glow/core と branch を同じ seeded stream から作る。
- zombie bite: shadow strip と上下 fang の pooled Graphics/Sprite。
- target flash/ring/impact:既存 `destroy.ts` / `flip.ts` の owner のままとし、trajectory側で二重描画しない。

常用 filter や effect ごとの新tickerを避ける。初回 parity renderer は既存の sprite/tint/alpha/blend/Graphics を優先する。将来 custom shader を追加するときも同じ profile、pool、lease、timeline、abort contract を使う。

### 8.2 Geometry snapshot

trajectory の source center、target center、distance、angle、clip rect、duration は、effect start時の同一 `BoardVisualFrame` topology と同一 layout revision から一度だけ計算する。

- descriptor作成後、最初の Pixi frame 前に layout revision が変わった場合は、開始前に全値を新revisionから再計算する。
- 開始後は endpointを途中で再targetせず、一つのsnapshotで完走する。これは現行 fixed DOM rect の挙動を保つ。
- source/target cellがcanonical final stateで空、穴、移動済みでも、eventの `sourceRow/sourceCol` とtarget coordinateを使う。
- geometry取得のためにmaterialized cell objectを要求しない。topology + layoutの純粋変換を使う。

### 8.3 Sparse model, viewport and clipping

source-to-target距離はunboundedでも、描画面はunboundedにしない。

- `BoardRenderModel.cells` はexisting/playableとexplicit holeだけのsparse DTOのままにする。
- trajectoryのためにsource、target、経路上のcell view、void cellをmaterializeしない。
- canvas backing storeは現在のvisible viewport +既存最大2cell effect gutterを超えて拡大しない。
- line/beam/lightningは、論理segmentとcanvas effect clipの交差部分だけを描く。
- 両endpointがoffscreenでもsegmentがviewportを横切る場合は交差部分を描く。
- segmentがclipと交差しない場合はDisplayObjectを作らず、同じsemantic durationだけtimelineをsettleさせる。
- glow、branch、fangなどpath外側のhaloは最大2cell gutter内に収める。超える品質案は別の表示仕様判断とする。

ただし、現行fixed DOM/SVG overlayがsupported viewport/scroll fixtureで`board viewport + 2cell gutter`の外へ実際に非透明pixelを出している場合、そのpixelを無条件に切り捨てることはbehavior parityではない。実装Phase 0では各profileの同期start直前からsettleまで毎animation frameのpainted pixel boundsを採取し、その時間方向unionを計測する。開始/終了frameだけの測定や単一screenshotで判定してはならない。外側pixelが一frameでも観測された場合、Phase 0は未完了のblocked状態としてcutoverと後続Phaseを止める。既存可視範囲を別writer/contextなしで維持できるか再設計し、維持できなければ`01-rulebook.md`と`正本/演出正本.md`の表示範囲更新をユーザーへ確認する。ユーザー判断なしにclip差をbaseline更新で吸収してはならない。

`effect-bounds.ts` では、旧 `source-to-board` を次の二系統へ分ける。

- `board-source-trajectory`: Pixi/DOM active backendが所有するboard-local family。距離ではなくpath周囲のhaloがfinite extentを持つ。
- `cross-surface-trajectory`: 手札・カード・HUDと盤面を横断するglobal DOM family。unboundedのまま残す。

historical Phase 0 baselineは書き換えず、current inventoryとbranch inventoryにfollow-up ownershipを記録する。

## 9. Determinism and future quality tiers

lightningなどのランダムな形は `ui/presentation/visual-seed.ts` のUI専用seedだけを使う。canonical/game RNGと `Math.random()` を呼ばない。

destroy profile の初回移植では、現行と同じ `effectKind: 'destroy-source'`、同じevent identity、同じtarget coordinateからseedを作り、random consumption順も固定する。classic/Vite、local/network/recoveryで同じgeometry digestになることをtestする。

profile schemaは将来 `baseline` / `high` などのquality variantを追加できる形にするが、今回runtimeで自動tier切替や設定UIは実装しない。将来tierを追加する場合も次を守る。

- gameplay state、勝敗、network authorityからtierを決めない。
- duration、source/target、target gate、効果の意味はtier間で同じにする。
- 粒子数やsub-layer数だけを変え、seeded topologyを決定的にする。
- required assetがない場合はstep前にfailする。profileで明示したbaseline procedural pathは許可するが、途中で一効果だけDOMへ切り替えない。

## 10. DOM compatibility fallback

DOM compatibility backendは現在の `ui/animation-destroy-source-events.ts` とzombie source実装をbackend内部から使える。ただし旧global gateを単に削除すると、highlight/target処理に入ってからsourceを始める順序へ変わるため、そのまま使ってはならない。移行時は次を満たすよう整理する。

- 通常Pixi startup graphから `ui/presentation/global-board-effect-presenter.ts` とDOM source modulesを外す。
- DOM compatibility backendはlazy loadされた後だけDOM/WAAPI/SVG implementationを評価する。
- DOM backendもraw events/targetsから全trajectoryを先に開始するbackend-local Promise mapを作り、既存event handlerはそのgateを待つ。controllerやdispatcherへcallbackを戻さない。
- current global presenterとDOM backend内部実装に差があるprofileは、current behaviorを一つのcompatibility実装へ統合してからdispatcherのglobal pathを削除する。特にzombieはfixed body overlayとboard-host内版の座標、clip、z-order、CSS pulseを比較し、Phase 0 baselineと一致する方をcompatibility正本にする。
- DOM backendも元の`destroy` / `flip` eventを受け、synthetic source eventを必要としない。
- Pixi→DOM context recoveryは同じcheckpointと元eventをDOM `playPhase()`で再生し、sound/logを再発火しない。
- backendは常に排他的にmountし、Pixi effectとDOM overlayを同時表示しない。

## 11. Recovery, abort and failure semantics

source trajectoryは既存board phase checkpointの一部になるため、controllerに別のsettlement handleや別checkpointを追加しない。

- context loss中のactive Pixi timelineはrejectし、controllerの既存`beginContextRecovery()` / `restoreContextRecovery()`が同じoriginal phase launchをreplayする。
- recovery replayはtrajectoryを含むboard pixelsだけを再生し、sound/log/global UIは再発火しない。
- 5秒以内にPixi復旧できない場合は、既存手順でPixiを破棄してDOM compatibility backendを一つだけmountし、同じphaseを再生する。
- abort/reset/destroyではactive timeline runをsettle/rejectし、全trajectory handle、Graphics/Sprite pool lease、texture leaseを一度だけ解放する。
- cleanup errorを握り潰して成功扱いにせず、typed renderer failureとして既存recoveryへ渡す。
- offscreen/no-object pathでもPromiseをstrandedにしない。

recoveryでtrajectoryが再び見える可能性は、現在のboard phase replayと同じpresentation recoveryである。authoritative eventを再実行したことにはしない。完了済みsound/logの重複がないことを必須fixtureで確認する。

## 12. Network and settlement invariants

この変更はnetwork payload、snapshot、visual-state-store、operationId、stateVersionを変更しない。

strict-networkの順序は引き続き次である。

```text
claim playback/writer
  -> dispatch original ordered phases including trajectory
  -> visual-state-store commit
  -> required applyCommittedFrame succeeds
  -> visual settlement tracker completes
  -> observers
  -> writer/playback settlement handle releases once
```

trajectory完了はboard phase完了条件に含むが、strict settlement handleを早く解放する理由にはしない。`applyCommittedFrame`失敗中はcommitted stateからframe applyだけをretryし、trajectory、sound、log、authoritative eventを再発火しない。

## 13. Resource lifecycle and diagnostics

debug/test diagnosticsへ最低限次を追加する。

- active/pooled trajectory handle count by primitive/profile
- created/destroyed trajectory handle count
- trajectory texture lease count
- active trajectory timeline run count
- offscreen-no-object settlement count
- profile preflight failure count/reason
- context recovery trajectory replay count
- DOM source overlay count in Pixi lane

完了、abort、reset、skin switch、same-model replay、context recovery後にlive countとleaseがbaselineへ戻り、idle tickerが停止することを確認する。遠距離endpointでcanvas backing sizeやmaterialized cell countが増えてはならない。

## 14. Verification strategy

### 14.1 Contract and unit

- profile registry completeness: 対象7profileにrenderer、endpoint、timing、motion、seed policyが一意にある。
- dispatcher: synthetic global source eventがなくてもoriginal event/phase/sound/log順が不変。
- preflight: 未実装profile/invalid endpoint/required asset欠損は、stepの最初のlaunch前にfailする。
- per-target order: source start → impact start → own gate → removal/changeを全profileで検証。
- multi-target: `source1 → source2 → ... → first board impact` の同期start順と許可された並行settlementを検証。
- flip dedupe: raw trajectory本数/順、deduped target visual本数、trajectoryId gate対応を個別に検証。
- visual-seed: classic/Vite/local/network/recoveryで同一digest、game RNG非消費。
- `NOANIM` / reduced-motion: 5.3のpolicyを固定。
- DOM compatibility: current visual/timing digestと同一、Pixi moduleを要求しない。

### 14.2 Sparse, viewport and lifecycle

- 四隅、四辺、負world coordinate、拡張/縮小後topology。
- sourceのみoffscreen、targetのみoffscreen、両方offscreenでpathが横切る、完全に非交差。
- current DOM pixel boundsを各profileのstart直前からsettleまで毎animation frame採取し、時間方向unionがboard viewport + 2cell gutter外へ出るかをsupported viewport/scrollで計測する。差があればPhase 0を完了扱いにせず、仕様判断まで後続Phaseをfail-closed停止。
- scroll/resize/layout revision change直前とactive中。
- source/target cellが最終modelでempty/holeでもevent geometryから再生。
- 連続50回、abort、reset、skin switch、context lossでobject/lease/ticker/backingが単調増加しない。

### 14.3 Browser and integration

- classic/ViteのPixi laneで7profileをpublic playback pathから実行。
- canonical input `events[]` digestは完全一致、旧global/new backendの内部routeは共通semantic trajectory traceへ正規化して順序一致。
- canvas 1、WebGL context 1、DOM cell 0、trajectory DOM/SVG overlay 0。
- forced DOM fallbackでcanvas 0、DOM backendだけが7profileを完了。
- context loss中のtrajectoryをPixi restoreとDOM fallbackの両経路で完了し、sound/log重複0。
- network strict playbackでtrajectory後も`applyCommittedFrame`成功前にclaim/trackerを解放しない。
- Chromium/Firefox/WebKitのdesktop/mobile viewport機能smoke。

長時間4-lane soakとphysical mobile GPU計測は今回のblocking gateにしない。短い反復fixtureでleak、backing growth、ticker、layout read、exclusive mountを検証し、frame timingはdiagnosticとして記録する。

## 15. Expected source ownership after cutover

| Concern | Owner after migration |
| --- | --- |
| cause/reason classification | `shared/presentation-effect-profiles.ts` |
| UI-only trajectory request/profile contract | `ui/board-visual/source-trajectory.ts`（新設想定） |
| phase/event routing | `ui/presentation/dispatcher.ts`、original eventsのみ |
| Pixi trajectory composition | `ui/pixi/effects/source-trajectory.ts`（新設想定） |
| target impact/removal/change | existing `ui/pixi/effects/destroy.ts` / `flip.ts` |
| geometry and clip | existing topology/layout/camera + Pixi effect layer |
| timeline/ticker | existing `ui/pixi/timeline.ts` |
| pool/lease | existing Pixi scene/resource lifecycle |
| DOM fallback visuals | `ui/board-dom-compat/` lazy compatibility graph |
| writer/recovery/strict settlement | existing controller/presentation timeline contracts |

## 16. Completion criteria

設計上の完了は、次をすべて満たす実装である。

- 7profileのsource trajectoryが通常Pixi laneで既存effect layerから描画される。
- target gate、表示時間、event/sound/log順、最終board digestがcurrent baselineと一致する。
- Pixi laneで対象trajectory用DOM/SVG nodeが生成されない。
- UI↔boardとfullscreen/global演出はDOMのまま残る。
- one canvas / one context / one backend / one board writerが維持される。
- sparse model、viewport materialization、2cell effect gutter、bounded backing storeが維持される。
- context recoveryとDOM fallbackが元eventのphase replayだけで完了し、sound/logを重複しない。
- strict-network settlement handleがrequired `applyCommittedFrame`成功後まで保持される。
- abort/reset/recovery後にobject、texture lease、tickerがbaselineへ戻る。
- player-visible specification変更がないため、`01-rulebook.md` と `正本/*.md` に不要な変更がない。
