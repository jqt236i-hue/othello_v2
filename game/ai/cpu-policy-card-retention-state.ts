import type { CpuPolicyCardContext } from './cpu-policy-core-types';

function toSafeInt(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
}

function toSafeNumber(value: unknown, fallback = 0): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

export function createCpuPolicyCardRetentionState() {
    function buildCpuPolicyCardRetentionState(context: CpuPolicyCardContext | null | undefined) {
        const ctx = (context && typeof context === 'object') ? context as Record<string, unknown> : {};
        const ownCorners = toSafeNumber(ctx.ownCorners);
        const oppCorners = toSafeNumber(ctx.oppCorners);
        const hasCornerMoveNow = ctx.hasCornerMoveNow === true;
        const hasEdgeMoveNow = ctx.hasEdgeMoveNow === true;
        const cornerEmergency = !!ctx.cornerEmergency || (oppCorners > ownCorners);
        const level = toSafeInt(ctx.level);
        const playerValue = toSafeNumber(ctx.playerValue, 1);
        const whiteLv6Mode = ctx.whiteLv6Mode === true || (level >= 6 && playerValue < 0);
        const recoveryCostGap = Math.max(0, toSafeNumber(ctx.recoveryCostGap));
        const maxLegalFlips = toSafeInt(ctx.maxLegalFlips);
        const maxLegalGain = Math.max(0, toSafeNumber(ctx.maxLegalGain, maxLegalFlips));
        const maxLegalBoardBonus = Math.max(0, toSafeNumber(ctx.maxLegalBoardBonus));
        const highBonusMoveAvailable = ctx.highBonusMoveAvailable === true;
        const oppHandSize = toSafeInt(ctx.oppHandSize);
        const ownSpecialCount = toSafeInt(ctx.ownSpecialCount);
        const oppSpecialCount = toSafeInt(ctx.oppSpecialCount);
        const ownCornerResetCount = toSafeInt(ctx.ownCornerResetCount);
        const oppCornerResetCount = toSafeInt(ctx.oppCornerResetCount);
        const ownEdgeResetCount = toSafeInt(ctx.ownEdgeResetCount);
        const oppEdgeResetCount = toSafeInt(ctx.oppEdgeResetCount);
        const ownAnchorResetWeight = (ownCornerResetCount * 2) + ownEdgeResetCount;
        const oppAnchorResetWeight = (oppCornerResetCount * 2) + oppEdgeResetCount;

        return {
            ownCorners,
            oppCorners,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            whiteLv6Mode,
            recoveryCostGap,
            maxLegalFlips,
            maxLegalGain,
            maxLegalBoardBonus,
            highBonusMoveAvailable,
            oppHandSize,
            ownSpecialCount,
            oppSpecialCount,
            ownCornerResetCount,
            oppCornerResetCount,
            ownEdgeResetCount,
            oppEdgeResetCount,
            ownAnchorResetWeight,
            oppAnchorResetWeight
        };
    }

    return {
        buildCpuPolicyCardRetentionState
    };
}
