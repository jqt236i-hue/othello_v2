import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import BrowserUiControlSmoke from './browser-ui-control-smoke';

const { runBrowserUiControlSmoke } = BrowserUiControlSmoke as any;

type BrowserLane = 'classic' | 'vite';
type BoardRenderer = 'dom' | 'pixi';
type PlaybackMode = 'normal' | 'reduced-motion' | 'noanim';

interface PlaybackStoneFixture {
  readonly row: number;
  readonly col: number;
  readonly color: 1 | -1;
}

interface PlaybackExpansionCellFixture {
  readonly row: number;
  readonly col: number;
  readonly side: 'top' | 'right' | 'bottom' | 'left';
  readonly owner: 0 | 1 | -1;
}

interface PlaybackScenarioDefinition {
  readonly name: string;
  readonly eventType: string;
  readonly soundKey: string;
  /** Phase 6 fixtures keep reduced-motion coverage; Phase 7 additions target normal/NOANIM parity. */
  readonly modes?: readonly PlaybackMode[];
  readonly initialStones: readonly PlaybackStoneFixture[];
  readonly finalStones: readonly PlaybackStoneFixture[];
  readonly initialExpansionCells?: readonly PlaybackExpansionCellFixture[];
  readonly finalExpansionCells?: readonly PlaybackExpansionCellFixture[];
  readonly initialMarkers?: readonly unknown[];
  readonly finalMarkers?: readonly unknown[];
  readonly probeCells: readonly Readonly<{ row: number; col: number }>[];
  readonly events: readonly unknown[];
  readonly expectedGlobalEventTypes?: readonly string[];
  readonly expectedDispatchLaunchOrder?: readonly string[];
  readonly execution?: 'playback' | 'committed-frame';
  readonly pixiEvidence?: 'timeline' | 'immediate' | 'topology-reveal';
}

interface PlaybackBrowserCheckOptions {
  readonly rootDir?: string;
  readonly lanes?: readonly BrowserLane[];
  readonly modes?: readonly PlaybackMode[];
  readonly scenarioNames?: readonly string[];
  readonly artifactDir?: string;
  readonly writeArtifacts?: boolean;
  readonly log?: boolean;
}

const BOARD_ROWS = 8;
const BOARD_COLS = 8;
const PLAYBACK_BOARD_SIZE = Object.freeze({ rows: BOARD_ROWS, cols: BOARD_COLS });
const DEFAULT_ARTIFACT_DIR = 'artifacts/pixijs-playback-browser-check';
const PLAYBACK_MODES: readonly PlaybackMode[] = Object.freeze([
  'normal',
  'reduced-motion',
  'noanim'
]);
const PHASE7_PARITY_MODES: readonly PlaybackMode[] = Object.freeze(['normal', 'noanim']);

function specialMarker(
  id: string,
  row: number,
  col: number,
  owner: 'black' | 'white',
  type: string,
  remainingOwnerTurns = 3
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id,
    kind: 'specialStone',
    row,
    col,
    owner,
    data: Object.freeze({ type, remainingOwnerTurns })
  });
}

function manifestMarker(
  id: string,
  row: number,
  col: number,
  owner: 'black' | 'white',
  type: string,
  remainingOwnerTurns = 3
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id,
    kind: 'manifestStone',
    row,
    col,
    owner,
    data: Object.freeze({ type, remainingOwnerTurns })
  });
}

