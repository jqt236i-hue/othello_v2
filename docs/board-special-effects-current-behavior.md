# 盤面特殊効果の現行挙動調査メモ

文書の位置づけ: 後続リファクタリング前に、現行実装で確認できる盤面特殊効果の挙動を固定する調査メモです。

対象: カード効果によって盤面上に発生する石・マス・特殊状態の変化、presentation event、playback phase、アニメーション、効果音です。

一次情報: ゲーム仕様は `01-rulebook.md`、内部境界は `docs/architecture-contracts.md`、現行挙動の根拠は `game/logic/board_ops.ts`、`game/logic/cards.ts`、`game/logic/cards/*`、`game/turn/*`、`ui/animation-engine.ts`、関連テストです。

非目標: 仕様変更の提案、理想設計、全カードの乱択分布、`worker-public/` mirror の再調査は扱いません。

## 確認した一次情報

- `01-rulebook.md`: 破壊、反転、ターン進行、保護、特殊石、カード個別仕様。特に `STONE_SALVATION_GOD` は「同一破壊ブロック完了後に救済」「救済神自身は通常破壊される」「隕石/盤面縮小は石破壊と穴化を同じセル消滅ブロックで解決し、穴化後に救済」と書かれている。
- `docs/architecture-contracts.md`: `game/` は headless rules、`ui/` は playback/animation、snapshot と playback は別責務、Single Visual Writer は `ui/animation-engine.ts` を中心に維持する契約。
- `game/logic/board_ops.ts`: `spawnAt()`, `destroyAt()`, `changeAt()`, `moveAt()`, `swapOccupiedCells()`, `applyHoleAt()`, `runDestroyBlock()`, `runEffectBlock()` が盤面 mutation と presentation event の主経路。
- `game/logic/cards.ts` / `game/logic/cards/*`: カード固有の効果解決。カード hub は各 module を解決し、`BoardOps` を注入する。
- `game/turn/turn_pipeline.ts`: `applyTurn()` は turn start → card usage → action の順で `TurnPipelinePhases` を呼び、`CardLogic.flushPresentationEvents()` で presentation event を回収する。
- `game/turn/turn_pipeline_phases.ts`: ターン開始マーカーを `createdSeq` 昇順で処理し、pending target 解決と即時発動を担当する。
- `game/turn/pipeline_ui_adapter.ts`: presentation event を playback event に変換し、phase と sound cue を決める。
- `ui/animation-engine.ts`: playback event を実 DOM アニメーション・効果音へ適用する。`PlaybackState.beginPlayback()` / `finalizePlayback()` により Single Visual Writer を守る。
- 関連テスト: `test/game.stone-salvation-god.test.ts`, `test/game.pipeline-ui-adapter.spawn.test.ts`, `test/game.pipeline-ui-adapter.sound-cue.test.ts`, `test/ui.animation-engine.guard-timer.test.ts`, `test/game.x-bomb.test.ts`, `test/game.meteor-will.test.ts`, `test/game.logic.meteor-module.test.ts`, `test/game.freeze-will.test.ts`, `test/game.seed-will.test.ts`, `test/game.cell-teleport-will.test.ts`, `test/game.udg-duration.test.ts`, `test/game.will-hunter-king.test.ts`, `test/game.proliferation-will.test.ts`, `test/game.destroy-dragon-will.test.ts`, `test/game.lightning-will.test.ts`, `test/game.sniper-will.test.ts`, `test/game.pipeline-ui-adapter.move-metadata.test.ts`。

## 共通 event / playback / animation 経路

- `BoardOps.emitPresentationEvent()` は各 event に `actionId`, `effectBlockId`, `turnIndex`, `plyIndex` を付与し、`cardState.presentationEvents` と `_presentationEventsPersist` に積む。
- `BoardOps.runEffectBlock()` は `effectBlockId` と `_currentActionMeta` を設定し、既定では外側の effect block 終了時に救済神 revive queue を flush する。
- `BoardOps.runDestroyBlock()` は destroy-only 互換 API。外側 effect block がなければ destroy block 用の `effectBlockId` を作り、`_stoneSalvationGodDestroyBlockDepth` を増やし、外側 block 終了時に救済神 revive queue を flush する。
- `pipeline_ui_adapter.mapToPlaybackEvents()` は `SPAWN` → `spawn`/`move`, `DESTROY` → `destroy`, `CHANGE` → `flip`, `MOVE` → `move`, `STATUS_APPLIED` → `status_applied`, `STATUS_REMOVED` → `status_removed` へ変換する。
- phase は `pipeline_ui_adapter.ts` の `_createPlaybackPhaseState()`, `_planSpawnPlayback()`, `_planDestroyPlayback()`, `_planChangePlaybackPhase()`, `_planMovePlaybackPhase()` で決まる。
- `ui/animation-engine.ts` は phase ごとに `executePhase()` を呼び、同一 phase の flip は `executeFlipBatch()` で並列化し、非 flip event も `Promise.all()` で同 phase 内並列実行する。
- 効果音は `pipeline_ui_adapter.appendSoundEffectPlaybackEvents()` が playback event に `sound_effect` を追加し、`ui/animation-engine.ts` の `handleSoundEffect()` が `SoundEngine.playEffectByKey()` を呼ぶ。

## 石を置く / 増やす系

**代表カード**
- 繁殖の意志 (`BREEDING_WILL`), 増殖の意志 (`PROLIFERATION_WILL`), 複製の意志 (`CLONE_WILL`), 平等の意志 (`EQUALITY_WILL`), 増援の意志 (`REINFORCEMENT_WILL`), 種まきの意志 (`SEED_WILL` 芽生え), 救済神 (`STONE_SALVATION_GOD` revive)。

**仕様上の説明**
- `01-rulebook.md` では、繁殖・増殖・複製・平等・増援・種・救済神が盤面に石を追加する。救済神 revive と種の芽生えは通常反転を行わない。平等/増援は生成石を起点に通常反転する。

**実装上の処理順**
- `BoardOps.spawnAt()` が空き/封鎖を確認し、着地点の `SEED` を `_invalidateSeedMarkerAt()` で `STATUS_REMOVED` にしてから、盤面値・`stoneId` を設定し `SPAWN` を emit する。
- 複数生成は `BoardOps.spawnMany()` が `runSpawnBlock()` 内で順に `spawnAt()` を呼ぶ。
- `CardLogic.resolveEqualityWillUsage()` / `resolveReinforcementWillUsage()` は `spawnAt()` 後に通常反転を処理する経路を持つ。
- `game/logic/cards/breeding.ts` は `deps.BoardOps.spawnAt()` を使う。
- `BoardOps._inferSpawnIntent()` は `BREEDING`, `PROLIFERATION_WILL`, `CLONE_WILL`, `EQUALITY_WILL`, `REINFORCEMENT_WILL`, `STONE_SALVATION_GOD` などから `spawnIntent` を補完する。

**主な BoardOps API**
- `spawnAt()`, `spawnMany()`, `runSpawnBlock()`, `emitPresentationEvent()`。

