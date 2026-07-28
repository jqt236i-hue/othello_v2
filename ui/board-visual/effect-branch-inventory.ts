import type { BoardVisualEffectFamily } from './effect-bounds';

/**
 * Machine-readable Phase 7 assignment table.
 *
 * This is presentation metadata only. It must not be used to derive gameplay
 * results, reorder canonical events, or create a second final board writer.
 */
export type BoardVisualBranchRoute = 'board-local' | 'global-dom' | 'hybrid';
export type BoardVisualBranchSourceKind =
  | 'playback-event'
  | 'frame-state'
  | 'frame-topology-delta';
export type BoardVisualEffectBlockPolicy =
  | 'preserve-playback-base'
  | 'ordered-event'
  | 'action-scoped-shared-destroy-move'
  | 'cause-action-effect-block-batch'
  | 'presentation-batch-only'
  | 'hybrid-shared-settlement'
  | 'board-source-shared-settlement'
  | 'frame-revision-only';

export interface BoardVisualEffectBranchInventoryEntry {
  readonly id: string;
  /** Stable ID implemented by the independent executable fixture registry. */
  readonly automatedFixtureId: string;
  readonly category:
    | 'core'
    | 'special-destroy'
    | 'special-stone'
    | 'status'
    | 'legacy'
    | 'theory'
    | 'observer'
    | 'manifest'
    | 'topology'
    | 'retained-global';
  readonly sourceKind: BoardVisualBranchSourceKind;
  readonly source: string;
  readonly eventTypes: readonly string[];
  readonly rawTypes: readonly string[];
  readonly profileKey: string | null;
  readonly causes: readonly string[];
  readonly reasonPrefixes: readonly string[];
  readonly specialTypes: readonly string[];
  readonly metaVariants: readonly string[];
  readonly effectBlockPolicy: BoardVisualEffectBlockPolicy;
  readonly effectFamilies: readonly BoardVisualEffectFamily[];
  readonly route: BoardVisualBranchRoute;
  /** Only Pixi may own a final stone/cell pixel; global DOM branches own none. */
  readonly finalPixelWriter: 'pixi' | 'none';
  readonly renderers: readonly string[];
  readonly unitFixture: string;
  readonly browserAssertion: string;
  readonly noAnimationAssertion: string;
  readonly cornerEdgeAssertion: string;
}

type BranchInput = Omit<
  BoardVisualEffectBranchInventoryEntry,
  | 'automatedFixtureId'
  | 'eventTypes'
  | 'rawTypes'
  | 'profileKey'
  | 'causes'
  | 'reasonPrefixes'
  | 'specialTypes'
  | 'metaVariants'
> & Partial<Pick<
  BoardVisualEffectBranchInventoryEntry,
  | 'eventTypes'
  | 'rawTypes'
  | 'profileKey'
  | 'causes'
  | 'reasonPrefixes'
  | 'specialTypes'
  | 'metaVariants'
>>;

function strings(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...(values || [])]);
}