const PLAYBACK_SCENARIOS: readonly PlaybackScenarioDefinition[] = Object.freeze([
  Object.freeze({
    name: 'place',
    eventType: 'place',
    soundKey: 'stone_place',
    initialStones: Object.freeze([]),
    finalStones: Object.freeze([{ row: 2, col: 2, color: 1 as const }]),
    probeCells: Object.freeze([{ row: 2, col: 2 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'place',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 2,
          col: 2,
          owner: 'black',
          after: Object.freeze({ color: 1 }),
          cause: 'SYSTEM',
          reason: 'standard_place',
          meta: Object.freeze({ placementKind: 'normal_placement' })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'stone_place' }]) })
    ])
  }),
  Object.freeze({
    name: 'spawn',
    eventType: 'spawn',
    soundKey: 'breeding_spawn',
    initialStones: Object.freeze([]),
    finalStones: Object.freeze([{ row: 2, col: 3, color: -1 as const }]),
    finalMarkers: Object.freeze([specialMarker('pixi-playback-spawn', 2, 3, 'white', 'BREEDING')]),
    probeCells: Object.freeze([{ row: 2, col: 3 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'spawn',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 2,
          col: 3,
          owner: 'white',
          after: Object.freeze({ color: -1, special: 'BREEDING', remainingOwnerTurns: 3 }),
          cause: 'BREEDING',
          reason: 'breeding_spawn'
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'breeding_spawn' }]) })
    ])
  }),
  Object.freeze({
    name: 'flip',
    eventType: 'flip',
    soundKey: 'stone_flip',
    initialStones: Object.freeze([{ row: 3, col: 3, color: -1 as const }]),
    finalStones: Object.freeze([{ row: 3, col: 3, color: 1 as const }]),
    finalMarkers: Object.freeze([specialMarker('pixi-playback-zombie', 3, 3, 'black', 'ZOMBIE')]),
    expectedGlobalEventTypes: Object.freeze(['zombie_bite_source_animation']),
    probeCells: Object.freeze([{ row: 3, col: 3 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'flip',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 3,
          col: 3,
          ownerBefore: 'white',
          ownerAfter: 'black',
          before: Object.freeze({ color: -1 }),
          after: Object.freeze({ color: 1, special: 'ZOMBIE', remainingOwnerTurns: 3 }),
          cause: 'ZOMBIE',
          reason: 'zombie_infection'
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'stone_flip' }]) })
    ])
  }),
  Object.freeze({
    name: 'destroy',
    eventType: 'destroy',
    soundKey: 'stone_destroy',
    initialStones: Object.freeze([{ row: 4, col: 3, color: 1 as const }]),
    finalStones: Object.freeze([]),
    probeCells: Object.freeze([{ row: 4, col: 3 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'destroy',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 4,
          col: 3,
          ownerBefore: 'black',
          before: Object.freeze({ color: 1 }),
          cause: 'SYSTEM',
          reason: 'board_effect'
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'stone_destroy' }]) })
    ])
  }),
  Object.freeze({
    name: 'move',
    eventType: 'move',
    soundKey: 'hyperactive_move',
    initialStones: Object.freeze([{ row: 4, col: 4, color: 1 as const }]),
    finalStones: Object.freeze([{ row: 4, col: 6, color: 1 as const }]),
    probeCells: Object.freeze([{ row: 4, col: 4 }, { row: 4, col: 6 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'move',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          from: Object.freeze({ r: 4, col: 4 }),
          to: Object.freeze({ r: 4, col: 6 }),
          owner: 'black',
          before: Object.freeze({ color: 1 }),
          after: Object.freeze({ color: 1 }),
          cause: 'STRONG_WIND_WILL',
          reason: 'strong_wind_move',
          meta: Object.freeze({ moveIntent: 'wind_move' })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'hyperactive_move' }]) })
    ])
  }),
  Object.freeze({
    name: 'status',
    eventType: 'status_applied',
    soundKey: 'guard_apply',
    initialStones: Object.freeze([{ row: 5, col: 4, color: 1 as const }]),
    finalStones: Object.freeze([{ row: 5, col: 4, color: 1 as const }]),
    finalMarkers: Object.freeze([specialMarker('pixi-playback-guard', 5, 4, 'black', 'GUARD')]),
    probeCells: Object.freeze([{ row: 5, col: 4 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'status_applied',
        rawType: 'STATUS_APPLIED',
        phase: 1,
        meta: Object.freeze({ special: 'GUARD', highlightTone: 'positive' }),
        targets: Object.freeze([Object.freeze({
          r: 5,
          col: 4,
          owner: 'black',
          before: Object.freeze({ color: 1 }),
          after: Object.freeze({ color: 1, special: 'GUARD', remainingOwnerTurns: 3 })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'guard_apply' }]) })
    ])
  }),
  Object.freeze({
    name: 'special-destroy-hybrid',
    eventType: 'destroy',
    soundKey: 'stone_destroy',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([
      { row: 2, col: 1, color: 1 as const },
      { row: 2, col: 5, color: -1 as const }
    ]),
    finalStones: Object.freeze([{ row: 2, col: 1, color: 1 as const }]),
    probeCells: Object.freeze([{ row: 2, col: 1 }, { row: 2, col: 5 }]),
    expectedGlobalEventTypes: Object.freeze(['destroy_source_animation']),
    expectedDispatchLaunchOrder: Object.freeze([
      'global:destroy_source_animation',
      'board:destroy',
      'sound:stone_destroy'
    ]),
    events: Object.freeze([
      Object.freeze({
        type: 'destroy',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 2,
          col: 5,
          sourceRow: 2,
          sourceCol: 1,
          ownerBefore: 'white',
          before: Object.freeze({ color: -1 }),
          cause: 'DESTROY_DRAGON_WILL',
          reason: 'destroy_dragon_breath'
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'stone_destroy' }]) })
    ])
  }),
  Object.freeze({
    name: 'zombie-infection-source',
    eventType: 'flip',
    soundKey: 'zombie_will_bite',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([
      { row: 3, col: 2, color: 1 as const },
      { row: 3, col: 5, color: -1 as const }
    ]),
    finalStones: Object.freeze([
      { row: 3, col: 2, color: 1 as const },
      { row: 3, col: 5, color: 1 as const }
    ]),
    finalMarkers: Object.freeze([
      specialMarker('pixi-playback-zombie-source', 3, 2, 'black', 'ZOMBIE'),
      specialMarker('pixi-playback-zombie-target', 3, 5, 'black', 'ZOMBIE')
    ]),
    probeCells: Object.freeze([{ row: 3, col: 2 }, { row: 3, col: 5 }]),
    expectedGlobalEventTypes: Object.freeze(['zombie_bite_source_animation']),
    expectedDispatchLaunchOrder: Object.freeze([
      'global:zombie_bite_source_animation',
      'board:flip',
      'sound:zombie_will_bite'
    ]),
    events: Object.freeze([
      Object.freeze({
        type: 'flip',
        phase: 1,
        targets: Object.freeze([Object.freeze({
          r: 3,
          col: 5,
          sourceRow: 3,
          sourceCol: 2,
          ownerBefore: 'white',
          ownerAfter: 'black',
          before: Object.freeze({ color: -1 }),
          after: Object.freeze({ color: 1, special: 'ZOMBIE', remainingOwnerTurns: 3 }),
          cause: 'ZOMBIE',
          reason: 'zombie_infection',
          meta: Object.freeze({ sourceRow: 3, sourceCol: 2 })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'zombie_will_bite' }]) })
    ])
  }),
  Object.freeze({
    name: 'theory-incarnation',
    eventType: 'theory_incarnation_spawn_roulette',
    soundKey: 'theory_incarnation_spawn',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([]),
    finalStones: Object.freeze([{ row: 1, col: 4, color: 1 as const }]),
    finalMarkers: Object.freeze([
      manifestMarker('pixi-playback-theory-incarnation', 1, 4, 'black', 'THEORY_INCARNATION', 4)
    ]),
    probeCells: Object.freeze([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 }
    ]),
    events: Object.freeze([
      Object.freeze({
        type: 'theory_incarnation_spawn_roulette',
        phase: 1,
        durationMs: 2500,
        materializeMs: 2000,
        targets: Object.freeze([Object.freeze({
          r: 1,
          row: 1,
          col: 4,
          owner: 'black',
          ownerAfter: 'black',
          selectedIndex: 3,
          selectedCell: Object.freeze({ row: 1, col: 4 }),
          candidateCells: Object.freeze([
            Object.freeze({ row: 1, col: 1, value: 3 }),
            Object.freeze({ row: 1, col: 2, value: 7 }),
            Object.freeze({ row: 1, col: 3, value: 12 }),
            Object.freeze({ row: 1, col: 4, value: 19 })
          ]),
          after: Object.freeze({ color: 1, special: 'THEORY_INCARNATION', remainingOwnerTurns: 4 })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'theory_incarnation_spawn' }]) })
    ])
  }),
  Object.freeze({
    name: 'manifest-ending-world',
    eventType: 'manifest_ending',
    soundKey: 'manifest_ending',
    modes: PHASE7_PARITY_MODES,
    pixiEvidence: 'immediate',
    initialStones: Object.freeze([{ row: 4, col: 4, color: -1 as const }]),
    finalStones: Object.freeze([{ row: 4, col: 4, color: -1 as const }]),
    initialMarkers: Object.freeze([
      specialMarker('pixi-playback-manifest', 4, 4, 'white', 'ULTIMATE_REVERSE_DRAGON', 1)
    ]),
    finalMarkers: Object.freeze([]),
    probeCells: Object.freeze([{ row: 4, col: 4 }]),
    expectedGlobalEventTypes: Object.freeze(['manifest_ending']),
    expectedDispatchLaunchOrder: Object.freeze([
      'board:manifest_ending',
      'global:manifest_ending',
      'sound:manifest_ending'
    ]),
    events: Object.freeze([
      Object.freeze({
        type: 'manifest_ending',
        phase: 1,
        durationMs: 2000,
        targets: Object.freeze([Object.freeze({
          r: 4,
          col: 4,
          ownerBefore: 'white',
          ownerAfter: 'white',
          before: Object.freeze({ color: -1, special: 'ULTIMATE_REVERSE_DRAGON' }),
          after: Object.freeze({ color: -1, special: null, timer: null })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'manifest_ending' }]) })
    ])
  }),
  Object.freeze({
    name: 'topology-expansion',
    eventType: 'spawn',
    soundKey: 'board_expansion_reveal',
    modes: PHASE7_PARITY_MODES,
    execution: 'committed-frame',
    pixiEvidence: 'topology-reveal',
    initialStones: Object.freeze([]),
    finalStones: Object.freeze([]),
    finalExpansionCells: Object.freeze([
      Object.freeze({ row: 2, col: -1, side: 'left' as const, owner: 1 as const })
    ]),
    probeCells: Object.freeze([{ row: 2, col: -1 }]),
    expectedDispatchLaunchOrder: Object.freeze([
      'sound:board_expansion_reveal'
    ]),
    events: Object.freeze([])
  }),
  Object.freeze({
    name: 'topology-shrink',
    eventType: 'status_applied',
    soundKey: 'board_shrink_selected',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([{ row: 6, col: 6, color: -1 as const }]),
    finalStones: Object.freeze([]),
    finalMarkers: Object.freeze([
      specialMarker('pixi-playback-board-shrink-hole', 6, 6, 'white', 'METEOR_HOLE', 0)
    ]),
    probeCells: Object.freeze([{ row: 6, col: 6 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'status_applied',
        rawType: 'STATUS_APPLIED',
        phase: 1,
        meta: Object.freeze({ special: 'METEOR_HOLE', reason: 'board_shrink_selected' }),
        targets: Object.freeze([Object.freeze({
          r: 6,
          col: 6,
          owner: 'white',
          before: Object.freeze({ color: -1 }),
          after: Object.freeze({ special: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME' }),
          meta: Object.freeze({ visualVariant: 'BOARD_FRAME' })
        })])
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'board_shrink_selected' }]) })
    ])
  }),
  Object.freeze({
    name: 'legacy-fade-out',
    eventType: 'legacy_fade_out',
    soundKey: 'stone_destroy',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([{ row: 5, col: 2, color: 1 as const }]),
    finalStones: Object.freeze([]),
    probeCells: Object.freeze([{ row: 5, col: 2 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'legacy_fade_out',
        phase: 1,
        row: 5,
        col: 2,
        options: Object.freeze({ createGhost: false, color: 1 })
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'stone_destroy' }]) })
    ])
  }),
  Object.freeze({
    name: 'crossfade-stone',
    eventType: 'crossfade_stone',
    soundKey: 'stone_flip',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([{ row: 5, col: 3, color: 1 as const }]),
    finalStones: Object.freeze([{ row: 5, col: 3, color: -1 as const }]),
    probeCells: Object.freeze([{ row: 5, col: 3 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'crossfade_stone',
        phase: 1,
        row: 5,
        col: 3,
        owner: 'white',
        newColor: -1,
        effectKey: 'regenStone',
        durationMs: 600
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'stone_flip' }]) })
    ])
  }),
  Object.freeze({
    name: 'protection-expire',
    eventType: 'protection_expire',
    soundKey: 'guard_expire',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([{ row: 5, col: 4, color: 1 as const }]),
    finalStones: Object.freeze([{ row: 5, col: 4, color: 1 as const }]),
    probeCells: Object.freeze([{ row: 5, col: 4 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'protection_expire',
        phase: 1,
        row: 5,
        col: 4,
        effectKey: 'protectionExpire',
        durationMs: 600
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'guard_expire' }]) })
    ])
  }),
  Object.freeze({
    name: 'legacy-strong-will-apply',
    eventType: 'legacy_strong_will_apply',
    soundKey: 'strong_will_apply',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([{ row: 5, col: 5, color: 1 as const }]),
    finalStones: Object.freeze([{ row: 5, col: 5, color: 1 as const }]),
    probeCells: Object.freeze([{ row: 5, col: 5 }]),
    events: Object.freeze([
      Object.freeze({ type: 'legacy_strong_will_apply', phase: 1, row: 5, col: 5 }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'strong_will_apply' }]) })
    ])
  }),
  Object.freeze({
    name: 'legacy-hyperactive-move',
    eventType: 'legacy_hyperactive_move',
    soundKey: 'hyperactive_move',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([{ row: 6, col: 2, color: -1 as const }]),
    finalStones: Object.freeze([{ row: 6, col: 4, color: -1 as const }]),
    probeCells: Object.freeze([{ row: 6, col: 2 }, { row: 6, col: 4 }]),
    events: Object.freeze([
      Object.freeze({
        type: 'legacy_hyperactive_move',
        phase: 1,
        from: Object.freeze({ row: 6, col: 2 }),
        to: Object.freeze({ row: 6, col: 4 })
      }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'hyperactive_move' }]) })
    ])
  }),
  Object.freeze({
    name: 'legacy-sacrifice-absorb-pulse',
    eventType: 'legacy_sacrifice_absorb_pulse',
    soundKey: 'sacrifice_absorb',
    modes: PHASE7_PARITY_MODES,
    initialStones: Object.freeze([{ row: 6, col: 5, color: -1 as const }]),
    finalStones: Object.freeze([{ row: 6, col: 5, color: -1 as const }]),
    probeCells: Object.freeze([{ row: 6, col: 5 }]),
    events: Object.freeze([
      Object.freeze({ type: 'legacy_sacrifice_absorb_pulse', phase: 1, row: 6, col: 5 }),
      Object.freeze({ type: 'sound_effect', phase: 1, targets: Object.freeze([{ soundKey: 'sacrifice_absorb' }]) })
    ])
  })
]);

function scenariosForMode(
  mode: PlaybackMode,
  scenarioNames?: readonly string[]
): readonly PlaybackScenarioDefinition[] {
  const selectedNames = scenarioNames && scenarioNames.length ? new Set(scenarioNames) : null;
  return PLAYBACK_SCENARIOS.filter((scenario) => (
    (!scenario.modes || scenario.modes.includes(mode))
    && (!selectedNames || selectedNames.has(scenario.name))
  ));
}

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableJson(value: any): string {
  return JSON.stringify(stableValue(value));
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildPlaybackParityDigest(value: {
  eventTypes: readonly string[];
  phaseEventTypes?: readonly string[];
  globalEventTypes?: readonly string[];
  dispatchLaunchOrder?: readonly string[];
  soundKeys: readonly string[];
  finalModelDigest: string;
}): string {
  return sha256(stableJson({
    eventTypes: value.eventTypes,
    phaseEventTypes: value.phaseEventTypes || [],
    globalEventTypes: value.globalEventTypes || [],
    dispatchLaunchOrder: value.dispatchLaunchOrder || [],
    soundKeys: value.soundKeys,
    finalModelDigest: value.finalModelDigest
  }));
}

function buildFinalVisualSemanticDigest(value: {
  finalModelDigest: string;
  renderedCells: unknown;
}): string {
  return sha256(stableJson({
    finalModelDigest: value.finalModelDigest,
    renderedCells: renderedCellSemantics(value.renderedCells)
  }));
}

function boardFromStones(stones: readonly PlaybackStoneFixture[]): number[][] {
  const board = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(0));
  for (const stone of stones) {
    if (stone.row < 0 || stone.row >= BOARD_ROWS || stone.col < 0 || stone.col >= BOARD_COLS) continue;
    board[stone.row][stone.col] = stone.color;
  }
  return board;
}

