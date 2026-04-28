// @ts-nocheck
/**
 * @file turn_pipeline.ts
 * @description Pure turn driver used by headless tests.
 */
'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const CardLogic = _require('../logic/cards');
const Core = _require('../logic/core');
const TurnPipelinePhases = _require('./turn_pipeline_phases');
const BoardOps = _require('../logic/board_ops');
const OwnerHelpersModule = (() => {
    try {
        return _require('../../utils/owner-helpers');
    }
    catch (e) {
        return null;
    }
})();
function normalizePlayerKey(player) {
    if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
        const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(player);
        if (normalized)
            return normalized;
    }
    if (player === Core.BLACK || player === 'black')
        return 'black';
    if (player === Core.WHITE || player === 'white')
        return 'white';
    return null;
}
function applyTurn(cardState, gameState, playerKey, action, prng, options) {
    const events = [];
    const p = prng || undefined;
    const opts = (options && typeof options === 'object') ? options : {};
    const normalizedPlayerKey = normalizePlayerKey(playerKey) || playerKey;
    const previousBoardOpsRandomSource = cardState._boardOpsRandomSource;
    if (p && typeof p.random === 'function') {
        cardState._boardOpsRandomSource = p;
    }
    try {
        // 1) Turn start processing
        if (opts.skipTurnStart !== true) {
            TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, normalizedPlayerKey, events, p);
        }
        // 2) Card usage (optional)
        TurnPipelinePhases.applyCardUsagePhase(CardLogic, cardState, gameState, normalizedPlayerKey, action, events, p);
        // 3) Action
        const actionMeta = {
            actionId: action && action.actionId ? action.actionId : null,
            turnIndex: cardState.turnIndex || 0,
            plyIndex: 0,
            randomSource: (p && typeof p.random === 'function') ? p : null
        };
        if (BoardOps && typeof BoardOps.setActionContext === 'function') {
            BoardOps.setActionContext(cardState, actionMeta);
        }
        else {
            cardState._currentActionMeta = actionMeta;
        }
        try {
            TurnPipelinePhases.applyActionPhase(CardLogic, Core, cardState, gameState, normalizedPlayerKey, action, events, p, BoardOps);
        }
        finally {
            if (BoardOps && typeof BoardOps.clearActionContext === 'function') {
                BoardOps.clearActionContext(cardState);
            }
            else {
                delete cardState._currentActionMeta;
            }
        }
        // Collect presentation events produced during phases
        const presentationEvents = (typeof CardLogic.flushPresentationEvents === 'function')
            ? CardLogic.flushPresentationEvents(cardState)
            : (cardState.presentationEvents || []).slice();
        return { gameState, cardState, events, presentationEvents };
    }
    finally {
        if (previousBoardOpsRandomSource && typeof previousBoardOpsRandomSource.random === 'function') {
            cardState._boardOpsRandomSource = previousBoardOpsRandomSource;
        }
        else {
            delete cardState._boardOpsRandomSource;
        }
    }
}
function applyTurnSafe(cardState, gameState, playerKey, action, prng, options) {
    const deepClone = _require('../../utils/deepClone');
    if (!deepClone)
        throw new Error('deepClone util is required for applyTurnSafe');
    const cs = deepClone(cardState);
    const gs = deepClone(gameState);
    const actionPlayerKey = normalizePlayerKey(playerKey);
    const currentPlayerKey = normalizePlayerKey(gs && gs.currentPlayer);
    const currentVersion = (options && typeof options.currentStateVersion === 'number')
        ? options.currentStateVersion
        : 0;
    let effectivePipelinePlayerKey = actionPlayerKey;
    if (actionPlayerKey && currentPlayerKey && actionPlayerKey !== currentPlayerKey) {
        const fateWillController = (cs.fateWillControllerByTurnOwner || {})[currentPlayerKey];
        if (fateWillController === actionPlayerKey) {
            effectivePipelinePlayerKey = currentPlayerKey;
        }
        else {
            const events = [{ type: 'action_rejected', player: playerKey, reason: 'OUT_OF_TURN', message: 'playerKey does not match gameState.currentPlayer' }];
            return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'OUT_OF_TURN' };
        }
    }
    // Protocol guards
    if (action && action.actionId && options && Array.isArray(options.previousActionIds)) {
        if (options.previousActionIds.includes(action.actionId)) {
            const events = [{ type: 'action_rejected', player: playerKey, reason: 'DUPLICATE_ACTION', message: 'actionId already seen' }];
            return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'DUPLICATE_ACTION' };
        }
    }
    if (action && typeof action.turnIndex === 'number' && options && typeof options.currentStateVersion === 'number') {
        if (action.turnIndex !== options.currentStateVersion) {
            const events = [{ type: 'action_rejected', player: playerKey, reason: 'OUT_OF_ORDER', message: 'action.turnIndex does not match currentStateVersion' }];
            return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'OUT_OF_ORDER' };
        }
    }
    if (options && typeof options.expectedStateVersion === 'number') {
        if (options.expectedStateVersion !== currentVersion) {
            const events = [{ type: 'action_rejected', player: playerKey, reason: 'VERSION_MISMATCH', message: 'expectedStateVersion mismatch' }];
            return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'VERSION_MISMATCH' };
        }
    }
    try {
        const res = applyTurn(cs, gs, effectivePipelinePlayerKey || playerKey, action, prng, options);
        // Validate resulting state
        let StateValidatorModule = null;
        try {
            StateValidatorModule = _require('../schema/state_validator');
        }
        catch (e) {
            StateValidatorModule = null;
        }
        if (StateValidatorModule && typeof StateValidatorModule.validateState === 'function') {
            const validation = StateValidatorModule.validateState(res.gameState, res.cardState);
            if (!validation.valid) {
                const events = [{ type: 'action_rejected', player: playerKey, reason: 'INVALID_STATE', message: 'State validation failed', details: validation.errors }];
                return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'INVALID_STATE', errorMessage: 'State validation failed' };
            }
        }
        const nextStateVersion = currentVersion + 1;
        let ResultSchemaModule = null;
        try {
            ResultSchemaModule = _require('../schema/result');
        }
        catch (e) {
            ResultSchemaModule = null;
        }
        const prngState = (options && options.prngState) ? options.prngState : (prng && prng._seed ? { _seed: prng._seed } : null);
        const stateHash = (ResultSchemaModule && typeof ResultSchemaModule.extractHashableState === 'function' && typeof ResultSchemaModule.computeStateHashSync === 'function')
            ? ResultSchemaModule.computeStateHashSync(ResultSchemaModule.extractHashableState(res.gameState, res.cardState, prngState))
            : null;
        return {
            ok: true,
            gameState: res.gameState,
            cardState: res.cardState,
            events: res.events,
            presentationEvents: res.presentationEvents || [],
            nextStateVersion,
            stateHash
        };
    }
    catch (e) {
        const rawMsg = (e && e.message) ? String(e.message) : 'unknown_error';
        const includeStack = (typeof process !== 'undefined' &&
            process &&
            process.env &&
            process.env.SELFPLAY_DEBUG_STACK === '1');
        const msg = (includeStack && e && e.stack) ? String(e.stack) : rawMsg;
        let reason = 'UNKNOWN';
        if (rawMsg.includes('Illegal move'))
            reason = 'ILLEGAL_MOVE';
        else if (rawMsg.includes('applyCardUsage failed'))
            reason = 'CARD_USE_FAILED';
        else if (rawMsg.includes('requires'))
            reason = 'MISSING_REQUIRED_TARGET';
        else if (rawMsg.includes('Unknown action.type'))
            reason = 'UNKNOWN_ACTION_TYPE';
        else if (rawMsg.includes('HASH_UNAVAILABLE'))
            reason = 'HASH_UNAVAILABLE';
        const events = [{ type: 'action_rejected', player: playerKey, reason, message: msg }];
        return {
            ok: false,
            gameState: gs,
            cardState: cs,
            events,
            nextStateVersion: currentVersion,
            rejectedReason: reason,
            errorMessage: msg
        };
    }
}
module.exports = { applyTurn, applyTurnSafe };
//# sourceMappingURL=turn_pipeline.js.map