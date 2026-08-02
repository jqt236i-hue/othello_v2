describe('leaderboard client shortest turns category', () => {
  let fetchMock: jest.Mock;
  let storage: Map<string, string>;

  beforeEach(() => {
    jest.resetModules();
    storage = new Map();
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    (global as any).localStorage = {
      getItem: jest.fn((key: string) => storage.get(key) || null),
      setItem: jest.fn((key: string, value: string) => void storage.set(key, value))
    };
    storage.set('shared_leaderboard_player_name_v1', 'アルファ');
    storage.set('card_reversi_player_profile_v1', JSON.stringify({
      version: 1,
      displayName: 'アルファ',
      avatarStoneType: 'LIGHTNING',
      bio: 'よろしくお願いします',
      updatedAt: 1000
    }));
    storage.set('card_reversi_player_identity_v1', JSON.stringify({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    }));
  });

  afterEach(() => {
    delete (global as any).fetch;
    delete (global as any).localStorage;
  });

  test('fetchLeaderboard sends shortestTurns category and keeps turn count entries', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        updatedAt: 1000,
        entries: [
          {
            rank: 1,
            playerId: 'player_alpha_0001',
            playerName: 'アルファ',
            avatarStoneType: 'GHOST',
            bio: '最短狙い',
            category: 'shortestTurns',
            turnCount: 37,
            mode: 'cpu',
            cpuLevel: 6
          }
        ]
      })
    });

    const client = require('../ui/leaderboard-client.js');
    const result = await client.fetchLeaderboard({ category: 'shortestTurns', mode: 'cpu', cpuLevel: 6, limit: 100 });

    expect(fetchMock).toHaveBeenCalledWith('/api/leaderboard/list?limit=100&mode=cpu&category=shortestTurns&cpuLevel=6', expect.objectContaining({
      method: 'GET'
    }));
    expect(result).toMatchObject({
      ok: true,
      category: 'shortestTurns',
      entries: [
        {
          playerName: 'アルファ',
          avatarStoneType: 'GHOST',
          bio: '最短狙い',
          category: 'shortestTurns',
          turnCount: 37
        }
      ]
    });
  });

  test('fetchLeaderboard requests the read-only legacy record set only when selected', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        era: 'legacy',
        updatedAt: 1000,
        entries: [{
          rank: 1,
          playerId: 'player_legacy_0001',
          playerName: '旧記録',
          bestScore: 8765,
          mode: 'cpu',
          cpuLevel: 6
        }]
      })
    });

    const client = require('../ui/leaderboard-client.js');
    const result = await client.fetchLeaderboard({ category: 'score', mode: 'all', era: 'legacy', limit: 100 });

    expect(fetchMock).toHaveBeenCalledWith('/api/leaderboard/list?limit=100&mode=all&category=score&era=legacy', expect.objectContaining({
      method: 'GET'
    }));
    expect(result).toMatchObject({
      ok: true,
      era: 'legacy',
      entries: [{ playerName: '旧記録', bestScore: 8765 }]
    });
  });

  test('getRatedLeaderboard fetches rated leaderboard from rating endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        updatedAt: 1000,
        entries: [{
          rank: 1,
          playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
          playerName: 'アルファ',
          avatarStoneType: 'LIGHTNING',
          bio: 'よろしくお願いします',
          displayRating: 1662,
          ratedGames: 1,
          wins: 1,
          draws: 0,
          losses: 0
        }]
      })
    });

    const client = require('../ui/leaderboard-client.js');
    const result = await client.getRatedLeaderboard(25);

    expect(fetchMock).toHaveBeenCalledWith('/api/rating/leaderboard?pool=card_ranked_v1&limit=25', expect.objectContaining({
      method: 'GET'
    }));
    expect(result).toMatchObject({
      ok: true,
      category: 'rated',
      entries: [{
        playerName: 'アルファ',
        displayRating: 1662,
        ratedGames: 1,
        wins: 1,
        draws: 0,
        losses: 0
      }]
    });
  });

  test('submitShortestTurns rejects client-authored CPU results without a request', async () => {
    const client = require('../ui/leaderboard-client.js');
    const result = await client.submitShortestTurns(
      { turnCount: 37 },
      { mode: 'cpu', cpuLevel: 6, boardConfig: { rows: 8, cols: 8, standard8x8: true } }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'LEADERBOARD_RESULT_PROOF_REQUIRED' });
  });

  test('submitScore sends only network authority context, not client score fields', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001' })
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, updated: true, bestScore: 8818, rank: 1, entries: [] })
    });

    const client = require('../ui/leaderboard-client.js');
    const result = await client.submitScore(
      { total: 999999, turnCount: 1, version: 999 },
      { mode: 'network', roomId: 'room1234', seatKey: 'black', limit: 10 }
    );

    expect(fetchMock.mock.calls[0][0]).toBe('/api/player/identity/verify');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/leaderboard/submit');
    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload).toMatchObject({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      category: 'score',
      mode: 'network',
      roomId: 'ROOM1234',
      seatKey: 'black'
    });
    expect(payload).not.toHaveProperty('score');
    expect(payload).not.toHaveProperty('turnCount');
    expect(payload).not.toHaveProperty('scoreVersion');
    expect(result).toMatchObject({ ok: true, bestScore: 8818, rank: 1 });
  });

  test('getPlayerName prefers profile display name over stale shared leaderboard name', () => {
    storage.set('shared_leaderboard_player_name_v1', '旧名');
    storage.set('card_reversi_player_profile_v1', JSON.stringify({
      version: 1,
      displayName: '新名',
      avatarStoneType: 'LIGHTNING',
      bio: '',
      updatedAt: 2000
    }));

    const client = require('../ui/leaderboard-client.js');

    expect(client.getPlayerName()).toBe('新名');
  });

  test('setPlayerName also updates profile display name', () => {
    const client = require('../ui/leaderboard-client.js');

    expect(client.setPlayerName('統一名')).toBe('統一名');

    const storedProfile = JSON.parse(storage.get('card_reversi_player_profile_v1') || '{}');
    expect(storedProfile.displayName).toBe('統一名');
    expect(storage.get('shared_leaderboard_player_name_v1')).toBe('統一名');
  });

  test('updatePublicProfile posts verified display name and profile fields', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001'
      })
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001'
      })
    });

    const client = require('../ui/leaderboard-client.js');
    const result = await client.updatePublicProfile();

    expect(fetchMock.mock.calls[0][0]).toBe('/api/player/identity/verify');
    const [, requestInit] = fetchMock.mock.calls[1];
    expect(fetchMock.mock.calls[1][0]).toBe('/api/player/profile');
    expect(JSON.parse(requestInit.body)).toMatchObject({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      playerName: 'アルファ',
      avatarStoneType: 'LIGHTNING',
      bio: 'よろしくお願いします'
    });
    expect(result).toMatchObject({ ok: true });
  });
});
