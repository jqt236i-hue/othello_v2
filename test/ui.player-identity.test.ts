describe('browser player identity client', () => {
  let fetchMock: jest.Mock;
  let storage: Map<string, string>;

  beforeEach(() => {
    jest.resetModules();
    storage = new Map();
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    (global as any).localStorage = {
      getItem: jest.fn((key: string) => storage.get(key) || null),
      setItem: jest.fn((key: string, value: string) => void storage.set(key, value)),
      removeItem: jest.fn((key: string) => void storage.delete(key))
    };
    (global as any).location = { protocol: 'https:', origin: 'https://card.example' };
  });

  afterEach(() => {
    delete (global as any).fetch;
    delete (global as any).localStorage;
    delete (global as any).location;
  });

  test('ensurePlayerIdentity creates and stores server-issued credentials', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
        recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
      })
    });

    const client = require('../ui/player-identity.js');
    const identity = await client.ensurePlayerIdentity();

    expect(fetchMock).toHaveBeenCalledWith('https://card.example/api/player/identity/create', expect.objectContaining({
      method: 'POST'
    }));
    expect(identity).toEqual({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    });
    expect(JSON.parse(storage.get('card_reversi_player_identity_v1') || '{}')).toMatchObject(identity);
  });

  test('ensurePlayerIdentity verifies stored credentials before reuse', async () => {
    storage.set('card_reversi_player_identity_v1', JSON.stringify({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    }));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001' })
    });

    const client = require('../ui/player-identity.js');
    const identity = await client.ensurePlayerIdentity({ serverUrl: 'http://127.0.0.1:8787/' });

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8787/api/player/identity/verify', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
      })
    }));
    expect(identity.playerId).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');
  });

  test('ensurePlayerIdentity keeps stored credentials when verification is temporarily unavailable', async () => {
    const storedIdentity = {
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    };
    storage.set('card_reversi_player_identity_v1', JSON.stringify(storedIdentity));
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, reason: 'INTERNAL_ERROR' })
    });

    const client = require('../ui/player-identity.js');

    await expect(client.ensurePlayerIdentity()).rejects.toThrow('PLAYER_IDENTITY_VERIFY_UNAVAILABLE');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((global as any).localStorage.removeItem).not.toHaveBeenCalled();
    expect(JSON.parse(storage.get('card_reversi_player_identity_v1') || '{}')).toEqual(storedIdentity);
  });

  test('recoverPlayerIdentity rotates stored token and recovery code', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno34',
        recoveryCode: 'CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32'
      })
    });

    const client = require('../ui/player-identity.js');
    const identity = await client.recoverPlayerIdentity('cr-abcde-fghjk-mnpqr-stuvw-xyz23');

    expect(fetchMock).toHaveBeenCalledWith('https://card.example/api/player/identity/recover', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23' })
    }));
    expect(client.getPlayerId()).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');
    expect(identity.playerToken).toBe('pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno34');
  });
});
