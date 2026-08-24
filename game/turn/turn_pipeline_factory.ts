/**
 * @file turn_pipeline_factory.ts
 * @description Shared pure turn pipeline factory for local/headless and Worker authority runtimes.
 */

'use strict';

import PlayerEncoding = require('../../shared/player-encoding');
import defaultDeepClone = require('../../utils/deepClone');
import StateHash = require('../../shared/state-hash');
import {
  assertTurnRuntimeServices,
  createTurnRuntimeServices,
  isCardRuntimeUnavailableError,
  type TurnRuntimeServices
} from './turn-runtime-services';

type TurnPipelineDeps = {
  CardLogic: any;
  Core: any;
  TurnPipelinePhases: any;
  BoardOps?: any;
  SubPlacementContinuation?: any;
  deepClone?: (value: any) => any;
  normalizePlayerKey?: (player: any, Core?: any) => string | null;
  validateState?: (gameState: any, cardState: any) => { valid: boolean; errors?: any };
  computeStateHash?: (gameState: any, cardState: any, prngState: any) => string | null;
};

function asRecord(value: any): Record<string, any> {
  return value && typeof value === 'object' ? value : {};
}

function defaultNormalizePlayerKey(player: any, Core: any): string | null {
  if (PlayerEncoding && typeof PlayerEncoding.parseSeatKeyOptional === 'function') {
    const normalized = PlayerEncoding.parseSeatKeyOptional(player);
    if (normalized) return normalized;
  }
  if (player === (Core && Core.BLACK) || player === 'black') return 'black';
  if (player === (Core && Core.WHITE) || player === 'white') return 'white';
  return null;
}

function resolveDeepClone(explicitDeepClone: any): (value: any) => any {
  if (typeof explicitDeepClone === 'function') return explicitDeepClone;
  if (typeof defaultDeepClone !== 'function') {
    throw new Error('deepClone util is required for applyTurnSafe');
  }
  return defaultDeepClone;
}

function defaultComputeStateHash(gameState: any, cardState: any, _prngState: any): string | null {
  if (!StateHash || typeof StateHash.computeStableHash !== 'function') return null;
  return StateHash.computeStableHash({ gameState, cardState });
}

