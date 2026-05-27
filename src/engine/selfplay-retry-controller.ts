/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayRetryControllerConfig = {
    runSingleGame?: (gameIndex: any, seed: any, options: any) => any;
    warn?: (message: string) => void;
};

export function createSelfplayRetryController(config?: SelfplayRetryControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayRetryControllerConfig;
    const runSingleGame = typeof cfg.runSingleGame === 'function'
        ? cfg.runSingleGame
        : (() => {
            throw new Error('runSingleGame is required');
        });
    const warn = typeof cfg.warn === 'function'
        ? cfg.warn
        : ((message: string) => {
            if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                console.warn(message);
            }
        });

    function buildSelfplayRetrySeed(seed: any, gameIndex: any, attempt: any) {
        const base = Number.isFinite(seed) ? Math.floor(seed) : 1;
        const index = Number.isFinite(gameIndex) ? Math.floor(gameIndex) : 0;
        const retry = Math.max(1, Math.floor(Number(attempt) || 1));
        return base + (retry * 1000003) + (index * 17);
    }

    function runSingleGameWithRetries(gameIndex: any, seed: any, opts: any, perGameOptions: any) {
        const retryCount = Number.isFinite(opts && opts.gameRetryCount)
            ? Math.max(0, Math.floor(opts.gameRetryCount))
            : 0;
        let lastError = null;

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            const effectiveSeed = attempt === 0
                ? seed
                : buildSelfplayRetrySeed(seed, gameIndex, attempt);
            try {
                const one = runSingleGame(gameIndex, effectiveSeed, perGameOptions);
                if (attempt > 0 && one && one.summary) {
                    one.summary.retryAttempt = attempt;
                    one.summary.originalSeed = seed;
                    one.summary.seed = effectiveSeed;
                }
                return one;
            } catch (err: any) {
                lastError = err;
                if (attempt >= retryCount) break;
                if (opts && opts.onGameRetryHardcase && err && err.selfplayHardcase) {
                    opts.onGameRetryHardcase(Object.assign({}, err.selfplayHardcase, {
                        originalSeed: seed,
                        retrySeed: buildSelfplayRetrySeed(seed, gameIndex, attempt + 1),
                        retryAttempt: attempt + 1,
                        retryLimit: retryCount,
                        errorMessage: err && err.message ? String(err.message) : String(err)
                    }));
                }
                const message = err && err.message ? String(err.message) : String(err);
                warn(
                    `[SELFPLAY] game retry game=${gameIndex} attempt=${attempt + 1}/${retryCount} ` +
                    `seed=${seed} retrySeed=${buildSelfplayRetrySeed(seed, gameIndex, attempt + 1)} reason=${message}`
                );
            }
        }

        const msg = lastError && (lastError as any).message
            ? String((lastError as any).message)
            : String(lastError || 'unknown');
        throw new Error(`[SELFPLAY] game failed after retries game=${gameIndex} seed=${seed} retries=${retryCount}: ${msg}`);
    }

    return {
        buildSelfplayRetrySeed,
        runSingleGameWithRetries
    };
}