**発生する presentation event**
- `SPAWN`。着地点に `SEED` がある場合は先に `STATUS_REMOVED` (`reason: seed_invalidated`)。
- 特殊石 marker 付与を伴う配置では `game/logic/cards/markers.ts`: `addMarker()` が `STATUS_APPLIED` を emit し、近傍の `SPAWN` meta に `special`, `timer`, `owner` を backfill する。

**playback phase の決まり方**
- `pipeline_ui_adapter.ts`: `_planSpawnPlayback()`。
- 通常の `SPAWN` は現在 phase。`STONE_SALVATION_GOD` revive は profile 上 `alwaysAdvancePhase: true` で必ず次 phase に送る。
- `CLONE_WILL` / `PROLIFERATION_WILL` で `meta.fromRow/fromCol` がある spawn は `spawn` ではなく clone-like `move` playback になる。
- `_orderDeferredSpawnsForPlayback()` は救済神 revive の `SPAWN` を同一 block の `DESTROY` / `MOVE` 後へ遅延配置する。

**アニメーションの扱い**
- `ui/animation-engine.ts`: `handleSpawn()` は繁殖 spawn だけ `BREEDING_SPAWN_FADE_MS` の fade-in。その他の spawn は `handlePlace()` と同じ即時出現。
- 平等/増援/救済神/救済の spawn は `_isPositiveSpawnLikeEffectTarget()` により紫系 positive highlight。救済神 revive は `POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS` に含まれ、最小表示時間がある。
- clone-like spawn は `handleMove()` 経路で移動アニメーション扱い。

**効果音の扱い**
- `pipeline_ui_adapter.ts`: `_planCoreSoundCues()` と `_pushRepeatedCueForCardEffectSpawnProfiles()` が `breeding_spawn` を追加する。救済神 revive も `soundSourceType: stone_salvation_god_revive` だが sound key は `breeding_spawn`。
- 種の芽生えは `seed_sprout` と `breeding_spawn` が使われることが `test/game.pipeline-ui-adapter.sound-cue.test.ts` で確認されている。

**Event Sequence 例: 平等の意志**
1. `SPAWN`
   - cause: `EQUALITY_WILL`
   - reason: `equality_will_spawn`
2. `CHANGE`（挟めた場合）
   - reason: `equality_will_flip`
3. playback:
   - `spawn` phase
   - `flip` phase
4. sound:
   - spawn phase に `breeding_spawn`
   - flip phase に `card_effect_flip`

**関連コード参照**
- `game/logic/board_ops.ts`: `spawnAt()`, `spawnMany()`, `_inferSpawnIntent()`, `_invalidateSeedMarkerAt()`。
- `game/logic/cards/breeding.ts`: `deps.BoardOps.spawnAt()`。
- `game/turn/pipeline_ui_adapter.ts`: `_planSpawnPlayback()`, `_orderDeferredSpawnsForPlayback()`, `CARD_EFFECT_SPAWN_PROFILES`, `_planCoreSoundCues()`。
- `ui/animation-engine.ts`: `handleSpawn()`, `handlePlace()`, `isBreedingSpawnTarget()`, `_resolveSpawnTargetHighlightMinimumMs()`。

**関連テスト**
- `test/game.pipeline-ui-adapter.spawn.test.ts`
- `test/game.pipeline-ui-adapter.sound-cue.test.ts`
- `test/ui.animation-engine.guard-timer.test.ts`
- `test/game.proliferation-will.test.ts`
- `test/game.seed-will.test.ts`

**未確認点**
- 各 spawn 系のカードごとのランダム選択分布は本メモでは網羅していない。

**壊れやすい点**
- `SPAWN` と `STATUS_APPLIED` の順序、または marker meta backfill を変えると特殊石の初期見た目が壊れる。
- 救済神 revive を `_orderDeferredSpawnsForPlayback()` から外すと破壊前に復活が見える可能性がある。

## 石を破壊する系

**代表カード**
- 狙撃の意志 (`SNIPER_WILL`), 雷撃の意志 (`LIGHTNING_WILL`), 破壊龍 (`DESTROY_DRAGON_WILL` / `DESTROY_DRAGON`), 究極破壊神 (`ULTIMATE_DESTROY_GOD`), 時限爆弾 (`TIME_BOMB`), 十字爆弾 (`CROSS_BOMB`), X爆弾 (`X_BOMB`), 悪食の意志 (`GLUTTONOUS_WILL`), 意志狩りの王 (`WILL_HUNTER_KING`), ロボット掃除機 (`ROBOT_VACUUM_WILL` / `ROBOT_VACUUM`), 隕石 (`METEOR_WILL`), 盤面縮小 (`BOARD_SHRINK_WILL` / `BOARD_SHRINK_GOD`), 破壊の意志 (`DESTROY_ONE_STONE`)。

**仕様上の説明**
- `01-rulebook.md` では破壊は石を `EMPTY` にする処理で、チャージ加算対象外。完全保護は通常破壊を防ぐが、隕石/盤面縮小のマス破壊は完全保護を貫通し、絶対保護はそれも防ぐ。
- 爆弾は範囲破壊、狙撃/雷撃/破壊龍/究極破壊神は turn start または配置直後のアンカー効果、悪食/意志狩り/ロボ掃除機は移動と破壊が絡む。

**実装上の処理順**
- `BoardOps.destroyAt()` は block 外から呼ばれると `runDestroyBlock()` で自動的に囲み、block 内では `_destroyAtCore()` を直接呼ぶ。単発破壊でも destroy block 用 `effectBlockId` が付く。
- `_destroyAtCore()` は順に、座標/空き/絶対保護/Guard/Freeze/Ghost、破壊回避、増殖、Regen、Living Will、通常破壊を判定する。
- 通常破壊では `stoneId` を null にし、セルを `EMPTY` にし、markers を削除してから `DESTROY` を emit する。
- `runDestroyBlock()` / `runEffectBlock()` 外側終了時に救済神 queue を flush し、`SPAWN` revive を emit する。`runCellRemovalBlock()` は破壊+穴化の互換 API として、穴化後に flush する。
- 同一効果ブロック内の破壊順は呼び出し側のループ順。爆弾・究極破壊神・時限爆弾などは各 module が `runDestroyBlock()` 内で複数 `destroyAt()` を呼ぶ。

**主な BoardOps API**
- `destroyAt()`, `_destroyAtCore()`, `runDestroyBlock()`, `runEffectBlock()`, `runCellRemovalBlock()`, `applyHoleAt()`。

**発生する presentation event**
- `DESTROY`。Ghost/増殖/Regen で破壊が実際には空化しない場合も、meta に `blockedByGhost`, `proliferated`, `regenerated` などを付けた `DESTROY` が出る。
- 隕石/盤面縮小のセル消滅は `DESTROY` の後に `STATUS_APPLIED` (`special: METEOR_HOLE`) が続く。
- 持続切れ・通常石化は `DESTROY` ではなく `STATUS_REMOVED`。

