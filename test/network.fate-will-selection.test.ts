/**
 * @file network.fate-will-selection.test.ts
 * @description Regression coverage for FATE_WILL turns + selection publish (SEAT_MISMATCH fix).
 *
 * Background (see docs/plans/fate-will-network-seat-mismatch-fix-plan-2026-06-27.md):
 *   - During FATE_WILL, the controller (e.g. 'black') operates the owner's turn (e.g. 'white').
 *   - The owner-side action is built with playerKey = 'white' (= action owner).
 *   - The HTTP publish is sent from the controller's seat token (= 'black').
 *   - workers/match-worker.ts:1187 enforces `builtAction.actor === seatKey` (SEAT_MISMATCH).
 *   - UI must serialize `actor` as the HTTP seat (= controller = 'black'), not the action owner.
 *   - Server-side pending validation must accept the owner-side pending under the controller's seat.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

function loadModule<T = any>(relativePath: string): T {
    const absolute = path.join(ROOT, relativePath);
    // Force a fresh require each time so module state is reset between tests.
    delete require.cache[require.resolve(absolute)];
    return require(absolute) as T;
}

function buildSnapshot(opts: {
    currentPlayer: 'black' | 'white';
    fateWillControllerByTurnOwner?: { black: string | null; white: string | null };
    pendingEffectByPlayer?: { black: any; white: any };
    turnIndex?: number;
    hands?: { black: string[]; white: string[] };
    charge?: { black: number; white: number };
}) {
    const fateWillControllerByTurnOwner = opts.fateWillControllerByTurnOwner || { black: null, white: null };
    const pendingEffectByPlayer = opts.pendingEffectByPlayer || { black: null, white: null };
    const hands = opts.hands || { black: ['hyper_gravity'], white: [] };
    const charge = opts.charge || { black: 50, white: 50 };
    return {
        stateVersion: 1,
        gameState: {
            currentPlayer: opts.currentPlayer === 'white' ? -1 : 1,
            board: [],
            turnNumber: opts.turnIndex || 1
        },
        cardState: {
            turnIndex: opts.turnIndex || 1,
            hands,
            charge,
            fateWillControllerByTurnOwner,
            pendingEffectByPlayer,
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            cardUseCountByPlayer: { black: 0, white: 0 },
            lastUsedCardByPlayer: { black: null, white: null }
        }
    };
}

describe('UI publish command-payload: actor resolution (FATE_WILL seat alignment)', () => {
    const CommandPayload = loadModule<any>('ui/network/command-payload');

    function serialize(action: any, fallbackPlayerKey?: string) {
        return CommandPayload.serializeActionForCommandPayload(action, fallbackPlayerKey, {});
    }

    test('owner-built action (action.actor=white) sent by controller (fallback=black) yields actor=black', () => {
        // Simulates FATE_WILL turn: action is built with owner playerKey=white,
        // but the HTTP request is sent from the controller's seat (black).
        const action = {
            type: 'select_target',
            actor: 'white',
            playerKey: 'white',
            useCardId: 'hyper_gravity',
            useCardOwnerKey: 'white',
            pendingSelectionState: { type: 'HYPER_GRAVITY', stage: 'selectTarget' }
        };
        const result = serialize(action, 'black');
        expect(result).not.toBeNull();
        expect(result.actionType).toBe('select_target');
        expect(result.actor).toBe('black');
        expect(result.params.useCardId).toBe('hyper_gravity');
        expect(result.params.useCardOwnerKey).toBe('white');
        expect(result.params.pendingSelectionState).toBeDefined();
    });

    test('normal turn: action.actor and fallback both black keeps actor=black', () => {
        const action = {
            type: 'select_target',
            actor: 'black',
            playerKey: 'black',
            useCardId: 'hyper_gravity',
            useCardOwnerKey: 'black',
            pendingSelectionState: { type: 'HYPER_GRAVITY', stage: 'selectTarget' }
        };
        const result = serialize(action, 'black');
        expect(result.actor).toBe('black');
    });

    test('owner-built action sent by owner seat (white) yields actor=white', () => {
        const action = {
            type: 'select_target',
            actor: 'white',
            playerKey: 'white',
            useCardId: 'hyper_gravity',
            useCardOwnerKey: 'white',
            pendingSelectionState: { type: 'HYPER_GRAVITY', stage: 'selectTarget' }
        };
        const result = serialize(action, 'white');
        expect(result.actor).toBe('white');
    });

    test('when fallback is provided it strictly wins over action.actor', () => {
        // The fix moves fallbackPlayerKey to the front of the resolution chain.
        const action = {
            type: 'select_target',
            actor: 'white',
            playerKey: 'black'
        };
        const result = serialize(action, 'black');
        expect(result.actor).toBe('black');
    });

    test('when fallback is missing, falls back to action.actor for backwards compat', () => {
        const action = {
            type: 'select_target',
            actor: 'white',
            playerKey: 'white'
        };
        const result = serialize(action, undefined);
        expect(result.actor).toBe('white');
    });

    test('regression: source line enforces fallbackPlayerKey priority', () => {
        // Belt-and-suspenders: confirm the source change is still in place.
        const sourcePath = path.join(ROOT, 'ui/network/command-payload.ts');
        const source = fs.readFileSync(sourcePath, 'utf8');
        expect(source).toMatch(/fallbackPlayerKey\s*\|\|\s*action\.actor\s*\|\|\s*action\.playerKey/);
        // Old ordering (action.actor || fallback) must NOT be present:
        expect(source).not.toMatch(/action\.actor\s*\|\|\s*action\.playerKey\s*\|\|\s*fallbackPlayerKey/);
    });
});

describe('server pending validation: owner-side pending accepted under controller seat', () => {
    const MatchAuthority = loadModule<any>('utils/match-authority');

    test('validatePendingSelectionPublish accepts owner-side pending when controller seat publishes', () => {
        // Owner = white, controller = black. Pending is stored under owner (per 正本 spec).
        const snapshot = buildSnapshot({
            currentPlayer: 'white',
            fateWillControllerByTurnOwner: { black: null, white: 'black' },
            pendingEffectByPlayer: {
                black: null,
                white: {
                    type: 'HYPER_GRAVITY',
                    cardId: 'hyper_gravity',
                    stage: 'selectTarget',
                    pendingEffectId: 'pending_1_1'
                }
            }
        });
        const action = {
            useCardId: 'hyper_gravity',
            useCardOwnerKey: 'white',
            pendingSelectionState: {
                type: 'HYPER_GRAVITY',
                cardId: 'hyper_gravity',
                stage: 'selectTarget',
                pendingEffectId: 'pending_1_1'
            }
        };
        const result = MatchAuthority.validatePendingSelectionPublish(snapshot, 'black', action);
        expect(result).toBeDefined();
        expect(result.ok).toBe(true);
    });

    test('validatePendingSelectionPublish rejects when pending does not exist on the owner side either', () => {
        const snapshot = buildSnapshot({
            currentPlayer: 'white',
            fateWillControllerByTurnOwner: { black: null, white: 'black' },
            pendingEffectByPlayer: { black: null, white: null }
        });
        const action = {
            pendingSelectionState: { type: 'HYPER_GRAVITY', stage: 'selectTarget' }
        };
        const result = MatchAuthority.validatePendingSelectionPublish(snapshot, 'black', action);
        expect(result.ok).toBe(false);
        expect(result.rejectedReason).toBe('STALE_PENDING_SELECTION');
    });

    test('validatePendingSelectionPublish rejects type mismatch on owner-side pending', () => {
        const snapshot = buildSnapshot({
            currentPlayer: 'white',
            fateWillControllerByTurnOwner: { black: null, white: 'black' },
            pendingEffectByPlayer: {
                black: null,
                white: { type: 'GRAVITY_WILL', cardId: 'gravity', pendingEffectId: 'pending_1_2' }
            }
        });
        const action = {
            pendingSelectionState: { type: 'HYPER_GRAVITY', stage: 'selectTarget', pendingEffectId: 'pending_1_2' }
        };
        const result = MatchAuthority.validatePendingSelectionPublish(snapshot, 'black', action);
        expect(result.ok).toBe(false);
        expect(result.rejectedReason).toBe('STALE_PENDING_SELECTION');
    });

    test('isFateWillControllerForCurrentTurn identifies controller for owner side', () => {
        const snapshot = buildSnapshot({
            currentPlayer: 'white',
            fateWillControllerByTurnOwner: { black: null, white: 'black' }
        });
        expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'black')).toBe(true);
        expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'white')).toBe(false);
        expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'red' as any)).toBe(false);
    });

    // Regression for the real-world bug: cell-click action built by createPendingSelectionAction
    // only contains type/playerKey/pendingSelectionState/targetField — it does NOT include
    // useCardId/useCardOwnerKey (those come from the initial use_card action and live in the
    // server-side pending effect). The server must look up pending from the turn owner side
    // when a FATE_WILL controller publishes.
    test('FATE_WILL controller publishes a real-shape cell-click action (no useCardId/useCardOwnerKey) and is accepted', () => {
        const snapshot = buildSnapshot({
            currentPlayer: 'white',
            fateWillControllerByTurnOwner: { black: null, white: 'black' },
            pendingEffectByPlayer: {
                black: null,
                white: {
                    type: 'HYPER_GRAVITY',
                    cardId: 'hyper_gravity',
                    stage: 'selectTarget',
                    pendingEffectId: 'pending_1_real'
                }
            }
        });
        // Shape mirrors what game/turn/pending-coordinator.ts createPendingSelectionAction
        // actually produces: type='place', playerKey=owner, target field, pendingSelectionState.
        // No useCardId / useCardOwnerKey — those live on the server-side pending record only.
        const action = {
            type: 'place',
            playerKey: 'white',
            player: 'white',
            source: { row: 2, col: 3 },
            pendingSelectionState: {
                type: 'HYPER_GRAVITY',
                cardId: 'hyper_gravity',
                stage: 'selectTarget',
                pendingEffectId: 'pending_1_real'
            },
            turnIndex: 1
        };
        const result = MatchAuthority.validatePendingSelectionPublish(snapshot, 'black', action);
        expect(result.ok).toBe(true);
        expect(result.rejectedReason).toBeUndefined();
        expect(result.pendingEffectId).toBe('pending_1_real');
    });

    test('non-FATE_WILL controller seat still requires pending on its own slot or compatibility context', () => {
        // No FATE_WILL controller mapping — black seat publishes but pending is on white.
        const snapshot = buildSnapshot({
            currentPlayer: 'white',
            fateWillControllerByTurnOwner: { black: null, white: null },
            pendingEffectByPlayer: {
                black: null,
                white: {
                    type: 'HYPER_GRAVITY',
                    cardId: 'hyper_gravity',
                    stage: 'selectTarget',
                    pendingEffectId: 'pending_1_no_fw'
                }
            }
        });
        const action = {
            type: 'place',
            playerKey: 'white',
            source: { row: 2, col: 3 },
            pendingSelectionState: {
                type: 'HYPER_GRAVITY',
                stage: 'selectTarget',
                pendingEffectId: 'pending_1_no_fw'
            }
        };
        const result = MatchAuthority.validatePendingSelectionPublish(snapshot, 'black', action);
        expect(result.ok).toBe(false);
        expect(result.rejectedReason).toBe('STALE_PENDING_SELECTION');
    });
});

describe('applyTurnSafe: FATE_WILL controller publishes selection without OUT_OF_TURN', () => {
    // applyTurnSafe needs a real TurnPipeline. Build a minimal harness that
    // mirrors what workers/match-worker.ts uses for non-card actions.
    const MatchAuthority = loadModule<any>('utils/match-authority');

    function makeFateWillHarness() {
        const calls: any[] = [];
        const TurnPipeline = {
            applyTurnSafe: (...args: any[]) => {
                calls.push(args);
                const cardState = args[0];
                const gameState = args[1];
                const effectivePlayerKey = args[2];
                const action = args[3];
                // Mirror turn_pipeline_factory.ts:184-197 out-of-turn normalization.
                const actionPlayerKey = effectivePlayerKey;
                const currentPlayerKey = gameState.currentPlayer === -1 ? 'white' : 'black';
                if (actionPlayerKey !== currentPlayerKey) {
                    const controllerMap = (cardState.fateWillControllerByTurnOwner) || {};
                    const controller = controllerMap[currentPlayerKey];
                    if (controller !== actionPlayerKey) {
                        return {
                            ok: false,
                            rejectedReason: 'OUT_OF_TURN',
                            events: [{ type: 'action_rejected', reason: 'OUT_OF_TURN' }]
                        };
                    }
                    return {
                        ok: true,
                        effectivePlayerKey: currentPlayerKey,
                        action,
                        gameState,
                        cardState
                    };
                }
                return { ok: true, effectivePlayerKey: actionPlayerKey, action, gameState, cardState };
            }
        };
        return { TurnPipeline, calls };
    }

    test('controller seat (black) publishing a select_target action is normalized to owner (white) and accepted', () => {
        const { TurnPipeline } = makeFateWillHarness();
        const snapshot = buildSnapshot({
            currentPlayer: 'white',
            fateWillControllerByTurnOwner: { black: null, white: 'black' },
            pendingEffectByPlayer: {
                black: null,
                white: {
                    type: 'HYPER_GRAVITY',
                    cardId: 'hyper_gravity',
                    stage: 'selectTarget',
                    pendingEffectId: 'pending_1_3'
                }
            }
        });
        // The UI sends actor=black (controller), action.useCardOwnerKey=white (owner).
        const action = {
            type: 'select_target',
            actor: 'black',
            useCardId: 'hyper_gravity',
            useCardOwnerKey: 'white',
            pendingSelectionState: { type: 'HYPER_GRAVITY', stage: 'selectTarget', pendingEffectId: 'pending_1_3' }
        };
        // Step 1: pending validation against owner-side pending should pass.
        const validation = MatchAuthority.validatePendingSelectionPublish(snapshot, 'black', action);
        expect(validation.ok).toBe(true);

        // Step 2: applyTurnSafe normalizes playerKey (black → white) without OUT_OF_TURN.
        const result = TurnPipeline.applyTurnSafe(
            snapshot.cardState,
            snapshot.gameState,
            'black', // publish seat (controller)
            action
        );
        expect(result.ok).toBe(true);
        expect(result.effectivePlayerKey).toBe('white');
    });

    test('non-controller seat (red) is rejected with OUT_OF_TURN', () => {
        const { TurnPipeline } = makeFateWillHarness();
        const snapshot = buildSnapshot({
            currentPlayer: 'white',
            fateWillControllerByTurnOwner: { black: null, white: 'black' },
            pendingEffectByPlayer: {
                black: null,
                white: {
                    type: 'HYPER_GRAVITY',
                    cardId: 'hyper_gravity',
                    stage: 'selectTarget',
                    pendingEffectId: 'pending_1_4'
                }
            }
        });
        const action = {
            type: 'select_target',
            actor: 'white',
            useCardId: 'hyper_gravity',
            useCardOwnerKey: 'white',
            pendingSelectionState: { type: 'HYPER_GRAVITY', stage: 'selectTarget', pendingEffectId: 'pending_1_4' }
        };
        const result = TurnPipeline.applyTurnSafe(
            snapshot.cardState,
            snapshot.gameState,
            'red', // not a real seat — should fail OUT_OF_TURN
            action
        );
        expect(result.ok).toBe(false);
        expect(result.rejectedReason).toBe('OUT_OF_TURN');
    });
});

describe('client-side publish gate: FATE_WILL controller can publish owner-side actions', () => {
    // This is the actual blocker discovered after the first deploy: ui/network/publish-flow.ts
    // had a `playerKey !== state.seatKey` early return (SEAT_MISMATCH_LOCAL) that rejected
    // the cell-click publish BEFORE the HTTP request was sent. Server-side fixes are
    // irrelevant if the request never leaves the client.
    const PublishFlow = loadModule<any>('ui/network/publish-flow');

    function makeController(cfg: any) {
        return PublishFlow.createNetworkPublishFlowController({
            getState: () => cfg.state,
            isActive: () => true,
            normalizePlayerKey: (value: any) => {
                const v = String(value || '').toLowerCase();
                if (v === 'black' || v === '1' || v === '+1') return 'black';
                if (v === 'white' || v === '-1') return 'white';
                return 'black';
            },
            emitStatus: cfg.emitStatus || (() => {}),
            getCardState: () => cfg.cardState || null,
            // The rest of cfg overrides below; anything that publishSnapshot may reach
            // is supplied to keep the test isolated to the seat-mismatch gate.
            createOperationId: () => 'op_test',
            resolveNetworkPublishRequestModule: () => ({
                buildPublishRequest: () => ({
                    commandPayload: { actor: 'black', params: {} },
                    requestPayload: { actionType: 'place' },
                    queuedActionType: 'place'
                })
            }),
            getCurrentPublishTurnIndex: () => 1,
            createTrackedPublish: () => ({ sequence: 1 }),
            publishRequestWithRetry: cfg.publishRequestWithRetry || (async () => ({ ok: true, data: { ok: true, operationId: 'op_test', stateVersion: 1, snapshot: { stateVersion: 1 }, playbackEvents: [] } })),
            getSnapshotStateVersion: (snapshot: any) => snapshot && snapshot.stateVersion,
            recordNetworkTelemetry: () => {}
        });
    }

    test('FATE_WILL controller (black) publishing an owner-side (white) action is allowed', async () => {
        // Player is black (controller), operates white's turn under FATE_WILL.
        // The select_target cell click sends info.playerKey='white' (= owner).
        // The publish gate must allow this when the local seat is the controller.
        const publishRequestWithRetry = jest.fn(async () => ({
            ok: true,
            data: { ok: true, operationId: 'op_fw', stateVersion: 2, snapshot: { stateVersion: 2 }, playbackEvents: [] }
        }));
        const controller = makeController({
            state: {
                roomId: 'R1',
                seatKey: 'black',  // local seat = controller
                seatToken: 'tok',
                stateVersion: 1,
                publishChain: Promise.resolve()
            },
            cardState: {
                fateWillControllerByTurnOwner: { black: null, white: 'black' }
            },
            emitStatus: () => {},
            publishRequestWithRetry
        });
        const result = await controller.publishSnapshot({
            playerKey: 'white',  // owner
            actionType: 'place',
            action: {
                type: 'place',
                playerKey: 'white',
                source: { row: 2, col: 3 },
                pendingSelectionState: { type: 'HYPER_GRAVITY', stage: 'selectTarget' }
            }
        });
        expect(result.ok).toBe(true);
        expect(publishRequestWithRetry).toHaveBeenCalled();
    });

    test('non-FATE_WILL controller (black) publishing a white action is still rejected (SEAT_MISMATCH_LOCAL)', async () => {
        // No FATE_WILL controller registered → black publishing a white action is a real
        // seat mismatch (impersonation) and must continue to be rejected.
        const publishRequestWithRetry = jest.fn();
        const emitStatus = jest.fn();
        const controller = makeController({
            state: {
                roomId: 'R1',
                seatKey: 'black',
                seatToken: 'tok',
                stateVersion: 1,
                publishChain: Promise.resolve()
            },
            cardState: {
                fateWillControllerByTurnOwner: { black: null, white: null }  // no controller
            },
            emitStatus,
            publishRequestWithRetry
        });
        const result = await controller.publishSnapshot({
            playerKey: 'white',
            actionType: 'place',
            action: { type: 'place', playerKey: 'white' }
        });
        expect(result).toEqual({ ok: false, reason: 'SEAT_MISMATCH_LOCAL' });
        expect(publishRequestWithRetry).not.toHaveBeenCalled();
        expect(emitStatus).toHaveBeenCalledWith(expect.stringContaining('操作主体が座席と不一致'), true);
    });

    test('regression: same-seat (black publishes black) is allowed', async () => {
        const publishRequestWithRetry = jest.fn(async () => ({
            ok: true,
            data: { ok: true, operationId: 'op_self', stateVersion: 2, snapshot: { stateVersion: 2 }, playbackEvents: [] }
        }));
        const controller = makeController({
            state: {
                roomId: 'R1',
                seatKey: 'black',
                seatToken: 'tok',
                stateVersion: 1,
                publishChain: Promise.resolve()
            },
            cardState: {
                fateWillControllerByTurnOwner: { black: null, white: null }
            },
            emitStatus: () => {},
            publishRequestWithRetry
        });
        const result = await controller.publishSnapshot({
            playerKey: 'black',
            actionType: 'use_card',
            action: { type: 'use_card', useCardId: 'super_attraction' }
        });
        expect(result.ok).toBe(true);
        expect(publishRequestWithRetry).toHaveBeenCalled();
    });

    test('regression: white seat publishing white action is allowed', async () => {
        const publishRequestWithRetry = jest.fn(async () => ({
            ok: true,
            data: { ok: true, operationId: 'op_white', stateVersion: 2, snapshot: { stateVersion: 2 }, playbackEvents: [] }
        }));
        const controller = makeController({
            state: {
                roomId: 'R1',
                seatKey: 'white',
                seatToken: 'tok',
                stateVersion: 1,
                publishChain: Promise.resolve()
            },
            cardState: {
                fateWillControllerByTurnOwner: { black: null, white: null }
            },
            emitStatus: () => {},
            publishRequestWithRetry
        });
        const result = await controller.publishSnapshot({
            playerKey: 'white',
            actionType: 'use_card',
            action: { type: 'use_card', useCardId: 'super_attraction' }
        });
        expect(result.ok).toBe(true);
        expect(publishRequestWithRetry).toHaveBeenCalled();
    });

    test('white controller (white seat) publishing a black action under FATE_WILL is allowed', async () => {
        // Mirror scenario: white seat is the controller, operates black's turn.
        const publishRequestWithRetry = jest.fn(async () => ({
            ok: true,
            data: { ok: true, operationId: 'op_white_ctl', stateVersion: 2, snapshot: { stateVersion: 2 }, playbackEvents: [] }
        }));
        const controller = makeController({
            state: {
                roomId: 'R1',
                seatKey: 'white',  // local seat = controller
                seatToken: 'tok',
                stateVersion: 1,
                publishChain: Promise.resolve()
            },
            cardState: {
                fateWillControllerByTurnOwner: { black: 'white', white: null }  // black's turn controlled by white
            },
            emitStatus: () => {},
            publishRequestWithRetry
        });
        const result = await controller.publishSnapshot({
            playerKey: 'black',  // owner of the action
            actionType: 'place',
            action: { type: 'place', playerKey: 'black' }
        });
        expect(result.ok).toBe(true);
        expect(publishRequestWithRetry).toHaveBeenCalled();
    });
});
