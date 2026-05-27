const { createSelfplayBootstrapHelpers } = require('../src/engine/selfplay-bootstrap-helpers.js');

describe('selfplay bootstrap helpers module', () => {
    test('clonePrng clones from state and falls back to original on error', () => {
        const helpers = createSelfplayBootstrapHelpers({
            SeededPRNG: {
                fromState: jest.fn((state) => ({ cloned: state })),
                createPRNG: jest.fn()
            }
        });

        const rng = { getState: () => ({ seed: 7 }) };
        expect(helpers.clonePrng(rng)).toEqual({ cloned: { seed: 7 } });

        const helpersWithThrow = createSelfplayBootstrapHelpers({
            SeededPRNG: {
                fromState: jest.fn(() => { throw new Error('boom'); }),
                createPRNG: jest.fn()
            }
        });
        expect(helpersWithThrow.clonePrng(rng)).toBe(rng);
        expect(helpers.clonePrng({})).toEqual({});
    });

    test('cloneInitialDeckCardIdsByPlayer clones only black/white deck arrays', () => {
        const helpers = createSelfplayBootstrapHelpers({
            SeededPRNG: { fromState: jest.fn(), createPRNG: jest.fn() }
        });

        expect(helpers.cloneInitialDeckCardIdsByPlayer(null)).toBeNull();
        expect(helpers.cloneInitialDeckCardIdsByPlayer({ other: ['x'] })).toBeNull();
        expect(helpers.cloneInitialDeckCardIdsByPlayer({
            black: ['a'],
            white: ['b'],
            other: ['c']
        })).toEqual({
            black: ['a'],
            white: ['b']
        });
    });

    test('createInitialState wires seed, initial decks, and stateVersion', () => {
        const createPRNG = jest.fn((seed) => ({ seed }));
        const initGame = jest.fn(() => ({ cardState: { ready: true } }));
        const createGameState = jest.fn(() => ({ board: [] }));
        const helpers = createSelfplayBootstrapHelpers({
            SeededPRNG: { fromState: jest.fn(), createPRNG },
            CardLogic: { initGame },
            Core: { createGameState }
        });

        const out = helpers.createInitialState(11, {
            initialDeckCardIdsByPlayer: { black: ['x'], white: ['y'] }
        });

        expect(createPRNG).toHaveBeenCalledWith(11);
        expect(initGame).toHaveBeenCalledWith({ seed: 11 }, {
            initialDeckCardIdsByPlayer: { black: ['x'], white: ['y'] }
        });
        expect(out).toEqual({
            gameState: { board: [] },
            cardState: { ready: true },
            prng: { seed: 11 },
            stateVersion: 0
        });
    });

    test('buildDecisionSnapshot applies turn start on clones and falls back on failure', () => {
        const applyTurnStartPhase = jest.fn((_cardLogic, _core, clonedCardState, clonedGameState) => {
            clonedCardState.changed = true;
            clonedGameState.changed = true;
        });
        const helpers = createSelfplayBootstrapHelpers({
            SeededPRNG: {
                fromState: jest.fn(() => ({ random: () => 0.5 })),
                createPRNG: jest.fn()
            },
            deepClone: (value) => JSON.parse(JSON.stringify(value)),
            TurnPipelinePhases: { applyTurnStartPhase },
            CardLogic: {},
            Core: {}
        });

        const gameState = { board: [] };
        const cardState = { hand: [] };
        const out = helpers.buildDecisionSnapshot(gameState, cardState, 'black', { getState: () => ({ s: 1 }) });

        expect(out.turnStartApplied).toBe(true);
        expect(out.gameState).toEqual({ board: [], changed: true });
        expect(out.cardState.changed).toBe(true);
        expect(out.cardState._defaultRandomSource).toEqual({ random: expect.any(Function) });

        const failing = createSelfplayBootstrapHelpers({
            SeededPRNG: {
                fromState: jest.fn(() => ({ random: () => 0.5 })),
                createPRNG: jest.fn()
            },
            deepClone: (value) => JSON.parse(JSON.stringify(value)),
            TurnPipelinePhases: { applyTurnStartPhase: jest.fn(() => { throw new Error('fail'); }) },
            CardLogic: {},
            Core: {}
        });
        const fallback = failing.buildDecisionSnapshot(gameState, cardState, 'black', { getState: () => ({ s: 1 }) });
        expect(fallback).toEqual({
            gameState,
            cardState,
            prng: { getState: expect.any(Function) },
            turnStartApplied: false
        });
    });
});
