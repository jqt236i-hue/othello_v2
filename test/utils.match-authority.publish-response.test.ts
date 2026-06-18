import * as MatchAuthority from '../utils/match-authority.js';

describe('match authority publish response payload', () => {
  test('normalizes playback diagnostics warnings for network debug payloads', () => {
    const diagnostics = {
      rawBoardVisualCount: 1,
      boardVisualPlaybackCount: 0,
      warnings: ['', 'raw board visual count 1 exceeds board playback count 0']
    };

    expect(MatchAuthority.getPlaybackAssemblyWarnings(diagnostics)).toEqual([
      'raw board visual count 1 exceeds board playback count 0'
    ]);
    expect(MatchAuthority.toDebugPlaybackDiagnostics(diagnostics, false)).toBeNull();
    expect(MatchAuthority.toDebugPlaybackDiagnostics(diagnostics, true)).toEqual(diagnostics);
  });

  test('buildPublicSeatMetadata normalizes seat booleans, player names, and hand skin ids together', () => {
    expect(MatchAuthority.buildPublicSeatMetadata({
      seats: { black: 1, white: 0 },
      seatNames: { black: '  Alpha   Beta  ', white: '   ' },
      seatHandSkins: { black: '  fancy-hand  ', white: null }
    })).toEqual({
      seats: { black: true, white: false },
      seatNames: { black: 'Alpha B', white: '' },
      seatHandSkins: { black: 'fancy-hand', white: '' }
    });
  });

  test('buildPublicSeatMetadata upgrades legacy renamed gacha ids', () => {
    expect(MatchAuthority.buildPublicSeatMetadata({
      seats: { black: true, white: true },
      seatNames: { black: 'くろ', white: 'しろ' },
      seatHandSkins: { black: ' gacha__n__hand-swap ', white: 'gacha__n__hand.png' }
    })).toEqual({
      seats: { black: true, white: true },
      seatNames: { black: 'くろ', white: 'しろ' },
      seatHandSkins: { black: 'gacha__n__陽気な手', white: 'gacha__n__人の手' }
    });
  });

  test('normalizes publishMeta and preserves room context', () => {
    const playbackEvents = [{ type: 'observer_bubble', phase: 2, targets: [{ player: 'black', text: 'ok' }] }];
    const effectLogs = ['黒: 反転保護を付与', '黒: 反転保護を付与', ''];
    const payload = MatchAuthority.buildPublishResponsePayload({
      ok: false,
      roomId: 'abc',
      stateVersion: '12',
      snapshot: { stateVersion: 12, gameState: {}, cardState: {} },
      seats: { black: 1, white: 0 },
      seatNames: { black: '  Alpha   Beta  ', white: '  しろ  ' },
      seatHandSkins: { black: '  fancy-hand  ', white: null },
      roomDeck: null,
      roomBoardConfig: { rows: 7, cols: 9 },
      networkDebugEnabled: true,
      turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black' },
      playbackEvents,
      effectLogs,
      serverTime: 12345,
      rejectedReason: 'VERSION_MISMATCH',
      publishMeta: {
        kind: 'REJECTED',
        operationId: ' op_same_turn ',
        actionType: 'PLACE',
        receivedBaseVersion: '11',
        authoritativeStateVersion: '12',
        rejectedReason: 'VERSION_MISMATCH'
      }
    });

    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      roomId: 'ABC',
      stateVersion: 12,
      rejectedReason: 'VERSION_MISMATCH',
      seats: { black: true, white: false },
      seatNames: { black: 'Alpha B', white: 'しろ' },
      seatHandSkins: { black: 'fancy-hand', white: '' },
      networkDebugEnabled: true,
      roomBoardConfig: {
        rows: 7,
        cols: 9
      },
      playbackEvents,
      effectLogs: ['黒: 反転保護を付与'],
      serverTime: 12345,
      publishMeta: {
        kind: 'rejected',
        operationId: 'op_same_turn',
        actionType: 'place',
        receivedBaseVersion: 11,
        authoritativeStateVersion: 12,
        replayedStateVersion: null,
        rejectedReason: 'VERSION_MISMATCH'
      }
    }));
  });

  test('omits empty publishMeta payloads', () => {
    const payload = MatchAuthority.buildPublishResponsePayload({
      ok: true,
      roomId: 'ABC',
      stateVersion: 5,
      snapshot: { stateVersion: 5, gameState: {}, cardState: {} },
      seats: { black: true, white: true },
      seatNames: { black: 'くろ', white: 'しろ' },
      roomDeck: null,
      networkDebugEnabled: false,
      turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black' },
      serverTime: 999,
      publishMeta: {}
    });

    expect(payload.publishMeta).toBeUndefined();
  });

  test('omits roomBoardConfig when caller did not provide it', () => {
    const payload = MatchAuthority.buildPublishResponsePayload({
      ok: true,
      roomId: 'ABC',
      stateVersion: 5,
      snapshot: { stateVersion: 5, gameState: {}, cardState: {} },
      seats: { black: true, white: true },
      seatNames: { black: 'くろ', white: 'しろ' },
      roomDeck: null,
      networkDebugEnabled: false,
      turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black' },
      serverTime: 999
    });

    expect(Object.prototype.hasOwnProperty.call(payload, 'roomBoardConfig')).toBe(false);
  });

  test('resolveRoomBoardConfig prefers explicit room config and falls back to snapshot board shape', () => {
    expect(MatchAuthority.resolveRoomBoardConfig({
      roomBoardConfig: { rows: 7, cols: 9 }
    })).toMatchObject({
      rows: 7,
      cols: 9,
      standard8x8: false
    });

    expect(MatchAuthority.resolveRoomBoardConfig({
      roomBoardConfig: null,
      snapshot: {
        gameState: {
          board: Array.from({ length: 6 }, () => Array.from({ length: 10 }, () => 0))
        }
      }
    })).toMatchObject({
      rows: 6,
      cols: 10,
      standard8x8: false
    });
  });

  test('buildPublicSnapshot adds authority metadata for viewer-projected snapshots', () => {
    const snapshot = MatchAuthority.buildPublicSnapshot({
      stateVersion: 7,
      updatedAt: 1234,
      snapshot: {
        gameState: {},
        cardState: {
          hands: {
            black: ['b1'],
            white: ['w1']
          }
        }
      }
    }, 'white');

    expect(snapshot._meta).toEqual({
      authority: 'server',
      version: 7,
      projectedForSeat: 'white',
      turnStartReconciled: true,
      projectedSnapshotHash: expect.stringMatching(/^fnv1a32:/)
    });
    expect(snapshot.stateVersion).toBe(7);
    expect(snapshot.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
    expect(snapshot.cardState.hands.white).toEqual(['w1']);
  });

  test('buildPublicSnapshot strips transient presentation queues and result-only UI flags', () => {
    const snapshot = MatchAuthority.buildPublicSnapshot({
      stateVersion: 7,
      updatedAt: 1234,
      snapshot: {
        gameState: {
          __resultShown: true
        },
        cardState: {
          hands: {
            black: ['b1'],
            white: ['w1']
          },
          presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }],
          _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] }],
          _currentActionMeta: { actionId: 'local-only' }
        }
      }
    }, 'black');

    expect(snapshot.gameState.__resultShown).toBeUndefined();
    expect(snapshot.cardState.presentationEvents).toEqual([]);
    expect(snapshot.cardState._presentationEventsPersist).toEqual([]);
    expect(snapshot.cardState._currentActionMeta).toBeUndefined();
  });

  test('buildSnapshotPayloadFromRoom reuses shared room envelope fields', () => {
    const payload = MatchAuthority.buildSnapshotPayloadFromRoom({
      roomId: 'abc',
      stateVersion: 7,
      seats: { black: true, white: false },
      seatNames: { black: '  Alpha   Beta  ', white: '  ' },
      seatHandSkins: { black: ' fancy-hand ', white: '' }
    }, {
      snapshot: { stateVersion: 7, gameState: {}, cardState: {} },
      roomDeck: { mode: 'shared', deckCode: '', deckSize: 30, source: 'room' },
      roomBoardConfig: { rows: 8, cols: 8, standard8x8: true },
      networkDebugEnabled: false,
      turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black' },
      playbackEvents: [{ type: 'observer_bubble', phase: 1 }],
      effectLogs: ['黒: ok', '', '黒: ok'],
      operationId: ' op_stream_echo ',
      actionType: 'place',
      playerKey: 'white',
      serverTime: 321
    });

    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      roomId: 'ABC',
      stateVersion: 7,
      seats: { black: true, white: false },
      seatNames: { black: 'Alpha B', white: '' },
      seatHandSkins: { black: 'fancy-hand', white: '' },
      playbackEvents: [{ type: 'observer_bubble', phase: 1 }],
      effectLogs: ['黒: ok'],
      operationId: 'op_stream_echo',
      actionType: 'place',
      playerKey: 'white',
      serverTime: 321
    }));
  });

  test('buildSnapshotPayloadFromRoom preserves auto pass notice metadata', () => {
    const payload = MatchAuthority.buildSnapshotPayloadFromRoom({
      roomId: 'ABC',
      stateVersion: 4
    }, {
      autoPassNotice: {
        playerKey: 'black',
        reason: 'no_legal_moves_or_usable_cards'
      }
    });

    expect(payload.autoPassNotice).toEqual({
      playerKey: 'black',
      reason: 'no_legal_moves_or_usable_cards'
    });
  });

  test('sanitizePendingSelectionActionForAuthority strips redundant use-card fields once authority already committed the card', () => {
    const action = {
      type: 'place',
      playerKey: 'white',
      temptTarget: { row: 3, col: 3 },
      useCardId: 'tempt_01',
      useCardOwnerKey: 'white',
      pendingSelectionState: {
        type: 'TEMPT_WILL',
        stage: 'selectTarget',
        cardId: 'tempt_01',
        pendingEffectId: 'pending_7_1'
      }
    };
    const sanitized = MatchAuthority.sanitizePendingSelectionActionForAuthority({
      cardState: {
        hands: { black: [], white: [] },
        discard: ['tempt_01'],
        hasUsedCardThisTurnByPlayer: { black: false, white: true },
        pendingEffectByPlayer: {
          black: null,
          white: {
            type: 'TEMPT_WILL',
            stage: 'selectTarget',
            cardId: 'tempt_01',
            pendingEffectId: 'pending_7_1'
          }
        }
      }
    }, 'white', action);

    expect(action.useCardId).toBe('tempt_01');
    expect(action.useCardOwnerKey).toBe('white');
    expect(sanitized).toEqual({
      type: 'place',
      playerKey: 'white',
      temptTarget: { row: 3, col: 3 },
      pendingSelectionState: {
        type: 'TEMPT_WILL',
        stage: 'selectTarget',
        cardId: 'tempt_01',
        pendingEffectId: 'pending_7_1'
      }
    });
  });

  test('applySeatLeaveToRoom clears joined seat and rotates its token through shared lifecycle helper', () => {
    const room = {
      seats: { black: true, white: true },
      seatNames: { black: 'くろ', white: 'しろ' },
      seatHandSkins: { black: 'hand-black', white: 'hand-white' },
      seatTokens: { black: 'old-token', white: 'token-white' },
      updatedAt: 1
    };

    const result = MatchAuthority.applySeatLeaveToRoom(room, 'black', {
      makeSeatToken: () => 'new-token',
      now: 999
    });

    expect(result).toEqual(expect.objectContaining({
      seatKey: 'black',
      seatToken: 'new-token',
      updatedAt: 999
    }));
    expect(room).toEqual(expect.objectContaining({
      seats: { black: false, white: true },
      seatNames: { black: '', white: 'しろ' },
      seatHandSkins: { black: '', white: 'hand-white' },
      seatTokens: { black: 'new-token', white: 'token-white' },
      updatedAt: 999
    }));
    expect(room.seatHandSkins.black).toBe('');
    expect(MatchAuthority.shouldDisposeRoom(room, 0)).toBe(false);
    expect(MatchAuthority.shouldDisposeRoom({
      seats: { black: false, white: false }
    }, 0)).toBe(true);
  });

  test('resolveSeatForJoin reuses shared seat-token and open-seat precedence', () => {
    const room = {
      seats: { black: true, white: false },
      seatTokens: { black: 'token-black', white: 'token-white' }
    };

    expect(MatchAuthority.resolveSeatForJoin(room, 'black', 'token-black')).toBe('black');
    expect(MatchAuthority.resolveSeatForJoin(room, 'black', 'wrong-token')).toBe(null);
    expect(MatchAuthority.resolveSeatForJoin(room, null, 'token-black')).toBe('black');
    expect(MatchAuthority.resolveSeatForJoin(room, null, '')).toBe('white');
  });

  test('validatePendingSelectionPublish rejects stale pendingEffectId mismatch', () => {
    const result = MatchAuthority.validatePendingSelectionPublish({
      cardState: {
        pendingEffectByPlayer: {
          black: {
            type: 'TEMPT_WILL',
            pendingEffectId: 'pending_7_2'
          },
          white: null
        }
      }
    }, 'black', {
      type: 'place',
      pendingSelectionState: {
        type: 'TEMPT_WILL',
        pendingEffectId: 'pending_7_1'
      }
    });

    expect(result).toEqual({
      ok: false,
      rejectedReason: 'STALE_PENDING_SELECTION'
    });
  });

  test('appendAuthorityLog keeps a bounded structured history', () => {
    const room = { roomId: 'abc', authorityLog: [] };

    MatchAuthority.appendAuthorityLog(room, {
      kind: 'publish_accepted',
      operationId: 'op_1',
      actionType: 'place',
      baseVersion: 3,
      committedVersion: 4,
      stateHashBefore: 'before',
      stateHashAfter: 'after',
      pendingEffectId: 'pending_3_1',
      dedupeOutcome: 'accepted'
    }, 1);

    MatchAuthority.appendAuthorityLog(room, {
      kind: 'timeout_applied',
      actionType: 'timeout_pass',
      committedVersion: 5,
      timeoutReason: 'turn_deadline_expired'
    }, 1);

    expect(room.authorityLog).toHaveLength(1);
    expect(room.authorityLog[0]).toEqual(expect.objectContaining({
      kind: 'timeout_applied',
      matchId: 'ABC',
      actionType: 'timeout_pass',
      committedVersion: 5,
      timeoutReason: 'turn_deadline_expired'
    }));
  });

  test('classifies version rejection reasons by received vs authoritative version', () => {
    expect(MatchAuthority.classifyVersionRejectionReason(10, 11)).toBe('VERSION_AHEAD');
    expect(MatchAuthority.classifyVersionRejectionReason(12, 11)).toBe('VERSION_BEHIND');
    expect(MatchAuthority.classifyVersionRejectionReason(null, 11)).toBe('VERSION_GAP');
    expect(MatchAuthority.classifyVersionRejectionReason(11, 11)).toBe('VERSION_MISMATCH');
    expect(MatchAuthority.isVersionRejectionReason('VERSION_AHEAD')).toBe(true);
    expect(MatchAuthority.isVersionRejectionReason('VERSION_BEHIND')).toBe(true);
    expect(MatchAuthority.isVersionRejectionReason('VERSION_GAP')).toBe(true);
    expect(MatchAuthority.isVersionRejectionReason('OTHER')).toBe(false);
  });

  test('classifies seat-token rejection reasons by token presence', () => {
    expect(MatchAuthority.classifySeatTokenRejectionReason('valid-token')).toBe('SEAT_TOKEN_MISMATCH');
    expect(MatchAuthority.classifySeatTokenRejectionReason('   ')).toBe('SEAT_TOKEN_REQUIRED');
    expect(MatchAuthority.classifySeatTokenRejectionReason(null)).toBe('SEAT_TOKEN_REQUIRED');
  });

  test('appends effect logs through shared normalization rules', () => {
    expect(MatchAuthority.appendEffectLogMessages(
      ['黒: 反転保護を付与', '黒: 反転保護を付与', ''],
      null,
      ['白: 破壊を無効化', '白: 破壊を無効化'],
      ['黒: 反転保護を付与']
    )).toEqual([
      '黒: 反転保護を付与',
      '白: 破壊を無効化',
      '黒: 反転保護を付与'
    ]);
  });

  test('builds network card-use effect logs from shared card display resolution', () => {
    const cardLogic = {
      getCardDef: jest.fn((cardId) => (cardId === 'guard_01' ? { name: '守りの意思' } : null))
    };

    expect(MatchAuthority.buildNetworkCardUseEffectLogs({
      type: 'use_card',
      useCardId: 'guard_01'
    }, 'white', cardLogic)).toEqual(['白がカードを使用: 守りの意思']);

    expect(MatchAuthority.buildNetworkCardUseEffectLogs({
      actionType: 'use_card',
      cardId: 'unknown_card'
    }, 'black', cardLogic)).toEqual(['黒がカードを使用: unknown_card']);

    expect(MatchAuthority.buildNetworkCardUseEffectLogs({ type: 'place', useCardId: 'guard_01' }, 'white', cardLogic)).toEqual([]);
  });

  test('collects pipeline effect logs through shared normalization and adapter isolation', () => {
    const adapter = {
      mapEffectLogsFromPipeline: jest.fn(() => ['黒: 追加', '黒: 追加', '', '白: 反応'])
    };

    expect(MatchAuthority.collectPipelineEffectLogMessages(
      [{ type: 'raw' }],
      [{ type: 'presentation' }],
      'black',
      adapter
    )).toEqual(['黒: 追加', '白: 反応']);

    expect(MatchAuthority.collectPipelineEffectLogMessages([], [], 'black', {
      mapEffectLogsFromPipeline: () => {
        throw new Error('adapter failed');
      }
    })).toEqual([]);
  });

  test('builds combined network action effect logs from card-use and pipeline sources', () => {
    const cardLogic = {
      getCardDef: jest.fn((cardId) => (cardId === 'treasure_01' ? { name: '宝箱' } : null))
    };
    const adapter = {
      mapEffectLogsFromPipeline: jest.fn(() => ['黒: 追加効果', '黒: 追加効果'])
    };

    expect(MatchAuthority.buildNetworkActionEffectLogs(
      { type: 'use_card', useCardId: 'treasure_01' },
      'black',
      cardLogic,
      [{ type: 'raw' }],
      [{ type: 'presentation' }],
      adapter
    )).toEqual([
      '黒がカードを使用: 宝箱',
      '黒: 追加効果'
    ]);
  });

  test('normalizes debug fill hand payload options from params before action fallback', () => {
    expect(MatchAuthority.isNetworkDebugFillHandPayload({
      actionType: 'DEBUG_FILL_HAND'
    })).toBe(true);

    expect(MatchAuthority.resolveNetworkDebugFillHandOptions({
      action: {
        type: 'debug_fill_hand',
        fillWhite: true,
        replaceExisting: false,
        cardIds: ['fallback'],
        charge: 3,
        chargeByPlayer: { black: 1, white: 2 }
      },
      params: {
        replaceExisting: true,
        cardIds: ['override'],
        charge: 7,
        chargeByPlayer: { black: '8', white: '9' }
      }
    })).toEqual({
      fillWhite: true,
      replaceExisting: true,
      cardIds: ['override'],
      charge: 7,
      chargeByPlayer: { black: 8, white: 9 }
    });
  });

  test('merges card state defaults and derives stable turn-start seeds in shared authority code', () => {
    expect(MatchAuthority.mergeWithDefaultShape({
      charge: { black: 0, white: 0 },
      hands: { black: [], white: [] },
      selectedCardId: null
    }, {
      charge: { black: 5 },
      hands: { black: ['guard_01'] },
      extra: { ok: true }
    })).toEqual({
      charge: { black: 5, white: 0 },
      hands: { black: ['guard_01'], white: [] },
      selectedCardId: null,
      extra: { ok: true }
    });

    const snapshot = {
      stateVersion: 12,
      gameState: { turnNumber: 4 },
      cardState: { turnIndex: 3 }
    };
    const first = MatchAuthority.createTurnStartSeed({ seed: 1234 }, snapshot, 'black');
    expect(MatchAuthority.createTurnStartSeed({ seed: 1234 }, snapshot, 'black')).toBe(first);
    expect(MatchAuthority.createTurnStartSeed({ seed: 1234 }, snapshot, 'white')).not.toBe(first);
    expect(MatchAuthority.createTurnStartSeed({ seed: 1234 }, {
      ...snapshot,
      stateVersion: 13
    }, 'black')).not.toBe(first);
  });

  test('treats blank operationId as missing after normalization', () => {
    expect(MatchAuthority.hasRequiredOperationId(' op_same_turn ')).toBe(true);
    expect(MatchAuthority.hasRequiredOperationId('   ')).toBe(false);
    expect(MatchAuthority.hasRequiredOperationId(null)).toBe(false);
  });

  test('tracks recent accepted operations without losing lastAccepted compatibility', () => {
    const room = {
      lastAcceptedOperationBySeat: {
        black: { operationId: 'op_black_1', stateVersion: 1, updatedAt: 10 },
        white: null
      }
    };

    expect(MatchAuthority.findAcceptedOperationBySeat(room, 'black', 'op_black_1')).toEqual({
      operationId: 'op_black_1',
      stateVersion: 1,
      updatedAt: 10
    });

    MatchAuthority.rememberAcceptedOperationBySeat(room, 'black', {
      operationId: 'op_black_2',
      stateVersion: 3,
      updatedAt: 30
    });

    expect(MatchAuthority.findAcceptedOperationBySeat(room, 'black', 'op_black_1')).toEqual({
      operationId: 'op_black_1',
      stateVersion: 1,
      updatedAt: 10
    });
    expect(MatchAuthority.findAcceptedOperationBySeat(room, 'black', 'op_black_2')).toEqual({
      operationId: 'op_black_2',
      stateVersion: 3,
      updatedAt: 30
    });
    expect(room.acceptedOperationHistoryBySeat.black.map((entry) => entry.operationId)).toEqual(['op_black_1', 'op_black_2']);
    expect(room.lastAcceptedOperationBySeat.black).toEqual({
      operationId: 'op_black_2',
      stateVersion: 3,
      updatedAt: 30
    });
  });

  test('resolveAcceptedOperation falls back to legacy accepted-operation entry and shared response options normalize publishMeta', () => {
    expect(MatchAuthority.resolveAcceptedOperation(
      { acceptedOperationHistoryBySeat: { black: [], white: [] } },
      'black',
      ' op_black_legacy ',
      { operationId: 'op_black_legacy', stateVersion: 9, updatedAt: 90 }
    )).toEqual({
      operationId: 'op_black_legacy',
      stateVersion: 9,
      updatedAt: 90
    });

    expect(MatchAuthority.buildPublishResponseOptions({
      ok: false,
      rejectedReason: 'VERSION_BEHIND',
      publishKind: 'rejected',
      operationId: ' op_black_legacy ',
      actionType: 'PLACE',
      receivedBaseVersion: '8',
      authoritativeStateVersion: '9'
    })).toEqual({
      ok: false,
      rejectedReason: 'VERSION_BEHIND',
      publishMeta: {
        kind: 'rejected',
        operationId: 'op_black_legacy',
        actionType: 'place',
        receivedBaseVersion: 8,
        authoritativeStateVersion: 9,
        replayedStateVersion: null,
        rejectedReason: 'VERSION_BEHIND'
      }
    });
  });

  test('replays buffered SSE events after Last-Event-ID with viewer-specific snapshots', () => {
    let buffer = [];
    buffer = MatchAuthority.appendBufferedSseEvent(buffer, {
      eventId: 'ROOM_1_1',
      eventName: 'heartbeat',
      payload: { roomId: 'ROOM', stateVersion: 1 }
    });
    buffer = MatchAuthority.appendBufferedSseEvent(buffer, {
      eventId: 'ROOM_2_2',
      eventName: 'snapshot',
      payloadByViewer: {
        black: { roomId: 'ROOM', stateVersion: 2, snapshot: { stateVersion: 2, cardState: { hands: { black: ['b1'], white: ['__hidden_hand__:white:0'] } } } },
        white: { roomId: 'ROOM', stateVersion: 2, snapshot: { stateVersion: 2, cardState: { hands: { black: ['__hidden_hand__:black:0'], white: ['w1'] } } } }
      }
    });

    const replay = MatchAuthority.getBufferedSseReplayEvents(buffer, 'ROOM_1_1', 'white');
    expect(replay).toEqual([
      {
        eventId: 'ROOM_2_2',
        eventName: 'snapshot',
        payload: {
          roomId: 'ROOM',
          stateVersion: 2,
          sseReplay: {
            replayed: true,
            index: 1,
            count: 1,
            remaining: 0,
            lastEventId: 'ROOM_1_1'
          },
          snapshot: {
            stateVersion: 2,
            cardState: {
              hands: {
                black: ['__hidden_hand__:black:0'],
                white: ['w1']
              }
            }
          }
        },
        replayIndex: 1,
        replayCount: 1,
        replayRemaining: 0
      }
    ]);
  });

  test('finds buffered snapshot payload for current state version and viewer', () => {
    let buffer = [];
    buffer = MatchAuthority.appendBufferedSseEvent(buffer, {
      eventId: 'ROOM_1_1',
      eventName: 'snapshot',
      payloadByViewer: {
        black: { roomId: 'ROOM', stateVersion: 1, playbackEvents: [{ type: 'old' }] },
        white: { roomId: 'ROOM', stateVersion: 1, playbackEvents: [] }
      }
    });
    buffer = MatchAuthority.appendBufferedSseEvent(buffer, {
      eventId: 'ROOM_2_2',
      eventName: 'snapshot',
      payloadByViewer: {
        black: { roomId: 'ROOM', stateVersion: 2, playbackEvents: [{ type: 'move' }] },
        white: { roomId: 'ROOM', stateVersion: 2, playbackEvents: [{ type: 'hidden_safe' }] }
      }
    });

    expect(MatchAuthority.getBufferedSnapshotPayloadForStateVersion(buffer, 2, 'black')).toEqual(
      expect.objectContaining({
        stateVersion: 2,
        playbackEvents: [{ type: 'move' }]
      })
    );
    expect(MatchAuthority.getBufferedSnapshotPayloadForStateVersion(buffer, 3, 'black')).toBeNull();
  });

  test('returns null when Last-Event-ID is not in the buffer', () => {
    const buffer = MatchAuthority.appendBufferedSseEvent([], {
      eventId: 'ROOM_5_8',
      eventName: 'heartbeat',
      payload: { roomId: 'ROOM', stateVersion: 5 }
    });

    expect(MatchAuthority.getBufferedSseReplayEvents(buffer, 'ROOM_4_7', 'black')).toBeNull();
  });
});

