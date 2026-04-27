/**
 * @file test-endgame-solver.test.js
 * @description Unit tests for endgame solver.
 */

'use strict';

const { EndgameSolver } = require('../game/ai/endgame-solver');

describe('EndgameSolver', () => {
    const mockGameInterface = {
        isTerminal: (state) => ({
            isTerminal: state.moves <= 0,
            value: state.score || 0,
        }),
        listActions: (state) => {
            if (state.moves <= 0) return [];
            return [
                { type: 'place', row: 0, col: 0 },
                { type: 'place', row: 0, col: 1 },
            ];
        },
        applyAction: (state, cardState, action, playerKey) => ({
            state: { moves: state.moves - 1, score: (state.score || 0) + 1 },
            cardState,
            nextPlayer: playerKey === 'black' ? 'white' : 'black',
        }),
        nextPlayer: (playerKey) => playerKey === 'black' ? 'white' : 'black',
        getDiscCounts: (state) => ({ black: state.score || 0, white: 0 }),
    };

    test('can be instantiated', () => {
        const solver = new EndgameSolver();
        expect(solver).toBeDefined();
        expect(solver.maxDepth).toBe(20);
    });

    test('solves terminal position', () => {
        const solver = new EndgameSolver();
        const result = solver.solve(
            { moves: 0, score: 1 },
            null,
            'black',
            mockGameInterface
        );
        expect(result.value).toBe(1);
        expect(result.bestAction).toBeNull();
    });

    test('finds best action in simple position', () => {
        const solver = new EndgameSolver();
        const result = solver.solve(
            { moves: 2, score: 0 },
            null,
            'black',
            mockGameInterface
        );
        expect(result.bestAction).not.toBeNull();
        expect(result.value).toBeDefined();
    });

    test('uses transposition table', () => {
        const solver = new EndgameSolver();
        solver.solve(
            { moves: 2, score: 0 },
            null,
            'black',
            mockGameInterface
        );
        expect(solver.transpositionTable.size).toBeGreaterThan(0);
    });

    test('counts nodes during search', () => {
        const solver = new EndgameSolver();
        solver.solve(
            { moves: 2, score: 0 },
            null,
            'black',
            mockGameInterface
        );
        expect(solver.nodeCount).toBeGreaterThan(0);
    });
});