**playback phase の決まり方**
- `pipeline_ui_adapter.ts`: `_planDestroyPlayback()`。
- `TIME_BOMB`, `ULTIMATE_DESTROY_GOD`, `CROSS_BOMB`, `X_BOMB`, `ESCAPE_HYPERACTIVE` は `BATCH_DESTROY_CAUSES`。同じ destroy cause が連続する場合、同一 phase にまとまる。
- `GLUTTONOUS_WILL`, `SUPER_BUOYANCY_WILL` / `SUPER_GRAVITY_WILL`, `WILL_HUNTER_KING` は action scoped / grouped phase を持ち、後続 `MOVE` と同 phase に寄せる特例がある。
- その他の destroy は基本的に phase を 1 つ進める。

**アニメーションの扱い**
- `ui/animation-engine.ts`: `handleDestroy()` が `animateFadeOutAt()` または ghost fade で消す。
- 狙撃・破壊龍・雷撃・究極破壊神・意志狩り・ロボ掃除機は `DESTROY_SOURCE_ANIMATION_PROFILES` により source animation がある。
  - 狙撃: `animateSniperProjectile()`
  - 破壊龍: `animateDestroyDragonBreath()`
  - 雷撃/究極破壊神: `animateUdgLightningStrike()`
  - 意志狩り: `animateWillHunterKingSlash()`
  - ロボ掃除機: `animateRobotVacuumSuction()` と `afterDestroy: clearCell`
- 増殖/Regen/Ghost など preserve 系は `_shouldPreserveDiscOnDestroy()` で盤面 disc を保持し、短い highlight/待機になる。

**効果音の扱い**
- `pipeline_ui_adapter.ts`: `_planDestroySoundCues()`。
- 狙撃/雷撃/究極破壊神/破壊龍/悪食/意志狩りは、該当 destroy target が実破壊 outcome の phase ごとに `stone_destroy` を 1 回鳴らす。
- 同一 phase に複数対象があっても `_pushCueForMatchingEventPhases()` / `_pushCueForPhases()` により 1 回。複数 phase に分かれる場合は phase ごとに 1 回。
- ロボ掃除機吸い込みは `robot_vacuum_suck` のみで `stone_destroy` は追加しない。
- 爆弾系は `bomb_explode` で、`stone_destroy` は追加しない。
- 盤面縮小の破壊は `board_shrink_selected` で、`stone_destroy` は追加しない。
- generic destroy は爆弾・特殊プロフィール・金銀虹自己破壊・持続切れなどを除外した上で `stone_destroy`。

**Event Sequence 例: 狙撃の意志 + 救済神**
1. `DESTROY`
   - cause: `SNIPER_WILL`
   - reason: `sniper_shot`
2. `SPAWN`
   - cause: `STONE_SALVATION_GOD`
   - reason: `stone_salvation_god_revive`
3. playback:
   - `destroy` phase
   - `spawn` phase（救済神 revive は必ず phase advance）
4. sound:
   - destroy phase に `stone_destroy`
   - revive phase に `breeding_spawn`

**関連コード参照**
- `game/logic/board_ops.ts`: `destroyAt()`, `_destroyAtCore()`, `runDestroyBlock()`, `runEffectBlock()`。
- `game/logic/cards/sniper.ts`: `processSniperWillEffectsAtTurnStartAnchor()`。
- `game/logic/cards/lightning.ts`: `processLightningWillEffectsAtTurnStartAnchor()`。
- `game/logic/cards/destroy_dragon.ts`: `processDestroyDragonEffectsAtTurnStartAnchor()`。
- `game/logic/cards/time_bomb.ts`: bomb explosion paths。
- `game/logic/cards/udg.ts`: `processUltimateDestroyGodEffectsAtTurnStartAnchor()`。
- `game/logic/cards/hyperactive.ts`: gluttonous / robot vacuum destruction paths。
- `game/logic/cards/will_hunter_king.ts`: `processWillHunterKingEffectsAtTurnStartAnchor()`。
- `game/logic/cards/meteor.ts`, `game/logic/cards/shrink.ts`。
- `game/turn/pipeline_ui_adapter.ts`: `_planDestroyPlayback()`, `_planDestroySoundCues()`。
- `ui/animation-engine.ts`: `handleDestroy()`, `DESTROY_SOURCE_ANIMATION_PROFILES`。

**関連テスト**
- `test/game.sniper-will.test.ts`
- `test/game.lightning-will.test.ts`
- `test/game.destroy-dragon-will.test.ts`
- `test/game.udg-duration.test.ts`
- `test/game.x-bomb.test.ts`
- `test/game.will-hunter-king.test.ts`
- `test/game.stone-salvation-god.test.ts`
- `test/game.pipeline-ui-adapter.sound-cue.test.ts`
- `test/ui.animation-engine.guard-timer.test.ts`

**未確認点**
- 時限爆弾/CROSS/X の対象集合生成順は個別 module 側に依存する。本メモでは `BoardOps` 以降の共通破壊順を中心に確認した。

**壊れやすい点**
- `DESTROY` を「実際に空になった時だけ」と解釈してフィルタすると、Ghost/増殖/Regen の演出・音分岐が壊れる。
- `BATCH_DESTROY_CAUSES` や `_isDestroyRemovalOutcome()` の条件を変えると、同一 phase 1 回の破壊音仕様が崩れる。

## 石を移動する系

**代表カード**
- 多動の意志、瞬間多動、逃げる意志、極悪多動魔、多動の継承、究極多動神、究極反転龍、究極破壊神、悪食、意志狩りの王、ロボット掃除機、強風、テレポート、マステレポート、位置交換。

**仕様上の説明**
- `01-rulebook.md` では、移動系は空きマスへの移動、敵石マスへの進入前破壊、位置交換、移動元穴化など複数パターンがある。石移動は通常は布石獲得を伴わず、カードにより移動後反転するものとしないものがある。

**実装上の処理順**
- `BoardOps.moveAt()` は from/to を検証し、移動元の凍結/絶対保護、移動先の占有/封鎖を確認する。`swapOccupiedCells()` は交換対象 2 セルの凍結/絶対保護も確認する。
- 着地点の `SEED` は `_invalidateSeedMarkerAt()` で消える。
- `stoneId` は from から to へ移される。
- `setCellValue()` で from を `EMPTY`、to を元 owner にし、`_moveStoneAttachedMarkers()` で stone attached marker と linked positions を移す。
- `MOVE` event に `prevRow/prevCol`, `row/col`, `stoneId`, `ownerBefore/After`, `meta.moveIntent` を付ける。
- `swapOccupiedCells()` は占有セル同士の値・`stoneId`・stone attached marker を交換し、2 個の `MOVE` event を emit する。

**主な BoardOps API**
- `moveAt()`, `swapOccupiedCells()`, `_moveStoneAttachedMarkers()`, `_swapStoneAttachedMarkers()`。

**発生する presentation event**
- `MOVE`。位置交換は 2 つの `MOVE`。
- 敵マスへ入るカードは先に `DESTROY` してから `MOVE` するもの、同一効果内で destroy/move を同 phase に寄せるものがある。
- マステレポートは移動後、移動元へ `METEOR_HOLE` の `STATUS_APPLIED` を伴う。

