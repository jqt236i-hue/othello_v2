const { createSelfplayBatchRunner } = require('../src/engine/selfplay-batch-runner.js');

describe('selfplay batch runner module', () => {
    test('runSelfPlayGames resolves per-game policy overrides using offset game index and seed', () => {
        const normalizeOptions = jest.fn((options) => Object.assign({
            schemaVersion: 'selfplay.v2',
            games: 2,
            baseSeed: 40,
            gameIndexOffset: 100,
            playerPolicies: null
        }, options));
        const buildPerGamePolicySet = jest.fn((opts, seed, gameIndex) => ({
            black: { gameIndex, seed, marker: opts.playerPolicies && opts.playerPolicies.kind },
            white: null
        }));
        const runSingleGameWithRetries = jest.fn((gameIndex, seed, _opts, perGameOptions) => ({
            records: [{ gameIndex, seed, marker: perGameOptions.playerPolicies.black.marker }],
            summary: { winner: 'draw', plies: 3 }
        }));
        const seen = [];
        const runner = createSelfplayBatchRunner({
            normalizeOptions,
            buildPerGamePolicySet,
            runSingleGameWithRetries
        });

        const out = runner.runSelfPlayGames({
            playerPolicyResolver: (gameIndex, seed) => {
                seen.push({ gameIndex, seed });
                return { kind: `${gameIndex}:${seed}` };
            }
        });

        expect(seen).toEqual([
            { gameIndex: 100, seed: 40 },
            { gameIndex: 101, seed: 41 }
        ]);
        expect(buildPerGamePolicySet).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ playerPolicies: { kind: '100:40' } }),
            40,
            100
        );
        expect(buildPerGamePolicySet).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ playerPolicies: { kind: '101:41' } }),
            41,
            101
        );
        expect(out.records).toEqual([
            { gameIndex: 100, seed: 40, marker: '100:40' },
            { gameIndex: 101, seed: 41, marker: '101:41' }
        ]);
        expect(out.summary).toEqual({
            schemaVersion: 'selfplay.v2',
            totalGames: 2,
            plannedGames: 2,
            aborted: false,
            totalPlies: 6,
            avgPlies: 3,
            wins: { black: 0, white: 0, draw: 2 }
        });
    });

    test('runSelfPlayGames routes records to onRecord and summaries to onGameEnd', () => {
        const onRecord = jest.fn();
        const onGameEnd = jest.fn();
        const runner = createSelfplayBatchRunner({
            normalizeOptions: (options) => Object.assign({
                schemaVersion: 'selfplay.v2',
                games: 1,
                baseSeed: 5,
                gameIndexOffset: 0
            }, options),
            buildPerGamePolicySet: jest.fn(() => ({ black: null, white: null })),
            runSingleGameWithRetries: jest.fn(() => ({
                records: [{ id: 1 }, { id: 2 }],
                summary: { winner: 'black', plies: 9 }
            }))
        });

        const out = runner.runSelfPlayGames({ onRecord, onGameEnd });

        expect(out.records).toEqual([]);
        expect(onRecord).toHaveBeenCalledTimes(2);
        expect(onGameEnd).toHaveBeenCalledWith({ winner: 'black', plies: 9 });
        expect(out.summary.wins).toEqual({ black: 1, white: 0, draw: 0 });
    });

    test('runSelfPlayGames stops early when shouldStop flips before the next game', () => {
        let stopChecks = 0;
        const runner = createSelfplayBatchRunner({
            normalizeOptions: (options) => Object.assign({
                schemaVersion: 'selfplay.v2',
                games: 3,
                baseSeed: 1,
                gameIndexOffset: 0
            }, options),
            buildPerGamePolicySet: jest.fn(() => ({ black: null, white: null })),
            runSingleGameWithRetries: jest.fn(() => ({
                records: [],
                summary: { winner: 'white', plies: 4 }
            }))
        });

        const out = runner.runSelfPlayGames({
            shouldStop: () => {
                stopChecks += 1;
                return stopChecks > 1;
            }
        });

        expect(out.gameSummaries).toHaveLength(1);
        expect(out.summary).toEqual({
            schemaVersion: 'selfplay.v2',
            totalGames: 1,
            plannedGames: 3,
            aborted: true,
            totalPlies: 4,
            avgPlies: 4,
            wins: { black: 0, white: 1, draw: 0 }
        });
    });
});