function executableBrowserAssertion(reference: string): string {
  const normalized = String(reference || '').trim();
  if (!/^[^#]+#[^#]+$/.test(normalized)) {
    throw new Error(`Invalid Phase 7 browser assertion reference: ${normalized}`);
  }
  return normalized;
}

function playbackBrowserScenario(name: string): string {
  return `scripts/pixijs-board-playback-browser-check.ts#scenario:${name}`;
}

function staticBrowserFixture(name: string): string {
  return `scripts/pixijs-board-browser-check.ts#fixture:${name}`;
}

function defineBranch(input: BranchInput): BoardVisualEffectBranchInventoryEntry {
  return Object.freeze({
    ...input,
    automatedFixtureId: `phase7/${input.id}`,
    eventTypes: strings(input.eventTypes),
    rawTypes: strings(input.rawTypes),
    profileKey: input.profileKey || null,
    causes: strings(input.causes),
    reasonPrefixes: strings(input.reasonPrefixes),
    specialTypes: strings(input.specialTypes),
    metaVariants: strings(input.metaVariants),
    effectFamilies: Object.freeze([...input.effectFamilies]),
    renderers: strings(input.renderers),
    browserAssertion: executableBrowserAssertion(input.browserAssertion),
    // These three contracts are executed by the same per-branch fixture. The
    // previous prose-like `#anchor` values only proved that a file existed.
    unitFixture: `test/ui.board-visual-effect-branch-inventory.test.ts#phase7/${input.id}`,
    noAnimationAssertion: `test/ui.board-visual-effect-branch-inventory.test.ts#phase7/${input.id}`,
    cornerEdgeAssertion: `test/ui.board-visual-effect-branch-inventory.test.ts#phase7/${input.id}`
  });
}

const PIXI_PLAYBACK_UNIT = 'test/ui.pixi-board-playback.test.ts#branch fixture settles and releases leases';
const PIXI_NOANIM = 'test/ui.pixi-board-playback.test.ts#NOANIM follows the same start-settle-final-sync path';
const RETAINED_GLOBAL_BROWSER = 'test/e2e/special_effects.e2e.test.ts#retained global presentation branches stay DOM-only and preserve Pixi final pixels';

function localEdge(family: BoardVisualEffectFamily): string {
  return `test/ui.board-visual-effect-bounds.test.ts#${family} four-corner and four-edge gutter`;
}

function globalEdge(family: BoardVisualEffectFamily): string {
  return `test/ui.board-visual-effect-bounds.test.ts#${family} remains unbounded global DOM`;
}

interface SpecialDestroyInput {
  readonly id: string;
  readonly profileKey: string;
  readonly causes: readonly string[];
  readonly reasonPrefix: string;
  readonly sourceTrajectory?: boolean;
  readonly effectBlockPolicy?: BoardVisualEffectBlockPolicy;
  readonly browserAssertion?: string;
}

function specialDestroy(input: SpecialDestroyInput): BoardVisualEffectBranchInventoryEntry {
  const sourceTrajectory = input.sourceTrajectory === true;
  return defineBranch({
    id: input.id,
    category: 'special-destroy',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planDestroyPlayback',
    eventTypes: ['destroy'],
    rawTypes: ['DESTROY'],
    profileKey: input.profileKey,
    causes: input.causes,
    reasonPrefixes: [input.reasonPrefix],
    effectBlockPolicy: input.effectBlockPolicy || 'ordered-event',
    effectFamilies: sourceTrajectory ? ['destroy', 'board-source-trajectory'] : ['destroy'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: sourceTrajectory
      ? [
        'ui/pixi/effects/destroy.ts#playPixiDestroyEffect',
        'ui/pixi/effects/source-trajectory.ts#createPixiSourceTrajectoryRenderer'
      ]
      : ['ui/pixi/effects/destroy.ts#playPixiDestroyEffect'],
    unitFixture: 'test/ui.pixi-board-playback.test.ts#special DESTROY profile fixture',
    browserAssertion: input.browserAssertion || playbackBrowserScenario(
      sourceTrajectory ? 'special-destroy-hybrid' : 'destroy'
    ),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: sourceTrajectory
      ? localEdge('board-source-trajectory')
      : localEdge('destroy')
  });
}

function batchedDestroy(
  id: string,
  cause: string,
  browserAssertion = playbackBrowserScenario('destroy')
): BoardVisualEffectBranchInventoryEntry {
  return defineBranch({
    id,
    category: 'special-destroy',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planDestroyPlayback',
    eventTypes: ['destroy'],
    rawTypes: ['DESTROY'],
    causes: [cause],
    effectBlockPolicy: 'cause-action-effect-block-batch',
    effectFamilies: ['destroy'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/destroy.ts#playPixiDestroyEffect'],
    unitFixture: 'test/ui.pixi-board-playback.test.ts#effectBlock-batched DESTROY fixture',
    browserAssertion,
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('destroy')
  });
}

function statusBranch(input: {
  readonly id: string;
  readonly eventTypes: readonly ('status_applied' | 'status_removed')[];
  readonly rawTypes?: readonly string[];
  readonly causes?: readonly string[];
  readonly reasonPrefixes?: readonly string[];
  readonly specialTypes?: readonly string[];
  readonly metaVariants?: readonly string[];
  readonly family?: 'status' | 'board_shrink';
  readonly unitFixture?: string;
  readonly browserAssertion?: string;
}): BoardVisualEffectBranchInventoryEntry {
  const family = input.family || 'status';
  return defineBranch({
    id: input.id,
    category: 'status',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: input.eventTypes,
    rawTypes: input.rawTypes,
    causes: input.causes,
    reasonPrefixes: input.reasonPrefixes,
    specialTypes: input.specialTypes,
    metaVariants: input.metaVariants,
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: [family],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/status.ts#playPixiStatusEffect'],
    unitFixture: input.unitFixture || 'test/ui.animation-engine.guard-timer.test.ts#status branch fixture',
    browserAssertion: input.browserAssertion || playbackBrowserScenario('status'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge(family)
  });
}

const SPECIAL_STONE_SCENARIOS = Object.freeze([
  'place',
  'destroy',
  'duration_end',
  'normal_revert',
  'proliferation_triggered',
  'time_stop_triggered',
  'time_stop_deity_triggered',
  'regen_triggered',
  'zombie_infection',
  'zombie_revived',
  'card_nullified',
  'ghost_protected',
  'escape_exploded',
  'special_destroy_triggered',
  'work_income',
  'income',
  'self_destruct',
  'living_will_restored'
]);

const SPECIAL_STONE_SPEECH_TYPES = Object.freeze([
  'PROTECTED',
  'PERMA_PROTECTED',
  'SNIPER',
  'GHOST',
  'SACRIFICE',
  'AFTERIMAGE_WILL',
  'TIME_STOP',
  'TIME_STOP_DEITY',
  'REGEN',
  'ZOMBIE',
  'DRAGON',
  'BREEDING',
  'PROLIFERATION',
  'HYPERACTIVE',
  'EXTREME_HYPERACTIVE',
  'ESCAPE_HYPERACTIVE',
  'ROBOT_VACUUM',
  'GLUTTONOUS',
  'WILL_HUNTER_KING',
  'WORK',
  'STONE_SALVATION_GOD',
  'DESTROY_DRAGON',
  'LIGHTNING',
  'ULTIMATE_DESTROY_GOD',
  'ULTIMATE_HYPERACTIVE',
  'METEOR_GOD',
  'ULTIMATE_WORK_GOD'
]);

export const PHASE7_EFFECT_BRANCH_INVENTORY = Object.freeze([
  defineBranch({
    id: 'place-board-local',
    category: 'core',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#createPlaybackEvent',
    eventTypes: ['place'],
    rawTypes: ['PLACE'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['place'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/place.ts#playPixiPlaceEffect'],
    unitFixture: PIXI_PLAYBACK_UNIT,
    browserAssertion: playbackBrowserScenario('place'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('place')
  }),
  defineBranch({
    id: 'spawn-standard-and-breeding',
    category: 'core',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planSpawnPlayback',
    eventTypes: ['spawn'],
    rawTypes: ['SPAWN'],
    causes: ['BREEDING', 'REINFORCEMENT_WILL', 'SUPPORT_TROOPS_WILL', 'EQUALITY_WILL', 'SALVATION_WILL', 'STONE_SALVATION_GOD', 'SEED_WILL', 'GRASS_WILL'],
    metaVariants: ['normal_spawn', 'breeding_spawn', 'salvation_spawn'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['spawn'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/spawn.ts#playPixiSpawnEffect'],
    unitFixture: 'test/game.pipeline-ui-adapter.spawn.test.ts#spawn playback fixture',
    browserAssertion: playbackBrowserScenario('spawn'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('spawn')
  }),
  defineBranch({
    id: 'move-all-board-variants',
    category: 'core',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planMovePlaybackPhase',
    eventTypes: ['move'],
    rawTypes: ['MOVE'],
    metaVariants: ['standard', 'teleport', 'clone', 'hyperactive', 'forced_swap', 'buoyancy', 'gravity', 'attraction', 'overlap_return'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['move'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/move.ts#playPixiMoveEffect'],
    unitFixture: PIXI_PLAYBACK_UNIT,
    browserAssertion: playbackBrowserScenario('move'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('move')
  }),
  defineBranch({
    id: 'flip-standard',
    category: 'core',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planChangePlaybackPhase',
    eventTypes: ['flip'],
    rawTypes: ['CHANGE'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['flip'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/flip.ts#playPixiFlipEffect'],
    unitFixture: 'test/ui.animation-flip-events.test.ts#standard flip fixture',
    browserAssertion: playbackBrowserScenario('flip'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('flip')
  }),
  defineBranch({
    id: 'flip-zombie-infection',
    category: 'special-stone',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planChangePlaybackPhase',
    eventTypes: ['flip'],
    rawTypes: ['CHANGE'],
    causes: ['ZOMBIE'],
    reasonPrefixes: ['zombie_infection'],
    effectBlockPolicy: 'board-source-shared-settlement',
    effectFamilies: ['flip', 'board-source-trajectory'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: [
      'ui/pixi/effects/flip.ts#playPixiFlipEffect',
      'ui/pixi/effects/source-trajectory.ts#createPixiSourceTrajectoryRenderer'
    ],
    unitFixture: 'test/ui.animation-flip-events.test.ts#zombie infection source and target fixture',
    browserAssertion: playbackBrowserScenario('zombie-infection-source'),
    noAnimationAssertion: 'test/ui.animation-flip-events.test.ts#NOANIM zombie uses immediate shared settlement',
    cornerEdgeAssertion: localEdge('board-source-trajectory')
  }),
  defineBranch({
    id: 'destroy-generic-remove',
    category: 'core',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planDestroyPlayback',
    eventTypes: ['destroy'],
    rawTypes: ['DESTROY'],
    effectBlockPolicy: 'ordered-event',
    effectFamilies: ['destroy'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/destroy.ts#playPixiDestroyEffect'],
    unitFixture: PIXI_PLAYBACK_UNIT,
    browserAssertion: playbackBrowserScenario('destroy'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('destroy')
  }),
  defineBranch({
    id: 'destroy-preserved-outcome',
    category: 'special-destroy',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planDestroyPlayback',
    eventTypes: ['destroy'],
    rawTypes: ['DESTROY'],
    metaVariants: ['blockedByGhost', 'proliferated', 'regenerated'],
    effectBlockPolicy: 'ordered-event',
    effectFamilies: ['destroy'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/destroy.ts#playPixiDestroyEffect'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#destroy preserve-outcome fixtures',
    browserAssertion: playbackBrowserScenario('destroy'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('destroy')
  }),

  specialDestroy({ id: 'destroy-sniper-shot', profileKey: 'sniperShot', causes: ['SNIPER_WILL'], reasonPrefix: 'sniper_shot', sourceTrajectory: true }),
  specialDestroy({ id: 'destroy-lightning-will', profileKey: 'lightningDestroyed', causes: ['LIGHTNING_WILL'], reasonPrefix: 'lightning_destroyed', sourceTrajectory: true }),
  specialDestroy({ id: 'destroy-dragon-breath', profileKey: 'destroyDragonBreath', causes: ['DESTROY_DRAGON_WILL', 'DESTROY_DRAGON'], reasonPrefix: 'destroy_dragon_breath', sourceTrajectory: true }),
  specialDestroy({ id: 'destroy-ultimate-destroy-god', profileKey: 'udgDestroyed', causes: ['ULTIMATE_DESTROY_GOD'], reasonPrefix: 'udg_destroyed', sourceTrajectory: true, effectBlockPolicy: 'cause-action-effect-block-batch' }),
  specialDestroy({ id: 'destroy-meteor-god-black-beam', profileKey: 'meteorGodBlackBeam', causes: ['METEOR_GOD'], reasonPrefix: 'meteor_god_cell_destroy', sourceTrajectory: true }),
  specialDestroy({ id: 'destroy-robot-vacuum-suck', profileKey: 'robotVacuumSuck', causes: ['ROBOT_VACUUM'], reasonPrefix: 'robot_vacuum_suck', sourceTrajectory: true }),
  specialDestroy({ id: 'destroy-gluttonous-eat', profileKey: 'gluttonousEat', causes: ['GLUTTONOUS_WILL'], reasonPrefix: 'gluttonous_eat', effectBlockPolicy: 'action-scoped-shared-destroy-move' }),
  specialDestroy({
    id: 'destroy-will-hunter-king-slash',
    profileKey: 'willHunterKingSlash',
    causes: ['WILL_HUNTER_KING'],
    reasonPrefix: 'will_hunter_king_slash',
    effectBlockPolicy: 'action-scoped-shared-destroy-move',
    browserAssertion: 'test/e2e/destroy-card-will-hunter-king.e2e.test.ts#破壊の意志で意志狩りの王を選んだ時は破壊回避して表示も移動先へ残る'
  }),
  specialDestroy({ id: 'destroy-super-buoyancy-collision', profileKey: 'superBuoyancyCollision', causes: ['BUOYANCY_WILL', 'SUPER_BUOYANCY_WILL'], reasonPrefix: 'super_buoyancy_collision', effectBlockPolicy: 'action-scoped-shared-destroy-move' }),
  specialDestroy({ id: 'destroy-super-gravity-collision', profileKey: 'superGravityCollision', causes: ['GRAVITY_WILL', 'SUPER_GRAVITY_WILL'], reasonPrefix: 'super_gravity_collision', effectBlockPolicy: 'action-scoped-shared-destroy-move' }),
  specialDestroy({ id: 'destroy-super-attraction-collision', profileKey: 'superAttractionCollision', causes: ['SUPER_ATTRACTION_WILL'], reasonPrefix: 'super_attraction_collision', effectBlockPolicy: 'action-scoped-shared-destroy-move' }),

  batchedDestroy('destroy-time-bomb-batch', 'TIME_BOMB'),
  batchedDestroy('destroy-cross-bomb-batch', 'CROSS_BOMB'),
  batchedDestroy('destroy-x-bomb-batch', 'X_BOMB'),
  batchedDestroy('destroy-escape-hyperactive-batch', 'ESCAPE_HYPERACTIVE'),
  batchedDestroy('destroy-board-shrink-will-batch', 'BOARD_SHRINK_WILL'),
  batchedDestroy('destroy-board-shrink-god-batch', 'BOARD_SHRINK_GOD'),
  defineBranch({
    id: 'destroy-meteor-will-before-hole',
    category: 'special-destroy',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planDestroyPlayback',
    eventTypes: ['destroy'],
    rawTypes: ['DESTROY'],
    causes: ['METEOR_WILL'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['destroy'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/destroy.ts#playPixiDestroyEffect'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#meteor destroy before hole fixture',
    browserAssertion: playbackBrowserScenario('destroy'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('destroy')
  }),

  statusBranch({
    id: 'status-guard-protected-and-generic',
    eventTypes: ['status_applied', 'status_removed'],
    rawTypes: ['STATUS_APPLIED', 'STATUS_REMOVED'],
    specialTypes: ['GUARD', 'PROTECTED', 'PERMA_PROTECTED', 'BLOCKADE', 'HEALING_CELL', 'TRAP_REVEAL'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#guard protected blockade and trap fixtures'
  }),
  statusBranch({
    id: 'status-tick-poison-cell',
    eventTypes: ['status_applied'],
    rawTypes: ['STATUS_TICK'],
    specialTypes: ['POISONED', 'POISON_CELL', 'SCORCHED', 'SCORCHED_CELL', 'HEALING_CELL'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#hazard tick only updates timer label'
  }),
  defineBranch({
    id: 'status-fire-will-scorched-cell',
    category: 'status',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['status_applied'],
    rawTypes: ['STATUS_APPLIED'],
    profileKey: 'fireWillFlameBeam',
    causes: ['FIRE_WILL'],
    reasonPrefixes: ['scorched_cell_applied'],
    specialTypes: ['SCORCHED_CELL'],
    effectBlockPolicy: 'board-source-shared-settlement',
    effectFamilies: ['status', 'board-source-trajectory'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: [
      'ui/pixi/effects/source-trajectory.ts#createPixiSourceTrajectoryRenderer',
      'ui/pixi/effects/status.ts#playPixiStatusEffect'
    ],
    unitFixture: 'test/ui.board-source-trajectory-contract.test.ts#fire will status trajectory fixture',
    browserAssertion: playbackBrowserScenario('status'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('board-source-trajectory')
  }),
  defineBranch({
    id: 'status-water-will-healing-cell',
    category: 'status',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['status_applied'],
    rawTypes: ['STATUS_APPLIED'],
    profileKey: 'waterWillHealingBeam',
    causes: ['WATER_WILL'],
    reasonPrefixes: ['healing_cell_applied'],
    specialTypes: ['HEALING_CELL'],
    effectBlockPolicy: 'board-source-shared-settlement',
    effectFamilies: ['status', 'board-source-trajectory'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: [
      'ui/pixi/effects/source-trajectory.ts#createPixiSourceTrajectoryRenderer',
      'ui/pixi/effects/status.ts#playPixiStatusEffect'
    ],
    unitFixture: 'test/ui.board-source-trajectory-contract.test.ts#water will status trajectory fixture',
    browserAssertion: playbackBrowserScenario('status'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('board-source-trajectory')
  }),
  defineBranch({
    id: 'status-grass-will-seed',
    category: 'status',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['status_applied'],
    rawTypes: ['STATUS_APPLIED'],
    profileKey: 'grassWillSeedBeam',
    causes: ['GRASS_WILL'],
    reasonPrefixes: ['grass_seeded'],
    specialTypes: ['SEED'],
    effectBlockPolicy: 'board-source-shared-settlement',
    effectFamilies: ['status', 'board-source-trajectory'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: [
      'ui/pixi/effects/source-trajectory.ts#createPixiSourceTrajectoryRenderer',
      'ui/pixi/effects/status.ts#playPixiStatusEffect'
    ],
    unitFixture: 'test/ui.board-source-trajectory-contract.test.ts#grass will status trajectory fixture',
    browserAssertion: playbackBrowserScenario('status'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('board-source-trajectory')
  }),
  statusBranch({
    id: 'status-tick-special-stone-timer',
    eventTypes: ['status_applied'],
    rawTypes: ['STATUS_TICK'],
    metaVariants: ['disc-timer'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#special stone duration tick fixture'
  }),
  statusBranch({
    id: 'status-regen-consumed-crossfade',
    eventTypes: ['status_removed'],
    rawTypes: ['STATUS_REMOVED'],
    reasonPrefixes: ['regen_consumed'],
    specialTypes: ['REGEN'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#regen consumed crossfade fixture'
  }),
  statusBranch({
    id: 'status-loss-will-reset-crossfade',
    eventTypes: ['status_removed'],
    rawTypes: ['STATUS_REMOVED'],
    reasonPrefixes: ['loss_will_reset'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#loss will reset crossfade fixture'
  }),
  statusBranch({
    id: 'status-freeze-duration-end',
    eventTypes: ['status_removed'],
    rawTypes: ['STATUS_REMOVED'],
    reasonPrefixes: ['duration_end'],
    specialTypes: ['FREEZE'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#freeze duration-end overlay fixture'
  }),
  statusBranch({
    id: 'status-meteor-hole',
    eventTypes: ['status_applied'],
    rawTypes: ['STATUS_APPLIED'],
    specialTypes: ['METEOR_HOLE'],
    metaVariants: ['standard-hole'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#meteor hole fixture',
    browserAssertion: playbackBrowserScenario('status')
  }),
  statusBranch({
    id: 'status-board-shrink-frame-hole',
    eventTypes: ['status_applied'],
    rawTypes: ['STATUS_APPLIED'],
    specialTypes: ['METEOR_HOLE'],
    metaVariants: ['BOARD_FRAME'],
    family: 'board_shrink',
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#board frame push-in fixture',
    browserAssertion: playbackBrowserScenario('topology-shrink')
  }),
  statusBranch({
    id: 'status-causal-replay-restoration',
    eventTypes: ['status_removed'],
    rawTypes: ['STATUS_REMOVED'],
    causes: ['CAUSAL_REPLAY_WILL'],
    reasonPrefixes: ['causal_replay_selected'],
    metaVariants: ['normal_empty_cell'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#causal replay restores cell styling'
  }),

  defineBranch({
    id: 'static-guard-protection-markers',
    category: 'special-stone',
    sourceKind: 'frame-state',
    source: 'ui/board-visual/model-builder.ts#buildBoardRenderModel',
    specialTypes: ['GUARD', 'PROTECTED', 'PERMA_PROTECTED'],
    effectBlockPolicy: 'frame-revision-only',
    effectFamilies: ['status'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/board-scene.ts#createPixiBoardScene'],
    unitFixture: 'test/ui.pixi-board-scene.test.ts#renders canonical countdown, protection, regen, evasion, and poison marker shapes in fixed slots',
    browserAssertion: staticBrowserFixture('presentation-special-timer-badge'),
    noAnimationAssertion: 'test/ui.pixi-board-scene.test.ts#static marker digest is NOANIM invariant',
    cornerEdgeAssertion: localEdge('status')
  }),
  defineBranch({
    id: 'static-regen-zombie-timer-badges',
    category: 'special-stone',
    sourceKind: 'frame-state',
    source: 'ui/board-visual/model-builder.ts#buildBoardRenderModel',
    specialTypes: ['REGEN', 'ZOMBIE'],
    effectBlockPolicy: 'frame-revision-only',
    effectFamilies: ['status'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/board-scene.ts#createPixiBoardScene'],
    unitFixture: 'test/ui.pixi-board-scene.test.ts#renders canonical countdown, protection, regen, evasion, and poison marker shapes in fixed slots',
    browserAssertion: staticBrowserFixture('presentation-special-timer-badge'),
    noAnimationAssertion: 'test/ui.pixi-board-scene.test.ts#static badge digest is NOANIM invariant',
    cornerEdgeAssertion: localEdge('status')
  }),
  defineBranch({
    id: 'static-poison-and-observer-markers',
    category: 'special-stone',
    sourceKind: 'frame-state',
    source: 'ui/board-visual/model-builder.ts#buildBoardRenderModel',
    specialTypes: ['POISONED', 'POISON_CELL', 'SCORCHED', 'SCORCHED_CELL', 'HEALING_CELL', 'OBSERVER'],
    effectBlockPolicy: 'frame-revision-only',
    effectFamilies: ['status'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/board-scene.ts#createPixiBoardScene'],
    unitFixture: 'test/ui.pixi-board-scene.test.ts#renders canonical countdown, protection, regen, evasion, and poison marker shapes in fixed slots',
    browserAssertion: staticBrowserFixture('presentation-special-timer-badge'),
    noAnimationAssertion: 'test/ui.pixi-board-scene.test.ts#static cell marker digest is NOANIM invariant',
    cornerEdgeAssertion: localEdge('status')
  }),

  defineBranch({
    id: 'legacy-crossfade-stone',
    category: 'legacy',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-mapper.ts#mapBoardPresentationEvent',
    eventTypes: ['crossfade_stone'],
    rawTypes: ['CROSSFADE_STONE'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['crossfade_stone'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/special-stone.ts#playPixiCrossfadeStoneEffect'],
    unitFixture: 'test/game.pipeline-ui-adapter.board-visual-effects.test.ts#crossfade stone payload fixture',
    browserAssertion: playbackBrowserScenario('crossfade-stone'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('crossfade_stone')
  }),
  defineBranch({
    id: 'legacy-protection-expire',
    category: 'legacy',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-mapper.ts#mapBoardPresentationEvent',
    eventTypes: ['protection_expire'],
    rawTypes: ['PROTECTION_EXPIRE'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['protection_expire'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/special-stone.ts#playPixiProtectionExpireEffect'],
    unitFixture: 'test/game.pipeline-ui-adapter.board-visual-effects.test.ts#protection expire payload fixture',
    browserAssertion: playbackBrowserScenario('protection-expire'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('protection_expire')
  }),
  ...([
    ['legacy-fade-out', 'legacy_fade_out', 'legacy_fade_out', 'playPixiLegacyFadeOutEffect'],
    ['legacy-strong-will-apply', 'legacy_strong_will_apply', 'legacy_strong_will_apply', 'playPixiLegacyStrongWillApplyEffect'],
    ['legacy-hyperactive-move', 'legacy_hyperactive_move', 'legacy_hyperactive_move', 'playPixiLegacyHyperactiveMoveEffect'],
    ['legacy-sacrifice-absorb-pulse', 'legacy_sacrifice_absorb_pulse', 'legacy_sacrifice_absorb_pulse', 'playPixiLegacySacrificeAbsorbPulseEffect']
  ] as const).map(([id, eventType, family, method]) => defineBranch({
    id,
    category: 'legacy',
    sourceKind: 'playback-event',
    source: 'ui/animation-utils.ts#animateFadeOutAt',
    eventTypes: [eventType],
    effectBlockPolicy: 'presentation-batch-only',
    effectFamilies: [family],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: [`ui/pixi/effects/special-stone.ts#${method}`],
    unitFixture: 'test/ui.animation-utils.test.ts#legacy wrapper dispatch fixture',
    browserAssertion: playbackBrowserScenario(id),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge(family)
  })),

  defineBranch({
    id: 'theory-incarnation-roulette-materialization',
    category: 'theory',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/board-event-playback.ts#planSpawnPlayback',
    eventTypes: ['theory_incarnation_spawn_roulette'],
    rawTypes: ['SPAWN'],
    metaVariants: ['theorySpawnRoulette', 'candidateCells', 'selectedCell'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['theory_incarnation_spawn_roulette'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/effects/theory-incarnation.ts#playPixiTheoryIncarnationEffect'],
    unitFixture: 'test/ui.theory-incarnation-animation.test.ts#roulette and selected materialization fixtures',
    browserAssertion: playbackBrowserScenario('theory-incarnation'),
    noAnimationAssertion: PIXI_NOANIM,
    cornerEdgeAssertion: localEdge('theory_incarnation_spawn_roulette')
  }),

  defineBranch({
    id: 'special-stone-speech-bubble',
    category: 'observer',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['observer_bubble'],
    rawTypes: ['SPECIAL_STONE_BUBBLE'],
    specialTypes: SPECIAL_STONE_SPEECH_TYPES,
    metaVariants: SPECIAL_STONE_SCENARIOS,
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['observer_bubble'],
    route: 'global-dom',
    finalPixelWriter: 'none',
    renderers: ['ui/animation-feedback-events.ts#handleObserverBubbleEvent'],
    unitFixture: 'test/ui.animation-special-stone-phase-batching.test.ts#special stone scenario and phase fixtures',
    browserAssertion: RETAINED_GLOBAL_BROWSER,
    noAnimationAssertion: 'test/ui.animation-engine.observer-bubble.test.ts#NOANIM speech cleans up immediately',
    cornerEdgeAssertion: globalEdge('observer_bubble')
  }),
  ...([
    ['observer-will-bubble', ['OBSERVER_BUBBLE']],
    ['work-income-and-removal-bubble', ['WORK_INCOME', 'WORK_REMOVED', 'WORK_BUBBLE']],
    ['charge-bubble', ['CHARGE_BUBBLE']]
  ] as const).map(([id, rawTypes]) => defineBranch({
    id,
    category: 'observer',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['observer_bubble'],
    rawTypes,
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['observer_bubble'],
    route: 'global-dom',
    finalPixelWriter: 'none',
    renderers: ['ui/animation-feedback-events.ts#handleObserverBubbleEvent'],
    unitFixture: 'test/ui.animation-engine.observer-bubble.test.ts#observer work and charge bubble fixtures',
    browserAssertion: RETAINED_GLOBAL_BROWSER,
    noAnimationAssertion: 'test/ui.animation-engine.observer-bubble.test.ts#NOANIM bubble immediate cleanup',
    cornerEdgeAssertion: globalEdge('observer_bubble')
  })),

  defineBranch({
    id: 'manifest-ending-board-and-world',
    category: 'manifest',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['manifest_ending'],
    rawTypes: ['STATUS_REMOVED'],
    reasonPrefixes: ['duration_end'],
    specialTypes: ['MANIFEST'],
    effectBlockPolicy: 'hybrid-shared-settlement',
    effectFamilies: ['manifest_ending_board', 'fullscreen'],
    route: 'hybrid',
    finalPixelWriter: 'pixi',
    renderers: [
      'ui/pixi/effects/manifest.ts#playPixiManifestEndingBoardEffect',
      'ui/animation-engine.ts#handleManifestEndingGlobal'
    ],
    unitFixture: 'test/ui.manifest-effect-panel.test.ts#manifest ending board and world fixture',
    browserAssertion: playbackBrowserScenario('manifest-ending-world'),
    noAnimationAssertion: 'test/ui.animation-engine.guard-timer.test.ts#NOANIM manifest board and dim settle together',
    cornerEdgeAssertion: 'test/ui.board-visual-effect-bounds.test.ts#manifest board gutter plus fullscreen global route'
  }),
  defineBranch({
    id: 'manifest-world-cinematic',
    category: 'manifest',
    sourceKind: 'playback-event',
    source: 'ui/animation-feedback-events.ts#handleSpecialCardCinematicEvent',
    eventTypes: ['special_card_cinematic'],
    specialTypes: ['MANIFEST'],
    metaVariants: ['world-effect', 'fullscreen-japanese-text', 'bgm-override'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['fullscreen'],
    route: 'global-dom',
    finalPixelWriter: 'none',
    renderers: ['ui/animation-feedback-events.ts#handleSpecialCardCinematicEvent'],
    unitFixture: 'test/ui.manifest-effect-panel.test.ts#manifest world panel fixture',
    browserAssertion: RETAINED_GLOBAL_BROWSER,
    noAnimationAssertion: 'test/ui.manifest-effect-panel.test.ts#NOANIM world state remains deterministic',
    cornerEdgeAssertion: globalEdge('fullscreen')
  }),

  defineBranch({
    id: 'topology-expansion-frame-delta',
    category: 'topology',
    sourceKind: 'frame-topology-delta',
    source: 'ui/board-visual/controller.ts#createBoardVisualController',
    rawTypes: ['BOARD_EXPANSION_FIRST_SELECTED', 'BOARD_EXPANSION_SELECTED'],
    metaVariants: ['top', 'right', 'bottom', 'left', 'multi-stage', 'negative-coordinate'],
    effectBlockPolicy: 'frame-revision-only',
    effectFamilies: ['board_expansion'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/board-scene.ts#createPixiBoardScene'],
    unitFixture: 'test/ui.board-expansion-cell-render.test.ts#old/new topology reveal fixture',
    browserAssertion: playbackBrowserScenario('topology-expansion'),
    noAnimationAssertion: 'test/ui.board-expansion-cell-render.test.ts#NOANIM applies committed topology through same settlement',
    cornerEdgeAssertion: localEdge('board_expansion')
  }),
  defineBranch({
    id: 'topology-shrink-frame-delta',
    category: 'topology',
    sourceKind: 'frame-topology-delta',
    source: 'ui/board-visual/controller.ts#createBoardVisualController',
    rawTypes: ['DESTROY', 'STATUS_APPLIED'],
    causes: ['BOARD_SHRINK_WILL', 'BOARD_SHRINK_GOD'],
    metaVariants: ['BOARD_FRAME', 'old-geometry', 'new-geometry'],
    effectBlockPolicy: 'frame-revision-only',
    effectFamilies: ['board_shrink'],
    route: 'board-local',
    finalPixelWriter: 'pixi',
    renderers: ['ui/pixi/board-scene.ts#createPixiBoardScene', 'ui/pixi/effects/status.ts#playPixiStatusEffect'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#board shrink old/new geometry fixture',
    browserAssertion: playbackBrowserScenario('topology-shrink'),
    noAnimationAssertion: 'test/ui.pixi-board-playback.test.ts#NOANIM shrink settles committed frame once',
    cornerEdgeAssertion: localEdge('board_shrink')
  }),

  defineBranch({
    id: 'retained-place-hand-trajectory',
    category: 'retained-global',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['place_hand_animation'],
    rawTypes: ['PLAY_HAND_ANIMATION'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['cross-surface-trajectory'],
    route: 'global-dom',
    finalPixelWriter: 'none',
    renderers: ['ui/animation-hand-events.ts#handleHandPlaybackEvent'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#place hand endpoint fixture',
    browserAssertion: RETAINED_GLOBAL_BROWSER,
    noAnimationAssertion: 'test/ui.animation-engine.guard-timer.test.ts#NOANIM place hand settles without DOM final pixel',
    cornerEdgeAssertion: globalEdge('cross-surface-trajectory')
  }),
  defineBranch({
    id: 'retained-capture-to-hand-trajectory',
    category: 'retained-global',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['capture_to_hand_animation'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['cross-surface-trajectory'],
    route: 'global-dom',
    finalPixelWriter: 'none',
    renderers: ['ui/animation-hand-events.ts#handleHandPlaybackEvent'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#capture trajectory endpoint fixture',
    browserAssertion: RETAINED_GLOBAL_BROWSER,
    noAnimationAssertion: 'test/ui.animation-engine.guard-timer.test.ts#NOANIM capture settles immediately',
    cornerEdgeAssertion: globalEdge('cross-surface-trajectory')
  }),
  defineBranch({
    id: 'retained-card-use-trajectory',
    category: 'retained-global',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['card_use_animation'],
    rawTypes: ['CARD_USED'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['cross-surface-trajectory'],
    route: 'global-dom',
    finalPixelWriter: 'none',
    renderers: ['ui/animation-hand-events.ts#handleHandPlaybackEvent'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#card use endpoint fixture',
    browserAssertion: RETAINED_GLOBAL_BROWSER,
    noAnimationAssertion: 'test/ui.animation-engine.guard-timer.test.ts#NOANIM card use settles immediately',
    cornerEdgeAssertion: globalEdge('cross-surface-trajectory')
  }),
  defineBranch({
    id: 'retained-nonmanifest-special-cinematic',
    category: 'retained-global',
    sourceKind: 'playback-event',
    source: 'ui/animation-feedback-events.ts#handleSpecialCardCinematicEvent',
    eventTypes: ['special_card_cinematic'],
    metaVariants: ['character', 'fullscreen-japanese-text', 'summary'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['fullscreen'],
    route: 'global-dom',
    finalPixelWriter: 'none',
    renderers: ['ui/animation-feedback-events.ts#handleSpecialCardCinematicEvent'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#special cinematic fixture',
    browserAssertion: RETAINED_GLOBAL_BROWSER,
    noAnimationAssertion: 'test/ui.animation-engine.guard-timer.test.ts#NOANIM cinematic preserves event settlement',
    cornerEdgeAssertion: globalEdge('fullscreen')
  }),
  defineBranch({
    id: 'retained-round-bonus-banner',
    category: 'retained-global',
    sourceKind: 'playback-event',
    source: 'game/turn/pipeline-ui/passive-event-playback.ts#mapPassivePresentationEvent',
    eventTypes: ['round_bonus_banner'],
    rawTypes: ['ROUND_BONUS_BANNER'],
    effectBlockPolicy: 'preserve-playback-base',
    effectFamilies: ['fullscreen'],
    route: 'global-dom',
    finalPixelWriter: 'none',
    renderers: ['ui/animation-feedback-events.ts#handleRoundBonusBannerEvent'],
    unitFixture: 'test/ui.animation-engine.guard-timer.test.ts#round bonus banner fixture',
    browserAssertion: RETAINED_GLOBAL_BROWSER,
    noAnimationAssertion: 'test/ui.animation-engine.guard-timer.test.ts#NOANIM round banner settles immediately',
    cornerEdgeAssertion: globalEdge('fullscreen')
  })
] as const);

export const PHASE7_EFFECT_BRANCH_IDS = Object.freeze(
  PHASE7_EFFECT_BRANCH_INVENTORY.map((entry) => entry.id)
);

export function getPhase7EffectBranchInventoryEntry(id: unknown): BoardVisualEffectBranchInventoryEntry | null {
  const normalized = String(id || '').trim();
  return PHASE7_EFFECT_BRANCH_INVENTORY.find((entry) => entry.id === normalized) || null;
}
