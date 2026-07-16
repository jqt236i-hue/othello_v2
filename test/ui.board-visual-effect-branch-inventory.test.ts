import fs = require('fs');
import path = require('path');

import PresentationEffectProfiles = require('../shared/presentation-effect-profiles');

const BranchInventory = require('../ui/board-visual/effect-branch-inventory');
const EffectBounds = require('../ui/board-visual/effect-bounds');
const BoardModel = require('../ui/board-visual/model');
const BoardPlaybackTypes = require('../ui/board-visual/playback-types');
const PixiBoardPlayback = require('../ui/pixi/board-playback');
const PresentationDispatcher = require('../ui/presentation/dispatcher');

const EXPECTED_BRANCH_IDS = [
  'place-board-local',
  'spawn-standard-and-breeding',
  'move-all-board-variants',
  'flip-standard',
  'flip-zombie-infection',
  'destroy-generic-remove',
  'destroy-preserved-outcome',
  'destroy-sniper-shot',
  'destroy-lightning-will',
  'destroy-dragon-breath',
  'destroy-ultimate-destroy-god',
  'destroy-meteor-god-black-beam',
  'destroy-robot-vacuum-suck',
  'destroy-gluttonous-eat',
  'destroy-will-hunter-king-slash',
  'destroy-super-buoyancy-collision',
  'destroy-super-gravity-collision',
  'destroy-super-attraction-collision',
  'destroy-time-bomb-batch',
  'destroy-cross-bomb-batch',
  'destroy-x-bomb-batch',
  'destroy-escape-hyperactive-batch',
  'destroy-board-shrink-will-batch',
  'destroy-board-shrink-god-batch',
  'destroy-meteor-will-before-hole',
  'status-guard-protected-and-generic',
  'status-tick-poison-cell',
  'status-tick-special-stone-timer',
  'status-regen-consumed-crossfade',
  'status-loss-will-reset-crossfade',
  'status-freeze-duration-end',
  'status-meteor-hole',
  'status-board-shrink-frame-hole',
  'status-causal-replay-restoration',
  'static-guard-protection-markers',
  'static-regen-zombie-timer-badges',
  'static-poison-and-observer-markers',
  'legacy-crossfade-stone',
  'legacy-protection-expire',
  'legacy-fade-out',
  'legacy-strong-will-apply',
  'legacy-hyperactive-move',
  'legacy-sacrifice-absorb-pulse',
  'theory-incarnation-roulette-materialization',
  'special-stone-speech-bubble',
  'observer-will-bubble',
  'work-income-and-removal-bubble',
  'charge-bubble',
  'manifest-ending-board-and-world',
  'manifest-world-cinematic',
  'topology-expansion-frame-delta',
  'topology-shrink-frame-delta',
  'retained-place-hand-trajectory',
  'retained-capture-to-hand-trajectory',
  'retained-card-use-trajectory',
  'retained-nonmanifest-special-cinematic',
  'retained-round-bonus-banner'
] as const;

type InventoryEntry = {
  id: string;
  automatedFixtureId: string;
  sourceKind: string;
  source: string;
  eventTypes: readonly string[];
  rawTypes: readonly string[];
  profileKey: string | null;
  causes: readonly string[];
  reasonPrefixes: readonly string[];
  specialTypes: readonly string[];
  metaVariants: readonly string[];
  effectBlockPolicy: string;
  effectFamilies: readonly string[];
  route: 'board-local' | 'global-dom' | 'hybrid';
  finalPixelWriter: 'pixi' | 'none';
  renderers: readonly string[];
  unitFixture: string;
  browserAssertion: string;
  noAnimationAssertion: string;
  cornerEdgeAssertion: string;
};

type FixtureSourceKind = 'playback-event' | 'frame-state' | 'frame-topology-delta';
type FixtureRoute = 'board-local' | 'global-dom' | 'hybrid';
type FixtureContractKind = 'playback' | 'frame-state' | 'topology-expansion' | 'topology-shrink';

type ExecutableFixture = Readonly<{
  fixtureId: string;
  branchId: string;
  sourceKind: FixtureSourceKind;
  route: FixtureRoute;
  contractKind: FixtureContractKind;
  eventTypes: readonly string[];
  events: readonly Readonly<Record<string, any>>[];
  effectFamilies: readonly string[];
  rendererReferences: readonly string[];
  markerKinds: readonly string[];
  expectedGlobalEventType: string | null;
}>;

const PLACE_RENDERER = Object.freeze(['ui/pixi/effects/place.ts#playPixiPlaceEffect']);
const SPAWN_RENDERER = Object.freeze(['ui/pixi/effects/spawn.ts#playPixiSpawnEffect']);
const MOVE_RENDERER = Object.freeze(['ui/pixi/effects/move.ts#playPixiMoveEffect']);
const FLIP_RENDERER = Object.freeze(['ui/pixi/effects/flip.ts#playPixiFlipEffect']);
const ZOMBIE_FLIP_RENDERERS = Object.freeze([
  'ui/pixi/effects/flip.ts#playPixiFlipEffect',
  'ui/presentation/global-board-effect-presenter.ts#presentZombieBiteSourceAnimation'
]);
const DESTROY_RENDERER = Object.freeze(['ui/pixi/effects/destroy.ts#playPixiDestroyEffect']);
const HYBRID_DESTROY_RENDERERS = Object.freeze([
  'ui/pixi/effects/destroy.ts#playPixiDestroyEffect',
  'ui/presentation/global-board-effect-presenter.ts#presentDestroySourceAnimation'
]);
const STATUS_RENDERER = Object.freeze(['ui/pixi/effects/status.ts#playPixiStatusEffect']);
const SCENE_RENDERER = Object.freeze(['ui/pixi/board-scene.ts#createPixiBoardScene']);
const OBSERVER_BUBBLE_RENDERER = Object.freeze([
  'ui/animation-feedback-events.ts#handleObserverBubbleEvent'
]);
const MANIFEST_RENDERERS = Object.freeze([
  'ui/pixi/effects/manifest.ts#playPixiManifestEndingBoardEffect',
  'ui/animation-engine.ts#handleManifestEndingGlobal'
]);
const CINEMATIC_RENDERER = Object.freeze([
  'ui/animation-feedback-events.ts#handleSpecialCardCinematicEvent'
]);
const HAND_RENDERER = Object.freeze(['ui/animation-hand-events.ts#handleHandPlaybackEvent']);

