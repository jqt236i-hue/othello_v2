async function sendNetworkChatMessage(options: any): Promise<any> {
    const input = options.input;
    if (!input) return undefined;
    const text = options.formatChatInput(input.value);
    input.value = text;
    if (!text) return undefined;

    const client = options.getNetworkMatchClient();
    if (!client || typeof client.sendChatMessage !== 'function') return undefined;
    try {
        const result = await client.sendChatMessage(text);
        if (result && result.ok) input.value = '';
        return result;
    } catch (e) {
        options.writeNetworkStatus('チャット送信に失敗しました', true);
        return undefined;
    }
}

function bindNetworkLobbyInputs(options: any): void {
    const config = options || {};
    const uiRefs = config.uiRefs || {};

    if (uiRefs.networkChatToggle) {
        uiRefs.networkChatToggle.addEventListener('click', () => {
            if (!config.getNetworkChatVisible() || !uiRefs.networkChatPanel) return;
            const isOpen = uiRefs.networkChatPanel.classList.contains('is-open');
            config.setNetworkChatExpanded(!isOpen);
        });
    }

    if (uiRefs.networkChatInput) {
        uiRefs.networkChatInput.setAttribute('maxlength', String(config.getChatMaxLength()));
        uiRefs.networkChatInput.addEventListener('input', () => {
            uiRefs.networkChatInput.value = config.formatChatInput(uiRefs.networkChatInput.value);
        });
        uiRefs.networkChatInput.addEventListener('change', () => {
            uiRefs.networkChatInput.value = config.formatChatInput(uiRefs.networkChatInput.value);
        });
        uiRefs.networkChatInput.addEventListener('keydown', (event: any) => {
            if (event && event.key === 'Enter') {
                event.preventDefault();
                sendNetworkChatMessage({
                    input: uiRefs.networkChatInput,
                    formatChatInput: config.formatChatInput,
                    getNetworkMatchClient: config.getNetworkMatchClient,
                    writeNetworkStatus: config.writeNetworkStatus
                });
            }
        });
    }

    if (uiRefs.networkChatSendBtn) {
        uiRefs.networkChatSendBtn.addEventListener('click', () => {
            sendNetworkChatMessage({
                input: uiRefs.networkChatInput,
                formatChatInput: config.formatChatInput,
                getNetworkMatchClient: config.getNetworkMatchClient,
                writeNetworkStatus: config.writeNetworkStatus
            });
        });
    }

    if (uiRefs.networkServerInput) {
        try {
            const client = config.getNetworkMatchClient();
            if (client && typeof client.getServerUrl === 'function') {
                const initial = client.getServerUrl();
                if (initial) uiRefs.networkServerInput.value = initial;
            }
        } catch (e) { /* ignore */ }
        uiRefs.networkServerInput.addEventListener('change', () => {
            const nextUrl = uiRefs.networkServerInput.value.trim();
            const client = config.getNetworkMatchClient();
            if (!client || typeof client.setServerUrl !== 'function') return;
            const changed = client.setServerUrl(nextUrl);
            if (changed === false && typeof client.getServerUrl === 'function') {
                uiRefs.networkServerInput.value = String(client.getServerUrl() || '');
                if (typeof config.writeNetworkStatus === 'function') {
                    config.writeNetworkStatus('接続先を変更するには、先に現在の部屋から退出してください', true);
                }
            }
        });
    }

    if (uiRefs.networkPlayerNameInput) {
        uiRefs.networkPlayerNameInput.setAttribute('maxlength', String(config.playerNameMax));
        uiRefs.networkPlayerNameInput.setAttribute('placeholder', '名前を入力してください');
        const initialName = config.normalizePlayerName(config.getSharedPlayerName());
        let lastPersistedNetworkPlayerName = initialName && initialName !== config.defaultPlayerName ? initialName : '';
        if (initialName && initialName !== config.defaultPlayerName) {
            uiRefs.networkPlayerNameInput.value = initialName;
        } else if (config.normalizePlayerName(uiRefs.networkPlayerNameInput.value) === config.defaultPlayerName) {
            uiRefs.networkPlayerNameInput.value = '';
        }
        const persistNetworkPlayerName = () => {
            const nextName = config.normalizePlayerName(uiRefs.networkPlayerNameInput.value);
            uiRefs.networkPlayerNameInput.value = nextName;
            if (!nextName || nextName === lastPersistedNetworkPlayerName) return;
            lastPersistedNetworkPlayerName = config.setSharedPlayerName(nextName) || nextName;
            try {
                const leaderboard = config.root && config.root.LeaderboardClient;
                if (leaderboard && typeof leaderboard.updatePublicProfile === 'function') {
                    void Promise.resolve(leaderboard.updatePublicProfile()).catch(() => undefined);
                }
            } catch (e) { /* ignore */ }
        };
        uiRefs.networkPlayerNameInput.addEventListener('input', () => {
            uiRefs.networkPlayerNameInput.value = config.normalizePlayerName(uiRefs.networkPlayerNameInput.value);
        });
        uiRefs.networkPlayerNameInput.addEventListener('change', persistNetworkPlayerName);
        uiRefs.networkPlayerNameInput.addEventListener('blur', persistNetworkPlayerName);
    }

    if (uiRefs.networkRoomPasswordInput) {
        uiRefs.networkRoomPasswordInput.setAttribute('maxlength', '20');
        uiRefs.networkRoomPasswordInput.addEventListener('input', () => {
            uiRefs.networkRoomPasswordInput.value = config.normalizeRoomPassword(uiRefs.networkRoomPasswordInput.value);
        });
        uiRefs.networkRoomPasswordInput.addEventListener('change', () => {
            uiRefs.networkRoomPasswordInput.value = config.normalizeRoomPassword(uiRefs.networkRoomPasswordInput.value);
        });
    }

    if (uiRefs.networkRoomInput) {
        uiRefs.networkRoomInput.addEventListener('input', () => {
            uiRefs.networkRoomInput.value = config.normalizeRoomName(uiRefs.networkRoomInput.value);
            config.setSelectedNetworkRoomId('');
        });
        uiRefs.networkRoomInput.addEventListener('change', () => {
            uiRefs.networkRoomInput.value = config.normalizeRoomName(uiRefs.networkRoomInput.value);
        });
    }

    const bindNetworkBoardSizeInput = (inputRef: any, axis: any) => {
        if (!inputRef || inputRef.dataset.networkBoardSizeBound === '1') return;
        const onBoardSizeInput = (event: any) => {
            if (inputRef.disabled) return;
            if (typeof config.syncNetworkCircleBoardSizeInputs === 'function'
                && !config.syncNetworkCircleBoardSizeInputs(inputRef, event && event.type === 'change')) return;
            config.updatePendingRoomBoardConfigFromInputs();
        };
        inputRef.addEventListener('input', onBoardSizeInput);
        inputRef.addEventListener('change', onBoardSizeInput);
        inputRef.addEventListener('wheel', (event: any) => {
            if (inputRef.disabled) return;
            const primaryDelta = config.readPrimaryWheelDelta(event);
            if (!primaryDelta) return;
            const fallback = config.getPendingRoomBoardConfig();
            const fallbackValue = axis === 'col' ? fallback.cols : fallback.rows;
            const direction = primaryDelta < 0 ? 1 : -1;
            const circle = uiRefs.networkBoardShapeSelect && uiRefs.networkBoardShapeSelect.value === 'circle';
            const boardUtils = config.boardUtils || (config.root && config.root.SharedBoardUtils);
            inputRef.value = String(circle && boardUtils && typeof boardUtils.normalizeCircleBoardSize === 'function'
                ? boardUtils.normalizeCircleBoardSize(Number(inputRef.value) + direction * boardUtils.CIRCLE_BOARD_SIZE_STEP, fallbackValue)
                : config.stepBoardDimensionValue(inputRef.value, direction, fallbackValue, axis));
            if (typeof config.syncNetworkCircleBoardSizeInputs === 'function') {
                config.syncNetworkCircleBoardSizeInputs(inputRef, true);
            }
            if (event && event.cancelable) event.preventDefault();
            config.updatePendingRoomBoardConfigFromInputs();
        }, { passive: false });
        inputRef.dataset.networkBoardSizeBound = '1';
    };
    bindNetworkBoardSizeInput(uiRefs.networkBoardSizeRowsInput, 'row');
    bindNetworkBoardSizeInput(uiRefs.networkBoardSizeColsInput, 'col');
    if (uiRefs.networkTurnTimeSecondsInput && uiRefs.networkTurnTimeSecondsInput.dataset.networkTurnTimeBound !== '1') {
        const input = uiRefs.networkTurnTimeSecondsInput;
        input.addEventListener('change', () => {
            if (input.disabled) return;
            input.value = String(config.normalizeNetworkTurnTimeSeconds(input.value));
        });
        input.addEventListener('wheel', (event: any) => {
            if (input.disabled) return;
            const primaryDelta = config.readPrimaryWheelDelta(event);
            if (!primaryDelta) return;
            config.stepNetworkTurnTimeSeconds(primaryDelta < 0 ? 1 : -1);
            if (event && event.cancelable) event.preventDefault();
        }, { passive: false });
        input.dataset.networkTurnTimeBound = '1';
    }
    if (uiRefs.networkBoardShapeSelect && uiRefs.networkBoardShapeSelect.dataset.networkBoardShapeBound !== '1') {
        uiRefs.networkBoardShapeSelect.addEventListener('change', () => {
            if (uiRefs.networkBoardShapeSelect.disabled) return;
            config.updatePendingRoomBoardConfigFromInputs();
        });
        uiRefs.networkBoardShapeSelect.dataset.networkBoardShapeBound = '1';
    }

    if (uiRefs.networkAllCardsDeckCheckbox) {
        uiRefs.networkAllCardsDeckCheckbox.addEventListener('change', () => {
            config.renderNetworkDeckInfo();
        });
    }
}

export = { bindNetworkLobbyInputs, sendNetworkChatMessage };