describe('match authority FATE_WILL controller helpers', () => {
  function makeSnapshot({ currentPlayer, fateWillControllerByTurnOwner }) {
    return {
      gameState: { currentPlayer },
      cardState: { fateWillControllerByTurnOwner: fateWillControllerByTurnOwner || { black: null, white: null } }
    };
  }

  test('getFateWillControllerKey returns controller key when set', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'white', fateWillControllerByTurnOwner: { black: null, white: 'black' } });
    expect(MatchAuthority.getFateWillControllerKey(snapshot, 'white')).toBe('black');
    expect(MatchAuthority.getFateWillControllerKey(snapshot, 'black')).toBeNull();
  });

  test('getFateWillControllerKey returns null when not set', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'black' });
    expect(MatchAuthority.getFateWillControllerKey(snapshot, 'black')).toBeNull();
    expect(MatchAuthority.getFateWillControllerKey(snapshot, 'white')).toBeNull();
  });

  test('isFateWillControllerForCurrentTurn returns true for controller during controlled turn', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'white', fateWillControllerByTurnOwner: { black: null, white: 'black' } });
    expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'black')).toBe(true);
  });

  test('isFateWillControllerForCurrentTurn returns false for turn owner themselves', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'white', fateWillControllerByTurnOwner: { black: null, white: 'black' } });
    expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'white')).toBe(false);
  });

  test('isFateWillControllerForCurrentTurn returns false when controller map is inactive', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'black' });
    expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'white')).toBe(false);
  });

  test('isFateWillControllerForCurrentTurn returns false when fateWill set but it is not currently that turn', () => {
    // fateWillControllerByTurnOwner['white'] = 'black' is set, but currentPlayer is 'black' (not white's turn yet)
    const snapshot = makeSnapshot({ currentPlayer: 'black', fateWillControllerByTurnOwner: { black: null, white: 'black' } });
    expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'black')).toBe(false);
  });

  test('projectSnapshotForViewer reveals controlled hand to FATE_WILL controller during controlled turn', () => {
    const snapshot = {
      gameState: { currentPlayer: 'white' },
      cardState: {
        hands: { black: ['b1', 'b2'], white: ['w1', 'w2'] },
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      }
    };
    // Black is the controller for white's turn - black should see white's hand
    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black', { stateVersion: 5 });
    expect(blackView.cardState.hands.black).toEqual(['b1', 'b2']);
    expect(blackView.cardState.hands.white).toEqual(['w1', 'w2']);
  });

  test('projectSnapshotForViewer preserves victim hand selection for FATE_WILL controller during controlled turn', () => {
    const snapshot = {
      gameState: { currentPlayer: 'white' },
      cardState: {
        hands: { black: ['b1'], white: ['w1', 'w2'] },
        selectedCardId: 'w2',
        selectedCardOwnerKey: 'white',
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      }
    };

    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black', { stateVersion: 5 });

    expect(blackView.cardState.selectedCardId).toBe('w2');
    expect(blackView.cardState.selectedCardOwnerKey).toBe('white');
  });

  test('projectSnapshotForViewer reveals victim CONDEMN_WILL offers to FATE_WILL controller during controlled turn', () => {
    const snapshot = {
      gameState: { currentPlayer: 'white' },
      cardState: {
        hands: { black: ['b1', 'b2'], white: ['w1'] },
        pendingEffectByPlayer: {
          black: null,
          white: {
            type: 'CONDEMN_WILL',
            stage: 'selectTarget',
            offers: [
              { handIndex: 0, cardId: 'b1' },
              { handIndex: 1, cardId: 'b2' }
            ]
          }
        },
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      }
    };

    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black', { stateVersion: 5 });

    expect(blackView.cardState.pendingEffectByPlayer.white.offers).toEqual([
      { handIndex: 0, cardId: 'b1' },
      { handIndex: 1, cardId: 'b2' }
    ]);
  });

  test('projectSnapshotForViewer does NOT reveal hand to controller outside of controlled turn', () => {
    // Same fateWill state, but currentPlayer is 'black' (not white's turn)
    const snapshot = {
      gameState: { currentPlayer: 'black' },
      cardState: {
        hands: { black: ['b1', 'b2'], white: ['w1', 'w2'] },
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      }
    };
    // Black is the controller for white's upcoming turn, but it's black's turn now - white's hand stays hidden
    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black', { stateVersion: 5 });
    expect(blackView.cardState.hands.black).toEqual(['b1', 'b2']);
    expect(blackView.cardState.hands.white).toEqual([
      '__hidden_hand__:white:0',
      '__hidden_hand__:white:1'
    ]);
  });

  test('projectSnapshotForViewer does NOT reveal controlled hand to non-controller observers', () => {
    // In a theoretical 3-seat scenario, or just checking null viewer
    const snapshot = {
      gameState: { currentPlayer: 'white' },
      cardState: {
        hands: { black: ['b1'], white: ['w1'] },
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      }
    };
    // Viewer is white (turn owner) - sees own hand, black's hidden
    const whiteView = MatchAuthority.projectSnapshotForViewer(snapshot, 'white', { stateVersion: 5 });
    expect(whiteView.cardState.hands.white).toEqual(['w1']);
    expect(whiteView.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);

    // Null viewer - both hands hidden
    const nullView = MatchAuthority.projectSnapshotForViewer(snapshot, null, { stateVersion: 5 });
    expect(nullView.cardState.hands.white).toEqual(['__hidden_hand__:white:0']);
    expect(nullView.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
  });
});