**playback phase の決まり方**
- `pipeline_ui_adapter.ts`: `_planMovePlaybackPhase()`。
- 悪食・超浮力/超重力・意志狩りは直前 destroy phase と同じ phase に寄せる特例がある。
- その他 move は基本的に phase を進める。
- 極悪多動魔の forced swap は `_findExtremeForcedSwapMovePairPresentationIndex()` が 2 個の `MOVE` を 1 つの `move` playback にまとめる。

**アニメーションの扱い**
- `ui/animation-engine.ts`: `handleMove()` 系。ghost を `document.body` 上で動かし、最後に destination cell へ settle する。
- `moveIntent` / cause / reason により `_buildMoveGhostAnimationSpec()` が変わる。強風は gust、超浮力/超重力は lift/drop、overlap return は往復、forced swap は専用。
- テレポート系や no-anim では即時 final state に寄せる分岐がある。
- highlight は `_getMoveHighlightCells()` で、破壊/反転回避 move は source、位置交換は両セル、それ以外は destination が中心。

**効果音の扱い**
- `strong_wind_move`, `teleport_select`, `super_buoyancy_move`, `super_gravity_move`, `ultimate_anchor_move`, `hyperactive_move` など。
- 究極反転龍/究極破壊神/意志狩りの anchor move は `ultimate_anchor_move`。
- 多動・ロボ掃除機・悪食など hyperactive-like は `hyperactive_move`。

**Event Sequence 例: 悪食の意志が敵石を捕食**
1. `DESTROY`
   - cause: `GLUTTONOUS_WILL`
   - reason: `gluttonous_eat`
2. `MOVE`
   - cause: `GLUTTONOUS_WILL`
   - reason: `gluttonous_eat_move`
3. playback:
   - destroy と move は action scoped の同 phase に寄る
4. sound:
   - 実破壊 outcome ならその phase に `stone_destroy`
   - move は hyperactive-like として `hyperactive_move` 対象

**関連コード参照**
- `game/logic/board_ops.ts`: `moveAt()`, `swapOccupiedCells()`, `_inferMoveIntent()`。
- `game/logic/cards/movement.ts`: `applyStrongWindWill()` / super crush 系。
- `game/logic/cards/teleport.ts`: `TELEPORT_WILL`, `CELL_TELEPORT_WILL`。
- `game/logic/cards/hyperactive.ts`: hyperactive / gluttonous / robot vacuum paths。
- `game/logic/cards/udg.ts`: ultimate destroy god move/destroy。
- `game/logic/cards/will_hunter_king.ts`。
- `game/cards/effects/position-swap.ts`。
- `game/turn/pipeline_ui_adapter.ts`: `_planMovePlaybackPhase()`, `_getMoveIntent()`。
- `ui/animation-engine.ts`: `handleMove()`, `_getMoveSemantics()`, `_buildMoveGhostAnimationSpec()`。

**関連テスト**
- `test/game.pipeline-ui-adapter.move-metadata.test.ts`
- `test/game.cell-teleport-will.test.ts`
- `test/game.teleport-will.test.ts`
- `test/game.will-hunter-king.test.ts`
- `test/game.udg-duration.test.ts`
- `test/ui.animation-engine.guard-timer.test.ts`

**未確認点**
- すべての移動カードの候補選択優先順位は本メモでは列挙していない。

**壊れやすい点**
- marker をセル固定/石追従で分ける `_isCellFixedMarkerType()` を崩すと、封鎖/穴/凍結/種が石と一緒に移動してしまう。
- `stoneId` を維持しない move は replay/特殊石識別に影響する。

## 石を反転する / 所有者を変える系

**代表カード**
- 通常オセロ反転、究極反転龍、繁殖/多動系の移動後反転、連鎖系、禁忌の反転、誘惑の意志、交換の意志、再生/復活系の反転。

**仕様上の説明**
- `01-rulebook.md` は「反転」を石の色変更と定義し、破壊とは別扱いにしている。誘惑は特殊石を自分色に変え、付帯状態を維持する。

**実装上の処理順**
- `BoardOps.changeAt()` が owner 変更の共通経路。
- 同色の場合は通常 no-op だが `forcePresentation` で `CHANGE` を出せる。
- 凍結/絶対保護/Ghost のブロックを判定する。Ghost が反転を防ぐ場合も `CHANGE` event に `meta.blockedByGhost` を付ける。
- 通常 flip reason では `_consumeProliferationMarkerOnNormalFlip()` や `_consumeAfterimageMarkerOnNormalChange()` が特殊状態を消す。
- owner 変更後、`totalFlipCountByPlayer` と corner capture count を更新し、`CHANGE` event を emit する。

**主な BoardOps API**
- `changeAt()`, `revertSpecialStoneAt()`, `emitPresentationEvent()`。

**発生する presentation event**
- `CHANGE` → playback `flip`。
- 特殊状態喪失/持続切れは `STATUS_REMOVED`。

**playback phase の決まり方**
- `pipeline_ui_adapter.ts`: `_planChangePlaybackPhase()`。
- chain flip は `chainLink` ごとに phase を進める。
- Regen trigger / Living Will restore change は phase を進める。
- 同一 phase の flip は `ui/animation-engine.ts`: `executeFlipBatch()` でまとめて再生される。

**アニメーションの扱い**
- `ui/animation-engine.ts`: `handleFlip()` は `FLIP_MS` の中間で `syncDiscVisual()` を行う。
- Ghost ブロックは実反転せず、highlight と短い待機だけ。

**効果音の扱い**
- `pipeline_ui_adapter.ts`: `_planCoreSoundCues()` が card effect flip phases に `card_effect_flip` を追加する。
- 通常オセロ反転の通常配置音は本メモの対象外。

**Event Sequence 例: 誘惑の意志**
1. `CHANGE`
   - cause: `TEMPT_WILL`
   - reason: `tempt_applied`
2. playback:
   - `flip` phase
3. sound:
   - `tempt_select`
   - 同 phase に `card_effect_flip`

**関連コード参照**
- `game/logic/board_ops.ts`: `changeAt()`。
- `game/logic/cards/flips.ts`, `game/logic/cards/chain.ts`, `game/cards/effects/ownership.ts`。
- `game/turn/pipeline_ui_adapter.ts`: `isCardEffectFlipPresentationEvent()`, `_planChangePlaybackPhase()`。
- `ui/animation-engine.ts`: `handleFlip()`, `executeFlipBatch()`。

**関連テスト**
- `test/game.pipeline-ui-adapter.sound-cue.test.ts`
- `test/ui.flip.suppress-double.test.ts`
- `test/game.taboo-reverse-will.test.ts`
- `test/game.regen.consume-visual.test.ts`

**未確認点**
- 通常配置時の core flip 詳細は本メモでは BoardOps 由来の presentation event 変換に限定して確認した。

**壊れやすい点**
- `CHANGE` と `flip` の命名差があり、raw presentation event と playback event を混同しやすい。

## マス状態を変える系

**代表カード**
- 穴マス化、隕石、盤面縮小、マステレポート、封鎖、凍結、種。

