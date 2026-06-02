import { JSDOM } from 'jsdom';

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    data
  };
}

describe('NetworkSessionLifecycleController', () => {
  let controller;
  let mockConfig;
  let stateObj;

  beforeEach(() => {
    jest.resetModules();

    stateObj = {
      roomId: null,
      seatKey: null,
      seatToken: null,
      playerName: null,
      networkDebugEnabled: false,
      stateVersion: null
    };

    mockConfig = {
      getState: jest.fn(() => stateObj),
      setServerUrl: jest.fn(),
      normalizePlayerName: jest.fn((name) => String(name || '').trim()),
      normalizeRoomId: jest.fn((id) => String(id || '').trim().toUpperCase()),
      sanitizeDeckCode: jest.fn((deckCode) => ({ value: String(deckCode || '').trim(), invalid: false })),
      requestJson: jest.fn(),
      emitStatus: jest.fn(),
      activateSessionFromResponse: jest.fn((data) => {
        stateObj.roomId = data.roomId;
        stateObj.seatKey = data.seatKey;
        stateObj.seatToken = data.seatToken;
      }),
      resetNetworkTelemetry: jest.fn(),
      openStream: jest.fn(),
      closeStream: jest.fn(),
      teardownActionBridge: jest.fn(),
      resetSessionState: jest.fn(() => {
        stateObj.roomId = null;
        stateObj.seatKey = null;
        stateObj.seatToken = null;
      }),
      resetTurnTimerState: jest.fn(),
      readSelectedHandSkinId: jest.fn(() => 'default'),
      readSeatClaim: jest.fn(),
      clearSeatClaim: jest.fn(),
      shouldRetryJoinWithoutStoredClaim: jest.fn(),
      isMatchApiMissing: jest.fn(() => false),
      getKnownProjectedSnapshotHash: jest.fn(),
      applyPayloadSessionState: jest.fn(),
      shouldSkipForceSyncSnapshot: jest.fn(() => false),
      applySnapshotThroughCoordinator: jest.fn(() => true),
      rememberPendingForceSyncPlaybackRecovery: jest.fn(),
      resolveStateSyncRecoveredPlaybackEvents: jest.fn((data) => Array.isArray(data?.playbackEvents) ? data.playbackEvents : []),
      recordNetworkTelemetry: jest.fn(),
      getSnapshotStateVersion: jest.fn((snapshot) => snapshot?.stateVersion || null),
      clearPlaybackStateForLeave: jest.fn(),
      clearPendingForceSyncPlaybackRecovery: jest.fn(),
      cloneData: jest.fn((value) => JSON.parse(JSON.stringify(value)))
    };

    const { createNetworkSessionLifecycleController } = require('../ui/network/session-lifecycle.js');
    controller = createNetworkSessionLifecycleController(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRoom - 基本機能', () => {
    test('正常に部屋を作成する', async () => {
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC',
        seatKey: 'black',
        seatToken: 'token123'
      }));

      const result = await controller.createRoom({ playerName: 'テスト' });

      expect(result.ok).toBe(true);
      expect(result.roomId).toBe('ABC');
      expect(result.seatKey).toBe('black');
      expect(mockConfig.activateSessionFromResponse).toHaveBeenCalled();
      expect(mockConfig.openStream).toHaveBeenCalled();
    });

    test('プレイヤー名を正規化する', async () => {
      mockConfig.normalizePlayerName.mockReturnValue('テストプレイヤー');
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC',
        seatKey: 'black'
      }));

      await controller.createRoom({ playerName: '  テストプレイヤー  ' });

      expect(mockConfig.normalizePlayerName).toHaveBeenCalledWith('  テストプレイヤー  ');
    });

    test('デッキコードとボード設定を含める', async () => {
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC'
      }));

      await controller.createRoom({
        playerName: 'テスト',
        deckCode: 'TEST001',
        roomBoardConfig: { rows: 7, cols: 7 }
      });

      expect(mockConfig.requestJson).toHaveBeenCalledWith(
        'POST',
        '/api/match/create',
        expect.objectContaining({
          deckCode: 'TEST001',
          roomBoardConfig: { rows: 7, cols: 7 }
        })
      );
    });

    test('無効なデッキコードは標準デッキへフォールバックする', async () => {
      mockConfig.sanitizeDeckCode.mockReturnValue({ value: '', invalid: true });
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC'
      }));

      await controller.createRoom({
        playerName: 'テスト',
        deckCode: 'BROKEN_DECK'
      });

      const createPayload = mockConfig.requestJson.mock.calls[0][2];
      expect(createPayload.deckCode).toBeUndefined();
      expect(mockConfig.emitStatus).toHaveBeenCalledWith(
        '選択中のカスタムデッキを読み込めなかったため、標準デッキで続行します',
        false
      );
    });
  });

  describe('createRoom - エラーハンドリング', () => {
    test('プレイヤー名が空の場合はエラー', async () => {
      mockConfig.normalizePlayerName.mockReturnValue('');

      const result = await controller.createRoom({ playerName: '' });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('PLAYER_NAME_REQUIRED');
      expect(mockConfig.emitStatus).toHaveBeenCalled();
    });

    test('APIが見つからない場合はエラー', async () => {
      mockConfig.isMatchApiMissing.mockReturnValue(true);
      mockConfig.requestJson.mockResolvedValue(jsonResponse(404, { ok: false }));

      const result = await controller.createRoom({ playerName: 'テスト' });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('MATCH_API_NOT_FOUND');
    });

    test('作成失敗時はエラーレスポンスを返す', async () => {
      mockConfig.requestJson.mockResolvedValue(jsonResponse(500, {
        ok: false,
        reason: 'SERVER_ERROR'
      }));

      const result = await controller.createRoom({ playerName: 'テスト' });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('SERVER_ERROR');
    });

    test('無効なデッキコードは専用メッセージを表示する', async () => {
      mockConfig.requestJson.mockResolvedValue(jsonResponse(400, {
        ok: false,
        reason: 'DECK_CODE_INVALID'
      }));

      const result = await controller.createRoom({ playerName: 'テスト', deckCode: 'BROKEN_DECK' });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('DECK_CODE_INVALID');
      expect(mockConfig.emitStatus).toHaveBeenCalledWith('選択中のデッキコードが無効です', true);
    });
  });

  describe('joinRoom - 基本機能', () => {
    test('正常に部屋に参加する', async () => {
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC',
        seatKey: 'white',
        seatToken: 'token456'
      }));

      const result = await controller.joinRoom('ABC', { playerName: 'テスト' });

      expect(result.ok).toBe(true);
      expect(result.roomId).toBe('ABC');
      expect(result.seatKey).toBe('white');
      expect(mockConfig.activateSessionFromResponse).toHaveBeenCalled();
      expect(mockConfig.openStream).toHaveBeenCalled();
    });

    test('部屋IDを正規化する', async () => {
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC'
      }));

      await controller.joinRoom('abc', { playerName: 'テスト' });

      expect(mockConfig.normalizeRoomId).toHaveBeenCalledWith('abc');
    });

    test('保存されたシートクレームを使用する', async () => {
      mockConfig.readSeatClaim.mockReturnValue({
        seatKey: 'black',
        seatToken: 'stored_token'
      });
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC'
      }));

      await controller.joinRoom('ABC', { playerName: 'テスト' });

      expect(mockConfig.requestJson).toHaveBeenCalledWith(
        'POST',
        '/api/match/join',
        expect.objectContaining({
          seatKey: 'black',
          seatToken: 'stored_token'
        })
      );
    });

    test('join でも無効なデッキコードは標準デッキへフォールバックする', async () => {
      mockConfig.sanitizeDeckCode.mockReturnValue({ value: '', invalid: true });
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC'
      }));

      await controller.joinRoom('ABC', {
        playerName: 'テスト',
        deckCode: 'BROKEN_DECK'
      });

      const joinPayload = mockConfig.requestJson.mock.calls[0][2];
      expect(joinPayload.deckCode).toBeUndefined();
      expect(mockConfig.emitStatus).toHaveBeenCalledWith(
        '選択中のカスタムデッキを読み込めなかったため、標準デッキで続行します',
        false
      );
    });
  });

  describe('joinRoom - エラーハンドリング', () => {
    test('部屋IDが空の場合はエラー', async () => {
      mockConfig.normalizeRoomId.mockReturnValue('');

      const result = await controller.joinRoom('', { playerName: 'テスト' });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('ROOM_ID_REQUIRED');
    });

    test('部屋IDが不正な場合はエラー', async () => {
      const result = await controller.joinRoom('AB', { playerName: 'テスト' });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('ROOM_ID_INVALID');
    });

    test('保存されたクレームが無効な場合はリトライする', async () => {
      mockConfig.readSeatClaim.mockReturnValue({
        seatKey: 'black',
        seatToken: 'invalid_token'
      });
      mockConfig.shouldRetryJoinWithoutStoredClaim.mockReturnValue(true);
      
      mockConfig.requestJson
        .mockResolvedValueOnce(jsonResponse(403, { ok: false }))
        .mockResolvedValueOnce(jsonResponse(200, {
          ok: true,
          roomId: 'ABC'
        }));

      const result = await controller.joinRoom('ABC', { playerName: 'テスト' });

      expect(result.ok).toBe(true);
      expect(mockConfig.clearSeatClaim).toHaveBeenCalledWith('ABC');
      expect(mockConfig.requestJson).toHaveBeenCalledTimes(2);
    });
  });

  describe('syncLatestState - 基本機能', () => {
    test('状態を同期する', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'token123';

      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        snapshot: { stateVersion: 10 }
      }));

      const result = await controller.syncLatestState();

      expect(result.ok).toBe(true);
      expect(result.appliedSnapshot).toBe(true);
      expect(mockConfig.applyPayloadSessionState).toHaveBeenCalled();
      expect(mockConfig.applySnapshotThroughCoordinator).toHaveBeenCalled();
    });

    test('スナップショットがスキップされる場合', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';

      mockConfig.shouldSkipForceSyncSnapshot.mockReturnValue(true);
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        snapshot: { stateVersion: 5 }
      }));

      const result = await controller.syncLatestState();

      expect(result.ok).toBe(true);
      expect(result.appliedSnapshot).toBe(false);
      expect(mockConfig.recordNetworkTelemetry).toHaveBeenCalledWith(
        'state_sync_snapshot_skipped',
        expect.any(Object)
      );
    });

    test('スキップされた snapshot では recovered playback を消費しない', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';

      mockConfig.shouldSkipForceSyncSnapshot.mockReturnValue(true);
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        snapshot: { stateVersion: 5 },
        playbackEvents: [{ type: 'move', targets: [{ x: 1, y: 2 }] }]
      }));

      await controller.syncLatestState();

      expect(mockConfig.resolveStateSyncRecoveredPlaybackEvents).not.toHaveBeenCalled();
      expect(mockConfig.applySnapshotThroughCoordinator).not.toHaveBeenCalled();
    });
  });

  describe('syncLatestState - エラーハンドリング', () => {
    test('部屋に参加していない場合はエラー', async () => {
      stateObj.roomId = null;

      const result = await controller.syncLatestState();

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('NO_ROOM');
    });

    test('状態取得に失敗した場合', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';

      mockConfig.requestJson.mockResolvedValue(jsonResponse(500, {
        ok: false,
        reason: 'SERVER_ERROR'
      }));

      const result = await controller.syncLatestState();

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('SERVER_ERROR');
    });
  });

  describe('leaveRoom - 基本機能', () => {
    test('正常に退出する', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'token123';

      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, { ok: true }));

      const result = await controller.leaveRoom();

      expect(result.ok).toBe(true);
      expect(mockConfig.resetSessionState).toHaveBeenCalled();
      expect(mockConfig.closeStream).toHaveBeenCalled();
      expect(mockConfig.clearSeatClaim).toHaveBeenCalledWith('ABC');
    });

    test('部屋に参加していない場合は即座に成功', async () => {
      stateObj.roomId = null;

      const result = await controller.leaveRoom();

      expect(result.ok).toBe(true);
      expect(mockConfig.resetSessionState).toHaveBeenCalled();
      expect(mockConfig.requestJson).not.toHaveBeenCalled();
    });
  });

  describe('leaveRoom - エラーハンドリング', () => {
    test('退出リクエストが失敗した場合', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';

      mockConfig.requestJson.mockRejectedValue(new Error('Network error'));

      const result = await controller.leaveRoom();

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('LEAVE_REQUEST_FAILED');
    });

    test('部屋が見つからない場合は成功とみなす', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';

      mockConfig.requestJson.mockResolvedValue(jsonResponse(404, {
        ok: false,
        reason: 'ROOM_NOT_FOUND'
      }));

      const result = await controller.leaveRoom();

      expect(result.ok).toBe(true);
    });
  });
});
