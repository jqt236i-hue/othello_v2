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
    storage.set('shared_leaderboard_player_id_v1', 'player_alpha_0001');
    storage.set('shared_leaderboard_player_name_v1', 'アルファ');
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
          category: 'shortestTurns',
          turnCount: 37
        }
      ]
    });
  });

  test('submitShortestTurns posts shortestTurns category with turn count', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        updated: true,
        bestTurnCount: 37,
        rank: 1,
        entries: []
      })
    });

    const client = require('../ui/leaderboard-client.js');
    const result = await client.submitShortestTurns(
      { turnCount: 37 },
      { mode: 'cpu', cpuLevel: 6, boardConfig: { rows: 8, cols: 8, standard8x8: true } }
    );

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(requestInit.body)).toMatchObject({
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      category: 'shortestTurns',
      turnCount: 37,
      mode: 'cpu',
      cpuLevel: 6,
      boardConfig: { rows: 8, cols: 8, standard8x8: true }
    });
    expect(result).toMatchObject({
      ok: true,
      updated: true,
      bestTurnCount: 37,
      rank: 1
    });
  });
});
