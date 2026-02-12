const { runSelfPlayGames } = require('../src/engine/selfplay-runner');

describe('selfplay runner', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('is deterministic for the same config/seed', () => {
        const options = {
            games: 2,
            baseSeed: 123,
            maxPlies: 80,
            allowCardUsage: false
        };

        const a = runSelfPlayGames(options);
        const b = runSelfPlayGames(options);

        expect(a.summary).toEqual(b.summary);
        expect(a.gameSummaries).toEqual(b.gameSummaries);
        expect(a.records).toEqual(b.records);
    });

    test('produces winner/outcome labels for each record', () => {
        const result = runSelfPlayGames({
            games: 1,
            baseSeed: 7,
            maxPlies: 100,
            allowCardUsage: false
        });

        expect(result.summary.totalGames).toBe(1);
        expect(result.records.length).toBeGreaterThan(0);
        expect(['black', 'white', 'draw']).toContain(result.gameSummaries[0].winner);

        for (const rec of result.records) {
            expect(['black', 'white']).toContain(rec.player);
            expect(['place', 'pass', 'use_card', 'cancel_card']).toContain(rec.actionType);
            expect(['black', 'white', 'draw']).toContain(rec.winner);
            expect([-1, 0, 1]).toContain(rec.outcome);
            expect(typeof rec.board).toBe('string');
            expect(Array.isArray(rec.handCards)).toBe(true);
            expect(Array.isArray(rec.usableCardIds)).toBe(true);
        }
    });

    test('cards enabled smoke run does not throw', () => {
        const result = runSelfPlayGames({
            games: 1,
            baseSeed: 11,
            maxPlies: 80,
            allowCardUsage: true,
            cardUsageRate: 0.25
        });
        expect(result.summary.totalGames).toBe(1);
        expect(result.records.length).toBeGreaterThan(0);
    });
});
