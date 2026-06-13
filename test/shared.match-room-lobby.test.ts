let MatchRoomLobby: any;

beforeEach(() => {
  jest.resetModules();
  process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';
  MatchRoomLobby = require('../shared/match-room-lobby');
});

describe('shared match room lobby helpers', () => {
  test('公開用ルーム一覧 entry は参加可能な部屋だけを返しパスワード本文を隠す', () => {
    const room = {
      roomId: 'ABC',
      seats: { black: true, white: false },
      seatNames: { black: 'くろ', white: '' },
      roomName: '週末ルーム',
      roomBoardConfig: { rows: 7, cols: 9 },
      roomPassword: 'secret',
      stateVersion: 0,
      updatedAt: 1234
    };

    const entry = MatchRoomLobby.toPublicRoomListEntry(room, { nowMs: 1234 });

    expect(entry).toEqual({
      roomId: 'ABC',
      roomName: '週末ルーム',
      hostName: 'くろ',
      seatCount: 1,
      maxSeats: 2,
      hasPassword: true,
      boardLabel: '7x9',
      stateVersion: 0,
      createdAt: 1234,
      waitingExpiresAt: 601234,
      updatedAt: 1234
    });
    expect(entry.roomPassword).toBeUndefined();
  });

  test('満員または空の部屋は一覧に出さない', () => {
    expect(MatchRoomLobby.toPublicRoomListEntry({
      roomId: 'FULL',
      seats: { black: true, white: true },
      seatNames: { black: 'くろ', white: 'しろ' }
    })).toBeNull();

    expect(MatchRoomLobby.toPublicRoomListEntry({
      roomId: 'EMPTY',
      seats: { black: false, white: false },
      seatNames: { black: '', white: '' }
    })).toBeNull();
  });

  test('空のルーム名は無名部屋として公開する', () => {
    const entry = MatchRoomLobby.toPublicRoomListEntry({
      roomId: 'NON',
      roomName: '',
      seats: { black: true, white: false },
      seatNames: { black: 'くろ', white: '' }
    });

    expect(entry.roomName).toBe('無名部屋');
  });

  test('パスワード付き部屋は一致する入力だけ参加を許可する', () => {
    const room = {
      roomId: 'LOCK',
      roomPassword: '  swordfish  '
    };

    expect(MatchRoomLobby.hasRoomPassword(room)).toBe(true);
    expect(MatchRoomLobby.isJoinPasswordAccepted(room, 'swordfish')).toBe(true);
    expect(MatchRoomLobby.isJoinPasswordAccepted(room, 'wrong')).toBe(false);
    expect(MatchRoomLobby.isJoinPasswordAccepted({ roomId: 'OPEN' }, '')).toBe(true);
  });

  test('作成から10分を超えた未参加ルームは期限切れとして扱う', () => {
    const createdAt = 1_000_000;
    const waitingRoom = {
      roomId: 'OLD',
      seats: { black: true, white: false },
      createdAt,
      updatedAt: createdAt + MatchRoomLobby.WAITING_ROOM_TTL_MS + 1
    };
    const joinedRoom = {
      roomId: 'PLAY',
      seats: { black: true, white: true },
      createdAt
    };

    expect(MatchRoomLobby.isWaitingRoomExpired(waitingRoom, createdAt + MatchRoomLobby.WAITING_ROOM_TTL_MS - 1)).toBe(false);
    expect(MatchRoomLobby.isWaitingRoomExpired(waitingRoom, createdAt + MatchRoomLobby.WAITING_ROOM_TTL_MS + 1)).toBe(true);
    expect(MatchRoomLobby.toPublicRoomListEntry(waitingRoom, { nowMs: createdAt + MatchRoomLobby.WAITING_ROOM_TTL_MS + 1 })).toBeNull();
    expect(MatchRoomLobby.isWaitingRoomExpired(joinedRoom, createdAt + MatchRoomLobby.WAITING_ROOM_TTL_MS + 1)).toBe(false);
  });
});
