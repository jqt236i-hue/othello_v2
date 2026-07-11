import {
  createAllNetworkSpecialStonePerformanceFixtures,
  createAuthorityRoomFromFixture,
  createNetworkSpecialStonePerformanceFixture,
  runHeadlessFixtureTurnStart,
  serializePerformanceComparison
} from './helpers/network-special-stone-performance-fixtures';

const MatchAuthority = require('../utils/match-authority.js');

describe('network special-stone late-game performance fixtures', () => {
  test('provides the three required canonical board profiles', () => {
    const fixtures = createAllNetworkSpecialStonePerformanceFixtures();
    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      'baseline-light',
      'late-dense',
      'late-special-20'
    ]);
    expect(fixtures.map((fixture) => fixture.summary)).toEqual([
      expect.objectContaining({ rows: 8, cols: 8, occupied: 4, markerCount: 2 }),
      expect.objectContaining({ rows: 8, cols: 8, occupied: 52, markerCount: 4 }),
      expect.objectContaining({ rows: 8, cols: 8, occupied: 52, markerCount: 20 })
    ]);
  });

  test.each(['baseline-light', 'late-dense', 'late-special-20'] as const)(
    '%s reproduces canonical state, ordered events, playback, and PRNG state',
    (id) => {
      const first = runHeadlessFixtureTurnStart(createNetworkSpecialStonePerformanceFixture(id));
      const second = runHeadlessFixtureTurnStart(createNetworkSpecialStonePerformanceFixture(id));

      expect(second.comparison.canonicalHash).toBe(first.comparison.canonicalHash);
      expect(second.comparison.eventDigest).toBe(first.comparison.eventDigest);
      expect(second.comparison.playbackDigest).toBe(first.comparison.playbackDigest);
      expect(second.prngState).toEqual(first.prngState);
      expect(second.events).toEqual(first.events);
      expect(second.playbackEvents).toEqual(first.playbackEvents);
      expect(second.comparison.serialized).toBe(first.comparison.serialized);
    }
  );

  test('late-special-20 covers movement, destruction, timers, protection, and duration state', () => {
    const fixture = createNetworkSpecialStonePerformanceFixture('late-special-20');
    const markerTypes = fixture.snapshot.cardState.markers.map((marker: any) => marker.data.type);
    const result = runHeadlessFixtureTurnStart(fixture);
    const eventTypes = result.events.map((event: any) => event.type);

    expect(markerTypes).toEqual(expect.arrayContaining([
      'HYPERACTIVE',
      'DESTROY_DRAGON',
      'TIME_BOMB',
      'PROTECTED',
      'GHOST',
      'LIVING_WILL'
    ]));
    expect(eventTypes).toEqual(expect.arrayContaining([
      'hyperactive_moved_start',
      'destroy_dragon_destroyed_start',
      'bombs_exploded'
    ]));
    expect(result.prngState.calls).toBeGreaterThan(fixture.snapshot.cardState.prngState.calls);
  });

  test('comparison serializer removes timestamps only and preserves array order', () => {
    const first = serializePerformanceComparison({
      updatedAt: 1,
      serverTime: 2,
      events: [{ id: 'b' }, { id: 'a' }],
      stateVersion: 7
    });
    const second = serializePerformanceComparison({
      updatedAt: 99,
      serverTime: 100,
      events: [{ id: 'b' }, { id: 'a' }],
      stateVersion: 7
    });
    const reordered = serializePerformanceComparison({
      updatedAt: 1,
      serverTime: 2,
      events: [{ id: 'a' }, { id: 'b' }],
      stateVersion: 7
    });

    expect(second).toBe(first);
    expect(reordered).not.toBe(first);
    expect(first).toContain('stateVersion');
  });

  test('authority room shape is consumable by the shared Worker/local projection path', () => {
    const fixture = createNetworkSpecialStonePerformanceFixture('late-special-20');
    const room = createAuthorityRoomFromFixture(fixture);
    const black = MatchAuthority.buildPublicSnapshot(room, 'black');
    const white = MatchAuthority.buildPublicSnapshot(room, 'white');
    const spectator = MatchAuthority.buildPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: 'perf' });

    expect(black.gameState.board).toEqual(fixture.snapshot.gameState.board);
    expect(white.gameState.board).toEqual(fixture.snapshot.gameState.board);
    expect(spectator.gameState.board).toEqual(fixture.snapshot.gameState.board);
    expect(room.snapshot).toEqual(fixture.snapshot);
    expect(room.authoritativeStateHash).toBe(MatchAuthority.computeAuthoritativeStateHash(room.snapshot));
  });
});
