let MatchEntryPayload: any;

beforeEach(() => {
  jest.resetModules();
  process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';
  MatchEntryPayload = require('../shared/match-entry-payload');
});

describe('match entry payload room password', () => {
  test('部屋作成 payload は任意の roomName と空名前のランダム名を含める', () => {
    const result = MatchEntryPayload.buildCreateRoomPayload({
      playerName: '',
      roomName: '  週末ルーム  '
    }, {
      createRandomPlayerName: () => 'ゲストABC'
    });

    expect(result.ok).toBe(true);
    expect(result.playerName).toBe('ゲストABC');
    expect(result.payload).toEqual({
      playerName: 'ゲストABC',
      roomName: '週末ルーム'
    });
  });

  test('部屋作成 payload は空の roomName を無名部屋にする', () => {
    const result = MatchEntryPayload.buildCreateRoomPayload({
      playerName: 'くろ',
      roomName: ''
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({
      playerName: 'くろ',
      roomName: '無名部屋'
    });
  });

  test('部屋作成 payload に任意の roomPassword を含める', () => {
    const result = MatchEntryPayload.buildCreateRoomPayload({
      playerName: 'くろ',
      roomPassword: '  swordfish  '
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({
      playerName: 'くろ',
      roomName: '無名部屋',
      roomPassword: 'swordfish'
    });
  });

  test('参加 payload に roomPassword を含める', () => {
    const result = MatchEntryPayload.buildJoinRoomPayload('abc', {
      playerName: 'しろ',
      roomPassword: ' swordfish '
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({
      roomId: 'ABC',
      playerName: 'しろ',
      selectedHandSkinId: 'default',
      roomPassword: 'swordfish'
    });
  });
});