**仕様上の説明**
- `01-rulebook.md` では、隕石/盤面縮小は穴化し、石破壊を伴う穴化では救済神の対象になる。空きマス穴化やマステレポート移動元穴化など、石破壊を伴わない穴化では救済神は発動しない。封鎖/凍結/種はセルに状態を付ける。

**実装上の処理順**
- `BoardOps.applyHoleAt()` はセルを `EMPTY` にし、既存 marker を削除し、`METEOR_HOLE` marker を追加して `STATUS_APPLIED` を emit する。
- `game/logic/cards/meteor.ts` は対象セルが石ありなら `destroyAt(..., 'METEOR_WILL', 'meteor_cell_destroy', { ignoreGuard: true, ignoreRegen: true })` 後に穴化する。
- `game/logic/cards/shrink.ts` も `BOARD_SHRINK_*` cause で破壊/穴化する。
- `game/cards/effects/status-cells.ts`: `applyBlockadeWill()`, `applyFreezeWill()`, `applySeedWill()` は pending target を確認し、既存同 type marker を除去して `addMarker()` で `BLOCKADE` / `FREEZE` / `SEED` を付ける。

**主な BoardOps API**
- `applyHoleAt()`, `destroyAt()`, `runCellRemovalBlock()`, `spawnAt()`（seed invalidation）。

**発生する presentation event**
- `STATUS_APPLIED`: `METEOR_HOLE`, `BLOCKADE`, `FREEZE`, `SEED`。
- `STATUS_REMOVED`: seed invalidated, freeze duration end, loss/reset 系。
- 石があるマスの隕石/縮小は `DESTROY` と `STATUS_APPLIED` の両方。空きマス穴化は `STATUS_APPLIED` のみ。

**playback phase の決まり方**
- `STATUS_APPLIED` / `STATUS_TICK` は `pipeline_ui_adapter.ts` の `mapToPlaybackEvents()` で passive event として現在 phase の `status_applied` になる。
- `STATUS_REMOVED` は通常 `status_removed`。特殊石の duration end は `_planDurationEndRevertPlaybackPhase()` で前 event があれば phase を進めて再生する。

**アニメーションの扱い**
- `ui/animation-engine.ts`: `handleStatusChange()`（下流）で status visual を crossfade / overlay fade する。テスト上、`METEOR_HOLE` の `STATUS_APPLIED` は残っていた disc を消す。
- `BLOCKADE` / `FREEZE` は `_resolveStatusChangeHighlightTone()` で highlight なし。`TIME_BOMB` は赤、その他 `STATUS_APPLIED` は原則 purple/positive。

**効果音の扱い**
- 凍結成功は `freeze_select`。
- 盤面縮小成功は `board_shrink_selected`。
- 隕石単体の専用 sound key は、この調査範囲の sound planner では明確な専用 cue を確認していない。

**Event Sequence 例: 隕石が石ありマスに落ちる**
1. `DESTROY`
   - cause: `METEOR_WILL`
   - reason: `meteor_cell_destroy`
2. `STATUS_APPLIED`
   - meta.special: `METEOR_HOLE`
3. `SPAWN`（救済神がいる場合のみ）
   - cause: `STONE_SALVATION_GOD`
   - reason: `stone_salvation_god_revive`
4. playback:
   - destroy phase
   - status_applied phase（同 block の後続）
   - revive spawn phase
5. sound:
   - board shrink では `board_shrink_selected`
   - 救済 revive では `breeding_spawn`

**関連コード参照**
- `game/logic/board_ops.ts`: `applyHoleAt()`, `_isCellFixedMarkerType()`, `_invalidateSeedMarkerAt()`。
- `game/logic/cards/meteor.ts`: meteor apply。
- `game/logic/cards/shrink.ts`: board shrink apply。
- `game/cards/effects/status-cells.ts`: `applyBlockadeWill()`, `applyFreezeWill()`, `applySeedWill()`。
- `game/logic/cards/markers.ts`: `addMarker()`。
- `game/turn/pipeline_ui_adapter.ts`: `mapToPlaybackEvents()`, `_planSelectionSoundCues()`。
- `ui/animation-engine.ts`: `_resolveStatusChangeHighlightTone()`, `handleStatusChange()`。

**関連テスト**
- `test/game.meteor-will.test.ts`
- `test/game.logic.meteor-module.test.ts`
- `test/game.freeze-will.test.ts`
- `test/game.seed-will.test.ts`
- `test/game.cell-teleport-will.test.ts`
- `test/game.stone-salvation-god.test.ts`
- `test/ui.animation-engine.guard-timer.test.ts`

**未確認点**
- `handleStatusChange()` 本体の全分岐は長大なため、ここでは検索結果と既存テストで確認できる挙動を中心に記録した。

**壊れやすい点**
- `DESTROY` と `STATUS_APPLIED` を同一視すると、救済神 queue と穴演出が崩れる。
- `METEOR_HOLE` を stone attached marker として扱うと move に追従してしまう。

## 特殊石 / 状態を付与・解除する系

**代表カード**
- 弱い意志、強い意志、守る意志、守護神、救済神、幽霊の意志、残像の意志、時限爆弾、時間停石、狙撃/雷撃/破壊龍/各種多動/ロボ掃除機/悪食/意志狩り/リビングウィル系。

**仕様上の説明**
- 特殊石は marker として盤面上の石またはセルに付く。持続ターンを持つ特殊石は、期限切れで原則同色通常石に戻る。破壊とは異なる。

**実装上の処理順**
- `game/logic/cards/markers.ts`: `addMarker()` が marker を追加し、hidden trap 以外は `STATUS_APPLIED` を emit する。
- `BoardOps.revertSpecialStoneAt()` は該当 marker を除去して `STATUS_REMOVED` を emit し、Living Will の復元対象なら追加復元を呼ぶ。
- ターン開始の timer 減算後、`turn_pipeline_phases.ts` は `STATUS_TICK` を emit する。

**主な BoardOps API**
- `revertSpecialStoneAt()`, `emitPresentationEvent()`, `changeAt()`, `destroyAt()`。

**発生する presentation event**
- `STATUS_APPLIED`, `STATUS_TICK`, `STATUS_REMOVED`。
- 状態解除で石を空にしない場合は `DESTROY` を出さない。

**playback phase の決まり方**
- `STATUS_APPLIED` / `STATUS_TICK` は current phase。
- duration end の `STATUS_REMOVED` は `_isSpecialDurationExpiredStatusRemovedEvent()` と `_planDurationEndRevertPlaybackPhase()` により、効果発動後の後続 phase に寄せられる。

**アニメーションの扱い**
- `STATUS_APPLIED` は原則 purple/positive highlight。ただし `BLOCKADE` / `FREEZE` は highlight なし、`TIME_BOMB` / trap reveal は赤。
- `STATUS_REMOVED` は通常石への crossfade や overlay fade。`freeze duration_end` は freeze overlay fade、`loss_will_reset` は crossfade がテストされている。

**効果音の扱い**
- 持続切れの `STATUS_REMOVED` は `special_reverted`。`stone_destroy` は追加しない。
- 強い意志の昇格は `strong_will_promoted`。

