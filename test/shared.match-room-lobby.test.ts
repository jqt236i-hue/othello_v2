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
      blackPlayerName: 'くろ',
      whitePlayerName: '',
      seatNames: {
        black: 'くろ',
        white: ''
      },
      seatCount: 1,
      maxSeats: 2,
      spectatorCount: 0,
      maxSpectators: 4,
      canJoin: true,
      canSpectate: true,
      hasPassword: true,
      boardLabel: '7x9',
      stateVersion: 0,
      createdAt: 1234,
      waitingExpiresAt: 601234,
      updatedAt: 1234
    });
    expect(entry.roomPassword).toBeUndefined();
  });

  test('公開用ルーム一覧 entry は参加済みの黒白プレイヤー名を公開する', () => {
    const entry = MatchRoomLobby.toPublicRoomListEntry({
      roomId: 'VS1',
      roomName: '対戦部屋',
      seats: { black: true, white: true },
      seatNames: { black: '作成主', white: '挑戦者' },
      maxSpectators: 4,
      stateVersion: 1,
      updatedAt: 2345
    }, { nowMs: 2345 });

    expect(entry).toEqual(expect.objectContaining({
      hostName: '作成主',
      blackPlayerName: '作成主',
      whitePlayerName: '挑戦者',
      seatNames: {
        black: '作成主',
        white: '挑戦者'
      },
      seatCount: 2,
      canJoin: false,
      canSpectate: true
    }));
  });

  test('空の部屋と観戦不可の満員部屋は一覧に出さない', () => {
    expect(MatchRoomLobby.toPublicRoomListEntry({
      roomId: 'FULL',
      seats: { black: true, white: true },
      seatNames: { black: 'くろ', white: 'しろ' },
      maxSpectators: 0
    })).toBeNull();

    expect(MatchRoomLobby.toPublicRoomListEntry({
      roomId: 'EMPTY',
      seats: { black: false, white: false },
      seatNames: { black: '', white: '' }
    })).toBeNull();
  });

  test('public room list exposes spectator availability for full rooms', () => {
    const entry = MatchRoomLobby.toPublicRoomListEntry({
      roomId: 'FUL',
      roomName: '満員部屋',
      seats: { black: true, white: true },
      seatNames: { black: '黒', white: '白' },
      spectators: {
        spec_a: { token: 'a', name: '観戦A', joinedAt: 1, lastSeenAt: 1 }
      },
      maxSpectators: 4,
      stateVersion: 8,
      createdAt: 100,
      updatedAt: 200
    });

    expect(entry).toEqual(expect.objectContaining({
      roomId: 'FUL',
      seatCount: 2,
      maxSeats: 2,
      spectatorCount: 1,
      maxSpectators: 4,
      canJoin: false,
      canSpectate: true
    }));
  });

  test('public room list hides full rooms when spectator slots are full', () => {
    const entry = MatchRoomLobby.toPublicRoomListEntry({
      roomId: 'SFL',
      seats: { black: true, white: true },
      spectators: {
        spec_a: { token: 'a' },
        spec_b: { token: 'b' },
        spec_c: { token: 'c' },
        spec_d: { token: 'd' }
      },
      maxSpectators: 4,
      stateVersion: 8,
      createdAt: 100,
      updatedAt: 200
    });

    expect(entry).toBeNull();
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
    expect(MatchRoomLobby.isJoinPasswordAccepted(room, 'swordfizz')).toBe(false);
    expect(MatchRoomLobby.isJoinPasswordAccepted({ roomId: 'OPEN' }, '')).toBe(true);
    expect(String(MatchRoomLobby.isJoinPasswordAccepted)).toContain('constantTimeStringEquals');
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

  test('streamがない部屋は非アクティブ化から15分で期限切れとして扱う', () => {
    const inactiveSince = 1_000_000;
    const inactiveRoom = {
      roomId: 'IDLE',
      seats: { black: true, white: true },
      stateVersion: 4,
      createdAt: inactiveSince - 1000,
      updatedAt: inactiveSince,
      inactiveSince
    };
    const activeRoom = {
      roomId: 'LIVE',
      seats: { black: true, white: true },
      stateVersion: 4,
      createdAt: inactiveSince - 1000,
      updatedAt: inactiveSince
    };

    expect(MatchRoomLobby.INACTIVE_ROOM_TTL_MS).toBe(15 * 60 * 1000);
    expect(MatchRoomLobby.getInactiveRoomExpiresAt(inactiveRoom)).toBe(inactiveSince + MatchRoomLobby.INACTIVE_ROOM_TTL_MS);
    expect(MatchRoomLobby.isInactiveRoomExpired(inactiveRoom, inactiveSince + MatchRoomLobby.INACTIVE_ROOM_TTL_MS - 1)).toBe(false);
    expect(MatchRoomLobby.isInactiveRoomExpired(inactiveRoom, inactiveSince + MatchRoomLobby.INACTIVE_ROOM_TTL_MS + 1)).toBe(true);
    expect(MatchRoomLobby.isInactiveRoomExpired(activeRoom, inactiveSince + MatchRoomLobby.INACTIVE_ROOM_TTL_MS + 1)).toBe(false);
  });
});
