import * as helpers from '../shared/playback-event-helpers.js';
import * as adapter from '../game/turn/pipeline_ui_adapter.js';

describe('PlaybackEventHelpers', () => {
  test('maps raw place events into canonical place hand playback events', () => {
    const playbackEvents = helpers.mapRawPlaceEventsToPlayback([
      { type: 'place', row: 2, col: 3, player: 'white', actionId: 'place-1', turnIndex: 9 }
    ], {
      fallbackPlayerKey: 'black',
      fallbackTurnIndex: 7
    });

    expect(playbackEvents).toEqual([
      {
        type: 'place_hand_animation',
        phase: 0,
        rawType: 'place',
        actionId: 'place-1',
        turnIndex: 9,
        targets: [{ r: 2, col: 3, player: 'white', owner: 'white' }]
      }
    ]);
  });

  test('local adapter place playback stays aligned with shared helper contract', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    const rawEvents = [{ type: 'place', row: 2, col: 3, player: 'white', actionId: 'place-1', turnIndex: 9 }];
    const turnPipeline = {
      applyTurnSafe: jest.fn(() => ({
        ok: true,
        cardState: { markers: [], turnIndex: 9 },
        gameState: { board },
        events: rawEvents,
        presentationEvents: []
      }))
    };

    const expected = helpers.mapRawPlaceEventsToPlayback(rawEvents, {
      fallbackPlayerKey: 'white',
      fallbackTurnIndex: 9
    });
    const out = adapter.runTurnWithAdapter(
      { markers: [], turnIndex: 9 },
      { board },
      'white',
      { type: 'place', row: 2, col: 3 },
      turnPipeline
    );

    expect(out.ok).toBe(true);
    expect(out.playbackEvents).toEqual(expected);
  });

  test('appends independent playback bundles after the base phase range', () => {
    const out = helpers.appendPlaybackEventsAfter(
      [
        { type: 'flip', phase: 1, targets: [{ r: 4, col: 4 }] },
        { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'card_use_button' }] }
      ],
      [
        { type: 'flip', phase: 1, targets: [{ r: 3, col: 3 }] },
        { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'card_effect_flip' }] },
        { type: 'draw', phase: 2, targets: [{ player: 'white' }] }
      ]
    );

    expect(out).toEqual([
      { type: 'flip', phase: 1, targets: [{ r: 4, col: 4 }] },
      { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'card_use_button' }] },
      { type: 'flip', phase: 3, targets: [{ r: 3, col: 3 }] },
      { type: 'sound_effect', phase: 3, targets: [{ soundKey: 'card_effect_flip' }] },
      { type: 'draw', phase: 4, targets: [{ player: 'white' }] }
    ]);
  });

  test('appends turn-start draw playback from hand growth', () => {
    const out = helpers.appendTurnStartDrawPlaybackEvents({
      playbackAssembly: {
        playbackEvents: [{ type: 'status_applied', phase: 2, targets: [{ r: 1, col: 1 }] }],
        diagnostics: { warnings: [] }
      },
      snapshot: {
        cardState: { hands: { black: ['old-card', 'new-card'] } },
        gameState: { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
      },
      handState: { playerKey: 'black', hand: ['old-card'] },
      adapter: {
        mapToPlaybackEvents: jest.fn(() => [
          { type: 'hand_add', phase: 1, targets: [{ player: 'black', cardId: 'new-card' }] }
        ])
      },
      normalizePlayerKey: (value) => String(value || '')
    });

    expect(out.playbackEvents).toEqual([
      { type: 'status_applied', phase: 2, targets: [{ r: 1, col: 1 }] },
      { type: 'hand_add', phase: 3, targets: [{ player: 'black', cardId: 'new-card' }] }
    ]);
    expect(out.diagnostics).toEqual({ warnings: [] });
  });

  test('collects action playback from pipeline presentation events when present', () => {
    const out = helpers.collectActionPlaybackEvents({
      result: {
        events: [{ type: 'place', row: 2, col: 3, player: 'black', actionId: 'place-1', turnIndex: 4 }],
        presentationEvents: [{ type: 'CARD_USED', cardId: 'treasure', player: 'black' }],
        cardState: { presentationEvents: [{ type: 'STALE' }] }
      },
      snapshot: { cardState: { turnIndex: 4 }, gameState: { board: [] } },
      playerKey: 'black',
      fallbackPlayerKey: 'black',
      adapter: {
        mapToPlaybackEvents: jest.fn((events) => events.map((event, index) => ({
          type: 'mapped',
          phase: index + 1,
          targets: [event]
        })))
      }
    });

    expect(out.presentationEvents).toEqual([
      { type: 'CARD_USED', cardId: 'treasure', player: 'black' }
    ]);
    expect(out.playbackEvents).toEqual([
      {
        type: 'place_hand_animation',
        phase: 0,
        rawType: 'place',
        actionId: 'place-1',
        turnIndex: 4,
        targets: [{ r: 2, col: 3, player: 'black', owner: 'black' }]
      },
      {
        type: 'mapped',
        phase: 1,
        targets: [{ type: 'CARD_USED', cardId: 'treasure', player: 'black' }]
      }
    ]);
  });

  test('collects action playback from raw events when no presentation events exist', () => {
    const out = helpers.collectActionPlaybackEvents({
      result: {
        events: [{ type: 'place', row: 4, col: 5, player: 'white', actionId: 'place-2', turnIndex: 8 }],
        cardState: { presentationEvents: [] }
      },
      snapshot: { cardState: { turnIndex: 8 }, gameState: { board: [] } },
      playerKey: 'white',
      fallbackPlayerKey: 'white'
    });

    expect(out.presentationEvents).toEqual([]);
    expect(out.playbackPresentationEvents).toEqual([
      { type: 'place', row: 4, col: 5, player: 'white', actionId: 'place-2', turnIndex: 8 }
    ]);
    expect(out.playbackEvents).toEqual([
      {
        type: 'place_hand_animation',
        phase: 0,
        rawType: 'place',
        actionId: 'place-2',
        turnIndex: 8,
        targets: [{ r: 4, col: 5, player: 'white', owner: 'white' }]
      },
      { type: 'place', row: 4, col: 5, player: 'white', actionId: 'place-2', turnIndex: 8 }
    ]);
  });

  test('assembles theory incarnation roulette playback from raw spawn events', () => {
    const out = helpers.assemblePlaybackEvents({
      rawEvents: [{
        type: 'SPAWN',
        row: 2,
        col: 3,
        ownerAfter: 'black',
        stoneId: 'theory-spawn-1',
        meta: {
          special: 'GHOST',
          owner: 'black',
          theorySpawnRoulette: {
            durationMs: 2000,
            materializeMs: 700,
            candidateCells: [{ row: 2, col: 3 }, { row: 4, col: 5 }],
            selectedCell: { row: 2, col: 3 },
            spawnedMarkerType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST'
          }
        }
      }],
      presentationEvents: [],
      snapshot: {
        cardState: { markers: [], turnIndex: 8 },
        gameState: { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
      },
      fallbackPlayerKey: 'black',
      adapter,
      normalizePlayerKey: (value) => String(value || '')
    });

    expect(out.playbackEvents).toEqual([
      expect.objectContaining({
        type: 'theory_incarnation_spawn_roulette',
        durationMs: 2000,
        materializeMs: 700,
        targets: [
          expect.objectContaining({
            r: 2,
            col: 3,
            spawnedMarkerType: 'GHOST',
            candidateCells: [{ row: 2, col: 3 }, { row: 4, col: 5 }],
            selectedCell: { row: 2, col: 3 }
          })
        ]
      })
    ]);
    expect(out.diagnostics.warnings).toEqual([]);
  });

  test('recovers teleport move playback from raw selection event when presentation move is missing', () => {
    const out = helpers.collectActionPlaybackEvents({
      result: {
        events: [{
          type: 'teleport_selected',
          player: 'black',
          cardType: 'TELEPORT_WILL',
          applied: true,
          from: { row: 3, col: 4 },
          to: { row: 3, col: 5 }
        }],
        presentationEvents: [],
        cardState: { presentationEvents: [] }
      },
      snapshot: { cardState: { turnIndex: 1 }, gameState: { board: [] } },
      playerKey: 'black',
      fallbackPlayerKey: 'black',
      adapter: {
        mapToPlaybackEvents: jest.fn(() => []),
        appendSoundEffectPlaybackEvents: jest.fn((events) => events)
      }
    });

    expect(out.playbackEvents).toEqual([
      expect.objectContaining({
        type: 'move',
        rawType: 'teleport_selected',
        targets: [expect.objectContaining({
          from: { r: 3, col: 4 },
          to: { r: 3, col: 5 },
          cause: 'TELEPORT_WILL',
          reason: 'teleport_move',
          meta: { moveIntent: 'teleport_move' }
        })],
        meta: { moveIntent: 'teleport_move' }
      })
    ]);
  });
});
