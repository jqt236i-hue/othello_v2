/**
 * @file test-gumbel-mcts.test.js
 * @description Unit tests for Gumbel AlphaZero MCTS.
 */

'use strict';

const { GumbelMCTS } = require('../gumbel-mcts');

describe('GumbelMCTS', () => {
    const mockGameInterface = {
        hashState: (state, cardState, playerKey) => `${JSON.stringify(state)}|${playerKey}`,
        hashAfterAction: (parentHash, action) => `${parentHash}>${action.type}`,
        copyState: (state) => JSON.parse(JSON.stringify(state)),
        copyCardState: (cardState) => cardState ? JSON.parse(JSON.stringify(cardState)) : null,
        listActions: () => [
            { type: 'place', row: 0, col: 0 },
            { type: 'place', row: 0, col: 1 },
            { type: 'place', row: 1, col: 0 },
        ],
        applyAction: (state, cardState, action, playerKey) => ({
            state: { ...state, lastAction: action },
            cardState,
            nextPlayer: playerKey === 'black' ? 'white' : 'black',
        }),
        isTerminal: () => ({ isTerminal: false, value: 0 }),
        nextPlayer: (playerKey) => playerKey === 'black' ? 'white' : 'black',
        actionToKey: (action) => `${action.row},${action.col}`,
    };

    const mockNetwork = {
        evaluate: async () => ({
            policy: new Map([['0,0', 0.5], ['0,1', 0.3], ['1,0', 0.2]]),
            value: 0.1,
        }),
    };

    test('can be instantiated', () => {
        const mcts = new GumbelMCTS({
            gameInterface: mockGameInterface,
            network: mockNetwork,
            numSimulations: 10,
        });
        expect(mcts).toBeDefined();
        expect(mcts.numSimulations).toBe(10);
    });

    test('search returns an array of results', async () => {
        const mcts = new GumbelMCTS({
            gameInterface: mockGameInterface,
            network: mockNetwork,
            numSimulations: 10,
            maxActions: 3,
        });
        const result = await mcts.search({ board: [] }, null, 'black');
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
    });

    test('search with no legal moves returns empty array', async () => {
        const noMoveInterface = {
            ...mockGameInterface,
            listActions: () => [],
        };
        const mcts = new GumbelMCTS({
            gameInterface: noMoveInterface,
            network: mockNetwork,
            numSimulations: 10,
        });
        const result = await mcts.search({ board: [] }, null, 'black');
        expect(result).toEqual([]);
    });

    test('results have correct structure', async () => {
        const mcts = new GumbelMCTS({
            gameInterface: mockGameInterface,
            network: mockNetwork,
            numSimulations: 20,
            maxActions: 3,
        });
        const result = await mcts.search({ board: [] }, null, 'black');
        if (result.length > 0) {
            const first = result[0];
            expect(first).toHaveProperty('action');
            expect(first).toHaveProperty('visitCount');
            expect(first).toHaveProperty('prior');
            expect(first).toHaveProperty('value');
            expect(first).toHaveProperty('probability');
        }
    });
});
