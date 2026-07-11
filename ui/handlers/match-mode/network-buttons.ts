const NetworkClipboardModule = (() => {
    try {
        return require('./network-clipboard');
    } catch (e: any) {
        return null;
    }
})();
const NetworkButtonActionsModule = (() => {
    try {
        return require('./network-button-actions');
    } catch (e: any) {
        return null;
    }
})();
const NetworkLobbyInputsModule = (() => {
    try {
        return require('./network-lobby-inputs');
    } catch (e: any) {
        return null;
    }
})();

function bindNetworkButtons(context: any) {
    const {
        root,
        uiRefs,
        PLAYER_NAME_MAX,
        DEFAULT_PLAYER_NAME,
        MODE_NETWORK,
        MODE_CPU,
        getNetworkChatVisible,
        setNetworkTurnTimerInfo,
        setNetworkRoomDebugEnabled,
        setNetworkRoomAutoEnabled,
        getSelectedNetworkRoomId,
        setSelectedNetworkRoomId,
        formatChatInput,
        writeNetworkStatus,
        isNetworkSpectatorActive,
        updateNetworkDebugEnabledFromRoomState,
        updateNetworkAutoEnabledFromRoomState,
        applyNetworkDebugModeAccess,
        refreshNetworkAutoModeAccess,
        refreshNetworkChatVisibility,
        renderNetworkDeckInfo,
        renderNetworkStatus,
        renderNetworkChatHistory,
        appendNetworkChatMessage,
        showNetworkChatSpeechBubble,
        setNetworkChatExpanded,
        getChatMaxLength,
        normalizePlayerName,
        getSharedPlayerName,
        normalizeRoomPassword,
        normalizeRoomName,
        readPrimaryWheelDelta,
        getPendingRoomBoardConfig,
        stepBoardDimensionValue,
        updatePendingRoomBoardConfigFromInputs,
        readNetworkRoomName,
        readNetworkRoomPassword,
        readNetworkAllCardsDeckEnabled,
        refreshNetworkRoomList,
        setNetworkRoomSettingsPopupVisible,
        setMode,
        readActiveLocalDeckSelection,
        notifyInvalidCustomDeckFallback,
        setSharedPlayerName,
        tryAutoEnableDebugModeForNetworkRoom,
        refreshBoardUi,
        resolveRequiredNetworkPlayerName
    } = context;
    const copyTextToClipboard = (value: any) => {
        if (NetworkClipboardModule && typeof NetworkClipboardModule.copyTextToClipboard === 'function') {
            return NetworkClipboardModule.copyTextToClipboard(root, typeof document !== 'undefined' ? document : null, value);
        }
        return Promise.resolve(false);
    };

    if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setStatusWriter === 'function') {
        root.NetworkMatchClient.setStatusWriter((text: any, isError: any) => {
            writeNetworkStatus(text, isError);
        });
    }

    if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setRoomStateListener === 'function') {
        root.NetworkMatchClient.setRoomStateListener((roomState: any) => {
            const spectatorActive = isNetworkSpectatorActive(roomState);
            updateNetworkDebugEnabledFromRoomState(roomState);
            updateNetworkAutoEnabledFromRoomState(roomState);
            applyNetworkDebugModeAccess();
            refreshNetworkAutoModeAccess();
            refreshNetworkChatVisibility();
            renderNetworkDeckInfo(roomState);
            if (uiRefs.networkCreateBtn) uiRefs.networkCreateBtn.disabled = spectatorActive;
            if (uiRefs.networkJoinBtn) uiRefs.networkJoinBtn.disabled = spectatorActive;
            if (spectatorActive) {
                writeNetworkStatus('観測中', false);
            }
            try {
                if (typeof root.updateCpuCharacter === 'function') {
                    root.updateCpuCharacter();
                }
            } catch (e) { /* ignore */ }
        });
    }

    if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setTurnTimerListener === 'function') {
        root.NetworkMatchClient.setTurnTimerListener((timerInfo: any) => {
            const nextNetworkTurnTimerInfo = (timerInfo && typeof timerInfo === 'object') ? timerInfo : null;
            setNetworkTurnTimerInfo(nextNetworkTurnTimerInfo);
            renderNetworkStatus();
            try {
                if (typeof root.setBattleStatusNetworkTimerInfo === 'function') {
                    root.setBattleStatusNetworkTimerInfo(nextNetworkTurnTimerInfo);
                }
            } catch (e) { /* ignore */ }
        });
    }

    if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setChatListener === 'function') {
        root.NetworkMatchClient.setChatListener((payload: any) => {
            if (!payload || typeof payload !== 'object') return;
            if (payload.type === 'history') {
                renderNetworkChatHistory(payload.messages || []);
                return;
            }
            if (payload.type === 'message' && payload.message) {
                appendNetworkChatMessage(payload.message);
                showNetworkChatSpeechBubble(payload.message);
            }
        });
    }

    if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setRematchRequestListener === 'function') {
        root.NetworkMatchClient.setRematchRequestListener((payload: any) => {
            if (!payload || payload.type !== 'request') return;
            const doc = root.document || (typeof document !== 'undefined' ? document : null);
            if (!doc) return;
            const existing = doc.getElementById('network-rematch-request-dialog');
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

            const overlay = doc.createElement('div');
            overlay.id = 'network-rematch-request-dialog';
            overlay.className = 'network-rematch-request-dialog';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');

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
                Promise.resolve(root.NetworkMatchClient.acceptRematchRequest(payload.requestId))
                    .finally(close);
            });
            declineBtn.addEventListener('click', () => {
                acceptBtn.disabled = true;
                declineBtn.disabled = true;
                Promise.resolve(root.NetworkMatchClient.declineRematchRequest(payload.requestId))
                    .finally(close);
            });

            actions.appendChild(acceptBtn);
            actions.appendChild(declineBtn);
            panel.appendChild(title);
            panel.appendChild(body);
            panel.appendChild(actions);
            overlay.appendChild(panel);
            doc.body.appendChild(overlay);
        });
    }

    if (!NetworkLobbyInputsModule || typeof NetworkLobbyInputsModule.bindNetworkLobbyInputs !== 'function') {
        throw new Error('NetworkLobbyInputsModule unavailable');
    }
    NetworkLobbyInputsModule.bindNetworkLobbyInputs({
        root,
        uiRefs,
        playerNameMax: PLAYER_NAME_MAX,
        defaultPlayerName: DEFAULT_PLAYER_NAME,
        getNetworkMatchClient: () => root.NetworkMatchClient,
        getNetworkChatVisible,
        setNetworkChatExpanded,
        getChatMaxLength,
        formatChatInput,
        writeNetworkStatus,
        normalizePlayerName,
        getSharedPlayerName,
        setSharedPlayerName,
        normalizeRoomPassword,
        normalizeRoomName,
        setSelectedNetworkRoomId,
        readPrimaryWheelDelta,
        getPendingRoomBoardConfig,
        stepBoardDimensionValue,
        updatePendingRoomBoardConfigFromInputs,
        renderNetworkDeckInfo
    });

    if (uiRefs.networkCopyRoomBtn) {
        uiRefs.networkCopyRoomBtn.addEventListener('click', async () => {
            if (!NetworkButtonActionsModule || typeof NetworkButtonActionsModule.copyNetworkRoomName !== 'function') {
                throw new Error('NetworkButtonActionsModule unavailable');
            }
            await NetworkButtonActionsModule.copyNetworkRoomName({
                readNetworkRoomName,
                copyTextToClipboard,
                writeNetworkStatus
            });
        });
    }

    if (uiRefs.networkRoomListRefreshBtn) {
        uiRefs.networkRoomListRefreshBtn.addEventListener('click', () => {
            if (!NetworkButtonActionsModule || typeof NetworkButtonActionsModule.refreshNetworkRooms !== 'function') {
                throw new Error('NetworkButtonActionsModule unavailable');
            }
            NetworkButtonActionsModule.refreshNetworkRooms({ refreshNetworkRoomList });
        });
    }

    if (uiRefs.networkRoomSettingsBtn) {
        uiRefs.networkRoomSettingsBtn.addEventListener('click', () => {
            if (!NetworkButtonActionsModule || typeof NetworkButtonActionsModule.toggleNetworkRoomSettings !== 'function') {
                throw new Error('NetworkButtonActionsModule unavailable');
            }
            NetworkButtonActionsModule.toggleNetworkRoomSettings({
                popup: uiRefs.networkRoomSettingsPopup,
                setVisible: setNetworkRoomSettingsPopupVisible
            });
        });
    }

    if (uiRefs.networkRoomSettingsCloseBtn) {
        uiRefs.networkRoomSettingsCloseBtn.addEventListener('click', () => {
            setNetworkRoomSettingsPopupVisible(false);
        });
    }

    if (uiRefs.networkRoomSettingsBackdrop) {
        uiRefs.networkRoomSettingsBackdrop.addEventListener('click', () => {
            setNetworkRoomSettingsPopupVisible(false);
        });
    }

    if (uiRefs.networkCreateBtn) {
        uiRefs.networkCreateBtn.addEventListener('click', async () => {
            if (!NetworkButtonActionsModule || typeof NetworkButtonActionsModule.createNetworkRoom !== 'function') {
                throw new Error('NetworkButtonActionsModule unavailable');
            }
            await NetworkButtonActionsModule.createNetworkRoom({
                networkMode: MODE_NETWORK,
                setMode,
                client: root.NetworkMatchClient,
                serverInput: uiRefs.networkServerInput,
                playerNameInput: uiRefs.networkPlayerNameInput,
                roomInput: uiRefs.networkRoomInput,
                debugCheckbox: uiRefs.networkEnableDebugCheckbox,
                autoCheckbox: uiRefs.networkEnableAutoCheckbox,
                allCardsDeckCheckbox: uiRefs.networkAllCardsDeckCheckbox,
                normalizePlayerName,
                readActiveLocalDeckSelection,
                getPendingRoomBoardConfig,
                readNetworkAllCardsDeckEnabled,
                notifyInvalidCustomDeckFallback,
                readNetworkRoomName,
                readNetworkRoomPassword,
                setSharedPlayerName,
                roomSettings: { setNetworkRoomDebugEnabled, setNetworkRoomAutoEnabled, applyNetworkDebugModeAccess, refreshNetworkAutoModeAccess, tryAutoEnableDebugModeForNetworkRoom },
                setNetworkRoomSettingsPopupVisible,
                refreshNetworkChatVisibility,
                renderNetworkDeckInfo,
                refreshNetworkRoomList,
                refreshBoardUi,
                writeNetworkStatus
            });
        });
    }

    if (uiRefs.networkJoinBtn) {
        uiRefs.networkJoinBtn.addEventListener('click', async () => {
            if (!NetworkButtonActionsModule || typeof NetworkButtonActionsModule.joinNetworkRoom !== 'function') {
                throw new Error('NetworkButtonActionsModule unavailable');
            }
            await NetworkButtonActionsModule.joinNetworkRoom({
                networkMode: MODE_NETWORK,
                setMode,
                client: root.NetworkMatchClient,
                serverInput: uiRefs.networkServerInput,
                getSelectedNetworkRoomId,
                resolveRequiredNetworkPlayerName,
                readActiveLocalDeckSelection,
                notifyInvalidCustomDeckFallback,
                readNetworkRoomPassword,
                roomSettings: { setNetworkRoomDebugEnabled, setNetworkRoomAutoEnabled, applyNetworkDebugModeAccess, refreshNetworkAutoModeAccess, tryAutoEnableDebugModeForNetworkRoom },
                refreshNetworkChatVisibility,
                renderNetworkDeckInfo,
                refreshNetworkRoomList,
                refreshBoardUi,
                writeNetworkStatus
            });
        });
    }

    if (uiRefs.networkLeaveBtn) {
        uiRefs.networkLeaveBtn.addEventListener('click', async () => {
            if (!NetworkButtonActionsModule || typeof NetworkButtonActionsModule.leaveNetworkRoom !== 'function') {
                throw new Error('NetworkButtonActionsModule unavailable');
            }
            await NetworkButtonActionsModule.leaveNetworkRoom({
                client: root.NetworkMatchClient,
                setNetworkRoomDebugEnabled,
                setNetworkRoomAutoEnabled,
                debugCheckbox: uiRefs.networkEnableDebugCheckbox,
                autoCheckbox: uiRefs.networkEnableAutoCheckbox,
                applyNetworkDebugModeAccess,
                refreshNetworkAutoModeAccess,
                setMode,
                cpuMode: MODE_CPU,
                renderNetworkDeckInfo,
                refreshBoardUi
            });
        });
    }

    setNetworkChatExpanded(false);
    refreshNetworkChatVisibility();
    renderNetworkDeckInfo();
    applyNetworkDebugModeAccess();
}

const MatchModeNetworkButtons = {
    bindNetworkButtons
};

export = MatchModeNetworkButtons;
