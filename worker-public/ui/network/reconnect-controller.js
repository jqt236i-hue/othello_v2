(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root || (typeof globalThis !== 'undefined' ? globalThis : this));
    } else {
        root.NetworkReconnectControllerModule = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function createNetworkReconnectController(config) {
        var cfg = (config && typeof config === 'object') ? config : {};
        var getState = typeof cfg.getState === 'function' ? cfg.getState : function () { return null; };
        var scheduleTimeout = typeof cfg.scheduleTimeout === 'function'
            ? cfg.scheduleTimeout
            : function (fn, ms) { return setTimeout(fn, ms); };
        var clearScheduledTimeout = typeof cfg.clearScheduledTimeout === 'function'
            ? cfg.clearScheduledTimeout
            : function (id) { clearTimeout(id); };

        function readState() {
            var state = getState();
            if (!state || typeof state !== 'object') {
                throw new Error('network_reconnect_state_required');
            }
            return state;
        }

        function maybeSyncFromHeartbeat(payload) {
            var state = readState();
            var remoteVersion = Number.isFinite(Number(payload && payload.stateVersion))
                ? Number(payload.stateVersion)
                : null;
            if (remoteVersion === null) return;

            var localVersion = typeof cfg.getAppliedStateVersion === 'function'
                ? cfg.getAppliedStateVersion()
                : null;
            if (localVersion !== null && remoteVersion <= localVersion) return;
            if (state.heartbeatResyncInFlight) return;

            if (typeof cfg.recordNetworkTelemetry === 'function') {
                cfg.recordNetworkTelemetry('heartbeat_resync_requested', {
                    remoteVersion: remoteVersion,
                    localVersion: localVersion
                });
            }
            state.heartbeatResyncInFlight = true;
            Promise.resolve(
                typeof cfg.syncLatestStateWithRetry === 'function'
                    ? cfg.syncLatestStateWithRetry({ maxAttempts: 2, baseDelayMs: 300 })
                    : null
            )
                .then(function () {
                    if (typeof cfg.recordNetworkTelemetry === 'function') {
                        cfg.recordNetworkTelemetry('heartbeat_resync_succeeded', {
                            remoteVersion: remoteVersion,
                            localVersionBefore: localVersion,
                            localVersionAfter: Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : null
                        });
                    }
                })
                .catch(function () {
                    if (typeof cfg.recordNetworkTelemetry === 'function') {
                        cfg.recordNetworkTelemetry('heartbeat_resync_failed', {
                            remoteVersion: remoteVersion,
                            localVersion: localVersion
                        });
                    }
                })
                .finally(function () {
                    state.heartbeatResyncInFlight = false;
                });
        }

        function clearReconnectTimer() {
            var state = readState();
            if (state.reconnectTimerId !== null) {
                clearScheduledTimeout(state.reconnectTimerId);
                state.reconnectTimerId = null;
            }
        }

        function clearReconnectRecoveryTimer() {
            var state = readState();
            if (state.reconnectRecoveryTimerId !== null) {
                clearScheduledTimeout(state.reconnectRecoveryTimerId);
                state.reconnectRecoveryTimerId = null;
            }
        }

        function completeReconnectRecoveryFromStream() {
            var state = readState();
            if (!state.reconnectRecoveryPending) return;
            state.reconnectRecoveryPending = false;
            clearReconnectRecoveryTimer();
        }

        function scheduleReconnectRecoverySync() {
            var state = readState();
            clearReconnectRecoveryTimer();
            state.reconnectRecoveryPending = true;
            state.reconnectRecoveryTimerId = scheduleTimeout(function () {
                state.reconnectRecoveryTimerId = null;
                if (!state.reconnectRecoveryPending) return;
                state.reconnectRecoveryPending = false;
                Promise.resolve(
                    typeof cfg.syncLatestStateWithRetry === 'function'
                        ? cfg.syncLatestStateWithRetry({ maxAttempts: 3, baseDelayMs: 350 })
                        : null
                ).catch(function () {
                    // Keep stream path resilient; next snapshot or reconnect will recover.
                });
            }, cfg.reconnectRecoveryWaitMs);
        }

        function clearStreamWatchdogTimer() {
            var state = readState();
            if (!state.streamWatchdogTimerId) return;
            clearScheduledTimeout(state.streamWatchdogTimerId);
            state.streamWatchdogTimerId = 0;
        }

        function markStreamActivity() {
            var state = readState();
            state.lastStreamActivityAt = Date.now();
        }

        function rememberStreamEventId(event) {
            var state = readState();
            var eventId = String(
                event && typeof event === 'object'
                    ? (event.lastEventId || event.eventId || '')
                    : ''
            ).trim();
            if (!eventId) return;
            state.lastStreamEventId = eventId;
        }

        function scheduleStreamWatchdog() {
            var state = readState();
            clearStreamWatchdogTimer();
            if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;
            if (!state.eventSource) return;

            state.streamWatchdogTimerId = scheduleTimeout(function () {
                state.streamWatchdogTimerId = 0;
                if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;
                if (!state.eventSource) return;

                var lastActivityAt = Number.isFinite(Number(state.lastStreamActivityAt))
                    ? Number(state.lastStreamActivityAt)
                    : 0;
                var elapsedMs = Date.now() - lastActivityAt;

                if (elapsedMs >= cfg.streamStaleTimeoutMs) {
                    if (typeof cfg.emitStatus === 'function') {
                        cfg.emitStatus('ネット対戦: 配信接続の応答がないため再接続します', true);
                    }
                    try {
                        if (state.eventSource) {
                            state.eventSource.close();
                        }
                    } catch (e) { /* ignore */ }
                    state.eventSource = null;
                    scheduleStreamReconnect();
                    return;
                }

                scheduleStreamWatchdog();
            }, cfg.streamWatchdogIntervalMs);
        }

        function scheduleStreamReconnect() {
            var state = readState();
            if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;
            if (state.reconnectTimerId !== null) return;

            var attempt = Number.isFinite(Number(state.reconnectAttempt))
                ? Number(state.reconnectAttempt)
                : 0;
            var delayMs = typeof cfg.computeRetryDelayMs === 'function'
                ? cfg.computeRetryDelayMs(cfg.reconnectBaseDelayMs, cfg.reconnectMaxDelayMs, attempt)
                : cfg.reconnectBaseDelayMs;
            state.reconnectAttempt = attempt + 1;

            state.reconnectTimerId = scheduleTimeout(function () {
                state.reconnectTimerId = null;
                if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;
                if (typeof cfg.openStream === 'function') {
                    cfg.openStream({ reconnect: true });
                }
            }, delayMs);
        }

        function closeStream() {
            var state = readState();
            clearReconnectTimer();
            clearReconnectRecoveryTimer();
            state.reconnectRecoveryPending = false;
            clearStreamWatchdogTimer();
            if (state.eventSource) {
                try { state.eventSource.close(); } catch (e) { /* ignore */ }
                state.eventSource = null;
            }
            state.lastStreamActivityAt = 0;
        }

        return {
            maybeSyncFromHeartbeat: maybeSyncFromHeartbeat,
            clearReconnectTimer: clearReconnectTimer,
            clearReconnectRecoveryTimer: clearReconnectRecoveryTimer,
            completeReconnectRecoveryFromStream: completeReconnectRecoveryFromStream,
            scheduleReconnectRecoverySync: scheduleReconnectRecoverySync,
            clearStreamWatchdogTimer: clearStreamWatchdogTimer,
            markStreamActivity: markStreamActivity,
            rememberStreamEventId: rememberStreamEventId,
            scheduleStreamWatchdog: scheduleStreamWatchdog,
            scheduleStreamReconnect: scheduleStreamReconnect,
            closeStream: closeStream
        };
    }

    return {
        createNetworkReconnectController: createNetworkReconnectController
    };
}));