function canonicalExpansionState(
  cells: readonly PlaybackExpansionCellFixture[] = []
): Readonly<Record<string, unknown>> {
  const normalized = Array.from(cells).map((cell) => stableValue(cell));
  const last = normalized.length ? normalized[normalized.length - 1] as any : null;
  return Object.freeze({
    active: normalized.length > 0,
    side: last?.side || null,
    row: last?.row ?? null,
    owner: last?.owner ?? 0,
    usedByPlayer: Object.freeze({ black: false, white: false }),
    cells: Object.freeze(normalized)
  });
}

function canonicalFinalModelDigest(scenario: PlaybackScenarioDefinition): string {
  const markers = Array.from(scenario.finalMarkers || []).map(stableValue).sort((left: any, right: any) => (
    String(left?.id || '').localeCompare(String(right?.id || ''))
  ));
  return sha256(stableJson({
    board: boardFromStones(scenario.finalStones),
    boardConfig: { rows: BOARD_ROWS, cols: BOARD_COLS, shape: 'rectangle' },
    boardExpansion: canonicalExpansionState(scenario.finalExpansionCells),
    markers
  }));
}

function createBrowserScenarioPayload(scenario: PlaybackScenarioDefinition): Readonly<{
  definition: PlaybackScenarioDefinition;
  boardSize: Readonly<{ rows: number; cols: number }>;
}> {
  return Object.freeze({ definition: scenario, boardSize: PLAYBACK_BOARD_SIZE });
}

function expectedFinalRenderedCells(
  scenario: PlaybackScenarioDefinition
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  const output: Record<string, Readonly<Record<string, unknown>>> = {};
  const markers = Array.from(scenario.finalMarkers || []) as any[];
  for (const coordinate of scenario.probeCells) {
    const key = `${coordinate.row},${coordinate.col}`;
    const fixture = scenario.finalStones.find((stone) => (
      stone.row === coordinate.row && stone.col === coordinate.col
    ));
    const expansionFixture = (scenario.finalExpansionCells || []).find((cell) => (
      cell.row === coordinate.row && cell.col === coordinate.col && (cell.owner === 1 || cell.owner === -1)
    ));
    const ownerValue = fixture?.color || expansionFixture?.owner || 0;
    const marker = markers.find((candidate) => (
      Number(candidate?.row) === coordinate.row
      && Number(candidate?.col) === coordinate.col
      && ['specialStone', 'manifestStone'].includes(String(candidate?.kind || ''))
    ));
    output[key] = Object.freeze({
      hasStone: ownerValue === 1 || ownerValue === -1,
      owner: ownerValue === 1 ? 'black' : (ownerValue === -1 ? 'white' : null),
      specialType: ownerValue && marker ? String(marker?.data?.type || '').trim().toUpperCase() || null : null
    });
  }
  return Object.freeze(output);
}

function expectedPhaseEventTypes(scenario: PlaybackScenarioDefinition): readonly string[] {
  return Object.freeze(Array.from(scenario.events).map((event: any) => (
    String(event?.type || '').trim().toLowerCase()
  )));
}

function expectedBoardEventTypes(scenario: PlaybackScenarioDefinition): readonly string[] {
  return scenario.execution === 'committed-frame'
    ? Object.freeze([])
    : Object.freeze([scenario.eventType]);
}

function expectedDispatchLaunchOrder(scenario: PlaybackScenarioDefinition): readonly string[] {
  if (scenario.expectedDispatchLaunchOrder) return scenario.expectedDispatchLaunchOrder;
  const globalTypes = Array.from(scenario.expectedGlobalEventTypes || []);
  return Object.freeze([
    ...globalTypes.map((type) => `global:${type}`),
    `board:${scenario.eventType}`,
    `sound:${scenario.soundKey}`
  ]);
}

function publicEntryPath(lane: BrowserLane, renderer: BoardRenderer, mode: PlaybackMode): string {
  const query = new URLSearchParams({ debug: '1', boardRenderer: renderer });
  if (mode === 'noanim') query.set('noanim', '1');
  return lane === 'classic'
    ? `/index.classic.html?${query.toString()}`
    : `/?${query.toString()}`;
}

function serializeError(error: unknown): Readonly<Record<string, unknown>> {
  const candidate = error && typeof error === 'object' ? error as any : null;
  return Object.freeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    code: candidate?.code == null ? null : String(candidate.code),
    stage: candidate?.stage == null ? null : String(candidate.stage)
  });
}

