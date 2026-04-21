(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root || (typeof globalThis !== 'undefined' ? globalThis : this));
    } else {
        root.NetworkPublishRequestModule = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    var networkCommandPayloadModule = null;

    function resolveNetworkCommandPayloadModule() {
        if (networkCommandPayloadModule) return networkCommandPayloadModule;
        if (typeof require === 'function') {
            try { networkCommandPayloadModule = require('./command-payload'); } catch (e) { /* ignore */ }
        }
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
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function buildPublishRequest(info, options) {
        var source = (info && typeof info === 'object') ? info : {};
        var opts = (options && typeof options === 'object') ? options : {};
        var playerKey = opts.playerKey;
        var operationId = opts.operationId;
        var commandPayloadBuilder = typeof opts.buildPublishCommandPayload === 'function'
            ? opts.buildPublishCommandPayload
            : null;
        var commandPayloadModule = resolveNetworkCommandPayloadModule();
        var commandPayload = commandPayloadBuilder
            ? commandPayloadBuilder(source, playerKey)
            : (
                commandPayloadModule && typeof commandPayloadModule.buildPublishCommandPayload === 'function'
                    ? commandPayloadModule.buildPublishCommandPayload(source, opts.commandPayloadOptions || { playerKey: playerKey })
                    : null
            );

        if (!commandPayload) return null;

        var queuedActionType = commandPayload.actionType
            ? commandPayload.actionType
            : (source.actionType || null);
        var requestPayload = {
            roomId: opts.roomId || null,
            seatKey: opts.seatKey || null,
            seatToken: opts.seatToken || null,
            playerKey: playerKey,
            actionType: queuedActionType,
            operationId: operationId,
            baseVersion: opts.baseVersion
        };
        var requestTurnIndex = Number.isFinite(Number(opts.turnIndex))
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

    return {
        buildPublishRequest: buildPublishRequest
    };
}));
