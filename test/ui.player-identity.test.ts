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

  test('getRecoveryCode reads the stored recovery code without exposing playerToken', () => {
    storage.set('card_reversi_player_identity_v1', JSON.stringify({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    }));

    const client = require('../ui/player-identity.js');

    expect(client.getRecoveryCode()).toBe('CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23');
  });

  test('regenerateRecoveryCode verifies stored identity and stores the new recovery code', async () => {
    storage.set('card_reversi_player_identity_v1', JSON.stringify({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    }));
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
          recoveryCode: 'CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32'
        })
      });

    const client = require('../ui/player-identity.js');
    const identity = await client.regenerateRecoveryCode();

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://card.example/api/player/identity/recovery/regenerate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
      })
    }));
    expect(identity).toEqual({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32'
    });
    expect(JSON.parse(storage.get('card_reversi_player_identity_v1') || '{}').recoveryCode).toBe('CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32');
  });

  function issuedIdentity(n: number) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        playerId: `p_ABCDEFGHIJKLMNOPQRSTUV000${n}`,
        playerToken: `pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12${n}`.slice(0, 46),
        recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
      })
    };
  }

  test('concurrent ensurePlayerIdentity calls share one created identity', async () => {
    let created = 0;
    fetchMock.mockImplementation(async () => {
      created += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return issuedIdentity(created);
    });

    const client = require('../ui/player-identity.js');
    const [first, second] = await Promise.all([client.ensurePlayerIdentity(), client.ensurePlayerIdentity()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(JSON.parse(storage.get('card_reversi_player_identity_v1') || '{}').playerId).toBe(first.playerId);
  });

  test('a failed create releases the shared promise so the next call retries', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ ok: false, reason: 'BOOM' }) })
      .mockResolvedValueOnce(issuedIdentity(1));

    const client = require('../ui/player-identity.js');
    const [a, b] = await Promise.allSettled([client.ensurePlayerIdentity(), client.ensurePlayerIdentity()]);
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('rejected');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const retried = await client.ensurePlayerIdentity();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retried.playerId).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');
  });

  test('concurrent ensure after a rejected stored identity creates only one replacement', async () => {
    storage.set('card_reversi_player_identity_v1', JSON.stringify({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0009',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno19',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    }));
    let creates = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/verify')) {
        return { ok: false, status: 403, json: async () => ({ ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' }) };
      }
      creates += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return issuedIdentity(creates);
    });

    const client = require('../ui/player-identity.js');
    const [first, second] = await Promise.all([client.ensurePlayerIdentity(), client.ensurePlayerIdentity()]);

    expect(creates).toBe(1);
    expect(second.playerId).toBe(first.playerId);
  });
});
