import * as PresentationEventIndex from '../game/turn/pipeline-ui/presentation-event-index.js';
import * as TurnPipelineUIAdapter from '../game/turn/pipeline_ui_adapter.js';
import * as StateHash from '../shared/state-hash.js';
import {
  createNetworkSpecialStonePerformanceFixture,
  runHeadlessFixtureTurnStart
} from './helpers/network-special-stone-performance-fixtures';

describe('turn presentation event index', () => {
  test('preserves source order, first/last semantics, and event identity', () => {
    const first = { type: 'CHANGE', row: 2, col: 3, actionId: 'a-1', effectBlockId: 'block-1', meta: { special: 'REGEN' } };
    const middle = { type: 'DESTROY', row: 6, col: 6, actionId: 'a-2', meta: { special: 'GHOST' } };
    const last = {
      type: 'CHANGE',
      row: 4,
      col: 5,
      actionId: 'a-1',
      meta: { special: 'LIVING_WILL', revivedFromRow: 2, revivedFromCol: 3, effectBlockId: 'block-1' }
    };
    const events = [first, middle, last];
    const visits: Array<[any, number]> = [];
    const counters: Record<string, number> = {};

    const index = PresentationEventIndex.createPresentationEventIndex(events, {
      perfCounters: counters,
      onEventVisited: (event, eventIndex) => visits.push([event, eventIndex])
    });

    expect(index.events).toBe(events);
    expect(index.eventsOfType('CHANGE')).toEqual([first, last]);
    expect(index.eventsAtCell(2, 3)).toEqual([first]);
    expect(index.eventsAtCell(2, 3, true)).toEqual([first, last]);
    expect(index.eventsAtCell(0, 0, true)).toEqual([]);
    expect(index.eventsForAction('a-1')).toEqual([first, last]);
    expect(index.eventsForEffectBlock('block-1')).toEqual([first, last]);
    expect(index.findFirst({ type: 'CHANGE' })).toBe(first);
    expect(index.findLast({ type: 'CHANGE' })).toBe(last);
    expect(index.findFirst({ row: 2, col: 3, includeSourceCell: true, predicate: event => event !== first })).toBe(last);
    expect(visits).toEqual([[first, 0], [middle, 1], [last, 2]]);
    expect(counters).toEqual({
      presentationEventIndexBuilds: 1,
      presentationEventIndexVisits: 3
    });
  });

  test('matches legacy linear first/last lookup across type, cell, action, and predicate queries', () => {
    const events = [
      { type: 'STATUS_APPLIED', row: 1, col: 2, actionId: 'x', effectBlockId: 'b-1', meta: { special: 'REGEN' } },
      { type: 'CHANGE', row: 3, col: 4, actionId: 'y', reason: 'regen_triggered' },
      { type: 'STATUS_APPLIED', row: 1, col: 2, actionId: 'x', meta: { special: 'GHOST', effectBlockId: 'b-1' } },
      { type: 'SPAWN', row: 5, col: 6, actionId: 'z', meta: { revivedFromRow: 1, revivedFromCol: 2 } }
    ];
    const index = PresentationEventIndex.createPresentationEventIndex(events);
    const queries = [
      { type: 'STATUS_APPLIED' },
      { row: 1, col: 2 },
      { actionId: 'x' },
      { effectBlockId: 'b-1' },
      { type: 'STATUS_APPLIED', row: 1, col: 2, predicate: event => event.meta.special === 'GHOST' },
      { row: 1, col: 2, includeSourceCell: true, predicate: event => event.type === 'SPAWN' },
      { type: 'MISSING' }
    ];

    const matches = (event: any, query: any) => {
      if (query.type !== undefined && String(event && event.type) !== String(query.type)) return false;
      if (query.actionId !== undefined && String(event && (event.actionId ?? event.meta?.actionId)) !== String(query.actionId)) return false;
      if (query.effectBlockId !== undefined && String(event && (event.effectBlockId ?? event.meta?.effectBlockId)) !== String(query.effectBlockId)) return false;
      if (query.row !== undefined && query.col !== undefined) {
        const direct = Number(event && event.row) === Number(query.row) && Number(event && event.col) === Number(query.col);
        const source = query.includeSourceCell === true &&
          Number(event && event.meta?.revivedFromRow) === Number(query.row) &&
          Number(event && event.meta?.revivedFromCol) === Number(query.col);
        if (!direct && !source) return false;
      }
      return typeof query.predicate !== 'function' || query.predicate(event) === true;
    };

    for (const query of queries) {
      expect(index.findFirst(query)).toBe(events.find(event => matches(event, query)) || null);
      expect(index.findLast(query)).toBe([...events].reverse().find(event => matches(event, query)) || null);
    }
  });

  test('builds one operation-local index and preserves the late-special playback digest', () => {
    const fixture = createNetworkSpecialStonePerformanceFixture('late-special-20');
    const turn = runHeadlessFixtureTurnStart(fixture);
    const presentationEvents = [
      { type: 'SPAWN', row: 2, col: 2, ownerAfter: 'black', stoneId: 's-1', actionId: 'action-1', meta: {} },
      { type: 'STATUS_APPLIED', row: 2, col: 2, actionId: 'action-1', meta: { special: 'REGEN' } },
      { type: 'CHANGE', row: 3, col: 3, actionId: 'action-2', reason: 'regen_triggered', meta: { special: 'REGEN' } },
      { type: 'DESTROY', row: 4, col: 4, actionId: 'action-3', meta: { livingWillTriggered: true, special: 'LIVING_WILL' } },
      { type: 'CHANGE', row: 5, col: 5, actionId: 'action-3', cause: 'LIVING_WILL', reason: 'living_will_restored', meta: { revivedFromRow: 4, revivedFromCol: 4, special: 'LIVING_WILL' } }
    ];
    const counters: Record<string, number> = {};

    const playback = TurnPipelineUIAdapter.mapToPlaybackEvents(
      presentationEvents,
      turn.snapshot.cardState,
      turn.snapshot.gameState,
      { perfCounters: counters }
    );
    const controlPlayback = TurnPipelineUIAdapter.mapToPlaybackEvents(
      presentationEvents,
      turn.snapshot.cardState,
      turn.snapshot.gameState
    );

    expect(counters.presentationEventIndexBuilds).toBe(1);
    expect(counters.presentationEventIndexVisits).toBe(presentationEvents.length);
    expect(StateHash.computeStableHash(playback)).toBe(StateHash.computeStableHash(controlPlayback));
    expect(turn.comparison.playbackDigest).toBe('fnv1a32:8b758173');
  });
});