function fixtureEvent(type: string, target: Readonly<Record<string, any>>, index: number): Readonly<Record<string, any>> {
  return Object.freeze({
    type,
    phase: 7,
    sequenceIndex: index,
    targets: Object.freeze([Object.freeze({
      row: 0,
      col: 0,
      before: Object.freeze({ owner: 'black', value: 1 }),
      after: Object.freeze({ owner: 'white', value: -1 }),
      ...target
    })])
  });
}

function playbackFixture(
  branchId: string,
  eventType: string,
  effectFamilies: readonly string[],
  rendererReferences: readonly string[],
  options: Readonly<{
    route?: FixtureRoute;
    target?: Readonly<Record<string, any>>;
    inputEventTypes?: readonly string[];
    inventoryEventTypes?: readonly string[];
    expectedGlobalEventType?: string | null;
  }> = {}
): ExecutableFixture {
  const inputEventTypes = options.inputEventTypes || Object.freeze([eventType]);
  return Object.freeze({
    fixtureId: `phase7/${branchId}`,
    branchId,
    sourceKind: 'playback-event' as const,
    route: options.route || 'board-local',
    contractKind: 'playback' as const,
    eventTypes: Object.freeze(Array.from(options.inventoryEventTypes || inputEventTypes)),
    events: Object.freeze(inputEventTypes.map((type, index) => fixtureEvent(type, options.target || {}, index))),
    effectFamilies: Object.freeze(Array.from(effectFamilies)),
    rendererReferences: Object.freeze(Array.from(rendererReferences)),
    markerKinds: Object.freeze([]),
    expectedGlobalEventType: options.expectedGlobalEventType || null
  });
}

function globalFixture(
  branchId: string,
  eventType: string,
  effectFamily: string,
  rendererReferences: readonly string[],
  target: Readonly<Record<string, any>> = {}
): ExecutableFixture {
  return playbackFixture(branchId, eventType, [effectFamily], rendererReferences, {
    route: 'global-dom',
    target,
    expectedGlobalEventType: eventType
  });
}

function frameFixture(
  branchId: string,
  contractKind: Exclude<FixtureContractKind, 'playback'>,
  effectFamily: string,
  rendererReferences: readonly string[],
  markerKinds: readonly string[] = []
): ExecutableFixture {
  return Object.freeze({
    fixtureId: `phase7/${branchId}`,
    branchId,
    sourceKind: contractKind === 'frame-state' ? 'frame-state' : 'frame-topology-delta',
    route: 'board-local' as const,
    contractKind,
    eventTypes: Object.freeze([]),
    events: Object.freeze([]),
    effectFamilies: Object.freeze([effectFamily]),
    rendererReferences: Object.freeze(Array.from(rendererReferences)),
    markerKinds: Object.freeze(Array.from(markerKinds)),
    expectedGlobalEventType: null
  });
}

/**
 * Independent executable registry: it is deliberately literal and never
 * imports, maps, or spreads PHASE7_EFFECT_BRANCH_INVENTORY.
 */
