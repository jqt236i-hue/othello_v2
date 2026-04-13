(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let SharedBoardUtilsModule = null;
        try {
            SharedBoardUtilsModule = require('./shared-board-utils');
        } catch (e) { /* ignore */ }
        module.exports = factory(SharedBoardUtilsModule);
    } else {
        root.CpuLv6RuntimeCapability = factory(root.SharedBoardUtils || null);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (SharedBoardUtilsModule) {
    'use strict';

    function normalizeCpuLv6DecisionMode(mode) {
        return String(mode || '').trim().toLowerCase();
    }

    function resolveCpuLv6BrowserProfile(sharedProfile) {
        const shared = sharedProfile && typeof sharedProfile === 'object' ? sharedProfile : null;
        return shared && shared.browser && typeof shared.browser === 'object'
            ? shared.browser
            : null;
    }

    function resolveCpuLv6TeacherProfile(sharedProfile) {
        const shared = sharedProfile && typeof sharedProfile === 'object' ? sharedProfile : null;
        return shared && shared.teacher && typeof shared.teacher === 'object'
            ? shared.teacher
            : null;
    }

    function usesOnnxMoveDecisionMode(mode) {
        const normalized = normalizeCpuLv6DecisionMode(mode);
        if (!normalized) return true;
        return normalized !== 'policy-table-lookahead' &&
            normalized !== 'browser-policy-lookahead' &&
            normalized !== 'policy-table-core';
    }

    function usesOnnxCardDecisionMode(mode) {
        const normalized = normalizeCpuLv6DecisionMode(mode);
        if (!normalized) return true;
        return normalized !== 'policy-table-core';
    }

    function readGuardNumber(overrides, configured, key, fallback) {
        const overrideValue = Number(overrides && overrides[key]);
        if (Number.isFinite(overrideValue)) return overrideValue;
        const configuredValue = Number(configured && configured[key]);
        if (Number.isFinite(configuredValue)) return configuredValue;
        return fallback;
    }

    function resolveCpuLv6OnnxRuntimeGuard(sharedProfile, options) {
        const browserProfile = resolveCpuLv6BrowserProfile(sharedProfile);
        const configured = browserProfile && browserProfile.onnxRuntimeGuard && typeof browserProfile.onnxRuntimeGuard === 'object'
            ? browserProfile.onnxRuntimeGuard
            : null;
        const opts = options && typeof options === 'object' ? options : {};
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

    function resolveCpuLv6BrowserRuntimeCapability(sharedProfile, options) {
        const browserProfile = resolveCpuLv6BrowserProfile(sharedProfile);
        const opts = options && typeof options === 'object' ? options : {};
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

    function resolveCpuLv6LookaheadTimeCaps(sharedProfile, options) {
        const browserProfile = resolveCpuLv6BrowserProfile(sharedProfile);
        const configuredCaps = browserProfile && browserProfile.lookaheadTimeCaps && typeof browserProfile.lookaheadTimeCaps === 'object'
            ? browserProfile.lookaheadTimeCaps
            : null;
        const opts = options && typeof options === 'object' ? options : {};
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

    function resolveCpuLv6LookaheadWeights(sharedProfile) {
        const browserProfile = resolveCpuLv6BrowserProfile(sharedProfile);
        const configured = browserProfile && browserProfile.lookaheadWeights && typeof browserProfile.lookaheadWeights === 'object'
            ? browserProfile.lookaheadWeights
            : null;
        return {
            onnxRefinePriorWeight: Number(configured && configured.onnxRefinePriorWeight) || 66,
            policyLookaheadPriorWeight: Number(configured && configured.policyLookaheadPriorWeight) || 62,
            searchWeight: Number(configured && configured.searchWeight) || 1.8
        };
    }

    function isStandardBoardCpuPolicyCompatible(board) {
        try {
            if (SharedBoardUtilsModule && typeof SharedBoardUtilsModule.isStandardBoard8x8 === 'function') {
                return SharedBoardUtilsModule.isStandardBoard8x8(board);
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
