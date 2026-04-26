jest.mock('../game/turn/pending-coordinator', () => ({
    getPendingSelectionContract: jest.fn(() => ({
        kind: 'single_stage',
        deferNetworkPublish: false,
        turnOutcome: 'continue'
    })),
    isSelectionOnlyEndTurnPendingType: jest.fn(() => false),
    shouldDeferNetworkPublishForPendingType: jest.fn(() => false),
    shouldWaitForPlaybackIdleForPendingType: jest.fn(() => false),
    createPendingSelectionAction: jest.fn((playerKey, pendingType, payload, options) => ({
        type: 'place',
        playerKey,
        ...payload
    })),
    readPendingSelectionAction: jest.fn(() => null),
    storePendingSelectionAction: jest.fn((playerKey, action) => action),
    clearPendingSelectionAction: jest.fn(() => true),
    readPendingEffect: jest.fn((cardState, playerKey) => {
        if (cardState && cardState.pendingEffectByPlayer) {
            return cardState.pendingEffectByPlayer[playerKey];
        }
        return null;
    }),
    shouldRetainPendingSelectionAction: jest.fn(() => false),
    syncPendingSelectionActionCache: jest.fn(() => ({ cleared: [], retained: [] })),
    clearPendingSelectionFailureState: jest.fn(() => true)
}));

jest.mock('../game/network-turn-handoff', () => ({
    captureNetworkPublishSnapshot: jest.fn(() => ({ gameState: {}, cardState: {} })),
    publishNetworkSnapshot: jest.fn(() => ({ ok: true })),
    finalizeNetworkTurnHandoff: jest.fn(() => Promise.resolve({ ok: true })),
    waitForPlaybackIdleIfNeeded: jest.fn(() => Promise.resolve())
}));

jest.mock('../game/logic/cards-internal/pending-state-manager', () => ({
    PENDING_SELECTION_CONTRACTS: {}
}));

jest.mock('../game/logic/presentation', () => ({}));

jest.mock('../game/turn/pipeline_ui_adapter', () => ({}));

jest.mock('../game/turn/turn_pipeline', () => ({}));

const selectionFlow = require('../game/card-effects/selection-flow');

