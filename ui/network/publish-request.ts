/**
 * @file publish-request.ts
 * @description Network publish request builder
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface CommandPayload {
  actionType?: string;
  turnIndex?: number;
  actor?: string;
  params?: Record<string, unknown>;
  actionId?: string;
}

interface PublishRequestInfo {
  actionType?: string;
  action?: Record<string, unknown>;
}

interface PublishRequestOptions {
  playerKey?: string;
  operationId?: string;
  buildPublishCommandPayload?: (source: PublishRequestInfo, playerKey?: string) => CommandPayload | null;
  commandPayloadOptions?: { playerKey?: string };
  roomId?: string;
  seatKey?: string;
  seatToken?: string;
  baseVersion?: number;
  turnIndex?: number;
}

interface NetworkCommandPayloadModule {
  buildPublishCommandPayload?: (source: PublishRequestInfo, options: { playerKey?: string }) => CommandPayload | null;
}

interface PublishRequestResult {
  commandPayload: CommandPayload;
  queuedActionType: string | null;
  requestPayload: {
    roomId: string | null;
    seatKey: string | null;
    seatToken: string | null;
    playerKey: string | undefined;
    actionType: string | null;
    operationId: string | undefined;
    baseVersion: number | undefined;
    actor: string | undefined;
    params: Record<string, unknown>;
    actionId?: string;
    turnIndex?: number;
    action?: Record<string, unknown>;
  };
}

var networkCommandPayloadModule: NetworkCommandPayloadModule | null = null;

function resolveNetworkCommandPayloadModule(): NetworkCommandPayloadModule | null {
  if (networkCommandPayloadModule) return networkCommandPayloadModule;
  if (typeof _require === 'function') {
    try { networkCommandPayloadModule = _require('./command-payload'); } catch (e) { /* ignore */ }
  }
  const root = (typeof globalThis !== 'undefined' ? globalThis : {}) as Window & { NetworkCommandPayloadModule?: NetworkCommandPayloadModule };
  if (!networkCommandPayloadModule && root && root.NetworkCommandPayloadModule) {
    networkCommandPayloadModule = root.NetworkCommandPayloadModule;
  }
  return networkCommandPayloadModule;
}

function cloneData<T>(value: T): T {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value);
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(value));
}

function buildPublishRequest(info: PublishRequestInfo, options: PublishRequestOptions): PublishRequestResult | null {
  const source = (info && typeof info === 'object') ? info : {};
  const opts = (options && typeof options === 'object') ? options : {};
  const playerKey = opts.playerKey;
  const operationId = opts.operationId;
  const commandPayloadBuilder = typeof opts.buildPublishCommandPayload === 'function'
    ? opts.buildPublishCommandPayload
    : null;
  const commandPayloadModule = resolveNetworkCommandPayloadModule();
  const commandPayload = commandPayloadBuilder
    ? commandPayloadBuilder(source, playerKey)
    : (
      commandPayloadModule && typeof commandPayloadModule.buildPublishCommandPayload === 'function'
        ? commandPayloadModule.buildPublishCommandPayload(source, opts.commandPayloadOptions || { playerKey: playerKey })
        : null
    );

  if (!commandPayload) return null;

  const queuedActionType = commandPayload.actionType
    ? commandPayload.actionType
    : (source.actionType || null);
  const requestPayload: PublishRequestResult['requestPayload'] = {
    roomId: opts.roomId || null,
    seatKey: opts.seatKey || null,
    seatToken: opts.seatToken || null,
    playerKey: playerKey,
    actionType: queuedActionType,
    operationId: operationId,
    baseVersion: opts.baseVersion,
    actor: undefined,
    params: {}
  };
  const hasPendingSelectionState = !!(
    commandPayload.params &&
    typeof commandPayload.params === 'object' &&
    (commandPayload.params as Record<string, unknown>).pendingSelectionState
  );
  const commandTurnIndex = Number.isFinite(Number(commandPayload.turnIndex))
    ? Math.trunc(Number(commandPayload.turnIndex))
    : null;
  const optionTurnIndex = Number.isFinite(Number(opts.turnIndex))
    ? Math.trunc(Number(opts.turnIndex))
    : null;
  const normalizedQueuedActionType = String(queuedActionType || '').trim().toLowerCase();
  const requestTurnIndex = hasPendingSelectionState && commandTurnIndex !== null
    ? commandTurnIndex
    : (
      normalizedQueuedActionType === 'use_card' && optionTurnIndex !== null && commandTurnIndex !== null
        ? Math.max(optionTurnIndex, commandTurnIndex)
        : (optionTurnIndex !== null ? optionTurnIndex : commandTurnIndex)
    );

  requestPayload.actor = commandPayload.actor || playerKey;
  requestPayload.params = commandPayload.params || {};
  if (commandPayload.actionId) {
    requestPayload.actionId = commandPayload.actionId;
  }
  if (requestTurnIndex !== null) {
    requestPayload.turnIndex = requestTurnIndex;
  }
  if (source.action && typeof source.action === 'object') {
    requestPayload.action = cloneData(source.action);
  }

  return {
    commandPayload: commandPayload,
    queuedActionType: queuedActionType,
    requestPayload: requestPayload
  };
}

export = {
  buildPublishRequest
};
