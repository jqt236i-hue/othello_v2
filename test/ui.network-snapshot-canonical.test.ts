function createCompleteLegacySnapshot(overrides: Record<string, any> = {}) {
  return {
    ...overrides,
    gameState: {
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion: { cells: [] },
      ...(overrides.gameState || {})
    },
    cardState: {
      markers: [],
      ...(overrides.cardState || {})
    }
  };
}

describe('NetworkSnapshotCanonicalModule', () => {
  let canonical;

  beforeEach(() => {
    jest.resetModules();
    canonical = require('../ui/network/snapshot-canonical.js');
  });

  describe('normalizeSeatKey', () => {
    test('blackを正規化する', () => {
      expect(canonical.normalizeSeatKey('black')).toBe('black');
      expect(canonical.normalizeSeatKey('BLACK')).toBe('black');
      expect(canonical.normalizeSeatKey(' Black ')).toBe('black');
    });

    test('whiteを正規化する', () => {
      expect(canonical.normalizeSeatKey('white')).toBe('white');
      expect(canonical.normalizeSeatKey('WHITE')).toBe('white');
      expect(canonical.normalizeSeatKey(' White ')).toBe('white');
    });

    test('無効な値はnullを返す', () => {
      expect(canonical.normalizeSeatKey('invalid')).toBe(null);
      expect(canonical.normalizeSeatKey('')).toBe(null);
      expect(canonical.normalizeSeatKey(null)).toBe(null);
    });
  });

  describe('getSnapshotMeta', () => {
    test('正しいメタデータを抽出する', () => {
      const snapshot = {
        _meta: {
          authority: 'server',
          version: 10,
          projectedForSeat: 'black',
          turnStartReconciled: true,
          projectedSnapshotHash: 'abc123'
        }
      };

      const meta = canonical.getSnapshotMeta(snapshot);

      expect(meta).toEqual({
        authority: 'server',
        version: 10,
        boardContractVersion: null,
        projectedForSeat: 'black',
        viewerRole: null,
        turnStartReconciled: true,
        projectedSnapshotHash: 'abc123'
      });
    });

    test('メタデータがない場合はnull', () => {
      expect(canonical.getSnapshotMeta({})).toBe(null);
      expect(canonical.getSnapshotMeta(null)).toBe(null);
    });

    test('versionのフォールバック処理', () => {
      expect(canonical.getSnapshotMeta({ _meta: { version: null } }).version).toBe(null);
      expect(canonical.getSnapshotMeta({ _meta: { version: '' } }).version).toBe(null);
      expect(canonical.getSnapshotMeta({ _meta: { version: 'invalid' } }).version).toBe(null);
      expect(canonical.getSnapshotMeta({ _meta: { version: 5 } }).version).toBe(5);
    });
  });

  describe('getSnapshotVersion', () => {
    test('_meta.versionを優先する', () => {
      const snapshot = {
        stateVersion: 5,
        _meta: { version: 10 }
      };
      expect(canonical.getSnapshotVersion(snapshot)).toBe(10);
    });

    test('_metaがない場合はstateVersionを使用', () => {
      expect(canonical.getSnapshotVersion({ stateVersion: 5 })).toBe(5);
    });

    test('無効な場合はnull', () => {
      expect(canonical.getSnapshotVersion({})).toBe(null);
    });
  });

  describe('inspectAuthoritativeSnapshot', () => {
    test('有効なサーバースナップショットを承認する', () => {
      const snapshot = createCompleteLegacySnapshot({
        _meta: {
          authority: 'server',
          version: 10
        }
      });

      const result = canonical.inspectAuthoritativeSnapshot(snapshot, {
        currentAppliedVersion: 5
      });

      expect(result.ok).toBe(true);
      expect(result.meta.authority).toBe('server');
      expect(result.version).toBe(10);
    });

    test('メタデータがない場合は拒否', () => {
      const result = canonical.inspectAuthoritativeSnapshot({}, {});

      expect(result.ok).toBe(false);
      expect(result.rejectionType).toBe('missing_authority_metadata');
    });

    test('authorityがserverでない場合は拒否', () => {
      const snapshot = {
        _meta: { authority: 'client', version: 10 }
      };

      const result = canonical.inspectAuthoritativeSnapshot(snapshot, {});

      expect(result.ok).toBe(false);
      expect(result.rejectionType).toBe('invalid_authority');
    });

    test('プロジェクション不一致を検出', () => {
      const snapshot = {
        _meta: {
          authority: 'server',
          version: 10,
          projectedForSeat: 'white'
        }
      };

      const result = canonical.inspectAuthoritativeSnapshot(snapshot, {
        localSeatKey: 'black'
      });

      expect(result.ok).toBe(false);
      expect(result.rejectionType).toBe('projection_mismatch');
    });

    test('自席手札がhidden化されたsnapshotを拒否', () => {
      const snapshot = {
        _meta: {
          authority: 'server',
          version: 10,
          projectedForSeat: 'white'
        },
        cardState: {
          hands: {
            black: ['__hidden_hand__:black:0'],
            white: ['__hidden_hand__:white:0']
          }
        }
      };

      const result = canonical.inspectAuthoritativeSnapshot(snapshot, {
        localSeatKey: 'white'
      });

      expect(result.ok).toBe(false);
      expect(result.rejectionType).toBe('own_hand_hidden');
    });

    test('v2盤面契約を厳格検証する', () => {
      const valid = {
        _meta: {
          authority: 'server',
          version: 10,
          boardContractVersion: 2
        },
        gameState: {
          board: Array.from({ length: 4 }, () => Array(4).fill(0)),
          boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
          boardExpansion: {
            cells: [{ row: -1, col: 0, side: 'top', owner: -1 }]
          }
        },
        cardState: { markers: [] }
      };
      const invalid = JSON.parse(JSON.stringify(valid));
      invalid.gameState.boardExpansion.cells.push({
        row: -1,
        col: 0,
        side: 'top',
        owner: 0
      });

      expect(canonical.inspectAuthoritativeSnapshot(valid, {
        currentAppliedVersion: 5
      }).ok).toBe(true);
      expect(canonical.inspectAuthoritativeSnapshot(invalid, {
        currentAppliedVersion: 5
      })).toEqual(expect.objectContaining({
        ok: false,
        rejectionType: 'invalid_board_contract',
        telemetryType: 'snapshot_board_contract_rejected',
        telemetryDetails: expect.objectContaining({
          boardContractVersion: 2,
          reason: 'invalid_board_state'
        })
      }));
    });

    test('未知の盤面契約versionを拒否し、無version legacyは移行期間中のみ受理する', () => {
      const snapshot: any = {
        _meta: {
          authority: 'server',
          version: 10,
          boardContractVersion: 999
        },
        gameState: {
          board: Array.from({ length: 4 }, () => Array(4).fill(0)),
          boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
          boardExpansion: { cells: [] }
        },
        cardState: { markers: [] }
      };
      const legacy = JSON.parse(JSON.stringify(snapshot));
      delete legacy._meta.boardContractVersion;

      expect(canonical.inspectAuthoritativeSnapshot(snapshot, {
        currentAppliedVersion: 5
      }).rejectionType).toBe('invalid_board_contract');
      expect(canonical.inspectAuthoritativeSnapshot(legacy, {
        currentAppliedVersion: 5
      }).ok).toBe(true);
      expect(canonical.inspectAuthoritativeSnapshot(legacy, {
        currentAppliedVersion: 5,
        allowLegacyBoardContract: false
      }).rejectionType).toBe('invalid_board_contract');
    });

    test.each([
      ['numeric string', '2'],
      ['single-item array', [2]],
      ['boolean', true],
      ['null', null]
    ])('明示された非number盤面契約versionをlegacy扱いせず拒否する: %s', (_name, value) => {
      const snapshot = {
        _meta: {
          authority: 'server',
          version: 10,
          boardContractVersion: value
        },
        gameState: {
          board: Array.from({ length: 4 }, () => Array(4).fill(0)),
          boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
          boardExpansion: { cells: [] }
        },
        cardState: { markers: [] }
      };

      expect(canonical.inspectAuthoritativeSnapshot(snapshot, {
        currentAppliedVersion: 5,
        allowLegacyBoardContract: true
      })).toEqual(expect.objectContaining({
        ok: false,
        rejectionType: 'invalid_board_contract',
        telemetryType: 'snapshot_board_contract_rejected',
        telemetryDetails: expect.objectContaining({
          boardContractVersion: null,
          reason: 'unsupported_board_contract_version'
        })
      }));
    });

    test('version欠落のlegacyでも盤面を検証し、malformed boardのみ拒否する', () => {
      const validLegacy = {
        _meta: {
          authority: 'server',
          version: 10
        },
        gameState: {
          board: Array.from({ length: 4 }, () => Array(4).fill(0)),
          boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
          boardExpansion: { cells: [] }
        },
        cardState: { markers: [] }
      };
      const malformedLegacy = JSON.parse(JSON.stringify(validLegacy));
      malformedLegacy.gameState.board[3] = [0, 0, 0];

      expect(canonical.inspectAuthoritativeSnapshot(validLegacy, {
        currentAppliedVersion: 5
      })).toEqual(expect.objectContaining({
        ok: true,
        version: 10
      }));
      expect(canonical.inspectAuthoritativeSnapshot(malformedLegacy, {
        currentAppliedVersion: 5
      })).toEqual(expect.objectContaining({
        ok: false,
        rejectionType: 'invalid_board_contract',
        telemetryType: 'snapshot_board_contract_rejected',
        telemetryDetails: expect.objectContaining({
          boardContractVersion: null,
          reason: 'invalid_board_state'
        })
      }));
    });

    test('観戦者snapshotではseat projection不一致とhidden handを拒否しない', () => {
      const snapshot = createCompleteLegacySnapshot({
        _meta: {
          authority: 'server',
          version: 10,
          projectedForSeat: 'white',
          viewerRole: 'spectator'
        },
        cardState: {
          hands: {
            black: ['__hidden_hand__:black:0'],
            white: ['__hidden_hand__:white:0']
          }
        }
      });

      const result = canonical.inspectAuthoritativeSnapshot(snapshot, {
        localSeatKey: 'black'
      });

      expect(result.ok).toBe(true);
      expect(result.rejectionType).toBe(null);
      expect(result.meta.viewerRole).toBe('spectator');
    });

    test('バージョンチェックをスキップ', () => {
      const snapshot = createCompleteLegacySnapshot({
        _meta: { authority: 'server', version: 5 }
      });

      const result = canonical.inspectAuthoritativeSnapshot(snapshot, {
        currentAppliedVersion: 10,
        skipVersionChecks: true
      });

      expect(result.ok).toBe(true);
    });

    test('バージョンがnullでforceがfalseの場合は拒否', () => {
      const snapshot = createCompleteLegacySnapshot({
        _meta: { authority: 'server', version: null }
      });

      const result = canonical.inspectAuthoritativeSnapshot(snapshot, {
        force: false
      });

      expect(result.ok).toBe(false);
      expect(result.rejectionType).toBe('missing_state_version');
    });

    test('古いスナップショットを拒否', () => {
      const snapshot = createCompleteLegacySnapshot({
        _meta: { authority: 'server', version: 5 }
      });

      const result = canonical.inspectAuthoritativeSnapshot(snapshot, {
        currentAppliedVersion: 10,
        force: false
      });

      expect(result.ok).toBe(false);
      expect(result.rejectionType).toBe('stale_snapshot');
    });

    test('force=trueで古いスナップショットも承認', () => {
      const snapshot = createCompleteLegacySnapshot({
        _meta: { authority: 'server', version: 5 }
      });

      const result = canonical.inspectAuthoritativeSnapshot(snapshot, {
        currentAppliedVersion: 10,
        force: true
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('normalizeChargeDeltaEvent', () => {
    test('イベントを正規化する', () => {
      const event = {
        seq: 1,
        player: 'black',
        before: 5,
        after: 8,
        delta: 3,
        popupKind: 'board',
        anchorRow: 3,
        anchorCol: 4,
        sourceType: 'test'
      };

      const result = canonical.normalizeChargeDeltaEvent(event, 1);

      expect(result).toEqual({
        seq: 1,
        player: 'black',
        before: 5,
        after: 8,
        delta: 3,
        popupKind: 'board',
        anchorRow: 3,
        anchorCol: 4,
        sourceType: 'test'
      });
    });

    test('playerキーを正規化する', () => {
      expect(canonical.normalizeChargeDeltaEvent({ player: -1 }, 1).player).toBe('white');
      expect(canonical.normalizeChargeDeltaEvent({ player: '-1' }, 1).player).toBe('white');
      expect(canonical.normalizeChargeDeltaEvent({ player: 'white' }, 1).player).toBe('white');
      expect(canonical.normalizeChargeDeltaEvent({ player: 'black' }, 1).player).toBe('black');
    });

    test('deltaを計算する', () => {
      const result = canonical.normalizeChargeDeltaEvent({
        before: 5,
        after: 8
      }, 1);

      expect(result.delta).toBe(3);
    });

    test('無効なpopupKindは削除する', () => {
      const result = canonical.normalizeChargeDeltaEvent({
        popupKind: 'invalid',
        anchorRow: 3
      }, 1);

      expect(result.popupKind).toBeUndefined();
      expect(result.anchorRow).toBeUndefined();
    });

    test('boardポップアップで座標がない場合は削除', () => {
      const result = canonical.normalizeChargeDeltaEvent({
        popupKind: 'board'
      }, 1);

      expect(result.popupKind).toBeUndefined();
    });
  });

  describe('normalizeChargeDeltaEventList', () => {
    test('リストを正規化する', () => {
      const events = [
        { seq: 1, player: 'black' },
        { seq: 2, player: 'white' }
      ];

      const result = canonical.normalizeChargeDeltaEventList(events);

      expect(result).toHaveLength(2);
      expect(result[0].player).toBe('black');
      expect(result[1].player).toBe('white');
    });

    test('無効なイベントは除外する', () => {
      const events = [
        { player: 'black' },
        null,
        { player: 'white' }
      ];

      const result = canonical.normalizeChargeDeltaEventList(events);

      expect(result).toHaveLength(2);
    });

    test('配列でない場合は空配列', () => {
      expect(canonical.normalizeChargeDeltaEventList(null)).toEqual([]);
      expect(canonical.normalizeChargeDeltaEventList('invalid')).toEqual([]);
    });
  });

  describe('normalizeChargeDataForSnapshot', () => {
    test('chargeデータを正規化する', () => {
      const cardState = {
        charge: { black: 10.5, white: -5.2 },
        chargeDeltaEvents: [
          { player: 'black', before: 5, after: 10 }
        ]
      };

      const result = canonical.normalizeChargeDataForSnapshot(cardState);

      expect(result.charge.black).toBe(10);
      expect(result.charge.white).toBe(-5);
      expect(result.chargeDeltaEvents).toHaveLength(1);
    });

    test('無効な入力はそのまま返す', () => {
      expect(canonical.normalizeChargeDataForSnapshot(null)).toBe(null);
      expect(canonical.normalizeChargeDataForSnapshot('invalid')).toBe('invalid');
    });
  });

  describe('buildMissingChargeDeltaEvents', () => {
    test('差分イベントを生成する', () => {
      const previous = {
        charge: { black: 5, white: 10 }
      };
      const next = {
        charge: { black: 8, white: 7 }
      };

      const events = canonical.buildMissingChargeDeltaEvents(previous, next, {});

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        player: 'black',
        before: 5,
        after: 8,
        delta: 3
      });
      expect(events[1]).toMatchObject({
        player: 'white',
        before: 10,
        after: 7,
        delta: -3
      });
    });

    test('変更がない場合は空配列', () => {
      const previous = { charge: { black: 5, white: 10 } };
      const next = { charge: { black: 5, white: 10 } };

      expect(canonical.buildMissingChargeDeltaEvents(previous, next, {})).toEqual([]);
    });

    test('force=trueの場合は空配列', () => {
      const previous = { charge: { black: 5 } };
      const next = { charge: { black: 8 } };

      expect(canonical.buildMissingChargeDeltaEvents(previous, next, { force: true })).toEqual([]);
    });

    test('既存のイベントがある場合は空配列', () => {
      const next = {
        charge: { black: 8 },
        chargeDeltaEvents: [{ player: 'black' }]
      };

      expect(canonical.buildMissingChargeDeltaEvents(null, next, {})).toEqual([]);
    });
  });

  describe('sanitizeIncomingSnapshot', () => {
    test('スナップショットをサニタイズする', () => {
      const snapshot = createCompleteLegacySnapshot({
        cardState: {
          presentationEvents: [{ type: 'test' }],
          _presentationEventsPersist: [{ type: 'test2' }],
          _currentActionMeta: {},
          charge: { black: 10, white: 10 }
        }
      });

      const result = canonical.sanitizeIncomingSnapshot(snapshot, {});

      expect(result.ok).toBe(true);
      expect(result.snapshot.cardState.presentationEvents).toEqual([]);
      expect(result.snapshot.cardState._presentationEventsPersist).toEqual([]);
      expect(result.snapshot.cardState._currentActionMeta).toBeUndefined();
      expect(result.transientStateStripped).toEqual({
        liveQueueCount: 1,
        persistentQueueCount: 1,
        hadCurrentActionMeta: true,
        hadResultShown: false
      });
    });

    test('無効なスナップショットは拒否', () => {
      expect(canonical.sanitizeIncomingSnapshot(null, {}).ok).toBe(false);
      expect(canonical.sanitizeIncomingSnapshot({}, {}).ok).toBe(false);
      expect(canonical.sanitizeIncomingSnapshot({ gameState: {} }, {}).ok).toBe(false);
    });

    test('__resultShownを削除する', () => {
      const snapshot = createCompleteLegacySnapshot({
        gameState: { __resultShown: true },
        cardState: {
          charge: { black: 10, white: 10 }
        }
      });

      const result = canonical.sanitizeIncomingSnapshot(snapshot, {});

      expect(result.ok).toBe(true);
      expect(result.snapshot.gameState.__resultShown).toBeUndefined();
      expect(result.transientStateStripped.hadResultShown).toBe(true);
    });

    test('トランジェント状態がない場合はnull', () => {
      const snapshot = createCompleteLegacySnapshot({
        cardState: {
          charge: { black: 10, white: 10 }
        }
      });

      const result = canonical.sanitizeIncomingSnapshot(snapshot, {});

      expect(result.transientStateStripped).toBe(null);
    });
  });
});
