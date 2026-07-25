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
      ensurePlayerIdentity: jest.fn(async () => ({
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
      })),
      requestJson: jest.fn(),
      emitStatus: jest.fn(),
      activateSessionFromResponse: jest.fn((data) => {
        stateObj.roomId = data.roomId;
        stateObj.seatKey = data.seatKey;
        stateObj.seatToken = data.seatToken;
      }),
      activateSpectatorSessionFromResponse: jest.fn((data) => {
        stateObj.roomId = data.roomId;
        stateObj.viewerRole = data.viewerRole;
        stateObj.spectatorId = data.spectatorId;
        stateObj.spectatorToken = data.spectatorToken;
      }),
      advanceSessionEpoch: jest.fn(),
      disposePresentationTimeline: jest.fn(async () => true),
      resetNetworkTelemetry: jest.fn(),
      openStream: jest.fn(),
      cancelSessionReadRequests: jest.fn(),
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
      readStoredSession: jest.fn(),
      clearSeatClaim: jest.fn(),
      clearStoredSession: jest.fn(),
      activateStoredSession: jest.fn((session) => {
        stateObj.roomId = session.roomId;
        stateObj.viewerRole = session.viewerRole || 'seat';
        stateObj.seatKey = session.seatKey || 'black';
        stateObj.seatToken = session.seatToken || '';
        stateObj.spectatorId = session.spectatorId || '';
        stateObj.spectatorToken = session.spectatorToken || '';
        stateObj.spectatorName = session.spectatorName || '';
        stateObj.lastVisualSeq = Number.isFinite(Number(session.lastVisualSeq))
          ? Math.max(0, Math.trunc(Number(session.lastVisualSeq)))
          : 0;
        stateObj.lastVisualVersion = Number.isFinite(Number(session.lastVisualVersion))
          ? Math.max(0, Math.trunc(Number(session.lastVisualVersion)))
          : null;
        return true;
      }),
      shouldRetryJoinWithoutStoredClaim: jest.fn(),
      isMatchApiMissing: jest.fn(() => false),
      getKnownProjectedSnapshotHash: jest.fn(),
      applyPayloadSessionState: jest.fn(),
      shouldSkipForceSyncSnapshot: jest.fn(() => false),
      applySnapshotThroughCoordinator: jest.fn(() => true),
      rememberPendingForceSyncPlaybackRecovery: jest.fn(),
      syncVisualCursorForSnapshotNoPlayback: jest.fn(() => true),
      resolveStateSyncRecoveredPlaybackEvents: jest.fn((data) => Array.isArray(data?.playbackEvents) ? data.playbackEvents : []),
      recordNetworkTelemetry: jest.fn(),
      getSnapshotStateVersion: jest.fn((snapshot) => snapshot?.stateVersion || null),
      visualStateStore: {
        setBaseVisualSnapshot: jest.fn()
      },
      enqueuePresentationFramesFromPayload: jest.fn(() => 0),
      drainPresentationTimeline: jest.fn(async () => 0),
      clearPlaybackStateForLeave: jest.fn(),
      clearPendingForceSyncPlaybackRecovery: jest.fn(),
      markSessionReloadRequired: jest.fn(() => { stateObj.active = false; }),
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

    test('旧presentation timelineを破棄してから新sessionを有効化する', async () => {
      const order = [];
      mockConfig.disposePresentationTimeline.mockImplementation(async () => {
        order.push('dispose');
        return true;
      });
      mockConfig.activateSessionFromResponse.mockImplementation((data) => {
        order.push('activate');
        stateObj.roomId = data.roomId;
        stateObj.seatKey = data.seatKey;
        stateObj.seatToken = data.seatToken;
      });
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC',
        seatKey: 'black',
        seatToken: 'token123'
      }));

      await expect(controller.createRoom({ playerName: 'テスト' })).resolves.toMatchObject({ ok: true });
      expect(order).toEqual(['dispose', 'activate']);
      expect(mockConfig.disposePresentationTimeline).toHaveBeenCalledWith('session_create_activation');
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
          roomBoardConfig: { rows: 7, cols: 7 },
          playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
          playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
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

    test('すでに部屋に参加している場合は新しい部屋作成要求を送らない', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'token123';

      const result = await controller.createRoom({ playerName: 'テスト' });

      expect(result).toEqual({ ok: false, reason: 'ALREADY_IN_ROOM', roomId: 'ABC' });
      expect(mockConfig.requestJson).not.toHaveBeenCalled();
      expect(mockConfig.emitStatus).toHaveBeenCalledWith('すでにネット対戦の部屋に参加しています', true);
    });

    test('部屋作成中の再クリックは追加の作成要求を送らない', async () => {
      let resolveCreate;
      mockConfig.requestJson.mockImplementation(() => new Promise((resolve) => {
        resolveCreate = resolve;
      }));

      const firstCreate = controller.createRoom({ playerName: 'テスト' });
      const secondCreate = await controller.createRoom({ playerName: 'テスト' });

      expect(secondCreate).toEqual({ ok: false, reason: 'CREATE_IN_PROGRESS' });
      await Promise.resolve();
      expect(mockConfig.requestJson).toHaveBeenCalledTimes(1);
      expect(mockConfig.emitStatus).toHaveBeenCalledWith('部屋作成中です', false);

      resolveCreate(jsonResponse(200, {
        ok: true,
        roomId: 'ABC',
        seatKey: 'black',
        seatToken: 'token123'
      }));
      await expect(firstCreate).resolves.toMatchObject({ ok: true, roomId: 'ABC' });
    });
  });

  describe('createRoom - エラーハンドリング', () => {
    test('作成時のプレイヤー名が空の場合はランダム名で作成する', async () => {
      mockConfig.createRandomPlayerName = jest.fn(() => 'ゲストABC');
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'ABC',
        roomName: '無名部屋',
        seatKey: 'black'
      }));

      const result = await controller.createRoom({ playerName: '', roomName: '' });

      expect(result.ok).toBe(true);
      expect(result.playerName).toBe('ゲストABC');
      expect(mockConfig.requestJson).toHaveBeenCalledWith(
        'POST',
        '/api/match/create',
        expect.objectContaining({
          playerName: 'ゲストABC',
          roomName: '無名部屋'
        })
      );
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
          seatToken: 'stored_token',
          playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
          playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
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

    test('パスワード不一致は専用メッセージを表示する', async () => {
      mockConfig.requestJson.mockResolvedValue(jsonResponse(403, {
        ok: false,
        reason: 'ROOM_PASSWORD_INVALID'
      }));

      const result = await controller.joinRoom('ABC', {
        playerName: 'テスト',
        roomPassword: 'wrong'
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('ROOM_PASSWORD_INVALID');
      expect(mockConfig.emitStatus).toHaveBeenCalledWith('パスワードが違います', true);
    });
  });

  describe('listRooms', () => {
    test('公開ルーム一覧を取得する', async () => {
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        rooms: [
          { roomId: 'ABC', hostName: 'くろ', seatCount: 1, maxSeats: 2, hasPassword: false }
        ]
      }));

      const result = await controller.listRooms({ serverUrl: 'http://localhost:8787' });

      expect(result).toEqual({
        ok: true,
        rooms: [
          { roomId: 'ABC', hostName: 'くろ', seatCount: 1, maxSeats: 2, hasPassword: false }
        ]
      });
      expect(mockConfig.setServerUrl).toHaveBeenCalledWith('http://localhost:8787');
      expect(mockConfig.requestJson).toHaveBeenCalledWith('GET', '/api/match/list');
    });

    test('一覧APIがない場合は専用エラーを返す', async () => {
      mockConfig.isMatchApiMissing.mockReturnValue(true);
      mockConfig.requestJson.mockResolvedValue(jsonResponse(404, { ok: false }));

      const result = await controller.listRooms();

      expect(result).toEqual({ ok: false, reason: 'MATCH_API_NOT_FOUND', rooms: [] });
      expect(mockConfig.emitStatus).toHaveBeenCalledWith('ネット対戦: サーバーに接続できません', true);
    });
  });

  describe('spectateRoom', () => {
    test('観戦者セッションを有効化してstreamを開く', async () => {
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        roomId: 'SPC',
        viewerRole: 'spectator',
        spectatorId: 'spec_12345678',
        spectatorToken: 'spectator-token',
        spectatorName: '観戦',
        stateVersion: 2,
        snapshot: {
          _meta: {
            authority: 'server',
            viewerRole: 'spectator'
          }
        }
      }));

      const result = await controller.spectateRoom('spc', { playerName: ' 観戦 ' });

      expect(result).toEqual(expect.objectContaining({
        ok: true,
        roomId: 'SPC',
        viewerRole: 'spectator',
        spectatorId: 'spec_12345678',
        spectatorName: '観戦'
      }));
      expect(mockConfig.requestJson).toHaveBeenCalledWith(
        'POST',
        '/api/match/spectate',
        {
          roomId: 'SPC',
          spectatorName: '観戦'
        }
      );
      expect(mockConfig.activateSpectatorSessionFromResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'SPC',
          viewerRole: 'spectator',
          spectatorId: 'spec_12345678',
          spectatorToken: 'spectator-token',
          playerName: '観戦'
        }),
        'SPC'
      );
      expect(mockConfig.resetNetworkTelemetry).toHaveBeenCalled();
      expect(mockConfig.openStream).toHaveBeenCalled();
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

    test('heartbeat recovery state sync submits a heartbeat_recovery envelope', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'token123';
      mockConfig.normalizeNetworkSnapshotEnvelope = jest.fn((input) => ({
        source: input.source,
        operationId: null,
        stateVersion: input.payload?.stateVersion ?? input.payload?.snapshot?.stateVersion ?? null,
        visualSeq: input.payload?.presentationCursor?.visualSeq ?? null,
        snapshot: input.payload?.snapshot ?? null,
        presentationFrames: input.payload?.presentationFrames ?? [],
        playbackEvents: input.payload?.playbackEvents ?? [],
        presentationCursor: input.payload?.presentationCursor ?? null,
        force: input.force === true,
        skipResultOverlay: false,
        receivedAt: 1,
        applyOptions: input.applyOptions
      }));
      mockConfig.submitNetworkSnapshotEnvelope = jest.fn(() => ({
        appliedSnapshot: true,
        enqueuedFrameCount: 0,
        requestedBoardRefresh: true
      }));
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        stateVersion: 10,
        snapshot: { stateVersion: 10 },
        playbackEvents: []
      }));

      const result = await controller.syncLatestState({ source: 'heartbeat_recovery' });

      expect(result.ok).toBe(true);
      expect(mockConfig.normalizeNetworkSnapshotEnvelope).toHaveBeenCalledWith(expect.objectContaining({
        source: 'heartbeat_recovery',
        force: true,
        applyOptions: expect.objectContaining({
          presentationFrameSource: 'heartbeat_recovery'
        })
      }));
      expect(mockConfig.submitNetworkSnapshotEnvelope).toHaveBeenCalledWith(expect.objectContaining({
        source: 'heartbeat_recovery',
        snapshot: { stateVersion: 10 }
      }));
      expect(mockConfig.applySnapshotThroughCoordinator).not.toHaveBeenCalled();
    });

    test('観戦者セッションではspectator credentialsで状態を同期する', async () => {
      stateObj.roomId = 'SPC';
      stateObj.viewerRole = 'spectator';
      stateObj.spectatorId = 'spec_12345678';
      stateObj.spectatorToken = 'spectator-token';

      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        snapshot: { stateVersion: 10 }
      }));

      const result = await controller.syncLatestState();

      expect(result.ok).toBe(true);
      expect(mockConfig.requestJson).toHaveBeenCalledWith(
        'GET',
        '/api/match/state?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spectator-token'
      );
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

    test('state syncのpresentation cursorが直接frame数より進んでいる場合はjournalで補完する', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'token_black';
      stateObj.lastVisualSeq = 1;
      stateObj.lastVisualVersion = 2;
      mockConfig.requestJson.mockImplementation(async (method, path) => {
        if (method === 'GET' && path.startsWith('/api/match/state')) {
          return jsonResponse(200, {
            ok: true,
            stateVersion: 4,
            snapshot: { stateVersion: 4, gameState: {}, cardState: {} },
            presentationCursor: { visualSeq: 3, stateVersion: 4 },
            presentationFrames: [
              { visualSeq: 3, stateVersionFrom: 3, stateVersionTo: 4, playbackEvents: [{ type: 'event_3' }] }
            ]
          });
        }
        if (method === 'GET' && path.startsWith('/api/match/presentation-journal')) {
          expect(path).toContain('afterVisualSeq=1');
          return jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            baseVisualSeq: 1,
            baseSnapshot: { stateVersion: 2, gameState: {}, cardState: {} },
            presentationCursor: { visualSeq: 3, stateVersion: 4 },
            presentationFrames: [
              { visualSeq: 2, stateVersionFrom: 2, stateVersionTo: 3, playbackEvents: [{ type: 'event_2' }] },
              { visualSeq: 3, stateVersionFrom: 3, stateVersionTo: 4, playbackEvents: [{ type: 'event_3' }] }
            ]
          });
        }
        throw new Error(`unexpected request ${method} ${path}`);
      });
      mockConfig.enqueuePresentationFramesFromPayload.mockReturnValue(2);
      mockConfig.drainPresentationTimeline.mockResolvedValue(2);

      const result = await controller.syncLatestState();

      expect(result).toEqual(expect.objectContaining({ ok: true, appliedSnapshot: true }));
      expect(mockConfig.applySnapshotThroughCoordinator).toHaveBeenCalledWith(
        expect.objectContaining({ stateVersion: 4 }),
        expect.objectContaining({
          source: 'state_sync',
          applyOptions: expect.objectContaining({
            presentationFrames: [expect.objectContaining({ visualSeq: 3 })],
            presentationFrameSource: 'state_sync'
          })
        })
      );
      expect(mockConfig.visualStateStore.setBaseVisualSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ stateVersion: 2 }),
        expect.objectContaining({ visualSeq: 1, visualVersion: 2, source: 'state_sync' })
      );
      expect(mockConfig.enqueuePresentationFramesFromPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          presentationFrames: expect.arrayContaining([
            expect.objectContaining({ visualSeq: 2 }),
            expect.objectContaining({ visualSeq: 3 })
          ])
        }),
        { source: 'state_sync' }
      );
      expect(mockConfig.drainPresentationTimeline).toHaveBeenCalled();
    });

    test('presentation journal catch-up submits frames through intake coordinator when available', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'token_black';
      stateObj.lastVisualSeq = 1;
      stateObj.lastVisualVersion = 2;
      mockConfig.normalizeNetworkSnapshotEnvelope = jest.fn((input) => ({
        source: input.source,
        operationId: null,
        stateVersion: input.stateVersion ?? input.payload?.stateVersion ?? input.payload?.presentationCursor?.stateVersion ?? null,
        visualSeq: input.payload?.presentationCursor?.visualSeq ?? null,
        snapshot: Object.prototype.hasOwnProperty.call(input, 'snapshot') ? input.snapshot : input.payload?.snapshot ?? null,
        presentationFrames: input.payload?.presentationFrames ?? [],
        playbackEvents: [],
        presentationCursor: input.payload?.presentationCursor ?? null,
        force: input.force === true,
        skipResultOverlay: false,
        receivedAt: 1,
        applyOptions: input.applyOptions
      }));
      mockConfig.submitNetworkSnapshotEnvelope = jest.fn((envelope) => ({
        appliedSnapshot: envelope.source === 'state_sync',
        enqueuedFrameCount: envelope.source === 'presentation_journal' ? 2 : 1,
        requestedBoardRefresh: false
      }));
      mockConfig.requestJson.mockImplementation(async (method, path) => {
        if (method === 'GET' && path.startsWith('/api/match/state')) {
          return jsonResponse(200, {
            ok: true,
            stateVersion: 4,
            snapshot: { stateVersion: 4, gameState: {}, cardState: {} },
            presentationCursor: { visualSeq: 3, stateVersion: 4 },
            presentationFrames: [
              { visualSeq: 3, stateVersionFrom: 3, stateVersionTo: 4, playbackEvents: [{ type: 'event_3' }] }
            ]
          });
        }
        if (method === 'GET' && path.startsWith('/api/match/presentation-journal')) {
          return jsonResponse(200, {
            ok: true,
            baseVisualSeq: 1,
            baseSnapshot: { stateVersion: 2, gameState: {}, cardState: {} },
            presentationCursor: { visualSeq: 3, stateVersion: 4 },
            presentationFrames: [
              { visualSeq: 2, stateVersionFrom: 2, stateVersionTo: 3, playbackEvents: [{ type: 'event_2' }] },
              { visualSeq: 3, stateVersionFrom: 3, stateVersionTo: 4, playbackEvents: [{ type: 'event_3' }] }
            ]
          });
        }
        throw new Error(`unexpected request ${method} ${path}`);
      });

      await controller.syncLatestState();

      expect(mockConfig.submitNetworkSnapshotEnvelope).toHaveBeenNthCalledWith(1, expect.objectContaining({
        source: 'state_sync',
        snapshot: expect.objectContaining({ stateVersion: 4 }),
        presentationFrames: [
          expect.objectContaining({ visualSeq: 3 })
        ]
      }));
      expect(mockConfig.submitNetworkSnapshotEnvelope).toHaveBeenCalledWith(expect.objectContaining({
        source: 'presentation_journal',
        snapshot: null,
        stateVersion: 4,
        presentationFrames: expect.arrayContaining([
          expect.objectContaining({ visualSeq: 2 }),
          expect.objectContaining({ visualSeq: 3 })
        ])
      }));
      expect(mockConfig.applySnapshotThroughCoordinator).not.toHaveBeenCalled();
      expect(mockConfig.enqueuePresentationFramesFromPayload).not.toHaveBeenCalled();
      expect(mockConfig.drainPresentationTimeline).toHaveBeenCalled();
    });
  });

  describe('syncLatestState - エラーハンドリング', () => {
    test('旧sessionのstate応答を別roomへ適用しない', async () => {
      stateObj.roomId = 'OLD';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'old-token';
      let resolveRequest: ((value: any) => void) | null = null;
      mockConfig.requestJson.mockImplementation(() => new Promise((resolve) => {
        resolveRequest = resolve;
      }));

      const syncPromise = controller.syncLatestState();
      stateObj.roomId = 'NEW';
      stateObj.seatKey = 'white';
      stateObj.seatToken = 'new-token';
      resolveRequest!(jsonResponse(200, {
        ok: true,
        stateVersion: 2,
        snapshot: { stateVersion: 2, gameState: { source: 'old' }, cardState: {} }
      }));

      await expect(syncPromise).resolves.toMatchObject({
        ok: false,
        stale: true,
        reason: 'SESSION_CHANGED'
      });
      expect(mockConfig.applyPayloadSessionState).not.toHaveBeenCalled();
      expect(mockConfig.applySnapshotThroughCoordinator).not.toHaveBeenCalled();
    });

    test('旧sessionのjournal応答を別roomのvisual storeへ適用しない', async () => {
      stateObj.roomId = 'OLD';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'old-token';
      stateObj.lastVisualSeq = 1;
      stateObj.lastVisualVersion = 1;
      let resolveJournal: ((value: any) => void) | null = null;
      mockConfig.requestJson.mockImplementation(async (_method, path) => {
        if (path.startsWith('/api/match/state')) {
          return jsonResponse(200, {
            ok: true,
            stateVersion: 3,
            snapshot: { stateVersion: 3, gameState: {}, cardState: {} },
            presentationCursor: { visualSeq: 3, stateVersion: 3 }
          });
        }
        return new Promise((resolve) => { resolveJournal = resolve; });
      });

      const syncPromise = controller.syncLatestState();
      while (!resolveJournal) await Promise.resolve();
      stateObj.roomId = 'NEW';
      stateObj.seatKey = 'white';
      stateObj.seatToken = 'new-token';
      resolveJournal!(jsonResponse(200, {
        ok: true,
        baseVisualSeq: 1,
        baseSnapshot: { stateVersion: 1, gameState: { source: 'old' }, cardState: {} },
        presentationFrames: [
          { visualSeq: 2, stateVersionFrom: 1, stateVersionTo: 2, playbackEvents: [] },
          { visualSeq: 3, stateVersionFrom: 2, stateVersionTo: 3, playbackEvents: [] }
        ]
      }));

      await expect(syncPromise).resolves.toMatchObject({
        ok: false,
        stale: true,
        reason: 'SESSION_CHANGED'
      });
      expect(mockConfig.visualStateStore.setBaseVisualSnapshot).not.toHaveBeenCalled();
      expect(mockConfig.enqueuePresentationFramesFromPayload).not.toHaveBeenCalled();
      expect(mockConfig.drainPresentationTimeline).not.toHaveBeenCalled();
    });

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

  describe('restoreStoredSession', () => {
    test('保存済み観戦者セッションを復帰して状態同期後にstreamを開く', async () => {
      mockConfig.readStoredSession.mockReturnValue({
        roomId: 'SPC',
        viewerRole: 'spectator',
        spectatorId: 'spec_12345678',
        spectatorToken: 'spectator-token',
        spectatorName: '観戦'
      });
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
        ok: true,
        snapshot: {
          stateVersion: 12,
          _meta: {
            authority: 'server',
            viewerRole: 'spectator'
          }
        }
      }));

      const result = await controller.restoreStoredSession();

      expect(result).toEqual(expect.objectContaining({
        ok: true,
        restored: true,
        roomId: 'SPC',
        viewerRole: 'spectator',
        spectatorId: 'spec_12345678',
        spectatorName: '観戦'
      }));
      expect(mockConfig.activateStoredSession).toHaveBeenCalledWith(expect.objectContaining({
        roomId: 'SPC',
        viewerRole: 'spectator',
        spectatorToken: 'spectator-token'
      }));
      expect(mockConfig.requestJson).toHaveBeenCalledWith(
        'GET',
        '/api/match/state?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spectator-token'
      );
      expect(mockConfig.openStream).toHaveBeenCalled();
      expect(mockConfig.clearStoredSession).not.toHaveBeenCalled();
    });

    test('保存済みvisual cursorが遅れていてもF5復帰では現在cursorへ同期してjournal再生をスキップする', async () => {
      mockConfig.readStoredSession.mockReturnValue({
        roomId: 'ABC',
        viewerRole: 'seat',
        seatKey: 'black',
        seatToken: 'token_black',
        lastVisualSeq: 1,
        lastVisualVersion: 2
      });
      mockConfig.requestJson.mockImplementation(async (method, path) => {
        if (method === 'GET' && path.startsWith('/api/match/state')) {
          return jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            stateVersion: 4,
            snapshot: { stateVersion: 4, gameState: { currentPlayer: 1 }, cardState: {} },
            presentationCursor: { visualSeq: 3, stateVersion: 4 }
          });
        }
        if (method === 'GET' && path.startsWith('/api/match/presentation-journal')) {
          throw new Error(`unexpected journal request ${path}`);
        }
        throw new Error(`unexpected request ${method} ${path}`);
      });

      const result = await controller.restoreStoredSession();

      expect(result).toEqual(expect.objectContaining({ ok: true, restored: true }));
      expect(mockConfig.requestJson).toHaveBeenCalledTimes(1);
      expect(mockConfig.enqueuePresentationFramesFromPayload).not.toHaveBeenCalled();
      expect(mockConfig.drainPresentationTimeline).not.toHaveBeenCalled();
      expect(mockConfig.syncVisualCursorForSnapshotNoPlayback).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot: expect.objectContaining({ stateVersion: 4 }),
          presentationCursor: { visualSeq: 3, stateVersion: 4 }
        }),
        4,
        {
          requirePresentationCursor: true,
          source: 'state_sync'
        }
      );
      expect(mockConfig.openStream).toHaveBeenCalled();
    });
  });

  describe('leaveRoom - 基本機能', () => {
    test('正常に退出する', async () => {
      const order = [];
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'token123';

      mockConfig.disposePresentationTimeline.mockImplementation(async () => {
        order.push('dispose');
        return true;
      });
      mockConfig.closeStream.mockImplementation(() => order.push('close-stream'));
      mockConfig.clearPlaybackStateForLeave.mockImplementation(() => order.push('clear-playback'));
      mockConfig.resetSessionState.mockImplementation(() => {
        order.push('reset-session');
        stateObj.roomId = null;
      });

      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, { ok: true }));

      const result = await controller.leaveRoom();

      expect(result.ok).toBe(true);
      expect(mockConfig.resetSessionState).toHaveBeenCalled();
      expect(mockConfig.closeStream).toHaveBeenCalled();
      expect(order).toEqual(['close-stream', 'dispose', 'clear-playback', 'reset-session']);
      expect(mockConfig.advanceSessionEpoch).toHaveBeenNthCalledWith(1, 'session_leave_requested');
      expect(mockConfig.advanceSessionEpoch).toHaveBeenNthCalledWith(2, 'session_leave_confirmed');
      expect(mockConfig.cancelSessionReadRequests).toHaveBeenCalledTimes(1);
      expect(mockConfig.clearSeatClaim).toHaveBeenCalledWith('ABC');
    });

    test('観戦者はspectator-leaveで退出する', async () => {
      stateObj.roomId = 'SPC';
      stateObj.viewerRole = 'spectator';
      stateObj.spectatorId = 'spec_12345678';
      stateObj.spectatorToken = 'spectator-token';

      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, { ok: true }));

      const result = await controller.leaveRoom();

      expect(result.ok).toBe(true);
      expect(mockConfig.requestJson).toHaveBeenCalledWith(
        'POST',
        '/api/match/spectator-leave',
        {
          roomId: 'SPC',
          spectatorId: 'spec_12345678',
          spectatorToken: 'spectator-token'
        }
      );
      expect(mockConfig.clearSeatClaim).not.toHaveBeenCalled();
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
    test('authority退出成功後にsettlement破棄が失敗したらreload-requiredへ収束する', async () => {
      stateObj.active = true;
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';
      stateObj.seatToken = 'token123';
      mockConfig.requestJson.mockResolvedValue(jsonResponse(200, { ok: true }));
      mockConfig.disposePresentationTimeline.mockRejectedValue(new Error('backend restore failed'));

      await expect(controller.leaveRoom()).resolves.toEqual({
        ok: false,
        reason: 'LEAVE_SETTLEMENT_DISPOSE_FAILED',
        authorityLeft: true,
        reloadRequired: true
      });

      expect(mockConfig.markSessionReloadRequired).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'LEAVE_SETTLEMENT_DISPOSE_FAILED'
      }));
      expect(stateObj.active).toBe(false);
      expect(mockConfig.clearPlaybackStateForLeave).not.toHaveBeenCalled();
      expect(mockConfig.resetSessionState).not.toHaveBeenCalled();
      expect(mockConfig.closeStream).toHaveBeenCalledTimes(1);
      expect(mockConfig.teardownActionBridge).toHaveBeenCalledTimes(1);
      expect(mockConfig.clearSeatClaim).toHaveBeenCalledWith('ABC');
      expect(mockConfig.emitStatus).toHaveBeenCalledWith(expect.stringContaining('再読み込み'), true);
    });

    test('退出リクエストが失敗した場合', async () => {
      stateObj.roomId = 'ABC';
      stateObj.seatKey = 'black';

      mockConfig.requestJson.mockRejectedValue(new Error('Network error'));

      const result = await controller.leaveRoom();

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('LEAVE_REQUEST_FAILED');
      expect(mockConfig.advanceSessionEpoch).toHaveBeenCalledTimes(1);
      expect(mockConfig.advanceSessionEpoch).toHaveBeenCalledWith('session_leave_requested');
      expect(mockConfig.cancelSessionReadRequests).toHaveBeenCalledTimes(1);
      expect(mockConfig.closeStream).toHaveBeenCalledTimes(1);
      expect(mockConfig.openStream).toHaveBeenCalledWith({ reconnect: true });
      expect(mockConfig.disposePresentationTimeline).not.toHaveBeenCalled();
      expect(mockConfig.clearPlaybackStateForLeave).not.toHaveBeenCalled();
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
