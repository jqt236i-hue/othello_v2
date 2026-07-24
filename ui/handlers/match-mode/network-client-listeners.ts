const handledRematchRequestIdsByDocument = new WeakMap<Document, Set<string>>();

function handledRematchRequestIds(doc: Document): Set<string> {
    let requestIds = handledRematchRequestIdsByDocument.get(doc);
    if (!requestIds) {
        requestIds = new Set<string>();
        handledRematchRequestIdsByDocument.set(doc, requestIds);
    }
    return requestIds;
}

function rememberHandledRematchRequest(doc: Document, requestId: string): void {
    if (!requestId) return;
    const requestIds = handledRematchRequestIds(doc);
    requestIds.add(requestId);
    while (requestIds.size > 64) {
        const oldest = requestIds.values().next().value;
        if (!oldest) break;
        requestIds.delete(oldest);
    }
}

function showNetworkRematchRequestDialog(payload: any, options: any): void {
    if (!payload) return;
    const config = options || {};
    const root = config.root || null;
    const doc = (root && root.document) || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    const requestId = String(payload.requestId || '').trim();
    const existing = doc.getElementById('network-rematch-request-dialog');

    if (payload.type === 'response') {
        rememberHandledRematchRequest(doc, requestId);
        if (
            existing
            && (!requestId || String(existing.getAttribute('data-rematch-request-id') || '') === requestId)
            && existing.parentNode
        ) {
            existing.parentNode.removeChild(existing);
        }
        return;
    }
    if (payload.type !== 'request' || !requestId) return;
    if (handledRematchRequestIds(doc).has(requestId)) return;
    if (
        existing
        && String(existing.getAttribute('data-rematch-request-id') || '') === requestId
    ) {
        return;
    }
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    const client = config.getNetworkMatchClient();
    if (
        client
        && typeof client.hasPendingRematchRequest === 'function'
        && client.hasPendingRematchRequest() === true
        && typeof client.acceptRematchRequest === 'function'
    ) {
        rememberHandledRematchRequest(doc, requestId);
        Promise.resolve(client.acceptRematchRequest(requestId)).then((result: any) => {
            if (!result || result.ok !== true) handledRematchRequestIds(doc).delete(requestId);
        }).catch(() => {
            handledRematchRequestIds(doc).delete(requestId);
        });
        return;
    }

    const overlay = doc.createElement('div');
    overlay.id = 'network-rematch-request-dialog';
    overlay.className = 'network-rematch-request-dialog';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('data-rematch-request-id', requestId);

    const panel = doc.createElement('div');
    panel.className = 'network-rematch-request-dialog__panel';
    const title = doc.createElement('div');
    title.className = 'network-rematch-request-dialog__title';
    title.textContent = '再戦申請が来ています。';
    const body = doc.createElement('div');
    body.className = 'network-rematch-request-dialog__body';
    body.textContent = '受理しますか？';
    const actions = doc.createElement('div');
    actions.className = 'network-rematch-request-dialog__actions';
    const acceptBtn = doc.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'premium-btn primary';
    acceptBtn.setAttribute('data-rematch-response', 'accept');
    acceptBtn.textContent = 'はい';
    const declineBtn = doc.createElement('button');
    declineBtn.type = 'button';
    declineBtn.className = 'premium-btn';
    declineBtn.setAttribute('data-rematch-response', 'decline');
    declineBtn.textContent = 'いいえ';

    const close = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
    acceptBtn.addEventListener('click', () => {
        acceptBtn.disabled = true;
        declineBtn.disabled = true;
        rememberHandledRematchRequest(doc, requestId);
        const activeClient = config.getNetworkMatchClient();
        Promise.resolve(activeClient.acceptRematchRequest(requestId)).then((result: any) => {
            if (!result || result.ok !== true) handledRematchRequestIds(doc).delete(requestId);
        }).catch(() => {
            handledRematchRequestIds(doc).delete(requestId);
        }).finally(close);
    });
    declineBtn.addEventListener('click', () => {
        acceptBtn.disabled = true;
        declineBtn.disabled = true;
        rememberHandledRematchRequest(doc, requestId);
        const activeClient = config.getNetworkMatchClient();
        Promise.resolve(activeClient.declineRematchRequest(requestId)).then((result: any) => {
            if (!result || result.ok !== true) handledRematchRequestIds(doc).delete(requestId);
        }).catch(() => {
            handledRematchRequestIds(doc).delete(requestId);
        }).finally(close);
    });

    actions.appendChild(acceptBtn);
    actions.appendChild(declineBtn);
    panel.appendChild(title);
    panel.appendChild(body);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    doc.body.appendChild(overlay);
}

function bindNetworkClientListeners(options: any): void {
    const config = options || {};
    const client = config.getNetworkMatchClient();
    const uiRefs = config.uiRefs || {};
    if (!client) return;

    if (typeof client.setStatusWriter === 'function') {
        client.setStatusWriter((text: any, isError: any) => {
            config.writeNetworkStatus(text, isError);
        });
    }

    if (typeof client.setRoomStateListener === 'function') {
        client.setRoomStateListener((roomState: any) => {
            const spectatorActive = config.isNetworkSpectatorActive(roomState);
            config.updateNetworkDebugEnabledFromRoomState(roomState);
            config.updateNetworkAutoEnabledFromRoomState(roomState);
            config.applyNetworkDebugModeAccess();
            config.refreshNetworkAutoModeAccess();
            config.refreshNetworkChatVisibility();
            config.renderNetworkDeckInfo(roomState);
            if (uiRefs.networkCreateBtn) uiRefs.networkCreateBtn.disabled = spectatorActive;
            if (uiRefs.networkJoinBtn) uiRefs.networkJoinBtn.disabled = spectatorActive;
            if (spectatorActive) config.writeNetworkStatus('観測中', false);
            try {
                if (typeof config.root.updateCpuCharacter === 'function') config.root.updateCpuCharacter();
            } catch (e) { /* ignore */ }
        });
    }

    if (typeof client.setTurnTimerListener === 'function') {
        client.setTurnTimerListener((timerInfo: any) => {
            const nextNetworkTurnTimerInfo = (timerInfo && typeof timerInfo === 'object') ? timerInfo : null;
            config.setNetworkTurnTimerInfo(nextNetworkTurnTimerInfo);
            config.renderNetworkStatus();
            try {
                if (typeof config.root.setBattleStatusNetworkTimerInfo === 'function') {
                    config.root.setBattleStatusNetworkTimerInfo(nextNetworkTurnTimerInfo);
                }
            } catch (e) { /* ignore */ }
        });
    }

    if (typeof client.setChatListener === 'function') {
        client.setChatListener((payload: any) => {
            if (!payload || typeof payload !== 'object') return;
            if (payload.type === 'history') {
                config.renderNetworkChatHistory(payload.messages || []);
                return;
            }
            if (payload.type === 'message' && payload.message) {
                config.appendNetworkChatMessage(payload.message);
                config.showNetworkChatSpeechBubble(payload.message);
            }
        });
    }

    if (typeof client.setRematchRequestListener === 'function') {
        client.setRematchRequestListener((payload: any) => {
            showNetworkRematchRequestDialog(payload, config);
        });
    }
}

export = { bindNetworkClientListeners, showNetworkRematchRequestDialog };
