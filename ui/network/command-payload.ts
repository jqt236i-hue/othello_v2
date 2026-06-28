'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const OMITTED_ACTION_KEYS: Record<string, boolean> = Object.freeze({
  type: true,
  actionType: true,
  actor: true,
  playerKey: true,
  actionId: true,
  turnIndex: true,
  deferNetworkPublish: true,
  snapshot: true,
  playbackEvents: true
});

let networkActionSchemaModule: any = null;
const PlayerKeyHelpers = _require('./player-key');

function resolveNetworkActionSchemaModule(): any {
  if (networkActionSchemaModule) return networkActionSchemaModule;
  try {
    networkActionSchemaModule = _require('../../shared/network-action-schema');
  } catch (e) { /* ignore */ }
  if (!networkActionSchemaModule && typeof globalThis !== 'undefined' && (globalThis as any).NetworkActionSchema) {
    networkActionSchemaModule = (globalThis as any).NetworkActionSchema;
  }
  return networkActionSchemaModule;
}

function normalizePlayerKey(value: any, fallback?: any, override?: any): string {
  return PlayerKeyHelpers.normalizePlayerKey(value, fallback, {
    override,
    schema: resolveNetworkActionSchemaModule()
  });
}

function cloneData(value: any): any {
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).structuredClone === 'function') {
      return (globalThis as any).structuredClone(value);
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(value));
}

function serializeActionForCommandPayload(action: any, fallbackPlayerKey?: any, options?: any): any {
  if (!action || typeof action !== 'object') return null;

  const opts = (options && typeof options === 'object') ? options : {};
  const schema = resolveNetworkActionSchemaModule();
  if (schema && typeof schema.serializeAction === 'function') {
    const serialized = schema.serializeAction(action, fallbackPlayerKey);
    if (serialized) return serialized;
  }

  const actionType = String(action.type || action.actionType || '').trim().toLowerCase();
  if (!actionType) return null;

  const payload: any = {
    actionType: actionType,
    actor: normalizePlayerKey(fallbackPlayerKey || action.actor || action.playerKey, 'black', opts.normalizePlayerKey),
    params: {}
  };
  if (action.actionId) payload.actionId = String(action.actionId);
  if (Number.isFinite(Number(action.turnIndex))) payload.turnIndex = Math.trunc(Number(action.turnIndex));

  const keys = Object.keys(action);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (OMITTED_ACTION_KEYS[key]) continue;
    if (typeof action[key] === 'undefined') continue;
    payload.params[key] = cloneData(action[key]);
  }
  return payload;
}

function applyPendingSelectionCardContext(params: any, actor: string, options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  if (typeof opts.applyPendingSelectionCardContext === 'function') {
    opts.applyPendingSelectionCardContext(params, actor, params && params.pendingSelectionState, {
      action: opts.action
    });
    return params;
  }
  return params;
}

function buildPublishCommandPayload(info: any, options?: any): any {
  const source = (info && typeof info === 'object') ? info : {};
  const opts = (options && typeof options === 'object') ? options : {};
  const playerKey = normalizePlayerKey(opts.playerKey, 'black', opts.normalizePlayerKey);
  const action = (source.action && typeof source.action === 'object') ? source.action : null;
  const schema = resolveNetworkActionSchemaModule();
  const actionType = String(source.actionType || (action && (action.type || action.actionType)) || '').trim().toLowerCase();

  if (action) {
    const serialized = serializeActionForCommandPayload(action, playerKey, opts);
    if (serialized) {
      const params = (serialized.params && typeof serialized.params === 'object')
        ? serialized.params
        : {};
      applyPendingSelectionCardContext(
        params,
        serialized.actor || playerKey,
        {
          applyPendingSelectionCardContext: opts.applyPendingSelectionCardContext,
          action: action
        }
      );
      if (
        opts.includePlayerParam === true
        && serialized.actionType === 'place'
        && params
        && typeof params === 'object'
        && params.pendingSelectionState
        && (typeof params.player === 'undefined' || params.player === null || params.player === '')
      ) {
        params.player = serialized.actor || playerKey;
      }
      serialized.params = params;
      if (!schema || typeof schema.shouldUseCommandPayload !== 'function' || schema.shouldUseCommandPayload(serialized)) {
        return serialized;
      }
    }
  }

  if (actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart') {
    return {
      actionType: actionType,
      actor: playerKey,
      params: {}
    };
  }

  return null;
}

const CommandPayload = {
  serializeActionForCommandPayload,
  buildPublishCommandPayload
};

export = CommandPayload;
