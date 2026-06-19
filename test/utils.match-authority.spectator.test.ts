const MatchAuthority = require('../utils/match-authority.js');

function createRoom(overrides = {}) {
  return {
    roomId: 'SP1',
    stateVersion: 3,
    updatedAt: 1000,
    seats: { black: true, white: true },
    seatNames: { black: '黒主', white: '白主' },
    seatTokens: { black: 'black-token', white: 'white-token' },
    spectators: {},
    snapshot: {
      stateVersion: 3,
      gameState: { board: [[0]], currentPlayer: 1 },
      cardState: {
        hands: {
          black: ['meteor_will'],
          white: ['guard_will']
        },
        markers: []
      }
    },
    ...overrides
  };
}

describe('match authority spectator helpers', () => {
  test('adds up to four spectators and rejects the fifth', () => {
    const room = createRoom();
    const added = [];
    for (let index = 0; index < 4; index += 1) {
      const result = MatchAuthority.addSpectatorToRoom(room, {
        spectatorName: `観戦${index + 1}`,
        makeSpectatorToken: () => `token-${index + 1}`,
        makeSpectatorId: () => `spec_test000${index + 1}`,
        now: 1000 + index
      });
      expect(result.ok).toBe(true);
      added.push(result.spectatorId);
    }

    expect(Object.keys(room.spectators)).toEqual(added);
    const full = MatchAuthority.addSpectatorToRoom(room, {
      spectatorName: '満員後',
      makeSpectatorToken: () => 'token-5',
      makeSpectatorId: () => 'spec_test0005',
      now: 2000
    });
    expect(full).toEqual({ ok: false, reason: 'SPECTATOR_FULL' });
  });

  test('authenticates seat viewers and spectator viewers separately', () => {
    const room = createRoom({
      spectators: {
        spec_test0001: { token: 'spec-token', name: '観戦1', joinedAt: 1000, lastSeenAt: 1000 }
      }
    });

    expect(MatchAuthority.resolveAuthenticatedViewer(room, {
      seatKey: 'black',
      seatToken: 'black-token'
    })).toEqual({ role: 'seat', seatKey: 'black' });

    expect(MatchAuthority.resolveAuthenticatedViewer(room, {
      viewerRole: 'spectator',
      spectatorId: 'spec_test0001',
      spectatorToken: 'spec-token',
      now: 1500
    })).toEqual({ role: 'spectator', spectatorId: 'spec_test0001' });

    expect(room.spectators.spec_test0001.lastSeenAt).toBe(1500);
  });

  test('spectator projection reveals both hands', () => {
    const room = createRoom();
    const shot = MatchAuthority.buildPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: 'spec_test0001' });
    expect(shot._meta).toEqual(expect.objectContaining({
      authority: 'server',
      projectedForSeat: null,
      viewerRole: 'spectator'
    }));
    expect(shot.cardState.hands.black).toEqual(['meteor_will']);
    expect(shot.cardState.hands.white).toEqual(['guard_will']);
  });

  test('removes a spectator only with the matching token', () => {
    const room = createRoom({
      spectators: {
        spec_test0001: { token: 'spec-token', name: '観戦1', joinedAt: 1000, lastSeenAt: 1000 }
      }
    });

    expect(MatchAuthority.removeSpectatorFromRoom(room, {
      spectatorId: 'spec_test0001',
      spectatorToken: 'wrong-token',
      now: 1500
    })).toEqual({ ok: false, reason: 'SPECTATOR_TOKEN_MISMATCH' });

    const result = MatchAuthority.removeSpectatorFromRoom(room, {
      spectatorId: 'spec_test0001',
      spectatorToken: 'spec-token',
      now: 1600
    });

    expect(result).toEqual({
      ok: true,
      spectatorId: 'spec_test0001',
      spectatorName: '観戦1',
      spectatorCount: 0,
      maxSpectators: 4
    });
    expect(room.spectators).toEqual({});
    expect(room.updatedAt).toBe(1600);
  });

  test('presence payload preserves spectator identity for join and leave notices', () => {
    const room = createRoom();

    const payload = MatchAuthority.buildPresencePayloadFromRoom(room, {
      type: 'spectator_join',
      spectatorId: 'spec_notice001',
      spectatorName: '観戦通知',
      serverTime: 2500
    });

    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      type: 'spectator_join',
      spectatorId: 'spec_notice001',
      spectatorName: '観戦通知'
    }));
  });
});
