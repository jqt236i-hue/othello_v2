"use strict";
/**
 * @file publish-request.ts
 * @description Network publish request builder
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
var networkCommandPayloadModule = null;
function resolveNetworkCommandPayloadModule() {
    if (networkCommandPayloadModule)
        return networkCommandPayloadModule;
    if (typeof _require === 'function') {
        try {
            networkCommandPayloadModule = _require('./command-payload');
        }
        catch (e) { /* ignore */ }
    }
    const root = (typeof globalThis !== 'undefined' ? globalThis : {});
    if (!networkCommandPayloadModule && root && root.NetworkCommandPayloadModule) {
        networkCommandPayloadModule = root.NetworkCommandPayloadModule;
    }
    return networkCommandPayloadModule;
}
function cloneData(value) {
    try {
        if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
            return globalThis.structuredClone(value);
        }
    }
    catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(value));
}
function buildPublishRequest(info, options) {
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
        : (commandPayloadModule && typeof commandPayloadModule.buildPublishCommandPayload === 'function'
            ? commandPayloadModule.buildPublishCommandPayload(source, opts.commandPayloadOptions || { playerKey: playerKey })
            : null);
    if (!commandPayload)
        return null;
    const queuedActionType = commandPayload.actionType
        ? commandPayload.actionType
        : (source.actionType || null);
    const requestPayload = {
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
    const requestTurnIndex = Number.isFinite(Number(opts.turnIndex))
        ? Math.trunc(Number(opts.turnIndex))
        : (Number.isFinite(Number(commandPayload.turnIndex)) ? Math.trunc(Number(commandPayload.turnIndex)) : null);
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
module.exports = {
    buildPublishRequest
};
//# sourceMappingURL=publish-request.js.map