**Event Sequence 例: 凍結の意志**
1. `STATUS_APPLIED`
   - meta.special: `FREEZE`
   - timer: 5
2. `STATUS_TICK`
   - timer が変化した turn start
3. `STATUS_REMOVED`
   - reason: `duration_end`
4. playback:
   - `status_applied` / `status_removed`
5. sound:
   - 選択成功時 `freeze_select`
   - duration end は `special_reverted`

**関連コード参照**
- `game/logic/cards/markers.ts`: `addMarker()`。
- `game/logic/board_ops.ts`: `revertSpecialStoneAt()`。
- `game/turn/turn_pipeline_phases.ts`: `applyTurnStartPhase()`, `timerSnapshot`, `STATUS_TICK` emission。
- `game/turn/pipeline_ui_adapter.ts`: duration end phase helpers, `_planCoreSoundCues()`。
- `ui/animation-engine.ts`: `_resolveStatusChangeHighlightTone()`。

**関連テスト**
- `test/game.cards.markers-module.test.ts`
- `test/game.cards.effect-timing-module.test.ts`
- `test/game.pipeline-ui-adapter.special-revert-phase.test.ts`
- `test/ui.animation-engine.guard-timer.test.ts`

**未確認点**
- 全特殊石の bubble 文言は本メモでは対象外。

**壊れやすい点**
- hidden trap は `STATUS_APPLIED` を出さない例外。全 marker 追加に一律 event を出すと秘匿性が壊れる。
- overlay-only special (`GUARD`, `INHERITED_HYPERACTIVE`, `LIVING_WILL`) は visual special の扱いが通常特殊石と異なる。

## ターン開始・持続・アンカー発動系

**代表カード**
- 狙撃の意志、雷撃の意志、破壊龍、究極破壊神、究極反転龍、繁殖、多動系、ロボット掃除機、悪食、意志狩りの王、観測、出稼ぎ、時間停石、時限爆弾、罠、救済神の持続切れ。

**仕様上の説明**
- `01-rulebook.md` はターン開始処理を最初に固定し、複数 marker は `createdSeq` 昇順、同ターン開始中に生成された marker はそのターン開始では発動しない、と定める。

**実装上の処理順**
- `turn_pipeline.ts`: `applyTurn()` の最初に `applyTurnStartPhase()`。
- `turn_pipeline_phases.ts`: `applyTurnStartPhase()` は pending cache sync、round bonus、`CardLogic.onTurnStart()`、marker snapshot、marker `createdSeq` sort の順で進む。
- marker loop は `createdSeq` 昇順の各 marker について type を判定し、爆弾、究極破壊神、破壊龍、狙撃、雷撃、意志狩り、観測、時間停石、究極反転龍、繁殖、多動系、ロボ掃除機、悪食、究極多動神などの処理へ dispatch する。
- loop 後、hyperactive flip による Regen/Living Will、trap、observer/work/special stone bubble、timer tick を処理する。

**主な BoardOps API**
- `runEffectBlock()`, `destroyAt()`, `moveAt()`, `changeAt()`, `spawnAt()`, `revertSpecialStoneAt()`。

**発生する presentation event**
- 各 effect の `DESTROY`, `MOVE`, `CHANGE`, `SPAWN`, `STATUS_REMOVED`, `STATUS_TICK`, `OBSERVER_TRIGGERED`, `SPECIAL_STONE_BUBBLE`。

**playback phase の決まり方**
- presentation event の列順と `_plan*Playback()` が決める。
- turn start の複数 marker 由来効果は、同一 action/effectBlock か、destroy cause/grouping により同 phase になる場合と分かれる場合がある。

**アニメーションの扱い**
- 各 event type の generic handler に加え、source animation profile と move semantics が適用される。

**効果音の扱い**
- `appendSoundEffectPlaybackEvents()` が raw events (`*_start`) と playback event を見て補助音を追加する。

**Event Sequence 例: 究極破壊神 turn start**
1. `MOVE`
   - cause: `ULTIMATE_DESTROY_GOD`
   - reason: `ultimate_destroy_god_move`
2. `DESTROY`
   - cause: `ULTIMATE_DESTROY_GOD`
   - reason: `udg_destroyed`
3. playback:
   - anchor move phase
   - destroy phase（複数対象は batch）
4. sound:
   - `ultimate_anchor_move`
   - destroy phase ごとに `stone_destroy`

**関連コード参照**
- `game/turn/turn_pipeline.ts`: `applyTurn()`。
- `game/turn/turn_pipeline_phases.ts`: `applyTurnStartPhase()`。
- `game/logic/cards/*`: 各 `process*AtTurnStartAnchor()`。

**関連テスト**
- `test/game.turn-pipeline-strong-will-timer.test.ts`
- `test/game.turn-pipeline.pending-cache-turn-start.test.ts`
- `test/game.udg-duration.test.ts`
- `test/game.destroy-dragon-will.test.ts`
- `test/game.lightning-will.test.ts`

**未確認点**
- `CardLogic.onTurnStart()` 内のすべての state-only 処理は本メモでは個別展開していない。

**壊れやすい点**
- `createdSeq` sort を崩すと仕様と replay 順序が変わる。
- turn start 中に生成された marker を同 turn start で処理すると仕様違反になる。

## 複合効果

### `DESTROY -> SPAWN`

**代表カード**
- 救済神 revive、増殖の意志、Living Will restore の一部。

**処理順**
- `BoardOps.destroyAt()` が `DESTROY` を emit。
- 増殖は `_destroyAtCore()` 内で同じ破壊処理中に `SPAWN` (`PROLIFERATION_WILL`)。
- 救済神は destroy block / effect block 終了後に `_flushStoneSalvationGodDestroyBlock()` が `SPAWN` (`STONE_SALVATION_GOD`)。

**Event Sequence 例: 増殖石が破壊対象になる**
1. `DESTROY`
   - meta.proliferated: true
2. `SPAWN`
   - cause: `PROLIFERATION_WILL`
   - reason: `proliferation_spawn`
3. playback:
   - destroy phase
   - clone-like `move` spawn phase
4. sound:
   - preserve outcome なので generic `stone_destroy` は鳴らない
   - `clone_spawn`

**壊れやすい点**
- 増殖は `DESTROY` が出ても disc を消さない。`meta.proliferated` を見ずに消すと演出が壊れる。

### `DESTROY -> MOVE -> SPAWN`

**代表カード**
- 悪食 (`GLUTTONOUS_WILL`) + 救済神。
- 意志狩りの王 (`WILL_HUNTER_KING`) + 救済神。

**処理順**
- 悪食/意志狩りは先に対象石を `destroyAt()` で破壊し、対象セルが空いた場合に同じ効果内で `moveAt()` する。
- `runEffectBlock()` により救済神 revive は破壊直後ではなく、破壊+移動が終わった後に flush される。
- 破壊回避 (`DESTROY_EVADE`) は `DESTROY` を emit せず `MOVE` outcome になるため、この sequence には含めない。

**Event Sequence 例: 意志狩りの王が救済対象を斬る**
1. `DESTROY`
   - cause: `WILL_HUNTER_KING`
   - reason: `will_hunter_king_slash`
