(function (root: any, factory) {
    if (typeof module === 'object' && module.exports) {
        let SharedBoardUtilsModule = null;
        try {
            SharedBoardUtilsModule = require('./shared-board-utils');
        } catch (e) { /* ignore */ }
        module.exports = factory(SharedBoardUtilsModule);
    } else {
        root.CpuLv6RuntimeCapability = factory(root.SharedBoardUtils || null);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this as Record<string, unknown>), function (SharedBoardUtilsModule: unknown) {
    'use strict';

    interface SharedProfile {
        browser?: { [key: string]: unknown };
        teacher?: { [key: string]: unknown };
        default?: unknown;
        [key: string]: unknown;
    }

    interface BrowserProfile {
        moveDecisionMode?: string;
        cardDecisionMode?: string;
        onnxRuntimeGuard?: { [key: string]: unknown };
        lookaheadTimeCaps?: LookaheadTimeCaps;
        lookaheadWeights?: LookaheadWeights;
        pendingSelectionOnnxMaxMs?: number;
        [key: string]: unknown;
    }

    interface LookaheadTimeCaps {
        whiteUi?: TimeCapConfig;
        whiteHeadless?: TimeCapConfig;
        black?: TimeCapConfig;
    }

    interface TimeCapConfig {
        moveCapMs: number;
        endgameCapMs: number;
        quiescenceMoveCapMs: number;
        quiescenceEndgameCapMs: number;
        quiescenceEndgameMinMs: number;
    }

    interface LookaheadWeights {
        onnxRefinePriorWeight?: number;
        policyLookaheadPriorWeight?: number;
        searchWeight?: number;
    }

    interface RuntimeCapability {
        browserProfile: BrowserProfile | null;
        moveDecisionMode: string;
        cardDecisionMode: string;
        primaryMoveSource: string;
        primaryCardSource: string;
        usesOnnxMoveDecision: boolean;
        usesOnnxCardDecision: boolean;
        usesPolicyTableLookaheadMoveDecision: boolean;
        usesPolicyTableCoreCardDecision: boolean;
        shouldLoadPrimaryOnnxRuntime: boolean;
        hasAuxiliaryTargetHead: boolean;
        hasAuxiliaryValueHead: boolean;
        onnxRuntimeGuard: OnnxRuntimeGuard;
    }

    interface OnnxRuntimeGuard {
        minSamples: number;
        maxAverageLatencyMs: number;
        maxP95LatencyMs: number;
        maxMaxLatencyMs: number;
        moveBudgetMs: number;
        cardBudgetMs: number;
        pendingSelectionBudgetMs: number;
    }

    interface CapabilityOptions {
        forcePrimaryOnnx?: boolean;
        guardOverrides?: { [key: string]: number };
        legacyPendingSelectionBudgetMs?: number;
        playerKey?: string;
        isBrowserUi?: boolean;
    }

    function normalizeCpuLv6DecisionMode(mode: unknown): string {
        return String(mode || '').trim().toLowerCase();
    }

    function resolveCpuLv6BrowserProfile(sharedProfile: unknown): BrowserProfile | null {
        const rawShared = sharedProfile && typeof sharedProfile === 'object' ? sharedProfile as SharedProfile : null;
        const shared = rawShared && rawShared.default && typeof rawShared.default === 'object'
            ? rawShared.default as SharedProfile
            : rawShared;
        return shared && shared.browser && typeof shared.browser === 'object'
            ? shared.browser as BrowserProfile
            : null;
    }

    function resolveCpuLv6TeacherProfile(sharedProfile: unknown): BrowserProfile | null {
        const rawShared = sharedProfile && typeof sharedProfile === 'object' ? sharedProfile as SharedProfile : null;
        const shared = rawShared && rawShared.default && typeof rawShared.default === 'object'
            ? rawShared.default as SharedProfile
            : rawShared;
        return shared && shared.teacher && typeof shared.teacher === 'object'
            ? shared.teacher as BrowserProfile
            : null;
    }

    function usesOnnxMoveDecisionMode(mode: unknown): boolean {
        const normalized = normalizeCpuLv6DecisionMode(mode);
        if (!normalized) return true;
        return normalized !== 'policy-table-lookahead' &&
            normalized !== 'browser-policy-lookahead' &&
            normalized !== 'policy-table-core';
    }

    function usesOnnxCardDecisionMode(mode: unknown): boolean {
        const normalized = normalizeCpuLv6DecisionMode(mode);
        if (!normalized) return true;
        return normalized !== 'policy-table-core';
    }

    function readGuardNumber(
        overrides: { [key: string]: number } | null,
        configured: { [key: string]: unknown } | null,
        key: string,
        fallback: number
    ): number {
        const overrideValue = Number(overrides && overrides[key]);
        if (Number.isFinite(overrideValue)) return overrideValue;
        const configuredValue = Number(configured && configured[key]);
        if (Number.isFinite(configuredValue)) return configuredValue;
        return fallback;
    }

    function resolveCpuLv6OnnxRuntimeGuard(sharedProfile: unknown, options: unknown): OnnxRuntimeGuard {
        const browserProfile = resolveCpuLv6BrowserProfile(sharedProfile);
        const configured = browserProfile && browserProfile.onnxRuntimeGuard && typeof browserProfile.onnxRuntimeGuard === 'object'
            ? browserProfile.onnxRuntimeGuard as { [key: string]: unknown }
            : null;
        const opts = options && typeof options === 'object' ? options as CapabilityOptions : {};
        const overrides = opts.guardOverrides && typeof opts.guardOverrides === 'object'
            ? opts.guardOverrides
            : null;
        const legacyPendingSelectionBudgetMs = Number(opts.legacyPendingSelectionBudgetMs);
        const configuredPendingFallback = Number(browserProfile && browserProfile.pendingSelectionOnnxMaxMs) || 120;
        const pendingSelectionBudgetMs =
            Number.isFinite(legacyPendingSelectionBudgetMs) && legacyPendingSelectionBudgetMs > 0
                ? legacyPendingSelectionBudgetMs
                : readGuardNumber(overrides, configured, 'pendingSelectionBudgetMs', configuredPendingFallback);

        return {
            minSamples: Math.max(1, Math.floor(readGuardNumber(overrides, configured, 'minSamples', 4))),
            maxAverageLatencyMs: Math.max(0, readGuardNumber(overrides, configured, 'maxAverageLatencyMs', 0)),
            maxP95LatencyMs: Math.max(0, readGuardNumber(overrides, configured, 'maxP95LatencyMs', 0)),
            maxMaxLatencyMs: Math.max(0, readGuardNumber(overrides, configured, 'maxMaxLatencyMs', 0)),
            moveBudgetMs: Math.max(0, Math.floor(readGuardNumber(overrides, configured, 'moveBudgetMs', 0))),
            cardBudgetMs: Math.max(0, Math.floor(readGuardNumber(overrides, configured, 'cardBudgetMs', 0))),
            pendingSelectionBudgetMs: Math.max(0, Math.floor(pendingSelectionBudgetMs))
        };
    }

    function resolveCpuLv6BrowserRuntimeCapability(sharedProfile: unknown, options: unknown): RuntimeCapability {
        const browserProfile = resolveCpuLv6BrowserProfile(sharedProfile);
        const opts = options && typeof options === 'object' ? options as CapabilityOptions : {};
        const moveDecisionMode = normalizeCpuLv6DecisionMode(browserProfile && browserProfile.moveDecisionMode);
        const cardDecisionMode = normalizeCpuLv6DecisionMode(browserProfile && browserProfile.cardDecisionMode);
        const usesOnnxMoveDecision = usesOnnxMoveDecisionMode(moveDecisionMode);
        const usesOnnxCardDecision = usesOnnxCardDecisionMode(cardDecisionMode);
        const shouldLoadPrimaryOnnxRuntime =
            !browserProfile ||
            opts.forcePrimaryOnnx === true ||
            usesOnnxMoveDecision ||
            usesOnnxCardDecision;

        return {
            browserProfile,
            moveDecisionMode,
            cardDecisionMode,
            primaryMoveSource: usesOnnxMoveDecision ? 'onnx' : 'policy-table',
            primaryCardSource: usesOnnxCardDecision ? 'onnx' : 'policy-table',
            usesOnnxMoveDecision,
            usesOnnxCardDecision,
            usesPolicyTableLookaheadMoveDecision:
                !usesOnnxMoveDecision &&
                (moveDecisionMode === 'policy-table-lookahead' || moveDecisionMode === 'browser-policy-lookahead'),
            usesPolicyTableCoreCardDecision:
                !usesOnnxCardDecision &&
                cardDecisionMode === 'policy-table-core',
            shouldLoadPrimaryOnnxRuntime,
            hasAuxiliaryTargetHead: true,
            hasAuxiliaryValueHead: true,
            onnxRuntimeGuard: resolveCpuLv6OnnxRuntimeGuard(sharedProfile, opts)
        };
    }

    function resolveCpuLv6LookaheadTimeCaps(sharedProfile: unknown, options: unknown): TimeCapConfig {
        const browserProfile = resolveCpuLv6BrowserProfile(sharedProfile);
        const configuredCaps = browserProfile && browserProfile.lookaheadTimeCaps && typeof browserProfile.lookaheadTimeCaps === 'object'
            ? browserProfile.lookaheadTimeCaps as LookaheadTimeCaps
            : null;
        const opts = options && typeof options === 'object' ? options as CapabilityOptions : {};
        const playerKey = String(opts.playerKey || '').trim();
        const isWhite = playerKey === 'white';
        const isBrowserUi = opts.isBrowserUi === true;

        if (configuredCaps) {
            if (isWhite && isBrowserUi && configuredCaps.whiteUi) return configuredCaps.whiteUi;
            if (isWhite && configuredCaps.whiteHeadless) return configuredCaps.whiteHeadless;
            if (configuredCaps.black) return configuredCaps.black;
        }
        if (isWhite && isBrowserUi) {
            return {
                moveCapMs: 1100,
                endgameCapMs: 1600,
                quiescenceMoveCapMs: 900,
                quiescenceEndgameCapMs: 1500,
                quiescenceEndgameMinMs: 700
            };
        }
        if (isWhite) {
            return {
                moveCapMs: 900,
                endgameCapMs: 1300,
                quiescenceMoveCapMs: 750,
                quiescenceEndgameCapMs: 1200,
                quiescenceEndgameMinMs: 600
            };
        }
        return {
            moveCapMs: 1000,
            endgameCapMs: 1500,
            quiescenceMoveCapMs: 800,
            quiescenceEndgameCapMs: 1400,
            quiescenceEndgameMinMs: 700
        };
    }

    function resolveCpuLv6LookaheadWeights(sharedProfile: unknown): Required<LookaheadWeights> {
        const browserProfile = resolveCpuLv6BrowserProfile(sharedProfile);
        const configured = browserProfile && browserProfile.lookaheadWeights && typeof browserProfile.lookaheadWeights === 'object'
            ? browserProfile.lookaheadWeights as LookaheadWeights
            : null;
        return {
            onnxRefinePriorWeight: Number(configured && configured.onnxRefinePriorWeight) || 66,
            policyLookaheadPriorWeight: Number(configured && configured.policyLookaheadPriorWeight) || 62,
            searchWeight: Number(configured && configured.searchWeight) || 1.8
        };
    }

    function isStandardBoardCpuPolicyCompatible(board: unknown): boolean {
        try {
            if (
                SharedBoardUtilsModule &&
                typeof (SharedBoardUtilsModule as { isStandardBoard8x8?: (b: unknown) => boolean }).isStandardBoard8x8 === 'function'
            ) {
                return (SharedBoardUtilsModule as { isStandardBoard8x8: (b: unknown) => boolean }).isStandardBoard8x8(board);
            }
        } catch (e) { /* ignore */ }
        if (!Array.isArray(board) || board.length !== 8) return false;
        for (const row of board) {
            if (!Array.isArray(row) || row.length !== 8) return false;
        }
        return true;
    }

    return {
        normalizeCpuLv6DecisionMode,
        resolveCpuLv6BrowserProfile,
        resolveCpuLv6TeacherProfile,
        usesOnnxMoveDecisionMode,
        usesOnnxCardDecisionMode,
        resolveCpuLv6OnnxRuntimeGuard,
        resolveCpuLv6BrowserRuntimeCapability,
        resolveCpuLv6LookaheadTimeCaps,
        resolveCpuLv6LookaheadWeights,
        isStandardBoardCpuPolicyCompatible
    };
}));
