const { createSelfplayRetryHelpers } = require('../src/engine/selfplay-retry-helpers.js');

describe('selfplay retry helpers module', () => {
    test('applyDecisionSnapshotBaseline clones state and preserves random source wiring', () => {
        const helpers = createSelfplayRetryHelpers({
            deepClone: (value) => JSON.parse(JSON.stringify(value)),
            clonePrng: jest.fn(() => ({ random: () => 0.5 }))
        });
        const state = {
            cardState: null,
            gameState: null,
            prng: null,
            stateVersion: 0,
            skipTurnStartForNextAction: false
        };

        helpers.applyDecisionSnapshotBaseline(state, {
            cardState: { hand: ['x'] },
            gameState: { board: [[0]] },
            prng: { getState: () => ({ seed: 1 }) },
            turnStartApplied: true
        }, 7);

        expect(state.stateVersion).toBe(7);
        expect(state.skipTurnStartForNextAction).toBe(true);
        expect(state.cardState).toEqual({
            hand: ['x'],
            _defaultRandomSource: { random: expect.any(Function) }
        });
        expect(state.gameState).toEqual({ board: [[0]] });
    });

    test('applyRejectedTurnStartBaseline adopts rejected snapshot and marks retry flag', () => {
        const helpers = createSelfplayRetryHelpers();
        const state = {
            cardState: { before: true },
            gameState: { before: true },
            stateVersion: 2,
            skipTurnStartForNextAction: false
        };

        expect(helpers.applyRejectedTurnStartBaseline(state, null)).toBe(false);
        expect(helpers.applyRejectedTurnStartBaseline(state, {
            cardState: { after: true },
            gameState: { after: true },
            nextStateVersion: 9
        })).toBe(true);
        expect(state).toEqual(expect.objectContaining({
            cardState: { after: true },
            gameState: { after: true },
            stateVersion: 9,
            skipTurnStartForNextAction: true
        }));
    });

    test('buildRetryFallbackDecision resolves pending selection and placement fallback cases', () => {
        const helpers = createSelfplayRetryHelpers({
            readSelfplayPendingEffect: jest.fn((cardState) => cardState.pending || null),
            buildPendingSelectionAction: jest.fn((_gameState, _cardState, _playerKey, pendingType) => (
                pendingType === 'PICK'
                    ? { type: 'select_target', pendingType }
                    : null
            )),
            getLegalMovesForAction: jest.fn(() => [
                { row: 4, col: 2 },
                { row: 1, col: 3 }
            ]),
            resolveForcedPlacementCandidates: jest.fn(() => ({
                moves: [{ row: 0, col: 1 }]
            })),
            getSelfplayBoard: jest.fn(() => [[0]])
        });

        expect(
            helpers.buildRetryFallbackDecision({}, { pending: { stage: 'selectTarget', type: 'PICK' } }, 'black', {}, {})
        ).toEqual({
            action: { type: 'select_target', pendingType: 'PICK' },
            legalMoves: [{ row: 4, col: 2 }, { row: 1, col: 3 }]
        });

        expect(
            helpers.buildRetryFallbackDecision({}, { pending: { stage: 'selectTarget', type: 'MISS' } }, 'black', {}, {})
        ).toEqual({
            action: { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } },
            legalMoves: [{ row: 4, col: 2 }, { row: 1, col: 3 }]
        });

        expect(
            helpers.buildRetryFallbackDecision({}, {}, 'black', {}, {})
        ).toEqual({
            action: { type: 'place', row: 0, col: 1 },
            legalMoves: [{ row: 1, col: 3 }, { row: 4, col: 2 }]
        });
    });

    test('listFallbackPlacementActions deduplicates and keeps first explicit placement', () => {
        const helpers = createSelfplayRetryHelpers();

        expect(helpers.listFallbackPlacementActions({
            action: { type: 'place', row: 1, col: 2 },
            legalMoves: [
                { row: 1, col: 2 },
                { row: 0, col: 0 },
                { row: 0, col: 0 }
            ]
        })).toEqual([
            { type: 'place', row: 1, col: 2 },
            { type: 'place', row: 0, col: 0 }
        ]);
    });

    test('getPlacementFlipsBeforeApply respects free-placement pending and counts flips otherwise', () => {
        const helpers = createSelfplayRetryHelpers({
            CardLogic: {
                getPendingEffectType: jest.fn((_cardState) => _cardState.pendingType || null),
                isFreePlacementPendingType: jest.fn((pendingType) => pendingType === 'FREE')
            },
            Core: {
                getFlipsWithContext: jest.fn(() => [1, 2, 3])
            },
            toPlayerValue: jest.fn(() => 1),
            getSafeCardContext: jest.fn(() => ({ ctx: true }))
        });

        expect(
            helpers.getPlacementFlipsBeforeApply({}, { pendingType: 'FREE' }, 'black', { type: 'place', row: 0, col: 0 })
        ).toBeNull();
        expect(
            helpers.getPlacementFlipsBeforeApply({}, { pendingType: null }, 'black', { type: 'place', row: 0, col: 0 })
        ).toBe(3);
    });

    test('tryFallbackPlacementsFromSnapshot skips invalid placements and returns the first successful retry', () => {
        const createAction = jest.fn((decision, gameIndex, actionCounter, turnIndex) => ({
            action: Object.assign({}, decision.action, {
                actionId: `sp-${gameIndex}-${actionCounter}`,
                turnIndex
            }),
            actionType: decision.action.type
        }));
        const applyActionSafe = jest.fn((_state, _playerKey, action) => (
            action.row === 0
                ? { ok: false, rejectedReason: 'ILLEGAL_MOVE' }
                : { ok: true, nextStateVersion: 9 }
        ));
        const helpers = createSelfplayRetryHelpers({
            deepClone: (value) => JSON.parse(JSON.stringify(value)),
            clonePrng: jest.fn(() => ({ random: () => 0.5 })),
            CardLogic: {
                getPendingEffectType: jest.fn(() => null),
                isFreePlacementPendingType: jest.fn(() => false)
            },
            Core: {
                getFlipsWithContext: jest
                    .fn()
                    .mockReturnValueOnce([])
                    .mockReturnValueOnce([1, 2])
                    .mockReturnValueOnce([1])
            },
            toPlayerValue: jest.fn(() => 1),
            getSafeCardContext: jest.fn(() => ({ ctx: true })),
            createAction,
            applyActionSafe
        });
        const state = {
            cardState: { board: [] },
            gameState: { board: [] },
            prng: null,
            stateVersion: 4,
            skipTurnStartForNextAction: false
        };

        const out = helpers.tryFallbackPlacementsFromSnapshot(
            state,
            {
                cardState: { hand: [] },
                gameState: { board: [[0]] },
                prng: null,
                turnStartApplied: false
            },
            4,
            {
                action: { type: 'place', row: 0, col: 0 },
                legalMoves: [
                    { row: 0, col: 0 },
                    { row: 1, col: 1 }
                ]
            },
            7,
            { value: 0 },
            'black'
        );

        expect(out).toEqual(expect.objectContaining({
            ok: true,
            action: { type: 'place', row: 1, col: 1, actionId: 'sp-7-1', turnIndex: 4 },
            flipsBefore: 2,
            skippedInvalidPlacements: 1,
            result: { ok: true, nextStateVersion: 9 }
        }));
        expect(createAction).toHaveBeenCalledTimes(1);
        expect(applyActionSafe).toHaveBeenCalledTimes(1);
    });

    test('buildIllegalMoveHardcase clones payload and attachSelfplayHardcase decorates the error', () => {
        const helpers = createSelfplayRetryHelpers({
            deepClone: (value) => JSON.parse(JSON.stringify(value)),
            toPlayerKey: jest.fn((value) => value === 1 ? 'black' : 'white')
        });
        const hardcase = helpers.buildIllegalMoveHardcase({
            gameIndex: 5,
            ply: 9,
            playerKey: 'white',
            fallbackStateVersion: 11,
            first: { actionType: 'use_card', action: { type: 'use_card', id: 'a' } },
            fallbackDecision: { legalMoves: [{ row: 0, col: 1 }] },
            fallbackSnapshot: {
                turnStartApplied: true,
                prng: { getState: () => ({ seed: 3 }) },
                gameState: { currentPlayer: 1 },
                cardState: { hand: ['x'] }
            }
        });
        const error = new Error('boom');

        expect(hardcase).toEqual(expect.objectContaining({
            schemaVersion: 'selfplay_illegal_move_hardcase.v1',
            gameIndex: 5,
            ply: 9,
            player: 'white',
            stateVersion: 11,
            firstActionType: 'use_card',
            fallbackCurrentPlayer: 'black',
            legalMoves: [{ row: 0, col: 1 }],
            snapshot: expect.objectContaining({
                turnStartApplied: true,
                gameState: { currentPlayer: 1 },
                cardState: { hand: ['x'] }
            })
        }));
        expect(helpers.attachSelfplayHardcase(error, hardcase).selfplayHardcase).toEqual(hardcase);
    });
});
