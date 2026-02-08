/**
 * @file turn_pipeline.js
 * @description Pure turn driver used by headless tests. UMD化してブラウザでもグローバル TurnPipeline.applyTurn として利用できるようにした。
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../logic/cards'),
            require('../logic/core'),
            require('./turn_pipeline_phases'),
            require('../logic/board_ops')
        );
    } else {
        root.TurnPipeline = factory(root.CardLogic, root.Core || root.CoreLogic, root.TurnPipelinePhases, root.BoardOps);
    }
}(typeof self !== 'undefined' ? self : this, function (CardLogic, Core, TurnPipelinePhases, BoardOps) {
    if (!CardLogic || !Core) {
        throw new Error('TurnPipeline: CardLogic/Core is not available.');
    }
    if (!TurnPipelinePhases) {
        throw new Error('TurnPipeline: TurnPipelinePhases is not available.');
    }

    /**
     * Apply a single action within a turn, following a fixed turn pipeline.
     * - action: { type: 'place' | 'pass' | 'use_card' | 'cancel_card', row?, col?, useCardId?, useCardOwnerKey?, debugOptions?, cancelOptions?, destroyTarget?: {row:number,col:number}, strongWindTarget?: {row:number,col:number}, sacrificeTarget?: {row:number,col:number}, sellCardId?: string, temptTarget?, inheritTarget? }
     * - If useCardId is provided it will be applied before placement (consuming charge/hand)
     * Returns { gameState, cardState, events }
     *
     * Note: Originally headless-only. Now UMD so the browser can call the same pipeline.
     */
    function applyTurn(cardState, gameState, playerKey, action, prng) {
        const events = [];
        const p = prng || undefined;
        // 1) Turn start processing
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, playerKey, events, p);

        // 2) Card usage (optional)
        TurnPipelinePhases.applyCardUsagePhase(CardLogic, cardState, gameState, playerKey, action, events);

        // 3) Action
    // Attach action meta to cardState so BoardOps and other helpers can populate presentationEvents with action metadata
    const actionMeta = { actionId: action && action.actionId ? action.actionId : null, turnIndex: cardState.turnIndex || 0, plyIndex: 0 };
    // Prefer explicit BoardOps API to set/clear action context
    if (BoardOps && typeof BoardOps.setActionContext === 'function') {
        BoardOps.setActionContext(cardState, actionMeta);
    } else {
        cardState._currentActionMeta = actionMeta;
    }
    try {
        TurnPipelinePhases.applyActionPhase(CardLogic, Core, cardState, gameState, playerKey, action, events, p, BoardOps);
    } finally {
        if (BoardOps && typeof BoardOps.clearActionContext === 'function') {
            BoardOps.clearActionContext(cardState);
        } else {
            delete cardState._currentActionMeta;
        }
    }

        // Collect presentation events produced during phases
        const presentationEvents = (typeof CardLogic.flushPresentationEvents === 'function')
            ? CardLogic.flushPresentationEvents(cardState)
            : (cardState.presentationEvents || []).slice();

        return { gameState, cardState, events, presentationEvents };
    }

    /**
     * Safe wrapper for applyTurn for online/server usage.
     * - Never mutates input objects (clones before applying)
     * - Never throws; returns ok=false with a reason code instead
     * - Returns full Result schema with nextStateVersion
     *
     * @param {object} cardState
     * @param {object} gameState
     * @param {string} playerKey
     * @param {object} action
     * @param {object} prng
     * @param {object} [options] - Optional settings
     * @param {number} [options.currentStateVersion] - Current state version
     * @returns {{ ok: boolean, gameState: object, cardState: object, events: Array, nextStateVersion: number, rejectedReason?: string, errorMessage?: string }}
     */
    function applyTurnSafe(cardState, gameState, playerKey, action, prng, options) {
        const deepClone = (typeof require === 'function') ? require('../../utils/deepClone') : (globalThis && globalThis.structuredClone ? globalThis.structuredClone : null);
        if (!deepClone) throw new Error('deepClone util is required for applyTurnSafe');
        const cs = deepClone(cardState);
        const gs = deepClone(gameState);
        const currentVersion = (options && typeof options.currentStateVersion === 'number')
            ? options.currentStateVersion
            : 0;

        // Protocol guards (duplicate/out-of-order/version mismatch)
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
            const res = applyTurn(cs, gs, playerKey, action, prng);

            // Validate resulting state (be tolerant of missing schema modules in browser-like env)
            var StateValidatorModule = null;
            if (typeof require === 'function') {
                try {
                    StateValidatorModule = require('../schema/state_validator');
                } catch (e) {
                    StateValidatorModule = null;
                }
            } else if (typeof StateValidator !== 'undefined') {
                StateValidatorModule = StateValidator;
            }
            if (StateValidatorModule && typeof StateValidatorModule.validateState === 'function') {
                const validation = StateValidatorModule.validateState(res.gameState, res.cardState);
                if (!validation.valid) {
                    const events = [{ type: 'action_rejected', player: playerKey, reason: 'INVALID_STATE', message: 'State validation failed', details: validation.errors }];
                    return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'INVALID_STATE', errorMessage: 'State validation failed' };
                }
            }

            // Increment version on success
            const nextStateVersion = currentVersion + 1;

            // Compute stateHash synchronously for protocol compliance (tolerate missing result module)
            var ResultSchemaModule = null;
            if (typeof require === 'function') {
                try {
                    ResultSchemaModule = require('../schema/result');
                } catch (e) {
                    ResultSchemaModule = null;
                }
            } else if (typeof ResultSchema !== 'undefined') {
                ResultSchemaModule = ResultSchema;
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
        } catch (e) {
            const msg = (e && e.message) ? String(e.message) : 'unknown_error';
            // Keep reason codes short/stable for protocol usage.
            let reason = 'UNKNOWN';
            if (msg.includes('Illegal move')) reason = 'ILLEGAL_MOVE';
            else if (msg.includes('applyCardUsage failed')) reason = 'CARD_USE_FAILED';
            else if (msg.includes('requires')) reason = 'MISSING_REQUIRED_TARGET';
            else if (msg.includes('Unknown action.type')) reason = 'UNKNOWN_ACTION_TYPE';
            else if (msg.includes('HASH_UNAVAILABLE')) reason = 'HASH_UNAVAILABLE';

            const events = [{ type: 'action_rejected', player: playerKey, reason, message: msg }];
            // Do not increment version on rejection
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

    return { applyTurn, applyTurnSafe };
}));
