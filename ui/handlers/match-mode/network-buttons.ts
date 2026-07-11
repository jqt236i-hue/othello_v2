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

    const sendChatMessage = async () => {
        if (!uiRefs.networkChatInput) return;
        const text = formatChatInput(uiRefs.networkChatInput.value);
        uiRefs.networkChatInput.value = text;
        if (!text) return;

        if (!root.NetworkMatchClient || typeof root.NetworkMatchClient.sendChatMessage !== 'function') {
            return;
        }

        try {
            const result = await root.NetworkMatchClient.sendChatMessage(text);
            if (result && result.ok) {
                uiRefs.networkChatInput.value = '';
            }
        } catch (e) {
            writeNetworkStatus('チャット送信に失敗しました', true);
        }
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

    if (uiRefs.networkChatToggle) {
        uiRefs.networkChatToggle.addEventListener('click', () => {
            if (!getNetworkChatVisible() || !uiRefs.networkChatPanel) return;
            const isOpen = uiRefs.networkChatPanel.classList.contains('is-open');
            setNetworkChatExpanded(!isOpen);
        });
    }

    if (uiRefs.networkChatInput) {
        uiRefs.networkChatInput.setAttribute('maxlength', String(getChatMaxLength()));
        uiRefs.networkChatInput.addEventListener('input', () => {
            uiRefs.networkChatInput.value = formatChatInput(uiRefs.networkChatInput.value);
        });
        uiRefs.networkChatInput.addEventListener('change', () => {
            uiRefs.networkChatInput.value = formatChatInput(uiRefs.networkChatInput.value);
        });
        uiRefs.networkChatInput.addEventListener('keydown', (event: any) => {
            if (event && event.key === 'Enter') {
                event.preventDefault();
                sendChatMessage();
            }
        });
    }

    if (uiRefs.networkChatSendBtn) {
        uiRefs.networkChatSendBtn.addEventListener('click', () => {
            sendChatMessage();
        });
    }

    if (uiRefs.networkServerInput) {
        try {
            if (root.NetworkMatchClient && typeof root.NetworkMatchClient.getServerUrl === 'function') {
                const initial = root.NetworkMatchClient.getServerUrl();
                if (initial) uiRefs.networkServerInput.value = initial;
            }
        } catch (e) { /* ignore */ }
        uiRefs.networkServerInput.addEventListener('change', () => {
            const nextUrl = uiRefs.networkServerInput.value.trim();
            if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setServerUrl === 'function') {
                root.NetworkMatchClient.setServerUrl(nextUrl);
            }
        });
    }

    if (uiRefs.networkPlayerNameInput) {
        uiRefs.networkPlayerNameInput.setAttribute('maxlength', String(PLAYER_NAME_MAX));
        uiRefs.networkPlayerNameInput.setAttribute('placeholder', '名前を入力してください');
        const initialName = normalizePlayerName(getSharedPlayerName());
        let lastPersistedNetworkPlayerName = initialName && initialName !== DEFAULT_PLAYER_NAME ? initialName : '';
        if (initialName && initialName !== DEFAULT_PLAYER_NAME) {
            uiRefs.networkPlayerNameInput.value = initialName;
        } else if (normalizePlayerName(uiRefs.networkPlayerNameInput.value) === DEFAULT_PLAYER_NAME) {
            uiRefs.networkPlayerNameInput.value = '';
        }
        const persistNetworkPlayerName = () => {
            const nextName = normalizePlayerName(uiRefs.networkPlayerNameInput.value);
            uiRefs.networkPlayerNameInput.value = nextName;
            if (!nextName || nextName === lastPersistedNetworkPlayerName) return;
            lastPersistedNetworkPlayerName = setSharedPlayerName(nextName) || nextName;
            try {
                const leaderboard = root && root.LeaderboardClient;
                if (leaderboard && typeof leaderboard.updatePublicProfile === 'function') {
                    void Promise.resolve(leaderboard.updatePublicProfile()).catch(() => undefined);
                }
            } catch (e) { /* ignore */ }
        };
        uiRefs.networkPlayerNameInput.addEventListener('input', () => {
            uiRefs.networkPlayerNameInput.value = normalizePlayerName(uiRefs.networkPlayerNameInput.value);
        });
        uiRefs.networkPlayerNameInput.addEventListener('change', () => {
            persistNetworkPlayerName();
        });
        uiRefs.networkPlayerNameInput.addEventListener('blur', persistNetworkPlayerName);
    }

    if (uiRefs.networkRoomPasswordInput) {
        uiRefs.networkRoomPasswordInput.setAttribute('maxlength', '20');
        uiRefs.networkRoomPasswordInput.addEventListener('input', () => {
            uiRefs.networkRoomPasswordInput.value = normalizeRoomPassword(uiRefs.networkRoomPasswordInput.value);
        });
        uiRefs.networkRoomPasswordInput.addEventListener('change', () => {
            uiRefs.networkRoomPasswordInput.value = normalizeRoomPassword(uiRefs.networkRoomPasswordInput.value);
        });
    }

    if (uiRefs.networkRoomInput) {
        uiRefs.networkRoomInput.addEventListener('input', () => {
            uiRefs.networkRoomInput.value = normalizeRoomName(uiRefs.networkRoomInput.value);
            setSelectedNetworkRoomId('');
        });
        uiRefs.networkRoomInput.addEventListener('change', () => {
            uiRefs.networkRoomInput.value = normalizeRoomName(uiRefs.networkRoomInput.value);
        });
    }

    const bindNetworkBoardSizeInput = (inputRef: any, axis: any) => {
        if (!inputRef || inputRef.dataset.networkBoardSizeBound === '1') return;
        const onBoardSizeInput = () => {
            if (inputRef.disabled) return;
            updatePendingRoomBoardConfigFromInputs();
        };
        inputRef.addEventListener('input', onBoardSizeInput);
        inputRef.addEventListener('change', onBoardSizeInput);
        inputRef.addEventListener('wheel', (event: any) => {
            if (inputRef.disabled) return;
            const primaryDelta = readPrimaryWheelDelta(event);
            if (!primaryDelta) return;
            const fallback = getPendingRoomBoardConfig();
            const fallbackValue = axis === 'col' ? fallback.cols : fallback.rows;
            inputRef.value = String(stepBoardDimensionValue(
                inputRef.value,
                primaryDelta < 0 ? 1 : -1,
                fallbackValue,
                axis
            ));
            if (event && event.cancelable) event.preventDefault();
            updatePendingRoomBoardConfigFromInputs();
        }, { passive: false });
        inputRef.dataset.networkBoardSizeBound = '1';
    };
    bindNetworkBoardSizeInput(uiRefs.networkBoardSizeRowsInput, 'row');
    bindNetworkBoardSizeInput(uiRefs.networkBoardSizeColsInput, 'col');

    if (uiRefs.networkAllCardsDeckCheckbox) {
        uiRefs.networkAllCardsDeckCheckbox.addEventListener('change', () => {
            renderNetworkDeckInfo();
        });
    }

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
            refreshNetworkRoomList();
        });
    }

    if (uiRefs.networkRoomSettingsBtn) {
        uiRefs.networkRoomSettingsBtn.addEventListener('click', () => {
            const isOpen = !!(
                uiRefs.networkRoomSettingsPopup
                && uiRefs.networkRoomSettingsPopup.classList.contains('is-open')
            );
            setNetworkRoomSettingsPopupVisible(!isOpen);
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
            await setMode(MODE_NETWORK, { silentLog: true });
            const serverUrl = uiRefs.networkServerInput ? uiRefs.networkServerInput.value.trim() : '';
            const playerName = uiRefs.networkPlayerNameInput
                ? normalizePlayerName(uiRefs.networkPlayerNameInput.value)
                : '';
            const localDeckSelection = readActiveLocalDeckSelection();
            const deckCode = localDeckSelection.deckCode;
            const roomBoardConfig = getPendingRoomBoardConfig();
            const requestedNetworkDebugEnabled = !!(
                uiRefs.networkEnableDebugCheckbox
                && uiRefs.networkEnableDebugCheckbox.checked
            );
            const requestedNetworkAutoEnabled = !!(
                uiRefs.networkEnableAutoCheckbox
                && uiRefs.networkEnableAutoCheckbox.checked
            );
            const requestedAllCardsDeckEnabled = typeof readNetworkAllCardsDeckEnabled === 'function'
                ? readNetworkAllCardsDeckEnabled()
                : !!(uiRefs.networkAllCardsDeckCheckbox && uiRefs.networkAllCardsDeckCheckbox.checked);
            notifyInvalidCustomDeckFallback(localDeckSelection);
            try {
                if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setServerUrl === 'function') {
                    root.NetworkMatchClient.setServerUrl(serverUrl);
                }
                const result = await root.NetworkMatchClient.createRoom({
                    serverUrl,
                    playerName,
                    deckCode,
                    roomName: readNetworkRoomName(),
                    roomPassword: readNetworkRoomPassword(),
                    roomBoardConfig,
                    networkDebugEnabled: requestedNetworkDebugEnabled,
                    networkAutoEnabled: requestedNetworkAutoEnabled,
                    allCardsDeckEnabled: requestedAllCardsDeckEnabled
                });
                if (result && result.ok && uiRefs.networkRoomInput) {
                    uiRefs.networkRoomInput.value = result.roomName || readNetworkRoomName() || '無名部屋';
                }
                if (result && result.ok && result.playerName && uiRefs.networkPlayerNameInput) {
                    uiRefs.networkPlayerNameInput.value = result.playerName;
                    setSharedPlayerName(result.playerName);
                }
                if (result && result.ok) {
                    setNetworkRoomDebugEnabled(result.networkDebugEnabled === true);
                    setNetworkRoomAutoEnabled(result.networkAutoEnabled === true);
                    applyNetworkDebugModeAccess();
                    refreshNetworkAutoModeAccess();
                    tryAutoEnableDebugModeForNetworkRoom();
                    setNetworkRoomSettingsPopupVisible(false);
                }
                refreshNetworkChatVisibility();
                renderNetworkDeckInfo();
                refreshNetworkRoomList({ silentStatus: true });
                refreshBoardUi();
            } catch (e) {
                writeNetworkStatus('部屋作成に失敗しました', true);
            }
        });
    }

    if (uiRefs.networkJoinBtn) {
        uiRefs.networkJoinBtn.addEventListener('click', async () => {
            await setMode(MODE_NETWORK, { silentLog: true });
            const roomId = getSelectedNetworkRoomId();
            const serverUrl = uiRefs.networkServerInput ? uiRefs.networkServerInput.value.trim() : '';
            const playerName = resolveRequiredNetworkPlayerName();
            const localDeckSelection = readActiveLocalDeckSelection();
            const deckCode = localDeckSelection.deckCode;
            if (!playerName) return;
            if (!roomId) {
                writeNetworkStatus('ルーム一覧から参加するルームを選んでください', true);
                return;
            }
            notifyInvalidCustomDeckFallback(localDeckSelection);
            try {
                if (root.NetworkMatchClient && typeof root.NetworkMatchClient.setServerUrl === 'function') {
                    root.NetworkMatchClient.setServerUrl(serverUrl);
                }
                const result = await root.NetworkMatchClient.joinRoom(roomId, {
                    serverUrl,
                    playerName,
                    deckCode,
                    roomPassword: readNetworkRoomPassword()
                });
                if (result && result.ok) {
                    setNetworkRoomDebugEnabled(result.networkDebugEnabled === true);
                    setNetworkRoomAutoEnabled(result.networkAutoEnabled === true);
                    applyNetworkDebugModeAccess();
                    refreshNetworkAutoModeAccess();
                    tryAutoEnableDebugModeForNetworkRoom();
                }
                refreshNetworkChatVisibility();
                renderNetworkDeckInfo();
                if (result && result.ok) {
                    await refreshNetworkRoomList({ silentStatus: true });
                }
                refreshBoardUi();
            } catch (e) {
                writeNetworkStatus('部屋参加に失敗しました', true);
            }
        });
    }

    if (uiRefs.networkLeaveBtn) {
        uiRefs.networkLeaveBtn.addEventListener('click', async () => {
            try {
                if (root.NetworkMatchClient && typeof root.NetworkMatchClient.leaveRoom === 'function') {
                    await root.NetworkMatchClient.leaveRoom();
                }
            } catch (e) { /* ignore */ }
            setNetworkRoomDebugEnabled(false);
            setNetworkRoomAutoEnabled(false);
            if (uiRefs.networkEnableDebugCheckbox) {
                uiRefs.networkEnableDebugCheckbox.checked = false;
            }
            if (uiRefs.networkEnableAutoCheckbox) {
                uiRefs.networkEnableAutoCheckbox.checked = false;
            }
            applyNetworkDebugModeAccess();
            refreshNetworkAutoModeAccess();
            await setMode(MODE_CPU, { silentLog: true, skipNetworkLeave: true });
            renderNetworkDeckInfo(null);
            refreshBoardUi();
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
