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
const NetworkClientListenersModule = (() => {
    try {
        return require('./network-client-listeners');
    } catch (e: any) {
        return null;
    }
})();

function bindNetworkButtons(context: any) {
    const {
        root,
        boardUtils,
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
        normalizeNetworkTurnTimeSeconds,
        readNetworkTurnTimeSeconds,
        stepNetworkTurnTimeSeconds,
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

    if (!NetworkClientListenersModule || typeof NetworkClientListenersModule.bindNetworkClientListeners !== 'function') {
        throw new Error('NetworkClientListenersModule unavailable');
    }
    NetworkClientListenersModule.bindNetworkClientListeners({
        root,
        uiRefs,
        getNetworkMatchClient: () => root.NetworkMatchClient,
        writeNetworkStatus,
        isNetworkSpectatorActive,
        updateNetworkDebugEnabledFromRoomState,
        updateNetworkAutoEnabledFromRoomState,
        applyNetworkDebugModeAccess,
        refreshNetworkAutoModeAccess,
        refreshNetworkChatVisibility,
        renderNetworkDeckInfo,
        setNetworkTurnTimerInfo,
        renderNetworkStatus,
        renderNetworkChatHistory,
        appendNetworkChatMessage,
        showNetworkChatSpeechBubble
    });

    if (!NetworkLobbyInputsModule || typeof NetworkLobbyInputsModule.bindNetworkLobbyInputs !== 'function') {
        throw new Error('NetworkLobbyInputsModule unavailable');
    }
    NetworkLobbyInputsModule.bindNetworkLobbyInputs({
        root,
        boardUtils,
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
        normalizeNetworkTurnTimeSeconds,
        stepNetworkTurnTimeSeconds,
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
            if (!NetworkButtonActionsModule || typeof NetworkButtonActionsModule.closeNetworkRoomSettings !== 'function') {
                throw new Error('NetworkButtonActionsModule unavailable');
            }
            NetworkButtonActionsModule.closeNetworkRoomSettings({ setVisible: setNetworkRoomSettingsPopupVisible });
        });
    }

    if (uiRefs.networkRoomSettingsBackdrop) {
        uiRefs.networkRoomSettingsBackdrop.addEventListener('click', () => {
            if (!NetworkButtonActionsModule || typeof NetworkButtonActionsModule.closeNetworkRoomSettings !== 'function') {
                throw new Error('NetworkButtonActionsModule unavailable');
            }
            NetworkButtonActionsModule.closeNetworkRoomSettings({ setVisible: setNetworkRoomSettingsPopupVisible });
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
                readNetworkTurnTimeSeconds,
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