async function installPlaybackProbe(page: any, mode: PlaybackMode): Promise<void> {
  await page.emulateMedia({ reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
}

async function startScenario(
  page: any,
  scenario: PlaybackScenarioDefinition,
  mode: PlaybackMode
): Promise<any> {
  return page.evaluate(async (input: ReturnType<typeof createBrowserScenarioPayload> & {
    readonly mode: PlaybackMode;
  }) => {
    const definition = input.definition;
    const boardRows = Number(input.boardSize.rows);
    const boardCols = Number(input.boardSize.cols);
    const root = window as any;
    const resolveModule = (names: string[], moduleId: string): any => {
      for (const name of names) if (root[name]) return root[name];
      try {
        if (typeof root.require === 'function') return root.require(moduleId);
      } catch (_error) { /* explicit failure below */ }
      return null;
    };
    const core = resolveModule(['CoreLogic', 'Core'], 'game/logic/core');
    const cardLogic = resolveModule(['CardLogic'], 'game/logic/cards');
    const boardUtils = resolveModule(['SharedBoardUtils'], 'shared/shared-board-utils');
    const engine = resolveModule(['AnimationEngine'], 'ui/animation-engine');
    const renderer = resolveModule(['BoardRenderer'], 'ui/board-renderer');
    const debug = root.__boardVisualDebug;
    const boardElement = document.getElementById('board');
    if (!core || !cardLogic || !boardUtils || !engine || !renderer || !debug || !boardElement) {
      throw new Error('Pixi playback browser fixture runtime is unavailable');
    }
    if (typeof renderer.playBoardVisualPhase !== 'function'
      || typeof renderer.getBoardVisualControllerReady !== 'function'
      || typeof renderer.getBoardVisualController !== 'function'
      || typeof engine._playBoardPhaseThroughBackend !== 'function'
      || typeof root.forceFullRender !== 'function'
      || typeof root.renderBoard !== 'function') {
      throw new Error('Pixi playback browser fixture seam is unavailable');
    }
    await renderer.getBoardVisualControllerReady();
    await debug.waitForIdle();

    const createState = (
      stones: readonly PlaybackStoneFixture[],
      markers: readonly unknown[],
      expansionCells: readonly PlaybackExpansionCellFixture[]
    ) => {
      const state = core.createGameState({ rows: boardRows, cols: boardCols, shape: 'rectangle' });
      state.board = Array.from({ length: boardRows }, () => Array(boardCols).fill(0));
      for (const stone of stones) {
        if (stone.row < 0 || stone.row >= boardRows || stone.col < 0 || stone.col >= boardCols) continue;
        state.board[stone.row][stone.col] = stone.color;
      }
      const cells = Array.from(expansionCells || []).map((cell) => ({ ...cell }));
      const lastExpansion = cells.length ? cells[cells.length - 1] : null;
      state.boardExpansion = {
        active: cells.length > 0,
        side: lastExpansion?.side || null,
        row: lastExpansion?.row ?? null,
        owner: lastExpansion?.owner ?? 0,
        usedByPlayer: { black: false, white: false },
        cells
      };
      boardUtils.attachBoardShape(state.board, {
        boardConfig: state.boardConfig,
        boardExpansion: state.boardExpansion,
        cardState: { markers }
      });
      return state;
    };
    const configureCardState = (markers: readonly unknown[]) => {
      if (typeof cardLogic.createCardState !== 'function') {
        throw new Error('Pixi playback browser fixture requires CardLogic.createCardState');
      }
      const cardState = cardLogic.createCardState(null, {
        plainReversi: true,
        boardConfig: { rows: boardRows, cols: boardCols, shape: 'rectangle' }
      });
      cardState.markers = markers.map((marker: unknown) => JSON.parse(JSON.stringify(marker)));
      cardState.pendingEffectByPlayer = { black: null, white: null };
      cardState.boardBonusByCell = {};
      cardState.boardBonusConsumedByCell = {};
      cardState.theoryNumberCellByCell = {};
      cardState.presentationEvents = [];
      cardState._presentationEventsPersist = [];
      root.cardState = cardState;
      return cardState;
    };

    const initialMarkers = Array.from(definition.initialMarkers || []);
    const finalMarkers = Array.from(definition.finalMarkers || []);
    configureCardState(initialMarkers);
    root.gameState = createState(
      definition.initialStones,
      initialMarkers,
      Array.from(definition.initialExpansionCells || [])
    );
    await Promise.resolve(root.forceFullRender(boardElement));
    await debug.waitForIdle();
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
    await debug.waitForIdle();

    const initialVisualDigest = debug.getVisualFrameDigest();
    const initialBackendDiagnostics = debug.getBackendDiagnostics();
    const cardState = configureCardState(finalMarkers);
    root.gameState = createState(
      definition.finalStones,
      finalMarkers,
      Array.from(definition.finalExpansionCells || [])
    );
    engine.boardEl = boardElement;

    const originalPlayBoardVisualPhase = renderer.playBoardVisualPhase;
    const originalPlayBoardPhaseThroughBackend = engine._playBoardPhaseThroughBackend;
    const originalExecutePhase = engine.executePhase;
    const originalHandleSoundEffect = engine.handleSoundEffect;
    const originalHandleDestroySourceAnimation = engine.handleDestroySourceAnimation;
    const originalHandleZombieBiteSourceAnimation = engine.handleZombieBiteSourceAnimation;
    const originalHandleManifestEndingGlobal = engine.handleManifestEndingGlobal;
    const soundEngine = root.SoundEngine && typeof root.SoundEngine === 'object'
      ? root.SoundEngine
      : null;
    const originalSoundInit = soundEngine?.init;
    const originalPlayEffectByKey = soundEngine?.playEffectByKey;
    const originalSyncManifestBgmOverride = soundEngine?.syncManifestBgmOverride;
    const probe: any = {
      scenario: definition.name,
      boardLaunches: [],
      boardCompletions: [],
      phaseLaunches: [],
      phaseCompletions: [],
      globalLaunches: [],
      globalCompletions: [],
      dispatchLaunchOrder: [],
      soundKeys: [],
      manifestWorldStarts: [],
      manifestWorldCompletions: [],
      manifestBgmTransitions: [],
      activeBoardLaunches: 0,
      frameCommitStarted: false,
      keyFrame: null,
      keyFrameProbeError: null,
      keyFrameReady: null,
      done: false,
      error: null,
      promise: null
    };
    let resolveKeyFrameReady!: () => void;
    probe.keyFrameReady = new Promise<void>((resolve) => {
      resolveKeyFrameReady = resolve;
    });

    const captureCanvasPngDataUrl = (): Readonly<{
      dataUrl: string | null;
      source: 'pixi-extract' | null;
      error: string | null;
    }> => {
      const canvas = boardElement.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) {
        return Object.freeze({ dataUrl: null, source: null, error: 'Pixi canvas is unavailable' });
      }
      try {
        const controller = renderer.getBoardVisualController();
        if (!controller || typeof controller.captureDebugFramePngDataUrl !== 'function') {
          return Object.freeze({
            dataUrl: null,
            source: null,
            error: 'Pixi debug frame extractor is unavailable'
          });
        }
        const extracted = controller.captureDebugFramePngDataUrl();
        if (/^data:image\/png;base64,[A-Za-z0-9+/=\r\n]+$/.test(String(extracted || ''))) {
          return Object.freeze({ dataUrl: extracted, source: 'pixi-extract' as const, error: null });
        }
        return Object.freeze({ dataUrl: null, source: null, error: 'Pixi extractor returned an invalid PNG' });
      } catch (error) {
        return Object.freeze({
          dataUrl: null,
          source: null,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
    const readRenderedCells = (): Readonly<Record<string, unknown>> => {
      const renderedCells: Record<string, unknown> = {};
      for (const cell of definition.probeCells) {
        const rendered = debug.getRenderedCell(cell.row, cell.col);
        const stone = rendered?.stone || null;
        const pixiDiagnostics = stone && typeof stone.visible === 'boolean';
        const visible = pixiDiagnostics ? stone.visible === true : !!stone;
        const markers = Array.isArray(rendered?.markers) ? rendered.markers : [];
        const markerSpecialType = (() => {
          for (const marker of markers) {
            const kind = String(marker?.kind || '').trim().toLowerCase();
            const explicit = String(marker?.data?.type || '').trim().toUpperCase();
            if (explicit) return explicit;
            if (kind === 'guard') return 'GUARD';
            if (kind === 'living-will-aura') return 'LIVING_WILL';
            if (kind === 'blockade') return 'BLOCKADE';
            if (kind === 'frozen') return 'FREEZE';
            if (kind === 'seed') return 'SEED';
            if (kind === 'poison-cell') return 'POISON_CELL';
            if (kind === 'poisoned') return 'POISONED';
          }
          return null;
        })();
        renderedCells[`${cell.row},${cell.col}`] = {
          rendered: rendered?.rendered !== false,
          hasStone: visible && !!stone?.owner,
          owner: visible ? stone?.owner || null : null,
          specialType: visible ? stone?.specialType || markerSpecialType : null,
          playbackHidden: rendered?.playback?.hidden === true
        };
      }
      return renderedCells;
    };
    const readKeyFrameCandidate = (captureStage: string): any => ({
      captureStage,
      writerMode: debug.getWriterMode(),
      visualFrameDigest: debug.getVisualFrameDigest(),
      backendDiagnostics: debug.getBackendDiagnostics(),
      displayObjectCounts: debug.getDisplayObjectCounts(),
      renderedCells: readRenderedCells(),
      activeBoardLaunches: Number(probe.activeBoardLaunches || 0)
    });
    const activeProjectionCount = (candidate: any): number => {
      const pool = candidate?.backendDiagnostics?.pool || {};
      const scene = candidate?.backendDiagnostics?.scene || {};
      return Number(pool.activePlaybackGhostCount || 0)
        + Number(pool.activePlaybackHighlightLeaseCount || 0)
        + Number(pool.activePlaybackEffectCount ?? scene.activePlaybackEffectCount ?? 0);
    };
    const baselineRenderCount = Number(initialBackendDiagnostics?.application?.renderCount || 0);
    const isRenderedActiveCandidate = (candidate: any): boolean => {
      const timeline = candidate?.backendDiagnostics?.timeline || {};
      const application = candidate?.backendDiagnostics?.application || {};
      if (candidate?.writerMode !== 'playback'
        || Number(timeline.activeRunCount || 0) < 1
        || Number(application.renderCount || 0) <= baselineRenderCount) {
        return false;
      }
      const reducedDestroy = input.mode === 'reduced-motion' && definition.name === 'destroy';
      return reducedDestroy || activeProjectionCount(candidate) >= 1;
    };
    const isRenderedTopologyRevealCandidate = (candidate: any): boolean => {
      const application = candidate?.backendDiagnostics?.application || {};
      const scene = candidate?.backendDiagnostics?.scene || {};
      return Number(application.renderCount || 0) > baselineRenderCount
        && Number(scene.activeTopologyRevealCount || 0) >= 1
        && Array.isArray(scene.topologyRevealKeys)
        && scene.topologyRevealKeys.length >= 1;
    };
    const commitKeyFrame = (
      candidate: any,
      captureKind: 'active' | 'settled',
      source: 'playback' | 'committed-frame' = 'playback'
    ): void => {
      if (probe.keyFrame) return;
      const frameCapture = captureCanvasPngDataUrl();
      probe.keyFrame = {
        ...candidate,
        captureKind,
        capturedInsidePlayback: source === 'playback',
        capturedFromCommittedFrame: source === 'committed-frame',
        playbackDone: captureKind === 'settled',
        canvasPngDataUrl: frameCapture.dataUrl,
        canvasCaptureSource: frameCapture.source,
        canvasCaptureError: frameCapture.error
      };
      resolveKeyFrameReady();
    };
    const serializeProbeError = (error: any): Readonly<Record<string, unknown>> => ({
      name: String(error?.name || 'Error'),
      message: String(error?.message || error || '')
    });
    const normalizeEventTypes = (events: readonly any[]): string[] => events.map((event: any) => (
      String(event?.type || '').trim().toLowerCase()
    ));
    const recordSoundKey = (value: unknown): void => {
      const key = String(value || '').trim();
      if (!key) return;
      probe.soundKeys.push(key);
      probe.dispatchLaunchOrder.push(`sound:${key}`);
    };
    const wrapGlobalEvent = (
      type: string,
      original: ((event: any) => Promise<void> | void) | undefined,
      options: { manifestWorld?: boolean } = {}
    ) => async function (this: any, event: any) {
      probe.globalLaunches.push(type);
      probe.dispatchLaunchOrder.push(`global:${type}`);
      let result: Promise<void> | void;
      try {
        result = typeof original === 'function' ? original.call(this, event) : undefined;
        if (options.manifestWorld) {
          probe.manifestWorldStarts.push({
            overlayPresent: !!document.querySelector('.manifest-ending-overlay'),
            noAnimation: input.mode === 'noanim'
          });
        }
        await result;
        probe.globalCompletions.push(type);
      } finally {
        if (options.manifestWorld) {
          probe.manifestWorldCompletions.push({
            overlayPresent: !!document.querySelector('.manifest-ending-overlay'),
            noAnimation: input.mode === 'noanim'
          });
        }
      }
    };

    engine.executePhase = async function (events: any[]) {
      const eventTypes = normalizeEventTypes(Array.isArray(events) ? events : []);
      probe.phaseLaunches.push(eventTypes);
      try {
        const result = await originalExecutePhase.call(this, events);
        probe.phaseCompletions.push(eventTypes);
        return result;
      } catch (error) {
        probe.phaseCompletions.push(eventTypes);
        throw error;
      }
    };
    engine.handleDestroySourceAnimation = wrapGlobalEvent(
      'destroy_source_animation',
      originalHandleDestroySourceAnimation
    );
    engine.handleZombieBiteSourceAnimation = wrapGlobalEvent(
      'zombie_bite_source_animation',
      originalHandleZombieBiteSourceAnimation
    );
    engine.handleManifestEndingGlobal = wrapGlobalEvent(
      'manifest_ending',
      originalHandleManifestEndingGlobal,
      { manifestWorld: true }
    );
    if (soundEngine) {
      soundEngine.init = () => undefined;
      soundEngine.playEffectByKey = (key: unknown) => {
        recordSoundKey(key);
        return true;
      };
      soundEngine.syncManifestBgmOverride = (...args: unknown[]) => {
        probe.manifestBgmTransitions.push(args);
        return true;
      };
    }

    engine._playBoardPhaseThroughBackend = async function (events: any[], phaseScope?: any) {
      const eventTypes = normalizeEventTypes(Array.isArray(events) ? events : []);
      probe.boardLaunches.push(eventTypes);
      probe.dispatchLaunchOrder.push(`board:${eventTypes.join('+')}`);
      probe.activeBoardLaunches += 1;
      try {
        const result = await originalPlayBoardPhaseThroughBackend.call(this, events, phaseScope);
        probe.boardCompletions.push(eventTypes);
        return result;
      } finally {
        probe.activeBoardLaunches = Math.max(0, probe.activeBoardLaunches - 1);
      }
    };

    renderer.playBoardVisualPhase = async function (...args: any[]) {
      let phaseSettled = false;
      let samplingPromise: Promise<void> | null = null;
      try {
        const playbackResult = originalPlayBoardVisualPhase.apply(this, args);
        if (debug.getBackendKind() === 'pixi') {
          samplingPromise = (async () => {
            const sample = (captureStage: string): boolean => {
              const candidate = readKeyFrameCandidate(captureStage);
              if (input.mode !== 'noanim' && isRenderedActiveCandidate(candidate)) {
                commitKeyFrame(candidate, 'active');
                return true;
              }
              if (phaseSettled) {
                commitKeyFrame(candidate, 'settled');
                return true;
              }
              return false;
            };

            // Pixi timeline.run() publishes its projection synchronously, then
            // performs the first explicit renderer flush in a microtask. Sample
            // both boundaries before following private-ticker animation frames.
            if (sample('sync')) return;
            await Promise.resolve();
            if (sample('microtask')) return;
            let animationFrameCount = 0;
            while (!phaseSettled && animationFrameCount < 120) {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
              animationFrameCount += 1;
              if (sample('animation-frame')) return;
            }
            sample('settled-fallback');
          })().catch((error: any) => {
            probe.keyFrameProbeError = serializeProbeError(error);
            resolveKeyFrameReady();
          });
        }
        const result = await playbackResult;
        return result;
      } finally {
        phaseSettled = true;
        if (samplingPromise) await samplingPromise;
      }
    };
    engine.handleSoundEffect = async function (event: any) {
      const keys: string[] = [];
      if (event?.soundKey) keys.push(String(event.soundKey));
      for (const target of (Array.isArray(event?.targets) ? event.targets : [])) {
        if (target?.soundKey) keys.push(String(target.soundKey));
      }
      for (const key of keys) recordSoundKey(key);
    };

    const playbackPromise = (async () => {
      try {
        try {
          if (definition.execution === 'committed-frame') {
            probe.frameCommitStarted = true;
            let frameSettled = false;
            // Keep the settled baseline from forceFullRender(), but submit the
            // committed topology delta through the normal public render path.
            // invalidate()/forceFullRender() would discard the DOM renderer's
            // previous materialization before it can classify reveal cells.
            const frameCommit = Promise.resolve(root.renderBoard(boardElement));
            let samplingPromise: Promise<void> | null = null;
            if (debug.getBackendKind() === 'pixi') {
              samplingPromise = (async () => {
                const sample = (captureStage: string): boolean => {
                  const candidate = readKeyFrameCandidate(captureStage);
                  if (input.mode !== 'noanim' && isRenderedTopologyRevealCandidate(candidate)) {
                    commitKeyFrame(candidate, 'active', 'committed-frame');
                    return true;
                  }
                  if (frameSettled) {
                    commitKeyFrame(candidate, 'settled', 'committed-frame');
                    return true;
                  }
                  return false;
                };
                if (sample('sync')) return;
                await Promise.resolve();
                if (sample('microtask')) return;
                let animationFrameCount = 0;
                while (!frameSettled && animationFrameCount < 120) {
                  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                  animationFrameCount += 1;
                  if (sample('animation-frame')) return;
                }
                sample('settled-fallback');
              })().catch((error: any) => {
                probe.keyFrameProbeError = serializeProbeError(error);
                resolveKeyFrameReady();
              });
            }
            try {
              await frameCommit;
            } finally {
              frameSettled = true;
            }
            if (samplingPromise) await samplingPromise;
            // The committed frame can settle one browser task before the
            // 260ms reveal run is registered. Require evidence that the run
            // started before treating an idle sample as final settlement.
            const initialStartedRunCount = Number(
              initialBackendDiagnostics?.timeline?.startedRunCount || 0
            );
            let topologyRevealRunObserved = false;
            for (let frame = 0; frame < 180; frame += 1) {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
              const diagnostics = debug.getBackendDiagnostics() || {};
              const scene = diagnostics.scene || {};
              const timeline = diagnostics.timeline || {};
              topologyRevealRunObserved = topologyRevealRunObserved
                || Number(scene.activeTopologyRevealCount || 0) > 0
                || Number(timeline.startedRunCount || 0) > initialStartedRunCount;
              if (topologyRevealRunObserved
                && Number(scene.activeTopologyRevealCount || 0) === 0
                && Number(timeline.activeRunCount || 0) === 0) break;
            }
          } else {
            await engine.play(definition.events);
          }
        } catch (error: any) {
          probe.error = {
            name: String(error?.name || 'Error'),
            message: String(error?.message || error || ''),
            code: error?.code == null ? null : String(error.code)
          };
        }
        await debug.waitForIdle();
        // Committed-frame topology sound is intentionally queued in rAF after
        // the renderer settlement callback. Keep the probe installed through
        // that boundary so DOM/Pixi compare the actual audible order.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await debug.waitForIdle();
      } finally {
        renderer.playBoardVisualPhase = originalPlayBoardVisualPhase;
        engine._playBoardPhaseThroughBackend = originalPlayBoardPhaseThroughBackend;
        engine.executePhase = originalExecutePhase;
        engine.handleSoundEffect = originalHandleSoundEffect;
        engine.handleDestroySourceAnimation = originalHandleDestroySourceAnimation;
        engine.handleZombieBiteSourceAnimation = originalHandleZombieBiteSourceAnimation;
        engine.handleManifestEndingGlobal = originalHandleManifestEndingGlobal;
        if (soundEngine) {
          soundEngine.init = originalSoundInit;
          soundEngine.playEffectByKey = originalPlayEffectByKey;
          soundEngine.syncManifestBgmOverride = originalSyncManifestBgmOverride;
        }
        probe.done = true;
      }
      return true;
    })();
    probe.promise = playbackPromise;
    playbackPromise.catch(() => undefined);
    root.__pixiPlaybackBrowserCheckProbe = probe;
    return {
      backendKind: debug.getBackendKind(),
      initialVisualDigest,
      initialBackendDiagnostics,
      finalMarkerCount: cardState.markers.length
    };
  }, { ...createBrowserScenarioPayload(scenario), mode });
}

async function waitForScenarioStart(page: any): Promise<void> {
  await page.waitForFunction(() => {
    const probe = (window as any).__pixiPlaybackBrowserCheckProbe;
    return !!probe && (probe.boardLaunches.length > 0 || probe.frameCommitStarted === true || probe.done === true);
  }, null, { timeout: 10000 });
}

async function readScenarioProbe(
  page: any,
  probeCells: readonly Readonly<{ row: number; col: number }>[]
): Promise<any> {
  return page.evaluate((cells: readonly Readonly<{ row: number; col: number }>[]) => {
    const root = window as any;
    const debug = root.__boardVisualDebug;
    const probe = root.__pixiPlaybackBrowserCheckProbe;
    const renderedCells: Record<string, unknown> = {};
    for (const cell of cells) {
      const rendered = debug.getRenderedCell(cell.row, cell.col);
      const stone = rendered?.stone || null;
      const pixiDiagnostics = stone && typeof stone.visible === 'boolean';
      const visible = pixiDiagnostics ? stone.visible === true : !!stone;
      const markers = Array.isArray(rendered?.markers) ? rendered.markers : [];
      const markerSpecialType = (() => {
        for (const marker of markers) {
          const kind = String(marker?.kind || '').trim().toLowerCase();
          const explicit = String(marker?.data?.type || '').trim().toUpperCase();
          if (explicit) return explicit;
          if (kind === 'guard') return 'GUARD';
          if (kind === 'living-will-aura') return 'LIVING_WILL';
          if (kind === 'blockade') return 'BLOCKADE';
          if (kind === 'frozen') return 'FREEZE';
          if (kind === 'seed') return 'SEED';
          if (kind === 'poison-cell') return 'POISON_CELL';
          if (kind === 'poisoned') return 'POISONED';
        }
        return null;
      })();
      renderedCells[`${cell.row},${cell.col}`] = {
        rendered: rendered?.rendered !== false,
        hasStone: visible && !!stone?.owner,
        owner: visible ? stone?.owner || null : null,
        specialType: visible ? stone?.specialType || markerSpecialType : null,
        playbackHidden: rendered?.playback?.hidden === true
      };
    }
    return {
      writerMode: debug.getWriterMode(),
      visualFrameDigest: debug.getVisualFrameDigest(),
      backendDiagnostics: debug.getBackendDiagnostics(),
      displayObjectCounts: debug.getDisplayObjectCounts(),
      renderedCells,
      playbackDone: probe?.done === true,
      activeBoardLaunches: Number(probe?.activeBoardLaunches || 0)
    };
  }, probeCells);
}

async function readInPageKeyFrame(page: any): Promise<any> {
  await page.waitForFunction(() => {
    const probe = (window as any).__pixiPlaybackBrowserCheckProbe;
    return !!probe && (!!probe.keyFrame || !!probe.keyFrameProbeError || probe.done === true);
  }, null, { timeout: 10000 });
  return page.evaluate(() => {
    const probe = (window as any).__pixiPlaybackBrowserCheckProbe;
    if (probe?.keyFrameProbeError) {
      return {
        capturedInsidePlayback: true,
        captureKind: 'failed',
        playbackDone: probe?.done === true,
        probeError: probe.keyFrameProbeError,
        canvasPngDataUrl: null
      };
    }
    return probe?.keyFrame || null;
  });
}

function renderedCellSemantics(cells: unknown): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  if (!cells || typeof cells !== 'object' || Array.isArray(cells)) return Object.freeze({});
  const output: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const key of Object.keys(cells as Record<string, unknown>).sort()) {
    const cell = (cells as Record<string, any>)[key] || {};
    output[key] = Object.freeze({
      hasStone: cell.hasStone === true,
      owner: cell.hasStone === true ? cell.owner || null : null,
      specialType: cell.hasStone === true ? cell.specialType || null : null
    });
  }
  return Object.freeze(output);
}

async function completeScenario(page: any): Promise<any> {
  return page.evaluate(async (boardSize: Readonly<{ rows: number; cols: number }>) => {
    const root = window as any;
    const probe = root.__pixiPlaybackBrowserCheckProbe;
    if (!probe?.promise) throw new Error('Pixi playback browser scenario promise is unavailable');
    await probe.promise;
    await root.__boardVisualDebug.waitForIdle();
    const stable = (value: any): any => {
      if (Array.isArray(value)) return value.map(stable);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    };
    const markers = Array.from(root.cardState?.markers || [])
      .map(stable)
      .sort((left: any, right: any) => String(left?.id || '').localeCompare(String(right?.id || '')));
    return {
      boardLaunches: probe.boardLaunches,
      boardCompletions: probe.boardCompletions,
      phaseLaunches: probe.phaseLaunches,
      phaseCompletions: probe.phaseCompletions,
      globalLaunches: probe.globalLaunches,
      globalCompletions: probe.globalCompletions,
      dispatchLaunchOrder: probe.dispatchLaunchOrder,
      soundKeys: probe.soundKeys,
      manifestWorldStarts: probe.manifestWorldStarts,
      manifestWorldCompletions: probe.manifestWorldCompletions,
      manifestBgmTransitions: probe.manifestBgmTransitions,
      error: probe.error,
      finalModel: {
        board: root.gameState.board.map((row: any[]) => Array.from(row)),
        boardConfig: {
          rows: Number(root.gameState.boardConfig?.rows || boardSize.rows),
          cols: Number(root.gameState.boardConfig?.cols || boardSize.cols),
          shape: String(root.gameState.boardConfig?.shape || 'rectangle')
        },
        boardExpansion: {
          active: root.gameState.boardExpansion?.active === true,
          side: root.gameState.boardExpansion?.side || null,
          row: root.gameState.boardExpansion?.row ?? null,
          owner: root.gameState.boardExpansion?.owner ?? 0,
          usedByPlayer: {
            black: root.gameState.boardExpansion?.usedByPlayer?.black === true,
            white: root.gameState.boardExpansion?.usedByPlayer?.white === true
          },
          cells: Array.from(root.gameState.boardExpansion?.cells || []).map(stable)
        },
        markers
      },
      playbackActive: root.VisualPlaybackActive === true,
      processing: root.isProcessing === true,
      cardAnimating: root.isCardAnimating === true,
      writerMode: root.__boardVisualDebug.getWriterMode(),
      finalVisualDigest: root.__boardVisualDebug.getVisualFrameDigest(),
      backendDiagnostics: root.__boardVisualDebug.getBackendDiagnostics(),
      displayObjectCounts: root.__boardVisualDebug.getDisplayObjectCounts()
    };
  }, PLAYBACK_BOARD_SIZE);
}

function pngBufferFromDataUrl(value: unknown): Buffer | null {
  if (typeof value !== 'string') return null;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
  if (!match) return null;
  const buffer = Buffer.from(match[1].replace(/[\r\n]/g, ''), 'base64');
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.length > pngSignature.length && buffer.subarray(0, pngSignature.length).equals(pngSignature)
    ? buffer
    : null;
}

async function captureScenario(
  page: any,
  scenario: PlaybackScenarioDefinition,
  renderer: BoardRenderer,
  mode: PlaybackMode,
  artifactDir: string,
  writeArtifacts: boolean
): Promise<any> {
  const started = await startScenario(page, scenario, mode);
  await waitForScenarioStart(page);
  const keyFrameProbe = renderer === 'pixi'
    ? await readInPageKeyFrame(page)
    : null;
  let keyFrameScreenshotSha256: string | null = null;
  let keyFrameArtifactPath: string | null = null;
  let keyFrameScreenshotSource: 'pixi-extract' | 'external-board-fallback' | null = null;
  if (renderer === 'pixi') {
    const inPageScreenshot = pngBufferFromDataUrl(keyFrameProbe?.canvasPngDataUrl);
    const screenshot = inPageScreenshot
      || await page.locator('#board').screenshot({ animations: 'allow' });
    keyFrameScreenshotSource = inPageScreenshot
      ? 'pixi-extract'
      : 'external-board-fallback';
    keyFrameScreenshotSha256 = sha256(screenshot);
    if (writeArtifacts) {
      keyFrameArtifactPath = path.join(artifactDir, `${mode}-${scenario.name}-key-frame.png`);
      fs.mkdirSync(path.dirname(keyFrameArtifactPath), { recursive: true });
      fs.writeFileSync(keyFrameArtifactPath, screenshot);
    }
  }

  const completion = await completeScenario(page);
  const finalProbe = await readScenarioProbe(page, scenario.probeCells);
  const finalModelDigest = sha256(stableJson(completion.finalModel));
  const eventTypes = completion.boardLaunches.flatMap((launch: string[]) => launch);
  const completedEventTypes = completion.boardCompletions.flatMap((launch: string[]) => launch);
  const phaseEventTypes = completion.phaseLaunches.flatMap((launch: string[]) => launch);
  const completedPhaseEventTypes = completion.phaseCompletions.flatMap((launch: string[]) => launch);
  const finalVisualSemanticDigest = buildFinalVisualSemanticDigest({
    finalModelDigest,
    renderedCells: finalProbe.renderedCells
  });
  return {
    scenario: scenario.name,
    expectedEventType: scenario.eventType,
    expectedEventTypes: expectedBoardEventTypes(scenario),
    expectedSoundKey: scenario.soundKey,
    expectedPhaseEventTypes: expectedPhaseEventTypes(scenario),
    expectedGlobalEventTypes: scenario.expectedGlobalEventTypes || Object.freeze([]),
    expectedDispatchLaunchOrder: expectedDispatchLaunchOrder(scenario),
    pixiEvidence: scenario.pixiEvidence || 'timeline',
    execution: scenario.execution || 'playback',
    expectedFinalModelDigest: canonicalFinalModelDigest(scenario),
    expectedFinalRenderedCells: expectedFinalRenderedCells(scenario),
    inputDigest: sha256(stableJson(scenario.events)),
    started,
    eventTypes,
    completedEventTypes,
    phaseEventTypes,
    completedPhaseEventTypes,
    globalEventTypes: completion.globalLaunches,
    completedGlobalEventTypes: completion.globalCompletions,
    dispatchLaunchOrder: completion.dispatchLaunchOrder,
    soundKeys: completion.soundKeys,
    manifestWorldStarts: completion.manifestWorldStarts,
    manifestWorldCompletions: completion.manifestWorldCompletions,
    manifestBgmTransitions: completion.manifestBgmTransitions,
    error: completion.error,
    finalModelDigest,
    finalVisualDigest: completion.finalVisualDigest,
    finalVisualSemanticDigest,
    settledFlags: {
      playbackActive: completion.playbackActive,
      processing: completion.processing,
      cardAnimating: completion.cardAnimating,
      writerMode: completion.writerMode
    },
    keyFrame: keyFrameProbe ? {
      ...Object.fromEntries(Object.entries(keyFrameProbe).filter(([key]) => key !== 'canvasPngDataUrl')),
      screenshotSha256: keyFrameScreenshotSha256,
      screenshotSource: keyFrameScreenshotSource,
      artifactPath: keyFrameArtifactPath
    } : null,
    final: finalProbe,
    parityDigest: buildPlaybackParityDigest({
      eventTypes,
      phaseEventTypes,
      globalEventTypes: completion.globalLaunches,
      dispatchLaunchOrder: completion.dispatchLaunchOrder,
      soundKeys: completion.soundKeys,
      finalModelDigest
    })
  };
}

async function captureRendererLane(
  rootDir: string,
  lane: BrowserLane,
  renderer: BoardRenderer,
  mode: PlaybackMode,
  scenarioNames: readonly string[],
  artifactRoot: string,
  writeArtifacts: boolean
): Promise<any> {
  const artifactDir = path.join(artifactRoot, lane, renderer);
  const smoke = await runBrowserUiControlSmoke({
    rootDir,
    entryPath: publicEntryPath(lane, renderer, mode),
    readyOnly: true,
    log: false,
    pageOptions: { viewport: { width: 980, height: 760 }, deviceScaleFactor: 1 },
    beforeGoto: (page: any) => installPlaybackProbe(page, mode),
    afterReady: async (page: any) => {
      const scenarios: any[] = [];
      for (const scenario of scenariosForMode(mode, scenarioNames)) {
        scenarios.push(await captureScenario(
          page,
          scenario,
          renderer,
          mode,
          artifactDir,
          writeArtifacts
        ));
      }
      return { scenarios };
    }
  });
  return {
    lane,
    renderer,
    mode,
    publicEntry: publicEntryPath(lane, renderer, mode),
    browserVersion: smoke.browserVersion,
    userAgent: smoke.userAgent,
    smokeEvaluation: smoke.evaluation,
    scenarios: smoke.afterReadyResult?.scenarios || []
  };
}

function evaluateScenario(report: any, errors: string[]): void {
  const prefix = `${report.lane}/${report.renderer}/${report.mode}/${report.scenario}`;
  const expectedEventTypes = report.expectedEventTypes || [report.expectedEventType];
  if (stableJson(report.eventTypes) !== stableJson(expectedEventTypes)) {
    errors.push(`${prefix}: board event start order drifted`);
  }
  if (stableJson(report.completedEventTypes) !== stableJson(expectedEventTypes)) {
    errors.push(`${prefix}: board event completion order drifted`);
  }
  if (stableJson(report.phaseEventTypes) !== stableJson(report.expectedPhaseEventTypes)) {
    errors.push(`${prefix}: canonical phase event start order drifted`);
  }
  if (stableJson(report.completedPhaseEventTypes) !== stableJson(report.expectedPhaseEventTypes)) {
    errors.push(`${prefix}: canonical phase event completion order drifted`);
  }
  if (stableJson(report.globalEventTypes) !== stableJson(report.expectedGlobalEventTypes)) {
    errors.push(`${prefix}: hybrid/global event start order drifted`);
  }
  if (stableJson(report.completedGlobalEventTypes) !== stableJson(report.expectedGlobalEventTypes)) {
    errors.push(`${prefix}: hybrid/global event completion order drifted`);
  }
  if (stableJson(report.dispatchLaunchOrder) !== stableJson(report.expectedDispatchLaunchOrder)) {
    errors.push(`${prefix}: board/global/sound launch order drifted`);
  }
  if (stableJson(report.soundKeys) !== stableJson([report.expectedSoundKey])) {
    errors.push(`${prefix}: sound order drifted`);
  }
  if (report.error) errors.push(`${prefix}: playback failed: ${report.error.message || report.error}`);
  if (report.finalModelDigest !== report.expectedFinalModelDigest) {
    errors.push(`${prefix}: final model digest drifted`);
  }
  if (stableJson(renderedCellSemantics(report.final?.renderedCells))
    !== stableJson(renderedCellSemantics(report.expectedFinalRenderedCells))) {
    errors.push(`${prefix}: final rendered cell semantics drifted`);
  }
  if (report.finalVisualSemanticDigest !== buildFinalVisualSemanticDigest({
    finalModelDigest: report.finalModelDigest,
    renderedCells: report.final?.renderedCells
  })) {
    errors.push(`${prefix}: final visual semantic digest is inconsistent`);
  }
  for (const cell of Object.values(report.final?.renderedCells || {}) as any[]) {
    if (cell?.rendered === false || cell?.playbackHidden === true) {
      errors.push(`${prefix}: final rendered cell remained offscreen or playback-hidden`);
      break;
    }
  }
  if (report.parityDigest !== buildPlaybackParityDigest(report)) {
    errors.push(`${prefix}: event, sound, and final-model parity digest is inconsistent`);
  }
  if (report.settledFlags?.playbackActive
    || report.settledFlags?.processing
    || report.settledFlags?.cardAnimating
    || report.settledFlags?.writerMode !== 'idle') {
    errors.push(`${prefix}: playback flags or writer did not settle`);
  }
  if (report.scenario === 'manifest-ending-world') {
    const worldStart = report.manifestWorldStarts?.[0];
    const worldCompletion = report.manifestWorldCompletions?.[0];
    if (report.manifestWorldStarts?.length !== 1
      || report.manifestWorldCompletions?.length !== 1
      || worldCompletion?.overlayPresent === true) {
      errors.push(`${prefix}: manifest world presenter did not launch and clean up exactly once`);
    }
    if ((report.mode === 'noanim' && worldStart?.overlayPresent === true)
      || (report.mode !== 'noanim' && worldStart?.overlayPresent !== true)) {
      errors.push(`${prefix}: manifest world overlay motion policy drifted`);
    }
    const expectedTransitionMs = report.mode === 'noanim' ? 0 : 2000;
    const explicitTransitions = (report.manifestBgmTransitions || []).filter((args: any[]) => (
      args?.[2] && Number(args[2].transitionMs) === expectedTransitionMs
    ));
    if (explicitTransitions.length !== 1) {
      errors.push(`${prefix}: manifest world BGM transition drifted`);
    }
  }
  if (report.renderer !== 'pixi') return;
  if (report.pixiEvidence === 'topology-reveal'
    ? report.keyFrame?.capturedFromCommittedFrame !== true
    : report.keyFrame?.capturedInsidePlayback !== true) {
    errors.push(`${prefix}: key-frame was not captured inside board playback`);
  }
  if (report.keyFrame?.probeError) {
    errors.push(`${prefix}: in-page key-frame probe failed: ${report.keyFrame.probeError.message || report.keyFrame.probeError}`);
  }
  if (report.keyFrame?.canvasCaptureError) {
    errors.push(`${prefix}: Pixi key-frame extraction failed: ${report.keyFrame.canvasCaptureError}`);
  }
  if (!/^[a-f0-9]{64}$/.test(String(report.keyFrame?.screenshotSha256 || ''))) {
    errors.push(`${prefix}: key-frame screenshot evidence is missing`);
  }
  if (report.keyFrame?.screenshotSource !== 'pixi-extract') {
    errors.push(`${prefix}: key-frame screenshot was not captured through Pixi's offscreen extractor`);
  }
  if (report.pixiEvidence === 'topology-reveal') {
    const scene = report.keyFrame?.backendDiagnostics?.scene || {};
    if (report.mode === 'noanim') {
      if (report.keyFrame?.captureKind !== 'settled') {
        errors.push(`${prefix}: NOANIM topology key-frame did not capture immediate settlement`);
      }
    } else if (report.keyFrame?.captureKind !== 'active'
      || Number(scene.activeTopologyRevealCount || 0) < 1
      || !Array.isArray(scene.topologyRevealKeys)
      || scene.topologyRevealKeys.length < 1) {
      errors.push(`${prefix}: committed topology reveal was not captured from an active frame`);
    }
  } else if (report.mode !== 'noanim' && report.pixiEvidence !== 'immediate') {
    const pool = report.keyFrame?.backendDiagnostics?.pool || {};
    const scene = report.keyFrame?.backendDiagnostics?.scene || {};
    const timeline = report.keyFrame?.backendDiagnostics?.timeline || {};
    const activeProjectionCount = Number(pool.activePlaybackGhostCount || 0)
      + Number(pool.activePlaybackHighlightLeaseCount || 0)
      + Number(pool.activePlaybackEffectCount ?? scene.activePlaybackEffectCount ?? 0);
    const observedBeforeSettlement = report.keyFrame?.writerMode === 'playback'
      && report.keyFrame?.playbackDone !== true
      && Number(timeline.activeRunCount || 0) >= 1;
    const observedReducedSettlement = report.mode === 'reduced-motion'
      && (report.keyFrame?.writerMode === 'idle' || report.keyFrame?.writerMode === 'playback')
      && report.keyFrame?.playbackDone === true
      && report.keyFrame?.captureKind === 'settled'
      && Number(timeline.activeRunCount || 0) === 0;
    if (!observedBeforeSettlement && !observedReducedSettlement) {
      errors.push(`${prefix}: animated key-frame was not observed before settlement`);
    }
    if (report.mode === 'normal' && report.keyFrame?.captureKind !== 'active') {
      errors.push(`${prefix}: normal-motion key-frame was not captured from an active frame`);
    }
    const reducedDestroy = report.mode === 'reduced-motion' && report.scenario === 'destroy';
    if (observedBeforeSettlement && (reducedDestroy ? activeProjectionCount !== 0 : activeProjectionCount < 1)) {
      errors.push(reducedDestroy
        ? `${prefix}: reduced-motion destroy retained a visual ghost after its immediate fade`
        : `${prefix}: animated key-frame had no active projection`);
    }
  } else if (report.keyFrame?.captureKind !== 'settled') {
    errors.push(`${prefix}: NOANIM key-frame did not capture immediate settlement`);
  }
  const diagnostics = report.final?.backendDiagnostics || {};
  const timeline = diagnostics.timeline || {};
  const playback = diagnostics.playback || {};
  const pool = diagnostics.pool || {};
  const scene = diagnostics.scene || {};
  if (diagnostics.tickerRunning === true
    || timeline.tickerRunning === true
    || timeline.tickerSubscribed === true
    || Number(timeline.activeRunCount || 0) !== 0) {
    errors.push(`${prefix}: private ticker remained active after settlement`);
  }
  if (Number(diagnostics.application?.tickerListenerCount || 0) !== 0) {
    errors.push(`${prefix}: private ticker listener remained subscribed after settlement`);
  }
  if (report.pixiEvidence !== 'immediate'
    && !(report.pixiEvidence === 'topology-reveal' && report.mode === 'noanim')
    && Number(timeline.startedRunCount || 0)
      <= Number(report.started?.initialBackendDiagnostics?.timeline?.startedRunCount || 0)) {
    errors.push(`${prefix}: effect did not traverse the Pixi timeline`);
  }
  if (Number(playback.inFlightEffectCount || 0) !== 0
    || Number(playback.inFlightTopologyRevealCount || 0) !== 0
    || Number(playback.projectedStoneCount || 0) !== 0
    || Number(playback.retainedFinalGhostCount || 0) !== 0
    || playback.activeScopeKey != null) {
    errors.push(`${prefix}: playback projection remained active after settlement`);
  }
  if (Number(pool.activePlaybackGhostCount || 0) !== 0
    || Number(pool.activePlaybackHighlightLeaseCount || 0) !== 0
    || Number(pool.renderedPlaybackHighlightCount || 0) !== 0
    || Number(pool.activePlaybackEffectCount ?? scene.activePlaybackEffectCount ?? 0) !== 0
    || Number(scene.activeTopologyRevealCount || 0) !== 0) {
    errors.push(`${prefix}: playback object-pool lease remained active after settlement`);
  }
  if (Number(pool.pooledPlaybackGhostCount || 0) > 2
    || Number(pool.pooledPlaybackHighlightCount || 0) > 1
    || Number(pool.pooledPlaybackEffectCount ?? scene.pooledPlaybackEffectCount ?? 0) > 4) {
    errors.push(`${prefix}: playback object pool exceeded the scenario-matrix bound`);
  }
  if (Number(diagnostics.domCellCount || 0) !== 0
    || Number(diagnostics.canvasCount || 0) !== 1) {
    errors.push(`${prefix}: Pixi/DOM exclusive render surface contract drifted`);
  }
}

function evaluatePixiPlaybackBrowserReport(result: any): { ok: boolean; errors: string[] } {
  const reports = Array.isArray(result?.reports) ? result.reports : [];
  const selectedScenarioNames = Array.isArray(result?.scenarioNames) && result.scenarioNames.length
    ? result.scenarioNames.map((name: unknown) => String(name))
    : PLAYBACK_SCENARIOS.map((scenario) => scenario.name);
  const errors: string[] = [];
  for (const report of reports) {
    if (report.failure) {
      errors.push(`${report.lane}/${report.renderer}/${report.mode}: ${report.failure.message || report.failure}`);
      continue;
    }
    for (const error of report.smokeEvaluation?.errors || []) {
      errors.push(`${report.lane}/${report.renderer}/${report.mode}: ${error}`);
    }
    const names = (report.scenarios || []).map((scenario: any) => scenario.scenario);
    const expectedNames = scenariosForMode(report.mode, selectedScenarioNames).map((scenario) => scenario.name);
    if (stableJson(names) !== stableJson(expectedNames)) {
      errors.push(`${report.lane}/${report.renderer}/${report.mode}: playback scenario-matrix coverage is incomplete`);
    }
    for (const scenario of report.scenarios || []) evaluateScenario({ ...scenario, ...report }, errors);
  }

  const lanes = Array.from(new Set(reports.map((report: any) => report.lane)));
  const modes = Array.from(new Set(reports.map((report: any) => report.mode)));
  for (const lane of lanes) {
    for (const mode of modes) {
      const dom = reports.find((report: any) => report.lane === lane && report.mode === mode && report.renderer === 'dom');
      const pixi = reports.find((report: any) => report.lane === lane && report.mode === mode && report.renderer === 'pixi');
      if (!dom || !pixi || dom.failure || pixi.failure) continue;
      for (const definition of scenariosForMode(mode as PlaybackMode, selectedScenarioNames)) {
        const domScenario = dom.scenarios.find((scenario: any) => scenario.scenario === definition.name);
        const pixiScenario = pixi.scenarios.find((scenario: any) => scenario.scenario === definition.name);
        if (!domScenario || !pixiScenario) continue;
        if (domScenario.inputDigest !== pixiScenario.inputDigest
          || buildPlaybackParityDigest(domScenario) !== buildPlaybackParityDigest(pixiScenario)) {
          errors.push(`${lane}/${mode}/${definition.name}: DOM/Pixi event, sound, or final-model digest drifted`);
        }
        if (stableJson(renderedCellSemantics(domScenario.final?.renderedCells))
          !== stableJson(renderedCellSemantics(pixiScenario.final?.renderedCells))) {
          errors.push(`${lane}/${mode}/${definition.name}: DOM/Pixi final rendered state drifted`);
        }
        if (domScenario.finalVisualSemanticDigest !== pixiScenario.finalVisualSemanticDigest) {
          errors.push(`${lane}/${mode}/${definition.name}: DOM/Pixi final visual semantic digest drifted`);
        }
      }
    }
  }

  for (const mode of modes) {
    for (const renderer of ['dom', 'pixi'] as const) {
      const laneReports = reports.filter((report: any) => (
        report.renderer === renderer && report.mode === mode && !report.failure
      ));
      if (laneReports.length < 2) continue;
      for (const definition of scenariosForMode(mode as PlaybackMode, selectedScenarioNames)) {
        const scenarioReports = laneReports.map((report: any) => (
          report.scenarios.find((scenario: any) => scenario.scenario === definition.name)
        )).filter(Boolean);
        if (scenarioReports.length < 2) continue;
        const digests = new Set(scenarioReports.map((scenario: any) => scenario.parityDigest));
        if (digests.size !== 1) {
          errors.push(`${mode}/${definition.name}: classic/Vite ${renderer} parity drifted`);
        }
        const visualDigests = new Set(scenarioReports.map((scenario: any) => scenario.finalVisualDigest));
        if (visualDigests.size !== 1) {
          errors.push(`${mode}/${definition.name}: classic/Vite ${renderer} final visual digest drifted`);
        }
      }
    }
  }

  // NOANIM removes only presentation time. It must retain the exact phase,
  // hybrid/global, sound, model, visual, and settled-state meaning of normal.
  for (const lane of lanes) {
    for (const renderer of ['dom', 'pixi'] as const) {
      const normal = reports.find((report: any) => (
        report.lane === lane && report.renderer === renderer && report.mode === 'normal' && !report.failure
      ));
      const noanim = reports.find((report: any) => (
        report.lane === lane && report.renderer === renderer && report.mode === 'noanim' && !report.failure
      ));
      if (!normal || !noanim) continue;
      for (const definition of PLAYBACK_SCENARIOS.filter((scenario) => (
        selectedScenarioNames.includes(scenario.name)
        &&
        (!scenario.modes || scenario.modes.includes('normal'))
        && (!scenario.modes || scenario.modes.includes('noanim'))
      ))) {
        const normalScenario = normal.scenarios.find((scenario: any) => scenario.scenario === definition.name);
        const noanimScenario = noanim.scenarios.find((scenario: any) => scenario.scenario === definition.name);
        if (!normalScenario || !noanimScenario) continue;
        if (normalScenario.inputDigest !== noanimScenario.inputDigest
          || normalScenario.parityDigest !== noanimScenario.parityDigest) {
          errors.push(`${lane}/${renderer}/${definition.name}: normal/NOANIM semantic digest drifted`);
        }
        if (normalScenario.finalVisualSemanticDigest !== noanimScenario.finalVisualSemanticDigest) {
          errors.push(`${lane}/${renderer}/${definition.name}: normal/NOANIM final visual semantic digest drifted`);
        }
        if (stableJson(renderedCellSemantics(normalScenario.final?.renderedCells))
          !== stableJson(renderedCellSemantics(noanimScenario.final?.renderedCells))) {
          errors.push(`${lane}/${renderer}/${definition.name}: normal/NOANIM final rendered state drifted`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

async function runPixiPlaybackBrowserCheck(options: PlaybackBrowserCheckOptions = {}): Promise<any> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const lanes = Array.from(new Set(options.lanes || ['classic', 'vite'])) as BrowserLane[];
  const modes = Array.from(new Set(options.modes || PLAYBACK_MODES)) as PlaybackMode[];
  const scenarioNames = Array.from(new Set(
    options.scenarioNames && options.scenarioNames.length
      ? options.scenarioNames.map((name) => String(name))
      : PLAYBACK_SCENARIOS.map((scenario) => scenario.name)
  ));
  const knownScenarioNames = new Set(PLAYBACK_SCENARIOS.map((scenario) => scenario.name));
  const unknownScenario = scenarioNames.find((name) => !knownScenarioNames.has(name));
  if (unknownScenario) throw new Error(`Unsupported playback scenario: ${unknownScenario}`);
  const artifactRoot = path.resolve(rootDir, options.artifactDir || DEFAULT_ARTIFACT_DIR);
  const reports: any[] = [];
  for (const lane of lanes) {
    for (const mode of modes) {
      for (const renderer of ['dom', 'pixi'] as const) {
        if (options.log !== false) console.log(`[pixijs-board-playback-check] ${lane}/${renderer}/${mode}`);
        try {
          reports.push(await captureRendererLane(
            rootDir,
            lane,
            renderer,
            mode,
            scenarioNames,
            artifactRoot,
            options.writeArtifacts !== false
          ));
        } catch (error) {
          reports.push({ lane, renderer, mode, failure: serializeError(error), scenarios: [] });
        }
      }
    }
  }
  const draft = {
    schemaVersion: 'pixijs_board_playback_browser_check.v2',
    scenarioNames,
    reports
  };
  const evaluation = evaluatePixiPlaybackBrowserReport(draft);
  const result = { ...draft, evaluation, ok: evaluation.ok };
  if (options.writeArtifacts !== false) {
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.writeFileSync(path.join(artifactRoot, 'report.json'), `${JSON.stringify(result, null, 2)}\n`);
  }
  if (options.log !== false) {
    console.log(JSON.stringify({
      schemaVersion: result.schemaVersion,
      ok: result.ok,
      reportCount: reports.length,
      scenarioCount: reports.reduce((sum, report) => sum + (report.scenarios?.length || 0), 0),
      errors: evaluation.errors
    }, null, 2));
  }
  if (!result.ok) {
    const error = new Error(evaluation.errors.join('; ')) as Error & { report?: any };
    error.name = 'PixiPlaybackBrowserCheckError';
    error.report = result;
    throw error;
  }
  return result;
}

function parseCliOptions(argv: readonly string[]): PlaybackBrowserCheckOptions {
  const classicOnly = argv.includes('--classic-only');
  const viteOnly = argv.includes('--vite-only');
  if (classicOnly && viteOnly) throw new Error('--classic-only and --vite-only are mutually exclusive');
  const modeArg = argv.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg ? modeArg.slice('--mode='.length) as PlaybackMode : null;
  if (mode && !PLAYBACK_MODES.includes(mode)) throw new Error(`Unsupported playback mode: ${mode}`);
  const scenarioNames = argv
    .filter((arg) => arg.startsWith('--scenario='))
    .flatMap((arg) => arg.slice('--scenario='.length).split(','))
    .map((name) => name.trim())
    .filter(Boolean);
  const knownScenarioNames = new Set(PLAYBACK_SCENARIOS.map((scenario) => scenario.name));
  const unknownScenario = scenarioNames.find((name) => !knownScenarioNames.has(name));
  if (unknownScenario) throw new Error(`Unsupported playback scenario: ${unknownScenario}`);
  return {
    lanes: classicOnly ? ['classic'] : (viteOnly ? ['vite'] : ['classic', 'vite']),
    modes: mode ? [mode] : PLAYBACK_MODES,
    ...(scenarioNames.length ? { scenarioNames: Array.from(new Set(scenarioNames)) } : {}),
    writeArtifacts: !argv.includes('--no-artifacts')
  };
}

if (require.main === module) {
  let options: PlaybackBrowserCheckOptions;
  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (error) {
    console.error(`[pixijs-board-playback-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  runPixiPlaybackBrowserCheck(options).then(() => {
    console.log('[pixijs-board-playback-check] success');
  }).catch((error) => {
    console.error(`[pixijs-board-playback-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  PLAYBACK_MODES,
  PHASE7_PARITY_MODES,
  PLAYBACK_BOARD_SIZE,
  PLAYBACK_SCENARIOS,
  buildFinalVisualSemanticDigest,
  buildPlaybackParityDigest,
  canonicalFinalModelDigest,
  createBrowserScenarioPayload,
  expectedBoardEventTypes,
  expectedDispatchLaunchOrder,
  expectedFinalRenderedCells,
  expectedPhaseEventTypes,
  renderedCellSemantics,
  scenariosForMode,
  evaluatePixiPlaybackBrowserReport,
  parseCliOptions,
  publicEntryPath,
  runPixiPlaybackBrowserCheck
};
