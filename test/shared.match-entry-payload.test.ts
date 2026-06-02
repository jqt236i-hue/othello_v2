describe('MatchEntryPayload', () => {
  let MatchEntryPayload: any;

  beforeEach(() => {
    jest.resetModules();
    MatchEntryPayload = require('../shared/match-entry-payload');
  });

  test('create payload normalizes player, clones board config, and reports invalid deck fallback', () => {
    const boardConfig = { rows: 7, cols: 7, nested: { enabled: true } };
    const cloneData = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    const result = MatchEntryPayload.buildCreateRoomPayload(
      {
        playerName: '  テスト  ',
        deckCode: 'BROKEN_DECK',
        roomBoardConfig: boardConfig,
        networkDebugEnabled: true
      },
      {
        normalizePlayerName: (value: any) => String(value || '').trim(),
        sanitizeDeckCode: () => ({ value: '', invalid: true }),
        cloneData,
        readSelectedHandSkinId: () => 'blue'
      }
    );

    expect(result.ok).toBe(true);
    expect(result.playerName).toBe('テスト');
    expect(result.invalidDeckCode).toBe(true);
    expect(result.payload).toEqual({
      playerName: 'テスト',
      networkDebugEnabled: true,
      roomBoardConfig: boardConfig,
      selectedHandSkinId: 'blue'
    });
    expect(result.payload.roomBoardConfig).not.toBe(boardConfig);
    expect(result.payload.deckCode).toBeUndefined();
  });

  test('create payload rejects empty player name before reading deck or skin state', () => {
    const sanitizeDeckCode = jest.fn();
    const readSelectedHandSkinId = jest.fn();
    const result = MatchEntryPayload.buildCreateRoomPayload(
      { playerName: '', deckCode: 'D1C1:A' },
      {
        normalizePlayerName: () => '',
        sanitizeDeckCode,
        readSelectedHandSkinId
      }
    );

    expect(result).toEqual({ ok: false, reason: 'PLAYER_NAME_REQUIRED' });
    expect(sanitizeDeckCode).not.toHaveBeenCalled();
    expect(readSelectedHandSkinId).not.toHaveBeenCalled();
  });

  test('join payload validates room, adds default hand skin, and preserves stored seat claim', () => {
    const result = MatchEntryPayload.buildJoinRoomPayload(
      'abc',
      { playerName: 'テスト', deckCode: ' D1C1:TEST ' },
      {
        normalizeRoomId: (value: any) => String(value || '').trim().toUpperCase(),
        sanitizeDeckCode: (value: any) => ({ value: String(value || '').trim(), invalid: false }),
        readSeatClaim: () => ({ seatKey: 'black', seatToken: 'stored_token' })
      }
    );

    expect(result.ok).toBe(true);
    expect(result.roomId).toBe('ABC');
    expect(result.usedStoredClaim).toBe(true);
    expect(result.payload).toEqual({
      roomId: 'ABC',
      playerName: 'テスト',
      selectedHandSkinId: 'default',
      deckCode: 'D1C1:TEST',
      seatKey: 'black',
      seatToken: 'stored_token'
    });
  });

  test('join retry payload drops stale claim and keeps replay-safe fields', () => {
    const join = MatchEntryPayload.buildJoinRoomPayload(
      'ABC',
      { playerName: 'テスト', deckCode: 'D1C1:TEST' },
      {
        readSelectedHandSkinId: () => 'red',
        readSeatClaim: () => ({ seatKey: 'white', seatToken: 'stale_token' })
      }
    );

    expect(MatchEntryPayload.buildJoinRetryPayload(join)).toEqual({
      roomId: 'ABC',
      playerName: 'テスト',
      selectedHandSkinId: 'red',
      deckCode: 'D1C1:TEST'
    });
  });

  test('join payload returns explicit reasons for invalid room ids', () => {
    expect(MatchEntryPayload.buildJoinRoomPayload('', { playerName: 'テスト' })).toEqual({
      ok: false,
      reason: 'ROOM_ID_REQUIRED',
      playerName: 'テスト'
    });
    expect(MatchEntryPayload.buildJoinRoomPayload('AB', { playerName: 'テスト' })).toEqual({
      ok: false,
      reason: 'ROOM_ID_INVALID',
      roomId: 'AB',
      playerName: 'テスト'
    });
  });
});