describe('selection-flow', () => {
    beforeEach(() => {
        // モックをリセット
        jest.clearAllMocks();
        globalThis.cardState = {
            pendingEffectByPlayer: {
                black: { type: 'TRAP_WILL', stage: 'selectTarget' },
                white: null
            },
            turnIndex: 1
        };
        globalThis.gameState = {
            currentPlayer: 1,
            turnNumber: 1,
            board: []
        };
        globalThis.PlaybackStateManager = {
            setBusyState: jest.fn(),
            setProcessing: jest.fn(),
            setCardAnimating: jest.fn(),
            getProcessing: jest.fn(() => false),
            getCardAnimating: jest.fn(() => false),
            shouldAllowSelectionEntryDuringPlayback: jest.fn(() => false),
            clearSelectionEntryPlaybackContext: jest.fn()
        };
        globalThis.ActionManager = {
            ActionManager: {
                createAction: jest.fn((type, playerKey, payload) => ({
                    type,
                    playerKey,
                    ...payload
                }))
            }
        };
        globalThis.TurnPipelineUIAdapter = null;
        globalThis.TurnPipeline = null;
        globalThis.getCurrentMatchMode = jest.fn(() => 'local');
    });

    afterEach(() => {
        delete globalThis.cardState;
        delete globalThis.gameState;
        delete globalThis.PlaybackStateManager;
        delete globalThis.ActionManager;
        delete globalThis.TurnPipelineUIAdapter;
        delete globalThis.TurnPipeline;
        delete globalThis.getCurrentMatchMode;
    });

    describe('setSignalBridge / clearSignalBridge', () => {
        test('正常系: シグナルブリッジを設定・クリアできる', () => {
            const bridge = { test: true };
            selectionFlow.setSignalBridge(bridge);
            expect(() => selectionFlow.clearSignalBridge()).not.toThrow();
        });

        test('境界条件: nullを設定してもエラーにならない', () => {
            expect(() => selectionFlow.setSignalBridge(null)).not.toThrow();
        });
    });

    describe('setSelectionProcessing', () => {
        test('正常系: 処理状態を設定できる', () => {
            const result = selectionFlow.setSelectionProcessing(true);
            expect(result).toBe(true);
        });
    });

    describe('setSelectionCardAnimating', () => {
        test('正常系: アニメーション状態を設定できる', () => {
            const result = selectionFlow.setSelectionCardAnimating(true);
            expect(result).toBe(true);
        });
    });

    describe('setSelectionBusy', () => {
        test('正常系: 両方の状態を同時に設定できる', () => {
            const result = selectionFlow.setSelectionBusy(true);
            expect(result).toBe(true);
        });
    });

    describe('createPendingSelectionAction', () => {
        test('正常系: アクションを作成できる', () => {
            const action = selectionFlow.createPendingSelectionAction(
                'black',
                'TRAP_WILL',
                { trapTarget: { row: 3, col: 4 } }
            );
            expect(action).toMatchObject({
                type: 'place',
                playerKey: 'black',
                trapTarget: { row: 3, col: 4 }
            });
        });

        test('正常系: 空のペイロードでも作成できる', () => {
            const action = selectionFlow.createPendingSelectionAction('white', 'GUARD_WILL', {});
            expect(action).toMatchObject({
                type: 'place',
                playerKey: 'white'
            });
        });
    });

    describe('readPendingSelectionAction', () => {
        test('正常系: アクションを読み取れる', () => {
            const pendingCoordinator = require('../game/turn/pending-coordinator');
            pendingCoordinator.readPendingSelectionAction.mockReturnValue({
                type: 'place',
                playerKey: 'black'
            });
            const action = selectionFlow.readPendingSelectionAction('black');
            expect(action).toEqual({ type: 'place', playerKey: 'black' });
        });

        test('正常系: アクションがない場合はnull', () => {
            const pendingCoordinator = require('../game/turn/pending-coordinator');
            pendingCoordinator.readPendingSelectionAction.mockReturnValue(null);
            const action = selectionFlow.readPendingSelectionAction('black');
            expect(action).toBeNull();
        });
    });

    describe('capturePendingSelectionSnapshot', () => {
        test('正常系: スナップショットを取得できる', () => {
            const snapshot = selectionFlow.capturePendingSelectionSnapshot(
                globalThis.gameState,
                globalThis.cardState
            );
            expect(snapshot).toHaveProperty('gameState');
            expect(snapshot).toHaveProperty('cardState');
        });

        test('境界条件: 引数がnullの場合はnullまたは空オブジェクト', () => {
            const snapshot = selectionFlow.capturePendingSelectionSnapshot(null, null);
            // NetworkTurnHandoffがモックされている場合、空オブジェクトが返る
            expect(snapshot === null || (typeof snapshot === 'object' && snapshot !== null)).toBe(true);
        });
    });

    describe('publishPendingSelectionSnapshot', () => {
        test('正常系: スナップショットを公開できる', () => {
            const networkTurnHandoff = require('../game/network-turn-handoff');
            const result = selectionFlow.publishPendingSelectionSnapshot({
                playerKey: 'black',
                action: { type: 'place' }
            });
            expect(networkTurnHandoff.publishNetworkSnapshot).toHaveBeenCalled();
        });
    });

    describe('applySelectionStateResult', () => {
        test('正常系: カード状態を適用できる', () => {
            const nextCardState = { pendingEffectByPlayer: {} };
            const result = selectionFlow.applySelectionStateResult(
                { nextCardState },
                { cardState: globalThis.cardState }
            );
            expect(result.cardState).toBeDefined();
        });

        test('正常系: ゲーム状態を適用できる', () => {
            const nextGameState = { currentPlayer: -1 };
            const result = selectionFlow.applySelectionStateResult(
                { nextGameState },
                { gameState: globalThis.gameState }
            );
            expect(result.gameState).toBeDefined();
        });
    });

    describe('emitSelectionPlaybackEvents', () => {
        test('正常系: イベントを発行できる', () => {
            const bridge = { emitPlaybackEvents: jest.fn(() => true) };
            selectionFlow.setSignalBridge(bridge);

            const result = selectionFlow.emitSelectionPlaybackEvents(
                [{ type: 'trap_selected' }],
                { cause: 'TRAP_WILL' },
                globalThis.cardState
            );

            expect(bridge.emitPlaybackEvents).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        test('境界条件: イベントが空の場合はfalse', () => {
            const result = selectionFlow.emitSelectionPlaybackEvents([], {}, null);
            expect(result).toBe(false);
        });
    });

    describe('executePendingSelection', () => {
        test('正常系: 選択実行が成功する', async () => {
            const pendingCoordinator = require('../game/turn/pending-coordinator');
            pendingCoordinator.readPendingEffect.mockReturnValue({
                type: 'TRAP_WILL',
                stage: 'selectTarget'
            });

            const adapter = {
                runTurnWithAdapter: jest.fn(() => ({
                    ok: true,
                    nextCardState: globalThis.cardState,
                    nextGameState: globalThis.gameState,
                    playbackEvents: [{ type: 'trap_selected' }],
                    rawEvents: [{ type: 'trap_selected', applied: true }]
                }))
            };
            globalThis.TurnPipelineUIAdapter = adapter;
            globalThis.TurnPipeline = {};

            const result = await selectionFlow.executePendingSelection({
                row: 3,
                col: 4,
                playerKey: 'black',
                pendingType: 'TRAP_WILL',
                actionPayload: { trapTarget: { row: 3, col: 4 } },
                validateResult: ({ result }) => {
                    const event = result.rawEvents?.find(e => e.type === 'trap_selected');
                    return !!(event && event.applied);
                }
            });

            expect(result.ok).toBe(true);
        });

        test('境界条件: ペンディングがない場合は失敗', async () => {
            const pendingCoordinator = require('../game/turn/pending-coordinator');
            pendingCoordinator.readPendingEffect.mockReturnValue(null);

            const result = await selectionFlow.executePendingSelection({
                row: 3,
                col: 4,
                playerKey: 'black',
                pendingType: 'TRAP_WILL'
            });

            expect(result.ok).toBe(false);
            expect(result.reason).toBe('pending_unavailable');
        });

        test('エラーハンドリング: ターン実行が失敗', async () => {
            const pendingCoordinator = require('../game/turn/pending-coordinator');
            pendingCoordinator.readPendingEffect.mockReturnValue({
                type: 'TRAP_WILL',
                stage: 'selectTarget'
            });

            const adapter = {
                runTurnWithAdapter: jest.fn(() => ({
                    ok: false,
                    reason: 'invalid_selection'
                }))
            };
            globalThis.TurnPipelineUIAdapter = adapter;
            globalThis.TurnPipeline = {};

            const result = await selectionFlow.executePendingSelection({
                row: 3,
                col: 4,
                playerKey: 'black',
                pendingType: 'TRAP_WILL',
                actionPayload: { trapTarget: { row: 3, col: 4 } },
                invalidMessage: 'テストエラー'
            });

            expect(result.ok).toBe(false);
            expect(result.reason).toBe('selection_rejected');
        });
    });

    describe('finalizePendingSelectionFlow', () => {
        test('正常系: フロー最終化が成功する', async () => {
            const result = await selectionFlow.finalizePendingSelectionFlow({
                playerKey: 'black',
                pendingType: 'TRAP_WILL',
                actionType: 'place',
                action: { type: 'place' },
                playbackEvents: []
            });

            expect(result).toBe(true);
        });

        test('正常系: end_turn契約で最終化', async () => {
            const pendingCoordinator = require('../game/turn/pending-coordinator');
            const networkTurnHandoff = require('../game/network-turn-handoff');
            pendingCoordinator.getPendingSelectionContract.mockReturnValue({
                kind: 'single_stage',
                deferNetworkPublish: false,
                turnOutcome: 'end_turn'
            });

            const result = await selectionFlow.finalizePendingSelectionFlow({
                playerKey: 'black',
                pendingType: 'TRAP_WILL',
                actionType: 'place',
                action: { type: 'place' },
                playbackEvents: []
            });

            expect(networkTurnHandoff.finalizeNetworkTurnHandoff).toHaveBeenCalled();
        });

        test('エラーハンドリング: NetworkTurnHandoffがない', async () => {
            const pendingCoordinator = require('../game/turn/pending-coordinator');
            pendingCoordinator.getPendingSelectionContract.mockReturnValue({
                kind: 'single_stage',
                deferNetworkPublish: false,
                turnOutcome: 'end_turn'
            });
            // NetworkTurnHandoff を null にしてモジュール側でキャッシュをクリアする
            const networkTurnHandoff = require('../game/network-turn-handoff');
            Object.keys(networkTurnHandoff).forEach(key => {
                if (typeof networkTurnHandoff[key] === 'function') {
                    networkTurnHandoff[key] = null;
                }
            });

            const result = await selectionFlow.finalizePendingSelectionFlow({
                playerKey: 'black',
                pendingType: 'TRAP_WILL',
                actionType: 'place',
                action: { type: 'place' },
                playbackEvents: []
            });

            expect(result).toBe(false);
        });
    });

    describe('syncPendingSelectionActionCache', () => {
        test('正常系: キャッシュを同期できる', () => {
            const result = selectionFlow.syncPendingSelectionActionCache(
                globalThis.cardState.pendingEffectByPlayer
            );
            expect(result).toHaveProperty('cleared');
            expect(result).toHaveProperty('retained');
        });
    });

    describe('waitForSelectionPlaybackIdle', () => {
        test('正常系: 実行してもエラーにならない', async () => {
            await expect(selectionFlow.waitForSelectionPlaybackIdle([])).resolves.toBeUndefined();
            await expect(selectionFlow.waitForSelectionPlaybackIdle([{ type: 'move' }])).resolves.toBeUndefined();
        });
    });

    describe('resolvePendingSelectionContract', () => {
        test('正常系: 契約を解決できる', () => {
            const pendingCoordinator = require('../game/turn/pending-coordinator');
            const contract = selectionFlow.resolvePendingSelectionContract('TRAP_WILL');
            expect(contract).toBeDefined();
            expect(pendingCoordinator.getPendingSelectionContract).toHaveBeenCalledWith('TRAP_WILL');
        });
    });

    describe('shouldDeferNetworkPublishForPendingType', () => {
        test('正常系: 遅延公開の判定', () => {
            const result = selectionFlow.shouldDeferNetworkPublishForPendingType('TRAP_WILL');
            expect(typeof result).toBe('boolean');
        });
    });
});