const PHASE7_EXECUTABLE_FIXTURE_REGISTRY: readonly ExecutableFixture[] = Object.freeze([
  playbackFixture('place-board-local', 'place', ['place'], PLACE_RENDERER),
  playbackFixture('spawn-standard-and-breeding', 'spawn', ['spawn'], SPAWN_RENDERER, {
    target: { cause: 'BREEDING', meta: Object.freeze({ breedingSpawn: true }) }
  }),
  playbackFixture('move-all-board-variants', 'move', ['move'], MOVE_RENDERER, {
    target: { from: Object.freeze({ row: 0, col: 0 }), to: Object.freeze({ row: 0, col: 1 }) }
  }),
  playbackFixture('flip-standard', 'flip', ['flip'], FLIP_RENDERER),
  playbackFixture('flip-zombie-infection', 'flip', ['flip', 'source-to-board'], ZOMBIE_FLIP_RENDERERS, {
    route: 'hybrid',
    target: { cause: 'ZOMBIE', reason: 'zombie_infection', source: Object.freeze({ row: 1, col: 1 }) },
    inventoryEventTypes: ['flip', 'zombie_bite_source_animation'],
    expectedGlobalEventType: 'zombie_bite_source_animation'
  }),
  playbackFixture('destroy-generic-remove', 'destroy', ['destroy'], DESTROY_RENDERER),
  playbackFixture('destroy-preserved-outcome', 'destroy', ['destroy'], DESTROY_RENDERER, {
    target: { meta: Object.freeze({ blockedByGhost: true }) }
  }),
  playbackFixture('destroy-sniper-shot', 'destroy', ['destroy', 'source-to-board'], HYBRID_DESTROY_RENDERERS, {
    route: 'hybrid', target: { cause: 'SNIPER_WILL', reason: 'sniper_shot', source: { row: 1, col: 1 } },
    inventoryEventTypes: ['destroy', 'destroy_source_animation'], expectedGlobalEventType: 'destroy_source_animation'
  }),
  playbackFixture('destroy-lightning-will', 'destroy', ['destroy', 'source-to-board'], HYBRID_DESTROY_RENDERERS, {
    route: 'hybrid', target: { cause: 'LIGHTNING_WILL', reason: 'lightning_destroyed', source: { row: 1, col: 1 } },
    inventoryEventTypes: ['destroy', 'destroy_source_animation'], expectedGlobalEventType: 'destroy_source_animation'
  }),
  playbackFixture('destroy-dragon-breath', 'destroy', ['destroy', 'source-to-board'], HYBRID_DESTROY_RENDERERS, {
    route: 'hybrid', target: { cause: 'DESTROY_DRAGON', reason: 'destroy_dragon_breath', source: { row: 1, col: 1 } },
    inventoryEventTypes: ['destroy', 'destroy_source_animation'], expectedGlobalEventType: 'destroy_source_animation'
  }),
  playbackFixture('destroy-ultimate-destroy-god', 'destroy', ['destroy', 'source-to-board'], HYBRID_DESTROY_RENDERERS, {
    route: 'hybrid', target: { cause: 'ULTIMATE_DESTROY_GOD', reason: 'udg_destroyed', source: { row: 1, col: 1 } },
    inventoryEventTypes: ['destroy', 'destroy_source_animation'], expectedGlobalEventType: 'destroy_source_animation'
  }),
  playbackFixture('destroy-meteor-god-black-beam', 'destroy', ['destroy', 'source-to-board'], HYBRID_DESTROY_RENDERERS, {
    route: 'hybrid', target: { cause: 'METEOR_GOD', reason: 'meteor_god_cell_destroy', source: { row: 1, col: 1 } },
    inventoryEventTypes: ['destroy', 'destroy_source_animation'], expectedGlobalEventType: 'destroy_source_animation'
  }),
  playbackFixture('destroy-robot-vacuum-suck', 'destroy', ['destroy', 'source-to-board'], HYBRID_DESTROY_RENDERERS, {
    route: 'hybrid', target: { cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_suck', source: { row: 1, col: 1 } },
    inventoryEventTypes: ['destroy', 'destroy_source_animation'], expectedGlobalEventType: 'destroy_source_animation'
  }),
  playbackFixture('destroy-gluttonous-eat', 'destroy', ['destroy'], DESTROY_RENDERER, {
    target: { cause: 'GLUTTONOUS_WILL', reason: 'gluttonous_eat' }
  }),
  playbackFixture('destroy-will-hunter-king-slash', 'destroy', ['destroy'], DESTROY_RENDERER, {
    target: { cause: 'WILL_HUNTER_KING', reason: 'will_hunter_king_slash' }
  }),
  playbackFixture('destroy-super-buoyancy-collision', 'destroy', ['destroy'], DESTROY_RENDERER, {
    target: { cause: 'SUPER_BUOYANCY_WILL', reason: 'super_buoyancy_collision' }
  }),
  playbackFixture('destroy-super-gravity-collision', 'destroy', ['destroy'], DESTROY_RENDERER, {
    target: { cause: 'SUPER_GRAVITY_WILL', reason: 'super_gravity_collision' }
  }),
  playbackFixture('destroy-super-attraction-collision', 'destroy', ['destroy'], DESTROY_RENDERER, {
    target: { cause: 'SUPER_ATTRACTION_WILL', reason: 'super_attraction_collision' }
  }),
  playbackFixture('destroy-time-bomb-batch', 'destroy', ['destroy'], DESTROY_RENDERER, { target: { cause: 'TIME_BOMB' } }),
  playbackFixture('destroy-cross-bomb-batch', 'destroy', ['destroy'], DESTROY_RENDERER, { target: { cause: 'CROSS_BOMB' } }),
  playbackFixture('destroy-x-bomb-batch', 'destroy', ['destroy'], DESTROY_RENDERER, { target: { cause: 'X_BOMB' } }),
  playbackFixture('destroy-escape-hyperactive-batch', 'destroy', ['destroy'], DESTROY_RENDERER, { target: { cause: 'ESCAPE_HYPERACTIVE' } }),
  playbackFixture('destroy-board-shrink-will-batch', 'destroy', ['destroy'], DESTROY_RENDERER, { target: { cause: 'BOARD_SHRINK_WILL' } }),
  playbackFixture('destroy-board-shrink-god-batch', 'destroy', ['destroy'], DESTROY_RENDERER, { target: { cause: 'BOARD_SHRINK_GOD' } }),
  playbackFixture('destroy-meteor-will-before-hole', 'destroy', ['destroy'], DESTROY_RENDERER, { target: { cause: 'METEOR_WILL' } }),
  playbackFixture('status-guard-protected-and-generic', 'status_applied', ['status'], STATUS_RENDERER, {
    target: { specialType: 'GUARD' }, inputEventTypes: ['status_applied', 'status_removed']
  }),
  playbackFixture('status-tick-poison-cell', 'status_applied', ['status'], STATUS_RENDERER, { target: { specialType: 'POISON_CELL' } }),
  playbackFixture('status-tick-special-stone-timer', 'status_applied', ['status'], STATUS_RENDERER, { target: { specialType: 'TIME_BOMB' } }),
  playbackFixture('status-regen-consumed-crossfade', 'status_removed', ['status'], STATUS_RENDERER, { target: { specialType: 'REGEN', reason: 'consumed' } }),
  playbackFixture('status-loss-will-reset-crossfade', 'status_removed', ['status'], STATUS_RENDERER, { target: { reason: 'loss_will_reset' } }),
  playbackFixture('status-freeze-duration-end', 'status_removed', ['status'], STATUS_RENDERER, { target: { specialType: 'FROZEN', reason: 'duration_end' } }),
  playbackFixture('status-meteor-hole', 'status_applied', ['status'], STATUS_RENDERER, { target: { specialType: 'METEOR_HOLE' } }),
  playbackFixture('status-board-shrink-frame-hole', 'status_applied', ['board_shrink'], STATUS_RENDERER, { target: { specialType: 'BOARD_FRAME' } }),
  playbackFixture('status-causal-replay-restoration', 'status_removed', ['status'], STATUS_RENDERER, { target: { reason: 'causal_replay' } }),
  frameFixture('static-guard-protection-markers', 'frame-state', 'status', SCENE_RENDERER, ['guard-timer', 'flip-protected']),
  frameFixture('static-regen-zombie-timer-badges', 'frame-state', 'status', SCENE_RENDERER, ['regen-timer', 'zombie-timer']),
  frameFixture('static-poison-and-observer-markers', 'frame-state', 'status', SCENE_RENDERER, ['poison-cell', 'observer-will']),
  playbackFixture('legacy-crossfade-stone', 'crossfade_stone', ['crossfade_stone'], ['ui/pixi/effects/special-stone.ts#playPixiCrossfadeStoneEffect']),
  playbackFixture('legacy-protection-expire', 'protection_expire', ['protection_expire'], ['ui/pixi/effects/special-stone.ts#playPixiProtectionExpireEffect']),
  playbackFixture('legacy-fade-out', 'legacy_fade_out', ['legacy_fade_out'], ['ui/pixi/effects/special-stone.ts#playPixiLegacyFadeOutEffect']),
  playbackFixture('legacy-strong-will-apply', 'legacy_strong_will_apply', ['legacy_strong_will_apply'], ['ui/pixi/effects/special-stone.ts#playPixiLegacyStrongWillApplyEffect']),
  playbackFixture('legacy-hyperactive-move', 'legacy_hyperactive_move', ['legacy_hyperactive_move'], ['ui/pixi/effects/special-stone.ts#playPixiLegacyHyperactiveMoveEffect']),
  playbackFixture('legacy-sacrifice-absorb-pulse', 'legacy_sacrifice_absorb_pulse', ['legacy_sacrifice_absorb_pulse'], ['ui/pixi/effects/special-stone.ts#playPixiLegacySacrificeAbsorbPulseEffect']),
  playbackFixture('theory-incarnation-roulette-materialization', 'theory_incarnation_spawn_roulette', ['theory_incarnation_spawn_roulette'], ['ui/pixi/effects/theory-incarnation.ts#playPixiTheoryIncarnationEffect'], {
    target: { candidateCells: Object.freeze([{ row: 0, col: 0 }, { row: 0, col: 1 }]), selectedCell: Object.freeze({ row: 0, col: 1 }) }
  }),
  globalFixture('special-stone-speech-bubble', 'observer_bubble', 'observer_bubble', OBSERVER_BUBBLE_RENDERER, { kind: 'special-stone', specialType: 'ZOMBIE' }),
  globalFixture('observer-will-bubble', 'observer_bubble', 'observer_bubble', OBSERVER_BUBBLE_RENDERER, { kind: 'observer-will' }),
  globalFixture('work-income-and-removal-bubble', 'observer_bubble', 'observer_bubble', OBSERVER_BUBBLE_RENDERER, { kind: 'work-income' }),
  globalFixture('charge-bubble', 'observer_bubble', 'observer_bubble', OBSERVER_BUBBLE_RENDERER, { kind: 'charge' }),
  playbackFixture('manifest-ending-board-and-world', 'manifest_ending', ['manifest_ending_board', 'fullscreen'], MANIFEST_RENDERERS, {
    route: 'hybrid', expectedGlobalEventType: 'manifest_ending', target: { specialType: 'MANIFEST', reason: 'duration_end' }
  }),
  globalFixture('manifest-world-cinematic', 'special_card_cinematic', 'fullscreen', CINEMATIC_RENDERER, { specialType: 'MANIFEST' }),
  frameFixture('topology-expansion-frame-delta', 'topology-expansion', 'board_expansion', SCENE_RENDERER),
  frameFixture('topology-shrink-frame-delta', 'topology-shrink', 'board_shrink', [
    'ui/pixi/board-scene.ts#createPixiBoardScene',
    'ui/pixi/effects/status.ts#playPixiStatusEffect'
  ]),
  globalFixture('retained-place-hand-trajectory', 'place_hand_animation', 'source-to-board', HAND_RENDERER),
  globalFixture('retained-capture-to-hand-trajectory', 'capture_to_hand_animation', 'source-to-board', HAND_RENDERER),
  globalFixture('retained-card-use-trajectory', 'card_use_animation', 'source-to-board', HAND_RENDERER),
  globalFixture('retained-nonmanifest-special-cinematic', 'special_card_cinematic', 'fullscreen', CINEMATIC_RENDERER),
  globalFixture('retained-round-bonus-banner', 'round_bonus_banner', 'fullscreen', [
    'ui/animation-feedback-events.ts#handleRoundBonusBannerEvent'
  ])
]);

function referencePath(reference: string): string {
  return reference.split('#', 1)[0];
}

function referenceAnchor(reference: string): string {
  return reference.slice(reference.indexOf('#') + 1);
}

const EXECUTABLE_FIXTURE_IDS = new Set(
  PHASE7_EXECUTABLE_FIXTURE_REGISTRY.map((fixture) => fixture.fixtureId)
);

function expectExistingReference(reference: string): void {
  expect(reference).toMatch(/^[^#]+#[^#]+$/);
  const sourcePath = path.resolve(process.cwd(), referencePath(reference));
  expect(fs.existsSync(sourcePath)).toBe(true);
  const anchor = referenceAnchor(reference);
  if (referencePath(reference) === 'test/ui.board-visual-effect-branch-inventory.test.ts'
    && anchor.startsWith('phase7/')) {
    expect(EXECUTABLE_FIXTURE_IDS.has(anchor)).toBe(true);
    return;
  }
  if (referencePath(reference) === 'scripts/pixijs-board-playback-browser-check.ts'
    && anchor.startsWith('scenario:')) {
    const checker = require('../scripts/pixijs-board-playback-browser-check');
    const scenarioName = anchor.slice('scenario:'.length);
    expect(checker.PLAYBACK_SCENARIOS.map((scenario: any) => scenario.name)).toContain(scenarioName);
    return;
  }
  if (referencePath(reference) === 'scripts/pixijs-board-browser-check.ts'
    && anchor.startsWith('fixture:')) {
    const checker = require('../scripts/pixijs-board-browser-check');
    const fixtureName = anchor.slice('fixture:'.length);
    expect(checker.BROWSER_FIXTURES.map((fixture: any) => fixture.name)).toContain(fixtureName);
    return;
  }
  const source = fs.readFileSync(sourcePath, 'utf8');
  expect(source).toContain(anchor);
}

function exportedFunction(reference: string): Function {
  expectExistingReference(reference);
  const sourcePath = path.resolve(process.cwd(), referencePath(reference));
  const root = globalThis as any;
  const hadDocument = Object.prototype.hasOwnProperty.call(root, 'document');
  const previousDocument = root.document;
  if (!hadDocument) root.document = { getElementById: () => null };
  let loaded: any;
  try {
    loaded = require(sourcePath);
  } finally {
    if (hadDocument) root.document = previousDocument;
    else delete root.document;
  }
  const exported = loaded && loaded[referenceAnchor(reference)];
  expect(typeof exported).toBe('function');
  return exported;
}

function validationFrame(): any {
  return Object.freeze({
    frameToken: 'phase7-fixture-frame',
    model: Object.freeze({
      cells: Object.freeze([]),
      topology: Object.freeze({ existingKeys: Object.freeze([]) })
    }),
    layout: Object.freeze({}),
    appearance: Object.freeze({}),
    theme: Object.freeze({})
  });
}

function createValidationPlayback(noAnimation: boolean): any {
  return PixiBoardPlayback.createPixiBoardPlayback({
    application: {
      subscribeTicker: () => () => undefined,
      startTicker: () => undefined,
      stopTicker: () => undefined,
      render: () => undefined
    },
    scene: {},
    getFrame: validationFrame,
    noAnimation
  });
}

function boardCell(
  key: string,
  kind: 'playable' | 'hole',
  markers: readonly Readonly<Record<string, any>>[] = []
): any {
  const [row, col] = key.split(',').map(Number);
  return {
    key,
    row,
    col,
    renderRow: row,
    renderCol: col,
    kind,
    expansionSide: null,
    boundaryEdges: { top: 'outer', right: 'outer', bottom: 'outer', left: 'outer' },
    stone: kind === 'playable'
      ? { owner: 'black', value: 1, specialType: 'GUARD', status: {} }
      : null,
    markers,
    interaction: {
      legal: false,
      legalFree: false,
      tabooLegal: false,
      selectable: false,
      interactionLocked: false,
      hovered: false,
      keyboardCursor: false,
      previewKinds: [],
      selected: false,
      selectionKinds: [],
      directionHints: [],
      directionHintIds: [],
      localPendingHintIds: []
    }
  };
}

function contractModel(cells: readonly any[]): any {
  const existingKeys = cells.map((cell) => cell.key);
  const playableKeys = cells.filter((cell) => cell.kind === 'playable').map((cell) => cell.key);
  const holeKeys = cells.filter((cell) => cell.kind === 'hole').map((cell) => cell.key);
  return BoardModel.createBoardRenderModel({
    topology: {
      baseRows: 1,
      baseCols: Math.max(1, cells.length),
      minRow: 0,
      maxRow: 0,
      minCol: 0,
      maxCol: Math.max(0, cells.length - 1),
      renderRowOffset: 0,
      renderColOffset: 0,
      renderRows: 1,
      renderCols: Math.max(1, cells.length),
      existingKeys,
      playableKeys,
      holeKeys
    },
    cells
  });
}

function executeFrameContract(fixture: ExecutableFixture): void {
  if (fixture.contractKind === 'frame-state') {
    const markers = fixture.markerKinds.map((kind, index) => ({
      kind,
      owner: index % 2 === 0 ? 'black' : 'white',
      value: index,
      data: Object.freeze({ fixtureId: fixture.fixtureId })
    }));
    const model = contractModel([boardCell('0,0', 'playable', markers)]);
    expect(model.cells[0].markers.map((marker: any) => marker.kind)).toEqual(fixture.markerKinds);
    expect(Object.isFrozen(model.cells[0].markers)).toBe(true);
    return;
  }

  const oldModel = contractModel([
    boardCell('0,0', 'playable'),
    ...(fixture.contractKind === 'topology-shrink' ? [boardCell('0,1', 'playable')] : [])
  ]);
  const nextModel = fixture.contractKind === 'topology-expansion'
    ? contractModel([boardCell('0,0', 'playable'), boardCell('0,1', 'playable')])
    : contractModel([boardCell('0,0', 'playable'), boardCell('0,1', 'hole')]);
  const materialized = BoardModel.materializeBoardViewport({
    model: nextModel,
    visibleWindow: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 1 },
    overscanCells: 0,
    effectGutterCells: 0
  });
  expect(materialized.map((cell: any) => `${cell.key}:${cell.kind}`)).toEqual(
    fixture.contractKind === 'topology-expansion'
      ? ['0,0:playable', '0,1:playable']
      : ['0,0:playable', '0,1:hole']
  );
  if (fixture.contractKind === 'topology-expansion') {
    const oldKeys = new Set(oldModel.topology.existingKeys);
    expect(nextModel.topology.existingKeys.filter((key: string) => !oldKeys.has(key))).toEqual(['0,1']);
  } else {
    expect(oldModel.cells.find((cell: any) => cell.key === '0,1')?.kind).toBe('playable');
    expect(nextModel.cells.find((cell: any) => cell.key === '0,1')?.kind).toBe('hole');
  }
}

function executeBoundsContract(fixture: ExecutableFixture): void {
  const routes = new Set(fixture.effectFamilies.map((family) => (
    EffectBounds.getBoardVisualEffectBounds(family).route
  )));
  if (fixture.route === 'board-local') {
    expect(routes).toEqual(new Set(['board-local']));
  } else if (fixture.route === 'global-dom') {
    expect(routes).toEqual(new Set(['global-dom']));
  } else {
    expect(routes).toEqual(new Set(['board-local', 'global-dom']));
  }
  const localFamilies = fixture.effectFamilies.filter((family) => (
    EffectBounds.getBoardVisualEffectBounds(family).route === 'board-local'
  ));
  if (localFamilies.length) {
    const expanded = EffectBounds.expandBoardVisualEffectMaterializationBounds(
      { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 },
      localFamilies
    );
    expect(expanded.minRow).toBeGreaterThanOrEqual(-2);
    expect(expanded.maxRow).toBeLessThanOrEqual(2);
    expect(expanded.minCol).toBeGreaterThanOrEqual(-2);
    expect(expanded.maxCol).toBeLessThanOrEqual(2);
  }
}

async function executePlaybackContract(fixture: ExecutableFixture): Promise<void> {
  const normalPlayback = createValidationPlayback(false);
  const noAnimationPlayback = createValidationPlayback(true);
  const validationScope = Object.freeze({
    events: fixture.events,
    phaseKey: `${fixture.fixtureId}:validation`,
    stepIndex: 0,
    ...(fixture.route === 'hybrid' && fixture.expectedGlobalEventType !== 'manifest_ending'
      ? { waitForTargetPrelude: async () => undefined }
      : {})
  });
  const inputDigest = JSON.stringify(fixture.events);
  try {
    normalPlayback.validatePhase(fixture.events, {
      strictNetworkPlayback: true,
      phaseScope: validationScope
    });
    noAnimationPlayback.validatePhase(fixture.events, {
      strictNetworkPlayback: true,
      phaseScope: validationScope
    });

    const order: string[] = [];
    const preflightCalls: any[] = [];
    const boardCalls: any[] = [];
    const globalCalls: any[] = [];
    await PresentationDispatcher.dispatchPresentationPhase(fixture.events, {
      strictNetworkPlayback: true,
      preflightBoardPhase(events: readonly unknown[], scope: unknown) {
        order.push('preflight');
        preflightCalls.push({ events, scope });
        normalPlayback.validatePhase(events, { strictNetworkPlayback: true, phaseScope: scope });
      },
      playBoardPhase(events: readonly unknown[], scope: unknown) {
        order.push('board');
        boardCalls.push({ events, scope });
      },
      playGlobalEvent(event: unknown) {
        order.push('global');
        globalCalls.push(event);
      },
      playManifestEndingGlobal(event: unknown) {
        order.push('global');
        globalCalls.push(event);
      }
    });

    expect(JSON.stringify(fixture.events)).toBe(inputDigest);
    if (fixture.route === 'global-dom') {
      expect(preflightCalls).toHaveLength(0);
      expect(boardCalls).toHaveLength(0);
      expect(globalCalls.map((event) => event.type)).toEqual([fixture.expectedGlobalEventType]);
      expect(order).toEqual(['global']);
      for (const event of fixture.events) {
        expect(BoardPlaybackTypes.isKnownGlobalPresentationEvent(event)).toBe(true);
      }
      return;
    }

    expect(preflightCalls.length).toBeGreaterThan(0);
    expect(boardCalls.length).toBeGreaterThan(0);
    const launchedBoardEvents = boardCalls.flatMap((call) => Array.from(call.events));
    expect(launchedBoardEvents).toEqual(fixture.events);
    for (const call of boardCalls) {
      expect(call.scope).toBeTruthy();
      expect(Array.isArray(call.scope.events)).toBe(true);
    }
    if (fixture.route === 'board-local') {
      expect(globalCalls).toHaveLength(0);
      expect(order[0]).toBe('preflight');
      expect(order[order.length - 1]).toBe('board');
      return;
    }

    expect(globalCalls.map((event) => event.type)).toEqual([fixture.expectedGlobalEventType]);
    if (fixture.expectedGlobalEventType === 'manifest_ending') {
      expect(order).toEqual(['preflight', 'board', 'global']);
      expect(BoardPlaybackTypes.isHybridPresentationEvent(fixture.events[0])).toBe(true);
    } else {
      expect(order).toEqual(['preflight', 'global', 'board']);
      expect(typeof preflightCalls[0].scope.waitForTargetPrelude).toBe('function');
      expect(typeof boardCalls[0].scope.waitForTargetPrelude).toBe('function');
    }
  } finally {
    normalPlayback.destroy();
    noAnimationPlayback.destroy();
  }
}

function inventory(): readonly InventoryEntry[] {
  return BranchInventory.PHASE7_EFFECT_BRANCH_INVENTORY;
}

describe('Phase 7 board visual branch inventory', () => {
  test('enumerates the fixed branch surface with no duplicate or unassigned row', () => {
    const entries = inventory();
    expect(entries.map((entry) => entry.id)).toEqual(EXPECTED_BRANCH_IDS);
    expect(BranchInventory.PHASE7_EFFECT_BRANCH_IDS).toEqual(EXPECTED_BRANCH_IDS);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);

    for (const entry of entries) {
      expect(entry.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(entry.automatedFixtureId).toBe(`phase7/${entry.id}`);
      expectExistingReference(entry.source);
      if (entry.sourceKind === 'playback-event') {
        expect(entry.eventTypes.length).toBeGreaterThan(0);
      } else {
        expect(entry.eventTypes).toEqual([]);
        expect(['frame-state', 'frame-topology-delta']).toContain(entry.sourceKind);
      }
      expect(entry.effectBlockPolicy).toMatch(/^[a-z][a-z-]+$/);
      expect(entry.effectFamilies.length).toBeGreaterThan(0);
      expect(entry.renderers.length).toBeGreaterThan(0);
      for (const renderer of entry.renderers) expectExistingReference(renderer);
      expectExistingReference(entry.unitFixture);
      expectExistingReference(entry.browserAssertion);
      expectExistingReference(entry.noAnimationAssertion);
      expectExistingReference(entry.cornerEdgeAssertion);
      expect(BranchInventory.getPhase7EffectBranchInventoryEntry(entry.id)).toBe(entry);
    }
    expect(BranchInventory.getPhase7EffectBranchInventoryEntry('not-in-inventory')).toBeNull();
  });

  test('executes every independent Phase 7 fixture contract and resolves real renderer exports', async () => {
    expect(PHASE7_EXECUTABLE_FIXTURE_REGISTRY).toHaveLength(57);
    expect(PHASE7_EXECUTABLE_FIXTURE_REGISTRY.map((fixture) => fixture.branchId)).toEqual(EXPECTED_BRANCH_IDS);
    expect(new Set(PHASE7_EXECUTABLE_FIXTURE_REGISTRY.map((fixture) => fixture.fixtureId)).size).toBe(57);

    const entriesById = new Map(inventory().map((entry) => [entry.id, entry]));
    const executedFixtureIds: string[] = [];
    for (const fixture of PHASE7_EXECUTABLE_FIXTURE_REGISTRY) {
      const entry = entriesById.get(fixture.branchId);
      expect(entry).toBeTruthy();
      expect(entry!.automatedFixtureId).toBe(fixture.fixtureId);
      expect(entry!.sourceKind).toBe(fixture.sourceKind);
      expect(entry!.route).toBe(fixture.route);
      expect(entry!.eventTypes).toEqual(fixture.eventTypes);
      expect(entry!.effectFamilies).toEqual(fixture.effectFamilies);
      expect(entry!.renderers).toEqual(fixture.rendererReferences);

      exportedFunction(entry!.source);
      for (const renderer of fixture.rendererReferences) exportedFunction(renderer);
      executeBoundsContract(fixture);
      if (fixture.contractKind === 'playback') await executePlaybackContract(fixture);
      else executeFrameContract(fixture);
      executedFixtureIds.push(fixture.fixtureId);
    }

    expect(executedFixtureIds).toEqual(inventory().map((entry) => entry.automatedFixtureId));
  });

  test('covers every concrete visual presentation event and only known event types', () => {
    const expectedVisualEvents = Object.entries(
      EffectBounds.PRESENTATION_EVENT_EFFECT_FAMILY_INVENTORY as Record<string, readonly string[]>
    )
      .filter(([, families]) => families.length > 0)
      .map(([eventType]) => eventType)
      .sort();
    const inventoriedEvents = Array.from(new Set(inventory().flatMap((entry) => entry.eventTypes))).sort();
    expect(inventoriedEvents).toEqual(expectedVisualEvents);

    for (const eventType of expectedVisualEvents) {
      const expectedFamilies = EffectBounds.PRESENTATION_EVENT_EFFECT_FAMILY_INVENTORY[eventType] as readonly string[];
      const assignedFamilies = new Set(
        inventory()
          .filter((entry) => entry.eventTypes.includes(eventType))
          .flatMap((entry) => entry.effectFamilies)
      );
      for (const family of expectedFamilies) expect(assignedFamilies.has(family)).toBe(true);
    }
  });

  test('assigns all shared special DESTROY profiles, including every global prelude', () => {
    const sharedProfiles = {
      ...PresentationEffectProfiles.SPECIAL_DESTROY_TARGET_PROFILES,
      ...PresentationEffectProfiles.SUPER_CRUSH_DESTROY_TARGET_PROFILES
    } as Record<string, { causes: readonly string[]; reasonPrefix: string }>;
    const profileEntries = inventory().filter((entry) => entry.profileKey !== null);
    expect(profileEntries.map((entry) => entry.profileKey).sort()).toEqual(Object.keys(sharedProfiles).sort());

    const globalPreludeKeys = new Set<string>(PresentationEffectProfiles.GLOBAL_DESTROY_PRELUDE_PROFILE_KEYS);
    for (const entry of profileEntries) {
      const profile = sharedProfiles[entry.profileKey!];
      expect(entry.causes).toEqual(profile.causes);
      expect(entry.reasonPrefixes).toEqual([profile.reasonPrefix]);
      if (globalPreludeKeys.has(entry.profileKey!)) {
        expect(entry.route).toBe('hybrid');
        expect(entry.eventTypes).toEqual(['destroy', 'destroy_source_animation']);
        expect(entry.effectFamilies).toEqual(['destroy', 'source-to-board']);
      } else {
        expect(entry.route).toBe('board-local');
        expect(entry.eventTypes).toEqual(['destroy']);
      }
    }
  });

  test('keeps final pixels single-writer and routes every family consistently with bounds', () => {
    for (const entry of inventory()) {
      const routes = new Set(entry.effectFamilies.map((family) => (
        EffectBounds.getBoardVisualEffectBounds(family).route
      )));
      if (entry.route === 'board-local') {
        expect(Array.from(routes)).toEqual(['board-local']);
        expect(entry.finalPixelWriter).toBe('pixi');
      } else if (entry.route === 'global-dom') {
        expect(Array.from(routes)).toEqual(['global-dom']);
        expect(entry.finalPixelWriter).toBe('none');
      } else {
        expect(routes).toEqual(new Set(['board-local', 'global-dom']));
        expect(entry.finalPixelWriter).toBe('pixi');
      }
      if (entry.finalPixelWriter === 'pixi') {
        expect(entry.renderers.some((renderer) => renderer.startsWith('ui/pixi/'))).toBe(true);
      }
    }
  });

  test('pins effectBlock-sensitive branches without changing canonical event order', () => {
    const byId = new Map(inventory().map((entry) => [entry.id, entry]));
    for (const id of [
      'destroy-gluttonous-eat',
      'destroy-will-hunter-king-slash',
      'destroy-super-buoyancy-collision',
      'destroy-super-gravity-collision',
      'destroy-super-attraction-collision'
    ]) {
      expect(byId.get(id)?.effectBlockPolicy).toBe('action-scoped-shared-destroy-move');
    }
    for (const id of [
      'destroy-ultimate-destroy-god',
      'destroy-time-bomb-batch',
      'destroy-cross-bomb-batch',
      'destroy-x-bomb-batch',
      'destroy-escape-hyperactive-batch',
      'destroy-board-shrink-will-batch',
      'destroy-board-shrink-god-batch'
    ]) {
      expect(byId.get(id)?.effectBlockPolicy).toBe('cause-action-effect-block-batch');
    }
    for (const id of [
      'legacy-fade-out',
      'legacy-strong-will-apply',
      'legacy-hyperactive-move',
      'legacy-sacrifice-absorb-pulse'
    ]) {
      expect(byId.get(id)?.effectBlockPolicy).toBe('presentation-batch-only');
    }
    expect(byId.get('manifest-ending-board-and-world')?.effectBlockPolicy).toBe('hybrid-shared-settlement');
    expect(byId.get('topology-expansion-frame-delta')?.sourceKind).toBe('frame-topology-delta');
    expect(byId.get('topology-shrink-frame-delta')?.sourceKind).toBe('frame-topology-delta');

    const speech = byId.get('special-stone-speech-bubble');
    expect(speech?.specialTypes).toEqual([
      'PROTECTED', 'PERMA_PROTECTED', 'SNIPER', 'GHOST', 'SACRIFICE', 'AFTERIMAGE_WILL',
      'TIME_STOP', 'TIME_STOP_DEITY', 'REGEN', 'ZOMBIE', 'DRAGON', 'BREEDING',
      'PROLIFERATION', 'HYPERACTIVE', 'EXTREME_HYPERACTIVE', 'ESCAPE_HYPERACTIVE',
      'ROBOT_VACUUM', 'GLUTTONOUS', 'WILL_HUNTER_KING', 'WORK', 'STONE_SALVATION_GOD',
      'DESTROY_DRAGON', 'LIGHTNING', 'ULTIMATE_DESTROY_GOD', 'ULTIMATE_HYPERACTIVE', 'METEOR_GOD'
    ]);
    expect(speech?.metaVariants).toEqual([
      'place', 'destroy', 'duration_end', 'normal_revert', 'proliferation_triggered',
      'time_stop_triggered', 'time_stop_deity_triggered', 'regen_triggered', 'zombie_infection',
      'zombie_revived', 'card_nullified', 'ghost_protected', 'escape_exploded',
      'special_destroy_triggered', 'work_income', 'living_will_restored'
    ]);
  });
});
