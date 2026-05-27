const { createSelfplayRetryController } = require('../src/engine/selfplay-retry-controller.js');

describe('selfplay retry controller module', () => {
    test('buildSelfplayRetrySeed stays deterministic across attempts', () => {
        const controller = createSelfplayRetryController({
            runSingleGame: () => ({})
        });

        expect(controller.buildSelfplayRetrySeed(10, 3, 1)).toBe(1000064);
        expect(controller.buildSelfplayRetrySeed(10, 3, 2)).toBe(2000067);
        expect(controller.buildSelfplayRetrySeed(undefined, 0, 0)).toBe(1000004);
    });

    test('runSingleGameWithRetries annotates retry success and emits hardcase metadata', () => {
        const warns = [];
        const hardcases = [];
        let calls = 0;
        const controller = createSelfplayRetryController({
            runSingleGame: (_gameIndex, effectiveSeed) => {
                calls += 1;
                if (calls === 1) {
                    const err = new Error('boom');
                    err.selfplayHardcase = { kind: 'reject' };
                    throw err;
                }
                return {
                    summary: {
                        seed: effectiveSeed
                    },
                    records: []
                };
            },
            warn: (message) => warns.push(message)
        });

        const result = controller.runSingleGameWithRetries(2, 100, {
            gameRetryCount: 1,
            onGameRetryHardcase: (payload) => hardcases.push(payload)
        }, { mode: 'test' });

        expect(result.summary.retryAttempt).toBe(1);
        expect(result.summary.originalSeed).toBe(100);
        expect(result.summary.seed).toBe(controller.buildSelfplayRetrySeed(100, 2, 1));
        expect(hardcases).toEqual([{
            kind: 'reject',
            originalSeed: 100,
            retrySeed: controller.buildSelfplayRetrySeed(100, 2, 1),
            retryAttempt: 1,
            retryLimit: 1,
            errorMessage: 'boom'
        }]);
        expect(warns).toHaveLength(1);
        expect(warns[0]).toContain('game retry game=2 attempt=1/1');
    });

    test('runSingleGameWithRetries throws final error after exhausting retries', () => {
        const controller = createSelfplayRetryController({
            runSingleGame: () => {
                throw new Error('still broken');
            },
            warn: () => {}
        });

        expect(() => controller.runSingleGameWithRetries(4, 7, {
            gameRetryCount: 2
        }, {})).toThrow('[SELFPLAY] game failed after retries game=4 seed=7 retries=2: still broken');
    });
});