2. `MOVE`
   - cause: `WILL_HUNTER_KING`
   - reason: `will_hunter_king_slash_move`
3. `SPAWN`
   - cause: `STONE_SALVATION_GOD`
   - reason: `stone_salvation_god_revive`
4. playback:
   - destroy/move same slash phase
   - revive spawn phase
5. sound:
   - slash phase に `stone_destroy`
   - revive phase に `breeding_spawn`

**壊れやすい点**
- 破壊 block が移動前に閉じると、救済 `SPAWN` が `MOVE` より先に出る。
- 破壊回避は `DESTROY` event を出さないため、「破壊対象になった」ことと `DESTROY` event が出たことは一致しない。

### `MOVE -> DESTROY -> SPAWN`

**代表カード**
- 究極破壊神 (`ULTIMATE_DESTROY_GOD`) + 救済神。
- ロボット掃除機 (`ROBOT_VACUUM`) + 救済神。

**処理順**
- 究極破壊神は turn start anchor で先に `MOVE` し、その移動後アンカー位置から隣接敵石を `DESTROY` する。
- ロボット掃除機は `moveRobotVacuumOnce()` で移動後、移動後アンカー位置から吸い込み対象を `DESTROY` する。
- 破壊対象が増殖なら `DESTROY` meta.proliferated + `SPAWN`。
- 破壊対象の owner 側に救済神がいれば effect block flush 後に `STONE_SALVATION_GOD` `SPAWN`。

**Event Sequence 例: 究極破壊神が移動後に隣接石を破壊する**
1. `MOVE`
   - cause: `ULTIMATE_DESTROY_GOD`
   - reason: `ultimate_destroy_god_move`
2. `DESTROY`
   - cause: `ULTIMATE_DESTROY_GOD`
   - reason: `udg_destroyed`
3. `SPAWN`
   - cause: `STONE_SALVATION_GOD`
   - reason: `stone_salvation_god_revive`
4. playback:
   - anchor move phase
   - destroy phase
   - revive spawn phase
5. sound:
   - move phase に `ultimate_anchor_move`
   - destroy phase に `stone_destroy`
   - revive phase に `breeding_spawn`

**壊れやすい点**
- 究極破壊神は「移動前アンカー」ではなく「移動後アンカー」から破壊するため、sourceRow/sourceCol の扱いを変えると弾道/雷撃 source がずれる。
- ロボット掃除機は吸い込み専用音 `robot_vacuum_suck` を使い、通常の `stone_destroy` を追加しない。

### `DESTROY -> STATUS_APPLIED -> SPAWN`

**代表カード**
- 隕石、盤面縮小 + 救済神。

**処理順**
- `meteor.ts` / `shrink.ts` が石ありセルに `destroyAt()` を実行。
- 続けて `applyHoleAt()` が `METEOR_HOLE` を付与し `STATUS_APPLIED`。
- destroy block / cell removal block 終了後に救済神 queue が flush され `SPAWN`。

**Event Sequence 例: 救済神 + 隕石**
1. `DESTROY`
   - cause: `METEOR_WILL`
   - reason: `meteor_cell_destroy`
2. `STATUS_APPLIED`
   - meta.special: `METEOR_HOLE`
3. `SPAWN`
   - cause: `STONE_SALVATION_GOD`
   - reason: `stone_salvation_god_revive`
4. playback:
   - destroy phase
   - hole status phase
   - revive spawn phase
5. sound:
   - revive phase に `breeding_spawn`
   - board shrink variant は `board_shrink_selected`

**壊れやすい点**
- 救済 revive は穴化後。穴化前に flush すると、元マス除外や `METEOR_HOLE` visual と競合する。

## 救済神 (`STONE_SALVATION_GOD`) 深掘り

**確認できた事実**
- 仕様: `01-rulebook.md` では、救済神が盤面にいる間、自石が破壊された場合、同じターンの同一破壊ブロック完了後に救済する。救済神自身は救済対象外。救済後は通常石になり、特殊状態・保護・爆弾・回避回数・付帯効果を引き継がない。復活では通常反転しない。
- 実装: `BoardOps._findStoneSalvationGodMarker()` が owner の有効な marker を探す。
- `BoardOps._queueDestroyedStoneForStoneSalvationGod()` は owner/cause/reason/meta/turnIndex を `_stoneSalvationGodReviveBlockQueue` に積む。
- `BoardOps._isStoneSalvationGodMarkerAt()` により、破壊された石自身が救済神 marker だった場合は queue しない。
- `_flushStoneSalvationGodDestroyBlock()` は block 内で破壊された元マスを `excludeReviveCells` に入れ、他に空きがある限り復活先から除外する。
- `_reviveDestroyedStoneByStoneSalvationGod()` は `spawnAt(..., 'STONE_SALVATION_GOD', 'stone_salvation_god_revive')` を呼び、meta に `sourceSpecial`, `revivedFromRow/Col`, `sourceRow/Col`, `sameTurnRevive`, `destroyedCause`, `destroyedReason` を入れる。
- `runEffectBlock()` は default `rescueFlush !== false` で、外側 effect block 終了時に flush する。
- `runDestroyBlock()` は外側 destroy block 終了時に flush する。
- 隕石/盤面縮小は `DESTROY -> STATUS_APPLIED -> SPAWN` が `test/game.stone-salvation-god.test.ts` で確認されている。

**presentation / playback / sound / animation**
- raw presentation は `SPAWN`。
- `pipeline_ui_adapter.ts`: `CARD_EFFECT_SPAWN_PROFILES` で `STONE_SALVATION_GOD` + `stone_salvation_god_revive` は `alwaysAdvancePhase: true`。
- `_orderDeferredSpawnsForPlayback()` は救済 revive を deferred spawn として、関連 destroy/move block の後に並べる。
- sound は `breeding_spawn`（sourceType は `stone_salvation_god_revive`）。`test/game.pipeline-ui-adapter.sound-cue.test.ts` で確認されている。
- animation は `ui/animation-engine.ts` の positive spawn highlight。`test/ui.animation-engine.guard-timer.test.ts` に「Stone Salvation God revive keeps purple cell highlight visible briefly」がある。

**破壊系カードとの組み合わせ**
- 狙撃・雷撃・破壊龍・究極破壊神・悪食・意志狩り・ロボ掃除機など、最終的に `BoardOps.destroyAt()` の通常破壊 branch に入るものは救済 queue 対象。
- Ghost block / Regen / Living Will / proliferation / destroy evade など、通常破壊 branch まで到達しない outcome は通常の救済 queue とは別挙動。
- 救済神自身が破壊された場合は `wasStoneSalvationGodForDestroy` により queue しない。

**関連テスト**
- `test/game.stone-salvation-god.test.ts`: 自石破壊救済、救済神自身の対象外、`runDestroyBlock()`, `runEffectBlock()`, 破壊龍/意志狩り/隕石/盤面縮小との組み合わせ、持続切れ。
- `test/game.pipeline-ui-adapter.spawn.test.ts`: revive spawn の phase/order。
- `test/game.pipeline-ui-adapter.sound-cue.test.ts`: revive sound cue。
- `test/ui.animation-engine.guard-timer.test.ts`: purple highlight。

