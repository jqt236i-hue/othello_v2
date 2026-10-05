/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayPolicySetupConfig = {
    SELFPLAY_SCHEMA_VERSION?: string;
    SeededPRNG?: any;
    cloneInitialDeckCardIdsByPlayer?: (initialDeckCardIdsByPlayer: any) => any;
};

export function createSelfplayPolicySetup(config?: SelfplayPolicySetupConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayPolicySetupConfig;
    const selfplaySchemaVersion = typeof cfg.SELFPLAY_SCHEMA_VERSION === 'string'
        ? cfg.SELFPLAY_SCHEMA_VERSION
        : 'selfplay.v2';
    const seededPRNG = cfg.SeededPRNG || {
        createPRNG: () => ({ random: () => 0 })
    };
    const cloneInitialDeckCardIdsByPlayer = typeof cfg.cloneInitialDeckCardIdsByPlayer === 'function'
        ? cfg.cloneInitialDeckCardIdsByPlayer
        : (() => null);

    function clamp01(value: any, fallback: any) {
        if (!Number.isFinite(value)) {
            return Number.isFinite(fallback)
                ? Math.max(0, Math.min(1, Number(fallback)))
                : 0;
        }
        return Math.max(0, Math.min(1, Number(value)));
    }

    function normalizeLookaheadTimeBudget(value: any, fallback: any) {
        if (!Number.isFinite(value)) return fallback;
        return Math.max(0, Math.floor(Number(value)));
    }

    function normalizeLookaheadVirtualTimePerNodeMs(value: any, fallback: any) {
        if (!Number.isFinite(value)) return fallback;
        return Math.max(0, Number(value));
    }

    function normalizeTacticalSearchNodeBudget(value: any, fallback: any) {
        if (!Number.isFinite(value)) return fallback;
        return Math.max(0, Math.min(100_000, Math.floor(Number(value))));
    }

    function normalizePlayerNumberMap(value: any) {
        if (!value || typeof value !== 'object') return null;
        const out: Record<string, number> = {};
        let has = false;
        for (const playerKey of ['black', 'white']) {
            if (Number.isFinite(value[playerKey])) {
                out[playerKey] = Number(value[playerKey]);
                has = true;
            }
        }
        return has ? out : null;
    }

    function normalizeDecisionProviderByPlayer(value: any) {
        if (!value || typeof value !== 'object') return null;
        const providers: Record<string, any> = {};
        let hasProvider = false;
        for (const playerKey of ['black', 'white']) {
            if (typeof value[playerKey] === 'function') {
                providers[playerKey] = value[playerKey];
                hasProvider = true;
            }
        }
        return hasProvider ? providers : null;
    }

    function normalizeOptions(options: any) {
        const opts = options || {};
        const initialDeckCardIdsByPlayer = cloneInitialDeckCardIdsByPlayer(opts.initialDeckCardIdsByPlayer);
        const policyMixRate = Number.isFinite(opts.policyMixRate)
            ? Math.max(0, Math.min(1, Number(opts.policyMixRate)))
            : 1;
        const cardUsageRateJitter = Number.isFinite(opts.cardUsageRateJitter)
            ? Math.max(0, Math.min(1, Number(opts.cardUsageRateJitter)))
            : 0;
        const tacticalWeightMin = Number.isFinite(opts.tacticalWeightMin)
            ? Math.max(0, Number(opts.tacticalWeightMin))
            : 1;
        const tacticalWeightMaxRaw = Number.isFinite(opts.tacticalWeightMax)
            ? Math.max(0, Number(opts.tacticalWeightMax))
            : tacticalWeightMin;
        const tacticalWeightMax = Math.max(tacticalWeightMin, tacticalWeightMaxRaw);
        const policyScoreWeightMin = Number.isFinite(opts.policyScoreWeightMin)
            ? Math.max(0, Number(opts.policyScoreWeightMin))
            : 1;
        const policyScoreWeightMaxRaw = Number.isFinite(opts.policyScoreWeightMax)
            ? Math.max(0, Number(opts.policyScoreWeightMax))
            : policyScoreWeightMin;
        const policyScoreWeightMax = Math.max(policyScoreWeightMin, policyScoreWeightMaxRaw);
        const heuristicWeightMin = Number.isFinite(opts.heuristicWeightMin)
            ? Math.max(0, Number(opts.heuristicWeightMin))
            : 1;
        const heuristicWeightMaxRaw = Number.isFinite(opts.heuristicWeightMax)
            ? Math.max(0, Number(opts.heuristicWeightMax))
            : heuristicWeightMin;
        const heuristicWeightMax = Math.max(heuristicWeightMin, heuristicWeightMaxRaw);
        const tacticalDepthOpening = Number.isFinite(opts.tacticalDepthOpening)
            ? Math.max(0, Math.floor(Number(opts.tacticalDepthOpening)))
            : 2;
        const tacticalDepthMid = Number.isFinite(opts.tacticalDepthMid)
            ? Math.max(0, Math.floor(Number(opts.tacticalDepthMid)))
            : 3;
        const tacticalDepthEnd = Number.isFinite(opts.tacticalDepthEnd)
            ? Math.max(0, Math.floor(Number(opts.tacticalDepthEnd)))
            : 4;
        const tacticalBeamWidth = Number.isFinite(opts.tacticalBeamWidth)
            ? Math.max(1, Math.floor(Number(opts.tacticalBeamWidth)))
            : 0;
        const teacherCommitteeWeightMin = Number.isFinite(opts.teacherCommitteeWeightMin)
            ? Math.max(0, Number(opts.teacherCommitteeWeightMin))
            : 28;
        const teacherCommitteeWeightMaxRaw = Number.isFinite(opts.teacherCommitteeWeightMax)
            ? Math.max(0, Number(opts.teacherCommitteeWeightMax))
            : teacherCommitteeWeightMin;
        const teacherCommitteeWeightMax = Math.max(teacherCommitteeWeightMin, teacherCommitteeWeightMaxRaw);
        const teacherCommitteeConsensusBonusMin = Number.isFinite(opts.teacherCommitteeConsensusBonusMin)
            ? Math.max(0, Number(opts.teacherCommitteeConsensusBonusMin))
            : 320;
        const teacherCommitteeConsensusBonusMaxRaw = Number.isFinite(opts.teacherCommitteeConsensusBonusMax)
            ? Math.max(0, Number(opts.teacherCommitteeConsensusBonusMax))
            : teacherCommitteeConsensusBonusMin;
        const teacherCommitteeConsensusBonusMax = Math.max(
            teacherCommitteeConsensusBonusMin,
            teacherCommitteeConsensusBonusMaxRaw
        );
        return {
            schemaVersion: selfplaySchemaVersion,
            games: Number.isFinite(opts.games) ? Math.max(1, Math.floor(opts.games)) : 10,
            baseSeed: Number.isFinite(opts.baseSeed) ? Math.floor(opts.baseSeed) : 1,
            gameIndexOffset: Number.isFinite(opts.gameIndexOffset) ? Math.max(0, Math.floor(opts.gameIndexOffset)) : 0,
            maxPlies: Number.isFinite(opts.maxPlies) ? Math.max(1, Math.floor(opts.maxPlies)) : 220,
            gameRetryCount: Number.isFinite(opts.gameRetryCount) ? Math.max(0, Math.floor(opts.gameRetryCount)) : 4,
            allowCardUsage: opts.allowCardUsage !== false,
            cardUsageRate: Number.isFinite(opts.cardUsageRate) ? Math.max(0, Math.min(1, opts.cardUsageRate)) : 0.2,
            enableTacticalLookahead: opts.enableTacticalLookahead !== false,
            policyMixRate,
            cardUsageRateJitter,
            tacticalWeightMin,
            tacticalWeightMax,
            policyScoreWeightMin,
            policyScoreWeightMax,
            heuristicWeightMin,
            heuristicWeightMax,
            tacticalDepthOpening,
            tacticalDepthMid,
            tacticalDepthEnd,
            tacticalBeamWidth,
            tacticalSearchNodeBudget: normalizeTacticalSearchNodeBudget(
                opts.tacticalSearchNodeBudget,
                Number.NaN
            ),
            teacherCommitteeWeightMin,
            teacherCommitteeWeightMax,
            teacherCommitteeConsensusBonusMin,
            teacherCommitteeConsensusBonusMax,
            playerPolicies: opts.playerPolicies || null,
            playerPolicyResolver: typeof opts.playerPolicyResolver === 'function'
                ? opts.playerPolicyResolver
                : null,
            seedFamily: typeof opts.seedFamily === 'string' && opts.seedFamily.trim()
                ? opts.seedFamily.trim()
                : 'train',
            dataLane: typeof opts.dataLane === 'string' && opts.dataLane.trim()
                ? opts.dataLane.trim()
                : 'selfplay-games',
            shouldStop: typeof opts.shouldStop === 'function' ? opts.shouldStop : null,
            onRecord: typeof opts.onRecord === 'function' ? opts.onRecord : null,
            onGameEnd: typeof opts.onGameEnd === 'function' ? opts.onGameEnd : null,
            onGameRetryHardcase: typeof opts.onGameRetryHardcase === 'function' ? opts.onGameRetryHardcase : null,
            initialDeckCardIdsByPlayer,
            // 持ち石ルール（01-rulebook.md §7.3）。学習データ互換のため自己対戦の既定は OFF。
            stoneSupplyEnabled: opts.stoneSupplyEnabled === true,
            // CPU 対戦条件（例: Lv9〜12 の初期チャージ 99・獲得 2 倍）を再現する場合だけ指定する。
            initialChargeByPlayer: normalizePlayerNumberMap(opts.initialChargeByPlayer),
            chargeGainMultiplierByPlayer: normalizePlayerNumberMap(opts.chargeGainMultiplierByPlayer),
            // CPU 比較用: プレイヤー別に decideAction 相当の関数を差し替える（未指定は通常の自己対戦方針）。
            decisionProviderByPlayer: normalizeDecisionProviderByPlayer(opts.decisionProviderByPlayer)
        };
    }

    function getPolicyForPlayer(options: any, playerKey: any) {
        const base = {
            allowCardUsage: options.allowCardUsage,
            cardUsageRate: options.cardUsageRate,
            enableTacticalLookahead: options.enableTacticalLookahead !== false,
            disableLookaheadTimeBudget: false,
            lookaheadMaxTimeMs: Number.NaN,
            lookaheadEndgameMaxTimeMs: Number.NaN,
            lookaheadVirtualTimePerNodeMs: 10,
            tacticalWeight: Number.NaN,
            policyScoreWeight: Number.NaN,
            heuristicWeight: Number.NaN,
            tacticalDepthOpening: Number.isFinite(options.tacticalDepthOpening) ? Math.max(0, Math.floor(options.tacticalDepthOpening)) : 2,
            tacticalDepthMid: Number.isFinite(options.tacticalDepthMid) ? Math.max(0, Math.floor(options.tacticalDepthMid)) : 3,
            tacticalDepthEnd: Number.isFinite(options.tacticalDepthEnd) ? Math.max(0, Math.floor(options.tacticalDepthEnd)) : 4,
            tacticalBeamWidth: Number.isFinite(options.tacticalBeamWidth) ? Math.max(1, Math.floor(options.tacticalBeamWidth)) : 0,
            tacticalSearchNodeBudget: normalizeTacticalSearchNodeBudget(
                options.tacticalSearchNodeBudget,
                Number.NaN
            ),
            teacherCommitteeWeight: Number.NaN,
            teacherCommitteeConsensusBonus: Number.NaN
        };
        if (!options.playerPolicies || !options.playerPolicies[playerKey]) return base;
        const override = options.playerPolicies[playerKey];
        return {
            allowCardUsage: override.allowCardUsage !== undefined ? !!override.allowCardUsage : base.allowCardUsage,
            cardUsageRate: Number.isFinite(override.cardUsageRate)
                ? Math.max(0, Math.min(1, override.cardUsageRate))
                : base.cardUsageRate,
            policyTableModel: override.policyTableModel || null,
            enableTacticalLookahead: override.enableTacticalLookahead !== undefined
                ? !!override.enableTacticalLookahead
                : base.enableTacticalLookahead,
            disableLookaheadTimeBudget: override.disableLookaheadTimeBudget !== undefined
                ? !!override.disableLookaheadTimeBudget
                : base.disableLookaheadTimeBudget,
            lookaheadMaxTimeMs: normalizeLookaheadTimeBudget(override.lookaheadMaxTimeMs, base.lookaheadMaxTimeMs),
            lookaheadEndgameMaxTimeMs: normalizeLookaheadTimeBudget(
                override.lookaheadEndgameMaxTimeMs,
                base.lookaheadEndgameMaxTimeMs
            ),
            lookaheadVirtualTimePerNodeMs: normalizeLookaheadVirtualTimePerNodeMs(
                override.lookaheadVirtualTimePerNodeMs,
                base.lookaheadVirtualTimePerNodeMs
            ),
            tacticalWeight: Number.isFinite(override.tacticalWeight)
                ? Math.max(0, override.tacticalWeight)
                : base.tacticalWeight,
            policyScoreWeight: Number.isFinite(override.policyScoreWeight)
                ? Math.max(0, override.policyScoreWeight)
                : Number.NaN,
            heuristicWeight: Number.isFinite(override.heuristicWeight)
                ? Math.max(0, override.heuristicWeight)
                : Number.NaN,
            tacticalDepthOpening: Number.isFinite(override.tacticalDepthOpening)
                ? Math.max(0, Math.floor(override.tacticalDepthOpening))
                : base.tacticalDepthOpening,
            tacticalDepthMid: Number.isFinite(override.tacticalDepthMid)
                ? Math.max(0, Math.floor(override.tacticalDepthMid))
                : base.tacticalDepthMid,
            tacticalDepthEnd: Number.isFinite(override.tacticalDepthEnd)
                ? Math.max(0, Math.floor(override.tacticalDepthEnd))
                : base.tacticalDepthEnd,
            tacticalBeamWidth: Number.isFinite(override.tacticalBeamWidth)
                ? Math.max(1, Math.floor(override.tacticalBeamWidth))
                : base.tacticalBeamWidth,
            tacticalSearchNodeBudget: normalizeTacticalSearchNodeBudget(
                override.tacticalSearchNodeBudget,
                base.tacticalSearchNodeBudget
            ),
            teacherCommitteeWeight: Number.isFinite(override.teacherCommitteeWeight)
                ? Math.max(0, Number(override.teacherCommitteeWeight))
                : base.teacherCommitteeWeight,
            teacherCommitteeConsensusBonus: Number.isFinite(override.teacherCommitteeConsensusBonus)
                ? Math.max(0, Number(override.teacherCommitteeConsensusBonus))
                : base.teacherCommitteeConsensusBonus
        };
    }

    function buildPerGamePolicySet(options: any, seed: any, gameIndex: any) {
        const baseBlack = getPolicyForPlayer(options, 'black');
        const baseWhite = getPolicyForPlayer(options, 'white');
        const mixRate = clamp01(options.policyMixRate, 1);
        const jitter = clamp01(options.cardUsageRateJitter, 0);
        const tacticalWeightMin = Number.isFinite(options.tacticalWeightMin)
            ? Math.max(0, Number(options.tacticalWeightMin))
            : 1;
        const tacticalWeightMax = Number.isFinite(options.tacticalWeightMax)
            ? Math.max(tacticalWeightMin, Number(options.tacticalWeightMax))
            : tacticalWeightMin;
        const policyScoreWeightMin = Number.isFinite(options.policyScoreWeightMin)
            ? Math.max(0, Number(options.policyScoreWeightMin))
            : 1;
        const policyScoreWeightMax = Number.isFinite(options.policyScoreWeightMax)
            ? Math.max(policyScoreWeightMin, Number(options.policyScoreWeightMax))
            : policyScoreWeightMin;
        const heuristicWeightMin = Number.isFinite(options.heuristicWeightMin)
            ? Math.max(0, Number(options.heuristicWeightMin))
            : 1;
        const heuristicWeightMax = Number.isFinite(options.heuristicWeightMax)
            ? Math.max(heuristicWeightMin, Number(options.heuristicWeightMax))
            : heuristicWeightMin;
        const teacherCommitteeWeightMin = Number.isFinite(options.teacherCommitteeWeightMin)
            ? Math.max(0, Number(options.teacherCommitteeWeightMin))
            : 28;
        const teacherCommitteeWeightMax = Number.isFinite(options.teacherCommitteeWeightMax)
            ? Math.max(teacherCommitteeWeightMin, Number(options.teacherCommitteeWeightMax))
            : teacherCommitteeWeightMin;
        const teacherCommitteeConsensusBonusMin = Number.isFinite(options.teacherCommitteeConsensusBonusMin)
            ? Math.max(0, Number(options.teacherCommitteeConsensusBonusMin))
            : 320;
        const teacherCommitteeConsensusBonusMax = Number.isFinite(options.teacherCommitteeConsensusBonusMax)
            ? Math.max(teacherCommitteeConsensusBonusMin, Number(options.teacherCommitteeConsensusBonusMax))
            : teacherCommitteeConsensusBonusMin;
        const rng = seededPRNG.createPRNG((Number(seed) || 0) + ((Number(gameIndex) || 0) * 7919) + 97);

        const buildOne = (base: any) => {
            const allowCardUsage = base.allowCardUsage !== false;
            const baseRate = clamp01(base.cardUsageRate, options.cardUsageRate);
            const jitterDelta = jitter > 0 ? ((rng.random() * 2) - 1) * jitter : 0;
            const cardUsageRate = clamp01(baseRate + jitterDelta, baseRate);
            const canUseModel = !!base.policyTableModel;
            const useModel = canUseModel && (rng.random() < mixRate);
            const enableTacticalLookahead = base.enableTacticalLookahead !== false;
            const tacticalWeight = enableTacticalLookahead
                ? (
                    Number.isFinite(base.tacticalWeight)
                        ? Math.max(0, Number(base.tacticalWeight))
                        : (tacticalWeightMin + ((tacticalWeightMax - tacticalWeightMin) * rng.random()))
                )
                : 0;
            const policyScoreWeight = Number.isFinite(base.policyScoreWeight)
                ? Math.max(0, Number(base.policyScoreWeight))
                : (useModel
                    ? (policyScoreWeightMin + ((policyScoreWeightMax - policyScoreWeightMin) * rng.random()))
                    : 0);
            const heuristicWeight = Number.isFinite(base.heuristicWeight)
                ? Math.max(0, Number(base.heuristicWeight))
                : (heuristicWeightMin + ((heuristicWeightMax - heuristicWeightMin) * rng.random()));
            const teacherCommitteeWeight = Number.isFinite(base.teacherCommitteeWeight)
                ? Math.max(0, Number(base.teacherCommitteeWeight))
                : (
                    teacherCommitteeWeightMin +
                    ((teacherCommitteeWeightMax - teacherCommitteeWeightMin) * rng.random())
                );
            const teacherCommitteeConsensusBonus = Number.isFinite(base.teacherCommitteeConsensusBonus)
                ? Math.max(0, Number(base.teacherCommitteeConsensusBonus))
                : (
                    teacherCommitteeConsensusBonusMin +
                    ((teacherCommitteeConsensusBonusMax - teacherCommitteeConsensusBonusMin) * rng.random())
                );

            return {
                allowCardUsage,
                cardUsageRate,
                policyTableModel: useModel ? base.policyTableModel : null,
                enableTacticalLookahead,
                disableLookaheadTimeBudget: base.disableLookaheadTimeBudget === true,
                lookaheadMaxTimeMs: normalizeLookaheadTimeBudget(base.lookaheadMaxTimeMs, Number.NaN),
                lookaheadEndgameMaxTimeMs: normalizeLookaheadTimeBudget(base.lookaheadEndgameMaxTimeMs, Number.NaN),
                lookaheadVirtualTimePerNodeMs: normalizeLookaheadVirtualTimePerNodeMs(base.lookaheadVirtualTimePerNodeMs, Number.NaN),
                tacticalWeight,
                policyScoreWeight: useModel ? policyScoreWeight : 0,
                heuristicWeight,
                tacticalDepthOpening: Number.isFinite(base.tacticalDepthOpening) ? Math.max(0, Math.floor(base.tacticalDepthOpening)) : 2,
                tacticalDepthMid: Number.isFinite(base.tacticalDepthMid) ? Math.max(0, Math.floor(base.tacticalDepthMid)) : 3,
                tacticalDepthEnd: Number.isFinite(base.tacticalDepthEnd) ? Math.max(0, Math.floor(base.tacticalDepthEnd)) : 4,
                tacticalBeamWidth: Number.isFinite(base.tacticalBeamWidth) ? Math.max(1, Math.floor(base.tacticalBeamWidth)) : 0,
                tacticalSearchNodeBudget: normalizeTacticalSearchNodeBudget(
                    base.tacticalSearchNodeBudget,
                    Number.NaN
                ),
                teacherCommitteeWeight,
                teacherCommitteeConsensusBonus
            };
        };

        return {
            black: buildOne(baseBlack),
            white: buildOne(baseWhite)
        };
    }

    return {
        clamp01,
        normalizeLookaheadTimeBudget,
        normalizeLookaheadVirtualTimePerNodeMs,
        normalizeTacticalSearchNodeBudget,
        normalizeOptions,
        getPolicyForPlayer,
        buildPerGamePolicySet
    };
}
