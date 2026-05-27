/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayBatchRunnerConfig = {
    normalizeOptions?: (options: any) => any;
    buildPerGamePolicySet?: (options: any, seed: any, gameIndex: any) => any;
    runSingleGameWithRetries?: (gameIndex: any, seed: any, options: any, perGameOptions: any) => any;
};

export function createSelfplayBatchRunner(config?: SelfplayBatchRunnerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayBatchRunnerConfig;
    const normalizeOptions = typeof cfg.normalizeOptions === 'function'
        ? cfg.normalizeOptions
        : ((options: any) => options || {});
    const buildPerGamePolicySet = typeof cfg.buildPerGamePolicySet === 'function'
        ? cfg.buildPerGamePolicySet
        : (() => ({ black: null, white: null }));
    const runSingleGameWithRetries = typeof cfg.runSingleGameWithRetries === 'function'
        ? cfg.runSingleGameWithRetries
        : (() => ({ records: [], summary: { winner: 'draw', plies: 0 } }));

    function runSelfPlayGames(options: any) {
        const opts = normalizeOptions(options);
        const allRecords: any[] = [];
        const gameSummaries: any[] = [];
        const totals: Record<string, number> = { black: 0, white: 0, draw: 0 };
        let totalPlies = 0;

        for (let i = 0; i < opts.games; i++) {
            if (opts.shouldStop && opts.shouldStop()) {
                break;
            }
            const gameIndex = opts.gameIndexOffset + i;
            const seed = opts.baseSeed + i;
            const gamePlayerPolicies = opts.playerPolicyResolver
                ? opts.playerPolicyResolver(gameIndex, seed)
                : opts.playerPolicies;
            const perGameOpts = Object.assign({}, opts, { playerPolicies: gamePlayerPolicies || null });
            const perGamePolicies = buildPerGamePolicySet(
                perGameOpts,
                seed,
                gameIndex
            );
            const one = runSingleGameWithRetries(gameIndex, seed, opts, Object.assign({}, perGameOpts, {
                playerPolicies: perGamePolicies
            }));
            gameSummaries.push(one.summary);
            totals[one.summary.winner] += 1;
            totalPlies += one.summary.plies;

            for (const rec of one.records) {
                if (opts.onRecord) opts.onRecord(rec);
                else allRecords.push(rec);
            }
            if (opts.onGameEnd) opts.onGameEnd(one.summary);
        }

        return {
            records: opts.onRecord ? [] : allRecords,
            gameSummaries,
            summary: {
                schemaVersion: opts.schemaVersion,
                totalGames: gameSummaries.length,
                plannedGames: opts.games,
                aborted: gameSummaries.length < opts.games,
                totalPlies,
                avgPlies: gameSummaries.length > 0 ? totalPlies / gameSummaries.length : 0,
                wins: totals
            }
        };
    }

    return {
        runSelfPlayGames
    };
}