**未確認点**
- 複数の救済神 marker が同 owner に存在する場合、実装は `_findStoneSalvationGodMarker()` の最初の 1 つを source とする。複数体時の仕様文言は今回確認範囲では詳細未記載。

**壊れやすい点**
- `_stoneSalvationGodDestroyBlockDepth` と `_effectBlockDepth` の関係が救済 timing を決めているため、block nesting の変更は revive 順序に直撃する。
- `_clonePresentationMeta()` は PRNG を meta から除外する。meta に random source を混ぜたまま永続化すると replay payload が壊れる。

## 追加の未確認点

- `worker-public/` mirror は調査対象として読んでいない。root 実装が正本であり、本メモは root 実装に基づく。
- 実ブラウザで全カードを手動再生して確認したわけではない。演出事実は `ui/animation-engine.ts` と既存 UI/Jest テストから確認した範囲。
- `01-rulebook.md` のカード節には重複/古い断片らしき行もあるが、本メモでは実装・テストと照合できる箇所だけを採用した。

## Known Fragile Areas

| Area | 壊れやすい理由 | 主な参照先 |
| --- | --- | --- |
| `DESTROY` と救済神 `SPAWN` の順序 | 救済神 revive は `destroyAt()` 直後ではなく destroy/effect block 終了時に flush される。block depth や deferred spawn ordering を変えると、破壊演出より先に救済が見える可能性がある。 | `game/logic/board_ops.ts`: `runDestroyBlock()`, `runEffectBlock()`, `_flushStoneSalvationGodDestroyBlock()` / `game/turn/pipeline_ui_adapter.ts`: `_orderDeferredSpawnsForPlayback()` |
| `DESTROY -> MOVE -> SPAWN` | 悪食・意志狩りは破壊後に同じ効果内で移動する。破壊 block が短すぎると救済 `SPAWN` が `MOVE` より先に出る。 | `game/logic/cards/hyperactive.ts`, `game/logic/cards/will_hunter_king.ts`, `test/game.stone-salvation-god.test.ts` |
| `MOVE -> DESTROY -> SPAWN` | 究極破壊神・ロボット掃除機などは移動後に破壊する。複数アンカーが同ターンに存在すると、action/effect block の識別が phase と sound cue に影響する。 | `game/logic/cards/udg.ts`, `game/logic/cards/hyperactive.ts`, `game/turn/turn_pipeline_phases.ts`, `game/turn/pipeline_ui_adapter.ts` |
| 破壊音の重複抑制 | 破壊対象数ではなく playback phase ごとに 1 回鳴らす仕様。target 数ベースの cue 生成へ戻すと、究極破壊神などで同時破壊数ぶん音が重複する。 | `game/turn/pipeline_ui_adapter.ts`: `_planDestroySoundCues()`, `_pushCueForMatchingEventPhases()` |
| `DESTROY` outcome meta | Ghost/Regen/増殖/破壊回避は `DESTROY` event を出しても盤面から消えないことがある。`DESTROY` を常に空化とみなすと animation/sound が壊れる。 | `game/logic/board_ops.ts`: `_destroyAtCore()` / `shared/destroy-outcome-contract.ts` |
| `STATUS_APPLIED` と穴マス化 | 隕石・盤面縮小は石破壊と穴化が連続する。穴化だけのカードと、破壊+穴化のカードを同じ扱いにすると救済神 trigger が誤る。 | `game/logic/cards/meteor.ts`, `game/logic/cards/shrink.ts`, `game/logic/board_ops.ts`: `applyHoleAt()` |
| ターン開始アンカー順 | `createdSeq` 順の解決と、各アンカーを個別 effect block にする前提が演出順・救済順に影響する。 | `game/turn/turn_pipeline_phases.ts` |
| presentation と UI playback の境界 | `game/` は headless で、音・DOM・timer を持たない。UI 側の都合を `game/` に持ち込むと network/headless parity が壊れる。 | `docs/architecture-contracts.md`, `game/turn/pipeline_ui_adapter.ts`, `ui/animation-engine.ts` |
| worker mirror / network parity | root 実装が正本で `worker-public/` は mirror。root 変更後に mirror や playback contract を同期しないとネット対戦とブラウザ配布面がずれる。 | `scripts/prepare-worker-assets.ts`, `test/network.playback-event-assembly.contract.test.ts`, `npm run test:network:parity` |

## Verification Map

| Test file | Covers |
| --- | --- |
| `test/game.stone-salvation-god.test.ts` | 救済神の同ターン revive、救済神自身の対象外、destroy/effect block flush、`DESTROY -> SPAWN`、`DESTROY -> MOVE -> SPAWN`、隕石/盤面縮小との順序。 |
| `test/game.pipeline-ui-adapter.sound-cue.test.ts` | `stone_destroy`、`bomb_explode`、`robot_vacuum_suck`、救済 revive sound、究極破壊神の同時複数破壊音、phase ごとの破壊音、同一 phase の重複抑制。 |
| `test/game.pipeline-ui-adapter.spawn.test.ts` | `SPAWN` playback、救済神 revive の deferred ordering、positive spawn profile。 |
| `test/game.pipeline-ui-adapter.move.test.ts` | `MOVE` playback、移動 phase、移動系 presentation event の基本変換。 |
| `test/game.pipeline-ui-adapter.move-metadata.test.ts` | move metadata、stone/status/marker 表示情報、特殊移動の playback target。 |
| `test/ui.animation-engine.guard-timer.test.ts` | special/timer 表示、guard/timer 系 animation integration。 |
| `test/game.sniper-will.test.ts` | 狙撃の意志のターン開始破壊、対象選択、持続処理。 |
| `test/game.lightning-will.test.ts` | 雷撃の意志のターン開始破壊、対象選択、持続処理。 |
| `test/game.destroy-dragon-will.test.ts` | 破壊龍の隣接破壊、持続処理。 |
| `test/game.udg-duration.test.ts` | 究極破壊神の持続ターン、アンカー処理。 |
| `test/game.will-hunter-king.test.ts` | 意志狩りの王の破壊・移動・持続処理。 |
| `test/game.x-bomb.test.ts` | X爆弾の範囲破壊と presentation event。 |
| `test/game.meteor-will.test.ts` / `test/game.logic.meteor-module.test.ts` | 隕石の破壊+穴化、空きマス穴化。 |
| `test/game.cell-teleport-will.test.ts` | マステレポートの移動と穴化、破壊ではない穴マス化。 |
| `test/game.freeze-will.test.ts` | 凍結 marker、`STATUS_APPLIED`、状態付与。 |
| `test/game.seed-will.test.ts` | 種 marker、芽生え spawn、seed invalidation。 |
| `test/game.proliferation-will.test.ts` | 増殖石、破壊時 preserve outcome、spawn/clone-like 表示。 |
| `test/network.playback-event-assembly.contract.test.ts` | headless/worker/local の playback event assembly parity。 |
