import * as MatchAuthority from '../utils/match-authority.js';

function createRoom() {
  return {
    roomId: 'ARTIFACTS',
    stateVersion: 12,
    updatedAt: 123456,
    snapshot: {
      stateVersion: 12,
      updatedAt: 123456,
      gameState: { currentPlayer: 1, turnNumber: 19 },
      cardState: {
        hands: {
          black: ['black-visible'],
          white: ['white-hidden']
        },
        markers: [{
          id: 1,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'TRAP', hidden: true, armedForPlayer: 'white' }
        }],
        specialStones: [{
          row: 2,
          col: 2,
          owner: 'black',
          type: 'TRAP',
          hidden: true
        }],
        presentationEvents: [{ type: 'STATUS_APPLIED', row: 2, col: 2 }],
        _presentationEventsPersist: [{ type: 'STATUS_APPLIED', row: 2, col: 2 }]
      }
    }
  } as any;
}

describe('match authority publish viewer artifacts', () => {
  test('builds canonical hash and each public viewer projection exactly once', () => {
    const room = createRoom();
    const counters: Record<string, number> = {};
    const projected: Array<[string, any]> = [];
    const roomKeysBefore = Object.keys(room).sort();

    const artifacts = MatchAuthority.buildPublishViewerArtifacts(room, {
      perfCounters: counters,
      onViewerProjected: (viewerKey, snapshot) => projected.push([viewerKey, snapshot])
    });

    expect(artifacts.canonicalHash).toBe(MatchAuthority.computeAuthoritativeStateHash(room.snapshot));
    expect(artifacts.projectedSnapshots.black).toEqual(
      MatchAuthority.buildPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'black' })
    );
    expect(artifacts.projectedSnapshots.white).toEqual(
      MatchAuthority.buildPublicSnapshotForViewer(room, { role: 'seat', seatKey: 'white' })
    );
    expect(artifacts.projectedSnapshots.spectator).toEqual(
      MatchAuthority.buildPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: '' })
    );
    expect(counters).toEqual({
      viewerProjectionBlack: 1,
      viewerProjectionWhite: 1,
      viewerProjectionSpectator: 1
    });
    expect(projected.map(([viewerKey]) => viewerKey)).toEqual(['black', 'white', 'spectator']);
    expect(projected[0][1]).toBe(artifacts.projectedSnapshots.black);
    expect(projected[1][1]).toBe(artifacts.projectedSnapshots.white);
    expect(projected[2][1]).toBe(artifacts.projectedSnapshots.spectator);
    expect(Object.keys(room).sort()).toEqual(roomKeysBefore);
    expect((room as any).publishViewerArtifacts).toBeUndefined();
  });

  test('preserves hand/trap/spectator redaction and keeps viewer snapshots independently owned', () => {
    const room = createRoom();
    const artifacts = MatchAuthority.buildPublishViewerArtifacts(room);

    expect(artifacts.projectedSnapshots.black.cardState.hands.black).toEqual(['black-visible']);
    expect(artifacts.projectedSnapshots.black.cardState.hands.white[0]).toMatch(/^__hidden_hand__/);
    expect(artifacts.projectedSnapshots.black.cardState.markers).toHaveLength(1);
    expect(artifacts.projectedSnapshots.white.cardState.hands.black[0]).toMatch(/^__hidden_hand__/);
    expect(artifacts.projectedSnapshots.white.cardState.markers).toHaveLength(0);
    expect(artifacts.projectedSnapshots.spectator.cardState.hands).toEqual({
      black: ['black-visible'],
      white: ['white-hidden']
    });
    expect(artifacts.projectedSnapshots.spectator.cardState.markers).toHaveLength(0);
    expect(artifacts.projectedSnapshots.black.cardState.presentationEvents).toEqual([]);
    expect(artifacts.projectedSnapshots.black.cardState._presentationEventsPersist).toEqual([]);

    artifacts.projectedSnapshots.black.cardState.hands.black[0] = 'mutated';
    expect(artifacts.projectedSnapshots.white.cardState.hands.black[0]).not.toBe('mutated');
    expect(room.snapshot.cardState.hands.black).toEqual(['black-visible']);
  });
});