function createTurnPipelineModule(deps: TurnPipelineDeps): any {
  const normalizePlayerKey = typeof deps?.normalizePlayerKey === 'function'
    ? (player: any) => deps.normalizePlayerKey!(player, Core)
    : (player: any) => defaultNormalizePlayerKey(player, Core);
  const computeStateHash = typeof deps.computeStateHash === 'function'
    ? deps.computeStateHash
    : defaultComputeStateHash;
  const services: TurnRuntimeServices = createTurnRuntimeServices({
    cardLogic: deps.CardLogic,
    core: deps.Core,
    phases: deps.TurnPipelinePhases,
    boardOps: deps.BoardOps,
    subPlacement: deps.SubPlacementContinuation,
    deepClone: resolveDeepClone(deps.deepClone),
    normalizePlayerKey,
    validateState: deps.validateState,
    computeStateHash
  });
  const CardLogic = services.cardLogic;
  const Core = services.core;
  const TurnPipelinePhases = services.phases;
  const BoardOps = services.boardOps;
  const SubPlacementContinuation = services.subPlacement;

  function flushPresentationEvents(cardState: any): any[] {
    const cardStateRecord = asRecord(cardState);
    const queuedPresentationEvents = Array.isArray(cardStateRecord.presentationEvents)
      ? cardStateRecord.presentationEvents.slice()
      : [];
    const flushedPresentationEvents = CardLogic && typeof CardLogic.flushPresentationEvents === 'function'
      ? CardLogic.flushPresentationEvents(cardState)
      : queuedPresentationEvents;
    let presentationEvents = Array.isArray(flushedPresentationEvents)
      ? flushedPresentationEvents
      : [];
    if (presentationEvents.length === 0 && queuedPresentationEvents.length > 0) {
      presentationEvents = queuedPresentationEvents;
    }
    if (
      presentationEvents.length === 0
      && Array.isArray(cardStateRecord._presentationEventsPersist)
      && cardStateRecord._presentationEventsPersist.length > 0
    ) {
      presentationEvents = cardStateRecord._presentationEventsPersist.slice();
    }
    return presentationEvents;
  }

  function applyTurn(cardState: any, gameState: any, playerKey: any, action: any, prng?: any, options?: any): any {
    assertTurnRuntimeServices(services);
    const events: any[] = [];
    const p = prng && typeof prng.random === 'function' ? prng : undefined;
    const opts = asRecord(options);
    const normalizedPlayerKey = normalizePlayerKey(playerKey) || playerKey;
    const cardStateRecord = asRecord(cardState);
    const actionRecord = asRecord(action);
    const previousBoardOpsRandomSource = cardStateRecord._boardOpsRandomSource;
    if (cardState && p) {
      cardStateRecord._boardOpsRandomSource = p;
    }
    try {
      const skipTurnStartForSubPlacement = (
        SubPlacementContinuation &&
        typeof SubPlacementContinuation.isSubPlacementTurnActive === 'function' &&
        SubPlacementContinuation.isSubPlacementTurnActive(cardState, normalizedPlayerKey)
      );
      if (opts.skipTurnStart !== true && skipTurnStartForSubPlacement !== true) {
        if (!TurnPipelinePhases || typeof TurnPipelinePhases.applyTurnStartPhase !== 'function') {
          throw new Error('TurnPipelinePhases.applyTurnStartPhase is required');
        }
        const turnStartResult = TurnPipelinePhases.applyTurnStartPhase(
          CardLogic,
          Core,
          cardState,
          gameState,
          normalizedPlayerKey,
          events,
          p,
          BoardOps
        );
        if (turnStartResult && turnStartResult.stopAction === true) {
          return { gameState, cardState, events, presentationEvents: flushPresentationEvents(cardState) };
        }
      }

      if (!TurnPipelinePhases || typeof TurnPipelinePhases.applyCardUsagePhase !== 'function') {
        throw new Error('TurnPipelinePhases.applyCardUsagePhase is required');
      }
      TurnPipelinePhases.applyCardUsagePhase(CardLogic, cardState, gameState, normalizedPlayerKey, action, events, p);

      const actionMeta = {
        actionId: actionRecord.actionId || null,
        turnIndex: cardStateRecord.turnIndex || 0,
        plyIndex: 0,
        randomSource: p || null
      };
      if (cardState && BoardOps && typeof BoardOps.setActionContext === 'function') {
        BoardOps.setActionContext(cardState, actionMeta);
      } else if (cardState) {
        cardStateRecord._currentActionMeta = actionMeta;
      }
      try {
        if (!TurnPipelinePhases || typeof TurnPipelinePhases.applyActionPhase !== 'function') {
          throw new Error('TurnPipelinePhases.applyActionPhase is required');
        }
        TurnPipelinePhases.applyActionPhase(CardLogic, Core, cardState, gameState, normalizedPlayerKey, action, events, p, BoardOps);
      } finally {
        if (cardState && BoardOps && typeof BoardOps.clearActionContext === 'function') {
          BoardOps.clearActionContext(cardState);
        } else if (cardState) {
          delete cardStateRecord._currentActionMeta;
        }
      }

      return { gameState, cardState, events, presentationEvents: flushPresentationEvents(cardState) };
    } finally {
      if (cardState) {
        if (previousBoardOpsRandomSource && typeof previousBoardOpsRandomSource.random === 'function') {
          cardStateRecord._boardOpsRandomSource = previousBoardOpsRandomSource;
        } else {
          delete cardStateRecord._boardOpsRandomSource;
        }
      }
    }
  }

  function applyTurnSafe(cardState: any, gameState: any, playerKey: any, action: any, prng?: any, options?: any): any {
    try {
      assertTurnRuntimeServices(services);
    } catch (error) {
      if (!isCardRuntimeUnavailableError(error)) throw error;
      const currentVersion = (options && typeof options.currentStateVersion === 'number')
        ? options.currentStateVersion
        : 0;
      const rejection = {
        ok: false,
        gameState,
        cardState,
        events: [],
        nextStateVersion: currentVersion,
        rejectedReason: 'RUNTIME_UNAVAILABLE',
        errorMessage: error.message
      };
      Object.defineProperty(rejection, 'runtimeError', { value: error, enumerable: false });
      return rejection;
    }
    const deepClone = services.deepClone;
    const cs = deepClone(cardState);
    const gs = deepClone(gameState);
    const actionRecord = asRecord(action);
    const opts = asRecord(options);
    const actionPlayerKey = normalizePlayerKey(playerKey);
    const currentPlayerKey = normalizePlayerKey(gs && gs.currentPlayer);
    const currentVersion = (typeof opts.currentStateVersion === 'number') ? opts.currentStateVersion : 0;

    let effectivePipelinePlayerKey = actionPlayerKey;
    if (actionPlayerKey && currentPlayerKey && actionPlayerKey !== currentPlayerKey) {
      const fateWillController = asRecord(cs.fateWillControllerByTurnOwner)[currentPlayerKey];
      if (fateWillController === actionPlayerKey) {
        effectivePipelinePlayerKey = currentPlayerKey;
      } else {
        const events = [{ type: 'action_rejected', player: playerKey, reason: 'OUT_OF_TURN', message: 'playerKey does not match gameState.currentPlayer' }];
        return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'OUT_OF_TURN' };
      }
    }

    if (actionRecord.actionId && Array.isArray(opts.previousActionIds) && opts.previousActionIds.includes(actionRecord.actionId)) {
      const events = [{ type: 'action_rejected', player: playerKey, reason: 'DUPLICATE_ACTION', message: 'actionId already seen' }];
      return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'DUPLICATE_ACTION' };
    }
    if (typeof actionRecord.turnIndex === 'number' && typeof opts.currentStateVersion === 'number' && actionRecord.turnIndex !== opts.currentStateVersion) {
      const events = [{ type: 'action_rejected', player: playerKey, reason: 'OUT_OF_ORDER', message: 'action.turnIndex does not match currentStateVersion' }];
      return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'OUT_OF_ORDER' };
    }
    if (typeof opts.expectedStateVersion === 'number' && opts.expectedStateVersion !== currentVersion) {
      const events = [{ type: 'action_rejected', player: playerKey, reason: 'VERSION_MISMATCH', message: 'expectedStateVersion mismatch' }];
      return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'VERSION_MISMATCH' };
    }

    try {
      const result = applyTurn(cs, gs, effectivePipelinePlayerKey || playerKey, action, prng, options);

      if (typeof services.validateState === 'function') {
        const validation = services.validateState(result.gameState, result.cardState);
        if (validation && validation.valid === false) {
          const events = [{ type: 'action_rejected', player: playerKey, reason: 'INVALID_STATE', message: 'State validation failed', details: validation.errors }];
          return { ok: false, gameState: gs, cardState: cs, events, nextStateVersion: currentVersion, rejectedReason: 'INVALID_STATE', errorMessage: 'State validation failed' };
        }
      }

      const prngState = (prng && typeof prng.getState === 'function')
        ? prng.getState()
        : (opts.prngState !== undefined ? opts.prngState : (prng && prng._seed ? { _seed: prng._seed } : null));
      if (result && result.cardState) {
        result.cardState.prngState = prngState;
      }
      const stateHash = computeStateHash(result.gameState, result.cardState, prngState);

      return {
        ok: true,
        gameState: result.gameState,
        cardState: result.cardState,
        events: result.events,
        presentationEvents: result.presentationEvents || [],
        nextStateVersion: currentVersion + 1,
        stateHash
      };
    } catch (e: any) {
      if (isCardRuntimeUnavailableError(e)) {
        const rejection = {
          ok: false,
          gameState,
          cardState,
          events: [],
          nextStateVersion: currentVersion,
          rejectedReason: 'RUNTIME_UNAVAILABLE',
          errorMessage: e.message
        };
        Object.defineProperty(rejection, 'runtimeError', { value: e, enumerable: false });
        return rejection;
      }
      const rawMsg = (e && e.message) ? String(e.message) : 'unknown_error';
      const includeStack = (
        typeof process !== 'undefined' &&
        process &&
        process.env &&
        process.env.SELFPLAY_DEBUG_STACK === '1'
      );
      const msg = (includeStack && e && e.stack) ? String(e.stack) : rawMsg;
      let reason = 'UNKNOWN';
      if (rawMsg.includes('Illegal pass') || rawMsg.includes('Illegal auto pass')) reason = 'ILLEGAL_PASS';
      else if (rawMsg.includes('Illegal move')) reason = 'ILLEGAL_MOVE';
      else if (rawMsg.includes('applyCardUsage failed')) reason = 'CARD_USE_FAILED';
      else if (rawMsg.includes('requires')) reason = 'MISSING_REQUIRED_TARGET';
      else if (rawMsg.includes('Unknown action.type')) reason = 'UNKNOWN_ACTION_TYPE';
      else if (rawMsg.includes('HASH_UNAVAILABLE')) reason = 'HASH_UNAVAILABLE';

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

  return {
    applyTurn,
    applyTurnSafe
  };
}

export = {
  createTurnPipelineModule
};
